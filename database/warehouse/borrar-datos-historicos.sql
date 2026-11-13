-- Saca la empresa "Eventos Históricos (demo)" y todos sus datos de las tablas del sistema.
-- Después: CALL dw.cargar(); para que el warehouse deje de mostrarlos.
BEGIN;
CREATE TEMP TABLE e ON COMMIT DROP AS SELECT id_empresa FROM empresas WHERE nombre = 'Eventos Históricos (demo)';
DELETE FROM invitados WHERE id_invitacion IN (SELECT id_invitacion FROM invitaciones WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM invitaciones WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM cambios_evento WHERE id_evento IN (SELECT id_evento FROM eventos WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM tareas WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM evento_servicios WHERE id_evento IN (SELECT id_evento FROM eventos WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM propuesta_items WHERE id_propuesta IN (SELECT id_propuesta FROM propuestas WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM propuestas WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM evento_cursos WHERE id_evento IN (SELECT id_evento FROM eventos WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM eventos WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM proveedor_servicios WHERE id_proveedor IN (SELECT id_proveedor FROM proveedores WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM proveedores WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM servicios WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM sedes WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM tipos_evento WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM contactos WHERE id_cliente IN (SELECT id_cliente FROM clientes WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM cursos WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM clientes WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM usuario_roles WHERE id_usuario IN (SELECT id_usuario FROM usuarios WHERE id_empresa IN (SELECT * FROM e));
DELETE FROM usuarios WHERE id_empresa IN (SELECT * FROM e);
DELETE FROM empresas WHERE id_empresa IN (SELECT * FROM e);
COMMIT;
