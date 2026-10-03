import React, { useState } from 'react';
import {
  X,
  Cpu,
  Copy,
  Check,
  Layers,
} from 'lucide-react';

interface HardwareInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareInfoModal: React.FC<HardwareInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ARCH' | 'PROTOCOL' | 'FIRMWARE'>('ARCH');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sampleEsp4Code = `// ESP32 #4: LAPTOP COMM CONTROLLER (NRF24 #1 + USB Serial)
#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>

RF24 radio(4, 5); // CE, CSN pins
const byte address[6] = "ROV01";

void setup() {
  Serial.begin(115200);
  radio.begin();
  radio.openWritingPipe(address);
  radio.openReadingPipe(1, address);
  radio.setPALevel(RF24_PA_HIGH);
}

void loop() {
  // 1. Forward commands from Laptop USB Serial to NRF24
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.length() > 0) {
      radio.stopListening();
      radio.write(cmd.c_str(), cmd.length() + 1);
      radio.startListening();
    }
  }

  // 2. Forward telemetry from NRF24 to Laptop USB Serial
  radio.startListening();
  if (radio.available()) {
    char payload[64] = "";
    radio.read(&payload, sizeof(payload));
    Serial.println(payload);
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b0e14] border border-cyan-800/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900/90 border-b border-cyan-950/80">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-heading tracking-wider">
              ROVER HARDWARE ARCHITECTURE & WIRING GUIDE
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
            onClick={() => setActiveTab('FIRMWARE')}
            className={`pb-2 px-3 border-b-2 font-bold transition-all ${
              activeTab === 'FIRMWARE'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Firmware Template
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'ARCH' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Multi-ESP32 Hardware Pipeline
                </h4>
                <div className="text-[11px] leading-relaxed text-slate-300 space-y-3 font-mono">
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-white">ESP32 #4 (Laptop Bridge):</strong> Connected to laptop via USB Serial @ 115200 baud. Holds NRF24L01 #1. Wirelessly bridges commands to ESP32 #2.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-white">ESP32 #2 (Rover Gateway & Servo):</strong> Holds NRF24L01 #2 and drives the Gimbal Servo. Routes sensor requests to ESP32 #1 and motor/relay instructions to ESP32 #3 via hardware UART.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-white">ESP32 #1 (Sensors):</strong> Reads DHT11 (Temp/Hum), MQ-135 (Air Quality ADC), HC-SR04 (Ultrasonic distance), and IR obstacle sensor. Streams telemetry via UART to ESP32 #2.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                    <strong className="text-white">ESP32 #3 (Motors & Relays):</strong> Drives 6 DC motors across dual L298N H-Bridge drivers and 4 independent relay channels. Executes Emergency Stop.
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-cyan-900/50">
                    <strong className="text-cyan-300">ESP32-S3 Camera (Isolated Wi-Fi Stream):</strong> Separate camera module running direct MJPEG video server over 802.11 Wi-Fi. Bypasses NRF24 radio mesh to preserve critical RF telemetry bandwidth!
                  </div>
                </div>
              </div>

              {/* ASCII Diagram */}
              <pre className="p-4 bg-black rounded-lg border border-cyan-950 text-cyan-400/90 text-[10px] leading-tight overflow-x-auto">
{`Laptop Web App (GCS)
      │
      │ USB Serial (115200 Baud)
      ▼
ESP32 #4 (Comm Controller)
      │
      │ NRF24L01 2.4GHz Wireless
      ▼
ESP32 #2 (Rover Gateway + Servo)
      │
      ├───────────────────────┐
      │ UART                  │ UART
      ▼                       ▼
ESP32 #1 (Sensors)      ESP32 #3 (Motors + Relays)
- DHT11, MQ-135         - Dual L298N (6 Motors)
- HC-SR04, IR Obstacle  - 4 Relay Channels

ESP32-S3 Camera ──[ Direct Wi-Fi ]──> Laptop Web App`}
              </pre>
            </div>
          )}

          {activeTab === 'PROTOCOL' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase mb-3">
                  Command Packet Specifications
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
                    <div className="text-cyan-300 font-bold">Relay & Servo Commands</div>
                    <code>CMD|RELAY|&lt;1-4&gt;|&lt;ON/OFF&gt;</code><br />
                    <code>CMD|SERVO|&lt;0-360&gt;</code><br />
                    <code>CMD|SERVO|SPIN|&lt;-100 to 100&gt;</code><br />
                    <code>CMD|SERVO|STOP</code><br />
                    <code>CMD|PING</code> (Watchdog Heartbeat)
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3">
                  Incoming Telemetry & Status Formats
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-emerald-300 font-bold">Sensor Packets (from #1)</div>
                    <code>TEL|DHT|&lt;temp&gt;|&lt;humidity&gt;</code><br />
                    <code>TEL|MQ135|&lt;raw_adc&gt;</code><br />
                    <code>TEL|ULTRASONIC|&lt;dist_cm&gt;</code><br />
                    <code>TEL|IR|&lt;CLEAR/OBSTACLE&gt;</code>
                  </div>
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="text-emerald-300 font-bold">Status & Acks</div>
                    <code>STATUS|MOTOR|&lt;DIR&gt;</code><br />
                    <code>STATUS|RELAY|&lt;ch&gt;|&lt;ON/OFF&gt;</code><br />
                    <code>STATUS|SERVO|&lt;angle&gt;</code><br />
                    <code>ACK|MOTOR|&lt;action&gt;</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'FIRMWARE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-bold">
                  Starter Sketch for ESP32 #4 (USB to NRF24 Bridge):
                </span>
                <button
                  onClick={() => copyToClipboard(sampleEsp4Code, 'esp4')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-xs transition-colors"
                >
                  {copiedCode === 'esp4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode === 'esp4' ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="p-4 bg-black rounded-xl border border-slate-800 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {sampleEsp4Code}
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
