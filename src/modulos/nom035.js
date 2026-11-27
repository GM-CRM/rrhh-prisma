// ============================================================
//  Módulo NOM-035-STPS-2018
//  Port de NOM035.gs: obtenerEstructuraNOM035ParaEmpleado,
//  obtenerGuiaVNOM035, guardarRespuestaNOM035, resultadosNOM035,
//  datosTrabajadorNOM035, guardarConfigNOM035, generarInforme77,
//  listarCentrosNOM035, vencimientosNOM035
//  + nuevas: anular_respuesta_nom035 (F23), guardar_centro_nom035,
//    restablecer_config_nom035
//
//  La calificación es la de GAS sin cambios (src/lib/nom035_datos.js).
//  Correcciones (F21, F31–F36 del inventario):
//   · Las 3 acciones públicas exigen No. + nombre que correspondan al ID
//     y registro Activo (antes bastaba un ID: CIT1, CIT2… para ver datos
//     personales o guardar a nombre de otro).
//   · Categoría, dominio y dirección de cada ítem salen del servidor;
//     del navegador solo se toma la respuesta 0–4.
//   · Respuestas anuladas fuera de todo (resultados, informe, ficha,
//     vencimientos, expediente).
//   · Los filtros del tablero (año, mes, empresa, grupo, guía) ahora sí
//     se aplican; GAS los recibía y los ignoraba.
//   · vencimientos_nom035 nunca funcionó en GAS (hoja inexistente).
//   · Usuarios con empresas asignadas solo ven lo de sus empresas.
//   · Informe 7.7: Word (.docx) archivado en R2 en vez de Google Docs.
// ============================================================
import { s, ahoraISO, normalizar, ok, error } from "../lib/util.js";
import { autenticarRequest, registrarEvento } from "../lib/sesion.js";
import { coincideNombre } from "./encuestas.js";
import { urlFirmada, limpiarRuta } from "../lib/archivos.js";
import { DocumentoWord, MIME_DOCX } from "../lib/docx.js";
import * as N from "../lib/nom035_datos.js";

const SESION_INVALIDA = { status: "error", message: "Sesion invalida." };
const NIVELES = ["Nulo", "Bajo", "Medio", "Alto", "Muy alto"];
const parse = (t, d) => { try { return JSON.parse(t || ""); } catch (e) { return d; } };
const grupoNorm = g => s(g).toUpperCase().replace(/\s+/g, " ").trim();
const clave = t => normalizar(t).replace(/[^a-z0-9]/g, "");
const numNorm = v => { v = s(v); return /^\d+(\.0+)?$/.test(v) ? String(parseInt(v, 10)) : v; };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mx = d => new Date(d.getTime() - 6 * 3600 * 1000);
// Las llaves de dominio/categoría van sin acentos (así las guarda la calificación);
// en el informe se muestran bien escritas.
const ETIQUETA = { "Interferencia en la relacion trabajo-familia": "Interferencia en la relación trabajo-familia",
  "Organizacion del tiempo de trabajo": "Organización del tiempo de trabajo", "Reconocimiento del desempeno": "Reconocimiento del desempeño" };
const etiqueta = k => ETIQUETA[k] || k;            // hora de la Ciudad de México
const fechaLarga = d => { const m = mx(d); return m.getUTCDate() + " de " + MESES[m.getUTCMonth()] + " de " + m.getUTCFullYear(); };
const fechaCorta = d => mx(d).toISOString().slice(0, 10);

async function panel(env, p) {
  const c = await autenticarRequest(env, p);
  if (c) c.empresas = c.empresas.filter(Boolean);
  return c;
}
// Grupos comerciales que puede ver un usuario limitado a ciertas empresas (null = todos)
async function gruposPermitidos(env, caller) {
  if (!caller.empresas.length) return null;
  const { results } = await env.DB.prepare("SELECT empresa, grupo_comercial FROM empresas").all();
  const mias = new Set(caller.empresas.map(clave));
  return new Set(results.filter(r => mias.has(clave(r.empresa))).map(r => grupoNorm(r.grupo_comercial)));
}
const empresaPermitida = (caller, empresa) => !caller.empresas.length || caller.empresas.some(e => clave(e) === clave(empresa));

// ── Identidad del trabajador en las acciones públicas (nom035.html) ──
// Desde el panel (vista previa del editor) basta la sesión. Desde la página
// pública, el No. y el nombre que escribió la persona tienen que corresponder
// al ID INTERNO que se manda, y el registro debe estar Activo.
async function verificarTrabajador(env, p) {
  const idInterno = s(p.idInterno);
  if (!idInterno) return { error: "Se requiere idInterno." };
  const emp = await env.DB.prepare(
    `SELECT id_interno, nombre, no_empleado, estatus, empresa, grupo_comercial, genero, estado_civil, escolaridad,
            tipo_contrato, puesto, departamento, edad, fecha_ingreso FROM v_empleados WHERE id_interno = ?`
  ).bind(idInterno).first();
  if (!emp) return { error: "Empleado no encontrado" };
  if (await panel(env, p)) return { emp };
  if (!s(p.noEmpleado) || !s(p.nombre)) return { error: "Vuelve a escribir tu número de empleado y tu nombre para continuar." };
  if (numNorm(emp.no_empleado) !== numNorm(p.noEmpleado) || !coincideNombre(p.nombre, emp.nombre))
    return { error: "Los datos no coinciden con el registro. Vuelve a escribir tu número de empleado y tu nombre." };
  if (emp.estatus !== "Activo") return { error: "Tu registro aparece dado de baja. Si sigues laborando, acude a Recursos Humanos." };
  return { emp };
}

// Grupo, activos y guía que le toca (mismo criterio que _nom035ContextoEmpleado)
async function contexto(env, emp) {
  const grupo = s(emp.grupo_comercial);
  const { results } = await env.DB.prepare(
    "SELECT grupo_comercial AS g, COUNT(*) AS n FROM v_empleados WHERE estatus = 'Activo' GROUP BY grupo_comercial").all();
  const activos = results.filter(r => grupoNorm(r.g) === grupoNorm(grupo)).reduce((a, r) => a + r.n, 0);
  return {
    empresa: s(emp.empresa), grupo, activos,
    aplicaFRP: activos >= N.NOM035_MIN_TRABAJADORES_FRP,
    tipoCuestionario: activos <= 50 ? "guia2" : "guia3",
  };
}

