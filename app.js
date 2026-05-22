// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Frontend Logic
//  Versión: 2.1
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";

// ─── UI ──────────────────────────────────────────────────────
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const target = document.getElementById('module-' + moduleId);
    if (!target) return;
    target.style.display = 'block';
    // Un solo rAF para que el browser pinte display:block antes de agregar la clase
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { target.classList.add('active'); });
    });
    const titulos = { dashboard:'Dashboard Directivo', alta:'Onboarding', baja:'Offboarding', basedatos:'Directorio Maestro' };
    document.getElementById('header-title').innerText = titulos[moduleId] || moduleId;
    if (window.innerWidth < 768) toggleMenu();
}

function mostrarLoader(txt) { document.getElementById('loader-text').innerText = txt || 'Procesando...'; document.getElementById('global-loader').style.display = 'flex'; }
function ocultarLoader()    { document.getElementById('global-loader').style.display = 'none'; }

// ─── CATÁLOGOS ────────────────────────────────────────────────
const empresas = ["Newspot Mexico","Centro De Telecomunicaciones Y Publicidad De Mexico","Global Media","Editora Mexicana","Cable Master","Fember Press","Infomonitor","Rtv Comunicacion","Radio Expresion Cultural"];

const camposAlta = [
    { id:"numeroEmpleado",           label:"No. Empleado",               type:"number", req:true  },
    { id:"fechaIngreso",             label:"Fecha de Ingreso",           type:"date",   req:true  },
    { id:"nombreTrabajador",         label:"Nombre Completo",            type:"text",   req:true  },
    { id:"empresa",                  label:"Empresa",                    type:"select", options:empresas, req:true },
    { id:"departamento",             label:"Departamento",               type:"text",   req:true  },
    { id:"puesto",                   label:"Puesto",                     type:"text",   req:true  },
    { id:"sueldoMensual",            label:"Sueldo Mensual",             type:"number", req:true  },
    { id:"frecuenciaPago",           label:"Frecuencia de Pago",         type:"select", options:["Quincenal","Semanal","Mensual"], req:true },
    { id:"tipoIngreso",              label:"Tipo de Ingreso",            type:"select", options:["Administrativo","Operativo"], req:true },
    { id:"tipoContrato",             label:"Tipo de Contrato",           type:"select", options:["Tiempo Indeterminado","Prueba","Temporal"], req:true },
    { id:"curp",                     label:"CURP",                       type:"text",   req:true  },
    { id:"rfc",                      label:"RFC",                        type:"text",   req:true  },
    { id:"nss",                      label:"NSS",                        type:"text",   req:true  },
    { id:"fuenteContratacion",       label:"Fuente de Contratación",     type:"text",   req:false },
    { id:"lugarNacimiento",          label:"Lugar de Nacimiento",        type:"text",   req:false },
    { id:"nacionalidad",             label:"Nacionalidad",               type:"text",   req:false },
    { id:"fechaNacimiento",          label:"Fecha de Nacimiento",        type:"date",   req:false },
    { id:"rangoEdad",                label:"Rango de Edad",              type:"select", options:["<31","31-50","51-65",">65"], req:false },
    { id:"genero",                   label:"Género",                     type:"select", options:["Hombre","Mujer"], req:false },
    { id:"estadoCivil",              label:"Estado Civil",               type:"select", options:["Soltero","Casado","Divorciado","Viudo","Unión Libre"], req:false },
    { id:"domicilioCompleto",        label:"Domicilio Completo",         type:"text",   req:false },
    { id:"escolaridad",              label:"Escolaridad",                type:"text",   req:false },
    { id:"correoElectronico",        label:"Correo Electrónico",         type:"email",  req:false },
    { id:"telefonoPersonal",         label:"Teléfono Personal",          type:"text",   req:false },
    { id:"contactoEmergencia",       label:"Contacto Emergencia",        type:"text",   req:false },
    { id:"parentesco",               label:"Parentesco Contacto",        type:"text",   req:false },
    { id:"telefonoEmergencia",       label:"Teléfono Emergencia",        type:"text",   req:false },
    { id:"nombreBeneficiario",       label:"Nombre Beneficiario",        type:"text",   req:false },
    { id:"rfcBeneficiario",          label:"RFC Beneficiario",           type:"text",   req:false },
    { id:"parentescoBeneficiario",   label:"Parentesco Beneficiario",    type:"text",   req:false },
    { id:"porcentajeAsignacion",     label:"% Asignación",               type:"number", req:false },
    { id:"fechaInicioContrato",      label:"Inicio 1er Contrato",        type:"date",   req:false },
    { id:"vencimientoPrimerContrato",label:"Vencimiento 1er Contrato",   type:"date",   req:false },
    { id:"entrevista15Dias",         label:"Entrevista 15 Días",         type:"select", options:["Sí","No"], req:false },
    { id:"entrevista45Dias",         label:"Entrevista 45 Días",         type:"select", options:["Sí","No"], req:false },
];

