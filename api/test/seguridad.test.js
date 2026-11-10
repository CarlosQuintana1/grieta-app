import { describe, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.SQLITE = ":memory:";
process.env.CLAVE_ADMIN = "clave-de-prueba";
process.env.TOPE_GENERAL_MINUTO = "40";
const { app } = await import("../src/app.js");
const { sequelize } = await import("../src/modelos.js");
await sequelize.sync();
const desde = (ip) => request(app).get("/api/impacto").set("X-Forwarded-For", ip);

describe("Seguridad", () => {
  test("cabeceras de seguridad y sin firma del servidor", async () => {
    const res = await request(app).get("/api/impacto");
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.match(res.headers["strict-transport-security"], /max-age/);
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    assert.equal(res.headers["x-frame-options"], "DENY");
  });

  test("solo las paginas de Grieta reciben permiso de CORS", async () => {
    const bien = await request(app).get("/api/impacto").set("Origin", "https://grieta-demo.pages.dev");
    assert.equal(bien.headers["access-control-allow-origin"], "https://grieta-demo.pages.dev");
    const vista = await request(app).get("/api/impacto").set("Origin", "https://b766cd7d.grieta-demo.pages.dev");
    assert.equal(vista.headers["access-control-allow-origin"], "https://b766cd7d.grieta-demo.pages.dev");
    const ajena = await request(app).get("/api/impacto").set("Origin", "https://copia-de-grieta.example.com");
    assert.equal(ajena.headers["access-control-allow-origin"], undefined);
  });

  test("una IP que manda demasiadas peticiones recibe 429 y las demas siguen", async () => {
    for (let i = 0; i < 40; i++) await desde("10.0.0.1");
    const tope = await desde("10.0.0.1");
    assert.equal(tope.status, 429);
    assert.ok(tope.headers["retry-after"]);
    assert.notEqual((await desde("10.0.0.2")).status, 429);
  });

  test("la busqueda tiene tope propio para no gastar el cupo de Azure Maps", async () => {
    let ultimo;
    for (let i = 0; i < 41; i++) ultimo = await request(app).get("/api/buscar?q=antea").set("X-Forwarded-For", "10.0.0.3");
    assert.equal(ultimo.status, 429);
  });

  test("las fotos tienen tope propio por hora", async () => {
    let ultimo;
    for (let i = 0; i < 21; i++) ultimo = await request(app).post("/api/reportes/999/foto").set("X-Forwarded-For", "10.0.0.6").set("Content-Type", "image/jpeg").send(Buffer.from([255, 216, 255]));
    assert.equal(ultimo.status, 429);
  });

  test("diez claves de equipo equivocadas bloquean a esa IP aunque luego mande la buena", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await request(app).delete("/api/lugares/1").set("X-Forwarded-For", "10.0.0.4").set("X-Clave-Admin", `mala-${i}`);
      assert.equal(r.status, 401);
    }
    const buena = await request(app).get("/api/usuarios").set("X-Forwarded-For", "10.0.0.4").set("X-Clave-Admin", "clave-de-prueba");
    assert.equal(buena.status, 429);
    const otra = await request(app).get("/api/usuarios").set("X-Forwarded-For", "10.0.0.5").set("X-Clave-Admin", "clave-de-prueba");
    assert.equal(otra.status, 200);
  });
});
