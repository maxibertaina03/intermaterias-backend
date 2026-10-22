import * as Invitados from "../models/postgres/invitados.model.js";
import { idValido, responderError } from "../lib/errores.js";

const MONTO_MAXIMO = 9999999999.99;
const montoValido = (valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0 && Number(valor) <= MONTO_MAXIMO;
const fechaValida = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export const crearOActualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  const body = req.body ?? {};
  if (!montoValido(body.precio_por_invitado)) {
    return res.status(400).json({ mensaje: "El precio por invitado debe ser un importe igual o mayor a cero" });
  }
  if (body.fecha_limite !== undefined && body.fecha_limite !== null && !fechaValida(body.fecha_limite)) {
    return res.status(400).json({ mensaje: "La fecha límite no es válida" });
  }
  if (body.activa !== undefined && typeof body.activa !== "boolean") {
    return res.status(400).json({ mensaje: "El campo 'activa' no es válido" });
  }
  try {
    const evento = await Invitados.getEvento(req.usuario.id_empresa, id);
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    if (!["confirmado", "en_preparacion"].includes(evento.estado)) {
      return res.status(409).json({ mensaje: "El evento tiene que estar confirmado o en preparación para generar una invitación" });
    }
    const invitacion = await Invitados.crearOActualizarInvitacion(req.usuario.id_empresa, id, {
      precio_por_invitado: Number(body.precio_por_invitado),
      fecha_limite: body.fecha_limite || null,
      activa: body.activa
    });
    if (!invitacion) {
      return res.status(409).json({ mensaje: "El evento no admite invitaciones en su estado actual" });
    }
    res.json(invitacion);
  } catch (error) {
    responderError(res, error, "Error al generar la invitación");
  }
};

export const listar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Evento no encontrado" });
  try {
    const evento = await Invitados.getEvento(req.usuario.id_empresa, id);
    if (!evento) return res.status(404).json({ mensaje: "Evento no encontrado" });
    res.json(await Invitados.getPorEvento(req.usuario.id_empresa, id));
  } catch (error) {
    responderError(res, error, "Error al obtener los invitados");
  }
};
