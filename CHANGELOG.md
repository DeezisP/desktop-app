# Changelog

## v2.18.0 — 2026-06-15

### Features

- **User management screen.** New "ผู้ใช้งาน" entry under sidebar section "ผู้ดูแลระบบ" at `/users`.
  - Lists all registered users with name, email, ID, and role badge.
  - Search/filter by name, email, or username.
  - Sort by ID ascending/descending.
  - Delete user with a two-step confirm (prevents accidental removal).
  - "ออเดอร์" button opens a right-side drawer showing all orders for that user with status, total, items, and shipping address.
- **Backend:** Added `DELETE /user/admin/{userId}` and `GET /user/admin/{userId}/orders` endpoints (admin-only, Spring Security protected).

## v2.15.0 — 2026-06-12

### Maintenance

- **Analytics system permanently removed.** The analytics dashboard (Overview, Realtime, Visitors, Sources, Geography, Devices, Events, Revenue, System Health) has been removed from the desktop app.
- Removed `recharts` chart library — reduces bundle size by ~240 kB gzipped.
- Removed 9 analytics screen components and `analyticsApi` module.
- Removed 9 Analytics entries from the sidebar navigation.
- Reduced backend API load: no more analytics polling or realtime WebSocket subscriptions.
- General code cleanup and dead-import removal.

## v2.13.0 — 2026-06-12

### Maintenance

- **Analytics system removed.** The website analytics dashboard (Overview, Traffic, Pages, Devices, Geo, Realtime, Search, Health, Insights) has been removed from the app.
- Removed analytics summary widgets from the main Dashboard screen.
- Removed `recharts` chart library — reduces bundle size.
- Reduced backend API load: no more periodic analytics polling from the desktop client.
- General code cleanup and maintainability improvements.

## v2.12.0 and earlier

See git history.
