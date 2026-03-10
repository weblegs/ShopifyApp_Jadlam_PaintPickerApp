import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { classifyProduct } from "../utils/colorUtils";

export const action = async ({ request }) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);
  console.log("Webhook received:", topic, shop);

  if (!admin) return new Response("Webhook processed", { status: 200 });

  try {
    const product = payload;
    const productId = product.id.toString();
    const title = product.title;

    // Find PaintHexacode metafield in the payload
    const metafields = product.metafields || [];
    const paintHexacode = metafields.find((m) => m.key === "PaintHexacode");
    const colourGroup = metafields.find((m) => m.key === "ColourGroup");

    // If no PaintHexacode in payload, fetch from Shopify
    let hexValue = paintHexacode?.value;

    if (!hexValue) {
      const response = await admin.graphql(
        `query ($id: ID!) {
          product(id: $id) {
            metafields(first: 20) {
              edges { node { key value } }
            }
          }
        }`,
        { variables: { id: `gid://shopify/Product/${productId}` } }
      );
      const { data } = await response.json();
      const mfs = data?.product?.metafields?.edges?.map((e) => e.node) || [];
      const found = mfs.find((m) => m.key === "PaintHexacode");
      hexValue = found?.value;
    }

    if (!hexValue) {
      console.log(`Product ${productId} has no PaintHexacode - skipping.`);
      return new Response("No PaintHexacode metafield", { status: 200 });
    }

    // STEP 1: Save/update ProductMeta
    const existing = await prisma.productMeta.findUnique({
      where: { product_id_shop: { product_id: productId, shop } },
    });
    if (existing) {
      await prisma.productMeta.update({
        where: { product_id_shop: { product_id: productId, shop } },
        data: { product_title: title, metafield_value: hexValue, colourgroup: colourGroup?.value || "" },
      });
    } else {
      await prisma.productMeta.create({
        data: { product_id: productId, product_title: title, metafield_name: "PaintHexacode", metafield_value: hexValue, colourgroup: colourGroup?.value || "", shop },
      });
    }

    // STEP 2: Classify color -> HexCodeProduct
    const groupName = classifyProduct({ product_title: title, metafield_value: hexValue, colourgroup: colourGroup?.value || "" });

    if (groupName) {
      const hexExisting = await prisma.hexCodeProduct.findUnique({
        where: { product_id_shop: { product_id: productId, shop } },
      });

      const previousGroupName = hexExisting?.group_name;

      if (hexExisting) {
        await prisma.hexCodeProduct.update({
          where: { product_id_shop: { product_id: productId, shop } },
          data: { hex_color: hexValue, group_name: groupName },
        });
      } else {
        await prisma.hexCodeProduct.create({
          data: { product_id: productId, hex_color: hexValue, group_name: groupName, shop },
        });
      }

      // Only push to Shopify if the group name actually changed — prevents webhook loop
      if (groupName !== previousGroupName) {
        await admin.graphql(
          `mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
          { variables: { input: { id: `gid://shopify/Product/${productId}`, metafields: [{ namespace: "custom", key: "hexcolorgroup", value: groupName, type: "single_line_text_field" }] } } }
        );
        console.log(`Auto-classified product ${productId} as ${groupName}`);
      } else {
        console.log(`Product ${productId} group unchanged (${groupName}) - skipping Shopify update.`);
      }
    }
    // STEP 3b: Update SearchProduct — only paint fields, no extra API call
    const searchExisting = await prisma.searchProduct.findUnique({
      where: { product_id_shop: { product_id: productId, shop } },
    });
    if (searchExisting) {
      const paintColour   = metafields.find((m) => m.key === "PaintColour")?.value   || searchExisting.paint_colour;
      const paintType     = metafields.find((m) => m.key === "PAINTTYPE")?.value     || searchExisting.paint_type;
      const paintContainer= metafields.find((m) => m.key === "PaintContainer")?.value|| searchExisting.paint_container;
      const paintNumber   = metafields.find((m) => m.key === "PaintNumber")?.value   || searchExisting.paint_number;
      const paintRange    = metafields.find((m) => m.key === "PaintRange")?.value    || searchExisting.paint_range;

      await prisma.searchProduct.update({
        where: { product_id_shop: { product_id: productId, shop } },
        data: { product_title: title, paint_hexa_code: hexValue, paint_colour: paintColour, paint_type: paintType, paint_container: paintContainer, paint_number: paintNumber, paint_range: paintRange },
      });
    }
    // Note: new products not in SearchProduct yet will be picked up by the manual sync

  } catch (err) {
    console.error("Webhook error:", err);
  }

  return new Response("Webhook processed", { status: 200 });
};
