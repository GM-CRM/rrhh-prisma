// ============================================================
//  Módulo AUTH — usuarios del panel RH
//  Port 1:1 de Código.gs: loginUsuario, logoutUsuario, validarToken,
//  crearUsuario, listarUsuarios, actualizarUsuario, cambiarPassword,
//  resetearPassword, solicitarResetPassword, setupInicial, migrarColumnasUsuarios
//  Mismos nombres de acción, mismos payloads, mismas respuestas y mensajes.
// ============================================================
import { hashPassword, generarToken, generarPasswordTemporal, ahoraISO, s, listaEmpresas, ok, error } from "../lib/util.js";
import { buscarUsuario, buscarUsuarioPorToken, usuarioConPermisos, usuarioConPermiso, registrarEvento } from "../lib/sesion.js";
import { permisosDeRol, tienePermiso } from "../lib/permisos.js";
import { urlFotoUsuario } from "./roles.js";
import { enviarEnSegundoPlano } from "../lib/correo.js";
import { getPlantillaBienvenida, getPlantillaResetPassword } from "../lib/plantillas_correo.js";

const SESSION_HORAS = 12;
const MSG_RESET = "Si tu correo está registrado, recibirás un email con instrucciones.";

// ── login ─────────────────────────────────────────────────────
async function login(p, env) {
  const email = s(p.email).toLowerCase();
  const password = s(p.password);
  const device = s(p.device);
  if (!email || !password) return error("Email y contraseña requeridos.");

  const u = await buscarUsuario(env, email);
  if (!u) {
    await registrarEvento(env, email, "", "LOGIN_FALLIDO", "Email no encontrado", "", device);
    return error("Credenciales incorrectas.");
  }
  if (s(u.estatus) !== "Activo") {
    await registrarEvento(env, email, u.rol, "LOGIN_BLOQUEADO", "Usuario inactivo", "", device);
    return error("Usuario inactivo. Contacta al administrador.");
  }
  if ((await hashPassword(password)) !== s(u.hash_password)) {
    await registrarEvento(env, email, u.rol, "LOGIN_FALLIDO", "Contraseña incorrecta", "", device);
    return error("Credenciales incorrectas.");
  }

  const token = generarToken();
  const expira = new Date(Date.now() + SESSION_HORAS * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "UPDATE usuarios SET token_sesion = ?, expira_token = ?, ultimo_acceso = ?, fecha_creacion = COALESCE(fecha_creacion, ?) WHERE id_usuario = ?"
  ).bind(token, expira, ahoraISO(), ahoraISO(), u.id_usuario).run();

  await registrarEvento(env, email, u.rol, "LOGIN", "Inicio de sesión exitoso", u.empresas_asignadas || "Todas", device);
  const usuario = await usuarioConPermisos(env, u);
  usuario.urlFoto = await urlFotoUsuario(env, u.url_foto);
  return ok({ token, expira, usuario });
}

// ── logout ────────────────────────────────────────────────────
async function logout(p, env) {
  const u = await buscarUsuarioPorToken(env, p && p.token);
  if (u) {
    await env.DB.prepare("UPDATE usuarios SET token_sesion = NULL, expira_token = NULL WHERE id_usuario = ?")
      .bind(u.id_usuario).run();
    await registrarEvento(env, u.email, u.rol, "LOGOUT", "Cierre de sesión", "", "");
  }
  return ok({ message: "Sesión cerrada." });
}

// ── validar_token ─────────────────────────────────────────────
async function validarToken(p, env) {
  const u = await buscarUsuarioPorToken(env, p && p.token);
  if (!u) return error("Sesión inválida o expirada.");
  const usuario = await usuarioConPermisos(env, u);
  usuario.urlFoto = await urlFotoUsuario(env, u.url_foto);
  return ok({ usuario });
}

