import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

// Base en memoria: cada corrida de pruebas empieza limpia y no toca database.sqlite.
process.env.SQLITE = ":memory:";
process.env.CLAVE_ADMIN = "clave-de-prueba";
const { app } = await import("../src/app.js");
const { sequelize } = await import("../src/modelos.js");
const { sembrar } = await import("../src/semilla.js");

// Las pruebas del CRUD van como el equipo; las de permisos, como cualquier persona.
const equipo = () => request.agent(app).set("X-Clave-Admin", "clave-de-prueba");
const publico = () => request(app);

let usuario;
let registro;

before(async () => {
  await sequelize.sync();
  await sembrar();
});

describe("Lugares", () => {
  test("GET /api/lugares trae los 16 del catalogo", async () => {
    const res = await equipo().get("/api/lugares").expect(200);
    assert.equal(res.body.length, 16);
  });

  test("POST, PUT y DELETE /api/lugares", async () => {
    const nuevo = await equipo().post("/api/lugares")
      .send({ clave: "prueba", nombre: "Lugar de prueba", lat: 20.6, lon: -100.4 }).expect(201);
    const cambiado = await equipo().put(`/api/lugares/${nuevo.body.id}`)
      .send({ nombre: "Lugar renombrado" }).expect(200);
    assert.equal(cambiado.body.nombre, "Lugar renombrado");
    await equipo().delete(`/api/lugares/${nuevo.body.id}`).expect(204);
    await equipo().get(`/api/lugares/${nuevo.body.id}`).expect(404);
  });

  test("POST /api/lugares rechaza una latitud imposible", async () => {
    await equipo().post("/api/lugares").send({ clave: "mal", nombre: "Mal", lat: 200, lon: 0 }).expect(400);
  });
});

describe("Rutas", () => {
  test("GET /api/rutas trae las 32 con su origen y destino", async () => {
    const res = await equipo().get("/api/rutas").expect(200);
    assert.equal(res.body.length, 32);
    assert.ok(res.body[0].origen.nombre && res.body[0].destino.nombre);
  });

  test("GET /api/rutas/:id", async () => {
    const res = await equipo().get("/api/rutas/1").expect(200);
    assert.equal(res.body.id, 1);
  });
});

describe("Usuarios", () => {
  test("POST /api/usuarios", async () => {
    const res = await equipo().post("/api/usuarios")
      .send({ nombre: "Capturista de prueba", correo: "prueba@ejemplo.com", rol: "capturista" }).expect(201);
    usuario = res.body;
  });

  test("POST /api/usuarios rechaza un correo repetido", async () => {
    await equipo().post("/api/usuarios").send({ nombre: "Otro", correo: "prueba@ejemplo.com" }).expect(409);
  });
});

describe("Registros y cotizaciones", () => {
  test("POST /api/registros guarda el registro con sus tres precios", async () => {
    const res = await equipo().post("/api/registros").send({
      ruta_id: 1, usuario_id: usuario.id, temperatura_c: 22.5, lluvia_mm: 0,
      cotizaciones: [{ app: "uber", precio: 89.9 }, { app: "didi", precio: 76 }, { app: "indrive", precio: 80 }],
    }).expect(201);
    assert.equal(res.body.cotizaciones.length, 3);
    registro = res.body;
  });

  test("POST /api/registros rechaza un registro con una sola app", async () => {
    const res = await equipo().post("/api/registros")
      .send({ ruta_id: 1, usuario_id: usuario.id, cotizaciones: [{ app: "uber", precio: 90 }] }).expect(400);
    assert.match(res.body.error, /al menos 2 apps/);
  });

  test("POST /api/registros rechaza una ruta que no existe", async () => {
    await equipo().post("/api/registros").send({
      ruta_id: 999, usuario_id: usuario.id,
      cotizaciones: [{ app: "uber", precio: 90 }, { app: "didi", precio: 80 }],
    }).expect(400);
  });

  test("GET /api/registros y GET /api/registros/:id", async () => {
    const lista = await equipo().get("/api/registros").expect(200);
    assert.equal(lista.body.length, 1);
    const uno = await equipo().get(`/api/registros/${registro.id}`).expect(200);
    assert.equal(uno.body.ruta.origen.clave, "fi-uaq");
  });

  test("GET /api/registros/:id/cotizaciones las ordena de la mas barata a la mas cara", async () => {
    const res = await equipo().get(`/api/registros/${registro.id}/cotizaciones`).expect(200);
    assert.deepEqual(res.body.map((c) => c.app), ["didi", "indrive", "uber"]);
  });
});

