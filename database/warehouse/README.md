# Data warehouse · Venta de eventos

Base de datos analítica del sistema de eventos, armada siguiendo los 6 pasos de la consigna.

📄 **Guía para estudiar** (con conceptos, el SQL explicado, resultados y preguntas del profe): [Guia-Data-Warehouse.pdf](Guia-Data-Warehouse.pdf)

| Archivo | Paso | Se corre en |
|---|---|---|
| `00-crear-base.sql` | Crea la base `eventos_dw` | `eventos` (una vez) |
| `01-esquema.sql` | 3. Tablas de dimensiones y de hechos (y la conexión con la operativa) | `eventos_dw` |
| `02-carga.sql` | 4 y 6. Procedimiento `cargar_dw()`: carga dimensiones y después hechos | `eventos_dw` |
| `03-verificacion.sql` | 5. Totales del DW contra la base operativa | `eventos_dw` |
| `04-consultas.sql` | 5. Las 4 preguntas de negocio, guardadas como vistas `pregunta_1_…` a `pregunta_4_…` | `eventos_dw` |
| `datos-de-prueba.sql` | Opcional: 6 meses de trabajo de "Eventos del Centro" (~95 solicitudes) | `eventos` |
| `borrar-datos-de-prueba.sql` | Saca esos datos de prueba | `eventos` |

## Dos bases en el mismo servidor

```
                 servidor PostgreSQL (contenedor postgres)
  ┌───────────────────────────────┐        ┌──────────────────────────────────┐
  │ eventos  (base operativa)     │        │ eventos_dw  (data warehouse)     │
  │                               │        │                                  │
  │ empresas, clientes, eventos,  │◄───────│ esquema operativa: las mismas    │
  │ propuestas, propuesta_items…  │  fdw   │ tablas, vistas desde acá         │
  │                               │        │          │ INSERT … SELECT       │
  │ (la usa el sistema)           │        │          ▼                       │
  │                               │        │ dim_* y fact_ventas              │
  └───────────────────────────────┘        └──────────────────────────────────┘
```

- **`eventos`** es la base **operativa**: la que usa el sistema todos los días. Está normalizada y
  guarda el estado actual.
- **`eventos_dw`** es el **data warehouse**: solo para análisis, con un modelo estrella.
- PostgreSQL no deja escribir una consulta que lea de otra base. Por eso se usa la extensión
  **`postgres_fdw`** (*foreign data wrapper*, viene con PostgreSQL): en `eventos_dw` crea el esquema
  `operativa` con las tablas de `eventos` como **tablas foráneas**. No son copias: cada vez que se
  consultan, PostgreSQL las lee de la otra base. Así la migración es un `INSERT` común:

  ```sql
  INSERT INTO dim_cliente (id_cliente, nombre, tipo, institucion)
  SELECT id_cliente, nombre, … FROM operativa.clientes;
  ```

## Paso 1 · Proceso de negocio y preguntas

**Proceso elegido: la venta de eventos.** La organizadora recibe el pedido de un centro de
estudiantes y le presenta una **propuesta** con los **servicios** cotizados (salón, catering,
sonido…), cada uno con su cantidad y precio. El centro la acepta (venta) o la rechaza, con un motivo.

El DW tiene que responder:

1. **¿Cuánto se vende por mes y por tipo de evento?**
2. **¿Qué porcentaje de las propuestas se acepta, según el tipo de evento?**
3. **¿Por qué se pierden las propuestas y cuánta plata representa cada motivo?**
4. **¿Qué servicios se venden más cada año?**

## Paso 2 · Grano, dimensiones y medidas

**Grano: una fila por cada servicio cotizado en una propuesta** (cada fila de `propuesta_items`).

Se eligió el ítem y no la propuesta entera porque la pregunta 4 pregunta por servicios: con una
fila por propuesta no se podría saber qué servicio se vendió. Con este grano igual se responden las
otras: para contar propuestas se usa `COUNT(DISTINCT id_propuesta)`.

**Dimensiones** (desde dónde se miran las ventas):

