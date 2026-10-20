// Crea (o actualiza) en Clerk las cuentas de los usuarios de ejemplo y las vincula con la base.
// Uso:   DEMO_PASSWORD='una-contraseña' npm run usuarios-demo
// En Docker: docker compose exec -e DEMO_PASSWORD='…' api1 npm run usuarios-demo
// Necesita CLERK_SECRET_KEY y los datos de la base en el .env. Se puede correr varias veces.
// La contraseña NUNCA va en el repo: se pasa al correrlo.
import "dotenv/config";
import { clerkClient } from "@clerk/express";
import pool from "../src/data/db.js";

const USUARIOS_DEMO = ["superadmin", "sofia", "mateo", "valentina", "joaquin"];
const password = process.env.DEMO_PASSWORD;

if (!process.env.CLERK_SECRET_KEY) {
  console.error("Falta CLERK_SECRET_KEY en el .env");
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error("Pasá la contraseña de los usuarios demo en DEMO_PASSWORD (mínimo 8 caracteres)");
  process.exit(1);
}

const buscarEnClerk = async (usuario) => {
  const lista = await clerkClient.users.getUserList({ username: [usuario] });
  return (Array.isArray(lista) ? lista : lista.data)[0] ?? null;
};

try {
  for (const usuario of USUARIOS_DEMO) {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.es_superadmin, e.nombre AS empresa
         FROM usuarios u LEFT JOIN empresas e ON e.id_empresa = u.id_empresa
        WHERE u.usuario = $1`,
      [usuario]
    );
    const fila = rows[0];
    if (!fila) {
      console.warn(`✗ ${usuario}: no está en la base (falta la migración 005 o schema.sql v5)`);
      continue;
    }

    const [nombre, ...resto] = fila.nombre.split(" ");
    let cuenta = await buscarEnClerk(usuario);
    if (cuenta) {
      cuenta = await clerkClient.users.updateUser(cuenta.id, { password });
    } else {
      cuenta = await clerkClient.users.createUser({
        username: usuario, password, firstName: nombre, lastName: resto.join(" ") || undefined,
      });
    }

    await pool.query("UPDATE usuarios SET clerk_user_id = $1, activo = TRUE WHERE id_usuario = $2", [cuenta.id, fila.id_usuario]);
    console.log(`✓ ${usuario.padEnd(10)} ${fila.es_superadmin ? "super admin" : fila.empresa}`);
  }
} catch (error) {
  console.error("Error:", error.errors?.[0]?.longMessage ?? error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
