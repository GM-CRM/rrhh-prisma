// ============================================================
//  Módulo CONTRATOS
//  Port de Código.gs: obtenerDatosContrato, generarContrato
//  + nuevas: listar_plantillas_contrato, subir_plantilla_contrato
//
//  Antes: copiaba un Google Doc plantilla en la carpeta de Drive del
//  empleado, reemplazaba los {{CAMPOS}} y exportaba un PDF.
//  Ahora: la plantilla es un .docx en R2 (plantillas/contratos/…); se
//  abre, se reemplazan los {{CAMPOS}} en el XML (formato, logos y márgenes
//  quedan intactos) y el contrato .docx se guarda en el expediente (R2).
//  Los textos de cada campo se arman EXACTAMENTE como en GAS
//  (src/lib/contratos_texto.js).
//
//  Correcciones (F37–F40 del inventario):
//   · F37 número a letras: "Ochocientos  y seis pesos", "veintiuno pesos".
//   · F38 ninguna de las dos acciones pedía sesión (cualquiera podía generar
//     contratos y cambiar fechas de contrato en la base).
//   · F39 campos que quedaran sin llenar ({{X}}) ya no llegan al contrato.
//   · F40 el nombre del archivo perdía letras con acento o Ñ (ZUÑIGA → ZUIGA).
// ============================================================
import { s, ahoraISO, normalizar, ok, error } from "../lib/util.js";
import { autenticarRequest, registrarEvento } from "../lib/sesion.js";
import { urlFirmada, asegurarPrefijo, limpiarRuta, b64aBytes } from "../lib/archivos.js";
import { leerZip, contenidoZip, zip, MIME_DOCX } from "../lib/docx.js";
import * as T from "../lib/contratos_texto.js";

const SESION_INVALIDA = { status: "error", message: "Sesión inválida o expirada." };
const COMUNES = ["RAZON_SOCIAL", "APODERADO_LEGAL", "NOMBRE_COMPLETO", "RFC_EMPRESA", "DOMICILIO_FISCAL_EMPRESA", "NACIONALIDAD",
  "EDAD", "SEXO", "ESTADO_CIVIL", "DOMICILIO_TRABAJADOR", "CURP", "RFC_TRABAJADOR", "OBJETO_SOCIAL", "PUESTO", "FECHA_INICIO",
  "FECHA_FIN_PERIODO", "TIPO_DE_CONTRATO", "FUNCIONES_PUESTO", "DESCANSO_DIARIO", "SALARIO_DIARIO_NUM", "PERIODICIDAD_PAGO"];
const URBAN = ["NOMBRE_COMPLETO", "NACIONALIDAD", "EDAD", "SEXO", "ESTADO_CIVIL", "DOMICILIO_TRABAJADOR", "CURP", "RFC_TRABAJADOR",
  "PUESTO", "FUNCIONES_PUESTO", "DESCANSO_DIARIO", "SALARIO_DIARIO_NUM", "SALARIO_MENSUAL_NUM", "PERIODICIDAD_PAGO",
  "LUGAR_PRESTACION", "HORARIO_TRABAJO", "FECHA_FIRMA"];
export const PLANTILLAS = {
  operativo: { key: "plantillas/contratos/operativo.docx", nombre: "Operativo (periodo de prueba 3 × 30 días)", campos: COMUNES },
  administrativo: { key: "plantillas/contratos/administrativo.docx", nombre: "Administrativo (capacitación 6 × 30 días)", campos: COMUNES },
  urban_obra: { key: "plantillas/contratos/urban_obra.docx", nombre: "URBAN THINK — obra determinada", campos: URBAN },
};
const PARTES_TEXTO = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const dec = new TextDecoder();

