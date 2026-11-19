-- =====================================================================
-- Data warehouse · paso 5a: verificar los totales contra la base operativa
-- =====================================================================
-- Se corre conectado a eventos_dw, DESPUÉS de CALL cargar_dw();
-- Cada control calcula lo mismo de los dos lados: en la base operativa (esquema operativa)
-- y en el DW (fact_ventas y dimensiones). Si la carga no perdió ni duplicó nada, todas
-- las filas dicen ✅.

WITH controles (orden, control, operativa, dw) AS (
  VALUES
  (1, 'Ítems de propuestas (filas del hecho)',
      (SELECT COUNT(*) FROM operativa.propuesta_items)::numeric,
      (SELECT COUNT(*) FROM fact_ventas)::numeric),

  (2, 'Propuestas con al menos un ítem',
      (SELECT COUNT(DISTINCT id_propuesta) FROM operativa.propuesta_items)::numeric,
      (SELECT COUNT(DISTINCT id_propuesta) FROM fact_ventas)::numeric),

  (3, 'Propuestas aceptadas',
      (SELECT COUNT(*) FROM operativa.propuestas p WHERE p.estado = 'aceptada'
          AND EXISTS (SELECT 1 FROM operativa.propuesta_items i WHERE i.id_propuesta = p.id_propuesta))::numeric,
      (SELECT COUNT(DISTINCT id_propuesta) FROM fact_ventas WHERE es_aceptada = 1)::numeric),

  (4, 'Importe cotizado (cantidad × precio, todas)',
      (SELECT SUM(cantidad * precio_unitario) FROM operativa.propuesta_items),
      (SELECT SUM(importe) FROM fact_ventas)),

  (5, 'Total vendido (aceptadas, con descuento)',
      (SELECT SUM(GREATEST(sub - p.descuento, 0))
         FROM operativa.propuestas p
         JOIN (SELECT id_propuesta, SUM(cantidad * precio_unitario) AS sub
                 FROM operativa.propuesta_items GROUP BY id_propuesta) s USING (id_propuesta)
        WHERE p.estado = 'aceptada'),
      (SELECT ROUND(SUM(importe_neto), 2) FROM fact_ventas WHERE es_aceptada = 1)),

  (6, 'Unidades vendidas (aceptadas)',
      (SELECT SUM(i.cantidad) FROM operativa.propuesta_items i
         JOIN operativa.propuestas p USING (id_propuesta) WHERE p.estado = 'aceptada')::numeric,
      (SELECT SUM(cantidad) FROM fact_ventas WHERE es_aceptada = 1)::numeric),

  (7, 'Clientes (dimensión)',
      (SELECT COUNT(*) FROM operativa.clientes)::numeric,
      (SELECT COUNT(*) FROM dim_cliente)::numeric),

  (8, 'Servicios (dimensión)',
      (SELECT COUNT(*) FROM operativa.servicios)::numeric,
      (SELECT COUNT(*) FROM dim_servicio)::numeric)
)
SELECT control, operativa, dw,
       CASE WHEN operativa IS NOT DISTINCT FROM dw THEN '✅' ELSE '❌ no coincide' END AS resultado
  FROM controles
 ORDER BY orden;

-- Lo mismo, pero propuesta por propuesta: lista las que no coinciden (tiene que salir vacía).
SELECT p.id_propuesta, GREATEST(s.sub - p.descuento, 0) AS total_operativa,
       ROUND(f.neto, 2) AS total_dw
  FROM operativa.propuestas p
  JOIN (SELECT id_propuesta, SUM(cantidad * precio_unitario) AS sub
          FROM operativa.propuesta_items GROUP BY id_propuesta) s USING (id_propuesta)
  JOIN (SELECT id_propuesta, SUM(importe_neto) AS neto FROM fact_ventas GROUP BY id_propuesta) f USING (id_propuesta)
 WHERE GREATEST(s.sub - p.descuento, 0) <> ROUND(f.neto, 2);
