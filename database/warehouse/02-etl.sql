-- =====================================================================
-- Data warehouse · 02: ETL (extraer de public.*, transformar, cargar en dw.*)
-- =====================================================================
-- Crea el procedimiento dw.cargar(). Se corre con:   CALL dw.cargar();
--
-- Cómo carga:
--   - Dimensiones: se ACTUALIZAN (upsert), así sus claves sustitutas no cambian entre corridas.
--       · empresa, cliente, tipo de evento, sede y proveedor: SCD tipo 1 (se pisa el valor).
--       · servicio: SCD tipo 2 (si cambia el precio de referencia, se guarda una versión nueva).
--   - Hechos: se vacían y se vuelven a calcular completos. Con el volumen de este sistema tarda
--     segundos, y así un evento que cambió de estado queda bien sin lógica incremental.
--   - Todo en una sola transacción: si algo falla no queda nada a medias, y el error queda
--     anotado en dw.etl_ejecuciones.
-- Requiere 01-esquema.sql.

-- Clave de dw.dim_tiempo para una fecha (0 = sin fecha)
CREATE OR REPLACE FUNCTION dw.sk_fecha(d DATE) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(to_char(d, 'YYYYMMDD')::int, 0) $$;

-- Temporada según el calendario escolar argentino (cuándo se organizan los eventos estudiantiles)
CREATE OR REPLACE FUNCTION dw.temporada(d DATE) RETURNS VARCHAR
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM d) IN (1, 2)  THEN 'Vacaciones de verano'
    WHEN EXTRACT(MONTH FROM d) IN (3, 4)  THEN 'Inicio de clases'
    WHEN EXTRACT(MONTH FROM d) IN (5, 6)  THEN 'Primer cuatrimestre'
    WHEN EXTRACT(MONTH FROM d) = 7        THEN 'Vacaciones de invierno'
    WHEN EXTRACT(MONTH FROM d) IN (8, 9)  THEN 'Segundo cuatrimestre'
    ELSE 'Fin de año'
  END $$;

CREATE OR REPLACE PROCEDURE dw.cargar()
LANGUAGE plpgsql AS $$
DECLARE
  v_id    INT;
  v_desde DATE;
  v_hasta DATE;
  v_filas JSONB := '{}'::jsonb;
  v_n     INT;
