// ============================================================
//  Módulo OCR / IA — lectura de documentos con Workers AI
//  Reemplaza: Vision API (leer texto) + Groq/Llama (extraer campos)
//  v2: UNA sola consulta — Llama 4 Scout ve la imagen y devuelve el tipo
//  de documento y los campos en JSON (antes: transcribir + clasificar +
//  extraer = 2-3 consultas y >25 s). Las reglas e instrucciones por tipo
//  de GAS se conservan dentro de la instrucción.
//  Después: corrección de CURP/RFC por posición + dígito verificador.
//  Acciones: groq_ocr, ocr_documento, gemini_ocr (las 3 que llama el frontend)
// ============================================================
import { s, error } from "../lib/util.js";
import { requiereSesionValida } from "../lib/sesion.js";
import { leerDocumentoTexto, leerMRZ, ordenarNombreConCURP, curpValida, nssValido, normalizarTexto } from "../lib/lectura_documentos.js";

const MODELO = "@cf/meta/llama-4-scout-17b-16e-instruct";
const PROHIBIDOS = ["tipoDocumento", "fechaNacimiento", "genero", "lugarNacimiento", "nacionalidad", "estadoCivil", "telefonoPersonal", "correoElectronico"];

function textoDeRespuesta(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (typeof r.response === "string") return r.response;
  if (r.response && typeof r.response === "object") return JSON.stringify(r.response);
  if (r.choices && r.choices[0]) return (r.choices[0].message && r.choices[0].message.content) || r.choices[0].text || "";
  return "";
}

async function llamarIA(env, mensajes, maxTokens) {
  const r = await env.AI.run(MODELO, { messages: mensajes, max_tokens: maxTokens || 300, temperature: 0.05 });
  return textoDeRespuesta(r).trim();
}

// ── Corrección de CURP / RFC por posición + dígito verificador ─
const A_NUM = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", T: "7", B: "8" };
const A_LET = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B", "4": "A", "7": "T" };
const CURP_PATRON = "LLLLNNNNNNLLLLLLAN";   // L = letra, N = número, A = letra o número
const CURP_RE = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;

function digitoCURP(c17) {
  const dic = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += dic.indexOf(c17[i]) * (18 - i);
  const d = 10 - (suma % 10);
  return d === 10 ? "0" : String(d);
}

export function corregirCURP(valor) {
  let c = String(valor || "").toUpperCase().replace(/[^A-Z0-9Ñ]/g, "");
  if (c.length !== 18) return "";
  c = [...c].map((ch, i) => {
    const tipo = CURP_PATRON[i];
    if (tipo === "N" && A_NUM[ch]) return A_NUM[ch];
    if (tipo === "L" && A_LET[ch]) return A_LET[ch];
    return ch;
  }).join("");
  if (!CURP_RE.test(c)) return "";
  // Dígito verificador: si no cuadra, probar las confusiones típicas en la posición 17
  if (digitoCURP(c.slice(0, 17)) !== c[17]) {
    const alt = c[16] === "0" ? "O" : c[16] === "O" ? "0" : c[16] === "1" ? "I" : c[16] === "I" ? "1" : null;
    if (alt && digitoCURP(c.slice(0, 16) + alt) === c[17]) c = c.slice(0, 16) + alt + c[17];
    else return c + "?";                                  // formato válido pero no cuadra: se marca
  }
  return c;
}

export function corregirRFC(valor) {
  let r = String(valor || "").toUpperCase().replace(/[^A-Z0-9&Ñ]/g, "");
  if (r.length !== 12 && r.length !== 13) return "";
  const nl = r.length === 13 ? 4 : 3;                      // persona física 4 letras, moral 3
  r = [...r].map((ch, i) => {
    if (i < nl && A_LET[ch]) return A_LET[ch];
    if (i >= nl && i < nl + 6 && A_NUM[ch]) return A_NUM[ch];
    return ch;
  }).join("");
  return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(r) ? r : "";
}

