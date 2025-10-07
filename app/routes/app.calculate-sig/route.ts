import { LoaderFunction, json } from "@remix-run/node";
import prisma from "~/db.server";
import sendWinEmail from "~/utils//sendEmail";

const CONVERT_API_URL = process.env.CONVERT_API_URL;
const APP_URL = process.env.APP_URL;

export const loader: LoaderFunction = async  () => {
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
          `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/${experienceId}/aggregated_report`,
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
          (experiment: any) => {
            const baseline = experiment.variations.find(
              (v: any) => v.is_baseline,
            );

            // Filter statistically significant variants with higher conversion rate than baseline
            const winningVariants = experiment.variations.filter(
              (v: any) =>
                !v.is_baseline &&
                v.conversion_data.statistically_significant === true &&
                v.conversion_data.conversion_rate >
                  baseline.conversion_data.conversion_rate,
            );

            // Pick the highest conversion rate winner if any exists
            const winner = winningVariants.length
              ? winningVariants.reduce((prev: any, current: any) =>
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

        for (const expSignificance of experimentsSignificance) {
          if (
            expSignificance.statisticallySignificant &&
            expSignificance.winner
          ) {
            const winner = expSignificance.winner;
            const approveUrl = `${APP_URL}/app/variant/approve?goalId=${expSignificance.goal_id}&variantId=${expSignificance.winner.id}?experienceId=${experienceId}`;

            const mailOptions = {
              from: '"Your App" <no-reply@yourapp.com>',
              to: "client@example.com",
              subject: "Winning Variant Ready for Approval",
              html: `
                <p>The winning variant is: <strong>${winner.name}</strong> with a conversion rate of ${winner.conversion_rate}%.</p>
                <p><a href="${approveUrl}" style="display:inline-block;padding:10px 15px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">
                Approve Variant</a></p>
              `,
            };
            await sendWinEmail(mailOptions);
          }
        }

        data.push({ experimentsSignificance });
      }),
    );
  }

  return json({ success: true, data });
};
