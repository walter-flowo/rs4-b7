#!/usr/bin/env python3
"""Build site/js/data.js (window.RS4_DATA) from the tracker's ledger.

Feeds the FIFM! (Find It For Me!) tab of the RS4 site: ranked live listings,
price histories, market trend, and closed-out ("gone") adverts. Also copies
each live advert's cached photo into site/media/ so the site works on file://.

Run standalone or via the pipeline (S4 calls it, non-fatally).
"""
from __future__ import annotations

import datetime as dt
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Optional

SITE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SITE_DIR.parent
STATE_DIR = PROJECT_ROOT / "state"
LEDGER_PATH = STATE_DIR / "ledger.json"
MARKET_HISTORY_PATH = STATE_DIR / "market_history.json"
MEDIA_CACHE_DIR = STATE_DIR / "media"
MEDIA_HIRES_DIR = STATE_DIR / "media_hires"
OUT_JS = SITE_DIR / "js" / "data.js"
SITE_MEDIA = SITE_DIR / "media"
SITE_MEDIA_HIRES = SITE_DIR / "media" / "hires"

# B7 RS4 paint identification — matched against advert text, longest first
PAINTS: list[tuple[str, str, str]] = [
    ("sprint blue", "Sprint Blue", "#1757c2"),
    ("mugello blue", "Mugello Blue", "#1a3f8f"),
    ("misano red", "Misano Red", "#b01526"),
    ("phantom black", "Phantom Black", "#0b0d10"),
    ("brilliant black", "Brilliant Black", "#0d0d0f"),
    ("ebony black", "Ebony Black", "#101012"),
    ("avus silver", "Avus Silver", "#c9ccd1"),
    ("light silver", "Light Silver", "#d3d6da"),
    ("daytona grey", "Daytona Grey", "#3b3f45"),
    ("dolphin grey", "Dolphin Grey", "#6a6e74"),
    ("sphinx beige", "Sphinx Beige", "#b7a98e"),
    (" black", "Black", "#0d0d0f"),
    (" silver", "Silver", "#c9ccd1"),
    (" grey", "Grey", "#55595f"),
    (" blue", "Blue", "#1a4ba8"),
    (" red", "Red", "#a91d2c"),
]


def detect_paint(entry: dict[str, Any]) -> Optional[dict[str, str]]:
    hay = " ".join(str(entry.get(k) or "") for k in
                   ("attention_grabber", "description_text", "subtitle")).lower()
    for needle, name, hexcode in PAINTS:
        if needle in hay:
            return {"name": name, "hex": hexcode}
    return None


def _read(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _fmt_price(p: Optional[int]) -> Optional[str]:
    return f"£{p:,}" if isinstance(p, int) else None


def _days_between(a: Optional[str], b: str) -> Optional[int]:
    if not a:
        return None
    try:
        return max(0, (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days)
    except ValueError:
        return None


def build() -> dict[str, Any]:
    ledger = _read(LEDGER_PATH, {"adverts": {}})
    history = _read(MARKET_HISTORY_PATH, [])
    adverts: dict[str, dict[str, Any]] = ledger.get("adverts", {})
    today = dt.date.today().isoformat()

    SITE_MEDIA.mkdir(parents=True, exist_ok=True)
    live: list[dict[str, Any]] = []
    gone: list[dict[str, Any]] = []

    SITE_MEDIA_HIRES.mkdir(parents=True, exist_ok=True)
    for aid, e in adverts.items():
        photo = MEDIA_CACHE_DIR / f"{aid}.jpg"
        image = None
        if photo.exists():
            dest = SITE_MEDIA / photo.name
            if not dest.exists() or dest.stat().st_size != photo.stat().st_size:
                shutil.copy2(photo, dest)
            image = f"media/{photo.name}"
        images_hires: list[str] = []
        if MEDIA_HIRES_DIR.exists():
            for src in sorted(MEDIA_HIRES_DIR.glob(f"{aid}_*.jpg")):
                dest = SITE_MEDIA_HIRES / src.name
                if not dest.exists() or dest.stat().st_size != src.stat().st_size:
                    shutil.copy2(src, dest)
                images_hires.append(f"media/hires/{src.name}")
        base = {
            "advert_id": aid,
            "title": e.get("title"),
            "subtitle": e.get("subtitle"),
            "attention_grabber": e.get("attention_grabber"),
            "price": e.get("price"),
            "price_text": e.get("price_text") or _fmt_price(e.get("price")),
            "year": e.get("year"),
            "mileage": e.get("mileage"),
            "mileage_text": e.get("mileage_text"),
            "location": e.get("location"),
            "seller_type": (e.get("seller_type") or "").title() or None,
            "url": e.get("url"),
            "image": image,
            "images_hires": images_hires,
            "paint": detect_paint(e),
            "keyword_hits": e.get("keyword_hits") or [],
            "keyword_flags": e.get("keyword_flags") or [],
            "score": e.get("score") or 0,
            "first_seen": e.get("first_seen"),
            "days_listed": _days_between(e.get("first_seen"), today),
            "price_history": e.get("price_history") or [],
        }
        if e.get("status") == "live":
            live.append(base)
        else:
            base["removed_date"] = e.get("removed_date")
            base["last_seen"] = e.get("last_seen")
            base["days_on_market"] = _days_between(
                e.get("first_seen"), e.get("removed_date") or today)
            gone.append(base)

    # FIFM ranking: desirability score desc, then lowest mileage, then price
    live.sort(key=lambda l: (-(l["score"]), l["mileage"] or 10**9,
                             l["price"] or 10**9))
    for rank, item in enumerate(live, 1):
        item["rank"] = rank
    gone.sort(key=lambda g: g.get("removed_date") or "", reverse=True)

    prices = [l["price"] for l in live if isinstance(l["price"], int)]
    miles = [l["mileage"] for l in live if isinstance(l["mileage"], int)]
    return {
        "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "search_label": "Audi RS4 B7 · 2006–2008 · Manual · Petrol · UK-wide",
        "market": {
            "total_live": len(live),
            "floor_price": min(prices) if prices else None,
            "ceiling_price": max(prices) if prices else None,
            "lowest_mileage": min(miles) if miles else None,
            "days_tracked": len(history),
            "trend": history,
            "listings": live,
            "gone": gone,
        },
    }


def main() -> int:
    data = build()
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "// generated by site/build_data.py — do not edit\n"
        f"window.RS4_DATA = {json.dumps(data, indent=1, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    m = data["market"]
    print(f"data.js written: {m['total_live']} live · {len(m['gone'])} gone · "
          f"{m['days_tracked']} days of trend")
    return 0


if __name__ == "__main__":
    sys.exit(main())