async function panel(env, p) {
  const c = await autenticarRequest(env, p);
  if (c) c.empresas = c.empresas.filter(Boolean);
  return c;
}
const clave = t => normalizar(t).replace(/[^a-z0-9]/g, "");
const empresaPermitida = (c, emp) => !c.empresas.length || c.empresas.some(e => clave(e) === clave(emp));
const fechaISO = v => { const m = s(v).match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ""; };
const escXml = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
// Texto visible de cada párrafo (para revisar campos {{X}})
const textoParrafos = xml => (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
  .map(p => (p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join(""));
const camposEn = texto => [...new Set((texto.match(/\{\{[A-Z_]+\}\}/g) || []).map(x => x.slice(2, -2)))];

async function empleado(env, idInterno) {
  return env.DB.prepare(
    `SELECT v.*, e.carpeta AS carpeta, e.empresa_id AS emp_id FROM v_empleados v JOIN empleados e ON e.id_interno = v.id_interno
      WHERE v.id_interno = ?`).bind(idInterno).first();
}

// ── obtener_datos_contrato: prellenar el formulario ───────────
async function obtenerDatosContrato(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;                               // GAS lo dejaba abierto
  const idInterno = s(p.idInterno);
  if (!idInterno) return error("Falta ID INTERNO.");
  try {
    const e = await empleado(env, idInterno);
    if (!e || !empresaPermitida(caller, e.empresa)) return error("No se encontró el empleado con ID " + idInterno);
    const tipoIngreso = s(e.tipo_ingreso), esOperativo = /operativ/i.test(tipoIngreso);
    return {
      status: "success",
      datos: {
        idInterno, empresa: s(e.empresa),
        esUrbanThink: T._esEmpresaUrbanThink(e.empresa),
        esObraUrbanThink: T._usaPlantillaObraUrbanThink(e.empresa, tipoIngreso),
        nombre: s(e.nombre), puesto: s(e.puesto), tipoIngreso,
        fechaInicio: fechaISO(e.contrato1_inicio),
        fechaFin: fechaISO(esOperativo ? e.contrato3_vencimiento : e.contrato6_vencimiento),
      },
    };
  } catch (err) { return error(String(err)); }
}

// ── generar_contrato ──────────────────────────────────────────
async function generarContrato(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;                               // GAS lo dejaba abierto
  const idInterno = s(p.idInterno);
  if (!idInterno) return error("Falta ID INTERNO.");
  try {
    const e = await empleado(env, idInterno);
    if (!e || !empresaPermitida(caller, e.empresa)) return error("Empleado no encontrado con ID " + idInterno);

    const nombreTrabajador = s(e.nombre), empresaNombre = s(e.empresa), puesto = s(e.puesto);
    const sueldoMensual = T._limpiarNumero(e.sueldo_mensual), frecuenciaPago = s(e.frecuencia_pago);
    const tipoIngreso = s(e.tipo_ingreso), tipoContrato = s(e.tipo_contrato);

    // Plantilla Urban Think = EMPRESA Urban Think + TIPO DE INGRESO "Obra determinada"
    const esObraDet = T._esTipoObraDeterminada(tipoIngreso);
    const esUrbanThink = T._usaPlantillaObraUrbanThink(empresaNombre, tipoIngreso);
    if (esObraDet && !esUrbanThink)
      return error("El tipo de ingreso 'Obra determinada' solo aplica para URBAN THINK S.A. DE C.V. Empresa actual: '" + empresaNombre + "'.");
    if (!esUrbanThink && !/^operativ/i.test(tipoIngreso) && !/^administrativ/i.test(tipoIngreso))
      return error("TIPO DE INGRESO debe ser 'Operativo' o 'Administrativo'. Valor actual: '" + tipoIngreso + "'.");
    const esOperativo = /^operativ/i.test(tipoIngreso);
    if (sueldoMensual <= 0)
      return error("El sueldo mensual no es válido (" + s(e.sueldo_mensual) + "). Verifica el campo SUELDO MENSUAL del expediente.");

    // Fechas: las del formulario o las del expediente
    const ovIni = s(p.fechaInicioOverride), ovFin = s(p.fechaFinOverride);
    if ((ovIni && !/^\d{4}-\d{2}-\d{2}$/.test(ovIni)) || (ovFin && !/^\d{4}-\d{2}-\d{2}$/.test(ovFin))) return error("Fechas no válidas.");
    const colFin = esOperativo ? "contrato3_vencimiento" : "contrato6_vencimiento";
    const fechaInicioTxt = T.formatearFechaLarga(ovIni || fechaISO(e.contrato1_inicio));
    const fechaFinTxt = T.formatearFechaLarga(ovFin || fechaISO(e[colFin]));
    if (!fechaInicioTxt || (!fechaFinTxt && !esUrbanThink))
      return error("Faltan fechas de inicio/fin de contrato. Captúralas en el formulario o en el expediente.");

    const funcionesPuesto = s(p.funcionesPuesto), descansoDiario = s(p.descansoDiario) || "30 minutos";
    if (!funcionesPuesto) return error("Debes capturar las funciones del puesto en el formulario.");

    // Datos de la empresa (catálogo)
    const emp = (e.emp_id && await env.DB.prepare("SELECT * FROM empresas WHERE id = ?").bind(e.emp_id).first())
      || await env.DB.prepare("SELECT * FROM empresas WHERE empresa = ?").bind(empresaNombre).first();
    if (!emp) return error("No se encontró la empresa '" + empresaNombre + "' en el catálogo EMPRESAS.");

    const salarioDiarioNum = sueldoMensual / 30;
    const salarioDiarioTxt = "$" + salarioDiarioNum.toFixed(2) + " (" + T.numeroALetrasMoneda(salarioDiarioNum) + " M.N.)";
    // {{TIPO_DE_CONTRATO}}: en Administrativo va en una frase en mayúsculas; en Operativo, en minúsculas
    const tipoContratoTxt = esOperativo ? tipoContrato.toLowerCase() : tipoContrato.toUpperCase();

    const campos = {
      RAZON_SOCIAL: s(emp.empresa), APODERADO_LEGAL: s(emp.representante_legal),
      NOMBRE_COMPLETO: T._tituloCase(nombreTrabajador), RFC_EMPRESA: s(emp.rfc),
      DOMICILIO_FISCAL_EMPRESA: s(emp.domicilio_fiscal), NACIONALIDAD: s(e.nacionalidad), EDAD: s(e.edad),
      SEXO: s(e.genero), ESTADO_CIVIL: s(e.estado_civil), DOMICILIO_TRABAJADOR: T._tituloCase(s(e.domicilio)),
      CURP: s(e.curp), RFC_TRABAJADOR: s(e.rfc), OBJETO_SOCIAL: s(emp.actividad_economica), PUESTO: puesto,
      FECHA_INICIO: fechaInicioTxt, FECHA_FIN_PERIODO: fechaFinTxt, TIPO_DE_CONTRATO: tipoContratoTxt,
      FUNCIONES_PUESTO: T._oracionCase(funcionesPuesto), DESCANSO_DIARIO: T._oracionCase(descansoDiario),
      SALARIO_DIARIO_NUM: salarioDiarioTxt, PERIODICIDAD_PAGO: frecuenciaPago,
    };
    if (esUrbanThink) {
      const lugar = s(p.lugarPrestacion), horario = s(p.horarioTrabajo);
      if (!lugar) return error("Debes capturar el lugar de prestación de servicios (Urban Think).");
      campos.FUNCIONES_PUESTO = funcionesPuesto.toLowerCase().replace(/[.\s]+$/, "");   // va a media frase
      campos.DESCANSO_DIARIO = descansoDiario.toLowerCase();
      campos.PERIODICIDAD_PAGO = frecuenciaPago.toLowerCase();                            // "...de manera quincenal..."
      campos.SALARIO_MENSUAL_NUM = "$" + sueldoMensual.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " (" + T.numeroALetrasMoneda(sueldoMensual) + " M.N.)";
      campos.LUGAR_PRESTACION = T._tituloCase(lugar);
      campos.HORARIO_TRABAJO = horario ? ("El horario de trabajo será " + horario.toLowerCase().replace(/[.\s]+$/, "") + ".") : "";
      campos.FECHA_FIRMA = fechaInicioTxt;
    }

    // Plantilla desde R2
    const tipo = esUrbanThink ? "urban_obra" : (esOperativo ? "operativo" : "administrativo");
    const obj = await env.R2.get(PLANTILLAS[tipo].key);
    if (!obj) return error("Falta la plantilla de contrato «" + PLANTILLAS[tipo].nombre + "». Súbela en Plantillas de contrato.");
    const entradas = leerZip(new Uint8Array(await obj.arrayBuffer()));

    // Reemplazo en un solo recorrido por parte del documento (formato intacto)
    const nuevas = [], sinLlenar = new Set();
    for (const en of entradas) {
      if (!PARTES_TEXTO.test(en.nombre)) { nuevas.push({ nombre: en.nombre, crudo: en }); continue; }
      const xml = dec.decode(await contenidoZip(en));
      if (xml.indexOf("{{") < 0) { nuevas.push({ nombre: en.nombre, crudo: en }); continue; }
      const listo = xml.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
        if (!(k in campos)) return m;
        return escXml(campos[k]).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
      });
      textoParrafos(listo).forEach(t => camposEn(t).forEach(c => sinLlenar.add(c)));
      // Sin comprimir a propósito: comprimir ~320 KB de XML costaba ~3 ms de CPU y el
      // plan gratuito da 10 ms por petición. Word lo abre igual y al guardar lo comprime.
      nuevas.push({ nombre: en.nombre, datos: listo });
    }
    if (sinLlenar.size)
      return error("La plantilla tiene campos que el sistema no sabe llenar: " + [...sinLlenar].map(c => "{{" + c + "}}").join(", ") +
        ". Corrige la plantilla en Plantillas de contrato.");
    const bytes = zip(nuevas);

    // Guardar en el expediente (mismo nombre = se reemplaza la versión anterior)
    const prefijo = await asegurarPrefijo(env, { id_interno: e.id_interno, carpeta: e.carpeta, empresa: empresaNombre, no_empleado: e.no_empleado, nombre: nombreTrabajador });
    const nombreArchivo = limpiarRuta("Contrato_" + idInterno + "_" + nombreTrabajador) + ".docx";
    const key = prefijo + nombreArchivo;
    await env.R2.put(key, bytes, { httpMetadata: { contentType: MIME_DOCX } });
    if (!(await env.R2.head(key))) return error("No se pudo guardar el contrato. Intenta de nuevo.");
    const etiqueta = esUrbanThink ? "Obra determinada (Urban Think)" : (esOperativo ? "Operativo" : "Administrativo");
    const stmts = [env.DB.prepare(
      `INSERT INTO archivos (id_interno, categoria, tipo_documento, r2_key, nombre_original, mime, bytes, subido_por, subido_en)
       VALUES (?, 'contrato', ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(r2_key) DO UPDATE SET bytes = excluded.bytes, subido_por = excluded.subido_por, subido_en = excluded.subido_en,
         tipo_documento = excluded.tipo_documento`
    ).bind(idInterno, "Contrato " + etiqueta, key, nombreArchivo, MIME_DOCX, bytes.length, caller.email)];
    // Igual que GAS: las fechas capturadas en el formulario se guardan en el expediente
    if (ovIni) stmts.push(env.DB.prepare("UPDATE empleados SET contrato1_inicio = ?, actualizado_en = ? WHERE id_interno = ?").bind(ovIni, ahoraISO(), idInterno));
    if (ovFin) stmts.push(env.DB.prepare(`UPDATE empleados SET ${colFin} = ?, actualizado_en = ? WHERE id_interno = ?`).bind(ovFin, ahoraISO(), idInterno));
    await env.DB.batch(stmts);
    await registrarEvento(env, caller.email, caller.rol, "GENERAR_CONTRATO", "Contrato " + etiqueta + " de " + idInterno + " - " + nombreTrabajador, empresaNombre, "");

    return {
      status: "success", message: "Contrato generado correctamente.",
      urlDoc: await urlFirmada(env, key, true),
      urlPdf: "",                       // Cloudflare no convierte Word a PDF: se imprime o guarda como PDF desde Word
      nombreArchivo, tipoIngreso: etiqueta,
    };
  } catch (ex) {
    return error("Error al generar contrato: " + String(ex));
  }
}

