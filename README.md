# CJ Kalijati Warehouse Operations Dashboard

A Google Apps Script Web App that reads pivot data from a Google Spreadsheet and renders a real-time warehouse operations dashboard: KPI cards, six Chart.js visualizations, a paginated outbound deliveries table with CSV export, dark/light mode, and bilingual UI (English / Bahasa Indonesia).

- **App version:** `v0.1.0-beta1` (see `CONFIG.APP_VERSION`)
- **Target sheet:** spreadsheet ID `1lI2vBqDWttzycGt_mpl0dEAHdvAkz2VREuKSIqPny0I`, tabs `PIVOT` + `OUTBOUND`
- **Default language:** `ID-ID` (Indonesian), switchable to `EN-US`

---

## Architecture

### Server (Google Apps Script `.gs` files)

| File | Responsibility |
|---|---|
| `Code.gs` | Web App entry point. `doGet()` serves the `index` template; `include()` resolves HTML partials; `getDashboardData()` is the client RPC endpoint; `clearDashboardCache()` purges the script cache. |
| `Config.gs` | Central constants: `SPREADSHEET_ID`, `SHEETS` map, `CACHE_DURATION_SEC` (300), `CACHE_KEY_DASHBOARD`, `APP_TITLE`, `APP_VERSION`. |
| `DataService.gs` | Reads the PIVOT sheet, maps headers (including duplicate-header disambiguation via occurrence index), builds 4 data tables + zone aggregation, deduplicates outbound delivery orders from the OUTBOUND tab, and returns the full dashboard payload. |
| `Utilities.gs` | Server helpers: `formatDateISO()` (normalizes dates to `YYYY-MM-DD`) and `parseNumber()` (NaN-safe numeric coercion). |

### Client (`index.html` + 11 partials loaded via `<?!= include('...'); ?>`)

**View partials**

| File | Contents |
|---|---|
| `index.html` | Shell: loader overlay with progress bar, filter bar (start/end date + location dropdown), four tab views, floating bottom navigation, footer. |
| `header.html` | Branding, version badge, last-updated timestamp, EN/ID language toggle, dark-mode switch, auto-refresh checkbox, refresh button. |
| `kpi-cards.html` | Five KPI cards (inbound containers, SKUs handled, outbound deliveries, requests, active locations). |
| `charts-section.html` | Six chart canvases (containers by zone, SKUs by zone, outbound over time, inbound SKUs over time, requests multi-line, zone distribution donut). |
| `tables-section.html` | Master Outbound Deliveries table with pagination controls and Export CSV button. |

**Script modules** (loaded in this exact order — lexical `const` dependencies require it):

| Order | File | Global object | Purpose |
|---|---|---|---|
| 1 | `js-i18n.html` | `I18n` | EN-US / ID-ID dictionaries, `t(key)`, `setLanguage()` DOM translation pass. |
| 2 | `js-utils.html` | `Utils` | Loader show/hide, progress bar, `formatNumber()`, `debounce()`. |
| 3 | `js-api.html` | `API` | Promise wrapper around `google.script.run.getDashboardData()`. |
| 4 | `js-filters.html` | `Filters` | Date-range + location filtering, dynamic KPI recomputation, dropdown population. |
| 5 | `js-charts.html` | `Charts` | Chart.js creation/update/destroy, theme-aware defaults. |
| 6 | `js-tables.html` | `Tables` | Paginated row rendering (10/page), prev/next navigation, CSV export. |
| 7 | `js-app.html` | `App` | Orchestrator: boot/init, theme & language toggles, refresh pipeline, tab navigation, 5-minute auto-refresh timer. |

### Data flow

```
Browser load
  └─ App.init()
       ├─ I18n.setLanguage() → translate all [data-i18n] elements
       ├─ Filters.init()     → wire date/location inputs (debounced)
       ├─ App.setupAutoRefresh()
       └─ App.refreshData()
            └─ API.fetchDashboardData()
                 └─ google.script.run → Code.gs getDashboardData()
                      └─ DataService.gs fetchDashboardData()
                           ├─ Read PIVOT tab (headers + rows → 4 tables + zoneSummary)
                           ├─ Read OUTBOUND tab (deduped delivery orders)
                           └─ Return payload { appVersion, kpis, table1Location,
                               zoneSummary, table2Inbound, table3Outbound,
                               table4Request, outboundDetails, lastUpdated }
            └─ App.applyFilters()
                 ├─ Filters.filterData(rawData)  → filtered subset + dynamic KPIs
                 ├─ Update 5 KPI cards
                 ├─ Tables.renderOutboundTable(filtered.outboundDetails)
                 └─ Charts.renderAll(filtered)
```

### Payload schema (server → client)

