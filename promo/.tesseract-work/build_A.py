"""Build Video A (Problem -> Fix, 30s, 1920x1080) for Subtitle Overlay.

Writes three files next to this script:
  A-create.json     action batch that creates shape/text/group layers
  A-keys.json       action batch with all keyframes
  (images + audio are inserted into the checked-out document by place_media())

Usage: python3 build_A.py create|keys|media <editable.json>
"""
import json
import sys

COMP = "main"
W, H = 1920, 1080

# palette (0-1 RGBA)
WHITE = [0.95, 0.95, 0.96, 1]
PURE_WHITE = [1, 1, 1, 1]
BLACK = [0, 0, 0, 1]
INK = [0.08, 0.08, 0.10, 1]
PANEL = [0.082, 0.082, 0.082, 1]
BAR = [0.165, 0.169, 0.192, 1]
FIELD = [0.106, 0.110, 0.129, 1]
MUTED = [0.66, 0.68, 0.73, 1]
DIM = [0.45, 0.47, 0.53, 1]
BLUE = [0.18, 0.36, 0.88, 1]
SKY = [0.42, 0.61, 1.0, 1]
ORANGE = [0.95, 0.65, 0.48, 1]
YELLOW = [1.0, 0.95, 0.36, 1]
CHIP = [0.145, 0.157, 0.184, 1]

BOLD = ("Gothic A1", "Bold")
SFX_GAIN = 2.2  # ~ +7 dB: the generated cues peak at -12 dBFS
REG = ("DM Sans", "Regular")

actions = []
keys = []
_kid = [0]


def tf(x, y, ax=0, ay=0, s=100, op=100):
    return {"anchorPoint": [ax, ay], "position": [x, y], "scale": [s, s], "rotation": 0, "opacity": op}


def rng(start, dur):
    return {"start": int(start), "duration": int(dur)}


def rect(lid, name, start, dur, x, y, w, h, color, radius=0, parent=None, stroke=None, dashes=None, ax=0, ay=0):
    r = {"size": [w, h], "fillColor": color, "roundness": radius}
    if color[3] == 0:
        r["fillEnabled"] = False
    if stroke:
        r.update({"strokeEnabled": True, "strokeColor": stroke[0], "strokeWidth": stroke[1]})
        if dashes:
            r["strokeDashes"] = dashes
    a = {"type": "createFxRectLayer", "compositionId": COMP, "layerId": lid, "name": name, "insertIndex": 0,
         "activeRange": rng(start, dur), "transform": tf(x, y, ax, ay), "rect": r}
    if parent is not None:
        a["parentLayerId"] = parent
    actions.append(a)


def text(lid, name, start, dur, x, y, s, font=BOLD, size=44, color=WHITE, just="left", parent=None, stroke=None):
    st = {"text": s, "fontFamily": font[0], "fontStyle": font[1], "fontSize": size, "fillColor": color,
          "strokeWidth": 0, "justification": just}
    if stroke:
        st.update({"strokeColor": stroke[0], "strokeWidth": stroke[1], "applyStroke": True, "strokeOverFill": False})
    a = {"type": "createFxTextLayer", "compositionId": COMP, "layerId": lid, "name": name, "insertIndex": 0,
         "activeRange": rng(start, dur), "transform": tf(x, y), "sourceText": st}
    if parent is not None:
        a["parentLayerId"] = parent
    actions.append(a)


def shape(lid, name, start, dur, x, y, commands=None, ellipse=None, fill=None, stroke=None, parent=None, cap="round"):
    sh = {"path": {"commands": commands or []}, "fills": [], "strokes": []}
    if ellipse:
        sh["ellipse"] = {"size": ellipse, "position": [0, 0]}
    if fill:
        sh["fills"].append({"paint": {"type": "solid", "color": fill}, "fillRule": "nonZeroWinding", "blendMode": "normal", "opacity": 100})
    if stroke:
        sh["strokes"].append({"paint": {"type": "solid", "color": stroke[0]}, "width": stroke[1], "cap": cap, "join": "round",
                              "miterLimit": 4, "blendMode": "normal", "opacity": 100})
    a = {"type": "createFxShapeLayer", "compositionId": COMP, "layerId": lid, "name": name, "insertIndex": 0,
         "activeRange": rng(start, dur), "transform": tf(x, y), "shape": sh}
    if parent is not None:
        a["parentLayerId"] = parent
    actions.append(a)


