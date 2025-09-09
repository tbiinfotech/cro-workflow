import prisma from "~/db.server";

export async function fetchAndSaveAllShopifyPages(admin) {
  // Fetch all duplicate page records from DB
  const duplicatePages = await prisma.duplicate_pages.findMany({});

  let processedCount = 0;

  for (const page of duplicatePages) {
    // Build the GraphQL query to fetch page by handle
    const QUERY = `
      query PageByHandle($handle: String!) {
        pageByHandle(handle: $handle) {
          id
          title
          body
          handle
          url
          createdAt
          updatedAt
        }
      }
    `;
    const variables = { handle: page.handle };

    // Call Shopify Admin GraphQL API
    const resp = await admin.graphql(QUERY, { variables });
    const page1 = resp.data?.pageByHandle;

    // If page is missing, delete stale record
    if (!page1) {
      await prisma.duplicate_pages.delete({
        where: { pageId: page.pageId }, // Assumes pageId is unique key
      });
      continue;
    }

    // Upsert page record into duplicate_pages
    await prisma.duplicate_pages.upsert({
      where: { pageId: page1.id },
      update: {
        title: page1.title,
        handle: page1.handle,
        bodyHtml: page1.body,
        createdAt: page1.createdAt ? new Date(page1.createdAt) : undefined,
        updatedAt: page1.updatedAt ? new Date(page1.updatedAt) : undefined,
      },
      create: {
        pageId: page1.id,
        title: page1.title,
        handle: page1.handle,
        bodyHtml: page1.body,
        createdAt: page1.createdAt ? new Date(page1.createdAt) : undefined,
        updatedAt: page1.updatedAt ? new Date(page1.updatedAt) : undefined,
      },
    });

    processedCount++;
  }

  return processedCount;
}
