#!/usr/bin/env python3
"""Make files/patient-forms-fillable.pdf from files/patient-forms.pdf.

Adds real PDF form fields on top of the original pages, so patients can type into the boxes,
tick checkboxes, pick Yes/No, then save or print. Nothing is submitted anywhere.

- Grid pages (boxes drawn as thin lines): each labelled box gets a field under its label;
  empty table cells get a field that fills the cell; the gray squares become checkboxes.
- Other pages: every run of underscores ("_____") and every drawn signature line gets a field
  on it, and each printed "Yes / No" becomes a Yes/No picker.

Needs PyMuPDF:  python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install pymupdf
Run:            /tmp/pdfenv/bin/python scripts/make_fillable_forms.py [--debug]
--debug also writes files/patient-forms-fields-debug.pdf with every field outlined in red.
"""
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "files" / "patient-forms.pdf"
OUT = ROOT / "files" / "patient-forms-fillable.pdf"
DEBUG = ROOT / "files" / "patient-forms-fields-debug.pdf"
FONT, SIZE = "Helv", 9


def phrases(page):
    """Words grouped into phrases (same line, small gaps)."""
    ws = sorted(page.get_text("words"), key=lambda w: (round(w[3]), w[0]))
    out = []
    for w in ws:
        r = pymupdf.Rect(w[:4])
        if out and abs(out[-1]["r"].y1 - r.y1) < 2 and 0 <= r.x0 - out[-1]["r"].x1 < 4.5:
            out[-1]["r"] |= r
            out[-1]["t"] += " " + w[4]
        else:
            out.append({"r": r, "t": w[4]})
    return out


def segments(page):
    hs, vs, boxes, fills = [], [], [], []
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":  # plain drawn lines (e.g. signature lines)
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 1 and abs(p2.x - p1.x) > 3:
                    hs.append(pymupdf.Rect(min(p1.x, p2.x), p1.y - 0.4, max(p1.x, p2.x), p1.y + 0.4))
                elif abs(p1.x - p2.x) < 1 and abs(p2.y - p1.y) > 3:
                    vs.append(pymupdf.Rect(p1.x - 0.4, min(p1.y, p2.y), p1.x + 0.4, max(p1.y, p2.y)))
                continue
            if it[0] != "re":
                continue
            r = it[1]
            fill = d.get("fill")
            if r.height < 1.6 and r.width > 3:
                hs.append(r)
            elif r.width < 1.6 and r.height > 3:
                vs.append(r)
            elif 4 < r.width < 14 and 4 < r.height < 14 and abs(r.width - r.height) < 3:
                boxes.append(r)
            elif fill and r.width > 20 and r.height > 6 and not all(c < 0.05 for c in fill) and not all(c > 0.97 for c in fill):
                fills.append(r)
    return hs, vs, boxes, fills


def grid_cells(hs, vs):
    """Rectangular cells bounded by lines on all four sides."""
    ys = sorted({round((h.y0 + h.y1) / 2, 1) for h in hs})
    xs = sorted({round((v.x0 + v.x1) / 2, 1) for v in vs})

    def hcover(y, x0, x1):
        return any(abs((h.y0 + h.y1) / 2 - y) < 1.2 and h.x0 <= x0 + 1.5 and h.x1 >= x1 - 1.5 for h in hs)

    def vcover(x, y0, y1):
        return any(abs((v.x0 + v.x1) / 2 - x) < 1.2 and v.y0 <= y0 + 1.5 and v.y1 >= y1 - 1.5 for v in vs)

    cells = []
    for i, yt in enumerate(ys):
        for yb in ys[i + 1:]:
            if yb - yt < 6:
                continue
            cols = [x for x in xs if vcover(x, yt, yb)]
            for a, b in zip(cols, cols[1:]):
                if b - a < 6:
                    continue
                if hcover(yt, a, b) and hcover(yb, a, b):
                    # smallest cell only: no line in between that also closes it
                    if not any(yt < y < yb and hcover(y, a, b) for y in ys):
                        cells.append(pymupdf.Rect(a, yt, b, yb))
    # drop cells that contain a smaller cell (keep the finest grid)
    cells = [c for c in cells if not any(o != c and c.contains(o) and o.get_area() < c.get_area() * 0.95 for o in cells)]
    return cells


