# 🚀 ROVER CONTROL CENTER (GCS)

A high-performance, responsive Ground Control Station (GCS) web application for teleoperating and monitoring a custom multi-ESP32 6-wheel rover with NRF24L01 wireless telemetry and ESP32-S3 Wi-Fi live video streaming.

---

## 🛰️ Rover Hardware Architecture

```
Laptop Web App (Chrome / Edge / Opera)
      │
      │ USB Serial (115200 Baud) [Web Serial API]
      ▼
ESP32 #4 (Laptop Bridge Controller)
      │
      │ NRF24L01+ 2.4GHz Wireless Mesh
      ▼
ESP32 #2 (Rover Gateway & Servo Controller)
      │
      ├──────────────────────────────┐
      │ UART (Serial1)               │ UART (Serial2)
      ▼                              ▼
ESP32 #1 (Sensor Controller)    ESP32 #3 (Motor & Relay Controller)
- DHT11 (Temp & Humidity)       - Dual L298N Drivers (6 DC Motors)
- MQ-135 (Air Quality ADC)      - 4-Channel Relays
- HC-SR04 (Ultrasonic Range)
- IR Obstacle Sensor

ESP32-S3 Camera Module
      │
      │ Direct 802.11 b/g/n Wi-Fi MJPEG Stream (Bypasses NRF24)
      ▼
Laptop Web App (Direct Video Feed)
```

---

## ✨ Features & Architecture

### 1. Live Camera Feed (ESP32-S3)
* Direct Wi-Fi connection to the ESP32-S3 camera module (video **does not** route through NRF24 to preserve RF bandwidth for telemetry and control).
* Configurable stream URL (e.g. `http://192.168.4.1:81/stream` or custom IP).
* Live FPS calculator, crosshair HUD overlay, snapshot capture with local gallery, and fullscreen toggle.

### 2. Rover Propulsion Joystick & Keyboard Teleoperation
* 2D touch/mouse virtual joystick with deadzone and auto-recenter.
* Tactile D-Pad controls: **Forward**, **Backward**, **Left**, **Right**, **Stop**.
* Physical keyboard hotkeys:
  * `W` / `↑` : Forward
  * `S` / `↓` : Backward
  * `A` / `←` : Left (skid-steer)
  * `D` / `→` : Right (skid-steer)
  * `X` : Stop
  * `SPACE` : Immediate **Emergency Stop**
* Variable PWM speed slider (0–255) with quick presets: Slow (100 PWM), Cruise (180 PWM), Turbo (255 PWM).

### 3. Sensor Telemetry Dashboard
* **DHT11**: Temperature (°C) and Humidity (%).
* **MQ-135**: Raw 12-bit ADC value (0–4095) with Air Quality status (Clean / Moderate / Hazardous). Raw voltages are **never** misleadingly labeled as PPM unless calibrated data is explicitly provided by firmware.
* **HC-SR04**: Ultrasonic distance (cm) with dynamic danger proximity bar.
* **IR Obstacle Sensor**: Real-time obstacle detection (`CLEAR` / `OBSTACLE DETECTED`).
* **Configurable Thresholds**: Warning and Danger levels can be modified in real-time.
* **Integrity Guarantee**: Displays `NO DATA` when disconnected — never displays fabricated numbers.

