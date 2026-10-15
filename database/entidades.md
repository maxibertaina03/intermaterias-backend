# Entidades y atributos del sistema de eventos

> **Versión 2 · 15/10/2026** — ajustada con lo **confirmado en el relevamiento** (ronda 1).
> Todos tenemos que poder explicar por qué existe cada tabla.
> Términos, estados y reglas: [lenguaje ubicuo](https://github.com/maxibertaina03/intermaterias-infra/blob/develop/docs/si/03-dominio.md).

## Punto de partida

**Qué hace el sistema** (documento "Objetivo y alcance"): ayuda a una **empresa organizadora** a gestionar
los eventos que le encargan los **centros de estudiantes**, desde la solicitud hasta el cierre:

```
solicitud ──▶ propuesta (servicios + importes) ──▶ aceptada / rechazada / vencida
                                                      │
                     confirmado ──▶ servicios (proveedor o equipo propio) + tareas ──▶ realizado / cancelado
```

**Multitenant:** la tabla `empresas` representa a **cada empresa organizadora** que usa el sistema. Los
centros de estudiantes son sus **clientes** (tabla `clientes`). Toda tabla con datos propios de una
organizadora tiene `id_empresa` → `empresas`.

**Origen de cada dato:**
- **A** = lo pide el documento de alcance.
- **R** = confirmado en el relevamiento: **[M]** charla de masita (clientes), **[T]** charla de Tomi
  (propuesta), **[F]** charla de Facu (proveedores). Conversaciones en `intermaterias-infra/docs/si/relevamiento/conversaciones/`.
- **H** = hipótesis: falta confirmarla con el cliente.

## Qué cambió respecto de la versión 1

| Cambio | Por qué | Fuente |
|--------|---------|--------|
| La organizadora es una **empresa**; el **centro de estudiantes es el cliente** | Lo aclaró el cliente | R [M] |
| Nueva tabla **`contactos`**, separada de `clientes` | El contacto (delegado, miembro de la comisión) puede cambiar sin que cambie el cliente | R [M] |
| `usuarios.rol` pasa a la tabla **`usuario_roles`** | Hay 4 roles y **una persona puede tener varios** | R [M] |
| Nuevos **estados de `eventos`** (`recibida`, `falta_informacion`, `propuesta_enviada`, `no_aceptada`…) | Distinguir "pendiente de atención" de "propuesta enviada" es clave para no perder pedidos | R [M, T] |
| `propuestas`: estados `presentada` y **`vencida`**, `fecha_presentacion`, `vigencia_dias` (15) y `descuento` | Las propuestas vencen a los 15 días; hay descuentos puntuales | R [T] |
| `evento_servicios`: **`es_propio`** y **`id_responsable`** | Algunos servicios los hace el equipo propio, con un responsable | R [F] |

## Lo que NO guardamos (fuera del alcance)

| Tema | Por qué no |
|------|------------|
| Lista de asistentes (quién va y quién no) | "No se administra a cada invitado": guardamos solo la cantidad estimada |
| Tarjetas / entradas y su precio | Venta de entradas: fuera del alcance |
| Cobros, señas, pagos a proveedores | Cobros y pagos: fuera del alcance. Además el cliente confirmó que **no piden seña** [T] |
| Historial de versiones de la propuesta | Solo importa la vigente [T] (los cambios relevantes sí se registran) |

---

## Entidades

### 1. `empresas` — la empresa organizadora (tenant) · A

**Sin cambios** desde la primera actividad.

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

### 2. `usuarios` — personal de la organizadora · A

Solo el personal de la empresa usa el sistema [R M]. Los roles van en `usuario_roles`.

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_usuario | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| nombre | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(150) | NOT NULL, UNIQUE (id_empresa, email) | Para iniciar sesión |
| password_hash | VARCHAR(255) | NOT NULL | Nunca la contraseña en texto plano |
| activo | BOOLEAN | DEFAULT TRUE | Dar de baja sin borrar su historial |

### 3. `usuario_roles` — roles de cada usuario · R [M] (tabla N:M con valor fijo)

"Una misma persona puede asumir más de una de estas responsabilidades" [M].

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_usuario | INT | PK compuesta, FK → usuarios |
| rol | VARCHAR(30) | PK compuesta, CHECK (rol IN ('atencion_cliente', 'responsable_propuesta', 'responsable_organizacion', 'integrante')) |

### 4. `clientes` — quien encarga el evento · R [M]

El **centro de estudiantes** (normalmente su comisión directiva) o un grupo de estudiantes en nombre del
centro [M]. **H:** si un curso puede ser cliente por sí mismo (el cliente se contradijo).

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_cliente | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| nombre | VARCHAR(150) | NOT NULL | Ej: "Centro de Estudiantes Instituto San Martín" |
| tipo | VARCHAR(30) | NOT NULL, CHECK (tipo IN ('centro_estudiantes', 'grupo_estudiantes', 'curso')) | `curso`: **H** |
| institucion | VARCHAR(150) | | El colegio: interviene (por ejemplo, la sede) pero **no contrata** [M] |
| activo | BOOLEAN | DEFAULT TRUE | |

### 5. `contactos` — personas de contacto del cliente · R [M]

"Si cambia el representante, no significa que cambie el cliente" [M]. Por eso el contacto es una tabla
aparte, y cada evento indica con quién se habla.

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_contacto | SERIAL | PK | |
| id_cliente | INT | NOT NULL, FK → clientes | |
| nombre | VARCHAR(100) | NOT NULL | Nombre y apellido del representante [M] |
| telefono | VARCHAR(30) | | Para decisiones rápidas [M] |
| email | VARCHAR(150) | | Para enviar la propuesta [M] |
| rol | VARCHAR(80) | | Ej: "delegado de 6° A", "presidente de la comisión" |
| vigente | BOOLEAN | DEFAULT TRUE | Si deja de participar, se marca `FALSE` y se agrega el nuevo (problema real: contactos viejos [M]) |

### 6. `cursos` — cursos de la escuela · H

Para la cantidad estimada de asistentes por curso. **H:** el relevamiento todavía no confirmó que lo usen.

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_curso | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| id_cliente | INT | FK → clientes (el centro al que pertenece el curso) |
| nombre | VARCHAR(30) | NOT NULL — ej: "5° A" |
| anio | SMALLINT | CHECK (anio BETWEEN 1 AND 7) |
| division | VARCHAR(5) | |

### 7. `tipos_evento` — bienvenida, egresados, aniversario… · R [M]

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_tipo_evento | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(80) | NOT NULL, UNIQUE (id_empresa, nombre) |

"El tipo de evento nos orienta, pero no determina automáticamente qué servicios ofrecer" [M]: por eso no
hay relación entre tipos y servicios.

### 8. `sedes` — salones y lugares · A

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_sede | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(150) | NOT NULL |
| direccion | VARCHAR(200) | |
| capacidad | INT | CHECK (capacidad > 0) |

### 9. `eventos` — la solicitud y todo su ciclo de vida · A + R [M, T]

Una sola tabla: es el mismo encargo que cambia de estado. Antes de aceptar la propuesta lo llamamos
**solicitud**; después, **evento** (ver lenguaje ubicuo).

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_evento | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_cliente | INT | NOT NULL, FK → clientes | Un evento = un cliente (A) |
| id_contacto | INT | FK → contactos | Con quién se habla en este evento [M] |
| id_tipo_evento | INT | NOT NULL, FK → tipos_evento | |
| id_sede | INT | FK → sedes (NULL) | La sede puede no estar confirmada [M] |
| nombre | VARCHAR(150) | NOT NULL | Ej: "Bienvenida 2027" |
| fecha | DATE | NOT NULL | La fecha prevista es dato obligatorio para proponer [M] |
| hora_inicio | TIME | | Eventos de una jornada (A) |
| cantidad_estimada | INT | NOT NULL, CHECK (cantidad_estimada > 0) | Obligatorio para proponer [M] |
| necesidades | TEXT | | Necesidades y preferencias [M] |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'recibida', CHECK (ver abajo) | [M, T] |
| motivo_cancelacion | TEXT | CHECK: obligatorio si `cancelado` | (A) |
| observaciones_cierre | TEXT | | Cierre operativo (A) |
| fecha_creacion | TIMESTAMP | DEFAULT NOW() | |

**Estados:** `recibida` → `falta_informacion` → `propuesta_enviada` → `confirmado` → `en_preparacion` (H) →
`realizado` · también `no_aceptada` (rechazó y no siguió [T]) y `cancelado` (A).

### 10. `evento_cursos` — cantidad estimada por curso · H (tabla intermedia N:M)

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_evento | INT | PK compuesta, FK → eventos |
| id_curso | INT | PK compuesta, FK → cursos |
| cantidad_estimada | INT | NOT NULL, CHECK (cantidad_estimada > 0) |

### 11. `servicios` — catálogo de servicios · R [F, T]

Catering, sonido e iluminación, decoración, fotografía, entretenimiento, mobiliario [F]. Tienen **precio de
referencia** que se ajusta en cada propuesta [T].

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_servicio | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(100) | NOT NULL, UNIQUE (id_empresa, nombre) |
| descripcion | TEXT | |
| precio_referencia | NUMERIC(12,2) | CHECK (precio_referencia >= 0) |
| activo | BOOLEAN | DEFAULT TRUE |

### 12. `proveedores` — datos básicos · R [F]

"No necesitamos administrar todos los detalles comerciales del proveedor" [F].

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_proveedor | SERIAL | PK |
| id_empresa | INT | NOT NULL, FK → empresas |
| nombre | VARCHAR(150) | NOT NULL — nombre o razón social [F] |
| contacto_nombre | VARCHAR(100) | Con quién se habla [F] |
| telefono | VARCHAR(30) | |
| email | VARCHAR(150) | |
| observaciones | TEXT | Condiciones particulares, aclaraciones [F] |
| activo | BOOLEAN | DEFAULT TRUE |

### 13. `proveedor_servicios` — qué servicios da cada proveedor · R [F] (tabla intermedia N:M)

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_proveedor | INT | PK compuesta, FK → proveedores |
| id_servicio | INT | PK compuesta, FK → servicios |

### 14. `propuestas` — la propuesta al cliente · R [T]

**Una sola vigente** por solicitud; se ajusta mientras se negocia y no se guarda historial de versiones [T].

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_propuesta | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_evento | INT | NOT NULL, UNIQUE, FK → eventos | Una por evento (1:1) [T] |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'en_preparacion', CHECK (estado IN ('en_preparacion', 'presentada', 'aceptada', 'rechazada', 'vencida')) | [T] |
| descuento | NUMERIC(12,2) | NOT NULL, DEFAULT 0, CHECK (descuento >= 0) | Descuento puntual sobre el total [T] (H: ¿por ítem?) |
| condiciones | TEXT | | Condiciones particulares acordadas [T] |
| motivo_rechazo | TEXT | | Opcional: "no siempre nos lo dice" [T] |
| fecha_presentacion | TIMESTAMP | | Desde acá corren los días de vigencia [T] |
| vigencia_dias | SMALLINT | NOT NULL, DEFAULT 15, CHECK (vigencia_dias > 0) | "Una vigencia de 15 días corridos" [T] |
| fecha_respuesta | TIMESTAMP | | Cuándo la aceptó o rechazó [T] |
| fecha_actualizacion | TIMESTAMP | DEFAULT NOW() | |

- **Total** = suma de (cantidad × precio unitario) de los ítems − descuento. **No se guarda**: se calcula [T].
- **Vence** si pasan `vigencia_dias` desde `fecha_presentacion` sin respuesta. Vencer no borra la solicitud;
  se puede volver a presentar [T].
- **Rechazada** se puede renegociar: vuelve a `presentada` [T].
- **Aceptada** = el cliente aceptó expresamente (sin seña ni firma) y quedó registrado con `fecha_respuesta` [T].

### 15. `propuesta_items` — servicios ofrecidos con su importe · R [T]

"La propuesta detalla los servicios incluidos y el importe de cada uno, junto con el total" [T]. Los
**paquetes** son solo un punto de partida para elegir los ítems; no se guardan (H: confirmar si hace falta).

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id_item | SERIAL | PK |
| id_propuesta | INT | NOT NULL, FK → propuestas |
| id_servicio | INT | NOT NULL, FK → servicios |
| descripcion | VARCHAR(200) | Características acordadas del servicio |
| cantidad | INT | NOT NULL, DEFAULT 1, CHECK (cantidad > 0) |
| precio_unitario | NUMERIC(12,2) | NOT NULL, CHECK (precio_unitario >= 0) |

### 16. `evento_servicios` — servicios acordados y quién los cumple · R [F]

Cuando la propuesta se acepta, cada servicio acordado se vuelve un **compromiso**. Lo cumple un
**proveedor** externo o el **equipo propio**, y siempre hay un **responsable** que lo sigue [F].
"Haber contactado no significa confirmado" [F].

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_evento_servicio | SERIAL | PK | |
| id_evento | INT | NOT NULL, FK → eventos | |
| id_servicio | INT | NOT NULL, FK → servicios | |
| es_propio | BOOLEAN | NOT NULL, DEFAULT FALSE | Lo hace el equipo, sin proveedor [F] |
| id_proveedor | INT | FK → proveedores (NULL); CHECK: NULL si `es_propio` | NULL hasta asignarlo |
| id_responsable | INT | FK → usuarios | Quién sigue el tema [F] |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'pendiente', CHECK (estado IN ('pendiente', 'confirmado')) | [F] (H: `no_disponible` / reemplazo) |
| observaciones | TEXT | | Resultado del contacto, condiciones, pendientes [F] |

### 17. `tareas` — preparación y seguimiento · A (estados: H)

| Atributo | Tipo | Restricciones | Por qué |
|----------|------|---------------|---------|
| id_tarea | SERIAL | PK | |
| id_empresa | INT | NOT NULL, FK → empresas | |
| id_evento | INT | NOT NULL, FK → eventos | |
| id_responsable | INT | FK → usuarios | Responsable interno (A) |
| descripcion | VARCHAR(200) | NOT NULL | |
| fecha_prevista | DATE | | |
| estado | VARCHAR(20) | NOT NULL, DEFAULT 'pendiente', CHECK (estado IN ('pendiente', 'en_curso', 'hecha')) | **H** |

"Vencida" no se guarda: es una tarea no hecha con `fecha_prevista` anterior a hoy (se calcula).

### 18. `cambios_evento` — registro de cambios relevantes · A + R [M, T]

Cambios de **fecha, sede, servicios o condiciones** que obligan a revisar los compromisos afectados; la
revisión la hace el personal, no el sistema [M, T].

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
| usuario — roles | 1 : N (valores fijos) | tabla `usuario_roles` |
| cliente — contactos | 1 : N | `contactos.id_cliente` |
| cliente — eventos | 1 : N | `eventos.id_cliente` |
| contacto — eventos | 1 : N (opcional) | `eventos.id_contacto` |
| cliente — cursos | 1 : N (opcional) | `cursos.id_cliente` |
| tipo de evento — eventos | 1 : N | `eventos.id_tipo_evento` |
| sede — eventos | 1 : N (opcional) | `eventos.id_sede` |
| evento — cursos | **N : M** | tabla `evento_cursos` |
| proveedor — servicios | **N : M** | tabla `proveedor_servicios` |
| evento — propuesta | 1 : 1 | `propuestas.id_evento` UNIQUE |
| propuesta — ítems | 1 : N | `propuesta_items.id_propuesta` |
| servicio — ítems de propuesta | 1 : N | `propuesta_items.id_servicio` |
| evento — servicios acordados | 1 : N | `evento_servicios.id_evento` |
| proveedor — servicios acordados | 1 : N (opcional) | `evento_servicios.id_proveedor` |
| usuario — servicios acordados (responsable) | 1 : N (opcional) | `evento_servicios.id_responsable` |
| evento — tareas | 1 : N | `tareas.id_evento` |
| usuario — tareas (responsable) | 1 : N | `tareas.id_responsable` |
| evento — cambios | 1 : N | `cambios_evento.id_evento` |
| usuario — cambios (quién registró) | 1 : N | `cambios_evento.id_usuario` |

## Cómo cubre el recorrido obligatorio

| Recorrido del alcance | Tablas |
|-----------------------|--------|
| Registrar una solicitud | clientes, contactos, eventos (estado `recibida`), evento_cursos |
| Elaborar una propuesta | propuestas (`en_preparacion` → `presentada`), propuesta_items, servicios |
| Registrar su aceptación | propuestas `aceptada` + `fecha_respuesta`; evento `confirmado` |
| Propuesta rechazada | propuestas `rechazada` (+ motivo si lo da); evento `no_aceptada` o se renegocia |
| Coordinar servicios y tareas | evento_servicios (proveedor o propio + responsable), proveedores, tareas, usuarios |
| Consultar pendientes | evento_servicios `pendiente`; tareas no hechas o vencidas; propuestas por vencer |
| Cambio relevante | cambios_evento |
| Cerrar o cancelar | eventos `realizado` (+ observaciones) / `cancelado` (+ motivo) |

## Reglas que valida la API (no la base)

- **No se cargan servicios acordados ni tareas** si el evento no está `confirmado` o posterior [M].
- Al aceptar la propuesta, el evento pasa a `confirmado` y se crean los `evento_servicios` desde los ítems [T].
- Una propuesta `presentada` pasa a `vencida` si pasaron `vigencia_dias` sin respuesta [T].

## Pendiente de confirmar (hipótesis)

- ¿Un **curso** puede ser cliente? ¿Se usan los **cursos** para organizar? (`cursos`, `evento_cursos`)
- Estados de las **tareas** y del **servicio propio**; estado `no_disponible` / reemplazo de proveedor.
- ¿El **descuento** es sobre el total o por ítem? ¿Hace falta guardar los **paquetes**?
- Detalles de la **cancelación** (quién decide, qué pasa con proveedores y tareas).
