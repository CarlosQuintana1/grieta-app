// Genera demo/datos/envivo.json para Qro en vivo: hexagonos H3 reales, CO2 estimado por zona y avisos de ejemplo.
// Uso: NODE_PATH=<carpeta con h3-js> node scripts/envivo-datos.cjs
const h3 = require('h3-js'); const fs = require('fs'); const path = require('path');
const R = path.join(__dirname, '..'), M = path.join(R, 'modelo/datos');
const r4 = (v) => Math.round(v * 1e4) / 1e4, borde = (c) => h3.cellToBoundary(c).map(([a, b]) => [r4(a), r4(b)]);
const filas = fs.readFileSync(path.join(M, 'dataset.csv'), 'utf8').trim().split('\n'); const cab = filas.shift().split(',');
const [io, id, ik, im] = ['h3_o', 'h3_d', 'distancia_km', 'momento_id'].map((k) => cab.indexOf(k));
// Un viaje por momento: el mismo viaje se cotizo en las tres apps.
const viajes = new Map(); for (const f of filas) { const c = f.split(','); if (!viajes.has(c[im])) viajes.set(c[im], { o: c[io], d: c[id], km: +c[ik] }); }
const z = {}; for (const v of viajes.values()) for (const c of [v.o, v.d]) { const r = (z[c] ??= { viajes: 0, co2: 0 }); r.viajes += 0.5; r.co2 += v.km * 0.1357 / 2; }
const st = fs.readFileSync(path.join(M, 'gtfs_qrobus/stops.txt'), 'utf8').trim().split('\n'); const sc = st.shift().split(',');
const la = sc.indexOf('stop_lat'), lo = sc.indexOf('stop_lon');
const paradas = st.map((l) => l.split(',')).map((c) => [+c[la], +c[lo]]).filter(([a]) => a > 20);
const porCelda = {}; for (const [a, b] of paradas) { const k = h3.latLngToCell(a, b, 7); porCelda[k] = (porCelda[k] || 0) + 1; }
const lugares = JSON.parse(fs.readFileSync(path.join(R, 'demo/datos/lugares.json'), 'utf8')); const lista = (Array.isArray(lugares) ? lugares : lugares.lugares || []).filter((l) => l.lat);
const ZONA = { 'Aeropuerto Intercontinental de Querétaro': 'Aeropuerto', 'Terminal de Autobuses de Querétaro': 'Terminal de Autobuses', 'Antea Lifestyle Center': 'Antea', 'Plaza Ubika El Refugio': 'El Refugio', 'Cafelé Zibatá': 'Zibatá', 'Jardín Zenea': 'Centro', 'Facultad de Informática UAQ': 'Juriquilla' };
const nombre = (c) => { const [a, b] = h3.cellToLatLng(c); let m = null, dm = 1e9; for (const l of lista) { const d = (l.lat - a) ** 2 + (l.lon - b) ** 2; if (d < dm) { dm = d; m = l.nombre; } } return ZONA[m] || m; };
const zonas = Object.entries(z).map(([c, r]) => ({ b: borde(c), viajes: Math.round(r.viajes), co2: Math.round(r.co2), paradas: porCelda[c] || 0, nombre: nombre(c) }))
  .sort((a, b) => b.viajes / (1 + b.paradas) - a.viajes / (1 + a.paradas));
const vecinas = [...new Set(Object.keys(z).flatMap((c) => h3.gridDisk(c, 2)))].filter((c) => !z[c]).map(borde);
const salida = {
  nota: 'Hexagonos, paradas, CO2 y zonas salen del dataset y del GTFS. Avisos y comentarios son de ejemplo para la feria.',
  totalViajes: viajes.size, totalCo2: Math.round(Object.values(z).reduce((s, r) => s + r.co2, 0)),
  zonas, vecinas, paradas: paradas.filter((_, i) => i % 2 === 0).map(([a, b]) => [r4(a), r4(b)]),
  avisos: [
    { tipo: 'choque', lat: 20.6195, lon: -100.3955, titulo: 'Choque en Bernardo Quintana', texto: '3 viajeros lo confirmaron. Te sugiero otra ruta.', hace: 'hace 2 min' },
    { tipo: 'trafico', lat: 20.655, lon: -100.37, titulo: 'Tráfico lento en 5 de Febrero', texto: 'La C55 va 12 min tarde.', hace: 'hace 5 min' },
    { tipo: 'tiempo', lat: 20.6905, lon: -100.4405, titulo: 'C69 a tiempo', texto: 'Llegó justo a la hora, dicen 8 viajeros.', hace: 'hace 6 min' },
    { tipo: 'techo', lat: 20.67, lon: -100.33, titulo: 'Parada sin techo', texto: 'Está lloviendo y no hay dónde cubrirse.', hace: 'hace 11 min' },
    { tipo: 'comentario', lat: 20.6, lon: -100.43, titulo: 'Va lleno', texto: 'La C48 viene llena desde El Pueblito.', hace: 'hace 14 min' },
  ],
  trafico: [
    { tipo: 'lento', puntos: [[20.72, -100.40], [20.66, -100.405], [20.61, -100.395], [20.56, -100.385]] },
    { tipo: 'medio', puntos: [[20.70, -100.35], [20.64, -100.37], [20.59, -100.40]] },
    { tipo: 'fluido', puntos: [[20.704, -100.444], [20.69, -100.44], [20.675, -100.437]] },
  ],
  rutas: {
    C69: { atiempo: 84, barras: [40, 65, 55, 90, 75, 84], publicaciones: [
      { quien: 'Viajero de Juriquilla', inicial: 'J', donde: 'Parada Facultad de Informática', hace: 'hace 4 min', texto: 'Llegó a tiempo y con lugar para sentarse.', tags: ['A tiempo', 'Con lugar'], util: 23, tambien: 9 },
      { quien: 'Viajera de la C69', inicial: 'R', donde: 'Paseo de la República', hace: 'hace 11 min', texto: 'La parada no tiene techo y está lloviendo.', tags: ['Parada sin techo', 'Se mandó a Qrobus'], util: 41, tambien: 17 } ] },
    C55: { atiempo: 61, barras: [70, 50, 45, 60, 58, 61], publicaciones: [
      { quien: 'Viajero de Centro Sur', inicial: 'C', donde: 'Av. 5 de Febrero', hace: 'hace 7 min', texto: 'Mucho tráfico, va 12 minutos tarde.', tags: ['Tarde', 'Tráfico'], util: 18, tambien: 12 } ] },
    C48: { atiempo: 73, barras: [60, 72, 80, 66, 70, 73], publicaciones: [
      { quien: 'Viajera de El Pueblito', inicial: 'P', donde: 'Walmart El Pueblito', hace: 'hace 14 min', texto: 'Viene lleno, mejor espera el siguiente.', tags: ['Va lleno'], util: 15, tambien: 6 } ] },
  },
};
fs.writeFileSync(path.join(R, 'demo/datos/envivo.json'), JSON.stringify(salida));
console.log('zonas', zonas.length, 'vecinas', vecinas.length, 'paradas', salida.paradas.length, 'co2', salida.totalCo2, 'kB', (fs.statSync(path.join(R, 'demo/datos/envivo.json')).size / 1024).toFixed(0));
console.log(zonas.slice(0, 5).map((z) => `${z.nombre} ${z.viajes}/${z.paradas}`).join(', '));
