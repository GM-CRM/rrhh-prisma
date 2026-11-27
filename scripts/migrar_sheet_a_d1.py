# -*- coding: utf-8 -*-
"""
RRHH Prisma — Migración Google Sheet (.xlsx) → Cloudflare D1
v1.4  26-nov-2026

Uso (desde la raíz del repo):
    pip install openpyxl
    python scripts/migrar_sheet_a_d1.py "RUTA\\BD_PWA_Multimedia.xlsx"

Genera:
    db/seed/seed.sql           → se carga con wrangler d1 execute
    db/seed/reporte_calidad.md → avisos para revisar ANTES de cargar

Reglas:
  * Lee VALORES (no fórmulas). Las columnas fórmula del Sheet no se migran:
    las calcula la vista v_empleados.
  * Fechas serial Excel / datetime → 'YYYY-MM-DD' (fecha-hora → ISO 8601).
  * Vacío, 'nan' → NULL. CURP/RFC/NSS/teléfonos → texto.
  * NSS numérico se rellena a 11 dígitos (el Sheet perdió ceros a la izquierda).
  * Textos en columnas numéricas (ej. finiquito 'N/A', 'No se generó…',
    porcentaje '50-50') se conservan tal cual: cero omisiones.
  * USUARIOS se lee por POSICIÓN (encabezados J-L desfasados en el Sheet).
  * El script es re-ejecutable: primero vacía las tablas.
"""
import sys, os, re, json, datetime, collections

try:
    import openpyxl
except ImportError:
    sys.exit("Falta openpyxl →  pip install openpyxl")

EPOCH = datetime.date(1899, 12, 30)
avisos = collections.defaultdict(list)


# ── Conversores ──────────────────────────────────────────────
def vacio(v):
    return v is None or (isinstance(v, str) and v.strip() in ("", "nan", "NaN", "None"))

def txt(v):
    if vacio(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    return str(v).replace("\r\n", "\n").strip()

def num(v):
    """Número si se puede; si es texto no numérico se conserva el texto."""
    if vacio(v):
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else round(float(v), 2)
    s = str(v).strip().replace("$", "").replace(",", "")
    try:
        f = float(s)
        return int(f) if f.is_integer() else round(f, 2)
    except ValueError:
        return str(v).strip()

def entero(v):
    n = num(v)
    return n if isinstance(n, int) else (int(n) if isinstance(n, float) else n)

def fecha(v, campo="", ref=""):
    if vacio(v):
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        if 1 <= v < 80000:
            return (EPOCH + datetime.timedelta(days=int(v))).isoformat()
    s = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return m.group(0)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        d, mth, y = m.groups()
        return f"{y}-{int(mth):02d}-{int(d):02d}"
    avisos["Fechas no reconocidas (se guardan como texto)"].append(f"{ref} · {campo}: {s!r}")
    return s

MX_OFFSET = datetime.timedelta(hours=6)   # Ciudad de México = UTC-6 (sin horario de verano desde 2022)


def fecha_hora(v):
    """Fecha-hora del Sheet (hora local de México) → ISO 8601 UTC con 'Z'."""
    if vacio(v):
        return None
    if isinstance(v, datetime.datetime):
        return (v + MX_OFFSET).isoformat(timespec="milliseconds") + "Z"
    if isinstance(v, (int, float)) and 1 <= v < 80000:
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=float(v))
        return (dt + MX_OFFSET).isoformat(timespec="milliseconds") + "Z"
    return str(v).strip()

def nss(v, ref):
    if vacio(v):
        return None
    if isinstance(v, (int, float)):
        s = str(int(v)).zfill(11)
        return s
    s = str(v).strip()
    if not re.fullmatch(r"\d{11}", s):
        avisos["NSS con formato distinto a 11 dígitos (se conserva)"].append(f"{ref}: {s!r}")
    return s

def telefono(v):
    t = txt(v)
    return t

def json_txt(v, ref, campo):
    if vacio(v):
        return None
    s = str(v)
    try:
        json.loads(s)
    except Exception:
        avisos["JSON inválido (se conserva como texto en columnas sin validación)"].append(f"{ref} · {campo}")
    return s

