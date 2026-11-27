// ============================================================
//  Módulo EMPLEADOS — port de Código.gs:
//  exportarDatos, registrarAlta, registrarBaja, actualizarEmpleado,
//  obtenerSiguienteNumero, importarMasivo, obtenerCatalogoEmpresas
//  Mismas acciones, payloads y respuestas que GAS.
// ============================================================
import { s, ahoraISO, ok, error } from "../lib/util.js";
import { requiereSesionValida, autenticarRequest, registrarEvento } from "../lib/sesion.js";
import { activarAccesoInterno } from "./acceso_empleados.js";
import { COLUMNAS, POR_ENCABEZADO, PROTEGIDOS, aValorD1, literal, expresionExport, URL_EXPEDIENTE_SQL } from "../lib/columnas.js";
import { urlCarpeta, origen } from "../lib/archivos.js";

const SESION_INVALIDA = { status: "error", message: "Sesión inválida o expirada." };
const BLOQUE_EXPORT = 300;          // filas por consulta (cada bloque < 2 MB)
const MAX_SQL = 60000;              // tamaño máx. de una sentencia multi-fila

// ── Helpers ───────────────────────────────────────────────────
const ARTICULOS_IGNORAR = { de: 1, del: 1, la: 1, las: 1, los: 1, y: 1, e: 1, a: 1, sa: 1, sap: 1, srl: 1, sc: 1 };

function generarSiglas(nombreEmpresa) {
  if (!nombreEmpresa) return "EMP";
  const palabras = nombreEmpresa.toUpperCase().split(/\s+/).filter(p => p.length > 0 && !ARTICULOS_IGNORAR[p.toLowerCase()]);
  if (!palabras.length) return "EMP";
  let siglas = palabras.map(p => p.charAt(0)).join("");
  if (siglas.length === 1) siglas = palabras[0].substring(0, 3);
  return siglas;
}

// Igual que obtenerMapaSiglas + generarSiguienteID de GAS
async function generarSiguienteID(env, empresa, extraUsados) {
  const { results } = await env.DB.prepare("SELECT id_interno, empresa FROM empleados").all();
  const mapa = {};
  for (const r of results) {
    const m = s(r.id_interno).match(/^([A-Z]+)(\d+)$/);
    const emp = s(r.empresa);
    if (!m || !emp) continue;
    const num = parseInt(m[2], 10);
    if (!mapa[emp]) mapa[emp] = { siglas: m[1], ultimo: num };
    else if (num > mapa[emp].ultimo) mapa[emp].ultimo = num;
  }
  return siguienteDesdeMapa(mapa, empresa, extraUsados);
}

function siguienteDesdeMapa(mapa, empresa, extraUsados) {
  if (mapa[empresa]) {
    mapa[empresa].ultimo += 1;                       // reserva el número (importación en lote)
    return mapa[empresa].siglas + mapa[empresa].ultimo;
  }
  const siglas = generarSiglas(empresa);
  const usadas = {};
  Object.keys(mapa).forEach(emp => { usadas[mapa[emp].siglas] = emp; });
  (extraUsados || []).forEach(sg => { usadas[sg] = usadas[sg] || "_"; });
  let intento = siglas, c = 2;
  while (usadas[intento] && usadas[intento] !== empresa) { intento = siglas + c; c++; }
  mapa[empresa] = { siglas: intento, ultimo: 1 };
  return intento + "1";
}

async function siguienteNumeroPorEmpresa(env, empresa) {
  const r = await env.DB.prepare(
    "SELECT MAX(CAST(no_empleado AS INTEGER)) AS m FROM empleados WHERE TRIM(empresa) = ?"
  ).bind(s(empresa)).first();
  return (r && r.m ? r.m : 0) + 1;
}

async function empresaId(env, empresa) {
  const r = await env.DB.prepare(
    "SELECT id FROM empresas WHERE TRIM(empresa) = ? OR UPPER(REPLACE(REPLACE(empresa,'.',''),'  ',' ')) = UPPER(REPLACE(REPLACE(?,'.',''),'  ',' ')) LIMIT 1"
  ).bind(s(empresa), s(empresa)).first();
  return r ? r.id : null;
}

