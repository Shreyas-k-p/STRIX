#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <ESPmDNS.h>

const char* WIFI_SSID = "REY";
const char* WIFI_PASSWORD = "REY22222";
const char* HOSTNAME = "rover-esp2";
const uint16_t WS_PORT = 81;

WebServer httpServer(80);
WebSocketsServer wsServer(WS_PORT);

void sendStatus(uint8_t client) {
  String msg = "STATUS|LINK|ESP2_WIFI|CONNECTED|" + String(WiFi.RSSI());
  wsServer.sendTXT(client, msg);
}

void handleRoot() {
  String body = "ROVER ESP2 ONLINE\n";
  body += "SSID: " + String(WIFI_SSID) + "\n";
  body += "IP: " + WiFi.localIP().toString() + "\n";
  body += "Hostname: " + String(HOSTNAME) + ".local\n";
  body += "WebSocket: ws://" + String(HOSTNAME) + ".local:81\n";
  httpServer.send(200, "text/plain", body);
}

void onWebSocket(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("Web App connected: client %u\n", client);
    wsServer.sendTXT(client, "ESP2_CONNECTED");
    sendStatus(client);
    return;
  }

  if (type == WStype_DISCONNECTED) {
    Serial.printf("Web App disconnected: client %u\n", client);
    return;
  }

  if (type != WStype_TEXT) return;

  String cmd;
  for (size_t i = 0; i < length; ++i) cmd += (char)payload[i];
  cmd.trim();

  Serial.print("WEB APP -> ESP2: ");
  Serial.println(cmd);

  if (cmd == "PING" || cmd == "CMD|PING") {
    wsServer.sendTXT(client, "ACK|PING");
    return;
  }

  if (cmd == "STATUS") {
    wsServer.sendTXT(client, "STATUS|LINK|ESP2_WIFI|CONNECTED|" + String(WiFi.RSSI()));
    return;
  }

  // Phase-1 test: echo commands back so the Web App can verify transport.
  // Motor/relay/servo hardware will be connected in the next phase.
  if (cmd.startsWith("CMD|")) {
    wsServer.sendTXT(client, "ACK|RECEIVED|" + cmd.substring(4));
    return;
  }

  wsServer.sendTXT(client, "ESP2_RECEIVED|" + cmd);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WIFI FAILED - check hotspot SSID/password and 2.4 GHz mode");
    return;
  }

  Serial.println("WIFI CONNECTED");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());

  if (MDNS.begin(HOSTNAME)) {
    Serial.print("mDNS: http://");
    Serial.print(HOSTNAME);
    Serial.println(".local");
  } else {
    Serial.println("mDNS start failed");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("==============================");
  Serial.println("ROVER ESP2 - WIFI WEBSOCKET");
  Serial.println("ESP32 DEVKIT V1");
  Serial.println("==============================");

  connectWiFi();

  httpServer.on("/", handleRoot);
  httpServer.begin();

  wsServer.begin();
  wsServer.onEvent(onWebSocket);

  Serial.println("WebSocket server: port 81");
  Serial.println("ESP2 READY");
}

void loop() {
  httpServer.handleClient();
  wsServer.loop();

  if (WiFi.status() != WL_CONNECTED) {
    static uint32_t lastRetry = 0;
    if (millis() - lastRetry > 5000) {
      lastRetry = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
}