"""KoastCast logo — monoline K whose upper arm crashes into a barrel. Emits SVG."""
import math

N = 1024
NAVY = "#060D1A"
CYAN = "#22D3EE"
FOAM = "#EAF8FF"
W = 116          # stroke weight (monoline)


def q(p0, p1, p2, n=34):
    out = []
    for i in range(n):
        t = i / (n - 1)
        x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]
        out.append((x, y))
    return out


# Junction where the arms meet the stem
JX, JY = 424, 512

# Upper arm: rise from junction to crest, then a barrel spiral (crashing lip)
crest = (632, 330)
rise = q((JX, JY), (566, 474), crest, 30)

Cc = (636, 404)
r0, r1 = math.hypot(crest[0]-Cc[0], crest[1]-Cc[1]), 38
a0 = math.atan2(crest[1]-Cc[1], crest[0]-Cc[0])   # angle of crest from centre
sweep = math.radians(338)                          # barrel curl, lip tucks inward (no notch)
spiral = []
ns = 96
for i in range(ns):
    t = i / (ns - 1)
    ang = a0 + sweep * t
    rad = r0 + (r1 - r0) * t
    spiral.append((Cc[0] + rad*math.cos(ang), Cc[1] + rad*math.sin(ang)))

arm = rise + spiral
arm_d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in arm)

# lip tip (end of spiral) — for foam spray
tip = spiral[-1]

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{N}" height="{N}" viewBox="0 0 {N} {N}">
  <rect width="{N}" height="{N}" fill="{NAVY}"/>
  <g fill="none" stroke="{CYAN}" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round">
    <!-- stem -->
    <path d="M 372 302 L 372 722"/>
    <!-- lower leg -->
    <path d="M {JX} {JY} L 690 722"/>
    <!-- upper arm + crashing barrel -->
    <path d="{arm_d}"/>
  </g>
  <!-- barrel eye (focal) -->
  <circle cx="{Cc[0]}" cy="{Cc[1]}" r="29" fill="{FOAM}"/>
  <!-- foam spray flinging up-and-out off the crest -->
  <circle cx="{crest[0]-28:.0f}" cy="{crest[1]-46:.0f}" r="18" fill="{FOAM}"/>
  <circle cx="{crest[0]-92:.0f}" cy="{crest[1]-80:.0f}" r="12" fill="{FOAM}"/>
  <circle cx="{crest[0]-142:.0f}" cy="{crest[1]-96:.0f}" r="7.5" fill="{FOAM}"/>
</svg>'''

open("/tmp/logo.svg", "w").write(svg)
print("wrote /tmp/logo.svg")
