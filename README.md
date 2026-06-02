# Perfect ELT Warehouse Desktop

Windows desktop application for warehouse operations, built with Electron + React + TypeScript.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 31 |
| UI | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | TailwindCSS 3 |
| State | Zustand |
| HTTP | Axios (JWT interceptor + auto-refresh) |
| WebSocket | STOMP via `@stomp/stompjs` + SockJS |
| Installer | electron-builder (NSIS) |
| CI/CD | GitHub Actions → `windows-latest` |

## Development (on VPS)

```bash
# Clone
git clone <your-repo-url> desktop-warehouse
cd desktop-warehouse

# Install
npm install

# Generate icons
npm run setup:icons

# Copy environment
cp .env.example .env
# Edit VITE_API_URL and VITE_WS_URL

# Start dev server (Vite only, no Electron on Linux VPS)
npx vite
```

## Build & Release

### Local (Windows machine)

```bash
npm run dist
# Produces: release/PerfectELTWarehouseSetup.exe
```

### CI/CD (GitHub Actions)

1. Push to `main` → builds installer → uploads as artifact
2. Push version tag → builds + creates GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions builds and releases PerfectELTWarehouseSetup.exe automatically
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Full versioned API base (`https://perfectelt.com/perfect/v1`) |
| `VITE_WS_URL` | WebSocket endpoint (`https://perfectelt.com/perfect/v1/ws`) |
| `VITE_STATION_ID` | Scanner station name shown in scan queue |

Set these as **GitHub Actions Secrets** (`Settings → Secrets and variables → Actions`).

## Security

- JWT access token encrypted via `electron.safeStorage` (OS keychain / DPAPI on Windows)
- Refresh token in HttpOnly cookie managed by server
- Context isolation enabled; `nodeIntegration: false`
- Auto-refresh on 401 with request retry queue

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | JWT authentication |
| Dashboard | `/` | Queue stats + quick actions |
| Scan & Pack | `/scan-pack` | Barcode scan → confirm packing |
| Product Lookup | `/product-lookup` | Search products + stock levels |
| Stock In | `/stock-in` | Increment stock with reason |
| Stock Out | `/stock-out` | Decrement stock with reason |
| Stock Count | `/stock-count` | Bulk physical count update |
| Order Packing | `/order-packing` | Order list + pack management |
| Order Import | `/order-import` | JSON paste import + history |
| Stock History | `/stock-history` | Product stock browser |

## STOMP Real-time Events

Subscribes to `/topic/admin/warehouse/queue`:

| Event | Payload |
|-------|---------|
| `SCANNED` | `{ entry: ScanQueueResponse }` |
| `CONFIRMED` | `{ entry: ScanQueueResponse }` |
| `CANCELLED` | `{ queueId: number }` |
| `HELD_UPDATED` | `{ held: HeldBarcodeResponse[] }` |
| `ITEM_ADDED` | `{ orderId, item }` |
