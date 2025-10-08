import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
// import { CallConvertAPI } from "~/utils/convert.server";
import prisma from "~/db.server";
const CONVERT_API_URL = process.env.CONVERT_API_URL;

export const action = async ({ request }) => {
  const { CallConvertAPI } = await import('~/utils/convert.server');


  try {
    const { session } = await authenticate.admin(request);
    const { pageId, handle } = await request.json();
    const setting = await prisma.setting.findFirst();

    if (!setting) {
      return json({ error: "Settings not found" }, { status: 404 });
    }

    const { convert_account_id, convert_project_id } = setting;

    if (!pageId) {
      return json({ error: "PageId not found" }, { status: 400 });
    }

    const id = pageId.split("/").pop();

    const shop = session.shop;
    const token = session.accessToken;

    const resp = await fetch(
      `https://${shop}/admin/api/2025-07/pages/${id}.json`,
      {
        method: "DELETE",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      },
    );

    const result = await resp.json();

    if (!resp.ok) {
      return json({ success: false, error: result.errors || result });
    }

    const variant = await prisma.variants.findFirst({
      where: {
        variant_url: `https://ancestralsupplements.com/pages/${handle}`,
      },
    });

    if (!variant) {
      return json({ success: false, error: "Variant not found" });
    }

    const getAllVariants = await prisma.variants.findMany({
      where: {
        experienceId: variant.experienceId,
      },
    });

    if (getAllVariants.length === 2) {
      for (const variant of getAllVariants) {
        if (variant.name === "Original") {
          // Delete experience if merchant delelted all variants fromt the app.
          await CallConvertAPI({
            url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${variant.experienceId}/update`,
            method: "POST",
            data: {
              status: "paused",
            },
          });
          await CallConvertAPI({
            url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${variant.experienceId}/update`,
            method: "POST",
            data: {
              status: "archived",
            },
          });
          await CallConvertAPI({
            url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${variant.experienceId}/delete`,
            method: "DELETE",
          });
        }

        await prisma.variants.delete({
          where: {
            id: variant.id,
          },
        });

        await prisma.convert_experiences.delete({
          where: {
            experienceId: variant.id,
          },
        });
      }
    } else {
      await CallConvertAPI({
        url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${variant.experienceId}/variations/${variant.variantId}/delete`,
        method: "DELETE",
      });
      await prisma.variants.delete({
        where: {
          id: variant.experienceId,
        },
      });
    }

    return json({ success: true });
  } catch (err) {
    console.error("API error:", err);
    return json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
};
