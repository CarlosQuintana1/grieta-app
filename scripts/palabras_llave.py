"""Lista de palabras para la llave de Grieta: la de BIP39 en espanol sin las palabras feas.

    python3 scripts/palabras_llave.py
"""
import json
import urllib.request
from pathlib import Path

FUENTE = "https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/spanish.txt"
FUERA = set("""aborto bomba culpa diablo droga enfermo fusil guerra llanto luto matar miedo muerte odio pecado pelea peligro
pobre preso rabia sangre sexo tumba veneno tumor trauma crimen golpe cerdo burro bruja feo gordo loco mafia obeso ruina tonto
vicio grasa ataque asalto ahogo bestia basura caos dolor duelo fracaso furia grito huelga humo infiel ira maldad miseria ofensa
pena pereza quemar riesgo sudor sufrir susto temor terror tos rapto trago vino licor tabaco cigarro fumar delito multa
deuda ruleta apuesta desnudo amante morir herir enemigo raza viudo espada""".split())


def main():
    palabras = [p.strip() for p in urllib.request.urlopen(FUENTE).read().decode("utf-8").splitlines() if p.strip()]
    assert len(palabras) == 2048
    limpias = [p for p in palabras if p not in FUERA]
    destino = Path(__file__).resolve().parent.parent / "demo/datos/palabras.json"
    destino.write_text(json.dumps(limpias, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(limpias)} palabras en {destino.name}")


if __name__ == "__main__":
    main()
