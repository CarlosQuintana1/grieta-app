import { Router } from "express";
import { camiones, notificaciones } from "../controladores/avisos.js";
import { auto } from "../controladores/auto.js";
import { buscar } from "../controladores/buscar.js";
import { impacto } from "../controladores/impacto.js";
import { observatorio, observatorioVivo } from "../controladores/observatorio.js";
import { respaldos } from "../controladores/respaldos.js";
import { sentir } from "../controladores/sentir.js";
import { consultasRouter } from "./consultas.js";
import { cuentasRouter } from "./cuentas.js";
import { cotizacionesRouter } from "./cotizaciones.js";
import { lugaresRouter } from "./lugares.js";
import { preciosRouter } from "./precios.js";
import { registrosRouter } from "./registros.js";
import { quejasRouter } from "./quejas.js";
import { reportesRouter } from "./reportes.js";
import { rutasRouter } from "./rutas.js";
import { usuariosRouter } from "./usuarios.js";

// Una ruta base por tabla; cada una tiene su controlador en ../controladores.
export const api = Router()
  .get("/salud", (_req, res) => res.json({ ok: true }))
  .get("/buscar", buscar)
  .get("/auto", auto)
  .use("/lugares", lugaresRouter)
  .use("/usuarios", usuariosRouter)
  .use("/cuentas", cuentasRouter)
  .use("/rutas", rutasRouter)
  .use("/registros", registrosRouter)
  .use("/cotizaciones", cotizacionesRouter)
  .use("/consultas", consultasRouter)
  .use("/reportes", reportesRouter)
  .use("/quejas", quejasRouter)
  .use("/precios-reportados", preciosRouter)
  // Sin tabla: avisos de la gente en la parada y avisos programados por push
  .get("/camiones/avisos", camiones.listar)
  .post("/camiones/avisos", camiones.crear)
  .post("/camiones/avisos/:linea/confirmar", camiones.confirmar)
  .get("/camiones/ocupacion", camiones.ocupacion)
  .get("/notificaciones/clave", notificaciones.clave)
  .post("/notificaciones", notificaciones.programar)
  .post("/notificaciones/cancelar", notificaciones.cancelar)
  // Viajes en camion contados sin datos de la persona, y su suma para el inicio
  .post("/viajes", impacto.registrar)
  .post("/sentir", sentir.crear)
  .post("/viajes/demo", impacto.demo)
  .delete("/viajes/demo", impacto.quitarDemo)
  .get("/impacto", impacto.total)
  // Copia cifrada del progreso para pasarlo a otro telefono, sin cuenta ni contrasena
  .get("/respaldos/:id", respaldos.leer)
  .put("/respaldos/:id", respaldos.guardar)
  .delete("/respaldos/:id", respaldos.borrar)
  // Datos abiertos agregados para la ciudad
  .get("/observatorio", observatorio)
  .get("/observatorio/vivo", observatorioVivo);
