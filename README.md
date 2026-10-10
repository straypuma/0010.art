# 0010.art

Static site, no framework, hosted on GitHub Pages at https://0010.art.

- `index.html`: the whole site. Each section is a `#hash` view (`#buy`, `#works`, `#curtains`, `#facevalue`), shown with CSS `:target`.
- `assets/style.css`, `assets/app.js`: styles and the small script for the eye, hover previews and lightbox.
- `content.json`: every piece, in display order, per collection.
- `originals/`: full-resolution source images. They stay local and are not committed.

## Adding or changing a piece

1. Put the image in `originals/<collection>/<file>.jpg`.
2. Add `{"file": "<file>", "title": "…", "year": "…"}` to that collection in `content.json`.
3. Run `python3 build.py`. It needs `cwebp` (`brew install webp`). It writes the WebP sizes to `assets/img/` and regenerates the gallery markup in `index.html`.

Auction lots and section text are edited directly in `index.html`.
