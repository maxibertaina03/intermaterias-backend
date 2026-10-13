-- =====================================================================
-- Sistema de eventos (intermaterias) - Script de la base de datos
-- Crea toda la estructura desde cero y carga datos de prueba.
-- Se puede ejecutar varias veces: primero borra todo.
--
-- Multitenant: cada fila de "empresas" es una organizadora que usa el
-- sistema (por ejemplo, un centro de estudiantes). Toda tabla con datos
-- propios de una organizadora tiene id_empresa.
--
-- Ver database/entidades.md para el porqué de cada tabla.
-- =====================================================================


-- =====================================================================
-- 1) DROP: en orden inverso a las dependencias
-- =====================================================================
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
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;


-- =====================================================================
-- 2) CREATE: empresas primero, después las que dependen de ella
-- =====================================================================

-- Organizadora que usa el sistema (tenant). Sin cambios respecto de la actividad anterior.
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

-- Personal de la organizadora que usa el sistema
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'organizador', 'colaborador')),
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE (id_empresa, email),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Quien encarga el evento (un curso, la comisión directiva, la institución...)
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('curso', 'comision', 'institucion', 'otro')),
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
);

-- Cursos de la escuela (para la cantidad estimada de asistentes por curso)
CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    nombre VARCHAR(30) NOT NULL,
    anio SMALLINT CHECK (anio BETWEEN 1 AND 7),
    division VARCHAR(5),
    UNIQUE (id_empresa, nombre),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa)
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

-- Catálogo de servicios que se ofrecen en las propuestas
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
    id_tipo_evento INT NOT NULL,
    id_sede INT,
    nombre VARCHAR(150) NOT NULL,
    fecha DATE,
    hora_inicio TIME,
    cantidad_estimada INT CHECK (cantidad_estimada > 0),
    necesidades TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'solicitado'
        CHECK (estado IN ('solicitado', 'en_negociacion', 'confirmado', 'en_preparacion', 'realizado', 'cancelado')),
    motivo_cancelacion TEXT,
    observaciones_cierre TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    -- Un evento cancelado tiene que tener motivo
    CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    FOREIGN KEY (id_tipo_evento) REFERENCES tipos_evento(id_tipo_evento),
    FOREIGN KEY (id_sede) REFERENCES sedes(id_sede)
);

-- N:M - cantidad estimada de asistentes por curso (dato general, no lista de alumnos)
CREATE TABLE evento_cursos (
    id_evento INT NOT NULL,
    id_curso INT NOT NULL,
    cantidad_estimada INT NOT NULL CHECK (cantidad_estimada > 0),
    PRIMARY KEY (id_evento, id_curso),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_curso) REFERENCES cursos(id_curso)
);

-- Una propuesta vigente por evento (1:1 gracias al UNIQUE)
CREATE TABLE propuestas (
    id_propuesta SERIAL PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_evento INT NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada')),
    condiciones TEXT,
    motivo_rechazo TEXT,
    fecha_respuesta TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa),
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento)
);

