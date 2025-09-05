import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

interface ShopifyPage {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const { pages, body, orginalPage } = await request.json();

    if (!pages || !Array.isArray(pages)) {
      return json({ error: "Pages array is required" }, { status: 400 });
    }

    const shop = session.shop;
    const token = session.accessToken;

    // Create all pages in sequence (can be improved with Promise.all if desired)
    const results = [];

    for (const page of pages) {
      const resp = await fetch(`https://${shop}/admin/api/2025-07/pages.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: {
            title: page.title,
            body_html: body,
            handle: page.handle,
          },
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        results.push({ success: false, error: result.errors || result });
      } else {
        results.push({ success: true, page: result.page });
      }
    }

    for (const result of results) {
      if (!result.success) {
        continue;
      }

      const { page } = result;

      console.log(page);

      await prisma.shopify_pages.upsert({
        where: { pageId: page.admin_graphql_api_id.toString() },
        update: {
          title: page.title,
          handle: page.handle,
          bodyHtml: page.body_html,
          originalPage: orginalPage,
          createdAt: new Date(page.created_at),
          updatedAt: new Date(page.updated_at),
        },
        create: {
          pageId: page.admin_graphql_api_id.toString(),
          title: page.title,
          handle: page.handle,
          bodyHtml: page.body_html,
          originalPage: orginalPage,
          createdAt: new Date(page.created_at),
          updatedAt: new Date(page.updated_at),
        },
      });
    }

    return json({ results });
  } catch (err) {
    console.error("API error:", err);
    return json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
};
