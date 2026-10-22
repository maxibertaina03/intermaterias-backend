# Estructura del backend (guía para el grupo)

Seguimos las capas que dio el profe: **routes → controllers → models → base de datos**.
Ejemplo de referencia: `empresas` (`routes/`, `controllers/`, `models/postgres/`).

## Carpetas

```
src/
├── index.js                      → monta TODAS las rutas (ya están: no hace falta tocarlo)
├── routes/<area>.routes.js       → QUÉ rutas existen (+ middlewares de validación y roles)
├── controllers/<area>.controller.js → QUÉ hace cada ruta: valida, llama al model, responde
├── models/postgres/<area>.model.js  → las consultas SQL (siempre con parámetros $1, $2…)
├── middlewares/
│   ├── usuarioActual.js          → deja req.usuario (quién es y de qué empresa)
│   └── requireRol.js             → corta si no tiene el rol
├── lib/errores.js                → responderError (traduce errores de Postgres) e idValido
└── data/db.js                    → conexión a PostgreSQL
```

Las tablas nuevas van **solo en Postgres**: los models se importan directo de `models/postgres/`
(el modelo de Mongo cubre únicamente `empresas`, para la demo de Sistemas Operativos).

## El usuario y el multitenant (lo más importante)

Toda ruta bajo `/api` (salvo `instancia` y las públicas de `/api/publico`) pasa por `usuarioActual`, que deja:

```js
req.usuario = { id_usuario: 1, id_empresa: 1, empresa: "Eventos del Centro", nombre: "Sofía Pereyra", usuario: "sofia",
                es_superadmin: false, roles: ["admin_empresa", "atencion_cliente", "responsable_propuesta"] }
```

Después, `requireEmpresa` corta a quien no tiene empresa: el **super admin** solo usa `/api/me` y `/api/empresas`.
Tu código no cambia: en tus rutas siempre hay un `req.usuario.id_empresa`.

**Regla de oro:** toda consulta de datos de una empresa filtra por `req.usuario.id_empresa`, y todo
INSERT lo pone. Nunca se toma el `id_empresa` del body ni de la URL. Así una organizadora jamás ve datos de otra.

**Dos modos de login** (no cambia nada en tu código):
- **Sin claves de Clerk** en el `.env` → modo desarrollo: `DEV_ID_USUARIO=1` (Sofía, de *Eventos del Centro*, administradora).
  Otros: `2` = Mateo (organización), `3` = Valentina (integrante), `4` = Joaquín (*Fiestas Norte*), `5` = super admin.
- **Con `CLERK_SECRET_KEY` y `CLERK_PUBLISHABLE_KEY`** → login real con **usuario y contraseña**. Solo entra quien
  tiene su usuario dado de alta: lo crea el administrador de su empresa (o el super admin, el primero de cada empresa).
  Usuarios de ejemplo en Clerk: `DEMO_PASSWORD='…' npm run usuarios-demo` (`superadmin`, `sofia`, `mateo`, `valentina`, `joaquin`).

## Ejemplo completo (un listado y un alta con multitenant)

`models/postgres/sedes.model.js`
```js
import pool from "../../data/db.js";

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    "SELECT * FROM sedes WHERE id_empresa = $1 ORDER BY nombre", [id_empresa]);
  return rows;
};

export const create = async (id_empresa, { nombre, direccion, capacidad }) => {
  const { rows } = await pool.query(
    `INSERT INTO sedes (id_empresa, nombre, direccion, capacidad)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id_empresa, nombre, direccion ?? null, capacidad ?? null]);
  return rows[0];
};
```

`controllers/sedes.controller.js`
```js
import * as Sedes from "../models/postgres/sedes.model.js";
import { responderError } from "../lib/errores.js";