| Dimensión | Responde | Atributos |
|---|---|---|
| `dim_tiempo` | ¿cuándo? (fecha del evento) | año, trimestre, mes, nombre del mes, año-mes, día de la semana, temporada escolar |
| `dim_tipo_evento` | ¿qué evento? | egresados, bienvenida, aniversario… |
| `dim_servicio` | ¿qué se vendió? | nombre, precio de referencia |
| `dim_cliente` | ¿a quién? | centro, tipo de cliente, institución |
| `dim_estado_propuesta` | ¿cómo terminó? | estado y resultado: *Abierta*, *Ganada* o *Perdida* |
| `dim_empresa` | ¿qué organizadora? | nombre (el sistema es multiempresa) |

**Medidas** (lo que se suma o promedia):

| Medida | Qué es |
|---|---|
| `cantidad` | unidades del servicio (por ejemplo, personas del catering) |
| `precio_unitario` | precio cobrado por unidad |
| `importe` | `cantidad × precio_unitario` |
| `importe_neto` | el importe menos su parte del descuento de la propuesta (ver abajo) |
| `es_aceptada` | 1 si la propuesta se aceptó, 0 si no: sumarla cuenta ventas |

**Dimensiones degeneradas**: `id_propuesta` y `motivo_rechazo` quedan en el hecho sin tabla propia.
`id_propuesta` sirve para contar propuestas, y el motivo es un texto que no tiene otros atributos.

**El descuento.** En la operativa el descuento es de la propuesta entera, no de cada ítem. Para que
las ventas sumen bien, la carga lo reparte entre los ítems en proporción a su importe:
`importe_neto = importe × total con descuento / subtotal`. Así, sumando el `importe_neto` de los
ítems de una propuesta se obtiene exactamente su total (el paso 5 lo comprueba).

## Paso 3 · Tablas (modelo estrella)

```
                         dim_tiempo
                              │
     dim_cliente ──┐          │          ┌── dim_servicio
                   ├──── fact_ventas ────┤
  dim_tipo_evento ─┘          │          └── dim_estado_propuesta
                              │
                         dim_empresa
```

- Cada dimensión tiene una **clave sustituta** propia del DW (`sk_*`, numérica) y guarda la clave de
  la operativa (`id_*`) para poder cruzarlas en la carga.
- `dim_tiempo` usa como clave la fecha en formato `AAAAMMDD` (`20261113`): se lee fácil y ordena bien.
- `fact_ventas` tiene una FK a cada dimensión y las medidas. Es lo único que crece.

## Paso 4 · Carga (primero dimensiones, después hechos)

`CALL cargar_dw();` hace, en este orden:

1. **Vacía** el DW: primero el hecho y después las dimensiones, porque el hecho apunta a ellas.
2. **Carga las dimensiones** con `INSERT … SELECT` desde `operativa.*`, traduciendo códigos a textos
   (`centro_estudiantes` → *Centro de estudiantes*). `dim_tiempo` se genera con un día por cada
   fecha entre el primer y el último evento, y `dim_estado_propuesta` lleva los 5 estados fijos.
3. **Carga el hecho**: un `INSERT … SELECT` que recorre los ítems de propuesta y hace un `JOIN` con
   cada dimensión para cambiar las claves de la operativa (`id_*`) por las del DW (`sk_*`).

Las dimensiones van primero porque el hecho guarda sus claves: si no existieran todavía, no habría
a qué apuntar (y las FK lo impedirían).

## Paso 5 · Verificación y respuestas

`03-verificacion.sql` calcula lo mismo en la operativa y en el DW, y marca ✅ si coincide:

| Control | Qué demuestra |
|---|---|
| Ítems de propuestas = filas del hecho | no se perdió ni se duplicó ninguna fila |
| Propuestas con ítems / propuestas aceptadas | los JOIN con las dimensiones no dejaron afuera nada |
| Importe cotizado | los importes se copiaron bien |
| Total vendido con descuento | el reparto del descuento es correcto |
| Unidades vendidas | las cantidades se copiaron bien |
| Clientes y servicios | las dimensiones están completas |

Además lista las propuestas cuyo total no coincide (tiene que salir vacía).