function nuevoIdPersona() {
  const b = crypto.getRandomValues(new Uint8Array(2));
  return "P" + Date.now().toString(36).toUpperCase().slice(-5) + (b[0] % 36).toString(36).toUpperCase() + (b[1] % 36).toString(36).toUpperCase();
}

// La URL que se exporta para expedientes en R2; si vuelve en un Excel no debe pisar la ubicación real
const esUrlR2 = v => typeof v === "string" && /^(https?:\/\/[^/]+)?\/expediente\/folders\//.test(v.trim());
const esUrbanThink = e => /URBAN\s*THINK/i.test(s(e));
const esObra = t => /obra/i.test(s(t));

// ── exportar_datos ────────────────────────────────────────────
// La base arma el JSON (json_object) en bloques; el Worker solo los une.
// Así casi no consume CPU aunque sean miles de registros.
async function exportarDatos(p, env, ctx) {
  const quien = await autenticarRequest(env, p);
  if (!quien) return SESION_INVALIDA;
  // Alcance por empresa/grupo: el servidor solo entrega lo que el usuario puede ver
  // (antes llegaba todo y se filtraba en pantalla)
  const alcance = quien.empresas.filter(Boolean);
  const filtro = alcance.length ? JSON.stringify(alcance) : null;
  const pares = [];
  for (const [h, col, tipo] of COLUMNAS) pares.push(`'${h.replace(/'/g, "''")}', ${expresionExport(h, col, tipo)}`);
  pares.push(`'URL EXPEDIENTE', ${URL_EXPEDIENTE_SQL}`);          // GAS copiaba CARPETA a URL EXPEDIENTE
  const sql = `SELECT json_group_array(json(o)) AS j FROM (
      SELECT json_object(${pares.join(", ")}) AS o
      FROM v_empleados v JOIN empleados e ON e.id_interno = v.id_interno
      WHERE ?4 IS NULL OR UPPER(TRIM(v.empresa)) IN (SELECT UPPER(TRIM(value)) FROM json_each(?4))
      ORDER BY COALESCE(e.fila_sheet_origen, 999999999), e.rowid
      LIMIT ?2 OFFSET ?3)`;
  const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM empleados").first()).n;
  const partes = [];
  for (let off = 0; off < total; off += BLOQUE_EXPORT) {
    const r = await env.DB.prepare(sql).bind(origen(ctx), BLOQUE_EXPORT, off, filtro).first();
    const j = r && r.j ? r.j : "[]";
    if (j.length > 2) partes.push(j.slice(1, -1));
  }
  return { __rawJson: '{"status":"success","data":[' + partes.join(",") + "]}" };
}

// ── siguiente_numero ──────────────────────────────────────────
async function siguienteNumero(p, env) {
  const empresa = s(p && p.empresa).replace(/\n/g, " ");
  if (empresa) {
    return { status: "success", siguiente: await siguienteNumeroPorEmpresa(env, empresa), idInterno: await generarSiguienteID(env, empresa) };
  }
  const r = await env.DB.prepare("SELECT MAX(CAST(no_empleado AS INTEGER)) AS m FROM empleados").first();
  return { status: "success", siguiente: (r && r.m ? r.m : 0) + 1, idInterno: "" };
}

// ── obtener_catalogo_empresas ─────────────────────────────────
async function obtenerCatalogoEmpresas(p, env) {
  const { results } = await env.DB.prepare("SELECT id, empresa, grupo_comercial FROM empresas ORDER BY rowid").all();
  return ok({ empresas: results.map(r => ({ id: s(r.id), nombre: s(r.empresa), grupo: s(r.grupo_comercial) })).filter(e => e.nombre || e.id) });
}

