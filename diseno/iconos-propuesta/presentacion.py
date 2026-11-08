"""Laminas para revisar la propuesta de iconos: antes y despues, grandes y a tamano real.

    python3 diseno/iconos-propuesta/presentacion.py <carpeta de salida>
"""
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
html = (RAIZ / "demo/index.html").read_text(encoding="utf-8")
ACTUALES = {i: (a, b) for i, a, b in re.findall(r'<symbol id="([^"]+)"([^>]*)>(.*?)</symbol>', html, re.S)}
NUEVOS = json.loads((AQUI / "nuevos.json").read_text(encoding="utf-8"))
RELLENO = ' fill="currentColor" stroke="none"'
TONOS = ["tono-casa", "tono-escuela", "tono-trabajo", "tono-hospital", "tono-maiz", "tono-anil", "tono-ciruela", "tono-salud", "tono-turquesa", "tono-obsidiana"]
NOMBRES = {
    "p-casa": "Casa", "p-escuela": "Escuela", "p-trabajo": "Trabajo", "p-hospital": "Hospital", "p-mercado": "Mercado", "p-familia": "Familia",
    "p-parque": "Parque", "p-super": "Súper", "p-plaza": "Plaza", "p-cafe": "Café", "p-iglesia": "Iglesia", "p-avion": "Aeropuerto",
    "p-lugar": "Lugar", "p-agregar": "Agregar lugar", "p-camiones": "Camiones cerca", "p-donde": "Dónde estoy", "p-decir": "Decir a dónde",
    "p-silla": "Silla de ruedas", "p-qrobus": "Qrobus", "p-app": "Auto de app", "p-parada": "Parada", "p-yapaso": "Ya pasó", "p-lleno": "Viene lleno",
    "p-familiar": "Avisar a alguien", "p-reportar": "Reportar", "p-ojo": "Describir", "p-idioma": "Idioma", "p-letra": "Letra grande",
    "p-construction": "Obra", "p-traffic-cone": "Cono", "p-map-pinned": "Mapa", "p-pantalla": "Streaming", "p-gasolina": "Gasolina",
    "p-hielo": "Hielo ártico", "p-camara": "Cámara", "p-aviso": "Aviso", "p-megafono": "Megáfono", "p-tarjeta": "Tarjeta", "p-nopara": "No se paró",
    "p-volante": "Chofer", "p-cobro": "Cobro de más", "p-alto": "Alto", "p-sintecho": "Sin techo", "p-senal": "Sin señalización", "p-llave": "Llave",
    "p-datos": "Datos", "p-ellipsis": "Más", "p-plus": "Agregar", "p-flag": "Destino", "p-settings": "Ajustes", "p-house": "Inicio", "p-caminar": "Caminar",
}


def sprite():
    actual = "".join(f'<symbol id="{i}"{a}>{b}</symbol>' for i, (a, b) in ACTUALES.items())
    nuevo = "".join(f'<symbol id="n-{i}" viewBox="{v}"{RELLENO if i.startswith("p-") or i == "i-caminar-p" else ""}>{b}</symbol>' for i, (v, b) in NUEVOS.items())
    return f'<svg width="0" height="0" style="position:absolute"><defs>{actual}{nuevo}</defs></svg>'


def pagina(titulo, cuerpo, ancho):
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap">
<link rel="stylesheet" href="file://{RAIZ}/demo/estilos.css">
<style>
body{{display:block;margin:0;background:#0b0a09;color:#f6f2ea;font-family:Montserrat,sans-serif;width:{ancho}px;padding:36px 40px 44px;box-sizing:border-box}}
h1{{display:block;font-size:30px;font-weight:800;margin:0 0 4px;text-transform:none;letter-spacing:0;color:#f6f2ea}}
.lam-sub{{color:#a69e92;font-size:15px;margin:0 0 26px}}
.lam-rejilla{{display:grid;gap:12px}}
.lam-p{{background:#171513;border-radius:18px;padding:14px 12px 12px;display:grid;justify-items:center;gap:8px;text-align:center}}
.lam-p .mini-ficha{{width:68px;height:68px}} .lam-p .mini-ficha .picto{{width:42px;height:42px}}
.p small{{font-size:12.5px;font-weight:700;color:#e9e3d8;line-height:1.2}}
.lam-antes{{display:flex;align-items:center;gap:6px;color:#7d766c;font-size:10.5px;font-weight:600}}
.lam-antes .mini-ficha{{width:26px;height:26px}} .lam-antes .mini-ficha .picto{{width:16px;height:16px}}
.lam-l{{background:#171513;border-radius:16px;padding:14px 8px 10px;display:grid;justify-items:center;gap:8px}}
.lam-l .icono{{width:38px;height:38px;color:#f6f2ea;stroke-width:1.8}} .lam-l .icono.real{{width:22px;height:22px;color:#e0a03c}}
.lam-l .viejo{{width:22px;height:22px;color:#6f685f;stroke-width:1.8}}
.l small{{font-size:11px;color:#a69e92;font-weight:600}}
.lam-fila{{display:flex;gap:10px;align-items:center}}
</style></head><body>{sprite()}<h1>{titulo}</h1>{cuerpo}</body></html>"""


def pictogramas(ids, titulo, sub):
    celdas = []
    for k, i in enumerate(ids):
        tono = TONOS[k % len(TONOS)]
        lucide = " picto-lucide" if 'viewBox="0 0 24 24"' in ACTUALES[i][0] and "fill=" not in ACTUALES[i][0] else ""
        celdas.append(f'<div class="lam-p"><span class="mini-ficha {tono}"><svg class="picto"><use href="#n-{i}"/></svg></span><small>{NOMBRES.get(i, i)}</small>'
                      f'<span class="lam-antes">antes <span class="mini-ficha {tono}"><svg class="picto{lucide}"><use href="#{i}"/></svg></span></span></div>')
    return pagina(titulo, f'<p class="lam-sub">{sub}</p><div class="lam-rejilla" style="grid-template-columns:repeat(6,1fr)">{"".join(celdas)}</div>', 1100)


def lineas():
    celdas = [f'<div class="lam-l"><svg class="icono"><use href="#n-{i}"/></svg><div class="lam-fila"><svg class="icono real"><use href="#n-{i}"/></svg><svg class="icono viejo"><use href="#{i}"/></svg></div><small>{i[2:]}</small></div>'
              for i in ACTUALES if i.startswith("i-") and f"{i}" in NUEVOS]
    sub = "Grande arriba; abajo a tamaño real en ámbar y, en gris, el de ahora. Los objetos llevan un relleno suave; flechas y signos quedan solo en línea."
    return pagina("Íconos de línea", f'<p class="lam-sub">{sub}</p><div class="lam-rejilla" style="grid-template-columns:repeat(8,1fr)">{"".join(celdas)}</div>', 1100)


if __name__ == "__main__":
    salida = Path(sys.argv[1])
    pictos = [i for i in ACTUALES if i.startswith("p-") and i in NUEVOS]
    mitad = 30
    (salida / "pictos-1.html").write_text(pictogramas(pictos[:mitad], "Pictogramas, 1 de 2", "Sólidos en dos tonos del mismo color. El camión es el mismo frente de Qrobus en todos los que lo usan."), encoding="utf-8")
    (salida / "pictos-2.html").write_text(pictogramas(pictos[mitad:], "Pictogramas, 2 de 2", "Reportes, avisos y ajustes. Abajo de cada uno, chiquito, el de ahora."), encoding="utf-8")
    (salida / "lineas.html").write_text(lineas(), encoding="utf-8")
    print(len(pictos), "pictogramas")
