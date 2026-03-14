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
        headers={"Authorization": f"Bearer {api_key}", "User-Agent": "boomtrack-printify-sync/1.1"},
    )
    with urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


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
        if key.strip() == "PRINTIFY_API_KEY":
            return value.strip().strip('"').strip("'")

    return None


def resolve_api_key(explicit_api_key: str | None) -> str | None:
    """Choose API key from CLI arg, environment variable, then optional .env file."""
    return explicit_api_key or os.getenv("PRINTIFY_API_KEY") or load_dotenv_api_key()


def select_shop(api_key: str, explicit_shop_id: str | None) -> dict[str, Any]:
    """Resolve the shop payload from CLI input or API list response."""
    shops = call_printify("/shops.json", api_key)
    if not shops:
        raise RuntimeError("No Printify shops found for this API key.")

    if explicit_shop_id:
        for shop in shops:
            if str(shop.get("id")) == str(explicit_shop_id):
                return shop
        raise RuntimeError(f"Shop ID {explicit_shop_id} was not found for this API key.")

    return shops[0]


def best_image_url(images: list[dict[str, Any]]) -> str | None:
    """Pick the first positioned preview image available for storefront cards."""
    if not images:
        return None

    sorted_images = sorted(images, key=lambda item: item.get("position", 99999))
    return sorted_images[0].get("src")


def format_price(product: dict[str, Any]) -> str:
    """Convert Printify variant prices from cents into a readable label."""
    variants = product.get("variants", [])
    enabled_prices = [variant.get("price") for variant in variants if variant.get("is_enabled") and isinstance(variant.get("price"), int)]

    if not enabled_prices:
        return "From $--"

    return f"From ${min(enabled_prices) / 100:.2f}"


def resolve_product_url(product: dict[str, Any]) -> str | None:
    """Return a customer-safe URL when Printify provides one."""
    external = product.get("external") or {}
    # Prefer external.url when connected storefronts provide a direct public URL.
    if isinstance(external.get("url"), str) and external.get("url"):
        return external["url"]
    # Fallback: some integrations expose a handle URL directly.
    if isinstance(external.get("handle"), str) and external.get("handle", "").startswith("http"):
        return external["handle"]
    return None


def normalize_product(product: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw Printify product payload into lightweight frontend data."""
    return {
        "id": str(product.get("id", "")),
        "title": product.get("title", "Untitled product"),
        "description": product.get("description", "").strip(),
        "image": best_image_url(product.get("images", [])),
        "product_url": resolve_product_url(product),
        "price_display": format_price(product),
        "is_visible": bool(product.get("visible", False)),
    }


def sync_products(api_key: str, shop_id: str) -> list[dict[str, Any]]:
    """Fetch products from Printify and normalize them for frontend consumption."""
    response = call_printify(f"/shops/{shop_id}/products.json", api_key)
    return [normalize_product(product) for product in response.get("data", [])]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Printify products to data/printify-products.json")
    parser.add_argument("--shop-id", help="Printify shop ID. If omitted, the first shop from API is used.")
    parser.add_argument("--api-key", help="Optional API key override (otherwise env/.env is used).")
    parser.add_argument("--include-hidden", action="store_true", help="Include hidden/unpublished products in output.")
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
        print("ERROR: PRINTIFY_API_KEY is required (via --api-key, env var, or .env file).")
        return 1

    try:
        shop = select_shop(api_key, args.shop_id)
        shop_id = str(shop["id"])
        products = sync_products(api_key, shop_id)

        if not args.include_hidden:
            products = [product for product in products if product["is_visible"]]

        if args.max_products is not None:
            products = products[: max(args.max_products, 0)]

        catalog = {
            "last_synced": datetime.now(timezone.utc).isoformat(),
            "shop_id": shop_id,
            "shop_title": shop.get("title") or "Unknown shop",
            "products": products,
        }

        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    except HTTPError as error:
        if error.code == 401:
            print("ERROR: Unauthorized Printify API key. Check PRINTIFY_API_KEY.")
            return 2
        print(f"ERROR: Printify API request failed with status {error.code}.")
        return 3
    except URLError as error:
        print(f"ERROR: Could not connect to Printify API ({error.reason}).")
        return 4
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 5

    print(f"Synced {len(catalog['products'])} products from shop {shop_id} to {args.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
