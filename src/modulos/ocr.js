// ============================================================
//  Módulo OCR / IA — lectura de documentos con Workers AI
//  Reemplaza: Vision API (leer texto) + Groq/Llama (extraer campos)
//  Mismo flujo que groqOCR() de GAS:
//    1) leer el texto de la imagen  → Llama 4 Scout (visión)
//    2) identificar el tipo         → mismas reglas que GAS; si no, la IA
//    3) extraer campos por tipo     → mismas instrucciones que GAS
//    4) respaldo                    → extraerCamposDeTexto() de GAS
//  Acciones: groq_ocr, ocr_documento, gemini_ocr (las 3 que llama el frontend)
// ============================================================
import { s, error } from "../lib/util.js";
import { requiereSesionValida } from "../lib/sesion.js";
import { extraerCamposDeTexto, obtenerInstruccionPorTipo, limpiarYRetornar } from "../lib/ocr_reglas.js";

const MODELO = "@cf/meta/llama-4-scout-17b-16e-instruct";
const PROHIBIDOS = ["tipoDocumento", "fechaNacimiento", "genero", "lugarNacimiento", "nacionalidad", "estadoCivil", "telefonoPersonal", "correoElectronico"];
const TIPOS = ["CURP", "INE", "IMSS", "SAT", "CFE", "TELMEX", "AGUA", "PASAPORTE", "ACTA", "TITULO"];

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

// Paso 1: leer TODO el texto de la imagen (equivale a Vision API)
async function leerTexto(env, b64, mime) {
  let datos = String(b64 || "");
  if (!datos.startsWith("data:")) datos = `data:${mime || "image/png"};base64,` + datos.replace(/\s/g, "");
  return llamarIA(env, [
    {
      role: "system",
      content: "Eres un motor de OCR. Transcribe TODO el texto visible del documento, exactamente como aparece, línea por línea, respetando acentos, mayúsculas y números. No resumas, no expliques, no agregues nada que no esté escrito. Escribe cada etiqueta y su valor en el mismo orden en que aparecen.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Transcribe el texto de este documento mexicano." },
        { type: "image_url", image_url: { url: datos } },
      ],
    },
  ], 1800);
}

// Paso 2: tipo de documento — mismas reglas que analizarTextoConGroq() de GAS
function tipoPorReglas(texto) {
  const t = texto.toUpperCase();
  if (t.includes("CONSTANCIA DE SITUACION FISCAL") || t.includes("CEDULA DE IDENTIFICACION FISCAL")
      || t.includes("SERVICIO DE ADMINISTRACION TRIBUTARIA") || (t.includes("RFC:") && t.includes("PRIMER APELLIDO"))) return "SAT";
  if (t.includes("CLAVE UNICA DE REGISTRO DE POBLACION") || (t.includes("CURP") && t.includes("PRIMER APELLIDO") && !t.includes("CONSTANCIA"))) return "CURP";
  if (t.includes("INSTITUTO NACIONAL ELECTORAL") || t.includes("CREDENCIAL PARA VOTAR") || t.includes("IFE")) return "INE";
  if (t.includes("SEGURO SOCIAL") || t.includes("IMSS")) return "IMSS";
  if (t.includes("COMISION FEDERAL DE ELECTRICIDAD") || t.includes("CFE")) return "CFE";
  if (t.includes("TELMEX") || t.includes("IZZI") || t.includes("TOTALPLAY")) return "TELMEX";
  if (t.includes("AGUA") && t.includes("SERVICIO")) return "AGUA";
  if (t.includes("PASAPORTE") || t.includes("PASSPORT")) return "PASAPORTE";
  if (t.includes("ACTA DE NACIMIENTO")) return "ACTA";
  return "";
}

// Quita acentos para las reglas (Vision devolvía muchas veces sin acentos; la IA los conserva)
const sinAcentos = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "");

