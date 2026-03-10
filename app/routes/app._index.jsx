import { useState, useCallback } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { classifyProduct } from "../utils/colorUtils";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const products = await prisma.productMeta.findMany({
    where: { shop, metafield_name: "PaintHexacode" },
    orderBy: { product_title: "asc" },
  });
  return { products };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  // STEP 1: Sync products from Shopify -> ProductMeta
  if (intent === "sync") {
    let cursor = null;
    let hasNextPage = true;
    let created = 0;
    let updated = 0;
    while (hasNextPage) {
      const response = await admin.graphql(
        `query ($cursor: String) {
          products(first: 250, after: $cursor) {
            edges { node { id title metafields(first: 20) { edges { node { key value namespace } } } } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { variables: { cursor } }
      );
      const { data } = await response.json();
      if (!data?.products) break;
      for (const { node: product } of data.products.edges) {
        const productId = product.id.split("/").pop();
        const metafields = product.metafields.edges.map((e) => e.node);
        const paintHexacode = metafields.find((m) => m.key === "PaintHexacode");
        if (!paintHexacode) continue;
        const colourGroup = metafields.find((m) => m.key === "ColourGroup");
        const existing = await prisma.productMeta.findUnique({
          where: { product_id_shop: { product_id: productId, shop } },
        });
        if (existing) {
          await prisma.productMeta.update({
            where: { product_id_shop: { product_id: productId, shop } },
            data: { product_title: product.title, metafield_value: paintHexacode.value, colourgroup: colourGroup?.value || "" },
          });
          updated++;
        } else {
          await prisma.productMeta.create({
            data: { product_id: productId, product_title: product.title, metafield_name: "PaintHexacode", metafield_value: paintHexacode.value, colourgroup: colourGroup?.value || "", shop },
          });
          created++;
        }
      }
      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    }
    return { success: true, intent, message: `Sync complete. Created: ${created}, Updated: ${updated}.` };
  }

  // STEP 2: Classify colors -> HexCodeProduct
  if (intent === "save") {
    const products = await prisma.productMeta.findMany({ where: { shop, metafield_name: "PaintHexacode" } });
    let saved = 0;
    for (const p of products) {
      const groupName = classifyProduct({ product_title: p.product_title, metafield_value: p.metafield_value, colourgroup: p.colourgroup });
      if (!groupName) continue;
      const existing = await prisma.hexCodeProduct.findUnique({ where: { product_id_shop: { product_id: p.product_id, shop } } });
      if (existing) {
        await prisma.hexCodeProduct.update({ where: { product_id_shop: { product_id: p.product_id, shop } }, data: { hex_color: p.metafield_value, group_name: groupName } });
      } else {
        await prisma.hexCodeProduct.create({ data: { product_id: p.product_id, hex_color: p.metafield_value, group_name: groupName, shop } });
      }
      saved++;
    }
    return { success: true, intent, message: `Color groups saved for ${saved} products.` };
  }

  // STEP 3: Push hexcolorgroup -> Shopify metafield
  if (intent === "updatemeta") {
    const hexProducts = await prisma.hexCodeProduct.findMany({ where: { shop } });
    let updated = 0;
    let errors = 0;
    for (const p of hexProducts) {
      if (!p.group_name) continue;
      const response = await admin.graphql(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        { variables: { input: { id: `gid://shopify/Product/${p.product_id}`, metafields: [{ namespace: "custom", key: "hexcolorgroup", value: p.group_name, type: "single_line_text_field" }] } } }
      );
      const { data } = await response.json();
      if (data?.productUpdate?.userErrors?.length > 0) { errors++; } else { updated++; }
    }
    return { success: true, intent, message: `Shopify metafields updated: ${updated}. Errors: ${errors}.` };
  }

  return { success: false, message: "Unknown action." };
};

export default function Index() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();
  const [bannerMsg, setBannerMsg] = useState(null);
  const [bannerOk, setBannerOk] = useState(true);
  const isLoading = fetcher.state !== "idle";
  const currentIntent = fetcher.formData?.get("intent");

  if (fetcher.state === "idle" && fetcher.data?.message && fetcher.data.message !== bannerMsg) {
    setBannerMsg(fetcher.data.message);
    setBannerOk(fetcher.data.success);
  }

  const submit = useCallback((intent) => {
    setBannerMsg(null);
    fetcher.submit({ intent }, { method: "POST" });
  }, [fetcher]);

  return (
    <s-page heading="PaintHexacode Products">
      <s-section heading="Workflow Steps">
        <s-paragraph>
          Run these steps in order when the client adds new products to Shopify.
          Webhooks handle this automatically - use buttons only as backup.
        </s-paragraph>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <s-button variant="primary" onClick={() => submit("sync")}
            {...(isLoading && currentIntent === "sync" ? { loading: true } : {})}
            {...(isLoading ? { disabled: true } : {})}>
            Step 1 - Sync Products from Shopify
          </s-button>
          <s-button onClick={() => submit("save")}
            {...(isLoading && currentIntent === "save" ? { loading: true } : {})}
            {...(isLoading ? { disabled: true } : {})}>
            Step 2 - Save Color Groups
          </s-button>
          <s-button variant="primary" onClick={() => submit("updatemeta")}
            {...(isLoading && currentIntent === "updatemeta" ? { loading: true } : {})}
            {...(isLoading ? { disabled: true } : {})}>
            Step 3 - Update Shopify Metafields
          </s-button>
        </div>
        {isLoading && <p style={{ marginTop: "12px", color: "#555" }}>Processing... please wait.</p>}
        {bannerMsg && (
          <div style={{ marginTop: "12px", padding: "12px 16px", borderRadius: "6px",
            backgroundColor: bannerOk ? "#d4edda" : "#f8d7da",
            color: bannerOk ? "#155724" : "#721c24",
            border: "1px solid " + (bannerOk ? "#c3e6cb" : "#f5c6cb") }}>
            {bannerMsg}
          </div>
        )}
      </s-section>

      <s-section heading={`HexCode Products (${products.length})`}>
        {products.length === 0 ? (
          <s-paragraph>No products found. Run Step 1 to sync products from Shopify.</s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f6f6f7" }}>
                  <th style={th}>#</th>
                  <th style={th}>Product Title</th>
                  <th style={th}>Hex Color</th>
                  <th style={th}>Hex Value</th>
                  <th style={th}>Colour Group</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{p.product_title}</td>
                    <td style={td}>
                      <div style={{ width: 40, height: 24, backgroundColor: p.metafield_value, border: "1px solid #ddd", borderRadius: 4 }} />
                    </td>
                    <td style={td}>{p.metafield_value}</td>
                    <td style={td}>{p.colourgroup || <span style={{ color: "#999" }}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

const th = { padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e1e3e5", fontWeight: 600 };
const td = { padding: "10px 12px", borderBottom: "1px solid #e1e3e5", verticalAlign: "middle" };

export const headers = (headersArgs) => boundary.headers(headersArgs);
