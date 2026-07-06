// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Backend GAS v5.0
//
//  COLUMNAS CON FÓRMULAS — nunca sobreescritas en upsert:
//    C  (3)  ESTATUS
//    D  (4)  ANTIGÜEDAD         DATEDIF
//    E  (5)  NOMBRE DEL TRAB.  fórmula de búsqueda
//    F  (6)  EMPRESA            validación lista
//    S  (19) EDAD               DATEDIF
//    T  (20) RANGO DE EDAD     fórmula SI
//    U  (21) GÉNERO             fórmula de lookup
//    AV (48) PARA ANT.PROMEDIO  DATEDIF/365
//    AW (49) SE TOMA EN CUENTA  fórmula SI + validación
//    AX (50) URL EXPEDIENTE     sistema
//
//  NUEVAS FILAS: inyecta fórmulas en D, S, AV, AW;
//    E, T, U se copian desde la fila 2 (fórmulas relativas).
// ============================================================

var ID_CARPETA_EXPEDIENTES = "1bZ7MvBYOmu67G2w0OMg3CHB3ZBqfnyy_";
var ID_SHEET_BD            = "1RN8AsoH7yURqnPEljIYwl-aQvKrFIcXyopnadXF-VuM";
var NOMBRE_HOJA            = "BASE DE DATOS";
var HOJA_USUARIOS          = "USUARIOS";
var HOJA_EVENTOS           = "EVENTOS";
var SESSION_HORAS          = 12;
var MAX_EVENTOS            = 5000;

// Headers protegidos — nunca reciben setValue() en upsert UPDATE
var HEADERS_PROTEGIDOS = [
  "ESTATUS", "ANTIGÜEDAD", "EMPRESA",
  "FECHA DE NACIMIENTO", "EDAD", "RANGO DE EDAD", "GÉNERO",
  "PARA ANT. PROMEDIO", "SE TOMA EN CUENTA?", "URL EXPEDIENTE"
];

// Índices de columna (1-based) con fórmula que se copian desde fila 2
// D=4, S=19, AV=48, AW=49, E=5, T=20, U=21
// COLS_CON_FORMULA_COPIADA ya no se usa — las fórmulas se aplican desde FORMULAS_SHEET
var COLS_CON_FORMULA_PROPIA  = [4, 19, 48]; // D, S, AV → buildFormulas()

// ─── ROUTER ──────────────────────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var r;
    switch (body.action) {
      case "alta":             r = registrarAlta(body.payload);       break;
      case "baja":             r = registrarBaja(body.payload);       break;
      case "importar_masivo":  r = importarMasivo(body.payload);      break;
      case "exportar_datos":   r = exportarDatos();                   break;
      case "siguiente_numero":   r = obtenerSiguienteNumero(body.payload); break;
      case "actualizar_empleado": r = actualizarEmpleado(body.payload);  break;
      case "ocr_documento":       r = analizarDocumentoOCR(body.payload); break;
      case "groq_ocr":            r = groqOCR(body.payload);             break;
      case "subir_documento":     r = subirDocumento(body.payload);      break;
      case "subir_contrato_firmado": r = subirContratoFirmado(body.payload); break;
      case "obtener_foto":        r = obtenerFotoExpediente(body.payload); break;
      case "crear_expediente":    r = crearExpediente(body.payload);       break;
      // ── AUTH ──────────────────────────────────────────────
      case "login":               r = loginUsuario(body.payload);          break;
      case "logout":              r = logoutUsuario(body.payload);         break;
      case "validar_token":       r = validarToken(body.payload);          break;
      case "crear_usuario":       r = crearUsuario(body.payload);          break;
      case "listar_usuarios":     r = listarUsuarios(body.payload);        break;
      case "actualizar_usuario":  r = actualizarUsuario(body.payload);     break;
      case "cambiar_password":    r = cambiarPassword(body.payload);       break;
      case "resetear_password":   r = resetearPassword(body.payload);      break;
      case "setup_inicial":       r = setupInicial();                      break;
      case "solicitar_reset":     r = solicitarResetPassword(body.payload); break;
      // ── ENCUESTAS ─────────────────────────────────────────
      case "obtener_encuesta":    r = obtenerEncuesta(body.payload);       break;
      case "guardar_respuesta":   r = guardarRespuestaEncuesta(body.payload); break;
      case "listar_respuestas":   r = listarRespuestasEncuesta(body.payload); break;
      case "guardar_encuesta":    r = guardarConfigEncuesta(body.payload); break;
      case "setup_encuestas":         r = setupEncuestas();                        break;
      case "buscar_empleado_encuesta": r = buscarEmpleadoEncuesta(body.payload);   break;
      case "obtener_empleado_por_id":  r = obtenerEmpleadoPorId(body.payload);     break;
      case "gemini_ocr":          r = geminiOCR(body.payload);          break;
      // ── PERSONAS ──────────────────────────────────────────────
      case "obtener_directorio":       r = obtenerDirectorio(body.payload);        break;
      case "obtener_organigrama":      r = obtenerOrganigrama(body.payload);       break;
      case "setup_columnas":           r = setupColumnasNuevas();                  break;
      case "buscar_empleado_encuesta": r = buscarEmpleadoEncuesta(body.payload);   break;
      case "obtener_empleado_por_id":  r = obtenerEmpleadoPorId(body.payload);     break;
      // ── EVALUACIONES ──────────────────────────────────────────
      case "crear_proceso_eval":       r = crearProcesoEval(body.payload);         break;
      case "listar_procesos_eval":     r = listarProcesosEval(body.payload);       break;
      case "obtener_proceso_eval":     r = obtenerProcesoEval(body.payload);       break;
      case "actualizar_proceso_eval":  r = actualizarProcesoEval(body.payload);    break;
      case "activar_proceso_eval":     r = activarProcesoEval(body.payload);       break;
      case "cerrar_proceso_eval":      r = cerrarProcesoEval(body.payload);        break;
      case "listar_mis_eval":          r = listarMisEvaluaciones(body.payload);    break;
      case "listar_equipo_eval":       r = listarEquipoEval(body.payload);         break;
      case "guardar_eval":             r = guardarEvaluacion(body.payload);        break;
      case "resultados_eval":          r = resultadosEval(body.payload);           break;
      // ── ACCESO EMPLEADOS ──────────────────────────────────────
      case "login_empleado":           r = loginEmpleado(body.payload);            break;
      case "validar_token_emp":        r = validarTokenEmpleado(body.payload);     break;
      case "activar_acceso_emp":       r = activarAccesoEmpleado(body.payload);    break;
      // ── UTILIDADES ────────────────────────────────────────────
      case "buscar_usuario_por_nombre": r = buscarUsuarioPorNombre(body.payload);  break;
      case "migrar_columnas_usuarios":  r = migrarColumnasUsuarios();              break;
      case "obtener_catalogo_empresas":  r = obtenerCatalogoEmpresas();              break;
      case "obtener_historial_persona":   r = obtenerHistorialPersona(body.payload);  break;
      case "registrar_movimiento":        r = registrarMovimiento(body.payload);      break;
      case "migrar_historial_inicial":    r = migrarHistorialInicial();               break;
      case "getDriveUsage":              r = getDriveUsage();                        break;
      default: r = { status:"error", message:"Accion no reconocida: " + body.action };
    }
    return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status:"error", message:err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── OBTENER SIGUIENTE NÚMERO DE EMPLEADO ────────────────────
// Lee la columna A, extrae todos los números, devuelve el máximo + 1.
function obtenerSiguienteNumero(payload) {
  var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet   = ss.getSheetByName(NOMBRE_HOJA);
  var empresa = (payload && payload.empresa) ? payload.empresa.toString().replace(/\n/g," ").trim() : "";
  var siguiente, idInterno;
  if (empresa) {
    siguiente  = siguienteNumeroEmpleadoPorEmpresa(sheet, empresa);
    idInterno  = generarSiguienteID(sheet, empresa);
  } else {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var max  = 0;
    vals.forEach(function(row) {
      var n = parseInt((row[0] || "").toString().replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    siguiente = max + 1;
    idInterno = "";
  }
  return { status:"success", siguiente: siguiente, idInterno: idInterno };
}

// ─── FÓRMULAS PROPIAS (D, S, AV) ─────────────────────────────
// Fórmulas exactas del Sheet — se ajusta el número de fila al insertar
// Las fórmulas originales están en fila 2; al copiar se reemplaza 2 → fila destino
var FORMULAS_SHEET = {
  C:  '=SI(L2="", "Activo", "Baja")',
  D:  '=SI.ERROR(SI(L2="", SIFECHA(B2, HOY(), "Y") & " AÑOS, " & SIFECHA(B2, HOY(), "YM") & " MESES, " & SIFECHA(B2, HOY(), "MD") & " DÍAS", SIFECHA(B2, L2, "Y") & " AÑOS, " & SIFECHA(B2, L2, "YM") & " MESES, " & SIFECHA(B2, L2, "MD") & " DÍAS"), "")',
  R:  '=SI(W2="", "", FECHA(SI(VALOR(IZQUIERDA(DERECHA(W2, 14), 2))>30, 1900, 2000) + IZQUIERDA(DERECHA(W2, 14), 2), IZQUIERDA(DERECHA(W2, 12), 2), IZQUIERDA(DERECHA(W2, 10), 2)))',
  T:  '=SI.ERROR(IFS(S2<31, "<31", S2<51, "31-50", S2<66, "51-65", S2>=66, ">65"), "")',
  U:  '=SI(W2="", "", SI(IZQUIERDA(DERECHA(W2, 8), 1)="M", "Femenino", "Masculino"))',
  AV: '=SI(L2="", HOY()-B2, L2-B2)',
  AW: '=+SI(C2="Baja","No","Sí")'
};

// Columnas con fórmula (índices 1-based) — NUNCA escribir valores aquí
// C=3, D=4, R=18, S=19, T=20, U=21, AV=48, AW=49
var COLS_FORMULA = { 3:'C', 4:'D', 18:'R', 19:'S', 20:'T', 21:'U', 48:'AV', 49:'AW' };


// ─── HELPER BASE64 SEGURO ─────────────────────────────────────
// El navegador envía: "data:application/pdf;base64,JVBER..."
// GAS lanza "Argumento no válido" si recibe el prefijo o whitespace.
// Centraliza la decodificación en un solo lugar con reintentos.
function b64ToBytes(b64) {
  var s = b64 || '';
  if (s.indexOf(',') !== -1) s = s.split(',')[1]; // quitar encabezado
  s = s.replace(/\s/g, '');                        // eliminar \n \r espacios
  try { return Utilities.base64Decode(s); } catch(e1) {}
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');           // solo chars base64 válidos
  try { return Utilities.base64Decode(s); } catch(e2) {
    throw new Error('Base64 inválido: ' + e2);
  }
}
function b64ToBlob(b64, mimeType, nombre) {
  var bytes = b64ToBytes(b64);
  if (!bytes || bytes.length < 10) throw new Error('Archivo vacío o base64 inválido');
  return Utilities.newBlob(bytes, mimeType || 'application/octet-stream', nombre || 'archivo');
}
// ─────────────────────────────────────────────────────────────

// Ajustar número de fila en una fórmula (reemplazar "2" → filaDestino)
// Solo reemplaza referencias de celda como B2, L2, W2, S2 etc.

// Ajustar número de fila en una fórmula (reemplazar "2" → filaDestino)
// Reemplaza referencias como B2, L2, W2, S2, AB2 → B238, L238, etc.
// Usa lookbehind-free approach compatible con GAS (V8 básico)
function ajustarFila(formula, fila) {
  // Reemplazar patrones LETRA(S) seguido del número 2 al final de referencia
  // El truco: reemplazar solo cuando el 2 está precedido por letra y seguido de
  // un carácter no alfanumérico (coma, paréntesis, comilla, espacio, fin de string)
  var resultado = formula.replace(/([A-Z]{1,3})(2)(?=[^0-9]|$)/g, function(match, col, num) {
    return col + fila;
  });
  return resultado;
}


function buildFormulas() {
  return {}; // ya no se usa, mantenido por compatibilidad
}

// ─── COPIAR FÓRMULA RELATIVA DESDE FILA 2 ────────────────────
// Copia la fórmula de la fila 2 a la fila destino ajustando las referencias.
// NO usa copyTo() porque ese método convierte las fórmulas a INDIRECTO() en algunas versiones.
// En su lugar, lee el texto de la fórmula y reemplaza "2" por el número de fila destino.
function copiarFormulaRelativa(sheet, colOrigen, filaDestino) {
  try {
    var celdaOrigen = sheet.getRange(2, colOrigen);
    var formula     = celdaOrigen.getFormula();
    if (!formula) return;

    // Reemplazar SOLO referencias absolutas de fila 2 (ej: R2, B2, AB2)
    // El regex (?<![0-9]) evita reemplazar dentro de numeros como "20" o "25"
    // Usamos una funcion para reemplazar solo cuando el "2" sigue a una letra
    var formulaAjustada = formula;
    // Primero proteger numeros que no son referencias (ej: "365" -> no tocar)
    // Reemplazar patrones LETRA(S)2 que son referencias de celda
    formulaAjustada = formulaAjustada.replace(/([A-Z]{1,3})2/g, function(m, col) {
      return col + filaDestino;
    });

    Logger.log('[copiar] Col ' + colOrigen + ' L' + filaDestino + ': ' + formulaAjustada);
    sheet.getRange(filaDestino, colOrigen).setFormula(formulaAjustada);

  } catch (e) {
    Logger.log('copiarFormulaRelativa error: ' + e);
  }
}


// ─── APLICAR TODAS LAS FÓRMULAS A UNA FILA NUEVA ─────────────
// Columnas que tienen fórmula (índice 1-based)
// C=3, D=4, R=18, S=19, T=20, U=21, AV=48, AW=49
var COLS_CON_FORMULA_IDX = [3, 4, 18, 19, 20, 21, 48, 49];

function aplicarFormulasFilaNueva(sheet, fila) {
  COLS_CON_FORMULA_IDX.forEach(function(col) {
    try {
      var formula = sheet.getRange(2, col).getFormula();
      // Fallback: si getFormula() devuelve vacío usar FORMULAS_SHEET
      if (!formula) {
        var letra = COLS_FORMULA[col];
        if (letra && FORMULAS_SHEET[letra]) {
          formula = FORMULAS_SHEET[letra];
          Logger.log('[Formula] Col' + col + ' usando respaldo FORMULAS_SHEET');
        } else {
          return;
        }
      }
      var formulaAjustada = ajustarFila(formula, fila);
      sheet.getRange(fila, col).setFormula(formulaAjustada);
      Logger.log('[Formula] Col' + col + ' fila' + fila + ': ' + formulaAjustada.substring(0,80));
    } catch(e) {
      Logger.log('[Formula] Error col' + col + ' fila' + fila + ': ' + e);
    }
  });
}


// ─── GENERADOR DE SIGLAS POR EMPRESA ─────────────────────────
// Genera siglas únicas desde el nombre de la empresa.
// Ignora artículos: de, del, la, las, los, y, e, a, an, the, sa, sap, srl, sc
// Si hay colisión agrega número: MDN, MDN2, MDN3...
var ARTICULOS_IGNORAR = {"de":1,"del":1,"la":1,"las":1,"los":1,"y":1,"e":1,"a":1,"sa":1,"sap":1,"srl":1,"sc":1,"de":1};

function generarSiglas(nombreEmpresa) {
  if (!nombreEmpresa) return "EMP";
  var palabras = nombreEmpresa.toUpperCase().split(/\s+/).filter(function(p) {
    return p.length > 0 && !ARTICULOS_IGNORAR[p.toLowerCase()];
  });
  if (palabras.length === 0) return "EMP";
  // Tomar primera letra de cada palabra significativa
  var siglas = palabras.map(function(p) { return p.charAt(0); }).join("");
  // Si queda solo 1 letra, tomar las primeras 3 letras de la primera palabra
  if (siglas.length === 1) siglas = palabras[0].substring(0, 3);
  return siglas;
}

// Obtener el mapa de siglas existentes para evitar colisiones
// Lee la columna AY del Sheet y extrae las siglas usadas
function obtenerMapaSiglas(sheet) {
  var datos  = sheet.getDataRange().getValues();
  var headers = datos[0].map(function(h){ return h ? h.toString().trim() : ""; });
  var colID  = headers.indexOf("ID INTERNO"); // AY = col 51
  var colEmp = headers.indexOf("EMPRESA");    // F  = col 6
  
  var mapa = {}; // { siglas: { empresa: "Newspot", ultimo: 5 } }
  
  for (var i = 1; i < datos.length; i++) {
    var idVal  = colID  >= 0 ? (datos[i][colID]  || "").toString().trim() : "";
    var empVal = colEmp >= 0 ? (datos[i][colEmp] || "").toString().trim() : "";
    if (!idVal || !empVal) continue;
    
    // Extraer siglas y número del ID (ej: "NM3" → siglas="NM", num=3)
    var match = idVal.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    var sig = match[1];
    var num = parseInt(match[2]);
    
    if (!mapa[empVal]) mapa[empVal] = { siglas: sig, ultimo: num };
    else if (num > mapa[empVal].ultimo) mapa[empVal].ultimo = num;
  }
  return mapa;
}

// Generar el siguiente ID para una empresa
// Si la empresa ya tiene IDs, incrementar. Si es nueva, generar siglas.
function generarSiguienteID(sheet, nombreEmpresa) {
  var mapa = obtenerMapaSiglas(sheet);
  
  if (mapa[nombreEmpresa]) {
    // Empresa existente — usar sus siglas y siguiente número
    var sig    = mapa[nombreEmpresa].siglas;
    var ultimo = mapa[nombreEmpresa].ultimo;
    return sig + (ultimo + 1);
  }
  
  // Empresa nueva — generar siglas
  var siglas = generarSiglas(nombreEmpresa);
  
  // Verificar que las siglas no estén usadas por otra empresa
  var siglasUsadas = {};
  Object.keys(mapa).forEach(function(emp) { siglasUsadas[mapa[emp].siglas] = emp; });
  
  var sufijo = "";
  var intento = siglas;
  var contador = 2;
  while (siglasUsadas[intento] && siglasUsadas[intento] !== nombreEmpresa) {
    intento = siglas + contador;
    contador++;
  }
  
  return intento + "1"; // Primera ID de esta empresa
}

// Siguiente número de empleado por empresa
function siguienteNumeroEmpleadoPorEmpresa(sheet, empresa) {
  var datos   = sheet.getDataRange().getValues();
  // Normalizar headers: quitar saltos de línea y espacios
  var headers = datos[0].map(function(h){
    return h ? h.toString().replace(/\n/g," ").replace(/\s+/g," ").trim() : "";
  });

  // Buscar columnas — usar fallback por posición si no se encuentra por nombre
  var colNo  = headers.indexOf("NO. EMPLEADO");
  var colEmp = headers.indexOf("EMPRESA");
  if (colNo  === -1) colNo  = 0; // A = columna 1
  if (colEmp === -1) colEmp = 5; // F = columna 6

  Logger.log("[SigNumero] Empresa buscada: " + JSON.stringify(empresa));
  Logger.log("[SigNumero] colNo=" + colNo + " colEmp=" + colEmp);
  Logger.log("[SigNumero] Header colEmp: " + JSON.stringify(headers[colEmp]));

  var maxNum = 0;
  var contEmpresa = 0;

  for (var i = 1; i < datos.length; i++) {
    var empVal = (datos[i][colEmp] || "").toString().trim();
    if (empVal !== empresa.trim()) continue;
    contEmpresa++;
    var noVal = parseInt((datos[i][colNo] || "0").toString());
    if (!isNaN(noVal) && noVal > maxNum) maxNum = noVal;
  }

  Logger.log("[SigNumero] Registros de " + empresa + ": " + contEmpresa + " | Max: " + maxNum);
  return maxNum + 1;
}

function registrarAlta(payload) {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);

  var empresa      = (payload.empresa || "").trim();
  var noEmpPayload = (payload.numeroEmpleado || "").toString().trim();
  var curpPayload  = (payload.curp || "").toString().trim().toUpperCase();
  var rfcPayload   = (payload.rfc  || "").toString().trim().toUpperCase();

  var todos   = sheet.getDataRange().getValues();
  var headers = todos[0].map(function(h){ return h ? h.toString().trim() : ""; });
  var colEmpIdx  = headers.indexOf("EMPRESA");
  var colCurp    = headers.indexOf("CURP");
  var colRfc     = headers.indexOf("RFC");
  var colNoEmp   = 0;  // A
  var colIdP     = headers.indexOf("ID_PERSONA");
  var colEstatus = 2;  // C = ESTATUS (fórmula)

  // Detectar reingreso: buscar fila anterior del mismo CURP o RFC en la misma empresa con estatus Baja
  var noEmpAnterior = "";
  var idPersonaAnterior = "";
  for (var i = 1; i < todos.length; i++) {
    var empFila  = colEmpIdx >= 0 ? (todos[i][colEmpIdx]||"").toString().trim() : "";
    if (empFila !== empresa) continue;
    var curpFila = colCurp >= 0 ? (todos[i][colCurp]||"").toString().trim().toUpperCase() : "";
    var rfcFila  = colRfc  >= 0 ? (todos[i][colRfc] ||"").toString().trim().toUpperCase() : "";
    var estatusFila = (todos[i][colEstatus]||"").toString().trim();
    if (estatusFila !== "Baja") continue;
    if ((curpPayload && curpFila === curpPayload) || (rfcPayload && rfcFila === rfcPayload)) {
      noEmpAnterior     = (todos[i][colNoEmp]||"").toString().trim();
      idPersonaAnterior = colIdP >= 0 ? (todos[i][colIdP]||"").toString().trim() : "";
      Logger.log('[Alta] Reingreso detectado: noEmpAnterior=' + noEmpAnterior + ' | idPersonaAnterior=' + idPersonaAnterior);
      break;
    }
  }

  // Número de empleado: usar el provisto > el anterior (reingreso) > siguiente nuevo
  var noEmp = noEmpPayload || noEmpAnterior || siguienteNumeroEmpleadoPorEmpresa(sheet, empresa).toString();
  var esReingreso = !noEmpPayload && !!noEmpAnterior;

  // ID interno único por empresa
  var idInterno = generarSiguienteID(sheet, empresa);
  Logger.log('[Alta] Empresa: ' + empresa + ' | No.Emp: ' + noEmp + ' | ID: ' + idInterno + ' | Reingreso: ' + esReingreso);

  // Validar duplicado solo si hay un Activo con ese número
  for (var j = 1; j < todos.length; j++) {
    var empFila2 = colEmpIdx >= 0 ? (todos[j][colEmpIdx]||"").toString().trim() : "";
    var estatusFila2 = (todos[j][colEstatus]||"").toString().trim();
    if ((todos[j][0]||"").toString().trim() === noEmp && empFila2 === empresa && estatusFila2 === "Activo") {
      return { status:"error", message:"El No. " + noEmp + " ya está activo en " + empresa + ". Si es reingreso, el empleado anterior debe estar en Baja." };
    }
  }

  // Crear carpeta Drive
  var parent   = DriveApp.getFolderById(ID_CARPETA_EXPEDIENTES);
  var empNom   = (payload.empresa || "Sin Empresa").replace(/'/g,"\\'");
  var empIter  = parent.searchFolders("title = '" + empNom + "'");
  var empDir   = empIter.hasNext() ? empIter.next() : parent.createFolder(payload.empresa || "Sin Empresa");
  var empDir2  = empDir.createFolder(noEmp + " - " + (payload.nombreTrabajador || "Sin Nombre"));
  var url      = empDir2.getUrl();

  // Subir documentos
  if (payload.documentos && payload.documentos.length) {
    payload.documentos.forEach(function(doc) {
      try { empDir2.createFile(b64ToBlob(doc.data, doc.mimeType, doc.nombreArchivo)); }
      catch(de) { Logger.log("Doc: " + de); }
    });
  }

  // Construir fila (E, T, U y D, S, AV, AW van vacíos — se llenan con fórmulas abajo)
  var nuevaFila = [
    payload.numeroEmpleado            || "", // A
    payload.fechaIngreso              || "", // B
    "",                                      // C  ← fórmula =SI(L2="","Activo","Baja")
    "",                                      // D  ← fórmula ANTIGÜEDAD
    payload.nombreTrabajador           || "", // E  NOMBRE DEL TRABAJADOR
    payload.empresa                   || "", // F
    payload.departamento              || "", // G
    payload.puesto                    || "", // H
    payload.sueldoMensual             || "", // I
    payload.frecuenciaPago            || "", // J
    payload.fuenteContratacion        || "", // K
    "",                                      // L F.BAJA
    "",                                      // M TIPO_SALIDA
    "",                                      // N MOTIVO
    "",                                      // O FINIQUITO
    payload.lugarNacimiento           || "", // P
    payload.nacionalidad              || "", // Q
    "",                                      // R ← fórmula FECHA DE NACIMIENTO (no sobreescribir)
    "",                                      // S ← fórmula EDAD
    "",                                      // T ← fórmula RANGO_EDAD (copiada)
    "",                                      // U ← fórmula GÉNERO (copiada)
    payload.estadoCivil               || "", // V
    payload.curp                      || "", // W
    payload.rfc                       || "", // X
    payload.nss                       || "", // Y
    payload.domicilioCompleto         || "", // Z
    payload.escolaridad               || "", // AA
    payload.correoElectronico         || "", // AB
    payload.telefonoPersonal          || "", // AC
    payload.contactoEmergencia        || "", // AD
    payload.parentesco                || "", // AE
    payload.telefonoEmergencia        || "", // AF
    payload.nombreBeneficiario        || "", // AG
    payload.rfcBeneficiario           || "", // AH
    payload.parentescoBeneficiario    || "", // AI
    payload.porcentajeAsignacion      || "", // AJ
    payload.tipoIngreso               || "", // AK
    payload.tipoContrato              || "", // AL
    payload.fechaInicioContrato       || "", // AM
    payload.entrevista15Dias          || "", // AN
    payload.entrevista45Dias          || "", // AO
    payload.vencimientoPrimerContrato || "", // AP
    payload.iniciSegundoContrato      || "", // AQ
    payload.vencSegundoContrato       || "", // AR
    payload.iniciTercerContrato       || "", // AS
    payload.vencTercerContrato        || "", // AT
    payload.fechaEval360              || "", // AU
    "",                                      // AV ← fórmula ANT.PROMEDIO
    "",                                      // AW ← fórmula SE_TOMA_EN_CUENTA
    url,                                     // AX URL EXPEDIENTE
    idInterno,                               // AY ID INTERNO
    "",                                      // AZ JEFE DIRECTO
    payload.correoAcceso || "",              // BA CORREO ACCESO
    payload.grupoComercial || ""             // BB GRUPO COMERCIAL
  ];

  // Escribir la fila — primero appendRow para crear la fila
  sheet.appendRow(nuevaFila);
  var filaDestino = sheet.getLastRow();

  // Fechas: convertir "YYYY-MM-DD" al número serial de Google Sheets
  // para que mantengan el mismo formato numérico que las demás filas.
  // El serial de Sheets = días desde 30/12/1899 (época de Lotus 1-2-3)
  var COLS_FECHA = [2, 12, 39, 42, 43, 44, 45, 46, 47]; // B,L,AM,AP,AQ,AR,AS,AT,AU
  COLS_FECHA.forEach(function(col) {
    var celda = sheet.getRange(filaDestino, col);
    var val   = celda.getValue();
    if (!val) return;
    // Si Sheets lo interpretó como Date, convertir a serial numérico
    if (val instanceof Date) {
      // Serial = (fecha - época_sheets) en días
      var epocaSheets = new Date(1899, 11, 30); // 30/12/1899
      var serial = Math.round((val.getTime() - epocaSheets.getTime()) / 86400000);
      celda.setValue(serial);
    }
  });
  // Copiar el formato numérico de las celdas equivalentes de la fila 2
  // para que el número serial se muestre igual que las demás fechas
  COLS_FECHA.forEach(function(col) {
    var fmtOrigen = sheet.getRange(2, col).getNumberFormat();
    if (fmtOrigen) sheet.getRange(filaDestino, col).setNumberFormat(fmtOrigen);
  });

  aplicarFormulasFilaNueva(sheet, filaDestino);

  // Asignar ID_PERSONA en columna BC para el sistema de historial
  try {
    var curpAlta = (payload.curp || "").toString().trim();
    var nomAlta  = (payload.nombreTrabajador || "").toString().trim();
    asignarIdPersonaNuevo(sheet, filaDestino, curpAlta, nomAlta);
  } catch(exIdP) {
    Logger.log("[Alta] Aviso: No se pudo asignar ID_PERSONA: " + exIdP);
  }

  // Activar portal automáticamente si tiene correo de acceso
  var corrAcceso = (payload.correoAcceso || "").toString().trim();
  if (corrAcceso && idInterno) {
    try {
      var passInicial = "Prisma" + (payload.noEmpleado||"001") + "*";
      activarAccesoEmpleado({
        idInterno: idInterno,
        correo:    corrAcceso,
        password:  passInicial
      });
      Logger.log("[Alta] Portal activado para: " + corrAcceso);
    } catch(exAcc) {
      Logger.log("[Alta] Error activando portal: " + exAcc);
    }
  }

  return { status:"success", message:"Alta registrada.", urlExpediente:url, noEmpleado:noEmp, idInterno:idInterno, esReingreso:esReingreso, idPersonaAnterior:idPersonaAnterior };
}

// ─── BAJA ─────────────────────────────────────────────────────
function registrarBaja(payload) {
  var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet   = ss.getSheetByName(NOMBRE_HOJA);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h){ return h ? h.toString().replace(/\n/g," ").trim() : ""; });

  var idInterno  = (payload.idInterno      || "").toString().trim();
  var noEmp      = (payload.numeroEmpleado || "").toString().trim();
  var empresa    = (payload.empresa        || "").toString().trim();
  var nom        = (payload.nombreEmpleado || "").toString().trim().toLowerCase();

  var colNo  = 0;   // A = NO. EMPLEADO
  var colEmp = 5;   // F = EMPRESA
  var colNom = 4;   // E = NOMBRE
  var colID  = 50;  // AY = ID INTERNO (índice 50, columna 51)

  Logger.log("[registrarBaja] idInterno='" + idInterno + "' | noEmp='" + noEmp + "' | empresa='" + empresa + "' | nom='" + nom + "'");

  if (!idInterno && !noEmp && !nom)
    return { status:"error", message:"Proporciona ID o nombre del empleado." };

  for (var i = 1; i < data.length; i++) {
    var idInternoFila = (data[i][colID]  || "").toString().trim();
    var noEmpFila     = (data[i][colNo]  || "").toString().trim();
    var empresaFila   = (data[i][colEmp] || "").toString().trim();

    var match = false;
    // Prioridad 1: ID INTERNO + No.Emp + Empresa (triple = único absoluto)
    if (idInterno && noEmp && empresa)
      match = (idInternoFila === idInterno && noEmpFila === noEmp && empresaFila === empresa);
    // Prioridad 2: ID INTERNO + Empresa
    if (!match && idInterno && empresa)
      match = (idInternoFila === idInterno && empresaFila === empresa);
    // Prioridad 3: No.Emp + Empresa (sin ID INTERNO)
    if (!match && noEmp && empresa)
      match = (noEmpFila === noEmp && empresaFila === empresa);
    // ⛔ NO usar fallback por nombre — puede dar de baja a la persona equivocada

    if (match) {
      Logger.log("[registrarBaja] ✅ Match fila "+(i+1)+" | idInterno="+idInternoFila+" | noEmp="+noEmpFila+" | empresa="+empresaFila+" | nombre="+(data[i][colNom]||""));
      var row = i + 1;
      // NOTA: No escribir en columna C (Estatus) — tiene fórmula =SI(L2="","Activo","Baja")
      // El estatus cambia automáticamente cuando se registra la fecha de baja en col L
      // Fecha de baja como número serial de Sheets (igual formato que las demás fechas)
      var fechaBajaVal = payload.fechaBaja || "";
      if (fechaBajaVal) {
        // Convertir "YYYY-MM-DD" a número serial de Sheets
        var partesFecha = fechaBajaVal.split("-");
        if (partesFecha.length === 3) {
          var fechaObj  = new Date(parseInt(partesFecha[0]), parseInt(partesFecha[1])-1, parseInt(partesFecha[2]));
          var epocaSheets = new Date(1899, 11, 30);
          fechaBajaVal = Math.round((fechaObj.getTime() - epocaSheets.getTime()) / 86400000);
        }
      }
      // Copiar el formato numérico de la celda L2 para que se vea igual que las otras fechas
      var fmtFecha = sheet.getRange(2, 12).getNumberFormat();
      var celdaBaja = sheet.getRange(row, 12);
      celdaBaja.setValue(fechaBajaVal);
      if (fmtFecha) celdaBaja.setNumberFormat(fmtFecha);
      sheet.getRange(row, 13).setValue(payload.tipoSalida     || "");
      sheet.getRange(row, 14).setValue(payload.motivoSalida   || "");
      sheet.getRange(row, 15).setValue(payload.montoFiniquito || "");
      var nomReg = (data[i][4] || "").toString().trim() || idInterno || noEmp;
      var idReg   = idInterno || noEmp || i.toString();
      return { status:"success", message:"Baja registrada para: " + nomReg + " (" + idReg + ")." };
    }
  }
  return { status:"error", message:"No se encontró el colaborador." };
}

// ─── EXPORTAR ─────────────────────────────────────────────────
// exportarDatos — usa getValues() como fuente principal para preservar
// los seriales numéricos de fechas (evita el desfase de 1 día que causa
// getDisplayValues() al aplicar la timezone del spreadsheet).
// Para columnas con fórmulas de texto (ANTIGÜEDAD, ESTATUS, EDAD, etc.)
// se toma el valor calculado de getDisplayValues() como respaldo.
function exportarDatos() {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);

  var range = sheet.getDataRange();
  var rawVals  = range.getValues();
  var dispVals = range.getDisplayValues();

  if (!rawVals || rawVals.length < 2) return { status:"success", data:[] };

  var headers = rawVals[0].map(function(h) {
    return h ? h.toString().replace(/\n/g," ").trim() : "";
  });

  // Columnas 0-based con formulas de texto — usar getDisplayValues()
  // C(2)=ESTATUS, D(3)=ANTIGÜEDAD, R(17)=FECHA_NAC_FORMULA,
  // S(18)=EDAD, T(19)=RANGO_EDAD, U(20)=GENERO, AV(47)=ANT_PROM, AW(48)=SE_TOMA
  var COLS_FORMULA_TEXTO = { 2:1, 3:1, 17:1, 18:1, 19:1, 20:1, 47:1, 48:1 };

  var urlHeaderReal = headers[49] || 'URL EXPEDIENTE';
  var epoch = new Date(Date.UTC(1899, 11, 30));

  var json = rawVals.slice(1).map(function(rawRow, ri) {
    var dispRow = dispVals[ri + 1] || [];
    var obj = {};
    headers.forEach(function(k, i) {
      if (!k) return;
      var val;
      if (COLS_FORMULA_TEXTO[i]) {
        val = dispRow[i] !== undefined ? dispRow[i] : "";
      } else {
        var raw = rawRow[i];
        if (raw instanceof Date) {
          var serial = Math.round((raw.getTime() - epoch.getTime()) / 86400000);
          val = serial;
        } else {
          val = (raw !== undefined && raw !== null) ? raw : "";
        }
      }
      obj[k] = val;
    });

    if (urlHeaderReal && urlHeaderReal !== 'URL EXPEDIENTE') {
      obj['URL EXPEDIENTE'] = obj[urlHeaderReal] || '';
    }
    if (obj['URL EXPEDIENTE']) {
      obj['URL EXPEDIENTE'] = obj['URL EXPEDIENTE'].toString().trim();
    }
    return obj;
  });

  return { status:"success", data:json };
}


