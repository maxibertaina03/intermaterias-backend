import pg from "pg";

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
