#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Deploy static site files to InfinityFree via FTP.
 *
 * This script is intentionally small and well-commented so it's easy to maintain.
 * Use --dry-run first to verify what will be uploaded.
 */

/**
 * Return the first non-empty environment variable from the provided names.
 */
function firstNonEmptyEnv(string ...$names): ?string
{
    foreach ($names as $name) {
        $value = getenv($name);
        if ($value !== false && trim($value) !== '') {
            return trim($value);
        }
    }

    return null;
}

/**
 * Collect files to publish, keeping deployment fast and predictable.
 *
 * @return list<string>
 */
function collectFiles(string $siteRoot): array
{
    $included = ['index.html', 'styles.css', 'script.js', 'data/printful-products.json'];
    $files = [];

    foreach ($included as $name) {
        $path = $siteRoot . '/' . $name;
        if (!is_file($path)) {
            throw new RuntimeException('Missing required publish file: ' . $name);
        }
        $files[] = $path;
    }

    $assetsDir = $siteRoot . '/assets';
    if (is_dir($assetsDir)) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($assetsDir, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isFile()) {
                $files[] = $fileInfo->getPathname();
            }
        }
    }

    sort($files);
    return $files;
}

/**
 * Convert absolute local path to upload-relative path.
 */
function relativePath(string $absolutePath, string $siteRoot): string
{
    $normalizedRoot = rtrim(str_replace('\\', '/', realpath($siteRoot) ?: $siteRoot), '/');
    $normalizedPath = str_replace('\\', '/', $absolutePath);

    return ltrim(substr($normalizedPath, strlen($normalizedRoot)), '/');
}

/**
 * Ensure nested remote directories exist.
 */
function ensureRemoteDirs($ftp, string $remotePath): void
{
    if ($remotePath === '') {
        return;
    }

    $current = '';
    foreach (explode('/', trim($remotePath, '/')) as $part) {
        $current = $current === '' ? $part : $current . '/' . $part;
        @ftp_mkdir($ftp, $current);
    }
}

/**
 * Upload each file while preserving relative paths.
 */
function uploadFiles($ftp, string $siteRoot, array $files, string $remoteBase, bool $dryRun): void
{
    foreach ($files as $localPath) {
        $relative = relativePath($localPath, $siteRoot);
        $remoteFile = $remoteBase !== '' ? rtrim($remoteBase, '/') . '/' . $relative : $relative;
        $remoteDir = str_contains($remoteFile, '/') ? dirname($remoteFile) : '';

        if ($dryRun) {
            echo '[dry-run] upload ' . $localPath . ' -> ' . $remoteFile . PHP_EOL;
            continue;
        }

        ensureRemoteDirs($ftp, $remoteDir);
        $uploaded = @ftp_put($ftp, $remoteFile, $localPath, FTP_BINARY);
        if ($uploaded === false) {
            throw new RuntimeException('Failed to upload ' . $localPath . ' to ' . $remoteFile);
        }

        echo 'Uploaded ' . $localPath . ' -> ' . $remoteFile . PHP_EOL;
    }
}

/**
 * Parse CLI options.
 *
 * @return array{site_root: string, remote_dir: string, dry_run: bool}
 */
function parseArgs(): array
{
    $options = getopt('', ['site-root::', 'remote-dir::', 'dry-run']);

    return [
        'site_root' => isset($options['site-root']) && $options['site-root'] !== false ? (string) $options['site-root'] : '.',
        'remote_dir' => isset($options['remote-dir']) && $options['remote-dir'] !== false
            ? (string) $options['remote-dir']
            : (firstNonEmptyEnv('FTP_TARGET_DIR', 'ftp_target_dir') ?? 'htdocs'),
        'dry_run' => array_key_exists('dry-run', $options),
    ];
}

function main(): int
{
    $args = parseArgs();
    $siteRoot = realpath($args['site_root']) ?: $args['site_root'];
    $files = collectFiles($siteRoot);

    if ($args['dry_run']) {
        echo "Dry run mode enabled.\n";
        uploadFiles(null, $siteRoot, $files, $args['remote_dir'], true);
        return 0;
    }

    $ftpHost = firstNonEmptyEnv('FTP_HOST', 'ftp_host') ?? 'ftpupload.net';
    $ftpUser = firstNonEmptyEnv('FTP_USER', 'FTP_USERNAME', 'ftp_user', 'ftp_username');
    $ftpPassword = firstNonEmptyEnv('FTP_PASSWORD', 'ftp_password');

    if ($ftpUser === null || $ftpPassword === null) {
        fwrite(STDERR, "Set FTP credentials before deploying. Supported variables: FTP_USER/FTP_USERNAME and FTP_PASSWORD.\n");
        return 1;
    }

    echo 'Connecting to ' . $ftpHost . "...\n";
    $ftp = @ftp_connect($ftpHost, 21, 30);
    if ($ftp === false) {
        fwrite(STDERR, 'ERROR: Could not connect to FTP host ' . $ftpHost . ".\n");
        return 2;
    }

    $loggedIn = @ftp_login($ftp, $ftpUser, $ftpPassword);
    if ($loggedIn === false) {
        ftp_close($ftp);
        fwrite(STDERR, "ERROR: FTP login failed. Check FTP credentials.\n");
        return 3;
    }

    ftp_pasv($ftp, true);
    echo "Connected. Starting upload...\n";

    try {
        uploadFiles($ftp, $siteRoot, $files, $args['remote_dir'], false);
    } catch (RuntimeException $error) {
        ftp_close($ftp);
        fwrite(STDERR, 'ERROR: ' . $error->getMessage() . "\n");
        return 4;
    }

    ftp_close($ftp);
    echo "Deployment complete.\n";
    return 0;
}

exit(main());
