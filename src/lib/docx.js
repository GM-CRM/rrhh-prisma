// ============================================================
//  Generador mínimo de Word (.docx) — sin dependencias
//  Reemplaza a DocumentApp de Google para el Informe NOM-035 7.7.
//  Un .docx es un ZIP con XML adentro; aquí se arma "sin compresión"
//  (método store), que Word, LibreOffice y Google Docs abren igual y
//  casi no gasta CPU del Worker.
// ============================================================
const enc = new TextEncoder();

// ── ZIP (store) ───────────────────────────────────────────────
let TABLA_CRC = null;
function crc32(b) {
  if (!TABLA_CRC) {
    TABLA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      TABLA_CRC[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// archivos: [{ nombre, datos }]              → se guarda sin compresión (store)
//           [{ nombre, crudo: {metodo, crc, comprimido, tam} }] → se copia tal cual
//           (imágenes y demás partes de una plantilla: no se descomprimen)
export function zip(archivos) {
  const partes = [], central = [];
  let offset = 0;
  const fecha = new Date(), dosT = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dosD = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    let metodo = 0, crc, datos, tam;
    if (a.crudo) { metodo = a.crudo.metodo; crc = a.crudo.crc; datos = a.crudo.comprimido; tam = a.crudo.tam; }
    else { datos = typeof a.datos === "string" ? enc.encode(a.datos) : a.datos; crc = crc32(datos); tam = datos.length; }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, metodo, true); lh.setUint16(10, dosT, true); lh.setUint16(12, dosD, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, datos.length, true); lh.setUint32(22, tam, true);
    lh.setUint16(26, nombre.length, true); lh.setUint16(28, 0, true);
    partes.push(new Uint8Array(lh.buffer), nombre, datos);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, metodo, true); ch.setUint16(12, dosT, true); ch.setUint16(14, dosD, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, datos.length, true); ch.setUint32(24, tam, true);
    ch.setUint16(28, nombre.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nombre);
    offset += 30 + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((n, x) => n + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((n, x) => n + x.length, 0));
  let p = 0;
  for (const x of todo) { out.set(x, p); p += x.length; }
  return out;
}

// Lee un ZIP (.docx): [{ nombre, metodo, crc, comprimido, tam }] — sin descomprimir
export function leerZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("El archivo no es un .docx válido (no es un ZIP).");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP dañado (directorio central).");
    const metodo = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true);
    const comp = v.getUint32(p + 20, true), tam = v.getUint32(p + 24, true);
    const nLen = v.getUint16(p + 28, true), xLen = v.getUint16(p + 30, true), cLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + nLen));
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    out.push({ nombre, metodo, crc, comprimido: bytes.subarray(ini, ini + comp), tam });
    p += 46 + nLen + xLen + cLen;
  }
  return out;
}