// Cuestionario editado desde el panel (si existe) o el oficial
async function cuestionarioFRP(env, tipo) {
  try {
    const r = await env.DB.prepare("SELECT valor FROM _config WHERE clave = ?").bind("nom035_cfg_" + tipo).first();
    const j = r && parse(r.valor, null);
    if (j && Array.isArray(j.items) && j.items.length) return j;
  } catch (e) { /* _config aún no existe */ }
  return N._nom035CuestionarioDefault(tipo);
}

// ── obtener_estructura_nom035 (pública) ───────────────────────
async function obtenerEstructura(p, env) {
  try {
    const v = await verificarTrabajador(env, p);
    if (v.error) return error(v.error);
    const ctx = await contexto(env, v.emp);
    const base = {
      status: "success", version: "cf-2026-11-27", idInterno: s(v.emp.id_interno),
      empresa: ctx.empresa, grupoComercial: ctx.grupo, activosGrupo: ctx.activos, aplicaFRP: ctx.aplicaFRP,
      guia1: N.NOM035_GUIA1,
      escala: N.NOM035_ESCALA.map(e => ({ valor: e.valor, etiqueta: e.etiqueta })),
      colores: N.NOM035_COLORES, planAccionTextos: N.NOM035_PLAN_ACCION,
    };
    if (!ctx.aplicaFRP) {
      base.tipoCuestionario = "no_aplica";
      base.cuestionarioFRP = { titulo: "", descripcion: "", totalItems: 0, items: [] };
      base.mensajeFRP = "Este centro de trabajo tiene " + ctx.activos +
        " trabajadores. La NOM-035 no requiere cuestionario de factores de riesgo psicosocial para centros de hasta 15.";
      return base;
    }
    base.tipoCuestionario = ctx.tipoCuestionario;
    base.cuestionarioFRP = await cuestionarioFRP(env, ctx.tipoCuestionario);
    return base;
  } catch (e) { return error(String(e)); }
}

// ── obtener_guia_v_nom035 (pública): ficha + prellenado ───────
async function obtenerGuiaV(p, env) {
  try {
    const v = await verificarTrabajador(env, p);
    if (v.error) return error(v.error);
    const e = v.emp, out = {};
    out.sexo = N._nom035NormalizarValor("sexo", s(e.genero));
    out.estadoCivil = N._nom035NormalizarValor("estadoCivil", s(e.estado_civil));
    out.nivelEstudios = N._nom035NormalizarValor("nivelEstudios", s(e.escolaridad));
    out.tipoContratacion = N._nom035NormalizarValor("tipoContratacion", s(e.tipo_contrato));
    out.puesto = s(e.puesto);
    out.departamento = s(e.departamento);
    out.rangoEdad = N._nom035RangoEdad(e.edad);
    if (s(e.fecha_ingreso)) out.tiempoPuesto = N._nom035RangoAntiguedad(s(e.fecha_ingreso).slice(0, 10));
    return { status: "success", guiaV: N.NOM035_GUIAV, prellenado: out };
  } catch (err) { return error(String(err)); }
}

// ── guardar_respuesta_nom035 (pública) ────────────────────────
const CAMPOS_GV = ["sexo", "rangoEdad", "estadoCivil", "nivelEstudios", "estudiosEstatus", "puesto", "departamento",
  "tipoPuesto", "tipoContratacion", "tipoPersonal", "tipoJornada", "rotacionTurnos", "tiempoPuesto", "tiempoExperiencia"];
const COLS_GV = ["sexo", "rango_edad", "estado_civil", "nivel_estudios", "estudios_estatus", "puesto", "departamento",
  "tipo_puesto", "tipo_contratacion", "tipo_personal", "tipo_jornada", "rotacion_turnos", "tiempo_puesto", "tiempo_experiencia"];

function limpiarGI(r) {
  const out = {};
  if (r && typeof r === "object") for (const [k, v] of Object.entries(r)) if (/^s[1-4]_\d{1,2}$/.test(k) && v != null) out[k] = String(v).slice(0, 20);
  return out;
}

