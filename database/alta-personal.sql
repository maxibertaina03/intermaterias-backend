-- Alta de una persona del personal para que pueda entrar con Clerk.
-- Se corre a mano en la base (Neon o la de Docker), con los datos reales.
-- ⚠️ No subir a GitHub emails reales: copiá este archivo, completalo y corrélo.
--
-- La primera vez que esa persona inicia sesión en Clerk con este email,
-- el sistema la vincula sola (guarda su clerk_user_id).

WITH nuevo AS (
  INSERT INTO usuarios (id_empresa, nombre, email)
  VALUES (1, 'Nombre Apellido', 'email@ejemplo.com')        -- empresa, nombre y email
  RETURNING id_usuario
)
INSERT INTO usuario_roles (id_usuario, rol)
SELECT id_usuario, rol FROM nuevo,
  unnest(ARRAY['atencion_cliente', 'responsable_propuesta',  -- roles que tiene
               'responsable_organizacion', 'integrante']) AS rol;
