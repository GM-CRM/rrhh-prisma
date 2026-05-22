// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Frontend Logic
//  Versión: 2.0 — Bugs críticos corregidos (Rafael)
//  Correcciones aplicadas:
//    1. Base64: split(',')[1] para enviar solo el string puro al GAS
//    2. Género: conteo unificado con valores canónicos del Sheet
//    3. Cache: forzarActualizacion() limpia cacheGlobal
//    4. URL Expediente: referenciada por columna "URL EXPEDIENTE"
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";

// ------------------------------------------------------------
//  UI — Sidebar y navegación
// ------------------------------------------------------------
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function showModule(moduleId) {
    document.querySelectorAll('.module-section').forEach(sec => {
        sec.classList.remove('active');
        setTimeout(() => { sec.style.display = 'none'; }, 300);
    });
    const target = document.getElementById(`module-${moduleId}`);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);

    const titulos = {
        'dashboard':  'Dashboard Directivo',
        'alta':       'Onboarding',
        'baja':       'Offboarding',
        'basedatos':  'Directorio Maestro'
    };
    document.getElementById('header-title').innerText = titulos[moduleId] || moduleId;

    if (window.innerWidth < 768) toggleMenu();
}

function mostrarLoader(texto = "Procesando...") {
    document.getElementById('loader-text').innerText = texto;
    document.getElementById('global-loader').style.display = 'flex';
}

function ocultarLoader() {
    document.getElementById('global-loader').style.display = 'none';
}

// ------------------------------------------------------------
//  CATÁLOGOS Y CAMPOS DEL FORMULARIO DE ALTA
//  Mapeados a las 50 columnas reales del Sheet
// ------------------------------------------------------------
const empresas = [
    "Newspot Mexico",
    "Centro De Telecomunicaciones Y Publicidad De Mexico",
    "Global Media",
    "Editora Mexicana",
    "Cable Master",
    "Fember Press",
    "Infomonitor",
    "Rtv Comunicacion",
    "Radio Expresion Cultural"
];

