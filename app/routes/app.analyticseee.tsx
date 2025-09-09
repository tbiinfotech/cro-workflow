import prisma from "~/db.server";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import {
  Text,
  IndexTable,
  LegacyCard,
  IndexFilters,
  useSetIndexFiltersMode,
  useBreakpoints,
  Page,
  Icon
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { useLoaderData, useNavigate, useLocation } from "@remix-run/react";
import { ViewIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  console.log("Session ###########", session);
  const shop = session.shop;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page"), 10) || 1;
  const pageSize = parseInt(url.searchParams.get("pageSize"), 10) || 5;
  const skip = (page - 1) * pageSize;

  // Filtering logic for "title", "pageId", and "handle" fields
  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { pageId: { contains: search, mode: "insensitive" } },
          { handle: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  // Get paginated records
  const [pages, total] = await Promise.all([
    prisma.shopify_pages.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        duplicates: true, // Fetches all related duplicate_pages for each shopify_page
      },
    }),
    prisma.shopify_pages.count({ where }),
  ]);

  return json({ pages, total, shop });
};

export default function AnalyticsWithTable() {
  const { pages, total } = useLoaderData();
  const navigate = useNavigate();
  const location = useLocation();

  console.log("pages", pages);

  // Pagination and search state
  const urlParams = new URLSearchParams(location.search);
  const initialSearch = urlParams.get("search") || "";
  const initialPage = parseInt(urlParams.get("page") || "1", 10);
  const initialPageSize = 8;

  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Update URL query params when search or page changes
  const updateUrl = useCallback(
    (newSearch: string, newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set("search", newSearch);
      if (newPage > 1) params.set("page", newPage.toString());
      if (pageSize !== 5) params.set("pageSize", pageSize.toString());
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    },
    [navigate, location.pathname, pageSize],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      updateUrl(value, 1);
    },
    [updateUrl],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      updateUrl(search, newPage);
    },
    [search, updateUrl],
  );

  // Tabs example (simplified)
  const [itemStrings, setItemStrings] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = itemStrings.map((item, index) => ({
    content: item,
    id: `${item}-${index}`,
    onAction: () => setSelectedTab(index),
    isLocked: index === 0,
  }));

  const { mode, setMode } = useSetIndexFiltersMode();

  // Breakpoints for responsive condensed table
  const { smDown } = useBreakpoints();

  const totalPages = Math.ceil(total / pageSize);

  // Prepare rows for IndexTable
  const rowMarkup = pages.map(({ title, handle, pageId }, index) => (
    <IndexTable.Row id={pageId} key={pageId} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{handle}</IndexTable.Cell>
      <IndexTable.Cell>{pageId}</IndexTable.Cell>
      <IndexTable.Cell>
        <Icon source={ViewIcon} tone="base" />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Pages">
      <LegacyCard>
        <IndexFilters
          queryValue={search}
          queryPlaceholder="Search pages"
          onQueryChange={handleSearchChange}
          onQueryClear={() => handleSearchChange("")}
          tabs={tabs}
          selected={selectedTab}
          onSelect={setSelectedTab}
          mode={mode}
          filters={[]}
          setMode={setMode}
          cancelAction={{
            onAction: () => {
              setSearch("");
              setPage(1);
              updateUrl("", 1);
            },
            disabled: false,
            loading: false,
          }}
        />
        <IndexTable
          condensed={smDown}
          resourceName={{ singular: "page", plural: "pages" }}
          itemCount={total}
          selectable={false}
          headings={[
            { title: "Title" },
            { title: "Handle" },
            { title: "Orginal Page" },
            { title: "Action" },
          ]}
          pagination={{
            hasNext: page < totalPages,
            onNext: () => handlePageChange(page + 1),
            hasPrevious: page > 1,
            onPrevious: () => handlePageChange(page - 1),
          }}
        >
          {rowMarkup}
        </IndexTable>
        {/* You can add pagination controls here */}
      </LegacyCard>
    </Page>
  );
}
