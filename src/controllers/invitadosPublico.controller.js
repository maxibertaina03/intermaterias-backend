import * as Invitados from "../models/postgres/invitados.model.js";
import { responderError } from "../lib/errores.js";

const texto = (v) => (typeof v === "string" ? v.trim() : "");
const esBooleano = (v) => v === true || v === false || v === "true" || v === "false";
const aBooleano = (v) => v === true || v === "true";

const buscarInvitacionVigente = async (token) => {
  const invitacion = await Invitados.buscarPorToken(token);
  if (!invitacion) return { error: [404, "El link de invitación no existe"] };
  if (!invitacion.activa || invitacion.vencida) return { error: [410, "El link de invitación ya no está disponible"] };
  return { invitacion };
};

export const obtener = async (req, res) => {
  try {
    const invitacion = await Invitados.buscarPorToken(req.params.token);
    if (!invitacion) return res.status(404).json({ mensaje: "El link de invitación no existe" });
    if (!invitacion.activa || invitacion.vencida) {
      return res.status(410).json({ mensaje: "El link de invitación ya no está disponible" });
    }
    const { evento, fecha, hora_inicio, sede, precio_por_invitado, fecha_limite } = invitacion;
    res.json({ evento, fecha, hora_inicio, sede, precio_por_invitado, fecha_limite });
  } catch (error) {
    responderError(res, error, "Error al obtener la invitación");
  }
};

export const responder = async (req, res) => {
  const body = req.body ?? {};
  const nombre = texto(body.nombre);
  const apellido = texto(body.apellido);
  if (!nombre || nombre.length > 100) return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  if (!apellido || apellido.length > 100) return res.status(400).json({ mensaje: "El apellido es obligatorio" });
  if (!esBooleano(body.asiste)) return res.status(400).json({ mensaje: "Indicá si asiste o no" });
  const asiste = aBooleano(body.asiste);
  let medio_pago = null;
  if (asiste && body.medio_pago !== undefined && body.medio_pago !== "") {
    if (!["efectivo", "transferencia"].includes(body.medio_pago)) {
      return res.status(400).json({ mensaje: "El medio de pago tiene que ser efectivo o transferencia" });
    }
    medio_pago = body.medio_pago;
  }

  try {
    const { invitacion, error } = await buscarInvitacionVigente(req.params.token);
    if (error) return res.status(error[0]).json({ mensaje: error[1] });
    const invitado = await Invitados.crearInvitado(
      invitacion.id_invitacion,
      { nombre, apellido, asiste, medio_pago },
      req.file
    );
    res.status(201).json(invitado);
  } catch (error) {
    responderError(res, error, "Error al registrar la respuesta");
  }
};
