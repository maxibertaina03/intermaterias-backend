import * as Tareas from "../models/postgres/tareas.model.js";
import { idValido, responderError } from "../lib/errores.js";

const estados = ["pendiente", "en_curso", "hecha"];
const fechaValida = (fecha) =>
  fecha === null || fecha === "" ||
  (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(`${fecha}T00:00:00`)));

export const listar = async (req, res) => {
  const { evento } = req.query;
  if (evento && !idValido(evento)) return res.status(400).json({ mensaje: "Evento inválido" });
  try {
    res.json(await Tareas.getAll(req.usuario.id_empresa, evento ? Number(evento) : null));
  } catch (error) {
    responderError(res, error, "Error al obtener las tareas");
  }
};

const validarBody = (body, parcial = false) => {
  if (!body || typeof body !== "object") return "Los datos de la tarea no son válidos";
  if (!parcial && !idValido(body.id_evento)) return "El evento es obligatorio";
  if (body.descripcion !== undefined && (typeof body.descripcion !== "string" || !body.descripcion.trim() || body.descripcion.trim().length > 200)) {
    return "La descripción es obligatoria y debe tener hasta 200 caracteres";
  }
  if (body.fecha_prevista !== undefined && !fechaValida(body.fecha_prevista)) return "La fecha prevista no es válida";
  if (body.estado !== undefined && !estados.includes(body.estado)) return "El estado de la tarea no es válido";
  if (body.id_responsable !== undefined && body.id_responsable !== null && body.id_responsable !== "" && !idValido(body.id_responsable)) {
    return "El responsable no es válido";
  }
  return null;
};

const validarResponsable = async (empresa, id_responsable) => {
  if (id_responsable === undefined || id_responsable === null || id_responsable === "") return true;
  return Boolean(await Tareas.getUser(empresa, Number(id_responsable)));
};

export const crear = async (req, res) => {
  const errorValidacion = validarBody(req.body);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  try {
    const evento = await Tareas.getEvent(req.usuario.id_empresa, Number(req.body.id_evento));
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    if (!["confirmado", "en_preparacion"].includes(evento.estado)) {
      return res.status(409).json({ mensaje: "Solo se pueden cargar tareas en eventos confirmados o en preparación" });
    }
    if (!await validarResponsable(req.usuario.id_empresa, req.body.id_responsable)) {
      return res.status(404).json({ mensaje: "Responsable no encontrado" });
    }
    const tarea = await Tareas.create(req.usuario.id_empresa, {
      ...req.body,
      id_evento: Number(req.body.id_evento),
      id_responsable: req.body.id_responsable ? Number(req.body.id_responsable) : null,
      descripcion: req.body.descripcion.trim(),
      fecha_prevista: req.body.fecha_prevista || null
    });
    if (!tarea) return res.status(409).json({ mensaje: "El evento ya no permite cargar tareas" });
    res.status(201).json(tarea);
  } catch (error) {
    responderError(res, error, "Error al crear la tarea");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Tarea no encontrada" });
  const errorValidacion = validarBody(req.body, true);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  if (!Object.keys(req.body ?? {}).length) return res.status(400).json({ mensaje: "Indicá los datos a actualizar" });
  try {
    if (!await validarResponsable(req.usuario.id_empresa, req.body.id_responsable)) {
      return res.status(404).json({ mensaje: "Responsable no encontrado" });
    }
    const tarea = await Tareas.update(req.usuario.id_empresa, id, {
      ...req.body,
      descripcion: req.body.descripcion?.trim(),
      fecha_prevista: req.body.fecha_prevista === "" ? null : req.body.fecha_prevista,
      id_responsable: req.body.id_responsable === "" ? null :
        req.body.id_responsable === undefined || req.body.id_responsable === null ? req.body.id_responsable : Number(req.body.id_responsable)
    });
    if (!tarea) return res.status(404).json({ mensaje: "Tarea no encontrada o evento no editable" });
    res.json(tarea);
  } catch (error) {
    responderError(res, error, "Error al editar la tarea");
  }
};

export const eliminar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Tarea no encontrada" });
  try {
    const eliminada = await Tareas.remove(req.usuario.id_empresa, id);
    if (!eliminada) return res.status(404).json({ mensaje: "Tarea no encontrada o evento no editable" });
    res.status(204).send();
  } catch (error) {
    responderError(res, error, "Error al eliminar la tarea");
  }
};