BEGIN
  INSERT INTO dw.etl_ejecuciones DEFAULT VALUES RETURNING id_ejecucion INTO v_id;

  BEGIN  -- bloque protegido: si falla, se deshace todo lo de adentro y se anota el error

    -- ── dim_tiempo: completa el calendario que haga falta ─────────────
    SELECT LEAST(DATE '2020-01-01', MIN(d)), GREATEST(DATE '2030-12-31', MAX(d))
      INTO v_desde, v_hasta
      FROM (SELECT fecha AS d FROM public.eventos
            UNION ALL SELECT fecha_creacion::date FROM public.eventos
            UNION ALL SELECT fecha_respuesta::date FROM public.invitados) x;
    INSERT INTO dw.dim_tiempo (sk_tiempo, fecha, nombre_mes, nombre_dia, temporada)
      VALUES (0, NULL, 'Sin fecha', 'Sin fecha', 'Sin fecha')
      ON CONFLICT (sk_tiempo) DO NOTHING;
    INSERT INTO dw.dim_tiempo
    SELECT dw.sk_fecha(d), d,
           EXTRACT(YEAR FROM d), CASE WHEN EXTRACT(MONTH FROM d) <= 6 THEN 1 ELSE 2 END,
           EXTRACT(QUARTER FROM d), EXTRACT(MONTH FROM d),
           (ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                  'Septiembre','Octubre','Noviembre','Diciembre'])[EXTRACT(MONTH FROM d)::int],
           to_char(d, 'YYYY-MM'), EXTRACT(WEEK FROM d), EXTRACT(DAY FROM d), EXTRACT(ISODOW FROM d),
           (ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'])[EXTRACT(ISODOW FROM d)::int],
           EXTRACT(ISODOW FROM d) >= 6, dw.temporada(d)
      FROM generate_series(v_desde, v_hasta, INTERVAL '1 day') AS g(t), LATERAL (SELECT t::date AS d) x
    ON CONFLICT (sk_tiempo) DO NOTHING;

    -- ── dim_empresa (SCD 1) ──────────────────────────────────────────
    INSERT INTO dw.dim_empresa (id_empresa, nombre, tipo_cuenta, activa, fecha_alta)
    SELECT id_empresa, nombre,
           CASE WHEN fecha_fin_prueba IS NULL THEN 'Sin límite' ELSE 'Prueba gratuita' END,
           COALESCE(activo, TRUE), fecha_creacion::date
      FROM public.empresas
    ON CONFLICT (id_empresa) DO UPDATE
       SET nombre = EXCLUDED.nombre, tipo_cuenta = EXCLUDED.tipo_cuenta,
           activa = EXCLUDED.activa, fecha_alta = EXCLUDED.fecha_alta;

    -- ── dim_cliente (SCD 1) ──────────────────────────────────────────
    INSERT INTO dw.dim_cliente (sk_cliente, nombre, tipo, institucion, activo)
      VALUES (0, 'Sin dato', 'Sin dato', 'Sin dato', TRUE) ON CONFLICT (sk_cliente) DO NOTHING;
    INSERT INTO dw.dim_cliente (id_cliente, id_empresa, nombre, tipo, institucion, activo)
    SELECT id_cliente, id_empresa, nombre,
           CASE tipo WHEN 'centro_estudiantes' THEN 'Centro de estudiantes'
                     WHEN 'grupo_estudiantes'  THEN 'Grupo de estudiantes' ELSE 'Curso' END,
           COALESCE(NULLIF(TRIM(institucion), ''), 'Sin dato'), COALESCE(activo, TRUE)
      FROM public.clientes
    ON CONFLICT (id_cliente) DO UPDATE
       SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo,
           institucion = EXCLUDED.institucion, activo = EXCLUDED.activo;

    -- ── dim_tipo_evento y dim_sede (SCD 1) ───────────────────────────
    INSERT INTO dw.dim_tipo_evento (sk_tipo_evento, nombre) VALUES (0, 'Sin dato')
      ON CONFLICT (sk_tipo_evento) DO NOTHING;
    INSERT INTO dw.dim_tipo_evento (id_tipo_evento, id_empresa, nombre)
    SELECT id_tipo_evento, id_empresa, nombre FROM public.tipos_evento
    ON CONFLICT (id_tipo_evento) DO UPDATE SET nombre = EXCLUDED.nombre;

    INSERT INTO dw.dim_sede (sk_sede, nombre, rango_capacidad) VALUES (0, 'Sin sede', 'Sin dato')
      ON CONFLICT (sk_sede) DO NOTHING;
    INSERT INTO dw.dim_sede (id_sede, id_empresa, nombre, capacidad, rango_capacidad)
    SELECT id_sede, id_empresa, nombre, capacidad,
           CASE WHEN capacidad IS NULL THEN 'Sin dato' WHEN capacidad <= 150 THEN 'Hasta 150'
                WHEN capacidad <= 300 THEN '151 a 300' ELSE 'Más de 300' END
      FROM public.sedes
    ON CONFLICT (id_sede) DO UPDATE
       SET nombre = EXCLUDED.nombre, capacidad = EXCLUDED.capacidad, rango_capacidad = EXCLUDED.rango_capacidad;

    -- ── dim_proveedor (SCD 1) + miembros especiales ──────────────────
    INSERT INTO dw.dim_proveedor (sk_proveedor, nombre, activo) VALUES
      (0, 'Sin asignar', TRUE), (-1, 'Equipo propio', TRUE)
      ON CONFLICT (sk_proveedor) DO NOTHING;
    INSERT INTO dw.dim_proveedor (id_proveedor, id_empresa, nombre, activo)
    SELECT id_proveedor, id_empresa, nombre, COALESCE(activo, TRUE) FROM public.proveedores
    ON CONFLICT (id_proveedor) DO UPDATE SET nombre = EXCLUDED.nombre, activo = EXCLUDED.activo;

    -- ── dim_servicio (SCD 2 sobre el precio de referencia) ───────────
    -- El nombre es tipo 1: se corrige en todas las versiones.
    UPDATE dw.dim_servicio d SET nombre = s.nombre
      FROM public.servicios s WHERE d.id_servicio = s.id_servicio AND d.nombre <> s.nombre;
    -- Si la versión actual se abrió hoy mismo, se corrige ahí (no se abre otra el mismo día)
    UPDATE dw.dim_servicio d SET precio_referencia = s.precio_referencia
      FROM public.servicios s
     WHERE d.id_servicio = s.id_servicio AND d.es_actual AND d.vigente_desde = CURRENT_DATE
       AND d.precio_referencia IS DISTINCT FROM s.precio_referencia;
    -- Cambió el precio: se cierra la versión vigente…
    UPDATE dw.dim_servicio d SET vigente_hasta = CURRENT_DATE - 1, es_actual = FALSE
      FROM public.servicios s
     WHERE d.id_servicio = s.id_servicio AND d.es_actual
       AND d.precio_referencia IS DISTINCT FROM s.precio_referencia;
    -- …y se abre una nueva (la primera versión de un servicio vale "desde siempre")
    INSERT INTO dw.dim_servicio (id_servicio, id_empresa, nombre, precio_referencia, vigente_desde)
    SELECT s.id_servicio, s.id_empresa, s.nombre, s.precio_referencia,
           CASE WHEN EXISTS (SELECT 1 FROM dw.dim_servicio x WHERE x.id_servicio = s.id_servicio)
                THEN CURRENT_DATE ELSE DATE '1900-01-01' END
      FROM public.servicios s
     WHERE NOT EXISTS (SELECT 1 FROM dw.dim_servicio x WHERE x.id_servicio = s.id_servicio AND x.es_actual);

    -- ── Hechos: se recalculan completos ──────────────────────────────
    TRUNCATE dw.fact_eventos, dw.fact_propuestas, dw.fact_servicios_cotizados, dw.fact_invitados;

    -- Totales de cada propuesta (se usan en varios hechos)
    DROP TABLE IF EXISTS tmp_totales;
    CREATE TEMP TABLE tmp_totales ON COMMIT DROP AS
    SELECT p.id_propuesta, p.id_evento, p.estado,
           COUNT(i.id_item)::int AS items,
           COALESCE(SUM(i.cantidad * i.precio_unitario), 0) AS subtotal,
           p.descuento,
           GREATEST(COALESCE(SUM(i.cantidad * i.precio_unitario), 0) - p.descuento, 0) AS total
      FROM public.propuestas p LEFT JOIN public.propuesta_items i ON i.id_propuesta = p.id_propuesta
     GROUP BY p.id_propuesta;

    INSERT INTO dw.fact_eventos
    SELECT e.id_evento,
           dw.sk_fecha(e.fecha), dw.sk_fecha(e.fecha_creacion::date),
           de.sk_empresa, COALESCE(dc.sk_cliente, 0), COALESCE(dt.sk_tipo_evento, 0), COALESCE(ds.sk_sede, 0),
           es.sk_estado,
           e.cantidad_estimada,
           e.fecha - e.fecha_creacion::date,
           ROUND(100.0 * e.cantidad_estimada / NULLIF(ds.capacidad, 0), 1),
           COALESCE((SELECT t.total FROM tmp_totales t WHERE t.id_evento = e.id_evento AND t.estado = 'aceptada'), 0),
           (SELECT COUNT(*) FROM public.cambios_evento c WHERE c.id_evento = e.id_evento),
           (SELECT COUNT(*) FROM public.tareas t WHERE t.id_evento = e.id_evento),
           (SELECT COUNT(*) FROM public.tareas t WHERE t.id_evento = e.id_evento AND t.estado = 'hecha'),
           (SELECT COUNT(*) FROM public.tareas t WHERE t.id_evento = e.id_evento AND t.estado <> 'hecha'
               AND t.fecha_prevista < CURRENT_DATE),
           (SELECT COUNT(*) FROM public.invitados iv JOIN public.invitaciones ic USING (id_invitacion)
             WHERE ic.id_evento = e.id_evento AND iv.asiste),
           (e.estado = 'cancelado')::int, (e.estado = 'realizado')::int
      FROM public.eventos e
      JOIN dw.dim_empresa de ON de.id_empresa = e.id_empresa
      JOIN dw.dim_estado_evento es ON es.estado = e.estado
      LEFT JOIN dw.dim_cliente dc ON dc.id_cliente = e.id_cliente
      LEFT JOIN dw.dim_tipo_evento dt ON dt.id_tipo_evento = e.id_tipo_evento
      LEFT JOIN dw.dim_sede ds ON ds.id_sede = e.id_sede;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_filas := v_filas || jsonb_build_object('fact_eventos', v_n);

    INSERT INTO dw.fact_propuestas
    SELECT p.id_propuesta, p.id_evento,
           dw.sk_fecha(p.fecha_presentacion::date), dw.sk_fecha(p.fecha_respuesta::date),
           de.sk_empresa, COALESCE(dc.sk_cliente, 0), COALESCE(dt.sk_tipo_evento, 0),
           p.estado, NULLIF(TRIM(p.motivo_rechazo), ''),
           t.items, t.subtotal, t.descuento, t.total,
           ROUND(t.total / NULLIF(e.cantidad_estimada, 0), 2),
           p.fecha_respuesta::date - p.fecha_presentacion::date,
           (p.estado = 'aceptada')::int, (p.estado = 'rechazada')::int
      FROM public.propuestas p
      JOIN tmp_totales t ON t.id_propuesta = p.id_propuesta
      JOIN public.eventos e ON e.id_evento = p.id_evento
      JOIN dw.dim_empresa de ON de.id_empresa = p.id_empresa
      LEFT JOIN dw.dim_cliente dc ON dc.id_cliente = e.id_cliente
      LEFT JOIN dw.dim_tipo_evento dt ON dt.id_tipo_evento = e.id_tipo_evento;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_filas := v_filas || jsonb_build_object('fact_propuestas', v_n);

    INSERT INTO dw.fact_servicios_cotizados
    SELECT i.id_item, p.id_propuesta, dw.sk_fecha(e.fecha),
           de.sk_empresa, COALESCE(dc.sk_cliente, 0), COALESCE(dt.sk_tipo_evento, 0),
           COALESCE(sv.sk_servicio, sa.sk_servicio),
           CASE WHEN p.estado <> 'aceptada' OR es.id_evento_servicio IS NULL THEN 0
                WHEN es.es_propio THEN -1
                ELSE COALESCE(dp.sk_proveedor, 0) END,
           i.cantidad, i.precio_unitario, i.cantidad * i.precio_unitario,
           i.cantidad * COALESCE(sv.precio_referencia, sa.precio_referencia),
           (p.estado = 'aceptada')::int
      FROM public.propuesta_items i
      JOIN public.propuestas p ON p.id_propuesta = i.id_propuesta
      JOIN public.eventos e ON e.id_evento = p.id_evento
      JOIN dw.dim_empresa de ON de.id_empresa = p.id_empresa
      LEFT JOIN dw.dim_cliente dc ON dc.id_cliente = e.id_cliente
      LEFT JOIN dw.dim_tipo_evento dt ON dt.id_tipo_evento = e.id_tipo_evento
      -- versión del servicio vigente cuando se presentó la propuesta (o la actual, de respaldo)
      LEFT JOIN dw.dim_servicio sv ON sv.id_servicio = i.id_servicio
            AND COALESCE(p.fecha_presentacion, e.fecha_creacion)::date BETWEEN sv.vigente_desde AND sv.vigente_hasta
      JOIN dw.dim_servicio sa ON sa.id_servicio = i.id_servicio AND sa.es_actual
      -- quién resolvió ese servicio en el evento
      LEFT JOIN LATERAL (SELECT x.* FROM public.evento_servicios x
                          WHERE x.id_evento = e.id_evento AND x.id_servicio = i.id_servicio
                          ORDER BY x.id_evento_servicio LIMIT 1) es ON TRUE
      LEFT JOIN dw.dim_proveedor dp ON dp.id_proveedor = es.id_proveedor;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_filas := v_filas || jsonb_build_object('fact_servicios_cotizados', v_n);

    INSERT INTO dw.fact_invitados
    SELECT iv.id_invitado, e.id_evento,
           dw.sk_fecha(iv.fecha_respuesta::date), dw.sk_fecha(e.fecha),
           de.sk_empresa, COALESCE(dc.sk_cliente, 0), COALESCE(dt.sk_tipo_evento, 0),
           CASE WHEN NOT iv.asiste THEN 'no asiste' ELSE COALESCE(iv.medio_pago, 'sin dato') END,
           iv.asiste::int, (iv.asiste AND iv.pago_verificado)::int,
           CASE WHEN iv.asiste THEN ic.precio_por_invitado ELSE 0 END,
           CASE WHEN iv.asiste AND iv.pago_verificado THEN ic.precio_por_invitado ELSE 0 END,
           e.fecha - iv.fecha_respuesta::date
      FROM public.invitados iv
      JOIN public.invitaciones ic ON ic.id_invitacion = iv.id_invitacion
      JOIN public.eventos e ON e.id_evento = ic.id_evento
      JOIN dw.dim_empresa de ON de.id_empresa = ic.id_empresa
      LEFT JOIN dw.dim_cliente dc ON dc.id_cliente = e.id_cliente
      LEFT JOIN dw.dim_tipo_evento dt ON dt.id_tipo_evento = e.id_tipo_evento;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_filas := v_filas || jsonb_build_object('fact_invitados', v_n);

    v_filas := v_filas || jsonb_build_object(
      'dim_empresa', (SELECT COUNT(*) FROM dw.dim_empresa),
      'dim_cliente', (SELECT COUNT(*) FROM dw.dim_cliente),
      'dim_servicio', (SELECT COUNT(*) FROM dw.dim_servicio),
      'dim_proveedor', (SELECT COUNT(*) FROM dw.dim_proveedor),
      'dim_tiempo', (SELECT COUNT(*) FROM dw.dim_tiempo));

  EXCEPTION WHEN OTHERS THEN
    UPDATE dw.etl_ejecuciones SET fin = clock_timestamp(), estado = 'error', error = SQLERRM
     WHERE id_ejecucion = v_id;
    RAISE WARNING 'ETL con error (ejecución %): %', v_id, SQLERRM;
    RETURN;
  END;

  UPDATE dw.etl_ejecuciones SET fin = clock_timestamp(), estado = 'ok', filas = v_filas
   WHERE id_ejecucion = v_id;
  RAISE NOTICE 'ETL ok (ejecución %): %', v_id, v_filas;
END $$;
