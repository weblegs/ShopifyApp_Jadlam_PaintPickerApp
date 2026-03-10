import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { classifyHexFull, getColorFromTitle } from "../utils/colorUtils";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const records = await prisma.productMeta.findMany({
    where: { shop, metafield_name: "PaintHexacode" },
    orderBy: { product_title: "asc" },
  });

  const products = records.map((p) => {
    const { primary, secondary } = classifyHexFull(p.metafield_value);
    const titleColor = getColorFromTitle(p.product_title);
    if (titleColor && !primary.map(c => c.toLowerCase()).includes(titleColor.toLowerCase())) {
      primary.push(titleColor);
    }
    return {
      id: p.id,
      title: p.product_title,
      hex: p.metafield_value,
      primaryColors: primary.join(", "),
      secondaryColors: secondary.join(", "),
    };
  });

  return { products };
};

export default function ColorGroup() {
  const { products } = useLoaderData();

  return (
    <s-page heading="All Products - Color Classification" fullWidth>
      <s-section heading={`Primary and Secondary Colors (${products.length} products)`}>
        {products.length === 0 ? (
          <s-paragraph>No products found. Go to the Home page and run Step 1 first.</s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f6f6f7" }}>
                  <th style={th}>Product Title</th>
                  <th style={th}>Hex Value</th>
                  <th style={th}>Color</th>
                  <th style={th}>Primary Colors</th>
                  <th style={th}>Secondary Colors</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={td}>{p.title}</td>
                    <td style={td}>{p.hex}</td>
                    <td style={td}>
                      <div style={{ width: 40, height: 24, backgroundColor: p.hex, border: "1px solid #ddd", borderRadius: 4 }} />
                    </td>
                    <td style={td}>{p.primaryColors || <span style={{ color: "#999" }}>-</span>}</td>
                    <td style={td}>{p.secondaryColors || <span style={{ color: "#999" }}>-</span>}</td>
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