describe("Consultas al agente", () => {
  test("POST /api/consultas recomienda la app mas barata del ultimo registro", async () => {
    const ruta = (await equipo().get("/api/rutas/1")).body;
    const res = await equipo().post("/api/consultas")
      .send({ origen_id: ruta.origen_id, destino_id: ruta.destino_id, precio_visto: 95 }).expect(201);
    assert.equal(res.body.consulta.recomendacion, "didi");
  });

  test("GET /api/consultas", async () => {
    const res = await equipo().get("/api/consultas").expect(200);
    assert.equal(res.body.length, 1);
  });
});

describe("Borrado y errores", () => {
  test("DELETE /api/lugares/:id no borra un lugar que tiene rutas", async () => {
    await equipo().delete("/api/lugares/1").expect(409);
    await equipo().get("/api/lugares/1").expect(200);
  });

  test("DELETE /api/usuarios/:id no borra a quien tiene registros", async () => {
    await equipo().delete(`/api/usuarios/${usuario.id}`).expect(409);
  });

  test("DELETE /api/registros/:id borra tambien sus cotizaciones", async () => {
    await equipo().delete(`/api/registros/${registro.id}`).expect(204);
    await equipo().get(`/api/registros/${registro.id}/cotizaciones`).expect(404);
  });

  test("GET /api/salud y una ruta inexistente", async () => {
    await equipo().get("/api/salud").expect(200);
    await equipo().get("/api/no-existe").expect(404);
  });
});

describe("Reportes de accesibilidad", () => {
  let reporte;

  test("POST /api/reportes guarda un problema en una parada", async () => {
    const res = await equipo().post("/api/reportes")
      .send({ tipo: "banqueta", parada: "Av. Universidad/Hidalgo", lat: 20.5942, lon: -100.3925, descripcion: "Banqueta levantada" })
      .expect(201);
    reporte = res.body;
    assert.equal(reporte.tipo, "banqueta");
  });

  test("POST /api/reportes rechaza un punto fuera de Querétaro", async () => {
    await equipo().post("/api/reportes").send({ tipo: "otro", lat: 19.43, lon: -99.13 }).expect(400);
  });

  test("GET /api/reportes con lat y lon trae solo los cercanos", async () => {
    const cerca = await equipo().get("/api/reportes?lat=20.5943&lon=-100.3926&radio=200").expect(200);
    assert.equal(cerca.body.length, 1);
    assert.ok(cerca.body[0].metros < 50);
    const lejos = await equipo().get("/api/reportes?lat=20.7043&lon=-100.4439&radio=200").expect(200);
    assert.equal(lejos.body.length, 0);
  });

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  let foto;

  test("POST /api/reportes/:id/foto guarda la imagen y su dirección", async () => {
    const res = await equipo().post(`/api/reportes/${reporte.id}/foto`)
      .set("Content-Type", "image/png").send(png).expect(200);
    assert.match(res.body.foto_url, /\.png$/);
    foto = res.body.foto_url;
    await equipo().get(foto).expect(200);
  });

  test("POST /api/reportes/:id/foto con otra foto borra la anterior", async () => {
    const res = await equipo().post(`/api/reportes/${reporte.id}/foto`)
      .set("Content-Type", "image/png").send(png).expect(200);
    await equipo().get(foto).expect(404);
    foto = res.body.foto_url;
  });

  test("POST /api/reportes/:id/foto rechaza lo que no es imagen", async () => {
    await equipo().post(`/api/reportes/${reporte.id}/foto`)
      .set("Content-Type", "text/plain").send("hola").expect(400);
  });

  test("DELETE /api/reportes/:id borra el reporte y su foto", async () => {
    await equipo().delete(`/api/reportes/${reporte.id}`).expect(204);
    await equipo().get(`/api/reportes/${reporte.id}`).expect(404);
    await equipo().get(foto).expect(404);
  });
});

describe("Precios reportados", () => {
  test("POST y GET /api/precios-reportados", async () => {
    await equipo().post("/api/precios-reportados")
      .send({ app: "didi", precio: 118, lat_origen: 20.7043, lon_origen: -100.4439, lat_destino: 20.5931, lon_destino: -100.3926 })
      .expect(201);
    const res = await equipo().get("/api/precios-reportados").expect(200);
    assert.equal(res.body.length, 1);
  });

  test("POST /api/precios-reportados rechaza un precio absurdo", async () => {
    await equipo().post("/api/precios-reportados")
      .send({ app: "uber", precio: 5, lat_origen: 20.7, lon_origen: -100.4, lat_destino: 20.6, lon_destino: -100.39 })
      .expect(400);
  });
});

