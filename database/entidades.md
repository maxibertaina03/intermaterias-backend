# Entidades y atributos del sistema de eventos

> **Borrador para discutir en grupo (BD-1).** Cada uno revisa, comenta en el PR y propone cambios.
> Todos tenemos que poder explicar por qué existe cada tabla.

## Punto de partida

**Qué hace el sistema** (documento "Objetivo y alcance"): ayuda a una organizadora a gestionar los
eventos que le encargan, desde la solicitud hasta el cierre:

```
solicitud ──▶ propuesta (servicios + importes) ──▶ aceptada / rechazada
                                                      │
                     confirmado ──▶ servicios con proveedores + tareas ──▶ realizado / cancelado
```

**Multitenant:** la tabla `empresas` representa a **cada organizadora** que usa el sistema. Nuestro
centro de estudiantes es una "empresa"; el de otra escuela sería otra. Por eso toda tabla con datos
propios de una organizadora tiene `id_empresa` → `empresas`.

**Origen de cada dato:**
- **A** = lo pide el documento de alcance (seguro).
- **H** = hipótesis nuestra sobre el centro de estudiantes: hay que **confirmarla en el relevamiento**.

## Lo que NO guardamos (fuera del alcance)

La guía de la actividad pregunta por inscripciones, entradas y pagos, pero el alcance del software
los deja afuera:

| Tema | Por qué no |
|------|------------|
| Lista de asistentes (quién va y quién no) | "No se administra a cada invitado": guardamos solo la cantidad estimada |
| Tarjetas / entradas y su precio | Venta de entradas: fuera del alcance |
| Cobros (efectivo, transferencia), pagos a proveedores | Cobros, pagos y facturación: fuera del alcance |

---

## Entidades

### 1. `empresas` — la organizadora (tenant) · A

**Sin cambios**, tal como quedó en la actividad anterior.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_empresa | SERIAL | PK |
| nombre | VARCHAR(150) | NOT NULL |
| cuit | VARCHAR(13) | NOT NULL, UNIQUE |
| email | VARCHAR(150) | |
| telefono | VARCHAR(30) | |
| direccion | VARCHAR(200) | |
| activo | BOOLEAN | DEFAULT TRUE |
| fecha_creacion | TIMESTAMP | DEFAULT NOW() |

### 2. `usuarios` — personal que usa el sistema · A (roles: H)

El alcance pide "acceso identificado del personal, con permisos sencillos". Los usuarios son
integrantes del centro, **no** clientes ni proveedores.

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_usuario | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | Cada usuario pertenece a una organizadora |
| nombre | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(150) | NOT NULL, UNIQUE (id_empresa, email) | Para iniciar sesión |
| password_hash | VARCHAR(255) | NOT NULL | Nunca se guarda la contraseña en texto plano |
| rol | VARCHAR(20) | NOT NULL, CHECK (rol IN ('admin', 'organizador', 'colaborador')) | **H**: los roles reales salen del relevamiento |
| activo | BOOLEAN | DEFAULT TRUE | Dar de baja sin borrar su historial |

### 3. `clientes` — quien encarga el evento · A (tipos: H)

Cada evento corresponde a **un** cliente contratante. En un centro de estudiantes puede ser un curso,
la comisión directiva o la institución (**H**, es la pregunta clave del relevamiento).

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_cliente | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| nombre | VARCHAR(150) | NOT NULL | Ej: "5° A", "Comisión directiva" |
| tipo | VARCHAR(20) | NOT NULL, CHECK (tipo IN ('curso', 'comision', 'institucion', 'otro')) | **H** |
| contacto_nombre | VARCHAR(100) | | Quien lo representa (delegado, etc.) |
| telefono | VARCHAR(30) | | |
| email | VARCHAR(150) | | |
| activo | BOOLEAN | DEFAULT TRUE | |

### 4. `cursos` — cursos de la escuela · H

Para registrar **cuántos asistentes estimados hay por curso** (dato general, no una lista de alumnos).

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_curso | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(30) | NOT NULL, UNIQUE (id_empresa, nombre) — ej: "5° A" |
| anio | SMALLINT | CHECK (anio BETWEEN 1 AND 7) |
| division | VARCHAR(5) | |

### 5. `tipos_evento` — fiesta de bienvenida, egresados… · A

Catálogo propio de cada organizadora, para consultar y filtrar eventos por tipo.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_tipo_evento | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(80) | NOT NULL, UNIQUE (id_empresa, nombre) |

