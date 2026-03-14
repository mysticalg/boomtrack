# Deploying Infinite Dimensions to InfinityFree

This project is a static website (`index.html`, `styles.css`, `script.js`).
Use the included deployment helper for a fast, repeatable FTP upload.

## 1) Configure FTP credentials

> Do **not** commit credentials to git. Set them only in your shell session.

```bash
export FTP_HOST=ftpupload.net
export FTP_USER='YOUR_FTP_USERNAME'
export FTP_PASSWORD='YOUR_FTP_PASSWORD'
# Usually htdocs for the primary domain; adjust if your domain is in a subfolder.
export FTP_TARGET_DIR='htdocs'
```

## 2) Preview upload plan (safe)

```bash
python3 scripts/deploy_infinityfree.py --dry-run
```

## 3) Deploy to live site

```bash
python3 scripts/deploy_infinityfree.py
```

## 4) Verify deployment

```bash
curl -I https://mysticalg.kesug.com
```

If your domain is an addon domain mapped in another directory, set:

```bash
export FTP_TARGET_DIR='mysticalg.kesug.com/htdocs'
```

Then run deployment again.
