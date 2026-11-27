// ============================================================
//  Mapa encabezado del Sheet (BASE DE DATOS) ↔ columna de D1 (empleados)
//  El frontend sigue hablando con los nombres del Sheet; aquí se traducen.
//  tipo: f = fecha (serial de Sheets al exportar), n = número, t = texto,
//        ft = fecha o texto (entrevistas: fecha o "Sí"/"No"),
//        calc = calculada por la vista v_empleados (solo lectura)
// ============================================================
export const COLUMNAS = [
  ["NO. EMPLEADO", "no_empleado", "n"],
  ["FECHA DE INGRESO", "fecha_ingreso", "f"],
  ["ESTATUS", "estatus", "calc"],
  ["ANTIGÜEDAD", "antiguedad", "calc"],
  ["NOMBRE DEL TRABAJADOR", "nombre", "t"],
  ["EMPRESA", "empresa", "t"],
  ["DEPARTAMENTO", "departamento", "t"],
  ["PUESTO", "puesto", "t"],
  ["SUELDO MENSUAL", "sueldo_mensual", "n"],
  ["FRECUENCIA DE PAGO", "frecuencia_pago", "t"],
  ["FUENTE DE CONTRATACIÓN", "fuente_contratacion", "t"],
  ["FECHA DE BAJA", "fecha_baja", "f"],
  ["TIPO DE SALIDA", "tipo_salida", "t"],
  ["MOTIVO DE SALIDA", "motivo_salida", "t"],
  ["MONTO DE FINIQUITO", "monto_finiquito", "n"],
  ["LUGAR DE NACIMIENTO", "lugar_nacimiento", "t"],
  ["NACIONALIDAD", "nacionalidad", "t"],
  ["FECHA DE NACIMIENTO", "fecha_nacimiento", "calc"],
  ["EDAD", "edad", "calc"],
  ["RANGO DE EDAD", "rango_edad", "calc"],
  ["GÉNERO", "genero", "calc"],
  ["ESTADO CIVIL", "estado_civil", "t"],
  ["CURP", "curp", "t"],
  ["RFC", "rfc", "t"],
  ["NSS", "nss", "t"],
  ["DOMICILIO COMPLETO (CALLE, NÚMERO, COLONIA, CP, ESTADO Y MUNICIPIO)", "domicilio", "t"],
  ["ESCOLARIDAD", "escolaridad", "t"],
  ["CORREO ELECTRÓNICO", "correo", "t"],
  ["TELÉFONO PERSONAL", "telefono", "t"],
  ["CONTACTO DE EMERGENCIA", "contacto_emergencia", "t"],
  ["PARENTESCO", "parentesco_emergencia", "t"],
  ["TELÉFONO DE EMERGENCIA", "telefono_emergencia", "t"],
  ["NOMBRE DEL BENEFICIARIO", "beneficiario_nombre", "t"],
  ["RFC DEL BENEFICIARIO", "beneficiario_rfc", "t"],
  ["PARENTESCO DEL BENEFICIARIO", "beneficiario_parentesco", "t"],
  ["PORCENTAJE DE ASIGNACIÓN", "beneficiario_porcentaje", "n"],
  ["TIPO DE INGRESO", "tipo_ingreso", "t"],
  ["TIPO DE CONTRATO", "tipo_contrato", "t"],
  ["FECHA DE INICIO DEL PRIMER CONTRATO", "contrato1_inicio", "f"],
  ["ENTREVISTA DE AJUSTE 15 DÍAS", "entrevista_15_dias", "ft"],
  ["ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS", "entrevista_45_dias", "ft"],
  ["FECHA DE VENCIMIENTO DEL PRIMER CONTRATO", "contrato1_vencimiento", "f"],
  ["FECHA DE INICIO DEL SEGUNDO CONTRATO", "contrato2_inicio", "f"],
  ["FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO", "contrato2_vencimiento", "f"],
  ["FECHA DE INICIO DEL TERCER CONTRATO", "contrato3_inicio", "f"],
  ["FECHA DE VENCIMIENTO DEL TERCER CONTRATO", "contrato3_vencimiento", "f"],
  ["FECHA EVALUACIÓN 360", "fecha_eval_360", "f"],
  ["PARA ANT. PROMEDIO", "para_ant_promedio", "calc"],
  ["SE TOMA EN CUENTA?", "se_toma_en_cuenta", "calc"],
  ["CARPETA", "carpeta", "t"],
  ["ID INTERNO", "id_interno", "t"],
  ["JEFE DIRECTO", "jefe_directo", "t"],
  ["CORREO ACCESO", "correo_acceso", "t"],
  ["GRUPO COMERCIAL", "grupo_comercial", "t"],
  ["ID_PERSONA", "id_persona", "t"],
  ["FECHA DE INICIO DEL CUARTO CONTRATO", "contrato4_inicio", "f"],
  ["FECHA DE VENCIMIENTO DEL CUARTO CONTRATO", "contrato4_vencimiento", "f"],
  ["FECHA DE INICIO DEL QUINTO CONTRATO", "contrato5_inicio", "f"],
  ["FECHA DE VENCIMIENTO DEL QUINTO CONTRATO", "contrato5_vencimiento", "f"],
  ["FECHA DE INICIO DEL SEXTO CONTRATO", "contrato6_inicio", "f"],
  ["FECHA DE VENCIMIENTO DEL SEXTO CONTRATO", "contrato6_vencimiento", "f"],
];