### 6. `sedes` — salones y lugares · A

La solicitud tiene una "sede prevista" y los lugares se repiten entre eventos.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_sede | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(150) | NOT NULL |
| direccion | VARCHAR(200) | |
| capacidad | INT | CHECK (capacidad > 0) |

### 7. `eventos` — la solicitud y todo su ciclo de vida · A (estados: H)

Usamos **una sola tabla** para la solicitud y el evento: es el mismo encargo que va cambiando de
estado. Así "consultar eventos por fecha o estado" es una sola consulta.

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_evento | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_cliente | INT | NOT NULL, FK → clientes | Un evento = un cliente contratante |
| id_tipo_evento | INT | NOT NULL, FK → tipos_evento | |
| id_sede | INT | FK → sedes (NULL) | Puede no estar definida al principio |
| nombre | VARCHAR(150) | NOT NULL | Ej: "Bienvenida 2027" |
| fecha | DATE | (NULL) | Puede ser tentativa o no estar definida (**H**) |
| hora_inicio | TIME | | Eventos de una jornada |
| cantidad_estimada | INT | CHECK (cantidad_estimada > 0) | Dato general (alcance) |
| necesidades | TEXT | | Necesidades y preferencias |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'solicitado', CHECK (estado IN ('solicitado', 'en_negociacion', 'confirmado', 'en_preparacion', 'realizado', 'cancelado')) | **H**: los estados reales salen del relevamiento |
| motivo_cancelacion | TEXT | CHECK: obligatorio si estado = 'cancelado' | Se conserva el motivo de la cancelación |
| observaciones_cierre | TEXT | | Cierre operativo básico |
| fecha_creacion | TIMESTAMP | DEFAULT NOW() | |

### 8. `evento_cursos` — cantidad estimada por curso · H (tabla intermedia N:M)

Un evento puede ser para varios cursos y un curso puede ir a muchos eventos.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_evento | INT | PK compuesta, FK → eventos |
| id_curso | INT | PK compuesta, FK → cursos |
| cantidad_estimada | INT | NOT NULL, CHECK (cantidad_estimada > 0) |

### 9. `servicios` — catálogo de servicios · A

Lo que la organizadora ofrece en sus propuestas: salón, DJ, catering, decoración, seguridad…

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_servicio | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(100) | NOT NULL, UNIQUE (id_empresa, nombre) |
| descripcion | TEXT | |
| precio_referencia | NUMERIC(12,2) | CHECK (precio_referencia >= 0) |
| activo | BOOLEAN | DEFAULT TRUE |

### 10. `proveedores` — datos básicos · A

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_proveedor | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(150) | NOT NULL |
| contacto_nombre | VARCHAR(100) | |
| telefono | VARCHAR(30) | |
| email | VARCHAR(150) | |
| activo | BOOLEAN | DEFAULT TRUE |

### 11. `proveedor_servicios` — qué servicios da cada proveedor · A (tabla intermedia N:M)

Un proveedor puede dar varios servicios (DJ + sonido) y un servicio lo pueden dar varios proveedores.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_proveedor | INT | PK compuesta, FK → proveedores |
| id_servicio | INT | PK compuesta, FK → servicios |

### 12. `propuestas` — la propuesta al cliente · A

"**Una** propuesta vigente por solicitud", que se modifica mientras se negocia y termina aceptada o
rechazada. Sin historial de versiones (lo dice el alcance).

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_propuesta | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_evento | INT | NOT NULL, UNIQUE, FK → eventos | UNIQUE = una sola por evento (1:1) |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'borrador', CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada')) | |
| condiciones | TEXT | | Condiciones acordadas al confirmar |
| motivo_rechazo | TEXT | | |
| fecha_respuesta | TIMESTAMP | | Cuándo la aceptó o rechazó |
| fecha_actualizacion | TIMESTAMP | DEFAULT NOW() | |

El **total no se guarda**: se calcula sumando los ítems, así nunca queda desactualizado.

### 13. `propuesta_items` — servicios ofrecidos con su importe · A

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_item | SERIAL | PK |
| id_propuesta | INT | NOT NULL, FK → propuestas |
| id_servicio | INT | NOT NULL, FK → servicios |
| cantidad | INT | NOT NULL, DEFAULT 1, CHECK (cantidad > 0) |
| precio_unitario | NUMERIC(12,2) | NOT NULL, CHECK (precio_unitario >= 0) |

