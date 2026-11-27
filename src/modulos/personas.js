// ============================================================
//  Módulo PERSONAS — directorio, organigrama, historial de carrera
//  Port de Código.gs: obtenerDirectorio, obtenerOrganigrama,
//  obtenerHistorialPersona, registrarMovimiento, migrarHistorialInicial,
//  setupColumnasNuevas
// ============================================================
import { s, ok, error } from "../lib/util.js";
import { requiereSesionValida, registrarEvento } from "../lib/sesion.js";
import { URL_EXPEDIENTE_SQL } from "../lib/columnas.js";
import { origen } from "../lib/archivos.js";

const SESION_INVALIDA = { status: "error", message: "Sesión inválida o expirada." };

// "2026-11-27" → "27/11/2026" (el frontend recibía así las fechas del historial)
function ddmmaaaa(iso) {
  const v = s(iso);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

async function directorio(env, ctx) {
  // Mismo criterio que GAS: todas las filas con NO. EMPLEADO, en el orden del Sheet
  const { results } = await env.DB.prepare(
    `SELECT v.id_interno, v.no_empleado, v.nombre, v.empresa, v.puesto, v.departamento, v.estatus,
            v.telefono, v.correo, v.jefe_directo, v.correo_acceso, ${URL_EXPEDIENTE_SQL} AS url_exp
     FROM v_empleados v JOIN empleados e ON e.id_interno = v.id_interno
     WHERE TRIM(COALESCE(CAST(v.no_empleado AS TEXT),'')) <> ''
     ORDER BY COALESCE(e.fila_sheet_origen, 999999999), e.rowid`
  ).bind(origen(ctx)).all();
  return results.map(r => ({
    idInterno: s(r.id_interno), noEmpleado: s(r.no_empleado), nombre: s(r.nombre), empresa: s(r.empresa),
    puesto: s(r.puesto), depto: s(r.departamento), estatus: s(r.estatus), telefono: s(r.telefono),
    email: s(r.correo), jefe: s(r.jefe_directo), correoAcce: s(r.correo_acceso), urlExp: s(r.url_exp),
  }));
}

// ── obtener_directorio ────────────────────────────────────────
async function obtenerDirectorio(p, env, ctx) {
  if (!(await requiereSesionValida(env, p))) return SESION_INVALIDA;     // GAS lo dejaba abierto
  try {
    const lista = await directorio(env, ctx);
    return ok({ empleados: lista, total: lista.length });
  } catch (e) { return error(String(e)); }
}

// ── obtener_organigrama (árbol por jefe directo) ──────────────
async function obtenerOrganigrama(p, env, ctx) {
  if (!(await requiereSesionValida(env, p))) return SESION_INVALIDA;
  try {
    const empleados = await directorio(env, ctx);
    const mapa = {};
    empleados.forEach(e => { if (e.idInterno) mapa[e.idInterno] = e; e.children = []; e.nivel = 0; });
    // Evita ciclos (A jefe de B y B jefe de A): en GAS rompían la respuesta
    const creaCiclo = (hijo, jefeId) => {
      let actual = jefeId, pasos = 0;
      while (actual && pasos++ < 1000) {
        if (actual === hijo.idInterno) return true;
        const j = mapa[actual];
        actual = j && j._jefeAsignado ? j._jefeAsignado : null;
      }
      return false;
    };
    const raices = [];
    for (const e of empleados) {
      if (e.jefe && mapa[e.jefe] && e.jefe !== e.idInterno && !creaCiclo(e, e.jefe)) {
        mapa[e.jefe].children.push(e);
        e._jefeAsignado = e.jefe;
      } else raices.push(e);
    }
    empleados.forEach(e => { delete e._jefeAsignado; });
    return ok({ arbol: raices, total: empleados.length });
  } catch (e) { return error(String(e)); }
}

// ── obtener_historial_persona ─────────────────────────────────
async function obtenerHistorialPersona(p, env) {
  if (!(await requiereSesionValida(env, p))) return SESION_INVALIDA;     // GAS lo dejaba abierto
  try {
    const idPersona = s(p.idPersona);
    if (!idPersona) return error("Falta idPersona");
    const h = await env.DB.prepare("SELECT * FROM historial WHERE id_persona = ? ORDER BY id").bind(idPersona).all();
    const m = await env.DB.prepare("SELECT * FROM movimientos WHERE id_persona = ? ORDER BY id").bind(idPersona).all();
    return ok({
      historial: h.results.map(r => ({
        idPersona: s(r.id_persona), curp: s(r.curp), nombre: s(r.nombre), empresa: s(r.empresa), puesto: s(r.puesto),
        departamento: s(r.departamento), sueldo: r.sueldo_mensual ?? "", fechaIngreso: ddmmaaaa(r.fecha_ingreso),
        fechaBaja: ddmmaaaa(r.fecha_baja), tipoSalida: s(r.tipo_salida), motivoSalida: s(r.motivo_salida),
        montoFiniquito: r.monto_finiquito ?? "", grupoComercial: s(r.grupo_comercial), tipoIngreso: s(r.tipo_ingreso),
        noEmpleado: s(r.no_empleado_historico),
      })),
      movimientos: m.results.map(r => ({
        fecha: ddmmaaaa(r.fecha), tipo: s(r.tipo), descripcion: s(r.descripcion), valorAntes: s(r.valor_antes),
        valorDespues: s(r.valor_despues), registradoPor: s(r.registrado_por),
      })),
    });
  } catch (e) { return error(String(e)); }
}

// ── registrar_movimiento ──────────────────────────────────────
async function registrarMovimiento(p, env) {
  const usuario = await requiereSesionValida(env, p);                    // GAS no pedía sesión
  if (!usuario) return SESION_INVALIDA;
  try {
    const idPersona = s(p.idPersona), tipo = s(p.tipo);
    if (!idPersona || !tipo) return error("Faltan datos del movimiento");
    // Fecha efectiva enviada por el frontend (AAAA-MM-DD); si no llega, hoy en hora de México
    const f = s(p.fecha);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO movimientos (id_persona, fecha, tipo, descripcion, valor_antes, valor_despues, registrado_por) VALUES (?,?,?,?,?,?,?)"
    ).bind(idPersona, fecha, tipo, s(p.descripcion), s(p.valorAntes), s(p.valorDespues), s(p.registradoPor) || usuario.email).run();
    await registrarEvento(env, usuario.email, usuario.rol, "MOVIMIENTO", `${idPersona}: ${tipo} ${s(p.valorAntes)} → ${s(p.valorDespues)}`, "", "");
    return ok({ message: "Movimiento registrado" });
  } catch (e) { return error(String(e)); }
}

// ── Utilidades de configuración de una sola vez en GAS ────────
// Ya se aplicaron al migrar: ID_PERSONA viene asignado y el HISTORIAL se cargó.
const migrarHistorialInicial = async () => ok({ message: "Migración completada. El historial ya está en la base de datos." });
const setupColumnas = async () => ok({ message: "Las columnas ya existen en la base de datos." });

export default {
  obtener_directorio: obtenerDirectorio,
  obtener_organigrama: obtenerOrganigrama,
  obtener_historial_persona: obtenerHistorialPersona,
  registrar_movimiento: registrarMovimiento,
  migrar_historial_inicial: migrarHistorialInicial,
  setup_columnas: setupColumnas,
};
