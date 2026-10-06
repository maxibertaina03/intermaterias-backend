import { Empresas } from "../models/index.js";

// Un id que no es un número entero positivo no puede existir en la tabla
const idValido = (id) => /^\d+$/.test(id);

export const obtenerEmpresas = async (req, res) => {
  try {
    const empresas = await Empresas.getAll();
    res.json(empresas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener las empresas" });
  }
};

export const obtenerEmpresa = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Empresa no encontrada" });

  try {
    const empresa = await Empresas.getById(id);
    if (!empresa) return res.status(404).json({ mensaje: "Empresa no encontrada" });
    res.json(empresa);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener la empresa" });
  }
};

export const crearEmpresa = async (req, res) => {
  try {
    const empresa = await Empresas.create(req.body);
    res.status(201).json(empresa);
  } catch (error) {
    if (error.code === "DUPLICADO") return res.status(409).json({ mensaje: error.message });
    res.status(500).json({ mensaje: "Error al crear la empresa" });
  }
};

export const editarEmpresa = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Empresa no encontrada" });

  try {
    const empresa = await Empresas.update(id, req.body ?? {});
    if (!empresa) return res.status(404).json({ mensaje: "Empresa no encontrada" });
    res.json(empresa);
  } catch (error) {
    if (error.code === "DUPLICADO") return res.status(409).json({ mensaje: error.message });
    res.status(500).json({ mensaje: "Error al editar la empresa" });
  }
};

export const eliminarEmpresa = async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ mensaje: "Empresa no encontrada" });

  try {
    const eliminada = await Empresas.remove(id);
    if (!eliminada) return res.status(404).json({ mensaje: "Empresa no encontrada" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar la empresa" });
  }
};
