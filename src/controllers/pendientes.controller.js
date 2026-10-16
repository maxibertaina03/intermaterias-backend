import * as Pendientes from "../models/postgres/pendientes.model.js";
import { responderError } from "../lib/errores.js";

export const listar = async (req, res) => {
  try {
    res.json(await Pendientes.getAll(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener los pendientes");
  }
};
