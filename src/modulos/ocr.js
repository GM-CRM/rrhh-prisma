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
const INSTRUCCIONES = `Analiza la imagen de este documento oficial mexicano y responde SOLO con un objeto JSON, sin texto adicional, con estas claves:
{"tipoDocumento":"","nombreTrabajador":"","curp":"","rfc":"","nss":"","domicilioCompleto":"","escolaridad":""}
Reglas:
- tipoDocumento: una de CURP, INE, IMSS, SAT, CFE, TELMEX, AGUA, PASAPORTE, ACTA, TITULO, DESCONOCIDO.
- nombreTrabajador: nombre completo de la PERSONA titular del documento en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). Nunca el nombre de funcionarios, instituciones o empresas.
- curp: exactamente 18 caracteres (4 letras, 6 números de la fecha AAMMDD, H o M, 5 letras, 1 letra o número, 1 número). Cópiala carácter por carácter.
- rfc: 12 o 13 caracteres, solo si aparece una etiqueta RFC. El RFC y la CURP son diferentes.
- nss: Número de Seguridad Social, exactamente 11 dígitos, solo si aparece.
- domicilioCompleto: domicilio de la PERSONA (calle, número, colonia, C.P., municipio, estado), nunca el de la institución o empresa emisora. En la Constancia SAT únelo así: Vialidad No. Exterior, Col. Colonia, C.P. Código, Municipio, Entidad.
- escolaridad: solo en títulos o certificados (Secundaria, Bachillerato, TSU, Licenciatura, Maestría, Doctorado).
- Si un dato no se ve claramente, deja "". No inventes nada.`;

async function extraerConVision(env, b64, mime) {
  let datosImg = String(b64 || "");
  if (!datosImg.startsWith("data:")) datosImg = `data:${mime || "image/png"};base64,` + datosImg.replace(/\s/g, "");
  const resp = await llamarIA(env, [
    { role: "system", content: "Eres un experto en documentos oficiales mexicanos (INE, CURP, SAT, IMSS, comprobantes de domicilio). Respondes únicamente con JSON válido." },
    { role: "user", content: [{ type: "text", text: INSTRUCCIONES }, { type: "image_url", image_url: { url: datosImg } }] },
  ], 400);
  const m = resp.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió datos estructurados.");
  return JSON.parse(m[0]);
}

function limpiarDatos(crudo) {
  const tipo = String(crudo.tipoDocumento || "").toUpperCase().replace(/[^A-Z]/g, "") || "DESCONOCIDO";
  const datos = {};
  const txt = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  if (txt(crudo.nombreTrabajador)) datos.nombreTrabajador = txt(crudo.nombreTrabajador).toUpperCase();
  const curp = corregirCURP(crudo.curp);
  if (curp) datos.curp = curp.replace("?", "");            // el frontend recibe la clave sin la marca
  const rfc = corregirRFC(crudo.rfc);
  if (rfc && (!datos.curp || !datos.curp.startsWith(rfc))) datos.rfc = rfc;
  const nss = String(crudo.nss || "").replace(/\D/g, "");
  if (nss.length === 11) datos.nss = nss;
  if (txt(crudo.domicilioCompleto).length > 5) datos.domicilioCompleto = txt(crudo.domicilioCompleto);
  if (tipo === "TITULO" && txt(crudo.escolaridad)) datos.escolaridad = txt(crudo.escolaridad);
  PROHIBIDOS.forEach(k => delete datos[k]);
  return { tipo, datos, curpDudosa: curp.endsWith("?") };
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
  const { tipo, datos, curpDudosa } = limpiarDatos(crudo);
  console.log(`[OCR] ${tipo} en ${Date.now() - t0} ms: ${JSON.stringify(datos)}`);
  if (!Object.keys(datos).length)
    return error("No se encontraron datos reconocibles. Tipo detectado: " + tipo + ". Verifica que el documento sea legible.");
  const r = { status: "success", datos, tipoDocumento: tipo, motor: "Workers AI (Llama 4 Scout)", ms: Date.now() - t0 };
  if (curpDudosa) r.aviso = "Revisa la CURP: su dígito verificador no coincide.";
  return r;
}

export default {
  groq_ocr: ocrIA,
  gemini_ocr: ocrIA,
  ocr_documento: ocrIA,      // el frontend lo usa como reintento si groq_ocr falla
};
