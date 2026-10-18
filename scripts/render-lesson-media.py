#!/usr/bin/env python3
"""
Renders an animated ~60 second vertical (720x1280) reel + thumbnail for each seeded lesson: the lesson transcript is
read aloud by a synthetic eSpeak NG voice and shown as word-by-word captions over an animated background with a topic icon and effects. Not studio narration -
replace any of them with a real recording through Creator Studio.

Needs: python3, Pillow, ffmpeg, espeak-ng.   Usage:  python3 scripts/render-lesson-media.py [lesson-key ...]
Writes backend/seed-assets/manifest.json with each video's real duration (the seed script reads it).
Output: backend/seed-assets/videos/<key>.mp4 and backend/seed-assets/thumbnails/<key>.jpg
"""
import json, os, subprocess, sys, tempfile, textwrap
import math, random, functools
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_V = os.path.join(ROOT, "backend", "seed-assets", "videos")
OUT_T = os.path.join(ROOT, "backend", "seed-assets", "thumbnails")
SECONDS_PER_SLIDE = 5
W, H = 720, 1280
BG, BG2 = (11, 11, 18), (28, 20, 58)
VIOLET, CYAN, INK, MUTED = (139, 92, 246), (34, 211, 238), (244, 244, 250), (160, 160, 185)

@functools.lru_cache(maxsize=None)
def font(bold, size):
    cands = [os.environ.get("TER_FONT_BOLD" if bold else "TER_FONT", ""),
             "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
             "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
             "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"]
    for c in cands:
        if c and os.path.exists(c): return ImageFont.truetype(c, size)
    sys.exit("No usable TTF font found. Set TER_FONT / TER_FONT_BOLD to a .ttf path.")


def wrap(d, text, f, max_w):
    lines, cur = [], ""
    for w in text.split():
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=f) <= max_w: cur = trial
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def block(d, text, f, x, y, max_w, fill, gap=12):
    for line in wrap(d, text, f, max_w):
        d.text((x, y), line, font=f, fill=fill)
        y += f.size + gap
    return y

def split_groups(text, n=6):
    sents = [x.strip() for x in text.replace("?", "?|").replace(".", ".|").replace("!", "!|").split("|") if x.strip()]
    per = max(1, round(len(sents) / n)); groups, cur = [], []
    for x in sents:
        cur.append(x)
        if len(cur) >= per and len(groups) < n - 1: groups.append(" ".join(cur)); cur = []
    if cur: groups.append(" ".join(cur))
    return groups

def tts(text, path, wpm):
    subprocess.run(["espeak-ng", "-v", "en-us", "-s", str(int(wpm)), "-p", "45", "-w", path, text], check=True)

def wav_len(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode().strip())

FPS = 15
TARGET = 60.0
GAP = 0.35
DIM = (118, 112, 150)
ACCENT = {"Web Development": (99, 102, 241), "Databases": (34, 211, 238), "Programming": (132, 204, 22), "Operating Systems": (245, 158, 11),
          "Networking": (16, 185, 129), "Cybersecurity": (244, 63, 94), "Cloud Computing": (56, 189, 248), "DevOps": (167, 139, 250),
          "Artificial Intelligence": (217, 70, 239)}
ICON = {"Web Development": "web", "Databases": "db", "Programming": "prog", "Operating Systems": "os", "Networking": "net",
        "Cybersecurity": "sec", "Cloud Computing": "cloud", "DevOps": "git", "Artificial Intelligence": "ai"}

def bg_image():
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=tuple(int(BG[i] + (BG2[i] - BG[i]) * t) for i in range(3)))
    return img

