# Azure App Service deployment (unified container)

This repo ships a **single Docker image** (`Dockerfile` at the repo root) that runs:

1. **FastAPI** on `127.0.0.1:8000` (internal)
2. **Next.js** (standalone) on `PORT` (Azure sets this, usually `8080`)

The browser talks to **one HTTPS URL**. Next.js rewrites `/api/*` to the internal API (`next.config.ts`), so you usually **do not** need `NEXT_PUBLIC_API_URL` for same-origin requests.

---

## What you need in Azure (once)

| Resource | Purpose |
|----------|---------|
| **Resource group** | Holds everything |
| **Azure Container Registry (ACR)** | Stores `testing-agent` images |
| **Azure Database for PostgreSQL (Flexible Server)** | Production database |
| **App Service Plan** (Linux) | Compute for the Web App |
| **Web App for Containers** | Runs the image from ACR |
| **Service principal** | Lets GitHub Actions push to ACR and deploy the Web App |

---

## 1. Create PostgreSQL

Create a Flexible Server and a database (e.g. `testing_agent`). Note:

- Server FQDN, admin user, password
- Allow **Azure services** (or the Web App outbound IPs) to connect

Build connection strings (match `server/.env.example` format):

- `DATABASE_URL` — `postgresql+asyncpg://USER:PASSWORD@HOST:5432/testing_agent`
- `DATABASE_URL_SYNC` — `postgresql+psycopg2://USER:PASSWORD@HOST:5432/testing_agent`

---

## 2. Create ACR

```bash
az acr create --resource-group YOUR_RG --name YOUR_ACR_NAME --sku Basic --admin-enabled true
```

Note:

- **Login server**: `YOUR_ACR_NAME.azurecr.io`
- **Admin user / password** (Portal → ACR → Access keys), or use a service principal with `AcrPush`

---

## 3. Create App Service Plan + Web App (Linux container)

- **OS**: Linux  
- **Publish**: Docker Container  
- **Image**: point to ACR and any tag for first boot (e.g. `testing-agent:latest` after first CI run), or use a public placeholder until the first GitHub deploy completes

**Application settings** (Configuration → Application settings) — set at least:

| Name | Example / notes |
|------|-------------------|
| `DATABASE_URL` | Async Postgres URL |
| `DATABASE_URL_SYNC` | Sync Postgres URL |
| `SECRET_KEY` | Random string (`openssl rand -hex 32`) |
| `MASTER_API_KEY` | Random string for API key auth |
| `OPENAI_API_KEY` | Or `ANTHROPIC_API_KEY` if using Anthropic |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `GENERATION_MODEL`, `EVALUATION_MODEL`, `UTTERANCE_MODEL` | As in `.env.example` |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `CORS_ORIGINS` | `https://YOUR_WEBAPP_NAME.azurewebsites.net` (comma-separated if multiple) |

Optional:

- `WEBSITES_PORT` — only if Azure does not route correctly; the container listens on `PORT` (see `start.sh`).

Do **not** commit secrets; set them only in Azure (or Key Vault references).

---

## 4. Service principal for GitHub Actions

Create an app registration / service principal with permission to:

- Push images to ACR (`AcrPush` on the registry **or** use ACR admin + store user/pass in secrets — less ideal)
- Deploy to the Web App (`Contributor` on the resource group or scoped roles)

Example (adjust names):

```bash
az ad sp create-for-rbac --name "github-testing-agent" \
  --role contributor \
  --scopes /subscriptions/SUBSCRIPTION_ID/resourceGroups/YOUR_RG \
  --sdk-auth
```

Copy the JSON output → GitHub secret **`AZURE_CREDENTIALS`**.

Grant the same principal **`AcrPush`** on the registry if builds fail to push:

```bash
az role assignment create \
  --assignee PRINCIPAL_ID \
  --role AcrPush \
  --scope /subscriptions/SUBSCRIPTION_ID/resourceGroups/YOUR_RG/providers/Microsoft.ContainerRegistry/registries/YOUR_ACR_NAME
```

---

## 5. GitHub repository secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Output of `az ad sp create-for-rbac --sdk-auth` |
| `AZURE_RESOURCE_GROUP` | Resource group name |
| `AZURE_WEBAPP_NAME` | Web App name (not the full URL) |
| `ACR_NAME` | Short ACR name (for `az acr login --name`) |
| `ACR_LOGIN_SERVER` | e.g. `myregistry.azurecr.io` |
| `ACR_USERNAME` | ACR admin username or SP client ID (if using token auth to registry) |
| `ACR_PASSWORD` | ACR admin password or SP password |

**Note:** If `az acr login` uses the service principal from `azure/login`, ACR push often works without admin user — you may still need `ACR_USERNAME` / `ACR_PASSWORD` for `az webapp config container set` unless you switch the Web App to **managed identity** pulling from ACR (advanced). Easiest path: enable ACR admin and use admin credentials for the deploy step only.

---

## 6. Deploy

- Push to **`main`** → workflow **Deploy to Azure App Service** runs, or run it manually via **Actions → Run workflow**.
- After success, open: `https://YOUR_WEBAPP_NAME.azurewebsites.net`

---

## Frontend URL

The **Web App’s default hostname** is where the UI is served. No separate “frontend App Service” is required when using the unified `Dockerfile`.

If you later split API and client into two images, set `NEXT_PUBLIC_API_URL` on the client build to the API’s public URL and adjust CORS.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Container exits | Log stream in Portal; DB firewall; env vars missing |
| 502 / timeout | App Service logs; ensure the process listens on `PORT` (`start.sh` uses `PORT` for Next.js) |
| API 401 / CORS | `CORS_ORIGINS` includes the site URL; cookies/localStorage on same origin |
| Migration errors | DB reachable from App Service; `DATABASE_URL_*` correct |

---

## Parallel Railway

You can keep Railway connected to the same GitHub repo for a second environment. Treat **Azure** as the mandated production URL; keep Railway secrets separate from Azure.
