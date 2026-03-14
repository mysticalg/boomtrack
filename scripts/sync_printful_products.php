#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Sync Printful products into a local JSON catalog for the static storefront.
 *
 * Usage:
 *   export PRINTFUL_API_KEY="..."
 *   php scripts/sync_printful_products.php
 *
 * This script keeps API credentials out of client-side JavaScript while still allowing
 * frontend updates from a static JSON payload.
 */

const BASE_URL = 'https://api.printful.com';

/**
 * Return the repository root path (parent of /scripts).
 */
function repoRoot(): string
{
    return dirname(__DIR__);
}

/**
 * Parse CLI options and return normalized values.
 *
 * @return array{api_key: ?string, max_products: ?int, output: string}
 */
function parseArgs(): array
{
    $options = getopt('', ['api-key::', 'max-products::', 'output::']);

    $defaultOutput = repoRoot() . '/data/printful-products.json';
    $maxProducts = null;

    if (array_key_exists('max-products', $options)) {
        $raw = $options['max-products'];
        if ($raw === false || $raw === '') {
            fwrite(STDERR, "ERROR: --max-products requires a numeric value.\n");
            exit(1);
        }

        if (!is_numeric($raw)) {
            fwrite(STDERR, "ERROR: --max-products must be an integer.\n");
            exit(1);
        }

        $maxProducts = max((int) $raw, 0);
    }

    return [
        'api_key' => isset($options['api-key']) && $options['api-key'] !== false ? (string) $options['api-key'] : null,
        'max_products' => $maxProducts,
        'output' => isset($options['output']) && $options['output'] !== false ? (string) $options['output'] : $defaultOutput,
    ];
}

/**
 * Best-effort local .env support so the script works outside CI as well.
 */
function loadDotenvApiKey(): ?string
{
    $dotenvPath = repoRoot() . '/.env';
    if (!is_file($dotenvPath)) {
        return null;
    }

    $lines = file($dotenvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return null;
    }

    foreach ($lines as $line) {
        $raw = trim($line);
        if ($raw === '' || str_starts_with($raw, '#') || !str_contains($raw, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $raw, 2);
        if (trim($key) !== 'PRINTFUL_API_KEY') {
            continue;
        }

        return trim(trim($value), "\"'");
    }

    return null;
}

/**
 * Choose API key from CLI arg, environment variable, then optional .env file.
 */
function resolveApiKey(?string $explicitApiKey): ?string
{
    if ($explicitApiKey !== null && trim($explicitApiKey) !== '') {
        return trim($explicitApiKey);
    }

    $envApiKey = getenv('PRINTFUL_API_KEY');
    if ($envApiKey !== false && trim($envApiKey) !== '') {
        return trim($envApiKey);
    }

    return loadDotenvApiKey();
}

/**
 * Perform a GET request to the Printful API and return parsed result payload.
 *
 * @return mixed
 */
function callPrintful(string $path, string $apiKey)
{
    $url = BASE_URL . $path;

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Could not initialize HTTP client.');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'User-Agent: boomtrack-printful-sync/1.0',
        ],
    ]);

    $body = curl_exec($ch);
    $curlError = curl_error($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException('Could not connect to Printful API (' . $curlError . ').');
    }

    if ($statusCode === 401) {
        throw new RuntimeException('Unauthorized Printful API key. Check PRINTFUL_API_KEY.');
    }

    if ($statusCode >= 400) {
        throw new RuntimeException('Printful API request failed with status ' . $statusCode . '.');
    }

    $payload = json_decode($body, true);
    if (!is_array($payload)) {
        throw new RuntimeException('Printful API returned invalid JSON.');
    }

    // Printful responses are typically wrapped in {"code": ..., "result": ...}.
    return $payload['result'] ?? $payload;
}

/**
 * Choose the best available image URL for storefront product cards.
 */
