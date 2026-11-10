import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Op } from "sequelize";
import { Sesion, Usuario } from "../modelos.js";

// La contrasena nunca llega aqui: el telefono manda un valor derivado y cifra el progreso con otro.
const derivar = promisify(scrypt);
const SESION_MS = 180 * 86400000;
const INTENTOS_MAX = 8;
const BLOQUEO_MS = 15 * 60 * 1000;
const HEX64 = /^[0-9a-f]{64}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOPE_LLAVE = 2000;

const normalizar = (c) => (typeof c === "string" ? c.trim().toLowerCase() : "");
const huella = (t) => createHash("sha256").update(t).digest("hex");
const llaveValida = (l) => typeof l === "string" && l.length > 0 && l.length <= TOPE_LLAVE && /^[A-Za-z0-9+/=]+$/.test(l);
const claveValida = (c) => typeof c === "string" && HEX64.test(c);
const publica = (u) => ({ nombre: u.nombre, correo: u.correo });
const iguales = (a, b) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

async function hashear(clave) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${(await derivar(clave, sal, 32)).toString("hex")}`;
}
async function coincide(clave, guardado) {
  const [sal, valor] = guardado.split(":");
  return iguales((await derivar(clave, sal, 32)).toString("hex"), valor);
}
// Con un correo que no existe se hace el mismo calculo: la espera no delata quien tiene cuenta.
const relleno = hashear("0".repeat(64));

const fallas = new Map();
function bloqueado(correo) {
  const f = fallas.get(correo);
  if (!f) return false;
  if (Date.now() > f.hasta) { fallas.delete(correo); return false; }
  return f.n >= INTENTOS_MAX;
}
function anotarFalla(correo) {
  const f = fallas.get(correo);
  fallas.set(correo, f && Date.now() <= f.hasta ? { n: f.n + 1, hasta: f.hasta } : { n: 1, hasta: Date.now() + BLOQUEO_MS });
  if (fallas.size > 5000) fallas.delete(fallas.keys().next().value);
}

async function abrirSesion(usuario) {
  await Sesion.destroy({ where: { expira: { [Op.lt]: new Date() } } });
  const token = randomBytes(32).toString("base64url");
  await Sesion.create({ token_hash: huella(token), usuario_id: usuario.id, expira: new Date(Date.now() + SESION_MS) });
  return token;
}

// Las sesiones abiertas antes de este momento ya no valen: todos vuelven a entrar con su contrasena.
const SESIONES_DESDE = new Date(process.env.SESIONES_DESDE ?? "2026-11-10T23:05:00Z");

export async function conSesion(req, res, next) {
  const token = /^Bearer (\S+)$/.exec(req.get("Authorization") ?? "")?.[1];
  const sesion = token ? await Sesion.findOne({ where: { token_hash: huella(token), expira: { [Op.gt]: new Date() }, createdAt: { [Op.gte]: SESIONES_DESDE } } }) : null;
  const usuario = sesion ? await Usuario.scope("conClave").findByPk(sesion.usuario_id) : null;
  if (!usuario) return res.status(401).json({ error: "Tu sesión terminó. Vuelve a entrar." });
  Object.assign(req, { sesion, usuario });
  next();
}

export const cuentas = {
  crear: async (req, res) => {
    const { nombre, clave, llave_cifrada: llave, prueba_llave: prueba } = req.body ?? {};
    const correo = normalizar(req.body?.correo);
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 60 || !CORREO.test(correo) || correo.length > 120 || !claveValida(clave) || !llaveValida(llave) || !claveValida(prueba)) {
      return res.status(400).json({ error: "Revisa tu nombre, tu correo y tu contraseña" });
    }
    if (await Usuario.findOne({ where: { correo } })) return res.status(409).json({ error: "Ese correo ya tiene cuenta. Entra con él." });
    const usuario = await Usuario.create({ nombre: nombre.trim(), correo, rol: "usuario", clave_hash: await hashear(clave), llave_cifrada: llave, prueba_llave: huella(prueba) });
    res.status(201).json({ token: await abrirSesion(usuario), cuenta: publica(usuario) });
  },
  entrar: async (req, res) => {
    const correo = normalizar(req.body?.correo), clave = req.body?.clave;
    if (!correo || !claveValida(clave)) return res.status(400).json({ error: "Escribe tu correo y tu contraseña" });
    if (bloqueado(correo)) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
    const usuario = await Usuario.scope("conClave").findOne({ where: { correo } });
    const bien = await coincide(clave, usuario?.clave_hash ?? await relleno);
    if (!usuario?.clave_hash || !bien) { anotarFalla(correo); return res.status(401).json({ error: "Correo o contraseña incorrectos" }); }
    fallas.delete(correo);
    res.json({ token: await abrirSesion(usuario), cuenta: publica(usuario), llave_cifrada: usuario.llave_cifrada });
  },
  yo: (req, res) => res.json({ cuenta: publica(req.usuario) }),
  cambiarClave: async (req, res) => {
    const { clave_actual: actual, clave_nueva: nueva, llave_cifrada: llave } = req.body ?? {};
    if (!claveValida(actual) || !claveValida(nueva) || !llaveValida(llave)) return res.status(400).json({ error: "Revisa tu contraseña" });
    if (!await coincide(actual, req.usuario.clave_hash)) return res.status(401).json({ error: "Tu contraseña actual no coincide" });
    await req.usuario.update({ clave_hash: await hashear(nueva), llave_cifrada: llave });
    await Sesion.destroy({ where: { usuario_id: req.usuario.id, id: { [Op.ne]: req.sesion.id } } });
    res.json({ ok: true });
  },
  // Sin servicio de correo, las seis palabras son la prueba de que la cuenta es tuya.
  recuperar: async (req, res) => {
    const correo = normalizar(req.body?.correo), { prueba_llave: prueba, clave_nueva: nueva, llave_cifrada: llave } = req.body ?? {};
    if (!correo || !claveValida(prueba) || !claveValida(nueva) || !llaveValida(llave)) return res.status(400).json({ error: "Revisa tu correo, tus palabras y tu contraseña" });
    if (bloqueado(correo)) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
    const usuario = await Usuario.scope("conClave").findOne({ where: { correo } });
    if (!usuario?.prueba_llave || !iguales(huella(prueba), usuario.prueba_llave)) { anotarFalla(correo); return res.status(401).json({ error: "Ese correo y esas palabras no coinciden" }); }
    fallas.delete(correo);
    await usuario.update({ clave_hash: await hashear(nueva), llave_cifrada: llave });
    await Sesion.destroy({ where: { usuario_id: usuario.id } });
    res.json({ token: await abrirSesion(usuario), cuenta: publica(usuario) });
  },
  salir: async (req, res) => {
    await req.sesion.destroy();
    res.status(204).end();
  },
  borrar: async (req, res) => {
    if (!claveValida(req.body?.clave) || !await coincide(req.body.clave, req.usuario.clave_hash)) return res.status(401).json({ error: "Tu contraseña no coincide" });
    await req.usuario.destroy();
    res.status(204).end();
  },
};
