import { Op } from "sequelize";
import { LlenoCamion, PrecioReportado, Queja, Reporte, SentirViaje, VerificacionReporte, ViajeCamion } from "../modelos.js";
import { ahoraEnQueretaro, DIAS_MINIMOS, llenosVigentes } from "./avisos.js";

// Datos abiertos y agregados para la ciudad: solo conteos, nunca texto libre, personas ni recorridos.
const DIA = 86400000;
let cache = { en: 0, datos: null };
// Franjas del dia para el "¿Cómo te fue?"; una linea aparece con al menos 3 respuestas.
const FRANJAS = [[5, 9, "5 a 9 am"], [9, 13, "9 am a 1 pm"], [13, 17, "1 a 5 pm"], [17, 21, "5 a 9 pm"], [21, 29, "9 pm a 5 am"]];
const MINIMO_SENTIR = 3;
const estres = (filas) => ({ total: filas.length, estresado: filas.filter((f) => f.valor === "estresado").length });
const contar = (filas, campo) => Object.entries(filas.reduce((m, f) => ({ ...m, [f[campo]]: (m[f[campo]] ?? 0) + 1 }), {}))
  .map(([clave, total]) => ({ clave, total })).sort((a, b) => b.total - a.total);

async function calcular() {
  const hace30 = new Date(Date.now() - 30 * DIA), hace56 = new Date(Date.now() - 56 * DIA);
  const [viajes, km, co2, quejas, reportes, votos, llenos, precios, sentires] = await Promise.all([
    ViajeCamion.count({ where: { demo: false } }), ViajeCamion.sum("km", { where: { demo: false } }), ViajeCamion.sum("co2_g", { where: { demo: false } }),
    Queja.findAll({ where: { createdAt: { [Op.gte]: hace30 } }, attributes: ["tipo", "ruta"], raw: true }),
    Reporte.findAll({ attributes: ["id", "tipo", "parada"], raw: true }),
    VerificacionReporte.findAll({ attributes: ["reporte_id", "sigue"], raw: true }),
    LlenoCamion.findAll({ where: { fecha: { [Op.gte]: hace56.toISOString().slice(0, 10) } }, attributes: ["linea", "hora"], raw: true }),
    PrecioReportado.findAll({ attributes: ["app"], raw: true }),
    SentirViaje.findAll({ where: { fecha: { [Op.gte]: hace56.toISOString().slice(0, 10) } }, attributes: ["linea", "hora", "valor"], raw: true }),
  ]);
  // Igual que en la app: un reporte se da por arreglado si al menos 2 lo dicen y son mayoria.
  const vigentes = reportes.filter((r) => {
    const suyos = votos.filter((v) => v.reporte_id === r.id), arreglado = suyos.filter((v) => !v.sigue).length;
    return !(arreglado >= 2 && arreglado > suyos.length - arreglado);
  });
  const problemas = vigentes.filter((r) => r.tipo !== "referencia");
  const porHora = Array.from({ length: 24 }, (_, h) => llenos.filter((l) => l.hora === h).length);
  return {
    actualizado: new Date().toISOString(),
    impacto: { viajes, km: Math.round((km ?? 0) * 10) / 10, co2_kg: Math.round((co2 ?? 0) / 100) / 10 },
    quejas: { dias: 30, total: quejas.length, porTipo: contar(quejas, "tipo"), porRuta: contar(quejas, "ruta").slice(0, 10) },
    accesibilidad: { vigentes: problemas.length, porTipo: contar(problemas, "tipo"), porParada: contar(problemas.filter((r) => r.parada), "parada").slice(0, 8) },
    lleno: { dias: 56, total: llenos.length, porLinea: contar(llenos, "linea").slice(0, 10), porHora },
    precios: { total: precios.length, porApp: contar(precios, "app") },
    sentir: {
      dias: 56, total: sentires.length,
      porValor: Object.fromEntries(["tranquilo", "normal", "estresado"].map((v) => [v, sentires.filter((f) => f.valor === v).length])),
      porFranja: FRANJAS.map(([desde, hasta, clave]) => ({ clave, ...estres(sentires.filter((f) => (f.hora < 5 ? f.hora + 24 : f.hora) >= desde && (f.hora < 5 ? f.hora + 24 : f.hora) < hasta)) })),
      porLinea: [...new Set(sentires.map((f) => f.linea))].map((linea) => ({ clave: linea, ...estres(sentires.filter((f) => f.linea === linea)) }))
        .filter((l) => l.total >= MINIMO_SENTIR).sort((a, b) => b.estresado / b.total - a.estresado / a.total).slice(0, 10),
    },
  };
}

