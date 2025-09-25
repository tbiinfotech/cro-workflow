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
    const settings = await prisma.setting.findFirst();

    if (!settings) {
      return json({ error: "Settings not found" }, { status: 404 });
    }

    const {
      convert_api_key,
      convert_secret_key,
      convert_project_id,
      convert_account_id,
    } = settings || {};

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

    const splitVariations = results
      .filter((result) => result.success)
      .map((result, i) => ({
        name: `Variation for page handle ${result.page.handle}`,
        changes: [
          {
            type: "defaultRedirect",
            data: {
              // case_sensitive: false,
              original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
              variation_pattern: `https://ancestralsupplements.com/pages/${result.page.handle}`,
            },
          },
        ],
      }));

    if (splitVariations.length > 1) {
      const convertPayload = {
        name: `CRO Page Split Test ${original.handle}`,
        description:
          "Testing different Shopify Page designs across multiple URLs",
        type: "split_url",
        status: "active",
        url: `https://ancestralsupplements.com/pages/${original.handle}`,
        variations: [
          {
            name: "Original",
            changes: [
              {
                type: "defaultRedirect",
                data: {
                  // case_sensitive: false,
                  original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                  variation_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                },
              },
            ],
          },
          ...splitVariations,
        ],
      };

      const convertResp = await fetch(
        `https://api.convert.com/api/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/add`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${convert_api_key}:${convert_secret_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(convertPayload),
        },
      );

      const convertResult = await convertResp.json();

      if (!convertResp.ok) {
        console.error("Convert API error:", convertResult);
      } else {
        // Optionally: attach experiment result to response or store experiment ID in DB
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
