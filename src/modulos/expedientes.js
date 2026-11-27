// ============================================================
//  Módulo EXPEDIENTES — archivos en R2 (reemplaza Drive)
//  Port de Código.gs: subirDocumento, subirContratoFirmado,
//  obtenerFotoExpediente, listarArchivosExpediente, crearExpediente, getDriveUsage
// ============================================================
import { s, ok, error } from "../lib/util.js";
import { requiereSesionValida, registrarEvento } from "../lib/sesion.js";
import { urlFirmada, urlCarpeta, empleadoPorFolder, asegurarPrefijo, limpiarRuta, b64aBytes } from "../lib/archivos.js";

const SESION_INVALIDA = { status: "error", message: "Sesión inválida o expirada." };
const LIMITE_R2 = 10 * 1024 * 1024 * 1024;     // 10 GB del plan gratuito de R2
const PREFIJO_FOTO = "foto_perfil_";

async function guardarArchivo(env, emp, { nombre, mime, bytes, categoria, usuario, reemplazar }) {
  const prefijo = await asegurarPrefijo(env, emp);
  let nombreFinal = limpiarRuta(nombre || "archivo");
  let key = prefijo + nombreFinal;
  if (!reemplazar && await env.R2.head(key)) {                  // no pisar un archivo con el mismo nombre
    const punto = nombreFinal.lastIndexOf(".");
    const base = punto > 0 ? nombreFinal.slice(0, punto) : nombreFinal, ext = punto > 0 ? nombreFinal.slice(punto) : "";
    nombreFinal = `${base} (${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")})${ext}`;
    key = prefijo + nombreFinal;
  }
  await env.R2.put(key, bytes, { httpMetadata: { contentType: mime || "application/octet-stream" } });
  // Confirmar que el archivo quedó guardado antes de registrarlo
  const chk = await env.R2.head(key);
  if (!chk || chk.size !== bytes.length) throw new Error("El archivo no se guardó completo en el almacenamiento. Intenta de nuevo.");
  const r = await env.DB.prepare(
    `INSERT INTO archivos (id_interno, categoria, r2_key, nombre_original, mime, bytes, subido_por, subido_en)
     VALUES (?,?,?,?,?,?,?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(r2_key) DO UPDATE SET bytes = excluded.bytes, mime = excluded.mime, subido_por = excluded.subido_por, subido_en = excluded.subido_en
     RETURNING id`
  ).bind(emp.id_interno, categoria, key, nombreFinal, mime || "", bytes.length, usuario || "").first();
  return { id: r ? r.id : null, key, nombre: nombreFinal };
}

// ── subir_documento (documentos del expediente y foto de perfil) ─
async function subirDocumento(p, env, ctx) {
  const usuario = await requiereSesionValida(env, p);            // GAS no pedía sesión aquí
  if (!usuario) return SESION_INVALIDA;
  const noEmp = s(p.numeroEmpleado), idInterno = s(p.idInterno);
  if (!noEmp && !idInterno) return error("No se proporcionó número de empleado.");
  if (!p.data) return error("No se recibió el archivo.");

  let emp = null;
  if (idInterno) emp = await env.DB.prepare("SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados WHERE id_interno = ?").bind(idInterno).first();
  else emp = await env.DB.prepare("SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados WHERE CAST(no_empleado AS TEXT) = ? ORDER BY (fecha_baja IS NULL) DESC LIMIT 1").bind(noEmp).first();
  if (!emp) return error("No se encontró el empleado (ID:" + idInterno + " / #" + noEmp + ").");

  const nombre = p.nombreArchivo || "foto_perfil.jpg";
  const bytes = b64aBytes(p.data);
  if (bytes.length < 10) return error("Archivo vacío o base64 inválido");
  const esFoto = nombre.toLowerCase().startsWith(PREFIJO_FOTO);
  const a = await guardarArchivo(env, emp, { nombre, mime: p.mimeType || "image/jpeg", bytes, categoria: esFoto ? "foto" : "expediente", usuario: usuario.email });
  await registrarEvento(env, usuario.email, usuario.rol, esFoto ? "SUBIR_FOTO" : "SUBIR_DOCUMENTO", `${emp.id_interno}: ${a.nombre}`, emp.empresa, "");
  return {
    status: "success",
    message: (esFoto ? "Foto" : "Documento") + " subido al expediente #" + (s(emp.no_empleado) || emp.id_interno) + ".",
    fileId: String(a.id), fileUrl: await urlFirmada(env, a.key), folderUrl: urlCarpeta(emp.id_interno, ctx),
  };
}

