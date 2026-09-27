# GROTEC FarmerOS — Environment Variable Inventory

This document details all configuration keys, defaults, and security requirements across environments (Development, Staging, and Production).

---

## 1. Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Default / Example | Description & Security Policy |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` / `development` | Node runtime environment mode. |
| `PORT` | No | `3000` | HTTP port on which Fastify listens. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/grotec?sslmode=require` | PostgreSQL connection string. Must be kept strictly secret. |
| `JWT_SECRET` | Yes | `[64-character-crypto-hex]` | Secret key used to sign and verify session tokens. |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry duration. |
| `CORS_ORIGINS` | Yes | `https://farmos.grotec.in,https://admin.grotec.in` | Comma-separated list of allowed origins. Strictly validated by CORS middleware. |
| `EXOTEL_ACCOUNT_SID`| Optional | `grotec_sid` | Exotel Account SID. Optional for Manual Calling mode. |
| `EXOTEL_API_KEY` | Optional | `grotec_key` | Exotel API Key. |
| `EXOTEL_API_TOKEN` | Optional | `grotec_token` | Exotel API Token. |
| `EXOTEL_CALLER_ID` | Optional | `08047192000` | Virtual Number / Caller ID used for cloud calling. |
| `WHATSAPP_API_KEY` | Optional | `waba_prod_secret` | Meta WhatsApp Business API Token. |
| `SMS_GATEWAY_URL` | Optional | `https://api.sms-gateway.in/v1/send` | DLT approved SMS gateway endpoint. |

---

## 2. Frontend Environment Variables (`frontend/.env`)

| Variable Name | Required | Default / Example | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | `https://api.farmos.grotec.in/api/v1` | Public API endpoint consumed by Axios client. |
| `VITE_APP_TITLE` | No | `GROTEC FarmerOS` | Browser page title prefix. |
| `VITE_ENABLE_ANALYTICS` | No | `true` | Enables client-side error telemetry. |

---

## 3. Production Secrets Management
- All production credentials must be injected via host environment variables or secure cloud secret stores (e.g. AWS Secrets Manager, Render Secrets, or Vault).
- No raw `.env` files with production passwords or database URLs should ever be committed to git repositories.
