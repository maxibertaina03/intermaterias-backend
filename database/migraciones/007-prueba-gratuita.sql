-- Migración v6 → v7: prueba gratuita de 30 días con autoregistro.
-- - Una organizadora puede registrarse sola desde la web: se crea su empresa y su administrador.
-- - empresas.fecha_fin_prueba: hasta qué día dura la prueba. NULL = sin límite (empresas dadas de alta
--   por el super admin). Cuando vence, la empresa queda en solo lectura.
-- - empresas.cuit pasa a ser opcional: quien se registra a probar no tiene que cargarlo. Sigue siendo UNIQUE.
-- Se puede correr una sola vez sobre una base v6.

BEGIN;

ALTER TABLE empresas ADD COLUMN fecha_fin_prueba DATE;
ALTER TABLE empresas ALTER COLUMN cuit DROP NOT NULL;

COMMIT;