// ─── IMPORTAR MASIVO ──────────────────────────────────────────
// UPDATE: salta todas las columnas protegidas + E, T, U (tienen fórmulas).
// INSERT: appendRow con placeholders vacíos en columnas de fórmula,
//   luego aplica aplicarFormulasFilaNueva() a cada fila nueva.
function importarMasivo(payload) {
  var registros = payload.registros;
  if (!registros || !registros.length) return { status:"error", message:"Sin registros." };

  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);
  var data  = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h ? h.toString().replace(/\n/g," ").trim() : ""; });

  // Índices 0-based de columnas protegidas
  var protIdx = [];
  HEADERS_PROTEGIDOS.forEach(function(hp) {
    var idx = headers.indexOf(hp);
    if (idx !== -1) protIdx.push(idx);
  });

  // Mapa No.Empleado → fila Sheets
  var colEmp = headers.indexOf("NO. EMPLEADO");
  var exist  = {};
  for (var i = 1; i < data.length; i++) {
    var v = (data[i][colEmp] || "").toString().trim();
    if (v) exist[v] = i + 1;
  }

  var act = 0, ins = 0, nuevasFilas = [];

  registros.forEach(function(emp) {
    var idEmp = (emp["NO. EMPLEADO"] || "").toString().trim();
    if (!idEmp) return;

    if (exist[idEmp]) {
      // UPDATE — respetar protegidas
      var rowNum = exist[idEmp];
      for (var col = 0; col < headers.length; col++) {
        if (protIdx.indexOf(col) !== -1) continue;
        var hdr = headers[col]; if (!hdr) continue;
        var val = emp[hdr];
        if (val !== undefined && val !== null) sheet.getRange(rowNum, col + 1).setValue(val);
      }
      act++;
    } else {
      // INSERT: construir fila, vaciar columnas con fórmula
      var fila = [];
      for (var c = 0; c < headers.length; c++) {
        var hh = headers[c];
        var colBase1 = c + 1;
        // Columnas que tendrán fórmula → placeholder vacío
        if ([4,5,19,20,21,48,49].indexOf(colBase1) !== -1) { fila.push(""); continue; }
        if (hh === "ESTATUS") { fila.push(emp[hh] || "Activo"); continue; }
        fila.push(emp[hh] !== undefined ? emp[hh] : "");
      }
      nuevasFilas.push(fila);
      ins++;
    }
  });

  // Batch insert de todas las filas nuevas en una sola operación
  if (nuevasFilas.length > 0) {
    var primeraFila = sheet.getLastRow() + 1;
    sheet.getRange(primeraFila, 1, nuevasFilas.length, headers.length).setValues(nuevasFilas);

    // Asignar IDs internos a las filas nuevas
    var colIDInterno = headers.indexOf("ID INTERNO");
    if (colIDInterno >= 0) {
      nuevasFilas.forEach(function(fila, idx) {
        var filaNum = primeraFila + idx;
        if (!fila[colIDInterno]) {
          var empDeFila = (fila[headers.indexOf("EMPRESA")] || "").toString().trim();
          if (empDeFila) {
            var idGen = generarSiguienteID(sheet, empDeFila);
            sheet.getRange(filaNum, colIDInterno + 1).setValue(idGen);
          }
        }
      });
    }

    // Extender fórmulas en batch — una operación por columna
    Logger.log('[Import] Extendiendo formulas en ' + nuevasFilas.length + ' filas desde L' + primeraFila);
    var ultimaFila = primeraFila + nuevasFilas.length - 1;
    Object.keys(FORMULAS_SHEET).forEach(function(colLetra) {
      try {
        var colIdx = 0;
        for (var ci = 0; ci < colLetra.length; ci++) {
          colIdx = colIdx * 26 + (colLetra.charCodeAt(ci) - 64);
        }
        var formulas = [];
        for (var fi = primeraFila; fi <= ultimaFila; fi++) {
          formulas.push([ajustarFila(FORMULAS_SHEET[colLetra], fi)]);
        }
        sheet.getRange(primeraFila, colIdx, nuevasFilas.length, 1).setFormulas(formulas);
      } catch(e) {
        Logger.log('[Import Formulas] Error col ' + colLetra + ': ' + e);
      }
    });
    Logger.log('[Import] Formulas extendidas correctamente');
  }

  return { status:"success", message:"Actualizados: " + act + " | Nuevos: " + ins + " | Total: " + (act + ins) };
}

// ─── ACTUALIZAR EMPLEADO (edición individual desde el drawer) ──
// Recibe: { numeroEmpleado, campos: { "NOMBRE COLUMNA": valor, ... } }
// Protege siempre las columnas con fórmulas.
// Determina automáticamente a cuál contrato (2do o 3er) asignar las
// fechas nuevas si se envían bajo las claves de contrato.
function actualizarEmpleado(payload) {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);
  var data  = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h){ return h?h.toString().replace(/\n/g," ").trim():""; });

  var idBuscar    = (payload.idInterno      || "").toString().trim();
  var noEmpBuscar = (payload.numeroEmpleado || "").toString().trim();
  var empBuscar   = (payload.empresa        || "").toString().trim();
  if(!idBuscar && !noEmpBuscar) return { status:"error", message:"No se proporcionó número de empleado." };

  var filaEncontrada = -1;
  for (var i = 1; i < data.length; i++) {
    var idInternoFila  = (data[i][50] || "").toString().trim(); // AY = ID INTERNO
    var noEmpFilaAct   = (data[i][0]  || "").toString().trim(); // A  = NO. EMPLEADO
    var empFilaAct     = (data[i][5]  || "").toString().trim(); // F  = EMPRESA

    var esMatchAct = false;
    // Prioridad 1: solo ID INTERNO — es único global
    if (idBuscar && idInternoFila === idBuscar) esMatchAct = true;
    // Prioridad 2: No.Emp + Empresa — solo si no hay ID INTERNO
    if (!esMatchAct && !idBuscar && noEmpBuscar && empBuscar)
      esMatchAct = (noEmpFilaAct === noEmpBuscar && empFilaAct === empBuscar);

    if (esMatchAct) {
      Logger.log("[actualizarEmpleado] ✅ Match fila "+(i+1)+" | idInterno="+idInternoFila+" | noEmp="+noEmpFilaAct+" | empresa="+empFilaAct);
      filaEncontrada = i + 1; break;
    }
  }
  if (filaEncontrada === -1)
    return { status:"error", message:"No se encontró el empleado." };

  var campos = payload.campos || {};
  var camposEscritos = 0;

  // Columnas de fecha que deben guardarse como serial numérico de Sheets
  var NOMBRES_FECHA_UPDATE = [
    "FECHA DE BAJA","FECHA DE INGRESO",
    "FECHA DE INICIO DEL PRIMER CONTRATO","FECHA DE VENCIMIENTO DEL PRIMER CONTRATO",
    "FECHA DE INICIO DEL SEGUNDO CONTRATO","FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO",
    "FECHA DE INICIO DEL TERCER CONTRATO","FECHA DE VENCIMIENTO DEL TERCER CONTRATO",
    "FECHA DE INICIO DEL CUARTO CONTRATO","FECHA DE VENCIMIENTO DEL CUARTO CONTRATO",
    "FECHA DE INICIO DEL QUINTO CONTRATO","FECHA DE VENCIMIENTO DEL QUINTO CONTRATO",
    "FECHA DE INICIO DEL SEXTO CONTRATO","FECHA DE VENCIMIENTO DEL SEXTO CONTRATO",
    "FECHA EVALUACIÓN 360"
  ];
  var epocaSheets = new Date(Date.UTC(1899, 11, 30));

  Object.keys(campos).forEach(function(nombre){
    var valor = campos[nombre];
    if(valor===undefined||valor===null||valor==="")return;
    if(HEADERS_PROTEGIDOS.indexOf(nombre)!==-1)return; // nunca tocar protegidas

    var colIdx = headers.indexOf(nombre);
    if(colIdx===-1)return;

    // Convertir YYYY-MM-DD a serial numérico para columnas de fecha
    if(NOMBRES_FECHA_UPDATE.indexOf(nombre)!==-1 && typeof valor==="string" && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())){
      var partes = valor.trim().split("-");
      var fechaObj = new Date(Date.UTC(parseInt(partes[0]), parseInt(partes[1])-1, parseInt(partes[2])));
      var serial = Math.round((fechaObj.getTime() - epocaSheets.getTime()) / 86400000);
      // Copiar formato de fecha de la columna B (fecha de ingreso) para consistencia
      var fmtRef = sheet.getRange(2, 2).getNumberFormat();
      var celda = sheet.getRange(filaEncontrada, colIdx+1);
      celda.setValue(serial);
      if(fmtRef) celda.setNumberFormat(fmtRef);
      camposEscritos++;
      return;
    }

    // Convertir a número los campos monetarios enviados como string
    var CAMPOS_NUMERICOS = ["MONTO DE FINIQUITO","SUELDO MENSUAL","PORCENTAJE DE ASIGNACIÓN"];
    if(CAMPOS_NUMERICOS.indexOf(nombre)!==-1){
      var numVal = parseFloat(valor.toString().replace(/[^0-9.\-]/g,''));
      sheet.getRange(filaEncontrada, colIdx+1).setValue(isNaN(numVal) ? valor : numVal);
    } else {
      sheet.getRange(filaEncontrada, colIdx+1).setValue(valor);
    }
    camposEscritos++;
  });

  // Si se actualizó FECHA DE BAJA, actualizar ESTATUS a "Baja" automáticamente
  if(campos["FECHA DE BAJA"]){
    var colEst = headers.indexOf("ESTATUS");
    // ESTATUS es protegido para updates generales pero sí debe cambiar al registrar baja
    if(colEst !== -1){
      sheet.getRange(filaEncontrada, colEst+1).setValue("Baja");
    }
  }

  // Si se actualizó CORREO ACCESO, activar portal automáticamente
  var nuevoCorrAcc2 = (campos["CORREO ACCESO"] || "").toString().trim();
  if (nuevoCorrAcc2 && idBuscar) {
    try {
      // Buscar no. empleado para la contraseña inicial
      var noEmpPortal = "";
      for (var ip = 1; ip < data.length; ip++) {
        if ((data[ip][50]||"").toString().trim() === idBuscar ||
            (data[ip][0] ||"").toString().trim() === idBuscar) {
          noEmpPortal = (data[ip][0]||"").toString().trim();
          break;
        }
      }
      _activarAccesoInterno(idBuscar, nuevoCorrAcc2, "Prisma" + (noEmpPortal||"001") + "*");
      Logger.log("[Update] Portal activado para: " + nuevoCorrAcc2);
    } catch(exAct) {
      Logger.log("[Update] Error activando portal: " + exAct);
    }
  }

  return {
    status: "success",
    message: "Actualizado: "+camposEscritos+" campo(s) modificado(s) para el empleado #"+idBuscar+"."
  };
}


// ─── OCR VIA GOOGLE (PDF→Drive+Doc, Imagen→Cloud Vision) ────
//
// ESTRATEGIA POR TIPO DE ARCHIVO:
//   PDF  → Drive convierte a Google Doc y extrae texto → GRATIS, sin límites
//   IMG  → Google Cloud Vision API lee el texto → 1,000/mes gratis, luego $1.50/1,000
//
// CONFIGURACIÓN NECESARIA (una sola vez):
//   1. Habilita "Drive API" y "Cloud Vision API" en Google Cloud Console
//   2. El mismo proyecto que usa tu GAS ya tiene acceso a Drive API
//   3. Para Vision API: actívala en console.cloud.google.com → APIs → Cloud Vision API
//   4. No necesitas API key externa — usa las credenciales del propio GAS
//
// payload: { data:"<base64>", mimeType:"application/pdf"|"image/jpeg"|..., nombre:"archivo.pdf" }
function analizarDocumentoOCR(payload) {
  var b64Data  = payload.data;
  var mimeType = payload.mimeType || 'image/jpeg';
  var nombre   = payload.nombre   || 'documento';

  if (!b64Data) return { status:"error", message:"No se recibió el archivo." };

  try {
    if (mimeType === 'application/pdf') {
      return ocr_PDF(b64Data, nombre);
    } else {
      return ocr_Imagen(b64Data, mimeType);
    }
  } catch (err) {
    return { status:"error", message:"Error en OCR: " + err.toString() };
  }
}

// ── OCR de PDF ────────────────────────────────────────────────
// Estrategia:
//   1. Subir PDF a Drive sin convertir
//   2. Copiar el archivo convirtiéndolo a Google Doc (así activa el OCR de Drive)
//   3. Exportar el Doc como texto plano
//   4. Si el texto es insuficiente → fallback a Vision API con thumbnail
function ocr_PDF(b64Data, nombre) {
  var fileId = null;
  var docId  = null;

  try {
    // Validar tamaño antes de decodificar (b64 ~33% mayor al original)
    var estimadoBytes = b64Data.length * 0.75;
    Logger.log('[OCR PDF] Tamaño estimado: ' + Math.round(estimadoBytes/1024) + ' KB');

    if (estimadoBytes > 10 * 1024 * 1024) {
      return { status:"error", message:"El PDF es muy grande (" + Math.round(estimadoBytes/1024/1024) + " MB). Máximo 10 MB. Comprime el PDF o sube solo las páginas necesarias." };
    }

    // Decodificar con manejo de errores
    var decodedBytes;
    try {
      decodedBytes = b64ToBytes(b64Data);
    } catch(decErr) {
      Logger.log('[OCR PDF] Error al decodificar base64: ' + decErr);
      return { status:"error", message:"El archivo PDF no es válido. Intenta con otro archivo." };
    }

    if (!decodedBytes || decodedBytes.length < 100) {
      return { status:"error", message:"El PDF parece estar vacío o corrupto." };
    }

    // Paso 1: subir PDF a Drive tal como es
    var blob  = b64ToBlob(b64Data, 'application/pdf', nombre || 'doc.pdf');
    var file  = DriveApp.getRootFolder().createFile(blob);
    fileId    = file.getId();
    Logger.log('[OCR PDF] PDF subido: ' + fileId);

    // Paso 2: copiar el PDF convirtiéndolo a Google Doc
    // Drive.Files.copy con convert:true activa el OCR automáticamente
    var docFile = Drive.Files.copy(
      { title: 'ocr_tmp_' + fileId },
      fileId,
      { convert: true }
    );
    docId = docFile.id;
    Logger.log('[OCR PDF] Google Doc creado: ' + docId);

    // Paso 3: esperar conversión y leer el texto
    Utilities.sleep(3000);
    var doc   = DocumentApp.openById(docId);
    var texto = doc.getBody().getText().trim();
    Logger.log('[OCR PDF] Texto extraido (' + texto.length + ' chars): ' + texto.substring(0, 300));

    if (texto && texto.length > 15) {
      return extraerCamposDeTexto(texto);
    }

    // Paso 4: fallback a Vision API si el texto es insuficiente
    Logger.log('[OCR PDF] Texto insuficiente, intentando Vision API con thumbnail');
    return ocr_PDFconVisionThumbnail(fileId);

  } catch (err) {
    Logger.log('[OCR PDF] Error: ' + err.toString());
    return { status:"error", message:"Error procesando PDF: " + err.toString() };
  } finally {
    try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    try { if (docId)  DriveApp.getFileById(docId).setTrashed(true);  } catch(e) {}
  }
}

// ── Fallback: obtener thumbnail del PDF y enviarlo a Vision API ─
function ocr_PDFconVisionThumbnail(fileId) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_VISION_API_KEY');
  if (!apiKey) return { status:"error", message:"Falta GOOGLE_VISION_API_KEY en las propiedades del script." };

  try {
    var token = ScriptApp.getOAuthToken();
    // Pedir el thumbnail de alta resolucion
    var metaResp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink', {
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
    });
    var meta = JSON.parse(metaResp.getContentText());

    if (meta.thumbnailLink) {
      var imgResp = UrlFetchApp.fetch(
        meta.thumbnailLink.replace(/=s\d+$/, '=s2000'),
        { muteHttpExceptions: true }
      );
      if (imgResp.getResponseCode() === 200) {
        var imgB64 = Utilities.base64Encode(imgResp.getContent());
        return ocr_VisionAPI(imgB64, 'image/png', apiKey);
      }
    }

    return { status:"error", message:"No se pudo renderizar el PDF como imagen. El documento puede estar protegido o ser un escaneo de baja calidad." };
  } catch(e) {
    return { status:"error", message:"Error en fallback Vision: " + e.toString() };
  }
}

// ── Vision API para IMAGENES (JPG, PNG) ───────────────────────
function ocr_VisionAPI(b64Data, mimeType, apiKey) {
  var url  = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
  var body = JSON.stringify({
    requests: [{
      image:    { content: b64Data },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
    }]
  });

  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: body,  muteHttpExceptions: true
  });

  var json = JSON.parse(resp.getContentText());
  Logger.log('[Vision API] HTTP ' + resp.getResponseCode());

  if (json.error) {
    var msg = json.error.message || json.error.status || 'Error desconocido';
    Logger.log('[Vision API] Error: ' + msg);
    if (json.error.code === 403) return { status:"error", message:"Vision API sin permisos. Verifica que Cloud Vision API este habilitada en Google Cloud Console." };
    return { status:"error", message:"Vision API error: " + msg };
  }

  var texto = ((json.responses || [])[0] || {}).fullTextAnnotation
              ? json.responses[0].fullTextAnnotation.text : '';
  Logger.log('[Vision API] Texto (' + (texto||'').length + '): ' + (texto||'').substring(0,200));

  if (!texto || !texto.trim()) {
    return { status:"error", message:"No se detecto texto. Verifica que la imagen sea legible (minimo 300 DPI) y no este protegida." };
  }

  var campos = extraerCamposDeTexto(texto);
  campos._textoRaw = texto; // texto crudo para que Groq pueda analizar
  return campos;
}

// ── OCR de imagen: Google Cloud Vision API ────────────────────
// Usa la API key almacenada en las propiedades del script.
// Nombre de la propiedad: GOOGLE_VISION_API_KEY  Valor: AIza...
// Limite gratuito: 1,000 imagenes/mes. Despues: $1.50 USD / 1,000.
// ── OCR de imagen: delega a ocr_VisionAPI ────────────────────
function ocr_Imagen(b64Data, mimeType) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_VISION_API_KEY');
  if (!apiKey) {
    return { status:"error", message:"Falta GOOGLE_VISION_API_KEY en las propiedades del script de GAS." };
  }
  return ocr_VisionAPI(b64Data, mimeType, apiKey);
}

