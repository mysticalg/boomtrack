# Deploying Infinite Dimensions to InfinityFree

This project is a static website (`index.html`, `styles.css`, `script.js`).
Use the included PHP deployment helper for a fast, repeatable FTP upload.

## 1) Configure FTP credentials (local/manual deploy)

> Do **not** commit credentials to git. Set them only in your shell session.

```bash
export FTP_HOST=ftpupload.net
export FTP_USER='YOUR_FTP_USERNAME'
export FTP_PASSWORD='YOUR_FTP_PASSWORD'
# Usually htdocs for the primary domain; adjust if your domain is in a subfolder.
export FTP_TARGET_DIR='htdocs'
```

## 2) Sync Printful products before deploy

The merch section is powered by `data/printful-products.json` so the site stays fast and static.

```bash
export PRINTFUL_API_KEY='YOUR_PRINTFUL_API_KEY'
php scripts/sync_printful_products.php
```

The script reads your synced store products from Printful and writes a static JSON catalog.
You can also place `PRINTFUL_API_KEY=...` in a local `.env` file for convenience.

## 3) Preview upload plan (safe)

```bash
php scripts/deploy_infinityfree.php --dry-run
```

## 4) Deploy to live site (manual)

```bash
php scripts/deploy_infinityfree.php
```

## 5) Verify deployment

```bash
curl -I https://mysticalg.kesug.com
```

If your domain is an addon domain mapped in another directory, set:

```bash
export FTP_TARGET_DIR='mysticalg.kesug.com/htdocs'
```

Then run deployment again.

---

## GitHub Actions auto-deploy setup

A workflow is included at `.github/workflows/deploy-infinityfree.yml`.
It deploys automatically on pushes to `main` when site/deploy files change, and also supports manual runs.

### Required GitHub repository secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret** and add:

- `FTP_HOST` → `ftpupload.net`
- `FTP_USER` → your InfinityFree FTP username
- `FTP_PASSWORD` → your InfinityFree FTP password
- `FTP_TARGET_DIR` → usually `htdocs`
- `PRINTFUL_API_KEY` → Printful API key used by a pre-deploy sync step (if you automate sync)

### First-run checklist

1. Ensure your default deployment branch is `main` (or update the workflow branch filter).
2. Add the required secrets above.
3. Run Printful sync, then push to `main` or run **Actions → Deploy to InfinityFree → Run workflow**.
4. Confirm success in the Actions log, then verify with:

```bash
curl -I https://mysticalg.kesug.com
```


## Browser admin (no SSH)

If you cannot use SSH, you can trigger sync/deploy from `admin.php`.

1. Edit `data/admin-config.php` and set `password_hash` to a `password_hash(...)` value.
2. Open `https://your-domain/admin.php` and sign in.
3. Run **Deployment dry-run**, then **Sync Printful products**, then **Deploy to live site**.

> Security tip: keep a strong password and do not share the admin URL publicly.
