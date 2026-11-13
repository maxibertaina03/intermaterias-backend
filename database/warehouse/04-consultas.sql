-- =====================================================================
-- Data warehouse · 04: consultas OLAP de ejemplo
-- =====================================================================
-- Muestran las operaciones típicas sobre el cubo (roll-up, drill-down, slice, dice, pivot)
-- y funciones de ventana. Se corren de a una en psql:
--   docker compose exec postgres psql -U <usuario> <base> -f /ruta/04-consultas.sql
-- Para una sola organizadora, agregá: AND de.nombre = 'Eventos Históricos (demo)'

-- 1. ROLL-UP: facturación por año → trimestre → mes, con subtotales y total general.
--    Las filas con NULL son los subtotales (GROUPING() dice cuál es cuál).
SELECT CASE WHEN GROUPING(t.anio) = 1 THEN 'TOTAL' ELSE t.anio::text END       AS anio,
       CASE WHEN GROUPING(t.trimestre) = 1 AND GROUPING(t.anio) = 0 THEN 'Total del año'
            ELSE 'T' || t.trimestre END                                         AS trimestre,
       CASE WHEN GROUPING(t.nombre_mes) = 1 AND GROUPING(t.trimestre) = 0 THEN 'Total trimestre'
            ELSE t.nombre_mes END                                               AS mes,
       COUNT(*) FILTER (WHERE f.importe_aceptado > 0)                           AS eventos,
       SUM(f.importe_aceptado)                                                  AS facturacion
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_fecha_evento
 WHERE f.importe_aceptado > 0
 GROUP BY ROLLUP (t.anio, t.trimestre, (t.mes, t.nombre_mes))
 ORDER BY t.anio NULLS LAST, t.trimestre NULLS LAST, t.mes NULLS LAST;

-- 2. CUBE: facturación cruzando tipo de evento × temporada, con todos los subtotales
--    (por tipo, por temporada, y el total).
SELECT COALESCE(te.nombre, '· Todos los tipos')   AS tipo_evento,
       COALESCE(t.temporada, '· Todo el año')     AS temporada,
       COUNT(*)                                   AS eventos,
       SUM(f.importe_aceptado)                    AS facturacion
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
 WHERE f.importe_aceptado > 0
 GROUP BY CUBE (te.nombre, t.temporada)
 ORDER BY te.nombre NULLS LAST, t.temporada NULLS LAST;

-- 3. DRILL-DOWN: de "Fiesta de egresados" en 2025 a cada cliente (bajar un nivel de detalle).
SELECT c.institucion, c.nombre AS cliente, COUNT(*) AS eventos,
       SUM(f.cantidad_estimada) AS personas, SUM(f.importe_aceptado) AS facturacion
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
  JOIN dw.dim_cliente c      ON c.sk_cliente = f.sk_cliente
 WHERE te.nombre = 'Fiesta de egresados' AND t.anio = 2025 AND f.importe_aceptado > 0
 GROUP BY c.institucion, c.nombre
 ORDER BY facturacion DESC;

-- 4. SLICE y DICE: cortar el cubo. Slice = fijar una dimensión (año 2025);
--    dice = quedarse con un sub-cubo (fin de año, salones grandes, propuestas aceptadas).
SELECT s.nombre AS sede, s.rango_capacidad, te.nombre AS tipo_evento,
       COUNT(*) AS eventos, ROUND(AVG(f.ocupacion_sede_pct), 1) AS ocupacion_promedio_pct
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_sede s         ON s.sk_sede = f.sk_sede
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
 WHERE t.anio = 2025                                   -- slice
   AND t.temporada = 'Fin de año'                      -- dice
   AND s.rango_capacidad IN ('151 a 300', 'Más de 300')
   AND f.importe_aceptado > 0
 GROUP BY s.nombre, s.rango_capacidad, te.nombre
 ORDER BY eventos DESC;

-- 5. PIVOT: eventos realizados por mes (filas) y año (columnas).
SELECT t.mes, t.nombre_mes,
       COUNT(*) FILTER (WHERE t.anio = 2024) AS "2024",
       COUNT(*) FILTER (WHERE t.anio = 2025) AS "2025",
       COUNT(*) FILTER (WHERE t.anio = 2026) AS "2026"
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t ON t.sk_tiempo = f.sk_fecha_evento
 WHERE f.importe_aceptado > 0
 GROUP BY t.mes, t.nombre_mes
 ORDER BY t.mes;

