import * as ServiciosAcordados from "../models/postgres/serviciosAcordados.model.js";
import { idValido, responderError } from "../lib/errores.js";

const enteroPositivo = (valor) => ((typeof valor === "number" && Number.isInteger(valor)) ||
  (typeof valor === "string" && /^\d+$/.test(valor))) && Number(valor) > 0 && Number(valor) <= 2147483647;
const objeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

export const listar = async (req, res) => {
  let id_evento = null;
  if (req.query.evento !== undefined && req.query.evento !== "") {
    if (!enteroPositivo(req.query.evento)) return res.status(400).json({ mensaje: "El id de evento no es válido" });
    id_evento = Number(req.query.evento);
  }
  try {
    res.json(await ServiciosAcordados.getAll(req.usuario.id_empresa, id_evento));
  } catch (error) {
    responderError(res, error, "Error al obtener los servicios acordados");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Servicio acordado no encontrado" });
  const body = req.body;
  if (!objeto(body)) return res.status(400).json({ mensaje: "Los datos de coordinación no son válidos" });
  const campos = ["es_propio", "id_proveedor", "id_responsable", "observaciones"];
  if (!campos.some((campo) => body[campo] !== undefined)) {
    return res.status(400).json({ mensaje: "Indicá los datos de coordinación a actualizar" });
  }
  if (body.es_propio !== undefined && typeof body.es_propio !== "boolean") {
    return res.status(400).json({ mensaje: "es_propio debe ser verdadero o falso" });
  }
  for (const campo of ["id_proveedor", "id_responsable"]) {
    const valor = body[campo];
    if (valor !== undefined && valor !== null && !enteroPositivo(valor)) {
      return res.status(400).json({ mensaje: `${campo} debe ser un id positivo o null` });
    }
  }
  if (body.es_propio === true && body.id_proveedor !== undefined && body.id_proveedor !== null) {
    return res.status(400).json({ mensaje: "Un servicio propio no puede tener proveedor" });
  }
  if (body.observaciones !== undefined && body.observaciones !== null && typeof body.observaciones !== "string") {
    return res.status(400).json({ mensaje: "Las observaciones deben ser texto o null" });
  }

  const datos = {};
  if (body.es_propio !== undefined) datos.es_propio = body.es_propio;
  else if (body.id_proveedor !== undefined && body.id_proveedor !== null) datos.es_propio = false;
  if (body.id_proveedor !== undefined) datos.id_proveedor = body.id_proveedor === null ? null : Number(body.id_proveedor);
  if (body.id_responsable !== undefined) datos.id_responsable = body.id_responsable === null ? null : Number(body.id_responsable);
  if (body.observaciones !== undefined) datos.observaciones = body.observaciones?.trim() || null;

  try {
    const resultado = await ServiciosAcordados.update(req.usuario.id_empresa, id, datos);
    if (resultado.estado === "no_encontrado") return res.status(404).json({ mensaje: "Servicio acordado no encontrado" });
    if (resultado.estado === "evento_no_coordinable") {
      return res.status(409).json({ mensaje: "Solo se coordinan servicios de eventos confirmados o en preparación" });
    }
    if (resultado.estado === "proveedor_no_ofrece_servicio") {
      return res.status(400).json({ mensaje: "El proveedor no está activo o no ofrece este servicio" });
    }
    if (resultado.estado === "responsable_no_encontrado") {
      return res.status(400).json({ mensaje: "El responsable no existe o no pertenece a esta organizadora" });
    }
    res.json(resultado.servicio);
  } catch (error) {
    responderError(res, error, "Error al actualizar la coordinación del servicio");
  }
};

export const confirmar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Servicio acordado no encontrado" });
  try {
    const resultado = await ServiciosAcordados.confirmar(req.usuario.id_empresa, id);
    if (resultado.estado === "no_encontrado") return res.status(404).json({ mensaje: "Servicio acordado no encontrado" });
    if (resultado.estado === "evento_no_coordinable") {
      return res.status(409).json({ mensaje: "Solo se confirman servicios de eventos confirmados o en preparación" });
    }
    if (resultado.estado === "ya_confirmado") return res.status(409).json({ mensaje: "El servicio ya está confirmado" });
    if (resultado.estado === "falta_proveedor") {
      return res.status(409).json({ mensaje: "Asigná un proveedor o marcá el servicio como propio antes de confirmar" });
    }
    if (resultado.estado === "proveedor_no_ofrece_servicio") {
      return res.status(409).json({ mensaje: "El proveedor no está activo o ya no ofrece este servicio" });
    }
    res.json(resultado.servicio);
  } catch (error) {
    responderError(res, error, "Error al confirmar el servicio acordado");
  }
};