// ── Detector de tipo de documento y extractor de campos ──────
// Documentos soportados:
//   CURP (RENAPO), Constancia IMSS/NSS, INE/IFE, Constancia SAT/RFC,
//   Pasaporte mexicano, Comprobante de domicilio, Acta de nacimiento, Genérico.
// Estrategia: detectar primero el tipo, luego aplicar parser específico.
function extraerCamposDeTexto(texto) {
  var t = texto.toUpperCase();
  var datos = {};

  // ── 1. DETECTAR TIPO DE DOCUMENTO ─────────────────────────
  // esSAT PRIMERO — la constancia SAT contiene CURP y PRIMER APELLIDO
  // que harían que esCURP la detecte mal si se evalúa antes
  var esSAT        = t.indexOf('SERVICIO DE ADMINISTRACION TRIBUTARIA') !== -1
                  || t.indexOf('CONSTANCIA DE SITUACION FISCAL') !== -1
                  || (t.indexOf('RFC:') !== -1 && t.indexOf('REGIMEN') !== -1);
  // esCURP excluye documentos SAT
  var esCURP       = !esSAT && (
                     t.indexOf('CLAVE UNICA DE REGISTRO DE POBLACION') !== -1
                  || (t.indexOf('CURP') !== -1 && t.indexOf('PRIMER APELLIDO') !== -1));
  var esIMSS       = t.indexOf('INSTITUTO MEXICANO DEL SEGURO SOCIAL') !== -1
                  || t.indexOf('NUMERO DE SEGURIDAD SOCIAL') !== -1
                  || (t.indexOf('IMSS') !== -1 && t.indexOf('NSS') !== -1);
  var esINE        = t.indexOf('INSTITUTO NACIONAL ELECTORAL') !== -1
                  || (t.indexOf('CREDENCIAL') !== -1 && t.indexOf('VOTAR') !== -1)
                  || t.indexOf('IFE') !== -1;
  var esPasaporte  = t.indexOf('PASAPORTE') !== -1 || t.indexOf('PASSPORT') !== -1;
  var esCompDom    = t.indexOf('COMPROBANTE DE DOMICILIO') !== -1
                  || t.indexOf('COMISION FEDERAL DE ELECTRICIDAD') !== -1
                  || t.indexOf('CFE') !== -1 && t.indexOf('SERVICIO') !== -1
                  || t.indexOf('TELMEX') !== -1 || t.indexOf('IZZI') !== -1
                  || t.indexOf('TOTALPLAY') !== -1 || t.indexOf('MEGACABLE') !== -1
                  || t.indexOf('AGUA') !== -1 && t.indexOf('SERVICIO') !== -1 && t.indexOf('RECIBO') !== -1;
  var esActaNac    = t.indexOf('ACTA DE NACIMIENTO') !== -1
                  || t.indexOf('REGISTRO CIVIL') !== -1;

  // ── 2. CURP — presente en casi todos los docs mexicanos ───
  var reCURP   = /([A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z0-9]{3}[0-9A-Z]\d)/;
  var mCURP    = texto.match(reCURP);
  if (mCURP) datos.curp = mCURP[1];

  // ── 3. RFC — 12-13 chars, excluir si es prefijo de CURP ──
  var mRFC = texto.match(/\b([A-Z&]{3,4}\d{6}[A-Z0-9]{3,4})\b/);
  if (mRFC) {
    var rfc = mRFC[1];
    var esPrefijoCURP = datos.curp && datos.curp.indexOf(rfc) === 0;
    if (!esPrefijoCURP && rfc.length >= 12) datos.rfc = rfc;
  }

  // ── 4. FECHA DE NACIMIENTO — NO se extrae, la calcula el Sheet ─
  // La columna R tiene fórmula — no se sobreescribe

  // ── 5. GÉNERO — NO se extrae, lo calcula el Sheet con fórmula ─
  // Se omite para no sobreescribir la fórmula de la columna U

  // ── 6. LUGAR NAC. Y NACIONALIDAD — NO se extraen del texto ─
  // Las columnas P y Q del Sheet tienen fórmulas — no se sobreescriben

  // ── 7. NOMBRE — parser específico por tipo de documento ───
  var lineas = texto.split('\n')
                    .map(function(l){ return l.trim(); })
                    .filter(function(l){ return l.length > 1; });

  if (esCURP) {
    // CURP RENAPO: etiquetas PRIMER APELLIDO / SEGUNDO APELLIDO / NOMBRE(S)
    // seguidas del valor en la línea inmediata siguiente.
    var apPat = '', apMat = '', nombre1 = '';
    var ETIQUETAS_IGNORAR = ['APELLIDO','NOMBRE','NACIMIENTO','SEXO','MUNICIPIO',
                             'ENTIDAD','CURP','REGISTRO','ESTADO','LOCALIDAD',
                             'FOLIO','FECHA','CLAVE'];
    for (var i = 0; i < lineas.length - 1; i++) {
      var etiq  = lineas[i].toUpperCase();
      var val   = lineas[i+1].trim();
      // La línea actual debe ser una etiqueta conocida
      var esEtiq = ETIQUETAS_IGNORAR.some(function(e){ return etiq.indexOf(e) !== -1; });
      if (!esEtiq) continue;
      // El valor no debe ser otra etiqueta ni contener números de CURP/fecha
      var valUp  = val.toUpperCase();
      var esValOK = val.length > 1
                 && !ETIQUETAS_IGNORAR.some(function(e){ return valUp.indexOf(e) !== -1; })
                 && /^[A-ZÁÉÍÓÚÜÑ]/.test(val)
                 && !/\d{6}/.test(val)
                 && val.toUpperCase() !== 'NO APLICA';
      if (!esValOK) continue;

      if (etiq.indexOf('PRIMER APELLIDO') !== -1) { apPat   = val; }
      else if (etiq.indexOf('SEGUNDO APELLIDO') !== -1) { apMat  = val; }
      else if (etiq.indexOf('NOMBRE') !== -1 && etiq.indexOf('APELLIDO') === -1) { nombre1 = val; }
    }
    var partes = [apPat, apMat, nombre1].filter(function(p){ return p.length > 0; });
    if (partes.length > 0) datos.nombreTrabajador = partes.join(' ').replace(/\s+/g,' ').trim();

  } else if (esIMSS) {
    // IMSS: nombre en línea siguiente a "ASEGURADO", "NOMBRE DEL" o "TITULAR"
    for (var j = 0; j < lineas.length - 1; j++) {
      var lu = lineas[j].toUpperCase();
      if (lu.indexOf('ASEGURADO') !== -1 || lu.indexOf('NOMBRE DEL') !== -1 || lu.indexOf('TITULAR') !== -1) {
        var sig = lineas[j+1];
        if (sig.length > 3 && /^[A-ZÁÉÍÓÚÜÑ]/.test(sig) && sig.toUpperCase().indexOf('IMSS') === -1) {
          datos.nombreTrabajador = sig.replace(/\s+/g,' ').trim();
          break;
        }
      }
    }
    // NSS: 11 dígitos seguidos O con espacios (formato: XX XX XXXXXXX)
    var textoSinEspacios = texto.replace(/\s/g,'');
    var mNSS = textoSinEspacios.match(/(\d{11})/);
    if (mNSS) {
      datos.nss = mNSS[1];
    } else {
      // Buscar con contexto de etiqueta
      var mNSS2 = texto.match(/(?:NSS|SEGURIDAD\s+SOCIAL|N[uú]mero\s+de\s+Seguro)[^0-9]{0,15}(\d[\d\s]{9,13}\d)/i);
      if (mNSS2) datos.nss = mNSS2[1].replace(/\s/g,'').substring(0,11);
    }

  } else if (esINE) {
    // INE: apellidos y nombre en líneas separadas, identificadas por etiqueta NOMBRE
    for (var k = 0; k < lineas.length - 1; k++) {
      var luINE = lineas[k].toUpperCase();
      if (luINE === 'NOMBRE' || luINE.indexOf('NOMBRE DEL CIUDADANO') !== -1) {
        var sigINE = lineas[k+1];
        if (sigINE.length > 3 && /^[A-ZÁÉÍÓÚÜÑ]/.test(sigINE)) {
          datos.nombreTrabajador = sigINE.replace(/\s+/g,' ').trim();
          break;
        }
      }
    }
    // INE también tiene domicilio
    for (var ki = 0; ki < lineas.length - 1; ki++) {
      if (lineas[ki].toUpperCase().indexOf('DOMICILIO') !== -1) {
        var dom = lineas[ki+1];
        if (dom.length > 5) { datos.domicilioCompleto = dom.replace(/\s+/g,' ').trim(); break; }
      }
    }

  } else if (esSAT) {
    // ── Constancia de Situación Fiscal SAT ───────────────────
    // Formato real del documento (verificado con muestra real):
    //   RFC:              LATJ8712126D5
    //   CURP:             LATJ871212HVZRRN05
    //   Nombre (s):       JUAN DIEGO
    //   Primer Apellido:  LARA
    //   Segundo Apellido: TURRUBIATES
    //   Código Postal:78395  (a veces inline sin espacio)
    //   Nombre de Vialidad: EJE 126
    //   Número Exterior:    265
    //   Nombre de la Colonia: INDUSTRIAL SAN LUIS
    //   Nombre del Municipio: SAN LUIS POTOSI
    //   Nombre de la Entidad Federativa: SAN LUIS POTOSI

    // RFC — etiqueta explícita RFC:
    var mRFCsat = texto.match(/RFC\s*:\s*([A-Z&]{3,4}\d{6}[A-Z0-9]{3,4})/i);
    if (mRFCsat) datos.rfc = mRFCsat[1].toUpperCase().trim();

    // CURP — etiqueta explícita CURP: (18 chars — diferente al RFC de 12-13)
    var mCURPsat = texto.match(/CURP\s*:\s*([A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z0-9]{3}[0-9A-Z]\d)/i);
    if (mCURPsat) datos.curp = mCURPsat[1].toUpperCase().trim();
    if (!datos.curp) {
      var mCgen = texto.match(/([A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z0-9]{3}[0-9A-Z]\d)/);
      if (mCgen) datos.curp = mCgen[1].toUpperCase();
    }

    // NOMBRE — construir: Primer Apellido + Segundo Apellido + Nombre(s)
    var satAp1 = '', satAp2 = '', satNom = '';
    // Regex directo sobre el texto (más confiable que parsear líneas)
    var mAp1 = texto.match(/Primer\s+Apellido\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]*?)(?:\n|\r|$)/i);
    var mAp2 = texto.match(/Segundo\s+Apellido\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]*?)(?:\n|\r|$)/i);
    var mNom = texto.match(/Nombre\s*\(?s\)?\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]*?)(?:\n|\r|$)/i);
    if (mAp1) satAp1 = mAp1[1].replace(/\s+/g,' ').trim();
    if (mAp2) satAp2 = mAp2[1].replace(/\s+/g,' ').trim();
    if (mNom) satNom = mNom[1].replace(/\s+/g,' ').trim();
    // Evitar que satNom capture "Primer Apellido" o "Segundo Apellido"
    if (satNom && (satNom.toUpperCase().indexOf('APELLIDO') !== -1 || satNom.length > 40)) satNom = '';
    var partesN = [satAp1, satAp2, satNom].filter(function(p){ return p && p.length > 0; });
    if (partesN.length > 0) datos.nombreTrabajador = partesN.join(' ').replace(/\s+/g,' ').trim();

    // DOMICILIO — construir desde campos individuales
    var satCP = '', satVial = '', satNoExt = '', satCol = '', satMun = '', satEdo = '';
    // CP a veces inline: "Código Postal:78395"
    var mCPi = texto.match(/C[oó]digo\s*Postal\s*[:\-]?\s*(\d{5})/i);
    if (mCPi) satCP = mCPi[1];
    var mVial  = texto.match(/Nombre\s+de\s+Vialidad\s*[:\-]?\s*([^\n\r]{2,50})/i);
    var mNoExt = texto.match(/N[uú]mero\s+Exterior\s*[:\-]?\s*([^\n\r]{1,20})/i);
    var mCol   = texto.match(/Nombre\s+de\s+la\s+Colonia\s*[:\-]?\s*([^\n\r]{2,60})/i);
    var mMun   = texto.match(/Nombre\s+del\s+Municipio[^\n]*[:\-]?\s*([^\n\r]{2,60})/i);
    var mEdo   = texto.match(/Nombre\s+de\s+la\s+Entidad[^\n]*[:\-]?\s*([^\n\r]{2,40})/i);
    if (mVial)  satVial  = mVial[1].replace(/\s+/g,' ').trim();
    if (mNoExt) satNoExt = mNoExt[1].replace(/\s+/g,' ').trim();
    if (mCol)   satCol   = mCol[1].replace(/\s+/g,' ').trim();
    if (mMun)   satMun   = mMun[1].replace(/\s+/g,' ').trim();
    if (mEdo)   satEdo   = mEdo[1].replace(/\s+/g,' ').trim();
    var partesDom = [];
    if (satVial)   partesDom.push(satVial);
    if (satNoExt)  partesDom.push('No. ' + satNoExt);
    if (satCol)    partesDom.push('Col. ' + satCol);
    if (satCP)     partesDom.push('C.P. ' + satCP);
    if (satMun)    partesDom.push(satMun);
    if (satEdo && satEdo.toUpperCase().trim() !== satMun.toUpperCase().trim()) partesDom.push(satEdo);
    if (partesDom.length > 0) datos.domicilioCompleto = partesDom.join(', ');

    // Régimen
    var mReg = texto.match(/REGIMEN[^:\n]{0,30}[:\s]+([^\n]{5,80})/i);
    if (mReg) datos.escolaridad = datos.escolaridad || ('Régimen: ' + mReg[1].replace(/\s+/g,' ').trim().substring(0,60));

  } else if (esPasaporte) {
    // Pasaporte: leer líneas MRZ (machine readable zone) al final del doc
    // Formato: P<MEXAPELLIDOS<<NOMBRES<<<<...
    var mrzMatch = texto.match(/P<MEX([A-Z<]+)<<([A-Z<]+)/);
    if (mrzMatch) {
      var apellidos = mrzMatch[1].replace(/</g,' ').trim();
      var nombres   = mrzMatch[2].replace(/</g,' ').trim();
      datos.nombreTrabajador = (apellidos + ' ' + nombres).replace(/\s+/g,' ').trim();
    } else {
      // Fallback: buscar APELLIDOS y NOMBRE en el texto
      for (var p = 0; p < lineas.length - 1; p++) {
        var luP = lineas[p].toUpperCase();
        if (luP === 'APELLIDOS' || luP === 'SURNAME') {
          datos.nombreTrabajador = (lineas[p+1] + ' ').trim();
        }
        if ((luP === 'NOMBRE' || luP === 'GIVEN NAMES') && datos.nombreTrabajador) {
          datos.nombreTrabajador = (datos.nombreTrabajador + lineas[p+1]).replace(/\s+/g,' ').trim();
          break;
        }
      }
    }
    datos.nacionalidad = 'Mexicana';

  } else if (esCompDom) {
    // Comprobante de domicilio: extraer nombre del titular y dirección
    // CFE/Telmex: "NOMBRE DEL CLIENTE" / "TITULAR" seguido del nombre
    for (var c = 0; c < lineas.length - 1; c++) {
      var luC = lineas[c].toUpperCase();
      if (luC.indexOf('CLIENTE') !== -1 || luC.indexOf('TITULAR') !== -1 || luC.indexOf('NOMBRE') !== -1) {
        var sigC = lineas[c+1];
        if (sigC.length > 3 && /^[A-ZÁÉÍÓÚÜÑ]/.test(sigC) &&
            sigC.toUpperCase().indexOf('SERVICIO') === -1 &&
            sigC.toUpperCase().indexOf('CONTRATO') === -1) {
          datos.nombreTrabajador = sigC.replace(/\s+/g,' ').trim();
          break;
        }
      }
    }
    // Domicilio: buscar "DOMICILIO DE SUMINISTRO" / "DIRECCIÓN" o similar
    var mDom = texto.match(/(?:DOMICILIO|DIRECCI[OÓ]N|SUMINISTRO)[^:\n]{0,20}[:\n]\s*([^\n]{10,100})/i);
    if (mDom) datos.domicilioCompleto = mDom[1].replace(/\s+/g,' ').trim();

  } else if (esActaNac) {
    // Acta de nacimiento: nombre en campo NOMBRE(S) / NOMBRE DEL REGISTRADO
    for (var an = 0; an < lineas.length - 1; an++) {
      var luAN = lineas[an].toUpperCase();
      if (luAN.indexOf('NOMBRE') !== -1 && (luAN.indexOf('REGISTRADO') !== -1 || luAN.indexOf('PRESENTADO') !== -1)) {
        var sigAN = lineas[an+1];
        if (sigAN.length > 2 && /^[A-ZÁÉÍÓÚÜÑ]/.test(sigAN)) {
          datos.nombreTrabajador = sigAN.replace(/\s+/g,' ').trim();
          break;
        }
      }
    }
    // Municipio y estado de nacimiento
    var mMun = texto.match(/(?:MUNICIPIO|CIUDAD)[^:\n]{0,10}[:\n]\s*([A-ZÁÉÍÓÚÜÑ][^\n]{2,40})/i);
    if (mMun && !datos.lugarNacimiento) datos.lugarNacimiento = mMun[1].replace(/\s+/g,' ').trim();

  } else {
    // Genérico: buscar NOMBRE: valor en cualquier formato
    var mn = texto.match(/NOMBRE[^:\n]{0,20}:\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s,]+)/i);
    if (mn) datos.nombreTrabajador = mn[1].replace(/\s+/g,' ').trim();
  }

  // ── 8. NSS GENÉRICO — si no se detectó arriba ────────────
  if (!datos.nss) {
    // Buscar con etiqueta
    var mNSSg = texto.match(/(?:NSS|N[uú]mero\s+de\s+Seguridad\s+Social|SEGURO\s+SOCIAL)[^0-9]{0,20}(\d[\d\s]{9,12}\d)/i);
    if (mNSSg) {
      datos.nss = mNSSg[1].replace(/\s/g,'');
      if (datos.nss.length > 11) datos.nss = datos.nss.substring(0,11);
    }
  }

  // ── 9. CORREO y TELÉFONO: NO se extraen de documentos ───────
  // El usuario los captura manualmente en el formulario.
  // Omitir para evitar datos incorrectos.

  // ── 10. DOMICILIO GENÉRICO — si no se obtuvo arriba ──────
  if (!datos.domicilioCompleto) {
    var mDomG = texto.match(/(?:DOMICILIO|DIRECCI[OÓ]N)[^:\n]{0,20}:\s*([^\n]{10,120})/i);
    if (mDomG) datos.domicilioCompleto = mDomG[1].replace(/\s+/g,' ').trim();
  }

  // ── Eliminar TODOS los campos que no deben extraerse ────────
  delete datos.fechaNacimiento;
  delete datos.genero;
  delete datos.lugarNacimiento;
  delete datos.nacionalidad;
  delete datos.estadoCivil;
  delete datos.telefonoPersonal;
  delete datos.correoElectronico;

  // ── Limpiar campos vacíos ─────────────────────────────────
  Object.keys(datos).forEach(function(k) {
    if (!datos[k] || datos[k].toString().trim() === '') delete datos[k];
  });

  // ── Log de diagnóstico (visible en GAS → Ejecuciones) ─────
  var tipoDoc = esCURP?'CURP':esIMSS?'IMSS':esINE?'INE':esSAT?'SAT':
                esPasaporte?'Pasaporte':esCompDom?'Comprobante Domicilio':
                esActaNac?'Acta Nacimiento':'Genérico';
  Logger.log('[OCR] Tipo detectado: ' + tipoDoc);
  Logger.log('[OCR] Campos: ' + JSON.stringify(datos));

  if (Object.keys(datos).length === 0) {
    return { status:"error", message:"No se encontraron datos reconocibles. Tipo detectado: " + tipoDoc + ". Verifica que el documento sea legible." };
  }

  return { status:"success", datos: datos, tipoDocumento: tipoDoc };
}

// ─── GEMINI OCR — IA gratuita de Google ──────────────────────
// Usa gemini-2.0-flash (capa gratuita: 1,500 req/día, 0 costo).
// Ventaja sobre los regex: entiende el contexto del documento,
// puede deducir el nombre completo, detectar cualquier campo
// y manejar layouts no estándar.
//
// CONFIGURACIÓN: no requiere API key extra si usas la misma cuenta
// de Google del proyecto GAS. Activa "Generative Language API" en
// console.cloud.google.com y agrega la propiedad:
//   GEMINI_API_KEY = AIza... (la misma que generaste para Vision,
//   o una nueva en console.cloud.google.com → Credenciales)
//
// payload: { data:"<base64>", mimeType:"...", nombre:"..." }
function geminiOCR(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
            || PropertiesService.getScriptProperties().getProperty('GOOGLE_VISION_API_KEY');
  if (!apiKey) {
    return { status:"error", message:"Falta GEMINI_API_KEY en las propiedades del script de GAS." };
  }

  var b64Data  = payload.data;
  var mimeType = payload.mimeType || 'image/jpeg';
  var nombre   = payload.nombre   || 'documento';

  if (!b64Data) return { status:"error", message:"No se recibio el archivo." };

  // Para PDFs: convertir a texto primero via Drive, luego analizar con Gemini texto
  var textoParaGemini = '';
  var imagenB64 = null;
  var imagenMime = mimeType;

  if (mimeType === 'application/pdf') {
    var resultado = intentarExtraerTextoPDF(b64Data, nombre);
    if (resultado.texto && resultado.texto.length > 20) {
      textoParaGemini = resultado.texto;
    } else {
      // Usar la imagen del thumbnail si Drive lo genera
      if (resultado.imagenB64) {
        imagenB64  = resultado.imagenB64;
        imagenMime = 'image/png';
      } else {
        // Fallback: enviar PDF directamente (Gemini acepta PDFs via base64)
        imagenB64  = b64Data;
        imagenMime = 'application/pdf';
      }
    }
  } else {
    imagenB64  = b64Data;
    imagenMime = mimeType;
  }

  var promptGemini = 'Extrae datos de este documento mexicano para RH. '
    + 'SOLO estos campos: nombreTrabajador (APELLIDO PATERNO APELLIDO MATERNO NOMBRE(S)), curp (18 chars), rfc (12-13 chars), nss (11 digitos), domicilioCompleto (donde vive el titular), escolaridad. '
    + 'PROHIBIDO: telefonoPersonal, correoElectronico, fechaNacimiento, genero, lugarNacimiento, nacionalidad, estadoCivil. '
    + 'CURP: nombre = PRIMER APELLIDO + SEGUNDO APELLIDO + NOMBRE(S). '
    + 'CFE/TELMEX/agua: domicilio = DOMICILIO DEL SERVICIO o PREDIO, no oficinas. '
    + 'nombreTrabajador NUNCA contiene nacionalidad ni nombre de estados. '
    + 'Responde solo con JSON: {"nombreTrabajador":"","curp":"","rfc":"","nss":"","domicilioCompleto":"","escolaridad":""}';

  var requestBody;
  if (textoParaGemini) {
    requestBody = { contents: [{ parts: [{ text: promptGemini + ' TEXTO: ' + textoParaGemini.substring(0, 3000) }] }] };
  } else {
    requestBody = { contents: [{ parts: [{ inline_data: { mime_type: imagenMime, data: imagenB64 } }, { text: promptGemini }] }] };
  }

  var urlGemini = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  try {
    var respG = UrlFetchApp.fetch(urlGemini, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(requestBody), muteHttpExceptions: true
    });
    var jsonG = JSON.parse(respG.getContentText());
    if (jsonG.error) {
      Logger.log('[Gemini] Error: ' + JSON.stringify(jsonG.error));
      return { status:"error", message:"Gemini error: " + (jsonG.error.message || jsonG.error.status) };
    }
    var candidates = jsonG.candidates || [];
    var parts = ((candidates[0] || {}).content || {}).parts || [];
    var textoResp = parts.map(function(p){ return p.text || ''; }).join('');
    Logger.log('[Gemini] Respuesta: ' + textoResp.substring(0,300));

    var jsonMatch = textoResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { status:"error", message:"Gemini no devolvio JSON valido." };

    var datos = JSON.parse(jsonMatch[0]);
    // Eliminar campos prohibidos
    ['tipoDocumento','fechaNacimiento','genero','lugarNacimiento','nacionalidad',
     'estadoCivil','telefonoPersonal','correoElectronico'].forEach(function(k){ delete datos[k]; });
    // Limpiar vacíos
    Object.keys(datos).forEach(function(k){
      if (!datos[k] || datos[k].toString().trim() === '') delete datos[k];
    });

    Logger.log('[Gemini] Campos: ' + JSON.stringify(datos));
    return { status:"success", datos: datos, motor: 'Gemini' };

  } catch (err) {
    Logger.log('[Gemini] Exception: ' + err.toString());
    return { status:"error", message:"Error en Gemini OCR: " + err.toString() };
  }
}


// Helper: extraer texto de PDF via Drive (reutiliza logica de ocr_PDF)
function intentarExtraerTextoPDF(b64Data, nombre) {
  var resultado = { texto: '', imagenB64: null };
  var fileId = null;
  var docId  = null;
  try {
    var blob   = b64ToBlob(b64Data, 'application/pdf', nombre || 'doc.pdf');
    var file   = DriveApp.getRootFolder().createFile(blob);
    fileId     = file.getId();
    var token  = ScriptApp.getOAuthToken();

    var copyResp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '/copy', {
        method: 'post', contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + token },
        payload: JSON.stringify({ name: 'tmp', mimeType: 'application/vnd.google-apps.document' }),
        muteHttpExceptions: true
    });
    var cr = JSON.parse(copyResp.getContentText());
    if (!cr.error && cr.id) {
      docId = cr.id;
      Utilities.sleep(2500);
      var exp = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + docId + '/export?mimeType=text/plain', {
          method: 'get', headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true
      });
      resultado.texto = exp.getContentText().trim();
    }
    // Thumbnail como imagen backup
    var th = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink', {
        method: 'get', headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true
    });
    var thData = JSON.parse(th.getContentText());
    if (thData.thumbnailLink) {
      var imgR = UrlFetchApp.fetch(thData.thumbnailLink.replace(/=s\d+$/, '=s1200'), { muteHttpExceptions: true });
      if (imgR.getResponseCode() === 200) resultado.imagenB64 = Utilities.base64Encode(imgR.getContent());
    }
  } catch(e) { Logger.log('intentarExtraerTextoPDF: ' + e); }
  finally {
    try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    try { if (docId)  DriveApp.getFileById(docId).setTrashed(true);  } catch(e) {}
  }
  return resultado;
}

// ─── GROQ OCR — IA gratuita con Llama 3 ──────────────────────
// Groq ofrece inferencia ultra-rapida con modelos Llama completamente
// gratis: 14,400 peticiones/dia, sin tarjeta de credito.
// Modelo: llama-3.1-8b-instant (rapido) o llama-3.3-70b-versatile (preciso)
//
// Flujo:
//   PDF  → Drive extrae texto → Groq analiza el texto con IA
//   IMG  → Vision API extrae texto → Groq analiza el texto con IA
//   En ambos casos Groq recibe TEXTO (no imagen) — es un LLM de texto puro.
//
// Propiedad requerida en GAS: GROQ_API_KEY = gsk_...
// Obtener gratis en: console.groq.com → API Keys
function groqOCR(payload) {
  var groqKey   = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  var visionKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_VISION_API_KEY');

  if (!groqKey) {
    return { status:"error", message:"Falta GROQ_API_KEY en las propiedades del script de GAS." };
  }

  var b64Data  = payload.data;
  var mimeType = payload.mimeType || 'image/jpeg';
  var nombre   = payload.nombre   || 'documento';

  if (!b64Data) return { status:"error", message:"No se recibio el archivo." };

  // ── Paso 1: Extraer texto del documento ───────────────────
  var textoExtraido = '';

  if (mimeType === 'application/pdf') {
    // PDF → intentar extraer texto para Groq
    var resultadoTexto = extraerTextoPDFparaGroq(b64Data, nombre);
    if (resultadoTexto.error) {
      Logger.log('[groqOCR] extraerTextoPDFparaGroq falló: ' + resultadoTexto.error + '. Intentando ocr_PDF directo...');
      // Fallback: usar ocr_PDF que tiene su propio pipeline con thumbnail + Vision
      var r = ocr_PDF(b64Data, nombre);
      if (r.status === 'success') return r;
      return { status:"error", message:"Error extrayendo texto del PDF: " + resultadoTexto.error };
    }
    textoExtraido = resultadoTexto.texto;
  } else {
    // Imagen → Vision API extrae el texto
    if (!visionKey) {
      return { status:"error", message:"Falta GOOGLE_VISION_API_KEY para procesar imagenes." };
    }
    var visionResult = ocr_VisionAPI(b64Data, mimeType, visionKey);
    if (visionResult.status !== 'success') {
      // Si Vision falla, intentar con los regex directamente
      return analizarDocumentoOCR(payload);
    }
    // Si Vision ya devolvio campos, enriquecerlos con Groq
    textoExtraido = visionResult._textoRaw || '';
    if (!textoExtraido) return visionResult;
  }

  if (!textoExtraido || textoExtraido.length < 10) {
    return { status:"error", message:"No se pudo extraer texto del documento para analizar." };
  }

  // ── Paso 2: Analizar texto con Groq/Llama ─────────────────
  return analizarTextoConGroq(textoExtraido, groqKey);
}

