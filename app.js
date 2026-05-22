// ============================================================
//  GRUPO MULTIMEDIA — Sistema RH | Frontend v5.0
// ============================================================
const API_URL    = "https://script.google.com/macros/s/AKfycbzZ1izlOXEasq80AVLH6BiYhXSvTVwDytEFqLJ-TWfFlXlnw2Kf6zNqy0Us2jFEHo4YcQ/exec";
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MOD = "claude-sonnet-4-20250514";

// ─── UI ──────────────────────────────────────────────────────
function toggleMenu(){document.getElementById('sidebar').classList.toggle('-translate-x-full');document.getElementById('sidebar-overlay').classList.toggle('hidden');}
function activarNav(btn){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('is-active'));btn.classList.add('is-active');}
function showModule(id){
    document.querySelectorAll('.module-section').forEach(s=>{s.classList.remove('active');s.style.display='none';});
    const t=document.getElementById('module-'+id);if(!t)return;
    t.style.display='block';
    requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('active')));
    document.getElementById('header-title').innerText={dashboard:'Dashboard Directivo',alta:'Onboarding — Alta',baja:'Offboarding',basedatos:'Directorio Maestro'}[id]||id;
    if(window.innerWidth<768)toggleMenu();
}
function mostrarLoader(t){document.getElementById('loader-text').innerText=t||'Procesando...';document.getElementById('global-loader').style.display='flex';}
function ocultarLoader(){document.getElementById('global-loader').style.display='none';}

// ─── CATÁLOGOS ───────────────────────────────────────────────
const empresas=["Newspot Mexico","Centro De Telecomunicaciones Y Publicidad De Mexico","Global Media","Editora Mexicana","Cable Master","Fember Press","Infomonitor","Rtv Comunicacion","Radio Expresion Cultural"];

// ─── PARSERS ROBUSTOS PARA IMPORTACIÓN ───────────────────────
// Convierte cualquier formato de fecha a YYYY-MM-DD para el Sheet.
function parsearFecha(val) {
    if (!val) return "";
    var s = val.toString().trim();
    // Ya en formato correcto
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY o DD-MM-YYYY
    var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    // MM/DD/YYYY (formato US)
    var m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m2) {
        var yr = m2[3].length===2 ? '20'+m2[3] : m2[3];
        return yr+'-'+m2[1].padStart(2,'0')+'-'+m2[2].padStart(2,'0');
    }
    // Número serial de Excel (días desde 1900-01-01)
    var n = parseFloat(s);
    if (!isNaN(n) && n > 10000 && n < 100000) {
        var d = new Date((n - 25569) * 86400 * 1000);
        if (!isNaN(d)) return d.toISOString().slice(0,10);
    }
    // Intentar parse nativo
    var d2 = new Date(s);
    if (!isNaN(d2)) return d2.toISOString().slice(0,10);
    return s; // devolver tal cual si no se pudo parsear
}

// Convierte cualquier formato de monto a número limpio.
function parsearMonto(val) {
    if (!val && val !== 0) return "";
    var s = val.toString().replace(/[$\s,]/g,"").replace(/\.(?=.*\.)/g,""); // quitar $ y separadores de miles
    var n = parseFloat(s);
    return isNaN(n) ? "" : n;
}

// Normaliza un registro completo antes de enviarlo al GAS.
// Aplica parsearFecha en campos de fecha, parsearMonto en campos de dinero.
const CAMPOS_FECHA = ["FECHA DE INGRESO","FECHA DE BAJA","FECHA DE NACIMIENTO","INICIO DEL PRIMER CONTRATO",
    "FECHA DE VENCIMIENTO DEL PRIMER CONTRATO","INICIO DEL SEGUNDO CONTRATO","FECHA DE VENCIMIENTO DEL SEGUNDO CONTRATO",
    "INICIO DEL TERCER CONTRATO","FECHA DE VENCIMIENTO DEL TERCER CONTRATO","FECHA EVALUACIÓN 360"];
const CAMPOS_MONTO = ["SUELDO MENSUAL","MONTO DE FINIQUITO"];

function normalizarRegistro(emp) {
    var out = Object.assign({}, emp);
    CAMPOS_FECHA.forEach(function(k){ if(out[k]!==undefined) out[k]=parsearFecha(out[k]); });
    CAMPOS_MONTO.forEach(function(k){ if(out[k]!==undefined) out[k]=parsearMonto(out[k]); });
    return out;
}