async function guardarRespuesta(p, env) {
  try {
    const v = await verificarTrabajador(env, p);
    if (v.error) return error(v.error);
    const idInterno = s(v.emp.id_interno);
    const ctx = await contexto(env, v.emp);
    const tipoGuia = ctx.tipoCuestionario;                 // la guía la decide el servidor, no el navegador
    const respGI = limpiarGI(p.respuestasGI);
    const f = p.filtros || {};
    const boolATexto = x => x === true ? "SI" : (x === false ? "NO" : "");
    const rGI = N._nom035CalificarGuia1(respGI);
    const fecha = ahoraISO();

    let rFRP = null, items = [], itemsAplicables = 0, itemsTotales = 0, ajuste = "N/A", tipoFila = "no_aplica";
    if (ctx.aplicaFRP) {
      // De cada ítem el navegador solo aporta la respuesta (0–4); categoría,
      // dominio y dirección salen de la definición oficial del servidor.
      const cuest = await cuestionarioFRP(env, tipoGuia);
      const def = new Map((cuest.items || []).map(it => [Number(it.item), it]));
      const vistos = new Set();
      for (const it of Array.isArray(p.respuestasFRP) ? p.respuestasFRP : []) {
        const d = def.get(Number(it && it.item)), r = parseInt(it && it.respuesta, 10);
        if (!d || isNaN(r) || r < 0 || r > 4 || vistos.has(d.item)) continue;
        vistos.add(d.item);
        items.push({ item: d.item, categoria: d.categoria, dominio: d.dominio, direccion: d.direccion, respuesta: r });
      }
      rFRP = N._nom035CalificarGuiaFRP(items, tipoGuia);
      itemsAplicables = rFRP.itemsRespondidos || 0;
      itemsTotales = rFRP.itemsEsperados || 0;
      ajuste = rFRP.rangoAjustado ? "SI" : "NO";
      tipoFila = tipoGuia;
    }

    const stmts = [env.DB.prepare(
      `INSERT INTO nom035_respuestas (fecha, id_interno, tipo_guia, activos_grupo, gi_requiere_valoracion, gi_motivo,
         gi_respuestas_json, frp_puntaje_total, frp_nivel_total, frp_dominios_json, frp_categorias_json, frp_respuestas_json,
         plan_accion, filtro_clientes, filtro_jefe, items_aplicables, items_totales, ajuste_rango)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(fecha, idInterno, tipoFila, ctx.activos || null, rGI.requiereValoracion ? "SI" : "NO", rGI.motivo,
      JSON.stringify(respGI), rFRP ? rFRP.totalPuntaje : null, rFRP ? rFRP.nivelTotal : null,
      rFRP ? JSON.stringify(rFRP.dominios) : null, rFRP ? JSON.stringify(rFRP.categorias) : null, JSON.stringify(items),
      rFRP ? (rFRP.planAccion || "") : null, boolATexto(f.clientes), boolATexto(f.jefe), itemsAplicables, itemsTotales, ajuste)];

    // Guía V (ficha del trabajador): misma fecha que la respuesta, así quedan ligadas
    const datos = p.datosTrabajador && typeof p.datosTrabajador === "object" ? p.datosTrabajador : {};
    if (Object.keys(datos).length) {
      const corr = Array.isArray(p.camposCorregidos) ? p.camposCorregidos.map(x => s(x).slice(0, 40)).filter(Boolean).slice(0, 20) : [];
      stmts.push(env.DB.prepare(
        `INSERT INTO nom035_datos_trabajador (fecha, id_interno, grupo_comercial, ${COLS_GV.join(", ")}, prellenados_corregidos)
         VALUES (?,?,?,${COLS_GV.map(() => "?").join(",")},?)`
      ).bind(fecha, idInterno, ctx.grupo || "", ...CAMPOS_GV.map(k => s(datos[k]).slice(0, 200)), corr.join(", ")));
    }
    await env.DB.batch(stmts);

    if (!ctx.aplicaFRP) return {
      status: "success",
      message: "Guía I registrada. El centro de trabajo tiene " + ctx.activos +
        " trabajadores: no requiere cuestionario de factores de riesgo psicosocial.",
      resultadoGI: rGI, resultadoFRP: null, aplicaFRP: false,
    };
    return { status: "success", message: "Respuesta NOM-035 guardada.", resultadoGI: rGI, resultadoFRP: rFRP, aplicaFRP: true };
  } catch (e) { return error(String(e)); }
}

// ── resultados_nom035 (panel) ─────────────────────────────────
// Filtros que manda el tablero: anio, mes, empresa, grupoComercial, tipoCuestionario.
async function resultados(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const idInterno = s(p.idInterno);
    const conAnuladas = p.incluirAnuladas === true && caller.esAdmin;
    const { results } = await env.DB.prepare(
      `SELECT r.id, r.fecha, r.id_interno, r.tipo_guia, r.frp_puntaje_total, r.frp_nivel_total, r.frp_dominios_json,
              r.frp_categorias_json, r.gi_requiere_valoracion, r.gi_motivo, r.plan_accion, r.anulada, r.motivo_anulacion,
              v.nombre, v.empresa, v.grupo_comercial
         FROM nom035_respuestas r LEFT JOIN v_empleados v ON v.id_interno = r.id_interno
        WHERE (?1 = '' OR r.id_interno = ?1) AND (r.anulada = 0 OR ?2 = 1)
        ORDER BY r.id`
    ).bind(idInterno, conAnuladas ? 1 : 0).all();
    const fAnio = s(p.anio), fMes = s(p.mes) ? s(p.mes).padStart(2, "0") : "", fEmp = clave(p.empresa), fGrupo = grupoNorm(p.grupoComercial), fTipo = s(p.tipoCuestionario);
    const empleados = [], dist = { "Nulo": 0, "Bajo": 0, "Medio": 0, "Alto": 0, "Muy alto": 0 };
    const domSums = {}, domCounts = {};
    for (const r of results) {
      if (!empresaPermitida(caller, r.empresa)) continue;
      const t = Date.parse(r.fecha || ""), local = isNaN(t) ? "" : mx(new Date(t)).toISOString();
      if (fAnio && local.slice(0, 4) !== fAnio) continue;
      if (fMes && local.slice(5, 7) !== fMes) continue;
      if (fEmp && clave(r.empresa) !== fEmp) continue;
      if (fGrupo && grupoNorm(r.grupo_comercial) !== fGrupo) continue;
      if (fTipo && s(r.tipo_guia) !== fTipo) continue;
      const nivel = s(r.frp_nivel_total), puntaje = parseFloat(r.frp_puntaje_total) || 0;
      const doms = parse(r.frp_dominios_json, {}) || {}, cats = parse(r.frp_categorias_json, {}) || {};
      const porDominio = {};
      Object.keys(doms).forEach(dk => {
        const dv = doms[dk], nc = N.NOM035_COLORES[dv.nivel] || {};
        porDominio[dk] = { puntaje: dv.puntaje, nivel: dv.nivel, color: nc.text || "", colorBg: nc.bg || "", colorBorde: nc.hex || "" };
        domSums[dk] = (domSums[dk] || 0) + (dv.puntaje || 0); domCounts[dk] = (domCounts[dk] || 0) + 1;
      });
      const nc = N.NOM035_COLORES[nivel] || {};
      const fila = {
        idInterno: s(r.id_interno), nombre: s(r.nombre) || s(r.id_interno), empresa: s(r.empresa), fecha: s(r.fecha),
        puntajeTotal: puntaje, nivel, color: nc.text || "", colorBg: nc.bg || "", colorBorde: nc.hex || "",
        tipoCuestionario: s(r.tipo_guia), porDominio, categorias: cats, giRequiere: s(r.gi_requiere_valoracion),
        giMotivo: s(r.gi_motivo), planAccion: s(r.plan_accion), idRespuesta: r.id,
      };
      if (conAnuladas) { fila.anulada = !!r.anulada; fila.motivoAnulacion = s(r.motivo_anulacion); }
      empleados.push(fila);
      if (dist[nivel] !== undefined && !r.anulada) dist[nivel]++;
    }
    const promediosDominio = {};
    Object.keys(domSums).forEach(dk => { promediosDominio[dk] = domCounts[dk] ? domSums[dk] / domCounts[dk] : 0; });
    return { status: "success", total: empleados.length, empleados, resultados: empleados, distribucion: dist, promediosDominio,
      colores: N.NOM035_COLORES, planAccion: N.NOM035_PLAN_ACCION };
  } catch (e) { return error(String(e)); }
}

// ── datos_trabajador_nom035 (panel): fichas de la Guía V ──────
const ENC_GV = ["FECHA", "ID_INTERNO", "GRUPO_COMERCIAL", "SEXO", "RANGO_EDAD", "ESTADO_CIVIL", "NIVEL_ESTUDIOS", "ESTUDIOS_ESTATUS",
  "PUESTO", "DEPARTAMENTO", "TIPO_PUESTO", "TIPO_CONTRATACION", "TIPO_PERSONAL", "TIPO_JORNADA", "ROTACION_TURNOS",
  "TIEMPO_PUESTO", "TIEMPO_EXPERIENCIA", "PRELLENADOS_CORREGIDOS"];
async function datosTrabajador(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const idInterno = s(p.idInterno), grupo = grupoNorm(p.grupo);
    const { results } = await env.DB.prepare(
      `SELECT d.*, v.empresa AS emp FROM nom035_datos_trabajador d LEFT JOIN v_empleados v ON v.id_interno = d.id_interno
        WHERE d.anulada = 0 AND (?1 = '' OR d.id_interno = ?1) ORDER BY d.id`
    ).bind(idInterno).all();
    const fichas = [];
    for (const r of results) {
      if (grupo && grupoNorm(r.grupo_comercial) !== grupo) continue;
      if (!empresaPermitida(caller, r.emp)) continue;
      const o = {};
      ENC_GV.forEach(k => { o[k] = s(r[k.toLowerCase()]); });
      fichas.push(o);
    }
    const campos = ["SEXO", "RANGO_EDAD", "ESTADO_CIVIL", "NIVEL_ESTUDIOS", "TIPO_PUESTO", "TIPO_CONTRATACION", "TIPO_PERSONAL",
      "TIPO_JORNADA", "ROTACION_TURNOS", "TIEMPO_PUESTO", "TIEMPO_EXPERIENCIA"];
    const agregado = {};
    campos.forEach(c => {
      agregado[c] = {};
      fichas.forEach(f => { const v = (f[c] || "Sin dato").trim() || "Sin dato"; agregado[c][v] = (agregado[c][v] || 0) + 1; });
    });
    return { status: "success", total: fichas.length, fichas, agregado };
  } catch (e) { return error(String(e)); }
}

// ── guardar_config_nom035 / restablecer_config_nom035 (panel) ─
async function guardarConfig(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  const tipoGuia = s(p.tipoGuia), est = p.estructura;
  if (!tipoGuia || !est) return error("Se requiere tipoGuia y estructura.");
  if (tipoGuia !== "guia2" && tipoGuia !== "guia3") return error("tipoGuia debe ser guia2 o guia3.");
  if (typeof est !== "object" || !Array.isArray(est.items) || !est.items.length) return error("La estructura no tiene preguntas.");
  if (est.items.some(it => !it || !Number(it.item) || !s(it.pregunta))) return error("Cada pregunta necesita número y texto.");
  const json = JSON.stringify(est);
  if (json.length > 300000) return error("La estructura es demasiado grande.");
  try {
    const k = "nom035_cfg_" + tipoGuia;
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS _config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)"),
      // Respaldo de la versión anterior (para poder regresar si alguien rompe un texto oficial)
      env.DB.prepare("INSERT OR REPLACE INTO _config (clave, valor) SELECT ? || '_anterior', valor FROM _config WHERE clave = ?").bind(k, k),
      env.DB.prepare("INSERT OR REPLACE INTO _config (clave, valor) VALUES (?, ?)").bind(k, json),
    ]);
    await registrarEvento(env, caller.email, caller.rol, "CONFIG_NOM035", "Editó el cuestionario " + tipoGuia + " (" + est.items.length + " preguntas)", "", "");
    return { status: "success", message: "Config NOM-035 guardada." };
  } catch (e) { return error(String(e)); }
}
async function restablecerConfig(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  if (!caller.esAdmin) return error("Solo el Administrador puede restablecer los cuestionarios oficiales.");
  const tipos = s(p.tipoGuia) ? [s(p.tipoGuia)] : ["guia2", "guia3"];
  try {
    for (const t of tipos) await env.DB.prepare("DELETE FROM _config WHERE clave = ?").bind("nom035_cfg_" + t).run();
    await registrarEvento(env, caller.email, caller.rol, "CONFIG_NOM035", "Restableció los textos oficiales: " + tipos.join(", "), "", "");
    return { status: "success", message: "Se restablecieron los textos oficiales del DOF." };
  } catch (e) { return error(String(e)); }
}

// ── Centros de trabajo ────────────────────────────────────────
const PEND = "[PENDIENTE: capturar en Datos del centro]";
async function leerCentro(env, grupo) {
  const { results } = await env.DB.prepare("SELECT * FROM nom035_centros").all();
  const r = results.find(x => grupoNorm(x.grupo_comercial) === grupoNorm(grupo));
  const o = {
    razonSocial: s(r && r.razon_social) || PEND, domicilio: s(r && r.domicilio) || PEND,
    actividadPrincipal: s(r && r.actividad_principal) || PEND, actividadesRealizadas: s(r && r.actividades_realizadas) || PEND,
    responsableNombre: s(r && r.responsable_nombre) || PEND, responsableCedula: s(r && r.responsable_cedula),
    responsablePuesto: s(r && r.responsable_puesto),
  };
  o.completo = ![o.razonSocial, o.domicilio, o.actividadPrincipal, o.responsableNombre].some(x => x.indexOf("[PENDIENTE") === 0);
  return o;
}

async function listarCentros(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const perm = await gruposPermitidos(env, caller);
    const [act, cen] = await env.DB.batch([
      env.DB.prepare("SELECT grupo_comercial AS g, COUNT(*) AS n FROM v_empleados WHERE estatus = 'Activo' AND TRIM(COALESCE(grupo_comercial,'')) <> '' GROUP BY grupo_comercial"),
      env.DB.prepare("SELECT * FROM nom035_centros"),
    ]);
    const cuenta = {};
    act.results.forEach(r => { const g = s(r.g); cuenta[g] = (cuenta[g] || 0) + r.n; });
    const centros = Object.keys(cuenta).sort().filter(g => !perm || perm.has(grupoNorm(g))).map(g => {
      const c = cen.results.find(x => grupoNorm(x.grupo_comercial) === grupoNorm(g)) || {};
      return {
        grupo: g, activos: cuenta[g],
        datos: {                                  // nuevo: para capturar/editar los datos del informe sin hoja de cálculo
          razonSocial: s(c.razon_social), domicilio: s(c.domicilio), actividadPrincipal: s(c.actividad_principal),
          actividadesRealizadas: s(c.actividades_realizadas), responsableNombre: s(c.responsable_nombre),
          responsableCedula: s(c.responsable_cedula), responsablePuesto: s(c.responsable_puesto),
        },
      };
    });
    return { status: "success", centros };
  } catch (e) { return error(String(e)); }
}

async function guardarCentro(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  const grupo = s(p.grupo);
  if (!grupo) return error("Se requiere el centro de trabajo.");
  const perm = await gruposPermitidos(env, caller);
  if (perm && !perm.has(grupoNorm(grupo))) return error("No tienes acceso a ese centro de trabajo.");
  const v = k => s(p[k]).slice(0, 2000) || null;
  try {
    const { results } = await env.DB.prepare("SELECT grupo_comercial FROM nom035_centros").all();
    const existente = results.find(x => grupoNorm(x.grupo_comercial) === grupoNorm(grupo));
    await env.DB.prepare(
      `INSERT INTO nom035_centros (grupo_comercial, razon_social, domicilio, actividad_principal, actividades_realizadas,
         responsable_nombre, responsable_cedula, responsable_puesto) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(grupo_comercial) DO UPDATE SET razon_social = excluded.razon_social, domicilio = excluded.domicilio,
         actividad_principal = excluded.actividad_principal, actividades_realizadas = excluded.actividades_realizadas,
         responsable_nombre = excluded.responsable_nombre, responsable_cedula = excluded.responsable_cedula,
         responsable_puesto = excluded.responsable_puesto`
    ).bind(existente ? existente.grupo_comercial : grupo, v("razonSocial"), v("domicilio"), v("actividadPrincipal"),
      v("actividadesRealizadas"), v("responsableNombre"), v("responsableCedula"), v("responsablePuesto")).run();
    await registrarEvento(env, caller.email, caller.rol, "CENTRO_NOM035", "Actualizó datos del centro " + grupo, "", "");
    return { status: "success", message: "Datos del centro guardados." };
  } catch (e) { return error(String(e)); }
}

// ── Agregado del centro para el informe 7.7 ───────────────────
// Igual que _nom035AgregarResultados: personal Activo del grupo y solo la
// respuesta MÁS RECIENTE de cada uno (sin anuladas). El conteo por categoría
// y dominio lo hace D1 con json_each (no gasta CPU del Worker).
async function agregarResultados(env, grupo) {
  const g = grupoNorm(grupo);
  const ULT = `WITH m AS (SELECT id_interno FROM v_empleados WHERE estatus = 'Activo' AND UPPER(TRIM(COALESCE(grupo_comercial,''))) = ?1),
    u AS (SELECT r.* FROM nom035_respuestas r JOIN m ON m.id_interno = r.id_interno
          WHERE r.anulada = 0 AND r.id = (SELECT r2.id FROM nom035_respuestas r2 WHERE r2.id_interno = r.id_interno AND r2.anulada = 0
                                          ORDER BY r2.fecha DESC, r2.id ASC LIMIT 1))`;
  const [a, b, c, d] = await env.DB.batch([
    env.DB.prepare(`${ULT} SELECT (SELECT COUNT(*) FROM m) AS activos`).bind(g),
    env.DB.prepare(`${ULT} SELECT u.id_interno, u.tipo_guia, u.frp_nivel_total AS nivel, u.frp_puntaje_total AS puntaje, u.gi_requiere_valoracion AS gi,
                       (SELECT MIN(id) FROM nom035_respuestas x WHERE x.id_interno = u.id_interno) AS primero FROM u ORDER BY primero`).bind(g),
    env.DB.prepare(`${ULT} SELECT j.key AS k, json_extract(j.value, '$.nivel') AS n, COUNT(*) AS c FROM u, json_each(u.frp_categorias_json) j GROUP BY k, n`).bind(g),
    env.DB.prepare(`${ULT} SELECT j.key AS k, json_extract(j.value, '$.nivel') AS n, COUNT(*) AS c FROM u, json_each(u.frp_dominios_json) j GROUP BY k, n`).bind(g),
  ]);
  const vacio = () => { const o = {}; NIVELES.forEach(n => { o[n] = 0; }); return o; };
  const filas = b.results;
  const activos = a.results[0] ? a.results[0].activos : 0, respondieron = filas.length;
  const distTotal = vacio();
  let giRequieren = 0, suma = 0;
  filas.forEach(r => {
    if (s(r.gi).toUpperCase() === "SI") giRequieren++;
    if (distTotal[s(r.nivel)] !== undefined) distTotal[s(r.nivel)]++;
    suma += parseFloat(r.puntaje) || 0;
  });
  const tipoGuia = filas.length ? s(filas[0].tipo_guia) : "";
  const orden = Object.keys((N.NOM035_RANGOS[tipoGuia] || N.NOM035_RANGOS.guia3).dominios)
    .concat(Object.keys((N.NOM035_RANGOS[tipoGuia] || N.NOM035_RANGOS.guia3).categorias));
  const agrupar = rows => {
    const o = {};
    rows.slice().sort((x, y) => (orden.indexOf(x.k) + 1 || 999) - (orden.indexOf(y.k) + 1 || 999)).forEach(r => {
      if (!o[r.k]) o[r.k] = vacio();
      if (o[r.k][r.n] !== undefined) o[r.k][r.n] += r.c;
    });
    return o;
  };
  const pct = (n, t) => t > 0 ? Math.round(n / t * 1000) / 10 : 0;
  // Nivel del centro = el más alto donde se concentre 25% o más (criterio interno documentado)
  let nivelCentro = "Nulo", acumulado = 0;
  for (let k = NIVELES.length - 1; k >= 0; k--) {
    acumulado += distTotal[NIVELES[k]];
    if (respondieron > 0 && acumulado / respondieron >= 0.25) { nivelCentro = NIVELES[k]; break; }
  }
  const distTotalPct = {};
  NIVELES.forEach(n => { distTotalPct[n] = pct(distTotal[n], respondieron); });
  return {
    activos, respondieron, cobertura: pct(respondieron, activos), tipoGuia, giRequieren,
    promedio: respondieron ? Math.round(suma / respondieron * 10) / 10 : 0,
    distTotal, distTotalPct, porCategoria: agrupar(c.results), porDominio: agrupar(d.results), nivelCentro, niveles: NIVELES,
  };
}

// ── generar_informe_77 (panel) → Word archivado en R2 ─────────
async function generarInforme77(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  const grupo = s(p.grupo);
  if (!grupo) return error("Se requiere el centro de trabajo.");
  try {
    const perm = await gruposPermitidos(env, caller);
    if (perm && !perm.has(grupoNorm(grupo))) return error("No tienes acceso a ese centro de trabajo.");
    const c = await leerCentro(env, grupo);
    const agg = await agregarResultados(env, grupo);
    if (!agg || agg.respondieron === 0) return error("No hay respuestas registradas para " + grupo + ".");

    const hoy = new Date();
    const nombreDoc = "Informe NOM-035 - " + grupo + " - " + fechaCorta(hoy);
    const esGuia3 = agg.tipoGuia === "guia3";
    const nomGuia = esGuia3 ? "Guía de Referencia III" : "Guía de Referencia II";
    const doc = new DocumentoWord();

    // Portada
    doc.titulo("INFORME DE IDENTIFICACIÓN Y ANÁLISIS DE FACTORES DE RIESGO PSICOSOCIAL" + (esGuia3 ? " Y EVALUACIÓN DEL ENTORNO ORGANIZACIONAL" : ""));
    doc.subtitulo("NOM-035-STPS-2018 · Numeral 7.7");
    doc.p("Fecha de elaboración: " + fechaLarga(hoy));
    doc.linea();
    // a) Datos del centro
    doc.h1("a) Datos del centro de trabajo");
    doc.tabla([
      ["Nombre, denominación o razón social", c.razonSocial], ["Domicilio", c.domicilio],
      ["Actividad principal", c.actividadPrincipal], ["Centro de trabajo evaluado", grupo],
      ["Número de trabajadores", String(agg.activos)],
    ], { colNegrita: true });
    // b) Objetivo
    doc.h1("b) Objetivo");
    doc.p("Identificar y analizar los factores de riesgo psicosocial presentes en el centro de trabajo" +
      (esGuia3 ? ", así como evaluar el entorno organizacional," : "") +
      " conforme a lo dispuesto por la NOM-035-STPS-2018, con el propósito de determinar el nivel de " +
      "riesgo y establecer, en su caso, las medidas de prevención y acciones de control aplicables.");
    // c) Actividades
    doc.h1("c) Principales actividades realizadas en el centro de trabajo");
    doc.p(c.actividadesRealizadas);
    // d) Método
    doc.h1("d) Método utilizado");
    doc.p("Conforme al numeral 7.4 de la Norma, se aplicó el cuestionario de la " + nomGuia + " (" + (esGuia3 ? "72" : "46") +
      " reactivos), correspondiente a centros de trabajo con " + (esGuia3 ? "más de 50" : "entre 16 y 50") + " trabajadores.");
    doc.h2("Aplicación de los cuestionarios");
    doc.vineta("Los cuestionarios se aplicaron a través de la plataforma interna RRHH Prisma, mediante un formulario digital de acceso individual.");
    doc.vineta("Se informó a cada trabajador el objetivo de la evaluación y el carácter confidencial del manejo de sus datos.");
    doc.vineta("Se indicó que no existen respuestas correctas o incorrectas y que debían considerarse las condiciones de los dos últimos meses.");
    doc.vineta("Se aplicó adicionalmente el cuestionario de la Guía de Referencia I para identificar a trabajadores sujetos a acontecimientos traumáticos severos.");
    doc.h2("Evaluación y determinación de niveles de riesgo");
    doc.vineta("Cada reactivo se calificó conforme a la " + (esGuia3 ? "Tabla 5" : "Tabla 2") + " de la Norma, respetando la dirección de puntuación de cada ítem.");
    doc.vineta("Las calificaciones se agruparon por dimensión, dominio y categoría según la " + (esGuia3 ? "Tabla 6" : "Tabla 3") + ".");
    doc.vineta("Los niveles de riesgo se determinaron con los rangos establecidos en la Norma para la calificación final, por categoría y por dominio.");
    if (N.NOM035_AJUSTAR_RANGO_PARCIAL) {
      doc.p("Criterio interno documentado: la Norma prevé bloques de reactivos condicionales " +
        "(atención a clientes y supervisión de personal) que no aplican a todos los trabajadores, " +
        "pero no establece rangos alternos para esos casos. Para no subestimar el riesgo de quien " +
        "no responde dichos bloques, los rangos del dominio afectado se ajustan proporcionalmente " +
        "al número de reactivos efectivamente aplicables.", { italic: true, size: 9 });
    }
    // e) Resultados
    doc.h1("e) Resultados obtenidos");
    doc.h2("Cobertura de la evaluación");
    doc.tabla([["Trabajadores en el centro", String(agg.activos)], ["Cuestionarios respondidos", String(agg.respondieron)],
      ["Cobertura", agg.cobertura + " %"]], { colNegrita: true });
    doc.h2("Distribución de trabajadores por nivel de riesgo");
    doc.tabla([["Nivel de riesgo", "Trabajadores", "% del total"]].concat(
      agg.niveles.map(n => [n, String(agg.distTotal[n]), agg.distTotalPct[n] + " %"])), { encabezado: true, anchoPrimera: 3600 });
    const tablaNiveles = (titulo, obj) => [[titulo].concat(agg.niveles)].concat(Object.keys(obj).map(k =>
      [etiqueta(k)].concat(agg.niveles.map(n => obj[k][n] + " (" + (agg.respondieron ? Math.round(obj[k][n] / agg.respondieron * 100) : 0) + "%)"))));
    doc.h2("Resultados por categoría");
    doc.p("Número de trabajadores en cada nivel de riesgo, por categoría:", { size: 9, italic: true });
    doc.tabla(tablaNiveles("Categoría", agg.porCategoria), { encabezado: true, tamano: 9, anchoPrimera: 3000 });
    doc.h2("Resultados por dominio");
    doc.tabla(tablaNiveles("Dominio", agg.porDominio), { encabezado: true, tamano: 9, anchoPrimera: 3000 });
    doc.h2("Guía de Referencia I · Acontecimientos traumáticos severos");
    doc.p("Trabajadores que, conforme al cuestionario, requieren valoración clínica: " + agg.giRequieren + " de " + agg.respondieron + ".");
    doc.p("Estos casos fueron canalizados de forma individual y confidencial. " +
      "Por tratarse de información de salud, no se incluyen datos identificables en el presente informe.", { size: 9, italic: true });
    // f) Conclusiones
    doc.h1("f) Conclusiones");
    doc.p("El nivel de riesgo psicosocial predominante en el centro de trabajo es: " + agg.nivelCentro.toUpperCase() + ".");
    doc.p("Criterio de determinación: se considera el nivel más alto en el que se " +
      "concentra al menos el 25% de los trabajadores evaluados. La Norma establece la calificación " +
      "por trabajador pero no define cómo resumirla a nivel de centro; este criterio se adopta y " +
      "documenta internamente para dar un tratamiento consistente.", { size: 9, italic: true });
    const domAlto = Object.keys(agg.porDominio).map(k => {
      const n = agg.porDominio[k]["Alto"] + agg.porDominio[k]["Muy alto"];
      return { nombre: etiqueta(k), pct: agg.respondieron ? Math.round(n / agg.respondieron * 100) : 0, prop: agg.respondieron ? n / agg.respondieron : 0 };
    }).filter(x => x.prop >= 0.20).sort((x, y) => y.pct - x.pct);
    if (domAlto.length) {
      doc.p("Dominios que requieren atención prioritaria (20% o más de los trabajadores en nivel Alto o Muy alto):");
      domAlto.forEach(x => doc.vineta(x.nombre + " — " + x.pct + "% de los trabajadores"));
    } else doc.p("Ningún dominio concentra al 20% o más de los trabajadores en niveles Alto o Muy alto.");
    if (agg.cobertura < 100) doc.p("Nota sobre la cobertura: se obtuvo respuesta del " + agg.cobertura +
      "% de la plantilla. Los resultados deben leerse considerando esta proporción.", { size: 9, italic: true });
    // g) Recomendaciones
    doc.h1("g) Recomendaciones y acciones de intervención");
    doc.p("Conforme a la " + (esGuia3 ? "Tabla 7" : "Tabla 4") + " de la Norma, para un nivel de riesgo " + agg.nivelCentro + " se establece:");
    doc.p(N.NOM035_PLAN_ACCION[agg.nivelCentro] || "");
    if (agg.nivelCentro === "Alto" || agg.nivelCentro === "Muy alto") {
      doc.h2("Acciones específicas requeridas");
      doc.vineta("Realizar el análisis de cada categoría y dominio para determinar las acciones de intervención apropiadas.");
      doc.vineta("Implementar un Programa de intervención" + (agg.nivelCentro === "Muy alto" ? ", que deberá incluir evaluaciones específicas." : ", que podrá incluir una evaluación específica."));
      doc.vineta("Realizar una campaña de sensibilización.");
      doc.vineta("Revisar la política de prevención de riesgos psicosociales y los programas asociados, reforzando su aplicación y difusión.");
      if (domAlto.length) doc.vineta("Priorizar la intervención en: " + domAlto.map(x => x.nombre).join("; ") + ".");
    }
    doc.h2("Seguimiento");
    const proxima = new Date(hoy.getTime()); proxima.setUTCFullYear(proxima.getUTCFullYear() + 2);
    doc.vineta("Conforme al numeral 7.9, la identificación y análisis deberá repetirse a más tardar el " + fechaLarga(proxima) + ".");
    doc.vineta("Conforme al numeral 7.8, los resultados deberán estar disponibles para consulta de los trabajadores.");
    doc.vineta("Conforme al numeral 10.4, este informe deberá conservarse al menos un año a partir de su elaboración.");
    // h) Responsable
    doc.h1("h) Datos del responsable de la evaluación");
    doc.tabla([["Nombre completo", c.responsableNombre], ["Cédula profesional", c.responsableCedula || "No aplica"],
      ["Cargo", c.responsablePuesto || "—"]], { colNegrita: true });
    doc.p("");
    doc.p("_______________________________");
    doc.p("Firma del responsable", { size: 9 });
    if (!c.completo) doc.p("ADVERTENCIA: este informe contiene campos marcados como [PENDIENTE]. " +
      "Complete los datos del centro de trabajo en RRHH Prisma y vuelva a generarlo antes de entregarlo o archivarlo.", { bold: true, color: "#b00020" });

    // Se archiva en R2 (numeral 10.4: conservar al menos un año) y se registra
    const bytes = doc.bytes();
    const marca = mx(hoy).toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
    const key = "informes/nom035/" + limpiarRuta(grupo) + "/" + marca + " " + limpiarRuta(nombreDoc) + ".docx";
    await env.R2.put(key, bytes, { httpMetadata: { contentType: MIME_DOCX } });
    await env.DB.prepare(
      `INSERT INTO archivos (id_interno, categoria, tipo_documento, r2_key, nombre_original, mime, bytes, subido_por, subido_en)
       VALUES (NULL, 'informe', 'NOM-035 7.7', ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
    ).bind(key, nombreDoc + ".docx", MIME_DOCX, bytes.length, caller.email).run();
    await registrarEvento(env, caller.email, caller.rol, "INFORME_NOM035", "Generó el informe 7.7 de " + grupo +
      " (" + agg.respondieron + " de " + agg.activos + ", nivel " + agg.nivelCentro + ")", "", "");
    return {
      status: "success", message: "Informe generado.", url: await urlFirmada(env, key, true), nombre: nombreDoc, completo: c.completo,
      resumen: { centro: grupo, activos: agg.activos, respondieron: agg.respondieron, cobertura: agg.cobertura,
        nivelCentro: agg.nivelCentro, giRequieren: agg.giRequieren },
    };
  } catch (e) { return error(String(e)); }
}

// ── vencimientos_nom035 (panel) ───────────────────────────────
// La obligación es del centro: fecha de la evaluación más reciente de cada
// grupo + 24 meses. (En GAS esta acción fallaba siempre: buscaba una hoja que
// no existe y una columna GRUPO_COMERCIAL que la hoja de respuestas no tiene.)
async function vencimientos(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const perm = await gruposPermitidos(env, caller);
    const { results } = await env.DB.prepare(
      `SELECT UPPER(TRIM(COALESCE(NULLIF(TRIM((SELECT d.grupo_comercial FROM nom035_datos_trabajador d
                WHERE d.id_interno = r.id_interno AND substr(d.fecha,1,16) = substr(r.fecha,1,16) LIMIT 1)), ''), v.grupo_comercial, ''))) AS grupo,
              MAX(r.fecha) AS ultima, COUNT(*) AS respuestas
         FROM nom035_respuestas r LEFT JOIN v_empleados v ON v.id_interno = r.id_interno
        WHERE r.anulada = 0 GROUP BY 1`
    ).all();
    const hoy = new Date();
    const grupos = results.filter(r => s(r.grupo) && (!perm || perm.has(grupoNorm(r.grupo)))).map(r => {
      const u = new Date(r.ultima);
      const limite = new Date(u.getTime()); limite.setUTCMonth(limite.getUTCMonth() + N.NOM035_MESES_VIGENCIA);
      const dias = Math.floor((limite - hoy) / 86400000);
      const estado = dias < 0 ? "vencido" : dias <= N.NOM035_DIAS_AVISO ? "porvencer" : "vigente";
      return { grupo: s(r.grupo), ultima: u.toISOString(), limite: limite.toISOString(), dias, estado, respuestas: r.respuestas };
    }).filter(g => !isNaN(g.dias)).sort((a, b) => a.dias - b.dias);
    // Nuevo: centros con personal activo y NINGUNA evaluación registrada. Antes no
    // aparecían en ningún lado (la alerta solo veía a los que ya tenían respuestas).
    const evaluados = new Set(grupos.map(g => grupoNorm(g.grupo)));
    const { results: act } = await env.DB.prepare(
      "SELECT grupo_comercial AS g, COUNT(*) AS n FROM v_empleados WHERE estatus = 'Activo' AND TRIM(COALESCE(grupo_comercial,'')) <> '' GROUP BY grupo_comercial").all();
    const cuenta = {};
    act.forEach(r => { const g = grupoNorm(r.g); cuenta[g] = (cuenta[g] || 0) + r.n; });
    const sinEvaluar = Object.keys(cuenta).filter(g => !evaluados.has(g) && (!perm || perm.has(g)))
      .map(g => ({ grupo: g, activos: cuenta[g] })).sort((a, b) => b.activos - a.activos);
    return { status: "success", hoy: hoy.toISOString(), mesesVigencia: N.NOM035_MESES_VIGENCIA, diasAviso: N.NOM035_DIAS_AVISO, grupos, sinEvaluar };
  } catch (e) { return error(String(e)); }
}

// ── anular_respuesta_nom035 (nueva, F23) ──────────────────────
// Solo Administrador. No borra: marca la respuesta (y su ficha de la Guía V)
// como anulada, con motivo, y deja registro en la Bitácora.
async function anularRespuesta(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  if (!caller.esAdmin) return error("Solo el Administrador puede anular respuestas NOM-035.");
  const id = parseInt(p.idRespuesta, 10), motivo = s(p.motivo);
  if (!id) return error("Falta la respuesta a anular.");
  if (motivo.length < 10) return error("Escribe el motivo de la anulación (mínimo 10 caracteres).");
  try {
    const r = await env.DB.prepare("SELECT id, id_interno, fecha, anulada FROM nom035_respuestas WHERE id = ?").bind(id).first();
    if (!r) return error("Respuesta no encontrada.");
    if (r.anulada) return error("Esa respuesta ya estaba anulada.");
    const en = ahoraISO(), por = caller.email, mot = motivo.slice(0, 1000);
    await env.DB.batch([
      env.DB.prepare("UPDATE nom035_respuestas SET anulada = 1, motivo_anulacion = ?, anulada_por = ?, anulada_en = ? WHERE id = ? AND anulada = 0")
        .bind(mot, por, en, id),
      env.DB.prepare(`UPDATE nom035_datos_trabajador SET anulada = 1, motivo_anulacion = ?, anulada_por = ?, anulada_en = ?
                       WHERE id_interno = ? AND substr(fecha,1,16) = substr(?,1,16) AND anulada = 0`).bind(mot, por, en, r.id_interno, r.fecha),
    ]);
    await registrarEvento(env, caller.email, caller.rol, "ANULAR_NOM035",
      "Anuló la respuesta NOM-035 #" + id + " de " + r.id_interno + " (" + s(r.fecha).slice(0, 10) + "). Motivo: " + mot, "", "");
    return { status: "success", message: "Respuesta anulada. Ya no cuenta en resultados, informe ni expediente." };
  } catch (e) { return error(String(e)); }
}

export default {
  obtener_estructura_nom035: obtenerEstructura,
  obtener_guia_v_nom035: obtenerGuiaV,
  guardar_respuesta_nom035: guardarRespuesta,
  resultados_nom035: resultados,
  datos_trabajador_nom035: datosTrabajador,
  guardar_config_nom035: guardarConfig,
  generar_informe_77: generarInforme77,
  listar_centros_nom035: listarCentros,
  vencimientos_nom035: vencimientos,
  // nuevas
  anular_respuesta_nom035: anularRespuesta,
  guardar_centro_nom035: guardarCentro,
  restablecer_config_nom035: restablecerConfig,
};
