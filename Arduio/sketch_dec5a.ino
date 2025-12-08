#include <WiFi.h>
#include "esp_camera.h"
#include "HTTPClient.h"
#include "soc/soc.h"           // Disable brownout problems
#include "soc/rtc_cntl_reg.h"  // Disable brownout problems
#include <base64.h>            // ใช้ Library ติดเครื่อง ESP32

// --- 1. ตั้งค่า WiFi ---
const char* ssid = "A55 ของ Nutthani";        // ใส่ชื่อ WiFi
const char* password = "0987654321";    // ใส่รหัส WiFi

// --- 2. ใส่ URL ของ Google Script ---
String myScript = "https://script.google.com/macros/s/AKfycbzXiQGg3_ruWY2dBjAN8ShG3ad5FPfDSUeR_hgxulztO8KFwYcy2IYVdghBdcydHsQsVQ/exec";

// --- Config กล้อง (AI Thinker) ---
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ประกาศหัวข้อฟังก์ชันล่วงหน้า (Function Prototype) แก้ปัญหา 'not declared'
void captureAndSend();

void setup() {
  // ปิด Brownout Detector (แก้ปัญหาไฟตกแล้วรีเซ็ต)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  // ตั้งค่ากล้อง
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // *** สำคัญ: ต้องใช้ QVGA (320x240) เพื่อกันเมมเต็ม ***
  config.frame_size = FRAMESIZE_QVGA; 
  config.jpeg_quality = 12; 
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    return;
  }
}

void loop() {
  captureAndSend();
  // ส่งทุกๆ 1 นาที (60 วินาที)
  delay(60000); 
}

void captureAndSend() {
  Serial.println("Taking picture...");
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  Serial.println("Processing Image...");
  
  // --- 1. แปลงรูปเป็น Base64 ---
  String base64Image = base64::encode(fb->buf, fb->len);
  
  // เคลียร์ buffer กล้องทันที
  esp_camera_fb_return(fb); 

  // --- 2. สร้างข้อมูลที่จะส่ง (Payload) ---
  String payload = base64Image;
  
  Serial.print("Image Size: "); Serial.println(payload.length());
  Serial.println("Sending to Google Script...");

  // --- 3. ส่งขึ้น Google Apps Script ---
  HTTPClient http;
  
  http.setConnectTimeout(30000); // รอเชื่อมต่อ 30 วินาที
  http.setTimeout(60000);        // รอคำตอบจาก Google 30 วินาที (แก้ Error -11 ตรงนี้)
  
  http.begin(myScript);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "text/plain");

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("✅ Success! Image URL:");
    Serial.println(response); 
  } else {
    Serial.printf("❌ HTTP Failed: %d\n", httpCode);
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}