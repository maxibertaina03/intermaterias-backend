-- Migración v3 → v4: el login con Clerk es por usuario y contraseña, el email pasa a ser opcional.
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