// ── Extraer texto de PDF para Groq ────────────────────────────
// Estrategia:
//   1. Subir PDF a Drive y copiar con convert:true (OCR de Drive — funciona con PDFs digitales)
//   2. Si Drive.copy falla o devuelve texto vacío → exportar como imagen y usar Vision API
//   3. Si Vision API no está configurada → devolver error descriptivo
function extraerTextoPDFparaGroq(b64Data, nombre) {
  var fileId = null;
  var docId  = null;
  try {
    var blob = b64ToBlob(b64Data, 'application/pdf', nombre || 'doc.pdf');
    var file = DriveApp.getRootFolder().createFile(blob);
    fileId   = file.getId();
    Logger.log('[Groq] PDF subido: ' + fileId);

    // Intento 1: Drive convierte PDF a Google Doc (funciona con PDFs con texto digital)
    var texto = '';
    try {
      var docFile = Drive.Files.copy({ title: 'tmp_' + fileId }, fileId, { convert: true });
      docId = docFile.id;
      Utilities.sleep(3000);
      var doc = DocumentApp.openById(docId);
      texto = doc.getBody().getText().trim();
      Logger.log('[Groq] Texto via Drive.copy (' + texto.length + ' chars): ' + texto.substring(0,200));
    } catch(driveErr) {
      Logger.log('[Groq] Drive.copy falló (PDF escaneado?): ' + driveErr);
      texto = '';
    }

    // Intento 2: si el texto es insuficiente, usar thumbnail + Vision API
    if (!texto || texto.length < 20) {
      Logger.log('[Groq] Texto insuficiente, intentando Vision API con imagen del PDF...');
      var visionKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_VISION_API_KEY');

      // Método A: exportar página 1 del PDF como PNG vía Drive API
      try {
        var token = ScriptApp.getOAuthToken();
        // Pedir thumbnail de alta resolución directamente
        var metaResp = UrlFetchApp.fetch(
          'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink,exportLinks',
          { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
        );
        var meta = JSON.parse(metaResp.getContentText());
        Logger.log('[Groq] Meta Drive: ' + JSON.stringify(meta).substring(0,200));

        if (meta.thumbnailLink) {
          var imgUrl = meta.thumbnailLink.replace(/=s\d+$/, '=s2400'); // alta resolución
          var imgResp = UrlFetchApp.fetch(imgUrl, { muteHttpExceptions: true });
          if (imgResp.getResponseCode() === 200) {
            var imgB64 = Utilities.base64Encode(imgResp.getContent());
            Logger.log('[Groq] Imagen del PDF obtenida, enviando a Vision...');
            if (visionKey) {
              var vResult = ocr_VisionAPI(imgB64, 'image/png', visionKey);
              if (vResult.status === 'success') {
                // Retornar texto raw para que Groq lo analice
                var textoVision = vResult._textoRaw || '';
                if (textoVision && textoVision.length > 20) {
                  Logger.log('[Groq] Texto via Vision (' + textoVision.length + ' chars)');
                  return { texto: textoVision };
                }
              }
            } else {
              // Sin Vision API: extraer texto con regex directamente de la imagen
              // Devolver los campos que Vision ya extrajo
              Logger.log('[Groq] Sin GOOGLE_VISION_API_KEY, intentando extracción directa');
            }
          }
        }
      } catch(thumbErr) {
        Logger.log('[Groq] Error obteniendo thumbnail: ' + thumbErr);
      }

      // Método B: si no hay thumbnail ni Vision, intentar exportar como texto plano
      try {
        var token2 = ScriptApp.getOAuthToken();
        var exportResp = UrlFetchApp.fetch(
          'https://www.googleapis.com/drive/v3/files/' + fileId + '/export?mimeType=text/plain',
          { headers: { 'Authorization': 'Bearer ' + token2 }, muteHttpExceptions: true }
        );
        if (exportResp.getResponseCode() === 200) {
          var textoExport = exportResp.getContentText().trim();
          if (textoExport && textoExport.length > 20) {
            Logger.log('[Groq] Texto via export/text (' + textoExport.length + ' chars)');
            return { texto: textoExport };
          }
        }
      } catch(exportErr) {
        Logger.log('[Groq] Export texto falló: ' + exportErr);
      }

      if (!texto || texto.length < 20) {
        return { error: 'PDF escaneado sin texto extraíble. ' + 
                        (visionKey ? 'Vision API no pudo extraer texto.' : 'Configura GOOGLE_VISION_API_KEY en las propiedades del script.') };
      }
    }

    return { texto: texto };

  } catch(e) {
    Logger.log('[Groq] Error extrayendo PDF: ' + e.toString());
    return { error: e.toString() };
  } finally {
    try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    try { if (docId)  DriveApp.getFileById(docId).setTrashed(true);  } catch(e) {}
  }
}

// ── Llamada a Groq API con Llama 3 ────────────────────────────
function analizarTextoConGroq(texto, groqKey) {

  // ── PASO 1: Identificar tipo — regex primero, Groq como fallback ──
  // Los regex son más confiables para documentos con palabras clave claras.
  // Groq solo se usa si los regex no reconocen el tipo.
  var t = texto.toUpperCase();
  var tipoDoc = '';

  // SAT PRIMERO — la constancia contiene CURP y PRIMER APELLIDO que confunden a Groq
  if (t.indexOf('CONSTANCIA DE SITUACION FISCAL') !== -1
      || t.indexOf('CEDULA DE IDENTIFICACION FISCAL') !== -1
      || t.indexOf('SERVICIO DE ADMINISTRACION TRIBUTARIA') !== -1
      || (t.indexOf('RFC:') !== -1 && t.indexOf('PRIMER APELLIDO') !== -1)) {
    tipoDoc = 'SAT';
  } else if (t.indexOf('CLAVE UNICA DE REGISTRO DE POBLACION') !== -1
      || (t.indexOf('CURP') !== -1 && t.indexOf('PRIMER APELLIDO') !== -1
          && t.indexOf('CONSTANCIA') === -1)) {
    tipoDoc = 'CURP';
  } else if (t.indexOf('INSTITUTO NACIONAL ELECTORAL') !== -1
      || t.indexOf('CREDENCIAL PARA VOTAR') !== -1 || t.indexOf('IFE') !== -1) {
    tipoDoc = 'INE';
  } else if (t.indexOf('SEGURO SOCIAL') !== -1 || t.indexOf('IMSS') !== -1) {
    tipoDoc = 'IMSS';
  } else if (t.indexOf('COMISION FEDERAL DE ELECTRICIDAD') !== -1 || t.indexOf('CFE') !== -1) {
    tipoDoc = 'CFE';
  } else if (t.indexOf('TELMEX') !== -1 || t.indexOf('IZZI') !== -1 || t.indexOf('TOTALPLAY') !== -1) {
    tipoDoc = 'TELMEX';
  } else if (t.indexOf('AGUA') !== -1 && t.indexOf('SERVICIO') !== -1) {
    tipoDoc = 'AGUA';
  } else if (t.indexOf('PASAPORTE') !== -1 || t.indexOf('PASSPORT') !== -1) {
    tipoDoc = 'PASAPORTE';
  } else if (t.indexOf('ACTA DE NACIMIENTO') !== -1) {
    tipoDoc = 'ACTA';
  }

  // Si los regex no detectaron el tipo, usar Groq
  if (!tipoDoc) {
    var respTipo = llamarGroq(groqKey,
      'Eres un clasificador de documentos mexicanos. Lee el texto y responde UNICAMENTE con UNA de estas palabras: CURP, INE, IMSS, SAT, CFE, TELMEX, AGUA, PASAPORTE, ACTA, TITULO, DESCONOCIDO. Sin explicaciones, solo la palabra.',
      'Identifica que tipo de documento es el siguiente texto: ' + texto.substring(0, 1500),
      20
    );
    if (!respTipo) {
      Logger.log('[Groq] Tipo no detectado — usando regex parser');
      return limpiarYRetornar(extraerCamposDeTexto(texto));
    }
    tipoDoc = respTipo.trim().toUpperCase().replace(/[^A-Z]/g,'');
  }

  Logger.log('[Groq] Tipo detectado: ' + tipoDoc);

  // ── PASO 2: Extraer campos específicos del tipo ────────────
  var instruccion = obtenerInstruccionPorTipo(tipoDoc, texto);
  if (!instruccion) {
    Logger.log('[Groq] Tipo no soportado: ' + tipoDoc + ' — usando regex');
    return limpiarYRetornar(extraerCamposDeTexto(texto));
  }

  var respDatos = llamarGroq(groqKey,
    'Extrae los datos exactamente como se indica. Responde SOLO con JSON valido, sin texto adicional.',
    instruccion,
    300
  );

  if (!respDatos) {
    Logger.log('[Groq] Paso 2 fallido — usando regex');
    return limpiarYRetornar(extraerCamposDeTexto(texto));
  }

  try {
    var match = respDatos.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Sin JSON en respuesta');
    var datos = JSON.parse(match[0]);

    // Eliminar campos no permitidos aunque Groq los haya devuelto
    ['tipoDocumento','fechaNacimiento','genero','lugarNacimiento',
     'nacionalidad','estadoCivil','telefonoPersonal','correoElectronico'].forEach(function(k){
      delete datos[k];
    });

    // Limpiar vacíos
    Object.keys(datos).forEach(function(k) {
      if (!datos[k] || datos[k].toString().trim() === '') delete datos[k];
    });

    Logger.log('[Groq] Datos extraidos: ' + JSON.stringify(datos));

    if (Object.keys(datos).length === 0) {
      return limpiarYRetornar(extraerCamposDeTexto(texto));
    }

    return { status:'success', datos:datos, tipoDocumento:tipoDoc, motor:'Groq/2pasos' };

  } catch(parseErr) {
    Logger.log('[Groq] Error JSON: ' + parseErr + ' | ' + respDatos.substring(0,200));
    return limpiarYRetornar(extraerCamposDeTexto(texto));
  }
}

// ── Instrucciones específicas por tipo ────────────────────────
function obtenerInstruccionPorTipo(tipo, texto) {
  var t = texto.substring(0, 2500);
  var pre = 'Responde SOLO con JSON valido sin texto adicional. ';
  switch(tipo) {
    case 'CURP':
      return pre + 'De esta CURP impresa RENAPO extrae: 1) nombreTrabajador = valor_de_PRIMER_APELLIDO + espacio + valor_de_SEGUNDO_APELLIDO + espacio + valor_de_NOMBRE(S). NUNCA pongas nacionalidad ni estado. 2) curp = la clave de 18 caracteres alfanumericos. Formato: {"nombreTrabajador":"...","curp":"..."} TEXTO: ' + t;
    case 'INE':
      return pre + 'De esta credencial INE o IFE extrae: 1) nombreTrabajador = nombre completo del CIUDADANO titular en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S), no funcionarios del INE. 2) curp = 18 caracteres si aparece. 3) domicilioCompleto = direccion del CIUDADANO bajo etiqueta DOMICILIO (anverso en INE moderna, reverso en IFE antigua), NO direccion del INE. Formato: {"nombreTrabajador":"...","curp":"...","domicilioCompleto":"..."} TEXTO: ' + t;
    case 'IMSS':
      return pre + 'De esta constancia IMSS o AFORE extrae: 1) nss = exactamente 11 digitos numericos del Numero de Seguridad Social. 2) nombreTrabajador = nombre del ASEGURADO en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). 3) curp = 18 caracteres si aparece. Formato: {"nss":"...","nombreTrabajador":"...","curp":"..."} TEXTO: ' + t;
    case 'SAT':
      return pre + 'De esta Constancia de Situacion Fiscal SAT extrae exactamente 4 campos: '
        + '1) rfc = valor despues de etiqueta RFC: (12 o 13 chars, ej: LATJ8712126D5). '
        + '2) curp = valor despues de etiqueta CURP: (exactamente 18 chars, ej: LATJ871212HVZRRN05). RFC y CURP son DIFERENTES — no los confundas. '
        + '3) nombreTrabajador = concatenar: valor de "Primer Apellido" + espacio + valor de "Segundo Apellido" + espacio + valor de "Nombre (s)". '
        + '4) domicilioCompleto = unir en una cadena: "Nombre de Vialidad" + " No." + "Numero Exterior" + ", Col. " + "Nombre de la Colonia" + ", C.P. " + numero de "Codigo Postal" + ", " + "Nombre del Municipio o Demarcacion Territorial" + ", " + "Nombre de la Entidad Federativa". '
        + 'Formato: {"rfc":"...","curp":"...","nombreTrabajador":"...","domicilioCompleto":"..."} TEXTO: ' + t;
    case 'CFE':
      return pre + 'De este recibo de luz CFE extrae: 1) domicilioCompleto = direccion en seccion DOMICILIO DEL SERVICIO o DATOS DEL SERVICIO, donde vive el cliente, NO oficinas CFE. Incluye calle numero colonia municipio estado. 2) nombreTrabajador = NOMBRE DEL CLIENTE o TITULAR en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). Formato: {"domicilioCompleto":"...","nombreTrabajador":"..."} TEXTO: ' + t;
    case 'TELMEX':
      return pre + 'De este recibo de telefonia (TELMEX, IZZI, TOTALPLAY o MEGACABLE) extrae: 1) domicilioCompleto = direccion en DOMICILIO DE INSTALACION o DOMICILIO DEL CLIENTE, donde vive el cliente, NO sucursales. 2) nombreTrabajador = TITULAR en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). Formato: {"domicilioCompleto":"...","nombreTrabajador":"..."} TEXTO: ' + t;
    case 'AGUA':
      return pre + 'De este recibo de agua extrae: 1) domicilioCompleto = direccion en DOMICILIO DEL PREDIO o UBICACION DEL PREDIO, donde vive el usuario. 2) nombreTrabajador = TITULAR en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). Formato: {"domicilioCompleto":"...","nombreTrabajador":"..."} TEXTO: ' + t;
    case 'PASAPORTE':
      return pre + 'De este pasaporte mexicano extrae: 1) nombreTrabajador = une APELLIDOS y NOMBRE(S) en formato APELLIDOS NOMBRE(S). 2) curp = 18 caracteres si aparece. Formato: {"nombreTrabajador":"...","curp":"..."} TEXTO: ' + t;
    case 'ACTA':
      return pre + 'De esta acta de nacimiento extrae: 1) nombreTrabajador = nombre del registrado en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). 2) curp = 18 caracteres si aparece. Formato: {"nombreTrabajador":"...","curp":"..."} TEXTO: ' + t;
    case 'TITULO':
      return pre + 'De este titulo, cedula o certificado de estudios extrae: 1) nombreTrabajador = nombre del egresado en formato APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). 2) escolaridad = nivel (Licenciatura, Maestria, Doctorado, Bachillerato, TSU, Secundaria, etc). Formato: {"nombreTrabajador":"...","escolaridad":"..."} TEXTO: ' + t;
    default:
      return null;
  }
}

// ── Helper: llamar a Groq ─────────────────────────────────────
function llamarGroq(groqKey, sistema, usuario, maxTokens) {
  try {
    var resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + groqKey },
      payload: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: sistema },
          { role: 'user',   content: usuario }
        ],
        temperature: 0.05,
        max_tokens:  maxTokens || 300
      }),
      muteHttpExceptions: true
    });
    var json = JSON.parse(resp.getContentText());
    if (json.error) { Logger.log('[llamarGroq] Error: ' + json.error.message); return null; }
    return ((json.choices || [])[0] || {}).message ? json.choices[0].message.content : null;
  } catch(e) {
    Logger.log('[llamarGroq] Exception: ' + e);
    return null;
  }
}

// ── Helper: limpiar campos prohibidos ─────────────────────────
function limpiarYRetornar(resultado) {
  if (resultado && resultado.datos) {
    ['fechaNacimiento','genero','lugarNacimiento','nacionalidad',
     'estadoCivil','telefonoPersonal','correoElectronico'].forEach(function(k){
      delete resultado.datos[k];
    });
  }
  return resultado;
}


// ─── SUBIR DOCUMENTO AL EXPEDIENTE ───────────────────────────
// Recibe: { numeroEmpleado, nombreArchivo, mimeType, data (base64) }
// Busca la carpeta del empleado en Drive por su No. de Empleado
// y sube el archivo directamente ahí.
function subirDocumento(payload) {
  var noEmp  = (payload.numeroEmpleado || '').toString().trim();
  var nombre = payload.nombreArchivo   || 'foto_perfil.jpg';
  var mime   = payload.mimeType        || 'image/jpeg';
  var b64    = payload.data;

  Logger.log('[SubirDoc] Iniciando — noEmp: ' + noEmp + ' | archivo: ' + nombre);

  if (!noEmp) return { status:'error', message:'No se proporcionó número de empleado.' };
  if (!b64)   return { status:'error', message:'No se recibió el archivo.' };

  try {
    var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet   = ss.getSheetByName(NOMBRE_HOJA);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){
      return h ? h.toString().replace(/[\n\r]/g,' ').trim() : '';
    });

    var colNoEmp  = headers.indexOf('NO. EMPLEADO');
    var colNom    = headers.indexOf('NOMBRE DEL TRABAJADOR');
    var colEmp    = headers.indexOf('EMPRESA');
    var colIdInt  = headers.indexOf('ID INTERNO'); // AY — identificador único
    if (colIdInt === -1) colIdInt = 50; // AY = índice 50 (columna 51)
    var colURL    = -1;
    for (var hi = 0; hi < headers.length; hi++) {
      if (headers[hi].replace(/\s+/g,' ').toUpperCase() === 'URL EXPEDIENTE') { colURL = hi; break; }
    }
    if (colURL === -1) colURL = 49; // AX = índice 49 (columna 50)

    Logger.log('[SubirDoc] Cols — ID_INT:' + colIdInt + ' NO.EMP:' + colNoEmp + ' URL:' + colURL);

    // Priorizar búsqueda por ID INTERNO (único entre empresas)
    // Fallback: NO. EMPLEADO (puede repetirse entre empresas)
    var idInterno = (payload.idInterno || '').toString().trim();
    var urlExpediente = '';
    var filaSheet     = -1;
    var nomEmpleado   = '';
    var empEmpleado   = '';

    for (var i = 1; i < data.length; i++) {
      var match = false;
      if (idInterno) {
        // Buscar por ID INTERNO — garantiza empleado correcto
        var celdaId = (data[i][colIdInt] !== undefined && data[i][colIdInt] !== null)
                      ? data[i][colIdInt].toString().trim() : '';
        match = (celdaId === idInterno);
      } else {
        // Fallback por NO. EMPLEADO (solo si no hay idInterno)
        var celdaNo = (data[i][colNoEmp] !== undefined && data[i][colNoEmp] !== null)
                      ? data[i][colNoEmp].toString().trim() : '';
        match = (celdaNo === noEmp);
      }
      if (match) {
        filaSheet     = i + 1;
        urlExpediente = colURL   >= 0 ? (data[i][colURL]   || '').toString().trim() : '';
        nomEmpleado   = colNom   >= 0 ? (data[i][colNom]   || '').toString().trim() : '';
        empEmpleado   = colEmp   >= 0 ? (data[i][colEmp]   || '').toString().trim() : '';
        Logger.log('[SubirDoc] Encontrado fila ' + filaSheet + 
                   ' | ID:' + idInterno + ' | URL: ' + (urlExpediente||'vacía') +
                   ' | ' + nomEmpleado + ' | ' + empEmpleado);
        break;
      }
    }

    if (filaSheet === -1) {
      Logger.log('[SubirDoc] No encontrado — idInterno:' + idInterno + ' noEmp:' + noEmp);
      return { status:'error', message:'No se encontró el empleado (ID:' + idInterno + ' / #' + noEmp + ').' };
    }

    if (!urlExpediente) {
      Logger.log('[SubirDoc] Sin carpeta — creando en Drive...');
      try {
        var rootFolder = null;
        try {
          rootFolder = DriveApp.getFolderById(ID_CARPETA_EXPEDIENTES);
          Logger.log('[SubirDoc] Carpeta raiz OK: ' + rootFolder.getName());
        } catch(eRoot) {
          return { status:'error', message:'Sin acceso a carpeta raiz ID=' + ID_CARPETA_EXPEDIENTES + ' | ' + eRoot.toString() };
        }
        var empNomLimpio = (empEmpleado || 'Sin Empresa').toString().trim();
        var empIter = rootFolder.searchFolders("title = '" + empNomLimpio + "'");
        var empDir  = empIter.hasNext() ? empIter.next() : rootFolder.createFolder(empNomLimpio);
        var subDir  = empDir.createFolder(noEmp + ' - ' + (nomEmpleado || 'Sin Nombre'));
        urlExpediente = subDir.getUrl();
        sheet.getRange(filaSheet, colURL + 1).setValue(urlExpediente);
        Logger.log('[SubirDoc] Carpeta creada: ' + urlExpediente);
      } catch(eCarpeta) {
        return { status:'error', message:'Error creando carpeta: ' + eCarpeta.toString() };
      }
    }

    var mFolder  = urlExpediente.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    var folderId = mFolder ? mFolder[1] : '';
    Logger.log('[SubirDoc] folderId: ' + (folderId||'vacio'));
    if (!folderId) return { status:'error', message:'No se pudo extraer folder ID de: ' + urlExpediente };

    var folder = null;
    try {
      folder = DriveApp.getFolderById(folderId);
      Logger.log('[SubirDoc] Carpeta empleado OK: ' + folder.getName());
    } catch(eFolder) {
      return { status:'error', message:'Sin acceso a carpeta empleado ID=' + folderId + ' | ' + eFolder.toString() };
    }
    var blob = b64ToBlob(b64, mime, nombre);
    var file = folder.createFile(blob);

    Logger.log('[SubirDoc] OK: ' + file.getName() + ' (' + file.getId() + ')');

    return {
      status:    'success',
      message:   'Foto subida al expediente #' + noEmp + '.',
      fileId:    file.getId(),
      fileUrl:   file.getUrl(),
      folderUrl: urlExpediente
    };

  } catch (err) {
    Logger.log('[SubirDoc] Error general: ' + err.toString());
    return { status:'error', message:'Error: ' + err.toString() };
  }
}

// ─── SUBIR CONTRATO FIRMADO ────────────────────────────────────
// Sube el PDF del contrato firmado a la carpeta del empleado en Drive
// y marca CONTRATO FIRMADO = "Sí" + guarda la URL en URL CONTRATO FIRMADO.
function subirContratoFirmado(payload) {
  var idInterno = (payload.idInterno || '').toString().trim();
  var nombre    = payload.nombre || 'contrato_firmado.pdf';
  var mime      = payload.tipo   || 'application/pdf';
  var b64       = payload.datos;

  if (!idInterno) return { status:'error', message:'No se proporcionó ID del empleado.' };
  if (!b64)       return { status:'error', message:'No se recibió el archivo.' };

  try {
    var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet   = ss.getSheetByName(NOMBRE_HOJA);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){ return h ? h.toString().trim() : ''; });

    var colIdInt  = headers.indexOf('ID INTERNO');
    if (colIdInt === -1) colIdInt = 50;
    var colURLFirma   = headers.indexOf('URL CONTRATO FIRMADO');
    var colFirmado    = headers.indexOf('CONTRATO FIRMADO');
    var colCarpeta    = headers.indexOf('LINK EXPEDIENTE');
    var colEmp        = headers.indexOf('EMPRESA');
    var colNom        = headers.indexOf('NOMBRE DEL TRABAJADOR');

    var filaEncontrada = -1;
    var carpetaURL = '', empresa = '', nomTrab = '';
    for (var i = 1; i < data.length; i++) {
      if ((data[i][colIdInt] || '').toString().trim() === idInterno) {
        filaEncontrada = i + 1;
        carpetaURL = colCarpeta !== -1 ? (data[i][colCarpeta] || '').toString() : '';
        empresa    = colEmp !== -1     ? (data[i][colEmp]     || '').toString() : '';
        nomTrab    = colNom !== -1     ? (data[i][colNom]     || '').toString() : '';
        break;
      }
    }
    if (filaEncontrada === -1) return { status:'error', message:'Empleado no encontrado.' };

    // Obtener o crear carpeta del expediente
    var carpeta;
    var matchCarpeta = carpetaURL.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (matchCarpeta) {
      try { carpeta = DriveApp.getFolderById(matchCarpeta[1]); } catch(e) { carpeta = null; }
    }
    if (!carpeta) {
      // Crear carpeta en raíz de expedientes
      var raiz = DriveApp.getFolderById(ID_CARPETA_EXPEDIENTES);
      var subNombre = empresa.trim();
      var subFolders = raiz.getFoldersByName(subNombre);
      var sub = subFolders.hasNext() ? subFolders.next() : raiz.createFolder(subNombre);
      var carpNombre = idInterno + ' — ' + nomTrab;
      var carpExist = sub.getFoldersByName(carpNombre);
      carpeta = carpExist.hasNext() ? carpExist.next() : sub.createFolder(carpNombre);
      // Guardar URL carpeta
      if (colCarpeta !== -1) sheet.getRange(filaEncontrada, colCarpeta+1).setValue(carpeta.getUrl());
    }

    // Subir archivo (reemplazar si ya existe uno con el mismo nombre)
    var blob = b64ToBlob(b64, mime, nombre);
    var archivos = carpeta.getFilesByName(nombre);
    var archivo;
    if (archivos.hasNext()) {
      archivo = archivos.next();
      archivo.setContent(blob);
    } else {
      archivo = carpeta.createFile(blob);
    }
    var url = archivo.getUrl();

    // Guardar URL y marcar como firmado
    if (colURLFirma !== -1) sheet.getRange(filaEncontrada, colURLFirma+1).setValue(url);
    if (colFirmado  !== -1) sheet.getRange(filaEncontrada, colFirmado+1).setValue('Sí');

    return { status:'success', url: url };
  } catch (err) {
    Logger.log('[SubirContrato] Error: ' + err.toString());
    return { status:'error', message:'Error: ' + err.toString() };
  }
}
// Busca la primera imagen (JPG/PNG) en la carpeta Drive del empleado
// para mostrarla como foto de perfil en el drawer.
// Prioriza archivos que tengan "foto" o "perfil" en el nombre.
function obtenerFotoExpediente(payload) {
  var folderId = (payload.folderId || "").toString().trim();
  if (!folderId) return { status:"error", message:"No se proporcionó folderId." };

  try {
    var folder = DriveApp.getFolderById(folderId);
    var tipos  = ['image/jpeg','image/png','image/jpg'];
    var fotoUrl = null;
    var fotoNombre = null;

    // Buscar primero archivos con "foto" o "perfil" en el nombre
    var prioridad = ['foto','perfil','profile'];
    for (var t = 0; t < tipos.length; t++) {
      var iter = folder.getFilesByType(tipos[t]);
      while (iter.hasNext()) {
        var file = iter.next();
        var nombre = file.getName().toLowerCase();
        var esPrioridad = prioridad.some(function(p){ return nombre.indexOf(p) !== -1; });
        if (esPrioridad) {
          var fileId = file.getId();
          return {
            status: "success",
            url: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w200-h200",
            nombre: file.getName()
          };
        }
        // Guardar la primera imagen encontrada como fallback
        if (!fotoUrl) {
          fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w200-h200";
          fotoNombre = file.getName();
        }
      }
    }

    if (fotoUrl) return { status:"success", url: fotoUrl, nombre: fotoNombre };
    return { status:"error", message:"No hay imágenes en el expediente." };

  } catch(e) {
    Logger.log('[obtenerFoto] Error: ' + e);
    return { status:"error", message:"Error buscando foto: " + e.toString() };
  }
}

// ─── ASIGNAR IDs INTERNOS A REGISTROS EXISTENTES ─────────────
// Ejecutar UNA SOLA VEZ desde el editor de GAS para asignar
// IDs a todos los empleados que no tienen ID en columna AY.
// Después de ejecutar, verifica en el Sheet que los IDs quedaron bien.
function asignarIDsMasivamente() {
  var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet   = ss.getSheetByName(NOMBRE_HOJA);
  var datos   = sheet.getDataRange().getValues();
  var headers = datos[0].map(function(h){ return h ? h.toString().replace(/\n/g," ").trim() : ""; });

  // Buscar columnas por nombre normalizado
  var colNo  = -1, colEmp = -1, colID = -1;
  headers.forEach(function(h, i) {
    var hn = h.toUpperCase();
    if (hn === "NO. EMPLEADO" || hn === "NO EMPLEADO" || hn === "NÚMERO DE EMPLEADO") colNo = i;
    if (hn === "EMPRESA") colEmp = i;
    if (hn === "ID INTERNO" || hn === "ID" || hn.indexOf("ID INTERNO") !== -1) colID = i;
  });

  // Fallback: usar posiciones fijas si no se encuentran por nombre
  if (colNo  === -1) colNo  = 0;  // A = columna 1 (índice 0)
  if (colEmp === -1) colEmp = 5;  // F = columna 6 (índice 5)
  if (colID  === -1) colID  = 50; // AY = columna 51 (índice 50)

  Logger.log("[AsignarIDs] Columnas → No.Emp:" + colNo + " Empresa:" + colEmp + " ID:" + colID);
  Logger.log("[AsignarIDs] Total filas: " + (datos.length - 1));
  Logger.log("[AsignarIDs] Header colID: " + JSON.stringify(headers[colID]));
  Logger.log("[AsignarIDs] Header colNo: " + JSON.stringify(headers[colNo]));
  Logger.log("[AsignarIDs] Header colEmp: " + JSON.stringify(headers[colEmp]));

  // Primero construir el mapa de siglas ya usadas (de los que ya tienen ID)
  var mapaEmpresas = {}; // { "Newspot Mexico": { siglas:"NM", ultimo:5 } }
  for (var i = 1; i < datos.length; i++) {
    var idExistente = (datos[i][colID] || "").toString().trim();
    var empExistente = (datos[i][colEmp] || "").toString().trim();
    if (!idExistente || !empExistente) continue;
    var match = idExistente.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    var sig = match[1];
    var num = parseInt(match[2]);
    if (!mapaEmpresas[empExistente]) {
      mapaEmpresas[empExistente] = { siglas: sig, ultimo: num };
    } else if (num > mapaEmpresas[empExistente].ultimo) {
      mapaEmpresas[empExistente].ultimo = num;
    }
  }

  Logger.log('[AsignarIDs] Empresas con IDs existentes: ' + JSON.stringify(Object.keys(mapaEmpresas)));

  var asignados = 0;
  var errores   = 0;

  for (var r = 1; r < datos.length; r++) {
    var idActual = (datos[r][colID] || "").toString().trim();
    if (idActual) continue; // ya tiene ID, saltar

    var empNom = (datos[r][colEmp] || "").toString().trim();
    var noEmpVal = (datos[r][colNo] || "").toString().trim();
    if (!empNom || !noEmpVal) continue; // sin empresa o sin número, saltar

    try {
      var nuevoID;
      if (mapaEmpresas[empNom]) {
        // Empresa ya conocida — usar sus siglas e incrementar
        mapaEmpresas[empNom].ultimo++;
        nuevoID = mapaEmpresas[empNom].siglas + mapaEmpresas[empNom].ultimo;
      } else {
        // Empresa nueva — generar siglas
        var siglas = generarSiglas(empNom);
        // Verificar colisión de siglas
        var siglasUsadas = {};
        Object.keys(mapaEmpresas).forEach(function(e) {
          siglasUsadas[mapaEmpresas[e].siglas] = e;
        });
        var intento = siglas;
        var cnt = 2;
        while (siglasUsadas[intento] && siglasUsadas[intento] !== empNom) {
          intento = siglas + cnt; cnt++;
        }
        siglas = intento;
        mapaEmpresas[empNom] = { siglas: siglas, ultimo: 1 };
        nuevoID = siglas + "1";
      }

      // Escribir el ID en la columna AY
      sheet.getRange(r + 1, colID + 1).setValue(nuevoID);
      Logger.log('[AsignarIDs] Fila ' + (r+1) + ' | Emp: ' + empNom + ' | No: ' + noEmpVal + ' → ID: ' + nuevoID);
      asignados++;

    } catch(e) {
      Logger.log('[AsignarIDs] Error en fila ' + (r+1) + ': ' + e);
      errores++;
    }
  }

  Logger.log('[AsignarIDs] COMPLETADO: ' + asignados + ' IDs asignados, ' + errores + ' errores.');
  Logger.log('[AsignarIDs] Revisa el Sheet columna AY para verificar los IDs generados.');
}

// ─── CREAR CARPETA DE EXPEDIENTE EN DRIVE ────────────────────
// Crea la carpeta en Drive para un empleado existente que no tiene URL en AX.
// Se llama desde el botón "Crear expediente" en el drawer de edición.
function crearExpediente(payload) {
  var noEmp = (payload.numeroEmpleado   || "").toString().trim();
  var nom   = (payload.nombreTrabajador || "Sin Nombre").toString().trim();
  var emp   = (payload.empresa          || "Sin Empresa").toString().trim();

  if (!noEmp) return { status:"error", message:"No se proporcionó número de empleado." };

  try {
    var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet   = ss.getSheetByName(NOMBRE_HOJA);
    var datos   = sheet.getDataRange().getValues();
    var headers = datos[0].map(function(h){ return h ? h.toString().trim() : ""; });

    var colNo  = headers.indexOf("NO. EMPLEADO");
    var colEmp = headers.indexOf("EMPRESA");
    var colURL = -1;
    headers.forEach(function(h, i){ if(h.replace(/\s+/g,' ').trim().toUpperCase() === 'URL EXPEDIENTE') colURL = i; });
    if (colURL === -1) colURL = 49; // AX = índice 49 — posición conocida

    if (colURL === -1) return { status:"error", message:"No se encontró la columna URL EXPEDIENTE." };

    // Buscar la fila del empleado
    var filaEncontrada = -1;
    for (var i = 1; i < datos.length; i++) {
      var noFila  = (datos[i][colNo]  || "").toString().trim();
      var empFila = (datos[i][colEmp] || "").toString().trim();
      if (noFila === noEmp && empFila === emp) {
        filaEncontrada = i + 1; // 1-based
        break;
      }
    }

    if (filaEncontrada === -1) {
      return { status:"error", message:"No se encontró el empleado #" + noEmp + " en " + emp + "." };
    }

    // Verificar si ya tiene URL
    var urlActual = (datos[filaEncontrada - 1][colURL] || "").toString().trim();
    if (urlActual && urlActual.indexOf("http") === 0) {
      return { status:"success", url: urlActual, message:"El empleado ya tiene expediente en Drive." };
    }

    // Crear carpeta en Drive
    var parent  = DriveApp.getFolderById(ID_CARPETA_EXPEDIENTES);
    var empIter = parent.searchFolders("title = " + '"' + emp + '"');
    var empDir  = empIter.hasNext() ? empIter.next() : parent.createFolder(emp);
    var subDir  = empDir.createFolder(noEmp + " - " + nom);
        var url     = subDir.getUrl();

    // Guardar URL en columna AX del Sheet
    sheet.getRange(filaEncontrada, colURL + 1).setValue(url);
    Logger.log('[CrearExpediente] Carpeta creada: ' + url + ' para ' + noEmp + ' - ' + nom);

    return { status:"success", url: url, message:"Expediente creado correctamente." };

  } catch(e) {
    Logger.log('[CrearExpediente] Error: ' + e);
    return { status:"error", message:"Error al crear expediente: " + e.toString() };
  }
}


// ─── SETUP ENCUESTAS (ejecutar si las hojas ya existen pero están vacías) ──
// Ejecutar desde el editor de GAS si la hoja ENCUESTAS ya existe
// pero la encuesta de salida tiene bloques vacíos.
function setupEncuestas() {
  try {
    var hoja  = getHojaEncuestas(); // crea la hoja si no existe
    var datos = hoja.getDataRange().getValues();

    // Mapa de encuestas con sus estructuras
    var encuestasConfig = {
      "SALIDA":  getEstructuraSalida,
      "CLIMA":   getEstructuraClima
    };

    // Actualizar cada encuesta si tiene estructura vacía
    for (var i = 1; i < datos.length; i++) {
      var encIdFila = (datos[i][0]||"").toString().trim().toUpperCase();
      if (encuestasConfig[encIdFila]) {
        var estructuraActual = datos[i][4] ? datos[i][4].toString() : "{}";
        var parsed = {};
        try { parsed = JSON.parse(estructuraActual); } catch(e){}

        if (!parsed.bloques || parsed.bloques.length === 0) {
          var nuevaEstructura = encuestasConfig[encIdFila]();
          hoja.getRange(i+1, 5).setValue(nuevaEstructura);
          Logger.log("[setupEncuestas] " + encIdFila + " actualizada con " +
            JSON.parse(nuevaEstructura).bloques.length + " bloques.");
        } else {
          Logger.log("[setupEncuestas] " + encIdFila + " ya tiene " +
            parsed.bloques.length + " bloques. No se modificó.");
        }
      }
    }

    // Crear hoja RESPUESTAS si no existe
    getHojaRespuestas();
    Logger.log("[setupEncuestas] Setup completado correctamente.");
    return { status:"success", message:"Setup de encuestas completado." };
  } catch(e) {
    Logger.log("[setupEncuestas] Error: " + e);
    return { status:"error", message: e.toString() };
  }
}

