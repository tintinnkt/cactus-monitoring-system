#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>

// --- การตั้งค่าขา (Pin Definitions) ---
const int LDR_PIN = 34;       
const int SOIL_PIN = 35;      

// --- ⚠️ MAC Address ของ Gateway ---
uint8_t broadcastAddress[] = {0x88, 0x13, 0xBF, 0x0C, 0x0F, 0xA8}; 

// --- โครงสร้างข้อมูล ---
typedef struct struct_message {
  int light_pct;
  int soil_pct;
} struct_message;

struct_message myData;

// ฟังก์ชัน Callback
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("\r\nLast Packet Send Status:\t");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Success ✅" : "Fail ❌");
}

void setup() {
  Serial.begin(115200);
  
  pinMode(LDR_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);
  
  // 1. ตั้งค่าโหมด WiFi ก่อน
  WiFi.mode(WIFI_STA);

  // 2. ล็อคช่องสัญญาณที่ 1 (Channel Fix)
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(6, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  // 3. เริ่มต้น ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  esp_now_register_send_cb(OnDataSent);

  // 4. ลงทะเบียน Peer (แก้ไขจุดที่ Error ตรงนี้)
  esp_now_peer_info_t peerInfo;
  
  // ล้างค่าขยะในตัวแปรให้สะอาดก่อน (สำคัญ)
  memset(&peerInfo, 0, sizeof(peerInfo)); 

  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = 0;  
  peerInfo.encrypt = false;
  
  // +++ เพิ่มบรรทัดนี้เพื่อแก้ Error "Peer interface is invalid" +++
  peerInfo.ifidx = WIFI_IF_STA; 
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    Serial.println("Failed to add peer");
    return;
  }
  
  Serial.println("--- Node Unit Ready (Sender) ---");
}

void loop() {
  int lightValue = analogRead(LDR_PIN);
  int soilValue = analogRead(SOIL_PIN);

  int lightPercent = map(lightValue, 4095, 0, 0, 100); 
  int soilPercent = map(soilValue, 4095, 0, 0, 100); 

  lightPercent = constrain(lightPercent, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  myData.light_pct = lightPercent;
  myData.soil_pct = soilPercent;

  esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *) &myData, sizeof(myData));

  Serial.print("Sending -> Light: "); Serial.print(lightPercent);
  Serial.print("% | Soil: "); Serial.print(soilPercent);
  Serial.println("%");

  delay(2000); 
}