// © 2026 Carlos Arturo Quintana Román. Todos los derechos reservados; prohibido copiarlo o usarlo para entrenar IA.
// Cuenta opcional en la API de Grieta: la llave de seis palabras viaja cifrada con la contrasena.
const VUELTAS_CUENTA = 600000;
const MINIMO_CLAVE = 8;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cuentaActual = { datos: leer("grieta-cuenta", null), modo: "crear", alTerminar: null, ocupada: false };
const MODOS_CUENTA = {
  crear: { titulo: "Crea tu cuenta", nota: "Tu progreso se cifra con tu contraseña: ni Grieta puede leerlo.", campos: ["nombre", "correo", "clave"], boton: "Crear cuenta", clave: "Contraseña (mínimo 8 caracteres)", otro: ["entrar", "Ya tengo cuenta"], auto: "new-password", escena: true },
  entrar: { titulo: "Entra a tu cuenta", nota: "Trae tu progreso a este teléfono.", campos: ["correo", "clave"], boton: "Entrar", clave: "Contraseña", otro: ["crear", "Crear una cuenta"], olvido: true, auto: "current-password", escena: true },
  recuperar: { titulo: "Recupera tu cuenta", nota: "Escribe tus seis palabras y elige una contraseña nueva.", campos: ["correo", "palabras", "clave"], boton: "Guardar contraseña nueva", clave: "Contraseña nueva (mínimo 8 caracteres)", otro: ["entrar", "Volver a entrar"], auto: "new-password" },
  nombre: { titulo: "¿Cómo te llamas?", nota: "Se queda solo en este teléfono. Puedes crear tu cuenta después.", campos: ["nombre"], boton: "Listo", escena: true },
  clave: { titulo: "Cambia tu contraseña", nota: "Se cierra tu sesión en tus otros teléfonos.", campos: ["actual", "clave"], boton: "Guardar contraseña", clave: "Contraseña nueva (mínimo 8 caracteres)", auto: "new-password" },
  borrar: { titulo: "Borrar mi cuenta", nota: "Se borran tu cuenta y tu copia en línea para siempre. Lo de este teléfono se queda.", campos: ["actual"], boton: "Borrar para siempre" },
};
const GRUPOS_CUENTA = { nombre: "grupoNombre", correo: "grupoCorreo", palabras: "grupoPalabras", actual: "grupoActual", clave: "grupoClave" };

const correoLimpio = (c) => c.trim().toLowerCase();
async function derivarCuenta(correo, contrasena) {
  const texto = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", texto.encode(contrasena.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: texto.encode(`grieta-cuenta-v1:${correo}`), iterations: VUELTAS_CUENTA }, base, 512));
  return { acceso: hex(bits.slice(0, 32)), cifra: await crypto.subtle.importKey("raw", bits.slice(32), "AES-GCM", false, ["encrypt", "decrypt"]) };
}
const pruebaDeLlave = async (palabras) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`grieta-recuperar-v1:${palabras.map(sinAcentos).join(" ")}`))));