-- Servicios ofrecidos en la propuesta con su importe (el total se calcula)
CREATE TABLE propuesta_items (
    id_item SERIAL PRIMARY KEY,
    id_propuesta INT NOT NULL,
    id_servicio INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    FOREIGN KEY (id_propuesta) REFERENCES propuestas(id_propuesta),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-- Servicios acordados del evento y si el proveedor confirmó
CREATE TABLE evento_servicios (
    id_evento_servicio SERIAL PRIMARY KEY,
    id_evento INT NOT NULL,
    id_servicio INT NOT NULL,
    id_proveedor INT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado')),
    observaciones TEXT,
    FOREIGN KEY (id_evento) REFERENCES eventos(id_evento),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
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


-- =====================================================================
-- 3) INSERT: datos de prueba
-- Los ids se generan en orden (1, 2, 3...) porque la base se crea de cero.
-- =====================================================================

-- Empresas: las 3 de la actividad anterior + 2 centros de estudiantes
INSERT INTO empresas (nombre, cuit, email, telefono, direccion) VALUES
('Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colón 1200, Córdoba'),            -- 1
('Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Núñez 4500, Córdoba'),                     -- 2
('Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL),                                                -- 3
('Centro de Estudiantes Instituto San Martín', '30-71555444-2', 'centro@institutosanmartin.edu.ar', '351-4112233', 'Bv. San Juan 800, Córdoba'),  -- 4
('Centro de Estudiantes Colegio Belgrano', '30-71666777-5', 'cecb@colegiobelgrano.edu.ar', '351-4778899', 'Av. Vélez Sarsfield 1500, Córdoba');   -- 5

-- Usuarios (las contraseñas son hashes de prueba)
INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol) VALUES
(4, 'Sofía Pereyra', 'sofia@institutosanmartin.edu.ar', '$2b$10$prueba.hash.no.real.000000000000000000000000000001', 'admin'),       -- 1
(4, 'Mateo Gómez', 'mateo@institutosanmartin.edu.ar', '$2b$10$prueba.hash.no.real.000000000000000000000000000002', 'organizador'),   -- 2
(4, 'Valentina Ruiz', 'valen@institutosanmartin.edu.ar', '$2b$10$prueba.hash.no.real.000000000000000000000000000003', 'colaborador'),-- 3
(5, 'Joaquín López', 'joaquin@colegiobelgrano.edu.ar', '$2b$10$prueba.hash.no.real.000000000000000000000000000004', 'admin'),         -- 4
(5, 'Martina Díaz', 'martina@colegiobelgrano.edu.ar', '$2b$10$prueba.hash.no.real.000000000000000000000000000005', 'organizador');    -- 5

-- Clientes
INSERT INTO clientes (id_empresa, nombre, tipo, contacto_nombre, telefono, email) VALUES
(4, 'Comisión directiva del centro', 'comision', 'Sofía Pereyra', '351-6001001', NULL),     -- 1
(4, '6° Año A', 'curso', 'Lucía Fernández (delegada)', '351-6001002', NULL),               -- 2
(4, 'Dirección del Instituto San Martín', 'institucion', 'Prof. Andrea Molina', '351-4112234', 'direccion@institutosanmartin.edu.ar'), -- 3
(5, '5° Año B', 'curso', 'Tomás Herrera (delegado)', '351-6002001', NULL);                 -- 4

-- Cursos
INSERT INTO cursos (id_empresa, nombre, anio, division) VALUES
(4, '1° A', 1, 'A'),  -- 1
(4, '1° B', 1, 'B'),  -- 2
(4, '2° A', 2, 'A'),  -- 3
(4, '6° A', 6, 'A'),  -- 4
(5, '5° B', 5, 'B'),  -- 5
(5, '5° C', 5, 'C');  -- 6

-- Tipos de evento
INSERT INTO tipos_evento (id_empresa, nombre) VALUES
(4, 'Fiesta de bienvenida'),     -- 1
(4, 'Fiesta de egresados'),      -- 2
(4, 'Aniversario del colegio'),  -- 3
(5, 'Fiesta de primavera');      -- 4

-- Sedes
INSERT INTO sedes (id_empresa, nombre, direccion, capacidad) VALUES
(4, 'Salón Los Álamos', 'Av. Rafael Núñez 5200, Córdoba', 300),   -- 1
(4, 'Gimnasio del Instituto', 'Bv. San Juan 800, Córdoba', 500), -- 2
(5, 'Quinta La Arboleda', 'Camino a Alta Gracia km 8', 250);      -- 3

-- Servicios
INSERT INTO servicios (id_empresa, nombre, descripcion, precio_referencia) VALUES
(4, 'Alquiler de salón', 'Salón por la noche, de 22 a 5 h', 450000.00),   -- 1
(4, 'DJ y sonido', 'DJ con equipo de sonido e iluminación', 180000.00),  -- 2
(4, 'Catering', 'Pizza party y bebidas sin alcohol por persona', 6500.00), -- 3
(4, 'Seguridad', 'Personal de seguridad por la noche', 120000.00),       -- 4
(5, 'DJ y sonido', 'DJ con equipo básico', 150000.00);                   -- 5

-- Proveedores
INSERT INTO proveedores (id_empresa, nombre, contacto_nombre, telefono, email) VALUES
(4, 'Salón Los Álamos', 'Carlos Medina', '351-5551001', 'reservas@losalamos.com'),  -- 1
(4, 'DJ Nacho Beats', 'Ignacio Ponce', '351-5551002', NULL),                        -- 2
(4, 'Pizzas Don Pepe', 'José Romero', '351-5551003', 'pedidos@donpepe.com'),        -- 3
(5, 'Sonido Total', 'Laura Ibáñez', '351-5552001', NULL);                           -- 4

INSERT INTO proveedor_servicios (id_proveedor, id_servicio) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 5);