// El rol debe existir en la tabla de roles (si la tabla aún no existe, se aceptan los dos de siempre)
async function rolValido(env, rol) {
  try {
    const r = await env.DB.prepare("SELECT nombre FROM roles WHERE nombre = ? COLLATE NOCASE").bind(rol).first();
    return r ? r.nombre : null;
  } catch (_) { return ["Administrador", "Auxiliar"].includes(rol) ? rol : null; }
}
// ¿Quedaría al menos un Administrador activo si este usuario deja de serlo?
async function quedaOtroAdmin(env, idUsuario) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'Administrador' AND estatus = 'Activo' AND id_usuario <> ?").bind(idUsuario).first();
  return r && r.n > 0;
}
const limpiarLista = v => listaEmpresas(v).map(x => s(x)).filter(Boolean).join(",");

// ── crear_usuario (permiso: usuarios.administrar) ─────────────
async function crearUsuario(p, env, ctx) {
  const admin = await usuarioConPermiso(env, p.token, "usuarios.administrar");
  if (!admin) return error("Sin permisos para crear usuarios.");

  const nombre = s(p.nombre), email = s(p.email).toLowerCase(), password = s(p.password);
  const empresas = limpiarLista(p.empresas), grupos = limpiarLista(p.grupos), telefono = s(p.telefono);
  const idInterno = s(p.idInterno);
  if (!nombre || !email || !password) return error("Nombre, email y contraseña son requeridos.");
  if (password.length < 8) return error("La contraseña inicial debe tener al menos 8 caracteres.");
  const rol = await rolValido(env, s(p.rol) || "Auxiliar");
  if (!rol) return error("El rol \"" + s(p.rol) + "\" no existe.");
  if (await buscarUsuario(env, email)) return error("Ya existe un usuario con ese email.");

  // Siguiente USR### (por el número más alto existente; GAS usaba el número de filas)
  const r = await env.DB.prepare(
    "SELECT MAX(CAST(substr(id_usuario, 4) AS INTEGER)) AS n FROM usuarios WHERE id_usuario LIKE 'USR%'"
  ).first();
  const nuevoId = "USR" + String((r && r.n ? r.n : 0) + 1).padStart(3, "0");

  await env.DB.prepare(
    `INSERT INTO usuarios (id_usuario, nombre_completo, email, hash_password, rol, empresas_asignadas,
       estatus, telefono, url_foto, fecha_creacion, creado_por, id_interno, grupos_asignados)
     VALUES (?,?,?,?,?,?,'Activo',?,'',?,?,?,?)`
  ).bind(nuevoId, nombre, email, await hashPassword(password), rol, empresas, telefono, ahoraISO(), admin.email, idInterno, grupos).run();

  await registrarEvento(env, admin.email, admin.rol, "CREAR_USUARIO", "Creó usuario " + email + " con rol " + rol, [grupos, empresas].filter(Boolean).join(" | "), "");
  enviarEnSegundoPlano(ctx, env, {
    to: email,
    subject: "Bienvenido(a) a RRHH Prisma — Tus accesos",
    html: getPlantillaBienvenida(nombre, email, password, rol || "Auxiliar"),
  });
  return ok({ message: "Usuario " + email + " creado correctamente.", id: nuevoId });
}

// ── listar_usuarios (solo Admin) ──────────────────────────────
async function listarUsuarios(p, env) {
  const admin = await usuarioConPermiso(env, p && p.token, "usuarios.administrar");
  if (!admin) return error("Sin permisos.");
  const { results } = await env.DB.prepare("SELECT * FROM usuarios ORDER BY id_usuario").all();
  const usuarios = [];
  for (const u of results.filter(x => x.id_usuario)) usuarios.push({
    id: u.id_usuario,
    nombre: u.nombre_completo,
    email: u.email,
    rol: u.rol,
    empresas: listaEmpresas(u.empresas_asignadas),
    estatus: u.estatus,
    telefono: u.telefono || "",
    urlFoto: await urlFotoUsuario(env, u.url_foto),
    idInterno: s(u.id_interno),
    grupos: listaEmpresas(u.grupos_asignados).filter(Boolean),
    // GAS devolvía la columna K (expiración del token) como "último acceso"; aquí va el real si existe
    ultimoAcceso: u.ultimo_acceso || u.expira_token || "",
  });
  return ok({ usuarios });
}

