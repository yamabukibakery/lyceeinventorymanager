# Deploy To Railway

This app is ready to deploy on Railway without a custom domain.

## What Railway should use

- Start command: `npm start`
- Healthcheck path: `/api/health`
- Persistent volume mount path: `/app/data`

Those settings are already defined in [railway.json](./railway.json).

## Dashboard deploy steps

1. Push the latest repo changes to GitHub.
2. In Railway, create a new project.
3. Choose `Deploy from GitHub repo` and select this repository.
4. Open the deployed service settings and confirm:
   - Healthcheck path is `/api/health`
   - Start command is `npm start`
5. Add a Volume and mount it to `/app/data`.
6. In the service `Networking` tab, click `Generate Domain`.
   - Railway will give you a public `*.up.railway.app` URL, so you do not need your own domain.
7. Open the generated domain and verify `/api/health` returns JSON.
8. Use the app normally and trigger card sync from the UI.

## Optional variables

The app works with Railway's injected `PORT` automatically.

You usually do not need any variables, but these are supported:

- `DATA_DIR=/app/data`
- `PORT=8000`

`DATA_DIR` is optional because the app defaults to `/app/data` on Railway through the repo layout and volume mount.

## Notes

- Inventory counts are still stored in browser `localStorage`, so they are per-browser/per-device.
- Card cache is stored on the Railway volume, so sync results survive redeploys.
- If you redeploy while a volume is attached, Railway documents that there can still be a small amount of downtime during the swap.
