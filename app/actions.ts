"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Modified: Accepts base64 string directly from the Client
export async function analyzePlantHealth(base64Image: string) {
  try {
    if (!base64Image) {
      throw new Error("No image data received");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt =
      "Analyze this cactus/plant image. 1) Is it healthy? 2) Any signs of rot, pests, or dehydration? 3) Recommendation (Water/Sun/None). Keep it short (max 3 sentences).";

    // Remove the data:image/jpeg;base64, prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    return { success: true, analysis: response.text() };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, error: "Failed to analyze image." };
  }
}
