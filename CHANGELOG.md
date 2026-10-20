# Changelog: API (intermaterias-backend)

Todos los cambios importantes de la API quedan registrados acá.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen
[Versionado Semántico](https://semver.org/lang/es/). Las reglas del grupo están en
`intermaterias-infra/docs/versiones.md`.

## [Sin publicar]

### Agregado
- **Cada empresa con sus usuarios**: el administrador de la empresa (rol `admin_empresa`) da de alta a su equipo con usuario, contraseña y roles (`/api/usuarios`).
- **Super admin**: administra las empresas y crea el primer administrador de cada una (`POST /api/empresas/:id/admin`); no ve los datos de ninguna empresa.
- Usuarios de ejemplo en Clerk con `npm run usuarios-demo`.
- Base de datos v5 (migración `005-multiempresa.sql`).

### Cambiado
- **Ya no se crean cuentas solas**: quien entra con una cuenta de Clerk sin alta recibe "No tenés acceso". Los usuarios de una empresa desactivada tampoco entran.
- `/api/empresas` requiere iniciar sesión como super admin (antes era pública).

## [1.0.0] - en preparación

Primera versión completa: el recorrido de un evento, desde la solicitud hasta el cierre, con login.

### Agregado
- **Login con Clerk** por usuario y contraseña; el front manda el token y la API identifica a la persona (`usuarioActual`).
  Sin claves de Clerk funciona en modo desarrollo con `DEV_ID_USUARIO`.
- **Roles** (`atencion_cliente`, `responsable_propuesta`, `responsable_organizacion`, `integrante`) controlados con `requireRol`, y `GET /api/me`.
- **Multitenant**: toda consulta filtra por la empresa del usuario (`id_empresa`).
- **Clientes y contactos**: CRUD de centros de estudiantes con un contacto vigente.
- **Solicitudes y eventos**: alta, listado con filtros (estado, fechas, cliente), edición, estados (`falta_informacion`, `en_preparacion`, `realizado`), cancelación con motivo obligatorio e historial de cambios relevantes (`cambios_evento`).
- **Propuestas**: una por evento, con ítems, descuento y condiciones; presentar, aceptar (crea los servicios acordados y confirma el evento) y rechazar; vencimiento a los 15 días.
- **Tareas** con responsable y fecha prevista, y **pendientes** (servicios sin confirmar, tareas vencidas o próximas, propuestas por vencer).
- **Catálogos**: servicios, proveedores (con los servicios que ofrece cada uno), sedes y tipos de evento.
- **Servicios acordados**: asignar proveedor o marcarlo como propio, responsable y confirmación.
- **Base de datos** v4: `database/schema.sql` (18 tablas, 2 empresas de ejemplo), migraciones en `database/migraciones/`, DER y modelo lógico.
- **Docker**: `Dockerfile` y `GET /api/instancia`, que indica qué réplica respondió y la versión.
- `DB_CLIENT=mongo` para usar MongoDB Atlas en la tabla de empresas (demo de Sistemas Operativos).

### Corregido
- Un evento en `falta_informacion` quedaba trabado: ahora se puede presentar su propuesta (#39).
- Error 500 al cambiar el estado de un evento (tipo de parámetro ambiguo en la consulta).
- La exportación del DER había quedado en blanco (#36).

## [0.1.0] - 2026-10-06

### Agregado
- CRUD de empresas conectado a PostgreSQL en Neon.
- CORS limitado al front (`FRONTEND_URL`).

[Sin publicar]: https://github.com/maxibertaina03/intermaterias-backend/compare/v1.0.0...develop
[1.0.0]: https://github.com/maxibertaina03/intermaterias-backend/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/maxibertaina03/intermaterias-backend/releases/tag/v0.1.0
