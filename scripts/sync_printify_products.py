#!/usr/bin/env python3
"""Sync Printify products into a local JSON catalog for the static storefront.

Usage:
  export PRINTIFY_API_KEY="..."
  python scripts/sync_printify_products.py --shop-id <SHOP_ID>

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
DEFAULT_OUTPUT = REPO_ROOT / "data" / "printify-products.json"
BASE_URL = "https://api.printify.com/v1"


def call_printify(path: str, api_key: str) -> Any:
    """Perform a GET request to the Printify API and return parsed JSON."""
    request = Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {api_key}", "User-Agent": "boomtrack-printify-sync/1.0"},
    )
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def select_shop_id(api_key: str, explicit_shop_id: str | None) -> str:
    """Resolve the shop ID from CLI input or API list response."""
    if explicit_shop_id:
        return explicit_shop_id

    shops = call_printify("/shops.json", api_key)
    if not shops:
        raise RuntimeError("No Printify shops found for this API key.")

    return str(shops[0]["id"])


def best_image_url(images: list[dict[str, Any]]) -> str | None:
    """Pick the largest preview image available for storefront cards."""
    if not images:
        return None

    sorted_images = sorted(images, key=lambda item: item.get("position", 99999))
    return sorted_images[0].get("src")


def format_price(product: dict[str, Any]) -> str:
    """Convert Printify variant prices from cents into a readable label."""
    variants = product.get("variants", [])
    visible_prices = [v.get("price") for v in variants if v.get("is_enabled") and isinstance(v.get("price"), int)]

    if not visible_prices:
        return "From $--"

    minimum = min(visible_prices) / 100
    return f"From ${minimum:.2f}"


def normalize_product(product: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw Printify product payload into lightweight frontend data."""
    return {
        "id": str(product.get("id", "")),
        "title": product.get("title", "Untitled product"),
        "description": product.get("description", "").strip(),
        "image": best_image_url(product.get("images", [])),
        "product_url": product.get("external", {}).get("handle")
        and f"https://printify.com/app/products/{product.get('id')}",
        "price_display": format_price(product),
        "is_visible": bool(product.get("visible", False)),
    }


def sync_products(api_key: str, shop_id: str) -> dict[str, Any]:
    """Fetch products from Printify and prepare JSON catalog structure."""
    response = call_printify(f"/shops/{shop_id}/products.json", api_key)
    products = [normalize_product(product) for product in response.get("data", [])]

    return {
        "last_synced": datetime.now(timezone.utc).isoformat(),
        "shop_id": shop_id,
        "products": products,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Printify products to data/printify-products.json")
    parser.add_argument("--shop-id", help="Printify shop ID. If omitted, first shop from API is used.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT.relative_to(REPO_ROOT)})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.getenv("PRINTIFY_API_KEY")

    if not api_key:
        print("ERROR: PRINTIFY_API_KEY environment variable is required.")
        return 1

    try:
        shop_id = select_shop_id(api_key, args.shop_id)
        catalog = sync_products(api_key, shop_id)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    except HTTPError as error:
        print(f"ERROR: Printify API request failed with status {error.code}.")
        return 2
    except URLError as error:
        print(f"ERROR: Could not connect to Printify API ({error.reason}).")
        return 3
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 4

    print(f"Synced {len(catalog['products'])} products from shop {shop_id} to {args.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
