// Quién puede hacer qué. La app pública solo lee, busca, reporta problemas, manda precios y cuenta viajes;
// cambiar o borrar datos, y ver datos personales, pide la clave de administrador (CLAVE_ADMIN).

// Lo que cualquiera puede mandar desde la app.
const ESCRITURAS_PUBLICAS = [
  ["POST", /^\/api\/cuentas(\/entrar|\/recuperar|\/salir)?\/?$/],
  ["PUT", /^\/api\/cuentas\/yo\/clave\/?$/],
  ["DELETE", /^\/api\/cuentas\/yo\/?$/],
  ["POST", /^\/api\/reportes\/?$/],
  ["POST", /^\/api\/quejas\/?$/],
  ["POST", /^\/api\/reportes\/\d+\/foto\/?$/],
  ["POST", /^\/api\/reportes\/\d+\/verificar\/?$/],
  ["POST", /^\/api\/precios-reportados\/?$/],
  ["POST", /^\/api\/camiones\/avisos\/?$/],
  ["POST", /^\/api\/camiones\/avisos\/[A-Za-z0-9]{1,6}\/confirmar\/?$/],
  ["POST", /^\/api\/notificaciones(\/cancelar)?\/?$/],
  ["POST", /^\/api\/viajes\/?$/],
  ["POST", /^\/api\/sentir\/?$/],
  ["PUT", /^\/api\/respaldos\/[0-9a-f]{64}\/?$/],
  ["DELETE", /^\/api\/respaldos\/[0-9a-f]{64}\/?$/],
];
// Lecturas con datos de personas: quién captura, por dónde se mueve y qué consulta.
// El texto de cada queja puede traer datos de alguien: solo el resumen es publico.
const LECTURAS_PRIVADAS = [/^\/api\/usuarios/, /^\/api\/precios-reportados/, /^\/api\/consultas/, /^\/api\/quejas(?!\/resumen\/?$)/];

import { createHash, timingSafeEqual } from "node:crypto";

// Se compara en tiempo constante para que no se pueda adivinar la clave midiendo cuanto tarda la respuesta.
const huella = (x) => createHash("sha256").update(String(x)).digest();
export const esDelEquipo = (req) => {
  const clave = process.env.CLAVE_ADMIN, dada = req.get("X-Clave-Admin");
  return Boolean(clave && dada) && timingSafeEqual(huella(dada), huella(clave));
};

// Ventana deslizante por IP; el mapa tiene tope para que no crezca sin limite.
function limitador(tope, ventanaMs, mensaje) {
  const mapa = new Map();
  const contar = (quien) => {
    const ahora = Date.now();
    const lista = (mapa.get(quien) ?? []).filter((t) => ahora - t < ventanaMs);
    lista.push(ahora);
    mapa.delete(quien);
    mapa.set(quien, lista);
    if (mapa.size > 20000) mapa.delete(mapa.keys().next().value);
    return lista.length;
  };
  const middleware = (req, res, next) => (esDelEquipo(req) || contar(req.ip) <= tope ? next() : res.status(429).set("Retry-After", String(Math.ceil(ventanaMs / 1000))).json({ error: mensaje }));
  return Object.assign(middleware, { contar, mapa });
}

// Tope general: la app hace pocas peticiones por minuto; mil seguidas solo las manda un ataque.
export const limiteGeneral = limitador(Number(process.env.TOPE_GENERAL_MINUTO ?? 600), 60 * 1000, "Demasiadas peticiones. Espera un minuto");
// La busqueda gasta el cupo mensual de Azure Maps: una sola persona no puede acabarselo a los demas.
const busquedasMinuto = limitador(Number(process.env.TOPE_BUSQUEDAS_MINUTO ?? 40), 60 * 1000, "Muchas búsquedas seguidas. Espera un minuto");
const busquedasDia = limitador(Number(process.env.TOPE_BUSQUEDAS_DIA ?? 400), 24 * 60 * 60 * 1000, "Llegaste al tope de búsquedas de hoy");
// Cada foto pesa hasta 5 MB y se guarda en Blob Storage: tope propio para que nadie llene el almacen.
export const limiteFotos = limitador(Number(process.env.TOPE_FOTOS_HORA ?? 20), 60 * 60 * 1000, "Muchas fotos seguidas. Intenta en un rato");
export const limiteBusquedas = (req, res, next) => busquedasMinuto(req, res, () => busquedasDia(req, res, next));

