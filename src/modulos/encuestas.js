// ============================================================
//  Módulo ENCUESTAS — port de Código.gs:
//  obtenerEncuesta, guardarRespuestaEncuesta, listarRespuestasEncuesta,
//  guardarConfigEncuesta, setupEncuestas, buscarEmpleadoEncuesta,
//  obtenerEmpleadoPorId
//  Públicas (sin sesión, las usa encuesta.html): obtener_encuesta,
//  guardar_respuesta, buscar_empleado_encuesta, obtener_empleado_por_id.
// ============================================================
import { s, normalizar, ok, error } from "../lib/util.js";
import { buscarUsuarioPorToken, requiereSesionValida } from "../lib/sesion.js";
import { getEstructuraSalida, getEstructuraClima } from "../lib/estructuras_encuestas.js";

const parse = (t, d) => { try { return JSON.parse(t || ""); } catch (e) { return d; } };

// ── obtener_encuesta (pública) ────────────────────────────────
async function obtenerEncuesta(p, env) {
  const encId = (s(p && p.encId) || "SALIDA").toUpperCase();
  try {
    const e = await env.DB.prepare("SELECT * FROM encuestas WHERE UPPER(TRIM(id_encuesta)) = ?").bind(encId).first();
    if (!e) return error("Encuesta no encontrada: " + encId);
    const estructura = parse(e.estructura_json, {}) || {};
    let bloques = estructura.bloques || [];
    // Igual que GAS: si SALIDA está vacía, se usa la estructura predeterminada y se guarda
    if (!bloques.length && encId === "SALIDA") {
      const completa = JSON.parse(getEstructuraSalida());
      bloques = completa.bloques || [];
      estructura.titulo = estructura.titulo || completa.titulo;
      estructura.descripcion = estructura.descripcion || completa.descripcion;
      await env.DB.prepare("UPDATE encuestas SET estructura_json = ? WHERE id_encuesta = ?").bind(getEstructuraSalida(), e.id_encuesta).run();
    }
    return ok({ encuesta: { id: e.id_encuesta, titulo: e.nombre, tipo: e.tipo, activa: e.activa, descripcion: estructura.descripcion || "", bloques } });
  } catch (err) { return error(String(err)); }
}