def underscore_runs(page):
    runs = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                cur = None
                for ch in s["chars"]:
                    r = pymupdf.Rect(ch["bbox"])
                    if ch["c"] == "_":
                        if cur and r.x0 - cur.x1 < 2.5:
                            cur |= r
                        else:
                            if cur and cur.width > 12:
                                runs.append(cur)
                            cur = pymupdf.Rect(r)
                    else:
                        if cur and cur.width > 12:
                            runs.append(cur)
                        cur = None
                if cur and cur.width > 12:
                    runs.append(cur)
    return runs


def slug(t):
    t = re.sub(r"[^A-Za-z0-9]+", " ", t).strip().title().replace(" ", "")
    return t[:40] or "Field"


class Builder:
    def __init__(self, doc):
        self.doc, self.names, self.debug = doc, {}, []

    def name(self, pn, base):
        base = f"p{pn + 1}_{slug(base)}"
        n = self.names.get(base, 0) + 1
        self.names[base] = n
        return base if n == 1 else f"{base}_{n}"

    avoid = ()

    def text(self, page, rect, label, multiline=None):
        if rect.width < 10 or rect.height < 7:
            return
        if any((rect & f).get_area() > 4 for f in self.avoid):
            return
        if any(pn == page.number and k == "t" and (rect & r).get_area() > 0.5 * min(rect.get_area(), r.get_area()) for pn, r, k in self.debug):
            return  # an underline and an underscore run for the same blank
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
        w.field_name = self.name(page.number, label)
        w.field_label = label
        w.rect = rect
        w.text_font, w.text_fontsize, w.text_color = FONT, SIZE, (0, 0, 0.35)
        w.border_width, w.border_color, w.fill_color = 0, None, None
        if multiline or (multiline is None and rect.height > 24):
            w.field_flags |= pymupdf.PDF_TX_FIELD_IS_MULTILINE
        page.add_widget(w)
        self.debug.append((page.number, rect, "t"))

    def check(self, page, rect, label):
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
        w.field_name = self.name(page.number, label)
        w.field_label = label
        w.rect = rect
        w.border_width, w.border_color, w.fill_color = 0, None, None
        w.text_color = (0, 0, 0.35)
        page.add_widget(w)
        self.debug.append((page.number, rect, "c"))

    def yesno(self, page, rect, label):
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_COMBOBOX
        w.field_name = self.name(page.number, label + " Yes No")
        w.field_label = label
        w.rect = rect
        w.choice_values = ["Yes / No", "Yes", "No"]
        w.field_value = "Yes / No"
        w.text_font, w.text_fontsize, w.text_color = "HeBo", 0, (0, 0, 0)
        w.border_width, w.fill_color = 0, (1, 1, 1)
        page.add_widget(w)
        self.debug.append((page.number, rect, "y"))


BOX_GLYPH = ""


def glyph_boxes(page):
    out = []
    for blk in page.get_text("rawdict")["blocks"]:
        for l in blk.get("lines", []):
            for s in l["spans"]:
                for ch in s["chars"]:
                    if ch["c"] == BOX_GLYPH:
                        # the glyph reports a near-empty box; use a fixed 7.5pt square on the text line
                        r, (ox, oy) = pymupdf.Rect(ch["bbox"]), ch["origin"]
                        side = 7.5
                        out.append(pymupdf.Rect(ox, oy - side + 0.6, ox + side, oy + 0.6))
    return out


