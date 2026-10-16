import * as Propuestas from "../models/postgres/propuestas.model.js";
import { idValido, responderError } from "../lib/errores.js";

const enteroPositivo = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const MONTO_MAXIMO = 9999999999.99;
const montoValido = (valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0 && Number(valor) <= MONTO_MAXIMO;

const responderEstadoPropuesta = (res, resultado) => {
  const mensajes = {
    no_encontrada: [404, "Propuesta no encontrada"],
    vencida: [409, "La propuesta venció y no puede cambiar de estado"],
    transicion_invalida: [409, "La propuesta no permite esta acción en su estado actual"],
    sin_items: [400, "Agregá al menos un servicio antes de continuar"],
    evento_invalido: [409, "El evento no permite presentar esta propuesta"]
  };
  if (resultado.estado === "ok") return res.json({ mensaje: "Estado de la propuesta actualizado" });
  const [status, mensaje] = mensajes[resultado.estado] ?? [500, "No se pudo cambiar el estado de la propuesta"];
  return res.status(status).json({ mensaje });
};

export const listar = async (req, res) => {
  const { estado } = req.query;
  const estados = ["en_preparacion", "presentada", "aceptada", "rechazada", "vencida"];
  if (estado && !estados.includes(estado)) return res.status(400).json({ mensaje: "Estado de propuesta inválido" });
  try {
    res.json(await Propuestas.getAll(req.usuario.id_empresa, estado));
  } catch (error) {
    responderError(res, error, "Error al obtener las propuestas");
  }
};

export const obtenerPorEvento = async (req, res) => {
  const { idEvento } = req.params;
  if (!idValido(idEvento)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  try {
    const propuesta = await Propuestas.getByEvent(req.usuario.id_empresa, idEvento);
    if (!propuesta) return res.status(404).json({ mensaje: "El evento todavía no tiene una propuesta" });
    res.json(propuesta);
  } catch (error) {
    responderError(res, error, "Error al obtener la propuesta");
  }
};

export const crear = async (req, res) => {
  const id_evento = req.body?.id_evento;
  if (!enteroPositivo(id_evento)) return res.status(400).json({ mensaje: "El evento es obligatorio" });
  try {
    const evento = await Propuestas.getEvent(req.usuario.id_empresa, id_evento);
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    const propuesta = await Propuestas.create(req.usuario.id_empresa, id_evento);
    if (!propuesta) return res.status(404).json({ mensaje: "Evento no encontrado" });
    res.status(201).json(propuesta);
  } catch (error) {
    responderError(res, error, "Error al crear la propuesta");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Propuesta no encontrada" });
  const body = req.body ?? {};
  if (body.descuento !== undefined && !montoValido(body.descuento)) {
    return res.status(400).json({ mensaje: "El descuento debe ser un importe igual o mayor a cero" });
  }
  if (body.condiciones !== undefined && body.condiciones !== null && typeof body.condiciones !== "string") {
    return res.status(400).json({ mensaje: "Las condiciones no son válidas" });
  }
  if (body.descuento === undefined && body.condiciones === undefined) {
    return res.status(400).json({ mensaje: "Indicá el descuento o las condiciones a actualizar" });
  }
  try {
    const propuesta = await Propuestas.update(req.usuario.id_empresa, id, {
      descuento: body.descuento === undefined ? undefined : Number(body.descuento),
      condiciones: body.condiciones === undefined ? undefined : body.condiciones?.trim() || null
    });
    if (!propuesta) {
      const existente = await Propuestas.getById(req.usuario.id_empresa, id);
      return existente
        ? res.status(409).json({ mensaje: "La propuesta no se puede editar en su estado actual" })
        : res.status(404).json({ mensaje: "Propuesta no encontrada" });
    }
    res.json(propuesta);
  } catch (error) {
    responderError(res, error, "Error al editar la propuesta");
  }
};

const validarItem = (body, parcial = false) => {
  if (!body || typeof body !== "object") return "El ítem no es válido";
  if (!parcial || body.id_servicio !== undefined) {
    if (!enteroPositivo(body.id_servicio)) return "Seleccioná un servicio válido";
  }
  if (!parcial || body.cantidad !== undefined) {
    if (!Number.isInteger(Number(body.cantidad)) || Number(body.cantidad) <= 0 || Number(body.cantidad) > 2147483647) {
      return "La cantidad debe ser mayor a cero";
    }
  }
  if (body.precio_unitario !== undefined && !montoValido(body.precio_unitario)) {
    return "El precio debe ser un importe igual o mayor a cero";
  }
  if (body.descripcion !== undefined && body.descripcion !== null &&
    (typeof body.descripcion !== "string" || body.descripcion.length > 200)) {
    return "La descripción debe tener hasta 200 caracteres";
  }
  return null;
};

export const agregarItem = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Propuesta no encontrada" });
  const errorValidacion = validarItem(req.body);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  try {
    const item = await Propuestas.createItem(req.usuario.id_empresa, id, {
      ...req.body,
      id_servicio: Number(req.body.id_servicio),
      cantidad: Number(req.body.cantidad),
      precio_unitario: req.body.precio_unitario === undefined ? null : Number(req.body.precio_unitario),
      descripcion: req.body.descripcion?.trim() || null
    });
    if (!item) return res.status(404).json({ mensaje: "Propuesta o servicio no encontrado, o propuesta no editable" });
    res.status(201).json(item);
  } catch (error) {
    responderError(res, error, "Error al agregar el servicio a la propuesta");
  }
};

export const actualizarItem = async (req, res) => {
  const { id, idItem } = req.params;
  if (!idValido(id) || !idValido(idItem)) return res.status(404).json({ mensaje: "Ítem no encontrado" });
  const errorValidacion = validarItem(req.body, true);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  if (!Object.keys(req.body ?? {}).length) return res.status(400).json({ mensaje: "Indicá los datos a actualizar" });
  try {
    const item = await Propuestas.updateItem(req.usuario.id_empresa, id, idItem, {
      ...req.body,
      id_servicio: req.body.id_servicio === undefined ? undefined : Number(req.body.id_servicio),
      cantidad: req.body.cantidad === undefined ? undefined : Number(req.body.cantidad),
      precio_unitario: req.body.precio_unitario === undefined ? undefined : Number(req.body.precio_unitario),
      descripcion: req.body.descripcion === undefined ? undefined : req.body.descripcion?.trim() || null
    });
    if (!item) {
      const existente = await Propuestas.getById(req.usuario.id_empresa, id);
      return existente && !["en_preparacion", "rechazada", "vencida"].includes(existente.estado)
        ? res.status(409).json({ mensaje: "La propuesta no se puede editar en su estado actual" })
        : res.status(404).json({ mensaje: "Ítem o propuesta no encontrado" });
    }
    res.json(item);
  } catch (error) {
    responderError(res, error, "Error al editar el servicio de la propuesta");
  }
};

export const eliminarItem = async (req, res) => {
  const { id, idItem } = req.params;
  if (!idValido(id) || !idValido(idItem)) return res.status(404).json({ mensaje: "Ítem no encontrado" });
  try {
    const eliminado = await Propuestas.removeItem(req.usuario.id_empresa, id, idItem);
    if (!eliminado) return res.status(404).json({ mensaje: "Ítem o propuesta no encontrado, o propuesta no editable" });
    res.status(204).send();
  } catch (error) {
    responderError(res, error, "Error al quitar el servicio de la propuesta");
  }
};

const ejecutarTransicion = async (req, res, accion) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Propuesta no encontrada" });
  const motivo = req.body?.motivo;
  if (accion === "rechazar" && motivo !== undefined && motivo !== null && typeof motivo !== "string") {
    return res.status(400).json({ mensaje: "El motivo de rechazo no es válido" });
  }
  try {
    const resultado = await Propuestas[accion](req.usuario.id_empresa, id, motivo?.trim() || null);
    return responderEstadoPropuesta(res, resultado);
  } catch (error) {
    return responderError(res, error, "Error al cambiar el estado de la propuesta");
  }
};

export const presentar = (req, res) => ejecutarTransicion(req, res, "presentar");
export const aceptar = (req, res) => ejecutarTransicion(req, res, "aceptar");
export const rechazar = (req, res) => ejecutarTransicion(req, res, "rechazar");