// ─── STEPPER ONBOARDING ──────────────────────────────────────
const PASOS=[
    {id:'paso-empleo',titulo:'Datos Laborales',icono:'fa-briefcase',color:'blue',descripcion:'Información del puesto y contratación',campos:[
        {id:"numeroEmpleado",     label:"No. de Empleado",       type:"number", req:true,  col:2, autonum:true},
        {id:"fechaIngreso",       label:"Fecha de Ingreso",       type:"date",   req:true,  col:2},
        {id:"nombreTrabajador",   label:"Nombre Completo",        type:"text",   req:true,  col:2, placeholder:"Apellido Paterno Materno Nombre(s)"},
        {id:"empresa",            label:"Empresa",                type:"select", req:true,  col:2, options:empresas},
        {id:"departamento",       label:"Departamento",           type:"text",   req:true,  col:2},
        {id:"puesto",             label:"Puesto",                 type:"text",   req:true,  col:2},
        {id:"tipoIngreso",        label:"Tipo de Ingreso",        type:"select", req:true,  col:2, options:["Administrativo","Operativo"]},
        {id:"sueldoMensual",      label:"Sueldo Mensual (MXN)",   type:"number", req:true,  col:2, placeholder:"0.00"},
        {id:"frecuenciaPago",     label:"Frecuencia de Pago",     type:"select", req:true,  col:2, options:["Quincenal","Semanal","Mensual"]},
        {id:"fuenteContratacion", label:"Fuente de Contratación", type:"text",   req:false, col:2, placeholder:"Ej. Referido, OCC, LinkedIn..."},
    ]},
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
    {id:'paso-personal',titulo:'Datos Personales',icono:'fa-id-card',color:'teal',descripcion:'Información personal y documentos legales',campos:[
        {id:"curp",             label:"CURP",                type:"text",    req:true, col:2,placeholder:"18 caracteres",maxlen:18},
        {id:"rfc",              label:"RFC",                 type:"text",    req:true, col:2,placeholder:"13 caracteres",maxlen:13},
        {id:"nss",              label:"NSS",                 type:"text",    req:true, col:2,placeholder:"11 dígitos",   maxlen:11},
        {id:"fechaNacimiento",  label:"Fecha de Nacimiento", type:"date",    req:false,col:2},
        {id:"rangoEdad",        label:"Rango de Edad",       type:"select",  req:false,col:2,options:["<31","31-50","51-65",">65"],readonly:true},
        {id:"genero",           label:"Género",              type:"select",  req:false,col:2,options:["Hombre","Mujer"]},
        {id:"estadoCivil",      label:"Estado Civil",        type:"select",  req:false,col:2,options:["Soltero","Casado","Divorciado","Viudo","Unión Libre"]},
        {id:"escolaridad",      label:"Escolaridad",         type:"text",    req:false,col:2},
        {id:"lugarNacimiento",  label:"Lugar de Nacimiento", type:"text",    req:false,col:2},
        {id:"nacionalidad",     label:"Nacionalidad",        type:"text",    req:false,col:2,placeholder:"Ej. Mexicana"},
        {id:"domicilioCompleto",label:"Domicilio Completo",  type:"textarea",req:false,col:1,placeholder:"Calle, Número, Colonia, CP, Ciudad, Estado"},
    ]},
    {id:'paso-contacto',titulo:'Contacto',icono:'fa-phone',color:'cyan',descripcion:'Datos de contacto y emergencias',campos:[
        {id:"correoElectronico",  label:"Correo Electrónico",            type:"email",req:false,col:2},
        {id:"telefonoPersonal",   label:"Teléfono Personal",             type:"text", req:false,col:2,placeholder:"10 dígitos"},
        {id:"contactoEmergencia", label:"Nombre — Contacto Emergencia",  type:"text", req:false,col:2},
        {id:"parentesco",         label:"Parentesco",                    type:"text", req:false,col:2},
        {id:"telefonoEmergencia", label:"Teléfono Emergencia",           type:"text", req:false,col:2},
    ]},
    {id:'paso-beneficiario',titulo:'Beneficiario',icono:'fa-heart',color:'rose',descripcion:'Datos del beneficiario IMSS',campos:[
        {id:"nombreBeneficiario",    label:"Nombre del Beneficiario",type:"text",  req:false,col:2},
        {id:"rfcBeneficiario",       label:"RFC del Beneficiario",   type:"text",  req:false,col:2},
        {id:"parentescoBeneficiario",label:"Parentesco",             type:"text",  req:false,col:2},
        {id:"porcentajeAsignacion",  label:"% de Asignación",        type:"number",req:false,col:2,placeholder:"100"},
    ]},
    {id:'paso-documentos',titulo:'Documentos',icono:'fa-folder-open',color:'amber',descripcion:'Expediente digital y análisis IA',campos:[]}
];

let pasoActual=0, altaData={};

// ─── STEPPER RENDER ───────────────────────────────────────────
function renderizarStepper(){
    var barra=document.getElementById('stepper-barra');
    barra.innerHTML=PASOS.map(function(p,i){
        var hecho=i<pasoActual,activo=i===pasoActual;
        var dot=hecho?'bg-emerald-500 text-white':activo?'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-2':'bg-slate-100 text-slate-400';
        var ic=hecho?'fa-check':p.icono;
        var tc=hecho?'text-emerald-600':activo?'text-blue-600':'text-slate-400';
        var linea=i<PASOS.length-1?'<div class="flex-1 h-0.5 mx-2 rounded '+(hecho?'bg-emerald-400':'bg-slate-200')+'"></div>':'';
        return '<div class="flex items-center flex-1 min-w-0"><button onclick="irAPaso('+i+')" class="flex flex-col items-center gap-1 flex-shrink-0" title="'+p.titulo+'"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all '+dot+'"><i class="fas '+ic+' text-xs"></i></div><span class="text-xs font-medium hidden md:block whitespace-nowrap '+tc+'">'+p.titulo+'</span></button>'+linea+'</div>';
    }).join('');
    renderizarPasoActual();
    actualizarBotones();
    var ind=document.getElementById('paso-indicador');
    if(ind) ind.innerText='Paso '+(pasoActual+1)+' de '+PASOS.length;
}

function renderizarPasoActual(){
    var paso=PASOS[pasoActual];
    var el=document.getElementById('stepper-contenido');

    if(paso.id==='paso-documentos'){
        el.innerHTML=`
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-4">
            <!-- OCR -->
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-wand-magic-sparkles text-amber-600 text-sm"></i>
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-800">Análisis Inteligente con IA</p>
                  <p class="text-xs text-slate-500">Extrae datos automáticamente de documentos escaneados</p>
                </div>
              </div>
              <input type="file" id="alta_archivos" multiple accept=".pdf,.jpg,.jpeg,.png"
                class="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer transition mb-3">
              <div id="lista-archivos" class="space-y-1.5 mb-3"></div>
              <button onclick="ejecutarOCR()" id="btn-ocr"
                class="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                <i class="fas fa-magnifying-glass"></i> Analizar documentos con IA
              </button>
              <div id="ocr-status" class="mt-3 hidden">
                <div class="flex items-center gap-2 text-xs text-slate-500">
                  <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <span id="ocr-status-txt">Analizando...</span>
                </div>
              </div>
            </div>
            <!-- CURP lookup -->
            <div class="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-id-badge text-blue-600 text-sm"></i>
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-800">Búsqueda por CURP</p>
                  <p class="text-xs text-slate-500">Extrae datos del CURP capturado en el paso anterior</p>
                </div>
              </div>
              <button onclick="buscarCURP()" id="btn-curp"
                class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                <i class="fas fa-search"></i> Extraer datos del CURP
              </button>
              <div id="curp-resultado" class="mt-3 hidden space-y-1.5"></div>
            </div>
          </div>
          <!-- Resumen -->
          <div class="bg-white border border-slate-200 rounded-2xl p-5">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <i class="fas fa-clipboard-list"></i> Resumen del Alta
            </p>
            <div id="resumen-alta" class="space-y-1.5 text-sm"></div>
          </div>
        </div>`;
        renderizarResumen();
        document.getElementById('alta_archivos')?.addEventListener('change', actualizarListaArchivos);
        return;
    }

    var cols={blue:'bg-blue-50 text-blue-600',indigo:'bg-indigo-50 text-indigo-600',teal:'bg-teal-50 text-teal-600',cyan:'bg-cyan-50 text-cyan-600',rose:'bg-rose-50 text-rose-600'};
    el.innerHTML=`
      <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div class="w-12 h-12 rounded-xl ${cols[paso.color]||'bg-slate-100 text-slate-500'} flex items-center justify-center flex-shrink-0">
          <i class="fas ${paso.icono} text-xl"></i>
        </div>
        <div><h3 class="text-base font-bold text-slate-800">${paso.titulo}</h3><p class="text-sm text-slate-400 mt-0.5">${paso.descripcion}</p></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${paso.campos.map(function(c){return renderizarCampo(c);}).join('')}
      </div>`;

    // Autonum: cargar siguiente número
    var campoCon=paso.campos.find(function(c){return c.autonum;});
    if(campoCon && !altaData[campoCon.id]) cargarSiguienteNumero();

    // Listener fecha nac → rango automático
    var fnEl=document.getElementById('alta_fechaNacimiento');
    if(fnEl){fnEl.addEventListener('change',calcularRangoEdadAuto);fnEl.addEventListener('blur',calcularRangoEdadAuto);}
    // Listener CURP → decodificar al escribir
    var curpEl=document.getElementById('alta_curp');
    if(curpEl) curpEl.addEventListener('input',function(){if(this.value.length===18)decodificarCURP(this.value);});
}