// ── guardar_respuesta (pública) ───────────────────────────────
async function guardarRespuesta(p, env) {
  const encId = s(p.encId), empId = s(p.empleadoId), empNom = s(p.empleadoNombre);
  if (!encId || !empId) return error("Faltan datos de identificación.");
  try {
    const respJSON = JSON.stringify(p.respuestas || {});
    if (respJSON.length > 200000) return error("La respuesta es demasiado grande.");
    const fecha = s(p.fechaRespuesta) || new Date().toISOString();
    // Empresa del empleado (por ID INTERNO o, como en GAS, por No. de empleado)
    const emp = await env.DB.prepare(
      "SELECT empresa FROM empleados WHERE id_interno = ? OR CAST(no_empleado AS TEXT) = ? ORDER BY (id_interno = ?) DESC, (fecha_baja IS NULL) DESC LIMIT 1"
    ).bind(empId, empId, empId).first();
    const enc = await env.DB.prepare("SELECT tipo FROM encuestas WHERE UPPER(id_encuesta) = ?").bind(encId.toUpperCase()).first();
    const n = await env.DB.prepare("SELECT MAX(CAST(substr(id_respuesta, 4) AS INTEGER)) AS m FROM respuestas WHERE id_respuesta LIKE 'RSP%'").first();
    const idResp = "RSP" + String((n && n.m ? n.m : 0) + 1).padStart(6, "0");
    await env.DB.prepare(
      `INSERT INTO respuestas (id_respuesta, id_encuesta, tipo_encuesta, id_interno, no_empleado, nombre_empleado, empresa, fecha_respuesta, respuestas_json)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(idResp, encId, enc ? s(enc.tipo) : "", empId, empId, empNom, emp ? s(emp.empresa) : "", fecha, respJSON).run();
    return ok({ message: "Respuesta guardada.", id: idResp });
  } catch (err) { return error(String(err)); }
}

// ── listar_respuestas (panel) ─────────────────────────────────
async function listarRespuestas(p, env) {
  if (!(await requiereSesionValida(env, p))) return { status: "error", message: "Sesión inválida o expirada." };  // GAS lo dejaba abierto
  const encId = s(p && p.encId).toUpperCase();
  try {
    const q = encId
      ? env.DB.prepare("SELECT * FROM respuestas WHERE UPPER(TRIM(id_encuesta)) = ? ORDER BY rowid").bind(encId)
      : env.DB.prepare("SELECT * FROM respuestas ORDER BY rowid");
    const { results } = await q.all();
    const lista = results.filter(r => r.id_respuesta).map(r => ({
      id: r.id_respuesta, encId: r.id_encuesta, tipoEnc: s(r.tipo_encuesta), idInterno: s(r.id_interno),
      noEmpleado: r.no_empleado ?? "", nombre: s(r.nombre_empleado), empresa: s(r.empresa),
      fecha: s(r.fecha_respuesta), respuestas: parse(r.respuestas_json, {}),
    }));
    return ok({ respuestas: lista, total: lista.length });
  } catch (err) { return error(String(err)); }
}

// ── guardar_encuesta (editor, solo Admin) ─────────────────────
async function guardarEncuesta(p, env) {
  const admin = await buscarUsuarioPorToken(env, p.token);
  if (!admin || admin.rol !== "Administrador") return error("Sin permisos.");
  const encId = s(p.encId).toUpperCase();
  try {
    const r = await env.DB.prepare("UPDATE encuestas SET estructura_json = ? WHERE UPPER(TRIM(id_encuesta)) = ?")
      .bind(JSON.stringify(p.estructura || {}), encId).run();
    if (!r.meta || !r.meta.changes) return error("Encuesta no encontrada.");
    return ok({ message: "Encuesta actualizada." });
  } catch (err) { return error(String(err)); }
}

// ── setup_encuestas ───────────────────────────────────────────
async function setupEncuestas(p, env) {
  try {
    const cfg = { SALIDA: getEstructuraSalida, CLIMA: getEstructuraClima };
    for (const id of Object.keys(cfg)) {
      const e = await env.DB.prepare("SELECT estructura_json FROM encuestas WHERE UPPER(id_encuesta) = ?").bind(id).first();
      const actual = parse(e && e.estructura_json, {}) || {};
      if (e && !(actual.bloques && actual.bloques.length))
        await env.DB.prepare("UPDATE encuestas SET estructura_json = ? WHERE UPPER(id_encuesta) = ?").bind(cfg[id](), id).run();
    }
    return ok({ message: "Setup de encuestas completado." });
  } catch (err) { return error(String(err)); }
}

// ── buscar_empleado_encuesta (pública) ────────────────────────
// CORRECCIÓN F21 (antes en GAS): la encuesta podía quedar guardada a nombre de
// OTRA persona con el mismo No. de empleado (de otra empresa o dada de baja):
//   · con un solo registro con ese número se aceptaba sin revisar el nombre;
//   · solo se comparaba contra los ACTIVOS, y si el nombre no coincidía se
//     devolvía "warning" con ese empleado y la página seguía de todas formas;
//   · el selector de empresa ofrecía registros cuyo nombre no coincidía.
// Ahora el nombre SIEMPRE tiene que coincidir (nombre + al menos un apellido,
// tolera acentos, orden, mayúsculas y un error de dedo). Si no coincide nadie, no se asigna
// a nadie. Para NOM-035 (y Clima) solo cuentan los registros activos.
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "ma", "mª", "san", "santa", "van", "von"]);
function palabrasNombre(t) {
  return s(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 1 && !CONECTORES.has(w));
}
function distancia1(a, b) {                 // ¿a y b difieren en a lo más una letra?
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}
const mismaPalabra = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && distancia1(a, b));
// Reglas (probadas contra toda la base):
//  · todo lo que escribe la persona debe estar en su registro (se permite una
//    palabra de más solo si escribió 4 o más);
//  · al menos 2 palabras coinciden;
//  · el registro va "APELLIDOS NOMBRE(S)": con 3+ palabras, una de las que
//    coinciden debe ser de la parte del nombre, para que dos apellidos iguales
//    (parientes con el mismo número en otra empresa) no basten.
export function coincideNombre(tecleado, registro) {
  const T = palabrasNombre(tecleado), R = palabrasNombre(registro);
  if (T.length < 2) return false;
  const usadas = new Set(), pendientes = [];
  let hits = 0, deNombre = false;
  const marcar = k => { usadas.add(k); hits++; if (k >= 2) deNombre = true; };
  for (const w of T) {                     // 1ª pasada: palabras exactas
    const k = R.findIndex((r, idx) => !usadas.has(idx) && r === w);
    if (k >= 0) marcar(k); else pendientes.push(w);
  }
  for (const w of pendientes) {            // 2ª pasada: un error de dedo ("Munis" ≈ "Muñiz")
    const k = R.findIndex((r, idx) => !usadas.has(idx) && mismaPalabra(w, r));
    if (k >= 0) marcar(k);
  }
  const sobrantes = T.length - hits;
  if (hits < 2 || sobrantes > (T.length >= 4 ? 1 : 0)) return false;
  return R.length < 3 || deNombre || hits >= 3;
}

async function buscarEmpleadoEncuesta(p, env) {
  let noEmp = s(p.noEmpleado);
  const nombre = s(p.nombre);
  const tipo = s(p.tipo).toUpperCase();                    // NOM035 | SALIDA | CLIMA | (vacío)
  if (/^\d+(\.0+)?$/.test(noEmp)) noEmp = String(parseInt(noEmp, 10));   // "007" o "7.0" → "7"
  if (!noEmp) return error("Proporciona tu número de empleado.");
  if (!nombre) return error("Proporciona tu nombre completo.");
  if (palabrasNombre(nombre).length < 2) return error("Escribe tu nombre y al menos un apellido, como aparecen en tu registro.");
  try {
    const { results } = await env.DB.prepare(
      `SELECT v.id_interno, v.nombre, v.empresa, v.no_empleado, v.estatus, e.curp, e.fecha_ingreso
         FROM v_empleados v JOIN empleados e ON e.id_interno = v.id_interno
        WHERE TRIM(CAST(v.no_empleado AS TEXT)) = ?
        ORDER BY COALESCE(e.fila_sheet_origen, 999999999), e.rowid`
    ).bind(noEmp).all();
    const noCoincide = "El nombre no coincide con el registro del número de empleado " + noEmp +
      ". Revisa que ambos datos sean correctos; si lo son, acude a Recursos Humanos.";
    if (!results.length) return error("No se encontró ningún empleado con el número " + noEmp + ".");

    // 1) Solo registros cuyo nombre coincide con lo que escribió la persona
    let cand = results.filter(r => coincideNombre(nombre, r.nombre)).map((r, i) => ({
      idInterno: s(r.id_interno), nombre: s(r.nombre), empresa: s(r.empresa), noEmpleado: s(r.no_empleado),
      estatus: s(r.estatus), curp: s(r.curp).toUpperCase(), ingreso: s(r.fecha_ingreso), orden: i,
    }));
    if (!cand.length) return error(noCoincide);

    // 2) NOM-035 y Clima son para personal activo
    if (tipo === "NOM035" || tipo === "CLIMA") {
      const act = cand.filter(c => c.estatus === "Activo");
      if (!act.length) return error("Tu registro con el número " + noEmp + " aparece dado de baja. Si sigues laborando, acude a Recursos Humanos para actualizarlo.");
      cand = act;
    }

    // 3) Una misma persona puede tener varios registros (reingreso / cambio de
    //    puesto): se agrupa por CURP (o nombre + empresa) y se toma el activo,
    //    o el más reciente si ninguno está activo.
    const personas = new Map();
    for (const c of cand) {
      const k = c.curp.length >= 18 ? c.curp : normalizar(c.nombre) + "|" + normalizar(c.empresa);
      const prev = personas.get(k);
      const mejor = !prev ? c
        : (c.estatus === "Activo") !== (prev.estatus === "Activo") ? (c.estatus === "Activo" ? c : prev)
        : (c.ingreso > prev.ingreso || (c.ingreso === prev.ingreso && c.orden > prev.orden)) ? c : prev;
      personas.set(k, mejor);
    }
    const lista = [...personas.values()];
    const publico = c => ({ idInterno: c.idInterno, nombre: c.nombre, empresa: c.empresa, noEmpleado: c.noEmpleado, estatus: c.estatus });
    if (lista.length === 1) return ok({ empleado: publico(lista[0]) });

    // 4) Dos personas distintas con el mismo número y nombre parecido: que elija
    //    su empresa, pero SOLO entre las que coinciden con su nombre.
    return {
      status: "multiple", message: "Hay varios registros con el número " + noEmp + ". Confirma tu empresa.",
      candidatos: lista.map(c => ({ idInterno: c.idInterno, empresa: c.empresa, noEmpleado: c.noEmpleado })),
    };
  } catch (err) { return error(String(err)); }
}

// ── obtener_empleado_por_id (pública: link precargado desde Bajas) ─
async function obtenerEmpleadoPorId(p, env) {
  const idInterno = s(p.idInterno);
  if (!idInterno) return error("No se proporcionó idInterno.");
  try {
    const r = await env.DB.prepare("SELECT id_interno, nombre, empresa, no_empleado FROM empleados WHERE id_interno = ?").bind(idInterno).first();
    if (!r) return error("No se encontró el empleado con ID " + idInterno);
    return ok({ empleado: { idInterno: s(r.id_interno), nombre: s(r.nombre), empresa: s(r.empresa), noEmpleado: s(r.no_empleado) } });
  } catch (err) { return error(String(err)); }
}

export default {
  obtener_encuesta: obtenerEncuesta,
  guardar_respuesta: guardarRespuesta,
  listar_respuestas: listarRespuestas,
  guardar_encuesta: guardarEncuesta,
  setup_encuestas: setupEncuestas,
  buscar_empleado_encuesta: buscarEmpleadoEncuesta,
  obtener_empleado_por_id: obtenerEmpleadoPorId,
};
