// Llave de Grieta: seis palabras que guardan una copia cifrada del progreso para pasarlo a otro telefono.
// Sin correo ni contrasena. Se cifra aqui con AES-GCM; el servidor solo guarda texto que no puede leer.
const CLAVES_RESPALDO = ["grieta-racha", "grieta-historial", "grieta-viajes", "grieta-lugares", "grieta-recientes", "grieta-perfil", "grieta-acc", "grieta-meta-co2"];
const PALABRAS_LLAVE = 6;
const respaldo = { palabras: leer("grieta-llave", null), version: leer("grieta-llave-version", 0), guardada: leer("grieta-llave-guardada", 0), cambios: leer("grieta-cambios", {}), derivada: null, lista: null, ocupado: false, otraVez: false, espera: 0 };

// Cada cambio guarda su hora: al juntar dos telefonos gana lo mas reciente.
alEscribir = (clave) => {
  if (!CLAVES_RESPALDO.includes(clave)) return;
  respaldo.cambios[clave] = Date.now();
  escribir("grieta-cambios", respaldo.cambios);
  if (!respaldo.palabras) return;
  clearTimeout(respaldo.espera);
  respaldo.espera = setTimeout(sincronizarRespaldo, 4000);
};

async function palabrasLlave() {
  respaldo.lista ??= fetch("datos/palabras.json").then((r) => r.json());
  return respaldo.lista;
}
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
function aBase64(bytes) {
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}
const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
const flujo = async (bytes, transformar) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transformar)).arrayBuffer());

