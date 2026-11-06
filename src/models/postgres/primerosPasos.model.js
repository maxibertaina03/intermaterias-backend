import pool from "../../data/db.js";
import { PROVEEDOR_DE_EJEMPLO } from "./registro.model.js";

// Progreso de una empresa en sus primeros pasos: cada número > 0 es un paso hecho.
// Los proveedores de ejemplo que se cargan al registrarse no cuentan como propios.
export const getProgreso = async (id_empresa) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM proveedores p
         WHERE p.id_empresa = $1 AND p.observaciones IS DISTINCT FROM $2)::int AS proveedores,
       (SELECT COUNT(*) FROM usuarios u WHERE u.id_empresa = $1)::int AS usuarios,
       (SELECT COUNT(DISTINCT c.id_cliente) FROM clientes c JOIN contactos ct ON ct.id_cliente = c.id_cliente
         WHERE c.id_empresa = $1)::int AS clientes_con_contacto,
       (SELECT COUNT(*) FROM eventos e WHERE e.id_empresa = $1)::int AS eventos,
       (SELECT COUNT(*) FROM propuestas p WHERE p.id_empresa = $1 AND p.estado <> 'en_preparacion')::int AS propuestas_presentadas,
       (SELECT COUNT(*) FROM invitaciones i WHERE i.id_empresa = $1)::int AS invitaciones`,
    [id_empresa, PROVEEDOR_DE_EJEMPLO]
  );
  return rows[0];
};

// Solo cambia los campos que vienen
export const actualizarRecorrido = async (id_usuario, { recorrido_visto, primeros_pasos_cerrado }) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
        SET recorrido_visto = COALESCE($2, recorrido_visto),
            primeros_pasos_cerrado = COALESCE($3, primeros_pasos_cerrado)
      WHERE id_usuario = $1
      RETURNING recorrido_visto, primeros_pasos_cerrado`,
    [id_usuario, recorrido_visto ?? null, primeros_pasos_cerrado ?? null]
  );
  return rows[0];
};