// Quien manda una clave de equipo equivocada muchas veces se queda fuera una hora: asi no se adivina a la fuerza.
const fallosClave = new Map();
export function bloqueoClave(req, res, next) {
  const dada = req.get("X-Clave-Admin");
  if (!dada) return next();
  const ahora = Date.now(), lista = (fallosClave.get(req.ip) ?? []).filter((t) => ahora - t < 60 * 60 * 1000);
  if (lista.length >= 10) return res.status(429).json({ error: "Demasiados intentos con clave equivocada. Intenta en una hora" });
  if (!esDelEquipo(req)) {
    lista.push(ahora);
    fallosClave.set(req.ip, lista);
    if (fallosClave.size > 20000) fallosClave.delete(fallosClave.keys().next().value);
  }
  next();
}

// Solo las paginas de Grieta pueden llamar a la API desde el navegador.
const ORIGENES = [/^https:\/\/grieta-web-qro\.azurewebsites\.net$/, /^https:\/\/grietawebqro\.z14\.web\.core\.windows\.net$/,
  /^https:\/\/([a-z0-9-]+\.)?grieta-demo\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
export function origenPermitido(origen) {
  if (process.env.ORIGEN_PERMITIDO) return process.env.ORIGEN_PERMITIDO === "*" || process.env.ORIGEN_PERMITIDO.split(",").includes(origen) ? origen : null;
  return origen && ORIGENES.some((r) => r.test(origen)) ? origen : null;
}

export function permisos(req, res, next) {
  if (req.method === "OPTIONS" || esDelEquipo(req)) return next();
  const lectura = req.method === "GET" && !LECTURAS_PRIVADAS.some((r) => r.test(req.path));
  const publica = ESCRITURAS_PUBLICAS.some(([metodo, r]) => metodo === req.method && r.test(req.path));
  if (lectura || publica) return next();
  res.status(401).json({ error: "Esto solo lo puede hacer quien administra Grieta" });
}

// Tope de envíos públicos por persona, para que nadie llene la base de reportes o precios falsos.
const VENTANA_MS = 60 * 60 * 1000;
const TOPE = Number(process.env.TOPE_ENVIOS_HORA ?? 120);
const envios = new Map();

export function limiteEnvios(req, res, next) {
  if (req.method !== "POST" || esDelEquipo(req) || req.path.startsWith("/api/cuentas")) return next();
  const quien = req.ip;
  const ahora = Date.now();
  const lista = (envios.get(quien) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length >= TOPE) return res.status(429).json({ error: "Mandaste muchos envíos seguidos. Intenta en un rato" });
  lista.push(ahora);
  envios.set(quien, lista);
  if (envios.size > 5000) envios.delete(envios.keys().next().value);
  next();
}

// Las copias se piden mas seguido que los envios (al abrir y al terminar cada viaje): tope propio por persona.
const TOPE_RESPALDOS = Number(process.env.TOPE_RESPALDOS_HORA ?? 120);
const respaldosPorIp = new Map();

export function limiteRespaldos(req, res, next) {
  const ahora = Date.now();
  const lista = (respaldosPorIp.get(req.ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length >= TOPE_RESPALDOS) return res.status(429).json({ error: "Muchas copias seguidas. Intenta en un rato" });
  lista.push(ahora);
  respaldosPorIp.set(req.ip, lista);
  if (respaldosPorIp.size > 5000) respaldosPorIp.delete(respaldosPorIp.keys().next().value);
  next();
}

// Las cuentas llevan su propio tope: en una red compartida no deben gastarse los envios de los demas.
const TOPE_CUENTAS = Number(process.env.TOPE_CUENTAS_HORA ?? 60);
const cuentasPorIp = new Map();

export function limiteCuentas(req, res, next) {
  if (req.method === "GET" || req.method === "OPTIONS" || esDelEquipo(req)) return next();
  const ahora = Date.now();
  const lista = (cuentasPorIp.get(req.ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length >= TOPE_CUENTAS) return res.status(429).json({ error: "Muchos intentos seguidos. Intenta en un rato" });
  lista.push(ahora);
  cuentasPorIp.set(req.ip, lista);
  if (cuentasPorIp.size > 5000) cuentasPorIp.delete(cuentasPorIp.keys().next().value);
  next();
}

// Encabezados básicos: el navegador no adivina tipos de archivo y no se anuncia con qué está hecho el servidor.
export function encabezados(_req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Frame-Options", "DENY");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Las respuestas de la API son datos, nunca una pagina: no se ejecuta nada si alguien las abre.
  if (_req.path.startsWith("/api")) res.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}