def sql(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


# ── Lectura ──────────────────────────────────────────────────
def filas(wb, hoja, ncols):
    if hoja not in wb.sheetnames:
        return []
    out = []
    for i, r in enumerate(wb[hoja].iter_rows(min_row=2, values_only=True), start=2):
        r = list(r) + [None] * (ncols - len(r))
        r = r[:ncols]
        if all(vacio(x) for x in r):
            continue
        out.append((i, r))
    return out

MAX_BYTES = 0   # 0 = una fila por INSERT (lo más compatible con el importador de D1; la fila más grande ≈ 12 KB)


def inserts(tabla, cols, registros):
    """Agrupa filas en INSERTs de máx. MAX_BYTES. Una fila más grande que eso va sola."""
    cab = f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES\n  "
    out, lote, tam = [], [], len(cab.encode("utf-8"))
    for reg in registros:
        fila = "(" + ", ".join(sql(x) for x in reg) + ")"
        b = len(fila.encode("utf-8")) + 4
        if lote and tam + b > MAX_BYTES:
            out.append(cab + ",\n  ".join(lote) + ";")
            lote, tam = [], len(cab.encode("utf-8"))
        lote.append(fila)
        tam += b
    if lote:
        out.append(cab + ",\n  ".join(lote) + ";")
    for st in out:
        if len(st.encode("utf-8")) > 95_000:
            avisos["Fila demasiado grande para D1 (>95 KB): revisar"].append(f"{tabla}: {len(st.encode('utf-8'))} bytes")
    return out


# Lleva una base creada con schema v1.0 a v1.1 (idempotente; en una base nueva con v1.1 no cambia nada)
AJUSTE_V11 = [
    "DROP INDEX IF EXISTS ux_empleados_empresa_no;",
    "CREATE INDEX IF NOT EXISTS ix_empleados_empresa_no ON empleados(empresa_id, no_empleado);",
    "DROP TABLE IF EXISTS evaluaciones;",
    """CREATE TABLE evaluaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, id_eval TEXT NOT NULL,
  id_proceso TEXT REFERENCES procesos_eval(id_proceso), id_evaluado TEXT, nombre_evaluado TEXT,
  id_evaluador TEXT, rol_evaluador TEXT, estatus TEXT, fecha_completada TEXT,
  respuestas_json TEXT CHECK (respuestas_json IS NULL OR json_valid(respuestas_json)));""",
    "CREATE INDEX IF NOT EXISTS ix_eval_id_eval ON evaluaciones(id_eval);",
    "CREATE INDEX IF NOT EXISTS ix_eval_proceso ON evaluaciones(id_proceso);",
    "CREATE INDEX IF NOT EXISTS ix_eval_evaluador ON evaluaciones(id_evaluador);",
    "CREATE INDEX IF NOT EXISTS ix_eval_evaluado ON evaluaciones(id_evaluado);",
    "INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.1');",
    # v1.2: eventos con columna empresa
    "DROP TABLE IF EXISTS eventos;",
    """CREATE TABLE eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, fecha_hora TEXT NOT NULL, usuario TEXT, rol TEXT,
  accion TEXT, detalle TEXT, empresa TEXT, ip_device TEXT);""",
    "CREATE INDEX IF NOT EXISTS ix_eventos_fecha ON eventos(fecha_hora);",
    "INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.2');",
    "CREATE TABLE IF NOT EXISTS _config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);",
    "INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.3');",
    "CREATE TABLE IF NOT EXISTS carpetas_drive (drive_id TEXT PRIMARY KEY, id_interno TEXT NOT NULL);",
    "INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.4');",
]


def fecha_o_texto(v, campo, ref):
    """Entrevistas 15/45: registros viejos guardan fecha; los nuevos 'Sí'/'No'. Ambos son válidos."""
    if isinstance(v, str) and v.strip().lower() in ("sí", "si", "no"):
        return v.strip()
    return fecha(v, campo, ref)


def main(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    out = [
        "-- Generado por migrar_sheet_a_d1.py  " + datetime.datetime.now().isoformat(timespec="seconds"),
        "-- Fuente: " + os.path.basename(xlsx),
        "PRAGMA defer_foreign_keys = ON;",
    ] + AJUSTE_V11
    for t in ["archivos", "movimientos", "nom035_respuestas", "nom035_datos_trabajador", "nom035_centros",
              "evaluaciones", "procesos_eval", "respuestas", "encuestas", "historial", "eventos",
              "reset_tokens", "empleados_acceso", "usuarios", "empleados", "empresas"]:
        out.append(f"DELETE FROM {t};")
    out.append("DELETE FROM sqlite_sequence;")
    conteo = {}

    # ── EMPRESAS ─────────────────────────────────────────────
    emp_rows = filas(wb, "EMPRESAS", 7)
    empresas = {}
    for i, r in emp_rows:
        empresas[txt(r[2])] = txt(r[0])

    # ── EMPLEADOS ────────────────────────────────────────────
    base = filas(wb, "BASE DE DATOS", 61)
    normal = lambda s: re.sub(r"[\s\.]+", " ", (s or "").upper()).strip()
    emp_norm = {normal(k): v for k, v in empresas.items()}
    prefijos = collections.defaultdict(collections.Counter)
    regs, vistos = [], set()
    for i, r in base:
        ref = f"fila {i}"
        idi = txt(r[50])
        if not idi:
            avisos["Empleados SIN ID INTERNO (NO se migran)"].append(f"{ref}: {txt(r[4])}")
            continue
        if idi in vistos:
            avisos["ID INTERNO duplicado (NO se migra la 2ª aparición)"].append(f"{ref}: {idi}")
            continue
        vistos.add(idi)
        ref = f"{idi} ({ref})"
        empresa_txt = txt(r[5])
        empresa_txt = empresa_txt.replace("\n", " ") if empresa_txt else None
        eid = empresas.get(empresa_txt) or emp_norm.get(normal(empresa_txt))
        if empresa_txt and not eid:
            avisos["Empresa que no está en el catálogo EMPRESAS"].append(f"{ref}: {empresa_txt!r}")
        m = re.match(r"^([A-Za-z]+)", idi)
        if eid and m:
            prefijos[eid][m.group(1).upper()] += 1
        curp = txt(r[22])
        if curp and len(curp) != 18:
            avisos["CURP con longitud distinta de 18"].append(f"{ref}: {curp!r}")
        if not curp:
            avisos["Empleados sin CURP (sin edad/género calculados)"].append(ref)
        F = lambda k, c: fecha(r[k], c, ref)
        regs.append([
            idi, txt(r[54]), entero(r[0]), eid, empresa_txt, txt(r[53]), txt(r[4]) or "",
            F(1, "FECHA DE INGRESO"), txt(r[6]), txt(r[7]), num(r[8]), txt(r[9]), txt(r[10]),
            F(11, "FECHA DE BAJA"), txt(r[12]), txt(r[13]), num(r[14]), txt(r[15]), txt(r[16]),
            txt(r[21]), curp, txt(r[23]), nss(r[24], ref), txt(r[25]), txt(r[26]), txt(r[27]),
            telefono(r[28]), txt(r[29]), txt(r[30]), telefono(r[31]), txt(r[32]), txt(r[33]),
            txt(r[34]), num(r[35]), txt(r[36]), txt(r[37]),
            F(38, "INICIO 1er CONTRATO"), fecha_o_texto(r[39], "ENTREVISTA 15", ref),
            fecha_o_texto(r[40], "ENTREVISTA 45", ref),
            F(41, "VENC 1er CONTRATO"), F(42, "INICIO 2o"), F(43, "VENC 2o"), F(44, "INICIO 3o"),
            F(45, "VENC 3o"), F(46, "EVAL 360"), txt(r[49]), txt(r[51]), txt(r[52]),
            F(55, "INICIO 4o"), F(56, "VENC 4o"), F(57, "INICIO 5o"), F(58, "VENC 5o"),
            F(59, "INICIO 6o"), F(60, "VENC 6o"), i,
        ])
    nombre_emp = {v: k for k, v in empresas.items()}
    dup = collections.Counter((x[3], x[2]) for x in regs)
    for (eid, no), c in dup.items():
        if c > 1 and no is not None:
            avisos["Informativo: NO. EMPLEADO repetido en la misma empresa (normal en reingresos, cambios de puesto o registros anteriores en baja; manda ID INTERNO)"].append(
                f"{nombre_emp.get(eid, eid)} · No. {no} ×{c}: " + ", ".join(x[0] for x in regs if x[3] == eid and x[2] == no))

    # empresas (con abreviatura deducida de los ID INTERNO)
    emp_regs = []
    for i, r in emp_rows:
        eid = txt(r[0])
        abrev = prefijos[eid].most_common(1)[0][0] if prefijos[eid] else None
        emp_regs.append([eid, txt(r[1]), txt(r[2]), txt(r[3]), txt(r[4]), txt(r[5]), txt(r[6]), abrev])
    out += inserts("empresas", ["id", "grupo_comercial", "empresa", "rfc", "domicilio_fiscal",
                                "actividad_economica", "representante_legal", "abreviatura"], emp_regs)
    conteo["empresas"] = len(emp_regs)

    out += inserts("empleados", [
        "id_interno", "id_persona", "no_empleado", "empresa_id", "empresa", "grupo_comercial", "nombre",
        "fecha_ingreso", "departamento", "puesto", "sueldo_mensual", "frecuencia_pago", "fuente_contratacion",
        "fecha_baja", "tipo_salida", "motivo_salida", "monto_finiquito", "lugar_nacimiento", "nacionalidad",
        "estado_civil", "curp", "rfc", "nss", "domicilio", "escolaridad", "correo",
        "telefono", "contacto_emergencia", "parentesco_emergencia", "telefono_emergencia",
        "beneficiario_nombre", "beneficiario_rfc", "beneficiario_parentesco", "beneficiario_porcentaje",
        "tipo_ingreso", "tipo_contrato",
        "contrato1_inicio", "entrevista_15_dias", "entrevista_45_dias", "contrato1_vencimiento",
        "contrato2_inicio", "contrato2_vencimiento", "contrato3_inicio", "contrato3_vencimiento",
        "fecha_eval_360", "carpeta", "jefe_directo", "correo_acceso",
        "contrato4_inicio", "contrato4_vencimiento", "contrato5_inicio", "contrato5_vencimiento",
        "contrato6_inicio", "contrato6_vencimiento", "fila_sheet_origen"], regs)
    conteo["empleados"] = len(regs)

    # Equivalencia carpeta de Drive → ID INTERNO (columna CARPETA)
    cd = []
    for x in regs:
        m = re.search(r"/folders/([a-zA-Z0-9_-]+)", x[45] or "")
        if m:
            cd.append([m.group(1), x[0]])
    carpetas_sql = ["CREATE TABLE IF NOT EXISTS carpetas_drive (drive_id TEXT PRIMARY KEY, id_interno TEXT NOT NULL);"] + \
        [s_.replace("INSERT INTO", "INSERT OR IGNORE INTO", 1) for s_ in inserts("carpetas_drive", ["drive_id", "id_interno"], cd)]
    out += ["DELETE FROM carpetas_drive;"] + carpetas_sql[1:]
    conteo["carpetas_drive"] = len(cd)
    conteo["empleados_activos"] = sum(1 for x in regs if not x[13])
    conteo["empleados_baja"] = sum(1 for x in regs if x[13])
    conteo["suma_sueldos_activos"] = round(sum(x[10] for x in regs if not x[13] and isinstance(x[10], (int, float))), 2)
    conteo["suma_finiquitos"] = round(sum(x[16] for x in regs if isinstance(x[16], (int, float))), 2)

    # ── USUARIOS (por posición) ──────────────────────────────
    u = []
    for i, r in filas(wb, "USUARIOS", 13):
        u.append([txt(r[0]), txt(r[1]), (txt(r[2]) or "").lower(), txt(r[3]), txt(r[4]), txt(r[5]),
                  txt(r[6]) or "Activo", telefono(r[7]), txt(r[8]), txt(r[9]), fecha_hora(r[10]),
                  fecha_hora(r[11]), txt(r[12])])
    out += inserts("usuarios", ["id_usuario", "nombre_completo", "email", "hash_password", "rol",
                                "empresas_asignadas", "estatus", "telefono", "url_foto", "token_sesion",
                                "expira_token", "fecha_creacion", "id_interno"], u)
    conteo["usuarios"] = len(u)

    # ── EMPLEADOS_ACCESO ─────────────────────────────────────
    a = [[txt(r[0]), (txt(r[1]) or "").lower(), txt(r[2]), txt(r[3]) or "Activo", txt(r[4]),
          fecha_hora(r[5]), fecha_hora(r[6])] for i, r in filas(wb, "EMPLEADOS_ACCESO", 7)]
    out += inserts("empleados_acceso", ["id_interno", "correo", "hash_password", "estatus", "token_sesion",
                                        "expira_token", "ultimo_acceso"], a)
    conteo["empleados_acceso"] = len(a)

    # ── EVENTOS ──────────────────────────────────────────────
    # GAS escribe 7 columnas: fecha, usuario, rol, acción, detalle, EMPRESA, DISPOSITIVO
    ev = [[fecha_hora(r[0]) or "", txt(r[1]), txt(r[2]), txt(r[3]), txt(r[4]), txt(r[5]), txt(r[6])]
          for i, r in filas(wb, "EVENTOS", 7)]
    out += inserts("eventos", ["fecha_hora", "usuario", "rol", "accion", "detalle", "empresa", "ip_device"], ev)
    conteo["eventos"] = len(ev)

    # ── HISTORIAL ────────────────────────────────────────────
    h = []
    for i, r in filas(wb, "HISTORIAL", 15):
        ref = f"HISTORIAL fila {i}"
        h.append([txt(r[0]), txt(r[1]), txt(r[2]), txt(r[3]), txt(r[4]), txt(r[5]), num(r[6]),
                  fecha(r[7], "FECHA_INGRESO", ref), fecha(r[8], "FECHA_BAJA", ref), txt(r[9]), txt(r[10]),
                  num(r[11]), txt(r[12]), txt(r[13]), entero(r[14])])
    out += inserts("historial", ["id_persona", "curp", "nombre", "empresa", "puesto", "departamento",
                                 "sueldo_mensual", "fecha_ingreso", "fecha_baja", "tipo_salida", "motivo_salida",
                                 "monto_finiquito", "grupo_comercial", "tipo_ingreso", "no_empleado_historico"], h)
    conteo["historial"] = len(h)

    # ── MOVIMIENTOS (si existe la hoja) ──────────────────────
    mv = [[txt(r[0]), fecha(r[1], "FECHA", f"MOVIMIENTOS fila {i}"), txt(r[2]), txt(r[3]), txt(r[4]),
           txt(r[5]), txt(r[6])] for i, r in filas(wb, "MOVIMIENTOS", 7)]
    out += inserts("movimientos", ["id_persona", "fecha", "tipo", "descripcion", "valor_antes",
                                   "valor_despues", "registrado_por"], mv)
    conteo["movimientos"] = len(mv)

    # ── ENCUESTAS / RESPUESTAS ───────────────────────────────
    en = [[txt(r[0]), txt(r[1]), txt(r[2]), txt(r[3]), json_txt(r[4], f"ENCUESTAS {txt(r[0])}", "ESTRUCTURA")]
          for i, r in filas(wb, "ENCUESTAS", 5)]
    out += inserts("encuestas", ["id_encuesta", "nombre", "tipo", "activa", "estructura_json"], en)
    conteo["encuestas"] = len(en)
    rs = [[txt(r[0]), txt(r[1]), txt(r[2]), txt(r[3]), entero(r[4]), txt(r[5]), txt(r[6]), fecha_hora(r[7]),
           json_txt(r[8], f"RESPUESTAS {txt(r[0])}", "RESPUESTAS")] for i, r in filas(wb, "RESPUESTAS", 9)]
    out += inserts("respuestas", ["id_respuesta", "id_encuesta", "tipo_encuesta", "id_interno", "no_empleado",
                                  "nombre_empleado", "empresa", "fecha_respuesta", "respuestas_json"], rs)
    conteo["respuestas"] = len(rs)

    # ── EVALUACIONES ─────────────────────────────────────────
    pe = [[txt(r[0]), txt(r[1]), txt(r[2]), txt(r[3]), fecha_hora(r[4]), fecha_hora(r[5]), txt(r[6]),
           json_txt(r[7], f"PROCESOS_EVAL {txt(r[0])}", "ESTRUCTURA"), txt(r[8]), fecha_hora(r[9])]
          for i, r in filas(wb, "PROCESOS_EVAL", 10)]
    out += inserts("procesos_eval", ["id_proceso", "nombre", "tipo", "estatus", "fecha_inicio", "fecha_cierre",
                                     "empresa", "estructura_json", "creado_por", "fecha_creacion"], pe)
    conteo["procesos_eval"] = len(pe)
    c_ev = collections.Counter(txt(r[0]) for i, r in filas(wb, "EVALUACIONES", 9))
    for k, c in c_ev.items():
        if c > 1:
            avisos["ID_EVAL repetido en EVALUACIONES (se migran todos con id propio)"].append(f"{k} ×{c}")
    ev2 = [[txt(r[0]), txt(r[1]), txt(r[2]), txt(r[3]), txt(r[4]), txt(r[5]), txt(r[6]), fecha_hora(r[7]),
            json_txt(r[8], f"EVALUACIONES {txt(r[0])}", "RESPUESTAS")] for i, r in filas(wb, "EVALUACIONES", 9)]
    out += inserts("evaluaciones", ["id_eval", "id_proceso", "id_evaluado", "nombre_evaluado", "id_evaluador",
                                    "rol_evaluador", "estatus", "fecha_completada", "respuestas_json"], ev2)
    conteo["evaluaciones"] = len(ev2)

    # ── NOM-035 ──────────────────────────────────────────────
    nc = [[txt(x) for x in r] for i, r in filas(wb, "NOM035_CENTROS", 8)]
    out += inserts("nom035_centros", ["grupo_comercial", "razon_social", "domicilio", "actividad_principal",
                                      "actividades_realizadas", "responsable_nombre", "responsable_cedula",
                                      "responsable_puesto"], nc)
    conteo["nom035_centros"] = len(nc)
    nd = [[fecha_hora(r[0])] + [txt(x) for x in r[1:]] for i, r in filas(wb, "NOM035_DATOS_TRABAJADOR", 18)]
    out += inserts("nom035_datos_trabajador", ["fecha", "id_interno", "grupo_comercial", "sexo", "rango_edad",
                                               "estado_civil", "nivel_estudios", "estudios_estatus", "puesto",
                                               "departamento", "tipo_puesto", "tipo_contratacion", "tipo_personal",
                                               "tipo_jornada", "rotacion_turnos", "tiempo_puesto",
                                               "tiempo_experiencia", "prellenados_corregidos"], nd)
    conteo["nom035_datos_trabajador"] = len(nd)
    nr = []
    for i, r in filas(wb, "NOM035_RESPUESTAS", 18):
        ref = f"NOM035_RESPUESTAS fila {i}"
        nr.append([fecha_hora(r[0]), txt(r[1]), txt(r[2]), entero(r[3]), txt(r[4]), txt(r[5]),
                   json_txt(r[6], ref, "GI_RESPUESTAS"), num(r[7]), txt(r[8]),
                   json_txt(r[9], ref, "FRP_DOMINIOS"), json_txt(r[10], ref, "FRP_CATEGORIAS"),
                   json_txt(r[11], ref, "FRP_RESPUESTAS"), txt(r[12]), txt(r[13]), txt(r[14]),
                   entero(r[15]), entero(r[16]), txt(r[17])])
    out += inserts("nom035_respuestas", ["fecha", "id_interno", "tipo_guia", "activos_grupo",
                                         "gi_requiere_valoracion", "gi_motivo", "gi_respuestas_json",
                                         "frp_puntaje_total", "frp_nivel_total", "frp_dominios_json",
                                         "frp_categorias_json", "frp_respuestas_json", "plan_accion",
                                         "filtro_clientes", "filtro_jefe", "items_aplicables", "items_totales",
                                         "ajuste_rango"], nr)
    conteo["nom035_respuestas"] = len(nr)

    # ── Escribir ─────────────────────────────────────────────
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    destino = os.path.join(raiz, "db", "seed")
    os.makedirs(destino, exist_ok=True)
    with open(os.path.join(destino, "seed.sql"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out) + "\n")
    # Archivo aparte: solo la equivalencia de carpetas (se puede cargar sin tocar lo demás)
    with open(os.path.join(destino, "carpetas_drive.sql"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(carpetas_sql) + "\n")
    with open(os.path.join(destino, "conteos_esperados.json"), "w", encoding="utf-8") as f:
        json.dump(conteo, f, ensure_ascii=False, indent=2)

    rep = ["# Reporte de calidad — migración Sheet → D1",
           f"Generado: {datetime.datetime.now():%Y-%m-%d %H:%M}  ·  Fuente: `{os.path.basename(xlsx)}`", "",
           "## Conteos que deben cuadrar en D1", ""]
    rep += [f"- **{k}**: {v}" for k, v in conteo.items()]
    rep += ["", "## Avisos (revisar; ninguno detiene la carga)", ""]
    if not avisos:
        rep.append("Sin avisos.")
    for k, lst in avisos.items():
        rep.append(f"### {k} — {len(lst)}")
        rep += [f"- {x}" for x in lst[:200]]
        if len(lst) > 200:
            rep.append(f"- … y {len(lst) - 200} más")
        rep.append("")
    with open(os.path.join(destino, "reporte_calidad.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(rep) + "\n")

    print("✅ db/seed/seed.sql generado")
    for k, v in conteo.items():
        print(f"   {k:<26} {v}")
    print(f"⚠️  {sum(len(v) for v in avisos.values())} avisos → db/seed/reporte_calidad.md")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit('Uso: python scripts/migrar_sheet_a_d1.py "RUTA\\BD_PWA_Multimedia.xlsx"')
    main(sys.argv[1])