describe("CRUD completo de cada tabla", () => {
  test("Rutas: crear, modificar y borrar", async () => {
    const nueva = await equipo().post("/api/rutas")
      .send({ origen_id: 1, destino_id: 2, distancia_km: 9.9, minutos_sin_trafico: 15 }).expect(201);
    const cambiada = await equipo().put(`/api/rutas/${nueva.body.id}`).send({ minutos_sin_trafico: 18 }).expect(200);
    assert.equal(cambiada.body.minutos_sin_trafico, 18);
    await equipo().delete(`/api/rutas/${nueva.body.id}`).expect(204);
  });

  test("Registros y cotizaciones: modificar la nota y corregir un precio", async () => {
    const reg = await equipo().post("/api/registros").send({
      ruta_id: 1, usuario_id: usuario.id,
      cotizaciones: [{ app: "uber", precio: 120 }, { app: "didi", precio: 99 }],
    }).expect(201);
    await equipo().put(`/api/registros/${reg.body.id}`).send({ nota: "Lluvia ligera" }).expect(200);
    const cot = reg.body.cotizaciones.find((c) => c.app === "uber");
    const corregida = await equipo().put(`/api/cotizaciones/${cot.id}`).send({ precio: 125, app: "didi" }).expect(200);
    assert.equal(Number(corregida.body.precio), 125);
    assert.equal(corregida.body.app, "uber");
    const extra = await equipo().post("/api/cotizaciones").send({ registro_id: reg.body.id, app: "indrive", precio: 90 }).expect(201);
    await equipo().post("/api/cotizaciones").send({ registro_id: reg.body.id, app: "indrive", precio: 95 }).expect(409);
    await equipo().get(`/api/cotizaciones/${extra.body.id}`).expect(200);
    await equipo().delete(`/api/cotizaciones/${extra.body.id}`).expect(204);
    await equipo().delete(`/api/registros/${reg.body.id}`).expect(204);
  });

  test("Consultas: ver, modificar y borrar", async () => {
    const c = await equipo().post("/api/consultas").send({ origen_id: 1, destino_id: 2 }).expect(201);
    const id = c.body.consulta.id;
    await equipo().get(`/api/consultas/${id}`).expect(200);
    await equipo().put(`/api/consultas/${id}`).send({ precio_visto: 140 }).expect(200);
    await equipo().delete(`/api/consultas/${id}`).expect(204);
  });

  test("Reportes y precios reportados: modificar y borrar", async () => {
    const r = await equipo().post("/api/reportes").send({ tipo: "sin_techo", lat: 20.6, lon: -100.4 }).expect(201);
    const cambiado = await equipo().put(`/api/reportes/${r.body.id}`).send({ descripcion: "Sin banca" }).expect(200);
    assert.equal(cambiado.body.descripcion, "Sin banca");
    await equipo().delete(`/api/reportes/${r.body.id}`).expect(204);
    const p = await equipo().post("/api/precios-reportados")
      .send({ app: "uber", precio: 150, lat_origen: 20.7, lon_origen: -100.4, lat_destino: 20.6, lon_destino: -100.39 }).expect(201);
    await equipo().get(`/api/precios-reportados/${p.body.id}`).expect(200);
    await equipo().put(`/api/precios-reportados/${p.body.id}`).send({ precio: 155 }).expect(200);
    await equipo().delete(`/api/precios-reportados/${p.body.id}`).expect(204);
  });
});

describe("Buscar", () => {
  test("GET /api/buscar sin llave responde 503 para que la app siga con su otro buscador", async () => {
    delete process.env.AZURE_MAPS_KEY;
    await equipo().get("/api/buscar?q=INE").expect(503);
  });

  test("GET /api/buscar rechaza una busqueda muy corta", async () => {
    await equipo().get("/api/buscar?q=ab").expect(400);
  });
});

describe("Permisos", () => {
  test("sin la clave del equipo no se ven usuarios, precios reportados ni consultas", async () => {
    for (const ruta of ["/api/usuarios", "/api/precios-reportados", "/api/consultas"]) await publico().get(ruta).expect(401);
  });

  test("sin la clave no se puede cambiar ni borrar nada", async () => {
    await publico().put("/api/lugares/1").send({ nombre: "Cambiado" }).expect(401);
    await publico().delete("/api/registros/1").expect(401);
    await publico().post("/api/usuarios").send({ nombre: "X", correo: "x@ejemplo.com" }).expect(401);
  });

  test("cualquiera puede leer rutas, reportar un problema y mandar un precio", async () => {
    await publico().get("/api/rutas").expect(200);
    const r = await publico().post("/api/reportes").send({ tipo: "obstaculo", lat: 20.6, lon: -100.4 }).expect(201);
    await publico().post("/api/precios-reportados")
      .send({ app: "didi", precio: 80, lat_origen: 20.6, lon_origen: -100.4, lat_destino: 20.7, lon_destino: -100.44 }).expect(201);
    // La foto entra una vez; la segunda ya no.
    const foto = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await publico().post(`/api/reportes/${r.body.id}/foto`).set("Content-Type", "image/jpeg").send(foto).expect(200);
    await publico().post(`/api/reportes/${r.body.id}/foto`).set("Content-Type", "image/jpeg").send(foto).expect(403);
  });

  test("el servidor no dice con qué está hecho", async () => {
    const res = await publico().get("/api/salud").expect(200);
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });
});

