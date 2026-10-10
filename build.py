#!/usr/bin/env python3
"""Regenerates the gallery images and gallery markup for 0010.art.

Reads content.json (ordered list of pieces per collection), converts each
original in originals/<collection>/<file>.jpg into three WebP sizes under
assets/img/<collection>/, and rewrites the <!-- gallery:<collection> -->
blocks in index.html. Only pieces whose original exists are published; the
rest are listed as missing. Stdlib only; needs `cwebp` and macOS `sips`.

    python3 build.py
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
THUMBS = (480, 960)      # srcset widths for the grids
LARGE = 2000             # long edge for the lightbox
QUALITY = {480: 76, 960: 74, LARGE: 80}

# `sizes` attribute per collection, matching the grid columns in style.css.
# Works pieces share one height (clamp(200px, 25vw, 320px)), so their width depends
# on their proportions and each gets its own value.
SIZES = {
    "works": lambda w, h: (f"(min-width: 1280px) {round(320 * w / h)}px, "
                           f"(min-width: 800px) {round(25 * w / h, 1)}vw, {round(200 * w / h)}px"),
    "face-value": "(min-width: 1100px) 230px, (min-width: 600px) 22vw, 46vw",
    "curtains": "(min-width: 1100px) 190px, (min-width: 600px) 22vw, 46vw",
}
SINGLES = {}  # "collection/file" -> <a><img></a>, for <!-- img:... --> markers


def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True, check=True).stdout
    w = int(re.search(r"pixelWidth: (\d+)", out).group(1))
    h = int(re.search(r"pixelHeight: (\d+)", out).group(1))
    return w, h


def webp(src, dst, quality, resize=None):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    cmd = ["cwebp", "-quiet", "-q", str(quality), "-metadata", "none", "-sharp_yuv"]
    if resize:
        cmd += ["-resize", str(resize[0]), str(resize[1])]
    subprocess.run(cmd + [src, "-o", dst], check=True)
    print("  wrote", os.path.relpath(dst, ROOT))


def find_original(col, name):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = os.path.join(ROOT, "originals", col, name + ext)
        if os.path.exists(p):
            return p
    return None


def build_collection(col, items):
    out_dir = os.path.join(ROOT, "assets", "img", col)
    os.makedirs(out_dir, exist_ok=True)
    keep, rows, missing = set(), [], []
    for item in items:
        src = find_original(col, item["file"])
        if not src:
            missing.append(item["file"])
            continue
        w, h = dims(src)
        base = f"assets/img/{col}/{item['file']}"
        srcset = []
        for tw in THUMBS:
            name = f"{item['file']}-{tw}.webp"
            webp(src, os.path.join(out_dir, name), QUALITY[tw], (tw, 0) if w > tw else None)
            srcset.append(f"{base}-{tw}.webp {min(tw, w)}w")
            keep.add(name)
        name = f"{item['file']}-{LARGE}.webp"
        big = None if max(w, h) <= LARGE else ((LARGE, 0) if w >= h else (0, LARGE))
        webp(src, os.path.join(out_dir, name), QUALITY[LARGE], big)
        keep.add(name)
        large_w = w if not big else (LARGE if w >= h else round(w * LARGE / h))

        title, year = item["title"], item.get("year", "")
        alt = f"{title}, {year}" if col == "works" else title
        caption = (f'<span class="t">{html.escape(title)}</span>'
                   + (f' <span class="y">{year}</span>' if col == "works" else ""))
        def link(sizes, cls="", large=False):
            widths = srcset + ([f"{base}-{LARGE}.webp {large_w}w"] if large else [])
            return (f'<a{cls} href="{base}-{LARGE}.webp" data-lb data-title="{html.escape(title)}"'
                    f' data-year="{year}"><img src="{base}-480.webp" srcset="{", ".join(widths)}"'
                    f' sizes="{sizes}" width="{w}" height="{h}" alt="{html.escape(alt)}"'
                    f' loading="lazy" decoding="async"></a>')
        sizes = SIZES[col](w, h) if callable(SIZES[col]) else SIZES[col]
        ratio = f' style="--r:{w / h:.4f}"' if col == "works" else ""
        rows.append(f'<li{ratio}><figure>{link(sizes)}<figcaption>{caption}</figcaption></figure></li>')
        # Standalone use elsewhere on the page, e.g. the auction lots: shown ~650px wide,
        # so they also offer the 2000px file for Retina screens.
        SINGLES[f"{col}/{item['file']}"] = link(
            "(min-width: 1280px) 650px, (min-width: 760px) 52vw, 92vw", ' class="art"', large=True)

    for f in os.listdir(out_dir):
        if f not in keep:
            os.remove(os.path.join(out_dir, f))
            print("  removed stale", f)
    return rows, missing


def main():
    content = json.load(open(os.path.join(ROOT, "content.json"), encoding="utf-8"))
    index_path = os.path.join(ROOT, "index.html")
    page = open(index_path, encoding="utf-8").read()
    report = []
    for col, items in content.items():
        print(col)
        rows, missing = build_collection(col, items)
        block = "\n" + "\n".join(rows) + "\n"
        page, n = re.subn(rf"(<!-- gallery:{col} -->).*?(<!-- /gallery:{col} -->)",
                          lambda m: m.group(1) + block + m.group(2), page, flags=re.S)
        if n != 1:
            sys.exit(f"index.html needs exactly one <!-- gallery:{col} --> block")
        page = re.sub(rf"(<!-- count:{col} -->).*?(<!-- /count:{col} -->)",
                      lambda m: m.group(1) + str(len(items)) + m.group(2), page, flags=re.S)
        report.append((col, len(rows), len(items), missing))
    page = re.sub(r"(<!-- img:([\w-]+/[\w-]+) -->).*?(<!-- /img -->)",
                  lambda m: m.group(1) + SINGLES.get(m.group(2), "") + m.group(3), page, flags=re.S)
    open(index_path, "w", encoding="utf-8").write(page)
    for col, shown, total, missing in report:
        print(f"{col}: {shown}/{total} published" + (f"; missing: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
