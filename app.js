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

const empresas = ["Newspot Mexico", "Centro De Telecomunicaciones Y Publicidad De Mexico", "Global Media", "Editora Mexicana", "Cable Master", "Fember Press", "Infomonitor", "Rtv Comunicacion", "Radio Expresion Cultural"];

// LA LISTA COMPLETA Y ABSOLUTA DE CAMPOS (Mapeada a tus 43 columnas)
const camposAlta = [
    { id: "numeroEmpleado", label: "No. Empleado", type: "number", req: true },
    { id: "fechaIngreso", label: "Fecha de Ingreso", type: "date", req: true },
    { id: "nombreTrabajador", label: "Nombre Completo", type: "text", req: true },
    { id: "empresa", label: "Empresa", type: "select", options: empresas, req: true },
    { id: "departamento", label: "Departamento", type: "text", req: true },
    { id: "puesto", label: "Puesto", type: "text", req: true },
    { id: "sueldoMensual", label: "Sueldo Mensual", type: "number", req: true },
    { id: "frecuenciaPago", label: "Frecuencia de Pago", type: "select", options: ["Quincenal", "Semanal", "Mensual"], req: true },
    { id: "fuenteContratacion", label: "Fuente de Contratación", type: "text", req: false },
    { id: "lugarNacimiento", label: "Lugar de Nacimiento", type: "text", req: false },
    { id: "nacionalidad", label: "Nacionalidad", type: "text", req: false },
    { id: "fechaNacimiento", label: "Fecha de Nacimiento", type: "date", req: false },
    { id: "rangoEdad", label: "Rango de Edad", type: "select", options: ["<31", "31-50", "51-65", ">65"], req: false },
    { id: "genero", label: "Género", type: "select", options: ["Hombre", "Mujer", "Masculino", "Femenino"], req: false },
    { id: "estadoCivil", label: "Estado Civil", type: "select", options: ["Soltero", "Casado", "Divorciado", "Viudo", "Unión Libre"], req: false },
    { id: "curp", label: "CURP", type: "text", req: true },
    { id: "rfc", label: "RFC", type: "text", req: true },
    { id: "nss", label: "NSS", type: "text", req: true },
    { id: "domicilioCompleto", label: "Domicilio Completo", type: "text", req: false },
    { id: "escolaridad", label: "Escolaridad", type: "text", req: false },
    { id: "correoElectronico", label: "Correo Electrónico", type: "email", req: false },
    { id: "telefonoPersonal", label: "Teléfono Personal", type: "text", req: false },
    { id: "contactoEmergencia", label: "Nombre Contacto Emergencia", type: "text", req: false },
    { id: "parentesco", label: "Parentesco Contacto", type: "text", req: false },
    { id: "telefonoEmergencia", label: "Teléfono Emergencia", type: "text", req: false },
    { id: "nombreBeneficiario", label: "Nombre del Beneficiario", type: "text", req: false },
    { id: "rfcBeneficiario", label: "RFC del Beneficiario", type: "text", req: false },
    { id: "parentescoBeneficiario", label: "Parentesco Beneficiario", type: "text", req: false },
    { id: "porcentajeAsignacion", label: "% Asignación", type: "number", req: false },
    { id: "tipoIngreso", label: "Tipo de Ingreso", type: "select", options: ["Administrativo", "Operativo"], req: true },
    { id: "tipoContrato", label: "Tipo de Contrato", type: "select", options: ["Tiempo Indeterminado", "Prueba", "Temporal"], req: true },
    { id: "fechaInicioContrato", label: "Inicio Primer Contrato", type: "date", req: false },
    { id: "entrevista15Dias", label: "Entrevista 15 Días (Sí/No)", type: "select", options: ["Sí", "No"], req: false },
    { id: "entrevista45Dias", label: "Entrevista 45 Días (Sí/No)", type: "select", options: ["Sí", "No"], req: false },
    { id: "vencimientoPrimerContrato", label: "Vencimiento 1er Contrato", type: "date", req: false }
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
            forzarActualizacion(); 
        }
        else Swal.fire('Error', r.message, 'error');
    } catch (e) { ocultarLoader(); Swal.fire('Error', e.message, 'error'); }
}

