"""Generate extension icons at 16, 48, 128px."""
from PIL import Image, ImageDraw
import os

def draw_icon(size):
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = s / 2, s / 2

    # Dark circle background
    r = s * 0.46
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#1a1f2e")

    tab_w = s * 0.52
    tab_h = s * 0.38
    corner = max(2, s * 0.08)
    lw = max(1, int(s * 0.045))

    # Back tab (muted blue-grey, offset top-right)
    bx = cx - tab_w / 2 + s * 0.07
    by = cy - tab_h / 2 - s * 0.05
    d.rounded_rectangle(
        [bx, by, bx + tab_w, by + tab_h],
        radius=corner, fill="#2e3a5c", outline="#4a5a8a",
        width=max(1, int(s * 0.03)),
    )

    # Front tab (orange, offset bottom-left)
    fx = cx - tab_w / 2 - s * 0.07
    fy = cy - tab_h / 2 + s * 0.05
    d.rounded_rectangle(
        [fx, fy, fx + tab_w, fy + tab_h],
        radius=corner, fill="#ff6b35", outline="#ff9a5c",
        width=max(1, int(s * 0.03)),
    )

    # Two white content lines inside front tab
    lx1 = fx + tab_w * 0.18
    ly1 = fy + tab_h * 0.32
    ly2 = fy + tab_h * 0.64
    d.rounded_rectangle([lx1, ly1 - lw, fx + tab_w * 0.75, ly1 + lw], radius=lw, fill="white")
    d.rounded_rectangle([lx1, ly2 - lw, fx + tab_w * 0.55, ly2 + lw], radius=lw, fill="white")

    return img

os.makedirs("icons", exist_ok=True)
for size in [16, 48, 128]:
    draw_icon(size).save(f"icons/icon{size}.png")
    print(f"icons/icon{size}.png ✓")
