import * as Proveedores from "../models/postgres/proveedores.model.js";
import { idValido, responderError } from "../lib/errores.js";

const objeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);
const texto = (valor) => typeof valor === "string" ? valor.trim() : valor;
const CAMPOS_TEXTO = {
  contacto_nombre: [100, "El nombre del contacto"],
  telefono: [30, "El teléfono"],
  email: [150, "El correo electrónico"],
  observaciones: [null, "Las observaciones"]
};

const validarProveedor = (body, parcial = false) => {
  if (!objeto(body)) return "Los datos del proveedor no son válidos";
  if (!parcial || body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return "El nombre es obligatorio";
    if (body.nombre.trim().length > 150) return "El nombre puede tener hasta 150 caracteres";
  }
  for (const [campo, [maximo, etiqueta]] of Object.entries(CAMPOS_TEXTO)) {
    const valor = body[campo];
    if (valor !== undefined && valor !== null) {
      if (typeof valor !== "string") return `${etiqueta} no es válido`;
      if (maximo !== null && valor.trim().length > maximo) return `${etiqueta} puede tener hasta ${maximo} caracteres`;
    }
  }
  if (body.activo !== undefined && typeof body.activo !== "boolean") {
    return "El campo activo debe ser verdadero o falso";
  }
  return null;
};

const datosProveedor = (body) => ({
  nombre: body.nombre === undefined ? undefined : texto(body.nombre),
  contacto_nombre: body.contacto_nombre === undefined ? undefined : texto(body.contacto_nombre) || null,
  telefono: body.telefono === undefined ? undefined : texto(body.telefono) || null,
  email: body.email === undefined ? undefined : texto(body.email) || null,
  observaciones: body.observaciones === undefined ? undefined : texto(body.observaciones) || null,
  activo: body.activo
});

export const listar = async (req, res) => {
  try {
    res.json(await Proveedores.getAll(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener los proveedores");
  }
};

export const obtener = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
  try {
    const proveedor = await Proveedores.getById(req.usuario.id_empresa, req.params.id);
    if (!proveedor) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    res.json(proveedor);
  } catch (error) {
    responderError(res, error, "Error al obtener el proveedor");
  }
};

export const crear = async (req, res) => {
  const errorValidacion = validarProveedor(req.body);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  try {
    res.status(201).json(await Proveedores.create(req.usuario.id_empresa, datosProveedor(req.body)));
  } catch (error) {
    responderError(res, error, "Error al crear el proveedor");
  }
};

export const actualizar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
  const errorValidacion = validarProveedor(req.body, true);
  if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
  if (!Object.keys(req.body).length) return res.status(400).json({ mensaje: "Indicá los datos a actualizar" });
  try {
    const proveedor = await Proveedores.update(req.usuario.id_empresa, req.params.id, datosProveedor(req.body));
    if (!proveedor) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    res.json(proveedor);
  } catch (error) {
    responderError(res, error, "Error al editar el proveedor");
  }
};

export const actualizarServicios = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
  const ids = req.body?.id_servicios;
  const idPositivo = (id) => ((typeof id === "number" && Number.isInteger(id)) ||
    (typeof id === "string" && /^\d+$/.test(id))) && Number(id) > 0 && Number(id) <= 2147483647;
  if (!Array.isArray(ids) || ids.some((id) => !idPositivo(id))) {
    return res.status(400).json({ mensaje: "id_servicios debe ser una lista de ids positivos" });
  }
  const normalizados = ids.map(Number);
  if (new Set(normalizados).size !== normalizados.length) {
    return res.status(400).json({ mensaje: "La lista de servicios no puede contener ids repetidos" });
  }
  try {
    const resultado = await Proveedores.setServicios(req.usuario.id_empresa, req.params.id, normalizados);
    if (resultado.estado === "proveedor_no_encontrado") return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    if (resultado.estado === "servicio_no_encontrado") {
      return res.status(400).json({ mensaje: "Uno o más servicios no existen en esta organizadora" });
    }
    res.json(resultado.proveedor);
  } catch (error) {
    responderError(res, error, "Error al actualizar los servicios del proveedor");
  }
};

export const eliminar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Proveedor no encontrado" });
  try {
    if (!(await Proveedores.remove(req.usuario.id_empresa, req.params.id))) {
      return res.status(404).json({ mensaje: "Proveedor no encontrado" });
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === "23503") return res.status(409).json({ mensaje: "No se puede eliminar: el proveedor está usado en servicios o eventos" });
    responderError(res, error, "Error al eliminar el proveedor");
  }
};
