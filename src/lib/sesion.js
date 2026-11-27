// ============================================================
//  Sesiones y auditoría — equivalentes de buscarUsuarioPorToken,
//  autenticarRequest, requiereSesionValida y registrarEvento (GAS)
// ============================================================
import { s, ahoraISO, listaEmpresas } from "./util.js";

// Fila de usuarios con sesión vigente y estatus Activo, o null
export async function buscarUsuarioPorToken(env, token) {
  token = s(token);
  if (!token) return null;
  const u = await env.DB.prepare(
    "SELECT * FROM usuarios WHERE token_sesion = ? AND estatus = 'Activo' LIMIT 1"
  ).bind(token).first();
  if (!u) return null;
  const exp = Date.parse(u.expira_token || "");
  if (!exp || exp <= Date.now()) return null;
  return u;
}

export async function buscarUsuario(env, email) {
  return env.DB.prepare("SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE LIMIT 1")
    .bind(s(email).toLowerCase()).first();
}

// Igual que autenticarRequest() de GAS
export async function autenticarRequest(env, payload) {
  const u = await buscarUsuarioPorToken(env, payload && payload.token);
  if (!u) return null;
  return {
    datos: u,
    email: u.email,
    rol: u.rol,
    empresas: listaEmpresas(u.empresas_asignadas),
    esAdmin: u.rol === "Administrador",
  };
}

// Igual que requiereSesionValida() de GAS: usuario o null
export async function requiereSesionValida(env, payload) {
  return buscarUsuarioPorToken(env, payload && payload.token);
}

// Objeto "usuario" que GAS devuelve en login / validar_token
export function usuarioPublico(u) {
  return {
    id: u.id_usuario,
    nombre: u.nombre_completo,
    email: u.email,
    rol: u.rol,
    empresas: listaEmpresas(u.empresas_asignadas),
    estatus: u.estatus,
    telefono: u.telefono || "",
    urlFoto: u.url_foto || "",
    idInterno: s(u.id_interno),
  };
}

// registrarEvento(email, rol, accion, detalle, empresa, dispositivo) — nunca rompe la petición
export async function registrarEvento(env, email, rol, accion, detalle, empresa, dispositivo) {
  try {
    await env.DB.prepare(
      "INSERT INTO eventos (fecha_hora, usuario, rol, accion, detalle, empresa, ip_device) VALUES (?,?,?,?,?,?,?)"
    ).bind(ahoraISO(), email || "", rol || "", accion || "", detalle || "", empresa || "", dispositivo || "").run();
  } catch (e) {
    console.log("[Evento] Error registrando: " + e);
  }
}
