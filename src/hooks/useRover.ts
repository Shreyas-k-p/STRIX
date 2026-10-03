import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  MotorDirection,
  MotorState,
  MotorDetail,
  SensorData,
  SensorThresholds,
  RelayState,
  RelayChannel,
  ServoState,
  ConnectionState,
  WatchdogConfig,
  LogEntry,
  LogLevel,
} from '../communication/types';
import { Protocol } from '../communication/protocol';
import { useSerial } from './useSerial';
import { ESP2_WS_URL } from '../communication/websocket';

const DEFAULT_THRESHOLDS: SensorThresholds = {
  tempWarning: 38.0,
  tempDanger: 45.0,
  humidityWarningHigh: 80.0,
  humidityWarningLow: 20.0,
  mq135Warning: 1800,
  mq135Danger: 2500,
  ultrasonicWarningCm: 25.0,
  ultrasonicDangerCm: 12.0,
};

// 4 H-Bridge channels across 2 L298N drivers driving the 6 wheels
const INITIAL_MOTORS: MotorDetail[] = [
  {
    id: 1,
    name: 'Port Bank A (Front/Mid)',
    driver: 1,
    channel: 'A',
    pins: 'ENA:25, IN1:26, IN2:27',
    direction: 'STOP',
    isOn: false,
    speed: 0,
  },
  {
    id: 2,
    name: 'Port Bank B (Rear)',
    driver: 1,
    channel: 'B',
    pins: 'ENB:14, IN3:12, IN4:13',
    direction: 'STOP',
    isOn: false,
    speed: 0,
  },
  {
    id: 3,
    name: 'Starboard Bank A (Front/Mid)',
    driver: 2,
    channel: 'A',
    pins: 'ENA:33, IN1:32, IN2:23',
    direction: 'STOP',
    isOn: false,
    speed: 0,
  },
  {
    id: 4,
    name: 'Starboard Bank B (Rear)',
    driver: 2,
    channel: 'B',
    pins: 'ENB:22, IN3:21, IN4:19',
    direction: 'STOP',
    isOn: false,
    speed: 0,
  },
];

