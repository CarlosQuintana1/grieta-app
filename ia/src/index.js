// Describe una foto de la camara de Grieta. Llega con las caras pixeladas y no se guarda en ningun lado.
const ORIGENES = ["https://grieta-web-qro.azurewebsites.net", "https://grietawebqro.z14.web.core.windows.net", "https://grieta-demo.pages.dev"];
const MAX_BYTES = 700_000;
const ESPERA_MS = 8000;

const REGLAS = `Ayudas a una persona ciega o con baja visión a moverse en Querétaro, México. Ves lo que apunta la cámara de su teléfono.
Contesta en español de México, en máximo tres frases cortas, sin listas ni formato.
Primero lo que puede estorbar o hacerla tropezar (escalones, hoyos, postes, topes, autos, bicicletas), luego dónde están las cosas (izquierda, derecha, enfrente, cerca o lejos).
Lee letreros, números de camión o nombres de tiendas solo si se leen con claridad. Si algo no se ve bien, dilo; nunca inventes.
Usa palabras de México: banqueta, bote de basura, camión, tope.
Las caras aparecen pixeladas a propósito: no las menciones.`;

function cabeceras(origen) {
  const permitido = ORIGENES.includes(origen) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen ?? "");
  return { "Access-Control-Allow-Origin": permitido ? origen : ORIGENES[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" };
}
const error = (texto, status, h) => Response.json({ error: texto }, { status, headers: h });

export class Tope {
  constructor(estado) { this.estado = estado; }
  // Cuenta por dia; asi la cuota gratis de Workers AI no se pasa.
  async fetch(req) {
    const { maximo } = await req.json();
    const dia = new Date().toISOString().slice(0, 10);
    const usado = (await this.estado.storage.get(dia)) ?? 0;
    if (usado >= maximo) return Response.json({ ok: false });
    await this.estado.storage.put(dia, usado + 1);
    return Response.json({ ok: true });
  }
}

export default {
  async fetch(req, env) {
    const h = cabeceras(req.headers.get("Origin"));
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    if (new URL(req.url).pathname !== "/describir" || req.method !== "POST") return error("no existe", 404, h);

    const ip = req.headers.get("CF-Connecting-IP") ?? "local";
    if (env.POR_IP && !(await env.POR_IP.limit({ key: ip })).success) return error("Espera un momento antes de preguntar otra vez.", 429, h);

    const cuerpo = await req.text();
    if (cuerpo.length > MAX_BYTES * 1.4) return error("La foto es muy grande.", 413, h);
    let datos;
    try { datos = JSON.parse(cuerpo); } catch { return error("Petición inválida.", 400, h); }
    const { imagen, pregunta, historial } = datos;
    if (typeof imagen !== "string" || !imagen.startsWith("data:image/jpeg;base64,")) return error("Falta la foto.", 400, h);
    const texto = typeof pregunta === "string" && pregunta.trim() ? pregunta.trim().slice(0, 200) : "¿Qué tengo enfrente?";
    // Las ultimas preguntas, solo texto, para entender "¿y a la derecha?".
    const antes = (Array.isArray(historial) ? historial : []).slice(-3)
      .filter((x) => typeof x?.pregunta === "string" && typeof x?.respuesta === "string")
      .flatMap((x) => [{ role: "user", content: x.pregunta.slice(0, 200) }, { role: "assistant", content: x.respuesta.slice(0, 400) }]);

    const tope = env.TOPE.get(env.TOPE.idFromName("diario"));
    const cupo = await (await tope.fetch("https://tope/", { method: "POST", body: JSON.stringify({ maximo: Number(env.TOPE_DIARIO) }) })).json();
    if (!cupo.ok) return error("Por hoy se acabaron las descripciones. Los avisos de escalones y hoyos siguen funcionando.", 429, h);

    try {
      const consulta = env.AI.run(env.MODELO, {
        messages: [{ role: "system", content: REGLAS }, ...antes,
          { role: "user", content: [{ type: "text", text: texto }, { type: "image_url", image_url: { url: imagen } }] }],
        max_tokens: 220, temperature: 0.2, chat_template_kwargs: { enable_thinking: false },
      });
      const r = await Promise.race([consulta, new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), ESPERA_MS))]);
      const respuesta = (r?.choices?.[0]?.message?.content ?? r?.response ?? "").trim();
      if (!respuesta) throw new Error("vacia");
      return Response.json({ texto: respuesta }, { headers: h });
    } catch (e) {
      console.error("modelo", e?.message ?? e);
      return e?.message === "tiempo"
        ? error("La descripción está tardando. Los avisos de la cámara siguen funcionando; intenta otra vez.", 504, h)
        : error("No pude describir la foto. Intenta otra vez.", 502, h);
    }
  },
};
