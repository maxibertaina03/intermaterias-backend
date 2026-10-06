# Intermaterias — Backend

API del sistema de eventos (multitenant) hecha con **Node.js + Express + PostgreSQL**.
Por ahora tiene el CRUD de `empresas`.

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

La base del grupo está en **[Neon](https://neon.tech)** (PostgreSQL en la nube), así que todos usamos
la misma, con la tabla `empresas` ya creada. Los datos de conexión (`DB_HOST`, `DB_PASSWORD`, etc.)
se pasan **por privado**: completalos en tu `.env` con `DB_SSL=true`. Nunca los subas al repo.

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

## Endpoints

Todas bajo `/api/empresas`:

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

## Trabajo en grupo

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de ramas (`masita` / `facu` / `tomi` / `lucas` → `develop` → `main`).

### Agregar integrantes al repo (lo hace el dueño)

```bash
gh api -X PUT repos/maxibertaina03/intermaterias-backend/collaborators/USUARIO_GITHUB -f permission=push
```
