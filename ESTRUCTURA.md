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

Toda ruta bajo `/api` (salvo `empresas` e `instancia`) pasa por `usuarioActual`, que deja:

```js
req.usuario = { id_usuario: 1, id_empresa: 1, nombre: "Sofía Pereyra", email: "…", roles: ["atencion_cliente", "responsable_propuesta"] }
```

**Regla de oro:** toda consulta de datos de una empresa filtra por `req.usuario.id_empresa`, y todo
INSERT lo pone. Nunca se toma el `id_empresa` del body ni de la URL. Así una organizadora jamás ve datos de otra.

**Mientras no está el login:** en tu `.env` poné `DEV_ID_USUARIO=1` (Sofía, de *Eventos del Centro*). Para
probar otros roles: `2` = Mateo (organización), `3` = Valentina (integrante). Cuando masita termine el login
con Clerk, esto se reemplaza solo: **no cambia nada en tu código**.

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

### masita · Login
| Método y ruta | Qué hace |
|---|---|
| `GET /me` | Datos del usuario logueado y sus roles (ya existe) |
| Middleware `usuarioActual` | Pasar de `DEV_ID_USUARIO` a Clerk |

## Reglas del negocio que valida la API

Del relevamiento (`intermaterias-infra/docs/si/03-dominio.md`):
- No se cargan **servicios acordados ni tareas** si el evento no está `confirmado` o `en_preparacion`.
- **Una sola propuesta** por evento.
- Al **aceptar**: el evento pasa a `confirmado` y se crean los servicios acordados.
- Un **cancelado** necesita motivo; un servicio **propio** no tiene proveedor.
- Los **cambios relevantes** de un evento confirmado se registran en `cambios_evento`.
