// ============================================================
//  Contratos — funciones de texto copiadas TEXTUALMENTE de Código.gs
//  (mayúsculas por contexto, fecha larga, número a letras), para que el
//  contrato salga idéntico al de GAS. Única corrección: numeroALetrasMoneda
//  (F37) ahora aplica el apócope ("veintiún pesos", "treinta y un mil") y ya no
//  escribe "ochocientos  y seis" cuando la decena es 0, ver abajo.
// ============================================================
function _esEmpresaUrbanThink(nombreEmpresa) {
  return /URBAN\s*THINK/i.test((nombreEmpresa || "").toString());
}

function _esTipoObraDeterminada(tipoIngreso) {
  return /obra/i.test((tipoIngreso || "").toString());
}

function _usaPlantillaObraUrbanThink(empresa, tipoIngreso) {
  return _esEmpresaUrbanThink(empresa) && _esTipoObraDeterminada(tipoIngreso);
}

var _MINUSC_TITULO = {'de':1,'del':1,'la':1,'las':1,'los':1,'y':1,'e':1,'en':1,
  'a':1,'con':1,'para':1,'por':1,'un':1,'una':1,'al':1,'el':1};

// Siglas/abreviaturas que deben conservarse en mayúscula sin importar la
// posición (para que "S.L.P", "CP.", "RFC" no terminen como "S.l.p").
var _SIGLAS_PRESERVAR = {'cp':1,'rfc':1,'curp':1,'nss':1,'imss':1,'infonavit':1,
  'sat':1,'ine':1,'sa':1,'cv':1,'slp':1};

// "GENARO CODINA, #116, COL. ESTADIO" → "Genaro Codina, #116, Col. Estadio"
// Uso: nombres propios, domicilios — cosas que se leen como título.
function _tituloCase(texto) {
  if (!texto) return "";
  var i = 0;
  return texto.toString().toLowerCase().replace(/[a-záéíóúñü]+/gi, function(palabra) {
    i++;
    if (_SIGLAS_PRESERVAR[palabra]) return palabra.toUpperCase();
    if (i > 1 && _MINUSC_TITULO[palabra]) return palabra;
    return palabra.charAt(0).toUpperCase() + palabra.slice(1);
  });
}

// "PLANIFICAR, DIRIGIR Y COORDINAR..." → "Planificar, dirigir y coordinar..."
// Uso: prosa libre (funciones del puesto, descanso diario) — mayúscula
// solo al inicio del texto y después de cada punto/¡/¿, resto en minúsculas.
function _oracionCase(texto) {
  if (!texto) return "";
  var t = texto.toString().toLowerCase().trim();
  t = t.replace(/(^\s*[a-záéíóúñü]|[.!?]\s+[a-záéíóúñü])/g, function(m){ return m.toUpperCase(); });
  return t;
}

// Limpia strings tipo "$8,000.00" antes de convertir a número
function _limpiarNumero(valor) {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  var limpio = valor.toString().replace(/[^0-9.\-]/g, "");
  return parseFloat(limpio) || 0;
}

function formatearFechaLarga(valor) {
  if (!valor) return "";
  var fecha;
  if (valor instanceof Date) {
    fecha = valor;
  } else if (typeof valor === "number") {
    var epocaSheets = new Date(Date.UTC(1899, 11, 30));
    fecha = new Date(epocaSheets.getTime() + valor * 86400000);
  } else {
    var partes = valor.toString().split(/[-\/]/);
    if (partes.length === 3) {
      if (partes[0].length === 4) {
        fecha = new Date(Date.UTC(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2])));
      } else {
        fecha = new Date(Date.UTC(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0])));
      }
    } else {
      return "";
    }
  }
  var meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
  var dia = fecha.getUTCDate().toString().padStart(2, "0");
  var mes = meses[fecha.getUTCMonth()];
  var anio = fecha.getUTCFullYear();
  return dia + " DE " + mes + " DEL " + anio;
}

function numeroALetrasMoneda(numero) {
  var entero   = Math.floor(numero);
  var centavos = Math.round((numero - entero) * 100);
  // F37: GAS escribía "veintiuno pesos" / "treinta y uno pesos" / "veintiuno mil".
  // En español va "veintiún pesos", "treinta y un pesos", "veintiún mil".
  var letrasEntero = _apocope(_numeroALetras(entero));
  if (/(mill\u00f3n|millones)$/.test(letrasEntero)) letrasEntero += " de";   // "un millón de pesos"
  var centavosTxt = (centavos < 10 ? "0" : "") + centavos;
  return _capitalizar(letrasEntero) + " pesos " + centavosTxt + "/100";
}

function _capitalizar(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _numeroALetras(n) {
  if (n === 0) return "cero";
  var UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  var DECENAS  = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  var ESPECIALES = { 11:"once",12:"doce",13:"trece",14:"catorce",15:"quince",16:"dieciséis",17:"diecisiete",18:"dieciocho",19:"diecinueve",
                     21:"veintiuno",22:"veintidós",23:"veintitrés",24:"veinticuatro",25:"veinticinco",26:"veintiséis",27:"veintisiete",28:"veintiocho",29:"veintinueve" };
  var CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

  function convertirGrupo(num) {
    if (num === 0) return "";
    if (num === 100) return "cien";
    if (ESPECIALES[num]) return ESPECIALES[num];
    var c = Math.floor(num / 100);
    var resto = num % 100;
    var partes = [];
    if (c > 0) partes.push(CENTENAS[c]);
    if (resto > 0) {
      if (ESPECIALES[resto]) {
        partes.push(ESPECIALES[resto]);
      } else {
        var d = Math.floor(resto / 10);
        var u = resto % 10;
        if (d === 1 && u > 0) {
          partes.push(ESPECIALES[10 + u]);
        } else {
          // F37: con decena 0 (101, 205, 806…) GAS escribía "ochocientos  y seis".
          var textoDecena = d > 0 ? DECENAS[d] : "";
          if (u > 0) textoDecena += (d > 0 ? " y " : "") + UNIDADES[u];
          partes.push(textoDecena);
        }
      }
    }
    return partes.join(" ");
  }

  if (n < 1000) return convertirGrupo(n);

  if (n < 1000000) {
    var miles = Math.floor(n / 1000);
    var resto = n % 1000;
    var textoMiles = (miles === 1) ? "mil" : _apocope(convertirGrupo(miles)) + " mil";
    return resto > 0 ? textoMiles + " " + convertirGrupo(resto) : textoMiles;
  }

  var millones = Math.floor(n / 1000000);
  var restoMillones = n % 1000000;
  var textoMillones = (millones === 1) ? "un millón" : _apocope(convertirGrupo(millones)) + " millones";
  var textoResto = restoMillones > 0 ? " " + _numeroALetras(restoMillones) : "";
  return textoMillones + textoResto;
}

// "veintiuno" → "veintiún", "...y uno" → "...y un", "ciento uno" → "ciento un" (solo al final)
function _apocope(t) {
  return (t || "").replace(/veintiuno$/, "veinti\u00fan").replace(/(^|\s)uno$/, "$1un");
}

export {
  _esEmpresaUrbanThink, _esTipoObraDeterminada, _usaPlantillaObraUrbanThink,
  _tituloCase, _oracionCase, _limpiarNumero, formatearFechaLarga, numeroALetrasMoneda,
};
