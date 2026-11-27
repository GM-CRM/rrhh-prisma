// ============================================================
//  Reglas de lectura de documentos — copiadas SIN CAMBIOS de Código.gs (GAS):
//  extraerCamposDeTexto · obtenerInstruccionPorTipo · limpiarYRetornar
//  (Logger.log de GAS → console.log)
// ============================================================
var Logger = { log: function (m) { console.log(m); } };

export function extraerCamposDeTexto(texto) {
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

export function obtenerInstruccionPorTipo(tipo, texto) {
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

export function limpiarYRetornar(resultado) {
  if (resultado && resultado.datos) {
    ['fechaNacimiento','genero','lugarNacimiento','nacionalidad',
     'estadoCivil','telefonoPersonal','correoElectronico'].forEach(function(k){
      delete resultado.datos[k];
    });
  }
  return resultado;
}
