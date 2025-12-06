"use client";

import React, { useState, useEffect } from "react";
import {
  Droplets,
  Sun,
  Thermometer,
  GlassWater,
  Image as ImageIcon, // ไอคอนรูปภาพ
  Power,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Loader2,
  Camera,
} from "lucide-react";
// เปลี่ยนจาก Firestore เป็น Realtime Database
import { ref, onValue, set, get } from "firebase/database"; 
import { db } from "./lib/firebase"; 
import { analyzePlantHealth, getLatestImageFromGAS } from "./actions";

// --- Types ให้ตรงกับ ESP32 ---
interface DashboardData {
  sensors: {
    temperature: number;
    water_level_cm: number;
    soil_moisture: number;
    light_intensity: number;
  };
  status: {
    pump_on: boolean;
    water_empty: boolean;
  };
  latest_image_url?: string; // รองรับ URL รูปภาพ (ถ้าจะส่งมาเก็บ)
}

export default function CactusDashboard() {
  const [mounted, setMounted] = useState(false);
  
  // AI States
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Image State
  const [imageUrl, setImageUrl] = useState<string>("https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?q=80&w=2449&auto=format&fit=crop");

  const fetchLatestImage = async () => {
    try {
      console.log("Asking server to fetch image...");
      
      // เรียกใช้ Server Action แทน fetch โดยตรง
      const result = await getLatestImageFromGAS();
      
      if (result.success) {
        // เช็คอีกรอบว่าเป็น URL จริงๆ
        console.log("New Image URL:", result.url);
        setImageUrl("https://drive.google.com/thumbnail?id=" + result.url);
        
      } else {
        console.error("Server failed:", result.error);
      }
    } catch (error) {
      console.error("Client Error:", error);
    }
  };

  // Default Data
  const [data, setData] = useState<DashboardData>({
    sensors: {
      temperature: 0,
      water_level_cm: 0,
      soil_moisture: 0,
      light_intensity: 0,
    },
    status: {
      pump_on: false,
      water_empty: false,
    },
  });

  useEffect(() => {
    setMounted(true);

    // 1. ตั้งเวลาดึงรูปภาพทุก 30 วินาที
    fetchLatestImage(); // ดึงทันที 1 ครั้งเมื่อเปิดเว็บ
    const imageInterval = setInterval(fetchLatestImage, 30000);

    // 2. เชื่อมต่อ Firebase Realtime Database (ดึงเฉพาะค่า Sensor)
    const dataRef = ref(db, "/");
    const unsubscribe = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        
        setData({
          sensors: {
            temperature: val.sensors?.temperature || 0,
            water_level_cm: val.sensors?.water_level_cm || 0,
            soil_moisture: val.sensors?.soil_moisture || 0,
            light_intensity: val.sensors?.light_intensity || 0,
          },
          status: {
            pump_on: val.status?.pump_on || false,
            water_empty: val.status?.water_empty || false,
          },
        });
        
      }
    });

    return () => {
      clearInterval(imageInterval);
      unsubscribe(); // ยกเลิกการเชื่อมต่อ Firebase
    };
  }, []);

  // --- Handlers ---
  const togglePump = async () => {
    try {
      const newStatus = !data.status.pump_on;
      await set(ref(db, "status/pump_on"), newStatus);
    } catch (err) {
      console.error("Error toggling pump:", err);
    }
  };

  const handleAIAnalysis = async () => {
    if (!imageUrl || imageUrl.includes("unsplash")) {
        alert("Please wait for a real image from the camera.");
        return;
    }

    setAnalyzing(true);
    setAiResult(null);
    
    try {
      console.log("Sending to AI:", imageUrl);
      const result = await analyzePlantHealth(imageUrl); 

      if (result.success && result.analysis) {
        setAiResult(result.analysis);
      } else {
        setAiResult("ไม่สามารถวิเคราะห์ได้: " + result.error);
      }
    } catch (e) { 
        console.error(e);
        setAiResult("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI");
    } finally {
        setAnalyzing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
            Cactus Guardian
          </h1>
          <p className="text-neutral-400 text-sm mt-1 flex items-center gap-2">
            <RefreshCw size={14} className="text-green-500 animate-spin-slow" />
            Realtime System • Firebase Connected
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- LEFT COL: IMAGE + AI (เปลี่ยนจาก Video เป็น Image) --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl relative group">
            
            {/* Label */}
            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-2">
              <Camera size={14} className="text-blue-400" />
              LATEST CAPTURE
            </div>

            {/* Image Viewer */}
            <div className="aspect-video bg-neutral-950 flex items-center justify-center relative overflow-hidden" >
                <img
                  src={imageUrl}
                  alt="Cactus Latest"
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    console.error("Image failed to load:", imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
            </div>

            {/* AI Action Bar */}
            <div className="p-4 bg-neutral-800/50 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-sm text-neutral-400">AI Diagnostics</span>
              <button
                onClick={handleAIAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {analyzing ? "Analyzing..." : "Check Plant Health"}
              </button>
            </div>
          </div>

          {/* AI Result Card */}
          {aiResult && (
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                <Sparkles size={18} /> Gemini Assessment
              </h3>
              <p className="text-neutral-300 leading-relaxed text-sm">
                {aiResult}
              </p>
            </div>
          )}

          {/* Alerts Section */}
          {(data.sensors.soil_moisture < 25 || data.status.water_empty) && (
            <div className="space-y-2">
                {data.sensors.soil_moisture < 25 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="text-red-500 font-medium">Watering Required</h3>
                        <p className="text-red-400/80 text-sm mt-1">
                        Soil moisture is low ({data.sensors.soil_moisture}%).
                        </p>
                    </div>
                    </div>
                )}
                {data.status.water_empty && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-4">
                    <div className="p-2 bg-orange-500/20 rounded-lg text-orange-500">
                        <Droplets size={20} />
                    </div>
                    <div>
                        <h3 className="text-orange-500 font-medium">Water Tank Empty</h3>
                        <p className="text-orange-400/80 text-sm mt-1">
                        Please refill the water tank. Pump is disabled for safety.
                        </p>
                    </div>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* --- RIGHT COL: SENSORS (เชื่อมข้อมูลจริง) --- */}
        <div className="space-y-4">
          {/* Main Moisture Card */}
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Droplets size={120} />
            </div>
            <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-2">
              Soil Moisture
            </h3>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-bold text-white">
                {data.sensors.soil_moisture}
              </span>
              <span className="text-xl text-neutral-500 mb-1">%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  data.sensors.soil_moisture < 25 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${data.sensors.soil_moisture}%` }}
              />
            </div>
          </div>

          {/* Data Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-orange-400">
                <Thermometer size={18} />
                <span className="text-xs font-bold uppercase">Temp</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.sensors.temperature.toFixed(1)}°C
              </p>
            </div>

            {/* Water Level (Distance) */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-blue-400">
                <GlassWater size={18} />
                <span className="text-xs font-bold uppercase">Water Dist.</span>
              </div>
              <p className="text-2xl font-bold text-white">{data.sensors.water_level_cm} <span className="text-sm text-neutral-500">cm</span></p>
            </div>

            {/* Light */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Sun size={18} />
                  <span className="text-xs font-bold uppercase">Light</span>
                </div>
                <span className="text-xs text-neutral-500">
                  {data.sensors.light_intensity > 2000 ? "Bright" : "Dim"}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.sensors.light_intensity}{" "}
                <span className="text-sm text-neutral-500">Lux (ADC)</span>
              </p>
            </div>
          </div>

          {/* Pump Status Monitor */}
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-4">
              Pump Status
            </h3>
            <button
              onClick={togglePump}
              disabled={data.status.water_empty} // ห้ามกดถ้าน้ำหมด
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                data.status.pump_on
                  ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-750 hover:text-white"
              }`}
            >
              <Power size={20} />
              {data.status.pump_on ? "PUMP ACTIVE" : "PUMP OFF"}
            </button>
            <p className="text-center text-xs text-neutral-500 mt-2">
                {data.status.water_empty ? "Safety Lock: Water Tank Empty" : "Auto/Manual Control"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}