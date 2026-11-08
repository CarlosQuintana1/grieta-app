import { Respaldo } from "../modelos.js";

// Cifrado y en base64; con el historial completo y la racha no pasa de unos 100 KB.
const MAXIMO = 400_000;
const ID = /^[0-9a-f]{64}$/;

export const respaldos = {
  leer: async (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: "Llave inválida" });
    const r = await Respaldo.findByPk(req.params.id);
    res.set("Cache-Control", "no-store");
    if (!r) return res.status(404).json({ error: "No hay copia con esa llave" });
    res.json({ datos: r.datos, version: r.version });
  },
  // Solo se guarda si nadie lo cambio desde la version que leyo este telefono; si no, 409 y el telefono junta y reintenta.
  guardar: async (req, res) => {
    const { id } = req.params, { datos } = req.body ?? {}, version = Number(req.body?.version ?? 0);
    if (!ID.test(id)) return res.status(400).json({ error: "Llave inválida" });
    if (typeof datos !== "string" || !datos || datos.length > MAXIMO || !/^[A-Za-z0-9+/=]+$/.test(datos)) return res.status(400).json({ error: "Copia inválida" });
    if (!Number.isInteger(version) || version < 0) return res.status(400).json({ error: "Versión inválida" });
    if (version === 0) {
      const [, creada] = await Respaldo.findOrCreate({ where: { id }, defaults: { id, datos, version: 1 } });
      if (!creada) return res.status(409).json({ error: "Ya hay una copia más nueva" });
      return res.status(201).json({ version: 1 });
    }
    const [cambiadas] = await Respaldo.update({ datos, version: version + 1 }, { where: { id, version } });
    if (!cambiadas) return res.status(409).json({ error: "Ya hay una copia más nueva" });
    res.json({ version: version + 1 });
  },
  borrar: async (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: "Llave inválida" });
    res.json({ borrados: await Respaldo.destroy({ where: { id: req.params.id } }) });
  },
};
