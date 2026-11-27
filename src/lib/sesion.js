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

// Quién hace la petición, venga del panel (usuarios) o del portal del empleado
// (empleados_acceso). Sirve para no confiar en IDs que manda el navegador.
//   panel    → { origen:"panel", idInterno, email, rol, empresas, esAdmin, datos }
//   empleado → { origen:"empleado", idInterno, email, rol:"Empleado", empresas:[], esAdmin:false }
export async function identidadPorToken(env, token) {
  token = s(token);
  if (!token) return null;
  const u = await buscarUsuarioPorToken(env, token);
  if (u) return {
    origen: "panel", idInterno: s(u.id_interno), email: u.email, rol: u.rol,
    empresas: listaEmpresas(u.empresas_asignadas).filter(Boolean), esAdmin: u.rol === "Administrador", datos: u,
  };
  const e = await env.DB.prepare(
    "SELECT id_interno, correo, expira_token FROM empleados_acceso WHERE token_sesion = ? AND estatus = 'Activo' LIMIT 1"
  ).bind(token).first();
  if (!e) return null;
  const exp = Date.parse(e.expira_token || "");
  if (!exp || exp <= Date.now()) return null;
  return { origen: "empleado", idInterno: s(e.id_interno), email: s(e.correo), rol: "Empleado", empresas: [], esAdmin: false };
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