def make_icon(kind, s, color):
    """Bold line-art icon on a transparent square."""
    m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m); w = max(4, s // 16); P = lambda x, y: (x * s, y * s)
    if kind == "web":
        d.rounded_rectangle([0.08*s, 0.15*s, 0.92*s, 0.85*s], s*0.08, outline=255, width=w); d.line([P(0.08, 0.34), P(0.92, 0.34)], 255, w)
        for i in range(3): d.ellipse([P(0.15 + i*0.08, 0.22), P(0.19 + i*0.08, 0.28)], fill=255)
        d.text((s*0.5, s*0.6), "</>", font=font(True, int(s*0.26)), fill=255, anchor="mm")
    elif kind == "db":
        for i in range(3):
            y = 0.22 + 0.28 * i; d.arc([P(0.15, y - 0.1), P(0.85, y + 0.1)], 0, 180, 255, w); 
        d.ellipse([P(0.15, 0.12), P(0.85, 0.32)], outline=255, width=w); d.line([P(0.15, 0.22), P(0.15, 0.78)], 255, w); d.line([P(0.85, 0.22), P(0.85, 0.78)], 255, w)
    elif kind == "prog":
        d.text((s*0.5, s*0.5), "{ }", font=font(True, int(s*0.62)), fill=255, anchor="mm")
    elif kind == "os":
        d.rounded_rectangle([P(0.25, 0.25), P(0.75, 0.75)], s*0.05, outline=255, width=w); d.rectangle([P(0.4, 0.4), P(0.6, 0.6)], fill=255)
        for i in range(3):
            v = 0.35 + 0.15 * i
            for a, b in [((v, 0.1), (v, 0.25)), ((v, 0.75), (v, 0.9)), ((0.1, v), (0.25, v)), ((0.75, v), (0.9, v))]: d.line([P(*a), P(*b)], 255, w // 2 + 1)
    elif kind == "net":
        n = [(0.5, 0.2), (0.2, 0.5), (0.8, 0.5), (0.35, 0.82), (0.65, 0.82)]
        for a, b in [(0, 1), (0, 2), (1, 2), (1, 3), (2, 4), (3, 4), (0, 3), (0, 4)]: d.line([P(*n[a]), P(*n[b])], 255, w // 2 + 1)
        for x, y in n: d.ellipse([P(x - 0.08, y - 0.08), P(x + 0.08, y + 0.08)], fill=255)
    elif kind == "sec":
        pts = [P(0.5, 0.08), P(0.86, 0.24), P(0.82, 0.6), P(0.5, 0.92), P(0.18, 0.6), P(0.14, 0.24)]
        d.line(pts + [pts[0]], 255, w, joint="curve"); d.line([P(0.34, 0.5), P(0.46, 0.63), P(0.68, 0.36)], 255, w, joint="curve")
    elif kind == "cloud":
        def cloud(e):
            d2.ellipse([P(0.08, 0.45), P(0.92, 0.8)]) if False else None
            for box in [(0.08, 0.42, 0.92, 0.82), (0.2, 0.3, 0.55, 0.68), (0.4, 0.18, 0.78, 0.62)]:
                d2.ellipse([box[0]*s - e, box[1]*s - e, box[2]*s + e, box[3]*s + e], fill=255)
        outer = Image.new("L", (s, s), 0); d2 = ImageDraw.Draw(outer); cloud(0)
        inner = Image.new("L", (s, s), 0); d2 = ImageDraw.Draw(inner); cloud(-w)
        m = ImageChops.subtract(outer, inner)
    elif kind == "git":
        d.line([P(0.3, 0.18), P(0.3, 0.82)], 255, w); d.line([P(0.3, 0.62), P(0.7, 0.32)], 255, w)
        for x, y in [(0.3, 0.18), (0.3, 0.82), (0.7, 0.3)]: d.ellipse([P(x - 0.1, y - 0.1), P(x + 0.1, y + 0.1)], fill=255)
    elif kind == "ai":
        L = [[0.28, 0.5, 0.72], [0.15, 0.38, 0.62, 0.85], [0.35, 0.65]]; X = [0.18, 0.5, 0.82]
        for i in range(2):
            for a in L[i]:
                for b in L[i + 1]: d.line([P(X[i], a), P(X[i + 1], b)], 255, max(2, w // 3))
        for i in range(3):
            for y in L[i]: d.ellipse([P(X[i] - 0.07, y - 0.07), P(X[i] + 0.07, y + 0.07)], fill=255)
    rgba = Image.new("RGBA", (s, s), color + (0,)); rgba.putalpha(m)
    return rgba

def glow(icon, color, radius):
    pad = radius * 3; big = Image.new("RGBA", (icon.width + pad * 2, icon.height + pad * 2), color + (0,))
    big.paste(icon, (pad, pad), icon)
    g = big.filter(ImageFilter.GaussianBlur(radius)); out = Image.alpha_composite(g, big)
    return out

def blob(color, size, alpha):
    mask = Image.radial_gradient("L").resize((size, size)); mask = ImageChops.invert(mask).point(lambda v: int(v * alpha))
    return Image.new("RGB", (size, size), color), mask

def layer_canvas(): return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def header(d, l, acc):
    d.text((60, 70), "TECH EXPLAINER REELS", font=font(True, 22), fill=MUTED)
    cat = l["category"].upper(); cw = d.textlength(cat, font=font(True, 22))
    d.rounded_rectangle([60, 130, 60 + cw + 36, 174], 22, fill=tuple(int(c * 0.35) for c in acc) + (255,))
    d.text((78, 138), cat, font=font(True, 22), fill=tuple(min(255, c + 90) for c in acc) + (255,))

def caption_layout(text, size, d):
    f = font(True, size); words, lines = text.split(), []
    cur = []
    for w in words:
        if d.textlength(" ".join(cur + [w]), font=f) <= W - 120: cur.append(w)
        else: lines.append(cur); cur = [w]
    lines.append(cur)
    return f, lines


# ---------------------------------------------------------------- explainer diagrams (animated, one per lesson)
# N = node: (id, label, cx, cy, w, h, reveal_group, style, label_pos)   styles: box | ghost | bad | good | bar
# E = edge: (from, to, label, reveal_group, extra_delay_sec, seq_y)       seq_y => horizontal arrow at that height
def N(i, label, cx, cy, w=130, h=52, g=0, st="box", lp="c"): return dict(id=i, label=label, cx=cx, cy=cy, w=w, h=h, g=g, st=st, lp=lp)
def E(a, b, label="", g=0, dt=0.0, y=None, st="box"): return dict(a=a, b=b, label=label, g=g, dt=dt, y=y, st=st)
DIAG = {
 "html-css-box-model": dict(nodes=[N("m","margin",.5,.5,590,322,0,"ghost","top"), N("b","border",.5,.5,500,250,1,"ghost","top"), N("p","padding",.5,.5,410,176,2,"ghost","top"), N("c","content",.5,.52,290,84,3)], edges=[]),
 "js-closures": dict(nodes=[N("a","makeCounter()",.2,.16,200,50,0), N("b","count = 0",.2,.62,160,50,1), N("c","inner function",.8,.16,200,50,2), N("d","counter()",.8,.62,160,50,4), N("e","count++  ->  1, 2, 3 ...",.5,.92,300,44,5,"good")],
     edges=[E("a","c","returns",2), E("c","b","remembers",3), E("d","c","calls",4)]),
 "react-components-props-state": dict(nodes=[N("p","<Parent />",.5,.14,200,50,0), N("a","<Child A />",.2,.72,170,50,1), N("b","<Child B />",.8,.72,170,50,1), N("s","useState",.9,.44,120,46,2,"good")],
     edges=[E("p","a","props",1,.5), E("p","b","props",1,.5), E("s","p","state",2,.4), E("a","p","callback",4)]),
 "rest-api-basics": dict(nodes=[N("c","Client",.1,.45,108,52,0), N("s","Server",.5,.45,108,52,0), N("d","DB",.9,.45,90,52,2), N("e","401 / 403 / 404 = client error",.5,.9,380,44,4,"bad")],
     edges=[E("c","s","GET /users",1), E("s","d","query",2), E("d","s","doc",2,1.0), E("s","c","200 OK",3)]),
 "node-express-request-lifecycle": dict(nodes=[N("r","Request",.11,.25,96,50,0), N("j","json()",.37,.25,96,50,1), N("a","auth",.63,.25,86,50,2), N("h","Route",.89,.25,96,50,3), N("o","Response",.88,.78,130,50,4,"good"), N("x","Error handler",.4,.78,190,50,5,"bad")],
     edges=[E("r","j","",1), E("j","a","",2), E("a","h","",3), E("h","o","send",4), E("a","x","next(err)",5)]),
 "mongodb-schema-design": dict(nodes=[N("p","post",.18,.18,150,50,0), N("t","tags [ ]",.18,.66,150,50,1), N("c","comment",.74,.18,150,50,2), N("u","user",.74,.66,150,50,2), N("i","index on tags",.5,.92,230,42,5,"good")],
     edges=[E("p","t","embed",1,.4), E("c","u","user_id (ref)",3)]),
 "sql-select-join-group": dict(nodes=[N("c","customers",.2,.16,170,50,0), N("o","orders",.8,.16,150,50,1), N("r","joined rows",.5,.58,220,50,3), N("g","GROUP BY -> COUNT()",.5,.9,300,46,4,"good")],
     edges=[E("c","o","JOIN ON id",2), E("c","r","",3), E("o","r","",3), E("r","g","",4)]),
 "jwt-authentication": dict(nodes=[N("c","Client",.12,.09,130,46,0), N("s","Server",.88,.09,130,46,0), N("v","verify signature + role",.5,.93,320,42,5,"good")],
     edges=[E("c","s","login",1,0,.34), E("s","c","signed JWT",2,0,.54), E("c","s","Bearer JWT",4,0,.74)]),
 "git-github-workflow": dict(nodes=[N("m1","main",.1,.2,100,48,0), N("b","feature",.14,.76,118,48,1), N("k","commits",.5,.76,118,48,2), N("pr","pull request",.86,.76,138,48,3), N("m2","main",.9,.2,100,48,5,"good")],
     edges=[E("m1","b","branch",1), E("b","k","commit",2), E("k","pr","push",3), E("pr","m2","merge",5)]),
 "big-o-data-structures": dict(nodes=[N("1","O(1)",.1,0,70,38,0,"bar"), N("2","O(log n)",.3,0,70,70,1,"bar"), N("3","O(n)",.5,0,70,120,2,"bar"), N("4","O(n log n)",.7,0,70,185,3,"bar"), N("5","O(n^2)",.9,0,70,255,4,"bar")], edges=[]),
 "processes-vs-threads": dict(nodes=[N("P","Process: own memory",.5,.5,590,322,0,"ghost","top"), N("t1","Thread 1",.2,.5,130,50,1), N("t2","Thread 2",.8,.5,130,50,1), N("m","shared heap",.5,.84,240,46,2), N("l","mutex",.5,.5,100,46,3,"good")],
     edges=[E("t1","m","write",2,.4), E("t2","m","write",2,.4), E("t1","t2","waits",5), E("t2","t1","waits",5)]),
 "tcp-vs-udp": dict(nodes=[N("c","Client",.12,.09,130,46,0), N("s","Server",.88,.09,130,46,0)],
     edges=[E("c","s","SYN",1,0,.3), E("s","c","SYN-ACK",1,2.2,.48), E("c","s","ACK",1,4.4,.66), E("c","s","UDP datagram (no handshake)",3,0,.9,"good")]),
 "sql-injection-xss": dict(nodes=[N("a","attacker",.1,.16,104,48,0,"bad"), N("f","login form",.5,.16,124,48,1), N("d","database",.9,.16,112,48,2), N("cm","<script> comment",.2,.78,200,48,3,"bad"), N("v","victim browser",.8,.78,180,48,4), N("fx","parameterised queries + escaping",.5,.47,380,44,5,"good")],
     edges=[E("a","f","' OR 1=1",1), E("f","d","built SQL",2), E("cm","v","runs script",4)]),
 "cloud-iaas-paas-saas": dict(nodes=[N("c","cloud provider",.5,.5,592,324,0,"ghost","top"), N("i","IaaS - EC2 (you manage the OS)",.5,.8,540,66,1), N("p","PaaS - App Engine (you deploy code)",.5,.52,540,66,2), N("a","SaaS - Gmail (you just use it)",.5,.24,540,66,3,"good")], edges=[]),
 "how-llms-work": dict(nodes=[N("p","Prompt",.1,.2,92,48,0), N("t","Tokens",.36,.2,92,48,1), N("a","Attention",.63,.2,112,48,2), N("n","Next token",.9,.2,104,48,3,"good"), N("cx","context window",.5,.6,320,48,4,"ghost","c"), N("h","may hallucinate",.5,.92,260,42,5,"bad")],
     edges=[E("p","t","",1), E("t","a","",2), E("a","n","",3), E("n","cx","append",4)]),
}
DBOX = (60, 322, 660, 652)
_mix = lambda c1, c2, k: tuple(int(c1[i] * (1 - k) + c2[i] * k) for i in range(3))
def _ease(x): x = max(0.0, min(1.0, x)); c1 = 1.70158; return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2

def _border_pt(c, u, hw, hh):
    ux, uy = abs(u[0]) + 1e-9, abs(u[1]) + 1e-9
    k = min(hw / ux, hh / uy); return (c[0] + u[0] * k, c[1] + u[1] * k)

def draw_diagram(d, key, t, starts, end_start, acc, gi):
    spec = DIAG.get(key)
    if not spec: return
    x0, y0, x1, y1 = DBOX; AW, AH = x1 - x0, y1 - y0
    rt = lambda g, dt=0.0: (starts[g] if g < len(starts) else end_start) + 0.2 + dt
    nodes = {n["id"]: n for n in spec["nodes"]}
    pos = lambda n: (x0 + n["cx"] * AW, y0 + n["cy"] * AH)
    seq = [e for e in spec["edges"] if e["y"] is not None]
    # lifelines for sequence-style diagrams
    for nid in {e[k] for e in seq for k in ("a", "b")}:
        n = nodes[nid]; X, Y = pos(n)
        if t >= rt(n["g"]):
            for yy in range(int(Y + n["h"] / 2 + 4), int(y0 + AH * 0.97), 14): d.line([(X, yy), (X, yy + 7)], fill=_mix((20, 16, 40), acc, 0.35), width=2)
    # ghosts first (backgrounds), then edges, then the other nodes on top
    def node_draw(n):
        if t < rt(n["g"]): return
        s = _ease((t - rt(n["g"])) / 0.45); X, Y = pos(n); active = (n["g"] == gi)
        col = {"bad": (244, 63, 94), "good": (52, 211, 153)}.get(n["st"], acc)
        edge_col = col if active else _mix(col, (20, 16, 40), 0.45)
        if n["st"] == "bar":
            base = y0 + 0.88 * AH; h = n["h"] * s; w = n["w"]; X = x0 + n["cx"] * AW
            d.rounded_rectangle([X - w / 2, base - h, X + w / 2, base], 8, fill=_mix((20, 16, 40), col, 0.85 if active else 0.5))
            f = font(True, 19); d.text((X, base + 20), n["label"], font=f, fill=INK if active else MUTED, anchor="mm"); return
        w, h = n["w"] * s, n["h"] * s
        fill = None if n["st"] == "ghost" else _mix((20, 18, 44), col, 0.32 if active else 0.12)
        d.rounded_rectangle([X - w / 2, Y - h / 2, X + w / 2, Y + h / 2], 14, fill=fill, outline=edge_col, width=3 if active else 2)
        if s < 0.85: return
        for size in (25, 22, 19, 16):
            f = font(True, size)
            if d.textlength(n["label"], font=f) <= n["w"] - 18: break
        if n["lp"] == "top": d.text((X, Y - n["h"] / 2 + 20), n["label"], font=font(True, 20), fill=INK if active else _mix(col, INK, 0.55), anchor="mm")
        else: d.text((X, Y), n["label"], font=f, fill=INK if (active or n["st"] != "ghost") else MUTED, anchor="mm")
    for n in spec["nodes"]:
        if n["st"] == "ghost": node_draw(n)
    pairs = {(e["a"], e["b"]) for e in spec["edges"]}
    for e in spec["edges"]:
        T0 = rt(e["g"], e["dt"])
        if t < T0: continue
        na, nb = nodes[e["a"]], nodes[e["b"]]; A, B = pos(na), pos(nb)
        lab_shift = (0, 0)
        if e["y"] is not None:
            Y = y0 + e["y"] * AH; P0, P1 = (A[0], Y), (B[0], Y)
        else:
            dx, dy = B[0] - A[0], B[1] - A[1]; L = math.hypot(dx, dy) or 1; u = (dx / L, dy / L)
            P0 = _border_pt(A, u, na["w"] / 2 + 3, na["h"] / 2 + 3); P1 = _border_pt(B, (-u[0], -u[1]), nb["w"] / 2 + 5, nb["h"] / 2 + 5)
            if (e["b"], e["a"]) in pairs:  # opposite edge exists -> shift sideways so both are visible
                off = 12;  # u already flips for the reverse edge, so a constant sign puts them on opposite sides
                nx, ny = -u[1] * off, u[0] * off
                P0, P1 = (P0[0] + nx, P0[1] + ny), (P1[0] + nx, P1[1] + ny)
                lab_shift = (nx * 1.5, ny * 1.5)  # push the label further out so opposite labels do not collide
        col = {"bad": (244, 63, 94), "good": (52, 211, 153)}.get(e["st"], acc); active = e["g"] == gi
        col = _mix(col, (255, 255, 255), 0.25) if active else _mix(col, (20, 16, 40), 0.3)
        p = max(0.0, min(1.0, (t - T0) / 0.6)); Q = (P0[0] + (P1[0] - P0[0]) * p, P0[1] + (P1[1] - P0[1]) * p)
        d.line([P0, Q], fill=col, width=4)
        if p >= 1:
            ang = math.atan2(P1[1] - P0[1], P1[0] - P0[0])
            d.polygon([P1, (P1[0] - 14 * math.cos(ang - .45), P1[1] - 14 * math.sin(ang - .45)), (P1[0] - 14 * math.cos(ang + .45), P1[1] - 14 * math.sin(ang + .45))], fill=col)
            ph = ((t - T0) % 1.7) / 1.7; px, py = P0[0] + (P1[0] - P0[0]) * ph, P0[1] + (P1[1] - P0[1]) * ph  # travelling "packet"
            d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=(255, 255, 255)); d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=col)
            if e["label"]:
                f = font(True, 17); tw = d.textlength(e["label"], font=f); mx, my = (P0[0] + P1[0]) / 2 + lab_shift[0], (P0[1] + P1[1]) / 2 + lab_shift[1] - (13 if e["y"] is not None else 0)
                d.rounded_rectangle([mx - tw / 2 - 8, my - 13, mx + tw / 2 + 8, my + 13], 9, fill=(14, 12, 30), outline=col, width=1)
                d.text((mx, my), e["label"], font=f, fill=INK, anchor="mm")
    for n in spec["nodes"]:
        if n["st"] != "ghost": node_draw(n)

def particles(key, acc):
    rnd = random.Random(key); return [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(-14, 14), rnd.uniform(-22, -6)) for _ in range(34)]

def draw_particles(d, P, t, acc):
    pts = [((x + vx * t) % W, (y + vy * t) % H) for x, y, vx, vy in P]
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            dist = math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
            if dist < 150: d.line([pts[i], pts[j]], fill=_mix((16, 13, 36), acc, 0.28 * (1 - dist / 150)), width=1)
    for x, y in pts: d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=_mix((16, 13, 36), acc, 0.55))

def caption_state(l, text, k, acc, size, f, lines):
    img = layer_canvas(); d = ImageDraw.Draw(img); header(d, l, acc)
    block(d, l["title"], font(True, 32), 60, 205, W - 120, acc + (255,), 8)
    y, i = 690, 0
    d.rounded_rectangle([40, 694, 46, 690 + len(lines) * (size + 12) - 8], 3, fill=acc + (255,))
    for line in lines:
        x = 60
        for w in line:
            col = acc + (255,) if i == k else (INK + (255,) if i < k else DIM + (255,))
            d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f); i += 1
        y += size + 12
    d.text((60, 1130), l["level"].capitalize() + "  -  synthetic voice", font=font(False, 24), fill=MUTED + (255,))
    return img

