"""Build Video B (Product tour, 45s, 1920x1080) for Subtitle Overlay.

Reuses the layer/keyframe helpers from build_A. Usage: python3 build_B.py create|keys|media <editable.json>
"""
import json
import sys

import build_A as A
from build_A import (BOLD, REG, WHITE, PURE_WHITE, BLACK, INK, PANEL, BAR, FIELD, MUTED, BLUE, CHIP, YELLOW,
                     LINEAR, HOLD, EASE_OUT, EASE_IN_OUT, W, H, rect, text, shape, group, gradient_bg, caption,
                     kf, fade, pop, rng, tf)

DUR = 45000

# The popup image is 580px wide (2x CSS) shown at 78%: 1 CSS px = 1.56 composition px.
POP_S = 78
POP_RIGHT, POP_TOP = 1880, 76
POP_LEFT = POP_RIGHT - 580 * POP_S / 100


def P(cx, cy):
    """Popup CSS coordinates -> composition coordinates."""
    return (round(POP_LEFT + cx * 1.56), round(POP_TOP + cy * 1.56))


SWITCH = P(256, 21)
ROW_SIZE = P(120, 105)
OPT_150 = P(70, 295)
PLUS = P(256, 84)
SV_WHITE = P(14, 293)
SV_YELLOW = P(182, 293)

CURSOR_START = 4800
SUB_LINES = [  # (start, end, text) original Korean sample lines
    (11250, 16000, "저 호수 끝까지 같이 걸어갈래?"),
    (16000, 23000, "노을이 정말 예쁘다."),
    (23000, 30000, "방금 그 말, 다시 한 번 해 줄래?"),
    (30000, 37000, "노을이 지기 전에 사진 한 장 찍자!"),
    (37000, 42000, "여기라면 화면을 가리지 않겠지?"),
]


def subtitle(lid, start, end, s, size=64):
    text(lid, f"Subtitle: {s}", start, end - start, 960, 960, s, size=size, color=PURE_WHITE, just="center",
         stroke=(BLACK, 9))


