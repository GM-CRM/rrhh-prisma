// ============================================================
//  Lectura de documentos con TEXTO (PDF digitales: SAT, CURP, IMSS…)
//  Sin IA: el PDF ya trae el texto exacto, así que se lee por etiquetas.
//  Para fotos y escaneos (INE, recibos) está la IA en modulos/ocr.js.
//
//  Reglas de oro:
//   · El nombre se entrega como APELLIDO PATERNO APELLIDO MATERNO NOMBRE(S).
//     Cuando el documento lo trae junto ("ARMANDO DOMINGUEZ RENTERIA"),
//     el orden se deduce con las letras de la CURP.
//   · Un comprobante de domicilio puede estar a nombre de otra persona:
//     de él solo se toma el domicilio, nunca el nombre.
// ============================================================

const CURP_RE = /\b([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HMX](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-ZÑ]{3}[A-Z\d]\d)\b/;
const RFC_RE = /\b([A-ZÑ&]{4}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[A-Z\d]{3})\b/;
const DIC_CURP = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

export function curpValida(c) {
  c = String(c || "").toUpperCase();
  if (!CURP_RE.test(c) || c.length !== 18) return false;
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += DIC_CURP.indexOf(c[i]) * (18 - i);
  return String((10 - (suma % 10)) % 10) === c[17];
}
export function nssValido(n) {
  n = String(n || "").replace(/\D/g, "");
  if (n.length !== 11) return false;
  let s = 0;
  for (let i = 0; i < 10; i++) { let d = +n[i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } s += d; }
  return (10 - (s % 10)) % 10 === +n[10];
}

// Texto en mayúsculas, sin acentos y con espacios simples (para buscar etiquetas)
export function normalizarTexto(t) {
  return String(t || "").toUpperCase()
    .replace(/[ÁÀÄ]/g, "A").replace(/[ÉÈË]/g, "E").replace(/[ÍÌÏ]/g, "I").replace(/[ÓÒÖ]/g, "O").replace(/[ÚÙÜ]/g, "U")
    .replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n");
}
const una = t => t.replace(/\s+/g, " ").trim();
const entre = (t, desde, hasta) => {
  const m = t.match(new RegExp(desde + "\\s*(.*?)\\s*(?:" + hasta + ")", "s"));
  return m ? una(m[1]) : "";
};

// ── Nombre con el orden correcto usando la CURP ───────────────
const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "MC", "MAC", "VAN", "VON", "DA", "DI"]);
const NOMBRES_COMUNES = new Set(["JOSE", "J", "MARIA", "MA", "MA."]);
const primeraVocalInterna = p => { const m = p.slice(1).match(/[AEIOU]/); return m ? m[0] : "X"; };
const sinParticulas = ws => ws.filter(w => !PARTICULAS.has(w));

// ¿"pat mat nombres" cuadra con las 4 primeras letras de la CURP?
function cuadraConCURP(pat, mat, nombres, curp) {
  const P = sinParticulas(pat)[0] || "", M = sinParticulas(mat)[0] || "";
  const N = sinParticulas(nombres);
  if (!P || !N.length) return false;
  const nom = N.length > 1 && NOMBRES_COMUNES.has(N[0]) ? N[1] : N[0];
  const letra = x => (x[0] === "Ñ" ? "X" : x[0]);
  return curp[0] === letra(P) && curp[1] === primeraVocalInterna(P) &&
         curp[2] === (M ? letra(M) : "X") && curp[3] === letra(nom);
}

// Recibe "ARMANDO DOMINGUEZ RENTERIA" (cualquier orden) y la CURP → "DOMINGUEZ RENTERIA ARMANDO"
export function ordenarNombreConCURP(nombre, curp) {
  const w = normalizarTexto(nombre).replace(/[^A-ZÑ ]/g, " ").split(/\s+/).filter(Boolean);
  curp = String(curp || "").toUpperCase();
  if (w.length < 2 || curp.length < 4) return "";
  // Prueba todos los cortes posibles: [nombres][paterno][materno] y [paterno][materno][nombres]
  for (let i = 1; i < w.length; i++) {
    for (let j = i + 1; j <= w.length; j++) {
      const a = w.slice(0, i), b = w.slice(i, j), c = w.slice(j);
      if (c.length && cuadraConCURP(b, c, a, curp)) return [...b, ...c, ...a].join(" ");   // NOMBRE PAT MAT
      if (c.length && cuadraConCURP(a, b, c, curp)) return [...a, ...b, ...c].join(" ");   // PAT MAT NOMBRE
      if (!c.length && cuadraConCURP(b, [], a, curp)) return [...b, ...a].join(" ");        // NOMBRE PAT (sin materno)
      if (!c.length && cuadraConCURP(a, [], b, curp)) return [...a, ...b].join(" ");        // PAT NOMBRE
    }
  }
  return "";
}