// Campos base — los 39 campos de captura original
const camposAlta = [
    // --- Datos laborales obligatorios ---
    { id: "numeroEmpleado",             label: "No. Empleado",                      type: "number",  req: true  },
    { id: "fechaIngreso",               label: "Fecha de Ingreso",                  type: "date",    req: true  },
    { id: "nombreTrabajador",           label: "Nombre Completo",                   type: "text",    req: true  },
    { id: "empresa",                    label: "Empresa",                           type: "select",  options: empresas, req: true },
    { id: "departamento",               label: "Departamento",                      type: "text",    req: true  },
    { id: "puesto",                     label: "Puesto",                            type: "text",    req: true  },
    { id: "sueldoMensual",              label: "Sueldo Mensual",                    type: "number",  req: true  },
    { id: "frecuenciaPago",             label: "Frecuencia de Pago",                type: "select",  options: ["Quincenal", "Semanal", "Mensual"], req: true },
    { id: "tipoIngreso",                label: "Tipo de Ingreso",                   type: "select",  options: ["Administrativo", "Operativo"], req: true },
    { id: "tipoContrato",               label: "Tipo de Contrato",                  type: "select",  options: ["Tiempo Indeterminado", "Prueba", "Temporal"], req: true },
    // --- Datos personales ---
    { id: "curp",                       label: "CURP",                              type: "text",    req: true  },
    { id: "rfc",                        label: "RFC",                               type: "text",    req: true  },
    { id: "nss",                        label: "NSS",                               type: "text",    req: true  },
    { id: "fuenteContratacion",         label: "Fuente de Contratación",            type: "text",    req: false },
    { id: "lugarNacimiento",            label: "Lugar de Nacimiento",               type: "text",    req: false },
    { id: "nacionalidad",               label: "Nacionalidad",                      type: "text",    req: false },
    { id: "fechaNacimiento",            label: "Fecha de Nacimiento",               type: "date",    req: false },
    { id: "rangoEdad",                  label: "Rango de Edad",                     type: "select",  options: ["<31", "31-50", "51-65", ">65"], req: false },
    { id: "genero",                     label: "Género",                            type: "select",  options: ["Hombre", "Mujer"], req: false },
    { id: "estadoCivil",                label: "Estado Civil",                      type: "select",  options: ["Soltero", "Casado", "Divorciado", "Viudo", "Unión Libre"], req: false },
    { id: "domicilioCompleto",          label: "Domicilio Completo",                type: "text",    req: false },
    { id: "escolaridad",                label: "Escolaridad",                       type: "text",    req: false },
    { id: "correoElectronico",          label: "Correo Electrónico",                type: "email",   req: false },
    { id: "telefonoPersonal",           label: "Teléfono Personal",                 type: "text",    req: false },
    // --- Contacto de emergencia ---
    { id: "contactoEmergencia",         label: "Nombre Contacto Emergencia",        type: "text",    req: false },
    { id: "parentesco",                 label: "Parentesco Contacto",               type: "text",    req: false },
    { id: "telefonoEmergencia",         label: "Teléfono Emergencia",               type: "text",    req: false },
    // --- Beneficiario ---
    { id: "nombreBeneficiario",         label: "Nombre del Beneficiario",           type: "text",    req: false },
    { id: "rfcBeneficiario",            label: "RFC del Beneficiario",              type: "text",    req: false },
    { id: "parentescoBeneficiario",     label: "Parentesco Beneficiario",           type: "text",    req: false },
    { id: "porcentajeAsignacion",       label: "% Asignación",                      type: "number",  req: false },
    // --- Contratos ---
    { id: "fechaInicioContrato",        label: "Inicio del Primer Contrato",        type: "date",    req: false },
    { id: "vencimientoPrimerContrato",  label: "Vencimiento 1er Contrato",          type: "date",    req: false },
    // --- Entrevistas de seguimiento ---
    { id: "entrevista15Dias",           label: "Entrevista 15 Días",                type: "select",  options: ["Sí", "No"], req: false },
    { id: "entrevista45Dias",           label: "Entrevista 45 Días",                type: "select",  options: ["Sí", "No"], req: false },
];

// ------------------------------------------------------------
//  RENDERIZAR FORMULARIO DE ALTA DINÁMICAMENTE
// ------------------------------------------------------------
function renderizarFormularioAlta() {
    const form = document.getElementById('formAlta');
    form.innerHTML = '';

    camposAlta.forEach(c => {
        let inputHtml;
        if (c.type === 'select') {
            const opciones = c.options.map(o => `<option value="${o}">${o}</option>`).join('');
            inputHtml = `<select id="alta_${c.id}" ${c.req ? 'required' : ''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                           <option value="">Seleccione...</option>${opciones}
                         </select>`;
        } else {
            inputHtml = `<input type="${c.type}" id="alta_${c.id}" ${c.req ? 'required' : ''} class="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">`;
        }

        const asterisco = c.req ? '<span class="text-red-500">*</span>' : '';
        form.innerHTML += `
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              ${c.label} ${asterisco}
            </label>
            ${inputHtml}
          </div>`;
    });
}
renderizarFormularioAlta();

// ------------------------------------------------------------
//  COMUNICACIÓN CON EL BACKEND (GAS)
// ------------------------------------------------------------
async function enviarPeticion(action, payload) {
    const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action, payload })
    });
    return await res.json();
}

