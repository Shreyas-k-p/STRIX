export type MotorDirection = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP';

export interface MotorDetail {
  id: number;
  name: string;
  driver: 1 | 2; // Driver 1 (L298N #1: M1, M2, M3) or Driver 2 (L298N #2: M4, M5, M6)
  direction: 'FWD' | 'REV' | 'STOP';
  isOn: boolean;
  speed: number; // 0 - 255
}

export interface MotorState {
  roverDirection: MotorDirection;
  isMoving: boolean;
  speed: number; // Global speed target 0 - 255
  motors: MotorDetail[];
}

export interface SensorData {
  temperature: number | null; // Celsius
  humidity: number | null;    // Percentage
  mq135Raw: number | null;     // Raw ADC 0 - 4095
  mq135CalibratedPpm: number | null; // Null unless ESP32 explicitly provides calibrated PPM
  mq135Status: 'CLEAN' | 'MODERATE' | 'HAZARDOUS' | 'UNKNOWN';
  ultrasonicDistanceCm: number | null; // cm
  irObstacle: boolean | null; // false = CLEAR, true = OBSTACLE
  batteryVoltage: number | null; // Volts
  batteryPercent: number | null; // 0 - 100%
  lastUpdated: number | null;
}

export interface SensorThresholds {
  tempWarning: number;
  tempDanger: number;
  humidityWarningHigh: number;
  humidityWarningLow: number;
  mq135Warning: number;
  mq135Danger: number;
  ultrasonicWarningCm: number;
  ultrasonicDangerCm: number;
}

export type RelayChannel = 1 | 2 | 3 | 4;

export interface RelayState {
  channels: Record<RelayChannel, boolean>;
  labels: Record<RelayChannel, string>;
  requiresConfirmation: Record<RelayChannel, boolean>;
}

export interface ServoState {
  angle: number; // 0 to 360 degrees
  mode: 'POSITION_360' | 'CONTINUOUS_ROTATION';
  isContinuous: boolean;
  speed: number; // -100 to 100 if continuous (negative = CCW, positive = CW, 0 = STOP)
  trim: number;
  isAutoSweeping: boolean;
}

export type LinkStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface ConnectionState {
  laptopToEsp4: LinkStatus;      // USB Serial
  esp4ToEsp2Nrf24: LinkStatus;   // NRF24 Wireless link
  esp2ToEsp1Uart: LinkStatus;    // ESP32 #2 to ESP32 #1 (Sensors)
  esp2ToEsp3Uart: LinkStatus;    // ESP32 #2 to ESP32 #3 (Motors + Relays)
  cameraWifi: LinkStatus;        // ESP32-S3 Camera Wi-Fi
  overallStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'COMMUNICATION_LOST';
  portName: string | null;
  baudRate: number;
  rssi: number | null;           // dBm or link quality
  packetsTx: number;
  packetsRx: number;
  errorCount: number;
  lastPacketRxTimestamp: number | null;
  lastPacketTxTimestamp: number | null;
  latencyMs: number | null;
}

export interface WatchdogConfig {
  timeoutMs: number; // default 300 ms
  enabled: boolean;
  isTriggered: boolean;
  lastHeartbeatSent: number;
  lastAckReceived: number;
}

export interface CameraState {
  url: string;
  status: 'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR';
  fps: number;
  resolution: string;
  isStreaming: boolean;
  aspectRatio: '16:9' | '4:3' | 'fill';
  lastFrameTimestamp: number | null;
}

export type LogLevel = 'INFO' | 'CMD' | 'TEL' | 'ACK' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  raw?: string;
  source?: string;
}

export interface TelemetryPacket {
  type: 'DHT' | 'MQ135' | 'ULTRASONIC' | 'IR' | 'STATUS_MOTOR' | 'STATUS_RELAY' | 'STATUS_SERVO' | 'STATUS_BATTERY' | 'STATUS_LINK' | 'ACK' | 'ERROR' | 'UNKNOWN';
  raw: string;
  timestamp: number;
  payload: Record<string, any>;
}

export interface CommandPacket {
  raw: string;
  category: 'MOTOR' | 'SERVO' | 'RELAY' | 'PING' | 'RAW';
  action: string;
  timestamp: number;
}
