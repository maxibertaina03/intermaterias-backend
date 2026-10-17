-- Migración v2 → v3: login con Clerk.
-- Para una base que ya tiene datos (por ejemplo Neon) y no se quiere recrear con schema.sql.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(64) UNIQUE;
ALTER TABLE usuarios DROP COLUMN IF EXISTS password_hash;