// ─── ESTRUCTURA ENCUESTA DE CLIMA ORGANIZACIONAL ─────────────
// 47 preguntas, 8 dimensiones, todas de escala 1-5
// Escala: 1=Total desacuerdo, 2=En desacuerdo, 3=Neutral,
//         4=De acuerdo, 5=Muy de acuerdo
function getEstructuraClima() {
  var estructura = {
    titulo: "Encuesta de Clima Organizacional",
    descripcion: "Esta encuesta es confidencial. Responde con honestidad — tus respuestas ayudan a construir un mejor lugar de trabajo.",
    escala: [
      {valor:1, etiqueta:"Total desacuerdo"},
      {valor:2, etiqueta:"En desacuerdo"},
      {valor:3, etiqueta:"Neutral"},
      {valor:4, etiqueta:"De acuerdo"},
      {valor:5, etiqueta:"Muy de acuerdo"}
    ],
    bloques: [
      {
        icono: "👔", titulo: "Estilo de Liderazgo",
        preguntas: [
          {tipo:"escala", texto:"Mi jefe me mantiene informado sobre los cambios y decisiones importantes que me afectan."},
          {tipo:"escala", texto:"Mi jefe me comunica con claridad lo que espera de mí y cómo se evaluará mi desempeño."},
          {tipo:"escala", texto:"Puedo hablar abiertamente con mi jefe sobre problemas, dudas o inquietudes sin temor a represalias."},
          {tipo:"escala", texto:"Mi jefe hace un buen trabajo organizando y supervisando las actividades del equipo."},
          {tipo:"escala", texto:"Mi jefe resuelve los problemas operativos y conflictos de manera oportuna y justa."},
          {tipo:"escala", texto:"Mi jefe reconoce y valora el esfuerzo y los resultados del equipo."},
          {tipo:"escala", texto:"Mi jefe me da retroalimentación útil sobre cómo puedo mejorar mi desempeño."},
          {tipo:"escala", texto:"Mi jefe se interesa genuinamente en mi bienestar, no sólo en los resultados del trabajo."},
          {tipo:"escala", texto:"Mi jefe promueve activamente un ambiente de trabajo positivo y colaborativo."}
        ]
      },
      {
        icono: "😊", titulo: "Nivel de Satisfacción",
        preguntas: [
          {tipo:"escala", texto:"Mi trabajo me permite desarrollar y aplicar mis habilidades y capacidades."},
          {tipo:"escala", texto:"Me siento motivado/a para dar lo mejor de mí en este trabajo."},
          {tipo:"escala", texto:"Cuento con los recursos, herramientas y equipo necesarios para realizar mi trabajo correctamente."},
          {tipo:"escala", texto:"Recibo la capacitación necesaria para desempeñar mis funciones de forma segura y eficiente."},
          {tipo:"escala", texto:"El salario y las prestaciones que recibo son justos considerando mi trabajo y responsabilidades."},
          {tipo:"escala", texto:"Las prestaciones que ofrece la empresa (seguros, permisos, beneficios) cubren mis necesidades básicas."},
          {tipo:"escala", texto:"Veo posibilidades reales de crecimiento y desarrollo profesional dentro de la empresa."},
          {tipo:"escala", texto:"Conozco las opciones de desarrollo y crecimiento que existen en las diferentes empresas del corporativo."}
        ]
      },
      {
        icono: "🦺", titulo: "SHE (Seguridad, Higiene y Medio Ambiente)",
        preguntas: [
          {tipo:"escala", texto:"En mi área de trabajo se aplican y respetan las normas de seguridad industrial."},
          {tipo:"escala", texto:"Mi jefe cumple y supervisa el cumplimiento de las medidas de seguridad e higiene en la unidad."},
          {tipo:"escala", texto:"Me proporcionan el equipo de protección personal (EPP) adecuado para mis actividades."},
          {tipo:"escala", texto:"Las instalaciones donde trabajo son seguras, ordenadas y están en buen estado."},
          {tipo:"escala", texto:"Se realizan inspecciones y acciones preventivas para reducir riesgos en mi área de trabajo."},
          {tipo:"escala", texto:"La empresa promueve prácticas responsables con el medio ambiente en sus operaciones."}
        ]
      },
      {
        icono: "🤝", titulo: "Dignidad y Respeto",
        preguntas: [
          {tipo:"escala", texto:"Me tratan con respeto y dignidad independientemente de mi puesto, género, edad o procedencia."},
          {tipo:"escala", texto:"Mi jefe evita tener favoritismos y trata a todos los miembros del equipo con equidad."},
          {tipo:"escala", texto:"Las cargas de trabajo en mi área están distribuidas de forma equitativa entre el equipo."},
          {tipo:"escala", texto:"Se respetan mis horarios y tiempos de descanso establecidos en mi contrato."},
          {tipo:"escala", texto:"En esta empresa se respetan las diferencias y se promueve un ambiente incluyente."}
        ]
      },
      {
        icono: "❤️", titulo: "Sentido de Pertenencia",
        preguntas: [
          {tipo:"escala", texto:"Siento orgullo de decir a otros que trabajo en esta empresa."},
          {tipo:"escala", texto:"Me identifico con los valores y la misión de la organización."},
          {tipo:"escala", texto:"Me veo trabajando aquí en los próximos dos años."},
          {tipo:"escala", texto:"Si pudiera cambiar de trabajo hoy con las mismas condiciones, preferiría quedarme aquí."},
          {tipo:"escala", texto:"Las razones por las que compañeros se han ido de la empresa son comprensibles y han sido atendidas."}
        ]
      },
      {
        icono: "👥", titulo: "Trabajo en Equipo",
        preguntas: [
          {tipo:"escala", texto:"En mi equipo existe un ambiente de confianza, respeto y cooperación."},
          {tipo:"escala", texto:"Las personas de mi área se apoyan mutuamente para lograr los objetivos."},
          {tipo:"escala", texto:"Cuando alguien nuevo ingresa al equipo, se le hace sentir bienvenido y recibe el apoyo necesario."},
          {tipo:"escala", texto:"Existe un sentido de equipo y compañerismo en mi área de trabajo."}
        ]
      },
      {
        icono: "🏢", titulo: "Cultura Organizacional",
        preguntas: [
          {tipo:"escala", texto:"Conozco y entiendo la misión, visión y valores de la empresa donde trabajo."},
          {tipo:"escala", texto:"Los valores de la empresa se reflejan en las decisiones y comportamientos del día a día."},
          {tipo:"escala", texto:"Los comunicados y canales de información interna me mantienen bien informado sobre la empresa."},
          {tipo:"escala", texto:"Conozco y entiendo cómo mi trabajo contribuye a los objetivos generales del corporativo."},
          {tipo:"escala", texto:"Conozco los canales para reportar irregularidades o situaciones que no estén alineadas a los valores."},
          {tipo:"escala", texto:"Me siento seguro/a para reportar una situación irregular sin temor a represalias."}
        ]
      },
      {
        icono: "🌿", titulo: "Bienestar y Equilibrio",
        preguntas: [
          {tipo:"escala", texto:"Siento que mi trabajo me permite tener un equilibrio razonable entre vida laboral y personal."},
          {tipo:"escala", texto:"En mi área de trabajo el nivel de estrés es manejable y no afecta negativamente mi salud."},
          {tipo:"escala", texto:"La empresa se preocupa genuinamente por el bienestar físico y emocional de sus colaboradores."},
          {tipo:"escala", texto:"Tengo el tiempo necesario para tomar mis tiempos de descanso y alimentos durante la jornada."}
        ]
      }
    ]
  };
  return JSON.stringify(estructura);
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO DE EMAILS — RRHH Prisma
// ══════════════════════════════════════════════════════════════
var PWA_URL = "https://rrhh-prisma.pages.dev"; // URL de la PWA
var EMAIL_FROM_NAME = "RRHH Prisma";

// ── Email de bienvenida ────────────────────────────────────────
function enviarEmailBienvenida(nombre, email, password, rol) {
  var asunto = "Bienvenido(a) a RRHH Prisma — Tus accesos";
  var rolLabel = rol || "Auxiliar";
  var cuerpo = getPlantillaBienvenida(nombre, email, password, rolLabel);
  try {
    MailApp.sendEmail({
      to:       email,
      subject:  asunto,
      htmlBody: cuerpo,
      name:     EMAIL_FROM_NAME
    });
    Logger.log("[Email] Bienvenida enviada a: " + email);
    return true;
  } catch(e) {
    Logger.log("[Email] Error enviando bienvenida a " + email + ": " + e);
    return false;
  }
}

// ── Email de reseteo de contraseña ────────────────────────────
function enviarEmailResetPassword(nombre, email, nuevaPassword) {
  var asunto = "RRHH Prisma — Restablecimiento de contraseña";
  var cuerpo = getPlantillaResetPassword(nombre, email, nuevaPassword);
  try {
    MailApp.sendEmail({
      to:       email,
      subject:  asunto,
      htmlBody: cuerpo,
      name:     EMAIL_FROM_NAME
    });
    Logger.log("[Email] Reset enviado a: " + email);
    return true;
  } catch(e) {
    Logger.log("[Email] Error reset a " + email + ": " + e);
    return false;
  }
}

// ── Plantilla: Bienvenida ──────────────────────────────────────
function getPlantillaBienvenida(nombre, email, password, rol) {
  var modulos = rol === "Administrador"
    ? [
        ["📊","Indicadores","KPIs, gráficas y métricas de la plantilla laboral"],
        ["➕","Alta de Personal","Registrar nuevos colaboradores con OCR inteligente"],
        ["🚪","Baja de Personal","Procesar salidas y generar encuesta de salida"],
        ["📁","Expedientes","Consultar y editar perfiles de empleados"],
        ["📋","Encuestas","Gestionar encuestas y analizar resultados"],
        ["👥","Usuarios","Administrar accesos y permisos del sistema"]
      ]
    : [
        ["📊","Indicadores","KPIs de tus empresas asignadas"],
        ["➕","Alta de Personal","Registrar nuevos colaboradores"],
        ["🚪","Baja de Personal","Procesar salidas de personal"],
        ["📁","Expedientes","Consultar y editar perfiles"],
        ["📋","Encuestas","Ver resultados y respuestas"],
        ["👤","Mi Perfil","Actualizar tus datos personales"]
      ];

  var modulosHTML = modulos.map(function(m){
    return '<tr>'
      + '<td style="padding:10px 12px;vertical-align:top;width:36px;">'
      + '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed20,#a855f720);'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.1rem;">'+m[0]+'</div></td>'
      + '<td style="padding:10px 12px;vertical-align:top;">'
      + '<p style="margin:0;font-size:.9rem;font-weight:700;color:#0d1b3e;">'+m[1]+'</p>'
      + '<p style="margin:2px 0 0;font-size:.8rem;color:#64748b;">'+m[2]+'</p>'
      + '</td></tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Bienvenido a RRHH Prisma</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#f0f0ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;}'
    + '.email-wrap{max-width:580px;margin:32px auto;padding:0 16px;}'
    + '.card{background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,.12);}'
    + '.header{background:linear-gradient(135deg,#0d1b3e 0%,#1e0a3e 100%);padding:40px 32px;text-align:center;}'
    + '.header-logo{width:72px;height:72px;border-radius:18px;margin:0 auto 16px;display:block;}'
    + '.header h1{margin:0 0 4px;font-size:1.5rem;font-weight:800;color:#ffffff;letter-spacing:.02em;}'
    + '.header h1 span{color:#a78bfa;}'
    + '.header p{margin:0;font-size:.85rem;color:rgba(255,255,255,.55);}'
    + '.body{padding:32px;}'
    + '.greeting{font-size:1.05rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}'
    + '.txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 24px;}'
    + '.creds-box{background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1.5px solid #ddd6fe;border-radius:14px;padding:20px;margin:0 0 24px;}'
    + '.creds-title{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;margin:0 0 14px;}'
    + '.cred-row{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #ede9fe;}'
    + '.cred-row:last-child{border-bottom:none;padding-bottom:0;}'
    + '.cred-label{font-size:.78rem;color:#6b7280;width:110px;flex-shrink:0;}'
    + '.cred-value{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}'
    + '.modules-title{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:0 0 12px;}'
    + '.modules-table{width:100%;border-collapse:collapse;}'
    + '.btn-wrap{text-align:center;padding:8px 0 4px;}'
    + '.btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#ffffff !important;text-decoration:none;font-weight:700;font-size:.95rem;padding:14px 40px;border-radius:12px;letter-spacing:.01em;}'
    + '.warning{background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px 16px;margin:20px 0 0;font-size:.82rem;color:#92400e;line-height:1.5;}'
    + '.footer{background:#f8f7ff;padding:20px 32px;text-align:center;border-top:1px solid #ede9fe;}'
    + '.footer p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}'
    + '@media only screen and (max-width:600px){'
    + '.email-wrap{margin:0;padding:0;}'
    + '.card{border-radius:0;}'
    + '.header{padding:28px 20px;}'
    + '.body{padding:24px 20px;}'
    + '.footer{padding:16px 20px;}'
    + '.cred-row{flex-direction:column;align-items:flex-start;gap:2px;}'
    + '.cred-label{width:auto;}'
    + '}'
    + '</style></head><body>'
    + '<div class="email-wrap"><div class="card">'
    // Header con logo PNG real del sistema
    + '<div class="header">'
    + '<img src="https://rrhh-prisma.pages.dev/icon.png" class="header-logo" alt="RRHH Prisma">'
    + '<h1>RRHH <span>Prisma</span></h1>'
    + '<p>Sistema de Gestión de Recursos Humanos</p>'
    + '</div>'
    // Cuerpo
    + '<div class="body">'
    + '<p class="greeting">Bienvenido(a), ' + nombre + ' 👋</p>'
    + '<p class="txt">Se ha creado tu acceso al sistema <strong>RRHH Prisma</strong>. '
    + 'A continuación encontrarás tus credenciales para ingresar al sistema.</p>'
    + '<div class="creds-box">'
    + '<p class="creds-title">🔐 Tus credenciales</p>'
    + '<div class="cred-row"><span class="cred-label">Correo</span><span class="cred-value">' + email + '</span></div>'
    + '<div class="cred-row"><span class="cred-label">Contraseña</span><span class="cred-value">' + password + '</span></div>'
    + '<div class="cred-row"><span class="cred-label">Rol</span><span class="cred-value">' + rol + '</span></div>'
    + '</div>'
    + '<p class="modules-title">📱 Módulos disponibles para ti</p>'
    + '<table class="modules-table">' + modulosHTML + '</table>'
    + '<div class="btn-wrap" style="margin-top:24px;">'
    + '<a href="https://rrhh-prisma.pages.dev" class="btn">Ingresar a RRHH Prisma →</a>'
    + '</div>'
    + '<div class="warning">⚠️ <strong>Por seguridad:</strong> Te recomendamos cambiar tu contraseña '
    + 'después de tu primer inicio de sesión desde el módulo <em>Mi Perfil</em>.</div>'
    + '</div>'
    // Footer
    + '<div class="footer">'
    + '<p>Este correo fue generado automáticamente por RRHH Prisma<br>'
    + 'Si no esperabas este mensaje, ignóralo o contacta a tu administrador.</p>'
    + '</div>'
    + '</div></div></body></html>';
}


// ── Plantilla: Reset de contraseña ────────────────────────────
function getPlantillaResetPassword(nombre, email, nuevaPassword) {
  var pasos = [
    ['1','Abre RRHH Prisma','Haz clic en el botón de abajo para acceder al sistema.'],
    ['2','Inicia sesion','Usa tu correo y la contrasena temporal indicada arriba.'],
    ['3','Ve a Mi Perfil','Selecciona "Mi Perfil" en el menu lateral izquierdo.'],
    ['4','Cambia tu contrasena','En la seccion "Cambiar contrasena", ingresa la temporal como actual y escribe tu nueva (minimo 8 caracteres).'],
  ];

  var pasosHTML = pasos.map(function(p){
    return '<tr>'
      + '<td style="padding:10px 12px;vertical-align:top;width:36px;">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#d97706,#f59e0b);text-align:center;line-height:28px;font-size:.75rem;font-weight:800;color:#fff;">' + p[0] + '</div></td>'
      + '<td style="padding:10px 12px;vertical-align:top;">'
      + '<p style="margin:0;font-size:.88rem;font-weight:700;color:#0d1b3e;">' + p[1] + '</p>'
      + '<p style="margin:2px 0 0;font-size:.8rem;color:#64748b;line-height:1.5;">' + p[2] + '</p>'
      + '</td></tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Restablecimiento de contrasena - RRHH Prisma</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#fff8ef;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}'
    + '.wrap{max-width:580px;margin:32px auto;padding:0 16px;}'
    + '.card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(217,119,6,.15);}'
    + '.hdr{background:linear-gradient(135deg,#78350f,#92400e);padding:36px 32px;text-align:center;}'
    + '.hdr img{width:64px;height:64px;border-radius:16px;margin:0 auto 14px;display:block;}'
    + '.hdr h1{margin:0 0 4px;font-size:1.25rem;font-weight:800;color:#fff;}'
    + '.hdr p{margin:0;font-size:.8rem;color:rgba(255,255,255,.55);}'
    + '.body{padding:32px;}'
    + '.greeting{font-size:1rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}'
    + '.txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 22px;}'
    + '.creds{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:14px;padding:20px;margin:0 0 24px;}'
    + '.creds-lbl{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#b45309;margin:0 0 12px;}'
    + '.row{display:flex;padding:8px 0;border-bottom:1px solid #fde68a;}'
    + '.row:last-child{border-bottom:none;}'
    + '.rl{font-size:.78rem;color:#6b7280;width:130px;flex-shrink:0;padding-top:1px;}'
    + '.rv{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}'
    + '.st{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:0 0 10px;}'
    + '.btn-wrap{text-align:center;margin:24px 0 0;}'
    + '.btn{display:inline-block;background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff !important;text-decoration:none;font-weight:700;font-size:.9rem;padding:13px 36px;border-radius:12px;}'
    + '.alert{background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 16px;margin:20px 0 0;font-size:.82rem;color:#b91c1c;line-height:1.5;}'
    + '.ftr{background:#fff8ef;padding:18px 32px;text-align:center;border-top:1px solid #fde68a;}'
    + '.ftr p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}'
    + '@media(max-width:600px){.wrap{margin:0;padding:0;}.card{border-radius:0;}.hdr,.body,.ftr{padding:24px 20px;}.row{flex-direction:column;gap:2px;}.rl{width:auto;}}'
    + '</style></head><body>'
    + '<div class="wrap"><div class="card">'
    + '<div class="hdr">'
    + '<img src="https://rrhh-prisma.pages.dev/icon.png" alt="RRHH Prisma">'
    + '<h1>Restablecimiento de contrasena</h1>'
    + '<p>RRHH Prisma - Sistema de Gestion de RRHH</p>'
    + '</div>'
    + '<div class="body">'
    + '<p class="greeting">Hola, ' + nombre + '</p>'
    + '<p class="txt">El administrador ha restablecido tu contrasena de acceso a <strong>RRHH Prisma</strong>. Encuentra tu contrasena temporal a continuacion.</p>'
    + '<div class="creds"><p class="creds-lbl">Contrasena temporal</p>'
    + '<div class="row"><span class="rl">Correo</span><span class="rv">' + email + '</span></div>'
    + '<div class="row"><span class="rl">Nueva contrasena</span><span class="rv">' + nuevaPassword + '</span></div>'
    + '</div>'
    + '<p class="st">Como cambiar tu contrasena</p>'
    + '<table style="width:100%;border-collapse:collapse;">' + pasosHTML + '</table>'
    + '<div class="btn-wrap"><a href="https://rrhh-prisma.pages.dev" class="btn">Acceder a RRHH Prisma</a></div>'
    + '<div class="alert">Importante: Esta contrasena es temporal. Cambiala de inmediato. Si no solicitaste este cambio, contacta a tu administrador.</div>'
    + '</div>'
    + '<div class="ftr"><p>Correo generado automaticamente por RRHH Prisma<br>Si no esperabas este mensaje, contacta a tu administrador.</p></div>'
    + '</div></div></body></html>';
}

// ─── SOLICITAR RESET DE CONTRASEÑA (desde login) ─────────────
// No requiere token — el usuario no está logueado
// Genera contraseña temporal y envía email si el correo existe
function solicitarResetPassword(payload) {
  var email = (payload.email || "").toString().trim().toLowerCase();
  if (!email) return { status:"error", message:"Proporciona tu correo electrónico." };

  try {
    var result = buscarUsuario(email);
    if (!result) {
      // Por seguridad no revelar si el email existe o no
      return { status:"success", message:"Si tu correo está registrado, recibirás un email con instrucciones." };
    }

    var u = result.datos;
    if ((u[6]||"").trim() !== "Activo") {
      return { status:"success", message:"Si tu correo está registrado, recibirás un email con instrucciones." };
    }

    // Generar contraseña temporal segura
    var chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    var passTemp = "";
    for (var i = 0; i < 10; i++) {
      passTemp += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Guardar hash en el Sheet e invalidar token actual
    var hoja = getHojaUsuarios();
    hoja.getRange(result.fila, 4).setValue(hashPassword(passTemp));
    hoja.getRange(result.fila, 10).setValue(""); // invalidar token
    hoja.getRange(result.fila, 11).setValue("");

    // Enviar email
    var nombre = (u[1] || "Usuario").toString().trim();
    enviarEmailResetPassword(nombre, email, passTemp);

    registrarEvento(email, u[4], "RESET_SELF",
      "Solicitud de reset por correo", "", "");

    Logger.log("[solicitarReset] Password temporal enviado a: " + email);
    return { status:"success", message:"Si tu correo está registrado, recibirás un email con instrucciones." };

  } catch(e) {
    Logger.log("[solicitarReset] Error: " + e);
    return { status:"error", message:"Error procesando la solicitud. Intenta de nuevo." };
  }
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO DE AUTENTICACIÓN — RRHH Prisma
// ══════════════════════════════════════════════════════════════

// ── Hash SHA-256 usando GAS Utilities ─────────────────────────
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// ── Generar token aleatorio ────────────────────────────────────
function generarToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ── Obtener/crear hoja de Usuarios ────────────────────────────
function getHojaUsuarios() {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja  = ss.getSheetByName(HOJA_USUARIOS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_USUARIOS);
    hoja.getRange(1, 1, 1, 13).setValues([[
      "ID USUARIO","NOMBRE COMPLETO","EMAIL","HASH PASSWORD",
      "ROL","EMPRESAS ASIGNADAS","ESTATUS","TELÉFONO",
      "URL FOTO","TOKEN SESIÓN","EXPIRA TOKEN","FECHA CREACIÓN","ID INTERNO"
    ]]);
    hoja.getRange(1, 1, 1, 13).setFontWeight("bold");
    Logger.log("[Auth] Hoja USUARIOS creada.");
  }
  return hoja;
}

// ── Obtener/crear hoja de Eventos ─────────────────────────────
function getHojaEventos() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_EVENTOS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_EVENTOS);
    hoja.getRange(1, 1, 1, 7).setValues([[
      "FECHA Y HORA","USUARIO","ROL","ACCIÓN","DETALLE","EMPRESA","DISPOSITIVO"
    ]]);
    hoja.getRange(1, 1, 1, 7).setFontWeight("bold");
    Logger.log("[Auth] Hoja EVENTOS creada.");
  }
  return hoja;
}

// ── Registrar evento de auditoría ─────────────────────────────
function registrarEvento(email, rol, accion, detalle, empresa, dispositivo) {
  try {
    var hoja   = getHojaEventos();
    var ultima = hoja.getLastRow();

    // Auto-archivar si supera MAX_EVENTOS
    if (ultima > MAX_EVENTOS) {
      archivarEventos(hoja);
    }

    hoja.appendRow([
      new Date(),
      email      || "",
      rol        || "",
      accion     || "",
      detalle    || "",
      empresa    || "",
      dispositivo || ""
    ]);
  } catch(e) {
    Logger.log("[Evento] Error registrando: " + e);
  }
}

// ── Archivar eventos antiguos ─────────────────────────────────
function archivarEventos(hoja) {
  try {
    var ss       = SpreadsheetApp.openById(ID_SHEET_BD);
    var año      = new Date().getFullYear();
    var mes      = ("0" + (new Date().getMonth() + 1)).slice(-2);
    var nomArch  = "EVENTOS_" + año + "_" + mes;
    var hojaArch = ss.getSheetByName(nomArch) || ss.insertSheet(nomArch);

    // Copiar header si la hoja de archivo está vacía
    if (hojaArch.getLastRow() === 0) {
      hoja.getRange(1, 1, 1, 7).copyTo(hojaArch.getRange(1, 1));
    }

    // Mover primeras 1000 filas (excepto header) al archivo
    var datos = hoja.getRange(2, 1, 1000, 7).getValues();
    hojaArch.getRange(hojaArch.getLastRow() + 1, 1, datos.length, 7).setValues(datos);
    hoja.deleteRows(2, 1000);
    Logger.log("[Eventos] Archivados 1000 eventos a " + nomArch);
  } catch(e) {
    Logger.log("[Eventos] Error archivando: " + e);
  }
}

// ── Buscar usuario por email ───────────────────────────────────
function buscarUsuario(email) {
  var hoja  = getHojaUsuarios();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][2] || "").toString().trim().toLowerCase() === email.toLowerCase()) {
      return { fila: i + 1, datos: datos[i] };
    }
  }
  return null;
}

// ── Buscar usuario por token ───────────────────────────────────
function buscarUsuarioPorToken(token) {
  if (!token) return null;
  var hoja  = getHojaUsuarios();
  var datos = hoja.getDataRange().getValues();
  var ahora = new Date().getTime();
  for (var i = 1; i < datos.length; i++) {
    var tokenFila   = (datos[i][9]  || "").toString().trim();
    var expiraFila  = datos[i][10];
    var estatusFila = (datos[i][6]  || "").toString().trim();
    if (tokenFila === token && estatusFila === "Activo") {
      var expMs = expiraFila instanceof Date ? expiraFila.getTime() : new Date(expiraFila).getTime();
      if (expMs > ahora) {
        return { fila: i + 1, datos: datos[i] };
      }
    }
  }
  return null;
}

// ── Validar token (lo llama el frontend en cada carga) ────────
function validarToken(payload) {
  var token  = (payload && payload.token) ? payload.token.trim() : "";
  var result = buscarUsuarioPorToken(token);
  if (!result) return { status: "error", message: "Sesión inválida o expirada." };

  var u = result.datos;
  return {
    status:    "success",
    usuario: {
      id:        u[0],
      nombre:    u[1],
      email:     u[2],
      rol:       u[4],
      empresas:  u[5] ? u[5].toString().split(",").map(function(e){ return e.trim(); }) : [],
      estatus:   u[6],
      telefono:  u[7],
      urlFoto:    u[8],
      idInterno:  u[12] ? u[12].toString().trim() : ""
    }
  };
}

// ── Login ──────────────────────────────────────────────────────
function loginUsuario(payload) {
  var email    = (payload.email    || "").trim().toLowerCase();
  var password = (payload.password || "").trim();
  var device   = (payload.device   || "").trim();

  if (!email || !password) return { status: "error", message: "Email y contraseña requeridos." };

  var result = buscarUsuario(email);
  if (!result) {
    registrarEvento(email, "", "LOGIN_FALLIDO", "Email no encontrado", "", device);
    return { status: "error", message: "Credenciales incorrectas." };
  }

  var u    = result.datos;
  var fila = result.fila;

  if ((u[6] || "").trim() !== "Activo") {
    registrarEvento(email, u[4], "LOGIN_BLOQUEADO", "Usuario inactivo", "", device);
    return { status: "error", message: "Usuario inactivo. Contacta al administrador." };
  }

  var hashInput = hashPassword(password);
  if (hashInput !== u[3].toString().trim()) {
    registrarEvento(email, u[4], "LOGIN_FALLIDO", "Contraseña incorrecta", "", device);
    return { status: "error", message: "Credenciales incorrectas." };
  }

  // Generar token de sesión
  var token  = generarToken();
  var expira = new Date(new Date().getTime() + SESSION_HORAS * 3600 * 1000);

  var hoja = getHojaUsuarios();
  hoja.getRange(fila, 10).setValue(token);   // TOKEN SESIÓN
  hoja.getRange(fila, 11).setValue(expira);  // EXPIRA TOKEN
  hoja.getRange(fila, 12).setValue(u[11] || new Date()); // mantener fecha creación

  // Registrar evento de login
  var empresas = u[5] ? u[5].toString() : "Todas";
  registrarEvento(email, u[4], "LOGIN", "Inicio de sesión exitoso", empresas, device);

  return {
    status:  "success",
    token:   token,
    expira:  expira.toISOString(),
    usuario: {
      id:       u[0],
      nombre:   u[1],
      email:    u[2],
      rol:      u[4],
      empresas: u[5] ? u[5].toString().split(",").map(function(e){ return e.trim(); }) : [],
      estatus:  u[6],
      telefono: u[7],
      urlFoto:    u[8],
      idInterno:  u[12] ? u[12].toString().trim() : ""
    }
  };
}

// ── Logout ────────────────────────────────────────────────────
function logoutUsuario(payload) {
  var token  = (payload && payload.token) ? payload.token.trim() : "";
  var result = buscarUsuarioPorToken(token);
  if (result) {
    var hoja = getHojaUsuarios();
    hoja.getRange(result.fila, 10).setValue(""); // limpiar token
    hoja.getRange(result.fila, 11).setValue(""); // limpiar expiración
    var u = result.datos;
    registrarEvento(u[2], u[4], "LOGOUT", "Cierre de sesión", "", "");
  }
  return { status: "success", message: "Sesión cerrada." };
}

// ── Crear usuario (solo Admin) ────────────────────────────────
function crearUsuario(payload) {
  var token = (payload.token || "").trim();
  var admin = buscarUsuarioPorToken(token);
  if (!admin || admin.datos[4] !== "Administrador") {
    return { status: "error", message: "Sin permisos para crear usuarios." };
  }

  var nombre   = (payload.nombre   || "").trim();
  var email    = (payload.email    || "").trim().toLowerCase();
  var password = (payload.password || "").trim();
  var rol      = (payload.rol      || "Auxiliar").trim();
  var empresas = (payload.empresas || "").trim();
  var telefono = (payload.telefono || "").trim();

  if (!nombre || !email || !password) {
    return { status: "error", message: "Nombre, email y contraseña son requeridos." };
  }

  // Verificar que el email no exista ya
  if (buscarUsuario(email)) {
    return { status: "error", message: "Ya existe un usuario con ese email." };
  }

  var hoja   = getHojaUsuarios();
  var ultima = hoja.getLastRow();
  var nuevoId = "USR" + ("000" + ultima).slice(-3);
  var hash    = hashPassword(password);

  var idInterno = (payload.idInterno||"").toString().trim();
  hoja.appendRow([
    nuevoId, nombre, email, hash, rol,
    empresas, "Activo", telefono, "", "", "", new Date(), idInterno
  ]);

  var adminU = admin.datos;
  registrarEvento(adminU[2], adminU[4], "CREAR_USUARIO",
    "Creó usuario " + email + " con rol " + rol, empresas, "");

  // Enviar email de bienvenida
  enviarEmailBienvenida(nombre, email, password, rol);

  return { status: "success", message: "Usuario " + email + " creado correctamente.", id: nuevoId };
}

