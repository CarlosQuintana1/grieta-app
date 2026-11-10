// © 2026 Equipo Grieta. Todos los derechos reservados; prohibido copiarlo o usarlo para entrenar IA.
// Mismos calculos que modelo/tarifa.py, camion.py y decision.py, con los datos de exportar_demo.py.
const Grieta = (() => {
  const CORTES = [0, 6, 9, 12, 15, 18, 21, 24];
  const CAMINAR_MAX_M = 700;
  // Con la distancia real por calles ya medida, se camina hasta 1.3 km (unos 17 minutos)
  const CAMINAR_REAL_MAX_M = 1300;
  // Si no hay opcion de solo camion, se busca otra caminando hasta 1.5 km en linea recta (unos 26 minutos)
  const LEJOS_M = 1500;
  const APP_MAX_KM = 5;
  const VEL_CAMINAR = 4.5;
  // Sin trafico tarda lo que OSRM en las rutas medidas: 3 min mas 0.88 por km. El trafico por franja es un supuesto.
  const LIBRE_BASE = 2.97, LIBRE_KM = 0.876;
  const TRAFICO = { "0-6": 1.1, "6-9": 1.45, "9-12": 1.25, "12-15": 1.3, "15-18": 1.35, "18-21": 1.45, "21-24": 1.15 };
  const RODEO = 1.3;
  const ESPERA_APP = 5;
  const VENTANA_MIN = 60;
  const TRANSBORDO_M = 250;
  const ESPERA_TRANSBORDO = 2;
  const AHORRO_MINIMO = 0.3;
  // Hasta cuatro camiones seguidos, es decir tres transbordos.
  const MAX_CAMIONES = 4;
  // Formas distintas de llegar que se recuerdan por parada y por tipo de acceso.
  const TOPE_ETIQUETAS = 4;
  // Una ruta que tarda mas solo se conserva si ahorra al menos estos minutos a pie.
  const CAMINA_MENOS_MIN = 4;
  // Un camion extra tiene que ahorrar al menos estos minutos de viaje, o estos otros a pie.
  const CAMION_EXTRA_MIN = 8;
  const CAMION_EXTRA_PIE = 12;
  const INF = 1e9;

  let modelo, qrobus, porParada;

  async function cargar(base = "datos") {
    [modelo, qrobus] = await Promise.all(
      ["modelo.json", "qrobus.json"].map((f) => fetch(`${base}/${f}`).then((r) => r.json())),
    );
    // Para cada parada, en que recorridos aparece y en que posicion.
    porParada = qrobus.paradas.map(() => []);
    qrobus.patrones.forEach((p, i) => p.paradas.forEach((s, pos) => porParada[s].push([i, pos])));
    return { modelo, qrobus };
  }

  function franjaDe(hora) {
    for (let i = 1; i < CORTES.length; i++) if (hora < CORTES[i]) return modelo.franjas[i - 1];
    return modelo.franjas.at(-1);
  }

  function metros(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(a));
  }

  function precio(app, km, min, celdaO, celdaD, franja, finde) {
    const a = modelo.apps[app];
    const base = a.formula[0] + a.formula[1] * km + a.formula[2] * min;
    const [dLog, dInv] = a.distancia ?? [0, 0];
    const logF = a.intercepto + a.franjas[franja] + a.finde * finde + dLog * Math.log(Math.max(km, 0.1)) + dInv / Math.max(km, 0.5)
      + (a.origen[celdaO] ?? 0) + (a.destino[celdaD] ?? 0) + (a.pares?.[`${celdaO}|${celdaD}`] ?? 0);
    const estimado = { precio: base * Math.exp(logF), bajo: base * Math.exp(logF + a.rango[0]), alto: base * Math.exp(logF + a.rango[1]) };
    if (Array.isArray(a.rango_habitual) && a.rango_habitual.length === 2 && a.rango_habitual.every(Number.isFinite) && a.rango_habitual[0] <= a.rango_habitual[1]) {
      estimado.habitual = { bajo: base * Math.exp(logF + a.rango_habitual[0]), alto: base * Math.exp(logF + a.rango_habitual[1]) };
    }
    return estimado;
  }

  function contexto(dia, minuto) {
    const hora = minuto / 60;
    return { dia, minuto, franja: franjaDe(hora), finde: dia >= 5 ? 1 : 0, servicio: qrobus.servicio_por_dia[dia], servicioAyer: qrobus.servicio_por_dia[(dia + 6) % 7] };
  }

  function tramoApp(ctx, o, d, kmCalle) {
    const km = kmCalle ?? (metros(o[0], o[1], d[0], d[1]) / 1000) * RODEO;
    const libre = LIBRE_BASE + LIBRE_KM * km;
    const min = libre * (TRAFICO[ctx.franja] ?? 1.3);
    const celdaO = h3.latLngToCell(o[0], o[1], modelo.h3_res);
    const celdaD = h3.latLngToCell(d[0], d[1], modelo.h3_res);
    const porApp = Object.keys(modelo.apps).map((app) => ({ app, ...precio(app, km, libre, celdaO, celdaD, ctx.franja, ctx.finde) }));
    const mejor = porApp.reduce((a, b) => (b.precio < a.precio ? b : a));
    return { km, minutos: ESPERA_APP + min, porApp, mejor };
  }

  // reales: metros caminando por calles hasta algunas paradas; las demas se estiman con la linea recta por el rodeo.
  function alcanzables(ctx, punto, hacia, caminarMax = CAMINAR_MAX_M, reales) {
    const res = new Map();
    qrobus.paradas.forEach(([lat, lon], i) => {
      const m = metros(punto[0], punto[1], lat, lon);
      if (m > APP_MAX_KM * 1000) return;
      const real = reales?.get(i);
      const caminado = real ?? m * RODEO;
      // Con "caminar poco" el limite tambien se cumple por calles; si no, manda la distancia real cuando ya se conoce.
      const camina = caminarMax < CAMINAR_MAX_M
        ? m <= caminarMax && caminado <= caminarMax * RODEO
        : real !== undefined ? real <= CAMINAR_REAL_MAX_M : m <= CAMINAR_MAX_M;
      if (camina) {
        res.set(i, { modo: "caminando", costo: 0, min: caminado / 1000 / VEL_CAMINAR * 60 });
      } else {
        const t = hacia ? tramoApp(ctx, punto, [lat, lon]) : tramoApp(ctx, [lat, lon], punto);
        res.set(i, { modo: "app", costo: t.mejor.precio, min: t.minutos, app: t.mejor.app });
      }
    });
    return res;
  }

  function aPie(punto, reales) {
    const res = new Map();
    qrobus.paradas.forEach(([lat, lon], i) => {
      const m = metros(punto[0], punto[1], lat, lon);
      const caminado = reales?.get(i) ?? m * RODEO;
      if (m <= LEJOS_M && caminado <= LEJOS_M * RODEO) res.set(i, { modo: "caminando", costo: 0, min: caminado / 1000 / VEL_CAMINAR * 60 });
    });
    return res;
  }

  const NOMBRES = {
    "caminando+caminando": "Solo camión",
    "app+caminando": "App hasta la parada + camión",
    "caminando+app": "Camión + app al final",
    "app+app": "App + camión + app",
  };

  function tramo(t, parada, hacia) {
    const nombre = qrobus.paradas[parada][2];
    return t.modo === "caminando"
      ? { tipo: "caminar", min: t.min, parada: nombre, hacia }
      : { tipo: "app", app: t.app, costo: t.costo, min: t.min, parada: nombre, hacia };
  }

  // Paradas a pocos metros de cada parada, para cambiar de camion caminando.
  let vecinas;
  function vecinasDe(i) {
    if (!vecinas) {
      const celda = (lat, lon) => `${Math.round(lat / 0.003)}:${Math.round(lon / 0.003)}`;
      const malla = new Map();
      qrobus.paradas.forEach(([lat, lon], k) => {
        const c = celda(lat, lon);
        if (!malla.has(c)) malla.set(c, []);
        malla.get(c).push(k);
      });
      vecinas = qrobus.paradas.map(([lat, lon]) => {
        const [a, b] = celda(lat, lon).split(":").map(Number);
        const lista = [];
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
          for (const k of malla.get(`${a + x}:${b + y}`) ?? []) {
            const m = metros(lat, lon, qrobus.paradas[k][0], qrobus.paradas[k][1]);
            if (m <= TRANSBORDO_M) lista.push([k, m]);
          }
        }
        return lista;
      });
    }
    return vecinas[i];
  }

  const coords = (i) => qrobus.paradas[i].slice(0, 2);
  const nombreParada = (i) => qrobus.paradas[i][2];

  // Los viajes que cruzan la medianoche vienen en el horario del dia anterior como 24:10, 25:00...
  const MADRUGADA = 120;
  function primeraDesde(salidas, corrimiento, t, ventana) {
    if (!salidas) return undefined;
    let a = 0, b = salidas.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if (salidas[m] + corrimiento < t) a = m + 1;
      else b = m;
    }
    const h = salidas[a] + corrimiento;
    return a < salidas.length && h <= t + ventana ? h : undefined;
  }

  // Primera salida de un recorrido que pasa por la posicion pos despues del minuto t.
  function salidaDesde(p, ctx, pos, t, ventana = VENTANA_MIN) {
    const ayer = ctx.minuto < MADRUGADA ? primeraDesde(p.salidas[ctx.servicioAyer], p.minutos[pos] - 1440, t, ventana) : undefined;
    return ayer ?? primeraDesde(p.salidas[ctx.servicio], p.minutos[pos], t, ventana);
  }

  function tramoCamion(p, pb, pa, sale, servicio) {
    const llega = sale - p.minutos[pb] + p.minutos[pa];
    // La ultima salida del dia de esa linea desde la parada donde se sube.
    const ultima = Math.max(...(p.salidas[servicio] ?? [sale - p.minutos[pb]])) + p.minutos[pb];
    return {
      tipo: "camion", linea: p.linea, hacia: p.hacia, sale, llega, ultima, paradas: pa - pb, baja: nombreParada(p.paradas[pa]), estimado: !!p.estimado,
      recorrido: p.paradas.slice(pb, pa + 1).map((k) => ({ nombre: nombreParada(k), lat: qrobus.paradas[k][0], lon: qrobus.paradas[k][1] })),
    };
  }

  function armar(ctx, o, d, acceso, sb, camiones, salida, sa, tarifa) {
    const pasos = [tramo(acceso, sb, true)];
    camiones.forEach((c, k) => {
      if (k > 0 && c.caminar) pasos.push({ tipo: "caminar", min: c.caminar, parada: c.recorrido[0].nombre, hacia: true, transbordo: true });
      pasos.push(c);
    });
    pasos.push(tramo(salida, sa, false));
    const ultimo = camiones.at(-1);
    return {
      tipo: `${acceso.modo}+${salida.modo}`,
      transbordos: camiones.length - 1,
      costo: acceso.costo + tarifa.pasaje + tarifa.transbordo * (camiones.length - 1) + salida.costo,
      minutos: ultimo.llega + salida.min - ctx.minuto,
      detalle: camiones.map((c) => `línea ${c.linea}: ${c.recorrido[0].nombre} (${hhmm(c.sale)}) a ${c.baja}`).join("; "),
      pasos,
      paradas: { sube: sb, baja: sa },
      recorrido: camiones[0].recorrido,
      trazo: {
        acceso: { modo: acceso.modo, puntos: [o, coords(sb)] },
        camiones: camiones.map((c) => c.recorrido.map((r) => [r.lat, r.lon])),
        salida: { modo: salida.modo, puntos: [coords(sa), d] },
      },
    };
  }

  // Una etiqueta es una forma de llegar a una parada: a que hora, cuanto se camino y cuanto se pago de app.
  const gana = (a, b) => a.s.modo === b.s.modo && a.t <= b.t && a.pie <= b.pie && a.pago <= b.pago;
  const pesoEtiqueta = (e) => e.t + 1.5 * e.pie + e.pago / 5;
  function meter(mapa, parada, e) {
    let bolsa = mapa.get(parada);
    if (!bolsa) mapa.set(parada, (bolsa = []));
    if (bolsa.some((x) => gana(x, e))) return false;
    for (let i = bolsa.length - 1; i >= 0; i--) if (gana(e, bolsa[i])) bolsa.splice(i, 1);
    bolsa.push(e);
    const mismas = bolsa.filter((x) => x.s.modo === e.s.modo);
    if (mismas.length <= TOPE_ETIQUETAS) return true;
    // La que llega primero y la que menos camina nunca se tiran.
    const primera = mismas.reduce((a, b) => (b.t < a.t ? b : a));
    const andarMenos = mismas.reduce((a, b) => (b.pie < a.pie ? b : a));
    const peor = mismas.filter((x) => x !== primera && x !== andarMenos).reduce((a, b) => (pesoEtiqueta(b) > pesoEtiqueta(a) ? b : a));
    bolsa.splice(bolsa.indexOf(peor), 1);
    return peor !== e;
  }

  // Busqueda por rondas: cada ronda agrega un camion y guarda varias formas de llegar a cada parada, no solo la primera.
  function buscarCamiones(ctx, sube, maxCamiones, alLlegar) {
    let listas = new Map();
    const vistas = new Map();
    let hayCerca = false;
    for (const [sb, s] of sube) {
      const e = { t: ctx.minuto + s.min, pie: s.modo === "caminando" ? s.min : 0, pago: s.costo, s, sb, n: 0 };
      meter(vistas, sb, e);
      meter(listas, sb, e);
    }
    for (let n = 1; n <= maxCamiones && listas.size; n++) {
      const llegadas = new Map();
      for (const p of qrobus.patrones) {
        const abordo = [];
        for (let pos = 0; pos < p.paradas.length; pos++) {
          const parada = p.paradas[pos];
          for (const a of abordo) {
            meter(llegadas, parada, { t: a.base + p.minutos[pos], pie: a.e.pie, pago: a.e.pago, s: a.e.s, sb: a.e.sb, n, previo: a.e, p, pb: a.pb, pa: pos, sale: a.sale });
          }
          for (const e of listas.get(parada) ?? []) {
            const sale = salidaDesde(p, ctx, pos, e.t);
            if (sale === undefined) continue;
            if (n === 1 && e.s.modo === "caminando") hayCerca = true;
            const base = sale - p.minutos[pos];
            const mejor = (a, b, c) => a.e.s.modo === c.s.modo && a.base <= b && a.e.pie <= c.pie && a.e.pago <= c.pago;
            if (abordo.some((a) => mejor(a, base, e))) continue;
            for (let i = abordo.length - 1; i >= 0; i--) {
              const a = abordo[i];
              if (a.e.s.modo === e.s.modo && base <= a.base && e.pie <= a.e.pie && e.pago <= a.e.pago) abordo.splice(i, 1);
            }
            abordo.push({ base, sale, pb: pos, e });
          }
        }
      }
      alLlegar(llegadas);
      if (n === maxCamiones) break;
      const siguiente = new Map();
      for (const [x, bolsa] of llegadas) {
        for (const [y, m] of vecinasDe(x)) {
          const caminar = (m * RODEO) / 1000 / VEL_CAMINAR * 60;
          for (const e of bolsa) {
            const listo = { ...e, t: e.t + caminar + ESPERA_TRANSBORDO, pie: e.pie + caminar, caminar };
            if (meter(vistas, y, listo)) meter(siguiente, y, listo);
          }
        }
      }
      listas = siguiente;
    }
    return hayCerca;
  }

  function opciones(ctx, o, d, kmCalle, caminarMax, tarifa = { pasaje: qrobus.pasaje, transbordo: qrobus.pasaje / 2 }, caminatas, maxCamiones = MAX_CAMIONES) {
    const directo = tramoApp(ctx, o, d, kmCalle);
    const filas = [{ opcion: `Solo app (${nombreApp(directo.mejor.app)})`, tipo: "app", costo: directo.mejor.precio, minutos: directo.minutos, detalle: "" }];
    const sube = alcanzables(ctx, o, true, caminarMax, caminatas?.sube);
    const baja = alcanzables(ctx, d, false, caminarMax, caminatas?.baja);
    const candidatos = new Map();
    const CRITERIOS = { rapida: (c) => c.minutos, barata: (c) => c.costo, comoda: (c) => c.minutos + 1.5 * c.pie };

    // Bajarse para tomar otra vez la misma linea nunca se ofrece.
    const repiteLinea = (e) => {
      for (let x = e; x?.previo?.p; x = x.previo) if (x.p.linea === x.previo.p.linea) return true;
      return false;
    };
    const quedarse = (c) => {
      const clave = `${c.e.n}:${c.e.s.modo}+${c.b.modo}`;
      for (const [nombre, valor] of Object.entries(CRITERIOS)) {
        const actual = candidatos.get(`${clave}:${nombre}`);
        const mejora = !actual || valor(c) < valor(actual) || (valor(c) === valor(actual) && (c.minutos < actual.minutos || (c.minutos === actual.minutos && c.pie < actual.pie)));
        if (mejora) candidatos.set(`${clave}:${nombre}`, c);
      }
    };
    const recorrer = (sube, baja, tope = maxCamiones) => buscarCamiones(ctx, sube, tope, (llegadas) => {
      for (const [parada, bolsa] of llegadas) {
        const b = baja.get(parada);
        if (!b) continue;
        for (const e of bolsa) {
          if (repiteLinea(e)) continue;
          quedarse({ e, b, parada, minutos: e.t + b.min - ctx.minuto, costo: e.pago + tarifa.pasaje + tarifa.transbordo * (e.n - 1) + b.costo, pie: e.pie + (b.modo === "caminando" ? b.min : 0) });
        }
      }
    });
    const pasaCerca = recorrer(sube, baja);
    // Tambien se prueba caminando mas lejos: a veces un solo camion a 1 km gana a dos transbordos.
    if (!(caminarMax < CAMINAR_MAX_M)) recorrer(aPie(o, caminatas?.sube), aPie(d, caminatas?.baja), Math.min(2, maxCamiones));

    const armados = new Map();
    for (const c of candidatos.values()) {
      if (armados.has(c)) continue;
      const cadena = [];
      for (let x = c.e; x?.p; x = x.previo) cadena.unshift(x);
      const camiones = cadena.map((x, k) => ({ ...tramoCamion(x.p, x.pb, x.pa, x.sale, ctx.servicio), ...(k ? { caminar: Math.max(1, Math.round(x.previo.caminar)) } : {}) }));
      const fila = armar(ctx, o, d, c.e.s, c.e.sb, camiones, c.b, c.parada, tarifa);
      armados.set(c, { ...fila, opcion: NOMBRES[fila.tipo] + (fila.transbordos ? " con transbordo" : "") });
    }
    filas.push(...armados.values());
    const unicas = [...new Map(filas.map((f) => [`${f.opcion}|${f.detalle}`, { ...f, costo: Math.round(f.costo), minutos: Math.round(f.minutos) }])).values()];
    const andar = (f) => (f.pasos ?? []).reduce((t, x) => t + (x.tipo === "caminar" ? x.min : 0), 0);
    const soloCamion = (f) => f.tipo === "caminando+caminando";
    const pierde = (r, x) => {
      if (x === r || (soloCamion(r) && !soloCamion(x))) return false;
      // Cuesta y tarda mas que otra, salvo que le ahorre una caminata que se note.
      const peor = x.costo <= r.costo && x.minutos <= r.minutos && (x.costo < r.costo || x.minutos < r.minutos);
      if (peor && andar(r) > andar(x) - CAMINA_MENOS_MIN) return true;
      return x.tipo === r.tipo && (r.transbordos ?? 0) > (x.transbordos ?? 0) && x.minutos - r.minutos < CAMION_EXTRA_MIN && andar(x) - andar(r) < CAMION_EXTRA_PIE;
    };
    const vivas = unicas.filter((r) => !unicas.some((x) => pierde(r, x)));
    return { directo, opciones: vivas.sort((a, b) => a.minutos - b.minutos || a.costo - b.costo), pasaCerca };
  }

  const trapecio = (x, a, b, c, d) => {
    if (x <= a || x >= d) return b <= x && x <= c ? 1 : 0;
    if (x < b) return (x - a) / (b - a);
    if (x <= c) return 1;
    return (d - x) / (d - c);
  };
  const triangulo = (x, a, b, c) => trapecio(x, a, b, b, c);

  // Puntos y reglas ajustados con modelo/genetico.py contra casos reales (datos/decision_genetica.json).
  // Las reglas que el genetico apago no estan; si ninguna aplica, se pide la app.
  const CONJUNTOS = {
    precio: {
      barato: (x) => trapecio(x, -INF, -INF, 0.881, 0.9),
      normal: (x) => triangulo(x, 0.8, 0.993, 1.191),
      caro: (x) => triangulo(x, 1.096, 1.3, 1.493),
      "muy caro": (x) => trapecio(x, 1.267, 1.466, INF, INF),
    },
    margen: {
      poco: (x) => trapecio(x, -INF, -INF, 9.73, 20.547),
      algo: (x) => triangulo(x, 19.912, 26.328, 49.339),
      mucho: (x) => trapecio(x, 13.315, 59.733, INF, INF),
    },
    camion: {
      poco: (x) => trapecio(x, -INF, -INF, 18.921, 32.282),
      algo: (x) => triangulo(x, 1.821, 17.874, 49.321),
      mucho: (x) => trapecio(x, 26.801, 43.065, INF, INF),
    },
  };

  const REGLAS = [
    [{ precio: ["normal"], margen: ["poco"] }, "pedir ya"],
    [{ precio: ["caro", "muy caro"], margen: ["poco"], camion: ["algo", "mucho"] }, "pedir ya"],
    [{ precio: ["muy caro"], margen: ["algo", "mucho"], camion: ["algo", "mucho"] }, "esperar"],
    [{ precio: ["caro", "muy caro"], camion: ["poco"] }, "camion"],
    [{ precio: ["muy caro"], margen: ["algo", "mucho"], camion: ["algo"] }, "esperar"],
    [{ precio: ["normal"], margen: ["mucho"], camion: ["poco"] }, "camion"],
  ];

  const FRASES = { precio: "el precio está {}", margen: "te sobra {} tiempo", camion: "el camión tarda {} más" };

  function decidir(precioRel, margen, camion) {
    const entradas = { precio: precioRel, margen, camion };
    const grados = Object.fromEntries(Object.entries(CONJUNTOS).map(([v, cs]) =>
      [v, Object.fromEntries(Object.entries(cs).map(([c, f]) => [c, f(entradas[v])]))]));
    const fuerza = { "pedir ya": 0, esperar: 0, camion: 0 };
    const activas = [];
    for (const [cond, accion] of REGLAS) {
      // Y = minimo; varios conjuntos en una misma variable = O = maximo.
      const w = Math.min(...Object.entries(cond).map(([v, cs]) => Math.max(...cs.map((c) => grados[v][c]))));
      if (w > 0) activas.push({ w, accion, texto: Object.entries(cond).map(([v, cs]) => FRASES[v].replace("{}", cs.join(" o "))).join(" y ") });
      fuerza[accion] = Math.max(fuerza[accion], w);
    }
    const accion = Object.keys(fuerza).reduce((a, b) => (fuerza[b] > fuerza[a] ? b : a));
    return { accion, fuerza, activas: activas.sort((a, b) => b.w - a.w) };
  }

  function evaluar({ origen, destino, dia, minuto, app, precioVisto, margen, kmCalle, caminarMax, tarifa, caminatas, camiones }) {
    const ctx = contexto(dia, minuto);
    const { directo, opciones: lista, pasaCerca } = opciones(ctx, origen, destino, kmCalle, caminarMax, tarifa, caminatas, camiones);
    const res = { ctx, directo, opciones: lista, pasaCerca };

    const inicio = CORTES.find((c) => c > minuto / 60);
    if (inicio < 24 && inicio * 60 - minuto <= 90) {
      const sig = tramoApp(contexto(dia, inicio * 60), origen, destino, kmCalle);
      res.siguiente = { minuto: inicio * 60, porApp: sig.porApp };
    }
    if (app && precioVisto > 0) {
      const esperado = directo.porApp.find((x) => x.app === app);
      const conCamion = lista.filter((f) => !f.opcion.startsWith("Solo app") && f.costo <= precioVisto * (1 - AHORRO_MINIMO));
      const minApp = lista.find((f) => f.opcion.startsWith("Solo app"))?.minutos ?? directo.minutos;
      const extra = conCamion.length ? Math.min(...conCamion.map((f) => f.minutos)) - minApp : INF;
      res.decision = { esperado, relacion: precioVisto / esperado.precio, extra, ...decidir(precioVisto / esperado.precio, margen, extra) };
    }
    return res;
  }

  const limiteParadas = (limite) => Number.isSafeInteger(limite) && limite >= 0 ? Math.min(12, limite) : 3;

  function paradasEnRadio(lat, lon, radio) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !Number.isFinite(radio) || radio < 0) return [];
    return qrobus.paradas
      .map(([la, lo, nombre], i) => ({ i, nombre, lat: la, lon: lo, m: metros(lat, lon, la, lo) }))
      .filter((x) => x.m <= radio)
      .sort((a, b) => a.m - b.m || a.i - b.i);
  }

  // Candidatas físicas del catálogo; m es distancia en línea recta, sin filtrar horarios.
  function paradasCercanas(lat, lon, radio = 350, limite = 3) {
    return paradasEnRadio(lat, lon, radio).slice(0, limiteParadas(limite));
  }

  // vistaCalle: hacia donde mira quien esta en su parada de frente a la calle. Si la brujula marca eso, esta del lado
  // correcto; si marca lo contrario, esta enfrente.
  function ladoPorBrujula(vista, vistaCalle) {
    if (!Number.isFinite(vista) || !Number.isFinite(vistaCalle)) return null;
    const dif = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    if (dif(vista, vistaCalle) <= 60) return "si";
    if (dif(vista, vistaCalle + 180) <= 60) return "enfrente";
    return "dudosa";
  }
  const rumboEntre = (la1, lo1, la2, lo2) => {
    const r = Math.PI / 180, y = Math.sin((lo2 - lo1) * r) * Math.cos(la2 * r);
    const x = Math.cos(la1 * r) * Math.sin(la2 * r) - Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos((lo2 - lo1) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  };
  // ¿Es mi parada? Compara la parada donde se sube con la de enfrente: la parada cercana donde la misma línea va en
  // otro sentido. El GPS del teléfono falla 10 m o más, así que solo afirma cuando la diferencia lo permite.
  function sentidosDeParada(indice) {
    const vistos = new Map();
    for (const [pi, pos] of porParada?.[indice] ?? []) {
      const p = qrobus.patrones[pi];
      if (pos < p.paradas.length - 1) vistos.set(`${p.linea}|${p.hacia}`, { linea: p.linea, hacia: p.hacia });
    }
    return [...vistos.values()];
  }
  // Rumbo en grados (0 = norte) hacia donde avanza la linea al salir de la parada; sirve para la brujula.
  function rumboDeSalida(indice, linea, hacia) {
    for (const [pi, pos] of porParada?.[indice] ?? []) {
      const p = qrobus.patrones[pi];
      if (p.linea !== linea || p.hacia !== hacia || pos >= p.paradas.length - 1) continue;
      const [la1, lo1] = qrobus.paradas[indice], [la2, lo2] = qrobus.paradas[p.paradas[pos + 1]];
      return rumboEntre(la1, lo1, la2, lo2);
    }
    return null;
  }
  function revisarParada({ lat, lon, precision = 15, objetivo }) {
    if (![lat, lon, objetivo?.lat, objetivo?.lon].every(Number.isFinite)) return { estado: "sin_datos" };
    const propia = paradasEnRadio(objetivo.lat, objetivo.lon, 5)[0];
    const enfrente = paradasEnRadio(objetivo.lat, objetivo.lon, 120)
      .filter((x) => x.i !== propia?.i && x.m > 5 && sentidosDeParada(x.i).some((s) => s.linea === objetivo.linea && s.hacia !== objetivo.hacia))[0] ?? null;
    const aMia = metros(lat, lon, objetivo.lat, objetivo.lon);
    const aEnfrente = enfrente ? metros(lat, lon, enfrente.lat, enfrente.lon) : Infinity;
    const opuesta = enfrente ? { nombre: enfrente.nombre, lat: enfrente.lat, lon: enfrente.lon, hacia: sentidosDeParada(enfrente.i).find((s) => s.linea === objetivo.linea)?.hacia ?? null, separacion: Math.round(enfrente.m) } : null;
    // Para decidir, la diferencia de distancias debe superar el error del GPS y una parte de la separacion.
    const margen = enfrente ? Math.max(8, Math.min(precision, enfrente.m * 0.6)) : 0;
    const rumbo = propia ? rumboDeSalida(propia.i, objetivo.linea, objetivo.hacia) : null;
    // La calle queda del lado donde esta la parada de enfrente respecto al sentido del camion. Si no se distingue
    // (paradas alineadas), se usa la circulacion por la derecha: la calle queda a la izquierda del camion.
    let vistaCalle = null;
    if (rumbo !== null) {
      const rel = enfrente ? ((rumboEntre(objetivo.lat, objetivo.lon, enfrente.lat, enfrente.lon) - rumbo) % 360 + 360) % 360 : 270;
      vistaCalle = (rumbo + (rel > 10 && rel < 170 ? 90 : 270)) % 360;
    }
    const base = { metros: Math.round(aMia), precision: Math.round(precision), opuesta, rumbo, vistaCalle, mismoNombre: Boolean(opuesta && opuesta.nombre === objetivo.nombre) };
    if (aMia > 60 && aEnfrente > 60) return { ...base, estado: "lejos" };
    if (enfrente && precision > enfrente.m) return { ...base, estado: "dudosa" };
    if (!enfrente) return { ...base, estado: aMia <= 35 ? "si" : "lejos" };
    if (aMia <= 40 && aEnfrente - aMia >= margen) return { ...base, estado: "si" };
    if (aEnfrente <= 40 && aMia - aEnfrente >= margen) return { ...base, estado: "enfrente" };
    return { ...base, estado: "dudosa" };
  }

  // Paradas oficiales que ningún viaje del horario usa: existen en el catálogo pero no tienen camiones registrados.
  const tieneRecorridos = (indice) => Boolean(porParada?.[indice]?.length);

  function horariosParadaPorIndice(indice, dia, minuto) {
    if (!Number.isSafeInteger(indice) || indice < 0 || indice >= qrobus.paradas.length || !Number.isInteger(dia) || dia < 0 || dia > 6 || !Number.isFinite(minuto)) return [];
    const dias = Math.floor(minuto / 1440);
    const minutoDia = ((minuto % 1440) + 1440) % 1440;
    const diaConsulta = ((dia + dias) % 7 + 7) % 7;
    const servicio = qrobus.servicio_por_dia[diaConsulta];
    const ayer = qrobus.servicio_por_dia[(diaConsulta + 6) % 7];
    const lineas = new Map();
    for (const [pi, pos] of porParada[indice]) {
      const p = qrobus.patrones[pi];
      if (pos === p.paradas.length - 1) continue;
      const desde = (serv, corrimiento) => (p.salidas[serv] ?? []).map((x) => x + p.minutos[pos] - corrimiento);
      const horas = [...(minutoDia < MADRUGADA ? desde(ayer, 1440) : []), ...desde(servicio, 0)]
        .filter((t) => t >= minutoDia).sort((a, b) => a - b).slice(0, 2).map((t) => t + dias * 1440);
      if (!horas.length) continue;
      const clave = `${p.linea}|${p.hacia}`;
      const actual = lineas.get(clave);
      if (!actual || horas[0] < actual.horas[0]) lineas.set(clave, { linea: p.linea, hacia: p.hacia, horas });
    }
    return [...lineas.values()].sort((a, b) => a.horas[0] - b.horas[0]);
  }

  // Dónde debería ir cada camión según su horario; no es su ubicación real.
  function camionesEstimados(dia, minuto) {
    const activos = [];
    qrobus.patrones.forEach((p, pi) => {
      const total = p.minutos.at(-1);
      const probar = (serv, corrimiento) => {
        for (const salida of p.salidas[serv] ?? []) {
          const t = minuto + corrimiento - salida;
          if (t < 0 || t >= total) continue;
          let pos = 0;
          while (pos < p.minutos.length - 2 && p.minutos[pos + 1] <= t) pos++;
          const tramo = p.minutos[pos + 1] - p.minutos[pos], f = tramo > 0 ? Math.min(1, (t - p.minutos[pos]) / tramo) : 0;
          const [la1, lo1] = qrobus.paradas[p.paradas[pos]], [la2, lo2] = qrobus.paradas[p.paradas[pos + 1]];
          activos.push({ id: `${pi}-${serv}-${salida}`, linea: p.linea, hacia: p.hacia, lat: la1 + (la2 - la1) * f, lon: lo1 + (lo2 - lo1) * f });
        }
      };
      probar(qrobus.servicio_por_dia[dia], 0);
      if (minuto < MADRUGADA) probar(qrobus.servicio_por_dia[(dia + 6) % 7], 1440);
    });
    return activos;
  }

  // Paradas con próximas salidas registradas; no garantiza cercanía caminando ni cobertura completa.
  function pasanAqui(lat, lon, dia, minuto, radio = 350, limite = 3) {
    return paradasEnRadio(lat, lon, radio)
      .map((parada) => ({ ...parada, lineas: horariosParadaPorIndice(parada.i, dia, minuto) }))
      .filter((x) => x.lineas.length).slice(0, limiteParadas(limite));
  }

  function horariosParada(lat, lon, dia, minuto) {
    const parada = paradasCercanas(lat, lon, 1, 1)[0];
    const dias = Math.floor(minuto / 1440);
    return parada ? horariosParadaPorIndice(parada.i, dia, minuto).map((linea) => ({ ...linea, horas: linea.horas.map((t) => t - dias * 1440) })) : [];
  }

  // Precio del mismo viaje a otra hora; si pasa de medianoche cuenta como el dia siguiente.
  function cotizar({ origen, destino, dia, minuto, kmCalle }) {
    const d = (dia + Math.floor(minuto / 1440)) % 7;
    const t = tramoApp(contexto(d, minuto % 1440), origen, destino, kmCalle);
    return { minuto, porApp: t.porApp, mejor: t.mejor };
  }

  function hhmm(min) {
    const m = Math.round(min) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  const nombreApp = (a) => ({ uber: "Uber", didi: "DiDi", indrive: "inDrive" })[a];

  return { camionesEstimados, cargar, cotizar, evaluar, decidir, pasanAqui, revisarParada, sentidosDeParada, ladoPorBrujula, paradasCercanas, tieneRecorridos, horariosParada, horariosParadaPorIndice, hhmm, metros, CORTES, nombreApp, get modelo() { return modelo; }, get qrobus() { return qrobus; } };
})();