describe("Avisos de la parada", () => {
  test("cualquiera dice que ya pasó un camión y quien está cerca lo ve", async () => {
    await publico().post("/api/camiones/avisos").send({ tipo: "paso", linea: "c69", lat: 20.7, lon: -100.44 }).expect(201);
    const cerca = await publico().get("/api/camiones/avisos?lat=20.7001&lon=-100.4401").expect(200);
    assert.equal(cerca.body[0].linea, "C69");
    assert.equal(cerca.body[0].minutos, 0);
    const lejos = await publico().get("/api/camiones/avisos?lat=20.6&lon=-100.4").expect(200);
    assert.equal(lejos.body.length, 0);
  });

  test("rechaza un aviso sin línea o fuera de Querétaro", async () => {
    await publico().post("/api/camiones/avisos").send({ tipo: "paso", lat: 20.7, lon: -100.44 }).expect(400);
    await publico().post("/api/camiones/avisos").send({ tipo: "lleno", linea: "C69", lat: 19.4, lon: -99.1 }).expect(400);
  });
});

describe("Avisos con la pantalla bloqueada", () => {
  const suscripcion = { endpoint: "https://push.ejemplo.com/abc", keys: { p256dh: "x", auth: "y" } };
  const dentroDe = (min) => new Date(Date.now() + min * 60000).toISOString();

  test("sin llaves VAPID responde 503", async () => {
    await publico().get("/api/notificaciones/clave").expect(503);
  });

  test("con llaves, programa avisos válidos y rechaza los que no", async () => {
    const { default: webpush } = await import("web-push");
    const llaves = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLICO = llaves.publicKey;
    process.env.VAPID_PRIVADO = llaves.privateKey;
    const clave = await publico().get("/api/notificaciones/clave").expect(200);
    assert.equal(clave.body.clave, llaves.publicKey);
    const ok = await publico().post("/api/notificaciones")
      .send({ suscripcion, avisos: [{ cuando: dentroDe(60 * 24), titulo: "La C69 pasa en 5 minutos" }] }).expect(201);
    assert.equal(ok.body.programados, 1);
    await publico().post("/api/notificaciones")
      .send({ suscripcion, avisos: [{ cuando: dentroDe(60 * 24 * 9), titulo: "Demasiado lejos" }] }).expect(400);
    await publico().post("/api/notificaciones/cancelar").send({ endpoint: suscripcion.endpoint }).expect(204);
    delete process.env.VAPID_PUBLICO;
    delete process.env.VAPID_PRIVADO;
  });
});

describe("Viajes en camión", () => {
  test("cualquiera cuenta un viaje y el total suma km y CO₂ sin guardar lugares", async () => {
    const antes = (await publico().get("/api/impacto").expect(200)).body;
    await publico().post("/api/viajes").send({ km: 3.2, lat: 20.6, destino: "Casa" }).expect(201);
    const despues = (await publico().get("/api/impacto").expect(200)).body;
    assert.equal(despues.viajes, antes.viajes + 1);
    assert.equal(Math.round((despues.km - antes.km) * 10) / 10, 3.2);
    assert.equal(Math.round((despues.co2_kg - antes.co2_kg) * 10) / 10, 0.4);
    const { ViajeCamion } = await import("../src/modelos.js");
    assert.deepEqual(Object.keys(ViajeCamion.getAttributes()).sort(), ["co2_g", "demo", "id", "km"]);
  });

  test("rechaza un viaje sin distancia o imposible", async () => {
    await publico().post("/api/viajes").send({}).expect(400);
    await publico().post("/api/viajes").send({ km: 500 }).expect(400);
    await publico().post("/api/viajes").send({ km: 0.1 }).expect(400);
  });

  test("solo el equipo mete y quita viajes de demostración", async () => {
    await publico().post("/api/viajes/demo").send({ km: 3.7 }).expect(401);
    await publico().delete("/api/viajes/demo").expect(401);
    const antes = (await publico().get("/api/impacto").expect(200)).body;
    await publico().post("/api/viajes").send({ km: 2, demo: true }).expect(201);
    await equipo().post("/api/viajes/demo").send({ km: 3.7 }).expect(201);
    const con = (await publico().get("/api/impacto").expect(200)).body;
    assert.equal(con.demo, antes.demo + 1);
    assert.equal(Math.round((con.co2_kg - antes.co2_kg) * 10) / 10, 0.8);
    const quitados = await equipo().delete("/api/viajes/demo").expect(200);
    assert.equal(quitados.body.borrados, antes.demo + 1);
    const sin = (await publico().get("/api/impacto").expect(200)).body;
    assert.equal(sin.demo, 0);
    assert.equal(sin.viajes, antes.viajes + 1);
  });

  test("nadie lee la lista de viajes uno por uno", async () => {
    await publico().get("/api/viajes").expect(404);
  });
});

