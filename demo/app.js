// © 2026 Equipo Grieta. Todos los derechos reservados; prohibido copiarlo o usarlo para entrenar IA.
const $ = (id) => document.getElementById(id);
// En iPhone el pellizco agranda la pagina aunque el viewport lo pida: solo los mapas se pueden acercar.
for (const ev of ["gesturestart", "gesturechange"]) document.addEventListener(ev, (e) => { if (!e.target.closest?.(".leaflet-container, .maplibregl-map")) e.preventDefault(); }, { passive: false });
const pesos = (x) => `$${Math.round(x)}`;
const QUERETARO = [20.6, -100.4];
const RADIO_KM = 40;
const ESPERAS = [0, 15, 30, 60];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ACCIONES = { "pedir ya": "Pídelo ya", esperar: "Espera un poco", camion: "Vete en camión" };
// Cada veredicto lleva su forma, para no depender solo del color.
const SIMBOLOS = { "pedir ya": "palomita", esperar: "reloj", camion: "camion" };

const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const picto = (nombre, clase = "") => `<svg class="picto ${clase}" aria-hidden="true"><use href="#p-${nombre}"/></svg>`;
// Ficha chica de color con su pictograma: la que llevan todas las filas y listas
// Cada app con su ficha propia: una letra y su color, sin usar logotipos de las empresas
const fichaApp = (app) => `<span class="mini-ficha ficha-app app-${app}" aria-hidden="true">${{ uber: "U", didi: "D", indrive: "iD" }[app]}</span>`;
const miniFicha = (tono, contenido) => `<span class="mini-ficha ${tono}" aria-hidden="true">${contenido}</span>`;
const ico = (nombre, clase = "") => `<svg class="icono ${clase}" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; } };
let siMePierdo = leer("grieta-si-me-pierdo", null);
// llave.js lo cambia para anotar la hora de cada cambio y guardar la copia cifrada.
let alEscribir = () => {};
const escribir = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} alEscribir(clave); };
// Reinicio unico del 10 nov 2026: todos vuelven a la bienvenida y al perfil; ahorro, racha, lugares y Cuki se quedan.
const REINICIO = "2026-11-10b";
if (leer("grieta-reinicio", null) !== REINICIO) {
  for (const clave of ["grieta-bienvenida", "grieta-perfil", "grieta-tutorial", "grieta-invita-cerrada"]) { try { localStorage.removeItem(clave); } catch {} }
  try { localStorage.setItem("grieta-reinicio", JSON.stringify(REINICIO)); } catch {}
}
const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Los colores del mapa siguen al tema: con alto contraste o colores para daltonismo cambian igual que la pantalla.
const tono = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
// Los cruces vienen como "Calle/Otra calle": con espacios, la letra grande parte el renglon en la diagonal.
const cruce = (t) => String(t ?? "").replace(/\s*\/\s*/g, " / ");

// Hora de 12 h para la pantalla: 6:41 pm.
function hora(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
const ahoraMin = () => { const a = new Date(); return a.getHours() * 60 + a.getMinutes(); };
const hoyDia = () => (new Date().getDay() + 6) % 7;

const mapa = L.map("mapa", { zoomControl: false, attributionControl: false, keyboard: false }).setView(QUERETARO, 12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapa);
L.control.attribution({ position: "bottomright", prefix: false })
  .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" tabindex="-1">OpenStreetMap</a>').addTo(mapa);
// El mapa cambia de alto con lo que hay en la hoja y al girar el telefono: Leaflet tiene que volver a medirlo.
// Despues de medir se vuelve a encuadrar lo de la pantalla, porque el tamano final llega cuando ya se dibujo.
let reencuadre;
new ResizeObserver(() => {
  mapa.invalidateSize();
  clearTimeout(reencuadre);
  reencuadre = setTimeout(() => { if (document.body.classList.contains("con-mapa")) reencuadrar(document.body.dataset.pantalla); }, 150);
}).observe($("mapa"));
const icono = (clase) => L.divIcon({ className: "", html: `<span class="marca ${clase}"></span>`, iconSize: [18, 18] });

const estado = { origen: null, destino: null, editando: "hacia", kmCalle: null, momento: 0, otra: null, prisa: 20, app: null, gps: null, elegida: null };
const capas = {};
let lugares = [];

const FRASES = {
  a_donde_vas: "¿A dónde vas?",
  vamos_lugar: "Vamos a {lugar}.",
  vamos_casa: "Vamos a casa.",
  buscando_ubicacion: "Buscando dónde estás.",
  sin_ubicacion: "No pude ver tu ubicación.",
  no_escuche: "No te escuché. Toca el botón otra vez y habla después del tono.",
  camina_parada: "Camina a {parada}",
  llegaste_parada: "Llegaste a la parada",
  espera_linea: "Espera la línea {linea} hacia {hacia}",
  horario_pasa: "según el horario pasa a las {hora}",
  aviso_pasar: "Te aviso cuando esté por pasar.",
  ya_casi: "Ya casi",
  ya_paso: "Ya pasó",
  viene_lleno: "Viene lleno",
  espera_siguiente: "Si puedes, espera la siguiente.",
  siguiente: "Según el horario, la siguiente pasa a las {hora}.",
  ya_me_subi: "Ya me subí",
  subi_linea: "Ya me subí a la {linea}",
  faltan_paradas: "Faltan {n} paradas",
  dos_paradas: "Bajas en dos paradas",
  preparate_bajar: "Prepárate para bajar.",
  siguiente_parada: "Bájate en la siguiente parada",
  bajate: "Bájate aquí",
  transbordo: "Bájate aquí y cambia de camión",
  despues_transbordo: "Después cambias de camión.",
  ya_casi_llegas: "Ya casi llegas",
  llegaste: "Llegaste",
  acceso: "Cuidado con la accesibilidad. {problemas}.",
  referencia_parada: "Referencia: {referencia}.",
  aviso_parada: "Cuidado: {avisos}.",
  confirmar_fin: "¿Terminar el viaje? Ya no te voy a avisar cuándo bajarte. Toca otra vez para confirmar.",
  empezar: "Empezar viaje con avisos",
  repetir: "Repetir",
  terminar: "Terminar viaje",
};
const NOMBRE_OTOMI = "Hñöñho (Otomí)";
const NOMBRE_NAHUATL = "Náhuatl (Huasteca oriental)";
const frase = (id, valores = {}) => ({ id, valores });
const textoFrase = (mensaje) => Array.isArray(mensaje) ? mensaje.map(textoFrase).join("")
  : mensaje?.id ? FRASES[mensaje.id].replace(/\{(\w+)\}/g, (_, clave) => String(mensaje.valores[clave] ?? "")) : String(mensaje ?? "");
let lenguasDisponibles = [];
let audiosOto = new Set();
let vozGrieta = null;
let microfonoActivo = false;
let dictadoActual = null;
let inicioDictado;
let revisionDictado = 0, dictadoIniciado = false, ultimaVozDetenida = -Infinity;
const cierresDictado = new Set();
let respuestaDictado = null;
let audio;
let ultimoMensaje = null;
let grabacion = null;
let finalizarLectura = null;
let turnoVoz = 0;
let colaVoz = Promise.resolve();

// Ajustes guardados en este telefono.
const acc = { colchon: 0, toques: true, vibracion: true, modoVoz: false, facil: false, grande: false, contraste: false, daltonico: false, voz: false, vozElegida: false, lenta: false, camino: false, unidos: false, tema: "auto", movilidad: "normal", oido: "bien", lector: "no", lengua: "es", ...leer("grieta-acc", {}) };
let camaraConVoz = true;
// La voz de la guia es aparte de la de toda la app: activarla en un viaje no hace que hablen las demas pantallas.
let viajeEnCurso = false;
acc.idioma ??= acc.lengua === "oto" ? "oto" : "es";
if (!["es", "oto", "nah"].includes(acc.idioma)) acc.idioma = "es";
if (!acc.modoVoz && !acc.vozElegida) acc.voz = false;
if (acc.vozGuia === undefined) {
  acc.vozGuia = Boolean(acc.voz);
  if (!acc.modoVoz) { acc.voz = false; acc.vozElegida = false; }
}
// Con "Como el telefono", los colores siguen el modo claro u oscuro del sistema.
const sistemaClaro = matchMedia("(prefers-color-scheme: light)");
const OPCIONES = { grande: "optGrande", contraste: "optContraste", daltonico: "optDaltonico", voz: "optVoz", lenta: "optLenta", camino: "optCamino", unidos: "optUnidos" };
let marcarDensidad = () => {};
const densidadActual = () => acc.modoVoz ? "voz" : acc.facil ? "facil" : "completa";
function aplicarAcc() {
  document.documentElement.classList.toggle("claro", acc.tema === "claro" || (acc.tema === "auto" && sistemaClaro.matches));
  for (const b of $("optTema").children) b.setAttribute("aria-pressed", String(b.dataset.v === acc.tema));
  marcarDensidad(densidadActual());
  document.documentElement.classList.toggle("grande", acc.grande);
  // Modo facil: solo lo esencial y botones grandes, para quien quiere la app lo mas sencilla
  document.documentElement.classList.toggle("facil", acc.facil);
  document.documentElement.classList.toggle("contraste", acc.contraste);
  document.documentElement.classList.toggle("daltonico", acc.daltonico);
  // Modo voz: el inicio cambia a botones grandes y el mapa se quita.
  document.documentElement.classList.toggle("modo-voz", acc.modoVoz);
  $("inicioVoz").hidden = !acc.modoVoz;
  $("inicioNormal").hidden = acc.modoVoz;
  $(acc.modoVoz ? "vozLugares" : "guardados").after($("deshacerInicio"));
  for (const [k, id] of Object.entries(OPCIONES)) $(id).checked = acc[k];
  actualizarVozEncabezado();
  recolorear();
  document.querySelector('meta[name="theme-color"]').content = tono("--fondo");
  pintarResumenPerfil();
  $("guiaVoz").setAttribute("aria-pressed", String(acc.vozGuia || (acc.modoVoz && acc.voz)));
  $("guiaVibrar").setAttribute("aria-pressed", String(acc.vibracion));
  $('optToques').checked = acc.toques;
  // Tocar para escuchar y su práctica solo existen en modo Voz, sin lector de pantalla del teléfono.
  $('opcionesToques').hidden = !acc.modoVoz || acc.lector === 'si';
  $('ayudaToques').hidden = !acc.modoVoz || acc.lector === 'si' || !acc.toques;
  ToquesGrieta.reiniciar();
  if (!vozActiva()) detenerVoz();
}
sistemaClaro.addEventListener("change", () => { if (acc.tema === "auto") aplicarAcc(); });
$("optTema").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  acc.tema = b.dataset.v;
  guardarAcc();
  aplicarAcc();
});
const guardarAcc = () => escribir("grieta-acc", acc);
marcarDensidad = radios("optDensidad", (v) => {
  acc.modoVoz = v === "voz";
  acc.facil = v === "facil";
  // La letra sigue al modo: Facil y Voz la agrandan y Completa la regresa a normal.
  acc.grande = v !== "completa";
  if (acc.modoVoz) acc.voz = acc.lector !== "si";
  else acc.voz = false;
  guardarAcc();
  aplicarAcc();
});
// Salida a la vista con mapa y letra normal, por si el modo voz se eligio sin querer.
$("salirVoz").addEventListener("click", () => {
  Object.assign(acc, { modoVoz: false, grande: false, contraste: false, voz: false });
  guardarAcc();
  aplicarAcc();
  $("tituloInicio").focus();
});
$("guiaVoz").addEventListener("click", () => { acc.vozGuia = !acc.vozGuia; guardarAcc(); aplicarAcc(); });
$("guiaVibrar").addEventListener("click", () => { acc.vibracion = !acc.vibracion; guardarAcc(); aplicarAcc(); if (acc.vibracion) vibrar([120]); });
$('optToques').addEventListener('change', () => { acc.toques = $('optToques').checked; guardarAcc(); aplicarAcc(); });
for (const [k, id] of Object.entries(OPCIONES)) {
  $(id).addEventListener("change", (e) => {
    acc[k] = e.target.checked;
    if (k === "voz") acc.vozElegida = true;
    if (k === "camino") acc.movilidad = acc.camino ? (acc.movilidad === "silla" ? "silla" : "poco") : "normal";
    guardarAcc();
    aplicarAcc();
    if (k === "camino" || k === "unidos") calcular();
  });
}
aplicarAcc();

// Pantallas: cada una dice si lleva mapa, encabezado y a que pestana pertenece.
const PANTALLAS = {
  bienvenida: {},
  tutorial: {},
  inicio: { tab: "inicio" },
  buscar: { tab: "inicio", encabezado: true },
  nombrar: { tab: "inicio", encabezado: true },
  llegarHora: { tab: "inicio", encabezado: true },
  elegirMapa: { tab: "inicio", mapa: true, encabezado: true },
  opciones: { tab: "inicio", mapa: true, encabezado: true },
  detalle: { tab: "inicio", mapa: true, encabezado: true },
  camiones: { tab: "camiones", mapa: true, encabezado: true },
  linea: { tab: "camiones", mapa: true, encabezado: true },
  ubicacion: { tab: "inicio", mapa: true, encabezado: true },
  camara: { tab: "inicio", encabezado: true },
  practica: { tab: "inicio", encabezado: true },
  cuenta: { encabezado: true },
  guia: {},
  reporte: { tab: "inicio", encabezado: true },
  ahorro: { tab: "inicio", encabezado: true },
  co2: { tab: "inicio", encabezado: true },
  racha: { tab: "inicio", encabezado: true },
  ajustes: { tab: "ajustes" },
  perfil: { tab: "ajustes", encabezado: true },
  ajuste: { tab: "ajustes", encabezado: true },
};
const titulos = { llegarHora: "Llegar a tiempo", cuenta: "Tu cuenta", reporte: "Reportar", racha: "Tu tlacuache", nombrar: "Guardar un lugar", co2: "Lo que evitamos", ahorro: "Tu ahorro", buscar: "Buscar", camiones: "Camiones cerca", ubicacion: "Dónde estoy", elegirMapa: "Elige en el mapa", perfil: "Tu perfil de viaje", camara: "Cámara que habla", practica: "Practicar los toques" };

function actualizarVozEncabezado() {
  const boton = $("vozEncabezado"), enCamara = document.body.dataset.pantalla === "camara";
  const etiqueta = enCamara ? "Avisos con voz" : acc.voz ? "Silenciar Grieta" : "Activar voz";
  boton.setAttribute("aria-label", etiqueta);
  boton.title = etiqueta;
  boton.disabled = enCamara && acc.lector === "si";
  boton.hidden = !enCamara && !acc.modoVoz;
  $("logoEncabezado").hidden = !boton.hidden;
  if (enCamara) boton.setAttribute("aria-pressed", String(camaraConVoz && !boton.disabled));
  else boton.removeAttribute("aria-pressed");
}
let ayudaToquesDicha = false;
function mostrar(nombre) {
  if (dictadoActual) cancelarDictado();
  if (nombre !== "opciones") quitarMapaGrande();
  if (nombre !== "racha") pelajeVista = null;
  // Lo que se estaba leyendo de otra pantalla se calla al salir de ella; la guia y su camara siguen hablando.
  const antes = document.body.dataset.pantalla;
  if (antes && antes !== nombre && !(guia.activa && ["guia", "camara"].includes(nombre))) detenerVoz();
  ToquesGrieta.reiniciar();
  const conf = PANTALLAS[nombre];
  if (nombre !== "camara") CamaraGrieta.cerrar();
  if (!$("chofer").hidden) tarjetaChofer(false);
  if (guia.activa && !["guia", "camara"].includes(nombre)) terminarGuia(true);
  // El aviso de "Guardaste..." vive solo mientras sigues en el inicio.
  if (nombre !== "inicio" && nuevoGuardado && document.body.dataset.pantalla === "inicio") { nuevoGuardado = null; pintarGuardados(); }
  if (nombre === "inicio") {
    // En modo Voz la forma de usar los toques se dice en voz alta una vez, no se muestra.
    if (acc.modoVoz && !$("ayudaToques").hidden && !ayudaToquesDicha) { ayudaToquesDicha = true; setTimeout(() => hablar($("ayudaToques").textContent, true), 600); }
    estado.guardando = null;
    estado.seguroApagado = estado.seguroVerTodas = false;
    limpiarRuta();
    pintarViajes();
    pintarRutina();
    estado.impacto ??= leer("grieta-impacto", null);
    pintarPastillaCo2();
    pintarAhorro();
    pintarRachaInicio();
    pintarImpacto();
    pintarSalida();
    pintarHorario();
    $("invitaPerfil").hidden = acc.modoVoz || leer("grieta-perfil", false) || leer("grieta-invita-cerrada", false);
  }
  if ($("hojaPerfil").open) $("hojaPerfil").close();
  if ($("hojaAyuda").open) $("hojaAyuda").close();
  if (nombre === "perfil") { pintarCredencial(); requestAnimationFrame(pintarResumenPerfil); }
  if (nombre === "ajustes") $("perfilTlacuache").innerHTML = tlacuache(3, racha.puestos, false);
  if (nombre === "opciones") {
    quitarTrazo();
    estado.lineaAPie?.addTo(mapa);
  } else estado.lineaAPie?.remove();
  if (nombre !== "elegirMapa") capas.punto?.remove();
  if (nombre !== "camiones") { capas.paradas?.remove(); capas.paradas = null; }
  else capas.linea?.setStyle?.({ opacity: 0 });
  if (nombre !== "linea") { capas.rutaLinea?.remove(); capas.rutaLinea = null; }
  if (nombre !== "ubicacion") { capas.yo?.remove(); capas.yo = null; }
  if (nombre !== "camiones" && nombre !== "ubicacion") { capas.vista?.remove(); capas.vista = null; }
  if ($("dialogoLugar").open) $("dialogoLugar").close();
  if (nombre !== "buscar" && nombre !== "elegirMapa") cambioUbicacionGuardada = null;
  if (quitado && nombre !== quitado.pantalla) { quitado = null; pintarGuardados(); }
  for (const s of document.querySelectorAll(".pantalla")) s.hidden = s.id !== nombre;
  if (nombre === "camara" && document.body.dataset.pantalla !== "camara") camaraConVoz = true;
  document.body.dataset.pantalla = nombre;
  if (nombre === "camiones") iniciarEstimados(); else if (relojEstimados) detenerEstimados();
  if (nombre === "guia") requestAnimationFrame(pintarBotonSimulador);
  actualizarVozEncabezado();
  document.body.classList.toggle("con-mapa", Boolean(conf.mapa));
  document.body.classList.remove("alerta");
  $("encabezado").hidden = !conf.encabezado;
  if (conf.encabezado) $("tituloPantalla").textContent = nombre === "linea" ? estado.linea?.linea ?? "" : titulos[nombre] ?? "";
  $("pestanas").hidden = !conf.tab;
  for (const b of $("pestanas").children) {
    if (b.dataset.tab === conf.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  if (nombre !== "guia") document.body.classList.remove("guia-mapa");
  else entrarMapaPie();
  if (nombre === "camara") CamaraGrieta.abrir();
  if (nombre === "camara" || antes === "camara") guia.previo && guia.pasosPie ? avanzarPie(guia.previo.lat, guia.previo.lon) : pintarVueltaPie();
  if (nombre === "practica") PracticaGrieta.entrar();
  if (nombre === "tutorial") TutorialGrieta.entrar();
  $("hoja").scrollTop = 0;
  // El foco va al titulo para que el lector de pantalla anuncie el cambio.
  const titulo = conf.encabezado ? $("tituloPantalla") : [...$(nombre).querySelectorAll("h1")].find((h) => !h.closest("[hidden]"));
  titulo?.focus({ preventScroll: true });
  pedirCortes();
  setTimeout(() => { mapa.invalidateSize(); if (conf.mapa) reencuadrar(nombre); }, 60);
}
// Un mapa que estuvo oculto pierde el encuadre; se rehace con lo que toca en cada pantalla.
function reencuadrar(nombre) {
  if (nombre === "camiones" && vistaEstimados) return;
  // Con el mapa oculto (modo para personas ciegas) no hay a donde moverlo: Leaflet calcularia posiciones invalidas.
  if (!$("mapa").offsetHeight) return;
  if (nombre === "linea" && capas.rutaLinea) return encuadrarLinea();
  if (nombre === "camiones" && estado.listaCamiones?.[0] && estado.puntoCamiones) {
    const [p, a] = [estado.puntoCamiones, estado.listaCamiones[0]];
    return encuadrar(L.latLngBounds([[p.lat, p.lon], [a.lat, a.lon]]));
  }
  if (nombre === "ubicacion" && capas.yo) return mapa.setView(capas.yo.getLatLng(), 17);
  const capa = nombre === "detalle" ? capas.camion ?? capas.linea : nombre === "opciones" ? capas.linea : null;
  if (capa) return encuadrar(capa.getBounds());
  const c = estado.gps ?? estado.origen;
  if (nombre === "inicio" && c) suave() ? mapa.flyTo([c.lat, c.lon], 15, { duration: 0.6 }) : mapa.setView([c.lat, c.lon], 15);
}
// Regla de diseno: al reposo ningun boton ni ficha queda partido por la orilla de la hoja o por la barra fija.
// La hoja crece para mostrarlo entero si el mapa conserva 30 % de la pantalla; si no, se corta justo antes.
const BLOQUES = "button, li, label, h2, p, .co2-comparar, .tarjeta, .parada-cerca, .a-pie, .aviso, .tl-dormido";
function evitarCortes() {
  ajustarCifras();
  if (document.body.classList.contains("mapa-grande")) return;
  const hoja = $("hoja"), pantalla = $(document.body.dataset.pantalla ?? "");
  if (hoja.scrollTop > 0) return;
  hoja.style.maxHeight = "";
  if (!pantalla || !document.body.classList.contains("con-mapa") || document.body.classList.contains("guia-mapa") || !$("mapa").offsetHeight) return;
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const caja = hoja.getBoundingClientRect(), fija = pantalla.querySelector(".acciones-fijas");
    const limite = (fija?.offsetHeight ? Math.min(caja.bottom, fija.getBoundingClientRect().top) : caja.bottom);
    const cortado = [...pantalla.querySelectorAll(BLOQUES)]
      .filter((e) => e.offsetParent && !fija?.contains(e))
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height && r.top < limite - 2 && r.bottom > limite + 1)
      .sort((a, b) => a.top - b.top)[0];
    if (!cortado) break;
    const crecer = cortado.bottom - limite;
    const queda = $("mapa").getBoundingClientRect().height - crecer;
    // Si encoger escondería casi media hoja, el mapa cede hasta 20% en vez de dejar la hoja casi vacía.
    const cabe = vuelta === 0 && (queda >= innerHeight * 0.3 || (queda >= innerHeight * 0.2 && limite - cortado.top > caja.height * 0.4));
    // En opciones nunca se esconde el recuadro del viaje: el mapa cede hasta 11.5 % para que quepan el boton y la hora de llegada.
    const empezar = pantalla.id === "opciones" ? $("tarjetas").querySelector(".hv-empezar")?.getBoundingClientRect() : null;
    const ultimo = pantalla.id === "opciones" ? $("tarjetas").querySelector(".boleto-hora")?.getBoundingClientRect() : null;
    if (!cabe && empezar && ultimo && cortado.top <= ultimo.top + 1) {
      const falta = ultimo.bottom - limite, cede = Math.max(0, $("mapa").getBoundingClientRect().height - innerHeight * 0.115);
      hoja.style.maxHeight = `${caja.height + (falta <= cede ? falta : cortado.top >= empezar.top - 1 ? cortado.top - limite : cede)}px`;
      break;
    }
    hoja.style.maxHeight = `${caja.height + (cabe ? crecer : cortado.top - limite)}px`;
  }
  mapa.invalidateSize();
}
let revisionCortes = 0, segundaRevision = 0;
// Se revisa al siguiente cuadro y otra vez cuando la pantalla ya se acomodo.
const pedirCortes = () => {
  cancelAnimationFrame(revisionCortes); clearTimeout(segundaRevision);
  revisionCortes = requestAnimationFrame(evitarCortes);
  segundaRevision = setTimeout(evitarCortes, 400);
};
const vigiaCortes = new ResizeObserver(pedirCortes);
// Se vigila todo lo que hay en la hoja: un aviso que aparece arriba recorre la pantalla sin cambiarle el tamano.
for (const e of $("hoja").children) vigiaCortes.observe(e);
document.fonts?.ready.then(pedirCortes);
addEventListener("resize", pedirCortes);
function ir(nombre, reemplazar) {
  if (history.state?.p !== nombre) history[reemplazar ? "replaceState" : "pushState"]({ p: nombre }, "");
  mostrar(nombre);
}
addEventListener("popstate", (e) => {
  const pantalla = e.state?.p ?? "inicio";
  mostrar(pantalla);
  if (pantalla === "camiones" && (estado.gps ?? estado.origen)) cargarCamiones(estado.gps ?? estado.origen, false);
  if (pantalla === "ubicacion" && estado.gps) ponerYo();
});
$("atras").addEventListener("click", () => { if (!cerrarMapaGrande()) history.state && history.length > 1 ? history.back() : ir("inicio", true); });
// En la app instalada de iPhone no hay gesto para regresar: deslizar desde la orilla izquierda hace lo mismo que la flecha,
// que queda lejos del pulgar. No aplica sobre el mapa ni en la guia, que no tiene encabezado.
let deslizar = null;
addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  deslizar = !$("encabezado").hidden && t.clientX < 24 && !e.target.closest(".leaflet-container") ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  if (deslizar && t.clientX - deslizar.x > 80 && Math.abs(t.clientY - deslizar.y) < 60) $("atras").click();
  deslizar = null;
}, { passive: true });
$("pestanas").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const tab = b.dataset.tab;
  if (tab === "camiones") return abrirCamiones();
  if (tab === "reporte") return abrirReporte();
  ir(tab);
});

for (const [id, clave] of Object.entries({ tituloInicio: "a_donde_vas", empezar: "empezar", vozRepetir: "repetir", terminar: "terminar", yaPaso: "ya_paso", vieneLleno: "viene_lleno" })) {
  const boton = $(id);
  boton.lastChild.textContent = textoFrase(frase(clave));
}
$("nombreOtomi").textContent = NOMBRE_OTOMI;
$("vozEncabezado").addEventListener("click", () => {
  if (document.body.dataset.pantalla === "camara") {
    camaraConVoz = !camaraConVoz;
    actualizarVozEncabezado();
    if (camaraConVoz) CamaraGrieta.repetir();
    else detenerVoz();
    return;
  }
  acc.voz = !acc.voz; acc.vozElegida = true;
  guardarAcc(); aplicarAcc();
});

// Voz y vibracion, con un tono por pulso para que en iPhone tambien haya senal.
// Los nombres de las paradas son cruces escritos con abreviaturas: se leen como se dicen.
const DECIR = [[/\s*\/\s*/g, " y "], [/\bBlvd\./g, "bulevar"], [/\bAv\./g, "avenida"], [/\bFracc\./g, "fraccionamiento"], [/\bCol\./g, "colonia"], [/\bUaq\b/g, "UAQ"]];
// Lo urgente interrumpe lo que se esta diciendo; lo secundario espera su turno.
// Con la voz de Grieta apagada, lo que no se ve en pantalla se le pasa al lector de pantalla del telefono.
function detenerVoz() {
  if (grabacion || window.speechSynthesis?.speaking || window.speechSynthesis?.pending) ultimaVozDetenida = performance.now();
  turnoVoz++;
  grabacion?.pause();
  grabacion = null;
  finalizarLectura?.();
  finalizarLectura = null;
  colaVoz = Promise.resolve();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
// En un viaje manda el boton Voz de la guia; fuera del viaje, la voz de toda la app.
function vozActiva() {
  const enViaje = viajeEnCurso && ["guia", "camara"].includes(document.body.dataset.pantalla);
  return enViaje ? acc.vozGuia || (acc.modoVoz && acc.voz) : acc.voz;
}
function vozEspanol(texto, alTerminar) {
  if (microfonoActivo || !vozActiva() || !("speechSynthesis" in window)) return alTerminar?.();
  const u = new SpeechSynthesisUtterance(DECIR.reduce((t, [a, b]) => t.replace(a, b), texto));
  vozGrieta ??= speechSynthesis.getVoices().find((v) => v.lang === "es-MX") ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
  if (vozGrieta) u.voice = vozGrieta;
  u.lang = "es-MX";
  u.rate = acc.lenta ? 0.8 : 1;
  u.onend = u.onerror = alTerminar;
  speechSynthesis.speak(u);
}
function esperarVoz(texto) {
  if (!/[\p{L}\p{N}]/u.test(texto)) return Promise.resolve();
  return new Promise((resolve) => {
    const fin = () => { if (finalizarLectura === fin) finalizarLectura = null; resolve(); };
    finalizarLectura = fin;
    vozEspanol(texto, fin);
  });
}
function reproducirAudio(id) {
  return new Promise((resolve) => {
    const clip = new Audio(`audio/oto/${id}.mp3`);
    clip.playbackRate = acc.lenta ? 0.8 : 1;
    grabacion = clip;
    const fin = (reproducido = false) => {
      clip.onended = clip.onerror = null;
      if (grabacion === clip) grabacion = null;
      if (finalizarLectura === cancelar) finalizarLectura = null;
      resolve(reproducido);
    };
    const cancelar = () => fin(false);
    finalizarLectura = cancelar;
    clip.onended = () => fin(true);
    clip.onerror = cancelar;
    clip.play().catch(cancelar);
  });
}
async function leerGrabaciones(mensaje, turno) {
  let pendiente = "";
  const partes = [mensaje].flat(Infinity);
  for (const parte of partes) {
    if (turno !== turnoVoz) return;
    if (parte?.id && audiosOto.has(parte.id)) {
      await esperarVoz(pendiente);
      pendiente = "";
      if (turno !== turnoVoz) return;
      const reproducido = await reproducirAudio(parte.id);
      if (turno !== turnoVoz) return;
      // Los nombres, numeros y horas siempre se dicen en espanol despues de la grabacion.
      pendiente = reproducido ? [...FRASES[parte.id].matchAll(/\{(\w+)\}/g)].map((m) => parte.valores[m[1]] ?? "").join(", ") : textoFrase(parte);
    } else pendiente += textoFrase(parte);
  }
  if (turno === turnoVoz) await esperarVoz(pendiente);
}
function hablar(mensaje, enCola = false, enPantalla = false, soloEspanol = false) {
  if (microfonoActivo) return;
  const texto = textoFrase(mensaje);
  ultimoMensaje = mensaje;
  if (!acc.voz && acc.modoVoz && !enPantalla) {
    $("anuncio").textContent = "";
    const turno = turnoVoz;
    setTimeout(() => { if (!microfonoActivo && turno === turnoVoz) $("anuncio").textContent = texto; }, 60);
  }
  if (!vozActiva()) return;
  if (!enCola) detenerVoz();
  if (!soloEspanol && acc.lengua === "oto" && lenguasDisponibles.includes("oto") && audiosOto.size) {
    const turno = turnoVoz;
    colaVoz = colaVoz.then(() => { if (turno === turnoVoz) return leerGrabaciones(mensaje, turno); }).catch(() => {});
  } else vozEspanol(texto);
}
async function prepararLenguas(config) {
  lenguasDisponibles = Array.isArray(config.lenguas) ? config.lenguas.filter((l) => l === "oto") : [];
  if (!lenguasDisponibles.length) return;
  if ("serviceWorker" in navigator) {
    try {
      const registro = await navigator.serviceWorker.ready;
      audiosOto = await new Promise((resolve) => {
        const canal = new MessageChannel();
        const fin = (ids) => { clearTimeout(limite); canal.port1.close(); resolve(new Set(ids)); };
        const limite = setTimeout(() => fin([]), 8000);
        canal.port1.onmessage = (e) => fin(Array.isArray(e.data) ? e.data : []);
        registro.active.postMessage({ tipo: "guardar-audios", ids: Object.keys(FRASES) }, [canal.port2]);
      });
    } catch {}
  } else {
    const disponibles = await Promise.all(Object.keys(FRASES).map(async (id) => {
      try {
        const respuesta = await fetch(`audio/oto/${id}.mp3`);
        return respuesta.ok ? id : null;
      } catch { return null; }
    }));
    audiosOto = new Set(disponibles.filter(Boolean));
  }
  actualizarFilasPerfil();
}
// Safari en iPhone no tiene navigator.vibrate; tocar un interruptor nativo (iOS 18) da un golpe haptico.
let interruptorHaptico;
function golpeHaptico(patron) {
  if (!interruptorHaptico) {
    interruptorHaptico = document.createElement("label");
    interruptorHaptico.className = "oculto";
    interruptorHaptico.setAttribute("aria-hidden", "true");
    interruptorHaptico.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    interruptorHaptico.addEventListener("change", (e) => e.stopPropagation());
    document.body.append(interruptorHaptico);
  }
  let t = 0;
  patron.forEach((ms, i) => {
    if (i % 2 === 0) for (let k = 0; k < Math.max(1, Math.round(ms / 150)); k++) setTimeout(() => interruptorHaptico.click(), t + k * 150);
    t += ms;
  });
}
function vibrar(patron) {
  if (acc.vibracion) {
    if (typeof navigator.vibrate === "function") navigator.vibrate(patron);
    else golpeHaptico(patron);
  }
  // El tono solo acompana avisos importantes (pulsos largos); los toques cortos no pitan.
  if ((!vozActiva() && acc.lector !== "si") || !patron.some((ms, i) => i % 2 === 0 && ms >= 300)) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime;
    patron.forEach((ms, i) => {
      if (i % 2 === 0) {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.2, t);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + Math.min(ms, 400) / 1000);
      }
      t += ms / 1000;
    });
  } catch {}
}
const avisar = (texto) => { $("estado").textContent = texto; };
let relojAviso = null;
const avisarBreve = (texto) => { avisar(texto); clearTimeout(relojAviso); relojAviso = setTimeout(() => { if ($("estado").textContent === texto) avisar(""); }, 4000); };

// Ubicacion y lugares
const dentroDeQueretaro = (lat, lon) => Grieta.metros(lat, lon, QUERETARO[0], QUERETARO[1]) / 1000 <= RADIO_KM;
const esGps = (l) => l?.nombre === "Tu ubicación";

function poner(cual, lugar, sinNavegar = false) {
  if (cual === "destino") {
    cancelarDictado();
    if (cambioUbicacionGuardada) {
      guardarEdicionLugar(cambioUbicacionGuardada, lugar);
      cambioUbicacionGuardada = null;
      history.go(document.body.dataset.pantalla === "elegirMapa" ? -2 : -1);
      return;
    }
  }
  // Venía de "Agregar": se guarda sin calcular ningún viaje.
  if (cual === "destino" && estado.guardando) {
    const { nombre } = estado.guardando, atras = document.body.dataset.pantalla === "elegirMapa" ? 2 : 1;
    estado.guardando = null;
    return nombre ? guardarNuevo(lugar, nombre, atras) : abrirNombrar(lugar, atras);
  }
  estado[cual] = lugar;
  capas[cual]?.remove();
  capas[cual] = L.marker([lugar.lat, lugar.lon], { icon: icono(cual), keyboard: false }).addTo(mapa);
  if (cual === "origen") {
    $("desdeTexto").textContent = `Desde ${esGps(lugar) ? "tu ubicación" : lugar.nombre}`;
    $("cambiarDesde").textContent = "Cambiar";
  }
  if (sinNavegar) return;
  estado.editando = "hacia";
  if (estado.origen && estado.destino) return trazar();
  const enBuscar = document.body.dataset.pantalla === "buscar";
  if (cual === "destino") {
    // Sin origen todavia: el mismo buscador pregunta desde donde sale.
    mapa.setView([lugar.lat, lugar.lon], 14);
    if (!enBuscar) ir("buscar");
    prepararBuscar("desde");
    $("campoBuscar").focus();
    avisar(`Vas a ${lugar.nombre}. ¿Desde dónde sales?`);
    if (acc.modoVoz) hablar(`Vas a ${lugar.nombre}. No sé dónde estás. ${Reconocer ? "Toca el micrófono, arriba a la derecha, y di desde dónde sales después del tono." : "Escribe desde dónde sales."}`);
  } else if (enBuscar) {
    history.back();
  }
}

let revisionUbicacion = 0;
function ubicar(alTerminar, fresca = false) {
  const revision = ++revisionUbicacion;
  if (!navigator.geolocation) return sinUbicacion("Tu navegador no comparte la ubicación.", alTerminar);
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (revision !== revisionUbicacion) return;
      if (!dentroDeQueretaro(coords.latitude, coords.longitude)) return sinUbicacion("Estás fuera de Querétaro.", alTerminar);
      estado.gps = { nombre: "Tu ubicación", lat: coords.latitude, lon: coords.longitude, precision: coords.accuracy, instante: Date.now() };
      if (!estado.origen) {
        poner("origen", estado.gps, document.body.dataset.pantalla === "buscar");
        mapa.setView([coords.latitude, coords.longitude], 15);
      }
      alTerminar?.(true);
    },
    () => { if (revision === revisionUbicacion) sinUbicacion("No pude ver tu ubicación.", alTerminar); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: fresca ? 0 : 60000 },
  );
}
function sinUbicacion(texto, alTerminar) {
  if (!estado.origen) $("desdeTexto").textContent = "Sin ubicación: elige desde dónde sales";
  $("cambiarDesde").textContent = estado.origen ? "Cambiar" : "Elegir";
  alTerminar?.(false);
}
$("cambiarDesde").addEventListener("click", () => abrirBuscar("desde"));

// Buscador
let recientes = leer("grieta-recientes", []);
function guardarReciente(l) {
  if (esGps(l)) return;
  recientes = [{ nombre: l.nombre, detalle: l.detalle ?? "", lat: l.lat, lon: l.lon, tipo: l.tipo }]
    .concat(recientes.filter((r) => r.nombre !== l.nombre || Grieta.metros(r.lat, r.lon, l.lat, l.lon) > 30)).slice(0, 5);
  escribir("grieta-recientes", recientes);
}

function prepararBuscar(modo) {
  estado.editando = modo;
  titulos.buscar = modo === "desde" ? "¿Desde dónde sales?" : "Buscar";
  $("tituloPantalla").textContent = titulos.buscar;
  $("campoBuscar").value = "";
  $("campoBuscar").placeholder = modo === "desde" ? "Desde dónde sales" : "Lugar o calle";
  // Al buscar a donde vas, arriba se ve desde donde sales y se puede cambiar
  $("filaDesde").hidden = modo === "desde";
  sugerir("");
}
function abrirBuscar(modo) {
  ir("buscar");
  prepararBuscar(modo);
  // En el mismo toque, para que el telefono abra el teclado.
  $("campoBuscar").focus();
}
$("abrirBuscar").addEventListener("click", () => abrirBuscar("hacia"));

const fichaLugar = (l, i, icon) => icon === "reloj" ? miniFicha("tono-obsidiana", ico("reloj"))
  : icon === "localizar" ? miniFicha("tono-maiz", picto("donde")) : miniFicha(tonoLugar(l.nombre, i, l.tipo), picto(iconoLugar(l.nombre, l.tipo)));
const filaLugar = (l, i, icon = "pin") => `<li><button type="button" data-i="${i}">
  ${fichaLugar(l, i, icon)}
  <span class="fila-texto"><strong translate="no">${escapar(l.nombre)}</strong>${l.detalle ? `<small translate="no">${escapar(l.detalle)}</small>` : ""}</span>
  ${ico("chevron", "chevron")}</button></li>`;

const cerca = () => estado.gps ?? estado.origen;
function conDistancia(l) {
  const c = cerca();
  if (!c || l.detalle) return l;
  const km = Grieta.metros(c.lat, c.lon, l.lat, l.lon) / 1000;
  return { ...l, detalle: km < 1 ? `A ${Math.round(km * 1000)} m` : `A ${km.toFixed(1)} km` };
}

let espera;
function sugerir(texto, alCompletar = null) {
  clearTimeout(espera);
  const lista = $("resultados");
  const vacio = texto.trim().length < 3;
  $("bloqueRecientes").hidden = !vacio || !recientes.length;
  $("tituloResultados").textContent = vacio ? "Lugares conocidos" : "Resultados";
  $("recientes").innerHTML = recientes.map((l, i) => filaLugar(l, i, "reloj")).join("");
  if (vacio) {
    const c = cerca();
    const base = lugares.map(conDistancia);
    if (c) base.sort((a, b) => Grieta.metros(c.lat, c.lon, a.lat, a.lon) - Grieta.metros(c.lat, c.lon, b.lat, b.lon));
    const fijos = (estado.editando === "desde" && estado.gps ? [{ ...estado.gps, detalle: "Donde estás ahora" }] : []).concat(base.slice(0, 6));
    estado.resultados = fijos;
    lista.innerHTML = fijos.map((l, i) => filaLugar(l, i, esGps(l) ? "localizar" : "pin")).join("") + filaMapa(false);
    return;
  }
  // Primero los lugares guardados y los de la app que coinciden; el buscador de mapas no siempre los conoce por su nombre completo.
  const buscado = sinAcentos(texto);
  const propios = [...guardados, ...lugares].filter((l) => sinAcentos(l.nombre).includes(buscado)).map(conDistancia);
  const pintarResultados = (res, vacio) => {
    estado.resultados = propios.concat(res).slice(0, 8);
    estado.buscado = true;
    lista.innerHTML = (estado.resultados.length ? estado.resultados.map((l, i) => filaLugar(l, i)).join("") : `<li class="vacio">${vacio}</li>`) + filaMapa();
    alCompletar?.(estado.resultados);
  };
  if (alCompletar && propios.length) {
    estado.resultados = propios.slice(0, 8);
    lista.innerHTML = estado.resultados.map((l, i) => filaLugar(l, i)).join("") + filaMapa();
  }
  espera = setTimeout(async () => {
    const c = cerca() ?? { lat: QUERETARO[0], lon: QUERETARO[1] };
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(texto)}&lat=${c.lat}&lon=${c.lon}&limit=6&bbox=-100.65,20.4,-100.15,20.9`;
    // Photon (OpenStreetMap) y la API de Grieta (Azure Maps, que conoce mas negocios y oficinas) a la vez.
    const [osm, azure] = await Promise.allSettled([
      fetch(url).then((r) => r.json()).then(({ features }) => features.map(({ properties: p, geometry: g }) => ({
        nombre: p.name ?? p.street ?? "Sin nombre",
        detalle: [p.street && p.name ? p.street : null, p.district ?? p.city].filter(Boolean).join(", "),
        lat: g.coordinates[1], lon: g.coordinates[0], tipo: p.osm_value,
      }))),
      texto.trim().length >= 4 ? llamar(`/buscar?q=${encodeURIComponent(texto.trim())}&lat=${c.lat}&lon=${c.lon}`) : Promise.resolve([]),
    ]);
    if (texto !== $("campoBuscar").value) return;
    const listas = [azure.status === "fulfilled" ? azure.value : [], osm.status === "fulfilled" ? osm.value : []];
    // Se alternan los dos y se quita un lugar si ya hay otro a menos de 80 m.
    const res = [];
    for (let i = 0; i < 6; i++) {
      for (const l of listas.map((x) => x[i]).filter(Boolean)) {
        if (![...propios, ...res].some((x) => Grieta.metros(x.lat, x.lon, l.lat, l.lon) < 80)) res.push(l);
      }
    }
    if (osm.status === "rejected" && azure.status === "rejected") {
      return pintarResultados([], "No hay conexión con el buscador. Elige un lugar guardado o elígelo en el mapa.");
    }
    pintarResultados(res, `No encontré "${escapar(texto)}". Prueba con la calle y la colonia, o elígelo en el mapa.`);
  }, alCompletar ? 0 : 350);
}
// El buscador de mapas no conoce todos los negocios y oficinas: siempre queda la opcion de elegir el punto.
function filaMapa(buscando = true) {
  return `<li class="fila-mapa"><button type="button" data-mapa>
  <span class="circulo tenue">${ico("pin")}</span>
  <span class="fila-texto"><strong>${buscando ? "¿No aparece? Elígelo en el mapa" : "Elegir en el mapa"}</strong><small>Tocas el punto y yo busco la calle</small></span>
  ${ico("chevron", "chevron")}</button></li>`;
}

function elegirEnMapa() {
  estado.eligiendo = estado.editando === "desde" ? "origen" : "destino";
  estado.puntoMapa = null;
  capas.punto?.remove();
  $("usarPunto").hidden = true;
  aplicarTonoMapa();
  ir("elegirMapa");
  const c = cambioUbicacionGuardada?.lugar ?? cerca() ?? estado.destino ?? { lat: QUERETARO[0], lon: QUERETARO[1] };
  setTimeout(() => mapa.setView([c.lat, c.lon], 15), 80);
}
$("usarPunto").addEventListener("click", () => {
  const lugar = estado.puntoMapa;
  if (!lugar) return;
  cancelarDictado();
  capas.punto?.remove();
  const cual = estado.eligiendo;
  estado.eligiendo = null;
  if (!cambioUbicacionGuardada) guardarReciente(lugar);
  poner(cual, lugar);
  // Si con este punto todavia falta el otro extremo del viaje, poner() ya llevo al buscador; si no, regresa al inicio.
  if (document.body.dataset.pantalla === "elegirMapa" && !(estado.origen && estado.destino)) ir("inicio", true);
});

function elegir(lugar) {
  if (!lugar) return;
  cancelarDictado();
  if (!cambioUbicacionGuardada) guardarReciente(lugar);
  poner(estado.editando === "desde" ? "origen" : "destino", lugar);
}
$("resultados").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b?.hasAttribute("data-mapa")) return elegirEnMapa();
  if (b) elegir(estado.resultados?.[b.dataset.i]);
});
$("recientes").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) elegir(recientes[b.dataset.i]);
});
$("campoBuscar").addEventListener("input", (e) => { cancelarDictado(); sugerir(e.target.value); });
$("campoBuscar").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && estado.resultados?.length && e.target.value.trim().length >= 3) elegir(estado.resultados[0]);
});

mapa.on("click", async ({ latlng }) => {
  // Solo en "Elige en el mapa": en el inicio un toque sin querer cambiaba desde donde sales.
  if (document.body.dataset.pantalla !== "elegirMapa" || !dentroDeQueretaro(latlng.lat, latlng.lng)) return;
  const lugar = { nombre: "Punto en el mapa", lat: latlng.lat, lon: latlng.lng };
  capas.punto?.remove();
  capas.punto = L.marker([latlng.lat, latlng.lng], { icon: icono(estado.eligiendo), keyboard: false }).addTo(mapa);
  $("usarPunto").hidden = false;
  $("usarPunto").textContent = "Buscando la calle...";
  // Primero el nombre de la calle, para que el boton no diga "punto en el mapa".
  try {
    const r = await (await fetch(`https://photon.komoot.io/reverse?lat=${latlng.lat}&lon=${latlng.lng}&limit=1`)).json();
    const p = r.features[0]?.properties;
    lugar.nombre = p?.name ?? ([p?.street, p?.housenumber].filter(Boolean).join(" ") || lugar.nombre);
  } catch {}
  estado.puntoMapa = lugar;
  $("usarPunto").textContent = `Usar este punto: ${lugar.nombre}`;
});


// Ruta y opciones
async function trazar() {
  const { origen: o, destino: d } = estado;
  limpiarRuta(true);
  const pendiente = estado.salidaPendiente;
  estado.salidaPendiente = null;
  estado.momento = pendiente ? ESPERAS.length : 0;
  estado.otra = pendiente ?? null;
  estado.caminatas = { sube: new Map(), baja: new Map(), pedidas: new Set(), relieve: new Map() };
  titulos.opciones = `A ${d.nombre}`;
  // Se pasa de una vez a Como llegar, con la forma de las tarjetas, mientras se pide la ruta por calles.
  ir("opciones", ["buscar", "elegirMapa"].includes(document.body.dataset.pantalla));
  esqueletoOpciones();
  let linea;
  let km = null;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`;
    const r = await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json();
    km = r.routes[0].distance / 1000;
    linea = L.geoJSON(r.routes[0].geometry, { style: { color: tono("--ambar"), weight: 5, opacity: 0.95 } });
  } catch {
    linea = L.polyline([[o.lat, o.lon], [d.lat, d.lon]], { color: tono("--ambar"), weight: 4, dashArray: "4 8" });
  }
  // Si mientras tanto la persona se fue o eligio otro destino, esta ruta ya no se dibuja.
  if (estado.destino !== d) return;
  estado.kmCalle = km;
  capas.linea = linea.addTo(mapa);
  $("opciones").removeAttribute("aria-busy");
  calcular();
  animarTrazo(capas.linea);
  setTimeout(() => encuadrar(capas.linea.getBounds()), 120);
  if (acc.modoVoz) hablar(resumenOpciones(), true);
}

function esqueletoOpciones() {
  $("opciones").setAttribute("aria-busy", "true");
  $("appsRapido").innerHTML = '<span class="esqueleto corto"></span>'.repeat(3);
  $("tarjetas").before($("ultimoCamion"));
  $("tarjetas").innerHTML = `<div class="tl-espera"><svg viewBox="-72 -84 140 88" aria-hidden="true">${tlacuache(3, racha.puestos, false)}</svg><span>Buscando camiones para ti<i></i><i></i><i></i></span></div>`;
  $("llegadaApp").textContent = "Calculando...";
  $("respuestaEspera").textContent = "";
  $("ultimoCamion").hidden = true;
}

// La ruta se dibuja de inicio a fin; las lineas punteadas (caminar) y los puntos de parada se quedan como estan.
function animarTrazo(capa) {
  if (!capa || !suave()) return;
  for (const l of capa.getLayers ? capa.getLayers() : [capa]) {
    const el = l.getElement?.();
    if (!el || l instanceof L.CircleMarker || l.options.dashArray) continue;
    el.setAttribute("pathLength", "1");
    el.classList.add("ruta-dibujandose");
    el.addEventListener("animationend", () => { el.classList.remove("ruta-dibujandose"); el.removeAttribute("pathLength"); }, { once: true });
  }
}

// Lo que se dice al llegar a Como llegar en modo voz: el camino recomendado y la app mas barata.
function resumenOpciones() {
  const r = estado.r;
  const rec = estado.tarjetas?.[0]?.o;
  const app = [...r.directo.porApp].sort((a, b) => a.precio - b.precio)[0];
  const enApp = r.opciones.find((o) => o.tipo === "app");
  const criterios = criteriosViaje(r);
  const primero = `Para ir a ${estado.destino.nombre}, en app el menor precio estimado es ${Grieta.nombreApp(app.app)}, ${app.habitual ? "rango habitual " : ""}${rangoVoz(limitesPrecio(app))}` +
    (enApp ? `; llegas a las ${hora(llegada(enApp))}. ` : ". ");
  const comparacion = criterios.economica === criterios.rapida
    ? `${tituloOpcion(criterios.economica)} es la opción más económica y la más rápida, unos ${Math.round(criterios.rapida.minutos)} minutos. `
    : `La opción más económica es ${tituloOpcion(criterios.economica)}. La más rápida es ${tituloOpcion(criterios.rapida)}, unos ${Math.round(criterios.rapida.minutos)} minutos. `;
  if (!rec) return `${primero}${comparacion}Ahorita ningún camión te lleva.`;
  return `${primero}${comparacion}` +
    `En camión, ${tituloOpcion(rec)}, ${precioOpcionVoz(rec)} y llegas a las ${hora(llegada(rec))}. ` +
    "Toca una opción para escuchar los pasos.";
}

function limpiarRuta(soloMapa) {
  estado.lineaAPie?.remove();
  estado.lineaAPie = null;
  estado.aPie = null;
  capas.linea?.remove();
  capas.linea = null;
  quitarTrazo();
  if (!soloMapa) {
    capas.destino?.remove();
    estado.destino = null;
  }
}

// Camino a pie por las calles con el ruteador peatonal de OpenStreetMap; si no responde, se queda la linea recta.
const caminos = new Map();
async function caminoAPie(a, b) {
  const clave = [a, b].map((x) => x.map((n) => n.toFixed(5)).join(",")).join(";");
  if (!caminos.has(clave)) {
    caminos.set(clave, fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(6000) })
      .then((r) => r.json())
      .then(({ routes: [r] }) => ({ puntos: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]), metros: r.distance, minutos: r.duration / 60 }))
      // El trazo sale de inmediato; la pendiente llega despues y se suma al mismo objeto (c.listo).
      .then((c) => Object.assign(c, { factor: 1, subida: 0, bajada: 0, listo: relieve(c.puntos).then((r) => Object.assign(c, r)) }))
      .catch(() => { caminos.delete(clave); return null; }));
  }
  return caminos.get(clave);
}
// Pendiente del camino con el modelo de terreno de Open-Meteo (celdas de 90 m) y la funcion de Tobler para caminar:
// factor es cuanto mas (o menos) tarda que en plano; si no responde, se camina como en plano.
const tobler = (pendiente) => 6 * Math.exp(-3.5 * Math.abs(Math.max(-0.3, Math.min(0.3, pendiente)) + 0.05));
async function relieve(puntos) {
  const plano = { factor: 1, subida: 0, bajada: 0 };
  let largo = 0;
  for (let i = 1; i < puntos.length; i++) largo += Grieta.metros(...puntos[i - 1], ...puntos[i]);
  if (largo < 60) return plano;
  const paso = Math.max(50, largo / 99), muestras = [puntos[0]];
  let falta = paso;
  for (let i = 1; i < puntos.length; i++) {
    const [a, b] = [puntos[i - 1], puntos[i]];
    let d = Grieta.metros(...a, ...b), hecho = 0;
    while (d - hecho >= falta) {
      hecho += falta;
      muestras.push([a[0] + (b[0] - a[0]) * hecho / d, a[1] + (b[1] - a[1]) * hecho / d]);
      falta = paso;
    }
    falta -= d - hecho;
  }
  muestras.push(puntos.at(-1));
  try {
    const { elevation: z } = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${muestras.map((p) => p[0].toFixed(5)).join(",")}&longitude=${muestras.map((p) => p[1].toFixed(5)).join(",")}`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    if (!Array.isArray(z) || z.length !== muestras.length) return plano;
    // Se suaviza: con celdas de 90 m, dos muestras vecinas pueden brincar sin que la calle lo haga.
    const alto = z.map((_, i) => (z[Math.max(0, i - 1)] + z[i] + z[Math.min(z.length - 1, i + 1)]) / 3);
    let t = 0, tPlano = 0, subida = 0, bajada = 0;
    for (let i = 1; i < muestras.length; i++) {
      const d = Grieta.metros(...muestras[i - 1], ...muestras[i]), dz = alto[i] - alto[i - 1];
      if (!d) continue;
      t += d / tobler(dz / d); tPlano += d / tobler(0);
      if (dz > 0) subida += dz; else bajada -= dz;
    }
    return { factor: tPlano ? t / tPlano : 1, subida: Math.round(subida), bajada: Math.round(bajada) };
  } catch { return plano; }
}
const enVoz = (t) => t.replace(/(\d) m\b/g, "$1 metros");
// Como lo diria una persona; solo cuando se nota.
function pendienteTexto(r) {
  if (!r) return "";
  const { subida: s, bajada: b } = r;
  if (s >= 12 && s > 2 * b) return `de subida, ${s} m`;
  if (b >= 12 && b > 2 * s) return `de bajada, ${b} m`;
  if (s >= 12 && b >= 12) return `sube ${s} m y baja ${b} m`;
  return "";
}
// El GTFS de Qrobus no trae trazos (shapes.txt vacio): se usan los de OpenStreetMap validados contra sus paradas
// (scripts/trazos_osm.py) y, donde no hay, se rutea por calles de parada en parada.
const trazosCamion = new Map();
let trazosOficiales = null;
const claveParada = ([la, lo]) => `${la.toFixed(5)},${lo.toFixed(5)}`;
function cargarTrazos() {
  trazosOficiales ??= fetch("datos/trazos.json").then((r) => r.json()).then(({ trazos }) => {
    const enParada = new Map();
    Grieta.qrobus.patrones.forEach((pat, i) => { if (trazos[i]) pat.paradas.forEach((s, pos) => {
      const k = claveParada(Grieta.qrobus.paradas[s]);
      enParada.set(k, [...(enParada.get(k) ?? []), [i, pos]]);
    }); });
    return { trazos, enParada, puntos: new Map() };
  }).catch(() => { trazosOficiales = null; return null; });
  return trazosOficiales;
}
function decodificar(texto) {
  const pts = [];
  let i = 0, la = 0, lo = 0;
  while (i < texto.length) {
    for (const eje of [0, 1]) {
      let r = 0, des = 0, b;
      do { b = texto.charCodeAt(i++) - 63; r |= (b & 31) << des; des += 5; } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (eje) lo += d; else la += d;
    }
    pts.push([la / 1e5, lo / 1e5]);
  }
  return pts;
}
// Para cada tramo entre dos paradas seguidas: el trazo de OSM si las dos estan sobre el, o null.
async function tramosOficiales(paradas) {
  const t = await cargarTrazos();
  if (!t) return paradas.slice(1).map(() => null);
  const claves = paradas.map(claveParada);
  const patron = (t.enParada.get(claves[0]) ?? []).find(([i, pos]) => claves.every((k, n) => claveParada(Grieta.qrobus.paradas[Grieta.qrobus.patrones[i].paradas[pos + n]] ?? [0, 0]) === k));
  if (!patron) return paradas.slice(1).map(() => null);
  const [i, pos] = patron, tr = t.trazos[i];
  if (!t.puntos.has(i)) t.puntos.set(i, decodificar(tr.p));
  const pts = t.puntos.get(i);
  return paradas.slice(1).map((b, n) => {
    const [ca, cb] = [tr.c[pos + n], tr.c[pos + n + 1]];
    if (ca == null || cb == null || cb < ca) return null;
    const tramo = pts.slice(ca, cb + 1);
    let largo = 0;
    for (let k = 1; k < tramo.length; k++) largo += Grieta.metros(...tramo[k - 1], ...tramo[k]);
    // Un rodeo de mas del triple es otra version de la ruta en OSM: mejor rutear ese tramo.
    return largo > 3 * Grieta.metros(...paradas[n], ...b) + 500 ? null : tramo;
  });
}
function rutearCamion(paradas) {
  const tramos = [];
  for (let i = 0; i < paradas.length - 1; i += 24) tramos.push(paradas.slice(i, i + 25));
  return Promise.all(tramos.map((t) => fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${t.map(([la, lo]) => `${lo},${la}`).join(";")}?overview=full&geometries=geojson&continue_straight=true`, { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json()).then(({ routes: [r] }) => r.geometry.coordinates.map(([lo, la]) => [la, lo]))))
    .then((partes) => quitarVueltas(partes.flat(), paradas));
}
// OSRM toca cada parada aunque quede del otro lado del camellon o en una calle lateral: entra, da vuelta y regresa.
// Se quita ese pico de ida y vuelta solo si empieza o termina junto a una parada; un retorno real del camion se queda.
function quitarVueltas(pts, paradas) {
  const m = (a, b) => Grieta.metros(a[0], a[1], b[0], b[1]);
  const salida = [];
  for (let i = 0; i < pts.length; i++) {
    salida.push(pts[i]);
    let largo = 0, lejos = 0, punta = null;
    for (let j = i + 1; j < pts.length && largo < 5000; j++) {
      largo += m(pts[j - 1], pts[j]);
      const d = m(pts[i], pts[j]);
      if (d > lejos) { lejos = d; punta = pts[j]; }
      if (d < 30 && lejos >= 60 && largo <= 2.4 * lejos + 30 && paradas.some((p) => m(p, punta) < 40 || m(p, pts[i]) < 80)) { i = j - 1; break; }
    }
  }
  return salida;
}
function callesCamion(paradas) {
  const clave = paradas.map(claveParada).join(";");
  if (!trazosCamion.has(clave)) {
    trazosCamion.set(clave, tramosOficiales(paradas).then(async (oficiales) => {
      const salida = [];
      for (let n = 0; n < oficiales.length;) {
        if (oficiales[n]) { salida.push(...oficiales[n]); n++; continue; }
        let fin = n;
        while (fin < oficiales.length && !oficiales[fin]) fin++;
        salida.push(...await rutearCamion(paradas.slice(n, fin + 1)));
        n = fin;
      }
      return salida;
    }).catch(() => { trazosCamion.delete(clave); return null; }));
  }
  return trazosCamion.get(clave);
}
async function porCallesAuto(linea) {
  const pts = linea.getLatLngs().map((p) => [p.lat, p.lng]);
  const puntos = await rutearCamion(pts).catch(() => null);
  if (puntos?.length && linea._map) linea.setLatLngs(puntos);
}
async function porCallesCamion(linea) {
  const puntos = await callesCamion(linea.getLatLngs().map((p) => [p.lat, p.lng]));
  if (puntos && linea._map) linea.setLatLngs(puntos);
}
async function seguirCalles(linea) {
  const pts = linea.getLatLngs().map((p) => [p.lat, p.lng]);
  const c = await caminoAPie(pts[0], pts.at(-1));
  if (c && linea._map) linea.setLatLngs(c.puntos);
  return c;
}

// El mapa se desliza hacia lo que toca ver, salvo para quien pidio menos movimiento en su telefono.
function suave() {
  return !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const encuadrar = (limites) => (!$("mapa").offsetHeight ? null : suave()
  ? mapa.flyToBounds(limites, { padding: [28, 28], duration: 0.6 })
  : mapa.fitBounds(limites, { padding: [28, 28] }));

function momentos() {
  const dia = hoyDia();
  const minuto = ahoraMin();
  const lista = ESPERAS.map((m) => ({ dia, minuto: minuto + m, etiqueta: m ? (m < 60 ? `En ${m} min` : "En 1 h") : "Ahora", corta: m ? (m < 60 ? `+${m} min` : "+1 h") : "Ahora" }));
  const diaOtra = estado.otra && estado.otra.dia !== hoyDia() ? `${DIAS[estado.otra.dia][0].toUpperCase()}${DIAS[estado.otra.dia].slice(1, 3)} ` : "";
  lista.push(estado.otra ? { ...estado.otra, etiqueta: `${diaOtra}${hora(estado.otra.minuto)}` } : { dia, minuto: minuto + 120, etiqueta: "Otra hora", vacia: true });
  return lista;
}
const normalizar = ({ dia, minuto }) => ({ dia: (dia + Math.floor(minuto / 1440)) % 7, minuto: minuto % 1440 });

function calcular() {
  if (!estado.origen || !estado.destino) return;
  const base = { origen: [estado.origen.lat, estado.origen.lon], destino: [estado.destino.lat, estado.destino.lon], kmCalle: estado.kmCalle };
  const lista = momentos();
  const precios = lista.map((m) => Grieta.cotizar({ ...base, ...m }));
  const r = Grieta.evaluar({
    ...base, ...normalizar(lista[estado.momento]),
    app: estado.app, precioVisto: Number($("precio").value), margen: estado.prisa, caminarMax: acc.camino ? 300 : undefined,
    tarifa: acc.unidos ? { pasaje: 2, transbordos: [0, 1] } : undefined, caminatas: estado.caminatas,
  });
  estado.r = r;
  pintarOpciones(r);
  mostrarAPie();
  pintarEspera(lista, precios, base);
  if (estado.elegida && document.body.dataset.pantalla === "detalle") {
    // Al cambiar la hora o el precio, el detalle se rehace con el mismo tipo de camino.
    const igual = r.opciones.find((o) => tituloOpcion(o) === tituloOpcion(estado.elegida)) ?? (estado.elegida.tipo === "app" ? r.opciones.find((o) => o.tipo === "app") : null);
    if (igual) { estado.elegida = igual; pintarDetalle(true); }
  }
  pintarVeredicto(r);
  refinarCaminatas();
}

// Si el destino queda cerca, caminar tambien es una opcion y se dice antes que las apps y el camion.
function mostrarAPie() {
  const { origen: o, destino: d } = estado;
  const clave = `${o.lat},${o.lon};${d.lat},${d.lon}`;
  if (estado.aPie === clave) return;
  estado.aPie = clave;
  estado.minAPie = null;
  estado.lineaAPie?.remove();
  estado.lineaAPie = null;
  $("aPie").hidden = true;
  if (Grieta.metros(o.lat, o.lon, d.lat, d.lon) > 2000) return;
  caminoAPie([o.lat, o.lon], [d.lat, d.lon]).then(async (c) => {
    await c?.listo;
    if (!c || estado.aPie !== clave || minutosCaminando(c.metros * (c.factor ?? 1)) > 25) return;
    // A quien le cuesta caminar no se le promete un tiempo: solo la distancia
    const camina = (acc.movilidad ?? "normal") === "normal";
    $("aPieTexto").textContent = camina ? `Caminando llegas en ${minutosCaminando(c.metros * (c.factor ?? 1))} min` : `Queda a ${distanciaTexto(c.metros)} por calles`;
    $("aPieDetalle").textContent = camina ? `${distanciaTexto(c.metros, true)} por calles, sin costo` : "Si te sientes bien para ir a pie, no cuesta nada";
    $("aPie").hidden = false;
    // La ruta a pie de verdad, punteada como los demas tramos a pie; la amarilla es la del auto.
    estado.lineaAPie = L.polyline(c.puntos, { color: tono("--tinta"), weight: 4, dashArray: "1 8", lineCap: "round" });
    if (document.body.dataset.pantalla === "opciones") {
      estado.lineaAPie.addTo(mapa);
      encuadrar(capas.linea ? capas.linea.getBounds().extend(estado.lineaAPie.getBounds()) : estado.lineaAPie.getBounds());
    }
    // Con el tiempo a pie ya medido, se quitan los camiones que no llegan antes que caminando.
    if (camina) {
      estado.minAPie = minutosCaminando(c.metros * (c.factor ?? 1));
      if (estado.r && estado.tarjetas?.some(({ o }) => o.minutos >= estado.minAPie)) pintarOpciones(estado.r);
    }
  });
}

// Los tramos a pie de las opciones se rehacen con la distancia real por calles; con eso se vuelve a calcular
// y, si caminando ya no alcanzas un camion, se toma el siguiente. Solo se piden las paradas que se usan.
async function refinarCaminatas() {
  const cam = estado.caminatas;
  if (!cam || !estado.r) return;
  const { origen: o, destino: d } = estado;
  const nuevas = [];
  // Las primeras bastan: cada caminata nueva es una consulta al servidor de rutas.
  for (const op of estado.r.opciones.slice(0, 12)) {
    if (!op.paradas) continue;
    // Tambien las paradas a menos de 1 km a las que se llega en app: caminando quiza se alcanzan
    const cerca = (i, p) => Grieta.metros(p.lat, p.lon, ...Grieta.qrobus.paradas[i].slice(0, 2)) <= 1000;
    if (op.pasos[0].tipo === "caminar" || cerca(op.paradas.sube, o)) nuevas.push(["sube", op.paradas.sube, [o.lat, o.lon]]);
    if (op.pasos.at(-1).tipo === "caminar" || cerca(op.paradas.baja, d)) nuevas.push(["baja", op.paradas.baja, [d.lat, d.lon]]);
  }
  const faltan = nuevas.filter(([lado, i]) => !cam.pedidas.has(`${lado}:${i}`));
  if (!faltan.length) return;
  faltan.forEach(([lado, i]) => cam.pedidas.add(`${lado}:${i}`));
  const hechas = await Promise.all(faltan.map(([lado, i, punto]) => {
    const parada = Grieta.qrobus.paradas[i].slice(0, 2);
    // Al motor le llega la distancia que se siente: una subida cuenta como caminar mas.
    return caminoAPie(...(lado === "sube" ? [punto, parada] : [parada, punto])).then(async (c) => c && (await c.listo, cam[lado].set(i, c.metros * (c.factor ?? 1)), cam.relieve.set(`${lado}:${i}`, c)));
  }));
  if (cam === estado.caminatas && hechas.some(Boolean)) calcular();
}

function tituloOpcion(o) {
  if (o.tipo === "app") return o.opcion.replace("Solo app (", "").replace(")", "");
  const lineas = o.pasos.filter((p) => p.tipo === "camion").map((p) => p.linea);
  const apps = o.pasos.filter((p) => p.tipo === "app").map((p) => Grieta.nombreApp(p.app));
  const camion = apps.length ? lineas.join(" + ") : `Qrobus ${lineas.join(" + ")}`;
  return o.pasos[0].tipo === "app" ? [apps[0], camion, ...apps.slice(1)].join(" + ") : [camion, ...apps].join(" + ");
}
const caminata = (o) => Math.round((o.pasos ?? []).filter((p) => p.tipo === "caminar").reduce((s, p) => s + p.min, 0));
// Solo camion lleva el camion en anil y la app el auto en verde
// Si combina, la ficha se alarga con un tramo por medio en el orden del viaje: auto + camion, camion + auto...
const fichaOpcion = (o) => {
  if (o.tipo === "app") return miniFicha("tono-anil", picto("app"));
  const tramos = o.pasos.filter((p) => p.tipo !== "caminar").map((p) => (p.tipo === "app" ? "app" : "qrobus")).filter((t, i, a) => t !== a[i - 1]);
  if (tramos.length === 1) return miniFicha("tono-hospital", picto("qrobus"));
  return `<span class="mini-ficha ficha-combinada" aria-hidden="true">${tramos.map((t) => `<span class="${t === "app" ? "tono-anil" : "tono-hospital"}">${picto(t)}</span>`).join("")}</span>`;
};

// Maximo tres caminos con camion: el mas barato, el mas rapido y uno equilibrado si es distinto.
// El viaje solo en app no lleva tarjeta: ya tiene su seccion con el precio de cada app.
// Las etiquetas se comparan contra todas las opciones, para no decir "mas rapido" si la app llega antes.
// Un minuto a pie pesa mas que uno sentado en el camion.
const valorOpcion = (o) => o.costo + 1.5 * o.minutos + 1.5 * caminata(o);
const masEconomica = (a, b) => a.costo - b.costo || (a.minutos + 1.5 * caminata(a)) - (b.minutos + 1.5 * caminata(b));
const menor = (ops, f) => ops.reduce((a, b) => (f(b) < f(a) ? b : a));
// Modo seguro: de noche o siempre, menos caminata hasta la parada y paradas sobre avenida. No sabe si una zona es segura.
const SEGURO_PIE_MIN = 5, MARCA_SEGURA = "Mejor para esta hora";
const modoSeguro = () => acc.seguro ?? "noche";
const seguroAplica = (r) => modoSeguro() === "siempre" || (modoSeguro() === "noche" && (r.ctx.minuto % 1440 >= 1200 || r.ctx.minuto % 1440 < 360));
const accesoPie = (o) => (o.pasos?.[0]?.tipo === "caminar" ? Math.round(o.pasos[0].min) : 0);
const paradaEnAvenida = (o) => /^(av\b|avenida|blvd|boulevard|carr\b|carretera|prol\b|prolongaci|anillo|paseo|calz)/i.test(Grieta.qrobus.paradas[o.paradas.sube][2]);
const pesoSeguro = (o) => o.minutos + 2 * caminata(o) + (paradaEnAvenida(o) ? 0 : 15) + 6 * (o.transbordos ?? 0) + (o.tipo === "caminando+caminando" ? 0 : 20);
function elegirTarjetas(r) {
  // Un camion que no llega antes que caminando no se ofrece: caminar es gratis.
  let ops = r.opciones.filter((o) => o.tipo !== "app" && !(estado.minAPie && o.minutos >= estado.minAPie));
  estado.seguro = null;
  if (seguroAplica(r) && !estado.seguroApagado && ops.length) {
    const cerca = ops.filter((o) => accesoPie(o) <= SEGURO_PIE_MIN), lejos = ops.filter((o) => accesoPie(o) > SEGURO_PIE_MIN);
    estado.seguro = { sinCerca: !cerca.length, ocultas: cerca.length && !estado.seguroVerTodas ? lejos.length : 0, minutos: lejos.length ? Math.max(...lejos.map(accesoPie)) : 0 };
    if (estado.seguro.ocultas) ops = cerca;
  }
  if (!ops.length) return [];
  const lista = [];
  const agregar = (o, etiqueta) => {
    const ya = lista.find((x) => x.o === o);
    if (ya) ya.etiquetas.push(etiqueta);
    else lista.push({ o, etiquetas: [etiqueta] });
  };
  const criterios = criteriosViaje(r);
  const economica = [...ops].sort(masEconomica)[0];
  agregar(economica, economica === criterios.economica ? "Más económica" : "Menor precio en Qrobus");
  if (criterios.rapida.tipo !== "app") agregar(criterios.rapida, "Más rápida");
  const equilibrada = menor(ops, valorOpcion);
  if (!lista.some((x) => x.o === equilibrada)) agregar(equilibrada, menor(r.opciones, valorOpcion).tipo === "app" ? "Otra opción" : "Recomendado");
  // Si quedan menos de tres, la siguiente mejor como alternativa.
  // Nunca una alternativa que otra opcion le gana en precio y en tiempo a la vez.
  const perdedora = (o) => r.opciones.some((x) => x !== o && x.costo <= o.costo && x.minutos <= o.minutos);
  // Ni una que cuesta mas que otra ya listada para llegar apenas unos minutos antes.
  const casiIgual = (o) => lista.some(({ o: x }) => x.costo < o.costo && x.minutos - o.minutos < 5);
  const resto = ops.filter((o) => !lista.some((x) => x.o === o) && !perdedora(o) && !casiIgual(o)).sort((a, b) => valorOpcion(a) - valorOpcion(b));
  if (lista.length < 3 && resto.length) agregar(resto[0], "Otra opción");
  // De noche no se deja caminar mucho al final: se ofrece bajar del camion y pedir app para la ultima parte.
  const hora = r.ctx.minuto % 1440;
  const caminaAlFinal = (o) => (o.pasos?.at(-1)?.tipo === "caminar" ? o.pasos.at(-1).min : 0);
  if ((hora >= 21 * 60 || hora < 6 * 60) && lista.some(({ o }) => caminaAlFinal(o) > 7)) {
    const noche = "De noche, sin caminar al final";
    const ya = lista.find(({ o }) => o.pasos?.at(-1)?.tipo === "app");
    const conAppAlFinal = ops.filter((o) => o.pasos?.at(-1)?.tipo === "app");
    if (ya) ya.etiquetas = [...ya.etiquetas.filter((e) => e !== "Otra opción"), noche];
    else if (conAppAlFinal.length) agregar(menor(conAppAlFinal, valorOpcion), noche);
  }
  // Siempre que exista, una tarjeta de solo camion aunque tarde mucho o lleve varios transbordos.
  const soloCamion = ops.filter((o) => o.tipo === "caminando+caminando");
  if (soloCamion.length && !lista.some((x) => x.o.tipo === "caminando+caminando")) agregar(menor(soloCamion, valorOpcion), "Solo camión");
  // Si otro camion llega casi igual y evita una caminata que se note, se ofrece aparte.
  const listadas = lista.filter(({ o }) => o.tipo === "caminando+caminando").map(({ o }) => o);
  if (listadas.length) {
    const menosPie = Math.min(...listadas.map(caminata));
    const masTarde = Math.min(...listadas.map((o) => o.minutos)) + 25;
    const comodas = soloCamion.filter((o) => !listadas.includes(o) && caminata(o) <= menosPie - 4 && o.minutos <= masTarde);
    if (comodas.length) agregar(menor(comodas, valorOpcion), "Caminas menos");
  }
  if (estado.seguro && !estado.seguro.sinCerca) {
    const segura = menor(ops, pesoSeguro), i = lista.findIndex((x) => x.o === segura);
    if (i >= 0) lista.splice(i, 1);
    lista.unshift({ o: segura, etiquetas: [MARCA_SEGURA] });
  }
  // Dos caminos con los mismos camiones se ven como la misma tarjeta: se queda el primero.
  return lista.filter((x, i) => lista.findIndex((y) => tituloOpcion(y.o) === tituloOpcion(x.o)) === i);
}

const llegada = (o) => estado.r.ctx.minuto + o.minutos;

const rangoDePrecio = (x) => x.habitual ?? x;
const limitesPrecio = (x) => {
  const rango = rangoDePrecio(x);
  return { bajo: Math.floor(rango.bajo ?? x.precio), alto: Math.ceil(rango.alto ?? x.precio) };
};
const rangoTexto = (x) => `${pesos(x.bajo)}–${Math.round(x.alto)}`;
const rangoFrase = (x) => `de ${pesos(x.bajo)} a ${pesos(x.alto)}`;
const rangoVoz = (x) => `entre ${Math.round(x.bajo)} y ${Math.round(x.alto)} pesos`;
const partesRango = (x) => `<span>${pesos(x.bajo)}</span><wbr><span>–${Math.round(x.alto)}</span>`;
function rangoTramo(o, p, ctx = estado.r.ctx) {
  const tramo = p.hacia ? o.trazo.acceso : o.trazo.salida;
  return Grieta.cotizar({ origen: tramo.puntos[0], destino: tramo.puntos[1], dia: ctx.dia, minuto: ctx.minuto }).porApp.find((x) => x.app === p.app);
}
function rangoOpcion(o, ctx) {
  if (o.tipo === "app") return limitesPrecio(estado.r.directo.mejor);
  const apps = (o.pasos ?? []).filter((p) => p.tipo === "app");
  if (!apps.length) return null;
  // El total del motor ya viene redondeado; la tarifa del camion se suma antes de redondear el rango.
  const pasaje = acc.unidos ? 2 : Grieta.qrobus.pasaje;
  const fijo = pasaje + (acc.unidos ? 0 : pasaje / 2) * (o.transbordos ?? 0);
  const rangos = apps.map((p) => rangoDePrecio(rangoTramo(o, p, ctx)));
  return limitesPrecio({ bajo: fijo + rangos.reduce((s, x) => s + x.bajo, 0), alto: fijo + rangos.reduce((s, x) => s + x.alto, 0) });
}
function criteriosViaje(r) {
  return {
    economica: [...r.opciones].sort(masEconomica)[0],
    rapida: [...r.opciones].sort((a, b) => a.minutos - b.minutos || a.costo - b.costo)[0],
  };
}
const precioOpcionVoz = (o) => { const rango = rangoOpcion(o); return rango ? `precio estimado ${rangoVoz(rango)}` : `${Math.round(o.costo)} pesos`; };

// CO₂ que emitiría un auto en el mismo viaje. 135.7 g/km es la meta para autos nuevos de pasajeros (año 2016)
// de la NOM-163-SEMARNAT-ENER-SCFI-2013: los autos que circulan emiten más, así que la cifra se queda corta.
const CO2_AUTO_G_KM = 135.7;
const sinAuto = (o) => o.tipo !== "app" && !o.pasos?.some((p) => p.tipo === "app");
const co2Auto = (km) => km * CO2_AUTO_G_KM;
const kgTexto = (g) => `${(g / 1000).toFixed(g < 9950 ? 1 : 0)} kg`;
// Lo que gastaria en su propio carro. Gasolina regular: mediana de 290 gasolineras de la zona metropolitana en los
// datos abiertos de la CRE (2026-11-05). Rendimiento: 17.3 km/L, meta de la NOM-163 para autos nuevos (135.7 g/km).
const GASOLINA_LITRO = 23.99;
// Premium: mediana de 250 gasolineras de la misma zona y fuente (2026-11-08).
const GASOLINA_PREMIUM = 28.69;
const precioGasolina = () => (acc.gasolina === "premium" ? GASOLINA_PREMIUM : GASOLINA_LITRO);
const AUTO_KM_LITRO = 17.3;
const CENTRO_HISTORICO = [20.5928, -100.3911];
function pintarCarro(r) {
  const km = r.directo.km;
  const centro = Grieta.metros(estado.destino.lat, estado.destino.lon, ...CENTRO_HISTORICO) < 1200;
  $("enCarro").hidden = !(km > 0) || acc.gasolina === "no";
  $("enCarro").innerHTML = `<div class="hv-caja"><div class="hv-partido">${PLACAS_VIAJE}
    <div class="hv-lado"><span class="hv-top">${picto("app")}</span><span class="hv-nombre">En tu carro, al menos</span><span class="hv-precio pq carro-tag">${pesos((km / AUTO_KM_LITRO) * precioGasolina())}</span><span class="hv-dato"><span>de gasolina${centro ? " más estacionamiento" : ""}</span></span></div>
    <div class="hv-lado der"><span class="hv-top carro-reloj">${ico("reloj")}</span><span class="hv-nombre">Tarda</span><span id="carroMinutos" class="hv-precio">${numeroUnidad(Math.round(r.directo.minutos), "min")}</span><span class="hv-dato"><span id="carroDetalle">Estimado</span></span></div>
    </div>${co2Auto(km) >= 50 ? `<div class="carro-banda">${ico("planta")}<span>En auto emitiría ${kgTexto(co2Auto(km))} de CO₂</span></div>` : ""}</div>`;
  // Saliendo ahorita, cuanto tarda en auto con el trafico real (Azure Maps, desde la API)
  if (estado.momento !== 0) return;
  const { origen: o, destino: d } = estado;
  llamar(`/auto?olat=${o.lat}&olon=${o.lon}&dlat=${d.lat}&dlon=${d.lon}`).then(({ minutos }) => {
    if (estado.r !== r || !$("carroDetalle")) return;
    $("carroMinutos").innerHTML = numeroUnidad(minutos, "min");
    $("carroDetalle").textContent = "con el tráfico de ahorita";
    ajustarCifras();
  }).catch(() => {});
}
// Pronostico por hora de Open-Meteo para el lugar de salida: lluvia o calor durante el viaje, y si alguien reporto
// que la parada donde se sube no tiene techo. Calor = sensacion termica de 30 °C o mas.
const pronosticos = new Map();
async function avisarLluvia(r) {
  const aviso = $("avisoLluvia");
  aviso.hidden = true;
  const o = estado.tarjetas?.[0]?.o;
  const c = o?.pasos?.find((p) => p.tipo === "camion");
  if (!c || r.ctx.dia !== hoyDia() || r.ctx.minuto >= 1440) return;
  const { lat, lon } = estado.origen;
  const clave = `${lat.toFixed(2)},${lon.toFixed(2)},${new Date().toDateString()}`;
  if (!pronosticos.has(clave)) {
    pronosticos.set(clave, fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=precipitation_probability,apparent_temperature&timezone=America%2FMexico_City&forecast_days=1`)
      .then((x) => x.json()).then((x) => ({ lluvia: x.hourly.precipitation_probability, sensacion: x.hourly.apparent_temperature })).catch(() => { pronosticos.delete(clave); return null; }));
  }
  const clima = await pronosticos.get(clave);
  if (!clima?.lluvia || estado.r !== r) return;
  const desde = Math.floor(r.ctx.minuto / 60), hasta = Math.min(23, Math.floor((r.ctx.minuto + o.minutos) / 60));
  const horas = clima.lluvia.slice(desde, hasta + 1);
  const maxima = Math.max(...horas);
  // Para el calor cuenta la hora en que se espera en la parada.
  const horaParada = Math.min(23, Math.floor(c.sale / 60));
  const sensacion = clima.sensacion?.[horaParada];
  const llueve = maxima >= 50, calor = !llueve && sensacion >= 30;
  if (!llueve && !calor) return;
  const reportes = await reportesCerca(c.recorrido[0].lat, c.recorrido[0].lon, 40);
  if (estado.r !== r) return;
  const sinTecho = reportes.some((x) => x.tipo === "sin_techo");
  const techo = sinTecho ? `<span>Reportaron que la parada ${escapar(cruce(c.recorrido[0].nombre))} no tiene techo.</span> ` : "";
  if (llueve) {
    const cuando = desde + horas.indexOf(maxima);
    aviso.innerHTML = `${ico("lluvia")}<span class="fila-texto"><strong>Puede llover a las ${hora(cuando * 60)} (${maxima} %).</strong>
    <small>${techo}<span>Lleva paraguas.</span></small></span>`;
  } else {
    aviso.innerHTML = `${ico("sol")}<span class="fila-texto"><strong>Se sentirán ${Math.round(sensacion)} °C en la parada.</strong>
    <small>${techo}<span>Llega cerca de las ${hora(c.sale)}, cuando pasa el camión, y lleva agua.</span></small></span>`;
  }
  aviso.classList.toggle("calor", calor);
  aviso.hidden = false;
}
// Estaciona y sigue en Qrobus: para ir al Centro, dejar el carro en un estacionamiento junto a una parada y entrar en
// camion. Los estacionamientos salen de OpenStreetMap (scripts/estacionamientos.py); su horario y costo no se conocen.
let estacionamientos;
async function estacionaYSigue(r) {
  const caja = $("estacionaSigue");
  caja.hidden = true;
  const { origen: o, destino: d } = estado;
  const directo = Grieta.metros(o.lat, o.lon, d.lat, d.lon);
  if (acc.gasolina === "no" || Grieta.metros(d.lat, d.lon, ...CENTRO_HISTORICO) > 1200 || Grieta.metros(o.lat, o.lon, ...CENTRO_HISTORICO) < 4000) return;
  estacionamientos ??= fetch("datos/estacionamientos.json").then((x) => x.json()).catch(() => []);
  const lista = await estacionamientos;
  if (estado.r !== r) return;
  // En el camino: sin rodeo grande, lejos del destino para no entrar al Centro en carro y no pegado al origen.
  const candidatos = lista.map((e) => ({ ...e, ida: Grieta.metros(o.lat, o.lon, e.lat, e.lon), resta: Grieta.metros(e.lat, e.lon, d.lat, d.lon) }))
    .filter((e) => e.ida + e.resta <= directo * 1.2 && e.resta >= 2000 && e.ida >= 800)
    .sort((a, b) => a.ida + a.resta - (b.ida + b.resta)).slice(0, 6);
  let mejor = null;
  for (const e of candidatos) {
    const manejo = Math.round((e.ida * 1.3) / 1000 / 28 * 60) + 3;
    const ops = Grieta.evaluar({ origen: [e.lat, e.lon], destino: [d.lat, d.lon], dia: r.ctx.dia, minuto: r.ctx.minuto + manejo, caminarMax: acc.camino ? 300 : undefined, tarifa: acc.unidos ? { pasaje: 2, transbordos: [0, 1] } : undefined }).opciones
      .filter((x) => x.tipo === "caminando+caminando");
    const bus = ops.length && menor(ops, (x) => x.minutos);
    if (bus && (!mejor || manejo + bus.minutos < mejor.total)) mejor = { e, bus, manejo, total: manejo + bus.minutos };
  }
  if (!mejor || estado.r !== r) return;
  const c = mejor.bus.pasos.find((p) => p.tipo === "camion");
  const gasolina = ((mejor.e.ida * 1.3) / 1000 / AUTO_KM_LITRO) * precioGasolina();
  caja.innerHTML = `<span class="mini-ficha ficha-combinada" aria-hidden="true"><span class="tono-obsidiana">${picto("app")}</span><span class="tono-hospital">${picto("qrobus")}</span></span>
    <span class="fila-texto"><strong>Estaciona y sigue en Qrobus: llegas ${hora(r.ctx.minuto + mejor.total)}</strong>
    <small><span>Deja el carro junto a la parada ${escapar(cruce(c.recorrido[0].nombre))} y toma la ${escapar(c.linea)}.</span> <span>Gasolina ${pesos(gasolina)} más ${pesos(mejor.bus.costo)} de camión, sin entrar al Centro.</span>
    <span>Estacionamiento según OpenStreetMap: confirma su horario y costo.</span></small></span>`;
  caja.hidden = false;
}
// Cierres y desvios de fuente oficial (datos/avisos-ciudad.json, ver docs/avisos-ciudad.md): solo si estan vigentes y
// el viaje pasa cerca, por el origen, el destino o el recorrido del primer camion.
let avisosCiudad;
async function avisarCiudad() {
  const caja = $("avisoCiudad");
  caja.hidden = true;
  avisosCiudad ??= fetch("datos/avisos-ciudad.json").then((x) => x.json()).catch(() => []);
  const lista = await avisosCiudad;
  const hoy = new Date().toISOString().slice(0, 10);
  const c = estado.tarjetas?.[0]?.o?.pasos?.find((p) => p.tipo === "camion");
  const puntos = [estado.origen, estado.destino, ...(c?.recorrido ?? [])].filter(Boolean);
  const aviso = lista.find((a) => a.desde <= hoy && hoy <= a.hasta && puntos.some((p) => Grieta.metros(p.lat, p.lon, a.lat, a.lon) <= a.radio_m));
  if (!aviso) return;
  caja.innerHTML = `${ico("alerta")}<span class="fila-texto"><strong>${escapar(aviso.titulo)}</strong><small>${escapar(aviso.detalle)} Fuente: ${escapar(aviso.fuente)}.</small></span>`;
  caja.hidden = false;
}
function pintarSeguro(r) {
  const aplica = seguroAplica(r) && r.opciones.some((o) => o.tipo !== "app"), s = estado.seguro;
  $("seguroBanda").hidden = !aplica;
  $("seguroSwitch").setAttribute("aria-checked", String(!estado.seguroApagado));
  $("seguroTexto").textContent = estado.seguroApagado ? "Apagado en este viaje" : s?.sinCerca ? "No hay paradas a menos de 5 min" : modoSeguro() === "noche" ? "Es de noche: te muestro menos caminata" : "Te muestro menos caminata";
  $("seguroOcultas").hidden = !s?.ocultas;
  if (s?.ocultas) $("seguroOcultasTexto").textContent = s.ocultas === 1 ? `Te oculté 1 ruta que camina ${s.minutos} min hasta la parada.` : `Te oculté ${s.ocultas} rutas que caminan hasta ${s.minutos} min a la parada.`;
}
$("seguroSwitch").addEventListener("click", () => { estado.seguroApagado = !estado.seguroApagado; estado.seguroVerTodas = false; calcular(); });
$("seguroVer").addEventListener("click", () => { estado.seguroVerTodas = true; calcular(); });
// Las pestañas deciden qué viaje va en el recuadro partido; los demás bajan a Otras formas de llegar.
const ORDENES_VIAJE = [
  { id: "barato", texto: "Barato", icono: () => picto("monedas"), elige: (ops) => [...ops].sort(masEconomica)[0] },
  { id: "rapido", texto: "Rápido", icono: () => ico("reloj"), elige: (ops) => menor(ops, (o) => o.minutos) },
  { id: "pie", texto: "Caminar menos", icono: () => picto("caminar"), elige: (ops) => [...ops].sort((a, b) => caminata(a) - caminata(b) || a.minutos - b.minutos)[0] },
  { id: "camion", texto: "Solo camión", icono: () => picto("qrobus"), elige: (ops) => { const solo = ops.filter((o) => o.tipo === "caminando+caminando"); return solo.length ? menor(solo, valorOpcion) : null; } },
];
const ICONO_CAMBIO = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4 2.5 8.5 7 13v-3h9V7H7zM17 11v3H8v3h9v3l4.5-4.5z"/></svg>';
const PLACAS_VIAJE = '<svg class="hv-placas" viewBox="0 0 358 178" preserveAspectRatio="none" aria-hidden="true"><path class="hv-verde" d="M0 0L175.5 0L167.5 27L183.5 53L170.5 80L187.5 110L172.5 142L181.5 178L0 178Z"/><path class="hv-azul" d="M358 0L182.5 0L174.5 27L190.5 53L177.5 80L194.5 110L179.5 142L188.5 178L358 178Z"/></svg>';
const datoViaje = (icono, texto) => `<span class="hv-dato">${icono}<span>${texto}</span></span>`;
// Riel continuo del viaje: cada tramo pega con el siguiente y el ancho del camion sigue a sus minutos.
function rielViaje(o) {
  const pasos = o.pasos ?? [];
  const esApp = (p) => p?.tipo === "app";
  const cambio = (texto, icono) => `<span class="riel-tr apie cambio${texto === "Transbordas" ? " transborda" : ""}"><span class="riel-nodo">${icono}</span><em>${texto}</em></span>`;
  let color = 0;
  const tramos = pasos.map((p, i) => {
    const antes = pasos[i - 1];
    if (p.tipo !== "caminar") {
      const minutos = Math.round(p.tipo === "camion" ? (p.llega - p.sale) || p.min || 0 : p.min ?? 0);
      const union = antes && antes.tipo !== "caminar" ? cambio(esApp(antes) || esApp(p) ? "Cambias" : "Transbordas", ICONO_CAMBIO) : "";
      const nombre = esApp(p) ? Grieta.nombreApp(p.app) : p.linea;
      return `${union}<span class="riel-tr bus c${color++ % 2}${nombre.length > 4 ? " largo" : ""}" data-flex="${Math.max(minutos, 14)} 1 0"><b translate="no">${escapar(nombre)}</b><em>${minutos} min</em></span>`;
    }
    const previo = pasos.slice(0, i).reverse().find((x) => x.tipo !== "caminar"), sigue = pasos.slice(i + 1).find((x) => x.tipo !== "caminar");
    if (previo && sigue) return cambio(esApp(previo) || esApp(sigue) ? "Cambias" : "Transbordas", picto("caminar"));
    return `<span class="riel-tr apie"><span class="riel-nodo">${picto("caminar")}</span><em>${Math.max(1, Math.round(p.min))} min</em></span>`;
  }).join("");
  const conducidos = pasos.filter((p) => p.tipo !== "caminar").length;
  return `<span class="riel${conducidos > 2 ? " denso" : ""}${conducidos > 3 ? " sin-letrero" : ""}">${tramos}</span>`;
}
const VER_RUTA = '<span class="hv-ver">Ver ruta<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>';
const numeroUnidad = (n, u) => `${n}<small class="hv-u">${u}</small>`;
const BOLETO_HORA = () => `<button type="button" class="boleto-hora" data-llegar><svg class="boleto-fondo" viewBox="0 0 358 46" preserveAspectRatio="none" aria-hidden="true"><path class="boleto-a" d="M0 0H46L40 12 50 24 42 36 46 46H0Z"/><path class="boleto-b" d="M358 0H52L46 12 56 24 48 36 52 46H358Z"/></svg><span class="boleto-ic">${ico("reloj")}</span><span class="boleto-tx">¿Tienes que llegar a una hora?</span>${ico("chevron", "boleto-chev")}</button>`;
// La cifra grande se achica sola si no cabe en su placa, para que nunca toque la grieta.
function ajustarCifras() {
  for (const l of document.querySelectorAll(".pantalla:not([hidden]) .hv-lado")) {
    const p = l.querySelector(".hv-precio");
    if (!p || !l.clientWidth) continue;
    p.style.fontSize = "";
    const cs = getComputedStyle(l), max = l.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    for (let f = parseFloat(getComputedStyle(p).fontSize); p.getBoundingClientRect().width > max && f > 14; f--) p.style.fontSize = `${f - 1}px`;
  }
}
function pintarOpciones(r) {
  titulos.opciones = `A ${estado.destino.nombre}`;
  if (document.body.dataset.pantalla === "opciones") $("tituloPantalla").textContent = titulos.opciones;
  const ya = guardados.find((g) => Grieta.metros(g.lat, g.lon, estado.destino.lat, estado.destino.lon) < 30);
  const lleno = !ya && guardados.length >= MAX_LUGARES;
  $("guardarLugar").textContent = ya ? `Guardado como ${ya.nombre}` : lleno ? "Ya tienes 4 lugares guardados" : "Guardar este lugar";
  $("guardarLugar").disabled = Boolean(ya) || lleno;
  $("lugarGuardado").hidden = true;
  // Solo cuando se eligio otra hora de salida: ahi importa saber que los precios no son de ahorita.
  const cuando = estado.momento === 0 ? "" : estado.momento < ESPERAS.length ? momentos()[estado.momento].etiqueta.toLowerCase() : `${r.ctx.dia === hoyDia() ? "hoy" : `el ${DIAS[r.ctx.dia]}`} a las ${hora(r.ctx.minuto)}`;
  $("resumenRuta").textContent = cuando ? `Saliendo ${cuando}` : "";
  $("resumenRuta").hidden = !cuando;
  // Los precios de las apps, a la vista sin tener que entrar a una opcion.
  const apps = [...r.directo.porApp].sort((a, b) => a.precio - b.precio);
  $("appsRapido").innerHTML = apps.map((x, i) => `<button type="button" class="app-p" data-app="${x.app}"
      aria-label="Abrir ${Grieta.nombreApp(x.app)}, precio estimado ${rangoVoz(limitesPrecio(x))}${i ? "" : ", la app más económica"}">
      ${fichaApp(x.app)}<span class="app-n">${Grieta.nombreApp(x.app)}</span><strong class="${i ? "" : "gana"}">${rangoTexto(limitesPrecio(x))}</strong><small>${i ? "" : "Menor precio"}</small></button>`).join("");
  $("avisoRapido").textContent = "El costo es aproximado, confírmalo en la app.";
  const enApp = r.opciones.find((o) => o.tipo === "app");
  $("compararPrecio").hidden = !enApp;
  estado.tarjetas = elegirTarjetas(r);
  const criterios = criteriosViaje(r);
  const barata = criterios.economica === enApp, rapida = criterios.rapida === enApp;
  // En masculino: se refiere al viaje en app, no a una "opción" como las tarjetas de camión.
  const etiquetasApp = barata && rapida ? ["Más económico y más rápido"] : [barata && "Más económico", rapida && "Más rápido"].filter(Boolean);
  // La hora de llegada es lo primero que se lee; la duración y si es la más rápida van abajo, más chicas.
  $("llegadaApp").innerHTML = enApp ? `<span>Llegas ${hora(llegada(enApp))}, ${Math.round(enApp.minutos)} min</span>${etiquetasApp.map((t) => `<i class="marca-app">${t}</i>`).join("")}` : "";
  pintarCarro(r);
  estacionaYSigue(r);
  avisarLluvia(r);
  avisarCiudad();
  const appBarata = [...r.directo.porApp].sort((a, b) => a.precio - b.precio)[0];
  $("tarjetas").before($("ultimoCamion"));
  const kgAuto = kgTexto(co2Auto(r.directo.km));
  const vozOpcion = (o, etiquetas) => {
    const pie = [`Llegas ${hora(llegada(o))}`, `${Math.round(o.minutos)} min`];
    if (caminata(o)) pie.push(`caminas ${caminata(o)} min`);
    const ahorro = appBarata.precio - o.costo;
    const mas = enApp ? Math.round(o.minutos - enApp.minutos) : 0;
    const ahorroTexto = ahorro >= 5 ? `Ahorras unos ${pesos(ahorro)}${mas > 0 ? `, tardas ${mas} min más que en app` : ""}` : "";
    const co2 = sinAuto(o) ? `En auto emitiría ${kgAuto} de CO₂` : "";
    return escapar(`${etiquetas.join(" y ")}. ${tituloOpcion(o)}. ${pie.join(". ")}. ${precioOpcionVoz(o)}. ${co2 ? `${co2}. ` : ""}${ahorroTexto}`);
  };
  const razonesSeguras = (o) => `<span class="razones-seguras" aria-hidden="true">${[accesoPie(o) ? `Caminas solo ${accesoPie(o)} min hasta la parada` : "Sin caminar hasta la parada", paradaEnAvenida(o) && "Parada sobre avenida"].filter(Boolean).map((t) => `<span>${ico("palomita")}${t}</span>`).join("")}</span>`;
  const ops = estado.tarjetas.map(({ o }) => o);
  const ordenes = ops.length ? ORDENES_VIAJE.map((x) => ({ ...x, o: x.elige(ops) })).filter((x) => x.o) : [];
  const conSegura = estado.tarjetas[0]?.etiquetas.includes(MARCA_SEGURA);
  const orden = ordenes.find((x) => x.id === estado.ordenViaje) ?? (conSegura ? null : ordenes[0]);
  const iHero = orden ? ops.indexOf(orden.o) : 0;
  estado.iHero = iHero;
  const pestanas = ops.length > 1 ? `<div class="seg-viaje" role="group" aria-label="Elige cómo viajar">${ordenes.map((x) => `<button type="button" class="tab-viaje" data-orden="${x.id}" aria-pressed="${x === orden}">${x.icono()}<span>${x.texto}</span></button>`).join("")}</div>` : "";
  const appMin = enApp?.minutos ?? r.directo.minutos, llegaApp = hora(r.ctx.minuto + appMin);
  const limitesApp = limitesPrecio(appBarata), rangoApp = rangoTexto(limitesApp), nApp = Grieta.nombreApp(appBarata.app);
  const vozApp = escapar(`${nApp}, precio estimado ${rangoVoz(limitesApp)}. Llegas ${llegaApp}, ${Math.round(appMin)} min. Ver ruta en app`);
  // Lo que separa a la app de la opcion: un rango, porque el precio de la app no es exacto. Si casi no cambia, una sola cifra.
  const diferencia = (o) => {
    const g = rangoOpcion(o) ?? { bajo: o.costo, alto: o.costo };
    const a = Math.round(limitesApp.bajo - g.bajo), b = Math.round(limitesApp.alto - g.alto), m = Math.min(a, b), M = Math.max(a, b);
    if (m < 5) return null;
    return M - m <= 3 ? pesos(m) : `${pesos(m)}–${M}`;
  };
  const lleg = (t) => [picto("flag"), `Llegas ${t}`], plata = (t) => [picto("monedas"), t], deViaje = (m) => [ico("reloj"), `${Math.round(m)} min de viaje`];
  const aPie = (o) => [picto("caminar"), caminata(o) ? `Caminas ${caminata(o)} min` : "Sin caminar"];
  const ladoViaje = ({ der, attrs, voz, icono, nombre, cifra, tag, azul, chica, datos }) => `<button type="button" class="hv-lado${der ? " der" : ""}" ${attrs} aria-label="${voz}">
    <span class="hv-top">${der ? VER_RUTA + icono : icono + VER_RUTA}</span><span class="hv-nombre">${nombre}</span>
    <span class="hv-precio${tag ? " pq" : ""}${tag && azul ? " azul" : ""}${chica ? " chica" : ""}">${cifra}</span>${datos.map(([i, t]) => datoViaje(i, t)).join("")}</button>`;
  const heroViaje = (id, { o, etiquetas }, i) => {
    const rango = rangoOpcion(o), precio = rango ? rangoTexto(rango) : pesos(o.costo), dif = diferencia(o);
    const iz = { attrs: `data-i="${i}"`, voz: vozOpcion(o, etiquetas), icono: rango ? `<span class="hv-iconos">${picto("qrobus")}${picto("app")}</span>` : picto("qrobus"), nombre: rango ? "Combinado" : "Qrobus" };
    const de = { der: true, attrs: "data-abrir-app", voz: vozApp, icono: picto("app"), nombre: nApp };
    const evita = sinAuto(o) && `<span class="hv-co2">${ico("planta")}<span>Evitas ${kgAuto} de CO₂</span></span>`;
    const llegaO = lleg(hora(llegada(o)));
    let izq, der, banda, clase = "", oculta = null;
    let cta = `<button type="button" class="boton hv-empezar" data-empezar="${i}">Empezar viaje con avisos</button>`;
    if (id === "rapido") {
      const ganaApp = appMin < o.minutos;
      izq = { ...iz, cifra: numeroUnidad(Math.round(o.minutos), "min"), tag: !ganaApp, datos: [llegaO, plata(precio)] };
      der = { ...de, cifra: numeroUnidad(Math.round(appMin), "min"), tag: ganaApp, azul: true, datos: [lleg(llegaApp), plata(rangoApp)] };
      banda = dif ? [ganaApp ? `Pagas ${dif} más` : `Ahorras ${dif}`] : [];
      if (ganaApp) cta = `<button type="button" class="boton hv-empezar hv-boton-app" data-app="${appBarata.app}">Abrir ${nApp}</button>`;
    } else if (id === "pie") {
      const peor = Math.max(...ops.map(caminata)), menos = peor - caminata(o);
      izq = caminata(o) ? { ...iz, cifra: numeroUnidad(caminata(o), "min a pie"), tag: true, datos: [llegaO, plata(precio)] } : { ...iz, cifra: "Sin caminar", chica: true, tag: true, datos: [llegaO, plata(precio)] };
      der = { ...de, cifra: "Sin caminar", chica: true, datos: [lleg(llegaApp), plata(rangoApp)] };
      banda = menos > 0 ? [menos === 1 ? "Caminas 1 minuto menos" : `Caminas ${menos} minutos menos`] : [];
    } else if (id === "camion") {
      const otra = estado.tarjetas.map((x, j) => ({ ...x, j })).filter((x) => x.j !== i && x.o.tipo === "caminando+caminando").sort((a, b) => valorOpcion(a.o) - valorOpcion(b.o))[0];
      const lineas = (x) => escapar(tituloOpcion(x).replace("Qrobus ", ""));
      izq = { ...iz, icono: picto("qrobus"), nombre: lineas(o), cifra: pesos(o.costo), tag: true, datos: [llegaO, aPie(o)] };
      der = otra ? { der: true, attrs: `data-i="${otra.j}"`, voz: vozOpcion(otra.o, otra.etiquetas), icono: picto("qrobus"), nombre: `Otra, ${lineas(otra.o)}`, cifra: pesos(otra.o.costo), datos: [lleg(hora(llegada(otra.o))), aPie(otra.o)] } : null;
      banda = [evita].filter(Boolean);
      clase = " dos-verdes";
      oculta = otra?.j ?? null;
    } else {
      izq = { ...iz, cifra: precio, tag: true, datos: [llegaO, deViaje(o.minutos)] };
      der = { ...de, cifra: rangoApp, datos: [lleg(llegaApp), deViaje(appMin)] };
      banda = [dif && `<span>${rango ? "Ahorras unos" : "Ahorras"} ${dif}</span>`, evita].filter(Boolean);
    }
    const bandaHtml = banda.length ? `<div class="hv-banda">${banda.map((t) => (t.startsWith("<") ? t : `<span>${t}</span>`)).join("")}</div>` : "";
    return {
      oculta,
      html: `<div class="hero-viaje"><div class="hv-caja"><div class="hv-partido${clase}${der ? "" : " solo"}">${der ? PLACAS_VIAJE : ""}${ladoViaje(izq)}${der ? ladoViaje(der) : ""}</div>${bandaHtml}</div>
        <button type="button" class="caja-riel" data-i="${i}" aria-label="${iz.voz}">${rielViaje(o)}</button>
        ${etiquetas.includes(MARCA_SEGURA) ? razonesSeguras(o) : ""}</div>${cta}`,
    };
  };
  const otraForma = ({ o, etiquetas }, i) => {
    const rango = rangoOpcion(o), segura = etiquetas.includes(MARCA_SEGURA);
    const datos = [datoViaje(picto("flag"), `Llegas ${hora(llegada(o))}`), datoViaje(ico("reloj"), `${Math.round(o.minutos)} min de viaje`), caminata(o) && datoViaje(picto("caminar"), `Caminas ${caminata(o)} min`)].filter(Boolean).join("");
    return `<button type="button" class="tarjeta tarjeta-camion otra-forma${segura ? " tarjeta-segura" : ""}" data-i="${i}" aria-label="${vozOpcion(o, etiquetas)}">
      <span class="tarjeta-cabeza">${fichaOpcion(o)}
        <span class="fila-texto">${etiquetas.length ? `<span class="etiqueta">${etiquetas.join(", ")}</span>` : ""}<strong>${escapar(tituloOpcion(o).replace("Qrobus ", ""))}</strong></span>
        <span class="precio${rango ? " precio-rango" : " precio-camion"}">${rango ? partesRango(rango) : pesos(o.costo)}</span></span>
      ${segura ? razonesSeguras(o) : ""}<span class="of-datos" aria-hidden="true">${datos}</span>
      ${rielViaje(o)}
      ${sinAuto(o) ? `<span class="co2" aria-hidden="true">${ico("planta")}<span>En auto emitiría ${kgAuto} de CO₂</span></span>` : ""}
    </button>`;
  };
  const hero = ops.length ? heroViaje(orden?.id ?? "barato", estado.tarjetas[iHero], iHero) : null;
  const otras = estado.tarjetas.map((x, i) => (i === iHero || i === hero?.oculta ? "" : otraForma(x, i))).join("");
  $("tarjetas").innerHTML = `${pestanas}${hero?.html ?? ""}${BOLETO_HORA()}${otras ? `<h2 class="otras-formas">Otras formas de llegar</h2>${otras}` : ""}`;
  for (const t of $("tarjetas").querySelectorAll("[data-flex]")) t.style.flex = t.dataset.flex;
  ajustarCifras();
  const hayCamion = r.opciones.some((o) => o.tipo !== "app");
  $("tituloCamion").hidden = estado.tarjetas.length > 0 || (!hayCamion && !r.pasaCerca);
  // Si el camion de la mejor opcion es de los ultimos del dia, se avisa a que hora pasa el ultimo.
  const conCamion = estado.tarjetas.map(({ o }) => o).find((o) => o.tipo !== "app");
  const c = conCamion?.pasos.find((p) => p.tipo === "camion");
  const quedan = c ? c.ultima - r.ctx.minuto : Infinity;
  $("ultimoCamion").hidden = !(quedan <= 120);
  if (quedan <= 120) {
    const app = [...r.directo.porApp].sort((x, y) => x.precio - y.precio)[0];
    $("ultimoCamion").innerHTML = `${ico("alerta")}<span class="fila-texto"><strong>Último ${escapar(c.linea)}: ${hora(c.ultima)} según el horario</strong>
      <small>En la parada ${escapar(cruce(c.recorrido[0].nombre))}, hacia ${escapar(c.hacia)}. Si lo pierdes, ${Grieta.nombreApp(app.app)} se estima en ${rangoTexto(limitesPrecio(app))}.</small></span>`;
  }
  if (hayCamion && !estado.tarjetas.length) $("tarjetas").innerHTML += `<p class="nota">Caminando llegas antes que en cualquier Qrobus.</p>`;
  // El camion va primero: Grieta busca que se use menos el auto.
  const camionPrimero = estado.tarjetas.length > 0;
  pintarSeguro(r);
  const bloqueCamion = ["seguroBanda", "tituloCamion", "ultimoCamion", "avisoLluvia", "avisoCiudad", "tarjetas", "seguroOcultas"].map($);
  if (camionPrimero) $("enApp").before(...bloqueCamion);
  else $("enApp").after(...bloqueCamion);
  $("opciones").classList.toggle("camion-primero", camionPrimero);
  // El aviso va debajo de la opcion a la que se refiere; arriba empujaba la tarjeta fuera de la hoja.
  $("tarjetas").querySelector(".hv-empezar")?.after($("ultimoCamion"));
  if (!hayCamion && yaNoPasan(r.ctx.minuto)) {
    $("tarjetas").innerHTML += tlacuacheDormido("Ya no pasan<br>camiones a esta hora");
  } else if (!hayCamion) {
    $("tarjetas").innerHTML += `<div class="aviso cuidado sin-camion">${ico("alerta")}<strong>${r.pasaCerca ? "Ningún Qrobus te lleva directo en la próxima hora." : "En la próxima hora no pasa ningún Qrobus cerca."}</strong></div>`;
  }
}
function abrirViajeApp(modo) {
  const o = estado.r.opciones.find((x) => x.tipo === "app");
  if (!o) return null;
  estado.modoApp = modo;
  estado.elegida = o;
  estado.etiquetaElegida = "En app";
  titulos.detalle = tituloOpcion(o);
  ir("detalle");
  pintarDetalle();
  return o;
}
$("tarjetas").addEventListener("click", (e) => {
  if (e.target.closest("[data-llegar]")) return llegarDesdeOpciones();
  if (e.target.closest("[data-abrir-app]")) { abrirViajeApp("ruta"); if (acc.modoVoz) leerDetalle(); return; }
  if (e.target.closest("[data-app]")) return void abrirApp(e);
  const orden = e.target.closest("[data-orden]")?.dataset.orden;
  if (orden) {
    estado.ordenViaje = orden;
    pintarOpciones(estado.r);
    return void $("tarjetas").querySelector(`[data-orden="${orden}"]`)?.focus({ preventScroll: true });
  }
  const empezar = e.target.closest("[data-empezar]");
  if (empezar) {
    const { o, etiquetas } = estado.tarjetas[empezar.dataset.empezar];
    estado.elegida = o;
    estado.etiquetaElegida = etiquetas.join(", ");
    titulos.detalle = tituloOpcion(o);
    return iniciarGuia(o);
  }
  const t = e.target.closest("[data-i]");
  if (t) abrirOpcion(t.dataset.i);
});
function abrirOpcion(i) {
  const { o, etiquetas } = estado.tarjetas[i];
  estado.elegida = o;
  estado.etiquetaElegida = etiquetas.join(", ");
  titulos.detalle = tituloOpcion(o);
  ir("detalle");
  pintarDetalle();
  if (acc.modoVoz) leerDetalle();
}

function leerDetalle() {
  const o = estado.elegida;
  if (o.tipo !== "app") return hablar(`${pasosEnVoz(o)} Abajo está el botón Empezar viaje con avisos: tócalo y te guío hasta que te bajes.`);
  const apps = [...estado.r.directo.porApp].sort((a, b) => a.precio - b.precio);
  hablar(`${apps.every((x) => x.habitual) ? "Rangos habituales en app" : "Precios estimados en app"}: ${apps.map((x) => `${Grieta.nombreApp(x.app)}, ${rangoVoz(limitesPrecio(x))}`).join("; ")}. Toca el botón de la app para pedirla.`);
}

// Comparar lo que marca la app: lleva directo al detalle del viaje en app, con el campo del precio listo.
$("compararPrecio").addEventListener("click", () => {
  if (!abrirViajeApp("comparar")) return;
  if (!estado.app) {
    estado.app = [...estado.r.directo.porApp].sort((a, b) => a.precio - b.precio)[0].app;
    for (const x of $("appVista").children) x.setAttribute("aria-pressed", String(x.dataset.v === estado.app));
  }
  pintarEstimado();
  setTimeout(() => { $("hoja").scrollTop = 0; $("precio").focus({ preventScroll: true }); }, 150);
});

// Inicio de la franja de 3 horas que contiene ese minuto.
const inicioFranja = (minuto) => Math.max(...Grieta.CORTES.filter((c) => c * 60 <= minuto % 1440)) * 60;

function pintarEspera(lista, precios, base) {
  if (!estado.otra) {
    const m = normalizar(lista.at(-1));
    $("dia").value = String(m.dia);
    $("hora").value = Grieta.hhmm(m.minuto);
  }
  const cercanos = precios.slice(0, ESPERAS.length).map((p) => p.mejor.precio);
  // Cada hora contra "Ahora": verde si baja, rojo si sube, neutra si casi no cambia. "Otra hora" se elige abajo.
  const base0 = Math.round(cercanos[0]);
  $("horas").innerHTML = lista.map((m, i) => {
    if (m.vacia) return "";
    const d = Math.round(precios[i].mejor.precio) - base0;
    const tipo = i === 0 ? "" : d <= -3 ? "baja" : d >= 3 ? "sube" : "igual";
    const nota = i === 0 ? "" : tipo === "baja" ? `${pesos(-d)} menos` : tipo === "sube" ? `${pesos(d)} más` : "Igual";
    return `<button type="button" data-i="${i}" aria-pressed="${i === estado.momento}" class="${tipo}"
      aria-label="${m.etiqueta}, precio estimado ${rangoVoz(limitesPrecio(precios[i].mejor))}">
      <strong>${rangoTexto(limitesPrecio(precios[i].mejor))}</strong><i aria-hidden="true"></i><span>${m.corta ?? m.etiqueta}</span>${nota ? `<small>${nota}</small>` : ""}
    </button>`;
  }).join("");
  // Lo que cambia es la franja de 3 horas del modelo, no el trafico de este momento.
  const ahora = cercanos[0];
  const mejor = cercanos.slice(1).reduce((a, p, i) => (p < a.p ? { p, i: i + 1 } : a), { p: Infinity, i: 0 });
  const peor = cercanos.slice(1).reduce((a, p, i) => (p > a.p ? { p, i: i + 1 } : a), { p: -Infinity, i: 0 });
  $("respuestaEspera").className = `respuesta-espera ${ahora - mejor.p >= 5 ? "baja" : peor.p - ahora >= 5 ? "sube" : "igual"}`;
  const [sello, detalle] = ahora - mejor.p >= 5
    ? ["Sí", `Desde las ${hora(inicioFranja(lista[mejor.i].minuto))} lo normal baja ${pesos(ahora - mejor.p)}`]
    : peor.p - ahora >= 5 ? ["No", `Desde las ${hora(inicioFranja(lista[peor.i].minuto))} lo normal sube ${pesos(peor.p - ahora)}`]
      : ["Da igual", "Probablemente el precio no cambie en la próxima hora"];
  $("respuestaEspera").replaceChildren(Object.assign(document.createElement("strong"), { className: "espera-sello", textContent: sello }), Object.assign(document.createElement("span"), { textContent: detalle }));

  const hoy = lista[0];
  const tramos = [];
  for (let i = 0; i < Grieta.CORTES.length - 1; i++) {
    const [a, b] = [Grieta.CORTES[i] * 60, Grieta.CORTES[i + 1] * 60];
    if (b <= hoy.minuto) continue;
    const mejor = Grieta.cotizar({ ...base, dia: hoy.dia, minuto: Math.max(a, hoy.minuto) }).mejor;
    tramos.push({ a, b, p: mejor.precio, rango: limitesPrecio(mejor) });
  }
  const barata = tramos.reduce((x, y) => (y.p < x.p ? y : x), tramos[0]);
  // Solo si mas tarde sale mas barato; si ya es la hora mas barata, el titulo lo dice.
  $("mejorHora").textContent = barata && barata.a > hoy.minuto ? `Lo más barato hoy es de ${hora(barata.a)} a ${hora(barata.b)}: unos ${rangoTexto(barata.rango)}.` : "";
  $("mejorHora").hidden = !$("mejorHora").textContent;
}
// "A que hora salgo": se prueba salir cada 5 minutos desde ahora (hasta 4 horas antes) y se queda la salida
// mas tarde que todavia llega a tiempo, en camion y en app.
$("horas").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  estado.momento = Number(b.dataset.i);
  if (estado.momento === ESPERAS.length && !estado.otra) {
    const m = momentos().at(-1);
    $("dia").value = String((m.dia + Math.floor(m.minuto / 1440)) % 7);
    $("hora").value = Grieta.hhmm(m.minuto);
    leerOtra();
  }
  calcular();
  $("horas").querySelector(`[data-i="${estado.momento}"]`)?.focus();
});
function leerOtra() {
  const [h, m] = ($("hora").value || "12:00").split(":").map(Number);
  estado.otra = { dia: Number($("dia").value), minuto: h * 60 + m };
}
for (const id of ["dia", "hora"]) $(id).addEventListener("input", () => {
  leerOtra();
  estado.momento = ESPERAS.length;
  calcular();
});

// Detalle de un camino, con la hora de cada paso sacada de los mismos pasos.
function pasosDe(o) {
  if (o.tipo === "app") {
    const app = tituloOpcion(o);
    return [
      { ficha: ["tono-anil", "app"], titulo: `Pide ${app}`, nota: `Precio estimado ${rangoFrase(rangoOpcion(o))}.`, hora: estado.r.ctx.minuto },
      { ficha: ["tono-casa", "lugar"], titulo: `Llegas a ${estado.destino.nombre}`, nota: `Unos ${Math.round(o.minutos)} minutos, contando la espera.`, hora: llegada(o) },
    ];
  }
  let t = estado.r.ctx.minuto;
  return o.pasos.map((p) => {
    const min = Math.max(1, Math.round(p.min));
    const inicio = p.tipo === "camion" ? p.sale : t;
    t = p.tipo === "camion" ? p.llega : t + p.min;
    const camina = ["tono-maiz", "caminar"];
    const enApp = ["tono-anil", "app"];
    if (p.tipo === "caminar" && p.transbordo) return { ficha: camina, titulo: `Camina ${min} min y cambia de camión`, nota: p.parada, hora: inicio };
    if (p.tipo === "caminar") {
      const cuesta = pendienteTexto(estado.caminatas?.relieve.get(p.hacia ? `sube:${o.paradas?.sube}` : `baja:${o.paradas?.baja}`));
      return p.hacia
        ? { ficha: camina, titulo: `Camina ${min} min a la parada`, nota: `${p.parada}${cuesta ? `. Camino ${cuesta}` : ""}`, hora: inicio }
        : { ficha: camina, titulo: `Camina ${min} min a tu destino`, nota: `${estado.destino.nombre}. ${cuesta ? `Camino ${cuesta}. ` : ""}Llegas a las ${hora(llegada(o))}.`, hora: inicio };
    }
    if (p.tipo === "app") return p.hacia
      ? { ficha: enApp, titulo: `Pide ${Grieta.nombreApp(p.app)} hasta la parada`, nota: `${p.parada}. Precio estimado ${rangoFrase(limitesPrecio(rangoTramo(o, p)))}.`, hora: inicio }
      : { ficha: enApp, titulo: `Pide ${Grieta.nombreApp(p.app)} a tu destino`, nota: `Precio estimado ${rangoFrase(limitesPrecio(rangoTramo(o, p)))}. Llegas a las ${hora(llegada(o))}.`, hora: inicio };
    return { ficha: ["tono-hospital", "qrobus"], camion: true, titulo: `Toma la línea ${p.linea} a las ${hora(p.sale)}`, nota: `Hacia ${p.hacia}. Bájate en ${p.baja}, ${p.paradas} paradas después, a las ${hora(p.llega)}. Te aviso antes.${p.estimado ? " Horario estimado: Qrobus no publica esta salida." : ""}`, hora: inicio };
  });
}

const azulRutaApp = () => (document.documentElement.classList.contains("claro") ? "#424d88" : "#6a7ae0");
function pintarRutaApp(o) {
  const r = estado.r, barata = [...r.directo.porApp].sort((a, b) => a.precio - b.precio)[0], c = criteriosViaje(r);
  $("rutaAppEtiqueta").textContent = c.rapida === o && c.economica === o ? "Más económico y más rápido" : c.rapida === o ? "Más rápido" : c.economica === o ? "Más económico" : "En app";
  $("rutaAppMin").textContent = `${Math.round(o.minutos)} min`;
  $("rutaAppPrecio").textContent = rangoTexto(limitesPrecio(barata));
  $("rutaAppHora").textContent = hora(llegada(o));
  $("rutaAppPasos").innerHTML = `<li>${miniFicha("tono-anil", picto("app"))}<span class="fila-texto"><strong>Pide tu viaje</strong><small>Desde ${escapar(cruce(estado.origen.nombre))}</small></span><span class="hora">${hora(r.ctx.minuto)}</span></li>
    <li>${miniFicha("tono-hospital", picto("flag"))}<span class="fila-texto"><strong>Llegas a ${escapar(cruce(estado.destino.nombre))}</strong><small>${r.directo.km.toFixed(1)} km en auto</small></span><span class="hora">${hora(llegada(o))}</span></li>`;
}
function pintarDetalle(sinMapa) {
  const o = estado.elegida;
  const esApp = o.tipo === "app";
  const rutaApp = esApp && estado.modoApp === "ruta";
  $("tituloPantalla").textContent = titulos.detalle = rutaApp ? "En app" : esApp ? "Comparar precio" : tituloOpcion(o);
  $("bloqueCamion").hidden = esApp;
  $("bloqueApp").hidden = !esApp || rutaApp;
  $("bloqueRutaApp").hidden = !rutaApp;
  if (esApp) {
    pintarApps(o);
    if (rutaApp) pintarRutaApp(o);
    if (!sinMapa) { quitarTrazo(); capas.linea?.setStyle?.({ color: azulRutaApp() }); if (capas.linea) setTimeout(() => encuadrar(capas.linea.getBounds()), 120); }
    return;
  }
  const etiqueta = estado.etiquetaElegida ?? "Recomendado";
  $("detalleEtiqueta").textContent = etiqueta === "Recomendado" ? "Ruta recomendada" : etiqueta;
  // Tres datos con su color: tiempo en ambar, dinero en verde y la hora de llegada en blanco.
  const rango = rangoOpcion(o);
  $("detalleMin").textContent = `${Math.round(o.minutos)} min`;
  $("detallePrecio").textContent = rango ? rangoTexto(rango) : pesos(o.costo);
  $("detallePrecioNota").textContent = rango ? "Estimado" : "Cuesta";
  $("detalleHora").textContent = hora(llegada(o));
  $("detalleCo2").hidden = !sinAuto(o);
  if (sinAuto(o)) {
    const g = co2Auto(estado.r.directo.km);
    $("co2Auto").textContent = `${kgTexto(g)} de CO₂`;
    $("co2Explica").textContent = o.tipo === "caminar"
      ? "es lo que echaría un auto en este viaje. Caminando no echas nada."
      : "es lo que echaría un auto en este viaje. El camión pasa de todos modos, así que tú casi no sumas.";
    $("co2Arbol").textContent = `Un árbol joven tarda ${tiempoArbol(g)} en limpiar eso del aire.`;
  }

  $("pasos").innerHTML = pasosDe(o).map((p, i) => `<li class="${p.camion ? "camion" : ""}">
    ${miniFicha(p.ficha[0], picto(p.ficha[1]))}
    <span class="fila-texto"><strong>${escapar(p.titulo)}</strong><small>${escapar(cruce(p.nota))}</small></span>
    <span class="hora">${hora(p.hora)}</span></li>`).join("");
  if (!sinMapa) dibujar(o);
  avisarAcceso(o);
}

// Con silla de ruedas o andadera, avisa si alguien reporto que la parada de subida o bajada no tiene rampa,
// tiene la banqueta rota o un obstaculo.
const DIFICIL = ["sin_rampa", "banqueta", "obstaculo"];
async function avisarAcceso(o) {
  $("avisoAcceso").hidden = true;
  if (acc.movilidad !== "silla" || !o.paradas) return;
  const paradas = [o.paradas.sube, o.paradas.baja].map((i) => Grieta.qrobus.paradas[i]);
  const avisos = await Promise.all(paradas.map(([lat, lon]) => reportesCerca(lat, lon, 60)));
  if (estado.elegida !== o) return;
  const problemas = paradas.map(([, , nombre], k) => {
    const tipos = [...new Set(avisos[k].filter((a) => DIFICIL.includes(a.tipo)).map((a) => NOMBRES_REPORTE[a.tipo].toLowerCase()))];
    return tipos.length ? `${cruce(nombre)}: ${tipos.join(", ")}` : null;
  }).filter(Boolean);
  if (!problemas.length) return;
  $("avisoAcceso").innerHTML = `${ico("alerta")}<span class="fila-texto"><strong>Cuidado con la accesibilidad</strong><small>${problemas.map(escapar).join(". ")}.</small></span>`;
  $("avisoAcceso").hidden = false;
  hablar(frase("acceso", { problemas: problemas.join(". ") }), true, true);
}

function pintarApps(o) {
  const r = estado.r;
  const orden = [...r.directo.porApp].sort((a, b) => a.precio - b.precio);
  pintarEstimado();
  // Una fila por app que tambien la abre, la mas barata primero.
  $("abrirApps").innerHTML = $("abrirAppsRuta").innerHTML = orden.map((x, i) => `<button type="button" class="app-fila${i ? "" : " barata"}" data-app="${x.app}"
      aria-label="Abrir ${Grieta.nombreApp(x.app)}, precio estimado ${rangoVoz(limitesPrecio(x))}${i ? "" : ", la app más económica"}">
      ${fichaApp(x.app)}<span class="fila-texto"><strong>Abrir ${Grieta.nombreApp(x.app)}</strong><small>${i ? "Precio estimado" : "Menor precio en app"}</small></span>
      <span class="precio precio-rango">${partesRango(limitesPrecio(x))}</span>${ico("chevron", "chevron")}</button>`).join("");
  $("appAviso").textContent = $("rutaAppAviso").textContent = "";
}

$("empezar").addEventListener("click", () => iniciarGuia(estado.elegida));

// Recorrido animado: la cámara sigue tu viaje en un mapa inclinado. MapLibre solo se descarga al pedirlo.
const MAPLIBRE = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl";
const COLOR_TRAMO = { pie: "#ffffff", camion: "#e0a03c", app: "#6a7ae0" };
let cargaMaplibre = null;
const rc = { mapa: null, marca: null, cuadro: 0 };
function cargarMaplibre() {
  return cargaMaplibre ??= new Promise((listo, fallo) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = `${MAPLIBRE}.min.css`;
    const js = document.createElement("script");
    js.src = `${MAPLIBRE}.min.js`;
    js.onload = () => listo(window.maplibregl);
    js.onerror = () => { cargaMaplibre = null; fallo(new Error("maplibre")); };
    document.head.append(css, js);
  });
}
function tramosRecorrido() {
  const tramos = [];
  capas.camion?.eachLayer((l) => {
    if (!(l instanceof L.Polyline)) return;
    const pts = l.getLatLngs().map((p) => [p.lng, p.lat]);
    if (pts.length > 1) tramos.push({ pts, tipo: l.options.camion ? "camion" : l.options.app ? "app" : "pie" });
  });
  let k = 0;
  const lineas = estado.elegida.pasos.filter((p) => p.tipo === "camion").map((p) => p.linea);
  for (const t of tramos) {
    t.etapa = t.tipo === "camion" ? `En la ${lineas[k++] ?? ""}` : t.tipo === "app" ? "En auto" : "Caminas";
    t.acum = [0];
    for (let i = 1; i < t.pts.length; i++) t.acum.push(t.acum[i - 1] + Grieta.metros(t.pts[i - 1][1], t.pts[i - 1][0], t.pts[i][1], t.pts[i][0]));
    t.largo = t.acum.at(-1);
  }
  return tramos.filter((t) => t.largo > 5);
}
const puntoEn = (t, d) => {
  let i = 1;
  while (i < t.acum.length - 1 && t.acum[i] < d) i++;
  const f = (d - t.acum[i - 1]) / ((t.acum[i] - t.acum[i - 1]) || 1), [a, b] = [t.pts[i - 1], t.pts[i]];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i };
};
const rumboDe = (a, b) => { const r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r); return (Math.atan2(y, x) / r + 360) % 360; };
const lineaGeo = (coordinates, tipo) => ({ type: "Feature", properties: { color: COLOR_TRAMO[tipo] }, geometry: { type: "LineString", coordinates } });
function cerrarRecorrido() {
  cancelAnimationFrame(rc.cuadro);
  rc.mapa?.remove(); rc.mapa = null; rc.marca = null;
  if ($("recorridoHoja").open) $("recorridoHoja").close();
}
function animarRecorrido(tramos, limites) {
  const m = rc.mapa, hecho = m.getSource("hecho");
  const encuadre = { padding: { top: 70, bottom: 130, left: 40, right: 40 }, pitch: 50, bearing: 0 };
  const terminar = () => {
    hecho.setData({ type: "FeatureCollection", features: tramos.map((t) => lineaGeo(t.pts, t.tipo)) });
    rc.marca.setLngLat(tramos.at(-1).pts.at(-1));
    $("recorridoEtapa").textContent = "Tu viaje completo";
    $("recorridoRepetir").hidden = false;
    m.fitBounds(limites, { ...encuadre, duration: suave() ? 1800 : 0 });
  };
  $("recorridoRepetir").hidden = true;
  // Con movimiento reducido la cámara se queda quieta, pero el recorrido sí se dibuja: la persona lo pidió.
  const quieto = !suave();
  const total = tramos.reduce((s, t) => s + t.largo, 0), segundos = Math.max(14, Math.min(26, total / 1000 * 1.4));
  for (const t of tramos) t.ms = (2200 + (t.largo / total) * segundos * 1000);
  let i = 0, inicio = null, rumbo = null, zoom = 15, etapa = "", cuadro = 0;
  const hechos = [];
  const paso = (ahora) => {
    inicio ??= ahora;
    const t = tramos[i], avance = Math.min(1, (ahora - inicio) / t.ms), d = t.largo * (avance * avance * (3 - 2 * avance));
    const { p, i: k } = puntoEn(t, d);
    const adelante = puntoEn(t, Math.min(t.largo, d + (t.tipo === "pie" ? 45 : 220))).p;
    const meta = rumboDe(p, adelante);
    if (Number.isFinite(meta) && (p[0] !== adelante[0] || p[1] !== adelante[1])) rumbo = rumbo === null ? meta : (rumbo + (((meta - rumbo + 540) % 360) - 180) * 0.06 + 360) % 360;
    zoom += ((t.tipo === "pie" ? 16.6 : 14.7) - zoom) * 0.05;
    if (!quieto) m.jumpTo({ center: p, bearing: rumbo ?? 0, pitch: 62, zoom });
    rc.marca.setLngLat(p);
    if (etapa !== t.etapa) { etapa = t.etapa; $("recorridoEtapa").textContent = etapa; rc.marca.getElement().querySelector("use").setAttribute("href", `#p-${t.tipo === "pie" ? "caminar" : t.tipo === "app" ? "carro" : "qrobus"}`); }
    if (!(cuadro++ % 3)) hecho.setData({ type: "FeatureCollection", features: [...hechos, lineaGeo([...t.pts.slice(0, k), p], t.tipo)] });
    if (avance >= 1) { hechos.push(lineaGeo(t.pts, t.tipo)); i++; inicio = null; if (i >= tramos.length) return terminar(); }
    rc.cuadro = requestAnimationFrame(paso);
  };
  m.fitBounds(limites, { ...encuadre, duration: 0 });
  if (quieto) { rc.cuadro = requestAnimationFrame(paso); return; }
  setTimeout(() => {
    if (rc.mapa !== m) return;
    m.flyTo({ center: tramos[0].pts[0], zoom: 15, pitch: 62, duration: 1600 });
    m.once("moveend", () => { if (rc.mapa === m) rc.cuadro = requestAnimationFrame(paso); });
  }, 900);
}
async function abrirRecorrido() {
  const tramos = tramosRecorrido();
  if (!tramos.length) return;
  const hoja = $("recorridoHoja");
  $("recorridoEtapa").textContent = "Cargando recorrido";
  $("recorridoRepetir").hidden = true;
  hoja.showModal();
  try {
    const lib = await cargarMaplibre();
    if (!hoja.open) return;
    const oscuro = !document.documentElement.classList.contains("claro");
    hoja.classList.toggle("oscuro", oscuro);
    const limites = tramos.flatMap((t) => t.pts).reduce((b, p) => b.extend(p), new lib.LngLatBounds(tramos[0].pts[0], tramos[0].pts[0]));
    const m = rc.mapa = new lib.Map({ container: "recorridoMapa", style: `https://tiles.openfreemap.org/styles/${oscuro ? "dark" : "liberty"}`, bounds: limites, fitBoundsOptions: { padding: 60 }, pitch: 50, maxPitch: 70, interactive: false, attributionControl: false });
    m.on("load", () => {
      if (rc.mapa !== m) return;
      m.addSource("todo", { type: "geojson", data: { type: "FeatureCollection", features: tramos.map((t) => lineaGeo(t.pts, t.tipo)) } });
      m.addSource("hecho", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      const trazo = { "line-cap": "round", "line-join": "round" };
      m.addLayer({ id: "todo", type: "line", source: "todo", layout: trazo, paint: { "line-color": oscuro ? "#ffffff" : "#16181d", "line-width": 5, "line-opacity": 0.32 } });
      m.addLayer({ id: "borde", type: "line", source: "hecho", layout: trazo, paint: { "line-color": "#16181d", "line-width": 10 } });
      m.addLayer({ id: "hecho", type: "line", source: "hecho", layout: trazo, paint: { "line-color": ["get", "color"], "line-width": 6 } });
      const el = document.createElement("span");
      el.className = "rc-punto";
      el.innerHTML = picto("qrobus");
      rc.marca = new lib.Marker({ element: el }).setLngLat(tramos[0].pts[0]).addTo(m);
      $("recorridoRepetir").onclick = () => { cancelAnimationFrame(rc.cuadro); m.getSource("hecho").setData({ type: "FeatureCollection", features: [] }); animarRecorrido(tramos, limites); };
      animarRecorrido(tramos, limites);
    });
  } catch {
    $("recorridoEtapa").textContent = "No pude cargar el recorrido. Revisa tu internet.";
  }
}
$("verRecorrido").addEventListener("click", abrirRecorrido);
$("recorridoCerrar").addEventListener("click", cerrarRecorrido);
$("recorridoHoja").addEventListener("close", cerrarRecorrido);
// Cada paso dicho como dos oraciones, con su punto, para que la voz haga la pausa.
const conPunto = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
const pasosEnVoz = (o) => pasosDe(o).map((p) => `${conPunto(p.titulo)} ${conPunto(p.nota)}`).join(" ");

// Botones de una sola eleccion: la app que te dio precio y que tanta prisa tienes.
function segmentado(id, alElegir) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of $(id).children) x.setAttribute("aria-pressed", String(x === b));
    alElegir(b.dataset.v);
    calcular();
  });
}
// Lo que Grieta estima para la app elegida, junto al campo, para comparar sin buscarlo.
function pintarEstimado() {
  const x = estado.r?.directo.porApp.find((a) => a.app === estado.app);
}
segmentado("appVista", (v) => { estado.app = v; pintarEstimado(); if (!$("precio").value) $("precio").focus(); });
segmentado("prisa", (v) => { estado.prisa = Number(v); verVeredicto(); });
$("precio").addEventListener("input", calcular);
// La recomendacion sale abajo del campo y con el teclado abierto queda tapada: al terminar de escribir se trae a la vista
function verVeredicto() {
  if (Number($("precio").value) > 0 && estado.app) setTimeout(() => $("veredicto").scrollIntoView({ block: "nearest", behavior: "smooth" }), 80);
}
$("precio").addEventListener("change", verVeredicto);
$("precio").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

function pintarVeredicto(r) {
  const d = r.decision;
  $("compartirPrecio").hidden = !d || !API;
  $("gracias").textContent = "";
  if (!d) {
    $("veredicto").innerHTML = estado.app || Number($("precio").value) > 0 ? `<p class="nota">Elige la app y escribe el precio para darte una recomendación.</p>` : "";
    return;
  }
  const visto = d.esperado.precio * d.relacion;
  const sigFranja = Grieta.CORTES.find((c) => c * 60 > r.ctx.minuto);
  const porque = d.accion === "esperar"
    ? ` Está arriba de lo normal y te sobra tiempo: vuelve a revisar en unos minutos${sigFranja < 24 ? `; lo normal cambia de franja a las ${hora(sigFranja * 60)}` : ""}.`
    : "";
  // Se compara contra el modelo; no se conoce la demanda real de cada app.
  const otra = r.directo.porApp.filter((x) => x.app !== d.esperado.app).sort((x, y) => x.precio - y.precio)[0];
  const alta = d.relacion >= 1.4
    ? ` <strong>Revisa otra app antes de pedir.</strong>${otra && otra.precio < visto * 0.85 ? ` ${Grieta.nombreApp(otra.app)} se estima en ${rangoTexto(limitesPrecio(otra))}.` : ""}`
    : "";
  const candidatas = (estado.tarjetas ?? []).map(({ o }, i) => ({ o, i })).filter(({ o }) => o.costo <= visto * 0.7);
  const camion = d.accion === "camion" ? candidatas.sort((a, b) => a.o.minutos - b.o.minutos || a.o.costo - b.o.costo)[0] : null;
  const extra = camion ? camion.o.minutos - (r.opciones.find((o) => o.tipo === "app")?.minutos ?? r.directo.minutos) : d.extra;
  // Semaforo de precio justo: lo que marca la app contra lo normal a esta hora segun el modelo.
  const sobre = Math.round(visto - d.esperado.precio);
  const semaforo = d.relacion <= 1.1 ? ["justo", "Precio justo"] : d.relacion < 1.4 ? ["caro", `Un poco caro: ${pesos(sobre)} más de lo normal`] : ["muy-caro", `Muy caro: ${pesos(sobre)} más de lo normal`];
  $("veredicto").innerHTML = `
    <p class="semaforo ${semaforo[0]}">${semaforo[1]}</p>
    <div class="recomendacion">
      <p class="etiqueta">Recomendación</p>
      <p class="veredicto">${ico(SIMBOLOS[d.accion], "simbolo")}${ACCIONES[d.accion]}</p>
      <p>${Grieta.nombreApp(d.esperado.app)} te marca ${pesos(visto)}. Nuestro rango estimado es ${rangoTexto(limitesPrecio(d.esperado))}.${alta}${porque}
        ${d.accion === "camion" && extra < 1e8 ? `El camión tarda ${Math.round(extra)} min más, pero te ahorras la diferencia.` : ""}</p>
      ${camion ? `<button type="button" class="boton ver-camion" data-i="${camion.i}">${ico("camion")}Ver cómo ir en ${escapar(tituloOpcion(camion.o))}</button>` : ""}
      <p class="reglas">${d.activas.some((a) => a.accion === d.accion)
        ? `Porque ${escapar(d.activas.find((a) => a.accion === d.accion).texto)}.`
        : "El precio no está tan arriba o el camión tarda demasiado."}</p>
    </div>`;
}
$("veredicto").addEventListener("click", (e) => {
  const b = e.target.closest(".ver-camion");
  if (b) abrirOpcion(b.dataset.i);
});

const enlaceUber = () => {
  const { origen: o, destino: d } = estado;
  const q = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": o.lat, "pickup[longitude]": o.lon, "pickup[nickname]": o.nombre,
    "dropoff[latitude]": d.lat, "dropoff[longitude]": d.lon, "dropoff[nickname]": d.nombre,
  });
  return `https://m.uber.com/ul/?${q}`;
};

// Uber abre con el viaje ya puesto. DiDi e inDrive no publican un enlace asi: se copia el destino y se abre su app.
const TIENDAS = {
  didi: { ios: "https://apps.apple.com/app/id1362398401", android: "com.didiglobal.passenger" },
  indrive: { ios: "https://apps.apple.com/app/id780125801", android: "sinet.startup.inDriver" },
};
async function abrirApp(e) {
  const b = e.target.closest("[data-app]");
  if (!b) return;
  const app = b.dataset.app;
  if (app === "uber") return void open(enlaceUber(), "_blank", "noopener");
  const destino = estado.destino.nombre;
  let copiado = true;
  try { await navigator.clipboard.writeText(destino); } catch { copiado = false; }
  // DiDi e inDrive se abren desde su pagina en la tienda: ahi aparece el boton Abrir si ya estan instaladas.
  const aviso = (copiado ? `Copié "${destino}". ` : "") + `Te llevo a ${Grieta.nombreApp(app)}: en la tienda toca Abrir y ` +
    (copiado ? "pega el destino." : `escribe como destino ${destino}.`);
  for (const id of ["appAviso", "rutaAppAviso", "avisoRapido"]) $(id).textContent = aviso;
  hablar(aviso, false, true);
  const t = TIENDAS[app];
  // En Android se abre la app si esta instalada y si no, su pagina en Play; en iPhone, su pagina en la App Store tiene el boton Abrir.
  const destinoApp = /android/i.test(navigator.userAgent)
    ? `intent://#Intent;package=${t.android};S.browser_fallback_url=${encodeURIComponent(`https://play.google.com/store/apps/details?id=${t.android}`)};end`
    : t.ios;
  setTimeout(() => { location.href = destinoApp; }, 1500);
}
$("abrirApps").addEventListener("click", abrirApp);
$("abrirAppsRuta").addEventListener("click", abrirApp);
$("rutaComparar").addEventListener("click", () => $("compararPrecio").click());
$("appsRapido").addEventListener("click", abrirApp);

function quitarTrazo() {
  capas.camion?.remove();
  capas.camion = null;
  capas.linea?.setStyle?.({ opacity: 0.95, color: tono("--ambar") });
}

// Camino con camion en el mapa: caminata punteada, app en linea delgada y el camion por sus paradas.
function dibujar(o) {
  quitarTrazo();
  const tinta = tono("--tinta");
  const ambar = tono("--ambar");
  // En app el tramo va en azul, el color de las apps, y por calles como el auto lo haria.
  const estilo = (modo) => (modo === "caminando" ? { color: tinta, weight: 3, dashArray: "1 7", lineCap: "round" } : { color: azulRutaApp(), weight: 4, opacity: 0.9, app: true });
  capas.linea?.setStyle?.({ opacity: 0.15 });
  const camiones = o.trazo.camiones;
  const lineas = o.pasos.filter((p) => p.tipo === "camion").map((p) => p.linea);
  const capasCamion = camiones.flatMap((c, k) => [
    L.polyline(c, { color: ambar, weight: 5, tono: "linea", camion: true }),
    ...(k > 0 ? [L.polyline([camiones[k - 1].at(-1), c[0]], estilo("caminando"))] : []),
    // Un punto chico por cada parada del camino, para ver cuantas faltan.
    ...c.slice(1, -1).map((x) => L.circleMarker(x, { radius: 2.5, color: ambar, weight: 1, fillColor: tono("--fondo"), fillOpacity: 1, tono: "linea" })),
    // Donde subes y donde bajas: ficha con camion (verde) o bandera (roja), distintas de las paradas de paso.
    // En un transbordo la bajada del primer camion coincide con la subida al siguiente: solo se marca la subida.
    ...[c[0], c.at(-1)].filter((_, j) => !j || k === camiones.length - 1).map((x, j) => L.marker(x, { interactive: false, keyboard: false, zIndexOffset: 500,
      icon: L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17], html: `<span class="parada-ruta ${j ? "baja" : "sube"}"><svg class="picto"><use href="#p-${j ? "flag" : "qrobus"}"/></svg></span>` }) })
      .bindTooltip(j ? `Bajas aquí` : `Subes a la ${lineas[k] ?? ""}`, { permanent: true, direction: j ? "right" : "top", offset: j ? [18, 0] : [0, -18], className: `etiqueta-mapa ${j ? "baja" : "sube"}` })),
  ]);
  const acceso = L.polyline(o.trazo.acceso.puntos, estilo(o.trazo.acceso.modo));
  const salida = L.polyline(o.trazo.salida.puntos, estilo(o.trazo.salida.modo));
  capas.camion = L.featureGroup([acceso, ...capasCamion, salida]).addTo(mapa);
  // Todo tramo a pie (punteado), incluido el de un transbordo, sigue las calles.
  capas.camion.eachLayer((l) => { if (l.options.dashArray) seguirCalles(l); else if (l.options.camion) porCallesCamion(l); else if (l.options.app) porCallesAuto(l); });
  animarTrazo(capas.camion);
  setTimeout(() => encuadrar(capas.camion.getBounds()), 120);
}

// Al cambiar de tema, lo que ya esta dibujado toma los colores nuevos.
function recolorear() {
  if (typeof mapa === "undefined") return;
  const ambar = tono("--ambar");
  capas.linea?.setStyle?.({ color: ambar });
  capas.camion?.eachLayer((c) => c.setStyle?.(c.options.tono === "linea" ? { color: ambar } : c.options.tono === "punto" ? { fillColor: ambar } : { color: tono("--tinta") }));
}

// Paradas en lo que se ve del mapa: se piden al mover o acercar, solo de cerca y con tope, para no cargar la ciudad entera.
const MAX_PARADAS_VISTA = 60;
function pintarParadasEnVista() {
  const pantalla = document.body.dataset.pantalla;
  if (pantalla !== "camiones" && pantalla !== "ubicacion") return;
  capas.vista?.remove();
  capas.vista = null;
  if (mapa.getZoom() < 15 || !Grieta.qrobus) return;
  const area = mapa.getBounds().pad(0.1);
  const centro = mapa.getCenter();
  const yaPintadas = new Set(pantalla === "camiones" ? (estado.listaCamiones ?? []).map((x) => x.i) : []);
  const visibles = [];
  Grieta.qrobus.paradas.forEach(([lat, lon, nombre], i) => {
    if (!yaPintadas.has(i) && area.contains([lat, lon])) visibles.push({ i, nombre, lat, lon, m: Grieta.metros(centro.lat, centro.lng, lat, lon) });
  });
  visibles.sort((a, b) => a.m - b.m);
  // De lejos las paradas son puntos: que no tapen los camiones ni las calles.
  const lejos = mapa.getZoom() < 16;
  capas.vista = L.layerGroup(visibles.slice(0, MAX_PARADAS_VISTA).map((x) => {
    const m = L.marker([x.lat, x.lon], { icon: lejos ? iconoPuntoParada : Grieta.tieneRecorridos(x.i) ? iconoParada(false) : iconoParadaSinHorario, keyboard: false });
    if (pantalla === "camiones" && estado.puntoCamiones) m.on("click", () => elegirParadaDelMapa(x));
    else if (estado.gps) m.on("click", () => abrirParadaDesdeAqui(x));
    return m;
  })).addTo(mapa);
}
// Camiones estimados por horario en Camiones cerca: se mueven solos y nunca se presentan como ubicación real.
const MAX_ESTIMADOS = 14;
const estimados = new Map();
let relojEstimados = null, vistaEstimados = false;
const minutoExacto = () => { const a = new Date(); return a.getHours() * 60 + a.getMinutes() + a.getSeconds() / 60; };
const iconoEstimado = (linea) => L.divIcon({ className: "camion-est", iconSize: [56, 26], iconAnchor: [28, 13], html: `<span class="ce-ficha">${picto("qrobus")}<b translate="no">${escapar(linea)}</b></span>` });
function limpiarEstimados() {
  for (const m of estimados.values()) m.remove();
  estimados.clear();
  $("camionesHorario").hidden = true;
  $("verEstimados").hidden = document.body.dataset.pantalla !== "camiones" || acc.modoVoz;
}
function pintarEstimados() {
  if (document.body.dataset.pantalla !== "camiones" || acc.modoVoz || !Grieta.qrobus || mapa.getZoom() < 13) return limpiarEstimados();
  const area = mapa.getBounds().pad(0.05), c = mapa.getCenter();
  const candidatos = Grieta.camionesEstimados(hoyDia(), minutoExacto()).filter((x) => area.contains([x.lat, x.lon]))
    .sort((a, b) => Number(estimados.has(b.id)) - Number(estimados.has(a.id)) || Grieta.metros(c.lat, c.lng, a.lat, a.lon) - Grieta.metros(c.lat, c.lng, b.lat, b.lon));
  const visibles = [], lineasVistas = new Set(), puntos = [];
  // Uno por línea y separados en pantalla: que se lean, no que tapen el mapa.
  for (const x of candidatos) {
    const clave = `${x.linea}|${x.hacia}`, p = mapa.latLngToContainerPoint([x.lat, x.lon]);
    if (lineasVistas.has(clave) || puntos.some((q) => q.distanceTo(p) < 62)) continue;
    lineasVistas.add(clave); puntos.push(p); visibles.push(x);
    if (visibles.length === MAX_ESTIMADOS) break;
  }
  const vivos = new Set(visibles.map((x) => x.id));
  for (const [id, m] of estimados) if (!vivos.has(id)) { m.remove(); estimados.delete(id); }
  for (const x of visibles) {
    const m = estimados.get(x.id);
    if (m) m.setLatLng([x.lat, x.lon]);
    else estimados.set(x.id, L.marker([x.lat, x.lon], { icon: iconoEstimado(x.linea), keyboard: false, zIndexOffset: 300 }).bindTooltip(`${x.linea} hacia ${x.hacia}, estimado`, { direction: "top", className: "etiqueta-mapa" }).addTo(mapa));
  }
  // Botón o nota, nunca los dos: ocupan el mismo lugar para que la hoja no brinque.
  const lejos = visibles.length > 0 && mapa.getZoom() <= 15.5;
  $("verEstimados").hidden = lejos;
  $("camionesHorario").hidden = !lejos;
}
function detenerEstimados() { clearInterval(relojEstimados); relojEstimados = null; limpiarEstimados(); }
function iniciarEstimados() { vistaEstimados = false; detenerEstimados(); pintarEstimados(); relojEstimados = setInterval(pintarEstimados, suave() ? 2000 : 8000); }
mapa.on("moveend", () => { if (relojEstimados) pintarEstimados(); });
$("verEstimados").addEventListener("click", () => (vistaEstimados = true, suave() ? mapa.flyTo(mapa.getCenter(), 14.5, { duration: 0.8 }) : mapa.setView(mapa.getCenter(), 14.5)));
let esperaVista;
mapa.on("moveend", () => { clearTimeout(esperaVista); esperaVista = setTimeout(pintarParadasEnVista, 250); });
// Desde Dónde estoy, tocar una parada abre sus camiones con el camino a pie ya trazado.
function abrirParadaDesdeAqui(x) {
  const punto = estado.gps;
  revisionCamiones++;
  estado.recomendacionAnunciada = null;
  encuadreParadas = null;
  ir("camiones");
  $("camionesUbicacion").textContent = "";
  const p = { ...x, m: Grieta.metros(punto.lat, punto.lon, x.lat, x.lon), lineas: Grieta.horariosParadaPorIndice(x.i, hoyDia(), ahoraMin()) };
  pintarCamiones(punto, [p], false, true);
}
// Una parada tocada en el mapa pasa a ser la elegida, con su camino a pie y sus camiones.
function elegirParadaDelMapa(x) {
  const punto = estado.puntoCamiones;
  const p = { ...x, m: Grieta.metros(punto.lat, punto.lon, x.lat, x.lon), lineas: Grieta.horariosParadaPorIndice(x.i, hoyDia(), ahoraMin()) };
  revisionCamiones++;
  pintarCamiones(punto, [p, ...(estado.listaCamiones ?? []).filter((o) => o.i !== x.i)], false, true);
  $("hoja").scrollTop = 0;
}

// Las paradas usan la misma ficha que la de "Subes a la" de los viajes.
const fichaParada = (clase) => `<span class="parada-ruta ${clase}"><svg class="picto" aria-hidden="true"><use href="#p-qrobus"/></svg></span>`;
const iconoPuntoParada = L.divIcon({ className: "punto-parada", iconSize: [12, 12] });
const iconoParadaSinHorario = L.divIcon({ className: "", iconSize: [26, 26], html: fichaParada("chica sin-horario") });
const iconoParada = (cerca) => L.divIcon({ className: "", iconSize: cerca ? [34, 34] : [26, 26], html: fichaParada(cerca ? "sube" : "sube chica") });
// Las paradas en el mapa: tu ubicacion, la mas cercana resaltada con el camino a pie y las demas; tocar una baja a sus camiones.
let encuadreParadas = null;
function pintarParadas(punto, lista, seleccionada = false) {
  capas.paradas?.remove();
  const marcas = lista.map((x, i) => {
    const m = L.marker([x.lat, x.lon], { icon: iconoParada(i === 0), keyboard: false, zIndexOffset: i === 0 ? 500 : 0 });
    m.on("click", () => {
      if (i === 0) return void ($("hoja").scrollTop = 0);
      elegirParada(punto, lista, i);
    });
    if (i === 0) m.bindTooltip(seleccionada ? "Elegida" : "Más cercana", { permanent: true, direction: "top", offset: [0, -20], className: "etiqueta-mapa" });
    return m;
  });
  const aPie = L.polyline([[punto.lat, punto.lon], [lista[0].lat, lista[0].lon]], { color: tono("--tinta"), weight: 3, dashArray: "1 7", lineCap: "round" });
  capas.paradas = L.featureGroup([aPie, ...marcas]).addTo(mapa);
  // Se encuadra tu camino a la parada más cercana, y solo cuando cambia, para que el mapa no brinque.
  const clave = `${punto.lat},${punto.lon},${lista[0].lat},${lista[0].lon}`;
  if (clave !== encuadreParadas) {
    encuadreParadas = clave;
    setTimeout(() => encuadrar(L.latLngBounds([[punto.lat, punto.lon], [lista[0].lat, lista[0].lon]])), 120);
  }
  const revision = revisionCamiones;
  seguirCalles(aPie).then(async (c) => {
    const vigente = () => revision === revisionCamiones && document.body.dataset.pantalla === 'camiones' && estado.listaCamiones?.[0] === lista[0];
    await Promise.race([c?.listo, new Promise((r) => setTimeout(r, 1500))]);
    if (vigente()) ponerCaminata(lista[0], c?.metros, seleccionada, c);
    // Si la pendiente llego tarde, solo se corrige el texto: la voz ya lo dijo.
    c?.listo?.then(() => { if (vigente()) ponerCaminata(lista[0], c.metros, seleccionada, c); });
  });
}
// La distancia real a pie llega despues que la pantalla: se pone y se dice una sola vez
function ponerCaminata(p, metros, seleccionada = false, rel = p.relieve) {
  if (!$("distanciaParada")) return;
  if (!metros) {
    if (p.caminado) return;
    $("caminaParada").textContent = "No pude calcular el camino a pie.";
    $("caminaDetalle").textContent = `A ${distanciaTexto(p.m, true)} en línea recta`;
    return;
  }
  p.caminado = metros;
  p.relieve = rel;
  const [texto, detalle] = textoCaminata(metros, rel);
  $("caminaParada").textContent = texto;
  $("caminaDetalle").textContent = detalle;
  actualizarComparacionParadas(estado.listaCamiones ?? []);
  if (!p.dicho) hablar(`Caminando son ${distanciaTexto(metros)}, unos ${minutosCaminando(metros * (rel?.factor ?? 1))} minutos${pendienteTexto(rel) ? `, ${enVoz(pendienteTexto(rel))}` : ""}.`, true);
  p.dicho = true;
}
// A quien le cuesta caminar no se le promete un tiempo, igual que en las opciones de viaje
function textoCaminata(metros, rel) {
  const cuesta = pendienteTexto(rel);
  return (acc.movilidad ?? "normal") === "normal"
    ? [`Caminando llegas en ${minutosCaminando(metros * (rel?.factor ?? 1))} min`, `${distanciaTexto(metros, true)} por calles${cuesta ? `, ${cuesta}` : ", sin costo"}`]
    : [`Queda a ${distanciaTexto(metros)} por calles`, cuesta ? `Camino ${cuesta}` : "Si te sientes bien para ir a pie, no cuesta nada"];
}
// 250 metros, 1.2 kilómetros: redondeado como lo diría una persona
const distanciaTexto = (m, corta = false) => m < 1000
  ? `${Math.max(10, Math.round(m / 10) * 10)} ${corta ? "m" : "metros"}`
  : `${(m / 1000).toFixed(1).replace(".0", "")} ${corta ? "km" : "kilómetros"}`;
const minutosCaminando = (m) => Math.max(1, Math.round(m / 1000 / 4.5 * 60));
const enCuanto = (min) => { const f = Math.round(min - ahoraMin()); return f <= 0 ? "ya debe pasar" : f < 60 ? `en ${f} min` : `en ${Math.floor(f / 60)} h ${f % 60} min`; };
let revisionCamiones = 0;
$("qroAlDia").addEventListener("click", () => location.assign("observatorio.html"));
function abrirCamiones() {
  const revision = ++revisionCamiones;
  estado.recomendacionAnunciada = null;
  encuadreParadas = null;
  ir("camiones");
  const caja = $("camionesContenido");
  caja.innerHTML = `<p class="texto">Actualizando tu ubicación…</p>`;
  $("camionesUbicacion").textContent = "";
  ubicar(encontrada => {
    if (revision !== revisionCamiones || document.body.dataset.pantalla !== 'camiones') return;
    const punto = encontrada ? estado.gps : estado.origen && !esGps(estado.origen) ? estado.origen : null;
    if (punto) {
      // Solo se avisa cuando no salió de tu ubicación; si salió bien no hace falta decirlo
      $("camionesUbicacion").textContent = encontrada ? "" : `Paradas desde el punto elegido: ${punto.nombre}. No pude actualizar tu ubicación.`;
      return cargarCamiones(punto);
    }
    caja.innerHTML = `<p class="texto">No pude actualizar tu ubicación. Actívala o elige desde dónde sales.</p>
      <button id="elegirUbicacionCamiones" type="button" class="boton oscuro">Elegir desde dónde sales</button>`;
    $("elegirUbicacionCamiones").addEventListener("click", () => abrirBuscar("desde"));
    hablar("No pude actualizar tu ubicación. Puedes elegir desde dónde sales.");
  }, true);
}
// Al volver a la app con esta pestaña abierta, la ubicación se actualiza sola
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.body.dataset.pantalla === "camiones") abrirCamiones();
});
function cargarCamiones(punto, anunciar = true) {
  const caja = $("camionesContenido");
  // Se sugieren solo paradas con camiones registrados; las oficiales sin horario se ven en el mapa.
  const lista = Grieta.paradasCercanas(punto.lat, punto.lon, 1000, 12).filter((p) => Grieta.tieneRecorridos(p.i)).slice(0, 3).map(p => ({ ...p, lineas: Grieta.horariosParadaPorIndice(p.i, hoyDia(), ahoraMin()) }));
  if (!lista.length) {
    caja.innerHTML = `<p class="texto">No encontré paradas en el catálogo a menos de un kilómetro. Puede haber otras paradas que todavía no aparecen aquí.</p>`;
    return hablar("No encontré paradas en el catálogo a menos de un kilómetro. Puede haber otras paradas que todavía no aparecen aquí.");
  }
  pintarCamiones(punto, lista, anunciar);
  ordenarPorCaminata(punto, lista);
}

function elegirParada(punto, lista, indice) {
  revisionCamiones++;
  const orden = [lista[indice], ...lista.filter((_, i) => i !== indice)];
  pintarCamiones(punto, orden, false, true);
  $("hoja").scrollTop = 0;
}

function compararParadas(lista) {
  const minuto = ahoraMin();
  const faltantes = [];
  const opciones = lista.map((parada, indice) => {
    if (!Number.isFinite(parada.caminado)) {
      faltantes.push(`${cruce(parada.nombre)}: camino a pie`);
      return null;
    }
    const caminata = minutosCaminando(parada.caminado);
    const llegada = minuto + caminata;
    const lineas = Number.isSafeInteger(parada.i) ? Grieta.horariosParadaPorIndice(parada.i, hoyDia(), llegada) : Grieta.horariosParada(parada.lat, parada.lon, hoyDia(), llegada);
    const salidas = lineas.flatMap((linea) => linea.horas).filter((hora) => Number.isFinite(hora));
    if (!salidas.length) {
      faltantes.push(`${cruce(parada.nombre)}: próximo horario`);
      return null;
    }
    const salida = Math.min(...salidas);
    const espera = Math.max(0, Math.ceil(salida - llegada));
    return { parada, indice, caminata, espera, total: caminata + espera, salida };
  }).filter(Boolean).sort((a, b) => a.total - b.total || a.caminata - b.caminata || a.parada.m - b.parada.m);
  return { opciones, faltantes };
}

function actualizarComparacionParadas(lista) {
  const caja = $("comparacionParadas");
  if (!caja) return;
  const { opciones, faltantes } = compararParadas(lista);
  if (!opciones.length) {
    caja.innerHTML = `<p class="nota">Todavía no puedo comparar estas paradas:</p><ul>${faltantes.map((x) => `<li>${escapar(x)}</li>`).join("")}</ul>`;
    return;
  }
  const empate = opciones.length > 1 && opciones[0].total === opciones[1].total;
  caja.innerHTML = `<h2 id="tituloComparacionParadas">¿Qué parada me conviene?</h2>
    <ul class="comparacion-lista">${opciones.map((opcion, i) => `<li><button type="button" class="comparacion-parada${i === 0 ? " recomendada" : ""}" data-comparar-parada="${opcion.indice}" aria-label="${i === 0 ? "Menor tiempo estimado. " : ""}${escapar(cruce(opcion.parada.nombre))}: caminar ${opcion.caminata} minutos, esperar ${opcion.espera} minutos, total ${opcion.total} minutos. Elegir esta parada.">
      <span class="comparar-cabeza"><strong translate="no">${escapar(cruce(opcion.parada.nombre))}</strong>${i === 0 ? `<em class="etiqueta">Conviene más</em>` : ""}</span>
      <span class="comparar-datos" aria-hidden="true"><span class="chip-dato">${ico("caminar")}${opcion.caminata} min</span><span class="chip-dato">${ico("reloj")}${opcion.espera} min</span>${lineasDeParada(opcion.parada)}</span>
      <b class="comparar-total">${opcion.total} min para abordar</b></button></li>`).join("")}</ul>
    ${faltantes.length ? `<p class="nota">Sin comparar: ${faltantes.map(escapar).join("; ")}.</p>` : ""}`;
  caja.querySelectorAll("[data-comparar-parada]").forEach((b) => b.addEventListener("click", () => {
    const opcion = opciones.find((x) => x.indice === Number(b.dataset.compararParada));
    if (opcion) elegirParada(estado.puntoCamiones, lista, opcion.indice);
  }));
  if (acc.modoVoz && estado.recomendacionAnunciada !== opciones[0].parada.nombre) {
    estado.recomendacionAnunciada = opciones[0].parada.nombre;
    hablar(`La parada con menos tiempo estimado es ${opciones[0].parada.nombre}: caminar ${opciones[0].caminata} minutos y esperar ${opciones[0].espera}, ${opciones[0].total} minutos en total.`, true);
  }
}

// Las lineas de una parada con su sentido, para distinguir dos paradas del mismo nombre en lados opuestos.
function lineasDeParada(parada) {
  const lineas = Number.isSafeInteger(parada.i) ? Grieta.horariosParadaPorIndice(parada.i, hoyDia(), ahoraMin()) : [];
  return lineas.slice(0, 2).map((l) => `<span class="chip-dato chip-linea"><b>${escapar(l.linea)}</b><span>Hacia ${escapar(l.hacia)}</span></span>`).join("");
}

// Mapa de una linea con sus paradas en cada sentido, como en la app de Qrobus.
const COLOR_LINEA = "#2f8a5c";
function sentidosDeLinea(linea) {
  const porDestino = new Map();
  for (const pat of Grieta.qrobus.patrones.filter((x) => x.linea === linea)) {
    const previo = porDestino.get(pat.hacia);
    if (!previo || pat.paradas.length > previo.paradas.length) porDestino.set(pat.hacia, pat);
  }
  return [...porDestino.values()];
}
function abrirLinea(linea, hacia, paradaActual) {
  const sentidos = sentidosDeLinea(linea);
  if (!sentidos.length) return;
  // Sin conocer la ciudad, "Ida" es el sentido que pasa por tu parada (o el que elegiste) y "Regreso" el otro.
  const pasaAqui = (x) => x.paradas.includes(paradaActual);
  sentidos.sort((a, b) => (pasaAqui(b) - pasaAqui(a)) || ((b.hacia === hacia) - (a.hacia === hacia)));
  estado.linea = { linea, sentidos, parada: paradaActual };
  ir("linea");
  $("tituloPantalla").textContent = linea;
  // Ida y Regreso lado a lado para que se vean los dos sin desplazar; abajo, hacia donde va el elegido.
  $("lineaSentidos").innerHTML = sentidos.map((x, i) => `<button type="button" aria-pressed="false" data-v="${escapar(x.hacia)}" aria-label="${["Ida", "Regreso"][i] ?? "Otro recorrido"}: ${rumboDeSentido(x).toLowerCase()} y termina en ${escapar(x.hacia)}${pasaAqui(x) ? ". Pasa por tu parada" : ""}"><strong>${["Ida", "Regreso"][i] ?? "Otro"}</strong>${pasaAqui(x) ? "<em>Pasa por tu parada</em>" : ""}</button>`).join("");
  pintarSentido(sentidos.some((x) => x.hacia === hacia) ? hacia : sentidos[0].hacia);
}
// Hacia donde avanza el recorrido, de su primera a su ultima parada, en palabras.
function rumboDeSentido(x) {
  const [a, b] = [x.paradas[0], x.paradas.at(-1)].map((i) => Grieta.qrobus.paradas[i]);
  const r = Math.PI / 180;
  const grados = (Math.atan2(Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r), Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r)) / r + 360) % 360;
  return `Va al ${["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"][Math.round(grados / 45) % 8]}`;
}
// La hoja tapa la parte de abajo del mapa: se encuadra solo en la franja que se ve.
function encuadrarLinea() {
  if (!capas.rutaLinea || !$("mapa").offsetHeight) return;
  const tapado = Math.max(0, $("mapa").getBoundingClientRect().bottom - $("hoja").getBoundingClientRect().top);
  mapa.fitBounds(capas.rutaLinea.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, tapado + 24] });
}
function pintarSentido(hacia) {
  const { linea, sentidos, parada } = estado.linea;
  const pat = sentidos.find((x) => x.hacia === hacia);
  for (const b of $("lineaSentidos").children) b.setAttribute("aria-pressed", String(b.dataset.v === hacia));
  $("lineaRumbo").textContent = `${rumboDeSentido(pat)} y termina en ${pat.hacia}`;
  const puntos = pat.paradas.map((i) => Grieta.qrobus.paradas[i]);
  capas.rutaLinea?.remove();
  const trazoLinea = L.polyline(puntos.map(([la, lo]) => [la, lo]), { color: COLOR_LINEA, weight: 5, opacity: 0.9 });
  capas.rutaLinea = L.featureGroup([
    trazoLinea,
    ...puntos.map(([la, lo], k) => {
      const aqui = pat.paradas[k] === parada, extremo = k === 0 || k === puntos.length - 1;
      if (!aqui && !extremo) return L.circleMarker([la, lo], { radius: 4, color: COLOR_LINEA, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false });
      return L.marker([la, lo], { interactive: false, keyboard: false, zIndexOffset: aqui ? 600 : 300,
        icon: L.divIcon({ className: "", iconSize: aqui ? [34, 34] : [26, 26], html: fichaParada(aqui ? "sube" : "sube chica") }) })
        .bindTooltip(aqui ? "Tu parada" : k ? "Última parada" : "Primera parada", { permanent: aqui, direction: "top", offset: [0, aqui ? -18 : -14], className: `etiqueta-mapa${aqui ? " sube" : ""}` });
    }),
  ]).addTo(mapa);
  setTimeout(encuadrarLinea, 80);
  porCallesCamion(trazoLinea);
  $("lineaParadas").innerHTML = puntos.map(([, , nombre], k) => `<li class="${pat.paradas[k] === parada ? "aqui" : ""}"><span class="punto-linea" aria-hidden="true"></span><span translate="no">${escapar(cruce(nombre))}</span>${pat.paradas[k] === parada ? `<em class="etiqueta">Tu parada</em>` : ""}</li>`).join("");
}
$("lineaSentidos").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) pintarSentido(b.dataset.v); });
$("camionesContenido").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ver-linea]");
  if (b) abrirLinea(b.dataset.verLinea, b.dataset.hacia, Number(b.dataset.indice));
});

// La mas cercana en linea recta puede estar del otro lado de una avenida: se comparan caminando y se reordena.
async function ordenarPorCaminata(punto, lista) {
  if (lista.length < 2) return;
  const revision = revisionCamiones;
  const reales = await Promise.all(lista.map((x) => caminoAPie([punto.lat, punto.lon], [x.lat, x.lon])));
  await Promise.race([Promise.all(reales.map((c) => c?.listo)), new Promise((r) => setTimeout(r, 1500))]);
  if (revision !== revisionCamiones || document.body.dataset.pantalla !== "camiones") return;
  lista.forEach((x, i) => { if (reales[i]) { x.caminado = reales[i].metros; x.relieve = reales[i]; } });
  // Gana la que menos cansa: una subida cuenta como caminar mas.
  const distancia = (x) => x.caminado ? x.caminado * (x.relieve?.factor ?? 1) : x.m * 1.3;
  const orden = [...lista].sort((a, b) => distancia(a) - distancia(b));
  if (orden[0] === lista[0]) {
    ponerCaminata(lista[0], lista[0].caminado, false, lista[0].relieve);
    document.querySelectorAll(".parada-alternativa[data-parada]").forEach((b) => {
      const parada = lista[Number(b.dataset.parada)];
      const texto = b.querySelector(".tenue");
      if (parada && texto) texto.textContent = `A ${distanciaTexto(parada.caminado ?? parada.m, true)}${parada.caminado ? " caminando" : " en línea recta"}`;
    });
    actualizarComparacionParadas(lista);
    return;
  }
  orden[0].dicho = true;
  pintarCamiones(punto, orden, false);
  if (document.body.dataset.pantalla === "camiones") hablar(`Entre las paradas consultadas, hay menos caminata a ${orden[0].nombre}, a ${distanciaTexto(distancia(orden[0]))}.`);
}

function pintarCamiones(punto, lista, primera, seleccionada = false) {
  const revision = revisionCamiones;
  const caja = $("camionesContenido");
  // El tlacuache dormido solo en la parada principal; en las demas basta una linea.
  const filas = (p, principal = false) => !p.lineas.length && Grieta.tieneRecorridos(p.i) && yaNoPasan() ? (principal ? "" : '<p class="nota">Ya no pasan camiones a esta hora.</p>') : !p.lineas.length ? `<p class="nota">${Grieta.tieneRecorridos(p.i) ? "No hay próximos horarios guardados para esta parada." : "Parada oficial de Qrobus sin horarios publicados. No sabemos qué camiones pasan aquí."}</p>` : `<ul class="filas fichas-linea">${p.lineas.slice(0, 6).map((l) => `<li data-linea="${escapar(l.linea)}"><button type="button" class="ficha-linea" data-ver-linea="${escapar(l.linea)}" data-hacia="${escapar(l.hacia)}" data-indice="${p.i}">
      <span class="linea-caja">${escapar(l.linea)}</span>
      <span class="fila-texto"><small class="hacia-rotulo">Hacia</small><strong translate="no">${escapar(l.hacia)}</strong>${l.horas[1] !== undefined ? `<small>También a las ${hora(l.horas[1])}</small>` : ""}</span>
      <span class="hora-camion"><strong>${hora(l.horas[0])}</strong><small>${enCuanto(l.horas[0])}</small></span>${ico("chevron", "chevron")}
    </button></li>`).join("")}</ul>`;
  // De noche, si ya no hay camiones o el siguiente tarda mas de hora y media, se duerme el tlacuache.
  const durmiendo = (p) => yaNoPasan() && (p.lineas.length ? (Math.min(...p.lineas.map((l) => l.horas[0])) - ahoraMin() + 1440) % 1440 > 90 : Grieta.tieneRecorridos(p.i));
  const p = lista[0];
  pintarParadas(punto, lista, seleccionada);
  caja.innerHTML = `
    <div class="parada-cerca">
      <p class="etiqueta" id="distanciaParada">${seleccionada ? "Parada elegida" : "Parada más cercana"}</p>
      <p class="parada-nombre" translate="no">${escapar(cruce(p.nombre))}</p>
    </div>
    <div class="a-pie" role="status">${ico("caminar")}<span class="fila-texto"><strong id="caminaParada">${p.caminado ? textoCaminata(p.caminado, p.relieve)[0] : "Calculando el camino a pie..."}</strong><small id="caminaDetalle">${p.caminado ? textoCaminata(p.caminado)[1] : `A ${distanciaTexto(p.m, true)} en línea recta`}</small></span></div>
    <div class="dos-botones ir-parada">
      <button id="irParada" type="button" class="boton boton-guia">${picto("caminar")}Caminar con guía</button>
      <button id="appParada" type="button" class="boton boton-app">${picto("carro")}Ir en app</button>
    </div>
    ${durmiendo(p) ? tlacuacheDormido("Ya no pasan<br>camiones a esta hora") : ""}
    ${p.lineas.length || !durmiendo(p) ? `<h2>${durmiendo(p) ? "Primeros camiones del día" : "Próximos camiones"}</h2>` : ""}
    ${filas(p, true)}
    <h2 class="cabeza-avisos"><span>Avisos de la parada</span><span id="contadorAvisos" class="contador-avisos">${ico("alerta")}<b>…</b></span></h2>
    <div id="avisosParada" class="avisos"></div>
    <button id="reportarParada" type="button" class="boton oscuro">Reportar algo en esta parada</button>
    <section class="comparacion-paradas" id="comparacionParadas" aria-labelledby="tituloComparacionParadas"><h2 id="tituloComparacionParadas">¿Qué parada me conviene?</h2><p class="nota">Calculando caminos a pie y horarios...</p></section>
    ${lista.length > 1 ? `<section class="otras" aria-labelledby="tituloOtrasParadas"><h2 id="tituloOtrasParadas">Otras paradas cerca</h2>
      ${lista.slice(1).map((x, i) => `<button type="button" class="parada-alternativa" data-parada="${i + 1}" aria-label="Ver camiones y reportar en ${escapar(cruce(x.nombre))}"><strong translate="no">${escapar(cruce(x.nombre))}</strong><span class="tenue">A ${distanciaTexto(x.caminado ?? x.m, true)}${x.caminado ? " caminando" : " en línea recta"}</span></button>${filas(x)}`).join("")}</section>` : ""}
    <p class="nota pie">Las horas salen del horario oficial de Qrobus; el camión puede adelantarse o retrasarse.</p>`;
  $("irParada").addEventListener("click", () => iniciarGuiaParada(p, estado.gps ?? punto));
  $("appParada").addEventListener("click", () => poner("destino", { nombre: `Parada ${p.nombre}`, lat: p.lat, lon: p.lon }));
  $("reportarParada").addEventListener("click", () => abrirReporte(p));
  caja.querySelectorAll("[data-parada]").forEach((b) => b.addEventListener("click", () => elegirParada(punto, lista, Number(b.dataset.parada))));
  estado.puntoCamiones = punto;
  estado.listaCamiones = lista;
  pintarParadasEnVista();
  actualizarComparacionParadas(lista);
  if (primera && document.body.dataset.pantalla === "camiones") hablar(`La parada más cercana es ${p.nombre}. ` +
    p.lineas.slice(0, 4).map((l) => `Línea ${l.linea} hacia ${l.hacia}, a las ${hora(l.horas[0])} según el horario.`).join(" "));
  // Lo que avisó la gente en esta parada en la última media hora, junto a su línea
  avisosDeLaGente(p.lat, p.lon).then((avisos) => {
    if (revision !== revisionCamiones) return;
    for (const a of avisos) {
      const li = document.querySelector(`#camionesContenido > .filas li[data-linea="${a.linea}"]`);
      if (!li || li.querySelector(".aviso-gente")) continue;
      li.insertAdjacentHTML("beforeend", `<p class="aviso-gente">${a.tipo === "paso" ? "Ya pasó" : "Viene lleno"}, avisó alguien hace ${a.minutos || "menos de 1"} min</p>`);
    }
  });
  // Las lineas que la gente avisó que suelen ir llenas a esta hora, de los "viene lleno" de otras semanas
  if (p.lineas.length) llamar(`/camiones/ocupacion?lineas=${p.lineas.slice(0, 6).map((l) => encodeURIComponent(l.linea)).join(",")}`).then(({ llenas }) => {
    if (revision !== revisionCamiones) return;
    for (const linea of llenas) {
      const li = document.querySelector(`#camionesContenido > .filas li[data-linea="${linea}"]`);
      if (li && !li.querySelector(".suele-lleno")) li.insertAdjacentHTML("beforeend", `<p class="aviso-gente suele-lleno">Suele ir lleno a esta hora</p>`);
    }
  }).catch(() => {});
  reportesCerca(p.lat, p.lon, 60).then((avisos) => {
    if (revision !== revisionCamiones) return;
    const caja = $("avisosParada");
    if (!caja) return;
    // Un aviso por tipo: varios reportes iguales se juntan y se quedan las descripciones distintas.
    const porTipo = new Map();
    for (const a of avisos) {
      const x = porTipo.get(a.tipo) ?? { tipo: a.tipo, textos: [], id: a.id, sigue: 0 };
      if (a.descripcion && !x.textos.includes(a.descripcion)) x.textos.push(a.descripcion);
      x.sigue += a.sigue ?? 0;
      porTipo.set(a.tipo, x);
    }
    avisos = [...porTipo.values()].map((x) => ({ tipo: x.tipo, id: x.id, sigue: x.sigue, descripcion: x.textos.slice(0, 2).join(". ") }));
    caja.innerHTML = avisos.length
      ? avisos.slice(0, 4).map((a) => `<div class="aviso${a.tipo === "referencia" ? "" : " cuidado"}">
          ${ico(a.tipo === "referencia" ? "localizar" : "alerta")}
          <span class="fila-texto"><strong>${NOMBRES_REPORTE[a.tipo] ?? "Aviso"}</strong>${a.descripcion ? `<small translate="no">${escapar(a.descripcion)}</small>` : ""}
          ${a.tipo === "referencia" ? "" : `${a.sigue ? `<small>${a.sigue === 1 ? "Lo confirmó 1 persona" : `Lo confirmaron ${a.sigue} personas`}</small>` : ""}
          <span class="verificar" data-reporte="${a.id}"><button type="button" class="boton-chico" data-sigue="1">Sigue así</button><button type="button" class="boton-chico" data-sigue="0">Ya lo arreglaron</button></span>`}</span></div>`).join("")
      : "";
    if (avisos.length) caja.insertAdjacentHTML("beforeend", `<p class="nota">Los reportes son de la comunidad y pueden haber cambiado.</p>`);
    const contador = $("contadorAvisos");
    if (contador) {
      contador.lastElementChild.textContent = String(Math.min(avisos.length, 4));
      contador.classList.toggle("con-avisos", avisos.length > 0);
      contador.setAttribute("aria-label", plural(Math.min(avisos.length, 4), "aviso", "avisos"));
    }
    if (avisos.length) leerReferencias(p);
  });
}

// "¿Sigue asi?" en los avisos de la parada: la gente confirma o dice que ya lo arreglaron.
$("camionesContenido").addEventListener("click", async (e) => {
  const b = e.target.closest(".verificar [data-sigue]");
  if (!b) return;
  const caja = b.parentElement;
  caja.querySelectorAll("button").forEach((x) => { x.disabled = true; });
  try {
    await llamar(`/reportes/${caja.dataset.reporte}/verificar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sigue: b.dataset.sigue === "1" }) });
    caja.innerHTML = `<small>Gracias, así otros saben cómo está.</small>`;
  } catch {
    caja.querySelectorAll("button").forEach((x) => { x.disabled = false; });
  }
});
function dondeEstoy(destino) {
  const contar = (t) => { $(destino === "guia" ? "guiaDetalle" : destino === "voz" ? "respuestaVoz" : "respuesta").textContent = t; };
  if (!navigator.geolocation) { contar("Tu navegador no comparte la ubicación."); return hablar("Tu navegador no comparte la ubicación.", false, true); }
  contar("Buscando dónde estás...");
  hablar(frase("buscando_ubicacion"), false, true);
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    const { latitude: lat, longitude: lon } = coords;
    let lugar = "";
    try {
      const r = await (await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`)).json();
      const p = r.features[0]?.properties ?? {};
      lugar = [p.street ? `${p.street}${p.housenumber ? " " + p.housenumber : ""}` : p.name, p.district ?? p.city].filter(Boolean).join(", ");
    } catch {}
    const cercanas = Grieta.pasanAqui(lat, lon, hoyDia(), ahoraMin(), 500).slice(0, 3);
    const pie = await Promise.all(cercanas.map((x) => caminoAPie([lat, lon], [x.lat, x.lon])));
    const conPie = cercanas.map((x, i) => ({ ...x, caminado: pie[i]?.metros })).sort((a, b) => (a.caminado ?? a.m * 1.3) - (b.caminado ?? b.m * 1.3));
    const parada = conPie[0];
    const cuanto = !parada ? "" : parada.caminado
      ? `a ${distanciaTexto(parada.caminado)} caminando, unos ${minutosCaminando(parada.caminado)} minutos`
      : `a unos ${distanciaTexto(parada.m)} en línea recta`;
    const texto = `${lugar ? `Estás en ${lugar}.` : "No encontré el nombre de la calle."} ` +
      (parada ? `Una parada del catálogo es ${cruce(parada.nombre)}, ${cuanto}.` : "No hay paradas de Qrobus a menos de 500 metros.");
    contar(texto);
    hablar(texto, false, true);
  }, () => { contar("No pude ver tu ubicación."); hablar(frase("sin_ubicacion"), false, true); }, { enableHighAccuracy: true, timeout: 10000 });
}
function ponerYo() {
  const { lat, lon } = estado.gps;
  capas.yo?.remove();
  capas.yo = L.marker([lat, lon], { icon: icono("origen"), keyboard: false, zIndexOffset: 800 }).addTo(mapa);
  mapa.setView([lat, lon], 17);
  pintarParadasEnVista();
}
// Con el mapa visible, Dónde estoy abre el mapa en tu ubicación; en modo de voz se sigue diciendo en voz alta.
function abrirUbicacion() {
  if (acc.modoVoz) return dondeEstoy("voz");
  ir("ubicacion");
  pintarAyudaPierdo();
  $("ubicacionAqui").hidden = true; $("ubicacionParada").hidden = true;
  $("ubicacionCalle").textContent = "Buscando dónde estás...";
  ubicar((encontrada) => {
    if (document.body.dataset.pantalla !== "ubicacion") return;
    if (!encontrada) return void ($("ubicacionCalle").textContent = "No pude ver tu ubicación.");
    const { lat, lon } = estado.gps;
    ponerYo();
    $("ubicacionCalle").textContent = "";
    const parada = Grieta.pasanAqui(lat, lon, hoyDia(), ahoraMin(), 500)[0];
    if (parada) { $("ubicacionParada").textContent = `Parada a ${minutosCaminando(parada.m * 1.3)} min: ${cruce(parada.nombre)}`; $("ubicacionParada").hidden = false; }
    fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`).then((r) => r.json()).then((r) => {
      const p = r.features[0]?.properties ?? {};
      const calle = p.street ?? p.name;
      if (calle && document.body.dataset.pantalla === "ubicacion") { $("ubicacionCalle").textContent = calle; $("ubicacionAqui").hidden = false; }
    }).catch(() => {});
  }, true);
}
// Si me pierdo: el contacto se queda solo en este teléfono, fuera del respaldo de la cuenta.
function lugarDeAyuda() { return siMePierdo ? leer("grieta-lugares", []).find((g) => g.nombre === siMePierdo.lugar) ?? null : null; }
function pintarAyudaPierdo() {
  const c = siMePierdo, lugar = lugarDeAyuda();
  $("ayudaPierdo").hidden = !c;
  $("vozLlamar").hidden = !c;
  if (!c) return;
  const tel = `tel:+52${c.telefono}`, texto = `Llamar a ${c.nombre}`;
  $("pierdoLlamar").href = tel; $("pierdoLlamarTexto").textContent = texto;
  $("vozLlamar").href = tel; $("vozLlamarTexto").textContent = texto;
  $("pierdoCasa").hidden = !lugar;
  if (lugar) $("pierdoCasaTexto").textContent = `Llévame a ${lugar.nombre}`;
}
const hojaPierdo = $("hojaPierdo");
let lugarPierdo = null;
const ICONO_LUGAR = { Casa: "casa", Trabajo: "maletin", Escuela: "escuela" };
function pintarAvatarPierdo() {
  const letra = inicialDe($("pierdoNombre").value);
  if (letra) $("pierdoAvatar").textContent = letra;
  else $("pierdoAvatar").innerHTML = ico("persona");
}
function pintarLugaresPierdo() {
  $("pierdoLugares").innerHTML = guardados.map((g, i) => `<button type="button" data-lugar="${i}" aria-pressed="${g.nombre === lugarPierdo}">${ico(ICONO_LUGAR[g.nombre] ?? "pin")}<span translate="no">${escapar(g.nombre)}</span></button>`).join("");
}
function abrirHojaPierdo() {
  const c = siMePierdo;
  $("pierdoNombre").value = c?.nombre ?? "";
  $("pierdoTel").value = c?.telefono ?? "";
  $("pierdoError").hidden = true;
  $("pierdoQuitar").hidden = !c;
  $("pierdoLugarCampo").hidden = !guardados.length;
  const elegido = c?.lugar ?? "Casa";
  lugarPierdo = guardados.some((g) => g.nombre === elegido) ? elegido : guardados[0]?.nombre ?? null;
  pintarAvatarPierdo();
  pintarLugaresPierdo();
  hojaPierdo.showModal();
}
$("pierdoNombre").addEventListener("input", pintarAvatarPierdo);
$("pierdoLugares").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lugar]");
  if (!b) return;
  lugarPierdo = guardados[Number(b.dataset.lugar)].nombre;
  for (const o of $("pierdoLugares").children) o.setAttribute("aria-pressed", String(o === b));
});
function repintarPierdo() { pintarAyudaPierdo(); pintarResumenPerfil(); }
$("pierdoForma").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = $("pierdoNombre").value.trim();
  const telefono = $("pierdoTel").value.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  const error = !nombre ? "Escribe cómo se llama." : telefono.length !== 10 ? "Escribe su teléfono a 10 dígitos." : "";
  $("pierdoError").textContent = error; $("pierdoError").hidden = !error;
  if (error) return;
  siMePierdo = { nombre, telefono, lugar: lugarPierdo };
  escribir("grieta-si-me-pierdo", siMePierdo);
  hojaPierdo.close();
  repintarPierdo();
});
$("pierdoCancelar").addEventListener("click", () => hojaPierdo.close());
$("pierdoQuitar").addEventListener("click", () => { siMePierdo = null; localStorage.removeItem("grieta-si-me-pierdo"); hojaPierdo.close(); repintarPierdo(); });
hojaPierdo.addEventListener("click", (e) => { if (e.target === hojaPierdo && e.clientY < hojaPierdo.getBoundingClientRect().top) hojaPierdo.close(); });
hojaPierdo.addEventListener("close", () => $("perfilFichas").querySelector("[data-pierdo]")?.focus({ preventScroll: true }));
$("pierdoMandar").addEventListener("click", () => {
  const g = estado.gps, calle = $("ubicacionCalle").textContent;
  const mensaje = `Me perdí.${calle ? ` Estoy en ${calle}.` : ""}${g ? ` https://www.google.com/maps?q=${g.lat.toFixed(5)},${g.lon.toFixed(5)}` : ""}`;
  if (navigator.share) return void navigator.share({ text: mensaje }).catch(() => {});
  navigator.clipboard?.writeText(mensaje).then(() => avisar("Copié dónde estás para que lo pegues en un mensaje."), () => {});
});
$("pierdoCasa").addEventListener("click", () => {
  const lugar = lugarDeAyuda();
  if (!lugar) return;
  if (estado.gps) estado.origen = estado.gps;
  irA(lugar);
});
pintarAyudaPierdo();
$("dondeEstoy").addEventListener("click", abrirUbicacion);
$("dondeGuia").addEventListener("click", () => dondeEstoy("guia"));

// Dictar: llena el buscador, busca y lee las primeras opciones.
const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
function actualizarMicrofono() {
  microfonoActivo = Boolean(dictadoActual || cierresDictado.size);
  if (microfonoActivo || !respuestaDictado) return;
  const pendiente = respuestaDictado; respuestaDictado = null;
  if (pendiente.revision === revisionDictado) hablar(pendiente.mensaje);
}
function hablarAlCerrarDictado(mensaje) {
  if (!microfonoActivo) return hablar(mensaje);
  respuestaDictado = { mensaje, revision: revisionDictado };
}
function terminarDictado(rec, abortar = true) {
  if (dictadoActual !== rec) return;
  clearTimeout(inicioDictado);
  const iniciado = dictadoIniciado;
  dictadoActual = null; dictadoIniciado = false;
  $("oyendoBuscar").hidden = true;
  document.querySelectorAll(".dictar-grande").forEach((b) => b.classList.remove("pensando", "entiende"));
  document.querySelectorAll('.dictar.oyendo, #vozDestino.oyendo').forEach(b => { b.classList.remove('oyendo'); b.setAttribute('aria-pressed', 'false'); });
  $("respuestaVoz").textContent = '';
  $("respuestaVoz").setAttribute('aria-live', 'polite');
  rec.onstart = rec.onresult = rec.onerror = rec.onspeechend = null;
  if (iniciado && abortar) {
    cierresDictado.add(rec);
    let limite;
    const liberar = () => { clearTimeout(limite); cierresDictado.delete(rec); actualizarMicrofono(); };
    rec.onaudioend = rec.onend = liberar;
    // abort() corta la captura; la pausa breve solo protege el retorno de la voz.
    limite = setTimeout(liberar, 250);
    try { rec.abort(); } catch { liberar(); }
  } else rec.onaudioend = rec.onend = null;
  actualizarMicrofono();
}
function cancelarDictado() {
  revisionDictado++; respuestaDictado = null;
  if (dictadoActual) terminarDictado(dictadoActual);
}
const FRASE_DESTINO = /\b(?:llev\w*|ir(?:me|nos)?|voy|vamos|vete|llegar(?:me|nos)?|llego|llegamos|llega|va|van|pasa|deja|dejan|tomo|tomar|agarro|agarrar)(?:\s+(?:me|nos|el|la|un|una|camion|ruta))*\s+(?:rumbo\s+a|a|al|hacia|hasta|para|por|en)\s+/;
const FRASE_SIN_A = /\b(?:llev\w*|voy|vamos|ir|donde\s+(?:queda|esta)|busca(?:me|r)?|encuentra(?:me)?|muestrame|ensename|como\s+llego)(?:\s+(?:me|nos))?\s+/;
const COLA_DICHA = /\s+(?:gracias|ahora|ahorita|ya|rapido|hoy|grieta|en\s+(?:camion|autobus|qrobus|bus|uber|didi|taxi|carro|coche)|(?:a|para)\s+las?\s+\d.*)$/;
// Saca el lugar de frases como "llévame a Antea" o "quiero ir al centro".
function lugarDicho(texto) {
  let t = texto.normalize("NFC").replace(/\b(?:por\s*favor|porfa|porfis)\b/gi, " ").replace(/[.,;:!?¡¿]+/g, " ").replace(/\s+/g, " ").trim();
  const quitar = (re) => { const m = re.exec(sinAcentos(t)); if (m) t = t.slice(m.index + m[0].length); return Boolean(m); };
  let frase = false;
  for (let i = 0; i < 3 && quitar(FRASE_DESTINO); i++) frase = true;
  if (!frase) frase = quitar(FRASE_SIN_A);
  if (quitar(/^(?:de|desde)\s+.+?\s+(?:a|al|hasta|hacia)\s+/)) frase = true;
  if (quitar(/^(?:rumbo\s+a|a|al|hacia|hasta|para)\s+/)) frase = true;
  quitar(frase ? /^(?:la|las|los|el|mi|mis)\s+/ : /^(?:mi|mis)\s+/);
  for (let i = 0; i < 3; i++) { const m = COLA_DICHA.exec(sinAcentos(t)); if (!m) break; t = t.slice(0, m.index); }
  return t.trim();
}
function procesarDictado(texto, revision) {
  texto = lugarDicho(texto);
  const dicho = sinAcentos(texto);
  const guardado = guardados.find(g => sinAcentos(g.nombre) === dicho);
  if (guardado) {
    estado.editando = "hacia";
    if (cambioUbicacionGuardada) return poner("destino", guardado);
    poner("destino", guardado);
    return hablarAlCerrarDictado(frase("vamos_lugar", { lugar: guardado.nombre }));
  }
  if (document.body.dataset.pantalla !== "buscar") abrirBuscar("hacia");
  $("campoBuscar").value = texto;
  estado.resultados = null; estado.buscado = false;
  if (texto.length < 3) {
    avisarBreve(textoFrase(frase("no_escuche")));
    return hablarAlCerrarDictado(frase("no_escuche"));
  }
  sugerir(texto, res => {
    if (revision !== revisionDictado || document.body.dataset.pantalla !== "buscar" || $("campoBuscar").value !== texto) return;
    if (acc.modoVoz && res.length && !cambioUbicacionGuardada) {
      const mensaje = [frase("vamos_lugar", { lugar: res[0].nombre }), " Si no es, regresa y vuelve a decirlo."];
      elegir(res[0]);
      return hablarAlCerrarDictado(mensaje);
    }
    hablarAlCerrarDictado(res.length
      ? `Encontré ${res.length} lugares. ` + res.slice(0, 3).map((l, i) => `${i + 1}: ${l.nombre}${l.detalle ? ", " + l.detalle : ""}.`).join(" ") + " Elige uno de la lista."
      : `No encontré ${texto}. Intenta con otro nombre.`);
  });
}
function dictar(boton) {
  const detener = dictadoActual && boton.classList.contains('oyendo');
  cancelarDictado();
  if (detener) return;
  const rec = new Reconocer(), revision = revisionDictado;
  // Fuera del modo voz, dictar lleva a Buscar: ahi se ve el aviso de que escucha y lo que va entendiendo.
  // En Inicio el boton rosa se ilumina ahi mismo y muestra lo que va entendiendo; en Buscar sale el aviso abajo del campo.
  const enInicio = !acc.modoVoz && boton.classList.contains("dictar-grande");
  const enBuscar = !acc.modoVoz && !enInicio && Boolean(boton.closest("#buscar"));
  const mostrar = (texto, parcial) => {
    if (enBuscar) $("campoBuscar").value = texto;
    if (enInicio) { boton.querySelector(".dg-texto").textContent = parcial ? `“${texto}…”` : texto; boton.classList.toggle("entiende", parcial); }
  };
  if (enInicio) mostrar(textoFrase("Te escucho, di a dónde vas"), false);
  if (enBuscar) {
    $("campoBuscar").value = "";
    $("oyendoTexto").textContent = "Te escucho, di a dónde vas";
    $("oyendoBuscar").classList.remove("pensando");
    $("oyendoBuscar").hidden = false;
  }
  dictadoActual = rec; actualizarMicrofono();
  rec.lang = "es-MX"; rec.continuous = false; rec.interimResults = enBuscar || enInicio; rec.maxAlternatives = 1;
  boton.classList.add("oyendo"); boton.setAttribute("aria-pressed", "true");
  $("respuestaVoz").setAttribute('aria-live', 'off');
  detenerVoz();
  if (acc.modoVoz) $("respuestaVoz").textContent = "Di a dónde vas.";
  rec.onspeechend = () => {
    if (dictadoActual !== rec) return;
    boton.classList.remove("oyendo"); boton.setAttribute("aria-pressed", "false");
    if (enBuscar) { $("oyendoTexto").textContent = "Buscando lo que dijiste…"; $("oyendoBuscar").classList.add("pensando"); }
    if (enInicio) { boton.classList.add("oyendo", "pensando"); boton.querySelector(".dg-texto").textContent = "Buscando lo que dijiste…"; boton.classList.remove("entiende"); }
    try { rec.stop(); } catch {}
  };
  rec.onresult = e => {
    if (dictadoActual !== rec) return;
    const texto = Array.from(e.results).filter(r => r.isFinal).map(r => r[0]?.transcript ?? '').join(' ').trim();
    if (!texto) {
      const parcial = Array.from(e.results).map(r => r[0]?.transcript ?? '').join(' ').trim();
      if (parcial) mostrar(parcial, true);
      return;
    }
    terminarDictado(rec);
    procesarDictado(texto, revision);
  };
  rec.onerror = e => {
    if (dictadoActual !== rec) return;
    terminarDictado(rec);
    if (e.error !== 'aborted') { avisarBreve(textoFrase(frase("no_escuche"))); hablarAlCerrarDictado(frase("no_escuche")); }
  };
  rec.onend = () => { if (dictadoActual === rec) terminarDictado(rec, false); };
  const iniciar = () => {
    if (dictadoActual !== rec) return;
    const espera = Math.max(0, 120 - (performance.now() - ultimaVozDetenida));
    if (espera || cierresDictado.size) { inicioDictado = setTimeout(iniciar, Math.max(16, espera)); return; }
    dictadoIniciado = true;
    try { rec.start(); } catch { rec.onerror({ error: 'inicio' }); }
  };
  iniciar();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelarDictado(); });
$("oyendoBuscar").addEventListener("click", cancelarDictado);
addEventListener('pagehide', cancelarDictado);
if (Reconocer) {
  for (const b of document.querySelectorAll(".dictar")) {
    b.hidden = false;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => dictar(b));
  }
}

// Guia de viaje: sigue el GPS y avisa con voz, vibracion y tono antes de bajarse.
const guia = { activa: false };

function ponerTitulo(titulo) {
  titulo = textoFrase(titulo);
  const largo = cruce(titulo).length;
  $("guiaTitulo").classList.toggle("largo", largo > 26 && largo <= 44);
  $("guiaTitulo").classList.toggle("muy-largo", largo > 44);
  $("guiaTitulo").innerHTML = escapar(cruce(titulo)).replace(/^Faltan (\d+)/, 'Faltan <span class="num">$1</span>');
}
// Cada etapa pinta toda la pantalla de su color (estilos.css, body[data-etapa]) y dice en que paso del viaje vas.
const ETAPAS_GUIA = {
  "Hacia tu destino": ["camina", 1, "caminar"], "Hacia la parada": ["camina", 1, "caminar"], "Transbordo": ["camina", 3, "caminar"], "En la parada": ["parada", 2, "parada"],
  "En el camión": ["camion", 3, "qrobus"], "Próxima parada": ["bajate", 3, "parada"], "Tu parada": ["bajate", 3, "parada"], "Llegaste": ["llegaste", 4, "lugar"],
};
// Video en Lengua de Señas Mexicana de la frase del aviso, si ya se grabo (datos/lsm.json, ver docs/lengua-de-senas.md).
let videosSenas = {};
fetch("datos/lsm.json").then((x) => x.json()).then((x) => { videosSenas = x; }).catch(() => {});
function mostrarSenas(titulo) {
  const video = $("guiaSenas");
  const archivo = videosSenas[titulo?.id];
  video.hidden = !archivo;
  if (!archivo) return void video.removeAttribute("src");
  if (!video.src.endsWith(archivo)) video.src = archivo;
  video.play().catch(() => {});
}
function decir(titulo, detalle, etapa, alerta = false) {
  mostrarSenas(titulo);
  const [clave, paso, picto] = ETAPAS_GUIA[etapa] ?? ETAPAS_GUIA[guia.fase === "camion" ? "En el camión" : "Llegaste"];
  document.body.dataset.etapa = clave;
  $("guiaPicto").setAttribute("href", `#p-${guia.enApp && etapa === "Hacia la parada" ? "app" : picto}`);
  if (etapa) $("guiaEtapa").textContent = guia.soloCaminar ? etapa : `Paso ${paso} de 4: ${etapa}`;
  $("guiaLinea").hidden = !guia.camion || clave === "llegaste";
  if (guia.camion) $("guiaLinea").lastElementChild.textContent = guia.camion.linea;
  // En la parada el boton principal es "¿Es mi parada?"; arriba del camion, "Avisar al chofer".
  $("avisarChofer").hidden = !["camion", "bajate"].includes(clave);
  $("avisarChofer").classList.remove("oscuro");
  ponerTitulo(titulo);
  $("guiaDetalle").textContent = cruce(textoFrase(detalle));
  // El color ya lo da la etapa; el aviso urgente se nota por el rojo de "Bájate".
  document.body.classList.remove("alerta");
  pintarGuia();
  hablar(detalle ? [titulo, ". ", detalle] : titulo, false, true);
}
// Barra con un segmento por parada del recorrido; con mas de 12 se agrupan.
function pintarGuia() {
  const c = guia.camion;
  $("enParada").hidden = !c || guia.enApp || !["parada", "esperando"].includes(guia.fase);
  $("yaMeSubi").textContent = textoFrase(c ? frase("subi_linea", { linea: c.linea }) : frase("ya_me_subi"));
  // "Bajas en" y la barra de paradas solo cuando ya vas arriba del camion.
  const arriba = ["camion", "bajate"].includes(document.body.dataset.etapa);
  $("guiaBaja").hidden = !c || !arriba;
  $("barraParadas").hidden = !c || !arriba;
  if (!c) return;
  const r = c.recorrido;
  $("guiaBaja").innerHTML = `Bajas en <strong translate="no">${escapar(cruce(r.at(-1).nombre))}</strong>`;
  const n = r.length - 1;
  const actual = guia.fase === "camion" || guia.fase === "fin" ? guia.actual : 0;
  const g = Math.min(n, 12);
  const partes = [];
  for (let j = 0; j < g; j++) {
    const desde = Math.floor((j * n) / g) + 1;
    const hasta = Math.floor(((j + 1) * n) / g);
    const clase = hasta <= actual ? "pasada" : desde <= actual + 1 && actual + 1 <= hasta ? "actual" : "";
    partes.push(`<span class="${clase}"></span>`);
  }
  $("barraParadas").innerHTML = partes.join("");
  $("barraParadas").setAttribute("aria-valuemax", String(n));
  $("barraParadas").setAttribute("aria-valuenow", String(actual));
  $("barraParadas").setAttribute("aria-valuetext", `${actual} de ${n} paradas recorridas en la línea ${c.linea}`);
  $("barraParadas").setAttribute("aria-label", "Paradas del recorrido");
}
async function mantenerPantalla() {
  try { guia.wake = await navigator.wakeLock?.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => { if (guia.activa && document.visibilityState === "visible") mantenerPantalla(); });

function seguir(alMoverse) {
  if (!navigator.geolocation) return decir("Sin ubicación", "Tu navegador no comparte la ubicación.");
  const alPosicion = guia.alPosicion = ({ coords }) => {
      const aqui = [coords.latitude, coords.longitude];
      if (document.body.classList.contains("guia-mapa")) { capas.aqui?.remove(); capas.aqui = null; }
      else if (capas.aqui) capas.aqui.setLatLng(aqui);
      else capas.aqui = L.marker(aqui, { icon: icono("origen"), keyboard: false }).addTo(mapa);
      // Si el telefono no da la velocidad, se saca de dos posiciones separadas al menos 3 segundos.
      const ahora = Date.now();
      let v = Number.isFinite(coords.speed) ? coords.speed : null;
      if (v === null && guia.previo && ahora - guia.previo.t >= 3000) {
        v = Grieta.metros(guia.previo.lat, guia.previo.lon, coords.latitude, coords.longitude) / ((ahora - guia.previo.t) / 1000);
      }
      guia.precision = coords.accuracy;
      // Rumbo del telefono o, si no lo da, el de tu ultimo tramo caminado.
      let rumbo = Number.isFinite(coords.heading) ? coords.heading : null;
      if (rumbo === null && guia.ultimo && Grieta.metros(guia.ultimo.lat, guia.ultimo.lon, coords.latitude, coords.longitude) >= 4) {
        const r = Math.PI / 180, [a1, o1, a2, o2] = [guia.ultimo.lat, guia.ultimo.lon, coords.latitude, coords.longitude].map((x) => x * r);
        rumbo = (Math.atan2(Math.sin(o2 - o1) * Math.cos(a2), Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(o2 - o1)) / r + 360) % 360;
      }
      if (rumbo !== null || !guia.ultimo) guia.ultimo = { lat: coords.latitude, lon: coords.longitude };
      if (rumbo !== null) guia.rumbo = rumbo;
      moverMapaPie(coords.latitude, coords.longitude, guia.rumbo);
      if (!guia.previo || ahora - guia.previo.t >= 3000) guia.previo = { lat: coords.latitude, lon: coords.longitude, t: ahora };
      if (v !== null) guia.velocidad = v;
      alMoverse(coords.latitude, coords.longitude, guia.velocidad ?? 0);
  };
  guia.reloj = navigator.geolocation.watchPosition(
    alPosicion,
    // Sin permiso no hay avisos; un GPS que tarda en responder se sigue esperando sin interrumpir lo que se dice.
    (err) => { if (err.code === err.PERMISSION_DENIED) unaVez("sin-permiso", () => decir("Sin ubicación", "Activa la ubicación para recibir los avisos.")); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
}
const unaVez = (clave, fn) => { if (!guia.dichos.has(clave)) { guia.dichos.add(clave); fn(); } };

// Del lugar de salida a la parada, vuelta por vuelta con los nombres de las calles (OSRM a pie, con steps).
// Al final se agrega la referencia que dejo la gente para encontrar la parada, si hay.
const GIROS = { left: "a la izquierda", right: "a la derecha", "slight left": "un poco a la izquierda", "slight right": "un poco a la derecha",
  "sharp left": "a la izquierda", "sharp right": "a la derecha", uturn: "de regreso" };
function textoPasoPie(s, parada) {
  const calle = s.name ? ` por ${s.name}` : "";
  const { type: tipo, modifier: giro } = s.maneuver;
  if (tipo === "arrive") return { texto: `Llegas a la parada ${cruce(parada)}` };
  const tramo = s.distance >= 20 ? distanciaTexto(s.distance) : "";
  if (tipo === "depart") return { texto: `Camina${calle}`, tramo };
  if (!GIROS[giro] || tipo === "continue" || tipo === "new name") return { texto: `Sigue derecho${calle}`, tramo };
  return { texto: `Da vuelta ${GIROS[giro]}${calle}`, tramo };
}
async function indicacionesPie(desde, parada) {
  if (!desde) return;
  guia.metaPie = parada;
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${desde.lon},${desde.lat};${parada.lon},${parada.lat}?steps=true&overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) }).then((x) => x.json());
    // Se juntan los tramos muy cortos con el anterior para no dar instrucciones de 5 metros.
    const pasos = [];
    for (const s of r.routes[0].legs[0].steps) {
      const previo = pasos.at(-1)?.s;
      const mismaCalle = previo && s.name && s.name === previo.name && ["continue", "new name"].includes(s.maneuver.type);
      if (previo && s.maneuver.type !== "arrive" && (s.distance < 15 || mismaCalle)) { previo.distance += s.distance; continue; }
      pasos.push({ s, lat: s.maneuver.location[1], lon: s.maneuver.location[0] });
    }
    const refs = (await reportesCerca(parada.lat, parada.lon, 60)).filter((x) => x.tipo === "referencia" && x.descripcion);
    if (!guia.activa || guia.fase !== "parada") return;
    guia.pasosPie = pasos.slice(0, 10).map((p) => ({ ...p, ...textoPasoPie(p.s, parada.nombre) }));
    if (refs.length) guia.pasosPie.at(-1).referencia = refs[0].descripcion;
    Object.assign(guia, { pasoPie: 0, rutaPie: (guia.rutaPie ?? 0) + 1, mejorPie: Infinity, centenaPie: null, fueraPie: 0 });
    guia.trazoPie = r.routes[0].geometry.coordinates.map(([lo, la]) => [la, lo]);
    pintarPasosPie();
    entrarMapaPie();
    const inicio = guia.pasosPie[0];
    hablar(`${inicio.texto}${inicio.tramo ? `, ${inicio.tramo}` : ""}. Te aviso antes de cada vuelta.`, true);
  } catch {
    if (acc.modoVoz && guia.activa && guia.fase === "parada" && !guia.pasosPie) hablar("No pude trazar las vueltas. Te aviso cuando estés cerca de la parada.", true);
  }
}
function metrosALinea(lat, lon, linea) {
  const k = Math.cos(lat * Math.PI / 180), m = 111320;
  let mejor = Infinity;
  for (let i = 1; i < linea.length; i++) {
    const ay = (linea[i - 1][0] - lat) * m, ax = (linea[i - 1][1] - lon) * m * k, by = (linea[i][0] - lat) * m, bx = (linea[i][1] - lon) * m * k;
    const dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    mejor = Math.min(mejor, Math.hypot(ax + u * dx, ay + u * dy));
  }
  return mejor;
}
// Si caminas al revés te lo dice; si te sales del camino traza otro desde donde estás.
function revisarCaminoPie(lat, lon, falta) {
  if (!guia.trazoPie) return false;
  const ahora = Date.now();
  guia.mejorPie = Math.min(guia.mejorPie, falta);
  if ((guia.avisoPie ?? 0) + 25000 > ahora) return false;
  if (guia.pasoPie === 0 && Number.isFinite(falta) && falta > guia.mejorPie + 30) {
    Object.assign(guia, { avisoPie: ahora, mejorPie: falta, fueraPie: 0 });
    vibrar([400, 120, 400]);
    hablar("Vas en sentido contrario. Da la vuelta.");
    return true;
  }
  const fuera = metrosALinea(lat, lon, guia.trazoPie) > Math.max(40, (guia.precision ?? 0) * 1.5);
  guia.fueraPie = fuera ? guia.fueraPie + 1 : 0;
  if (guia.fueraPie < 2) return false;
  Object.assign(guia, { avisoPie: ahora, fueraPie: 0 });
  vibrar([400, 120, 400]);
  hablar("Te saliste del camino. Te busco otra ruta.");
  indicacionesPie({ lat, lon }, guia.metaPie);
  return true;
}
function pintarPasosPie() {
  const lista = $("pasosPie");
  lista.innerHTML = guia.pasosPie.map((p, i) => `<li class="${i === guia.pasoPie ? "actual" : i < guia.pasoPie ? "hecho" : ""}"><span class="fila-texto"><span>${escapar(p.texto)}</span>${p.tramo ? `<small>${p.tramo}</small>` : ""}${p.referencia ? `<small translate="no">${escapar(p.referencia)}</small>` : ""}</span></li>`).join("");
  lista.hidden = false;
}
// Al acercarse a la siguiente vuelta, se marca y se dice.
function avanzarPie(lat, lon) {
  const pasos = guia.pasosPie;
  if (!pasos) return;
  const sig = pasos[guia.pasoPie + 1];
  const falta = sig ? Grieta.metros(lat, lon, sig.lat, sig.lon) : Infinity;
  pintarVueltaPie(lat, lon, falta);
  if (revisarCaminoPie(lat, lon, falta) || !sig) return;
  if (acc.modoVoz && falta >= 60) {
    const centena = Math.ceil(falta / 100);
    if (guia.centenaPie !== null && centena < guia.centenaPie) hablar(`Vas bien. Faltan ${distanciaTexto(Math.round(falta / 10) * 10)}.`, true);
    guia.centenaPie = centena;
  }
  // Unos 35 m antes de la vuelta: izquierda dos pulsos, derecha tres; derecho o llegada, uno largo.
  if (falta <= 35) unaVez(`vuelta-${guia.k}-${guia.rutaPie}-${guia.pasoPie + 1}`, () => {
    const giro = sig.s.maneuver.modifier ?? "";
    vibrar(/left/.test(giro) ? [150, 100, 150] : /right/.test(giro) ? [150, 100, 150, 100, 150] : [400]);
    hablar([sig.texto, sig.referencia ? `. ${sig.referencia}` : ""].join(""));
  });
  if (falta > 20) return;
  Object.assign(guia, { pasoPie: guia.pasoPie + 1, mejorPie: Infinity, centenaPie: null });
  pintarPasosPie();
}
// Navegacion a pie sobre el mapa: tarjeta de la siguiente vuelta y tu flecha siguiendote.
const ANGULO_GIRO = { straight: 0, "slight right": 45, right: 90, "sharp right": 135, uturn: 180, "sharp left": -135, left: -90, "slight left": -45 };
function entrarMapaPie() {
  if (!guia.activa || guia.fase !== "parada" || !guia.pasosPie || document.body.dataset.pantalla !== "guia" || acc.modoVoz) return;
  // La ruta en auto de la busqueda no se ve durante la caminata; al volver a opciones regresa.
  capas.linea?.setStyle?.({ opacity: 0 });
  document.body.classList.add("con-mapa", "guia-mapa");
  capas.aqui?.remove(); capas.aqui = null;
  $("pasosPie").hidden = true;
  capas.pie?.remove();
  capas.pie = L.featureGroup([
    L.polyline(guia.trazoPie ?? [], { color: "#1b2a6b", weight: 10, opacity: 0.55, interactive: false }),
    L.polyline(guia.trazoPie ?? [], { color: "#ffffff", weight: 6, interactive: false }),
    L.marker([guia.camion?.recorrido[0].lat ?? guia.pasosPie.at(-1).lat, guia.camion?.recorrido[0].lon ?? guia.pasosPie.at(-1).lon], { interactive: false, keyboard: false, zIndexOffset: 500,
      icon: L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: `<span class="parada-ruta sube"><svg class="picto"><use href="#p-qrobus"/></svg></span>` }) }),
  ]).addTo(mapa);
  setTimeout(() => {
    mapa.invalidateSize();
    const gps = guia.previo ?? estado.gps;
    const yo = gps ? [gps.lat, gps.lon] : guia.trazoPie?.[0];
    if (yo) mapa.setView(yo, 17, { animate: false });
    if (gps) { moverMapaPie(gps.lat, gps.lon, guia.rumbo); avanzarPie(gps.lat, gps.lon); }
  }, 60);
  pintarVueltaPie();
}
function salirMapaPie() {
  document.body.classList.remove("guia-mapa");
  if (document.body.dataset.pantalla === "guia") document.body.classList.remove("con-mapa");
  capas.pie?.remove(); capas.pie = null;
  $("vueltaPie").hidden = true;
  setTimeout(() => mapa.invalidateSize(), 60);
}
function pintarVueltaPie(lat, lon, falta) {
  const tarjeta = $("vueltaPie");
  const conCamara = document.body.dataset.pantalla === "camara" && guia.activa && guia.fase === "parada";
  document.body.classList.toggle("camara-guia", conCamara && Boolean(guia.pasosPie));
  if (!(document.body.classList.contains("guia-mapa") || conCamara) || !guia.pasosPie) { tarjeta.hidden = true; return; }
  const sig = guia.pasosPie[guia.pasoPie + 1] ?? guia.pasosPie.at(-1);
  const tipo = sig.s.maneuver.type, giro = sig.s.maneuver.modifier;
  const llegada = tipo === "arrive";
  const flecha = $("vueltaFlecha");
  flecha.classList.toggle("llegada", llegada);
  flecha.style.transform = llegada || tipo === "continue" || tipo === "new name" ? "" : `rotate(${ANGULO_GIRO[giro] ?? 0}deg)`;
  $("vueltaTexto").textContent = sig.texto;
  $("vueltaDistancia").textContent = Number.isFinite(falta) ? distanciaTexto(Math.max(5, Math.round(falta / 5) * 5)) : sig.tramo ?? "";
  // Con el horario: si a tu paso llegas antes de que pase el camion o vas justo.
  const c = guia.camion;
  const chip = $("vueltaCamion");
  chip.hidden = !c || guia.enApp;
  if (c && lat !== undefined) {
    const resta = Grieta.metros(lat, lon, c.recorrido[0].lat, c.recorrido[0].lon) * 1.3;
    const ahora = new Date(), minuto = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
    const holgura = c.sale - minuto - resta / 75;
    chip.querySelector("b i").textContent = `${c.linea} a las ${hora(c.sale)}`;
    chip.querySelector("b + span").textContent = holgura >= 2 ? "Vas a tiempo" : "Apúrate";
    chip.classList.toggle("justo", holgura < 2);
  } else if (c) { chip.querySelector("b i").textContent = `${c.linea} a las ${hora(c.sale)}`; chip.querySelector("b + span").textContent = ""; }
  tarjeta.hidden = false;
  if (conCamara) document.body.style.setProperty("--alto-vuelta", `${tarjeta.offsetHeight}px`);
}
function moverMapaPie(lat, lon, rumbo) {
  if (!document.body.classList.contains("guia-mapa")) return;
  if (!capas.flecha) capas.flecha = L.marker([lat, lon], { interactive: false, keyboard: false, zIndexOffset: 900,
    icon: L.divIcon({ className: "", iconSize: [40, 40], iconAnchor: [20, 20], html: `<span class="yo-flecha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21 12 16.5 4 21Z"/></svg></span>` }) }).addTo(mapa);
  else capas.flecha.setLatLng([lat, lon]);
  const el = capas.flecha.getElement()?.querySelector(".yo-flecha");
  if (el && Number.isFinite(rumbo)) el.style.transform = `rotate(${rumbo}deg)`;
  mapa.panTo([lat, lon], { animate: suave(), duration: 0.5 });
}
function iniciarGuia(o) {
  terminarGuia();
  viajeEnCurso = true;
  const tramos = o.pasos.filter((p) => p.tipo === "camion");
  registrarViaje(o);
  guia.km = sinAuto(o) ? estado.r.directo.km : 0;
  if (guia.km) contarViaje(guia.km);
  ir("guia");
  $("comoTeFue").hidden = true; $("guiaRacha").hidden = true;
  Object.assign(guia, { activa: true, o, tramos, k: 0, camion: tramos[0], fase: "parada", actual: 0, dichos: new Set(), previo: null, velocidad: null, vueltas: 0, push: null,
    destino: estado.destino, enApp: o.pasos[0].tipo === "app", pie: null, soloParada: false });
  dibujar(o);
  mantenerPantalla();
  vibrar([60]);
  $("yaMeSubi").hidden = false;
  pintarBotonSimulador();
  // Con el horario oficial: avisa 5 minutos y 1 minuto antes de que pase el camion.
  guia.horario = setInterval(() => {
    if (guia.fase !== "parada" && guia.fase !== "esperando") return;
    if ((guia.vueltas = (guia.vueltas ?? 0) + 1) % 4 === 1) revisarAvisosParada();
    const c = guia.camion;
    const ahora = new Date();
    const falta = c.sale - (ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60);
    if (falta <= 1 && falta > -3) unaVez(`pasa1-${guia.k}`, () => { vibrar([500, 150, 500]); decir(`La ${c.linea} debe estar por pasar`, `Según el horario pasa a las ${hora(c.sale)}. Pregúntale al chofer si es la ${c.linea} hacia ${c.hacia}.`, "En la parada"); });
    else if (falta <= 5 && falta > 1) unaVez(`pasa5-${guia.k}`, () => { vibrar([300]); decir(`La ${c.linea} pasa en unos ${Math.round(falta)} minutos`, `Según el horario, a las ${hora(c.sale)}.`, "En la parada"); });
  }, 15000);
  const inicio = o.pasos[0];
  const c = guia.camion;
  decir(inicio.tipo === "app" ? `Pide ${Grieta.nombreApp(inicio.app)} a ${inicio.parada}` : frase("camina_parada", { parada: inicio.parada }),
    [`Ahí tomas la línea ${c.linea} hacia ${c.hacia}, a las ${hora(c.sale)} según el horario.`, tramos.length > 1 ? [" ", frase("despues_transbordo")] : "", " Te aviso antes de bajar."], "Hacia la parada");
  if (!guia.enApp) {
    medirCaminata(estado.gps ?? estado.origen, c.recorrido[0]);
    indicacionesPie(estado.gps ?? estado.origen, c.recorrido[0]);
  }
  programarAvisos(tramos);
  seguir(avanzarCamion);
}

// Desde Camiones cerca: te lleva caminando a la parada con la misma guia; al llegar dice que camiones vienen.
function iniciarGuiaParada(p, desde) {
  terminarGuia();
  viajeEnCurso = true;
  const parada = { nombre: p.nombre, lat: p.lat, lon: p.lon };
  const l = p.lineas[0];
  const camion = { linea: l?.linea ?? "", hacia: l?.hacia ?? "", sale: l?.horas[0] ?? ahoraMin(), llega: l?.horas[0] ?? ahoraMin(), baja: p.nombre, recorrido: [parada, parada] };
  estado.destino = { nombre: `Parada ${p.nombre}`, lat: p.lat, lon: p.lon };
  ir("guia");
  $("comoTeFue").hidden = true; $("guiaRacha").hidden = true;
  Object.assign(guia, { activa: true, o: null, tramos: [camion], k: 0, camion, fase: "parada", actual: 0, dichos: new Set(), previo: null, velocidad: null, vueltas: 0, push: null,
    destino: estado.destino, enApp: false, pie: null, soloParada: true, km: 0 });
  mantenerPantalla();
  vibrar([60]);
  $("yaMeSubi").hidden = true;
  decir(frase("camina_parada", { parada: p.nombre }), l ? `El siguiente camión es la ${l.linea} hacia ${l.hacia}, a las ${hora(l.horas[0])} según el horario.` : "", "Hacia la parada");
  medirCaminata(desde, parada);
  indicacionesPie(desde, parada);
  seguir(avanzarCamion);
}

// Caminar hasta el destino con la misma guia a pie de las paradas; sin camion, no cuenta para la racha.
function iniciarGuiaCaminando(lugar, desde) {
  terminarGuia();
  viajeEnCurso = true;
  const meta = { nombre: lugar.nombre, lat: lugar.lat, lon: lugar.lon };
  ir("guia");
  $("comoTeFue").hidden = true; $("guiaRacha").hidden = true; $("yaMeSubi").hidden = true;
  Object.assign(guia, { activa: true, o: null, tramos: [], k: 0, camion: null, fase: "parada", actual: 0, dichos: new Set(), previo: null, velocidad: null, vueltas: 0, push: null,
    destino: meta, enApp: false, pie: null, soloParada: false, soloCaminar: true, km: 0 });
  mantenerPantalla();
  vibrar([60]);
  decir(frase("camina_parada", { parada: meta.nombre }), "", "Hacia tu destino");
  pintarBotonSimulador();
  medirCaminata(desde, meta);
  indicacionesPie(desde, meta);
  seguir(avanzarCaminata);
}
function avanzarCaminata(lat, lon) {
  if (guia.fase === "fin") return;
  const d = guia.destino, falta = Grieta.metros(lat, lon, d.lat, d.lon);
  avanzarPie(lat, lon);
  if (falta >= 40) {
    const rodeo = guia.pie ? 1 + (guia.pie.metros / guia.pie.recta - 1) * Math.min(1, falta / guia.pie.recta) : 1;
    $("guiaDetalle").textContent = `Tu destino está a unos ${distanciaTexto(falta * rodeo)} caminando.`;
    return;
  }
  guia.fase = "fin";
  $("pasosPie").hidden = true;
  salirMapaPie();
  unaVez("destino", () => { vibrar([300, 120, 300, 120, 300]); decir(frase("llegaste"), `Estás en ${d.nombre}.`, "Llegaste"); });
}
$("aPieIr").addEventListener("click", () => { iniciarGuiaCaminando(estado.destino, estado.gps ?? estado.origen); pintarBotonSimulador(); });

// Modo feria: adentro del recinto no hay GPS, así que Grieta recorre sola el viaje con los mismos avisos.
let modoFeria = leer("grieta-feria", false) || new URLSearchParams(location.search).has("feria");
const sim = { reloj: null, pos: null, puntos: [], i: 0, espera: 0 };
function pintarBotonSimulador() {
  const b = $("simularCaminata");
  b.hidden = !modoFeria || !guia.activa;
  b.textContent = sim.reloj ? "Detener simulación" : "Simular caminata";
}
function detenerSimulador() {
  clearInterval(sim.reloj);
  sim.reloj = null;
  if (guia.activa !== undefined) pintarBotonSimulador();
}
function moverSimulado(lat, lon, speed) {
  sim.pos = { lat, lon };
  guia.alPosicion?.({ coords: { latitude: lat, longitude: lon, speed, heading: null, accuracy: 5 } });
}
// Parte la línea en pasos iguales para que los avisos salgan a la misma distancia que en la calle.
function muestrearLinea(linea, paso) {
  const salida = [linea[0]];
  for (let i = 1; i < linea.length; i++) {
    const [a, b] = [linea[i - 1], linea[i]], d = Grieta.metros(a[0], a[1], b[0], b[1]), n = Math.max(1, Math.round(d / paso));
    for (let k = 1; k <= n; k++) salida.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return salida;
}
function pasoSimulador() {
  if (!guia.activa) return detenerSimulador();
  if (guia.fase === "parada") {
    if (sim.claveRuta !== guia.rutaPie || !sim.puntos.length) {
      const meta = guia.camion?.recorrido[0] ?? guia.destino, desde = sim.pos ?? guia.previo ?? estado.gps ?? estado.origen;
      sim.puntos = muestrearLinea(guia.trazoPie ?? [[desde.lat, desde.lon], [meta.lat, meta.lon]], 9);
      sim.i = 0; sim.claveRuta = guia.rutaPie;
    }
    const p = sim.puntos[Math.min(sim.i++, sim.puntos.length - 1)];
    return moverSimulado(p[0], p[1], 1.4);
  }
  if (guia.fase === "esperando") { if (++sim.espera >= 5) { sim.espera = 0; subir(guia.actual); } return; }
  if (guia.fase === "camion") {
    const r = guia.camion.recorrido, p = r[Math.min(guia.actual + 1, r.length - 1)];
    return moverSimulado(p.lat, p.lon, 8);
  }
  if (guia.fase === "fin") {
    const d = guia.destino;
    if (d && Grieta.metros(sim.pos?.lat ?? d.lat, sim.pos?.lon ?? d.lon, d.lat, d.lon) > 30) moverSimulado(d.lat, d.lon, 1.4);
    return detenerSimulador();
  }
}
$("simularCaminata").addEventListener("click", () => {
  if (sim.reloj) return detenerSimulador();
  if (guia.reloj !== undefined) navigator.geolocation.clearWatch(guia.reloj);
  Object.assign(sim, { pos: guia.previo ?? estado.gps ?? null, puntos: [], i: 0, espera: 0, claveRuta: null });
  sim.reloj = setInterval(pasoSimulador, 1300);
  pintarBotonSimulador();
  pasoSimulador();
});
let toquesLogo = 0, tiempoLogo = 0;
document.querySelector("#ajustes .logo-ajustes").addEventListener("click", () => {
  const ahora = Date.now();
  toquesLogo = ahora - tiempoLogo < 800 ? toquesLogo + 1 : 1;
  tiempoLogo = ahora;
  if (toquesLogo < 5) return;
  toquesLogo = 0;
  modoFeria = !modoFeria;
  escribir("grieta-feria", modoFeria);
  avisarBreve(modoFeria ? "Modo feria activado" : "Modo feria desactivado");
  hablar(modoFeria ? "Modo feria activado" : "Modo feria desactivado");
});

// Avisos con la pantalla bloqueada: la API los manda por push a su hora. Hace falta la app instalada y el permiso;
// si algo falta, la guia sigue igual con voz y vibracion mientras la pantalla este encendida.
const cuando = (min, dias = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dias); d.setMinutes(min); return d.toISOString(); };
async function suscripcionPush() {
  if (!API || !("PushManager" in window) || !("Notification" in window)) return null;
  const permiso = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permiso !== "granted") return null;
  const { clave } = await llamar("/notificaciones/clave");
  const registro = await navigator.serviceWorker.ready;
  return (await registro.pushManager.getSubscription()) ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }));
}
async function programarAvisos(tramos) {
  try {
    const suscripcion = await suscripcionPush();
    if (!suscripcion) return;
    const ahora = ahoraMin();
    const avisos = tramos.filter((c) => c.sale - 5 > ahora).map((c) => ({ cuando: cuando(c.sale - 5), titulo: `La ${c.linea} pasa en 5 minutos`, texto: `Según el horario, a las ${hora(c.sale)}. Ve a la parada.` }));
    const ultimo = tramos.at(-1);
    if (ultimo.llega - 3 > ahora) avisos.push({ cuando: cuando(ultimo.llega - 3), titulo: textoFrase(frase("ya_casi_llegas")), texto: `Bajas en ${cruce(ultimo.baja)}. Prepárate y toca el timbre.` });
    if (!avisos.length || !guia.activa) return;
    await llamar("/notificaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suscripcion: suscripcion.toJSON(), avisos: avisos.slice(0, 6) }) });
    guia.push = suscripcion.endpoint;
  } catch {}
}
function cancelarAvisos() {
  if (!guia.push) return;
  llamar("/notificaciones/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: guia.push }) }).catch(() => {});
  guia.push = null;
}

// "Sal a tiempo": avisa 10 minutos antes y a la hora de salir para tomar el camion sin esperar de mas.
// Con la app instalada y el permiso llega por push aunque Grieta este cerrada; si no, la cuenta regresiva vive en el inicio.
async function programarSalida(t, que, boton, dias = 0, nombreDestino = null) {
  const destino = nombreDestino ?? estado.destino?.nombre ?? "tu destino";
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  escribir("grieta-salida", { t, que, destino, dia: fecha.toDateString() });
  pintarSalida();
  boton.disabled = true;
  boton.textContent = "Listo, te aviso";
  let push = false;
  try {
    const suscripcion = await suscripcionPush();
    const avisos = [[t - 10, `En 10 minutos sales a ${destino}`, `${que}. Sal a las ${hora(t)}.`], [t, `Ya es hora de salir a ${destino}`, `${que}. Sal ahora para no esperar de más.`]]
      .filter(([m]) => dias > 0 || m > ahoraMin()).map(([m, titulo, texto]) => ({ cuando: cuando(m, dias), titulo, texto }));
    if (suscripcion && avisos.length) {
      await llamar("/notificaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suscripcion: suscripcion.toJSON(), avisos }) });
      push = true;
    }
  } catch {}
  const mensaje = dias > 0
    ? (push ? `${textoDia(dias)} te aviso a las ${hora(t - 10)} y a las ${hora(t)}, aunque cierres Grieta.` : "Para avisarte otro día necesito permiso de notificaciones.")
    : push ? `Te aviso a las ${hora(Math.max(ahoraMin(), t - 10))} y a las ${hora(t)}, aunque cierres Grieta.` : `Te aviso a las ${hora(t)} mientras Grieta esté abierta.`;
  boton.insertAdjacentHTML("afterend", `<p class="nota">${mensaje}</p>`);
  hablar(mensaje, false, false);
}
let relojSalida;
function pintarSalida() {
  const s = leer("grieta-salida", null), caja = $("salidaInicio");
  clearInterval(relojSalida);
  if (!s || s.dia !== new Date().toDateString() || ahoraMin() > s.t + 15) { caja.hidden = true; return; }
  const falta = s.t - ahoraMin();
  caja.hidden = false;
  caja.innerHTML = `${miniFicha("tono-hospital", picto("qrobus"))}<span class="fila-texto"><strong>${falta > 0 ? `Sal en ${falta} ${falta === 1 ? "minuto" : "minutos"}` : "Ya es hora de salir"}</strong><span>A ${escapar(s.destino)}. ${escapar(s.que)}, a las ${hora(s.t)}</span></span>
    <button type="button" class="quitar" data-quitar-salida>Quitar</button>`;
  if (falta <= 0 && !s.dicho) { escribir("grieta-salida", { ...s, dicho: true }); vibrar([400, 150, 400]); hablar(`Ya es hora de salir a ${s.destino}.`); }
  relojSalida = setInterval(pintarSalida, 30000);
}
$("salidaInicio").addEventListener("click", (e) => {
  if (!e.target.closest("[data-quitar-salida]")) return;
  escribir("grieta-salida", null);
  pintarSalida();
});

// "Ya pasó" y "Viene lleno": lo que ve la gente en la parada, para quien espera ahí mismo
async function avisarParada(tipo) {
  const c = guia.camion;
  if (!c) return;
  const parada = c.recorrido[0];
  try {
    await llamar("/camiones/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, linea: c.linea, lat: parada.lat, lon: parada.lon }) });
  } catch {}
  const sig = siguienteDe(c.linea, parada);
  const texto = tipo === "paso"
    ? `Gracias. ${sig ? `Según el horario, la siguiente ${c.linea} pasa a las ${hora(sig)}.` : `No encontré otra ${c.linea} hoy en el horario.`}`
    : "Gracias. Se lo diré a quien espere aquí.";
  $("guiaDetalle").textContent = texto;
  hablar(texto, false, true);
}
const siguienteDe = (linea, parada) => Grieta.pasanAqui(parada.lat, parada.lon, hoyDia(), ahoraMin(), 80)
  .flatMap((x) => x.lineas).find((l) => l.linea === linea)?.horas.find((h) => h > ahoraMin() + 1);
$("yaPaso").addEventListener("click", () => avisarParada("paso"));
$("vieneLleno").addEventListener("click", () => avisarParada("lleno"));
async function avisosDeLaGente(lat, lon) {
  try { return await llamar(`/camiones/avisos?lat=${lat}&lon=${lon}&radio=150`); } catch { return []; }
}
// Mientras esperas, si alguien ya avisó de tu camion en esa parada, se te dice una vez
async function revisarAvisosParada() {
  const c = guia.camion;
  if (!c || !["parada", "esperando"].includes(guia.fase)) return;
  const de = (await avisosDeLaGente(c.recorrido[0].lat, c.recorrido[0].lon)).filter((a) => a.linea === c.linea);
  const paso = de.find((a) => a.tipo === "paso" && a.minutos <= 10);
  const lleno = de.find((a) => a.tipo === "lleno" && a.minutos <= 10);
  if (paso) unaVez(`gente-paso-${guia.k}`, () => {
    const sig = siguienteDe(c.linea, c.recorrido[0]);
    decir(`Alguien avisó que la ${c.linea} ya pasó`, [`Hace ${paso.minutos || "menos de un"} minuto${paso.minutos === 1 ? "" : "s"}.`, sig ? [" ", frase("siguiente", { hora: hora(sig) })] : ""], "En la parada");
  });
  else if (lleno) unaVez(`gente-lleno-${guia.k}`, () => decir(`Alguien avisó que la ${c.linea} viene llena`, frase("espera_siguiente"), "En la parada"));
}


// La linea recta engaña cuando hay que rodear: se mide por calles al empezar a caminar
// y mientras avanzas se estima lo que falta con la misma proporcion.
function medirCaminata(desde, parada) {
  guia.pie = null;
  if (!desde) return;
  const recta = Math.max(1, Grieta.metros(desde.lat, desde.lon, parada.lat, parada.lon));
  caminoAPie([desde.lat, desde.lon], [parada.lat, parada.lon]).then(async (c) => {
    await Promise.race([c?.listo, new Promise((r) => setTimeout(r, 1500))]);
    if (!c || !guia.activa || guia.fase !== "parada") return;
    guia.pie = { metros: c.metros, recta };
    const texto = `Son ${distanciaTexto(c.metros)} caminando, unos ${minutosCaminando(c.metros * (c.factor ?? 1))} minutos${pendienteTexto(c) ? `, ${enVoz(pendienteTexto(c))}` : ""}.`;
    $("guiaDetalle").textContent = `${texto} ${Interfaz.original($("guiaDetalle"))}`;
    hablar(texto, true);
  });
}

// A partir de 3.5 m/s (12.6 km/h) se va en vehiculo: caminando por la avenida de la ruta no cuenta como subirse.
const VELOCIDAD_CAMION = 3.5;
function avanzarCamion(lat, lon, velocidad = 0) {
  const c = guia.camion;
  const r = c.recorrido;
  const final = r.at(-1);
  const ultimo = guia.k === guia.tramos.length - 1;
  const d = r.map((x) => Grieta.metros(lat, lon, x.lat, x.lon));
  if (guia.fase === "parada" || guia.fase === "esperando") {
    if (guia.fase === "parada") avanzarPie(lat, lon);
    if (guia.fase === "parada" && d[0] < 40) {
      // La parada de enfrente suele estar a 20-40 m: antes de decir que llegaste se revisa el lado de la calle.
      const lado = Grieta.revisarParada({ lat, lon, precision: guia.precision ?? 15, objetivo: { ...r[0], linea: c.linea, hacia: c.hacia } });
      if (lado.estado === "enfrente") {
        unaVez(`enfrente-${guia.k}`, () => { vibrar([200, 100, 200, 100, 200]); decir("Parece la parada de enfrente", textoRevision(lado, c).flatMap((t, n) => (n ? [" ", t] : [t])), "Hacia la parada", true); });
        return;
      }
      $("pasosPie").hidden = true;
      guia.fase = "esperando";
      salirMapaPie();
      vibrar([300, 120, 300]);
      decir(frase("llegaste_parada"), [`${r[0].nombre}. `, frase("espera_linea", { linea: c.linea, hacia: c.hacia }), "; ", frase("horario_pasa", { hora: hora(c.sale) }), ". ", frase("aviso_pasar")], "En la parada");
      leerReferencias(r[0]);
    }
    // Si ya va por la ruta del camion, lejos de la parada de subida, se subio.
    const masCerca = d.indexOf(Math.min(...d));
    if (!guia.soloParada && masCerca >= 1 && d[masCerca] < 90 && velocidad >= VELOCIDAD_CAMION) subir(masCerca);
    else if (guia.fase === "parada" && !guia.enApp) {
      // El rodeo pesa menos conforme te acercas: junto a la parada la linea recta ya es casi el camino
      const rodeo = guia.pie ? 1 + (guia.pie.metros / guia.pie.recta - 1) * Math.min(1, d[0] / guia.pie.recta) : 1;
      const resta = guia.pie ? Math.max(d[0], d[0] * rodeo) : null;
      $("guiaDetalle").textContent = resta ? `La parada está a unos ${distanciaTexto(resta)} caminando.` : `La parada está a ${distanciaTexto(d[0])} en línea recta.`;
    }
    return;
  }
  // Ya abajo del ultimo camion se sigue hasta el destino para decir que llegaste.
  if (guia.fase === "fin") {
    const dest = guia.destino;
    if (dest && Grieta.metros(lat, lon, dest.lat, dest.lon) < 40) {
      unaVez("destino", () => { vibrar([300, 120, 300, 120, 300]); decir(frase("llegaste"), `Estás en ${dest.nombre}.${guia.km ? ` Este viaje: ${kgTexto(co2Auto(guia.km))} de CO₂ que no emitió un auto.` : ""} Toca Terminar viaje cuando quieras.`, "Llegaste"); });
    }
    return;
  }
  if (guia.fase !== "camion") return;
  for (let i = guia.actual + 1; i < r.length; i++) if (d[i] < 90 && d[i] <= d[guia.actual]) guia.actual = i;
  const faltan = r.length - 1 - guia.actual;
  const clave = (x) => `${x}-${guia.k}`;
  if (faltan === 0 || d.at(-1) < 60) {
    unaVez(clave("llegaste"), () => {
      vibrar([900, 200, 900]);
      if (!ultimo) {
        // Transbordo: la siguiente linea empieza como una parada nueva.
        const sig = guia.tramos[guia.k + 1];
        Object.assign(guia, { k: guia.k + 1, camion: sig, fase: "parada", actual: 0, enApp: false });
        $("yaMeSubi").hidden = false;
        decir(frase("transbordo"), `Camina a ${sig.recorrido[0].nombre} y toma la línea ${sig.linea} hacia ${sig.hacia}, a las ${hora(sig.sale)} según el horario.`, "Transbordo", true);
        medirCaminata({ lat, lon }, sig.recorrido[0]);
        return;
      }
      // Cuenta para la racha si el GPS te vio en la ruta o junto a tu parada de bajada.
      const verificado = d.at(-1) < 60 || guia.actual >= 2;
      guia.fase = "fin";
      guia.actual = r.length - 1;
      if (verificado && !guia.soloParada) mostrarRachaViaje(contarViajeRacha(guia.destino, c.linea));
      mostrarComoFue();
      $("yaMeSubi").hidden = true;
      const fin = guia.o.pasos.at(-1);
      decir(frase("bajate"), `${final.nombre}. ${fin.tipo === "caminar" ? `Después camina unos ${Math.max(1, Math.round(fin.min))} minutos a tu destino.` : `Después pide ${Grieta.nombreApp(fin.app)} a tu destino.`}`, "Tu parada", true);
    });
  } else if (faltan === 1) {
    unaVez(clave("una"), () => { vibrar([700, 150, 700]); decir(frase("siguiente_parada"), `Toca el timbre ahora. Bajas en ${final.nombre}.`, "Próxima parada", true); });
  } else if (faltan === 2) {
    unaVez(clave("dos"), () => { vibrar([400, 150, 400]); decir(frase("dos_paradas"), `Prepárate. Tu parada es ${final.nombre}.`, "En el camión"); });
  } else {
    // En pantalla siempre; en voz cada 5 paradas y en cada una de las ultimas 5.
    ponerTitulo(frase("faltan_paradas", { n: faltan }));
    $("guiaDetalle").textContent = `Vas por ${cruce(r[guia.actual].nombre)}.`;
    pintarGuia();
    if (faltan <= 5 || faltan % 5 === 0) unaVez(clave(`faltan${faltan}`), () => decir(frase("faltan_paradas", { n: faltan }), `Vas por ${r[guia.actual].nombre}.`, "En el camión"));
  }
}

function subir(desde = 0) {
  if (guia.fase === "camion") return;
  guia.fase = "camion";
  guia.actual = desde;
  $("yaMeSubi").hidden = true;
  const r = guia.camion.recorrido;
  const faltan = r.length - 1 - desde;
  guia.dichos.add(`faltan${faltan}-${guia.k}`);
  decir(frase("faltan_paradas", { n: faltan }), `Vas en la ${guia.camion.linea}. Te aviso dos paradas antes de bajar.`, "En el camión");
}
$("yaMeSubi").addEventListener("click", () => subir(guia.actual));

// Terminar a medio camino apaga los avisos de bajar: se confirma con un segundo toque. Al llegar, no.
function restaurarTerminar() {
  delete $("terminar").dataset.confirmar;
  $("terminar").lastChild.textContent = textoFrase(frase("terminar"));
}
$("terminar").addEventListener("click", () => {
  if (guia.activa && guia.fase !== "fin" && !$("terminar").dataset.confirmar) {
    $("terminar").dataset.confirmar = "1";
    $("terminar").lastChild.textContent = "Toca otra vez";
    hablar(frase("confirmar_fin"), false, true);
    clearTimeout(guia.confirmar);
    guia.confirmar = setTimeout(restaurarTerminar, 5000);
    return;
  }
  clearTimeout(guia.confirmar);
  restaurarTerminar();
  terminarGuia();
  history.back();
});
// Compartir en la guia: manda a donde vas, en que camion, a que hora llegas y donde estas.
function compartirGuia() {
  const destino = guia.destino?.nombre ?? estado.destino?.nombre ?? "mi destino";
  const c = guia.camion, aqui = guia.previo ?? estado.gps;
  const texto = guia.dichos?.has("destino")
    ? `Ya llegué a ${destino}.`
    : `Voy a ${destino}${c ? ` en la ${c.linea} hacia ${c.hacia}. Llego como a las ${hora(guia.tramos?.at(-1)?.llega ?? c.llega)}` : ""}.`;
  const mensaje = aqui ? `${texto} Estoy aquí: https://www.google.com/maps?q=${aqui.lat.toFixed(5)},${aqui.lon.toFixed(5)}` : texto;
  if (navigator.share) return void navigator.share({ title: "Mi viaje", text: mensaje }).catch(() => {});
  navigator.clipboard?.writeText(mensaje).then(() => hablar("Copié tu viaje para que lo pegues en un mensaje."), () => {});
}
$("compartirGuia").addEventListener("click", compartirGuia);
$("reportarInicio").addEventListener("click", () => abrirReporte());

// "¿Cómo te fue?" al bajar: una respuesta por linea del viaje, sin ubicacion. Arma el mapa de estres de Qro al dia.
function mostrarComoFue() {
  const caja = $("comoTeFue");
  caja.hidden = false;
  caja.querySelectorAll("[data-sentir]").forEach((b) => { b.disabled = false; b.removeAttribute("aria-pressed"); });
  caja.querySelector(".nota").textContent = "Solo se guarda la línea y la hora, nunca dónde estás. Se suma a Qro al día.";
}
$("comoTeFue").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sentir]");
  if (!b || b.disabled) return;
  const lineas = [...new Set((guia.tramos ?? []).map((t) => t.linea))].slice(0, 3);
  $("comoTeFue").querySelectorAll("[data-sentir]").forEach((x) => { x.disabled = true; x.setAttribute("aria-pressed", String(x === b)); });
  for (const linea of lineas) {
    llamar("/sentir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linea, valor: b.dataset.sentir }) }).catch(() => {});
  }
  $("comoTeFue").querySelector(".nota").textContent = "Gracias. Con tu respuesta la ciudad ve qué líneas y horas estresan más.";
  hablar("Gracias por contarnos.", false, false);
});
function terminarGuia() {
  detenerSimulador();
  clearTimeout(guia.confirmar);
  guia.pasosPie = null;
  salirMapaPie();
  capas.flecha?.remove(); capas.flecha = null;
  guia.ultimo = null; guia.rumbo = null; guia.trazoPie = null; guia.avisoPie = 0;
  $("pasosPie").hidden = true;
  cancelarAvisos();
  restaurarTerminar();
  if (!$("chofer").hidden) tarjetaChofer(false);
  if (guia.reloj !== undefined) navigator.geolocation.clearWatch(guia.reloj);
  guia.reloj = undefined;
  clearInterval(guia.horario);
  guia.wake?.release?.();
  guia.activa = false;
  viajeEnCurso = false;
  guia.camion = null;
  guia.soloCaminar = false;
  capas.aqui?.remove();
  capas.aqui = null;
  document.body.classList.remove("alerta");
  detenerVoz();
}

// Viajes recientes en el inicio: los ultimos destinos con avisos, para repetirlos con un toque.
let viajes = leer("grieta-viajes", []);
function registrarViaje(o) {
  const { destino: d } = estado;
  viajes = [{ destino: { nombre: d.nombre, lat: d.lat, lon: d.lon, tipo: d.tipo }, camino: tituloOpcion(o), fecha: new Date().toISOString() }]
    .concat(viajes.filter((v) => v.destino.nombre !== d.nombre)).slice(0, 20);
  escribir("grieta-viajes", viajes);
  // Historial sin juntar repetidos: de aqui salen la rutina y lo ahorrado. Solo en el telefono.
  const app = Math.min(...estado.r.directo.porApp.map((x) => x.precio));
  const ahorro = o.tipo === "app" ? 0 : Math.max(0, Math.round(app - o.costo));
  const co2 = sinAuto(o) ? Math.round(co2Auto(estado.r.directo.km)) : 0;
  const camiones = Number.isInteger(o.transbordos) ? o.transbordos + 1 : 0;
  historial = [{ nombre: d.nombre, lat: d.lat, lon: d.lon, fecha: new Date().toISOString(), ahorro, co2, camiones }].concat(historial).slice(0, 80);
  escribir("grieta-historial", historial);
}
let historial = leer("grieta-historial", []);

// Rutina: si ya fuiste a un lugar al menos dos veces en dias parecidos (entre semana o fin) y a una hora
// parecida, el inicio lo ofrece con un toque. Nada sale del telefono.
function rutinaSugerida() {
  const ahora = new Date();
  const finde = (d) => d.getDay() === 0 || d.getDay() === 6;
  const minutoDe = (d) => d.getHours() * 60 + d.getMinutes();
  const cerca = (a, b) => Math.min(Math.abs(a - b), 1440 - Math.abs(a - b)) <= 60;
  const veces = new Map();
  for (const h of historial) {
    const f = new Date(h.fecha);
    if (ahora - f > 60 * 864e5 || finde(f) !== finde(ahora) || !cerca(minutoDe(f), minutoDe(ahora))) continue;
    const x = veces.get(h.nombre) ?? { ...h, n: 0 };
    x.n++;
    veces.set(h.nombre, x);
  }
  const yo = estado.gps ?? estado.origen;
  const lejos = (x) => !yo || Grieta.metros(yo.lat, yo.lon, x.lat, x.lon) > 500;
  const deHistorial = [...veces.values()].filter((x) => x.n >= 2 && lejos(x)).sort((a, b) => b.n - a.n)[0];
  return deHistorial ?? null;
}
function pintarRutina() {
  const r = rutinaSugerida();
  $("vozRutina").hidden = !r;
  if (!r) return;
  $("vozRutina").querySelector("span").textContent = `Ir a ${r.nombre}`;
  estado.rutina = { nombre: r.nombre, lat: r.lat, lon: r.lon };
}
$("vozRutina").addEventListener("click", () => { hablar(frase("vamos_lugar", { lugar: estado.rutina.nombre })); irA({ ...estado.rutina }); });

// Lo ahorrado este mes por ir en camion en vez de la app mas barata.
function pintarAhorro() {
  // Mes en hora local: en UTC el ultimo dia del mes en la noche ya cuenta como el siguiente.
  const hoy = new Date();
  const delMes = historial.filter((h) => { const f = new Date(h.fecha); return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth(); });
  const total = delMes.reduce((s, h) => s + (h.ahorro || 0), 0);
  // Una meta de CO₂ se dice una sola vez, la primera vez que el inicio la muestra.
  const acumulado = historial.reduce((s, h) => s + (h.co2 || 0), 0);
  const meta = [100, 50, 25, 10, 5, 1].find((kg) => acumulado >= kg * 1000);
  const nuevaMeta = meta && meta > leer("grieta-meta-co2", 0) ? meta : null;
  if (nuevaMeta) { escribir("grieta-meta-co2", nuevaMeta); hablar(`Llevas ${nuevaMeta} kilos de CO₂ que no emitió un auto.`); }
  const texto = `<b>${total >= 1 ? pesos(total) : "Tu ahorro"}</b><small>${total >= 1 ? "ahorrados este mes" : "y qué bono te conviene"}</small>`;
  const caja = $("ahorroMes").querySelector(".pastilla-texto");
  if (caja.innerHTML !== texto) caja.innerHTML = texto;
}
// Lo de todos: cada viaje en camion empezado con la guia manda solo sus km; la API los suma.
const contarViaje = (km) => llamar("/viajes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ km: Math.round(km * 10) / 10 }) })
  .then(() => { estado.impactoLeido = 0; }).catch(() => {});
function pintarPastillaCo2() {
  const g = estado.impacto?.g;
  const texto = `<b>${g ? kgTexto(g) : "Tu CO₂"}</b><small>${g ? "de CO₂ evitados" : "lo que evitamos"}</small>`;
  const caja = $("impactoTodos").querySelector(".pastilla-texto");
  if (caja.innerHTML !== texto) caja.innerHTML = texto;
}
// Las dos pastillas ocupan su lugar desde el primer cuadro: la red solo cambia el numero, nunca el acomodo.
async function pintarImpacto() {
  if (!API || Date.now() - (estado.impactoLeido ?? 0) < 5 * 60 * 1000) return;
  estado.impactoLeido = Date.now();
  try {
    const { co2_kg, viajes: n, km } = await llamar("/impacto");
    if (!co2_kg) return;
    estado.impacto = { g: co2_kg * 1000, viajes: n, km };
    escribir("grieta-impacto", estado.impacto);
    pintarPastillaCo2();
  } catch { estado.impactoLeido = 0; }
}
// Equivalencias de la EPA (arbol urbano joven, 60 kg de CO₂ al ano; 8,887 g por galon de gasolina) y de Notz y Stroeve 2016 (3 m² de hielo artico por tonelada).
const ARBOL_G_DIA = 60000 / 365, GASOLINA_G_LITRO = 8887 / 3.785, HIELO_CM2_G = 0.03;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function tiempoArbol(g) {
  const dias = g / ARBOL_G_DIA;
  if (dias < 60) return plural(Math.max(1, Math.round(dias)), "día", "días");
  if (dias < 730) return plural(Math.round(dias / 30.4), "mes", "meses");
  return `${+(dias / 365).toFixed(1)} años`;
}
function equivalencias(g) {
  const litros = g / GASOLINA_G_LITRO, cm2 = g * HIELO_CM2_G;
  return [
    ["parque", tiempoArbol(g), "de lo que absorbe un árbol joven"],
    ["gasolina", `${litros < 10 ? litros.toFixed(1) : Math.round(litros)} L`, "de gasolina sin quemar"],
    ["hielo", cm2 < 1000 ? `${Math.round(cm2)} cm²` : `${+(cm2 / 10000).toFixed(cm2 < 100000 ? 2 : 1)} m²`, "de hielo ártico, casa del oso polar"],
  ];
}
// Doce lugares en los cerros de Figma: cada arbol es un mes de trabajo de un arbol joven, o un ano si ya pasamos de doce meses.
function pintarBosque(g) {
  const dias = g / ARBOL_G_DIA, porAnio = dias > 360, llenos = dias / (porAnio ? 365 : 30.4), lugares = ARTE_ESC.lugares;
  // El radio del punto de Figma dice que tan atras esta: los de atras se dibujan mas chicos.
  const plantas = lugares.map(([x, y, r], i) => {
    const avance = Math.min(1, Math.max(0, llenos - i)), s = r / 8.5;
    const tipo = `${i % 2 ? "sabino" : "mezquite"}-${avance >= 1 ? "grande" : avance > 0 ? "arbolito" : "brote"}`;
    return `<g transform="translate(${(x - 60 * s).toFixed(1)} ${(y - 160 * s).toFixed(1)}) scale(${s.toFixed(3)})">${ARTE_ESC.arbol[tipo]}</g>`;
  }).join("");
  const sobra = llenos >= lugares.length + 1 ? `<text class="sobra" x="28" y="62">+${Math.floor(llenos) - lugares.length}</text>` : "";
  $("bosque").innerHTML = `${ARTE_ESC.bosque[horario()]}${plantas}${sobra}`;
  const hechos = Math.min(lugares.length, Math.floor(llenos));
  $("bosque").setAttribute("aria-label", `${plural(hechos, "árbol", "árboles")} y ${lugares.length - hechos} brotes en un cerro`);
  $("co2Unidad").innerHTML = `<span class="leyenda-arbol"><svg viewBox="0 0 120 160" aria-hidden="true">${ARTE_ESC.arbol["mezquite-grande"]}</svg><span><b>Cada árbol</b> es el CO₂ que absorbe uno joven en un ${porAnio ? "año" : "mes"}</span></span>`;
}
// Ocho semanas de los viajes propios en camion, de lunes a domingo; las vacias quedan como raya tenue.
function pintarSemanas(propio, viajesPropios) {
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const semanas = Array.from({ length: 8 }, (_, i) => { const d = new Date(lunes); d.setDate(d.getDate() - 7 * (7 - i)); return { d, g: 0 }; });
  for (const h of historial) {
    const i = Math.floor((new Date(h.fecha) - semanas[0].d) / (7 * 864e5));
    if (i >= 0 && i < 8) semanas[i].g += h.co2 || 0;
  }
  const max = Math.max(...semanas.map((x) => x.g));
  $("co2Tuyo").textContent = propio ? `${kgTexto(propio)} en ${plural(viajesPropios, "viaje", "viajes")}` : "";
  $("co2Semanas").toggleAttribute("hidden", !max);
  $("co2Vacio").hidden = !!max;
  if (!max) return;
  const fecha = (d) => `${d.getDate()} ${MESES[d.getMonth()]}`;
  $("co2Semanas").innerHTML = semanas.map((x, i) => {
    const alto = x.g ? Math.max(6, (x.g / max) * 72) : 3, cx = 20 + i * 40, ultima = i === 7;
    return `<rect class="barra${x.g ? "" : " vacia"}${ultima ? " actual" : ""}" x="${cx - 13}" y="${96 - alto}" width="26" height="${alto}" rx="${Math.min(6, alto / 2)}"/>
      ${x.g ? `<text class="valor" x="${cx}" y="${89 - alto}" text-anchor="middle">${(x.g / 1000).toFixed(1)}</text>` : ""}
      <text class="dia${ultima ? " actual" : ""}" x="${cx}" y="114" text-anchor="middle">${ultima ? "Esta" : i % 2 ? fecha(x.d) : ""}</text>`;
  }).join("");
  $("co2Semanas").setAttribute("aria-label", `Kilos de CO₂ evitados por semana: ${semanas.map((x) => `${fecha(x.d)}, ${(x.g / 1000).toFixed(1)}`).join("; ")}`);
}
// El tlacuache de cada quien: su ciudad sana con los kilos de CO₂ que evitan sus propios viajes en camion.
// El arte viene de Figma (tlacuache-arte.js): lienzo de 400 x 300 con los pies en y=259; aqui se escala para que
// ocupe lo mismo que el dibujo anterior (pies en y=0, unas 128 unidades de ancho). Los accesorios ya vienen en su lugar.
const ESCALA_TL = 0.36;
// De noche, si tiene los ojos abiertos, se duerme: los ojos se le cierran y le salen unas "z".
function tlacuache(e, puestos = racha.puestos, dormido = horario() === "noche", pelaje = pelajeActual()) {
  const estado = e >= 6 ? "crias" : e >= 5 ? "comiendo" : e >= 4 ? "contento" : e < 2 ? "preocupado" : "normal";
  const duerme = dormido && (estado === "normal" || estado === "preocupado");
  const lleva = (lugar) => ARTE_TL.acc[puestos?.[lugar]] ?? "";
  const listones = puestos?.cabeza === "listones";
  const zzz = duerme ? '<g class="an-zzz"><text x="322" y="100">z</text><text x="350" y="64">z</text><text x="384" y="20">Z</text></g>' : "";
  return `<g class="tlacuache${duerme ? " dormido" : ""}" transform="translate(-2 0) scale(${ESCALA_TL}) translate(-193 -259)">${listones ? ARTE_TL.acc["listones-atras"] : ""}${dibujoPelaje(estado, pelaje)}${lleva("espalda")}${lleva("cuello")}${lleva("cara")}${listones ? ARTE_TL.acc["listones-frente"] : lleva("cabeza")}${zzz}</g>`;
}
// Mañana, día o noche según la hora real; los escenarios de Figma vienen en los tres horarios.
function horario(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 6 && h < 11 ? "manana" : h >= 11 && h < 19 ? "dia" : "noche";
}
// El mundo del tlacuache (Figma, 720x440): cada etapa enciende sus capas encima del fondo de la hora.
function escenaTlacuache(e) {
  const M = ARTE_ESC.mundo, hora = horario(), capa = (si, nombre, extra = "") => (si ? `<g${extra}>${M[nombre]}</g>` : "");
  return M[hora] + capa(e < 3, "humo", e < 1 ? "" : ' opacity=".5"') + capa(e >= 2, "pasto", hora === "noche" ? ' opacity=".55"' : "") + capa(e >= 4, "arboles") + capa(e >= 2, "arbol")
    + M[e >= 3 ? "fuente-limpia" : "fuente-sucia"] + capa(e >= 1, "bote") + capa(e < 1, "basura") + capa(e >= 5, "nopal") + capa(e >= 4, "flores")
    + capa(e >= 4, hora === "noche" ? "luciernagas" : "aves", hora === "noche" ? ' class="an-luciernagas"' : ' class="an-aves"')
    + `<g transform="translate(360 408) scale(${(0.8 / ESCALA_TL).toFixed(3)})">${tlacuache(e)}</g>`;
}
// Racha semanal en camion, como la de Duolingo pero por semana: cada quien pone su meta y una semana mala
// se cubre con un protector. Solo cuentan viajes que la guia confirmo por GPS, maximo 4 al dia.
// Las tunas se ganan con esos viajes y se gastan en accesorios del tlacuache; nunca con dinero.
const ACCESORIOS = {
  flor: { nombre: "Flor de cempasúchil", nota: "La del Día de Muertos", precio: 3, lugar: "cabeza" },
  paliacate: { nombre: "Paliacate", nota: "Rojo, con sus puntitos", precio: 5, lugar: "cuello" },
  listones: { nombre: "Listones de colores", nota: "Como los de la muñeca Lele de Amealco", precio: 10, lugar: "cabeza" },
  lentes: { nombre: "Lentes de sol", nota: "Para el sol de Querétaro", precio: 15, lugar: "cara" },
  palma: { nombre: "Sombrero de palma", nota: "Tejido a mano", precio: 20, lugar: "cabeza" },
  morral: { nombre: "Morral otomí", nota: "Bordado como los de Amealco", precio: 30, lugar: "espalda" },
  rebozo: { nombre: "Rebozo", nota: "De rayas, con su fleco", precio: 40, lugar: "espalda" },
  charro: { nombre: "Sombrero de charro", nota: "El de gala, con galón dorado", precio: 60, lugar: "cabeza" },
};
// Lo que se compro en la primera version de la tienda se cambia por su equivalente.
const ACCESORIOS_VIEJOS = { gorra: "palma", sombrero: "charro", mochila: "morral" };
const VIAJE_TUNAS = 1, SEMANA_TUNAS = 2, TOPE_DIA = 4;
const racha = Object.assign({ meta: 3, viajes: [], protectores: 1, usados: [], premiadas: [], tunas: 0, compras: [], puestos: {}, mes: "" }, leer("grieta-racha", {}));
const guardarRacha = () => escribir("grieta-racha", racha);
// Antes cada viaje daba 10 tunas; ahora 1 y los precios bajaron igual. Lo ganado se pasa a la escala nueva una vez.
function tunasEnEscala(r) {
  if (!r || r.escala === 1) return r;
  return { ...r, tunas: Math.round((r.tunas ?? 0) / 10), escala: 1 };
}
Object.assign(racha, tunasEnEscala(racha));
// Colores reales documentados en Didelphis (Therya Notes 2024 y 2025) y un alebrije que se compra con tunas.
const ALEBRIJE_TUNAS = 80;
const PELAJES = {
  gris: { nombre: "Gris", nota: "El más común.", tonos: {} },
  oscuro: { nombre: "Oscuro", nota: "Común en México.", tonos: { "#A7A4A8": "#4A454C", "#C9C6C8": "#6B656E", "#8B878D": "#38343A", "#625B61": "#2C292E", "#494247": "#1F1C20", "#F4F1EA": "#D9D3CB", "#DED8CF": "#BDB6AD" } },
  canela: { nombre: "Canela", nota: "Muy raro: en México se documentó por primera vez en 2024.", tonos: { "#A7A4A8": "#B9804E", "#C9C6C8": "#D6A475", "#8B878D": "#97643A", "#625B61": "#7A4F2C", "#494247": "#5B3A22", "#F4F1EA": "#F6E6CF", "#DED8CF": "#E3CBA9" } },
  blanco: { nombre: "Blanco", nota: "Muy raro: en México solo se ha documentado en la Península de Yucatán.", tonos: { "#A7A4A8": "#EDE9E1", "#C9C6C8": "#FAF7F1", "#8B878D": "#D3CEC5", "#625B61": "#BDB8AF", "#494247": "#D9BFBE", "#F4F1EA": "#FDFBF6", "#DED8CF": "#EDE8DF" } },
  alebrije: { nombre: "Alebrije", nota: "Este no existe en la naturaleza: es puro arte mexicano.", tonos: { "#A7A4A8": "#E8456B", "#C9C6C8": "#F5A623", "#8B878D": "#2FA9B8", "#625B61": "#3B4FC0", "#494247": "#6A2FB5", "#F4F1EA": "#F7D23E", "#DED8CF": "#EF9F24", "#E58A9A": "#2FA36B", "#E7BDB3": "#A6E05A", "#C88791": "#1E7D52" } },
};
// Vista previa del alebrije antes de comprarlo; se olvida al salir de la pantalla.
let pelajeVista = null;
const pelajeActual = () => pelajeVista ?? (PELAJES[racha.pelaje] && (racha.pelaje !== "alebrije" || racha.alebrije) ? racha.pelaje : "gris");
const artePelaje = new Map();
function dibujoPelaje(estado, pelaje) {
  const clave = `${pelaje}-${estado}`;
  if (!artePelaje.has(clave)) {
    const { tonos } = PELAJES[pelaje], alebrije = pelaje === "alebrije";
    artePelaje.set(clave, ARTE_TL.estados[estado].replace(/#[0-9a-f]{6}/gi, (c) => tonos[c.toUpperCase()] ?? c)
      .replace("@@CUERPO@@", alebrije ? ARTE_TL.alebrije.cuerpo : "").replace("@@CARA@@", alebrije ? ARTE_TL.alebrije.cara : ""));
  }
  return artePelaje.get(clave);
}
function pintarPelajes() {
  const actual = pelajeActual(), bloqueado = actual === "alebrije" && !racha.alebrije, falta = ALEBRIJE_TUNAS - racha.tunas;
  $("pelajes").innerHTML = Object.entries(PELAJES).map(([id, p]) => `<button type="button" data-pelaje="${id}" aria-pressed="${id === actual}" aria-label="${p.nombre}${id === "alebrije" && !racha.alebrije ? `, ${plural(ALEBRIJE_TUNAS, "tuna", "tunas")}` : ""}"><svg viewBox="-72 -84 140 88" aria-hidden="true">${tlacuache(3, racha.puestos, false, id)}</svg><span>${p.nombre}</span></button>`).join("");
  $("pelajeNota").textContent = PELAJES[actual].nota;
  $("pelajeComprar").hidden = !bloqueado;
  $("pelajeComprar").disabled = falta > 0;
  $("pelajeComprar").textContent = falta > 0 ? `Te faltan ${plural(falta, "tuna", "tunas")}` : `Comprar por ${ALEBRIJE_TUNAS} tunas`;
}
racha.compras = [...new Set(racha.compras.map((id) => ACCESORIOS_VIEJOS[id] ?? id).filter((id) => ACCESORIOS[id]))];
for (const [lugar, id] of Object.entries(racha.puestos)) racha.puestos[lugar] = ACCESORIOS[ACCESORIOS_VIEJOS[id] ?? id] ? ACCESORIOS_VIEJOS[id] ?? id : null;
const lunes = (f) => { const d = new Date(f); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const claveSemana = (f) => { const d = lunes(f); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const viajesDeSemana = (clave) => racha.viajes.filter((v) => claveSemana(v.f) === clave).length;
// Un protector nuevo cada mes, sin juntar mas de dos.
function protectorDelMes() {
  const mes = new Date().toISOString().slice(0, 7);
  if (racha.mes === mes) return;
  if (racha.mes) racha.protectores = Math.min(2, racha.protectores + 1);
  racha.mes = mes;
  guardarRacha();
}
// Semanas seguidas cumplidas; una semana pasada sin cumplir gasta un protector si hay.
function semanasSeguidas() {
  if (!racha.viajes.length) return 0;
  const primera = lunes(racha.viajes.at(-1).f), actual = claveSemana(new Date());
  let n = viajesDeSemana(actual) >= racha.meta ? 1 : 0;
  for (const d = lunes(new Date()); ;) {
    d.setDate(d.getDate() - 7);
    if (d < primera) break;
    const k = claveSemana(d);
    if (viajesDeSemana(k) >= racha.meta || racha.usados.includes(k)) { n++; continue; }
    if (racha.protectores > 0) { racha.protectores--; racha.usados.push(k); guardarRacha(); n++; continue; }
    break;
  }
  return n;
}
// Se llama cuando la guia confirma por GPS que el viaje en camion se hizo.
function contarViajeRacha(destino, linea) {
  const hoy = new Date().toDateString();
  if (racha.viajes.filter((v) => new Date(v.f).toDateString() === hoy).length >= TOPE_DIA) return null;
  racha.viajes.unshift({ f: new Date().toISOString(), destino: destino?.nombre ?? "", lat: destino?.lat, lon: destino?.lon, linea });
  racha.viajes = racha.viajes.slice(0, 400);
  racha.tunas += VIAJE_TUNAS;
  const semana = claveSemana(new Date()), cuenta = viajesDeSemana(semana);
  let cumplida = false;
  if (cuenta >= racha.meta && !racha.premiadas.includes(semana)) { racha.premiadas.push(semana); racha.tunas += SEMANA_TUNAS; cumplida = true; }
  // Dos viajes de mas en la semana regalan un protector.
  if (cuenta === racha.meta + 2 && racha.protectores < 2) racha.protectores++;
  guardarRacha();
  return { cuenta, cumplida, semanas: semanasSeguidas(), tunas: VIAJE_TUNAS + (cumplida ? SEMANA_TUNAS : 0) };
}
// Animo del tlacuache: contento si ya cumpliste la semana; preocupado de jueves en adelante si faltan viajes.
function animoRacha() {
  const cuenta = viajesDeSemana(claveSemana(new Date())), dia = (new Date().getDay() + 6) % 7;
  return cuenta >= racha.meta ? 5 : dia >= 3 && racha.viajes.length ? 1 : 3;
}
// Para el aviso del jueves: el destino al que mas vas en camion.
function destinoFrecuente() {
  const cuenta = new Map();
  for (const v of racha.viajes.slice(0, 40)) if (v.destino) cuenta.set(v.destino, (cuenta.get(v.destino) ?? 0) + 1);
  return [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
// Al terminar: solo en pantalla, nunca en voz, para no confundir en modo Voz.
function mostrarRachaViaje(r) {
  const caja = $("guiaRacha");
  caja.hidden = !r || acc.modoVoz;
  if (caja.hidden) return;
  caja.innerHTML = `<svg class="tl-salta" viewBox="-70 -80 136 84" aria-hidden="true">${tlacuache(r.cumplida ? 5 : 4)}</svg><span><strong>+${plural(r.tunas, "tuna", "tunas")}</strong>${r.cumplida ? `Semana cumplida. Llevas ${plural(r.semanas, "semana", "semanas")}.` : `Esta semana: ${r.cuenta} de ${plural(racha.meta, "viaje", "viajes")}.`}</span>`;
}
// De noche, cuando ya no pasan camiones, el tlacuache se duerme en lugar de un aviso seco.
const yaNoPasan = (minuto = ahoraMin()) => { const h = Math.floor(minuto / 60) % 24; return h >= 21 || h < 5; };
function tlacuacheDormido(texto, detalle = "") {
  return `<div class="tl-dormido" role="status"><svg viewBox="-84 -108 168 112" aria-hidden="true">${tlacuache(3, racha.puestos, true)}</svg><span><strong>${texto}</strong>${detalle ? `<small>${detalle}</small>` : ""}</span></div>`;
}
// Inicio: el tlacuache en su escena de la hora, y abajo el titulo con una raya por semana; la de esta semana se llena con los viajes que van.
function pintarRachaInicio() {
  const caja = $("rachaInicio");
  caja.hidden = acc.modoVoz || acc.facil;
  if (caja.hidden) return;
  protectorDelMes();
  const semanas = semanasSeguidas(), cuenta = viajesDeSemana(claveSemana(new Date()));
  const titulo = semanas ? `Racha de ${plural(semanas, "semana", "semanas")}` : "Empieza tu racha";
  // Se llenan de izquierda a derecha: las semanas de la racha y luego la que va en curso. En SVG porque la politica de seguridad no deja style en el HTML.
  const actual = Math.min(semanas - (cuenta >= racha.meta ? 1 : 0), 5);
  const rayas = Array.from({ length: 6 }, (_, i) => {
    const llena = i < actual ? 1 : i === actual ? Math.min(1, cuenta / racha.meta) : 0;
    const x = 1 + i * 53.6;
    return `<rect class="fondo${i === actual ? " actual" : ""}" x="${x}" y="1" width="49" height="8" rx="4"/>${llena ? `<rect class="lleno" x="${x}" y="1" width="${Math.max(8, 49 * llena).toFixed(1)}" height="8" rx="4"/>` : ""}`;
  }).join("");
  const nombre = racha.nombre || "Tu tlacuache";
  caja.setAttribute("aria-label", `${nombre}. ${titulo}. Esta semana: ${cuenta} de ${plural(racha.meta, "viaje", "viajes")} en camión.`);
  // Escena recortada y un renglon con el nombre, las semanas y la flecha: cabe sin empujar el buscador.
  caja.innerHTML = `<svg class="heroe-escena" viewBox="0 36 640 254" aria-hidden="true">${escenaRacha(animoRacha(), 280, 0.78, true)}</svg>
    <span class="heroe-fila" aria-hidden="true"><b class="heroe-lugar" translate="no">${ico("pin")}<span>Santiago de Querétaro<span class="heroe-pais">, México</span></span></b><svg class="racha-puntos" viewBox="0 0 320 10">${rayas}</svg>${ico("chevron", "heroe-ir")}</span>`;
}function pintarRacha() {
  protectorDelMes();
  semanasSeguidas();
  $("rachaEscena").innerHTML = escenaRacha(animoRacha());
  $("rachaEscena").setAttribute("aria-label", `Tu tlacuache${Object.values(racha.puestos).filter(Boolean).length ? ` con ${Object.values(racha.puestos).filter(Boolean).map((id) => ACCESORIOS[id]?.nombre.toLowerCase()).join(", ")}` : ""}`);
  $("tratoTuna").innerHTML = ARTE_TL.icono.tuna;
  $("tratoNombre").textContent = racha.nombre || "tu tlacuache";
  pintarPelajes();
  // Sin nombre se ve una raya para llenar; con nombre, el nombre mismo es el boton para cambiarlo.
  $("tlNombre").textContent = racha.nombre || "Ponle nombre";
  $("tlNombrar").classList.toggle("sin-nombre", !racha.nombre);
  $("tlNombrar").setAttribute("aria-label", racha.nombre ? `${racha.nombre}. Cambiar el nombre de tu tlacuache` : "Ponle nombre a tu tlacuache");
  $("rachaSaldo").innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ARTE_TL.icono.tuna}</svg>${racha.tunas}<span class="oculto"> tunas para gastar</span>`;
  $("rachaTienda").innerHTML = Object.entries(ACCESORIOS).map(([id, a]) => {
    const tiene = racha.compras.includes(id), puesto = racha.puestos[a.lugar] === id, alcanza = racha.tunas >= a.precio;
    const accion = puesto ? "Quitárselo" : tiene ? "Ponérselo" : alcanza ? "Comprar" : `Te faltan ${a.precio - racha.tunas}`;
    return `<li class="${puesto ? "puesto" : ""}"><svg class="tienda-muestra" viewBox="0 0 96 96" aria-hidden="true">${ARTE_TL.icono[id]}</svg>
      <strong>${a.nombre}</strong><small>${a.nota}</small>
      ${tiene ? "" : `<span class="precio-tunas"><svg viewBox="0 0 24 24" aria-hidden="true">${ARTE_TL.icono.tuna}</svg>${a.precio}</span>`}
      <button type="button" class="boton ${puesto ? "" : "oscuro"}" data-accesorio="${id}" ${!tiene && !alcanza ? "disabled" : ""} aria-pressed="${puesto}" aria-label="${accion}: ${a.nombre}${tiene ? "" : `, ${plural(a.precio, "tuna", "tunas")}`}">${accion}</button></li>`;
  }).join("");
}
// Querétaro de fondo (Figma) según la hora: acueducto, papel picado y nopal; con nubes si el tlacuache esta preocupado.
function escenaRacha(e, pie = 330, tam = 1, vivo = false) {
  const cuki = `<g transform="translate(330 ${pie}) scale(${(tam / ESCALA_TL).toFixed(3)})">${vivo ? `<g class="cuki-gesto"><g class="cuki-respira">${tlacuache(e)}</g></g>` : tlacuache(e)}</g>`;
  // En Inicio Cuki camina, olfatea y brinca, y al fondo pasa un camion de Qrobus.
  const camion = `<g class="bus-fondo"><g transform="translate(0 ${pie - 92})"><rect width="150" height="54" rx="12" fill="#1F8A52" stroke="#2B2420" stroke-width="3"/><rect y="38" width="150" height="7" fill="#E9A23B"/><g fill="#BFE8F2" stroke="#2B2420" stroke-width="2"><rect x="12" y="10" width="26" height="20" rx="4"/><rect x="44" y="10" width="26" height="20" rx="4"/><rect x="76" y="10" width="26" height="20" rx="4"/><rect x="108" y="10" width="30" height="24" rx="4"/></g><g fill="#2B2420"><circle cx="34" cy="56" r="10"/><circle cx="118" cy="56" r="10"/></g></g></g>`;
  return `${ARTE_ESC.racha[horario()]}${e < 2 ? ARTE_ESC.racha.nubes : ""}${vivo ? `${camion}<g class="cuki-camina"><g class="cuki-voltea">${cuki}</g></g>` : cuki}`;
}
function abrirRacha() {
  pintarRacha();
  ir("racha");
}
$("rachaInicio").addEventListener("click", abrirRacha);
// Sin groserias: se compara sin acentos, sin numeros disfrazados de letra y sin letras repetidas.
const GROSERIAS_DENTRO = ["pendej", "chinga", "chingon", "chupaverg", "culer", "cabron", "mamon", "mamad", "pinche", "maricon", "mierd", "panoch", "ojete", "idiot", "imbecil", "estupid", "retrasad", "violad", "hitler", "narco", "sicari", "hijodeput", "fuck", "shit", "bitch", "ashole", "pusy", "cunt", "whore", "slut", "gilipo"];
const GROSERIAS_EXACTAS = new Set(["puto", "puta", "putos", "putas", "putito", "putita", "pvto", "pvta", "culo", "culos", "culito", "pito", "pitote", "pene", "penes", "teta", "tetas", "tetona", "chichi", "chichis", "nalga", "nalgas", "nalgon", "nalgona", "caca", "pedo", "pedos", "joto", "jotos", "jota", "marica", "zorra", "zorras", "perra", "perras", "mayate", "naco", "naca", "indio", "india", "sida", "coger", "cogida", "cogido", "follar", "polla", "tarado", "tarada", "baboso", "babosa", "verga", "vergas", "vergon", "vergota", "vergazo", "vagina", "semen", "ano", "punal", "nazi", "niga", "nigga", "niger", "nigger", "dick", "cock", "ptm", "alv", "hdp", "ctm", "vrg", "wtf"]);
function nombrePermitido(texto) {
  const limpio = sinAcentos(texto).replace(/[4@]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t");
  const sinRepetir = (t) => t.replace(/(.)\1+/g, "$1"), palabras = limpio.split(/[^a-z]+/).filter(Boolean), junto = palabras.join(""), compacto = sinRepetir(junto);
  if (GROSERIAS_DENTRO.some((g) => compacto.includes(g))) return false;
  return ![...palabras, ...palabras.map(sinRepetir), junto, compacto].some((p) => GROSERIAS_EXACTAS.has(p));
}
function nombrarTlacuache(abierto) {
  $("tlNombreAviso").textContent = "";
  $("tlNombreForma").hidden = !abierto;
  $("tlNombreFila").hidden = abierto;
  if (abierto) { $("tlNombreEntrada").value = racha.nombre ?? ""; $("tlNombreEntrada").focus(); }
}
$("pelajes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pelaje]");
  if (!b) return;
  const id = b.dataset.pelaje;
  if (id === "alebrije" && !racha.alebrije) pelajeVista = id;
  else { pelajeVista = null; racha.pelaje = id; guardarRacha(); }
  pintarRacha();
  document.querySelector(`[data-pelaje="${id}"]`)?.focus();
});
$("pelajeComprar").addEventListener("click", () => {
  if (racha.tunas < ALEBRIJE_TUNAS) return;
  racha.tunas -= ALEBRIJE_TUNAS;
  Object.assign(racha, { alebrije: true, pelaje: "alebrije" });
  pelajeVista = null;
  guardarRacha();
  pintarRacha();
  $("pelajes").querySelector('[data-pelaje="alebrije"]')?.focus();
});
$("conoceCarrusel").addEventListener("scroll", (e) => {
  const c = e.currentTarget, paso = c.children[1].offsetLeft - c.children[0].offsetLeft;
  const i = c.scrollLeft >= c.scrollWidth - c.clientWidth - 2 ? c.children.length - 1 : Math.round(c.scrollLeft / paso);
  [...$("conocePuntos").children].forEach((p, k) => p.classList.toggle("ya", k === i));
}, { passive: true });
$("tlNombrar").addEventListener("click", () => nombrarTlacuache(true));
$("tlNombreCancelar").addEventListener("click", () => nombrarTlacuache(false));
$("tlNombreForma").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = $("tlNombreEntrada").value.replace(/\s+/g, " ").trim().slice(0, 16);
  if (nombre && !nombrePermitido(nombre)) { $("tlNombreAviso").textContent = "Ese nombre no se vale. Elige otro."; return; }
  if (nombre) racha.nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  else delete racha.nombre;
  guardarRacha();
  nombrarTlacuache(false);
  pintarRacha();
  pintarRachaInicio();
  $("tlNombrar").focus();
});
$("rachaTienda").addEventListener("click", (e) => {
  const b = e.target.closest("[data-accesorio]");
  if (!b || b.disabled) return;
  const id = b.dataset.accesorio, a = ACCESORIOS[id];
  if (!racha.compras.includes(id)) {
    if (racha.tunas < a.precio) return;
    racha.tunas -= a.precio;
    racha.compras.push(id);
    racha.puestos[a.lugar] = id;
  } else racha.puestos[a.lugar] = racha.puestos[a.lugar] === id ? null : id;
  guardarRacha();
  pintarRacha();
  document.querySelector(`[data-accesorio="${id}"]`)?.focus();
});

const ETAPAS_TL = [
  [0, "Tu tlacuache vive entre basura y humo.", "recoger la basura"],
  [6000, "Ya no hay basura en el suelo.", "que crezca un árbol"],
  [18000, "Creció un árbol y volvió el pasto.", "limpiar la fuente y el aire"],
  [36000, "El agua está limpia y se fue el humo.", "que lleguen los pájaros"],
  [60000, "Llegaron los pájaros y hay más árboles.", "que el nopal dé tunas"],
  [90000, "Tu tlacuache ya come tunas.", "que tenga crías"],
  [150000, "Tu tlacuache tuvo crías. Su ciudad está sana.", null],
];
const CAMINO_TL = ["Basura", "Bote", "Árbol", "Agua", "Aves", "Tunas", "Crías"];
function pintarTlacuache(g) {
  const e = ETAPAS_TL.findLastIndex(([desde]) => g >= desde), [desde, frase_, sigue] = ETAPAS_TL[e], texto = frase_.replace("Tu tlacuache", racha.nombre || "Tu tlacuache");
  document.querySelector('#co2Alcance [data-v="tu"]').textContent = racha.nombre || "Tu tlacuache";
  $("mundoTl").setAttribute("class", `escena e${e}`);
  $("mundoTl").innerHTML = escenaTlacuache(e);
  $("mundoTl").setAttribute("aria-label", `Ilustración: ${texto}`);
  const siguiente = ETAPAS_TL[e + 1]?.[0];
  const camino = $("co2Camino");
  camino.hidden = false;
  camino.setAttribute("aria-label", `Etapa ${e + 1} de ${CAMINO_TL.length}: ${CAMINO_TL[e]}`);
  camino.innerHTML = CAMINO_TL.map((_, i) => `<i class="${i <= e ? "lleno" : ""}"></i>`).join("");
  $("co2Unidad").textContent = siguiente ? `Faltan ${kgTexto(siguiente - g)} para ${sigue}` : `${racha.nombre || "Tu tlacuache"} tuvo crías`;
}
let alcanceCo2 = "tu";
const marcarAlcance = radios("co2Alcance", (v) => { alcanceCo2 = v; pintarCo2(); llenarPrimeraVista("co2"); });
const ponerCifra = (id, texto) => { $(id).textContent = texto; $(id).classList.toggle("larga", texto.length > 6); };
// La primera vista llega justo a la barra: lo que sigue empieza debajo y ninguna ficha queda partida.
function llenarPrimeraVista(id) {
  const caja = $(id).querySelector(".primera-vista"), barra = $("pestanas");
  const bloque = [...caja.querySelectorAll(".bloque-hero")].find((b) => b.offsetParent);
  const escena = bloque.querySelector(".bloque-escena:not([hidden]) svg, .bosque:not([hidden])");
  caja.style.minHeight = bloque.style.minHeight = "";
  if (escena) escena.style.height = "";
  const limite = barra.hidden ? innerHeight : barra.getBoundingClientRect().top;
  // La pantalla entra con una animacion que la baja unos pixeles: no debe contar en la medida.
  const bajada = new DOMMatrix(getComputedStyle($(id)).transform).m42;
  const espacio = limite - (caja.getBoundingClientRect().top - bajada) - 12;
  // Si faltan pocos pixeles cede la escena, recortando cielo, para que las fichas sigan a la vista.
  const exceso = caja.offsetHeight - espacio, altoEscena = escena?.getBoundingClientRect().height ?? 0;
  if (exceso > 0 && altoEscena - exceso >= 120) escena.style.height = `${altoEscena - exceso}px`;
  // Si las fichas aun asi no caben completas, el bloque llena la pantalla y ellas quedan debajo.
  if (caja.offsetHeight <= espacio) caja.style.minHeight = `${espacio}px`;
  else bloque.style.minHeight = `${limite - (bloque.getBoundingClientRect().top - bajada) - 8}px`;
}
function pintarCo2() {
  const propio = historial.reduce((s, h) => s + (h.co2 || 0), 0), viajesPropios = historial.filter((h) => h.co2).length;
  const todos = estado.impacto?.g ? estado.impacto : null, deTodos = !!todos && alcanceCo2 === "todos";
  $("co2Alcance").hidden = !todos;
  marcarAlcance(deTodos ? "todos" : "tu");
  const g = deTodos ? todos.g : propio;
  $("co2Quien").textContent = deTodos ? `de CO₂ en ${plural(todos.viajes, "viaje", "viajes")} en camión` : propio ? "de CO₂ que no salió de un auto" : "Aún sin viajes en camión";
  ponerCifra("co2Total", g ? kgTexto(g) : "0 kg");
  $("tituloEquivale").hidden = $("co2Equivale").hidden = g < 50;
  $("bosque").toggleAttribute("hidden", !deTodos);
  $("mundoTlCaja").hidden = deTodos;
  if (deTodos) { pintarBosque(g); $("co2Camino").hidden = true; } else pintarTlacuache(propio);
  $("co2Equivale").innerHTML = equivalencias(g).map(([p, cifra, texto]) => {
    const [numero, ...unidad] = cifra.split(" ");
    return `<li class="eq-${p}">${picto(p)}<strong>${numero}${unidad.length ? ` <small>${unidad.join(" ")}</small>` : ""}</strong><span>${texto}</span></li>`;
  }).join("");
  pintarSemanas(propio, viajesPropios);
}
function abrirCo2() {
  pintarCo2();
  ir("co2");
  llenarPrimeraVista("co2");
}
$("impactoTodos").addEventListener("click", abrirCo2);
$("co2Planear").addEventListener("click", () => abrirBuscar());
function fechaViaje(iso) {
  const f = new Date(iso);
  return `${DIAS[(f.getDay() + 6) % 7]} ${f.getDate()} ${MESES[f.getMonth()]}`;
}
function pintarViajes() {
  $("bloqueViajes").hidden = !viajes.length;
  $("listaViajes").innerHTML = viajes.slice(0, 3).map((v, i) => `<li><button type="button" data-i="${i}" aria-label="Ir otra vez a ${escapar(v.destino.nombre)}">
      ${miniFicha(tonoLugar(v.destino.nombre, i, v.destino.tipo), picto(iconoLugar(v.destino.nombre, v.destino.tipo)))}
      <span class="fila-texto"><strong translate="no">${escapar(v.destino.nombre)}</strong><small>${escapar(v.camino)}, ${fechaViaje(v.fecha)}</small></span>
      ${ico("chevron", "chevron")}</button></li>`).join("");
}
$("listaViajes").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (b) irA({ ...viajes[b.dataset.i].destino });
});

// Lugares guardados en este telefono: Casa, Escuela, Trabajo.
let guardados = leer("grieta-lugares", []);
// Cuatro lugares como maximo: caben en una fila del inicio.
const MAX_LUGARES = 4;
let editando = false;
let quitado = null;
// El lugar que se acaba de agregar desde el inicio, para el aviso con deshacer.
let nuevoGuardado = null, porGuardar = null;
let cambioUbicacionGuardada = null;
// El tipo sale del nombre; si no, del tipo de OpenStreetMap que trae el buscador.
const TIPOS_OSM = { hospital: "hospital", clinic: "hospital", doctors: "hospital", pharmacy: "hospital", park: "parque", garden: "parque",
  supermarket: "super", convenience: "super", mall: "plaza", department_store: "plaza", marketplace: "mercado", cafe: "cafe", restaurant: "cafe",
  fast_food: "cafe", place_of_worship: "iglesia", university: "escuela", school: "escuela", college: "escuela", kindergarten: "escuela",
  aerodrome: "avion", bus_station: "qrobus", office: "trabajo" };
function iconoLugar(nombre, tipo) {
  const n = sinAcentos(nombre);
  if (n === "casa") return "casa";
  if (/trabajo|oficina|corporativo|parque (industrial|tecnologico)/.test(n)) return "trabajo";
  if (/hospital|clinica|imss|issste|cruz roja|doctor|medic|farmacia|consultorio|sanatorio|laboratorio/.test(n)) return "hospital";
  if (/aeropuerto/.test(n)) return "avion";
  if (/terminal|central de autobuses/.test(n)) return "qrobus";
  if (/escuela|universidad|facultad|prepa|colegio|instituto|tecnologico|\buaq\b|\btec\b|kinder|primaria|secundaria|campus/.test(n)) return "escuela";
  if (/parque|jardin|alameda|bosque|plaza de armas/.test(n)) return "parque";
  if (/bodega aurrera|walmart|soriana|chedraui|la comer|fresko|city market|costco|sams|\bheb\b|\boxxo\b|super|tienda|abarrotes/.test(n)) return "super";
  if (/mercado|tianguis/.test(n)) return "mercado";
  if (/plaza|centro comercial|mall|lifestyle|uptown|outlet|galerias|antea/.test(n)) return "plaza";
  if (/cafe|restaurante|taqueria|tacos|cocina|fonda|pizza|comida|starbucks/.test(n)) return "cafe";
  if (/iglesia|templo|parroquia|catedral|capilla|basilica/.test(n)) return "iglesia";
  if (/\b(abuel\w*|mama|papa|hij[oa]s?|tia|tio|herman[oa]s?|familia|novi[oa])\b/.test(n)) return "familia";
  return TIPOS_OSM[tipo] ?? "lugar";
}
// Cada tipo de lugar con su color, como en un sistema de transporte; los demas toman uno del resto
const TONOS = { casa: "tono-casa", escuela: "tono-escuela", trabajo: "tono-trabajo", hospital: "tono-salud", parque: "tono-hospital", super: "tono-naranja",
  mercado: "tono-oliva", plaza: "tono-rosa", cafe: "tono-cafe", iglesia: "tono-anil", avion: "tono-turquesa", qrobus: "tono-hospital", familia: "tono-ciruela" };
const tonoLugar = (nombre, i, tipo) => TONOS[iconoLugar(nombre, tipo)] ?? ["tono-anil", "tono-turquesa", "tono-ciruela", "tono-naranja", "tono-oliva"][i % 5];
function pintarGuardados() {
  // Casa siempre primero: es el viaje que mas se repite.
  guardados.sort((a, b) => (b.nombre === "Casa") - (a.nombre === "Casa"));
  const casa = guardados.findIndex((g) => g.nombre === "Casa");
  $("vozCasa").hidden = casa < 0;
  $("vozCasa").dataset.i = casa;
  // En modo voz, los demas lugares tambien a un toque, hasta tres para no llenar la pantalla
  $("vozLugares").innerHTML = guardados.filter((g) => g.nombre !== "Casa").slice(0, 3).map((g) =>
    `<button type="button" class="boton-voz" data-i="${guardados.indexOf(g)}" aria-keyshortcuts="Shift+F10">${picto(iconoLugar(g.nombre))}Ir a ${escapar(g.nombre)}</button>`).join("");
  // Tus lugares como fichas grandes; si falta la casa, su ficha invita a agregarla.
  const ficha = (attrs, clase, icono, nombre, propio = false) => `<button type="button" class="lugar ${clase}" ${attrs}>
    <span class="lugar-icono">${picto(icono)}</span><span class="lugar-nombre"${propio ? ' translate="no"' : ""}>${escapar(nombre)}</span></button>`;
  const fichas = guardados.map((g, i) => ficha(`data-i="${i}" aria-keyshortcuts="Shift+F10" aria-label="Ir a ${escapar(g.nombre)}"`, `${tonoLugar(g.nombre, i)}${nuevoGuardado?.nombre === g.nombre ? " recien" : ""}`, iconoLugar(g.nombre), g.nombre, true));
  const faltaCasa = !guardados.some((g) => g.nombre === "Casa") && guardados.length < MAX_LUGARES;
  if (faltaCasa) fichas.push(ficha('data-nuevo="Casa"', "nuevo tono-casa", "casa", "Agregar casa"));
  if (guardados.length + faltaCasa < MAX_LUGARES) fichas.push(ficha('data-nuevo=""', "nuevo tono-ciruela", "plus", "Agregar"));
  $("guardados").innerHTML = fichas.join("");
  const deshacer = quitado ? `<div class="fila"><span class="fila-texto"><strong>Quitaste ${escapar(quitado.lugar.nombre)}</strong></span>
      <button type="button" class="quitar" data-deshacer>Deshacer</button></div>` : "";
  const enInicio = quitado?.pantalla === "inicio";
  const avisoNuevo = nuevoGuardado && !enInicio ? `<div class="fila"><span class="fila-texto"><strong>Guardaste ${escapar(nuevoGuardado.lugar)} como ${escapar(nuevoGuardado.nombre)}</strong></span>
      <button type="button" class="quitar" data-deshacer-nuevo>Deshacer</button></div>` : "";
  $("deshacerInicio").innerHTML = enInicio ? deshacer : avisoNuevo;
  $("deshacerInicio").hidden = !enInicio && !avisoNuevo;
}
function guardarLugares() {
  escribir("grieta-lugares", guardados);
  pintarGuardados();
}
const irA = (lugar) => { estado.editando = "hacia"; poner("destino", lugar); };

function prepararVozCamara() {
  const sintesis = window.speechSynthesis;
  if (!sintesis || acc.lector === "si") return;
  // Safari necesita una llamada a speak durante el toque, aunque todavía esté cargando las voces.
  const inicio = new SpeechSynthesisUtterance("");
  inicio.volume = 0;
  sintesis.speak(inicio);
  sintesis.cancel();
}
function hablarCamara(texto, urgente = false, alEmpezar) {
  if (document.body.dataset.pantalla !== "camara" || !camaraConVoz || microfonoActivo || acc.lector === "si") return;
  const sintesis = window.speechSynthesis;
  if (!urgente && (sintesis?.pending || (guia.activa && sintesis?.speaking))) return;
  const voces = sintesis?.getVoices() ?? [];
  const voz = voces.find((v) => v.localService && v.lang === "es-MX") ?? voces.find((v) => v.localService && v.lang.startsWith("es"));
  $("camaraAudio").textContent = voz ? "" : "Para escuchar sin enviar texto, instala una voz en español en los ajustes de tu teléfono. También puedes usar tu lector de pantalla.";
  if (!voz) return;
  if (urgente && (sintesis.speaking || sintesis.pending)) detenerVoz();
  const mensaje = new SpeechSynthesisUtterance(texto);
  mensaje.voice = voz;
  mensaje.lang = voz.lang;
  mensaje.rate = acc.lenta ? 0.8 : 1;
  mensaje.onstart = alEmpezar;
  sintesis.speak(mensaje);
}
CamaraGrieta.iniciarInterfaz({
  hablar: hablarCamara,
  prepararVoz: prepararVozCamara,
  vozOcupada: () => Boolean(window.speechSynthesis?.speaking || window.speechSynthesis?.pending),
  explorando: () => ToquesGrieta.describiendo,
  callar: detenerVoz,
  viaje: () => guia.activa && guia.camion ? { linea: guia.camion.linea, hacia: guia.camion.hacia } : null,
  rutas: () => Grieta.qrobus?.patrones ?? [],
  // En un viaje, el letrero leido dice si es la parada propia o la de enfrente, salvo que se llamen igual.
  letreroParada: (leido) => {
    const c = guia.activa ? guia.camion : null;
    if (!c || !["parada", "esperando"].includes(guia.fase)) return null;
    const mia = c.recorrido[0];
    const { opuesta } = Grieta.revisarParada({ lat: mia.lat, lon: mia.lon, precision: 5, objetivo: { ...mia, linea: c.linea, hacia: c.hacia } });
    if (opuesta && opuesta.nombre === mia.nombre && leido === mia.nombre) return `El letrero dice ${cruce(leido)}, igual que la parada de enfrente: no distingue el lado. Usa ¿Es mi parada? con la brújula.`;
    if (leido === mia.nombre) return `El letrero dice ${cruce(leido)}: es tu parada para la ${c.linea}.`;
    if (opuesta && leido === opuesta.nombre) return `El letrero dice ${cruce(leido)}: es la parada de enfrente, donde la ${c.linea} va hacia ${opuesta.hacia}. Tu parada está cruzando la calle.`;
    return null;
  },
  paradas: () => {
    const punto = guia.activa && guia.previo ? guia.previo : estado.gps;
    return (Grieta.qrobus?.paradas ?? []).filter((p) => punto && Grieta.metros(p[0], p[1], punto.lat, punto.lon) < 600).map((p) => p[2]);
  },
});
function abrirCamara() {
  cancelarDictado();
  detenerVoz();
  ir("camara");
  hablar("Cámara que habla. Toca Iniciar cámara para comenzar. Las imágenes se analizan solo en tu teléfono.", false, false, true);
}
$("vozCamara").addEventListener("click", abrirCamara);
$("abrirCamara").addEventListener("click", abrirCamara);
$("guiaCamara").addEventListener("click", abrirCamara);
$("camaraVolverGuia").addEventListener("click", () => ir(guia.activa ? "guia" : "inicio"));

// Describir con IA (Worker grieta-ia): una foto con las caras pixeladas; la respuesta se dice y queda escrita.
let IA = "";
const charla = { activa: false, ocupado: false, rec: null, silencios: 0, historial: [], ultimo: "", previa: "" };
// Solo las descripciones quedan escritas; esperas y errores se dicen y van al lector de pantalla.
function decirIA(texto, escrito = false) {
  if (escrito) $("camaraIA").textContent = texto;
  else if (acc.lector === "si") $("anuncio").textContent = texto;
  charla.ultimo = texto;
  hablarCamara(texto, true);
}
// En iPhone el detector puede tardar en revisar un cuadro: se espera hasta 6 s a que haya una foto segura.
async function fotoSegura() {
  // Hasta 15 s: en un telefono lento la primera revision de personas tarda en llegar.
  for (let i = 0; i < 60; i++) {
    const f = CamaraGrieta.foto();
    if (f) return f;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
async function preguntarIA(pregunta = "") {
  if (charla.ocupado || !IA) return;
  charla.ocupado = true;
  $("camaraEnfrente").disabled = true;
  decirIA("Un momento.");
  const f = await fotoSegura();
  if (!f) {
    charla.ocupado = false;
    $("camaraEnfrente").disabled = false;
    return decirIA("La cámara sigue arrancando. Intenta otra vez en unos segundos.");
  }
  try {
    const r = await fetch(`${IA}/describir`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagen: f.imagen, pregunta, historial: charla.historial }), signal: AbortSignal.timeout(15000) });
    const d = await r.json().catch(() => ({}));
    if (d.texto) charla.historial = [...charla.historial, { pregunta: pregunta || "¿Qué tengo enfrente?", respuesta: d.texto }].slice(-3);
    if (d.texto) decirIA(d.texto, true);
    else decirIA(d.error ?? "No pude describir la foto. Intenta otra vez.");
    // Si la misma respuesta sale dos veces seguidas en la conversacion, algo se trabo: se deja de escuchar.
    const respuesta = sinAcentos(d.texto ?? d.error ?? "");
    if (charla.activa && respuesta === charla.previa) terminarCharla("Dejé de escuchar porque se repitió la misma respuesta. Toca Preguntar para seguir.");
    charla.previa = respuesta;
  } catch (e) {
    decirIA(e.name === "TimeoutError" ? "La descripción tardó demasiado. Intenta otra vez." : "Sin conexión para describir. Los avisos de la cámara siguen funcionando.");
  } finally {
    charla.ocupado = false;
    $("camaraEnfrente").disabled = false;
  }
}
function terminarCharla(mensaje) {
  charla.activa = false;
  try { charla.rec?.abort(); } catch {}
  charla.rec = null;
  $("camaraConversar").setAttribute("aria-pressed", "false");
  $("camaraConversar").querySelector("span").textContent = "Preguntar";
  if (mensaje) decirIA(mensaje);
}
// Escucha solo cuando Grieta termino de hablar, para no oirse a si misma.
function escucharPregunta() {
  if (!charla.activa) return;
  if (speechSynthesis.speaking || speechSynthesis.pending || charla.ocupado) return void setTimeout(escucharPregunta, 300);
  if (!charla.calladoDesde) { charla.calladoDesde = Date.now(); return void setTimeout(escucharPregunta, 900); }
  charla.calladoDesde = 0;
  const rec = new Reconocer();
  let oido = false;
  charla.rec = rec;
  rec.lang = "es-MX"; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const texto = e.results[0]?.[0]?.transcript?.trim();
    if (!texto) return;
    oido = true;
    atenderPregunta(texto);
  };
  rec.onerror = (e) => { if (["not-allowed", "service-not-allowed"].includes(e.error)) terminarCharla("Necesito permiso del micrófono para escucharte."); };
  rec.onend = () => {
    if (charla.rec === rec) charla.rec = null;
    if (!charla.activa) return;
    charla.silencios = oido ? 0 : charla.silencios + 1;
    if (charla.silencios >= 3) return terminarCharla("Dejé de escuchar. Toca Preguntar para seguir.");
    setTimeout(escucharPregunta, 400);
  };
  try { rec.start(); } catch { setTimeout(escucharPregunta, 800); }
}
function atenderPregunta(texto) {
  const n = sinAcentos(texto.toLowerCase());
  // El microfono a veces oye a la propia Grieta: si lo que llego es parte de lo que acaba de decir, se ignora.
  const dicho = sinAcentos(charla.ultimo ?? "");
  if (n.length > 6 && dicho.includes(n.slice(0, 40))) return;
  if (/^(ya|alto|para|basta|termina|deja de escuchar|gracias)\b/.test(n)) return terminarCharla("Listo, dejé de escuchar.");
  const camion = $("camaraBuscarCamion");
  if (/(es mi camion|es el camion|que camion|numero del camion)/.test(n) && !camion.hidden && !camion.disabled) return camion.click();
  if (/donde estoy/.test(n)) return dondeEstoy("voz");
  preguntarIA(texto);
}
$("camaraEnfrente").addEventListener("click", () => preguntarIA());
$("camaraConversar").addEventListener("click", () => {
  if (charla.activa) return terminarCharla("Listo, dejé de escuchar.");
  charla.activa = true; charla.silencios = 0;
  $("camaraConversar").setAttribute("aria-pressed", "true");
  $("camaraConversar").querySelector("span").textContent = "Dejar de preguntar";
  decirIA("Te escucho. Pregunta lo que quieras de lo que tienes enfrente. Di «ya» para terminar.");
  escucharPregunta();
});
new MutationObserver(() => { if (document.body.dataset.pantalla !== "camara" && charla.activa) terminarCharla(); })
  .observe(document.body, { attributes: true, attributeFilter: ["data-pantalla"] });
// Asistencia a pie: la camara avisa escalones y hoyos mientras la tarjeta de la vuelta sigue arriba.
$("guiaAsistencia").addEventListener("click", () => {
  cancelarDictado();
  ir("camara");
  $("camaraEntorno").checked = true;
  $("camaraIniciar").click();
});

ToquesGrieta.iniciar({
  activo: () => (document.body.dataset.pantalla === 'practica' || (acc.modoVoz && acc.toques)) && acc.lector !== 'si' && !(document.body.dataset.pantalla === 'bienvenida' && pasoActual === 'lector'),
  original: (elemento, atributo) => Interfaz.original(elemento, atributo),
  cancelar: detenerVoz,
  puedeAnunciar: () => !microfonoActivo,
  alDescribir: (elemento) => PracticaGrieta.descrito(elemento),
  decir: (texto) => { const anterior = ultimoMensaje; hablar(texto, false, true, true); ultimoMensaje = anterior; },
});

PracticaGrieta.iniciar({
  ir,
  lector: () => acc.lector === 'si',
  decir: (texto) => { if (acc.lector !== 'si') { const anterior = ultimoMensaje; hablar(texto, false, true, true); ultimoMensaje = anterior; } },
  guardar: () => escribir('grieta-practica-toques', true),
});

TutorialGrieta.iniciar({
  ir,
  modoVoz: () => acc.modoVoz,
  lector: () => acc.lector === 'si',
  decir: texto => { if (acc.modoVoz && acc.lector !== 'si') hablar(texto, false, true); },
  guardar: valor => escribir('grieta-tutorial', valor),
  practicar: desde => PracticaGrieta.abrir(desde),
  reiniciar: () => ToquesGrieta.reiniciar(),
  seguirBienvenida: () => { ir("bienvenida", true); irPaso("ubicacion"); },
  tlacuache: (x, y, k) => `<g transform="translate(${x} ${y}) scale(${(k / ESCALA_TL).toFixed(3)})">${tlacuache(4, racha.puestos, false)}</g>`,
});

// Botones del modo para personas ciegas.
// Lo que se dice al entrar: cuantos botones hay y en que orden, de arriba a abajo.
function ayudaVoz() {
  const botones = [...document.querySelectorAll("#inicioVoz .boton-voz")].filter((b) => !b.hidden).map((b) => Interfaz.original(b).trim());
  return `${ToquesGrieta.activo() ? ToquesGrieta.instrucciones + ' ' : ''}Estás en el inicio. Hay ${botones.length} botones grandes, de arriba a abajo: ${botones.join(", ")}. ` +
    "Para ir a algún lado, activa el primer botón y di el lugar después del tono.";
}
$("vozCasa").addEventListener("click", () => { hablar(frase("vamos_casa")); irA(guardados.find((g) => g.nombre === "Casa")); });
$("vozCamion").addEventListener("click", () => abrirCamiones());
$("vozDonde").addEventListener("click", () => dondeEstoy("voz"));
$("vozRepetir").addEventListener("click", () => hablar(ultimoMensaje || ayudaVoz()));
$("vozDestino").addEventListener("click", () => {
  if (Reconocer) return dictar($("vozDestino"));
  abrirBuscar("hacia");
  hablar("Este navegador no deja dictar. Escribe a dónde vas.");
});
$("vozLugares").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const lugar = guardados[b.dataset.i];
  hablar(frase("vamos_lugar", { lugar: lugar.nombre }));
  irA(lugar);
});
$("guardados").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (!b.hasAttribute("data-nuevo")) return irA(guardados[b.dataset.i]);
  // Agregar: solo se busca el lugar; sin "Desde" porque aquí no hay viaje.
  const casa = b.dataset.nuevo === "Casa";
  estado.guardando = { nombre: b.dataset.nuevo || "" };
  abrirBuscar("hacia");
  $("filaDesde").hidden = true;
  $("campoBuscar").placeholder = casa ? "La calle o colonia de tu casa" : "Busca el lugar que quieres guardar";
  titulos.buscar = $("tituloPantalla").textContent = casa ? "¿Dónde está tu casa?" : "Guardar un lugar";
});
$("deshacerInicio").addEventListener("click", (e) => {
  if (e.target.closest("[data-deshacer-nuevo]")) return deshacerNuevo();
  if (e.target.closest("[data-deshacer]")) deshacerLugar();
});

// El mapa de Como llegar crece al tocarlo, con la ruta completa del viaje del recuadro.
function abrirMapaGrande() {
  if (document.body.dataset.pantalla !== "opciones" || document.body.classList.contains("mapa-grande") || acc.modoVoz) return;
  const o = estado.tarjetas?.[estado.iHero]?.o;
  document.body.classList.add("mapa-grande");
  $("hoja").style.maxHeight = "";
  $("hoja").scrollTop = 0;
  $("miniMapa").innerHTML = o ? `<span class="mini-mapa-fila">${picto("qrobus")}<span class="mini-mapa-tx"><b>${escapar(tituloOpcion(o))}</b><small>Llegas ${hora(llegada(o))}, ${Math.round(o.minutos)} min de viaje</small></span><strong>${rangoOpcion(o) ? rangoTexto(rangoOpcion(o)) : pesos(o.costo)}</strong></span><button type="button" class="boton hv-empezar" data-mini-empezar>Empezar viaje con avisos</button>` : "";
  $("miniMapa").hidden = !o;
  $("cerrarMapa").hidden = false;
  requestAnimationFrame(() => {
    $("cerrarMapa").style.top = `${$("mapa").getBoundingClientRect().top + 10}px`;
    mapa.invalidateSize();
    if (o) dibujar(o);
    else reencuadrar("opciones");
  });
}
function quitarMapaGrande() {
  document.body.classList.remove("mapa-grande");
  $("miniMapa").hidden = true;
  $("cerrarMapa").hidden = true;
}
function cerrarMapaGrande() {
  if (!document.body.classList.contains("mapa-grande")) return false;
  quitarMapaGrande();
  quitarTrazo();
  requestAnimationFrame(() => { mapa.invalidateSize(); pedirCortes(); setTimeout(() => reencuadrar("opciones"), 150); });
  return true;
}
mapa.on("click", abrirMapaGrande);
$("cerrarMapa").addEventListener("click", cerrarMapaGrande);
$("miniMapa").addEventListener("click", (e) => {
  if (!e.target.closest("[data-mini-empezar]")) return;
  const x = estado.tarjetas[estado.iHero];
  estado.elegida = x.o;
  estado.etiquetaElegida = x.etiquetas.join(", ");
  titulos.detalle = tituloOpcion(x.o);
  iniciarGuia(x.o);
});

// Llegar a una hora: de tu hora de entrada hacia atras, cada paso con su hora.
const llegarEstado = { origen: null, destino: null, kmCalle: null, caminatas: undefined, offset: 0, meta: 480 };
const diaDeOffset = (d) => (hoyDia() + d) % 7;
const textoDia = (d) => (d === 0 ? "Hoy" : d === 1 ? "Mañana" : `El ${DIAS[diaDeOffset(d)]}`);
function* pasosSalidas({ origen, destino, kmCalle, caminatas, offset, meta: hora }) {
  const meta = hora - (acc.colchon ?? 0);
  const desde = offset === 0 ? ahoraMin() : 0;
  const base = { origen: [origen.lat, origen.lon], destino: [destino.lat, destino.lon], kmCalle, dia: diaDeOffset(offset), caminarMax: acc.camino ? 300 : undefined, tarifa: acc.unidos ? { pasaje: 2, transbordos: [0, 1] } : undefined, caminatas, camiones: 2 };
  const aTiempo = [];
  const probar = (t) => {
    for (const o of Grieta.evaluar({ ...base, minuto: t }).opciones) if (t + o.minutos <= meta) aTiempo.push({ t, o, conApp: o.tipo !== "app" && o.pasos.some((p) => p.tipo === "app") });
  };
  // Cada 10 minutos desde la hora de llegada hacia atrás: la salida más tardía es la que se muestra, las anteriores ya no cambian nada.
  const inicio = Math.max(desde, meta - 240);
  for (let t = inicio + Math.floor((meta - inicio) / 10) * 10; t >= inicio; t -= 10) {
    probar(t);
    yield;
    if (aTiempo.some((x) => x.o.tipo === "app") && aTiempo.some((x) => x.o.tipo !== "app" && !x.conApp)) break;
  }
  const ultima = (enApp) => Math.max(-1, ...aTiempo.filter((x) => (x.o.tipo === "app") === enApp).map((x) => x.t));
  for (const t of new Set([ultima(false), ultima(true)])) if (t >= 0 && t + 5 <= meta) { probar(t + 5); yield; }
  const camion = aTiempo.filter((x) => x.o.tipo !== "app").sort((a, b) => a.conApp - b.conApp || b.t - a.t || a.o.costo - b.o.costo)[0];
  const app = aTiempo.filter((x) => x.o.tipo === "app").sort((a, b) => b.t - a.t)[0];
  return { camion, app, base };
}
function salidasParaLlegar(datos) {
  const pasos = pasosSalidas(datos);
  for (;;) { const p = pasos.next(); if (p.done) return p.value; }
}
// La misma cuenta en partes, soltando la pantalla entre cada una para que no se trabe.
async function salidasEnPartes(datos) {
  const pasos = pasosSalidas(datos);
  for (;;) {
    const p = pasos.next();
    if (p.done) return p.value;
    await new Promise((listo) => setTimeout(listo));
  }
}
const rangoAppEn = (base, t) => Grieta.cotizar({ origen: base.origen, destino: base.destino, kmCalle: base.kmCalle, dia: base.dia, minuto: t }).mejor;
function abrirLlegarHora({ origen, destino, kmCalle, caminatas, offset, meta }) {
  Object.assign(llegarEstado, { origen, destino, kmCalle, caminatas, offset, meta });
  titulos.llegarHora = `A ${destino.nombre}`;
  ir("llegarHora");
  pintarLlegarCabeza();
  calcularLlegar();
}
function pintarLlegarCabeza() {
  const c = llegarEstado;
  $("caHoraTexto").textContent = hora(c.meta);
  $("caHora").value = Grieta.hhmm(c.meta);
  for (const b of $("caDias").children) b.setAttribute("aria-pressed", String(b.dataset.d === "otro" ? c.offset > 1 : Number(b.dataset.d) === c.offset));
  $("caOtro").hidden = c.offset < 2;
  $("caOtro").innerHTML = [2, 3, 4, 5, 6].map((d) => `<option value="${d}"${d === c.offset ? " selected" : ""}>${textoDia(d)}</option>`).join("");
}
let esperaLlegar;
function calcularLlegar(demora = 0) {
  clearTimeout(esperaLlegar);
  $("caResultado").innerHTML = '<p class="nota">Calculando...</p>';
  esperaLlegar = setTimeout(pintarLlegar, demora + 30);
}
function pasosConHora({ t, o }, inicio) {
  let cur = t, color = 0;
  const pasos = o.pasos;
  return pasos.map((p, i) => {
    if (p.tipo === "caminar") {
      const medio = i > 0 && i < pasos.length - 1, h = cur;
      cur += p.min;
      return { h, t: i === 0 ? inicio : medio ? "Transbordas" : "Te bajas y caminas", s: `${Math.max(1, Math.round(p.min))} min a pie`, k: medio ? "cam" : "apie", ic: picto("caminar") };
    }
    if (p.tipo === "camion") { cur = p.llega; return { h: p.sale, t: `Súbete a la ${escapar(p.linea)}`, s: `${Math.round(p.llega - p.sale)} min de viaje`, k: `c${color++ % 2}`, ic: picto("qrobus") }; }
    const h = cur;
    cur += p.min;
    return { h, t: `Pide ${Grieta.nombreApp(p.app)}`, s: `${Math.round(p.min)} min de viaje`, k: "cam", ic: picto("app") };
  });
}
function pintarLlegar() {
  const c = llegarEstado, caja = $("caResultado");
  if (c.offset === 0 && c.meta <= ahoraMin() + 5) return void (caja.innerHTML = '<p class="nota">Esa hora ya pasó o no da tiempo de llegar. Elige una más tarde.</p>');
  const { camion: k, app: a, base } = salidasParaLlegar(c);
  if (!k && !a) return void (caja.innerHTML = '<p class="nota">No encontré cómo llegar a esa hora. Prueba una hora más tarde.</p>');
  const enCasa = c.origen.nombre === "Casa";
  const ladoCamion = k && `<button type="button" class="hv-lado ca-l" data-ca-ver="${k.t}" aria-label="${escapar(`Sal a las ${hora(k.t)}. ${tituloOpcion(k.o)}. Ver esta ruta`)}"><span class="hv-nombre">${enCasa ? "Sal de tu casa a las" : "Sal a las"}</span><span class="hv-precio pq">${hora(k.t)}</span>${datoViaje(picto("qrobus"), escapar(tituloOpcion(k.o).replace("Qrobus ", "")))}</button>`;
  const mejor = a && rangoAppEn(base, a.t);
  const ladoApp = a && `<button type="button" class="hv-lado${k ? " der" : ""} ca-l" data-ca-ver="${a.t}" aria-label="${escapar(`Pide ${Grieta.nombreApp(mejor.app)} a las ${hora(a.t)}, precio estimado ${rangoVoz(limitesPrecio(mejor))}. Ver esta ruta`)}"><span class="hv-nombre">${k ? `O pide ${Grieta.nombreApp(mejor.app)} a las` : `Pide ${Grieta.nombreApp(mejor.app)} a las`}</span><span class="hv-precio${k ? "" : " pq azul"}">${hora(a.t)}</span>${datoViaje("", rangoTexto(limitesPrecio(mejor)))}</button>`;
  const base2 = { dia: base.dia, minuto: k?.t ?? 0 };
  const precioK = k ? (k.conApp ? `${rangoOpcion(k.o, base2) ? rangoTexto(rangoOpcion(k.o, base2)) : pesos(k.o.costo)}` : `${pesos(k.o.costo)} en Qrobus`) : "";
  const sobra = k ? Math.round(c.meta - (k.t + k.o.minutos)) : Math.round(c.meta - (a.t + a.o.minutos));
  const textoSobra = sobra > 0 ? `Te sobran ${sobra} min` : "Llegas justo a tiempo";
  const lista = k ? [...pasosConHora(k, enCasa ? "Sal de tu casa" : "Sal de donde estás"), { h: k.t + k.o.minutos, t: "Llegas", s: textoSobra, k: "fin", ic: picto("flag") }] : [];
  caja.innerHTML = `<div class="hv-caja"><div class="hv-partido${k && a ? "" : k ? " solo" : " solo solo-app"}">${k && a ? PLACAS_VIAJE : ""}${ladoCamion || ""}${ladoApp || ""}</div><div class="hv-banda"><span>${textoSobra}</span>${precioK ? `<span>${precioK}</span>` : ""}</div></div>
    ${lista.length ? `<ol class="ca-lista">${lista.map((x) => `<li class="ca-i ${x.k}"><time>${hora(x.h)}</time><span class="ca-n">${x.ic}</span><span class="ca-tx"><b>${x.t}</b><small>${x.s}</small></span></li>`).join("")}</ol>` : ""}
    ${k ? `<button type="button" class="boton hv-empezar" data-ca-avisa="${k.t}" data-que="${escapar(tituloOpcion(k.o))}">Avísame cuándo salir</button>` : ""}`;
  ajustarCifras();
  hablar([k && `En camión, sal a las ${hora(k.t)} y toma ${tituloOpcion(k.o)}.`, a && `En app, pídela a las ${hora(a.t)}.`].filter(Boolean).join(" "), false, true);
}
function verRutaLlegar(t) {
  const c = llegarEstado, salir = { dia: diaDeOffset(c.offset), minuto: t };
  $("dia").value = String(salir.dia);
  $("hora").value = Grieta.hhmm(t);
  if (estado.origen === c.origen && estado.destino === c.destino && capas.linea) {
    estado.otra = salir;
    estado.momento = ESPERAS.length;
    calcular();
    ir("opciones", true);
    return;
  }
  estado.salidaPendiente = salir;
  estado.origen = c.origen;
  irA(c.destino);
}
$("caHora").addEventListener("input", (e) => {
  const [h, m] = e.target.value.split(":").map(Number);
  if (!Number.isFinite(h)) return;
  llegarEstado.meta = h * 60 + m;
  $("caHoraTexto").textContent = hora(llegarEstado.meta);
  calcularLlegar(300);
});
$("caDias").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  llegarEstado.offset = b.dataset.d === "otro" ? Math.max(2, llegarEstado.offset) : Number(b.dataset.d);
  pintarLlegarCabeza();
  calcularLlegar();
});
$("caOtro").addEventListener("change", (e) => { llegarEstado.offset = Number(e.target.value); pintarLlegarCabeza(); calcularLlegar(); });
$("caResultado").addEventListener("click", (e) => {
  const aviso = e.target.closest("[data-ca-avisa]");
  if (aviso) return programarSalida(Number(aviso.dataset.caAvisa), aviso.dataset.que, aviso, llegarEstado.offset, llegarEstado.destino.nombre);
  const b = e.target.closest("[data-ca-ver]");
  if (b) verRutaLlegar(Number(b.dataset.caVer));
});
function llegarDesdeOpciones() {
  let meta = Math.ceil((ahoraMin() + 60) / 5) * 5, offset = 0;
  if (meta >= 1440) { meta = 420; offset = 1; }
  abrirLlegarHora({ origen: estado.origen, destino: estado.destino, kmCalle: estado.kmCalle, caminatas: estado.caminatas, offset, meta });
}

// Mi horario: a que hora entras cada dia, para decirte cuando salir sin buscar el viaje.
let miHorario = leer("grieta-horario", null), editandoHorario = null, diaElegido = null, ultimaClaveHorario = null, turnoPrevioHorario = 0;
const calculosHorario = new Map();
const horaCorta = (m) => hora(m).replace(/\s*[ap]\.?\s?m\.?$/i, "");
const FLECHA_ABAJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function proximoHorario(h = miHorario) {
  for (let d = 0; d < 8; d++) {
    const meta = h.horas[diaDeOffset(d)];
    if (meta === null || meta === undefined || (d === 0 && meta <= ahoraMin() + 5)) continue;
    return { d, meta, dia: diaDeOffset(d) };
  }
  return null;
}
function diaDelHorario(dia) {
  const meta = miHorario.horas[dia];
  if (meta === null || meta === undefined) return null;
  return { d: (dia - hoyDia() + 7) % 7 || (meta <= ahoraMin() + 5 ? 7 : 0), meta, dia };
}
const diaHorario = () => (diaElegido === null ? null : diaDelHorario(diaElegido)) ?? proximoHorario();
const claveHorario = (p, origen) => JSON.stringify([acc.colchon, miHorario, p, origen?.lat, origen?.lon, new Date().toDateString(), Math.floor(ahoraMin() / 10)]);
function calculoDelDia(p, origen) {
  const clave = claveHorario(p, origen);
  let c = calculosHorario.get(clave);
  if (c) return c;
  if (calculosHorario.size > 30) calculosHorario.clear();
  c = { clave, r: undefined };
  c.listo = salidasEnPartes({ origen, destino: miHorario.destino, kmCalle: miHorario.km ?? null, caminatas: undefined, offset: p.d, meta: p.meta }).catch(() => null).then((r) => (c.r = r));
  calculosHorario.set(clave, c);
  return c;
}
// Deja calculados los demás días para que al tocarlos salgan al instante.
async function adelantarDiasHorario(origen) {
  const turno = ++turnoPrevioHorario;
  for (let dia = 0; dia < 7; dia++) {
    if (turno !== turnoPrevioHorario || !miHorario || editandoHorario || document.body.dataset.pantalla !== "inicio") return;
    const p = diaDelHorario(dia);
    if (p) await calculoDelDia(p, origen).listo;
  }
}
const nombreLugarHtml = (l, vacio) => (l ? `<span translate="no">${escapar(l.nombre)}</span>` : `<span>${vacio}</span>`);
function pintarHorario() {
  const caja = $("horarioCaja");
  $("horarioEditar").hidden = !miHorario || Boolean(editandoHorario);
  if (editandoHorario) return pintarEditorHorario();
  if (!miHorario) {
    caja.innerHTML = `<button type="button" class="hr-boton" data-h-configurar aria-label="Configura tu horario y te digo cuándo salir cada día"><span class="hv-caja hr-previa"><span class="hv-partido">${PLACAS_VIAJE}<span class="hv-lado hr-l"><span class="hv-nombre">Sal a las</span><span class="hv-precio pq hr-vacio">--:--</span><span class="hv-dato"><span>Yo te digo</span></span></span><span class="hv-lado der hr-l"><span class="hv-nombre">Entras a las</span><span class="hv-precio hr-tenue">--:--</span><span class="hv-dato"><span>Tú me dices</span></span></span></span><span class="hv-banda"><span>Configura tu horario</span>${ico("chevron", "hr-chev")}</span></span></button>`;
    return;
  }
  pintarTarjetaHorario();
}
function pintarTarjetaHorario() {
  const caja = $("horarioCaja"), p = diaHorario();
  if (!p) { miHorario = null; escribir("grieta-horario", null); return pintarHorario(); }
  const origen = miHorario.origen ?? estado.gps ?? estado.origen ?? null;
  const titulo = `${textoDia(p.d)} a ${escapar(miHorario.destino.nombre)}, sal a las`;
  const tiras = `<div class="hr-dias">${miHorario.horas.map((m, i) => `<button type="button" data-h-elige="${i}" aria-pressed="${i === p.dia}" aria-label="${DIAS[i]}, ${m === null ? "libre" : hora(m)}" class="${m === null ? "" : "tiene"}${i === p.dia ? " sel" : ""}"><b>${DIAS[i][0].toUpperCase()}</b><small>${m === null ? "Libre" : horaCorta(m)}</small></button>`).join("")}</div>`;
  const pinta = (r) => {
    const sobra = r?.camion ? Math.round(p.meta - (r.camion.t + r.camion.o.minutos)) : null;
    const avisos = "Notification" in window && Notification.permission === "granted";
    const boton = `<button type="button" class="hr-boton" data-h-ver aria-label="${escapar(`${textoDia(p.d)} a ${miHorario.destino.nombre}. ${r?.camion ? `Sal a las ${hora(r.camion.t)}` : "Calculando"}. Entras a las ${hora(p.meta)}`)}"><span class="hv-caja hr-previa"><span class="hv-partido">${PLACAS_VIAJE}<span class="hv-lado hr-l"><span class="hv-nombre">${titulo}</span><span class="hv-precio pq">${r?.camion ? hora(r.camion.t) : "--:--"}</span>${r?.camion ? datoViaje(picto("qrobus"), escapar(tituloOpcion(r.camion.o).replace("Qrobus ", ""))) : ""}</span><span class="hv-lado der hr-l"><span class="hv-nombre">Entras a las</span><span class="hv-precio">${hora(p.meta)}</span>${r?.camion ? datoViaje(picto("flag"), `Llegas ${hora(r.camion.t + r.camion.o.minutos)}`) : ""}</span></span>${r === undefined ? "" : `<span class="hv-banda"><span>${!origen ? "Necesito saber de dónde sales" : !r?.camion ? "No encontré camión a esa hora" : sobra > 0 ? `Te sobran ${sobra} min` : "Llegas justo a tiempo"}</span>${r?.camion && avisos ? "<span>Te aviso 10 min antes</span>" : ""}</span>`}</span></button>`;
    // Solo cambia la ficha: los días no se rehacen para que el dedo no los pierda.
    const actual = caja.querySelector(".hr-boton"), dias = caja.querySelector(".hr-dias");
    if (actual && dias) {
      actual.outerHTML = boton;
      for (const b of dias.children) { const si = Number(b.dataset.hElige) === p.dia; b.classList.toggle("sel", si); b.setAttribute("aria-pressed", String(si)); }
    } else caja.innerHTML = boton + tiras;
    ajustarCifras();
  };
  if (!origen) { pinta(null); ubicar((ok) => { if (ok && document.body.dataset.pantalla === "inicio") pintarHorario(); }); return; }
  if (!Grieta.qrobus) { if (!caja.querySelector(".hr-dias")) pinta(undefined); return; }
  const calculo = calculoDelDia(p, origen);
  ultimaClaveHorario = calculo.clave;
  if (calculo.r !== undefined) { pinta(calculo.r); adelantarDiasHorario(origen); return; }
  // Al cambiar de día la ficha actual se queda hasta tener el nuevo cálculo, sin brincar.
  if (!caja.querySelector(".hr-dias")) pinta(undefined);
  calculo.listo.then((r) => {
    if (ultimaClaveHorario !== calculo.clave || document.body.dataset.pantalla !== "inicio" || !miHorario || editandoHorario) return;
    pinta(r);
    programarHorario(false);
    adelantarDiasHorario(origen);
  });
}
function pintarEditorHorario() {
  const e = editandoHorario, h = e.horas[e.dia], lista = e.abierta;
  const elegido = lista === "origen" ? e.origen : e.destino;
  const lugares = lista ? `<div class="hr-lista" role="group" aria-label="${lista === "origen" ? "Salgo de" : "Voy a"}">${guardados.map((g, i) => `<button type="button" data-h-lugar="${i}" aria-pressed="${elegido?.nombre === g.nombre}" translate="no">${escapar(g.nombre)}</button>`).join("")}${lista === "origen" ? `<button type="button" data-h-gps aria-pressed="${!e.origen}">Donde esté</button>` : ""}${guardados.length < MAX_LUGARES ? '<button type="button" data-h-nuevo>Otro lugar</button>' : ""}</div>` : "";
  const hora_ = h === null
    ? `<div class="hr-hora"><span>El ${DIAS[e.dia]} estás libre</span><button type="button" class="hr-poner" data-h-poner>Poner hora</button></div>`
    : `<div class="hr-hora"><span>El ${DIAS[e.dia]} entras a las</span><div class="hr-t"><button type="button" data-h-menos aria-label="Cinco minutos menos">−</button><span class="hr-reloj"><b id="hHoraTexto">${hora(h)}</b><input id="hHora" type="time" value="${Grieta.hhmm(h)}" aria-label="Hora de entrada"></span><button type="button" data-h-mas aria-label="Cinco minutos más">+</button></div></div>`;
  $("horarioCaja").innerHTML = `<div class="hr-editor">
    <div class="hv-caja hr-ruta"><div class="hv-partido">${PLACAS_VIAJE}<button type="button" class="hv-lado hr-l" data-h-lista="origen" aria-expanded="${lista === "origen"}"><small>Salgo de</small><b>${e.origen ? nombreLugarHtml(e.origen) : "<span>Donde esté</span>"}${FLECHA_ABAJO}</b></button><button type="button" class="hv-lado der hr-l" data-h-lista="destino" aria-expanded="${lista === "destino"}"><small>Voy a</small><b>${nombreLugarHtml(e.destino, "Elige")}${FLECHA_ABAJO}</b></button></div></div>
    ${lugares}${hora_}
    <div class="hr-riel" role="group" aria-label="Días de la semana">${e.horas.map((m, i) => `<button type="button" data-h-dia="${i}" class="${m === null ? "" : "tiene"}${i === e.dia ? " sel" : ""}" aria-pressed="${i === e.dia}" aria-label="${DIAS[i]}, ${m === null ? "libre" : hora(m)}"><b>${DIAS[i][0].toUpperCase()}</b><i></i><small data-h-corta="${i}">${m === null ? "Libre" : horaCorta(m)}</small></button>`).join("")}</div>
    ${h === null ? "" : `<div class="hr-pills"><button type="button" data-h-toda>Usar <span id="hTodaTexto">${hora(h)}</span> toda la semana</button><button type="button" data-h-libre>Este día libre</button></div>`}
    <p id="hError" class="nota" role="alert" hidden></p>
    <button type="button" class="boton hr-guardar" data-h-guardar>Guardar mi horario</button>
    <div class="hr-pills"><button type="button" data-h-cancelar>Cancelar</button>${miHorario ? '<button type="button" data-h-quitar>Quitar mi horario</button>' : ""}</div>
  </div>`;
  ajustarCifras();
}
function empezarEdicionHorario() {
  const casa = guardados.find((g) => g.nombre === "Casa");
  editandoHorario = miHorario ? { ...miHorario, horas: [...miHorario.horas], dia: proximoHorario()?.dia ?? 0, abierta: null } : { origen: casa ?? null, destino: guardados.find((g) => g.nombre !== "Casa") ?? null, horas: [420, 420, 420, 420, 420, null, null], dia: 0, abierta: null };
  pintarHorario();
}
function cambiarHoraEditor(delta) {
  const e = editandoHorario;
  e.horas[e.dia] = (e.horas[e.dia] + delta + 1440) % 1440;
  $("hHoraTexto").textContent = hora(e.horas[e.dia]);
  $("hHora").value = Grieta.hhmm(e.horas[e.dia]);
  $("hTodaTexto").textContent = hora(e.horas[e.dia]);
  document.querySelector(`[data-h-corta="${e.dia}"]`).textContent = horaCorta(e.horas[e.dia]);
}
async function guardarHorario() {
  const e = editandoHorario, error = $("hError");
  const falta = !e.destino ? "Elige a dónde vas." : !e.horas.some((m) => m !== null) ? "Pon la hora de al menos un día." : e.origen && e.origen.nombre === e.destino.nombre ? "Elige lugares distintos." : "";
  if (falta) { error.textContent = falta; error.hidden = false; return; }
  miHorario = { origen: e.origen, destino: e.destino, horas: e.horas, km: null };
  escribir("grieta-horario", miHorario);
  editandoHorario = null;
  calculosHorario.clear();
  localStorage.removeItem("grieta-horario-programado");
  pintarHorario();
  programarHorario(true);
  const o = miHorario.origen ?? estado.gps;
  if (!o) return;
  try {
    const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${e.destino.lon},${e.destino.lat}?overview=false`, { signal: AbortSignal.timeout(6000) })).json();
    miHorario.km = r.routes[0].distance / 1000;
    escribir("grieta-horario", miHorario);
    calculosHorario.clear();
    if (document.body.dataset.pantalla === "inicio" && !editandoHorario) pintarHorario();
  } catch {}
}
// Se programan los proximos tres dias con clase; el servidor guarda un solo juego por telefono, asi que se renueva al abrir la app cada dia.
async function programarHorario(conPermiso) {
  if (!miHorario || !API || !("Notification" in window) || !Grieta.qrobus) return;
  if (!conPermiso && (Notification.permission !== "granted" || leer("grieta-horario-programado", "") === new Date().toDateString())) return;
  const pendiente = leer("grieta-salida", null);
  if (!conPermiso && (guia.activa || (pendiente && pendiente.dia === new Date().toDateString() && ahoraMin() <= pendiente.t))) return;
  const origen = miHorario.origen ?? estado.gps;
  if (!origen) return;
  try {
    const suscripcion = await suscripcionPush();
    if (!suscripcion) return;
    const avisos = [], destino = miHorario.destino.nombre;
    for (let d = 0, n = 0; d < 8 && n < 3; d++) {
      const meta = miHorario.horas[diaDeOffset(d)];
      if (meta === null || meta === undefined) continue;
      const { camion: k } = await salidasEnPartes({ origen, destino: miHorario.destino, kmCalle: miHorario.km ?? null, caminatas: undefined, offset: d, meta });
      if (!k) continue;
      const fecha = cuando(k.t, d), previa = cuando(k.t - 10, d), que = tituloOpcion(k.o);
      if (Date.parse(fecha) <= Date.now()) continue;
      n++;
      if (Date.parse(previa) > Date.now()) avisos.push({ cuando: previa, titulo: `En 10 minutos sales a ${destino}`, texto: `${que}. Sal a las ${hora(k.t)}.` });
      avisos.push({ cuando: fecha, titulo: `Ya es hora de salir a ${destino}`, texto: `${que}. Sal ahora para llegar a tiempo.` });
    }
    if (!avisos.length) return;
    await llamar("/notificaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suscripcion: suscripcion.toJSON(), avisos }) });
    escribir("grieta-horario-programado", new Date().toDateString());
    if (document.body.dataset.pantalla === "inicio" && !editandoHorario && calculosHorario.size) pintarHorario();
  } catch {}
}
$("horarioEditar").addEventListener("click", empezarEdicionHorario);
$("horarioCaja").addEventListener("input", (ev) => {
  if (ev.target.id !== "hHora" || !ev.target.value) return;
  const [h, m] = ev.target.value.split(":").map(Number);
  const e = editandoHorario;
  e.horas[e.dia] = h * 60 + m;
  $("hHoraTexto").textContent = hora(e.horas[e.dia]);
  $("hTodaTexto").textContent = hora(e.horas[e.dia]);
  document.querySelector(`[data-h-corta="${e.dia}"]`).textContent = horaCorta(e.horas[e.dia]);
});
$("horarioCaja").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-h-configurar")) return empezarEdicionHorario();
  if (b.hasAttribute("data-h-elige")) {
    const i = Number(b.dataset.hElige);
    if (miHorario.horas[i] === null) { empezarEdicionHorario(); editandoHorario.dia = i; return pintarHorario(); }
    diaElegido = i;
    for (const o of b.parentElement.children) { o.classList.toggle("sel", o === b); o.setAttribute("aria-pressed", String(o === b)); }
    return pintarTarjetaHorario();
  }
  if (b.hasAttribute("data-h-ver")) {
    const p = diaHorario(), origen = miHorario.origen ?? estado.gps ?? estado.origen;
    if (p && origen) abrirLlegarHora({ origen, destino: miHorario.destino, kmCalle: miHorario.km ?? null, caminatas: undefined, offset: p.d, meta: p.meta });
    return;
  }
  const e = editandoHorario;
  if (!e) return;
  if (b.hasAttribute("data-h-mas")) return cambiarHoraEditor(5);
  if (b.hasAttribute("data-h-menos")) return cambiarHoraEditor(-5);
  if (b.hasAttribute("data-h-guardar")) return void guardarHorario();
  if (b.hasAttribute("data-h-cancelar")) { editandoHorario = null; return pintarHorario(); }
  if (b.hasAttribute("data-h-quitar")) { miHorario = null; editandoHorario = null; escribir("grieta-horario", null); localStorage.removeItem("grieta-horario-programado"); return pintarHorario(); }
  if (b.hasAttribute("data-h-nuevo")) {
    estado.guardando = { nombre: "" };
    abrirBuscar("hacia");
    $("filaDesde").hidden = true;
    $("campoBuscar").placeholder = "Busca el lugar que quieres guardar";
    titulos.buscar = $("tituloPantalla").textContent = "Guardar un lugar";
    return;
  }
  if (b.dataset.hLista) e.abierta = e.abierta === b.dataset.hLista ? null : b.dataset.hLista;
  else if (b.dataset.hLugar !== undefined) { e[e.abierta] = guardados[b.dataset.hLugar]; e.abierta = null; }
  else if (b.hasAttribute("data-h-gps")) { e.origen = null; e.abierta = null; }
  else if (b.dataset.hDia !== undefined) e.dia = Number(b.dataset.hDia);
  else if (b.hasAttribute("data-h-poner")) e.horas[e.dia] = e.horas.find((m) => m !== null) ?? 420;
  else if (b.hasAttribute("data-h-libre")) e.horas[e.dia] = null;
  else if (b.hasAttribute("data-h-toda")) { const h = e.horas[e.dia]; e.horas = e.horas.map((m, i) => (i < 5 || m !== null ? h : m)); }
  const clave = [...b.attributes].find((a) => a.name.startsWith("data-h-"));
  pintarHorario();
  if (clave) document.querySelector(`#horarioCaja [${clave.name}${clave.value ? `="${clave.value}"` : ""}]`)?.focus({ preventScroll: true });
});

const dialogoLugar = $("dialogoLugar");
const campoLugarGuardado = $("nombreLugarGuardado");
const selectorLugares = "#guardados button[data-i], #vozLugares button[data-i], #vozCasa[data-i]";
let lugarElegido = null, botonLugarElegido = null;
let pulsacionLugar = null, omitirClicLugar = false;

function enfocarLugarGuardado(lugar) {
  const indice = guardados.indexOf(lugar);
  const botones = acc.modoVoz ? [$("vozCasa"), ...$("vozLugares").children] : [...$("guardados").children];
  botones.find(boton => !boton.hidden && boton.dataset.i === String(indice))?.focus();
}
function quitarLugar(lugar) {
  const indice = guardados.indexOf(lugar);
  if (indice < 0) return;
  const pantalla = document.body.dataset.pantalla;
  quitado = { lugar, i: indice, pantalla };
  guardados.splice(indice, 1);
  if (!guardados.length) editando = false;
  guardarLugares();
  $("deshacerInicio").querySelector("[data-deshacer]")?.focus({ focusVisible: false });
}
function deshacerLugar() {
  if (!quitado) return;
  const { lugar, i } = quitado;
  quitado = null;
  guardados.splice(i, 0, lugar);
  guardarLugares();
  enfocarLugarGuardado(lugar);
  hablar(`${lugar.nombre} regresó a tus lugares.`, false, true);
}
function abrirAccionesLugar(boton, lugar = guardados[boton.dataset.i]) {
  if (!lugar || dialogoLugar.open) return;
  lugarElegido = lugar;
  botonLugarElegido = boton;
  $("tituloAccionesLugar").textContent = lugar.nombre;
  const indice = guardados.indexOf(lugar);
  $("fichaDialogoLugar").className = `mini-ficha ${tonoLugar(lugar.nombre, indice)}`;
  $("fichaDialogoLugar").innerHTML = picto(iconoLugar(lugar.nombre));
  $("accionesLugar").hidden = false;
  $("formularioLugar").hidden = true;
  campoLugarGuardado.value = lugar.nombre;
  $("otroNombreLugar").hidden = true;
  ToquesGrieta.reiniciar();
  dialogoLugar.showModal();
  $("tituloAccionesLugar").focus();
}
$("cerrarDialogoLugar").addEventListener("click", () => dialogoLugar.close());
dialogoLugar.addEventListener("close", () => {
  if (dialogoLugar.open) return;
  if (botonLugarElegido?.isConnected && !botonLugarElegido.closest("[hidden]")) botonLugarElegido.focus({ preventScroll: true });
  lugarElegido = botonLugarElegido = null;
});
dialogoLugar.addEventListener("click", (e) => {
  if (e.target !== dialogoLugar) return;
  const { left, right, top, bottom } = dialogoLugar.getBoundingClientRect();
  if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) dialogoLugar.close();
});
$("editarNombreLugar").addEventListener("click", () => {
  $("accionesLugar").hidden = true;
  $("formularioLugar").hidden = false;
  campoLugarGuardado.focus();
  campoLugarGuardado.select();
});
campoLugarGuardado.addEventListener("input", () => { $("otroNombreLugar").hidden = true; });
$("quitarLugarInicio").addEventListener("click", () => {
  const lugar = lugarElegido;
  dialogoLugar.close();
  quitarLugar(lugar);
});
function nombreValidoLugar() {
  const nombre = campoLugarGuardado.value.trim().replace(/\s+/g, " ");
  const repetido = guardados.some(lugar => lugar !== lugarElegido && sinAcentos(lugar.nombre) === sinAcentos(nombre));
  $("otroNombreLugar").hidden = Boolean(nombre) && !repetido;
  if (!nombre || repetido) { campoLugarGuardado.focus(); return null; }
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
function guardarEdicionLugar(edicion, ubicacion = edicion.lugar) {
  const indice = guardados.indexOf(edicion.lugar);
  if (indice < 0) return null;
  const lugar = { ...edicion.lugar, nombre: edicion.nombre, lat: ubicacion.lat, lon: ubicacion.lon };
  guardados[indice] = lugar;
  quitado = null;
  guardarLugares();
  return lugar;
}
$("formularioLugar").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = nombreValidoLugar();
  if (!nombre) return;
  const edicion = { lugar: lugarElegido, nombre };
  dialogoLugar.close();
  const lugar = guardarEdicionLugar(edicion);
  if (lugar) enfocarLugarGuardado(lugar);
});
$("cambiarUbicacionLugar").addEventListener("click", () => {
  const nombre = nombreValidoLugar();
  if (!nombre) return;
  cambioUbicacionGuardada = { lugar: lugarElegido, nombre };
  dialogoLugar.close();
  abrirBuscar("hacia");
});

function cancelarPulsacionLugar() {
  clearTimeout(pulsacionLugar?.reloj);
  pulsacionLugar = null;
}
addEventListener("pointerdown", (e) => {
  cancelarPulsacionLugar();
  omitirClicLugar = false;
  const boton = e.target.closest?.(selectorLugares);
  if (!boton || e.button !== 0 || !e.isPrimary) return;
  const { pointerId, clientX, clientY } = e;
  const reloj = setTimeout(() => {
    cancelarPulsacionLugar();
    if (!boton.isConnected || boton.closest("[hidden]")) return;
    omitirClicLugar = true;
    abrirAccionesLugar(boton);
  }, 500);
  pulsacionLugar = { pointerId, clientX, clientY, reloj };
}, { capture: true, passive: true });
addEventListener("pointermove", (e) => {
  if (pulsacionLugar?.pointerId !== e.pointerId) return;
  if (Math.hypot(e.clientX - pulsacionLugar.clientX, e.clientY - pulsacionLugar.clientY) <= 12) return;
  omitirClicLugar = true;
  cancelarPulsacionLugar();
}, { passive: true });
for (const tipo of ["pointerup", "pointercancel", "blur"]) addEventListener(tipo, cancelarPulsacionLugar, true);
addEventListener("scroll", () => {
  if (!pulsacionLugar) return;
  omitirClicLugar = true;
  cancelarPulsacionLugar();
}, { capture: true, passive: true });
addEventListener("click", (e) => {
  if (!omitirClicLugar || !e.detail) return;
  omitirClicLugar = false;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
$("inicio").addEventListener("contextmenu", (e) => {
  const boton = e.target.closest(selectorLugares);
  if (!boton) return;
  e.preventDefault();
  if (e.button === 2 && !pulsacionLugar) abrirAccionesLugar(boton);
});
$("inicio").addEventListener("keydown", (e) => {
  if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
  const boton = e.target.closest(selectorLugares);
  if (!boton) return;
  e.preventDefault();
  abrirAccionesLugar(boton);
});
$("guardarLugar").addEventListener("click", () => {
  const abierto = $("nombresLugar").hidden;
  $("nombresLugar").hidden = !abierto;
  $("guardarLugar").setAttribute("aria-expanded", String(abierto));
  if (abierto) $("nombresLugar").querySelector("button").focus();
});
function guardarNuevo(lugar, nombre, atras) {
  const anterior = guardados.find((g) => sinAcentos(g.nombre) === sinAcentos(nombre)) ?? null;
  const otros = guardados.filter((g) => g !== anterior);
  if (otros.length >= MAX_LUGARES) return hablar("Ya tienes 4 lugares guardados. Borra uno para guardar otro.", false, true);
  guardados = otros.concat({ nombre, lat: lugar.lat, lon: lugar.lon });
  nuevoGuardado = { nombre, lugar: lugar.nombre, anterior };
  guardarLugares();
  hablar(`Guardé ${lugar.nombre} como ${nombre}.`);
  history.go(-atras);
}
function deshacerNuevo() {
  if (!nuevoGuardado) return;
  const { nombre, anterior } = nuevoGuardado;
  nuevoGuardado = null;
  guardados = guardados.filter((g) => g.nombre !== nombre).concat(anterior ? [anterior] : []);
  guardarLugares();
  hablar(anterior ? `${nombre} regresó a como estaba.` : `Quité ${nombre} de tus lugares.`, false, true);
}
const marcarNombreNuevo = radios("nombresNuevo", (v) => { porGuardar.nombre = v; pintarGuardarNuevo(); if (v === "Otro") { $("otroNuevo").hidden = false; $("campoNuevo").focus(); } else $("otroNuevo").hidden = true; });
function nombreNuevo() {
  if (porGuardar?.nombre !== "Otro") return porGuardar?.nombre ?? "";
  const escrito = $("campoNuevo").value.trim().replace(/\s+/g, " ");
  return escrito && escrito.charAt(0).toUpperCase() + escrito.slice(1);
}
function pintarGuardarNuevo() {
  const nombre = nombreNuevo();
  $("guardarNuevo").disabled = !nombre;
  $("guardarNuevo").textContent = nombre ? `Guardar como ${nombre}` : porGuardar?.nombre === "Otro" ? "Escribe el nombre" : "Elige un nombre";
}
function abrirNombrar(lugar, atras) {
  porGuardar = { lugar, atras, nombre: null };
  $("nombrarLugar").innerHTML = `${miniFicha("tono-anil", picto("lugar"))}<span class="fila-texto"><strong translate="no">${escapar(lugar.nombre)}</strong>${lugar.detalle ? `<small translate="no">${escapar(lugar.detalle)}</small>` : ""}</span>`;
  marcarNombreNuevo(null);
  $("otroNuevo").hidden = true;
  $("campoNuevo").value = "";
  pintarGuardarNuevo();
  ir("nombrar", true);
}
$("campoNuevo").addEventListener("input", pintarGuardarNuevo);
$("campoNuevo").addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("guardarNuevo").disabled) $("guardarNuevo").click(); });
$("guardarNuevo").addEventListener("click", () => { const nombre = nombreNuevo(); if (nombre) guardarNuevo(porGuardar.lugar, nombre, porGuardar.atras); });
function guardarComo(nombre) {
  const { lat, lon } = estado.destino;
  const otros = guardados.filter((g) => sinAcentos(g.nombre) !== sinAcentos(nombre));
  if (otros.length >= MAX_LUGARES) return hablar("Ya tienes 4 lugares guardados. Borra uno para guardar otro.", false, true);
  guardados = otros.concat({ nombre, lat, lon });
  guardarLugares();
  $("nombresLugar").hidden = true;
  $("otroNombre").hidden = true;
  $("guardarLugar").setAttribute("aria-expanded", "false");
  $("guardarLugar").textContent = `Guardado como ${nombre}`;
  $("guardarLugar").disabled = true;
  $("lugarGuardado").textContent = `Guardé ${estado.destino.nombre} como ${nombre}.`;
  $("lugarGuardado").hidden = false;
  hablar(`Guardé ${estado.destino.nombre} como ${nombre}.`);
}
$("nombresLugar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  // Un nombre propio para el lugar: el hospital, la casa de un familiar.
  if (b.hasAttribute("data-otro")) {
    $("otroNombre").hidden = false;
    $("campoNombre").value = "";
    return $("campoNombre").focus();
  }
  guardarComo(b.dataset.v);
});
function guardarNombreEscrito() {
  const nombre = $("campoNombre").value.trim().replace(/\s+/g, " ");
  if (!nombre) return $("campoNombre").focus();
  guardarComo(nombre.charAt(0).toUpperCase() + nombre.slice(1));
}
$("guardarNombre").addEventListener("click", guardarNombreEscrito);
$("campoNombre").addEventListener("keydown", (e) => { if (e.key === "Enter") guardarNombreEscrito(); });

// Grupos de opciones con flechas, como radios nativos.
function radios(id, alElegir) {
  const grupo = $(id);
  const marcar = (b) => {
    for (const x of grupo.querySelectorAll("[role=radio]")) {
      x.setAttribute("aria-checked", String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    }
    b.classList.remove("salta");
    void b.offsetWidth;
    b.classList.add("salta");
    alElegir(b.dataset.v);
  };
  grupo.addEventListener("click", (e) => {
    const b = e.target.closest("[role=radio]");
    if (b && !b.disabled) marcar(b);
  });
  grupo.addEventListener("keydown", (e) => {
    const lista = [...grupo.querySelectorAll("[role=radio]:not(:disabled)")];
    const i = lista.indexOf(document.activeElement);
    const paso = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (i < 0 || !paso) return;
    e.preventDefault();
    const sig = lista[(i + paso + lista.length) % lista.length];
    sig.focus();
    marcar(sig);
  });
  return (v) => {
    for (const x of grupo.querySelectorAll("[role=radio]")) {
      x.setAttribute("aria-checked", String(x.dataset.v === v));
      x.tabIndex = x.dataset.v === v || (!v && x === grupo.firstElementChild) ? 0 : -1;
    }
  };
}

// API de Grieta para reportes y precios. Sin direccion configurada, esas funciones avisan y no mandan nada.
let API = "";
async function llamar(ruta, opciones = {}) {
  if (!API) throw new Error("sin api");
  const r = await fetch(`${API}${ruta}`, opciones).catch(() => { throw new Error("sin conexion"); });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "error");
  return r.status === 204 ? null : r.json();
}
const NOMBRES_REPORTE = {
  banqueta: "Banqueta rota", sin_rampa: "No hay rampa", sin_techo: "Parada sin techo",
  obstaculo: "Obstáculo en el camino", sin_senalizacion: "Falta señalización", referencia: "Referencia", otro: "Aviso",
};
async function reportesCerca(lat, lon, radio = 120) {
  try { return await llamar(`/reportes?lat=${lat}&lon=${lon}&radio=${radio}`); } catch { return []; }
}
// Al llegar a una parada lee lo que otros dejaron: como encontrarla y que cuidar.
async function leerReferencias(parada) {
  const lista = await reportesCerca(parada.lat, parada.lon, 60);
  if (!lista.length) return;
  const refs = lista.filter((x) => x.tipo === "referencia" && x.descripcion).map((x) => x.descripcion);
  const avisos = lista.filter((x) => x.tipo !== "referencia").map((x) => (NOMBRES_REPORTE[x.tipo] ?? "aviso").toLowerCase());
  const mensajes = [];
  if (refs.length) mensajes.push(frase("referencia_parada", { referencia: refs[0] }));
  if (avisos.length) {
    if (mensajes.length) mensajes.push(" ");
    mensajes.push(frase("aviso_parada", { avisos: [...new Set(avisos)].join(", ") }));
  }
  if (mensajes.length) hablar(mensajes, true);
}

// ¿Es mi parada? GPS contra la parada de enfrente, y si no alcanza, la brujula: mirando a la calle, el carril
// pegado a la banqueta circula hacia la derecha. Nada de esto sale del telefono.
function textoRevision(r, c) {
  const enfrente = r.opuesta?.hacia ? `La de enfrente va hacia ${r.opuesta.hacia}.` : null;
  if (r.estado === "si") return [`Sí, es tu parada: ${cruce(c.recorrido[0].nombre)}.`, `Aquí pasa la ${c.linea} hacia ${c.hacia}.`, enfrente].filter(Boolean);
  if (r.estado === "enfrente") return ["Parece que estás en la parada de enfrente.", r.opuesta?.hacia ? `Ahí la ${c.linea} va hacia ${r.opuesta.hacia}.` : null, `Tu parada está cruzando la calle, a unos ${r.metros} metros.`].filter(Boolean);
  if (r.estado === "lejos") return ["Todavía no llegas.", `Tu parada está a unos ${r.metros} metros.`];
  if (r.estado === "dudosa") return ["No estoy seguro de qué lado de la calle estás.", `El GPS tiene un error de ${r.precision} metros y la parada de enfrente está a ${r.opuesta?.separacion ?? 0} metros.`, r.mismoNombre ? "Las dos tienen el mismo nombre en el letrero." : "Puedes leer el letrero con la cámara."];
  return ["No pude saber dónde estás.", "Activa la ubicación."];
}
// Cada oracion en su span: los nombres de parada traen "Av." y romperian el corte por oraciones al traducir.
function mostrarRevision(oraciones, estado) {
  const lista = [].concat(oraciones);
  $("paradaRevision").innerHTML = lista.map((t) => `<span>${escapar(t)}</span>`).join(" ");
  $("paradaRevision").className = `aviso revision-parada ${estado}`;
  $("paradaRevision").hidden = false;
  hablar(lista.join(" "), false, true);
}
$("esMiParada").addEventListener("click", () => {
  const c = guia.camion;
  if (!c) return;
  $("esMiParada").disabled = true;
  mostrarRevision("Revisando dónde estás…", "");
  navigator.geolocation?.getCurrentPosition(({ coords }) => {
    $("esMiParada").disabled = false;
    const r = Grieta.revisarParada({ lat: coords.latitude, lon: coords.longitude, precision: coords.accuracy, objetivo: { ...c.recorrido[0], linea: c.linea, hacia: c.hacia } });
    guia.revision = r;
    mostrarRevision(textoRevision(r, c), r.estado);
    $("brujulaParada").hidden = r.vistaCalle === null || r.estado === "lejos" || !r.opuesta;
    if (r.estado === "si") leerReferencias(c.recorrido[0]);
  }, () => { $("esMiParada").disabled = false; mostrarRevision(textoRevision({ estado: "sin_datos" }, c), "dudosa"); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
});
// Rumbo de la brujula: iPhone da webkitCompassHeading; Android, alpha absoluto que crece en sentido contrario.
function leerBrujula(ms = 2000) {
  return new Promise((listo) => {
    const lecturas = [];
    const tomar = (e) => {
      const h = Number.isFinite(e.webkitCompassHeading) ? e.webkitCompassHeading : e.absolute && Number.isFinite(e.alpha) ? (360 - e.alpha) % 360 : null;
      if (h !== null) lecturas.push(h * Math.PI / 180);
    };
    const eventos = ["deviceorientationabsolute", "deviceorientation"];
    eventos.forEach((e) => window.addEventListener(e, tomar));
    setTimeout(() => {
      eventos.forEach((e) => window.removeEventListener(e, tomar));
      if (lecturas.length < 3) return listo(null);
      const x = lecturas.reduce((s, a) => s + Math.cos(a), 0), y = lecturas.reduce((s, a) => s + Math.sin(a), 0);
      listo((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
    }, ms);
  });
}
$("brujulaParada").addEventListener("click", async () => {
  const c = guia.camion, r = guia.revision;
  if (!c || r?.vistaCalle == null) return;
  try { const permiso = window.DeviceOrientationEvent?.requestPermission; if (typeof permiso === "function" && await permiso.call(window.DeviceOrientationEvent) !== "granted") throw Error(); }
  catch { return mostrarRevision(["Sin permiso para la brújula.", "Actívalo en la configuración del navegador."], "dudosa"); }
  mostrarRevision("Párate de frente a la calle, con la banqueta a tu espalda, y sostén el teléfono plano frente a ti.", "");
  await new Promise((listo) => setTimeout(listo, 3500));
  const vista = await leerBrujula();
  if (vista === null) return mostrarRevision(["Tu teléfono no dio la brújula.", "Lee el letrero con la cámara o pregunta en la parada."], "dudosa");
  const lado = Grieta.ladoPorBrujula(vista, r.vistaCalle);
  mostrarRevision(lado === "si" ? [`Según la brújula, estás del lado correcto: de este lado los camiones van hacia ${c.hacia}.`]
    : lado === "enfrente" ? [`Según la brújula, estás del lado contrario: de este lado van hacia ${r.opuesta?.hacia ?? c.hacia}.`, "Tu parada está cruzando la calle."]
      : ["La brújula no fue clara.", "Gira hasta quedar de frente a la calle e intenta otra vez."], lado);
});

// Reportar un problema donde estas parado.
const reporte = { tipo: null, lat: null, lon: null, parada: null, ruta: null };
const TIPOS_QUEJA = { no_paro: "No hizo la parada", sucio: "Unidad sucia o en mal estado", manejo: "Manejo peligroso", cobro: "Me cobraron de más", acoso: "Acoso o agresión", otro_servicio: "Otra cosa del servicio" };
const esQueja = (t) => Object.hasOwn(TIPOS_QUEJA, t);
const marcarRutaQueja = radios("rutasQueja", (v) => { reporte.ruta = v; $("rutaQueja").value = ""; });
$("rutaQueja").addEventListener("input", () => {
  reporte.ruta = null;
  for (const b of $("rutasQueja").querySelectorAll("[role=radio]")) b.setAttribute("aria-checked", "false");
});
// Las rutas que pasan por la parada mas cercana, para no tener que escribirla.
function pintarRutasQueja(lat, lon) {
  const lineas = [...new Set(Grieta.pasanAqui(lat, lon, hoyDia(), ahoraMin(), 600, 1).flatMap((p) => p.lineas.map((l) => l.linea)))].slice(0, 8);
  $("rutasQueja").innerHTML = lineas.map((l, i) => `<button type="button" role="radio" aria-checked="false" tabindex="${i ? -1 : 0}" data-v="${escapar(l)}" translate="no">${escapar(l)}</button>`).join("");
}
// Lo demas del reporte aparece hasta elegir el problema, para que la pantalla pida una cosa a la vez.
const marcarReporte = radios("tipoReporte", (v) => {
  reporte.tipo = v;
  $("quejaCamion").hidden = !esQueja(v);
  $("quejaAcoso").hidden = v !== "acoso";
  $("fotoReporte").hidden = esQueja(v);
  $("descripcion").placeholder = v === "acoso" ? "Ejemplo: qué pasó y a qué hora" : esQueja(v) ? "Ejemplo: le hice la parada y siguió de largo" : "Ejemplo: la parada está frente al OXXO, junto al poste amarillo";
  if (v) $("quejaListo").hidden = true;
  const nuevo = $("reporteResto").hidden && v;
  $("reporteResto").hidden = !v;
  if (v) $("reporteEstado").className = "nota";
  // El formulario se ve desde su primer campo; antes bajaba hasta el boton y cortaba el aviso del 911.
  if (nuevo) setTimeout(() => $("reporteResto").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 50);
});
// En una parada lo probable es reportar la parada; arriba o en el camion, el servicio.
function ordenarReporte(enParada) {
  const grupo = $("tipoReporte");
  grupo.prepend($(enParada ? "grupoCalleReporte" : "grupoCamionReporte"));
  if (!grupo.querySelector("[aria-checked=true]")) grupo.querySelectorAll("[role=radio]").forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
}
function abrirReporte(paradaFijada = null) {
  Object.assign(reporte, { tipo: null, lat: null, lon: null, parada: null, ruta: null });
  marcarReporte(null);
  $("rutaQueja").value = ""; $("unidadQueja").value = ""; $("rutasQueja").innerHTML = ""; $("quejaListo").hidden = true;
  $("descripcion").value = "";
  $("foto").value = "";
  $("fotoTexto").textContent = "Agregar foto (si quieres)";
  $("reporteResto").hidden = true;
  $("reporteEstado").textContent = "";
  $("reporteEstado").className = "nota";
  $("reporteDonde").textContent = "Buscando dónde estás...";
  // En la calle o en una parada van primero sus problemas; las quejas del servicio, si vas arriba del camion.
  let enCamion = guia.activa && guia.fase === "camion";
  ordenarReporte(!enCamion);
  ir("reporte");
  const fijar = async (lat, lon) => {
    Object.assign(reporte, { lat, lon });
    pintarRutasQueja(lat, lon);
    const p = Grieta.pasanAqui(lat, lon, hoyDia(), ahoraMin(), 120)[0];
    reporte.parada = p?.nombre ?? null;
    // Cerca de una parada, el reporte queda en la parada para que lo encuentre quien la consulte.
    if (p) {
      Object.assign(reporte, { lat: p.lat, lon: p.lon });
      if (!reporte.tipo && !enCamion) ordenarReporte(true);
      $("reporteDonde").textContent = `En la parada ${cruce(p.nombre)}`;
      return;
    }
    $("reporteDonde").textContent = "En tu ubicación actual";
    try {
      const r = await (await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`)).json();
      const calle = r.features[0]?.properties?.street ?? r.features[0]?.properties?.name;
      if (calle) $("reporteDonde").textContent = `En ${calle}`;
    } catch {}
  };
  if (paradaFijada) {
    Object.assign(reporte, { lat: paradaFijada.lat, lon: paradaFijada.lon, parada: paradaFijada.nombre });
    pintarRutasQueja(paradaFijada.lat, paradaFijada.lon);
    ordenarReporte(true);
    $("reporteDonde").textContent = `En la parada ${cruce(paradaFijada.nombre)}`;
    return;
  }
  navigator.geolocation?.getCurrentPosition(
    ({ coords }) => {
      if (coords.speed > 4 && !reporte.tipo) { enCamion = true; ordenarReporte(false); }
      fijar(coords.latitude, coords.longitude);
    },
    () => (estado.origen ? fijar(estado.origen.lat, estado.origen.lon) : ($("reporteDonde").textContent = "Activa la ubicación para reportar")),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}
// Las fotos del telefono pesan varios MB y traen las coordenadas de donde se tomaron: se redibujan
// a 1600 px en JPEG, que no conserva esos datos. Si no se puede, no se sube la original.
async function achicarFoto(f) {
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return await new Promise((listo) => lienzo.toBlob(listo, "image/jpeg", 0.85));
  } catch {
    return null;
  }
}
$("foto").addEventListener("change", () => {
  const f = $("foto").files[0];
  $("fotoTexto").textContent = f ? "Foto lista. Toca para cambiarla" : "Agregar foto (si quieres)";
});
$("enviarReporte").addEventListener("click", async () => {
  const decirR = (t) => { $("reporteEstado").textContent = t; hablar(t, false, true); };
  if (!reporte.tipo) return decirR("Elige qué problema encontraste.");
  if (reporte.lat === null) return decirR("Todavía no sé dónde estás. Activa la ubicación.");
  if (!API) return decirR("Los reportes todavía no están conectados al servidor.");
  if (esQueja(reporte.tipo)) return enviarQueja(decirR);
  $("enviarReporte").disabled = true;
  try {
    const nuevo = await llamar("/reportes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: reporte.tipo, parada: reporte.parada, lat: reporte.lat, lon: reporte.lon, descripcion: $("descripcion").value.trim() || null }),
    });
    const f = $("foto").files[0];
    let conFoto = true;
    if (f) {
      try {
        const foto = await achicarFoto(f);
        if (!foto) throw new Error("foto");
        await llamar(`/reportes/${nuevo.id}/foto`, { method: "POST", headers: { "Content-Type": foto.type }, body: foto });
      } catch {
        conFoto = false;
      }
    }
    decirR(conFoto ? "Gracias. Tu reporte ayuda a quien pase por aquí." : "Se guardó tu reporte, pero no se pudo subir la foto.");
    $("reporteEstado").className = "nota listo";
    $("reporteResto").hidden = true;
    $("reporteEstado").scrollIntoView({ block: "nearest" });
    // El reporte ya existe: se limpia el formulario para que otro toque no lo mande dos veces.
    Object.assign(reporte, { tipo: null });
    marcarReporte(null);
    $("descripcion").value = "";
    $("foto").value = "";
    $("fotoTexto").textContent = "Agregar foto (si quieres)";
  } catch (err) {
    decirR(["sin api", "sin conexion"].includes(err.message)
      ? "No se pudo enviar: no hay conexión con Grieta. Revisa tu internet e intenta otra vez."
      : `No se pudo enviar: ${err.message}.`);
    $("reporteEstado").scrollIntoView({ block: "nearest" });
  } finally {
    $("enviarReporte").disabled = false;
  }
});

// Que bono de Qrobus sale mas barato al mes segun cuantos viajes hace la persona. Precios de prensa (ADN40, Posta 2026).
const BONOS = {
  normal: { viaje: 11, opciones: [["Semanal", 111, 7], ["Quincenal", 231, 15], ["Mensual", 451, 30]] },
  unidos: { viaje: 2, opciones: [["Mensual", 86, 30]] },
};
const bono = { semana: 10, tarifa: "normal" };
function viajesDeHistorial() {
  const desde = Date.now() - 28 * 864e5;
  const recientes = historial.filter((h) => new Date(h.fecha) >= desde && h.camiones > 0);
  return recientes.length ? Math.round(recientes.length / 4) : 0;
}
function pintarBonos() {
  const t = BONOS[bono.tarifa], alMes = bono.semana * 30 / 7;
  const filas = [["Pagar cada viaje", alMes * t.viaje], ...t.opciones.map(([n, precio, dias]) => [`Bono ${n.toLowerCase()}`, precio * 30 / dias])];
  const mejor = filas.reduce((a, b) => (b[1] < a[1] ? b : a));
  const porViaje = filas[0][1];
  $("viajesSemana").textContent = bono.semana;
  $("bonoOpciones").innerHTML = filas.map(([n, c]) => {
    const extra = Math.round(c - mejor[1]);
    return `<li class="${n === mejor[0] ? "mejor" : ""}"><i aria-hidden="true">${n === mejor[0] ? ico("palomita") : ""}</i><span>${n}<small>${n === mejor[0] ? "La más barata" : extra ? `${pesos(extra)} más al mes` : "Cuesta lo mismo"}</small></span><strong>${pesos(c)}</strong></li>`;
  }).join("");
  const umbral = Math.ceil(t.opciones.at(-1)[1] / t.viaje);
  $("bonoVeredicto").innerHTML = `<small>Te conviene</small><div><strong>${mejor[0]}</strong><b>${pesos(mejor[1])}<small> al mes</small></b></div><span>${mejor === filas[0] ? `El bono mensual conviene desde ${umbral} viajes al mes.` : `Ahorras ${pesos(porViaje - mejor[1])} al mes contra pagar cada viaje.`}</span>`;
}
const marcarTarifaBonos = radios("tarifaBonos", (v) => { bono.tarifa = v; pintarBonos(); });
// Camioncito de hojalata (Figma): sube de nivel con lo ahorrado en el mes y se llena con $5000.
const NIVELES_AHORRO = [0, 1, 1250, 2500, 3750, 5000];
function pintarAlcancia(mes) {
  const A = ARTE_ESC.ahorro, nivel = NIVELES_AHORRO.findLastIndex((desde) => mes >= desde), siguiente = NIVELES_AHORRO[nivel + 1];
  const cae = nivel ? `<g transform="translate(296 -52)"><g class="moneda-cae">${A.moneda}</g></g>` : "";
  $("alcancia").innerHTML = `${A[horario()]}${A[`nivel${nivel}`]}${cae}<g transform="translate(330 340) scale(${(0.66 / ESCALA_TL).toFixed(3)})">${tlacuache(nivel ? 4 : 3)}</g>`;
  $("alcancia").setAttribute("aria-label", nivel === 5 ? "Camioncito de hojalata lleno de monedas" : nivel ? `Camioncito de hojalata en el nivel ${nivel} de 5` : "Camioncito de hojalata vacío");
  const texto = !nivel ? "Tu primer viaje en camión pone la primera moneda." : siguiente === undefined ? "Camioncito lleno este mes" : `Faltan ${pesos(siguiente - mes)} para el nivel ${nivel + 1}`;
  $("ahorroPie").innerHTML = `<span>${texto}</span><span class="bloque-puntos" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= nivel ? "lleno" : ""}"></i>`).join("")}</span>`;
}
// Lo ahorrado contado en cosas de todos los dias, y la gasolina que tu carro habria quemado en esos mismos viajes.
function cosasAhorro(monto, co2Mes) {
  const gasolina = (co2Mes / CO2_AUTO_G_KM / AUTO_KM_LITRO) * precioGasolina(), viajes = Math.floor(monto / BONOS.normal.viaje), meses = Math.floor(monto / 139);
  return [
    ["qrobus", String(viajes), viajes === 1 ? "viaje en Qrobus" : "viajes en Qrobus"],
    ["pantalla", meses >= 1 ? String(meses) : `${Math.round((monto / 139) * 100)}%`, meses > 1 ? "meses de Netflix" : meses === 1 ? "mes de Netflix" : "de un mes de Netflix"],
    ["gasolina", pesos(gasolina), "de gasolina"],
  ].filter(([p]) => p !== "gasolina" || acc.gasolina !== "no").map(([p, cifra, texto]) => `<li class="eq-${p}">${picto(p)}<strong>${cifra}</strong><span>${texto}</span></li>`).join("");
}
// Ahorro por mes desde el primero con ahorro, hasta seis; con uno solo no hay grafica.
function pintarMeses() {
  const hoy = new Date(), meses = Array.from({ length: 6 }, (_, i) => ({ d: new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1), p: 0 }));
  for (const h of historial) {
    const f = new Date(h.fecha), i = (f.getFullYear() - meses[0].d.getFullYear()) * 12 + f.getMonth() - meses[0].d.getMonth();
    if (i >= 0 && i < 6) meses[i].p += h.ahorro || 0;
  }
  const visibles = meses;
  $("ahorroMesesCaja").hidden = !meses.some((x) => x.p >= 1);
  if ($("ahorroMesesCaja").hidden) return;
  const max = Math.max(...visibles.map((x) => x.p)), paso = 320 / visibles.length;
  $("ahorroMeses").innerHTML = visibles.map((x, i) => {
    const alto = x.p >= 1 ? Math.max(6, (x.p / max) * 72) : 3, cx = paso * (i + 0.5), ultimo = i === visibles.length - 1;
    return `<rect class="barra${x.p >= 1 ? "" : " vacia"}${ultimo ? " actual" : ""}" x="${cx - 16}" y="${96 - alto}" width="32" height="${alto}" rx="${Math.min(6, alto / 2)}"/>
      ${x.p >= 1 ? `<text class="valor" x="${cx}" y="${89 - alto}" text-anchor="middle">${pesos(x.p)}</text>` : ""}
      <text class="dia${ultimo ? " actual" : ""}" x="${cx}" y="114" text-anchor="middle">${MESES[x.d.getMonth()]}</text>`;
  }).join("");
  $("ahorroMeses").setAttribute("aria-label", `Ahorro por mes: ${visibles.map((x) => `${MESES[x.d.getMonth()]}, ${pesos(x.p)}`).join("; ")}`);
}
function abrirAhorro() {
  const hoy = new Date(), delMes = historial.filter((h) => { const f = new Date(h.fecha); return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth() && h.ahorro > 0; });
  const mes = delMes.reduce((s, h) => s + h.ahorro, 0), conAhorro = historial.filter((h) => h.ahorro > 0), total = conAhorro.reduce((s, h) => s + h.ahorro, 0);
  ponerCifra("ahorroTotal", pesos(mes));
  $("ahorroQuien").textContent = delMes.length ? `ahorrados en ${plural(delMes.length, "viaje", "viajes")} este mes` : "Aún sin viajes en camión este mes";
  pintarAlcancia(mes);
  $("tituloEquivaleAhorro").hidden = $("ahorroEquivale").hidden = mes < 1;
  $("ahorroEquivale").innerHTML = cosasAhorro(mes, delMes.reduce((s, h) => s + (h.co2 || 0), 0));
  $("ahorroHistorico").textContent = `${pesos(total)} en total`;
  pintarMeses();
  prepararBonos();
  pintarVistaAhorro();
  ir("ahorro");
  llenarPrimeraVista("ahorro");
}
// Mi meta: lo ahorrado desde el inicio del mes en que se eligio, con el camioncito rumbo a la bandera.
const leerMeta = () => leer("grieta-meta-ahorro", null);
let vistaAhorro = "mes";
function pintarVistaAhorro() {
  $("ahorroVistaMes").hidden = vistaAhorro !== "mes";
  $("ahorroVistaMeta").hidden = vistaAhorro !== "meta";
  if (vistaAhorro === "meta") pintarMeta();
}
radios("ahorroVista", (v) => { vistaAhorro = v; pintarVistaAhorro(); llenarPrimeraVista("ahorro"); });
function cuandoLlegas(dias) {
  if (dias <= 1) return "mañana";
  if (dias < 14) return `en unos ${dias} días`;
  return dias < 60 ? `en unas ${Math.round(dias / 7)} semanas` : `en unos ${Math.round(dias / 30)} meses`;
}
function pintarMeta() {
  const meta = leerMeta();
  $("metaElegir").hidden = Boolean(meta);
  $("metaAvance").hidden = !meta;
  if (!meta) return;
  const creada = new Date(meta.desde), inicio = new Date(creada.getFullYear(), creada.getMonth(), 1);
  const conAhorro = historial.filter((h) => h.ahorro > 0);
  const lleva = Math.round(conAhorro.filter((h) => new Date(h.fecha) >= inicio).reduce((s, h) => s + h.ahorro, 0));
  const recientes = conAhorro.filter((h) => Date.now() - new Date(h.fecha) < 28 * 864e5);
  const suma = recientes.reduce((s, h) => s + h.ahorro, 0), porViaje = recientes.length ? suma / recientes.length : 0;
  const falta = Math.max(0, meta.monto - lleva), avance = Math.min(1, lleva / meta.monto), lista = falta === 0;
  ponerCifra("metaLleva", pesos(lleva));
  $("metaPara").textContent = lista ? `Ya te alcanza para ${meta.nombre}` : `de ${pesos(meta.monto)} para ${meta.nombre}`;
  $("metaCambiar").textContent = lista ? "Elegir otra" : "Cambiar";
  const texto = lista ? "Meta cumplida" : suma > 0 ? `A tu ritmo llegas ${cuandoLlegas(Math.ceil(falta / (suma / 28)))}` : "Cada viaje en camión te acerca";
  $("metaPie").innerHTML = `<span>${texto}</span><b class="meta-pct">${Math.floor(avance * 100)}%</b>`;
  const A = ARTE_ESC.ahorro, escala = 0.55, izquierda = 6 + avance * 372;
  const bandera = `<g transform="translate(574 194)"><rect x="-3" y="-96" width="6" height="96" fill="#3a2f22"/><path d="M3-96h54l-12 17 12 17H3z" fill="#d9483b"/></g>`;
  $("metaEscena").innerHTML = `${A[horario()]}${bandera}<g transform="translate(${(izquierda - escala * 158).toFixed(1)} ${(194 * (1 - escala)).toFixed(1)}) scale(${escala})">${A[`nivel${Math.min(5, Math.ceil(avance * 5))}`]}</g><g transform="translate(330 340) scale(${(0.66 / ESCALA_TL).toFixed(3)})">${tlacuache(lista ? 5 : 4)}</g>`;
  $("metaEscena").setAttribute("aria-label", `Camioncito al ${Math.floor(avance * 100)}% del camino a tu meta`);
  const viajes = porViaje ? Math.ceil(falta / porViaje) : 0;
  const fichas = lista ? [] : [["pantalla", "monedas", pesos(falta), "te faltan"], viajes && ["qrobus", "qrobus", String(viajes), viajes === 1 ? "viaje más" : "viajes más"], porViaje && ["gasolina", "monedas", pesos(porViaje), "ahorras por viaje"]].filter(Boolean);
  $("metaFichas").hidden = !fichas.length;
  $("metaFichas").innerHTML = fichas.map(([c, p, cifra, t]) => `<li class="eq-${c}">${picto(p)}<strong>${cifra}</strong><span>${t}</span></li>`).join("");
}
function guardarMeta(nombre, monto) {
  escribir("grieta-meta-ahorro", { nombre, monto, desde: new Date().toISOString() });
  pintarMeta();
  llenarPrimeraVista("ahorro");
}
$("metaOpciones").addEventListener("click", (e) => {
  const b = e.target.closest("[data-meta]");
  if (b) guardarMeta(b.dataset.meta, Number(b.dataset.monto));
});
$("metaOtra").addEventListener("click", () => {
  $("metaOpciones").hidden = $("metaOtra").hidden = true;
  $("metaForma").hidden = false;
  $("metaNombre").focus();
});
$("metaForma").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = $("metaNombre").value.trim().replace(/\s+/g, " "), monto = Math.round(Number($("metaMonto").value));
  if (!nombre) return void ($("metaError").textContent = "Escribe qué quieres.");
  if (!nombrePermitido(nombre)) return void ($("metaError").textContent = "Ese nombre no se vale. Elige otro.");
  if (!(monto >= 50 && monto <= 100000)) return void ($("metaError").textContent = "Escribe una cantidad entre $50 y $100000.");
  guardarMeta(nombre, monto);
});
$("metaCambiar").addEventListener("click", () => {
  escribir("grieta-meta-ahorro", null);
  $("metaForma").reset();
  $("metaError").textContent = "";
  $("metaForma").hidden = true;
  $("metaOpciones").hidden = $("metaOtra").hidden = false;
  pintarMeta();
  llenarPrimeraVista("ahorro");
});
function prepararBonos() {
  const deGrieta = viajesDeHistorial();
  bono.semana = deGrieta || 10;
  marcarTarifaBonos(acc.unidos ? "unidos" : "normal");
  pintarBonos();
}
$("ahorroMes").addEventListener("click", abrirAhorro);
$("menosViajes").addEventListener("click", () => { bono.semana = Math.max(0, bono.semana - 1); pintarBonos(); });
$("masViajes").addEventListener("click", () => { bono.semana = Math.min(60, bono.semana + 1); pintarBonos(); });

// La queja se publica solo como conteo; el canal oficial queda a un toque con el texto ya escrito.
async function enviarQueja(decirR) {
  const ruta = (reporte.ruta ?? $("rutaQueja").value).trim().toUpperCase();
  if (!ruta) return decirR("Elige o escribe la ruta del camión.");
  const unidad = $("unidadQueja").value.trim();
  const descripcion = $("descripcion").value.trim();
  $("enviarReporte").disabled = true;
  try {
    await llamar("/quejas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: reporte.tipo, ruta, unidad: unidad || null, parada: reporte.parada, lat: reporte.lat, lon: reporte.lon, descripcion: descripcion || null }),
    });
    const tipo = TIPOS_QUEJA[reporte.tipo];
    let resumen = "";
    try {
      const r = await llamar(`/quejas/resumen?ruta=${encodeURIComponent(ruta)}`);
      resumen = r.total > 1 ? `En los últimos ${r.dias} días, ${r.total} personas reportaron problemas en la ruta ${ruta}.` : `Eres la primera persona en reportar la ruta ${ruta} este mes.`;
    } catch {}
    const cuando = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
    const mensaje = [`Reporte de Qrobus: ${tipo}.`, `Ruta ${ruta}${unidad ? `, unidad ${unidad}` : ""}${reporte.parada ? `, parada ${reporte.parada}` : ""}.`, cuando, descripcion].filter(Boolean).join(" ");
    $("quejaWhatsapp").href = `https://wa.me/524461171516?text=${encodeURIComponent(mensaje)}`;
    $("quejaResumen").textContent = resumen;
    $("quejaListo").hidden = false;
    decirR("Gracias. Tu queja quedó registrada en Grieta.");
    $("reporteEstado").className = "nota listo";
    $("reporteResto").hidden = true;
    Object.assign(reporte, { tipo: null, ruta: null });
    marcarReporte(null);
    $("quejaListo").hidden = false;
    $("descripcion").value = ""; $("unidadQueja").value = ""; $("rutaQueja").value = "";
    $("quejaListo").scrollIntoView({ block: "nearest" });
  } catch (err) {
    decirR(["sin api", "sin conexion"].includes(err.message)
      ? "No se pudo enviar: no hay conexión con Grieta. Revisa tu internet e intenta otra vez."
      : `No se pudo enviar: ${err.message}.`);
  } finally {
    $("enviarReporte").disabled = false;
  }
}

// El precio que le salio a alguien, para que el modelo aprenda.
$("enviarPrecio").addEventListener("click", async () => {
  try {
    await llamar("/precios-reportados", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: estado.app, precio: Number($("precio").value),
        lat_origen: estado.origen.lat, lon_origen: estado.origen.lon, lat_destino: estado.destino.lat, lon_destino: estado.destino.lon,
      }),
    });
    $("gracias").textContent = "Gracias: con tu precio Grieta calcula mejor.";
    $("compartirPrecio").hidden = true;
  } catch (err) {
    $("gracias").textContent = ["sin api", "sin conexion"].includes(err.message)
      ? "No se pudo enviar: no hay conexión con Grieta. Revisa tu internet e intenta otra vez."
      : `No se pudo enviar: ${err.message}.`;
  }
});

// Bienvenida: lo primero es saber si la persona ve la pantalla, para no darle un camino que no puede seguir.
const PASOS_VOZ = {
  lector: "Listo, Grieta te va a hablar. ¿Tu teléfono ya te lee la pantalla, como VoiceOver o TalkBack? Arriba, sí. Abajo, no.",
  ubicacion: "¿Usamos tu ubicación? Así sé desde dónde sales y cuándo avisarte que te bajes. Arriba, sí. Abajo, ahora no.",
  movilidad: "Tu perfil, 1 de 3. ¿Cómo te mueves? Arriba, camino sin problema. En medio, me cuesta caminar. Abajo, uso silla de ruedas o andadera. Al final puedes saltar estas preguntas.",
  oido: "2 de 3. ¿Escuchas bien los avisos? Arriba, sí. Abajo, me cuesta escuchar.",
  tarifa: "3 de 3. ¿Pagas Tarifa Unidos, el pasaje de 2 pesos para estudiantes, mayores de 60 y personas con discapacidad? Arriba, sí. Abajo, no.",
};
// Orden de la bienvenida; la pregunta del lector solo aparece con la guía por voz.
const ordenPasos = () => ["vista", ...(acc.modoVoz ? ["lector"] : ["forma"]), "ubicacion", "movilidad", "oido", "tarifa", ...(acc.modoVoz ? [] : ["gasolina", "cuenta"])];
let pasoActual = "vista";
function irPaso(p) {
  ToquesGrieta.reiniciar();
  const anteriorPaso = pasoActual;
  pasoActual = p;
  const orden = ordenPasos();
  const numero = orden.indexOf(p) + 1;
  const progreso = $("progresoBienvenida");
  if (progreso.children.length !== orden.length) {
    progreso.replaceChildren(...orden.map(() => document.createElement("i")));
    progreso.style.gridTemplateColumns = `repeat(${orden.length}, 1fr)`;
  }
  [...progreso.children].forEach((punto, i) => punto.classList.toggle("hecho", i < numero));
  $("numeroPregunta").textContent = p === "cuenta" ? "Último paso" : `Pregunta ${numero} de ${orden.filter((x) => x !== "cuenta").length}`;
  $("regresarBienvenida").classList.toggle("oculta", numero === 1);
  $("saltarBienvenida").hidden = p === "cuenta";
  // Quien ya tiene sesion abierta no necesita volver a elegir cuenta.
  if (p === "cuenta" && typeof cuentaActual !== "undefined" && cuentaActual.datos) return terminarBienvenida();
  progreso.setAttribute("aria-valuemax", String(orden.length));
  progreso.setAttribute("aria-valuenow", String(numero));
  progreso.setAttribute("aria-valuetext", `Paso ${numero} de ${orden.length}`);
  const escena = document.querySelector(`#bienvenida [data-paso="${p}"] .escena-pregunta`);
  if (escena && !acc.modoVoz) {
    escena.className = `escena-pregunta esc-p-${p} entra`;
    escena.innerHTML = TutorialGrieta.escena(p);
  }
  for (const d of document.querySelectorAll("#bienvenida [data-paso]")) d.hidden = d.dataset.paso !== p;
  const titulo = document.querySelector(`#bienvenida [data-paso="${p}"] h1`);
  $("bienvenida").setAttribute("aria-labelledby", titulo.id);
  titulo.focus({ preventScroll: true });
  $("hoja").scrollTop = 0;
  if (acc.modoVoz && PASOS_VOZ[p]) hablar(`${p === 'ubicacion' && anteriorPaso === 'lector' && ToquesGrieta.activo() ? ToquesGrieta.instrucciones + ' ' : ''}${PASOS_VOZ[p]}`, false, true);
}
function abrirBienvenida() {
  ir("bienvenida", true);
  irPaso("vista");
}
// Quien responde como ve la pantalla ya puede seguir el tutorial; despues vienen las demas preguntas.
function seguirATutorial() {
  // En modo Voz siguen primero las preguntas: ahi se explica como usar los toques.
  if (acc.modoVoz || leer("grieta-tutorial", false)) return irPaso("ubicacion");
  TutorialGrieta.abrir("bienvenida", true);
}
function terminarBienvenida() {
  escribir("grieta-bienvenida", true);
  if (acc.modoVoz && !leer("grieta-tutorial", false)) return TutorialGrieta.abrir("inicio", true);
  ir("inicio", true);
  if (acc.modoVoz) hablar(ayudaVoz(), false, true);
}
// Salida para la feria: cinco toques seguidos al titulo del ultimo paso dejan entrar sin cuenta.
let toquesEscape = [];
$("tituloCuentaPaso").addEventListener("click", () => {
  const ahora = Date.now();
  toquesEscape = [...toquesEscape.filter((t) => ahora - t < 3000), ahora];
  if (toquesEscape.length >= 5) { toquesEscape = []; terminarBienvenida(); }
});
$("saltarBienvenida").addEventListener("click", () => {
  if (!leer("grieta-tutorial", false)) escribir("grieta-tutorial", { version: 1, completado: false });
  // Saltar lleva directo al ultimo paso: ahi cada quien elige cuenta, entrar o solo su nombre. En modo voz no hay ese paso.
  if (ordenPasos().includes("cuenta")) return irPaso("cuenta");
  terminarBienvenida();
});
document.querySelector('#bienvenida [data-paso="vista"]').addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (!b) return;
  const v = b.dataset.v;
  Object.assign(acc, { modoVoz: v === "voz", grande: v !== "vista", contraste: v === "poco", voz: v === "voz" });
  guardarAcc();
  aplicarAcc();
  irPaso(v === "voz" ? "lector" : "forma");
});
// Completa o fácil: quien ve elige cuánto quiere en pantalla; quien no ve ya va al modo de voz
document.querySelector('#bienvenida [data-paso="forma"]').addEventListener("click", (e) => {
  const b = e.target.closest("[data-forma]");
  if (!b) return;
  acc.facil = b.dataset.forma === "facil";
  guardarAcc();
  aplicarAcc();
  seguirATutorial();
});
document.querySelector('#bienvenida [data-paso="lector"]').addEventListener("click", (e) => {
  const b = e.target.closest("[data-lector]");
  if (!b) return;
  acc.lector = b.dataset.lector;
  acc.voz = b.dataset.lector === "no";
  guardarAcc();
  aplicarAcc();
  seguirATutorial();
});
for (const b of document.querySelectorAll("#bienvenida .regresar")) {
  b.addEventListener("click", () => {
    const orden = ordenPasos();
    irPaso(orden[Math.max(0, orden.indexOf(pasoActual) - 1)]);
  });
}
$("permisoUbicacion").addEventListener("click", () => {
  ubicar();
  irPaso("movilidad");
});
$("sinUbicacion").addEventListener("click", () => {
  sinUbicacion("");
  irPaso("movilidad");
});
// Las tres preguntas del perfil: cada respuesta ajusta lo mismo que la pantalla "Tu perfil".
$("bienvenida").addEventListener("click", (e) => {
  const opcionCuenta = e.target.closest("[data-cuenta]");
  if (opcionCuenta) return abrirCuenta(opcionCuenta.dataset.cuenta, terminarBienvenida);
  const b = e.target.closest("[data-movilidad], [data-oido], [data-tarifa], [data-gasolina], .saltar");
  if (!b) return;
  if (b.classList.contains("saltar")) return pasoActual !== "cuenta" && ordenPasos().includes("cuenta") ? irPaso("cuenta") : terminarBienvenida();
  if (b.dataset.movilidad) {
    Object.assign(acc, { movilidad: b.dataset.movilidad, camino: b.dataset.movilidad !== "normal" });
  } else if (b.dataset.oido) {
    acc.oido = b.dataset.oido;
    acc.voz = b.dataset.oido === "bien" && acc.modoVoz && acc.lector !== "si";
  } else if (b.dataset.gasolina) {
    acc.gasolina = b.dataset.gasolina;
  } else {
    acc.unidos = b.dataset.tarifa === "si";
    escribir("grieta-perfil", true);
  }
  guardarAcc();
  aplicarAcc();
  if (b.dataset.movilidad) return irPaso("oido");
  if (b.dataset.oido) return irPaso("tarifa");
  if (b.dataset.tarifa && ordenPasos().includes("gasolina")) return irPaso("gasolina");
  if (b.dataset.gasolina) return irPaso("cuenta");
  terminarBienvenida();
});
// Perfil de viaje: lo que la persona necesita para moverse, guardado solo en este telefono.
// Se pregunta por necesidades, no por diagnosticos, y cada respuesta ajusta los mismos interruptores de Ajustes.
function vistaActual() {
  return acc.modoVoz ? "voz" : acc.grande && acc.contraste ? "poco" : "vista";
}
// El perfil en fichas de dos palabras, con el mismo dibujo y color que su pregunta; tocar una lleva a esa pregunta.
function fichasPerfil() {
  const movilidad = acc.movilidad ?? (acc.camino ? "poco" : "normal"), colchon = acc.colchon ?? 0;
  return [
    ["perfilVista", "anil", "ojo", "Ver", { vista: "Bien", poco: "Poco", voz: "Me habla" }[vistaActual()]],
    acc.modoVoz && ["perfilLectorOpciones", "obsidiana", "decir", "Lector", acc.lector === "si" ? "Uso lector" : "Me lee"],
    ["perfilMovilidad", "naranja", movilidad === "silla" ? "silla" : "caminar", "Caminar", { normal: "Bien", poco: "Poco", silla: "Silla" }[movilidad]],
    ["perfilTarifa", "rosa", "qrobus", "Tarifa", acc.unidos ? "Unidos" : "Normal"],
    ["perfilLlegar", "anil", "flag", "Llegar", colchon ? `${colchon} min` : "Justo"],
  ].filter(Boolean);
}
const inicialDe = (nombre) => Array.from(nombre.trim())[0]?.toLocaleUpperCase("es-MX") ?? "";
function placaPierdo() {
  const c = siMePierdo, lugar = lugarDeAyuda();
  const filas = [["pin", "Digo tu calle"], ["telefono", "Le llamo"], lugar && ["casa", `Te llevo a ${lugar.nombre}`]].filter(Boolean);
  return `<button type="button" class="pf-corte pf-pierdo" data-pierdo aria-haspopup="dialog"><span class="hv-partido">${PLACAS_VIAJE}<span class="hv-lado"><span class="pf-pt"><span class="pf-av">${c ? escapar(inicialDe(c.nombre)) : picto("donde")}</span><span><small>Si me pierdo</small><b>${c ? escapar(c.nombre) : "Elige a quién"}</b></span></span></span><span class="hv-lado der"><span class="pf-lista">${filas.map(([i, x]) => `<span>${ico(i)}<span>${escapar(x)}</span></span>`).join("")}</span></span></span>${ico("lapiz", "pf-lapiz")}</button>`;
}
function resumenCortoPerfil() {
  const vista = { vista: "Ves bien", poco: "Ves poco", voz: "Grieta te habla" }[vistaActual()];
  const movilidad = acc.movilidad ?? (acc.camino ? "poco" : "normal");
  const movimiento = { normal: "Caminas bien", poco: "Caminas poco", silla: "Usas silla de ruedas" }[movilidad];
  const densidad = { completa: "Completa", facil: "Fácil", voz: "Voz" }[densidadActual()];
  const oido = acc.oido === "poco" ? ["vibrar", "Avisos con vibración"] : ["altavoz", "Avisos con voz"];
  const tarifa = acc.unidos ? "Tarifa Unidos" : "Tarifa normal";
  return [["ojo", vista], [movilidad === "silla" ? "silla" : "caminar", movimiento], ["letra", densidad], oido, ["boleto", tarifa],
    acc.modoVoz && acc.lector === "si" ? ["altavoz", "Usas lector de pantalla"] : null,
    acc.idioma === "es" ? null : ["persona", `Prefieres ${acc.idioma === "nah" ? NOMBRE_NAHUATL : NOMBRE_OTOMI}`]].filter(Boolean);
}
function pintarResumenPerfil() {
  if (!$("textoPerfil")) return;
  const [vista, movimiento, , , tarifa] = resumenCortoPerfil();
  // Tres iconos a la vista; el lector de pantalla escucha la frase completa.
  const frasePerfil = [vista, movimiento, tarifa].map(([, t], i) => (i ? t.charAt(0).toLowerCase() + t.slice(1) : t)).join(", ");
  // Los mismos dibujos y colores que la credencial del perfil.
  $("textoPerfil").innerHTML = [acc.modoVoz ? "decir" : "ojo", movimiento[0] === "silla" ? "silla" : "caminar", "qrobus"].map((p) => `<i aria-hidden="true">${picto(p)}</i>`).join("") + `<span class="oculto">${escapar(frasePerfil)}</span>`;
  const elegida = acc.gasolina ?? "magna";
  // Solo quien tiene carro lleva el icono, en el color de su gasolina.
  const iconoGasolina = acc.modoVoz || elegida === "no" ? "" : `<i class="gas-${elegida}">${picto("gasolina")}</i>`;
  $("textoPerfil").insertAdjacentHTML("beforeend", iconoGasolina);
  $("credencialIconos").innerHTML = [acc.modoVoz ? "decir" : "ojo", movimiento[0] === "silla" ? "silla" : "caminar", "qrobus"].map((p) => `<i>${picto(p)}</i>`).join("") + iconoGasolina;
  if (document.body.dataset.pantalla !== "perfil") return;
  const pildoras = (dato, actual, opciones, nombre) => `<span class="perfil-gasolina" role="group" aria-label="${nombre}">${opciones.map(([v, t, n]) => `<button type="button" data-${dato}="${v}" aria-pressed="${v === actual}" aria-label="${n}">${t}</button>`).join("")}</span>`;
  const cabeza = (icono, sm, ti, resto) => `<span class="pf-cabeza">${picto(icono)}<span class="perfil-ficha-texto"><small>${sm}</small><b>${ti}</b></span>${resto}</span>`;
  const seguroPerfil = acc.seguro ?? "noche";
  const fichaSegura = `<div class="pf-corte pf-carta pf-seg">${cabeza("escudo", "Modo", "Seguro", pildoras("seguro", seguroPerfil, [["noche", "Noche", "De noche"], ["siempre", "Siempre", "Siempre"], ["nunca", "No", "Nunca"]], "Cuándo usar el modo seguro"))}<span class="pf-cuando"><span>${{ noche: "De 8 pm a 6 am", siempre: "En todos tus viajes", nunca: "Apagado: no cambio tus rutas" }[seguroPerfil]}</span><em>Recomendación, no garantía</em></span>${seguroPerfil === "nunca" ? "" : `<span class="pf-tres">${[["caminar", "Máximo 5 min a pie"], ["parada", "Paradas en avenida"], ["megafono", "Avisos de la gente"]].map(([i, x]) => `<span>${picto(i)}<span>${x}</span></span>`).join("")}</span>`}</div>`;
  const gasolina = acc.modoVoz ? "" : `<div class="pf-corte pf-carta gas-${elegida}">${cabeza("gasolina", "Tu carro usa", "Gasolina", pildoras("gasolina", elegida, [["magna", "Verde", "Gasolina verde"], ["premium", "Roja", "Gasolina roja"], ["no", "No", "No tengo carro"]], "Qué gasolina le pones a tu carro"))}${elegida === "no" ? '<span class="pf-precio"><span class="pf-solo">No te muestro lo que gastarías en carro.</span></span>' : `<span class="pf-precio"><span class="pf-litro"><strong>$${precioGasolina().toFixed(2)}</strong><i>el litro</i></span><span class="pf-solo">Con esto calculo lo que gastarías si vas en tu carro.</span></span>`}</div>`;
  const fichas = fichasPerfil();
  $("perfilFichas").innerHTML = fichas.map(([grupo, tono, icono, etiqueta, valor], i) =>
    `<button type="button" class="pf-corte pf-chica tono-${tono}${fichas.length % 2 && i === fichas.length - 1 ? " pf-sola" : ""}" data-ir-perfil="${grupo}" aria-haspopup="dialog" aria-label="${etiqueta}: ${escapar(valor)}">${picto(icono)}<span class="perfil-ficha-texto"><small>${etiqueta}</small><b>${escapar(valor)}</b></span></button>`).join("") + placaPierdo() + fichaSegura + gasolina;
  evitarCortePerfil();
}
// Si la ficha queda partida por la barra de abajo, baja completa. Se mide sin contar el scroll para que no brinque.
function evitarCortePerfil() {
  const caja = $("perfilFichas");
  if (document.body.dataset.pantalla !== "perfil") return;
  for (const f of caja.children) f.style.marginTop = "";
  caja.classList.remove("pf-justo");
  const barra = document.querySelector("[data-tab]").parentElement.getBoundingClientRect().top;
  const desplazado = (caja.closest(".hoja")?.scrollTop ?? 0) + scrollY;
  // En pantallas bajas se compacta antes de empujar, para que no quede un hueco.
  if (caja.lastElementChild && caja.lastElementChild.getBoundingClientRect().bottom + desplazado > barra) caja.classList.add("pf-justo");
  for (const f of caja.children) {
    const r = f.getBoundingClientRect(), arriba = r.top + desplazado, abajo = r.bottom + desplazado;
    if (arriba < barra && abajo > barra) { f.style.marginTop = `${Math.ceil(barra - arriba + 12)}px`; break; }
  }
}
let anchoPerfil = innerWidth;
addEventListener("resize", () => { if (innerWidth !== anchoPerfil) { anchoPerfil = innerWidth; evitarCortePerfil(); } });
new ResizeObserver(evitarCortePerfil).observe($("perfilFichas"));
// La foto y el nombre se pintan al entrar: al arrancar la racha todavia no existe.
function pintarCredencial() {
  const nombre = leer("grieta-cuenta", null)?.nombre || acc.nombre || racha.nombre || "Tu tlacuache";
  $("credencialFoto").innerHTML = `<g transform="translate(76 134) scale(${(0.38 / ESCALA_TL).toFixed(3)})">${tlacuache(4, racha.puestos, false)}</g>`;
  $("credencialNombre").textContent = nombre;
  $("credencialNombre").classList.toggle("largo", nombre.length > 9);
  requestAnimationFrame(ajustarNombreCredencial);
}
// Ninguna palabra del nombre se parte: si no cabe, la letra se achica hasta que quepa.
function ajustarNombreCredencial() {
  const el = $("credencialNombre");
  el.style.fontSize = "";
  if (!el.offsetWidth) return;
  const ancho = el.clientWidth, palabras = el.textContent.split(/\s+/), medida = document.createElement("span");
  medida.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit";
  el.append(medida);
  let tam = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 20 && tam > 14; i++) {
    medida.style.fontSize = `${tam}px`;
    if (Math.max(...palabras.map((w) => { medida.textContent = w; return medida.offsetWidth; })) <= ancho) break;
    tam *= 0.92;
  }
  medida.remove();
  el.style.fontSize = `${Math.round(tam)}px`;
}
// Cada ficha de Ajustes abre su panel en una pantalla con flecha de regreso.
const TITULOS_AJUSTE = { pantalla: "Pantalla", accesibilidad: "Accesibilidad", voz: "Voz", viajes: "Tus viajes", progreso: "Tu cuenta", ayuda: "Ayuda", seguro: "Modo seguro" };
const NOMBRES_SEGURO = { noche: "De noche", siempre: "Siempre", nunca: "Nunca" };
const marcarSeguro = radios("optSeguro", (v) => { acc.seguro = v; guardarAcc(); estado.seguroApagado = false; $("seguroResumen").textContent = NOMBRES_SEGURO[v]; });
$("abrirSeguro").addEventListener("click", () => abrirAjuste("seguro"));
// Cada opcion de si o no se elige con dos tarjetas; el checkbox sigue guardando el dato.
const marcarPares = [...document.querySelectorAll("[data-par]")].map((grupo) => {
  const caja = $(grupo.dataset.par);
  const sincronizar = () => marcar(caja.checked ? "si" : "no");
  const marcar = radios(grupo.id, (v) => {
    if (caja.checked !== (v === "si")) caja.click();
    sincronizar();
  });
  return sincronizar;
});
function abrirAjuste(panel) {
  for (const d of document.querySelectorAll("[data-ajuste-panel]")) d.hidden = d.dataset.ajustePanel !== panel;
  marcarPares.forEach((f) => f());
  marcarSeguro(modoSeguro());
  $("seguroResumen").textContent = NOMBRES_SEGURO[modoSeguro()];
  titulos.ajuste = TITULOS_AJUSTE[panel];
  ir("ajuste");
  if (panel === "progreso") revisarSesion();
  if (panel === "ayuda") $("ayudaTlacuache").innerHTML = tlacuache(3, racha.puestos, false);
}
// Ayuda por tarea: cada ficha dice como se hace y lleva directo a hacerlo.
const AYUDAS = {
  ir: { titulo: "Ir a un lugar", boton: "Buscar un lugar", hacer: () => abrirBuscar(), pasos: [["Di o escribe a dónde vas", 'En Inicio, en "Busca un lugar" o con "Decir a dónde voy".'], ["Compara y elige", "Ves cuánto cuesta en Uber, DiDi e inDrive y cómo llegar en Qrobus."], ["Empieza el viaje con avisos", "Grieta te avisa cuándo pasa tu camión y cuándo bajarte."]] },
  camiones: { titulo: "Ver camiones cerca", boton: "Ver camiones", hacer: () => abrirCamiones(), pasos: [["Toca Camiones cerca", "Es el botón del centro, abajo."], ["Elige una parada", "Ves qué camiones pasan y a qué hora."], ["Llega con guía", "Toca Caminar con guía y te llevo a la parada."]] },
  reportar: { titulo: "Reportar un problema", boton: "Reportar ahora", hacer: () => abrirReporte(), pasos: [["Toca Reportar", "Está en Inicio, en Ahora mismo."], ["Elige qué pasó", "Un problema en la parada o una queja del camión."], ["Mándalo", "Si quieres, agrega una foto. Tu reporte ayuda a quien pase por ahí."]] },
  camara: { titulo: "Describir con la cámara", boton: "Abrir la cámara", hacer: () => abrirCamara(), pasos: [["Toca Describir", "Está en Inicio, en Ahora mismo."], ["Apunta con el teléfono", "Escucha objetos y texto frente a ti."], ["Sigue con cuidado", "Puede omitir obstáculos: usa tu bastón o acompañamiento."]] },
  lugares: { titulo: "Guardar mis lugares", boton: "Ir a Inicio", hacer: () => ir("inicio"), pasos: [["Toca Agregar", "Está arriba, en Inicio."], ["Busca el lugar", "Ponle nombre: Casa, Escuela, Trabajo u otro."], ["Llega con un toque", "Después lo tocas en Tus lugares y te digo cómo llegar."]] },
  cuenta: { titulo: "Pasar a otro teléfono", boton: "Ir a Tu cuenta", hacer: () => abrirAjuste("progreso"), pasos: [["Crea tu cuenta", "En Ajustes, en Tu cuenta."], ["Entra en el otro teléfono", "Toca Ya tengo cuenta y escribe tu correo y tu contraseña."], ["Listo", "Llegan tu racha, tus viajes y tus lugares."]] },
};
let ayudaAbierta = null;
function abrirHojaAyuda(clave) {
  const a = AYUDAS[clave];
  ayudaAbierta = a;
  $("hojaAyudaTitulo").textContent = a.titulo;
  $("hojaAyudaIr").textContent = a.boton;
  $("hojaAyudaPasos").innerHTML = a.pasos.map(([t, d], i) => `<li><span class="num" aria-hidden="true">${i + 1}</span><span><strong>${escapar(t)}</strong><small>${escapar(d)}</small></span></li>`).join("");
  $("hojaAyuda").showModal();
  $("hojaAyudaTitulo").focus({ preventScroll: true });
}
$("ayudaTareas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ayuda]");
  if (b) abrirHojaAyuda(b.dataset.ayuda);
});
$("hojaAyudaCerrar").addEventListener("click", () => $("hojaAyuda").close());
$("hojaAyudaIr").addEventListener("click", () => { $("hojaAyuda").close(); ayudaAbierta?.hacer(); });
$("hojaAyuda").addEventListener("click", (e) => { if (e.target === $("hojaAyuda") && e.clientY < $("hojaAyuda").getBoundingClientRect().top) $("hojaAyuda").close(); });
$("ajustesFichas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ajuste]");
  if (b) abrirAjuste(b.dataset.ajuste);
});
const hojaPerfil = $("hojaPerfil");
let cierreHoja = 0;
function abrirHojaPerfil(grupo, porToque = false) {
  clearTimeout(cierreHoja);
  hojaPerfil.classList.toggle("por-toque", porToque);
  for (const item of hojaPerfil.querySelectorAll(".item-perfil")) item.classList.toggle("actual", item.dataset.grupoPerfil === grupo);
  const item = hojaPerfil.querySelector(".item-perfil.actual");
  hojaPerfil.setAttribute("aria-labelledby", item.querySelector("h3").id);
  hojaPerfil.dataset.grupo = grupo;
  hojaPerfil.showModal();
  hojaPerfil.scrollTop = 0;
  item.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
}
const cerrarHojaPerfil = () => { if (hojaPerfil.open) hojaPerfil.close(); };
hojaPerfil.addEventListener("close", () => { pintarResumenPerfil(); $("perfilFichas").querySelector(`[data-ir-perfil="${hojaPerfil.dataset.grupo}"]`)?.focus({ preventScroll: true }); });
hojaPerfil.addEventListener("click", (e) => {
  if (e.target === hojaPerfil && e.clientY < hojaPerfil.getBoundingClientRect().top) return cerrarHojaPerfil();
  // Con el dedo se cierra al elegir; con flechas o lector se queda abierta para seguir probando.
  if (e.target.closest(".item-perfil [role=radio]:not(:disabled)")) {
    escribir("grieta-perfil", true);
    if (e.detail) cierreHoja = setTimeout(cerrarHojaPerfil, 260);
  }
});
$("cerrarHojaPerfil").addEventListener("click", cerrarHojaPerfil);
let inicioHoja = null;
hojaPerfil.addEventListener("touchstart", (e) => { inicioHoja = hojaPerfil.scrollTop > 0 ? null : e.touches[0].clientY; }, { passive: true });
hojaPerfil.addEventListener("touchend", (e) => {
  if (inicioHoja !== null && e.changedTouches[0].clientY - inicioHoja > 70) cerrarHojaPerfil();
  inicioHoja = null;
});
$("perfilFichas").addEventListener("click", (e) => {
  const seguro = e.target.closest("[data-seguro]");
  if (seguro) {
    const v = seguro.dataset.seguro;
    acc.seguro = v;
    guardarAcc();
    escribir("grieta-perfil", true);
    estado.seguroApagado = false;
    marcarSeguro(v);
    $("seguroResumen").textContent = NOMBRES_SEGURO[v];
    pintarResumenPerfil();
    return $("perfilFichas").querySelector(`[data-seguro="${v}"]`).focus({ preventScroll: true });
  }
  const gasolina = e.target.closest("[data-gasolina]");
  if (gasolina) {
    escribir("grieta-perfil", true);
    return $("perfilGasolina").querySelector(`[data-v="${gasolina.dataset.gasolina}"]`).click();
  }
  if (e.target.closest("[data-pierdo]")) return abrirHojaPierdo();
  const b = e.target.closest("[data-ir-perfil]");
  if (b) abrirHojaPerfil(b.dataset.irPerfil, e.detail > 0);
});
// Lo que cambia cada respuesta, abajo de su pregunta
const EFECTOS = {
  perfilVista: { vista: "Mapa y letra normal.", poco: "Letra grande y más contraste.", voz: "Pocos botones, muy grandes, y Grieta te dice todo en voz alta." },
  perfilLectorOpciones: { si: "Grieta no habla encima de tu lector.", no: "Grieta te lee todo en voz alta." },
  perfilMovilidad: { normal: "Te busco la parada que más te convenga.", poco: "Te busco paradas más cerca.", silla: "Paradas cerca, y te aviso si reportaron que no tienen rampa." },
  perfilOido: { bien: "Durante el viaje te aviso con voz.", poco: "Avisos en pantalla grande y con vibración, sin voz." },
  perfilTarifa: { si: "Calculo el camión a $2 y el transbordo gratis.", no: "Calculo el camión con la tarifa normal." },
  perfilLlegar: { 0: "Te digo la última salida que llega a la hora.", 5: "Tu salida te deja 5 minutos de colchón.", 10: "Tu salida te deja 10 minutos de colchón.", 15: "Tu salida te deja 15 minutos de colchón." },
  perfilGasolina: { magna: "Calculo el gasto de tu carro con gasolina verde.", premium: "Calculo el gasto de tu carro con gasolina roja.", no: "No te muestro lo que gastarías en carro." },
  perfilForma: { completa: "Precios, horarios, comparar y esperar.", facil: "Solo lo esencial, con botones grandes." },
  perfilLengua: { es: "La interfaz está en español. El audio sigue en español.", oto: "La traducción de la interfaz todavía no está disponible. El audio sigue en español.", nah: "La traducción de la interfaz todavía no está disponible. El audio sigue en español." },
};
const efecto = (grupo, v) => { $(`${grupo}Efecto`).textContent = EFECTOS[grupo][v] ?? ""; };
// En la hoja cada opcion dice lo que hace; el idioma no, porque su efecto depende de la traduccion.
for (const grupo of Object.keys(EFECTOS).filter((g) => g !== "perfilLengua")) {
  for (const b of $(grupo).querySelectorAll("[data-v]")) b.querySelector("span").insertAdjacentHTML("beforeend", `<small>${EFECTOS[grupo][b.dataset.v]}</small>`);
}
const RESPUESTAS_PERFIL = {
  perfilVista: { vista: "Veo bien", poco: "Veo poco", voz: "Quiero que Grieta me hable" },
  perfilLectorOpciones: { si: "Uso lector de pantalla", no: "Quiero que Grieta me hable" },
  perfilForma: { completa: "Quiero todas las opciones", facil: "Quiero lo esencial" },
  perfilMovilidad: { normal: "Camino sin problema", poco: "Me cuesta caminar", silla: "Uso silla de ruedas o andadera" },
  perfilOido: { bien: "Escucho bien los avisos", poco: "Me cuesta escuchar" },
  perfilTarifa: { si: "Pago Tarifa Unidos", no: "Pago tarifa normal" },
  perfilLlegar: { 0: "Justo a la hora", 5: "5 minutos antes", 10: "10 minutos antes", 15: "15 minutos antes" },
  perfilGasolina: { magna: "Gasolina verde", premium: "Gasolina roja", no: "No tengo carro" },
  perfilLengua: { es: "Español", oto: NOMBRE_OTOMI, nah: NOMBRE_NAHUATL },
};
function actualizarFilasPerfil() {
  const movilidad = acc.movilidad ?? (acc.camino ? "poco" : "normal");
  const valores = {
    perfilVista: vistaActual(),
    perfilLectorOpciones: acc.lector ?? "no",
    perfilForma: acc.facil ? "facil" : "completa",
    perfilMovilidad: movilidad,
    perfilOido: acc.oido ?? "bien",
    perfilTarifa: acc.unidos ? "si" : "no",
    perfilLlegar: String(acc.colchon ?? 0),
    perfilGasolina: acc.gasolina ?? "magna",
    perfilLengua: acc.idioma,
  };
  for (const [grupo, valor] of Object.entries(valores)) {
    const fila = document.querySelector(`[data-grupo-perfil="${grupo}"]`);
    const respuesta = RESPUESTAS_PERFIL[grupo][valor];
    efecto(grupo, valor);
    fila.querySelector(".respuesta-perfil").textContent = respuesta;
  }
  marcarVista(valores.perfilVista);
  marcarLector(acc.modoVoz ? valores.perfilLectorOpciones : null);
  marcarForma(valores.perfilForma);
  marcarMovilidad(valores.perfilMovilidad);
  marcarOido(valores.perfilOido);
  marcarTarifa(valores.perfilTarifa);
  marcarGasolina(valores.perfilGasolina);
  marcarLlegar(valores.perfilLlegar);
  $("preguntaGasolina").hidden = acc.modoVoz;
  marcarLengua(valores.perfilLengua);
  marcarAjusteIdioma(valores.perfilLengua);
  $("ajusteIdiomaNota").textContent = EFECTOS.perfilLengua[valores.perfilLengua] ?? "";
  $("perfilLector").hidden = !acc.modoVoz;
  $("preguntaForma").hidden = acc.modoVoz;
}
const cambiarPerfil = (cambio) => {
  cambio();
  guardarAcc();
  aplicarAcc();
  actualizarFilasPerfil();
  calcular();
};
const marcarVista = radios("perfilVista", (v) => cambiarPerfil(() => {
  efecto("perfilVista", v);
  Object.assign(acc, { modoVoz: v === "voz", grande: v !== "vista", contraste: v === "poco" });
  if (v === "voz") acc.voz = acc.lector !== "si";
  else acc.voz = false;
  $("perfilLector").hidden = v !== "voz";
}));
const marcarLector = radios("perfilLectorOpciones", (v) => cambiarPerfil(() => {
  efecto("perfilLectorOpciones", v);
  acc.lector = v;
  acc.voz = v === "no";
}));
const marcarMovilidad = radios("perfilMovilidad", (v) => cambiarPerfil(() => {
  efecto("perfilMovilidad", v);
  acc.movilidad = v;
  acc.camino = v !== "normal";
}));
const marcarOido = radios("perfilOido", (v) => cambiarPerfil(() => {
  efecto("perfilOido", v);
  acc.oido = v;
  acc.voz = v === "bien" && acc.modoVoz && acc.lector !== "si";
}));
const marcarForma = radios("perfilForma", (v) => cambiarPerfil(() => {
  efecto("perfilForma", v);
  acc.facil = v === "facil";
}));
const marcarLlegar = radios("perfilLlegar", (v) => cambiarPerfil(() => {
  efecto("perfilLlegar", v);
  acc.colchon = Number(v);
}));
const marcarTarifa = radios("perfilTarifa", (v) => cambiarPerfil(() => {
  efecto("perfilTarifa", v);
  acc.unidos = v === "si";
}));
const marcarGasolina = radios("perfilGasolina", (v) => cambiarPerfil(() => {
  efecto("perfilGasolina", v);
  acc.gasolina = v;
}));
// Elegir en el mapa: claro u oscuro solo en esta pantalla, sin tocar el tema de la app.
const tonoMapa = () => acc.tonoMapa ?? (document.documentElement.classList.contains("claro") ? "claro" : "oscuro");
const marcarTonoMapa = radios("tonoMapa", (v) => { acc.tonoMapa = v; guardarAcc(); aplicarTonoMapa(); });
function aplicarTonoMapa() {
  const v = tonoMapa();
  document.body.classList.toggle("mapa-claro", v === "claro");
  document.body.classList.toggle("mapa-oscuro", v === "oscuro");
  marcarTonoMapa(v);
}
const marcarLengua = radios("perfilLengua", (v) => cambiarPerfil(() => {
  acc.idioma = v;
  Interfaz.cambiar(v);
}));
const marcarAjusteIdioma = radios("ajusteIdioma", (v) => cambiarPerfil(() => {
  acc.idioma = v;
  Interfaz.cambiar(v);
}));
function abrirPerfil() {
  marcarVista(vistaActual());
  marcarLector(acc.modoVoz ? acc.lector : null);
  marcarMovilidad(acc.movilidad ?? (acc.camino ? "poco" : "normal"));
  marcarOido(acc.oido ?? "bien");
  marcarTarifa(acc.unidos ? "si" : "no");
  $("perfilLector").hidden = !acc.modoVoz;
  marcarForma(acc.facil ? "facil" : "completa");
  actualizarFilasPerfil();
  ir("perfil");
  // Las fichas llegan hasta la barra de abajo, sin contar los pixeles de la animacion de entrada.
  const fichas = $("perfilFichas"), barra = $("pestanas");
  fichas.style.minHeight = "";
  fichas.style.minHeight = `${Math.max(0, (barra.hidden ? innerHeight : barra.getBoundingClientRect().top) - (fichas.getBoundingClientRect().top - new DOMMatrix(getComputedStyle($("perfil")).transform).m42) - 12)}px`;
}
$("abrirPerfil").addEventListener("click", abrirPerfil);
$("resumenPerfil").addEventListener("click", abrirPerfil);
$("completarPerfil").addEventListener("click", abrirPerfil);
$("cerrarInvita").addEventListener("click", () => {
  escribir("grieta-invita-cerrada", true);
  $("invitaPerfil").hidden = true;
});


// Sin conexion: la app y los horarios quedan guardados en el telefono.
Interfaz.iniciar(acc.idioma, () => {
  for (const id of ["oto", "nah"]) EFECTOS.perfilLengua[id] = Interfaz.disponiblePara(id)
    ? id === "oto" && Interfaz.parcialPara(id) ? "Traducción automática parcial. Algunos textos siguen en español. El audio sigue en español." : "Traducción automática provisional. El audio sigue en español."
    : "La traducción de la interfaz todavía no está disponible. El audio sigue en español.";
  const disponible = Interfaz.disponiblePara("nah");
  for (const b of document.querySelectorAll('#perfilLengua [data-v="nah"], #ajusteIdioma [data-v="nah"]')) b.disabled = !disponible;
  $("nahuatlPendiente").hidden = disponible;
  actualizarFilasPerfil();
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
const SIN_INTERNET = "Sin internet: puedes ver qué camión pasa y tus lugares guardados; para buscar calles hace falta conexión.";
// Al volver la conexion solo se quita su propio aviso, no otro que este en pantalla.
function avisoConexion() {
  if (!navigator.onLine) avisar(SIN_INTERNET);
  else if ($("estado").textContent === SIN_INTERNET) avisar("");
}
addEventListener("online", avisoConexion);
addEventListener("offline", avisoConexion);

// Pantalla de arranque: se va cuando ya cargaron los datos, nunca antes de 1.6 s para que se vea el camioncito llegar y nunca despues de 4 s.
function quitarArranque() {
  const a = $("arranque");
  if (!a || a.classList.contains("listo")) return;
  try { sessionStorage.setItem("grieta-arranco", "1"); } catch {}
  if (document.documentElement.classList.contains("ya-arranco")) return a.remove();
  setTimeout(() => { a.classList.add("listo"); setTimeout(() => a.remove(), 350); }, Math.max(0, 1600 - performance.now()));
}
setTimeout(quitarArranque, Math.max(0, 4000 - performance.now()));
if (document.documentElement.classList.contains("ya-arranco")) quitarArranque();
// Si el telefono recargo la pagina (iPhone lo hace al liberar memoria), se vuelve a la pantalla donde estabas.
const pantallaPrevia = performance.getEntriesByType?.("navigation")[0]?.type === "reload" ? history.state?.p : null;

const primeraVez = !leer("grieta-bienvenida", false);
if (primeraVez) abrirBienvenida();
else {
  history.replaceState({ p: "inicio" }, "");
  mostrar("inicio");
}

Promise.all([
  Grieta.cargar(),
  fetch("datos/lugares.json").then((r) => r.json()),
  fetch("datos/config.json").then((r) => r.json()).catch(() => ({})),
]).then(([, l, config]) => {
  lugares = l;
  prepararLenguas(config);
  // En local se usa la API local, para que las pruebas no escriban en la base de produccion.
  API = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3000/api" : config.api || "";
  IA = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:8798" : config.ia || "";
  $("camaraEnfrente").hidden = !IA;
  $("camaraConversar").hidden = !IA || !Reconocer;
  pintarImpacto();
  quitarArranque();
  pintarGuardados();
  if (document.body.dataset.pantalla === "inicio") pintarHorario();
  avisoConexion();
  // llave.js carga despues de app.js: con red lenta los datos llegan antes y la funcion aun no existe.
  if (typeof sincronizarRespaldo === "function") sincronizarRespaldo();
  else addEventListener("load", () => sincronizarRespaldo(), { once: true });
  if (!primeraVez) ubicar();
  accionInicial();
  document.documentElement.classList.add("inicio-listo");
  ({ co2: abrirCo2, ahorro: abrirAhorro, racha: abrirRacha, ajustes: () => ir("ajustes"), ajuste: () => ir("ajustes"), camiones: abrirCamiones })[pantallaPrevia]?.();
});

// Accesos directos del icono de la app (manifest): llegan como ?accion= y se hacen en cuanto hay ubicacion
async function accionInicial() {
  const accion = new URLSearchParams(location.search).get("accion");
  if (!accion || primeraVez) return;
  history.replaceState({ p: "inicio" }, "", location.pathname);
  if (accion === "reportar") return abrirReporte();
  for (let i = 0; i < 24 && !estado.gps; i++) await new Promise((r) => setTimeout(r, 250));
  if (accion === "casa") {
    const casa = guardados.find((g) => g.nombre === "Casa");
    return casa ? irA(casa) : $("guardados").querySelector('[data-nuevo="Casa"]')?.click();
  }
  if (accion === "camiones") return abrirCamiones();
  if (accion === "donde") return abrirUbicacion();
}

// Tarjeta para ensenarle al chofer a donde vas, con letra enorme. En camion dice la parada; en app, el destino.
function tarjetaChofer(abierta) {
  $("chofer").hidden = !abierta;
  // Mientras esta abierta, lo demas no recibe el foco ni lo lee el lector de pantalla.
  for (const e of document.body.children) if (e !== $("chofer") && e.tagName !== "SCRIPT") e.inert = abierta;
  if (abierta) $("choferDestino").focus();
  else if (!$("avisarChofer").closest("[hidden]")) $("avisarChofer").focus();
}
$("avisarChofer").addEventListener("click", () => {
  const c = guia.camion;
  const destino = c ? c.baja : estado.destino?.nombre;
  if (!destino) return;
  $("choferLinea").textContent = c ? `Ruta ${c.linea}` : "";
  $("choferLinea").hidden = !c;
  $("choferDestino").textContent = `Voy a ${cruce(destino)}.`;
  tarjetaChofer(true);
});
$("choferVoz").addEventListener("click", () => hablar(`${Interfaz.original($("choferDestino"))} ¿Me avisa cuando lleguemos, por favor?`, false, false, true));
$("choferCerrar").addEventListener("click", () => tarjetaChofer(false));
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("chofer").hidden) tarjetaChofer(false); });

// Instalar como app: Android y Chrome traen su dialogo; en iPhone se explica Compartir y Agregar a inicio.
let pedirInstalar = null;
const instalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
function pintarInstalar() {
  $("instalar").hidden = instalada() || leer("grieta-instalar-no", false) || !(pedirInstalar || esIphone);
  if (esIphone && !pedirInstalar) {
    $("instalarComo").textContent = "En Safari toca Compartir y luego Agregar a inicio.";
    $("instalarSi").hidden = true;
  }
}
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pedirInstalar = e;
  pintarInstalar();
});
$("instalarSi").addEventListener("click", async () => {
  if (!pedirInstalar) return;
  pedirInstalar.prompt();
  await pedirInstalar.userChoice;
  pedirInstalar = null;
  pintarInstalar();
});
$("instalarNo").addEventListener("click", () => {
  escribir("grieta-instalar-no", true);
  pintarInstalar();
});
pintarInstalar();

// El detalle del viaje se lee completo por voz; en pantalla va en renglones con icono, la ruta en etiqueta y la hora resaltada.
const ICONOS_RENGLON = [[/baj/i, "pin"], [/cambi|transbord/i, "repetir"], [/aviso|avis/i, "altavoz"], [/camina|cuadra|metros|\bm\b/i, "caminar"], [/l[ií]nea|cami[oó]n|toma/i, "camion"], [/hora|\d:\d\d/i, "reloj"]];
function pintarRenglonesGuia() {
  const lista = $("guiaDetalleVisual"), texto = $("guiaDetalle").textContent.trim();
  lista.replaceChildren(...texto.split(/(?<!\b(?:Blvd|Av|Col|Fracc|Prol|Cto|Lic|Dr|Ing|Gral|Mtro|Pte|Ote|Nte|Sta?|Sr|Sra|No)\.)(?<=\.)\s+/).filter(Boolean).map((frase) => {
    const li = document.createElement("li"), icono = ICONOS_RENGLON.find(([r]) => r.test(frase))?.[1] ?? "ruta";
    li.innerHTML = `<svg class="icono" aria-hidden="true"><use href="#i-${icono}"/></svg><span></span>`;
    const cuerpo = li.lastElementChild;
    for (const parte of frase.split(/(\b[A-Z]{1,2}\d{1,3}[A-Z]?\b|\d{1,2}:\d{2}\s?(?:a\.?\s?m\.?|p\.?\s?m\.?)?)/)) {
      if (!parte) continue;
      if (/^[A-Z]{1,2}\d/.test(parte)) cuerpo.append(Object.assign(document.createElement("b"), { className: "renglon-ruta", textContent: parte }));
      else if (/^\d{1,2}:\d{2}/.test(parte)) cuerpo.append(Object.assign(document.createElement("b"), { className: "renglon-hora", textContent: parte }));
      else cuerpo.append(parte);
    }
    return li;
  }));
}
new MutationObserver(pintarRenglonesGuia).observe($("guiaDetalle"), { childList: true, characterData: true, subtree: true });
// Las hojas de abajo se cierran arrastrandolas hacia abajo, como en las apps; un toque normal sigue siendo toque.
function arrastreParaCerrar(hoja) {
  let y0 = null, x0 = 0, dy = 0, t0 = 0, arrastra = false;
  hoja.addEventListener("touchstart", (e) => {
    y0 = e.touches.length === 1 && hoja.scrollTop <= 0 ? e.touches[0].clientY : null;
    if (y0 === null) return;
    x0 = e.touches[0].clientX; dy = 0; t0 = performance.now(); arrastra = false;
  }, { passive: true });
  hoja.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    const t = e.touches[0], dx = Math.abs(t.clientX - x0);
    dy = t.clientY - y0;
    if (!arrastra) {
      // Si va hacia arriba o de lado es scroll o carrusel: la hoja no se mueve.
      if (dy < -6 || dx > 12) { y0 = null; return; }
      if (dy < 8 || dx > dy) return;
      arrastra = true;
      hoja.style.transition = "none";
    }
    e.preventDefault();
    hoja.style.transform = `translateY(${Math.max(0, dy - 8)}px)`;
  }, { passive: false });
  const soltar = () => {
    if (y0 === null) return;
    y0 = null;
    if (!arrastra) return;
    const rapido = dy / Math.max(1, performance.now() - t0) > 0.6;
    hoja.style.transition = "transform .2s ease-out";
    if (dy > Math.min(140, hoja.offsetHeight * 0.3) || (rapido && dy > 40)) {
      hoja.style.transform = "translateY(100%)";
      setTimeout(() => { hoja.close(); hoja.style.transform = ""; hoja.style.transition = ""; }, 190);
    } else {
      hoja.style.transform = "";
      setTimeout(() => { hoja.style.transition = ""; }, 220);
    }
  };
  hoja.addEventListener("touchend", soltar);
  hoja.addEventListener("touchcancel", soltar);
}
document.querySelectorAll("dialog.hoja-perfil").forEach(arrastreParaCerrar);
// Al cerrar una hoja con el dedo, el foco regresa al boton que la abrio sin dibujarle el anillo de teclado.
let ultimoToque = 0;
addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") ultimoToque = Date.now(); }, true);
addEventListener("keydown", () => { ultimoToque = 0; }, true);
document.querySelectorAll("dialog.hoja-perfil").forEach((h) => h.addEventListener("close", () => setTimeout(() => {
  const el = document.activeElement;
  if (!el || el === document.body || Date.now() - ultimoToque > 5000) return;
  el.classList.add("sin-anillo");
  el.addEventListener("blur", () => el.classList.remove("sin-anillo"), { once: true });
}, 0)));
