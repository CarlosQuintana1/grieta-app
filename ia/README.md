# grieta-ia

Worker de Cloudflare que describe la foto de la cámara de Grieta con Workers AI (Qwen). La foto llega con las caras pixeladas desde el teléfono y no se guarda.

- `POST /describir` con `{ imagen, pregunta?, historial? }`, responde `{ texto }`.
- Tope diario en `TOPE_DIARIO` y 8 preguntas por minuto por IP.
- El modelo se cambia en `MODELO` dentro de `wrangler.jsonc`.

Publicar: `npx wrangler deploy`
