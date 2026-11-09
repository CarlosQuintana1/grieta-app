const TutorialGrieta = (() => {
  const $ = id => document.getElementById(id);
  const pasos = [
    { titulo: 'Busca a dónde vas', escena: 'buscar',
      texto: 'En Inicio, toca Busca un lugar o Dictar y elige tu destino.',
      detalle: 'Compara Qrobus, Uber, DiDi e inDrive. Si eliges camión, toca Empezar viaje con avisos para recibir la guía.' },
    { titulo: 'Encuentra camiones cerca', escena: 'camiones', aviso: 'Los horarios son estimados: no vemos los camiones en tiempo real.',
      texto: 'El botón del centro, Camiones cerca, busca paradas desde tu ubicación.',
      detalle: 'Elige una parada para consultar rutas y horarios o Reportar algo en esta parada. Los horarios son estimados; no vemos los camiones en tiempo real.' },
    { titulo: 'Usa la cámara y la voz', escena: 'camara', aviso: 'Puede omitir obstáculos: usa tu bastón o acompañamiento.',
      texto: 'En Inicio o Ajustes, abre Describir con la cámara. En Ajustes, en Pantalla, puedes elegir el modo Voz.',
      detalle: 'La cámara puede describir algunos objetos y leer letreros. Analiza las imágenes en tu teléfono y puede omitir obstáculos; usa tu bastón o acompañamiento.' },
  ];
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
      <g class="t-tarjeta"><rect x="32" y="212" width="296" height="62" rx="18" fill="#fff"/><rect x="44" y="224" width="62" height="38" rx="11" fill="#1f6b46"/><text x="75" y="250" text-anchor="middle" font-size="19" fill="#fff">C60</text><text x="118" y="240" font-size="18" fill="#1c1408">Pasa en 6 min</text><text x="118" y="259" font-size="12" fill="#6d665b">Horario estimado</text></g>
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
        <text x="194" y="261" font-size="16" fill="#1c1408">Aquí pasa la C60</text></g>
    </g>`,
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
    $('tutorialTexto').textContent = actual.texto;
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
    paso = 0; regreso = desde === 'ajustes' ? 'ajustes' : 'inicio';
    opciones.ir('tutorial', reemplazar);
  }
  function terminar(completado) {
    opciones.guardar({ version: 1, completado });
    opciones.ir(regreso, true);
  }
  function iniciar(config) {
    opciones = config;
    $('abrirTutorial').addEventListener('click', () => abrir('ajustes'));
    $('tutorialContinuar').addEventListener('click', () => {
      if (paso === pasos.length - 1) return terminar(true);
      paso++; entrar();
    });
    $('tutorialAnterior').addEventListener('click', () => { paso = Math.max(0, paso - 1); entrar(); });
    $('tutorialOmitir').addEventListener('click', () => terminar(false));
    $('tutorialRepetir').addEventListener('click', leer);
    $('tutorialPracticar').addEventListener('click', () => opciones.practicar('tutorial'));
  }
  return { iniciar, abrir, entrar };
})();
