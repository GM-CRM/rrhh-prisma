// =========================================================
// Pega aquí la NUEVA URL que te dio Apps Script
// =========================================================
const API_URL = "TU_NUEVA_URL_AQUI"; 

function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(sec => {
        sec.classList.remove('active');
        setTimeout(() => sec.style.display = 'none', 400); 
    });
    
    const target = document.getElementById(`module-${moduleId}`);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);
    
    const titles = {
        'dashboard': 'Dashboard Directivo',
        'alta': 'Proceso de Onboarding',
        'baja': 'Proceso de Offboarding',
        'basedatos': 'Directorio y Base Maestra'
    };
    document.getElementById('header-title').innerText = titles[moduleId];
}

function mostrarLoader(texto = "Procesando...") {
    document.getElementById('loader-text').innerText = texto;
    document.getElementById('global-loader').style.display = 'flex';
}

function ocultarLoader() {
    document.getElementById('global-loader').style.display = 'none';
}

// Generación de formulario (Igual, pero con clases Tailwind premium)
const empresas = ["Newspot Mexico", "Centro De Telecomunicaciones Y Publicidad De Mexico", "Global Media", "Editora Mexicana", "Cable Master", "Fember Press", "Infomonitor", "RTV Comunicacion", "Radio Expresion Cultural"];

const camposAlta = [
    { id: "numeroEmpleado", label: "No. Empleado", type: "number", req: true },
    { id: "fechaIngreso", label: "Fecha Ingreso", type: "date", req: true },
    { id: "nombreTrabajador", label: "Nombre Completo", type: "text", req: true },
    { id: "empresa", label: "Empresa", type: "select", options: empresas, req: true },
    { id: "departamento", label: "Departamento", type: "text", req: true },
    { id: "puesto", label: "Puesto", type: "text", req: true },
    { id: "sueldoMensual", label: "Sueldo Bruto", type: "number", req: true },
    { id: "frecuenciaPago", label: "Frecuencia Pago", type: "select", options: ["Quincenal", "Semanal", "Mensual"], req: true },
    { id: "curp", label: "CURP", type: "text", req: true },
    { id: "rfc", label: "RFC", type: "text", req: true },
    { id: "nss", label: "NSS", type: "text", req: true },
    { id: "tipoIngreso", label: "Tipo Ingreso", type: "select", options: ["Administrativo", "Operativo"], req: true },
    { id: "tipoContrato", label: "Tipo Contrato", type: "select", options: ["Tiempo Indeterminado", "Prueba", "Temporal"], req: true }
    // Agrega el resto de los 43 campos aquí siguiendo el mismo formato si lo deseas, para brevedad visual muestro los vitales
];

function renderizarFormularioAlta() {
    const form = document.getElementById('formAlta');
    form.innerHTML = '';
    camposAlta.forEach(campo => {
        let inputHtml = '';
        const reqStr = campo.req ? 'required' : '';
        const reqStar = campo.req ? '<span class="text-red-500">*</span>' : '';
        const baseClasses = "w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition text-slate-700";

        if (campo.type === 'select') {
            let options = `<option value="">Seleccione...</option>`;
            campo.options.forEach(opt => options += `<option value="${opt}">${opt}</option>`);
            inputHtml = `<select id="alta_${campo.id}" ${reqStr} class="${baseClasses}">${options}</select>`;
        } else {
            inputHtml = `<input type="${campo.type}" id="alta_${campo.id}" ${reqStr} class="${baseClasses}">`;
        }

        form.innerHTML += `
            <div class="flex flex-col">
                <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">${campo.label} ${reqStar}</label>
                ${inputHtml}
            </div>
        `;
    });
}
renderizarFormularioAlta();

// Petición con manejo de errores mejorado
async function enviarPeticion(action, payload) {
    if(API_URL === "TU_NUEVA_URL_AQUI") {
        throw new Error("Falta configurar la URL de la API en app.js");
    }
    
    const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload }),
        headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });
    
    if(!response.ok) {
        throw new Error(`Error HTTP: ${response.status}. Revisa que la implementación en Apps Script sea 'Cualquier Persona'.`);
    }
    
    return await response.json();
}

