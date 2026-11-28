// ============================================================
//  Roles y permisos (estilo ClickUp)
//  · Cada rol tiene una matriz módulo → acciones permitidas.
//  · El alcance (qué empresas ve cada usuario) se asigna por grupo
//    comercial y/o por empresa; un grupo incluye sus empresas actuales
//    y las que se agreguen después.
//  · El router valida el permiso ANTES de ejecutar la acción, así que
//    esconder un botón en pantalla nunca es la única protección.
// ============================================================
import { s, listaEmpresas } from "./util.js";

// Catálogo que también usa la pantalla de roles para dibujar la matriz
export const CATALOGO_PERMISOS = [
  { id: "indicadores",  nombre: "Indicadores",        acciones: { ver: "Ver tablero", exportar: "Descargar datos" } },
  { id: "alta",         nombre: "Alta de personal",   acciones: { crear: "Registrar altas" } },
  { id: "baja",         nombre: "Baja de personal",   acciones: { crear: "Registrar bajas" } },
  { id: "expedientes",  nombre: "Expedientes",        acciones: { ver: "Ver", editar: "Editar datos", documentos: "Subir documentos y fotos", exportar: "Descargar" } },
  { id: "contratos",    nombre: "Contratos",          acciones: { generar: "Generar contratos", plantillas: "Cambiar plantillas" } },
  { id: "personas",     nombre: "Personas",           acciones: { ver: "Directorio y organigrama", catalogos: "Editar catálogos" } },
  { id: "evaluaciones", nombre: "Evaluaciones",       acciones: { ver: "Ver informes", administrar: "Crear y cerrar procesos" } },
  { id: "encuestas",    nombre: "Encuestas",          acciones: { ver: "Ver respuestas", editar: "Editar encuestas", exportar: "Descargar" } },
  { id: "nom035",       nombre: "NOM-035",            acciones: { ver: "Ver resultados", administrar: "Configurar y anular" } },
  { id: "usuarios",     nombre: "Usuarios y roles",   acciones: { administrar: "Crear usuarios, roles y permisos" } },
];

export function permisosCompletos() {
  const p = {};
  for (const m of CATALOGO_PERMISOS) p[m.id] = Object.keys(m.acciones);
  return p;
}

// Lo que hoy puede hacer un "Auxiliar" (sin cambiar su comportamiento actual)
export function permisosAuxiliar() {
  const p = permisosCompletos();
  delete p.usuarios;
  p.contratos = ["generar"];
  p.encuestas = ["ver", "exportar"];
  p.nom035 = ["ver"];
  return p;
}

export const ROLES_BASE = [
  { id_rol: "ROL001", nombre: "Administrador", descripcion: "Acceso total, incluidos usuarios, roles y configuración.", color: "#A35BFF", es_sistema: 1, permisos: permisosCompletos() },
  { id_rol: "ROL002", nombre: "Auxiliar", descripcion: "Opera altas, bajas y expedientes de sus empresas.", color: "#5B7CFF", es_sistema: 1, permisos: permisosAuxiliar() },
  { id_rol: "ROL003", nombre: "Solo consulta", descripcion: "Ve tableros, expedientes y directorio sin modificar nada.", color: "#2FE0C8", es_sistema: 0,
    permisos: { indicadores: ["ver"], expedientes: ["ver"], personas: ["ver"], evaluaciones: ["ver"], encuestas: ["ver"], nom035: ["ver"] } },
];

