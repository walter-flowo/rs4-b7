#!/bin/zsh
exec python3 -m http.server 8437 --directory "$(dirname "$0")"
