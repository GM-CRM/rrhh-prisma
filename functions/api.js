// ============================================================
//  Cloudflare Pages Function → /api
//  POST /api  body: {"action": "...", "payload": {...}}   (igual que GAS)
//  GET  /api  → estado de la migración (sin datos sensibles)
// ============================================================
import { despachar, estadoMigracion } from "../src/router.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    // El frontend manda JSON como texto plano (igual que con GAS)
    body = JSON.parse(await request.text());
  } catch (e) {
    return json({ status: "error", message: "Solicitud inválida: el cuerpo no es JSON." });
  }
  try {
    const r = await despachar(body, env, context);
    // Respuestas grandes ya serializadas por la base (exportar_datos): se envían tal cual
    if (r && typeof r.__rawJson === "string") {
      return new Response(r.__rawJson, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }
    return json(r);
  } catch (err) {
    console.log("[API] " + (body && body.action) + " → " + (err && err.stack || err));
    return json({ status: "error", message: String(err && err.message || err) });
  }
}

export async function onRequestGet({ env }) {
  return json({ ok: true, entorno: env.ENTORNO || "desconocido", ...estadoMigracion() });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
