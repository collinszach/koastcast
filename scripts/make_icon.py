"""KoastCast app icon — geometric cresting wave, flat cyan on solid navy."""
import math
from PIL import Image, ImageDraw

SS = 4
S = 1024 * SS
OUT = 1024

BG = (8, 18, 36)            # solid flat navy (no gradient/seam)
CYAN = (34, 211, 238)       # main wave
CYAN_MID = (23, 150, 186)   # flat accent — swell bars
CYAN_HI = (150, 240, 253)   # flat sheen


def lerp(a, b, t): return a + (b - a) * t
def smooth(t): return t * t * (3 - 2 * t)

icon = Image.new("RGBA", (S, S), BG + (255,))


def stamp(layer, pts, color):
    d = ImageDraw.Draw(layer)
    for x, y, r in pts:
        rr = r * S
        d.ellipse([x*S - rr, y*S - rr, x*S + rr, y*S + rr], fill=color + (255,))


STROKE = 0.055


def crest():
    """Rising body + open breaking lip — clearly a wave, uniform stroke."""
    pts = []
    n1 = 240
    for i in range(n1):
        t = i / (n1 - 1)
        x = lerp(0.180, 0.560, t)
        y = lerp(0.640, 0.300, smooth(t))
        pts.append((x, y, STROKE))
    cx, cy, rad = 0.560, 0.398, 0.108
    a0, a1 = math.radians(-94), math.radians(95)
    n2 = 230
    for i in range(n2):
        t = i / (n2 - 1)
        ang = lerp(a0, a1, t)
        r = STROKE if t < 0.82 else lerp(STROKE, STROKE * 0.5, (t - 0.82) / 0.18)  # tidy tip only
        pts.append((cx + rad*math.cos(ang), cy + rad*math.sin(ang), r))
    return pts


wave = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stamp(wave, crest(), CYAN)

# flat sheen: a short thin highlight line along the upper body (no fade)
sheen = []
for i in range(150):
    t = i / 149
    x = lerp(0.250, 0.520, t)
    y = lerp(0.560, 0.300, smooth(t)) - STROKE * 0.34
    sheen.append((x, y, STROKE * 0.20))
stamp(wave, sheen, CYAN_HI)
icon.alpha_composite(wave)

# clean circular barrel eye (solid bg hole)
er = 0.066 * S
ex, ey = 0.560 * S, 0.398 * S
ImageDraw.Draw(icon).ellipse([ex - er, ey - er, ex + er, ey + er], fill=BG + (255,))

# two flat geometric swell bars
def capsule(y, x0, x1, th, color):
    d = ImageDraw.Draw(icon)
    r = th * S / 2
    d.rounded_rectangle([x0*S - r, y*S - r, x1*S + r, y*S + r], radius=r, fill=color + (255,))
capsule(0.715, 0.215, 0.770, 0.050, CYAN_MID)
capsule(0.806, 0.300, 0.705, 0.042, CYAN_MID)

icon = icon.convert("RGB").resize((OUT, OUT), Image.LANCZOS)
icon.save("/tmp/icon_1024.png")
print("ok")
