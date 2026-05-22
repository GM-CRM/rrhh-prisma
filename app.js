// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Frontend v4.0
//  Novedades:
//    - Buscador de empleado en Offboarding (autocomplete por nombre)
//    - OCR de documentos con Anthropic Vision API
//    - Cálculo automático de rango de edad
//    - AW protegida en import (fórmula + validación)
// ============================================================
const API_URL     = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";
const CLAUDE_URL  = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL= "claude-sonnet-4-20250514";

// ─── UI ──────────────────────────────────────────────────────
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}
function activarNav(btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
}
function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(s => { s.classList.remove('active'); s.style.display='none'; });
    const t = document.getElementById('module-'+moduleId);
    if (!t) return;
    t.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('active')));
    const tit = { dashboard:'Dashboard Directivo', alta:'Onboarding — Alta de Colaborador', baja:'Offboarding', basedatos:'Directorio Maestro' };
    document.getElementById('header-title').innerText = tit[moduleId] || moduleId;
    if (window.innerWidth < 768) toggleMenu();
}
function mostrarLoader(t) { document.getElementById('loader-text').innerText = t||'Procesando...'; document.getElementById('global-loader').style.display='flex'; }
function ocultarLoader()  { document.getElementById('global-loader').style.display='none'; }

// ─── CATÁLOGOS ───────────────────────────────────────────────
const empresas = ["Newspot Mexico","Centro De Telecomunicaciones Y Publicidad De Mexico","Global Media","Editora Mexicana","Cable Master","Fember Press","Infomonitor","Rtv Comunicacion","Radio Expresion Cultural"];

// ─── STEPPER ONBOARDING ──────────────────────────────────────
const PASOS = [
    {
        id:'paso-empleo', titulo:'Datos Laborales', icono:'fa-briefcase', color:'blue',
        descripcion:'Información del puesto y contratación',
        campos:[
            { id:"numeroEmpleado",     label:"No. de Empleado",       type:"number", req:true,  col:2 },
            { id:"fechaIngreso",       label:"Fecha de Ingreso",       type:"date",   req:true,  col:2 },
            { id:"nombreTrabajador",   label:"Nombre Completo",        type:"text",   req:true,  col:2, placeholder:"Apellido Paterno Materno Nombre(s)" },
            { id:"empresa",            label:"Empresa",                type:"select", req:true,  col:2, options:empresas },
            { id:"departamento",       label:"Departamento",           type:"text",   req:true,  col:2 },
            { id:"puesto",             label:"Puesto",                 type:"text",   req:true,  col:2 },
            { id:"tipoIngreso",        label:"Tipo de Ingreso",        type:"select", req:true,  col:2, options:["Administrativo","Operativo"] },
            { id:"sueldoMensual",      label:"Sueldo Mensual (MXN)",   type:"number", req:true,  col:2, placeholder:"0.00" },
            { id:"frecuenciaPago",     label:"Frecuencia de Pago",     type:"select", req:true,  col:2, options:["Quincenal","Semanal","Mensual"] },
            { id:"fuenteContratacion", label:"Fuente de Contratación", type:"text",   req:false, col:2, placeholder:"Ej. Referido, OCC, LinkedIn..." },
        ]
    },
    {
        id:'paso-contrato', titulo:'Contrato', icono:'fa-file-contract', color:'indigo',
        descripcion:'Tipo, vigencias y seguimiento de contratos',
        campos:[
            { id:"tipoContrato",              label:"Tipo de Contrato",          type:"select", req:true,  col:2, options:["Tiempo Indeterminado","Prueba","Temporal"] },
            { id:"fechaInicioContrato",       label:"Inicio 1er Contrato",       type:"date",   req:false, col:2 },
            { id:"vencimientoPrimerContrato", label:"Vencimiento 1er Contrato",  type:"date",   req:false, col:2 },
            { id:"entrevista15Dias",          label:"Entrevista Ajuste 15 Días", type:"select", req:false, col:2, options:["Pendiente","Sí","No"] },
            { id:"entrevista45Dias",          label:"Entrevista y Eval. 45 Días",type:"select", req:false, col:2, options:["Pendiente","Sí","No"] },
            { id:"iniciSegundoContrato",      label:"Inicio 2do Contrato",       type:"date",   req:false, col:2 },
            { id:"vencSegundoContrato",       label:"Vencimiento 2do Contrato",  type:"date",   req:false, col:2 },
            { id:"iniciTercerContrato",       label:"Inicio 3er Contrato",       type:"date",   req:false, col:2 },
            { id:"vencTercerContrato",        label:"Vencimiento 3er Contrato",  type:"date",   req:false, col:2 },
            { id:"fechaEval360",              label:"Fecha Evaluación 360°",     type:"date",   req:false, col:2 },
        ]
    },
    {
        id:'paso-personal', titulo:'Datos Personales', icono:'fa-id-card', color:'teal',
        descripcion:'Información personal y documentos legales',
        campos:[
            { id:"curp",            label:"CURP",                type:"text",     req:true,  col:2, placeholder:"18 caracteres", maxlen:18 },
            { id:"rfc",             label:"RFC",                 type:"text",     req:true,  col:2, placeholder:"13 caracteres", maxlen:13 },
            { id:"nss",             label:"NSS",                 type:"text",     req:true,  col:2, placeholder:"11 dígitos",    maxlen:11 },
            { id:"fechaNacimiento", label:"Fecha de Nacimiento", type:"date",     req:false, col:2 },
            { id:"rangoEdad",       label:"Rango de Edad",       type:"select",   req:false, col:2, options:["<31","31-50","51-65",">65"], readonly:true },
            { id:"genero",          label:"Género",              type:"select",   req:false, col:2, options:["Hombre","Mujer"] },
            { id:"estadoCivil",     label:"Estado Civil",        type:"select",   req:false, col:2, options:["Soltero","Casado","Divorciado","Viudo","Unión Libre"] },
            { id:"escolaridad",     label:"Escolaridad",         type:"text",     req:false, col:2 },
            { id:"lugarNacimiento", label:"Lugar de Nacimiento", type:"text",     req:false, col:2 },
            { id:"nacionalidad",    label:"Nacionalidad",        type:"text",     req:false, col:2, placeholder:"Ej. Mexicana" },
            { id:"domicilioCompleto",label:"Domicilio Completo", type:"textarea", req:false, col:1, placeholder:"Calle, Número, Colonia, CP, Ciudad, Estado" },
        ]
    },
    {
        id:'paso-contacto', titulo:'Contacto', icono:'fa-phone', color:'cyan',
        descripcion:'Datos de contacto y emergencias',
        campos:[
            { id:"correoElectronico",  label:"Correo Electrónico",            type:"email", req:false, col:2 },
            { id:"telefonoPersonal",   label:"Teléfono Personal",             type:"text",  req:false, col:2, placeholder:"10 dígitos" },
            { id:"contactoEmergencia", label:"Nombre — Contacto Emergencia",  type:"text",  req:false, col:2 },
            { id:"parentesco",         label:"Parentesco",                    type:"text",  req:false, col:2 },
            { id:"telefonoEmergencia", label:"Teléfono Emergencia",           type:"text",  req:false, col:2 },
        ]
    },
    {
        id:'paso-beneficiario', titulo:'Beneficiario', icono:'fa-heart', color:'rose',
        descripcion:'Datos del beneficiario IMSS',
        campos:[
            { id:"nombreBeneficiario",     label:"Nombre del Beneficiario", type:"text",   req:false, col:2 },
            { id:"rfcBeneficiario",        label:"RFC del Beneficiario",     type:"text",   req:false, col:2 },
            { id:"parentescoBeneficiario", label:"Parentesco",               type:"text",   req:false, col:2 },
            { id:"porcentajeAsignacion",   label:"% de Asignación",          type:"number", req:false, col:2, placeholder:"100" },
        ]
    },
    {
        id:'paso-documentos', titulo:'Documentos', icono:'fa-folder-open', color:'amber',
        descripcion:'Expediente digital — resumen y adjuntos',
        campos:[]
    }
];

