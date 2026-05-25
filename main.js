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
function showModule(id){
    document.querySelectorAll('.module-section').forEach(s=>{s.classList.remove('active');s.style.display='none';});
    const t=document.getElementById('module-'+id);if(!t)return;
    t.style.display='block';
    requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('active')));
    document.getElementById('header-title').innerText={dashboard:'Indicadores',alta:'Alta de Personal',baja:'Baja de Personal',basedatos:'Expedientes'}[id]||id;
    if(window.innerWidth<768)toggleMenu();
}
function mostrarLoader(t){document.getElementById('loader-text').innerText=t||'Procesando...';document.getElementById('global-loader').style.display='flex';}
function ocultarLoader(){document.getElementById('global-loader').style.display='none';}

// ─── SISTEMA DE NOTIFICACIONES INTERNAS ──────────────────────
// Toast flotante (aparece abajo derecha, desaparece solo)
// Centro de notificaciones (campana en header, lista persistente)
let notificaciones = JSON.parse(localStorage.getItem('gm_notifs') || '[]');

function guardarNotifs(){localStorage.setItem('gm_notifs', JSON.stringify(notificaciones.slice(0,50)));}

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

function agregarNotificacion(tipo, titulo, mensaje, empleadoId=''){
    const notif = {id: Date.now(), tipo, titulo, mensaje, empleadoId, leida: false, fecha: new Date().toISOString()};
    notificaciones.unshift(notif);
    guardarNotifs();
    actualizarBadgeNotifs();
    mostrarToast(tipo, titulo, mensaje);
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

function toggleCentroNotifs(){
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    panel.classList.toggle('hidden');
    if(!panel.classList.contains('hidden')) renderizarNotificaciones();
}

function renderizarNotificaciones(){
    const lista = document.getElementById('notif-lista');
    if(!lista) return;
    // Marcar todas como leídas al abrir
    notificaciones.forEach(n=>n.leida=true);
    guardarNotifs();
    actualizarBadgeNotifs();

    if(!notificaciones.length){
        lista.innerHTML='<div class="text-center py-10"><i class="fas fa-bell-slash text-slate-300 text-3xl mb-3"></i><p class="text-sm text-slate-400">Sin notificaciones</p></div>';
        return;
    }
    const iconos={success:'fa-check-circle text-emerald-500',warning:'fa-triangle-exclamation text-amber-400',error:'fa-circle-xmark text-red-500',info:'fa-circle-info text-blue-500',contrato:'fa-file-contract text-orange-400'};
    lista.innerHTML = notificaciones.map(n=>{
        const hace = tiempoRelativo(n.fecha);
        const ic   = iconos[n.tipo]||iconos.info;
        const emp  = n.empleadoId ? `<button onclick="abrirEditor('${n.empleadoId}');toggleCentroNotifs()" class="text-xs text-blue-600 hover:underline mt-1">Ver empleado →</button>` : '';
        return `<div class="flex items-start gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition">
          <i class="fas ${ic} text-base flex-shrink-0 mt-0.5"></i>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">${n.titulo}</p>
            <p class="text-xs text-slate-500 mt-0.5">${n.mensaje}</p>
            ${emp}
            <p class="text-xs text-slate-300 mt-1">${hace}</p>
          </div>
        </div>`;
    }).join('');
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

function evaluarAlertas(datos){
    const hoy        = new Date();
    hoy.setHours(0,0,0,0);
    const alertasVistas = JSON.parse(localStorage.getItem(CLAVE_ALERTAS)||'{}');
    let nuevas = 0;

    datos.filter(e=>(e["ESTATUS"]||"").trim()==="Activo").forEach(emp=>{
        const id  = (emp["NO. EMPLEADO"]||"").toString();
        const nom = emp["NOMBRE DEL TRABAJADOR"] || ("Empleado #"+id);

        // ── Vencimientos de contrato ──────────────────────────
        [
            {label:'1er',ini:'FECHA DE INICIO DEL PRIMER CONTRATO',  ven:'FECHA DE VENCIMIENTO DEL PRIMER CONTRATO'},
            {label:'2do',ini:'FECHA DE INICIO DEL SEGUNDO CONTRATO', ven:'FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO'},
            {label:'3er',ini:'FECHA DE INICIO DEL TERCER CONTRATO',  ven:'FECHA DE VENCIMIENTO DEL TERCER CONTRATO'},
        ].forEach(({label, ven})=>{
            const fv = parseFechaFlexible(emp[ven]);
            if(!fv) return;
            const dias = Math.round((fv - hoy) / 86400000);
            const clave = `cont_${id}_${label}`;
            if(alertasVistas[clave] === fv.toISOString().slice(0,10)) return;

            if(dias < 0){
                agregarNotificacion('error', `Contrato vencido — ${nom}`, `El ${label} contrato venció hace ${Math.abs(dias)} día(s). Requiere renovación o baja.`, id);
                alertasVistas[clave] = fv.toISOString().slice(0,10); nuevas++;
            } else if(dias <= DIAS_ALERTA_CONTRATO){
                agregarNotificacion('contrato', `Contrato por vencer — ${nom}`, `El ${label} contrato vence en ${dias} día(s) (${fv.toLocaleDateString('es-MX')}). Gestiona la renovación.`, id);
                alertasVistas[clave] = fv.toISOString().slice(0,10); nuevas++;
            }
        });

        // ── Entrevistas de 15 días ────────────────────────────
        const ent15 = (emp["ENTREVISTA DE AJUSTE 15 DÍAS"]||"").trim();
        const fIng  = parseFechaFlexible(emp["FECHA DE INGRESO"]);
        if(fIng && (ent15 === "" || ent15 === "Pendiente")){
            const diasIngreso = Math.round((hoy - fIng) / 86400000);
            const clave15 = `ent15_${id}`;
            if(diasIngreso >= 13 && diasIngreso <= 20 && !alertasVistas[clave15]){
                agregarNotificacion('warning', `Entrevista 15 días — ${nom}`, `Lleva ${diasIngreso} días en la empresa. Debe realizarse la entrevista de ajuste de 15 días.`, id);
                alertasVistas[clave15] = '1'; nuevas++;
            }
        }

        // ── Entrevistas de 45 días ────────────────────────────
        const ent45 = (emp["ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS"]||"").trim();
        if(fIng && (ent45 === "" || ent45 === "Pendiente")){
            const diasIngreso = Math.round((hoy - fIng) / 86400000);
            const clave45 = `ent45_${id}`;
            if(diasIngreso >= 43 && diasIngreso <= 55 && !alertasVistas[clave45]){
                agregarNotificacion('warning', `Entrevista 45 días — ${nom}`, `Lleva ${diasIngreso} días. Debe aplicarse la evaluación de desempeño de 45 días.`, id);
                alertasVistas[clave45] = '1'; nuevas++;
            }
        }
    });

    localStorage.setItem(CLAVE_ALERTAS, JSON.stringify(alertasVistas));
    if(nuevas > 0) mostrarToast('info','Alertas generadas',`Se encontraron ${nuevas} alertas pendientes de atención.`,6000);
}

// ─── CATÁLOGOS ───────────────────────────────────────────────
// Empresas dinámicas — se generan desde el cache del Sheet
// El array base sirve como semilla si el cache aún no cargó
let empresas = ["Newspot Mexico","Centro De Telecomunicaciones Y Publicidad De Mexico","Global Media","Editora Mexicana","Cable Master","Fember Press","Infomonitor","Rtv Comunicacion","Radio Expresion Cultural"];

function actualizarListaEmpresas() {
    if (!cacheGlobal || !cacheGlobal.length) return;
    const nuevas = [...new Set(
        cacheGlobal
            .map(e => (e["EMPRESA"] || "").trim())
            .filter(e => e.length > 0)
    )].sort();
    if (nuevas.length > 0) empresas = nuevas;

    // Actualizar todos los selects de empresa en el DOM
    const selectsEmpresa = [
        document.getElementById("filtroEmpresaGlobal"),
        document.getElementById("filtro-empresa"),
    ];
    selectsEmpresa.forEach(function(sel) {
        if (!sel) return;
        const valActual = sel.value;
        // Conservar la opción "Todas" si existe
        const primeraOpcion = sel.options[0];
        sel.innerHTML = "";
        if (primeraOpcion) sel.appendChild(primeraOpcion);
        empresas.forEach(function(emp) {
            const opt = document.createElement("option");
            opt.value = emp;
            opt.textContent = emp;
            sel.appendChild(opt);
        });
        if (valActual) sel.value = valActual;
    });

    // Actualizar datalists de empresa en el formulario de alta
    const listEmpAlta = document.getElementById("alta_empresa");
    if (listEmpAlta && listEmpAlta.tagName === "SELECT") {
        const v = listEmpAlta.value;
        listEmpAlta.innerHTML = "<option value=''>Seleccione...</option>" +
            empresas.map(e => "<option value='" + e + "'>" + e + "</option>").join("");
        if (v) listEmpAlta.value = v;
    }

    // Actualizar filtro del expediente (HTML estático en index.html)
    const filtroEmpExp = document.getElementById("filtro-empresa");
    if (filtroEmpExp) {
        const v = filtroEmpExp.value;
        filtroEmpExp.innerHTML = "<option value=''>Todas las empresas</option>" +
            empresas.map(e => "<option value='" + e + "'>" + e + "</option>").join("");
        if (v) filtroEmpExp.value = v;
    }
}

// ─── PARSERS ─────────────────────────────────────────────────
function parsearFecha(val){
    if(!val)return"";var s=val.toString().trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    var n=parseFloat(s);
    if(!isNaN(n)&&n>10000&&n<100000){var d=new Date((n-25569)*86400*1000);if(!isNaN(d))return d.toISOString().slice(0,10);}
    var d2=new Date(s);return isNaN(d2)?"":d2.toISOString().slice(0,10);
}
function parsearMonto(val){
    if(!val&&val!==0)return"";
    var s=val.toString().replace(/[$\s,]/g,"");var n=parseFloat(s);return isNaN(n)?"":n;
}
function parseFechaFlexible(val){
    if(!val)return null;var s=val.toString().trim();if(!s||s==="0")return null;
    var n=parseFloat(s);
    if(!isNaN(n)&&n>10000&&n<100000){var d=new Date((n-25569)*86400*1000);if(!isNaN(d))return d;}
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m)return new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]));
    var m2=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m2)return new Date(parseInt(m2[1]),parseInt(m2[2])-1,parseInt(m2[3]));
    var d=new Date(s);return isNaN(d)?null:d;
}
function parsearMontoSheet(val){
    if(!val&&val!==0)return 0;var s=val.toString().replace(/[$\s,]/g,"");var n=parseFloat(s);return isNaN(n)?0:n;
}
const CAMPOS_FECHA=["FECHA DE INGRESO","FECHA DE BAJA","FECHA DE NACIMIENTO","INICIO DEL PRIMER CONTRATO","FECHA DE VENCIMIENTO DEL PRIMER CONTRATO","FECHA DE INICIO DEL SEGUNDO CONTRATO","FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO","FECHA DE INICIO DEL TERCER CONTRATO","FECHA DE VENCIMIENTO DEL TERCER CONTRATO","FECHA EVALUACIÓN 360"];
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
const PASOS=[
    // PASO 0 — Documentos y OCR (PRIMERO)
    {id:'paso-documentos',titulo:'Documentos',icono:'fa-wand-magic-sparkles',color:'amber',descripcion:'Carga documentos para pre-rellenar el formulario automáticamente',campos:[]},
    // PASO 1 — Datos laborales
    {id:'paso-empleo',titulo:'Datos Laborales',icono:'fa-briefcase',color:'blue',descripcion:'Información del puesto y contratación',campos:[
        {id:"numeroEmpleado",     label:"No. de Empleado",       type:"number",req:true, col:2,autonum:true},
        {id:"fechaIngreso",       label:"Fecha de Ingreso",       type:"date",  req:true, col:2},
        {id:"nombreTrabajador",   label:"Nombre Completo",        type:"text",  req:true, col:2,placeholder:"Apellido Paterno Materno Nombre(s)"},
        {id:"empresa",            label:"Empresa",                type:"select",req:true, col:2,options:empresas},
        {id:"departamento",       label:"Departamento",           type:"datalist", req:true, col:2, listId:'list-departamentos'},
        {id:"puesto",             label:"Puesto",                 type:"datalist", req:true, col:2, listId:'list-puestos'},
        {id:"tipoIngreso",        label:"Tipo de Ingreso",        type:"select",req:true, col:2,options:["Administrativo","Operativo"]},
        {id:"sueldoMensual",      label:"Sueldo Mensual (MXN)",   type:"number",req:true, col:2,placeholder:"0.00"},
        {id:"frecuenciaPago",     label:"Frecuencia de Pago",     type:"select",req:true, col:2,options:["Quincenal","Semanal","Mensual"]},
        {id:"fuenteContratacion", label:"Fuente de Contratación", type:"text",  req:false,col:2,placeholder:"Ej. Referido, OCC, LinkedIn..."},
    ]},
    // PASO 2 — Contrato
    {id:'paso-contrato',titulo:'Contrato',icono:'fa-file-contract',color:'indigo',descripcion:'Tipo, vigencias y seguimiento de contratos',campos:[
        {id:"tipoContrato",              label:"Tipo de Contrato",            type:"select",req:true, col:2,options:["Tiempo Indeterminado","Prueba","Temporal"]},
        {id:"fechaInicioContrato",       label:"Inicio 1er Contrato",         type:"date",  req:false,col:2},
        {id:"vencimientoPrimerContrato", label:"Vencimiento 1er Contrato",    type:"date",  req:false,col:2},
        {id:"entrevista15Dias",          label:"Entrevista Ajuste 15 Días",   type:"select",req:false,col:2,options:["Pendiente","Sí","No"]},
        {id:"entrevista45Dias",          label:"Entrevista y Eval. 45 Días",  type:"select",req:false,col:2,options:["Pendiente","Sí","No"]},
        {id:"iniciSegundoContrato",      label:"Inicio 2do Contrato",         type:"date",  req:false,col:2},
        {id:"vencSegundoContrato",       label:"Vencimiento 2do Contrato",    type:"date",  req:false,col:2},
        {id:"iniciTercerContrato",       label:"Inicio 3er Contrato",         type:"date",  req:false,col:2},
        {id:"vencTercerContrato",        label:"Vencimiento 3er Contrato",    type:"date",  req:false,col:2},
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
    el.innerHTML=`
      <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div class="w-12 h-12 rounded-xl ${cols[paso.color]||'bg-slate-100 text-slate-500'} flex items-center justify-center flex-shrink-0"><i class="fas ${paso.icono} text-xl"></i></div>
        <div><h3 class="text-base font-bold text-slate-800">${paso.titulo}</h3><p class="text-sm text-slate-400 mt-0.5">${paso.descripcion}</p></div>
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
    } else if(c.type==='select'){
        inp=`<select id="alta_${c.id}" ${c.req?'required':''} ${c.readonly?'title="Calculado automáticamente"':''} class="${cls} ${c.readonly?'bg-slate-50 cursor-default':'cursor-pointer'}"><option value="">Seleccione...</option>${(c.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
    }else if(c.type==='textarea'){
        inp=`<textarea id="alta_${c.id}" rows="2" ${ph} class="${cls} resize-none"></textarea>`;
    }else{
        inp=`<input type="${c.type}" id="alta_${c.id}" ${c.req?'required':''} ${ml} ${ph} class="${cls}">`;
    }
    return`<div class="${span}"><label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">${c.label} ${req}${nota}</label>${inp}</div>`;
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
    const empresa = altaData.empresa || document.getElementById("alta_empresa")?.value || "";
    if(!empresa){
        // Sin empresa seleccionada — no asignar número aún
        const el = document.getElementById("alta_numeroEmpleado");
        if(el) el.placeholder = "Selecciona la empresa primero";
        return;
    }
    try{
        const r = await enviarPeticion("siguiente_numero", { empresa });
        if(r.status === "success"){
            const el = document.getElementById("alta_numeroEmpleado");
            if(el){
                el.value = r.siguiente;
                el.placeholder = "";
            }
            altaData.numeroEmpleado = r.siguiente.toString();
            if(r.idInterno) altaData._idInterno = r.idInterno;
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
            // Convertir a Base64 en el browser
            const b64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload  = () => res(r.result.split(',')[1]);
                r.onerror = () => rej(new Error('Error leyendo ' + file.name));
                r.readAsDataURL(file);
            });

            stTxt.innerText = `Analizando: ${file.name}...`;

            // Motor 1: Groq/Llama (IA gratuita — Drive extrae texto, Groq analiza)
            // Motor 2: fallback a Vision API + regex si Groq falla
            let r = await enviarPeticion('groq_ocr', {
                data:     b64,
                mimeType: file.type,
                nombre:   file.name
            });
            if (r.status !== 'success') {
                console.warn('[OCR] Groq falló, usando Vision API:', r.message);
                r = await enviarPeticion('ocr_documento', {
                    data:     b64,
                    mimeType: file.type,
                    nombre:   file.name
                });
            }

            if (r.status !== 'success') {
                errores.push(`${file.name}: ${r.message}`);
                continue;
            }

            // Acumular los datos detectados de todos los archivos
            Object.entries(r.datos || {}).forEach(([k, v]) => {
                if (v && v.toString().trim()) acum[k] = v.toString().trim();
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
        // Normalizar nombre a Title Case
        if (k === 'nombreTrabajador') v = toTitleCase(v.toString());
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
    if(paso.id==='paso-personal')calcularRangoEdadAuto();
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
        {titulo:'Datos Laborales',icono:'fa-briefcase',color:'text-blue-500',filas:[['No. Empleado',altaData.numeroEmpleado],['Fecha de Ingreso',altaData.fechaIngreso],['Nombre Completo',altaData.nombreTrabajador],['Empresa',altaData.empresa],['Departamento',altaData.departamento],['Puesto',altaData.puesto],['Tipo de Ingreso',altaData.tipoIngreso],['Sueldo Mensual',altaData.sueldoMensual?'$'+Number(altaData.sueldoMensual).toLocaleString('es-MX'):''],['Frecuencia de Pago',altaData.frecuenciaPago]]},
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
            Swal.fire({icon:'success',title:'¡Alta registrada!',text:r.message,confirmButtonText:'Ver expediente en Drive',showCancelButton:true,cancelButtonText:'Cerrar'}).then(res=>{if(res.isConfirmed&&r.urlExpediente)window.open(r.urlExpediente,'_blank');});
            altaData={};pasoActual=0;renderizarStepper();forzarActualizacion();
        }else mostrarToast('error','Error en el alta',r.message);
    }catch(e){ocultarLoader();mostrarToast('error','Error de conexión',e.message);}
}

// ─── API GAS ──────────────────────────────────────────────────
async function enviarPeticion(action,payload){
    const res=await fetch(API_URL,{method:'POST',body:JSON.stringify({action,payload})});
    return await res.json();
}

// ─── DRAWER EDICIÓN DE EMPLEADO ───────────────────────────────
let empleadoEdicion=null;

function abrirEditor(noEmpleado){
    const emp=cacheGlobal.find(e=>(e["NO. EMPLEADO"]||"").toString()===noEmpleado.toString());
    if(!emp){mostrarToast('error','No encontrado','No se encontró el registro.');return;}
    empleadoEdicion=emp;
    const drawer=document.getElementById('drawer-editor');
    renderizarDrawer(emp);
    drawer.classList.remove('translate-x-full');
    document.getElementById('drawer-overlay').classList.remove('hidden');
}

function cerrarEditor(){
    document.getElementById('drawer-editor').classList.add('translate-x-full');
    document.getElementById('drawer-overlay').classList.add('hidden');
    empleadoEdicion=null;
}

function fmtFechaDisplay(val){
    const d=parseFechaFlexible(val);if(!d)return'—';
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
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
    const id  = (empleadoEdicion["NO. EMPLEADO"] || "").toString();
    const nom = empleadoEdicion["NOMBRE DEL TRABAJADOR"] || "Sin Nombre";
    const emp = empleadoEdicion["EMPRESA"] || "";

    const btn = document.querySelector('[onclick="crearExpedienteEnDrive()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando carpeta...';
    }

    try {
        const r = await enviarPeticion('crear_expediente', {
            numeroEmpleado:  id,
            nombreTrabajador: nom,
            empresa:         emp
        });

        if (r.status === 'success') {
            // Actualizar el cache local con la URL nueva
            const empCache = cacheGlobal.find(e =>
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
// ─── FOTO DE PERFIL DEL EMPLEADO ─────────────────────────────
async function cargarFotoPerfil(folderUrl){
    var partes = folderUrl.split('/folders/');
    if(partes.length < 2) return;
    var folderId = partes[1].split('?')[0].trim();
    if(!folderId) return;
    try {
        var r = await enviarPeticion('obtener_foto', { folderId: folderId });
        if(r.status === 'success' && r.url) {
            var avatar = document.getElementById('avatar-circulo');
            if(avatar) {
                var img = document.createElement('img');
                img.src = r.url;
                img.className = 'w-full h-full object-cover';
                img.onerror = function(){ this.parentElement.innerHTML = '<i class="fas fa-user"></i>'; };
                avatar.innerHTML = '';
                avatar.appendChild(img);
            }
        }
    } catch(e) {
        console.warn('No se pudo cargar foto:', e);
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
    const id = (empleadoEdicion["NO. EMPLEADO"]||"").toString();
    const resp = await enviarPeticion('subir_documento',{
        numeroEmpleado: id,
        nombreArchivo: 'foto_perfil_'+id+'.'+file.name.split('.').pop(),
        mimeType: file.type,
        data: b64
    });
    if(resp.status === 'success'){
        mostrarToast('success','Foto guardada','Foto de perfil actualizada en el expediente.');
        const url = (empleadoEdicion["URL EXPEDIENTE"]||"").toString().trim();
        if(url) cargarFotoPerfil(url);
    } else {
        mostrarToast('error','Error','No se pudo subir la foto: '+resp.message);
    }
    input.value = '';
}

function renderizarDrawer(emp){
    const id  = (emp["NO. EMPLEADO"]||"").toString();
    const nom = emp["NOMBRE DEL TRABAJADOR"]||"—";
    const est = (emp["ESTATUS"]||"").trim();
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
    const sec = function(titulo,icono,color,html){
        return '<div class="mb-5"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">'
              +'<i class="fas '+icono+' '+color+'"></i>'+titulo+'</p>'
              +'<div class="grid grid-cols-2 gap-3">'+html+'</div></div>';
    };
    const ff = function(v){
        if(!v||v==="0"||v==="") return "—";
        var n=parseFloat(v);
        if(!isNaN(n)&&n>10000){var d=new Date((n-25569)*86400*1000);return d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});}
        return v.toString();
    };
    const E = emp;

    document.getElementById("drawer-cuerpo").innerHTML =
    sec("Datos Laborales","fa-briefcase","text-blue-500",
        ro("No. Empleado",E["NO. EMPLEADO"])+
        ro("Fecha Ingreso",ff(E["FECHA DE INGRESO"]))+
        ro("Estatus ⟵ fórmula Sheet",E["ESTATUS"])+
        ro("Antigüedad ⟵ fórmula Sheet",E["ANTIGÜEDAD"])+
        ed("ed_empresa","Empresa",E["EMPRESA"])+
        ed("ed_puesto","Puesto",E["PUESTO"])+
        ed("ed_depto","Departamento",E["DEPARTAMENTO"])+
        ed("ed_tipoIngreso","Tipo de Ingreso",E["TIPO DE INGRESO"])+
        ed("ed_sueldo","Sueldo Mensual",E["SUELDO MENSUAL"],"number")+
        ed("ed_frecPago","Frecuencia de Pago",E["FRECUENCIA DE PAGO"])+
        ed("ed_fuente","Fuente de Contratación",E["FUENTE DE CONTRATACIÓN"])
    )+
    sec("Datos Personales","fa-id-card","text-teal-500",
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
    )+
    sec("Contacto","fa-phone","text-cyan-500",
        ed("ed_correo","Correo Electrónico",E["CORREO ELECTRÓNICO"],"email")+
        ed("ed_telefono","Teléfono Personal",E["TELÉFONO PERSONAL"])+
        '<div class="col-span-2">'+ed("ed_domicilio","Domicilio Completo",E["DOMICILIO COMPLETO (CALLE, NÚMERO, COLONIA, CP, ESTADO Y MUNICIPIO)"])+'</div>'+
        ed("ed_contEmerg","Contacto de Emergencia",E["CONTACTO DE EMERGENCIA"])+
        ed("ed_parEmerg","Parentesco",E["PARENTESCO"])+
        ed("ed_telEmerg","Teléfono de Emergencia",E["TELÉFONO DE EMERGENCIA"])
    )+
    sec("Beneficiario IMSS","fa-heart","text-rose-500",
        ed("ed_nomBenef","Nombre Beneficiario",E["NOMBRE DEL BENEFICIARIO"])+
        ed("ed_rfcBenef","RFC Beneficiario",E["RFC DEL BENEFICIARIO"])+
        ed("ed_parBenef","Parentesco",E["PARENTESCO DEL BENEFICIARIO"])+
        ed("ed_pctBenef","% Asignación",E["PORCENTAJE DE ASIGNACIÓN"],"number")
    )+
    '<div class="mb-5"><p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2"><i class="fas fa-file-contract text-indigo-500"></i>Contratos</p>'
    +'<div class="grid grid-cols-2 gap-3">'
    +sel("ed_tipoContrato","Tipo de Contrato",E["TIPO DE CONTRATO"],["","Tiempo Indeterminado","Prueba","Temporal"])
    +ro("Inicio 1er Contrato",ff(E["FECHA DE INICIO DEL PRIMER CONTRATO"]))
    +ro("Vence 1er Contrato",ff(E["FECHA DE VENCIMIENTO DEL PRIMER CONTRATO"]))
    +ro("Inicio 2do Contrato",ff(E["FECHA DE INICIO DEL SEGUNDO CONTRATO"]))
    +ro("Vence 2do Contrato",ff(E["FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO"]))
    +ro("Inicio 3er Contrato",ff(E["FECHA DE INICIO DEL TERCER CONTRATO"]))
    +ro("Vence 3er Contrato",ff(E["FECHA DE VENCIMIENTO DEL TERCER CONTRATO"]))
    +'</div>'
    +'<div class="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">'
    +'<p class="text-xs font-bold text-blue-800 mb-2"><i class="fas fa-plus-circle mr-1 text-blue-500"></i>Nuevo contrato</p>'
    +'<div class="grid grid-cols-2 gap-2">'
    +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Inicio</label>'
    +'<input type="date" id="ed_iniContrato" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"></div>'
    +'<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Vencimiento</label>'
    +'<input type="date" id="ed_venContrato" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"></div>'
    +'</div></div></div>'+
    sec("Seguimiento","fa-clipboard-list","text-amber-500",
        sel("ed_ent15","Entrevista 15 Días",E["ENTREVISTA DE AJUSTE 15 DÍAS"],["","Pendiente","Sí","No"])+
        sel("ed_ent45","Entrevista 45 Días",E["ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS"],["","Pendiente","Sí","No"])+
        '<div><label class="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Evaluación 360°</label>'
        +'<input type="date" id="ed_eval360" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"></div>'
    )+
    sec("Calculado por el Sheet","fa-function","text-slate-400",
        ro("Para Ant. Promedio ⟵ fórmula",E["PARA ANT. PROMEDIO"])+
        ro("Se Toma en Cuenta ⟵ fórmula",E["SE TOMA EN CUENTA?"])
    )+
    (url && url.indexOf("http") === 0
        // ── Con expediente: mostrar link + botón subir docs ──
        ? '<div class="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">'
          + '<div class="flex items-center gap-3">'
          + '<i class="fas fa-folder-open text-blue-500 text-xl flex-shrink-0"></i>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm font-bold text-blue-800">Expediente en Drive</p>'
          + '<p class="text-xs text-blue-600 truncate">' + url + '</p>'
          + '</div>'
          + '<a href="' + url + '" target="_blank" rel="noopener" '
          + 'class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition flex-shrink-0">'
          + '<i class="fas fa-external-link-alt mr-1"></i>Abrir</a>'
          + '</div>'
          + '</div>'
        // ── Sin expediente: botón para crear la carpeta en Drive ──
        : '<div class="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">'
          + '<div class="flex items-center gap-3 mb-3">'
          + '<i class="fas fa-folder text-amber-400 text-xl flex-shrink-0"></i>'
          + '<div class="flex-1">'
          + '<p class="text-sm font-bold text-amber-800">Sin expediente en Drive</p>'
          + '<p class="text-xs text-amber-600">Este empleado no tiene carpeta asignada en Drive.</p>'
          + '</div>'
          + '</div>'
          + '<button onclick="crearExpedienteEnDrive()" '
          + 'class="w-full text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 py-2.5 rounded-xl transition flex items-center justify-center gap-2">'
          + '<i class="fas fa-folder-plus"></i> Crear carpeta de expediente'
          + '</button>'
          + '</div>'
    );

    const eval360val = E["FECHA EVALUACIÓN 360"]||"";
    if(eval360val){const el=document.getElementById("ed_eval360");if(el)el.value=parsearFecha(eval360val);}
}


async function guardarCambiosEditor(){
    if(!empleadoEdicion){cerrarEditor();return;}
    const id=(empleadoEdicion["NO. EMPLEADO"]||"").toString();

    // Determinar siguiente contrato disponible
    const contratos=[
        {ini:'FECHA DE INICIO DEL PRIMER CONTRATO', ven:'FECHA DE VENCIMIENTO DEL PRIMER CONTRATO'},
        {ini:'FECHA DE INICIO DEL SEGUNDO CONTRATO',ven:'FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO'},
        {ini:'FECHA DE INICIO DEL TERCER CONTRATO', ven:'FECHA DE VENCIMIENTO DEL TERCER CONTRATO'},
    ];
    const iniNuevo=document.getElementById('ed_iniContrato').value;
    const venNuevo=document.getElementById('ed_venContrato').value;
    let campoIni='',campoVen='';
    if(iniNuevo||venNuevo){
        for(const c of contratos){
            if(!empleadoEdicion[c.ini]){campoIni=c.ini;campoVen=c.ven;break;}
        }
        if(!campoIni){campoIni=contratos[2].ini;campoVen=contratos[2].ven;} // usar 3er si todos llenos
    }

    const payload={
        numeroEmpleado: id,
        campos:{
            "EMPRESA":                 document.getElementById('ed_empresa')?.value||undefined,
            "PUESTO":                  document.getElementById('ed_puesto')?.value||undefined,
            "DEPARTAMENTO":            document.getElementById('ed_depto')?.value||undefined,
            "TIPO DE INGRESO":         document.getElementById('ed_tipoIngreso')?.value||undefined,
            "SUELDO MENSUAL":          document.getElementById('ed_sueldo')?.value||undefined,
            "FRECUENCIA DE PAGO":      document.getElementById('ed_frecPago')?.value||undefined,
            "FUENTE DE CONTRATACIÓN":  document.getElementById('ed_fuente')?.value||undefined,
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
            "ENTREVISTA DE AJUSTE 15 DÍAS": document.getElementById('ed_ent15')?.value||undefined,
            "ENTREVISTA DE AJUSTE Y EVAL. DESEMPEÑO 45 DÍAS": document.getElementById('ed_ent45')?.value||undefined,
            "FECHA EVALUACIÓN 360":    document.getElementById('ed_eval360')?.value||undefined,
            ...(campoIni&&iniNuevo?{[campoIni]:iniNuevo}:{}),
            ...(campoVen&&venNuevo?{[campoVen]:venNuevo}:{}),
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
        const hits=cacheGlobal.filter(e=>(e["NOMBRE DEL TRABAJADOR"]||"").toLowerCase().includes(q)||(e["NO. EMPLEADO"]||"").toString().includes(q)).slice(0,8);
        if(!hits.length){lista.classList.add('hidden');return;}
        lista.classList.remove('hidden');
        lista.innerHTML=hits.map(emp=>{
            const est=(emp["ESTATUS"]||"").trim();
            const col=est==="Activo"?"text-emerald-600":"text-red-500";
            const nomE=(emp["NOMBRE DEL TRABAJADOR"]||"—").replace(/'/g,"\\'");
            const emp2=(emp["EMPRESA"]||"").replace(/'/g,"\\'");
            const pu=(emp["PUESTO"]||"").replace(/'/g,"\\'");
            return`<button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition" onclick="seleccionarEmpleado('${emp["NO. EMPLEADO"]}','${nomE}','${est}','${emp2}','${pu}')"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold text-slate-800">${emp["NOMBRE DEL TRABAJADOR"]||"—"}</p><p class="text-xs text-slate-400">#${emp["NO. EMPLEADO"]} · ${emp["EMPRESA"]} · ${emp["PUESTO"]}</p></div><span class="text-xs font-bold ${col} flex-shrink-0">${est}</span></div></button>`;
        }).join('');
    });
    document.addEventListener('click',e=>{if(!lista.contains(e.target)&&e.target!==nuevo)lista.classList.add('hidden');});
}

function seleccionarEmpleado(id,nombre,estatus,empresa,puesto){
    document.getElementById('baja_busqueda').value=nombre;
    document.getElementById('baja_idEmpleado').value=id;
    document.getElementById('baja_nombreEmpleado').value=nombre;
    document.getElementById('baja_sugerencias').classList.add('hidden');
    const badge=document.getElementById('baja_empleado_badge');
    badge.classList.remove('hidden');
    const col=estatus==='Activo'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600';
    badge.innerHTML=`<div class="flex items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><i class="fas fa-user text-slate-500"></i></div><div><p class="text-sm font-bold text-slate-800">${nombre}</p><p class="text-xs text-slate-400">#${id} · ${empresa} · ${puesto}</p></div></div><span class="text-xs font-bold px-2.5 py-1 rounded-full ${col}">${estatus}</span></div>`;
}

async function procesarBaja(event){
    event.preventDefault();
    const id=document.getElementById('baja_idEmpleado').value.trim();
    const nom=document.getElementById('baja_nombreEmpleado').value.trim();
    if(!id&&!nom){mostrarToast('warning','Selecciona un colaborador','Escribe y selecciona el nombre del colaborador primero.');return;}
    mostrarLoader("Procesando baja...");
    const payload={numeroEmpleado:id,nombreEmpleado:nom,fechaBaja:document.getElementById('baja_fechaBaja').value,tipoSalida:document.getElementById('baja_tipoSalida').value,motivoSalida:document.getElementById('baja_motivoSalida').value,montoFiniquito:document.getElementById('baja_montoFiniquito').value};
    try{
        const r=await enviarPeticion("baja",payload);ocultarLoader();
        if(r.status==="success"){mostrarToast('success','Baja registrada',r.message);document.getElementById('formBaja').reset();document.getElementById('baja_empleado_badge').classList.add('hidden');document.getElementById('baja_sugerencias').classList.add('hidden');forzarActualizacion();}
        else mostrarToast('warning','No encontrado',r.message);
    }catch(e){ocultarLoader();mostrarToast('error','Error',e.message);}
}

// ─── CACHÉ Y DATOS ────────────────────────────────────────────
let cacheGlobal=[];
async function obtenerDatos(forzar){
    if(!forzar&&cacheGlobal.length)return cacheGlobal;
    mostrarLoader("Sincronizando base de datos...");
    try{
        const r=await enviarPeticion("exportar_datos",{});ocultarLoader();
        if(r.status==="success"){
            cacheGlobal=r.data.filter(e=>e["NO. EMPLEADO"]&&e["NO. EMPLEADO"].toString().trim()!=="");
            return cacheGlobal;
        }
        return[];
    }catch(e){ocultarLoader();return[];}
}
async function forzarActualizacion(){
    cacheGlobal=[];
    datosFiltrados=[];
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
    await obtenerDatos();
    datosFiltrados = [...cacheGlobal];
    paginaActual = 1;
    renderizarPagina(1);
}

function aplicarFiltros() {
    const busqueda = (document.getElementById('filtro-busqueda')?.value || '').toLowerCase().trim();
    const empresa  = (document.getElementById('filtro-empresa')?.value  || '').trim();
    const estatus  = (document.getElementById('filtro-estatus')?.value  || '').trim();

    datosFiltrados = cacheGlobal.filter(emp => {
        const nombre = (emp["NOMBRE DEL TRABAJADOR"] || "").toLowerCase();
        const noEmp  = (emp["NO. EMPLEADO"] || "").toString().toLowerCase();
        const puesto = (emp["PUESTO"] || "").toLowerCase();
        const pasaBusqueda = !busqueda || nombre.includes(busqueda) || noEmp.includes(busqueda) || puesto.includes(busqueda);
        const pasaEmpresa  = !empresa  || (emp["EMPRESA"] || "").trim() === empresa;
        const pasaEstatus  = !estatus  || (emp["ESTATUS"]  || "").trim() === estatus;
        return pasaBusqueda && pasaEmpresa && pasaEstatus;
    });

    paginaActual = 1;
    renderizarPagina(1);

    const hayFiltros  = busqueda || empresa || estatus;
    const btnLimpiar  = document.getElementById('btn-limpiar-filtros');
    const contador    = document.getElementById('contador-filtros');
    if (btnLimpiar) btnLimpiar.classList.toggle('hidden', !hayFiltros);
    if (contador)   contador.textContent = hayFiltros ? datosFiltrados.length + ' de ' + cacheGlobal.length + ' resultados' : '';
}

function limpiarFiltros() {
    ['filtro-busqueda','filtro-empresa','filtro-estatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    aplicarFiltros();
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
                + '<td class="px-5 py-3.5 font-semibold text-slate-700 text-sm">#' + id + '</td>'
                + '<td class="px-5 py-3.5 text-sm font-medium">' + (emp["NOMBRE DEL TRABAJADOR"] || "—") + alerta + '</td>'
                + '<td class="px-5 py-3.5 text-xs text-slate-500">' + (emp["EMPRESA"] || "—") + '</td>'
                + '<td class="px-5 py-3.5 text-xs text-slate-500">' + (emp["PUESTO"]  || "—") + '</td>'
                + '<td class="px-5 py-3.5"><span class="px-2.5 py-1 text-xs font-semibold rounded-full ' + color + '">' + (est || "—") + '</span></td>'
                + '<td class="px-5 py-3.5"><div class="flex items-center justify-center gap-3">'
                + '<button onclick="abrirEditor(\'' + id + '\')" class="text-slate-400 hover:text-blue-600 transition" title="Editar"><i class="fas fa-pen-to-square text-sm"></i></button>'
                + '<button onclick="abrirModalDocs(\'' + id + '\',\'' + nom + '\')" class="text-slate-400 hover:text-emerald-600 transition" title="Subir documentos"><i class="fas fa-file-arrow-up text-sm"></i></button>'
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
let modalDocsId  = null;
let modalDocsNom = null;

function abrirModalDocs(id, nombre) {
    modalDocsId  = id;
    modalDocsNom = nombre;
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
    modalDocsId = null; modalDocsNom = null;
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
                numeroEmpleado: modalDocsId,
                nombreArchivo:  file.name,
                mimeType:       file.type || 'application/octet-stream',
                data:           b64
            });
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
const CD={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:"'Inter',sans-serif",size:11},padding:10,boxWidth:12,boxHeight:12}}}};
function dc(r){if(r)try{r.destroy();}catch(e){}return null;}
function fmtMXN(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0);}
function calcEdad(val){const d=parseFechaFlexible(val);if(!d)return null;const h=new Date();let a=h.getFullYear()-d.getFullYear();if(h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate()))a--;return a>=15&&a<=85?a:null;}
function calcAnt(val){const d=parseFechaFlexible(val);if(!d)return null;const ms=new Date()-d;return ms<0?null:ms/(1000*60*60*24*365.25);}

async function cargarDashboard(){
    const todos=await obtenerDatos(),filtro=document.getElementById('filtroEmpresaGlobal').value;
    const D=filtro==="ALL"?todos:todos.filter(r=>(r["EMPRESA"]||"").trim()===filtro);
    let activos=0,bajas=0,cEmp={},cGen={"Hombre":0,"Mujer":0},cRango={"<31":0,"31-50":0,"51-65":0,">65":0};
    let cMotivo={},cDepto={},cTend={},finPorMes={},finPorAnio={},totalFin=0,edades=[],ants=[];

    // Construir snapshot de activos por mes: para cada mes ordenado,
    // contar cuántos empleados estaban activos en ese mes.
    // Estrategia: acumulativo → sumar altas, restar bajas mes a mes.
    D.forEach(row=>{
        const est=(row["ESTATUS"]||"").trim(),gen=(row["GÉNERO"]||"").trim(),emp=(row["EMPRESA"]||"Sin Empresa").trim();
        const rango=(row["RANGO DE EDAD"]||"").trim(),motivo=(row["MOTIVO DE SALIDA"]||"").trim(),depto=(row["DEPARTAMENTO"]||"Sin Departamento").trim();
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
        if(est==="Baja"){
            bajas++;
            if(motivo)cMotivo[motivo]=(cMotivo[motivo]||0)+1;
            if(fin>0){
                totalFin+=fin;
                // Finiquitos por MES (para gráfica mensual)
                const fBD=parseFechaFlexible(fBaja);
                if(fBD){
                    const km=fBD.getFullYear()+'-'+String(fBD.getMonth()+1).padStart(2,'0');
                    finPorMes[km]=(finPorMes[km]||0)+fin;
                    // Finiquitos por AÑO (para KPI tabla resumen)
                    const ka=fBD.getFullYear().toString();
                    finPorAnio[ka]=(finPorAnio[ka]||0)+fin;
                }
            }
        }
        if(!cEmp[emp])cEmp[emp]={act:0,baj:0};
        if(est==="Activo")cEmp[emp].act++;
        if(est==="Baja")cEmp[emp].baj++;

        // Tendencia mensual de altas y bajas
        const fIngD=parseFechaFlexible(fIng);
        if(fIngD){const k=fIngD.getFullYear()+'-'+String(fIngD.getMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0,activos:0};cTend[k].altas++;}
        const fBD2=parseFechaFlexible(fBaja);
        if(fBD2){const k=fBD2.getFullYear()+'-'+String(fBD2.getMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0,activos:0};cTend[k].bajas++;}
    });

    // Calcular activos acumulados por mes (snapshot mensual)
    const mesesOrdenados=Object.keys(cTend).sort();
    let acumActivos=0;
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
    charts.emp=new Chart(document.getElementById('chartEmpresas').getContext('2d'),{type:'bar',data:{labels:empL,datasets:[{label:'Activos',data:Object.values(cEmp).map(v=>v.act),backgroundColor:'#3b82f6',borderRadius:4},{label:'Bajas',data:Object.values(cEmp).map(v=>v.baj),backgroundColor:'#ef4444',borderRadius:4}]},options:{...CD,scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'}}}}});

    // ── Gráfica: Rango de edad ─────────────────────────────────
    charts.rango=dc(charts.rango);
    charts.rango=new Chart(document.getElementById('chartRangoEdad').getContext('2d'),{type:'bar',data:{labels:['< 31 años','31–50 años','51–65 años','> 65 años'],datasets:[{label:'Colaboradores',data:Object.values(cRango),backgroundColor:['#2563eb','#3b82f6','#60a5fa','#93c5fd'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false}}}}});

    // ── Gráfica: Motivos de baja ───────────────────────────────
    const mot=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.mot=dc(charts.mot);
    if(mot.length){
        charts.mot=new Chart(document.getElementById('chartMotivoBaja').getContext('2d'),{type:'bar',data:{labels:mot.map(([k])=>k.length>22?k.substring(0,22)+'…':k),datasets:[{label:'Bajas',data:mot.map(([,v])=>v),backgroundColor:['#dc2626','#ef4444','#f87171','#fca5a5','#dc2626','#ef4444','#f87171','#fca5a5'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
    } else {
        const c=document.getElementById('chartMotivoBaja');if(c)c.parentElement.innerHTML='<p class="text-xs text-slate-400 text-center pt-12">Sin bajas registradas aún</p>';
    }

    // ── Gráfica: Top departamentos ─────────────────────────────
    const dep=Object.entries(cDepto).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.dep=dc(charts.dep);
    charts.dep=new Chart(document.getElementById('chartDeptos').getContext('2d'),{type:'bar',data:{labels:dep.map(([k])=>k.length>20?k.substring(0,20)+'…':k),datasets:[{label:'Activos',data:dep.map(([,v])=>v),backgroundColor:'#7c3aed',borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});

    // ── Gráfica: Tendencia mensual — Altas, Bajas y Activos ───
    // Muestra los últimos 24 meses con 3 líneas
    const mesesTend=mesesOrdenados.slice(-24);
    charts.tend=dc(charts.tend);
    charts.tend=new Chart(document.getElementById('chartTendencia').getContext('2d'),{
        type:'line',
        data:{
            labels:mesesTend.map(fmtM),
            datasets:[
                {label:'Activos',   data:mesesTend.map(k=>cTend[k].activos), borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.06)',tension:0.4,fill:true,pointRadius:2,pointBackgroundColor:'#10b981',borderWidth:2},
                {label:'Altas',     data:mesesTend.map(k=>cTend[k].altas),   borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.06)',tension:0.4,fill:false,pointRadius:2,pointBackgroundColor:'#3b82f6',borderWidth:1.5},
                {label:'Bajas',     data:mesesTend.map(k=>cTend[k].bajas),   borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.06)',tension:0.4,fill:false,pointRadius:2,pointBackgroundColor:'#ef4444',borderWidth:1.5},
            ]
        },
        options:{...CD,scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:'#f1f5f9'}}}}
    });

    // ── Gráfica: Finiquitos pagados por MES ────────────────────
    // BUG FIX: era por año, ahora por mes. BUG FIX: "schools" → "scales"
    const mesesFin=Object.keys(finPorMes).sort().slice(-24);
    const finC=document.getElementById('chartFiniquitos');
    charts.fin=dc(charts.fin);
    if(mesesFin.length){
        charts.fin=new Chart(finC.getContext('2d'),{
            type:'bar',
            data:{
                labels:mesesFin.map(fmtM),
                datasets:[{
                    label:'Finiquitos',
                    data:mesesFin.map(m=>finPorMes[m]),
                    backgroundColor:'#f59e0b',
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
                    y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{callback:v=>fmtMXN(v),font:{size:10}}}
                }
            }
        });
    } else if(finC){
        finC.parentElement.innerHTML='<p class="text-xs text-slate-400 text-center pt-12">Sin finiquitos registrados aún</p>';
    }

    // ── Tabla causas de baja con % ─────────────────────────────
    const top=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const tb=document.getElementById('tabla-causas-baja');
    if(tb){
        if(top.length){
            tb.innerHTML=top.map(([m,n])=>{
                const pct=bajas>0?((n/bajas)*100).toFixed(1):"0";
                return`<tr class="border-b border-slate-100 last:border-0"><td class="py-2.5 pr-4 text-sm text-slate-700">${m}</td><td class="py-2.5 text-center text-sm font-bold text-slate-800">${n}</td><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><div class="flex-1 bg-slate-100 rounded-full h-1.5"><div class="bg-red-400 h-1.5 rounded-full" style="width:${pct}%"></div></div><span class="text-xs text-slate-500 w-10 text-right">${pct}%</span></div></td></tr>`;
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
    XLSX.writeFile(wb,'GM_Respaldo_'+new Date().toISOString().slice(0,10)+'.xlsx');
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
    pasoActual=0;altaData={};
    actualizarBadgeNotifs();
    renderizarStepper();
    const datos=await cargarDashboard();
    actualizarListaEmpresas();
    poblarCatalogos();
    if(cacheGlobal.length)evaluarAlertas(cacheGlobal);
    initAutocomplete();
    // Cerrar panel de notificaciones al hacer click fuera
    document.addEventListener('click',e=>{
        const panel=document.getElementById('notif-panel');
        const btn=document.getElementById('btn-notif');
        if(panel&&!panel.contains(e.target)&&btn&&!btn.contains(e.target))panel.classList.add('hidden');
    });
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

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initApp);
else initApp();
