/*
 * GATEWAY MASTER UNIT (Final: 0.5s Pulse Mode for Manual & Auto)
 */
#include <esp_now.h>
#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <FirebaseESP32.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --- 1. ตั้งค่า WiFi & Firebase ---
#define WIFI_SSID "A55 ของ Nutthani"
#define WIFI_PASSWORD "0987654321"

// Token Telegram
#define TELEGRAM_TOKEN "8410649766:AAEgNutAQRD0c4In2nzko_8GK8sBpMP2oC8"
#define TELEGRAM_CHAT_ID "8198373938"

// Firebase
#define FIREBASE_HOST "cactus-b1455-default-rtdb.asia-southeast1.firebasedatabase.app" 
#define FIREBASE_AUTH "inkDCVd4iCDw4FvPwe2czUD5tkMfaBbDF2ZlRxa4" 

// --- 2. ตั้งค่าขาอุปกรณ์ ---
#define RELAY_PIN 26    
#define TRIG_PIN 5      
#define ECHO_PIN 18     
#define TEMP_PIN 4      

// --- 3. Config (แก้ตรงนี้) ---
const unsigned long WATERING_DURATION = 750;   // รดน้ำแค่ 0.5 วินาที (Pulse)
const unsigned long WATERING_COOLDOWN = 20000; // รอ 20 วินาที

// --- 4. ตัวแปรระบบ ---
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;

typedef struct struct_message {
  int light_pct;  
  int soil_pct;   
} struct_message;

struct_message incomingData;
bool isNodeConnected = false; 

unsigned long lastMsg = 0;          
unsigned long pumpStartTime = 0;    
unsigned long pumpFinishedTime = 0; 
bool isPumpOn = false;              
bool hasAlertedEmpty = false; 

// ตัวแปร Trigger
bool manualTrigger = false; // เก็บสถานะว่ามีการสั่ง Manual เข้ามา

// --- ฟังก์ชันส่ง Telegram ---
void sendTelegram(String message) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    message.replace(" ", "+");
    message.replace("\n", "%0A"); 
    
    // แก้ไข String Concatenation Error
    String url = String("https://api.telegram.org/bot") + TELEGRAM_TOKEN + "/sendMessage?chat_id=" + TELEGRAM_CHAT_ID + "&text=" + message;
    
    http.begin(client, url); 
    int httpCode = http.GET(); 
    
    if (httpCode > 0) {
      Serial.println(">> Telegram Sent");
    } else {
      Serial.println(">> Telegram Error: " + String(httpCode));
    }
    http.end();
  }
}

void OnDataRecv(const uint8_t * mac, const uint8_t *incomingDataPtr, int len) {
  memcpy(&incomingData, incomingDataPtr, sizeof(incomingData));
  isNodeConnected = true; 
}

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); 
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  sensors.begin();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected");

  sendTelegram("🟢 ระบบ Cactus Guardian (Pulse Mode 0.5s) Online!");

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(esp_now_recv_cb_t(OnDataRecv));

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  firebaseData.setResponseSize(1024);
}

