# Handoff and deployment checklist

## Required environment variables

### Render backend

- `GROQ_API_KEY`: create a key in the business owner's Groq account and store it as a secret in Render. Never put it in frontend variables or commit it.
- `FIREBASE_PROJECT_ID`: `asistente-uniformes` for the current Firebase project.
- `ALLOWED_ORIGINS`: comma-separated exact Netlify site URL and custom domain, for example `https://example.netlify.app,https://uniformes.example.com`.
- `PORT`: Render supplies this automatically; keep the app's default if running locally.

### Netlify frontend

- `VITE_API_URL`: the public URL of the Render backend, without `/api` at the end. The value is embedded into the static build, so trigger a new deploy after changing it.

## Before release

1. Give the business owner control of GitHub, Netlify, Render, Firebase/Google Cloud billing, and Groq. Do not share passwords; invite accounts or transfer ownership.
2. Set the owner-controlled Groq API key in Render and remove the old key after confirming the site works.
3. Set `VITE_API_URL` in Netlify and `ALLOWED_ORIGINS` in Render, then redeploy both services.
4. Confirm Firebase Authentication and Firestore/Storage rules are configured for the same project ID.
5. Review the Products page for legacy products with multiple sizes. Create one product per size and manually assign actual stock before new orders use those items.
6. Confirm the Render and Netlify plans and Firebase/Groq billing dashboards from the owner's accounts. This repository does not expose account-specific usage or invoices.

## Existing inventory migration

Older product records may contain multiple sizes but only one shared `stock` value. The app flags these records and prevents selecting them for new orders. It cannot safely distribute the old stock across sizes automatically. Create one new product record per size and enter verified counts; deactivate the old record after checking historical orders.
