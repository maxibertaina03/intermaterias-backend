-- Saca los datos de prueba de "Eventos del Centro" (los de datos-de-prueba.sql): los clientes que
-- agregó, todo lo que cuelga de sus eventos, y el salón, el servicio y los proveedores que sumó.
-- Se corre en la base operativa (eventos). Después, en eventos_dw: CALL cargar_dw();
BEGIN;
CREATE TEMP TABLE c ON COMMIT DROP AS
SELECT cl.id_cliente FROM clientes cl JOIN empresas e USING (id_empresa)
 WHERE e.nombre = 'Eventos del Centro'
   AND cl.institucion IN ('Colegio Taborin', 'Instituto Leibnitz', 'Escuela Normal Alberdi', 'Colegio Santo Tomás',
                          'IPEM 270', 'Colegio Alemán', 'Instituto Domingo Zípoli', 'ENET 1', 'Colegio del Carmen',
                          'Instituto Jesús María', 'Colegio Garbino', 'Colegio La Salle', 'Instituto Cervantes',
                          'Colegio Mark Twain', 'IPET 66', 'Colegio Dante Alighieri');
CREATE TEMP TABLE ev ON COMMIT DROP AS SELECT id_evento FROM eventos WHERE id_cliente IN (SELECT * FROM c);
DELETE FROM invitados WHERE id_invitacion IN (SELECT id_invitacion FROM invitaciones WHERE id_evento IN (SELECT * FROM ev));
DELETE FROM invitaciones WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM cambios_evento WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM tareas WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM evento_servicios WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM propuesta_items WHERE id_propuesta IN (SELECT id_propuesta FROM propuestas WHERE id_evento IN (SELECT * FROM ev));
DELETE FROM propuestas WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM evento_cursos WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM eventos WHERE id_evento IN (SELECT * FROM ev);
DELETE FROM contactos WHERE id_cliente IN (SELECT * FROM c);
DELETE FROM clientes WHERE id_cliente IN (SELECT * FROM c);
DELETE FROM proveedor_servicios WHERE id_proveedor IN (
  SELECT id_proveedor FROM proveedores p JOIN empresas e USING (id_empresa)
   WHERE e.nombre = 'Eventos del Centro'
     AND p.nombre IN ('Delicias del Centro', 'Sonido Total', 'Deco Studio', 'Barra Móvil Córdoba'));
DELETE FROM proveedores p USING empresas e WHERE e.id_empresa = p.id_empresa AND e.nombre = 'Eventos del Centro'
   AND p.nombre IN ('Delicias del Centro', 'Sonido Total', 'Deco Studio', 'Barra Móvil Córdoba');
DELETE FROM servicios s USING empresas e WHERE e.id_empresa = s.id_empresa AND e.nombre = 'Eventos del Centro'
   AND s.nombre = 'Barra sin alcohol';
DELETE FROM sedes s USING empresas e WHERE e.id_empresa = s.id_empresa AND e.nombre = 'Eventos del Centro'
   AND s.nombre = 'Quinta La Arboleda';
COMMIT;
