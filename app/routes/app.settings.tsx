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
} from "@shopify/polaris";
import { useCallback, useState } from "react";

// In-memory store for demo purposes (replace with DB in production)
let storedApiKey = "";

type LoaderData = {
  apiKey: string;
};

export const loader: LoaderFunction = async () => {
  // Fetch the saved API key from your DB or config
  return json<LoaderData>({ apiKey: storedApiKey });
};

type ActionData = {
  formError?: string;
  successMessage?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const apiKey = formData.get("apiKey");

  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return json<ActionData>(
      { formError: "API key is required" },
      { status: 400 },
    );
  }

  // Save or update the API key in your DB or config
  storedApiKey = apiKey.trim();

  return json<ActionData>({ successMessage: "API key saved successfully!" });
};

export default function ApiKeysPage() {
  const { apiKey } = useLoaderData<LoaderData>();
  const [apiKeyValue, setApiKey] = useState(apiKey);
  const actionData = useActionData<ActionData>();
  const transition = useViewTransitionState();

  const isSubmitting = transition.state === "submitting";

  const handleChange = useCallback(
    (newValue: string) => setApiKey(newValue),
    [],
  );

  return (
    <AppProvider>
      <Page title="Manage Open API Key">
        <Card sectioned>
          <Form method="post">
            <FormLayout>
              {actionData?.formError && (
                <Banner status="critical" title="Error" onDismiss={() => {}}>
                  <p>{actionData.formError}</p>
                </Banner>
              )}
              {actionData?.successMessage && (
                <Banner status="success" title="Success" onDismiss={() => {}}>
                  <p>{actionData.successMessage}</p>
                </Banner>
              )}

              <TextField
                label="Open API Key"
                name="apiKey"
                type="text"
                value={apiKeyValue}
                defaultValue={apiKey}
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
                required
              />

              {/* <TextField
                label="Third API Key"
                name="apiKey"
                type="text"
                value={apiKeyValue}
                defaultValue={apiKey}
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
                required
              /> */}

              <BlockStack distribution="trailing">
                <Button primary submit loading={isSubmitting}>
                  {apiKey ? "Update API Key" : "Save API Key"}
                </Button>
              </BlockStack>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
