// ============================================================
//  NOM-035-STPS-2018 — datos oficiales y calificación
//  Copia TEXTUAL de NOM035.gs (GAS, v4 2026-08-06): textos del DOF
//  (Guías I, II, III y V), escala, rangos, plan de acción, colores y
//  las funciones puras de calificación. No usa nada de Google, así que
//  se conserva igual para que los resultados sean idénticos.
// ============================================================
// Criterio interno para cuestionarios parciales (ver punto 3).
// El DOF no da tablas para el caso en que un trabajador no
// responde los bloques condicionales. Con `true`, los cortes del
// dominio se escalan a la proporción de items que sí aplicaron;
// con `false` se usa el corte tal cual (lo que subestima el
// riesgo de quien no es jefe ni atiende clientes).
var NOM035_AJUSTAR_RANGO_PARCIAL = true;

// Debajo de este numero de trabajadores el centro no requiere
// cuestionario de factores de riesgo psicosocial (numeral 2,
// inciso a: hasta 15 trabajadores solo obligaciones documentales
// y Guia I).
var NOM035_MIN_TRABAJADORES_FRP = 16;

var NOM035_ESCALA = [
  {valor:0,etiqueta:"Siempre",puntajeDirecta:4,puntajeInversa:0},
  {valor:1,etiqueta:"Casi siempre",puntajeDirecta:3,puntajeInversa:1},
  {valor:2,etiqueta:"Algunas veces",puntajeDirecta:2,puntajeInversa:2},
  {valor:3,etiqueta:"Casi nunca",puntajeDirecta:1,puntajeInversa:3},
  {valor:4,etiqueta:"Nunca",puntajeDirecta:0,puntajeInversa:4}
];

// Las llaves de dominio/categoria van SIN acentos y deben coincidir
// caracter por caracter con las que usan los items de abajo.
var NOM035_RANGOS = {
  guia2: {
    dominios: {"Condiciones en el ambiente de trabajo":[3,5,7,9],"Carga de trabajo":[12,16,20,24],"Falta de control sobre el trabajo":[5,8,11,14],"Jornada de trabajo":[1,2,4,6],"Interferencia en la relacion trabajo-familia":[1,2,4,6],"Liderazgo":[3,5,8,11],"Relaciones en el trabajo":[5,8,11,14],"Violencia":[7,10,13,16]},
    categorias: {"Ambiente de trabajo":[3,5,7,9],"Factores propios de la actividad":[10,20,30,40],"Organizacion del tiempo de trabajo":[4,6,9,12],"Liderazgo y relaciones en el trabajo":[10,18,28,38]},
    total: [20,45,70,90]
  },
  guia3: {
    dominios: {"Condiciones en el ambiente de trabajo":[5,9,11,14],"Carga de trabajo":[15,21,27,37],"Falta de control sobre el trabajo":[11,16,21,25],"Jornada de trabajo":[1,2,4,6],"Interferencia en la relacion trabajo-familia":[4,6,8,10],"Liderazgo":[9,12,16,20],"Relaciones en el trabajo":[10,13,17,21],"Violencia":[7,10,13,16],"Reconocimiento del desempeno":[6,10,14,18],"Insuficiente sentido de pertenencia e inestabilidad":[4,6,8,10]},
    categorias: {"Ambiente de trabajo":[5,9,11,14],"Factores propios de la actividad":[15,30,45,60],"Organizacion del tiempo de trabajo":[5,7,10,13],"Liderazgo y relaciones en el trabajo":[14,29,42,58],"Entorno organizacional":[10,14,18,23]},
    total: [50,75,99,140]
  }
};

var NOM035_PLAN_ACCION = {
  "Nulo":"El riesgo resulta despreciable; no se requieren medidas adicionales.",
  "Bajo":"Es necesaria una mayor difusi\u00f3n de la pol\u00edtica de prevenci\u00f3n de riesgos psicosociales.",
  "Medio":"Se requiere revisar la pol\u00edtica de prevenci\u00f3n y reforzar mediante Programa de intervenci\u00f3n.",
  "Alto":"Se requiere Programa de intervenci\u00f3n con an\u00e1lisis por categor\u00eda/dominio y evaluaci\u00f3n espec\u00edfica.",
  "Muy alto":"Se requiere Programa de intervenci\u00f3n con evaluaciones espec\u00edficas (burnout, mobbing) y campa\u00f1as de sensibilizaci\u00f3n."
};

var NOM035_COLORES = {
  "Nulo":{bg:"#d1fae5",text:"#065f46",hex:"#10b981"},
  "Bajo":{bg:"#dbeafe",text:"#1e40af",hex:"#3b82f6"},
  "Medio":{bg:"#fef9c3",text:"#854d0e",hex:"#eab308"},
  "Alto":{bg:"#fed7aa",text:"#9a3412",hex:"#f97316"},
  "Muy alto":{bg:"#fecaca",text:"#991b1b",hex:"#ef4444"}
};