def build_create():
    # --- player chrome (4-42s); the browser chrome is one group so fullscreen can slide it away
    rect(3, "Progress track", 4000, 38000, 60, 1030, 1800, 8, [1, 1, 1, 0.25], radius=4)
    rect(4, "Progress fill", 4000, 38000, 60, 1030, 1800, 8, A.SKY, radius=4)
    group(10, "Browser chrome", 4000, 38000)
    rect(11, "Browser bar", 0, 38000, 0, 0, W, 64, BAR, parent=10)
    rect(12, "Address field", 0, 38000, 150, 14, 1420, 36, FIELD, radius=18, parent=10)
    text(13, "Address text", 0, 38000, 178, 41, "video.example/watch/episode-01", font=REG, size=22, color=MUTED, parent=10)
    for i, cx in enumerate((40, 68, 96)):
        shape(14 + i, f"Window dot {i+1}", 0, 38000, cx, 32, ellipse=[14, 14], fill=[0.29, 0.30, 0.34, 1], parent=10)

    # --- subtitles (one layer per line) and the colour shot's background box
    rect(39, "Subtitle box (50%)", 33000, 4000, 960, 938, 1010, 92, [0, 0, 0, 1], radius=10, ax=505, ay=46)
    for i, (a, b, s) in enumerate(SUB_LINES):
        subtitle(40 + i, a, b, s)

    # --- shot 2: dragged file chip + format chips
    group(50, "File chip", 4900, 1650, 420, 600, 420, 600)
    rect(51, "Chip box", 0, 1650, 190, 560, 460, 80, CHIP, radius=16, parent=50, stroke=(PURE_WHITE, 3))
    text(52, "Chip text", 0, 1650, 420, 612, "episode01.kor.smi", font=REG, size=34, color=PURE_WHITE, just="center", parent=50)
    group(55, "Format chips", 7000, 2900)
    for i, (x, s) in enumerate(((80, ".ASS"), (270, ".SRT"), (460, ".SMI"))):
        g = 56 + i * 3
        group(g, f"Chip {s}", i * 200, 2900 - i * 200, x + 85, 470, x + 85, 470, parent=55)
        rect(g + 1, f"{s} box", 0, 2900 - i * 200, x, 430, 170, 80, [0.145, 0.157, 0.184, 0.92], radius=16, parent=g)
        text(g + 2, f"{s} label", 0, 2900 - i * 200, x + 85, 484, s, size=40, color=A.SKY, just="center", parent=g)

    # --- shot 5: keycaps
    group(70, "Keycaps", 25500, 4400)
    for i, (x, s) in enumerate(((80, "Alt"), (160, "["), (330, "Alt"), (410, "]"))):
        g = 71 + i * 3
        group(g, f"Key {s}{i}", 0, 4400, x + 35, 880, x + 35, 880, parent=70)
        kw = 76 if s == "Alt" else 64
        rect(g + 1, "Key cap", 0, 4400, x, 845, kw, 70, [0.95, 0.95, 0.96, 1], radius=12, parent=g)
        text(g + 2, "Key glyph", 0, 4400, x + kw / 2, 894, s, size=34 if s == "Alt" else 40, color=[0.08, 0.08, 0.08, 1],
             just="center", parent=g)
    text(84, "Keys: earlier", 0, 4400, 80, 960, "earlier", font=REG, size=26, color=WHITE, parent=70)
    text(85, "Keys: later", 0, 4400, 330, 960, "later", font=REG, size=26, color=WHITE, parent=70)

    # --- shot 7: fullscreen corner brackets, drag outline, saved pill
    group(90, "Fullscreen corners", 37300, 900, 960, 540, 960, 540)
    L = 90
    for i, (x, y, dx, dy) in enumerate(((40, 40, 1, 1), (W - 40, 40, -1, 1), (40, H - 40, 1, -1), (W - 40, H - 40, -1, -1))):
        cmds = [{"type": "moveTo", "x": x, "y": y + dy * L}, {"type": "lineTo", "x": x, "y": y},
                {"type": "lineTo", "x": x + dx * L, "y": y}]
        shape(91 + i, f"Corner {i+1}", 0, 900, 0, 0, commands=cmds, stroke=(A.SKY, 10), parent=90)
    group(95, "Drag outline", 38000, 2000)
    rect(96, "Outline", 0, 2000, 960, 940, 900, 96, [0, 0, 0, 0], radius=10, parent=95, stroke=(PURE_WHITE, 3),
         dashes=[14, 10], ax=450, ay=60)
    group(97, "Position saved", 39400, 1000, 1180, 700, 1180, 700)
    rect(98, "Saved pill", 0, 1000, 1020, 672, 320, 56, [0.08, 0.08, 0.10, 0.85], radius=28, parent=97)
    text(99, "Saved text", 0, 1000, 1180, 709, "Position saved", font=REG, size=26, color=WHITE, just="center", parent=97)

    # --- the cursor travels through the whole tour
    cursor = [{"type": "moveTo", "x": 0, "y": 0}, {"type": "lineTo", "x": 0, "y": 46}, {"type": "lineTo", "x": 12, "y": 35},
              {"type": "lineTo", "x": 21, "y": 54}, {"type": "lineTo", "x": 29, "y": 50}, {"type": "lineTo", "x": 20, "y": 32},
              {"type": "lineTo", "x": 35, "y": 32}, {"type": "close"}]
    shape(100, "Cursor", CURSOR_START, 41000 - CURSOR_START, 900, 700, commands=cursor, fill=PURE_WHITE, stroke=(INK, 3))

    # --- captions
    caption(110, 4200, 5700, "Load any subtitle file")
    caption(120, 10150, 5750, "Turn it on")
    caption(130, 16150, 6750, "Size: 50–200%")
    caption(140, 23150, 6750, "Fix the timing")
    caption(150, 30150, 6750, "Make it easy to read")
    caption(160, 37150, 4750, "Drag it, even in fullscreen")

    # --- shot 1: title card (0-4s); icon image inserted by place_media()
    group(300, "Title card", 0, 4000)
    rect(301, "Title background", 0, 4000, 0, 0, W, H, [0.078, 0.082, 0.098, 1], parent=300)
    text(302, "Title", 800, 3200, 960, 600, "Subtitle Overlay", size=112, color=PURE_WHITE, just="center", parent=300)
    text(303, "Title sub", 1800, 2200, 960, 690, "a quick tour", font=REG, size=48, color=MUTED, just="center", parent=300)

    # --- shot 8: end card (42-45s)
    group(200, "End card", 42000, 3000)
    gradient_bg(201, "End card background", 0, 3000, parent=200)
    text(211, "End title", 0, 3000, 960, 600, "Subtitle Overlay", size=112, color=PURE_WHITE, just="center", parent=200)
    text(221, "End tagline", 0, 3000, 960, 690, "Your subtitles on any web video", font=REG, size=46,
         color=[0.86, 0.90, 1, 1], just="center", parent=200)
    rect(231, "Links pill", 0, 3000, 400, 748, 1120, 84, [1, 1, 1, 0.14], radius=18, parent=200)
    text(232, "Links", 0, 3000, 960, 802, "Chrome Web Store  ·  github.com/dhsdb010/Subtitle_Overlay", font=REG, size=32,
         color=PURE_WHITE, just="center", parent=200)


