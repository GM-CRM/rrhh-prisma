// =========================================================
// URL DE LA API DE GOOGLE APPS SCRIPT (TU BACKEND)
// =========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbz4kQKVf7Q5-SWIMhLgk6y6JgloWbjCdre-RvQ-zLwBw3-bs7pvGUUBw0axutDW9LR12g/exec";

// =========================================================
// CONTROL DE UI Y NAVEGACIÓN
// =========================================================
function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`module-${moduleId}`).classList.add('active');
    
    const titles = {
        'dashboard': 'Análisis de Plantilla',
        'alta': 'Proceso de Onboarding',
        'baja': 'Proceso de Offboarding',
        'basedatos': 'Gestor de Base de Datos'
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

// =========================================================
// GENERACIÓN DINÁMICA DEL FORMULARIO DE ALTA (EVITA OMISIONES)
// =========================================================
const empresas = [
    "Newspot Mexico", "Centro De Telecomunicaciones Y Publicidad De Mexico", "Global Media", 
    "Editora Mexicana", "Cable Master", "Fember Press", "Infomonitor", "RTV Comunicacion", "Radio Expresion Cultural"
];

const camposAlta = [
    { id: "numeroEmpleado", label: "No. Empleado", type: "number", req: true },
    { id: "fechaIngreso", label: "Fecha de Ingreso", type: "date", req: true },
    { id: "nombreTrabajador", label: "Nombre Completo", type: "text", req: true },
    { id: "empresa", label: "Empresa", type: "select", options: empresas, req: true },
    { id: "departamento", label: "Departamento", type: "text", req: true },
    { id: "puesto", label: "Puesto", type: "text", req: true },
    { id: "sueldoMensual", label: "Sueldo Mensual ($)", type: "number", req: true },
    { id: "frecuenciaPago", label: "Frecuencia de Pago", type: "select", options: ["Quincenal", "Semanal", "Mensual"], req: true },
    { id: "fuenteContratacion", label: "Fuente de Contratación", type: "text", req: false },
    { id: "lugarNacimiento", label: "Lugar de Nacimiento", type: "text", req: false },
    { id: "nacionalidad", label: "Nacionalidad", type: "text", req: false },
    { id: "fechaNacimiento", label: "Fecha de Nacimiento", type: "date", req: false },
    { id: "rangoEdad", label: "Rango de Edad", type: "select", options: ["<31", "31-50", "51-65", ">65"], req: false },
    { id: "genero", label: "Género", type: "select", options: ["Hombre", "Mujer", "Otro"], req: false },
    { id: "estadoCivil", label: "Estado Civil", type: "select", options: ["Soltero(a)", "Casado(a)", "Divorciado(a)", "Viudo(a)"], req: false },
    { id: "curp", label: "CURP", type: "text", req: true },
    { id: "rfc", label: "RFC", type: "text", req: true },
    { id: "nss", label: "Número de Seguridad Social (NSS)", type: "text", req: true },
    { id: "domicilioCompleto", label: "Domicilio Completo", type: "text", req: false },
    { id: "escolaridad", label: "Escolaridad", type: "text", req: false },
    { id: "correoElectronico", label: "Correo Electrónico", type: "email", req: false },
    { id: "telefonoPersonal", label: "Teléfono Personal", type: "text", req: false },
    { id: "contactoEmergencia", label: "Contacto de Emergencia", type: "text", req: false },
    { id: "parentesco", label: "Parentesco C.E.", type: "text", req: false },
    { id: "telefonoEmergencia", label: "Teléfono de Emergencia", type: "text", req: false },
    { id: "nombreBeneficiario", label: "Nombre Beneficiario", type: "text", req: false },
    { id: "rfcBeneficiario", label: "RFC Beneficiario", type: "text", req: false },
    { id: "parentescoBeneficiario", label: "Parentesco Benef.", type: "text", req: false },
    { id: "porcentajeAsignacion", label: "% Asignación", type: "number", req: false },
    { id: "tipoIngreso", label: "Tipo de Ingreso", type: "select", options: ["Administrativo", "Operativo"], req: true },
    { id: "tipoContrato", label: "Tipo de Contrato", type: "select", options: ["Tiempo Indeterminado", "Prueba", "Temporal"], req: true },
    { id: "fechaInicioContrato", label: "Inicio Primer Contrato", type: "date", req: false },
    { id: "entrevista15Dias", label: "Entrevista 15 Días (Sí/No)", type: "text", req: false },
    { id: "entrevista45Dias", label: "Entrevista 45 Días (Sí/No)", type: "text", req: false },
    { id: "vencimientoPrimerContrato", label: "Vencimiento Contrato", type: "date", req: false }
];

function renderizarFormularioAlta() {
    const form = document.getElementById('formAlta');
    form.innerHTML = '';
    camposAlta.forEach(campo => {
        let inputHtml = '';
        const reqStr = campo.req ? 'required' : '';
        const reqStar = campo.req ? '<span class="text-red-500">*</span>' : '';
        const baseClasses = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition";

        if (campo.type === 'select') {
            let options = `<option value="">Seleccione...</option>`;
            campo.options.forEach(opt => options += `<option value="${opt}">${opt}</option>`);
            inputHtml = `<select id="alta_${campo.id}" ${reqStr} class="${baseClasses}">${options}</select>`;
        } else {
            inputHtml = `<input type="${campo.type}" id="alta_${campo.id}" ${reqStr} class="${baseClasses}">`;
        }

        form.innerHTML += `
            <div class="flex flex-col">
                <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">${campo.label} ${reqStar}</label>
                ${inputHtml}
            </div>
        `;
    });
}
renderizarFormularioAlta();

// =========================================================
// FUNCIONES DE COMUNICACIÓN CON EL BACKEND (API REST)
// =========================================================

async function enviarPeticion(action, payload) {
    const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload }),
        headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });
    return await response.json();
}

