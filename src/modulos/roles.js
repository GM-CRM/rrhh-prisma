// ============================================================
//  Módulo ROLES — roles con permisos por módulo y fotos de usuario
//  listar_roles, guardar_rol, eliminar_rol, subir_foto_usuario
//  (el router ya validó "usuarios.administrar" para las tres primeras)
// ============================================================
import { s, ok, error, ahoraISO, listaEmpresas } from "../lib/util.js";
import { buscarUsuarioPorToken, registrarEvento } from "../lib/sesion.js";
import { CATALOGO_PERMISOS, normalizarPermisos, permisosCompletos, permisosDeRol, tienePermiso } from "../lib/permisos.js";
import { urlFirmada, b64aBytes } from "../lib/archivos.js";

const COLORES = ["#5B7CFF", "#A35BFF", "#2FE0C8", "#FF6BA6", "#FFAA3C", "#8C93B8"];

// URL que el navegador puede mostrar para la foto guardada del usuario
export async function urlFotoUsuario(env, valor) {
  const v = s(valor);
  if (v.startsWith("r2:")) return urlFirmada(env, v.slice(3));
  return v;
}

// ── listar_roles: roles, cuántos usuarios tiene cada uno y catálogos ──
async function listarRoles(p, env) {
  const { results: roles } = await env.DB.prepare("SELECT * FROM roles ORDER BY es_sistema DESC, nombre").all();
  const { results: cuenta } = await env.DB.prepare("SELECT rol, COUNT(*) AS n FROM usuarios GROUP BY rol").all();
  const n = {}; cuenta.forEach(c => { n[s(c.rol).toLowerCase()] = c.n; });
  const { results: emps } = await env.DB.prepare("SELECT empresa, grupo_comercial FROM empresas ORDER BY grupo_comercial, empresa").all();
  const grupos = {};
  emps.forEach(e => { const g = s(e.grupo_comercial) || "Sin grupo"; (grupos[g] = grupos[g] || []).push(s(e.empresa)); });
  return ok({
    roles: roles.map(r => ({
      id: r.id_rol, nombre: r.nombre, descripcion: s(r.descripcion), color: s(r.color) || COLORES[0],
      esSistema: !!r.es_sistema, usuarios: n[s(r.nombre).toLowerCase()] || 0,
      permisos: r.nombre === "Administrador" ? permisosCompletos() : normalizarPermisos(JSON.parse(r.permisos_json || "{}")),
    })),
    catalogo: CATALOGO_PERMISOS,
    grupos: Object.keys(grupos).map(g => ({ grupo: g, empresas: grupos[g] })),
  });
}

// ── guardar_rol: crear o editar ──────────────────────────────
async function guardarRol(p, env) {
  const admin = await buscarUsuarioPorToken(env, p.token);
  const nombre = s(p.nombre).replace(/\s+/g, " ");
  if (!nombre) return error("Escribe el nombre del rol.");
  if (nombre.length > 40) return error("El nombre del rol puede tener máximo 40 caracteres.");
  const permisos = normalizarPermisos(p.permisos || {});
  const descripcion = s(p.descripcion).slice(0, 200);
  const color = /^#[0-9a-fA-F]{6}$/.test(s(p.color)) ? s(p.color) : COLORES[0];

  // Comparación sin distinguir mayúsculas NI acentos en mayúscula ("ÁREA" = "área")
  const { results: todos } = await env.DB.prepare("SELECT id_rol, nombre FROM roles").all();
  const clave = x => s(x).toLocaleLowerCase("es-MX");
  const dup = todos.find(r => clave(r.nombre) === clave(nombre)) || null;
  if (p.id) {
    const actual = await env.DB.prepare("SELECT * FROM roles WHERE id_rol = ?").bind(s(p.id)).first();
    if (!actual) return error("Ese rol ya no existe.");
    if (dup && dup.id_rol !== actual.id_rol) return error("Ya existe otro rol con ese nombre.");
    if (actual.es_sistema && clave(nombre) !== clave(actual.nombre)) return error("Los roles del sistema no se pueden renombrar.");
    if (actual.nombre === "Administrador") {
      // El Administrador siempre tiene todo: solo se guarda la descripción y el color
      await env.DB.prepare("UPDATE roles SET descripcion = ?, color = ? WHERE id_rol = ?").bind(descripcion, color, actual.id_rol).run();
      return ok({ message: "Rol actualizado. El Administrador conserva todos los permisos." });
    }
    // Nadie puede quitarse a sí mismo la administración de usuarios por accidente
    if (s(admin.rol).toLowerCase() === s(actual.nombre).toLowerCase() && !tienePermiso(permisos, "usuarios.administrar"))
      return error("No puedes quitar \"Usuarios y roles\" a tu propio rol: te quedarías sin acceso a esta pantalla.");
    await env.DB.prepare("UPDATE roles SET nombre = ?, descripcion = ?, color = ?, permisos_json = ? WHERE id_rol = ?")
      .bind(nombre, descripcion, color, JSON.stringify(permisos), actual.id_rol).run();
    if (nombre !== actual.nombre)
      await env.DB.prepare("UPDATE usuarios SET rol = ? WHERE rol = ? COLLATE NOCASE").bind(nombre, actual.nombre).run();
    await registrarEvento(env, admin.email, admin.rol, "EDITAR_ROL", "Editó el rol " + nombre + ": " + JSON.stringify(permisos), "", "");
    return ok({ message: "Rol \"" + nombre + "\" guardado.", id: actual.id_rol });
  }
  if (dup) return error("Ya existe un rol con ese nombre.");
  const r = await env.DB.prepare("SELECT MAX(CAST(substr(id_rol, 4) AS INTEGER)) AS n FROM roles WHERE id_rol LIKE 'ROL%'").first();
  const id = "ROL" + String((r && r.n ? r.n : 0) + 1).padStart(3, "0");
  await env.DB.prepare(
    "INSERT INTO roles (id_rol, nombre, descripcion, permisos_json, es_sistema, color, fecha_creacion, creado_por) VALUES (?,?,?,?,0,?,?,?)"
  ).bind(id, nombre, descripcion, JSON.stringify(permisos), color, ahoraISO(), admin.email).run();
  await registrarEvento(env, admin.email, admin.rol, "CREAR_ROL", "Creó el rol " + nombre + ": " + JSON.stringify(permisos), "", "");
  return ok({ message: "Rol \"" + nombre + "\" creado.", id });
}