def move(lid, x, pts):
    """Paired spatial position path: X held at x, Y keyed at the same times. pts = [(t, y, easing)]."""
    def track(vals):
        frames = []
        for t, v, e in vals:
            A._kid[0] += 1
            frames.append({"id": f"k{A._kid[0]}", "layerTime": int(t), "value": {"type": "float", "value": float(v)},
                           "easing": e})
        return {"keyframes": frames}
    A.keys.append({"type": "setFxPositionKeyframes", "compositionId": A.COMP, "layerId": lid,
                   "positionX": track([(t, x, e) for t, _, e in pts]), "positionY": track(pts)})


def C(t):
    """Project time -> cursor-layer time."""
    return t - CURSOR_START


def build_keys():
    kf(4, "scaleX", [(0, 10, LINEAR), (38000, 58, LINEAR)])

    # title card: icon pop is on the image; title types in; card fades out
    A.keys.append({"type": "setFxPropertyAnimator", "compositionId": A.COMP,
                   "property": {"layerId": 302, "propertyType": "textContent"}, "dependencies": [],
                   "animator": {"type": "jsScript", "layerTimeJsCode":
                                "var s='Subtitle Overlay'; var n=Math.max(0,Math.min(s.length,Math.floor(input.time.milliseconds/50)+1)); return s.slice(0,n);"}})
    fade(303, 2200, 400, 0)
    kf(300, "opacity", [(3600, 100, LINEAR), (4000, 0, LINEAR)])

    # cursor path: (project ms, x, y)
    path = [
        (4800, 900, 700), (5200, 470, 640),            # to the chip
        (5400, 470, 640), (6300, 1640, 440),           # drag into popup
        (6600, 1500, 620), (10200, 1500, 620),
        (10900, SWITCH[0], SWITCH[1]),                  # switch
        (11400, SWITCH[0], SWITCH[1]), (16000, 1560, 420),
        (16450, ROW_SIZE[0], ROW_SIZE[1]),              # Subtitle Size row
        (16800, ROW_SIZE[0], ROW_SIZE[1]), (17400, OPT_150[0], OPT_150[1]),  # 150%
        (18000, OPT_150[0], OPT_150[1]), (23600, PLUS[0], PLUS[1]),            # plus button
        (24800, PLUS[0], PLUS[1]), (30600, SV_WHITE[0], SV_WHITE[1]),          # colour square
        (30800, SV_WHITE[0], SV_WHITE[1]), (31800, SV_YELLOW[0], SV_YELLOW[1]),
        (32200, SV_YELLOW[0], SV_YELLOW[1]), (37900, 1420, 935),               # grab the subtitle
        (38300, 1420, 935), (39300, 1640, 615), (41000, 1640, 615),            # drag in fullscreen
    ]
    kf(100, "positionX", [(C(t), x, EASE_IN_OUT) for t, x, _ in path])
    kf(100, "positionY", [(C(t), y, EASE_IN_OUT) for t, _, y in path])
    clicks = [11000, 16550, 17500, 23800, 24150, 24500, 30700, 38000]
    sc = [(0, 100, LINEAR)]
    for t in clicks:
        sc += [(C(t) - 60, 100, LINEAR), (C(t), 82, EASE_OUT), (C(t) + 140, 100, EASE_OUT)]
    kf(100, "scaleX", sc)
    kf(100, "scaleY", sc)
    kf(100, "opacity", [(0, 0, LINEAR), (200, 100, EASE_OUT), (C(40700), 100, LINEAR), (C(41000), 0, LINEAR)])

    # file chip follows the cursor during the drag, then shrinks into the popup
    kf(50, "opacity", [(0, 0, LINEAR), (250, 100, EASE_OUT), (1400, 100, LINEAR), (1650, 0, LINEAR)])
    kf(50, "positionX", [(500, 420, LINEAR), (1400, 1590, EASE_IN_OUT)])
    kf(50, "positionY", [(500, 600, LINEAR), (1400, 400, EASE_IN_OUT)])
    kf(50, "scaleX", [(1300, 100, LINEAR), (1650, 50, EASE_IN_OUT)])
    kf(50, "scaleY", [(1300, 100, LINEAR), (1650, 50, EASE_IN_OUT)])
    for i in range(3):
        pop(56 + i * 3, 0)
    fade(55, 2900, 1, 300)

    # subtitles
    for i, (a, b, s) in enumerate(SUB_LINES):
        lid, d = 40 + i, b - a
        kf(lid, "opacity", [(0, 0, LINEAR), (300, 100, EASE_OUT), (d - 150, 100, LINEAR), (d, 0, LINEAR)])
    kf(41, "scaleX", [(1550, 100, LINEAR), (2050, 150, EASE_OUT)])        # size 150%
    kf(41, "scaleY", [(1550, 100, LINEAR), (2050, 150, EASE_OUT)])
    kf(43, "fillColor", [(800, PURE_WHITE, LINEAR), (1800, YELLOW, EASE_IN_OUT)])  # colour picker drag
    kf(39, "opacity", [(0, 0, LINEAR), (500, 50, EASE_OUT), (3850, 50, LINEAR), (4000, 0, LINEAR)])
    # drag in fullscreen (line 44 starts at 37s)
    kf(44, "positionX", [(1300, 960, LINEAR), (2300, 1180, EASE_IN_OUT)])
    kf(44, "positionY", [(1300, 960, LINEAR), (2300, 640, EASE_IN_OUT)])
    kf(95, "opacity", [(0, 0, LINEAR), (200, 100, EASE_OUT), (1800, 100, LINEAR), (2000, 0, LINEAR)])
    kf(95, "positionX", [(300, 0, LINEAR), (1300, 220, EASE_IN_OUT)])
    kf(95, "positionY", [(300, 0, LINEAR), (1300, -320, EASE_IN_OUT)])
    pop(97, 0, 108)
    kf(97, "opacity", [(0, 100, LINEAR), (750, 100, LINEAR), (1000, 0, LINEAR)])

    # keycaps: fade in, then press [ and ]
    fade(70, 4400, 300, 300)
    for g, t in ((71 + 3, 500), (71 + 9, 900)):
        kf(g, "scaleX", [(t, 100, LINEAR), (t + 80, 88, EASE_OUT), (t + 220, 100, EASE_OUT)])
        kf(g, "scaleY", [(t, 100, LINEAR), (t + 80, 88, EASE_OUT), (t + 220, 100, EASE_OUT)])

    # fullscreen: browser chrome slides up, corners flash
    move(10, 0, [(33300, 0, LINEAR), (33600, -70, EASE_IN_OUT)])
    kf(90, "opacity", [(0, 0, LINEAR), (150, 100, EASE_OUT), (650, 100, LINEAR), (900, 0, LINEAR)])
    kf(90, "scaleX", [(0, 92, LINEAR), (400, 100, EASE_OUT)])
    kf(90, "scaleY", [(0, 92, LINEAR), (400, 100, EASE_OUT)])

    # end card
    kf(200, "opacity", [(0, 0, LINEAR), (450, 100, EASE_OUT)])


