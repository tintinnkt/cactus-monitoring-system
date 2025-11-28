"use client";

import React, { useState, useEffect } from "react";
import {
  Droplets,
  Sun,
  Thermometer,
  Wind,
  Video,
  Activity,
  Power,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./lib/firebase"; // Import your firebase config
import { analyzePlantHealth } from "./actions";

// --- Types ---
interface SensorData {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  lightLevel: number;
  isPumpOn: boolean;
  lastUpdated: any; // Firestore Timestamp
}

export default function CactusDashboard() {
  const [mounted, setMounted] = useState(false);
  const [camIp, setCamIp] = useState<string>("192.168.1.100");
  const [isStreamActive, setIsStreamActive] = useState(false);

  // AI States
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Default Data
  const [data, setData] = useState<SensorData>({
    soilMoisture: 0,
    temperature: 0,
    humidity: 0,
    lightLevel: 0,
    isPumpOn: false,
    lastUpdated: null,
  });

  useEffect(() => {
    setMounted(true);

    // --- REAL FIREBASE CONNECTION ---
    // Assuming you have a collection "esp32_data" and document "sensors"
    const unsub = onSnapshot(doc(db, "esp32_data", "sensors"), (doc) => {
      if (doc.exists()) {
        const remoteData = doc.data() as SensorData;
        setData(remoteData);
      }
    });

    return () => unsub();
  }, []);

  // --- Handlers ---
  const togglePump = async () => {
    try {
      // Optimistic update (update UI instantly)
      setData((prev) => ({ ...prev, isPumpOn: !prev.isPumpOn }));

      // Update Firebase (ESP32 will read this)
      await updateDoc(doc(db, "esp32_data", "sensors"), {
        isPumpOn: !data.isPumpOn,
      });
    } catch (err) {
      console.error("Error toggling pump:", err);
    }
  };

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    setAiResult(null);
    try {
      // 1. Fetch image from ESP32 Local IP (Client Side)
      // Note: Using /capture for high-res still
      const res = await fetch(`http://${camIp}/capture`);
      const blob = await res.blob();

      // 2. Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // 3. Send to Server Action
        const result = await analyzePlantHealth(base64data);
        if (result.success) {
          setAiResult(result.analysis || "No result text");
        } else {
          setAiResult("Error: " + result.error);
        }
        setAnalyzing(false);
      };
    } catch (e) {
      setAiResult(
        "Error: Could not connect to Camera IP. Make sure you are on the same WiFi."
      );
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
            <Activity size={14} className="text-green-500" />
            System Online • Last Sync:{" "}
            {data.lastUpdated?.toDate
              ? data.lastUpdated.toDate().toLocaleTimeString()
              : "Waiting..."}
          </p>
        </div>

        {/* IP Config */}
        <div className="flex gap-2">
          <input
            type="text"
            value={camIp}
            onChange={(e) => setCamIp(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 w-32"
            placeholder="ESP32 IP"
          />
          <button
            onClick={() => window.location.reload()}
            className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 text-neutral-400"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COL: CAMERA + AI --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl relative group">
            {/* Live Label */}
            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-2">
              <Video size={12} className="text-red-500 animate-pulse" />
              LIVE FEED
            </div>

            {/* Video Feed */}
            <div className="aspect-video bg-neutral-950 flex items-center justify-center relative">
              {isStreamActive ? (
                // Use built-in Proxy or direct IP if local
                <img
                  src={`http://${camIp}:81/stream`}
                  alt="Cactus Live Feed"
                  className="w-full h-full object-cover"
                  onError={() => setIsStreamActive(false)}
                />
              ) : (
                <div className="text-center p-8">
                  <p className="text-neutral-400 mb-4">Stream is paused</p>
                  <button
                    onClick={() => setIsStreamActive(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-medium"
                  >
                    Connect Camera
                  </button>
                </div>
              )}
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

          {/* AI Result Card (Only shows if result exists) */}
          {aiResult && (
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6">
              <h3 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                <Sparkles size={18} /> Gemini Assessment
              </h3>
              <p className="text-neutral-300 leading-relaxed text-sm">
                {aiResult}
              </p>
            </div>
          )}

          {/* Low Moisture Alert */}
          {data.soilMoisture < 30 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-red-500 font-medium">Watering Required</h3>
                <p className="text-red-400/80 text-sm mt-1">
                  Soil moisture is critically low ({data.soilMoisture}%).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* --- RIGHT COL: SENSORS --- */}
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
                {data.soilMoisture}
              </span>
              <span className="text-xl text-neutral-500 mb-1">%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  data.soilMoisture < 30 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${data.soilMoisture}%` }}
              />
            </div>
          </div>

          {/* Data Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-orange-400">
                <Thermometer size={18} />
                <span className="text-xs font-bold uppercase">Temp</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.temperature}°C
              </p>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-blue-400">
                <Wind size={18} />
                <span className="text-xs font-bold uppercase">Humidity</span>
              </div>
              <p className="text-2xl font-bold text-white">{data.humidity}%</p>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Sun size={18} />
                  <span className="text-xs font-bold uppercase">Light</span>
                </div>
                <span className="text-xs text-neutral-500">
                  {data.lightLevel > 2000 ? "High" : "Low"}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.lightLevel}{" "}
                <span className="text-sm text-neutral-500">Lux</span>
              </p>
            </div>
          </div>

          {/* Pump Control */}
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-4">
              Manual Control
            </h3>
            <button
              onClick={togglePump}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all ${
                data.isPumpOn
                  ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-750 hover:text-white"
              }`}
            >
              <Power size={20} />
              {data.isPumpOn ? "PUMP ACTIVE" : "START WATERING"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
