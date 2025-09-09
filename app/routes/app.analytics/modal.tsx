import { Link, Modal, TextContainer, BlockStack, Icon } from "@shopify/polaris";
import RedirectIcon from "~/assets/redirect.svg";

export default function ModalExample({
  activeModal,
  records,
  handleClose,
  shop,
}) {
  // List content for duplicates
  const content = records?.length ? (
    <BlockStack vertical spacing="loose">
      {records.map((record, idx) => (
        <BlockStack
          alignment="center"
          spacing="tight"
          key={record.pageId || idx}
        >
          <TextContainer>
            <strong>{record.title}</strong>{" "}
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
                height={24}
                width={24}
                style={{ verticalAlign: "middle" }}
              />
            </Link>
          </TextContainer>
        </BlockStack>
      ))}
    </BlockStack>
  ) : (
    <TextContainer>
      <p>No duplicates found for this page.</p>
    </TextContainer>
  );

  return (
    <Modal
      open={activeModal}
      onClose={handleClose}
      title="Duplicate Pages"
      primaryAction={{
        content: "Close",
        onAction: handleClose,
      }}
      sectioned
    >
      <Modal.Section>{content}</Modal.Section>
    </Modal>
  );
}
