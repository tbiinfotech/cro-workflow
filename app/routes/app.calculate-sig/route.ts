import { json } from "@remix-run/node";
import prisma from "~/db.server";

export const loader = async () => {
  const originalPages = await prisma.shopify_pages.findMany({
    include: {
      convert_experiences: true,
    },
  });
  const setting = await prisma.setting.findFirst();
  const {
    convert_account_id,
    convert_project_id,
    convert_api_key,
    convert_secret_key,
  } = setting!;

  let data: any[] = [];

  if (originalPages.length > 0) {
    await Promise.all(
      originalPages.map(async (page) => {
        const experienceId = page.convert_experiences?.experienceId;
        if (!experienceId) return;

        const report = await fetch(
          `https://api.convert.com/api/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${experienceId}/aggregated_report`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${convert_api_key}:${convert_secret_key}`,
              "Content-Type": "application/json",
            },
          },
        );

        const reportResult = await report.json();

        const experimentsSignificance = reportResult.data.reportData.map(
          (experiment) => {
            const baseline = experiment.variations.find((v) => v.is_baseline);

            // Filter statistically significant variants with higher conversion rate than baseline
            const winningVariants = experiment.variations.filter(
              (v) =>
                !v.is_baseline &&
                v.conversion_data.statistically_significant === true &&
                v.conversion_data.conversion_rate >
                  baseline.conversion_data.conversion_rate,
            );

            // Pick the highest conversion rate winner if any exists
            const winner = winningVariants.length
              ? winningVariants.reduce((prev, current) =>
                  current.conversion_data.conversion_rate >
                  prev.conversion_data.conversion_rate
                    ? current
                    : prev,
                )
              : null;

            return {
              goal_id: experiment.goal_id,
              statisticallySignificant: winningVariants.length > 0,
              winner: winner
                ? {
                    id: winner.id,
                    name: winner.name,
                    conversion_rate: winner.conversion_data.conversion_rate,
                  }
                : null,
            };
          },
        );

        data.push({ experimentsSignificance });
      }),
    );
  }

  return json({ success: true, data });
};
