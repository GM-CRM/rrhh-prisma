-- ============================================================
--  RRHH Prisma — Esquema D1 (SQLite)  v1.0  26-nov-2026
--  Fuente: BD_PWA_Multimedia (13 hojas)
--
--  Convenciones:
--   * Fechas  → TEXT ISO 'YYYY-MM-DD'; fecha-hora → TEXT ISO 8601.
--   * CURP, RFC, NSS, teléfonos → TEXT (no perder ceros).
--   * Vacío → NULL.
--   * id_interno = identificador ÚNICO global del empleado (regla de oro).
--     no_empleado se repite entre empresas: nunca se usa solo.
--   * Las columnas que en el Sheet eran FÓRMULA no se guardan:
--     se calculan en la vista v_empleados (ver views.sql).
-- ============================================================
PRAGMA foreign_keys = ON;

-- ── EMPRESAS (catálogo autoritativo de grupo comercial) ─────
CREATE TABLE IF NOT EXISTS empresas (
  id                    TEXT PRIMARY KEY,          -- E1, E2 …
  grupo_comercial       TEXT NOT NULL,
  empresa               TEXT NOT NULL UNIQUE,      -- razón social
  rfc                   TEXT,
  domicilio_fiscal      TEXT,
  actividad_economica   TEXT,
  representante_legal   TEXT,
  abreviatura           TEXT                       -- prefijo de id_interno (GOK, OET …)
);