// ── actualizar_usuario ────────────────────────────────────────
async function actualizarUsuario(p, env) {
  const caller = await buscarUsuarioPorToken(env, p.token);
  if (!caller) return error("Sesión inválida.");
  const callerEmail = s(caller.email).toLowerCase();
  const targetEmail = s(p.email).toLowerCase();
  const administra = tienePermiso(await permisosDeRol(env, caller.rol), "usuarios.administrar");
  if (!administra && callerEmail !== targetEmail) return error("Sin permisos para editar otros usuarios.");

  const target = await buscarUsuario(env, targetEmail);
  if (!target) return error("Usuario no encontrado.");

  const sets = [], vals = [], cambios = [];
  const campo = (clave, col, etiqueta, valor) => {
    if (p[clave] !== undefined) { sets.push(col + " = ?"); vals.push(valor !== undefined ? valor : p[clave]); cambios.push(etiqueta); }
  };
  campo("nombre", "nombre_completo", "nombre");
  campo("telefono", "telefono", "telefono");
  // La foto se cambia con subir_foto_usuario. El vínculo con el empleado (ID INTERNO),
  // el rol, el alcance y el estatus solo los cambia quien administra usuarios:
  // antes cualquiera podía ponerse otro ID INTERNO y ver evaluaciones ajenas.
  if (administra) {
    campo("idInterno", "id_interno", "idInterno", s(p.idInterno));
    if (p.rol !== undefined) {
      const rol = await rolValido(env, s(p.rol));
      if (!rol) return error("El rol \"" + s(p.rol) + "\" no existe.");
      if (target.rol === "Administrador" && rol !== "Administrador" && !(await quedaOtroAdmin(env, target.id_usuario)))
        return error("Debe quedar al menos un Administrador activo.");
      if (callerEmail === targetEmail && rol !== caller.rol && !tienePermiso(await permisosDeRol(env, rol), "usuarios.administrar"))
        return error("No puedes cambiarte a un rol sin acceso a Usuarios: te quedarías fuera de esta pantalla.");
      campo("rol", "rol", "rol", rol);
    }
    campo("empresas", "empresas_asignadas", "empresas", limpiarLista(p.empresas));
    campo("grupos", "grupos_asignados", "grupos", limpiarLista(p.grupos));
    if (p.estatus !== undefined) {
      const est = s(p.estatus) === "Activo" ? "Activo" : "Inactivo";
      if (est === "Inactivo" && callerEmail === targetEmail) return error("No puedes desactivar tu propio usuario.");
      if (est === "Inactivo" && target.rol === "Administrador" && !(await quedaOtroAdmin(env, target.id_usuario)))
        return error("Debe quedar al menos un Administrador activo.");
      campo("estatus", "estatus", "estatus", est);
      if (est === "Inactivo") { sets.push("token_sesion = NULL", "expira_token = NULL"); }
    }
  }
  if (sets.length) {
    vals.push(target.id_usuario);
    await env.DB.prepare(`UPDATE usuarios SET ${sets.join(", ")} WHERE id_usuario = ?`).bind(...vals).run();
  }
  await registrarEvento(env, callerEmail, caller.rol, "EDITAR_USUARIO", "Editó " + targetEmail + ": " + cambios.join(", "), "", "");
  return ok({ message: "Usuario actualizado." });
}