// Las palabras sin acentos y en minusculas: "Ábaco" y "abaco" abren la misma copia.
async function derivarLlave(palabras) {
  const texto = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", texto.encode(palabras.map(sinAcentos).join(" ")), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: texto.encode("grieta-llave-v1"), iterations: 300000 }, base, 512));
  return { clave: await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]), id: hex(bits.slice(32)) };
}
async function llaveDerivada() {
  respaldo.derivada ??= derivarLlave(respaldo.palabras);
  return respaldo.derivada;
}
async function cifrar(clave, doc) {
  let bytes = new TextEncoder().encode(JSON.stringify(doc)), comprimido = 0;
  if (typeof CompressionStream === "function") { bytes = await flujo(bytes, new CompressionStream("gzip")); comprimido = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, bytes));
  const todo = new Uint8Array(13 + cifrado.length);
  todo.set([comprimido]); todo.set(iv, 1); todo.set(cifrado, 13);
  return aBase64(todo);
}
async function descifrar(clave, datos) {
  const todo = deBase64(datos);
  let bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: todo.subarray(1, 13) }, clave, todo.subarray(13)));
  if (todo[0]) bytes = await flujo(bytes, new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function docLocal() {
  const d = {}, t = {};
  for (const c of CLAVES_RESPALDO) {
    const valor = leer(c, null);
    if (valor === null) continue;
    d[c] = valor;
    t[c] = respaldo.cambios[c] ?? 0;
  }
  return { v: 1, t, d };
}
// Lo de la copia en linea es la base; de este telefono se agrega lo que la copia no tiene.
function juntarRespaldo(remoto, local) {
  const d = { ...remoto.d }, t = { ...remoto.t };
  for (const c of CLAVES_RESPALDO) {
    if (!(c in local.d)) continue;
    const tl = local.t[c] ?? 0, tr = remoto.t[c] ?? 0, a = remoto.d[c], b = local.d[c];
    t[c] = Math.max(tl, tr);
    if (a === undefined) { d[c] = b; continue; }
    if (c === "grieta-historial") d[c] = unirPor([...a, ...b], (h) => `${h.fecha}|${h.nombre}`).sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 80);
    else if (c === "grieta-viajes") d[c] = unirPor([...a, ...b].sort((x, y) => y.fecha.localeCompare(x.fecha)), (v) => v.destino?.nombre).slice(0, 20);
    else if (c === "grieta-racha") d[c] = juntarRacha(a, b, tl > tr);
    else if (c === "grieta-meta-co2") d[c] = Math.max(a, b);
    else d[c] = tl > tr ? b : a;
  }
  return { v: 1, t, d };
}
const unirPor = (lista, clave) => [...new Map(lista.map((x) => [clave(x), x]).reverse()).values()].reverse();
// Viajes, semanas premiadas y compras se suman sin repetir; las tunas se ajustan con lo que la copia no tenia.
function juntarRacha(remota, local, localMasNueva) {
  remota = tunasEnEscala(remota); local = tunasEnEscala(local);
  const r = { ...(localMasNueva ? local : remota) }, union = (a = [], b = []) => [...new Set([...a, ...b])];
  const viajes = [...(remota.viajes ?? [])], vistos = new Set(viajes.map((v) => v.f));
  const masViejo = viajes.length >= 400 ? viajes.at(-1).f : "";
  let tunas = remota.tunas ?? 0;
  for (const v of local.viajes ?? []) {
    const dia = new Date(v.f).toDateString();
    if (vistos.has(v.f) || v.f < masViejo || viajes.filter((x) => new Date(x.f).toDateString() === dia).length >= TOPE_DIA) continue;
    viajes.push(v); vistos.add(v.f); tunas += VIAJE_TUNAS;
  }
  for (const s of local.premiadas ?? []) if (!(remota.premiadas ?? []).includes(s)) tunas += SEMANA_TUNAS;
  for (const id of local.compras ?? []) if (!(remota.compras ?? []).includes(id)) tunas -= ACCESORIOS[ACCESORIOS_VIEJOS[id] ?? id]?.precio ?? 0;
  if (local.alebrije && !remota.alebrije) tunas -= ALEBRIJE_TUNAS;
  return Object.assign(r, {
    viajes: viajes.sort((x, y) => y.f.localeCompare(x.f)).slice(0, 400), tunas: Math.max(0, tunas),
    alebrije: Boolean(remota.alebrije || local.alebrije), premiadas: union(remota.premiadas, local.premiadas), usados: union(remota.usados, local.usados), compras: union(remota.compras, local.compras),
    mes: [remota.mes ?? "", local.mes ?? ""].sort().at(-1),
  });
}
// Escribe lo que cambio y pone al dia lo que la app ya tenia cargado.
function aplicarRespaldo(doc) {
  let cambio = false;
  for (const c of CLAVES_RESPALDO) {
    if (!(c in doc.d) || JSON.stringify(doc.d[c]) === localStorage.getItem(c)) continue;
    try { localStorage.setItem(c, JSON.stringify(doc.d[c])); } catch {}
    respaldo.cambios[c] = doc.t[c] ?? 0;
    cambio = true;
  }
  if (!cambio) return false;
  escribir("grieta-cambios", respaldo.cambios);
  Object.assign(racha, leer("grieta-racha", {}));
  Object.assign(acc, leer("grieta-acc", {}));
  historial = leer("grieta-historial", []);
  viajes = leer("grieta-viajes", []);
  guardados = leer("grieta-lugares", []);
  recientes = leer("grieta-recientes", []);
  aplicarAcc();
  if (document.body.dataset.pantalla === "inicio") { pintarGuardados(); pintarViajes(); pintarRutina(); pintarRachaInicio(); }
  return true;
}

