-- =====================================================================
-- Data warehouse · pasos 4 y 6: carga en un procedimiento almacenado
-- =====================================================================
-- Se corre conectado a eventos_dw. Crea el procedimiento cargar_dw(), que se ejecuta con:
--     CALL cargar_dw();
-- y se puede repetir las veces que haga falta (por ejemplo, todas las noches).
--
-- Cada vez: vacía el DW y lo vuelve a llenar con INSERT … SELECT desde la base operativa
-- (las tablas del esquema operativa), PRIMERO las dimensiones y DESPUÉS los hechos, porque
-- los hechos guardan las claves (sk_*) de las dimensiones.
-- Todo pasa en una transacción: si algo falla, el DW queda como estaba.

CREATE OR REPLACE PROCEDURE cargar_dw()
LANGUAGE plpgsql AS $$
DECLARE
  n_items INT;
BEGIN
  -- 0. Vaciar (los hechos primero: dependen de las dimensiones)
  TRUNCATE fact_ventas;
  TRUNCATE dim_tiempo, dim_empresa, dim_cliente, dim_tipo_evento, dim_servicio, dim_estado_propuesta
    RESTART IDENTITY CASCADE;

  -- ── 1. DIMENSIONES ──────────────────────────────────────────────────

  -- Tiempo: un día por cada fecha entre el primer y el último evento
  INSERT INTO dim_tiempo
  SELECT to_char(d, 'YYYYMMDD')::int, d,
         EXTRACT(YEAR FROM d), EXTRACT(QUARTER FROM d), EXTRACT(MONTH FROM d),
         (ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                'Septiembre','Octubre','Noviembre','Diciembre'])[EXTRACT(MONTH FROM d)::int],
         to_char(d, 'YYYY-MM'),
         (ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'])[EXTRACT(ISODOW FROM d)::int],
         CASE WHEN EXTRACT(MONTH FROM d) IN (1, 2) THEN 'Vacaciones de verano'
              WHEN EXTRACT(MONTH FROM d) IN (3, 4) THEN 'Inicio de clases'
              WHEN EXTRACT(MONTH FROM d) IN (5, 6) THEN 'Primer cuatrimestre'
              WHEN EXTRACT(MONTH FROM d) = 7       THEN 'Vacaciones de invierno'
              WHEN EXTRACT(MONTH FROM d) IN (8, 9) THEN 'Segundo cuatrimestre'
              ELSE 'Fin de año' END
    FROM (SELECT generate_series(MIN(fecha), MAX(fecha), INTERVAL '1 day')::date AS d
            FROM operativa.eventos) dias;

  INSERT INTO dim_empresa (id_empresa, nombre)
  SELECT id_empresa, nombre FROM operativa.empresas;

  INSERT INTO dim_cliente (id_cliente, nombre, tipo, institucion)
  SELECT id_cliente, nombre,
         CASE tipo WHEN 'centro_estudiantes' THEN 'Centro de estudiantes'
                   WHEN 'grupo_estudiantes'  THEN 'Grupo de estudiantes'
                   ELSE 'Curso' END,
         COALESCE(NULLIF(TRIM(institucion), ''), 'Sin dato')
    FROM operativa.clientes;

  INSERT INTO dim_tipo_evento (id_tipo_evento, nombre)
  SELECT id_tipo_evento, nombre FROM operativa.tipos_evento;

  INSERT INTO dim_servicio (id_servicio, nombre, precio_referencia)
  SELECT id_servicio, nombre, precio_referencia FROM operativa.servicios;

  -- Los estados posibles de una propuesta (son fijos en el sistema)
  INSERT INTO dim_estado_propuesta VALUES
    (1, 'en_preparacion', 'En preparación', 'Abierta'),
    (2, 'presentada',     'Presentada',     'Abierta'),
    (3, 'aceptada',       'Aceptada',       'Ganada'),
    (4, 'rechazada',      'Rechazada',      'Perdida'),
    (5, 'vencida',        'Vencida',        'Perdida');

  -- ── 2. HECHOS ───────────────────────────────────────────────────────
  -- Una fila por ítem de propuesta. Las claves de la base operativa (id_*) se cambian por las
  -- del DW (sk_*) con un JOIN a cada dimensión.
  -- importe_neto reparte el descuento de la propuesta entre sus ítems, en proporción a su
  -- importe: así la suma de importe_neto de una propuesta da su total con descuento.
  INSERT INTO fact_ventas
  SELECT i.id_item,
         t.sk_tiempo, de.sk_empresa, dc.sk_cliente, dt.sk_tipo_evento, ds.sk_servicio, dp.sk_estado,
         p.id_propuesta,
         NULLIF(TRIM(p.motivo_rechazo), ''),
         i.cantidad,
         i.precio_unitario,
         i.cantidad * i.precio_unitario,
         i.cantidad * i.precio_unitario * GREATEST(tot.subtotal - p.descuento, 0) / NULLIF(tot.subtotal, 0),
         CASE WHEN p.estado = 'aceptada' THEN 1 ELSE 0 END
    FROM operativa.propuesta_items i
    JOIN operativa.propuestas p ON p.id_propuesta = i.id_propuesta
    JOIN operativa.eventos e    ON e.id_evento = p.id_evento
    JOIN (SELECT id_propuesta, SUM(cantidad * precio_unitario) AS subtotal   -- subtotal de cada propuesta
            FROM operativa.propuesta_items GROUP BY id_propuesta) tot ON tot.id_propuesta = p.id_propuesta
    JOIN dim_tiempo t            ON t.fecha = e.fecha
    JOIN dim_empresa de          ON de.id_empresa = p.id_empresa
    JOIN dim_cliente dc          ON dc.id_cliente = e.id_cliente
    JOIN dim_tipo_evento dt      ON dt.id_tipo_evento = e.id_tipo_evento
    JOIN dim_servicio ds         ON ds.id_servicio = i.id_servicio
    JOIN dim_estado_propuesta dp ON dp.estado = p.estado;

  GET DIAGNOSTICS n_items = ROW_COUNT;
  RAISE NOTICE 'DW cargado: % ítems en fact_ventas', n_items;
END $$;