async function analizarTexto(env, texto) {
  const textoNorm = sinAcentos(texto);
  let tipoDoc = tipoPorReglas(textoNorm);
  if (!tipoDoc) {
    try {
      const r = await llamarIA(env, [
        { role: "system", content: "Eres un clasificador de documentos mexicanos. Lee el texto y responde UNICAMENTE con UNA de estas palabras: CURP, INE, IMSS, SAT, CFE, TELMEX, AGUA, PASAPORTE, ACTA, TITULO, DESCONOCIDO. Sin explicaciones, solo la palabra." },
        { role: "user", content: "Identifica que tipo de documento es el siguiente texto: " + texto.substring(0, 1500) },
      ], 20);
      tipoDoc = r.toUpperCase().replace(/[^A-Z]/g, "");
      if (!TIPOS.includes(tipoDoc)) tipoDoc = TIPOS.find(x => tipoDoc.includes(x)) || tipoDoc;
    } catch (e) { console.log("[OCR] Clasificación IA falló: " + e); }
  }
  const respaldo = () => {
    const r = limpiarYRetornar(extraerCamposDeTexto(textoNorm));
    if (r && r.status === "success") r.motor = "Reglas (respaldo)";
    return r;
  };
  const instruccion = obtenerInstruccionPorTipo(tipoDoc, texto);
  if (!instruccion) return respaldo();

  let respDatos = "";
  try {
    respDatos = await llamarIA(env, [
      { role: "system", content: "Extrae los datos exactamente como se indica. Responde SOLO con JSON valido, sin texto adicional." },
      { role: "user", content: instruccion },
    ], 400);
  } catch (e) { console.log("[OCR] Extracción IA falló: " + e); return respaldo(); }

  try {
    const m = respDatos.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Sin JSON");
    const datos = JSON.parse(m[0]);
    PROHIBIDOS.forEach(k => delete datos[k]);
    Object.keys(datos).forEach(k => { if (datos[k] === null || datos[k] === undefined || String(datos[k]).trim() === "") delete datos[k]; });
    // Validaciones de formato: lo que no cumpla, se descarta (mejor vacío que equivocado)
    if (datos.curp && !/^[A-Z]{4}\d{6}[HMX][A-Z]{2}[A-Z0-9]{3}[0-9A-Z]\d$/.test(String(datos.curp).toUpperCase().replace(/\s/g, ""))) delete datos.curp;
    else if (datos.curp) datos.curp = String(datos.curp).toUpperCase().replace(/\s/g, "");
    if (datos.rfc && !/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(String(datos.rfc).toUpperCase().replace(/\s/g, ""))) delete datos.rfc;
    else if (datos.rfc) datos.rfc = String(datos.rfc).toUpperCase().replace(/\s/g, "");
    if (datos.nss) { const n = String(datos.nss).replace(/\D/g, ""); if (n.length === 11) datos.nss = n; else delete datos.nss; }
    if (!Object.keys(datos).length) return respaldo();
    return { status: "success", datos, tipoDocumento: tipoDoc, motor: "Workers AI (Llama 4 Scout)" };
  } catch (e) {
    console.log("[OCR] JSON inválido: " + e + " | " + respDatos.substring(0, 200));
    return respaldo();
  }
}

// ── groq_ocr / gemini_ocr: lectura + IA ───────────────────────
async function ocrIA(p, env) {
  if (!(await requiereSesionValida(env, p))) return { status: "error", message: "Sesión inválida o expirada." };
  if (!p.data) return error("No se recibio el archivo.");
  const mime = s(p.mimeType) || "image/jpeg";
  if (mime === "application/pdf") return error("Convierte el PDF a imagen antes de enviarlo (el sistema lo hace automáticamente en el navegador).");
  if (!env.AI) return error("La IA de Cloudflare no está configurada (binding AI).");
  let texto = "";
  try { texto = await leerTexto(env, p.data, mime); }
  catch (e) { console.log("[OCR] Lectura falló: " + e); return error("No se pudo leer el documento con la IA: " + (e.message || e)); }
  if (!texto || texto.length < 10) return error("No se pudo extraer texto del documento para analizar.");
  return analizarTexto(env, texto);
}

// ── ocr_documento: lectura + reglas (sin segundo paso de IA) ──
async function ocrReglas(p, env) {
  if (!(await requiereSesionValida(env, p))) return { status: "error", message: "Sesión inválida o expirada." };
  if (!p.data) return error("No se recibió el archivo.");
  const mime = s(p.mimeType) || "image/jpeg";
  if (!env.AI) return error("La IA de Cloudflare no está configurada (binding AI).");
  try {
    const texto = await leerTexto(env, p.data, mime);
    if (!texto || texto.length < 10) return error("No se pudo extraer texto del documento.");
    const r = limpiarYRetornar(extraerCamposDeTexto(sinAcentos(texto)));
    if (r && r.status === "success") r.motor = "Workers AI + reglas";
    return r;
  } catch (e) {
    return error("Error en OCR: " + (e.message || e));
  }
}

export default {
  groq_ocr: ocrIA,
  gemini_ocr: ocrIA,
  ocr_documento: ocrReglas,
};