export function useRover() {
  // Thresholds state
  const [thresholds, setThresholds] = useState<SensorThresholds>(DEFAULT_THRESHOLDS);

  // Sensor state: Null values by default when disconnected (NO DATA)
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: null,
    humidity: null,
    mq135Raw: null,
    mq135CalibratedPpm: null,
    mq135Status: 'UNKNOWN',
    ultrasonicDistanceCm: null,
    irObstacle: null,
    batteryVoltage: null,
    batteryPercent: null,
    lastUpdated: null,
  });

  // Motor state
  const [motorState, setMotorState] = useState<MotorState>({
    roverDirection: 'STOP',
    isMoving: false,
    speed: 180, // Default PWM target (0-255)
    motors: INITIAL_MOTORS,
  });

  // Relay state: Active LOW on ESP2 hardware
  const [relayState, setRelayState] = useState<RelayState>({
    channels: { 1: false, 2: false, 3: false, 4: false },
    labels: {
      1: 'Relay 1: Headlights (GPIO4)',
      2: 'Relay 2: Aux 12V (GPIO15)',
      3: 'Relay 3: Sensor Heater (GPIO18)',
      4: 'Relay 4: Payload Disarm (GPIO5)',
    },
    requiresConfirmation: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
  });

  // Continuous Rotation Servo state: 90 = STOP, 180 = CW, 0 = CCW
  const [servoState, setServoState] = useState<ServoState>({
    state: 'STOP',
    speed: 100,
    value: 90,
    isInverted: false,
    angle: 90,
    mode: 'CONTINUOUS_ROTATION',
    isContinuous: true,
  });

  // Connection state: direct Wi-Fi WebSocket to ESP2
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    laptopToEsp2Ws: 'DISCONNECTED',
    esp2ToEsp1Uart: 'DISCONNECTED',
    cameraWifi: 'DISCONNECTED',
    overallStatus: 'DISCONNECTED',
    wsUrl: ESP2_WS_URL,
    portName: null,
    baudRate: 0,
    rssi: null,
    packetsTx: 0,
    packetsRx: 0,
    errorCount: 0,
    lastPacketRxTimestamp: null,
    lastPacketTxTimestamp: null,
    latencyMs: null,
    lastError: null,
    laptopToEsp4: 'DISCONNECTED',
    esp4ToEsp2Nrf24: 'DISCONNECTED',
    esp2ToEsp3Uart: 'DISCONNECTED',
  });

  // Watchdog state - automatic browser stop is disabled per requirements
  const [watchdog, setWatchdog] = useState<WatchdogConfig>({
    timeoutMs: 0,
    enabled: false,
    isTriggered: false,
    lastHeartbeatSent: 0,
    lastAckReceived: 0,
  });

  // Event Log
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogPaused, setIsLogPaused] = useState<boolean>(false);

  const addLog = useCallback(
    (level: LogLevel, message: string, raw?: string, source?: string) => {
      if (isLogPaused && level !== 'ERROR') return;
      const now = new Date();
      const timeStr =
        now.toTimeString().split(' ')[0] +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0');
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        level,
        message,
        raw,
        source: source || 'STRIX',
      };

      setLogs((prev) => {
        const next = [...prev, newEntry];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    },
    [isLogPaused]
  );

  // Update detail states of the 4 L298N channels driving the 6 wheels
  const updateMotorDetails = useCallback((dir: MotorDirection, speed: number) => {
    setMotorState((prev) => {
      const isMoving = dir !== 'STOP';
      const actualSpeed = isMoving ? speed : 0;

      const updatedMotors: MotorDetail[] = prev.motors.map((m) => {
        let motorDir: 'FWD' | 'REV' | 'STOP' = 'STOP';
        if (dir === 'FORWARD') {
          motorDir = 'FWD';
        } else if (dir === 'BACKWARD') {
          motorDir = 'REV';
        } else if (dir === 'LEFT') {
          // Skid-steer left: Driver 1 (Port) reverses, Driver 2 (Starboard) forwards
          motorDir = m.driver === 1 ? 'REV' : 'FWD';
        } else if (dir === 'RIGHT') {
          // Skid-steer right: Driver 1 (Port) forwards, Driver 2 (Starboard) reverses
          motorDir = m.driver === 1 ? 'FWD' : 'REV';
        }

        return {
          ...m,
          direction: motorDir,
          isOn: motorDir !== 'STOP',
          speed: motorDir !== 'STOP' ? actualSpeed : 0,
        };
      });

      return {
        roverDirection: dir,
        isMoving,
        speed,
        motors: updatedMotors,
      };
    });
  }, []);

  // Parse incoming telemetry packets from ESP2 / ESP1
  const handlePacketReceived = useCallback(
    (line: string) => {
      const now = Date.now();

      setConnectionState((prev) => ({
        ...prev,
        packetsRx: prev.packetsRx + 1,
        lastPacketRxTimestamp: now,
        laptopToEsp2Ws: 'CONNECTED',
        overallStatus: 'CONNECTED',
      }));

      const packet = Protocol.parseLine(line, thresholds);
      if (!packet) return;

      switch (packet.type) {
        case 'TEMP': {
          setSensorData((prev) => ({
            ...prev,
            temperature: packet.payload.temperature,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog('TEL', `ESP1 -> Temp: ${packet.payload.temperature}°C`, line, 'ESP1');
          break;
        }

        case 'HUM': {
          setSensorData((prev) => ({
            ...prev,
            humidity: packet.payload.humidity,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog('TEL', `ESP1 -> Humidity: ${packet.payload.humidity}%`, line, 'ESP1');
          break;
        }

        case 'MQ135': {
          setSensorData((prev) => ({
            ...prev,
            mq135Raw: packet.payload.mq135Raw,
            mq135CalibratedPpm: packet.payload.mq135CalibratedPpm,
            mq135Status: packet.payload.mq135Status,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog(
            'TEL',
            `ESP1 -> MQ-135: Raw ADC ${packet.payload.mq135Raw} (${packet.payload.mq135Status})`,
            line,
            'ESP1'
          );
          break;
        }

        case 'ULTRASONIC': {
          setSensorData((prev) => ({
            ...prev,
            ultrasonicDistanceCm: packet.payload.ultrasonicDistanceCm,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog(
            'TEL',
            `ESP1 -> HC-SR04: ${packet.payload.ultrasonicDistanceCm} cm`,
            line,
            'ESP1'
          );
          break;
        }

        case 'DATA_MULTI': {
          setSensorData((prev) => ({
            ...prev,
            temperature:
              packet.payload.temperature !== null ? packet.payload.temperature : prev.temperature,
            humidity:
              packet.payload.humidity !== null ? packet.payload.humidity : prev.humidity,
            mq135Raw:
              packet.payload.mq135Raw !== null ? packet.payload.mq135Raw : prev.mq135Raw,
            mq135Status:
              packet.payload.mq135Status !== 'UNKNOWN'
                ? packet.payload.mq135Status
                : prev.mq135Status,
            ultrasonicDistanceCm:
              packet.payload.ultrasonicDistanceCm !== null
                ? packet.payload.ultrasonicDistanceCm
                : prev.ultrasonicDistanceCm,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog('TEL', `ESP1 Multi Telemetry: ${line}`, line, 'ESP1');
          break;
        }

        case 'DHT': {
          setSensorData((prev) => ({
            ...prev,
            temperature: packet.payload.temperature,
            humidity: packet.payload.humidity,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog(
            'TEL',
            `DHT -> Temp: ${packet.payload.temperature}°C, Hum: ${packet.payload.humidity}%`,
            line,
            'ESP1'
          );
          break;
        }

        case 'IR': {
          setSensorData((prev) => ({
            ...prev,
            irObstacle: packet.payload.irObstacle,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog(
            'TEL',
            `IR -> ${packet.payload.irObstacle ? 'OBSTACLE DETECTED' : 'CLEAR'}`,
            line,
            'ESP1'
          );
          break;
        }

        case 'STATUS_MOTOR': {
          const dir = packet.payload.direction as MotorDirection;
          updateMotorDetails(dir, motorState.speed);
          addLog('INFO', `ESP2 Motor Status: ${dir}`, line, 'ESP2');
          break;
        }

        case 'STATUS_RELAY': {
          const ch = packet.payload.channel as RelayChannel;
          const st = packet.payload.state as boolean;
          setRelayState((prev) => ({
            ...prev,
            channels: { ...prev.channels, [ch]: st },
          }));
          addLog('INFO', `ESP2 Relay ${ch}: ${st ? 'ON' : 'OFF'}`, line, 'ESP2');
          break;
        }

        case 'STATUS_SERVO': {
          const rawState = packet.payload.servoState as string;
          const sState = rawState === 'CW' ? 'CW' : rawState === 'CCW' ? 'CCW' : 'STOP';
          setServoState((prev) => ({
            ...prev,
            state: sState,
            value: sState === 'CW' ? 180 : sState === 'CCW' ? 0 : 90,
          }));
          addLog('INFO', `Servo: ${sState}`, line, 'ESP1');
          break;
        }

        case 'STATUS_BATTERY': {
          setSensorData((prev) => ({
            ...prev,
            batteryVoltage: packet.payload.voltage,
            batteryPercent: packet.payload.percent,
          }));
          break;
        }

        case 'STATUS_LINK': {
          if (packet.payload.rssi !== null) {
            setConnectionState((prev) => ({ ...prev, rssi: packet.payload.rssi }));
          }
          if (packet.payload.link === 'ESP2_WIFI' || packet.payload.link === 'WIFI') {
            setConnectionState((prev) => ({
              ...prev,
              laptopToEsp2Ws: packet.payload.state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
            }));
            addLog(
              'INFO',
              `ESP2 Link: ${packet.payload.state} (RSSI: ${packet.payload.rssi ?? 'N/A'} dBm)`,
              line,
              'ESP2'
            );
          }
          break;
        }

        case 'ACK': {
          if (packet.payload.command === 'PING') {
            addLog('ACK', 'ACK|PING [ESP2 WebSocket Link Verified]', line, 'ESP2');
          } else {
            addLog(
              'ACK',
              `ACK: ${packet.payload.command} ${packet.payload.detail || ''}`,
              line,
              'ESP2'
            );
          }
          break;
        }

        case 'ERROR': {
          setConnectionState((prev) => ({ ...prev, errorCount: prev.errorCount + 1 }));
          addLog('ERROR', `[${packet.payload.subsystem}] ${packet.payload.message}`, line, 'ESP2');
          break;
        }

        default:
          addLog('INFO', line, line, 'RAW');
          break;
      }
    },
    [thresholds, motorState.speed, updateMotorDetails, addLog]
  );

  // Serial/WebSocket hook integration
  const serial = useSerial({
    onPacketReceived: handlePacketReceived,
    onLog: addLog,
  });

  // Sync connection state with WebSocket status
  useEffect(() => {
    if (serial.isConnected) {
      setConnectionState((prev) => ({
        ...prev,
        laptopToEsp2Ws: 'CONNECTED',
        laptopToEsp4: 'CONNECTED',
        overallStatus: 'CONNECTED',
        portName: serial.portName,
        wsUrl: serial.wsUrl,
        lastError: null,
      }));
    } else {
      setConnectionState((prev) => ({
        ...prev,
        laptopToEsp2Ws: serial.isConnecting ? 'CONNECTING' : 'DISCONNECTED',
        laptopToEsp4: serial.isConnecting ? 'CONNECTING' : 'DISCONNECTED',
        esp2ToEsp1Uart: 'DISCONNECTED',
        overallStatus: serial.isConnecting ? 'CONNECTING' : 'DISCONNECTED',
        portName: null,
        lastError: serial.lastError,
      }));

      // Reset sensors to null (NO DATA) when disconnected
      setSensorData({
        temperature: null,
        humidity: null,
        mq135Raw: null,
        mq135CalibratedPpm: null,
        mq135Status: 'UNKNOWN',
        ultrasonicDistanceCm: null,
        irObstacle: null,
        batteryVoltage: null,
        batteryPercent: null,
        lastUpdated: null,
      });

      // Stop motors
      updateMotorDetails('STOP', 0);
    }
  }, [serial.isConnected, serial.isConnecting, serial.portName, serial.wsUrl, serial.lastError, updateMotorDetails]);

  // Send command packet over WebSocket
  const sendCommand = useCallback(
    async (
      cmdStr: string,
      category: 'MOTOR' | 'SERVO' | 'RELAY' | 'PING' | 'RAW',
      action: string
    ) => {
      const success = await serial.sendData(cmdStr);
      const now = Date.now();
      if (success) {
        setConnectionState((prev) => ({
          ...prev,
          packetsTx: prev.packetsTx + 1,
          lastPacketTxTimestamp: now,
        }));
        addLog('CMD', `${category} -> ${action}`, cmdStr.trim(), 'GCS');
      } else {
        addLog('ERROR', `Failed to send command: ${cmdStr.trim()}`, undefined, 'GCS');
      }
      return success;
    },
    [serial, addLog]
  );

  // Motor Control actions
  const sendMotorDirection = useCallback(
    async (direction: MotorDirection) => {
      const cmd = Protocol.motorDirection(direction);
      const success = await sendCommand(cmd, 'MOTOR', direction);
      if (success) {
        updateMotorDetails(direction, motorState.speed);
      }
    },
    [sendCommand, updateMotorDetails, motorState.speed]
  );

  const setMotorSpeed = useCallback(
    async (speed: number) => {
      const clamped = Math.max(0, Math.min(255, Math.round(speed)));
      setMotorState((prev) => ({ ...prev, speed: clamped }));
      const cmd = Protocol.motorSpeed(clamped);
      await sendCommand(cmd, 'MOTOR', `SPEED ${clamped}`);
    },
    [sendCommand]
  );

  // Emergency Stop action
  const emergencyStop = useCallback(async () => {
    // Send STOP immediately twice for reliability
    await sendCommand(Protocol.motorStop(), 'MOTOR', 'EMERGENCY STOP');
    updateMotorDetails('STOP', 0);
    addLog('ERROR', '🚨 EMERGENCY STOP ACTIVATED - ALL MOTORS HALTED 🚨', undefined, 'SAFETY');
  }, [sendCommand, updateMotorDetails, addLog]);

  // Relay Control actions
  const toggleRelay = useCallback(
    async (channel: RelayChannel) => {
      const targetState = !relayState.channels[channel];
      const cmd = Protocol.relaySet(channel, targetState);
      const success = await sendCommand(
        cmd,
        'RELAY',
        `Channel ${channel} -> ${targetState ? 'ON' : 'OFF'}`
      );
      if (success) {
        setRelayState((prev) => ({
          ...prev,
          channels: { ...prev.channels, [channel]: targetState },
        }));
      }
    },
    [relayState.channels, sendCommand]
  );

  // Continuous Rotation Servo actions
  // 90 = STOP, 180 = CW (or inverted), 0 = CCW (or inverted)
  const sendServoStop = useCallback(async () => {
    setServoState((prev) => ({
      ...prev,
      state: 'STOP',
      value: 90,
      angle: 90,
    }));
    await sendCommand(Protocol.servoStop(), 'SERVO', 'STOP');
  }, [sendCommand]);

  const sendServoCw = useCallback(
    async (customSpeed?: number) => {
      const speed = customSpeed ?? servoState.speed;
      const isInv = servoState.isInverted;
      const effectiveVal = isInv ? 0 : 180;
      setServoState((prev) => ({
        ...prev,
        state: 'CW',
        value: effectiveVal,
        angle: effectiveVal,
      }));
      const cmd = isInv ? Protocol.servoCcw(speed) : Protocol.servoCw(speed);
      await sendCommand(cmd, 'SERVO', `CW (${speed}%)`);
    },
    [servoState.speed, servoState.isInverted, sendCommand]
  );

  const sendServoCcw = useCallback(
    async (customSpeed?: number) => {
      const speed = customSpeed ?? servoState.speed;
      const isInv = servoState.isInverted;
      const effectiveVal = isInv ? 180 : 0;
      setServoState((prev) => ({
        ...prev,
        state: 'CCW',
        value: effectiveVal,
        angle: effectiveVal,
      }));
      const cmd = isInv ? Protocol.servoCw(speed) : Protocol.servoCcw(speed);
      await sendCommand(cmd, 'SERVO', `CCW (${speed}%)`);
    },
    [servoState.speed, servoState.isInverted, sendCommand]
  );

  const toggleServoInvert = useCallback(() => {
    setServoState((prev) => ({
      ...prev,
      isInverted: !prev.isInverted,
    }));
    addLog('INFO', 'Servo rotation direction inverted', undefined, 'SERVO');
  }, [addLog]);

  // Backward compatibility servo helpers
  const setServoAngle = useCallback(
    async (angle: number) => {
      if (angle === 90) {
        await sendServoStop();
      } else if (angle > 90) {
        await sendServoCw();
      } else {
        await sendServoCcw();
      }
    },
    [sendServoStop, sendServoCw, sendServoCcw]
  );

  const setServoSpin = useCallback(
    async (speed: number) => {
      if (speed === 0) {
        await sendServoStop();
      } else if (speed > 0) {
        await sendServoCw(speed);
      } else {
        await sendServoCcw(Math.abs(speed));
      }
    },
    [sendServoStop, sendServoCw, sendServoCcw]
  );

  const setServoMode = useCallback((mode: any) => {
    setServoState((prev) => ({ ...prev, mode }));
  }, []);

  const toggleAutoSweep360 = useCallback(() => {
    // Positional auto-sweep disabled for continuous rotation servo
    addLog('INFO', '360 positional sweep not applicable to continuous rotation servo');
  }, [addLog]);

  // Keyboard navigation controller
  // Per requirement 4: motors continue running until STOP or EMERGENCY STOP!
  const activeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when user is typing in input fields
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key.toUpperCase();
      if (activeKeysRef.current.has(key)) return; // Prevent repeated keydown spam

      if (key === 'W' || e.key === 'ArrowUp') {
        e.preventDefault();
        activeKeysRef.current.add(key);
        sendMotorDirection('FORWARD');
      } else if (key === 'S' || e.key === 'ArrowDown') {
        e.preventDefault();
        activeKeysRef.current.add(key);
        sendMotorDirection('BACKWARD');
      } else if (key === 'A' || e.key === 'ArrowLeft') {
        e.preventDefault();
        activeKeysRef.current.add(key);
        sendMotorDirection('LEFT');
      } else if (key === 'D' || e.key === 'ArrowRight') {
        e.preventDefault();
        activeKeysRef.current.add(key);
        sendMotorDirection('RIGHT');
      } else if (key === 'X') {
        e.preventDefault();
        sendMotorDirection('STOP');
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        emergencyStop();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key.toUpperCase();
      activeKeysRef.current.delete(key);
      // NOTE: Per requirement 4, NO auto-stop on keyup. Motors continue running until STOP ('X') or EMERGENCY STOP (Space).
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendMotorDirection, emergencyStop]);

  // Log management helpers
  const clearLogs = useCallback(() => setLogs([]), []);
  const togglePauseLogs = useCallback(() => setIsLogPaused((prev) => !prev), []);
  const exportLogs = useCallback(() => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] [${l.source || 'SYS'}] ${l.message} ${l.raw ? `(${l.raw})` : ''}`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strix_gcs_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return {
    serial,
    sensorData,
    thresholds,
    setThresholds,
    motorState,
    relayState,
    servoState,
    connectionState,
    setConnectionState,
    watchdog,
    setWatchdog,
    logs,
    isLogPaused,
    clearLogs,
    togglePauseLogs,
    exportLogs,
    addLog,
    sendMotorDirection,
    setMotorSpeed,
    emergencyStop,
    toggleRelay,
    sendServoStop,
    sendServoCw,
    sendServoCcw,
    toggleServoInvert,
    setServoAngle,
    setServoSpin,
    setServoMode,
    toggleAutoSweep360,
    sendCommand,
  };
}
