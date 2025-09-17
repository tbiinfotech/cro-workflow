import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { OpenAI } from "openai";
import prisma from "~/db.server";

const getSEOPageTitles = async (url) => {
  const secretKey = await prisma.secret_keys.findFirst({
    where: { type: "Open_API" },
  });

  if (!secretKey) {
    return { error: "Open API key not found", pages: [] };
  }

  const openai = new OpenAI({
    apiKey: secretKey.value,
  });

  try {
    // const prompt = `You are an SEO expert for Shopify stores. Analyze the content at this URL: {${url}}. Suggest three creative, keyword-rich, SEO-optimized page titles that will help improve organic traffic. Reply only in valid JSON format with the key "pages" as an array, for example: {"pages": [{ "title": "First title", "handle": "first-handle" }, { "title": "Second title", "handle": "second-handle" }, { "title": "Third title", "handle": "third-handle" }]}`;

    const prompt = `
    Analyze the content at this URL: {${url}}.

    Act as the world’s finest Conversion Rate Optimization (CRO) and direct response marketing expert whose specialty is consumer packaged goods DTC landing page funnels. Your only goal is to write three unique, high-converting headline variations that can be tested against the current control headline. These headlines should grab immediate attention, create emotional impact, speak directly to the visitor’s desires or pain points, build urgency or credibility, and ultimately drive the highest possible purchase conversion rate from paid traffic.

    The brand is Ancestral Supplements, offering whole food organ supplements to improve vitality and wellness. All headline variations should stay true to this positioning while maximizing persuasive power and compelling direct response appeal. Do not optimize for SEO, ignore keyword stuffing or ranking considerations, and focus entirely on persuasion, clarity, and language that motivates prospective customers to buy. Treat the headline as the most important “ad-to-landing-page bridge” that keeps visitors engaged and pushes them toward making a purchase..

    Output ONLY valid JSON in this exact format:
    {
      "pages": [
        { "title": "First title suggestion", "handle": "first-title-suggestion-handle" },
        { "title": "Second title suggestion", "handle": "second-title-suggestion-handle" },
        { "title": "Third title suggestion", "handle": "third-title-suggestion-handle" }
      ]
    }

    Only reply with valid JSON—no explanations, no markdown.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      // model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    const rawAIContent = completion.choices[0]?.message?.content;
    const cleaned = rawAIContent
      ?.replace(/```json\s*/i, "")
      .replace(/```/i, "")
      .trim();

    console.log("AI response: ############", cleaned);

    let pages = [];
    let error = null;

    try {
      // Parse the AI response as JSON
      const aiJson = JSON.parse(cleaned);
      if (Array.isArray(aiJson.pages)) {
        // Check that each page object has both title and handle
        pages = aiJson.pages.filter(
          (p) => typeof p.title === "string" && typeof p.handle === "string",
        );
        if (pages.length === 0) {
          error = "AI response 'pages' array does not contain valid objects.";
        }
      } else {
        error = "AI response does not contain a valid 'pages' array.";
      }
    } catch (parseErr) {
      error = "AI response is not a valid JSON format: " + parseErr.message;
    }

    if (error) {
      return { error, pages: [] };
    }

    return { pages };
  } catch (apiError) {
    console.error("OpenAI API error:", apiError);
    return { error: "OpenAI API error: " + apiError.message, pages: [] };
  }
};

// POST only: expects { handle: string } JSON body
export const action = async ({ request }) => {
  try {
    // const { storefront } = await authenticate.public.appProxy(request);
    const { session } = await authenticate.admin(request);
    const { handle, page_url, body } = await request.json();

    const shop = session.shop;
    const token = session.accessToken;

    if (!handle) {
      return json({ error: "Handle is required" }, { status: 400 });
    }

    const resp = await fetch(
      `https://${shop}/admin/api/2025-07/pages.json?handle=${encodeURIComponent(handle)}`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      },
    );

    const pageResp = await resp.json();

    const page = pageResp.pages[0];

    if (!page) {
      return json({ error: "Page not found" }, { status: 404 });
    }

    const gptResponse = await getSEOPageTitles(page_url);

    if (gptResponse?.error) {
      return json({ error: gptResponse?.error }, { status: 500 });
    }

    return json(
      { pages: gptResponse.pages, originalPage: page },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error("API error:", err);
    return json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
};
