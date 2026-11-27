// ============================================================
//  Plantillas de correo — copiadas SIN CAMBIOS desde Código.gs (GAS)
//  getPlantillaBienvenida · getPlantillaResetPassword · getPlantillaAccesoEmpleado
// ============================================================
export var EMAIL_FROM_NAME = "RRHH Prisma";

export function getPlantillaBienvenida(nombre, email, password, rol) {
  var modulos = rol === "Administrador"
    ? [
        ["📊","Indicadores","KPIs, gráficas y métricas de la plantilla laboral"],
        ["➕","Alta de Personal","Registrar nuevos colaboradores con OCR inteligente"],
        ["🚪","Baja de Personal","Procesar salidas y generar encuesta de salida"],
        ["📁","Expedientes","Consultar y editar perfiles de empleados"],
        ["📋","Encuestas","Gestionar encuestas y analizar resultados"],
        ["👥","Usuarios","Administrar accesos y permisos del sistema"]
      ]
    : [
        ["📊","Indicadores","KPIs de tus empresas asignadas"],
        ["➕","Alta de Personal","Registrar nuevos colaboradores"],
        ["🚪","Baja de Personal","Procesar salidas de personal"],
        ["📁","Expedientes","Consultar y editar perfiles"],
        ["📋","Encuestas","Ver resultados y respuestas"],
        ["👤","Mi Perfil","Actualizar tus datos personales"]
      ];

  var modulosHTML = modulos.map(function(m){
    return '<tr>'
      + '<td style="padding:10px 12px;vertical-align:top;width:36px;">'
      + '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed20,#a855f720);'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.1rem;">'+m[0]+'</div></td>'
      + '<td style="padding:10px 12px;vertical-align:top;">'
      + '<p style="margin:0;font-size:.9rem;font-weight:700;color:#0d1b3e;">'+m[1]+'</p>'
      + '<p style="margin:2px 0 0;font-size:.8rem;color:#64748b;">'+m[2]+'</p>'
      + '</td></tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Bienvenido a RRHH Prisma</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#f0f0ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;}'
    + '.email-wrap{max-width:580px;margin:32px auto;padding:0 16px;}'
    + '.card{background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,.12);}'
    + '.header{background:linear-gradient(135deg,#0d1b3e 0%,#1e0a3e 100%);padding:40px 32px;text-align:center;}'
    + '.header-logo{width:72px;height:72px;border-radius:18px;margin:0 auto 16px;display:block;}'
    + '.header h1{margin:0 0 4px;font-size:1.5rem;font-weight:800;color:#ffffff;letter-spacing:.02em;}'
    + '.header h1 span{color:#a78bfa;}'
    + '.header p{margin:0;font-size:.85rem;color:rgba(255,255,255,.55);}'
    + '.body{padding:32px;}'
    + '.greeting{font-size:1.05rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}'
    + '.txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 24px;}'
    + '.creds-box{background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1.5px solid #ddd6fe;border-radius:14px;padding:20px;margin:0 0 24px;}'
    + '.creds-title{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;margin:0 0 14px;}'
    + '.cred-row{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #ede9fe;}'
    + '.cred-row:last-child{border-bottom:none;padding-bottom:0;}'
    + '.cred-label{font-size:.78rem;color:#6b7280;width:110px;flex-shrink:0;}'
    + '.cred-value{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}'
    + '.modules-title{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:0 0 12px;}'
    + '.modules-table{width:100%;border-collapse:collapse;}'
    + '.btn-wrap{text-align:center;padding:8px 0 4px;}'
    + '.btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#ffffff !important;text-decoration:none;font-weight:700;font-size:.95rem;padding:14px 40px;border-radius:12px;letter-spacing:.01em;}'
    + '.warning{background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px 16px;margin:20px 0 0;font-size:.82rem;color:#92400e;line-height:1.5;}'
    + '.footer{background:#f8f7ff;padding:20px 32px;text-align:center;border-top:1px solid #ede9fe;}'
    + '.footer p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}'
    + '@media only screen and (max-width:600px){'
    + '.email-wrap{margin:0;padding:0;}'
    + '.card{border-radius:0;}'
    + '.header{padding:28px 20px;}'
    + '.body{padding:24px 20px;}'
    + '.footer{padding:16px 20px;}'
    + '.cred-row{flex-direction:column;align-items:flex-start;gap:2px;}'
    + '.cred-label{width:auto;}'
    + '}'
    + '</style></head><body>'
    + '<div class="email-wrap"><div class="card">'
    // Header con logo PNG real del sistema
    + '<div class="header">'
    + '<img src="https://rrhh-prisma.pages.dev/icon.png" class="header-logo" alt="RRHH Prisma">'
    + '<h1>RRHH <span>Prisma</span></h1>'
    + '<p>Sistema de Gestión de Recursos Humanos</p>'
    + '</div>'
    // Cuerpo
    + '<div class="body">'
    + '<p class="greeting">Bienvenido(a), ' + nombre + ' 👋</p>'
    + '<p class="txt">Se ha creado tu acceso al sistema <strong>RRHH Prisma</strong>. '
    + 'A continuación encontrarás tus credenciales para ingresar al sistema.</p>'
    + '<div class="creds-box">'
    + '<p class="creds-title">🔐 Tus credenciales</p>'
    + '<div class="cred-row"><span class="cred-label">Correo</span><span class="cred-value">' + email + '</span></div>'
    + '<div class="cred-row"><span class="cred-label">Contraseña</span><span class="cred-value">' + password + '</span></div>'
    + '<div class="cred-row"><span class="cred-label">Rol</span><span class="cred-value">' + rol + '</span></div>'
    + '</div>'
    + '<p class="modules-title">📱 Módulos disponibles para ti</p>'
    + '<table class="modules-table">' + modulosHTML + '</table>'
    + '<div class="btn-wrap" style="margin-top:24px;">'
    + '<a href="https://rrhh-prisma.pages.dev" class="btn">Ingresar a RRHH Prisma →</a>'
    + '</div>'
    + '<div class="warning">⚠️ <strong>Por seguridad:</strong> Te recomendamos cambiar tu contraseña '
    + 'después de tu primer inicio de sesión desde el módulo <em>Mi Perfil</em>.</div>'
    + '</div>'
    // Footer
    + '<div class="footer">'
    + '<p>Este correo fue generado automáticamente por RRHH Prisma<br>'
    + 'Si no esperabas este mensaje, ignóralo o contacta a tu administrador.</p>'
    + '</div>'
    + '</div></div></body></html>';
}

export function getPlantillaResetPassword(nombre, email, nuevaPassword) {
  var pasos = [
    ['1','Abre RRHH Prisma','Haz clic en el botón de abajo para acceder al sistema.'],
    ['2','Inicia sesion','Usa tu correo y la contrasena temporal indicada arriba.'],
    ['3','Ve a Mi Perfil','Selecciona "Mi Perfil" en el menu lateral izquierdo.'],
    ['4','Cambia tu contrasena','En la seccion "Cambiar contrasena", ingresa la temporal como actual y escribe tu nueva (minimo 8 caracteres).'],
  ];

  var pasosHTML = pasos.map(function(p){
    return '<tr>'
      + '<td style="padding:10px 12px;vertical-align:top;width:36px;">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#d97706,#f59e0b);text-align:center;line-height:28px;font-size:.75rem;font-weight:800;color:#fff;">' + p[0] + '</div></td>'
      + '<td style="padding:10px 12px;vertical-align:top;">'
      + '<p style="margin:0;font-size:.88rem;font-weight:700;color:#0d1b3e;">' + p[1] + '</p>'
      + '<p style="margin:2px 0 0;font-size:.8rem;color:#64748b;line-height:1.5;">' + p[2] + '</p>'
      + '</td></tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Restablecimiento de contrasena - RRHH Prisma</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#fff8ef;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}'
    + '.wrap{max-width:580px;margin:32px auto;padding:0 16px;}'
    + '.card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(217,119,6,.15);}'
    + '.hdr{background:linear-gradient(135deg,#78350f,#92400e);padding:36px 32px;text-align:center;}'
    + '.hdr img{width:64px;height:64px;border-radius:16px;margin:0 auto 14px;display:block;}'
    + '.hdr h1{margin:0 0 4px;font-size:1.25rem;font-weight:800;color:#fff;}'
    + '.hdr p{margin:0;font-size:.8rem;color:rgba(255,255,255,.55);}'
    + '.body{padding:32px;}'
    + '.greeting{font-size:1rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}'
    + '.txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 22px;}'
    + '.creds{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:14px;padding:20px;margin:0 0 24px;}'
    + '.creds-lbl{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#b45309;margin:0 0 12px;}'
    + '.row{display:flex;padding:8px 0;border-bottom:1px solid #fde68a;}'
    + '.row:last-child{border-bottom:none;}'
    + '.rl{font-size:.78rem;color:#6b7280;width:130px;flex-shrink:0;padding-top:1px;}'
    + '.rv{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}'
    + '.st{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:0 0 10px;}'
    + '.btn-wrap{text-align:center;margin:24px 0 0;}'
    + '.btn{display:inline-block;background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff !important;text-decoration:none;font-weight:700;font-size:.9rem;padding:13px 36px;border-radius:12px;}'
    + '.alert{background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 16px;margin:20px 0 0;font-size:.82rem;color:#b91c1c;line-height:1.5;}'
    + '.ftr{background:#fff8ef;padding:18px 32px;text-align:center;border-top:1px solid #fde68a;}'
    + '.ftr p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}'
    + '@media(max-width:600px){.wrap{margin:0;padding:0;}.card{border-radius:0;}.hdr,.body,.ftr{padding:24px 20px;}.row{flex-direction:column;gap:2px;}.rl{width:auto;}}'
    + '</style></head><body>'
    + '<div class="wrap"><div class="card">'
    + '<div class="hdr">'
    + '<img src="https://rrhh-prisma.pages.dev/icon.png" alt="RRHH Prisma">'
    + '<h1>Restablecimiento de contrasena</h1>'
    + '<p>RRHH Prisma - Sistema de Gestion de RRHH</p>'
    + '</div>'
    + '<div class="body">'
    + '<p class="greeting">Hola, ' + nombre + '</p>'
    + '<p class="txt">El administrador ha restablecido tu contrasena de acceso a <strong>RRHH Prisma</strong>. Encuentra tu contrasena temporal a continuacion.</p>'
    + '<div class="creds"><p class="creds-lbl">Contrasena temporal</p>'
    + '<div class="row"><span class="rl">Correo</span><span class="rv">' + email + '</span></div>'
    + '<div class="row"><span class="rl">Nueva contrasena</span><span class="rv">' + nuevaPassword + '</span></div>'
    + '</div>'
    + '<p class="st">Como cambiar tu contrasena</p>'
    + '<table style="width:100%;border-collapse:collapse;">' + pasosHTML + '</table>'
    + '<div class="btn-wrap"><a href="https://rrhh-prisma.pages.dev" class="btn">Acceder a RRHH Prisma</a></div>'
    + '<div class="alert">Importante: Esta contrasena es temporal. Cambiala de inmediato. Si no solicitaste este cambio, contacta a tu administrador.</div>'
    + '</div>'
    + '<div class="ftr"><p>Correo generado automaticamente por RRHH Prisma<br>Si no esperabas este mensaje, contacta a tu administrador.</p></div>'
    + '</div></div></body></html>';
}

export function getPlantillaAccesoEmpleado(nombre, correo, password) {
  return "<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    + "<style>body{margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}"
    + ".wrap{max-width:560px;margin:32px auto;padding:0 16px;}"
    + ".card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(37,99,235,.12);}"
    + ".hdr{background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:36px 32px;text-align:center;}"
    + ".hdr img{width:64px;height:64px;border-radius:16px;margin:0 auto 14px;display:block;}"
    + ".hdr h1{margin:0 0 4px;font-size:1.2rem;font-weight:800;color:#fff;}"
    + ".hdr p{margin:0;font-size:.8rem;color:rgba(255,255,255,.6);}"
    + ".body{padding:32px;}"
    + ".gr{font-size:1rem;font-weight:700;color:#0d1b3e;margin:0 0 8px;}"
    + ".txt{font-size:.88rem;color:#475569;line-height:1.65;margin:0 0 22px;}"
    + ".creds{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:20px;margin:0 0 24px;}"
    + ".cl{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#1d4ed8;margin:0 0 12px;}"
    + ".row{display:flex;padding:8px 0;border-bottom:1px solid #dbeafe;}"
    + ".row:last-child{border-bottom:none;}"
    + ".rl{font-size:.78rem;color:#6b7280;width:120px;flex-shrink:0;}"
    + ".rv{font-size:.9rem;font-weight:700;color:#0d1b3e;word-break:break-all;}"
    + ".btn-wrap{text-align:center;margin:24px 0 0;}"
    + ".btn{display:inline-block;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff !important;text-decoration:none;font-weight:700;font-size:.9rem;padding:13px 36px;border-radius:12px;}"
    + ".ftr{background:#eff6ff;padding:18px 32px;text-align:center;border-top:1px solid #bfdbfe;}"
    + ".ftr p{margin:0;font-size:.72rem;color:#94a3b8;line-height:1.6;}"
    + "@media(max-width:600px){.wrap{margin:0;padding:0;}.card{border-radius:0;}.hdr,.body,.ftr{padding:24px 20px;}}"
    + "</style></head><body>"
    + "<div class='wrap'><div class='card'>"
    + "<div class='hdr'>"
    + "<img src='https://rrhh-prisma.pages.dev/icon.png' alt='RRHH Prisma'>"
    + "<h1>Portal de Empleados</h1>"
    + "<p>RRHH Prisma - Acceso para Colaboradores</p>"
    + "</div>"
    + "<div class='body'>"
    + "<p class='gr'>Hola, " + nombre + "</p>"
    + "<p class='txt'>Se ha activado tu acceso al <strong>Portal de Empleados RRHH Prisma</strong>. "
    + "Desde aquí podrás participar en evaluaciones y consultar tu información.</p>"
    + "<div class='creds'><p class='cl'>Tus credenciales</p>"
    + "<div class='row'><span class='rl'>Correo</span><span class='rv'>" + correo + "</span></div>"
    + "<div class='row'><span class='rl'>Contraseña</span><span class='rv'>" + password + "</span></div>"
    + "</div>"
    + "<div class='btn-wrap'><a href='https://rrhh-prisma.pages.dev/empleado.html' class='btn'>Acceder al Portal del Empleado</a></div>"
    + "</div>"
    + "<div class='ftr'><p>Correo generado automaticamente por RRHH Prisma</p></div>"
    + "</div></div></body></html>";
}