describe("Camiones que suelen ir llenos", () => {
  test("una línea suele ir llena si lo avisan en 3 días distintos a esta hora, sin guardar ubicación", async () => {
    const { LlenoCamion } = await import("../src/modelos.js");
    assert.deepEqual(Object.keys(LlenoCamion.getAttributes()).sort(), ["fecha", "finde", "hora", "id", "linea"]);
    await publico().post("/api/camiones/avisos").send({ tipo: "lleno", linea: "L55", lat: 20.6, lon: -100.4 }).expect(201);
    assert.deepEqual((await publico().get("/api/camiones/ocupacion?lineas=L55,C69").expect(200)).body.llenas, []);
    const hoy = (await LlenoCamion.findOne({ where: { linea: "L55" }, raw: true }));
    const antes = (dias) => new Date(Date.parse(hoy.fecha) - dias * 86400000).toISOString().slice(0, 10);
    await LlenoCamion.bulkCreate([1, 2].map((d) => ({ ...hoy, id: undefined, fecha: antes(d * 7) })));
    assert.deepEqual((await publico().get("/api/camiones/ocupacion?lineas=L55,C69").expect(200)).body.llenas, ["L55"]);
  });

  test("pide las líneas", async () => {
    await publico().get("/api/camiones/ocupacion").expect(400);
  });
});

describe("Tiempo en auto con tráfico", () => {
  test("sin llave de Azure Maps responde 503 y pide origen y destino en Querétaro", async () => {
    const llave = process.env.AZURE_MAPS_KEY;
    delete process.env.AZURE_MAPS_KEY;
    await publico().get("/api/auto?olat=20.7&olon=-100.44&dlat=20.59&dlon=-100.39").expect(503);
    await publico().get("/api/auto?olat=19.4&olon=-99.1&dlat=20.59&dlon=-100.39").expect(400);
    await publico().get("/api/auto").expect(400);
    if (llave) process.env.AZURE_MAPS_KEY = llave;
  });
});

describe("Reportes verificados por la gente", () => {
  test("cualquiera confirma o desmiente un reporte y se oculta si lo arreglaron", async () => {
    const r = (await publico().post("/api/reportes").send({ tipo: "sin_rampa", lat: 20.61, lon: -100.41 }).expect(201)).body;
    await publico().post(`/api/reportes/${r.id}/verificar`).send({ sigue: true }).expect(201);
    let lista = (await publico().get("/api/reportes?lat=20.61&lon=-100.41&radio=20").expect(200)).body;
    assert.equal(lista.find((x) => x.id === r.id).sigue, 1);
    await publico().post(`/api/reportes/${r.id}/verificar`).send({ sigue: false }).expect(201);
    await publico().post(`/api/reportes/${r.id}/verificar`).send({ sigue: false }).expect(201);
    lista = (await publico().get("/api/reportes?lat=20.61&lon=-100.41&radio=20").expect(200)).body;
    assert.equal(lista.some((x) => x.id === r.id), false);
  });

  test("pide sí o no y un reporte que exista", async () => {
    await publico().post("/api/reportes/999999/verificar").send({ sigue: true }).expect(404);
    const r = (await publico().post("/api/reportes").send({ tipo: "sin_techo", lat: 20.62, lon: -100.42 }).expect(201)).body;
    await publico().post(`/api/reportes/${r.id}/verificar`).send({ sigue: "tal vez" }).expect(400);
  });
});

