-- ─────────────────────────────────────────────────────────────────────────
-- Corrección F21 · 27-nov-2026
-- Respuestas NOM-035 que el sistema anterior (GAS) guardó a nombre de OTRA
-- persona con el mismo No. de empleado. No se borran: se marcan como
-- anuladas, con su motivo, y dejan de contar en resultados, informe 7.7 y
-- expediente. migrar_sheet_a_d1.py agrega este archivo al final de seed.sql,
-- así que se aplica cada vez que se recarga la base (pruebas y producción).
-- Se ubican por ID INTERNO + minuto de la respuesta (FECHA del Sheet, UTC).
-- ─────────────────────────────────────────────────────────────────────────
UPDATE nom035_respuestas SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (90), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK53).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CTPM50' AND substr(fecha, 1, 16) = '2026-09-07T17:00' AND anulada = 0;
UPDATE nom035_datos_trabajador SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (90), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK53).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CTPM50' AND substr(fecha, 1, 16) = '2026-09-07T17:00' AND anulada = 0;
UPDATE nom035_respuestas SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (198), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK79).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CTPM114' AND substr(fecha, 1, 16) = '2026-09-04T20:19' AND anulada = 0;
UPDATE nom035_datos_trabajador SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (198), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK79).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CTPM114' AND substr(fecha, 1, 16) = '2026-09-04T20:19' AND anulada = 0;
UPDATE nom035_respuestas SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (198), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK79).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CIT57' AND substr(fecha, 1, 16) = '2026-09-07T21:21' AND anulada = 0;
UPDATE nom035_datos_trabajador SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona de GoKartMania con el mismo No. de empleado (198), no el titular (dado de baja). Esa persona volvió a contestar el 09-sep-2026 con su propio registro (GOK79).', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'CIT57' AND substr(fecha, 1, 16) = '2026-09-07T21:21' AND anulada = 0;
UPDATE nom035_respuestas SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona con el mismo No. de empleado (118), no la titular (dada de baja). Por sus datos es personal de seguridad de Citadella; RH debe identificarlo para que la conteste con su propio registro.', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'NM16' AND substr(fecha, 1, 16) = '2026-09-06T00:53' AND anulada = 0;
UPDATE nom035_datos_trabajador SET anulada = 1, motivo_anulacion = 'F21: La contestó otra persona con el mismo No. de empleado (118), no la titular (dada de baja). Por sus datos es personal de seguridad de Citadella; RH debe identificarlo para que la conteste con su propio registro.', anulada_por = 'Migración Cloudflare (F21), autorizado por Rafael Errazu', anulada_en = '2026-11-27T06:25:00.000Z'
  WHERE id_interno = 'NM16' AND substr(fecha, 1, 16) = '2026-09-06T00:53' AND anulada = 0;