### 4. 6-Motor Dual L298N Status Panel
* Real-time direction (`FWD`, `REV`, `STOP`), status (`ACTIVE` / `OFF`), and PWM speed for all 6 DC motors:
  * **Driver 1 (L298N #1)**: Motor 1 (Front-Left), Motor 2 (Mid-Left), Motor 3 (Rear-Left).
  * **Driver 2 (L298N #2)**: Motor 4 (Front-Right), Motor 5 (Mid-Right), Motor 6 (Rear-Right).
* Abstracted pin layer so hardware pin changes on ESP32 #3 do not affect UI communication.

### 5. 4-Channel Relay Control
* Independent toggling of Relays 1 through 4.
* Built-in safety interlock confirmation dialog for critical channels (e.g., Payload/Heater).

### 6. 360° Servo & Turret Control (ESP32 #2)
* **360° Positional Mode**: Full 0° to 360° range slider, interactive compass dial with mouse/touch drag rotation, cardinal presets (0° Front, 90° Right, 180° Rear, 270° Left, 360° Full), and fine ±5°/±15° trim buttons.
* **360° Panoramic Auto-Sweep**: Automatic continuous sweep from 0° ↔ 360° for panoramic sensor surveillance and environmental scanning.
* **Continuous 360° Spin Mode**: Infinite rotation for continuous 360° servos / LIDAR / radar turrets with Clockwise (CW ↻), Counter-Clockwise (CCW ↺), Halt (⏹), and variable spin velocity (10% to 100%).

### 7. Communication Watchdog & Safety Interlock
* Automatic watchdog timer (default: **300 ms**).
* If rover is moving and communication acknowledgment is lost for >300 ms, the system raises a **COMMUNICATION LOST** alarm and immediately halts all motors.
* High-visibility **EMERGENCY STOP (E-STOP)** button accessible across the header, joystick, and safety bar.

### 8. Web Serial & Terminal Debug Console
* Native **Web Serial API** integration for direct communication with ESP32 #4 @ 115200 baud.
* Color-coded terminal log with auto-scroll, log filtering (ALL, CMD, TEL, ERROR), pause/resume, file export (`.txt`), and raw command injection.
* **DEMO MODE**: Built-in simulator for testing the UI, gauges, and safety loops without physical hardware.

---

## 📦 Getting Started

### 1. Prerequisites
* **Node.js** v18+ and **npm** v9+
* A modern browser supporting Web Serial API (**Google Chrome**, **Microsoft Edge**, or **Opera**)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in Chrome or Edge.

### 4. Build Production Bundle
```bash
npm run build
```

---

## 🔌 Connecting to Physical Hardware (ESP32 #4)

1. Plug **ESP32 #4** into your laptop via a USB data cable.
2. In the Web App header, click **CONNECT ESP32 #4**.
3. Your browser will open the Web Serial device picker.
4. Select the serial port corresponding to ESP32 #4 (e.g. `Silicon Labs CP210x` or `USB-SERIAL CH340`) and click **Connect**.
5. Once connected, the USB badge will illuminate green, and live telemetry packets will begin streaming in the terminal!

---

## 📡 Serial Protocol Reference

### Outgoing Commands (Web App ➔ ESP32 #4)
| Command | Description |
|---|---|
| `CMD\|MOTOR\|FORWARD` | Drive forward |
| `CMD\|MOTOR\|BACKWARD` | Drive in reverse |
| `CMD\|MOTOR\|LEFT` | Skid-steer rotate left |
| `CMD\|MOTOR\|RIGHT` | Skid-steer rotate right |
| `CMD\|MOTOR\|STOP` | Halt all 6 motors |
| `CMD\|MOTOR\|SPEED\|<0-255>` | Set PWM speed target |
| `CMD\|SERVO\|<0-360>` | Set servo angle (0° to 360°) |
| `CMD\|SERVO\|SPIN\|<-100 to 100>` | Continuous 360° spin (negative = CCW, positive = CW) |
| `CMD\|SERVO\|STOP` | Stop continuous 360° spin |
| `CMD\|RELAY\|<1-4>\|<ON/OFF>` | Toggle relay channel |
| `CMD\|PING` | Watchdog heartbeat ping |

### Incoming Telemetry (ESP32 #4 ➔ Web App)
| Packet | Description |
|---|---|
| `TEL\|DHT\|<temp>\|<humidity>` | DHT11 sensor readings (e.g. `TEL\|DHT\|33.7\|64.9`) |
| `TEL\|MQ135\|<raw_adc>[\|<ppm>]` | MQ-135 raw ADC voltage (e.g. `TEL\|MQ135\|1820`) |
| `TEL\|ULTRASONIC\|<distance_cm>` | HC-SR04 distance (e.g. `TEL\|ULTRASONIC\|42.5`) |
| `TEL\|IR\|<CLEAR\|OBSTACLE>` | IR line/obstacle sensor |
| `STATUS\|MOTOR\|<DIR>` | Motor direction confirmation (`STOPPED`, `FORWARD`, etc.) |
| `STATUS\|RELAY\|<ch>\|<ON\|OFF>` | Relay channel status |
| `STATUS\|SERVO\|<angle>` | Current servo angle |
| `STATUS\|BATTERY\|<volts>\|<pct>` | Battery voltage and percentage |
| `STATUS\|LINK\|NRF24\|<STATUS>\|<RSSI>`| Radio link status and RSSI dBm |
| `ACK\|<CMD>\|<DETAIL>` | Execution acknowledgment |
| `ERROR\|<SUBSYSTEM>\|<MSG>` | Subsystem error notification |

---

## 🛠️ Project Structure

```
strix2/
├── index.html                   # HTML entry point with fonts & dark theme
├── src/
│   ├── communication/
│   │   ├── types.ts             # TypeScript interfaces for rover telemetry
│   │   ├── protocol.ts          # Serial packet encoder and parser
│   │   └── serial.ts            # Web Serial API driver & buffer management
│   ├── hooks/
│   │   ├── useSerial.ts         # React hook for serial port lifecycle
│   │   └── useRover.ts          # Master rover state, watchdog & safety hook
│   ├── components/
│   │   ├── Header.tsx           # Mission status badges, connect & E-STOP
│   │   ├── CameraPanel.tsx      # ESP32-S3 Wi-Fi MJPEG video feed & HUD
│   │   ├── RoverJoystick.tsx    # 2D virtual joystick, tactile D-pad & speed
│   │   ├── SensorDashboard.tsx  # Live DHT11, MQ135, HC-SR04 & IR cards
│   │   ├── MotorPanel.tsx       # 6-motor dual L298N telemetry
│   │   ├── RelayPanel.tsx       # 4-channel relay toggles & safety modal
│   │   ├── ServoPanel.tsx       # Gimbal servo slider, gauge & trim
│   │   ├── ConnectionPanel.tsx  # 5-stage communication topology diagram
│   │   ├── EmergencyStop.tsx    # Primary safety interlock banner
│   │   ├── EventLog.tsx         # Terminal debug console & command input
│   │   ├── HardwareInfoModal.tsx# Architecture wiring guide & starter code
│   │   └── SettingsModal.tsx    # Watchdog & sensor thresholds config
│   ├── App.tsx                  # Main responsive cockpit view
│   ├── main.tsx                 # React DOM mount point
│   └── index.css                # Tailwind CSS styling, scanlines & animations
└── package.json
```
