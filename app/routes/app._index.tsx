import React, { useEffect, useState } from "react";
import {
  AppProvider,
  Page,
  Form,
  FormLayout,
  TextField,
  Button,
  Card,
  Banner,
  Checkbox,
} from "@shopify/polaris";

function FindTitleForm() {
  const [pageUrl, setPageUrl] = useState("");
  const [pages, setPages] = useState([]);
  const [pageBody, setPageBody] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
    const [originalPage, setOrginalPage] = useState("");
  const [isChecked, setIsChecked] = useState<number[]>([]);
  // For TypeScript, this type means: "array of numbers"
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleChange = (value) => {
    setPageUrl(value);
    setError("");
    setSuccess("");
    setPages([]);
    setOrginalPage("")
    setIsChecked([]);
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const extractHandleFromUrl = (url: string) => {
    try {
      const { pathname } = new URL(url);
      // Match /pages/{handle} with or without trailing slash
      const match = pathname.match(/^\/pages\/([^\/]+)/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  };

  const handleFindTitle = async () => {
    setError("");
    setSuccess("");
    setPages([]);
    setOrginalPage("");
    setIsChecked([]);

    if (!isValidUrl(pageUrl)) {
      setError("Please enter a valid URL.");
      return;
    }

    const handle = extractHandleFromUrl(pageUrl);
    if (!handle) {
      setError(
        "This is not a shopify store page URL please enter a valid URL.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, page_url: pageUrl }),
      });

      const data = await response.json();

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      console.log("data", data);

      if (data.pages && data.body) {
        setPages(data.pages);
        setPageBody(data.body);
        setOrginalPage(data.originalPage);
        setSuccess("Title found successfully!");
      } else {
        setError("Title not found on the page.");
      }
    } catch (error) {
      console.error("Error fetching title:", error);
      setError("Error fetching title. Please try again.");
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    setSuccess("");
    setError("");

    try {
      const selectedTitles = isChecked.map((i) => pages[i]);
      const data = {
        pages: selectedTitles,
        body: pageBody,
        original: originalPage,
      };
      // Send array of selected titles
      const response = await fetch("/api/submit/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit titles");
      }

      const jsRes = await response.json();

      console.log("response ###################", jsRes);

      setSuccess("Pages submitted successfully!");
      setIsChecked([]);
      setPages([]);
      setOrginalPage("");
      setPageBody([]);
      setPageUrl("");
    } catch (error) {
      setError("Error submitting Pages. Please try again.");
    }

    setSubmitLoading(false);
  };

  return (
    <AppProvider>
      <Page title="Find Page Title">
        {error && (
          <Banner
            status="critical"
            title="Error"
            onDismiss={() => setError("")}
          >
            <p>{error}</p>
          </Banner>
        )}

        {success && (
          <Banner
            status="success"
            title="Success"
            onDismiss={() => setSuccess("")}
          >
            <p>{success}</p>
          </Banner>
        )}
        <div style={{ marginTop: "1rem" }}>
          <Card sectioned>
            <div
              style={{
                marginBottom: "1rem",
              }}
            >
              <Form onSubmit={(e) => e.preventDefault()}>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Page URL"
                      value={pageUrl}
                      onChange={handleChange}
                      placeholder="Enter the page URL"
                      autoComplete="off"
                      type="url"
                      clearButton
                      onClearButtonClick={() => {
                        setPageUrl("");
                        setError("");
                        setSuccess("");
                        setPages([]);
                        setOrginalPage("");
                        setIsChecked([]);
                      }}
                      disabled={loading || submitLoading}
                      connectedRight={
                        <Button
                          variant="primary"
                          onClick={handleFindTitle}
                          loading={loading}
                          disabled={loading || submitLoading}
                        >
                          Find Title
                        </Button>
                      }
                    />
                  </FormLayout.Group>
                </FormLayout>
              </Form>
            </div>
            {Array.isArray(pages) && pages?.length > 0 && (
              <Card>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "start",
                  }}
                >
                  {pages.map((page, idx) => (
                    <Checkbox
                      key={idx}
                      label={page.title}
                      checked={isChecked.includes(idx)}
                      onChange={() => {
                        if (isChecked.includes(idx)) {
                          // Remove index from array if already checked
                          setIsChecked(isChecked.filter((i: any) => i !== idx));
                        } else {
                          // Add index to array if not checked
                          setIsChecked([...isChecked, idx]);
                        }
                      }}
                      disabled={submitLoading}
                    />
                  ))}
                </div>
                {isChecked.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "start",
                      marginTop: "1rem",
                    }}
                  >
                    <Button
                      variant="primary"
                      onClick={handleSubmit}
                      loading={submitLoading}
                      disabled={submitLoading}
                    >
                      Submit
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </Card>
        </div>
      </Page>
    </AppProvider>
  );
}

export default FindTitleForm;
