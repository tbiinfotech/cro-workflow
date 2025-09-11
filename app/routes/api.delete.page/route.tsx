import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const { pageId } = await request.json();

    if (!pageId) {
      return json({ error: "PageId not found" }, { status: 400 });
    }

    const id = pageId.split("/").pop();

    const shop = session.shop;
    const token = session.accessToken;

    const resp = await fetch(`https://${shop}/admin/api/2025-07/pages/${id}.json`, {
      method: "DELETE",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    const result = await resp.json();

    if (!resp.ok) {
      return json({ success: false, error: result.errors || result });
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
