const $ = (id) => document.getElementById(id);
// Sigue el tema elegido en la app; si no eligió ninguno, el del teléfono.
try { const tema = JSON.parse(localStorage.getItem("grieta-acc"))?.tema; if (tema === "claro" || tema === "oscuro") document.documentElement.classList.add(tema); } catch {}
const TIPOS = {
  no_paro: "No hizo la parada", sucio: "Unidad sucia o en mal estado", manejo: "Manejo peligroso", cobro: "Cobro de más", acoso: "Acoso o agresión", otro_servicio: "Otra cosa del servicio",
  banqueta: "Banqueta rota", sin_rampa: "No hay rampa", sin_techo: "Parada sin techo", obstaculo: "Obstáculo", sin_senalizacion: "Falta señalización", referencia: "Referencia", otro: "Otra cosa",
};
const TITULOS_AVISO = { ...TIPOS, otro: "Problema en la parada" };
const ICONOS_AVISO = { banqueta: "p-silla", sin_rampa: "p-silla", sin_senalizacion: "p-senal" };
const LOGROS = { banqueta: "¡Ya quedó la banqueta!", sin_rampa: "¡Ya quedó la rampa!", sin_techo: "¡Ya le pusieron techo!", obstaculo: "¡Ya quitaron el obstáculo!", sin_senalizacion: "¡Ya pusieron señalización!" };
// Con menos avisos no se puede hablar de un patron por hora.
const AVISOS_PARA_PICO = 5;
const VOTOS = "grieta-votos-ciudad";
const numero = (n) => n.toLocaleString("es-MX");
const vacio = (lista) => { const li = document.createElement("li"); li.className = "vacio"; li.textContent = "Todavía sin datos."; lista.append(li); };
function fila(lista, nombre, valor, ancho) {
  const li = document.createElement("li"), etiqueta = document.createElement("span"), total = document.createElement("strong"), medidor = document.createElement("span"), relleno = document.createElement("i");
  etiqueta.textContent = nombre; total.textContent = valor; medidor.className = "medidor"; relleno.style.width = `${ancho}%`;
  medidor.append(relleno); li.append(etiqueta, total, medidor); lista.append(li);
}
function barras(id, filas, nombre = (x) => x) {
  const lista = $(id);
  lista.replaceChildren();
  if (!filas.length) return vacio(lista);
  const tope = Math.max(...filas.map((f) => f.total));
  for (const f of filas) fila(lista, nombre(f.clave), numero(f.total), (f.total / tope) * 100);
}
// Porcentaje de viajes estresados; cada fila muestra cuantas respuestas tiene detras.
function porcentajes(id, filas) {
  const lista = $(id);
  lista.replaceChildren();
  const conDatos = filas.filter((f) => f.total);
  if (!conDatos.length) return vacio(lista);
  for (const f of conDatos) { const pct = Math.round((f.estresado / f.total) * 100); fila(lista, f.clave, `${pct} % de ${numero(f.total)}`, pct); }
}
const hora12 = (h) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto !== undefined) e.textContent = texto; return e; };
const leerLocal = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const horaActual = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
const paradaBonita = (p) => p.replace(/\s*\/\s*/g, " / ");
function hace(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min} min`;
  if (min < 1440) return `Hace ${Math.floor(min / 60)} h`;
  const dias = Math.floor(min / 1440);
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}
// Tramo seguido de horas alrededor de h, como "de 7 a 9 am".
function rango(horas, h) {
  let desde = h, hasta = h + 1;
  while (horas.includes(desde - 1)) desde--;
  while (horas.includes(hasta)) hasta++;
  hasta %= 24;
  return `de ${(desde < 12) === (hasta < 12) ? desde % 12 || 12 : hora12(desde)} a ${hora12(hasta)}`;
}
// Las lineas salen del telefono y nunca se mandan al servidor.
function misLineas() {
  const lineas = new Set();
  for (const v of leerLocal("grieta-viajes", [])) for (const m of String(v.camino ?? "").matchAll(/\b[A-Z]{1,3}\d{1,3}[A-Z]?\b/g)) lineas.add(m[0]);
  return [...lineas].slice(0, 3);
}
function estadoLinea(info = {}, h) {
  if (info.lleno) return ["ambar", "Viene llena", `Avisó alguien ${hace(info.lleno).toLowerCase()}`];
  if (info.suele?.includes(h)) { const r = rango(info.suele, h); return ["ambar", "Suele ir llena", `${r[0].toUpperCase()}${r.slice(1)}, según la gente`]; }
  if (info.quejas) return ["rojo", info.quejas.total === 1 ? "Una queja esta semana" : `${info.quejas.total} quejas esta semana`, TIPOS[info.quejas.tipo] ?? "Reportada por la gente"];
  return ["verde", "Sin avisos", "En la última media hora"];
}
function textos(fuerte, chico) { const s = el("span", "tx"); s.append(el("strong", "", fuerte)); if (chico) s.append(el("small", "", chico)); return s; }
function pintarLineas(v) {
  const mias = v ? misLineas() : [];
  $("tusLineas").hidden = !mias.length;
  const h = horaActual();
  $("listaLineas").replaceChildren(...mias.map((l) => {
    const [tono, titulo, detalle] = estadoLinea(v.lineas[l], h);
    const li = el("li");
    li.append(el("span", "caja-linea", l), textos(titulo, detalle), el("i", `punto ${tono}`));
    return li;
  }));
}
function icono(id, tono) { const s = el("span", `ic ${tono}`); s.innerHTML = `<svg class="picto" aria-hidden="true"><use href="#${id}"/></svg>`; return s; }
function fila2(ic, titulo, detalle, cuando) { const d = el("div", "aviso-fila"); d.append(ic, textos(titulo, detalle)); if (cuando) d.append(el("time", "", cuando)); return d; }
// Cada telefono cuenta una sola vez por aviso.
function cajaVotos(api, clave, opciones) {
  const caja = el("div", opciones.length === 1 ? "votos uno" : "votos"), votados = leerLocal(VOTOS, {});
  const botones = opciones.map((o) => {
    const b = el("button"), cuenta = el("b", "", String(o.cuenta));
    b.type = "button"; b.append(`${o.texto} `, cuenta); b.disabled = clave in votados;
    if (votados[clave] === o.valor) b.classList.add("elegido");
    b.addEventListener("click", async () => {
      botones.forEach((x) => { x.disabled = true; });
      caja.parentElement.querySelector(".voto-error")?.remove();
      try {
        const r = await fetch(`${api}${o.ruta}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o.cuerpo ?? {}) });
        if (!r.ok) throw Error();
        cuenta.textContent = String(o.cuenta + 1);
        b.classList.add("elegido");
        guardarLocal(VOTOS, { ...leerLocal(VOTOS, {}), [clave]: o.valor });
      } catch {
        botones.forEach((x) => { x.disabled = false; });
        caja.after(el("p", "voto-error", "No se pudo mandar. Intenta otra vez."));
      }
    });
    return b;
  });
  caja.append(...botones);
  return caja;
}
function pintarAvisos(v, api) {
  $("bloqueAvisos").hidden = !v;
  if (!v) return;
  const lista = v.avisos.map((a) => {
    const li = el("li", "aviso");
    if (a.tipo === "lleno") li.append(fila2(icono("p-lleno", "ambar"), `${a.linea} viene llena`, "", hace(a.creado)), cajaVotos(api, `lleno-${a.linea}-${a.creado}`, [{ texto: "Yo también la vi", cuenta: a.veces, valor: 1, ruta: `/camiones/avisos/${a.linea}/confirmar` }]));
    else li.append(fila2(icono(ICONOS_AVISO[a.tipo] ?? "p-reportar", "azul"), TITULOS_AVISO[a.tipo] ?? a.tipo, paradaBonita(a.parada), hace(a.creado)), cajaVotos(api, `reporte-${a.id}`, [{ texto: "Sigue así", cuenta: a.sigue, valor: 1, ruta: `/reportes/${a.id}/verificar`, cuerpo: { sigue: true } }, { texto: "Ya lo arreglaron", cuenta: a.arreglado, valor: 0, ruta: `/reportes/${a.id}/verificar`, cuerpo: { sigue: false } }]));
    return li;
  });
  for (const a of v.arreglados) {
    const li = el("li", "aviso logro");
    li.append(fila2(icono("p-escudo", "blanco"), LOGROS[a.tipo] ?? "¡Ya quedó!", `${paradaBonita(a.parada)}: ${a.personas} personas confirmaron que ya lo arreglaron.`));
    lista.push(li);
  }
  if (!lista.length) lista.push(el("li", "sin-avisos", "Todavía nadie ha avisado nada. Puedes ser la primera persona."));
  $("listaAvisos").replaceChildren(...lista);
}
// La pantalla sale en el idioma que eligió en la app.
const idiomaElegido = leerLocal("grieta-acc", {}).idioma;
if (idiomaElegido === "oto" || idiomaElegido === "nah") Interfaz.iniciar(idiomaElegido, () => {});
(async () => {
  try {
    const config = await fetch("datos/config.json").then((r) => r.json()).catch(() => ({}));
    const api = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3000/api" : config.api;
    $("enlaceJson").href = `${api}/observatorio`;
    const pedir = (ruta) => fetch(`${api}${ruta}`).then((r) => { if (!r.ok) throw Error(); return r.json(); });
    const [d, vivo] = await Promise.all([pedir("/observatorio"), pedir("/observatorio/vivo").catch(() => null)]);
    pintarLineas(vivo);
    pintarAvisos(vivo, api);
    $("cCo2").textContent = `${d.impacto.co2_kg.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg`;
    $("cViajes").textContent = numero(d.impacto.viajes);
    $("cQuejas").textContent = numero(d.quejas.total);
    $("cAcceso").textContent = numero(d.accesibilidad.porTipo.filter((t) => t.clave !== "referencia").reduce((s, t) => s + t.total, 0));
    barras("quejasRuta", d.quejas.porRuta);
    barras("quejasTipo", d.quejas.porTipo, (t) => TIPOS[t] ?? t);
    barras("accesoTipo", d.accesibilidad.porTipo, (t) => TIPOS[t] ?? t);
    barras("accesoParada", d.accesibilidad.porParada);
    barras("llenoLinea", d.lleno.porLinea);
    const v = d.sentir?.porValor ?? {}, totalSentir = d.sentir?.total ?? 0;
    $("sentirResumen").textContent = totalSentir ? `${numero(totalSentir)} ${totalSentir === 1 ? "respuesta" : "respuestas"}: ${v.tranquilo ?? 0} tranquilos, ${v.normal ?? 0} normales y ${v.estresado ?? 0} estresados.` : "Todavía sin respuestas.";
    if (totalSentir) $("sentirBarra").replaceChildren(...["tranquilo", "normal", "estresado"].filter((k) => v[k]).map((k) => { const i = document.createElement("i"); i.className = k; i.style.flexGrow = v[k]; return i; }));
    porcentajes("sentirFranja", d.sentir?.porFranja ?? []);
    porcentajes("sentirLinea", d.sentir?.porLinea ?? []);
    const tope = Math.max(1, ...d.lleno.porHora), maximo = Math.max(...d.lleno.porHora), pico = d.lleno.porHora.indexOf(maximo), ahora = horaActual();
    $("llenoHora").replaceChildren(...d.lleno.porHora.map((n, h) => {
      const s = document.createElement("span"), i = document.createElement("i");
      i.style.height = `${(n / tope) * 100}%`; s.title = `${hora12(h)}: ${n}`;
      if (h === ahora) s.className = "ahora";
      s.append(i);
      return s;
    }));
    if (d.lleno.total) {
      $("llenoNota").textContent = `${numero(d.lleno.total)} ${d.lleno.total === 1 ? "aviso" : "avisos"} de "viene lleno" en las últimas 8 semanas.`;
      if (d.lleno.total >= AVISOS_PARA_PICO) {
        const fuertes = d.lleno.porHora.flatMap((n, h) => (n >= maximo * 0.7 ? [h] : []));
        $("llenoPico").textContent = `El camión suele ir más lleno ${rango(fuertes, pico)}`;
        $("llenoHora").setAttribute("aria-label", `Avisos de camión lleno por hora. Suele ir más lleno ${rango(fuertes, pico)}.`);
      } else $("llenoPico").textContent = "Todavía hay pocos avisos para ver un patrón";
    }
    const hecha = new Date(d.actualizado).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
    $("estado").textContent = hecha;
    $("estado").setAttribute("aria-label", `Actualizado a las ${hecha}`);
    // Las secciones sin ningún dato se juntan en una sola tarjeta, en lugar de repetir "Todavía sin datos".
    const vacias = [...document.querySelectorAll("section[data-titulo]")].filter((sec) => {
      const listas = [...sec.querySelectorAll("ol")];
      const horas = sec.querySelector(".horas");
      return listas.every((l) => l.querySelector(".vacio")) && (!horas || d.lleno.porHora.every((n) => !n)) && !(sec.contains($("sentirResumen")) && totalSentir);
    });
    for (const sec of vacias) sec.hidden = true;
    $("listaPendientes").replaceChildren(...vacias.map((sec) => { const li = document.createElement("li"); li.textContent = sec.dataset.titulo; return li; }));
    $("pendientes").hidden = !vacias.length;
  } catch {
    $("estado").textContent = "No pude cargar los datos. Revisa tu conexión e intenta otra vez.";
  }
})();
