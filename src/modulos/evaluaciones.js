// ============================================================
//  Módulo EVALUACIONES — procesos (Desempeño · 360° · Competencias)
//  Port de Código.gs: crearProcesoEval, listarProcesosEval,
//  obtenerProcesoEval, actualizarProcesoEval, activarProcesoEval,
//  cerrarProcesoEval, listarMisEvaluaciones, listarEquipoEval,
//  guardarEvaluacion, resultadosEval
//
//  Mismas respuestas que GAS. Correcciones (F24–F30 del inventario):
//   · guardar_eval, listar_mis_eval, listar_equipo_eval y resultados_eval
//     no pedían sesión: cualquiera podía leer o SOBRESCRIBIR evaluaciones
//     con solo un ID. Ahora la identidad sale del token (panel o portal
//     del empleado), no de lo que manda el navegador.
//   · Solo el evaluador asignado guarda su evaluación, una vez, y solo con
//     el proceso Activo.
//   · Los IDs (EVA001, EV00001) se calculaban con el número de filas y se
//     repetían (EV00005 está dos veces). Ahora: siguiente número libre.
//   · El tipo "360" se guardaba como número en el Sheet y la activación no
//     generaba autoevaluaciones. Activar dos veces duplicaba todo.
//   · Un usuario con empresas asignadas solo ve y opera procesos de sus
//     empresas.
//   · Las preguntas solo se editan en Borrador (las respuestas se guardan
//     por número de pregunta: cambiarlas después revuelve los resultados).
// ============================================================
import { s, ahoraISO, normalizar, ok, error } from "../lib/util.js";
import { autenticarRequest, identidadPorToken, registrarEvento } from "../lib/sesion.js";
import { literal } from "../lib/columnas.js";
import { getEstructuraEvalPorTipo } from "../lib/estructuras_eval.js";

const SESION_INVALIDA = { status: "error", message: "Sesión inválida." };
const TIPOS = ["desempeno", "360", "competencias"];
const parse = (t, d) => { try { return JSON.parse(t || ""); } catch (e) { return d; } };

// "360.0" (número en el Sheet) → "360"; "Desempeño" → "desempeno"
function tipoNorm(t) {
  const v = normalizar(s(t)).replace(/\.0+$/, "");
  return v === "desempeño" ? "desempeno" : v;
}
// Fecha que muestra el panel: 'AAAA-MM-DD' (hora de México si viene con hora)
function fechaMX(v) {
  v = s(v);
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  return isNaN(t) ? v : new Date(t - 6 * 3600 * 1000).toISOString().slice(0, 10);
}
const clave = t => normalizar(t).replace(/[^a-z0-9]/g, "");
const fechaValida = v => !s(v) || /^\d{4}-\d{2}-\d{2}$/.test(s(v));

// ¿El usuario del panel puede ver/operar este proceso?
function enAlcance(caller, empresaProceso) {
  if (!caller.empresas.length) return true;                    // sin restricción (Administrador o RH general)
  const e = clave(empresaProceso);
  return !!e && caller.empresas.some(x => clave(x) === e);    // los de "todas las empresas" los opera RH general
}

async function panel(env, p) {
  const c = await autenticarRequest(env, p);
  if (c) c.empresas = c.empresas.filter(Boolean);
  return c;
}

async function leerProceso(env, id) {
  return env.DB.prepare("SELECT * FROM procesos_eval WHERE id_proceso = ?").bind(s(id)).first();
}

// Nombre oficial de la empresa en el catálogo ("" = todas). null = no existe.
async function empresaCanonica(env, txt) {
  if (!s(txt)) return "";
  const { results } = await env.DB.prepare("SELECT empresa FROM empresas").all();
  const k = clave(txt);
  const hit = results.find(r => clave(r.empresa) === k);
  return hit ? hit.empresa : null;
}

async function siguienteId(env, tabla, col, prefijo, digitos) {
  const r = await env.DB.prepare(
    `SELECT MAX(CAST(substr(${col}, ${prefijo.length + 1}) AS INTEGER)) AS n FROM ${tabla}
      WHERE ${col} GLOB '${prefijo}[0-9]*'`
  ).first();
  return (r && r.n ? r.n : 0) + 1;
}
const conCeros = (n, d) => String(n).padStart(d, "0");

