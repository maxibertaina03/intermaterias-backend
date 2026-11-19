-- =====================================================================
-- Data warehouse · paso 0: crear la base del DW
-- =====================================================================
-- Se corre conectado a la base operativa (eventos), UNA sola vez.
-- Resultado: dos bases en el mismo servidor de PostgreSQL:
--   eventos     → la operativa (la usa el sistema)
--   eventos_dw  → el data warehouse (solo para análisis)

CREATE DATABASE eventos_dw;
