// © 2026 Equipo Grieta. Todos los derechos reservados; prohibido copiarlo o usarlo para entrenar IA.
// Qro en vivo: mapa de la ciudad con avisos, voz de los viajeros, CO2 por zona y zonas donde falta una ruta.
// Hexagonos, paradas, CO2 y zonas salen del dataset y del GTFS; avisos y comentarios son de ejemplo para la feria.
const EnVivo = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ico = (n) => `<svg class="picto" aria-hidden="true"><use href="#p-${n}"/></svg>`;
  const mil = (n) => Math.round(n).toLocaleString("en-US");
  const leerLocal = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const guardarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const AVISO = { choque: ["carro", "rojo"], trafico: ["traffic-cone", "naranja"], tiempo: ["qrobus", "verde"], techo: ["sintecho", "azul"], comentario: ["decir", "ciruela"] };
  let datos = null, vista = "mapa", filtro = "todo", ruta = "C69", rapido = null;
  const propios = { avisos: leerLocal("grieta-envivo-avisos", []), posts: leerLocal("grieta-envivo-posts", []) };

  // Proyeccion simple de lat/lon al lienzo, con el ancho corregido por la latitud de Queretaro.
  function proyector(W, H, margen = 8) {
    let la0 = 1e9, la1 = -1e9, lo0 = 1e9, lo1 = -1e9;
    for (const b of datos.vecinas) for (const [a, o] of b) { la0 = Math.min(la0, a); la1 = Math.max(la1, a); lo0 = Math.min(lo0, o); lo1 = Math.max(lo1, o); }
    const k = Math.cos(20.6 * Math.PI / 180), w = (lo1 - lo0) * k, h = la1 - la0, s = Math.min((W - margen * 2) / w, (H - margen * 2) / h);
    return (a, o) => [((o - lo0) * k * s + (W - w * s) / 2).toFixed(1), ((la1 - a) * s + (H - h * s) / 2).toFixed(1)];
  }
  const poligono = (P, b) => b.map(([a, o]) => P(a, o).join(",")).join(" ");
  const fondoCiudad = (P, cada = 2) => datos.vecinas.map((b) => `<polygon class="ev-vecina" points="${poligono(P, b)}"/>`).join("")
    + datos.paradas.filter((_, i) => i % cada === 0).map(([a, o]) => { const [x, y] = P(a, o); return `<circle class="ev-parada" cx="${x}" cy="${y}" r="1.1"/>`; }).join("");

  function pintarMapa() {
    const P = proyector(390, 400, 4), mx = Math.max(...datos.zonas.map((z) => z.viajes));
    let g = fondoCiudad(P);
    g += datos.zonas.map((z) => `<polygon class="ev-celda" points="${poligono(P, z.b)}" fill-opacity="${(0.18 + 0.5 * z.viajes / mx).toFixed(2)}"/>`).join("");
    if (filtro === "todo" || filtro === "trafico") g += datos.trafico.map((t) => `<polyline class="ev-flujo ${t.tipo}" points="${t.puntos.map(([a, o]) => P(a, o).join(",")).join(" ")}"/>`).join("");
    const todos = [...datos.avisos, ...propios.avisos].filter((v) => filtro === "todo" || v.tipo === filtro || (filtro === "trafico" && v.tipo === "trafico"));
    g += todos.map((v, i) => { const [x, y] = P(v.lat, v.lon), [p, c] = AVISO[v.tipo] ?? AVISO.comentario;
      return `<g class="ev-marca ${c} d${i % 5}" transform="translate(${x} ${y})"><circle class="ev-ping" r="15"/><rect x="-17" y="-42" width="34" height="34" rx="10"/><path d="M-6 -8 L0 0 L6 -8Z"/><use href="#p-${p}" x="-11" y="-36" width="22" height="22"/></g>`; }).join("");
    $("evMapaSvg").innerHTML = g;
    $("evCo2Cifra").textContent = `${(datos.totalCo2 / 1000).toFixed(1)} t`;
    $("evAvisos").innerHTML = [...propios.avisos.slice(-2).reverse(), ...datos.avisos].slice(0, 4).map((v) => { const [p, c] = AVISO[v.tipo] ?? AVISO.comentario;
      return `<li class="${c}"><span class="ev-ico">${ico(p)}</span><span><b>${esc(v.titulo)}</b><small>${esc(v.texto)}</small></span><small class="ev-hace">${esc(v.hace)}</small></li>`; }).join("");
  }

  function pintarRed() {
    const r = datos.rutas[ruta];
    $("evRutas").innerHTML = Object.keys(datos.rutas).map((k) => `<button type="button" aria-pressed="${k === ruta}" data-r="${k}" translate="no">${k}</button>`).join("");
    $("evAtiempo").textContent = `${r.atiempo}%`;
    $("evBarras").innerHTML = r.barras.map((v, i) => `<rect class="ev-barra d${i % 5}" x="${i * 27}" y="${56 - v * 0.56}" width="22" height="${v * 0.56}" rx="5"/>`).join("");
    const mios = propios.posts.filter((p) => p.ruta === ruta).slice(-3).reverse();
    $("evPosts").innerHTML = [...mios, ...r.publicaciones].map((p, i) => `<li class="ev-post d${i % 5}${p.tuyo ? " tuyo" : ""}">
      <span class="ev-quien"><span class="ev-av" translate="no">${esc(p.inicial)}</span><span><b>${esc(p.quien)}</b><small><span${p.tuyo ? "" : ' translate="no"'}>${esc(p.donde)}</span><span>${esc(p.hace)}</span></small></span></span>
      <p>${esc(p.texto)}</p>${p.tags.length ? `<span class="ev-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>` : ""}
      <span class="ev-reac"><span>Útil <b translate="no">${p.util}</b></span><span>Yo también <b translate="no">${p.tambien}</b></span></span></li>`).join("");
  }

  // El Acueducto en perspectiva: los huecos de los arcos dejan ver el paisaje de atras.
  function pintarAcueducto() {
    const HZ = 146; let a = `<defs><linearGradient id="evCie" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e98f7a"/><stop offset=".45" stop-color="#f4b496"/><stop offset=".8" stop-color="#f9d7b8"/><stop offset="1" stop-color="#fbe6cd"/></linearGradient>
      <radialGradient id="evSol"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffd98a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
      <linearGradient id="evCara" x1="0" x2="1"><stop offset="0" stop-color="#c88e6b"/><stop offset="1" stop-color="#b47755"/></linearGradient>
      <linearGradient id="evLado" x1="0" x2="1"><stop offset="0" stop-color="#8e563d"/><stop offset="1" stop-color="#a5694c"/></linearGradient>
      <linearGradient id="evPasto" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#86d6a0"/><stop offset="1" stop-color="#2d8a54"/></linearGradient>
      <linearGradient id="evLejos" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d89a86"/><stop offset="1" stop-color="#e9b9a0"/></linearGradient></defs>
      <rect width="358" height="236" fill="url(#evCie)"/><circle cx="300" cy="96" r="58" fill="url(#evSol)"/><circle cx="300" cy="96" r="20" fill="#fff1c2"/>
      <g class="ev-nube"><ellipse cx="30" cy="38" rx="34" ry="9" fill="#fff6ee"/><ellipse cx="50" cy="31" rx="18" ry="9" fill="#fff6ee"/></g><g class="ev-nube dos"><ellipse cx="30" cy="66" rx="26" ry="7" fill="#fff6ee"/></g>
      <path d="M0 132 C50 112 90 118 130 128 C170 104 230 106 280 124 C310 116 340 118 358 122 V236 H0Z" fill="url(#evLejos)"/>
      <g fill="#c78874"><rect x="150" y="116" width="16" height="22"/><path d="M150 116 a8 8 0 0 1 16 0"/><rect x="156" y="102" width="3" height="10"/><rect x="172" y="124" width="26" height="14"/><path d="M178 124 a7 7 0 0 1 14 0"/><rect x="204" y="120" width="10" height="18"/><path d="M204 120 a5 5 0 0 1 10 0"/></g>
      <path d="M0 150 C80 136 150 140 220 146 C280 140 330 142 358 146 V236 H0Z" fill="#9fcf8e"/>`;
    for (const [x, y, r] of [[40, 140, 16], [96, 142, 12], [190, 146, 14], [250, 143, 11], [300, 145, 9]]) a += `<rect x="${x - 1.5}" y="${y}" width="3" height="${r * 0.9}" fill="#6b4a33"/><circle cx="${x}" cy="${y - r * 0.3}" r="${r * 0.7}" fill="#4fae73"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.55}" r="${r * 0.5}" fill="#6cc48c"/>`;
    const n = 15, w0 = 66, k = 0.85, P = []; let xx = -30;
    for (let i = 0; i < n; i++) { const s = k ** i; P.push({ x: xx, ww: w0 * s, s }); xx += w0 * s; }
    for (let i = n - 1; i >= 0; i--) {
      const { x, ww, s } = P[i], base = HZ + (228 - HZ) * s, top = HZ - (HZ - 28) * s, hh = base - top, pil = ww * 0.26, ar = ww - pil, ab = top + hh * 0.16 + ar / 2, prof = Math.max(1.5, 7 * s);
      a += `<path d="M${x + ww} ${top} l${prof} ${-prof * 0.35} V${base - prof * 0.35} l${-prof} ${prof * 0.35}Z" fill="url(#evLado)"/>`;
      a += `<path fill-rule="evenodd" fill="url(#evCara)" d="M${x} ${top} H${x + ww + 0.6} V${base} H${x} Z M${x + pil} ${base} V${ab} a${ar / 2} ${ar / 2} 0 0 1 ${ar} 0 V${base} Z"/>`;
      a += `<path d="M${x + pil + ar} ${base} V${ab} a${ar / 2} ${ar / 2} 0 0 0 ${-ar * 0.18} ${-ar * 0.42}" fill="none" stroke="#8a5239" stroke-width="${Math.max(1, prof * 0.9)}" opacity=".75"/>`;
      for (let d = 1; d < 6; d++) { const g = Math.PI * d / 6, cx = x + pil + ar / 2, r = ar / 2; a += `<line x1="${cx - Math.cos(g) * r}" y1="${ab - Math.sin(g) * r}" x2="${cx - Math.cos(g) * (r + 5 * s)}" y2="${ab - Math.sin(g) * (r + 5 * s)}" stroke="#9a6247" stroke-width="${Math.max(0.4, s)}"/>`; }
      for (let j = 1; j < 7; j++) a += `<line x1="${x}" x2="${x + pil}" y1="${ab + (base - ab) * j / 7}" y2="${ab + (base - ab) * j / 7}" stroke="#a46a4e" stroke-width="${Math.max(0.3, 0.8 * s)}"/>`;
      a += `<rect x="${x - 1}" y="${top - 6 * s}" width="${ww + 2}" height="${6 * s}" fill="#9b6145"/><rect x="${x - 1}" y="${top - 6 * s}" width="${ww + 2}" height="${1.6 * s}" fill="#d9a382"/><ellipse cx="${x + pil / 2}" cy="${base}" rx="${pil}" ry="${2.4 * s}" fill="#5f3a28" opacity=".3"/>`;
    }
    a += `<path d="M0 236 L0 214 Q140 196 358 172 L358 236Z" fill="url(#evPasto)"/>`;
    for (let i = 0; i < 10; i++) { const px = 12 + i * 26 + (i % 3) * 4, by = 232 - i * 3.2, hh = 12 + (i % 4) * 6;
      a += `<g class="ev-brote d${i % 5}"><path d="M${px} ${by} v-${hh}" stroke="#2d8a54" stroke-width="2.6"/><ellipse cx="${px - 5}" cy="${by - hh}" rx="7" ry="3.8" fill="#5fc98c" transform="rotate(-30 ${px - 5} ${by - hh})"/><ellipse cx="${px + 5}" cy="${by - hh + 3}" rx="7" ry="3.8" fill="#86d6a0" transform="rotate(30 ${px + 5} ${by - hh + 3})"/></g>`; }
    for (let i = 0; i < 7; i++) a += `<ellipse class="ev-hojita d${i % 5}" cx="${30 + i * 46}" cy="216" rx="5.5" ry="3" fill="#86d6a0"/>`;
    $("evAcueducto").innerHTML = a;
  }

  // Del verde (poco) al rojo (mucho), como en el resto de las escalas de la app.
  const escala = (t) => { const c = [[29, 59, 42], [95, 201, 140], [224, 160, 60], [229, 72, 77]], x = Math.min(2.999, t * 3), i = Math.floor(x), f = x - i; return `rgb(${c[i].map((v, j) => Math.round(v + (c[i + 1][j] - v) * f)).join(",")})`; };
  function pintarRespira() {
    pintarAcueducto();
    $("evTotal").textContent = `${mil(datos.totalCo2)} kg`; $("evViajes").textContent = mil(datos.totalViajes);
    const P = proyector(200, 200, 4), mx = Math.max(...datos.zonas.map((z) => z.co2));
    $("evCo2Mapa").innerHTML = fondoCiudad(P, 3) + datos.zonas.map((z, i) => `<polygon class="ev-zona d${i % 5}" points="${poligono(P, z.b)}" fill="${escala(Math.sqrt(z.co2 / mx))}"/>`).join("");
    $("evCo2Top").innerHTML = [...datos.zonas].sort((a, b) => b.co2 - a.co2).slice(0, 3).map((z) => `<li><b translate="no">${mil(z.co2)} kg</b><span translate="no">${esc(z.nombre)}</span></li>`).join("");
  }

  const razon = (z) => z.viajes / (1 + z.paradas);
  function pintarRutas() {
    const P = proyector(390, 300, 6), mr = Math.max(...datos.zonas.map(razon)), top = datos.zonas.slice(0, 4);
    let g = fondoCiudad(P) + datos.zonas.map((z, i) => `<polygon class="ev-falta-celda${i < 4 ? " fuerte" : ""}" points="${poligono(P, z.b)}" fill-opacity="${(0.12 + 0.85 * razon(z) / mr).toFixed(2)}"/>`).join("");
    g += top.map((z, i) => { const c = z.b.reduce((m, [a, o]) => [m[0] + a / z.b.length, m[1] + o / z.b.length], [0, 0]), [x, y] = P(c[0], c[1]);
      return `<g class="ev-num n${i}"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${(+y + 4.5).toFixed(1)}" text-anchor="middle">${i + 1}</text></g>`; }).join("");
    $("evFaltaMapa").innerHTML = g;
    $("evFalta").innerHTML = top.map((z, i) => `<li class="n${i}"><span class="ev-n" translate="no">${i + 1}</span><span><b translate="no">${esc(z.nombre)}</b><small class="ev-dato"><b translate="no">${z.viajes}</b> <span>viajes en app</span></small><small class="ev-dato"><b translate="no">${z.paradas}</b> <span>paradas</span></small></span><svg class="ev-barra-z" viewBox="0 0 70 10" aria-hidden="true"><rect width="70" height="10" rx="5" class="fondo"/><rect width="${Math.round(70 * razon(z) / mr)}" height="10" rx="5" class="lleno"/></svg></li>`).join("");
  }

  function cambiarVista(v) {
    vista = v;
    for (const b of document.querySelectorAll("#evVistas [role=tab]")) { const si = b.dataset.ev === v; b.setAttribute("aria-selected", String(si)); b.tabIndex = si ? 0 : -1; }
    $("evMapa").hidden = v !== "mapa"; $("evRed").hidden = v !== "red"; $("evRespira").hidden = v !== "respira"; $("evRutasVista").hidden = v !== "rutas";
    ({ mapa: pintarMapa, red: pintarRed, respira: pintarRespira, rutas: pintarRutas })[v]();
  }

  async function abrir() {
    try { datos ??= await fetch("datos/envivo.json").then((r) => r.json()); } catch { return; }
    cambiarVista(vista);
  }

  const aviso = (t) => (typeof avisarBreve === "function" ? avisarBreve(t) : null);
  $("evVistas").addEventListener("click", (e) => { const b = e.target.closest("[data-ev]"); if (b) cambiarVista(b.dataset.ev); });
  $("evVistas").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const t = [...document.querySelectorAll("#evVistas [role=tab]")], i = t.findIndex((b) => b.dataset.ev === vista), j = (i + (e.key === "ArrowRight" ? 1 : t.length - 1)) % t.length;
    cambiarVista(t[j].dataset.ev); t[j].focus();
  });
  $("evFiltros").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; filtro = b.dataset.f; for (const x of $("evFiltros").children) x.setAttribute("aria-pressed", String(x === b)); pintarMapa(); });
  $("evCo2").addEventListener("click", () => cambiarVista("respira"));
  document.querySelector("#evMapa .ev-botones").addEventListener("click", (e) => {
    const b = e.target.closest("[data-avisar]"); if (!b) return;
    const tipo = b.dataset.avisar, yo = (typeof estado !== "undefined" && (estado.gps ?? estado.origen)) || { lat: 20.704, lon: -100.444 };
    propios.avisos.push({ tipo, lat: yo.lat, lon: yo.lon, titulo: tipo === "choque" ? "Avisaste un choque" : "Avisaste tráfico", texto: "Se ve en el mapa de este teléfono.", hace: "ahora" });
    propios.avisos = propios.avisos.slice(-5); guardarLocal("grieta-envivo-avisos", propios.avisos);
    pintarMapa(); aviso("Gracias. Tu aviso ya está en el mapa.");
  });
  $("evRutas").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) { ruta = b.dataset.r; pintarRed(); } });
  $("evRapidos").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; rapido = b.getAttribute("aria-pressed") === "true" ? null : b.dataset.t; for (const x of $("evRapidos").children) x.setAttribute("aria-pressed", String(x.dataset.t === rapido)); });
  const enviar = () => {
    const texto = $("evTexto").value.trim();
    if (!texto && !rapido) return aviso("Elige cómo va tu viaje o escribe algo.");
    propios.posts.push({ ruta, tuyo: true, quien: "Tú", inicial: "T", donde: "Solo en este teléfono", hace: "ahora", texto: texto || rapido, tags: rapido ? [rapido] : [], util: 0, tambien: 0 });
    propios.posts = propios.posts.slice(-10); guardarLocal("grieta-envivo-posts", propios.posts);
    $("evTexto").value = ""; rapido = null; for (const x of $("evRapidos").children) x.setAttribute("aria-pressed", "false");
    pintarRed(); aviso("Listo, ya se ve en la ruta.");
  };
  $("evEnviar").addEventListener("click", enviar);
  $("evTexto").addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });
  $("evProponer").addEventListener("click", () => aviso("Gracias. Guardamos tu propuesta en este teléfono."));
  $("evCompartir").addEventListener("click", async () => {
    if (!datos) return;
    const texto = `Grieta, zonas de Querétaro con muchos viajes en app y pocas paradas de Qrobus (estimado): ${datos.zonas.slice(0, 4).map((z) => `${z.nombre}, ${z.viajes} viajes y ${z.paradas} paradas`).join("; ")}.`;
    try { if (navigator.share) await navigator.share({ title: "Faltan rutas", text: texto }); else { await navigator.clipboard.writeText(texto); aviso("Copiado para compartir."); } } catch {}
  });
  return { abrir };
})();
window.EnVivo = EnVivo;