async function cargarSiguienteNumero(){
    try{
        const r=await enviarPeticion("siguiente_numero",{});
        if(r.status==="success"){
            var el=document.getElementById('alta_numeroEmpleado');
            if(el&&!el.value&&!altaData.numeroEmpleado){
                el.value=r.siguiente;
                altaData.numeroEmpleado=r.siguiente.toString();
            }
        }
    }catch(e){}
}

function renderizarCampo(c){
    var cls="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-300";
    var span=c.col===1?'md:col-span-2':'';
    var ph=c.placeholder?'placeholder="'+c.placeholder+'"':'';
    var ml=c.maxlen?'maxlength="'+c.maxlen+'"':'';
    var req=c.req?'<span class="text-red-400">*</span>':'';
    var inp;
    if(c.type==='select'){
        var ro=c.readonly?'title="Se calcula automáticamente"':'';
        inp='<select id="alta_'+c.id+'" '+(c.req?'required':'')+' '+ro+' class="'+cls+' '+(c.readonly?'bg-slate-50 cursor-default':'cursor-pointer')+'"><option value="">Seleccione...</option>'+(c.options||[]).map(function(o){return'<option value="'+o+'">'+o+'</option>';}).join('')+'</select>';
    }else if(c.type==='textarea'){
        inp='<textarea id="alta_'+c.id+'" rows="2" '+ph+' class="'+cls+' resize-none"></textarea>';
    }else{
        inp='<input type="'+c.type+'" id="alta_'+c.id+'" '+(c.req?'required':'')+' '+ml+' '+ph+' class="'+cls+'">';
    }
    var nota=c.readonly?'<span class="text-xs text-blue-400 ml-1">⟵ automático</span>':'';
    return'<div class="'+span+'"><label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">'+c.label+' '+req+nota+'</label>'+inp+'</div>';
}

function calcularRangoEdadAuto(){
    var fn=document.getElementById('alta_fechaNacimiento');
    var rn=document.getElementById('alta_rangoEdad');
    if(!fn||!rn||!fn.value)return;
    var h=new Date(),nac=new Date(fn.value);if(isNaN(nac))return;
    var ed=h.getFullYear()-nac.getFullYear();
    if(h.getMonth()<nac.getMonth()||(h.getMonth()===nac.getMonth()&&h.getDate()<nac.getDate()))ed--;
    var rango=ed<31?'<31':ed<=50?'31-50':ed<=65?'51-65':'>65';
    altaData.rangoEdad=rango; rn.value=rango;
}

// ─── DECODIFICADOR DE CURP ────────────────────────────────────
// El CURP de 18 caracteres codifica: estado nacimiento, fecha (AAMMDD),
// sexo (H/M) y letras del nombre. No hay API gubernamental con CORS libre,
// así que decodificamos localmente y mostramos lo que podemos extraer.
const ESTADOS_CURP = {
    AS:'Aguascalientes',BC:'Baja California',BS:'Baja California Sur',CC:'Campeche',
    CL:'Coahuila',CM:'Colima',CS:'Chiapas',CH:'Chihuahua',DF:'Ciudad de México',
    DG:'Durango',GT:'Guanajuato',GR:'Guerrero',HG:'Hidalgo',JC:'Jalisco',
    MC:'Estado de México',MN:'Michoacán',MS:'Morelos',NT:'Nayarit',NL:'Nuevo León',
    OC:'Oaxaca',PL:'Puebla',QT:'Querétaro',QR:'Quintana Roo',SP:'San Luis Potosí',
    SL:'Sinaloa',SR:'Sonora',TC:'Tabasco',TS:'Tamaulipas',TL:'Tlaxcala',
    VZ:'Veracruz',YN:'Yucatán',ZS:'Zacatecas',NE:'Nacido en el Extranjero'
};

function decodificarCURP(curp) {
    curp = curp.toUpperCase().trim();
    if (curp.length !== 18) return null;
    try {
        var anio2 = curp.substring(4,6);
        var mes   = curp.substring(6,8);
        var dia   = curp.substring(8,10);
        var sexo  = curp.charAt(10);
        var estado= curp.substring(11,13);
        var anio4 = parseInt(anio2,10);
        // Determinar siglo: CURP emitidas antes del 2000 tienen letras mayúsculas en pos 16
        var digVerif = curp.charAt(17);
        anio4 = anio4 + (anio4<=parseInt(new Date().getFullYear().toString().slice(2),10) && digVerif>='0' && digVerif<='9' ? 2000 : 1900);
        // Corrección simple: si anio calculado es futuro, es 1900
        if (anio4 > new Date().getFullYear()) anio4 -= 100;
        var fechaNac = anio4+'-'+mes+'-'+dia;
        var genero   = sexo==='H'?'Hombre':sexo==='M'?'Mujer':'';
        var edoNac   = ESTADOS_CURP[estado] || estado;
        var nacion   = estado==='NE'?'Extranjera':'Mexicana';
        return { fechaNacimiento:fechaNac, genero:genero, lugarNacimiento:edoNac, nacionalidad:nacion };
    } catch(e) { return null; }
}