// ── Una sola consulta: la IA ve la imagen y devuelve tipo + campos ─
// Cada página llega por separado (frente y reverso del INE son dos consultas)
// y en un tamaño legible: antes se pegaban todas en una imagen gigante.
const INSTRUCCIONES = `Mira la imagen de este documento mexicano y responde SOLO con un objeto JSON, sin texto adicional, con estas claves:
{"tipoDocumento":"","nombreTrabajador":"","curp":"","rfc":"","nss":"","domicilioCompleto":"","titularComprobante":"","mrz":"","escolaridad":""}

1) tipoDocumento: elige UNO.
- INE_FRENTE: dice "INSTITUTO NACIONAL ELECTORAL" y "CREDENCIAL PARA VOTAR"; trae foto, NOMBRE, DOMICILIO, CLAVE DE ELECTOR y CURP.
- INE_REVERSO: tiene códigos QR y al pie 3 renglones con letras, números y signos "<" (el primero empieza con IDMEX).
- CURP: constancia de la Clave Única de Registro de Población (RENAPO).
- SAT: Constancia de Situación Fiscal o Cédula de Identificación Fiscal.
- IMSS: asignación o localización del Número de Seguridad Social.
- COMPROBANTE: recibo de luz (CFE), agua, teléfono, internet, gas, predial o estado de cuenta.
- ACTA: acta de nacimiento.  - PASAPORTE.  - ESTUDIOS: título, cédula profesional o certificado.  - DESCONOCIDO.

2) Dónde está cada dato:
- INE_FRENTE: debajo de "NOMBRE" vienen 3 renglones: apellido paterno, apellido materno y nombre(s); escríbelos en ese mismo orden. "DOMICILIO" tiene 3 renglones (calle y número; colonia y código postal; municipio y estado): únelos con comas. "curp" es la clave de 18 caracteres junto a la etiqueta CURP; NO es la "CLAVE DE ELECTOR".
- INE_REVERSO: copia los 3 renglones del pie EXACTAMENTE como se ven, con todos sus "<", separados por \\n, en "mrz". Deja lo demás vacío.
- COMPROBANTE: el nombre impreso es del titular del servicio y puede ser otra persona: ponlo en "titularComprobante" y deja "nombreTrabajador" vacío. El domicilio son los renglones debajo de ese nombre (calle y número, colonia, C.P., municipio, estado). Nunca uses la dirección de la empresa que emite el recibo.
- ACTA: el nombre de la persona registrada, no el de sus padres.
- ESTUDIOS: "escolaridad" con uno de: Secundaria, Bachillerato, Técnico, TSU, Licenciatura, Maestría, Doctorado.

3) Formato: todo en MAYÚSCULAS. nombreTrabajador como APELLIDO PATERNO APELLIDO MATERNO NOMBRE(S). curp de 18 caracteres. rfc (12 o 13) solo si dice RFC. nss (11 dígitos) solo si dice NSS o Seguridad Social.
Si un dato no se lee con claridad, déjalo vacío. No inventes nada.`;

async function extraerConVision(env, b64, mime) {
  let datosImg = String(b64 || "");
  if (!datosImg.startsWith("data:")) datosImg = `data:${mime || "image/png"};base64,` + datosImg.replace(/\s/g, "");
  const resp = await llamarIA(env, [
    { role: "system", content: "Eres un experto en documentos oficiales mexicanos. Lees con cuidado cada carácter y respondes únicamente con JSON válido." },
    { role: "user", content: [{ type: "text", text: INSTRUCCIONES }, { type: "image_url", image_url: { url: datosImg } }] },
  ], 600);
  const m = resp.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió datos estructurados.");
  return JSON.parse(m[0]);
}

// Texto de un PDF digital que no es SAT/CURP/IMSS (p. ej. un recibo descargado):
// la IA lee el texto, que es mucho más confiable que leer una imagen
async function extraerDeTextoConIA(env, texto) {
  const resp = await llamarIA(env, [
    { role: "system", content: "Eres un experto en documentos oficiales mexicanos. Respondes únicamente con JSON válido." },
    { role: "user", content: INSTRUCCIONES.replace("Mira la imagen de este documento mexicano", "Este es el TEXTO de un documento mexicano") + "\n\nTEXTO DEL DOCUMENTO:\n" + String(texto).slice(0, 6000) },
  ], 600);
  const m = resp.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió datos estructurados.");
  return JSON.parse(m[0]);
}

function limpiarDatos(crudo) {
  let tipo = String(crudo.tipoDocumento || "").toUpperCase().replace(/[^A-Z_]/g, "") || "DESCONOCIDO";
  let lado = "";
  if (tipo.startsWith("INE")) { lado = tipo.includes("REVERSO") ? "reverso" : "frente"; tipo = "INE"; }
  if (["CFE", "TELMEX", "AGUA"].includes(tipo)) tipo = "COMPROBANTE";
  if (tipo === "TITULO") tipo = "ESTUDIOS";
  const datos = {}, notas = [];
  const txt = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  // Zona "<<<" del reverso del INE: nombre y fecha de nacimiento muy confiables
  const mrz = leerMRZ(crudo.mrz);
  const curp = corregirCURP(crudo.curp);
  if (curp) datos.curp = curp.replace("?", "");
  let nombre = txt(crudo.nombreTrabajador).toUpperCase();
  if (mrz.nombre) { nombre = mrz.nombre; lado = "reverso"; }
  if (nombre && datos.curp && !curp.endsWith("?")) nombre = ordenarNombreConCURP(nombre, datos.curp) || nombre;
  if (nombre && tipo !== "COMPROBANTE") datos.nombreTrabajador = nombre;
  const rfc = corregirRFC(crudo.rfc);
  if (rfc && (!datos.curp || !datos.curp.startsWith(rfc))) datos.rfc = rfc;
  const nss = String(crudo.nss || "").replace(/\D/g, "");
  if (nss.length === 11) { datos.nss = nss; if (!nssValido(nss)) notas.push("Revisa el NSS: su dígito verificador no coincide."); }
  if (txt(crudo.domicilioCompleto).length > 5 && tipo !== "SAT") datos.domicilioCompleto = txt(crudo.domicilioCompleto).toUpperCase();
  if (tipo === "ESTUDIOS" && txt(crudo.escolaridad)) datos.escolaridad = txt(crudo.escolaridad);
  if (curp.endsWith("?")) notas.push("Revisa la CURP: su dígito verificador no coincide.");
  PROHIBIDOS.forEach(k => delete datos[k]);
  return { tipo, lado, datos, notas, titular: tipo === "COMPROBANTE" ? txt(crudo.titularComprobante || crudo.nombreTrabajador).toUpperCase() : "", nacimientoMRZ: mrz.nacimiento || "" };
}