describe("Quejas del servicio", () => {
  test("cualquiera manda una queja y el resumen solo cuenta, sin el texto", async () => {
    const q = await publico().post("/api/quejas").send({ tipo: "no_paro", ruta: " c53 ", unidad: "1234", lat: 20.5943, lon: -100.3926, descripcion: "No paró en la parada" }).expect(201);
    assert.equal(q.body.ruta, "C53");
    await publico().post("/api/quejas").send({ tipo: "sucio", ruta: "C53", lat: 20.5944, lon: -100.3927 }).expect(201);
    const r = await publico().get("/api/quejas/resumen?ruta=c53").expect(200);
    assert.equal(r.body.total, 2);
    assert.equal(r.body.porTipo.no_paro, 1);
    assert.equal(JSON.stringify(r.body).includes("paró"), false);
    const cerca = await publico().get("/api/quejas/resumen?lat=20.5943&lon=-100.3926&radio=100").expect(200);
    assert.equal(cerca.body.total, 2);
  });
  test("la lista con el texto es solo del equipo", async () => {
    await publico().get("/api/quejas").expect(401);
    await publico().get("/api/quejas/1").expect(401);
    await equipo().get("/api/quejas").expect(200);
  });
  test("rechaza tipos inventados, rutas raras y puntos fuera de Querétaro", async () => {
    await publico().post("/api/quejas").send({ tipo: "inventado", ruta: "C53", lat: 20.59, lon: -100.39 }).expect(400);
    await publico().post("/api/quejas").send({ tipo: "sucio", ruta: "<script>", lat: 20.59, lon: -100.39 }).expect(400);
    await publico().post("/api/quejas").send({ tipo: "sucio", ruta: "C53", lat: 19.43, lon: -99.13 }).expect(400);
    await publico().get("/api/quejas/resumen").expect(400);
  });
});

describe("¿Cómo te fue?", () => {
  test("rechaza valores inventados y líneas raras", async () => {
    await equipo().post("/api/sentir").send({ linea: "C69", valor: "feliz" }).expect(400);
    await equipo().post("/api/sentir").send({ linea: "<b>", valor: "normal" }).expect(400);
    await equipo().post("/api/sentir").send({ valor: "normal" }).expect(400);
  });
});

describe("Observatorio", () => {
  test("GET /api/observatorio es público y solo trae conteos", async () => {
    await publico().post("/api/quejas").send({ tipo: "manejo", ruta: "C24", lat: 20.59, lon: -100.39, descripcion: "Texto privado de prueba" }).expect(201);
    for (const valor of ["estresado", "estresado", "tranquilo"]) await equipo().post("/api/sentir").send({ linea: "c69", valor }).expect(201);
    await equipo().post("/api/sentir").send({ linea: "L118", valor: "normal" }).expect(201);
    const r = await publico().get("/api/observatorio").expect(200);
    assert.equal(r.body.sentir.total, 4);
    assert.deepEqual(r.body.sentir.porLinea, [{ clave: "C69", total: 3, estresado: 2 }]);
    assert.equal(r.body.sentir.porFranja.reduce((s, f) => s + f.total, 0), 4);
    for (const k of ["impacto", "quejas", "accesibilidad", "lleno", "precios"]) assert.ok(r.body[k], k);
    assert.equal(r.body.lleno.porHora.length, 24);
    assert.equal(JSON.stringify(r.body).includes("Texto privado"), false);
    assert.ok(r.body.quejas.porRuta.some((x) => x.clave === "C24"));
  });
});

describe("Qro al día", () => {
  test("GET /api/observatorio/vivo publica avisos sin texto, ubicación ni persona", async () => {
    const dato = { lat: 20.59, lon: -100.39 };
    const bien = await equipo().post("/api/reportes").send({ tipo: "banqueta", parada: "Colon/Zaragoza", descripcion: "Texto privado vivo", ...dato }).expect(201);
    const arreglo = await equipo().post("/api/reportes").send({ tipo: "sin_rampa", parada: "Villas/Informatica", ...dato }).expect(201);
    await equipo().post("/api/reportes").send({ tipo: "referencia", parada: "Solo referencia", ...dato }).expect(201);
    await equipo().post("/api/reportes").send({ tipo: "obstaculo", ...dato }).expect(201);
    await equipo().post(`/api/reportes/${bien.body.id}/verificar`).send({ sigue: true }).expect(201);
    for (let i = 0; i < 2; i++) await equipo().post(`/api/reportes/${arreglo.body.id}/verificar`).send({ sigue: false }).expect(201);
    await equipo().post("/api/quejas").send({ tipo: "no_paro", ruta: "c60", ...dato }).expect(201);
    await equipo().post("/api/camiones/avisos").send({ tipo: "lleno", linea: "c34", ...dato }).expect(201);
    await equipo().post("/api/camiones/avisos/c34/confirmar").expect(201);
    await equipo().post("/api/camiones/avisos/L999/confirmar").expect(404);
    const r = await publico().get("/api/observatorio/vivo").expect(200);
    const lleno = r.body.avisos.find((a) => a.tipo === "lleno");
    assert.equal(lleno.linea, "C34");
    assert.equal(lleno.veces, 2);
    const reporte = r.body.avisos.find((a) => a.id === bien.body.id);
    assert.equal(reporte.sigue, 1);
    assert.equal(r.body.avisos.some((a) => a.id === arreglo.body.id), false);
    assert.deepEqual(r.body.arreglados[0], { tipo: "sin_rampa", parada: "Villas/Informatica", personas: 2 });
    assert.equal(r.body.lineas.C60.quejas.tipo, "no_paro");
    assert.ok(r.body.lineas.C34.lleno);
    const texto = JSON.stringify(r.body);
    for (const prohibido of ["Texto privado", "Solo referencia", '"lat"', '"lon"', "usuario"]) assert.equal(texto.includes(prohibido), false, prohibido);
  });
  test("cualquiera puede decir que también vio el camión lleno", async () => {
    const { permisos } = await import("../src/seguridad.js");
    let paso = false;
    permisos({ method: "POST", path: "/api/camiones/avisos/C34/confirmar", get: () => undefined }, {}, () => { paso = true; });
    assert.equal(paso, true);
  });
});