def label_page(b, page):
    """Labelled boxes: each label gets the space under it, out to the nearest lines."""
    hs, vs, _boxes, fills = segments(page)
    boxes = glyph_boxes(page)
    words = [w for w in page.get_text("words") if w[4].replace(BOX_GLYPH, "")]
    # option words sit right after a checkbox glyph ("Male", "Yellow Page Ad", "Other:")
    opt = set()
    for bx in boxes:
        line = sorted([w for w in words if abs(w[3] - bx.y1) < 4 and w[0] >= bx.x0 - 1], key=lambda w: w[0])
        x = bx.x1
        for w in line:
            if w[0] - x > 6:
                break
            opt.add(w[:4]); x = w[2]
    for bx in boxes:
        nxt = [w for w in words if w[:4] in opt and 0 <= w[0] - bx.x0 < 14 and abs(w[3] - bx.y1) < 4]
        b.check(page, bx, nxt[0][4].replace(BOX_GLYPH, "") if nxt else "Option")
    ph = [p for p in phrases(page) if p["t"].replace(BOX_GLYPH, "").strip()]
    in_fill = lambda r: any((f & r).get_area() > r.get_area() * 0.5 for f in fills)
    grid_right = max(((v.x0 + v.x1) / 2 for v in vs), default=page.rect.x1 - 40)
    b.avoid = fills
    vmid = lambda v: (v.x0 + v.x1) / 2
    hmid = lambda h: (h.y0 + h.y1) / 2
    for p in ph:
        r, t = p["r"], p["t"].replace(BOX_GLYPH, "").strip()
        if in_fill(r) or len(t) > 45 or "_" in t or t in ("PRIMARY", "SECONDARY") or r.height > r.width * 1.5:
            continue  # headings, sideways side labels
        # an option label starts at (or just after) a checkbox glyph
        is_opt = any(abs(bx.y1 - r.y1) < 4 and -2 <= r.x0 - bx.x0 < 14 for bx in boxes)
        if is_opt and not t.endswith(":"):
            continue
        if is_opt:  # "Other:" -- the label text starts after the glyph
            r = pymupdf.Rect(max(r.x0, max(bx.x1 for bx in boxes if abs(bx.y1 - r.y1) < 4 and -2 <= r.x0 - bx.x0 < 14)), r.y0, r.x1, r.y1)
        left_v = [vmid(v) for v in vs if vmid(v) <= r.x0 + 1 and v.y0 <= r.y0 + 2 and v.y1 >= r.y1 - 2]
        left = (max(left_v) if left_v else r.x0 - 3) + 2
        right_v = [vmid(v) for v in vs if vmid(v) > r.x0 + 4 and v.y0 <= r.y0 + 2 and v.y1 >= r.y1 - 2]
        right = (min(right_v) if right_v else grid_right) - 2
        row = [q["r"] for q in ph if abs(q["r"].y1 - r.y1) < 2 and q["r"] != p["r"]]
        peers = [q.x0 for q in row if q.x0 > r.x1 + 2 and q.x0 < right] + \
                [bx.x0 for bx in boxes if abs(bx.y1 - r.y1) < 4 and r.x1 < bx.x0 < right]
        # a column heading floating over unruled columns ("Name   Address   Phone No.")
        if not left_v or r.x0 - left > 40:
            prev = [q.x1 for q in row if q.x1 < r.x0 - 2 and q.x1 > left]
            left = (max(prev) + 6) if prev else max(left, r.x0 - 40)
            if not peers:
                right = min(right, r.x1 + 45)
        if t.endswith(":"):  # "Other:" / "DOB:" -> fill the rest of the line
            stop = min(peers + [bx.x0 for bx in boxes if abs(bx.y1 - r.y1) < 4 and bx.x0 > r.x1] + [right + 2]) - 2
            b.text(page, pymupdf.Rect(r.x1 + 2, r.y0 - 1.2, stop, r.y1 + 1.2), t.rstrip(":"), multiline=False)
            continue
        if peers:
            right = min(peers) - 4
        below = [hmid(h) for h in hs if hmid(h) > r.y1 + 0.5 and h.x0 < right - 4 and h.x1 > left + 4]
        bottom = (min(below) if below else r.y1 + 12) - 0.8
        if any(bx.y0 > r.y1 - 1 and bx.y0 < bottom and bx.x0 < right and bx.x1 > max(left, r.x0 - 15) for bx in boxes):
            continue  # the space under this label holds checkboxes
        if bottom - (r.y1 + 0.3) >= 7:
            b.text(page, pymupdf.Rect(left, r.y1 + 0.3, right, bottom), t)
        elif right - r.x1 > 25:
            b.text(page, pymupdf.Rect(r.x1 + 3, r.y0 - 1.2, right, r.y1 + 1.2), t, multiline=False)


