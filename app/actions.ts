"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyBJcOi8nddzfqaRqVIitObHpt-18Pm4Z1A");

export async function analyzePlantHealth(imageUrl: string) {
  try {
    if (!imageUrl) {
      throw new Error("No image URL received");
    }

    // 1. ให้ Server ไปโหลดรูปภาพจาก Google Drive/Script มาเป็น Buffer
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) throw new Error("Failed to fetch image from URL");
    
    const arrayBuffer = await imageResp.arrayBuffer();
    
    // 2. แปลงเป็น Base64 เพื่อส่งให้ Gemini
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    // 3. เรียกใช้ Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt =
      "Analyze this cactus image. 1) Is it healthy? 2) Any signs of rot, pests, or dehydration? 3) Recommendation (Water/Sun/None). Answer in Thai language, keep it short (max 3 sentences).";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    return { success: true, analysis: text };

  } catch (error: any) {
    console.error("AI Error:", error);
    return { success: false, error: error.message || "Failed to analyze image." };
  }
}

export async function getLatestImageFromGAS() {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbz_qQcyP9eB_oNgGScMcBVKX5GeUyz93wYsFyp4OFjx_XBa2MBb2ReS9vNXDg7mCwHqAw/exec";
  
  try {
    // Server Fetch ไม่มีปัญหา CORS
    const response = await fetch(`${GAS_URL}`, {
      method: "GET",
      cache: "no-store", // ห้าม Cache เพื่อให้ได้รูปล่าสุดเสมอ
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const url = await response.text();
    return { success: true, url: url.trim() }; // trim ตัดช่องว่างหัวท้ายออก

  } catch (error) {
    console.error("Server Action Error:", error);
    return { success: false, error: "Failed to fetch image" };
  }
}