def gradient_bg(lid, name, start, dur, parent=None):
    cmds = [{"type": "moveTo", "x": 0, "y": 0}, {"type": "lineTo", "x": W, "y": 0},
            {"type": "lineTo", "x": W, "y": H}, {"type": "lineTo", "x": 0, "y": H}, {"type": "close"}]
    sh = {"path": {"commands": cmds}, "strokes": [], "fills": [{
        "paint": {"type": "gradient", "gradientType": "linear", "start": [0, 0], "end": [W, H],
                  "stops": [{"offset": 0, "color": [0.106, 0.165, 0.322, 1]}, {"offset": 1, "color": [0.18, 0.36, 0.88, 1]}]},
        "fillRule": "nonZeroWinding", "blendMode": "normal", "opacity": 100}]}
    a = {"type": "createFxShapeLayer", "compositionId": COMP, "layerId": lid, "name": name, "insertIndex": 0,
         "activeRange": rng(start, dur), "transform": tf(0, 0), "shape": sh}
    if parent is not None:
        a["parentLayerId"] = parent
    actions.append(a)


def group(lid, name, start, dur, x=0, y=0, ax=0, ay=0, parent=None):
    a = {"type": "createFxGroupLayer", "compositionId": COMP, "layerId": lid, "name": name, "insertIndex": 0,
         "activeRange": rng(start, dur), "transform": tf(x, y, ax, ay)}
    if parent is not None:
        a["parentLayerId"] = parent
    actions.append(a)


EASE_OUT = {"type": "cubicBezier", "x1": 0.2, "y1": 0, "x2": 0.2, "y2": 1}
EASE_IN_OUT = {"type": "cubicBezier", "x1": 0.6, "y1": 0, "x2": 0.3, "y2": 1}
LINEAR = {"type": "linear"}
HOLD = {"type": "hold"}


def kf(lid, prop, points):
    """points: list of (layerTime_ms, value, easing)"""
    frames = []
    for t, v, e in points:
        _kid[0] += 1
        if isinstance(v, list):
            val = {"type": "color", "value": v}
        else:
            val = {"type": "float", "value": float(v)}
        frames.append({"id": f"k{_kid[0]}", "layerTime": int(t), "value": val, "easing": e})
    keys.append({"type": "setFxPropertyKeyframes", "compositionId": COMP,
                 "property": {"layerId": lid, "propertyType": prop}, "keyframes": frames})


def fade(lid, dur, fin=250, fout=250, peak=100):
    pts = [(0, 0, LINEAR), (fin, peak, EASE_OUT)]
    if fout:
        pts += [(dur - fout, peak, LINEAR), (dur, 0, LINEAR)]
    kf(lid, "opacity", pts)


def pop(lid, at=0, peak=112):
    kf(lid, "scaleX", [(at, 0, LINEAR), (at + 180, peak, EASE_OUT), (at + 320, 100, EASE_IN_OUT)])
    kf(lid, "scaleY", [(at, 0, LINEAR), (at + 180, peak, EASE_OUT), (at + 320, 100, EASE_IN_OUT)])


# ---------------------------------------------------------------- captions
CAP_X, CAP_Y, CAP_H = 80, 104, 84


def caption(gid, start, dur, s, size=44):
    """Blue pill + text in a group that slides in from the left."""
    width = int(len(s) * size * 0.56) + 72
    group(gid, f"Caption: {s}", start, dur)
    rect(gid + 1, "Caption pill", 0, dur, CAP_X, CAP_Y, width, CAP_H, BLUE, radius=16, parent=gid)
    text(gid + 2, "Caption text", 0, dur, CAP_X + 36, CAP_Y + 57, s, size=size, color=WHITE, parent=gid)
    kf(gid, "positionX", [(0, -40, LINEAR), (300, 0, EASE_OUT)])
    fade(gid, dur, 220, 220)