-- ── EMPLEADOS (hoja BASE DE DATOS, 61 columnas) ─────────────
CREATE TABLE IF NOT EXISTS empleados (
  id_interno                    TEXT PRIMARY KEY,  -- AY (51)
  id_persona                    TEXT,              -- BC (55) misma persona entre empresas/reingresos
  no_empleado                   INTEGER,           -- A  (1)
  empresa_id                    TEXT REFERENCES empresas(id),
  empresa                       TEXT,              -- F  (6) texto original
  grupo_comercial               TEXT,              -- BB (54) informativo; manda empresas.grupo_comercial
  nombre                        TEXT NOT NULL,     -- E  (5)
  fecha_ingreso                 TEXT,              -- B  (2)
  departamento                  TEXT,              -- G  (7)
  puesto                        TEXT,              -- H  (8)
  sueldo_mensual                REAL,              -- I  (9)
  frecuencia_pago               TEXT,              -- J  (10)
  fuente_contratacion           TEXT,              -- K  (11)
  fecha_baja                    TEXT,              -- L  (12)
  tipo_salida                   TEXT,              -- M  (13)
  motivo_salida                 TEXT,              -- N  (14)
  monto_finiquito               REAL,              -- O  (15)
  lugar_nacimiento              TEXT,              -- P  (16)
  nacionalidad                  TEXT,              -- Q  (17)
  estado_civil                  TEXT,              -- V  (22)
  curp                          TEXT,              -- W  (23)
  rfc                           TEXT,              -- X  (24)
  nss                           TEXT,              -- Y  (25)
  domicilio                     TEXT,              -- Z  (26)
  escolaridad                   TEXT,              -- AA (27)
  correo                        TEXT,              -- AB (28)
  telefono                      TEXT,              -- AC (29)
  contacto_emergencia           TEXT,              -- AD (30)
  parentesco_emergencia         TEXT,              -- AE (31)
  telefono_emergencia           TEXT,              -- AF (32)
  beneficiario_nombre           TEXT,              -- AG (33)
  beneficiario_rfc              TEXT,              -- AH (34)
  beneficiario_parentesco       TEXT,              -- AI (35)
  beneficiario_porcentaje       REAL,              -- AJ (36)
  tipo_ingreso                  TEXT,              -- AK (37) Operativo / Administrativo
  tipo_contrato                 TEXT,              -- AL (38)
  contrato1_inicio              TEXT,              -- AM (39)
  entrevista_15_dias            TEXT,              -- AN (40)
  entrevista_45_dias            TEXT,              -- AO (41)
  contrato1_vencimiento         TEXT,              -- AP (42)
  contrato2_inicio              TEXT,              -- AQ (43)
  contrato2_vencimiento         TEXT,              -- AR (44)
  contrato3_inicio              TEXT,              -- AS (45)
  contrato3_vencimiento         TEXT,              -- AT (46)
  fecha_eval_360                TEXT,              -- AU (47)
  carpeta                       TEXT,              -- AX (50) ref. Drive original (solo trazabilidad)
  jefe_directo                  TEXT,              -- AZ (52)
  correo_acceso                 TEXT,              -- BA (53)
  contrato4_inicio              TEXT,              -- BD (56)
  contrato4_vencimiento         TEXT,              -- BE (57)
  contrato5_inicio              TEXT,              -- BF (58)
  contrato5_vencimiento         TEXT,              -- BG (59)
  contrato6_inicio              TEXT,              -- BH (60)
  contrato6_vencimiento         TEXT,              -- BI (61)
  fila_sheet_origen             INTEGER,           -- trazabilidad de migración
  creado_en                     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en                TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_empleados_empresa_no ON empleados(empresa_id, no_empleado);
CREATE INDEX IF NOT EXISTS ix_empleados_persona  ON empleados(id_persona);
CREATE INDEX IF NOT EXISTS ix_empleados_curp     ON empleados(curp);
CREATE INDEX IF NOT EXISTS ix_empleados_nombre   ON empleados(nombre);
CREATE INDEX IF NOT EXISTS ix_empleados_baja     ON empleados(fecha_baja);
CREATE INDEX IF NOT EXISTS ix_empleados_correo_acceso ON empleados(correo_acceso);

-- ── USUARIOS (panel RH) ─────────────────────────────────────
--  OJO: en el Sheet los encabezados J-L están desfasados. El código GAS
--  escribe por POSICIÓN: J(10)=token, K(11)=expira, L(12)=fecha creación,
--  M(13)=id interno. La migración se hace por posición, no por encabezado.
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario          TEXT PRIMARY KEY,            -- USR001
  nombre_completo     TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash_password       TEXT NOT NULL,               -- SHA-256 hex (idéntico a GAS)
  rol                 TEXT NOT NULL,
  empresas_asignadas  TEXT,                        -- lista tal cual el Sheet
  estatus             TEXT NOT NULL DEFAULT 'Activo',
  telefono            TEXT,
  url_foto            TEXT,                        -- se reescribe a llave R2 en la migración de archivos
  token_sesion        TEXT,
  expira_token        TEXT,
  ultimo_acceso       TEXT,
  fecha_creacion      TEXT,
  creado_por          TEXT,
  id_interno          TEXT                         -- vínculo opcional a empleados
);
CREATE INDEX IF NOT EXISTS ix_usuarios_token ON usuarios(token_sesion);

-- ── EMPLEADOS_ACCESO (portal del empleado) ──────────────────
CREATE TABLE IF NOT EXISTS empleados_acceso (
  id_interno      TEXT PRIMARY KEY,
  correo          TEXT NOT NULL COLLATE NOCASE,
  hash_password   TEXT NOT NULL,
  estatus         TEXT NOT NULL DEFAULT 'Activo',
  token_sesion    TEXT,
  expira_token    TEXT,
  ultimo_acceso   TEXT
);
CREATE INDEX IF NOT EXISTS ix_acceso_correo ON empleados_acceso(correo);
CREATE INDEX IF NOT EXISTS ix_acceso_token  ON empleados_acceso(token_sesion);

-- ── RESET DE CONTRASEÑA (antes vivía en PropertiesService/Sheet) ─
CREATE TABLE IF NOT EXISTS reset_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL COLLATE NOCASE,
  tipo        TEXT NOT NULL DEFAULT 'usuario',     -- usuario | empleado
  expira      TEXT NOT NULL,
  usado       INTEGER NOT NULL DEFAULT 0
);