// Contenido descomprimido de una entrada (método 0 = store, 8 = deflate)
export async function contenidoZip(e) {
  if (e.metodo === 0) return e.comprimido;
  if (e.metodo !== 8) throw new Error("Compresión no soportada en " + e.nombre);
  const s = new Blob([e.comprimido]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// Entrada nueva comprimida (deflate, nativo del Worker) para meter en zip()
export async function entradaComprimida(nombre, datos) {
  const raw = typeof datos === "string" ? enc.encode(datos) : datos;
  const s = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const comprimido = new Uint8Array(await new Response(s).arrayBuffer());
  return { nombre, crudo: { metodo: 8, crc: crc32(raw), comprimido, tam: raw.length } };
}

// ── XML de Word ───────────────────────────────────────────────
const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
function run(texto, o = {}) {
  const pr = (o.bold ? "<w:b/>" : "") + (o.italic ? "<w:i/>" : "") + (o.color ? `<w:color w:val="${o.color.replace("#", "")}"/>` : "") +
    (o.size ? `<w:sz w:val="${Math.round(o.size * 2)}"/><w:szCs w:val="${Math.round(o.size * 2)}"/>` : "");
  return `<w:r>${pr ? "<w:rPr>" + pr + "</w:rPr>" : ""}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`;
}
const parrafo = (contenido, ppr = "") => `<w:p>${ppr ? "<w:pPr>" + ppr + "</w:pPr>" : ""}${contenido}</w:p>`;
const conEstilo = e => `<w:pStyle w:val="${e}"/>`;

export class DocumentoWord {
  constructor() { this.cuerpo = []; }
  titulo(t) { this.cuerpo.push(parrafo(run(t), conEstilo("Title"))); return this; }
  subtitulo(t) { this.cuerpo.push(parrafo(run(t), conEstilo("Subtitle"))); return this; }
  h1(t) { this.cuerpo.push(parrafo(run(t), conEstilo("Heading1"))); return this; }
  h2(t) { this.cuerpo.push(parrafo(run(t), conEstilo("Heading2"))); return this; }
  p(t, o = {}) { this.cuerpo.push(parrafo(run(t, o))); return this; }
  vineta(t) { this.cuerpo.push(parrafo(run(t), conEstilo("ListParagraph") + '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')); return this; }
  linea() { this.cuerpo.push(parrafo("", '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D9D9D9"/></w:pBdr>')); return this; }
  // filas: [[celda, celda…]]; o.encabezado = primera fila en negritas; o.colNegrita = primera columna en negritas
  tabla(filas, o = {}) {
    const ncol = Math.max(...filas.map(f => f.length));
    const ancho = 9360;                                    // carta con márgenes de ~2 cm (twips)
    const primera = o.anchoPrimera || (ncol === 2 ? 3400 : Math.round(ancho / ncol * 1.6));
    const resto = ncol > 1 ? Math.floor((ancho - primera) / (ncol - 1)) : ancho;
    const anchos = [primera, ...Array(Math.max(0, ncol - 1)).fill(resto)];
    const borde = '<w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/>';
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${ancho}" w:type="dxa"/><w:tblBorders>${borde}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
      '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      `<w:tblGrid>${anchos.map(a => `<w:gridCol w:w="${a}"/>`).join("")}</w:tblGrid>`;
    filas.forEach((f, i) => {
      const enc_ = o.encabezado && i === 0;
      x += "<w:tr>" + (enc_ ? '<w:trPr><w:tblHeader/></w:trPr>' : "") + anchos.map((a, j) => {
        const negrita = enc_ || (o.colNegrita && j === 0);
        const fondo = enc_ ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : "";
        return `<w:tc><w:tcPr><w:tcW w:w="${a}" w:type="dxa"/>${fondo}</w:tcPr>` +
          parrafo(run(f[j] == null ? "" : f[j], { bold: negrita, size: o.tamano }), '<w:spacing w:before="0" w:after="0"/>') + "</w:tc>";
      }).join("") + "</w:tr>";
    });
    this.cuerpo.push(x + "</w:tbl>", parrafo(""));       // Word necesita un párrafo después de cada tabla
    return this;
  }

  bytes() {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${this.cuerpo.join("")}` +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1120" w:right="1120" w:bottom="1120" w:left="1120" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const estilo = (id, nombre, rpr, ppr = "", base = "Normal") =>
      `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nombre}"/><w:basedOn w:val="${base}"/><w:next w:val="Normal"/><w:qFormat/>` +
      (ppr ? `<w:pPr>${ppr}</w:pPr>` : "") + `<w:rPr>${rpr}</w:rPr></w:style>`;
    const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>` +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      estilo("Title", "Title", '<w:b/><w:color w:val="1F2937"/><w:sz w:val="34"/><w:szCs w:val="34"/>', '<w:spacing w:after="120"/>') +
      estilo("Subtitle", "Subtitle", '<w:color w:val="4338CA"/><w:sz w:val="24"/><w:szCs w:val="24"/>', '<w:spacing w:after="160"/>') +
      estilo("Heading1", "heading 1", '<w:b/><w:color w:val="4338CA"/><w:sz w:val="27"/><w:szCs w:val="27"/>', '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/>') +
      estilo("Heading2", "heading 2", '<w:b/><w:color w:val="1F2937"/><w:sz w:val="23"/><w:szCs w:val="23"/>', '<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/>') +
      estilo("ListParagraph", "List Paragraph", "", '<w:spacing w:after="60"/><w:ind w:left="720" w:hanging="360"/>') +
      "</w:styles>";
    const numeracion = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}>` +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
    return zip([
      { nombre: "[Content_Types].xml", datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>' },
      { nombre: "_rels/.rels", datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { nombre: "word/_rels/document.xml.rels", datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>' },
      { nombre: "word/document.xml", datos: documento },
      { nombre: "word/styles.xml", datos: estilos },
      { nombre: "word/numbering.xml", datos: numeracion },
    ]);
  }
}

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