def static_layer(l, kind, acc):
    img = layer_canvas(); d = ImageDraw.Draw(img); header(d, l, acc)
    if kind == "title":
        y = block(d, l["title"], font(True, 58), 60, 640, W - 120, INK + (255,), 16)
        d.text((60, y + 24), l["level"].capitalize() + "  -  60 sec reel", font=font(False, 28), fill=acc + (255,))
        cx = 60
        for tg in l["tags"][:4]:
            tw = d.textlength("#" + tg, font=font(True, 22)); d.rounded_rectangle([cx, 1040, cx + tw + 28, 1084], 22, fill=tuple(int(c * 0.3) for c in acc) + (255,), outline=acc + (255,), width=2)
            d.text((cx + 14, 1049), "#" + tg, font=font(True, 22), fill=INK + (255,)); cx += tw + 40
    else:
        d.text((60, 300), "REMEMBER", font=font(True, 26), fill=acc + (255,))
        block(d, l["takeaways"][0], font(True, 44), 60, 370, W - 120, INK + (255,), 16)
        block(d, "Take the quiz or ask the AI tutor to lock it in.", font(False, 32), 60, 900, W - 120, MUTED + (255,), 12)
    return img

def split_audio_groups(groups, wpm, tmp):
    paths, durs, speech = [], [], []
    for i, g in enumerate(groups):
        p = os.path.join(tmp, f"a{i}.wav"); tts(g, p, wpm); paths.append(p); sl = wav_len(p); speech.append(sl); durs.append(sl + GAP)
    return paths, durs, speech