async function procesarBaja(event) {
    event.preventDefault(); mostrarLoader("Procesando baja...");
    const payload = { 
        numeroEmpleado: document.getElementById('baja_numeroEmpleado').value, 
        fechaBaja: document.getElementById('baja_fechaBaja').value, 
        tipoSalida: document.getElementById('baja_tipoSalida').value, 
        motivoSalida: document.getElementById('baja_motivoSalida').value, 
        montoFiniquito: document.getElementById('baja_montoFiniquito').value 
    };
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

// SOLUCIÓN A LA PANTALLA EN BLANCO: Filtro de filas vacías de Excel
async function obtenerDatos(forzar = false) {
    if(!forzar && cacheGlobal.length > 0) return cacheGlobal;
    
    mostrarLoader("Descargando e indexando BD...");
    try { 
        const r = await enviarPeticion("exportar_datos", {}); 
        ocultarLoader(); 
        if(r.status === "success"){ 
            // Esto filtra los miles de filas en blanco que genera Excel
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
        const estatus = emp["ESTATUS"] ? emp["ESTATUS"].trim() : "";
        const color = estatus === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
        const link = emp["URL EXPEDIENTE"] ? `<a href="${emp["URL EXPEDIENTE"]}" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-folder-open"></i></a>` : '-';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="px-6 py-4 font-semibold">#${emp["NO. EMPLEADO"]}</td><td class="px-6 py-4">${emp["NOMBRE DEL TRABAJADOR"] || "-"}</td><td class="px-6 py-4 text-xs">${emp["EMPRESA"] || "-"}</td><td class="px-6 py-4"><span class="px-2 py-1 text-xs rounded-full ${color}">${estatus}</span></td><td class="px-6 py-4 text-center">${link}</td></tr>`;
    });
}

let chartEmp = null; let chartGen = null;
async function cargarDashboard() {
    const datosCompletos = await obtenerDatos();
    const filtro = document.getElementById('filtroEmpresaGlobal').value;
    
    const datosFiltrados = filtro === "ALL" ? datosCompletos : datosCompletos.filter(r => r["EMPRESA"] && r["EMPRESA"].trim() === filtro);

    let activos = 0, bajas = 0; let cEmp = {}; let cGen = { "Hombre": 0, "Mujer": 0, "Masculino": 0, "Femenino": 0 };
    
    datosFiltrados.forEach(row => {
        let estatus = row["ESTATUS"] ? row["ESTATUS"].trim() : "";
        let genero = row["GÉNERO"] ? row["GÉNERO"].trim() : "";
        let empresa = row["EMPRESA"] ? row["EMPRESA"].trim() : "Sin Empresa";

        if(estatus === "Activo") { 
            activos++; 
            if(cGen[genero] !== undefined) cGen[genero]++; 
        }
        if(estatus === "Baja") bajas++;
        
        if(!cEmp[empresa]) cEmp[empresa] = { act: 0, baj: 0 };
        if(estatus === "Activo") cEmp[empresa].act++;
        if(estatus === "Baja") cEmp[empresa].baj++;
    });

    const tot = activos + bajas;
    document.getElementById('kpi-total').innerText = tot; 
    document.getElementById('kpi-activos').innerText = activos;
    document.getElementById('kpi-bajas').innerText = bajas; 
    document.getElementById('kpi-rotacion').innerText = tot > 0 ? ((bajas/tot)*100).toFixed(1)+'%' : '0%';

    const ctxE = document.getElementById('chartEmpresas').getContext('2d'); if(chartEmp) chartEmp.destroy();
    chartEmp = new Chart(ctxE, { 
        type: 'bar', 
        data: { 
            labels: Object.keys(cEmp).map(e => e.length > 15 ? e.substring(0,15) + '...' : e), 
            datasets: [
                {label:'Activos', data:Object.values(cEmp).map(v=>v.act), backgroundColor:'#3b82f6'}, 
                {label:'Bajas', data:Object.values(cEmp).map(v=>v.baj), backgroundColor:'#ef4444'}
            ] 
        }, 
        options: {responsive:true, maintainAspectRatio:false, scales:{x:{stacked:true},y:{stacked:true}}} 
    });

    const ctxG = document.getElementById('chartGenero').getContext('2d'); if(chartGen) chartGen.destroy();
    
    // Unificar Hombres/Masculino y Mujeres/Femenino si existen variaciones en el Excel
    let totalHombres = cGen["Hombre"] + cGen["Masculino"];
    let totalMujeres = cGen["Mujer"] + cGen["Femenino"];

    chartGen = new Chart(ctxG, { 
        type: 'doughnut', 
        data: { 
            labels: ['Hombres', 'Mujeres'], 
            datasets: [{data:[totalHombres, totalMujeres], backgroundColor:['#0f172a','#3b82f6']}] 
        }, 
        options: {responsive:true, maintainAspectRatio:false} 
    });
}

async function exportarExcel() {
    const datos = await obtenerDatos();
    if(datos.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(datos); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "BD");
    XLSX.writeFile(wb, `GM_Respaldo_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files; if(!file) return;
    mostrarLoader("Leyendo Excel...");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonRaw = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames], {defval: ""});
        
        // Filtrar basura de celdas vacías
        const jsonFiltrado = jsonRaw.filter(r => r["NO. EMPLEADO"] && r["NO. EMPLEADO"].toString().trim() !== "");
        ocultarLoader();
        
        Swal.fire({ 
            title: 'Actualizar DB', 
            text: `¿Inyectar ${jsonFiltrado.length} filas válidas?`, 
            showCancelButton: true, confirmButtonText: 'Sí' 
        }).then(async r => {
            if(r.isConfirmed) { 
                mostrarLoader("Inyectando..."); 
                try { 
                    const res = await enviarPeticion("importar_masivo", {registros: jsonFiltrado}); 
                    ocultarLoader(); 
                    Swal.fire('Éxito', res.message, 'success'); 
                    forzarActualizacion(); 
                } catch(err){ 
                    ocultarLoader(); Swal.fire('Error', err.message, 'error'); 
                } 
            }
        });
        event.target.value = '';
    }; 
    reader.readAsArrayBuffer(file);
}

window.onload = () => cargarDashboard();
