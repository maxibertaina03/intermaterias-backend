import pool from "../../data/db.js";

// Error común para CUIT repetido (el controller no necesita saber qué base de datos se usa)
const traducirError = (error) => {
  if (error.code === "23505") {
    const duplicado = new Error("Ya existe una empresa con ese CUIT");
    duplicado.code = "DUPLICADO";
    return duplicado;
  }
  return error;
};

export const getAll = async () => {
  const resultado = await pool.query("SELECT * FROM empresas ORDER BY id_empresa");
  return resultado.rows;
};

export const getById = async (id) => {
  const resultado = await pool.query(
    "SELECT * FROM empresas WHERE id_empresa = $1",
    [id]
  );
  return resultado.rows[0] ?? null;
};

export const create = async ({ nombre, cuit, email, telefono, direccion }) => {
  try {
    const resultado = await pool.query(
      `INSERT INTO empresas (nombre, cuit, email, telefono, direccion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, cuit, email ?? null, telefono ?? null, direccion ?? null]
    );
    return resultado.rows[0];
  } catch (error) {
    throw traducirError(error);
  }
};

// Los campos que no vienen en el body conservan su valor actual (COALESCE)
export const update = async (id, { nombre, cuit, email, telefono, direccion, activo }) => {
  try {
    const resultado = await pool.query(
      `UPDATE empresas SET
         nombre = COALESCE($1, nombre),
         cuit = COALESCE($2, cuit),
         email = COALESCE($3, email),
         telefono = COALESCE($4, telefono),
         direccion = COALESCE($5, direccion),
         activo = COALESCE($6, activo)
       WHERE id_empresa = $7
       RETURNING *`,
      [nombre, cuit, email, telefono, direccion, activo, id]
    );
    return resultado.rows[0] ?? null;
  } catch (error) {
    throw traducirError(error);
  }
};

export const remove = async (id) => {
  const resultado = await pool.query(
    "DELETE FROM empresas WHERE id_empresa = $1",
    [id]
  );
  return resultado.rowCount > 0;
};