function buscarCURP() {
    var curp = (altaData.curp || document.getElementById('alta_curp')?.value || '').toUpperCase().trim();
    if (curp.length !== 18) {
        Swal.fire('CURP inválida','Captura la CURP completa de 18 caracteres en el paso de Datos Personales primero.','warning');
        return;
    }
    var datos = decodificarCURP(curp);
    if (!datos) { Swal.fire('No se pudo decodificar','Verifica que la CURP sea válida.','error'); return; }

    var detectados = [];
    var mapaLabel = {fechaNacimiento:'Fecha Nac.',genero:'Género',lugarNacimiento:'Lugar Nac.',nacionalidad:'Nacionalidad'};
    Object.entries(datos).forEach(function([campo,valor]){
        if(!valor)return;
        altaData[campo]=valor;
        // Intentar rellenar si el campo está en el DOM
        var el=document.getElementById('alta_'+campo);
        if(el) el.value=valor;
        detectados.push('<div class="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5"><i class="fas fa-check text-blue-500 flex-shrink-0"></i><span class="font-semibold">'+mapaLabel[campo]+':</span><span>'+valor+'</span></div>');
    });

    // Calcular rango de edad automáticamente
    if(datos.fechaNacimiento){
        var fn=document.getElementById('alta_fechaNacimiento');
        if(fn){fn.value=datos.fechaNacimiento;calcularRangoEdadAuto();}
        else{var nac=new Date(datos.fechaNacimiento),hoy=new Date();var ed=hoy.getFullYear()-nac.getFullYear();if(hoy.getMonth()<nac.getMonth()||(hoy.getMonth()===nac.getMonth()&&hoy.getDate()<nac.getDate()))ed--;altaData.rangoEdad=ed<31?'<31':ed<=50?'31-50':ed<=65?'51-65':'>65';}
    }

    var res=document.getElementById('curp-resultado');
    res.classList.remove('hidden');
    res.innerHTML=detectados.join('')+'<p class="text-xs text-slate-500 mt-2"><i class="fas fa-info-circle mr-1"></i>Nombre completo y datos adicionales requieren consulta al RENAPO (disponible solo en red gubernamental).</p>';
    renderizarResumen();
    Swal.fire({icon:'success',title:'Datos del CURP aplicados',text:'Se detectaron '+detectados.length+' campo(s). Verifica y completa el nombre completo manualmente.',timer:3000,showConfirmButton:false});
}

// ─── OCR CON CLAUDE VISION ────────────────────────────────────
const OCR_PROMPT = `Eres un asistente de recursos humanos mexicano. Analiza este documento (puede ser: credencial de elector INE, CURP impresa, constancia IMSS, pasaporte, acta de nacimiento, contrato laboral o cualquier documento de identidad). Extrae ÚNICAMENTE los datos que puedas leer con certeza en el documento.

Responde SOLO con un objeto JSON válido, sin texto adicional, sin markdown:
{"nombreTrabajador":"","curp":"","rfc":"","nss":"","fechaNacimiento":"YYYY-MM-DD","genero":"Hombre o Mujer","nacionalidad":"","lugarNacimiento":"","domicilioCompleto":"","correoElectronico":"","telefonoPersonal":""}

Reglas: omite claves vacías o ilegibles. CURP siempre en mayúsculas 18 chars. RFC en mayúsculas. fechaNacimiento en formato YYYY-MM-DD. genero solo "Hombre" o "Mujer".`;

async function ejecutarOCR(){
    var input=document.getElementById('alta_archivos');
    if(!input||!input.files.length){Swal.fire('Sin archivos','Adjunta al menos un documento primero.','info');return;}
    var stEl=document.getElementById('ocr-status'),stTxt=document.getElementById('ocr-status-txt'),btn=document.getElementById('btn-ocr');
    stEl.classList.remove('hidden');btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Analizando...';
    var acum={};
    for(var i=0;i<input.files.length;i++){
        var file=input.files[i];
        if(!file.type.startsWith('image/')&&file.type!=='application/pdf')continue;
        stTxt.innerText='Analizando: '+file.name+'...';
        try{
            var b64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(',')[1]);};r.onerror=rej;r.readAsDataURL(file);});
            var content=file.type.startsWith('image/')
                ?[{type:'image',source:{type:'base64',media_type:file.type,data:b64}},{type:'text',text:OCR_PROMPT}]
                :[{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},{type:'text',text:OCR_PROMPT}];
            var resp=await fetch(CLAUDE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CLAUDE_MOD,max_tokens:1000,messages:[{role:'user',content:content}]})});
            var json=await resp.json();
            var texto=((json.content||[]).find(function(b){return b.type==='text';})||{}).text||'';
            try{Object.assign(acum,JSON.parse(texto.replace(/```json|```/g,'').trim()));}catch(pe){console.warn('OCR parse:',pe);}
        }catch(e){console.warn('OCR file error:',e);}
    }
    // Aplicar resultados
    var detectados=[],mapaL={nombreTrabajador:'Nombre',curp:'CURP',rfc:'RFC',nss:'NSS',fechaNacimiento:'Fecha Nac.',genero:'Género',nacionalidad:'Nacionalidad',lugarNacimiento:'Lugar Nac.',domicilioCompleto:'Domicilio',correoElectronico:'Correo',telefonoPersonal:'Teléfono'};
    Object.entries(acum).forEach(function([campo,valor]){
        if(!valor)return;
        altaData[campo]=valor.toString().trim();
        var el=document.getElementById('alta_'+campo);
        if(el)el.value=altaData[campo];
        detectados.push(mapaL[campo]||campo);
    });
    // Si detectó CURP, decodificar automáticamente
    if(acum.curp&&acum.curp.length===18){var d=decodificarCURP(acum.curp);if(d)Object.entries(d).forEach(function([k,v]){if(v&&!acum[k]){altaData[k]=v;var e=document.getElementById('alta_'+k);if(e)e.value=v;}});}
    // Calcular rango
    if(altaData.fechaNacimiento){var fn=document.getElementById('alta_fechaNacimiento');if(fn){fn.value=altaData.fechaNacimiento;calcularRangoEdadAuto();}}
    stEl.classList.add('hidden');btn.disabled=false;btn.innerHTML='<i class="fas fa-magnifying-glass"></i> Analizar documentos con IA';
    renderizarResumen();
    if(detectados.length) Swal.fire({icon:'success',title:'¡'+detectados.length+' campos detectados!',text:'Datos aplicados al formulario: '+detectados.join(', ')+'. Verifica y corrige antes de confirmar.',timer:4000,showConfirmButton:false});
    else Swal.fire({icon:'warning',title:'Sin datos detectados',text:'No se pudo extraer información. Intenta con una imagen de mayor resolución.',confirmButtonText:'Ok'});
}

