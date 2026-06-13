"""Generate extension icons at 16, 48, 128px."""
from PIL import Image, ImageDraw
import os

def draw_icon(size):
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = s / 2, s / 2

    tab_w = s * 0.56
    tab_h = s * 0.42
    corner = max(2, s * 0.09)
    lw = max(1, int(s * 0.05))

    # Back tab (blue-grey, offset top-right)
    bx = cx - tab_w / 2 + s * 0.08
    by = cy - tab_h / 2 - s * 0.06
    d.rounded_rectangle(
        [bx, by, bx + tab_w, by + tab_h],
        radius=corner, fill="#7b93c8", outline="#5a75b0",
        width=max(1, int(s * 0.03)),
    )

    # Front tab (orange, offset bottom-left)
    fx = cx - tab_w / 2 - s * 0.08
    fy = cy - tab_h / 2 + s * 0.06
    d.rounded_rectangle(
        [fx, fy, fx + tab_w, fy + tab_h],
        radius=corner, fill="#ff6b35", outline="#e05020",
        width=max(1, int(s * 0.03)),
    )

    # Two white lines inside front tab
    lx1 = fx + tab_w * 0.18
    ly1 = fy + tab_h * 0.32
    ly2 = fy + tab_h * 0.65
    d.rounded_rectangle([lx1, ly1 - lw, fx + tab_w * 0.76, ly1 + lw], radius=lw, fill="white")
    d.rounded_rectangle([lx1, ly2 - lw, fx + tab_w * 0.55, ly2 + lw], radius=lw, fill="white")

    return img

os.makedirs("icons", exist_ok=True)
for size in [16, 48, 128]:
    draw_icon(size).save(f"icons/icon{size}.png")
    print(f"icons/icon{size}.png ✓")
