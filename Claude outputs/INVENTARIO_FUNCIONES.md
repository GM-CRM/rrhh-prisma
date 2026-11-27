# INVENTARIO DE FUNCIONES — RRHH Prisma (línea base para el rediseño)

**Creado:** 26-nov-2026 · **Fuente:** rama `cloudflare` (`public/index.html`, `public/main.js` v69.28, `empleado.html`, `encuesta.html`, `nom035.html`) + `Código.gs`/`NOM035.gs`

> **Regla del rediseño (acordada con Rafael):** ninguna función de esta lista se elimina.
> Se vale **moverla de lugar / reorganizarla**, **agregar funciones nuevas** y **corregir fallos**.
> Cada punto se marca ✅ cuando el rediseño lo conserva (o reubica) y se prueba.

Tamaño actual: `main.js` 8,816 líneas · 258 funciones · 141 IDs en `index.html` (0 duplicados) · 52 acciones de backend usadas por el panel + 9 por las páginas públicas.

---

## 0. Transversal (presente en todo el sistema)

| # | Función | Dónde está hoy | Backend |
|---|---|---|---|
| 0.1 | Login con correo y contraseña, mostrar/ocultar contraseña | Pantalla de login | `login` |
| 0.2 | "¿Olvidaste tu contraseña?" → envío de contraseña temporal | Modal en login | `solicitar_reset` |
| 0.3 | Sesión persistente (token), verificación al abrir | Al cargar | `validar_token` |
| 0.4 | Indicador de sesión + latido cada 4 min + aviso 5 min antes de expirar + "Reconectar" / renovar | Header | `validar_token` |
| 0.5 | Cerrar sesión | Sidebar "Salir" | `logout` |
| 0.6 | Roles: **Administrador** (todo) / **Auxiliar** (solo sus empresas asignadas; "Usuarios" se vuelve "Mi Perfil") | Global | — |
| 0.7 | Filtro automático por empresas permitidas del usuario | Todas las listas | — |
| 0.8 | Sidebar con grupos colapsables (Gestión de Personal · Mi Organización · Administración) que recuerda su estado | Sidebar | — |
| 0.9 | Menú hamburguesa en móvil | Header | — |
| 0.10 | Loader global con texto de estado | Global | — |
| 0.11 | Toasts (éxito, aviso, error, info, contrato) | Esquina inferior | — |
| 0.12 | **Centro de notificaciones** (campana + contador, panel lateral, pestañas Todas / Cumpleaños / Aniversarios / Contratos / NOM-035 / Otros, orden por urgencia, máx. 300 guardadas, "Limpiar") | Header | — |
| 0.13 | **Alertas automáticas:** contratos por vencer (30 días), entrevistas 15/45 días (3 días antes), cumpleaños y aniversarios (±3 días), vencimientos NOM-035 | Al cargar datos | `vencimientos_nom035` |
| 0.14 | Botón "Sincronizar" (forzar recarga de datos, caché 5 min) | Header | `exportar_datos` |
| 0.15 | Barra de uso de almacenamiento de Drive | Sidebar/Header | `getDriveUsage` |
| 0.16 | Instalar como app (PWA) + service worker con caché | Header / Expedientes | — |

## 1. Indicadores (Dashboard)

| # | Función |
|---|---|
| 1.1 | Filtros globales: Empresa · Grupo · Mes · Año + "Limpiar" + "Actualizar" |
| 1.2 | KPIs: total, activos, bajas, % rotación, edad promedio, antigüedad promedio, total finiquitos, género H/M con barra |
| 1.3 | Gráficas: tendencia (altas/bajas), por empresa, rango de edad, por departamento, motivos de baja, finiquitos |
| 1.4 | Estado "sin datos" en gráficas |

## 2. Gestión de Personal