function guardarPasoActual(){
    var paso=PASOS[pasoActual];
    if(paso.id==='paso-documentos')return true;
    var valido=true;
    paso.campos.forEach(function(c){
        var el=document.getElementById('alta_'+c.id);if(!el)return;
        var val=el.value.trim();altaData[c.id]=val;
        if(c.req&&!val){el.classList.add('border-red-400','ring-1','ring-red-300');valido=false;}
        else el.classList.remove('border-red-400','ring-1','ring-red-300');
    });
    if(!valido) Swal.fire({icon:'warning',title:'Campos requeridos',text:'Completa los campos marcados con * para continuar.',timer:2500,showConfirmButton:false});
    return valido;
}
function restaurarValoresPaso(){
    var paso=PASOS[pasoActual];
    paso.campos.forEach(function(c){var el=document.getElementById('alta_'+c.id);if(!el||altaData[c.id]===undefined)return;el.value=altaData[c.id];});
    if(pasoActual===2)calcularRangoEdadAuto();
}
function irAPaso(idx){
    if(idx>pasoActual){if(!guardarPasoActual())return;}else guardarPasoActual();
    pasoActual=idx;renderizarStepper();restaurarValoresPaso();
    document.getElementById('stepper-contenido').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function siguientePaso(){if(!guardarPasoActual())return;if(pasoActual<PASOS.length-1){pasoActual++;renderizarStepper();restaurarValoresPaso();}}
function anteriorPaso(){guardarPasoActual();if(pasoActual>0){pasoActual--;renderizarStepper();restaurarValoresPaso();}}
function actualizarBotones(){
    var ul=pasoActual===PASOS.length-1;
    document.getElementById('btn-anterior')?.classList.toggle('hidden',pasoActual===0);
    document.getElementById('btn-siguiente')?.classList.toggle('hidden',ul);
    document.getElementById('btn-enviar')?.classList.toggle('hidden',!ul);
}
function actualizarListaArchivos(){
    var inp=document.getElementById('alta_archivos'),lst=document.getElementById('lista-archivos');if(!lst||!inp)return;
    lst.innerHTML=Array.from(inp.files).map(function(f){var mb=(f.size/1024/1024).toFixed(1),ok=f.size<=10*1024*1024;return'<div class="flex items-center gap-2 text-xs '+(ok?'text-slate-600':'text-red-500')+'"><i class="fas '+(ok?'fa-file-check text-emerald-500':'fa-exclamation-triangle text-red-400')+'"></i><span class="flex-1 truncate">'+f.name+'</span><span class="'+(ok?'text-slate-400':'text-red-400')+' font-medium">'+mb+' MB</span></div>';}).join('');
}
function renderizarResumen(){
    var el=document.getElementById('resumen-alta');if(!el)return;
    var filas=[['No. Empleado',altaData.numeroEmpleado],['Nombre',altaData.nombreTrabajador],['Empresa',altaData.empresa],['Puesto',altaData.puesto],['Departamento',altaData.departamento],['Tipo Contrato',altaData.tipoContrato],['Sueldo',altaData.sueldoMensual?'$'+Number(altaData.sueldoMensual).toLocaleString('es-MX'):''],['CURP',altaData.curp],['RFC',altaData.rfc],['NSS',altaData.nss],['Género',altaData.genero],['Rango Edad',altaData.rangoEdad],['Nacionalidad',altaData.nacionalidad]].filter(function(r){return r[1];});
    el.innerHTML=filas.map(function(r){return'<div class="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0"><span class="text-xs text-slate-400 font-semibold uppercase">'+r[0]+'</span><span class="text-sm font-semibold text-right text-slate-700">'+r[1]+'</span></div>';}).join('');
}

async function enviarAlta(){
    guardarPasoActual();
    var camposReq=PASOS.flatMap(function(p){return p.campos.filter(function(c){return c.req;}).map(function(c){return c.id;});});
    var faltantes=camposReq.filter(function(id){return!altaData[id];});
    if(faltantes.length){Swal.fire({icon:'error',title:'Faltan datos',html:'Campos obligatorios sin completar:<br><br><strong>'+faltantes.join(', ')+'</strong>'});return;}
    mostrarLoader("Creando expediente...");
    var inp=document.getElementById('alta_archivos'),docs=[];
    if(inp&&inp.files.length){
        for(var i=0;i<inp.files.length;i++){
            var file=inp.files[i];
            if(file.size>10*1024*1024){ocultarLoader();Swal.fire('Archivo grande','"'+file.name+'" supera 10 MB.','warning');return;}
            var b64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(',')[1]);};r.onerror=rej;r.readAsDataURL(file);});
            docs.push({nombreArchivo:file.name,mimeType:file.type||'application/octet-stream',data:b64});
        }
    }
    try{
        var r=await enviarPeticion("alta",Object.assign({},altaData,{documentos:docs}));
        ocultarLoader();
        if(r.status==="success"){
            Swal.fire({icon:'success',title:'¡Alta registrada!',text:r.message,confirmButtonText:'Ver expediente',showCancelButton:true,cancelButtonText:'Cerrar'}).then(function(res){if(res.isConfirmed&&r.urlExpediente)window.open(r.urlExpediente,'_blank');});
            altaData={};pasoActual=0;renderizarStepper();forzarActualizacion();
        }else Swal.fire('Error',r.message,'error');
    }catch(e){ocultarLoader();Swal.fire('Error de conexión',e.message,'error');}
}

// ─── API GAS ──────────────────────────────────────────────────
async function enviarPeticion(action,payload){
    var res=await fetch(API_URL,{method:'POST',body:JSON.stringify({action,payload})});
    return await res.json();
}

