#!/usr/bin/env python3
"""Bridge between the site's "Suggest an edit" inbox and Claude Code.

Suggestions live in the PRIVATE repo korivernon/giguy-edits as edits/<id>.json
(+ edits/<id>.jpg screenshot). Uses the GitHub CLI's login (`gh auth login`).

    edits.py export [--status new,in_progress] [--out DIR]   # JSON to stdout, screenshots to DIR
    edits.py update ID --status done --note "What changed" [--commit SHA]
    edits.py count
"""
import argparse, base64, json, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO = "korivernon/giguy-edits"
DIR = "edits"


def gh(path, method="GET", body=None, raw=False):
    cmd = ["gh", "api", "-X", method, f"repos/{REPO}/{path}"]
    if raw:
        cmd += ["-H", "Accept: application/vnd.github.raw"]
    if body is not None:
        cmd += ["--input", "-"]
    r = subprocess.run(cmd, input=json.dumps(body).encode() if body is not None else None, capture_output=True)
    if r.returncode != 0:
        msg = r.stderr.decode() or r.stdout.decode()
        if "Not Found" in msg and path.startswith(f"contents/{DIR}"):
            return None
        sys.exit(f"gh api {path}: {msg.strip()}")
    return r.stdout if raw else json.loads(r.stdout or b"null")


def load_all():
    files = gh(f"contents/{DIR}") or []
    items = []
    for f in files:
        if f["name"].endswith(".json"):
            meta = gh(f"contents/{f['path']}")
            item = json.loads(base64.b64decode(meta["content"]))
            item["_sha"] = meta["sha"]
            items.append(item)
    return sorted(items, key=lambda x: x.get("submitted_at", ""))


def export(statuses, out_dir):
    out = Path(out_dir or tempfile.mkdtemp(prefix="giguy-edits-"))
    out.mkdir(parents=True, exist_ok=True)
    items = []
    for it in load_all():
        if it.get("status") not in statuses:
            continue
        shot = None
        if it.get("screenshot"):
            shot = out / Path(it["screenshot"]).name
            shot.write_bytes(gh(f"contents/{it['screenshot']}", raw=True))
        it = {k: v for k, v in it.items() if k != "_sha"}
        it["screenshot_file"] = str(shot) if shot else None
        items.append(it)
    print(json.dumps({"screenshot_dir": str(out), "count": len(items), "items": items}, indent=2))


def update(eid, status, note, commit):
    match = [x for x in load_all() if x["id"] == eid]
    if not match:
        sys.exit(f"edit {eid} not found")
    it = match[0]
    sha = it.pop("_sha")
    if status:
        it["status"] = status
    if note is not None:
        it["resolution"] = note
    if commit:
        it["resolved_commit"] = commit
    it["updated_at"] = datetime.now(timezone.utc).isoformat()
    content = base64.b64encode((json.dumps(it, indent=2) + "\n").encode()).decode()
    gh(f"contents/{DIR}/{eid}.json", "PUT", {"message": f"Edit {eid}: {it['status']}", "content": content, "sha": sha})
    print(f"{eid}: {it['status']}" + (f" -- {note}" if note else ""))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export"); e.add_argument("--status", default="new,in_progress"); e.add_argument("--out")
    u = sub.add_parser("update"); u.add_argument("id"); u.add_argument("--status", choices=["new", "in_progress", "done", "wont_do"])
    u.add_argument("--note"); u.add_argument("--commit")
    sub.add_parser("count")
    a = p.parse_args()
    if a.cmd == "export":
        export(a.status.split(","), a.out)
    elif a.cmd == "update":
        update(a.id, a.status, a.note, a.commit)
    else:
        items = load_all()
        print(json.dumps({s: sum(1 for x in items if x.get("status") == s) for s in ("new", "in_progress", "done", "wont_do")}))


if __name__ == "__main__":
    main()