def grid_page(b, page):
    hs, vs, boxes, fills = segments(page)
    ph = phrases(page)
    for box in boxes:
        right = [p for p in ph if 0 <= p["r"].x0 - box.x1 < 8 and abs(p["r"].y1 - box.y1) < 4]
        b.check(page, box, (right[0]["t"] if right else "Option"))
    for cell in grid_cells(hs, vs):
        if any(cell.intersects(f) and (cell & f).get_area() > cell.get_area() * 0.5 for f in fills):
            continue  # colored header bar
        if any(cell.contains(bx) for bx in boxes):
            continue  # holds checkboxes
        inside = [p for p in ph if cell.contains(p["r"])]
        inner = pymupdf.Rect(cell.x0 + 2, cell.y0 + 1, cell.x1 - 2, cell.y1 - 1)
        if not inside:
            header = [p for p in ph if p["r"].y1 < cell.y0 and p["r"].x0 < cell.x1 and p["r"].x1 > cell.x0]
            label = header[-1]["t"] if header else f"row {round(cell.y0)}"
            b.text(page, inner, label, multiline=False)
            continue
        label = " ".join(p["t"] for p in inside)
        if len(label) > 60 or label.startswith(("IMMUNIZATION", "OFFICE USE")) or "_" in label:
            continue  # a paragraph, heading or underscore line (handled below), not a field
        caps = label.upper() == label and any(c.isalpha() for c in label)
        bottom = max(p["r"].y1 for p in inside)
        right = max(p["r"].x1 for p in inside)
        if cell.y1 - bottom >= 8 and not caps:
            b.text(page, pymupdf.Rect(cell.x0 + 2, bottom + 0.3, cell.x1 - 2, cell.y1 - 0.8), label)
        elif cell.x1 - right > 30:
            b.text(page, pymupdf.Rect(right + 3, cell.y0 + 1, cell.x1 - 2, cell.y1 - 1), label, multiline=False)


def line_chars(page):
    """(char, rect) per text line, for naming a blank after the words just before it."""
    lines = []
    for blk in page.get_text("rawdict")["blocks"]:
        for l in blk.get("lines", []):
            chars = [(ch["c"], pymupdf.Rect(ch["bbox"])) for s in l["spans"] for ch in s["chars"]]
            if chars:
                lines.append(chars)
    return lines


def words_before(lines, r, below=None):
    for chars in lines:
        if any(abs(cr.y1 - r.y1) < 3 and cr.x1 <= r.x0 + 1 for _c, cr in chars):
            txt = "".join(c for c, cr in chars if cr.x1 <= r.x0 + 1 and abs(cr.y1 - r.y1) < 3)
            parts = [p for p in re.split(r"_{2,}", txt) if p.strip(" :?(")]
            txt = parts[-1] if parts else ""   # only the words since the previous blank
            txt = re.sub(r"^\s*[A-Z]\.\s+", "", txt).strip(" :?(")
            words = txt.split()
            if words:
                return " ".join(words[-7:])
    # a blank on its own line: name it after the question on the nearest line above
    above = [chars for chars in lines if 0 < r.y1 - max(cr.y1 for _c, cr in chars) < 40
             and "".join(c for c, _ in chars).replace("_", "").strip()]
    if above:
        chars = max(above, key=lambda ch: max(cr.y1 for _c, cr in ch))
        txt = re.sub(r"^\s*[A-Z]\.\s+", "", re.sub(r"_+", " ", "".join(c for c, _ in chars))).strip(" :?(")
        return " ".join(txt.split()[-7:]) + " (answer)"
    return below or "blank"


