-- =====================================================================
-- Data warehouse del sistema de eventos · 01: esquema (modelo estrella)
-- =====================================================================
-- Vive en el esquema "dw" de la MISMA base de PostgreSQL que el sistema: las tablas
-- operacionales (public.*) son la fuente y el ETL (02-etl.sql) copia y transforma los
-- datos hacia acá. El sistema nunca escribe en dw.
--
-- Convenciones:
--   dim_*   dimensiones (desde dónde se mira: cuándo, quién, qué, dónde)
--   fact_*  hechos (qué se mide), una fila por cada "cosa" que pasó
--   sk_*    claves sustitutas del warehouse (las de public.* quedan como id_*: clave natural)
--   0 / -1  miembros especiales: "Sin dato" / "Equipo propio", para no tener NULL en las FK
--
-- Se puede correr varias veces: borra el esquema dw y lo vuelve a crear vacío.
-- Después: CALL dw.cargar();  (o bash scripts/etl.sh en el servidor)

BEGIN;

DROP SCHEMA IF EXISTS dw CASCADE;
CREATE SCHEMA dw;
COMMENT ON SCHEMA dw IS 'Data warehouse: modelo estrella cargado por dw.cargar() desde las tablas del sistema';

-- ─────────────────────────────────────────────────────────────────────
-- DIMENSIONES
-- ─────────────────────────────────────────────────────────────────────

-- Calendario. sk_tiempo = AAAAMMDD (fácil de leer y ordenar). 0 = sin fecha.
CREATE TABLE dw.dim_tiempo (
    sk_tiempo        INT PRIMARY KEY,
    fecha            DATE UNIQUE,
    anio             SMALLINT,
    semestre         SMALLINT,
    trimestre        SMALLINT,
    mes              SMALLINT,
    nombre_mes       VARCHAR(12),
    anio_mes         CHAR(7),            -- '2026-11', cómodo para agrupar y ordenar
    semana_iso       SMALLINT,
    dia              SMALLINT,
    dia_semana       SMALLINT,           -- 1 = lunes … 7 = domingo
    nombre_dia       VARCHAR(10),
    es_fin_de_semana BOOLEAN,
    temporada        VARCHAR(30)         -- calendario escolar argentino (ver dw.temporada())
);

-- Organizadoras que usan el sistema (SCD tipo 1: se pisa con el valor actual)
CREATE TABLE dw.dim_empresa (
    sk_empresa     SERIAL PRIMARY KEY,
    id_empresa     INT NOT NULL UNIQUE,
    nombre         VARCHAR(150) NOT NULL,
    tipo_cuenta    VARCHAR(20) NOT NULL, -- 'Prueba gratuita' | 'Sin límite'
    activa         BOOLEAN NOT NULL,
    fecha_alta     DATE
);

-- Quien encarga los eventos (SCD tipo 1)
CREATE TABLE dw.dim_cliente (
    sk_cliente     SERIAL PRIMARY KEY,
    id_cliente     INT UNIQUE,           -- NULL solo en el miembro "Sin dato"
    id_empresa     INT,
    nombre         VARCHAR(150) NOT NULL,
    tipo           VARCHAR(30) NOT NULL, -- Centro de estudiantes | Grupo de estudiantes | Curso
    institucion    VARCHAR(150) NOT NULL,
    activo         BOOLEAN NOT NULL
);

CREATE TABLE dw.dim_tipo_evento (
    sk_tipo_evento SERIAL PRIMARY KEY,
    id_tipo_evento INT UNIQUE,
    id_empresa     INT,
    nombre         VARCHAR(80) NOT NULL
);

CREATE TABLE dw.dim_sede (
    sk_sede        SERIAL PRIMARY KEY,
    id_sede        INT UNIQUE,
    id_empresa     INT,
    nombre         VARCHAR(150) NOT NULL,
    capacidad      INT,
    rango_capacidad VARCHAR(20) NOT NULL -- 'Hasta 150' | '151 a 300' | 'Más de 300' | 'Sin dato'
);

