// esp32-firmware/main.cpp
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// WiFi Credentials - CHANGE THESE
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker - Use local Mosquitto or HiveMQ Cloud
const char* mqtt_server = "192.168.1.100";   // Change to your broker IP or "broker.hivemq.com"
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// Sensor Pins
const int CURRENT_PIN = 34;   // ACS712
const int VOLTAGE_PIN = 35;   // ZMPT101B

// Calibration values (adjust after testing)
float currentSensitivity = 0.185;  // For 5A version of ACS712 → change if using 20A
float voltageCalibration = 0.95;   // Adjust based on multimeter comparison

void setup() {
  Serial.begin(115200);
  pinMode(CURRENT_PIN, INPUT);
  pinMode(VOLTAGE_PIN, INPUT);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  client.setServer(mqtt_server, mqtt_port);
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT connected");
    } else {
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read sensors
  float currentRaw = analogRead(CURRENT_PIN);
  float voltageRaw = analogRead(VOLTAGE_PIN);

  // Convert to real values
  float current = (currentRaw - 2048) * currentSensitivity;  // Center at 2.5V (2048 on 12-bit ADC)
  float voltage = voltageRaw * (3.3 / 4095.0) * 110.0 * voltageCalibration; // Adjust multiplier for ZMPT101B

  float power = voltage * current;                     // Approximate power
  static float energyKwh = 0.0;
  energyKwh += power * 0.01 / 3600000.0;               // 10ms interval → accumulate kWh

  // Create JSON payload
  String payload = "{\"timestamp\":" + String(millis()) +
                   ",\"current\":" + String(current, 2) +
                   ",\"voltage\":" + String(voltage, 2) +
                   ",\"power\":" + String(power, 2) +
                   ",\"energy_kwh\":" + String(energyKwh, 4) + "}";

  // Publish to MQTT
  client.publish("mmu/energy/data", payload.c_str());

  Serial.println(payload);
  delay(1000);   // Publish every 1 second (change to 10s if needed)
}