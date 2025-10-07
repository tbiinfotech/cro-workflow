import { ConvertSettings } from "./types";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import sendEmail from "~/utils/sendEmail";
import CallConvertAPI from "~/utils/convert";

const CONVERT_API_URL = process.env.CONVERT_API_URL;

export const addNewExperience = async (
  settings: ConvertSettings,
  original: any,
  orginalPageId: number,
  results: any,
) => {
  try {
    const { convert_account_id, convert_project_id } = settings;

    const splitVariations = results
      .filter((result: any) => result.success)
      .map((result: any, i: any) => ({
        name: `Variation for page handle ${result.page.handle}`,
        changes: [
          {
            type: "defaultRedirect",
            data: {
              original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
              variation_pattern: `https://ancestralsupplements.com/pages/${result.page.handle}`,
            },
          },
        ],
      }));

    if (splitVariations.length) {
      const convertlocationPayload = {
        description: "Original URL of the experience",
        name: `CRO Page Split Test ${original.handle}`,
        rules: {
          OR: [
            {
              AND: [
                {
                  OR_WHEN: [
                    {
                      matching: { match_type: "matches", negated: false },
                      rule_type: "url",
                      value: `https://ancestralsupplements.com/pages/${original.handle}`,
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      // Call Location API
      const locationResponse = await CallConvertAPI({
        url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/locations/add`,
        method: "POST",
        data: convertlocationPayload,
      });

      if (!locationResponse || !locationResponse.id) {
        throw new Error(
          `Failed to create location: ${JSON.stringify(locationResponse)}`,
        );
      }
      const location = locationResponse.id;

      const convertPayload = {
        name: `CRO Page Split Test ${original.handle}`,
        description:
          "Testing different Shopify Page designs across multiple URLs",
        type: "split_url",
        status: "active",
        url: `https://ancestralsupplements.com/pages/${original.handle}`,
        locations: [location],
        variations: [
          {
            name: "Original",
            changes: [
              {
                type: "defaultRedirect",
                data: {
                  original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                  variation_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                },
              },
            ],
          },
          ...splitVariations,
        ],
      };

      // Call Experiences API
      const response = await CallConvertAPI({
        url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/add`,
        method: "POST",
        data: convertPayload,
      });

      if (!response || !response.id) {
        throw new Error(
          `Failed to create experience: ${JSON.stringify(response)}`,
        );
      }

      const convertResult = response;

      const experience = await prisma.convert_experiences.create({
        data: {
          name: convertResult.name,
          shopifyPageId: orginalPageId,
          experienceId: convertResult.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (experience.id) {
        const response = await CallConvertAPI({
          url: `${CONVERT_API_URL}/v1/experiences/get/${convert_project_id}/${convertResult.id}`,
          method: "GET",
        });

        if (response?.variations.length) {
          for (const variation of response.variations) {
            await prisma.variants.create({
              data: {
                name: variation.name,
                experienceId: convertResult.id,
                variantId: variation.id.toString(),
                variant_url: variation.url,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      }

      const mailOptions = {
        from: '"Your App" <no-reply@yourapp.com>',
        to: "sanchit.chauhan@brihaspatitech.com", // change to your recipient
        subject: "New Convert Experience Created",
        html: `
          <p>Hello,</p>
          <p>A new Convert experience named <strong>${convertResult.name}</strong> has been successfully created.</p>
          <p>Experience ID: <strong>${convertResult.id}</strong></p>
          <p>You can now manage or review it in your Convert dashboard.</p>
          <p>Regards,<br/>Your App Team</p>
        `,
      };

      await sendEmail(mailOptions);
    }
  } catch (err: any) {
    console.error("addNewExperience API error:", err.message || err);

    // Optional: notify yourself/admin via email or logging service here on critical failure
    // await sendEmail({ to: "admin@yourapp.com", subject: "Convert API Failure", ... })

    // You can rethrow or return an error object if you want callers to handle the error
    throw err;
  }
};

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
