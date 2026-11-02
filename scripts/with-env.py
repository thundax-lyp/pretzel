#!/usr/bin/env python3
"""Run a command with a literal KEY=VALUE file; no shell expansion or credential output."""

import argparse
import os
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--env-file", required=True)
parser.add_argument("command", nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ["--"] else args.command
if not command:
    parser.error("a command is required after --")
environment = os.environ.copy()
for number, line in enumerate(Path(args.env_file).read_text().splitlines(), 1):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    if "=" not in line:
        parser.error(f"invalid environment entry on line {number}")
    key, value = line.split("=", 1)
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in {"HOME", "CODEX_HOME", "PATH"}:
        parser.error(f"unsupported environment key on line {number}")
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    environment[key] = value
os.execvpe(command[0], command, environment)