// ── Listar usuarios (solo Admin) ──────────────────────────────
function listarUsuarios(payload) {
  var token = (payload && payload.token) ? payload.token.trim() : "";
  var admin = buscarUsuarioPorToken(token);
  if (!admin || admin.datos[4] !== "Administrador") {
    return { status: "error", message: "Sin permisos." };
  }

  var hoja  = getHojaUsuarios();
  var datos = hoja.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < datos.length; i++) {
    var u = datos[i];
    if (!u[0]) continue;
    lista.push({
      id:       u[0],
      nombre:   u[1],
      email:    u[2],
      rol:      u[4],
      empresas: u[5] ? u[5].toString().split(",").map(function(e){ return e.trim(); }) : [],
      estatus:  u[6],
      telefono: u[7],
      urlFoto:  u[8],
      idInterno: u[12] ? u[12].toString().trim() : "",
      ultimoAcceso: u[10] ? u[10].toString() : ""
    });
  }
  return { status: "success", usuarios: lista };
}

// ── Actualizar usuario ────────────────────────────────────────
function actualizarUsuario(payload) {
  var token  = (payload.token || "").trim();
  var caller = buscarUsuarioPorToken(token);
  if (!caller) return { status: "error", message: "Sesión inválida." };

  var callerData = caller.datos;
  var callerEmail = callerData[2].toLowerCase();
  var callerRol   = callerData[4];
  var targetEmail = (payload.email || "").trim().toLowerCase();

  // Auxiliar solo puede editar su propio perfil
  if (callerRol !== "Administrador" && callerEmail !== targetEmail) {
    return { status: "error", message: "Sin permisos para editar otros usuarios." };
  }

  var result = buscarUsuario(targetEmail);
  if (!result) return { status: "error", message: "Usuario no encontrado." };

  var hoja = getHojaUsuarios();
  var fila = result.fila;
  var cambios = [];

  // Campos que puede cambiar el Auxiliar: nombre, teléfono, foto
  if (payload.nombre   !== undefined) { hoja.getRange(fila, 2).setValue(payload.nombre);   cambios.push("nombre"); }
  if (payload.telefono !== undefined) { hoja.getRange(fila, 8).setValue(payload.telefono); cambios.push("telefono"); }
  if (payload.urlFoto     !== undefined) { hoja.getRange(fila, 9).setValue(payload.urlFoto);  cambios.push("foto"); }
  if (payload.idInterno  !== undefined) { hoja.getRange(fila,13).setValue(payload.idInterno||""); cambios.push("idInterno"); }

  // Solo Admin puede cambiar estos campos
  if (callerRol === "Administrador") {
    if (payload.rol      !== undefined) { hoja.getRange(fila, 5).setValue(payload.rol);      cambios.push("rol"); }
    if (payload.empresas !== undefined) { hoja.getRange(fila, 6).setValue(payload.empresas); cambios.push("empresas"); }
    if (payload.estatus  !== undefined) { hoja.getRange(fila, 7).setValue(payload.estatus);  cambios.push("estatus"); }
  }

  registrarEvento(callerEmail, callerRol, "EDITAR_USUARIO",
    "Editó " + targetEmail + ": " + cambios.join(", "), "", "");

  return { status: "success", message: "Usuario actualizado." };
}

// ── Cambiar contraseña (usuario propio) ───────────────────────
function cambiarPassword(payload) {
  var token      = (payload.token       || "").trim();
  var passActual = (payload.passActual  || "").trim();
  var passNuevo  = (payload.passNuevo   || "").trim();
  var caller     = buscarUsuarioPorToken(token);
  if (!caller) return { status: "error", message: "Sesión inválida." };

  var u    = caller.datos;
  var fila = caller.fila;

  if (hashPassword(passActual) !== u[3].toString().trim()) {
    return { status: "error", message: "Contraseña actual incorrecta." };
  }
  if (passNuevo.length < 8) {
    return { status: "error", message: "La nueva contraseña debe tener al menos 8 caracteres." };
  }

  var hoja = getHojaUsuarios();
  hoja.getRange(fila, 4).setValue(hashPassword(passNuevo));
  registrarEvento(u[2], u[4], "CAMBIAR_PASSWORD", "Cambió su contraseña", "", "");
  return { status: "success", message: "Contraseña actualizada correctamente." };
}

// ── Resetear contraseña (solo Admin) ──────────────────────────
function resetearPassword(payload) {
  var token = (payload.token || "").trim();
  var admin = buscarUsuarioPorToken(token);
  if (!admin || admin.datos[4] !== "Administrador") {
    return { status: "error", message: "Sin permisos para resetear contraseñas." };
  }

  var targetEmail  = (payload.email       || "").trim().toLowerCase();
  var passNueva    = (payload.passNueva   || "Prisma2025*").trim();
  var result       = buscarUsuario(targetEmail);
  if (!result) return { status: "error", message: "Usuario no encontrado." };

  var hoja = getHojaUsuarios();
  hoja.getRange(result.fila, 4).setValue(hashPassword(passNueva));
  hoja.getRange(result.fila, 10).setValue(""); // invalidar token actual
  hoja.getRange(result.fila, 11).setValue("");

  var adminU = admin.datos;
  registrarEvento(adminU[2], adminU[4], "RESET_PASSWORD",
    "Reseteó contraseña de " + targetEmail, "", "");

  // Enviar email con la nueva contraseña temporal
  var nomUsuario = result.datos[1] || targetEmail;
  enviarEmailResetPassword(nomUsuario, targetEmail, passNueva);

  return { status: "success", message: "Contraseña de " + targetEmail + " reseteada. Se envió email de notificación." };
}

// ── Setup inicial — crear Admin y hojas (ejecutar UNA VEZ) ────
function setupInicial() {
  var hoja  = getHojaUsuarios();
  getHojaEventos(); // crear hoja eventos si no existe

  // Verificar si ya existe el admin
  var existe = buscarUsuario("hector.errazu@gmnet.mx");
  if (existe) {
    Logger.log("[Setup] El administrador ya existe.");
    return { status: "info", message: "El administrador ya existe." };
  }

  var hash = hashPassword("Global.2025*");
  hoja.appendRow([
    "USR001",
    "Errazú Hernández Héctor Rafael",
    "hector.errazu@gmnet.mx",
    hash,
    "Administrador",
    "", // empresas: vacío = todas
    "Activo",
    "5638994766",
    "", // url foto
    "", // token
    "", // expira
    new Date()
  ]);

  Logger.log("[Setup] Administrador creado: hector.errazu@gmnet.mx");
  return { status: "success", message: "Setup completado. Admin: hector.errazu@gmnet.mx" };
}

// ── Middleware: validar token y filtrar empresas ───────────────
// Llamar al inicio de endpoints que requieren autenticación
function autenticarRequest(payload) {
  var token = (payload && payload.token) ? payload.token.trim() : "";
  var u     = buscarUsuarioPorToken(token);
  if (!u) return null;
  return {
    fila:     u.fila,
    datos:    u.datos,
    email:    u.datos[2],
    rol:      u.datos[4],
    empresas: u.datos[5] ? u.datos[5].toString().split(",").map(function(e){ return e.trim(); }) : [],
    esAdmin:  u.datos[4] === "Administrador"
  };
}

// ─── BUSCAR EMPLEADO POR NÚMERO + NOMBRE (para encuestas sin precarga) ───
// Recibe: { noEmpleado, nombre }
// Lógica: busca todos los registros con ese número, elige el que tenga
// el nombre más similar. Combinación prácticamente única en la BD.
function buscarEmpleadoEncuesta(payload) {
  var noEmp   = (payload.noEmpleado || "").toString().trim();
  var nombre  = (payload.nombre     || "").toString().trim().toLowerCase();
  if (!noEmp) return { status:"error", message:"Proporciona tu número de empleado." };
  if (!nombre) return { status:"error", message:"Proporciona tu nombre completo." };

  try {
    var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet = ss.getSheetByName(NOMBRE_HOJA);
    var datos = sheet.getDataRange().getValues();

    var colNo  = 0;   // A = NO. EMPLEADO
    var colEmp = 5;   // F = EMPRESA
    var colNom = 4;   // E = NOMBRE DEL TRABAJADOR
    var colID  = 50;  // AY = ID INTERNO
    var colEst = 2;   // C = ESTATUS

    // Recopilar todos los candidatos con ese número de empleado
    var candidatos = [];
    for (var i = 1; i < datos.length; i++) {
      var noFila = (datos[i][colNo] || "").toString().trim();
      if (noFila !== noEmp) continue;
      candidatos.push({
        idInterno:  (datos[i][colID] || "").toString().trim(),
        nombre:     (datos[i][colNom] || "").toString().trim(),
        empresa:    (datos[i][colEmp] || "").toString().trim(),
        noEmpleado: noFila,
        estatus:    (datos[i][colEst] || "").toString().trim()
      });
    }

    if (candidatos.length === 0) {
      return { status:"error", message:"No se encontró ningún empleado con el número " + noEmp + "." };
    }

    // Si solo hay uno, devolverlo directamente
    if (candidatos.length === 1) {
      return { status:"success", empleado: candidatos[0] };
    }

    // Si hay varios, buscar el que tenga nombre más similar
    // Normalizar: quitar acentos, mayúsculas, espacios extra
    function normalizar(s) {
      return s.toLowerCase()
        .replace(/[áäà]/g,"a").replace(/[éëè]/g,"e")
        .replace(/[íïì]/g,"i").replace(/[óöò]/g,"o")
        .replace(/[úüù]/g,"u").replace(/ñ/g,"n")
        .replace(/\s+/g," ").trim();
    }

    var nombreNorm = normalizar(nombre);

    // Calcular similitud: cuántas palabras del nombre buscado aparecen en el candidato
    function similitud(candidatoNombre) {
      var cn = normalizar(candidatoNombre);
      var palabrasBuscadas = nombreNorm.split(" ").filter(function(p){ return p.length > 2; });
      if (palabrasBuscadas.length === 0) return cn === nombreNorm ? 1 : 0;
      var matches = palabrasBuscadas.filter(function(p){ return cn.indexOf(p) !== -1; });
      return matches.length / palabrasBuscadas.length;
    }

    // Ordenar: primero activos, luego por similitud de nombre
    candidatos.sort(function(a, b) {
      var simA = similitud(a.nombre);
      var simB = similitud(b.nombre);
      // Priorizar activos
      var activoA = a.estatus === "Activo" ? 1 : 0;
      var activoB = b.estatus === "Activo" ? 1 : 0;
      if (activoA !== activoB) return activoB - activoA;
      return simB - simA;
    });

    var mejor = candidatos[0];
    var sim = similitud(mejor.nombre);

    // Si la similitud es muy baja (<30%), advertir pero igual devolver el mejor
    Logger.log("[buscarEmpleadoEncuesta] No=" + noEmp + " | Candidatos=" + candidatos.length
      + " | Mejor=" + mejor.nombre + " (sim=" + sim.toFixed(2) + ")");

    if (sim < 0.3) {
      return {
        status:  "warning",
        message: "No se encontró una coincidencia exacta. Verifica tu número de empleado.",
        empleado: mejor
      };
    }

    return { status:"success", empleado: mejor };

  } catch(e) {
    Logger.log("[buscarEmpleadoEncuesta] Error: " + e);
    return { status:"error", message: e.toString() };
  }
}

// ─── OBTENER EMPLEADO POR ID INTERNO (para encuesta precargada desde Bajas) ───
function obtenerEmpleadoPorId(payload) {
  var idInterno = (payload.idInterno || "").toString().trim();
  if (!idInterno) return { status:"error", message:"No se proporcionó idInterno." };

  try {
    var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet   = ss.getSheetByName(NOMBRE_HOJA);
    var datos   = sheet.getDataRange().getValues();

    var colNo   = 0;   // A = NO. EMPLEADO
    var colEmp  = 5;   // F = EMPRESA
    var colNom  = 4;   // E = NOMBRE
    var colID   = 50;  // AY = ID INTERNO

    for (var i = 1; i < datos.length; i++) {
      var idFila = (datos[i][colID] || "").toString().trim();
      if (idFila === idInterno) {
        return {
          status:    "success",
          empleado: {
            idInterno:  idFila,
            nombre:     (datos[i][colNom] || "").toString().trim(),
            empresa:    (datos[i][colEmp] || "").toString().trim(),
            noEmpleado: (datos[i][colNo]  || "").toString().trim()
          }
        };
      }
    }
    return { status:"error", message:"No se encontró el empleado con ID " + idInterno };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ─── SETUP COLUMNAS AZ Y BA ───────────────────────────────────
// Ejecutar una vez si las columnas no existen en el Sheet
function setupColumnasNuevas() {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var tieneAZ = headers.some(function(h){ return h && h.toString().trim() === "JEFE DIRECTO"; });
  var tieneBA = headers.some(function(h){ return h && h.toString().trim() === "CORREO ACCESO"; });

  if(!tieneAZ) {
    sheet.getRange(1, 52).setValue("JEFE DIRECTO");
    Logger.log("[Setup] Columna AZ (JEFE DIRECTO) creada.");
  } else {
    Logger.log("[Setup] JEFE DIRECTO ya existe.");
  }

  if(!tieneBA) {
    sheet.getRange(1, 53).setValue("CORREO ACCESO");
    Logger.log("[Setup] Columna BA (CORREO ACCESO) creada.");
  } else {
    Logger.log("[Setup] CORREO ACCESO ya existe.");
  }

  // Contratos 4to, 5to, 6to (para empleados Administrativos — 6 contratos)
  var extraCols = [
    {col:56, nombre:"FECHA DE INICIO DEL CUARTO CONTRATO"},
    {col:57, nombre:"FECHA DE VENCIMIENTO DEL CUARTO CONTRATO"},
    {col:58, nombre:"FECHA DE INICIO DEL QUINTO CONTRATO"},
    {col:59, nombre:"FECHA DE VENCIMIENTO DEL QUINTO CONTRATO"},
    {col:60, nombre:"FECHA DE INICIO DEL SEXTO CONTRATO"},
    {col:61, nombre:"FECHA DE VENCIMIENTO DEL SEXTO CONTRATO"}
  ];
  extraCols.forEach(function(cc) {
    var existe = headers.some(function(h){ return h && h.toString().trim() === cc.nombre; });
    if (!existe) {
      sheet.getRange(1, cc.col).setValue(cc.nombre);
      Logger.log("[Setup] Columna '" + cc.nombre + "' creada en col " + cc.col);
    } else {
      Logger.log("[Setup] '" + cc.nombre + "' ya existe.");
    }
  });

  Logger.log("[Setup] Columnas verificadas.");
  return { status:"success", message:"Columnas AZ, BA y contratos 4to-6to verificados." };
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO PERSONAS
// ══════════════════════════════════════════════════════════════

// ── Obtener directorio de empleados ──────────────────────────
function obtenerDirectorio(payload) {
  var token  = (payload && payload.token) ? payload.token : "";
  var caller = autenticarRequest(payload);
  // Permitir acceso aunque no haya token (datos ya filtrados en frontend)

  try {
    var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
    var sheet   = ss.getSheetByName(NOMBRE_HOJA);
    var datos   = sheet.getDataRange().getValues();
    var headers = datos[0].map(function(h){ return h ? h.toString().replace(/\n/g," ").trim() : ""; });

    var colNo   = headers.indexOf("NO. EMPLEADO")   !== -1 ? headers.indexOf("NO. EMPLEADO")   : 0;
    var colNom  = headers.indexOf("NOMBRE DEL TRABAJADOR") !== -1 ? headers.indexOf("NOMBRE DEL TRABAJADOR") : 4;
    var colEmp  = headers.indexOf("EMPRESA")        !== -1 ? headers.indexOf("EMPRESA")        : 5;
    var colPue  = headers.indexOf("PUESTO")         !== -1 ? headers.indexOf("PUESTO")         : 6;
    var colDep  = headers.indexOf("DEPARTAMENTO")   !== -1 ? headers.indexOf("DEPARTAMENTO")   : 7;
    var colEst  = headers.indexOf("ESTATUS")        !== -1 ? headers.indexOf("ESTATUS")        : 2;
    var colTel  = headers.indexOf("TELÉFONO PERSONAL") !== -1 ? headers.indexOf("TELÉFONO PERSONAL") : -1;
    var colMail = headers.indexOf("CORREO ELECTRÓNICO") !== -1 ? headers.indexOf("CORREO ELECTRÓNICO") : -1;
    var colID   = headers.indexOf("ID INTERNO")     !== -1 ? headers.indexOf("ID INTERNO")     : 50;
    var colJefe = 51; // AZ = JEFE DIRECTO (índice 51)
    var colAcce = 52; // BA = CORREO ACCESO (índice 52)
    var colURL  = headers.indexOf("URL EXPEDIENTE") !== -1 ? headers.indexOf("URL EXPEDIENTE") : 49;

    var lista = [];
    for (var i = 1; i < datos.length; i++) {
      var noEmp = (datos[i][colNo] || "").toString().trim();
      if (!noEmp) continue;

      lista.push({
        idInterno:  (datos[i][colID]   || "").toString().trim(),
        noEmpleado: noEmp,
        nombre:     (datos[i][colNom]  || "").toString().trim(),
        empresa:    (datos[i][colEmp]  || "").toString().trim(),
        puesto:     (datos[i][colPue]  || "").toString().trim(),
        depto:      (datos[i][colDep]  || "").toString().trim(),
        estatus:    (datos[i][colEst]  || "").toString().trim(),
        telefono:   colTel  >= 0 ? (datos[i][colTel]  || "").toString().trim() : "",
        email:      colMail >= 0 ? (datos[i][colMail] || "").toString().trim() : "",
        jefe:       datos[i][colJefe] ? (datos[i][colJefe] || "").toString().trim() : "",
        correoAcce: datos[i][colAcce] ? (datos[i][colAcce] || "").toString().trim() : "",
        urlExp:     colURL  >= 0 ? (datos[i][colURL]  || "").toString().trim() : ""
      });
    }

    return { status:"success", empleados: lista, total: lista.length };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ── Obtener organigrama (árbol por jefe directo) ──────────────
function obtenerOrganigrama(payload) {
  var r = obtenerDirectorio(payload);
  if (r.status !== "success") return r;

  var empleados = r.empleados;
  // Construir mapa id->empleado
  var mapa = {};
  empleados.forEach(function(e) {
    if(e.idInterno) mapa[e.idInterno] = e;
  });

  // Construir árbol: cada nodo tiene children[]
  var raices = [];
  empleados.forEach(function(e) {
    e.children = [];
    e.nivel = 0;
  });

  empleados.forEach(function(e) {
    if (e.jefe && mapa[e.jefe] && e.jefe !== e.idInterno) {
      if (!mapa[e.jefe].children) mapa[e.jefe].children = [];
      mapa[e.jefe].children.push(e);
    } else {
      raices.push(e); // sin jefe = raíz
    }
  });

  return { status:"success", arbol: raices, total: empleados.length };
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO DE ENCUESTAS — RRHH Prisma
// ══════════════════════════════════════════════════════════════
var HOJA_ENCUESTAS  = "ENCUESTAS";
var HOJA_RESPUESTAS = "RESPUESTAS";
var MAX_RESPUESTAS  = 5000;

function getHojaEncuestas() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_ENCUESTAS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_ENCUESTAS);
    hoja.getRange(1,1,1,5).setValues([["ID_ENCUESTA","NOMBRE","TIPO","ACTIVA","ESTRUCTURA_JSON"]]);
    hoja.getRange(1,1,1,5).setFontWeight("bold");
    // Encuesta de Salida completa con las 61 preguntas
    var estructuraSalida = getEstructuraSalida();
    hoja.appendRow(["SALIDA",  "Encuesta de Salida",                        "salida",       "Si", estructuraSalida]);
    hoja.appendRow(["CLIMA",   "Encuesta de Clima Laboral",                 "clima",        "Si", "{}"]);
    hoja.appendRow(["DESEMPE", "Evaluacion de Desempeno",                   "desempeno",    "Si", "{}"]);
    hoja.appendRow(["CAPAC",   "Deteccion de Necesidades de Capacitacion",  "capacitacion", "Si", "{}"]);
    hoja.appendRow(["PULSO",   "Encuesta de Pulso",                         "pulso",        "Si", "{}"]);
    Logger.log("[Encuestas] Hoja ENCUESTAS creada con encuesta de salida completa.");
  }
  return hoja;
}

// ── Estructura completa Encuesta de Salida (61 preguntas + selección múltiple) ──
function getEstructuraSalida() {
  var estructura = {
    titulo: "Encuesta de Salida",
    descripcion: "Tus respuestas son confidenciales y nos ayudan a mejorar como organizacion. Gracias por tu tiempo.",
    bloques: [
      {
        icono:"💰", titulo:"Compensacion y Beneficios",
        preguntas:[
          {tipo:"escala",  texto:"Mi salario era competitivo en comparacion con el mercado."},
          {tipo:"escala",  texto:"Considero que mi compensacion era justa en relacion con mis responsabilidades."},
          {tipo:"escala",  texto:"Los beneficios ofrecidos cubrian adecuadamente mis necesidades."},
          {tipo:"escala",  texto:"Los incentivos y bonos estaban alineados con mi desempeno."},
          {tipo:"escala",  texto:"Existia equidad salarial dentro de mi area."},
          {tipo:"escala",  texto:"¿Influyo la falta de algun beneficio especifico (seguro, bonos, vales) en tu decision de salir?"},
          {tipo:"abierta", texto:"¿Que prestacion, beneficio o aspecto de tu compensacion total crees que podriamos mejorar para retener talento?"}
        ]
      },
      {
        icono:"👔", titulo:"Liderazgo y Gestion",
        preguntas:[
          {tipo:"escala",  texto:"Mi jefe directo comunicaba claramente las expectativas del puesto."},
          {tipo:"escala",  texto:"Recibia retroalimentacion util y oportuna."},
          {tipo:"escala",  texto:"Me sentia apoyado(a) por mi lider para realizar mi trabajo."},
          {tipo:"escala",  texto:"¿Considera que la relacion de su Jefe Inmediato con el personal a su cargo era buena?"},
          {tipo:"escala",  texto:"Mi jefe promovia un ambiente de respeto y confianza."},
          {tipo:"escala",  texto:"Las decisiones del liderazgo eran coherentes y justas."},
          {tipo:"abierta", texto:"¿Que aspectos del liderazgo influyeron en tu decision de salida?"}
        ]
      },
      {
        icono:"🚀", titulo:"Desarrollo y Crecimiento Profesional",
        preguntas:[
          {tipo:"escala",  texto:"Contaba con oportunidades reales de crecimiento dentro de la organizacion."},
          {tipo:"escala",  texto:"Existia claridad sobre mi plan de carrera."},
          {tipo:"escala",  texto:"¿Cuando ingreso a la empresa recibio el curso de induccion (actividades, responsabilidades, reglamento, salario, gratificaciones, sanciones)?"},
          {tipo:"escala",  texto:"La empresa invertia en mi desarrollo profesional."},
          {tipo:"escala",  texto:"Tenia acceso a capacitacion relevante para mi puesto."},
          {tipo:"escala",  texto:"Se promovia la movilidad interna."},
          {tipo:"abierta", texto:"¿Que tipo de capacitacion o desarrollo crees que habria mejorado tu desempeno o experiencia?"}
        ]
      },
      {
        icono:"🌱", titulo:"Clima y Cultura Organizacional",
        preguntas:[
          {tipo:"escala",  texto:"El ambiente laboral era positivo."},
          {tipo:"escala",  texto:"Me sentia respetado(a) por mis companeros."},
          {tipo:"escala",  texto:"La cultura organizacional era coherente con sus valores declarados."},
          {tipo:"escala",  texto:"Me sentia parte importante de la organizacion."},
          {tipo:"escala",  texto:"La empresa promovia la inclusion y diversidad."},
          {tipo:"abierta", texto:"Describe el ambiente de trabajo en la organizacion."}
        ]
      },
      {
        icono:"⚖️", titulo:"Carga de Trabajo y Organizacion",
        preguntas:[
          {tipo:"escala",  texto:"Mi carga de trabajo era razonable."},
          {tipo:"escala",  texto:"Contaba con los recursos necesarios para cumplir mis funciones."},
          {tipo:"escala",  texto:"Los procesos internos eran eficientes."},
          {tipo:"escala",  texto:"El nivel de estres era manejable."},
          {tipo:"escala",  texto:"Las responsabilidades estaban bien definidas."},
          {tipo:"abierta", texto:"¿Que cambios harias en la organizacion del trabajo?"}
        ]
      },
      {
        icono:"💬", titulo:"Comunicacion Interna",
        preguntas:[
          {tipo:"escala",  texto:"La informacion importante se comunicaba de manera clara y oportuna, asi como los cambios organizacionales se explicaban adecuadamente."},
          {tipo:"escala",  texto:"¿El trabajo en equipo y la comunicacion entre companeros eran efectivos?"},
          {tipo:"escala",  texto:"Podia expresar mis opiniones libremente."},
          {tipo:"escala",  texto:"¿Considera que los canales de comunicacion utilizados (correo, chat, reuniones) eran los adecuados?"},
          {tipo:"escala",  texto:"¿Sentia que los lideres/gerentes estaban abiertos a recibir retroalimentacion y escuchaban sus preocupaciones?"},
          {tipo:"abierta", texto:"¿Hubo algun momento en que la falta de comunicacion afectara tu motivacion o desempeno?"}
        ]
      },
      {
        icono:"⭐", titulo:"Reconocimiento y Motivacion",
        preguntas:[
          {tipo:"escala",  texto:"Mi trabajo era reconocido adecuadamente."},
          {tipo:"escala",  texto:"El desempeno era evaluado de manera justa."},
          {tipo:"escala",  texto:"Sentia que mi trabajo aportaba valor a la organizacion."},
          {tipo:"abierta", texto:"¿Que hubiera incrementado tu nivel de motivacion?"}
        ]
      },
      {
        icono:"🏢", titulo:"Condiciones de Trabajo",
        preguntas:[
          {tipo:"escala",  texto:"Las herramientas tecnologicas eran adecuadas."},
          {tipo:"escala",  texto:"Las instalaciones para desempenar su trabajo eran seguras y limpias."},
          {tipo:"escala",  texto:"Me sentia seguro(a) en mi entorno laboral."},
          {tipo:"escala",  texto:"¿El equipo de proteccion fue el adecuado para llevar a cabo su trabajo?"},
          {tipo:"abierta", texto:"¿Que mejorarias en tus condiciones fisicas de trabajo?"}
        ]
      },
      {
        icono:"🌿", titulo:"Balance Vida-Trabajo",
        preguntas:[
          {tipo:"escala", texto:"Tenia un buen equilibrio entre mi vida personal y laboral."},
          {tipo:"escala", texto:"La empresa respetaba mis tiempos personales."},
          {tipo:"escala", texto:"Existia flexibilidad cuando la necesitaba."},
          {tipo:"escala", texto:"Disponia de tiempo para descansar y/o consumir mis alimentos."},
          {tipo:"escala", texto:"¿El balance vida-trabajo influyo en tu decision de salida?"}
        ]
      },
      {
        icono:"🎯", titulo:"Experiencia General",
        preguntas:[
          {tipo:"escala",  texto:"En general, mi experiencia en la empresa fue positiva."},
          {tipo:"escala",  texto:"Recomendaria la empresa como un buen lugar para trabajar."},
          {tipo:"escala",  texto:"Consideraria regresar a trabajar aqui en el futuro."},
          {tipo:"abierta", texto:"¿Cual fue el principal motivo de tu decision de salida?"},
          {tipo:"abierta", texto:"¿Que deberia hacer la empresa para retener talento como tu?"},
          {tipo:"abierta", texto:"Si usted pudiera cambiar algo dentro de la empresa, ¿que condicion seria?"},
          {tipo:"abierta", texto:"¿Como se sintio durante el tiempo que laburo con nosotros?"},
          {tipo:"abierta", texto:"Observaciones, comentarios y sugerencias que quiera realizar a la empresa."}
        ]
      },
      {
        icono:"📋", titulo:"Razon Principal de Salida",
        preguntas:[
          {
            tipo:"multiple",
            texto:"Selecciona la(s) razon(es) principal(es) de tu salida (puedes elegir varias):",
            opciones:[
              "Mala relacion con jefe directo",
              "Mala relacion con companeros",
              "Carga de trabajo",
              "Discriminacion / acoso / hostigamiento",
              "Distancia entre trabajo y domicilio",
              "Falta de herramientas para desempenar trabajo",
              "Horario de trabajo",
              "Trabajo riesgoso",
              "Capacitacion",
              "Oportunidades de desarrollo",
              "Estudios que demandan el 100% de mi tiempo",
              "Necesidad de estudiar y trabajar al mismo tiempo",
              "Sueldo",
              "Prestaciones",
              "Enfermedad personal",
              "Enfermedad de familiar (necesidad de cuidarlo)",
              "Problemas legales",
              "Matrimonio",
              "Necesidad de atender a los hijos",
              "Cambio de residencia",
              "Otro"
            ]
          }
        ]
      }
    ]
  };
  return JSON.stringify(estructura);
}

function getHojaRespuestas() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_RESPUESTAS);
    hoja.getRange(1,1,1,9).setValues([[
      "ID_RESPUESTA","ID_ENCUESTA","TIPO_ENCUESTA","ID_INTERNO",
      "NO_EMPLEADO","NOMBRE_EMPLEADO","EMPRESA","FECHA_RESPUESTA","RESPUESTAS_JSON"
    ]]);
    hoja.getRange(1,1,1,9).setFontWeight("bold");
  }
  return hoja;
}