// ─── FORMULARIO ALTA ──────────────────────────────────────────
function renderizarFormularioAlta() {
    const form = document.getElementById('formAlta');
    if (!form) return;
    form.innerHTML = '';
    camposAlta.forEach(c => {
        let inp;
        if (c.type === 'select') {
            inp = `<select id="alta_${c.id}" ${c.req?'required':''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"><option value="">Seleccione...</option>${c.options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
        } else {
            inp = `<input type="${c.type}" id="alta_${c.id}" ${c.req?'required':''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">`;
        }
        form.innerHTML += `<div><label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">${c.label}${c.req?' <span class="text-red-500">*</span>':''}</label>${inp}</div>`;
    });
}

// ─── API ──────────────────────────────────────────────────────
async function enviarPeticion(action, payload) {
    const res = await fetch(API_URL, { method:"POST", body:JSON.stringify({ action, payload }) });
    return await res.json();
}

// ─── ALTA ─────────────────────────────────────────────────────
async function procesarAlta(event) {
    event.preventDefault();
    mostrarLoader("Creando expediente y subiendo documentos...");
    let payload = {};
    camposAlta.forEach(c => { payload[c.id] = document.getElementById('alta_'+c.id).value; });

    const fileInput = document.getElementById('alta_archivos');
    let docsBase64 = [];
    if (fileInput && fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            if (file.size > 10 * 1024 * 1024) {
                ocultarLoader();
                Swal.fire('Archivo demasiado grande', `"${file.name}" supera 10 MB.`, 'warning');
                return;
            }
            const b64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload  = () => res(r.result.split(',')[1]);
                r.onerror = () => rej(new Error('Error leyendo ' + file.name));
                r.readAsDataURL(file);
            });
            docsBase64.push({ nombreArchivo:file.name, mimeType:file.type||'application/octet-stream', data:b64 });
        }
    }
    payload.documentos = docsBase64;

    try {
        const r = await enviarPeticion("alta", payload);
        ocultarLoader();
        if (r.status === "success") {
            Swal.fire({ icon:'success', title:'¡Alta registrada!', text:r.message, confirmButtonText:'Ver expediente', showCancelButton:true, cancelButtonText:'Cerrar' })
                .then(res => { if (res.isConfirmed && r.urlExpediente) window.open(r.urlExpediente,'_blank'); });
            document.getElementById('formAlta').reset();
            if (fileInput) fileInput.value = '';
            forzarActualizacion();
        } else {
            Swal.fire('Error en el alta', r.message, 'error');
        }
    } catch(e) { ocultarLoader(); Swal.fire('Error de conexión', e.message, 'error'); }
}

// ─── BAJA ─────────────────────────────────────────────────────
async function procesarBaja(event) {
    event.preventDefault();
    mostrarLoader("Procesando baja...");
    const payload = {
        numeroEmpleado: document.getElementById('baja_numeroEmpleado').value,
        fechaBaja:      document.getElementById('baja_fechaBaja').value,
        tipoSalida:     document.getElementById('baja_tipoSalida').value,
        motivoSalida:   document.getElementById('baja_motivoSalida').value,
        montoFiniquito: document.getElementById('baja_montoFiniquito').value
    };
    try {
        const r = await enviarPeticion("baja", payload);
        ocultarLoader();
        if (r.status === "success") {
            Swal.fire('Baja registrada', r.message, 'success');
            document.getElementById('formBaja').reset();
            forzarActualizacion();
        } else {
            Swal.fire('No se encontró el empleado', r.message, 'warning');
        }
    } catch(e) { ocultarLoader(); Swal.fire('Error de conexión', e.message, 'error'); }
}

// ─── CACHÉ ────────────────────────────────────────────────────
let cacheGlobal = [];

async function obtenerDatos(forzar) {
    if (!forzar && cacheGlobal.length > 0) return cacheGlobal;
    mostrarLoader("Sincronizando base de datos...");
    try {
        const r = await enviarPeticion("exportar_datos", {});
        ocultarLoader();
        if (r.status === "success") {
            cacheGlobal = r.data.filter(e => e["NO. EMPLEADO"] && e["NO. EMPLEADO"].toString().trim() !== "");
            return cacheGlobal;
        }
        return [];
    } catch(e) { ocultarLoader(); return []; }
}

