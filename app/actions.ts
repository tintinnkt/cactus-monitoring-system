"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Initialize Gemini
// ideally put process.env.GEMINI_API_KEY here, but for your project you can hardcode for testing
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE"
);

export async function analyzePlantHealth(cameraIp: string) {
  try {
    // 2. Fetch the snapshot from ESP32-CAM
    // Standard ESP32-CAM example uses /capture for a still image
    const snapshotUrl = `http://${cameraIp}/capture`;
    console.log(`Fetching image from: ${snapshotUrl}`);

    const imageResponse = await fetch(snapshotUrl, {
      cache: "no-store", // Don't cache the image
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!imageResponse.ok) {
      return {
        success: false,
        error: "Failed to fetch image from ESP32. Is it online?",
      };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // 3. Prepare Model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 4. Send to Gemini
    const prompt =
      "Analyze this image of a plant. 1) Identify the plant status/health. 2) Check for any pests, rot, or dehydration. 3) Give a short recommendation.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return { success: true, analysis: text };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, error: "Error connecting to AI or Camera." };
  }
}
