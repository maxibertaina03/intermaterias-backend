import * as Invitados from "../models/postgres/invitados.model.js";
import { idValido, responderError } from "../lib/errores.js";

export const verificar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Invitado no encontrado" });
  try {
    const invitado = await Invitados.getInvitado(req.usuario.id_empresa, id);
    if (!invitado) return res.status(404).json({ mensaje: "Invitado no encontrado" });
    if (!invitado.asiste) return res.status(409).json({ mensaje: "El invitado no asiste: no hay un pago que verificar" });
    if (invitado.pago_verificado) return res.json({ mensaje: "El pago ya estaba verificado" });
    await Invitados.verificarPago(req.usuario.id_empresa, id);
    res.json({ mensaje: "Pago verificado" });
  } catch (error) {
    responderError(res, error, "Error al verificar el pago");
  }
};

export const descargarComprobante = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Invitado no encontrado" });
  try {
    const comprobante = await Invitados.getComprobante(req.usuario.id_empresa, id);
    if (!comprobante || !comprobante.comprobante) {
      return res.status(404).json({ mensaje: "El invitado no tiene un comprobante" });
    }
    const nombre = (comprobante.comprobante_nombre || "comprobante").replace(/[^\w.\- ]/g, "_");
    res.setHeader("Content-Type", comprobante.comprobante_tipo || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.send(comprobante.comprobante);
  } catch (error) {
    responderError(res, error, "Error al descargar el comprobante");
  }
};