### 2.1 Alta de personal (stepper de 7 pasos)
| # | Paso | Contenido |
|---|---|---|
| 2.1.1 | **Documentos** | Arrastrar/soltar archivos, PDF→imagen en navegador, **OCR + IA** que pre-llena el formulario, lista de campos detectados (`ocr_documento` / `groq_ocr`) |
| 2.1.2 | **Datos laborales** | No. empleado (autonumérico por empresa → `siguiente_numero`), fecha ingreso, nombre (Title Case), empresa (catálogo), grupo comercial (auto), departamento y puesto (listas sugeridas), tipo de ingreso (Administrativo / Operativo / Obra determinada solo URBAN THINK), sueldo, frecuencia de pago, fuente de contratación |
| 2.1.3 | **Contrato** | "Calcular fechas automáticamente" (Operativo 3×30, Administrativo 6×30, Obra sin vencimientos), entrevistas 15/45, tipo de contrato, inicio/vencimiento contratos 1–6 (4–6 solo Administrativo), evaluación 360° |
| 2.1.4 | **Datos personales** | CURP (decodifica fecha nac., género, estado → lugar de nacimiento), RFC, NSS, estado civil, escolaridad, domicilio con **autocompletado de Google Places** |
| 2.1.5 | **Contacto** | Correo, teléfono, contacto de emergencia, parentesco, teléfono emergencia |
| 2.1.6 | **Beneficiario** | Nombre, RFC, parentesco, % asignación |
| 2.1.7 | **Confirmar** | Resumen y "Confirmar alta" (`alta`) — Anterior/Siguiente, valores se conservan entre pasos |

### 2.2 Baja de personal
| # | Función |
|---|---|
| 2.2.1 | Buscar colaborador con autocompletado |
| 2.2.2 | Fecha de baja, monto de finiquito |
| 2.2.3 | Tipo de salida → motivos dependientes (voluntaria / involuntaria) + "Otro" con texto |
| 2.2.4 | "Confirmar baja definitiva" (`baja`) |

### 2.3 Expedientes (base de datos)
| # | Función | Backend |
|---|---|---|
| 2.3.1 | Tabla paginada (50 por página) con búsqueda y filtros Grupo · Empresa · Estatus + "Limpiar filtros" | `exportar_datos` |
| 2.3.2 | Exportar a Excel | — |
| 2.3.3 | Carga masiva desde Excel | `importar_masivo` |
| 2.3.4 | Badges de vencimiento de contrato | — |
| 2.3.5 | **Ficha del empleado (drawer)** con pestañas: | |
| | · Personal y contacto (todos los campos editables) | `actualizar_empleado` |
| | · Datos laborales (incl. jefe directo, correo de acceso, tipo de salida/motivo si es baja) | `actualizar_empleado` |
| | · Historial de carrera (trayectoria por persona, reingresos) + **registrar movimiento** | `obtener_historial_persona`, `registrar_movimiento` |
| | · Contratos (fechas 1–6, recalcular, **generar contrato** desde plantilla, **subir contrato firmado**) | `obtener_datos_contrato`, `generar_contrato`, `subir_contrato_firmado` |
| | · Expediente digital (crear carpeta, listar archivos con miniaturas por tipo, subir documentos por arrastre con barra de progreso) | `crear_expediente`, `listar_archivos_expediente`, `subir_documento` |
| | · NOM-035 del empleado (resultados, Guía V / fichas) | `resultados_nom035`, `datos_trabajador_nom035` |
| 2.3.6 | Foto de perfil del empleado (ver / subir) | `obtener_foto`, `subir_documento` |
| 2.3.7 | Activar / reenviar acceso al **portal del empleado** | `reenviar_acceso_emp` |
| 2.3.8 | Guardar cambios / Cancelar | `actualizar_empleado` |

## 3. Mi Organización

### 3.1 Personas
| # | Pestaña | Función |
|---|---|---|
| 3.1.1 | Directorio | Vista tarjetas ↔ tabla, filtros, filtro por grupo, fotos con carga diferida, abrir perfil (`obtener_directorio`, `obtener_foto`) |
| 3.1.2 | Organigrama | Árbol por jefe directo, búsqueda, modal de relaciones (`obtener_organigrama`) |
| 3.1.3 | Informes | Informes de personas |
| 3.1.4 | Administración | Administración de personas |

### 3.2 Evaluaciones (Desempeño · 360° · Competencias)
| # | Pestaña | Función | Backend |
|---|---|---|---|
| 3.2.1 | Mis evaluaciones | Lista y formulario para responder | `listar_mis_eval`, `obtener_proceso_eval`, `guardar_eval` |
| 3.2.2 | Mi equipo | Evaluaciones del equipo | `listar_equipo_eval` |
| 3.2.3 | Informes | Resultados por proceso | `listar_procesos_eval`, `resultados_eval` |
| 3.2.4 | Administración | Crear/editar proceso, **editor de bloques y preguntas** (agregar, mover, eliminar, cambiar tipo), activar, cerrar, filtrar | `crear_/actualizar_/activar_/cerrar_proceso_eval` |