```json
{
  "appVersion": "v0.1.0-beta1",
  "kpis": {
    "totalInboundContainers": 0,
    "totalSkusHandled": 0,
    "totalOutboundDeliveries": 0,
    "totalRequests": 0,
    "activeLocationsCount": 0
  },
  "table1Location": [{ "location": "A1-01", "containers": 0, "skus": 0 }],
  "zoneSummary":    [{ "location": "Zone A", "containers": 0, "skus": 0 }],
  "table2Inbound":  [{ "date": "YYYY-MM-DD", "container": "...", "skus": 0 }],
  "table3Outbound": [{ "date": "YYYY-MM-DD", "deliveries": 0 }],
  "table4Request":  [{ "date": "YYYY-MM-DD", "containers": 0, "skus": 0 }],
  "outboundDetails":[{ "date": "YYYY-MM-DD", "deliveryOrder": "...", "truckNumber": "...", "status": "Delivered" }],
  "lastUpdated": "ISO-8601 timestamp"
}
```

### PIVOT sheet expectations

Row 1 must contain headers (case-insensitive, whitespace-trimmed). Duplicate titles are resolved by occurrence order:

| Table | Columns matched |
|---|---|
| T1 – Location | `location`, `countunique of container` (1st), `countunique of sku` (1st) |
| T2 – Inbound | `date` (1st), `container`, `countunique of sku` (2nd) |
| T3 – Outbound | `date` (2nd), `countunique of delivery order` |
| T4 – Requests | `request date`, `countunique of container` (2nd), `countunique of sku` (3rd) |

Locations are bucketed into zones by prefix letter (A–F → `Zone A..F`); anything else falls to `Staging` or `Other`. The OUTBOUND tab is read as: col B = date, col E = delivery order (dedupe key), col F = truck number.

---

## Deployment

1. Open (or create) the target Google Spreadsheet containing `PIVOT` and `OUTBOUND` tabs.
2. **Extensions → Apps Script**, create one script file per `.gs` module (`Code`, `Config`, `DataService`, `Utilities`) and paste the matching contents.
3. Create one HTML file per partial using exactly these names (no `.html` suffix in the editor): `index`, `header`, `kpi-cards`, `charts-section`, `tables-section`, `js-i18n`, `js-utils`, `js-api`, `js-filters`, `js-charts`, `js-tables`, `js-app`.
4. Verify `Config.gs` values match your environment: `SPREADSHEET_ID`, `SHEETS.PIVOT`, `SHEETS.OUTBOUND`.
5. **Deploy → New deployment → Web app**: execute *as me*, access *anyone* (or restrict as needed). Authorize scopes when prompted.
6. Visit the Web App URL. Optional: bind `clearDashboardCache()` to a time-based trigger if you enable server-side caching.

## Local development notes

- The `.gs` files use Apps Script globals (`SpreadsheetApp`, `CacheService`, `HtmlService`); they cannot run in plain Node without mocks. The HTML partials can be smoke-tested with jsdom plus stubbed `Chart`/`google.script.run`.
- If you use `clasp`: `clasp push` after editing; `clasp open` to jump to the editor.

## Known limitations & TODO

- **Caching not wired:** `CONFIG.CACHE_KEY_DASHBOARD` / `CACHE_DURATION_SEC` and `clearDashboardCache()` exist, but nothing writes to `CacheService` yet. To enable, cache `JSON.stringify(payload)` in `getDashboardData()` (mind the ~9 KB per-key limit — chunk or cache raw values instead).
- **KPI semantics:** `totalInboundContainers` counts inbound *rows*, not distinct container numbers.
- **Zone charts ignore the location filter** (by design — they render `zoneSummary`, which is passed through unfiltered); date-range filters do apply to trend charts and the outbound table.
- **No persistence of user preferences:** theme and language reset on reload (no `localStorage`).
- **Title strings differ across the stack:** browser tab uses `CONFIG.APP_TITLE` ("CJ Logistics Operations Dashboard"), while the header shows the i18n string ("CJ Kalijati Warehouse Dashboard" / "Dashboard CJ Logistik"). Pick one source of truth if consistency matters.
- `CONFIG.SHEETS.INBOUND`, `REQUEST`, and `PL_IMPORT` are defined but currently unused (everything is served from `PIVOT` + `OUTBOUND`).
- Minor typo in ID-ID dictionary: `chartLocDist` says "Distribus" (should be "Distribusi").
- `refreshData(force)` accepts but ignores its `force` flag until server-side caching lands.

## Project layout

```
.
├── Code.gs              # Web App entry point & RPC endpoint
├── Config.gs            # Centralized configuration
├── DataService.gs       # Spreadsheet parsing & payload builder
├── Utilities.gs         # formatDateISO / parseNumber helpers
├── index.html           # Main template (loader, filters, views, nav)
├── header.html          # Top bar partial
├── kpi-cards.html       # KPI grid partial
├── charts-section.html  # Chart canvas grid partial
├── tables-section.html  # Outbound table + pagination partial
├── js-i18n.html         # I18n dictionaries (EN-US / ID-ID)
├── js-utils.html        # Utils (loader, formatting, debounce)
├── js-api.html          # API (google.script.run Promise wrapper)
├── js-filters.html      # Filters (date/location slicing, dynamic KPIs)
├── js-charts.html       # Charts (Chart.js lifecycle)
├── js-tables.html       # Tables (pagination, CSV export)
└── js-app.html          # App (orchestrator, boots on DOMContentLoaded)
```

## License

See `LICENSE`.
