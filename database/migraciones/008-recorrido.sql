-- Migración v7 → v8: recorrido guiado para usuarios nuevos.
-- - usuarios.recorrido_visto: ya vio (o salteó) el recorrido de bienvenida. No se le vuelve a abrir solo.
-- - usuarios.primeros_pasos_cerrado: cerró la tarjeta "Primeros pasos" de Pendientes.
-- Los usuarios que ya existen conocen el sistema: se marcan con el recorrido visto y la lista cerrada.
-- Se puede correr una sola vez sobre una base v7.

BEGIN;

ALTER TABLE usuarios ADD COLUMN recorrido_visto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN primeros_pasos_cerrado BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET recorrido_visto = TRUE, primeros_pasos_cerrado = TRUE;

COMMIT;
