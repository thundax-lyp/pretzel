#!/usr/bin/env python3
"""Initialize one isolated deployment; never print or rotate existing credentials."""

import argparse
import os
import secrets
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("environment", choices=["smoke", "release"])
parser.add_argument(
    "--directory", type=Path, help="Explicit deployment directory; defaults to deploy/<environment>"
)
parser.add_argument(
    "--adopt-existing",
    action="store_true",
    help="Preserve and mark an inspected legacy credentials directory",
)
args = parser.parse_args()
base = (args.directory or Path(__file__).resolve().parent / args.environment).resolve()
if not (base / "compose.yaml").is_file():
    parser.error("target directory must contain its compose.yaml")
marker = base / ".environment"
private = base / ".secrets"
if marker.exists() and marker.read_text().strip() != args.environment:
    parser.error("target belongs to a different deployment environment")
if not marker.exists() and private.exists() and any(private.iterdir()) and not args.adopt_existing:
    parser.error(
        "existing credentials have no environment marker; inspect before using --adopt-existing"
    )
private.mkdir(mode=0o700, exist_ok=True)
private.chmod(0o700)


def ensure(name):
    path = private / name
    if not path.exists():
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(secrets.token_hex(32))
    path.chmod(
        0o644
    )  # Bind-mounted files must be readable by the container UID; host parent is 0700.
    return path.read_text().strip()


app = ensure("mysql_app_password")
ensure("mysql_root_password")
redis = ensure("redis_password")
config = private / "redis.conf"
if not config.exists():
    config.write_text(
        "bind 0.0.0.0\nprotected-mode yes\nport 6379\nappendonly yes\nappendfsync everysec\nrequirepass "
        + redis
        + "\n"
    )
config.chmod(0o644)
client = base / "dev.env"
legacy = base / "client.env"
if not client.exists() and legacy.exists():
    if not args.adopt_existing:
        parser.error("legacy client.env exists; inspect before using --adopt-existing")
    client.write_bytes(legacy.read_bytes())
if not client.exists():
    smoke = args.environment == "smoke"
    mysql_port, redis_port, app_port = (33316, 36316, 8216) if smoke else (23316, 26316, 8116)
    database = "pretzel_smoke" if smoke else "pretzel"
    admin = "Adm!9" + secrets.token_hex(20)
    client.write_text(
        f"MYSQL_IMAGE=mysql:8.4\nREDIS_IMAGE=redis:7.2\nMYSQL_PORT={mysql_port}\nREDIS_PORT={redis_port}\n"
        f"DB_URL=jdbc:mysql://127.0.0.1:{mysql_port}/{database}?serverTimezone=Asia/Shanghai\n"
        f"DB_USERNAME={database}\nDB_PASSWORD={app}\n"
        f"REDIS_URL=redis://:{redis}@127.0.0.1:{redis_port}/0\nREDIS_PASSWORD={redis}\n"
        f"SERVER_PORT={app_port}\nSERVER_ADDRESS=127.0.0.1\n"
        f"PRETZEL_BOOTSTRAP_ENABLED=false\nPRETZEL_BOOTSTRAP_USERNAME=admin\nPRETZEL_BOOTSTRAP_PASSWORD={admin}\n"
    )
client.chmod(0o600)
marker.write_text(args.environment + "\n")
print(f"{args.environment} configuration ready; credentials were not printed or rotated.")