async function pedirCuenta(ruta, metodo = "GET", cuerpo) {
  if (!API) throw new Error("Sin conexión con Grieta. Intenta en un momento.");
  const token = cuentaActual.datos?.token;
  const r = await fetch(`${API}/cuentas${ruta}`, { method: metodo, cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
    .catch(() => { throw new Error("No pude conectarme. Revisa tu internet e intenta otra vez."); });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "Algo falló. Intenta otra vez."), { status: r.status });
  return j;
}
function guardarSesion({ token, cuenta }) {
  cuentaActual.datos = { token, ...cuenta };
  escribir("grieta-cuenta", cuentaActual.datos);
  pintarCuenta();
}
function cerrarSesionLocal() {
  cuentaActual.datos = null;
  localStorage.removeItem("grieta-cuenta");
  guardarLlave(null, 0);
  localStorage.removeItem("grieta-llave");
  pintarCuenta();
}
// Trae lo de la cuenta a este telefono; si aun no habia copia, sube lo que hay aqui.
async function usarPalabras(palabras) {
  const derivada = await derivarLlave(palabras), remoto = await pedirRespaldo(derivada.id);
  if (remoto) return traerCopia(palabras, derivada, remoto);
  activarLlave(palabras);
  respaldo.derivada = Promise.resolve(derivada);
  await sincronizarRespaldo();
}
function reiniciarConCuenta() {
  escribir("grieta-bienvenida", true);
  if (!leer("grieta-tutorial", false)) escribir("grieta-tutorial", { version: 1, completado: true });
  sessionStorage.setItem("grieta-llave-lista", "1");
  location.reload();
}
const ACCIONES_CUENTA = {
  crear: async ({ nombre, correo, clave }) => {
    const palabras = respaldo.palabras ?? await palabrasNuevas();
    const { acceso, cifra } = await derivarCuenta(correo, clave);
    guardarSesion(await pedirCuenta("", "POST", { nombre, correo, clave: acceso, llave_cifrada: await cifrar(cifra, palabras), prueba_llave: await pruebaDeLlave(palabras) }));
    if (!respaldo.palabras) activarLlave(palabras);
    sincronizarRespaldo();
    verPalabrasCuenta(palabras);
  },
  entrar: async ({ correo, clave }) => {
    const { acceso, cifra } = await derivarCuenta(correo, clave);
    const r = await pedirCuenta("/entrar", "POST", { correo, clave: acceso });
    const palabras = await descifrar(cifra, r.llave_cifrada);
    guardarSesion(r);
    await usarPalabras(palabras);
    reiniciarConCuenta();
  },
  recuperar: async ({ correo, palabras: texto, clave }) => {
    const { palabras, error } = await leerPalabras(texto);
    if (error) throw new Error(error);
    const { acceso, cifra } = await derivarCuenta(correo, clave);
    guardarSesion(await pedirCuenta("/recuperar", "POST", { correo, prueba_llave: await pruebaDeLlave(palabras), clave_nueva: acceso, llave_cifrada: await cifrar(cifra, palabras) }));
    await usarPalabras(palabras);
    reiniciarConCuenta();
  },
  nombre: async ({ nombre }) => {
    acc.nombre = nombre;
    guardarAcc();
    terminarCuenta();
  },
  clave: async ({ actual, clave }) => {
    const { correo } = cuentaActual.datos;
    const antes = await derivarCuenta(correo, actual), nueva = await derivarCuenta(correo, clave);
    await pedirCuenta("/yo/clave", "PUT", { clave_actual: antes.acceso, clave_nueva: nueva.acceso, llave_cifrada: await cifrar(nueva.cifra, respaldo.palabras) });
    $("cuentaAviso").textContent = "Listo, tu contraseña cambió.";
    terminarCuenta();
  },
  borrar: async ({ actual }) => {
    if (!confirm("Se borran tu cuenta y tu copia en línea para siempre. ¿Borrar?")) return;
    const { acceso } = await derivarCuenta(cuentaActual.datos.correo, actual);
    const derivada = respaldo.palabras ? await llaveDerivada() : null;
    await pedirCuenta("/yo", "DELETE", { clave: acceso });
    if (derivada) await pedirRespaldo(derivada.id, { method: "DELETE" }).catch(() => {});
    cerrarSesionLocal();
    $("cuentaAviso").textContent = "Tu cuenta se borró. Lo de este teléfono se queda.";
    terminarCuenta();
  },
};
function validarCuenta(modo, v) {
  const campos = MODOS_CUENTA[modo].campos, nueva = modo !== "entrar";
  if (campos.includes("nombre") && !v.nombre) return "Escribe tu nombre.";
  if (campos.includes("correo") && !FORMATO_CORREO.test(v.correo)) return "Escribe un correo válido.";
  if (campos.includes("palabras") && !v.palabras.trim()) return "Escribe tus seis palabras.";
  if (campos.includes("actual") && !v.actual) return "Escribe tu contraseña.";
  if (campos.includes("clave") && !v.clave) return "Escribe tu contraseña.";
  if (campos.includes("clave") && nueva && v.clave.length < MINIMO_CLAVE) return "Tu contraseña necesita al menos 8 caracteres.";
  return "";
}
function pintarModoCuenta(modo) {
  const m = MODOS_CUENTA[modo];
  cuentaActual.modo = modo;
  $("cuentaForma").hidden = false;
  $("cuentaGuarda").hidden = true;
  $("cuentaTitulo").textContent = m.titulo;
  $("cuentaNota").textContent = m.nota;
  $("cuentaEnviar").textContent = m.boton;
  $("cuentaEnviar").classList.toggle("peligro", modo === "borrar");
  $("cuentaEstado").textContent = "";
  for (const [campo, id] of Object.entries(GRUPOS_CUENTA)) $(id).hidden = !m.campos.includes(campo);
  $("cuentaClaveTexto").textContent = m.clave ?? "";
  $("cuentaClave").autocomplete = m.auto ?? "off";
  $("cuentaClave").type = "password";
  $("cuentaVer").textContent = "Ver";
  $("cuentaOtroModo").hidden = !m.otro;
  if (m.otro) $("cuentaOtroModo").textContent = m.otro[1];
  $("cuentaOlvide").hidden = !m.olvido;
  $("cuentaEscena").hidden = !m.escena;
  if (m.escena) $("cuentaEscena").innerHTML = TutorialGrieta.escena(modo === "nombre" ? "nombre" : "cuenta");
}
function abrirCuenta(modo, alTerminar) {
  cuentaActual.alTerminar = alTerminar ?? (() => { pintarCuenta(); history.back(); });
  for (const id of ["cuentaClave", "cuentaActual", "cuentaPalabras"]) $(id).value = "";
  pintarModoCuenta(modo);
  ir("cuenta");
}
function verPalabrasCuenta(palabras) {
  $("cuentaForma").hidden = true;
  $("cuentaEscena").hidden = true;
  $("cuentaGuarda").hidden = false;
  $("cuentaLista").replaceChildren(...palabras.map((p) => Object.assign(document.createElement("li"), { textContent: p })));
  $("cuentaCopiado").textContent = "";
  $("cuentaGuardaTitulo").focus({ preventScroll: true });
  $("hoja").scrollTop = 0;
}
function terminarCuenta() {
  for (const id of ["cuentaClave", "cuentaActual", "cuentaPalabras"]) $(id).value = "";
  cuentaActual.alTerminar?.();
}
function pintarCuenta() {
  const d = cuentaActual.datos;
  $("cuentaSin").hidden = !!d;
  $("cuentaCon").hidden = !d;
  if (d) { $("cuentaNombreVer").textContent = d.nombre; $("cuentaCorreoVer").textContent = d.correo; $("cuentaInicial").textContent = d.nombre.charAt(0).toUpperCase(); }
  $("tituloLlaveCuenta").textContent = d ? "Tus seis palabras para recuperar tu cuenta" : "O con tu llave de seis palabras";
  pintarLlave();
}
$("cuentaForma").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cuentaActual.ocupada) return;
  const modo = cuentaActual.modo, estado = $("cuentaEstado");
  const v = { nombre: $("cuentaNombre").value.trim(), correo: correoLimpio($("cuentaCorreo").value), palabras: $("cuentaPalabras").value, actual: $("cuentaActual").value, clave: $("cuentaClave").value };
  const falta = validarCuenta(modo, v);
  if (falta) return void (estado.textContent = falta);
  cuentaActual.ocupada = true;
  $("cuentaEnviar").disabled = true;
  estado.textContent = "Un momento...";
  try {
    await ACCIONES_CUENTA[modo](v);
    if (cuentaActual.modo === modo) estado.textContent = "";
  } catch (error) {
    estado.textContent = error.message || "Algo falló. Intenta otra vez.";
  } finally {
    cuentaActual.ocupada = false;
    $("cuentaEnviar").disabled = false;
  }
});
$("cuentaOtroModo").addEventListener("click", () => pintarModoCuenta(MODOS_CUENTA[cuentaActual.modo].otro[0]));
$("cuentaOlvide").addEventListener("click", () => pintarModoCuenta("recuperar"));
$("cuentaVer").addEventListener("click", () => {
  const ver = $("cuentaClave").type === "password";
  $("cuentaClave").type = ver ? "text" : "password";
  $("cuentaVer").textContent = ver ? "Ocultar" : "Ver";
});
$("cuentaListo").addEventListener("click", terminarCuenta);
$("cuentaCopiar").addEventListener("click", async () => {
  await navigator.clipboard?.writeText(respaldo.palabras.join(" ")).catch(() => {});
  $("cuentaCopiado").textContent = "Copiadas. Pégalas en tus notas.";
});
$("cuentaCrear").addEventListener("click", () => abrirCuenta("crear"));
$("cuentaEntrar").addEventListener("click", () => abrirCuenta("entrar"));
$("cuentaClaveAbrir").addEventListener("click", () => abrirCuenta("clave"));
$("cuentaBorrar").addEventListener("click", () => abrirCuenta("borrar"));
$("cuentaSalir").addEventListener("click", async () => {
  if (!confirm("Tu progreso se queda en este teléfono, pero ya no se va a guardar en tu cuenta. ¿Cerrar sesión?")) return;
  await pedirCuenta("/salir", "POST").catch(() => {});
  cerrarSesionLocal();
  $("cuentaAviso").textContent = "Cerraste sesión.";
});
// Si la sesion ya vencio, el panel lo dice en vez de fingir que sigue abierta.
async function revisarSesion() {
  if (!cuentaActual.datos) return;
  try {
    await pedirCuenta("/yo");
  } catch (e) {
    if (e.status !== 401) return;
    cerrarSesionLocal();
    $("cuentaAviso").textContent = e.message;
  }
}
pintarCuenta();