// ── Plantillas (nuevas: antes se editaban los Google Docs en Drive) ──
async function listarPlantillas(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  try {
    const plantillas = [];
    for (const [tipo, d] of Object.entries(PLANTILLAS)) {
      const h = await env.R2.head(d.key);
      const meta = (h && h.customMetadata) || {};
      plantillas.push({
        tipo, nombre: d.nombre, existe: !!h, bytes: h ? h.size : 0, actualizada: h ? h.uploaded.toISOString() : "",
        subidaPor: meta.subidaPor || "", campos: meta.campos ? meta.campos.split(",") : [], camposEsperados: d.campos,
        url: h ? await urlFirmada(env, d.key, true) : "",
      });
    }
    return { status: "success", plantillas };
  } catch (e) { return error(String(e)); }
}

// Revisa una plantilla .docx: campos que tiene, desconocidos, partidos y faltantes
async function revisarPlantilla(bytes, tipo) {
  const entradas = leerZip(bytes);
  if (!entradas.some(e => e.nombre === "word/document.xml")) throw new Error("El archivo no es un documento de Word (.docx).");
  const encontrados = new Set(), partidos = new Set();
  for (const en of entradas.filter(x => PARTES_TEXTO.test(x.nombre))) {
    const xml = dec.decode(await contenidoZip(en));
    const crudos = new Set(camposEn(xml));
    textoParrafos(xml).forEach(t => camposEn(t).forEach(c => { encontrados.add(c); if (!crudos.has(c)) partidos.add(c); }));
  }
  const esperados = PLANTILLAS[tipo].campos;
  const todos = new Set([...COMUNES, ...URBAN]);
  return {
    encontrados: [...encontrados],
    desconocidos: [...encontrados].filter(c => !todos.has(c) || (tipo !== "urban_obra" && !COMUNES.includes(c))),
    partidos: [...partidos],
    faltantes: esperados.filter(c => !encontrados.has(c)),
  };
}

