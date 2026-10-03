export type MotorDirection = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP';

export interface MotorDetail {
  id: number;
  name: string;
  driver: 1 | 2; // Driver 1 (L298N #1: Ch A, Ch B) or Driver 2 (L298N #2: Ch A, Ch B)
  channel: 'A' | 'B';
  pins: string;
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
  mq135CalibratedPpm: number | null; // Null unless ESP explicitly provides calibrated PPM
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
  state: 'STOP' | 'CW' | 'CCW';
  speed: number; // 0 to 100%
  value: number; // 90 = STOP, 180 = CW, 0 = CCW
  isInverted: boolean; // physical direction reversal toggle
  angle?: number; // legacy backward compatibility
  mode?: string;
  isContinuous?: boolean;
}

export type LinkStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface ConnectionState {
  laptopToEsp2Ws: LinkStatus;    // Wi-Fi WebSocket (ws://10.82.165.164:81)
  esp2ToEsp1Uart: LinkStatus;    // ESP2 to ESP1 UART (Sensors)
  cameraWifi: LinkStatus;        // ESP32-S3 Camera Wi-Fi
  overallStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  wsUrl: string;
  portName: string | null;
  baudRate?: number;
  rssi: number | null;           // dBm link quality
  packetsTx: number;
  packetsRx: number;
  errorCount: number;
  lastPacketRxTimestamp: number | null;
  lastPacketTxTimestamp: number | null;
  latencyMs: number | null;
  lastError?: string | null;
  // Backward compatibility fields
  laptopToEsp4?: LinkStatus;
  esp4ToEsp2Nrf24?: LinkStatus;
  esp2ToEsp3Uart?: LinkStatus;
}

export interface WatchdogConfig {
  timeoutMs: number;
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
  type:
    | 'TEMP'
    | 'HUM'
    | 'MQ135'
    | 'ULTRASONIC'
    | 'DATA_MULTI'
    | 'DHT'
    | 'IR'
    | 'STATUS_MOTOR'
    | 'STATUS_RELAY'
    | 'STATUS_SERVO'
    | 'STATUS_BATTERY'
    | 'STATUS_LINK'
    | 'ACK'
    | 'ERROR'
    | 'UNKNOWN';
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
