-- =====================================================================
-- Data warehouse · paso 3: tablas de dimensiones y de hechos
-- =====================================================================
-- Se corre conectado a la base eventos_dw. Se puede repetir: borra y crea todo de nuevo.
--
-- Proceso de negocio: LA VENTA DE EVENTOS (las propuestas que la organizadora le presenta
-- al centro de estudiantes, con los servicios cotizados).
-- Grano: una fila por cada SERVICIO COTIZADO en una propuesta (tabla propuesta_items).
--
--                         dim_tiempo
--                              │
--     dim_cliente ──┐          │          ┌── dim_servicio
--                   ├──── fact_ventas ────┤
--  dim_tipo_evento ─┘          │          └── dim_estado_propuesta
--                              │
--                         dim_empresa

-- ─────────────────────────────────────────────────────────────────────
-- Conexión con la base operativa
-- ─────────────────────────────────────────────────────────────────────
-- PostgreSQL no deja consultar otra base directamente. Con postgres_fdw las tablas de la base
-- operativa aparecen acá como tablas "foráneas" (esquema operativa) y se pueden usar en un
-- INSERT … SELECT. No se copian: cada consulta las lee en el momento desde eventos.
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
DROP SERVER IF EXISTS base_operativa CASCADE;
CREATE SERVER base_operativa FOREIGN DATA WRAPPER postgres_fdw OPTIONS (dbname 'eventos');
CREATE USER MAPPING FOR CURRENT_USER SERVER base_operativa;   -- se conecta con el mismo usuario
DROP SCHEMA IF EXISTS operativa CASCADE;
CREATE SCHEMA operativa;
IMPORT FOREIGN SCHEMA public
  LIMIT TO (empresas, clientes, tipos_evento, servicios, eventos, propuestas, propuesta_items)
  FROM SERVER base_operativa INTO operativa;

-- ─────────────────────────────────────────────────────────────────────
-- Dimensiones (desde dónde se miran las ventas)
-- ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS fact_ventas, dim_tiempo, dim_empresa, dim_cliente, dim_tipo_evento,
                     dim_servicio, dim_estado_propuesta CASCADE;

-- Cuándo: la fecha del evento. sk_tiempo = AAAAMMDD (20261113).
CREATE TABLE dim_tiempo (
    sk_tiempo   INT PRIMARY KEY,
    fecha       DATE NOT NULL UNIQUE,
    anio        SMALLINT NOT NULL,
    trimestre   SMALLINT NOT NULL,
    mes         SMALLINT NOT NULL,
    nombre_mes  VARCHAR(12) NOT NULL,
    anio_mes    CHAR(7) NOT NULL,       -- '2026-11': para agrupar y ordenar por mes
    nombre_dia  VARCHAR(10) NOT NULL,
    temporada   VARCHAR(30) NOT NULL    -- calendario escolar: 'Inicio de clases', 'Fin de año'…
);

-- Quién vende: la organizadora (el sistema es multiempresa)
CREATE TABLE dim_empresa (
    sk_empresa  SERIAL PRIMARY KEY,
    id_empresa  INT NOT NULL UNIQUE,    -- clave en la base operativa
    nombre      VARCHAR(150) NOT NULL
);

-- A quién: el centro de estudiantes
CREATE TABLE dim_cliente (
    sk_cliente  SERIAL PRIMARY KEY,
    id_cliente  INT NOT NULL UNIQUE,
    nombre      VARCHAR(150) NOT NULL,
    tipo        VARCHAR(30) NOT NULL,   -- Centro de estudiantes | Grupo de estudiantes | Curso
    institucion VARCHAR(150) NOT NULL
);

-- Qué evento
CREATE TABLE dim_tipo_evento (
    sk_tipo_evento SERIAL PRIMARY KEY,
    id_tipo_evento INT NOT NULL UNIQUE,
    nombre         VARCHAR(80) NOT NULL
);

-- Qué se vende
CREATE TABLE dim_servicio (
    sk_servicio       SERIAL PRIMARY KEY,
    id_servicio       INT NOT NULL UNIQUE,
    nombre            VARCHAR(100) NOT NULL,
    precio_referencia NUMERIC(12,2)
);

-- Cómo terminó la propuesta
CREATE TABLE dim_estado_propuesta (
    sk_estado   SMALLINT PRIMARY KEY,
    estado      VARCHAR(20) NOT NULL UNIQUE,   -- código en la base operativa
    descripcion VARCHAR(30) NOT NULL,
    resultado   VARCHAR(10) NOT NULL           -- Abierta | Ganada | Perdida
);

-- ─────────────────────────────────────────────────────────────────────
-- Hechos (qué se mide)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE fact_ventas (
    id_item         INT PRIMARY KEY,           -- dimensión degenerada: el ítem de la propuesta
    sk_tiempo       INT NOT NULL REFERENCES dim_tiempo,
    sk_empresa      INT NOT NULL REFERENCES dim_empresa,
    sk_cliente      INT NOT NULL REFERENCES dim_cliente,
    sk_tipo_evento  INT NOT NULL REFERENCES dim_tipo_evento,
    sk_servicio     INT NOT NULL REFERENCES dim_servicio,
    sk_estado       SMALLINT NOT NULL REFERENCES dim_estado_propuesta,
    id_propuesta    INT NOT NULL,              -- dimensión degenerada: agrupa los ítems de una propuesta
    motivo_rechazo  TEXT,                      -- dimensión degenerada
    -- medidas
    cantidad        INT NOT NULL,              -- unidades del servicio (personas, en el catering)
    precio_unitario NUMERIC(12,2) NOT NULL,
    importe         NUMERIC(14,2) NOT NULL,    -- cantidad × precio unitario
    importe_neto    NUMERIC NOT NULL,          -- importe menos su parte del descuento de la propuesta
    es_aceptada     SMALLINT NOT NULL          -- 1 si la propuesta se aceptó (se suma para contar)
);

CREATE INDEX ON fact_ventas (sk_tiempo);
CREATE INDEX ON fact_ventas (sk_tipo_evento);
CREATE INDEX ON fact_ventas (sk_servicio);
CREATE INDEX ON fact_ventas (sk_estado);
