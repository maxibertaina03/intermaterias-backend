import * as Eventos from "../models/postgres/eventos.model.js";
import { idValido, responderError } from "../lib/errores.js";

const ESTADOS = [
  "recibida", "falta_informacion", "propuesta_enviada", "confirmado",
  "en_preparacion", "realizado", "no_aceptada", "cancelado",
];
const texto = (v) => (typeof v === "string" ? v.trim() : v);
const enteroPositivo = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const fechaValida = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const horaValida = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v);

const validarEvento = (body, parcial = false) => {
  if (!body || typeof body !== "object") return "Datos inválidos";
  if (!parcial || body.id_cliente !== undefined) {
    if (!enteroPositivo(body.id_cliente)) return "El cliente es obligatorio";
  }
  if (!parcial || body.id_tipo_evento !== undefined) {
    if (!enteroPositivo(body.id_tipo_evento)) return "El tipo de evento es obligatorio";
  }
  if (body.id_sede !== undefined && body.id_sede !== null && !enteroPositivo(body.id_sede)) {
    return "La sede no es válida";
  }
  if (body.id_contacto !== undefined && body.id_contacto !== null && !enteroPositivo(body.id_contacto)) {
    return "El contacto no es válido";
  }
  if (!parcial || body.nombre !== undefined) {
    if (!texto(body.nombre)) return "El nombre es obligatorio";
    if (texto(body.nombre).length > 150) return "El nombre puede tener hasta 150 caracteres";
  }
  if (!parcial || body.fecha !== undefined) {
    if (!fechaValida(body.fecha)) return "La fecha no es válida";
  }
  if (body.hora_inicio !== undefined && body.hora_inicio !== null && !horaValida(body.hora_inicio)) {
    return "La hora no es válida (HH:MM)";
  }
  if (!parcial || body.cantidad_estimada !== undefined) {
    if (!enteroPositivo(body.cantidad_estimada)) return "La cantidad estimada debe ser mayor a cero";
  }
  if (body.necesidades !== undefined && body.necesidades !== null && typeof body.necesidades !== "string") {
    return "Las necesidades no son válidas";
  }
  return null;
};

export const listar = async (req, res) => {
  const { estado, desde, hasta, cliente } = req.query;
  if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ mensaje: "Estado inválido" });
  if (desde && !fechaValida(desde)) return res.status(400).json({ mensaje: "La fecha 'desde' no es válida" });
  if (hasta && !fechaValida(hasta)) return res.status(400).json({ mensaje: "La fecha 'hasta' no es válida" });
  if (cliente && !enteroPositivo(cliente)) return res.status(400).json({ mensaje: "El cliente no es válido" });
  try {
    res.json(await Eventos.getAll(req.usuario.id_empresa, {
      estado: estado ?? null, desde: desde ?? null, hasta: hasta ?? null,
      cliente: cliente ? Number(cliente) : null,
    }));
  } catch (error) {
    responderError(res, error, "Error al obtener los eventos");
  }
};

export const obtener = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  try {
    const evento = await Eventos.getById(req.usuario.id_empresa, id);
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    res.json(evento);
  } catch (error) {
    responderError(res, error, "Error al obtener el evento");
  }
};

