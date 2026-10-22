-- =====================================================================
-- Sistema de eventos (intermaterias) - Script de la base de datos
-- Versión 6: invitados a los eventos (link público + comprobante).
-- (v5: cada empresa con sus usuarios (super admin, rol admin_empresa, usuarios.usuario).
--  v4: login con Clerk por usuario y contraseña; usuarios.clerk_user_id; email opcional.)
-- Crea toda la estructura desde cero y carga datos de prueba.
-- Se puede ejecutar varias veces: primero borra todo.
--
-- Multitenant: cada fila de "empresas" es una EMPRESA ORGANIZADORA que
-- usa el sistema. Los centros de estudiantes son sus CLIENTES. Toda
-- tabla con datos propios de una organizadora tiene id_empresa.
--
-- Ver database/entidades.md para el porqué de cada tabla.
-- =====================================================================


-- =====================================================================
-- 1) DROP: en orden inverso a las dependencias
-- =====================================================================
DROP TABLE IF EXISTS invitados;
DROP TABLE IF EXISTS invitaciones;
DROP TABLE IF EXISTS cambios_evento;
DROP TABLE IF EXISTS tareas;
DROP TABLE IF EXISTS evento_servicios;
DROP TABLE IF EXISTS propuesta_items;
DROP TABLE IF EXISTS propuestas;
DROP TABLE IF EXISTS evento_cursos;
DROP TABLE IF EXISTS eventos;
DROP TABLE IF EXISTS proveedor_servicios;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS sedes;
DROP TABLE IF EXISTS tipos_evento;
DROP TABLE IF EXISTS cursos;
DROP TABLE IF EXISTS contactos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuario_roles;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;


-- =====================================================================
-- 2) CREATE: empresas primero, después las que dependen de ella
-- =====================================================================

-- Empresa organizadora (tenant). Sin cambios respecto de la primera actividad.
CREATE TABLE empresas (
    id_empresa SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cuit VARCHAR(13) NOT NULL UNIQUE,
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Personal de la organizadora (los únicos que usan el sistema) y el super admin.
-- El super admin administra las empresas y no pertenece a ninguna (id_empresa NULL).
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_empresa INT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    usuario VARCHAR(64) UNIQUE,          -- nombre de usuario con el que entra (el mismo que en Clerk)
    clerk_user_id VARCHAR(64) UNIQUE,    -- cuenta de Clerk (la crea el administrador; las contraseñas las maneja Clerk)
    es_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE (id_empresa, email),
    CONSTRAINT usuarios_empresa_o_superadmin CHECK (es_superadmin OR id_empresa IS NOT NULL),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Roles de cada usuario: una persona puede tener varios.
-- admin_empresa da de alta a los usuarios de su empresa.
CREATE TABLE usuario_roles (
    id_usuario INT NOT NULL,
    rol VARCHAR(30) NOT NULL
        CONSTRAINT usuario_roles_rol_check
        CHECK (rol IN ('admin_empresa', 'atencion_cliente', 'responsable_propuesta', 'responsable_organizacion', 'integrante')),
    PRIMARY KEY (id_usuario, rol),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Quien encarga el evento: el centro de estudiantes (o un grupo en su nombre)
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('centro_estudiantes', 'grupo_estudiantes', 'curso')),
    institucion VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Personas de contacto del cliente (pueden cambiar sin que cambie el cliente)
CREATE TABLE contactos (
    id_contacto SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(30),
    email VARCHAR(150),
    rol VARCHAR(80),
    vigente BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);

-- Cursos (para la cantidad estimada de asistentes por curso) - hipótesis
CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_cliente INT,
    nombre VARCHAR(30) NOT NULL,
    anio SMALLINT CHECK (anio BETWEEN 1 AND 7),
    division VARCHAR(5),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);