function bestImageUrl(array $product): ?string
{
    if (!empty($product['thumbnail_url']) && is_string($product['thumbnail_url'])) {
        return $product['thumbnail_url'];
    }

    $thumbnail = $product['thumbnail'] ?? null;
    if (is_array($thumbnail)) {
        foreach (['url', 'src'] as $key) {
            if (!empty($thumbnail[$key]) && is_string($thumbnail[$key])) {
                return $thumbnail[$key];
            }
        }
    }

    return null;
}

/**
 * Build a readable price label from available Printful retail prices.
 */
function formatPrice(array $product, string $fallback = 'From $--'): string
{
    $variants = $product['sync_variants'] ?? $product['variants'] ?? [];
    if (!is_array($variants)) {
        return $fallback;
    }

    $prices = [];
    foreach ($variants as $variant) {
        if (!is_array($variant) || !isset($variant['retail_price'])) {
            continue;
        }

        $retailPrice = $variant['retail_price'];
        if (is_numeric($retailPrice)) {
            $prices[] = (float) $retailPrice;
        }
    }

    if ($prices === []) {
        return $fallback;
    }

    return 'From $' . number_format(min($prices), 2, '.', '');
}

/**
 * Return a customer-safe URL when integration metadata provides one.
 */
function resolveProductUrl(array $product): ?string
{
    foreach (['external_url', 'product_url', 'url'] as $key) {
        if (!empty($product[$key]) && is_string($product[$key])) {
            return $product[$key];
        }
    }

    return null;
}

/**
 * Convert a raw Printful product payload into lightweight frontend data.
 *
 * @return array{id: string, title: string, description: string, image: ?string, product_url: ?string, price_display: string, is_visible: bool}
 */
function normalizeProduct(array $product): array
{
    $title = null;
    if (!empty($product['name']) && is_string($product['name'])) {
        $title = $product['name'];
    } elseif (!empty($product['title']) && is_string($product['title'])) {
        $title = $product['title'];
    }

    return [
        'id' => isset($product['id']) ? (string) $product['id'] : '',
        'title' => $title ?? 'Untitled product',
        'description' => isset($product['description']) && is_string($product['description']) ? trim($product['description']) : '',
        'image' => bestImageUrl($product),
        'product_url' => resolveProductUrl($product),
        'price_display' => formatPrice($product),
        // Printful store listings are generally publishable products.
        'is_visible' => true,
    ];
}

/**
 * Fetch Printful products and normalize them for frontend consumption.
 *
 * @return list<array<string,mixed>>
 */
function syncProducts(string $apiKey): array
{
    $response = callPrintful('/store/products', $apiKey);
    if (!is_array($response)) {
        return [];
    }

    $products = [];
    foreach ($response as $product) {
        if (!is_array($product)) {
            continue;
        }
        $products[] = normalizeProduct($product);
    }

    return $products;
}

function main(): int
{
    $args = parseArgs();
    $apiKey = resolveApiKey($args['api_key']);

    if ($apiKey === null || $apiKey === '') {
        fwrite(STDERR, "ERROR: PRINTFUL_API_KEY is required (via --api-key, env var, or .env file).\n");
        return 1;
    }

    try {
        $products = syncProducts($apiKey);

        if ($args['max_products'] !== null) {
            $products = array_slice($products, 0, $args['max_products']);
        }

        $catalog = [
            'last_synced' => gmdate('c'),
            'source' => 'printful',
            'products' => $products,
        ];

        $output = $args['output'];
        $outputDir = dirname($output);
        if (!is_dir($outputDir) && !mkdir($outputDir, 0777, true) && !is_dir($outputDir)) {
            throw new RuntimeException('Could not create output directory: ' . $outputDir);
        }

        $encoded = json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new RuntimeException('Could not encode catalog JSON.');
        }

        if (file_put_contents($output, $encoded . PHP_EOL) === false) {
            throw new RuntimeException('Could not write output file: ' . $output);
        }

        echo 'Synced ' . count($catalog['products']) . ' products to ' . $output . ".\n";
        return 0;
    } catch (RuntimeException $error) {
        fwrite(STDERR, 'ERROR: ' . $error->getMessage() . "\n");
        return 2;
    }
}

exit(main());