// ── cambiar_password (propia) ─────────────────────────────────
async function cambiarPassword(p, env) {
  const u = await buscarUsuarioPorToken(env, p.token);
  if (!u) return error("Sesión inválida.");
  const passActual = s(p.passActual), passNuevo = s(p.passNuevo);
  if ((await hashPassword(passActual)) !== s(u.hash_password)) return error("Contraseña actual incorrecta.");
  if (passNuevo.length < 8) return error("La nueva contraseña debe tener al menos 8 caracteres.");
  await env.DB.prepare("UPDATE usuarios SET hash_password = ? WHERE id_usuario = ?")
    .bind(await hashPassword(passNuevo), u.id_usuario).run();
  await registrarEvento(env, u.email, u.rol, "CAMBIAR_PASSWORD", "Cambió su contraseña", "", "");
  return ok({ message: "Contraseña actualizada correctamente." });
}

// ── resetear_password (solo Admin) ────────────────────────────
async function resetearPassword(p, env, ctx) {
  const admin = await usuarioConPermiso(env, p.token, "usuarios.administrar");
  if (!admin) return error("Sin permisos para resetear contraseñas.");
  const targetEmail = s(p.email).toLowerCase();
  // Antes todos quedaban con "Prisma2025*"; ahora cada reseteo genera una temporal distinta
  const passNueva = s(p.passNueva) || generarPasswordTemporal();
  if (passNueva.length < 8) return error("La contraseña debe tener al menos 8 caracteres.");
  const target = await buscarUsuario(env, targetEmail);
  if (!target) return error("Usuario no encontrado.");

  await env.DB.prepare("UPDATE usuarios SET hash_password = ?, token_sesion = NULL, expira_token = NULL WHERE id_usuario = ?")
    .bind(await hashPassword(passNueva), target.id_usuario).run();
  await registrarEvento(env, admin.email, admin.rol, "RESET_PASSWORD", "Reseteó contraseña de " + targetEmail, "", "");
  enviarEnSegundoPlano(ctx, env, {
    to: targetEmail,
    subject: "RRHH Prisma — Restablecimiento de contraseña",
    html: getPlantillaResetPassword(target.nombre_completo || targetEmail, targetEmail, passNueva),
  });
  return ok({ message: "Contraseña de " + targetEmail + " reseteada. Se envió email de notificación.", passTemporal: passNueva });
}

// ── solicitar_reset (desde el login, sin sesión) ──────────────
async function solicitarReset(p, env, ctx) {
  const email = s(p.email).toLowerCase();
  if (!email) return error("Proporciona tu correo electrónico.");
  try {
    const u = await buscarUsuario(env, email);
    if (!u || s(u.estatus) !== "Activo") return ok({ message: MSG_RESET }); // no revelar si existe
    const passTemp = generarPasswordTemporal();
    await env.DB.prepare("UPDATE usuarios SET hash_password = ?, token_sesion = NULL, expira_token = NULL WHERE id_usuario = ?")
      .bind(await hashPassword(passTemp), u.id_usuario).run();
    enviarEnSegundoPlano(ctx, env, {
      to: email,
      subject: "RRHH Prisma — Restablecimiento de contraseña",
      html: getPlantillaResetPassword(s(u.nombre_completo) || "Usuario", email, passTemp),
    });
    await registrarEvento(env, email, u.rol, "RESET_SELF", "Solicitud de reset por correo", "", "");
    return ok({ message: MSG_RESET });
  } catch (e) {
    console.log("[solicitarReset] Error: " + e);
    return error("Error procesando la solicitud. Intenta de nuevo.");
  }
}

// ── Utilidades de configuración de GAS: ya no aplican ─────────
const setupInicial = async () => ({ status: "info", message: "El administrador ya existe." });
const migrarColumnasUsuarios = async () => ok({ message: "Ya existe." });

export default {
  login,
  logout,
  validar_token: validarToken,
  crear_usuario: crearUsuario,
  listar_usuarios: listarUsuarios,
  actualizar_usuario: actualizarUsuario,
  cambiar_password: cambiarPassword,
  resetear_password: resetearPassword,
  solicitar_reset: solicitarReset,
  setup_inicial: setupInicial,
  migrar_columnas_usuarios: migrarColumnasUsuarios,
};
