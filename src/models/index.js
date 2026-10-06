// Elige qué base de datos usar según DB_CLIENT en el .env.
// Todas las implementaciones exponen las mismas funciones:
// getAll, getById, create, update, remove
import * as empresasPostgres from "./postgres/empresas.model.js";

const cliente = process.env.DB_CLIENT || "postgres";

const modelos = {
  postgres: { empresas: empresasPostgres }
  // mongo: { empresas: empresasMongo }  → cuando se implemente MongoDB
};

if (!modelos[cliente]) {
  throw new Error(`DB_CLIENT "${cliente}" no está implementado todavía`);
}

export const Empresas = modelos[cliente].empresas;