-- Servicios: SCD tipo 2. Cada vez que cambia el precio de referencia se cierra la versión
-- vigente y se abre otra, así se puede comparar lo cobrado contra la lista DE ESE MOMENTO.
CREATE TABLE dw.dim_servicio (
    sk_servicio       SERIAL PRIMARY KEY,
    id_servicio       INT,
    id_empresa        INT,
    nombre            VARCHAR(100) NOT NULL,
    precio_referencia NUMERIC(12,2),
    vigente_desde     DATE NOT NULL,
    vigente_hasta     DATE NOT NULL DEFAULT DATE '9999-12-31',
    es_actual         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX dim_servicio_una_actual ON dw.dim_servicio (id_servicio) WHERE es_actual;

-- Proveedores. -1 = equipo propio de la organizadora, 0 = sin asignar.
CREATE TABLE dw.dim_proveedor (
    sk_proveedor   SERIAL PRIMARY KEY,
    id_proveedor   INT UNIQUE,
    id_empresa     INT,
    nombre         VARCHAR(150) NOT NULL,
    activo         BOOLEAN NOT NULL
);

-- Estados del evento agrupados en etapas del embudo comercial (dimensión fija)
CREATE TABLE dw.dim_estado_evento (
    sk_estado      SMALLINT PRIMARY KEY,
    estado         VARCHAR(20) NOT NULL UNIQUE,
    etiqueta       VARCHAR(30) NOT NULL,
    etapa          VARCHAR(20) NOT NULL, -- 'En curso' | 'Ganado' | 'Perdido'
    orden          SMALLINT NOT NULL
);
INSERT INTO dw.dim_estado_evento VALUES
 (1, 'recibida',          'Recibida',           'En curso', 1),
 (2, 'falta_informacion', 'Falta información',  'En curso', 2),
 (3, 'propuesta_enviada', 'Propuesta enviada',  'En curso', 3),
 (4, 'confirmado',        'Confirmado',         'Ganado',   4),
 (5, 'en_preparacion',    'En preparación',     'Ganado',   5),
 (6, 'realizado',         'Realizado',          'Ganado',   6),
 (7, 'no_aceptada',       'No aceptada',        'Perdido',  7),
 (8, 'cancelado',         'Cancelado',          'Perdido',  8);

-- ─────────────────────────────────────────────────────────────────────
-- HECHOS
-- ─────────────────────────────────────────────────────────────────────

-- Un registro por evento (solicitud). Grano: evento.
CREATE TABLE dw.fact_eventos (
    id_evento            INT PRIMARY KEY,                 -- dimensión degenerada
    sk_fecha_evento      INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_fecha_solicitud   INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_empresa           INT NOT NULL REFERENCES dw.dim_empresa,
    sk_cliente           INT NOT NULL REFERENCES dw.dim_cliente,
    sk_tipo_evento       INT NOT NULL REFERENCES dw.dim_tipo_evento,
    sk_sede              INT NOT NULL REFERENCES dw.dim_sede,
    sk_estado            SMALLINT NOT NULL REFERENCES dw.dim_estado_evento,
    cantidad_estimada    INT NOT NULL,
    dias_anticipacion    INT,            -- días entre que llegó la solicitud y la fecha del evento
    ocupacion_sede_pct   NUMERIC(5,1),   -- cantidad estimada / capacidad del salón
    importe_aceptado     NUMERIC(14,2) NOT NULL DEFAULT 0,  -- total de la propuesta si se aceptó
    cantidad_cambios     INT NOT NULL DEFAULT 0,
    tareas_total         INT NOT NULL DEFAULT 0,
    tareas_hechas        INT NOT NULL DEFAULT 0,
    tareas_atrasadas     INT NOT NULL DEFAULT 0,  -- no hechas con fecha prevista ya pasada
    invitados_confirmados INT NOT NULL DEFAULT 0,
    es_cancelado         SMALLINT NOT NULL,       -- 0/1: se suma para contar
    es_realizado         SMALLINT NOT NULL
);

-- Un registro por propuesta presentada (o en preparación). Grano: propuesta.
CREATE TABLE dw.fact_propuestas (
    id_propuesta         INT PRIMARY KEY,
    id_evento            INT NOT NULL,
    sk_fecha_presentacion INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_fecha_respuesta   INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_empresa           INT NOT NULL REFERENCES dw.dim_empresa,
    sk_cliente           INT NOT NULL REFERENCES dw.dim_cliente,
    sk_tipo_evento       INT NOT NULL REFERENCES dw.dim_tipo_evento,
    estado               VARCHAR(20) NOT NULL,    -- degenerada: en_preparacion | presentada | aceptada | rechazada | vencida
    motivo_rechazo       TEXT,                    -- degenerada
    cantidad_items       INT NOT NULL,
    subtotal             NUMERIC(14,2) NOT NULL,
    descuento            NUMERIC(14,2) NOT NULL,
    total                NUMERIC(14,2) NOT NULL,
    total_por_persona    NUMERIC(14,2),
    dias_hasta_respuesta INT,
    es_aceptada          SMALLINT NOT NULL,
    es_rechazada         SMALLINT NOT NULL
);

-- Un registro por servicio cotizado. Grano: ítem de propuesta.
CREATE TABLE dw.fact_servicios_cotizados (
    id_item              INT PRIMARY KEY,
    id_propuesta         INT NOT NULL,
    sk_fecha_evento      INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_empresa           INT NOT NULL REFERENCES dw.dim_empresa,
    sk_cliente           INT NOT NULL REFERENCES dw.dim_cliente,
    sk_tipo_evento       INT NOT NULL REFERENCES dw.dim_tipo_evento,
    sk_servicio          INT NOT NULL REFERENCES dw.dim_servicio,   -- versión vigente al presentar
    sk_proveedor         INT NOT NULL REFERENCES dw.dim_proveedor,  -- quién lo resolvió (si se aceptó)
    cantidad             INT NOT NULL,
    precio_unitario      NUMERIC(12,2) NOT NULL,
    importe              NUMERIC(14,2) NOT NULL,
    importe_lista        NUMERIC(14,2),           -- cantidad × precio de referencia de esa época
    es_vendido           SMALLINT NOT NULL        -- 1 si la propuesta se aceptó
);

-- Un registro por respuesta de invitado. Grano: invitado.
CREATE TABLE dw.fact_invitados (
    id_invitado          INT PRIMARY KEY,
    id_evento            INT NOT NULL,
    sk_fecha_respuesta   INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_fecha_evento      INT NOT NULL REFERENCES dw.dim_tiempo,
    sk_empresa           INT NOT NULL REFERENCES dw.dim_empresa,
    sk_cliente           INT NOT NULL REFERENCES dw.dim_cliente,
    sk_tipo_evento       INT NOT NULL REFERENCES dw.dim_tipo_evento,
    medio_pago           VARCHAR(20) NOT NULL,    -- degenerada: efectivo | transferencia | no asiste
    asiste               SMALLINT NOT NULL,
    pago_verificado      SMALLINT NOT NULL,
    importe              NUMERIC(12,2) NOT NULL,  -- precio por invitado si asiste
    importe_verificado   NUMERIC(12,2) NOT NULL,
    dias_antes_del_evento INT
);

-- Índices para los cruces más usados (las FK hacia tiempo, empresa y tipo de evento)
CREATE INDEX ON dw.fact_eventos (sk_fecha_evento);
CREATE INDEX ON dw.fact_eventos (sk_empresa, sk_tipo_evento);
CREATE INDEX ON dw.fact_propuestas (sk_fecha_presentacion);
CREATE INDEX ON dw.fact_propuestas (sk_empresa, estado);
CREATE INDEX ON dw.fact_servicios_cotizados (sk_servicio);
CREATE INDEX ON dw.fact_servicios_cotizados (sk_empresa, sk_fecha_evento);
CREATE INDEX ON dw.fact_invitados (sk_empresa, sk_fecha_evento);

-- Registro de cada corrida del ETL
CREATE TABLE dw.etl_ejecuciones (
    id_ejecucion   SERIAL PRIMARY KEY,
    inicio         TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
    fin            TIMESTAMP,
    estado         VARCHAR(10) NOT NULL DEFAULT 'en curso',  -- en curso | ok | error
    filas          JSONB,        -- filas cargadas por tabla
    error          TEXT
);

COMMIT;