`04-consultas.sql` responde las 4 preguntas del paso 1. Cada una queda guardada como una **vista**
con su nombre (`pregunta_1_ventas_por_mes`, `pregunta_2_aceptacion`, `pregunta_3_motivos_de_perdida`,
`pregunta_4_servicios_mas_vendidos`): después de cada `CALL cargar_dw();` ya muestran los datos nuevos,
y en pgAdmin se abren con *View/Edit Data*.

| Pregunta | Cómo |
|---|---|
| 1. Ventas por mes y tipo de evento | `GROUP BY ROLLUP`: suma por mes y tipo, con subtotal por mes y total general |
| 2. Porcentaje de aceptación | aceptadas ÷ propuestas con resultado, por año y tipo de evento |
| 3. Motivos de pérdida | propuestas perdidas por motivo, con su importe y porcentaje (`SUM() OVER ()`) |
| 4. Servicios más vendidos | ranking por año con `RANK() OVER (PARTITION BY anio …)` |

## Paso 6 · Procedimiento almacenado

Toda la carga está en el procedimiento **`cargar_dw()`** (PL/pgSQL). Se puede repetir cuantas
veces haga falta (por ejemplo, todas las noches): cada vez vacía el DW y lo vuelve a armar con los
datos actuales. Todo corre en una transacción, así que si algo falla el DW queda como estaba.

## Cómo correrlo (demo local)

Con el sistema levantado (`intermaterias-infra`, `docker compose up -d`). Si Docker dice
*Cannot connect to the Docker daemon*, antes: `docker context use default`.

```bash
cd ~/Escritorio/Intermaterias/intermaterias-infra
DW=../intermaterias-backend/database/warehouse
psql_en() { docker compose exec -T postgres psql -U postgres -d "$1"; }

# Una vez: crear la base, las tablas y el procedimiento
psql_en eventos    < $DW/00-crear-base.sql
psql_en eventos_dw < $DW/01-esquema.sql
psql_en eventos_dw < $DW/02-carga.sql

# Opcional: 6 meses de trabajo de "Eventos del Centro" en la operativa
psql_en eventos    < $DW/datos-de-prueba.sql

# Cargar, verificar y responder
echo "CALL cargar_dw();" | psql_en eventos_dw
psql_en eventos_dw < $DW/03-verificacion.sql
psql_en eventos_dw < $DW/04-consultas.sql
```

Para explorar a mano: `docker compose exec postgres psql -U postgres eventos_dw` y, adentro,
`\dt` (tablas del DW), `\det operativa.*` (tablas foráneas) o cualquier consulta.

**Con pgAdmin (visual).** En `intermaterias-infra`: `docker compose --profile herramientas up -d pgadmin`
y abrir http://localhost:5050 (entra directo, la conexión ya está configurada). En el árbol:
*Intermaterias → PostgreSQL del proyecto → Databases → eventos_dw → Schemas → public* están las
**Tables** (dimensiones y hecho), las **Views** (una por pregunta) y **Procedures** (`cargar_dw`).
Para cargar: clic derecho en `eventos_dw` → *Query Tool* → `CALL cargar_dw();` → ▶.
Para el diagrama del modelo estrella: clic derecho en `eventos_dw` → *ERD For Database*.

## Datos de prueba

`datos-de-prueba.sql` simula **6 meses de trabajo** de "Eventos del Centro" (la empresa con la que
se entra al sistema con `sofia`, `masita`, etc.), con fechas relativas al día en que se corre:

- 16 centros de estudiantes nuevos, con su contacto (a algunos les cambió la presidencia).
- ~95 solicitudes: egresados de octubre a diciembre, bienvenidas en marzo y abril, aniversarios en
  cualquier momento. Las más nuevas todavía esperan respuesta.
- Propuestas aceptadas, rechazadas (con motivo) y vencidas; ~30 % con descuento; precios con
  inflación de ~2,5 % por mes.
- Servicios asignados a proveedores (o al equipo propio), tareas del equipo, cambios pedidos por
  los centros e invitados con su medio de pago.

Se ve tanto en el sistema como en el DW (después de `CALL cargar_dw();`). Siempre genera lo mismo,
no se carga dos veces y `borrar-datos-de-prueba.sql` lo saca.