-- ── EVENTOS (bitácora) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_hora  TEXT NOT NULL,
  usuario     TEXT,
  rol         TEXT,
  accion      TEXT,
  detalle     TEXT,
  ip_device   TEXT
);
CREATE INDEX IF NOT EXISTS ix_eventos_fecha ON eventos(fecha_hora);

-- ── HISTORIAL (trayectoria por persona) ─────────────────────
CREATE TABLE IF NOT EXISTS historial (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  id_persona             TEXT NOT NULL,
  curp                   TEXT,
  nombre                 TEXT,
  empresa                TEXT,
  puesto                 TEXT,
  departamento           TEXT,
  sueldo_mensual         REAL,
  fecha_ingreso          TEXT,
  fecha_baja             TEXT,
  tipo_salida            TEXT,
  motivo_salida          TEXT,
  monto_finiquito        REAL,
  grupo_comercial        TEXT,
  tipo_ingreso           TEXT,
  no_empleado_historico  INTEGER
);
CREATE INDEX IF NOT EXISTS ix_historial_persona ON historial(id_persona);
CREATE INDEX IF NOT EXISTS ix_historial_curp    ON historial(curp);

-- ── MOVIMIENTOS (promociones, cambios de sueldo/puesto) ─────
--  En GAS la hoja se crea al vuelo (insertSheet) si no existe.
CREATE TABLE IF NOT EXISTS movimientos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  id_persona      TEXT NOT NULL,
  fecha           TEXT NOT NULL,
  tipo            TEXT,
  descripcion     TEXT,
  valor_antes     TEXT,
  valor_despues   TEXT,
  registrado_por  TEXT
);
CREATE INDEX IF NOT EXISTS ix_movimientos_persona ON movimientos(id_persona);

-- ── ENCUESTAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas (
  id_encuesta      TEXT PRIMARY KEY,               -- SALIDA, CLIMA …
  nombre           TEXT NOT NULL,
  tipo             TEXT,
  activa           TEXT DEFAULT 'Si',
  estructura_json  TEXT CHECK (estructura_json IS NULL OR json_valid(estructura_json))
);

CREATE TABLE IF NOT EXISTS respuestas (
  id_respuesta     TEXT PRIMARY KEY,
  id_encuesta      TEXT REFERENCES encuestas(id_encuesta),
  tipo_encuesta    TEXT,
  id_interno       TEXT,
  no_empleado      INTEGER,
  nombre_empleado  TEXT,
  empresa          TEXT,
  fecha_respuesta  TEXT,
  respuestas_json  TEXT CHECK (respuestas_json IS NULL OR json_valid(respuestas_json))
);
CREATE INDEX IF NOT EXISTS ix_respuestas_encuesta ON respuestas(id_encuesta);
CREATE INDEX IF NOT EXISTS ix_respuestas_emp      ON respuestas(id_interno);

-- ── EVALUACIONES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS procesos_eval (
  id_proceso       TEXT PRIMARY KEY,               -- EVA001
  nombre           TEXT NOT NULL,
  tipo             TEXT,
  estatus          TEXT,
  fecha_inicio     TEXT,
  fecha_cierre     TEXT,
  empresa          TEXT,
  estructura_json  TEXT CHECK (estructura_json IS NULL OR json_valid(estructura_json)),
  creado_por       TEXT,
  fecha_creacion   TEXT
);

