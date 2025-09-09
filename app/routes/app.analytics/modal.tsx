// Only imports and the Modal component
import { Frame, Modal, TextContainer } from "@shopify/polaris";
import React from "react";

export default function ModalExample({
  activeModal,
  records,
  setDuplicatePages,
}) {
  // Close handler: parent sets activeModal=false by clearing duplicates
  const handleClose = () => setDuplicatePages([]);

  // (Optional) Render your duplicates data instead of hardcoded message
  // Example: render list
  const content = records?.length ? (
    <ul>
      {records.map((record, idx) => (
        <li key={record.pageId || idx}>
          <strong>{record.title}</strong> ({record.handle})
        </li>
      ))}
    </ul>
  ) : (
    <TextContainer>
      <p>No duplicates found for this page.</p>
    </TextContainer>
  );

  return (
    <div style={{ height: "500px" }}>
      <Frame>
        <Modal
          open={activeModal}
          onClose={handleClose}
          title="Duplicate Pages"
          primaryAction={{
            content: "Close",
            onAction: handleClose,
          }}
          // Remove secondary actions for clarity
        >
          <Modal.Section>
            {content}
          </Modal.Section>
        </Modal>
      </Frame>
    </div>
  );
}
