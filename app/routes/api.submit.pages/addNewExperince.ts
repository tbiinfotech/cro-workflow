import { ConvertSettings } from "./types";
import prisma from "~/db.server";
import sendEmail from "~/utils/sendEmail";
import { CallConvertAPI } from "~/utils/convert.server";

const CONVERT_API_URL = process.env.CONVERT_API_URL;



const addNewExperience = async (
  settings: ConvertSettings,
  original: any,
  orginalPageId: number,
  results: any,
) => {
  try {
    const { convert_account_id, convert_project_id } = settings;

    const splitVariations = results
      .filter((result: any) => result.success)
      .map((result: any, i: any) => ({
        name: `Variation for page handle ${result.page.handle}`,
        changes: [
          {
            type: "defaultRedirect",
            data: {
              original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
              variation_pattern: `https://ancestralsupplements.com/pages/${result.page.handle}`,
            },
          },
        ],
      }));

    if (splitVariations.length) {
      const convertlocationPayload = {
        description: "Original URL of the experience",
        name: `CRO Page Split Test ${original.handle}`,
        rules: {
          OR: [
            {
              AND: [
                {
                  OR_WHEN: [
                    {
                      matching: { match_type: "matches", negated: false },
                      rule_type: "url",
                      value: `https://ancestralsupplements.com/pages/${original.handle}`,
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      // Call Location API
      const locationResponse = await CallConvertAPI({
        url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/locations/add`,
        method: "POST",
        data: convertlocationPayload,
      });

      if (!locationResponse || !locationResponse.id) {
        throw new Error(
          `Failed to create location: ${JSON.stringify(locationResponse)}`,
        );
      }
      const location = locationResponse.id;

      const convertPayload = {
        name: `CRO Page Split Test ${original.handle}`,
        description:
          "Testing different Shopify Page designs across multiple URLs",
        type: "split_url",
        status: "active",
        url: `https://ancestralsupplements.com/pages/${original.handle}`,
        locations: [location],
        variations: [
          {
            name: "Original",
            changes: [
              {
                type: "defaultRedirect",
                data: {
                  original_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                  variation_pattern: `https://ancestralsupplements.com/pages/${original.handle}`,
                },
              },
            ],
          },
          ...splitVariations,
        ],
      };

      // Call Experiences API
      const response = await CallConvertAPI({
        url: `${CONVERT_API_URL}/v2/accounts/${convert_account_id}/projects/${convert_project_id}/experiences/add`,
        method: "POST",
        data: convertPayload,
      });

      if (!response || !response.id) {
        throw new Error(
          `Failed to create experience: ${JSON.stringify(response)}`,
        );
      }

      const convertResult = response;

      const experience = await prisma.convert_experiences.create({
        data: {
          name: convertResult.name,
          shopifyPageId: orginalPageId,
          experienceId: convertResult.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (experience.id) {
        const response = await CallConvertAPI({
          url: `${CONVERT_API_URL}/v1/experiences/get/${convert_project_id}/${convertResult.id}`,
          method: "GET",
        });

        if (response?.variations.length) {
          for (const variation of response.variations) {
            await prisma.variants.create({
              data: {
                name: variation.name,
                experienceId: convertResult.id,
                variantId: variation.id.toString(),
                variant_url: variation.url,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      }

      const mailOptions = {
        from: '"Your App" <no-reply@yourapp.com>',
        to: "sanchit.chauhan@brihaspatitech.com", // change to your recipient
        subject: "New Convert Experience Created",
        html: `
          <p>Hello,</p>
          <p>A new Convert experience named <strong>${convertResult.name}</strong> has been successfully created.</p>
          <p>Experience ID: <strong>${convertResult.id}</strong></p>
          <p>You can now manage or review it in your Convert dashboard.</p>
          <p>Regards,<br/>Your App Team</p>
        `,
      };

      await sendEmail(mailOptions);
    }
  } catch (err: any) {
    console.error("addNewExperience API error:", err.message || err);

    // Optional: notify yourself/admin via email or logging service here on critical failure
    // await sendEmail({ to: "admin@yourapp.com", subject: "Convert API Failure", ... })

    // You can rethrow or return an error object if you want callers to handle the error
    throw err;
  }
};

export default addNewExperience;