// ── Obtener configuración de encuesta ─────────────────────────
function obtenerEncuesta(payload) {
  var encId = (payload.encId || "SALIDA").toString().trim().toUpperCase();
  try {
    var hoja  = getHojaEncuestas();
    var datos = hoja.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if ((datos[i][0]||"").toString().trim().toUpperCase() === encId) {
        var estructura = {};
        try { estructura = JSON.parse(datos[i][4] || "{}"); } catch(e){}

        // Si la estructura está vacía y es SALIDA, usar la definición hardcodeada
        var bloques = estructura.bloques || [];
        if (bloques.length === 0 && encId === "SALIDA") {
          try {
            var estructuraCompleta = JSON.parse(getEstructuraSalida());
            bloques = estructuraCompleta.bloques || [];
            estructura.titulo      = estructura.titulo      || estructuraCompleta.titulo;
            estructura.descripcion = estructura.descripcion || estructuraCompleta.descripcion;
            // Actualizar el Sheet con la estructura completa
            hoja.getRange(i+1, 5).setValue(getEstructuraSalida());
            Logger.log("[obtenerEncuesta] Estructura SALIDA cargada desde hardcode y guardada en Sheet.");
          } catch(ex) {
            Logger.log("[obtenerEncuesta] Error cargando hardcode: " + ex);
          }
        }

        return {
          status: "success",
          encuesta: {
            id:          datos[i][0],
            titulo:      datos[i][1],
            tipo:        datos[i][2],
            activa:      datos[i][3],
            descripcion: estructura.descripcion || "",
            bloques:     bloques
          }
        };
      }
    }
    return { status:"error", message:"Encuesta no encontrada: " + encId };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ── Guardar respuesta de empleado ─────────────────────────────
function guardarRespuestaEncuesta(payload) {
  var encId    = (payload.encId    || "").toString().trim();
  var empId    = (payload.empleadoId   || "").toString().trim();
  var empNom   = (payload.empleadoNombre || "").toString().trim();
  var respJSON = JSON.stringify(payload.respuestas || {});
  var fecha    = payload.fechaRespuesta || new Date().toISOString();

  if (!encId || !empId) return { status:"error", message:"Faltan datos de identificación." };

  try {
    var hoja     = getHojaRespuestas();
    var ultima   = hoja.getLastRow();

    // Auto-archivar si supera MAX_RESPUESTAS
    if (ultima > MAX_RESPUESTAS) {
      var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
      var año     = new Date().getFullYear();
      var mes     = ("0"+(new Date().getMonth()+1)).slice(-2);
      var nomArch = "RESPUESTAS_" + año + "_" + mes;
      var hojaArch = ss.getSheetByName(nomArch) || ss.insertSheet(nomArch);
      if (hojaArch.getLastRow() === 0) {
        hoja.getRange(1,1,1,9).copyTo(hojaArch.getRange(1,1));
      }
      var archDatos = hoja.getRange(2,1,1000,9).getValues();
      hojaArch.getRange(hojaArch.getLastRow()+1,1,archDatos.length,9).setValues(archDatos);
      hoja.deleteRows(2,1000);
      ultima = hoja.getLastRow();
    }

    // Buscar empresa del empleado desde la BD
    var empresa = "";
    try {
      var sheetBD = SpreadsheetApp.openById(ID_SHEET_BD).getSheetByName(NOMBRE_HOJA);
      var datosBD = sheetBD.getDataRange().getValues();
      var hdrsBD  = datosBD[0].map(function(h){return h?h.toString().trim():"";});
      var colID   = 50; // AY = ID INTERNO
      var colEmp  = hdrsBD.indexOf("EMPRESA");
      for (var j = 1; j < datosBD.length; j++) {
        if ((datosBD[j][colID]||"").toString().trim() === empId ||
            (datosBD[j][0]||"").toString().trim() === empId) {
          empresa = (datosBD[j][colEmp]||"").toString().trim();
          break;
        }
      }
    } catch(ex) {}

    // Tipo de encuesta
    var tipoEnc = "";
    try {
      var hEnc  = getHojaEncuestas();
      var dEnc  = hEnc.getDataRange().getValues();
      for (var k = 1; k < dEnc.length; k++) {
        if ((dEnc[k][0]||"").toString().trim().toUpperCase() === encId.toUpperCase()) {
          tipoEnc = dEnc[k][2]; break;
        }
      }
    } catch(ex) {}

    var idResp = "RSP" + ("000000"+(ultima)).slice(-6);
    hoja.appendRow([idResp, encId, tipoEnc, empId, empId, empNom, empresa, fecha, respJSON]);

    Logger.log("[Encuesta] Respuesta guardada: " + idResp + " enc=" + encId + " emp=" + empId);
    return { status:"success", message:"Respuesta guardada.", id: idResp };

  } catch(e) {
    Logger.log("[Encuesta] Error: " + e);
    return { status:"error", message: e.toString() };
  }
}

// ── Listar respuestas (para el dashboard de encuestas) ────────
function listarRespuestasEncuesta(payload) {
  var token = (payload && payload.token) ? payload.token : "";
  var encId = (payload && payload.encId) ? payload.encId.toString().toUpperCase() : "";

  try {
    var hoja  = getHojaRespuestas();
    var datos = hoja.getDataRange().getValues();
    var lista = [];

    for (var i = 1; i < datos.length; i++) {
      var fEncId = (datos[i][1]||"").toString().trim().toUpperCase();
      if (encId && fEncId !== encId) continue;
      if (!datos[i][0]) continue;

      var respObj = {};
      try { respObj = JSON.parse(datos[i][8] || "{}"); } catch(e){}

      lista.push({
        id:            datos[i][0],
        encId:         datos[i][1],
        tipoEnc:       datos[i][2],
        idInterno:     datos[i][3],
        noEmpleado:    datos[i][4],
        nombre:        datos[i][5],
        empresa:       datos[i][6],
        fecha:         datos[i][7] ? datos[i][7].toString() : "",
        respuestas:    respObj
      });
    }

    return { status:"success", respuestas: lista, total: lista.length };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ── Guardar configuración de encuesta (editor) ────────────────
function guardarConfigEncuesta(payload) {
  var token = (payload.token || "").trim();
  var admin = buscarUsuarioPorToken(token);
  if (!admin || admin.datos[4] !== "Administrador") {
    return { status:"error", message:"Sin permisos." };
  }

  var encId     = (payload.encId     || "").toString().trim().toUpperCase();
  var estructura = JSON.stringify(payload.estructura || {});

  try {
    var hoja  = getHojaEncuestas();
    var datos = hoja.getDataRange().getValues();

    for (var i = 1; i < datos.length; i++) {
      if ((datos[i][0]||"").toString().trim().toUpperCase() === encId) {
        hoja.getRange(i+1, 5).setValue(estructura);
        return { status:"success", message:"Encuesta actualizada." };
      }
    }
    return { status:"error", message:"Encuesta no encontrada." };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO DE EVALUACIONES
// ══════════════════════════════════════════════════════════════
var HOJA_PROCESOS_EVAL = "PROCESOS_EVAL";
var HOJA_EVALUACIONES  = "EVALUACIONES";
var HOJA_ACCESO_EMP    = "EMPLEADOS_ACCESO";

function getHojaProcesosEval() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_PROCESOS_EVAL);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_PROCESOS_EVAL);
    hoja.getRange(1,1,1,10).setValues([[
      "ID_PROCESO","NOMBRE","TIPO","ESTATUS","FECHA_INICIO",
      "FECHA_CIERRE","EMPRESA","ESTRUCTURA_JSON","CREADO_POR","FECHA_CREACION"
    ]]);
    hoja.getRange(1,1,1,10).setFontWeight("bold");
    Logger.log("[Eval] Hoja PROCESOS_EVAL creada.");
  }
  return hoja;
}

function getHojaEvaluaciones() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_EVALUACIONES);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_EVALUACIONES);
    hoja.getRange(1,1,1,9).setValues([[
      "ID_EVAL","ID_PROCESO","ID_EVALUADO","NOMBRE_EVALUADO",
      "ID_EVALUADOR","ROL_EVALUADOR","ESTATUS","FECHA_COMPLETADA","RESPUESTAS_JSON"
    ]]);
    hoja.getRange(1,1,1,9).setFontWeight("bold");
    Logger.log("[Eval] Hoja EVALUACIONES creada.");
  }
  return hoja;
}

function getHojaAccesoEmp() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_ACCESO_EMP);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_ACCESO_EMP);
    hoja.getRange(1,1,1,7).setValues([[
      "ID_INTERNO","CORREO_ACCESO","HASH_PASSWORD",
      "ESTATUS","TOKEN_SESION","EXPIRA_TOKEN","ULTIMO_ACCESO"
    ]]);
    hoja.getRange(1,1,1,7).setFontWeight("bold");
    Logger.log("[Eval] Hoja EMPLEADOS_ACCESO creada.");
  }
  return hoja;
}

// ── Crear proceso de evaluación ───────────────────────────────
function crearProcesoEval(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };

  var nombre   = (payload.nombre   || "").trim();
  var tipo     = (payload.tipo     || "desempeno").trim();
  var fechaIni = (payload.fechaIni || "").trim();
  var fechaFin = (payload.fechaFin || "").trim();
  var empresa  = (payload.empresa  || "").trim();

  if (!nombre) return { status:"error", message:"El nombre es requerido." };

  var hoja   = getHojaProcesosEval();
  var ultimo = hoja.getLastRow();
  var id     = "EVA" + ("000" + ultimo).slice(-3);

  // Estructura por defecto según tipo
  var estructura = getEstructuraEvalPorTipo(tipo);

  hoja.appendRow([
    id, nombre, tipo, "Borrador", fechaIni, fechaFin, empresa,
    JSON.stringify(estructura), caller.email, new Date().toISOString()
  ]);

  registrarEvento(caller.email, caller.rol, "CREAR_PROCESO_EVAL",
    "Creó proceso: " + nombre + " ("+tipo+")", empresa, "");

  return { status:"success", id:id, message:"Proceso creado correctamente." };
}

// ── Estructura por defecto según tipo ────────────────────────
function getEstructuraEvalPorTipo(tipo) {
  if (tipo === "desempeno") {
    return {
      titulo: "Evaluación de Desempeño",
      escala: "1-10",
      descripcion: "Evaluación del desempeño laboral del colaborador.",
      bloques: [
        {
          titulo: "Resultados y Objetivos",
          preguntas: [
            {tipo:"escala10", texto:"¿En qué medida el colaborador alcanzó los objetivos establecidos?"},
            {tipo:"escala10", texto:"¿Cuál es la calidad del trabajo entregado?"},
            {tipo:"escala10", texto:"¿Cumple con los plazos y tiempos establecidos?"},
            {tipo:"abierta",  texto:"¿Cuáles fueron sus principales logros en el periodo?"}
          ]
        },
        {
          titulo: "Competencias y Habilidades",
          preguntas: [
            {tipo:"escala10", texto:"¿Muestra iniciativa y proactividad en su trabajo?"},
            {tipo:"escala10", texto:"¿Trabaja efectivamente en equipo?"},
            {tipo:"escala10", texto:"¿Se comunica de manera clara y efectiva?"},
            {tipo:"escala10", texto:"¿Se adapta positivamente a los cambios?"}
          ]
        },
        {
          titulo: "Actitud y Valores",
          preguntas: [
            {tipo:"escala10", texto:"¿Demuestra compromiso con la empresa y su trabajo?"},
            {tipo:"escala10", texto:"¿Actúa con integridad y ética profesional?"},
            {tipo:"escala10", texto:"¿Muestra respeto hacia sus compañeros y líderes?"},
            {tipo:"abierta",  texto:"¿Qué áreas de mejora identifica en el colaborador?"}
          ]
        },
        {
          titulo: "Desarrollo y Proyección",
          preguntas: [
            {tipo:"escala10", texto:"¿Tiene potencial de crecimiento dentro de la organización?"},
            {tipo:"abierta",  texto:"¿Qué acciones de desarrollo recomienda para el próximo periodo?"}
          ]
        }
      ]
    };
  }

  if (tipo === "360") {
    return {
      titulo: "Evaluación 360°",
      escala: "1-10",
      descripcion: "Evaluación integral desde múltiples perspectivas.",
      rolesEvaluadores: ["jefe","autoevaluacion","par","subordinado"],
      bloques: [
        {
          titulo: "Liderazgo",
          preguntas: [
            {tipo:"escala10", texto:"¿Inspira y motiva a los demás?"},
            {tipo:"escala10", texto:"¿Toma decisiones acertadas bajo presión?"},
            {tipo:"escala10", texto:"¿Delega tareas de forma efectiva?"}
          ]
        },
        {
          titulo: "Colaboración",
          preguntas: [
            {tipo:"escala10", texto:"¿Comparte conocimiento y apoya a sus compañeros?"},
            {tipo:"escala10", texto:"¿Construye relaciones de confianza con el equipo?"},
            {tipo:"escala10", texto:"¿Maneja constructivamente los conflictos?"}
          ]
        },
        {
          titulo: "Comunicación",
          preguntas: [
            {tipo:"escala10", texto:"¿Escucha activamente y considera las opiniones de otros?"},
            {tipo:"escala10", texto:"¿Se expresa con claridad y asertividad?"},
            {tipo:"abierta",  texto:"¿Qué es lo que más valoras de trabajar con esta persona?"}
          ]
        },
        {
          titulo: "Resultados",
          preguntas: [
            {tipo:"escala10", texto:"¿Cumple consistentemente con sus compromisos?"},
            {tipo:"escala10", texto:"¿Busca la mejora continua en su trabajo?"},
            {tipo:"abierta",  texto:"¿Qué aspecto podría mejorar esta persona?"}
          ]
        }
      ]
    };
  }

  if (tipo === "competencias") {
    return {
      titulo: "Evaluación de Competencias",
      escala: "competencias",
      opcionesCompetencia: [
        {valor:1, etiqueta:"No desarrollada", desc:"No demuestra la competencia"},
        {valor:2, etiqueta:"En desarrollo",   desc:"Demuestra la competencia ocasionalmente"},
        {valor:3, etiqueta:"Desarrollada",    desc:"Demuestra la competencia consistentemente"},
        {valor:4, etiqueta:"Sobresaliente",   desc:"Supera ampliamente las expectativas"}
      ],
      descripcion: "Evaluación del nivel de desarrollo de competencias clave.",
      bloques: [
        {
          titulo: "Competencias Core",
          preguntas: [
            {tipo:"competencia", texto:"Orientación a resultados"},
            {tipo:"competencia", texto:"Trabajo en equipo y colaboración"},
            {tipo:"competencia", texto:"Comunicación efectiva"},
            {tipo:"competencia", texto:"Adaptabilidad y flexibilidad"},
            {tipo:"competencia", texto:"Integridad y ética profesional"}
          ]
        },
        {
          titulo: "Competencias de Gestión",
          preguntas: [
            {tipo:"competencia", texto:"Planificación y organización"},
            {tipo:"competencia", texto:"Toma de decisiones"},
            {tipo:"competencia", texto:"Liderazgo e influencia"},
            {tipo:"competencia", texto:"Desarrollo de personas"},
            {tipo:"competencia", texto:"Orientación al cliente"}
          ]
        },
        {
          titulo: "Comentarios",
          preguntas: [
            {tipo:"abierta", texto:"Fortalezas destacadas del colaborador"},
            {tipo:"abierta", texto:"Áreas prioritarias de desarrollo"},
            {tipo:"abierta", texto:"Comentarios adicionales"}
          ]
        }
      ]
    };
  }

  return { titulo:"Evaluación", escala:"1-10", bloques:[] };
}

// ── Listar procesos ───────────────────────────────────────────
function listarProcesosEval(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };

  var hoja  = getHojaProcesosEval();
  var datos = hoja.getDataRange().getValues();
  var lista = [];

  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    var estr = {};
    try { estr = JSON.parse(datos[i][7]||"{}"); } catch(e){}
    lista.push({
      id:         datos[i][0],
      nombre:     datos[i][1],
      tipo:       datos[i][2],
      estatus:    datos[i][3],
      fechaIni:   datos[i][4] ? datos[i][4].toString() : "",
      fechaFin:   datos[i][5] ? datos[i][5].toString() : "",
      empresa:    datos[i][6],
      titulo:     estr.titulo || datos[i][1],
      creadoPor:  datos[i][8],
      fechaCreacion: datos[i][9] ? datos[i][9].toString() : ""
    });
  }

  return { status:"success", procesos: lista };
}

// ── Obtener proceso completo con estructura ───────────────────
function obtenerProcesoEval(payload) {
  var id = (payload.id || "").trim();
  if (!id) return { status:"error", message:"ID requerido." };

  var hoja  = getHojaProcesosEval();
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][0]||"").toString().trim() === id) {
      var estr = {};
      try { estr = JSON.parse(datos[i][7]||"{}"); } catch(e){}
      return {
        status:"success",
        proceso:{
          id:       datos[i][0], nombre:datos[i][1], tipo:datos[i][2],
          estatus:  datos[i][3], fechaIni:datos[i][4]?datos[i][4].toString():"",
          fechaFin: datos[i][5]?datos[i][5].toString():"",
          empresa:  datos[i][6], estructura: estr
        }
      };
    }
  }
  return { status:"error", message:"Proceso no encontrado." };
}

// ── Actualizar estructura del proceso ─────────────────────────
function actualizarProcesoEval(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };

  var id  = (payload.id || "").trim();
  var hoja = getHojaProcesosEval();
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][0]||"").toString().trim() === id) {
      if (payload.nombre)     hoja.getRange(i+1,2).setValue(payload.nombre);
      if (payload.fechaIni)   hoja.getRange(i+1,5).setValue(payload.fechaIni);
      if (payload.fechaFin)   hoja.getRange(i+1,6).setValue(payload.fechaFin);
      if (payload.empresa!==undefined) hoja.getRange(i+1,7).setValue(payload.empresa);
      if (payload.estructura) hoja.getRange(i+1,8).setValue(JSON.stringify(payload.estructura));
      return { status:"success", message:"Proceso actualizado." };
    }
  }
  return { status:"error", message:"Proceso no encontrado." };
}

// ── Activar proceso: generar evaluaciones individuales ────────
function activarProcesoEval(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };

  var id = (payload.id || "").trim();
  var rProc = obtenerProcesoEval({id: id});
  if (rProc.status !== "success") return rProc;

  var proc = rProc.proceso;
  if (proc.estatus === "Activo") return { status:"error", message:"El proceso ya está activo." };

  // Obtener empleados participantes
  var sheetBD = SpreadsheetApp.openById(ID_SHEET_BD).getSheetByName(NOMBRE_HOJA);
  var datosBD = sheetBD.getDataRange().getValues();
  var hdrs = datosBD[0].map(function(h){ if(!h) return ""; var s=h.toString(); var parts=s.split(String.fromCharCode(10)); return parts.join(" ").trim(); });
  var colID   = 50; // AY
  var colEmp  = hdrs.indexOf("EMPRESA");
  var colNom  = 4;
  var colJefe = 51; // AZ
  var colEst  = 2;

  var empleados = [];
  for (var i = 1; i < datosBD.length; i++) {
    if ((datosBD[i][colEst]||"").trim() !== "Activo") continue;
    if (proc.empresa && (datosBD[i][colEmp]||"").trim() !== proc.empresa) continue;
    empleados.push({
      id:    (datosBD[i][colID] ||"").toString().trim(),
      nom:   (datosBD[i][colNom]||"").toString().trim(),
      jefe:  (datosBD[i][colJefe]||"").toString().trim()
    });
  }

  if (!empleados.length) return { status:"error", message:"No hay empleados que coincidan." };

  // Generar evaluaciones
  var hojaEval = getHojaEvaluaciones();
  var cont     = hojaEval.getLastRow();
  var creadas  = 0;
  var tipo     = proc.tipo;

  empleados.forEach(function(emp) {
    if (!emp.id) return;

    // Jefe evalúa al colaborador (todos los tipos)
    if (emp.jefe) {
      cont++;
      hojaEval.appendRow([
        "EV"+("00000"+cont).slice(-5), id,
        emp.id, emp.nom, emp.jefe, "jefe",
        "Pendiente", "", ""
      ]);
      creadas++;
    }

    // Autoevaluación (360 y competencias)
    if (tipo === "360" || tipo === "competencias") {
      cont++;
      hojaEval.appendRow([
        "EV"+("00000"+cont).slice(-5), id,
        emp.id, emp.nom, emp.id, "autoevaluacion",
        "Pendiente", "", ""
      ]);
      creadas++;
    }
  });

  // Marcar proceso como Activo
  var hojaPr = getHojaProcesosEval();
  var datPr  = hojaPr.getDataRange().getValues();
  for (var j = 1; j < datPr.length; j++) {
    if ((datPr[j][0]||"").toString().trim() === id) {
      hojaPr.getRange(j+1, 4).setValue("Activo");
      break;
    }
  }

  registrarEvento(caller.email, caller.rol, "ACTIVAR_PROCESO_EVAL",
    "Activó proceso " + id + ". " + creadas + " evaluaciones generadas.", proc.empresa, "");

  return {
    status:"success",
    message:"Proceso activado. "+creadas+" evaluaciones generadas para "+empleados.length+" colaboradores.",
    evaluaciones: creadas
  };
}

// ── Cerrar proceso ────────────────────────────────────────────
function cerrarProcesoEval(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };
  var id = (payload.id||"").trim();
  var hoja = getHojaProcesosEval();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][0]||"").toString().trim() === id) {
      hoja.getRange(i+1,4).setValue("Cerrado");
      return { status:"success", message:"Proceso cerrado." };
    }
  }
  return { status:"error", message:"Proceso no encontrado." };
}

// ── Mis evaluaciones: como evaluador Y como evaluado ─────────
function listarMisEvaluaciones(payload) {
  var idUsuario = (payload.idEvaluador||payload.idUsuario||"").trim();
  if (!idUsuario) return { status:"error", message:"ID requerido." };

  var hoja  = getHojaEvaluaciones();
  var datos = hoja.getDataRange().getValues();
  var comoEvaluador = []; // yo debo llenar
  var comoEvaluado  = []; // alguien me evalúa a mí

  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    var idEval  = (datos[i][4]||"").toString().trim(); // ID_EVALUADOR
    var idEvalD = (datos[i][2]||"").toString().trim(); // ID_EVALUADO
    var resp = {};
    try { resp = JSON.parse(datos[i][8]||"{}"); } catch(e){}

    var base = {
      id:            datos[i][0],
      idProceso:     datos[i][1],
      idEvaluado:    idEvalD,
      nombreEvaluado:datos[i][3],
      idEvaluador:   idEval,
      rolEvaluador:  datos[i][5],
      estatus:       datos[i][6],
      fechaComp:     datos[i][7]?datos[i][7].toString():"",
      respuestas:    resp
    };

    // Soy el evaluador — debo llenar este formulario
    if (idEval === idUsuario) {
      comoEvaluador.push(Object.assign({}, base, { perspectiva: "evaluador" }));
    }
    // Soy el evaluado — puedo ver el progreso de quién me evalúa
    if (idEvalD === idUsuario && idEval !== idUsuario) {
      comoEvaluado.push(Object.assign({}, base, { perspectiva: "evaluado" }));
    }
  }

  return {
    status:"success",
    evaluaciones: comoEvaluador,   // para llenar
    comoEvaluado: comoEvaluado     // ver quien me evalúa
  };
}

// ── Mi equipo — evaluaciones de reportes directos ─────────────
function listarEquipoEval(payload) {
  var idJefe = (payload.idJefe||"").trim();
  if (!idJefe) return { status:"error", message:"ID requerido." };

  var hoja  = getHojaEvaluaciones();
  var datos = hoja.getDataRange().getValues();
  var lista = [];

  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    if ((datos[i][4]||"").toString().trim() !== idJefe) continue;
    if ((datos[i][5]||"").toString().trim() !== "jefe") continue;
    lista.push({
      id:            datos[i][0],
      idProceso:     datos[i][1],
      idEvaluado:    datos[i][2],
      nombreEvaluado:datos[i][3],
      estatus:       datos[i][6],
      fechaComp:     datos[i][7]?datos[i][7].toString():""
    });
  }

  return { status:"success", equipo: lista };
}

// ── Guardar evaluación completada ─────────────────────────────
function guardarEvaluacion(payload) {
  var idEval   = (payload.idEval   ||"").trim();
  var respJSON = JSON.stringify(payload.respuestas||{});

  var hoja  = getHojaEvaluaciones();
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][0]||"").toString().trim() !== idEval) continue;
    hoja.getRange(i+1,7).setValue("Completada");
    hoja.getRange(i+1,8).setValue(new Date().toISOString());
    hoja.getRange(i+1,9).setValue(respJSON);
    return { status:"success", message:"Evaluación guardada." };
  }
  return { status:"error", message:"Evaluación no encontrada." };
}

// ── Resultados agregados de un proceso ────────────────────────
function resultadosEval(payload) {
  var idProceso = (payload.idProceso||"").trim();
  var hoja      = getHojaEvaluaciones();
  var datos     = hoja.getDataRange().getValues();

  var evaluaciones = [];
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    if ((datos[i][1]||"").trim() !== idProceso) continue;
    var resp = {};
    try { resp = JSON.parse(datos[i][8]||"{}"); } catch(e){}
    evaluaciones.push({
      id:         datos[i][0],
      idEvaluado: datos[i][2],
      nombre:     datos[i][3],
      rol:        datos[i][5],
      estatus:    datos[i][6],
      respuestas: resp
    });
  }

  var total     = evaluaciones.length;
  var completadas = evaluaciones.filter(function(e){ return e.estatus==="Completada"; }).length;
  var pendientes  = total - completadas;

  return {
    status:"success",
    total:total, completadas:completadas, pendientes:pendientes,
    evaluaciones:evaluaciones
  };
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO ACCESO DE EMPLEADOS
// ══════════════════════════════════════════════════════════════

// ── Login de empleado ─────────────────────────────────────────
function loginEmpleado(payload) {
  var correo   = (payload.correo  ||"").trim().toLowerCase();
  var password = (payload.password||"").trim();

  if (!correo || !password) return { status:"error", message:"Correo y contraseña requeridos." };

  // Buscar en EMPLEADOS_ACCESO por correo
  var hoja  = getHojaAccesoEmp();
  var datos = hoja.getDataRange().getValues();
  var fila  = -1;
  var registro = null;

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][1]||"").toString().trim().toLowerCase() === correo) {
      fila = i + 1;
      registro = datos[i];
      break;
    }
  }

  if (!registro) return { status:"error", message:"Correo no registrado." };
  if ((registro[3]||"").trim() !== "Activo") return { status:"error", message:"Acceso inactivo." };
  if (hashPassword(password) !== registro[2].toString().trim()) return { status:"error", message:"Contraseña incorrecta." };

  // Generar token
  var token  = generarToken();
  var expira = new Date(new Date().getTime() + 12*3600*1000);
  hoja.getRange(fila,5).setValue(token);
  hoja.getRange(fila,6).setValue(expira);
  hoja.getRange(fila,7).setValue(new Date().toISOString());

  // Obtener datos del empleado desde la BD
  var empData = {};
  var shBD    = SpreadsheetApp.openById(ID_SHEET_BD).getSheetByName(NOMBRE_HOJA);
  var dBD     = shBD.getDataRange().getValues();
  for (var j = 1; j < dBD.length; j++) {
    if ((dBD[j][50]||"").toString().trim() === registro[0].toString().trim()) {
      empData = {
        idInterno: registro[0],
        nombre:    (dBD[j][4]||"").toString().trim(),
        puesto:    (dBD[j][6]||"").toString().trim(),
        empresa:   (dBD[j][5]||"").toString().trim(),
        jefe:      (dBD[j][51]||"").toString().trim()
      };
      break;
    }
  }

  return { status:"success", token:token, empleado:empData };
}

// ── Validar token de empleado ─────────────────────────────────
function validarTokenEmpleado(payload) {
  var token = (payload.token||"").trim();
  if (!token) return { status:"error", message:"Token requerido." };

  var hoja  = getHojaAccesoEmp();
  var datos = hoja.getDataRange().getValues();
  var ahora = new Date().getTime();

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][4]||"").toString().trim() !== token) continue;
    if ((datos[i][3]||"").trim() !== "Activo") continue;
    var exp = new Date(datos[i][5]).getTime();
    if (exp < ahora) return { status:"error", message:"Sesión expirada." };

    // Obtener datos del empleado
    var idInt = (datos[i][0]||"").toString().trim();
    var empData = { idInterno:idInt };
    var shBD = SpreadsheetApp.openById(ID_SHEET_BD).getSheetByName(NOMBRE_HOJA);
    var dBD  = shBD.getDataRange().getValues();
    for (var j = 1; j < dBD.length; j++) {
      if ((dBD[j][50]||"").toString().trim() === idInt) {
        empData = {
          idInterno: idInt,
          nombre:    (dBD[j][4]||"").toString().trim(),
          puesto:    (dBD[j][6]||"").toString().trim(),
          empresa:   (dBD[j][5]||"").toString().trim(),
          jefe:      (dBD[j][51]||"").toString().trim()
        };
        break;
      }
    }
    return { status:"success", empleado:empData };
  }
  return { status:"error", message:"Token inválido o expirado." };
}

// ── Activar acceso (uso interno — sin validación de token) ──────
function _activarAccesoInterno(idInterno, correo, password) {
  idInterno = (idInterno||"").toString().trim();
  correo    = (correo   ||"").toString().trim().toLowerCase();
  password  = (password ||"Prisma2025*").toString().trim();

  if (!idInterno || !correo) return { status:"error", message:"ID y correo requeridos." };

  var hoja  = getHojaAccesoEmp();
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][0]||"").toString().trim() === idInterno) {
      hoja.getRange(i+1,2).setValue(correo);
      hoja.getRange(i+1,3).setValue(hashPassword(password));
      hoja.getRange(i+1,4).setValue("Activo");
      try {
        var nomU = obtenerNombreEmpleado(idInterno);
        enviarEmailAccesoEmpleado(nomU, correo, password);
        Logger.log("[Acceso] Email enviado a: " + correo);
      } catch(ex){ Logger.log("[Acceso] Error email: "+ex); }
      return { status:"success", message:"Acceso actualizado. Email enviado a "+correo+"." };
    }
  }

  // Nuevo registro
  hoja.appendRow([idInterno, correo, hashPassword(password), "Activo","","",""]);
  try {
    var nomN = obtenerNombreEmpleado(idInterno);
    enviarEmailAccesoEmpleado(nomN, correo, password);
    Logger.log("[Acceso] Nuevo acceso + email enviado a: " + correo);
  } catch(ex){ Logger.log("[Acceso] Error email nuevo: "+ex); }

  return { status:"success", message:"Acceso activado. Email enviado a "+correo+"." };
}