async function procesarAlta(event) {
    event.preventDefault();
    mostrarLoader("Creando Expediente en Drive...");
    let payload = {};
    camposAlta.forEach(c => payload[c.id] = document.getElementById(`alta_${c.id}`).value || "");

    try {
        const result = await enviarPeticion("alta", payload);
        ocultarLoader();
        if(result.status === "success") {
            Swal.fire({
                title: 'Expediente Creado',
                html: `<p class="mb-4 text-slate-600">${result.message}</p><a href="${result.urlExpediente}" target="_blank" class="bg-blue-50 text-blue-700 font-semibold px-4 py-2 rounded-lg border border-blue-200 inline-block"><i class="fas fa-folder-open mr-2"></i> Abrir en Drive</a>`,
                icon: 'success'
            });
            document.getElementById('formAlta').reset();
        } else {
            Swal.fire('Error del Servidor', result.message, 'error');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de Comunicación', e.message, 'error');
    }
}

async function procesarBaja(event) {
    event.preventDefault();
    mostrarLoader("Procesando offboarding...");
    const payload = {
        numeroEmpleado: document.getElementById('baja_numeroEmpleado').value,
        fechaBaja: document.getElementById('baja_fechaBaja').value,
        tipoSalida: document.getElementById('baja_tipoSalida').value,
        motivoSalida: document.getElementById('baja_motivoSalida').value,
        montoFiniquito: document.getElementById('baja_montoFiniquito').value
    };

    try {
        const result = await enviarPeticion("baja", payload);
        ocultarLoader();
        if(result.status === "success") {
            Swal.fire('Baja Exitosa', 'El estatus se ha actualizado a BAJA en el sistema maestro.', 'success');
            document.getElementById('formBaja').reset();
        } else {
            Swal.fire('Aviso', result.message, 'warning');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de Comunicación', e.message, 'error');
    }
}

async function obtenerDatos() {
    mostrarLoader("Sincronizando maestro...");
    try {
        const result = await enviarPeticion("exportar_datos", {});
        ocultarLoader();
        if(result.status === "success") return result.data;
        Swal.fire('Error', result.message, 'error'); return [];
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de Comunicación', e.message, 'error'); return [];
    }
}

async function cargarDatosTabla() {
    const datos = await obtenerDatos();
    const tbody = document.getElementById('tabla-directorio');
    tbody.innerHTML = '';
    
    const datosMostrar = datos.slice(-50).reverse(); 

    datosMostrar.forEach(emp => {
        if(!emp["NO. EMPLEADO"]) return; 
        const isActive = emp["ESTATUS"] === "Activo";
        const colorBg = isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200";
        const iconDir = emp["URL EXPEDIENTE"] ? `<a href="${emp["URL EXPEDIENTE"]}" target="_blank" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-lg"><i class="fas fa-folder-open"></i></a>` : '-';
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-6 py-4 font-semibold text-slate-800">#${emp["NO. EMPLEADO"]}</td>
                <td class="px-6 py-4 text-slate-700">${emp["NOMBRE DEL TRABAJADOR"]}</td>
                <td class="px-6 py-4 text-slate-500">${emp["EMPRESA"]}</td>
                <td class="px-6 py-4 text-slate-500">${emp["PUESTO"]}</td>
                <td class="px-6 py-4 text-center"><span class="px-3 py-1 text-xs font-bold rounded-full border ${colorBg}">${emp["ESTATUS"]}</span></td>
                <td class="px-6 py-4 text-center text-lg">${iconDir}</td>
            </tr>
        `;
    });
}

async function exportarExcel() {
    const datos = await obtenerDatos();
    if(datos.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BASE DE DATOS");
    XLSX.writeFile(workbook, `GM_Personal_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files;
    if (!file) return;
    mostrarLoader("Procesando Excel...");
    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames], {defval: ""});
        ocultarLoader();
        
        Swal.fire({
            title: 'Carga Masiva', text: `Se detectaron ${json.length} filas. ¿Sincronizar con el maestro?`, icon: 'info', showCancelButton: true, confirmButtonText: 'Sí, sincronizar', confirmButtonColor: '#2563eb'
        }).then(async (result) => {
            if (result.isConfirmed) {
                mostrarLoader("Inyectando datos...");
                try {
                    const resp = await enviarPeticion("importar_masivo", { registros: json });
                    ocultarLoader();
                    if(resp.status === "success") {
                        Swal.fire('Éxito', resp.message, 'success'); cargarDatosTabla();
                    } else Swal.fire('Error', resp.message, 'error');
                } catch (err) { ocultarLoader(); Swal.fire('Error', err.message, 'error'); }
            }
        });
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

let chartEmp = null; let chartGen = null;
async function cargarDashboard() {
    const datos = await obtenerDatos();
    if(datos.length === 0) return;

    let activos = 0, bajas = 0;
    let conteoEmpresas = {};
    let conteoGenero = { "Hombre": 0, "Mujer": 0 };

    datos.forEach(row => {
        if(!row["NO. EMPLEADO"]) return;
        const estatus = row["ESTATUS"];
        const empresa = row["EMPRESA"];
        const genero = row["GÉNERO"];

        if(estatus === "Activo") activos++;
        if(estatus === "Baja") bajas++;

        if(!conteoEmpresas[empresa]) conteoEmpresas[empresa] = { activos: 0, bajas: 0 };
        if(estatus === "Activo") conteoEmpresas[empresa].activos++;
        if(estatus === "Baja") conteoEmpresas[empresa].bajas++;

        if(estatus === "Activo" && (genero === "Hombre" || genero === "Mujer")) conteoGenero[genero]++;
    });

    const total = activos + bajas;
    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-activos').innerText = activos;
    document.getElementById('kpi-bajas').innerText = bajas;
    document.getElementById('kpi-rotacion').innerText = total > 0 ? ((bajas / total) * 100).toFixed(1) + '%' : '0%';

    const ctxEmp = document.getElementById('chartEmpresas').getContext('2d');
    if(chartEmp) chartEmp.destroy();
    chartEmp = new Chart(ctxEmp, {
        type: 'bar',
        data: {
            labels: Object.keys(conteoEmpresas).map(e => e.substring(0,15)+'...'),
            datasets: [
                { label: 'Activos', data: Object.values(conteoEmpresas).map(v => v.activos), backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Bajas', data: Object.values(conteoEmpresas).map(v => v.bajas), backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }
    });

    const ctxGen = document.getElementById('chartGenero').getContext('2d');
    if(chartGen) chartGen.destroy();
    chartGen = new Chart(ctxGen, {
        type: 'doughnut',
        data: { labels: ['Hombres', 'Mujeres'], datasets: [{ data: [conteoGenero["Hombre"], conteoGenero["Mujer"]], backgroundColor: ['#0f172a', '#3b82f6'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });
}

window.onload = () => cargarDashboard();
