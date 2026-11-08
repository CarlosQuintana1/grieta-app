const $ = (id) => document.getElementById(id);
// Sigue el tema elegido en la app; si no eligió ninguno, el del teléfono.
try { const tema = JSON.parse(localStorage.getItem("grieta-acc"))?.tema; if (tema === "claro" || tema === "oscuro") document.documentElement.classList.add(tema); } catch {}
const TIPOS = {
  no_paro: "No hizo la parada", sucio: "Unidad sucia o en mal estado", manejo: "Manejo peligroso", cobro: "Cobro de más", acoso: "Acoso o agresión", otro_servicio: "Otra cosa del servicio",
  banqueta: "Banqueta rota", sin_rampa: "No hay rampa", sin_techo: "Parada sin techo", obstaculo: "Obstáculo", sin_senalizacion: "Falta señalización", referencia: "Referencia", otro: "Otra cosa",
};
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
(async () => {
  try {
    const config = await fetch("datos/config.json").then((r) => r.json()).catch(() => ({}));
    const api = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3000/api" : config.api;
    $("enlaceJson").href = `${api}/observatorio`;
    const d = await fetch(`${api}/observatorio`).then((r) => { if (!r.ok) throw Error(); return r.json(); });
    $("cCo2").textContent = `${d.impacto.co2_kg.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg`;
    $("cViajes").textContent = numero(d.impacto.viajes);
    $("cQuejas").textContent = numero(d.quejas.total);
    $("cAcceso").textContent = numero(d.accesibilidad.vigentes);
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
    const tope = Math.max(1, ...d.lleno.porHora), pico = d.lleno.porHora.indexOf(Math.max(...d.lleno.porHora));
    $("llenoHora").replaceChildren(...d.lleno.porHora.map((n, h) => {
      const s = document.createElement("span"), i = document.createElement("i");
      i.style.height = `${(n / tope) * 100}%`; s.title = `${hora12(h)}: ${n}`;
      s.append(i);
      return s;
    }));
    if (d.lleno.total) {
      $("llenoPico").textContent = `Más llenos a las ${hora12(pico)}`.replace("a las 1 ", "a la 1 ");
      $("llenoHora").setAttribute("aria-label", `Avisos de camión lleno por hora. El pico es a las ${hora12(pico)}.`);
    }
    $("estado").textContent = `Actualizado: ${new Date(d.actualizado).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`;
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
