import { Router } from "express";
import { conSesion, cuentas } from "../controladores/cuentas.js";

export const cuentasRouter = Router()
  .post("/", cuentas.crear)
  .post("/entrar", cuentas.entrar)
  .post("/recuperar", cuentas.recuperar)
  .post("/salir", conSesion, cuentas.salir)
  .get("/yo", conSesion, cuentas.yo)
  .put("/yo/clave", conSesion, cuentas.cambiarClave)
  .delete("/yo", conSesion, cuentas.borrar);