// --- GUIA I: texto literal del DOF -----------------------------------
// La Seccion I es una sola pregunta con 6 incisos; cada inciso lleva su
// propio Si/No. El enunciado que los encabeza viaja en `instruccion`.
var NOM035_GUIA1 = {
  titulo:"Gu\u00eda de Referencia I \u2014 Acontecimientos traum\u00e1ticos severos",
  descripcion:"Cuestionario para identificar a los trabajadores que fueron sujetos a acontecimientos traum\u00e1ticos severos. CONFIDENCIAL.",
  confidencial:true,
  secciones:[
    {
      id:"seccion1",
      titulo:"I. Acontecimiento traum\u00e1tico severo",
      instruccion:"\u00bfHa presenciado o sufrido alguna vez, durante o con motivo del trabajo un acontecimiento como los siguientes:",
      preguntas:[
        {id:"s1_1",texto:"\u00bfAccidente que tenga como consecuencia la muerte, la p\u00e9rdida de un miembro o una lesi\u00f3n grave?"},
        {id:"s1_2",texto:"\u00bfAsaltos?"},
        {id:"s1_3",texto:"\u00bfActos violentos que derivaron en lesiones graves?"},
        {id:"s1_4",texto:"\u00bfSecuestro?"},
        {id:"s1_5",texto:"\u00bfAmenazas?"},
        {id:"s1_6",texto:"\u00bfCualquier otro que ponga en riesgo su vida o salud, y/o la de otras personas?"}
      ]
    },
    {
      id:"seccion2",
      titulo:"II. Recuerdos persistentes sobre el acontecimiento",
      instruccion:"Durante el \u00faltimo mes:",
      preguntas:[
        {id:"s2_1",texto:"\u00bfHa tenido recuerdos recurrentes sobre el acontecimiento que le provocan malestares?"},
        {id:"s2_2",texto:"\u00bfHa tenido sue\u00f1os de car\u00e1cter recurrente sobre el acontecimiento, que le producen malestar?"}
      ]
    },
    {
      id:"seccion3",
      titulo:"III. Esfuerzo por evitar circunstancias parecidas o asociadas al acontecimiento",
      instruccion:"Durante el \u00faltimo mes:",
      preguntas:[
        {id:"s3_1",texto:"\u00bfSe ha esforzado por evitar todo tipo de sentimientos, conversaciones o situaciones que le puedan recordar el acontecimiento?"},
        {id:"s3_2",texto:"\u00bfSe ha esforzado por evitar todo tipo de actividades, lugares o personas que motivan recuerdos del acontecimiento?"},
        {id:"s3_3",texto:"\u00bfHa tenido dificultad para recordar alguna parte importante del evento?"},
        {id:"s3_4",texto:"\u00bfHa disminuido su inter\u00e9s en sus actividades cotidianas?"},
        {id:"s3_5",texto:"\u00bfSe ha sentido usted alejado o distante de los dem\u00e1s?"},
        {id:"s3_6",texto:"\u00bfHa notado que tiene dificultad para expresar sus sentimientos?"},
        {id:"s3_7",texto:"\u00bfHa tenido la impresi\u00f3n de que su vida se va a acortar, que va a morir antes que otras personas o que tiene un futuro limitado?"}
      ]
    },
    {
      id:"seccion4",
      titulo:"IV. Afectaci\u00f3n",
      instruccion:"Durante el \u00faltimo mes:",
      preguntas:[
        {id:"s4_1",texto:"\u00bfHa tenido usted dificultades para dormir?"},
        {id:"s4_2",texto:"\u00bfHa estado particularmente irritable o le han dado arranques de coraje?"},
        {id:"s4_3",texto:"\u00bfHa tenido dificultad para concentrarse?"},
        {id:"s4_4",texto:"\u00bfHa estado nervioso o constantemente en alerta?"},
        {id:"s4_5",texto:"\u00bfSe ha sobresaltado f\u00e1cilmente por cualquier cosa?"}
      ]
    }
  ]
};


function _nom035NivelRiesgo(p, c) {
  if (p < c[0]) return "Nulo";
  if (p < c[1]) return "Bajo";
  if (p < c[2]) return "Medio";
  if (p < c[3]) return "Alto";
  return "Muy alto";
}

function _nom035CalificarGuia1(resp) {
  var r = resp || {};
  var s1 = false;
  for (var i = 1; i <= 6; i++) { if ((r["s1_"+i]||"").toString().trim().toLowerCase() === "si") { s1 = true; break; } }
  if (!s1) return { requiereValoracion: false, motivo: "Seccion I negativa" };
  var s2 = false;
  for (var i = 1; i <= 2; i++) { if ((r["s2_"+i]||"").toString().trim().toLowerCase() === "si") { s2 = true; break; } }
  var c3 = 0; for (var i = 1; i <= 7; i++) { if ((r["s3_"+i]||"").toString().trim().toLowerCase() === "si") c3++; }
  var sec3 = c3 >= 3;
  var c4 = 0; for (var i = 1; i <= 5; i++) { if ((r["s4_"+i]||"").toString().trim().toLowerCase() === "si") c4++; }
  var sec4 = c4 >= 2;
  var req = s1 && (s2 || sec3 || sec4);
  return { requiereValoracion: req, motivo: req ? "Criterios cumplidos" : "Sin criterios adicionales", detalle: {seccion1:s1,seccion2:s2,seccion3:sec3,seccion4:sec4} };
}