// ── subir_contrato_firmado ────────────────────────────────────
async function subirContratoFirmado(p, env) {
  const usuario = await requiereSesionValida(env, p);            // GAS no pedía sesión aquí
  if (!usuario) return SESION_INVALIDA;
  const idInterno = s(p.idInterno);
  if (!idInterno) return error("No se proporcionó ID del empleado.");
  if (!p.datos) return error("No se recibió el archivo.");
  const emp = await env.DB.prepare("SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados WHERE id_interno = ?").bind(idInterno).first();
  if (!emp) return error("Empleado no encontrado.");
  const bytes = b64aBytes(p.datos);
  if (bytes.length < 10) return error("Archivo vacío o base64 inválido");
  // Igual que GAS: mismo nombre = se reemplaza el archivo anterior
  const a = await guardarArchivo(env, emp, { nombre: p.nombre || "contrato_firmado.pdf", mime: p.tipo || "application/pdf", bytes, categoria: "contrato_firmado", usuario: usuario.email, reemplazar: true });
  await registrarEvento(env, usuario.email, usuario.rol, "SUBIR_CONTRATO_FIRMADO", `${emp.id_interno}: ${a.nombre}`, emp.empresa, "");
  return ok({ url: await urlFirmada(env, a.key) });
}

// ── obtener_foto ──────────────────────────────────────────────
// Solo archivos subidos con el botón de foto de perfil (prefijo foto_perfil_), igual que GAS
async function obtenerFoto(p, env) {
  if (!(await requiereSesionValida(env, p))) return SESION_INVALIDA;
  const folderId = s(p.folderId);
  if (!folderId) return error("No se proporcionó folderId.");
  const emp = await empleadoPorFolder(env, folderId);
  if (!emp) return error("Este empleado no tiene foto de perfil asignada.");
  const fotos = await env.DB.prepare(
    `SELECT r2_key, nombre_original FROM archivos WHERE id_interno = ? AND LOWER(nombre_original) LIKE '${PREFIJO_FOTO}%'
       AND LOWER(COALESCE(mime,'')) IN ('image/jpeg','image/png','image/jpg') ORDER BY subido_en DESC, id DESC LIMIT 5`
  ).bind(emp.id_interno).all();
  for (const f of fotos.results) {                       // la más reciente que exista de verdad en R2
    if (await env.R2.head(f.r2_key)) return ok({ url: await urlFirmada(env, f.r2_key), nombre: f.nombre_original });
  }
  return error("Este empleado no tiene foto de perfil asignada.");
}

// ── listar_archivos_expediente ────────────────────────────────
async function listarArchivosExpediente(p, env) {
  if (!(await requiereSesionValida(env, p))) return SESION_INVALIDA;
  const folderId = s(p.folderId);
  if (!folderId) return error("No se proporcionó folderId.");
  const emp = await empleadoPorFolder(env, folderId);
  if (!emp) return ok({ archivos: [] });
  const { results: filas } = await env.DB.prepare(
    "SELECT id, r2_key, nombre_original, mime, bytes, subido_en FROM archivos WHERE id_interno = ? ORDER BY subido_en DESC, id DESC"
  ).bind(emp.id_interno).all();

  // Cruce con lo que REALMENTE hay en R2 (una sola consulta por carpeta):
  //  · registro sin archivo (borrado desde el panel de Cloudflare) → no se muestra
  //  · archivo sin registro (subido arrastrándolo al panel de R2) → se muestra y se registra
  let results = filas;
  const c = s(emp.carpeta);
  if (c.startsWith("r2:")) {
    const prefijo = c.slice(3);
    const enR2 = new Map();
    let cursor;
    do {
      const l = await env.R2.list({ prefix: prefijo, cursor, include: ["httpMetadata"] });
      for (const o of l.objects) enR2.set(o.key, o);
      cursor = l.truncated ? l.cursor : undefined;
    } while (cursor);
    results = filas.filter(a => enR2.has(a.r2_key));
    const conocidos = new Set(filas.map(a => a.r2_key));
    const nuevos = [...enR2.values()].filter(o => !conocidos.has(o.key) && !o.key.endsWith("/"));
    for (const o of nuevos) {
      const nombre = o.key.slice(prefijo.length);
      const mime = (o.httpMetadata && o.httpMetadata.contentType) || "";
      const subido = o.uploaded ? new Date(o.uploaded).toISOString() : new Date().toISOString();
      const cat = nombre.toLowerCase().startsWith(PREFIJO_FOTO) ? "foto" : "expediente";
      const ins = await env.DB.prepare(
        "INSERT OR IGNORE INTO archivos (id_interno, categoria, r2_key, nombre_original, mime, bytes, subido_por, subido_en) VALUES (?,?,?,?,?,?,?,?) RETURNING id"
      ).bind(emp.id_interno, cat, o.key, nombre, mime, o.size, "panel R2", subido).first();
      results.push({ id: ins ? ins.id : "", r2_key: o.key, nombre_original: nombre, mime, bytes: o.size, subido_en: subido });
    }
    results.sort((a, b) => String(b.subido_en).localeCompare(String(a.subido_en)));
  }
  const archivos = [];
  for (const a of results) {
    const mime = s(a.mime);
    const ver = await urlFirmada(env, a.r2_key);
    archivos.push({
      id: String(a.id), nombre: s(a.nombre_original), mimeType: mime, tamano: a.bytes || 0, fecha: a.subido_en,
      urlVer: ver,
      thumbnailUrl: mime.startsWith("image/") ? ver : null,          // PDF y otros: ícono
    });
  }
  return ok({ archivos });
}

