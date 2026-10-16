// Sedes y tipos de evento (catálogos simples de cada organizadora)
import * as Sedes from "../models/postgres/sedes.model.js";
import * as TiposEvento from "../models/postgres/tiposEvento.model.js";
import { idValido, responderError } from "../lib/errores.js";

const texto = (v) => (typeof v === "string" ? v.trim() : v);
const EN_USO = "No se puede eliminar: está usado en eventos";

// ── Sedes ──────────────────────────────────────────────────────────
const validarSede = (b, parcial = false) => {
  if (!b || typeof b !== "object") return "Datos inválidos";
  if (!parcial || b.nombre !== undefined) {
    if (!texto(b.nombre)) return "El nombre es obligatorio";
    if (texto(b.nombre).length > 150) return "El nombre puede tener hasta 150 caracteres";
  }
  if (b.capacidad !== undefined && b.capacidad !== null && b.capacidad !== "" &&
      !(Number.isInteger(Number(b.capacidad)) && Number(b.capacidad) > 0)) {
    return "La capacidad tiene que ser un número mayor a cero";
  }
  return null;
};
const datosSede = (b) => ({
  nombre: b.nombre === undefined ? undefined : texto(b.nombre),
  direccion: b.direccion === undefined ? undefined : texto(b.direccion) || null,
  capacidad: b.capacidad === undefined ? undefined : b.capacidad === "" || b.capacidad === null ? null : Number(b.capacidad),
});

export const listarSedes = async (req, res) => {
  try { res.json(await Sedes.getAll(req.usuario.id_empresa)); }
  catch (e) { responderError(res, e, "Error al obtener las sedes"); }
};

export const obtenerSede = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Sede no encontrada" });
  try {
    const sede = await Sedes.getById(req.usuario.id_empresa, req.params.id);
    if (!sede) return res.status(404).json({ mensaje: "Sede no encontrada" });
    res.json(sede);
  } catch (e) { responderError(res, e, "Error al obtener la sede"); }
};

export const crearSede = async (req, res) => {
  const error = validarSede(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try { res.status(201).json(await Sedes.create(req.usuario.id_empresa, datosSede(req.body))); }
  catch (e) { responderError(res, e, "Error al crear la sede"); }
};

export const actualizarSede = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Sede no encontrada" });
  const error = validarSede(req.body ?? {}, true);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const sede = await Sedes.update(req.usuario.id_empresa, req.params.id, datosSede(req.body ?? {}));
    if (!sede) return res.status(404).json({ mensaje: "Sede no encontrada" });
    res.json(sede);
  } catch (e) { responderError(res, e, "Error al editar la sede"); }
};

export const eliminarSede = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Sede no encontrada" });
  try {
    if (!(await Sedes.remove(req.usuario.id_empresa, req.params.id))) return res.status(404).json({ mensaje: "Sede no encontrada" });
    res.status(204).send();
  } catch (e) {
    if (e.code === "23503") return res.status(409).json({ mensaje: EN_USO });
    responderError(res, e, "Error al eliminar la sede");
  }
};

// ── Tipos de evento ────────────────────────────────────────────────
const validarTipo = (b) => {
  if (!texto(b?.nombre)) return "El nombre es obligatorio";
  if (texto(b.nombre).length > 80) return "El nombre puede tener hasta 80 caracteres";
  return null;
};
const REPETIDO = "Ya existe un tipo de evento con ese nombre";

export const listarTipos = async (req, res) => {
  try { res.json(await TiposEvento.getAll(req.usuario.id_empresa)); }
  catch (e) { responderError(res, e, "Error al obtener los tipos de evento"); }
};

export const crearTipo = async (req, res) => {
  const error = validarTipo(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try { res.status(201).json(await TiposEvento.create(req.usuario.id_empresa, texto(req.body.nombre))); }
  catch (e) {
    if (e.code === "23505") return res.status(409).json({ mensaje: REPETIDO });
    responderError(res, e, "Error al crear el tipo de evento");
  }
};

export const actualizarTipo = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
  const error = validarTipo(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const tipo = await TiposEvento.update(req.usuario.id_empresa, req.params.id, texto(req.body.nombre));
    if (!tipo) return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
    res.json(tipo);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ mensaje: REPETIDO });
    responderError(res, e, "Error al editar el tipo de evento");
  }
};

export const eliminarTipo = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
  try {
    if (!(await TiposEvento.remove(req.usuario.id_empresa, req.params.id))) return res.status(404).json({ mensaje: "Tipo de evento no encontrado" });
    res.status(204).send();
  } catch (e) {
    if (e.code === "23503") return res.status(409).json({ mensaje: EN_USO });
    responderError(res, e, "Error al eliminar el tipo de evento");
  }
};