/* Cuenta cuántos ítems tiene cada dominio y cada categoría en el
   cuestionario COMPLETO. Se calcula leyendo la definición oficial,
   no con números escritos a mano: si algún día se edita el
   cuestionario desde el editor admin, esto sigue cuadrando. */
function _nom035ConteoEsperado(tipoGuia) {
  var cuest = _nom035CuestionarioDefault(tipoGuia);
  var porDominio = {}, porCategoria = {}, total = 0;
  (cuest.items || []).forEach(function(it) {
    var d = (it.dominio || "").trim();
    var c = (it.categoria || "").trim();
    if (d) porDominio[d] = (porDominio[d] || 0) + 1;
    if (c) porCategoria[c] = (porCategoria[c] || 0) + 1;
    total++;
  });
  return { dominios: porDominio, categorias: porCategoria, total: total };
}

/* Escala los cortes de un rango a la proporción de ítems que
   realmente se respondieron.
   Ejemplo: "Relaciones en el trabajo" tiene 6 ítems y su corte de
   Alto es 11. Si el trabajador no es jefe solo contesta 3, así que
   el corte se recalcula a 11 * (3/6) = 5.5. Sin esto, su puntaje
   máximo posible (12) nunca alcanzaría el corte original. */
function _nom035EscalarRango(cortes, respondidos, esperados) {
  if (!NOM035_AJUSTAR_RANGO_PARCIAL) return cortes;
  if (!esperados || !respondidos) return cortes;
  if (respondidos >= esperados) return cortes;   // completo: sin ajuste
  var f = respondidos / esperados;
  return cortes.map(function(c) { return c * f; });
}

function _nom035CalificarGuiaFRP(items, tipoGuia) {
  var rangos = NOM035_RANGOS[tipoGuia];
  if (!rangos) return { error: "Tipo no reconocido" };

  var esperado = _nom035ConteoEsperado(tipoGuia);

  var pD = {}, pC = {}, tot = 0;
  var nD = {}, nC = {}, nTot = 0;   // cuántos ítems se respondieron

  for (var i = 0; i < items.length; i++) {
    var it = items[i], ri = parseInt(it.respuesta);
    if (isNaN(ri) || ri < 0 || ri > 4) continue;
    var dir = (it.direccion || "directa").toLowerCase();
    var pt = (dir === "inversa") ? NOM035_ESCALA[ri].puntajeInversa : NOM035_ESCALA[ri].puntajeDirecta;
    tot += pt; nTot++;
    var d = (it.dominio || "").trim(), c = (it.categoria || "").trim();
    if (d) { pD[d] = (pD[d] || 0) + pt; nD[d] = (nD[d] || 0) + 1; }
    if (c) { pC[c] = (pC[c] || 0) + pt; nC[c] = (nC[c] || 0) + 1; }
  }

  var huboAjuste = false;

  var rD = {};
  Object.keys(pD).forEach(function(d) {
    var co = rangos.dominios[d];
    if (!co) { rD[d] = {puntaje:pD[d], nivel:"Sin rango", color:{}}; return; }
    var esp = esperado.dominios[d] || 0;
    var res = nD[d] || 0;
    var coAjustado = _nom035EscalarRango(co, res, esp);
    if (coAjustado !== co) huboAjuste = true;
    var n = _nom035NivelRiesgo(pD[d], coAjustado);
    rD[d] = {
      puntaje: pD[d], nivel: n, color: NOM035_COLORES[n] || {},
      items: res, itemsEsperados: esp,
      parcial: res < esp
    };
  });

  var rC = {};
  Object.keys(pC).forEach(function(c) {
    var co = rangos.categorias[c];
    if (!co) { rC[c] = {puntaje:pC[c], nivel:"Sin rango", color:{}}; return; }
    var esp = esperado.categorias[c] || 0;
    var res = nC[c] || 0;
    var coAjustado = _nom035EscalarRango(co, res, esp);
    var n = _nom035NivelRiesgo(pC[c], coAjustado);
    rC[c] = {
      puntaje: pC[c], nivel: n, color: NOM035_COLORES[n] || {},
      items: res, itemsEsperados: esp,
      parcial: res < esp
    };
  });

  var totalCortes = _nom035EscalarRango(rangos.total, nTot, esperado.total);
  var nT = _nom035NivelRiesgo(tot, totalCortes);

  return {
    tipoGuia: tipoGuia,
    totalPuntaje: tot,
    nivelTotal: nT,
    colorTotal: NOM035_COLORES[nT] || {},
    planAccion: NOM035_PLAN_ACCION[nT] || "",
    dominios: rD,
    categorias: rC,
    itemsRespondidos: nTot,
    itemsEsperados: esperado.total,
    rangoAjustado: huboAjuste || nTot < esperado.total
  };
}

