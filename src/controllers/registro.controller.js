import { crearEmpresaDePrueba } from "../models/postgres/registro.model.js";
import { existeUsuario } from "../models/postgres/usuarios.model.js";
import { crearCuenta, borrarCuenta, responderErrorClerk } from "../lib/cuentasClerk.js";
import { responderError } from "../lib/errores.js";

export const DIAS_PRUEBA = 30;

const texto = (v) => (typeof v === "string" ? v.trim() : "");

const validar = (b) => {
  if (texto(b.empresa).length < 2 || texto(b.empresa).length > 150) return "Ingresá el nombre de tu empresa";
  if (!texto(b.nombre) || texto(b.nombre).length > 100) return "Ingresá tu nombre";
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(texto(b.usuario))) {
    return "El usuario tiene que tener entre 4 y 64 letras, números, guiones o guiones bajos";
  }
  if (typeof b.password !== "string" || b.password.length < 15) return "La contraseña tiene que tener al menos 15 caracteres";
  if (texto(b.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(b.email))) return "El email no es válido";
  return null;
};

// POST /api/publico/registro · una organizadora se registra sola y prueba el sistema 30 días
export const registrar = async (req, res) => {
  const body = req.body ?? {};
  const error = validar(body);
  if (error) return res.status(400).json({ mensaje: error });

  const usuario = texto(body.usuario).toLowerCase();
  try {
    if (await existeUsuario(usuario)) return res.status(409).json({ mensaje: "Ese nombre de usuario ya existe" });
  } catch (e) {
    return responderError(res, e, "No se pudo completar el registro");
  }

  let clerk_user_id;
  try {
    clerk_user_id = await crearCuenta({ usuario, password: body.password, nombre: texto(body.nombre), apellido: texto(body.apellido) });
  } catch (e) {
    if (responderErrorClerk(res, e)) return;
    return responderError(res, e, "No se pudo crear la cuenta");
  }

  try {
    const nombre = [texto(body.nombre), texto(body.apellido)].filter(Boolean).join(" ");
    const empresa = await crearEmpresaDePrueba({
      empresa: texto(body.empresa), nombre, email: texto(body.email) || null, usuario, clerk_user_id, dias: DIAS_PRUEBA,
    });
    res.status(201).json({
      mensaje: `Listo: tenés ${DIAS_PRUEBA} días de prueba gratuita`,
      empresa: empresa.nombre,
      fecha_fin_prueba: empresa.fecha_fin_prueba,
      usuario,
    });
  } catch (e) {
    await borrarCuenta(clerk_user_id).catch((err) => console.error(err));
    responderError(res, e, "No se pudo completar el registro");
  }
};
