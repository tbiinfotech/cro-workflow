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
import { e } from "node_modules/@intelligems/headless/dist/intelligems-context-DhEe7xAJ";
import React, { useCallback, useState } from "react";
import prisma from "~/db.server";

// Loader fetches and provides the latest saved API key to the frontend
export const loader: LoaderFunction = async () => {
  // Fetch the saved API key from your DB or config
  const secretKey = await prisma.setting.findFirst();
  console.log("Secret Key #########", secretKey);
  return json<LoaderData>({ data: secretKey });
};

// Action saves the submitted API key and redirects on success
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const apiKey = formData.get("apiKey");
  const prompt = formData.get("prompt");
  const id = formData.get("id");

  try {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return json<ActionData>(
        { formError: "API key is required" },
        { status: 400 },
      );
    }

    if (id) {
      // 🔹 Update record by id
      const updated = await prisma.setting.update({
        where: { id: Number(id) },
        data: {
          apiKey: apiKey.trim(),
          prompt,
          updatedAt: new Date(),
        },
      });

      console.log("Updated:", updated);
    } else {
      // 🔹 Create new record
      const created = await prisma.setting.create({
        data: {
          apiKey: apiKey.trim(),
          prompt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("Created:", created);
    }

    // Redirect to the same route to reload with the latest key
    return json<ActionData>({ successMessage: "API key saved successfully!" });
  } catch (error) {
    console.error("Error saving API key:", error);
    return json<ActionData>(
      { errorMessage: "Failed to save API key" },
      { status: 500 },
    );
  }
};

// Frontend component displays always-up-to-date input value
export default function ApiKeysPage() {
  const { data } = useLoaderData<LoaderData>();
  const { id, apiKey, prompt } = data || {};
  let actionData = useActionData<ActionData>();
  const transition = useViewTransitionState();
  const isSubmitting = transition.state === "submitting";
  const [apiKeyValue, setApiKey] = useState(apiKey);
  const [gptPromptValue, setGptPromptValue] = useState(prompt);
    const [showBanner, setShowBanner] = useState(true);

  const [errors, setErrors] = useState({ api_error: "", prompt_error: "" });

  // Update local state when loader data changes (after redirect)
  React.useEffect(() => {

    if (!apiKeyValue) {
      setErrors({ ...errors, api_error: "Open API Key is required" });
    } else {
      setErrors({ ...errors, api_error: "" });
    }

    if (!gptPromptValue) {
      setErrors({ ...errors, prompt_error: "Prompt is required" });
    } else {
      setErrors({ ...errors, prompt_error: "" });
    }
  }, [apiKey, gptPromptValue]);

  const handleChange = useCallback(
    (newValue: string, setData: any) => setData(newValue),
    [],
  );

  return (
    <AppProvider>
      <Frame>
        <Page title="Manage Open API Key">
          <Card sectioned>
            <Form method="post">
              <FormLayout>
                {showBanner && actionData?.errorMessage && (
                  <Banner status="critical" title="Error" onDismiss={() => {}}>
                    <p>{actionData.errorMessage}</p>
                  </Banner>
                )}

                {showBanner && actionData?.successMessage && (
                  <Banner status="success" onDismiss={() => setShowBanner(false)}>
                    <p>{actionData.successMessage}</p>
                  </Banner>
                )}
                <input type="hidden" name="id" value={id} />

                <TextField
                  label="Open API Key"
                  name="apiKey"
                  type="text"
                  value={apiKeyValue}
                  autoComplete="off"
                  disabled={isSubmitting}
                  onChange={(value) => handleChange(value, setApiKey)}
                  error={errors.api_error}
                />

                <TextField
                  label="Chat GPT Prompt"
                  name="prompt"
                  type="text"
                  value={gptPromptValue}
                  autoComplete="off"
                  disabled={isSubmitting}
                  onChange={(value) => handleChange(value, setGptPromptValue)}
                  multiline={8}
                  error={errors.prompt_error}
                />
                <BlockStack distribution="trailing">
                  <Button primary submit loading={isSubmitting} onClick={() => setShowBanner(!showBanner)}>
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
