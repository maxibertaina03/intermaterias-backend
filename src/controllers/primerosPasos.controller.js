import * as PrimerosPasos from "../models/postgres/primerosPasos.model.js";
import { responderError } from "../lib/errores.js";

// GET /api/primeros-pasos → cuánto cargó ya la empresa (lo usa la tarjeta "Primeros pasos")
export const obtener = async (req, res) => {
  try {
    res.json(await PrimerosPasos.getProgreso(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener los primeros pasos");
  }
};

// PATCH /api/me/recorrido → { recorrido_visto?: boolean, primeros_pasos_cerrado?: boolean }
export const actualizarRecorrido = async (req, res) => {
  const { recorrido_visto, primeros_pasos_cerrado } = req.body ?? {};
  const valido = (v) => v === undefined || typeof v === "boolean";
  if (!valido(recorrido_visto) || !valido(primeros_pasos_cerrado)
      || (recorrido_visto === undefined && primeros_pasos_cerrado === undefined)) {
    return res.status(400).json({ mensaje: "Datos inválidos" });
  }
  try {
    res.json(await PrimerosPasos.actualizarRecorrido(req.usuario.id_usuario, { recorrido_visto, primeros_pasos_cerrado }));
  } catch (error) {
    responderError(res, error, "Error al guardar el recorrido");
  }
};