-- Tipos de evento propios de cada organizadora
CREATE TABLE tipos_evento (
    id_tipo_evento SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    UNIQUE (id_empresa, nombre),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Salones y lugares (se repiten entre eventos)
CREATE TABLE sedes (
    id_sede SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(200),
    capacidad INT CHECK (capacidad > 0),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Catálogo de servicios con precio de referencia
CREATE TABLE servicios (
    id_servicio SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_referencia NUMERIC(12,2) CHECK (precio_referencia >= 0),
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE (id_empresa, nombre),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Datos básicos de proveedores
CREATE TABLE proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(150),
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- N:M - qué servicios ofrece cada proveedor
CREATE TABLE proveedor_servicios (
    id_proveedor INT NOT NULL,
    id_servicio INT NOT NULL,
    PRIMARY KEY (id_proveedor, id_servicio),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-- La solicitud y todo el ciclo de vida del evento
CREATE TABLE eventos (
    id_evento SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_cliente INT NOT NULL,
    id_contacto INT,
    id_tipo_evento INT NOT NULL,
    id_sede INT,
    nombre VARCHAR(150) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME,
    cantidad_estimada INT NOT NULL CHECK (cantidad_estimada > 0),
    necesidades TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'recibida'
        CHECK (estado IN ('recibida', 'falta_informacion', 'propuesta_enviada', 'confirmado',
                          'en_preparacion', 'realizado', 'no_aceptada', 'cancelado')),
    motivo_cancelacion TEXT,
    observaciones_cierre TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    -- Un evento cancelado tiene que tener motivo
    CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    FOREIGN KEY (id_contacto) REFERENCES contactos(id_contacto),
    FOREIGN KEY (id_tipo_evento) REFERENCES tipos_evento(id_tipo_evento),
    FOREIGN KEY (id_sede) REFERENCES sedes(id_sede)
);

-- N:M - cantidad estimada de asistentes por curso (dato general) - hipótesis
CREATE TABLE evento_cursos (
    id_evento INT NOT NULL,
    id_curso INT NOT NULL,
    cantidad_estimada INT NOT NULL CHECK (cantidad_estimada > 0),
    PRIMARY KEY (id_evento, id_curso),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_curso) REFERENCES cursos(id_curso)
);

-- Una propuesta vigente por evento (1:1 gracias al UNIQUE). Vence a los 15 días.
CREATE TABLE propuestas (
    id_propuesta SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_evento INT NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'en_preparacion'
        CHECK (estado IN ('en_preparacion', 'presentada', 'aceptada', 'rechazada', 'vencida')),
    descuento NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    condiciones TEXT,
    motivo_rechazo TEXT,
    fecha_presentacion TIMESTAMP,
    vigencia_dias SMALLINT NOT NULL DEFAULT 15 CHECK (vigencia_dias > 0),
    fecha_respuesta TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    -- Para estar presentada (o después) tiene que tener fecha de presentación
    CHECK (estado = 'en_preparacion' OR fecha_presentacion IS NOT NULL),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento)
);

-- Servicios ofrecidos en la propuesta con su importe (el total se calcula)
CREATE TABLE propuesta_items (
    id_item SERIAL PRIMARY KEY,
    id_propuesta INT NOT NULL,
    id_servicio INT NOT NULL,
    descripcion VARCHAR(200),
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    FOREIGN KEY (id_propuesta) REFERENCES propuestas(id_propuesta),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-- Servicios acordados: los cumple un proveedor o el equipo propio, con un responsable
CREATE TABLE evento_servicios (
    id_evento_servicio SERIAL PRIMARY KEY,
    id_evento INT NOT NULL,
    id_servicio INT NOT NULL,
    es_propio BOOLEAN NOT NULL DEFAULT FALSE,
    id_proveedor INT,
    id_responsable INT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado')),
    observaciones TEXT,
    -- Un servicio propio no tiene proveedor externo
    CHECK (NOT es_propio OR id_proveedor IS NULL),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (id_responsable) REFERENCES usuarios(id_usuario)
);

-- Tareas de preparación con su responsable interno
CREATE TABLE tareas (
    id_tarea SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_evento INT NOT NULL,
    id_responsable INT,
    descripcion VARCHAR(200) NOT NULL,
    fecha_prevista DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'hecha')),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_responsable) REFERENCES usuarios(id_usuario)
);

-- Registro de cambios relevantes de un evento
CREATE TABLE cambios_evento (
    id_cambio SERIAL PRIMARY KEY,
    id_evento INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    descripcion VARCHAR(200) NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Invitación pública de un evento: un link por evento, que el centro comparte por WhatsApp
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

-- Cada invitado responde sin iniciar sesión: si asiste, con qué paga y el comprobante (opcional)
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


-- =====================================================================
-- 3) INSERT: datos de prueba
-- Los ids se generan en orden (1, 2, 3...) porque la base se crea de cero.
-- Organizadora 1 (Eventos del Centro): recorrido completo.
-- Organizadora 2 (Fiestas Norte): datos propios, para ver que no se mezclan.
-- =====================================================================

