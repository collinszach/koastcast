"""KoastCast icon — a 'K' that crashes like a wave. 3 colors: navy, cyan, foam."""
import math, random
from PIL import Image, ImageDraw

SS = 4
S = 1024 * SS
OUT = 1024

BG = (8, 18, 36)            # navy
CYAN = (34, 211, 238)       # wave / K
FOAM = (224, 248, 255)      # light spray accent


def lerp(a, b, t): return a + (b - a) * t
def smooth(t): return t * t * (3 - 2 * t)

icon = Image.new("RGBA", (S, S), BG + (255,))
d = ImageDraw.Draw(icon)


def stamp(pts, color, layer=None):
    dd = ImageDraw.Draw(layer) if layer else d
    for x, y, r in pts:
        rr = r * S
        dd.ellipse([x*S-rr, y*S-rr, x*S+rr, y*S+rr], fill=color + (255,))


def capsule(x0, y0, x1, y1, th, color):
    # thick rounded stroke between two points via stamping
    n = 120
    pts = [(lerp(x0, x1, i/(n-1)), lerp(y0, y1, i/(n-1)), th/2) for i in range(n)]
    stamp(pts, color)


JX, JY = 0.400, 0.520       # junction where K arms meet the stem
STEM_TH = 0.110
ARM_TH = 0.092

# ── Stem (wave face — the vertical of the K) ────────────────────────────────
capsule(0.330, 0.180, 0.355, 0.820, STEM_TH, CYAN)

# ── Lower leg of the K (sweeping base) ──────────────────────────────────────
capsule(JX - 0.02, JY, 0.730, 0.820, ARM_TH, CYAN)

# ── Upper arm = rising crest that curls over into a crashing lip ─────────────
crest = []
# rising diagonal (still reads as the K's upper arm)
n1 = 170
for i in range(n1):
    t = i/(n1-1)
    x = lerp(JX - 0.02, 0.640, t)
    y = lerp(JY, 0.300, smooth(t))
    crest.append((x, y, ARM_TH/2))
# the curl / crash — open hook over a barrel eye
cx, cy, rad = 0.628, 0.360, 0.108
a0, a1 = math.radians(-104), math.radians(120)
n2 = 200
for i in range(n2):
    t = i/(n2-1)
    ang = lerp(a0, a1, t)
    r = (ARM_TH/2) if t < 0.8 else lerp(ARM_TH/2, ARM_TH*0.22, (t-0.8)/0.2)
    crest.append((cx+rad*math.cos(ang), cy+rad*math.sin(ang), r))
stamp(crest, CYAN)

# barrel eye (carve to bg)
er = 0.060*S
d.ellipse([cx*S-er, cy*S-er, cx*S+er, cy*S+er], fill=BG + (255,))

# ── Crashing foam: spray flicking off the lip (foam accent) ──────────────────
random.seed(7)
tipx, tipy = cx + rad*math.cos(a1), cy + rad*math.sin(a1)
foam = []
for i in range(7):
    ang = math.radians(200 + random.uniform(-35, 35))
    dist = 0.02 + 0.075 * (i/6)
    fx = tipx + dist*math.cos(ang) + random.uniform(-0.01, 0.01)
    fy = tipy + dist*math.sin(ang) + random.uniform(-0.01, 0.01)
    foam.append((fx, fy, lerp(0.026, 0.009, i/6)))
stamp(foam, FOAM)

icon = icon.convert("RGB").resize((OUT, OUT), Image.LANCZOS)
icon.save("/tmp/icon_1024.png")
print("ok")
