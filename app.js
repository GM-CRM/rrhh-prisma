// TU NUEVA URL - Carga directa
const API_URL = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(sec => { sec.classList.remove('active'); setTimeout(() => sec.style.display = 'none', 300); });
    const target = document.getElementById(`module-${moduleId}`);
    target.style.display = 'block'; setTimeout(() => target.classList.add('active'), 10);
    document.getElementById('header-title').innerText = {'dashboard': 'Dashboard Directivo', 'alta': 'Onboarding', 'baja': 'Offboarding', 'basedatos': 'Directorio'}[moduleId];
    if(window.innerWidth < 768) toggleMenu();
}

function mostrarLoader(texto = "Procesando...") { document.getElementById('loader-text').innerText = texto; document.getElementById('global-loader').style.display = 'flex'; }
function ocultarLoader() { document.getElementById('global-loader').style.display = 'none'; }

const empresas = ["Newspot Mexico", "Centro De Telecomunicaciones Y Publicidad De Mexico", "Global Media", "Editora Mexicana", "Cable Master", "Fember Press", "Infomonitor", "RTV Comunicacion", "Radio Expresion Cultural"];
const camposAlta = [
    { id: "numeroEmpleado", label: "No. Empleado", type: "number", req: true }, { id: "fechaIngreso", label: "Fecha Ingreso", type: "date", req: true },
    { id: "nombreTrabajador", label: "Nombre Completo", type: "text", req: true }, { id: "empresa", label: "Empresa", type: "select", options: empresas, req: true },
    { id: "departamento", label: "Departamento", type: "text", req: true }, { id: "puesto", label: "Puesto", type: "text", req: true },
    { id: "sueldoMensual", label: "Sueldo", type: "number", req: true }, { id: "frecuenciaPago", label: "Frec. Pago", type: "select", options: ["Quincenal", "Semanal", "Mensual"], req: true },
    { id: "curp", label: "CURP", type: "text", req: true }, { id: "rfc", label: "RFC", type: "text", req: true }, { id: "nss", label: "NSS", type: "text", req: true }
];

function renderizarFormularioAlta() {
    const form = document.getElementById('formAlta'); form.innerHTML = '';
    camposAlta.forEach(c => {
        let inputHtml = c.type === 'select' ? `<select id="alta_${c.id}" ${c.req?'required':''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50"><option value="">Seleccione...</option>${c.options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>` 
        : `<input type="${c.type}" id="alta_${c.id}" ${c.req?'required':''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50">`;
        form.innerHTML += `<div><label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">${c.label} ${c.req?'<span class="text-red-500">*</span>':''}</label>${inputHtml}</div>`;
    });
}
renderizarFormularioAlta();

async function enviarPeticion(action, payload) {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action, payload }) });
    return await res.json();
}

async function procesarAlta(event) {
    event.preventDefault(); mostrarLoader("Subiendo archivos y creando expediente...");
    let payload = {}; camposAlta.forEach(c => payload[c.id] = document.getElementById(`alta_${c.id}`).value);
    
    const fileInput = document.getElementById('alta_archivos');
    let docsBase64 = [];
    if(fileInput.files.length > 0) {
        for(let i=0; i<fileInput.files.length; i++){
            let file = fileInput.files[i];
            let base64 = await new Promise(res => { let r = new FileReader(); r.onload = () => res(r.result.split(',')); r.readAsDataURL(file); });
            docsBase64.push({ nombreArchivo: file.name, mimeType: file.type, data: base64 });
        }
    }
    payload.documentos = docsBase64;

    try {
        const r = await enviarPeticion("alta", payload); ocultarLoader();
        if(r.status === "success") { 
            Swal.fire('¡Éxito!', r.message, 'success'); 
            document.getElementById('formAlta').reset(); fileInput.value = ''; 
            forzarActualizacion(); // Recargar datos internamente
        }
        else Swal.fire('Error', r.message, 'error');
    } catch (e) { ocultarLoader(); Swal.fire('Error', e.message, 'error'); }
}

async function procesarBaja(event) {
    event.preventDefault(); mostrarLoader("Procesando...");
    const payload = { numeroEmpleado: document.getElementById('baja_numeroEmpleado').value, fechaBaja: document.getElementById('baja_fechaBaja').value, tipoSalida: document.getElementById('baja_tipoSalida').value, motivoSalida: document.getElementById('baja_motivoSalida').value, montoFiniquito: document.getElementById('baja_montoFiniquito').value };
    try {
        const r = await enviarPeticion("baja", payload); ocultarLoader();
        if(r.status === "success") { 
            Swal.fire('Baja Exitosa', 'Guardado en maestro.', 'success'); 
            document.getElementById('formBaja').reset(); 
            forzarActualizacion();
        }
        else Swal.fire('Aviso', r.message, 'warning');
    } catch (e) { ocultarLoader(); Swal.fire('Error', e.message, 'error'); }
}

let cacheGlobal = [];

// Función Clave: Destruye las filas fantasma de Excel
async function obtenerDatos(forzar = false) {
    if(!forzar && cacheGlobal.length > 0) return cacheGlobal;
    
    mostrarLoader("Descargando e indexando BD...");
    try { 
        const r = await enviarPeticion("exportar_datos", {}); 
        ocultarLoader(); 
        if(r.status === "success"){ 
            // ELIMINA FILAS EN BLANCO Y BASURA DE EXCEL
            cacheGlobal = r.data.filter(emp => emp["NO. EMPLEADO"] && emp["NO. EMPLEADO"].toString().trim() !== "");
            return cacheGlobal; 
        } 
        return []; 
    }
    catch(e){ ocultarLoader(); return []; }
}