// Busca en el texto un renglón que sea el nombre de la persona de esa CURP
function nombrePorCURP(t, curp) {
  const candidatos = new Set();
  for (const lin of t.split("\n")) {
    const l = una(lin).replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
    const n = l.split(" ").length;
    if (n >= 2 && n <= 7 && l.length <= 70) candidatos.add(l);
  }
  // También dos renglones seguidos (el IMSS parte el nombre en dos)
  const lineas = t.split("\n").map(x => una(x));
  for (let i = 0; i + 1 < lineas.length; i++) {
    const l = (lineas[i] + " " + lineas[i + 1]).replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
    const n = l.split(" ").length;
    if (n >= 3 && n <= 7 && l.length <= 70) candidatos.add(l);
  }
  for (const c of candidatos) { const r = ordenarNombreConCURP(c, curp); if (r) return r; }
  return "";
}

// ── Tipo de documento por su texto ────────────────────────────
export function tipoPorTexto(t) {
  if (/CONSTANCIA DE SITUACION FISCAL|CEDULA DE IDENTIFICACION FISCAL/.test(t)) return "SAT";
  if (/NUMERO DE SEGURIDAD SOCIAL ES|ASIGNACION O LOCALIZACION DE NUMERO DE SEGURIDAD SOCIAL/.test(t)) return "IMSS";
  if (/CLAVE UNICA DE REGISTRO DE POBLACION|CURP CERTIFICADA|ENTIDAD DE REGISTRO/.test(t)) return "CURP";
  if (/INSTITUTO NACIONAL ELECTORAL|CREDENCIAL PARA VOTAR/.test(t)) return "INE";
  if (/ACTA DE NACIMIENTO/.test(t)) return "ACTA";
  if (/COMISION FEDERAL DE ELECTRICIDAD|\bCFE\b/.test(t)) return "COMPROBANTE";
  if (/TELMEX|TOTALPLAY|IZZI|MEGACABLE|INTERAPAS|SIAPA|AGUA POTABLE|GAS NATURAL|NATURGY|PREDIAL/.test(t)) return "COMPROBANTE";
  if (/TITULO PROFESIONAL|CEDULA PROFESIONAL|CERTIFICADO DE (?:ESTUDIOS|BACHILLERATO|SECUNDARIA)/.test(t)) return "ESTUDIOS";
  return "DESCONOCIDO";
}

