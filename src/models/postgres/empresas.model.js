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

// Los campos que no vienen en el body conservan su valor actual (COALESCE).
// fecha_fin_prueba: si viene, se guarda tal cual (null = quitar el límite de la prueba gratuita).
export const update = async (id, { nombre, cuit, email, telefono, direccion, activo, fecha_fin_prueba }) => {
  try {
    const resultado = await pool.query(
      `UPDATE empresas SET
         nombre = COALESCE($1, nombre),
         cuit = COALESCE($2, cuit),
         email = COALESCE($3, email),
         telefono = COALESCE($4, telefono),
         direccion = COALESCE($5, direccion),
         activo = COALESCE($6, activo),
         fecha_fin_prueba = CASE WHEN $8::boolean THEN $9::date ELSE fecha_fin_prueba END
       WHERE id_empresa = $7
       RETURNING *`,
      [nombre, cuit, email, telefono, direccion, activo, id, fecha_fin_prueba !== undefined, fecha_fin_prueba ?? null]
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
