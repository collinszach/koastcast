"""KoastCast app icon — sleek cresting wave over swell lines, cyan on deep ocean."""
import math
from PIL import Image, ImageDraw, ImageFilter

SS = 4
S = 1024 * SS
OUT = 1024

BG_TOP = (6, 13, 26)
BG_BOT = (9, 22, 46)
CYAN = (34, 211, 238)
CYAN_LT = (165, 247, 255)
CYAN_DK = (12, 132, 172)


def lerp(a, b, t): return a + (b - a) * t
def lerp_col(c1, c2, t): return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))
def smooth(t): return t * t * (3 - 2 * t)


# ── Background gradient + radial glow ───────────────────────────────────────
bg = Image.new("RGB", (S, S))
px = bg.load()
for y in range(S):
    col = lerp_col(BG_TOP, BG_BOT, smooth(y / (S - 1)))
    for x in range(S):
        px[x, y] = col
glow = Image.new("L", (S, S), 0)
ImageDraw.Draw(glow).ellipse(
    [int(S*0.50-S*0.46), int(S*0.50-S*0.46), int(S*0.50+S*0.46), int(S*0.52+S*0.46)], fill=130)
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.11))
bg = Image.composite(Image.new("RGB", (S, S), CYAN), bg, glow.point(lambda v: int(v * 0.34)))
icon = bg.convert("RGBA")


def stamp(layer, pts, col_fn):
    d = ImageDraw.Draw(layer)
    for x, y, rf, prog in pts:
        r = rf * S
        col = col_fn(prog)
        d.ellipse([x*S - r, y*S - r, x*S + r, y*S + r], fill=col + (255,))


def crest_path():
    """Main cresting wave: rising body + open breaking lip (no closed loop)."""
    pts = []
    n1 = 220
    for i in range(n1):
        t = i / (n1 - 1)
        x = lerp(0.16, 0.560, t)
        y = lerp(0.640, 0.300, smooth(t))
        r = lerp(0.040, 0.082, smooth(min(t * 1.5, 1)))
        pts.append((x, y, r, t * 0.5))
    # breaking lip — ~165° open hook, ending pointing down-right
    cx, cy, rad = 0.560, 0.392, 0.098
    a0, a1 = math.radians(-92), math.radians(78)
    n2 = 200
    for i in range(n2):
        t = i / (n2 - 1)
        ang = lerp(a0, a1, t)
        x = cx + rad * math.cos(ang)
        y = cy + rad * math.sin(ang)
        r = lerp(0.082, 0.030, smooth(t))
        pts.append((x, y, r, 0.5 + t * 0.5))
    return pts


def swell_line(y0, x0, x1, amp, rad, phase=0.0):
    pts = []
    n = 200
    for i in range(n):
        t = i / (n - 1)
        x = lerp(x0, x1, t)
        y = y0 + amp * math.sin(math.pi * t + phase)
        # taper the ends
        edge = min(t, 1 - t) / 0.18
        r = rad * min(1.0, edge)
        pts.append((x, y, max(r, 0.004), t))
    return pts


# ── Trailing swell lines (behind, subtler) ──────────────────────────────────
trail = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stamp(trail, swell_line(0.660, 0.20, 0.86, -0.028, 0.026, 0.3),
      lambda p: lerp_col(CYAN_DK, CYAN, p))
stamp(trail, swell_line(0.745, 0.26, 0.82, -0.024, 0.020, 0.6),
      lambda p: lerp_col(CYAN_DK, CYAN, p))
trail.putalpha(trail.split()[3].point(lambda v: int(v * 0.55)))
# glow + composite
icon.alpha_composite(Image.composite(
    Image.new("RGBA", (S, S), CYAN + (255,)), Image.new("RGBA", (S, S), (0, 0, 0, 0)),
    trail.filter(ImageFilter.GaussianBlur(S*0.02)).split()[3].point(lambda v: int(v*0.3))))
icon.alpha_composite(trail)

# ── Main crest (bright, glowing) ────────────────────────────────────────────
crest = Image.new("RGBA", (S, S), (0, 0, 0, 0))
def crest_col(p):
    return lerp_col(CYAN_DK, CYAN, p/0.5) if p < 0.5 else lerp_col(CYAN, CYAN_LT, (p-0.5)/0.5)
stamp(crest, crest_path(), crest_col)
icon.alpha_composite(Image.composite(
    Image.new("RGBA", (S, S), CYAN + (255,)), Image.new("RGBA", (S, S), (0, 0, 0, 0)),
    crest.filter(ImageFilter.GaussianBlur(S*0.022)).split()[3].point(lambda v: int(v*0.6))))
icon.alpha_composite(crest)

# sheen on the crest body
hi = Image.new("RGBA", (S, S), (0, 0, 0, 0))
hd = ImageDraw.Draw(hi)
for x, y, rf, prog in crest_path()[:220]:
    r = rf * S * 0.30
    hd.ellipse([x*S - r, (y-rf*0.32)*S - r, x*S + r, (y-rf*0.32)*S + r], fill=CYAN_LT + (110,))
icon.alpha_composite(hi.filter(ImageFilter.GaussianBlur(S*0.004)))

icon = icon.convert("RGB").resize((OUT, OUT), Image.LANCZOS)
icon.save("/tmp/icon_1024.png")
print("ok")
