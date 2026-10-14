import dns from 'node:dns';
import { MongoClient } from 'mongodb';

// Fuerza DNS públicos: evita el error querySrv ECONNREFUSED
dns.setServers(['8.8.8.8', '1.1.1.1']);

let db;

export async function getDb() {
  if (db) return db;
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en el .env');

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db();

  // Índice único para que el duplicado dispare el error 11000
  await db.collection('empresas').createIndex({ nombre: 1 }, { unique: true });
  return db;
}