let pasoActual = 0;
let altaData   = {};

// ─── STEPPER RENDER ───────────────────────────────────────────
function renderizarStepper() {
    const barra = document.getElementById('stepper-barra');
    barra.innerHTML = PASOS.map((p, i) => {
        const hecho   = i < pasoActual;
        const activo  = i === pasoActual;
        const dot     = hecho  ? 'bg-emerald-500 text-white ring-emerald-500'
                      : activo ? 'bg-blue-600 text-white ring-blue-500 ring-2 ring-offset-2'
                      :          'bg-slate-100 text-slate-400';
        const icono   = hecho  ? 'fa-check' : p.icono;
        const txtCol  = hecho  ? 'text-emerald-600' : activo ? 'text-blue-600' : 'text-slate-400';
        const linea   = i < PASOS.length - 1
            ? `<div class="flex-1 h-0.5 mx-2 rounded ${hecho?'bg-emerald-400':'bg-slate-200'}"></div>` : '';
        return `<div class="flex items-center flex-1 min-w-0">
          <button onclick="irAPaso(${i})" class="flex flex-col items-center gap-1 flex-shrink-0" title="${p.titulo}">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${dot}">
              <i class="fas ${icono} text-xs"></i>
            </div>
            <span class="text-xs font-medium hidden md:block whitespace-nowrap ${txtCol}">${p.titulo}</span>
          </button>${linea}</div>`;
    }).join('');

    renderizarPasoActual();
    actualizarBotones();
    const ind = document.getElementById('paso-indicador');
    if (ind) ind.innerText = `Paso ${pasoActual+1} de ${PASOS.length}`;
}

