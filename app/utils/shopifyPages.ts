import fetch from 'node-fetch';
import prisma from '~/db.server';

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = '2025-07';

interface ShopifyPage {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyPagesResponse {
  pages: ShopifyPage[];
}

async function fetchShopifyPages(pageInfo?: string): Promise<{ pages: ShopifyPage[]; nextPageInfo?: string }> {
  const url = new URL(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/pages.json`);
  url.searchParams.set('limit', '50');
  if (pageInfo) {
    url.searchParams.set('page_info', pageInfo);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pages: ${response.status} ${response.statusText}`);
  }

  const data: ShopifyPagesResponse = await response.json();

  // Parse Link header for pagination
  const linkHeader = response.headers.get('link');
  let nextPageInfo: string | undefined = undefined;

  if (linkHeader) {
    const links = linkHeader.split(',');
    for (const link of links) {
      const [urlPart, relPart] = link.split(';').map((s) => s.trim());
      if (relPart === 'rel="next"') {
        const match = urlPart.match(/page_info=([^&>]+)/);
        if (match) {
          nextPageInfo = match[1];
        }
      }
    }
  }

  return { pages: data.pages, nextPageInfo };
}

export async function fetchAndSaveAllShopifyPages() {
  let pageInfo: string | undefined = undefined;
  let allPages: ShopifyPage[] = [];

  do {
    const { pages, nextPageInfo } = await fetchShopifyPages(pageInfo);
    allPages = allPages.concat(pages);
    pageInfo = nextPageInfo;
  } while (pageInfo);

  // Save or update pages in DB
  for (const page of allPages) {
    await prisma.shopify_pages.upsert({
      where: { pageId: page.id.toString() },
      update: {
        title: page.title,
        handle: page.handle,
        bodyHtml: page.body_html,
        createdAt: new Date(page.created_at),
        updatedAt: new Date(page.updated_at),
      },
      create: {
        pageId: page.id.toString(),
        title: page.title,
        handle: page.handle,
        bodyHtml: page.body_html,
        createdAt: new Date(page.created_at),
        updatedAt: new Date(page.updated_at),
      },
    });
  }

  return allPages.length;
}