// ─── OFFBOARDING — AUTOCOMPLETE ──────────────────────────────
function initAutocomplete(){
    var input=document.getElementById('baja_busqueda');
    var lista=document.getElementById('baja_sugerencias');
    if(!input||!lista)return;
    // Remover listener anterior
    var nuevoInput=input.cloneNode(true);
    input.parentNode.replaceChild(nuevoInput,input);
    input=nuevoInput;

    input.addEventListener('input',function(){
        var q=input.value.trim().toLowerCase();
        lista.innerHTML='';
        document.getElementById('baja_idEmpleado').value='';
        document.getElementById('baja_nombreEmpleado').value='';
        document.getElementById('baja_empleado_badge').classList.add('hidden');
        if(q.length<2){lista.classList.add('hidden');return;}
        var hits=cacheGlobal.filter(function(e){
            return(e["NOMBRE DEL TRABAJADOR"]||"").toLowerCase().includes(q)||(e["NO. EMPLEADO"]||"").toString().includes(q);
        }).slice(0,8);
        if(!hits.length){lista.classList.add('hidden');return;}
        lista.classList.remove('hidden');
        lista.innerHTML=hits.map(function(emp){
            var est=(emp["ESTATUS"]||"").trim();
            var col=est==="Activo"?"text-emerald-600":"text-red-500";
            var nom=(emp["NOMBRE DEL TRABAJADOR"]||"—").replace(/'/g,"\\'");
            var emp2=(emp["EMPRESA"]||"").replace(/'/g,"\\'");
            var pu=(emp["PUESTO"]||"").replace(/'/g,"\\'");
            return'<button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition" onclick="seleccionarEmpleado(\''+emp["NO. EMPLEADO"]+'\',\''+nom+'\',\''+est+'\',\''+emp2+'\',\''+pu+'\')"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold text-slate-800">'+(emp["NOMBRE DEL TRABAJADOR"]||"—")+'</p><p class="text-xs text-slate-400">#'+emp["NO. EMPLEADO"]+' · '+emp["EMPRESA"]+' · '+emp["PUESTO"]+'</p></div><span class="text-xs font-bold '+col+' flex-shrink-0">'+est+'</span></div></button>';
        }).join('');
    });
    document.addEventListener('click',function(e){if(!lista.contains(e.target)&&e.target!==input)lista.classList.add('hidden');});
}

function seleccionarEmpleado(id,nombre,estatus,empresa,puesto){
    document.getElementById('baja_busqueda').value=nombre;
    document.getElementById('baja_idEmpleado').value=id;
    document.getElementById('baja_nombreEmpleado').value=nombre;
    document.getElementById('baja_sugerencias').classList.add('hidden');
    var badge=document.getElementById('baja_empleado_badge');
    badge.classList.remove('hidden');
    var col=estatus==='Activo'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600';
    badge.innerHTML='<div class="flex items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><i class="fas fa-user text-slate-500"></i></div><div><p class="text-sm font-bold text-slate-800">'+nombre+'</p><p class="text-xs text-slate-400">#'+id+' · '+empresa+' · '+puesto+'</p></div></div><span class="text-xs font-bold px-2.5 py-1 rounded-full '+col+'">'+estatus+'</span></div>';
}

async function procesarBaja(event){
    event.preventDefault();
    var id=document.getElementById('baja_idEmpleado').value.trim();
    var nom=document.getElementById('baja_nombreEmpleado').value.trim();
    if(!id&&!nom){Swal.fire('Selecciona un colaborador','Escribe y selecciona primero.','warning');return;}
    mostrarLoader("Procesando baja...");
    var payload={numeroEmpleado:id,nombreEmpleado:nom,fechaBaja:document.getElementById('baja_fechaBaja').value,tipoSalida:document.getElementById('baja_tipoSalida').value,motivoSalida:document.getElementById('baja_motivoSalida').value,montoFiniquito:document.getElementById('baja_montoFiniquito').value};
    try{
        var r=await enviarPeticion("baja",payload);ocultarLoader();
        if(r.status==="success"){Swal.fire('Baja registrada',r.message,'success');document.getElementById('formBaja').reset();document.getElementById('baja_empleado_badge').classList.add('hidden');document.getElementById('baja_sugerencias').classList.add('hidden');forzarActualizacion();}
        else Swal.fire('No encontrado',r.message,'warning');
    }catch(e){ocultarLoader();Swal.fire('Error',e.message,'error');}
}

// ─── CACHÉ ────────────────────────────────────────────────────
var cacheGlobal=[];
async function obtenerDatos(forzar){
    if(!forzar&&cacheGlobal.length)return cacheGlobal;
    mostrarLoader("Sincronizando base de datos...");
    try{var r=await enviarPeticion("exportar_datos",{});ocultarLoader();
        if(r.status==="success"){cacheGlobal=r.data.filter(function(e){return e["NO. EMPLEADO"]&&e["NO. EMPLEADO"].toString().trim()!=="";});return cacheGlobal;}
        return[];
    }catch(e){ocultarLoader();return[];}
}
async function forzarActualizacion(){
    cacheGlobal=[];await obtenerDatos(true);cargarDashboard();
    if(document.getElementById('module-basedatos')?.classList.contains('active'))renderizarPagina(1);
    initAutocomplete();
}

// ─── DIRECTORIO ───────────────────────────────────────────────
var paginaActual=1;const FILAS_PAG=50;
async function cargarDatosTabla(){await obtenerDatos();paginaActual=1;renderizarPagina(1);}
function renderizarPagina(pag){
    var datos=cacheGlobal,totalPags=Math.max(1,Math.ceil(datos.length/FILAS_PAG));
    paginaActual=Math.max(1,Math.min(pag,totalPags));
    var ini=(paginaActual-1)*FILAS_PAG,slice=datos.slice(ini,ini+FILAS_PAG);
    var tbody=document.getElementById('tabla-directorio');tbody.innerHTML='';
    slice.forEach(function(emp){
        var est=(emp["ESTATUS"]||"").trim(),color=est==="Activo"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700";
        var url=emp["URL EXPEDIENTE"]||"",link=url?'<a href="'+url+'" target="_blank" class="text-blue-500 hover:text-blue-700"><i class="fas fa-folder-open"></i></a>':'<span class="text-slate-300">—</span>';
        tbody.innerHTML+='<tr class="hover:bg-slate-50 border-b border-slate-100 transition"><td class="px-5 py-3.5 font-semibold text-slate-700 text-sm">#'+(emp["NO. EMPLEADO"]||"—")+'</td><td class="px-5 py-3.5 text-sm">'+(emp["NOMBRE DEL TRABAJADOR"]||"—")+'</td><td class="px-5 py-3.5 text-xs text-slate-500">'+(emp["EMPRESA"]||"—")+'</td><td class="px-5 py-3.5 text-xs text-slate-500">'+(emp["PUESTO"]||"—")+'</td><td class="px-5 py-3.5"><span class="px-2.5 py-1 text-xs font-semibold rounded-full '+color+'">'+(est||"—")+'</span></td><td class="px-5 py-3.5 text-center">'+link+'</td></tr>';
    });
    var pg=document.getElementById('paginacion-directorio');if(!pg)return;
    var ini2=ini+1,fin2=Math.min(ini+FILAS_PAG,datos.length);
    pg.innerHTML='<div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl"><span class="text-sm text-slate-500">Mostrando <strong>'+ini2+'–'+fin2+'</strong> de <strong>'+datos.length+'</strong></span><div class="flex gap-2"><button onclick="renderizarPagina('+(paginaActual-1)+')" '+(paginaActual<=1?'disabled':'')+' class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">← Anterior</button><span class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg">'+paginaActual+' / '+totalPags+'</span><button onclick="renderizarPagina('+(paginaActual+1)+')" '+(paginaActual>=totalPags?'disabled':'')+' class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition">Siguiente →</button></div></div>';
    var sub=document.getElementById('subtitulo-directorio');if(sub)sub.innerText=datos.length+' colaboradores en la base maestra';
}

// ─── DASHBOARD ────────────────────────────────────────────────
var charts={};
const CD={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:"'Inter',sans-serif",size:11},padding:10,boxWidth:12,boxHeight:12}}}};
function dc(r){if(r)try{r.destroy();}catch(e){}return null;}
function fmtMXN(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n||0);}

