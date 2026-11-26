-- ============================================================
--  RRHH Prisma — Vistas D1  v1.0  26-nov-2026
--  Reemplazan las columnas FÓRMULA del Sheet BASE DE DATOS:
--    C  ESTATUS              =IF(L="", "Activo", "Baja")
--    D  ANTIGÜEDAD           DATEDIF Y / YM / MD  → "X AÑOS, Y MESES, Z DÍAS"
--    R  FECHA DE NACIMIENTO  desde CURP leída por la derecha (yy>30 → 19yy)
--    S  EDAD                 DATEDIF(R, HOY, "Y")
--    T  RANGO DE EDAD        <31 | 31-50 | 51-65 | >65
--    U  GÉNERO               CURP 8º carácter desde la derecha = 'M' → Femenino
--    AV PARA ANT. PROMEDIO   días (baja o hoy) - ingreso
--    AW SE TOMA EN CUENTA?   Baja → No
--  "Hoy" = fecha de Ciudad de México (UTC-6, sin horario de verano).
--  El grupo comercial se toma SIEMPRE del catálogo empresas.
-- ============================================================
DROP VIEW IF EXISTS v_empleados;
CREATE VIEW v_empleados AS
WITH base AS (
  SELECT
    e.*,
    date('now', '-6 hours') AS hoy,
    CASE
      WHEN e.curp IS NULL OR trim(e.curp) = '' OR length(e.curp) < 14 THEN NULL
      -- Igual que la fórmula del Sheet: se lee desde la DERECHA (RIGHT),
      -- así una CURP con espacio o letra de más sigue funcionando.
      ELSE printf('%04d-%s-%s',
             CASE WHEN CAST(substr(e.curp,-14,2) AS INTEGER) > 30
                  THEN 1900 ELSE 2000 END + CAST(substr(e.curp,-14,2) AS INTEGER),
             substr(e.curp,-12,2),
             substr(e.curp,-10,2))
    END AS fecha_nacimiento_calc,
    COALESCE(e.fecha_baja, date('now', '-6 hours')) AS fecha_fin
  FROM empleados e
),
calc AS (
  SELECT
    b.*,
    -- meses completos entre ingreso y fin (equivalente a DATEDIF "M")
    CASE WHEN b.fecha_ingreso IS NULL THEN NULL ELSE
      (CAST(strftime('%Y', b.fecha_fin) AS INTEGER) - CAST(strftime('%Y', b.fecha_ingreso) AS INTEGER)) * 12
      + (CAST(strftime('%m', b.fecha_fin) AS INTEGER) - CAST(strftime('%m', b.fecha_ingreso) AS INTEGER))
      - (CAST(strftime('%d', b.fecha_fin) AS INTEGER) < CAST(strftime('%d', b.fecha_ingreso) AS INTEGER))
    END AS meses_totales,
    CASE WHEN b.fecha_nacimiento_calc IS NULL THEN NULL ELSE
      (CAST(strftime('%Y', b.hoy) AS INTEGER) - CAST(strftime('%Y', b.fecha_nacimiento_calc) AS INTEGER))
      - (strftime('%m-%d', b.hoy) < strftime('%m-%d', b.fecha_nacimiento_calc))
    END AS edad_calc
  FROM base b
)
SELECT
  c.id_interno, c.id_persona, c.no_empleado,
  c.empresa_id, COALESCE(em.empresa, c.empresa)              AS empresa,
  COALESCE(em.grupo_comercial, c.grupo_comercial)            AS grupo_comercial,
  c.nombre, c.fecha_ingreso,
  CASE WHEN c.fecha_baja IS NULL THEN 'Activo' ELSE 'Baja' END AS estatus,
  CASE WHEN c.meses_totales IS NULL THEN '' ELSE
    (c.meses_totales / 12) || ' AÑOS, ' || (c.meses_totales % 12) || ' MESES, ' ||
    CAST(julianday(c.fecha_fin)
         - julianday(date(c.fecha_ingreso, '+' || c.meses_totales || ' months')) AS INTEGER)
    || ' DÍAS'
  END                                                        AS antiguedad,
  c.departamento, c.puesto, c.sueldo_mensual, c.frecuencia_pago, c.fuente_contratacion,
  c.fecha_baja, c.tipo_salida, c.motivo_salida, c.monto_finiquito,
  c.lugar_nacimiento, c.nacionalidad,
  c.fecha_nacimiento_calc                                    AS fecha_nacimiento,
  c.edad_calc                                                AS edad,
  CASE
    WHEN c.edad_calc IS NULL THEN ''
    WHEN c.edad_calc < 31 THEN '<31'
    WHEN c.edad_calc < 51 THEN '31-50'
    WHEN c.edad_calc < 66 THEN '51-65'
    ELSE '>65'
  END                                                        AS rango_edad,
  CASE
    WHEN c.curp IS NULL OR trim(c.curp) = '' THEN ''
    WHEN substr(c.curp, -8, 1) = 'M' THEN 'Femenino'
    ELSE 'Masculino'
  END                                                        AS genero,
  c.estado_civil, c.curp, c.rfc, c.nss, c.domicilio, c.escolaridad, c.correo, c.telefono,
  c.contacto_emergencia, c.parentesco_emergencia, c.telefono_emergencia,
  c.beneficiario_nombre, c.beneficiario_rfc, c.beneficiario_parentesco, c.beneficiario_porcentaje,
  c.tipo_ingreso, c.tipo_contrato,
  c.contrato1_inicio, c.entrevista_15_dias, c.entrevista_45_dias, c.contrato1_vencimiento,
  c.contrato2_inicio, c.contrato2_vencimiento, c.contrato3_inicio, c.contrato3_vencimiento,
  c.fecha_eval_360,
  CASE WHEN c.fecha_ingreso IS NULL THEN NULL
       ELSE CAST(julianday(c.fecha_fin) - julianday(c.fecha_ingreso) AS INTEGER) END
                                                             AS para_ant_promedio,
  CASE WHEN c.fecha_baja IS NULL THEN 'Sí' ELSE 'No' END    AS se_toma_en_cuenta,
  c.carpeta, c.jefe_directo, c.correo_acceso,
  c.contrato4_inicio, c.contrato4_vencimiento, c.contrato5_inicio, c.contrato5_vencimiento,
  c.contrato6_inicio, c.contrato6_vencimiento,
  c.creado_en, c.actualizado_en
FROM calc c
LEFT JOIN empresas em ON em.id = c.empresa_id;