export const POR_ENCABEZADO = Object.fromEntries(COLUMNAS.map(([h, c, t]) => [h, { col: c, tipo: t }]));

// Igual que HEADERS_PROTEGIDOS de GAS: nunca se escriben en una actualización
export const PROTEGIDOS = new Set([
  "ESTATUS", "ANTIGÜEDAD", "EMPRESA", "FECHA DE NACIMIENTO", "EDAD", "RANGO DE EDAD", "GÉNERO",
  "PARA ANT. PROMEDIO", "SE TOMA EN CUENTA?", "URL EXPEDIENTE",
]);

const ISO = /^\d{4}-\d{2}-\d{2}/;

// Valor que llega del frontend → valor para D1
export function aValorD1(tipo, v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") { v = v.trim(); if (v === "") return null; }
  if (tipo === "n") {
    if (typeof v === "number") return v;
    const limpio = String(v).replace(/[$\s,]/g, "");
    // Solo se convierte si es un número completo; "N/A", "50-50" o un texto se conservan tal cual
    return /^-?\d+(\.\d+)?$/.test(limpio) ? parseFloat(limpio) : String(v);
  }
  if (tipo === "f" || tipo === "ft") {
    if (typeof v === "number" && !(v > 10000 && v < 100000)) return v;   // número que no es fecha: se conserva
    if (typeof v === "number") {   // serial de Sheets
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const s = String(v);
    if (ISO.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return s;                                        // "Sí"/"No" u otro texto: se conserva
  }
  return typeof v === "string" ? v : String(v);
}

// Literal SQL seguro (para sentencias multi-fila sin límite de parámetros)
export function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// ── Expresiones SQL para exportar_datos con la MISMA forma que GAS ──
const SERIAL = c => `CASE WHEN v.${c} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*' THEN CAST(round(julianday(substr(v.${c},1,10)) - 2415018.5) AS INTEGER) ELSE COALESCE(v.${c},'') END`;

export function expresionExport(h, col, tipo) {
  if (tipo === "f" || tipo === "ft") return SERIAL(col);
  if (col === "fecha_nacimiento") return `COALESCE(strftime('%d/%m/%Y', v.fecha_nacimiento),'')`;
  if (col === "edad" || col === "para_ant_promedio") return `COALESCE(CAST(v.${col} AS TEXT),'')`;
  return `COALESCE(v.${col},'')`;
}