function renderizarPasoActual() {
    const paso = PASOS[pasoActual];
    const el   = document.getElementById('stepper-contenido');

    if (paso.id === 'paso-documentos') {
        el.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- OCR / Adjuntos -->
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <i class="fas fa-wand-magic-sparkles text-amber-600"></i>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-800">Lectura Inteligente de Documentos</p>
                <p class="text-xs text-slate-500">Sube un documento escaneado y Claude detectará los datos automáticamente</p>
              </div>
            </div>
            <input type="file" id="alta_archivos" multiple accept=".pdf,.jpg,.jpeg,.png"
              class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer transition mb-3">
            <div id="lista-archivos" class="space-y-1.5 mb-4"></div>
            <button onclick="ejecutarOCR()" id="btn-ocr"
              class="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition">
              <i class="fas fa-magnifying-glass"></i> Analizar documentos con IA
            </button>
            <div id="ocr-status" class="mt-3 hidden">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                <span id="ocr-status-txt">Analizando documentos...</span>
              </div>
            </div>
            <div id="ocr-resultado" class="mt-3 hidden">
              <p class="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                <i class="fas fa-check-circle"></i> Datos detectados y aplicados al formulario
              </p>
              <div id="ocr-campos-detectados" class="space-y-1"></div>
            </div>
          </div>
          <!-- Resumen -->
          <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <i class="fas fa-clipboard-list text-slate-400"></i> Resumen del Alta
            </p>
            <div id="resumen-alta" class="space-y-1.5 text-sm"></div>
          </div>
        </div>`;
        renderizarResumen();
        document.getElementById('alta_archivos')?.addEventListener('change', actualizarListaArchivos);
        return;
    }

    const colores = { blue:'bg-blue-50 text-blue-600', indigo:'bg-indigo-50 text-indigo-600', teal:'bg-teal-50 text-teal-600', cyan:'bg-cyan-50 text-cyan-600', rose:'bg-rose-50 text-rose-600' };
    const col = colores[paso.color] || 'bg-blue-50 text-blue-600';
    el.innerHTML = `
      <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div class="w-12 h-12 rounded-xl ${col} flex items-center justify-center flex-shrink-0">
          <i class="fas ${paso.icono} text-xl"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-800">${paso.titulo}</h3>
          <p class="text-sm text-slate-400 mt-0.5">${paso.descripcion}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${paso.campos.map(c => renderizarCampo(c)).join('')}
      </div>`;

    // Listener especial: fecha de nacimiento → rango de edad automático
    const fnEl = document.getElementById('alta_fechaNacimiento');
    if (fnEl) { fnEl.addEventListener('change', calcularRangoEdadAuto); fnEl.addEventListener('blur', calcularRangoEdadAuto); }
}

function renderizarCampo(c) {
    const cls  = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-300";
    const span = c.col === 1 ? 'md:col-span-2' : '';
    const ph   = c.placeholder ? `placeholder="${c.placeholder}"` : '';
    const ml   = c.maxlen ? `maxlength="${c.maxlen}"` : '';
    const req  = c.req ? '<span class="text-red-400">*</span>' : '';
    let inp;
    if (c.type === 'select') {
        const ro = c.readonly ? 'title="Calculado automáticamente desde fecha de nacimiento"' : '';
        inp = `<select id="alta_${c.id}" ${c.req?'required':''} ${ro} class="${cls} ${c.readonly?'bg-slate-50 cursor-default':'cursor-pointer'}">
                 <option value="">Seleccione...</option>
                 ${(c.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}
               </select>`;
    } else if (c.type === 'textarea') {
        inp = `<textarea id="alta_${c.id}" rows="2" ${ph} class="${cls} resize-none"></textarea>`;
    } else {
        inp = `<input type="${c.type}" id="alta_${c.id}" ${c.req?'required':''} ${ml} ${ph} class="${cls}">`;
    }
    const nota = c.readonly ? '<span class="text-xs text-slate-400 ml-1 font-normal">⟵ automático</span>' : '';
    return `<div class="${span}">
      <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">${c.label} ${req}${nota}</label>
      ${inp}
    </div>`;
}

function calcularRangoEdadAuto() {
    const fn = document.getElementById('alta_fechaNacimiento');
    const rn = document.getElementById('alta_rangoEdad');
    if (!fn || !rn || !fn.value) return;
    const hoy = new Date(), nac = new Date(fn.value);
    if (isNaN(nac)) return;
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth()===nac.getMonth() && hoy.getDate()<nac.getDate())) edad--;
    altaData.rangoEdad = edad < 31 ? '<31' : edad <= 50 ? '31-50' : edad <= 65 ? '51-65' : '>65';
    rn.value = altaData.rangoEdad;
}

function guardarPasoActual() {
    const paso = PASOS[pasoActual];
    if (paso.id === 'paso-documentos') return true;
    let valido = true;
    paso.campos.forEach(c => {
        const el = document.getElementById('alta_' + c.id);
        if (!el) return;
        const val = el.value.trim();
        altaData[c.id] = val;
        if (c.req && !val) { el.classList.add('border-red-400','ring-1','ring-red-300'); valido = false; }
        else { el.classList.remove('border-red-400','ring-1','ring-red-300'); }
    });
    if (!valido) Swal.fire({ icon:'warning', title:'Campos requeridos', text:'Completa los campos marcados con * para continuar.', timer:2500, showConfirmButton:false });
    return valido;
}

function restaurarValoresPaso() {
    const paso = PASOS[pasoActual];
    paso.campos.forEach(c => {
        const el = document.getElementById('alta_' + c.id);
        if (!el || altaData[c.id] === undefined) return;
        el.value = altaData[c.id];
    });
    // Recalcular rango si hay fecha
    if (pasoActual === 2) calcularRangoEdadAuto();
}

function irAPaso(idx) {
    if (idx > pasoActual) { if (!guardarPasoActual()) return; } else guardarPasoActual();
    pasoActual = idx; renderizarStepper(); restaurarValoresPaso();
    document.getElementById('stepper-contenido').scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function siguientePaso() { if (!guardarPasoActual()) return; if (pasoActual<PASOS.length-1){pasoActual++;renderizarStepper();restaurarValoresPaso();} }
function anteriorPaso()  { guardarPasoActual(); if(pasoActual>0){pasoActual--;renderizarStepper();restaurarValoresPaso();} }

function actualizarBotones() {
    const ultimo = pasoActual === PASOS.length - 1;
    document.getElementById('btn-anterior')?.classList.toggle('hidden', pasoActual===0);
    document.getElementById('btn-siguiente')?.classList.toggle('hidden', ultimo);
    document.getElementById('btn-enviar')?.classList.toggle('hidden', !ultimo);
}

function actualizarListaArchivos() {
    const input = document.getElementById('alta_archivos');
    const lista = document.getElementById('lista-archivos');
    if (!lista||!input) return;
    lista.innerHTML = Array.from(input.files).map(f=>{
        const mb=(f.size/1024/1024).toFixed(1), ok=f.size<=10*1024*1024;
        return `<div class="flex items-center gap-2 text-xs ${ok?'text-slate-600':'text-red-500'}">
          <i class="fas ${ok?'fa-file-check text-emerald-500':'fa-exclamation-triangle text-red-400'}"></i>
          <span class="flex-1 truncate">${f.name}</span>
          <span class="${ok?'text-slate-400':'text-red-400'} font-medium">${mb} MB</span>
        </div>`;
    }).join('');
}

function renderizarResumen() {
    const el = document.getElementById('resumen-alta');
    if (!el) return;
    const filas = [
        ['No. Empleado', altaData.numeroEmpleado],
        ['Nombre',       altaData.nombreTrabajador],
        ['Empresa',      altaData.empresa],
        ['Puesto',       altaData.puesto],
        ['Departamento', altaData.departamento],
        ['Tipo Contrato',altaData.tipoContrato],
        ['Sueldo',       altaData.sueldoMensual ? '$'+Number(altaData.sueldoMensual).toLocaleString('es-MX') : ''],
        ['CURP',         altaData.curp],
        ['RFC',          altaData.rfc],
        ['NSS',          altaData.nss],
        ['Género',       altaData.genero],
        ['Rango Edad',   altaData.rangoEdad],
        ['Nacionalidad', altaData.nacionalidad],
    ].filter(([,v])=>v);
    el.innerHTML = filas.map(([k,v])=>
        `<div class="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
           <span class="text-xs text-slate-400 font-semibold uppercase">${k}</span>
           <span class="text-sm font-semibold text-right text-slate-700">${v}</span>
         </div>`
    ).join('');
}

// ─── OCR CON CLAUDE VISION ────────────────────────────────────
const OCR_PROMPT = `Eres un asistente de RH. Analiza este documento (probable credencial, acta, CURP, constancia de IMSS o documento de identidad mexicano). Extrae SOLO los datos que puedas leer con certeza.

Responde ÚNICAMENTE con un objeto JSON válido con estas claves (omite las que no encuentres):
{
  "nombreTrabajador": "",
  "curp": "",
  "rfc": "",
  "nss": "",
  "fechaNacimiento": "YYYY-MM-DD",
  "genero": "Hombre o Mujer",
  "nacionalidad": "",
  "lugarNacimiento": "",
  "domicilioCompleto": "",
  "correoElectronico": "",
  "telefonoPersonal": ""
}
No incluyas texto fuera del JSON. Si un campo no es legible o no existe en el documento, omite esa clave.`;

async function ejecutarOCR() {
    const input = document.getElementById('alta_archivos');
    if (!input || input.files.length === 0) {
        Swal.fire('Sin archivos','Primero adjunta al menos un documento para analizar.','info');
        return;
    }

    const statusEl = document.getElementById('ocr-status');
    const statusTxt= document.getElementById('ocr-status-txt');
    const resultEl = document.getElementById('ocr-resultado');
    const camposEl = document.getElementById('ocr-campos-detectados');
    const btnOCR   = document.getElementById('btn-ocr');

    statusEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    btnOCR.disabled = true;
    btnOCR.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';

    let datosAgregados = {};

    for (const file of Array.from(input.files)) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') continue;
        statusTxt.innerText = `Analizando: ${file.name}...`;

        try {
            // Convertir a base64
            const b64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload  = () => res(r.result.split(',')[1]);
                r.onerror = () => rej(new Error('Error leyendo '+file.name));
                r.readAsDataURL(file);
            });

            // Si es PDF, usar solo texto; si es imagen, usar vision
            let msgContent;
            if (file.type.startsWith('image/')) {
                msgContent = [
                    { type:'image', source:{ type:'base64', media_type:file.type, data:b64 } },
                    { type:'text',  text:OCR_PROMPT }
                ];
            } else {
                // PDF: enviar como documento
                msgContent = [
                    { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
                    { type:'text', text:OCR_PROMPT }
                ];
            }

            const resp = await fetch(CLAUDE_URL, {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                body: JSON.stringify({
                    model:      CLAUDE_MODEL,
                    max_tokens: 1000,
                    messages:   [{ role:'user', content:msgContent }]
                })
            });

            const json = await resp.json();
            const texto = (json.content||[]).find(b=>b.type==='text')?.text || '';

            // Parsear el JSON que Claude devuelve
            let datos = {};
            try {
                const clean = texto.replace(/```json|```/g,'').trim();
                datos = JSON.parse(clean);
            } catch(pe) {
                console.warn('OCR parse error:', pe, texto);
                continue;
            }

            Object.assign(datosAgregados, datos);

        } catch(e) {
            console.warn('OCR error en', file.name, e);
        }
    }

    // Aplicar datos al altaData y a los campos del formulario actual
    const camposDetectados = [];
    const mapaLabels = {
        nombreTrabajador:'Nombre', curp:'CURP', rfc:'RFC', nss:'NSS',
        fechaNacimiento:'Fecha Nac.', genero:'Género', nacionalidad:'Nacionalidad',
        lugarNacimiento:'Lugar Nac.', domicilioCompleto:'Domicilio',
        correoElectronico:'Correo', telefonoPersonal:'Teléfono'
    };

    Object.entries(datosAgregados).forEach(([campo, valor]) => {
        if (!valor) return;
        altaData[campo] = valor.toString().trim();
        // Intentar rellenar el input si está en el DOM actualmente
        const el = document.getElementById('alta_' + campo);
        if (el) el.value = altaData[campo];
        camposDetectados.push(`<div class="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <i class="fas fa-check text-emerald-500 text-xs flex-shrink-0"></i>
            <span class="font-semibold">${mapaLabels[campo]||campo}:</span>
            <span class="truncate">${valor}</span>
        </div>`);
    });

    // Calcular rango de edad si detectó fecha de nacimiento
    if (datosAgregados.fechaNacimiento) {
        const fn = document.getElementById('alta_fechaNacimiento');
        if (fn) { fn.value = datosAgregados.fechaNacimiento; calcularRangoEdadAuto(); }
        else {
            // calcular directamente
            const nac = new Date(datosAgregados.fechaNacimiento), hoy = new Date();
            let ed = hoy.getFullYear() - nac.getFullYear();
            if (hoy.getMonth()<nac.getMonth()||(hoy.getMonth()===nac.getMonth()&&hoy.getDate()<nac.getDate())) ed--;
            altaData.rangoEdad = ed<31?'<31':ed<=50?'31-50':ed<=65?'51-65':'>65';
        }
    }

    statusEl.classList.add('hidden');
    btnOCR.disabled = false;
    btnOCR.innerHTML = '<i class="fas fa-magnifying-glass"></i> Analizar documentos con IA';

    if (camposDetectados.length > 0) {
        resultEl.classList.remove('hidden');
        camposEl.innerHTML = camposDetectados.join('');
        renderizarResumen(); // actualizar resumen con nuevos datos
        Swal.fire({
            icon:'success', title:'¡Datos detectados!',
            text:`Se encontraron ${camposDetectados.length} campo(s). Revísalos y corrige si es necesario antes de enviar.`,
            timer:3500, showConfirmButton:false
        });
    } else {
        Swal.fire({ icon:'warning', title:'Sin datos detectados', text:'No se pudo extraer información del documento. Verifica que sea legible e intenta con una imagen de mayor resolución.', confirmButtonText:'Entendido' });
    }
}

// ─── ENVIAR ALTA ──────────────────────────────────────────────
async function enviarAlta() {
    guardarPasoActual();
    const camposReq = PASOS.flatMap(p => p.campos.filter(c=>c.req).map(c=>c.id));
    const faltantes = camposReq.filter(id => !altaData[id]);
    if (faltantes.length) {
        Swal.fire({ icon:'error', title:'Faltan datos requeridos', html:`Campos obligatorios sin completar:<br><br><strong>${faltantes.map(f=>f).join(', ')}</strong>` });
        return;
    }
    mostrarLoader("Creando expediente y subiendo documentos...");
    const fileInput = document.getElementById('alta_archivos');
    let docs = [];
    if (fileInput?.files.length > 0) {
        for (const file of fileInput.files) {
            if (file.size > 10*1024*1024) { ocultarLoader(); Swal.fire('Archivo grande',`"${file.name}" supera 10 MB.`,'warning'); return; }
            const b64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=()=>rej(); r.readAsDataURL(file); });
            docs.push({ nombreArchivo:file.name, mimeType:file.type||'application/octet-stream', data:b64 });
        }
    }
    try {
        const r = await enviarPeticion("alta", { ...altaData, documentos:docs });
        ocultarLoader();
        if (r.status==="success") {
            Swal.fire({ icon:'success', title:'¡Alta registrada!', text:r.message, confirmButtonText:'Ver expediente', showCancelButton:true, cancelButtonText:'Cerrar' })
                .then(res=>{ if(res.isConfirmed&&r.urlExpediente) window.open(r.urlExpediente,'_blank'); });
            altaData={}; pasoActual=0; renderizarStepper(); forzarActualizacion();
        } else Swal.fire('Error', r.message, 'error');
    } catch(e) { ocultarLoader(); Swal.fire('Error de conexión', e.message, 'error'); }
}

// ─── API GAS ──────────────────────────────────────────────────
async function enviarPeticion(action, payload) {
    const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action, payload }) });
    return await res.json();
}

// ─── OFFBOARDING — AUTOCOMPLETE ──────────────────────────────
function initAutocomplete() {
    const input = document.getElementById('baja_busqueda');
    const lista  = document.getElementById('baja_sugerencias');
    const hidId  = document.getElementById('baja_idEmpleado');
    const hidNom = document.getElementById('baja_nombreEmpleado');
    const badge  = document.getElementById('baja_empleado_badge');
    if (!input || !lista) return;

    let seleccionado = null;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        lista.innerHTML = '';
        hidId.value = ''; hidNom.value = '';
        badge.classList.add('hidden');
        seleccionado = null;

        if (q.length < 2) { lista.classList.add('hidden'); return; }

        const coincidencias = cacheGlobal.filter(emp => {
            const nombre = (emp["NOMBRE DEL TRABAJADOR"]||"").toLowerCase();
            const noEmp  = (emp["NO. EMPLEADO"]||"").toString();
            return nombre.includes(q) || noEmp.includes(q);
        }).slice(0,8);

        if (!coincidencias.length) { lista.classList.add('hidden'); return; }

        lista.classList.remove('hidden');
        lista.innerHTML = coincidencias.map(emp => {
            const est   = (emp["ESTATUS"]||"").trim();
            const color = est==="Activo" ? "text-emerald-600" : "text-red-500";
            return `<button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition"
                onclick="seleccionarEmpleado('${emp["NO. EMPLEADO"]}','${(emp["NOMBRE DEL TRABAJADOR"]||"").replace(/'/g,"\\'")}','${est}','${emp["EMPRESA"]||""}','${emp["PUESTO"]||""}')">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-800">${emp["NOMBRE DEL TRABAJADOR"]||"—"}</p>
                  <p class="text-xs text-slate-400">#${emp["NO. EMPLEADO"]} · ${emp["EMPRESA"]||""} · ${emp["PUESTO"]||""}</p>
                </div>
                <span class="text-xs font-bold ${color} flex-shrink-0">${est}</span>
              </div>
            </button>`;
        }).join('');
    });

    document.addEventListener('click', e => {
        if (!lista.contains(e.target) && e.target !== input) lista.classList.add('hidden');
    });
}

function seleccionarEmpleado(id, nombre, estatus, empresa, puesto) {
    document.getElementById('baja_busqueda').value = nombre;
    document.getElementById('baja_idEmpleado').value  = id;
    document.getElementById('baja_nombreEmpleado').value = nombre;
    document.getElementById('baja_sugerencias').classList.add('hidden');

    const badge = document.getElementById('baja_empleado_badge');
    badge.classList.remove('hidden');
    badge.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <i class="fas fa-user text-slate-500"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-800">${nombre}</p>
            <p class="text-xs text-slate-400">#${id} · ${empresa} · ${puesto}</p>
          </div>
        </div>
        <span class="text-xs font-bold px-2.5 py-1 rounded-full ${estatus==='Activo'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}">${estatus}</span>
      </div>`;
}

async function procesarBaja(event) {
    event.preventDefault();
    const id     = document.getElementById('baja_idEmpleado').value.trim();
    const nombre = document.getElementById('baja_nombreEmpleado').value.trim();
    if (!id && !nombre) { Swal.fire('Selecciona un colaborador','Escribe y selecciona el nombre del colaborador primero.','warning'); return; }
    mostrarLoader("Procesando baja...");
    const payload = {
        numeroEmpleado: id,
        nombreEmpleado: nombre,
        fechaBaja:      document.getElementById('baja_fechaBaja').value,
        tipoSalida:     document.getElementById('baja_tipoSalida').value,
        motivoSalida:   document.getElementById('baja_motivoSalida').value,
        montoFiniquito: document.getElementById('baja_montoFiniquito').value
    };
    try {
        const r = await enviarPeticion("baja", payload);
        ocultarLoader();
        if (r.status==="success") {
            Swal.fire('Baja registrada', r.message, 'success');
            document.getElementById('formBaja').reset();
            document.getElementById('baja_empleado_badge').classList.add('hidden');
            document.getElementById('baja_sugerencias').classList.add('hidden');
            forzarActualizacion();
        } else Swal.fire('No encontrado', r.message, 'warning');
    } catch(e) { ocultarLoader(); Swal.fire('Error', e.message, 'error'); }
}

// ─── CACHÉ ────────────────────────────────────────────────────
let cacheGlobal = [];
async function obtenerDatos(forzar) {
    if (!forzar && cacheGlobal.length) return cacheGlobal;
    mostrarLoader("Sincronizando base de datos...");
    try {
        const r = await enviarPeticion("exportar_datos",{});
        ocultarLoader();
        if (r.status==="success") {
            cacheGlobal = r.data.filter(e=>e["NO. EMPLEADO"]&&e["NO. EMPLEADO"].toString().trim()!=="");
            return cacheGlobal;
        }
        return [];
    } catch(e){ ocultarLoader(); return []; }
}
async function forzarActualizacion() {
    cacheGlobal=[];
    await obtenerDatos(true);
    cargarDashboard();
    if (document.getElementById('module-basedatos')?.classList.contains('active')) renderizarPagina(1);
    initAutocomplete(); // reiniciar listeners con datos frescos
}

// ─── DIRECTORIO ───────────────────────────────────────────────
let paginaActual=1; const FILAS_PAG=50;
async function cargarDatosTabla(){ await obtenerDatos(); paginaActual=1; renderizarPagina(1); }
function renderizarPagina(pag){
    const datos=cacheGlobal, totalPags=Math.max(1,Math.ceil(datos.length/FILAS_PAG));
    paginaActual=Math.max(1,Math.min(pag,totalPags));
    const ini=(paginaActual-1)*FILAS_PAG, slice=datos.slice(ini,ini+FILAS_PAG);
    const tbody=document.getElementById('tabla-directorio'); tbody.innerHTML='';
    slice.forEach(emp=>{
        const est=(emp["ESTATUS"]||"").trim(), color=est==="Activo"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700";
        const url=emp["URL EXPEDIENTE"]||"", link=url?`<a href="${url}" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-folder-open"></i></a>`:'<span class="text-slate-300">—</span>';
        tbody.innerHTML+=`<tr class="hover:bg-slate-50 border-b border-slate-100 transition">
            <td class="px-5 py-3.5 font-semibold text-slate-700 text-sm">#${emp["NO. EMPLEADO"]||"—"}</td>
            <td class="px-5 py-3.5 text-sm">${emp["NOMBRE DEL TRABAJADOR"]||"—"}</td>
            <td class="px-5 py-3.5 text-xs text-slate-500">${emp["EMPRESA"]||"—"}</td>
            <td class="px-5 py-3.5 text-xs text-slate-500">${emp["PUESTO"]||"—"}</td>
            <td class="px-5 py-3.5"><span class="px-2.5 py-1 text-xs font-semibold rounded-full ${color}">${est||"—"}</span></td>
            <td class="px-5 py-3.5 text-center">${link}</td></tr>`;
    });
    const pg=document.getElementById('paginacion-directorio'); if(!pg)return;
    const ini2=ini+1,fin2=Math.min(ini+FILAS_PAG,datos.length);
    pg.innerHTML=`<div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <span class="text-sm text-slate-500">Mostrando <strong>${ini2}–${fin2}</strong> de <strong>${datos.length}</strong></span>
        <div class="flex gap-2">
          <button onclick="renderizarPagina(${paginaActual-1})" ${paginaActual<=1?'disabled':''} class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">← Anterior</button>
          <span class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg">${paginaActual} / ${totalPags}</span>
          <button onclick="renderizarPagina(${paginaActual+1})" ${paginaActual>=totalPags?'disabled':''} class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">Siguiente →</button>
        </div></div>`;
    const sub=document.getElementById('subtitulo-directorio');
    if(sub) sub.innerText=datos.length+' colaboradores en la base maestra';
}

// ─── DASHBOARD ────────────────────────────────────────────────
let charts={};
const CD={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:"'Inter',sans-serif",size:11},padding:10,boxWidth:12,boxHeight:12}}}};
function dc(r){if(r)try{r.destroy()}catch(e){}return null;}
function fmtMXN(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0);}
function calcEdad(fn){if(!fn)return null;const d=new Date(fn);if(isNaN(d))return null;const h=new Date();let a=h.getFullYear()-d.getFullYear();if(h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate()))a--;return a>=15&&a<=80?a:null;}
function calcAnt(fi){if(!fi)return null;const d=new Date(fi);if(isNaN(d))return null;const ms=new Date()-d;return ms<0?null:ms/(1000*60*60*24*365.25);}

