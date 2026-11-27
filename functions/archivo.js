// ============================================================
//  GET /archivo?k=<key R2>&e=<vence>&s=<firma>[&d=1]
//  Entrega un archivo privado de R2 solo con enlace firmado vigente.
//  El archivo se transmite directo desde R2 (casi sin CPU del Worker).
// ============================================================
import { verificarFirma } from "../src/lib/archivos.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const key = u.searchParams.get("k") || "";
  if (!(await verificarFirma(env, key, u.searchParams.get("e"), u.searchParams.get("s")))) {
    return new Response("Enlace vencido o inválido. Vuelve a abrir el archivo desde RRHH Prisma.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const obj = await env.R2.get(key);
  if (!obj) return new Response("Archivo no encontrado.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const nombre = key.split("/").pop();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  if (!h.get("Content-Type")) h.set("Content-Type", "application/octet-stream");
  h.set("Content-Disposition", (u.searchParams.get("d") ? "attachment" : "inline") + "; filename*=UTF-8''" + encodeURIComponent(nombre));
  h.set("Cache-Control", "private, max-age=3600");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Content-Security-Policy", "sandbox");          // un archivo subido nunca ejecuta código en el sitio
  h.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers: h });
}
