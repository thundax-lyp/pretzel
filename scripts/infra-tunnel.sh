#!/bin/sh
set -eu
pretzel_action=${1:-status}
pretzel_host=${2:-${PRETZEL_INFRA_SSH_HOST:-}}
if [ -z "$pretzel_host" ]; then
    echo 'Usage: infra-tunnel.sh start|status|stop user@server' >&2
    exit 2
fi
pretzel_socket="/tmp/pretzel-infra-ssh-$(id -u).sock"
case "$pretzel_action" in
    start)
        if ssh -S "$pretzel_socket" -O check "$pretzel_host" >/dev/null 2>&1; then
            echo 'Pretzel infrastructure tunnel already running.'
            exit 0
        fi
        ssh -M -S "$pretzel_socket" -f -N -o ControlPersist=yes \
            -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
            -L 127.0.0.1:13316:127.0.0.1:23316 \
            -L 127.0.0.1:16316:127.0.0.1:26316 "$pretzel_host"
        ;;
    status)
        ssh -S "$pretzel_socket" -O check "$pretzel_host"
        ;;
    stop)
        ssh -S "$pretzel_socket" -O exit "$pretzel_host"
        ;;
    *)
        echo 'Expected start, status or stop.' >&2
        exit 2
        ;;
esac