describe("Cuentas", () => {
  const clave = "a".repeat(64), nueva = "b".repeat(64), prueba = "c".repeat(64), llave = "QUJDRA==";
  const alta = { nombre: "Persona de prueba", correo: "Prueba@Grieta.test", clave, llave_cifrada: llave, prueba_llave: prueba };
  const conToken = (t) => ({ Authorization: `Bearer ${t}` });
  let token;
  test("una sesion abierta antes del corte ya no vale y una nueva si", async () => {
    const { Sesion } = await import("../src/modelos.js");
    const r = await publico().post("/api/cuentas").send({ ...alta, correo: "corte@grieta.test" }).expect(201);
    await publico().get("/api/cuentas/yo").set(conToken(r.body.token)).expect(200);
    await Sesion.update({ createdAt: new Date("2026-11-01T00:00:00Z") }, { where: {}, silent: true });
    const vieja = await publico().get("/api/cuentas/yo").set(conToken(r.body.token)).expect(401);
    assert.match(vieja.body.error, /Vuelve a entrar/);
    const otra = await publico().post("/api/cuentas/entrar").send({ correo: "corte@grieta.test", clave }).expect(200);
    await publico().get("/api/cuentas/yo").set(conToken(otra.body.token)).expect(200);
  });

  test("crea la cuenta sin devolver nada secreto", async () => {
    const r = await publico().post("/api/cuentas").send(alta).expect(201);
    token = r.body.token;
    assert.deepEqual(r.body.cuenta, { nombre: "Persona de prueba", correo: "prueba@grieta.test" });
    await publico().post("/api/cuentas").send({ ...alta, correo: "PRUEBA@grieta.test" }).expect(409);
    await publico().post("/api/cuentas").send({ ...alta, correo: "otra@grieta.test", clave: "corta" }).expect(400);
    await publico().post("/api/cuentas").send({ ...alta, correo: "sin-arroba", prueba_llave: prueba }).expect(400);
  });
  test("la sesión abre lo tuyo y sin ella no se puede", async () => {
    const yo = await publico().get("/api/cuentas/yo").set(conToken(token)).expect(200);
    assert.equal(yo.body.cuenta.correo, "prueba@grieta.test");
    assert.equal(JSON.stringify(yo.body).includes("clave"), false);
    await publico().get("/api/cuentas/yo").expect(401);
    await publico().get("/api/cuentas/yo").set(conToken("inventado")).expect(401);
  });
  test("la lista de usuarios del equipo no enseña las claves ni las acepta", async () => {
    const lista = await equipo().get("/api/usuarios").expect(200);
    for (const k of ["clave_hash", "llave_cifrada", "prueba_llave"]) assert.equal(JSON.stringify(lista.body).includes(k), false, k);
    const u = await equipo().post("/api/usuarios").send({ nombre: "Sin clave", correo: "sinclave@grieta.test", clave_hash: "x:y" }).expect(201);
    await publico().post("/api/cuentas/entrar").send({ correo: "sinclave@grieta.test", clave }).expect(401);
    await equipo().delete(`/api/usuarios/${u.body.id}`).expect(204);
  });
  test("entra con la clave correcta y regresa la llave cifrada", async () => {
    const r = await publico().post("/api/cuentas/entrar").send({ correo: " prueba@grieta.TEST ", clave }).expect(200);
    assert.equal(r.body.llave_cifrada, llave);
    await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave: nueva }).expect(401);
    await publico().post("/api/cuentas/entrar").send({ correo: "nadie@grieta.test", clave }).expect(401);
  });
  test("cambiar la contraseña cierra las otras sesiones", async () => {
    const otra = await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave }).expect(200);
    await publico().put("/api/cuentas/yo/clave").set(conToken(token)).send({ clave_actual: nueva, clave_nueva: nueva, llave_cifrada: llave }).expect(401);
    await publico().put("/api/cuentas/yo/clave").set(conToken(token)).send({ clave_actual: clave, clave_nueva: nueva, llave_cifrada: "RUZHSA==" }).expect(200);
    await publico().get("/api/cuentas/yo").set(conToken(otra.body.token)).expect(401);
    await publico().get("/api/cuentas/yo").set(conToken(token)).expect(200);
    await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave }).expect(401);
    const r = await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave: nueva }).expect(200);
    assert.equal(r.body.llave_cifrada, "RUZHSA==");
  });
  test("con las seis palabras se recupera; sin ellas, no", async () => {
    await publico().post("/api/cuentas/recuperar").send({ correo: "prueba@grieta.test", prueba_llave: nueva, clave_nueva: clave, llave_cifrada: llave }).expect(401);
    const r = await publico().post("/api/cuentas/recuperar").send({ correo: "prueba@grieta.test", prueba_llave: prueba, clave_nueva: clave, llave_cifrada: llave }).expect(200);
    await publico().get("/api/cuentas/yo").set(conToken(token)).expect(401);
    token = r.body.token;
    await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave }).expect(200);
  });
  test("salir cierra solo esa sesión", async () => {
    const otra = await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave }).expect(200);
    await publico().post("/api/cuentas/salir").set(conToken(otra.body.token)).expect(204);
    await publico().get("/api/cuentas/yo").set(conToken(otra.body.token)).expect(401);
    await publico().get("/api/cuentas/yo").set(conToken(token)).expect(200);
  });
  test("después de varios intentos fallidos se bloquea un rato", async () => {
    await publico().post("/api/cuentas").send({ ...alta, correo: "bloqueo@grieta.test" }).expect(201);
    for (let i = 0; i < 8; i++) await publico().post("/api/cuentas/entrar").send({ correo: "bloqueo@grieta.test", clave: nueva }).expect(401);
    await publico().post("/api/cuentas/entrar").send({ correo: "bloqueo@grieta.test", clave }).expect(429);
  });
  test("borrar la cuenta pide la contraseña y no deja rastro", async () => {
    await publico().delete("/api/cuentas/yo").set(conToken(token)).send({ clave: nueva }).expect(401);
    await publico().delete("/api/cuentas/yo").set(conToken(token)).send({ clave }).expect(204);
    await publico().get("/api/cuentas/yo").set(conToken(token)).expect(401);
    await publico().post("/api/cuentas/entrar").send({ correo: "prueba@grieta.test", clave }).expect(401);
    await publico().post("/api/cuentas").send(alta).expect(201);
  });
});

