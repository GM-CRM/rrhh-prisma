// ============================================================
//  Archivos en R2 — enlaces firmados, ubicación del expediente
//  R2 es privado: los archivos solo se ven con un enlace firmado
//  (HMAC-SHA256) que vence. La clave de firma se genera sola la
//  primera vez y vive en la tabla _config de D1 (no hay que configurar nada).
// ============================================================
import { s } from "./util.js";

const VIGENCIA_SEG = 2 * 3600;   // 2 horas
let _clave = null;               // caché por instancia del Worker

async function claveFirma(env) {
  if (_clave) return _clave;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS _config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)").run();
  let r = await env.DB.prepare("SELECT valor FROM _config WHERE clave = 'firma_archivos'").first();
  if (!r) {
    const nueva = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("INSERT OR IGNORE INTO _config (clave, valor) VALUES ('firma_archivos', ?)").bind(nueva).run();
    r = await env.DB.prepare("SELECT valor FROM _config WHERE clave = 'firma_archivos'").first();
  }
  _clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(r.valor), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return _clave;
}

async function hmac(env, texto) {
  const sig = await crypto.subtle.sign("HMAC", await claveFirma(env), new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function urlFirmada(env, key, descargar) {
  const exp = Math.floor(Date.now() / 1000) + VIGENCIA_SEG;
  const sig = await hmac(env, key + "|" + exp);
  return `/archivo?k=${encodeURIComponent(key)}&e=${exp}&s=${sig}${descargar ? "&d=1" : ""}`;
}

export async function verificarFirma(env, key, exp, sig) {
  if (!key || !exp || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const esperado = await hmac(env, key + "|" + exp);
  if (esperado.length !== sig.length) return false;
  let d = 0;
  for (let i = 0; i < esperado.length; i++) d |= esperado.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

// Nombre seguro para una ruta de R2
export const limpiarRuta = t => s(t).replace(/[\\/:*?"<>|#\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "Sin nombre";

// URL "de carpeta" que entiende el frontend (extrae lo que va después de /folders/)
export const urlCarpeta = idInterno => "/expediente/folders/" + encodeURIComponent(idInterno);

// folderId del frontend → empleado. Acepta el ID INTERNO (expedientes en R2)
// o el ID de una carpeta de Drive (expedientes aún no migrados).
export async function empleadoPorFolder(env, folderId) {
  folderId = s(folderId);
  if (!folderId) return null;
  const SEL = "SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados";
  let e = await env.DB.prepare(SEL + " WHERE id_interno = ? LIMIT 1").bind(folderId).first();
  if (!e && folderId.length >= 10) {
    // Carpeta de Drive: primero la tabla de equivalencias (sigue sirviendo aunque
    // el expediente ya se haya pasado a R2), luego la URL todavía guardada
    await asegurarTablaCarpetas(env);
    e = await env.DB.prepare(SEL + " WHERE id_interno = (SELECT id_interno FROM carpetas_drive WHERE drive_id = ?) LIMIT 1").bind(folderId).first();
    if (!e) e = await env.DB.prepare(SEL + " WHERE carpeta LIKE ? LIMIT 1").bind("%" + folderId + "%").first();
  }
  return e || null;
}

let _tablaCarpetas = false;
async function asegurarTablaCarpetas(env) {
  if (_tablaCarpetas) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS carpetas_drive (drive_id TEXT PRIMARY KEY, id_interno TEXT NOT NULL)").run();
  _tablaCarpetas = true;
}

// Prefijo del expediente en R2; si el empleado no tiene, se crea y se guarda
export async function asegurarPrefijo(env, emp) {
  const c = s(emp.carpeta);
  if (c.startsWith("r2:")) return c.slice(3);
  // Recordar la carpeta de Drive para que su dirección siga llevando a este expediente
  const m = c.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) {
    await asegurarTablaCarpetas(env);
    await env.DB.prepare("INSERT OR IGNORE INTO carpetas_drive (drive_id, id_interno) VALUES (?, ?)").bind(m[1], emp.id_interno).run();
  }
  const prefijo = `expedientes/${limpiarRuta(emp.empresa || "Sin Empresa")}/${limpiarRuta((s(emp.no_empleado) || "SIN-NUM") + " - " + (emp.nombre || "Sin Nombre"))}/`;
  // Si tenía carpeta de Drive se conserva en archivos.drive_id_origen al migrar; aquí pasa a R2
  await env.DB.prepare("UPDATE empleados SET carpeta = ? WHERE id_interno = ?").bind("r2:" + prefijo, emp.id_interno).run();
  emp.carpeta = "r2:" + prefijo;
  return prefijo;
}

export function b64aBytes(b64) {
  let x = String(b64 || "");
  if (x.includes(",")) x = x.split(",")[1];
  x = x.replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(x);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
