-- =====================================================================
-- Data warehouse · 03: vistas de análisis (las preguntas de negocio, listas para usar)
-- =====================================================================
-- Cada vista responde una pregunta y ya trae los nombres (no las claves). Todas tienen la
-- empresa: para el análisis de UNA organizadora se filtra con WHERE empresa = '...'.
-- Requiere 01-esquema.sql y 02-etl.sql.

-- ¿Cuánto se vende por mes? (propuestas aceptadas, por fecha del evento)
CREATE OR REPLACE VIEW dw.v_ventas_mensuales AS
SELECT de.nombre AS empresa, t.anio, t.mes, t.anio_mes, t.nombre_mes,
       COUNT(*) FILTER (WHERE f.importe_aceptado > 0)                AS eventos_vendidos,
       SUM(f.importe_aceptado)                                        AS facturacion,
       ROUND(AVG(f.importe_aceptado) FILTER (WHERE f.importe_aceptado > 0), 2) AS ticket_promedio,
       SUM(f.cantidad_estimada) FILTER (WHERE f.importe_aceptado > 0) AS personas
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t   ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_empresa de ON de.sk_empresa = f.sk_empresa
 GROUP BY de.nombre, t.anio, t.mes, t.anio_mes, t.nombre_mes;

-- Embudo comercial: de cada 100 solicitudes, cuántas se presentan, se ganan y se pierden
CREATE OR REPLACE VIEW dw.v_embudo AS
SELECT de.nombre AS empresa, t.anio, te.nombre AS tipo_evento,
       COUNT(*)                                                         AS solicitudes,
       COUNT(*) FILTER (WHERE es.estado NOT IN ('recibida', 'falta_informacion')) AS con_propuesta,
       COUNT(*) FILTER (WHERE es.etapa = 'Ganado')                      AS ganados,
       COUNT(*) FILTER (WHERE es.etapa = 'Perdido')                     AS perdidos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE es.etapa = 'Ganado')
             / NULLIF(COUNT(*) FILTER (WHERE es.etapa <> 'En curso'), 0), 1) AS tasa_exito_pct
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t         ON t.sk_tiempo = f.sk_fecha_solicitud
  JOIN dw.dim_empresa de       ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_tipo_evento te   ON te.sk_tipo_evento = f.sk_tipo_evento
  JOIN dw.dim_estado_evento es ON es.sk_estado = f.sk_estado
 GROUP BY de.nombre, t.anio, te.nombre;

-- ¿Qué servicios se venden más y cuánto se cobra contra la lista de precios?
CREATE OR REPLACE VIEW dw.v_servicios AS
SELECT de.nombre AS empresa, t.anio, s.nombre AS servicio,
       COUNT(*) FILTER (WHERE f.es_vendido = 1)                 AS veces_vendido,
       COUNT(*)                                                 AS veces_cotizado,
       SUM(f.importe) FILTER (WHERE f.es_vendido = 1)           AS facturacion,
       ROUND(100.0 * (SUM(f.importe) - SUM(f.importe_lista)) / NULLIF(SUM(f.importe_lista), 0), 1)
                                                                AS diferencia_vs_lista_pct
  FROM dw.fact_servicios_cotizados f
  JOIN dw.dim_tiempo t   ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_empresa de ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_servicio s ON s.sk_servicio = f.sk_servicio
 GROUP BY de.nombre, t.anio, s.nombre;

-- ¿Con quién se resuelven los servicios vendidos? (proveedor, equipo propio o sin asignar)
CREATE OR REPLACE VIEW dw.v_proveedores AS
SELECT de.nombre AS empresa, p.nombre AS proveedor, s.nombre AS servicio,
       COUNT(*) AS servicios, SUM(f.importe) AS importe
  FROM dw.fact_servicios_cotizados f
  JOIN dw.dim_empresa de   ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_proveedor p  ON p.sk_proveedor = f.sk_proveedor
  JOIN dw.dim_servicio s   ON s.sk_servicio = f.sk_servicio
 WHERE f.es_vendido = 1
 GROUP BY de.nombre, p.nombre, s.nombre;

-- ¿Por qué se pierden las propuestas y cuánto tardan en responder?
CREATE OR REPLACE VIEW dw.v_propuestas AS
SELECT de.nombre AS empresa, t.anio, te.nombre AS tipo_evento, f.estado,
       COALESCE(f.motivo_rechazo, '—') AS motivo_rechazo,
       COUNT(*) AS propuestas, SUM(f.total) AS importe,
       ROUND(AVG(f.dias_hasta_respuesta), 1) AS dias_promedio_respuesta,
       ROUND(AVG(f.total_por_persona), 2) AS precio_promedio_por_persona
  FROM dw.fact_propuestas f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_presentacion
  JOIN dw.dim_empresa de     ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
 WHERE f.estado <> 'en_preparacion'
 GROUP BY de.nombre, t.anio, te.nombre, f.estado, COALESCE(f.motivo_rechazo, '—');

-- Invitados: asistencia, medio de pago y cobranza
CREATE OR REPLACE VIEW dw.v_invitados AS
SELECT de.nombre AS empresa, te.nombre AS tipo_evento, t.anio_mes AS mes_evento,
       COUNT(*) AS respuestas, SUM(f.asiste) AS asisten,
       ROUND(100.0 * SUM(f.asiste) / COUNT(*), 1) AS asistencia_pct,
       COUNT(*) FILTER (WHERE f.medio_pago = 'efectivo')      AS pagan_efectivo,
       COUNT(*) FILTER (WHERE f.medio_pago = 'transferencia') AS pagan_transferencia,
       SUM(f.importe) AS a_cobrar, SUM(f.importe_verificado) AS cobrado,
       ROUND(100.0 * SUM(f.importe_verificado) / NULLIF(SUM(f.importe), 0), 1) AS cobrado_pct
  FROM dw.fact_invitados f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_empresa de     ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
 GROUP BY de.nombre, te.nombre, t.anio_mes;

-- Temporadas: cuándo se concentran los eventos
CREATE OR REPLACE VIEW dw.v_temporadas AS
SELECT de.nombre AS empresa, t.temporada, te.nombre AS tipo_evento,
       COUNT(*) AS eventos, SUM(f.cantidad_estimada) AS personas,
       ROUND(AVG(f.dias_anticipacion)) AS dias_anticipacion_promedio
  FROM dw.fact_eventos f
  JOIN dw.dim_tiempo t       ON t.sk_tiempo = f.sk_fecha_evento
  JOIN dw.dim_empresa de     ON de.sk_empresa = f.sk_empresa
  JOIN dw.dim_tipo_evento te ON te.sk_tipo_evento = f.sk_tipo_evento
  JOIN dw.dim_estado_evento es ON es.sk_estado = f.sk_estado
 WHERE es.etapa = 'Ganado'
 GROUP BY de.nombre, t.temporada, te.nombre;
