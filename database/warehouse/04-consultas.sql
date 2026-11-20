-- =====================================================================
-- Data warehouse · paso 5b: las preguntas de negocio
-- =====================================================================
-- Se corre conectado a eventos_dw. Cada pregunta del paso 1 queda guardada como una VISTA con
-- su nombre (pregunta_1_…, pregunta_2_…): en pgAdmin aparecen en Schemas → public → Views y con
-- "View/Edit Data" se ve la respuesta. Al final de cada una se muestra el resultado.
-- Las vistas leen fact_ventas en el momento: después de CALL cargar_dw(); ya dan los datos nuevos.

-- PREGUNTA 1. ¿Cuánto se vende por mes y por tipo de evento?
--   Ventas = propuestas aceptadas, con el descuento ya aplicado, por mes del evento.
--   ROLLUP agrega el subtotal de cada mes y el total general; GROUPING(col) vale 1 en las
--   filas de subtotal de esa columna y sirve para ponerles nombre.
CREATE OR REPLACE VIEW pregunta_1_ventas_por_mes AS
SELECT COALESCE(t.anio_mes, 'TOTAL')    AS mes,
       CASE WHEN GROUPING(t.anio_mes) = 1 THEN '· Total general'
            WHEN GROUPING(te.nombre) = 1  THEN '· Total del mes'
            ELSE te.nombre END           AS tipo_evento,
       COUNT(DISTINCT f.id_propuesta)    AS eventos_vendidos,
       ROUND(SUM(f.importe_neto), 2)     AS ventas
  FROM fact_ventas f
  JOIN dim_tiempo t       ON t.sk_tiempo = f.sk_tiempo
  JOIN dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
 WHERE f.es_aceptada = 1
 GROUP BY ROLLUP (t.anio_mes, te.nombre)
 ORDER BY t.anio_mes NULLS LAST, te.nombre NULLS LAST;

SELECT * FROM pregunta_1_ventas_por_mes;

-- PREGUNTA 2. ¿Qué porcentaje de las propuestas se acepta, según el tipo de evento?
--   Se cuentan solo las que ya tienen resultado (ganadas o perdidas), por año del evento.
CREATE OR REPLACE VIEW pregunta_2_aceptacion AS
SELECT t.anio,
       te.nombre                                                        AS tipo_evento,
       COUNT(DISTINCT f.id_propuesta)                                   AS propuestas_con_resultado,
       COUNT(DISTINCT f.id_propuesta) FILTER (WHERE ep.resultado = 'Ganada') AS aceptadas,
       ROUND(100.0 * COUNT(DISTINCT f.id_propuesta) FILTER (WHERE ep.resultado = 'Ganada')
             / COUNT(DISTINCT f.id_propuesta), 1)                       AS aceptacion_pct
  FROM fact_ventas f
  JOIN dim_tiempo t            ON t.sk_tiempo = f.sk_tiempo
  JOIN dim_tipo_evento te      ON te.sk_tipo_evento = f.sk_tipo_evento
  JOIN dim_estado_propuesta ep ON ep.sk_estado = f.sk_estado
 WHERE ep.resultado IN ('Ganada', 'Perdida')
 GROUP BY t.anio, te.nombre
 ORDER BY t.anio, aceptacion_pct DESC;

SELECT * FROM pregunta_2_aceptacion;

-- PREGUNTA 3. ¿Por qué se pierden las propuestas y cuánta plata representa cada motivo?
--   SUM(…) OVER () es el total de todas las filas: sirve para sacar el porcentaje.
CREATE OR REPLACE VIEW pregunta_3_motivos_de_perdida AS
SELECT COALESCE(f.motivo_rechazo, 'Venció sin respuesta')  AS motivo,
       COUNT(DISTINCT f.id_propuesta)                      AS propuestas,
       ROUND(SUM(f.importe_neto), 2)                       AS importe_perdido,
       ROUND(100.0 * COUNT(DISTINCT f.id_propuesta)
             / SUM(COUNT(DISTINCT f.id_propuesta)) OVER (), 1) AS porcentaje
  FROM fact_ventas f
  JOIN dim_estado_propuesta ep ON ep.sk_estado = f.sk_estado
 WHERE ep.resultado = 'Perdida'
 GROUP BY 1
 ORDER BY propuestas DESC;

SELECT * FROM pregunta_3_motivos_de_perdida;

-- PREGUNTA 4. ¿Qué servicios se venden más, cada año? (ranking por importe vendido)
--   RANK() OVER (PARTITION BY anio …) numera los servicios de mayor a menor dentro de cada año.
CREATE OR REPLACE VIEW pregunta_4_servicios_mas_vendidos AS
SELECT anio, puesto, servicio, veces_vendido, unidades, ventas
  FROM (SELECT t.anio, s.nombre AS servicio,
               COUNT(*)                       AS veces_vendido,
               SUM(f.cantidad)                AS unidades,
               ROUND(SUM(f.importe_neto), 2)  AS ventas,
               RANK() OVER (PARTITION BY t.anio ORDER BY SUM(f.importe_neto) DESC) AS puesto
          FROM fact_ventas f
          JOIN dim_tiempo t   ON t.sk_tiempo = f.sk_tiempo
          JOIN dim_servicio s ON s.sk_servicio = f.sk_servicio
         WHERE f.es_aceptada = 1
         GROUP BY t.anio, s.nombre) r
 ORDER BY anio, puesto;

SELECT * FROM pregunta_4_servicios_mas_vendidos;
