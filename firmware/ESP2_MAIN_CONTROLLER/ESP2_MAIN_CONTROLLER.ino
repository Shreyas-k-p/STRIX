/**
 * ============================================================================
 * STRIX RECON ROVER - ESP2 MAIN CONTROLLER & HOTSPOT GATEWAY
 * ============================================================================
 * 
 * Hardware Target : ESP32 DevKit V1 (ESP32-WROOM-32)
 * WiFi Mode       : Access Point (AP)
 * AP SSID         : ESP2_ROVER
 * AP Password     : 12345678
 * AP IP           : 192.168.4.1
 * WebSocket Server: Port 81 (Laptop Ground Control Station Web App)
 * TCP Server      : Port 82 (ESP32-S3 Camera Diagnostics & Link)
 * Hardware UART2  : RX2=GPIO16, TX2=GPIO17 (Bridge to ESP1 Sensors & Servo)
 *
 * MOTOR CONTROL (L298N):
 *   LEFT WHEELS  : ENA = GPIO 33 (PWM), IN1 = GPIO 32, IN2 = GPIO 23
 *   RIGHT WHEELS : ENB = GPIO 22 (PWM), IN3 = GPIO 21, IN4 = GPIO 19
 *
 * RELAYS (ACTIVE LOW):
 *   Relay 1 = GPIO 4  (Headlights)
 *   Relay 2 = GPIO 15 (Aux 12V)
 *   Relay 3 = GPIO 18 (Sensor Heater)
 *   Relay 4 = GPIO 5  (Payload Disarm)
 *
 * ESP1 UART CONNECTION:
 *   ESP2 GPIO16 (RX) <--- ESP1 GPIO26 (TX)
 *   ESP2 GPIO17 (TX) ---> ESP1 GPIO25 (RX)
 *   GND              <---> GND
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================
const char* AP_SSID         = "ESP2_ROVER";
const char* AP_PASSWORD     = "12345678";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_GATEWAY(192, 168, 4, 1);
const IPAddress AP_SUBNET(255, 255, 255, 0);

const uint16_t WS_PORT       = 81;
const uint16_t S3_TCP_PORT   = 82;

WebSocketsServer wsServer(WS_PORT);
WiFiServer s3TcpServer(S3_TCP_PORT);
WiFiClient s3Client;

// ============================================================================
// GPIO PIN DEFINITIONS
// ============================================================================
// Left Motors (ENA, IN1, IN2)
const int PIN_ENA = 33;
const int PIN_IN1 = 32;
const int PIN_IN2 = 23;

// Right Motors (ENB, IN3, IN4)
const int PIN_ENB = 22;
const int PIN_IN3 = 21;
const int PIN_IN4 = 19;

// Relays (Active LOW: LOW = ON, HIGH = OFF)
const int PIN_RELAY1 = 4;
const int PIN_RELAY2 = 15;
const int PIN_RELAY3 = 18;
const int PIN_RELAY4 = 5;

// PWM Channels for Motor Speed Control
const int PWM_CH_LEFT  = 2;
const int PWM_CH_RIGHT = 3;
const int PWM_FREQ     = 20000;
const int PWM_RES      = 8; // 8-bit resolution: 0 - 255

// Global Motor Speed target
int currentSpeed = 180;
String currentDirection = "STOP";

// ============================================================================
// HARDWARE INITIALIZATION
// ============================================================================
void initMotors() {
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);

  // Setup PWM for speed pins ENA & ENB
  ledcSetup(PWM_CH_LEFT, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_ENA, PWM_CH_LEFT);
  ledcWrite(PWM_CH_LEFT, 0);

  ledcSetup(PWM_CH_RIGHT, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_ENB, PWM_CH_RIGHT);
  ledcWrite(PWM_CH_RIGHT, 0);
}

void initRelays() {
  // Relays are ACTIVE LOW: HIGH = DE-ENERGIZED (OFF)
  pinMode(PIN_RELAY1, OUTPUT);
  digitalWrite(PIN_RELAY1, HIGH);

  pinMode(PIN_RELAY2, OUTPUT);
  digitalWrite(PIN_RELAY2, HIGH);

  pinMode(PIN_RELAY3, OUTPUT);
  digitalWrite(PIN_RELAY3, HIGH);

  pinMode(PIN_RELAY4, OUTPUT);
  digitalWrite(PIN_RELAY4, HIGH);
}

// ============================================================================
// MOTOR CONTROL LOGIC
// ============================================================================
void setMotors(String dir, int speed) {
  speed = constrain(speed, 0, 255);
  currentSpeed = speed;
  currentDirection = dir;

  if (dir == "FORWARD") {
    // Left FWD, Right FWD
    digitalWrite(PIN_IN1, HIGH);
    digitalWrite(PIN_IN2, LOW);
    digitalWrite(PIN_IN3, HIGH);
    digitalWrite(PIN_IN4, LOW);
    ledcWrite(PWM_CH_LEFT, speed);
    ledcWrite(PWM_CH_RIGHT, speed);
  } else if (dir == "BACKWARD") {
    // Left REV, Right REV
    digitalWrite(PIN_IN1, LOW);
    digitalWrite(PIN_IN2, HIGH);
    digitalWrite(PIN_IN3, LOW);
    digitalWrite(PIN_IN4, HIGH);
    ledcWrite(PWM_CH_LEFT, speed);
    ledcWrite(PWM_CH_RIGHT, speed);
  } else if (dir == "LEFT") {
    // Left REV, Right FWD (Skid-steer Left)
    digitalWrite(PIN_IN1, LOW);
    digitalWrite(PIN_IN2, HIGH);
    digitalWrite(PIN_IN3, HIGH);
    digitalWrite(PIN_IN4, LOW);
    ledcWrite(PWM_CH_LEFT, speed);
    ledcWrite(PWM_CH_RIGHT, speed);
  } else if (dir == "RIGHT") {
    // Left FWD, Right REV (Skid-steer Right)
    digitalWrite(PIN_IN1, HIGH);
    digitalWrite(PIN_IN2, LOW);
    digitalWrite(PIN_IN3, LOW);
    digitalWrite(PIN_IN4, HIGH);
    ledcWrite(PWM_CH_LEFT, speed);
    ledcWrite(PWM_CH_RIGHT, speed);
  } else {
    // STOP
    digitalWrite(PIN_IN1, LOW);
    digitalWrite(PIN_IN2, LOW);
    digitalWrite(PIN_IN3, LOW);
    digitalWrite(PIN_IN4, LOW);
    ledcWrite(PWM_CH_LEFT, 0);
    ledcWrite(PWM_CH_RIGHT, 0);
    currentDirection = "STOP";
  }

  // Broadcast motor status telemetry to Web App
  String statusPacket = "STATUS|MOTOR|" + currentDirection + "|" + String(currentSpeed);
  wsServer.broadcastTXT(statusPacket);
}

// ============================================================================
// RELAY CONTROL LOGIC
// ============================================================================
void setRelay(int channel, bool state) {
  // state: true = ON (drive pin LOW), false = OFF (drive pin HIGH)
  int pin = -1;
  if (channel == 1) pin = PIN_RELAY1;
  else if (channel == 2) pin = PIN_RELAY2;
  else if (channel == 3) pin = PIN_RELAY3;
  else if (channel == 4) pin = PIN_RELAY4;

  if (pin != -1) {
    digitalWrite(pin, state ? LOW : HIGH);
    Serial.printf("[RELAY] Channel %d set to %s (Pin %d = %s)\n", 
      channel, state ? "ON" : "OFF", pin, state ? "LOW" : "HIGH");
    
    String ack = "STATUS|RELAY|" + String(channel) + "|" + (state ? "1" : "0");
    wsServer.broadcastTXT(ack);
  }
}

// ============================================================================
// COMMAND PARSER (FROM WEB APP)
// ============================================================================
void processCommand(uint8_t clientNum, String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  Serial.printf("[WEB APP -> ESP2] %s\n", cmd.c_str());

  if (cmd == "PING" || cmd == "CMD|PING") {
    wsServer.sendTXT(clientNum, "ACK|PING");
    return;
  }

  if (cmd.startsWith("CMD|MOTOR|")) {
    // Expected formats: CMD|MOTOR|FORWARD|180 or CMD|MOTOR|STOP
    int firstPipe = cmd.indexOf('|', 10);
    if (firstPipe == -1) {
      String action = cmd.substring(10);
      setMotors(action, currentSpeed);
    } else {
      String action = cmd.substring(10, firstPipe);
      int speed = cmd.substring(firstPipe + 1).toInt();
      setMotors(action, speed);
    }
    wsServer.sendTXT(clientNum, "ACK|MOTOR|" + currentDirection);
    return;
  }

  if (cmd.startsWith("CMD|RELAY|")) {
    // Format: CMD|RELAY|<channel>|<state>
    // e.g. CMD|RELAY|1|1 (ON) or CMD|RELAY|1|0 (OFF)
    int firstPipe = cmd.indexOf('|', 10);
    if (firstPipe != -1) {
      int channel = cmd.substring(10, firstPipe).toInt();
      int state = cmd.substring(firstPipe + 1).toInt();
      setRelay(channel, state == 1);
      wsServer.sendTXT(clientNum, "ACK|RELAY|" + String(channel) + "|" + String(state));
      return;
    }
  }

  // Forward Servo commands directly to ESP1 via UART2
  if (cmd.startsWith("CMD|SERVO|")) {
    Serial2.println(cmd);
    Serial.printf("[ESP2 -> ESP1 UART] %s\n", cmd.c_str());
    wsServer.sendTXT(clientNum, "ACK|SERVO|FORWARDED");
    return;
  }

  // Generic fallback: pass down to ESP1 if applicable
  Serial2.println(cmd);
  wsServer.sendTXT(clientNum, "ACK|FORWARDED|" + cmd);
}

// ============================================================================
// WEBSOCKET SERVER EVENT HANDLER
// ============================================================================
void onWebSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = wsServer.remoteIP(clientNum);
      Serial.println("\nWEB APP CONNECTED");
      Serial.printf("Client IP: %s (Client ID #%u)\n", ip.toString().c_str(), clientNum);
      
      // Welcome handshake & sync status
      wsServer.sendTXT(clientNum, "ESP2_CONNECTED");
      wsServer.sendTXT(clientNum, "STATUS|LINK|ESP2_WIFI|CONNECTED");
      wsServer.sendTXT(clientNum, "STATUS|MOTOR|" + currentDirection + "|" + String(currentSpeed));
      break;
    }
    case WStype_DISCONNECTED: {
      Serial.printf("WEB APP DISCONNECTED (Client ID #%u)\n", clientNum);
      break;
    }
    case WStype_TEXT: {
      String msg;
      for (size_t i = 0; i < length; i++) msg += (char)payload[i];
      processCommand(clientNum, msg);
      break;
    }
    default:
      break;
  }
}

// ============================================================================
// ESP1 SENSOR TELEMETRY BRIDGE (UART2)
// ============================================================================
void processEsp1Uart() {
  while (Serial2.available()) {
    String sensorLine = Serial2.readStringUntil('\n');
    sensorLine.trim();
    if (sensorLine.length() > 0) {
      // Forward sensor packets (DATA_MULTI, DHT, ULTRASONIC, MQ135) directly to Web App
      wsServer.broadcastTXT(sensorLine);
    }
  }
}

// ============================================================================
// ESP32-S3 TCP SERVER HANDLER (PORT 82)
// ============================================================================
void processS3Tcp() {
  // Check for new incoming S3 connection
  if (s3TcpServer.hasClient()) {
    if (!s3Client || !s3Client.connected()) {
      if (s3Client) s3Client.stop();
      s3Client = s3TcpServer.available();
      Serial.println("\nESP32-S3 CONNECTED");
      Serial.printf("S3 IP: %s\n", s3Client.remoteIP().toString().c_str());
      
      // Send handshake acknowledgment
      s3Client.println("ACK|S3_TCP_ACCEPTED");
    } else {
      // Reject duplicate connections
      WiFiClient rejectClient = s3TcpServer.available();
      rejectClient.stop();
    }
  }

  // Read status messages sent by ESP32-S3
  if (s3Client && s3Client.connected()) {
    while (s3Client.available()) {
      String s3Msg = s3Client.readStringUntil('\n');
      s3Msg.trim();
      if (s3Msg.length() > 0) {
        Serial.printf("[S3 -> ESP2] %s\n", s3Msg.c_str());
        // Forward camera diagnostic status directly to Web App
        wsServer.broadcastTXT(s3Msg);
      }
    }
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize Hardware UART2 for ESP1 communication (RX: 16, TX: 17)
  Serial2.begin(115200, SERIAL_8N1, 16, 17);

  // Initialize motor and relay pins
  initMotors();
  initRelays();

  // Configure Wi-Fi Access Point mode
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
  WiFi.softAP(AP_SSID, AP_PASSWORD, 1, 0, 4); // Channel 1, non-hidden, max 4 clients

  // Start WebSocket Server on port 81
  wsServer.begin();
  wsServer.onEvent(onWebSocketEvent);

  // Start TCP Server on port 82 for ESP32-S3
  s3TcpServer.begin();
  s3TcpServer.setNoDelay(true);

  // Print Clean Diagnostics to Serial Monitor
  Serial.println("\n================================================");
  Serial.println("ESP2 MAIN CONTROLLER");
  Serial.println("================================================");
  Serial.printf("HOTSPOT SSID : %s\n", AP_SSID);
  Serial.printf("PASSWORD     : %s\n", AP_PASSWORD);
  Serial.printf("ESP2 IP      : %s\n", WiFi.softAPIP().toString().c_str());
  Serial.println("\nWEB APP:");
  Serial.printf("ws://%s:%u\n", WiFi.softAPIP().toString().c_str(), WS_PORT);
  Serial.println("\nESP32-S3:");
  Serial.printf("TCP -> %s:%u\n", WiFi.softAPIP().toString().c_str(), S3_TCP_PORT);
  Serial.println("\nWAITING FOR DEVICES...");
  Serial.println("------------------------------------------------");
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // 1. Service WebSocket Clients (Web App)
  wsServer.loop();

  // 2. Service ESP32-S3 TCP Client
  processS3Tcp();

  // 3. Service UART2 Data from ESP1 Sensors
  processEsp1Uart();

  delay(2);
}
