#!/usr/bin/env python3
"""Deploy static site files to InfinityFree via FTP.

This script is intentionally small and well-commented so it's easy to maintain.
Use --dry-run first to verify what will be uploaded.
"""

from __future__ import annotations

import argparse
import os
from ftplib import FTP
from pathlib import Path
from typing import Iterable


def collect_files(site_root: Path) -> list[Path]:
    """Collect files to publish, keeping deployment fast and predictable."""
    included = ["index.html", "styles.css", "script.js"]
    files = [site_root / name for name in included]

    # Optionally include assets/ if it exists for future media files.
    assets_dir = site_root / "assets"
    if assets_dir.exists():
        files.extend(path for path in assets_dir.rglob("*") if path.is_file())

    missing = [str(path) for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required publish files: {', '.join(missing)}")

    return files


def ensure_remote_dirs(ftp: FTP, remote_path: str) -> None:
    """Create nested directories remotely if they do not already exist."""
    if not remote_path:
        return

    # Build each path segment one by one to avoid FTP server quirks.
    current = ""
    for part in remote_path.strip("/").split("/"):
        current = f"{current}/{part}" if current else part
        try:
            ftp.mkd(current)
        except Exception:
            # Directory likely exists, so continue.
            pass


def upload_files(
    ftp: FTP,
    site_root: Path,
    files: Iterable[Path],
    remote_base: str,
    dry_run: bool,
) -> None:
    """Upload each file preserving relative paths."""
    for local_path in files:
        rel = local_path.relative_to(site_root).as_posix()
        remote_file = f"{remote_base.rstrip('/')}/{rel}" if remote_base else rel
        remote_dir = remote_file.rsplit("/", 1)[0] if "/" in remote_file else ""

        if dry_run:
            print(f"[dry-run] upload {local_path} -> {remote_file}")
            continue

        ensure_remote_dirs(ftp, remote_dir)
        with local_path.open("rb") as source:
            ftp.storbinary(f"STOR {remote_file}", source)
        print(f"Uploaded {local_path} -> {remote_file}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy Infinite Dimensions site to InfinityFree")
    parser.add_argument("--site-root", default=".", help="Path to website project root")
    parser.add_argument(
        "--remote-dir",
        default=os.getenv("FTP_TARGET_DIR", "htdocs"),
        help="Remote directory on FTP server (default: htdocs or FTP_TARGET_DIR)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show planned uploads without sending files")
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    files = collect_files(site_root)

    if args.dry_run:
        print("Dry run mode enabled.")
        for path in files:
            rel = path.relative_to(site_root).as_posix()
            remote_file = f"{args.remote_dir.rstrip('/')}/{rel}" if args.remote_dir else rel
            print(f"[dry-run] upload {path} -> {remote_file}")
        return 0

    ftp_host = os.getenv("FTP_HOST", "ftpupload.net")
    ftp_user = os.getenv("FTP_USER")
    ftp_password = os.getenv("FTP_PASSWORD")

    if not ftp_user or not ftp_password:
        raise SystemExit("Set FTP_USER and FTP_PASSWORD environment variables before deploying.")

    print(f"Connecting to {ftp_host}...")
    with FTP(ftp_host, timeout=30) as ftp:
        ftp.login(ftp_user, ftp_password)
        print("Connected. Starting upload...")
        upload_files(ftp, site_root, files, args.remote_dir, dry_run=False)

    print("Deployment complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