def render(l):
    tmp = tempfile.mkdtemp(); acc = ACCENT.get(l["category"], VIOLET); kind = ICON.get(l["category"], "web")
    groups = split_groups(l["transcript"])
    paths, durs, speech = split_audio_groups(groups, 150, tmp)
    wpm = max(105, min(210, 150 * sum(durs) / (TARGET - 6.0)))
    paths, durs, speech = split_audio_groups(groups, wpm, tmp)
    title_t, end_t = 3.5, max(2.5, TARGET - 3.5 - sum(durs))
    starts = [title_t + sum(durs[:i]) for i in range(len(groups))]
    # ---- audio track
    ins = ["-f", "lavfi", "-t", f"{title_t}", "-i", "anullsrc=r=22050:cl=mono"]
    for p in paths: ins += ["-i", p]
    ins += ["-f", "lavfi", "-t", f"{end_t:.3f}", "-i", "anullsrc=r=22050:cl=mono"]
    n = len(paths) + 2
    fl = ["[0:a]anull[a0]"] + [f"[{i+1}:a]aresample=22050,apad=pad_dur={GAP}[a{i+1}]" for i in range(len(paths))] + [f"[{n-1}:a]anull[a{n-1}]"]
    fl.append("".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[aout]")
    audio = os.path.join(tmp, "audio.m4a")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(fl), "-map", "[aout]", "-c:a", "aac", "-b:a", "48k", "-t", f"{TARGET}", audio], check=True)
    # ---- visuals
    bg = bg_image()
    blobs = [(*blob(acc, 640, 0.30), 0.9, 0.0, 120, 60), (*blob(VIOLET, 760, 0.28), 0.6, 2.1, 90, 110), (*blob(CYAN, 560, 0.16), 1.1, 4.0, 110, 80)]
    icon_big = make_icon(kind, 330, acc); icon_glow = glow(icon_big, acc, 14)
    wm = make_icon(kind, 640, acc); wm_mask = wm.getchannel("A").point(lambda v: int(v * 0.09)); wm_rgb = Image.new("RGB", wm.size, acc)
    small = glow(make_icon(kind, 110, acc), acc, 8)
    title_layer, end_layer = static_layer(l, "title", acc), static_layer(l, "end", acc)
    sizes = []
    tmp_d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for g in groups:
        for size in (40, 36, 32, 29, 26):
            f, lines = caption_layout(g, size, tmp_d)
            if 690 + len(lines) * (size + 12) <= 1115: break
        sizes.append((size, f, lines))
    weights = [[len(w) + 2 for w in g.split()] for g in groups]
    cache, cache_gi = {}, -1
    PART = particles(l["key"], acc); end_start = title_t + sum(durs)
    total_frames = int(TARGET * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", audio,
                           "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "29", "-preset", "veryfast", "-c:a", "copy", "-movflags", "+faststart",
                           "-t", f"{TARGET}", os.path.join(OUT_V, l["key"] + ".mp4")], stdin=subprocess.PIPE)
    thumb = None
    for fi in range(total_frames):
        t = fi / FPS
        fr = bg.copy()
        for im, mk, sp, ph, ax, ay in blobs:
            fr.paste(im, (int(W / 2 - im.width / 2 + ax * math.sin(t * sp + ph)), int(H / 2 - im.height / 2 + ay * math.cos(t * sp * 0.8 + ph) + (ph * 40 % 400) - 160)), mk)
        draw_particles(ImageDraw.Draw(fr), PART, t, acc)
        fr.paste(wm_rgb, (int(W - 560 + 14 * math.sin(t * 0.7)), int(520 + 18 * math.cos(t * 0.6))), wm_mask)
        # which slide?
        gi = None
        for i in range(len(groups)):
            if starts[i] <= t < starts[i] + durs[i]: gi = i
        if t < title_t:
            lay, local, dy_fade = title_layer, t, 0.6
            pop = 1.0 - max(0.0, 1.0 - t / 0.7) ** 3
            fr.paste(icon_glow, (int(W / 2 - icon_glow.width / 2), int(190 - (1 - pop) * 40 + 8 * math.sin(t * 2.2))), icon_glow.point(lambda v: int(v * pop)) if pop < 1 else icon_glow)
            od = ImageDraw.Draw(fr); ocx, ocy = W / 2, 190 + icon_glow.height / 2 + 8 * math.sin(t * 2.2)
            for ring in range(2):  # expanding pulse rings + orbiting dots
                ph = ((t * 0.55) + ring * 0.5) % 1.0; r = 170 + ph * 130
                od.ellipse([ocx - r, ocy - r, ocx + r, ocy + r], outline=_mix((16, 13, 36), acc, 0.7 * (1 - ph)), width=3)
            for k in range(4):
                a = t * 1.3 + k * math.pi / 2; r = 215; px, py = ocx + r * math.cos(a), ocy + r * math.sin(a) * 0.9
                od.ellipse([px - 7, py - 7, px + 7, py + 7], fill=_mix(acc, (255, 255, 255), 0.4))
        elif gi is not None:
            if gi != cache_gi: cache, cache_gi = {}, gi
            local = t - starts[gi]
            frac = min(1.0, local / max(0.1, speech[gi])); acc_w, tot = 0, sum(weights[gi]); k = 0
            for j, wv in enumerate(weights[gi]):
                acc_w += wv
                if frac * tot <= acc_w: k = j; break
            else: k = len(weights[gi]) - 1
            if frac >= 1: k = len(weights[gi])
            if k not in cache:
                size, f, lines = sizes[gi]; cache[k] = caption_state(l, groups[gi], k, acc, size, f, lines)
            lay, dy_fade = cache[k], 0.35
            fr.paste(small, (W - 60 - small.width + 10, 80 + int(4 * math.sin(t * 2))), small)
            draw_diagram(ImageDraw.Draw(fr), l["key"], t, starts, end_start, acc, gi)
            # equalizer while speaking
            if local < speech[gi]:
                d = ImageDraw.Draw(fr)
                for b in range(9):
                    h = 10 + 38 * abs(math.sin(t * 9 + b * 1.3) * math.cos(t * 4.1 + b))
                    x = W - 60 - 9 * 14 + b * 14; d.rounded_rectangle([x, 1160 - h, x + 8, 1160], 3, fill=acc)
        else:
            lay, local, dy_fade = end_layer, t - (title_t + sum(durs)), 0.6
            fr.paste(small, (W - 60 - small.width + 10, 80), small)
        f_in = min(1.0, local / dy_fade) if (t < title_t or gi is None or True) else 1.0
        if f_in < 1.0:
            a = lay.getchannel("A").point(lambda v, q=f_in: int(v * q)); fr.paste(lay.convert("RGB"), (0, int((1 - f_in) * 36)), a)
        else: fr.paste(lay.convert("RGB"), (0, 0), lay.getchannel("A"))
        d = ImageDraw.Draw(fr); d.rounded_rectangle([60, 1190, W - 60, 1198], 4, fill=(50, 45, 80))
        d.rounded_rectangle([60, 1190, 60 + max(8, int((W - 120) * t / TARGET)), 1198], 4, fill=acc)
        if fi == int(FPS * 1.2) and thumb is None: thumb = fr.copy()
        ff.stdin.write(fr.tobytes())
    ff.stdin.close(); ff.wait()
    # thumbnail: title slide at its fully-animated-in moment
    t_img = bg.copy()
    for im, mk, sp, ph, ax, ay in blobs: t_img.paste(im, (int(W / 2 - im.width / 2), int(H / 2 - im.height / 2 + (ph * 40 % 400) - 160)), mk)
    t_img.paste(wm_rgb, (W - 560, 520), wm_mask); t_img.paste(icon_glow, (int(W / 2 - icon_glow.width / 2), 190), icon_glow)
    t_img.paste(title_layer.convert("RGB"), (0, 0), title_layer.getchannel("A"))
    t_img.resize((360, 640)).save(os.path.join(OUT_T, l["key"] + ".jpg"), quality=88)
    return os.path.join(OUT_V, l["key"] + ".mp4")

if __name__ == "__main__":
    import time
    data = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./backend/src/seed/lessons').lessons))"], cwd=ROOT))
    only = set(sys.argv[1:])
    mpath = os.path.join(ROOT, "backend", "seed-assets", "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for l in data:
        if only and l["key"] not in only: continue
        t0 = time.time(); p = render(l); d = wav_len(p); manifest[l["key"]] = {"duration": round(d)}
        print(f"{l['key']}: {os.path.getsize(p)//1024} KB, {d:.1f}s, rendered in {time.time()-t0:.0f}s", flush=True)
        json.dump(manifest, open(mpath, "w"), indent=1)