// ── crear_proceso_eval ────────────────────────────────────────
async function crearProcesoEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  const nombre = s(p.nombre), tipo = tipoNorm(p.tipo || "desempeno");
  const fechaIni = s(p.fechaIni), fechaFin = s(p.fechaFin);
  if (!nombre) return error("El nombre es requerido.");
  if (!TIPOS.includes(tipo)) return error("Tipo de evaluación no válido.");
  if (!fechaValida(fechaIni) || !fechaValida(fechaFin)) return error("Fechas no válidas.");
  if (fechaIni && fechaFin && fechaFin < fechaIni) return error("La fecha de cierre es anterior a la de inicio.");
  const empresa = await empresaCanonica(env, p.empresa);
  if (empresa === null) return error(`La empresa "${s(p.empresa)}" no está en el catálogo. Escríbela como aparece en Empresas o déjala vacía para todas.`);
  if (!enAlcance(caller, empresa)) return error(caller.empresas.length && !empresa
    ? "Tu usuario está limitado a ciertas empresas: indica una de ellas." : "No tienes acceso a esa empresa.");

  const estructura = getEstructuraEvalPorTipo(tipo);
  let n = await siguienteId(env, "procesos_eval", "id_proceso", "EVA", 3);
  for (let intento = 0; intento < 3; intento++, n++) {
    const id = "EVA" + conCeros(n, 3);
    try {
      await env.DB.prepare(
        `INSERT INTO procesos_eval (id_proceso, nombre, tipo, estatus, fecha_inicio, fecha_cierre, empresa,
           estructura_json, creado_por, fecha_creacion) VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, nombre, tipo, "Borrador", fechaIni || null, fechaFin || null, empresa || null,
        JSON.stringify(estructura), caller.email, ahoraISO()).run();
      await registrarEvento(env, caller.email, caller.rol, "CREAR_PROCESO_EVAL", "Creó proceso: " + nombre + " (" + tipo + ")", empresa, "");
      return { status: "success", id, message: "Proceso creado correctamente." };
    } catch (e) {
      if (!/UNIQUE|PRIMARY/i.test(String(e))) return error(String(e));   // otro lo creó al mismo tiempo → siguiente
    }
  }
  return error("No se pudo asignar un ID al proceso. Intenta de nuevo.");
}

// ── listar_procesos_eval ──────────────────────────────────────
async function listarProcesosEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const { results } = await env.DB.prepare("SELECT * FROM procesos_eval ORDER BY rowid").all();
    const procesos = results.filter(r => enAlcance(caller, r.empresa)).map(r => {
      const estr = parse(r.estructura_json, {});
      return {
        id: s(r.id_proceso), nombre: s(r.nombre), tipo: tipoNorm(r.tipo), estatus: s(r.estatus),
        fechaIni: fechaMX(r.fecha_inicio), fechaFin: fechaMX(r.fecha_cierre), empresa: s(r.empresa),
        titulo: estr.titulo || s(r.nombre), creadoPor: s(r.creado_por), fechaCreacion: s(r.fecha_creacion),
      };
    });
    return { status: "success", procesos };
  } catch (e) { return error(String(e)); }
}

// ── obtener_proceso_eval (panel y portal del empleado) ────────
async function obtenerProcesoEval(p, env) {
  const id = s(p.id);
  if (!id) return error("ID requerido.");
  const quien = await identidadPorToken(env, p.token);
  if (!quien) return SESION_INVALIDA;                                // GAS lo dejaba abierto
  try {
    const r = await leerProceso(env, id);
    if (!r) return error("Proceso no encontrado.");
    // RH lo ve si es de sus empresas; cualquiera (panel o portal) lo ve si tiene
    // una evaluación que llenar en ese proceso (un jefe puede evaluar a alguien
    // de otra empresa).
    if (!(quien.origen === "panel" && enAlcance(quien, r.empresa))) {
      const asignada = quien.idInterno && await env.DB.prepare(
        "SELECT 1 FROM evaluaciones WHERE id_proceso = ? AND id_evaluador = ? LIMIT 1").bind(id, quien.idInterno).first();
      if (!asignada) return error("Proceso no encontrado.");
    }
    return {
      status: "success",
      proceso: {
        id: s(r.id_proceso), nombre: s(r.nombre), tipo: tipoNorm(r.tipo), estatus: s(r.estatus),
        fechaIni: fechaMX(r.fecha_inicio), fechaFin: fechaMX(r.fecha_cierre), empresa: s(r.empresa),
        estructura: parse(r.estructura_json, {}),
      },
    };
  } catch (e) { return error(String(e)); }
}

// ── actualizar_proceso_eval ───────────────────────────────────
async function actualizarProcesoEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const r = await leerProceso(env, p.id);
    if (!r || !enAlcance(caller, r.empresa)) return error("Proceso no encontrado.");
    const borrador = s(r.estatus) === "Borrador";
    const sets = [], vals = [];
    if (p.nombre) { sets.push("nombre = ?"); vals.push(s(p.nombre)); }
    if (p.fechaIni) { if (!fechaValida(p.fechaIni)) return error("Fecha de inicio no válida."); sets.push("fecha_inicio = ?"); vals.push(s(p.fechaIni)); }
    if (p.fechaFin) { if (!fechaValida(p.fechaFin)) return error("Fecha de cierre no válida."); sets.push("fecha_cierre = ?"); vals.push(s(p.fechaFin)); }
    if (p.empresa !== undefined && s(p.empresa) !== s(r.empresa)) {
      if (!borrador) return error("La empresa solo se puede cambiar mientras el proceso está en Borrador.");
      const emp = await empresaCanonica(env, p.empresa);
      if (emp === null) return error(`La empresa "${s(p.empresa)}" no está en el catálogo.`);
      if (!enAlcance(caller, emp)) return error("No tienes acceso a esa empresa.");
      sets.push("empresa = ?"); vals.push(emp || null);
    }
    if (p.estructura) {
      if (!borrador) return error("Las preguntas solo se pueden editar mientras el proceso está en Borrador: ya hay evaluaciones generadas con estas preguntas.");
      if (typeof p.estructura !== "object" || !Array.isArray(p.estructura.bloques)) return error("Estructura no válida.");
      const json = JSON.stringify(p.estructura);
      if (json.length > 200000) return error("La estructura es demasiado grande.");
      sets.push("estructura_json = ?"); vals.push(json);
    }
    if (sets.length) {
      await env.DB.prepare(`UPDATE procesos_eval SET ${sets.join(", ")} WHERE id_proceso = ?`).bind(...vals, s(r.id_proceso)).run();
      await registrarEvento(env, caller.email, caller.rol, "EDITAR_PROCESO_EVAL", "Editó proceso " + r.id_proceso, s(r.empresa), "");
    }
    return { status: "success", message: "Proceso actualizado." };
  } catch (e) { return error(String(e)); }
}

// ── activar_proceso_eval: genera las evaluaciones individuales ─
async function activarProcesoEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const proc = await leerProceso(env, p.id);
    if (!proc || !enAlcance(caller, proc.empresa)) return error("Proceso no encontrado.");
    const id = s(proc.id_proceso), tipo = tipoNorm(proc.tipo);
    if (proc.estatus === "Activo") return error("El proceso ya está activo.");
    if (proc.estatus !== "Borrador") return error("Solo se puede activar un proceso en Borrador (este está " + s(proc.estatus) + ").");

    const { results: activos } = await env.DB.prepare(
      `SELECT v.id_interno, v.nombre, v.empresa, v.jefe_directo FROM v_empleados v JOIN empleados e ON e.id_interno = v.id_interno
        WHERE v.estatus = 'Activo' ORDER BY COALESCE(e.fila_sheet_origen, 999999999), e.rowid`
    ).all();
    const idsActivos = new Set(activos.map(e => s(e.id_interno)));
    const kEmp = clave(proc.empresa);
    const participantes = activos.filter(e => s(e.id_interno) && (!kEmp || clave(e.empresa) === kEmp));
    if (!participantes.length) return error("No hay empleados que coincidan.");

    const { results: ya } = await env.DB.prepare("SELECT id_evaluado, rol_evaluador FROM evaluaciones WHERE id_proceso = ?").bind(id).all();
    const existe = new Set(ya.map(x => s(x.id_evaluado) + "|" + s(x.rol_evaluador)));
    const conAuto = tipo === "360" || tipo === "competencias";
    let n = await siguienteId(env, "evaluaciones", "id_eval", "EV", 5);
    const filas = [];
    let sinJefe = 0;
    for (const e of participantes) {
      const idE = s(e.id_interno), jefe = s(e.jefe_directo);
      // Jefe evalúa al colaborador (todos los tipos) — solo si el jefe existe y está activo
      if (jefe && jefe !== idE && idsActivos.has(jefe)) {
        if (!existe.has(idE + "|jefe")) filas.push([idE, s(e.nombre), jefe, "jefe"]);
      } else sinJefe++;
      // Autoevaluación (360 y competencias)
      if (conAuto && !existe.has(idE + "|autoevaluacion")) filas.push([idE, s(e.nombre), idE, "autoevaluacion"]);
    }
    if (!filas.length) return error("No se generó ninguna evaluación: ningún colaborador tiene jefe directo activo. Asigna jefes directos en Mi Organización antes de activar.");

    // Inserción en bloques (límite de D1: 100 KB por sentencia). Todo va en UNA
    // transacción y cada bloque solo se inserta si el proceso sigue en Borrador:
    // si dos personas dan "Activar" al mismo tiempo, la segunda no duplica nada.
    const stmts = [];
    for (let i = 0; i < filas.length; i += 150) {
      const valores = filas.slice(i, i + 150).map(f =>
        `(${literal("EV" + conCeros(n++, 5))},${literal(id)},${literal(f[0])},${literal(f[1])},${literal(f[2])},${literal(f[3])})`
      ).join(",");
      stmts.push(env.DB.prepare(
        `INSERT INTO evaluaciones (id_eval, id_proceso, id_evaluado, nombre_evaluado, id_evaluador, rol_evaluador, estatus)
         SELECT column1, column2, column3, column4, column5, column6, 'Pendiente' FROM (VALUES ${valores})
          WHERE EXISTS (SELECT 1 FROM procesos_eval WHERE id_proceso = ? AND estatus = 'Borrador')`).bind(id));
    }
    stmts.push(env.DB.prepare("UPDATE procesos_eval SET estatus = 'Activo' WHERE id_proceso = ? AND estatus = 'Borrador'").bind(id));
    const res = await env.DB.batch(stmts);
    if (!res[res.length - 1].meta || res[res.length - 1].meta.changes !== 1) return error("El proceso ya está activo.");

    const aviso = sinJefe ? ` ${sinJefe} colaborador(es) sin jefe directo activo: no se les generó evaluación de jefe (revisa Mi Organización).` : "";
    await registrarEvento(env, caller.email, caller.rol, "ACTIVAR_PROCESO_EVAL",
      "Activó proceso " + id + ". " + filas.length + " evaluaciones generadas." + (sinJefe ? " Sin jefe activo: " + sinJefe + "." : ""), s(proc.empresa), "");
    return {
      status: "success",
      message: "Proceso activado. " + filas.length + " evaluaciones generadas para " + participantes.length + " colaboradores." + aviso,
      evaluaciones: filas.length,
      sinJefe,
    };
  } catch (e) { return error(String(e)); }
}

// ── cerrar_proceso_eval ───────────────────────────────────────
async function cerrarProcesoEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const r = await leerProceso(env, p.id);
    if (!r || !enAlcance(caller, r.empresa)) return error("Proceso no encontrado.");
    if (r.estatus === "Cerrado") return { status: "success", message: "Proceso cerrado." };
    await env.DB.prepare("UPDATE procesos_eval SET estatus = 'Cerrado' WHERE id_proceso = ?").bind(s(r.id_proceso)).run();
    const pend = await env.DB.prepare("SELECT COUNT(*) AS n FROM evaluaciones WHERE id_proceso = ? AND estatus <> 'Completada'").bind(s(r.id_proceso)).first();
    await registrarEvento(env, caller.email, caller.rol, "CERRAR_PROCESO_EVAL",
      "Cerró proceso " + r.id_proceso + (pend && pend.n ? ` con ${pend.n} evaluaciones pendientes.` : "."), s(r.empresa), "");
    return { status: "success", message: "Proceso cerrado." };
  } catch (e) { return error(String(e)); }
}

// ID del colaborador sobre el que se pregunta: el del token. El Administrador
// puede consultar a otra persona pasando su ID.
function idConsultado(quien, pedido) {
  pedido = s(pedido);
  return quien.esAdmin && pedido ? pedido : quien.idInterno;
}

// ── listar_mis_eval: como evaluador y como evaluado ───────────
async function listarMisEvaluaciones(p, env) {
  const quien = await identidadPorToken(env, p.token);
  if (!quien) return SESION_INVALIDA;                                // GAS lo dejaba abierto
  const idUsuario = idConsultado(quien, p.idEvaluador || p.idUsuario);
  if (!idUsuario) return error(quien.origen === "panel" ? "Tu usuario no tiene ID INTERNO asignado." : "ID requerido.");
  try {
    const { results } = await env.DB.prepare(
      `SELECT e.*, p.estatus AS estatus_proceso, p.nombre AS nombre_proceso FROM evaluaciones e LEFT JOIN procesos_eval p ON p.id_proceso = e.id_proceso
        WHERE e.id_evaluador = ?1 OR e.id_evaluado = ?1 ORDER BY e.id`
    ).bind(idUsuario).all();
    const evaluaciones = [], comoEvaluado = [];
    for (const r of results) {
      const base = {
        id: s(r.id_eval), idProceso: s(r.id_proceso), idEvaluado: s(r.id_evaluado), nombreEvaluado: s(r.nombre_evaluado),
        idEvaluador: s(r.id_evaluador), rolEvaluador: s(r.rol_evaluador), estatus: s(r.estatus),
        fechaComp: s(r.fecha_completada), estatusProceso: s(r.estatus_proceso), nombreProceso: s(r.nombre_proceso),
      };
      // Yo debo llenar este formulario: veo mis propias respuestas
      if (base.idEvaluador === idUsuario) evaluaciones.push({ ...base, respuestas: parse(r.respuestas_json, {}), perspectiva: "evaluador" });
      // Alguien me evalúa: solo el avance. Sin las respuestas de mi jefe/pares
      // (GAS las mandaba al navegador aunque la pantalla no las mostrara) y sin
      // decir qué par o subordinado me evalúa.
      if (base.idEvaluado === idUsuario && base.idEvaluador !== idUsuario) {
        const anonimo = base.rolEvaluador === "par" || base.rolEvaluador === "subordinado";
        comoEvaluado.push({ ...base, idEvaluador: anonimo ? "" : base.idEvaluador, respuestas: {}, perspectiva: "evaluado" });
      }
    }
    return { status: "success", evaluaciones, comoEvaluado };
  } catch (e) { return error(String(e)); }
}

// ── listar_equipo_eval: evaluaciones de mis reportes directos ─
async function listarEquipoEval(p, env) {
  const quien = await identidadPorToken(env, p.token);
  if (!quien) return SESION_INVALIDA;
  const idJefe = idConsultado(quien, p.idJefe);
  if (!idJefe) return error("ID requerido.");
  try {
    const { results } = await env.DB.prepare(
      "SELECT e.*, p.nombre AS nombre_proceso FROM evaluaciones e LEFT JOIN procesos_eval p ON p.id_proceso = e.id_proceso WHERE e.id_evaluador = ? AND e.rol_evaluador = 'jefe' ORDER BY e.id"
    ).bind(idJefe).all();
    return {
      status: "success",
      equipo: results.map(r => ({
        id: s(r.id_eval), idProceso: s(r.id_proceso), idEvaluado: s(r.id_evaluado), nombreEvaluado: s(r.nombre_evaluado),
        estatus: s(r.estatus), fechaComp: s(r.fecha_completada), nombreProceso: s(r.nombre_proceso),
      })),
    };
  } catch (e) { return error(String(e)); }
}

// Limpia las respuestas: claves q0, q1…; números o texto (máx. 3,000 caracteres)
function limpiarRespuestas(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj).slice(0, 500)) {
    if (!/^[A-Za-z0-9_\-]{1,40}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.trim()) out[k] = v.slice(0, 3000);
  }
  return out;
}

// ── guardar_eval ──────────────────────────────────────────────
async function guardarEvaluacion(p, env) {
  const quien = await identidadPorToken(env, p.token);
  if (!quien) return SESION_INVALIDA;                                // GAS lo dejaba abierto
  const idEval = s(p.idEval);
  if (!idEval) return error("Evaluación no encontrada.");
  try {
    // id_eval puede repetirse en datos viejos (EV00005): se ubica por ID + evaluador
    const r = await env.DB.prepare(
      `SELECT e.id, e.estatus, e.id_proceso, p.estatus AS estatus_proceso FROM evaluaciones e
         LEFT JOIN procesos_eval p ON p.id_proceso = e.id_proceso
        WHERE e.id_eval = ? AND e.id_evaluador = ? ORDER BY e.id LIMIT 1`
    ).bind(idEval, quien.idInterno).first();
    if (!r) {
      const otra = await env.DB.prepare("SELECT 1 FROM evaluaciones WHERE id_eval = ? LIMIT 1").bind(idEval).first();
      return error(otra ? "Esta evaluación no está asignada a ti." : "Evaluación no encontrada.");
    }
    if (r.estatus_proceso !== "Activo") return error("El proceso de evaluación ya no está activo: no se pueden enviar evaluaciones.");
    if (r.estatus === "Completada") return error("Esta evaluación ya fue enviada.");
    const resp = limpiarRespuestas(p.respuestas);
    const u = await env.DB.prepare(
      "UPDATE evaluaciones SET estatus = 'Completada', fecha_completada = ?, respuestas_json = ? WHERE id = ? AND estatus <> 'Completada'"
    ).bind(ahoraISO(), JSON.stringify(resp), r.id).run();
    if (!u.meta || u.meta.changes !== 1) return error("Esta evaluación ya fue enviada.");
    await registrarEvento(env, quien.email, quien.rol, "COMPLETAR_EVAL", "Envió evaluación " + idEval + " (" + r.id_proceso + ")", "", "");
    return { status: "success", message: "Evaluación guardada." };
  } catch (e) { return error(String(e)); }
}

// ── resultados_eval ───────────────────────────────────────────
async function resultadosEval(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;                               // GAS lo dejaba abierto
  try {
    const proc = await leerProceso(env, p.idProceso);
    if (!proc || !enAlcance(caller, proc.empresa)) return error("Proceso no encontrado.");
    const { results } = await env.DB.prepare("SELECT * FROM evaluaciones WHERE id_proceso = ? ORDER BY id").bind(s(proc.id_proceso)).all();
    const evaluaciones = results.map(r => ({
      id: s(r.id_eval), idEvaluado: s(r.id_evaluado), nombre: s(r.nombre_evaluado), rol: s(r.rol_evaluador),
      estatus: s(r.estatus), respuestas: parse(r.respuestas_json, {}),
      fechaComp: s(r.fecha_completada),        // la tabla del informe ya tenía columna Fecha, pero GAS no la mandaba
      idEvaluador: s(r.id_evaluador),
    }));
    const completadas = evaluaciones.filter(e => e.estatus === "Completada").length;
    return { status: "success", total: evaluaciones.length, completadas, pendientes: evaluaciones.length - completadas, evaluaciones };
  } catch (e) { return error(String(e)); }
}

export default {
  crear_proceso_eval: crearProcesoEval,
  listar_procesos_eval: listarProcesosEval,
  obtener_proceso_eval: obtenerProcesoEval,
  actualizar_proceso_eval: actualizarProcesoEval,
  activar_proceso_eval: activarProcesoEval,
  cerrar_proceso_eval: cerrarProcesoEval,
  listar_mis_eval: listarMisEvaluaciones,
  listar_equipo_eval: listarEquipoEval,
  guardar_eval: guardarEvaluacion,
  resultados_eval: resultadosEval,
};
