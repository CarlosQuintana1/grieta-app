"""Trazos de las rutas de Qrobus a partir de las relaciones de OpenStreetMap, validados contra las paradas del GTFS.

    python3 scripts/trazos_osm.py osm-rutas.json   # salida: demo/datos/trazos.json

osm-rutas.json sale de Overpass:
    [out:json][timeout:160];rel["type"="route"]["route"="bus"](20.45,-100.60,20.85,-100.20);out geom;
"""
import json
import math
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MAX_DIST = 60          # metros de una parada a la linea para contarla como cubierta
MIN_CUBIERTAS = 0.6    # con menos, el trazo de OSM es de otra version de la ruta
TOLERANCIA = 4         # metros al simplificar


def metros(a, b):
    la = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[0] - a[0]) * 111320, (b[1] - a[1]) * 111320 * math.cos(la))


def codigo(ref):
    m = re.match(r"^([A-Za-z]+)\s*-?\s*0*(\d+)([A-Za-z]?)$", ref.strip())
    return f"{m.group(1).upper()}{int(m.group(2)):02d}{m.group(3).upper()}" if m else ref.strip().upper()


def armar(rel):
    """Une las vias de la relacion en orden y orienta cada una para que empiece donde termino la anterior."""
    vias = [[(p["lat"], p["lon"]) for p in m["geometry"]] for m in rel["members"]
            if m["type"] == "way" and m.get("role", "") in ("", "forward", "backward") and m.get("geometry")]
    if not vias:
        return None
    if len(vias) > 1 and min(metros(vias[0][0], vias[1][0]), metros(vias[0][0], vias[1][-1])) < \
            min(metros(vias[0][-1], vias[1][0]), metros(vias[0][-1], vias[1][-1])):
        vias[0].reverse()
    linea = list(vias[0])
    for v in vias[1:]:
        if metros(linea[-1], v[-1]) < metros(linea[-1], v[0]):
            v = v[::-1]
        linea.extend(v[1:] if metros(linea[-1], v[0]) < 1 else v)
    return linea


def proyectar(p, a, b):
    la = math.radians(p[0])
    ax, ay = (a[1] - p[1]) * 111320 * math.cos(la), (a[0] - p[0]) * 111320
    bx, by = (b[1] - p[1]) * 111320 * math.cos(la), (b[0] - p[0]) * 111320
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    return t, math.hypot(ax + t * dx, ay + t * dy)


def emparejar(linea, paradas):
    """Asigna a cada parada un punto de la linea, avanzando siempre hacia adelante; None si no hay uno cerca."""
    acum = [0.0]
    for a, b in zip(linea, linea[1:]):
        acum.append(acum[-1] + metros(a, b))
    candidatos = []
    for p in paradas:
        cs = []
        for i, (a, b) in enumerate(zip(linea, linea[1:])):
            t, d = proyectar(p, a, b)
            if d <= MAX_DIST:
                cs.append((acum[i] + t * (acum[i + 1] - acum[i]), d, i, t))
        # Un minimo por cada pasada de la linea cerca de la parada.
        cs.sort()
        filtrados = []
        for c in cs:
            if filtrados and c[0] - filtrados[-1][0] < 40:
                if c[1] < filtrados[-1][1]:
                    filtrados[-1] = c
            else:
                filtrados.append(c)
        candidatos.append(filtrados)
    # Programacion dinamica: la mejor secuencia que no retrocede, con castigo por cada parada sin cubrir.
    CASTIGO = 3 * MAX_DIST
    estados = [(0.0, -1.0, [])]  # costo, posicion, elegidos
    for cs in candidatos:
        nuevos = []
        for costo, pos, el in estados:
            nuevos.append((costo + CASTIGO, pos, el + [None]))
            for c in cs:
                if c[0] >= pos:
                    nuevos.append((costo + c[1], c[0], el + [c]))
        nuevos.sort(key=lambda x: (x[0], x[1]))
        mejores, vistos = [], set()
        for n in nuevos:
            k = round(n[1])
            if k not in vistos:
                vistos.add(k)
                mejores.append(n)
            if len(mejores) >= 12:
                break
        estados = mejores
    return min(estados)[2]


def simplificar(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    peor, k = 0, 0
    for i in range(1, len(pts) - 1):
        d = proyectar(pts[i], a, b)[1]
        if d > peor:
            peor, k = d, i
    if peor <= tol:
        return [a, b]
    return simplificar(pts[:k + 1], tol)[:-1] + simplificar(pts[k:], tol)


def codificar(pts):
    salida, previo = [], (0, 0)
    for la, lo in pts:
        actual = (round(la * 1e5), round(lo * 1e5))
        for v in (actual[0] - previo[0], actual[1] - previo[1]):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                salida.append(chr((0x20 | (v & 0x1f)) + 63))
                v >>= 5
            salida.append(chr(v + 63))
        previo = actual
    return "".join(salida)


def main():
    osm = json.load(open(sys.argv[1]))["elements"]
    q = json.load(open(RAIZ / "demo/datos/qrobus.json"))
    paradas = q["paradas"]
    por_codigo = {}
    for rel in osm:
        ref = rel.get("tags", {}).get("ref")
        if ref:
            linea = armar(rel)
            if linea and len(linea) > 1:
                por_codigo.setdefault(codigo(ref), []).append((rel["id"], linea))

    trazos, resumen = {}, []
    for i, pat in enumerate(q["patrones"]):
        pts = [tuple(paradas[s][:2]) for s in pat["paradas"]]
        mejor = None
        for rid, linea in por_codigo.get(codigo(pat["linea"]), []):
            el = emparejar(linea, pts)
            cubiertas = sum(e is not None for e in el)
            if not mejor or cubiertas > mejor[0]:
                mejor = (cubiertas, rid, linea, el)
        if not mejor or mejor[0] / len(pts) < MIN_CUBIERTAS:
            resumen.append((pat["linea"], pat["hacia"], mejor[0] if mejor else 0, len(pts), None))
            continue
        cubiertas, rid, linea, el = mejor
        # Se arma la linea de la primera a la ultima parada cubierta, con cada parada como vertice.
        salida, cortes, previo = [], [], None
        for e in el:
            if e is None:
                cortes.append(None)
                continue
            _, _, seg, t = e
            punto = (linea[seg][0] + t * (linea[seg + 1][0] - linea[seg][0]), linea[seg][1] + t * (linea[seg + 1][1] - linea[seg][1]))
            if previo is None:
                tramo = [punto]
            else:
                pseg, ppunto = previo
                tramo = linea[pseg + 1:seg + 1] + [punto] if seg > pseg else [punto]
                tramo = simplificar([ppunto] + tramo, TOLERANCIA)[1:]
            salida.extend(tramo)
            cortes.append(len(salida) - 1)
            previo = (seg, punto)
        trazos[str(i)] = {"p": codificar(salida), "c": cortes, "osm": rid}
        resumen.append((pat["linea"], pat["hacia"], cubiertas, len(pts), rid))

    destino = RAIZ / "demo/datos/trazos.json"
    json.dump({"fuente": "OpenStreetMap, ODbL", "trazos": trazos}, open(destino, "w"), separators=(",", ":"))
    con = [r for r in resumen if r[4]]
    print(f"{len(con)} de {len(resumen)} recorridos con trazo de OSM; {destino.stat().st_size // 1024} KB")
    for linea, hacia, c, n, rid in sorted(resumen):
        if not rid:
            print(f"  sin trazo: {linea} hacia {hacia} ({c}/{n} paradas cerca)")


if __name__ == "__main__":
    main()