def underscore_fields(b, page):
    lines = line_chars(page)
    for r in underscore_runs(page):
        label = words_before(lines, r, below=None)
        b.text(page, pymupdf.Rect(r.x0, r.y1 - 11.5, r.x1, r.y1 + 0.5), label, multiline=False)


def line_page(b, page):
    ph = phrases(page)
    hs, _vs, _boxes, _fills = segments(page)

    def label_for(r):
        left = [p for p in ph if abs(p["r"].y1 - r.y1) < 4 and p["r"].x1 <= r.x0 + 2 and "_" not in p["t"]]
        if left:
            return max(left, key=lambda p: p["r"].x1)["t"]
        below = [p for p in ph if 0 < p["r"].y0 - r.y1 < 12 and p["r"].x0 < r.x1 and p["r"].x1 > r.x0 and "_" not in p["t"]]
        return below[0]["t"] if below else "blank"

    underscore_fields(b, page)
    for h in hs:  # drawn signature lines (not the page's border frame)
        if 60 < h.width < page.rect.width * 0.7:
            b.text(page, pymupdf.Rect(h.x0, h.y0 - 12, h.x1, h.y0 - 0.3), label_for(h), multiline=False)
    # "Yes / No" (also "Yes/ No", "Yes /No", "Yes/No")
    words = page.get_text("words")
    for i, w in enumerate(words):
        if not w[4].startswith("Yes"):
            continue
        seq, j = [w], i + 1
        while j < len(words) and len(seq) < 4 and abs(words[j][3] - w[3]) < 2 and words[j][0] - seq[-1][2] < 6:
            seq.append(words[j])
            if words[j][4].startswith("No"):
                break
            j += 1
        text = "".join(x[4] for x in seq)
        if re.match(r"^Yes/?/?No", text.replace(" ", "")):
            r = pymupdf.Rect(seq[0][:4]) | pymupdf.Rect(seq[-1][:4])
            last = seq[-1][4]
            m = re.search(r"No(_+)$", last)
            if m:  # "No______": the picker ends at "No"; the blank after it stays a separate field
                r.x1 = seq[-1][2] - (seq[-1][2] - seq[-1][0]) * len(m.group(1)) / len(last)
            left = [p for p in ph if abs(p["r"].y1 - r.y1) < 3 and p["r"].x1 <= r.x0 + 1]
            b.yesno(page, pymupdf.Rect(r.x0 - 1, r.y0 - 0.5, r.x1 + 2, r.y1 + 0.5),
                    (max(left, key=lambda p: p["r"].x1)["t"] if left else "question"))


def main():
    doc = pymupdf.open(SRC)
    b = Builder(doc)
    for page in doc:
        b.avoid = ()
        hs, vs, _, _ = segments(page)
        if glyph_boxes(page):
            label_page(b, page)
        elif len(hs) > 40 and len(vs) > 40:
            grid_page(b, page)
            underscore_fields(b, page)
        else:
            line_page(b, page)
    doc.set_metadata({**doc.metadata, "title": "Patient Forms (fillable) - Kurt Vernon, MD, PA", "producer": "giguy.net"})
    doc.save(OUT, garbage=3, deflate=True)
    print(f"{OUT.name}: {len(b.debug)} fields "
          f"({sum(1 for d in b.debug if d[2] == 't')} text, {sum(1 for d in b.debug if d[2] == 'c')} checkboxes, {sum(1 for d in b.debug if d[2] == 'y')} yes/no)")
    if "--debug" in sys.argv:
        dbg = pymupdf.open(SRC)
        for pn, r, k in b.debug:
            dbg[pn].draw_rect(r, color=(1, 0, 0) if k == "t" else (0, 0, 1) if k == "c" else (0, 0.6, 0), width=0.7)
        dbg.save(DEBUG)


if __name__ == "__main__":
    main()
