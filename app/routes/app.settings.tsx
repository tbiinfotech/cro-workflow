import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useViewTransitionState,
} from "@remix-run/react";
import {
  AppProvider,
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Frame,
} from "@shopify/polaris";
import React, { useCallback, useState } from "react";
import prisma from "~/db.server";

// Loader fetches and provides the latest saved API key to the frontend
export const loader: LoaderFunction = async () => {
  // Fetch the saved API key from your DB or config
  const secretKey = await prisma.secret_keys.findFirst({
    where: { type: "Open_API" },
  });
  return json<LoaderData>({ apiKey: secretKey?.value ?? "" });
};

// Action saves the submitted API key and redirects on success
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const apiKey = formData.get("apiKey");

  try {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return json<ActionData>(
        { formError: "API key is required" },
        { status: 400 },
      );
    }

    await prisma.secret_keys.upsert({
      where: { type: "Open_API" },
      update: {
        key: "apiKey",
        value: apiKey.trim(),
        updatedAt: new Date(),
      },
      create: {
        type: "Open_API",
        key: "apiKey",
        value: apiKey.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Redirect to the same route to reload with the latest key
    return json<ActionData>({ successMessage: "API key saved successfully!" });
  } catch (error) {
    return json<ActionData>(
      { errorMessage: "Failed to save API key" },
      { status: 500 },
    );
  } finally {
    return json<ActionData>({ successMessage: "API key saved successfully!" });
  }
};

// Frontend component displays always-up-to-date input value
export default function ApiKeysPage() {
  const { apiKey } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const transition = useViewTransitionState();
  const isSubmitting = transition.state === "submitting";
  const [apiKeyValue, setApiKey] = useState(apiKey);

  // Update local state when loader data changes (after redirect)
  React.useEffect(() => {
    setApiKey(apiKey);
  }, [apiKey]);

  const handleChange = useCallback(
    (newValue: string) => setApiKey(newValue),
    [],
  );

  return (
    <AppProvider>
      <Frame>
        <Page title="Manage Open API Key">
          <Card sectioned>
            <Form method="post">
              <FormLayout>
                {actionData?.errorMessage && (
                  <Banner status="critical" title="Error" onDismiss={() => {}}>
                    <p>{actionData.errorMessage}</p>
                  </Banner>
                )}

                {actionData?.successMessage && (
                  <Banner status="success" onDismiss={() => {}}>
                    <p>{actionData.successMessage}</p>
                  </Banner>
                )}
                <TextField
                  label="Open API Key"
                  name="apiKey"
                  type="text"
                  value={apiKeyValue}
                  autoComplete="off"
                  disabled={isSubmitting}
                  onChange={handleChange}
                  required
                />
                <BlockStack distribution="trailing">
                  <Button primary submit loading={isSubmitting}>
                    {apiKey ? "Update API Key" : "Save API Key"}
                  </Button>
                </BlockStack>
              </FormLayout>
            </Form>
          </Card>
        </Page>
      </Frame>
    </AppProvider>
  );
}
