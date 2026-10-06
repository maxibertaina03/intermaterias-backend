# Cómo trabajamos en el grupo

## Ramas

| Rama | Para qué sirve |
|------|----------------|
| `main` | Versión estable, la que se entrega. **Nadie pushea directo.** |
| `develop` | Integración: acá se junta el trabajo de todos. **Nadie pushea directo.** |
| `masita`, `facu`, `tomi`, `lucas` | Rama personal de cada integrante. Acá se trabaja. |

```
masita ─┐
facu   ─┤   PR + revisión     PR + revisión
tomi   ─┼──────────────────▶ develop ──────────────▶ main
lucas  ─┘
```

## Primera vez

```bash
git clone https://github.com/maxibertaina03/REPO.git
cd REPO
git checkout TU_RAMA          # ej: git checkout facu
npm install
```

## Día a día

1. **Antes de empezar**, traer lo último de `develop` a tu rama:
   ```bash
   git checkout TU_RAMA
   git pull origin develop
   ```
2. Trabajar y hacer commits chicos con mensajes claros:
   ```bash
   git add .
   git commit -m "Agrega validación de email en empresas"
   ```
3. Subir tu rama:
   ```bash
   git push origin TU_RAMA
   ```
4. En GitHub abrir un **Pull Request** de `TU_RAMA` → `develop` (ya viene seleccionada por defecto).
5. El resto del grupo revisa el PR (comentarios / *Approve*). Con al menos 1 aprobación se puede mergear.
6. Cuando `develop` está probada y todo el grupo está de acuerdo, se abre un PR de `develop` → `main`.

## Si hay conflictos

Al hacer `git pull origin develop` puede aparecer un conflicto. Abrir los archivos marcados en VS Code,
elegir qué cambios quedan, y después:

```bash
git add .
git commit -m "Resuelve conflicto con develop"
git push origin TU_RAMA
```

## Reglas

- El `.env` **nunca** se sube (ya está en `.gitignore`). Si agregás una variable nueva, agregala también a `.env.example`.
- `node_modules` no se sube; `package-lock.json` sí.
- Si instalás una librería, avisá en el PR para que el resto haga `npm install`.