// ── eliminar_rol: si tiene usuarios, se pasan a otro rol ──────
async function eliminarRol(p, env) {
  const admin = await buscarUsuarioPorToken(env, p.token);
  const rol = await env.DB.prepare("SELECT * FROM roles WHERE id_rol = ?").bind(s(p.id)).first();
  if (!rol) return error("Ese rol ya no existe.");
  if (rol.es_sistema) return error("Los roles del sistema no se pueden borrar.");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = ? COLLATE NOCASE").bind(rol.nombre).first();
  if (n) {
    const destino = await env.DB.prepare("SELECT nombre FROM roles WHERE id_rol = ?").bind(s(p.reasignarA)).first();
    if (!destino || destino.nombre === rol.nombre) return error("Este rol tiene " + n + " usuario(s). Elige a qué rol pasarlos.");
    await env.DB.prepare("UPDATE usuarios SET rol = ? WHERE rol = ? COLLATE NOCASE").bind(destino.nombre, rol.nombre).run();
  }
  await env.DB.prepare("DELETE FROM roles WHERE id_rol = ?").bind(rol.id_rol).run();
  await registrarEvento(env, admin.email, admin.rol, "ELIMINAR_ROL", "Borró el rol " + rol.nombre + (n ? " (" + n + " usuario(s) reasignados)" : ""), "", "");
  return ok({ message: "Rol \"" + rol.nombre + "\" eliminado." });
}

// ── subir_foto_usuario: la propia, o la de otro si administra usuarios ──
const TIPOS_FOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
async function subirFotoUsuario(p, env) {
  const caller = await buscarUsuarioPorToken(env, p.token);
  if (!caller) return error("Sesión inválida o expirada.");
  const email = s(p.email || caller.email).toLowerCase();
  if (email !== s(caller.email).toLowerCase() && !tienePermiso(await permisosDeRol(env, caller.rol), "usuarios.administrar"))
    return error("Solo puedes cambiar tu propia foto.");
  const target = await env.DB.prepare("SELECT id_usuario, url_foto FROM usuarios WHERE email = ? COLLATE NOCASE").bind(email).first();
  if (!target) return error("Usuario no encontrado.");
  const ext = TIPOS_FOTO[s(p.mimeType).toLowerCase()];
  if (!ext) return error("La foto debe ser JPG, PNG o WEBP.");
  const bytes = b64aBytes(p.data);
  if (!bytes.length) return error("No llegó la imagen.");
  if (bytes.length > 3 * 1024 * 1024) return error("La foto pesa más de 3 MB. Usa una más ligera.");
  const key = "usuarios/" + target.id_usuario + "/foto-" + Date.now() + "." + ext;
  await env.R2.put(key, bytes, { httpMetadata: { contentType: s(p.mimeType).toLowerCase() } });
  const anterior = s(target.url_foto);
  await env.DB.prepare("UPDATE usuarios SET url_foto = ? WHERE id_usuario = ?").bind("r2:" + key, target.id_usuario).run();
  if (anterior.startsWith("r2:usuarios/")) { try { await env.R2.delete(anterior.slice(3)); } catch (_) {} }
  await registrarEvento(env, caller.email, caller.rol, "FOTO_USUARIO", "Cambió la foto de " + email, "", "");
  return ok({ message: "Foto actualizada.", urlFoto: await urlFirmada(env, key) });
}

export default {
  listar_roles: listarRoles,
  guardar_rol: guardarRol,
  eliminar_rol: eliminarRol,
  subir_foto_usuario: subirFotoUsuario,
};
