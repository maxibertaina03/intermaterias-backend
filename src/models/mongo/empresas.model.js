import { getDb } from '../../data/mongo.js';

const NO_ID = { projection: { _id: 0 } };

function duplicado() {
  const e = new Error('Ya existe una empresa con ese CUIT');
  e.code = 'DUPLICADO';
  return e;
}

async function nextId(db) {
  const r = await db.collection('counters').findOneAndUpdate(
    { _id: 'empresas' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return r.seq; // mongodb v6+. En v5 sería r.value.seq
}

export async function getAll() {
  const db = await getDb();
  return db.collection('empresas').find({}, NO_ID).sort({ id_empresa: 1 }).toArray();
}

export async function getById(id) {
  const db = await getDb();
  return db.collection('empresas').findOne({ id_empresa: Number(id) }, NO_ID);
}

export async function create(data) {
  const db = await getDb();
  const id_empresa = await nextId(db);

  // Valores por defecto; lo que venga en el body los pisa
  const doc = {
    id_empresa,
    email: null,
    telefono: null,
    direccion: null,
    activo: true,
    ...data,
  };
  // Estos dos los controla el servidor, nunca el body
  doc.id_empresa = id_empresa;
  doc.fecha_creacion = new Date();

  try {
    await db.collection('empresas').insertOne({ ...doc });
  } catch (err) {
    if (err.code === 11000) throw duplicado();
    throw err;
  }
  return doc;
}

export async function update(id, data) {
  const db = await getDb();

  // No se puede cambiar el id_empresa (ni el _id interno de Mongo)
  const { id_empresa, _id, ...campos } = data ?? {};

  // $set vacío da error en Mongo: si no hay nada que cambiar, devolvemos la empresa tal cual
  if (Object.keys(campos).length === 0) return getById(id);

  try {
    return await db.collection('empresas').findOneAndUpdate(
      { id_empresa: Number(id) },
      { $set: campos },
      { returnDocument: 'after', ...NO_ID }
    ); // null si no existe
  } catch (err) {
    if (err.code === 11000) throw duplicado();
    throw err;
  }
}

export async function remove(id) {
  const db = await getDb();
  const r = await db.collection('empresas').deleteOne({ id_empresa: Number(id) });
  return r.deletedCount > 0;
}

export default { getAll, getById, create, update, remove };