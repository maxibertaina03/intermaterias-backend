import { clerkClient } from "@clerk/express";
import { usaClerk } from "../middlewares/usuarioActual.js";

// Cuentas de Clerk (usuario y contraseña) del personal de las empresas.
// Sin claves de Clerk (modo desarrollo) no se crea cuenta: el usuario queda solo en la base.

export const crearCuenta = async ({ usuario, password, nombre, apellido }) => {
  if (!usaClerk) return null;
  const cuenta = await clerkClient.users.createUser({
    username: usuario,
    password,
    firstName: nombre,
    lastName: apellido || undefined,
  });
  return cuenta.id;
};

export const borrarCuenta = async (clerk_user_id) => {
  if (!usaClerk || !clerk_user_id) return;
  await clerkClient.users.deleteUser(clerk_user_id);
};

// Un usuario desactivado no puede volver a iniciar sesión (además de no pasar usuarioActual).
export const bloquearCuenta = async (clerk_user_id, bloquear) => {
  if (!usaClerk || !clerk_user_id) return;
  if (bloquear) await clerkClient.users.banUser(clerk_user_id);
  else await clerkClient.users.unbanUser(clerk_user_id);
};

const MENSAJES_CLERK = {
  form_identifier_exists: [409, "Ese nombre de usuario ya existe"],
  form_username_invalid_character: [400, "El usuario solo puede tener letras, números, guiones y guiones bajos"],
  form_username_invalid_length: [400, "El usuario tiene que tener entre 4 y 64 caracteres"],
  form_password_pwned: [400, "Esa contraseña apareció en filtraciones de datos: elegí otra"],
  form_password_not_strong_enough: [400, "La contraseña es muy débil: elegí otra"],
};

// Si el error vino de Clerk, responde con un mensaje claro y devuelve true.
export const responderErrorClerk = (res, error) => {
  const detalle = error?.errors?.[0];
  if (!detalle?.code) return false;
  // El mínimo de la contraseña lo define la configuración de Clerk (hoy, 15 caracteres): se toma de su mensaje.
  const minimo = detalle.message?.match(/\d+/)?.[0];
  const [status, mensaje] = detalle.code === "form_password_length_too_short"
    ? [400, `La contraseña tiene que tener al menos ${minimo ?? 15} caracteres`]
    : MENSAJES_CLERK[detalle.code] ?? [400, `No se pudo crear la cuenta: ${detalle.longMessage || detalle.message}`];
  res.status(status).json({ mensaje });
  return true;
};
