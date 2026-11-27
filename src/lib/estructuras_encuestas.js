// ============================================================
//  Estructuras predeterminadas de encuestas — copiadas SIN CAMBIOS de Código.gs
//  (se usan solo si la encuesta en la base no tiene bloques)
// ============================================================

export function getEstructuraSalida() {
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

export function getEstructuraClima() {
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