async function cargarDashboard(){
    const todos=await obtenerDatos(), filtro=document.getElementById('filtroEmpresaGlobal').value;
    const D=filtro==="ALL"?todos:todos.filter(r=>(r["EMPRESA"]||"").trim()===filtro);
    let activos=0,bajas=0,cEmp={},cGen={"Hombre":0,"Mujer":0},cRango={"<31":0,"31-50":0,"51-65":0,">65":0};
    let cMotivo={},cDepto={},cTend={},finPorAnio={},totalFin=0,edades=[],ants=[];
    D.forEach(row=>{
        const est=(row["ESTATUS"]||"").trim(),gen=(row["GÉNERO"]||"").trim(),emp=(row["EMPRESA"]||"Sin Empresa").trim();
        const rango=(row["RANGO DE EDAD"]||"").trim(),motivo=(row["MOTIVO DE SALIDA"]||"").trim();
        const depto=(row["DEPARTAMENTO"]||"Sin Departamento").trim();
        const fIng=row["FECHA DE INGRESO"]||"",fBaja=row["FECHA DE BAJA"]||"",fNac=row["FECHA DE NACIMIENTO"]||"";
        const fin=parseFloat((row["MONTO DE FINIQUITO"]||"0").toString().replace(/[,$\s]/g,""))||0;
        if(est==="Activo"){activos++;if(gen==="Hombre"||gen==="Masculino")cGen["Hombre"]++;else if(gen==="Mujer"||gen==="Femenino")cGen["Mujer"]++;if(cRango[rango]!==undefined)cRango[rango]++;const ed=calcEdad(fNac);if(ed!==null)edades.push(ed);const an=calcAnt(fIng);if(an!==null)ants.push(an);cDepto[depto]=(cDepto[depto]||0)+1;}
        if(est==="Baja"){bajas++;if(motivo)cMotivo[motivo]=(cMotivo[motivo]||0)+1;if(fin>0){totalFin+=fin;const a=fBaja?new Date(fBaja).getFullYear():"S/F";if(!isNaN(a))finPorAnio[a]=(finPorAnio[a]||0)+fin;}}
        if(!cEmp[emp])cEmp[emp]={act:0,baj:0};if(est==="Activo")cEmp[emp].act++;if(est==="Baja")cEmp[emp].baj++;
        if(fIng){const d=new Date(fIng);if(!isNaN(d)){const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0};cTend[k].altas++;}}
        if(fBaja){const d=new Date(fBaja);if(!isNaN(d)){const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0};cTend[k].bajas++;}}
    });
    const tot=activos+bajas,edProm=edades.length?(edades.reduce((a,b)=>a+b,0)/edades.length).toFixed(1):"—",anProm=ants.length?(ants.reduce((a,b)=>a+b,0)/ants.length).toFixed(1):"—";
    document.getElementById('kpi-total').innerText=tot;document.getElementById('kpi-activos').innerText=activos;document.getElementById('kpi-bajas').innerText=bajas;
    document.getElementById('kpi-rotacion').innerText=tot>0?((bajas/tot)*100).toFixed(1)+'%':'0%';
    document.getElementById('kpi-edad-prom').innerText=edProm!=="—"?edProm+' años':"—";
    document.getElementById('kpi-ant-prom').innerText=anProm!=="—"?anProm+' años':"—";
    document.getElementById('kpi-finiquitos').innerText=fmtMXN(totalFin);
    const totG=cGen["Hombre"]+cGen["Mujer"],pctH=totG>0?Math.round(cGen["Hombre"]/totG*100):0;
    document.getElementById('kpi-genero-h').innerText=cGen["Hombre"];document.getElementById('kpi-genero-m').innerText=cGen["Mujer"];
    document.getElementById('kpi-genero-bar-h').style.width=pctH+'%';document.getElementById('kpi-genero-bar-m').style.width=(100-pctH)+'%';
    const empL=Object.keys(cEmp).map(e=>e.length>14?e.substring(0,14)+'…':e);
    charts.emp=dc(charts.emp);charts.emp=new Chart(document.getElementById('chartEmpresas').getContext('2d'),{type:'bar',data:{labels:empL,datasets:[{label:'Activos',data:Object.values(cEmp).map(v=>v.act),backgroundColor:'#3b82f6',borderRadius:4},{label:'Bajas',data:Object.values(cEmp).map(v=>v.baj),backgroundColor:'#ef4444',borderRadius:4}]},options:{...CD,scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'}}}}});
    charts.rango=dc(charts.rango);charts.rango=new Chart(document.getElementById('chartRangoEdad').getContext('2d'),{type:'bar',data:{labels:['< 31 años','31–50 años','51–65 años','> 65 años'],datasets:[{label:'Colaboradores',data:Object.values(cRango),backgroundColor:['#2563eb','#3b82f6','#60a5fa','#93c5fd'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false}}}}});
    const mot=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.mot=dc(charts.mot);charts.mot=new Chart(document.getElementById('chartMotivoBaja').getContext('2d'),{type:'bar',data:{labels:mot.map(([k])=>k.length>22?k.substring(0,22)+'…':k),datasets:[{label:'Bajas',data:mot.map(([,v])=>v),backgroundColor:['#dc2626','#ef4444','#f87171','#fca5a5','#dc2626','#ef4444','#f87171','#fca5a5'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
    const dep=Object.entries(cDepto).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.dep=dc(charts.dep);charts.dep=new Chart(document.getElementById('chartDeptos').getContext('2d'),{type:'bar',data:{labels:dep.map(([k])=>k.length>20?k.substring(0,20)+'…':k),datasets:[{label:'Activos',data:dep.map(([,v])=>v),backgroundColor:'#7c3aed',borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
    const meses=Object.keys(cTend).sort().slice(-18),fmtM=k=>{const[y,m]=k.split('-');return['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]+' '+y.slice(2);};
    charts.tend=dc(charts.tend);charts.tend=new Chart(document.getElementById('chartTendencia').getContext('2d'),{type:'line',data:{labels:meses.map(fmtM),datasets:[{label:'Altas',data:meses.map(k=>cTend[k].altas),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:'#3b82f6'},{label:'Bajas',data:meses.map(k=>cTend[k].bajas),borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.08)',tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:'#ef4444'}]},options:{...CD,scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:'#f1f5f9'}}}}});
    const anios=Object.keys(finPorAnio).sort();
    charts.fin=dc(charts.fin);charts.fin=new Chart(document.getElementById('chartFiniquitos').getContext('2d'),{type:'bar',data:{labels:anios,datasets:[{label:'Finiquitos',data:anios.map(a=>finPorAnio[a]),backgroundColor:['#92400e','#d97706','#f59e0b','#fbbf24'].slice(0,anios.length),borderRadius:6}]},options:{...CD,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtMXN(ctx.raw)}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{callback:v=>fmtMXN(v)}}}}});
    const top=Object.entries(cMotivo).sort((a,b)=>b[1]-a[1]).slice(0,6),tb=document.getElementById('tabla-causas-baja');
    if(tb)tb.innerHTML=top.map(([m,n])=>{const pct=bajas>0?((n/bajas)*100).toFixed(1):"0";return`<tr class="border-b border-slate-100 last:border-0"><td class="py-2.5 pr-4 text-sm text-slate-700">${m}</td><td class="py-2.5 text-center text-sm font-bold text-slate-800">${n}</td><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><div class="flex-1 bg-slate-100 rounded-full h-1.5"><div class="bg-red-400 h-1.5 rounded-full" style="width:${pct}%"></div></div><span class="text-xs text-slate-500 w-10 text-right">${pct}%</span></div></td></tr>`;}).join('');
}

// ─── EXCEL ────────────────────────────────────────────────────
async function exportarExcel(){
    const datos=await obtenerDatos();if(!datos.length){Swal.fire('Sin datos','No hay registros.','info');return;}
    const ws=XLSX.utils.json_to_sheet(datos),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"BASE DE DATOS");
    XLSX.writeFile(wb,`GM_Respaldo_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function importarExcel(event){
    const file=event.target.files[0];if(!file)return;
    mostrarLoader("Leyendo archivo Excel...");
    const reader=new FileReader();
    reader.onload=async e=>{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
        const filtrado=raw.filter(r=>r["NO. EMPLEADO"]&&r["NO. EMPLEADO"].toString().trim()!=="");
        ocultarLoader();
        const{isConfirmed}=await Swal.fire({title:'Confirmar importación',html:`<strong>${filtrado.length} filas válidas</strong> de <em>${file.name}</em>.<br>Existentes → actualizar. Nuevos → insertar.`,icon:'question',showCancelButton:true,confirmButtonText:'Sí, importar',cancelButtonText:'Cancelar'});
        if(isConfirmed){mostrarLoader("Inyectando...");try{const res=await enviarPeticion("importar_masivo",{registros:filtrado});ocultarLoader();Swal.fire('Listo',res.message,'success');forzarActualizacion();}catch(err){ocultarLoader();Swal.fire('Error',err.message,'error');}}
        event.target.value='';
    };
    reader.onerror=()=>{ocultarLoader();Swal.fire('Error','No se pudo leer.','error');};
    reader.readAsArrayBuffer(file);
}

// ─── INIT ─────────────────────────────────────────────────────
async function initApp() {
    pasoActual=0; altaData={};
    renderizarStepper();
    await cargarDashboard();
    initAutocomplete();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initApp);
else initApp();
