# Changelog: API (intermaterias-backend)

Todos los cambios importantes de la API quedan registrados acá.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen
[Versionado Semántico](https://semver.org/lang/es/). Las reglas del grupo están en
`intermaterias-infra/docs/versiones.md`.

## [Sin publicar]

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
- Un evento realizado o con la propuesta no aceptada ya no se puede cancelar, y uno realizado o cancelado ya no se puede editar (#37).
- El modelo lógico (`modelo-logico.png`) ahora coincide con la base v4: `usuarios.clerk_user_id` y `email` opcional; se suma `modelo-logico.dbml` (#38).
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