-- 6. Crecimiento mes a mes (función de ventana LAG) y acumulado del año (SUM OVER).
SELECT anio_mes, facturacion,
       LAG(facturacion) OVER (ORDER BY anio_mes) AS mes_anterior,
       ROUND(100.0 * (facturacion - LAG(facturacion) OVER (ORDER BY anio_mes))
             / NULLIF(LAG(facturacion) OVER (ORDER BY anio_mes), 0), 1) AS variacion_pct,
       SUM(facturacion) OVER (PARTITION BY anio ORDER BY anio_mes) AS acumulado_del_anio
  FROM (SELECT anio, anio_mes, SUM(facturacion) AS facturacion
          FROM dw.v_ventas_mensuales GROUP BY anio, anio_mes) m
 ORDER BY anio_mes;

-- 7. Ranking: los 3 servicios que más facturan en cada año (RANK con PARTITION BY).
SELECT anio, servicio, facturacion, puesto
  FROM (SELECT anio, servicio, SUM(facturacion) AS facturacion,
               RANK() OVER (PARTITION BY anio ORDER BY SUM(facturacion) DESC) AS puesto
          FROM dw.v_servicios GROUP BY anio, servicio) r
 WHERE puesto <= 3
 ORDER BY anio, puesto;

-- 8. Clientes que más compran: participación de cada uno en el total (análisis de Pareto).
SELECT cliente, facturacion,
       ROUND(100.0 * facturacion / SUM(facturacion) OVER (), 1) AS participacion_pct,
       ROUND(100.0 * SUM(facturacion) OVER (ORDER BY facturacion DESC)
             / SUM(facturacion) OVER (), 1)                    AS acumulado_pct
  FROM (SELECT c.nombre AS cliente, SUM(f.importe_aceptado) AS facturacion
          FROM dw.fact_eventos f JOIN dw.dim_cliente c ON c.sk_cliente = f.sk_cliente
         WHERE f.importe_aceptado > 0 GROUP BY c.nombre) x
 ORDER BY facturacion DESC;

-- 9. Precios en el tiempo (SCD tipo 2): cada versión del precio de lista de un servicio
--    y lo que realmente se cobró mientras estuvo vigente.
SELECT s.nombre AS servicio, s.vigente_desde, NULLIF(s.vigente_hasta, DATE '9999-12-31') AS vigente_hasta,
       s.precio_referencia, ROUND(AVG(f.precio_unitario), 2) AS precio_cobrado_promedio,
       COUNT(f.id_item) AS veces_cotizado
  FROM dw.dim_servicio s
  LEFT JOIN dw.fact_servicios_cotizados f ON f.sk_servicio = s.sk_servicio
 GROUP BY s.sk_servicio
 ORDER BY s.nombre, s.vigente_desde;

-- 10. Embudo y motivos de pérdida.
SELECT COALESCE(tipo_evento, 'TOTAL') AS tipo_evento, SUM(solicitudes) AS solicitudes, SUM(ganados) AS ganados,
       SUM(perdidos) AS perdidos,
       ROUND(100.0 * SUM(ganados) / NULLIF(SUM(ganados) + SUM(perdidos), 0), 1) AS tasa_exito_pct
  FROM dw.v_embudo GROUP BY ROLLUP (tipo_evento) ORDER BY tipo_evento NULLS LAST;

SELECT motivo_rechazo, SUM(propuestas) AS propuestas, SUM(importe) AS importe_perdido
  FROM dw.v_propuestas WHERE estado = 'rechazada'
 GROUP BY motivo_rechazo ORDER BY propuestas DESC;

-- 11. Invitados: asistencia y cobranza por tipo de evento.
SELECT tipo_evento, SUM(respuestas) AS respuestas,
       ROUND(100.0 * SUM(asisten) / SUM(respuestas), 1) AS asistencia_pct,
       ROUND(100.0 * SUM(pagan_transferencia) / NULLIF(SUM(asisten), 0), 1) AS transferencia_pct,
       SUM(a_cobrar) AS a_cobrar, SUM(cobrado) AS cobrado
  FROM dw.v_invitados GROUP BY tipo_evento ORDER BY respuestas DESC;
