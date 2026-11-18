# dev: python3 scripts/icons.py -> PWA icons in public/ from public/icon.svg (chrome or rsvg-convert)
# icon.svg is temporary and subject to change
from io import BytesIO
from pathlib import Path
import shutil
import subprocess
import tempfile
from PIL import Image

svg = Path("public/icon.svg").read_text()
BG = (30, 30, 30, 255)

def rasterize(s: str, size: int) -> Image.Image:
    if shutil.which("rsvg-convert"):
        p = subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size)], input=s.encode(), capture_output=True, check=True)
        return Image.open(BytesIO(p.stdout)).convert("RGBA")
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if chrome:
        with tempfile.TemporaryDirectory() as d:
            Path(d, "icon.svg").write_text(s)
            Path(d, "i.html").write_text(
                f'<!doctype html><style>html,body{{margin:0;background:transparent}}img{{display:block;width:{size}px;height:{size}px}}</style><img src="icon.svg">'
            )
            out = Path(d, "out.png")
            subprocess.run(
                [chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1",
                 "--default-background-color=00000000", f"--window-size={size},{size}",
                 f"--screenshot={out}", Path(d, "i.html").as_uri()],
                check=True, capture_output=True,
            )
            return Image.open(out).convert("RGBA")
    raise SystemExit("need rsvg-convert or chrome to rasterize icon.svg")

src = rasterize(svg, 1024)

def place(size, frac):
    im = Image.new("RGBA", (size, size), BG)
    s = frac * size / max(src.size)
    w, h = round(src.width * s), round(src.height * s)
    im.alpha_composite(src.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return im

def save(im, name, opaque=False):
    if opaque:
        im.convert("RGB").quantize(128, method=Image.Quantize.MEDIANCUT).save("public/" + name, optimize=True)
    else:
        im.save("public/" + name, optimize=True)

save(rasterize(svg, 192), "pwa-192.png")
save(rasterize(svg, 512), "pwa-512.png")
save(place(512, 0.66), "pwa-maskable-512.png", True)
save(place(180, 0.86), "apple-touch-icon.png", True)
