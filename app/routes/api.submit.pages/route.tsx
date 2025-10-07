
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import addNewExperience from "./addNewExperince";

export const deleteExperiences = async (id: number) => {
  try {
  } catch (err) {
    console.error("deleteExperiences API error:", err);
  }
};

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const { pages, body, original } = await request.json();
    const settings = await prisma.setting.findFirst();
    let orginalPageId: number = 0;

    if (!settings) {
      return json({ error: "Settings not found" }, { status: 404 });
    }

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
            template_suffix: original.template_suffix,
          },
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        results.push({ success: false, error: result.errors || result });
      } else {
        const pageId = result.page.id;

        await fetch(`https://${shop}/admin/api/2025-07/metafields.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metafield: {
              namespace: "custom",
              key: "heading",
              type: "single_line_text_field", // must match your definition type
              value: page.title, // <-- assign your value
              owner_resource: "page",
              owner_id: pageId,
            },
          }),
        });

        results.push({ success: true, page: result.page });
      }
    }

    for (const result of results) {
      if (!result.success) {
        continue;
      }

      const { page } = result;

      const originalPage = await prisma.shopify_pages.upsert({
        where: { pageId: original.admin_graphql_api_id.toString() },
        update: {
          title: original.title,
          handle: original.handle,
          bodyHtml: original.body_html,
          createdAt: new Date(original.created_at),
          updatedAt: new Date(original.updated_at),
        },
        create: {
          pageId: original.admin_graphql_api_id.toString(),
          title: original.title,
          handle: original.handle,
          bodyHtml: original.body_html,
          createdAt: new Date(original.created_at),
          updatedAt: new Date(original.updated_at),
        },
      });

      if (originalPage) {
        orginalPageId = originalPage.id;
      }

      if (orginalPageId) {
        await prisma.duplicate_pages.upsert({
          where: { pageId: page.admin_graphql_api_id.toString() },
          update: {
            title: page.title,
            handle: page.handle,
            bodyHtml: page.body_html,
            shopifyPageId: orginalPageId,
            createdAt: new Date(page.created_at),
            updatedAt: new Date(page.updated_at),
          },
          create: {
            pageId: page.admin_graphql_api_id.toString(),
            title: page.title,
            handle: page.handle,
            bodyHtml: page.body_html,
            shopifyPageId: orginalPageId,
            createdAt: new Date(page.created_at),
            updatedAt: new Date(page.updated_at),
          },
        });
      }
    }

    await addNewExperience(settings, original, orginalPageId, results);

    return json({ results });
  } catch (err) {
    console.error("API error:", err);
    return json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
};
