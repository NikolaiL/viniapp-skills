#!/usr/bin/env python3
"""Validate and package the portable skill using only the Python standard library."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile


def main():
    root = Path(__file__).resolve().parents[1]
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/package.py <output-directory>")
    output = Path(sys.argv[1]).resolve()
    if output == root or root in output.parents:
        raise SystemExit("Package output must be outside the skill directory.")
    subprocess.run(["node", str(root / "scripts/validate.mjs")], check=True)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "viniapp-skills.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for file in sorted(root.rglob("*")):
            parts = file.relative_to(root).parts
            # The website (site/, dist/, vercel.json) is not part of the pack.
            if ".git" in parts or parts[0] in (".vercel", ".vercelignore", "site", "dist", "vercel.json"):
                continue
            if file.is_symlink():
                raise SystemExit("Symbolic links cannot be packaged.")
            if not file.is_file():
                continue
            entry = zipfile.ZipInfo(str(Path(root.name) / file.relative_to(root)), (2026, 10, 23, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, file.read_bytes())
    skill = output / "viniapp-skills.skill"
    shutil.copyfile(archive, skill)
    lines = [f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}" for file in [archive, skill]]
    (output / "SHA256SUMS").write_text("\n".join(lines) + "\n")
    print(f"Created {archive}\nCreated {skill}\nChecksums: {output / 'SHA256SUMS'}")


if __name__ == "__main__":
    main()
