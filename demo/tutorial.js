// © 2026 Equipo Grieta. Todos los derechos reservados; prohibido copiarlo o usarlo para entrenar IA.
const TutorialGrieta = (() => {
  const $ = id => document.getElementById(id);
  const pasos = [
    { titulo: 'Busca a dónde vas', escena: 'buscar',
      texto: 'En Inicio, toca Busca un lugar o Decir a dónde voy y elige tu destino.', botones: ['Busca un lugar', 'Decir a dónde voy'],
      detalle: 'Compara Qrobus, Uber, DiDi e inDrive. Si eliges camión, toca Empezar viaje con avisos para recibir la guía.' },
    { titulo: 'Encuentra camiones cerca', escena: 'camiones', aviso: 'Los horarios son estimados: no vemos los camiones en tiempo real.',
      texto: 'El botón del centro, Camiones cerca, busca paradas desde tu ubicación.', botones: ['Camiones cerca'],
      detalle: 'Elige una parada para consultar rutas y horarios o Reportar algo en esta parada. Los horarios son estimados; no vemos los camiones en tiempo real.' },
    { titulo: 'Usa la cámara y la voz', escena: 'camara', aviso: 'Puede omitir obstáculos: usa tu bastón o acompañamiento.',
      texto: 'En Inicio o Ajustes, abre Describir con la cámara. En Ajustes, en Pantalla, puedes elegir el modo Voz.', botones: ['Describir con la cámara', 'modo Voz'],
      detalle: 'La cámara puede describir algunos objetos y leer letreros. Analiza las imágenes en tu teléfono y puede omitir obstáculos; usa tu bastón o acompañamiento.' },
  ];
  const enIdioma = t => Interfaz.traducirTexto(t);
  // El texto traducido puede ser mas largo: la letra baja para que quepa en su caja.
  const letraQueCabe = (t, base, cabe) => Math.min(base, Math.floor(base * cabe / t.length));
  const camionIco = (x, y, t, color) => `<svg x="${x}" y="${y}" width="${t}" height="${t}" color="${color}"><use href="#p-qrobus"/></svg>`;
  const ficha = (clase, x, nombre, precio, fondo) => `<g class="t-ficha ${clase}"><rect x="${x}" y="228" width="100" height="58" rx="15" fill="${fondo}"/><text x="${x + 50}" y="251" text-anchor="middle" font-size="13" fill="#fff">${nombre}</text><text x="${x + 50}" y="275" text-anchor="middle" font-size="21" fill="#fff">${precio}</text></g>`;
  // Tres escenas dibujadas a mano: sin animacion se quedan en su cuadro final.
  const ESCENAS = {
    buscar: tl => `<g class="t-todo">
      <rect x="20" y="78" width="320" height="140" rx="20" fill="#1c1408"/>
      <path d="M20 128H340M20 176H340M92 78V218M196 78V218M284 78V218" stroke="#3b301f" stroke-width="7"/>
      <path class="t-ruta" pathLength="1" d="M196 176V128H284" fill="none" stroke="#5fc98c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="196" cy="176" r="9" fill="#66b4e8" stroke="#fff" stroke-width="3"/>
      <g class="t-pin"><path d="M284 132c-14-18-20-27-20-38a20 20 0 1 1 40 0c0 11-6 20-20 38z" fill="#d9483b"/><circle cx="284" cy="94" r="8" fill="#fff"/></g>
      ${tl(96, 215, .36)}
      <rect x="20" y="14" width="320" height="52" rx="26" fill="#fff"/>
      <circle cx="49" cy="38" r="8" fill="none" stroke="#1c1408" stroke-width="3"/><path d="M55 44l7 7" stroke="#1c1408" stroke-width="3" stroke-linecap="round"/>
      <svg x="70" y="20" width="256" height="40" viewBox="70 20 256 40"><text x="74" y="47" font-size="22" fill="#1c1408">Alameda Hidalgo</text>
      <g class="t-tapa"><rect x="70" y="20" width="256" height="40" fill="#fff"/><rect x="70" y="26" width="3" height="28" fill="#1c1408"/></g></svg>
      ${ficha('f1', 20, 'Qrobus', '$11', '#1f6b46')}${ficha('f2', 130, 'DiDi', '$64', '#7a5a18')}${ficha('f3', 240, 'Uber', '$72', '#2b2520')}
    </g>`,
    camiones: () => `<g class="t-todo">
      <rect x="16" y="14" width="328" height="272" rx="22" fill="#0e2a1c"/>
      <path d="M16 86H344M16 178H344M104 14V286M240 14V286" stroke="#1d4a35" stroke-width="11"/>
      <path d="M16 132H344M172 14V286M304 14V286M50 14V286" stroke="#17392a" stroke-width="5"/>
      <path d="M26 178H104V86H240V178H334" fill="none" stroke="#e0a03c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="t-parada p1" cx="104" cy="130" r="8" fill="#fff" stroke="#e0a03c" stroke-width="4"/><circle class="t-parada p2" cx="172" cy="86" r="8" fill="#fff" stroke="#e0a03c" stroke-width="4"/><circle class="t-parada p3" cx="240" cy="132" r="8" fill="#fff" stroke="#e0a03c" stroke-width="4"/>
      <circle class="t-sonar s1" cx="172" cy="150" r="12" fill="#66b4e8"/><circle class="t-sonar s2" cx="172" cy="150" r="12" fill="#66b4e8"/>
      <circle cx="172" cy="150" r="11" fill="#66b4e8" stroke="#fff" stroke-width="3.5"/>
      <g class="t-bus"><rect x="-17" y="-17" width="34" height="34" rx="10" fill="#e0a03c" stroke="#0e2a1c" stroke-width="3"/>${camionIco(-13, -13, 26, '#1c1408')}</g>
      <g class="t-tarjeta"><rect x="32" y="212" width="296" height="62" rx="18" fill="#fff"/><rect x="44" y="224" width="62" height="38" rx="11" fill="#1f6b46"/><text x="75" y="250" text-anchor="middle" font-size="19" fill="#fff">C60</text><text x="118" y="240" font-size="${letraQueCabe(enIdioma('Pasa en 6 min'), 18, 17)}" fill="#1c1408">${enIdioma('Pasa en 6 min')}</text><text x="118" y="259" font-size="${letraQueCabe(enIdioma('Horario estimado'), 12, 34)}" fill="#6d665b">${enIdioma('Horario estimado')}</text></g>
    </g>`,
    camara: tl => `<g class="t-todo">
      <rect x="56" y="12" width="248" height="196" rx="22" fill="#241523"/>
      <rect x="56" y="168" width="248" height="40" fill="#332030"/>
      <rect x="175" y="96" width="10" height="92" fill="#b9b1a3"/>
      <rect x="124" y="36" width="112" height="72" rx="15" fill="#e0a03c"/>${camionIco(133, 50, 44, '#1c1408')}<text x="205" y="83" text-anchor="middle" font-size="24" fill="#1c1408">C60</text>
      <path d="M72 50V32a8 8 0 0 1 8-8h18M262 24h18a8 8 0 0 1 8 8v18M288 170v18a8 8 0 0 1-8 8h-18M98 196H80a8 8 0 0 1-8-8v-18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
      <rect class="t-marco" x="114" y="26" width="132" height="92" rx="18" fill="none" stroke="#5fc98c" stroke-width="4"/>
      <rect class="t-escaner" x="74" y="34" width="212" height="4" rx="2" fill="#5fc98c"/>
      ${tl(62, 294, .34)}
      <g class="t-globo"><path d="M122 262l-16 12 22-3z" fill="#fff"/><rect x="118" y="222" width="228" height="64" rx="22" fill="#fff"/>
        <g fill="#5b2f5a"><rect class="t-onda o1" x="136" y="246" width="5" height="16" rx="2.5"/><rect class="t-onda o2" x="146" y="240" width="5" height="28" rx="2.5"/><rect class="t-onda o3" x="156" y="244" width="5" height="20" rx="2.5"/><rect class="t-onda o4" x="166" y="238" width="5" height="32" rx="2.5"/><rect class="t-onda o5" x="176" y="246" width="5" height="16" rx="2.5"/></g>
        <text x="194" y="261" font-size="${letraQueCabe(enIdioma('Aquí pasa la C60'), 16, 16)}" fill="#1c1408">${enIdioma('Aquí pasa la C60')}</text></g>
    </g>`,
  };
  const glifo = (id, x, y, t, color) => `<svg x="${x}" y="${y}" width="${t}" height="${t}" color="${color}"><use href="#${id}"/></svg>`;
  const celular = (x, y, w, h, dentro) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#1c1408" stroke="#fff" stroke-width="3"/>${dentro}`;
  const barras = (x, y, color) => `<g fill="${color}">${[[0, 34, 'o1'], [14, 54, 'o2'], [28, 40, 'o3'], [42, 62, 'o4'], [56, 34, 'o5']].map(([d, a, c]) => `<rect class="t-onda ${c}" x="${x + d}" y="${y - a / 2}" width="8" height="${a}" rx="4"/>`).join('')}</g>`;
  // Una escena por pregunta de la bienvenida: mismo dibujo del tutorial en formato ancho, sin letras que traducir.
  const PREGUNTAS = {
    vista: tl => `${tl(100, 174, .3)}${celular(214, 10, 124, 156, `
      <g class="t-fase f1"><rect x="224" y="26" width="104" height="72" rx="10" fill="#0e2a1c"/><path d="M224 62H328M264 26V98" stroke="#1d4a35" stroke-width="5"/><path d="M238 88V62H308" fill="none" stroke="#5fc98c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="308" cy="62" r="7" fill="#d9483b"/><rect x="224" y="110" width="104" height="11" rx="5.5" fill="#4a4033"/><rect x="224" y="130" width="70" height="11" rx="5.5" fill="#4a4033"/></g>
      <g class="t-fase f2"><text x="276" y="108" text-anchor="middle" font-size="72" fill="#fff">Aa</text><rect x="230" y="128" width="92" height="12" rx="6" fill="#e0a03c"/></g>
      <g class="t-fase f3 ultima">${barras(244, 88, '#e0a03c')}</g>`)}`,
    forma: tl => `${tl(100, 174, .3)}${celular(214, 10, 124, 156, `
      <g class="t-fase g1">${[28, 62, 96, 130].map((y, i) => `<rect x="224" y="${y}" width="104" height="26" rx="8" fill="#332a1e"/><rect x="230" y="${y + 6}" width="14" height="14" rx="4" fill="${['#5fc98c', '#e0a03c', '#66b4e8', '#d9483b'][i]}"/><rect x="250" y="${y + 9}" width="${[66, 48, 58, 40][i]}" height="8" rx="4" fill="#6d665b"/>`).join('')}</g>
      <g class="t-fase g2 ultima"><rect x="224" y="30" width="104" height="58" rx="14" fill="#e0a03c"/><rect x="224" y="98" width="104" height="58" rx="14" fill="#fff"/>${glifo('p-lugar', 262, 43, 30, '#1c1408')}${glifo('p-qrobus', 262, 111, 30, '#1c1408')}</g>`)}`,
    lector: tl => `${tl(100, 174, .3)}${celular(214, 10, 124, 156, `${[32, 66, 100, 134].map(y => `<rect x="226" y="${y}" width="100" height="18" rx="9" fill="#4a4033"/>`).join('')}<rect class="t-cursor" x="220" y="26" width="112" height="30" rx="12" fill="none" stroke="#e0a03c" stroke-width="4"/>`)}`,
    ubicacion: tl => `<path d="M0 62H360M0 128H360M84 0V176M210 0V176M312 0V176" stroke="#1d4a35" stroke-width="10"/><path d="M0 96H360M150 0V176M262 0V176" stroke="#17392a" stroke-width="5"/>
      <circle class="t-sonar s1" cx="210" cy="94" r="12" fill="#66b4e8"/><circle class="t-sonar s2" cx="210" cy="94" r="12" fill="#66b4e8"/><circle cx="210" cy="94" r="11" fill="#66b4e8" stroke="#fff" stroke-width="3.5"/>
      <g class="t-pin"><path d="M294 96c-13-17-19-26-19-36a19 19 0 1 1 38 0c0 10-6 19-19 36z" fill="#d9483b"/><circle cx="294" cy="60" r="7.5" fill="#fff"/></g>${tl(84, 174, .28)}`,
    movilidad: () => `<rect y="138" width="360" height="38" fill="#08494c"/><rect y="132" width="360" height="9" fill="#d9d2c4"/><path d="M226 141l30-22h104v22z" fill="#d9d2c4"/>
      <rect x="306" y="34" width="8" height="92" rx="4" fill="#fff"/><rect x="282" y="14" width="56" height="42" rx="12" fill="#e0a03c"/>${glifo('p-qrobus', 295, 20, 30, '#1c1408')}
      <g class="t-andar">${glifo('p-caminar', 26, 62, 72, '#fff')}</g><g class="t-rodar">${glifo('p-silla', 26, 62, 72, '#ffd27a')}</g>`,
    oido: tl => `${tl(90, 174, .28)}<g class="t-vibra">${celular(216, 22, 92, 144, `<rect x="232" y="62" width="60" height="60" rx="16" fill="#e0a03c"/><rect x="258" y="74" width="8" height="24" rx="4" fill="#1c1408"/><circle cx="262" cy="108" r="5" fill="#1c1408"/>`)}</g>
      <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"><path class="t-arco a1" d="M322 66a40 40 0 0 1 0 56"/><path class="t-arco a2" d="M338 50a62 62 0 0 1 0 88"/><path class="t-arco a1" d="M202 66a40 40 0 0 0 0 56"/><path class="t-arco a2" d="M186 50a62 62 0 0 0 0 88"/></g>`,
    tarifa: tl => `${tl(92, 174, .28)}<g class="t-tarjeta2"><rect x="176" y="26" width="168" height="124" rx="20" fill="#fff"/><rect x="190" y="40" width="46" height="46" rx="13" fill="#1f6b46"/>${glifo('p-qrobus', 197, 47, 32, '#fff')}<rect x="246" y="46" width="84" height="10" rx="5" fill="#d9d2c4"/><rect x="246" y="66" width="58" height="10" rx="5" fill="#d9d2c4"/>
      <g class="t-fase g1"><text x="260" y="134" text-anchor="middle" font-size="42" fill="#1c1408">$11</text></g><g class="t-fase g2 ultima"><text x="260" y="134" text-anchor="middle" font-size="46" fill="#1f6b46">$2</text></g></g>`,
    gasolina: () => `<rect y="140" width="360" height="36" fill="#17120c"/><path d="M0 158H360" stroke="#e0a03c" stroke-width="4" stroke-dasharray="26 22"/>
      <rect x="248" y="30" width="78" height="110" rx="12" fill="#fff"/><rect x="260" y="42" width="54" height="34" rx="7" fill="#1c1408"/><g class="t-fase g1"><rect x="266" y="84" width="42" height="42" rx="11" fill="#1f8a55"/></g><g class="t-fase g2 ultima"><rect x="266" y="84" width="42" height="42" rx="11" fill="#d9362b"/></g>
      <path d="M248 60h-24a10 10 0 0 0-10 10v30" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path class="t-gota" d="M214 112c-7 9-10 13-10 18a10 10 0 0 0 20 0c0-5-3-9-10-18z" fill="#ffd27a"/>
      <g class="t-carro">${glifo('p-carro', 26, 54, 118, '#fff')}</g>`,
    cuenta: tl => `${celular(20, 26, 76, 124, `<rect x="32" y="44" width="52" height="88" rx="10" fill="#332a1e"/>${glifo('p-llave', 42, 70, 32, '#e0a03c')}`)}${celular(264, 26, 76, 124, `<rect x="276" y="44" width="52" height="88" rx="10" fill="#332a1e"/>${glifo('p-llave', 286, 70, 32, '#e0a03c')}`)}
      <path d="M100 88C130 40 230 40 260 88" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 13"/><circle class="t-viaja" r="10" fill="#fff"/>
      <path d="M152 110a26 26 0 0 1-3-52 34 34 0 0 1 65-6 28 28 0 0 1 2 58z" fill="#fff"/><rect x="168" y="76" width="30" height="24" rx="6" fill="#1c1408"/><path d="M174 76v-7a9 9 0 0 1 18 0v7" fill="none" stroke="#1c1408" stroke-width="5"/>${tl(180, 170, .2)}`,
    nombre: tl => `${tl(120, 174, .34)}<g class="t-tarjeta2"><rect x="206" y="40" width="136" height="96" rx="18" fill="#fff"/><circle cx="240" cy="78" r="17" fill="#e0a03c"/><path d="M216 122a24 24 0 0 1 48 0z" fill="#e0a03c"/><rect x="274" y="66" width="56" height="10" rx="5" fill="#d9d2c4"/><rect x="274" y="88" width="42" height="10" rx="5" fill="#d9d2c4"/></g>`,
  };
  let opciones, paso = 0, regreso = 'inicio';
  function leer() {
    const actual = pasos[paso];
    opciones.decir(`Paso ${paso + 1} de ${pasos.length}. ${actual.titulo}. ${actual.texto} ${actual.detalle}`);
  }
  function entrar() {
    opciones.reiniciar();
    const actual = pasos[paso];
    $('tutorialProgreso').textContent = `Paso ${paso + 1} de ${pasos.length}`;
    $('tutorialTitulo').textContent = actual.titulo;
    // En español los nombres de los botones van resaltados para encontrarlos rápido en la pantalla.
    const texto = $('tutorialTexto');
    texto.textContent = actual.texto;
    if (enIdioma(actual.texto) === actual.texto && actual.botones) texto.innerHTML = actual.botones.reduce((h, b) => h.replace(b, `<b class="tut-boton">${b}</b>`), texto.innerHTML);
    $('tutorialDetalle').textContent = actual.detalle;
    $('tutorialAviso').textContent = actual.aviso ?? '';
    $('tutorialAviso').hidden = !actual.aviso;
    $('tutorialEscena').className = `tutorial-escena esc-${actual.escena}`;
    $('tutorialEscena').innerHTML = `<svg viewBox="0 -20 360 340">${ESCENAS[actual.escena](opciones.tlacuache)}</svg>`;
    for (const bloque of [$('tutorialEscena'), $('tutorialCuerpo')]) { bloque.classList.remove('entra'); void bloque.offsetWidth; bloque.classList.add('entra'); }
    [...$('tutorialPuntos').children].forEach((punto, i) => punto.classList.toggle('hecho', i <= paso));
    $('tutorialContinuar').textContent = paso === pasos.length - 1 ? 'Empezar a usar Grieta' : 'Continuar';
    $('tutorialAnterior').hidden = paso === 0;
    $('tutorialPracticar').hidden = paso !== pasos.length - 1 || !opciones.modoVoz();
    $('tutorialRepetir').hidden = !opciones.modoVoz() || opciones.lector();
    $('hoja').scrollTop = 0;
    $('tutorialTitulo').focus({ preventScroll: true });
    leer();
  }
  function abrir(desde = 'inicio', reemplazar = false) {
    paso = 0; regreso = ['ajustes', 'bienvenida'].includes(desde) ? desde : 'inicio';
    opciones.ir('tutorial', reemplazar);
  }
  function terminar(completado) {
    opciones.guardar({ version: 1, completado });
    if (regreso === 'bienvenida') return opciones.seguirBienvenida();
    opciones.ir(regreso, true);
  }
  function iniciar(config) {
    opciones = config;
    $('abrirTutorial').addEventListener('click', () => abrir('ajustes'));
    $('verTutorial').addEventListener('click', () => abrir('inicio'));
    $('tutorialContinuar').addEventListener('click', () => {
      if (paso === pasos.length - 1) return terminar(true);
      paso++; entrar();
    });
    $('tutorialAnterior').addEventListener('click', () => { paso = Math.max(0, paso - 1); entrar(); });
    $('tutorialOmitir').addEventListener('click', () => terminar(false));
    $('tutorialRepetir').addEventListener('click', leer);
    $('tutorialPracticar').addEventListener('click', () => opciones.practicar('tutorial'));
  }
  return { iniciar, abrir, entrar, escena: nombre => PREGUNTAS[nombre] ? `<svg viewBox="0 0 360 176" preserveAspectRatio="xMidYMid slice">${PREGUNTAS[nombre](opciones.tlacuache)}</svg>` : '' };
})();
