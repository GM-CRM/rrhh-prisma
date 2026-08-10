// ─── LOADER ANIMADO ──────────────────────────────────────────
function setLoaderStatus(msg, pct) {
    try {
        const status = document.getElementById('loader-status');
        const bar    = document.getElementById('loader-bar');
        if(status) status.textContent = msg || '';
        if(bar && pct !== undefined) bar.style.width = pct + '%';
    } catch(e) { console.warn('[setLoaderStatus]', e); }
}

function ocultarLoader_app() {
    const loader = document.getElementById('app-loader');
    if(!loader) return;
    loader.style.transition  = 'opacity .4s ease';
    loader.style.opacity     = '0';
    loader.style.visibility  = 'hidden';
    setTimeout(function(){ loader.style.display = 'none'; }, 500);
}

// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Frontend v6.0
//  Novedades:
//    - Paso 1 del stepper ahora es DOCUMENTOS (OCR primero)
//    - Sistema de notificaciones internas (toast + centro)
//    - Módulo de edición/renovación de contratos (drawer)
//    - Alertas automáticas: vencimientos y entrevistas pendientes
// ============================================================
const API_URL    = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";

// ─── UI BÁSICA ───────────────────────────────────────────────
function toggleMenu(){document.getElementById('sidebar').classList.toggle('-translate-x-full');document.getElementById('sidebar-overlay').classList.toggle('hidden');}
function activarNav(btn){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('is-active'));btn.classList.add('is-active');}

// ── REDISEÑO: grupos colapsables del sidebar ("Gestión de Personal",
// "Mi Organización", "Administración"). Solo pliega/despliega visualmente
// y recuerda la preferencia en localStorage; no toca showModule/activarNav
// ni ningún endpoint — los botones internos conservan su onclick original.
const CLAVE_NAV_COLAPSADOS = 'gm_nav_grupos_colapsados';
function toggleNavGroup(nombre){
    const wrap = document.querySelector('.nav-group-items[data-group-items="'+nombre+'"]');
    if(!wrap) return;
    const grupo = wrap.closest('.nav-group');
    const colapsado = grupo.classList.toggle('is-collapsed');
    try{
        const estado = JSON.parse(localStorage.getItem(CLAVE_NAV_COLAPSADOS)||'{}');
        estado[nombre] = colapsado;
        localStorage.setItem(CLAVE_NAV_COLAPSADOS, JSON.stringify(estado));
    }catch(e){}
}
function restaurarEstadoNavGroups(){
    try{
        const estado = JSON.parse(localStorage.getItem(CLAVE_NAV_COLAPSADOS)||'{}');
        Object.keys(estado).forEach(function(nombre){
            if(!estado[nombre]) return;
            const wrap = document.querySelector('.nav-group-items[data-group-items="'+nombre+'"]');
            if(wrap) wrap.closest('.nav-group').classList.add('is-collapsed');
        });
    }catch(e){}
}
let dashboardCargado=false;
let moduloActivo='';
function showModule(id){
    document.querySelectorAll('.module-section').forEach(s=>{s.classList.remove('active');s.style.display='none';});
    const t=document.getElementById('module-'+id);if(!t)return;
    t.style.display='block';
    requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('active')));
    document.getElementById('header-title').innerText={dashboard:'Indicadores',alta:'Alta de Personal',baja:'Baja de Personal',basedatos:'Expedientes',usuarios:'Usuarios',encuestas:'Encuestas',personas:'Personas',evaluaciones:'Evaluaciones'}[id]||id;
    if(window.innerWidth<768)toggleMenu();
    moduloActivo=id;
}
function mostrarLoader(t){document.getElementById('loader-text').innerText=t||'Procesando...';document.getElementById('global-loader').style.display='flex';}
function ocultarLoader(){document.getElementById('global-loader').style.display='none';}

// ─── SISTEMA DE NOTIFICACIONES INTERNAS ──────────────────────
// Toast flotante (aparece abajo derecha, desaparece solo)
// Centro de notificaciones (campana en header, lista persistente)
let notificaciones = JSON.parse(localStorage.getItem('gm_notifs') || '[]');

function guardarNotifs(){localStorage.setItem('gm_notifs', JSON.stringify(notificaciones.slice(0,300)));}

function mostrarToast(tipo, titulo, mensaje, duracion=5000){
    const contenedor = document.getElementById('toast-container');
    if(!contenedor) return;
    const id = 'toast-' + Date.now();
    const colores = {
        success: 'border-l-emerald-500 bg-white',
        warning: 'border-l-amber-400  bg-white',
        error:   'border-l-red-500    bg-white',
        info:    'border-l-blue-500   bg-white',
        contrato:'border-l-orange-400 bg-white'
    };
    const iconos = {
        success:'fa-check-circle text-emerald-500',
        warning:'fa-triangle-exclamation text-amber-400',
        error:  'fa-circle-xmark text-red-500',
        info:   'fa-circle-info text-blue-500',
        contrato:'fa-file-contract text-orange-400'
    };
    const html = `
    <div id="${id}" class="flex items-start gap-3 w-80 bg-white border border-slate-200 border-l-4 ${colores[tipo]||colores.info} rounded-xl shadow-xl p-4 transform translate-x-full transition-all duration-300 ease-out">
      <i class="fas ${iconos[tipo]||iconos.info} text-lg flex-shrink-0 mt-0.5"></i>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-slate-800">${titulo}</p>
        <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">${mensaje}</p>
      </div>
      <button onclick="cerrarToast('${id}')" class="text-slate-300 hover:text-slate-500 transition flex-shrink-0 ml-1">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>`;
    contenedor.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('translate-x-full')));
    if(duracion > 0) setTimeout(()=>cerrarToast(id), duracion);
}

function cerrarToast(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.add('translate-x-full','opacity-0');
    setTimeout(()=>el.remove(), 350);
}

function agregarNotificacion(tipo, titulo, mensaje, empleadoId='', silencioso=false){
  // Guarda anti-duplicados: evaluarAlertas() regenera todas las alertas
  // en cada carga y las que sobrevivieron en localStorage volvían a entrar.
  // La huella es el contenido, no el id (Date.now() siempre difiere).
  const huella = tipo+'|'+titulo+'|'+mensaje+'|'+empleadoId;
  if(notificaciones.some(n => (n.tipo+'|'+n.titulo+'|'+n.mensaje+'|'+n.empleadoId) === huella)) return;
  const notif = {id: Date.now()+Math.random(), tipo, titulo, mensaje, empleadoId, leida: false, fecha: new Date().toISOString()};
  notificaciones.unshift(notif);
  if(notificaciones.length > 300) notificaciones.length = 300;
  invalidarCacheNotifs();
  guardarNotifs();
  actualizarBadgeNotifs();
  if(!silencioso) mostrarToast(tipo, titulo, mensaje);
}

// Estilos por tipo de notificación. Antes cada tipo tenía su
// propio gradiente (siete en total): el panel parecía un semáforo
// descompuesto y ninguna alerta destacaba sobre otra.
// Ahora el color codifica URGENCIA, no categoría.
const NOTIF_ESTILOS = {
  error:       { bg:'', border:'', icon:'fa-circle-exclamation',  iconBg:'nt-ico-rojo',    badge:'nt-bdg-rojo'    },
  warning:     { bg:'', border:'', icon:'fa-triangle-exclamation',iconBg:'nt-ico-ambar',   badge:'nt-bdg-ambar'   },
  contrato:    { bg:'', border:'', icon:'fa-file-contract',       iconBg:'nt-ico-rojo',    badge:'nt-bdg-rojo'    },
  info:        { bg:'', border:'', icon:'fa-circle-info',         iconBg:'nt-ico-violeta', badge:'nt-bdg-violeta' },
  success:     { bg:'', border:'', icon:'fa-circle-check',        iconBg:'nt-ico-verde',   badge:'nt-bdg-verde'   },
  cumple:      { bg:'', border:'', icon:'fa-cake-candles',        iconBg:'nt-ico-violeta', badge:'nt-bdg-violeta' },
  aniversario: { bg:'', border:'', icon:'fa-trophy',              iconBg:'nt-ico-violeta', badge:'nt-bdg-violeta' },
};

// Pestañas del centro de notificaciones.
// 'error' se agrupa en 'contrato' porque app.js llegó a usar ese
// tipo para contratos vencidos (inconsistencia histórica).
// Los gradientes por pestaña se fueron: la pestaña activa se
// distingue por ser sólida, no por tener un color distinto cada
// una. Cinco degradados distintos eran cinco decisiones que el
// usuario tenía que descifrar sin ganar nada.
const NOTIF_TABS = [
  { key:'todas',       label:'Todas',       tipos:null,                          activo:'nt-tab-on' },
  { key:'cumple',      label:'Cumpleaños',  tipos:['cumple'],                    activo:'nt-tab-on' },
  { key:'aniversario', label:'Aniversarios',tipos:['aniversario'],               activo:'nt-tab-on' },
  { key:'contrato',    label:'Contratos',   tipos:['contrato','error'],          activo:'nt-tab-on' },
  { key:'otros',       label:'Otros',       tipos:['warning','info','success'],  activo:'nt-tab-on' }
];
let notifTabActiva = 'todas';

function categoriaDeNotif(tipo){
    for(const t of NOTIF_TABS){
        if(t.tipos && t.tipos.includes(tipo)) return t.key;
    }
    return 'otros';
}

// ─── Cache de agrupación por categoría (FIX DE RENDIMIENTO) ───────────
// ANTES: cada clic en una pestaña reconstruía el contador de las 5
// pestañas recorriendo el array completo de notificaciones una vez POR
// PESTAÑA (5 × N), además de reconstruir toda la lista de tarjetas de
// forma síncrona en el mismo tick del evento click — con ~494
// notificaciones eso bloqueaba el hilo principal lo suficiente como para
// que el navegador "congelara" el repintado (la pantalla se veía tenue/
// blanca un instante) antes de reaccionar, y en el peor caso el panel
// llegaba a cerrarse por una carrera con el listener de "clic afuera".
// AHORA: se agrupa UNA sola vez cuando el array de notificaciones cambia
// (alta nueva, limpiar todo) y se cachea. Cambiar de pestaña es una
// simple lectura O(1) del cache — no vuelve a recorrer las 494.
let _notifGrupos = null;
function invalidarCacheNotifs(){ _notifGrupos = null; }
/* Deduce a cuántos días está el evento leyendo el texto de la
   notificación. MENOR = MÁS URGENTE:
     -N  ya venció   0  hoy   1  mañana   N  faltan N días
   Devuelve null si no se puede determinar. */
function _notifDiasRestantes(n){
  var txt = ((n.titulo||'') + ' ' + (n.mensaje||'')).toLowerCase();
  var venc = txt.match(/venci[oó]|vencid[oa]|expir/);
  var haceN = txt.match(/hace\s+(\d+)\s*d[ií]a/);
  if(venc && haceN) return -parseInt(haceN[1],10);
  if(venc && /\bhoy\b/.test(txt)) return -1;
  if(/\bhoy\b/.test(txt)) return 0;
  if(/\bmañana\b|\bmanana\b/.test(txt)) return 1;
  var enN = txt.match(/(?:en|faltan?|dentro de|vence en|quedan?)\s+(\d+)\s*d[ií]a/);
  if(enN) return parseInt(enN[1],10);
  var suelto = txt.match(/(\d+)\s*d[ií]a/);
  if(suelto) return parseInt(suelto[1],10);
  if(venc) return -1;
  return null;
}

/* Vencido y hoy arriba, después por días ascendente. Lo que no tiene
   fecha detectable se va al final, ordenado por más reciente. */
function _ordenarNotifsPorUrgencia(arr){
  return arr.sort(function(a,b){
    var da = _notifDiasRestantes(a);
    var db = _notifDiasRestantes(b);
    if(da === null && db === null) return new Date(b.fecha) - new Date(a.fecha);
    if(da === null) return 1;
    if(db === null) return -1;
    if(da !== db) return da - db;
    return (a.titulo||'').localeCompare(b.titulo||'','es');
  });
}

function obtenerNotifsPorCategoria(){
  if(_notifGrupos) return _notifGrupos;
  const grupos = { todas:[], cumple:[], aniversario:[], contrato:[], otros:[] };
  for(let i=0;i<notificaciones.length;i++){
    const n = notificaciones[i];
    grupos.todas.push(n);
    grupos[categoriaDeNotif(n.tipo)].push(n);
  }
  // Se ordena UNA sola vez aquí dentro del cache. Cambiar de pestaña
  // sigue siendo lectura O(1); no se reordena en cada clic.
  Object.keys(grupos).forEach(function(k){
    _ordenarNotifsPorUrgencia(grupos[k]);
  });
  _notifGrupos = grupos;
  return grupos;
}


function actualizarBadgeNotifs(){
    const noLeidas = notificaciones.filter(n=>!n.leida).length;
    const badge = document.getElementById('notif-badge');
    if(!badge) return;
    if(noLeidas > 0){
        badge.textContent = noLeidas > 9 ? '9+' : noLeidas;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ─── Side Drawer de notificaciones ────────────────────────────
// REDISEÑO: antes era un dropdown flotante que tapaba el dashboard y se
// cerraba con un listener global en `document` que comparaba
// `panel.contains(e.target)` — frágil, porque si el propio clic (ej. en
// una pestaña) disparaba un re-render que reemplazaba esos nodos del DOM
// ANTES de que el evento terminara de burbujear, `e.target` quedaba
// "huérfano" (desconectado del documento) y `contains()` devolvía false,
// cerrando el panel aunque el clic fuera claramente adentro. Ahora se usa
// un backdrop dedicado (`#notif-backdrop`) que solo se cierra con su
// propio clic — ya no depende de la burbuja de eventos ni de que el DOM
// interno permanezca intacto durante el evento.
function abrirCentroNotifs(){
    const panel = document.getElementById('notif-panel');
    const backdrop = document.getElementById('notif-backdrop');
    if(!panel || !backdrop) return;
    panel.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    renderizarNotificaciones();
    // Doble rAF: deja que el navegador pinte el estado inicial (fuera de
    // pantalla) antes de agregar la clase que dispara la transición de
    // entrada — si se agrega en el mismo frame, el navegador colapsa
    // ambos estados y la animación de deslizamiento no se ve.
    requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
            panel.classList.add('is-open');
            backdrop.classList.add('is-open');
        });
    });
}
function cerrarCentroNotifs(){
    const panel = document.getElementById('notif-panel');
    const backdrop = document.getElementById('notif-backdrop');
    if(!panel || !backdrop) return;
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
}
function toggleCentroNotifs(){
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    if(panel.classList.contains('is-open')) cerrarCentroNotifs();
    else abrirCentroNotifs();
}

function renderizarNotificaciones(){
    renderizarPestanasNotifs();
    renderizarListaNotifs();
}

// ─── Barra de pestañas (barato: máx. 5 botones, lee del cache O(1)) ───
function renderizarPestanasNotifs(){
    const tabsCont = document.getElementById('notif-tabs');
    if(!tabsCont) return;
    const grupos = obtenerNotifsPorCategoria();

    tabsCont.innerHTML = NOTIF_TABS.map(function(t){
        const cuenta = grupos[t.key].length;
        const activa = notifTabActiva === t.key;
        return '<button data-tab="'+t.key+'" class="notif-tab-btn flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap '
           + (activa ? t.activo : 'nt-tab-off')
            + '">'+t.label
            + (cuenta>0 ? '<span class="notif-tab-count '+(activa?'bg-white/25 text-white':'bg-white text-slate-500')+'">'+(cuenta>99?'99+':cuenta)+'</span>' : '')
            + '</button>';
    }).join('');

    // onclick= (no addEventListener): se reemplaza en cada render, nunca
    // se acumula. e.stopPropagation() asegura que el clic en una pestaña
    // JAMÁS se propague hacia afuera del drawer (defensivo: con el
    // backdrop dedicado ya no debería cerrar nada, pero evita que algún
    // otro listener ancestro reaccione al clic).
    tabsCont.onclick = function(e){
        e.stopPropagation();
        const btn = e.target.closest('.notif-tab-btn');
        if(!btn || btn.dataset.tab === notifTabActiva) return;
        notifTabActiva = btn.dataset.tab;
        renderizarPestanasNotifs();                     // repinta pestañas: barato, instantáneo
        requestAnimationFrame(renderizarListaNotifs);    // difiere la lista (lo "pesado") al siguiente frame
    };
}

// ─── Lista de tarjetas (lee del cache O(1); solo pinta hasta 30) ──────
function renderizarListaNotifs(){
    const lista = document.getElementById('notif-lista');
    if(!lista) return;
    const grupos = obtenerNotifsPorCategoria();
    const filtradas = grupos[notifTabActiva] || [];

    const subt = document.getElementById('notif-subtitulo');
    if(subt) subt.textContent = filtradas.length ? (filtradas.length+' notificaci'+(filtradas.length===1?'ón':'ones')) : 'Sin novedades';

    if(!filtradas.length){
        const msg = notifTabActiva==='todas' ? 'Sin notificaciones' : 'Sin notificaciones en esta categoría';
        lista.innerHTML = '<div class="flex flex-col items-center justify-center h-full py-16 text-center">'
            + '<i class="fas fa-bell-slash text-slate-200 text-4xl mb-3"></i>'
            + '<p class="text-slate-400 text-sm">'+msg+'</p></div>';
        return;
    }

    // Solo se construyen tarjetas para las primeras 30 (igual que antes) —
    // el cache ya nos ahorró filtrar las 494 de más, así que este map()
    // trabaja sobre un array pequeño sin importar cuántas notificaciones
    // totales existan.
    lista.innerHTML = filtradas.slice(0,30).map(function(n, idx){
        const est = NOTIF_ESTILOS[n.tipo] || NOTIF_ESTILOS.info;
        const empBtn = n.empleadoId
            ? '<button data-empid="'+n.empleadoId+'" class="notif-emp-btn text-xs text-blue-600 hover:underline mt-1.5 font-semibold">Ver empleado →</button>'
            : '';
        const fecha = new Date(n.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        const tipoLabel = {
            error:'Contrato', warning:'Seguimiento', contrato:'Contrato',
            info:'Info', success:'OK', cumple:'Cumple', aniversario:'Aniversario'
        }[n.tipo]||n.tipo;
        // --i alimenta la animación de entrada en cascada (stagger) definida
        // en CSS: cada tarjeta se retrasa `idx * 45ms` respecto a la anterior.
        return '<div style="--i:'+idx+'" class="notif-card nt-card '+(n.leida?'nt-leida':'')+'">'
            +'<div class="w-9 h-9 rounded-xl '+est.iconBg+' flex items-center justify-center flex-shrink-0 shadow-sm">'
            +'<i class="fas '+est.icon+' text-white text-sm"></i></div>'
            +'<div class="flex-1 min-w-0">'
            +'<div class="flex items-center gap-1.5 mb-0.5 flex-wrap">'
            +'<span class="text-xs font-bold text-slate-700 leading-tight">'+n.titulo+'</span>'
            +'<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 '+est.badge+'">'+tipoLabel+'</span>'
            +'</div>'
            +'<p class="text-xs text-slate-500 leading-snug">'+n.mensaje+'</p>'
            +'<p class="text-[10px] text-slate-300 mt-1">'+fecha+'</p>'
            +empBtn
            +'</div></div>';
    }).join('');

    lista.onclick = function(e){
        const btn = e.target.closest('.notif-emp-btn');
        if(!btn) return;
        const empId = btn.dataset.empid;
        if(!empId) return;

        cerrarCentroNotifs();

        const emp = cacheGlobal.find(function(e){
            return (e['ID INTERNO']||'').toString().trim() === empId ||
                   (e['NO. EMPLEADO']||'').toString().trim() === empId;
        });

        if(emp){
            const modBase = document.getElementById('module-basedatos');
            if(modBase && !modBase.classList.contains('active')){
                showModule('basedatos');
                setTimeout(function(){
                    abrirEditor(
                        (emp['ID INTERNO']||emp['NO. EMPLEADO']||'').toString().trim(),
                        (emp['EMPRESA']||'').trim()
                    );
                }, 300);
            } else {
                abrirEditor(
                    (emp['ID INTERNO']||emp['NO. EMPLEADO']||'').toString().trim(),
                    (emp['EMPRESA']||'').trim()
                );
            }
        } else {
            mostrarToast('warning', 'Empleado no encontrado',
                'No se encontró el registro #'+empId+' en la base de datos. Sincroniza e intenta de nuevo.');
        }
    };

    // Marcar como leídas DESPUÉS de pintar (así se ve resaltada la primera
    // vez que se abre el panel).
    if(notificaciones.some(n=>!n.leida)){
        notificaciones.forEach(n=>n.leida=true);
        guardarNotifs();
        actualizarBadgeNotifs();
    }
}


function tiempoRelativo(iso){
    const diff = (Date.now() - new Date(iso)) / 1000;
    if(diff < 60) return 'Hace un momento';
    if(diff < 3600) return `Hace ${Math.floor(diff/60)} min`;
    if(diff < 86400) return `Hace ${Math.floor(diff/3600)} h`;
    return new Date(iso).toLocaleDateString('es-MX');
}

function limpiarNotificaciones(){
    notificaciones=[];guardarNotifs();actualizarBadgeNotifs();
    invalidarCacheNotifs();
    renderizarNotificaciones();
}

// ─── ALERTAS AUTOMÁTICAS POR VENCIMIENTOS ────────────────────
// Se ejecuta cada vez que se carga la BD. Evalúa:
//   1. Contratos que vencen en los próximos 30 días
//   2. Contratos vencidos (sin renovar)
//   3. Entrevistas de 15/45 días pendientes o no realizadas a tiempo
const DIAS_ALERTA_CONTRATO    = 30;
const DIAS_ALERTA_ENTREVISTA  = 3;  // avisar X días antes de que se cumpla el plazo
const CLAVE_ALERTAS           = 'gm_alertas_vistas';

// BUGFIX: la comparación exacta ("...==='Activo'") fallaba silenciosamente
// ante variantes de captura como "activo", "ACTIVO" o espacios extra,
// dejando al empleado fuera de TODAS las alertas (contrato, entrevistas,
// cumpleaños, aniversario) sin ningún aviso de error. Ahora es insensible
// a mayúsculas/espacios.
function esActivo(e){ return (e['ESTATUS']||'').toString().trim().toLowerCase()==='activo'; }

function evaluarAlertas(datos){
    const hoy        = new Date();
    hoy.setHours(0,0,0,0);
    const alertasVistas = JSON.parse(localStorage.getItem(CLAVE_ALERTAS)||'{}');
    let nuevas = 0;

    datos.filter(esActivo).forEach(emp=>{
        const id  = (emp["NO. EMPLEADO"]||"").toString();
        const nom = emp["NOMBRE DEL TRABAJADOR"] || ("Empleado #"+id);

        // ── Vencimientos de contrato ──────────────────────────
        [
            {label:'1er',ini:'FECHA DE INICIO DEL PRIMER CONTRATO',  ven:'FECHA DE VENCIMIENTO DEL PRIMER CONTRATO'},
            {label:'2do',ini:'FECHA DE INICIO DEL SEGUNDO CONTRATO', ven:'FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO'},
            {label:'3er',ini:'FECHA DE INICIO DEL TERCER CONTRATO',  ven:'FECHA DE VENCIMIENTO DEL TERCER CONTRATO'},
            {label:'4to',ini:'FECHA DE INICIO DEL CUARTO CONTRATO',   ven:'FECHA DE VENCIMIENTO DEL CUARTO CONTRATO'},
            {label:'5to',ini:'FECHA DE INICIO DEL QUINTO CONTRATO',   ven:'FECHA DE VENCIMIENTO DEL QUINTO CONTRATO'},
            {label:'6to',ini:'FECHA DE INICIO DEL SEXTO CONTRATO',    ven:'FECHA DE VENCIMIENTO DEL SEXTO CONTRATO'},
        ].forEach(({label, ven})=>{
            const fv = parseFechaFlexible(emp[ven]);
            if(!fv) return;
            const dias = Math.round((fv - hoy) / 86400000);
            const clave = `cont_${id}_${label}`;
            if(alertasVistas[clave] === fv.toISOString().slice(0,10)) return;

            if(dias < 0){
                agregarNotificacion('contrato', `Contrato vencido — ${nom}`, `El ${label} contrato venció hace ${Math.abs(dias)} día(s). Requiere renovación o baja.`, id, true);
                alertasVistas[clave] = fv.toISOString().slice(0,10); nuevas++;
            } else if(dias <= DIAS_ALERTA_CONTRATO){
                agregarNotificacion('contrato', `Contrato por vencer — ${nom}`, `El ${label} contrato vence en ${dias} día(s) (${fmtUTC(fv)}). Gestiona la renovación.`, id, true);
                alertasVistas[clave] = fv.toISOString().slice(0,10); nuevas++;
            }
        });

        // ── Entrevistas de 15 días ────────────────────────────
        const ent15 = (emp["ENTREVISTA DE AJUSTE 15 DÍAS"]||"").toString().trim();
        const fIng  = parseFechaFlexible(emp["FECHA DE INGRESO"]);
        if(fIng && (ent15 === "" || ent15 === "Pendiente")){
            const diasIngreso = Math.round((hoy - fIng) / 86400000);
            const clave15 = `ent15_${id}`;
            if(diasIngreso >= 13 && diasIngreso <= 20 && !alertasVistas[clave15]){
                agregarNotificacion('warning', `Entrevista 15 días — ${nom}`, `Lleva ${diasIngreso} días en la empresa. Debe realizarse la entrevista de ajuste de 15 días.`, id, true);
                alertasVistas[clave15] = '1'; nuevas++;
            }
        }

        // ── Entrevistas de 45 días ────────────────────────────
        const ent45 = (emp["ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS"]||"").toString().trim();
        if(fIng && (ent45 === "" || ent45 === "Pendiente")){
            const diasIngreso = Math.round((hoy - fIng) / 86400000);
            const clave45 = `ent45_${id}`;
            if(diasIngreso >= 43 && diasIngreso <= 55 && !alertasVistas[clave45]){
                agregarNotificacion('warning', `Entrevista 45 días — ${nom}`, `Lleva ${diasIngreso} días. Debe aplicarse la evaluación de desempeño de 45 días.`, id, true);
                alertasVistas[clave45] = '1'; nuevas++;
            }
        }
    });


    // ── Cumpleaños y Aniversarios (ventana: 3 días atrás → 7 días adelante) ──
    const hoyFull = new Date();
    const hoyYear = hoyFull.getFullYear();
    const hoyUTC  = new Date(Date.UTC(hoyFull.getFullYear(), hoyFull.getMonth(), hoyFull.getDate()));

    // BUGFIX (cumpleaños "silenciosos"): la versión anterior SOLO miraba hacia
    // adelante — si el evento (mes/día) ya había ocurrido este año, saltaba
    // directo al del año que viene (~365 días), así que si nadie abría la
    // campana justo el día exacto, la alerta se perdía para siempre y nunca
    // se volvía a mostrar. Ahora se evalúan los 3 años candidatos (año-1,
    // año, año+1) y se elige la ocurrencia más cercana a hoy que caiga
    // dentro de la ventana permitida [-DIAS_GRACIA_ATRAS, +DIAS_ALERTA_ADELANTE],
    // así un evento de ayer (o de hace 2-3 días) todavía dispara aviso hoy.
    const DIAS_GRACIA_ATRAS   = 3; // cuántos días "hacia atrás" seguimos avisando
    const DIAS_ALERTA_ADELANTE = 7; // cuántos días "hacia adelante" empezamos a avisar
    function _proximaOcurrencia(mes, dia){
        var candidatos = [-1,0,1].map(function(offset){
            var f = new Date(Date.UTC(hoyYear+offset, mes-1, dia));
            return { fecha:f, dias: Math.round((f - hoyUTC)/86400000) };
        }).filter(function(c){ return c.dias>=-DIAS_GRACIA_ATRAS && c.dias<=DIAS_ALERTA_ADELANTE; });
        if(!candidatos.length) return null;
        candidatos.sort(function(a,b){ return Math.abs(a.dias)-Math.abs(b.dias); });
        return candidatos[0];
    }

    // Filtrar por empresas permitidas del usuario (Auxiliares solo ven sus empresas)
    const datosPermitidos = filtrarPorEmpresasPermitidas(datos);
    datosPermitidos.filter(esActivo).forEach(function(emp){
        const id2  = (emp['ID INTERNO']||(emp['NO. EMPLEADO']||'')).toString();
        const nom2 = emp['NOMBRE DEL TRABAJADOR'] || 'Empleado';
        const pNom = nom2.split(' ')[0];

        // Cumpleaños — usar getUTC* para evitar desfase de timezone México (UTC-6)
        const fNac = parseFechaFlexible(emp['FECHA DE NACIMIENTO']);
        if(fNac && !isNaN(fNac)){
            const fm=fNac.getUTCMonth()+1, fd=fNac.getUTCDate();
            const ocurrC = _proximaOcurrencia(fm, fd);
            if(ocurrC){
                const dC = ocurrC.dias;
                const edad = ocurrC.fecha.getUTCFullYear() - fNac.getUTCFullYear();
                // Clave por año + ocurrencia (evita que un aviso anticipado bloquee
                // el del día exacto, y que el del día exacto bloquee el "atrasado")
                const clC = 'cumple_'+id2+'_'+ocurrC.fecha.getUTCFullYear();
                if(!alertasVistas[clC]){
                    var tit, msg;
                    if(dC===0){
                        tit='🎂 ¡Hoy cumpleaños! — '+pNom;
                        msg=nom2+' cumple '+edad+' años hoy. ¡Felicítale!';
                    } else if(dC>0){
                        tit='🎂 Cumpleaños en '+dC+' día(s) — '+pNom;
                        msg=nom2+', cumple '+edad+' años el '+String(fd).padStart(2,'0')+'/'+String(fm).padStart(2,'0')+'.';
                    } else {
                        tit='🎂 Cumpleaños hace '+Math.abs(dC)+' día(s) — '+pNom;
                        msg=nom2+' cumplió '+edad+' años el '+String(fd).padStart(2,'0')+'/'+String(fm).padStart(2,'0')+'.';
                    }
                    agregarNotificacion('cumple', tit, msg, id2, true);
                    alertasVistas[clC]='1'; nuevas++;
                }
            }
        }

        // Aniversario laboral — misma ventana con gracia hacia atrás
        const fIng2 = parseFechaFlexible(emp['FECHA DE INGRESO']);
        if(fIng2 && !isNaN(fIng2)){
            const fm=fIng2.getUTCMonth()+1, fd=fIng2.getUTCDate();
            const ocurrA = _proximaOcurrencia(fm, fd);
            if(ocurrA){
                const anos = ocurrA.fecha.getUTCFullYear() - fIng2.getUTCFullYear();
                if(anos>0){
                    const dA = ocurrA.dias;
                    const clA = 'aniv_'+id2+'_'+ocurrA.fecha.getUTCFullYear();
                    if(!alertasVistas[clA]){
                        var tA = dA===0 ? 'Hoy' : (dA>0 ? 'En '+dA+' día(s)' : 'Hace '+Math.abs(dA)+' día(s)');
                        var verbo = dA<0 ? 'cumplió' : 'cumple';
                        var mA = nom2 + ' ' + verbo + ' ' + anos + (anos>1?' años':' año') + (dA===0?' en la empresa hoy.':' el '+String(fd).padStart(2,'0')+'/'+String(fm).padStart(2,'0')+'.');
                        var titA = '🏆 Aniversario ' + tA + ' — ' + pNom;
                        agregarNotificacion('aniversario', titA, mA, id2, true); alertasVistas[clA]='1'; nuevas++;
                    }
                }
            }
        }
    });
        // Alertas solo en campana, no como toast al cargar
}

// ─── CATÁLOGOS ───────────────────────────────────────────────
// Empresas dinámicas — se generan desde el cache del Sheet
// Catálogo de empresas cargado desde la hoja EMPRESAS del Sheet
// Cada entrada: { id, nombre, grupo }
let catalogoEmpresas = [];
let empresas = [];

// Carga el catálogo EMPRESAS desde el backend y actualiza los controles
async function cargarCatalogoEmpresas() {
    try {
        const r = await enviarPeticion("obtener_catalogo_empresas", {});
        if (r && r.status === "success" && r.empresas && r.empresas.length) {
            catalogoEmpresas = r.empresas;
            empresas = catalogoEmpresas.map(e => e.nombre).filter(Boolean).sort();
        }
    } catch(ex) { console.warn("[catalogoEmpresas] Error:", ex); }
    actualizarListaEmpresas();
}

// Dado un nombre de empresa, devuelve su grupo comercial del catálogo
function grupoDeEmpresa(nombreEmpresa) {
    if (!nombreEmpresa) return "";
    const n = nombreEmpresa.trim().toLowerCase();
    const found = catalogoEmpresas.find(e => (e.nombre||"").toLowerCase() === n);
    return found ? (found.grupo || "") : "";
}

// BUGFIX 07 jul 2026: el filtro de "Grupo Comercial" (dashboard y
// Expedientes) comparaba con === estricto el valor guardado por
// empleado contra el valor del catálogo (hoja EMPRESAS). Si alguna vez
// se renombró un grupo en el catálogo, o hay diferencias de mayúsculas/
// acentos/espacios entre ambos, la comparación fallaba en silencio y el
// filtro regresaba 0 resultados para ese grupo aunque sí hubiera datos
// — eso explicaba que un grupo funcionara bien y otro se viera vacío.
// Se usa esta normalización en AMBOS lados de cada comparación de grupo.
function _normGrupo(s) {
    return (s || "").toString().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
        .toUpperCase();
}

// Devuelve lista única de grupos del catálogo
function listaGrupos() {
    return [...new Set(catalogoEmpresas.map(e => e.grupo).filter(Boolean))].sort();
}

function actualizarListaEmpresas() {
    // Si el catálogo aún no cargó, inferir de la BD como semilla
    if (catalogoEmpresas.length === 0 && cacheGlobal && cacheGlobal.length) {
        const nuevas = [...new Set(
            cacheGlobal.map(e => (e["EMPRESA"] || "").trim()).filter(e => e.length > 0)
        )].sort();
        if (nuevas.length > 0) empresas = nuevas;
    }

    // Actualizar selects de empresa en el DOM
    const selectsEmpresa = [
        document.getElementById("filtroEmpresaGlobal"),
        document.getElementById("filtro-empresa"),
    ];
    selectsEmpresa.forEach(function(sel) {
        if (!sel) return;
        const valActual = sel.value;
        const primeraOpcion = sel.options[0];
        sel.innerHTML = "";
        if (primeraOpcion) sel.appendChild(primeraOpcion);
        empresas.forEach(function(emp) {
            const opt = document.createElement("option");
            opt.value = emp; opt.textContent = emp;
            sel.appendChild(opt);
        });
        if (valActual) sel.value = valActual;
    });

    // Actualizar select de grupo comercial en dashboard
    const selGrupo = document.getElementById("filtroGrupoGlobal");
    if (selGrupo) {
        const vg = selGrupo.value;
        selGrupo.innerHTML = "<option value='ALL'>Todos los grupos</option>" +
            listaGrupos().map(g => "<option value='" + g + "'>" + g + "</option>").join("");
        if (vg && vg !== "ALL") selGrupo.value = vg;
    }

    // Datalist empresa en formulario de alta
    const listEmpAlta = document.getElementById("alta_empresa");
    if (listEmpAlta && listEmpAlta.tagName === "SELECT") {
        const v = listEmpAlta.value;
        listEmpAlta.innerHTML = "<option value=''>Seleccione...</option>" +
            empresas.map(e => "<option value='" + e + "'>" + e + "</option>").join("");
        if (v) listEmpAlta.value = v;
    }

    // Filtro de empresa en expedientes
    const filtroEmpExp = document.getElementById("filtro-empresa");
    if (filtroEmpExp) {
        const v = filtroEmpExp.value;
        filtroEmpExp.innerHTML = "<option value=''>Todas las empresas</option>" +
            empresas.map(e => "<option value='" + e + "'>" + e + "</option>").join("");
        if (v) filtroEmpExp.value = v;
    }

    // Filtro de grupo en expedientes
    const filtroGrupoExp = document.getElementById("filtro-grupo");
    if (filtroGrupoExp) {
        const vg = filtroGrupoExp.value;
        filtroGrupoExp.innerHTML = "<option value=''>Todos los grupos</option>" +
            listaGrupos().map(g => "<option value='" + g + "'>" + g + "</option>").join("");
        if (vg) filtroGrupoExp.value = vg;
    }
}

// ─── PARSERS ─────────────────────────────────────────────────
function parsearFecha(val){
    if(!val)return"";var s=val.toString().trim();
    // Ya está en formato YYYY-MM-DD
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    // Texto DD/MM/YYYY o DD-MM-YYYY (formato México de Sheets)
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    // Serial numérico de Sheets → usar UTC para no desplazar por timezone
    var n=parseFloat(s);
    if(!isNaN(n)&&n>10000&&n<100000){
        var dUTC=new Date((n-25569)*86400*1000);
        if(!isNaN(dUTC))return dUTC.getUTCFullYear()+'-'+
            String(dUTC.getUTCMonth()+1).padStart(2,'0')+'-'+
            String(dUTC.getUTCDate()).padStart(2,'0');
    }
    var d2=new Date(s);return isNaN(d2)?"":d2.toISOString().slice(0,10);
}
function parsearMonto(val){
    if(!val&&val!==0)return"";
    var s=val.toString().replace(/[$\s,]/g,"");var n=parseFloat(s);return isNaN(n)?"":n;
}
function parseFechaFlexible(val){
    if(!val)return null;var s=val.toString().trim();if(!s||s==="0")return null;
    var n=parseFloat(s);
    // Serial numérico de Sheets (ej: 35228 = 12/06/1996)
    // IMPORTANTE: usar Date.UTC para evitar desfase de timezone (México UTC-6 correría 1 día)
    if(!isNaN(n)&&n>10000&&n<100000){
        var dUTC=new Date((n-25569)*86400*1000);
        if(!isNaN(dUTC)){
            // Construir fecha con componentes UTC para que no se desplace por timezone local
            return new Date(Date.UTC(dUTC.getUTCFullYear(), dUTC.getUTCMonth(), dUTC.getUTCDate()));
        }
    }
    // Texto DD/MM/YYYY o DD-MM-YYYY (formato que devuelve getDisplayValues de Sheets en México)
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m)return new Date(Date.UTC(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1])));
    // Texto YYYY-MM-DD (ISO)
    var m2=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m2)return new Date(Date.UTC(parseInt(m2[1]),parseInt(m2[2])-1,parseInt(m2[3])));
    var d=new Date(s);return isNaN(d)?null:d;
}
function parsearMontoSheet(val){
    if(!val&&val!==0)return 0;var s=val.toString().replace(/[$\s,]/g,"");var n=parseFloat(s);return isNaN(n)?0:n;
}
const CAMPOS_FECHA=["FECHA DE INGRESO","FECHA DE BAJA","FECHA DE NACIMIENTO","INICIO DEL PRIMER CONTRATO","FECHA DE VENCIMIENTO DEL PRIMER CONTRATO","FECHA DE INICIO DEL SEGUNDO CONTRATO","FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO","FECHA DE INICIO DEL TERCER CONTRATO","FECHA DE VENCIMIENTO DEL TERCER CONTRATO","FECHA DE INICIO DEL CUARTO CONTRATO","FECHA DE VENCIMIENTO DEL CUARTO CONTRATO","FECHA DE INICIO DEL QUINTO CONTRATO","FECHA DE VENCIMIENTO DEL QUINTO CONTRATO","FECHA DE INICIO DEL SEXTO CONTRATO","FECHA DE VENCIMIENTO DEL SEXTO CONTRATO","FECHA EVALUACIÓN 360"];
const CAMPOS_MONTO=["SUELDO MENSUAL","MONTO DE FINIQUITO"];
function normalizarRegistro(emp){
    var o=Object.assign({},emp);
    CAMPOS_FECHA.forEach(k=>{if(o[k]!==undefined)o[k]=parsearFecha(o[k]);});
    CAMPOS_MONTO.forEach(k=>{if(o[k]!==undefined)o[k]=parsearMonto(o[k]);});
    return o;
}


// ─── GOOGLE PLACES AUTOCOMPLETE (domicilio) ───────────────────
// Usa Places API (New) con la misma API key de Vision.
// Restricción: solo México. Tipos: addresses.
// La key debe tener Places API habilitada en Google Cloud Console.
const PLACES_API_KEY = (function(){
    // Usa la misma key configurada en el GAS — aquí solo para autocomplete del browser
    // Se configura como variable en index.html o se puede hardcodear si es pública
    return window.GOOGLE_PLACES_KEY || '';
})();

function initPlacesInput(inputId, suggestionsId){
    const input = document.getElementById(inputId);
    const lista  = document.getElementById(suggestionsId);
    if(!input || !lista) return;

    let timer = null;

    input.addEventListener('input', function(){
        const q = input.value.trim();
        clearTimeout(timer);

        if(q.length < 4){
            lista.classList.add('hidden');
            lista.innerHTML = '';
            return;
        }

        // Debounce 350ms para no disparar con cada tecla
        timer = setTimeout(()=> buscarLugaresGoogle(q, lista, input), 350);
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', function(e){
        if(!lista.contains(e.target) && e.target !== input){
            lista.classList.add('hidden');
        }
    });
}

async function buscarLugaresGoogle(query, lista, input){
    const key = PLACES_API_KEY;
    if(!key){
        // Sin key: mostrar sugerencias estáticas basadas en lo escrito
        mostrarSugerenciasEstaticas(query, lista, input);
        return;
    }

    try {
        // Places API (New) — Autocomplete
        const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key
            },
            body: JSON.stringify({
                input: query,
                includedRegionCodes: ['mx'],
                languageCode: 'es'
            })
        });

        const data = await resp.json();
        const sugerencias = (data.suggestions || []).slice(0, 6);

        if(!sugerencias.length){
            lista.classList.add('hidden');
            return;
        }

        lista.classList.remove('hidden');
        lista.classList.remove('hidden');
        lista.innerHTML = sugerencias.map(function(s){
            var texto = (s.placePrediction&&s.placePrediction.text&&s.placePrediction.text.text)
                     || (s.placePrediction&&s.placePrediction.structuredFormat&&s.placePrediction.structuredFormat.mainText&&s.placePrediction.structuredFormat.mainText.text)
                     || '';
            var secun = (s.placePrediction&&s.placePrediction.structuredFormat&&s.placePrediction.structuredFormat.secondaryText&&s.placePrediction.structuredFormat.secondaryText.text)
                     || '';
            var full  = texto + (secun ? ', ' + secun : '');
            var safe  = full.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
            return '<button type="button" class="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition" onclick="seleccionarLugar(this)" data-texto="' + safe + '" data-input="alta_domicilioCompleto">'
                 + '<p class="text-sm font-medium text-slate-800">' + texto + '</p>'
                 + (secun ? '<p class="text-xs text-slate-400">' + secun + '</p>' : '')
                 + '</button>';
        }).join('');

    } catch(e){
        console.warn('Places API error:', e);
        mostrarSugerenciasEstaticas(query, lista, input);
    }
}

function seleccionarLugar(btn, inputId){
    var texto    = btn.getAttribute('data-texto') || '';
    var targetId = inputId || btn.getAttribute('data-input') || 'alta_domicilioCompleto';
    var input    = document.getElementById(targetId);
    if(input && texto){
        input.value = texto;
        altaData.domicilioCompleto = texto;
    }
    var lista = btn.closest('[id^="places-suggestions"]');
    if(lista) lista.classList.add('hidden');
}

// Fallback sin API key — sugerencias básicas basadas en texto
function mostrarSugerenciasEstaticas(query, lista, input){
    // Extraer colonias/ciudades del cache de empleados actuales
    const domiciliosPrevios = [...new Set(
        (cacheGlobal||[])
            .map(e => (e["DOMICILIO COMPLETO"]||"").trim())
            .filter(d => d.toLowerCase().includes(query.toLowerCase()) && d.length > 5)
    )].slice(0,5);

    if(!domiciliosPrevios.length){
        lista.classList.add('hidden');
        return;
    }

    lista.classList.remove('hidden');
    lista.innerHTML = '<div class="px-4 py-2 text-xs text-slate-400 border-b border-slate-100">Domicilios previos en la BD</div>'
        + domiciliosPrevios.map(d =>
            '<button type="button" class="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition text-sm text-slate-700" '
            + 'onclick="seleccionarLugar(this)" data-texto="' + d.replace(/"/g,'&quot;').replace(/\'/g,'&#39;') + '" data-input="alta_domicilioCompleto">'
            + d + '</button>'
        ).join('');
}

// ─── STEPPER ONBOARDING — paso 0 ahora es DOCUMENTOS ─────────

// ── Mostrar/ocultar contratos 4-6 según tipo de ingreso ──────
function actualizarVisibilidadContratos() {
    // Leer de altaData (persiste entre pasos) en lugar del DOM
    // alta_tipoIngreso está en paso-empleo que ya no está en el DOM cuando estamos en paso-contrato
    var tipo    = (altaData.tipoIngreso || '').toLowerCase();
    // También intentar leer del DOM si está disponible (cuando estamos en paso-empleo)
    var elTipo  = document.getElementById('alta_tipoIngreso');
    if (elTipo && elTipo.value) tipo = elTipo.value.toLowerCase();

    var esAdmin = tipo.indexOf('admin') !== -1;
    var ids456  = ['alta_fechaInicioContrato4','alta_vencimientoContrato4',
                   'alta_fechaInicioContrato5','alta_vencimientoContrato5',
                   'alta_fechaInicioContrato6','alta_vencimientoContrato6'];
    ids456.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var wrap = el.closest('[data-campo-id]') || el.parentElement;
        if (wrap) wrap.style.display = esAdmin ? '' : 'none';
    });
    console.log('[Contratos] tipo='+tipo+' esAdmin='+esAdmin+
                ' ids456 encontrados='+ids456.filter(function(id){return !!document.getElementById(id);}).length);
}

// ── Calcular fechas de contratos (3 Operativo / 6 Administrativo) ─
function calcularFechasContrato() {
    var el_fi = document.getElementById('alta_fechaIngreso');
    var el_ic = document.getElementById('alta_fechaInicioContrato');
    var ini1  = (el_ic && el_ic.value) ? el_ic.value : (el_fi ? el_fi.value : '');
    if (!ini1) { mostrarToast('warning','Fecha requerida','Captura la Fecha de Ingreso primero.'); return; }

    function addDays(s, d) {
        var dt = new Date(s + 'T00:00:00');
        dt.setDate(dt.getDate() + d);
        return dt.toISOString().slice(0,10);
    }

    // Leer tipo de ingreso igual que actualizarVisibilidadContratos(): primero altaData
    // (persiste entre pasos), y solo si el campo sigue en el DOM (paso-empleo) usar su valor.
    var tipo   = (altaData.tipoIngreso || '').toLowerCase();
    var el_ti  = document.getElementById('alta_tipoIngreso');
    if (el_ti && el_ti.value) tipo = el_ti.value.toLowerCase();
    var numC   = tipo.indexOf('admin') !== -1 ? 6 : 3;
    var PAIRS  = [
        ['alta_fechaInicioContrato',  'alta_vencimientoPrimerContrato'],
        ['alta_iniciSegundoContrato', 'alta_vencSegundoContrato'],
        ['alta_iniciTercerContrato',  'alta_vencTercerContrato'],
        ['alta_fechaInicioContrato4', 'alta_vencimientoContrato4'],
        ['alta_fechaInicioContrato5', 'alta_vencimientoContrato5'],
        ['alta_fechaInicioContrato6', 'alta_vencimientoContrato6']
    ];
    var base = ini1, msgs = [];
    for (var i = 0; i < numC; i++) {
        var ven  = addDays(base, 29);
        var elI  = document.getElementById(PAIRS[i][0]);
        var elV  = document.getElementById(PAIRS[i][1]);
        if (elI) elI.value = base;
        if (elV) elV.value = ven;
        msgs.push((i+1)+'°: '+base+' → '+ven);
        base = addDays(base, 30);
    }
    mostrarToast('success', numC+' contratos calculados ('+(tipo.indexOf('admin')!==-1?'Administrativo':'Operativo')+')', msgs.join(' | '), 8000);
}

function calcularFechasContratoExpediente() {
    var E = empleadoEdicion || {};
    var fiRaw = parseFloat(E['FECHA DE INGRESO'] || '0');
    var fechaBase = '';
    if (fiRaw > 10000) {
        var d = new Date((fiRaw - 25569) * 86400 * 1000);
        fechaBase = d.toISOString().slice(0,10);
    }
    var el1 = document.getElementById('ed_ini1contrato');
    if (el1 && el1.value) fechaBase = el1.value;
    if (!fechaBase) { mostrarToast('warning','Sin fecha base','Captura la Fecha de Ingreso primero.'); return; }

    function addD(s, d) {
        var dt = new Date(s + 'T00:00:00');
        dt.setDate(dt.getDate() + d);
        return dt.toISOString().slice(0,10);
    }
    var tipo = (E['TIPO DE INGRESO']||'').toLowerCase();
    var numC = tipo.indexOf('admin') !== -1 ? 6 : 3;
    var PAIRS2 = [['ed_ini1contrato','ed_ven1contrato'],['ed_ini2contrato','ed_ven2contrato'],
                  ['ed_ini3contrato','ed_ven3contrato'],['ed_ini4contrato','ed_ven4contrato'],
                  ['ed_ini5contrato','ed_ven5contrato'],['ed_ini6contrato','ed_ven6contrato']];
    var base = fechaBase, msgs = [];
    for (var i = 0; i < numC; i++) {
        var ven = addD(base, 29);
        var eI  = document.getElementById(PAIRS2[i][0]);
        var eV  = document.getElementById(PAIRS2[i][1]);
        if (eI) eI.value = base;
        if (eV) eV.value = ven;
        msgs.push((i+1)+'°: '+base+' → '+ven);
        base = addD(base, 30);
    }
    mostrarToast('success', numC+' contratos calculados', msgs.join(' | '), 8000);
}

const PASOS=[
    // PASO 0 — Documentos y OCR (PRIMERO)
    {id:'paso-documentos',titulo:'Documentos',icono:'fa-wand-magic-sparkles',color:'amber',descripcion:'Carga documentos para pre-rellenar el formulario automáticamente',campos:[]},
    // PASO 1 — Datos laborales
    {id:'paso-empleo',titulo:'Datos Laborales',icono:'fa-briefcase',color:'blue',descripcion:'Información del puesto y contratación',campos:[
        {id:"numeroEmpleado",     label:"No. de Empleado",       type:"number",req:true, col:2,autonum:true},
        {id:"fechaIngreso",       label:"Fecha de Ingreso",       type:"date",  req:true, col:2},
        {id:"nombreTrabajador",   label:"Nombre Completo",        type:"text",  req:true, col:2,placeholder:"Apellido Paterno Materno Nombre(s)"},
        {id:"empresa",            label:"Empresa",                type:"select-dynamic",req:true, col:2,optionsFn:function(){ return empresas; }},
        {id:"grupoComercial",     label:"Grupo Comercial",         type:"text",  req:false,col:2,placeholder:"Se llena automáticamente al seleccionar empresa",readonly:true},
        {id:"departamento",       label:"Departamento",           type:"datalist", req:false, col:2, listId:'list-departamentos'},
        {id:"puesto",             label:"Puesto",                 type:"datalist", req:false, col:2, listId:'list-puestos'},
        {id:"tipoIngreso",        label:"Tipo de Ingreso",        type:"select",req:true, col:2,options:["Administrativo","Operativo"]},
        {id:"sueldoMensual",      label:"Sueldo Mensual (MXN)",   type:"number",req:true, col:2,placeholder:"0.00"},
        {id:"frecuenciaPago",     label:"Frecuencia de Pago",     type:"select",req:true, col:2,options:["Quincenal","Semanal","Mensual"]},
        {id:"fuenteContratacion", label:"Fuente de Contratación", type:"text",  req:false,col:2,placeholder:"Ej. Referido, OCC, LinkedIn..."},
    ]},
    // PASO 2 — Contrato


    {id:'paso-contrato',titulo:'Contrato',icono:'fa-file-contract',color:'indigo',descripcion:'Tipo, vigencias y seguimiento de contratos',accion:{label:'Calcular fechas automaticamente',fn:'calcularFechasContrato()'},campos:[
        {id:"entrevista15Dias",          label:"Entrevista Ajuste 15 Días",   type:"select",req:false,col:2,options:["Pendiente","Sí","No"]},
        {id:"entrevista45Dias",          label:"Entrevista y Eval. 45 Días",  type:"select",req:false,col:2,options:["Pendiente","Sí","No"]},
        {id:"tipoContrato",              label:"Tipo de Contrato",            type:"select",req:true, col:2,options:["Tiempo Indeterminado","Prueba","Temporal"]},
        {id:"fechaInicioContrato",       label:"Inicio 1er Contrato",         type:"date",  req:false,col:2},
        {id:"vencimientoPrimerContrato", label:"Vencimiento 1er Contrato",    type:"date",  req:false,col:2},
        {id:"iniciSegundoContrato",      label:"Inicio 2do Contrato",         type:"date",  req:false,col:2},
        {id:"vencSegundoContrato",       label:"Vencimiento 2do Contrato",    type:"date",  req:false,col:2},
        {id:"iniciTercerContrato",       label:"Inicio 3er Contrato",         type:"date",  req:false,col:2},
        {id:"vencTercerContrato",        label:"Vencimiento 3er Contrato",    type:"date",  req:false,col:2},
        {id:"fechaInicioContrato4",      label:"Inicio 4to Contrato",         type:"date",  req:false,col:2,adminOnly:true},
        {id:"vencimientoContrato4",      label:"Vencimiento 4to Contrato",    type:"date",  req:false,col:2,adminOnly:true},
        {id:"fechaInicioContrato5",      label:"Inicio 5to Contrato",         type:"date",  req:false,col:2,adminOnly:true},
        {id:"vencimientoContrato5",      label:"Vencimiento 5to Contrato",    type:"date",  req:false,col:2,adminOnly:true},
        {id:"fechaInicioContrato6",      label:"Inicio 6to Contrato",         type:"date",  req:false,col:2,adminOnly:true},
        {id:"vencimientoContrato6",      label:"Vencimiento 6to Contrato",    type:"date",  req:false,col:2,adminOnly:true},
        {id:"fechaEval360",              label:"Fecha Evaluación 360°",       type:"date",  req:false,col:2},
    ]},
    // PASO 3 — Datos personales
    {id:'paso-personal',titulo:'Datos Personales',icono:'fa-id-card',color:'teal',descripcion:'Información personal y documentos legales',campos:[
        {id:"curp",             label:"CURP",                type:"text",    req:true, col:2,placeholder:"18 caracteres",maxlen:18},
        {id:"rfc",              label:"RFC",                 type:"text",    req:true, col:2,placeholder:"13 caracteres",maxlen:13},
        {id:"nss",              label:"NSS",                 type:"text",    req:true, col:2,placeholder:"11 dígitos",   maxlen:11},
        {id:"estadoCivil",      label:"Estado Civil",        type:"select",  req:false,col:2,options:["Soltero","Casado","Divorciado","Viudo","Unión Libre"]},
        {id:"escolaridad",      label:"Escolaridad",         type:"text",    req:false,col:2},
        {id:"domicilioCompleto",label:"Domicilio Completo",  type:"places",  req:false,col:1,placeholder:"Escribe la calle o colonia..."},
    ]},
    // PASO 4 — Contacto
    {id:'paso-contacto',titulo:'Contacto',icono:'fa-phone',color:'cyan',descripcion:'Datos de contacto y emergencias',campos:[
        {id:"correoElectronico",  label:"Correo Electrónico",           type:"email",req:false,col:2},
        {id:"telefonoPersonal",   label:"Teléfono Personal",            type:"text", req:false,col:2,placeholder:"10 dígitos"},
        {id:"contactoEmergencia", label:"Nombre — Contacto Emergencia", type:"text", req:false,col:2},
        {id:"parentesco",         label:"Parentesco",                   type:"select",req:false,col:2, options:["Esposo(a)","Padre","Madre","Hijo(a)","Hermano(a)","Abuelo(a)","Tío(a)","Primo(a)","Otro"]},
        {id:"telefonoEmergencia", label:"Teléfono Emergencia",          type:"text", req:false,col:2},
    ]},
    // PASO 5 — Beneficiario
    {id:'paso-beneficiario',titulo:'Beneficiario',icono:'fa-heart',color:'rose',descripcion:'Datos del beneficiario IMSS',campos:[
        {id:"nombreBeneficiario",    label:"Nombre del Beneficiario",type:"text",  req:false,col:2},
        {id:"rfcBeneficiario",       label:"RFC del Beneficiario",   type:"text",  req:false,col:2},
        {id:"parentescoBeneficiario",label:"Parentesco",             type:"select",req:false,col:2, options:["Esposo(a)","Padre","Madre","Hijo(a)","Hermano(a)","Abuelo(a)","Tío(a)","Primo(a)","Otro"]},
        {id:"porcentajeAsignacion",  label:"% de Asignación",        type:"number",req:false,col:2,placeholder:"100"},
    ]},
    // PASO 6 — Resumen y confirmar
    {id:'paso-resumen',titulo:'Confirmar',icono:'fa-clipboard-check',color:'green',descripcion:'Revisa y confirma el alta',campos:[]}
];

let pasoActual=0, altaData={};

// ─── STEPPER RENDER ───────────────────────────────────────────
function renderizarStepper(){
    const barra=document.getElementById('stepper-barra');
    barra.innerHTML=PASOS.map((p,i)=>{
        const hecho=i<pasoActual,activo=i===pasoActual;
        const dot=hecho?'bg-emerald-500 text-white':activo?'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-2':'bg-slate-100 text-slate-400';
        const ic=hecho?'fa-check':p.icono;
        const tc=hecho?'text-emerald-600':activo?'text-blue-600':'text-slate-400';
        const linea=i<PASOS.length-1?`<div class="flex-1 h-0.5 mx-1.5 rounded ${hecho?'bg-emerald-400':'bg-slate-200'}"></div>`:'';
        return `<div class="flex items-center flex-1 min-w-0"><button onclick="irAPaso(${i})" class="flex flex-col items-center gap-1 flex-shrink-0" title="${p.titulo}"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${dot}"><i class="fas ${ic} text-xs"></i></div><span class="text-xs font-medium hidden lg:block whitespace-nowrap ${tc}">${p.titulo}</span></button>${linea}</div>`;
    }).join('');
    renderizarPasoActual();
    actualizarBotones();
    const ind=document.getElementById('paso-indicador');
    if(ind)ind.innerText=`Paso ${pasoActual+1} de ${PASOS.length}`;
}

function renderizarPasoActual(){
    const paso=PASOS[pasoActual];
    const el=document.getElementById('stepper-contenido');

    // ── Paso 0: Documentos y OCR ──────────────────────────────
    if(paso.id==='paso-documentos'){
        el.innerHTML=`
        <div class="max-w-2xl mx-auto">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i class="fas fa-wand-magic-sparkles text-amber-500 text-2xl"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800">Carga tus documentos primero</h3>
            <p class="text-sm text-slate-500 mt-1">La IA leerá los documentos escaneados y pre-rellenará el formulario automáticamente. Ahorra tiempo y reduce errores.</p>
          </div>

          <!-- Zona de carga -->
          <div id="drop-zone" ondragover="event.preventDefault();this.classList.add('border-amber-400','bg-amber-50')" ondragleave="this.classList.remove('border-amber-400','bg-amber-50')" ondrop="manejarDrop(event)"
            class="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all mb-4"
            onclick="document.getElementById('alta_archivos').click()">
            <i class="fas fa-cloud-upload-alt text-slate-300 text-4xl mb-3"></i>
            <p class="text-sm font-semibold text-slate-600">Arrastra aquí tus documentos o haz clic para seleccionar</p>
            <p class="text-xs text-slate-400 mt-1">INE, CURP, Constancia IMSS, Acta de Nacimiento, Pasaporte — PDF, JPG, PNG — máx. 10 MB c/u</p>
            <input type="file" id="alta_archivos" multiple accept=".pdf,.jpg,.jpeg,.png" class="hidden" onchange="actualizarListaArchivos()">
          </div>

          <!-- Lista de archivos -->
          <div id="lista-archivos" class="space-y-2 mb-5"></div>

          <!-- Botón analizar -->
          <button onclick="ejecutarOCR()" id="btn-ocr"
            class="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-sm font-bold py-3.5 rounded-xl transition-all shadow-md">
            <i class="fas fa-magnifying-glass"></i> Analizar documentos con IA y pre-rellenar formulario
          </button>
          <div id="ocr-status" class="mt-4 hidden">
            <div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <span class="text-sm text-amber-700 font-medium" id="ocr-status-txt">Analizando documentos...</span>
            </div>
          </div>

          <!-- Resultados OCR -->
          <div id="ocr-resultado" class="mt-4 hidden">
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p class="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <i class="fas fa-check-circle text-emerald-500"></i> Datos detectados — verifica y corrige si es necesario
              </p>
              <div id="ocr-campos-detectados" class="grid grid-cols-2 gap-2"></div>
            </div>
          </div>

          <p class="text-xs text-center text-slate-400 mt-5">
            <i class="fas fa-info-circle mr-1"></i>
            Puedes omitir este paso y continuar capturando manualmente. Los archivos se guardarán en Drive al confirmar el alta.
          </p>
        </div>`;
        return;
    }

    // ── Paso final: Resumen ───────────────────────────────────
    if(paso.id==='paso-resumen'){
        el.innerHTML=`
        <div class="max-w-2xl mx-auto">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i class="fas fa-clipboard-check text-emerald-500 text-2xl"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800">Revisa el alta antes de confirmar</h3>
            <p class="text-sm text-slate-500 mt-1">Verifica que todos los datos sean correctos</p>
          </div>
          <div id="resumen-alta" class="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden mb-4"></div>
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <i class="fas fa-folder-open mr-2"></i>
            Al confirmar se creará automáticamente la carpeta del expediente en Google Drive bajo <span class="font-mono bg-blue-100 px-1 py-0.5 rounded">/${altaData.empresa||'Empresa'}/${altaData.numeroEmpleado||'No.Emp'} — ${altaData.nombreTrabajador||'Nombre'}/</span>
          </div>
        </div>`;
        renderizarResumen();
        return;
    }

    // ── Pasos normales ────────────────────────────────────────
    const cols={blue:'bg-blue-50 text-blue-600',indigo:'bg-indigo-50 text-indigo-600',teal:'bg-teal-50 text-teal-600',cyan:'bg-cyan-50 text-cyan-600',rose:'bg-rose-50 text-rose-600',green:'bg-emerald-50 text-emerald-600'};
    const accionBtn = paso.accion
        ? `<button type="button" onclick="${paso.accion.fn}" class="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition"><i class="fas fa-magic"></i>${paso.accion.label}</button>`
        : '';
    el.innerHTML=`
      <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div class="w-12 h-12 rounded-xl ${cols[paso.color]||'bg-slate-100 text-slate-500'} flex items-center justify-center flex-shrink-0"><i class="fas ${paso.icono} text-xl"></i></div>
        <div class="flex-1"><h3 class="text-base font-bold text-slate-800">${paso.titulo}</h3><p class="text-sm text-slate-400 mt-0.5">${paso.descripcion}</p></div>
        ${accionBtn}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${paso.campos.map(c=>renderizarCampo(c)).join('')}</div>`;

    // Autonum — recalcular cuando cambia la empresa
    if(paso.campos.some(c=>c.autonum)){
        // Solo llamar si ya hay empresa seleccionada
        if(altaData.empresa && !altaData.numeroEmpleado) cargarSiguienteNumero();
        // Listener en el campo empresa para recalcular al cambiar
        setTimeout(function(){
            const elEmp = document.getElementById("alta_empresa");
            if(elEmp){
                elEmp.addEventListener("change", function(){
                    altaData.empresa = this.value;
                    altaData.numeroEmpleado = "";
                    const elNum = document.getElementById("alta_numeroEmpleado");
                    if(elNum){ elNum.value = ""; elNum.placeholder = "Calculando..."; }
                    cargarSiguienteNumero();
                    // Auto-fill grupo comercial
                    const gc = grupoDeEmpresa(this.value);
                    altaData.grupoComercial = gc;
                    const elGC = document.getElementById("alta_grupoComercial");
                    if(elGC) elGC.value = gc;
                }, { once: false });
            }
        }, 200); // esperar a que el DOM esté listo
    }
    // Listener fecha nac
    const fn=document.getElementById('alta_fechaNacimiento');
    if(fn){fn.addEventListener('change',calcularRangoEdadAuto);fn.addEventListener('blur',calcularRangoEdadAuto);}
    // Listener CURP
    const curpEl=document.getElementById('alta_curp');
    if(curpEl)curpEl.addEventListener('input',function(){if(this.value.length===18){const d=decodificarCURP(this.value.toUpperCase());if(d)aplicarDatosCURP(d);}});
}

// Catálogos dinámicos para datalist — se poblan con datos de la BD
let catalogoDeptos  = [];
let catalogoPuestos = [];

function poblarCatalogos(){
    const deptos  = new Set();
    const puestos = new Set();
    (cacheGlobal||[]).filter(e=>(e["ESTATUS"]||"").trim()==="Activo").forEach(e=>{
        if(e["DEPARTAMENTO"]) deptos.add(e["DEPARTAMENTO"].trim());
        if(e["PUESTO"])       puestos.add(e["PUESTO"].trim());
    });
    catalogoDeptos  = Array.from(deptos).sort();
    catalogoPuestos = Array.from(puestos).sort();
    const listD = document.getElementById('list-departamentos');
    if(listD) listD.innerHTML = catalogoDeptos.map(d=>'<option value="'+d+'">').join('');
    const listP = document.getElementById('list-puestos');
    if(listP) listP.innerHTML = catalogoPuestos.map(p=>'<option value="'+p+'">').join('');
}

function renderizarCampo(c){
    const cls="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-300";
    const span=c.col===1?'md:col-span-2':'';
    const ph=c.placeholder?`placeholder="${c.placeholder}"`:'';
    const ml=c.maxlen?`maxlength="${c.maxlen}"`:'';
    const req=c.req?'<span class="text-red-400">*</span>':'';
    const nota=c.readonly?'<span class="text-xs text-blue-400 ml-1 font-normal">⟵ automático</span>':'';
    let inp;
    if(c.type==='places'){
        // Input con autocompletado de Google Places (Mexico)
        inp = '<div class="relative md:col-span-2 w-full">'
            + '<input type="text" id="alta_'+c.id+'" '+(c.req?'required':'')+' placeholder="'+( c.placeholder||'')+'" autocomplete="off" class="'+cls+' pr-10">'
            + '<div id="places-suggestions-'+c.id+'" class="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto hidden"></div>'
            + '</div>';
        // Inicializar Places después de renderizar
        setTimeout(()=>initPlacesInput('alta_'+c.id,'places-suggestions-'+c.id), 100);
    } else if(c.type==='datalist'){
        // Input de texto libre con sugerencias de la BD
        // Permite escribir un valor nuevo o seleccionar uno existente
        const listId = c.listId || ('list-'+c.id);
        inp = '<input type="text" id="alta_'+c.id+'" '+(c.req?'required':'')+' '+(c.placeholder?'placeholder="'+c.placeholder+'"':'')+' list="'+listId+'" autocomplete="off" class="'+cls+'">'
            + '<datalist id="'+listId+'">'
            + (c.listId==='list-departamentos' ? catalogoDeptos : catalogoPuestos).map(function(o){return '<option value="'+o+'">';}).join('')
            + '</datalist>';
    } else if(c.type==='select-dynamic'){
        // Select cuyas opciones se leen en tiempo de render desde una función
        // Siempre refleja la lista actualizada de empresas del cacheGlobal
        var opsDyn = typeof c.optionsFn === 'function' ? c.optionsFn() : (c.options||[]);
        inp = '<select id="alta_'+c.id+'" '+(c.req?'required':'')+' class="'+cls+' cursor-pointer">'
            + '<option value="">Seleccione...</option>'
            + opsDyn.map(function(o){ return '<option value="'+o+'">'+o+'</option>'; }).join('')
            + '</select>';
    } else if(c.type==='select'){
        inp=`<select id="alta_${c.id}" ${c.req?'required':''} ${c.readonly?'title="Calculado automáticamente"':''} class="${cls} ${c.readonly?'bg-slate-50 cursor-default':'cursor-pointer'}"><option value="">Seleccione...</option>${(c.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
    }else if(c.type==='textarea'){
        inp=`<textarea id="alta_${c.id}" rows="2" ${ph} class="${cls} resize-none"></textarea>`;
    }else{
        inp=`<input type="${c.type}" id="alta_${c.id}" ${c.req?'required':''} ${ml} ${ph} ${c.readonly?'readonly tabindex="-1"':''} class="${cls} ${c.readonly?'bg-slate-50 text-slate-400 cursor-default':''}">`;
    }
    // adminOnly: oculto por defecto, se muestra solo cuando tipoIngreso = Administrativo
    const estiloAdmin = c.adminOnly ? ' style="display:none"' : '';
    return`<div class="${span}" data-campo-id="alta_${c.id}"${estiloAdmin}><label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">${c.label} ${req}${nota}</label>${inp}</div>`;
}

function manejarDrop(event){
    event.preventDefault();
    document.getElementById('drop-zone').classList.remove('border-amber-400','bg-amber-50');
    const input=document.getElementById('alta_archivos');
    const dt=event.dataTransfer;
    // Crear un DataTransfer nuevo con los archivos soltados
    const transfer=new DataTransfer();
    Array.from(dt.files).forEach(f=>transfer.items.add(f));
    input.files=transfer.files;
    actualizarListaArchivos();
}

function actualizarListaArchivos(){
    const input=document.getElementById('alta_archivos');
    const lista=document.getElementById('lista-archivos');
    if(!lista||!input)return;
    const archivos=Array.from(input.files);
    // Guardar referencia a los archivos en altaData para cuando se confirme el alta
    altaData._archivos = input.files;
    if(!archivos.length){lista.innerHTML='';return;}
    lista.innerHTML=archivos.map(f=>{
        const mb=(f.size/1024/1024).toFixed(1),ok=f.size<=10*1024*1024;
        const icon=f.type.startsWith('image/')?'fa-file-image text-blue-400':'fa-file-pdf text-red-400';
        return`<div class="flex items-center gap-3 bg-white border ${ok?'border-slate-200':'border-red-200'} rounded-xl px-4 py-2.5">
          <i class="fas ${icon} text-lg flex-shrink-0"></i>
          <div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-700 truncate">${f.name}</p><p class="text-xs ${ok?'text-slate-400':'text-red-400'}">${mb} MB ${ok?'':'— supera el límite de 10 MB'}</p></div>
          <i class="fas fa-check-circle ${ok?'text-emerald-400':'text-red-400'} flex-shrink-0"></i>
        </div>`;
    }).join('');
}

async function cargarSiguienteNumero(){
    const empresa = (altaData.empresa || document.getElementById("alta_empresa")?.value || "").trim();
    console.log("[cargarSiguienteNumero] empresa:", JSON.stringify(empresa));
    if(!empresa){
        const el = document.getElementById("alta_numeroEmpleado");
        if(el) el.placeholder = "Selecciona la empresa primero";
        return;
    }

    // Detectar reingreso: buscar en cache por CURP o RFC en la misma empresa
    const curpAlta = (altaData.curp||"").trim().toUpperCase();
    const rfcAlta  = (altaData.rfc||"").trim().toUpperCase();
    const reingresoExistente = cacheGlobal.find(function(e){
        const empE  = (e["EMPRESA"]||"").trim();
        const curpE = (e["CURP"]||"").trim().toUpperCase();
        const rfcE  = (e["RFC"]||"").trim().toUpperCase();
        const est   = (e["ESTATUS"]||"").trim();
        if(empE !== empresa || est !== "Baja") return false;
        return (curpAlta && curpE === curpAlta) || (rfcAlta && rfcE === rfcAlta);
    });

    try{
        const r = await enviarPeticion("siguiente_numero", { empresa: empresa });
        if(r.status === "success"){
            const el = document.getElementById("alta_numeroEmpleado");
            // Si es reingreso, usar el número anterior
            const numSugerido = reingresoExistente
                ? (reingresoExistente["NO. EMPLEADO"]||"").toString()
                : r.siguiente.toString();
            if(el){
                el.value = numSugerido;
                el.placeholder = "";
                el.readOnly = false; // Siempre editable
            }
            altaData.numeroEmpleado = numSugerido;
            if(r.idInterno) altaData._idInterno = r.idInterno;

            // Mostrar aviso de reingreso si aplica
            if(reingresoExistente){
                const nomAnterior = reingresoExistente["NOMBRE DEL TRABAJADOR"]||"";
                const feingAnterior = reingresoExistente["FECHA DE INGRESO"]||"";
                mostrarToast('info','Reingreso detectado',
                    `${nomAnterior} ya trabajó aquí. Se asigna el No. ${numSugerido} de su ingreso anterior. Puedes cambiarlo si lo necesitas.`, 8000);
            }
        }
    }catch(e){ console.warn("cargarSiguienteNumero:", e); }
}

// ─── DECODIFICADOR CURP ───────────────────────────────────────
const ESTADOS_CURP={AS:'Aguascalientes',BC:'Baja California',BS:'Baja California Sur',CC:'Campeche',CL:'Coahuila',CM:'Colima',CS:'Chiapas',CH:'Chihuahua',DF:'Ciudad de México',DG:'Durango',GT:'Guanajuato',GR:'Guerrero',HG:'Hidalgo',JC:'Jalisco',MC:'Estado de México',MN:'Michoacán',MS:'Morelos',NT:'Nayarit',NL:'Nuevo León',OC:'Oaxaca',PL:'Puebla',QT:'Querétaro',QR:'Quintana Roo',SP:'San Luis Potosí',SL:'Sinaloa',SR:'Sonora',TC:'Tabasco',TS:'Tamaulipas',TL:'Tlaxcala',VZ:'Veracruz',YN:'Yucatán',ZS:'Zacatecas',NE:'Nacido en el Extranjero'};

function decodificarCURP(curp){
    curp=curp.toUpperCase().trim();if(curp.length!==18)return null;
    try{
        const anio2=curp.substring(4,6),mes=curp.substring(6,8),dia=curp.substring(8,10);
        const sexo=curp.charAt(10),estado=curp.substring(11,13);
        let anio4=parseInt(anio2,10);
        anio4=anio4+(anio4<=parseInt(new Date().getFullYear().toString().slice(2),10)?2000:1900);
        if(anio4>new Date().getFullYear())anio4-=100;
        return{fechaNacimiento:anio4+'-'+mes+'-'+dia,genero:sexo==='H'?'Hombre':sexo==='M'?'Mujer':'',lugarNacimiento:ESTADOS_CURP[estado]||estado,nacionalidad:estado==='NE'?'Extranjera':'Mexicana'};
    }catch(e){return null;}
}


// ─── NORMALIZAR NOMBRE A TITLE CASE ──────────────────────────
// Convierte "ERRAZÚ HERNÁNDEZ HÉCTOR RAFAEL" → "Errazú Hernández Héctor Rafael"
// Maneja acentos, ñ y partículas como "de", "del", "la", "los"
function toTitleCase(nombre) {
    if (!nombre) return '';
    var particulas = new Set(['de','del','la','las','los','y','e','i']);
    return nombre.toLowerCase().split(' ').map(function(palabra, idx) {
        if (!palabra) return '';
        // Las partículas van en minúsculas excepto si son la primera palabra
        if (idx > 0 && particulas.has(palabra)) return palabra;
        // Primera letra mayúscula, resto minúsculas
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');
}
function aplicarDatosCURP(datos){
    Object.entries(datos).forEach(([k,v])=>{
        if(!v)return;
        altaData[k]=v; // Siempre guardar en altaData aunque no haya campo DOM
        const el=document.getElementById('alta_'+k);
        if(el) el.value=v;
    });
    // Calcular rango de edad aunque no haya campos DOM visibles
    if(datos.fechaNacimiento) calcularRangoEdadAuto();
}

function calcularRangoEdadAuto(){
    // Funciona con o sin campo visible en el DOM
    const fechaVal = altaData.fechaNacimiento ||
                     document.getElementById('alta_fechaNacimiento')?.value || '';
    if(!fechaVal) return;
    const h=new Date(), nac=new Date(fechaVal);
    if(isNaN(nac)) return;
    let ed=h.getFullYear()-nac.getFullYear();
    if(h.getMonth()<nac.getMonth()||(h.getMonth()===nac.getMonth()&&h.getDate()<nac.getDate()))ed--;
    const r=ed<31?'<31':ed<=50?'31-50':ed<=65?'51-65':'>65';
    altaData.rangoEdad=r;
    const rn=document.getElementById('alta_rangoEdad');
    if(rn) rn.value=r;
}

// ─── OCR — PROXY VÍA GAS (resuelve CORS) ────────────────────
// El frontend envía el archivo en Base64 al GAS.
// El GAS llama a Google Vision / Drive sin restricciones CORS.

// ── PDF → PNG usando PDF.js (Mozilla) ────────────────────────
// Renderiza la primera página del PDF como imagen PNG de alta resolución.
// PDF.js se carga dinámicamente desde CDN la primera vez.
// No requiere instalación ni dependencias adicionales.
async function pdfPaginaAPNG(file, escala) {
    escala = escala || 2.5; // 2.5x = alta resolución (~A4 → ~2000px ancho)

    // Cargar PDF.js si no está disponible
    if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = res;
            s.onerror = () => rej(new Error('No se pudo cargar PDF.js'));
            document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Leer archivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Cargar el PDF — renderizar TODAS las páginas en un solo canvas vertical
    // (la constancia SAT tiene 2 páginas: RFC/nombre en p1, CURP/domicilio en p2)
    const pdf        = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPaginas = pdf.numPages;

    const canvases = [];
    let anchoMax = 0, altoTotal = 0;
    for (let i = 1; i <= numPaginas; i++) {
        const pag      = await pdf.getPage(i);
        const viewport = pag.getViewport({ scale: escala });
        const c        = document.createElement('canvas');
        c.width        = viewport.width;
        c.height       = viewport.height;
        await pag.render({ canvasContext: c.getContext('2d'), viewport }).promise;
        canvases.push(c);
        anchoMax   = Math.max(anchoMax, c.width);
        altoTotal += c.height;
    }

    // Combinar todas las páginas verticalmente
    const final   = document.createElement('canvas');
    final.width   = anchoMax;
    final.height  = altoTotal;
    const ctx     = final.getContext('2d');
    let offsetY   = 0;
    for (const c of canvases) { ctx.drawImage(c, 0, offsetY); offsetY += c.height; }

    const dataUrl = final.toDataURL('image/png');
    return dataUrl.split(',')[1];
}

async function ejecutarOCR() {
    const input = document.getElementById('alta_archivos');
    if (!input || !input.files.length) {
        mostrarToast('warning', 'Sin archivos', 'Selecciona o arrastra al menos un documento para analizar.');
        return;
    }

    const stEl  = document.getElementById('ocr-status');
    const stTxt = document.getElementById('ocr-status-txt');
    const btn   = document.getElementById('btn-ocr');

    stEl.classList.remove('hidden');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando con IA...';

    let acum    = {};
    let errores = [];

    for (const file of Array.from(input.files)) {
        const esPDF    = file.type === 'application/pdf';
        const esImagen = file.type.startsWith('image/');
        if (!esPDF && !esImagen) continue;

        stTxt.innerText = `Enviando al servidor: ${file.name}...`;

        // Validar tamaño — GAS tiene límite de payload ~30 MB
        if (file.size > 8 * 1024 * 1024) {
            errores.push(`${file.name}: el archivo supera 8 MB. Comprime el PDF o reduce la resolución de la imagen.`);
            continue;
        }

        try {
            let b64Envio    = null;
            let mimeEnvio   = file.type;
            let nombreEnvio = file.name;

            if (esPDF) {
                // PDF → PNG de alta resolución con PDF.js (todas las páginas)
                // Esto permite que Vision API lea el texto correctamente
                stTxt.innerText = `Renderizando PDF: ${file.name}...`;
                try {
                    const pngB64 = await pdfPaginaAPNG(file);
                    if (pngB64) {
                        b64Envio    = pngB64;
                        mimeEnvio   = 'image/png';
                        nombreEnvio = file.name.replace(/\.pdf$/i, '.png');
                        console.log('[OCR] PDF convertido a PNG, enviando a Vision+Groq');
                    }
                } catch(pdfErr) {
                    console.warn('[OCR] PDF.js falló, se enviará el PDF directo:', pdfErr);
                }
            }

            // Si no se convirtió (imagen original o PDF.js falló) → leer como base64
            if (!b64Envio) {
                b64Envio = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload  = () => res(r.result.split(',')[1]);
                    r.onerror = () => rej(new Error('Error leyendo ' + file.name));
                    r.readAsDataURL(file);
                });
            }

            stTxt.innerText = `Analizando: ${file.name}...`;
            console.log('[OCR] Enviando:', nombreEnvio, mimeEnvio);

            // Motor 1: groq_ocr — Vision API extrae texto del PNG → Groq analiza campos
            // Motor 2: ocr_documento — pipeline alternativo con regex
            let r = await enviarPeticion('groq_ocr', {
                data:     b64Envio,
                mimeType: mimeEnvio,
                nombre:   nombreEnvio
            });
            console.log('[OCR] Resultado groq_ocr:', JSON.stringify(r));
            if (r.status !== 'success') {
                console.warn('[OCR] groq_ocr falló, usando ocr_documento:', r.message);
                r = await enviarPeticion('ocr_documento', {
                    data:     b64Envio,
                    mimeType: mimeEnvio,
                    nombre:   nombreEnvio
                });
            }

            if (r.status !== 'success') {
                errores.push(`${file.name}: ${r.message}`);
                continue;
            }

            // Acumular con prioridad por tipo de documento
            const _tipo = (r.tipoDocumento || '').toUpperCase();
            const _autoridad = {
                'SAT':       new Set(['rfc','curp','nombreTrabajador','domicilioCompleto']),
                'CURP':      new Set(['curp','nombreTrabajador']),
                'INE':       new Set(['nombreTrabajador','curp','domicilioCompleto']),
                'IMSS':      new Set(['nss','nombreTrabajador','curp']),
                'CFE':       new Set(['domicilioCompleto','nombreTrabajador']),
                'TELMEX':    new Set(['domicilioCompleto','nombreTrabajador']),
                'AGUA':      new Set(['domicilioCompleto','nombreTrabajador']),
                'PASAPORTE': new Set(['nombreTrabajador','curp']),
                'ACTA':      new Set(['nombreTrabajador','curp']),
                'TITULO':    new Set(['nombreTrabajador','escolaridad']),
            };
            const _auth = _autoridad[_tipo] || null;
            Object.entries(r.datos || {}).forEach(([k, v]) => {
                if (!v || !v.toString().trim()) return;
                if (!acum[k] || !_auth || _auth.has(k)) acum[k] = v.toString().trim();
            });

        } catch (e) {
            errores.push(`${file.name}: ${e.message}`);
        }
    }

    // ── Aplicar resultados al altaData ────────────────────────
    // Solo campos que SÍ se muestran del OCR
    const mapaL = {
        nombreTrabajador: 'Nombre',
        curp:             'CURP',
        rfc:              'RFC',
        nss:              'NSS',
        domicilioCompleto:'Domicilio',
        escolaridad:      'Escolaridad'
    };
    const detectados = [];

    // Campos que NUNCA se muestran ni se aplican desde el OCR
    // Son calculados por fórmulas del Sheet o capturados manualmente
    const CAMPOS_EXCLUIDOS = new Set([
        'genero','lugarNacimiento','nacionalidad','fechaNacimiento',
        'estadoCivil','telefonoPersonal','correoElectronico',
        'tipoDocumento','_motor'
    ]);

    Object.entries(acum).forEach(([k, v]) => {
        if (!v || CAMPOS_EXCLUIDOS.has(k)) return; // Filtrar campos no permitidos
        const _noUp = new Set(['correoElectronico','fechaNacimiento','urlFoto']);
        if (!_noUp.has(k)) v = v.toString().toUpperCase().trim();
        altaData[k] = v;
        detectados.push(`<div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-100">
            <i class="fas fa-check text-emerald-500 text-xs flex-shrink-0"></i>
            <span class="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">${mapaL[k] || k}:</span>
            <span class="text-xs text-slate-700 font-mono truncate">${v}</span>
        </div>`);
    });

    // Si detectó CURP, decodificar para obtener fecha, género, estado
    if (acum.curp && acum.curp.length === 18) {
        const d = decodificarCURP(acum.curp);
        if (d) {
            // Solo aplicar los que la IA no detectó directamente
            Object.entries(d).forEach(([k, v]) => {
                if (!acum[k] && v) { altaData[k] = v; }
            });
        }
    }
    if (altaData.fechaNacimiento) {
        const fn = document.getElementById('alta_fechaNacimiento');
        if (fn) { fn.value = altaData.fechaNacimiento; calcularRangoEdadAuto(); }
    }

    // ── Restaurar UI ──────────────────────────────────────────
    stEl.classList.add('hidden');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magnifying-glass"></i> Analizar documentos con IA y pre-rellenar formulario';

    const resEl    = document.getElementById('ocr-resultado');
    const camposEl = document.getElementById('ocr-campos-detectados');

    if (detectados.length) {
        resEl.classList.remove('hidden');
        camposEl.innerHTML = detectados.join('');
        const notaErr = errores.length ? ` (${errores.length} archivo(s) con advertencia)` : '';
        mostrarToast('success', `${detectados.length} campo(s) detectados`, 'Datos aplicados al formulario.' + notaErr, 6000);
    } else if (errores.length) {
        resEl.classList.remove('hidden');
        camposEl.innerHTML = `<div class="col-span-2 bg-red-50 border border-red-200 rounded-xl p-4">
            <p class="text-sm font-bold text-red-700 mb-2"><i class="fas fa-circle-xmark mr-2"></i>No se pudieron extraer datos</p>
            ${errores.map(e => `<p class="text-xs text-red-600 mb-1">• ${e}</p>`).join('')}
            <div class="mt-3 pt-3 border-t border-red-200 space-y-1">
              <p class="text-xs font-semibold text-slate-600">¿Qué hacer?</p>
              <p class="text-xs text-slate-500">• Verifica que GOOGLE_VISION_API_KEY esté configurada en las propiedades del script de GAS</p>
              <p class="text-xs text-slate-500">• Si el PDF tiene contraseña o está protegido, primero quítale la protección</p>
              <p class="text-xs text-slate-500">• Puedes capturar manualmente los datos en los pasos siguientes</p>
            </div>
        </div>`;
        mostrarToast('warning', 'Sin datos detectados', errores[0], 8000);
    } else {
        mostrarToast('warning', 'Sin datos detectados', 'La IA no encontró información reconocible en los documentos.', 6000);
    }
}


// ─── STEPPER NAVEGACIÓN ───────────────────────────────────────
function guardarPasoActual(){
    const paso=PASOS[pasoActual];
    if(paso.id==='paso-documentos'||paso.id==='paso-resumen')return true;
    let valido=true;
    paso.campos.forEach(c=>{
        const el=document.getElementById('alta_'+c.id);if(!el)return;
        const val=el.value.trim();
        // Solo actualizar altaData si el campo tiene valor O si no venía del OCR
        // Esto evita sobreescribir datos detectados por el OCR con valores vacíos
        if(val!==''||!altaData[c.id]){
            altaData[c.id]=val;
        }
        if(c.req&&!altaData[c.id]){
            el.classList.add('border-red-400','ring-1','ring-red-300');valido=false;
        } else {
            el.classList.remove('border-red-400','ring-1','ring-red-300');
        }
    });
    if(!valido)mostrarToast('warning','Campos requeridos','Completa los campos marcados con * para continuar.');
    return valido;
}
function restaurarValoresPaso(){
    const paso=PASOS[pasoActual];
    paso.campos.forEach(c=>{const el=document.getElementById('alta_'+c.id);if(!el||altaData[c.id]===undefined)return;el.value=altaData[c.id];});
    if(paso.id==='paso-personal') calcularRangoEdadAuto();
    if(paso.id==='paso-contrato'){
        // Paso 1 (50ms): mostrar/ocultar campos 4-6 según tipo
        // Paso 2 (300ms): calcular fechas DESPUÉS de que los campos ya son visibles
        setTimeout(function(){
            actualizarVisibilidadContratos();
        }, 50);
        // Adjuntar listener de cambio en fecha inicio contrato
        // El listener también espera a que visibilidad esté aplicada antes de calcular
        var elFecIni = document.getElementById('alta_fechaInicioContrato');
        if(elFecIni && !elFecIni._calcListenerAttached){
            elFecIni.addEventListener('change', function(){
                // Actualizar visibilidad primero, luego calcular con delay
                actualizarVisibilidadContratos();
                setTimeout(function(){ calcularFechasContrato(); }, 250);
            });
            elFecIni._calcListenerAttached = true;
        }
        // tipoIngreso: actualizar visibilidad y recalcular
        var elTipo = document.getElementById('alta_tipoIngreso');
        if(elTipo && !elTipo._calcListenerAttached){
            elTipo.addEventListener('change', function(){
                actualizarVisibilidadContratos();
                setTimeout(function(){
                    if(document.getElementById('alta_fechaInicioContrato')?.value) calcularFechasContrato();
                }, 250);
            });
            elTipo._calcListenerAttached = true;
        }
        // Auto-calcular si ya hay fecha — esperar a que visibilidad esté aplicada
        setTimeout(function(){
            var fi = document.getElementById('alta_fechaInicioContrato');
            var vc = document.getElementById('alta_vencimientoPrimerContrato');
            if(fi && fi.value && (!vc || !vc.value)) calcularFechasContrato();
        }, 350);
    }
}
function irAPaso(idx){
    if(idx>pasoActual){if(!guardarPasoActual())return;}else guardarPasoActual();
    pasoActual=idx;renderizarStepper();restaurarValoresPaso();
    document.getElementById('stepper-contenido').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function siguientePaso(){if(!guardarPasoActual())return;if(pasoActual<PASOS.length-1){pasoActual++;renderizarStepper();restaurarValoresPaso();}}
function anteriorPaso(){guardarPasoActual();if(pasoActual>0){pasoActual--;renderizarStepper();restaurarValoresPaso();}}
function actualizarBotones(){
    const ul=pasoActual===PASOS.length-1;
    document.getElementById('btn-anterior')?.classList.toggle('hidden',pasoActual===0);
    document.getElementById('btn-siguiente')?.classList.toggle('hidden',ul);
    document.getElementById('btn-enviar')?.classList.toggle('hidden',!ul);
}

function renderizarResumen(){
    const el=document.getElementById('resumen-alta');if(!el)return;
    const secciones=[
        {titulo:'Datos Laborales',icono:'fa-briefcase',color:'text-blue-500',filas:[['No. Empleado',altaData.numeroEmpleado],['Fecha de Ingreso',altaData.fechaIngreso],['Nombre Completo',altaData.nombreTrabajador],['Empresa',altaData.empresa],['Grupo Comercial',altaData.grupoComercial],['Departamento',altaData.departamento],['Puesto',altaData.puesto],['Tipo de Ingreso',altaData.tipoIngreso],['Sueldo Mensual',altaData.sueldoMensual?'$'+Number(altaData.sueldoMensual).toLocaleString('es-MX'):''],['Frecuencia de Pago',altaData.frecuenciaPago]]},
        {titulo:'Contrato',icono:'fa-file-contract',color:'text-indigo-500',filas:[['Tipo de Contrato',altaData.tipoContrato],['Inicio 1er Contrato',altaData.fechaInicioContrato],['Vencimiento 1er Contrato',altaData.vencimientoPrimerContrato]]},
        {titulo:'Datos Personales',icono:'fa-id-card',color:'text-teal-500',filas:[['CURP',altaData.curp],['RFC',altaData.rfc],['NSS',altaData.nss],['Estado Civil',altaData.estadoCivil],['Escolaridad',altaData.escolaridad],['Fecha Nac. (detectada)',altaData.fechaNacimiento],['Género (detectado)',altaData.genero],['Nac. (detectada)',altaData.nacionalidad],['Lugar Nac. (detectado)',altaData.lugarNacimiento]]},
    ];
    el.innerHTML=secciones.map(s=>{
        const filas=s.filas.filter(([,v])=>v);
        if(!filas.length)return'';
        return`<div class="px-5 py-4"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2"><i class="fas ${s.icono} ${s.color}"></i>${s.titulo}</p><div class="space-y-2">${filas.map(([k,v])=>`<div class="flex justify-between gap-4"><span class="text-xs text-slate-400 font-medium">${k}</span><span class="text-sm font-semibold text-slate-700 text-right">${v}</span></div>`).join('')}</div></div>`;
    }).join('');
}

async function enviarAlta(){
    guardarPasoActual();
    const reqs=PASOS.flatMap(p=>p.campos.filter(c=>c.req).map(c=>c.id));
    const falt=reqs.filter(id=>!altaData[id]);
    if(falt.length){mostrarToast('error','Faltan datos requeridos','Revisa los pasos anteriores: '+falt.join(', '));return;}
    mostrarLoader("Creando expediente...");
    const docs=[];
    // Los archivos se guardaron en altaData._archivos cuando se seleccionaron en el paso 0
    // El elemento alta_archivos ya no existe en el DOM al llegar al paso final
    const archivosGuardados = altaData._archivos || 
                              document.getElementById('alta_archivos')?.files || 
                              [];
    for(const file of Array.from(archivosGuardados)){
        if(file.size>10*1024*1024){
            ocultarLoader();
            mostrarToast('error','Archivo demasiado grande',`"${file.name}" supera 10 MB.`);
            return;
        }
        const b64=await new Promise((res,rej)=>{
            const r=new FileReader();
            r.onload=()=>res(r.result.split(',')[1]);
            r.onerror=rej;
            r.readAsDataURL(file);
        });
        docs.push({nombreArchivo:file.name,mimeType:file.type||'application/octet-stream',data:b64});
    }
    try{
        const r=await enviarPeticion("alta",{...altaData,documentos:docs});
        ocultarLoader();
        if(r.status==="success"){
            mostrarToast('success','¡Alta registrada!',`Expediente creado para ${altaData.nombreTrabajador}.`,8000);
            Swal.fire({icon:'success',title:'¡Alta registrada!',text:r.message,confirmButtonText:'Ver expediente en Drive',showCancelButton:true,cancelButtonText:'Cerrar'}).then(res=>{if(res.isConfirmed&&r.urlExpediente)window.open(r.urlExpediente,'_blank');abrirModalGenerarContrato(r.idInterno, r.contratoPrefill);});
            altaData={};pasoActual=0;renderizarStepper();forzarActualizacion();
        }else mostrarToast('error','Error en el alta',r.message);
    }catch(e){ocultarLoader();mostrarToast('error','Error de conexión',e.message);}
}


// ══════════════════════════════════════════════════════════════
//  AUTENTICACIÓN — RRHH Prisma
// ══════════════════════════════════════════════════════════════
let sesionActual = null;

function getToken(){  try{return localStorage.getItem('prisma_token')||'';}catch(e){return '';} }
function setToken(t){ try{localStorage.setItem('prisma_token',t);}catch(e){} }
function clearToken(){try{localStorage.removeItem('prisma_token');}catch(e){} }

function mostrarLoginError(msg){
    const el=document.getElementById('login-error');
    const ms=document.getElementById('login-error-msg');
    if(el) el.classList.remove('hidden');
    if(ms) ms.textContent=msg||'Error desconocido';
}

function togglePassVis(){
    const inp=document.getElementById('login-pass');
    const ico=document.getElementById('pass-eye');
    if(!inp) return;
    if(inp.type==='password'){
        inp.type='text';
        if(ico){ico.classList.remove('fa-eye');ico.classList.add('fa-eye-slash');}
    } else {
        inp.type='password';
        if(ico){ico.classList.remove('fa-eye-slash');ico.classList.add('fa-eye');}
    }
}


// ── Olvidé mi contraseña ──────────────────────────────────────
function mostrarFormOlvidePass() {
    const modal = document.getElementById('modal-olvide');
    if(modal) { modal.style.display = 'flex'; }
    const inp = document.getElementById('olvide-email');
    if(inp) { inp.value = ''; inp.focus(); }
    const err = document.getElementById('olvide-error');
    const ok  = document.getElementById('olvide-success');
    const frm = document.getElementById('olvide-form');
    if(err) err.style.display = 'none';
    if(ok)  ok.style.display  = 'none';
    if(frm) frm.style.display = 'block';
}

function cerrarModalOlvide() {
    const modal = document.getElementById('modal-olvide');
    if(modal) modal.style.display = 'none';
}

async function procesarOlvidePass() {
    const email = (document.getElementById('olvide-email')?.value || '').trim().toLowerCase();
    const errEl = document.getElementById('olvide-error');
    const okEl  = document.getElementById('olvide-success');
    const frm   = document.getElementById('olvide-form');
    const btn   = document.getElementById('btn-olvide');

    if(errEl) errEl.style.display = 'none';
    if(okEl)  okEl.style.display  = 'none';

    if(!email) {
        if(errEl){ errEl.textContent = 'Ingresa tu correo electrónico.'; errEl.style.display = 'block'; }
        return;
    }

    if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...'; }

    try {
        const r = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'solicitar_reset', payload: { email } })
        });
        const data = await r.json();

        if(data.status === 'success' || data.status === 'info') {
            if(frm) frm.style.display = 'none';
            if(okEl){
                okEl.innerHTML = '<i class="fas fa-check-circle" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>'
                    + '<strong>Instrucciones enviadas</strong><br>'
                    + 'Revisa tu bandeja de entrada. Si tu correo está registrado, recibirás un email con tu contraseña temporal en los próximos minutos.';
                okEl.style.display = 'block';
            }
        } else {
            if(errEl){ errEl.textContent = data.message || 'Error al procesar la solicitud.'; errEl.style.display = 'block'; }
        }
    } catch(e) {
        if(errEl){ errEl.textContent = 'Error de conexión. Intenta de nuevo.'; errEl.style.display = 'block'; }
    } finally {
        if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar instrucciones'; }
    }
}

async function verificarSesion(){
    const token=getToken();
    if(!token){
        console.log('[verificarSesion] Sin token — mostrando login');
        mostrarLoginScreen();
        return false;
    }
    console.log('[verificarSesion] Token encontrado, validando...');

    // BUGFIX: antes, cualquier falla de red/timeout al validar el token
    // (GAS lento en arrancar, wifi intermitente, etc.) borraba el token
    // válido con clearToken() y forzaba re-login — esto es lo que causaba
    // que "a veces cargue y a veces no": no era un problema de permisos,
    // era una petición de red que fallaba y tiraba la sesión buena.
    // Ahora: solo se borra el token cuando el SERVIDOR responde explícitamente
    // que es inválido/expirado. Si es un error de red/timeout, se reintenta
    // una vez antes de rendirse, y si aun así falla, se avisa sin cerrar sesión.
    for(let intento=1; intento<=2; intento++){
        try{
            const r=await enviarPeticion('validar_token',{token});
            console.log('[verificarSesion] Respuesta GAS:', r.status, r.message||'');
            if(r.status==='success'){
                sesionActual={token,usuario:r.usuario};
                aplicarSesion(r.usuario);
                ocultarLoginScreen();
                console.log('[verificarSesion] Sesión válida:', r.usuario.email);
                return true;
            }
            // Respuesta explícita del servidor: token realmente inválido/expirado
            console.warn('[verificarSesion] Token inválido:', r.message);
            clearToken();
            mostrarLoginScreen(r.message||'Tu sesión expiró. Inicia sesión de nuevo.');
            return false;
        }catch(e){
            console.error('[verificarSesion] Error de red/timeout (intento '+intento+'):', e.message||e);
            if(intento===1){
                await new Promise(res=>setTimeout(res,1200));
                continue;
            }
        }
    }

    // Dos intentos fallidos por red/timeout, sin respuesta clara del servidor:
    // NO borramos el token (puede seguir siendo válido), solo avisamos.
    mostrarLoginScreen('No se pudo verificar tu sesión por un problema de conexión. Revisa tu internet e intenta de nuevo.');
    return false;
}

function mostrarLoginScreen(msg){
    const ls=document.getElementById('login-screen');
    if(ls) ls.style.display='flex';
    if(msg) mostrarLoginError(msg);
}

function ocultarLoginScreen(){
    const ls=document.getElementById('login-screen');
    if(ls) ls.style.display='none';
}

async function procesarLogin(){
    const email=(document.getElementById('login-email')?.value||'').trim();
    const pass=(document.getElementById('login-pass')?.value||'').trim();
    const errEl=document.getElementById('login-error');
    if(errEl) errEl.classList.add('hidden');
    if(!email||!pass){mostrarLoginError('Ingresa tu correo y contraseña.');return;}
    const btn=document.getElementById('btn-login');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verificando...';}
    try{
        const device=navigator.userAgent.substring(0,100);
        const res=await fetch(API_URL,{method:'POST',body:JSON.stringify({action:'login',payload:{email,password:pass,device}})});
        const r=await res.json();
        if(r.status==='success'){
            setToken(r.token);
            sesionActual={token:r.token,usuario:r.usuario};
            aplicarSesion(r.usuario);
            ocultarLoginScreen();
            await initApp();
        } else {
            mostrarLoginError(r.message||'Credenciales incorrectas.');
            if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Entrar';}
        }
    }catch(e){
        mostrarLoginError('Error de conexión. Intenta de nuevo.');
        if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Entrar';}
    }
}

function aplicarSesion(usuario){
    if(!usuario) return;
    const labelNav=document.getElementById('nav-label-usuarios');
    if(labelNav) labelNav.textContent=usuario.rol==='Administrador'?'Usuarios':'Mi Perfil';
    const headerUser=document.getElementById('header-usuario');
    if(headerUser) headerUser.textContent=usuario.nombre||'';
    window._empresasPermitidas=(usuario.rol!=='Administrador'&&usuario.empresas&&usuario.empresas.length)?usuario.empresas:null;
}

async function procesarLogout(){
    const token=getToken();
    if(token){try{await fetch(API_URL,{method:'POST',body:JSON.stringify({action:'logout',payload:{token}})});}catch(e){}}
    clearToken();
    sesionActual=null;
    window._empresasPermitidas=null;
    cacheGlobal=[];
    datosFiltrados=[];
    mostrarLoginScreen();
}

function filtrarPorEmpresasPermitidas(datos){
    if(!window._empresasPermitidas||!window._empresasPermitidas.length) return datos;
    return datos.filter(function(e){
        return window._empresasPermitidas.some(function(emp){
            return (e["EMPRESA"]||"").trim().toLowerCase()===emp.trim().toLowerCase();
        });
    });
}

async function cargarModuloUsuarios(){
    if(!sesionActual) return;
    const rol=sesionActual.usuario.rol;
    const panelAdmin=document.getElementById('panel-usuarios-admin');
    const panelAux=document.getElementById('panel-perfil-auxiliar');
    if(rol==='Administrador'){
        if(panelAdmin) panelAdmin.classList.remove('hidden');
        if(panelAux)   panelAux.classList.add('hidden');
        await cargarTablaUsuarios();
    } else {
        if(panelAdmin) panelAdmin.classList.add('hidden');
        if(panelAux)   panelAux.classList.remove('hidden');
        renderizarPerfilAuxiliar();
    }
}

async function cargarTablaUsuarios(){
    const cont=document.getElementById('tabla-usuarios-container');
    if(!cont) return;
    cont.innerHTML='<p class="text-sm text-slate-400 text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</p>';
    const r=await enviarPeticion('listar_usuarios',{token:getToken()});
    if(r.status!=='success'){cont.innerHTML='<p class="text-sm text-red-400 text-center py-8">'+r.message+'</p>';return;}
    const us=r.usuarios||[];
    cont.innerHTML='<div class="overflow-x-auto" id="tabla-usr-wrap"><table class="w-full text-sm text-left">'
        +'<thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b">'
        +'<tr><th class="px-4 py-3">Usuario</th><th class="px-4 py-3">Email</th>'
        +'<th class="px-4 py-3">Rol</th><th class="px-4 py-3">Empresas</th>'
        +'<th class="px-4 py-3">Estatus</th><th class="px-4 py-3 text-center">Acciones</th></tr></thead>'
        +'<tbody class="divide-y divide-slate-100">'
        +us.map(function(u){
            const activo=u.estatus==='Activo';
            const badge=activo?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600';
            const emps=(u.empresas||[]).join(', ')||'—';
            const ini=((u.nombre||'U').split(' ')[0]||'U')[0].toUpperCase();
            return '<tr class="hover:bg-slate-50">'
                +'<td class="px-4 py-3"><div class="flex items-center gap-2">'
                +'<div class="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0">'+ini+'</div>'
                +'<span class="font-medium text-slate-700">'+u.nombre+'</span></div></td>'
                +'<td class="px-4 py-3 text-slate-500 text-xs">'+u.email+'</td>'
                +'<td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold '+(u.rol==='Administrador'?'bg-violet-100 text-violet-700':'bg-blue-100 text-blue-700')+'">'+u.rol+'</span></td>'
                +'<td class="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">'+emps+'</td>'
                +'<td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold '+badge+'">'+u.estatus+'</span></td>'
                +'<td class="px-4 py-3"><div class="flex justify-center gap-2">'
                +'<button data-action="editar" data-email="'+u.email+'" class="usr-btn w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition" title="Editar"><i class="fas fa-pen text-xs pointer-events-none"></i></button>'
                +'<button data-action="reset" data-email="'+u.email+'" class="usr-btn w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-600 transition" title="Resetear contraseña"><i class="fas fa-key text-xs pointer-events-none"></i></button>'
                +'<button data-action="toggle" data-email="'+u.email+'" data-estatus="'+u.estatus+'" class="usr-btn w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 '+(activo?'hover:bg-red-100 hover:text-red-600':'hover:bg-emerald-100 hover:text-emerald-600')+' text-slate-500 transition" title="'+(activo?'Desactivar':'Activar')+'">'
                +'<i class="fas fa-'+(activo?'ban':'check-circle')+' text-xs pointer-events-none"></i></button>'
                +'</div></td></tr>';
        }).join('')
        +'</tbody></table></div>';
    setTimeout(function(){
        const wrap=document.getElementById('tabla-usr-wrap');
        if(wrap) wrap.addEventListener('click',function(e){
            const btn=e.target.closest('.usr-btn'); if(!btn) return;
            const a=btn.dataset.action, em=btn.dataset.email, es=btn.dataset.estatus;
            if(a==='editar')  editarUsuario(em);
            if(a==='reset')   resetPassword(em);
            if(a==='toggle')  toggleUsuario(em,es);
        });
    },100);;
}

function renderizarPerfilAuxiliar(){
    const body=document.getElementById('perfil-auxiliar-body');
    if(!body||!sesionActual) return;
    const u=sesionActual.usuario;
    body.innerHTML='<div class="max-w-md mx-auto space-y-5">'
        +'<div class="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">'
        +'<div class="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-2xl overflow-hidden" id="perfil-avatar">'
        +(u.urlFoto?'<img src="'+u.urlFoto+'" class="w-full h-full object-cover">':((u.nombre||'U')[0].toUpperCase()))
        +'</div><div>'
        +'<p class="font-bold text-slate-800">'+u.nombre+'</p>'
        +'<p class="text-xs text-slate-400">'+u.rol+' · '+u.email+'</p>'
        +'<label class="text-xs text-violet-600 hover:text-violet-800 cursor-pointer font-semibold mt-1 inline-block">'
        +'<i class="fas fa-camera mr-1"></i>Cambiar foto'
        +'<input type="file" accept=".jpg,.jpeg,.png" class="hidden" onchange="subirFotoUsuario(this)"></label>'
        +'</div></div>'
        +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Nombre completo</label>'
        +'<input type="text" id="perfil-nombre" value="'+u.nombre+'" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500"></div>'
        +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Teléfono</label>'
        +'<input type="tel" id="perfil-telefono" value="'+(u.telefono||'')+'" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500"></div>'
        +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Correo electrónico</label>'
        +'<input type="email" value="'+u.email+'" disabled class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"></div>'
        +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Empresas asignadas</label>'
        +'<p class="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">'+((u.empresas&&u.empresas.length)?u.empresas.join(', '):'Todas las empresas')+'</p></div>'
        +'<div class="pt-2 border-t border-slate-100">'
        +'<p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Cambiar contraseña</p>'
        +'<div class="space-y-3">'
        +'<input type="password" id="perfil-pass-actual" placeholder="Contraseña actual" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500">'
        +'<input type="password" id="perfil-pass-nuevo" placeholder="Nueva contraseña (mín. 8 caracteres)" class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500">'
        +'<button onclick="cambiarPasswordPerfil()" class="text-xs font-semibold text-violet-600 hover:text-violet-800 transition">Actualizar contraseña →</button>'
        +'</div></div>'
        +'<button onclick="guardarPerfilAuxiliar()" class="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition shadow-sm">'
        +'<i class="fas fa-save mr-2"></i>Guardar cambios</button></div>';
}

async function guardarPerfilAuxiliar(){
    if(!sesionActual) return;
    const r=await enviarPeticion('actualizar_usuario',{token:getToken(),email:sesionActual.usuario.email,nombre:document.getElementById('perfil-nombre')?.value||'',telefono:document.getElementById('perfil-telefono')?.value||''});
    if(r.status==='success'){sesionActual.usuario.nombre=document.getElementById('perfil-nombre')?.value||'';mostrarToast('success','Perfil actualizado','Datos guardados correctamente.');}
    else mostrarToast('error','Error',r.message);
}

async function cambiarPasswordPerfil(){
    const actual=document.getElementById('perfil-pass-actual')?.value||'';
    const nuevo=document.getElementById('perfil-pass-nuevo')?.value||'';
    if(!actual||!nuevo){mostrarToast('warning','Campos vacíos','Ingresa tu contraseña actual y la nueva.');return;}
    const r=await enviarPeticion('cambiar_password',{token:getToken(),passActual:actual,passNuevo:nuevo});
    if(r.status==='success'){mostrarToast('success','Contraseña actualizada','Tu contraseña fue cambiada.');document.getElementById('perfil-pass-actual').value='';document.getElementById('perfil-pass-nuevo').value='';}
    else mostrarToast('error','Error',r.message);
}

function abrirModalNuevoUsuario(){
    Swal.fire({
        title:'Nuevo Usuario RRHH',
        html:'<div class="text-left" style="display:grid;gap:8px;">'
            +'<div style="position:relative;">'
            +'<input id="swal-nombre" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;" placeholder="Nombre completo del usuario">'
            +'<button type="button" id="btn-buscar-idint" onclick="buscarIDInternoAuto()" '
            +'style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:4px 10px;font-size:.72rem;cursor:pointer;white-space:nowrap;">'
            +'<i class="fas fa-search"></i> Buscar empleado</button>'
            +'</div>'
            // Resultado de búsqueda
            +'<div id="idint-resultado" style="display:none;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:8px 12px;font-size:.8rem;color:#166534;"></div>'
            // Campo ID INTERNO (oculto/readonly después de buscar)
            +'<input id="swal-idint" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;" placeholder="ID INTERNO (se llena automático o escribe el ID)">'
            +'<input id="swal-email" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;" type="email" placeholder="correo@gmnet.mx">'
            +'<input id="swal-pass" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;" type="password" placeholder="Contraseña inicial">'
            +'<input id="swal-tel" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;" placeholder="Teléfono">'
            +'<select id="swal-rol" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;">'
            +'<option value="Auxiliar">Auxiliar</option>'
            +'<option value="Administrador">Administrador</option>'
            +'</select>'
            +'<div style="margin:4px 0;">'
            +'<label style="font-size:.78rem;font-weight:700;color:#475569;display:block;margin-bottom:6px;">Empresas con acceso <span style="font-weight:400;color:#94a3b8">(vacío = todas)</span></label>'
            +'<div id="swal-empresas-list" style="max-height:140px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f8fafc;">'
            +(window._catalogoEmpresas||empresas||[]).map(function(e){
                const nom=typeof e==='object'?e.nombre:e;
                return '<label style="display:flex;align-items:center;gap:6px;font-size:.75rem;cursor:pointer;padding:2px 0;">'
                    +'<input type="checkbox" class="swal-emp-check" value="'+nom+'" style="accent-color:#7c3aed;width:14px;height:14px;"> '+nom+'</label>';
            }).join('')
            +'</div></div>'
            +'<input id="swal-empresas" type="hidden" value="">'
            +'</div>',
        confirmButtonText:'Crear usuario',
        confirmButtonColor:'#7c3aed',
        showCancelButton:true,
        cancelButtonText:'Cancelar',
        preConfirm: async function(){
            const nombre   = document.getElementById('swal-nombre').value.trim();
            const email    = document.getElementById('swal-email').value.trim();
            const password = document.getElementById('swal-pass').value.trim();
            const idInterno= document.getElementById('swal-idint').value.trim();
            if(!nombre||!email||!password){
                Swal.showValidationMessage('Nombre, email y contraseña son requeridos.');
                return false;
            }
            // Leer empresas seleccionadas del checklist
            const _checks = document.querySelectorAll('.swal-emp-check:checked');
            const _empSel = Array.from(_checks).map(function(c){return c.value;}).join(',');
            const r = await enviarPeticion('crear_usuario',{
                token:getToken(), nombre, email, password,
                telefono:   document.getElementById('swal-tel').value.trim(),
                rol:        document.getElementById('swal-rol').value,
                empresas:   _empSel,
                idInterno:  idInterno
            });
            if(r.status!=='success') Swal.showValidationMessage(r.message);
            return r;
        }
    }).then(function(res){
        if(res.isConfirmed){
            mostrarToast('success','Usuario creado','Acceso creado y email de bienvenida enviado.');
            cargarTablaUsuarios();
        }
    });
}

// ── Buscar ID INTERNO automáticamente por nombre ──────────────
async function buscarIDInternoAuto() {
    const nombre = (document.getElementById('swal-nombre')?.value||'').trim();
    if(nombre.length < 3){
        mostrarToast('warning','Nombre muy corto','Escribe al menos 3 caracteres del nombre.');
        return;
    }
    const btn = document.getElementById('btn-buscar-idint');
    if(btn){ btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; btn.disabled=true; }

    try {
        const r = await enviarPeticion('buscar_usuario_por_nombre',{ nombre });
        if(r.status==='success' && r.candidatos && r.candidatos.length){
            const mejor = r.candidatos[0];
            // Autocompletar ID
            const idField = document.getElementById('swal-idint');
            if(idField) idField.value = mejor.idInterno;
            // Mostrar resultado
            const res = document.getElementById('idint-resultado');
            if(res){
                res.style.display='block';
                if(r.candidatos.length === 1){
                    res.innerHTML = '<i class="fas fa-check-circle mr-1"></i>'
                        +'<strong>'+mejor.nombre+'</strong> — '+mejor.empresa
                        +' <span style="opacity:.7;">('+mejor.idInterno+')</span>';
                } else {
                    // Mostrar selector si hay varios candidatos
                    res.style.background='#fefce8'; res.style.borderColor='#fde68a'; res.style.color='#92400e';
                    res.innerHTML = '<p style="margin:0 0 6px;font-weight:700;">Varios resultados — selecciona:</p>'
                        + r.candidatos.slice(0,5).map(function(c){
                            return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;">'
                                +'<input type="radio" name="cand-idint" value="'+c.idInterno+'" '
                                +'<input type="radio" name="cand-idint" value="'+c.idInterno+'" class="cand-radio">'
                                +'<span>'+c.nombre+' — '+c.empresa+' <strong>('+c.idInterno+')</strong></span>'
                                +'</label>';
                        }).join('');
                }
            }
        } else {
            const res = document.getElementById('idint-resultado');
            if(res){
                res.style.display='block';
                res.style.background='#fef2f2'; res.style.borderColor='#fecaca'; res.style.color='#b91c1c';
                res.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>'
                    +'No se encontró empleado con ese nombre. Puedes escribir el ID manualmente.';
            }
        }
    } catch(e) {
        console.error('buscarIDInternoAuto:', e);
    }

    // Event delegation para radio buttons de candidatos
    setTimeout(function(){
        var res2=document.getElementById('idint-resultado');
        if(res2) res2.addEventListener('change',function(e){
            if(e.target.classList.contains('cand-radio')){
                var idField=document.getElementById('swal-idint');
                if(idField) idField.value=e.target.value;
            }
        });
    },100);
    if(btn){ btn.innerHTML='<i class="fas fa-search"></i> Buscar empleado'; btn.disabled=false; }
}

async function resetPassword(email){
    const res=await Swal.fire({title:'¿Resetear contraseña?',html:'Se reseteará la contraseña de <strong>'+email+'</strong> a <code>Prisma2025*</code>',icon:'warning',confirmButtonText:'Sí, resetear',confirmButtonColor:'#d97706',showCancelButton:true,cancelButtonText:'Cancelar'});
    if(!res.isConfirmed) return;
    const r=await enviarPeticion('resetear_password',{token:getToken(),email});
    mostrarToast(r.status==='success'?'success':'error',r.status==='success'?'Contraseña reseteada':'Error',r.message);
}

async function toggleUsuario(email,estatusActual){
    const nuevoEstatus=estatusActual==='Activo'?'Inactivo':'Activo';
    const r=await enviarPeticion('actualizar_usuario',{token:getToken(),email,estatus:nuevoEstatus});
    if(r.status==='success'){mostrarToast('success',nuevoEstatus==='Activo'?'Usuario activado':'Usuario desactivado',email);cargarTablaUsuarios();}
    else mostrarToast('error','Error',r.message);
}

async function editarUsuario(email){
    const r=await enviarPeticion('listar_usuarios',{token:getToken()});
    if(r.status!=='success') return;
    const u=(r.usuarios||[]).find(function(x){return x.email===email;});
    if(!u) return;
    const _empActuales = u.empresas || [];
    const _listaEmps = empresas || [];
    Swal.fire({
        title:'Editar: '+u.nombre,
        html:'<div class="text-left space-y-3">'
            +'<input id="swal-e-nombre" class="swal2-input" value="'+(u.nombre||'')+'" placeholder="Nombre completo">'
            +'<input id="swal-e-tel" class="swal2-input" value="'+(u.telefono||'')+'" placeholder="Teléfono">'
            +'<select id="swal-e-rol" class="swal2-input"><option value="Auxiliar"'+(u.rol==='Auxiliar'?' selected':'')+'>Auxiliar</option><option value="Administrador"'+(u.rol==='Administrador'?' selected':'')+'>Administrador</option></select>'
            +'<div style="margin:4px 0;">'
            +'<label style="font-size:.78rem;font-weight:700;color:#475569;display:block;margin-bottom:6px;">Empresas con acceso <span style="font-weight:400;color:#94a3b8">(vacío = todas)</span></label>'
            +'<div id="swal-e-empresas-list" style="max-height:140px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f8fafc;">'
            +_listaEmps.map(function(nom){
                const checked = _empActuales.some(function(e){ return e.trim().toLowerCase()===nom.trim().toLowerCase(); });
                return '<label style="display:flex;align-items:center;gap:6px;font-size:.75rem;cursor:pointer;padding:2px 0;">'
                    +'<input type="checkbox" class="swal-e-emp-check" value="'+nom+'"'+(checked?' checked':'')+' style="accent-color:#7c3aed;width:14px;height:14px;"> '+nom+'</label>';
            }).join('')
            +'</div></div>'
            +'<input id="swal-e-idint" class="swal2-input" value="'+(u.idInterno||'')+'" placeholder="ID INTERNO del empleado (ej. NM5) — para evaluaciones">'
            +'</div>',
        confirmButtonText:'Guardar',confirmButtonColor:'#7c3aed',showCancelButton:true,cancelButtonText:'Cancelar',
        preConfirm:async function(){
            const _empChecked = Array.from(document.querySelectorAll('.swal-e-emp-check:checked')).map(function(c){return c.value;}).join(',');
            const r2=await enviarPeticion('actualizar_usuario',{
                token:getToken(), email,
                nombre:     document.getElementById('swal-e-nombre').value,
                telefono:   document.getElementById('swal-e-tel').value,
                rol:        document.getElementById('swal-e-rol').value,
                empresas:   _empChecked,
                idInterno:  document.getElementById('swal-e-idint').value.trim()
            });
            if(r2.status!=='success') Swal.showValidationMessage(r2.message);
            return r2;
        }
    }).then(function(res){if(res.isConfirmed){mostrarToast('success','Usuario actualizado','Datos guardados.');cargarTablaUsuarios();}});
}


// ─── API GAS ──────────────────────────────────────────────────
async function enviarPeticion(action,payload,timeoutMs){
    if(action !== 'login' && action !== 'validar_token' && sesionActual && sesionActual.token) {
        payload = Object.assign({}, payload, { token: sesionActual.token });
    }
    // Timeout configurable (default 25s). Peticiones pesadas como
    // "exportar_datos" (lee toda la hoja dos veces) pueden necesitar más
    // tiempo, sobre todo con GAS "frío" — antes el límite fijo de 25s
    // las abortaba de forma intermitente sin avisar al usuario.
    const timeout = timeoutMs || 25000;
    const controller = new AbortController();
    const timeoutId  = setTimeout(function(){ controller.abort(); }, timeout);
    try {
        const res = await fetch(API_URL, {
            method:  'POST',
            body:    JSON.stringify({action, payload}),
            signal:  controller.signal
        });
        clearTimeout(timeoutId);
        return await res.json();
    } catch(e) {
        clearTimeout(timeoutId);
        if(e.name === 'AbortError') throw new Error('Tiempo de espera agotado. Verifica tu conexión.');
        throw e;
    }
}

// ─── DRAWER EDICIÓN DE EMPLEADO ───────────────────────────────
let empleadoEdicion=null;

function abrirEditor(idInterno, empresaHint){
    // Buscar por ID INTERNO primero (único global)
    let emp = cacheGlobal.find(e => {
        const id = (e["ID INTERNO"]||"").toString().trim();
        return id !== "" && id === idInterno.toString().trim();
    });
    // Fallback: No.Emp + Empresa (cuando aún no hay ID asignado)
    if(!emp && empresaHint) {
        emp = cacheGlobal.find(e =>
            (e["NO. EMPLEADO"]||"").toString() === idInterno.toString() &&
            (e["EMPRESA"]||"").trim() === empresaHint.trim()
        );
    }
    if(!emp){ mostrarToast('error','No encontrado','No se encontró el registro #'+idInterno); return; }
    empleadoEdicion = emp;
    window.empleadoEdicion = emp;
    const drawer = document.getElementById('drawer-editor');
    const inner  = document.getElementById('drawer-inner');
    renderizarDrawer(emp);
    // Mostrar modal con animación
    document.getElementById('drawer-overlay').classList.remove('hidden');
    drawer.classList.remove('hidden');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
        inner.classList.remove('opacity-0','scale-95');
        inner.classList.add('opacity-100','scale-100');
    }));
}


// ── Activar/reenviar acceso portal desde el drawer ─────────────
async function activarPortalEmpleado() {
    if(!empleadoEdicion) return;
    const idInt  = (empleadoEdicion["ID INTERNO"]||"").toString().trim();
    const correo = (empleadoEdicion["CORREO ACCESO"]||"").toString().trim();
    if(!correo){ mostrarToast("warning","Sin correo","Agrega el Correo Acceso corporativo primero."); return; }

    const conf = await Swal.fire({
        title:"¿Activar acceso al portal?",
        html:"Se enviará un email de bienvenida a <strong>"+correo+"</strong> con las credenciales de acceso.",
        icon:"question",
        showCancelButton:true,
        confirmButtonText:"Sí, activar",
        confirmButtonColor:"#1d4ed8",
        cancelButtonText:"Cancelar"
    });
    if(!conf.isConfirmed) return;

    const r = await enviarPeticion("reenviar_acceso_emp",{ token:getToken(), idInterno:idInt });
    if(r.status==="success"){
        mostrarToast("success","Portal activado",r.message,5000);
    } else {
        mostrarToast("error","Error",r.message);
    }
}
function cerrarEditor(){
    const drawer = document.getElementById('drawer-editor');
    const inner  = document.getElementById('drawer-inner');
    inner.classList.remove('opacity-100','scale-100');
    inner.classList.add('opacity-0','scale-95');
    document.getElementById('drawer-overlay').classList.add('hidden');
    setTimeout(()=>{ drawer.classList.add('hidden'); }, 200);
    empleadoEdicion=null;
    // Limpiar la vista previa de archivos para la próxima apertura
    // (evita ver un momento el expediente anterior mientras carga el nuevo)
    const archivosEl = document.getElementById('tab-documentos-archivos');
    if(archivosEl) archivosEl.innerHTML='';
}

// Helper: formatea fechas construidas con Date.UTC sin desfase de timezone
function fmtUTC(d, opts){
    if(!d||isNaN(d))return'—';
    return d.toLocaleDateString('es-MX', Object.assign({timeZone:'UTC'}, opts||{day:'2-digit',month:'2-digit',year:'numeric'}));
}
function fmtFechaDisplay(val){
    const d=parseFechaFlexible(val);if(!d)return'—';
    return fmtUTC(d,{day:'2-digit',month:'short',year:'numeric'});
}

function diasRestantes(val){
    const d=parseFechaFlexible(val);if(!d)return null;
    return Math.round((d-new Date())/86400000);
}

function badgeContrato(val){
    const dias=diasRestantes(val);if(dias===null)return'';
    if(dias<0)return`<span class="ml-2 text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Vencido hace ${Math.abs(dias)}d</span>`;
    if(dias<=30)return`<span class="ml-2 text-xs font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Vence en ${dias}d</span>`;
    return`<span class="ml-2 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Vigente ${dias}d</span>`;
}



// ─── CREAR EXPEDIENTE EN DRIVE DESDE EL DRAWER ───────────────
async function crearExpedienteEnDrive() {
    if (!empleadoEdicion) return;
    const idInterno = (empleadoEdicion["ID INTERNO"] || "").toString();
    const id  = (empleadoEdicion["NO. EMPLEADO"] || "").toString();
    const nom = empleadoEdicion["NOMBRE DEL TRABAJADOR"] || "Sin Nombre";
    const emp = empleadoEdicion["EMPRESA"] || "";

    const btn = document.querySelector('[onclick="crearExpedienteEnDrive()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando carpeta...';
    }

    try {
        // BUGFIX 07 jul 2026: ahora se manda idInterno (identificador único
        // real) además del combo NO. EMPLEADO + EMPRESA — el backend ya
        // busca por ID INTERNO primero, que es más confiable para
        // reingresos o altas sin NO. EMPLEADO. Timeout extendido a 45s,
        // mismo criterio que subir_documento (puede implicar crear
        // carpeta de empresa + subcarpeta si es la primera del grupo).
        const r = await enviarPeticion('crear_expediente', {
            idInterno:       idInterno,
            numeroEmpleado:  id,
            nombreTrabajador: nom,
            empresa:         emp
        }, 45000);

        if (r.status === 'success') {
            // Actualizar el cache local con la URL nueva — ID INTERNO primero
            const empCache = cacheGlobal.find(e => (e["ID INTERNO"] || "").toString() === idInterno && idInterno)
                || cacheGlobal.find(e =>
                    (e["NO. EMPLEADO"] || "").toString() === id &&
                    (e["EMPRESA"] || "").trim() === emp.trim()
                );
            if (empCache) empCache["URL EXPEDIENTE"] = r.url;
            if (empleadoEdicion) empleadoEdicion["URL EXPEDIENTE"] = r.url;

            mostrarToast('success', 'Expediente creado',
                'Carpeta creada en Drive para ' + nom + '.', 6000);

            // Re-renderizar el drawer para mostrar el link
            renderizarDrawer(empleadoEdicion);
        } else {
            mostrarToast('error', 'Error al crear expediente', r.message || 'Intenta de nuevo.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-folder-plus"></i> Crear carpeta de expediente';
            }
        }
    } catch(e) {
        console.error('crearExpedienteEnDrive:', e);
        mostrarToast('error', 'Error', 'No se pudo crear la carpeta. Verifica la conexión.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-folder-plus"></i> Crear carpeta de expediente';
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO DE ENCUESTAS — RRHH Prisma
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  DASHBOARD CLIMA ORGANIZACIONAL
// ══════════════════════════════════════════════════════════════

// Definición de dimensiones de Clima con sus preguntas
const CLIMA_DIMENSIONES = [
    { nombre:'Estilo de Liderazgo',    icono:'👔', color:'#7c3aed', pregs:[1,2,3,4,5,6,7,8,9]    },
    { nombre:'Nivel de Satisfacción',  icono:'😊', color:'#2563eb', pregs:[10,11,12,13,14,15,16,17] },
    { nombre:'SHE',                    icono:'🦺', color:'#d97706', pregs:[18,19,20,21,22,23]       },
    { nombre:'Dignidad y Respeto',     icono:'🤝', color:'#059669', pregs:[24,25,26,27,28]          },
    { nombre:'Sentido de Pertenencia', icono:'❤️', color:'#e11d48', pregs:[29,30,31,32,33]          },
    { nombre:'Trabajo en Equipo',      icono:'👥', color:'#0891b2', pregs:[34,35,36,37]             },
    { nombre:'Cultura Organizacional', icono:'🏢', color:'#7c3aed', pregs:[38,39,40,41,42,43]       },
    { nombre:'Bienestar y Equilibrio', icono:'🌿', color:'#16a34a', pregs:[44,45,46,47]             },
];

function renderizarDashboardClima(respuestas, container, link) {
    const total = respuestas.length;

    // ── Mapa {qn: texto} desde encuestaData cacheada ─────────
    var textoPregs = {};
    (function(){
        var qq = 0;
        var bloqs = (window._climaEncData && window._climaEncData.bloques) || [];
        bloqs.forEach(function(b){
            (b.preguntas||[]).forEach(function(p){ qq++; textoPregs[qq] = p.texto; });
        });
    })();

    // ── Calcular promedios por pregunta ──────────────────────
    const sumQ={}, cntQ={};
    respuestas.forEach(function(resp){
        Object.entries(resp.respuestas||{}).forEach(function([k,v]){
            const n=parseInt(v);
            if(!isNaN(n)&&n>=1&&n<=5){ sumQ[k]=(sumQ[k]||0)+n; cntQ[k]=(cntQ[k]||0)+1; }
        });
    });

    // Promedio por pregunta
    const promQ={};
    Object.keys(sumQ).forEach(function(k){ promQ[k]=sumQ[k]/(cntQ[k]||1); });

    // ── Calcular stats por dimensión ─────────────────────────
    const statsDim = CLIMA_DIMENSIONES.map(function(dim){
        var s=0, c=0, fav=0, cFav=0;
        dim.pregs.forEach(function(qn){
            const k='q'+qn;
            if(promQ[k]!==undefined){ s+=promQ[k]; c++; }
            // % favorable = respuestas 4 o 5
            respuestas.forEach(function(r){
                const v=parseInt((r.respuestas||{})[k]);
                if(!isNaN(v)){ cFav++; if(v>=4) fav++; }
            });
        });
        const prom = c>0 ? s/c : 0;
        const pctFav = cFav>0 ? Math.round(fav/cFav*100) : 0;
        return { nombre:dim.nombre, icono:dim.icono, color:dim.color,
                 prom:prom, pctFav:pctFav, numPregs:dim.pregs.length,
                 pregsIdx:dim.pregs };
    });

    // Promedio general
    const promGeneral = statsDim.length>0 ? statsDim.reduce(function(s,d){return s+d.prom;},0)/statsDim.length : 0;
    const pctFavGeneral = statsDim.length>0 ? Math.round(statsDim.reduce(function(s,d){return s+d.pctFav;},0)/statsDim.length) : 0;

    // ── Colores semáforo ─────────────────────────────────────
    function colorProm(p){
        return p>=4?'#10b981':p>=3?'#f59e0b':'#ef4444';
    }
    function colorFav(p){
        return p>=75?'#10b981':p>=60?'#f59e0b':'#ef4444';
    }
    function bgColorFav(p){
        return p>=75?'rgba(16,185,129,.1)':p>=60?'rgba(245,158,11,.1)':'rgba(239,68,68,.1)';
    }
    function etiquetaProm(p){
        return p>=4.5?'Excelente':p>=4?'Muy bueno':p>=3?'Regular':'Por mejorar';
    }

    container.innerHTML =

    // ── Toolbar ──────────────────────────────────────────────
    '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">'
    +'<div><h3 class="text-base font-bold text-slate-800 flex items-center gap-2">'
    +'<i class="fas fa-cloud-sun text-blue-600"></i>Encuesta de Clima Organizacional</h3>'
    +'<p class="text-xs text-slate-400 mt-0.5">'+total+' respuesta'+(total!==1?'s':'')+' · 47 preguntas · 8 dimensiones</p>'
    +'</div>'
    +'<div class="flex flex-wrap gap-2">'
    +'<button onclick="abrirEditorEncuesta(this.dataset.enc)" data-enc="CLIMA" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-pen-to-square"></i> Editar</button>'
    +'<button onclick="copiarLinkEncuesta(this.dataset.link)" data-link="'+link+'" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-link"></i> Copiar link</button>'
    +'<a href="'+link+'" target="_blank" class="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-external-link-alt"></i> Ver encuesta</a>'
    +'<button onclick="descargarRespuestasExcel(\'CLIMA\')" class="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-file-excel"></i> Excel</button>'
    +'</div></div>'

    + (total===0
    // ── Estado vacío ──────────────────────────────────────────
    ? '<div class="text-center py-16"><div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">'
      +'<i class="fas fa-cloud-sun text-slate-300 text-3xl"></i></div>'
      +'<p class="text-slate-500 font-semibold mb-1">Sin respuestas aún</p>'
      +'<p class="text-xs text-slate-400">Comparte el link de la encuesta con los empleados.</p></div>'

    // ── KPIs generales ────────────────────────────────────────
    : '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">'
    +'<div class="rounded-xl p-4 border bg-white border-slate-100 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Respuestas</p>'
      +'<p class="text-3xl font-black text-slate-800 mt-1">'+total+'</p></div>'
    +'<div class="rounded-xl p-4 border bg-white shadow-sm text-center" style="border-color:'+colorProm(promGeneral)+'20">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Promedio Gral.</p>'
      +'<p class="text-3xl font-black mt-1" style="color:'+colorProm(promGeneral)+'">'+promGeneral.toFixed(2)+'<span class="text-sm font-normal text-slate-400"> /5</span></p>'
      +'<p class="text-xs font-semibold mt-0.5" style="color:'+colorProm(promGeneral)+'">'+etiquetaProm(promGeneral)+'</p></div>'
    +'<div class="rounded-xl p-4 border bg-white shadow-sm text-center" style="border-color:'+colorFav(pctFavGeneral)+'20">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">% Favorable</p>'
      +'<p class="text-3xl font-black mt-1" style="color:'+colorFav(pctFavGeneral)+'">'+pctFavGeneral+'%</p>'
      +'<p class="text-xs text-slate-400 mt-0.5">Resp. 4 o 5</p></div>'
    +'<div class="rounded-xl p-4 border bg-white border-slate-100 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Dimensiones</p>'
      +'<p class="text-3xl font-black text-slate-800 mt-1">8</p></div>'
    +'</div>'

    // ── Gráficas por dimensión (barras horizontales) ──────────
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">'
    +'<p class="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">'
    +'<i class="fas fa-chart-bar text-blue-500"></i> Resultados por Dimensión</p>'
    +'<div class="space-y-4">'
    +statsDim.map(function(d){
        const wProm=Math.round(d.prom/5*100);
        const wFav=d.pctFav;
        return '<div>'
          +'<div class="flex items-center justify-between mb-1.5">'
          +'<span class="text-sm font-semibold text-slate-700 flex items-center gap-1.5">'
          +d.icono+' '+d.nombre+'</span>'
          +'<div class="flex items-center gap-3 flex-shrink-0">'
          +'<span class="text-xs text-slate-400">Prom: <strong style="color:'+colorProm(d.prom)+'">'+d.prom.toFixed(1)+'</strong></span>'
          +'<span class="text-xs text-slate-400">Fav: <strong style="color:'+colorFav(d.pctFav)+'">'+d.pctFav+'%</strong></span>'
          +'</div></div>'
          // Barra de promedio
          +'<div class="flex items-center gap-2 mb-1">'
          +'<span class="text-xs text-slate-400 w-12 flex-shrink-0">Prom.</span>'
          +'<div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">'
          +'<div class="h-full rounded-full transition-all duration-700" style="width:'+wProm+'%;background:'+d.color+';"></div>'
          +'</div>'
          +'<span class="text-xs font-bold w-8 text-right" style="color:'+colorProm(d.prom)+'">'+d.prom.toFixed(1)+'</span>'
          +'</div>'
          // Barra de % favorable
          +'<div class="flex items-center gap-2">'
          +'<span class="text-xs text-slate-400 w-12 flex-shrink-0">% Fav.</span>'
          +'<div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">'
          +'<div class="h-full rounded-full transition-all duration-700" style="width:'+wFav+'%;background:'+colorFav(d.pctFav)+';opacity:.8;"></div>'
          +'</div>'
          +'<span class="text-xs font-bold w-8 text-right" style="color:'+colorFav(d.pctFav)+'">'+d.pctFav+'%</span>'
          +'</div>'
          +'</div>';
    }).join('')
    +'</div></div>'

    // ── Tabla detallada por pregunta ──────────────────────────
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">'
    +'<div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">'
    +'<p class="text-sm font-bold text-slate-700"><i class="fas fa-table text-slate-400 mr-2"></i>Tabla de Calificaciones por Pregunta</p>'
    +'<span class="text-xs text-slate-400">Promedio · % Favorable · % Bloque</span>'
    +'</div>'
    +'<div class="overflow-x-auto">'
    +'<table class="w-full text-xs">'
    +'<thead class="bg-slate-50 border-b border-slate-100">'
    +'<tr>'
    +'<th class="px-3 py-2.5 text-left text-slate-400 uppercase tracking-wide font-bold w-8">#</th>'
    +'<th class="px-3 py-2.5 text-left text-slate-400 uppercase tracking-wide font-bold">Pregunta</th>'
    +'<th class="px-3 py-2.5 text-center text-slate-400 uppercase tracking-wide font-bold w-20">Prom.</th>'
    +'<th class="px-3 py-2.5 text-center text-slate-400 uppercase tracking-wide font-bold w-20">% Fav.</th>'
    +'<th class="px-3 py-2.5 text-center text-slate-400 uppercase tracking-wide font-bold w-20">% Dim.</th>'
    +'</tr></thead>'
    +'<tbody>'
    +(function(){
        var rows='';
        var qGlobal=0;
        CLIMA_DIMENSIONES.forEach(function(dim){
            // Header de dimensión
            rows+='<tr style="background:'+dim.color+'12;">'
              +'<td colspan="5" class="px-3 py-2 font-bold text-xs" style="color:'+dim.color+';">'
              +dim.icono+' '+dim.nombre+'</td></tr>';
            // Calcular promedio de la dimensión para el % bloque
            var sD=0, cD=0;
            dim.pregs.forEach(function(qn){
                const k='q'+qn;
                if(promQ[k]!==undefined){sD+=promQ[k];cD++;}
            });
            var promDim=cD>0?sD/cD:0;
            // Preguntas de la dimensión
            dim.pregs.forEach(function(qn){
                qGlobal++;
                const k='q'+qn;
                const prom=promQ[k]||0;
                const promStr=cntQ[k]>0?prom.toFixed(2):'—';
                // % favorable de esta pregunta
                var favQ=0, totQ=0;
                respuestas.forEach(function(r){
                    const v=parseInt((r.respuestas||{})[k]);
                    if(!isNaN(v)){totQ++;if(v>=4)favQ++;}
                });
                const pctFavQ=totQ>0?Math.round(favQ/totQ*100):0;
                const pctFavQStr=totQ>0?pctFavQ+'%':'—';
                // % del bloque = prom de esta preg / prom del bloque
                const pctBloque=promDim>0?Math.round(prom/promDim*100):0;
                const pctBloqueStr=promDim>0&&cntQ[k]>0?pctBloque+'%':'—';
                const cProm=colorProm(prom);
                const cFavQ=colorFav(pctFavQ);
                rows+='<tr class="border-b border-slate-50 hover:bg-slate-50">'
                  +'<td class="px-3 py-2 text-slate-400 font-mono text-center">'+qn+'</td>'
                  +'<td class="px-3 py-2 text-slate-700" style="max-width:320px;white-space:normal;line-height:1.3;">'
                  +(cntQ[k]>0?'':'<span style="color:#94a3b8;font-style:italic;">Sin respuestas</span>'||'')
                  +(textoPregs[qn]||('Pregunta '+qn))+'</td>'
                  +'<td class="px-3 py-2 text-center font-bold" style="color:'+cProm+'">'+promStr+'</td>'
                  +'<td class="px-3 py-2 text-center font-bold" style="color:'+cFavQ+'">'+pctFavQStr+'</td>'
                  +'<td class="px-3 py-2 text-center text-slate-500">'+pctBloqueStr+'</td>'
                  +'</tr>';
            });
        });
        return rows;
    })()
    +'</tbody></table>'
    +'</div></div>'

    // ── Respuestas recientes ──────────────────────────────────
    +(total>0
    ?'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">'
    +'<div class="px-5 py-3.5 border-b border-slate-100">'
    +'<p class="text-sm font-bold text-slate-700"><i class="fas fa-list-ul text-slate-400 mr-2"></i>Participantes recientes</p></div>'
    +'<div class="overflow-x-auto"><table class="w-full text-sm">'
    +'<thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">'
    +'<tr><th class="px-4 py-2.5 text-left">Empleado</th><th class="px-4 py-2.5 text-left">Empresa</th>'
    +'<th class="px-4 py-2.5 text-left">Fecha</th><th class="px-4 py-2.5 text-center">Pregs.</th></tr></thead>'
    +'<tbody class="divide-y divide-slate-50">'
    +respuestas.slice(0,8).map(function(r){
        const n=Object.keys(r.respuestas||{}).length;
        const f=r.fecha?new Date(r.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'2-digit'}):'—';
        const ini=((r.nombre||'?').trim()[0]||'?').toUpperCase();
        return '<tr class="hover:bg-slate-50">'
          +'<td class="px-4 py-2.5"><div class="flex items-center gap-2">'
          +'<div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">'+ini+'</div>'
          +'<span class="font-medium text-slate-700 text-xs">'+r.nombre+'</span></div></td>'
          +'<td class="px-4 py-2.5 text-xs text-slate-500">'+r.empresa+'</td>'
          +'<td class="px-4 py-2.5 text-xs text-slate-400">'+f+'</td>'
          +'<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">'+n+'</span></td>'
          +'</tr>';
    }).join('')
    +'</tbody></table></div></div>'
    :'')
    );
}


// ── Descargar respuestas de encuesta en Excel ─────────────────
async function descargarRespuestasExcel(encId) {
    const encTipo = ENC_TIPOS[encId] || { nombre: encId };
    mostrarToast('info', 'Preparando Excel...', 'Descargando respuestas de '+encTipo.nombre, 3000);

    // Obtener respuestas (del cache si están disponibles)
    let respuestas = _encCache[encId] || [];
    if(!respuestas.length){
        const r = await enviarPeticion('listar_respuestas', { token: getToken(), encId });
        if(r.status !== 'success'){ mostrarToast('error','Error',r.message); return; }
        respuestas = r.respuestas || [];
    }

    if(!respuestas.length){
        mostrarToast('warning','Sin datos','No hay respuestas para exportar.');
        return;
    }

    // Obtener estructura de preguntas
    let preguntas = [];
    try {
        const enc = await enviarPeticion('obtener_encuesta', { encId });
        if(enc.status === 'success' && enc.encuesta.bloques){
            let q = 0;
            enc.encuesta.bloques.forEach(function(b){
                (b.preguntas||[]).forEach(function(p){
                    q++;
                    preguntas.push({ num: q, texto: p.texto, bloque: b.titulo, tipo: p.tipo });
                });
            });
        }
    } catch(e){}

    // Construir headers del Excel
    // Col fijas: ID, Nombre, Empresa, Fecha
    const headersBase = ['ID Respuesta','Nombre Empleado','Empresa','Fecha'];
    // Col por pregunta: "Q1 - Texto de la pregunta"
    const maxQ = preguntas.length || 0;
    const headersPregQ = preguntas.map(function(p){
        return 'Q'+p.num+' ['+p.bloque+'] '+p.texto.substring(0,60)+(p.texto.length>60?'...':'');
    });
    // Si no hay preguntas, usar las claves de respuestas
    const todasClaves = new Set();
    if(!maxQ) respuestas.forEach(function(r){ Object.keys(r.respuestas||{}).forEach(function(k){ todasClaves.add(k); }); });

    const headers = headersBase.concat(
        maxQ > 0 ? headersPregQ : Array.from(todasClaves).sort()
    );

    // Construir filas
    const rows = [headers];
    respuestas.forEach(function(resp){
        const row = [
            resp.id || '',
            resp.nombre || '',
            resp.empresa || '',
            resp.fecha ? new Date(resp.fecha).toLocaleDateString('es-MX') : ''
        ];
        if(maxQ > 0){
            preguntas.forEach(function(p){
                const k = 'q'+p.num;
                const v = (resp.respuestas||{})[k];
                if(Array.isArray(v)) row.push(v.join(', '));
                else row.push(v !== undefined && v !== null ? v : '');
            });
        } else {
            Array.from(todasClaves).sort().forEach(function(k){
                const v = (resp.respuestas||{})[k];
                if(Array.isArray(v)) row.push(v.join(', '));
                else row.push(v !== undefined && v !== null ? v : '');
            });
        }
        rows.push(row);
    });

    // Generar Excel con SheetJS
    try {
        const XLSX = window.XLSX;
        if(!XLSX){ mostrarToast('error','Error','Biblioteca XLSX no disponible.'); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // Ancho de columnas
        ws['!cols'] = headers.map(function(h, i){
            return { wch: i < 4 ? 20 : Math.min(50, Math.max(12, h.length)) };
        });
        XLSX.utils.book_append_sheet(wb, ws, 'Respuestas');
        // Hoja de resumen
        if(preguntas.length){
            const resHeaders = ['#','Bloque','Pregunta','Promedio','% Favorable'];
            const resRows = [resHeaders];
            const sumQ={}, cntQ={}, favQ={}, totQ={};
            respuestas.forEach(function(r){
                Object.entries(r.respuestas||{}).forEach(function([k,v]){
                    const n=parseInt(v); if(!isNaN(n)&&n>=1&&n<=5){
                        sumQ[k]=(sumQ[k]||0)+n; cntQ[k]=(cntQ[k]||0)+1;
                    }
                    if(!isNaN(n)){ totQ[k]=(totQ[k]||0)+1; if(n>=4) favQ[k]=(favQ[k]||0)+1; }
                });
            });
            preguntas.forEach(function(p){
                const k='q'+p.num;
                const prom=cntQ[k]>0?(sumQ[k]/cntQ[k]).toFixed(2):'—';
                const fav=totQ[k]>0?Math.round(favQ[k]/totQ[k]*100)+'%':'—';
                resRows.push([p.num, p.bloque, p.texto, prom, fav]);
            });
            const wsRes = XLSX.utils.aoa_to_sheet(resRows);
            wsRes['!cols'] = [{wch:5},{wch:25},{wch:60},{wch:12},{wch:14}];
            XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
        }
        const fecha = new Date().toISOString().slice(0,10);
        XLSX.writeFile(wb, 'Encuesta_'+encId+'_Respuestas_('+fecha+').xlsx');
        mostrarToast('success','Excel descargado',respuestas.length+' respuestas exportadas.',4000);
    } catch(e){
        console.error('Error Excel:', e);
        mostrarToast('error','Error al generar Excel',e.message||'Intenta de nuevo.');
    }
}


// ══════════════════════════════════════════════════════════════
//  MÓDULO PERSONAS
// ══════════════════════════════════════════════════════════════
let _personasCache = null;
let _personasCacheTime = 0;

async function cargarModuloPersonas() {
    activarTabPersonas('directorio',
        document.querySelector('.per-tab[data-tab="directorio"]'));
}

function activarTabPersonas(tab, btnEl) {
    document.querySelectorAll('.per-tab').forEach(function(b){
        b.classList.remove('active','border-violet-600','text-violet-700','bg-violet-50');
        b.classList.add('border-transparent','text-slate-500');
    });
    if(btnEl){
        btnEl.classList.add('active','border-violet-600','text-violet-700','bg-violet-50');
        btnEl.classList.remove('border-transparent','text-slate-500');
    }
    const cont = document.getElementById('personas-contenido');
    if(!cont) return;

    // Segmentador de grupos comerciales
    // BUGFIX 07 jul 2026: antes leía los grupos directo de cacheGlobal
    // (valores crudos por empleado, que pueden quedar desactualizados si
    // la empresa cambió de grupo después de que ese empleado fue dado de
    // alta) — eso producía píldoras duplicadas/inconsistentes. Ahora usa
    // el catálogo EMPRESAS (listaGrupos()), que es la fuente de verdad.
    const grupos = listaGrupos();
    const grupoActual = window._personasGrupoFiltro || '';
    const segHtml = grupos.length > 1
        ? '<div class="flex items-center gap-2 flex-wrap mb-4 px-1 py-1">'
          +'<span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Grupo:</span>'
          +'<button onclick="filtrarPersonasPorGrupo(\'\',this)" class="px-3 py-1 rounded-full text-xs font-semibold transition '+(grupoActual===''?'bg-violet-600 text-white':'bg-slate-100 text-slate-600 hover:bg-violet-50')+'">Todos</button>'
          +grupos.map(function(g){
              return '<button onclick="filtrarPersonasPorGrupo(\''+g.replace(/'/g,"\\'")+'\',this)" class="px-3 py-1 rounded-full text-xs font-semibold transition '+(grupoActual===g?'bg-violet-600 text-white':'bg-slate-100 text-slate-600 hover:bg-violet-50')+'">'+g+'</button>';
          }).join('')+'</div>'
        : '';
    cont.innerHTML = segHtml + '<div id="personas-tab-contenido" class="tab-fade"><div class="flex justify-center py-16"><i class="fas fa-spinner fa-spin text-violet-400 text-2xl"></i></div></div>';
    window._personasTabActual = tab;
    const subcont = document.getElementById('personas-tab-contenido');
    if(tab==='directorio')    renderDirectorio(subcont);
    else if(tab==='organigrama') renderOrganigrama(subcont);
    else if(tab==='informes') renderInformesPersonas(subcont);
    else if(tab==='admin')    renderAdminPersonas(subcont);
}

function filtrarPersonasPorGrupo(grupo, btn) {
    window._personasGrupoFiltro = grupo;
    document.querySelectorAll('[onclick^="filtrarPersonasPorGrupo"]').forEach(function(b){
        b.className = b.className.replace('bg-violet-600 text-white','bg-slate-100 text-slate-600 hover:bg-violet-50');
    });
    if(btn) btn.className = btn.className.replace('bg-slate-100 text-slate-600 hover:bg-violet-50','bg-violet-600 text-white');
    const tab = window._personasTabActual || 'directorio';
    const subcont = document.getElementById('personas-tab-contenido');
    if(!subcont) return;
    subcont.innerHTML = '<div class="flex justify-center py-16"><i class="fas fa-spinner fa-spin text-violet-400 text-2xl"></i></div>';
    if(tab==='directorio')    renderDirectorio(subcont);
    else if(tab==='organigrama') renderOrganigrama(subcont);
    else if(tab==='informes') renderInformesPersonas(subcont);
    else if(tab==='admin')    renderAdminPersonas(subcont);
}

// ── Obtener datos (cache 5 min) ───────────────────────────────
async function getPersonasData() {
    const ahora = Date.now();
    if(_personasCache && (ahora - _personasCacheTime) < 5*60*1000) {
        console.log('[Personas] Usando cache:', _personasCache.length, 'empleados');
        return _personasCache;
    }
    try {
        console.log('[Personas] Solicitando directorio al GAS...');
        const r = await enviarPeticion('obtener_directorio', { token: getToken() });
        console.log('[Personas] Respuesta GAS:', r.status, 'total:', r.total, 'msg:', r.message||'');
        if(r.status === 'success') {
            _personasCache = r.empleados || [];
            _personasCacheTime = ahora;
            console.log('[Personas] Empleados cargados:', _personasCache.length);
        } else {
            console.error('[Personas] Error GAS:', r.message);
            // Fallback: usar cacheGlobal que ya está cargado
            if(cacheGlobal && cacheGlobal.length) {
                console.log('[Personas] Usando cacheGlobal como fallback:', cacheGlobal.length);
                _personasCache = cacheGlobal.map(function(e){
                    return {
                        idInterno:  (e['ID INTERNO']||'').toString().trim(),
                        noEmpleado: (e['NO. EMPLEADO']||'').toString().trim(),
                        nombre:     (e['NOMBRE DEL TRABAJADOR']||'').toString().trim(),
                        empresa:    (e['EMPRESA']||'').toString().trim(),
                        puesto:     (e['PUESTO']||'').toString().trim(),
                        depto:      (e['DEPARTAMENTO']||'').toString().trim(),
                        estatus:    (e['ESTATUS']||'').toString().trim(),
                        telefono:   (e['TELÉFONO PERSONAL']||'').toString().trim(),
                        email:      (e['CORREO ELECTRÓNICO']||'').toString().trim(),
                        jefe:       (e['JEFE DIRECTO']||'').toString().trim(),
                        correoAcce: (e['CORREO ACCESO']||'').toString().trim(),
                        urlExp:     (e['URL EXPEDIENTE']||'').toString().trim()
                    };
                });
                _personasCacheTime = ahora;
            }
        }
    } catch(e) {
        console.error('[Personas] Error fetch:', e);
        // Fallback a cacheGlobal
        if(cacheGlobal && cacheGlobal.length) {
            _personasCache = cacheGlobal.map(function(e){
                return {
                    idInterno:  (e['ID INTERNO']||'').toString().trim(),
                    noEmpleado: (e['NO. EMPLEADO']||'').toString().trim(),
                    nombre:     (e['NOMBRE DEL TRABAJADOR']||'').toString().trim(),
                    empresa:    (e['EMPRESA']||'').toString().trim(),
                    puesto:     (e['PUESTO']||'').toString().trim(),
                    depto:      (e['DEPARTAMENTO']||'').toString().trim(),
                    estatus:    (e['ESTATUS']||'').toString().trim(),
                    telefono:   (e['TELÉFONO PERSONAL']||'').toString().trim(),
                    email:      (e['CORREO ELECTRÓNICO']||'').toString().trim(),
                    jefe:       (e['JEFE DIRECTO']||'').toString().trim(),
                    correoAcce: (e['CORREO ACCESO']||'').toString().trim(),
                    urlExp:     (e['URL EXPEDIENTE']||'').toString().trim()
                };
            });
        }
    }
    return _personasCache || [];
}

// ── Iniciales para avatar ─────────────────────────────────────
function getIniciales(nombre) {
    const p = (nombre||'').trim().split(/\s+/).filter(Boolean);
    return ((p[0]||'')[0]||'') + ((p[1]||'')[0]||'');
}

// Colores de avatar por letra
const AVATAR_COLORS = [
    '#7c3aed','#2563eb','#059669','#d97706','#e11d48',
    '#0891b2','#7c3aed','#16a34a','#9333ea','#1d4ed8'
];
function avatarColor(nombre) {
    const c = (nombre||'A').charCodeAt(0);
    return AVATAR_COLORS[c % AVATAR_COLORS.length];
}

// ── DIRECTORIO ────────────────────────────────────────────────
async function renderDirectorio(cont) {
    const todos = await getPersonasData();
    // Filtrar por empresas permitidas
    let data = filtrarPorEmpresasPermitidas(todos);

    // BUGFIX 07 jul 2026: esta función nunca aplicaba la píldora de "Grupo"
    // seleccionada arriba (window._personasGrupoFiltro) — por eso el
    // Directorio seguía mostrando todos los colaboradores sin importar el
    // grupo activo. Los objetos de getPersonasData() no traen el campo
    // "grupo" (solo "empresa"), así que se deriva del catálogo EMPRESAS,
    // igual que en el resto de la app.
    const grupoFiltroDir = (window._personasGrupoFiltro || '').trim();
    if(grupoFiltroDir){
        data = data.filter(function(e){
            const g = grupoDeEmpresa(e.empresa||'');
            return _normGrupo(g) === _normGrupo(grupoFiltroDir);
        });
    }

    // Controles de filtro
    const empresasUnicas = [...new Set(data.map(e=>e.empresa).filter(Boolean))].sort();
    const deptosUnicos   = [...new Set(data.map(e=>e.depto).filter(Boolean))].sort();

    cont.innerHTML =
    // ── Toolbar ──────────────────────────────────────────────
    '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">'
    +'<div><h3 class="text-base font-bold text-slate-800">Directorio de Personas</h3>'
    +'<p class="text-xs text-slate-400 mt-0.5">'+data.length+' colaboradores</p></div>'
    +'<div class="flex gap-2">'
    +'<button onclick="toggleVistaDirect()" id="btn-vista-dir" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-600 transition" title="Cambiar vista">'
    +'<i class="fas fa-grip id-vista-icon"></i></button>'
    +'</div></div>'
    // Filtros
    +'<div class="flex flex-wrap gap-2 mb-4">'
    +'<div class="relative"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>'
    +'<input type="text" id="dir-search" placeholder="Buscar por nombre, puesto..." oninput="filtrarDirectorio()"'
    +' class="pl-8 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none w-56"></div>'
    +'<select id="dir-empresa" onchange="filtrarDirectorio()" class="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none">'
    +'<option value="">Todas las empresas</option>'
    +empresasUnicas.map(function(e){ return '<option>'+e+'</option>'; }).join('')
    +'</select>'
    +'<select id="dir-depto" onchange="filtrarDirectorio()" class="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none">'
    +'<option value="">Todos los departamentos</option>'
    +deptosUnicos.map(function(d){ return '<option>'+d+'</option>'; }).join('')
    +'</select>'
    +'<select id="dir-estatus" onchange="filtrarDirectorio()" class="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 outline-none">'
    +'<option value="">Todos</option><option value="Activo">Activos</option><option value="Baja">Bajas</option>'
    +'</select>'
    +'</div>'
    // Contenedor de tarjetas
    +'<div id="dir-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"></div>'
    +'<div id="dir-table" style="display:none" class="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm"></div>';

    // Guardar datos para filtrado
    window._dirData = data;
    filtrarDirectorio();
}

let _vistaGrid = true;
function toggleVistaDirect() {
    _vistaGrid = !_vistaGrid;
    const grid  = document.getElementById('dir-grid');
    const table = document.getElementById('dir-table');
    const icon  = document.querySelector('.id-vista-icon');
    if(grid)  grid.style.display  = _vistaGrid ? 'grid'  : 'none';
    if(table) table.style.display = _vistaGrid ? 'none'  : 'block';
    if(icon){ icon.className = 'fas id-vista-icon ' + (_vistaGrid ? 'fa-grip' : 'fa-list'); }
    if(!_vistaGrid) renderTablaDirectorio(window._dirDataFiltrada||[]);
}

function filtrarDirectorio() {
    const q   = (document.getElementById('dir-search')?.value||'').toLowerCase();
    const emp = (document.getElementById('dir-empresa')?.value||'');
    const dep = (document.getElementById('dir-depto')?.value||'');
    const est = (document.getElementById('dir-estatus')?.value||'');
    const data = window._dirData || [];

    const filt = data.filter(function(e){
        if(emp && e.empresa !== emp) return false;
        if(dep && e.depto   !== dep) return false;
        if(est && e.estatus !== est) return false;
        if(q){
            return (e.nombre||'').toLowerCase().includes(q)
                || (e.puesto||'').toLowerCase().includes(q)
                || (e.depto||'').toLowerCase().includes(q)
                || (e.idInterno||'').toLowerCase().includes(q);
        }
        return true;
    });

    window._dirDataFiltrada = filt;

    if(_vistaGrid) renderGridDirectorio(filt);
    else renderTablaDirectorio(filt);
}

// Cache de fotos ya cargadas: folderId → url de thumbnail (evita pedir 2 veces)
const _fotoCache = {};

function renderGridDirectorio(data) {
    const grid = document.getElementById('dir-grid');
    if(!grid) return;
    if(!data.length){
        grid.innerHTML = '<div class="col-span-4 text-center py-16 text-slate-400"><i class="fas fa-users-slash text-3xl mb-2 block"></i>Sin resultados</div>';
        return;
    }

    grid.innerHTML = data.map(function(e){
        const ini   = getIniciales(e.nombre) || '?';
        const color = avatarColor(e.nombre);
        const act   = e.estatus === 'Activo';
        const badge = act ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600';
        // Extraer folderId de la URL del expediente para carga lazy
        var folderId = '';
        if(e.urlExp && e.urlExp.startsWith('http')){
            var m = e.urlExp.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            if(m) folderId = m[1];
        }
        return '<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-violet-200 transition cursor-pointer dir-card"'
            +' data-id="'+e.idInterno+'"'
            +(folderId ? ' data-folder="'+folderId+'"' : '')+'>'
            +'<div class="flex flex-col items-center text-center">'
            // Avatar — ID único para poder actualizar después
            +'<div id="dir-av-'+e.idInterno+'" class="dir-avatar w-16 h-16 rounded-full mb-3 flex items-center justify-center text-white font-bold text-lg overflow-hidden flex-shrink-0"'
            +' style="background:'+color+';">'+ini+'</div>'
            +'<p class="font-bold text-slate-800 text-sm leading-tight mb-0.5">'+e.nombre+'</p>'
            +'<p class="text-xs text-slate-400 mb-2">'+e.puesto+'</p>'
            +'<span class="px-2 py-0.5 rounded-full text-xs font-bold mb-3 '+badge+'">'+e.estatus+'</span>'
            +'<div class="w-full text-left space-y-1 border-t border-slate-100 pt-3">'
            +(e.empresa?'<p class="text-xs text-slate-500 flex items-center gap-1.5"><i class="fas fa-building text-slate-300 w-3"></i>'+e.empresa+'</p>':'')
            +(e.depto?'<p class="text-xs text-slate-500 flex items-center gap-1.5"><i class="fas fa-sitemap text-slate-300 w-3"></i>'+e.depto+'</p>':'')
            +(e.email?'<p class="text-xs text-slate-500 flex items-center gap-1.5 truncate"><i class="fas fa-envelope text-slate-300 w-3"></i>'+e.email+'</p>':'')
            +(e.telefono?'<p class="text-xs text-slate-500 flex items-center gap-1.5"><i class="fas fa-phone text-slate-300 w-3"></i>'+e.telefono+'</p>':'')
            +'</div></div></div>';
    }).join('');

    // Iniciar carga lazy de fotos con IntersectionObserver
    iniciarLazyFotos();
}

// Cola de peticiones para no saturar el backend (máx 3 simultáneas)
var _fotoQueue = [];
var _fotoActivas = 0;
var _fotoMaxActivas = 3;

function iniciarLazyFotos(){
    // Desconectar observer anterior si existe
    if(window._dirFotoObserver) window._dirFotoObserver.disconnect();

    window._dirFotoObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
            if(!entry.isIntersecting) return;
            var card = entry.target;
            var folderId = card.dataset.folder;
            var idInterno = card.dataset.id;
            if(!folderId || card.dataset.fotoSolicitada) return;
            card.dataset.fotoSolicitada = '1';
            window._dirFotoObserver.unobserve(card);
            _fotoQueue.push({ folderId: folderId, idInterno: idInterno });
            procesarColaFotos();
        });
    }, { rootMargin: '100px', threshold: 0.1 });

    document.querySelectorAll('.dir-card[data-folder]').forEach(function(card){
        var folderId = card.dataset.folder;
        // Si ya está en caché, aplicar inmediatamente sin pedir al backend
        if(_fotoCache[folderId]){
            var av = document.getElementById('dir-av-'+card.dataset.id);
            if(av) aplicarFotoAvatar(av, _fotoCache[folderId]);
        } else {
            window._dirFotoObserver.observe(card);
        }
    });
}

function procesarColaFotos(){
    while(_fotoActivas < _fotoMaxActivas && _fotoQueue.length > 0){
        var item = _fotoQueue.shift();
        _fotoActivas++;
        cargarFotoDirectorio(item.folderId, item.idInterno).finally(function(){
            _fotoActivas--;
            procesarColaFotos();
        });
    }
}

async function cargarFotoDirectorio(folderId, idInterno){
    // Si ya está en caché de sesión, no volver a pedir
    if(_fotoCache[folderId] === null) return; // null = confirmado que no tiene foto
    if(_fotoCache[folderId]) {
        var av = document.getElementById('dir-av-'+idInterno);
        if(av) aplicarFotoAvatar(av, _fotoCache[folderId]);
        return;
    }
    try {
        var r = await enviarPeticion('obtener_foto', { folderId: folderId });
        if(r && r.status === 'success' && r.url){
            _fotoCache[folderId] = r.url;
            var av = document.getElementById('dir-av-'+idInterno);
            if(av) aplicarFotoAvatar(av, r.url);
        } else {
            _fotoCache[folderId] = null; // marcar como "sin foto" para no volver a pedir
        }
    } catch(e) {
        _fotoCache[folderId] = null;
    }
}

function aplicarFotoAvatar(avDiv, url){
    var img = new Image();
    img.onload = function(){
        avDiv.innerHTML = '';
        avDiv.style.background = 'transparent';
        avDiv.appendChild(img);
    };
    img.onerror = function(){ /* mantener iniciales */ };
    img.src = url;
    img.className = 'w-full h-full object-cover';
    img.alt = '';
}

function renderTablaDirectorio(data) {
    const table = document.getElementById('dir-table');
    if(!table) return;
    if(!data.length){ table.innerHTML='<p class="text-center py-8 text-slate-400 text-sm">Sin resultados</p>'; return; }
    table.innerHTML = '<table class="w-full text-sm">'
        +'<thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">'
        +'<tr><th class="px-4 py-3 text-left">Colaborador</th><th class="px-4 py-3 text-left">Puesto</th>'
        +'<th class="px-4 py-3 text-left">Departamento</th><th class="px-4 py-3 text-left">Empresa</th>'
        +'<th class="px-4 py-3 text-left">Contacto</th><th class="px-4 py-3 text-center">Estatus</th></tr></thead>'
        +'<tbody class="divide-y divide-slate-50">'
        +data.map(function(e){
            const ini=getIniciales(e.nombre)||'?';
            const col=avatarColor(e.nombre);
            const act=e.estatus==='Activo';
            return '<tr class="hover:bg-slate-50 cursor-pointer dir-table-row" data-id="'+e.idInterno+'">'+
                +'<td class="px-4 py-3"><div class="flex items-center gap-2">'
                +'<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+col+';">'+ini+'</div>'
                +'<div><p class="font-semibold text-slate-700">'+e.nombre+'</p>'
                +'<p class="text-xs text-slate-400">'+e.idInterno+'</p></div></div></td>'
                +'<td class="px-4 py-3 text-xs text-slate-600">'+e.puesto+'</td>'
                +'<td class="px-4 py-3 text-xs text-slate-500">'+e.depto+'</td>'
                +'<td class="px-4 py-3 text-xs text-slate-500">'+e.empresa+'</td>'
                +'<td class="px-4 py-3 text-xs text-slate-500">'+(e.email||'—')+'</td>'
                +'<td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold '+(act?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600')+'">'+e.estatus+'</span></td>'
                +'</tr>';
        }).join('')
        +'</tbody></table>';
    setTimeout(function(){
        var t=document.getElementById('dir-table');
        if(t) t.addEventListener('click',function(e){
            var row=e.target.closest('.dir-table-row');
            if(row && row.dataset.id) abrirPerfilPersona(row.dataset.id);
        });
    },50);
}

// ── Abrir perfil individual ───────────────────────────────────
function abrirPerfilPersona(idInterno) {
    // Reutilizar el drawer de expedientes
    abrirEditor(idInterno);
}

// ── ORGANIGRAMA ───────────────────────────────────────────────

// ── Construir árbol de organigrama desde cacheGlobal ─────────
function construirArbolDesdeCache() {
    if(!cacheGlobal || !cacheGlobal.length) return [];
    const grupoFiltro = (window._personasGrupoFiltro || '').trim();

    const empleados = cacheGlobal
        .filter(function(e){
            if(!(e["NO. EMPLEADO"]||"").toString().trim()) return false;
            if((e["ESTATUS"]||"").toString().trim() !== "Activo") return false;
            if(grupoFiltro){
                // BUGFIX 07 jul 2026: preferir el grupo derivado del catálogo
                // EMPRESAS (fuente de verdad) sobre el valor crudo guardado
                // por empleado, y comparar normalizado (sin mayúsculas/acentos).
                const empVal = (e["EMPRESA"]||"").toString().trim();
                const g = grupoDeEmpresa(empVal) || (e["GRUPO COMERCIAL"]||"").toString().trim();
                if(_normGrupo(g) !== _normGrupo(grupoFiltro)) return false;
            }
            return true;
        })
        .map(function(e){
            return {
                idInterno:  (e["ID INTERNO"]||"").toString().trim(),
                noEmpleado: (e["NO. EMPLEADO"]||"").toString().trim(),
                nombre:     (e["NOMBRE DEL TRABAJADOR"]||"").toString().trim(),
                empresa:    (e["EMPRESA"]||"").toString().trim(),
                puesto:     (e["PUESTO"]||"").toString().trim(),
                depto:      (e["DEPARTAMENTO"]||"").toString().trim(),
                estatus:    (e["ESTATUS"]||"").toString().trim(),
                jefe:       (e["JEFE DIRECTO"]||"").toString().trim(),
                children:   []
            };
        });

    const mapa = {};
    empleados.forEach(function(e){ if(e.idInterno) mapa[e.idInterno] = e; });

    const raices = [];
    empleados.forEach(function(e){
        if(e.jefe && mapa[e.jefe] && e.jefe !== e.idInterno) {
            mapa[e.jefe].children.push(e);
        } else {
            raices.push(e);
        }
    });

    return raices;
}
async function renderOrganigrama(cont) {
    cont.innerHTML = '<div class="flex justify-center py-12"><i class="fas fa-spinner fa-spin text-violet-400 text-2xl"></i></div>';
    let arbol = [];
    let totalEmps = 0;

    try {
        const r = await enviarPeticion('obtener_organigrama', { token: getToken() });
        if(r.status === 'success') {
            arbol = r.arbol || [];
            totalEmps = r.total || 0;
        } else {
            // Fallback: construir árbol desde cacheGlobal
            console.warn('[Organigrama] GAS falló, usando cacheGlobal');
            arbol = construirArbolDesdeCache();
            totalEmps = cacheGlobal.length;
        }
    } catch(e) {
        console.error('[Organigrama] Error:', e);
        arbol = construirArbolDesdeCache();
        totalEmps = cacheGlobal.length;
    }

    // Filtrar por empresas permitidas
    const todosFlat = flattenArbol(arbol);
    const permitidos = filtrarPorEmpresasPermitidas(todosFlat);
    const idsPermitidos = new Set(permitidos.map(function(e){ return e.idInterno; }));

    // Si hay filtro de empresas, filtrar el árbol
    if(window._empresasPermitidas && window._empresasPermitidas.length) {
        arbol = arbol.filter(function(n){ return idsPermitidos.has(n.idInterno); });
    }

    cont.innerHTML =
    '<div class="mb-4 flex items-center justify-between">'
    +'<div><h3 class="text-base font-bold text-slate-800">Organigrama</h3>'
    +'<p class="text-xs text-slate-400 mt-0.5">'+totalEmps+' colaboradores</p></div>'
    +'<div class="flex gap-2">'
    +'<select id="org-empresa" onchange="filtrarOrganigrama()" class="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none">'
    +'<option value="">Todas las empresas</option>'
    +[...new Set(flattenArbol(arbol).map(function(e){return e.empresa;}).filter(Boolean))].sort().map(function(e){
        return '<option>'+e+'</option>';
    }).join('')
    +'</select></div></div>'
    +'<div id="org-wrap" class="overflow-auto pb-4"></div>';

    window._orgArbol = arbol;
    renderNodosOrg(arbol, '');
}

function flattenArbol(nodos) {
    var res = [];
    (nodos||[]).forEach(function(n){
        res.push(n);
        if(n.children && n.children.length) res = res.concat(flattenArbol(n.children));
    });
    return res;
}

function filtrarOrganigrama() {
    const emp = (document.getElementById('org-empresa')?.value||'');
    let arbol = window._orgArbol || [];
    if(emp) {
        arbol = arbol.filter(function(n){ return n.empresa === emp; });
    }
    renderNodosOrg(arbol, emp);
}

function renderNodosOrg(nodos, empFiltro) {
    const wrap = document.getElementById('org-wrap');
    if(!wrap) return;

    const todos = flattenArbol(nodos);
    const conJefe = todos.filter(function(n){ return n.jefe && n.jefe.trim(); });

    if(!nodos.length){
        wrap.innerHTML='<div class="text-center py-12 text-slate-400"><i class="fas fa-sitemap text-4xl mb-3 block text-slate-200"></i>'
            +'<p class="font-semibold">Sin datos de organigrama</p>'
            +'<p class="text-xs mt-1">Asigna el campo <strong>Jefe Directo</strong> en los expedientes para construir la jerarquía.</p></div>';
        return;
    }

    const avisoHtml = conJefe.length === 0
        ? '<div class="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700"><i class="fas fa-triangle-exclamation mr-1.5"></i><strong>Sin jerarquía definida</strong> — ningún empleado tiene Jefe Directo asignado. Edita los expedientes y asigna el ID INTERNO del jefe en el campo "Jefe Directo".</div>'
        : conJefe.length < todos.length
            ? '<div class="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700"><i class="fas fa-info-circle mr-1.5"></i>'+conJefe.length+' de '+todos.length+' empleados tienen jefe asignado.</div>'
            : '';

    // Siempre árbol — nunca lista plana
    wrap.innerHTML = avisoHtml + '<div class="org-tree">'+renderNodoHtml(nodos, 0, empFiltro)+'</div>';

    // Click: modal de relaciones
    wrap.addEventListener('click', function(e){
        var card = e.target.closest('.org-card');
        if(card && card.dataset.id) mostrarRelacionesOrg(card.dataset.id);
    });
}

function mostrarRelacionesOrg(idInterno) {
    const todos = flattenArbol(window._orgArbol || []);
    const mapa  = {};
    todos.forEach(function(n){ if(n.idInterno) mapa[n.idInterno] = n; });
    const persona = mapa[idInterno];
    if(!persona) return;

    const jefe = persona.jefe ? mapa[persona.jefe] : null;
    const subordinados = todos.filter(function(n){ return n.jefe === idInterno; });
    const compañeros   = jefe ? todos.filter(function(n){ return n.jefe === jefe.idInterno && n.idInterno !== idInterno; }) : [];

    function tarjeta(n, tipo) {
        const ini = getIniciales(n.nombre)||'?', color = avatarColor(n.nombre);
        const badges = {jefe:'text-violet-600 bg-violet-50',sub:'text-blue-600 bg-blue-50',comp:'text-slate-500 bg-slate-100'};
        const labels = {jefe:'Jefe',sub:'Subordinado',comp:'Compañero'};
        return '<div class="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">'
            +'<div class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+color+'">'+ini+'</div>'
            +'<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 truncate">'+n.nombre+'</p>'
            +'<p class="text-xs text-slate-400 truncate">'+n.puesto+(n.depto?' · '+n.depto:'')+'</p></div>'
            +'<span class="text-xs font-bold px-2 py-0.5 rounded-full '+badges[tipo]+'">'+labels[tipo]+'</span></div>';
    }

    const ini = getIniciales(persona.nombre)||'?', color = avatarColor(persona.nombre);
    const html = '<div id="org-modal-overlay" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)cerrarModalOrg()">'
        +'<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">'
        +'<div class="flex items-center gap-4 p-5 border-b border-slate-100">'
        +'<div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style="background:'+color+'">'+ini+'</div>'
        +'<div class="flex-1"><p class="text-base font-bold text-slate-800">'+persona.nombre+'</p>'
        +'<p class="text-sm text-slate-400">'+persona.puesto+(persona.depto?' · '+persona.depto:'')+'</p>'
        +'<p class="text-xs text-violet-500 font-semibold mt-0.5">'+persona.empresa+'</p></div>'
        +'<button onclick="cerrarModalOrg()" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition"><i class="fas fa-times"></i></button>'
        +'</div>'
        +'<div class="flex-1 overflow-y-auto p-5 space-y-4">'
        +(jefe ? '<div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2"><i class="fas fa-arrow-up text-violet-400 mr-1.5"></i>Jefe Directo</p>'+tarjeta(jefe,'jefe')+'</div>'
               : '<div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-400 text-center"><i class="fas fa-crown mr-1"></i>Sin jefe directo asignado</div>')
        +(subordinados.length ? '<div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2"><i class="fas fa-arrow-down text-blue-400 mr-1.5"></i>Subordinados ('+subordinados.length+')</p>'+subordinados.map(function(s){return tarjeta(s,'sub');}).join('')+'</div>' : '')
        +(compañeros.length ? '<div><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2"><i class="fas fa-users text-slate-400 mr-1.5"></i>Compañeros ('+compañeros.length+')</p>'+compañeros.slice(0,8).map(function(c){return tarjeta(c,'comp');}).join('')+(compañeros.length>8?'<p class="text-xs text-slate-400 text-center pt-2">...y '+(compañeros.length-8)+' más</p>':'')+'</div>' : '')
        +'</div></div></div>';

    var existing = document.getElementById('org-modal-overlay');
    if(existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}
function cerrarModalOrg() { var m=document.getElementById('org-modal-overlay'); if(m) m.remove(); }

function renderNodoHtml(nodos, nivel, empFiltro) {
    return nodos.map(function(e){
        const ini   = getIniciales(e.nombre) || '?';
        const color = avatarColor(e.nombre);
        const hijos = (e.children||[]).filter(function(c){
            return !empFiltro || c.empresa === empFiltro;
        });
        const tieneHijos = hijos.length > 0;
        var html = '<div class="org-node" style="--nivel:' + nivel + ';"><';
        html += 'div class="org-card" data-id="' + e.idInterno + '" title="' + e.nombre + '">';
        html += '<div class="org-avatar" style="background:' + color + ';">' + ini + '</div>';
        html += '<div class="org-info">';
        html += '<p class="org-nombre">' + e.nombre + '</p>';
        html += '<p class="org-puesto">' + e.puesto + '</p>';
        if(nivel === 0) html += '<p class="org-empresa">' + e.empresa + '</p>';
        html += '</div>';
        if(tieneHijos) html += '<span class="org-count">' + hijos.length + '</span>';
        html += '</div>'; // cierra org-card
        if(tieneHijos) html += '<div class="org-children">' + renderNodoHtml(hijos, nivel+1, empFiltro) + '</div>';
        html += '</div>'; // cierra org-node
        return html;
    }).join('');
}

// ── INFORMES ──────────────────────────────────────────────────
async function renderInformesPersonas(cont) {
    const todos = await getPersonasData();
    let data  = filtrarPorEmpresasPermitidas(todos);
    // BUGFIX 07 jul 2026: igual que Directorio, esta pestaña tampoco
    // aplicaba la píldora de "Grupo" seleccionada.
    const grupoFiltroInf = (window._personasGrupoFiltro || '').trim();
    if(grupoFiltroInf){
        data = data.filter(function(e){
            return _normGrupo(grupoDeEmpresa(e.empresa||'')) === _normGrupo(grupoFiltroInf);
        });
    }
    const act   = data.filter(function(e){ return e.estatus==='Activo'; });
    const bajas = data.filter(function(e){ return e.estatus!=='Activo'; });

    // Distribución por empresa
    const porEmp = {};
    act.forEach(function(e){ porEmp[e.empresa]=(porEmp[e.empresa]||0)+1; });
    const empEntries = Object.entries(porEmp).sort(function(a,b){ return b[1]-a[1]; });

    // Distribución por departamento
    const porDep = {};
    act.forEach(function(e){ if(e.depto) porDep[e.depto]=(porDep[e.depto]||0)+1; });
    const depEntries = Object.entries(porDep).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10);

    const maxEmp = empEntries.length ? empEntries[0][1] : 1;
    const maxDep = depEntries.length ? depEntries[0][1] : 1;

    cont.innerHTML =
    '<h3 class="text-base font-bold text-slate-800 mb-5">Informes de Personas</h3>'
    // KPIs
    +'<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">'
    +[
        ['Total registros', data.length, 'fa-users','text-slate-800'],
        ['Plantilla activa', act.length, 'fa-user-check','text-emerald-600'],
        ['Bajas', bajas.length, 'fa-user-minus','text-red-500'],
        ['Empresas', Object.keys(porEmp).length, 'fa-building','text-violet-600']
    ].map(function(k){
        return '<div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">'
            +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">'+k[0]+'</p>'
            +'<p class="text-2xl font-black '+k[3]+' mt-1">'+k[1]+'</p></div>';
    }).join('')
    +'</div>'
    // Por empresa
    +'<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-4"><i class="fas fa-building text-violet-400 mr-2"></i>Plantilla por Empresa</p>'
    +'<div class="space-y-2.5">'
    +empEntries.map(function(e){
        const w=Math.round(e[1]/maxEmp*100);
        return '<div><div class="flex justify-between mb-1"><span class="text-xs font-medium text-slate-600 truncate max-w-[70%]">'+e[0]+'</span>'
            +'<span class="text-xs font-bold text-violet-600">'+e[1]+'</span></div>'
            +'<div class="h-2 bg-slate-100 rounded-full overflow-hidden">'
            +'<div class="h-full bg-gradient-to-r from-violet-500 to-violet-300 rounded-full" style="width:'+w+'%"></div>'
            +'</div></div>';
    }).join('')
    +'</div></div>'
    // Por departamento
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-4"><i class="fas fa-sitemap text-blue-400 mr-2"></i>Top 10 Departamentos</p>'
    +'<div class="space-y-2.5">'
    +depEntries.map(function(e){
        const w=Math.round(e[1]/maxDep*100);
        return '<div><div class="flex justify-between mb-1"><span class="text-xs font-medium text-slate-600 truncate max-w-[70%]">'+e[0]+'</span>'
            +'<span class="text-xs font-bold text-blue-600">'+e[1]+'</span></div>'
            +'<div class="h-2 bg-slate-100 rounded-full overflow-hidden">'
            +'<div class="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full" style="width:'+w+'%"></div>'
            +'</div></div>';
    }).join('')
    +'</div></div></div>';
}

// ── ADMINISTRACIÓN ────────────────────────────────────────────
async function renderAdminPersonas(cont) {
    const todos = await getPersonasData();
    let data  = filtrarPorEmpresasPermitidas(todos);
    // BUGFIX 07 jul 2026: igual que Directorio/Informes, esta pestaña
    // tampoco aplicaba la píldora de "Grupo" seleccionada a sus catálogos
    // de Departamentos/Puestos/Empresas (el bloque de Grupos Comerciales
    // sí queda intencionalmente global, para que siempre se vean todos).
    const grupoFiltroAdm = (window._personasGrupoFiltro || '').trim();
    if(grupoFiltroAdm){
        data = data.filter(function(e){
            return _normGrupo(grupoDeEmpresa(e.empresa||'')) === _normGrupo(grupoFiltroAdm);
        });
    }

    // Catálogos únicos
    const deptos  = [...new Set(data.map(function(e){return e.depto;}).filter(Boolean))].sort();
    const puestos = [...new Set(data.map(function(e){return e.puesto;}).filter(Boolean))].sort();
    const emps    = [...new Set(data.map(function(e){return e.empresa;}).filter(Boolean))].sort();
    // Grupos comerciales desde el catálogo EMPRESAS (más confiable que la BD)
    const grupos  = listaGrupos().length ? listaGrupos()
                  : [...new Set(cacheGlobal.map(r=>(r["GRUPO COMERCIAL"]||"").toString().trim()).filter(Boolean))].sort();

    cont.innerHTML =
    '<h3 class="text-base font-bold text-slate-800 mb-5">Administración — Catálogos</h3>'
    +'<p class="text-xs text-slate-400 mb-5">Estos catálogos se generan automáticamente desde los datos del Sheet. Para modificarlos, edita directamente el expediente del colaborador.</p>'
    +'<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">'
    // Departamentos
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fas fa-sitemap text-violet-500"></i>Departamentos <span class="text-xs text-slate-400 font-normal ml-auto">'+deptos.length+'</span></p>'
    +'<div class="space-y-1 max-h-64 overflow-y-auto">'
    +deptos.map(function(d){
        const cnt = data.filter(function(e){return e.depto===d;}).length;
        return '<div class="flex items-center justify-between py-1.5 border-b border-slate-50">'
            +'<span class="text-xs text-slate-600">'+d+'</span>'
            +'<span class="text-xs font-bold text-slate-400">'+cnt+'</span></div>';
    }).join('')+'</div></div>'
    // Puestos
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fas fa-briefcase text-blue-500"></i>Puestos <span class="text-xs text-slate-400 font-normal ml-auto">'+puestos.length+'</span></p>'
    +'<div class="space-y-1 max-h-64 overflow-y-auto">'
    +puestos.map(function(p){
        const cnt = data.filter(function(e){return e.puesto===p;}).length;
        return '<div class="flex items-center justify-between py-1.5 border-b border-slate-50">'
            +'<span class="text-xs text-slate-600">'+p+'</span>'
            +'<span class="text-xs font-bold text-slate-400">'+cnt+'</span></div>';
    }).join('')+'</div></div>'
    // Empresas
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fas fa-building text-emerald-500"></i>Empresas <span class="text-xs text-slate-400 font-normal ml-auto">'+emps.length+'</span></p>'
    +'<div class="space-y-1 max-h-64 overflow-y-auto">'
    +emps.map(function(e2){
        const cnt = data.filter(function(e){return e.empresa===e2;}).length;
        return '<div class="flex items-center justify-between py-1.5 border-b border-slate-50">'
            +'<span class="text-xs text-slate-600">'+e2+'</span>'
            +'<span class="text-xs font-bold text-slate-400">'+cnt+'</span></div>';
    }).join('')+'</div></div>'
    // Grupos Comerciales — desde catálogo EMPRESAS
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
    +'<p class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fas fa-layer-group text-amber-500"></i>Grupos Comerciales <span class="text-xs text-slate-400 font-normal ml-auto">'+grupos.length+'</span></p>'
    +'<div class="space-y-1 max-h-64 overflow-y-auto">'
    +grupos.map(function(g){
        const cnt = catalogoEmpresas.filter(function(e){return e.grupo===g;}).length;
        const cntEmp = cacheGlobal.filter(function(r){
            // BUGFIX 07 jul 2026: catálogo primero, comparación normalizada
            const empVal = (r["EMPRESA"]||"").toString().trim();
            const grp = grupoDeEmpresa(empVal) || (r["GRUPO COMERCIAL"]||"").toString().trim();
            return _normGrupo(grp) === _normGrupo(g);
        }).length;
        return '<div class="flex items-center justify-between py-1.5 border-b border-slate-50">'
            +'<div>'
            +'<span class="text-xs text-slate-600">'+g+'</span>'
            +'<span class="text-xs text-slate-400 ml-2">'+cnt+' empresa(s)</span>'
            +'</div>'
            +'<span class="text-xs font-bold text-amber-500">'+cntEmp+'</span></div>';
    }).join('')+'</div></div>'
    +'</div>';
}


// ══════════════════════════════════════════════════════════════
//  MÓDULO EVALUACIONES
// ══════════════════════════════════════════════════════════════
let _evalProcesoActual = null;

const EVAL_TIPOS = {
    desempeno:    { label:'Desempeño',    color:'#7c3aed', bg:'#f5f3ff', icon:'fa-chart-line'    },
    '360':        { label:'360°',         color:'#2563eb', bg:'#eff6ff', icon:'fa-rotate'        },
    competencias: { label:'Competencias', color:'#059669', bg:'#f0fdf4', icon:'fa-star-half-alt' }
};

async function cargarModuloEvaluaciones() {
    activarTabEval('miseval', document.querySelector('.eval-tab[data-tab="miseval"]'));
}

function activarTabEval(tab, btnEl) {
    document.querySelectorAll('.eval-tab').forEach(function(b){
        b.classList.remove('active','border-violet-600','text-violet-700','bg-violet-50');
        b.classList.add('border-transparent','text-slate-500');
    });
    if(btnEl){
        btnEl.classList.add('active','border-violet-600','text-violet-700','bg-violet-50');
        btnEl.classList.remove('border-transparent','text-slate-500');
    }
    const cont = document.getElementById('eval-contenido');
    if(!cont) return;
    cont.innerHTML = '<div class="flex justify-center py-16"><i class="fas fa-spinner fa-spin text-violet-400 text-2xl"></i></div>';
    // Reinicia la animación de entrada en cada cambio de pestaña (el div es
    // persistente, así que solo agregar la clase no la vuelve a disparar)
    cont.classList.remove('tab-fade'); void cont.offsetWidth; cont.classList.add('tab-fade');

    if(tab==='miseval')  renderMisEvaluaciones(cont);
    else if(tab==='equipo')  renderMiEquipoEval(cont);
    else if(tab==='informes') renderInformesEval(cont);
    else if(tab==='admin')   renderAdminEval(cont);
}

// ── MIS EVALUACIONES ─────────────────────────────────────────
async function renderMisEvaluaciones(cont) {
    const idInt = sesionActual?.usuario?.idInterno || '';
    if(!idInt){
        cont.innerHTML = '<div class="text-center py-12 text-slate-400">'
            +'<i class="fas fa-user-slash text-3xl mb-3 block text-slate-200"></i>'
            +'<p class="font-semibold">Sin ID INTERNO asignado</p>'
            +'<p class="text-xs mt-1">Configura el ID INTERNO del usuario para ver sus evaluaciones.</p></div>';
        return;
    }

    const r = await enviarPeticion('listar_mis_eval',{ idEvaluador: idInt, idUsuario: idInt });
    if(r.status !== 'success'){ cont.innerHTML='<p class="text-red-400 text-center py-8">'+r.message+'</p>'; return; }

    const evals = r.evaluaciones || [];
    const pend  = evals.filter(function(e){ return e.estatus==='Pendiente'; });
    const comp  = evals.filter(function(e){ return e.estatus==='Completada'; });

    if(!evals.length){
        cont.innerHTML = '<div class="text-center py-16 text-slate-400">'
            +'<i class="fas fa-clipboard-check text-4xl mb-3 block text-slate-200"></i>'
            +'<p class="font-semibold">Sin evaluaciones asignadas</p>'
            +'<p class="text-xs mt-1">Cuando el administrador active un proceso, aparecerán aquí.</p></div>';
        return;
    }

    const comoEvaluado = r.comoEvaluado || [];
    const rolLabel = {
        jefe:'Evalúas como Jefe', autoevaluacion:'Autoevaluación',
        par:'Evaluación de Par', subordinado:'Evaluación de Subordinado'
    };

    cont.innerHTML = '<h3 class="text-base font-bold text-slate-800 mb-5">Mis Evaluaciones</h3>'
    +'<div class="grid grid-cols-3 gap-3 mb-6">'
    +'<div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Por llenar</p>'
      +'<p class="text-2xl font-black text-slate-800 mt-1">'+evals.length+'</p></div>'
    +'<div class="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-amber-600 uppercase tracking-wide">Pendientes</p>'
      +'<p class="text-2xl font-black text-amber-600 mt-1">'+pend.length+'</p></div>'
    +'<div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-emerald-600 uppercase tracking-wide">Completadas</p>'
      +'<p class="text-2xl font-black text-emerald-600 mt-1">'+comp.length+'</p></div>'
    +'</div>'
    // Evaluaciones que debo llenar
    +(evals.length ? '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Evaluaciones que debes llenar</p>'
      +'<div class="space-y-3 mb-6">'
      +evals.map(function(ev){
          const isPend = ev.estatus==='Pendiente';
          const rol = rolLabel[ev.rolEvaluador]||ev.rolEvaluador;
          return '<div class="bg-white rounded-2xl border '+(isPend?'border-amber-200':'border-slate-100')+' shadow-sm p-5 flex items-center justify-between gap-4">'
              +'<div class="flex items-center gap-4">'
              +'<div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background:'+(isPend?'#f59e0b':'#10b981')+';">'
              +'<i class="fas fa-'+(isPend?'clipboard-list':'check-circle')+'"></i></div>'
              +'<div>'
              +'<p class="font-bold text-slate-800 text-sm">'+ev.nombreEvaluado+'</p>'
              +'<p class="text-xs text-violet-600 font-semibold mt-0.5">'+rol+'</p>'
              +'<p class="text-xs text-slate-400">Proceso: '+ev.idProceso+'</p>'
              +(ev.fechaComp?'<p class="text-xs text-emerald-500 mt-0.5">Completada: '+new Date(ev.fechaComp).toLocaleDateString('es-MX')+'</p>':'')
              +'</div></div>'
              +'<div class="flex items-center gap-2 flex-shrink-0">'
              +'<span class="px-2 py-1 rounded-lg text-xs font-bold '+(isPend?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')+'">'+ev.estatus+'</span>'
              +(isPend?'<button data-evid="'+ev.id+'" data-proc="'+ev.idProceso+'" class="eval-form-btn px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition"><i class="fas fa-pen mr-1"></i>Evaluar</button>':'')
              +'</div></div>';
      }).join('')+'</div>'
    : '')
    // Quién me está evaluando
    +(comoEvaluado.length ? '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Mi proceso de evaluación</p>'
      +'<div class="space-y-3">'
      +comoEvaluado.map(function(ev){
          const isPend=ev.estatus==='Pendiente';
          const ini=getIniciales(ev.nombreEvaluado)||'?';
          const col=avatarColor(ev.nombreEvaluado);
          const rolEv={jefe:'Tu jefe directo',autoevaluacion:'Autoevaluación',par:'Un par',subordinado:'Un subordinado'}[ev.rolEvaluador]||ev.rolEvaluador;
          return '<div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center gap-4">'
              +'<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+col+';">'+ini+'</div>'
              +'<div class="flex-1">'
              +'<p class="text-sm font-semibold text-slate-700">'+rolEv+'</p>'
              +'<p class="text-xs text-slate-400">'+ev.idProceso+'</p></div>'
              +'<span class="px-2 py-1 rounded-lg text-xs font-bold '+(isPend?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')+'">'+ev.estatus+'</span>'
              +'</div>';
      }).join('')+'</div>'
    : (evals.length===0 ? '<div class="text-center py-8 text-slate-400"><i class="fas fa-clipboard-check text-2xl mb-2 block text-slate-200"></i><p class="text-sm">No hay evaluaciones activas para tu perfil.</p></div>' : ''));
}

// ── MI EQUIPO ────────────────────────────────────────────────
async function renderMiEquipoEval(cont) {
    const idInt = sesionActual?.usuario?.idInterno || '';
    const r = await enviarPeticion('listar_equipo_eval',{ idJefe: idInt });
    if(r.status !== 'success'){ cont.innerHTML='<p class="text-red-400 text-center py-8">'+r.message+'</p>'; return; }

    const equipo = r.equipo || [];
    if(!equipo.length){
        cont.innerHTML = '<div class="text-center py-16 text-slate-400">'
            +'<i class="fas fa-users text-4xl mb-3 block text-slate-200"></i>'
            +'<p class="font-semibold">Sin evaluaciones de equipo</p>'
            +'<p class="text-xs mt-1">Cuando exista un proceso activo con colaboradores a tu cargo, aparecerán aquí.</p></div>';
        return;
    }

    const pend = equipo.filter(function(e){ return e.estatus==='Pendiente'; }).length;
    const comp = equipo.filter(function(e){ return e.estatus==='Completada'; }).length;
    const pct  = equipo.length>0 ? Math.round(comp/equipo.length*100) : 0;

    cont.innerHTML = '<h3 class="text-base font-bold text-slate-800 mb-5">Mi Equipo — Evaluaciones</h3>'
    // Progreso general
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">'
    +'<div class="flex items-center justify-between mb-2">'
    +'<p class="text-sm font-bold text-slate-700">Progreso del equipo</p>'
    +'<span class="text-sm font-black text-violet-600">'+pct+'%</span>'
    +'</div>'
    +'<div class="h-3 bg-slate-100 rounded-full overflow-hidden mb-3">'
    +'<div class="h-full bg-gradient-to-r from-violet-500 to-violet-300 rounded-full transition-all duration-700" style="width:'+pct+'%"></div>'
    +'</div>'
    +'<div class="flex gap-4 text-xs text-slate-500">'
    +'<span><strong class="text-amber-600">'+pend+'</strong> pendientes</span>'
    +'<span><strong class="text-emerald-600">'+comp+'</strong> completadas</span>'
    +'<span><strong class="text-slate-700">'+equipo.length+'</strong> total</span>'
    +'</div></div>'
    // Lista del equipo
    +'<div class="space-y-3">'
    +equipo.map(function(ev){
        const pend = ev.estatus==='Pendiente';
        const ini  = getIniciales(ev.nombreEvaluado)||'?';
        const col  = avatarColor(ev.nombreEvaluado);
        return '<div class="bg-white rounded-2xl border '+(pend?'border-amber-100':'border-slate-100')+' shadow-sm p-4 flex items-center gap-4">'
            +'<div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+col+';">'+ini+'</div>'
            +'<div class="flex-1">'
            +'<p class="font-bold text-slate-700 text-sm">'+ev.nombreEvaluado+'</p>'
            +'<p class="text-xs text-slate-400">Proceso: '+ev.idProceso+'</p>'
            +'</div>'
            +'<div class="flex items-center gap-2">'
            +'<span class="px-2 py-1 rounded-lg text-xs font-bold '+(pend?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')+'">'+ev.estatus+'</span>'
            +(pend?'<button data-evid="'+ev.id+'" data-proc="'+ev.idProceso+'" class="eval-form-btn px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition">Evaluar</button>':'')
            +'</div></div>';
    }).join('')
    +'</div>';
}

// ── INFORMES EVALUACIONES ────────────────────────────────────
async function renderInformesEval(cont) {
    const r = await enviarPeticion('listar_procesos_eval',{ token: getToken() });
    if(r.status !== 'success'){ cont.innerHTML='<p class="text-red-400 text-center py-8">'+r.message+'</p>'; return; }

    const procesos = (r.procesos||[]).filter(function(p){ return p.estatus!=='Borrador'; });

    if(!procesos.length){
        cont.innerHTML = '<div class="text-center py-16 text-slate-400">'
            +'<i class="fas fa-chart-bar text-4xl mb-3 block text-slate-200"></i>'
            +'<p class="font-semibold">Sin procesos activos</p>'
            +'<p class="text-xs mt-1">Activa un proceso de evaluación para ver sus resultados.</p></div>';
        return;
    }

    // Selector de proceso
    cont.innerHTML = '<h3 class="text-base font-bold text-slate-800 mb-4">Informes de Evaluaciones</h3>'
    +'<div class="flex gap-2 mb-5">'
    +'<select id="inf-eval-sel" onchange="cargarInformeEval(this.value)" '
    +'class="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500">'
    +'<option value="">— Selecciona un proceso —</option>'
    +procesos.map(function(p){
        return '<option value="'+p.id+'">'+p.nombre+' ('+p.estatus+')</option>';
    }).join('')
    +'</select></div>'
    +'<div id="inf-eval-cont"></div>';
}

async function cargarInformeEval(idProceso) {
    if(!idProceso) return;
    const cont = document.getElementById('inf-eval-cont');
    if(!cont) return;
    cont.innerHTML = '<div class="flex justify-center py-8"><i class="fas fa-spinner fa-spin text-violet-400"></i></div>';

    const [rRes, rProc] = await Promise.all([
        enviarPeticion('resultados_eval',{ idProceso }),
        enviarPeticion('obtener_proceso_eval',{ id: idProceso })
    ]);

    if(rRes.status !== 'success'){ cont.innerHTML='<p class="text-red-400">'+rRes.message+'</p>'; return; }

    const tipo   = rProc.proceso?.tipo || 'desempeno';
    const t      = EVAL_TIPOS[tipo] || EVAL_TIPOS.desempeno;
    const total  = rRes.total || 0;
    const comp   = rRes.completadas || 0;
    const pend   = rRes.pendientes || 0;
    const pct    = total>0 ? Math.round(comp/total*100) : 0;

    // Calcular promedio general (para escala 1-10)
    let sumTotal=0, cntTotal=0;
    (rRes.evaluaciones||[]).filter(function(e){ return e.estatus==='Completada'; }).forEach(function(ev){
        Object.values(ev.respuestas||{}).forEach(function(v){
            const n=parseInt(v); if(!isNaN(n)&&n>=1&&n<=10){ sumTotal+=n; cntTotal++; }
        });
    });
    const promG = cntTotal>0 ? (sumTotal/cntTotal).toFixed(1) : '—';

    cont.innerHTML =
    // KPIs
    '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">'
    +'<div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-slate-400 uppercase">Evaluaciones</p>'
      +'<p class="text-2xl font-black text-slate-800 mt-1">'+total+'</p></div>'
    +'<div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-emerald-600 uppercase">Completadas</p>'
      +'<p class="text-2xl font-black text-emerald-600 mt-1">'+comp+'</p></div>'
    +'<div class="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm text-center">'
      +'<p class="text-xs font-bold text-amber-600 uppercase">Pendientes</p>'
      +'<p class="text-2xl font-black text-amber-600 mt-1">'+pend+'</p></div>'
    +'<div class="bg-white rounded-xl p-4 border shadow-sm text-center" style="border-color:'+t.color+'30">'
      +'<p class="text-xs font-bold uppercase" style="color:'+t.color+'">Promedio</p>'
      +'<p class="text-2xl font-black mt-1" style="color:'+t.color+'">'+promG+(promG!=='—'?'<span class="text-sm font-normal text-slate-400">/10</span>':'')+'</p></div>'
    +'</div>'
    // Barra de progreso
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">'
    +'<div class="flex justify-between mb-2"><p class="text-sm font-bold text-slate-700">Progreso global</p><span class="text-sm font-black" style="color:'+t.color+'">'+pct+'%</span></div>'
    +'<div class="h-4 bg-slate-100 rounded-full overflow-hidden">'
    +'<div class="h-full rounded-full transition-all duration-700" style="width:'+pct+'%;background:'+t.color+';"></div>'
    +'</div></div>'
    // Tabla de evaluados
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">'
    +'<div class="px-5 py-3.5 border-b border-slate-100">'
    +'<p class="text-sm font-bold text-slate-700">Detalle por Colaborador</p></div>'
    +'<div class="overflow-x-auto"><table class="w-full text-sm">'
    +'<thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">'
    +'<tr><th class="px-4 py-2.5 text-left">Colaborador</th>'
    +'<th class="px-4 py-2.5 text-center">Rol</th>'
    +'<th class="px-4 py-2.5 text-center">Estatus</th>'
    +'<th class="px-4 py-2.5 text-center">Promedio</th>'
    +'<th class="px-4 py-2.5 text-center">Fecha</th></tr></thead>'
    +'<tbody class="divide-y divide-slate-50">'
    +(rRes.evaluaciones||[]).map(function(ev){
        let s=0,c=0;
        Object.values(ev.respuestas||{}).forEach(function(v){
            const n=parseInt(v); if(!isNaN(n)&&n>=1&&n<=10){s+=n;c++;}
        });
        const prom=c>0?(s/c).toFixed(1):'—';
        const col=parseFloat(prom)>=7?'text-emerald-600':parseFloat(prom)>=5?'text-amber-500':'text-red-500';
        const rolLabel={jefe:'Jefe→Colaborador',autoevaluacion:'Autoevaluación',par:'Par',subordinado:'Subordinado'}[ev.rol]||ev.rol;
        const ini=getIniciales(ev.nombre)||'?';
        const bgCol=avatarColor(ev.nombre);
        return '<tr class="hover:bg-slate-50">'
            +'<td class="px-4 py-2.5"><div class="flex items-center gap-2">'
            +'<div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+bgCol+';">'+ini+'</div>'
            +'<span class="font-medium text-slate-700 text-xs">'+ev.nombre+'</span></div></td>'
            +'<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">'+rolLabel+'</span></td>'
            +'<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold '+(ev.estatus==='Completada'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')+'">'+ev.estatus+'</span></td>'
            +'<td class="px-4 py-2.5 text-center font-bold text-sm '+col+'">'+prom+(prom!=='—'?'/10':'')+'</td>'
            +'<td class="px-4 py-2.5 text-center text-xs text-slate-400">'+(ev.fechaComp?new Date(ev.fechaComp).toLocaleDateString('es-MX'):'—')+'</td>'
            +'</tr>';
    }).join('')
    +'</tbody></table></div></div>';
}

// ── ADMINISTRACIÓN ───────────────────────────────────────────
async function renderAdminEval(cont) {
    const r = await enviarPeticion('listar_procesos_eval',{ token: getToken() });
    const procesos = r.status==='success' ? (r.procesos||[]) : [];

    cont.innerHTML =
    '<div class="flex items-center justify-between mb-5">'
    +'<h3 class="text-base font-bold text-slate-800">Procesos de Evaluación</h3>'
    +'<button onclick="abrirCrearProceso()" class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm">'
    +'<i class="fas fa-plus"></i> Nuevo proceso</button>'
    +'</div>'
    // Filtros de tipo
    +'<div class="flex gap-2 mb-4 flex-wrap">'
    +['Todos','Borrador','Activo','Cerrado'].map(function(est){
        return '<button data-est="'+est+'" class="proc-filter-btn text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition">'+est+'</button>';
            +est+'</button>';
    }).join('')
    +'</div>'
    // Lista de procesos
    +'<div id="lista-procesos-eval" class="space-y-3">'
    +renderListaProcesos(procesos)
    +'</div>';

    window._procesosEval = procesos;
    // Event delegation para filtros de proceso
    setTimeout(function(){
        var wrap=document.getElementById('eval-contenido');
        if(wrap){
            wrap.addEventListener('click',function(e){
                var fb=e.target.closest('.proc-filter-btn');
                if(fb) filtrarProcesosEval(fb, fb.dataset.est||'Todos');
                var pb=e.target.closest('.proc-act-btn');
                if(pb){
                    var pid=pb.dataset.pid, act=pb.dataset.action;
                    if(act==='editar')    editarProcesoEval(pid);
                    if(act==='activar')   activarProcesoEval(pid);
                    if(act==='resultados') verResultadosEval(pid);
                    if(act==='cerrar')    confirmarCerrarProceso(pid);
                }
                var eb=e.target.closest('.eval-form-btn');
                if(eb) abrirFormularioEval(eb.dataset.evid, eb.dataset.proc);
            });
        }
    },100);
    // Event delegation para botones Evaluar
    setTimeout(function(){
        var c=document.getElementById('eval-contenido');
        if(c) c.addEventListener('click',function(e){
            var btn=e.target.closest('.eval-form-btn');
            if(btn) abrirFormularioEval(btn.dataset.evid, btn.dataset.proc);
        });
    },100);
}

function renderListaProcesos(procesos) {
    if(!procesos.length){
        return '<div class="text-center py-12 text-slate-400">'
            +'<i class="fas fa-clipboard text-3xl mb-2 block text-slate-200"></i>'
            +'<p class="text-sm">Sin procesos. Crea el primero con "Nuevo proceso".</p></div>';
    }
    return procesos.map(function(p){
        const t = EVAL_TIPOS[p.tipo] || EVAL_TIPOS.desempeno;
        const statCol = p.estatus==='Activo'?'bg-emerald-100 text-emerald-700'
            :p.estatus==='Cerrado'?'bg-slate-100 text-slate-500'
            :'bg-amber-100 text-amber-700';
        return '<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-violet-200 transition">'
            +'<div class="flex items-start gap-4">'
            +'<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:'+t.bg+';color:'+t.color+';">'
            +'<i class="fas '+t.icon+'"></i></div>'
            +'<div class="flex-1 min-w-0">'
            +'<div class="flex items-center gap-2 mb-1 flex-wrap">'
            +'<p class="font-bold text-slate-800 text-sm">'+p.nombre+'</p>'
            +'<span class="px-2 py-0.5 rounded-full text-xs font-bold" style="background:'+t.bg+';color:'+t.color+';">'+t.label+'</span>'
            +'<span class="px-2 py-0.5 rounded-full text-xs font-bold '+statCol+'">'+p.estatus+'</span>'
            +'</div>'
            +'<p class="text-xs text-slate-400">'
            +(p.empresa||'Todas las empresas')
            +(p.fechaIni?' · '+p.fechaIni:'')
            +(p.fechaFin?' → '+p.fechaFin:'')
            +'</p>'
            +'</div>'
            +'<div class="flex gap-2 flex-shrink-0">'
            +(p.estatus==='Borrador'
                ?'<button data-pid="'+p.id+'" data-action="editar" class="proc-act-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition flex items-center justify-center"><i class="fas fa-pen text-xs pointer-events-none"></i></button>'
                +'<button data-pid="'+p.id+'" data-action="activar" class="proc-act-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 transition flex items-center justify-center"><i class="fas fa-play text-xs pointer-events-none"></i></button>'
                :'')
            +(p.estatus==='Activo'
                ?'<button data-pid="'+p.id+'" data-action="resultados" class="proc-act-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-600 transition flex items-center justify-center"><i class="fas fa-chart-bar text-xs pointer-events-none"></i></button>'
                +'<button data-pid="'+p.id+'" data-action="cerrar" class="proc-act-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 transition flex items-center justify-center"><i class="fas fa-lock text-xs pointer-events-none"></i></button>'
                :'')
            +'</div></div></div>';
    }).join('');
}

function filtrarProcesosEval(btn, estatus) {
    document.querySelectorAll('.proc-filter-btn').forEach(function(b){
        b.classList.remove('bg-violet-600','text-white','border-violet-600');
        b.classList.add('border-slate-200','text-slate-500');
    });
    btn.classList.add('bg-violet-600','text-white','border-violet-600');
    btn.classList.remove('border-slate-200','text-slate-500');
    const todos = window._procesosEval || [];
    const filt  = estatus==='Todos' ? todos : todos.filter(function(p){ return p.estatus===estatus; });
    const lista = document.getElementById('lista-procesos-eval');
    if(lista) lista.innerHTML = renderListaProcesos(filt);
}

// ── Crear proceso ─────────────────────────────────────────────
function abrirCrearProceso() {
    Swal.fire({
        title:'Nuevo proceso de evaluación',
        html:
        '<div style="text-align:left;">'
        +'<label style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Nombre</label>'
        +'<input id="np-nombre" class="swal2-input" style="margin:0 0 12px;width:100%;box-sizing:border-box;" placeholder="Ej. Evaluación Desempeño Q1 2025">'
        +'<label style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Tipo de evaluación</label>'
        +'<select id="np-tipo" class="swal2-select" style="margin:0 0 12px;width:100%;box-sizing:border-box;">'
        +'<option value="desempeno">Desempeño (1-10)</option>'
        +'<option value="360">360° (1-10)</option>'
        +'<option value="competencias">Competencias</option>'
        +'</select>'
        +'<label style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Empresa (vacío = todas)</label>'
        +'<input id="np-empresa" class="swal2-input" style="margin:0 0 12px;width:100%;box-sizing:border-box;" placeholder="Dejar vacío para todas">'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
        +'<div><label style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Fecha inicio</label>'
        +'<input id="np-ini" type="date" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;"></div>'
        +'<div><label style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#64748b;display:block;margin-bottom:4px;">Fecha cierre</label>'
        +'<input id="np-fin" type="date" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box;"></div>'
        +'</div></div>',
        showCancelButton:true,
        confirmButtonText:'Crear proceso',
        confirmButtonColor:'#7c3aed',
        cancelButtonText:'Cancelar',
        preConfirm: async function(){
            const nombre  = document.getElementById('np-nombre').value.trim();
            const tipo    = document.getElementById('np-tipo').value;
            const empresa = document.getElementById('np-empresa').value.trim();
            const fechaIni= document.getElementById('np-ini').value;
            const fechaFin= document.getElementById('np-fin').value;
            if(!nombre){ Swal.showValidationMessage('El nombre es requerido'); return false; }
            const r = await enviarPeticion('crear_proceso_eval',{ token:getToken(), nombre, tipo, empresa, fechaIni, fechaFin });
            if(r.status!=='success'){ Swal.showValidationMessage(r.message); return false; }
            return r;
        }
    }).then(function(result){
        if(result.isConfirmed){
            mostrarToast('success','Proceso creado','Se creó correctamente. Ahora puedes editar las preguntas y activarlo.',5000);
            renderAdminEval(document.getElementById('eval-contenido'));
        }
    });
}

// ── Editar proceso (preguntas) ────────────────────────────────
async function editarProcesoEval(id) {
    const r = await enviarPeticion('obtener_proceso_eval',{ id });
    if(r.status!=='success'){ mostrarToast('error','Error',r.message); return; }
    _evalProcesoActual = r.proceso;
    abrirEditorEval(r.proceso);
}

function abrirEditorEval(proceso) {
    let overlay = document.getElementById('editor-eval-overlay');
    if(!overlay){
        overlay = document.createElement('div');
        overlay.id = 'editor-eval-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;background:#f8f7ff;overflow:hidden;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    const est   = proceso.estructura || {};
    const bloqs = est.bloques || [];
    const tipo  = proceso.tipo;
    const t     = EVAL_TIPOS[tipo] || EVAL_TIPOS.desempeno;
    const totalPregs = bloqs.reduce(function(s,b){ return s+(b.preguntas||[]).length; },0);

    overlay.innerHTML =
    // Header
    '<div style="background:#0d1b3e;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +'<div style="display:flex;align-items:center;gap:12px;">'
    +'<button onclick="cerrarEditorEval()" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:34px;height:34px;border-radius:8px;cursor:pointer;">'
    +'<i class="fas fa-arrow-left"></i></button>'
    +'<div><p style="font-weight:800;font-size:1rem;margin:0;">'+proceso.nombre+'</p>'
    +'<p style="font-size:.7rem;color:rgba(255,255,255,.5);margin:0;">'+bloqs.length+' bloques · '+totalPregs+' preguntas · '+t.label+'</p>'
    +'</div></div>'
    +'<div style="display:flex;gap:8px;">'
    +'<button onclick="agregarBloqueEval()" style="background:rgba(124,58,237,.3);border:1px solid rgba(124,58,237,.5);color:#c4b5fd;padding:8px 16px;border-radius:10px;cursor:pointer;font-size:.8rem;font-weight:700;">'
    +'<i class="fas fa-plus mr-1"></i> Bloque</button>'
    +'<button onclick="guardarEditorEval()" id="btn-guardar-eval" style="background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:#fff;padding:8px 20px;border-radius:10px;cursor:pointer;font-size:.8rem;font-weight:700;">'
    +'<i class="fas fa-save mr-1"></i> Guardar</button>'
    +'</div></div>'
    // Área scrollable
    +'<div id="eval-editor-bloques" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;">'
    +renderBloquesEditorEval()
    +'</div>';
}

function renderBloquesEditorEval() {
    const bloqs = (_evalProcesoActual?.estructura?.bloques)||[];
    const tipo  = _evalProcesoActual?.tipo || 'desempeno';

    if(!bloqs.length){
        return '<div style="text-align:center;padding:48px;color:#94a3b8;">'
            +'<i class="fas fa-layer-group" style="font-size:3rem;margin-bottom:12px;display:block;"></i>'
            +'<p>Sin bloques. Haz clic en <strong>+ Bloque</strong> para comenzar.</p></div>';
    }

    return bloqs.map(function(bloque, bi){
        const nPregs = (bloque.preguntas||[]).length;
        return '<div style="background:#fff;border-radius:14px;border:1.5px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.04);">'
        // Header bloque
        +'<div style="background:linear-gradient(135deg,#f8f7ff,#f0ebff);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e9e3ff;border-radius:14px 14px 0 0;">'
        +'<div style="display:flex;align-items:center;gap:10px;flex:1;">'
        +'<input type="text" value="'+(bloque.titulo||'').replace(/"/g,'&quot;')+'" '
        +'oninput="_evalProcesoActual.estructura.bloques['+bi+'].titulo=this.value" '
        +'style="flex:1;border:1.5px solid #ddd6fe;border-radius:8px;padding:6px 10px;font-weight:700;font-size:.9rem;">'
        +'<span style="font-size:.75rem;color:#8b5cf6;font-weight:600;">'+nPregs+' preg.</span>'
        +'</div>'
        +'<div style="display:flex;gap:6px;margin-left:10px;">'
        +(bi>0?'<button onclick="moverBloqueEval('+bi+',-1)" style="'+btnIconStyle('slate')+'" title="Subir"><i class="fas fa-chevron-up"></i></button>':'')
        +(bi<bloqs.length-1?'<button onclick="moverBloqueEval('+bi+',1)" style="'+btnIconStyle('slate')+'" title="Bajar"><i class="fas fa-chevron-down"></i></button>':'')
        +'<button onclick="agregarPregEval('+bi+')" style="'+btnIconStyle('violet')+'" title="Agregar pregunta"><i class="fas fa-plus"></i></button>'
        +'<button onclick="eliminarBloqueEval('+bi+')" style="'+btnIconStyle('red')+'" title="Eliminar bloque"><i class="fas fa-trash"></i></button>'
        +'</div></div>'
        // Preguntas
        +'<div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:10px;">'
        +((bloque.preguntas||[]).length===0
            ?'<div style="text-align:center;padding:20px;color:#94a3b8;font-size:.85rem;border:1.5px dashed #e2e8f0;border-radius:10px;">Sin preguntas — haz clic en <strong style="color:#7c3aed;">+</strong> para agregar.</div>'
            :(bloque.preguntas||[]).map(function(preg,pi){ return renderPregEditorEval(bi,pi,preg,tipo); }).join('')
        )
        +'</div></div>';
    }).join('');
}

function renderPregEditorEval(bi, pi, preg, tipo) {
    var tipos = tipo==='competencias'
        ? [{val:'competencia',label:'Competencia'},{val:'abierta',label:'Comentario'}]
        : [{val:'escala10',label:'Escala 1-10'},{val:'abierta',label:'Respuesta abierta'}];

    var tipoSel = '<select onchange="cambiarTipoPregEval('+bi+','+pi+',this.value)" '
        +'style="border:1.5px solid #e2e8f0;border-radius:7px;padding:4px 8px;font-size:.75rem;color:#475569;background:#fff;">';
    tipos.forEach(function(t){ tipoSel += '<option value="'+t.val+'"'+(preg.tipo===t.val?' selected':'')+'>'+t.label+'</option>'; });
    tipoSel += '</select>';

    var html = '<div style="border:1.5px solid #f1f5f9;border-radius:10px;padding:12px;background:#fafafa;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<span style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:.65rem;font-weight:800;border-radius:6px;padding:2px 7px;">'+(pi+1)+'</span>';
    html += tipoSel;
    html += '<div style="flex:1;"></div>';
    html += (pi>0?'<button onclick="moverPregEval('+bi+','+pi+',-1)" style="'+btnIconStyle('slate')+'" title="Subir"><i class="fas fa-chevron-up"></i></button>':'');
    html += (pi<((_evalProcesoActual?.estructura?.bloques[bi]?.preguntas)||[]).length-1
        ?'<button onclick="moverPregEval('+bi+','+pi+',1)" style="'+btnIconStyle('slate')+'" title="Bajar"><i class="fas fa-chevron-down"></i></button>':'');
    html += '<button onclick="eliminarPregEval('+bi+','+pi+')" style="'+btnIconStyle('red')+'"><i class="fas fa-trash text-xs"></i></button>';
    html += '</div>';
    html += '<textarea oninput="_evalProcesoActual.estructura.bloques['+bi+'].preguntas['+pi+'].texto=this.value" '
        +'style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:.88rem;resize:vertical;min-height:52px;font-family:inherit;" '
        +'placeholder="Escribe la pregunta o competencia...">'+(preg.texto||'')+'</textarea>';
    html += '</div>';
    return html;
}

// ── Acciones del editor ───────────────────────────────────────
function agregarBloqueEval() {
    if(!_evalProcesoActual) return;
    if(!_evalProcesoActual.estructura) _evalProcesoActual.estructura = {bloques:[]};
    _evalProcesoActual.estructura.bloques.push({titulo:'Nuevo bloque',preguntas:[]});
    actualizarEditorEval();
}
function eliminarBloqueEval(bi) {
    if(!confirm('¿Eliminar este bloque y sus preguntas?')) return;
    _evalProcesoActual.estructura.bloques.splice(bi,1);
    actualizarEditorEval();
}
function moverBloqueEval(bi,dir) {
    var b=_evalProcesoActual.estructura.bloques; var t=bi+dir;
    if(t<0||t>=b.length) return;
    var tmp=b[bi]; b[bi]=b[t]; b[t]=tmp; actualizarEditorEval();
}
function agregarPregEval(bi) {
    var tipo=_evalProcesoActual.tipo==='competencias'?'competencia':'escala10';
    _evalProcesoActual.estructura.bloques[bi].preguntas.push({tipo:tipo,texto:''});
    actualizarEditorEval();
}
function eliminarPregEval(bi,pi) {
    _evalProcesoActual.estructura.bloques[bi].preguntas.splice(pi,1);
    actualizarEditorEval();
}
function moverPregEval(bi,pi,dir) {
    var p=_evalProcesoActual.estructura.bloques[bi].preguntas; var t=pi+dir;
    if(t<0||t>=p.length) return;
    var tmp=p[pi]; p[pi]=p[t]; p[t]=tmp; actualizarEditorEval();
}
function cambiarTipoPregEval(bi,pi,tipo) {
    _evalProcesoActual.estructura.bloques[bi].preguntas[pi].tipo=tipo;
    actualizarEditorEval();
}
function actualizarEditorEval() {
    var c=document.getElementById('eval-editor-bloques');
    if(c) c.innerHTML=renderBloquesEditorEval();
}
async function guardarEditorEval() {
    var btn=document.getElementById('btn-guardar-eval');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';}
    var r=await enviarPeticion('actualizar_proceso_eval',{
        token:getToken(), id:_evalProcesoActual.id,
        estructura:_evalProcesoActual.estructura
    });
    if(r.status==='success'){
        mostrarToast('success','Guardado','Proceso actualizado correctamente.');
        cerrarEditorEval();
        renderAdminEval(document.getElementById('eval-contenido'));
    } else { mostrarToast('error','Error',r.message); }
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save mr-1"></i> Guardar';}
}
function cerrarEditorEval() {
    var o=document.getElementById('editor-eval-overlay');
    if(o) o.style.display='none';
}

// ── Activar proceso ──────────────────────────────────────────
async function activarProcesoEval(id) {
    const conf = await Swal.fire({
        title:'¿Activar el proceso?',
        text:'Se generarán evaluaciones automáticamente basándose en los Jefes Directos asignados.',
        icon:'question',
        showCancelButton:true,
        confirmButtonText:'Sí, activar',
        confirmButtonColor:'#059669',
        cancelButtonText:'Cancelar'
    });
    if(!conf.isConfirmed) return;

    const r = await enviarPeticion('activar_proceso_eval',{ token:getToken(), id });
    if(r.status==='success'){
        mostrarToast('success','Proceso activado',r.message,6000);
        renderAdminEval(document.getElementById('eval-contenido'));
    } else { mostrarToast('error','Error',r.message); }
}

async function confirmarCerrarProceso(id) {
    const conf = await Swal.fire({
        title:'¿Cerrar el proceso?',
        text:'Ya no se podrán llenar más evaluaciones.',
        icon:'warning',
        showCancelButton:true,
        confirmButtonText:'Cerrar proceso',
        confirmButtonColor:'#ef4444',
        cancelButtonText:'Cancelar'
    });
    if(!conf.isConfirmed) return;
    const r = await enviarPeticion('cerrar_proceso_eval',{ token:getToken(), id });
    if(r.status==='success'){
        mostrarToast('success','Proceso cerrado','');
        renderAdminEval(document.getElementById('eval-contenido'));
    }
}

function verResultadosEval(id) {
    const sel = document.getElementById('inf-eval-sel');
    activarTabEval('informes', document.querySelector('.eval-tab[data-tab="informes"]'));
    setTimeout(function(){
        const s=document.getElementById('inf-eval-sel');
        if(s){ s.value=id; cargarInformeEval(id); }
    },500);
}

// ── Formulario de evaluación ─────────────────────────────────
async function abrirFormularioEval(idEval, idProceso) {
    const r = await enviarPeticion('obtener_proceso_eval',{ id: idProceso });
    if(r.status!=='success'){ mostrarToast('error','Error',r.message); return; }

    const proceso = r.proceso;
    const est     = proceso.estructura || {};
    const tipo    = proceso.tipo;

    let overlay = document.getElementById('form-eval-overlay');
    if(!overlay){
        overlay = document.createElement('div');
        overlay.id = 'form-eval-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;background:#f8f7ff;overflow:hidden;';
        document.body.appendChild(overlay);
    }
    overlay.style.display='flex';
    overlay.innerHTML = renderFormularioEval(proceso, idEval);
    // Event delegation para opciones de evaluación y envío
    overlay.addEventListener('click', function(e){
        var sb=e.target.closest('.eval-submit-btn');
        if(sb) enviarEvaluacion(sb.dataset.ideval, parseInt(sb.dataset.total));
        var opt = e.target.closest('.eval-opt');
        if(opt){ selEvalOpt(opt, opt.dataset.q, parseInt(opt.dataset.v), opt.dataset.col); }
        var opc = e.target.closest('.eval-opt-comp');
        if(opc){ selEvalComp(opc, opc.dataset.q, parseInt(opc.dataset.v), opc.dataset.col); }
    });
}

function renderFormularioEval(proceso, idEval) {
    const est   = proceso.estructura || {};
    const tipo  = proceso.tipo;
    const bloqs = est.bloques || [];
    let gq = 0;
    let pregsHTML = '';

    bloqs.forEach(function(bloque, bi){
        pregsHTML += '<div style="background:#fff;border-radius:14px;border:1.5px solid #ede9fe;padding:20px;margin-bottom:16px;">'
            +'<p style="font-size:.95rem;font-weight:800;color:#0d1b3e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #ede9fe;">'
            +'<span style="font-size:1.2rem;margin-right:8px;">'+(bi+1)+'.</span>'+bloque.titulo+'</p>';

        (bloque.preguntas||[]).forEach(function(preg,pi){
            gq++;
            pregsHTML += '<div style="margin-bottom:20px;">'
                +'<p style="font-size:.85rem;color:#475569;margin:0 0 10px;"><strong style="color:#7c3aed;">'+gq+'.</strong> '+preg.texto+'</p>';

            if(preg.tipo==='escala10'){
                // Grid de botones 1-10
                pregsHTML += '<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;" id="grid-'+gq+'">';
                for(var v=1;v<=10;v++){
                    var col=v<=3?'#ef4444':v<=5?'#f59e0b':v<=7?'#3b82f6':'#10b981';
                    pregsHTML += '<label style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">'
                        +'<input type="radio" name="eq'+gq+'" value="'+v+'" style="display:none;" onchange="onRespEval('+gq+')">'
                        +'<span class="eval-opt" data-q="'+gq+'" data-v="'+v+'" data-col="'+col+'" '
                        +'style="width:100%;min-width:24px;aspect-ratio:1;border-radius:8px;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#94a3b8;cursor:pointer;transition:all .15s;">'+v+'</span>'
                        +'</label>';
                }
                pregsHTML += '</div>'
                    +'<div style="display:flex;justify-content:space-between;margin-top:4px;">'
                    +'<span style="font-size:.65rem;color:#ef4444;">Muy bajo</span>'
                    +'<span style="font-size:.65rem;color:#10b981;">Excelente</span></div>';
            } else if(preg.tipo==='competencia'){
                const opts=est.opcionesCompetencia||[
                    {valor:1,etiqueta:'No desarrollada'},{valor:2,etiqueta:'En desarrollo'},
                    {valor:3,etiqueta:'Desarrollada'},{valor:4,etiqueta:'Sobresaliente'}
                ];
                pregsHTML += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;" id="grid-'+gq+'">';
                opts.forEach(function(op){
                    var col=op.valor===1?'#ef4444':op.valor===2?'#f59e0b':op.valor===3?'#3b82f6':'#10b981';
                    pregsHTML += '<label style="cursor:pointer;">'
                        +'<input type="radio" name="eq'+gq+'" value="'+op.valor+'" style="display:none;" onchange="onRespEval('+gq+')">'
                        +'<span class="eval-opt-comp" data-q="'+gq+'" data-v="'+op.valor+'" data-col="'+col+'" '
                        +'style="display:block;padding:8px 12px;border-radius:10px;border:2px solid #e2e8f0;font-size:.8rem;font-weight:600;color:#64748b;cursor:pointer;transition:all .15s;">'+op.etiqueta+'</span>'
                        +'</label>';
                });
                pregsHTML += '</div>';
            } else {
                pregsHTML += '<textarea name="eq'+gq+'" id="ta-'+gq+'" oninput="onRespEval('+gq+')" '
                    +'style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:.88rem;resize:vertical;min-height:80px;font-family:inherit;" '
                    +'placeholder="Escribe tu respuesta..."></textarea>';
            }

            pregsHTML += '</div>';
        });
        pregsHTML += '</div>';
    });

    return '<div style="background:#0d1b3e;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
        +'<div style="display:flex;align-items:center;gap:12px;">'
        +'<button onclick="cerrarFormularioEval()" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:34px;height:34px;border-radius:8px;cursor:pointer;">'
        +'<i class="fas fa-arrow-left"></i></button>'
        +'<div><p style="font-weight:800;font-size:1rem;margin:0;">'+proceso.nombre+'</p>'
        +'<p style="font-size:.7rem;color:rgba(255,255,255,.5);margin:0;" id="form-eval-progreso">0 de '+gq+' respondidas</p>'
        +'</div></div>'
        +'<button id="btn-enviar-eval" data-ideval="'+idEval+'" data-total="'+gq+'" class="eval-submit-btn" '
        +'style="background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:#fff;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:.85rem;font-weight:700;">'
        +'<i class="fas fa-paper-plane mr-1"></i> Enviar</button>'
        +'<i class="fas fa-paper-plane mr-1"></i> Enviar</button>'
        +'</div>'
        +'<div style="flex:1;overflow-y:auto;padding:20px;max-width:720px;margin:0 auto;width:100%;">'
        +pregsHTML
        +'</div>';
}

let _evalRespuestas = {};
function selEvalOpt(el, qn, v, col) {
    document.querySelectorAll('.eval-opt[data-q="'+qn+'"]').forEach(function(opt){
        opt.style.borderColor='#e2e8f0'; opt.style.background=''; opt.style.color='#94a3b8';
    });
    el.style.borderColor=col; el.style.background=col+'20'; el.style.color=col;
    _evalRespuestas['q'+qn]=v; onRespEval(qn);
}
function selEvalComp(el, qn, v, col) {
    document.querySelectorAll('.eval-opt-comp[data-q="'+qn+'"]').forEach(function(opt){
        opt.style.borderColor='#e2e8f0'; opt.style.background=''; opt.style.color='#64748b';
    });
    el.style.borderColor=col; el.style.background=col+'15'; el.style.color=col;
    _evalRespuestas['q'+qn]=v; onRespEval(qn);
}
function onRespEval(qn) {
    const ta=document.getElementById('ta-'+qn);
    if(ta) _evalRespuestas['q'+qn]=ta.value;
    const total=parseInt(document.getElementById('form-eval-progreso')?.textContent?.split('de')[1])||0;
    const resp=Object.keys(_evalRespuestas).filter(function(k){ return _evalRespuestas[k]!==undefined&&_evalRespuestas[k]!==''; }).length;
    const el=document.getElementById('form-eval-progreso');
    if(el) el.textContent=resp+' de '+total+' respondidas';
}

async function enviarEvaluacion(idEval, totalPregs) {
    _evalRespuestas={};
    // Recopilar textareas
    document.querySelectorAll('[name^="eq"]').forEach(function(inp){
        if(inp.type==='radio'&&inp.checked) _evalRespuestas['q'+inp.name.replace('eq','')]=inp.value;
        if(inp.tagName==='TEXTAREA'&&inp.value.trim()) _evalRespuestas['q'+inp.name.replace('eq','')]=inp.value.trim();
    });
    // Incluir selecciones de escala10 y competencias
    document.querySelectorAll('.eval-opt[style*="border-color"],.eval-opt-comp[style*="border-color"]').forEach(function(el){
        if(el.dataset.q&&el.dataset.v) _evalRespuestas['q'+el.dataset.q]=parseInt(el.dataset.v);
    });

    const resp=Object.keys(_evalRespuestas).length;
    if(resp<Math.ceil(totalPregs*0.7)){
        if(!confirm('Has respondido '+resp+' de '+totalPregs+' preguntas. ¿Enviar de todas formas?')) return;
    }

    const btn=document.getElementById('btn-enviar-eval');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i> Enviando...';}

    const r=await enviarPeticion('guardar_eval',{token:getToken(),idEval,respuestas:_evalRespuestas});
    if(r.status==='success'){
        cerrarFormularioEval();
        mostrarToast('success','Evaluación enviada','Tu evaluación fue registrada correctamente.',5000);
        cargarModuloEvaluaciones();
    } else { mostrarToast('error','Error',r.message); }
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane mr-1"></i> Enviar';}
}

function cerrarFormularioEval() {
    const o=document.getElementById('form-eval-overlay');
    if(o) o.style.display='none';
    _evalRespuestas={};
}

let encTabActual = 'SALIDA';

const ENC_TIPOS = {
  SALIDA:  { nombre:'Encuesta de Salida',       icono:'fa-door-open',      color:'text-violet-600' },
  CLIMA:   { nombre:'Clima Laboral',             icono:'fa-cloud-sun',      color:'text-blue-600'   },
  DESEMPE: { nombre:'Evaluación de Desempeño',   icono:'fa-chart-line',     color:'text-emerald-600'},
  CAPAC:   { nombre:'Detección de Capacitación', icono:'fa-graduation-cap', color:'text-amber-600'  },
  PULSO:   { nombre:'Encuesta de Pulso',         icono:'fa-heartbeat',      color:'text-rose-600'   },
  NOM035:  { nombre:'NOM-035 (Riesgo Psicosocial)', icono:'fa-shield-heart', color:'text-red-600'    },
};

async function cargarModuloEncuestas(){
    activarTabEncuesta(encTabActual,
        document.querySelector('.enc-tab.active') || document.querySelector('.enc-tab'));
}

// Cache de respuestas por encuesta para no recargar al cambiar tabs
const _encCache = {};
let _encCacheTime = {};

async function activarTabEncuesta(encId, btnEl){
    encTabActual = encId;
    document.querySelectorAll('.enc-tab').forEach(b=>{
        b.classList.remove('active','border-violet-600','text-violet-700','bg-violet-50');
        b.classList.add('border-transparent','text-slate-500');
    });
    if(btnEl){
        btnEl.classList.add('active','border-violet-600','text-violet-700','bg-violet-50');
        btnEl.classList.remove('border-transparent','text-slate-500');
    }
    const cont = document.getElementById('enc-contenido');
    if(!cont) return;
    // Reinicia la animación de entrada en cada cambio de pestaña (el div es
    // persistente, así que solo agregar la clase no la vuelve a disparar)
    cont.classList.remove('tab-fade'); void cont.offsetWidth; cont.classList.add('tab-fade');

    // NOM-035 tiene su propio flujo (endpoint dedicado que ya calcula
    // puntajes/dominios/niveles con filtros del lado del servidor) — no
    // usa el genérico listar_respuestas ni el cache _encCache.
    if (encId === 'NOM035') { renderModuloNOM035(cont); return; }

    // Usar cache si tiene menos de 5 minutos
    const ahora = Date.now();
    const cacheValido = _encCache[encId] && _encCacheTime[encId] && (ahora - _encCacheTime[encId] < 5*60*1000);
    if(cacheValido){
        renderizarResultadoEncuesta(encId, _encCache[encId], cont);
        return;
    }

    cont.innerHTML = '<div class="flex items-center justify-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';

    // Cargar respuestas
    const r = await enviarPeticion('listar_respuestas', { token: getToken(), encId });
    if(r.status !== 'success'){
        cont.innerHTML = '<p class="text-sm text-red-400 text-center py-12">'+r.message+'</p>';
        return;
    }
    // Usar dashboard especializado para Clima
    // Guardar en cache
    _encCache[encId] = r.respuestas || [];
    _encCacheTime[encId] = Date.now();
    renderizarResultadoEncuesta(encId, r.respuestas || [], cont);
}

function renderizarResultadoEncuesta(encId, respuestas, cont){
    if(encId === 'CLIMA') {
        const link = location.origin + '/encuesta.html?enc=CLIMA';
        if(!window._climaEncData){
            enviarPeticion('obtener_encuesta',{encId:'CLIMA'}).then(function(enc){
                if(enc.status==='success') window._climaEncData = enc.encuesta;
                renderizarDashboardClima(respuestas, cont, link);
            }).catch(function(){ renderizarDashboardClima(respuestas, cont, link); });
        } else {
            renderizarDashboardClima(respuestas, cont, link);
        }
    } else {
        renderizarDashboardEncuesta(encId, respuestas, cont);
    }
}

// ══════════════════════════════════════════════════════════════
//  MÓDULO NOM-035 — Riesgo Psicosocial (Guía I / Guía II)
// ══════════════════════════════════════════════════════════════
// Colores/niveles espejo de Código.gs (NOM035_NIVELES) — se duplica aquí
// porque el front necesita colorear promedios agregados (heatmap por
// dominio) que el backend no devuelve pre-coloreados, solo los números.
// Si алgún día cambian los cortes, actualizar en AMBOS lados.
const NOM035_NIVELES_UI = [
  { nivel:"Nulo o Despreciable", min:0,  max:20,  color:"#16a34a", bg:"#f0fdf4", borde:"#bbf7d0" },
  { nivel:"Bajo",                min:21, max:45,  color:"#65a30d", bg:"#f7fee7", borde:"#d9f99d" },
  { nivel:"Medio",               min:46, max:70,  color:"#d97706", bg:"#fffbeb", borde:"#fde68a" },
  { nivel:"Alto",                min:71, max:90,  color:"#ea580c", bg:"#fff7ed", borde:"#fed7aa" },
  { nivel:"Muy alto",            min:91, max:999999, color:"#dc2626", bg:"#fef2f2", borde:"#fecaca" },
];
function _nivelNOM035_UI(puntaje){
  for (const n of NOM035_NIVELES_UI) if (puntaje >= n.min && puntaje <= n.max) return n;
  return NOM035_NIVELES_UI[NOM035_NIVELES_UI.length-1];
}

// Estado del módulo (persiste al cambiar de sub-tab dentro de NOM035)
window._nom035Sub = window._nom035Sub || 'dashboard'; // 'dashboard' | 'colormetria'
window._nom035Filtros = window._nom035Filtros || { anio:'ALL', mes:'ALL', empresa:'ALL', grupo:'ALL', tipoCuestionario:'ALL' };
window._nom035NivelFiltro = window._nom035NivelFiltro || ''; // filtro rápido desde las tarjetas de leyenda
window._nom035Data = null; // último resultado del backend (cacheado hasta refrescar filtros)
window._nom035ExpandidoId = null; // idInterno de la fila de empleado expandida en la tabla

async function renderModuloNOM035(cont){
    cont.innerHTML = '<div class="flex items-center justify-center py-16 text-slate-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
    const link = location.origin + '/nom035.html';

    const f = window._nom035Filtros;
    const payload = {
        token: getToken(),
        anio:   f.anio  !== 'ALL' ? f.anio  : '',
        mes:    f.mes   !== 'ALL' ? f.mes   : '',
        empresa: f.empresa !== 'ALL' ? f.empresa : '',
        grupoComercial: f.grupo !== 'ALL' ? f.grupo : '',
        tipoCuestionario: f.tipoCuestionario !== 'ALL' ? f.tipoCuestionario : ''
    };
    const r = await enviarPeticion('resultados_nom035', payload);
    if (r.status !== 'success') {
        cont.innerHTML = '<p class="text-sm text-red-400 text-center py-12">'+r.message+'</p>';
        return;
    }
    window._nom035Data = r;

    // Años disponibles para el segmentador (de las respuestas ya traídas al
    // menos una vez sin filtro de año — si el usuario ya filtró por año,
    // usamos cacheGlobal como respaldo de años conocidos del sistema)
    const aniosDisponibles = [...new Set((r.empleados||[]).map(e => e.fecha ? new Date(e.fecha).getFullYear() : null).filter(Boolean))].sort((a,b)=>b-a);

    cont.innerHTML =
      '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">'
      +'<div><h3 class="text-base font-bold text-slate-800 flex items-center gap-2">'
      +'<i class="fas fa-shield-heart text-red-600"></i>NOM-035 — Riesgo Psicosocial</h3>'
      +'<p class="text-xs text-slate-400 mt-0.5">'+r.total+' evaluación(es) · Guía I y Guía II combinadas según tamaño de cada razón social</p></div>'
      +'<div class="flex flex-wrap gap-2">'
      +'<button onclick="copiarLinkEncuesta(\''+link+'\')" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg transition"><i class="fas fa-link"></i> Copiar link</button>'
      +'<a href="'+link+'" target="_blank" class="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition"><i class="fas fa-external-link-alt"></i> Ver encuesta</a>'
      +'<button onclick="exportarNOM035Excel()" class="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition"><i class="fas fa-file-excel"></i> Excel</button>'
+'<button onclick="exportarNOM035CSV()" class="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"><i class="fas fa-file-csv"></i> CSV</button>'
+'<button onclick="abrirConfigNOM035()" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition"><i class="fas fa-cog"></i> Config</button>'
      +'</div></div>'
      // Sub-tabs internos (Dashboard / Colormetría)
      +'<div class="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">'
      +'<button onclick="cambiarSubTabNOM035(\'dashboard\')" data-sub="dashboard" class="nom035-subtab px-4 py-2 rounded-lg text-xs font-bold transition">'
      +'<i class="fas fa-chart-pie mr-1.5"></i>Dashboard General</button>'
      +'<button onclick="cambiarSubTabNOM035(\'colormetria\')" data-sub="colormetria" class="nom035-subtab px-4 py-2 rounded-lg text-xs font-bold transition">'
      +'<i class="fas fa-palette mr-1.5"></i>Colormetría y Resultados</button>'
      +'</div>'
      // Barra de segmentadores (compartida por ambos sub-tabs)
      +'<div class="flex flex-wrap gap-2 mb-5 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">'
      +_selectNOM035('nom035-f-anio','anio', ['<option value="ALL">Todos los años</option>'].concat(aniosDisponibles.map(a=>'<option value="'+a+'" '+(f.anio==(''+a)?'selected':'')+'>'+a+'</option>')).join(''))
      +_selectNOM035('nom035-f-mes','mes', '<option value="ALL">Todos los meses</option>'+['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i)=>'<option value="'+m+'" '+(f.mes===m?'selected':'')+'>'+['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][i]+'</option>').join(''))
      +_selectNOM035('nom035-f-grupo','grupo', '<option value="ALL">Todos los grupos</option>'+listaGrupos().map(g=>'<option value="'+g+'" '+(f.grupo===g?'selected':'')+'>'+g+'</option>').join(''))
      +_selectNOM035('nom035-f-empresa','empresa', '<option value="ALL">Todas las razones sociales</option>'+empresas.map(e=>'<option value="'+e+'" '+(f.empresa===e?'selected':'')+'>'+e+'</option>').join(''))
      +_selectNOM035('nom035-f-tipo','tipoCuestionario', '<option value="ALL">Todos los cuestionarios</option><option value="guia1" '+(f.tipoCuestionario==='guia1'?'selected':'')+'>Guía I (&lt;50 trabajadores)</option><option value="guia2" '+(f.tipoCuestionario==='guia2'?'selected':'')+'>Guía II (&ge;50 trabajadores)</option>')
      +'<button onclick="limpiarFiltrosNOM035()" class="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition flex items-center gap-1.5"><i class="fas fa-filter-circle-xmark text-xs"></i>Limpiar</button>'
      +'</div>'
      +'<div id="nom035-sub-contenido"></div>';

    // Listeners de filtros — cualquier cambio vuelve a pedir al backend
    ['anio','mes','grupo','empresa','tipo'].forEach(function(key){
        const el = document.getElementById('nom035-f-'+key);
        if(el) el.addEventListener('change', function(){
            const map = { anio:'anio', mes:'mes', grupo:'grupo', empresa:'empresa', tipo:'tipoCuestionario' };
            window._nom035Filtros[map[key]] = this.value;
            renderModuloNOM035(document.getElementById('enc-contenido'));
        });
    });

    marcarSubTabActivaNOM035();
    renderSubContenidoNOM035();
}

function _selectNOM035(id, name, opciones){
    return '<select id="'+id+'" class="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-red-400 outline-none">'+opciones+'</select>';
}

function limpiarFiltrosNOM035(){
    window._nom035Filtros = { anio:'ALL', mes:'ALL', empresa:'ALL', grupo:'ALL', tipoCuestionario:'ALL' };
    window._nom035NivelFiltro = '';
    renderModuloNOM035(document.getElementById('enc-contenido'));
}

function cambiarSubTabNOM035(sub){
    window._nom035Sub = sub;
    marcarSubTabActivaNOM035();
    renderSubContenidoNOM035();
}

function marcarSubTabActivaNOM035(){
    document.querySelectorAll('.nom035-subtab').forEach(function(b){
        const activo = b.dataset.sub === window._nom035Sub;
        b.className = 'nom035-subtab px-4 py-2 rounded-lg text-xs font-bold transition '
            + (activo ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700');
    });
}

function renderSubContenidoNOM035(){
    const cont = document.getElementById('nom035-sub-contenido');
    if(!cont || !window._nom035Data) return;
    if (window._nom035Sub === 'dashboard') renderNOM035Dashboard(window._nom035Data, cont);
    else renderNOM035Colormetria(window._nom035Data, cont);
}

// ── Sub-tab 1: Dashboard General ───────────────────────────────
function renderNOM035Dashboard(data, cont){
    const total = data.total || 0;
    const emp = data.empleados || [];
    const puntajeProm = emp.length ? (emp.reduce((s,e)=>s+e.puntajeTotal,0)/emp.length) : 0;
    var nivelGlobal = null;
if (data.empleados && data.empleados.length === 1) {
  nivelGlobal = NOM035_NIVELES_UI.find(function(n){ return n.nivel === data.empleados[0].nivel; });
}
var nivelGlobal = null;
    if (emp.length === 1) nivelGlobal = NOM035_NIVELES_UI.find(function(n){ return n.nivel === emp[0].nivel; });
    if (!nivelGlobal) nivelGlobal = _nivelNOM035_UI(puntajeProm);

    // % participación: evaluados vs. plantilla activa total que coincide con los filtros de empresa/grupo
    let elegibles = filtrarPorEmpresasPermitidas(cacheGlobal).filter(function(r){
        if((r["ESTATUS"]||"").trim()!=="Activo") return false;
        const f = window._nom035Filtros;
        if(f.empresa!=='ALL' && (r["EMPRESA"]||"").trim()!==f.empresa) return false;
        if(f.grupo!=='ALL' && _normGrupo(grupoDeEmpresa(r["EMPRESA"]||""))!==_normGrupo(f.grupo)) return false;
        return true;
    }).length;
    const pctPart = elegibles>0 ? Math.round(total/elegibles*100) : 0;

    cont.innerHTML =
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">'
      +'<div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">'
        +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Evaluaciones completadas</p>'
        +'<p class="text-3xl font-black text-slate-800 mt-1">'+total+'</p></div>'
      +'<div class="rounded-xl p-4 border shadow-sm text-center" style="background:'+nivelGlobal.bg+';border-color:'+nivelGlobal.borde+'">'
        +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Nivel de riesgo global</p>'
        +'<p class="text-xl font-black mt-1" style="color:'+nivelGlobal.color+'">'+nivelGlobal.nivel+'</p>'
        +'<p class="text-xs text-slate-400 mt-0.5">Puntaje promedio: '+puntajeProm.toFixed(1)+'</p></div>'
      +'<div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">'
        +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">% Participación</p>'
        +'<p class="text-3xl font-black text-slate-800 mt-1">'+pctPart+'%</p>'
        +'<p class="text-xs text-slate-400 mt-0.5">'+total+' de '+elegibles+' elegibles</p></div>'
      +'</div>'
      +'<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">'
      +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
        +'<p class="text-sm font-bold text-slate-700 mb-4"><i class="fas fa-chart-pie text-red-500 mr-2"></i>Distribución por Nivel de Riesgo</p>'
        +'<div class="relative h-56"><canvas id="chartNOM035Dona"></canvas></div></div>'
      +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">'
        +'<p class="text-sm font-bold text-slate-700 mb-4"><i class="fas fa-table-cells text-red-500 mr-2"></i>Desglose por Dominio (promedio)</p>'
        +'<div id="nom035-heatmap" class="space-y-2"></div></div>'
      +'</div>';

    // Gráfica de dona
    if(window._chartNOM035) { try{window._chartNOM035.destroy();}catch(e){} }
    const distEntries = Object.entries(data.distribucion||{});
    const canvasDona = document.getElementById('chartNOM035Dona');
    if(canvasDona && distEntries.some(([,v])=>v>0)){
        window._chartNOM035 = new Chart(canvasDona.getContext('2d'), {
            type:'doughnut',
            data:{
                labels: distEntries.map(([k])=>k),
                datasets:[{ data: distEntries.map(([,v])=>v), backgroundColor: distEntries.map(([k])=>{
                    const n = NOM035_NIVELES_UI.find(x=>x.nivel===k); return n?n.color:'#94a3b8';
                }), borderWidth:2, borderColor:'#fff' }]
            },
            options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, boxWidth:10, padding:8 } } } }
        });
    } else if(canvasDona){
        canvasDona.parentElement.innerHTML = '<p class="text-xs text-slate-400 text-center pt-16">Sin evaluaciones registradas aún</p>';
    }

    // Heatmap por dominio (barra horizontal coloreada según nivel del promedio)
    const heat = document.getElementById('nom035-heatmap');
    const dominios = Object.entries(data.promediosDominio||{});
    if(heat){
        if(!dominios.length){
            heat.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Sin datos suficientes.</p>';
        } else {
            const maxDom = Math.max(...dominios.map(([,v])=>v), 1);
            heat.innerHTML = dominios.map(function([dom,val]){
                const n = _nivelNOM035_UI(val);
                const w = Math.round(val/maxDom*100);
                return '<div>'
                  +'<div class="flex justify-between items-center mb-1">'
                  +'<span class="text-xs font-semibold text-slate-700">'+dom+'</span>'
                  +'<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="color:'+n.color+';background:'+n.bg+';border:1px solid '+n.borde+'">'+val.toFixed(1)+' · '+n.nivel+'</span>'
                  +'</div>'
                  +'<div class="h-3 bg-slate-100 rounded-full overflow-hidden">'
                  +'<div class="h-full rounded-full transition-all duration-500" style="width:'+w+'%;background:'+n.color+'"></div>'
                  +'</div></div>';
            }).join('');
        }
    }
}

// ── Sub-tab 2: Colormetría y Resultados por Empleado ───────────
function renderNOM035Colormetria(data, cont){
    let emp = data.empleados || [];
    if (window._nom035NivelFiltro) emp = emp.filter(e => e.nivel === window._nom035NivelFiltro);

    cont.innerHTML =
      // Leyenda de colormetría — clicable como filtro rápido
      '<div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">'
      + (data.niveles||NOM035_NIVELES_UI).map(function(n){
          const activo = window._nom035NivelFiltro === n.nivel;
          return '<button onclick="toggleNivelFiltroNOM035(\''+n.nivel.replace(/'/g,"\\'")+'\')" '
            +'class="text-left rounded-xl p-3 border-2 transition '+(activo?'ring-2 ring-offset-1':'')+'" '
            +'style="background:'+n.colorBg+';border-color:'+n.colorBorde+';'+(activo?'box-shadow:0 0 0 2px '+n.color+'':'')+'">'
            +'<p class="text-xs font-black" style="color:'+n.color+'">'+n.nivel+'</p>'
            +'<p class="text-[11px] text-slate-500 mt-0.5">'+n.min+'–'+(n.max>9999?'∞':n.max)+' pts</p>'
            +'<p class="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">'+(n.acciones||'').substring(0,70)+'…</p>'
            +'</button>';
      }).join('')
      +'</div>'
      +(window._nom035NivelFiltro ? '<p class="text-xs text-slate-500 mb-3"><i class="fas fa-filter mr-1"></i>Filtrando por nivel: <strong>'+window._nom035NivelFiltro+'</strong> · <button onclick="toggleNivelFiltroNOM035(\''+window._nom035NivelFiltro.replace(/\'/g,"")+'\')" class="text-red-600 hover:underline">Quitar filtro</button></p>' : '')
      // Tabla acordeón
      +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">'
      +'<div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">'
      +'<p class="text-sm font-bold text-slate-700"><i class="fas fa-users text-slate-400 mr-2"></i>Resultados por Colaborador</p>'
      +'<span class="text-xs text-slate-400">'+emp.length+' resultado(s)</span></div>'
      +'<div id="nom035-tabla-empleados">'+_renderTablaNOM035(emp)+'</div>'
      +'</div>';
}

function toggleNivelFiltroNOM035(nivel){
    window._nom035NivelFiltro = (window._nom035NivelFiltro === nivel) ? '' : nivel;
    renderSubContenidoNOM035();
}

function _renderTablaNOM035(emp){
    if(!emp.length) return '<p class="text-xs text-slate-400 text-center py-10">Sin resultados para este filtro.</p>';
    return emp.map(function(e, idx){
        const ini = getIniciales(e.nombre)||'?';
        const col = avatarColor(e.nombre);
        const expandido = window._nom035ExpandidoId === (e.idInterno+'_'+idx);
        const rowId = e.idInterno+'_'+idx;
        const guiaLabel = e.tipoCuestionario==='guia1' ? 'Guía I' : 'Guía II';
        return '<div class="border-b border-slate-50 last:border-0">'
          +'<div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition" onclick="toggleFilaNOM035(\''+rowId+'\')">'
          +'<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:'+col+'">'+ini+'</div>'
          +'<div class="flex-1 min-w-0">'
          +'<p class="text-sm font-semibold text-slate-800 truncate">'+e.nombre+'</p>'
          +'<p class="text-xs text-slate-400 truncate">'+(e.empresa||'—')+' · <span class="italic">'+guiaLabel+'</span></p></div>'
          +'<span class="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 border" style="color:'+e.color+';background:'+e.colorBg+';border-color:'+e.colorBorde+'">'+e.nivel+' · '+e.puntajeTotal+' pts</span>'
          +'<i class="fas fa-chevron-'+(expandido?'up':'down')+' text-slate-300 text-xs flex-shrink-0"></i>'
          +'</div>'
          +(expandido ? _renderDetalleNOM035(e) : '')
          +'</div>';
    }).join('');
}

function toggleFilaNOM035(rowId){
    window._nom035ExpandidoId = (window._nom035ExpandidoId === rowId) ? null : rowId;
    const cont = document.getElementById('nom035-tabla-empleados');
    if(cont && window._nom035Data){
        let emp = window._nom035Data.empleados || [];
        if (window._nom035NivelFiltro) emp = emp.filter(e => e.nivel === window._nom035NivelFiltro);
        cont.innerHTML = _renderTablaNOM035(emp);
    }
}

function _renderDetalleNOM035(e){
    const dominios = Object.entries(e.porDominio||{});
    return '<div class="px-5 pb-4 pt-1 bg-slate-50" onclick="event.stopPropagation()">'
      +'<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">'
      + dominios.map(function([dom,d]){
          return '<div class="rounded-lg p-2.5 border" style="background:'+d.colorBg+';border-color:'+(d.colorBorde||'#e2e8f0')+'">'
            +'<p class="text-[11px] font-semibold text-slate-600 leading-snug">'+dom+'</p>'
            +'<p class="text-sm font-black mt-0.5" style="color:'+d.color+'">'+d.puntaje+' pts · '+d.nivel+'</p></div>';
      }).join('')
      +'</div>'
      +'<div class="rounded-lg p-3 border" style="background:'+e.colorBg+';border-color:'+e.colorBorde+'">'
      +'<p class="text-xs font-bold mb-1" style="color:'+e.color+'"><i class="fas fa-clipboard-list mr-1.5"></i>Acciones requeridas ('+e.nivel+')</p>'
      +'<p class="text-xs text-slate-600 leading-relaxed">'+(e.planAccion||'Consultar plan de accion segun nivel de riesgo.')+'</p></div>'
      +'</div>';
}

function renderizarDashboardEncuesta(encId, respuestas, container){
    const tipo  = ENC_TIPOS[encId] || ENC_TIPOS.SALIDA;
    const total = respuestas.length;
    const link  = location.origin + '/encuesta.html?enc=' + encId;

    // ── Promedios por pregunta (escala 1-5) ──────────────────
    const sumas={}, cnts={};
    respuestas.forEach(function(resp){
        Object.entries(resp.respuestas||{}).forEach(function([k,v]){
            const n=parseInt(v);
            if(!isNaN(n)&&n>=1&&n<=5){ sumas[k]=(sumas[k]||0)+n; cnts[k]=(cnts[k]||0)+1; }
        });
    });
    let sumT=0,cntT=0;
    Object.keys(sumas).forEach(function(k){ sumT+=sumas[k]; cntT+=cnts[k]; });
    const promG = cntT>0 ? (sumT/cntT) : 0;
    const promGStr = promG>0 ? promG.toFixed(2) : '—';

    // ── Satisfacción semáforo ────────────────────────────────
    const sat = promG>0 ? Math.round(promG/5*100) : 0;
    const satColor = sat>=80?'#10b981':sat>=60?'#f59e0b':'#ef4444';
    const satLabel = sat>=80?'Buena':'Moderada' ;

    // ── Razones de salida (bloque múltiple) ──────────────────
    const razones={};
    respuestas.forEach(function(resp){
        Object.values(resp.respuestas||{}).forEach(function(v){
            if(Array.isArray(v)) v.forEach(function(r){ razones[r]=(razones[r]||0)+1; });
        });
    });
    const razonesOrdenadas=Object.entries(razones).sort(function(a,b){return b[1]-a[1];}).slice(0,8);

    // ── Distribución de respuestas (1-5) para cada valor ────
    const distrib={1:0,2:0,3:0,4:0,5:0};
    Object.entries(sumas).forEach(function([k,s]){
        const prom=Math.round(s/(cnts[k]||1));
        if(prom>=1&&prom<=5) distrib[prom]++;
    });
    const maxDistrib=Math.max(...Object.values(distrib),1);

    // ── Respuestas por empresa ────────────────────────────────
    const porEmpresa={};
    respuestas.forEach(function(r){
        const e=r.empresa||'Sin empresa';
        porEmpresa[e]=(porEmpresa[e]||0)+1;
    });

    const colProm=promG>=4?'text-emerald-600':promG>=3?'text-amber-500':'text-rose-600';
    const bgProm=promG>=4?'bg-emerald-50 border-emerald-200':promG>=3?'bg-amber-50 border-amber-200':'bg-rose-50 border-rose-200';

    container.innerHTML =

    // ── Toolbar ──────────────────────────────────────────────
    '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">'
    +'<div><h3 class="text-base font-bold text-slate-800 flex items-center gap-2">'
    +'<i class="fas '+tipo.icono+' '+tipo.color+'"></i>'+tipo.nombre+'</h3>'
    +'<p class="text-xs text-slate-400 mt-0.5">'+total+' respuesta'+(total!==1?'s':'')+' registrada'+(total!==1?'s':'')+'</p>'
    +'</div>'
    +'<div class="flex flex-wrap gap-2">'
    +'<button onclick="abrirEditorEncuesta(this.dataset.enc)" data-enc="'+encId+'" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-pen-to-square"></i> Editar</button>'
    +'<button onclick="copiarLinkEncuesta(this.dataset.link)" data-link="'+link+'" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-link"></i> Copiar link</button>'
    +'<a href="'+link+'" target="_blank" class="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-external-link-alt"></i> Ver encuesta</a>'
    +'<button onclick="descargarRespuestasExcel(this.dataset.enc)" data-enc="'+encId+'" class="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition">'
    +'<i class="fas fa-file-excel"></i> Excel</button>'
    +'</div></div>'

    + (total===0
    // ── Estado vacío ──────────────────────────────────────────
    ? '<div class="text-center py-16"><div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">'
      +'<i class="fas fa-clipboard-list text-slate-300 text-3xl"></i></div>'
      +'<p class="text-slate-500 font-semibold mb-1">Sin respuestas aún</p>'
      +'<p class="text-xs text-slate-400">Comparte el link con los empleados para comenzar a recopilar datos.</p></div>'

    // ── Dashboard con datos ───────────────────────────────────
    : // KPIs
    '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">'
    +'<div class="rounded-xl p-4 border bg-white border-slate-100 shadow-sm">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Respuestas</p>'
      +'<p class="text-3xl font-black text-slate-800 mt-1">'+total+'</p></div>'
    +'<div class="rounded-xl p-4 border shadow-sm '+bgProm+'">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Promedio</p>'
      +'<p class="text-3xl font-black '+colProm+' mt-1">'+promGStr+'<span class="text-sm font-normal text-slate-400"> /5</span></p></div>'
    +'<div class="rounded-xl p-4 border bg-white border-slate-100 shadow-sm">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Satisfacción</p>'
      +'<p class="text-3xl font-black mt-1" style="color:'+satColor+'">'+sat+'%</p>'
      +'<p class="text-xs font-semibold mt-0.5" style="color:'+satColor+'">'+satLabel+'</p></div>'
    +'<div class="rounded-xl p-4 border bg-white border-slate-100 shadow-sm">'
      +'<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Empresas</p>'
      +'<p class="text-3xl font-black text-slate-800 mt-1">'+Object.keys(porEmpresa).length+'</p></div>'
    +'</div>'

    // ── Razones de salida ─────────────────────────────────────
    + (razonesOrdenadas.length>0
    ? '<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">'
      +'<p class="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-violet-500"></i> Principales razones de salida</p>'
      +'<div class="space-y-2.5">'
      +razonesOrdenadas.map(function(e){
          const razon=e[0], cnt=e[1];
          const pct=total>0?Math.round(cnt/total*100):0;
          const w=maxDistrib>0?Math.round(cnt/razonesOrdenadas[0][1]*100):0;
          return '<div>'
            +'<div class="flex justify-between items-center mb-1">'
            +'<span class="text-xs font-medium text-slate-700 truncate max-w-[70%]">'+razon+'</span>'
            +'<span class="text-xs font-bold text-violet-600 flex-shrink-0 ml-2">'+cnt+' ('+pct+'%)</span>'
            +'</div>'
            +'<div class="h-2 bg-slate-100 rounded-full overflow-hidden">'
            +'<div class="h-full bg-gradient-to-r from-violet-500 to-violet-300 rounded-full transition-all duration-500" style="width:'+w+'%"></div>'
            +'</div></div>';
      }).join('')
      +'</div></div>'
    :'')

    // ── Promedios por bloque ──────────────────────────────────
    + (cntT>0
    ? '<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">'
      +'<p class="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><i class="fas fa-layer-group text-blue-500"></i> Satisfacción por bloque</p>'
      +'<div class="space-y-2">'
      + (function(){
          // Agrupar preguntas por bloque aproximado (cada 6-7 preguntas)
          const bloques=[
            {n:'Compensación',qs:[1,2,3,4,5,6]},
            {n:'Liderazgo',qs:[8,9,10,11,12,13]},
            {n:'Desarrollo',qs:[15,16,17,18,19,20]},
            {n:'Clima',qs:[22,23,24,25,26]},
            {n:'Carga de Trabajo',qs:[28,29,30,31,32]},
            {n:'Comunicación',qs:[34,35,36,37,38]},
            {n:'Reconocimiento',qs:[40,41,42]},
            {n:'Condiciones',qs:[44,45,46,47]},
            {n:'Balance V-T',qs:[49,50,51,52,53]},
            {n:'Experiencia',qs:[54,55,56]},
          ];
          return bloques.map(function(b){
            let s=0,c=0;
            b.qs.forEach(function(q){
              const k='q'+q;
              if(sumas[k]&&cnts[k]){s+=sumas[k];c+=cnts[k];}
            });
            if(c===0) return '';
            const p=(s/c);
            const pStr=p.toFixed(1);
            const col=p>=4?'#10b981':p>=3?'#f59e0b':'#ef4444';
            const w=Math.round(p/5*100);
            return '<div class="flex items-center gap-3">'
              +'<span class="text-xs text-slate-500 w-28 flex-shrink-0">'+b.n+'</span>'
              +'<div class="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">'
              +'<div class="h-full rounded-full transition-all duration-500" style="width:'+w+'%;background:'+col+'"></div>'
              +'</div>'
              +'<span class="text-xs font-bold flex-shrink-0 w-8 text-right" style="color:'+col+'">'+pStr+'</span>'
              +'</div>';
          }).join('');
        })()
      +'</div></div>'
    :'')

    // ── Respuestas recientes ──────────────────────────────────
    +'<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">'
    +'<div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">'
    +'<p class="text-sm font-bold text-slate-700"><i class="fas fa-list-ul text-slate-400 mr-2"></i>Respuestas recientes</p>'
    +'<span class="text-xs text-slate-400">Últimas '+Math.min(total,10)+'</span>'
    +'</div>'
    +'<div class="overflow-x-auto"><table class="w-full text-sm">'
    +'<thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">'
    +'<tr><th class="px-4 py-2.5 text-left">Empleado</th><th class="px-4 py-2.5 text-left">Empresa</th>'
    +'<th class="px-4 py-2.5 text-left">Fecha</th><th class="px-4 py-2.5 text-center">Resp.</th></tr></thead>'
    +'<tbody class="divide-y divide-slate-50">'
    +respuestas.slice(0,10).map(function(r){
        const n=Object.keys(r.respuestas||{}).length;
        const f=r.fecha?new Date(r.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'2-digit'}):'—';
        const ini=((r.nombre||'?').trim()[0]||'?').toUpperCase();
        return '<tr class="hover:bg-slate-50">'
          +'<td class="px-4 py-2.5"><div class="flex items-center gap-2">'
          +'<div class="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0">'+ini+'</div>'
          +'<span class="font-medium text-slate-700 text-xs">'+r.nombre+'</span></div></td>'
          +'<td class="px-4 py-2.5 text-xs text-slate-500">'+r.empresa+'</td>'
          +'<td class="px-4 py-2.5 text-xs text-slate-400">'+f+'</td>'
          +'<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">'+n+'</span></td>'
          +'</tr>';
    }).join('')
    +'</tbody></table></div></div>'
    );
}

function copiarLinkEncuesta(link){
    navigator.clipboard.writeText(link).then(function(){
        mostrarToast('success','Link copiado','El link de la encuesta está en tu portapapeles.',4000);
    }).catch(function(){
        prompt('Copia este link:', link);
    });
}


// ══════════════════════════════════════════════════════════════
//  EDITOR DE ENCUESTAS — RRHH Prisma
// ══════════════════════════════════════════════════════════════
let editorEncuesta = {
    encId:    null,
    bloques:  [],      // copia editable de la estructura
    titulo:   '',
    descripcion: ''
};

// ── Abrir editor ──────────────────────────────────────────────
async function abrirEditorEncuesta(encId) {
    editorEncuesta.encId = encId;

    // Crear overlay del editor si no existe
    let overlay = document.getElementById('editor-enc-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'editor-enc-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;background:#f8f7ff;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;">'
        + '<div style="text-align:center;"><i class="fas fa-spinner fa-spin text-violet-500 text-3xl"></i>'
        + '<p style="margin-top:12px;font-size:.9rem;color:#64748b;">Cargando encuesta...</p></div></div>';

    // Cargar estructura desde GAS
    const r = await enviarPeticion('obtener_encuesta', { encId });
    if (r.status !== 'success') {
        mostrarToast('error', 'Error', 'No se pudo cargar la encuesta.');
        overlay.style.display = 'none';
        return;
    }

    editorEncuesta.titulo      = r.encuesta.titulo      || '';
    editorEncuesta.descripcion = r.encuesta.descripcion || '';
    editorEncuesta.bloques     = JSON.parse(JSON.stringify(r.encuesta.bloques || []));

    // Debug: ver estructura recibida
    console.log('[Editor] Bloques recibidos:', editorEncuesta.bloques.length);
    editorEncuesta.bloques.forEach(function(b, i){
        console.log('[Editor] Bloque', i, b.titulo, '- preguntas:', (b.preguntas||[]).length);
    });

    renderizarEditor(overlay);
}

// ── Renderizar el editor completo ─────────────────────────────
function renderizarEditor(overlay) {
    const enc = editorEncuesta;
    const totalPregs = enc.bloques.reduce(function(s,b){ return s + (b.preguntas||[]).length; }, 0);

    overlay.innerHTML =
    // ── Header del editor ──
    '<div style="background:#0d1b3e;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-shadow:0 2px 12px rgba(0,0,0,.3);">'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<button onclick="cerrarEditorEncuesta()" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:1rem;" title="Cerrar">'
    + '<i class="fas fa-arrow-left"></i></button>'
    + '<div><p style="font-weight:800;font-size:1rem;margin:0;">Editando: '+enc.titulo+'</p>'
    + '<p style="font-size:.7rem;color:rgba(255,255,255,.5);margin:0;">'+enc.bloques.length+' bloques · '+totalPregs+' preguntas</p></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="agregarBloqueEditor()" style="background:rgba(124,58,237,.3);border:1px solid rgba(124,58,237,.5);color:#c4b5fd;padding:8px 16px;border-radius:10px;cursor:pointer;font-size:.8rem;font-weight:700;">'
    + '<i class="fas fa-plus mr-1"></i> Bloque</button>'
    + '<button onclick="guardarEditorEncuesta()" style="background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;color:#fff;padding:8px 20px;border-radius:10px;cursor:pointer;font-size:.8rem;font-weight:700;box-shadow:0 4px 12px rgba(124,58,237,.4);" id="btn-guardar-editor">'
    + '<i class="fas fa-save mr-1"></i> Guardar</button>'
    + '</div></div>'

    // ── Área de configuración general ──
    + '<div style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px;display:flex;gap:12px;flex-shrink:0;">'
    + '<div style="flex:1;">'
    + '<label style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Título</label>'
    + '<input id="editor-titulo" value="'+enc.titulo.replace(/"/g,'&quot;')+'" oninput="editorEncuesta.titulo=this.value" '
    + 'style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 12px;font-size:.9rem;margin-top:3px;">'
    + '</div>'
    + '<div style="flex:2;">'
    + '<label style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Descripción / instrucciones</label>'
    + '<input id="editor-desc" value="'+enc.descripcion.replace(/"/g,'&quot;')+'" oninput="editorEncuesta.descripcion=this.value" '
    + 'style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 12px;font-size:.9rem;margin-top:3px;">'
    + '</div></div>'

    // ── Área scrollable de bloques ──
    + '<div id="editor-bloques" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;">'
    + renderizarBloquesEditor()
    + '</div>';
}

// ── Renderizar todos los bloques ──────────────────────────────
function renderizarBloquesEditor() {
    if (!editorEncuesta.bloques.length) {
        return '<div style="text-align:center;padding:48px;color:#94a3b8;">'
            + '<i class="fas fa-layer-group" style="font-size:3rem;margin-bottom:12px;display:block;"></i>'
            + '<p style="font-weight:600;">Sin bloques aún</p>'
            + '<p style="font-size:.85rem;margin-top:4px;">Haz clic en <strong>+ Bloque</strong> para comenzar.</p></div>';
    }

    return editorEncuesta.bloques.map(function(bloque, bi) {
        var numPregs = (bloque.preguntas||[]).length;
        return '<div style="background:#fff;border-radius:14px;border:1.5px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.04);">'
        // Header del bloque
        + '<div style="background:linear-gradient(135deg,#f8f7ff,#f0ebff);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e9e3ff;">'
        + '<div style="display:flex;align-items:center;gap:10px;flex:1;">'
        + '<input type="text" value="'+(bloque.icono||'📋')+'" oninput="editorEncuesta.bloques['+bi+'].icono=this.value" '
        + 'style="width:48px;border:1.5px solid #ddd6fe;border-radius:8px;padding:4px;text-align:center;font-size:1.2rem;background:#fff;" title="Ícono del bloque">'
        + '<input type="text" value="'+(bloque.titulo||'').replace(/"/g,'&quot;')+'" '
        + 'oninput="editorEncuesta.bloques['+bi+'].titulo=this.value" '
        + 'style="flex:1;border:1.5px solid #ddd6fe;border-radius:8px;padding:6px 10px;font-weight:700;font-size:.9rem;background:#fff;" placeholder="Título del bloque">'
        + '<span style="font-size:.75rem;color:#8b5cf6;font-weight:600;white-space:nowrap;">'+numPregs+' preg.</span>'
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-left:10px;">'
        + (bi > 0 ? '<button onclick="moverBloqueEditor('+bi+',-1)" style="'+btnIconStyle('slate')+'" title="Subir"><i class="fas fa-chevron-up"></i></button>' : '')
        + (bi < editorEncuesta.bloques.length-1 ? '<button onclick="moverBloqueEditor('+bi+',1)" style="'+btnIconStyle('slate')+'" title="Bajar"><i class="fas fa-chevron-down"></i></button>' : '')
        + '<button onclick="agregarPreguntaEditor('+bi+')" style="'+btnIconStyle('violet')+'" title="Agregar pregunta"><i class="fas fa-plus"></i></button>'
        + '<button onclick="eliminarBloqueEditor('+bi+')" style="'+btnIconStyle('red')+'" title="Eliminar bloque"><i class="fas fa-trash"></i></button>'
        + '</div></div>'
        // Preguntas del bloque — siempre visibles (no colapsadas)
        + '<div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:10px;">'
        + ((bloque.preguntas||[]).length === 0
            ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:.85rem;border:1.5px dashed #e2e8f0;border-radius:10px;">'
              + 'Sin preguntas — haz clic en <strong style="color:#7c3aed;">+</strong> para agregar.</div>'
            : (bloque.preguntas||[]).map(function(preg, pi) {
                return renderizarPreguntaEditor(bi, pi, preg);
              }).join('')
          )
        + '</div></div>';
    }).join('');
}

// ── Estilos de botones inline ─────────────────────────────────
function btnIconStyle(color) {
    var colors = {
        slate:  'background:#f1f5f9;border:none;color:#64748b;',
        violet: 'background:#ede9fe;border:none;color:#7c3aed;',
        red:    'background:#fef2f2;border:none;color:#ef4444;',
        green:  'background:#f0fdf4;border:none;color:#22c55e;'
    };
    return (colors[color]||colors.slate)
        + 'width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:.8rem;'
        + 'display:inline-flex;align-items:center;justify-content:center;transition:opacity .15s;';
}

// ── Renderizar una pregunta en el editor ──────────────────────
function renderizarPreguntaEditor(bi, pi, preg) {
    var tipos = [
        { val:'escala',   label:'Escala 1-5',         icon:'fa-star-half-alt' },
        { val:'abierta',  label:'Respuesta abierta',   icon:'fa-align-left' },
        { val:'multiple', label:'Opción múltiple',     icon:'fa-list-check' }
    ];

    var tipoSelect = '<select onchange="cambiarTipoPregunta('+bi+','+pi+',this.value)" '
        + 'style="border:1.5px solid #e2e8f0;border-radius:7px;padding:4px 8px;font-size:.75rem;color:#475569;background:#fff;cursor:pointer;">';
    tipos.forEach(function(t){
        tipoSelect += '<option value="'+t.val+'"'+(preg.tipo===t.val?' selected':'')+'>'+t.label+'</option>';
    });
    tipoSelect += '</select>';

    // Sección de opciones para tipo múltiple
    var opcionesHTML = '';
    if (preg.tipo === 'multiple') {
        opcionesHTML = '<div style="margin-top:10px;background:#f8f7ff;border-radius:8px;padding:10px;">'
            + '<p style="font-size:.7rem;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:8px;">Opciones:</p>'
            + '<div id="opts-'+bi+'-'+pi+'" style="display:flex;flex-direction:column;gap:5px;">'
            + (preg.opciones||[]).map(function(op, oi){
                return '<div style="display:flex;gap:6px;align-items:center;">'
                    + '<input type="text" value="'+op.replace(/"/g,'&quot;')+'" '
                    + 'oninput="editorEncuesta.bloques['+bi+'].preguntas['+pi+'].opciones['+oi+']=this.value" '
                    + 'style="flex:1;border:1.5px solid #ddd6fe;border-radius:7px;padding:5px 9px;font-size:.82rem;">'
                    + '<button onclick="eliminarOpcionEditor('+bi+','+pi+','+oi+')" style="'+btnIconStyle('red')+'">'
                    + '<i class="fas fa-times"></i></button></div>';
            }).join('')
            + '</div>'
            + '<button onclick="agregarOpcionEditor('+bi+','+pi+')" '
            + 'style="margin-top:8px;background:transparent;border:1.5px dashed #a78bfa;color:#7c3aed;border-radius:7px;padding:5px 12px;font-size:.75rem;font-weight:700;cursor:pointer;width:100%;">'
            + '<i class="fas fa-plus mr-1"></i> Agregar opción</button>'
            + '</div>';
    }

    // Badge de tipo
    var tipoBadgeColor = preg.tipo==='escala' ? '#ede9fe;color:#7c3aed'
                       : preg.tipo==='abierta' ? '#fef9c3;color:#92400e'
                       : '#dcfce7;color:#166534';

    return '<div style="border:1.5px solid #f1f5f9;border-radius:10px;padding:12px;background:#fafafa;transition:border-color .2s;" '
        + 'class="enc-preg-card" data-bi="'+bi+'" data-pi="'+pi+'">' 
        // Row: número + tipo + acciones
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
        + '<span style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:.65rem;font-weight:800;border-radius:6px;padding:2px 7px;flex-shrink:0;">'
        + (pi+1)+'</span>'
        + tipoSelect
        + '<div style="flex:1;"></div>'
        + (pi > 0 ? '<button onclick="moverPreguntaEditor('+bi+','+pi+',-1)" style="'+btnIconStyle('slate')+'" title="Subir"><i class="fas fa-chevron-up"></i></button>' : '')
        + (pi < (editorEncuesta.bloques[bi].preguntas||[]).length-1
            ? '<button onclick="moverPreguntaEditor('+bi+','+pi+',1)" style="'+btnIconStyle('slate')+'" title="Bajar"><i class="fas fa-chevron-down"></i></button>'
            : '')
        + '<button onclick="eliminarPreguntaEditor('+bi+','+pi+')" style="'+btnIconStyle('red')+'" title="Eliminar"><i class="fas fa-trash text-xs"></i></button>'
        + '</div>'
        // Texto de la pregunta
        + '<textarea oninput="editorEncuesta.bloques['+bi+'].preguntas['+pi+'].texto=this.value" '
        + 'style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:.88rem;resize:vertical;min-height:56px;font-family:inherit;background:#fff;" '
        + 'placeholder="Escribe la pregunta aquí...">'+(preg.texto||'')+'</textarea>'
        + opcionesHTML
        + '</div>';
}

// ── Acciones del editor ───────────────────────────────────────
function agregarBloqueEditor() {
    editorEncuesta.bloques.push({ icono:'📋', titulo:'Nuevo bloque', preguntas:[] });
    actualizarEditorBloques();
}

function eliminarBloqueEditor(bi) {
    if (!confirm('¿Eliminar este bloque y todas sus preguntas?')) return;
    editorEncuesta.bloques.splice(bi, 1);
    actualizarEditorBloques();
}

function moverBloqueEditor(bi, dir) {
    var b = editorEncuesta.bloques;
    var target = bi + dir;
    if (target < 0 || target >= b.length) return;
    var tmp = b[bi]; b[bi] = b[target]; b[target] = tmp;
    actualizarEditorBloques();
}

function agregarPreguntaEditor(bi) {
    if (!editorEncuesta.bloques[bi].preguntas) editorEncuesta.bloques[bi].preguntas = [];
    editorEncuesta.bloques[bi].preguntas.push({ tipo:'escala', texto:'' });
    actualizarEditorBloques();
}

function eliminarPreguntaEditor(bi, pi) {
    editorEncuesta.bloques[bi].preguntas.splice(pi, 1);
    actualizarEditorBloques();
}

function moverPreguntaEditor(bi, pi, dir) {
    var p = editorEncuesta.bloques[bi].preguntas;
    var target = pi + dir;
    if (target < 0 || target >= p.length) return;
    var tmp = p[pi]; p[pi] = p[target]; p[target] = tmp;
    actualizarEditorBloques();
}

function cambiarTipoPregunta(bi, pi, nuevoTipo) {
    editorEncuesta.bloques[bi].preguntas[pi].tipo = nuevoTipo;
    if (nuevoTipo === 'multiple' && !editorEncuesta.bloques[bi].preguntas[pi].opciones) {
        editorEncuesta.bloques[bi].preguntas[pi].opciones = ['Opción 1', 'Opción 2'];
    }
    actualizarEditorBloques();
}

function agregarOpcionEditor(bi, pi) {
    if (!editorEncuesta.bloques[bi].preguntas[pi].opciones) {
        editorEncuesta.bloques[bi].preguntas[pi].opciones = [];
    }
    editorEncuesta.bloques[bi].preguntas[pi].opciones.push('Nueva opción');
    actualizarEditorBloques();
}

function eliminarOpcionEditor(bi, pi, oi) {
    editorEncuesta.bloques[bi].preguntas[pi].opciones.splice(oi, 1);
    actualizarEditorBloques();
}

// ── Re-renderizar solo el área de bloques (sin re-crear el header)
function actualizarEditorBloques() {
    var container = document.getElementById('editor-bloques');
    if (!container) return;

    // Leer valores actuales de los inputs antes de re-renderizar
    var tituloInput = document.getElementById('editor-titulo');
    var descInput   = document.getElementById('editor-desc');
    if (tituloInput) editorEncuesta.titulo      = tituloInput.value;
    if (descInput)   editorEncuesta.descripcion = descInput.value;

    // Actualizar contador en header
    var totalPregs = editorEncuesta.bloques.reduce(function(s,b){ return s+(b.preguntas||[]).length; }, 0);
    var headerInfo = document.querySelector('#editor-enc-overlay p[style*="rgba"]');
    if (headerInfo) headerInfo.textContent = editorEncuesta.bloques.length+' bloques · '+totalPregs+' preguntas';

    container.innerHTML = renderizarBloquesEditor();
}

// ── Guardar en GAS ────────────────────────────────────────────
async function guardarEditorEncuesta() {
    var btn = document.getElementById('btn-guardar-editor');
    if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...'; }

    // Leer valores finales de inputs
    var tituloInput = document.getElementById('editor-titulo');
    var descInput   = document.getElementById('editor-desc');
    if (tituloInput) editorEncuesta.titulo      = tituloInput.value;
    if (descInput)   editorEncuesta.descripcion = descInput.value;

    // Validar que no haya preguntas con texto vacío
    var sinTexto = 0;
    editorEncuesta.bloques.forEach(function(b){
        (b.preguntas||[]).forEach(function(p){ if(!p.texto||!p.texto.trim()) sinTexto++; });
    });
    if (sinTexto > 0) {
        mostrarToast('warning','Preguntas vacías',sinTexto+' pregunta(s) no tienen texto. Por favor completa todas antes de guardar.');
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-save mr-1"></i> Guardar'; }
        return;
    }

    var estructura = {
        titulo:      editorEncuesta.titulo,
        descripcion: editorEncuesta.descripcion,
        bloques:     editorEncuesta.bloques
    };

    var r = await enviarPeticion('guardar_encuesta', {
        token:      getToken(),
        encId:      editorEncuesta.encId,
        estructura: estructura
    });

    if (r.status === 'success') {
        mostrarToast('success','Encuesta guardada','Los cambios se guardaron correctamente en el Sheet.',5000);
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-save mr-1"></i> Guardar'; }
        // Recargar el tab activo para reflejar cambios
        cerrarEditorEncuesta();
        activarTabEncuesta(encTabActual, document.querySelector('.enc-tab.active'));
    } else {
        mostrarToast('error','Error al guardar',r.message||'Intenta de nuevo.');
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-save mr-1"></i> Guardar'; }
    }
}

// ── Cerrar editor ─────────────────────────────────────────────
// CSS para hover de tarjetas de pregunta en el editor
(function(){
    var st = document.createElement('style');
    st.textContent = '.enc-preg-card{border:1.5px solid #f1f5f9;border-radius:10px;padding:12px;background:#fafafa;transition:border-color .2s;}'
        + '.enc-preg-card:hover{border-color:#ddd6fe;}';
    document.head.appendChild(st);
})();

function cerrarEditorEncuesta() {
    var overlay = document.getElementById('editor-enc-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ─── FOTO DE PERFIL DEL EMPLEADO ─────────────────────────────
async function cargarFotoPerfil(folderUrl){
    if(!folderUrl) return;
    // Extraer folderId con regex robusto
    var mFolder = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(!mFolder) { console.warn('[cargarFotoPerfil] No se pudo extraer folderId de:', folderUrl); return; }
    var folderId = mFolder[1];
    try {
        var r = await enviarPeticion('obtener_foto', { folderId: folderId });
        console.log('[cargarFotoPerfil] Respuesta:', JSON.stringify(r));
        if(r.status === 'success' && r.url) {
            var avatar = document.getElementById('avatar-circulo');
            if(avatar) {
                var img = document.createElement('img');
                img.src = r.url;
                img.className = 'w-full h-full object-cover';
                img.onerror = function(){
                    console.warn('[cargarFotoPerfil] Error cargando imagen:', r.url);
                    this.parentElement.innerHTML = '<i class="fas fa-user"></i>';
                };
                avatar.innerHTML = '';
                avatar.appendChild(img);
            } else {
                console.warn('[cargarFotoPerfil] No se encontró avatar-circulo en el DOM');
            }
        } else {
            console.warn('[cargarFotoPerfil] Sin foto:', r.message);
        }
    } catch(e) {
        console.warn('[cargarFotoPerfil] Error:', e);
    }
}

async function subirFotoPerfil(){
    const input = document.getElementById('input-foto-perfil');
    if(!input||!input.files[0]||!empleadoEdicion) return;
    const file = input.files[0];
    if(file.size > 5*1024*1024){ mostrarToast('warning','Archivo muy grande','La foto no debe superar 5 MB.'); return; }
    mostrarToast('info','Subiendo foto...','',3000);
    const b64 = await new Promise((res,rej)=>{
        const r = new FileReader();
        r.onload = ()=>res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
    const idInterno  = (empleadoEdicion["ID INTERNO"]||"").toString().trim();
    const noEmp      = (empleadoEdicion["NO. EMPLEADO"]||"").toString().trim();
    const idParaNombre = idInterno || noEmp;
    const resp = await enviarPeticion('subir_documento',{
        idInterno:      idInterno,   // identificador único — columna AY
        numeroEmpleado: noEmp,       // respaldo por si acaso
        nombreArchivo: 'foto_perfil_'+idParaNombre+'.'+file.name.split('.').pop(),
        mimeType: file.type,
        data: b64
    }, 45000); // timeout largo: puede implicar crear carpeta+subcarpeta en Drive antes de subir
    console.log('[subirFotoPerfil] Respuesta backend:', JSON.stringify(resp));
    if(resp.status === 'success'){
        mostrarToast('success','Foto guardada','Foto subida a Drive. Carpeta: '+(resp.folderUrl||'existente'));
        const folderUrl = resp.folderUrl || (empleadoEdicion["URL EXPEDIENTE"]||"").toString().trim();
        if(folderUrl){
            empleadoEdicion["URL EXPEDIENTE"] = folderUrl;
            // Actualizar el ícono de carpeta en la tabla
            const iconoCarpeta = document.querySelector('tr [title="Abrir expediente en Drive"]');
            if(iconoCarpeta) iconoCarpeta.href = folderUrl;
            await new Promise(r => setTimeout(r, 1500));
            await cargarFotoPerfil(folderUrl);
        }
    } else {
        mostrarToast('error','Error','No se pudo subir la foto: '+resp.message);
        console.error('[subirFotoPerfil] Error del backend:', resp.message);
    }
    input.value = '';
}

function renderizarDrawer(emp){
    const id  = (emp["NO. EMPLEADO"]||"").toString();
    const nom = emp["NOMBRE DEL TRABAJADOR"]||"—";
    const est = (emp["ESTATUS"]||"").toString().trim();
    console.log('[Drawer] ESTATUS raw:', JSON.stringify(emp["ESTATUS"]), '| est:', JSON.stringify(est), '| es Baja:', est==="Baja");
    const url = (emp["URL EXPEDIENTE"]||"").toString().trim();
    const estColor = est==="Activo"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-600";

    const partes   = nom.split(" ").filter(function(p){return p.length>0;});
    const iniciales= (partes[0]?partes[0][0]:"")+(partes[1]?partes[1][0]:"");

    // Construir header del drawer con DOM API (evita comillas anidadas)
    var tituloEl = document.getElementById("drawer-titulo");
    tituloEl.innerHTML = "";
    var avatarWrap = document.createElement("div");
    avatarWrap.className = "flex items-center gap-3 flex-1 min-w-0";
    var avatarOuter = document.createElement("div");
    avatarOuter.className = "relative flex-shrink-0";
    var avatarDiv = document.createElement("div");
    avatarDiv.id = "avatar-circulo";
    avatarDiv.className = "w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer overflow-hidden";
    avatarDiv.title = "Subir foto de perfil";
    avatarDiv.onclick = function(){ document.getElementById("input-foto-perfil").click(); };
    avatarDiv.innerHTML = iniciales || '<i class="fas fa-user"></i>';
    var inputFoto = document.createElement("input");
    inputFoto.type="file"; inputFoto.id="input-foto-perfil";
    inputFoto.accept=".jpg,.jpeg,.png"; inputFoto.className="hidden";
    inputFoto.onchange = subirFotoPerfil;
    var camBtn = document.createElement("div");
    camBtn.className = "absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow border border-slate-200 cursor-pointer";
    camBtn.onclick = function(){ document.getElementById("input-foto-perfil").click(); };
    camBtn.innerHTML = '<i class="fas fa-camera text-slate-400 text-xs"></i>';
    avatarOuter.appendChild(avatarDiv);
    avatarOuter.appendChild(inputFoto);
    avatarOuter.appendChild(camBtn);
    var infoDiv = document.createElement("div");
    infoDiv.className = "min-w-0";
    infoDiv.innerHTML = '<p class="text-sm font-bold text-slate-800 truncate">'+nom+'</p><p class="text-xs text-slate-400">#'+id+' &middot; '+(emp["EMPRESA"]||"—")+'</p>';
    avatarWrap.appendChild(avatarOuter);
    avatarWrap.appendChild(infoDiv);
    var badgeEl = document.createElement("span");
    badgeEl.className = "px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 "+estColor;
    badgeEl.textContent = est;
    tituloEl.appendChild(avatarWrap);
    tituloEl.appendChild(badgeEl);
    if(url && url.indexOf("http")===0) cargarFotoPerfil(url);

    const ro = function(label,val){
        return '<div><p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">'+label+'</p>'
              +'<p class="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 min-h-[36px]">'+(val||"—")+'</p></div>';
    };
    const ed = function(id2,label,val,type){
        return '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">'+label+'</label>'
              +'<input type="'+(type||"text")+'" id="'+id2+'" value="'+(val||"").toString().replace(/"/g,"&quot;")+'" '
              +'class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition"></div>';
    };
    const sel = function(id2,label,val,opts){
        return '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">'+label+'</label>'
              +'<select id="'+id2+'" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition">'
              +opts.map(function(o){return '<option '+(o===val?'selected':'')+' value="'+o+'">'+o+'</option>';}).join('')
              +'</select></div>';
    };
    // Select dinámico con opciones de lista (ej: empresas del catálogo)
    const edsec = function(id2,label,val,opciones){
        const optsHtml = (opciones||[]).map(function(o){
            return '<option '+(o===val?'selected':'')+' value="'+o+'">'+o+'</option>';
        }).join('');
        return '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">'+label+'</label>'
              +'<select id="'+id2+'" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition cursor-pointer" '
              +'onchange="var gc=grupoDeEmpresa(this.value);var egc=document.getElementById(\"ed_grupoComercial\");if(egc)egc.value=gc;">'
              +'<option value="">Seleccione...</option>'+optsHtml
              +'</select></div>';
    };
    // sec: sección dentro de la columna del modal (ocupa 1 columna del grid externo)
    const sec = function(titulo,icono,color,html){
        return '<div class="mb-5 break-inside-avoid"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">'
              +'<i class="fas '+icono+' '+color+'"></i>'+titulo+'</p>'
              +'<div class="grid grid-cols-2 gap-3">'+html+'</div></div>';
    };
    // secFull: sección a ancho completo (ocupa las 2 columnas del grid externo)
    const secFull = function(titulo,icono,color,html){
        return '<div class="md:col-span-2 mb-5 break-inside-avoid"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">'
              +'<i class="fas '+icono+' '+color+'"></i>'+titulo+'</p>'
              +'<div class="grid grid-cols-2 md:grid-cols-4 gap-3">'+html+'</div></div>';
    };
    // rawFull: bloque a ancho completo sin título propio
    const rawFull = function(html){
        return '<div class="md:col-span-2">'+html+'</div>';
    };
    const ff = function(v){
        if(!v||v==="0"||v==="") return "—";
        // Usar parseFechaFlexible que maneja: serial numérico (35228),
        // texto DD/MM/YYYY ("11/06/1996"), texto YYYY-MM-DD ("1996-06-11")
        var d = parseFechaFlexible(v);
        if(d && !isNaN(d)) return fmtUTC(d,{day:"2-digit",month:"2-digit",year:"numeric"});
        return v.toString();
    };
    // edf: input date editable (para contratos)
    const edf = function(id2,label,val){
        return '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">'+label+'</label>'
              +'<input type="date" id="'+id2+'" value="'+(val||"")+'" '
              +'class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-400 transition"></div>';
    };
    // selBaja: select de tipo salida con motivos dinámicos
    const selBaja = function(idTipo,idMotivo,valTipo,valMotivo){
        return '<div>'
            +'<label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tipo de Salida</label>'
            +'<select id="'+idTipo+'" onchange="actualizarMotivosBaja(this.value,\''+idMotivo+'\',\'ed_motivoBajaOtro\')" '
            +'class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition">'
            +'<option value="">Selecciona...</option>'
            +'<option '+(valTipo==="Voluntaria"?"selected":"")+'>Voluntaria</option>'
            +'<option '+(valTipo==="Involuntaria"?"selected":"")+'>Involuntaria</option>'
            +'</select></div>'
            +'<div id="ed_motivoBajaWrap" class="md:col-span-2">'
            +'<label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Motivo de Salida</label>'
            +'<select id="'+idMotivo+'" onchange="toggleOtroBaja(this.value,\'ed_motivoBajaOtro\')" '
            +'class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition">'
            + buildMotivosOpts(valTipo, valMotivo)
            +'</select></div>'
            +'<div id="ed_motivoBajaOtro" class="'+(valMotivo&&valMotivo.toLowerCase().startsWith("otro")?"md:col-span-2":"md:col-span-2 hidden")+'">'
            +'<label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Especifica el motivo</label>'
            +'<input type="text" id="ed_motivoBajaOtroTexto" value="'+(valMotivo&&!MOTIVOS_VOLUNTARIA.concat(MOTIVOS_INVOLUNTARIA).includes(valMotivo)?valMotivo:"")+'" placeholder="Describe el motivo..." '
            +'class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition"></div>';
    };
    const E = emp;

    const idPersonaEd = (E["ID_PERSONA"] || "").toString().trim();
    // Detectar si es reingreso buscando en cacheGlobal otros registros con mismo ID_PERSONA
    const esReingreso = idPersonaEd && cacheGlobal.filter(r=>(r["ID_PERSONA"]||"").toString().trim()===idPersonaEd).length > 1;

    // Construir innerHTML por partes para detectar NaN
    var _p1 = (esReingreso ? rawFull('<div class="mb-4 flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">'
        +'<i class="fas fa-rotate text-violet-500 text-sm"></i>'
        +'<div><p class="text-xs font-bold text-violet-700">Reingreso detectado</p>'
        +'<p class="text-xs text-violet-500">Esta persona tiene períodos anteriores registrados. Consulta el historial al final del expediente.</p></div></div>') : '');
    var _p2 = sec("Datos Laborales","fa-briefcase","text-blue-500",
        ed("ed_noEmpleado","No. Empleado",E["NO. EMPLEADO"],"number")+
        ro("Fecha Ingreso",ff(E["FECHA DE INGRESO"]))+
        ro("Estatus ⟵ fórmula Sheet",E["ESTATUS"])+
        ro("Antigüedad ⟵ fórmula Sheet",E["ANTIGÜEDAD"])+
        ed("ed_empresa","Empresa",E["EMPRESA"],"text")+
        ed("ed_grupoComercial","Grupo Comercial ⟵ automático",E["GRUPO COMERCIAL"])+
        ed("ed_puesto","Puesto",E["PUESTO"])+
        ed("ed_departamento","Departamento",E["DEPARTAMENTO"])+
        sel("ed_tipoIngreso","Tipo de Ingreso",E["TIPO DE INGRESO"],["","Administrativo","Operativo"])+
        ed("ed_sueldo","Sueldo Mensual (MXN)",E["SUELDO MENSUAL"],"number")+
        sel("ed_frecPago","Frecuencia de Pago",E["FRECUENCIA DE PAGO"],["","Quincenal","Semanal","Mensual"])+
        ed("ed_fuenteCont","Fuente de Contratación",E["FUENTE DE CONTRATACIÓN"])
    );
    var _p3 = sec("Datos Personales","fa-id-card","text-teal-500",
        ed("ed_curp","CURP",E["CURP"])+
        ed("ed_rfc","RFC",E["RFC"])+
        ed("ed_nss","NSS",E["NSS"])+
        ro("Fecha Nacimiento ⟵ fórmula Sheet",ff(E["FECHA DE NACIMIENTO"]))+
        ro("Edad ⟵ fórmula Sheet",E["EDAD"])+
        ro("Género ⟵ fórmula Sheet",E["GÉNERO"])+
        ro("Rango de Edad ⟵ fórmula Sheet",E["RANGO DE EDAD"])+
        ed("ed_lugarNac","Lugar de Nacimiento",E["LUGAR DE NACIMIENTO"])+
        ed("ed_nacionalidad","Nacionalidad",E["NACIONALIDAD"])+
        sel("ed_edoCivil","Estado Civil",E["ESTADO CIVIL"],["","Soltero","Casado","Divorciado","Viudo","Unión Libre"])+
        ed("ed_escolaridad","Escolaridad",E["ESCOLARIDAD"])
    );
    var _p4 = sec("Contacto","fa-phone","text-cyan-500",
        ed("ed_correo","Correo Electrónico",E["CORREO ELECTRÓNICO"],"email")+
        ed("ed_telefono","Teléfono Personal",E["TELÉFONO PERSONAL"])+
        '<div class="col-span-2">'+ed("ed_domicilio","Domicilio Completo",E["DOMICILIO COMPLETO (CALLE, NÚMERO, COLONIA, CP, ESTADO Y MUNICIPIO)"])+'</div>'+
        ed("ed_contEmerg","Contacto de Emergencia",E["CONTACTO DE EMERGENCIA"])+
        ed("ed_parEmerg","Parentesco",E["PARENTESCO"])+
        ed("ed_telEmerg","Teléfono de Emergencia",E["TELÉFONO DE EMERGENCIA"])
    );
    var _p5 = sec("Beneficiario IMSS","fa-heart","text-rose-500",
        ed("ed_nomBenef","Nombre Beneficiario",E["NOMBRE DEL BENEFICIARIO"])+
        ed("ed_rfcBenef","RFC Beneficiario",E["RFC DEL BENEFICIARIO"])+
        ed("ed_parBenef","Parentesco",E["PARENTESCO DEL BENEFICIARIO"])+
        ed("ed_pctBenef","% Asignación",E["PORCENTAJE DE ASIGNACIÓN"],"number")
    );
    var _p6 = (est==="Baja" ? rawFull('<div id="baja-placeholder"></div>') : '');
    var _p7 = rawFull('<div class="mb-5"><div class="flex items-center justify-between mb-3"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2"><i class="fas fa-file-contract text-indigo-500"></i>Contratos</p>'
    +'<button type="button" onclick="calcularFechasContratoExpediente()" class="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition"><i class="fas fa-magic"></i>Calcular fechas</button>'
    +'</div>'
    +'<div class="grid grid-cols-2 md:grid-cols-4 gap-3">'
    +sel("ed_tipoContrato","Tipo de Contrato",E["TIPO DE CONTRATO"],["","Tiempo Indeterminado","Prueba","Temporal"])
    +edf("ed_ini1contrato","Inicio 1er Contrato",parsearFecha(E["FECHA DE INICIO DEL PRIMER CONTRATO"]))
    +edf("ed_ven1contrato","Vence 1er Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL PRIMER CONTRATO"]))
    +edf("ed_ini2contrato","Inicio 2do Contrato",parsearFecha(E["FECHA DE INICIO DEL SEGUNDO CONTRATO"]))
    +edf("ed_ven2contrato","Vence 2do Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO"]))
    +edf("ed_ini3contrato","Inicio 3er Contrato",parsearFecha(E["FECHA DE INICIO DEL TERCER CONTRATO"]))
    +edf("ed_ven3contrato","Vence 3er Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL TERCER CONTRATO"]))
    +edf("ed_ini4contrato","Inicio 4to Contrato",parsearFecha(E["FECHA DE INICIO DEL CUARTO CONTRATO"]))
    +edf("ed_ven4contrato","Vence 4to Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL CUARTO CONTRATO"]))
    +edf("ed_ini5contrato","Inicio 5to Contrato",parsearFecha(E["FECHA DE INICIO DEL QUINTO CONTRATO"]))
    +edf("ed_ven5contrato","Vence 5to Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL QUINTO CONTRATO"]))
    +edf("ed_ini6contrato","Inicio 6to Contrato",parsearFecha(E["FECHA DE INICIO DEL SEXTO CONTRATO"]))
    +edf("ed_ven6contrato","Vence 6to Contrato",parsearFecha(E["FECHA DE VENCIMIENTO DEL SEXTO CONTRATO"]))
    +'</div>'
    +'<div class="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">'
    +'<p class="text-xs font-bold text-amber-800 mb-2"><i class="fas fa-signature mr-1 text-amber-500"></i>Firma de contrato</p>'
    +'<div class="flex items-center gap-3 flex-wrap">'
    +((E["CONTRATO FIRMADO"]||"")==="Sí"
      ?'<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full"><i class="fas fa-check-circle"></i>Contrato firmado</span>'
       +'<button type="button" onclick="subirContratoFirmado(\''+(E["ID INTERNO"]||"")+'\')\" class="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"><i class="fas fa-upload mr-1"></i>Actualizar PDF</button>'
      :'<button type="button" onclick="subirContratoFirmado(\''+(E["ID INTERNO"]||"")+'\')\" class="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition"><i class="fas fa-upload"></i>Subir contrato firmado</button>'
       +'<span class="text-xs text-amber-700"><i class="fas fa-exclamation-triangle mr-1"></i>Sin contrato firmado registrado</span>')
    +'</div>'
    +((E["URL CONTRATO FIRMADO"]||"")?'<p class="mt-1.5 text-xs text-slate-500"><i class="fas fa-link mr-1"></i><a href="'+(E["URL CONTRATO FIRMADO"]||"")+'" target="_blank" class="underline text-blue-600">Ver documento actual</a></p>':'')
    +'</div></div>');
    var _p8 = sec("Seguimiento","fa-clipboard-list","text-amber-500",
        sel("ed_ent15","Entrevista 15 Días",E["ENTREVISTA DE AJUSTE 15 DÍAS"],["","Pendiente","Sí","No"])+
        sel("ed_ent45","Entrevista 45 Días",E["ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS"],["","Pendiente","Sí","No"])+
        '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Evaluación 360°</label>'
        +'<input type="date" id="ed_eval360" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"></div>'
    );
    var _p9 = secFull("Calculado por el Sheet","fa-function","text-slate-400",
        ro("Para Ant. Promedio ⟵ fórmula",(E["PARA ANT. PROMEDIO"]||"").toString())+
        ro("Se Toma en Cuenta ⟵ fórmula",(E["SE TOMA EN CUENTA?"]||"").toString())
    );
    var _p10 = secFull("Acceso y Jerarquía","fa-network-wired","text-indigo-500",
        ed("ed_jefeDirecto","Jefe Directo (ID INTERNO)",E["JEFE DIRECTO"])+
        ed("ed_correoAcceso","Correo Acceso (corporativo)",E["CORREO ACCESO"],"email")+
        '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;">'
        +((E["CORREO ACCESO"]||"")
            ?'<div style="display:flex;align-items:center;gap:10px;"><div style="flex:1;"><p style="font-size:.78rem;font-weight:600;color:#64748b;margin:0;">Portal del empleado</p><p style="font-size:.72rem;color:#94a3b8;margin:2px 0 0;">Correo: '+(E["CORREO ACCESO"]||"")+'</p></div>'
             +'<button onclick="activarPortalEmpleado()" style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);border:none;color:#fff;font-size:.75rem;font-weight:700;padding:7px 14px;border-radius:8px;cursor:pointer;white-space:nowrap;"><i class="fas fa-key" style="margin-right:5px;"></i>Activar/Reenviar acceso</button></div>'
            :'<p style="font-size:.78rem;color:#94a3b8;">Agrega el <strong>Correo Acceso</strong> para activar el portal del empleado.</p>'
        )+'</div>'
    );
    var _p11 = rawFull((url && url.indexOf("http")===0
        ?'<div class="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4"><div class="flex items-center gap-3"><i class="fas fa-folder-open text-blue-500 text-xl flex-shrink-0"></i><div class="flex-1 min-w-0"><p class="text-sm font-bold text-blue-800">Expediente en Drive</p><p class="text-xs text-blue-600 truncate">'+url+'</p></div><a href="'+url+'" target="_blank" rel="noopener" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition flex-shrink-0"><i class="fas fa-external-link-alt mr-1"></i>Abrir</a></div></div>'
        :'<div class="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4"><div class="flex items-center gap-3 mb-3"><i class="fas fa-folder text-amber-400 text-xl flex-shrink-0"></i><div class="flex-1"><p class="text-sm font-bold text-amber-800">Sin expediente en Drive</p><p class="text-xs text-amber-600">Este empleado no tiene carpeta asignada en Drive.</p></div></div><button onclick="crearExpedienteEnDrive()" class="w-full text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 py-2.5 rounded-xl transition flex items-center justify-center gap-2"><i class="fas fa-folder-plus"></i> Crear carpeta de expediente</button></div>'
    ));
    // REDISEÑO: en vez de un solo contenedor de 2 columnas, cada sección
    // se reparte en su pestaña correspondiente. Los inputs quedan igual
    // en el DOM (mismos ids) — guardarCambiosEditor() no se ve afectado.
    document.getElementById("tab-panel-personal").innerHTML   = _p3+_p4+_p5;
    document.getElementById("tab-panel-laboral").innerHTML    = _p2+_p6+_p8+_p10+_p9;
    document.getElementById("tab-historial-reingreso").innerHTML = _p1;
    document.getElementById("tab-panel-contratos").innerHTML  = _p7;
    document.getElementById("tab-documentos-drive").innerHTML = _p11;

    const eval360val = E["FECHA EVALUACIÓN 360"]||"";
    if(eval360val){const el=document.getElementById("ed_eval360");if(el)el.value=parsearFecha(eval360val);}

    // ── Insertar bloque Baja/Finiquito vía DOM (más robusto que concatenación) ──
    if(est==="Baja"){
        const placeholder = document.getElementById('baja-placeholder');
        if(placeholder){
            var tipoSal  = (E["TIPO DE SALIDA"]||"").toString();
            var motivSal = (E["MOTIVO DE SALIDA"]||"").toString();
            var fechBaj  = parsearFecha(E["FECHA DE BAJA"])||"";
            var montoFin = (parsearMontoSheet(E["MONTO DE FINIQUITO"])||"").toString();
            var esOtro   = motivSal.toLowerCase().startsWith("otro");
            var valOtro  = motivSal.startsWith("Otro: ") ? motivSal.replace("Otro: ","") : "";
            placeholder.innerHTML =
              '<div class="mb-5 border border-red-200 rounded-xl p-4 bg-red-50">'
              +'<p class="text-xs font-bold text-red-500 uppercase tracking-wide mb-3 flex items-center gap-2">'
              +'<i class="fas fa-user-minus"></i>Baja / Finiquito'
              +' <span class="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Baja registrada</span>'
              +'</p>'
              +'<div class="grid grid-cols-1 md:grid-cols-3 gap-3">'
              +'<div><label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Fecha de Baja</label>'
              +'<input type="date" id="ed_fechaBaja" value="'+fechBaj+'" class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition"></div>'
              +'<div><label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Tipo de Salida</label>'
              +'<select id="ed_tipoSalida" onchange="actualizarMotivosBaja(this.value,\'ed_motivoBaja\',\'ed_motivoBajaOtro\')" class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition">'
              +'<option value="">Selecciona...</option>'
              +'<option '+(tipoSal==="Voluntaria"?"selected":"")+'>Voluntaria</option>'
              +'<option '+(tipoSal==="Involuntaria"?"selected":"")+'>Involuntaria</option>'
              +'</select></div>'
              +'<div><label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Monto de Finiquito (MXN)</label>'
              +'<input type="number" id="ed_finiquito" value="'+montoFin+'" placeholder="0.00" step="0.01" class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition"></div>'
              +'</div>'
              +'<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">'
              +'<div class="'+(esOtro?'':'md:col-span-2')+'">'
              +'<label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Motivo de Salida</label>'
              +'<select id="ed_motivoBaja" onchange="toggleOtroBaja(this.value,\'ed_motivoBajaOtro\')" class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition">'
              + buildMotivosOpts(tipoSal, motivSal)
              +'</select></div>'
              +'<div id="ed_motivoBajaOtro" class="'+(esOtro?'':'hidden')+'">'
              +'<label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Especifica el motivo</label>'
              +'<input type="text" id="ed_motivoBajaOtroTexto" placeholder="Describe el motivo..." value="'+valOtro+'" class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-400 transition"></div>'
              +'</div>'
              +'</div>';
            console.log('[Baja DOM] Bloque insertado correctamente');
        } else {
            console.warn('[Baja DOM] No se encontró el placeholder #baja-placeholder');
        }
    }

    // ── Sección Historial de Carrera ──────────────────────────
    // Solo mostrar la tarjeta de historial si hay ID_PERSONA asignado;
    // si no, se muestra el aviso "sin ID de historial" en su lugar.
    const cardHistEl = document.getElementById('tab-historial-card');
    const sinIdEl    = document.getElementById('tab-historial-sin-id');
    if(idPersonaEd){
        if(cardHistEl) cardHistEl.classList.remove('hidden');
        if(sinIdEl) sinIdEl.classList.add('hidden');
        // Cargar historial en segundo plano
        setTimeout(()=>cargarHistorialPersona(idPersonaEd), 300);
    } else {
        if(cardHistEl) cardHistEl.classList.add('hidden');
        if(sinIdEl) sinIdEl.classList.remove('hidden');
    }

    // ── Indicador de Baja en la pestaña "Datos Laborales" ──────
    const bajaDot = document.getElementById('tab-baja-dot');
    if(bajaDot) bajaDot.classList.toggle('hidden', est!=="Baja");

    // ── Pestaña "Expediente Digital": cargar miniaturas de Drive ──
    // Solo si ya existe carpeta (si no, _p11 ya muestra el botón para
    // crearla y no hay nada que listar todavía).
    const archivosEl = document.getElementById('tab-documentos-archivos');
    if(archivosEl){
        if(url && url.indexOf("http")===0){
            cargarArchivosExpediente(url);
        } else {
            archivosEl.innerHTML = '';
        }
    }

    // Siempre reabrir el expediente mostrando la primera pestaña
    cambiarTabDrawer('personal');
}

// ─── Sistema de pestañas del modal de expediente ─────────────
function cambiarTabDrawer(tab){
    document.querySelectorAll('.drawer-tab-panel').forEach(function(p){
        p.classList.toggle('hidden', p.id !== ('tab-panel-'+tab));
    });
    document.querySelectorAll('.drawer-tab').forEach(function(b){
        b.classList.toggle('drawer-tab-activa', b.dataset.tab === tab);
    });
    const scrollEl = document.getElementById('drawer-body-scroll');
    if(scrollEl) scrollEl.scrollTop = 0;
    // NOM-035: cargar resultados al abrir la pestana
    if (tab === 'nom035' && window.empleadoEdicion) {
        var idInt = (window.empleadoEdicion['ID INTERNO']||'').toString().trim();
        console.log('[NOM035 drawer] ID INTERNO:', idInt, '| empleadoEdicion keys:', Object.keys(window.empleadoEdicion).slice(0,5));
    if (idInt) cargarResultadosNOM035Drawer(idInt);
    }
}

// ─── Miniaturas de archivos del expediente (pestaña "Expediente Digital") ──
// Solo lectura: ver y abrir en Drive. No borra ni reemplaza archivos.
function _iconoPorMime(mime){
    if(!mime) return 'fa-file text-slate-400';
    if(mime.indexOf('image/')===0) return 'fa-file-image text-blue-400';
    if(mime==='application/pdf') return 'fa-file-pdf text-red-400';
    if(mime.indexOf('word')!==-1) return 'fa-file-word text-blue-600';
    if(mime.indexOf('sheet')!==-1 || mime.indexOf('excel')!==-1) return 'fa-file-excel text-emerald-600';
    if(mime.indexOf('presentation')!==-1) return 'fa-file-powerpoint text-orange-500';
    return 'fa-file text-slate-400';
}
async function cargarArchivosExpediente(folderUrl){
    const cont = document.getElementById('tab-documentos-archivos');
    if(!cont) return;
    const match = (folderUrl||'').match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(!match){ cont.innerHTML=''; return; }
    const folderId = match[1];

    cont.innerHTML = '<div class="text-xs text-slate-400 text-center py-4"><i class="fas fa-spinner fa-spin mr-1"></i>Cargando archivos del expediente...</div>';
    try{
        const r = await enviarPeticion('listar_archivos_expediente', { folderId });
        if(r.status !== 'success'){
            cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No se pudieron cargar los archivos: '+(r.message||'')+'</p>';
            return;
        }
        const archivos = r.archivos || [];
        if(!archivos.length){
            cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Esta carpeta aún no tiene archivos.</p>';
            return;
        }
        cont.innerHTML =
            '<p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">'
            +'<i class="fas fa-images text-blue-400"></i>Archivos en el expediente ('+archivos.length+')</p>'
            +'<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">'
            +archivos.map(function(a){
                const fecha = a.fecha ? new Date(a.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '';
                const previewInner = a.thumbnailUrl
                    ? '<img src="'+a.thumbnailUrl+'" loading="lazy" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\'<i class=&quot;fas '+_iconoPorMime(a.mimeType)+' text-3xl&quot;></i>\'">'
                    : '<i class="fas '+_iconoPorMime(a.mimeType)+' text-3xl"></i>';
                return '<a href="'+a.urlVer+'" target="_blank" rel="noopener" class="group block rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition overflow-hidden bg-white">'
                    +'<div class="h-24 bg-slate-50 flex items-center justify-center overflow-hidden">'+previewInner+'</div>'
                    +'<div class="px-2 py-1.5">'
                    +'<p class="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-600" title="'+a.nombre+'">'+a.nombre+'</p>'
                    +'<p class="text-[10px] text-slate-400">'+fecha+'</p>'
                    +'</div></a>';
            }).join('')
            +'</div>';
    }catch(e){
        console.error('cargarArchivosExpediente:', e);
        cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No se pudo conectar para cargar los archivos.</p>';
    }
}


async function guardarCambiosEditor(){
    if(!empleadoEdicion){cerrarEditor();return;}
    const id=(empleadoEdicion["NO. EMPLEADO"]||"").toString();

    const payload={
        idInterno:      empleadoEdicion["ID INTERNO"] || "",
        numeroEmpleado: id,
        empresa:        empleadoEdicion["EMPRESA"] || "",
        campos:{
            "NO. EMPLEADO":            document.getElementById('ed_noEmpleado')?.value||undefined,
            "EMPRESA":                 document.getElementById('ed_empresa')?.value||undefined,
            "GRUPO COMERCIAL":         document.getElementById('ed_grupoComercial')?.value||undefined,
            "PUESTO":                  document.getElementById('ed_puesto')?.value||undefined,
            "DEPARTAMENTO":            document.getElementById('ed_departamento')?.value||undefined,
            "TIPO DE INGRESO":         document.getElementById('ed_tipoIngreso')?.value||undefined,
            "SUELDO MENSUAL":          document.getElementById('ed_sueldo')?.value||undefined,
            "FRECUENCIA DE PAGO":      document.getElementById('ed_frecPago')?.value||undefined,
            "FUENTE DE CONTRATACIÓN":  document.getElementById('ed_fuenteCont')?.value||undefined,
            "CURP":                    document.getElementById('ed_curp')?.value||undefined,
            "RFC":                     document.getElementById('ed_rfc')?.value||undefined,
            "NSS":                     document.getElementById('ed_nss')?.value||undefined,
            "LUGAR DE NACIMIENTO":     document.getElementById('ed_lugarNac')?.value||undefined,
            "NACIONALIDAD":            document.getElementById('ed_nacionalidad')?.value||undefined,
            "ESTADO CIVIL":            document.getElementById('ed_edoCivil')?.value||undefined,
            "ESCOLARIDAD":             document.getElementById('ed_escolaridad')?.value||undefined,
            "CORREO ELECTRÓNICO":      document.getElementById('ed_correo')?.value||undefined,
            "TELÉFONO PERSONAL":       document.getElementById('ed_telefono')?.value||undefined,
            "DOMICILIO COMPLETO (CALLE, NÚMERO, COLONIA, CP, ESTADO Y MUNICIPIO)": document.getElementById('ed_domicilio')?.value||undefined,
            "CONTACTO DE EMERGENCIA":  document.getElementById('ed_contEmerg')?.value||undefined,
            "PARENTESCO":              document.getElementById('ed_parEmerg')?.value||undefined,
            "TELÉFONO DE EMERGENCIA":  document.getElementById('ed_telEmerg')?.value||undefined,
            "NOMBRE DEL BENEFICIARIO": document.getElementById('ed_nomBenef')?.value||undefined,
            "RFC DEL BENEFICIARIO":    document.getElementById('ed_rfcBenef')?.value||undefined,
            "PARENTESCO DEL BENEFICIARIO": document.getElementById('ed_parBenef')?.value||undefined,
            "PORCENTAJE DE ASIGNACIÓN":document.getElementById('ed_pctBenef')?.value||undefined,
            "TIPO DE CONTRATO":        document.getElementById('ed_tipoContrato')?.value||undefined,
            // Fechas de contratos 1-6 (editables directamente)
            "FECHA DE INICIO DEL PRIMER CONTRATO":    document.getElementById('ed_ini1contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL PRIMER CONTRATO":document.getElementById('ed_ven1contrato')?.value||undefined,
            "FECHA DE INICIO DEL SEGUNDO CONTRATO":   document.getElementById('ed_ini2contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO":document.getElementById('ed_ven2contrato')?.value||undefined,
            "FECHA DE INICIO DEL TERCER CONTRATO":    document.getElementById('ed_ini3contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL TERCER CONTRATO":document.getElementById('ed_ven3contrato')?.value||undefined,
            "FECHA DE INICIO DEL CUARTO CONTRATO":    document.getElementById('ed_ini4contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL CUARTO CONTRATO":document.getElementById('ed_ven4contrato')?.value||undefined,
            "FECHA DE INICIO DEL QUINTO CONTRATO":    document.getElementById('ed_ini5contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL QUINTO CONTRATO":document.getElementById('ed_ven5contrato')?.value||undefined,
            "FECHA DE INICIO DEL SEXTO CONTRATO":     document.getElementById('ed_ini6contrato')?.value||undefined,
            "FECHA DE VENCIMIENTO DEL SEXTO CONTRATO":document.getElementById('ed_ven6contrato')?.value||undefined,
            "ENTREVISTA DE AJUSTE 15 DÍAS": document.getElementById('ed_ent15')?.value||undefined,
            "ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS": document.getElementById('ed_ent45')?.value||undefined,
            "FECHA EVALUACIÓN 360":    document.getElementById('ed_eval360')?.value||undefined,
            "JEFE DIRECTO":            document.getElementById('ed_jefeDirecto')?.value||undefined,
            "CORREO ACCESO":           document.getElementById('ed_correoAcceso')?.value||undefined,
            // Campos de baja — motivo: si es "Otro*" usar el texto del campo especificado
            "FECHA DE BAJA":           document.getElementById('ed_fechaBaja')?.value    || undefined,
            "TIPO DE SALIDA":          document.getElementById('ed_tipoSalida')?.value   || undefined,
            "MOTIVO DE SALIDA":        (()=>{
                var m = document.getElementById('ed_motivoBaja')?.value || "";
                if (m && m.toLowerCase().startsWith("otro")) {
                    var esp = (document.getElementById('ed_motivoBajaOtroTexto')?.value||"").trim();
                    return esp ? ("Otro: "+esp) : m;
                }
                return m || undefined;
            })(),
            "MONTO DE FINIQUITO":      (()=>{ const v=document.getElementById('ed_finiquito')?.value; return (v!==undefined&&v!=='')?v:undefined; })(),
        }
    };
    // Limpiar undefined
    Object.keys(payload.campos).forEach(k=>{if(payload.campos[k]===undefined)delete payload.campos[k];});

    mostrarLoader("Guardando cambios...");
    try{
        const r=await enviarPeticion("actualizar_empleado",payload);
        ocultarLoader();
        if(r.status==="success"){
            mostrarToast('success','Cambios guardados','Cambios guardados para #'+id+'.');
            cerrarEditor();forzarActualizacion();
        }else mostrarToast('error','Error al guardar',r.message);
    }catch(e){ocultarLoader();mostrarToast('error','Error de conexión',e.message);}
}

// ─── MOTIVOS DE SALIDA POR TIPO ───────────────────────────────
const MOTIVOS_VOLUNTARIA = [
    "Mejor oferta económica en otra empresa",
    "Oportunidad de crecimiento o desarrollo profesional",
    "Inconformidad con el salario o prestaciones",
    "Problemas con el jefe directo o liderazgo",
    "Mal ambiente laboral o conflictos con compañeros",
    "Carga de trabajo excesiva o estrés",
    "Falta de oportunidades de promoción",
    "Horario laboral / falta de equilibrio vida-trabajo",
    "Distancia o problemas de traslado",
    "Motivos personales o familiares",
    "Cambio de residencia o ciudad",
    "Regreso a estudios",
    "Problemas de salud",
    "Jubilación",
    "Inicio de negocio propio",
    "Inconformidad con funciones del puesto",
    "Discriminación / acoso / hostigamiento",
    "Falta de herramientas para desempeñar el trabajo",
    "Trabajo que representa riesgo para su salud",
    "Falta de capacitación",
    "Necesidad de cuidar a familiares enfermos",
    "Problemas legales",
    "Matrimonio",
    "Necesidad de atender a los hijos",
    "Otro"
];
const MOTIVOS_INVOLUNTARIA = [
    "Terminación de contrato temporal",
    "Rescisión por bajo desempeño",
    "Ausentismo o faltas injustificadas",
    "Indisciplina o incumplimiento de políticas",
    "Recorte de personal o reestructura",
    "Cierre de área o departamento",
    "Fin de proyecto",
    "Abandono de empleo",
    "Rescisión justificada (LFT Art. 47)",
    "Incapacidad permanente",
    "Fallecimiento",
    "Otro (especifique)"
];

function buildMotivosOpts(tipo, valActual) {
    var lista = tipo === "Voluntaria" ? MOTIVOS_VOLUNTARIA
              : tipo === "Involuntaria" ? MOTIVOS_INVOLUNTARIA
              : [];
    if (!lista.length) return '<option value="">Selecciona tipo de salida primero...</option>';
    return '<option value="">Selecciona...</option>'
         + lista.map(function(m){
               var sel = (m === valActual) ? ' selected' : '';
               return '<option value="'+m+'"'+sel+'>'+m+'</option>';
           }).join('');
}

function actualizarMotivosBaja(tipo, idSelect, idOtro) {
    var sel = document.getElementById(idSelect);
    var valActual = sel ? sel.value : "";
    if (sel) sel.innerHTML = buildMotivosOpts(tipo, valActual);
    // Ocultar campo "otro" al cambiar tipo
    var divOtro = document.getElementById(idOtro);
    if (divOtro) divOtro.classList.add('hidden');
}

function toggleOtroBaja(val, idOtro) {
    var divOtro = document.getElementById(idOtro);
    if (!divOtro) return;
    var esOtro = val && val.toLowerCase().startsWith("otro");
    if (esOtro) divOtro.classList.remove('hidden');
    else divOtro.classList.add('hidden');
}

async function subirContratoFirmado(idInterno) {
    // Crear input file temporal
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,image/*';
    input.onchange = async function() {
        var file = input.files[0];
        if (!file) return;
        mostrarLoader('Subiendo contrato firmado...');
        try {
            // Leer como base64
            var b64 = await new Promise(function(res, rej) {
                var reader = new FileReader();
                reader.onload = function(e) { res(e.target.result.split(',')[1]); };
                reader.onerror = rej;
                reader.readAsDataURL(file);
            });
            var r = await enviarPeticion('subir_contrato_firmado', {
                idInterno: idInterno,
                nombre: file.name,
                tipo: file.type,
                datos: b64
            });
            ocultarLoader();
            if (r.status === 'success') {
                mostrarToast('success', 'Contrato subido', 'El contrato firmado quedó registrado.', 5000);
                forzarActualizacion();
                // Reabrir drawer del mismo empleado
                setTimeout(function(){
                    var emp = cacheGlobal.find(function(e){ return (e["ID INTERNO"]||"").toString()===idInterno; });
                    if (emp) abrirEditor(emp);
                }, 1500);
            } else {
                mostrarToast('error', 'Error al subir', r.message || 'Intenta de nuevo.');
            }
        } catch(e) {
            ocultarLoader();
            mostrarToast('error', 'Error', e.message);
        }
    };
    input.click();
}

// ─── OFFBOARDING AUTOCOMPLETE ─────────────────────────────────
function initAutocomplete(){
    const input=document.getElementById('baja_busqueda');
    const lista=document.getElementById('baja_sugerencias');
    if(!input||!lista)return;
    const nuevo=input.cloneNode(true);input.parentNode.replaceChild(nuevo,input);
    nuevo.addEventListener('input',function(){
        const q=nuevo.value.trim().toLowerCase();
        lista.innerHTML='';
        document.getElementById('baja_idEmpleado').value='';
        document.getElementById('baja_nombreEmpleado').value='';
        document.getElementById('baja_empleado_badge').classList.add('hidden');
        if(q.length<2){lista.classList.add('hidden');return;}
        const hits = cacheGlobal.filter(function(e) {
            if ((e['ESTATUS']||'').trim() !== 'Activo') return false;
            return (e['NOMBRE DEL TRABAJADOR']||'').toLowerCase().includes(q)
                || (e['NO. EMPLEADO']||'').toString().includes(q)
                || (e['ID INTERNO']||'').toString().toLowerCase().includes(q);
        }).slice(0, 8);
        if(!hits.length){ lista.classList.add('hidden'); return; }
        lista.classList.remove('hidden');
        lista.innerHTML = hits.map(function(emp) {
            const est   = (emp['ESTATUS']||'').trim();
            const col   = est==='Activo' ? 'text-emerald-600' : 'text-red-500';
            const nomE  = (emp['NOMBRE DEL TRABAJADOR']||'—').replace(/'/g,"\\'");
            const emp2  = (emp['EMPRESA']||'').replace(/'/g,"\\'");
            const pu    = (emp['PUESTO']||'').replace(/'/g,"\\'");
            const idInt = (emp['ID INTERNO']||'').toString().trim().replace(/'/g,"\\'");
            const noEmp = (emp['NO. EMPLEADO']||'').toString().trim().replace(/'/g,"\\'");
            const label = idInt ? idInt : ('#'+noEmp);
            return '<button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition"'
                 + ' onclick="seleccionarEmpleado(\'' + idInt + '\',\'' + nomE + '\',\'' + est + '\',\'' + emp2 + '\',\'' + pu + '\',\'' + noEmp + '\')">'
                 + '<div class="flex items-center justify-between gap-3">'
                 + '<div><p class="text-sm font-semibold text-slate-800">' + (emp['NOMBRE DEL TRABAJADOR']||'—') + '</p>'
                 + '<p class="text-xs text-slate-400">' + label + ' · ' + (emp['EMPRESA']||'') + ' · ' + (emp['PUESTO']||'') + '</p></div>'
                 + '<span class="text-xs font-bold ' + col + ' flex-shrink-0">' + est + '</span>'
                 + '</div></button>';
        }).join('');
    });
    document.addEventListener('click',e=>{if(!lista.contains(e.target)&&e.target!==nuevo)lista.classList.add('hidden');});
}

let empleadoSeleccionado = null;

function seleccionarEmpleado(idInterno, nombre, estatus, empresa, puesto, noEmp){
    // Buscar en cache usando ID INTERNO + Empresa (evita ambigüedad con No.Empleado duplicado)
    empleadoSeleccionado = cacheGlobal.find(function(e){
        var eId  = (e["ID INTERNO"]||"").toString().trim();
        var eNo  = (e["NO. EMPLEADO"]||"").toString().trim();
        var eEmp = (e["EMPRESA"]||"").trim();
        if(idInterno && eId) return eId===idInterno && eEmp===empresa;
        return eNo===(noEmp||"") && eEmp===empresa;
    }) || null;
    // Guardar ID INTERNO y No.Empleado en campos separados
    document.getElementById('baja_idEmpleado').value = idInterno||"";
    if(document.getElementById('baja_noEmpleado')) document.getElementById('baja_noEmpleado').value = noEmp||"";
    if(document.getElementById('baja_empresaEmpleado')) document.getElementById('baja_empresaEmpleado').value = empresa||"";
    document.getElementById('baja_nombreEmpleado').value = nombre;
    document.getElementById('baja_sugerencias').classList.add('hidden');
    const badge=document.getElementById('baja_empleado_badge');
    badge.classList.remove('hidden');
    const col=estatus==='Activo'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600';
    const labelId = idInterno||('#'+noEmp);
    badge.innerHTML=`<div class="flex items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><i class="fas fa-user text-slate-500"></i></div><div><p class="text-sm font-bold text-slate-800">${nombre}</p><p class="text-xs text-slate-400">${labelId} · ${empresa} · ${puesto}</p></div></div><span class="text-xs font-bold px-2.5 py-1 rounded-full ${col}">${estatus}</span></div>`;
}

async function procesarBaja(event){
    event.preventDefault();
    const id=document.getElementById('baja_idEmpleado').value.trim();
    const nom=document.getElementById('baja_nombreEmpleado').value.trim();
    if(!id&&!nom){mostrarToast('warning','Selecciona un colaborador','Escribe y selecciona el nombre del colaborador primero.');return;}
    mostrarLoader("Procesando baja...");
    // Leer campos hidden que seleccionarEmpleado guardó correctamente
    const idInternoVal = (document.getElementById('baja_idEmpleado')?.value||"").trim();
    const noEmpVal     = (document.getElementById('baja_noEmpleado')?.value||"").trim();
    const empresaVal   = (document.getElementById('baja_empresaEmpleado')?.value||"").trim();
    console.log('[procesarBaja] idInterno:', idInternoVal, '| noEmp:', noEmpVal, '| empresa:', empresaVal);
    const payload = {
        idInterno:      idInternoVal,
        numeroEmpleado: noEmpVal,
        empresa:        empresaVal,
        nombreEmpleado: nom,
        fechaBaja:      document.getElementById('baja_fechaBaja').value,
        tipoSalida:     document.getElementById('baja_tipoSalida').value,
        motivoSalida:   (()=>{
            var m = document.getElementById('baja_motivoSalida')?.value || "";
            if (m && m.toLowerCase().startsWith("otro")) {
                var esp = (document.getElementById('baja_motivoOtroTexto')?.value||"").trim();
                return esp ? ("Otro: "+esp) : m;
            }
            return m;
        })(),
        montoFiniquito: document.getElementById('baja_montoFiniquito').value
    };
    try{
        const r=await enviarPeticion("baja",payload);ocultarLoader();
        if(r.status==="success"){
            // Generar link encuesta de salida
            // Usar empleadoSeleccionado o empBaja (ya buscado del cache)
            const fuenteEmp = empleadoSeleccionado || empBaja || null;
            const idInt = fuenteEmp ? (fuenteEmp["ID INTERNO"]||"") : "";
            const linkEnc = idInt
                ? location.origin+'/encuesta.html?enc=SALIDA&idInterno='+encodeURIComponent(idInt)
                : location.origin+'/encuesta.html?enc=SALIDA';
            // Mostrar modal con confirmación y link
            console.log('[Baja OK] idInt:', idInt, 'linkEnc:', linkEnc, 'empleadoSel:', empleadoSeleccionado);
            Swal.fire({
                icon:'success',
                title:'Baja registrada',
                html:'<p style="color:#475569;margin-bottom:16px;">'+r.message+'</p>'
                    +'<div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:14px;text-align:left;">'
                    +'<p style="font-size:.75rem;font-weight:700;color:#7c3aed;margin-bottom:6px;"><i class="fas fa-link" style="margin-right:4px;"></i>Encuesta de Salida</p>'
                    +'<p style="font-size:.72rem;color:#94a3b8;word-break:break-all;margin-bottom:10px;">'+linkEnc+'</p>'
                    +'<p style="font-size:.72rem;color:#94a3b8;word-break:break-all;margin-bottom:10px;" id="enc-link-txt">'+linkEnc+'</p>'
                    +'<button id="btn-copy-enc-link" style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px;font-size:.82rem;font-weight:700;cursor:pointer;">'
                    +'<i class="fas fa-copy" style="margin-right:6px;"></i>Copiar link para compartir</button>'
                    +'</div>',
                didOpen: function(){
                    const btn = document.getElementById('btn-copy-enc-link');
                    if(btn) btn.onclick = function(){
                        navigator.clipboard.writeText(linkEnc).then(function(){
                            btn.textContent = '✅ ¡Link copiado!';
                        });
                    };
                },
                confirmButtonText:'Entendido',
                confirmButtonColor:'#7c3aed'
            });
            document.getElementById('formBaja').reset();
            document.getElementById('baja_empleado_badge').classList.add('hidden');
            document.getElementById('baja_sugerencias').classList.add('hidden');
            empleadoSeleccionado = null;
            document.getElementById('baja_busqueda').value = '';
            forzarActualizacion();
        }
        else mostrarToast('warning','No encontrado',r.message);
    }catch(e){ocultarLoader();mostrarToast('error','Error',e.message);}
}

// ─── CACHÉ Y DATOS ────────────────────────────────────────────
let cacheGlobal=[];
let cacheTimestamp=0;
const CACHE_TTL=5*60*1000; // 5 minutos — no volver a pedir datos al backend antes de este tiempo

async function obtenerDatos(forzar){
    const ahora=Date.now();
    // Usar caché si: no se forzó, hay datos, y no expiró el TTL
    if(!forzar && cacheGlobal.length && (ahora-cacheTimestamp)<CACHE_TTL) return cacheGlobal;
    mostrarLoader("Sincronizando base de datos...");
    // BUGFIX: esta petición lee toda la hoja (getValues + getDisplayValues),
    // es la más pesada del sistema. Con el timeout genérico de 25s se abortaba
    // de forma intermitente en hojas grandes o con GAS "frío", y el catch()
    // fallaba en silencio devolviendo caché vieja o [] sin avisar nada — eso
    // se sentía como "a veces carga, a veces no". Ahora: 45s de margen,
    // un reintento automático, y aviso visible si de plano falla.
    for(let intento=1; intento<=2; intento++){
        try{
            const r=await enviarPeticion("exportar_datos",{},45000);
            ocultarLoader();
            if(r.status==="success"){
                // cacheGlobal: TODOS los registros sin deduplicar (Expedientes, Bajas, autocomplete)
                // BUGFIX: antes se exigía "NO. EMPLEADO" no vacío para conservar el registro,
                // pero ese campo se repite entre empresas y puede venir vacío en reingresos o
                // registros dados de alta solo con ID INTERNO (el identificador confiable del
                // proyecto). Esto descartaba silenciosamente empleados activos de TODO el
                // sistema — incluidas las alertas de cumpleaños/aniversario. Ahora basta con
                // tener CUALQUIERA de los dos identificadores.
                cacheGlobal=r.data.filter(e=>{
                    const idInt=(e["ID INTERNO"]||"").toString().trim();
                    const noEmp=(e["NO. EMPLEADO"]||"").toString().trim();
                    return idInt!=="" || noEmp!=="";
                });
                cacheTimestamp=Date.now();
                return cacheGlobal;
            }
            // El servidor respondió pero con error explícito (ej. permisos, GAS)
            console.error('[obtenerDatos] Backend devolvió error:', r.message);
            mostrarToast('error','No se pudo sincronizar', r.message||'El servidor respondió con un error.');
            return cacheGlobal.length?cacheGlobal:[];
        }catch(e){
            console.error('[obtenerDatos] Error de red/timeout (intento '+intento+'):', e.message||e);
            if(intento===1){ await new Promise(res=>setTimeout(res,1000)); continue; }
            ocultarLoader();
            if(cacheGlobal.length){
                mostrarToast('warning','Mostrando datos en caché','No se pudo actualizar la información desde el servidor. '+(e.message||''));
            } else {
                mostrarToast('error','No se pudo cargar la información', e.message||'Revisa tu conexión e intenta de nuevo.');
            }
            return cacheGlobal.length?cacheGlobal:[];
        }
    }
}
async function forzarActualizacion(){
    cacheGlobal=[];
    datosFiltrados=[];
    cacheTimestamp=0;
    dashboardCargado=false;
    await cargarCatalogoEmpresas();
    const datos=await obtenerDatos(true);
    actualizarListaEmpresas(); // actualizar lista de empresas dinámicamente
    poblarCatalogos(); // actualizar catálogos de departamentos y puestos
    evaluarAlertas(datos);
    cargarDashboard();
    if(document.getElementById('module-basedatos')?.classList.contains('active')){
        datosFiltrados=[...cacheGlobal];
        renderizarPagina(1);
    }
    initAutocomplete();
}

// ─── DIRECTORIO CON FILTROS ───────────────────────────────────
let paginaActual   = 1;
const FILAS_PAG    = 50;
let datosFiltrados = [];

async function cargarDatosTabla() {
    await obtenerDatos(false); // usa caché si está fresco (TTL 5 min)
    // Aplicar filtro de empresas permitidas del usuario (Auxiliares solo ven sus empresas)
    datosFiltrados = [...filtrarPorEmpresasPermitidas(cacheGlobal)];
    actualizarListaEmpresas();
    paginaActual = 1;
    renderizarPagina(1);
}

function aplicarFiltros() {
    const busqueda = (document.getElementById('filtro-busqueda')?.value || '').toLowerCase().trim();
    const empresa  = (document.getElementById('filtro-empresa')?.value  || '').trim();
    const grupo    = (document.getElementById('filtro-grupo')?.value    || '').trim();
    const estatus  = (document.getElementById('filtro-estatus')?.value  || '').trim();

    const _baseExpedientes = filtrarPorEmpresasPermitidas(cacheGlobal);
    datosFiltrados = _baseExpedientes.filter(emp => {
        const nombre = (emp["NOMBRE DEL TRABAJADOR"] || "").toLowerCase();
        const noEmp  = (emp["NO. EMPLEADO"] || "").toString().toLowerCase();
        const puesto = (emp["PUESTO"] || "").toLowerCase();
        const empVal = (emp["EMPRESA"] || "").toString().trim();
        // BUGFIX 07 jul 2026: el catálogo EMPRESAS es la fuente de verdad;
        // el valor guardado por empleado solo se usa si la empresa no está
        // en el catálogo (caso raro, empresa no dada de alta ahí todavía).
        const grpVal = grupoDeEmpresa(empVal) || (emp["GRUPO COMERCIAL"] || "").toString().trim();
        const pasaBusqueda = !busqueda || nombre.includes(busqueda) || noEmp.includes(busqueda) || puesto.includes(busqueda);
        const pasaEmpresa  = !empresa  || empVal === empresa;
        const pasaGrupo    = !grupo    || _normGrupo(grpVal) === _normGrupo(grupo);
        const pasaEstatus  = !estatus  || (emp["ESTATUS"] || "").toString().trim() === estatus;
        return pasaBusqueda && pasaEmpresa && pasaGrupo && pasaEstatus;
    });

    paginaActual = 1;
    renderizarPagina(1);

    const hayFiltros  = busqueda || empresa || grupo || estatus;
    const btnLimpiar  = document.getElementById('btn-limpiar-filtros');
    const contador    = document.getElementById('contador-filtros');
    if (btnLimpiar) btnLimpiar.classList.toggle('hidden', !hayFiltros);
    if (contador)   contador.textContent = hayFiltros ? datosFiltrados.length + ' de ' + cacheGlobal.length + ' resultados' : '';
}

function limpiarFiltros() {
    ['filtro-busqueda','filtro-empresa','filtro-grupo','filtro-estatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    aplicarFiltros();
}

function limpiarFiltrosDashboard(){
    ['filtroEmpresaGlobal','filtroGrupoGlobal','filtroMesGlobal','filtroAnioGlobal'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.value='ALL';
    });
    cargarDashboard();
}

function renderizarPagina(pag) {
    const datos     = datosFiltrados;
    const totalPags = Math.max(1, Math.ceil(datos.length / FILAS_PAG));
    paginaActual    = Math.max(1, Math.min(pag, totalPags));
    const ini       = (paginaActual - 1) * FILAS_PAG;
    const slice     = datos.slice(ini, ini + FILAS_PAG);
    const tbody     = document.getElementById('tabla-directorio');
    const sinRes    = document.getElementById('sin-resultados');

    tbody.innerHTML = '';

    if (!datos.length) {
        if (sinRes) sinRes.classList.remove('hidden');
    } else {
        if (sinRes) sinRes.classList.add('hidden');
        slice.forEach(emp => {
            const est   = (emp["ESTATUS"] || "").trim();
            const color = est === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
            // URL del expediente en Drive — columna AX del Sheet
            const urlRaw  = emp["URL EXPEDIENTE"] || emp["URL EXPEDIENTE "] || "";
            const url     = urlRaw.toString().replace(/\s+/g,'').trim();
            const urlOk   = url.indexOf('http') === 0;
            const link    = urlOk
                ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" '
                  + 'class="text-slate-400 hover:text-blue-600 transition" '
                  + 'title="Abrir expediente en Drive" '
                  + 'onclick="event.stopPropagation()">'
                  + '<i class="fas fa-folder-open text-sm"></i></a>'
                : '<span class="text-slate-400" title="Sin expediente asignado">'
                  + '<i class="fas fa-folder text-sm"></i></span>';
            const id    = (emp["NO. EMPLEADO"] || "").toString();
            const nom   = (emp["NOMBRE DEL TRABAJADOR"] || "—").replace(/'/g, "\'");
            // Badge reingreso — tiene historial si ID_PERSONA existe
            const idPer = (emp["ID_PERSONA"]||"").toString().trim();
            const badgeReingreso = idPer
                ? ' <span title="Tiene historial de carrera" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 text-violet-500 ml-0.5" style="flex-shrink:0"><i class="fas fa-rotate" style="font-size:9px"></i></span>'
                : '';

            let alerta = '';
            [emp["FECHA DE VENCIMIENTO DEL PRIMER CONTRATO"],
             emp["FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO"],
             emp["FECHA DE VENCIMIENTO DEL TERCER CONTRATO"]].forEach(v => {
                if (!v) return;
                const d = diasRestantes(v);
                if (d !== null && d <= 30 && est === "Activo") {
                    alerta = '<i class="fas fa-triangle-exclamation text-amber-400 ml-1 text-xs" title="Contrato por vencer"></i>';
                }
            });

            tbody.innerHTML += '<tr class="hover:bg-slate-50 border-b border-slate-100 transition">'
                + '<td class="px-3 py-3 font-semibold text-slate-700 text-sm whitespace-nowrap">#' + id + '</td>'
                + '<td class="px-3 py-3 text-sm font-medium" style="max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (emp["NOMBRE DEL TRABAJADOR"] || "—") + alerta + badgeReingreso + '</td>'
                + '<td class="px-3 py-3 text-xs text-slate-500" style="max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (emp["EMPRESA"] || "—") + '</td>'
                + '<td class="px-3 py-3 text-xs text-slate-500" style="max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (emp["PUESTO"]  || "—") + '</td>'
                + '<td class="px-3 py-3 whitespace-nowrap"><span class="px-2 py-1 text-xs font-semibold rounded-full ' + color + '">' + (est || "—") + '</span></td>'
                + '<td class="px-3 py-3"><div class="flex items-center justify-center gap-2">'
                + '<button onclick="abrirEditor(\'' + (emp['ID INTERNO']||id) + '\',\'' + (emp['EMPRESA']||'').replace(/'/g,'') + '\')" class="text-slate-400 hover:text-blue-600 transition" title="Editar"><i class="fas fa-pen-to-square text-sm"></i></button>'
                + '<button onclick="abrirModalGenerarContrato(\'' + (emp['ID INTERNO']||'') + '\')" class="text-slate-400 hover:text-indigo-600 transition" title="Generar contrato"><i class="fas fa-file-contract text-sm"></i></button>'
                + '<button onclick="abrirModalDocs(\'' + id + '\',\'' + nom + '\',\'' + (emp['ID INTERNO']||'') + '\')" class="text-slate-400 hover:text-emerald-600 transition" title="Subir documentos"><i class="fas fa-file-arrow-up text-sm"></i></button>'
                + link
                + '</div></td></tr>';
        });
    }

    const pg = document.getElementById('paginacion-directorio');
    if (!pg) return;
    const ini2 = ini + 1, fin2 = Math.min(ini + FILAS_PAG, datos.length);
    pg.innerHTML = '<div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">'
        + '<span class="text-sm text-slate-500">Mostrando <strong>' + ini2 + '–' + fin2 + '</strong> de <strong>' + datos.length + '</strong></span>'
        + '<div class="flex gap-2">'
        + '<button onclick="renderizarPagina(' + (paginaActual-1) + ')" ' + (paginaActual<=1?'disabled':'') + ' class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">← Anterior</button>'
        + '<span class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg">' + paginaActual + ' / ' + totalPags + '</span>'
        + '<button onclick="renderizarPagina(' + (paginaActual+1) + ')" ' + (paginaActual>=totalPags?'disabled':'') + ' class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">Siguiente →</button>'
        + '</div></div>';

    const sub = document.getElementById('subtitulo-directorio');
    if (sub) sub.innerText = cacheGlobal.length + ' colaboradores en la base maestra';
}

// ─── SUBIDA DE DOCUMENTOS AL EXPEDIENTE ───────────────────────
let modalDocsId      = null;
let modalDocsNom     = null;
let modalDocsIdInt   = null;

function abrirModalDocs(id, nombre, idInterno) {
    modalDocsId    = id;
    modalDocsNom   = nombre;
    modalDocsIdInt = idInterno || '';
    const label = document.getElementById('modal-docs-empleado');
    if (label) label.textContent = '#' + id + ' — ' + nombre;
    const input = document.getElementById('modal-archivos');
    if (input) input.value = '';
    const lista = document.getElementById('modal-lista-archivos');
    if (lista) lista.innerHTML = '';
    const prog = document.getElementById('modal-progreso');
    if (prog) prog.classList.add('hidden');
    document.getElementById('modal-docs').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function cerrarModalDocs() {
    document.getElementById('modal-docs').classList.add('hidden');
    document.body.style.overflow = '';
    modalDocsId = null; modalDocsNom = null; modalDocsIdInt = null;
}

function manejarDropModal(event) {
    event.preventDefault();
    document.getElementById('modal-drop-zone').classList.remove('border-blue-400','bg-blue-50');
    const trans = new DataTransfer();
    Array.from(event.dataTransfer.files).forEach(f => trans.items.add(f));
    document.getElementById('modal-archivos').files = trans.files;
    actualizarListaModal();
}

function actualizarListaModal() {
    const input = document.getElementById('modal-archivos');
    const lista = document.getElementById('modal-lista-archivos');
    if (!lista || !input) return;
    lista.innerHTML = Array.from(input.files).map(f => {
        const mb = (f.size/1024/1024).toFixed(1), ok = f.size <= 10*1024*1024;
        const ic = f.type === 'application/pdf' ? 'fa-file-pdf text-red-400' : 'fa-file-image text-blue-400';
        return '<div class="flex items-center gap-3 bg-slate-50 border ' + (ok?'border-slate-200':'border-red-200') + ' rounded-xl px-3 py-2">'
            + '<i class="fas ' + ic + ' text-base flex-shrink-0"></i>'
            + '<div class="flex-1 min-w-0"><p class="text-xs font-medium text-slate-700 truncate">' + f.name + '</p>'
            + '<p class="text-xs ' + (ok?'text-slate-400':'text-red-400') + '">' + mb + ' MB' + (ok?'':' — supera 10 MB') + '</p></div>'
            + '<i class="fas ' + (ok?'fa-check-circle text-emerald-400':'fa-times-circle text-red-400') + ' flex-shrink-0"></i></div>';
    }).join('');
}

async function subirDocumentosExpediente() {
    if (!modalDocsId) return;
    const input = document.getElementById('modal-archivos');
    if (!input || !input.files.length) {
        mostrarToast('warning','Sin archivos','Selecciona al menos un archivo.');
        return;
    }
    const archivos = Array.from(input.files);
    const btn = document.getElementById('btn-subir-docs');
    const prog = document.getElementById('modal-progreso');
    const bar  = document.getElementById('modal-progreso-bar');
    const txt  = document.getElementById('modal-progreso-txt');
    const pct  = document.getElementById('modal-progreso-pct');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
    prog.classList.remove('hidden');

    let subidos = 0, errores = 0;
    for (let i = 0; i < archivos.length; i++) {
        const file = archivos[i];
        txt.textContent = 'Subiendo: ' + file.name;
        const p = Math.round(i / archivos.length * 100);
        bar.style.width = p + '%'; pct.textContent = p + '%';

        if (file.size > 10*1024*1024) { errores++; continue; }

        try {
            const b64 = await new Promise((res,rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(',')[1]);
                r.onerror = rej;
                r.readAsDataURL(file);
            });
            const resp = await enviarPeticion('subir_documento', {
                idInterno:      modalDocsIdInt || '',
                numeroEmpleado: modalDocsId,
                nombreArchivo:  file.name,
                mimeType:       file.type || 'application/octet-stream',
                data:           b64
            }, 45000); // timeout largo: la primera subida a un empleado sin carpeta aún crea carpeta+subcarpeta en Drive
            if (resp.status === 'success') subidos++;
            else { errores++; console.warn(file.name, resp.message); }
        } catch(e) { errores++; }
    }

    bar.style.width = '100%'; pct.textContent = '100%'; txt.textContent = 'Completado';
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> Subir al expediente';
        cerrarModalDocs();
        if (errores === 0) {
            mostrarToast('success', subidos + ' archivo(s) subidos', 'Guardados en el expediente de ' + modalDocsNom + '.', 6000);
        } else {
            mostrarToast('warning', subidos + ' subidos, ' + errores + ' con error', 'Algunos archivos fallaron. Verifica el tamaño.', 6000);
        }
    }, 600);
}

// ─── DASHBOARD ────────────────────────────────────────────────
let charts={};
// Paleta única para todas las gráficas. Antes cada una elegía sus
// colores por su cuenta: seis paletas distintas en un mismo tablero.
// Criterio: violeta = plantilla y estructura · rojo = SOLO bajas ·
// ámbar = SOLO dinero. Las escalas ordinales (edad, motivos) usan
// degradado de un tono, no colores distintos: cuatro azules sugieren
// cuatro categorías sin relación cuando en realidad son un rango.
const PAL = {
  primario:  '#6d3ee8',   // violeta: plantilla activa, estructura
  primario2: '#8b6df0',
  primario3: '#a99bf5',
  primario4: '#c9c1f9',
  baja:      '#e0524d',   // rojo: bajas, y solo bajas
  baja2:     '#eb7d78',
  baja3:     '#f2a5a1',
  baja4:     '#f7c9c6',
  dinero:    '#dd9127',   // ámbar: finiquitos
  activos:   '#3f9d78',   // verde: línea acumulada
  grid:      '#eeecf5',   // rejilla tintada hacia violeta, no gris puro
  texto:     '#6b6880'
};
const CD={
  responsive:true,
  maintainAspectRatio:false,
  plugins:{
    legend:{labels:{font:{family:"'Inter',sans-serif",size:11},padding:10,boxWidth:10,boxHeight:10,color:PAL.texto}},
    tooltip:{
      backgroundColor:'#241f35',
      titleFont:{family:"'Inter',sans-serif",size:12,weight:'600'},
      bodyFont:{family:"'Inter',sans-serif",size:12},
      padding:10,cornerRadius:8,displayColors:true,boxPadding:4
    }
  }
};
// Helper para mostrar/ocultar mensajes "sin datos" en contenedores de gráficas
// sin destruir el canvas (lo que causaría null en la siguiente carga)
function chartSinDatos(canvasId, mensaje){
    const c = document.getElementById(canvasId);
    if(!c) return;
    c.style.display = 'none';
    const pid = canvasId + '_empty';
    let p = document.getElementById(pid);
    if(!p){
        p = document.createElement('p');
        p.id = pid;
        p.className = 'text-center';
        p.style.cssText = 'font-size:.8rem;color:#8d8aa3;padding-top:3rem;margin:0';
        c.parentNode.insertBefore(p, c.nextSibling);
    }
    p.textContent = mensaje;
    p.style.display = '';
}
function chartConDatos(canvasId){
    const c = document.getElementById(canvasId);
    if(!c) return;
    c.style.display = '';
    const p = document.getElementById(canvasId + '_empty');
    if(p) p.style.display = 'none';
}
function dc(r){if(r)try{r.destroy();}catch(e){}return null;}
// Crea una Chart.js solo si el canvas existe (evita null.getContext crash al re-filtrar)
function safeChart(id, config){
    const el = document.getElementById(id);
    if(!el) return null;
    chartConDatos(id);
    return new Chart(el.getContext('2d'), config);
}
function fmtMXN(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0);}
function calcEdad(val){const d=parseFechaFlexible(val);if(!d)return null;const h=new Date();let a=h.getFullYear()-d.getFullYear();if(h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate()))a--;return a>=15&&a<=85?a:null;}
function calcAnt(val){const d=parseFechaFlexible(val);if(!d)return null;const ms=new Date()-d;return ms<0?null:ms/(1000*60*60*24*365.25);}

async function cargarDashboard(){
    const _todosDash = await obtenerDatos(false);
    // Auxiliares solo ven sus empresas asignadas
    const todos = filtrarPorEmpresasPermitidas(_todosDash);
    const filtroEmp  = (document.getElementById('filtroEmpresaGlobal')?.value)||'ALL';
    const filtroGrupo= (document.getElementById('filtroGrupoGlobal')?.value)||'ALL';
    const filtroMes  = (document.getElementById('filtroMesGlobal')?.value)||'ALL';
    const filtroAnio = (document.getElementById('filtroAnioGlobal')?.value)||'ALL';

    // Poblar selector de años dinámicamente con los años en la BD
    const selAnio = document.getElementById('filtroAnioGlobal');
    if(selAnio){
        const aniosSet=new Set();
        todos.forEach(r=>{
            const d=parseFechaFlexible(r["FECHA DE INGRESO"]);
            if(d)aniosSet.add(d.getUTCFullYear());
            const db=parseFechaFlexible(r["FECHA DE BAJA"]);
            if(db)aniosSet.add(db.getUTCFullYear());
        });
        const anios=[...aniosSet].sort();
        const vActual=selAnio.value;
        selAnio.innerHTML='<option value="ALL">Todos</option>'+
            anios.map(a=>'<option value="'+a+'"'+(a.toString()===vActual?' selected':'')+'>'+a+'</option>').join('');
    }

    // ── Filtros de empresa y grupo (aplican a todos los registros) ──────────
    // El filtro de grupo usa primero la columna GRUPO COMERCIAL de la BD;
    // si está vacía, intenta resolverlo desde el catálogo (fallback).
    const hayFiltroEmp   = filtroEmp   !== 'ALL';
    const hayFiltroGrupo = filtroGrupo !== 'ALL';
    const hayFiltroMes   = filtroMes   !== 'ALL';
    const hayFiltroAnio  = filtroAnio  !== 'ALL';

    // D: empleados que pasan el filtro de empresa/grupo
    // Los filtros de mes/año NO excluyen registros del array D — se aplican
    // internamente en los contadores que lo necesitan (tendencia, finiquitos).
    // Esto garantiza que KPIs de plantilla activa, géneros y rangos de edad
    // siempre reflejen el estado real de la empresa/grupo seleccionada.
    const D=todos.filter(r=>{
        const emp=(r["EMPRESA"]||"").toString().trim();
        // Grupo: leer de la columna BD primero; luego catálogo; luego vacío
        // BUGFIX 07 jul 2026: catálogo primero (fuente de verdad), el valor
        // guardado por empleado queda solo como respaldo si la empresa no
        // está en el catálogo.
        const grp=grupoDeEmpresa(emp) || (r["GRUPO COMERCIAL"]||"").toString().trim();
        if(hayFiltroEmp   && emp!==filtroEmp)   return false;
        if(hayFiltroGrupo && _normGrupo(grp)!==_normGrupo(filtroGrupo)) return false;
        return true;
    });

    // Función auxiliar: ¿una fecha pasa el filtro mes/año activo?
    const pasaFiltroFecha = function(fDate){
        if(!fDate) return false;
        if(hayFiltroMes  && String(fDate.getUTCMonth()+1).padStart(2,'0') !== filtroMes)  return false;
        if(hayFiltroAnio && String(fDate.getUTCFullYear())                 !== filtroAnio) return false;
        return true;
    };
    // Si hay filtro mes/año activo, ¿un registro lo pasa por ingreso O por baja?
    const registroPasaFecha = function(r){
        if(!hayFiltroMes && !hayFiltroAnio) return true;
        const fI=parseFechaFlexible(r["FECHA DE INGRESO"]);
        const fB=parseFechaFlexible(r["FECHA DE BAJA"]);
        return pasaFiltroFecha(fI) || pasaFiltroFecha(fB);
    };

    let activos=0,bajas=0,cEmp={},cGen={"Hombre":0,"Mujer":0},cRango={"<31":0,"31-50":0,"51-65":0,">65":0};
    let cMotivo={},cDepto={},cTend={},finPorMes={},finPorAnio={},totalFin=0,edades=[],ants=[];

    // Los KPIs de plantilla activa, género, rango de edad y departamento
    // muestran el estado actual de la empresa/grupo SIN restricción de fecha,
    // porque un empleado activo puede haber ingresado en cualquier año.
    // Los contadores de tendencia y finiquitos SÍ respetan el filtro fecha.
    D.forEach(row=>{
        const est=(row["ESTATUS"]||"").toString().trim(),gen=(row["GÉNERO"]||"").toString().trim(),emp=(row["EMPRESA"]||"Sin Empresa").toString().trim();
        const rango=(row["RANGO DE EDAD"]||"").toString().trim(),motivo=(row["MOTIVO DE SALIDA"]||"").toString().trim(),depto=(row["DEPARTAMENTO"]||"Sin Departamento").toString().trim();
        const fIng=row["FECHA DE INGRESO"]||"",fBaja=row["FECHA DE BAJA"]||"",fNac=row["FECHA DE NACIMIENTO"]||"";
        const fin=parsearMontoSheet(row["MONTO DE FINIQUITO"]);

        if(est==="Activo"){
            activos++;
            if(gen==="Hombre"||gen==="Masculino")cGen["Hombre"]++;
            else if(gen==="Mujer"||gen==="Femenino")cGen["Mujer"]++;
            if(cRango[rango]!==undefined)cRango[rango]++;
            const ed=calcEdad(fNac);if(ed!==null)edades.push(ed);
            const an=calcAnt(fIng);if(an!==null)ants.push(an);
            cDepto[depto]=(cDepto[depto]||0)+1;
        }
        // Bajas: contar solo si pasan el filtro de fecha (fecha de baja)
        // Si no hay filtro de fecha, contar todas las bajas de empresa/grupo
        const fBD_obj = est==="Baja" ? parseFechaFlexible(fBaja) : null;
        const bajaEnPeriodo = est==="Baja" && (
            !hayFiltroMes && !hayFiltroAnio
                ? true
                : fBD_obj && pasaFiltroFecha(fBD_obj)
        );
        if(bajaEnPeriodo){
            bajas++;
            if(motivo)cMotivo[motivo]=(cMotivo[motivo]||0)+1;
            if(fin>0){
                totalFin+=fin;
                if(fBD_obj){
                    const km=fBD_obj.getUTCFullYear()+'-'+String(fBD_obj.getUTCMonth()+1).padStart(2,'0');
                    finPorMes[km]=(finPorMes[km]||0)+fin;
                    const ka=fBD_obj.getUTCFullYear().toString();
                    finPorAnio[ka]=(finPorAnio[ka]||0)+fin;
                }
            }
        }

        if(!cEmp[emp])cEmp[emp]={act:0,baj:0};
        if(est==="Activo")cEmp[emp].act++;
        if(bajaEnPeriodo)cEmp[emp].baj++;

        // Tendencia mensual: respetar filtro fecha para altas Y bajas
        const fIngD=parseFechaFlexible(fIng);
        const ingEnPeriodo=!hayFiltroMes&&!hayFiltroAnio ? !!fIngD : (fIngD && pasaFiltroFecha(fIngD));
        if(ingEnPeriodo){const k=fIngD.getUTCFullYear()+'-'+String(fIngD.getUTCMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0,activos:0};cTend[k].altas++;}
        if(bajaEnPeriodo&&fBD_obj){const k=fBD_obj.getUTCFullYear()+'-'+String(fBD_obj.getUTCMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0,activos:0};cTend[k].bajas++;}
    });

    // Calcular activos acumulados por mes (snapshot mensual)
    // El acumulado inicial = empleados activos (o que ingresaron) ANTES del primer mes visible
    // Esto evita que la línea de activos empiece en 0 al filtrar por año
    const mesesOrdenados=Object.keys(cTend).sort();
    let acumActivos = 0;
    if(mesesOrdenados.length > 0){
        const primerMes = mesesOrdenados[0]; // ej: "2026-01"
        // Contar del conjunto D (filtrado por empresa/grupo) los que ya estaban activos antes
        acumActivos = D.filter(r=>{
            const fI = parseFechaFlexible(r["FECHA DE INGRESO"]);
            const fB = parseFechaFlexible(r["FECHA DE BAJA"]);
            if(!fI) return false;
            const kIng = fI.getUTCFullYear()+'-'+String(fI.getUTCMonth()+1).padStart(2,'0');
            if(kIng >= primerMes) return false; // ingresó en o después del primer mes → no contar
            // Estaba activo antes: si no tiene baja, o la baja es en o después del primer mes
            if(!fB) return true;
            const kBaja = fB.getUTCFullYear()+'-'+String(fB.getUTCMonth()+1).padStart(2,'0');
            return kBaja >= primerMes;
        }).length;
    }
    mesesOrdenados.forEach(k=>{
        acumActivos+=cTend[k].altas;
        acumActivos-=cTend[k].bajas;
        cTend[k].activos=Math.max(0,acumActivos);
    });

    const tot=activos+bajas;
    const edP=edades.length?(edades.reduce((a,b)=>a+b,0)/edades.length).toFixed(1):"—";
    const anP=ants.length?(ants.reduce((a,b)=>a+b,0)/ants.length).toFixed(1):"—";

    // KPIs
    document.getElementById('kpi-total').innerText=tot;
    document.getElementById('kpi-activos').innerText=activos;
    document.getElementById('kpi-bajas').innerText=bajas;
    document.getElementById('kpi-rotacion').innerText=tot>0?((bajas/tot)*100).toFixed(1)+'%':'0%';
    document.getElementById('kpi-edad-prom').innerText=edP!=="—"?edP+' años':"—";
    document.getElementById('kpi-ant-prom').innerText=anP!=="—"?anP+' años':"—";
    document.getElementById('kpi-finiquitos').innerText=fmtMXN(totalFin);
    const totG=cGen["Hombre"]+cGen["Mujer"],pctH=totG>0?Math.round(cGen["Hombre"]/totG*100):0;
    document.getElementById('kpi-genero-h').innerText=cGen["Hombre"];
    document.getElementById('kpi-genero-m').innerText=cGen["Mujer"];
    document.getElementById('kpi-genero-bar-h').style.width=pctH+'%';
    document.getElementById('kpi-genero-bar-m').style.width=(100-pctH)+'%';

    // Tabla resumen de finiquitos por año
    const tablaFin=document.getElementById('tabla-finiquitos-anio');
    if(tablaFin){
        const aniosOrdenados=Object.keys(finPorAnio).sort((a,b)=>b-a);
        if(aniosOrdenados.length){
            tablaFin.innerHTML=aniosOrdenados.map(a=>`<tr class="border-b border-slate-100 last:border-0">
                <td class="py-2 pr-4 text-sm font-semibold text-slate-700">${a}</td>
                <td class="py-2 text-sm font-bold text-slate-800 text-right">${fmtMXN(finPorAnio[a])}</td>
            </tr>`).join('');
        } else {
            tablaFin.innerHTML='<tr><td colspan="2" class="py-6 text-center text-xs text-slate-400">Sin finiquitos registrados</td></tr>';
        }
    }

    const fmtM=k=>{const[y,m]=k.split('-');return['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]+' '+y.slice(2);};

    // ── Gráfica: Empresas ──────────────────────────────────────
    const empL=Object.keys(cEmp).map(e=>e.length>14?e.substring(0,14)+'…':e);
    charts.emp=dc(charts.emp);
    charts.emp=safeChart('chartEmpresas',{type:'bar',data:{labels:empL,datasets:[{label:'Activos',data:Object.values(cEmp).map(v=>v.act),backgroundColor:PAL.primario,borderRadius:4},{label:'Bajas',data:Object.values(cEmp).map(v=>v.baj),backgroundColor:PAL.baja,borderRadius:4}]},options:{...CD,scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,beginAtZero:true,grid:{color:PAL.grid}}}}});

    // ── Gráfica: Rango de edad ─────────────────────────────────
    charts.rango=dc(charts.rango);
    charts.rango=safeChart('chartRangoEdad',{type:'bar',data:{labels:['< 31 años','31–50 años','51–65 años','> 65 años'],datasets:[{label:'Colaboradores',data:Object.values(cRango),backgroundColor:[PAL.primario,PAL.primario2,PAL.primario3,PAL.primario4],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:PAL.grid}},y:{grid:{display:false}}}}});

    // ── Gráfica: Motivos de baja ───────────────────────────────
    const mot=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.mot=dc(charts.mot);
    if(mot.length){
        charts.mot=safeChart('chartMotivoBaja',{type:'bar',data:{labels:mot.map(([k])=>k.length>22?k.substring(0,22)+'…':k),datasets:[{label:'Bajas',data:mot.map(([,v])=>v),backgroundColor:[PAL.baja,PAL.baja,PAL.baja2,PAL.baja2,PAL.baja3,PAL.baja3,PAL.baja4,PAL.baja4],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:PAL.grid}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
    } else {
        chartSinDatos('chartMotivoBaja','Sin bajas registradas aún');
    }

    // ── Gráfica: Top departamentos ─────────────────────────────
    const dep=Object.entries(cDepto).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.dep=dc(charts.dep);
    charts.dep=safeChart('chartDeptos',{type:'bar',data:{labels:dep.map(([k])=>k.length>20?k.substring(0,20)+'…':k),datasets:[{label:'Activos',data:dep.map(([,v])=>v),backgroundColor:PAL.primario,borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:PAL.grid}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});

    // ── Gráfica: Tendencia mensual — Altas, Bajas y Activos ───
    // Muestra los últimos 24 meses con 3 líneas
    const mesesTend=mesesOrdenados.slice(-24);
    charts.tend=dc(charts.tend);
    charts.tend=safeChart('chartTendencia',{
        type:'line',
        data:{
            labels:mesesTend.map(fmtM),
            datasets:[
                {label:'Activos', data:mesesTend.map(k=>cTend[k].activos), borderColor:PAL.activos,backgroundColor:'rgba(63,157,120,0.07)',tension:0.4,fill:true,pointRadius:2,pointBackgroundColor:PAL.activos,borderWidth:2},
                {label:'Altas', data:mesesTend.map(k=>cTend[k].altas), borderColor:PAL.primario,backgroundColor:'rgba(109,62,232,0.07)',tension:0.4,fill:false,pointRadius:2,pointBackgroundColor:PAL.primario,borderWidth:1.5},
                {label:'Bajas', data:mesesTend.map(k=>cTend[k].bajas), borderColor:PAL.baja,backgroundColor:'rgba(224,82,77,0.07)',tension:0.4,fill:false,pointRadius:2,pointBackgroundColor:PAL.baja,borderWidth:1.5},
            ]
        },
        options:{...CD,scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:PAL.grid}}}}
    });

    // ── Gráfica: Finiquitos pagados por MES ────────────────────
    // BUG FIX: era por año, ahora por mes. BUG FIX: "schools" → "scales"
    const mesesFin=Object.keys(finPorMes).sort().slice(-24);
    const finC=document.getElementById('chartFiniquitos');
    charts.fin=dc(charts.fin);
    if(mesesFin.length && finC){
        charts.fin=safeChart('chartFiniquitos',{
            type:'bar',
            data:{
                labels:mesesFin.map(fmtM),
                datasets:[{
                    label:'Finiquitos',
                    data:mesesFin.map(m=>finPorMes[m]),
                    backgroundColor:PAL.dinero,
                    borderRadius:4
                }]
            },
            options:{
                ...CD,
                plugins:{
                    legend:{display:false},
                    tooltip:{callbacks:{label:ctx=>' '+fmtMXN(ctx.raw)}}
                },
                scales:{   // ← BUG FIX: era "schools"
                    x:{grid:{display:false},ticks:{font:{size:10}}},
                    y:{beginAtZero:true,grid:{color:PAL.grid},ticks:{callback:v=>fmtMXN(v),font:{size:10}}}
                }
            }
        });
    } else {
        chartSinDatos('chartFiniquitos','Sin finiquitos registrados aún');
    }

    // ── Tabla causas de baja con % ─────────────────────────────
    const top=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const tb=document.getElementById('tabla-causas-baja');
    if(tb){
        if(top.length){
            tb.innerHTML=top.map(([m,n])=>{
                const pct=bajas>0?((n/bajas)*100).toFixed(1):"0";
                return`<tr class="border-b border-slate-100 last:border-0"><td class="py-2.5 pr-4 text-sm text-slate-700">${m}</td><td class="py-2.5 text-center text-sm font-bold text-slate-800">${n}</td><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><div style="flex:1;background:#eeecf5;border-radius:99px;height:5px;overflow:hidden"><div style="background:${PAL.baja};height:5px;border-radius:99px;width:${pct}%"></div></div><span style="font-size:.72rem;color:#6b6880;width:2.6rem;text-align:right;font-variant-numeric:tabular-nums">${pct}%</span></div></td></tr>`;
            }).join('');
        } else {
            tb.innerHTML='<tr><td colspan="3" class="py-8 text-center text-xs text-slate-400">Sin bajas registradas aún</td></tr>';
        }
    }
}

// ─── EXCEL ────────────────────────────────────────────────────
async function exportarExcel(){
    const datos=await obtenerDatos();if(!datos.length){mostrarToast('info','Sin datos','No hay registros para exportar.');return;}
    const ws=XLSX.utils.json_to_sheet(datos),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"BASE DE DATOS");
    XLSX.writeFile(wb,'Plantilla_Respaldo_('+new Date().toISOString().slice(0,10)+').xlsx');
}
function importarExcel(event){
    const file=event.target.files[0];if(!file)return;
    mostrarLoader("Leyendo archivo Excel...");
    const reader=new FileReader();
    reader.onload=async e=>{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
        const filtrado=raw.filter(r=>r["NO. EMPLEADO"]&&r["NO. EMPLEADO"].toString().trim()!=="").map(normalizarRegistro);
        ocultarLoader();
        const{isConfirmed}=await Swal.fire({title:'Confirmar importación',html:`<strong>${filtrado.length} filas válidas</strong> de <em>${file.name}</em>.<br><small>Fechas y montos normalizados automáticamente.</small>`,icon:'question',showCancelButton:true,confirmButtonText:'Sí, importar',cancelButtonText:'Cancelar'});
        if(isConfirmed){mostrarLoader("Inyectando...");try{const r=await enviarPeticion("importar_masivo",{registros:filtrado});ocultarLoader();mostrarToast('success','Importación completa',r.message);forzarActualizacion();}catch(err){ocultarLoader();mostrarToast('error','Error',err.message);}}
        event.target.value='';
    };
    reader.onerror=()=>{ocultarLoader();mostrarToast('error','Error','No se pudo leer el archivo.');};
    reader.readAsArrayBuffer(file);
}

// ─── INIT ─────────────────────────────────────────────────────
async function initApp(){
    console.log('[initApp] Iniciando...');
    pasoActual=0;altaData={};
    actualizarBadgeNotifs();
    renderizarStepper();
    restaurarEstadoNavGroups();
    await cargarCatalogoEmpresas();
    const datos=await cargarDashboard();
    actualizarListaEmpresas();
    poblarCatalogos();
    if(cacheGlobal.length)evaluarAlertas(cacheGlobal);
    initAutocomplete();
    // REDISEÑO: ya no se registra un listener global de "clic afuera" —
    // el nuevo #notif-backdrop se encarga de cerrar el drawer con su
    // propio onclick, eliminando de raíz el bug de nodos huérfanos que
    // cerraba el panel al hacer clic en las pestañas (ver nota junto a
    // abrirCentroNotifs/cerrarCentroNotifs).
}
// ─── PWA INSTALL ─────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Mostrar banner de instalación después de 3 segundos
    setTimeout(() => {
        const banner = document.getElementById('pwa-banner');
        if (banner && deferredPrompt) banner.classList.remove('hidden');
    }, 3000);
});
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.classList.add('hidden');
    mostrarToast('success', '¡App instalada!', 'RRHH Prisma se ha instalado en tu dispositivo.', 5000);
});
async function instalarPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('pwa-banner').classList.add('hidden');
}

// Verificar sesión antes de inicializar la app
async function arrancarApp(){
    // Failsafe: si no termina, mostrar login de todas formas.
    // BUGFIX: verificarSesion ahora puede reintentar una vez ante fallas de
    // red (hasta ~2x25s + espera), así que el failsafe se sube a 65s para
    // no interrumpir ese reintento con un mensaje contradictorio.
    const failsafe = setTimeout(function(){
        console.error('[arrancarApp] Timeout — mostrando login');
        ocultarLoader_app();
        mostrarLoginScreen('La conexión tardó demasiado. Intenta de nuevo.');
    }, 65000);

    try {
        setLoaderStatus('Verificando sesión...', 20);
        const sesionOk = await verificarSesion();
        clearTimeout(failsafe);
        if(sesionOk) {
            setLoaderStatus('Cargando datos...', 60);
            await initApp();
            setLoaderStatus('Listo', 100);
            setTimeout(ocultarLoader_app, 400);
        } else {
            setTimeout(ocultarLoader_app, 300);
        }
    } catch(e) {
        clearTimeout(failsafe);
        console.error('[arrancarApp] Error:', e);
        ocultarLoader_app();
        mostrarLoginScreen('Error al iniciar. Recarga la página.');
    }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', arrancarApp);
else arrancarApp();

// ════════════════════════════════════════════════════════════
// HISTORIAL DE CARRERA
// ════════════════════════════════════════════════════════════

async function cargarHistorialPersona(idPersona) {
    if (!idPersona) return;
    const secHist = document.getElementById('sec-historial');
    if (!secHist) return;
    secHist.innerHTML = '<div class="text-xs text-slate-400 text-center py-4"><i class="fas fa-spinner fa-spin mr-1"></i>Cargando historial...</div>';
    try {
        const r = await enviarPeticion('obtener_historial_persona', { idPersona });
        if (r.status !== 'success') { secHist.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">Sin historial disponible.</p>'; return; }

        const hist = r.historial || [];
        const movs = r.movimientos || [];

        if (!hist.length && !movs.length) {
            secHist.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">Sin historial de carrera registrado.</p>';
            return;
        }

        let html = '';

        // Períodos anteriores
        if (hist.length) {
            html += '<div class="mb-4">';
            html += '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">'
                  + '<i class="fas fa-clock-rotate-left text-violet-400"></i>Períodos anteriores</p>';
            html += '<div class="space-y-2">';
            hist.forEach(function(h) {
                html += '<div class="bg-slate-50 rounded-xl p-3 border border-slate-100">'
                    + '<div class="flex items-center justify-between mb-1.5">'
                    + '<span class="text-xs font-bold text-slate-700">' + (h.empresa||'—') + '</span>'
                    + '<span class="text-xs text-slate-400">#' + (h.noEmpleado||'—') + '</span>'
                    + '</div>'
                    + '<p class="text-xs text-slate-500 mb-1">' + (h.puesto||'—') + ' · ' + (h.departamento||'—') + '</p>'
                    + '<div class="flex flex-wrap gap-2 text-xs text-slate-400">'
                    + '<span><i class="fas fa-calendar-plus text-emerald-400 mr-1"></i>' + (h.fechaIngreso||'—') + '</span>'
                    + '<span><i class="fas fa-calendar-minus text-red-400 mr-1"></i>' + (h.fechaBaja||'—') + '</span>'
                    + (h.montoFiniquito ? '<span><i class="fas fa-money-bill text-amber-400 mr-1"></i>$' + Number(h.montoFiniquito).toLocaleString('es-MX') + '</span>' : '')
                    + '</div>'
                    + (h.motivoSalida ? '<p class="text-xs text-slate-400 mt-1"><i class="fas fa-tag mr-1"></i>' + h.motivoSalida + '</p>' : '')
                    + '</div>';
            });
            html += '</div></div>';
        }

        // Movimientos internos (aumentos, cambios de puesto)
        if (movs.length) {
            html += '<div class="mb-2">';
            html += '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">'
                  + '<i class="fas fa-arrow-trend-up text-emerald-400"></i>Movimientos de carrera</p>';
            html += '<div class="space-y-2">';
            movs.forEach(function(m) {
                const iconoTipo = {
                    'Aumento': 'fa-dollar-sign text-emerald-500',
                    'Cambio de Puesto': 'fa-user-tie text-blue-500',
                    'Promoción': 'fa-star text-amber-500',
                    'Cambio de Empresa': 'fa-building text-violet-500'
                }[m.tipo] || 'fa-circle-dot text-slate-400';
                html += '<div class="flex gap-2.5 items-start">'
                    + '<div class="mt-0.5 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">'
                    + '<i class="fas ' + iconoTipo + ' text-xs"></i></div>'
                    + '<div>'
                    + '<p class="text-xs font-semibold text-slate-700">' + m.tipo + ' <span class="text-slate-400 font-normal">· ' + m.fecha + '</span></p>'
                    + (m.descripcion ? '<p class="text-xs text-slate-500">' + m.descripcion + '</p>' : '')
                    + (m.valorAntes && m.valorDespues ? '<p class="text-xs text-slate-400">' + m.valorAntes + ' → <span class="text-emerald-600 font-semibold">' + m.valorDespues + '</span></p>' : '')
                    + '</div></div>';
            });
            html += '</div></div>';
        }

        secHist.innerHTML = html;
    } catch(e) {
        secHist.innerHTML = '<p class="text-xs text-red-400 text-center py-3">Error cargando historial.</p>';
        console.error('[historial]', e);
    }
}

async function registrarMovimientoCarrera(idPersona, tipo, desc, valAntes, valDespues, fecha) {
    const usuario = document.getElementById('header-user')?.innerText || '';
    const r = await enviarPeticion('registrar_movimiento', {
        idPersona, tipo, descripcion: desc,
        valorAntes: valAntes, valorDespues: valDespues,
        fecha: fecha || '',
        registradoPor: usuario
    });
    if (r.status === 'success') {
        mostrarToast('success', 'Movimiento registrado', tipo + ' guardado en el historial.');
        // Recargar historial
        await cargarHistorialPersona(idPersona);
    } else {
        mostrarToast('error', 'Error', r.message);
    }
}

// ── Campos dinámicos del formulario de "Nuevo movimiento" según tipo ──
// Antes el modal pedía siempre los mismos 3 campos genéricos ("Valor
// anterior" / "Valor nuevo" / "Descripción") sin importar el tipo de
// movimiento, lo cual era confuso (¿"valor anterior" de qué?). Ahora cada
// tipo pide justo lo que necesita, reutilizando catálogos reales de la
// BD (catalogoPuestos, catalogoDeptos, empresas) y precargando el dato
// actual del empleado (puesto/sueldo/empresa/departamento) como referencia.
const _LBL = 'style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase"';
const _INP = 'style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;margin-top:4px;box-sizing:border-box"';
const _INP_RO = 'style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;margin-top:4px;box-sizing:border-box;background:#f8fafc;color:#94a3b8"';

function _camposMovimientoHTML(tipo, emp) {
    const puestoAct  = (emp && emp['PUESTO']) || '—';
    const deptoAct    = (emp && emp['DEPARTAMENTO']) || '—';
    const empresaAct = (emp && emp['EMPRESA']) || '—';
    const sueldoAct  = (emp && emp['SUELDO MENSUAL']) ? Number(emp['SUELDO MENSUAL']).toLocaleString('es-MX') : '—';
    const listaPuestos = (catalogoPuestos||[]).map(p=>'<option value="'+p+'">').join('');
    const listaDeptos  = (catalogoDeptos||[]).map(d=>'<option value="'+d+'">').join('');
    const listaEmpresas = (typeof empresas!=='undefined'?empresas:[]).filter(e=>e!==empresaAct)
        .map(e=>'<option value="'+e+'">'+e+'</option>').join('');

    if (tipo === 'Aumento') {
        return '<div><label '+_LBL+'>Sueldo actual (MXN)</label>'
            + '<input value="$'+sueldoAct+'" disabled '+_INP_RO+'></div>'
            + '<div><label '+_LBL+'>Sueldo nuevo (MXN) <span style="color:#ef4444">*</span></label>'
            + '<input id="mov-sueldo-nuevo" type="number" step="0.01" placeholder="0.00" '+_INP+'></div>'
            + '<div><label '+_LBL+'>Motivo del aumento</label>'
            + '<select id="mov-motivo-aumento" '+_INP+'>'
            + '<option value="Revisión de desempeño">Revisión de desempeño</option>'
            + '<option value="Ajuste de mercado">Ajuste de mercado</option>'
            + '<option value="Antigüedad">Antigüedad</option>'
            + '<option value="Ajuste por cambio de puesto">Ajuste por cambio de puesto</option>'
            + '<option value="Otro">Otro</option>'
            + '</select></div>';
    }
    if (tipo === 'Cambio de Puesto' || tipo === 'Promoción') {
        var sueldoBlock = tipo === 'Promoción'
            ? '<div><label '+_LBL+'>Sueldo actual (MXN)</label>'
              + '<input value="$'+sueldoAct+'" disabled '+_INP_RO+'></div>'
              + '<div><label '+_LBL+'>Sueldo nuevo (MXN) — opcional</label>'
              + '<input id="mov-sueldo-nuevo" type="number" step="0.01" placeholder="Déjalo vacío si no cambia" '+_INP+'></div>'
            : '';
        return '<div><label '+_LBL+'>Puesto actual</label>'
            + '<input value="'+puestoAct+'" disabled '+_INP_RO+'></div>'
            + '<div><label '+_LBL+'>Puesto nuevo <span style="color:#ef4444">*</span></label>'
            + '<input id="mov-puesto-nuevo" list="mov-list-puestos" placeholder="Escribe o elige de la lista" '+_INP+'>'
            + '<datalist id="mov-list-puestos">'+listaPuestos+'</datalist></div>'
            + sueldoBlock;
    }
    if (tipo === 'Cambio de Empresa') {
        return '<div><label '+_LBL+'>Empresa actual</label>'
            + '<input value="'+empresaAct+'" disabled '+_INP_RO+'></div>'
            + '<div><label '+_LBL+'>Empresa nueva <span style="color:#ef4444">*</span></label>'
            + '<select id="mov-empresa-nueva" '+_INP+'><option value="">Seleccione...</option>'+listaEmpresas+'</select></div>'
            + '<p style="font-size:11px;color:#94a3b8;margin-top:2px">Esto solo queda registrado en el historial de carrera; no mueve automáticamente el expediente activo. Si el cambio de empresa es definitivo, actualiza también el campo "Empresa" del expediente.</p>';
    }
    if (tipo === 'Cambio de Departamento') {
        return '<div><label '+_LBL+'>Departamento actual</label>'
            + '<input value="'+deptoAct+'" disabled '+_INP_RO+'></div>'
            + '<div><label '+_LBL+'>Departamento nuevo <span style="color:#ef4444">*</span></label>'
            + '<input id="mov-depto-nuevo" list="mov-list-deptos" placeholder="Escribe o elige de la lista" '+_INP+'>'
            + '<datalist id="mov-list-deptos">'+listaDeptos+'</datalist></div>';
    }
    // "Otro" — el único caso donde sí tiene sentido pedir campos libres,
    // porque no hay una estructura predecible.
    return '<div><label '+_LBL+'>Valor anterior</label>'
        + '<input id="mov-antes" placeholder="Ej: valor previo" '+_INP+'></div>'
        + '<div><label '+_LBL+'>Valor nuevo</label>'
        + '<input id="mov-despues" placeholder="Ej: valor nuevo" '+_INP+'></div>';
}

// Lee los campos dinámicos ya renderizados y arma {valAntes, valDespues, desc} según el tipo
function _leerCamposMovimiento(tipo, emp) {
    const puestoAct  = (emp && emp['PUESTO']) || '';
    const deptoAct   = (emp && emp['DEPARTAMENTO']) || '';
    const empresaAct = (emp && emp['EMPRESA']) || '';
    const sueldoAct  = (emp && emp['SUELDO MENSUAL']) || '';
    const comentario = document.getElementById('mov-comentario')?.value || '';

    if (tipo === 'Aumento') {
        const nuevo = document.getElementById('mov-sueldo-nuevo')?.value || '';
        if (!nuevo) return { error: 'Captura el sueldo nuevo' };
        const motivo = document.getElementById('mov-motivo-aumento')?.value || '';
        return { valAntes: '$'+Number(sueldoAct||0).toLocaleString('es-MX'), valDespues: '$'+Number(nuevo).toLocaleString('es-MX'),
                 desc: (motivo ? motivo+'. ' : '') + comentario };
    }
    if (tipo === 'Cambio de Puesto' || tipo === 'Promoción') {
        const puestoNuevo = document.getElementById('mov-puesto-nuevo')?.value || '';
        if (!puestoNuevo) return { error: 'Captura el puesto nuevo' };
        const sueldoNuevo = document.getElementById('mov-sueldo-nuevo')?.value || '';
        let valAntes = puestoAct || '—', valDespues = puestoNuevo;
        if (tipo === 'Promoción' && sueldoNuevo) {
            valAntes   += ' · $'+Number(sueldoAct||0).toLocaleString('es-MX');
            valDespues += ' · $'+Number(sueldoNuevo).toLocaleString('es-MX');
        }
        return { valAntes, valDespues, desc: comentario };
    }
    if (tipo === 'Cambio de Empresa') {
        const nueva = document.getElementById('mov-empresa-nueva')?.value || '';
        if (!nueva) return { error: 'Selecciona la empresa nueva' };
        return { valAntes: empresaAct || '—', valDespues: nueva, desc: comentario };
    }
    if (tipo === 'Cambio de Departamento') {
        const nuevo = document.getElementById('mov-depto-nuevo')?.value || '';
        if (!nuevo) return { error: 'Captura el departamento nuevo' };
        return { valAntes: deptoAct || '—', valDespues: nuevo, desc: comentario };
    }
    // Otro
    return { valAntes: document.getElementById('mov-antes')?.value || '',
             valDespues: document.getElementById('mov-despues')?.value || '',
             desc: comentario };
}

function abrirModalMovimiento(idPersona, nombreEmpleado) {
    const emp = (typeof empleadoEdicion !== 'undefined') ? empleadoEdicion : null;
    const hoyISO = new Date().toISOString().slice(0,10);

    Swal.fire({
        title: 'Registrar movimiento de carrera',
        html: `
            <div style="text-align:left;display:flex;flex-direction:column;gap:10px;margin-top:8px">
                <div>
                    <label ${_LBL}>Tipo de movimiento</label>
                    <select id="mov-tipo" ${_INP}>
                        <option value="">Seleccione...</option>
                        <option value="Aumento">Aumento de sueldo</option>
                        <option value="Cambio de Puesto">Cambio de puesto</option>
                        <option value="Promoción">Promoción (puesto + sueldo)</option>
                        <option value="Cambio de Empresa">Cambio de empresa (intragrupo)</option>
                        <option value="Cambio de Departamento">Cambio de departamento</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
                <div id="mov-campos-dinamicos"><p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px 0">Selecciona un tipo de movimiento para continuar.</p></div>
                <div>
                    <label ${_LBL}>Fecha efectiva</label>
                    <input id="mov-fecha" type="date" value="${hoyISO}" ${_INP}>
                </div>
                <div>
                    <label ${_LBL}>Comentario (opcional)</label>
                    <input id="mov-comentario" placeholder="Contexto adicional" ${_INP}>
                </div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar movimiento',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        didOpen: () => {
            const sel = document.getElementById('mov-tipo');
            const cont = document.getElementById('mov-campos-dinamicos');
            sel.addEventListener('change', () => {
                cont.innerHTML = sel.value ? _camposMovimientoHTML(sel.value, emp)
                    : '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px 0">Selecciona un tipo de movimiento para continuar.</p>';
            });
        },
        preConfirm: () => {
            const tipo = document.getElementById('mov-tipo').value;
            if (!tipo) { Swal.showValidationMessage('Selecciona el tipo de movimiento'); return false; }
            const lect = _leerCamposMovimiento(tipo, emp);
            if (lect.error) { Swal.showValidationMessage(lect.error); return false; }
            return {
                tipo,
                desc:       lect.desc,
                valAntes:   lect.valAntes,
                valDespues: lect.valDespues,
                fecha:      document.getElementById('mov-fecha')?.value || ''
            };
        }
    }).then(res => {
        if (res.isConfirmed && res.value) {
            const { tipo, desc, valAntes, valDespues, fecha } = res.value;
            registrarMovimientoCarrera(idPersona, tipo, desc, valAntes, valDespues, fecha);
        }
    });
}

// ════════════════════════════════════════════════════════════
// MAYÚSCULAS GLOBALES — todos los inputs de texto
// Excluye: email, password, date, number y campos con data-nouppercase
// ════════════════════════════════════════════════════════════
(function(){
    const _EXCL_TYPE = new Set(['email','password','search','number','date','time','tel']);
    const _EXCL_ID   = new Set(['correoElectronico','correo','email','password','contrasena','token']);
    function _upper(el){
        if(!el || el.tagName==='SELECT') return;
        if(_EXCL_TYPE.has((el.type||'').toLowerCase())) return;
        if(_EXCL_ID.has(el.name||'') || _EXCL_ID.has(el.id||'')) return;
        if(el.dataset.nouppercase!==undefined) return;
        if((el.className||'').includes('no-upper')) return;
        const pos=el.selectionStart;
        el.value=el.value.toUpperCase();
        try{el.setSelectionRange(pos,pos);}catch(e){}
    }
    document.addEventListener('input', e=>{
        const el=e.target;
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') _upper(el);
    }, true);
    document.addEventListener('paste', e=>{
        const el=e.target;
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') setTimeout(()=>_upper(el),0);
    }, true);
})();
// ════════════════════════════════════════════════════════════
// BARRA DE ALMACENAMIENTO DRIVE
// ════════════════════════════════════════════════════════════
// BUGFIX: getDriveUsage() puede colgarse (sospecha: DriveApp restringido por
// política de Workspace, igual que pasó antes con Gemini). Si se le deja el
// timeout genérico de 25s y se reintenta cada 5 min sin control, una sola
// llamada colgada puede quedar viva en el servidor de GAS mucho después de
// que el navegador la abandonó, y coincide con que justo DESPUÉS empiecen a
// fallar el resto de las peticiones (CORS/404/HTML en vez de JSON — señal de
// que Google dejó de ejecutar el script, no un bug de este frontend).
// Mitigación: timeout corto y propio (8s, no crítico) + circuit breaker que
// deja de insistir tras 2 fallos seguidos, en vez de martillar cada 5 min.
let _driveUsageFallosSeguidos = 0;
async function actualizarBarraDrive() {
    if (_driveUsageFallosSeguidos >= 2) {
        console.warn('[Drive] Desactivado tras 2 fallos seguidos — evitando más carga al backend.');
        return;
    }
    try {
        const r = await enviarPeticion('getDriveUsage', {}, 8000);
        if (!r || r.status !== 'success') { _driveUsageFallosSeguidos++; return; }
        _driveUsageFallosSeguidos = 0;
        const pct  = r.pct    || 0;
        const used = r.usedGB  || 0;
        const lim  = r.limitGB || 15;
        const free = r.freeGB  || (lim - used);
        const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#8b5cf6';
        const bar  = document.getElementById('drive-storage-bar');
        const txt  = document.getElementById('drive-storage-txt');
        const fill = document.getElementById('drive-storage-fill');
        const wrap = document.getElementById('drive-storage-wrap');
        if (bar)  bar.style.display = 'block';
        if (txt)  txt.textContent   = used.toFixed(2) + ' / ' + lim.toFixed(0) + ' GB';
        if (fill) { fill.style.width = pct + '%'; fill.style.background = color; }
        if (wrap) wrap.title = 'Usado: ' + used.toFixed(2) + ' GB | Libre: ' + free.toFixed(2) + ' GB | Total: ' + lim.toFixed(0) + ' GB (' + pct + '% usado)';
    } catch(e) {
        _driveUsageFallosSeguidos++;
        console.warn('[Drive]', e);
    }
}
// DESACTIVADO 07 jul 2026: esta función se disparaba sola 3s después de
// cada carga de página y luego cada 5 min, pero el elemento HTML
// (#drive-storage-bar) ya no existe en index.html — no mostraba nada a
// nadie. Mientras tanto, DriveApp.getStorageUsed() puede colgarse del
// lado del servidor (sospecha de política de Workspace, ver
// ESTADO_PROYECTO.md), y una ejecución de Apps Script colgada ocupa un
// cupo de ejecución concurrente para *todo el proyecto* — no solo para
// esta función. Eso hacía fallar de forma intermitente y aparentemente
// aleatoria otras acciones sin relación (dashboard en ceros, crear Baja,
// generar contrato), porque todas comparten el mismo despliegue de GAS.
// Si en el futuro se agrega una barra de almacenamiento visible, mejor
// que se cargue bajo demanda (un botón), nunca automática ni en loop.
/*
window.addEventListener('load', function(){
    setTimeout(actualizarBarraDrive, 3000);
    setInterval(actualizarBarraDrive, 5 * 60 * 1000);
});
*/

// ════════════════════════════════════════════════════════════
// MAYÚSCULAS GLOBALES — todos los inputs de texto
// ════════════════════════════════════════════════════════════
(function(){
    const _EX_TYPE = new Set(['email','password','search','number','date','time','tel']);
    const _EX_ID   = new Set(['correoElectronico','correo','email','password','contrasena','token']);
    function _upper(el){
        if(!el||el.tagName==='SELECT') return;
        if(_EX_TYPE.has((el.type||'').toLowerCase())) return;
        if(_EX_ID.has(el.name||'')||_EX_ID.has(el.id||'')) return;
        if(el.dataset.nouppercase!==undefined) return;
        if((el.className||'').includes('no-upper')) return;
        const pos=el.selectionStart;
        el.value=el.value.toUpperCase();
        try{el.setSelectionRange(pos,pos);}catch(e){}
    }
    document.addEventListener('input',e=>{
        const el=e.target;
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') _upper(el);
    },true);
    document.addEventListener('paste',e=>{
        const el=e.target;
        if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') setTimeout(()=>_upper(el),0);
    },true);
})();

// ─── MODAL GENERAR CONTRATO ─────────────────────────────────
// Escape mínimo para no romper atributos HTML si el valor trae comillas/etiquetas
function _escHtml(s) {
  return (s || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Función central: abre el formulario y genera el contrato ──
// idInterno: obligatorio.
// prefillDirecto (opcional): si ya tienes los datos a la mano (ej. justo
// después del alta, en r.contratoPrefill), pásalos aquí para abrir el
// modal al instante sin otra consulta al backend. Si se omite, se
// consultan del Sheet (caso del botón en Expedientes).
async function abrirModalGenerarContrato(idInterno, prefillDirecto) {
  var prefill = { puesto: "", tipoIngreso: "", fechaInicio: "", fechaFin: "" };

  if (prefillDirecto) {
    prefill = prefillDirecto;
  } else {
    try {
      const rDatos = await enviarPeticion("obtener_datos_contrato", { idInterno });
      if (rDatos.status === "success") prefill = rDatos.datos;
      else { mostrarToast('error','No se pudo cargar', rDatos.message, 5000); return; }
    } catch (e) {
      mostrarToast('error','Error', 'No se pudieron cargar los datos del contrato.', 5000);
      return;
    }
  }

  const { value: formValues, isConfirmed } = await Swal.fire({
    title: 'Datos para el contrato',
    // REDISEÑO + FIX: antes los campos usaban las clases nativas
    // `.swal2-input`/`.swal2-textarea` de SweetAlert2. Esas clases están
    // pensadas para el sistema `input:` propio de SweetAlert2 (que agrega
    // una clase de tipo específica vía JS para controlar su `display`);
    // al usarlas en HTML libre (`html:`) sin pasar por ese sistema, más
    // los `<label>` sin `display:block` explícito, el navegador terminaba
    // recorriendo el texto de cada etiqueta junto al campo equivocado
    // (se veía como si "Descanso diario" flotara sobre el textarea de
    // arriba, "Fecha de inicio" junto al campo de descanso, etc.).
    // Ahora el formulario usa sus propias clases (`gc-*`) con estructura
    // explícita en columna — no hay ambigüedad posible de layout.
    html: `
      <style>
        .gc-form{ text-align:left; display:flex; flex-direction:column; gap:16px; margin-top:2px; }
        .gc-field{ display:flex; flex-direction:column; gap:6px; }
        .gc-field label{ display:block; font-weight:600; font-size:13px; color:#334155; }
        .gc-field label .gc-hint{ font-weight:400; color:#94a3b8; font-size:11.5px; }
        .gc-input, .gc-textarea{
          display:block; width:100%; box-sizing:border-box;
          border:1.5px solid #e2e8f0; border-radius:12px;
          padding:10px 12px; font-size:14px; font-family:inherit; color:#1e293b;
          background:#fff; transition:border-color .2s ease, box-shadow .2s ease;
        }
        .gc-input:focus, .gc-textarea:focus{
          outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.15);
        }
        .gc-textarea{ min-height:112px; resize:vertical; line-height:1.5; }
        .gc-row{ display:flex; gap:12px; }
        .gc-row .gc-field{ flex:1; min-width:0; }
        @media (max-width:480px){ .gc-row{ flex-direction:column; } }
      </style>
      <div class="gc-form">
        <div class="gc-field">
          <label for="swal-funciones">Funciones del puesto</label>
          <textarea id="swal-funciones" class="gc-textarea"
            placeholder="Ej. Ejecutar en campo el plan semanal de producción; controlar avance físico de obra; ..."></textarea>
        </div>

        <div class="gc-field">
          <label for="swal-descanso">Descanso diario</label>
          <input id="swal-descanso" type="text" class="gc-input"
            value="${_escHtml('30 minutos')}" placeholder="Ej. 30 minutos">
        </div>

        <div class="gc-row">
          <div class="gc-field">
            <label for="swal-fecha-inicio">Fecha de inicio</label>
            <input id="swal-fecha-inicio" type="date" class="gc-input"
              value="${_escHtml(prefill.fechaInicio)}">
          </div>
          <div class="gc-field">
            <label for="swal-fecha-fin">Fin de periodo <span class="gc-hint">(prueba/capacitación)</span></label>
            <input id="swal-fecha-fin" type="date" class="gc-input"
              value="${_escHtml(prefill.fechaFin)}">
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Generar contrato',
    cancelButtonText: 'Cancelar',
    width: 560,
    preConfirm: () => {
      const funciones = document.getElementById('swal-funciones').value.trim();
      const descanso  = document.getElementById('swal-descanso').value.trim();
      const fInicio   = document.getElementById('swal-fecha-inicio').value;
      const fFin      = document.getElementById('swal-fecha-fin').value;
      if (!funciones) {
        Swal.showValidationMessage('Captura las funciones del puesto.');
        return false;
      }
      if (!fInicio || !fFin) {
        Swal.showValidationMessage('Captura ambas fechas.');
        return false;
      }
      return { funciones, descanso, fInicio, fFin };
    }
  });

  if (!isConfirmed || !formValues) return;

  Swal.fire({ title: 'Generando contrato...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    // generar_contrato es pesada (Drive + Docs + export PDF). Un contrato
    // Administrativo crea 6 documentos en una sola llamada — 45s a veces
    // no alcanza y se reportaba como error aunque terminara bien del lado
    // del servidor (mismo patrón que subir_documento). Se sube a 90s.
    const r = await enviarPeticion("generar_contrato", {
      idInterno: idInterno,
      funcionesPuesto: formValues.funciones,
      descansoDiario: formValues.descanso,
      fechaInicioOverride: formValues.fInicio,
      fechaFinOverride: formValues.fFin
    }, 90000);

    if (r.status === "success") {
      mostrarToast('success', '¡Contrato generado!', `Tipo: ${r.tipoIngreso}`, 8000);
      Swal.fire({
        icon: 'success',
        title: '¡Contrato generado!',
        html: `<a href="${r.urlDoc}" target="_blank">Abrir Google Doc</a><br><a href="${r.urlPdf}" target="_blank">Abrir PDF</a>`,
        confirmButtonText: 'Cerrar'
      });
    } else {
      Swal.fire({ icon: 'error', title: 'No se pudo generar el contrato', text: r.message });
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el contrato (timeout o error de red). Intenta de nuevo: ' + e.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOM-035: Pestana de resultados en el drawer del expediente
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// NOM-035: Drawer del expediente + Exportacion + Configuracion
// PARCHE COMPLETO - Reemplaza desde linea 7366 hasta el final
// ═══════════════════════════════════════════════════════════════════════════════
var _nom035DrawerColores = {
  "Nulo":     { bg:"#d1fae5", text:"#065f46", hex:"#10b981" },
  "Bajo":     { bg:"#dbeafe", text:"#1e40af", hex:"#3b82f6" },
  "Medio":    { bg:"#fef9c3", text:"#854d0e", hex:"#eab308" },
  "Alto":     { bg:"#fed7aa", text:"#9a3412", hex:"#f97316" },
  "Muy alto": { bg:"#fecaca", text:"#991b1b", hex:"#ef4444" }
};

async function cargarResultadosNOM035Drawer(idInterno) {
  var cont = document.getElementById('nom035-drawer-content');
  if (!cont) return;
  cont.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-violet-400 text-2xl"></i><p class="text-xs text-slate-400 mt-2">Consultando resultados...</p></div>';
  try {
    var r = await enviarPeticion('resultados_nom035', { idInterno: idInterno });
    if (r.status !== 'success') {
      cont.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="fas fa-exclamation-circle text-2xl mb-2"></i><p class="text-sm">' + (r.message||'Error al cargar') + '</p></div>';
      return;
    }
    var resultados = r.empleados || r.resultados || [];
    if (!resultados.length) {
      cont.innerHTML = '<div class="text-center py-10"><i class="fas fa-shield-heart text-slate-200 text-4xl mb-3"></i><p class="text-sm text-slate-400 font-semibold">Sin resultados NOM-035</p><p class="text-xs text-slate-300 mt-1">Este empleado no ha completado la encuesta.</p></div>';
      return;
    }
    var ultimo = resultados[resultados.length - 1];
    var colores = r.colores || _nom035DrawerColores;
    var nivelTotal = (ultimo.nivel || 'Sin datos').toString();
    var color = colores[nivelTotal] || { bg:'#f1f5f9', text:'#475569', hex:'#94a3b8' };
    var puntaje = ultimo.puntajeTotal || 0;
    var tipoGuia = (ultimo.tipoCuestionario || '').toString();
    var giReq = (ultimo.giRequiere || '').toString();
    var fecha = ultimo.fecha ? new Date(ultimo.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '';
    var html = '';
    html += '<div style="background:'+color.bg+';border:2px solid '+color.hex+';border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">';
    html += '<p style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:'+color.text+';margin-bottom:4px;">Nivel de riesgo psicosocial</p>';
    html += '<p style="font-size:1.5rem;font-weight:900;color:'+color.text+';">'+nivelTotal+'</p>';
    html += '<p style="font-size:.78rem;color:'+color.text+';margin-top:3px;">Puntaje: '+puntaje+' | Guia '+(tipoGuia==='guia3'?'III':'II')+'</p>';
    if (fecha) html += '<p style="font-size:.68rem;color:'+color.text+';margin-top:4px;opacity:.7;">Aplicado: '+fecha+'</p>';
    html += '</div>';
    if (giReq === 'SI') {
      html += '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:12px;margin-bottom:12px;">';
      html += '<p style="font-size:.8rem;font-weight:700;color:#991b1b;"><i class="fas fa-exclamation-triangle" style="margin-right:5px;"></i>Guia I: REQUIERE valoracion clinica</p>';
      html += '<p style="font-size:.72rem;color:#991b1b;margin-top:3px;">'+(ultimo.giMotivo||'')+'</p></div>';
    } else {
      html += '<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:12px;">';
      html += '<p style="font-size:.78rem;color:#166534;"><i class="fas fa-check-circle" style="margin-right:5px;"></i>Guia I: No requiere valoracion clinica</p></div>';
    }
    var dominios = ultimo.porDominio || ultimo.dominios || {};
    if (Object.keys(dominios).length) {
      html += '<p style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:14px 0 8px;">Resultados por dominio</p>';
      Object.keys(dominios).forEach(function(d) {
        var dom = dominios[d];
        var dc = colores[dom.nivel] || { bg:'#f1f5f9', text:'#475569', hex:'#94a3b8' };
        html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:'+dc.bg+';">';
        html += '<span style="width:8px;height:8px;border-radius:50%;background:'+dc.hex+';flex-shrink:0;"></span>';
        html += '<span style="flex:1;font-size:.75rem;font-weight:600;color:'+dc.text+';">'+d+'</span>';
        html += '<span style="font-size:.68rem;font-weight:700;color:'+dc.text+';padding:2px 7px;border-radius:5px;background:rgba(255,255,255,.5);">'+dom.nivel+' ('+dom.puntaje+')</span></div>';
      });
    }
    var categorias = ultimo.categorias || {};
    if (Object.keys(categorias).length) {
      html += '<p style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:14px 0 8px;">Por categoria</p>';
      Object.keys(categorias).forEach(function(c) {
        var cat = categorias[c];
        var cc = colores[cat.nivel] || { bg:'#f1f5f9', text:'#475569', hex:'#94a3b8' };
        html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:5px;border-radius:8px;background:'+cc.bg+';">';
        html += '<span style="width:8px;height:8px;border-radius:50%;background:'+cc.hex+';flex-shrink:0;"></span>';
        html += '<span style="flex:1;font-size:.75rem;font-weight:600;color:'+cc.text+';">'+c+'</span>';
        html += '<span style="font-size:.68rem;font-weight:700;color:'+cc.text+';padding:2px 7px;border-radius:5px;background:rgba(255,255,255,.5);">'+cat.nivel+' ('+cat.puntaje+')</span></div>';
      });
    }
    var plan = ultimo.planAccion || (r.planAccion ? r.planAccion[nivelTotal] : '') || '';
    if (plan) {
      html += '<div style="margin-top:14px;padding:12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;">';
      html += '<p style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:5px;"><i class="fas fa-clipboard-list" style="margin-right:4px;"></i>Plan de accion</p>';
      html += '<p style="font-size:.78rem;color:#334155;line-height:1.5;">'+plan+'</p></div>';
    }
    if (resultados.length > 1) {
      html += '<p style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:16px 0 8px;">Historial ('+resultados.length+')</p>';
      resultados.slice().reverse().forEach(function(res) {
        var niv = (res.nivel||'').toString();
        var hc = colores[niv] || { bg:'#f1f5f9', text:'#475569', hex:'#94a3b8' };
        var hFecha = res.fecha ? new Date(res.fecha).toLocaleDateString('es-MX') : '';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;border-radius:8px;border:1px solid #e2e8f0;">';
        html += '<span style="width:8px;height:8px;border-radius:50%;background:'+hc.hex+';"></span>';
        html += '<span style="flex:1;font-size:.73rem;color:#334155;">'+hFecha+'</span>';
        html += '<span style="font-size:.68rem;font-weight:700;color:'+hc.text+';">'+niv+' ('+res.puntajeTotal+')</span></div>';
      });
    }
    cont.innerHTML = html;
  } catch(e) {
    cont.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="fas fa-wifi text-2xl mb-2"></i><p class="text-sm">Error de conexion: '+e.message+'</p></div>';
  }
}

// ═══ EXPORTAR EXCEL ══════════════════════════════════════════════════════════════
function exportarNOM035Excel() {
  if (!window._nom035Data || !window._nom035Data.empleados || !window._nom035Data.empleados.length) {
    mostrarToast('warning', 'Sin datos', 'No hay resultados NOM-035 para exportar. Asegurate de estar en el Dashboard NOM-035.');
    return;
  }
  var emp = window._nom035Data.empleados;
  var rows = [['Nombre', 'Empresa', 'Fecha', 'Guia', 'Puntaje Total', 'Nivel General', 'GI Requiere Valoracion']];
  emp.forEach(function(e) {
    rows.push([e.nombre||'', e.empresa||'', e.fecha ? new Date(e.fecha).toLocaleDateString('es-MX') : '', e.tipoCuestionario==='guia3'?'III':'II', e.puntajeTotal||0, e.nivel||'', e.giRequiere||'NO']);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados NOM-035');
  XLSX.writeFile(wb, 'NOM035_Resultados_' + new Date().toISOString().slice(0,10) + '.xlsx');
  mostrarToast('success', 'Exportado', 'Archivo Excel descargado.');
}

// ═══ EXPORTAR CSV ═══════════════════════════════════════════════════════════════
function exportarNOM035CSV() {
  if (!window._nom035Data || !window._nom035Data.empleados || !window._nom035Data.empleados.length) {
    mostrarToast('warning', 'Sin datos', 'No hay resultados para exportar.');
    return;
  }
  var emp = window._nom035Data.empleados;
  var csv = 'Nombre,Empresa,Fecha,Guia,Puntaje,Nivel,GI_Requiere\n';
  emp.forEach(function(e) {
    csv += '"'+(e.nombre||'').replace(/"/g,'""')+'","'+(e.empresa||'').replace(/"/g,'""')+'","'
      +(e.fecha?new Date(e.fecha).toLocaleDateString('es-MX'):'')+'",'
      +(e.tipoCuestionario==='guia3'?'III':'II')+','
      +(e.puntajeTotal||0)+',"'+(e.nivel||'')+'","'+(e.giRequiere||'NO')+'"\n';
  });
  var blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'NOM035_Resultados_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
  mostrarToast('success', 'Exportado', 'Archivo CSV descargado.');
}

// ═══ CONFIGURACION / EDICION DE CUESTIONARIOS ══════════════════════════════════
async function abrirConfigNOM035() {
  var tipoGuia = await Swal.fire({
    title: 'Configurar cuestionario NOM-035',
    text: 'Selecciona el cuestionario a editar:',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Guia II (hasta 50)',
    cancelButtonText: 'Cancelar',
    showDenyButton: true,
    denyButtonText: 'Guia III (mas de 50)'
  });
  var tipo = '';
  if (tipoGuia.isConfirmed) tipo = 'guia2';
  else if (tipoGuia.isDenied) tipo = 'guia3';
  else return;
  mostrarLoader('Cargando configuracion...');
  try {
    var idTest = '';
    if (cacheGlobal && cacheGlobal.length) {
      for (var i = 0; i < cacheGlobal.length; i++) {
        if ((cacheGlobal[i]['ESTATUS']||'').toString().trim().toLowerCase() === 'activo') {
          idTest = (cacheGlobal[i]['ID INTERNO']||'').toString().trim();
          if (idTest) break;
        }
      }
    }
    if (!idTest) { ocultarLoader(); mostrarToast('error','Error','No se encontro un empleado activo para cargar la estructura.'); return; }
    var ss = await enviarPeticion('obtener_estructura_nom035', { idInterno: idTest });
    ocultarLoader();
    var estructura = (ss.status === 'success' && ss.cuestionarioFRP) ? ss.cuestionarioFRP : { titulo: 'Cuestionario '+tipo, descripcion: '', items: [] };
    mostrarEditorCuestionarioNOM035(tipo, estructura);
  } catch(e) {
    ocultarLoader();
    mostrarToast('error', 'Error', 'No se pudo cargar la configuracion.');
  }
}

function mostrarEditorCuestionarioNOM035(tipo, estructura) {
  var items = estructura.items || [];
  var html = '<div style="max-height:60vh;overflow-y:auto;text-align:left;">';
  html += '<p style="font-size:.82rem;color:#64748b;margin-bottom:12px;">Editando: <strong>'+(tipo==='guia3'?'Guia III (>50)':'Guia II (hasta 50)')+'</strong> | '+items.length+' preguntas</p>';
  html += '<div style="margin-bottom:12px;"><label style="font-size:.72rem;font-weight:700;color:#64748b;">Titulo</label>';
  html += '<input id="nom035-cfg-titulo" value="'+(estructura.titulo||'').replace(/"/g,'&quot;')+'" style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:.85rem;margin-top:4px;"></div>';
  html += '<div style="margin-bottom:12px;"><label style="font-size:.72rem;font-weight:700;color:#64748b;">Descripcion</label>';
  html += '<textarea id="nom035-cfg-desc" rows="2" style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:.82rem;margin-top:4px;resize:vertical;">'+(estructura.descripcion||'')+'</textarea></div>';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><p style="font-size:.72rem;font-weight:700;color:#64748b;">Preguntas ('+items.length+')</p>';
  html += '<button type="button" id="nom035-add-btn" style="font-size:.72rem;font-weight:700;background:#10b981;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;">+ Agregar</button></div>';
  html += '<div id="nom035-items-list" style="max-height:35vh;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">';
  items.forEach(function(it, idx) {
    html += '<div class="nom035-item-row" data-idx="'+idx+'" style="display:flex;gap:6px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #f1f5f9;">';
    html += '<span style="font-size:.7rem;font-weight:700;color:#94a3b8;min-width:24px;">'+it.item+'</span>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<p style="font-size:.78rem;color:#334155;line-height:1.3;">'+it.pregunta+'</p>';
    html += '<p style="font-size:.65rem;color:#94a3b8;">'+it.categoria+' | '+it.dominio+' | '+it.direccion+(it.condicional?' | '+it.condicional:'')+'</p>';
    html += '</div>';
    html += '<button type="button" data-delidx="'+idx+'" style="font-size:.65rem;color:#ef4444;background:none;border:none;cursor:pointer;padding:2px 4px;">✖</button>';
    html += '</div>';
  });
  html += '</div></div>';

  Swal.fire({
    title: 'Configuracion NOM-035',
    html: html,
    width: 720,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-save"></i> Guardar',
    cancelButtonText: 'Cancelar',
    didOpen: function() {
      // Delete buttons
      document.querySelectorAll('[data-delidx]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(this.dataset.delidx);
          items.splice(idx, 1);
          mostrarEditorCuestionarioNOM035(tipo, {titulo:document.getElementById('nom035-cfg-titulo').value,descripcion:document.getElementById('nom035-cfg-desc').value,items:items});
        });
      });
      // Add button
      var addBtn = document.getElementById('nom035-add-btn');
      if (addBtn) addBtn.addEventListener('click', function(){
        Swal.fire({
          title:'Agregar pregunta',
          html:'<div style="text-align:left;font-size:.82rem;">'
            +'<label style="font-weight:700;color:#64748b;">Pregunta</label><input id="np-preg" style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:4px 0 8px;">'
            +'<label style="font-weight:700;color:#64748b;">Categoria</label><select id="np-cat" style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:4px 0 8px;">'+[...new Set(items.map(function(x){return x.categoria;}))].map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('')+'<option value="__nueva__">+ Nueva categoria...</option></select>'
            +'<label style="font-weight:700;color:#64748b;">Dominio</label><select id="np-dom" style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:4px 0 8px;">'+[...new Set(items.map(function(x){return x.dominio;}))].map(function(d){return '<option value="'+d+'">'+d+'</option>';}).join('')+'<option value="__nuevo__">+ Nuevo dominio...</option></select>'
            +'<label style="font-weight:700;color:#64748b;">Direccion</label><select id="np-dir" style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:4px 0 8px;"><option value="directa">Directa</option><option value="inversa">Inversa</option></select>'
            +'<label style="font-weight:700;color:#64748b;">Condicional (opcional)</label><input id="np-cond" placeholder="Ej: Solo si atiende clientes" style="width:100%;border:1.5px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:4px 0;">'
            +'</div>',
          width:500,
          showCancelButton:true,
          confirmButtonText:'Agregar',
          preConfirm:function(){
            var preg=document.getElementById('np-preg').value.trim();
            if(!preg){Swal.showValidationMessage('La pregunta es requerida');return false;}
            return{pregunta:preg,categoria:document.getElementById('np-cat').value.trim()||'General',dominio:document.getElementById('np-dom').value.trim()||'General',direccion:document.getElementById('np-dir').value,condicional:document.getElementById('np-cond').value.trim()||null};
          }
        }).then(function(r){
          if(r.isConfirmed&&r.value){
            items.push({item:items.length+1,pregunta:r.value.pregunta,categoria:r.value.categoria,dominio:r.value.dominio,direccion:r.value.direccion,condicional:r.value.condicional});
            mostrarEditorCuestionarioNOM035(tipo,{titulo:document.getElementById('nom035-cfg-titulo').value,descripcion:document.getElementById('nom035-cfg-desc').value,items:items});
          }
        });
      });
    },
    showLoaderOnConfirm: true,
    preConfirm: function() {
      var titulo = document.getElementById('nom035-cfg-titulo').value.trim();
      var desc = document.getElementById('nom035-cfg-desc').value.trim();
      if (!titulo) { Swal.showValidationMessage('El titulo es requerido'); return false; }
      var nuevaEstructura = { titulo: titulo, descripcion: desc, totalItems: items.length, items: items };
      return enviarPeticion('guardar_config_nom035', { tipoGuia: tipo, estructura: nuevaEstructura });
    },
    allowOutsideClick: function() { return !Swal.isLoading(); }
  }).then(function(result) {
    if (result.isConfirmed && result.value) {
      if (result.value.status === 'success') {
        mostrarToast('success', 'Guardado', 'Configuracion NOM-035 actualizada.');
      } else {
        mostrarToast('error', 'Error', result.value.message || 'No se pudo guardar.');
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   ESTADO DE SESIÓN
   Antes había dos indicadores "En línea" decorativos: puntos con
   animate-pulse fijos en el HTML que no consultaban nada. Decían
   que todo estaba bien incluso cuando el backend ya rechazaba
   cada petición.

   Ahora hay uno solo, alimentado por tres señales:
     1. La respuesta del backend (la más confiable)
     2. Un latido cada 4 min contra validar_token
     3. Inactividad local, solo para avisar ANTES de expirar
   ═══════════════════════════════════════════════════════════ */

/* ⚠ AJUSTA ESTO al valor real de tu backend. El endpoint
   validar_token no devuelve cuánto le queda a la sesión, así que
   el aviso previo se calcula localmente desde tu última
   interacción. */
const SESION_MINUTOS       = 60;   // duración de la sesión en el servidor
const SESION_AVISO_MINUTOS = 5;    // cuántos minutos antes avisar
const SESION_LATIDO_MS     = 4 * 60 * 1000;

let _sesEstado      = 'verificando';
let _sesUltimaAccion = Date.now();
let _sesLatidoId    = null;
let _sesTicId       = null;

/* Mensajes con los que el backend indica sesión muerta. Se compara
   en minúsculas y sin acentos para no depender de la redacción. */
function _sesEsMensajeDeSesion(msg){
  if(!msg) return false;
  var t = msg.toString().toLowerCase()
             .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return t.indexOf('sesion') !== -1 ||
         t.indexOf('token')  !== -1 ||
         t.indexOf('expiro') !== -1 ||
         t.indexOf('expirada') !== -1 ||
         t.indexOf('no autorizado') !== -1;
}

function _sesPintar(estado, texto){
  var el = document.getElementById('estado-sesion');
  if(!el) return;
  _sesEstado = estado;
  el.dataset.estado = estado;
  var txt = el.querySelector('.ses-txt');
  if(txt) txt.textContent = texto;
  el.title = ({
    activa:      'Sesión activa',
    verificando: 'Verificando sesión...',
    porexpirar:  'Tu sesión está por expirar. Clic para renovarla.',
    expirada:    'Sesión expirada. Clic para reconectar.',
    offline:     'Sin conexión a internet'
  })[estado] || '';
}

function _sesMostrarAviso(mostrar){
  var a = document.getElementById('ses-aviso');
  if(!a) return;
  a.classList.toggle('visible', !!mostrar);
}

/* Marca la sesión como muerta. Se llama desde el interceptor de
   respuestas o desde el latido. NO manda al login: eso borraría
   lo que el usuario tenga capturado a medias. */
function marcarSesionExpirada(){
  if(_sesEstado === 'expirada') return;   // no repetir el aviso
  _sesPintar('expirada','Desconectado');
  _sesMostrarAviso(true);
  if(_sesLatidoId){ clearInterval(_sesLatidoId); _sesLatidoId = null; }
}

function marcarSesionActiva(){
  _sesUltimaAccion = Date.now();
  _sesPintar('activa','En línea');
  _sesMostrarAviso(false);
  if(!_sesLatidoId) _sesIniciarLatido();
}

/* Latido silencioso: confirma con el servidor que el token vive.
   Silencioso a propósito: si el usuario no está haciendo nada, no
   tiene por qué ver un spinner cada cuatro minutos. */
async function _sesLatido(){
  if(_sesEstado === 'expirada') return;
  var token = (typeof getToken === 'function') ? getToken() : null;
  if(!token){ marcarSesionExpirada(); return; }

  if(!navigator.onLine){ _sesPintar('offline','Sin conexión'); return; }

  try{
    var r = await enviarPeticion('validar_token', {token});
    if(r && r.status === 'success'){
      // Ojo: NO se toca _sesUltimaAccion. El latido confirma que el
      // token vive, no que el usuario esté activo. Si lo actualizara,
      // el aviso previo nunca se dispararía.
      if(_sesEstado !== 'porexpirar') _sesPintar('activa','En línea');
      _sesMostrarAviso(false);
    }else{
      marcarSesionExpirada();
    }
  }catch(e){
    // Error de red: la sesión puede seguir viva. No se mata.
    _sesPintar('offline','Sin conexión');
  }
}

function _sesIniciarLatido(){
  if(_sesLatidoId) clearInterval(_sesLatidoId);
  _sesLatidoId = setInterval(_sesLatido, SESION_LATIDO_MS);
}

/* Reloj de inactividad: solo para el aviso previo. */
function _sesTic(){
  if(_sesEstado === 'expirada' || _sesEstado === 'offline') return;
  var minutos    = (Date.now() - _sesUltimaAccion) / 60000;
  var restantes  = Math.ceil(SESION_MINUTOS - minutos);

  if(restantes <= 0){
    // El reloj local cree que expiró; se confirma con el servidor
    // antes de declararlo. El reloj local puede estar desfasado.
    _sesLatido();
  }else if(restantes <= SESION_AVISO_MINUTOS){
    _sesPintar('porexpirar','Expira en ' + restantes + ' min');
  }else if(_sesEstado === 'porexpirar'){
    _sesPintar('activa','En línea');
  }
}

/* Clic en el badge */
function accionEstadoSesion(){
  if(_sesEstado === 'expirada'){ reconectarSesion(); return; }
  if(_sesEstado === 'porexpirar'){ renovarSesion(); return; }
  if(_sesEstado === 'offline'){ _sesLatido(); return; }
  // Si está activa, un clic fuerza verificación manual
  _sesPintar('verificando','Verificando');
  _sesLatido();
}

/* Renovar = cualquier petición válida reinicia el reloj del servidor */
async function renovarSesion(){
  _sesPintar('verificando','Renovando');
  _sesUltimaAccion = Date.now();
  await _sesLatido();
  if(_sesEstado !== 'expirada'){
    marcarSesionActiva();
    if(typeof mostrarToast === 'function'){
      mostrarToast('success','Sesión renovada','Puedes seguir trabajando.');
    }
  }
}

/* Reconectar: sí manda al login, pero solo cuando el usuario lo pide */
function reconectarSesion(){
  _sesMostrarAviso(false);
  if(typeof mostrarLoginScreen === 'function'){
    mostrarLoginScreen('Tu sesión expiró. Ingresa de nuevo para continuar.');
  }else{
    location.reload();
  }
}

/* ── Interceptor de respuestas ──
   Envuelve enviarPeticion sin modificar su código. Cada respuesta
   del backend actualiza el estado: es la señal más confiable que
   existe, porque viene del servidor. */
(function(){
  if(typeof enviarPeticion !== 'function') return;
  var original = enviarPeticion;

  window.enviarPeticion = async function(action, payload, timeoutMs){
    try{
      var r = await original(action, payload, timeoutMs);

      // El login exitoso reactiva todo
      if(action === 'login' && r && r.status === 'success'){
        marcarSesionActiva();
        return r;
      }

      if(r && r.status === 'error' && _sesEsMensajeDeSesion(r.message)){
        marcarSesionExpirada();
      }else if(r && r.status === 'success' && action !== 'validar_token'){
        // Una petición exitosa prueba dos cosas: hay red y el token
        // sirve. También cuenta como actividad del usuario.
        _sesUltimaAccion = Date.now();
        if(_sesEstado !== 'activa') marcarSesionActiva();
      }
      return r;

    }catch(e){
      if(_sesEstado === 'activa' || _sesEstado === 'porexpirar'){
        _sesPintar('offline','Sin conexión');
      }
      throw e;
    }
  };
})();

/* ── Actividad del usuario ──
   Reinicia el contador de inactividad. Se usa `passive` y un umbral
   de 20s para no escribir la variable miles de veces por minuto. */
(function(){
  var ultimoRegistro = 0;
  var registrar = function(){
    var ahora = Date.now();
    if(ahora - ultimoRegistro < 20000) return;
    ultimoRegistro   = ahora;
    _sesUltimaAccion = ahora;
  };
  ['click','keydown','touchstart','scroll'].forEach(function(ev){
    document.addEventListener(ev, registrar, {passive:true});
  });

  // Al volver de otra pestaña o de suspensión, verificar de inmediato:
  // el reloj local pudo quedar muy desfasado.
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && _sesEstado !== 'expirada') _sesLatido();
  });
  window.addEventListener('online',  function(){ _sesLatido(); });
  window.addEventListener('offline', function(){ _sesPintar('offline','Sin conexión'); });
})();

/* Arranque: se engancha a initApp sin modificarla */
(function(){
  var arrancar = function(){
    if(typeof getToken === 'function' && getToken()) marcarSesionActiva();
    else _sesPintar('expirada','Desconectado');
    if(_sesTicId) clearInterval(_sesTicId);
    _sesTicId = setInterval(_sesTic, 30000);   // revisa cada 30s
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(arrancar, 2500) });
  }else{
    setTimeout(arrancar, 2500);
  }
})();

/* Informe del numeral 7.7 — genera un Google Doc y devuelve el
   enlace. Llamable desde donde quieras: botón en el dashboard de
   NOM-035, menú de Encuestas, etc. */
async function generarInforme77UI(){
  let centros = [];
  try{
    const r = await enviarPeticion('listar_centros_nom035', {});
    if(r.status === 'success') centros = r.centros || [];
  }catch(e){}

  if(!centros.length){
    mostrarToast('warning','Sin centros','No se encontraron centros de trabajo con personal activo.');
    return;
  }

  const opciones = centros.map(c =>
    `<option value="${c.grupo}">${c.grupo} — ${c.activos} trabajadores</option>`).join('');

  const { value: grupo } = await Swal.fire({
    title: 'Informe NOM-035 · numeral 7.7',
    html: `
      <div style="text-align:left">
        <label style="display:block;font-size:.78rem;font-weight:600;color:#475569;margin-bottom:6px">
          Centro de trabajo
        </label>
        <select id="sw77-centro" class="gc-input">${opciones}</select>
        <p style="font-size:.75rem;color:#94a3b8;margin-top:12px;line-height:1.5">
          Se generará un documento en Google Drive con los ocho elementos
          que exige la Norma. No incluye datos individuales de los trabajadores.
        </p>
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'Generar informe',
    cancelButtonText: 'Cancelar',
    preConfirm: () => document.getElementById('sw77-centro').value
  });

  if(!grupo) return;

  mostrarLoader('Generando informe...');
  try{
    // Crear el Doc y agregar tablas toma su tiempo: 60s de margen.
    const r = await enviarPeticion('generar_informe_77', {grupo}, 60000);
    ocultarLoader();

    if(r.status !== 'success'){
      mostrarToast('error','No se pudo generar', r.message || 'Error desconocido.');
      return;
    }

    const aviso = r.completo ? '' :
      `<div style="background:#fef3c7;color:#92400e;padding:10px 12px;border-radius:9px;
                   font-size:.78rem;margin-top:14px;text-align:left;line-height:1.5">
         <strong>Faltan datos del centro.</strong> El informe se generó con campos
         marcados como [PENDIENTE]. Complétalos en la hoja
         <code>NOM035_CENTROS</code> y vuelve a generarlo antes de archivarlo.
       </div>`;

    await Swal.fire({
      icon: r.completo ? 'success' : 'warning',
      title: 'Informe generado',
      html: `
        <div style="text-align:left;font-size:.85rem;color:#475569;line-height:1.7">
          <strong>${r.resumen.centro}</strong><br>
          Trabajadores: ${r.resumen.activos}<br>
          Respondieron: ${r.resumen.respondieron} (${r.resumen.cobertura}%)<br>
          Nivel del centro: <strong>${r.resumen.nivelCentro}</strong><br>
          Requieren valoración clínica: ${r.resumen.giRequieren}
        </div>
        ${aviso}`,
      confirmButtonText: 'Abrir documento',
      showCancelButton: true,
      cancelButtonText: 'Cerrar'
    }).then(res => { if(res.isConfirmed) window.open(r.url, '_blank'); });

  }catch(e){
    ocultarLoader();
    mostrarToast('error','Error', e.message || 'No se pudo generar el informe.');
  }
}

/* El botón de Informe 7.7 solo aplica a NOM-035. Además, en esa
   pestaña se retira "Excel": el informe del 7.7 es el entregable
   formal y un volcado de hoja de cálculo al lado le resta claridad.
   CSV se queda para quien necesite los datos crudos. */
(function(){
  var sincronizar = function(){
    var wrap = document.getElementById('wrap-informe77');
    if(!wrap) return;

    var activa = document.querySelector('#enc-tabs .mod-tab.active, #enc-tabs .enc-tab.active');
    var esNom  = activa && /nom.?035/i.test(activa.textContent || '');

    if(!esNom){
      wrap.style.display = 'none';
      return;
    }

    var cont = document.getElementById('enc-contenido');
    if(!cont) return;

    // Oculta el botón de Excel solo en esta pestaña
    Array.prototype.forEach.call(cont.querySelectorAll('button'), function(b){
      if(/^\s*excel\s*$/i.test(b.textContent.trim())) b.style.display = 'none';
    });

    // Mueve el botón a la fila donde vive "Copiar link"
    var ancla = Array.prototype.filter.call(cont.querySelectorAll('button'), function(b){
      return /copiar link/i.test(b.textContent);
    })[0];

    var btn = wrap.querySelector('button');
    if(ancla && btn && ancla.parentNode && btn.parentNode !== ancla.parentNode){
      ancla.parentNode.appendChild(btn);
      wrap.style.display = 'none';
      return;
    }
    if(!ancla) wrap.style.display = 'flex';   // respaldo: se queda arriba
  };

  if(typeof activarTabEncuesta === 'function'){
    var original = activarTabEncuesta;
    window.activarTabEncuesta = function(){
      var r = original.apply(this, arguments);
      setTimeout(sincronizar, 60);
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(sincronizar, 1500) });
  setTimeout(sincronizar, 2000);
})();