// ── crear_expediente ──────────────────────────────────────────
async function crearExpediente(p, env, ctx) {
  const usuario = await requiereSesionValida(env, p);
  if (!usuario) return SESION_INVALIDA;
  const idInterno = s(p.idInterno), noEmp = s(p.numeroEmpleado), empresa = s(p.empresa) || "Sin Empresa";
  if (!idInterno && !noEmp) return error("No se proporcionó identificador del empleado.");
  let emp = null;
  if (idInterno) emp = await env.DB.prepare("SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados WHERE id_interno = ?").bind(idInterno).first();
  if (!emp && noEmp) emp = await env.DB.prepare("SELECT id_interno, no_empleado, empresa, nombre, carpeta FROM empleados WHERE CAST(no_empleado AS TEXT) = ? AND TRIM(empresa) = ? ORDER BY (fecha_baja IS NULL) DESC LIMIT 1").bind(noEmp, empresa).first();
  if (!emp) return error("No se encontró el empleado" + (idInterno ? " con ID " + idInterno : " #" + noEmp + " en " + empresa) + ".");
  if (s(emp.carpeta).startsWith("r2:")) return ok({ url: urlCarpeta(emp.id_interno, ctx), message: "El empleado ya tiene expediente." });
  if (s(emp.carpeta).startsWith("http")) return ok({ url: s(emp.carpeta), message: "El empleado ya tiene expediente en Drive." });
  if (!emp.nombre && p.nombreTrabajador) emp.nombre = p.nombreTrabajador;
  await asegurarPrefijo(env, emp);
  await registrarEvento(env, usuario.email, usuario.rol, "CREAR_EXPEDIENTE", emp.id_interno, emp.empresa, "");
  return ok({ url: urlCarpeta(emp.id_interno, ctx), message: "Expediente creado correctamente." });
}

// ── getDriveUsage → uso del almacenamiento de R2 ──────────────
// Misma respuesta que GAS (usedGB, limitGB, pct…) pero con el espacio real de R2.
async function getDriveUsage(p, env) {
  try {
    const r = await env.DB.prepare("SELECT COALESCE(SUM(bytes),0) AS b FROM archivos").first();
    const usedBytes = Number(r.b) || 0, limitBytes = LIMITE_R2, freeBytes = Math.max(0, limitBytes - usedBytes);
    const gb = 1024 * 1024 * 1024;
    return {
      status: "success", usedBytes, limitBytes, freeBytes,
      usedGB: Math.round(usedBytes / gb * 100) / 100, limitGB: Math.round(limitBytes / gb * 100) / 100,
      freeGB: Math.round(freeBytes / gb * 100) / 100, pct: Math.min(100, Math.round(usedBytes / limitBytes * 1000) / 10),
    };
  } catch (e) { return { status: "error", msg: String(e) }; }
}

export default {
  subir_documento: subirDocumento,
  subir_contrato_firmado: subirContratoFirmado,
  obtener_foto: obtenerFoto,
  listar_archivos_expediente: listarArchivosExpediente,
  crear_expediente: crearExpediente,
  getDriveUsage,
};