// Parsea una fecha que viene del Sheet en CUALQUIER formato:
// "15/03/2021", "2021-03-15", número serial Excel, etc.
function parseFechaFlexible(val){
    if(!val)return null;
    var s=val.toString().trim();
    if(!s||s==="0")return null;
    // Número serial Excel
    var n=parseFloat(s);
    if(!isNaN(n)&&n>10000&&n<100000){var d=new Date((n-25569)*86400*1000);if(!isNaN(d))return d;}
    // DD/MM/YYYY
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m)return new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]));
    // YYYY-MM-DD
    var m2=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m2)return new Date(parseInt(m2[1]),parseInt(m2[2])-1,parseInt(m2[3]));
    // Nativo
    var d=new Date(s);return isNaN(d)?null:d;
}

function calcEdad(val){
    var d=parseFechaFlexible(val);if(!d)return null;
    var h=new Date(),a=h.getFullYear()-d.getFullYear();
    if(h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate()))a--;
    return a>=15&&a<=85?a:null;
}
function calcAnt(val){
    var d=parseFechaFlexible(val);if(!d)return null;
    var ms=new Date()-d;return ms<0?null:ms/(1000*60*60*24*365.25);
}
// Parsea el monto que llega del Sheet (puede traer "$", ",", espacios)
function parsearMontoSheet(val){
    if(!val&&val!==0)return 0;
    var s=val.toString().replace(/[$\s,]/g,"");
    var n=parseFloat(s);return isNaN(n)?0:n;
}

