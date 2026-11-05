import pool from "../../data/db.js";

// Autoregistro con prueba gratuita: crea la empresa, su administrador y catálogos de ejemplo,
// todo en una transacción (si algo falla, no queda nada a medias).

const ROLES_ADMIN = ["admin_empresa", "atencion_cliente", "responsable_propuesta", "responsable_organizacion", "integrante"];

// Catálogos de ejemplo para poder cargar una solicitud y armar una propuesta en el primer minuto
const TIPOS_EVENTO = ["Fiesta de bienvenida", "Fiesta de egresados", "Aniversario"];
const SERVICIOS = [
  ["Alquiler de salón", "Salón por la noche", 450000],
  ["Catering", "Snacks y bebidas sin alcohol, por persona", 6500],
  ["Sonido e iluminación", "Equipo de sonido, luces y DJ", 180000],
  ["Decoración", "Ambientación del salón según la temática", 90000],
  ["Fotografía", "Fotógrafo durante el evento", 120000],
];
const SEDE = ["Salón de ejemplo", "Editá o borrá esta sede", 200];

export const crearEmpresaDePrueba = async ({ empresa, nombre, email, usuario, clerk_user_id, dias }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [nueva] } = await client.query(
      `INSERT INTO empresas (nombre, email, fecha_fin_prueba)
       VALUES ($1, $2, CURRENT_DATE + $3::int)
       RETURNING id_empresa, nombre, fecha_fin_prueba`,
      [empresa, email ?? null, dias]
    );
    const { rows: [admin] } = await client.query(
      `INSERT INTO usuarios (id_empresa, nombre, email, usuario, clerk_user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
      [nueva.id_empresa, nombre, email ?? null, usuario, clerk_user_id]
    );
    await client.query(
      "INSERT INTO usuario_roles (id_usuario, rol) SELECT $1, unnest($2::varchar[])",
      [admin.id_usuario, ROLES_ADMIN]
    );
    await client.query(
      "INSERT INTO tipos_evento (id_empresa, nombre) SELECT $1, unnest($2::varchar[])",
      [nueva.id_empresa, TIPOS_EVENTO]
    );
    for (const [nombreServicio, descripcion, precio] of SERVICIOS) {
      await client.query(
        "INSERT INTO servicios (id_empresa, nombre, descripcion, precio_referencia) VALUES ($1, $2, $3, $4)",
        [nueva.id_empresa, nombreServicio, descripcion, precio]
      );
    }
    await client.query(
      "INSERT INTO sedes (id_empresa, nombre, direccion, capacidad) VALUES ($1, $2, $3, $4)",
      [nueva.id_empresa, ...SEDE]
    );
    await client.query("COMMIT");
    return nueva;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
