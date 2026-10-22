import pg from "pg";

// Las columnas DATE (fecha del evento, fecha límite, fecha prevista…) se devuelven como texto "AAAA-MM-DD".
// Si no, pg las convierte a medianoche en la zona horaria del servidor: en Docker (UTC) el front de
// Argentina las mostraba un día antes.
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Neon (base en la nube) exige conexión segura; en una base local va DB_SSL=false
  ssl: process.env.DB_SSL === "true"
});

export default pool;