async function pedirRespaldo(id, opciones) {
  const r = await fetch(`${API}/respaldos/${id}`, { cache: "no-store", ...opciones, headers: { "Content-Type": "application/json" } });
  if (r.status === 404 && !opciones) return null;
  if (r.status === 409) return { conflicto: true };
  if (!r.ok) throw new Error(`respaldo ${r.status}`);
  return r.json();
}
// Baja la copia, le junta lo de este telefono y la sube si cambio; si otro telefono gano la carrera, se repite.
async function sincronizarRespaldo() {
  if (!respaldo.palabras || !API) return;
  if (respaldo.ocupado) return void (respaldo.otraVez = true);
  respaldo.ocupado = true;
  try {
    const { clave, id } = await llaveDerivada();
    for (let intento = 0; intento < 3; intento++) {
      const remoto = await pedirRespaldo(id);
      const enLinea = remoto ? await descifrar(clave, remoto.datos) : null;
      const doc = enLinea ? juntarRespaldo(enLinea, docLocal()) : docLocal();
      if (enLinea) aplicarRespaldo(doc);
      let version = remoto?.version ?? 0;
      if (!enLinea || JSON.stringify(doc) !== JSON.stringify(enLinea)) {
        const r = await pedirRespaldo(id, { method: "PUT", body: JSON.stringify({ datos: await cifrar(clave, doc), version }) });
        if (r.conflicto) continue;
        version = r.version;
      }
      respaldo.version = version;
      respaldo.guardada = Date.now();
      escribir("grieta-llave-version", version);
      escribir("grieta-llave-guardada", respaldo.guardada);
      break;
    }
  } catch (e) {
    console.warn("respaldo", e?.message ?? e);
  } finally {
    respaldo.ocupado = false;
    pintarLlave();
    if (respaldo.otraVez) { respaldo.otraVez = false; setTimeout(sincronizarRespaldo, 1000); }
  }
}

async function crearLlave() {
  const lista = await palabrasLlave(), azar = new Uint32Array(PALABRAS_LLAVE * 2), tope = Math.floor(2 ** 32 / lista.length) * lista.length;
  const palabras = [];
  // Se descartan los numeros que no reparten parejo entre las palabras.
  while (palabras.length < PALABRAS_LLAVE) {
    crypto.getRandomValues(azar);
    for (const n of azar) if (n < tope && palabras.length < PALABRAS_LLAVE) palabras.push(lista[n % lista.length]);
  }
  // Lo que ya hay en este telefono es lo mas nuevo.
  for (const c of CLAVES_RESPALDO) if (leer(c, null) !== null) respaldo.cambios[c] ??= Date.now();
  escribir("grieta-cambios", respaldo.cambios);
  guardarLlave(palabras, 0);
  $("llaveEstado").textContent = "Guardando tu progreso...";
  await sincronizarRespaldo();
  $("llaveEstado").textContent = respaldo.guardada ? "Listo. Guarda tus seis palabras donde no las pierdas." : "Tu llave está lista; tu progreso se guarda cuando haya internet.";
}
function guardarLlave(palabras, version) {
  Object.assign(respaldo, { palabras, version, derivada: null, guardada: 0 });
  escribir("grieta-llave", palabras);
  escribir("grieta-llave-version", version);
  escribir("grieta-llave-guardada", 0);
  pintarLlave();
}
// Acepta las palabras con o sin acentos, y tambien sus primeras cuatro letras: en esta lista no se repiten.
async function leerPalabras(texto) {
  const lista = await palabrasLlave(), limpias = lista.map(sinAcentos);
  const escritas = sinAcentos(texto).split(/[^a-z]+/).filter(Boolean);
  if (escritas.length !== PALABRAS_LLAVE) return { error: `Tu llave tiene ${PALABRAS_LLAVE} palabras y escribiste ${escritas.length}.` };
  const palabras = [];
  for (const p of escritas) {
    const i = limpias.indexOf(p) >= 0 ? limpias.indexOf(p) : p.length >= 4 ? limpias.findIndex((l) => l.startsWith(p.slice(0, 4))) : -1;
    if (i < 0) return { error: `No reconozco "${p}". Revisa cómo la escribiste.` };
    palabras.push(lista[i]);
  }
  return { palabras };
}
async function recuperarLlave() {
  const estado = $("llaveEstado");
  if (!API) return void (estado.textContent = "Sin conexión con Grieta. Intenta en un momento.");
  const { palabras, error } = await leerPalabras($("llaveEntrada").value);
  if (error) return void (estado.textContent = error);
  estado.textContent = "Buscando tu copia...";
  try {
    const { clave, id } = await derivarLlave(palabras);
    const remoto = await pedirRespaldo(id);
    if (!remoto) return void (estado.textContent = "No encontré una copia con esas palabras. Revísalas una por una.");
    // Al llegar a un telefono nuevo, lo de la copia gana: aqui solo se suman viajes y lugares que no tenga.
    const local = docLocal();
    for (const c in local.t) local.t[c] = 0;
    const doc = juntarRespaldo(await descifrar(clave, remoto.datos), local);
    aplicarRespaldo(doc);
    guardarLlave(palabras, remoto.version);
    respaldo.derivada = Promise.resolve({ clave, id });
    await sincronizarRespaldo();
    sessionStorage.setItem("grieta-llave-lista", "1");
    location.reload();
  } catch {
    estado.textContent = "No pude traer tu copia. Revisa tu internet e intenta otra vez.";
  }
}

