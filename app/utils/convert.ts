import axios from "axios";
import prisma from "~/db.server";

interface ConvertAPIParams {
  url: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  data?: any;
}

const callConvertAPI = async ({
  url,
  method,
  data,
}: ConvertAPIParams) => {
  const settings = await prisma.setting.findFirst();

  if (!settings) {
    throw new Error("Settings not found");
  }

  const {
    convert_api_key,
    convert_secret_key,
  } = settings;

  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${convert_api_key}:${convert_secret_key}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error: any) {
    // You can customize error handling or logging here
    console.error(
      "Convert API call failed:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

export default callConvertAPI;