// ------------------------------------------------------------
//  ALTA — Procesar formulario + subida de archivos
//  BUG FIX: Base64 = split(',')[1]  para enviar solo el string puro
// ------------------------------------------------------------
async function procesarAlta(event) {
    event.preventDefault();
    mostrarLoader("Creando expediente y subiendo documentos...");

    // Recopilar todos los campos del formulario
    let payload = {};
    camposAlta.forEach(c => {
        payload[c.id] = document.getElementById(`alta_${c.id}`).value;
    });

    // Procesar archivos adjuntos
    const fileInput = document.getElementById('alta_archivos');
    let docsBase64  = [];

    if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];

            // Validar tamaño: GAS tiene límite de ~50MB por request total
            if (file.size > 10 * 1024 * 1024) {
                ocultarLoader();
                Swal.fire('Archivo demasiado grande', `"${file.name}" supera 10 MB. Reduce el tamaño o comprime el archivo.`, 'warning');
                return;
            }

            // BUG FIX: split(',')[1] extrae SOLO el string Base64 puro
            // FileReader devuelve: "data:application/pdf;base64,XXXXXXXXXX..."
            // GAS necesita solo la parte después de la coma
            const base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error(`Error leyendo ${file.name}`));
                reader.readAsDataURL(file);
            });

            docsBase64.push({
                nombreArchivo: file.name,
                mimeType:      file.type || 'application/octet-stream',
                data:          base64String   // string puro, sin prefijo
            });
        }
    }

    payload.documentos = docsBase64;

    try {
        const r = await enviarPeticion("alta", payload);
        ocultarLoader();

        if (r.status === "success") {
            Swal.fire({
                icon:             'success',
                title:            '¡Alta registrada!',
                text:             r.message,
                confirmButtonText:'Ver expediente',
                showCancelButton: true,
                cancelButtonText: 'Cerrar'
            }).then(result => {
                if (result.isConfirmed && r.urlExpediente) {
                    window.open(r.urlExpediente, '_blank');
                }
            });
            document.getElementById('formAlta').reset();
            fileInput.value = '';
            forzarActualizacion();
        } else {
            Swal.fire('Error en el alta', r.message, 'error');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de conexión', e.message, 'error');
    }
}

// ------------------------------------------------------------
//  BAJA — Procesar offboarding
// ------------------------------------------------------------
async function procesarBaja(event) {
    event.preventDefault();
    mostrarLoader("Procesando baja del colaborador...");

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
            Swal.fire('No se pudo registrar la baja', r.message, 'warning');
        }
    } catch (e) {
        ocultarLoader();
        Swal.fire('Error de conexión', e.message, 'error');
    }
}

// ------------------------------------------------------------
//  CACHÉ GLOBAL DE DATOS
// ------------------------------------------------------------
let cacheGlobal = [];

async function obtenerDatos(forzar = false) {
    if (!forzar && cacheGlobal.length > 0) return cacheGlobal;

    mostrarLoader("Sincronizando base de datos...");
    try {
        const r = await enviarPeticion("exportar_datos", {});
        ocultarLoader();
        if (r.status === "success") {
            // Filtrar filas vacías generadas por Excel al importar
            cacheGlobal = r.data.filter(emp =>
                emp["NO. EMPLEADO"] &&
                emp["NO. EMPLEADO"].toString().trim() !== ""
            );
            return cacheGlobal;
        }
        return [];
    } catch (e) {
        ocultarLoader();
        console.error("Error al obtener datos:", e);
        return [];
    }
}

async function forzarActualizacion() {
    cacheGlobal = []; // Limpiar caché antes de recargar
    const datos = await obtenerDatos(true);
    cargarDashboard();
    // Si el directorio está activo, recargarlo también
    const secBD = document.getElementById('module-basedatos');
    if (secBD && secBD.classList.contains('active')) {
        renderizarPagina(1);
    }
    return datos;
}

// ------------------------------------------------------------
//  DIRECTORIO MAESTRO — Tabla con paginación básica
// ------------------------------------------------------------
let paginaActual   = 1;
const FILAS_PAGINA = 50;

async function cargarDatosTabla() {
    await obtenerDatos();
    paginaActual = 1;
    renderizarPagina(paginaActual);
}