# ======================================================================
# Layers are created back-to-front (each insertIndex 0 lands in front).
# The scene image is inserted at the very back by place_media().
# ======================================================================
def build_create():
    # --- video player chrome (0-25s)
    rect(2, "Dim (player menu)", 4000, 3000, 0, 0, W, H, [0, 0, 0, 1])
    rect(3, "Progress track", 0, 25000, 60, 1030, 1800, 8, [1, 1, 1, 0.25], radius=4)
    rect(4, "Progress fill", 0, 25000, 60, 1030, 1800, 8, SKY, radius=4)
    rect(5, "Browser bar", 0, 25000, 0, 0, W, 64, BAR)
    rect(6, "Address field", 0, 25000, 150, 14, 1420, 36, FIELD, radius=18)
    text(7, "Address text", 0, 25000, 178, 41, "video.example/watch/episode-01", font=REG, size=22, color=MUTED)
    for i, cx in enumerate((40, 68, 96)):
        shape(8 + i, f"Window dot {i+1}", 0, 25000, cx, 32, ellipse=[14, 14], fill=[0.29, 0.30, 0.34, 1])

    # --- shot 1: question bubbles (0.8-3.9s)
    group(20, "Question bubbles", 800, 3100)
    shape(21, "Bubble 1", 0, 3100, 840, 560, ellipse=[132, 132], fill=[0.08, 0.08, 0.12, 0.55], stroke=(PURE_WHITE, 6), parent=20)
    text(22, "Bubble 1 ?", 0, 3100, 840, 586, "?", size=78, color=PURE_WHITE, just="center", parent=20)
    shape(23, "Bubble 2", 450, 2650, 1010, 470, ellipse=[100, 100], fill=[0.08, 0.08, 0.12, 0.55], stroke=(PURE_WHITE, 5), parent=20)
    text(24, "Bubble 2 ?", 450, 2650, 1010, 491, "?", size=60, color=PURE_WHITE, just="center", parent=20)

    # --- shot 2: player subtitle menu (4.0-7.0s)
    group(30, "CC button", 4000, 3000)
    rect(31, "CC box", 0, 3000, 1780, 976, 64, 40, [0, 0, 0, 0], radius=6, parent=30, stroke=(PURE_WHITE, 3))
    text(32, "CC label", 0, 3000, 1812, 1004, "CC", size=22, color=PURE_WHITE, just="center", parent=30)
    group(40, "Player subtitle menu", 4400, 2600, 1610, 790, 1610, 790)
    rect(41, "Menu panel", 0, 2600, 1380, 640, 460, 300, PANEL, radius=18, parent=40, stroke=([0.35, 0.37, 0.44, 1], 2))
    text(42, "Menu title", 0, 2600, 1420, 702, "Subtitles", size=34, color=WHITE, parent=40)
    rect(43, "Menu divider", 0, 2600, 1420, 726, 380, 2, [0.2, 0.21, 0.25, 1], parent=40)
    text(44, "Menu: none", 0, 2600, 1420, 798, "No subtitles", size=34, color=MUTED, parent=40)
    text(45, "Menu: no files", 0, 2600, 1420, 864, "Your own file: not supported", font=REG, size=26, color=DIM, parent=40)
    x_cmds = [{"type": "moveTo", "x": -78, "y": -78}, {"type": "lineTo", "x": 78, "y": 78},
              {"type": "moveTo", "x": 78, "y": -78}, {"type": "lineTo", "x": -78, "y": 78}]
    shape(46, "Stamp X", 600, 2000, 1610, 790, commands=x_cmds, stroke=(ORANGE, 24), parent=40)

    # --- shot 3: file chip flying into the popup (8.1-9.3s)
    group(50, "File chip", 8100, 1250, 520, 640, 520, 640)
    rect(51, "Chip box", 0, 1250, 290, 600, 460, 80, CHIP, radius=16, parent=50, stroke=(PURE_WHITE, 3))
    text(52, "Chip text", 0, 1250, 520, 652, "episode01.kor.ass", font=REG, size=34, color=PURE_WHITE, just="center", parent=50)

    # --- shot 4-5: the subtitle itself (11.5-25s)
    group(60, "Drag rig", 22500, 2500)
    rect(61, "Drag outline", 0, 2500, 960, 940, 940, 96, [0, 0, 0, 0], radius=10, parent=60,
         stroke=(PURE_WHITE, 3), dashes=[14, 10], ax=470, ay=60)
    cursor = [{"type": "moveTo", "x": 0, "y": 0}, {"type": "lineTo", "x": 0, "y": 46}, {"type": "lineTo", "x": 12, "y": 35},
              {"type": "lineTo", "x": 21, "y": 54}, {"type": "lineTo", "x": 29, "y": 50}, {"type": "lineTo", "x": 20, "y": 32},
              {"type": "lineTo", "x": 35, "y": 32}, {"type": "close"}]
    shape(62, "Cursor", 150, 2350, 1360, 930, commands=cursor, fill=PURE_WHITE, stroke=(INK, 3), parent=60)
    text(63, "Subtitle (KO)", 11500, 13500, 960, 960, "오늘 밤은 별이 정말 잘 보이네.", size=64, color=PURE_WHITE,
         just="center", stroke=(BLACK, 9))

    # timing counter (20.0-22.5s)
    group(70, "Timing counter", 20150, 2350, 960, 830, 960, 830)
    rect(71, "Counter pill", 0, 2350, 830, 780, 260, 80, PANEL, radius=16, parent=70, stroke=([0.35, 0.37, 0.44, 1], 2))
    for i, (s, a, d) in enumerate((("+0.1s", 100, 350), ("+0.2s", 450, 350), ("+0.3s", 800, 1550))):
        text(72 + i, f"Counter {s}", a, d, 960, 836, s, size=46, color=WHITE, just="center", parent=70)
    text(75, "Counter label", 800, 1550, 960, 896, "SUBTITLES LATER", font=REG, size=22, color=MUTED, just="center", parent=70)

    # "position saved" pill after the drag
    group(80, "Position saved", 24050, 950, 1180, 700, 1180, 700)
    rect(81, "Saved pill", 0, 950, 1020, 672, 320, 56, [0.08, 0.08, 0.10, 0.85], radius=28, parent=80)
    text(82, "Saved text", 0, 950, 1180, 709, "Position saved", font=REG, size=26, color=WHITE, just="center", parent=80)

    # --- captions
    caption(100, 300, 3600, "Found the subtitle file…")
    caption(110, 4100, 2800, "…but the player won't load it.")
    caption(120, 7150, 3750, "Drop it into Subtitle Overlay")
    caption(130, 11800, 3150, "Synced to the video")
    caption(140, 15050, 2400, "Size: 50–200%")
    caption(150, 17550, 2400, "Any color")
    caption(160, 20050, 2400, "Fix the timing")
    caption(170, 22550, 2400, "Drag it, even in fullscreen")

    # --- shot 6: end card (25-30s); the icon image is inserted by place_media()
    group(200, "End card", 25000, 5000)
    gradient_bg(201, "End card background", 0, 5000, parent=200)
    group(210, "End title", 600, 4400, 960, 590, 960, 590, parent=200)
    text(211, "Title", 0, 4400, 960, 600, "Subtitle Overlay", size=112, color=PURE_WHITE, just="center", parent=210)
    group(220, "End tagline", 850, 4150, 960, 680, 960, 680, parent=200)
    text(221, "Tagline", 0, 4150, 960, 690, "Your subtitles on any web video", font=REG, size=46, color=[0.86, 0.90, 1, 1],
         just="center", parent=220)
    group(230, "End links", 1150, 3850, 960, 790, 960, 790, parent=200)
    rect(231, "Links pill", 0, 3850, 330, 748, 1260, 84, [1, 1, 1, 0.14], radius=18, parent=230)
    text(232, "Links", 0, 3850, 960, 802, "Now on the Chrome Web Store  ·  github.com/dhsdb010/Subtitle_Overlay", font=REG, size=32,
         color=PURE_WHITE, just="center", parent=230)


