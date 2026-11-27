// ============================================================
//  GET /expediente/folders/<ID INTERNO>
//  Equivale a "abrir la carpeta de Drive" del expediente: lista los
//  archivos usando la sesión del usuario (token guardado en el navegador).
//  La página no contiene datos: los pide a /api con la sesión.
// ============================================================
export async function onRequestGet({ params }) {
  const id = String(params.id || "").replace(/[^A-Za-z0-9_\-]/g, "");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Expediente ${id} — RRHH Prisma</title><meta name="robots" content="noindex">
<style>
body{margin:0;font-family:Inter,system-ui,sans-serif;background:#F6F7F9;color:#101828}
main{max-width:960px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 4px} p{color:#475467;font-size:14px;margin:0 0 16px}
ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
li a{display:block;background:#fff;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden;text-decoration:none;color:#101828}
li a:hover{border-color:#4338CA}
.prev{height:120px;background:#F2F4F7;display:flex;align-items:center;justify-content:center;font-size:12px;color:#475467}
.prev img{width:100%;height:100%;object-fit:cover}
.n{padding:8px 10px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f{padding:0 10px 10px;font-size:11px;color:#667085}
</style></head><body><main>
<h1>Expediente ${id}</h1><p id="estado">Cargando archivos…</p><ul id="lista"></ul>
</main><script>
(async function(){
  var est=document.getElementById('estado'), ul=document.getElementById('lista');
  var token=''; try{token=localStorage.getItem('prisma_token')||'';}catch(e){}
  if(!token){est.textContent='Inicia sesión en RRHH Prisma y vuelve a abrir el expediente.';return;}
  try{
    var r=await (await fetch('/api',{method:'POST',body:JSON.stringify({action:'listar_archivos_expediente',payload:{folderId:${JSON.stringify(id)},token:token}})})).json();
    if(r.status!=='success'){est.textContent=r.message||'No se pudieron cargar los archivos.';return;}
    var a=r.archivos||[];
    est.textContent=a.length?(a.length+' archivo(s)'):'Esta carpeta aún no tiene archivos.';
    a.forEach(function(x){
      var li=document.createElement('li'), link=document.createElement('a'); link.href=x.urlVer; link.target='_blank'; link.rel='noopener';
      var pv=document.createElement('div'); pv.className='prev';
      if(x.thumbnailUrl){var im=document.createElement('img'); im.src=x.thumbnailUrl; im.alt=''; im.loading='lazy'; pv.appendChild(im);} else pv.textContent=(x.mimeType||'archivo').split('/').pop().toUpperCase();
      var n=document.createElement('div'); n.className='n'; n.textContent=x.nombre;
      var f=document.createElement('div'); f.className='f'; f.textContent=x.fecha?new Date(x.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'';
      link.appendChild(pv); link.appendChild(n); link.appendChild(f); li.appendChild(link); ul.appendChild(li);
    });
  }catch(e){est.textContent='No se pudo conectar.';}
})();
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
