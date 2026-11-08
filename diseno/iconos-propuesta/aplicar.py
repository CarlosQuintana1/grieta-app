"""Pasa a demo/index.html los iconos de la propuesta que LuXo aprobo, uno por uno.

    python3 diseno/iconos-propuesta/aplicar.py p-mercado i-casa ...
"""
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
INDEX = AQUI.parents[1] / "demo/index.html"


def main(ids):
    nuevos = json.loads((AQUI / "nuevos.json").read_text(encoding="utf-8"))
    html = INDEX.read_text(encoding="utf-8")
    for i in ids:
        vista, cuerpo = nuevos[i]
        relleno = ' fill="currentColor" stroke="none"' if i.startswith("p-") else ""
        html, cambios = re.subn(rf'<symbol id="{re.escape(i)}"[^>]*>.*?</symbol>', lambda _: f'<symbol id="{i}" viewBox="{vista}"{relleno}>{cuerpo}</symbol>', html, flags=re.S)
        if cambios == 0:
            # Icono nuevo: va al final del sprite.
            html = html.replace("    </defs>", f'      <symbol id="{i}" viewBox="{vista}"{relleno}>{cuerpo}</symbol>\n    </defs>', 1)
        elif cambios != 1:
            sys.exit(f"{i}: aparece {cambios} veces")
    INDEX.write_text(html, encoding="utf-8")
    print(f"{len(ids)} iconos aplicados")


if __name__ == "__main__":
    main(sys.argv[1:])