def build_keys():
    # player chrome
    kf(2, "opacity", [(0, 0, LINEAR), (300, 38, EASE_OUT), (2700, 38, LINEAR), (3000, 0, LINEAR)])
    kf(4, "scaleX", [(0, 14, LINEAR), (25000, 42, LINEAR)])

    # shot 1 bubbles
    pop(21, 0)
    pop(22, 0)
    pop(23, 450)
    pop(24, 450)
    fade(20, 3100, 1, 300)

    # shot 2
    fade(30, 3000, 200, 250)
    kf(30, "scaleX", [(250, 100, LINEAR), (380, 118, EASE_OUT), (560, 100, EASE_IN_OUT)])
    kf(30, "scaleY", [(250, 100, LINEAR), (380, 118, EASE_OUT), (560, 100, EASE_IN_OUT)])
    kf(40, "positionY", [(0, 830, LINEAR), (320, 790, EASE_OUT)])
    fade(40, 2600, 250, 250)
    # shake when the X lands (layer time 600 = 5.0s)
    kf(40, "positionX", [(600, 1610, LINEAR), (660, 1630, LINEAR), (720, 1592, LINEAR), (780, 1622, LINEAR),
                         (840, 1600, LINEAR), (900, 1610, EASE_OUT)])
    kf(46, "scaleX", [(0, 170, LINEAR), (180, 100, EASE_OUT)])
    kf(46, "scaleY", [(0, 170, LINEAR), (180, 100, EASE_OUT)])
    kf(46, "opacity", [(0, 0, LINEAR), (120, 100, LINEAR)])

    # shot 3: file chip
    kf(50, "opacity", [(0, 0, LINEAR), (200, 100, EASE_OUT), (1050, 100, LINEAR), (1250, 0, LINEAR)])
    kf(50, "positionX", [(0, 520, LINEAR), (400, 520, LINEAR), (1150, 1620, EASE_IN_OUT)])
    kf(50, "positionY", [(0, 680, LINEAR), (200, 640, EASE_OUT), (400, 640, LINEAR), (750, 380, EASE_OUT), (1150, 470, EASE_IN_OUT)])
    kf(50, "scaleX", [(400, 100, LINEAR), (1150, 55, EASE_IN_OUT)])
    kf(50, "scaleY", [(400, 100, LINEAR), (1150, 55, EASE_IN_OUT)])
    kf(50, "rotation", [(400, 0, LINEAR), (750, -6, EASE_OUT), (1150, 0, EASE_IN_OUT)])

    # subtitle (layer 63, starts 11.5s)
    kf(63, "opacity", [(0, 0, LINEAR), (380, 100, EASE_OUT)])
    # beats in subtitle-local time: size 3500, color 6000, timing 8500, drag 11000
    kf(63, "scaleX", [(3500, 100, LINEAR), (3850, 100, LINEAR), (4350, 150, EASE_OUT), (6000, 100, HOLD)])
    kf(63, "scaleY", [(3500, 100, LINEAR), (3850, 100, LINEAR), (4350, 150, EASE_OUT), (6000, 100, HOLD)])
    kf(63, "fillColor", [(6250, PURE_WHITE, LINEAR), (6750, YELLOW, EASE_IN_OUT), (8500, PURE_WHITE, HOLD)])
    # entrance rise, then the drag (subtitle-local 11400-12400)
    kf(63, "positionY", [(0, 1010, LINEAR), (380, 960, EASE_OUT), (11400, 960, LINEAR), (12400, 640, EASE_IN_OUT)])
    kf(63, "positionX", [(11400, 960, LINEAR), (12400, 1180, EASE_IN_OUT)])

    # drag rig (group 60 starts 22.5s = subtitle-local 11000)
    kf(60, "opacity", [(0, 0, LINEAR), (200, 100, EASE_OUT), (2250, 100, LINEAR), (2500, 0, LINEAR)])
    kf(60, "positionY", [(400, 0, LINEAR), (1400, -320, EASE_IN_OUT)])
    kf(60, "positionX", [(400, 0, LINEAR), (1400, 220, EASE_IN_OUT)])
    kf(62, "positionX", [(0, 1420, LINEAR), (500, 1360, EASE_OUT)])
    kf(62, "positionY", [(0, 990, LINEAR), (500, 930, EASE_OUT)])

    # timing counter
    kf(70, "opacity", [(0, 0, LINEAR), (200, 100, EASE_OUT), (2100, 100, LINEAR), (2350, 0, LINEAR)])
    kf(70, "positionY", [(0, 860, LINEAR), (250, 830, EASE_OUT)])
    for lid, a in ((72, 100), (73, 450), (74, 800)):
        kf(lid, "scaleX", [(0, 125, LINEAR), (160, 100, EASE_OUT)])
        kf(lid, "scaleY", [(0, 125, LINEAR), (160, 100, EASE_OUT)])

    # position saved
    pop(80, 0, 108)
    kf(80, "opacity", [(0, 100, LINEAR), (700, 100, LINEAR), (950, 0, LINEAR)])

    # end card
    kf(200, "opacity", [(0, 0, LINEAR), (350, 100, EASE_OUT)])
    for gid, at in ((210, 0), (220, 0), (230, 0)):
        kf(gid, "opacity", [(at, 0, LINEAR), (400, 100, EASE_OUT)])
        kf(gid, "positionY", [(at, {210: 630, 220: 710, 230: 820}[gid], LINEAR), (450, {210: 590, 220: 680, 230: 790}[gid], EASE_OUT)])


