import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import prisma from "~/db.server";
import CallConvertAPI from "~/utils/convert";

const CONVERT_API_URL = process.env.CONVERT_API_URL;

export const addNewExperienceWithWinVariant = async (
  experienceId: string,
  variantId: string,
  setting: any,
) => {
  const { convert_account_id, convert_project_id } = setting;

  const response = await CallConvertAPI({
    url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${experienceId}/variations/${variantId}/convert`,
    method: "PATCH",
    data: {
      status: "completed",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to convert variant ${variantId} to winner: ${await response.text()}`,
    );
  }
  return response.json();
};

export const endExperienceOnConvert = async (
  experienceId: string,
  setting: any,
) => {
  const {
    convert_api_key,
    convert_secret_key,
    convert_account_id,
    convert_project_id,
  } = setting;

  const response = await fetch(
    `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${experienceId}/update`,
    {
      method: "PATCH", // Confirm PATCH method in Convert API docs
      headers: {
        Authorization: `Bearer ${convert_api_key}:${convert_secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "completed" }), // Confirm correct field to end experience
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to end experience ${experienceId}: ${await response.text()}`,
    );
  }
  return response.json();
};

// Loader to validate params and show confirmation page
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const goalId = url.searchParams.get("goalId");
  const variantId = url.searchParams.get("variantId");
  const experienceId = url.searchParams.get("experienceId");

  if (!goalId || !variantId || !experienceId) {
    return json(
      { error: "Missing goalId, variantId or experienceId" },
      { status: 400 },
    );
  }

  return json({ goalId, variantId, experienceId });
};

// Action to process approval POST (called on form submit)
export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const goalId = formData.get("goalId");
    const variantId = formData.get("variantId");
    const experienceId = formData.get("experienceId");

    if (
      typeof goalId !== "string" ||
      typeof variantId !== "string" ||
      typeof experienceId !== "string"
    ) {
      return json({ error: "Invalid form data" }, { status: 400 });
    }

    const setting = await prisma.setting.findFirst();
    if (!setting) {
      return json({ error: "Settings not found" }, { status: 500 });
    }

    // End current experience
    await endExperienceOnConvert(experienceId, setting);

    // Convert selected variant to winner experience
    await addNewExperienceWithWinVariant(experienceId, variantId, setting);

    // Optional: update your DB to record approved variant

    await prisma.convert_experiences.update({
      where: { experienceId: parseInt(experienceId) },
      data: { status: "completed" },
    });

    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error.message || String(error) });
  }
};

export default function Approve() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if ("error" in data) {
    return <p>Error: {data.error}</p>;
  }

  if (actionData?.success) {
    return <p>Success: Winning variant approved.</p>;
  }

  if (actionData?.error) {
    return <p>Error: {actionData.error}</p>;
  }

  return (
    <div>
      <h1>Approve Winning Variant</h1>
      <p>
        Are you sure you want to approve variant{" "}
        <strong>{data.variantId}</strong> for goal{" "}
        <strong>{data.goalId}</strong>?
      </p>

      <form method="post">
        <input type="hidden" name="goalId" value={data.goalId} />
        <input type="hidden" name="variantId" value={data.variantId} />
        <input type="hidden" name="experienceId" value={data.experienceId} />
        <button type="submit">Approve</button>
      </form>
    </div>
  );
}
