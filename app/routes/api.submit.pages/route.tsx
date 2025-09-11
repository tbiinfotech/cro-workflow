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
    const { pages, body, original } = await request.json();

    if (!pages || !Array.isArray(pages)) {
      return json({ error: "Pages array is required" }, { status: 400 });
    }

    const shop = session.shop;
    const token = session.accessToken;

    // Create all pages in sequence (can be improved with Promise.all if desired)
    const results = [];

    for (const page of pages) {
      const bodyHtml = `${body ? body : ""}
    <div id="cro-page-heading" data-page-metafield="${page.title}">
      <!-- Replo block will mount here -->
    </div>
    <script>
    document.addEventListener("DOMContentLoaded", () => {
      const headingDiv = document.querySelector("[data-heading]");
      const headingVal = document.getElementById("cro-page-heading")?.dataset.pageMetafield;

      if (headingDiv && headingVal) {
        const target = headingDiv.querySelector("span p");
        if (target) {
          target.textContent = headingVal;
        }
      }
    });
    </script>
    `;

      const resp = await fetch(`https://${shop}/admin/api/2025-07/pages.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: {
            title: page.title,
            body_html: bodyHtml,
            handle: page.handle,
            template_suffix: original.template_suffix,
          },
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        results.push({ success: false, error: result.errors || result });
      } else {
        // const pageId = result.page.id;

        // await fetch(`https://${shop}/admin/api/2025-07/metafields.json`, {
        //   method: "POST",
        //   headers: {
        //     "X-Shopify-Access-Token": token,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     metafield: {
        //       namespace: "custom",
        //       key: "heading",
        //       type: "single_line_text_field", // must match your definition type
        //       value: page.title, // <-- assign your value
        //       owner_resource: "page",
        //       owner_id: pageId,
        //     },
        //   }),
        // });

        results.push({ success: true, page: result.page });
      }
    }

    for (const result of results) {
      if (!result.success) {
        continue;
      }

      const { page } = result;

      console.log(page);

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
        await prisma.duplicate_pages.upsert({
          where: { pageId: page.admin_graphql_api_id.toString() },
          update: {
            title: page.title,
            handle: page.handle,
            bodyHtml: page.body_html,
            shopifyPageId: originalPage.id,
            createdAt: new Date(page.created_at),
            updatedAt: new Date(page.updated_at),
          },
          create: {
            pageId: page.admin_graphql_api_id.toString(),
            title: page.title,
            handle: page.handle,
            bodyHtml: page.body_html,
            shopifyPageId: originalPage.id,
            createdAt: new Date(page.created_at),
            updatedAt: new Date(page.updated_at),
          },
        });
      }
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
