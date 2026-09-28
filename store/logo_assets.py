# Rebuild every icon and splash from Steve's Goat logo (sent 2026-09-28).
#
# The supplied file is the full lockup: goat on a gold rock, then FLEMING /
# REALTY underneath. The wordmark is unreadable at 60px, so the app icon uses
# only the goat-and-rock mark; the splash screens, which are shown large, use
# the whole lockup.
import os
from PIL import Image

SRC = r"C:\Users\eliot\Downloads\Copy of Blue Theme Color Update (1).jpg"
APP = r"C:\Users\eliot\claudecode\fleming-app"
NAVY = (13, 28, 51)

src = Image.open(SRC).convert("RGB")
W, H = src.size

MARK_TOP, MARK_BOTTOM = 109, 1539          # goat + rock, above the FLEMING wordmark
LOCKUP_TOP, LOCKUP_BOTTOM = 109, 1891      # the whole logo including REALTY


def trimmed(top, bottom, tol=40):
    """Crop rows [top, bottom] and tighten horizontally to the real content."""
    band = src.crop((0, top, W, bottom + 1))
    px = band.load()
    bw, bh = band.size
    left, right = bw, 0
    for y in range(0, bh, 2):
        for x in range(bw):
            c = px[x, y]
            if abs(c[0] - NAVY[0]) + abs(c[1] - NAVY[1]) + abs(c[2] - NAVY[2]) > tol:
                if x < left:
                    left = x
                if x > right:
                    right = x
    return band.crop((left, 0, right + 1, bh))


def canvas(art, size, pad_frac):
    """Center art on an opaque navy square, leaving pad_frac of margin."""
    out = Image.new("RGB", (size, size), NAVY)
    inner = int(size * (1 - 2 * pad_frac))
    w, h = art.size
    scale = min(inner / w, inner / h)
    art = art.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out.paste(art, ((size - art.size[0]) // 2, (size - art.size[1]) // 2))
    return out


def save(img, rel):
    path = os.path.join(APP, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  {rel}  {img.size[0]}x{img.size[1]}")


mark = trimmed(MARK_TOP, MARK_BOTTOM)
lockup = trimmed(LOCKUP_TOP, LOCKUP_BOTTOM)
print(f"mark {mark.size}, lockup {lockup.size}")

# ---- iOS app icon: 1024, opaque, no alpha channel (App Store rejects alpha) --
print("iOS icon")
save(canvas(mark, 1024, 0.14), "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")

# ---- iOS splash: one square image Capacitor scales to every orientation ------
print("iOS splash")
splash = canvas(lockup, 2732, 0.30)
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    save(splash, f"ios/App/App/Assets.xcassets/Splash.imageset/{name}")

# ---- Android launcher icons -------------------------------------------------
print("Android launcher")
MIPMAP = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px in MIPMAP.items():
    icon = canvas(mark, px, 0.14)
    save(icon, f"android/app/src/main/res/mipmap-{d}/ic_launcher.png")
    save(icon, f"android/app/src/main/res/mipmap-{d}/ic_launcher_round.png")
    # Adaptive foreground: the outer third of each edge can be cropped by the
    # launcher's mask, so the mark sits inside the middle 66%.
    save(canvas(mark, px * 2, 0.29), f"android/app/src/main/res/mipmap-{d}/ic_launcher_foreground.png")

# ---- Android splash, portrait and landscape ---------------------------------
print("Android splash")
DENSITY = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280),
           "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}


def sheet(w, h):
    out = Image.new("RGB", (w, h), NAVY)
    target = int(min(w, h) * 0.55)
    lw, lh = lockup.size
    scale = min(target / lw, target / lh)
    art = lockup.resize((max(1, round(lw * scale)), max(1, round(lh * scale))), Image.LANCZOS)
    out.paste(art, ((w - art.size[0]) // 2, (h - art.size[1]) // 2))
    return out


save(sheet(480, 320), "android/app/src/main/res/drawable/splash.png")
for d, (w, h) in DENSITY.items():
    save(sheet(w, h), f"android/app/src/main/res/drawable-port-{d}/splash.png")
    save(sheet(h, w), f"android/app/src/main/res/drawable-land-{d}/splash.png")

# ---- Web / PWA --------------------------------------------------------------
print("Web")
save(canvas(mark, 512, 0.14), "public/icon-512.png")
save(canvas(mark, 192, 0.14), "public/icon-192.png")
save(canvas(mark, 512, 0.28), "public/icon-maskable-512.png")   # safe zone for maskable
save(canvas(mark, 180, 0.14), "public/apple-touch-icon.png")
save(canvas(mark, 32, 0.08), "public/favicon-32.png")
save(canvas(lockup, 1024, 0.10), "public/logo.png")
print("done")
