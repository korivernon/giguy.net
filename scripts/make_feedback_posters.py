"""Print-ready QR posters for each office: patients scan to rate their visit or thank a team member.

Run with a Python that has `segno` (pip install segno), with Google Chrome installed:
    python3 scripts/make_feedback_posters.py [--base https://giguy.net]
Writes files/feedback-poster-<office>.pdf (letter) and files/feedback-card-<office>.pdf (4 x 6 in table tent).
Re-run after the giguy.net domain switch so the QR codes point at the final address.
"""
import argparse, base64, io, pathlib, subprocess, tempfile
import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OFFICES = [('fv', 'Fuquay-Varina', '(919) 577-0085'), ('dunn', 'Dunn', '(910) 891-5808')]
LOGO = 'data:image/png;base64,' + base64.b64encode((ROOT / 'img/logos/logo.png').read_bytes()).decode()

ICONS = {
    'star': '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
    'heart': '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>',
    'chat': '<path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
}
ROWS = [('star', 'Rate your visit', 'A few quick taps on how we did'),
        ('heart', 'Thank someone on our team', 'Tell us who went above and beyond'),
        ('chat', 'Ask us to follow up', 'Leave your number or email if you want a reply')]

def qr_svg(url):
    buf = io.BytesIO()
    segno.make(url, error='m').save(buf, kind='svg', scale=10, border=4, dark='#0e3a0d', light='#ffffff', xmldecl=False, svgns=True, nl=False)
    svg = buf.getvalue().decode()
    # segno writes a fixed width/height with no viewBox; add one so the code scales with the layout instead of being cropped.
    import re
    w, h = re.search(r'width="(\d+)" height="(\d+)"', svg).groups()
    return svg.replace(f'width="{w}" height="{h}"', f'viewBox="0 0 {w} {h}"', 1)

def icon(name, size):
    return f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="#1a5718">{ICONS[name]}</svg>'

def poster(url, office, phone):
    rows = ''.join(f'<div class="row"><span class="ic">{icon(i, 30)}</span><div><b>{t}</b><small>{s}</small></div></div>' for i, t, s in ROWS)
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: letter; margin: 0; }}
* {{ box-sizing: border-box; }} body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1d2a1c; }}
.page {{ width: 8.5in; height: 11in; padding: 0.45in; display: flex; flex-direction: column; background: #FFF7F4; }}
.top {{ flex: none; background: #0e3a0d; color: #fff; border-radius: 26px; padding: 36px 40px 38px; position: relative; overflow: hidden; }}
.top:after {{ content: ""; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: #1a5718; }}
.top img {{ height: 64px; filter: brightness(0) invert(1); position: relative; z-index: 1; }}
.top h1 {{ font-size: 64px; line-height: 1.02; margin: 22px 0 12px; position: relative; z-index: 1; }}
.top p {{ font-size: 23px; margin: 0; color: #e3eedf; position: relative; z-index: 1; max-width: 6in; }}
.mid {{ flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; padding: 0.2in 0 0.15in; }}
.rows {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; }}
.row {{ display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; }}
.ic {{ width: 70px; height: 70px; border-radius: 16px; background: #fde3d8; display: flex; align-items: center; justify-content: center; flex: none; }}
.row b {{ display: block; font-size: 21px; color: #0e3a0d; }} .row small {{ display: block; font-size: 15px; color: #5d6a5b; margin-top: 3px; }}
.qrbox {{ background: #fff; border: 4px solid #F7A582; border-radius: 28px; padding: 26px 26px 20px; text-align: center; width: 3.9in; padding: 12px 12px 18px; }}
.qrbox svg {{ width: 100%; height: auto; display: block; }}
.qrbox .scan {{ font-weight: 800; color: #0e3a0d; font-size: 20px; margin: 14px 0 2px; }}
.qrbox .min {{ color: #5d6a5b; font-size: 16px; }}
.office {{ display: inline-block; background: #1a5718; color: #fff; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 15px; padding: 8px 18px; border-radius: 999px; }}
.foot {{ flex: none; border-top: 2px solid #ecdcd4; padding-top: 14px; font-size: 13.5px; color: #5d6a5b; display: flex; justify-content: space-between; gap: 20px; }}
.foot b {{ color: #0e3a0d; }}
</style></head><body><div class="page">
<div class="top"><img src="{LOGO}" alt="The GI Guy"><h1>How was your visit?</h1><p>Scan to tell us how we did, or to thank someone on our team for great care.</p></div>
<div class="mid"><span class="office">{office} office</span>
<div class="qrbox">{qr_svg(url)}<div class="scan">Scan with your phone's camera</div><div class="min">Takes about a minute · No app needed</div></div>
<div class="rows">{rows}</div></div>
<div class="foot"><span>Please don't include medical details in your feedback. For questions about your care, call <b>{phone}</b>. In an emergency, call 911.</span><span style="white-space:nowrap">Kurt Vernon, MD, PA</span></div>
</div></body></html>'''

def card(url, office, phone):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: 4in 6in; margin: 0; }} * {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1d2a1c; }}
.page {{ width: 4in; height: 6in; padding: 0.22in; background: #FFF7F4; display: flex; flex-direction: column; text-align: center; }}
.top {{ background: #0e3a0d; color: #fff; border-radius: 14px; padding: 14px 12px; }}
.top img {{ height: 30px; filter: brightness(0) invert(1); }}
.top h1 {{ font-size: 24px; margin: 8px 0 4px; }} .top p {{ font-size: 11.5px; margin: 0; color: #e3eedf; }}
.qr {{ background: #fff; border: 2px solid #F7A582; border-radius: 16px; padding: 4px; margin: 12px auto 8px; width: 2.3in; }}
.qr svg {{ width: 100%; height: auto; display: block; }}
.scan {{ font-weight: 800; color: #0e3a0d; font-size: 13px; }} .min {{ font-size: 10.5px; color: #5d6a5b; }}
.office {{ margin-top: auto; font-size: 9.5px; color: #5d6a5b; }} .office b {{ color: #1a5718; }}
</style></head><body><div class="page">
<div class="top"><img src="{LOGO}" alt="The GI Guy"><h1>How was your visit?</h1><p>Rate your visit or thank someone on our team</p></div>
<div class="qr">{qr_svg(url)}</div><div class="scan">Scan with your phone's camera</div><div class="min">Takes about a minute · No app needed</div>
<div class="office"><b>{office} office</b> · No medical details, please. Questions about your care: {phone}</div>
</div></body></html>'''

def to_pdf(html, out):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(html); path = f.name
    pathlib.Path(out).unlink(missing_ok=True)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={out}', 'file://' + path], capture_output=True)
    if not pathlib.Path(out).stat().st_size: raise SystemExit('failed: ' + out)
    print(out)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='https://korivernon.github.io/giguy.net')
    a = ap.parse_args()
    for code, office, phone in OFFICES:
        url = f'{a.base.rstrip("/")}/feedback.html?o={code}'
        slug = office.lower().replace(' ', '-').replace('fuquay-varina', 'fuquay-varina')
        to_pdf(poster(url, office, phone), str(ROOT / f'files/feedback-poster-{slug}.pdf'))
        to_pdf(card(url, office, phone), str(ROOT / f'files/feedback-card-{slug}.pdf'))
