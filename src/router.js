// ============================================================
//  RRHH Prisma — Router del backend en Cloudflare
//  Equivalente a doPost() de GAS: recibe {action, payload} y responde JSON
//  con la misma forma {status:"success"|"error", ...}.
//
//  Avance de la migración: cada módulo portado se agrega a MODULOS.
//  Las acciones que aún no se migran responden un error claro en lugar
//  de tocar Google (la rama de pruebas nunca escribe en el Sheet real).
// ============================================================
import auth from "./modulos/auth.js";
import accesoEmpleados from "./modulos/acceso_empleados.js";
import empleados from "./modulos/empleados.js";
import expedientes from "./modulos/expedientes.js";

export const VERSION_API = "cf-1.2.0";

const MODULOS = [auth, accesoEmpleados, empleados, expedientes];

// Las 66 acciones del doPost() de GAS (Código.gs). Sirve como checklist de avance.
export const ACCIONES_GAS = [
  "alta", "baja", "importar_masivo", "exportar_datos", "siguiente_numero", "actualizar_empleado",
  "ocr_documento", "groq_ocr", "subir_documento", "subir_contrato_firmado", "obtener_foto",
  "crear_expediente", "listar_archivos_expediente", "generar_contrato", "obtener_datos_contrato",
  "login", "logout", "validar_token", "crear_usuario", "listar_usuarios", "actualizar_usuario",
  "cambiar_password", "resetear_password", "setup_inicial", "solicitar_reset",
  "obtener_encuesta", "guardar_respuesta", "listar_respuestas", "guardar_encuesta", "setup_encuestas",
  "buscar_empleado_encuesta", "obtener_empleado_por_id", "gemini_ocr",
  "obtener_directorio", "obtener_organigrama", "setup_columnas",
  "crear_proceso_eval", "listar_procesos_eval", "obtener_proceso_eval", "actualizar_proceso_eval",
  "activar_proceso_eval", "cerrar_proceso_eval", "listar_mis_eval", "listar_equipo_eval",
  "guardar_eval", "resultados_eval",
  "login_empleado", "validar_token_emp", "activar_acceso_emp", "reenviar_acceso_emp",
  "buscar_usuario_por_nombre", "migrar_columnas_usuarios", "obtener_catalogo_empresas",
  "obtener_historial_persona", "registrar_movimiento", "migrar_historial_inicial", "getDriveUsage",
  "obtener_estructura_nom035", "obtener_guia_v_nom035", "datos_trabajador_nom035", "resultados_nom035",
  "guardar_respuesta_nom035", "guardar_config_nom035", "generar_informe_77", "listar_centros_nom035",
  "vencimientos_nom035",
];

const HANDLERS = Object.assign({}, ...MODULOS);

export function estadoMigracion() {
  const migradas = ACCIONES_GAS.filter(a => HANDLERS[a]);
  return {
    version: VERSION_API,
    migradas: migradas.length,
    total: ACCIONES_GAS.length,
    pendientes: ACCIONES_GAS.filter(a => !HANDLERS[a]),
  };
}

export async function despachar(body, env, ctx) {
  const action = body && body.action;
  const payload = (body && body.payload) || {};
  const fn = HANDLERS[action];
  if (fn) return fn(payload, env, ctx);
  if (ACCIONES_GAS.includes(action)) {
    return { status: "error", message: "Función en proceso de migración a Cloudflare (" + action + "). Disponible próximamente.", pendiente: true };
  }
  return { status: "error", message: "Accion no reconocida: " + action };
}