async function procesarAlta(event) {
    event.preventDefault();
    mostrarLoader("Creando Expediente en Drive y guardando datos...");
    
    let payload = {};
    camposAlta.forEach(campo => {
        payload[campo.id] = document.getElementById(`alta_${campo.id}`).value;
    });

    try {
        const result = await enviarPeticion("alta", payload);
        ocultarLoader();
        if(result.status === "success") {
            Swal.fire({
                title: '¡Alta Exitosa!',
                html: `${result.message}<br><br><a href="${result.urlExpediente}" target="_blank" class="text-blue-600 underline border rounded p-2 inline-block mt-2"><i class="fas fa-folder-open"></i> Abrir Expediente Digital</a>`,
                icon: 'success'
            });
            document.getElementById('formAlta').reset();
        } else {
            Swal.fire('Error', result.message, 'error');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de conexión', e.toString(), 'error');
    }
}

async function procesarBaja(event) {
    event.preventDefault();
    mostrarLoader("Procesando baja en el sistema...");
    
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
            Swal.fire('¡Baja Procesada!', result.message, 'success');
            document.getElementById('formBaja').reset();
        } else {
            Swal.fire('Atención', result.message, 'warning');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de conexión', e.toString(), 'error');
    }
}

// =========================================================
// FUNCIONES DE EXPORTACIÓN, IMPORTACIÓN Y DASHBOARD
// =========================================================

let cacheDatos = [];

