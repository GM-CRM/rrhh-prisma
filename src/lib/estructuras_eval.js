// ============================================================
//  Estructuras por defecto de los procesos de evaluación.
//  Copia textual de getEstructuraEvalPorTipo() de Código.gs (GAS).
// ============================================================
export function getEstructuraEvalPorTipo(tipo) {
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
