import prisma from "../db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Handle CORS preflight
export const loader = async ({ request }) => {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  const body = await request.json();
  const { variables = {} } = body;
  const { first = 100, after = null, searchTerm = "" } = variables;

  // Decode cursor to get the last seen ID
  let afterId = 0;
  if (after) {
    try {
      afterId = parseInt(Buffer.from(after, "base64").toString("utf8"), 10);
    } catch (e) {
      afterId = 0;
    }
  }

  // Build search filter
  const searchFilter = searchTerm
    ? {
        OR: [
          { product_title: { contains: searchTerm, mode: "insensitive" } },
          { paint_number: { contains: searchTerm, mode: "insensitive" } },
          { paint_colour: { contains: searchTerm, mode: "insensitive" } },
          { sku: { contains: searchTerm, mode: "insensitive" } },
        ],
      }
    : {};

  const where = afterId > 0
    ? { ...searchFilter, id: { gt: afterId } }
    : searchFilter;

  // Fetch first+1 to detect if there's a next page
  const products = await prisma.searchProduct.findMany({
    where,
    take: first + 1,
    orderBy: { id: "asc" },
  });

  const hasNextPage = products.length > first;
  const nodes = hasNextPage ? products.slice(0, first) : products;
  const lastNode = nodes[nodes.length - 1];
  const endCursor = lastNode
    ? Buffer.from(lastNode.id.toString()).toString("base64")
    : null;

  const edges = nodes.map((p) => ({
    node: {
      id: p.id.toString(),
      product_id: p.product_id,
      product_title: p.product_title,
      price: p.price,
      paint_hexa_code: p.paint_hexa_code,
      paint_number: p.paint_number,
      paint_container: p.paint_container,
      paint_type: p.paint_type,
      paint_range: p.paint_range,
      paint_colour: p.paint_colour,
      handle: p.handle,
      inventory_quantity: p.inventory_quantity,
      variant_id: p.variant_id,
      vendor: p.vendor,
      sku: p.sku,
    },
  }));

  return new Response(
    JSON.stringify({
      data: {
        SearchProducts: {
          edges,
          pageInfo: { endCursor, hasNextPage },
        },
      },
    }),
    { status: 200, headers: CORS_HEADERS }
  );
};