function _nom035CuestionarioDefault(tipoGuia) {
  if (tipoGuia === "guia2") {
    return {
      titulo:"Gu\u00eda de Referencia II \u2014 Factores de riesgo psicosocial",
      descripcion:"Para responder considere las condiciones de su centro de trabajo durante los \u00faltimos DOS MESES. No hay respuestas correctas o incorrectas. Confidencial.",
      totalItems:46,
      items:[
        {item:1,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Mi trabajo me exige hacer mucho esfuerzo f\u00edsico",direccion:"directa",condicional:null},
        {item:2,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Me preocupa sufrir un accidente en mi trabajo",direccion:"directa",condicional:null},
        {item:3,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Considero que las actividades que realizo son peligrosas",direccion:"directa",condicional:null},
        {item:4,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno",direccion:"directa",condicional:null},
        {item:5,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Por la cantidad de trabajo que tengo debo trabajar sin parar",direccion:"directa",condicional:null},
        {item:6,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Considero que es necesario mantener un ritmo de trabajo acelerado",direccion:"directa",condicional:null},
        {item:7,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo exige que est\u00e9 muy concentrado",direccion:"directa",condicional:null},
        {item:8,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo requiere que memorice mucha informaci\u00f3n",direccion:"directa",condicional:null},
        {item:9,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo exige que atienda varios asuntos al mismo tiempo",direccion:"directa",condicional:null},
        {item:10,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"En mi trabajo soy responsable de cosas de mucho valor",direccion:"directa",condicional:null},
        {item:11,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Respondo ante mi jefe por los resultados de toda mi \u00e1rea de trabajo",direccion:"directa",condicional:null},
        {item:12,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"En mi trabajo me dan \u00f3rdenes contradictorias",direccion:"directa",condicional:null},
        {item:13,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Considero que en mi trabajo me piden hacer cosas innecesarias",direccion:"directa",condicional:null},
        {item:14,categoria:"Organizacion del tiempo de trabajo",dominio:"Jornada de trabajo",pregunta:"Trabajo horas extras m\u00e1s de tres veces a la semana",direccion:"directa",condicional:null},
        {item:15,categoria:"Organizacion del tiempo de trabajo",dominio:"Jornada de trabajo",pregunta:"Mi trabajo me exige laborar en d\u00edas de descanso, festivos o fines de semana",direccion:"directa",condicional:null},
        {item:16,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales",direccion:"directa",condicional:null},
        {item:17,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Pienso en las actividades familiares o personales cuando estoy en mi trabajo",direccion:"directa",condicional:null},
        {item:18,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Mi trabajo permite que desarrolle nuevas habilidades",direccion:"inversa",condicional:null},
        {item:19,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"En mi trabajo puedo aspirar a un mejor puesto",direccion:"inversa",condicional:null},
        {item:20,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Durante mi jornada de trabajo puedo tomar pausas cuando las necesito",direccion:"inversa",condicional:null},
        {item:21,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo",direccion:"inversa",condicional:null},
        {item:22,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Puedo cambiar el orden de las actividades que realizo en mi trabajo",direccion:"inversa",condicional:null},
        {item:23,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me informan con claridad cu\u00e1les son mis funciones",direccion:"inversa",condicional:null},
        {item:24,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me explican claramente los resultados que debo obtener en mi trabajo",direccion:"inversa",condicional:null},
        {item:25,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me informan con qui\u00e9n puedo resolver problemas o asuntos de trabajo",direccion:"inversa",condicional:null},
        {item:26,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Me permiten asistir a capacitaciones relacionadas con mi trabajo",direccion:"inversa",condicional:null},
        {item:27,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Recibo capacitaci\u00f3n \u00fatil para hacer mi trabajo",direccion:"inversa",condicional:null},
        {item:28,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe tiene en cuenta mis puntos de vista y opiniones",direccion:"inversa",condicional:null},
        {item:29,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo",direccion:"inversa",condicional:null},
        {item:30,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Puedo confiar en mis compa\u00f1eros de trabajo",direccion:"inversa",condicional:null},
        {item:31,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Cuando tenemos que realizar trabajo de equipo los compa\u00f1eros colaboran",direccion:"inversa",condicional:null},
        {item:32,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Mis compa\u00f1eros de trabajo me ayudan cuando tengo dificultades",direccion:"inversa",condicional:null},
        {item:33,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"En mi trabajo puedo expresarme libremente sin interrupciones",direccion:"inversa",condicional:null},
        {item:34,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Recibo cr\u00edticas constantes a mi persona y/o trabajo",direccion:"directa",condicional:null},
        {item:35,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones",direccion:"directa",condicional:null},
        {item:36,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones",direccion:"directa",condicional:null},
        {item:37,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador",direccion:"directa",condicional:null},
        {item:38,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se ignoran mis \u00e9xitos laborales y se atribuyen a otros trabajadores",direccion:"directa",condicional:null},
        {item:39,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo",direccion:"directa",condicional:null},
        {item:40,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"He presenciado actos de violencia en mi centro de trabajo",direccion:"directa",condicional:null},
        {item:41,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Atiendo clientes o usuarios muy enojados",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
        {item:42,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
        {item:43,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Para hacer mi trabajo debo demostrar sentimientos distintos a los m\u00edos",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
        {item:44,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Comunican tarde los asuntos de trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"},
        {item:45,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Dificultan el logro de los resultados del trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"},
        {item:46,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Ignoran las sugerencias para mejorar su trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"}
      ]
    };
  }
  return {
    titulo:"Gu\u00eda de Referencia III \u2014 Factores de riesgo psicosocial y entorno organizacional",
    descripcion:"Para responder considere las condiciones de su centro de trabajo durante los \u00faltimos DOS MESES. No hay respuestas correctas o incorrectas. Confidencial.",
    totalItems:72,
    items:[
      {item:1,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"El espacio donde trabajo me permite realizar mis actividades de manera segura e higi\u00e9nica",direccion:"inversa",condicional:null},
      {item:2,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Mi trabajo me exige hacer mucho esfuerzo f\u00edsico",direccion:"directa",condicional:null},
      {item:3,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Me preocupa sufrir un accidente en mi trabajo",direccion:"directa",condicional:null},
      {item:4,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Considero que en mi trabajo se aplican las normas de seguridad y salud en el trabajo",direccion:"inversa",condicional:null},
      {item:5,categoria:"Ambiente de trabajo",dominio:"Condiciones en el ambiente de trabajo",pregunta:"Considero que las actividades que realizo son peligrosas",direccion:"directa",condicional:null},
      {item:6,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno",direccion:"directa",condicional:null},
      {item:7,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Por la cantidad de trabajo que tengo debo trabajar sin parar",direccion:"directa",condicional:null},
      {item:8,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Considero que es necesario mantener un ritmo de trabajo acelerado",direccion:"directa",condicional:null},
      {item:9,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo exige que est\u00e9 muy concentrado",direccion:"directa",condicional:null},
      {item:10,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo requiere que memorice mucha informaci\u00f3n",direccion:"directa",condicional:null},
      {item:11,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"En mi trabajo tengo que tomar decisiones dif\u00edciles muy r\u00e1pido",direccion:"directa",condicional:null},
      {item:12,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo exige que atienda varios asuntos al mismo tiempo",direccion:"directa",condicional:null},
      {item:13,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"En mi trabajo soy responsable de cosas de mucho valor",direccion:"directa",condicional:null},
      {item:14,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Respondo ante mi jefe por los resultados de toda mi \u00e1rea de trabajo",direccion:"directa",condicional:null},
      {item:15,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"En el trabajo me dan \u00f3rdenes contradictorias",direccion:"directa",condicional:null},
      {item:16,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Considero que en mi trabajo me piden hacer cosas innecesarias",direccion:"directa",condicional:null},
      {item:17,categoria:"Organizacion del tiempo de trabajo",dominio:"Jornada de trabajo",pregunta:"Trabajo horas extras m\u00e1s de tres veces a la semana",direccion:"directa",condicional:null},
      {item:18,categoria:"Organizacion del tiempo de trabajo",dominio:"Jornada de trabajo",pregunta:"Mi trabajo me exige laborar en d\u00edas de descanso, festivos o fines de semana",direccion:"directa",condicional:null},
      {item:19,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales",direccion:"directa",condicional:null},
      {item:20,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Debo atender asuntos de trabajo cuando estoy en casa",direccion:"directa",condicional:null},
      {item:21,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Pienso en las actividades familiares o personales cuando estoy en mi trabajo",direccion:"directa",condicional:null},
      {item:22,categoria:"Organizacion del tiempo de trabajo",dominio:"Interferencia en la relacion trabajo-familia",pregunta:"Pienso que mis responsabilidades familiares afectan mi trabajo",direccion:"directa",condicional:null},
      {item:23,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Mi trabajo permite que desarrolle nuevas habilidades",direccion:"inversa",condicional:null},
      {item:24,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"En mi trabajo puedo aspirar a un mejor puesto",direccion:"inversa",condicional:null},
      {item:25,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Durante mi jornada de trabajo puedo tomar pausas cuando las necesito",direccion:"inversa",condicional:null},
      {item:26,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Puedo decidir cu\u00e1nto trabajo realizo durante la jornada laboral",direccion:"inversa",condicional:null},
      {item:27,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo",direccion:"inversa",condicional:null},
      {item:28,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Puedo cambiar el orden de las actividades que realizo en mi trabajo",direccion:"inversa",condicional:null},
      {item:29,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Los cambios que se presentan en mi trabajo dificultan mi labor",direccion:"directa",condicional:null},
      {item:30,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Cuando se presentan cambios en mi trabajo se tienen en cuenta mis ideas o aportaciones",direccion:"inversa",condicional:null},
      {item:31,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me informan con claridad cu\u00e1les son mis funciones",direccion:"inversa",condicional:null},
      {item:32,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me explican claramente los resultados que debo obtener en mi trabajo",direccion:"inversa",condicional:null},
      {item:33,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me explican claramente los objetivos de mi trabajo",direccion:"inversa",condicional:null},
      {item:34,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Me informan con qui\u00e9n puedo resolver problemas o asuntos de trabajo",direccion:"inversa",condicional:null},
      {item:35,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Me permiten asistir a capacitaciones relacionadas con mi trabajo",direccion:"inversa",condicional:null},
      {item:36,categoria:"Factores propios de la actividad",dominio:"Falta de control sobre el trabajo",pregunta:"Recibo capacitaci\u00f3n \u00fatil para hacer mi trabajo",direccion:"inversa",condicional:null},
      {item:37,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe ayuda a organizar mejor el trabajo",direccion:"inversa",condicional:null},
      {item:38,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe tiene en cuenta mis puntos de vista y opiniones",direccion:"inversa",condicional:null},
      {item:39,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe me comunica a tiempo la informaci\u00f3n relacionada con el trabajo",direccion:"inversa",condicional:null},
      {item:40,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"La orientaci\u00f3n que me da mi jefe me ayuda a realizar mejor mi trabajo",direccion:"inversa",condicional:null},
      {item:41,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Liderazgo",pregunta:"Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo",direccion:"inversa",condicional:null},
      {item:42,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Puedo confiar en mis compa\u00f1eros de trabajo",direccion:"inversa",condicional:null},
      {item:43,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Entre compa\u00f1eros solucionamos los problemas de trabajo de forma respetuosa",direccion:"inversa",condicional:null},
      {item:44,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"En mi trabajo me hacen sentir parte del grupo",direccion:"inversa",condicional:null},
      {item:45,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Cuando tenemos que realizar trabajo de equipo los compa\u00f1eros colaboran",direccion:"inversa",condicional:null},
      {item:46,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Mis compa\u00f1eros de trabajo me ayudan cuando tengo dificultades",direccion:"inversa",condicional:null},
      {item:47,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"Me informan sobre lo que hago bien en mi trabajo",direccion:"inversa",condicional:null},
      {item:48,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"La forma como eval\u00faan mi trabajo en mi centro de trabajo me ayuda a mejorar mi desempe\u00f1o",direccion:"inversa",condicional:null},
      {item:49,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"En mi centro de trabajo me pagan a tiempo mi salario",direccion:"inversa",condicional:null},
      {item:50,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"El pago que recibo es el que merezco por el trabajo que realizo",direccion:"inversa",condicional:null},
      {item:51,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"Si obtengo los resultados esperados en mi trabajo me recompensan o reconocen",direccion:"inversa",condicional:null},
      {item:52,categoria:"Entorno organizacional",dominio:"Reconocimiento del desempeno",pregunta:"Las personas que hacen bien el trabajo pueden crecer laboralmente",direccion:"inversa",condicional:null},
      {item:53,categoria:"Entorno organizacional",dominio:"Insuficiente sentido de pertenencia e inestabilidad",pregunta:"Considero que mi trabajo es estable",direccion:"inversa",condicional:null},
      {item:54,categoria:"Entorno organizacional",dominio:"Insuficiente sentido de pertenencia e inestabilidad",pregunta:"En mi trabajo existe continua rotaci\u00f3n de personal",direccion:"directa",condicional:null},
      {item:55,categoria:"Entorno organizacional",dominio:"Insuficiente sentido de pertenencia e inestabilidad",pregunta:"Siento orgullo de laborar en este centro de trabajo",direccion:"inversa",condicional:null},
      {item:56,categoria:"Entorno organizacional",dominio:"Insuficiente sentido de pertenencia e inestabilidad",pregunta:"Me siento comprometido con mi trabajo",direccion:"inversa",condicional:null},
      {item:57,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"En mi trabajo puedo expresarme libremente sin interrupciones",direccion:"inversa",condicional:null},
      {item:58,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Recibo cr\u00edticas constantes a mi persona y/o trabajo",direccion:"directa",condicional:null},
      {item:59,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones",direccion:"directa",condicional:null},
      {item:60,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones",direccion:"directa",condicional:null},
      {item:61,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador",direccion:"directa",condicional:null},
      {item:62,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Se ignoran mis \u00e9xitos laborales y se atribuyen a otros trabajadores",direccion:"directa",condicional:null},
      {item:63,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo",direccion:"directa",condicional:null},
      {item:64,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Violencia",pregunta:"He presenciado actos de violencia en mi centro de trabajo",direccion:"directa",condicional:null},
      {item:65,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Atiendo clientes o usuarios muy enojados",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
      {item:66,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
      {item:67,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Para hacer mi trabajo debo demostrar sentimientos distintos a los m\u00edos",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
      {item:68,categoria:"Factores propios de la actividad",dominio:"Carga de trabajo",pregunta:"Mi trabajo me exige atender situaciones de violencia",direccion:"directa",condicional:"Solo si brindas servicio a clientes o usuarios"},
      {item:69,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Comunican tarde los asuntos de trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"},
      {item:70,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Dificultan el logro de los resultados del trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"},
      {item:71,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Cooperan poco cuando se necesita",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"},
      {item:72,categoria:"Liderazgo y relaciones en el trabajo",dominio:"Relaciones en el trabajo",pregunta:"Ignoran las sugerencias para mejorar su trabajo",direccion:"directa",condicional:"Solo si eres jefe de otros trabajadores"}
    ]
  };
}

var NOM035_GUIAV = {
  titulo: "Datos del trabajador",
  descripcion: "\u00daltimo paso. Esta informaci\u00f3n permite analizar los resultados por perfil (puesto, turno, antig\u00fcedad).",
  secciones: [
    {
      id: "info",
      titulo: "Informaci\u00f3n del trabajador",
      campos: [
        {id:"sexo", etiqueta:"Sexo", tipo:"opciones", origen:"GENERO",
         opciones:["Masculino","Femenino","Otro"]},
        {id:"rangoEdad", etiqueta:"Edad en a\u00f1os", tipo:"opciones", origen:"RANGO_EDAD_CALC",
         opciones:["15 - 19","20 - 24","25 - 29","30 - 34","35 - 39","40 - 44",
                   "45 - 49","50 - 54","55 - 59","60 - 64","65 - 69","70 o m\u00e1s"]},
        {id:"estadoCivil", etiqueta:"Estado civil", tipo:"opciones", origen:"ESTADO CIVIL",
         opciones:["Casado","Divorciado","Soltero","Viudo","Uni\u00f3n libre"]},
        {id:"nivelEstudios", etiqueta:"Nivel de estudios", tipo:"opciones", origen:"ESCOLARIDAD",
         opciones:["Sin formaci\u00f3n","Primaria","Secundaria","Preparatoria o Bachillerato",
                   "T\u00e9cnico Superior","Licenciatura","Maestr\u00eda","Doctorado"]},
        // El formato oficial pide Terminada/Incompleta por nivel.
        // Solo aplica si el nivel elegido no es "Sin formación".
        {id:"estudiosEstatus", etiqueta:"\u00bfLa concluiste?", tipo:"opciones",
         opciones:["Terminada","Incompleta"],
         dependeDe:"nivelEstudios", ocultarSi:["Sin formaci\u00f3n"]}
      ]
    },
    {
      id: "laboral",
      titulo: "Datos laborales",
      campos: [
        {id:"puesto", etiqueta:"Ocupaci\u00f3n, profesi\u00f3n o puesto", tipo:"texto", origen:"PUESTO"},
        {id:"departamento", etiqueta:"Departamento, secci\u00f3n o \u00e1rea", tipo:"texto", origen:"DEPARTAMENTO"},
        {id:"tipoPuesto", etiqueta:"Tipo de puesto", tipo:"opciones",
         opciones:["Operativo","Supervisor","Profesional o t\u00e9cnico","Gerente"]},
        {id:"tipoContratacion", etiqueta:"Tipo de contrataci\u00f3n", tipo:"opciones", origen:"TIPO DE CONTRATO",
         opciones:["Por obra o proyecto","Tiempo indeterminado",
                   "Por tiempo determinado (temporal)","Honorarios"]},
        {id:"tipoPersonal", etiqueta:"Tipo de personal", tipo:"opciones",
         opciones:["Sindicalizado","Confianza","Ninguno"]},
        {id:"tipoJornada", etiqueta:"Tipo de jornada de trabajo", tipo:"opciones",
         opciones:["Fijo diurno (entre las 6:00 y 20:00 hrs)",
                   "Fijo nocturno (entre las 20:00 y 6:00 hrs)",
                   "Fijo mixto (combinaci\u00f3n de nocturno y diurno)"]},
        {id:"rotacionTurnos", etiqueta:"\u00bfRealizas rotaci\u00f3n de turnos?", tipo:"opciones",
         opciones:["S\u00ed","No"]}
      ]
    },
    {
      id: "experiencia",
      titulo: "Experiencia",
      campos: [
        {id:"tiempoPuesto", etiqueta:"Tiempo en el puesto actual", tipo:"opciones", origen:"ANTIGUEDAD_CALC",
         opciones:["Menos de 6 meses","Entre 6 meses y 1 a\u00f1o","Entre 1 a 4 a\u00f1os",
                   "Entre 5 a 9 a\u00f1os","Entre 10 a 14 a\u00f1os","Entre 15 a 19 a\u00f1os",
                   "Entre 20 a 24 a\u00f1os","25 a\u00f1os o m\u00e1s"]},
        {id:"tiempoExperiencia", etiqueta:"Tiempo de experiencia laboral total", tipo:"opciones",
         opciones:["Menos de 6 meses","Entre 6 meses y 1 a\u00f1o","Entre 1 a 4 a\u00f1os",
                   "Entre 5 a 9 a\u00f1os","Entre 10 a 14 a\u00f1os","Entre 15 a 19 a\u00f1os",
                   "Entre 20 a 24 a\u00f1os","25 a\u00f1os o m\u00e1s"]}
      ]
    }
  ]
};

/* Convierte una edad numérica al rango de la Guía V */
function _nom035RangoEdad(edad) {
  var e = parseInt(edad, 10);
  if (isNaN(e) || e < 15) return "";
  if (e >= 70) return "70 o m\u00e1s";
  var rangos = [[15,19],[20,24],[25,29],[30,34],[35,39],[40,44],
                [45,49],[50,54],[55,59],[60,64],[65,69]];
  for (var i = 0; i < rangos.length; i++) {
    if (e >= rangos[i][0] && e <= rangos[i][1]) return rangos[i][0] + " - " + rangos[i][1];
  }
  return "";
}

/* Convierte la fecha de ingreso al rango de antigüedad de la Guía V */
function _nom035RangoAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return "";
  var d = (fechaIngreso instanceof Date) ? fechaIngreso : new Date(fechaIngreso);
  if (isNaN(d.getTime())) return "";
  var meses = (new Date() - d) / (1000*60*60*24*30.44);
  if (meses < 0) return "";
  if (meses < 6)  return "Menos de 6 meses";
  if (meses < 12) return "Entre 6 meses y 1 a\u00f1o";
  var a = meses / 12;
  if (a < 5)  return "Entre 1 a 4 a\u00f1os";
  if (a < 10) return "Entre 5 a 9 a\u00f1os";
  if (a < 15) return "Entre 10 a 14 a\u00f1os";
  if (a < 20) return "Entre 15 a 19 a\u00f1os";
  if (a < 25) return "Entre 20 a 24 a\u00f1os";
  return "25 a\u00f1os o m\u00e1s";
}

/* Normaliza valores de la base para que coincidan con las opciones
   oficiales. Sin esto, "Soltera(o)" o "Union Libre" no harían match
   y el campo saldría vacío aunque el dato exista. */
function _nom035NormalizarValor(campo, valor) {
  var v = (valor || "").toString().trim();
  if (!v) return "";
  var sinAcentos = function(s){
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  };
  var t = sinAcentos(v);

  if (campo === "sexo") {
    if (t.indexOf("masc") === 0 || t === "h" || t === "hombre") return "Masculino";
    if (t.indexOf("fem")  === 0 || t === "m" || t === "mujer")  return "Femenino";
    return "";
  }
  if (campo === "estadoCivil") {
    if (t.indexOf("solter") === 0) return "Soltero";
    if (t.indexOf("casad")  === 0) return "Casado";
    if (t.indexOf("divorc") === 0) return "Divorciado";
    if (t.indexOf("viud")   === 0) return "Viudo";
    if (t.indexOf("union")  === 0 || t.indexOf("libre") !== -1) return "Uni\u00f3n libre";
    return "";
  }
  if (campo === "nivelEstudios") {
    if (t.indexOf("doctor")   !== -1) return "Doctorado";
    if (t.indexOf("maestr")   !== -1) return "Maestr\u00eda";
    if (t.indexOf("licencia") !== -1 || t.indexOf("lic ") === 0 || t.indexOf("ingenier") !== -1) return "Licenciatura";
    if (t.indexOf("tecnic")   !== -1 || t.indexOf("tsu") !== -1) return "T\u00e9cnico Superior";
    if (t.indexOf("prepa")    !== -1 || t.indexOf("bachiller") !== -1) return "Preparatoria o Bachillerato";
    if (t.indexOf("secundar") !== -1) return "Secundaria";
    if (t.indexOf("primar")   !== -1) return "Primaria";
    if (t.indexOf("sin ")     === 0 || t.indexOf("ningun") !== -1) return "Sin formaci\u00f3n";
    return "";
  }
  if (campo === "tipoContratacion") {
    if (t.indexOf("indetermin") !== -1) return "Tiempo indeterminado";
    if (t.indexOf("determin")   !== -1 || t.indexOf("temporal") !== -1) return "Por tiempo determinado (temporal)";
    if (t.indexOf("obra")       !== -1 || t.indexOf("proyecto") !== -1) return "Por obra o proyecto";
    if (t.indexOf("honorar")    !== -1) return "Honorarios";
    return "";
  }
  return v;
}


var NOM035_MESES_VIGENCIA  = 24;   // la Norma pide al menos cada 2 anos
var NOM035_DIAS_AVISO      = 90;   // margen para organizar la aplicacion

export {
  NOM035_AJUSTAR_RANGO_PARCIAL, NOM035_MIN_TRABAJADORES_FRP, NOM035_ESCALA, NOM035_RANGOS,
  NOM035_PLAN_ACCION, NOM035_COLORES, NOM035_GUIA1, NOM035_GUIAV, NOM035_MESES_VIGENCIA, NOM035_DIAS_AVISO,
  _nom035NivelRiesgo, _nom035CalificarGuia1, _nom035ConteoEsperado, _nom035EscalarRango,
  _nom035CalificarGuiaFRP, _nom035CuestionarioDefault, _nom035RangoEdad, _nom035RangoAntiguedad,
  _nom035NormalizarValor,
};