void loop() {
  unsigned long currentMillis = millis();

  // --- 1. อ่านคำสั่ง Manual จาก Firebase ---
  if (Firebase.getBool(firebaseData, "/control/manual_pump")) {
    if (firebaseData.dataType() == "boolean") {
       bool cmd = firebaseData.boolData();
       // ถ้าเว็บสั่งเปิด (true) และปั๊มยังไม่ทำงาน -> รับทราบคำสั่ง
       if (cmd == true && !isPumpOn) {
         manualTrigger = true;
       }
    }
  }

  // --- 2. อ่านค่า Ultrasonic ---
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = duration * 0.034 / 2.0; 
  bool isWaterEmpty = (distance >= 6.0); // แก้ตามถังจริง

  if (isWaterEmpty && !hasAlertedEmpty) {
      sendTelegram("⚠️ น้ำหมดถัง!");
      hasAlertedEmpty = true; 
  } else if (!isWaterEmpty && hasAlertedEmpty) {
      sendTelegram("✅ เติมน้ำแล้ว");
      hasAlertedEmpty = false;
  }

  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  
  // ==========================================
  // LOGIC CONTROL (Unified 0.5s Pulse)
  // ==========================================

  // A. ความปลอดภัย: น้ำหมด -> ปิดตาย
  if (isWaterEmpty) {
      if (isPumpOn) {
         digitalWrite(RELAY_PIN, LOW); 
         isPumpOn = false;
         manualTrigger = false;
         // รีเซ็ตปุ่มใน Firebase ด้วย
         Firebase.setBool(firebaseData, "/control/manual_pump", false);
      }
  }
  else {
      // B. ถ้าปั๊มกำลังทำงานอยู่ -> รอเวลาปิด (0.5 วิ)
      if (isPumpOn) {
          if (currentMillis - pumpStartTime >= WATERING_DURATION) {
              Serial.println(">> Stop Pulse.");
              digitalWrite(RELAY_PIN, LOW);
              isPumpOn = false;
              pumpFinishedTime = currentMillis;

              // ถ้าเป็นการสั่งแบบ Manual -> ให้ไปตบสวิตช์ใน Firebase ลงด้วย (ปุ่มเด้งกลับ)
              if (manualTrigger) {
                  Firebase.setBool(firebaseData, "/control/manual_pump", false);
                  manualTrigger = false; 
                  sendTelegram("🛑 รดน้ำเสร็จสิ้น (สั่งเอง)");
              } else {
                  sendTelegram("🛑 รดน้ำเสร็จสิ้น (อัตโนมัติ)");
              }
          }
      }
      // C. ถ้าปั๊มดับอยู่ -> เช็คว่าต้องเปิดไหม?
      else {
          bool shouldStart = false;

          // 1. เช็ค Manual ก่อน
          if (manualTrigger) {
              Serial.println(">> Trigger: Manual Web");
              shouldStart = true;
              sendTelegram("🔴 สั่งรดน้ำจากเว็บ (0.5s)");
          }
          // 2. เช็ค Auto (ถ้าไม่มี Manual และเชื่อมต่อ Node ได้)
          else if (isNodeConnected && (currentMillis - pumpFinishedTime >= WATERING_COOLDOWN)) {
              if (incomingData.soil_pct < 25) {
                  Serial.println(">> Trigger: Auto Soil Dry");
                  shouldStart = true;
                  sendTelegram("💧 ดินแห้ง เริ่มรดน้ำ (0.5s)");
              }
          }

          // สั่งเปิดปั๊ม
          if (shouldStart) {
              digitalWrite(RELAY_PIN, HIGH);
              isPumpOn = true;
              pumpStartTime = currentMillis;
          }
      }
  }

  // --- Display ---
  static unsigned long lastPrint = 0;
  if (currentMillis - lastPrint > 1000) {
    lastPrint = currentMillis;
    Serial.print("Pump: "); Serial.println(isPumpOn ? "ON" : "OFF");
  }

  // --- Firebase Upload ---
  if (currentMillis - lastMsg > 3000) {
    lastMsg = currentMillis;
    
    Firebase.setFloat(firebaseData, "/sensors/temperature", tempC);
    Firebase.setFloat(firebaseData, "/sensors/water_level_cm", distance);
    Firebase.setBool(firebaseData, "/status/pump_on", isPumpOn);
    Firebase.setBool(firebaseData, "/status/water_empty", isWaterEmpty);

    if(isNodeConnected) {
      Firebase.setInt(firebaseData, "/sensors/soil_moisture", incomingData.soil_pct);
      Firebase.setInt(firebaseData, "/sensors/light_intensity", incomingData.light_pct);
    } else {
      Firebase.setInt(firebaseData, "/sensors/soil_moisture", 0);
      Firebase.setInt(firebaseData, "/sensors/light_intensity", 0);
    }
  }

  delay(10); 
}