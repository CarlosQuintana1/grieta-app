"""Propuesta de iconos de Grieta dibujada a mano: linea en 24 px y pictogramas solidos en 48 px.

    python3 diseno/iconos-propuesta/iconos.py   # escribe nuevos.json junto a este archivo
"""
import json
import math
from pathlib import Path


def n(v):
    return f"{round(v, 2):g}"


def R(x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    return (f"M{n(x + r)} {n(y)}h{n(w - 2 * r)}a{n(r)} {n(r)} 0 0 1 {n(r)} {n(r)}v{n(h - 2 * r)}a{n(r)} {n(r)} 0 0 1 {n(-r)} {n(r)}"
            f"h{n(-(w - 2 * r))}a{n(r)} {n(r)} 0 0 1 {n(-r)} {n(-r)}v{n(-(h - 2 * r))}a{n(r)} {n(r)} 0 0 1 {n(r)} {n(-r)}z")


def C(cx, cy, r):
    return f"M{n(cx - r)} {n(cy)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0z"


def RP(puntos, r):
    # Poligono con esquinas redondeadas: se corta cada esquina y se une con una curva.
    d = []
    k = len(puntos)
    for i in range(k):
        x0, y0 = puntos[i - 1]
        x1, y1 = puntos[i]
        x2, y2 = puntos[(i + 1) % k]
        a = math.hypot(x1 - x0, y1 - y0)
        b = math.hypot(x2 - x1, y2 - y1)
        ra, rb = min(r, a / 2), min(r, b / 2)
        p = (x1 + (x0 - x1) * ra / a, y1 + (y0 - y1) * ra / a)
        q = (x1 + (x2 - x1) * rb / b, y1 + (y2 - y1) * rb / b)
        d.append(f"{'M' if not d else 'L'}{n(p[0])} {n(p[1])}Q{n(x1)} {n(y1)} {n(q[0])} {n(q[1])}")
    return "".join(d) + "Z"


def engrane(cx, cy, afuera, adentro, dientes, ancho=0.42):
    puntos = []
    for i in range(dientes):
        base = 2 * math.pi * i / dientes
        paso = 2 * math.pi / dientes
        for ang, rad in [(-paso * ancho / 2 - paso * 0.08, adentro), (-paso * ancho / 2, afuera), (paso * ancho / 2, afuera), (paso * ancho / 2 + paso * 0.08, adentro)]:
            puntos.append((cx + rad * math.cos(base + ang), cy + rad * math.sin(base + ang)))
    return puntos


EVENODD = ' fill-rule="evenodd"'


def solido(*partes, hoyos=True):
    return f'<path d="{"".join(partes)}"{EVENODD if hoyos else ""}/>'


def trazo(d, ancho=3.5, extra=""):
    return f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="{ancho}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'


# Linea: 24 x 24; el trazo lo pone la app (.icono).
L = {
    "i-casa": '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v9.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M10 20v-4.5a2 2 0 0 1 4 0V20"/>',
    "i-lapiz": '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z"/><path d="M13.5 7l3.5 3.5"/>',
    "i-basura": '<path d="M4 7h16"/><path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-12"/><path d="M10 11v5.5M14 11v5.5"/>',
    "i-pin": '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    "i-camion": '<rect x="5" y="3" width="14" height="15" rx="3.5"/><path d="M7.5 7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v3.5h-9z"/><path d="M8.5 14.5h.01M15.5 14.5h.01"/><path d="M8 18v2.5M16 18v2.5"/>',
    "i-auto": '<path d="M6 11.5l1.6-4.3A2 2 0 0 1 9.5 6h5a2 2 0 0 1 1.9 1.2l1.6 4.3"/><rect x="4" y="11.5" width="16" height="6" rx="2"/><path d="M7.5 14.5h.01M16.5 14.5h.01"/><path d="M7 17.5v2M17 17.5v2"/>',
    "i-ruta": '<circle cx="6" cy="18" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6"/><path d="M15 3.5 18.5 6 15 8.5"/>',
    "i-localizar": '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    "i-compartir": '<path d="M8.5 10H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5"/><path d="M12 14V3.5M8.5 7 12 3.5 15.5 7"/>',
    "i-repetir": '<path d="M19.5 10.5A7.7 7.7 0 0 0 6.3 6.6L4.5 8.5"/><path d="M4.5 4v4.5H9"/><path d="M4.5 13.5a7.7 7.7 0 0 0 13.2 3.9l1.8-1.9"/><path d="M19.5 20v-4.5H15"/>',
    "i-altavoz": '<path d="M4 10a1 1 0 0 1 1-1h3l4.5-4v14L8 15H5a1 1 0 0 1-1-1z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    "i-microfono": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M9 21h6"/>',
    "i-camara": '<path d="M4 9a2 2 0 0 1 2-2h1.8l1.4-2.2a1.6 1.6 0 0 1 1.3-.8h3a1.6 1.6 0 0 1 1.3.8L16.2 7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.8" r="3.3"/>',
    "i-alerta": '<path d="M10.3 4.3 3 17.4a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.3M12 17v.01"/>',
    "i-reloj": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "i-lupa": '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    "i-chevron": '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    "i-atras": '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
    "i-play": '<path d="M8 5.6v12.8a1 1 0 0 0 1.5.9l10-6.4a1 1 0 0 0 0-1.7l-10-6.4A1 1 0 0 0 8 5.6z"/>',
    "i-telefono": '<path d="M7 3.5H5A1.5 1.5 0 0 0 3.5 5.1C3.9 13 11 20.1 18.9 20.5a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.1-1.4l-2.8-.8a1.5 1.5 0 0 0-1.5.4l-1.2 1.2a12 12 0 0 1-5.3-5.3l1.2-1.2a1.5 1.5 0 0 0 .4-1.5l-.8-2.8A1.5 1.5 0 0 0 7 3.5z"/>',
    "i-persona": '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    "i-palomita": '<path d="M4.5 12.5l5 5 10-11"/>',
    "i-escuela": '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4.2c1.5 1.6 3.5 2.4 5.5 2.4s4-.8 5.5-2.4v-4.2"/><path d="M21.5 9.5v5"/>',
    "i-maletin": '<rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/><path d="M3.5 12.5h17"/>',
    "i-hospital": '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
    "i-lista": '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
    "i-boton": '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M4.2 6.5A10 10 0 0 1 6.5 4.2M19.8 17.5a10 10 0 0 1-2.3 2.3"/>',
    "i-mas": '<path d="M12 5v14M5 12h14"/>',
    "i-ojo": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    "i-letra": '<path d="M2.5 18.5 7.5 5.5l5 13M4.4 14h6.2"/><circle cx="17.5" cy="15.5" r="2.8"/><path d="M20.3 12.5v6"/>',
    "i-caminar": '<circle cx="13" cy="4.5" r="1.8"/><path d="M12.5 8.5 11 14l-3 6.5M11 14l3 2.5 1 4M12.5 8.5 9 10.5l-1 3M12.5 8.5l2.5 3 2.5.5"/>',
    "i-planta": '<path d="M12 20.5V12"/><path d="M12 12.5c0-3.8-2.8-6.3-7-6.3 0 3.8 2.8 6.3 7 6.3z"/><path d="M12 10.5c0-3.4 2.4-5.7 6.2-5.7 0 3.4-2.4 5.7-6.2 5.7z"/><path d="M8 20.5h8"/>',
    "i-baston": '<circle cx="10" cy="4.5" r="1.8"/><path d="M10.5 8.5 9 14.5 7 20.5M9 14.5l3 2.5.5 3.5M10.5 8.5l-3 3M10.5 9.5l3.5 2.5"/><path d="M14 12l5.5 9"/>',
    "i-silla": '<circle cx="9.5" cy="4" r="1.8"/><path d="M9.5 7.5V14h6l2.5 5.5M9.5 10.5h5"/><path d="M6.5 11.6a5.5 5.5 0 1 0 8.2 6.8"/>',
    "i-vibrar": '<rect x="8" y="4" width="8" height="16" rx="2.5"/><path d="M4.5 9v6M19.5 9v6M2 10.5v3M22 10.5v3"/>',
    "i-sol": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    "i-lluvia": '<path d="M7 15a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.2 8.3 3.4 3.4 0 0 1 17.5 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    "i-equis": '<path d="M6 6l12 12M18 6 6 18"/>',
    "i-moneda": '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.3a3 3 0 0 0-2.6-1.3c-1.5 0-2.7.8-2.7 2s1.2 1.7 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2a3 3 0 0 1-2.6-1.3M12 6.3v1.7M12 16v1.7"/>',
    "i-boleto": '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14.5 8.5v1M14.5 11.5v1M14.5 14.5v1"/>',
}
L["i-engrane"] = f'<path d="{RP(engrane(12, 12, 9.2, 7, 8), 0.6)}"/><circle cx="12" cy="12" r="2.8"/>'


# Pictogramas: 48 x 48 en dos tonos del mismo color: lo principal solido y lo secundario al 42 %.
def suave(*partes, hoyos=False):
    return f'<path d="{"".join(partes)}" opacity=".42"{EVENODD if hoyos else ""}/>'


def trazo_suave(d, ancho=3.5):
    return trazo(d, ancho, ' opacity=".42"')


def camion(dx=0, dy=0, s=1, vidrio=True):
    t = f' transform="translate({n(dx)} {n(dy)}) scale({n(s)})"' if (dx or dy or s != 1) else ""
    cuerpo = R(8, 3, 32, 34, 8) + R(13, 9.5, 22, 12.5, 3.2) + C(15.8, 30, 2.6) + C(32.2, 30, 2.6) + R(18.5, 5.4, 11, 2, 1)
    return (f'<g{t}>{solido(cuerpo)}{suave(R(13, 9.5, 22, 12.5, 3.2)) if vidrio else ""}{solido(R(11, 35, 7.5, 9, 2.4), R(29.5, 35, 7.5, 9, 2.4), hoyos=False)}'
            f'{suave(R(3.5, 11, 3.2, 9, 1.6), R(41.3, 11, 3.2, 9, 1.6))}</g>')


techo = RP([(24, 4.5), (44.5, 21), (41, 25), (24, 11.5), (7, 25), (3.5, 21)], 2)
cruz = lambda cx, cy, largo, grueso: RP([(cx - grueso / 2, cy - largo / 2), (cx + grueso / 2, cy - largo / 2), (cx + grueso / 2, cy - grueso / 2), (cx + largo / 2, cy - grueso / 2), (cx + largo / 2, cy + grueso / 2), (cx + grueso / 2, cy + grueso / 2), (cx + grueso / 2, cy + largo / 2), (cx - grueso / 2, cy + largo / 2), (cx - grueso / 2, cy + grueso / 2), (cx - largo / 2, cy + grueso / 2), (cx - largo / 2, cy - grueso / 2), (cx - grueso / 2, cy - grueso / 2)], 1.2)
pin = lambda cx, cy, r, alto: f"M{n(cx)} {n(cy + alto)}s{n(-r)}-{n(alto * 0.55)}-{n(r)}-{n(alto)}a{n(r)} {n(r)} 0 0 1 {n(2 * r)} 0c0 {n(alto * 0.45)}-{n(r)} {n(alto)}-{n(r)} {n(alto)}z"
octagono = lambda r: [(24 + r * math.cos(math.pi / 8 + i * math.pi / 4), 24 + r * math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
gota = lambda x, y: f"M{n(x)} {n(y)}c2.6 3.6 4 6 4 7.8a4 4 0 0 1-8 0c0-1.8 1.4-4.2 4-7.8z"
cono = lambda y: (20 - (y - 5) * 9 / 33, 28 + (y - 5) * 9 / 33)
sombra = lambda cx, cy, rx: f"M{n(cx - rx)} {n(cy)}a{n(rx)} 2.6 0 1 0 {n(2 * rx)} 0a{n(rx)} 2.6 0 1 0 {n(-2 * rx)} 0z"
persona = lambda cx, cabeza, r, ancho, abajo=42: C(cx, cabeza, r) + f"M{n(cx - ancho / 2)} {abajo}v-{n(abajo - cabeza - r - 2 - ancho / 2)}a{n(ancho / 2)} {n(ancho / 2)} 0 0 1 {n(ancho)} 0V{abajo}z"

P = {
    "p-casa": suave(R(9.5, 18, 29, 24, 3)) + solido(techo) + solido("M19.5 42V32a4.5 4.5 0 0 1 9 0v10z"),
    "p-escuela": solido(RP([(24, 8), (44.5, 17.5), (24, 27), (3.5, 17.5)], 2)) + suave("M11.5 24.8L24 30.6l12.5-5.8v7c0 3-5.6 6-12.5 6s-12.5-3-12.5-6z") + trazo("M40.5 19.5v9.5", 2.6) + solido(C(40.5, 31.5, 2.6)),
    "p-trabajo": solido("M17 14v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3h-3.6v-2.4h-6.8V14z") + solido("M5 26v-7a5 5 0 0 1 5-5h28a5 5 0 0 1 5 5v7z") + suave("M5 28.5h38V35a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z") + solido(R(20.5, 23, 7, 8, 2)),
    "p-hospital": suave(R(5, 5, 38, 38, 10)) + solido(cruz(24, 24, 24, 9)),
    "p-mercado": suave("M8 8H40L44 18A4 4 0 0 1 36 18A4 4 0 0 1 28 18A4 4 0 0 1 20 18A4 4 0 0 1 12 18A4 4 0 0 1 4 18Z")
    + solido(RP([(8, 8), (15.4, 8), (12, 22), (4, 18)], 1), "M20.8 8h6.4L28 18a4 4 0 0 1-8 0z", "M32.6 8H40l4 10-8 4z")
    + solido(R(8.5, 22, 3.5, 20, 1.5), R(36, 22, 3.5, 20, 1.5), R(6.5, 30, 35, 5, 2)) + solido(C(18.5, 26.5, 3), C(25, 26, 3.5), C(31, 26.5, 2.8)),
    "p-familia": suave(persona(36.5, 15, 5.2, 14)) + solido(persona(11.5, 15, 5.2, 14)) + solido(persona(25, 24, 4.4, 11)),
    "p-parque": suave(R(8, 39, 32, 4, 2)) + f'<path d="{C(24, 16, 11.5) + C(14, 22.5, 8.5) + C(34, 22.5, 8.5)}"/>' + solido(R(21.5, 25, 5, 15, 2)),
    "p-super": suave(RP([(10.5, 13), (42.5, 13), (38.5, 28), (13.5, 28)], 2.5)) + trazo("M4.5 8H8.5l5.5 23H37", 3.8) + solido(C(17, 38, 3.5), C(33, 38, 3.5)),
    "p-plaza": suave(RP([(21, 12), (41, 12), (43.5, 36), (24, 36)], 3)) + trazo_suave("M27 15V11a4 4 0 0 1 8 0v4", 2.8)
    + solido(RP([(6, 19), (30, 19), (32.5, 43), (3.5, 43)], 3.5), C(12.5, 24.5, 1.8), C(23.5, 24.5, 1.8)) + trazo("M12.5 24.5V17a5.5 5.5 0 0 1 11 0v7.5", 3),
    "p-cafe": solido("M7 17h27v10.5a11.5 11.5 0 0 1-11.5 11.5h-4A11.5 11.5 0 0 1 7 27.5z") + trazo("M34 20.5h2.5a4.5 4.5 0 0 1 0 9H33", 3.6) + solido(R(4, 40.5, 33, 3.5, 1.75)) + trazo_suave("M15 4.5c-2 2.2 2 4.3 0 7M21.5 3.5c-2 2.5 2 4.7 0 8M28 4.5c-2 2.2 2 4.3 0 7", 2.8),
    "p-iglesia": suave(RP([(3.5, 27), (13, 20), (35, 20), (44.5, 27), (44.5, 43), (3.5, 43)], 2)) + solido(RP([(24, 9), (32, 16.5), (32, 43), (16, 43), (16, 16.5)], 1.6), C(24, 21, 2.6), "M20.5 43v-8a3.5 3.5 0 0 1 7 0v8z") + trazo("M24 2v6.5M21 4.8h6", 2.8),
    "p-avion": '<g transform="rotate(45 24 24)">' + suave(RP([(24, 16.5), (44.5, 27), (44.5, 32), (24, 26.5), (3.5, 32), (3.5, 27)], 1.5), RP([(24, 35), (32.5, 39.5), (32.5, 43), (24, 41), (15.5, 43), (15.5, 39.5)], 1.2)) + solido(R(21, 2.5, 6, 41, 3)) + "</g>",
    "p-lugar": suave(sombra(24, 43, 9)) + solido(pin(24, 17.5, 13.5, 23.5), C(24, 17.5, 5.3)),
    "p-agregar": suave(sombra(24, 43, 9)) + solido(pin(24, 17.5, 13.5, 23.5), cruz(24, 17.5, 13, 4.2)),
    "p-camiones": camion(-3, 7, 0.82) + trazo_suave("M33 9.5a8 8 0 0 1 6.5 6.5M33.5 3a14 14 0 0 1 12 12", 3.2),
    "p-donde": suave(C(24, 24, 18), C(24, 24, 12.5), hoyos=True) + solido(C(24, 24, 7.5), C(24, 24, 3), R(22, 2, 4, 9, 2), R(22, 37, 4, 9, 2), R(2, 22, 9, 4, 2), R(37, 22, 9, 4, 2)),
    "p-decir": solido(R(16.5, 3.5, 15, 25, 7.5)) + trazo_suave("M10 21a14 14 0 0 0 28 0M24 35v7.5", 3.6) + solido(R(16, 41, 16, 3.5, 1.75)),
    "p-silla": solido(C(20, 7, 4.5)) + trazo("M20 15v11.5h11l4.5 10M20 20h8.5", 4.6) + trazo_suave("M13.5 22.5a11 11 0 1 0 16.5 13.5", 4.4),
    "p-qrobus": camion(),
    "p-app": solido(RP([(5, 22), (11, 22), (14.5, 12), (33.5, 12), (37, 22), (43, 22), (43, 35), (5, 35)], 3.2), RP([(16.6, 21), (19, 15), (29, 15), (31.4, 21)], 1.2), C(11, 28.3, 2.6), C(37, 28.3, 2.6), R(19, 27, 10, 3, 1.5))
    + suave(RP([(16.6, 21), (19, 15), (29, 15), (31.4, 21)], 1.2)) + solido(R(8, 33, 7, 8.5, 2.2), R(33, 33, 7, 8.5, 2.2)),
    "p-parada": solido(R(9.5, 3.5, 29, 24, 7), R(15.5, 8.5, 17, 8.5, 2.2), C(19, 21.8, 2), C(29, 21.8, 2)) + suave(R(15.5, 8.5, 17, 8.5, 2.2)) + solido(R(22, 26, 4, 16, 1.5)) + suave(R(14, 40.5, 20, 3.5, 1.75)),
    "p-yapaso": camion(6, 2, 0.92) + suave(R(1.5, 12, 11, 3.8, 1.9), R(4.5, 20.5, 8, 3.8, 1.9), R(1.5, 29, 11, 3.8, 1.9)),
    "p-lleno": camion() + solido(C(18, 14.6, 2.8), C(24, 13.8, 2.8), C(30, 14.6, 2.8), "M13 22a5 4 0 0 1 10 0zM19 22a5 4.6 0 0 1 10 0zM25 22a5 4 0 0 1 10 0z"),
    "p-familiar": suave(persona(15, 17, 6.5, 22)) + solido(R(26, 4, 19, 15.5, 5), "M30.5 19.5h6l-6 5.5z", C(30.8, 11.8, 1.8), C(35.5, 11.8, 1.8), C(40.2, 11.8, 1.8)),
    "p-reportar": suave("M12 33.5h9l-9 9z") + solido(R(4.5, 4.5, 39, 29.5, 8.5), R(21.8, 10.5, 4.4, 13.5, 2.2), C(24, 28.6, 2.5)),
    "p-ojo": suave("M2.5 24C8 13.5 15.5 9.5 24 9.5s16 4 21.5 14.5C40 34.5 32.5 38.5 24 38.5S8 34.5 2.5 24z") + solido(C(24, 24, 10), C(24, 24, 4)) + solido(C(27.5, 20.5, 1.8)),
    "p-idioma": solido(R(19, 3, 26, 19.5, 6), "M35 22.5h6v6z", R(24.5, 9, 15, 2.6, 1.3), R(24.5, 14, 9, 2.6, 1.3)) + suave(R(3, 17, 27, 23, 6.5), "M10 40h6l-6 6z") + trazo("M10.5 35.5l6-12.5 6 12.5M12.8 31h7.4", 3.2),
    "p-letra": trazo("M5 40L18 8l13 32M10 28.5h16", 5.5) + trazo_suave("M31 33a5 5 0 1 0 10 0a5 5 0 1 0-10 0M41 27v12.5", 4),
    "p-construction": suave(R(4, 11, 40, 14, 3.5)) + solido(RP([(9, 11), (16, 11), (11, 25), (4, 25)], 1.5), RP([(21, 11), (28, 11), (23, 25), (16, 25)], 1.2), RP([(33, 11), (40, 11), (35, 25), (28, 25)], 1.2), RP([(44, 16), (44, 25), (40.5, 25)], 1))
    + solido(R(9, 26.5, 4, 14, 1.5), R(35, 26.5, 4, 14, 1.5), R(5.5, 39.5, 11, 3.5, 1.75), R(31.5, 39.5, 11, 3.5, 1.75)),
    "p-traffic-cone": solido(RP([(20, 5), (28, 5), (37, 38), (11, 38)], 2)) + suave(RP([(cono(14)[0] - 0.4, 14), (cono(14)[1] + 0.4, 14), (cono(19.5)[1] + 0.4, 19.5), (cono(19.5)[0] - 0.4, 19.5)], 0.5), RP([(cono(26)[0] - 0.4, 26), (cono(26)[1] + 0.4, 26), (cono(31.5)[1] + 0.4, 31.5), (cono(31.5)[0] - 0.4, 31.5)], 0.5))
    + solido(R(4.5, 37, 39, 5.5, 2.5)),
    "p-map-pinned": solido(RP([(4, 28), (15, 25), (15, 41), (4, 44)], 1.2), RP([(33, 28), (44, 25), (44, 41), (33, 44)], 1.2)) + suave(RP([(17, 25), (31, 28), (31, 44), (17, 41)], 1.2)) + solido(pin(24, 11, 9.5, 13.5), C(24, 11, 3.5)),
    "p-pantalla": suave(R(3.5, 6.5, 41, 28.5, 5.5)) + solido(RP([(19.5, 13), (32, 20.75), (19.5, 28.5)], 1.8), R(22, 35, 4, 4, 0), R(14, 38.5, 20, 3.5, 1.75)),
    "p-gasolina": solido(R(6.5, 5.5, 23.5, 37, 4.5), R(11, 10, 14.5, 10.5, 2.2)) + suave(R(11, 10, 14.5, 10.5, 2.2)) + trazo("M30 17h3.5a3 3 0 0 1 3 3v13a3 3 0 0 0 6 0V14.5l-5-5", 3.2),
    "p-hielo": solido(RP([(6, 27), (17, 8.5), (23.5, 16), (30.5, 6.5), (42, 27)], 2.2)) + trazo_suave("M4 33c3.3-2.4 6.7-2.4 10 0s6.7 2.4 10 0 6.7-2.4 10 0 6.7 2.4 10 0M8.5 40c3-2 6-2 9 0s6 2 9 0 6-2 9 0", 3.2),
    "p-camara": suave(RP([(15, 14), (18.5, 7), (29.5, 7), (33, 14)], 2)) + solido(R(3.5, 12.5, 41, 28, 6), C(24, 26.5, 10), C(38, 18.5, 2)) + solido(C(24, 26.5, 6)),
    "p-aviso": suave(RP([(24, 1.5), (46.5, 24), (24, 46.5), (1.5, 24)], 5.5)) + solido(RP([(24, 6.5), (41.5, 24), (24, 41.5), (6.5, 24)], 4), R(21.8, 13.5, 4.4, 14, 2.2), C(24, 32, 2.5)),
    "p-megafono": solido(RP([(9, 17.5), (31, 7.5), (31, 38.5), (9, 28.5)], 2.5), R(3.5, 17, 6.5, 12, 2.5)) + suave(R(13.5, 28.5, 5.5, 12, 2.5)) + trazo_suave("M36.5 17.5a8 8 0 0 1 0 11M41 13.5a14 14 0 0 1 0 19", 3.2),
    "p-tarjeta": solido(R(3, 17, 32, 23, 4.5), R(8, 22, 8.5, 6.5, 2), R(8, 32, 17, 2.8, 1.4)) + suave(R(8, 22, 8.5, 6.5, 2)) + trazo_suave("M35.5 9a4 4 0 0 1 0 5M39 6a8.5 8.5 0 0 1 0 11M42.5 3a13 13 0 0 1 0 17", 2.8),
    "p-nopara": suave(R(3.5, 4.5, 18, 15, 4.5), R(11, 19, 3.5, 22, 1.5), R(6.5, 39.5, 12.5, 3.5, 1.75)) + solido(R(20, 24.5, 16, 7, 3.5), RP([(30.5, 16), (45.5, 28), (30.5, 40)], 2.4)),
    "p-volante": solido(C(24, 24, 20), C(24, 24, 14.5)) + suave(R(9.5, 22, 12, 6, 3), R(26.5, 22, 12, 6, 3), R(21, 28, 6, 11, 3)) + solido(C(24, 25, 6.5)),
    "p-cobro": suave(R(2, 15, 31, 23, 4.5)) + solido(C(17.5, 26.5, 7), C(17.5, 26.5, 3)) + solido(RP([(39.5, 3.5), (46.5, 13), (42.3, 13), (42.3, 31), (36.7, 31), (36.7, 13), (32.5, 13)], 1.5)),
    # Mano levantada: se usa para "Acoso o agresion", un alto con la mano.
    "p-alto": trazo_suave("M8.5 15.5a9 9 0 0 1 3.5-4M5 11a14 14 0 0 1 5.5-5.5", 2.6)
    + solido(R(15.3, 9, 5.4, 19, 2.7), R(21.3, 5, 5.4, 22, 2.7), R(27.3, 7, 5.4, 20, 2.7), R(33.3, 12, 5.2, 16, 2.6))
    + solido("M15.3 24h23.2v6.5A12.5 12.5 0 0 1 26 43h-2.3a11.5 11.5 0 0 1-8.8-4.1L8.6 31.4a3.2 3.2 0 0 1 4.6-4.4l2.1 2.1z"),
    "p-sintecho": suave(R(5, 22, 38, 4.5, 2.25)) + solido(R(5, 29, 38, 5.5, 2.5), R(9, 33, 4, 10, 1.5), R(35, 33, 4, 10, 1.5), gota(14, 2.5), gota(24, 7.5), gota(34, 2.5)),
    "p-senal": suave(R(8, 3.5, 32, 25, 6.5)) + trazo("M19.5 11.5a4.6 4.6 0 1 1 6.7 4.1c-1.3.7-2.2 1.6-2.2 3", 3.2) + solido(C(24, 23, 2)) + solido(R(22, 28, 4, 14, 1.5), R(15, 40.5, 18, 3.5, 1.75)),
    "p-llave": solido(C(15, 24, 11.5), C(15, 24, 4.6), R(25, 21, 20, 6, 2.5)) + suave(R(34, 27, 4.5, 8, 1.5), R(40.5, 27, 4.5, 10.5, 1.5)),
    "p-datos": suave(R(5, 26, 10, 17, 3), R(19, 16, 10, 27, 3)) + solido(R(33, 5, 10, 38, 3)),
    "p-ellipsis": suave(C(9.5, 24, 4.8), C(38.5, 24, 4.8)) + solido(C(24, 24, 4.8)),
    "p-plus": solido(cruz(24, 24, 34, 8)),
    "p-flag": suave(R(7.5, 4, 4.5, 40, 2.25)) + solido("M12 7.5c6-3.5 11 3.5 17 0s10-1.5 13.5 0v18.5c-3.5-1.5-7.5-3.5-13.5 0s-11-3.5-17 0z"),
    "p-settings": solido(RP(engrane(24, 24, 20.5, 15.5, 8), 1.5), C(24, 24, 6.5)),
    "p-house": suave(R(9.5, 18, 29, 24, 3)) + solido(techo) + solido("M19.5 42V32a4.5 4.5 0 0 1 9 0v10z"),
    "p-caminar": trazo_suave("M6 17h7M3 24h7M7 31h5", 3) + solido(C(29, 6.5, 4.6)) + trazo("M27 15l-4.5 13M22.5 28l-6 14M22.5 28l7 6 1.5 8.5M27 15l-7.5 4.5-2.5 7M27 15l5.5 7 6 1.5", 5),
}

# Linea en dos tonos: los objetos llevan un relleno suave; las flechas y signos, no.
RELLENOS = {
    "i-casa": '<path d="M5.5 9.5 12 4.5l6.5 5V19a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
    "i-pin": '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/>',
    "i-camion": '<rect x="5" y="3" width="14" height="15" rx="3.5"/>',
    "i-auto": '<rect x="4" y="11.5" width="16" height="6" rx="2"/>',
    "i-altavoz": '<path d="M4 10a1 1 0 0 1 1-1h3l4.5-4v14L8 15H5a1 1 0 0 1-1-1z"/>',
    "i-microfono": '<rect x="9" y="3" width="6" height="11" rx="3"/>',
    "i-camara": '<path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
    "i-alerta": '<path d="M10.3 4.3 3 17.4a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/>',
    "i-reloj": '<circle cx="12" cy="12" r="8.5"/>',
    "i-lupa": '<circle cx="10.5" cy="10.5" r="6"/>',
    "i-persona": '<circle cx="12" cy="8" r="4"/>',
    "i-escuela": '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/>',
    "i-maletin": '<rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/>',
    "i-hospital": '<rect x="4" y="4" width="16" height="16" rx="4"/>',
    "i-ojo": '<circle cx="12" cy="12" r="3"/>',
    "i-planta": '<path d="M12 12.5c0-3.8-2.8-6.3-7-6.3 0 3.8 2.8 6.3 7 6.3zM12 10.5c0-3.4 2.4-5.7 6.2-5.7 0 3.4-2.4 5.7-6.2 5.7z"/>',
    "i-vibrar": '<rect x="8" y="4" width="8" height="16" rx="2.5"/>',
    "i-sol": '<circle cx="12" cy="12" r="4"/>',
    "i-lluvia": '<path d="M7 15a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.2 8.3 3.4 3.4 0 0 1 17.5 15z"/>',
    "i-moneda": '<circle cx="12" cy="12" r="8.5"/>',
    "i-boleto": '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/>',
    "i-basura": '<path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-12z"/>',
    "i-compartir": '<rect x="5" y="10" width="14" height="10" rx="2"/>',
    "i-telefono": '<path d="M7 3.5H5A1.5 1.5 0 0 0 3.5 5.1C3.9 13 11 20.1 18.9 20.5a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.1-1.4l-2.8-.8a1.5 1.5 0 0 0-1.5.4l-1.2 1.2a12 12 0 0 1-5.3-5.3l1.2-1.2a1.5 1.5 0 0 0 .4-1.5l-.8-2.8A1.5 1.5 0 0 0 7 3.5z"/>',
    "i-engrane": f'<path d="{RP(engrane(12, 12, 9.2, 7, 8), 0.6)}"/>',
    "i-boton": '<circle cx="12" cy="12" r="3"/>',
}
for k, v in RELLENOS.items():
    L[k] = f'<g fill="currentColor" stroke="none" opacity=".2">{v}</g>' + L[k]

# Opciones para Trabajo (2026-11-08); LuXo eligio la oficina.
TRABAJO = {
    "maletin": suave(R(4, 14, 40, 27, 7)) + solido("M4 21a7 7 0 0 1 7-7h26a7 7 0 0 1 7 7v4.5c-6 3-13 4.5-20 4.5S10 28.5 4 25.5z")
    + solido("M17 14v-3.5a3.5 3.5 0 0 1 3.5-3.5h7a3.5 3.5 0 0 1 3.5 3.5V14h-4v-3h-6v3z", R(20.5, 25.5, 7, 7.5, 2.5)),
    "oficina": suave(R(3.5, 20, 13, 23, 3), R(31.5, 14, 13, 29, 3))
    + solido(R(13, 5, 22, 38, 3.5), *[R(17.2 + c * 8, 10 + f * 6.2, 5.6, 3.6, 1.2) for f in range(4) for c in range(2)], "M20.5 43v-5.5a3.5 3.5 0 0 1 7 0V43z"),
    "gafete": trazo_suave("M13 3.5l11 12 11-12", 3.6) + solido(R(19.5, 12.5, 9, 6.5, 2.2))
    + solido(R(9, 17.5, 30, 26, 5.5), C(24, 26.5, 4.3), "M16 39.5a8 6.5 0 0 1 16 0z"),
}
P["p-trabajo"] = TRABAJO["oficina"]

# Para las pastillas del inicio (2026-11-08): un brote con dos hojas en dos tonos y una pila de monedas con el signo de pesos.
def hoja_local(largo, ancho):
    # Hoja que sale de (0,0) hacia arriba, con la vena central y dos nervaduras por lado huecas.
    d = f"M0 0C{n(ancho * 0.95)} {n(-largo * 0.12)} {n(ancho * 0.62)} {n(-largo * 0.8)} 0 {n(-largo)}C{n(-ancho * 0.62)} {n(-largo * 0.8)} {n(-ancho * 0.95)} {n(-largo * 0.12)} 0 0z"
    d += f"M-0.9 {n(-largo * 0.1)}L0.9 {n(-largo * 0.1)}L0.35 {n(-largo * 0.86)}L-0.35 {n(-largo * 0.86)}z"
    for t, lado in [(0.34, 1), (0.6, 1), (0.42, -1), (0.68, -1)]:
        y0, tramo, ang = -largo * t, ancho * (0.36 - 0.22 * t), math.radians(50)
        x0, x1, y1 = lado * 1.9, lado * (1.9 + tramo * math.sin(ang)), y0 - tramo * math.cos(ang)
        d += f"M{n(x0)} {n(y0 - 0.65)}L{n(x1)} {n(y1 - 0.3)}L{n(x1)} {n(y1 + 0.3)}L{n(x0)} {n(y0 + 0.65)}z"
    return d


def hoja_en(cx, cy, largo, ancho, giro, tenue=False):
    tono = ' opacity=".42"' if tenue else ""
    return f'<path d="{hoja_local(largo, ancho)}" transform="translate({n(cx)} {n(cy)}) rotate({n(giro)})"{EVENODD}{tono}/>'


def moneda_pesos(cx, cy, r):
    # Signo de pesos simetrico: la S centrada y la linea sale lo mismo por arriba y por abajo.
    s = r * 0.42
    p = lambda x, y: f"{n(cx + x * s)} {n(cy + y * s)}"
    signo = (f"M{p(0.8, -0.7)}C{p(0.6, -1)} {p(0.3, -1.05)} {p(0, -1.05)}C{p(-0.55, -1.05)} {p(-0.85, -0.8)} {p(-0.85, -0.5)}"
             f"C{p(-0.85, -0.15)} {p(-0.5, -0.05)} {p(0, 0)}C{p(0.5, 0.05)} {p(0.85, 0.15)} {p(0.85, 0.5)}"
             f"C{p(0.85, 0.8)} {p(0.55, 1.05)} {p(0, 1.05)}C{p(-0.3, 1.05)} {p(-0.6, 1)} {p(-0.8, 0.7)}M{p(0, -1.5)}V{n(cy + 1.5 * s)}")
    return solido(C(cx, cy, r), C(cx, cy, r * 0.78)) + suave(C(cx, cy, r * 0.78)) + trazo(signo, r * 0.16)


def hoja():
    return suave("M6 45a18 6.5 0 0 1 36 0z") + trazo("M24 43V23", 3.6) + hoja_en(24.5, 25, 25, 12.5, -56) + hoja_en(23.5, 22, 21, 10.5, 54, True)


def monedas():
    pila = "".join(f"M3.5 {y}v5.2a11.5 4.6 0 0 0 23 0V{y}a11.5 4.6 0 0 1-23 0z" for y in (37.5, 30.5, 23.5))
    # El aro separa la moneda de la pila; va del color fijo de la pastilla de ahorro, el unico lugar donde se usa.
    return (solido(pila) + suave("M3.5 19a11.5 4.6 0 1 0 23 0a11.5 4.6 0 1 0-23 0z") + '<circle cx="33.5" cy="23" r="14.3" fill="#e0a03c"/>'
            + moneda_pesos(33.5, 23, 12.5))


P["p-hoja"] = hoja()
P["p-monedas"] = monedas()

# Carro de lado para "Ir en app" (2026-11-08): se entiende mejor que de frente a tamano de boton.
_carro = "M4 30v-4.5c0-2 1.4-3.6 3.3-4l4.2-.9 4.6-7.3A5 5 0 0 1 20.3 11h9.6a5 5 0 0 1 3.9 1.9l6.1 7.6 3.1.9c1.8.5 3 2.1 3 4V30a3 3 0 0 1-3 3h-1a7 7 0 0 0-14 0h-8a7 7 0 0 0-14 0a2 3 0 0 1-2-3z"
_frente, _atras = "M26.5 14.5h3.4a2 2 0 0 1 1.6.8l4.6 5.7H26.5z", "M23.5 14.5V21H15.4l3.4-5.4a2.4 2.4 0 0 1 2-1.1z"
P["p-carro"] = solido(_carro, _frente, _atras, R(41.5, 25, 3.5, 2.6, 1.3)) + suave(_frente, _atras) + solido(C(13, 35, 5.2), C(13, 35, 1.9), C(35, 35, 5.2), C(35, 35, 1.9))

# Ajustes y Conoce a los tlacuaches (2026-11-08).
P["p-celular"] = solido(R(12, 2.5, 24, 43, 6), R(15.5, 7, 17, 30, 2), C(24, 41, 2.2)) + suave(R(15.5, 7, 17, 30, 2))
P["p-fuego"] = solido("M24 4c2 9 14 13 14 26a14 14 0 0 1-28 0c0-6 3-10 6-13 0 4 2 7 4 7 2-6 0-13 4-20z")

P["p-contraste"] = solido(C(24, 24, 19.5), C(24, 24, 15.5)) + solido("M24 11.5a12.5 12.5 0 0 1 0 25z")
P["p-colores"] = solido(C(18, 24, 13.5)) + suave(C(30, 24, 13.5))

# Huellas como las que marcan los caminos en los codices: para el campo de "a donde vas".
P["p-huellas"] = '<g transform="scale(2)"><g transform="translate(8 15.6) rotate(14) scale(0.96 0.96)"><path d="M-2.6 1.2C-3 -1.4 -2.2 -3.6 -.2 -3.8C2 -4 3 -2 2.7 .2C2.5 1.6 1.7 2.2 1.6 3.4C1.5 4.8 .8 5.8 -.4 5.8C-1.8 5.8 -2.4 4.6 -2.4 3.4C-2.4 2.6 -2.5 2 -2.6 1.2Z"/><circle cx="-2.3" cy="-5.2" r="1"/><circle cx="-.5" cy="-6.1" r=".9"/><circle cx="1.2" cy="-5.9" r=".8"/><circle cx="2.6" cy="-4.9" r=".7"/></g><g transform="translate(16.2 9.2) rotate(22) scale(-0.96 0.96)"><path d="M-2.6 1.2C-3 -1.4 -2.2 -3.6 -.2 -3.8C2 -4 3 -2 2.7 .2C2.5 1.6 1.7 2.2 1.6 3.4C1.5 4.8 .8 5.8 -.4 5.8C-1.8 5.8 -2.4 4.6 -2.4 3.4C-2.4 2.6 -2.5 2 -2.6 1.2Z"/><circle cx="-2.3" cy="-5.2" r="1"/><circle cx="-.5" cy="-6.1" r=".9"/><circle cx="1.2" cy="-5.9" r=".8"/><circle cx="2.6" cy="-4.9" r=".7"/></g></g>'

if __name__ == "__main__":
    nuevos = {k: ["0 0 24 24", v] for k, v in L.items()} | {k: ["0 0 48 48", v] for k, v in P.items()}
    destino = Path(__file__).with_name("nuevos.json")
    destino.write_text(json.dumps(nuevos, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(L)} de linea y {len(P)} pictogramas en {destino.name}")

