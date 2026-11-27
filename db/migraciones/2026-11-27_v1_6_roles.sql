-- ============================================================
--  Migración v1.6 (base de desarrollo): roles y permisos
--  Ejecutar UNA vez:
--    npx wrangler d1 execute <BASE> --remote --file=db/migraciones/2026-11-27_v1_6_roles.sql
--  Si dice "duplicate column name: grupos_asignados", ya estaba aplicada.
-- ============================================================
ALTER TABLE usuarios ADD COLUMN grupos_asignados TEXT;

CREATE TABLE IF NOT EXISTS roles (
  id_rol          TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  descripcion     TEXT,
  permisos_json   TEXT NOT NULL DEFAULT '{}',
  es_sistema      INTEGER NOT NULL DEFAULT 0,
  color           TEXT,
  fecha_creacion  TEXT,
  creado_por      TEXT
);
INSERT OR IGNORE INTO roles (id_rol, nombre, descripcion, permisos_json, es_sistema, color, fecha_creacion, creado_por) VALUES ('ROL001', 'Administrador', 'Acceso total, incluidos usuarios, roles y configuración.', '{"indicadores":["ver","exportar"],"alta":["crear"],"baja":["crear"],"expedientes":["ver","editar","documentos","exportar"],"contratos":["generar","plantillas"],"personas":["ver","catalogos"],"evaluaciones":["ver","administrar"],"encuestas":["ver","editar","exportar"],"nom035":["ver","administrar"],"usuarios":["administrar"]}', 1, '#A35BFF', '2026-11-27T00:00:00Z', 'sistema');
INSERT OR IGNORE INTO roles (id_rol, nombre, descripcion, permisos_json, es_sistema, color, fecha_creacion, creado_por) VALUES ('ROL002', 'Auxiliar', 'Opera altas, bajas y expedientes de sus empresas.', '{"indicadores":["ver","exportar"],"alta":["crear"],"baja":["crear"],"expedientes":["ver","editar","documentos","exportar"],"contratos":["generar"],"personas":["ver","catalogos"],"evaluaciones":["ver","administrar"],"encuestas":["ver","exportar"],"nom035":["ver"]}', 1, '#5B7CFF', '2026-11-27T00:00:00Z', 'sistema');
INSERT OR IGNORE INTO roles (id_rol, nombre, descripcion, permisos_json, es_sistema, color, fecha_creacion, creado_por) VALUES ('ROL003', 'Solo consulta', 'Ve tableros, expedientes y directorio sin modificar nada.', '{"indicadores":["ver"],"expedientes":["ver"],"personas":["ver"],"evaluaciones":["ver"],"encuestas":["ver"],"nom035":["ver"]}', 0, '#2FE0C8', '2026-11-27T00:00:00Z', 'sistema');

SELECT id_rol, nombre FROM roles;