async function obtenerDatos() {
    mostrarLoader("Obteniendo datos de la nube...");
    try {
        const result = await enviarPeticion("exportar_datos", {});
        ocultarLoader();
        if(result.status === "success") {
            cacheDatos = result.data;
            return cacheDatos;
        } else {
            Swal.fire('Error', result.message, 'error');
            return [];
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de conexión', e.toString(), 'error');
        return [];
    }
}

async function exportarExcel() {
    const datos = await obtenerDatos();
    if(datos.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BASE DE DATOS");
    
    const fecha = new Date().toISOString().slice(0,10);
    XLSX.writeFile(workbook, `Respaldo_GrupoMultimedia_${fecha}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files;
    if (!file) return;

    mostrarLoader("Leyendo archivo Excel...");
    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames; // Toma la primera pestaña
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
        
        ocultarLoader();
        
        Swal.fire({
            title: 'Confirmar Sincronización',
            text: `Se leyeron ${json.length} filas del archivo. ¿Deseas inyectarlas al sistema maestro?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, sincronizar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                mostrarLoader("Actualizando Base de Datos Maestra...");
                try {
                    const resp = await enviarPeticion("importar_masivo", { registros: json });
                    ocultarLoader();
                    if(resp.status === "success") {
                        Swal.fire('Sincronización Exitosa', resp.message, 'success');
                        cargarDatosTabla(); // Refrescar vista
                    } else {
                        Swal.fire('Error', resp.message, 'error');
                    }
                } catch (err) {
                    ocultarLoader();
                    Swal.fire('Error', err.toString(), 'error');
                }
            }
        });
        
        // Limpiar input
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

async function cargarDatosTabla() {
    const datos = await obtenerDatos();
    const tbody = document.getElementById('tabla-directorio');
    tbody.innerHTML = '';
    
    // Mostrar solo los últimos 50 registros para no saturar el DOM, o los activos
    const datosMostrar = datos.slice(-50).reverse(); 

    datosMostrar.forEach(emp => {
        if(!emp["NO. EMPLEADO"]) return; // Ignorar filas vacías
        const colorEstatus = emp["ESTATUS"] === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
        const linkExpediente = emp["URL EXPEDIENTE"] ? `<a href="${emp["URL EXPEDIENTE"]}" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-external-link-alt"></i></a>` : '-';
        
        tbody.innerHTML += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-6 py-4 font-medium text-gray-900">${emp["NO. EMPLEADO"]}</td>
                <td class="px-6 py-4">${emp["NOMBRE DEL TRABAJADOR"]}</td>
                <td class="px-6 py-4">${emp["EMPRESA"]}</td>
                <td class="px-6 py-4">${emp["PUESTO"]}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${colorEstatus}">${emp["ESTATUS"]}</span></td>
                <td class="px-6 py-4 text-center text-lg">${linkExpediente}</td>
            </tr>
        `;
    });
}

// Variables para Chart.js
let chartEmp = null;
let chartGen = null;

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

        if(estatus === "Activo" && (genero === "Hombre" || genero === "Mujer")) {
            conteoGenero[genero]++;
        }
    });

    const total = activos + bajas;
    const rotacion = total > 0 ? ((bajas / total) * 100).toFixed(1) : 0;

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-activos').innerText = activos;
    document.getElementById('kpi-bajas').innerText = bajas;
    document.getElementById('kpi-rotacion').innerText = rotacion + '%';

    // Gráfica de Empresas
    const ctxEmp = document.getElementById('chartEmpresas').getContext('2d');
    if(chartEmp) chartEmp.destroy();
    
    chartEmp = new Chart(ctxEmp, {
        type: 'bar',
        data: {
            labels: Object.keys(conteoEmpresas),
            datasets: [
                { label: 'Activos', data: Object.values(conteoEmpresas).map(v => v.activos), backgroundColor: '#3b82f6' },
                { label: 'Bajas', data: Object.values(conteoEmpresas).map(v => v.bajas), backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // Gráfica de Género
    const ctxGen = document.getElementById('chartGenero').getContext('2d');
    if(chartGen) chartGen.destroy();
    
    chartGen = new Chart(ctxGen, {
        type: 'doughnut',
        data: {
            labels: ['Hombres', 'Mujeres'],
            datasets: [{
                data: [conteoGenero["Hombre"], conteoGenero["Mujer"]],
                backgroundColor: ['#1f2937', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Iniciar cargando el dashboard
window.onload = () => {
    cargarDashboard();
};