### 3.3 Encuestas
| # | Pestaña | Función | Backend |
|---|---|---|---|
| 3.3.1 | Salida · Clima · Desempeño · Capacitación · Pulso | Dashboard de resultados por encuesta (Clima por dimensiones), descargar respuestas a Excel, copiar link público, **editor de encuesta** (bloques, preguntas, opciones) | `listar_respuestas`, `obtener_encuesta`, `guardar_encuesta` |
| 3.3.2 | NOM-035 | Sub-pestañas **Dashboard** (KPIs, dona, heatmap por dominio, nivel por centro) y **Colorimetría** (tabla con detalle por empleado en acordeón), filtros, perfil sociodemográfico, banner de vigencia, exportar Excel/CSV, configurar cuestionario | `resultados_nom035`, `obtener_estructura_nom035`, `guardar_config_nom035`, `datos_trabajador_nom035` |
| 3.3.3 | Informe 7.7 | Generar informe NOM-035 por centro de trabajo | `listar_centros_nom035`, `generar_informe_77` |

## 4. Administración — Usuarios / Mi Perfil
| # | Función | Backend |
|---|---|---|
| 4.1 | (Admin) Tabla de usuarios: rol, empresas, estatus, último acceso | `listar_usuarios` |
| 4.2 | (Admin) Nuevo usuario con búsqueda automática de ID interno por nombre | `crear_usuario`, `buscar_usuario_por_nombre` |
| 4.3 | (Admin) Editar, activar/desactivar, resetear contraseña | `actualizar_usuario`, `resetear_password` |
| 4.4 | (Auxiliar) Mi perfil: datos, teléfono, foto, cambiar contraseña | `actualizar_usuario`, `cambiar_password` |

## 5. Páginas públicas (fuera del panel)
| # | Página | Función | Backend |
|---|---|---|---|
| 5.1 | `empleado.html` | Portal del empleado: login, mis evaluaciones, responder evaluación | `login_empleado`, `validar_token_emp`, `listar_mis_eval`, `obtener_proceso_eval`, `guardar_eval` |
| 5.2 | `encuesta.html` | Responder encuestas por link (búsqueda del empleado, NOM-035 integrada) | `obtener_encuesta`, `buscar_empleado_encuesta`, `obtener_empleado_por_id`, `guardar_respuesta`, `obtener_estructura_nom035`, `guardar_respuesta_nom035` |
| 5.3 | `nom035.html` | Cuestionario NOM-035 (Guías I/II/III y V) | `buscar_empleado_encuesta`, `obtener_estructura_nom035`, `obtener_guia_v_nom035`, `guardar_respuesta_nom035` |

---

## 6. Fallos y mejoras detectados (para corregir en la migración / rediseño)

| # | Hallazgo | Propuesta |
|---|---|---|
| F1 | Portal del empleado muestra **departamento** donde dice "puesto" (GAS lee la columna G) | Corregir (pendiente de tu OK) |
| F2 | Sesión: el frontend asume 60 min, el backend da 12 h | Unificar |
| F3 | 13 empleados sin CURP aparecen en rango de edad ">65" por la fórmula del Sheet | Ya corregido en D1 (quedan en blanco) |
| F4 | `ID_EVAL` repetido (EV00005) por cómo GAS genera IDs | Ya corregido en D1 |
| F5 | NSS de 218 empleados perdió el cero inicial | Ya corregido en D1 |
| F6 | CURP con datos erróneos (SCH180 tiene un nombre, SER24 un RFC) y fecha de ingreso inválida en UTSC24 | Corregir el dato en el sistema |
| F7 | Encabezados de USUARIOS desfasados y EVENTOS con 7 columnas bajo 6 encabezados | Ya no aplica en D1 |
| F8 | "Último acceso" en Usuarios mostraba en realidad la expiración del token | Ya corregido (se guarda el último acceso real) |
| F9 | `app.js` no lo carga ningún HTML (código muerto, 99 KB) | Archivar al terminar |
| F10 | Contraseñas con SHA-256 sin "sal" | Mejora futura: re-cifrar con PBKDF2 al iniciar sesión, sin pedir cambio |
| F11 | Tokens y contraseñas temporales con `Math.random` | Ya corregido (aleatorio criptográfico) |

## 7. Decisiones pendientes que surgieron del inventario

- **D7 — Google Places (autocompletado de domicilio en el alta):** es la única pieza de Google que queda en el frontend. Opciones: conservarla (requiere su API key y facturación de Google Maps) o reemplazarla por un autocompletado gratuito (calidad menor para direcciones de México).
