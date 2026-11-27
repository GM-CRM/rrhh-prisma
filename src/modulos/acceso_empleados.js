// ============================================================
//  Módulo ACCESO DE EMPLEADOS (portal empleado.html)
//  Port 1:1 de Código.gs: loginEmpleado, validarTokenEmpleado,
//  _activarAccesoInterno, activarAccesoEmpleado, reenviarAccesoEmpleado,
//  buscarUsuarioPorNombre
// ============================================================
import { hashPassword, generarToken, ahoraISO, s, normalizar, ok, error } from "../lib/util.js";
import { autenticarRequest, registrarEvento } from "../lib/sesion.js";
import { enviarEnSegundoPlano } from "../lib/correo.js";
import { getPlantillaAccesoEmpleado } from "../lib/plantillas_correo.js";

const SESSION_HORAS = 12;

async function datosEmpleado(env, idInterno) {
  const e = await env.DB.prepare(
    "SELECT nombre, departamento, empresa, jefe_directo FROM empleados WHERE id_interno = ? LIMIT 1"
  ).bind(idInterno).first();
  if (!e) return { idInterno };
  return {
    idInterno,
    nombre: s(e.nombre),
    // Paridad con GAS: leía la columna G (DEPARTAMENTO) y la devolvía como "puesto"
    puesto: s(e.departamento),
    empresa: s(e.empresa),
    jefe: s(e.jefe_directo),
  };
}

// ── login_empleado ────────────────────────────────────────────
async function loginEmpleado(p, env) {
  const correo = s(p.correo).toLowerCase(), password = s(p.password);
  if (!correo || !password) return error("Correo y contraseña requeridos.");
  const reg = await env.DB.prepare("SELECT * FROM empleados_acceso WHERE correo = ? COLLATE NOCASE LIMIT 1").bind(correo).first();
  if (!reg) return error("Correo no registrado.");
  if (s(reg.estatus) !== "Activo") return error("Acceso inactivo.");
  if ((await hashPassword(password)) !== s(reg.hash_password)) return error("Contraseña incorrecta.");

  const token = generarToken();
  const expira = new Date(Date.now() + SESSION_HORAS * 3600 * 1000).toISOString();
  await env.DB.prepare("UPDATE empleados_acceso SET token_sesion = ?, expira_token = ?, ultimo_acceso = ? WHERE id_interno = ?")
    .bind(token, expira, ahoraISO(), reg.id_interno).run();
  return ok({ token, empleado: await datosEmpleado(env, s(reg.id_interno)) });
}

// ── validar_token_emp ─────────────────────────────────────────
async function validarTokenEmp(p, env) {
  const token = s(p.token);
  if (!token) return error("Token requerido.");
  const reg = await env.DB.prepare(
    "SELECT * FROM empleados_acceso WHERE token_sesion = ? AND estatus = 'Activo' LIMIT 1"
  ).bind(token).first();
  if (!reg) return error("Token inválido o expirado.");
  if (Date.parse(reg.expira_token || "") < Date.now() || !reg.expira_token) return error("Sesión expirada.");
  return ok({ empleado: await datosEmpleado(env, s(reg.id_interno)) });
}

