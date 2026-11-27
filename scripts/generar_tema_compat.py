import re,sys
PUB='/mnt/user-data/outputs/repo/public/'
html=open(PUB+'index.html',encoding='utf-8').read()
js=open(PUB+'main.js',encoding='utf-8').read()
def lum(v):
    v=v.strip().lower().replace('!important','').strip()
    m=re.match(r'oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(/\s*[\d.%]+)?\)',v)
    if m:
        if m.group(4): return None  # con transparencia: se deja
        return float(m.group(1))/100, float(m.group(2))
    if v in('#fff','#ffffff','white'): return 1.0,0
    m=re.match(r'#([0-9a-f]{3}|[0-9a-f]{6})$',v)
    if m:
        h=m.group(1); h=''.join(c*2 for c in h) if len(h)==3 else h
        r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
        mx,mn=max(r,g,b),min(r,g,b)
        return (0.2126*r+0.7152*g+0.0722*b), (mx-mn)
    return None
def mapear(prop,val):
    L=lum(val)
    if not L: return None
    l,c=L
    if prop in('background','background-color'):
        if l>=0.975 and c<0.03: return 'var(--panel)'
        if l>=0.88 and c<0.06: return 'var(--sutil)'
        if l>=0.88: return None  # pasteles de color (chips): se ven bien en ambos
        return None
    if prop=='color':
        if l<=0.34 and c<0.08: return 'var(--tx)'
        if l<=0.58 and c<0.06: return 'var(--tx2)'
        return None
    if prop in('border-color','border','border-bottom','border-top','border-left','border-right','border-bottom-color','border-top-color'):
        if l>=0.82 and c<0.06: return 'BORDE'
    return None
out=[]
# 1) reglas de <style> en index.html
css='\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',html,re.S))
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
def reglas(css):
    """Devuelve (media, selector, cuerpo). Respeta los @media (antes se aplanaban
    y las reglas de celular terminaban aplicándose en escritorio) y omite @keyframes."""
    pos=0; n=len(css)
    def bloque(ini):
        # devuelve índice del '}' que cierra el '{' en ini
        d=0
        for k in range(ini,n):
            if css[k]=='{': d+=1
            elif css[k]=='}':
                d-=1
                if d==0: return k
        return n-1
    while pos<n:
        a=css.find('{',pos)
        if a<0: break
        cab=css[pos:a].strip(); fin=bloque(a)
        if cab.startswith('@media'):
            for m in re.finditer(r'([^{}]+)\{([^{}]*)\}',css[a+1:fin]):
                yield cab, m.group(1).strip(), m.group(2)
        elif cab.startswith('@'):
            pass
        else:
            # cabecera puede traer basura previa (cierres); tomar desde el último ';' o '}'
            yield None, cab, css[a+1:fin]
        pos=fin+1
for media,sel,body in reglas(css):
    if not sel or sel.startswith(('from','to')) or re.match(r'^[\d.]+%',sel): continue
    if sel.strip() in ('body','html','*,*::before,*::after'): continue
    if any(x in sel for x in ('#sidebar','nav-btn','nav-group','#login-screen','lp-','#app-loader','#global-loader','.spinner','::-webkit-scrollbar')): continue
    decl=[]
    for d in body.split(';'):
        if ':' not in d: continue
        prop,val=d.split(':',1); prop=prop.strip().lower()
        if prop.startswith('border') and prop not in('border-radius',):
            # extraer color al final
            mm=re.search(r'(oklch\([^)]*\)|#[0-9a-fA-F]{3,6}\b)',val)
            if mm and mapear('border-color',mm.group(1))=='BORDE':
                p2='border-color' if prop in('border','border-color') else prop+'-color' if not prop.endswith('-color') else prop
                decl.append(f'{p2}:var(--borde-suave)!important')
            continue
        nv=mapear(prop,val)
        if nv and prop.startswith('background') and ':hover' in sel: nv='var(--hover)'
        if not nv and prop in ('color','background','background-color') and lum(val):
            # Color con intención (texto blanco sobre botón morado, pestaña activa…):
            # se reafirma tal cual para que las traducciones de arriba no lo pisen.
            decl.append(f'{"background-color" if prop.startswith("background") else prop}:{val.replace("!important","").strip()}!important')
            continue
        if nv: decl.append(f'{"background-color" if prop.startswith("background") else prop}:{nv}!important')
    if decl:
        sels=','.join('html[data-tema] '+s.strip() for s in sel.split(',') if s.strip())
        r=sels+'{'+';'.join(decl)+'}'
        out.append(media+'{'+r+'}' if media else r)