describe("Copia cifrada del progreso", () => {
  const id = "a".repeat(64), otro = "b".repeat(64);
  test("se guarda, se lee y no se pisa una version mas nueva", async () => {
    await publico().get(`/api/respaldos/${id}`).expect(404);
    const r1 = await publico().put(`/api/respaldos/${id}`).send({ datos: "QUJD", version: 0 }).expect(201);
    assert.equal(r1.body.version, 1);
    await publico().put(`/api/respaldos/${id}`).send({ datos: "REVG", version: 0 }).expect(409);
    const r2 = await publico().put(`/api/respaldos/${id}`).send({ datos: "REVG", version: 1 }).expect(200);
    assert.equal(r2.body.version, 2);
    await publico().put(`/api/respaldos/${id}`).send({ datos: "R0hJ", version: 1 }).expect(409);
    const leida = await publico().get(`/api/respaldos/${id}`).expect(200);
    assert.deepEqual(leida.body, { datos: "REVG", version: 2 });
  });
  test("rechaza ids y copias invalidas", async () => {
    await publico().get("/api/respaldos/hola").expect(400);
    await publico().put("/api/respaldos/hola").send({ datos: "QUJD" }).expect(401);
    await publico().put(`/api/respaldos/${otro}`).send({ datos: "<script>" }).expect(400);
    await publico().put(`/api/respaldos/${otro}`).send({ datos: "" }).expect(400);
  });
  test("acepta copias grandes solo en esta ruta y se puede borrar", async () => {
    await publico().put(`/api/respaldos/${otro}`).send({ datos: "A".repeat(300_000), version: 0 }).expect(201);
    await publico().delete(`/api/respaldos/${otro}`).expect(200);
    await publico().get(`/api/respaldos/${otro}`).expect(404);
    await publico().post("/api/viajes").send({ km: 3, relleno: "A".repeat(30_000) }).expect(413);
  });
  test("nadie lista todas las copias", async () => {
    await publico().get("/api/respaldos").expect(404);
  });
});
