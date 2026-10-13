"""Vertical 9:16 cut (1080x1920) of a finished 16:9 promo.

Layout: a caption band on top, the full 16:9 frame below it, and a large "detail" window that follows the
action (popup, subtitle, keycaps) so it reads on a phone. Usage: python3 build_V.py A|B create|keys|media <editable.json>
"""
import json
import sys

import build_A as A
from build_A import (BOLD, WHITE, PURE_WHITE, BLUE, LINEAR, EASE_IN_OUT, EASE_OUT, rect, text, kf, fade, rng, tf, group)

VW, VH = 1080, 1920
TOP_Y, TOP_S = 230, 56.25          # full frame: 1080 x 608 at y 230..838
WIN_TOP, WIN_BOTTOM = 880, 1600    # detail window
WIN_CX, WIN_CY = 540, (WIN_TOP + WIN_BOTTOM) // 2
BG = [0.071, 0.075, 0.090, 1]

VIDEOS = {
    "A": {
        "asset": "vidA", "file": "A_16x9.mp4", "dur": 30000,
        "captions": [(300, 3600, "Found the subtitle file…"), (4100, 2800, "…but the player won't load it."),
                     (7150, 3750, "Drop it into Subtitle Overlay"), (11800, 3150, "Synced to the video"),
                     (15050, 2400, "Size: 50–200%"), (17550, 2400, "Any color"), (20050, 2400, "Fix the timing"),
                     (22550, 2400, "Drag it, even in fullscreen")],
        # (project ms, source cx, source cy, scale %)
        "focus": [(0, 620, 420, 100), (3800, 620, 420, 100), (4200, 1380, 640, 100), (6800, 1380, 640, 100),
                  (7200, 1380, 430, 100), (10900, 1380, 430, 100), (11300, 960, 760, 80), (22900, 960, 760, 80),
                  (23900, 1180, 680, 80), (24800, 1180, 680, 80), (25200, 960, 560, 85)],
    },
    "B": {
        "asset": "vidB", "file": "B_16x9.mp4", "dur": 45000,
        "captions": [(4200, 5700, "Load any subtitle file"), (10150, 5750, "Turn it on"),
                     (16150, 6750, "Size: 50–200%"), (23150, 6750, "Fix the timing"),
                     (30150, 6750, "Make it easy to read"), (37150, 4750, "Drag it, even in fullscreen")],
        "focus": [(0, 960, 500, 85), (3800, 960, 500, 85), (4200, 1245, 420, 85), (6900, 1245, 420, 85),
                  (7200, 700, 470, 85), (9800, 700, 470, 85), (10200, 1160, 520, 75), (16000, 1160, 520, 75),
                  (16300, 1300, 420, 85), (17600, 1300, 420, 85), (18000, 960, 820, 75), (22800, 960, 820, 75),
                  (23200, 1380, 330, 100), (25200, 1380, 330, 100), (25600, 740, 880, 75), (29800, 740, 880, 75),
                  (30200, 1200, 560, 75), (36800, 1200, 560, 75), (37300, 1060, 760, 85), (41800, 1060, 760, 85),
                  (42200, 960, 560, 85)],
    },
}


def build_create(v):
    cfg = VIDEOS[v]
    dur = cfg["dur"]
    rect(2, "Background", 0, dur, 0, 0, VW, VH, BG)
    # detail video is inserted in front of the background by place_media(); these covers hide its overflow
    rect(3, "Cover above window", 0, dur, 0, 0, VW, WIN_TOP - 8, BG)
    rect(4, "Cover below window", 0, dur, 0, WIN_BOTTOM + 8, VW, VH - WIN_BOTTOM - 8, BG)
    rect(5, "Window edge top", 0, dur, 0, WIN_TOP - 8, VW, 4, [1, 1, 1, 0.12])
    rect(6, "Window edge bottom", 0, dur, 0, WIN_BOTTOM + 4, VW, 4, [1, 1, 1, 0.12])
    # full-frame video is inserted here (in front of the covers)
    for i, (start, d, s) in enumerate(cfg["captions"]):
        gid = 20 + i * 3
        width = int(len(s) * 52 * 0.56) + 80
        group(gid, f"V caption: {s}", start, d, 540, 135, 540, 135)
        rect(gid + 1, "V pill", 0, d, 540 - width // 2, 86, width, 98, BLUE, radius=20, parent=gid)
        text(gid + 2, "V text", 0, d, 540, 153, s, size=52, color=WHITE, just="center", parent=gid)
        fade(gid, d, 220, 220)
        kf(gid, "scaleX", [(0, 92, LINEAR), (260, 100, EASE_OUT)])
        kf(gid, "scaleY", [(0, 92, LINEAR), (260, 100, EASE_OUT)])
    text(60, "Brand", 0, dur, 600, 1724, "Subtitle Overlay", size=44, color=PURE_WHITE, just="center")


def place_media(v, doc):
    cfg = VIDEOS[v]
    dur = cfg["dur"]
    layers = doc["composition"]["layers"]

    def index_of(lid):
        return next(i for i, l in enumerate(layers) if l["id"] == lid)

    def video(lid, name, x, y, ax, ay, s, volume):
        l = {"type": "Video", "id": lid, "name": name, "blendMode": "normal", "activeRange": rng(0, dur),
             "sourceRange": rng(0, dur), "sourceIntrinsicDuration": dur, "transform": tf(x, y, ax, ay, s),
             "source": {"assetId": cfg["asset"], "fit": "contain"}}
        if volume is not None:
            l["volume"] = volume
        return l

    f0 = cfg["focus"][0]
    # detail (muted) just in front of the background; full frame (carries the sound) in front of the covers
    layers.insert(index_of(2), video(1, "Detail window", WIN_CX, WIN_CY, f0[1], f0[2], f0[3], None))
    layers.insert(index_of(5), video(7, "Full frame", 0, TOP_Y, 0, 0, TOP_S, 1.0))
    layers.insert(index_of(60) + 1, {"type": "Image", "id": 61, "name": "Brand icon", "blendMode": "normal",
                                     "activeRange": rng(0, dur), "transform": tf(360, 1708, 256, 256, 13),
                                     "source": {"assetId": "icon", "fit": "contain"}})
    doc["duration"] = dur / 1000
    return doc


def build_keys(v):
    focus = VIDEOS[v]["focus"]
    kf(1, "anchorPointX", [(t, x, EASE_IN_OUT) for t, x, _, _ in focus])
    kf(1, "anchorPointY", [(t, y, EASE_IN_OUT) for t, _, y, _ in focus])
    kf(1, "scaleX", [(t, s, EASE_IN_OUT) for t, _, _, s in focus])
    kf(1, "scaleY", [(t, s, EASE_IN_OUT) for t, _, _, s in focus])


if __name__ == "__main__":
    v, mode = sys.argv[1], sys.argv[2]
    if mode == "create":
        build_create(v)
        json.dump(A.actions, open(f"V{v}-create.json", "w"), ensure_ascii=False, indent=1)
        print(len(A.actions), "create actions")
    elif mode == "keys":
        A.keys.clear()
        A._kid[0] = 0
        build_create(v)
        build_keys(v)
        json.dump(A.keys, open(f"V{v}-keys.json", "w"), ensure_ascii=False, indent=1)
        print(len(A.keys), "keyframe actions")
    elif mode == "media":
        p = sys.argv[3]
        doc = json.load(open(p))
        json.dump(place_media(v, doc), open(p, "w"), ensure_ascii=False, indent=1)
        print("media placed")