// ── alta ──────────────────────────────────────────────────────
// Campos del stepper (payload) → columna D1
const ALTA = {
  fechaIngreso: "fecha_ingreso", nombreTrabajador: "nombre", departamento: "departamento", puesto: "puesto",
  sueldoMensual: "sueldo_mensual", frecuenciaPago: "frecuencia_pago", fuenteContratacion: "fuente_contratacion",
  lugarNacimiento: "lugar_nacimiento", nacionalidad: "nacionalidad", estadoCivil: "estado_civil",
  curp: "curp", rfc: "rfc", nss: "nss", domicilioCompleto: "domicilio", escolaridad: "escolaridad",
  correoElectronico: "correo", telefonoPersonal: "telefono", contactoEmergencia: "contacto_emergencia",
  parentesco: "parentesco_emergencia", telefonoEmergencia: "telefono_emergencia",
  nombreBeneficiario: "beneficiario_nombre", rfcBeneficiario: "beneficiario_rfc",
  parentescoBeneficiario: "beneficiario_parentesco", porcentajeAsignacion: "beneficiario_porcentaje",
  tipoIngreso: "tipo_ingreso", tipoContrato: "tipo_contrato", fechaInicioContrato: "contrato1_inicio",
  entrevista15Dias: "entrevista_15_dias", entrevista45Dias: "entrevista_45_dias",
  vencimientoPrimerContrato: "contrato1_vencimiento", iniciSegundoContrato: "contrato2_inicio",
  vencSegundoContrato: "contrato2_vencimiento", iniciTercerContrato: "contrato3_inicio",
  vencTercerContrato: "contrato3_vencimiento", fechaEval360: "fecha_eval_360",
  correoAcceso: "correo_acceso", grupoComercial: "grupo_comercial",
  fechaInicioContrato4: "contrato4_inicio", vencimientoContrato4: "contrato4_vencimiento",
  fechaInicioContrato5: "contrato5_inicio", vencimientoContrato5: "contrato5_vencimiento",
  fechaInicioContrato6: "contrato6_inicio", vencimientoContrato6: "contrato6_vencimiento",
};
const TIPO_COL = Object.fromEntries(COLUMNAS.map(([, c, t]) => [c, t]));

