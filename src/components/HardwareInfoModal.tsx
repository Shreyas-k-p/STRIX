import React, { useState } from 'react';
import {
  X,
  Cpu,
  Copy,
  Check,
  Layers,
  Zap,
} from 'lucide-react';

interface HardwareInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareInfoModal: React.FC<HardwareInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ARCH' | 'PINOUTS' | 'PROTOCOL' | 'ESP2_FIRMWARE'>('ARCH');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sampleEsp2Firmware = `// ESP2 MAIN CONTROLLER - WebSocket & Hardware Bridge
// Wi-Fi: SSID "REY"
// IP: 10.82.165.164 | TCP Port: 81 (WebSocket)
#include <WiFi.h>
#include <WebSocketsServer.h>

const char* ssid = "REY";
const char* password = "REY22222";

WebSocketsServer webSocket = WebSocketsServer(81);

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("[%u] Connected!\\n", num);
  } else if (type == WStype_TEXT) {
    String msg = String((char*)payload);
    msg.trim();
    if (msg == "PING" || msg == "CMD|PING") {
      webSocket.sendTXT(num, "ACK|PING");
    } else if (msg == "STATUS") {
      int rssi = WiFi.RSSI();
      String reply = "STATUS|LINK|ESP2_WIFI|CONNECTED|" + String(rssi);
      webSocket.sendTXT(num, reply);
    }
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.println(WiFi.localIP());
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-[#0b0e14] border border-cyan-800/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900/90 border-b border-cyan-950/80">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-heading tracking-wider">
              STRIX HARDWARE ARCHITECTURE & PINOUT SPECIFICATION
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('ARCH')}
            className={`pb-2 px-3 border-b-2 font-bold transition-all ${
              activeTab === 'ARCH'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Topology Map
          </button>
          <button
            onClick={() => setActiveTab('PINOUTS')}
            className={`pb-2 px-3 border-b-2 font-bold transition-all ${
              activeTab === 'PINOUTS'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            GPIO Pinout Guide
          </button>
          <button
            onClick={() => setActiveTab('PROTOCOL')}
            className={`pb-2 px-3 border-b-2 font-bold transition-all ${
              activeTab === 'PROTOCOL'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Packet Protocol
          </button>
          <button
            onClick={() => setActiveTab('ESP2_FIRMWARE')}
            className={`pb-2 px-3 border-b-2 font-bold transition-all ${
              activeTab === 'ESP2_FIRMWARE'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ESP2 Reference Firmware
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'ARCH' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Hardware Topology
                </h4>
                <div className="text-[11px] leading-relaxed text-slate-300 space-y-3 font-mono">
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-emerald-400">ESP2 (Main Controller):</strong> Connects directly to laptop STRIX Web App via Wi-Fi WebSocket (ws://10.82.165.164:81). Drives dual L298N motor drivers, 4 relays, and talks to ESP1 via UART.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-white">ESP1 (Sensors & Continuous Servo):</strong> Reads DHT11, MQ-135, HC-SR04, and controls the continuous rotation servo. Connected to ESP2 via UART.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-cyan-900/50">
                    <strong className="text-cyan-300">ESP32-S3 Camera (Independent Wi-Fi Stream):</strong> Runs dedicated MJPEG video server over Wi-Fi direct. Completely independent from ESP2 control communication.
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-400 text-[10px]">
                    Note: ESP3, ESP4, and NRF24 are NOT part of the final hardware system.
                  </div>
                </div>
              </div>

              {/* ASCII Diagram */}
              <pre className="p-4 bg-black rounded-lg border border-cyan-950 text-cyan-400/90 text-[10px] leading-tight overflow-x-auto">
{`Laptop STRIX Web App
       │
       │ Wi-Fi / WebSocket (ws://10.82.165.164:81)
       ▼
ESP2 Main Controller
   ├── UART (TX2:17, RX2:16) ─> ESP1 (RX:25, TX:26)
   │                           ├── DHT11 (GPIO33)
   │                           ├── MQ-135 (AO GPIO34)
   │                           ├── HC-SR04 (TRIG:21, ECHO:35)
   │                           ├── IR Sensor (OUT: GPIO27)
   │                           └── Continuous Servo (GPIO32)
   ├── L298N #1 (Port 3-wheels: ENA:25, IN1:26, IN2:27, ENB:14, IN3:12, IN4:13)
   ├── L298N #2 (Starboard 3-wheels: ENA:33, IN1:32, IN2:23, ENB:22, IN3:21, IN4:19)
   └── 4-Channel Relays (Active LOW: Module 1 GPIO 4, 15 | Module 2 GPIO 18, 5)

[Separate Module]
ESP32-S3 Camera ──[ Direct Wi-Fi MJPEG ]──> Laptop STRIX Web App`}
              </pre>
            </div>
          )}

          {activeTab === 'PINOUTS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ESP2 Motor Pinout */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" /> ESP2 Motor Pinouts (Dual L298N)
                  </h4>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-white font-bold">L298N #1 (Port / Left Bank):</div>
                    <div>ENA: <code className="text-amber-300">GPIO25</code> (PWM Speed)</div>
                    <div>IN1: <code className="text-amber-300">GPIO26</code> | IN2: <code className="text-amber-300">GPIO27</code></div>
                    <div>ENB: <code className="text-amber-300">GPIO14</code> (PWM Speed)</div>
                    <div>IN3: <code className="text-amber-300">GPIO12</code> | IN4: <code className="text-amber-300">GPIO13</code></div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-white font-bold">L298N #2 (Starboard / Right Bank):</div>
                    <div>ENA: <code className="text-amber-300">GPIO33</code> (PWM Speed)</div>
                    <div>IN1: <code className="text-amber-300">GPIO32</code> | IN2: <code className="text-amber-300">GPIO23</code></div>
                    <div>ENB: <code className="text-amber-300">GPIO22</code> (PWM Speed)</div>
                    <div>IN3: <code className="text-amber-300">GPIO21</code> | IN4: <code className="text-amber-300">GPIO19</code></div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    * 4 H-Bridge channels control the 6 physical wheels.
                  </div>
                </div>

                {/* ESP2 Relays & UART */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> ESP2 Relays & UART to ESP1
                  </h4>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-white font-bold">ESP2 Relay Channels (Active LOW):</div>
                    <div>Module 1 IN1: <code className="text-amber-300">GPIO4</code> (Relay 1)</div>
                    <div>Module 1 IN2: <code className="text-amber-300">GPIO15</code> (Relay 2)</div>
                    <div>Module 2 IN1: <code className="text-amber-300">GPIO18</code> (Relay 3)</div>
                    <div>Module 2 IN2: <code className="text-amber-300">GPIO5</code> (Relay 4)</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-white font-bold">ESP2 ↔ ESP1 UART Bus:</div>
                    <div>ESP2 TX2: <code className="text-cyan-300">GPIO17</code> → ESP1 RX: <code className="text-cyan-300">GPIO25</code></div>
                    <div>ESP2 RX2: <code className="text-cyan-300">GPIO16</code> ← ESP1 TX: <code className="text-cyan-300">GPIO26</code></div>
                    <div>GND: Common Ground</div>
                  </div>
                </div>
              </div>

              {/* ESP1 Sensors & Servo Pinout */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> ESP1 Sensors & Continuous Servo Pinouts
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <div className="text-white font-bold">DHT11</div>
                    <div>Data: <code className="text-emerald-300">GPIO33</code></div>
                    <div className="text-[10px] text-slate-400">Temp & Humidity</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <div className="text-white font-bold">MQ-135</div>
                    <div>AO: <code className="text-emerald-300">GPIO34</code></div>
                    <div className="text-[10px] text-slate-400">Raw ADC (0-4095)</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <div className="text-white font-bold">HC-SR04</div>
                    <div>TRIG: <code className="text-emerald-300">GPIO21</code></div>
                    <div>ECHO: <code className="text-emerald-300">GPIO35</code></div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <div className="text-white font-bold">IR Obstacle</div>
                    <div>OUT: <code className="text-emerald-300">GPIO27</code></div>
                    <div className="text-[10px] text-slate-400">3.3V (Active LOW)</div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <div className="text-white font-bold">Continuous Servo</div>
                    <div>Signal: <code className="text-emerald-300">GPIO32</code></div>
                    <div className="text-[10px] text-slate-400">90=Stop, 180=CW, 0=CCW</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PROTOCOL' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase mb-3">
                  STRIX Command Protocol
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-cyan-300 font-bold">Motor Commands</div>
                    <code>CMD|MOTOR|FORWARD</code><br />
                    <code>CMD|MOTOR|BACKWARD</code><br />
                    <code>CMD|MOTOR|LEFT</code><br />
                    <code>CMD|MOTOR|RIGHT</code><br />
                    <code>CMD|MOTOR|STOP</code><br />
                    <code>CMD|MOTOR|SPEED|&lt;0-255&gt;</code>
                  </div>
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-cyan-300 font-bold">Relay, Servo & Ping Commands</div>
                    <code>CMD|RELAY|&lt;1-4&gt;|&lt;ON/OFF&gt;</code><br />
                    <code>CMD|SERVO|STOP</code> (90)<br />
                    <code>CMD|SERVO|CW|&lt;speed&gt;</code> (180)<br />
                    <code>CMD|SERVO|CCW|&lt;speed&gt;</code> (0)<br />
                    <code>CMD|PING</code> or <code>PING</code>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3">
                  Supported Incoming Telemetry Packets
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-emerald-300 font-bold">Sensor Formats</div>
                    <code>SENSOR|TEMP|&lt;value&gt;</code><br />
                    <code>SENSOR|HUM|&lt;value&gt;</code><br />
                    <code>SENSOR|MQ135_RAW|&lt;value&gt;</code><br />
                    <code>SENSOR|DIST|&lt;value&gt;</code><br />
                    <code>DATA|TEMP=..|HUM=..|MQ135_RAW=..|DIST=..</code>
                  </div>
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-emerald-300 font-bold">Status & Acks</div>
                    <code>ACK|PING</code><br />
                    <code>STATUS|LINK|ESP2_WIFI|CONNECTED|&lt;RSSI&gt;</code><br />
                    <code>STATUS|MOTOR|&lt;DIR&gt;</code><br />
                    <code>STATUS|RELAY|&lt;ch&gt;|&lt;ON/OFF&gt;</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ESP2_FIRMWARE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-bold">
                  ESP2 WebSocket Server Reference:
                </span>
                <button
                  onClick={() => copyToClipboard(sampleEsp2Firmware, 'esp2')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-xs transition-colors"
                >
                  {copiedCode === 'esp2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode === 'esp2' ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="p-4 bg-black rounded-xl border border-slate-800 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {sampleEsp2Firmware}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg text-xs transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