-- Eventos: cubren el recorrido completo, un rechazo, un cambio y una cancelación
INSERT INTO eventos (id_empresa, id_cliente, id_tipo_evento, id_sede, nombre, fecha, hora_inicio, cantidad_estimada, necesidades, estado, motivo_cancelacion, observaciones_cierre) VALUES
(4, 1, 1, 1, 'Bienvenida 2027', '2027-03-20', '22:00', 220, 'Música variada, sin alcohol', 'en_preparacion', NULL, NULL),                                         -- 1
(4, 2, 2, 1, 'Egresados 6° A', '2027-11-28', '23:00', 60, 'Quieren cotillón y fotógrafo', 'en_negociacion', NULL, NULL),                                          -- 2
(4, 3, 3, 2, 'Aniversario 50 años', '2026-09-15', '20:00', 400, NULL, 'realizado', NULL, 'Salió bien. Faltó personal en la entrada.'),                             -- 3
(4, 1, 1, NULL, 'Bienvenida de invierno', NULL, NULL, 150, NULL, 'cancelado', 'La dirección no autorizó un evento en julio.', NULL),                                 -- 4
(5, 4, 4, 3, 'Primavera 5° B', '2027-09-21', '21:00', 80, NULL, 'confirmado', NULL, NULL);                                                                         -- 5

INSERT INTO evento_cursos (id_evento, id_curso, cantidad_estimada) VALUES
(1, 1, 60),
(1, 2, 55),
(1, 3, 50),
(1, 4, 55),
(2, 4, 60),
(5, 5, 45),
(5, 6, 35);

-- Propuestas: aceptada, rechazada (en negociación), aceptada y aceptada
INSERT INTO propuestas (id_empresa, id_evento, estado, condiciones, motivo_rechazo, fecha_respuesta) VALUES
(4, 1, 'aceptada', 'Seña del 30% antes del 1/3', NULL, '2026-10-01 18:30'),                    -- 1
(4, 2, 'rechazada', NULL, 'El curso pidió bajar el presupuesto', '2026-10-05 20:00'),          -- 2
(4, 3, 'aceptada', NULL, NULL, '2026-07-10 12:00'),                                            -- 3
(5, 5, 'aceptada', NULL, NULL, '2026-08-30 19:00');                                            -- 4

INSERT INTO propuesta_items (id_propuesta, id_servicio, cantidad, precio_unitario) VALUES
(1, 1, 1, 450000.00),
(1, 2, 1, 170000.00),
(1, 3, 220, 6500.00),
(1, 4, 1, 120000.00),
(2, 1, 1, 450000.00),
(2, 2, 1, 180000.00),
(3, 2, 1, 160000.00),
(3, 4, 2, 120000.00),
(4, 5, 1, 150000.00);


-- Servicios acordados: algunos confirmados y otros pendientes
INSERT INTO evento_servicios (id_evento, id_servicio, id_proveedor, estado, observaciones) VALUES
(1, 1, 1, 'confirmado', 'Reservado. Entregan llaves a las 20 h.'),
(1, 2, 2, 'confirmado', NULL),
(1, 3, 3, 'pendiente', 'Esperan la cantidad final de asistentes'),
(1, 4, NULL, 'pendiente', 'Falta conseguir proveedor'),
(5, 5, 4, 'confirmado', NULL);

-- Tareas: hechas, pendientes y una vencida (fecha pasada y no hecha)
INSERT INTO tareas (id_empresa, id_evento, id_responsable, descripcion, fecha_prevista, estado) VALUES
(4, 1, 2, 'Confirmar cantidad de asistentes con cada curso', '2027-03-01', 'en_curso'),
(4, 1, 3, 'Conseguir proveedor de seguridad', '2026-10-01', 'pendiente'),
(4, 1, 2, 'Pedir autorización a la dirección', '2026-09-20', 'hecha'),
(4, 3, 1, 'Armar la decoración del gimnasio', '2026-09-14', 'hecha'),
(5, 5, 5, 'Avisar horario al DJ', '2026-09-15', 'hecha');

-- Cambios relevantes
INSERT INTO cambios_evento (id_evento, id_usuario, descripcion, valor_anterior, valor_nuevo) VALUES
(1, 2, 'Cambio de fecha', '2027-03-13', '2027-03-20'),
(1, 1, 'Cambio de cantidad estimada', '200', '220');