export const listar = async (req, res) => {
  try {
    res.json(await Sedes.getAll(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener las sedes");
  }
};

export const crear = async (req, res) => {
  if (!req.body?.nombre?.trim()) return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  try {
    res.status(201).json(await Sedes.create(req.usuario.id_empresa, req.body));
  } catch (error) {
    responderError(res, error, "Error al crear la sede");
  }
};
```

`routes/sedes.routes.js`
```js
import { Router } from "express";
import { listar, crear } from "../controllers/sedes.controller.js";

const router = Router();
router.get("/", listar);
router.post("/", crear);
export default router;
```

Para buscar **uno** por id, filtrá por los dos: `WHERE id_sede = $1 AND id_empresa = $2`. Si no existe
(o es de otra empresa) → **404**.

## Convenciones

| Tema | Regla |
|------|-------|
| Respuestas | `200` ok · `201` creado (devolver el registro con `RETURNING *`) · `204` eliminado · `400` datos inválidos · `403` sin permiso · `404` no existe · `409` conflicto (repetido o con datos relacionados) |
| Errores | `{ "mensaje": "texto para mostrar al usuario" }`. En el `catch`, usar `responderError(res, error, "…")` |
| Ids de la URL | Validar con `idValido(id)`; si no es válido → 404 |
| Opcionales | Si no vienen en el body, guardar `null` |
| Estados | Solo los valores acordados (ver `database/entidades.md` y el lenguaje ubicuo). Las **transiciones** (aceptar, rechazar, cancelar…) son endpoints propios, no un PUT del estado |
| Roles | `requireRol(...)` en las rutas que modifican, según quién hace cada cosa en la empresa |
| Nombres | Archivos en camelCase; rutas en minúscula con guiones (`/servicios-acordados`); términos del lenguaje ubicuo |

## Endpoints por área

Todos bajo `/api`. Los nombres de campos son los de `database/entidades.md`.

### Lucas · Clientes y solicitudes/eventos
| Método y ruta | Qué hace |
|---|---|
| `GET/POST /clientes` · `GET/PUT/DELETE /clientes/:id` | CRUD de clientes |
| `GET/POST /clientes/:id/contactos` · `PUT /clientes/:id/contactos/:idContacto` | Contactos del cliente (marcar `vigente`) |
| `GET /eventos?estado=&desde=&hasta=&cliente=` | Listado con filtros (por fecha y estado, lo pide el alcance) |
| `POST /eventos` | Nueva solicitud (estado `recibida`) |
| `GET /eventos/:id` | Detalle (con cliente, contacto, tipo y sede) |
| `PUT /eventos/:id` | Editar. Si cambia **fecha, sede o cantidad** de un evento confirmado → registrar en `cambios_evento` |
| `GET /eventos/:id/cambios` | Historial de cambios |
| `PATCH /eventos/:id/estado` | `falta_informacion`, `en_preparacion`, `realizado` (con observaciones) |
| `POST /eventos/:id/cancelar` | Cancelar con **motivo obligatorio** |

### Tomi · Propuestas, tareas y pendientes
| Método y ruta | Qué hace |
|---|---|
| `GET /propuestas?estado=` | Listado (marcar las **vencidas**: presentadas hace más de `vigencia_dias`) |
| `GET /propuestas/evento/:idEvento` | La propuesta vigente de un evento |
| `POST /propuestas` · `PUT /propuestas/:id` | Crear / editar (descuento, condiciones) |
| `POST/PUT/DELETE /propuestas/:id/items[/:idItem]` | Ítems (servicio, cantidad, precio). El **total** se calcula |
| `POST /propuestas/:id/presentar` | → `presentada` (guarda `fecha_presentacion`); el evento pasa a `propuesta_enviada` |
| `POST /propuestas/:id/aceptar` | → `aceptada`; evento → `confirmado`; **crea los servicios acordados** desde los ítems |
| `POST /propuestas/:id/rechazar` | → `rechazada` (motivo opcional). Se puede volver a presentar (renegociar) |
| `GET/POST /tareas?evento=` · `PUT/DELETE /tareas/:id` | Tareas (solo en eventos confirmados o en preparación) |
| `GET /pendientes` | Servicios acordados `pendiente`, tareas **vencidas** o próximas, propuestas por vencer |

### Facu · Catálogos y coordinación
| Método y ruta | Qué hace |
|---|---|
| `GET/POST /servicios` · `PUT/DELETE /servicios/:id` | Catálogo de servicios |
| `GET/POST /proveedores` · `PUT/DELETE /proveedores/:id` | Proveedores |
| `PUT /proveedores/:id/servicios` | Qué servicios ofrece (lista de ids) |
| `GET/POST /sedes` · `PUT/DELETE /sedes/:id` | Sedes |
| `GET/POST /tipos-evento` · `PUT/DELETE /tipos-evento/:id` | Tipos de evento |
| `GET /servicios-acordados?evento=` | Servicios acordados de un evento |
| `PUT /servicios-acordados/:id` | Asignar proveedor **o** marcar como propio, responsable, observaciones |
| `POST /servicios-acordados/:id/confirmar` | → `confirmado` (contactado ≠ confirmado) |

Para `PUT /proveedores/:id/servicios`, el body es `{ "id_servicios": [1, 2] }`; enviar una lista vacía quita las asociaciones. El `GET /proveedores` y `GET /proveedores/:id` devuelven esos ids en `id_servicios`. Los cuerpos de servicios y proveedores usan los campos de sus tablas en `database/entidades.md`; `activo` es opcional y comienza en `true`.

`GET /servicios-acordados?evento=ID` filtra por evento (sin el filtro devuelve los de la organizadora). `PUT /servicios-acordados/:id` acepta `es_propio`, `id_proveedor`, `id_responsable` y `observaciones`; los campos pueden actualizarse parcialmente. Un servicio propio no lleva proveedor. Cambiar el tipo de cumplimiento o el proveedor devuelve el estado a `pendiente`. La confirmación requiere que el evento esté confirmado o en preparación y, si el servicio es externo, que tenga asignado un proveedor activo que ofrezca ese servicio. Las rutas que modifican catálogos requieren `atencion_cliente`, `responsable_propuesta` o `responsable_organizacion`; las que modifican coordinación requieren `responsable_organizacion` o `integrante`.

### masita · Login y usuarios
| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /me` | todos | Datos del usuario logueado (`req.usuario`, ver arriba) |
| `GET /usuarios` | `admin_empresa` | Usuarios de mi empresa: `[{ id_usuario, nombre, email, usuario, activo, roles: [...] }]` |
| `GET /usuarios/:id` | `admin_empresa` | Uno |
| `POST /usuarios` | `admin_empresa` | Alta: `{ nombre, apellido?, email?, usuario, password, roles: [...] }` → 201 con el usuario. Crea la cuenta en Clerk |
| `PUT /usuarios/:id` | `admin_empresa` | Cambia lo que venga: `{ nombre?, email?, activo?, roles? }` (los roles se reemplazan todos) |
| `GET/POST/PUT/DELETE /empresas[/:id]` | super admin | CRUD de empresas |
| `POST /empresas/:id/admin` | super admin | Primer administrador: `{ nombre, apellido?, usuario, password, roles? }` (por defecto, todos los roles) |

Reglas de `/usuarios`: el usuario tiene 4 a 64 letras, números, `-` o `_` y no se repite (409 "Ese nombre de usuario ya existe");
la contraseña, **15 caracteres o más** (lo exige Clerk, que además rechaza las filtradas; los mensajes llegan en castellano); al menos un rol de
`admin_empresa`, `atencion_cliente`, `responsable_propuesta`, `responsable_organizacion`, `integrante`. Un administrador no puede
desactivarse ni quitarse `admin_empresa` (409). Un usuario desactivado no puede volver a entrar.

## Reglas del negocio que valida la API

Del relevamiento (`intermaterias-infra/docs/si/03-dominio.md`):
- No se cargan **servicios acordados ni tareas** si el evento no está `confirmado` o `en_preparacion`.
- **Una sola propuesta** por evento.
- Al **aceptar**: el evento pasa a `confirmado` y se crean los servicios acordados.
- Un **cancelado** necesita motivo; un servicio **propio** no tiene proveedor.
- Los **cambios relevantes** de un evento confirmado se registran en `cambios_evento`.
