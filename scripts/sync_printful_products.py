#!/usr/bin/env python3
"""Sync Printful products into a local JSON catalog for the static storefront.

Usage:
  export PRINTFUL_API_KEY="..."
  python scripts/sync_printful_products.py

This script keeps API credentials out of client-side JavaScript while still allowing
frontend updates from a static JSON payload.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "data" / "printful-products.json"
BASE_URL = "https://api.printful.com"


def call_printful(path: str, api_key: str) -> Any:
    """Perform a GET request to the Printful API and return parsed JSON result payload."""
    request = Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {api_key}", "User-Agent": "boomtrack-printful-sync/1.0"},
    )
    with urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))

    # Printful responses are typically wrapped in {"code": ..., "result": ...}.
    return payload.get("result", payload)


def load_dotenv_api_key() -> str | None:
    """Best-effort local .env support so the script works outside CI as well."""
    dotenv_path = REPO_ROOT / ".env"
    if not dotenv_path.exists():
        return None

    for line in dotenv_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue

        key, value = raw.split("=", 1)
        if key.strip() == "PRINTFUL_API_KEY":
            return value.strip().strip('"').strip("'")

    return None


def resolve_api_key(explicit_api_key: str | None) -> str | None:
    """Choose API key from CLI arg, environment variable, then optional .env file."""
    return explicit_api_key or os.getenv("PRINTFUL_API_KEY") or load_dotenv_api_key()


def best_image_url(product: dict[str, Any]) -> str | None:
    """Choose the best available image URL for storefront product cards."""
    # Most common field in list endpoint responses.
    if isinstance(product.get("thumbnail_url"), str) and product.get("thumbnail_url"):
        return product["thumbnail_url"]

    # Some payloads include named thumbnail sub-objects.
    thumbnail = product.get("thumbnail") or {}
    if isinstance(thumbnail, dict):
        for key in ("url", "src"):
            if isinstance(thumbnail.get(key), str) and thumbnail.get(key):
                return thumbnail[key]

    return None


def format_price(product: dict[str, Any], fallback: str = "From $--") -> str:
    """Build a readable price label from available Printful retail prices."""
    variants = product.get("sync_variants") or product.get("variants") or []
    prices: list[float] = []

    for variant in variants:
        if not isinstance(variant, dict):
            continue

        retail_price = variant.get("retail_price")
        if isinstance(retail_price, (int, float)):
            prices.append(float(retail_price))
            continue
        if isinstance(retail_price, str):
            try:
                prices.append(float(retail_price))
            except ValueError:
                pass

    if not prices:
        return fallback

    return f"From ${min(prices):.2f}"


def resolve_product_url(product: dict[str, Any]) -> str | None:
    """Return a customer-safe URL when Printful integration metadata provides one."""
    # Prefer explicit external URL if integrations expose it.
    for key in ("external_url", "product_url", "url"):
        if isinstance(product.get(key), str) and product.get(key):
            return product[key]

    return None


def normalize_product(product: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw Printful product payload into lightweight frontend data."""
    return {
        "id": str(product.get("id", "")),
        "title": product.get("name") or product.get("title") or "Untitled product",
        "description": (product.get("description") or "").strip(),
        "image": best_image_url(product),
        "product_url": resolve_product_url(product),
        "price_display": format_price(product),
        # Printful store listings are generally publishable products.
        "is_visible": True,
    }


def sync_products(api_key: str) -> list[dict[str, Any]]:
    """Fetch Printful products and normalize them for frontend consumption."""
    response = call_printful("/store/products", api_key)
    if not isinstance(response, list):
        return []
    return [normalize_product(product) for product in response]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Printful products to data/printful-products.json")
    parser.add_argument("--api-key", help="Optional API key override (otherwise env/.env is used).")
    parser.add_argument("--max-products", type=int, help="Optional cap for number of products written to JSON.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT.relative_to(REPO_ROOT)})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = resolve_api_key(args.api_key)

    if not api_key:
        print("ERROR: PRINTFUL_API_KEY is required (via --api-key, env var, or .env file).")
        return 1

    try:
        products = sync_products(api_key)

        if args.max_products is not None:
            products = products[: max(args.max_products, 0)]

        catalog = {
            "last_synced": datetime.now(timezone.utc).isoformat(),
            "source": "printful",
            "products": products,
        }

        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    except HTTPError as error:
        if error.code == 401:
            print("ERROR: Unauthorized Printful API key. Check PRINTFUL_API_KEY.")
            return 2
        print(f"ERROR: Printful API request failed with status {error.code}.")
        return 3
    except URLError as error:
        print(f"ERROR: Could not connect to Printful API ({error.reason}).")
        return 4
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 5

    print(f"Synced {len(catalog['products'])} products to {args.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