export const crear = async (req, res) => {
  const error = validarEvento(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const evento = await Eventos.create(req.usuario.id_empresa, {
      ...req.body,
      id_cliente: Number(req.body.id_cliente),
      id_tipo_evento: Number(req.body.id_tipo_evento),
      id_sede: req.body.id_sede ? Number(req.body.id_sede) : null,
      id_contacto: req.body.id_contacto ? Number(req.body.id_contacto) : null,
      nombre: texto(req.body.nombre),
      cantidad_estimada: Number(req.body.cantidad_estimada),
      necesidades: texto(req.body.necesidades) || null,
    });
    if (!evento) {
      return res.status(400).json({ mensaje: "Revisá el cliente, el contacto, el tipo de evento o la sede" });
    }
    res.status(201).json(evento);
  } catch (error) {
    responderError(res, error, "Error al crear la solicitud");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  const error = validarEvento(req.body ?? {}, true);
  if (error) return res.status(400).json({ mensaje: error });
  const b = req.body ?? {};
  try {
    const datos = {
      id_cliente: undefined, // el cliente de un evento no se reasigna por acá
      id_contacto: b.id_contacto !== undefined ? (b.id_contacto ? Number(b.id_contacto) : null) : undefined,
      id_tipo_evento: b.id_tipo_evento !== undefined ? Number(b.id_tipo_evento) : undefined,
      id_sede: b.id_sede !== undefined ? (b.id_sede ? Number(b.id_sede) : null) : undefined,
      nombre: b.nombre !== undefined ? texto(b.nombre) : undefined,
      fecha: b.fecha !== undefined ? b.fecha : undefined,
      hora_inicio: b.hora_inicio !== undefined ? (b.hora_inicio || null) : undefined,
      cantidad_estimada: b.cantidad_estimada !== undefined ? Number(b.cantidad_estimada) : undefined,
      necesidades: b.necesidades !== undefined ? (texto(b.necesidades) || null) : undefined,
    };
    const resultado = await Eventos.update(req.usuario.id_empresa, id, datos, req.usuario.id_usuario);
    if (resultado.resultado === "no_encontrado") return res.status(404).json({ mensaje: "Evento no encontrado" });
    if (resultado.resultado === "cerrado") {
      return res.status(409).json({ mensaje: "Un evento realizado o cancelado ya no se puede editar" });
    }
    if (resultado.resultado === "datos_invalidos") {
      return res.status(400).json({ mensaje: "Revisá el contacto, el tipo de evento o la sede" });
    }
    res.json(resultado.evento);
  } catch (error) {
    responderError(res, error, "Error al editar el evento");
  }
};

export const obtenerCambios = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  try {
    const evento = await Eventos.getById(req.usuario.id_empresa, id);
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    res.json(await Eventos.getCambios(req.usuario.id_empresa, id));
  } catch (error) {
    responderError(res, error, "Error al obtener los cambios del evento");
  }
};

export const cambiarEstado = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  const estado = req.body?.estado;
  const permitidos = ["falta_informacion", "en_preparacion", "realizado"];
  if (!permitidos.includes(estado)) {
    return res.status(400).json({ mensaje: "Estado inválido. Usá falta_informacion, en_preparacion o realizado" });
  }
  const observaciones = req.body?.observaciones_cierre;
  if (observaciones !== undefined && observaciones !== null && typeof observaciones !== "string") {
    return res.status(400).json({ mensaje: "Las observaciones de cierre no son válidas" });
  }
  try {
    const resultado = await Eventos.cambiarEstado(req.usuario.id_empresa, id, estado, texto(observaciones) || null);
    if (resultado === "no_encontrado") return res.status(404).json({ mensaje: "Evento no encontrado" });
    if (resultado === "transicion_invalida") {
      return res.status(409).json({ mensaje: "El evento no puede pasar a ese estado desde el estado actual" });
    }
    res.json({ mensaje: "Estado del evento actualizado" });
  } catch (error) {
    responderError(res, error, "Error al cambiar el estado del evento");
  }
};

export const cancelar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  const motivo = texto(req.body?.motivo);
  if (!motivo) return res.status(400).json({ mensaje: "El motivo de la cancelación es obligatorio" });
  try {
    const evento = await Eventos.cancelar(req.usuario.id_empresa, id, motivo);
    if (!evento) {
      const estadoActual = await Eventos.getEstado(req.usuario.id_empresa, id);
      if (!estadoActual) return res.status(404).json({ mensaje: "Evento no encontrado" });
      const mensajes = {
        cancelado: "El evento ya estaba cancelado",
        realizado: "Un evento realizado no se puede cancelar",
        no_aceptada: "La propuesta no fue aceptada: el evento no está en curso",
      };
      return res.status(409).json({ mensaje: mensajes[estadoActual] ?? "El evento no se puede cancelar" });
    }
    res.json(evento);
  } catch (error) {
    responderError(res, error, "Error al cancelar el evento");
  }
};