export const observatorio = async (_req, res) => {
  if (!cache.datos || Date.now() - cache.en > 5 * 60 * 1000) cache = { en: Date.now(), datos: await calcular() };
  res.json(cache.datos);
};

// Lo de ahorita para Qro al dia: sin texto, ubicacion ni persona. Las lineas van todas y cada telefono filtra las suyas.
const VIVO_MS = 30 * 1000;
const AVISOS_MAX = 6;
const ARREGLADOS_MAX = 2;
let cacheVivo = { en: 0, datos: null };

async function calcularVivo() {
  const { finde } = ahoraEnQueretaro();
  const hace7 = new Date(Date.now() - 7 * DIA), hace30 = Date.now() - 30 * DIA, desde = ahoraEnQueretaro(new Date(Date.now() - 56 * DIA)).fecha;
  const [reportes, votos, quejas, llenos] = await Promise.all([
    Reporte.findAll({ where: { parada: { [Op.ne]: null }, tipo: { [Op.ne]: "referencia" } }, attributes: ["id", "tipo", "parada", "createdAt"], order: [["createdAt", "DESC"]], raw: true }),
    VerificacionReporte.findAll({ attributes: ["reporte_id", "sigue", "createdAt"], raw: true }),
    Queja.findAll({ where: { createdAt: { [Op.gte]: hace7 } }, attributes: ["tipo", "ruta"], raw: true }),
    LlenoCamion.findAll({ where: { finde, fecha: { [Op.gte]: desde } }, attributes: ["linea", "hora", "fecha"], raw: true }),
  ]);
  const conVotos = reportes.map((r) => {
    const suyos = votos.filter((v) => v.reporte_id === r.id), no = suyos.filter((v) => !v.sigue);
    return { id: r.id, tipo: r.tipo, parada: r.parada, creado: new Date(r.createdAt).toISOString(), sigue: suyos.length - no.length, arreglado: no.length, ultimo: Math.max(0, ...suyos.map((v) => new Date(v.createdAt).getTime())) };
  });
  const resuelto = (r) => r.arreglado >= 2 && r.arreglado > r.sigue;
  const sinUltimo = ({ ultimo, ...r }) => r;
  const vivos = llenosVigentes();
  const avisos = [...vivos.map((a) => ({ tipo: "lleno", linea: a.linea, creado: new Date(a.t).toISOString(), veces: a.veces })), ...conVotos.filter((r) => !resuelto(r)).map(sinUltimo)]
    .sort((a, b) => new Date(b.creado) - new Date(a.creado)).slice(0, AVISOS_MAX);
  const arreglados = conVotos.filter((r) => resuelto(r) && r.ultimo >= hace30).sort((a, b) => b.ultimo - a.ultimo).slice(0, ARREGLADOS_MAX)
    .map((r) => ({ tipo: r.tipo, parada: r.parada, personas: r.arreglado }));

  const lineas = {};
  const de = (l) => (lineas[l] ??= {});
  for (const a of vivos) de(a.linea).lleno = new Date(a.t).toISOString();
  const dias = new Map();
  for (const f of llenos) {
    const k = `${f.linea}|${f.hora}`;
    if (!dias.has(k)) dias.set(k, new Set());
    dias.get(k).add(f.fecha);
  }
  for (const [k, s] of dias) {
    if (s.size < DIAS_MINIMOS) continue;
    const [l, h] = k.split("|");
    (de(l).suele ??= []).push(Number(h));
  }
  for (const l of Object.values(lineas)) l.suele?.sort((a, b) => a - b);
  for (const [ruta, filas] of Object.entries(Object.groupBy(quejas.filter((q) => q.ruta), (q) => q.ruta.toUpperCase()))) {
    de(ruta).quejas = { total: filas.length, tipo: contar(filas, "tipo")[0].clave };
  }
  return { actualizado: new Date().toISOString(), avisos, arreglados, lineas };
}

export const observatorioVivo = async (_req, res) => {
  if (!cacheVivo.datos || Date.now() - cacheVivo.en > VIVO_MS) cacheVivo = { en: Date.now(), datos: await calcularVivo() };
  res.json(cacheVivo.datos);
};