// ── Activar acceso de empleado (desde frontend RRHH — valida token) ──
function activarAccesoEmpleado(payload) {
  // Permitir llamada interna sin token
  if (payload.token) {
    var caller = autenticarRequest(payload);
    if (!caller) return { status:"error", message:"Sesión inválida." };
    registrarEvento(caller.email, caller.rol, "ACTIVAR_ACCESO_EMP",
      "Acceso activado para " + payload.idInterno + " (" + payload.correo + ")", "", "");
  }

  return _activarAccesoInterno(payload.idInterno, payload.correo, payload.password);
}

function obtenerNombreEmpleado(idInterno) {
  var sh = SpreadsheetApp.openById(ID_SHEET_BD).getSheetByName(NOMBRE_HOJA);
  var d  = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    if ((d[i][50]||"").toString().trim() === idInterno) return (d[i][4]||"").toString().trim();
  }
  return "Colaborador";
}

function enviarEmailAccesoEmpleado(nombre, correo, password) {
  MailApp.sendEmail({
    to:       correo,
    subject:  "Acceso al Portal de Empleados — RRHH Prisma",
    htmlBody: getPlantillaAccesoEmpleado(nombre, correo, password),
    name:     "RRHH Prisma"
  });
}

function getPlantillaAccesoEmpleado(nombre, correo, password) {
  return "<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    + "<style>body{margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}"
    + ".wrap{max-width:560px;margin:32px auto;padding:0 16px;}"
    + ".card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(37,99,235,.12);}"
    + ".hdr{background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:36px 32px;text-align:center;}"
    + ".hdr img{width:64px;height:64px;border-radius:16px;margin:0 auto 14px;display:block;}"
    + ".hdr h1{margin:0 0 4px;font-size:1.2rem;font-weight:800;color:#fff;}"
    + ".hdr p{margin:0;font-size:.8rem;color:rgba(255,255,255,.6);}"
    + ".body{padding:32px;}"
    + ".gr{font-size:1rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}"
    + ".txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 22px;}"
    + ".creds{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:20px;margin:0 0 24px;}"
    + ".cl{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#1d4ed8;margin:0 0 12px;}"
    + ".row{display:flex;padding:8px 0;border-bottom:1px solid #dbeafe;}"
    + ".row:last-child{border-bottom:none;}"
    + ".rl{font-size:.78rem;color:#6b7280;width:120px;flex-shrink:0;}"
    + ".rv{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}"
    + ".btn-wrap{text-align:center;margin:24px 0 0;}"
    + ".btn{display:inline-block;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff !important;text-decoration:none;font-weight:700;font-size:.9rem;padding:13px 36px;border-radius:12px;}"
    + ".ftr{background:#eff6ff;padding:18px 32px;text-align:center;border-top:1px solid #bfdbfe;}"
    + ".ftr p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}"
    + "@media(max-width:600px){.wrap{margin:0;padding:0;}.card{border-radius:0;}.hdr,.body,.ftr{padding:24px 20px;}}"
    + "</style></head><body>"
    + "<div class='wrap'><div class='card'>"
    + "<div class='hdr'>"
    + "<img src='https://rrhh-prisma.pages.dev/icon.png' alt='RRHH Prisma'>"
    + "<h1>Portal de Empleados</h1>"
    + "<p>RRHH Prisma - Acceso para Colaboradores</p>"
    + "</div>"
    + "<div class='body'>"
    + "<p class='gr'>Hola, " + nombre + "</p>"
    + "<p class='txt'>Se ha activado tu acceso al <strong>Portal de Empleados RRHH Prisma</strong>. "
    + "Desde aquí podrás participar en evaluaciones y consultar tu información.</p>"
    + "<div class='creds'><p class='cl'>Tus credenciales</p>"
    + "<div class='row'><span class='rl'>Correo</span><span class='rv'>" + correo + "</span></div>"
    + "<div class='row'><span class='rl'>Contraseña</span><span class='rv'>" + password + "</span></div>"
    + "</div>"
    + "<div class='btn-wrap'><a href='https://rrhh-prisma.pages.dev/empleado.html' class='btn'>Acceder al Portal del Empleado</a></div>"
    + "</div>"
    + "<div class='ftr'><p>Correo generado automaticamente por RRHH Prisma</p></div>"
    + "</div></div></body></html>";
}

// ── Migrar hoja USUARIOS para agregar col 13 ID INTERNO ──────
function migrarColumnasUsuarios() {
  var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
  var hoja = ss.getSheetByName(HOJA_USUARIOS);
  if (!hoja) { Logger.log("[Migrar] Hoja USUARIOS no existe."); return; }

  var headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var tieneIDInt = headers.some(function(h){ return h && h.toString().trim() === "ID INTERNO"; });

  if (!tieneIDInt) {
    var col = hoja.getLastColumn() + 1;
    hoja.getRange(1, col).setValue("ID INTERNO");
    hoja.getRange(1, col).setFontWeight("bold");
    Logger.log("[Migrar] Col ID INTERNO agregada en col " + col);
    return { status:"success", message:"Col ID INTERNO agregada en col "+col };
  } else {
    Logger.log("[Migrar] Col ID INTERNO ya existe.");
    return { status:"success", message:"Ya existe." };
  }
}

// ─── BUSCAR ID INTERNO POR NOMBRE (para vincular usuario RRHH con empleado) ───
function buscarUsuarioPorNombre(payload) {
  var nombre = (payload.nombre||"").toString().trim().toLowerCase();
  if (!nombre || nombre.length < 3) return { status:"error", message:"Nombre muy corto." };

  var ss      = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet   = ss.getSheetByName(NOMBRE_HOJA);
  var datos   = sheet.getDataRange().getValues();
  var colNom  = 4;   // E = NOMBRE DEL TRABAJADOR
  var colID   = 50;  // AY = ID INTERNO
  var colEmp  = 5;   // F = EMPRESA
  var colEst  = 2;   // C = ESTATUS

  function normalizar(s) {
    return s.toLowerCase()
      .replace(/[áäà]/g,"a").replace(/[éëè]/g,"e")
      .replace(/[íïì]/g,"i").replace(/[óöò]/g,"o")
      .replace(/[úüù]/g,"u").replace(/ñ/g,"n")
      .replace(/\s+/g," ").trim();
  }

  var nombreNorm = normalizar(nombre);
  var palabras   = nombreNorm.split(" ").filter(function(p){ return p.length > 2; });
  var candidatos = [];

  for (var i = 1; i < datos.length; i++) {
    var nomFila = normalizar((datos[i][colNom]||"").toString());
    if (!nomFila) continue;
    var matches = palabras.filter(function(p){ return nomFila.indexOf(p) !== -1; });
    var sim = palabras.length > 0 ? matches.length / palabras.length : 0;
    if (sim >= 0.5) {
      candidatos.push({
        idInterno:  (datos[i][colID] ||"").toString().trim(),
        nombre:     (datos[i][colNom]||"").toString().trim(),
        empresa:    (datos[i][colEmp]||"").toString().trim(),
        estatus:    (datos[i][colEst]||"").toString().trim(),
        sim:        sim
      });
    }
  }

  if (!candidatos.length) return { status:"error", message:"No se encontró ningún empleado con ese nombre." };

  // Priorizar activos y mayor similitud
  candidatos.sort(function(a,b){
    if(a.estatus==="Activo" && b.estatus!=="Activo") return -1;
    if(b.estatus==="Activo" && a.estatus!=="Activo") return 1;
    return b.sim - a.sim;
  });

  return { status:"success", candidatos: candidatos.slice(0,5) };
}

// ─── REENVIAR ACCESO PORTAL (desde drawer del expediente) ────
function reenviarAccesoEmpleado(payload) {
  var caller = autenticarRequest(payload);
  if (!caller) return { status:"error", message:"Sesión inválida." };

  var idInterno = (payload.idInterno||"").toString().trim();
  if (!idInterno) return { status:"error", message:"ID INTERNO requerido." };

  // Buscar correo de acceso en BD
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);
  var datos = sheet.getDataRange().getValues();
  var correo = "", noEmp = "", nombre = "";

  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][50]||"").toString().trim() !== idInterno) continue;
    correo = (datos[i][52]||"").toString().trim(); // BA CORREO ACCESO
    noEmp  = (datos[i][0] ||"").toString().trim();
    nombre = (datos[i][4] ||"").toString().trim();
    break;
  }

  if (!correo) return { status:"error", message:"El empleado no tiene CORREO ACCESO registrado. Agrégalo en el expediente." };

  var pass = "Prisma" + noEmp + "*";
  var r = _activarAccesoInterno(idInterno, correo, pass);

  return { status:"success", message:"Acceso activado y email enviado a " + correo + "." };
}

// ─── PRUEBA: Ver hash de una contraseña ──────────────────────
// Ejecutar en el editor para verificar que el hash coincide
function testHash() {
  var pass = "Prisma218*"; // cambia el número por el no. de empleado
  var h = hashPassword(pass);
  Logger.log("Password: " + pass);
  Logger.log("Hash: " + h);

  // Buscar en EMPLEADOS_ACCESO si existe este hash
  var hoja  = getHojaAccesoEmp();
  var datos = hoja.getDataRange().getValues();
  Logger.log("Registros en EMPLEADOS_ACCESO: " + (datos.length - 1));
  for (var i = 1; i < datos.length; i++) {
    Logger.log("Fila " + i + ": ID=" + datos[i][0] + " | Correo=" + datos[i][1]
      + " | Hash=" + datos[i][2] + " | Match=" + (datos[i][2] === h));
  }
}

// ─── CATÁLOGO DE EMPRESAS ─────────────────────────────────────────────────
// Devuelve el catálogo completo de la hoja EMPRESAS:
// { id, nombre (RAZÓN SOCIAL o EMPRESA), grupo (GRUPO / CORPORATIVO o GRUPO COMERCIAL) }
function obtenerCatalogoEmpresas() {
  try {
    var ss   = SpreadsheetApp.openById(ID_SHEET_BD);
    var hoja = ss.getSheetByName("EMPRESAS");
    if (!hoja) return { status:"error", message:"Hoja EMPRESAS no encontrada" };
    var data    = hoja.getDataRange().getValues();
    if (data.length < 2) return { status:"success", empresas:[] };
    var headers = data[0].map(function(h){ return h ? h.toString().trim() : ""; });
    // Soportar tanto "RAZÓN SOCIAL" / "EMPRESA" como nombre de empresa
    var idxRS    = headers.indexOf("RAZÓN SOCIAL")    !== -1 ? headers.indexOf("RAZÓN SOCIAL")    : headers.indexOf("EMPRESA");
    var idxGrupo = headers.indexOf("GRUPO / CORPORATIVO") !== -1 ? headers.indexOf("GRUPO / CORPORATIVO") : headers.indexOf("GRUPO COMERCIAL");
    var idxId    = headers.indexOf("ID");
    var empresas = [];
    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var nombre = idxRS    >= 0 ? (row[idxRS]    || "").toString().trim() : "";
      var grupo  = idxGrupo >= 0 ? (row[idxGrupo] || "").toString().trim() : "";
      var id     = idxId    >= 0 ? (row[idxId]    || "").toString().trim() : "";
      if (nombre || id) empresas.push({ id: id, nombre: nombre, grupo: grupo });
    }
    return { status:"success", empresas: empresas };
  } catch(e) {
    return { status:"error", message: e.toString() };
  }
}

// ─── FUNCIÓN TEMPORAL — FORZAR AUTORIZACIÓN DE DRIVE ─────────
// Ejecutar UNA SOLA VEZ desde el editor de Apps Script para
// forzar que aparezca la ventana de permisos de Drive.
// Después de autorizar, puedes borrar esta función.
function forzarAutorizacionDrive() {
  try {
    // Acceder a Drive, Spreadsheets y envío de correo para forzar todos los permisos
    var carpeta = DriveApp.getFolderById("1bZ7MvBYOmu67G2w0OMg3CHB3ZBqfnyy_");
    Logger.log("✅ Drive OK — Carpeta: " + carpeta.getName());

    var ss = SpreadsheetApp.openById("1RN8AsoH7yURqnPEljIYwl-aQvKrFIcXyopnadXF-VuM");
    Logger.log("✅ Sheets OK — Sheet: " + ss.getName());

    var archivos = carpeta.getFiles();
    var count = 0;
    while (archivos.hasNext() && count < 3) { archivos.next(); count++; }
    Logger.log("✅ Listado de archivos OK");

    Logger.log("✅ AUTORIZACIÓN COMPLETA — Ya puedes subir fotos desde la PWA.");
  } catch(e) {
    Logger.log("❌ Error: " + e.toString());
    Logger.log("→ Revisa que la cuenta tenga acceso a la carpeta de expedientes.");
  }
}

// ════════════════════════════════════════════════════════════════
// SISTEMA DE HISTORIAL DE CARRERA Y REINGRESOS
// ════════════════════════════════════════════════════════════════

var NOMBRE_HISTORIAL = "HISTORIAL";
var COL_ID_PERSONA   = 54; // BC = índice 54 (columna 55, 0-based: 54)

// Headers de la hoja HISTORIAL (exactamente como los creaste)
var HEADERS_HISTORIAL = [
  "ID_PERSONA","CURP","NOMBRE","EMPRESA","PUESTO","DEPARTAMENTO",
  "SUELDO_MENSUAL","FECHA_INGRESO","FECHA_BAJA","TIPO_SALIDA",
  "MOTIVO_SALIDA","MONTO_FINIQUITO","GRUPO_COMERCIAL","TIPO_INGRESO",
  "NO_EMPLEADO_HISTORICO"
];

// ── Obtener o crear ID_PERSONA único basado en CURP ──────────────
// Si dos registros tienen el mismo CURP → misma persona → mismo ID_PERSONA
function generarIdPersona(sheet, headers, data, fila0based) {
  var colCURP   = headers.indexOf("CURP");
  var colNombre = headers.indexOf("NOMBRE DEL TRABAJADOR");
  var curp = colCURP >= 0 ? (data[fila0based][colCURP] || "").toString().trim() : "";
  var nombre = colNombre >= 0 ? (data[fila0based][colNombre] || "").toString().trim() : "";

  // Buscar si ya existe un ID_PERSONA para este CURP en otra fila
  if (curp) {
    for (var i = 1; i < data.length; i++) {
      if (i === fila0based) continue;
      var otraCurp = colCURP >= 0 ? (data[i][colCURP] || "").toString().trim() : "";
      var otroId   = COL_ID_PERSONA < data[i].length ? (data[i][COL_ID_PERSONA] || "").toString().trim() : "";
      if (otraCurp === curp && otroId) return otroId;
    }
  }

  // Generar nuevo ID_PERSONA: P + timestamp corto + aleatorio
  return "P" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,4).toUpperCase();
}

// ── FUNCIÓN PRINCIPAL: Migración inicial de reingresos ───────────
// Llama esta función UNA SOLA VEZ desde el editor de Apps Script
// para poblar ID_PERSONA en BC y migrar históricos a HISTORIAL
function migrarHistorialInicial() {
  var ss    = SpreadsheetApp.openById(ID_SHEET_BD);
  var sheet = ss.getSheetByName(NOMBRE_HOJA);
  var data  = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h){ return h ? h.toString().replace(/[\n\r]/g," ").trim() : ""; });

  // Verificar que columna BC existe
  if (data[0].length < 55) {
    Logger.log("ERROR: La columna BC (ID_PERSONA) no existe. Agrégala primero.");
    return { status: "error", message: "Falta columna BC (ID_PERSONA) en BASE DE DATOS" };
  }

  var colCURP   = headers.indexOf("CURP");
  var colNombre = headers.indexOf("NOMBRE DEL TRABAJADOR");
  var colEstatus = headers.indexOf("ESTATUS");

  Logger.log("[Migrar] Iniciando migración. Total filas: " + (data.length - 1));

  // Paso 1: Agrupar filas por CURP
  var grupos = {}; // curp/clave → [índices de fila (0-based, incluyendo header)]
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var curp   = colCURP >= 0 ? (data[i][colCURP] || "").toString().trim() : "";
    var nombre = colNombre >= 0 ? (data[i][colNombre] || "").toString().trim() : "";
    var clave  = curp || nombre.toLowerCase().replace(/\s+/g,"");
    if (!clave) continue;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(i);
  }

  // Paso 2: Para cada grupo, asignar ID_PERSONA compartido
  var idPersonaMap = {}; // índice_fila → ID_PERSONA
  Object.keys(grupos).forEach(function(clave) {
    var filas = grupos[clave];
    // Buscar si alguna ya tiene ID_PERSONA
    var idExistente = "";
    filas.forEach(function(fi) {
      var idActual = COL_ID_PERSONA < data[fi].length ? (data[fi][COL_ID_PERSONA] || "").toString().trim() : "";
      if (idActual) idExistente = idActual;
    });
    // Generar uno nuevo si no existe
    if (!idExistente) {
      idExistente = "P" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,4).toUpperCase();
      Utilities.sleep(2); // evitar colisiones en generación rápida
    }
    filas.forEach(function(fi) { idPersonaMap[fi] = idExistente; });
  });

  // Paso 3: Escribir ID_PERSONA en columna BC del Sheet
  var escritos = 0;
  Object.keys(idPersonaMap).forEach(function(fi) {
    var fila = parseInt(fi);
    var idActual = COL_ID_PERSONA < data[fila].length ? (data[fila][COL_ID_PERSONA] || "").toString().trim() : "";
    if (!idActual) { // solo escribir si está vacío
      sheet.getRange(fila + 1, COL_ID_PERSONA + 1).setValue(idPersonaMap[fila]);
      escritos++;
    }
  });
  Logger.log("[Migrar] ID_PERSONA escritos en BC: " + escritos);

  // Paso 4: Migrar registros históricos (Baja) de personas con múltiples registros
  var hojaHist = ss.getSheetByName(NOMBRE_HISTORIAL);
  if (!hojaHist) {
    Logger.log("ERROR: No existe la hoja HISTORIAL. Créala primero.");
    return { status: "error", message: "No existe la hoja HISTORIAL" };
  }

  var migraciones = 0;
  Object.keys(grupos).forEach(function(clave) {
    var filas = grupos[clave];
    if (filas.length < 2) return; // persona sin reingresos, nada que migrar

    // Ordenar por fecha de ingreso
    filas.sort(function(a, b) {
      var fa = parseFloat(data[a][1]) || 0;
      var fb = parseFloat(data[b][1]) || 0;
      return fa - fb;
    });

    // Todos excepto el más reciente van al historial
    var filasMigrables = filas.slice(0, filas.length - 1);
    filasMigrables.forEach(function(fi) {
      var row = data[fi];
      var idPersona = idPersonaMap[fi] || "";

      // Verificar si ya está en HISTORIAL (buscar por ID_PERSONA + FECHA_INGRESO)
      var histData = hojaHist.getDataRange().getValues();
      var yaExiste = false;
      for (var h = 1; h < histData.length; h++) {
        if ((histData[h][0] || "").toString() === idPersona &&
            (histData[h][7] || "").toString() === (row[1] || "").toString()) {
          yaExiste = true; break;
        }
      }
      if (yaExiste) return;

      // Insertar en HISTORIAL
      var filaHist = [
        idPersona,                                                    // ID_PERSONA
        colCURP >= 0 ? (row[colCURP] || "") : "",                    // CURP
        colNombre >= 0 ? (row[colNombre] || "") : "",                 // NOMBRE
        (row[5] || ""),                                               // EMPRESA
        (row[7] || ""),                                               // PUESTO
        (row[6] || ""),                                               // DEPARTAMENTO
        (row[8] || ""),                                               // SUELDO_MENSUAL
        (row[1] || ""),                                               // FECHA_INGRESO (serial)
        (row[11] || ""),                                              // FECHA_BAJA (serial)
        (row[12] || ""),                                              // TIPO_SALIDA
        (row[13] || ""),                                              // MOTIVO_SALIDA
        (row[14] || ""),                                              // MONTO_FINIQUITO
        (row[53] || ""),                                              // GRUPO_COMERCIAL (BB)
        (row[36] || ""),                                              // TIPO_INGRESO (AK)
        (row[0] || "")                                                // NO_EMPLEADO_HISTORICO
      ];
      hojaHist.appendRow(filaHist);
      migraciones++;
      Logger.log("[Migrar] Migrado a HISTORIAL: " + (row[colNombre]||"") + " (Ingreso: " + row[1] + ")");
    });
  });

  Logger.log("[Migrar] Migración completada. Registros en HISTORIAL: " + migraciones);
  SpreadsheetApp.flush();
  return {
    status: "success",
    message: "Migración completada. ID_PERSONA escritos: " + escritos + ". Registros en HISTORIAL: " + migraciones
  };
}

// ── Obtener historial de carrera de una persona ──────────────────
function obtenerHistorialPersona(payload) {
  try {
    var idPersona = (payload.idPersona || "").toString().trim();
    if (!idPersona) return { status: "error", message: "Falta idPersona" };

    var ss       = SpreadsheetApp.openById(ID_SHEET_BD);
    var hojaHist = ss.getSheetByName(NOMBRE_HISTORIAL);
    if (!hojaHist) return { status: "success", historial: [], movimientos: [] };

    var data    = hojaHist.getDataRange().getValues();
    if (data.length < 2) return { status: "success", historial: [], movimientos: [] };

    var epoch   = new Date(Date.UTC(1899, 11, 30));
    var historial = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if ((row[0] || "").toString().trim() !== idPersona) continue;

      // Convertir seriales a string DD/MM/YYYY para el frontend
      var fmtSerial = function(serial) {
        if (!serial || serial === "") return "";
        var n = parseFloat(serial);
        if (isNaN(n)) return serial.toString();
        var d = new Date(epoch.getTime() + n * 86400000);
        return String(d.getUTCDate()).padStart(2,"0") + "/" +
               String(d.getUTCMonth()+1).padStart(2,"0") + "/" +
               d.getUTCFullYear();
      };

      historial.push({
        idPersona:    (row[0] || "").toString(),
        curp:         (row[1] || "").toString(),
        nombre:       (row[2] || "").toString(),
        empresa:      (row[3] || "").toString(),
        puesto:       (row[4] || "").toString(),
        departamento: (row[5] || "").toString(),
        sueldo:       (row[6] || ""),
        fechaIngreso: fmtSerial(row[7]),
        fechaBaja:    fmtSerial(row[8]),
        tipoSalida:   (row[9]  || "").toString(),
        motivoSalida: (row[10] || "").toString(),
        montoFiniquito: (row[11] || ""),
        grupoComercial: (row[12] || "").toString(),
        tipoIngreso:  (row[13] || "").toString(),
        noEmpleado:   (row[14] || "").toString()
      });
    }

    // Obtener también movimientos internos (cambios de puesto/sueldo)
    // desde la hoja MOVIMIENTOS si existe
    var movimientos = [];
    var hojaMovs = ss.getSheetByName("MOVIMIENTOS");
    if (hojaMovs) {
      var movData = hojaMovs.getDataRange().getValues();
      for (var m = 1; m < movData.length; m++) {
        if ((movData[m][0] || "").toString().trim() !== idPersona) continue;
        movimientos.push({
          fecha:      fmtSerial(movData[m][1]),
          tipo:       (movData[m][2] || "").toString(),
          descripcion:(movData[m][3] || "").toString(),
          valorAntes: (movData[m][4] || "").toString(),
          valorDespues:(movData[m][5] || "").toString(),
          registradoPor:(movData[m][6] || "").toString()
        });
      }
    }

    return { status: "success", historial: historial, movimientos: movimientos };
  } catch(e) {
    return { status: "error", message: e.toString() };
  }
}

// ── Registrar movimiento de carrera (aumento, cambio de puesto) ──
function registrarMovimiento(payload) {
  try {
    var idPersona = (payload.idPersona || "").toString().trim();
    var tipo      = (payload.tipo || "").toString().trim(); // "Aumento", "Cambio de Puesto", etc.
    var desc      = (payload.descripcion || "").toString();
    var valAntes  = (payload.valorAntes || "").toString();
    var valDespues= (payload.valorDespues || "").toString();
    var registradoPor = (payload.registradoPor || "").toString();

    if (!idPersona || !tipo) return { status: "error", message: "Faltan datos del movimiento" };

    var ss = SpreadsheetApp.openById(ID_SHEET_BD);
    var hojaMovs = ss.getSheetByName("MOVIMIENTOS");

    // Crear hoja MOVIMIENTOS si no existe
    if (!hojaMovs) {
      hojaMovs = ss.insertSheet("MOVIMIENTOS");
      hojaMovs.getRange(1,1,1,7).setValues([[
        "ID_PERSONA","FECHA","TIPO","DESCRIPCION","VALOR_ANTES","VALOR_DESPUES","REGISTRADO_POR"
      ]]);
      hojaMovs.getRange(1,1,1,7).setFontWeight("bold").setBackground("#f1f5f9");
    }

    var epoch  = new Date(Date.UTC(1899,11,30));
    var hoy    = new Date();
    var serial = Math.round((new Date(Date.UTC(hoy.getFullYear(),hoy.getMonth(),hoy.getDate())).getTime() - epoch.getTime()) / 86400000);

    hojaMovs.appendRow([idPersona, serial, tipo, desc, valAntes, valDespues, registradoPor]);
    SpreadsheetApp.flush();

    return { status: "success", message: "Movimiento registrado" };
  } catch(e) {
    return { status: "error", message: e.toString() };
  }
}

// ── Asignar ID_PERSONA automáticamente en nuevas altas ──────────
// Llamar desde registrarAlta después de crear el registro
function asignarIdPersonaNuevo(sheet, filaSheet, curp, nombre) {
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h){ return h ? h.toString().replace(/[\n\r]/g," ").trim() : ""; });
  var colCURP = headers.indexOf("CURP");

  // Si tiene CURP, buscar si ya existe un ID_PERSONA para esa persona
  if (curp) {
    for (var i = 1; i < data.length; i++) {
      if (i === filaSheet - 1) continue;
      var otraCurp = colCURP >= 0 ? (data[i][colCURP] || "").toString().trim() : "";
      var otroId   = COL_ID_PERSONA < data[i].length ? (data[i][COL_ID_PERSONA] || "").toString().trim() : "";
      if (otraCurp === curp && otroId) {
        sheet.getRange(filaSheet, COL_ID_PERSONA + 1).setValue(otroId);
        return otroId;
      }
    }
  }
  // Persona nueva: generar ID_PERSONA único
  var newId = "P" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,4).toUpperCase();
  sheet.getRange(filaSheet, COL_ID_PERSONA + 1).setValue(newId);
  return newId;
}


// ─── REPARAR EVALUACIONES — agregar autoevaluaciones faltantes ─
function repararEvaluaciones() {
  var ss       = SpreadsheetApp.openById(ID_SHEET_BD);
  var hojaEv   = ss.getSheetByName(HOJA_EVALUACIONES);
  var hojaPr   = ss.getSheetByName(HOJA_PROCESOS_EVAL);
  if (!hojaEv || !hojaPr) { Logger.log("Hojas no encontradas."); return; }

  var datosEv = hojaEv.getDataRange().getValues();
  var datosPr = hojaPr.getDataRange().getValues();

  // Mapa de evaluaciones existentes
  var exist = {};
  for (var i = 1; i < datosEv.length; i++) {
    if (!datosEv[i][0]) continue;
    var key = datosEv[i][1]+"_"+datosEv[i][2]+"_"+datosEv[i][5]; // proc_evaluado_rol
    exist[key] = true;
  }

  var agregadas = 0;
  for (var p = 1; p < datosPr.length; p++) {
    if (!datosPr[p][0]) continue;
    var idProc  = datosPr[p][0].toString().trim();
    var tipo    = datosPr[p][2].toString().trim();
    var estatus = datosPr[p][3].toString().trim();
    if (estatus !== "Activo") continue;
    if (tipo !== "360" && tipo !== "competencias") continue;

    // Para cada evaluado con rol "jefe", agregar autoevaluación si falta
    for (var e = 1; e < datosEv.length; e++) {
      if (!datosEv[e][0]) continue;
      if (datosEv[e][1].toString().trim() !== idProc) continue;
      if (datosEv[e][5].toString().trim() !== "jefe") continue;

      var idEval  = datosEv[e][2].toString().trim();
      var nomEval = datosEv[e][3].toString().trim();
      var keyAuto = idProc+"_"+idEval+"_autoevaluacion";

      if (!exist[keyAuto]) {
        var cont  = hojaEv.getLastRow();
        var newId = "EV"+("00000"+cont).slice(-5);
        hojaEv.appendRow([newId, idProc, idEval, nomEval, idEval, "autoevaluacion", "Pendiente","",""]);
        exist[keyAuto] = true;
        agregadas++;
        Logger.log("[Reparar] Autoevaluacion agregada: "+idEval+" en "+idProc);
      }
    }
  }
  Logger.log("Total autoevaluaciones agregadas: "+agregadas);
  return { status:"success", autoevaluacionesAgregadas: agregadas };
}
// ─── USO DE ALMACENAMIENTO DE DRIVE ─────────────────────────
function getDriveUsage() {
  try {
    var usedBytes  = DriveApp.getStorageUsed();
    var limitBytes = DriveApp.getStorageLimit();
    var freeBytes  = Math.max(0, limitBytes - usedBytes);
    var gb = 1024 * 1024 * 1024;
    return {
      status:    'success',
      usedBytes:  usedBytes,  limitBytes: limitBytes,  freeBytes: freeBytes,
      usedGB:     Math.round(usedBytes  / gb * 100) / 100,
      limitGB:    Math.round(limitBytes / gb * 100) / 100,
      freeGB:     Math.round(freeBytes  / gb * 100) / 100,
      pct:        Math.min(100, Math.round(usedBytes / limitBytes * 1000) / 10)
    };
  } catch(e) { return { status:'error', msg: e.toString() }; }
}