-- Empresas organizadoras (las 3 de la primera actividad)
INSERT INTO empresas (nombre, cuit, email, telefono, direccion) VALUES
('Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colón 1200, Córdoba'),   -- 1
('Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Núñez 4500, Córdoba'),            -- 2
('Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL);                                       -- 3

-- Personal de prueba. Las personas que entran con Clerk se crean solas la primera vez
-- (en la empresa CLERK_ID_EMPRESA con los roles de CLERK_ROLES).
-- Las cuentas de Clerk de estos usuarios se crean con: npm run usuarios-demo
INSERT INTO usuarios (id_empresa, nombre, email, usuario, es_superadmin) VALUES
(1, 'Sofía Pereyra', 'sofia@eventosdelcentro.com', 'sofia', FALSE),      -- 1
(1, 'Mateo Gómez', 'mateo@eventosdelcentro.com', 'mateo', FALSE),        -- 2
(1, 'Valentina Ruiz', 'valen@eventosdelcentro.com', 'valentina', FALSE), -- 3
(2, 'Joaquín López', 'joaquin@fiestasnorte.com', 'joaquin', FALSE),      -- 4
(NULL, 'Administración del sistema', NULL, 'superadmin', TRUE);          -- 5 (super admin)

-- Roles: Sofía administra su empresa, atiende y arma propuestas; Mateo organiza; Valentina es integrante.
-- Joaquín administra Fiestas Norte y hace todo.
INSERT INTO usuario_roles (id_usuario, rol) VALUES
(1, 'admin_empresa'),
(1, 'atencion_cliente'),
(1, 'responsable_propuesta'),
(2, 'responsable_organizacion'),
(3, 'integrante'),
(4, 'admin_empresa'),
(4, 'atencion_cliente'),
(4, 'responsable_propuesta'),
(4, 'responsable_organizacion');

-- Clientes: centros de estudiantes
INSERT INTO clientes (id_empresa, nombre, tipo, institucion) VALUES
(1, 'Centro de Estudiantes Instituto San Martín', 'centro_estudiantes', 'Instituto San Martín'),   -- 1
(1, 'Centro de Estudiantes Colegio Belgrano', 'centro_estudiantes', 'Colegio Belgrano'),           -- 2
(2, 'Centro de Estudiantes Escuela Alberdi', 'centro_estudiantes', 'Escuela Alberdi');             -- 3

-- Contactos: el del cliente 1 cambió (Lucía dejó de participar) y el cliente sigue siendo el mismo
INSERT INTO contactos (id_cliente, nombre, telefono, email, rol, vigente) VALUES
(1, 'Lucía Fernández', '351-6001002', NULL, 'Presidenta de la comisión', FALSE),   -- 1
(1, 'Tomás Herrera', '351-6001003', 'tomas.h@mail.com', 'Presidente de la comisión', TRUE), -- 2
(2, 'Martina Díaz', '351-6002001', 'martina@mail.com', 'Secretaria de la comisión', TRUE),  -- 3
(3, 'Juan Ortiz', '351-6003001', NULL, 'Delegado de 6° año', TRUE);                        -- 4

-- Cursos (hipótesis: cantidad estimada por curso)
INSERT INTO cursos (id_empresa, id_cliente, nombre, anio, division) VALUES
(1, 1, '1° A', 1, 'A'),  -- 1
(1, 1, '1° B', 1, 'B'),  -- 2
(1, 1, '6° A', 6, 'A'),  -- 3
(2, 3, '6° A', 6, 'A');  -- 4

-- Tipos de evento
INSERT INTO tipos_evento (id_empresa, nombre) VALUES
(1, 'Fiesta de bienvenida'),     -- 1
(1, 'Fiesta de egresados'),      -- 2
(1, 'Aniversario'),              -- 3
(2, 'Fiesta de egresados');      -- 4

-- Sedes
INSERT INTO sedes (id_empresa, nombre, direccion, capacidad) VALUES
(1, 'Salón Los Álamos', 'Av. Rafael Núñez 5200, Córdoba', 300),   -- 1
(1, 'Gimnasio del Instituto San Martín', 'Bv. San Juan 800, Córdoba', 500), -- 2
(2, 'Quinta La Arboleda', 'Camino a Alta Gracia km 8', 250);      -- 3

-- Servicios
INSERT INTO servicios (id_empresa, nombre, descripcion, precio_referencia) VALUES
(1, 'Sonido e iluminación', 'Equipo de sonido, luces y DJ', 180000.00),        -- 1
(1, 'Catering', 'Snacks y bebidas sin alcohol por persona', 6500.00),         -- 2
(1, 'Decoración', 'Ambientación del salón según la temática', 90000.00),      -- 3
(1, 'Fotografía', 'Fotógrafo durante el evento', 120000.00),                  -- 4
(1, 'Alquiler de salón', 'Salón por la noche', 450000.00),                   -- 5
(2, 'Sonido e iluminación', 'Equipo básico con DJ', 150000.00);               -- 6

-- Proveedores
INSERT INTO proveedores (id_empresa, nombre, contacto_nombre, telefono, email, observaciones) VALUES
(1, 'Salón Los Álamos', 'Carlos Medina', '351-5551001', 'reservas@losalamos.com', 'Entregan llaves a las 20 h'),  -- 1
(1, 'DJ Nacho Beats', 'Ignacio Ponce', '351-5551002', NULL, NULL),                                                 -- 2
(1, 'Pizzas Don Pepe', 'José Romero', '351-5551003', 'pedidos@donpepe.com', NULL),                                 -- 3
(1, 'Foto Clic', 'Ana Suárez', '351-5551004', NULL, 'Necesita la lista de horarios el día anterior'),               -- 4
(2, 'Sonido Total', 'Laura Ibáñez', '351-5552001', NULL, NULL);                                                     -- 5

INSERT INTO proveedor_servicios (id_proveedor, id_servicio) VALUES
(1, 5),
(2, 1),
(3, 2),
(4, 4),
(5, 6);

-- Eventos: recorrido completo, un rechazo, un vencimiento, un cambio y una cancelación
INSERT INTO eventos (id_empresa, id_cliente, id_contacto, id_tipo_evento, id_sede, nombre, fecha, hora_inicio, cantidad_estimada, necesidades, estado, motivo_cancelacion, observaciones_cierre) VALUES
(1, 1, 2, 1, 1, 'Bienvenida 2027', '2027-03-20', '22:00', 220, 'Música variada, sin alcohol', 'en_preparacion', NULL, NULL),                                         -- 1
(1, 1, 2, 2, 1, 'Egresados 6° A', '2027-11-28', '23:00', 60, 'Quieren fotógrafo', 'no_aceptada', NULL, NULL),                                                          -- 2
(1, 2, 3, 3, 2, 'Aniversario 50 años', '2026-09-15', '20:00', 400, NULL, 'realizado', NULL, 'Salió bien. Faltó personal en la entrada.'),                                -- 3
(1, 2, 3, 1, NULL, 'Bienvenida de invierno', '2027-07-10', NULL, 150, NULL, 'cancelado', 'El centro decidió no hacer el evento por falta de autorización.', NULL),      -- 4
(1, 1, 2, 3, NULL, 'Festejo del centro', '2027-05-02', NULL, 100, 'Algo simple con música', 'propuesta_enviada', NULL, NULL),                                           -- 5
(1, 2, 3, 2, NULL, 'Egresados 2027', '2027-12-05', NULL, 90, NULL, 'recibida', NULL, NULL),                                                                             -- 6
(2, 3, 4, 4, 3, 'Egresados Escuela Alberdi', '2027-11-20', '22:00', 80, NULL, 'confirmado', NULL, NULL);                                                                -- 7

INSERT INTO evento_cursos (id_evento, id_curso, cantidad_estimada) VALUES
(1, 1, 110),
(1, 2, 110),
(2, 3, 60),
(7, 4, 80);

-- Propuestas: aceptada, rechazada, aceptada, vencida (el festejo) y aceptada (Fiestas Norte)
INSERT INTO propuestas (id_empresa, id_evento, estado, descuento, condiciones, motivo_rechazo, fecha_presentacion, fecha_respuesta) VALUES
(1, 1, 'aceptada', 50000.00, 'Decoración en tonos azules', NULL, '2026-09-25 18:00', '2026-10-01 18:30'),   -- 1
(1, 2, 'rechazada', 0, NULL, 'El presupuesto superaba lo que tenían pensado gastar', '2026-09-28 12:00', '2026-10-05 20:00'), -- 2
(1, 3, 'aceptada', 0, NULL, NULL, '2026-07-01 10:00', '2026-07-10 12:00'),                                   -- 3
(1, 5, 'vencida', 0, NULL, NULL, '2026-09-20 10:00', NULL),                                                  -- 4
(2, 7, 'aceptada', 0, NULL, NULL, '2026-09-01 10:00', '2026-09-05 19:00');                                   -- 5

INSERT INTO propuesta_items (id_propuesta, id_servicio, descripcion, cantidad, precio_unitario) VALUES
(1, 5, 'Salón de 22 a 5 h', 1, 450000.00),
(1, 1, 'Con DJ', 1, 170000.00),
(1, 2, NULL, 220, 6500.00),
(1, 3, 'Temática "bienvenidos"', 1, 90000.00),
(2, 5, NULL, 1, 450000.00),
(2, 4, NULL, 1, 120000.00),
(3, 1, NULL, 1, 160000.00),
(3, 3, NULL, 1, 80000.00),
(4, 1, NULL, 1, 180000.00),
(5, 6, NULL, 1, 150000.00);

-- Servicios acordados: confirmados, pendiente, uno sin proveedor todavía y uno propio
INSERT INTO evento_servicios (id_evento, id_servicio, es_propio, id_proveedor, id_responsable, estado, observaciones) VALUES
(1, 5, FALSE, 1, 2, 'confirmado', 'Reservado. Entregan llaves a las 20 h.'),
(1, 1, FALSE, 2, 2, 'confirmado', NULL),
(1, 2, FALSE, 3, 3, 'pendiente', 'Respondió que puede, pero falta confirmar la cantidad final'),
(1, 3, TRUE, NULL, 3, 'pendiente', 'La hacemos nosotros con elementos propios'),
(3, 1, FALSE, 2, 2, 'confirmado', NULL),
(3, 3, TRUE, NULL, 3, 'confirmado', NULL),
(7, 6, FALSE, 5, 4, 'confirmado', NULL);

-- Tareas: hechas, en curso, pendiente y una vencida (fecha pasada y no hecha)
INSERT INTO tareas (id_empresa, id_evento, id_responsable, descripcion, fecha_prevista, estado) VALUES
(1, 1, 2, 'Confirmar cantidad final de asistentes con el centro', '2027-03-01', 'en_curso'),
(1, 1, 3, 'Comprar materiales para la decoración', '2026-10-10', 'pendiente'),
(1, 1, 2, 'Visitar el salón con el proveedor', '2026-10-08', 'hecha'),
(1, 3, 3, 'Armar la decoración del gimnasio', '2026-09-14', 'hecha'),
(2, 7, 4, 'Avisar horario de armado al DJ', '2027-11-10', 'pendiente');

-- Cambios relevantes: cambio de fecha y de cantidad en la Bienvenida 2027
INSERT INTO cambios_evento (id_evento, id_usuario, descripcion, valor_anterior, valor_nuevo) VALUES
(1, 1, 'Cambio de fecha', '2027-03-13', '2027-03-20'),
(1, 2, 'Cambio de cantidad estimada', '200', '220');

-- Invitaciones: la Bienvenida 2027 (en preparación) con el link activo; Egresados Escuela Alberdi
-- (confirmado, otra empresa) con el link vencido, para probar el 410
INSERT INTO invitaciones (id_empresa, id_evento, token, precio_por_invitado, activa, fecha_limite) VALUES
(1, 1, 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778', 8000.00, TRUE, '2027-03-15'),   -- 1
(2, 7, 'ffeeddccbbaa00998877665544332211ffeeddccbbaa001', 6000.00, TRUE, '2026-10-01');  -- 2 (vencida)

INSERT INTO invitados (id_invitacion, nombre, apellido, asiste, medio_pago, pago_verificado) VALUES
(1, 'Camila', 'Soria', TRUE, 'transferencia', TRUE),
(1, 'Benjamín', 'Acosta', TRUE, 'efectivo', FALSE),
(1, 'Lola', 'Funes', FALSE, NULL, FALSE);