function b64aBytes(b64) {
  let x = String(b64 || "");
  if (x.includes(",")) x = x.split(",")[1];
  x = x.replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(x);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const limpiarRuta = t => s(t).replace(/[\\/:*?"<>|#\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "Sin nombre";

// ¿La empresa está dentro del alcance del usuario? (lista vacía = todas)
async function empresaEnAlcance(env, p, empresa) {
  const quien = await autenticarRequest(env, p);
  const lista = quien ? quien.empresas.filter(Boolean) : [];
  if (!lista.length) return true;
  const k = s(empresa).toUpperCase();
  return lista.some(e => s(e).toUpperCase() === k);
}
async function empleadoEnAlcance(env, p, idInterno) {
  const r = await env.DB.prepare("SELECT empresa FROM empleados WHERE id_interno = ? LIMIT 1").bind(idInterno).first();
  return empresaEnAlcance(env, p, r ? r.empresa : "");
}
const FUERA_ALCANCE = error("Esa empresa no está entre las que tienes asignadas.");

async function alta(p, env, ctx) {
  const usuario = await requiereSesionValida(env, p);
  if (!usuario) return SESION_INVALIDA;

  const empresa = s(p.empresa);
  if (!(await empresaEnAlcance(env, p, empresa))) return FUERA_ALCANCE;
  const noEmpPayload = s(p.numeroEmpleado);
  const curp = s(p.curp).toUpperCase(), rfc = s(p.rfc).toUpperCase();

  // Reingreso: misma empresa, mismo CURP o RFC, y en Baja
  let noEmpAnterior = "", idPersonaAnterior = "";
  if (curp || rfc) {
    const r = await env.DB.prepare(
      `SELECT no_empleado, id_persona FROM empleados
       WHERE TRIM(empresa) = ? AND fecha_baja IS NOT NULL
         AND ((? <> '' AND UPPER(TRIM(curp)) = ?) OR (? <> '' AND UPPER(TRIM(rfc)) = ?))
       ORDER BY COALESCE(fila_sheet_origen, 999999999), rowid LIMIT 1`
    ).bind(empresa, curp, curp, rfc, rfc).first();
    if (r) { noEmpAnterior = s(r.no_empleado); idPersonaAnterior = s(r.id_persona); }
  }
  const noEmp = noEmpPayload || noEmpAnterior || String(await siguienteNumeroPorEmpresa(env, empresa));
  const esReingreso = !noEmpPayload && !!noEmpAnterior;
  const idInterno = await generarSiguienteID(env, empresa);

  // No puede haber otro ACTIVO con ese número en la misma empresa
  const dup = await env.DB.prepare(
    "SELECT 1 FROM empleados WHERE TRIM(empresa) = ? AND CAST(no_empleado AS TEXT) = ? AND fecha_baja IS NULL LIMIT 1"
  ).bind(empresa, noEmp).first();
  if (dup) return error("El No. " + noEmp + " ya está activo en " + empresa + ". Si es reingreso, el empleado anterior debe estar en Baja.");

  // Carpeta del expediente en R2 (equivale a la carpeta de Drive)
  const prefijo = `expedientes/${limpiarRuta(empresa || "Sin Empresa")}/${limpiarRuta(noEmp + " - " + (p.nombreTrabajador || "Sin Nombre"))}/`;
  const carpeta = "r2:" + prefijo;

  // ID_PERSONA: el de otra fila con la misma CURP, o uno nuevo
  let idPersona = "";
  if (curp) {
    const r = await env.DB.prepare("SELECT id_persona FROM empleados WHERE UPPER(TRIM(curp)) = ? AND id_persona IS NOT NULL AND id_persona <> '' LIMIT 1").bind(curp).first();
    if (r) idPersona = s(r.id_persona);
  }
  if (!idPersona) idPersona = nuevoIdPersona();

  const cols = ["id_interno", "id_persona", "no_empleado", "empresa_id", "empresa", "carpeta", "creado_en", "actualizado_en"];
  const vals = [idInterno, idPersona, /^\d+$/.test(noEmp) ? parseInt(noEmp, 10) : noEmp, await empresaId(env, empresa), empresa || null, carpeta, ahoraISO(), ahoraISO()];
  for (const [k, col] of Object.entries(ALTA)) {
    cols.push(col);
    vals.push(aValorD1(TIPO_COL[col] || "t", p[k]));
  }
  if (!vals[cols.indexOf("nombre")]) vals[cols.indexOf("nombre")] = "";
  await env.DB.prepare(`INSERT INTO empleados (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).bind(...vals).run();

  // Documentos del paso 1 → R2 + registro en "archivos"
  const docs = Array.isArray(p.documentos) ? p.documentos : [];
  let subidos = 0;
  for (const d of docs) {
    try {
      const nombre = limpiarRuta(d.nombreArchivo || "archivo");
      const key = prefijo + nombre;
      const bytes = b64aBytes(d.data);
      await env.R2.put(key, bytes, { httpMetadata: { contentType: d.mimeType || "application/octet-stream" } });
      await env.DB.prepare(
        "INSERT OR REPLACE INTO archivos (id_interno, categoria, r2_key, nombre_original, mime, bytes, subido_por) VALUES (?,?,?,?,?,?,?)"
      ).bind(idInterno, "expediente", key, d.nombreArchivo || nombre, d.mimeType || "", bytes.length, usuario.email).run();
      subidos++;
    } catch (e) { console.log("[Alta] Doc: " + e); }
  }

  // Portal del empleado (contraseña inicial con SU número; GAS usaba "Prisma001*" para todos)
  const corrAcceso = s(p.correoAcceso);
  if (corrAcceso && idInterno) {
    try { await activarAccesoInterno(env, ctx, idInterno, corrAcceso, "Prisma" + noEmp + "*"); }
    catch (e) { console.log("[Alta] Error activando portal: " + e); }
  }

  await registrarEvento(env, usuario.email, usuario.rol, "ALTA",
    `Alta de ${s(p.nombreTrabajador)} (${idInterno}) en ${empresa}${esReingreso ? " — reingreso" : ""}${subidos ? " — " + subidos + " documento(s)" : ""}`, empresa, "");

  const esOperativo = /^operativ/i.test(s(p.tipoIngreso));
  return {
    status: "success", message: "Alta registrada.", urlExpediente: urlCarpeta(idInterno, ctx), noEmpleado: noEmp, idInterno,
    esReingreso, idPersonaAnterior,
    contratoPrefill: {
      empresa, esUrbanThink: esUrbanThink(empresa), esObraUrbanThink: esUrbanThink(empresa) && esObra(p.tipoIngreso),
      puesto: p.puesto || "", tipoIngreso: p.tipoIngreso || "", fechaInicio: p.fechaInicioContrato || "",
      fechaFin: esOperativo ? (p.vencTercerContrato || "") : (p.vencimientoContrato6 || ""),
    },
  };
}

// ── baja ──────────────────────────────────────────────────────
async function baja(p, env) {
  const usuario = await requiereSesionValida(env, p);
  if (!usuario) return SESION_INVALIDA;
  const idInterno = s(p.idInterno), noEmp = s(p.numeroEmpleado), empresa = s(p.empresa);
  const nom = s(p.nombreEmpleado).toLowerCase();
  if (!idInterno && !noEmp && !nom) return error("Proporciona ID o nombre del empleado.");

  let fila = null;
  // Prioridad 1 y 2: ID INTERNO (+ No. Emp) + Empresa
  if (idInterno && empresa) {
    if (noEmp) fila = await env.DB.prepare("SELECT id_interno, nombre FROM empleados WHERE id_interno = ? AND CAST(no_empleado AS TEXT) = ? AND TRIM(empresa) = ? LIMIT 1").bind(idInterno, noEmp, empresa).first();
    if (!fila) fila = await env.DB.prepare("SELECT id_interno, nombre FROM empleados WHERE id_interno = ? AND TRIM(empresa) = ? LIMIT 1").bind(idInterno, empresa).first();
  }
  // Prioridad 3: No. Emp + Empresa — SOLO si no se mandó ID INTERNO (bugfix de GAS conservado)
  if (!fila && !idInterno && noEmp && empresa) {
    // El mismo número puede repetirse en la empresa (registro anterior en baja, reingreso,
    // cambio de puesto): se da de baja al que está ACTIVO.
    fila = await env.DB.prepare("SELECT id_interno, nombre FROM empleados WHERE CAST(no_empleado AS TEXT) = ? AND TRIM(empresa) = ? ORDER BY (fecha_baja IS NULL) DESC, COALESCE(fila_sheet_origen, 999999999) DESC, rowid DESC LIMIT 1").bind(noEmp, empresa).first();
  }
  if (!fila) return error("No se encontró el colaborador.");
  if (!(await empleadoEnAlcance(env, p, fila.id_interno))) return FUERA_ALCANCE;

  await env.DB.prepare(
    "UPDATE empleados SET fecha_baja = ?, tipo_salida = ?, motivo_salida = ?, monto_finiquito = ?, actualizado_en = ? WHERE id_interno = ?"
  ).bind(aValorD1("f", p.fechaBaja), aValorD1("t", p.tipoSalida), aValorD1("t", p.motivoSalida), aValorD1("n", p.montoFiniquito), ahoraISO(), fila.id_interno).run();

  const nomReg = s(fila.nombre) || idInterno || noEmp;
  await registrarEvento(env, usuario.email, usuario.rol, "BAJA", `Baja de ${nomReg} (${fila.id_interno}) — ${s(p.tipoSalida)}: ${s(p.motivoSalida)}`, empresa, "");
  return ok({ message: "Baja registrada para: " + nomReg + " (" + fila.id_interno + ")." });
}

// ── actualizar_empleado ───────────────────────────────────────
async function actualizarEmpleado(p, env, ctx) {
  const usuario = await requiereSesionValida(env, p);
  if (!usuario) return SESION_INVALIDA;
  const idBuscar = s(p.idInterno), noEmpBuscar = s(p.numeroEmpleado), empBuscar = s(p.empresa);
  if (!idBuscar && !noEmpBuscar) return error("No se proporcionó número de empleado.");

  let fila = null;
  if (idBuscar) fila = await env.DB.prepare("SELECT id_interno, no_empleado FROM empleados WHERE id_interno = ? LIMIT 1").bind(idBuscar).first();
  if (!fila && !idBuscar && noEmpBuscar && empBuscar)
    fila = await env.DB.prepare("SELECT id_interno, no_empleado FROM empleados WHERE CAST(no_empleado AS TEXT) = ? AND TRIM(empresa) = ? ORDER BY (fecha_baja IS NULL) DESC, COALESCE(fila_sheet_origen, 999999999) DESC, rowid DESC LIMIT 1").bind(noEmpBuscar, empBuscar).first();
  if (!fila) return error("No se encontró el empleado.");
  if (!(await empleadoEnAlcance(env, p, fila.id_interno))) return FUERA_ALCANCE;

  const campos = p.campos || {};
  const sets = [], vals = [], nombres = [];
  for (const nombre of Object.keys(campos)) {
    const valor = campos[nombre];
    if (valor === undefined || valor === null || valor === "") continue;   // igual que GAS: vacío no borra
    if (PROTEGIDOS.has(nombre)) continue;
    const def = POR_ENCABEZADO[nombre];
    if (!def || def.tipo === "calc" || def.col === "id_interno") continue;
    if (def.col === "carpeta" && esUrlR2(valor)) continue;          // no sobrescribir la ubicación real en R2
    sets.push(def.col + " = ?");
    vals.push(aValorD1(def.tipo, valor));
    nombres.push(nombre);
  }
  if (sets.length) {
    sets.push("actualizado_en = ?"); vals.push(ahoraISO());
    vals.push(fila.id_interno);
    await env.DB.prepare(`UPDATE empleados SET ${sets.join(", ")} WHERE id_interno = ?`).bind(...vals).run();
  }

  const nuevoCorr = s(campos["CORREO ACCESO"]);
  if (nuevoCorr && idBuscar) {
    try { await activarAccesoInterno(env, ctx, idBuscar, nuevoCorr, "Prisma" + (s(fila.no_empleado) || "001") + "*"); }
    catch (e) { console.log("[Update] Error activando portal: " + e); }
  }
  if (nombres.length) await registrarEvento(env, usuario.email, usuario.rol, "EDITAR_EMPLEADO", `${fila.id_interno}: ${nombres.join(", ")}`, empBuscar, "");
  return ok({ message: "Actualizado: " + nombres.length + " campo(s) modificado(s) para el empleado #" + fila.id_interno + "." });
}

// ── importar_masivo ───────────────────────────────────────────
// Corrección vs GAS: GAS empataba solo por NO. EMPLEADO, que se repite entre
// empresas, y podía sobrescribir a otra persona. Aquí se empata por ID INTERNO;
// si no viene, por NO. EMPLEADO + EMPRESA. Todo en sentencias multi-fila y en
// un solo lote atómico (si algo falla, no se aplica nada).
async function importarMasivo(p, env) {
  const usuario = await requiereSesionValida(env, p);              // GAS no pedía sesión aquí
  if (!usuario) return SESION_INVALIDA;
  const registros = p.registros;
  if (!registros || !registros.length) return error("Sin registros.");

  const { results: existentes } = await env.DB.prepare("SELECT id_interno, empresa, no_empleado, fecha_baja FROM empleados").all();
  const activo = new Set(existentes.filter(r => !r.fecha_baja).map(r => s(r.id_interno)));
  const porId = new Set(existentes.map(r => s(r.id_interno)));
  const porNoEmp = {};
  const mapaSiglas = {};
  for (const r of existentes) {
    const k = s(r.empresa) + "\u0001" + s(r.no_empleado);
    (porNoEmp[k] = porNoEmp[k] || []).push(s(r.id_interno));
    const m = s(r.id_interno).match(/^([A-Z]+)(\d+)$/);
    const emp = s(r.empresa);
    if (m && emp) {
      const n = parseInt(m[2], 10);
      if (!mapaSiglas[emp]) mapaSiglas[emp] = { siglas: m[1], ultimo: n };
      else if (n > mapaSiglas[emp].ultimo) mapaSiglas[emp].ultimo = n;
    }
  }
  const { results: empRows } = await env.DB.prepare("SELECT id, empresa FROM empresas").all();
  const empId = Object.fromEntries(empRows.map(r => [s(r.empresa), r.id]));

  const editables = COLUMNAS.filter(([h, c, t]) => t !== "calc" && c !== "id_interno");
  const actualizar = [], insertar = [];
  let omitidos = 0;
  for (const emp of registros) {
    const noEmp = s(emp["NO. EMPLEADO"]);
    if (!noEmp) continue;
    const empresa = s(emp["EMPRESA"]);
    let id = s(emp["ID INTERNO"]);
    let destino = null;
    if (id && porId.has(id)) destino = id;
    else if (!id) {
      // Sin ID INTERNO: número + empresa. Si el número se repite (registro anterior en baja,
      // reingreso, cambio de puesto) se actualiza el ACTIVO; si hay varios activos, no se adivina.
      const cand = porNoEmp[empresa + "\u0001" + noEmp] || [];
      const candActivos = cand.filter(id => activo.has(id));
      if (cand.length === 1) destino = cand[0];
      else if (candActivos.length === 1) destino = candActivos[0];
      else if (cand.length > 1) { omitidos++; continue; }
    }
    if (destino) actualizar.push([destino, emp]);
    else {
      if (!id) id = siguienteDesdeMapa(mapaSiglas, empresa);
      if (porId.has(id)) { omitidos++; continue; }
      porId.add(id);
      insertar.push([id, emp]);
    }
  }

  const stmts = [];
  const ahora = ahoraISO();
  // Actualizaciones: UPDATE ... FROM (VALUES …) — una sentencia por bloque de filas
  // con las mismas columnas. Solo se tocan columnas que vienen en el archivo.
  const grupos = new Map();
  for (const [id, emp] of actualizar) {
    const cols = editables.filter(([h, c]) => (h in emp) && !PROTEGIDOS.has(h) && !(c === "carpeta" && esUrlR2(emp[h])));
    if (!cols.length) continue;
    const firma = cols.map(([h]) => h).join("\u0001");
    if (!grupos.has(firma)) grupos.set(firma, { cols, filas: [] });
    grupos.get(firma).filas.push("(" + [literal(id), ...cols.map(([h, , tipo]) => literal(aValorD1(tipo, emp[h])))].join(",") + ")");
  }
  for (const { cols, filas } of grupos.values()) {
    const sets = cols.map(([, col], k) => `${col} = v.column${k + 2}`).join(", ");
    let lote = [], tam = 0;
    const cerrar = () => {
      if (!lote.length) return;
      stmts.push(`UPDATE empleados SET ${sets}, actualizado_en = ${literal(ahora)} FROM (VALUES ${lote.join(",")}) AS v WHERE empleados.id_interno = v.column1`);
      lote = []; tam = 0;
    };
    for (const f of filas) { if (tam + f.length > MAX_SQL) cerrar(); lote.push(f); tam += f.length; }
    cerrar();
  }
  // Inserciones multi-fila
  const colsIns = ["id_interno", "empresa_id", "creado_en", "actualizado_en", ...editables.map(([, c]) => c)];
  let lote = [], tam = 0;
  const cerrar = () => { if (lote.length) stmts.push(`INSERT INTO empleados (${colsIns.join(",")}) VALUES ${lote.join(",")}`); lote = []; tam = 0; };
  for (const [id, emp] of insertar) {
    const empresa = s(emp["EMPRESA"]);
    const vals = [literal(id), literal(empId[empresa] || null), literal(ahora), literal(ahora)];
    for (const [h, col, tipo] of editables) {
      let v = aValorD1(tipo, emp[h]);
      if (col === "nombre" && v === null) v = "";
      if (col === "id_persona" && !v) v = nuevoIdPersona();
      if (col === "carpeta" && esUrlR2(v)) v = null;
      vals.push(literal(v));
    }
    const fila = "(" + vals.join(",") + ")";
    if (tam + fila.length > MAX_SQL) cerrar();
    lote.push(fila); tam += fila.length;
  }
  cerrar();

  // Límite del plan gratuito: 50 consultas por petición
  if (stmts.length > 40) return error("El archivo es demasiado grande para una sola carga. Divídelo en partes más pequeñas.");
  // batch = un solo lote atómico: si una sentencia falla, no se aplica nada
  if (stmts.length) await env.DB.batch(stmts.map(x => env.DB.prepare(x)));
  await registrarEvento(env, usuario.email, usuario.rol, "IMPORTAR_MASIVO",
    `Actualizados: ${actualizar.length} | Nuevos: ${insertar.length}${omitidos ? " | Omitidos: " + omitidos : ""}`, "", "");
  const msg = "Actualizados: " + actualizar.length + " | Nuevos: " + insertar.length + " | Total: " + (actualizar.length + insertar.length)
    + (omitidos ? " | Omitidos: " + omitidos + " (mismo No. con varios activos en la empresa: agrega la columna ID INTERNO para identificarlos)" : "");
  return ok({ message: msg });
}

export default {
  exportar_datos: exportarDatos,
  siguiente_numero: siguienteNumero,
  obtener_catalogo_empresas: obtenerCatalogoEmpresas,
  alta,
  baja,
  actualizar_empleado: actualizarEmpleado,
  importar_masivo: importarMasivo,
};