// Acción del backend → permiso que necesita un usuario del panel.
// Un arreglo significa "cualquiera de estos". Las acciones que no están aquí
// (login, encuestas públicas, el portal del empleado, las evaluaciones propias)
// siguen validándose dentro de su módulo como hasta ahora.
export const PERMISO_ACCION = {
  alta: "alta.crear", siguiente_numero: "alta.crear",
  ocr_documento: "alta.crear", groq_ocr: "alta.crear", gemini_ocr: "alta.crear", leer_documento_texto: "alta.crear",
  importar_masivo: "alta.crear",
  baja: "baja.crear",
  actualizar_empleado: "expedientes.editar", registrar_movimiento: "expedientes.editar",
  activar_acceso_emp: "expedientes.editar", reenviar_acceso_emp: "expedientes.editar",
  subir_documento: "expedientes.documentos", subir_contrato_firmado: "expedientes.documentos", crear_expediente: "expedientes.documentos",
  listar_archivos_expediente: "expedientes.ver",
  obtener_historial_persona: ["expedientes.ver", "personas.ver"],
  generar_contrato: "contratos.generar", obtener_datos_contrato: "contratos.generar",
  subir_plantilla_contrato: "contratos.plantillas", listar_plantillas_contrato: ["contratos.plantillas", "contratos.generar"],
  obtener_directorio: "personas.ver", obtener_organigrama: "personas.ver",
  guardar_catalogo: "personas.catalogos", asignar_jefe: ["personas.catalogos", "expedientes.editar"],
  crear_proceso_eval: "evaluaciones.administrar", actualizar_proceso_eval: "evaluaciones.administrar",
  activar_proceso_eval: "evaluaciones.administrar", cerrar_proceso_eval: "evaluaciones.administrar",
  listar_procesos_eval: ["evaluaciones.ver", "evaluaciones.administrar"], resultados_eval: ["evaluaciones.ver", "evaluaciones.administrar"],
  listar_respuestas: "encuestas.ver", guardar_encuesta: "encuestas.editar", setup_encuestas: "encuestas.editar",
  resultados_nom035: "nom035.ver", vencimientos_nom035: "nom035.ver", listar_centros_nom035: "nom035.ver", generar_informe_77: "nom035.ver",
  guardar_config_nom035: "nom035.administrar", restablecer_config_nom035: "nom035.administrar",
  anular_respuesta_nom035: "nom035.administrar", guardar_centro_nom035: "nom035.administrar",
  crear_usuario: "usuarios.administrar", listar_usuarios: "usuarios.administrar", resetear_password: "usuarios.administrar",
  listar_roles: "usuarios.administrar", guardar_rol: "usuarios.administrar", eliminar_rol: "usuarios.administrar",
};

export const ETIQUETA_PERMISO = (req) => {
  const [m, a] = String(req).split(".");
  const mod = CATALOGO_PERMISOS.find(x => x.id === m);
  return mod ? (mod.acciones[a] || a).toLowerCase() + " en " + mod.nombre : req;
};

function normalizar(perm) {
  const out = {};
  if (!perm || typeof perm !== "object") return out;
  for (const m of CATALOGO_PERMISOS) {
    const lista = Array.isArray(perm[m.id]) ? perm[m.id] : [];
    const validas = lista.filter(a => Object.prototype.hasOwnProperty.call(m.acciones, a));
    if (validas.length) out[m.id] = [...new Set(validas)];
  }
  return out;
}
export { normalizar as normalizarPermisos };

// Permisos del rol. El Administrador siempre tiene todo (no se puede quedar
// nadie fuera por error). Si la tabla de roles todavía no existe en la base
// (migración pendiente), se usa el comportamiento anterior.
export async function permisosDeRol(env, rol) {
  rol = s(rol);
  if (rol === "Administrador") return permisosCompletos();
  try {
    const r = await env.DB.prepare("SELECT permisos_json FROM roles WHERE nombre = ? COLLATE NOCASE LIMIT 1").bind(rol).first();
    if (r) { try { return normalizar(JSON.parse(r.permisos_json || "{}")); } catch (_) { return {}; } }
    return rol === "Auxiliar" ? permisosAuxiliar() : {};
  } catch (_) {
    return permisosAuxiliar();
  }
}

export function tienePermiso(permisos, req) {
  const lista = Array.isArray(req) ? req : [req];
  return lista.some(x => {
    const [m, a] = String(x).split(".");
    return Array.isArray(permisos[m]) && permisos[m].includes(a);
  });
}

// Empresas que puede ver el usuario: las asignadas sueltas + las de sus grupos.
// Lista vacía = todas las empresas.
export async function alcanceEmpresas(env, u) {
  const sueltas = listaEmpresas(u && u.empresas_asignadas).map(x => s(x)).filter(Boolean);
  const grupos = listaEmpresas(u && u.grupos_asignados).map(x => s(x)).filter(Boolean);
  if (!grupos.length) return sueltas;
  let deGrupos = [];
  try {
    const { results } = await env.DB.prepare(
      "SELECT empresa FROM empresas WHERE UPPER(TRIM(grupo_comercial)) IN (SELECT UPPER(TRIM(value)) FROM json_each(?))"
    ).bind(JSON.stringify(grupos)).all();
    deGrupos = results.map(r => s(r.empresa));
  } catch (_) {}
  const vistos = new Set(), out = [];
  for (const e of [...sueltas, ...deGrupos]) { const k = e.toUpperCase(); if (!vistos.has(k)) { vistos.add(k); out.push(e); } }
  // Tenía grupos pero ninguno coincide con el catálogo: nunca abrir a "todas"
  return out.length ? out : ["__sin_empresas__"];
}