async function forzarActualizacion() {
    await obtenerDatos(true);
    cargarDashboard();
    if(document.getElementById('module-basedatos').classList.contains('active')) cargarDatosTabla();
}

async function cargarDatosTabla() {
    const datos = await obtenerDatos();
    const tbody = document.getElementById('tabla-directorio'); tbody.innerHTML = '';
    
    // Muestra los últimos 100 registros reales
    datos.slice(-100).reverse().forEach(emp => {
        const color = emp["ESTATUS"] === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
        const link = emp["URL EXPEDIENTE"] ? `<a href="${emp["URL EXPEDIENTE"]}" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-folder-open"></i></a>` : '-';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="px-6 py-4 font-semibold">#${emp["NO. EMPLEADO"]}</td><td class="px-6 py-4">${emp["NOMBRE DEL TRABAJADOR"]}</td><td class="px-6 py-4 text-xs">${emp["EMPRESA"]}</td><td class="px-6 py-4"><span class="px-2 py-1 text-xs rounded-full ${color}">${emp["ESTATUS"]}</span></td><td class="px-6 py-4 text-center">${link}</td></tr>`;
    });
}

let chartEmp = null; let chartGen = null;
async function cargarDashboard() {
    const datosCompletos = await obtenerDatos();
    const filtro = document.getElementById('filtroEmpresaGlobal').value;
    
    const datosFiltrados = filtro === "ALL" ? datosCompletos : datosCompletos.filter(r => r["EMPRESA"] === filtro);

    let activos = 0, bajas = 0; let cEmp = {}; let cGen = { "Hombre": 0, "Mujer": 0 };
    datosFiltrados.forEach(row => {
        if(row["ESTATUS"] === "Activo") { activos++; if(cGen[row["GÉNERO"]] !== undefined) cGen[row["GÉNERO"]]++; }
        if(row["ESTATUS"] === "Baja") bajas++;
        
        let nomEmp = row["EMPRESA"] || "Sin Empresa";
        if(!cEmp[nomEmp]) cEmp[nomEmp] = { act: 0, baj: 0 };
        if(row["ESTATUS"] === "Activo") cEmp[nomEmp].act++;
        if(row["ESTATUS"] === "Baja") cEmp[nomEmp].baj++;
    });

    const tot = activos + bajas;
    document.getElementById('kpi-total').innerText = tot; document.getElementById('kpi-activos').innerText = activos;
    document.getElementById('kpi-bajas').innerText = bajas; document.getElementById('kpi-rotacion').innerText = tot > 0 ? ((bajas/tot)*100).toFixed(1)+'%' : '0%';

    const ctxE = document.getElementById('chartEmpresas').getContext('2d'); if(chartEmp) chartEmp.destroy();
    chartEmp = new Chart(ctxE, { type: 'bar', data: { labels: Object.keys(cEmp).map(e=>e.substring(0,10)+'.'), datasets: [{label:'Activos', data:Object.values(cEmp).map(v=>v.act), backgroundColor:'#3b82f6'}, {label:'Bajas', data:Object.values(cEmp).map(v=>v.baj), backgroundColor:'#ef4444'}] }, options: {responsive:true, maintainAspectRatio:false, scales:{x:{stacked:true},y:{stacked:true}}} });

    const ctxG = document.getElementById('chartGenero').getContext('2d'); if(chartGen) chartGen.destroy();
    chartGen = new Chart(ctxG, { type: 'doughnut', data: { labels: ['Hombres', 'Mujeres'], datasets: [{data:[cGen["Hombre"], cGen["Mujer"]], backgroundColor:['#0f172a','#3b82f6']}] }, options: {responsive:true, maintainAspectRatio:false} });
}

async function exportarExcel() {
    const datos = await obtenerDatos();
    if(datos.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(datos); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "BD");
    XLSX.writeFile(wb, `GM_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files; if(!file) return;
    mostrarLoader("Leyendo Excel...");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonRaw = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames], {defval: ""});
        // Filtrar vacíos antes de subir
        const jsonFiltrado = jsonRaw.filter(r => r["NO. EMPLEADO"] && r["NO. EMPLEADO"].toString().trim() !== "");
        ocultarLoader();
        Swal.fire({ title: 'Actualizar DB', text: `¿Inyectar ${jsonFiltrado.length} filas válidas?`, showCancelButton: true, confirmButtonText: 'Sí' }).then(async r => {
            if(r.isConfirmed) { 
                mostrarLoader("Inyectando..."); 
                try { 
                    const res = await enviarPeticion("importar_masivo", {registros: jsonFiltrado}); 
                    ocultarLoader(); 
                    Swal.fire('Éxito', res.message, 'success'); 
                    forzarActualizacion(); 
                } catch(err){ ocultarLoader(); Swal.fire('Error', err.message, 'error'); } 
            }
        });
        event.target.value = '';
    }; reader.readAsArrayBuffer(file);
}

window.onload = () => cargarDashboard();
