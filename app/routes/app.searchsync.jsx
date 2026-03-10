import { useState, useCallback } from "react";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const count = await prisma.searchProduct.count({ where: { shop } });
  return { count };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let cursor = null;
  let hasNextPage = true;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  while (hasNextPage) {
    const response = await admin.graphql(
      `query ($cursor: String) {
        products(first: 250, after: $cursor) {
          edges {
            node {
              id
              title
              handle
              vendor
              variants(first: 1) {
                edges {
                  node {
                    price
                    compareAtPrice
                    inventoryQuantity
                    legacyResourceId
                    sku
                  }
                }
              }
              metafields(first: 20) {
                edges { node { key value namespace } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { variables: { cursor } }
    );

    const { data } = await response.json();
    if (!data?.products) break;

    for (const { node: product } of data.products.edges) {
      const productId = product.id.split("/").pop();
      const mfs = product.metafields.edges.map((e) => e.node);

      const paintHexacode = mfs.find((m) => m.key === "PaintHexacode");
      if (!paintHexacode) { skipped++; continue; }

      const variant = product.variants.edges[0]?.node;
      const newData = {
        product_title:      product.title,
        handle:             product.handle,
        vendor:             product.vendor,
        variant_id:         variant?.legacyResourceId || "",
        sku:                variant?.sku || "",
        price:              variant?.price || "",
        compare_at_price:   variant?.compareAtPrice || "",
        inventory_quantity: variant?.inventoryQuantity || 0,
        paint_hexa_code:    paintHexacode.value,
        paint_colour:       mfs.find((m) => m.key === "PaintColour")?.value || "",
        paint_type:         mfs.find((m) => m.key === "PAINTTYPE")?.value || "",
        paint_container:    mfs.find((m) => m.key === "PaintContainer")?.value || "",
        paint_number:       mfs.find((m) => m.key === "PaintNumber")?.value || "",
        paint_range:        mfs.find((m) => m.key === "PaintRange")?.value || "",
      };

      const existing = await prisma.searchProduct.findUnique({
        where: { product_id_shop: { product_id: productId, shop } },
      });

      if (existing) {
        // Only update if something changed
        const changed =
          existing.product_title      !== newData.product_title ||
          existing.paint_hexa_code    !== newData.paint_hexa_code ||
          existing.paint_colour       !== newData.paint_colour ||
          existing.paint_type         !== newData.paint_type ||
          existing.paint_container    !== newData.paint_container ||
          existing.paint_number       !== newData.paint_number ||
          existing.paint_range        !== newData.paint_range ||
          existing.price              !== newData.price ||
          existing.compare_at_price   !== newData.compare_at_price ||
          existing.inventory_quantity !== newData.inventory_quantity ||
          existing.variant_id         !== newData.variant_id ||
          existing.vendor             !== newData.vendor ||
          existing.sku                !== newData.sku ||
          existing.handle             !== newData.handle;

        if (changed) {
          await prisma.searchProduct.update({
            where: { product_id_shop: { product_id: productId, shop } },
            data: newData,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.searchProduct.create({
          data: { product_id: productId, shop, ...newData },
        });
        created++;
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;

    // 500ms delay per page to keep server load low
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    success: true,
    message: `Search products synced. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}.`,
  };
};

export default function SearchSync() {
  const fetcher = useFetcher();
  const isLoading = fetcher.state !== "idle";

  return (
    <s-page heading="Search Products Sync">
      <s-section heading="Sync Search Product Data">
        <s-paragraph>
          Syncs all paint products into the SearchProduct table including price, SKU,
          paint type, container, range and colour metafields. Only updates records
          that have changed — safe to run multiple times.
        </s-paragraph>
        <div style={{ marginTop: "12px" }}>
          <s-button
            variant="primary"
            onClick={() => fetcher.submit({}, { method: "POST" })}
            {...(isLoading ? { loading: true, disabled: true } : {})}
          >
            Sync Search Products
          </s-button>
        </div>
        {isLoading && (
          <p style={{ marginTop: "12px", color: "#555" }}>
            Processing... this may take 10-15 minutes. You can leave this page.
          </p>
        )}
        {fetcher.state === "idle" && fetcher.data?.message && (
          <div style={{
            marginTop: "12px", padding: "12px 16px", borderRadius: "6px",
            backgroundColor: fetcher.data.success ? "#d4edda" : "#f8d7da",
            color: fetcher.data.success ? "#155724" : "#721c24",
            border: "1px solid " + (fetcher.data.success ? "#c3e6cb" : "#f5c6cb"),
          }}>
            {fetcher.data.message}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
