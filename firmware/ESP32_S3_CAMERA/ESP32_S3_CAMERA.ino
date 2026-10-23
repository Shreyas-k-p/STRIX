/**
 * ============================================================================
 * STRIX RECON ROVER - ESP32-S3 LOW-LATENCY CAMERA CLIENT
 * ============================================================================
 * 
 * Hardware Target : ESP32-S3 Dev Module
 * Sensor          : OmniVision OV3660
 * Network Mode    : STA (Station) connecting to ESP2_ROVER Access Point
 * Stream Service  : Low-latency MJPEG over HTTP (port 80)
 * Telemetry Link  : Persistent TCP Client to ESP2 Main Controller (192.168.4.1:82)
 *
 * OV3660 PINOUT (ESP32-S3):
 *   PWDN   = -1
 *   RESET  = -1
 *   XCLK   = GPIO 15
 *   SIOD   = GPIO 4
 *   SIOC   = GPIO 5
 *   Y9     = GPIO 16
 *   Y8     = GPIO 17
 *   Y7     = GPIO 18
 *   Y6     = GPIO 12
 *   Y5     = GPIO 10
 *   Y4     = GPIO 8
 *   Y3     = GPIO 9
 *   Y2     = GPIO 11
 *   VSYNC  = GPIO 6
 *   HREF   = GPIO 7
 *   PCLK   = GPIO 13
 *
 * ARDUINO IDE COMPILATION SETTINGS:
 *   Board         : ESP32S3 Dev Module
 *   USB CDC On Boot: Enabled
 *   CPU Frequency : 240MHz (WiFi)
 *   Core Debug    : None / Info
 *   Flash Mode    : QIO 80MHz
 *   PSRAM         : OPI PSRAM (or QSPI PSRAM depending on your S3 variant)
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include "esp_camera.h"
#include "esp_http_server.h"

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const char* WIFI_SSID       = "ESP2_ROVER";
const char* WIFI_PASSWORD   = "12345678";

const char* ESP2_TCP_HOST   = "192.168.4.1";
const uint16_t ESP2_TCP_PORT = 82;

// OV3660 Pin Definition for ESP32-S3
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     15
#define SIOD_GPIO_NUM      4
#define SIOC_GPIO_NUM      5

#define Y9_GPIO_NUM       16
#define Y8_GPIO_NUM       17
#define Y7_GPIO_NUM       18
#define Y6_GPIO_NUM       12
#define Y5_GPIO_NUM       10
#define Y4_GPIO_NUM        8
#define Y3_GPIO_NUM        9
#define Y2_GPIO_NUM       11

#define VSYNC_GPIO_NUM     6
#define HREF_GPIO_NUM      7
#define PCLK_GPIO_NUM     13

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\nX-Timestamp: %u\r\n\r\n";

// ============================================================================
// GLOBAL STATE
// ============================================================================
httpd_handle_t stream_httpd = NULL;
WiFiClient tcpClient;

bool isCameraReady       = false;
bool wasTcpConnected     = false;
unsigned long lastCamRetry   = 0;
unsigned long lastTcpRetry   = 0;
unsigned long lastTelemetry  = 0;
unsigned long frameCount     = 0;
float currentFps             = 0.0;
unsigned long lastFpsTime    = 0;

camera_config_t cameraConfig;

// ============================================================================
// ERROR CODE TRANSLATOR
// ============================================================================
const char* getCameraErrorString(esp_err_t err) {
  switch (err) {
    case ESP_OK:
      return "ESP_OK (Success)";
    case ESP_FAIL:
      return "ESP_FAIL (Sensor communication failure / I2C NACK / clock issue)";
    case ESP_ERR_NO_MEM:
      return "ESP_ERR_NO_MEM (Out of memory: check PSRAM settings in Arduino IDE)";
    case ESP_ERR_INVALID_ARG:
      return "ESP_ERR_INVALID_ARG (Invalid pinout or parameter combination)";
    case ESP_ERR_NOT_FOUND:
      return "ESP_ERR_NOT_FOUND (Sensor not detected on SCCB bus: check SIOD(4), SIOC(5), XCLK(15))";
    case ESP_ERR_NOT_SUPPORTED:
      return "ESP_ERR_NOT_SUPPORTED (Pixel format or resolution not supported)";
    case ESP_ERR_TIMEOUT:
      return "ESP_ERR_TIMEOUT (SCCB bus timeout)";
    default:
      return "Unknown ESP-IDF Error";
  }
}

// ============================================================================
// CAMERA INITIALIZATION WITH DETAILED DIAGNOSTICS & RETRY
// ============================================================================
bool setupCameraConfig(uint32_t xclkFreq) {
  memset(&cameraConfig, 0, sizeof(camera_config_t));

  cameraConfig.ledc_channel = LEDC_CHANNEL_0;
  cameraConfig.ledc_timer   = LEDC_TIMER_0;
  cameraConfig.pin_d0       = Y2_GPIO_NUM;
  cameraConfig.pin_d1       = Y3_GPIO_NUM;
  cameraConfig.pin_d2       = Y4_GPIO_NUM;
  cameraConfig.pin_d3       = Y5_GPIO_NUM;
  cameraConfig.pin_d4       = Y6_GPIO_NUM;
  cameraConfig.pin_d5       = Y7_GPIO_NUM;
  cameraConfig.pin_d6       = Y8_GPIO_NUM;
  cameraConfig.pin_d7       = Y9_GPIO_NUM;
  cameraConfig.pin_xclk     = XCLK_GPIO_NUM;
  cameraConfig.pin_pclk     = PCLK_GPIO_NUM;
  cameraConfig.pin_vsync    = VSYNC_GPIO_NUM;
  cameraConfig.pin_href     = HREF_GPIO_NUM;
  cameraConfig.pin_sccb_sda = SIOD_GPIO_NUM;
  cameraConfig.pin_sccb_scl = SIOC_GPIO_NUM;
  cameraConfig.pin_pwdn     = PWDN_GPIO_NUM;
  cameraConfig.pin_reset    = RESET_GPIO_NUM;
  
  // 10MHz XCLK is the golden frequency for OV3660 signal integrity on S3
  cameraConfig.xclk_freq_hz = xclkFreq;
  cameraConfig.pixel_format = PIXFORMAT_JPEG;

  bool hasPsram = psramFound();
  
  if (hasPsram) {
    // PSRAM mode: 2 buffers with CAMERA_GRAB_LATEST prevents queuing delay
    cameraConfig.frame_size   = FRAMESIZE_QVGA; // 320x240
    cameraConfig.jpeg_quality = 20;             // 20 = low latency, low bandwidth
    cameraConfig.fb_count     = 2;
    cameraConfig.grab_mode    = CAMERA_GRAB_LATEST;
    cameraConfig.fb_location  = CAMERA_FB_IN_PSRAM;
  } else {
    // Fallback if PSRAM disabled in IDE: Allocate in internal DRAM with 1 buffer
    cameraConfig.frame_size   = FRAMESIZE_QVGA; // 320x240 (or FRAMESIZE_QQVGA)
    cameraConfig.jpeg_quality = 24;
    cameraConfig.fb_count     = 1;
    cameraConfig.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
    cameraConfig.fb_location  = CAMERA_FB_IN_DRAM;
  }

  return hasPsram;
}

bool initializeCamera() {
  Serial.println("\n----------------------------------------");
  Serial.println("[CAMERA DIAGNOSTICS] Starting OV3660 Init...");
  Serial.println("----------------------------------------");

  // Ensure internal pullups on SCCB bus to prevent floating lines
  pinMode(SIOD_GPIO_NUM, INPUT_PULLUP);
  pinMode(SIOC_GPIO_NUM, INPUT_PULLUP);
  delay(20);

  bool hasPsram = psramFound();
  Serial.printf("PSRAM Detected         : %s\n", hasPsram ? "YES (OPI/QSPI ACTIVE)" : "NO (RUNNING IN DRAM ONLY)");
  if (hasPsram) {
    Serial.printf("Total PSRAM Size       : %u bytes\n", ESP.getPsramSize());
    Serial.printf("Free PSRAM             : %u bytes\n", ESP.getFreePsram());
  }
  Serial.printf("Free Internal Heap     : %u bytes\n", ESP.getFreeHeap());

  // Attempt 1: 10MHz XCLK (Highest stability on OV3660)
  setupCameraConfig(10000000);
  Serial.println("Trying XCLK Frequency  : 10 MHz (High-stability mode)");
  
  esp_err_t err = esp_camera_init(&cameraConfig);

  // Fallback Attempt 2: If 10MHz fails, try 12MHz
  if (err != ESP_OK) {
    Serial.printf("10MHz attempt returned : 0x%X (%d) -> %s\n", err, err, getCameraErrorString(err));
    esp_camera_deinit();
    delay(100);

    Serial.println("Trying XCLK Frequency  : 12 MHz (Secondary fallback)");
    setupCameraConfig(12000000);
    err = esp_camera_init(&cameraConfig);
  }

  // Fallback Attempt 3: If still failing and NO PSRAM, try QQVGA in DRAM
  if (err != ESP_OK && !hasPsram) {
    Serial.println("Trying QQVGA in Internal DRAM...");
    esp_camera_deinit();
    delay(100);
    setupCameraConfig(10000000);
    cameraConfig.frame_size = FRAMESIZE_QQVGA;
    err = esp_camera_init(&cameraConfig);
  }

  Serial.println("----------------------------------------");
  Serial.printf("Final Result Code (HEX): 0x%X\n", err);
  Serial.printf("Final Result Code (DEC): %d\n", err);
  Serial.printf("Diagnostics Description: %s\n", getCameraErrorString(err));
  Serial.println("----------------------------------------");

  if (err != ESP_OK) {
    Serial.println("❌ CAMERA INITIALIZATION FAILED!");
    Serial.println("  WiFi and TCP will stay alive. Auto-retrying every 5 seconds without reboot.");
    Serial.println("  Physical Checklist:");
    Serial.println("   1. Verify OV3660 ribbon is firmly locked in FPC connector.");
    Serial.println("   2. Verify Arduino IDE -> Tools -> PSRAM is set to 'OPI PSRAM'.");
    Serial.println("   3. Check 3.3V power rail stability under camera burst load.");
    isCameraReady = false;
    return false;
  }

  // Sensor verification & tuning
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    Serial.println("✅ SENSOR DETECTED & INITIALIZED!");
    Serial.printf("Sensor PID             : 0x%04X\n", s->id.PID);
    Serial.printf("Sensor MIDH/MIDL       : 0x%02X / 0x%02X\n", s->id.MIDH, s->id.MIDL);

    // Apply low-latency tuning
    s->set_framesize(s, cameraConfig.frame_size);
    s->set_quality(s, cameraConfig.jpeg_quality);
    s->set_vflip(s, 1);       // Flip 180° if mounted inverted
    s->set_hmirror(s, 0);     // Normal orientation
    s->set_brightness(s, 1);  // Slight boost for night/ambient driving
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);

    Serial.println("Configuration Summary  :");
    Serial.printf("  Resolution           : %s\n", (cameraConfig.frame_size == FRAMESIZE_QVGA) ? "QVGA 320x240" : "QQVGA 160x120");
    Serial.printf("  JPEG Quality         : %d\n", cameraConfig.jpeg_quality);
    Serial.printf("  Frame Buffers        : %d (%s)\n", cameraConfig.fb_count, hasPsram ? "PSRAM" : "DRAM");
    Serial.printf("  Grab Mode            : %s\n", hasPsram ? "CAMERA_GRAB_LATEST" : "CAMERA_GRAB_WHEN_EMPTY");
  }

  isCameraReady = true;
  return true;
}

// ============================================================================
// LOW-LATENCY MJPEG HTTP STREAM HANDLER
// ============================================================================
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[128];

  if (!isCameraReady) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    httpd_resp_set_type(req, "text/plain");
    httpd_resp_send(req, "Camera sensor is initializing or not ready.", HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
  }

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  // Zero-buffering CORS and cache headers
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");
  httpd_resp_set_hdr(req, "Expires", "0");

  while (true) {
    // CAMERA_GRAB_LATEST ensures we fetch the newest frame directly from DMA
    fb = esp_camera_fb_get();
    if (!fb) {
      delay(2);
      continue;
    }

    _jpg_buf_len = fb->len;
    _jpg_buf     = fb->buf;

    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 128, _STREAM_PART, _jpg_buf_len, (uint32_t)millis());
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }

    // Crucial: return buffer immediately to keep latency close to 0ms
    esp_camera_fb_return(fb);
    fb = NULL;

    if (res != ESP_OK) {
      break; // Client closed connection
    }

    frameCount++;
    if (millis() - lastFpsTime >= 1000) {
      currentFps = frameCount * 1000.0 / (millis() - lastFpsTime);
      frameCount = 0;
      lastFpsTime = millis();
    }
  }

  return res;
}

// Simple Root Test Webpage
static esp_err_t index_handler(httpd_req_t *req) {
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>STRIX ESP32-S3 Camera Feed</title>";
  html += "<style>body{background:#0a0e14;color:#00ff41;font-family:monospace;text-align:center;padding:16px;}";
  html += "img{border:2px solid #00ff41;border-radius:8px;max-width:95vw;box-shadow:0 0 15px rgba(0,255,65,0.4);}</style>";
  html += "</head><body>";
  html += "<h2>STRIX RECON ROVER &bull; ESP32-S3 OPTICS</h2>";
  html += "<p>IP: " + WiFi.localIP().toString() + " | Stream: /stream</p>";
  if (isCameraReady) {
    html += "<img src='/stream' /><br>";
    html += "<p>Status: ONLINE (QVGA 320x240 | CAMERA_GRAB_LATEST)</p>";
  } else {
    html += "<div style='color:#ff0055;padding:20px;border:1px dashed #ff0055;'>";
    html += "CAMERA SENSOR OFFLINE / INITIALIZING... (Auto-retrying periodically)</div>";
  }
  html += "</body></html>";

  httpd_resp_set_type(req, "text/html");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, html.c_str(), html.length());
}

// Lightweight JSON status for Web App diagnostics
static esp_err_t status_handler(httpd_req_t *req) {
  String json = "{";
  json += "\"ready\":" + String(isCameraReady ? "true" : "false") + ",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"fps\":" + String(currentFps, 1) + ",";
  json += "\"psram\":" + String(psramFound() ? "true" : "false") + ",";
  json += "\"resolution\":\"QVGA 320x240\"";
  json += "}";

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json.c_str(), json.length());
}

void startHttpServer() {
  if (stream_httpd != NULL) return;

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port   = 32768;
  config.max_uri_handlers = 8;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t status_uri = {
    .uri       = "/status",
    .method    = HTTP_GET,
    .handler   = status_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &status_uri);
    Serial.println("HTTP Server Started on port 80");
  } else {
    Serial.println("Failed to start HTTP server!");
  }
}

// ============================================================================
// WIFI STA CONNECTION
// ============================================================================
void connectWiFiSTA() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Disable WiFi power save to eliminate stream stutter
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("\n================================================");
  Serial.println("ESP32-S3 CAMERA CLIENT");
  Serial.println("================================================");
  Serial.print("Connecting to ESP2_WIFI...\nSSID: ");
  Serial.println(WIFI_SSID);

  uint32_t startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WIFI CONNECTED");
    Serial.printf("S3 IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());
    Serial.println("------------------------------------------------");
    Serial.print("LOW LATENCY CAMERA: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");
    Serial.println("------------------------------------------------");
  } else {
    Serial.println("⚠️ WiFi connect timeout. Will continue retrying in background...");
  }
}

// ============================================================================
// ESP2 TCP CLIENT (192.168.4.1:82)
// ============================================================================
void maintainTcpConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wasTcpConnected) {
      tcpClient.stop();
      wasTcpConnected = false;
      Serial.println("ESP2 TCP DISCONNECTED (WiFi dropped)");
    }
    return;
  }

  if (tcpClient.connected()) {
    if (!wasTcpConnected) {
      wasTcpConnected = true;
      Serial.println("ESP2 TCP CONNECTED");
    }

    // Send periodic camera status heartbeat to ESP2 every 2 seconds
    if (millis() - lastTelemetry >= 2000) {
      lastTelemetry = millis();
      String packet = "STATUS|CAM|" + WiFi.localIP().toString() + "|" + 
                      (isCameraReady ? "READY" : "ERR") + "|" + 
                      String(currentFps, 1) + "FPS\n";
      tcpClient.print(packet);
    }

    // Read any incoming instructions from ESP2
    while (tcpClient.available()) {
      String line = tcpClient.readStringUntil('\n');
      line.trim();
      if (line.length() > 0) {
        Serial.printf("[ESP2 -> S3] %s\n", line.c_str());
      }
    }
  } else {
    if (wasTcpConnected) {
      wasTcpConnected = false;
      Serial.println("ESP2 TCP DISCONNECTED");
    }

    // Controlled non-blocking reconnect every 3 seconds
    if (millis() - lastTcpRetry >= 3000) {
      lastTcpRetry = millis();
      Serial.println("Connecting to ESP2 TCP...");
      tcpClient.connect(ESP2_TCP_HOST, ESP2_TCP_PORT);
      if (tcpClient.connected()) {
        wasTcpConnected = true;
        Serial.println("ESP2 TCP CONNECTED");
        tcpClient.printf("HELLO|S3_CAM|%s\n", WiFi.localIP().toString().c_str());
      }
    }
  }
}

// ============================================================================
// ARDUINO SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n================================================");
  Serial.println("STRIX ROVER ESP32-S3 OV3660 OPTICS INITIALIZING");
  Serial.println("================================================");

  // 1. Connect STA WiFi to ESP2 Hotspot
  connectWiFiSTA();

  // 2. Start HTTP Streaming Server
  startHttpServer();

  // 3. Initialize Camera Hardware
  initializeCamera();

  Serial.println("\nREADY");
  Serial.println("#####################################");
}

// ============================================================================
// ARDUINO MAIN LOOP
// ============================================================================
void loop() {
  // 1. Monitor & Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (millis() - lastWifiRetry >= 4000) {
      lastWifiRetry = millis();
      Serial.println("Reconnecting WiFi to ESP2_ROVER...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  // 2. Camera retry mechanism without rebooting
  if (!isCameraReady) {
    if (millis() - lastCamRetry >= 5000) {
      lastCamRetry = millis();
      Serial.println("Retrying OV3660 camera initialization...");
      esp_camera_deinit();
      delay(50);
      initializeCamera();
    }
  }

  // 3. Maintain TCP link to ESP2 (192.168.4.1:82)
  maintainTcpConnection();

  delay(10);
}
