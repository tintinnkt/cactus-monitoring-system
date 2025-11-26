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
} from "lucide-react";

// --- Types ---
interface SensorData {
  soilMoisture: number; // 0-100%
  temperature: number; // Celsius
  humidity: number; // %
  lightLevel: number; // 0-4095 or 0-100
  isPumpOn: boolean;
  lastUpdated: Date;
}

export default function CactusDashboard() {
  // --- State ---
  const [mounted, setMounted] = useState(false);
  const [camIp, setCamIp] = useState<string>("192.168.1.100"); // Default ESP32 IP
  const [isStreamActive, setIsStreamActive] = useState(false);

  // Simulated Sensor Data (Replace this with real API calls later)
  const [data, setData] = useState<SensorData>({
    soilMoisture: 45,
    temperature: 28.5,
    humidity: 60,
    lightLevel: 800,
    isPumpOn: false,
    lastUpdated: new Date(),
  });

  // Hydration fix for Next.js
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Mock Data Simulation (Remove this useEffect when connecting real API) ---
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => ({
        ...prev,
        soilMoisture: Math.min(
          100,
          Math.max(0, prev.soilMoisture + (Math.random() * 4 - 2))
        ),
        temperature: parseFloat(
          (prev.temperature + (Math.random() * 0.4 - 0.2)).toFixed(1)
        ),
        lightLevel: Math.max(
          0,
          prev.lightLevel + Math.floor(Math.random() * 50 - 25)
        ),
        lastUpdated: new Date(),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---
  const togglePump = () => {
    // Here you would send a POST request to your ESP32 or Cloud
    setData((prev) => ({ ...prev, isPumpOn: !prev.isPumpOn }));
    console.log("Toggling Pump:", !data.isPumpOn);
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
            System Online • Last updated:{" "}
            {data.lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Camera IP Input for quick testing */}
          <input
            type="text"
            value={camIp}
            onChange={(e) => setCamIp(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 w-32 focus:outline-none focus:border-green-500 transition-colors"
            placeholder="ESP32 IP"
          />
          <button
            onClick={() => window.location.reload()}
            className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors text-neutral-400 hover:text-white"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Camera Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl relative group">
            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-2">
              <Video size={12} className="text-red-500 animate-pulse" />
              LIVE FEED
            </div>

            {/* Camera Viewport */}
            <div className="aspect-video bg-neutral-950 flex items-center justify-center relative">
              {isStreamActive ? (
                // Use standard MJPEG stream URL pattern for ESP32-CAM
                <img
                  src={`http://${camIp}:81/stream`}
                  alt="Cactus Live Feed"
                  className="w-full h-full object-cover"
                  onError={() => setIsStreamActive(false)}
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-600">
                    <Video size={32} />
                  </div>
                  <p className="text-neutral-400 mb-4">
                    Stream is currently paused or offline
                  </p>
                  <button
                    onClick={() => setIsStreamActive(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-medium transition-all transform hover:scale-105 active:scale-95"
                  >
                    Connect Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Alert Banner Example */}
          {data.soilMoisture < 30 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-red-500 font-medium">
                  Low Moisture Detected
                </h3>
                <p className="text-red-400/80 text-sm mt-1">
                  Soil moisture is below 30%. The system recommends watering
                  immediately.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sensor Data */}
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
                {data.soilMoisture.toFixed(0)}
              </span>
              <span className="text-xl text-neutral-500 mb-1">%</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  data.soilMoisture < 30 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${data.soilMoisture}%` }}
              />
            </div>
          </div>

          {/* Grid for other sensors */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-orange-400">
                <Thermometer size={18} />
                <span className="text-xs font-bold uppercase">Temp</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.temperature}°C
              </p>
            </div>

            {/* Humidity */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2 text-blue-400">
                <Wind size={18} />
                <span className="text-xs font-bold uppercase">Humidity</span>
              </div>
              <p className="text-2xl font-bold text-white">{data.humidity}%</p>
            </div>

            {/* Light */}
            <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Sun size={18} />
                  <span className="text-xs font-bold uppercase">
                    Light Intensity
                  </span>
                </div>
                <span className="text-xs text-neutral-500">
                  {data.lightLevel > 2000 ? "Bright" : "Dim"}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-2">
                {data.lightLevel}{" "}
                <span className="text-sm text-neutral-500 font-normal">
                  Lux
                </span>
              </p>
            </div>
          </div>

          {/* Control Actions */}
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
