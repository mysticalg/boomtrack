<?php

declare(strict_types=1);

/**
 * Browser-based admin panel for triggering maintenance tasks without SSH.
 *
 * Security model:
 * - Password login backed by a hash in data/admin-config.php
 * - Session-based authentication
 * - CSRF token required for all state-changing POST actions
 * - Fixed allow-list of commands (no user-provided shell input)
 */

session_start();

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

const ADMIN_CONFIG_PATH = __DIR__ . '/data/admin-config.php';

/**
 * Load admin configuration values from a PHP array file.
 *
 * @return array{password_hash:string}
 */
function loadAdminConfig(): array
{
    if (!is_file(ADMIN_CONFIG_PATH)) {
        return ['password_hash' => ''];
    }

    $config = require ADMIN_CONFIG_PATH;
    if (!is_array($config)) {
        return ['password_hash' => ''];
    }

    return [
        'password_hash' => isset($config['password_hash']) && is_string($config['password_hash']) ? trim($config['password_hash']) : '',
    ];
}

/**
 * Generate and persist a CSRF token in session storage.
 */
function csrfToken(): string
{
    if (empty($_SESSION['admin_csrf']) || !is_string($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['admin_csrf'];
}

/**
 * Verify posted CSRF token.
 */
function verifyCsrfToken(string $token): bool
{
    $sessionToken = $_SESSION['admin_csrf'] ?? '';
    if (!is_string($sessionToken) || $sessionToken === '') {
        return false;
    }

    return hash_equals($sessionToken, $token);
}

/**
 * Execute a whitelisted maintenance command and return terminal output.
 *
 * @return array{ok:bool, output:string}
 */
function runTaskCommand(string $taskName): array
{
    $commands = [
        'sync' => 'php scripts/sync_printful_products.php 2>&1',
        'deploy' => 'php scripts/deploy_infinityfree.php 2>&1',
        'dry_run' => 'php scripts/deploy_infinityfree.php --dry-run 2>&1',
    ];

    if (!isset($commands[$taskName])) {
        return ['ok' => false, 'output' => 'Unknown task requested.'];
    }

    if (!function_exists('shell_exec')) {
        return ['ok' => false, 'output' => 'shell_exec is disabled on this host. Ask host support to enable shell execution or run scripts manually.'];
    }

    $output = shell_exec($commands[$taskName]);
    if ($output === null) {
        return ['ok' => false, 'output' => 'Command execution failed or is blocked by server policy.'];
    }

    return ['ok' => true, 'output' => trim($output)];
}

$config = loadAdminConfig();
$hashConfigured = $config['password_hash'] !== '';
$isAuthenticated = !empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
$status = '';
$statusError = false;
$taskOutput = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf = isset($_POST['csrf']) ? (string) $_POST['csrf'] : '';
    if (!verifyCsrfToken($csrf)) {
        $status = 'Security check failed. Refresh the page and try again.';
        $statusError = true;
    } else {
        $action = isset($_POST['action']) ? (string) $_POST['action'] : '';

        if ($action === 'login' && $hashConfigured) {
            $password = isset($_POST['password']) ? (string) $_POST['password'] : '';
            if (password_verify($password, $config['password_hash'])) {
                session_regenerate_id(true);
                $_SESSION['admin_logged_in'] = true;
                $isAuthenticated = true;
                $status = '✅ Authenticated. Admin tools are ready.';
            } else {
                $status = 'Invalid password. Please try again.';
                $statusError = true;
            }
        } elseif ($action === 'logout') {
            $_SESSION = [];
            session_destroy();
            session_start();
            $isAuthenticated = false;
            $status = 'You have been logged out.';
        } elseif ($isAuthenticated && in_array($action, ['sync', 'deploy', 'dry_run'], true)) {
            $result = runTaskCommand($action);
            $status = $result['ok'] ? 'Task completed.' : 'Task could not be completed.';
            $statusError = !$result['ok'];
            $taskOutput = $result['output'];
        }
    }
}

$csrfToken = csrfToken();
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Infinite Dimensions Admin</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="section">
      <div class="container admin-wrap">
        <h1>🛠️ Admin Control Panel</h1>
        <p class="section-subtitle">Securely trigger Printful sync and InfinityFree deployment in-browser (no SSH needed).</p>

        <?php if (!$hashConfigured): ?>
          <article class="admin-card admin-warning" aria-live="polite">
            <h2>🔒 Setup required</h2>
            <p>
              Create <code>data/admin-config.php</code> with a password hash before this panel can be used.
            </p>
            <p class="microcopy">
              Example file content:
              <code>&lt;?php return ['password_hash' =&gt; '$2y$10$your_hash_here'];</code>
            </p>
            <p class="microcopy">Tip: generate the hash on any PHP host using <code>password_hash('your-password', PASSWORD_DEFAULT)</code>.</p>
          </article>
        <?php endif; ?>

        <?php if ($status !== ''): ?>
          <p class="admin-status <?= $statusError ? 'is-error' : 'is-ok' ?>" aria-live="polite"><?= htmlspecialchars($status, ENT_QUOTES, 'UTF-8') ?></p>
        <?php endif; ?>

        <?php if (!$isAuthenticated && $hashConfigured): ?>
          <section class="admin-card" aria-label="Admin login form">
            <h2>🔐 Admin Login</h2>
            <form method="post" class="admin-form">
              <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
              <input type="hidden" name="action" value="login" />
              <label for="password">Admin password</label>
              <input id="password" name="password" type="password" required autocomplete="current-password" title="Enter your admin password" />
              <button class="btn btn-primary" type="submit" title="Sign in to admin tools">✅ Sign in</button>
            </form>
          </section>
        <?php endif; ?>

        <?php if ($isAuthenticated): ?>
          <section class="admin-card" aria-label="Maintenance actions">
            <div class="admin-head">
              <h2>⚙️ Maintenance Tasks</h2>
              <form method="post">
                <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                <input type="hidden" name="action" value="logout" />
                <button class="btn btn-ghost" type="submit" title="Log out from admin panel">↩️ Log out</button>
              </form>
            </div>

            <p class="microcopy">Run dry-run first, then sync catalog, then deploy.</p>

            <div class="admin-actions">
              <form method="post">
                <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                <input type="hidden" name="action" value="dry_run" />
                <button class="btn btn-ghost" type="submit" title="Preview exactly what files will upload">🧪 Deployment dry-run</button>
              </form>

              <form method="post">
                <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                <input type="hidden" name="action" value="sync" />
                <button class="btn btn-ghost" type="submit" title="Refresh local merch catalog from Printful API">🔄 Sync Printful products</button>
              </form>

              <form method="post">
                <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                <input type="hidden" name="action" value="deploy" />
                <button class="btn btn-primary" type="submit" title="Upload site files to InfinityFree over FTP">🚀 Deploy to live site</button>
              </form>
            </div>
          </section>

          <section class="admin-card" aria-label="Task output">
            <h2>📋 Latest task output</h2>
            <pre class="admin-output"><?= htmlspecialchars($taskOutput !== '' ? $taskOutput : 'No task output yet.', ENT_QUOTES, 'UTF-8') ?></pre>
          </section>
        <?php endif; ?>
      </div>
    </main>
  </body>
</html>
