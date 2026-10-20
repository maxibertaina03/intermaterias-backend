import * as Servicios from "../models/postgres/servicios.model.js";
import { idValido, responderError } from "../lib/errores.js";

const texto = (valor) => typeof valor === "string" ? valor.trim() : valor;
const objeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);
const numero = (valor) => (typeof valor === "number" && Number.isFinite(valor)) ||
  (typeof valor === "string" && valor.trim() !== "" && Number.isFinite(Number(valor)));
const precioValido = (valor) => numero(valor) && Number(valor) >= 0 && Number(valor) <= 9999999999.99;

const validar = (body, parcial = false) => {
  if (!objeto(body)) return "Los datos del servicio no son válidos";
  if (!parcial || body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return "El nombre es obligatorio";
    if (body.nombre.trim().length > 100) return "El nombre puede tener hasta 100 caracteres";
  }
  if (body.descripcion !== undefined && body.descripcion !== null && typeof body.descripcion !== "string") {
    return "La descripción no es válida";
  }
  if (body.precio_referencia !== undefined && body.precio_referencia !== null && body.precio_referencia !== "" &&
      !precioValido(body.precio_referencia)) {
    return "El precio de referencia debe ser un importe igual o mayor a cero";
  }
  if (body.activo !== undefined && typeof body.activo !== "boolean") {
    return "El campo activo debe ser verdadero o falso";
  }
  return null;
};

const datos = (body) => ({
  nombre: body.nombre === undefined ? undefined : texto(body.nombre),
  descripcion: body.descripcion === undefined ? undefined : texto(body.descripcion) || null,
  precio_referencia: body.precio_referencia === undefined
    ? undefined
    : body.precio_referencia === null || body.precio_referencia === "" ? null : Number(body.precio_referencia),
  activo: body.activo
});

export const listar = async (req, res) => {
  try {
    res.json(await Servicios.getAll(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener los servicios");
  }
};

export const obtener = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Servicio no encontrado" });
  try {
    const servicio = await Servicios.getById(req.usuario.id_empresa, req.params.id);
    if (!servicio) return res.status(404).json({ mensaje: "Servicio no encontrado" });
    res.json(servicio);
  } catch (error) {
    responderError(res, error, "Error al obtener el servicio");
  }
};

export const crear = async (req, res) => {
  const errorValidacion = validar(req.body);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  try {
    res.status(201).json(await Servicios.create(req.usuario.id_empresa, datos(req.body)));
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ mensaje: "Ya existe un servicio con ese nombre" });
    responderError(res, error, "Error al crear el servicio");
  }
};

export const actualizar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Servicio no encontrado" });
  const errorValidacion = validar(req.body, true);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  if (!Object.keys(req.body).length) return res.status(400).json({ mensaje: "Indicá los datos a actualizar" });
  try {
    const servicio = await Servicios.update(req.usuario.id_empresa, req.params.id, datos(req.body));
    if (!servicio) return res.status(404).json({ mensaje: "Servicio no encontrado" });
    res.json(servicio);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ mensaje: "Ya existe un servicio con ese nombre" });
    responderError(res, error, "Error al editar el servicio");
  }
};

export const eliminar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Servicio no encontrado" });
  try {
    if (!(await Servicios.remove(req.usuario.id_empresa, req.params.id))) {
      return res.status(404).json({ mensaje: "Servicio no encontrado" });
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === "23503") return res.status(409).json({ mensaje: "No se puede eliminar: el servicio está usado en propuestas, proveedores o eventos" });
    responderError(res, error, "Error al eliminar el servicio");
  }
};
