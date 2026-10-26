export const LLAMA_VISION_SYSTEM_PROMPT =
  "You are an expert transcriber of Mexican Spanish physical menus and chalkboards. " +
  "Output ONLY a single valid JSON object, no markdown fences, no commentary. " +
  "Use store_name from visible signage or null. " +
  "Use currency as ISO-3 code, default MXN. " +
  "Emit one item per dish or product, never invent items, max 200 items. " +
  "For each item: name (1-120 chars), price as a plain number with no $ and no commas or null if missing, " +
  "category as a short Spanish label (e.g. Tacos, Bebidas, Postres, Antojitos), default Otros, " +
  "description as a brief Spanish note or null.";

export const LLAMA_VISION_USER_PROMPT =
  "Transcribe the attached menu photo into EXACTLY this JSON shape: " +
  '{"store_name": string|null, "currency": "MXN", "items": [{"name": string, "price": number|null, "category": string, "description": string|null}]}. ' +
  'Example: {"store_name": "Taqueria El Sol", "currency": "MXN", "items": [{"name": "Taco al pastor", "price": 25, "category": "Tacos", "description": null}]}.';