function mensajeErrorIA(e) {
  const m = String((e && e.message) || e);
  if (/3036|allocation|quota|neuron/i.test(m))
    return "Se agotó la cuota gratuita diaria de IA de Cloudflare. Captura los datos a mano o vuelve a intentar mañana.";
  if (/too large|payload|size|dimension/i.test(m))
    return "La imagen es demasiado grande para la IA. Recórtala o tómala con menor resolución.";
  return "No se pudo leer el documento con la IA: " + m;
}

// ── groq_ocr / gemini_ocr / ocr_documento ─────────────────────
async function ocrIA(p, env) {
  if (!(await requiereSesionValida(env, p))) return { status: "error", message: "Sesión inválida o expirada." };
  if (!p.data) return error("No se recibio el archivo.");
  const mime = s(p.mimeType) || "image/jpeg";
  if (mime === "application/pdf") return error("Convierte el PDF a imagen antes de enviarlo (el sistema lo hace automáticamente en el navegador).");
  if (!env.AI) return error("La IA de Cloudflare no está configurada (binding AI).");
  const t0 = Date.now();
  let crudo;
  try { crudo = await extraerConVision(env, p.data, mime); }
  catch (e) { console.log("[OCR] " + e); return error(mensajeErrorIA(e)); }
  const L = limpiarDatos(crudo);
  console.log(`[OCR] ${L.tipo} ${L.lado} en ${Date.now() - t0} ms`);
  if (!Object.keys(L.datos).length && !L.titular)
    return { status: "error", message: "No se encontraron datos reconocibles (tipo detectado: " + L.tipo + "). Verifica que el documento se vea completo y legible.", tipoDocumento: L.tipo };
  const r = { status: "success", datos: L.datos, tipoDocumento: L.tipo, lado: L.lado, notas: L.notas, titular: L.titular, metodo: "ia-imagen", ms: Date.now() - t0 };
  // Diagnóstico: lo que la IA leyó antes de validar (visible en la consola; el frontend no lo usa)
  r.crudo = { curp: s(crudo.curp), rfc: s(crudo.rfc), nss: s(crudo.nss), mrz: s(crudo.mrz) };
  if (L.notas.length) r.aviso = L.notas.join(" ");
  return r;
}

// ── leer_documento_texto: PDF digital (el navegador ya sacó el texto) ──
async function leerTexto(p, env) {
  if (!(await requiereSesionValida(env, p))) return { status: "error", message: "Sesión inválida o expirada." };
  const texto = String(p.texto || "");
  if (texto.replace(/\s/g, "").length < 40) return error("El PDF no trae texto: se leerá como imagen.");
  const t0 = Date.now();
  const L = leerDocumentoTexto(texto);
  if (L.completo) return { status: "success", datos: L.datos, tipoDocumento: L.tipo, notas: L.notas, metodo: "texto", ms: Date.now() - t0 };
  // Otro PDF con texto (recibo descargado, acta digital…): la IA lee ese texto
  if (env.AI) {
    try {
      const crudo = await extraerDeTextoConIA(env, texto);
      const V = limpiarDatos(crudo);
      const datos = Object.assign({}, V.datos, L.datos);          // lo leído por etiquetas manda
      if (Object.keys(datos).length || V.titular)
        return { status: "success", datos, tipoDocumento: V.tipo !== "DESCONOCIDO" ? V.tipo : L.tipo, notas: V.notas, titular: V.titular, metodo: "ia-texto", ms: Date.now() - t0 };
    } catch (e) { console.log("[OCR texto] " + e); }
  }
  if (Object.keys(L.datos).length) return { status: "success", datos: L.datos, tipoDocumento: L.tipo, notas: L.notas, metodo: "texto", ms: Date.now() - t0 };
  return error("No se encontraron datos reconocibles en el texto del PDF.");
}

export default {
  groq_ocr: ocrIA,
  gemini_ocr: ocrIA,
  ocr_documento: ocrIA,      // el frontend lo usa como reintento si groq_ocr falla
  leer_documento_texto: leerTexto,
};