// ── _activarAccesoInterno ─────────────────────────────────────
export async function activarAccesoInterno(env, ctx, idInterno, correo, password) {
  idInterno = s(idInterno);
  correo = s(correo).toLowerCase();
  password = s(password) || "Prisma2025*";
  if (!idInterno || !correo) return error("ID y correo requeridos.");

  const existe = await env.DB.prepare("SELECT id_interno FROM empleados_acceso WHERE id_interno = ?").bind(idInterno).first();
  const hash = await hashPassword(password);
  if (existe) {
    await env.DB.prepare("UPDATE empleados_acceso SET correo = ?, hash_password = ?, estatus = 'Activo' WHERE id_interno = ?")
      .bind(correo, hash, idInterno).run();
  } else {
    await env.DB.prepare("INSERT INTO empleados_acceso (id_interno, correo, hash_password, estatus) VALUES (?,?,?,'Activo')")
      .bind(idInterno, correo, hash).run();
  }
  const emp = await env.DB.prepare("SELECT nombre FROM empleados WHERE id_interno = ?").bind(idInterno).first();
  enviarEnSegundoPlano(ctx, env, {
    to: correo,
    subject: "Acceso al Portal de Empleados — RRHH Prisma",
    html: getPlantillaAccesoEmpleado(emp ? s(emp.nombre) : "Colaborador", correo, password),
    nombreRemitente: "RRHH Prisma",
  });
  return ok({ message: (existe ? "Acceso actualizado. Email enviado a " : "Acceso activado. Email enviado a ") + correo + "." });
}

// ── activar_acceso_emp ────────────────────────────────────────
async function activarAccesoEmp(p, env, ctx) {
  if (p.token) {
    const caller = await autenticarRequest(env, p);
    if (!caller) return error("Sesión inválida.");
    await registrarEvento(env, caller.email, caller.rol, "ACTIVAR_ACCESO_EMP",
      "Acceso activado para " + p.idInterno + " (" + p.correo + ")", "", "");
  }
  return activarAccesoInterno(env, ctx, p.idInterno, p.correo, p.password);
}

// ── reenviar_acceso_emp ───────────────────────────────────────
async function reenviarAccesoEmp(p, env, ctx) {
  const caller = await autenticarRequest(env, p);
  if (!caller) return error("Sesión inválida.");
  const idInterno = s(p.idInterno);
  if (!idInterno) return error("ID INTERNO requerido.");
  const e = await env.DB.prepare("SELECT correo_acceso, no_empleado FROM empleados WHERE id_interno = ?").bind(idInterno).first();
  const correo = e ? s(e.correo_acceso) : "";
  if (!correo) return error("El empleado no tiene CORREO ACCESO registrado. Agrégalo en el expediente.");
  await activarAccesoInterno(env, ctx, idInterno, correo, "Prisma" + s(e.no_empleado) + "*");
  return ok({ message: "Acceso activado y email enviado a " + correo + "." });
}

// ── buscar_usuario_por_nombre ─────────────────────────────────
// (GAS no exige sesión aquí; se respeta para no romper el flujo actual)
async function buscarUsuarioPorNombre(p, env) {
  const nombre = s(p.nombre).toLowerCase();
  if (!nombre || nombre.length < 3) return error("Nombre muy corto.");
  const palabras = normalizar(nombre).split(" ").filter(x => x.length > 2);
  const { results } = await env.DB.prepare(
    "SELECT id_interno, nombre, empresa, estatus FROM v_empleados"
  ).all();
  const candidatos = [];
  for (const r of results) {
    const nomFila = normalizar(r.nombre);
    if (!nomFila) continue;
    const sim = palabras.length ? palabras.filter(x => nomFila.includes(x)).length / palabras.length : 0;
    if (sim >= 0.5) candidatos.push({ idInterno: s(r.id_interno), nombre: s(r.nombre), empresa: s(r.empresa), estatus: s(r.estatus), sim });
  }
  if (!candidatos.length) return error("No se encontró ningún empleado con ese nombre.");
  candidatos.sort((a, b) => {
    if (a.estatus === "Activo" && b.estatus !== "Activo") return -1;
    if (b.estatus === "Activo" && a.estatus !== "Activo") return 1;
    return b.sim - a.sim;
  });
  return ok({ candidatos: candidatos.slice(0, 5) });
}

export default {
  login_empleado: loginEmpleado,
  validar_token_emp: validarTokenEmp,
  activar_acceso_emp: activarAccesoEmp,
  reenviar_acceso_emp: reenviarAccesoEmp,
  buscar_usuario_por_nombre: buscarUsuarioPorNombre,
};