async function subirPlantilla(p, env) {
  const caller = await panel(env, p);
  if (!caller) return SESION_INVALIDA;
  if (!caller.esAdmin) return error("Solo el Administrador puede cambiar las plantillas de contrato.");
  const tipo = s(p.tipo);
  if (!PLANTILLAS[tipo]) return error("Tipo de plantilla no válido (operativo, administrativo o urban_obra).");
  try {
    const bytes = b64aBytes(s(p.archivoBase64 || p.base64));
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return error("Archivo vacío o mayor a 8 MB.");
    const r = await revisarPlantilla(bytes, tipo);
    if (r.partidos.length) return error("Estos campos quedaron partidos por formato a la mitad (vuelve a escribirlos completos, sin cambiar formato a media palabra): " +
      r.partidos.map(c => "{{" + c + "}}").join(", "));
    if (r.desconocidos.length) return error("La plantilla tiene campos que el sistema no sabe llenar: " + r.desconocidos.map(c => "{{" + c + "}}").join(", "));
    // Respaldo de la anterior
    const d = PLANTILLAS[tipo], anterior = await env.R2.get(d.key);
    if (anterior) await env.R2.put("plantillas/contratos/anteriores/" + tipo + " " + ahoraISO().slice(0, 19).replace(/[T:]/g, "-") + ".docx",
      await anterior.arrayBuffer(), { httpMetadata: { contentType: MIME_DOCX } });
    await env.R2.put(d.key, bytes, { httpMetadata: { contentType: MIME_DOCX },
      customMetadata: { subidaPor: caller.email, campos: r.encontrados.join(",") } });
    await registrarEvento(env, caller.email, caller.rol, "PLANTILLA_CONTRATO", "Actualizó la plantilla " + d.nombre +
      (r.faltantes.length ? " (sin los campos: " + r.faltantes.join(", ") + ")" : ""), "", "");
    return {
      status: "success", message: "Plantilla actualizada. La anterior quedó respaldada.",
      campos: r.encontrados,
      aviso: r.faltantes.length ? "La plantilla ya no incluye: " + r.faltantes.map(c => "{{" + c + "}}").join(", ") + ". Esos datos no aparecerán en los contratos." : "",
    };
  } catch (e) { return error(String(e.message || e)); }
}

export default {
  obtener_datos_contrato: obtenerDatosContrato,
  generar_contrato: generarContrato,
  listar_plantillas_contrato: listarPlantillas,
  subir_plantilla_contrato: subirPlantilla,
};