async function cargarDashboard(){
    var todos=await obtenerDatos(),filtro=document.getElementById('filtroEmpresaGlobal').value;
    var D=filtro==="ALL"?todos:todos.filter(function(r){return(r["EMPRESA"]||"").trim()===filtro;});
    var activos=0,bajas=0,cEmp={},cGen={"Hombre":0,"Mujer":0},cRango={"<31":0,"31-50":0,"51-65":0,">65":0};
    var cMotivo={},cDepto={},cTend={},finPorAnio={},totalFin=0,edades=[],ants=[];

    D.forEach(function(row){
        var est=(row["ESTATUS"]||"").trim();
        var gen=(row["GÉNERO"]||"").trim();
        var emp=(row["EMPRESA"]||"Sin Empresa").trim();
        var rango=(row["RANGO DE EDAD"]||"").trim();
        var motivo=(row["MOTIVO DE SALIDA"]||"").trim();
        var depto=(row["DEPARTAMENTO"]||"Sin Departamento").trim();

        // Fechas: parsear formato flexible
        var fIng=row["FECHA DE INGRESO"]||"";
        var fBaja=row["FECHA DE BAJA"]||"";
        var fNac=row["FECHA DE NACIMIENTO"]||"";

        // Monto: parsear con el helper
        var fin=parsearMontoSheet(row["MONTO DE FINIQUITO"]);

        if(est==="Activo"){
            activos++;
            if(gen==="Hombre"||gen==="Masculino")cGen["Hombre"]++;
            else if(gen==="Mujer"||gen==="Femenino")cGen["Mujer"]++;
            if(cRango[rango]!==undefined)cRango[rango]++;
            var ed=calcEdad(fNac);if(ed!==null)edades.push(ed);
            var an=calcAnt(fIng);if(an!==null)ants.push(an);
            cDepto[depto]=(cDepto[depto]||0)+1;
        }
        if(est==="Baja"){
            bajas++;
            if(motivo)cMotivo[motivo]=(cMotivo[motivo]||0)+1;
            if(fin>0){
                totalFin+=fin;
                var fBajaD=parseFechaFlexible(fBaja);
                if(fBajaD){var a=fBajaD.getFullYear();finPorAnio[a]=(finPorAnio[a]||0)+fin;}
            }
        }
        if(!cEmp[emp])cEmp[emp]={act:0,baj:0};
        if(est==="Activo")cEmp[emp].act++;
        if(est==="Baja")cEmp[emp].baj++;
        // Tendencia
        var fIngD=parseFechaFlexible(fIng);
        if(fIngD){var k=fIngD.getFullYear()+'-'+String(fIngD.getMonth()+1).padStart(2,'0');if(!cTend[k])cTend[k]={altas:0,bajas:0};cTend[k].altas++;}
        var fBajaD2=parseFechaFlexible(fBaja);
        if(fBajaD2){var k2=fBajaD2.getFullYear()+'-'+String(fBajaD2.getMonth()+1).padStart(2,'0');if(!cTend[k2])cTend[k2]={altas:0,bajas:0};cTend[k2].bajas++;}
    });

    var tot=activos+bajas;
    var edProm=edades.length?(edades.reduce(function(a,b){return a+b;},0)/edades.length).toFixed(1):"—";
    var anProm=ants.length?(ants.reduce(function(a,b){return a+b;},0)/ants.length).toFixed(1):"—";

    document.getElementById('kpi-total').innerText=tot;
    document.getElementById('kpi-activos').innerText=activos;
    document.getElementById('kpi-bajas').innerText=bajas;
    document.getElementById('kpi-rotacion').innerText=tot>0?((bajas/tot)*100).toFixed(1)+'%':'0%';
    document.getElementById('kpi-edad-prom').innerText=edProm!=="—"?edProm+' años':"—";
    document.getElementById('kpi-ant-prom').innerText=anProm!=="—"?anProm+' años':"—";
    document.getElementById('kpi-finiquitos').innerText=fmtMXN(totalFin);
    var totG=cGen["Hombre"]+cGen["Mujer"],pctH=totG>0?Math.round(cGen["Hombre"]/totG*100):0;
    document.getElementById('kpi-genero-h').innerText=cGen["Hombre"];
    document.getElementById('kpi-genero-m').innerText=cGen["Mujer"];
    document.getElementById('kpi-genero-bar-h').style.width=pctH+'%';
    document.getElementById('kpi-genero-bar-m').style.width=(100-pctH)+'%';

    // Gráficas
    var empL=Object.keys(cEmp).map(function(e){return e.length>14?e.substring(0,14)+'…':e;});
    charts.emp=dc(charts.emp);
    charts.emp=new Chart(document.getElementById('chartEmpresas').getContext('2d'),{type:'bar',data:{labels:empL,datasets:[{label:'Activos',data:Object.values(cEmp).map(function(v){return v.act;}),backgroundColor:'#3b82f6',borderRadius:4},{label:'Bajas',data:Object.values(cEmp).map(function(v){return v.baj;}),backgroundColor:'#ef4444',borderRadius:4}]},options:{...CD,scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'}}}}});

    charts.rango=dc(charts.rango);
    charts.rango=new Chart(document.getElementById('chartRangoEdad').getContext('2d'),{type:'bar',data:{labels:['< 31 años','31–50 años','51–65 años','> 65 años'],datasets:[{label:'Colaboradores',data:Object.values(cRango),backgroundColor:['#2563eb','#3b82f6','#60a5fa','#93c5fd'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false}}}}});

    var mot=Object.entries(cMotivo).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    charts.mot=dc(charts.mot);
    if(mot.length){
        charts.mot=new Chart(document.getElementById('chartMotivoBaja').getContext('2d'),{type:'bar',data:{labels:mot.map(function(x){return x[0].length>22?x[0].substring(0,22)+'…':x[0];}),datasets:[{label:'Bajas',data:mot.map(function(x){return x[1];}),backgroundColor:['#dc2626','#ef4444','#f87171','#fca5a5','#dc2626','#ef4444','#f87171','#fca5a5'],borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
    }else{
        var c=document.getElementById('chartMotivoBaja');if(c){var p=c.parentElement;p.innerHTML='<p class="text-xs text-slate-400 text-center pt-12">Sin datos de bajas aún</p>';}
    }

    var dep=Object.entries(cDepto).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    charts.dep=dc(charts.dep);
    charts.dep=new Chart(document.getElementById('chartDeptos').getContext('2d'),{type:'bar',data:{labels:dep.map(function(x){return x[0].length>20?x[0].substring(0,20)+'…':x[0];}),datasets:[{label:'Activos',data:dep.map(function(x){return x[1];}),backgroundColor:'#7c3aed',borderRadius:6}]},options:{...CD,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});

    var meses=Object.keys(cTend).sort().slice(-18);
    var fmtM=function(k){var parts=k.split('-');return['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(parts[1])-1]+' '+parts[0].slice(2);};
    charts.tend=dc(charts.tend);
    charts.tend=new Chart(document.getElementById('chartTendencia').getContext('2d'),{type:'line',data:{labels:meses.map(fmtM),datasets:[{label:'Altas',data:meses.map(function(k){return cTend[k].altas;}),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:'#3b82f6'},{label:'Bajas',data:meses.map(function(k){return cTend[k].bajas;}),borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.08)',tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:'#ef4444'}]},options:{...CD,scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:'#f1f5f9'}}}}});

    var anios=Object.keys(finPorAnio).sort();
    var finCanvas=document.getElementById('chartFiniquitos');
    charts.fin=dc(charts.fin);
    if(anios.length){
        charts.fin=new Chart(finCanvas.getContext('2d'),{type:'bar',data:{labels:anios,datasets:[{label:'Finiquitos',data:anios.map(function(a){return finPorAnio[a];}),backgroundColor:['#92400e','#d97706','#f59e0b','#fbbf24'].slice(0,anios.length),borderRadius:6}]},options:{...CD,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return' '+fmtMXN(ctx.raw);}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{callback:function(v){return fmtMXN(v);}}}}}});
    }else{
        var fp=finCanvas.parentElement;fp.innerHTML='<p class="text-xs text-slate-400 text-center pt-12">Sin finiquitos registrados aún</p>';
    }

    var top=Object.entries(cMotivo).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
    var tb=document.getElementById('tabla-causas-baja');
    if(tb){
        if(top.length){
            tb.innerHTML=top.map(function(x){var m=x[0],n=x[1],pct=bajas>0?((n/bajas)*100).toFixed(1):"0";return'<tr class="border-b border-slate-100 last:border-0"><td class="py-2.5 pr-4 text-sm text-slate-700">'+m+'</td><td class="py-2.5 text-center text-sm font-bold text-slate-800">'+n+'</td><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><div class="flex-1 bg-slate-100 rounded-full h-1.5"><div class="bg-red-400 h-1.5 rounded-full" style="width:'+pct+'%"></div></div><span class="text-xs text-slate-500 w-10 text-right">'+pct+'%</span></div></td></tr>';}).join('');
        }else{
            tb.innerHTML='<tr><td colspan="3" class="py-8 text-center text-xs text-slate-400">Sin bajas registradas aún</td></tr>';
        }
    }
}

// ─── EXCEL ────────────────────────────────────────────────────
async function exportarExcel(){
    var datos=await obtenerDatos();if(!datos.length){Swal.fire('Sin datos','No hay registros.','info');return;}
    var ws=XLSX.utils.json_to_sheet(datos),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"BASE DE DATOS");
    XLSX.writeFile(wb,'GM_Respaldo_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function importarExcel(event){
    var file=event.target.files[0];if(!file)return;
    mostrarLoader("Leyendo archivo Excel...");
    var reader=new FileReader();
    reader.onload=async function(e){
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        var raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
        // Normalizar fechas y montos antes de enviar al GAS
        var filtrado=raw.filter(function(r){return r["NO. EMPLEADO"]&&r["NO. EMPLEADO"].toString().trim()!=="";})
                       .map(normalizarRegistro);
        ocultarLoader();
        var res=await Swal.fire({title:'Confirmar importación',html:'<strong>'+filtrado.length+' filas válidas</strong> de <em>'+file.name+'</em>.<br><small class="text-slate-500">Fechas y montos normalizados automáticamente.</small>',icon:'question',showCancelButton:true,confirmButtonText:'Sí, importar',cancelButtonText:'Cancelar'});
        if(res.isConfirmed){
            mostrarLoader("Inyectando...");
            try{var r=await enviarPeticion("importar_masivo",{registros:filtrado});ocultarLoader();Swal.fire('Listo',r.message,'success');forzarActualizacion();}
            catch(err){ocultarLoader();Swal.fire('Error',err.message,'error');}
        }
        event.target.value='';
    };
    reader.onerror=function(){ocultarLoader();Swal.fire('Error','No se pudo leer.','error');};
    reader.readAsArrayBuffer(file);
}

// ─── INIT ─────────────────────────────────────────────────────
async function initApp(){
    pasoActual=0;altaData={};
    renderizarStepper();
    await cargarDashboard();
    initAutocomplete();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initApp);
else initApp();
