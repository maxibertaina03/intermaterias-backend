# Intermaterias — Backend

API v2 del sistema de eventos (multitenant) hecha con **Node.js + Express + PostgreSQL**. Incluye gestión de empresas y usuarios, el ciclo de eventos y la confirmación pública de invitados.

**Dominio:** una **empresa que organiza eventos para centros de estudiantes** (por ejemplo, la fiesta
de bienvenida): solicitud, propuesta, confirmación, proveedores, tareas y cierre. La base es
**multitenant**: cada empresa organizadora es una fila de `empresas`, y los centros de estudiantes
son sus **clientes** (tabla `clientes`).
Explicación completa del dominio: [00-dominio.md](https://github.com/maxibertaina03/intermaterias-infra/blob/develop/docs/si/00-dominio.md).
Tablas de la base: [database/entidades.md](database/entidades.md).

## Requisitos

- Node.js 20 o superior
- PostgreSQL (instalado o con Docker)

## Instalación

```bash
git clone https://github.com/maxibertaina03/intermaterias-backend.git
cd intermaterias-backend
npm install
cp .env.example .env     # completar con tus datos de PostgreSQL
```

### Base de datos

Completá los datos de conexión (`DB_HOST`, `DB_PASSWORD`, etc.) en tu `.env`. Los datos de la base compartida se pasan **por privado**; nunca los subas al repo. Para una instalación nueva, creá la base y ejecutá `database/schema.sql` (borra y vuelve a crear todas las tablas). Para actualizar una base existente, aplicá en orden las migraciones que le falten; las migraciones 005 y 006 llevan v4 a v6.

**Base local (opcional, para hacer pruebas sin tocar la compartida):** poné `DB_HOST=localhost` y
`DB_SSL=false` en el `.env`, y creá la base con alguna de estas opciones:

```bash
# Postgres instalado
createdb -U postgres eventos
psql -U postgres -d eventos -f database/empresas.sql

# o con Docker (crea la base y la tabla automáticamente)
docker compose up -d
```

### CORS

La API solo acepta peticiones del navegador que vengan de la URL del front, configurada en
`FRONTEND_URL` (por defecto `http://localhost:5173`). Si el front corre en otro puerto, cambialo en el `.env`.

## Ejecutar

```bash
npm run dev     # desarrollo, se reinicia al guardar
npm start       # producción
```

El servidor queda en `http://localhost:3000`.

## Guía de uso v2

### Login por empresa

El ingreso real se hace con **usuario y contraseña mediante Clerk**. Configurá `CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` en el backend, y `VITE_CLERK_PUBLISHABLE_KEY` en el front. No hay registro público: el super admin inicia sesión como `superadmin`, crea la empresa y da de alta a su primer administrador. Desde entonces, `admin_empresa` crea y administra las cuentas de su propio equipo en **Usuarios**. Cada persona usa el nombre de usuario que le asignaron; los datos y permisos quedan limitados a su empresa. Las contraseñas las administra Clerk y deben tener al menos 15 caracteres.

Para desarrollo local, si no configurás claves de Clerk, indicá en el backend `DEV_ID_USUARIO=1` (Sofía, administradora de Eventos del Centro). `DEV_ID_USUARIO=5` simula el super admin. El esquema de prueba incluye también los usuarios 2, 3 y 4. Con Clerk activo, `DEMO_PASSWORD='una-clave-de-15-caracteres-o-mas' npm run usuarios-demo` crea las cuentas de ejemplo.

### Invitados

Cuando el evento está confirmado o en preparación, el equipo puede crear o actualizar su invitación e indicar el precio por persona y, opcionalmente, una fecha límite. Compartí con el centro el link público que contiene el token. Cada invitado lo abre sin iniciar sesión e informa nombre, apellido y si asiste; si asiste, elige efectivo o transferencia y puede adjuntar el comprobante (PDF, JPG o PNG de hasta 5 MB). El equipo consulta las respuestas, descarga comprobantes y marca los pagos verificados desde el evento. Una invitación inactiva o vencida no acepta respuestas.

Los endpoints y cuerpos completos están en [ESTRUCTURA.md](ESTRUCTURA.md); el esquema y las reglas de cada tabla, en [database/entidades.md](database/entidades.md).

## Endpoints

La tabla siguiente resume las operaciones de empresas; los endpoints de usuarios e invitados están en [ESTRUCTURA.md](ESTRUCTURA.md).

| Método | Ruta | Acción | Respuesta |
|--------|------|--------|-----------|
| GET | `/api/empresas` | Listar todas las empresas | 200 |
| GET | `/api/empresas/:id` | Obtener una empresa | 200 / 404 |
| POST | `/api/empresas` | Crear una empresa (`nombre` y `cuit` obligatorios) | 201 / 400 / 409 |
| PUT | `/api/empresas/:id` | Editar una empresa | 200 / 404 / 409 |
| DELETE | `/api/empresas/:id` | Eliminar una empresa | 204 / 404 |

409 = ya existe una empresa con ese CUIT.

Ejemplo de body para POST / PUT:

```json
{
  "nombre": "Eventos del Centro",
  "cuit": "30-71234567-8",
  "email": "contacto@eventosdelcentro.com",
  "telefono": "351-4001122",
  "direccion": "Av. Colón 1200, Córdoba"
}
```

## Estructura

```
database/empresas.sql             → script de la tabla y datos de prueba
src/
├── index.js                      → crea el servidor y conecta todo
├── routes/empresas.routes.js     → QUÉ rutas existen
├── controllers/empresas.controller.js → QUÉ hace cada ruta
├── middlewares/validarEmpresa.js → validaciones antes del controller
├── models/
│   ├── index.js                  → elige la base de datos según DB_CLIENT
│   └── postgres/empresas.model.js → consultas SQL
└── data/db.js                    → conexión a PostgreSQL
```

### ¿Por qué la carpeta `models/`?

Los controllers nunca hacen consultas directamente: llaman a `Empresas.getAll()`, `Empresas.create()`, etc.
Así, cuando agreguemos **MongoDB**, solo hay que crear `src/models/mongo/empresas.model.js` con las mismas
funciones (`getAll`, `getById`, `create`, `update`, `remove`), registrarlo en `src/models/index.js`
y poner `DB_CLIENT=mongo` en el `.env`. Rutas y controllers no cambian.

## Modelo lógico

- Imagen: `database/modelo-logico.png` (generada desde `schema.sql`, así coincide siempre con el script).
- Fuente: `database/modelo-logico.dbml`. Para verlo o editarlo en dbdiagram.io, pegar ese archivo en el editor.
- Diagrama original del grupo: https://dbdiagram.io/d/6ad23077fe5cc8bda2d9dbd2

## Docker

Construir la imagen:

```bash
docker build -t intermaterias-api .
```

Correr el contenedor (necesita un archivo `.env` local con las variables de entorno):

```bash
docker run --rm -p 3000:3000 --env-file .env intermaterias-api
```

Probar:

```bash
curl -i localhost:3000/api/instancia
```

Devuelve `{ "instancia": "<id-del-contenedor>" }` y el header `X-Instancia`.

## Estructura para programar

Antes de agregar endpoints leé **[ESTRUCTURA.md](ESTRUCTURA.md)**: capas, multitenant con `req.usuario`, convenciones y **los endpoints de cada área**.

## Trabajo en grupo

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de ramas (`masita` / `facu` / `tomi` / `lucas` → `develop` → `main`).

### Agregar integrantes al repo (lo hace el dueño)

```bash
gh api -X PUT repos/maxibertaina03/intermaterias-backend/collaborators/USUARIO_GITHUB -f permission=push
```
## Documentar en infra

Conseguir la MONGO_URI (pedirla por privado).
Setear DB_CLIENT=mongo y MONGO_URI=... como variables de entorno en cada réplica.
Asegurarse de que la IP de cada réplica esté permitida en Atlas → Network Access.
Levantar las réplicas como siempre.
