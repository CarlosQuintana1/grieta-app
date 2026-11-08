"""Junta los SVG de Figma: el tlacuache (diseno/tlacuache) en demo/tlacuache-arte.js y los escenarios
(diseno/escenas y diseno/ahorro) en demo/escenas-arte.js.

    python3 scripts/tlacuache_arte.py
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "diseno/tlacuache"
HORAS = ["manana", "dia", "noche"]


# Partes de Figma que se animan con CSS (estilos.css, "Animaciones de las escenas").
ANIMADAS = {"tail": "an-cola", "papel-picado": "an-papel", "racha-fair-weather-clouds": "an-nubes", "savings-clouds": "an-nubes",
            "fountain-water": "an-agua"}


def interior(nombre, carpeta=ORIGEN):
    texto = (carpeta / f"{nombre}.svg").read_text(encoding="utf-8")
    texto = re.sub(r'data-part="([a-z-]+)"', lambda m: f'class="{ANIMADAS[m.group(1)]}"' if m.group(1) in ANIMADAS else m.group(0), texto)
    # El ojo abierto (trazo oscuro con su brillo) se agrupa para que parpadee.
    texto = re.sub(r'(<path d="[^"]*" fill="#2B2420"/><circle [^>]*fill="#FFFFFF"/>)', r'<g class="an-ojo">\1</g>', texto)
    # El halo de cada farol respira; el poste no se mueve.
    texto = re.sub(r'<circle (cx="0" cy="17" r="38" fill="#E0A03C")', r'<circle class="an-halo" \1', texto)
    texto = re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", texto, flags=re.S)
    texto = re.sub(r"^\s*<svg[^>]*>|</svg>\s*$", "", texto.strip())
    texto = re.sub(r'\s(data-[a-z-]+|id|role|aria-label)="[^"]*"', "", texto)
    texto = re.sub(r"(\d+\.\d{2})\d+", r"\1", texto)
    return re.sub(r">\s+<", "><", texto).strip()


def escribir(nombre, constante, arte, origen):
    destino = RAIZ / "demo" / nombre
    destino.write_text(f"// Generado por scripts/tlacuache_arte.py desde {origen}; no editar a mano.\nconst {constante} = "
                       + json.dumps(arte, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB")


def bosque(hora):
    # Los circulos de "lugares" solo marcan donde va cada arbol: se quitan del dibujo y se guardan como datos.
    crudo = (RAIZ / f"diseno/escenas/bosque-{hora}.svg").read_text(encoding="utf-8")
    grupo = re.search(r'<g data-layer="lugares".*?</g>', crudo, flags=re.S).group(0)
    lugares = [[float(x), float(y), float(r)] for x, y, r in re.findall(r'cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"', grupo)]
    dibujo = interior(f"bosque-{hora}", RAIZ / "diseno/escenas")
    dibujo = dibujo.replace(interior_de(grupo), "")
    return dibujo, lugares


def interior_de(fragmento):
    texto = re.sub(r'\s(data-[a-z-]+|id|role|aria-label)="[^"]*"', "", fragmento)
    texto = re.sub(r"(\d+\.\d{2})\d+", r"\1", texto)
    return re.sub(r">\s+<", "><", texto).strip()


def escenas():
    esc, aho = RAIZ / "diseno/escenas", RAIZ / "diseno/ahorro"
    capas = ["basura", "humo", "bote", "pasto", "arbol", "fuente-sucia", "fuente-limpia", "aves", "luciernagas", "arboles", "flores", "nopal"]
    bosques = {h: bosque(h) for h in HORAS}
    arte = {
        "racha": {h: interior(f"escena-{h}", esc) for h in HORAS} | {"nubes": interior("escena-nubes", esc)},
        "mundo": {h: interior(f"mundo-base-{h}", esc) for h in HORAS} | {c: interior(f"mundo-{c}", esc) for c in capas},
        "bosque": {h: bosques[h][0] for h in HORAS},
        "lugares": bosques["dia"][1],
        "arbol": {f"{a}-{t}": interior(f"arbol-{a}-{t}", esc) for a in ["mezquite", "sabino"] for t in ["brote", "arbolito", "grande"]},
        "ahorro": {h: interior(f"ahorro-base-{h}", aho) for h in HORAS} | {f"nivel{n}": interior(f"ahorro-nivel-{n}", aho) for n in range(6)}
                  | {"moneda": interior("ahorro-moneda", aho)},
    }
    assert len(arte["lugares"]) == 12, "el bosque debe tener 12 lugares"
    assert all("lugares" not in d and "<circle cx=\"98\"" not in d for d in arte["bosque"].values())
    escribir("escenas-arte.js", "ARTE_ESC", arte, "diseno/escenas y diseno/ahorro")


def main():
    arte = {
        "estados": {e: interior(f"tlacuache-{e}") for e in ["normal", "contento", "preocupado", "comiendo", "crias"]},
        "acc": {a: interior(f"acc-{a}") for a in ["flor", "paliacate", "lentes", "palma", "charro", "morral", "rebozo", "listones-atras", "listones-frente"]},
        "icono": {i: interior(f"icono-{i}") for i in ["flor", "paliacate", "lentes", "palma", "charro", "morral", "rebozo", "listones", "tuna"]},
    }
    escribir("tlacuache-arte.js", "ARTE_TL", arte, "diseno/tlacuache")
    escenas()


if __name__ == "__main__":
    main()
