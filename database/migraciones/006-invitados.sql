-- Migración v5 → v6: invitados a los eventos (link público + comprobante).
-- - Cada evento tiene como mucho una invitación: un link público que el centro comparte por WhatsApp.
-- - Cada invitado responde un formulario sin iniciar sesión (asiste o no, medio de pago, comprobante).
-- - El comprobante va en la base (BYTEA): con 3 réplicas, un archivo en el disco de una no lo ven las otras.
-- Se puede correr una sola vez sobre una base v5.

BEGIN;

CREATE TABLE invitaciones (
    id_invitacion SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_evento INT NOT NULL UNIQUE,
    token VARCHAR(64) NOT NULL UNIQUE,
    precio_por_invitado NUMERIC(12,2) NOT NULL CHECK (precio_por_invitado >= 0),
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_limite DATE,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento)
);

CREATE TABLE invitados (
    id_invitado SERIAL PRIMARY KEY,
    id_invitacion INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    asiste BOOLEAN NOT NULL,
    medio_pago VARCHAR(20) CHECK (medio_pago IN ('efectivo', 'transferencia')),
    comprobante BYTEA,
    comprobante_nombre VARCHAR(200),
    comprobante_tipo VARCHAR(100),
    pago_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_respuesta TIMESTAMP DEFAULT NOW(),
    -- Si no asiste, no tiene sentido un medio de pago
    CHECK (asiste OR medio_pago IS NULL),
    FOREIGN KEY (id_invitacion) REFERENCES invitaciones(id_invitacion)
);

COMMIT;
