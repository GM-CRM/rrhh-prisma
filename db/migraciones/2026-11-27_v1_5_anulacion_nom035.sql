-- Base de PRUEBAS ya cargada (schema v1.4) → v1.5. Se corre UNA sola vez:
--   npx wrangler d1 execute rrhh-prisma-dev --remote --file=db/migraciones/2026-11-27_v1_5_anulacion_nom035.sql
-- (Producción no la necesita: el día del corte se crea con schema.sql v1.5 y el seed ya trae la corrección.)
ALTER TABLE nom035_respuestas ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nom035_respuestas ADD COLUMN motivo_anulacion TEXT;
ALTER TABLE nom035_respuestas ADD COLUMN anulada_por TEXT;
ALTER TABLE nom035_respuestas ADD COLUMN anulada_en TEXT;
ALTER TABLE nom035_datos_trabajador ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nom035_datos_trabajador ADD COLUMN motivo_anulacion TEXT;
ALTER TABLE nom035_datos_trabajador ADD COLUMN anulada_por TEXT;
ALTER TABLE nom035_datos_trabajador ADD COLUMN anulada_en TEXT;
INSERT OR IGNORE INTO _schema_version(version) VALUES ('1.5');
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
