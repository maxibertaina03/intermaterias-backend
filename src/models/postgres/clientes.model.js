import pool from "../../data/db.js";

// Cliente con su contacto vigente y la cantidad de eventos
const SELECT_CLIENTE = `
  SELECT c.*,
         ct.id_contacto AS id_contacto_vigente,
         ct.nombre AS contacto_nombre,
         ct.telefono AS contacto_telefono,
         ct.email AS contacto_email,
         (SELECT count(*)::int FROM eventos e WHERE e.id_cliente = c.id_cliente) AS cantidad_eventos
    FROM clientes c
    LEFT JOIN LATERAL (
      SELECT * FROM contactos x WHERE x.id_cliente = c.id_cliente AND x.vigente
      ORDER BY x.id_contacto DESC LIMIT 1
    ) ct ON TRUE`;

export const getAll = async (id_empresa, { q, activo } = {}) => {
  const { rows } = await pool.query(
    `${SELECT_CLIENTE}
      WHERE c.id_empresa = $1
        AND ($2::text IS NULL OR c.nombre ILIKE '%' || $2 || '%')
        AND ($3::boolean IS NULL OR c.activo = $3)
      ORDER BY c.nombre`,
    [id_empresa, q ?? null, activo ?? null]
  );
  return rows;
};

export const getById = async (id_empresa, id_cliente) => {
  const { rows } = await pool.query(
    `${SELECT_CLIENTE} WHERE c.id_empresa = $1 AND c.id_cliente = $2`,
    [id_empresa, id_cliente]
  );
  if (!rows[0]) return null;
  const [contactos, eventos] = await Promise.all([
    getContactos(id_empresa, id_cliente),
    pool.query(
      `SELECT e.id_evento, e.nombre, e.fecha, e.estado, t.nombre AS tipo_evento
         FROM eventos e JOIN tipos_evento t ON t.id_tipo_evento = e.id_tipo_evento
        WHERE e.id_empresa = $1 AND e.id_cliente = $2
        ORDER BY e.fecha DESC`,
      [id_empresa, id_cliente]
    ),
  ]);
  return { ...rows[0], contactos, eventos: eventos.rows };
};

export const create = async (id_empresa, { nombre, tipo, institucion }) => {
  const { rows } = await pool.query(
    `INSERT INTO clientes (id_empresa, nombre, tipo, institucion)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id_empresa, nombre, tipo, institucion ?? null]
  );
  return rows[0];
};

// Los campos que no vienen conservan su valor
export const update = async (id_empresa, id_cliente, { nombre, tipo, institucion, activo }) => {
  const { rows } = await pool.query(
    `UPDATE clientes SET
       nombre = COALESCE($1, nombre),
       tipo = COALESCE($2, tipo),
       institucion = CASE WHEN $3::boolean THEN $4 ELSE institucion END,
       activo = COALESCE($5, activo)
     WHERE id_cliente = $6 AND id_empresa = $7
     RETURNING *`,
    [nombre ?? null, tipo ?? null, institucion !== undefined, institucion ?? null, activo ?? null, id_cliente, id_empresa]
  );
  return rows[0] ?? null;
};

// Borra el cliente y sus contactos. Si tiene eventos, la base lo impide (FK) → 409.
export const remove = async (id_empresa, id_cliente) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount: existe } = await client.query(
      "SELECT 1 FROM clientes WHERE id_cliente = $1 AND id_empresa = $2", [id_cliente, id_empresa]);
    if (!existe) { await client.query("ROLLBACK"); return false; }
    await client.query("DELETE FROM contactos WHERE id_cliente = $1", [id_cliente]);
    await client.query("DELETE FROM clientes WHERE id_cliente = $1 AND id_empresa = $2", [id_cliente, id_empresa]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ── Contactos ──────────────────────────────────────────────────────
export const getContactos = async (id_empresa, id_cliente) => {
  const { rows } = await pool.query(
    `SELECT ct.* FROM contactos ct
       JOIN clientes c ON c.id_cliente = ct.id_cliente
      WHERE c.id_empresa = $1 AND ct.id_cliente = $2
      ORDER BY ct.vigente DESC, ct.id_contacto DESC`,
    [id_empresa, id_cliente]
  );
  return rows;
};

// Un solo contacto vigente por cliente: al marcar uno, los demás dejan de serlo.
const desmarcarOtros = (client, id_cliente, id_contacto) =>
  client.query(
    "UPDATE contactos SET vigente = FALSE WHERE id_cliente = $1 AND id_contacto <> $2 AND vigente",
    [id_cliente, id_contacto]
  );

export const createContacto = async (id_empresa, id_cliente, { nombre, telefono, email, rol, vigente = true }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO contactos (id_cliente, nombre, telefono, email, rol, vigente)
       SELECT c.id_cliente, $3, $4, $5, $6, $7
         FROM clientes c WHERE c.id_cliente = $2 AND c.id_empresa = $1
       RETURNING *`,
      [id_empresa, id_cliente, nombre, telefono ?? null, email ?? null, rol ?? null, vigente]
    );
    if (rows[0]?.vigente) await desmarcarOtros(client, id_cliente, rows[0].id_contacto);
    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateContacto = async (id_empresa, id_cliente, id_contacto, datos) => {
  const has = (k) => datos[k] !== undefined;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE contactos ct SET
         nombre = CASE WHEN $1::boolean THEN $2 ELSE ct.nombre END,
         telefono = CASE WHEN $3::boolean THEN $4 ELSE ct.telefono END,
         email = CASE WHEN $5::boolean THEN $6 ELSE ct.email END,
         rol = CASE WHEN $7::boolean THEN $8 ELSE ct.rol END,
         vigente = CASE WHEN $9::boolean THEN $10 ELSE ct.vigente END
        FROM clientes c
       WHERE ct.id_contacto = $11 AND ct.id_cliente = $12
         AND c.id_cliente = ct.id_cliente AND c.id_empresa = $13
       RETURNING ct.*`,
      [has("nombre"), datos.nombre ?? null, has("telefono"), datos.telefono ?? null,
       has("email"), datos.email ?? null, has("rol"), datos.rol ?? null,
       has("vigente"), datos.vigente ?? null, id_contacto, id_cliente, id_empresa]
    );
    if (rows[0]?.vigente) await desmarcarOtros(client, id_cliente, id_contacto);
    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