CREATE TABLE IF NOT EXISTS evaluaciones (
  id_eval           TEXT PRIMARY KEY,
  id_proceso        TEXT REFERENCES procesos_eval(id_proceso),
  id_evaluado       TEXT,
  nombre_evaluado   TEXT,
  id_evaluador      TEXT,
  rol_evaluador     TEXT,
  estatus           TEXT,
  fecha_completada  TEXT,
  respuestas_json   TEXT CHECK (respuestas_json IS NULL OR json_valid(respuestas_json))
);
CREATE INDEX IF NOT EXISTS ix_eval_proceso   ON evaluaciones(id_proceso);
CREATE INDEX IF NOT EXISTS ix_eval_evaluador ON evaluaciones(id_evaluador);
CREATE INDEX IF NOT EXISTS ix_eval_evaluado  ON evaluaciones(id_evaluado);

-- ── NOM-035 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nom035_centros (
  grupo_comercial         TEXT PRIMARY KEY,
  razon_social            TEXT,
  domicilio               TEXT,
  actividad_principal     TEXT,
  actividades_realizadas  TEXT,
  responsable_nombre      TEXT,
  responsable_cedula      TEXT,
  responsable_puesto      TEXT
);

CREATE TABLE IF NOT EXISTS nom035_datos_trabajador (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha                   TEXT,
  id_interno              TEXT NOT NULL,
  grupo_comercial         TEXT,
  sexo                    TEXT,
  rango_edad              TEXT,
  estado_civil            TEXT,
  nivel_estudios          TEXT,
  estudios_estatus        TEXT,
  puesto                  TEXT,
  departamento            TEXT,
  tipo_puesto             TEXT,
  tipo_contratacion       TEXT,
  tipo_personal           TEXT,
  tipo_jornada            TEXT,
  rotacion_turnos         TEXT,
  tiempo_puesto           TEXT,
  tiempo_experiencia      TEXT,
  prellenados_corregidos  TEXT
);
CREATE INDEX IF NOT EXISTS ix_nom035dt_emp ON nom035_datos_trabajador(id_interno);

CREATE TABLE IF NOT EXISTS nom035_respuestas (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha                    TEXT,
  id_interno               TEXT NOT NULL,
  tipo_guia                TEXT,
  activos_grupo            INTEGER,
  gi_requiere_valoracion   TEXT,
  gi_motivo                TEXT,
  gi_respuestas_json       TEXT,
  frp_puntaje_total        REAL,
  frp_nivel_total          TEXT,
  frp_dominios_json        TEXT,
  frp_categorias_json      TEXT,
  frp_respuestas_json      TEXT,
  plan_accion              TEXT,
  filtro_clientes          TEXT,
  filtro_jefe              TEXT,
  items_aplicables         INTEGER,
  items_totales            INTEGER,
  ajuste_rango             TEXT
);
CREATE INDEX IF NOT EXISTS ix_nom035r_emp   ON nom035_respuestas(id_interno);
CREATE INDEX IF NOT EXISTS ix_nom035r_fecha ON nom035_respuestas(fecha);

-- ── ARCHIVOS (reemplaza carpetas de Drive; binarios en R2) ──
CREATE TABLE IF NOT EXISTS archivos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  id_interno       TEXT,                           -- NULL = plantilla / foto de usuario / huérfano
  categoria        TEXT NOT NULL,                  -- expediente | contrato | contrato_firmado | foto | plantilla | informe
  tipo_documento   TEXT,                           -- INE, CURP, Acta, Comprobante…
  r2_key           TEXT NOT NULL UNIQUE,
  nombre_original  TEXT,
  mime             TEXT,
  bytes            INTEGER,
  drive_id_origen  TEXT,                           -- trazabilidad de migración
  ocr_json         TEXT,                           -- caché del OCR/IA para no repetirlo
  subido_por       TEXT,
  subido_en        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_archivos_emp       ON archivos(id_interno);
CREATE INDEX IF NOT EXISTS ix_archivos_categoria ON archivos(categoria);

-- ── CONTROL DE MIGRACIONES DEL ESQUEMA ──────────────────────
CREATE TABLE IF NOT EXISTS _schema_version (
  version     TEXT PRIMARY KEY,
  aplicado_en TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.0');
