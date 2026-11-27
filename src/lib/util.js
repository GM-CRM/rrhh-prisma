// ============================================================
//  Utilidades compartidas — RRHH Prisma (Cloudflare)
// ============================================================

// SHA-256 hex — IDÉNTICO a hashPassword() de GAS (Utilities.computeDigest UTF-8).
// Por eso las contraseñas existentes siguen funcionando sin reset.
export async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Aleatorio criptográficamente seguro (GAS usaba Math.random)
function aleatorio(chars, n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (let i = 0; i < n; i++) s += chars.charAt(bytes[i] % chars.length);
  return s;
}

export function generarToken() {
  return aleatorio("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 64);
}

export function generarPasswordTemporal() {
  return aleatorio("ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#", 10);
}

export const ahoraISO = () => new Date().toISOString();

export const s = v => (v === null || v === undefined) ? "" : String(v).trim();

export function listaEmpresas(v) {
  return v ? String(v).split(",").map(e => e.trim()) : [];
}

export function normalizar(txt) {
  return String(txt || "").toLowerCase()
    .replace(/[áäà]/g, "a").replace(/[éëè]/g, "e")
    .replace(/[íïì]/g, "i").replace(/[óöò]/g, "o")
    .replace(/[úüù]/g, "u").replace(/ñ/g, "n")
    .replace(/\s+/g, " ").trim();
}

export const ok = (extra = {}) => ({ status: "success", ...extra });
export const error = message => ({ status: "error", message });