def place_media(doc):
    layers = doc["composition"]["layers"]

    def index_of(lid):
        return next(i for i, l in enumerate(layers) if l["id"] == lid)

    def image(lid, name, asset, start, dur, x, y, ax, ay, s, parent=None):
        l = {"type": "Image", "id": lid, "name": name, "blendMode": "normal", "activeRange": rng(start, dur),
             "transform": tf(x, y, ax, ay, s), "source": {"assetId": asset, "fit": "contain"}}
        if parent is not None:
            l["parent"] = parent
        return l

    layers.append(image(1, "Scene: dusk lake", "scene", 4000, 38000, 960, 604, 960, 540, 100))
    chrome = layers[index_of(10)]
    chrome["layers"].insert(0, image(18, "Toolbar icon", "icon", 0, 38000, 1852, 32, 256, 256, 8, parent=10))

    # popup sequence, inserted behind the file chip (50) so the chip lands on top
    pops = [
        (500, "popup-before", 4200, 2300), (501, "b-off-msg", 6400, 4700), (502, "b-on", 11000, 5600),
        (503, "b-size100", 16550, 1000), (504, "b-size150", 17500, 5550), (505, "b-t0", 23000, 850),
        (506, "b-t1", 23800, 400), (507, "b-t2", 24150, 400), (508, "b-t3", 24500, 5550),
        (509, "b-color-white", 30000, 1950), (510, "b-color-yellow", 31700, 5700),
    ]
    at = index_of(50) + 1
    for lid, asset, start, dur in reversed(pops):
        layers.insert(at, image(lid, f"Popup: {asset}", asset, start, dur, POP_RIGHT, POP_TOP, 580, 0, POP_S))

    # title + end card icons
    layers[index_of(300)]["layers"].insert(0, image(304, "Title icon", "icon", 300, 3700, 960, 380, 256, 256, 42, parent=300))
    layers[index_of(200)]["layers"].insert(0, image(202, "End icon", "icon", 0, 3000, 960, 380, 256, 256, 42, parent=200))

    def sfx(lid, asset, at_ms, dur_ms, vol):
        return {"type": "Audio", "id": lid, "name": f"SFX {asset} @{at_ms}", "activeRange": rng(at_ms, dur_ms),
                "sourceRange": rng(0, dur_ms), "sourceIntrinsicDuration": dur_ms, "windowMs": dur_ms,
                "source": {"assetId": asset}, "volume": round(vol * A.SFX_GAIN, 3), "captionsEnabled": False,
                "metadata": {"modality": "soundEffect", "source": "generated"}}

    D = {"sfx-pop": 180, "sfx-click": 65, "sfx-impact": 400, "sfx-whoosh": 600, "sfx-ping": 480, "sfx-tap": 100}
    cues = [
        ("sfx-pop", 300, 0.9), ("sfx-whoosh", 3650, 0.6),
        ("sfx-whoosh", 4050, 0.6), ("sfx-pop", 4900, 0.7), ("sfx-whoosh", 5500, 0.5), ("sfx-tap", 6350, 0.9),
        ("sfx-ping", 6450, 0.7), ("sfx-tap", 7000, 0.7), ("sfx-tap", 7200, 0.7), ("sfx-tap", 7400, 0.7),
        ("sfx-click", 11000, 1.0),
        ("sfx-click", 16550, 0.9), ("sfx-click", 17500, 0.9), ("sfx-whoosh", 17450, 0.45),
        ("sfx-click", 23800, 0.8), ("sfx-click", 24150, 0.8), ("sfx-click", 24500, 0.8), ("sfx-tap", 26000, 0.8),
        ("sfx-tap", 26400, 0.8),
        ("sfx-click", 30700, 0.8), ("sfx-whoosh", 30900, 0.45), ("sfx-whoosh", 32900, 0.4),
        ("sfx-whoosh", 37150, 0.7), ("sfx-tap", 38000, 0.8), ("sfx-whoosh", 38550, 0.5), ("sfx-pop", 39400, 0.7),
        ("sfx-whoosh", 41850, 0.7), ("sfx-ping", 42300, 0.6),
    ]
    for i, (asset, at_ms, v) in enumerate(cues):
        layers.append(sfx(900 + i, asset, at_ms, D[asset], v))
    doc["duration"] = DUR / 1000
    return doc