function renderizarPagina(pagina) {
    const datos        = cacheGlobal;
    const totalPaginas = Math.ceil(datos.length / FILAS_PAGINA);
    paginaActual       = Math.max(1, Math.min(pagina, totalPaginas));

    const inicio = (paginaActual - 1) * FILAS_PAGINA;
    const fin    = inicio + FILAS_PAGINA;
    const slice  = datos.slice(inicio, fin);

    const tbody = document.getElementById('tabla-directorio');
    tbody.innerHTML = '';

    slice.forEach(emp => {
        const estatus = emp["ESTATUS"] ? emp["ESTATUS"].trim() : "";
        const color   = estatus === "Activo"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700";

        // BUG FIX: URL Expediente referenciada por nombre de columna exacto
        const urlExpediente = emp["URL EXPEDIENTE"] || emp["SE TOMA EN CUENTA?"] || "";
        const link = urlExpediente
            ? `<a href="${urlExpediente}" target="_blank" class="text-blue-500 hover:text-blue-700" title="Abrir carpeta en Drive"><i class="fas fa-folder-open"></i></a>`
            : '<span class="text-slate-300">—</span>';

        tbody.innerHTML += `
          <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
            <td class="px-6 py-4 font-semibold text-slate-700">#${emp["NO. EMPLEADO"] || "—"}</td>
            <td class="px-6 py-4">${emp["NOMBRE DEL TRABAJADOR"] || "—"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${emp["EMPRESA"] || "—"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${emp["PUESTO"] || "—"}</td>
            <td class="px-6 py-4">
              <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${color}">${estatus || "—"}</span>
            </td>
            <td class="px-6 py-4 text-center">${link}</td>
          </tr>`;
    });

    // Renderizar controles de paginación
    actualizarPaginacion(paginaActual, totalPaginas, datos.length);
}

function actualizarPaginacion(pagina, totalPaginas, totalRegistros) {
    const contenedor = document.getElementById('paginacion-directorio');
    if (!contenedor) return;

    const inicio = (pagina - 1) * FILAS_PAGINA + 1;
    const fin    = Math.min(pagina * FILAS_PAGINA, totalRegistros);

    contenedor.innerHTML = `
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <span class="text-sm text-slate-500">
          Mostrando <strong>${inicio}–${fin}</strong> de <strong>${totalRegistros}</strong> registros
        </span>
        <div class="flex gap-2">
          <button onclick="renderizarPagina(${pagina - 1})"
            ${pagina <= 1 ? 'disabled' : ''}
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
            ← Anterior
          </button>
          <span class="px-3 py-1.5 text-sm font-medium text-slate-700">
            ${pagina} / ${totalPaginas}
          </span>
          <button onclick="renderizarPagina(${pagina + 1})"
            ${pagina >= totalPaginas ? 'disabled' : ''}
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
            Siguiente →
          </button>
        </div>
      </div>`;
}

// ------------------------------------------------------------
//  DASHBOARD — KPIs y gráficas
// ------------------------------------------------------------
let chartEmpresas = null;
let chartGenero   = null;

