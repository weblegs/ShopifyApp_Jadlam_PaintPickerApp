# Weblegs Hex PaintPicker — App Overview

## What Does This App Do?

**Weblegs Hex PaintPicker** is a Shopify embedded app that manages paint product colour data for Jadlam. It reads the hex colour code stored on each paint product, classifies it into a named colour group (e.g. Red, Blue, Grey), writes that classification back to the product as a Shopify metafield, and maintains a full searchable product index. The storefront uses this data to power colour filtering and paint search.

### Core Workflow
1. Merchant syncs all paint products from Shopify — the app pulls each product's hex code metafield into the database
2. The app classifies each hex code into a named colour group using RGB range matching
3. The classified colour group is pushed back to Shopify as a custom metafield (`custom.hexcolorgroup`)
4. A separate Search Sync builds a full product index including all paint-specific metafields (colour, type, container, number, range)
5. New or updated products trigger webhooks that automatically re-classify and update the metafield in real time

---

## App Pages

### 1. HexCode Products (Main Page)
Three-step sync process run from a single page:

| Step | Action |
|------|--------|
| Step 1 — Sync Products | Fetches all paint products from Shopify and saves their hex code metafields to the database |
| Step 2 — Save Colour Groups | Classifies each hex code into a named colour group and stores the result |
| Step 3 — Update Shopify | Pushes the classified colour group back to Shopify as a product metafield |

- Table showing all synced products: title, hex colour swatch, hex value, assigned colour group

### 2. Colour Groups
- Shows a breakdown of every product with its hex code, colour swatch, and the primary/secondary colour classification
- Useful for reviewing how the classification logic has interpreted each colour

### 3. Search Sync
- Syncs all paint products into a separate searchable product index
- Captures: title, SKU, price, compare-at price, inventory, vendor, and all paint metafields (colour, type, container, number, range)
- Only indexes products that have a `PaintHexacode` metafield set
- Takes 10–15 minutes to complete due to full product catalogue pagination

---

## Colour Classification Logic

The app classifies hex codes by converting them to RGB and matching against defined colour ranges.

**18 Primary Colour Groups:** Red, Crimson, Blue, Yellow, Gold, Lime, Green, Orange, Brown, OliveBrown, Grey, Silver, Black, White, Olive, Copper, Rust, Lavender

**Priority order for assigning a group:**
1. Stored `ColourGroup` metafield on the product (if set)
2. Colour name extracted from the product title
3. Hex code RGB classification

---

## Public API Endpoint

This endpoint is called by the Shopify storefront for paint search — no authentication required.

| Endpoint | Method | What It Does |
|---------|--------|-------------|
| `/api/search-products` | `POST` | Returns paginated, searchable paint products in GraphQL-compatible JSON format |

**Search fields:** product title, paint number, paint colour, SKU

**Pagination:** cursor-based — pass `after` cursor and `first` count in the request body

---

## Webhooks

| Webhook | What It Does |
|---------|-------------|
| `products/create` | Auto-classifies the new product's hex code and updates the Shopify metafield |
| `products/update` | Re-classifies and updates the metafield if the colour group has changed |
| `app/uninstalled` | Deletes all session data for the shop |
| `app/scopes_update` | Updates stored session scopes |

---

## Tech Stack (For Developers)

| Component | Technology |
|----------|-----------|
| Framework | React Router v7 (Node.js) |
| Shopify Integration | Shopify Admin GraphQL API |
| Database | PostgreSQL (hosted on Railway) |
| ORM | Prisma |
| UI | Shopify Polaris Web Components |
| Build Tool | Vite |

---

## Database Tables

| Table | What It Stores |
|-------|---------------|
| Session | Shopify OAuth tokens |
| ProductMeta | Product ID, title, hex code metafield, colour group, shop |
| HexCodeProduct | Classified colour group per product (product ID, hex, group name, shop) |
| SearchProduct | Full paint product index — SKU, price, inventory, all paint metafields |

---

## Key Files (For Developers)

```
app/
├── routes/
│   ├── app._index.jsx               — Main page: 3-step sync + product table
│   ├── app.colorgroup.jsx           — Colour group classification viewer
│   ├── app.searchsync.jsx           — Search product index sync
│   ├── app.jsx                      — App shell with nav
│   ├── api.search-products.jsx      — Public API: paginated paint product search
│   ├── webhooks.products.create.jsx — Auto-classify new products
│   ├── webhooks.products.update.jsx — Re-classify updated products
│   ├── auth.$.jsx                   — Shopify OAuth handler
│   └── webhooks.app.*              — Uninstall and scopes update handlers
├── utils/
│   └── colorUtils.js               — Hex-to-RGB classification logic
├── shopify.server.js               — Shopify app config and auth helpers
└── db.server.js                    — Prisma client
prisma/
└── schema.prisma                   — Database schema
```

---

## Shopify Permissions Required

| Permission | Reason |
|-----------|--------|
| `read_products` | Fetch all paint products and their metafields |
| `write_products` | Write classified colour group back as a product metafield |
| `read_metaobject_definitions` | Read custom metaobject definitions |
| `write_metaobject_definitions` | Create/update metaobject definitions |
| `read_metaobjects` | Read metaobject data |
| `write_metaobjects` | Write metaobject data |

---

## Hosting & Deployment

- **App URL:** `https://shopifyappjadlampaintpickerapp-production.up.railway.app`
- **Database:** PostgreSQL on Railway
- **Deploy:** Push to `main` branch on GitHub → Railway auto-deploys
- **Store:** `wljadlamracing.myshopify.com`
