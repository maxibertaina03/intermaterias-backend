import * as Usuarios from "../models/postgres/usuarios.model.js";
import { responderError, idValido } from "../lib/errores.js";
import { crearCuenta, borrarCuenta, bloquearCuenta, responderErrorClerk } from "../lib/cuentasClerk.js";

export const ROLES_EMPRESA = [
  "admin_empresa", "atencion_cliente", "responsable_propuesta", "responsable_organizacion", "integrante",
];

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

const validarRoles = (roles) => {
  if (!Array.isArray(roles) || !roles.length) return "Elegí al menos un rol";
  if (roles.some((rol) => !ROLES_EMPRESA.includes(rol))) return "Hay un rol inválido";
  return null;
};

const validarAlta = (body) => {
  if (!texto(body.nombre)) return "El nombre es obligatorio";
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(texto(body.usuario))) {
    return "El usuario tiene que tener entre 4 y 64 letras, números, guiones o guiones bajos";
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    return "La contraseña tiene que tener al menos 8 caracteres";
  }
  return validarRoles(body.roles);
};

// Crea la cuenta en Clerk y el usuario en la base. Si falla la base, borra la cuenta para no dejarla suelta.
const darDeAlta = async (res, id_empresa, body, roles) => {
  const usuario = texto(body.usuario).toLowerCase();
  if (await Usuarios.existeUsuario(usuario)) {
    return res.status(409).json({ mensaje: "Ese nombre de usuario ya existe" });
  }

  let clerk_user_id;
  try {
    clerk_user_id = await crearCuenta({
      usuario, password: body.password, nombre: texto(body.nombre), apellido: texto(body.apellido),
    });
  } catch (error) {
    if (responderErrorClerk(res, error)) return;
    throw error;
  }

  try {
    const nombre = [texto(body.nombre), texto(body.apellido)].filter(Boolean).join(" ");
    const creado = await Usuarios.create(id_empresa, {
      nombre, email: texto(body.email) || null, usuario, clerk_user_id, roles,
    });
    res.status(201).json(creado);
  } catch (error) {
    await borrarCuenta(clerk_user_id).catch((e) => console.error(e));
    throw error;
  }
};

export const listar = async (req, res) => {
  try {
    res.json(await Usuarios.getAll(req.usuario.id_empresa));
  } catch (error) {
    responderError(res, error, "Error al obtener los usuarios");
  }
};

export const obtener = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ mensaje: "Usuario no encontrado" });
  try {
    const usuario = await Usuarios.getById(req.usuario.id_empresa, req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: "Usuario no encontrado" });
    res.json(usuario);
  } catch (error) {
    responderError(res, error, "Error al obtener el usuario");
  }
};

export const crear = async (req, res) => {
  const body = req.body ?? {};
  const error = validarAlta(body);
  if (error) return res.status(400).json({ mensaje: error });
  try {
    await darDeAlta(res, req.usuario.id_empresa, body, body.roles);
  } catch (e) {
    responderError(res, e, "Error al crear el usuario");
  }
};

export const actualizar = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Usuario no encontrado" });
  const body = req.body ?? {};

  if (body.nombre !== undefined && !texto(body.nombre)) return res.status(400).json({ mensaje: "El nombre es obligatorio" });
  if (body.activo !== undefined && typeof body.activo !== "boolean") return res.status(400).json({ mensaje: "Datos inválidos" });
  if (body.roles !== undefined) {
    const errorRoles = validarRoles(body.roles);
    if (errorRoles) return res.status(400).json({ mensaje: errorRoles });
  }

  // El administrador no puede dejar a su empresa sin administrar
  const esUnoMismo = Number(id) === req.usuario.id_usuario;
  if (esUnoMismo && body.activo === false) {
    return res.status(409).json({ mensaje: "No podés desactivar tu propio usuario" });
  }
  if (esUnoMismo && body.roles && !body.roles.includes("admin_empresa")) {
    return res.status(409).json({ mensaje: "No podés quitarte el rol de administrador" });
  }

  try {
    const actualizado = await Usuarios.update(req.usuario.id_empresa, id, {
      nombre: body.nombre === undefined ? undefined : texto(body.nombre),
      email: body.email === undefined ? undefined : texto(body.email) || null,
      activo: body.activo,
      roles: body.roles,
    });
    if (!actualizado) return res.status(404).json({ mensaje: "Usuario no encontrado" });
    if (body.activo !== undefined) {
      await bloquearCuenta(await Usuarios.getClerkId(req.usuario.id_empresa, id), !body.activo);
    }
    res.json(actualizado);
  } catch (error) {
    responderError(res, error, "Error al actualizar el usuario");
  }
};

// Super admin: primer administrador de una empresa (POST /api/empresas/:id/admin).
// Por defecto tiene todos los roles; se pueden indicar otros en body.roles (siempre incluye admin_empresa).
export const crearAdministrador = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Empresa no encontrada" });
  const body = req.body ?? {};
  const roles = [...new Set(["admin_empresa", ...(body.roles ?? ROLES_EMPRESA)])];
  const error = validarAlta({ ...body, roles });
  if (error) return res.status(400).json({ mensaje: error });

  try {
    if (!(await Usuarios.existeEmpresa(id))) return res.status(404).json({ mensaje: "Empresa no encontrada" });
    await darDeAlta(res, Number(id), body, roles);
  } catch (e) {
    responderError(res, e, "Error al crear el administrador");
  }
};