function hace(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  return min < 1 ? "hace un momento" : min < 60 ? `hace ${plural(min, "minuto", "minutos")}` : min < 1440 ? `hace ${plural(Math.round(min / 60), "hora", "horas")}` : `hace ${plural(Math.round(min / 1440), "día", "días")}`;
}
function pintarLlave() {
  const con = !!respaldo.palabras;
  $("llaveSin").hidden = con;
  $("llaveCon").hidden = !con;
  $("textoLlave").textContent = !con ? "Guárdalo con una llave de seis palabras" : respaldo.guardada ? `Guardado ${hace(respaldo.guardada)}` : "Se guarda cuando haya internet";
  $("llavePalabras").innerHTML = con ? respaldo.palabras.map((p) => `<li>${escapar(p)}</li>`).join("") : "";
}

$("llaveCrear").addEventListener("click", () => crearLlave().catch(() => ($("llaveEstado").textContent = "No pude crear tu llave. Intenta otra vez.")));
$("llaveRecuperar").addEventListener("click", recuperarLlave);
$("llaveEntrada").addEventListener("keydown", (e) => { if (e.key === "Enter") recuperarLlave(); });
$("llaveCompartir").addEventListener("click", async () => {
  const texto = `Mi llave de Grieta: ${respaldo.palabras.join(" ")}`;
  if (navigator.share) return navigator.share({ text: texto }).catch(() => {});
  await navigator.clipboard?.writeText(respaldo.palabras.join(" ")).catch(() => {});
  $("llaveEstado").textContent = "Copiada. Pégala en tus notas.";
});
$("llaveCopiar").addEventListener("click", async () => {
  await navigator.clipboard?.writeText(respaldo.palabras.join(" ")).catch(() => {});
  $("llaveEstado").textContent = "Copiada. Pégala en tus notas.";
});
$("llaveQuitar").addEventListener("click", () => {
  if (!confirm("Tu progreso se queda en este teléfono y en tu copia en línea, pero este teléfono ya no se va a guardar. ¿Quitar la llave?")) return;
  guardarLlave(null, 0);
  localStorage.removeItem("grieta-llave");
  $("llaveEstado").textContent = "Listo. Puedes volver a escribir tu llave cuando quieras.";
});
$("llaveBorrar").addEventListener("click", async () => {
  if (!confirm("Se borra tu copia en línea para siempre. Lo de este teléfono se queda. ¿Borrar?")) return;
  try {
    const { id } = await llaveDerivada();
    await pedirRespaldo(id, { method: "DELETE" });
    guardarLlave(null, 0);
    localStorage.removeItem("grieta-llave");
    $("llaveEstado").textContent = "Tu copia en línea se borró.";
  } catch {
    $("llaveEstado").textContent = "No pude borrarla. Revisa tu internet e intenta otra vez.";
  }
});
// Al salir de la app se sube lo pendiente, sin esperar los cuatro segundos.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && respaldo.espera) { clearTimeout(respaldo.espera); respaldo.espera = 0; sincronizarRespaldo(); }
});
pintarLlave();
if (sessionStorage.getItem("grieta-llave-lista")) {
  sessionStorage.removeItem("grieta-llave-lista");
  const listo = "Listo: tu progreso ya está en este teléfono.";
  avisar(listo);
  setTimeout(() => { if ($("estado").textContent === listo) avisar(""); }, 8000);
}