def place_media(doc):
    layers = doc["composition"]["layers"]

    def index_of(lid):
        return next(i for i, l in enumerate(layers) if l["id"] == lid)

    def image(lid, name, asset, start, dur, x, y, ax, ay, s):
        return {"type": "Image", "id": lid, "name": name, "blendMode": "normal", "activeRange": rng(start, dur),
                "transform": tf(x, y, ax, ay, s), "source": {"assetId": asset, "fit": "contain"}}

    # back: the scene (1920x1080 image placed under the 64px browser bar)
    layers.append(image(1, "Scene: dusk lake", "scene", 0, 25000, 960, 604, 960, 540, 100))
    # toolbar extension icon, in front of the browser bar
    layers.insert(index_of(5), image(12, "Toolbar icon", "icon", 0, 25000, 1852, 32, 256, 256, 8))
    # popups go behind the file chip group (50)
    chip = index_of(50)
    layers.insert(chip + 1, image(14, "Popup: loaded", "popup-loaded", 9250, 2200, 1880, 76, 580, 0, 78))
    layers.insert(chip + 1, image(13, "Popup: before", "popup-before", 7600, 1700, 1880, 76, 580, 0, 78))
    # end card icon sits inside the end card group, in front of its background
    endcard = layers[index_of(200)]
    endcard["layers"].insert(0, {**image(202, "End icon", "icon", 300, 4700, 960, 380, 256, 256, 42), "parent": 200})

    def sfx(lid, asset, at, dur_ms, vol):
        return {"type": "Audio", "id": lid, "name": f"SFX {asset} @{at}", "activeRange": rng(at, dur_ms),
                "sourceRange": rng(0, dur_ms), "sourceIntrinsicDuration": dur_ms, "windowMs": dur_ms,
                "source": {"assetId": asset}, "volume": round(vol * SFX_GAIN, 3), "captionsEnabled": False,
                "metadata": {"modality": "soundEffect", "source": "generated"}}

    cues = [
        ("sfx-pop", 800, 180, 0.9), ("sfx-pop", 1250, 180, 0.8),
        ("sfx-click", 4250, 65, 0.9), ("sfx-impact", 5000, 400, 0.9),
        ("sfx-tap", 7200, 100, 0.8), ("sfx-whoosh", 7450, 600, 0.7), ("sfx-whoosh", 8350, 600, 0.6),
        ("sfx-ping", 9250, 480, 0.7), ("sfx-whoosh", 11300, 600, 0.5),
        ("sfx-tap", 15000, 100, 0.9), ("sfx-tap", 17500, 100, 0.9),
        ("sfx-tap", 20000, 100, 0.9), ("sfx-click", 20250, 65, 0.8), ("sfx-click", 20600, 65, 0.8), ("sfx-click", 20950, 65, 0.8),
        ("sfx-tap", 22500, 100, 0.9), ("sfx-whoosh", 23250, 600, 0.6), ("sfx-pop", 24050, 180, 0.7),
        ("sfx-whoosh", 24850, 600, 0.7), ("sfx-pop", 25300, 180, 0.8), ("sfx-ping", 25650, 480, 0.6),
    ]
    for i, (asset, at, d, v) in enumerate(cues):
        layers.append(sfx(900 + i, asset, at, d, v))
    doc["duration"] = 30.0
    return doc


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "create":
        build_create()
        json.dump(actions, open("A-create.json", "w"), ensure_ascii=False, indent=1)
        print(len(actions), "create actions")
    elif mode == "keys":
        build_create()  # caption() also queues its keyframes
        keys.clear()
        _kid[0] = 0
        actions.clear()
        build_create()
        build_keys()
        json.dump(keys, open("A-keys.json", "w"), ensure_ascii=False, indent=1)
        print(len(keys), "keyframe actions")
    elif mode == "media":
        p = sys.argv[2]
        doc = json.load(open(p))
        json.dump(place_media(doc), open(p, "w"), ensure_ascii=False, indent=1)
        print("media placed")