async function cargarDashboard() {
    const datosCompletos = await obtenerDatos();
    const filtroEmpresa  = document.getElementById('filtroEmpresaGlobal').value;

    const datosFiltrados = filtroEmpresa === "ALL"
        ? datosCompletos
        : datosCompletos.filter(r => r["EMPRESA"] && r["EMPRESA"].trim() === filtroEmpresa);

    let activos = 0, bajas = 0;
    let conteoEmpresas = {};
    // BUG FIX: valores canónicos según el Sheet real ("Hombre"/"Mujer")
    let conteoGenero   = { "Hombre": 0, "Mujer": 0 };

    datosFiltrados.forEach(row => {
        const estatus = row["ESTATUS"] ? row["ESTATUS"].trim() : "";
        const genero  = row["GÉNERO"] ? row["GÉNERO"].trim() : "";
        const empresa = row["EMPRESA"] ? row["EMPRESA"].trim() : "Sin Empresa";

        if (estatus === "Activo") {
            activos++;
            // Unificar variaciones históricas del campo género
            if (genero === "Hombre" || genero === "Masculino") conteoGenero["Hombre"]++;
            else if (genero === "Mujer" || genero === "Femenino") conteoGenero["Mujer"]++;
        }
        if (estatus === "Baja") bajas++;

        if (!conteoEmpresas[empresa]) conteoEmpresas[empresa] = { act: 0, baj: 0 };
        if (estatus === "Activo") conteoEmpresas[empresa].act++;
        if (estatus === "Baja")   conteoEmpresas[empresa].baj++;
    });

    const total = activos + bajas;

    // KPIs
    document.getElementById('kpi-total').innerText    = total;
    document.getElementById('kpi-activos').innerText  = activos;
    document.getElementById('kpi-bajas').innerText    = bajas;
    document.getElementById('kpi-rotacion').innerText = total > 0
        ? ((bajas / total) * 100).toFixed(1) + '%'
        : '0%';

    // Gráfica de barras — por empresa
    const ctxE = document.getElementById('chartEmpresas').getContext('2d');
    if (chartEmpresas) chartEmpresas.destroy();

    const labelsEmpresas = Object.keys(conteoEmpresas).map(e =>
        e.length > 18 ? e.substring(0, 18) + '…' : e
    );

    chartEmpresas = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: labelsEmpresas,
            datasets: [
                { label: 'Activos', data: Object.values(conteoEmpresas).map(v => v.act), backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Bajas',   data: Object.values(conteoEmpresas).map(v => v.baj), backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });

    // Gráfica de dona — por género
    const ctxG = document.getElementById('chartGenero').getContext('2d');
    if (chartGenero) chartGenero.destroy();

    chartGenero = new Chart(ctxG, {
        type: 'doughnut',
        data: {
            labels: ['Hombres', 'Mujeres'],
            datasets: [{
                data: [conteoGenero["Hombre"], conteoGenero["Mujer"]],
                backgroundColor: ['#0f172a', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// ------------------------------------------------------------
//  EXPORTAR / IMPORTAR EXCEL
// ------------------------------------------------------------
async function exportarExcel() {
    const datos = await obtenerDatos();
    if (datos.length === 0) {
        Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BASE DE DATOS");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `GM_Respaldo_${fecha}.xlsx`);
}

function importarExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    mostrarLoader("Leyendo archivo Excel...");
    const reader = new FileReader();

    reader.onload = async (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const hoja     = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRaw  = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        // Filtrar filas vacías
        const jsonFiltrado = jsonRaw.filter(r =>
            r["NO. EMPLEADO"] && r["NO. EMPLEADO"].toString().trim() !== ""
        );

        ocultarLoader();

        const { isConfirmed } = await Swal.fire({
            title:             'Confirmar importación masiva',
            html:              `Se procesarán <strong>${jsonFiltrado.length} filas válidas</strong> del archivo <em>${file.name}</em>.<br><br>Los registros existentes se actualizarán (por No. Empleado). Los nuevos se insertarán.`,
            icon:              'question',
            showCancelButton:  true,
            confirmButtonText: 'Sí, importar',
            cancelButtonText:  'Cancelar'
        });

        if (isConfirmed) {
            mostrarLoader("Inyectando datos en la base maestra...");
            try {
                const res = await enviarPeticion("importar_masivo", { registros: jsonFiltrado });
                ocultarLoader();
                Swal.fire('Importación completa', res.message, 'success');
                forzarActualizacion();
            } catch (err) {
                ocultarLoader();
                Swal.fire('Error en la importación', err.message, 'error');
            }
        }

        event.target.value = '';
    };

    reader.onerror = () => {
        ocultarLoader();
        Swal.fire('Error', 'No se pudo leer el archivo Excel.', 'error');
    };

    reader.readAsArrayBuffer(file);
}

// ------------------------------------------------------------
//  INICIALIZACIÓN
// ------------------------------------------------------------
window.onload = () => {
    cargarDashboard();
};
