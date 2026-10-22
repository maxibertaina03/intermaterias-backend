-- Migración v4 → v5: cada empresa con sus propios usuarios.
-- - Super admin: administra las empresas y no pertenece a ninguna (id_empresa NULL).
-- - Rol admin_empresa: da de alta a los usuarios de su empresa.
-- - usuarios.usuario: el nombre de usuario con el que entra (el mismo de Clerk).
-- Se puede correr una sola vez sobre una base v4 con datos.

BEGIN;

ALTER TABLE usuarios ALTER COLUMN id_empresa DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN es_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(64) UNIQUE;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_empresa_o_superadmin
    CHECK (es_superadmin OR id_empresa IS NOT NULL);

ALTER TABLE usuario_roles DROP CONSTRAINT usuario_roles_rol_check;
ALTER TABLE usuario_roles ADD CONSTRAINT usuario_roles_rol_check
    CHECK (rol IN ('admin_empresa', 'atencion_cliente', 'responsable_propuesta', 'responsable_organizacion', 'integrante'));

-- Usuarios de ejemplo: nombre de usuario para entrar y administradores de cada empresa
UPDATE usuarios SET usuario = 'sofia'     WHERE email = 'sofia@eventosdelcentro.com';
UPDATE usuarios SET usuario = 'mateo'     WHERE email = 'mateo@eventosdelcentro.com';
UPDATE usuarios SET usuario = 'valentina' WHERE email = 'valen@eventosdelcentro.com';
UPDATE usuarios SET usuario = 'joaquin'   WHERE email = 'joaquin@fiestasnorte.com';

INSERT INTO usuario_roles (id_usuario, rol)
SELECT id_usuario, 'admin_empresa' FROM usuarios WHERE usuario IN ('sofia', 'joaquin')
ON CONFLICT DO NOTHING;

INSERT INTO usuarios (id_empresa, nombre, usuario, es_superadmin)
VALUES (NULL, 'Administración del sistema', 'superadmin', TRUE);

COMMIT;
