// Traduce los errores de PostgreSQL a respuestas claras para el front.
// Uso en un controller:  catch (error) { responderError(res, error, "Error al crear el cliente"); }
export const responderError = (res, error, mensajePorDefecto) => {
  switch (error.code) {
    case "23505": // UNIQUE: valor repetido
      return res.status(409).json({ mensaje: "Ya existe un registro con esos datos" });
    case "23503": // FOREIGN KEY: tiene datos asociados o referencia algo que no existe
      return res.status(409).json({ mensaje: "No se puede: hay datos relacionados" });
    case "23514": // CHECK: no cumple una regla de la base (estado inválido, cantidad <= 0…)
    case "23502": // NOT NULL: falta un dato obligatorio
    case "22P02": // tipo inválido (ej. texto donde va un número)
      return res.status(400).json({ mensaje: "Datos inválidos" });
    default:
      console.error(error);
      return res.status(500).json({ mensaje: mensajePorDefecto });
  }
};

// Un id de la URL tiene que ser un entero positivo
export const idValido = (id) => /^\d+$/.test(String(id));
