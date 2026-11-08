"""Junta los SVG del tlacuache exportados de Figma (diseno/tlacuache) en demo/tlacuache-arte.js.

    python3 scripts/tlacuache_arte.py
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "diseno/tlacuache"


def interior(nombre):
    texto = (ORIGEN / f"{nombre}.svg").read_text(encoding="utf-8")
    texto = re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", texto, flags=re.S)
    texto = re.sub(r"^\s*<svg[^>]*>|</svg>\s*$", "", texto.strip())
    texto = re.sub(r'\s(data-name|data-part)="[^"]*"', "", texto)
    texto = re.sub(r"(\d+\.\d{2})\d+", r"\1", texto)
    return re.sub(r">\s+<", "><", texto).strip()


def main():
    arte = {
        "estados": {e: interior(f"tlacuache-{e}") for e in ["normal", "contento", "preocupado", "comiendo", "crias"]},
        "acc": {a: interior(f"acc-{a}") for a in ["flor", "paliacate", "lentes", "palma", "charro", "morral", "rebozo", "listones-atras", "listones-frente"]},
        "icono": {i: interior(f"icono-{i}") for i in ["flor", "paliacate", "lentes", "palma", "charro", "morral", "rebozo", "listones", "tuna"]},
        "escena": {e: interior(f"escena-{e}") for e in ["soleado", "nublado"]},
    }
    destino = RAIZ / "demo/tlacuache-arte.js"
    destino.write_text("// Generado por scripts/tlacuache_arte.py desde los SVG de Figma; no editar a mano.\nconst ARTE_TL = "
                       + json.dumps(arte, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