// ── Lectores por tipo ─────────────────────────────────────────
function leerSAT(t) {
  const d = {}, notas = [];
  const rfc = (t.match(/RFC:\s*([A-ZÑ&]{3,4}\d{6}[A-Z\d]{3})/) || [])[1];
  const curp = (t.match(/CURP:\s*([A-Z0-9]{18})/) || [])[1];
  if (rfc) d.rfc = rfc;
  if (curp && curpValida(curp)) d.curp = curp;
  const nom = entre(t, "NOMBRE \\(S\\):", "PRIMER APELLIDO");
  const pat = entre(t, "PRIMER APELLIDO:", "SEGUNDO APELLIDO");
  const mat = entre(t, "SEGUNDO APELLIDO:", "FECHA INICIO|FECHA DE INICIO|ESTATUS");
  if (pat && nom) d.nombreTrabajador = [pat, mat, nom].filter(Boolean).join(" ");
  // Domicilio fiscal: etiquetas fijas de la constancia
  const cp = (t.match(/CODIGO POSTAL:\s*(\d{5})/) || [])[1] || "";
  const tipoV = entre(t, "TIPO DE VIALIDAD:", "NOMBRE DE VIALIDAD|\\n");
  const vial = entre(t, "NOMBRE DE VIALIDAD:", "NUMERO EXTERIOR");
  const ext = entre(t, "NUMERO EXTERIOR:", "NUMERO INTERIOR");
  const int = entre(t, "NUMERO INTERIOR:", "NOMBRE DE LA COLONIA");
  let col = entre(t, "NOMBRE DE LA COLONIA:", "NOMBRE DE LA LOCALIDAD");
  const mun = entre(t, "(?:NOMBRE DEL MUNICIPIO O DEMARCACION TERRITORIAL|NOMBRE DEL MUNICIPIO):", "NOMBRE DE LA ENTIDAD");
  const ent = entre(t, "NOMBRE DE LA ENTIDAD FEDERATIVA:", "ENTRE CALLE|\\n");
  if (/NO ESPECIFICADA|SIN NOMBRE/.test(col)) col = "";
  if (vial) {
    const calle = [tipoV && tipoV !== "CALLE" ? tipoV : (tipoV ? "CALLE" : ""), vial, ext, int ? "INT. " + int : ""].filter(Boolean).join(" ");
    d.domicilioCompleto = [calle, col ? "COL. " + col : "", cp ? "C.P. " + cp : "", mun, ent].filter(Boolean).join(", ");
  }
  return { d, notas };
}
function leerCURP(t) {
  const d = {};
  const m = t.match(CURP_RE);
  if (m && curpValida(m[1])) { d.curp = m[1]; const n = nombrePorCURP(t, m[1]); if (n) d.nombreTrabajador = n; }
  return { d, notas: [] };
}
function leerIMSS(t) {
  const d = {};
  const nss = (t.match(/SEGURIDAD\s+SOCIAL\s+ES:?\s*(\d{11})/) || t.match(/NUMERO DE SEGURIDAD SOCIAL:\s*(\d{11})/) || [])[1];
  if (nss && nssValido(nss)) d.nss = nss;
  const m = t.match(CURP_RE);
  if (m && curpValida(m[1])) {
    d.curp = m[1];
    const cadena = (t.match(/RAZON SOCIAL:\s*([A-ZÑ ]+?)\s*\|/) || [])[1];
    d.nombreTrabajador = (cadena && ordenarNombreConCURP(cadena, m[1])) || nombrePorCURP(t, m[1]) || undefined;
    if (!d.nombreTrabajador) delete d.nombreTrabajador;
  }
  return { d, notas: [] };
}
// Cualquier otro PDF con texto: solo lo que se identifica sin dudar
function leerGenerico(t) {
  const d = {};
  const c = t.match(CURP_RE);
  if (c && curpValida(c[1])) d.curp = c[1];
  const r = t.match(/R\.?F\.?C\.?:?\s*([A-ZÑ&]{4}\d{6}[A-Z\d]{3})/);
  if (r) d.rfc = r[1];
  const n = t.match(/(?:NSS|N\.S\.S\.|SEGURIDAD SOCIAL)[^\d]{0,20}(\d{11})/);
  if (n && nssValido(n[1])) d.nss = n[1];
  if (d.curp) { const nom = nombrePorCURP(t, d.curp); if (nom) d.nombreTrabajador = nom; }
  return { d, notas: [] };
}

// Punto de entrada: texto completo del PDF → { tipo, datos, completo }
// completo = false cuando conviene pedir ayuda a la IA (p. ej. un recibo con texto)
export function leerDocumentoTexto(textoOriginal) {
  const t = normalizarTexto(textoOriginal);
  const tipo = tipoPorTexto(t);
  const lector = { SAT: leerSAT, CURP: leerCURP, IMSS: leerIMSS }[tipo] || leerGenerico;
  const { d, notas } = lector(t);
  Object.keys(d).forEach(k => { if (!d[k]) delete d[k]; });
  const completo = ["SAT", "CURP", "IMSS"].includes(tipo) && Object.keys(d).length > 0;
  return { tipo, datos: d, notas, completo };
}

// ── Zona de lectura mecánica (MRZ) del reverso del INE ────────
// IDMEX…<<…   /   AAMMDD#SAAMMDD#MEX<…   /   PATERNO<MATERNO<<NOMBRE<<<
export function leerMRZ(texto) {
  const lineas = String(texto || "").toUpperCase().replace(/[«‹]/g, "<").replace(/ /g, "").split(/\n|\\n|\|/).map(x => x.trim()).filter(x => x.length >= 20);
  const out = {};
  const lNom = lineas.find(l => /^[A-Z<]{10,}$/.test(l) && l.includes("<<") && /[A-Z]/.test(l));
  if (lNom) {
    const [aps, noms] = lNom.split("<<");
    const ap = (aps || "").split("<").filter(Boolean), nm = (noms || "").split("<").filter(Boolean);
    if (ap.length && nm.length) out.nombre = [...ap, ...nm].join(" ");
  }
  const lFecha = lineas.find(l => /^\d{6}\d[HMF<]\d{6}/.test(l));
  if (lFecha) {
    out.nacimiento = lFecha.slice(0, 6);                    // AAMMDD
    out.sexo = lFecha[7];                                  // H o M
  }
  return out;
}
