import * as Clientes from "../models/postgres/clientes.model.js";
import { idValido, responderError } from "../lib/errores.js";

const TIPOS = ["centro_estudiantes", "grupo_estudiantes", "curso"];
const texto = (v) => (typeof v === "string" ? v.trim() : v);
const vacioANull = (v) => (v === undefined ? undefined : texto(v) || null);

const validarCliente = (body, parcial = false) => {
  if (!body || typeof body !== "object") return "Datos inválidos";
  if (!parcial || body.nombre !== undefined) {
    if (!texto(body.nombre)) return "El nombre es obligatorio";
    if (texto(body.nombre).length > 150) return "El nombre puede tener hasta 150 caracteres";
  }
  if (!parcial || body.tipo !== undefined) {
    if (!TIPOS.includes(body.tipo)) return "El tipo de cliente no es válido";
  }
  if (body.activo !== undefined && typeof body.activo !== "boolean") return "El estado no es válido";
  return null;
};

const validarContacto = (body, parcial = false) => {
  if (!body || typeof body !== "object") return "Datos inválidos";
  if (!parcial || body.nombre !== undefined) {
    if (!texto(body.nombre)) return "El nombre del contacto es obligatorio";
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(body.email))) return "El email no es válido";
  if (body.vigente !== undefined && typeof body.vigente !== "boolean") return "El campo vigente no es válido";
  return null;
};

export const listar = async (req, res) => {
  const { q, activo } = req.query;
  try {
    res.json(await Clientes.getAll(req.usuario.id_empresa, {
      q: q?.trim() || null,
      activo: activo === undefined ? null : activo === "true",
    }));
  } catch (error) {
    responderError(res, error, "Error al obtener los clientes");
  }
};

export const obtener = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Cliente no encontrado" });
  try {
    const cliente = await Clientes.getById(req.usuario.id_empresa, id);
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.json(cliente);
  } catch (error) {
    responderError(res, error, "Error al obtener el cliente");
  }
};

export const crear = async (req, res) => {
  const error = validarCliente(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const cliente = await Clientes.create(req.usuario.id_empresa, {
      nombre: texto(req.body.nombre), tipo: req.body.tipo, institucion: vacioANull(req.body.institucion),
    });
    res.status(201).json(cliente);
  } catch (e) {
    responderError(res, e, "Error al crear el cliente");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Cliente no encontrado" });
  const error = validarCliente(req.body ?? {}, true);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const cliente = await Clientes.update(req.usuario.id_empresa, id, {
      nombre: texto(req.body?.nombre), tipo: req.body?.tipo,
      institucion: vacioANull(req.body?.institucion), activo: req.body?.activo,
    });
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.json(cliente);
  } catch (e) {
    responderError(res, e, "Error al editar el cliente");
  }
};

export const eliminar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Cliente no encontrado" });
  try {
    const eliminado = await Clientes.remove(req.usuario.id_empresa, id);
    if (!eliminado) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.status(204).send();
  } catch (e) {
    if (e.code === "23503") {
      return res.status(409).json({ mensaje: "No se puede eliminar: el cliente tiene eventos. Podés desactivarlo." });
    }
    responderError(res, e, "Error al eliminar el cliente");
  }
};

export const listarContactos = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Cliente no encontrado" });
  try {
    res.json(await Clientes.getContactos(req.usuario.id_empresa, id));
  } catch (e) {
    responderError(res, e, "Error al obtener los contactos");
  }
};

export const crearContacto = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Cliente no encontrado" });
  const error = validarContacto(req.body);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const contacto = await Clientes.createContacto(req.usuario.id_empresa, id, {
      nombre: texto(req.body.nombre), telefono: vacioANull(req.body.telefono),
      email: vacioANull(req.body.email), rol: vacioANull(req.body.rol), vigente: req.body.vigente ?? true,
    });
    if (!contacto) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.status(201).json(contacto);
  } catch (e) {
    responderError(res, e, "Error al crear el contacto");
  }
};

export const actualizarContacto = async (req, res) => {
  const { id, idContacto } = req.params;
  if (!idValido(id) || !idValido(idContacto)) return res.status(404).json({ mensaje: "Contacto no encontrado" });
  const error = validarContacto(req.body ?? {}, true);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    const b = req.body ?? {};
    const contacto = await Clientes.updateContacto(req.usuario.id_empresa, id, idContacto, {
      nombre: texto(b.nombre), telefono: vacioANull(b.telefono), email: vacioANull(b.email),
      rol: vacioANull(b.rol), vigente: b.vigente,
    });
    if (!contacto) return res.status(404).json({ mensaje: "Contacto no encontrado" });
    res.json(contacto);
  } catch (e) {
    responderError(res, e, "Error al editar el contacto");
  }
};