async function forzarActualizacion() {
    cacheGlobal = [];
    await obtenerDatos(true);
    cargarDashboard();
    if (document.getElementById('module-basedatos').classList.contains('active')) renderizarPagina(1);
}

// ─── DIRECTORIO ───────────────────────────────────────────────
let paginaActual = 1;
const FILAS_PAG  = 50;

async function cargarDatosTabla() {
    await obtenerDatos();
    paginaActual = 1;
    renderizarPagina(1);
}

function renderizarPagina(pag) {
    const datos = cacheGlobal;
    const totalPags = Math.max(1, Math.ceil(datos.length / FILAS_PAG));
    paginaActual = Math.max(1, Math.min(pag, totalPags));
    const ini = (paginaActual - 1) * FILAS_PAG;
    const slice = datos.slice(ini, ini + FILAS_PAG);
    const tbody = document.getElementById('tabla-directorio');
    tbody.innerHTML = '';
    slice.forEach(emp => {
        const est = (emp["ESTATUS"] || "").trim();
        const color = est === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
        const url = emp["URL EXPEDIENTE"] || "";
        const link = url ? `<a href="${url}" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-folder-open"></i></a>` : '<span class="text-slate-300">—</span>';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-100 transition">
            <td class="px-6 py-4 font-semibold text-slate-700">#${emp["NO. EMPLEADO"]||"—"}</td>
            <td class="px-6 py-4">${emp["NOMBRE DEL TRABAJADOR"]||"—"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${emp["EMPRESA"]||"—"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${emp["PUESTO"]||"—"}</td>
            <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-semibold rounded-full ${color}">${est||"—"}</span></td>
            <td class="px-6 py-4 text-center">${link}</td></tr>`;
    });
    const pg = document.getElementById('paginacion-directorio');
    if (!pg) return;
    const ini2 = ini + 1, fin2 = Math.min(ini + FILAS_PAG, datos.length);
    pg.innerHTML = `<div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <span class="text-sm text-slate-500">Mostrando <strong>${ini2}–${fin2}</strong> de <strong>${datos.length}</strong> registros</span>
        <div class="flex gap-2">
            <button onclick="renderizarPagina(${paginaActual-1})" ${paginaActual<=1?'disabled':''} class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">← Anterior</button>
            <span class="px-3 py-1.5 text-sm font-medium text-slate-700">${paginaActual} / ${totalPags}</span>
            <button onclick="renderizarPagina(${paginaActual+1})" ${paginaActual>=totalPags?'disabled':''} class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Siguiente →</button>
        </div></div>`;
    const sub = document.getElementById('subtitulo-directorio');
    if (sub) sub.innerText = `${datos.length} colaboradores en la base maestra`;
}

// ─── HELPERS ──────────────────────────────────────────────────
function destroyChart(ref) { if (ref) { try { ref.destroy(); } catch(e){} } return null; }
function fmtMoney(n) { return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0); }

function calcEdad(fechaNac) {
    if (!fechaNac) return null;
    const d = new Date(fechaNac);
    if (isNaN(d)) return null;
    const hoy = new Date();
    let age = hoy.getFullYear() - d.getFullYear();
    if (hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) age--;
    return age >= 15 && age <= 80 ? age : null;
}

function calcAntiguedadAnios(fechaIng) {
    if (!fechaIng) return null;
    const d = new Date(fechaIng);
    if (isNaN(d)) return null;
    const hoy = new Date();
    const diffMs = hoy - d;
    if (diffMs < 0) return null;
    return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

// ─── DASHBOARD ────────────────────────────────────────────────
let charts = {};

// Paleta corporativa consistente
const PALETTE = {
    blue:   ['#1e40af','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe'],
    green:  ['#166534','#15803d','#16a34a','#22c55e','#4ade80','#86efac'],
    red:    ['#991b1b','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5'],
    amber:  ['#92400e','#b45309','#d97706','#f59e0b','#fbbf24','#fcd34d'],
    slate:  ['#0f172a','#1e293b','#334155','#475569','#64748b','#94a3b8'],
    mixed:  ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2','#be185d','#047857','#c2410c']
};

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { font:{ family:"'Inter',sans-serif", size:11 }, padding:12, boxWidth:12, boxHeight:12 } }
    }
};

async function cargarDashboard() {
    const todosLosDatos = await obtenerDatos();
    const filtro = document.getElementById('filtroEmpresaGlobal').value;
    const D = filtro === "ALL" ? todosLosDatos : todosLosDatos.filter(r => (r["EMPRESA"]||"").trim() === filtro);

    // ── Métricas base ────────────────────────────────────────
    let activos=0, bajas=0;
    let conteoEmpresas={}, conteoGenero={"Hombre":0,"Mujer":0};
    let conteoRangoEdad={"<31":0,"31-50":0,"51-65":0,">65":0};
    let conteoMotivoBaja={}, conteoDepto={}, conteoPuesto={};
    let conteoTendencia={};   // { "YYYY-MM": {altas,bajas} }
    let edades=[], antiguedades=[];
    let finiquitosPorAnio={};
    let totalFiniquitos=0;

    D.forEach(row => {
        const est      = (row["ESTATUS"]||"").trim();
        const genero   = (row["GÉNERO"]||"").trim();
        const empresa  = (row["EMPRESA"]||"Sin Empresa").trim();
        const rango    = (row["RANGO DE EDAD"]||"").trim();
        const motivo   = (row["MOTIVO DE SALIDA"]||"").trim();
        const depto    = (row["DEPARTAMENTO"]||"Sin Departamento").trim();
        const puesto   = (row["PUESTO"]||"Sin Puesto").trim();
        const fIng     = row["FECHA DE INGRESO"]||"";
        const fBaja    = row["FECHA DE BAJA"]||"";
        const fNac     = row["FECHA DE NACIMIENTO"]||"";
        const finiquito= parseFloat((row["MONTO DE FINIQUITO"]||"0").toString().replace(/[,$\s]/g,""))||0;

        if (est === "Activo") {
            activos++;
            if (genero==="Hombre"||genero==="Masculino") conteoGenero["Hombre"]++;
            else if (genero==="Mujer"||genero==="Femenino") conteoGenero["Mujer"]++;
            if (conteoRangoEdad[rango]!==undefined) conteoRangoEdad[rango]++;
            const edad = calcEdad(fNac);
            if (edad !== null) edades.push(edad);
            const ant = calcAntiguedadAnios(fIng);
            if (ant !== null) antiguedades.push(ant);
            conteoDepto[depto] = (conteoDepto[depto]||0) + 1;
            conteoPuesto[puesto] = (conteoPuesto[puesto]||0) + 1;
        }

        if (est === "Baja") {
            bajas++;
            if (motivo) conteoMotivoBaja[motivo] = (conteoMotivoBaja[motivo]||0)+1;
            if (finiquito > 0) {
                totalFiniquitos += finiquito;
                const anio = fBaja ? new Date(fBaja).getFullYear() : "S/F";
                if (!isNaN(anio)) finiquitosPorAnio[anio] = (finiquitosPorAnio[anio]||0) + finiquito;
            }
        }

        // Tendencia mensual de altas
        if (fIng) {
            const d = new Date(fIng);
            if (!isNaN(d)) {
                const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
                if (!conteoTendencia[k]) conteoTendencia[k] = {altas:0,bajas:0};
                conteoTendencia[k].altas++;
            }
        }
        // Tendencia mensual de bajas
        if (fBaja) {
            const d = new Date(fBaja);
            if (!isNaN(d)) {
                const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
                if (!conteoTendencia[k]) conteoTendencia[k] = {altas:0,bajas:0};
                conteoTendencia[k].bajas++;
            }
        }
    });

    const total = activos + bajas;
    const edadProm = edades.length ? (edades.reduce((a,b)=>a+b,0)/edades.length).toFixed(1) : "—";
    const antProm  = antiguedades.length ? (antiguedades.reduce((a,b)=>a+b,0)/antiguedades.length).toFixed(1) : "—";
    const rotacion = total > 0 ? ((bajas/total)*100).toFixed(1) : "0";

    // ── KPIs ────────────────────────────────────────────────
    document.getElementById('kpi-total').innerText    = total;
    document.getElementById('kpi-activos').innerText  = activos;
    document.getElementById('kpi-bajas').innerText    = bajas;
    document.getElementById('kpi-rotacion').innerText = rotacion + '%';
    document.getElementById('kpi-edad-prom').innerText    = edadProm !== "—" ? edadProm + " años" : "—";
    document.getElementById('kpi-ant-prom').innerText     = antProm  !== "—" ? antProm  + " años" : "—";
    document.getElementById('kpi-finiquitos').innerText   = fmtMoney(totalFiniquitos);
    // Género visual
    const pctH = conteoGenero["Hombre"]+conteoGenero["Mujer"] > 0
        ? Math.round(conteoGenero["Hombre"]/(conteoGenero["Hombre"]+conteoGenero["Mujer"])*100) : 0;
    document.getElementById('kpi-genero-h').innerText = conteoGenero["Hombre"];
    document.getElementById('kpi-genero-m').innerText = conteoGenero["Mujer"];
    document.getElementById('kpi-genero-bar-h').style.width = pctH + '%';
    document.getElementById('kpi-genero-bar-m').style.width = (100-pctH) + '%';

    // ── Empresas ────────────────────────────────────────────
    // Contar activos+bajas para gráfica de empresas
    const cEmp = {};
    D.forEach(row => {
        const emp = (row["EMPRESA"]||"Sin Empresa").trim();
        const est = (row["ESTATUS"]||"").trim();
        if (!cEmp[emp]) cEmp[emp] = {act:0,baj:0};
        if (est==="Activo") cEmp[emp].act++;
        if (est==="Baja")   cEmp[emp].baj++;
    });
    const empLabels = Object.keys(cEmp).map(e => e.length>14 ? e.substring(0,14)+'…' : e);
    charts.empresas = destroyChart(charts.empresas);
    charts.empresas = new Chart(document.getElementById('chartEmpresas').getContext('2d'), {
        type:'bar',
        data:{ labels:empLabels, datasets:[
            { label:'Activos', data:Object.values(cEmp).map(v=>v.act), backgroundColor:'#3b82f6', borderRadius:4 },
            { label:'Bajas',   data:Object.values(cEmp).map(v=>v.baj), backgroundColor:'#ef4444', borderRadius:4 }
        ]},
        options:{ ...CHART_DEFAULTS, scales:{ x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}}, y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'}} } }
    });

    // ── Rango de Edad ────────────────────────────────────────
    charts.rangoEdad = destroyChart(charts.rangoEdad);
    charts.rangoEdad = new Chart(document.getElementById('chartRangoEdad').getContext('2d'), {
        type:'bar',
        data:{ labels:['Menor de 31','31 – 50','51 – 65','Mayor de 65'],
               datasets:[{ label:'Colaboradores', data:Object.values(conteoRangoEdad), backgroundColor:PALETTE.blue.slice(1,5), borderRadius:6 }]},
        options:{ ...CHART_DEFAULTS, indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{beginAtZero:true,grid:{color:'#f1f5f9'}}, y:{grid:{display:false}} } }
    });

    // ── Motivo de Baja ───────────────────────────────────────
    const motivosOrdenados = Object.entries(conteoMotivoBaja).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.motivoBaja = destroyChart(charts.motivoBaja);
    charts.motivoBaja = new Chart(document.getElementById('chartMotivoBaja').getContext('2d'), {
        type:'bar',
        data:{ labels: motivosOrdenados.map(([k])=>k.length>22?k.substring(0,22)+'…':k),
               datasets:[{ label:'Bajas', data:motivosOrdenados.map(([,v])=>v), backgroundColor:PALETTE.red.slice(2,8), borderRadius:6 }]},
        options:{ ...CHART_DEFAULTS, indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{beginAtZero:true,grid:{color:'#f1f5f9'}}, y:{grid:{display:false},ticks:{font:{size:10}}} } }
    });

    // ── Top Departamentos ─────────────────────────────────────
    const deptosTop = Object.entries(conteoDepto).sort((a,b)=>b[1]-a[1]).slice(0,8);
    charts.deptos = destroyChart(charts.deptos);
    charts.deptos = new Chart(document.getElementById('chartDeptos').getContext('2d'), {
        type:'bar',
        data:{ labels: deptosTop.map(([k])=>k.length>20?k.substring(0,20)+'…':k),
               datasets:[{ label:'Activos', data:deptosTop.map(([,v])=>v), backgroundColor:'#7c3aed', borderRadius:6 }]},
        options:{ ...CHART_DEFAULTS, indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{beginAtZero:true,grid:{color:'#f1f5f9'}}, y:{grid:{display:false},ticks:{font:{size:10}}} } }
    });

    // ── Tendencia Mensual ────────────────────────────────────
    const mesesOrdenados = Object.keys(conteoTendencia).sort().slice(-18);
    const fmtMes = k => { const [y,m]=k.split('-'); return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]+' '+y.slice(2); };
    charts.tendencia = destroyChart(charts.tendencia);
    charts.tendencia = new Chart(document.getElementById('chartTendencia').getContext('2d'), {
        type:'line',
        data:{ labels: mesesOrdenados.map(fmtMes), datasets:[
            { label:'Altas', data:mesesOrdenados.map(k=>conteoTendencia[k].altas), borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.08)', tension:0.4, fill:true, pointRadius:3, pointBackgroundColor:'#3b82f6' },
            { label:'Bajas', data:mesesOrdenados.map(k=>conteoTendencia[k].bajas), borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.08)',  tension:0.4, fill:true, pointRadius:3, pointBackgroundColor:'#ef4444' }
        ]},
        options:{ ...CHART_DEFAULTS, scales:{ x:{grid:{display:false},ticks:{font:{size:10}}}, y:{beginAtZero:true,grid:{color:'#f1f5f9'}} } }
    });

    // ── Finiquitos por Año ───────────────────────────────────
    const aniosOrdenados = Object.keys(finiquitosPorAnio).sort();
    charts.finiquitos = destroyChart(charts.finiquitos);
    charts.finiquitos = new Chart(document.getElementById('chartFiniquitos').getContext('2d'), {
        type:'bar',
        data:{ labels: aniosOrdenados,
               datasets:[{ label:'Finiquitos pagados', data:aniosOrdenados.map(a=>finiquitosPorAnio[a]), backgroundColor:PALETTE.amber.slice(1,5), borderRadius:6 }]},
        options:{ ...CHART_DEFAULTS, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ' '+fmtMoney(ctx.raw) } } },
            scales:{ x:{grid:{display:false}}, y:{beginAtZero:true,grid:{color:'#f1f5f9'}, ticks:{ callback: v => fmtMoney(v) } } } }
    });

    // ── Top causas de baja — tabla resumen ──────────────────
    const topTabla = Object.entries(conteoMotivoBaja).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const tbCausas = document.getElementById('tabla-causas-baja');
    if (tbCausas) {
        tbCausas.innerHTML = topTabla.map(([motivo, n]) => {
            const pct = bajas > 0 ? ((n/bajas)*100).toFixed(1) : "0";
            return `<tr class="border-b border-slate-100 last:border-0">
                <td class="py-2.5 pr-4 text-sm text-slate-700">${motivo}</td>
                <td class="py-2.5 text-center text-sm font-bold text-slate-800">${n}</td>
                <td class="py-2.5 pl-4">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-slate-100 rounded-full h-1.5"><div class="bg-red-400 h-1.5 rounded-full" style="width:${pct}%"></div></div>
                    <span class="text-xs text-slate-500 w-10 text-right">${pct}%</span>
                  </div>
                </td></tr>`;
        }).join('');
    }
}

// ─── EXCEL ────────────────────────────────────────────────────
async function exportarExcel() {
    const datos = await obtenerDatos();
    if (!datos.length) { Swal.fire('Sin datos','No hay registros para exportar.','info'); return; }
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BASE DE DATOS");
    XLSX.writeFile(wb, `GM_Respaldo_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    mostrarLoader("Leyendo archivo Excel...");
    const reader = new FileReader();
    reader.onload = async e => {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:"" });
        const filtrado = raw.filter(r => r["NO. EMPLEADO"] && r["NO. EMPLEADO"].toString().trim() !== "");
        ocultarLoader();
        const { isConfirmed } = await Swal.fire({ title:'Confirmar importación masiva',
            html:`Se procesarán <strong>${filtrado.length} filas válidas</strong> de <em>${file.name}</em>.<br>Los existentes se actualizarán; los nuevos se insertarán.`,
            icon:'question', showCancelButton:true, confirmButtonText:'Sí, importar', cancelButtonText:'Cancelar' });
        if (isConfirmed) {
            mostrarLoader("Inyectando datos...");
            try {
                const res = await enviarPeticion("importar_masivo", { registros:filtrado });
                ocultarLoader();
                Swal.fire('Importación completa', res.message, 'success');
                forzarActualizacion();
            } catch(err) { ocultarLoader(); Swal.fire('Error', err.message, 'error'); }
        }
        event.target.value = '';
    };
    reader.onerror = () => { ocultarLoader(); Swal.fire('Error','No se pudo leer el archivo.','error'); };
    reader.readAsArrayBuffer(file);
}

// ─── INIT ─────────────────────────────────────────────────────
function initApp() {
    renderizarFormularioAlta();
    cargarDashboard();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
