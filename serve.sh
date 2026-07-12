#!/bin/zsh
# Local preview server for the RS4 site.
# Default: localhost only. Pass --lan to deliberately share on your network.
BIND="127.0.0.1"
if [ "${1:-}" = "--lan" ]; then
  BIND="0.0.0.0"
  echo "serving to the WHOLE local network: http://$(ipconfig getifaddr en0 2>/dev/null || echo '<your-ip>'):8437/"
fi
exec python3 -m http.server 8437 --bind "$BIND" --directory "$(dirname "$0")"