# 2) clases arbitrarias de Tailwind (bg-[oklch(..)], text-[..], border-[..]) en html y js
def esc(c): return re.sub(r'([\[\]\(\)%.\/:#,])',r'\\\1',c)
clases=set(re.findall(r'(?<![\w-])((?:hover:)?(?:bg|text|border)-\[(?:oklch\([^\]]*\)|#[0-9a-fA-F]{3,6})\](?:\/\d+)?)',html+js))
for c in sorted(clases):
    hov=c.startswith('hover:'); base=c[6:] if hov else c
    kind=base.split('-',1)[0]; val=base[base.index('[')+1:base.index(']')].replace('_',' ')
    if '/' in base.split(']')[-1]: continue
    prop={'bg':'background-color','text':'color','border':'border-color'}[kind]
    nv=mapear(prop if kind!='border' else 'border-color',val)
    if not nv: continue
    if nv=='BORDE': nv='var(--borde-suave)'
    if hov and kind=='bg': nv='var(--hover)'
    out.append(f'html[data-tema] :is(main,#drawer-editor,#notif-panel,.swal2-popup,[id^="modal-"]) .{esc(c)}{":hover" if hov else ""}{{{prop}:{nv}!important}}')
# 3) estilos en línea frecuentes que arma main.js
for v in ['#fff','#ffffff','white','#f8fafc','#fafafa','#f1f5f9','#f8f7ff','#f5f3ff','#eeecf5']:
    for sep in ['',' ']:
        tok=f'background:{sep}{v}'
        if tok in js or tok in html:
            out.append(f'html[data-tema] [style*="{tok};"],html[data-tema] [style*="{tok}\\""],html[data-tema] [style$="{tok}"]{{background:{"var(--panel)" if v in ("#fff","#ffffff","white") else "var(--sutil)"}!important}}')
for v in ['#0f172a','#1e293b','#334155','#111827','#1f2937','#374151','#0d1b3e']:
    if f'color:{v}' in js or f'color: {v}' in js:
        out.append(f'html[data-tema] [style*="color:{v}"],html[data-tema] [style*="color: {v}"]{{color:var(--tx)!important}}')
for v in ['#475569','#64748b','#6b7280','#4b5563','#94a3b8']:
    if f'color:{v}' in js or f'color: {v}' in js:
        out.append(f'html[data-tema] [style*="color:{v}"],html[data-tema] [style*="color: {v}"]{{color:var(--tx2)!important}}')
# 4) colores oklch escritos en línea (style="...color:oklch(18% 0.02 285)...")
vistos=set()
for prop,val in re.findall(r'(?<![\w-])(color|background|background-color)\s*:\s*(oklch\([^)]*\))',html+js):
    key=(prop,val)
    if key in vistos: continue
    vistos.add(key)
    nv=mapear(prop,val)
    if not nv: continue
    for sep in (':',': '):
        out.append(f'html[data-tema] [style*="{prop}{sep}{val}"]{{{"background" if prop.startswith("background") else "color"}:{nv}!important}}')
sys.stdout.write('/* GENERADO por scripts/generar_tema_compat.py — no editar a mano.\n   Traduce los colores claros fijos de los módulos existentes a las variables del tema. */\n'+'\n'.join(out)+'\n')
print(len(out),file=sys.stderr)