def place_extra_keys():
    """Keyframes on the image layers (they exist only after place_media)."""
    # popups: slide-in for the first, crossfades for the rest, exit for the last
    move(500, POP_RIGHT, [(0, 40, LINEAR), (350, POP_TOP, EASE_OUT)])
    kf(500, "opacity", [(0, 0, LINEAR), (350, 100, EASE_OUT)])
    for lid in range(501, 510):  # 510 gets its own fade in + out below
        kf(lid, "opacity", [(0, 0, LINEAR), (140, 100, EASE_OUT)])
    move(510, POP_RIGHT, [(5300, POP_TOP, LINEAR), (5650, 40, EASE_IN_OUT)])
    kf(510, "opacity", [(0, 0, LINEAR), (140, 100, EASE_OUT), (5300, 100, LINEAR), (5650, 0, LINEAR)])
    # title icon pop, scene slides to fill the frame for fullscreen (scene starts at 4s)
    kf(304, "scaleX", [(0, 0, LINEAR), (180, 47, EASE_OUT), (320, 42, EASE_IN_OUT)])
    kf(304, "scaleY", [(0, 0, LINEAR), (180, 47, EASE_OUT), (320, 42, EASE_IN_OUT)])
    move(1, 960, [(33300, 604, LINEAR), (33600, 540, EASE_IN_OUT)])


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "create":
        build_create()
        json.dump(A.actions, open("B-create.json", "w"), ensure_ascii=False, indent=1)
        print(len(A.actions), "create actions")
    elif mode == "keys":
        build_create()
        A.keys.clear()
        A._kid[0] = 0
        A.actions.clear()
        build_create()
        build_keys()
        place_extra_keys()
        json.dump(A.keys, open("B-keys.json", "w"), ensure_ascii=False, indent=1)
        print(len(A.keys), "keyframe actions")
    elif mode == "media":
        p = sys.argv[2]
        doc = json.load(open(p))
        json.dump(place_media(doc), open(p, "w"), ensure_ascii=False, indent=1)
        print("media placed")