`precio_unitario` se copia del servicio pero se puede cambiar al negociar.

### 14. `evento_servicios` — servicios acordados y su proveedor · A

Cuando la propuesta se acepta, cada servicio acordado se coordina con un proveedor, cuya
participación queda **pendiente** o **confirmada**.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_evento_servicio | SERIAL | PK |
| id_evento | INT | NOT NULL, FK → eventos |
| id_servicio | INT | NOT NULL, FK → servicios |
| id_proveedor | INT | FK → proveedores (NULL hasta asignarlo) |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'pendiente', CHECK (estado IN ('pendiente', 'confirmado')) |
| observaciones | TEXT | Lo que informó el proveedor |

### 15. `tareas` — preparación y seguimiento · A

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_tarea | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_evento | INT | NOT NULL, FK → eventos | |
| id_responsable | INT | FK → usuarios | Responsable interno |
| descripcion | VARCHAR(200) | NOT NULL | |
| fecha_prevista | DATE | | |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'pendiente', CHECK (estado IN ('pendiente', 'en_curso', 'hecha')) | |

"Vencida" **no se guarda**: es una tarea no hecha con `fecha_prevista` anterior a hoy (se calcula).

### 16. `cambios_evento` — registro de cambios relevantes · A

El alcance pide registrar cambios relevantes (fecha, servicio acordado…) para revisar los
compromisos afectados.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_cambio | SERIAL | PK |
| id_evento | INT | NOT NULL, FK → eventos |
| id_usuario | INT | NOT NULL, FK → usuarios (quién lo registró) |
| fecha | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| descripcion | VARCHAR(200) | NOT NULL — ej: "Cambio de fecha" |
| valor_anterior | TEXT | |
| valor_nuevo | TEXT | |

---

## Relaciones

| Relación | Cardinalidad | Cómo se resuelve |
|----------|--------------|------------------|
| empresa — usuarios, clientes, cursos, tipos_evento, sedes, eventos, servicios, proveedores | 1 : N | `id_empresa` en cada tabla |
| cliente — eventos | 1 : N | `eventos.id_cliente` |
| tipo de evento — eventos | 1 : N | `eventos.id_tipo_evento` |
| sede — eventos | 1 : N (opcional) | `eventos.id_sede` (NULL) |
| evento — cursos | **N : M** | tabla `evento_cursos` |
| proveedor — servicios | **N : M** | tabla `proveedor_servicios` |
| evento — propuesta | 1 : 1 | `propuestas.id_evento` UNIQUE |
| propuesta — ítems | 1 : N | `propuesta_items.id_propuesta` |
| servicio — ítems de propuesta | 1 : N | `propuesta_items.id_servicio` |
| evento — servicios acordados | 1 : N | `evento_servicios.id_evento` |
| proveedor — servicios acordados | 1 : N (opcional) | `evento_servicios.id_proveedor` |
| evento — tareas | 1 : N | `tareas.id_evento` |
| usuario — tareas (responsable) | 1 : N | `tareas.id_responsable` |
| evento — cambios | 1 : N | `cambios_evento.id_evento` |
| usuario — cambios (quién registró) | 1 : N | `cambios_evento.id_usuario` |

## Cómo cubre el recorrido obligatorio

| Recorrido del alcance | Tablas |
|-----------------------|--------|
| Registrar una solicitud | clientes, eventos (estado `solicitado`), evento_cursos |
| Elaborar una propuesta | propuestas, propuesta_items, servicios |
| Registrar su aceptación / rechazo | propuestas.estado, motivo_rechazo, fecha_respuesta |
| Coordinar servicios y tareas | evento_servicios, proveedores, tareas, usuarios |
| Consultar pendientes | evento_servicios con estado `pendiente`; tareas no hechas o vencidas |
| Cambio relevante | cambios_evento |
| Cerrar o cancelar | eventos.estado, observaciones_cierre, motivo_cancelacion |

## Para discutir en el PR

1. ¿Una sola tabla `eventos` para solicitud + evento, o separarlas? (propuesta: una sola)
2. ¿Los roles de `usuarios` (admin / organizador / colaborador) alcanzan?
3. ¿Hace falta `cursos`? Depende de que el relevamiento confirme que se usa para organizar.
4. ¿`sedes` como tabla propia o el salón como un servicio más con proveedor? (propuesta: las dos cosas: la sede es el lugar y el alquiler del salón es un servicio)
5. ¿Falta algo que necesite el centro de estudiantes **dentro del alcance**?
