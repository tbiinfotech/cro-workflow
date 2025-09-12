import {
  Link,
  Modal,
  TextContainer,
  BlockStack,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
import RedirectIcon from "~/assets/redirect.svg";
import { DeleteIcon } from "@shopify/polaris-icons";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

interface RecordItem {
  pageId: string;
  title: string;
  handle: string;
}

interface ModalExampleProps {
  activeModal: boolean;
  records: RecordItem[];
  handleClose: () => void;
  shop: string;
}

export default function ModalExample({
  activeModal,
  records,
  handleClose,
  shop,
}: ModalExampleProps) {
  const fetcher = useFetcher();

  // Keep local copy of records for live updates
  const [localRecords, setLocalRecords] = useState<RecordItem[]>(records);
  const [deleting, setDeleting] = useState(false);

  // Reset localRecords whenever parent sends new ones
  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  // Track confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<RecordItem | null>(null);

  const handleDeleteClick = (record: RecordItem) => {
    setSelectedPage(record);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    if (selectedPage) {
      const data = {
        pageId: selectedPage.pageId,
      };

      const response = await fetch("/api/delete/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        setDeleting(false);
        throw new Error("Falied to delete page from Shopify.");
      }

      const jsRes = await response.json();

      if (jsRes.success) {
        setDeleting(false);
        fetcher.submit(
          { intent: "delete", pageId: selectedPage.pageId },
          { method: "post" },
        );

        // Optimistically update local list
        setLocalRecords((prev) =>
          prev.filter((rec) => rec.pageId !== selectedPage.pageId),
        );

        setConfirmOpen(false);
        setSelectedPage(null);
      }
      // Call server-side action
    } else {
      setDeleting(false);
    }
  };

  const content =
    localRecords?.length > 0 ? (
      <BlockStack gap="400">
        {localRecords.map((record) => (
          <InlineStack
            key={record.pageId}
            align="space-between"
            blockAlign="center"
          >
            {/* Left side: Title + Redirect link */}
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" fontWeight="bold">
                {record.title}
              </Text>
              <Link
                target="_blank"
                url={`https://${shop}/pages/${record.handle}`}
                monochrome
                removeUnderline
                aria-label={`Open ${record.title} page in a new tab`}
              >
                <img
                  alt="Redirect"
                  src={RedirectIcon}
                  height={20}
                  width={20}
                  style={{ verticalAlign: "middle" }}
                />
              </Link>
            </InlineStack>

            {/* Right side: Delete icon */}
            <div
              role="button"
              style={{ cursor: "pointer" }}
              onClick={() => handleDeleteClick(record)}
            >
              <Icon source={DeleteIcon} tone="critical" />
            </div>
          </InlineStack>
        ))}
      </BlockStack>
    ) : (
      <TextContainer>
        <p>No duplicates found for this page.</p>
      </TextContainer>
    );

  return (
    <>
      {/* Main modal */}
      <Modal
        open={activeModal}
        onClose={handleClose}
        title="Duplicate Pages"
        primaryAction={{
          content: "Close",
          onAction: handleClose,
        }}
      >
        <Modal.Section>{content}</Modal.Section>
      </Modal>

      {/* Confirmation modal */}
      <Modal
        size="small"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Delete"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmDelete,
          loading: deleting,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setConfirmOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>
              Are you sure you want to delete{" "}
              <strong>{selectedPage?.title}</strong>?
            </p>
            <p style={{ marginTop: "8px", color: "red" }}>
              This will also permanently delete the page from your Shopify
              store.
            </p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </>
  );
}
