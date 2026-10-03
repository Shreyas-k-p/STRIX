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

const INITIAL_MOTORS: MotorDetail[] = [
  { id: 1, name: 'Front-Left', driver: 1, direction: 'STOP', isOn: false, speed: 0 },
  { id: 2, name: 'Mid-Left', driver: 1, direction: 'STOP', isOn: false, speed: 0 },
  { id: 3, name: 'Rear-Left', driver: 1, direction: 'STOP', isOn: false, speed: 0 },
  { id: 4, name: 'Front-Right', driver: 2, direction: 'STOP', isOn: false, speed: 0 },
  { id: 5, name: 'Mid-Right', driver: 2, direction: 'STOP', isOn: false, speed: 0 },
  { id: 6, name: 'Rear-Right', driver: 2, direction: 'STOP', isOn: false, speed: 0 },
];

export function useRover() {
  // Thresholds state
  const [thresholds, setThresholds] = useState<SensorThresholds>(DEFAULT_THRESHOLDS);

  // Sensor state: Null values by default when disconnected!
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

  // Relay state
  const [relayState, setRelayState] = useState<RelayState>({
    channels: { 1: false, 2: false, 3: false, 4: false },
    labels: {
      1: 'Relay 1: Headlights',
      2: 'Relay 2: Aux Power 12V',
      3: 'Relay 3: Sensor Heater',
      4: 'Relay 4: Payload Disarm',
    },
    requiresConfirmation: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
  });

  // Servo state (0° to 360° support)
  const [servoState, setServoState] = useState<ServoState>({
    angle: 0,
    mode: 'POSITION_360',
    isContinuous: false,
    speed: 0,
    trim: 0,
    isAutoSweeping: false,
  });

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    laptopToEsp4: 'DISCONNECTED',
    esp4ToEsp2Nrf24: 'DISCONNECTED',
    esp2ToEsp1Uart: 'DISCONNECTED',
    esp2ToEsp3Uart: 'DISCONNECTED',
    cameraWifi: 'DISCONNECTED',
    overallStatus: 'DISCONNECTED',
    portName: null,
    baudRate: 115200,
    rssi: null,
    packetsTx: 0,
    packetsRx: 0,
    errorCount: 0,
    lastPacketRxTimestamp: null,
    lastPacketTxTimestamp: null,
    latencyMs: null,
  });

  // Watchdog configuration
  const [watchdog, setWatchdog] = useState<WatchdogConfig>({
    timeoutMs: 300,
    enabled: true,
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
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        level,
        message,
        raw,
        source,
      };

      setLogs((prev) => {
        const next = [...prev, newEntry];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    },
    [isLogPaused]
  );

  // Parse incoming telemetry packets
  const handlePacketReceived = useCallback(
    (line: string) => {
      const now = Date.now();

      setConnectionState((prev) => ({
        ...prev,
        packetsRx: prev.packetsRx + 1,
        lastPacketRxTimestamp: now,
        esp4ToEsp2Nrf24: 'CONNECTED',
      }));

      // Update watchdog acknowledgment
      setWatchdog((prev) => ({
        ...prev,
        lastAckReceived: now,
        isTriggered: false,
      }));

      const packet = Protocol.parseLine(line, thresholds);
      if (!packet) return;

      switch (packet.type) {
        case 'DHT': {
          setSensorData((prev) => ({
            ...prev,
            temperature: packet.payload.temperature,
            humidity: packet.payload.humidity,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog('TEL', `DHT11 -> Temp: ${packet.payload.temperature}°C, Hum: ${packet.payload.humidity}%`, line, 'ESP32 #1');
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
            `MQ-135 -> Raw ADC: ${packet.payload.mq135Raw} (${packet.payload.mq135Status})`,
            line,
            'ESP32 #1'
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
          addLog('TEL', `HC-SR04 -> Dist: ${packet.payload.ultrasonicDistanceCm} cm`, line, 'ESP32 #1');
          break;
        }

        case 'IR': {
          setSensorData((prev) => ({
            ...prev,
            irObstacle: packet.payload.irObstacle,
            lastUpdated: now,
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp1Uart: 'CONNECTED' }));
          addLog('TEL', `IR Sensor -> ${packet.payload.irObstacle ? 'OBSTACLE DETECTED' : 'CLEAR'}`, line, 'ESP32 #1');
          break;
        }

        case 'STATUS_MOTOR': {
          const dir = packet.payload.direction as MotorDirection;
          updateMotorDetails(dir, motorState.speed);
          setConnectionState((prev) => ({ ...prev, esp2ToEsp3Uart: 'CONNECTED' }));
          addLog('INFO', `Motor Status: ${dir}`, line, 'ESP32 #3');
          break;
        }

        case 'STATUS_RELAY': {
          const ch = packet.payload.channel as RelayChannel;
          const st = packet.payload.state as boolean;
          setRelayState((prev) => ({
            ...prev,
            channels: { ...prev.channels, [ch]: st },
          }));
          setConnectionState((prev) => ({ ...prev, esp2ToEsp3Uart: 'CONNECTED' }));
          addLog('INFO', `Relay ${ch} Status: ${st ? 'ON' : 'OFF'}`, line, 'ESP32 #3');
          break;
        }

        case 'STATUS_SERVO': {
          setServoState((prev) => ({ ...prev, angle: packet.payload.angle }));
          addLog('INFO', `Servo Angle: ${packet.payload.angle}°`, line, 'ESP32 #2');
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
          break;
        }

        case 'ACK': {
          addLog('ACK', `ACK received: ${packet.payload.command} ${packet.payload.detail || ''}`, line);
          break;
        }

        case 'ERROR': {
          setConnectionState((prev) => ({ ...prev, errorCount: prev.errorCount + 1 }));
          addLog('ERROR', `[${packet.payload.subsystem}] ${packet.payload.message}`, line);
          break;
        }

        default:
          addLog('INFO', line, line);
          break;
      }
    },
    [thresholds, motorState.speed, addLog]
  );

  // Serial hook integration
  const serial = useSerial({
    onPacketReceived: handlePacketReceived,
    onLog: addLog,
  });

  // Sync connection state with serial
  useEffect(() => {
    if (serial.isConnected) {
      setConnectionState((prev) => ({
        ...prev,
        laptopToEsp4: 'CONNECTED',
        overallStatus: 'CONNECTED',
        portName: serial.portName,
        baudRate: serial.baudRate,
      }));
    } else {
      setConnectionState((prev) => ({
        ...prev,
        laptopToEsp4: serial.isConnecting ? 'CONNECTING' : 'DISCONNECTED',
        esp4ToEsp2Nrf24: 'DISCONNECTED',
        esp2ToEsp1Uart: 'DISCONNECTED',
        esp2ToEsp3Uart: 'DISCONNECTED',
        overallStatus: 'DISCONNECTED',
        portName: null,
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
  }, [serial.isConnected, serial.isConnecting, serial.portName, serial.baudRate]);

  // Update detail states of the 6 motors
  const updateMotorDetails = useCallback((dir: MotorDirection, speed: number) => {
    setMotorState((prev) => {
      const isMoving = dir !== 'STOP';
      const actualSpeed = isMoving ? speed : 0;

      const updatedMotors: MotorDetail[] = prev.motors.map((m) => {
        let motorDir: 'FWD' | 'REV' | 'STOP' = 'STOP';
        if (dir === 'FORWARD') motorDir = 'FWD';
        else if (dir === 'BACKWARD') motorDir = 'REV';
        else if (dir === 'LEFT') {
          // Skid-steer left: left motors reverse, right motors forward
          motorDir = m.driver === 1 ? 'REV' : 'FWD';
        } else if (dir === 'RIGHT') {
          // Skid-steer right: left motors forward, right motors reverse
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

  // Send command packet over serial
  const sendCommand = useCallback(
    async (cmdStr: string, category: 'MOTOR' | 'SERVO' | 'RELAY' | 'PING' | 'RAW', action: string) => {
      const success = await serial.sendData(cmdStr);
      const now = Date.now();
      if (success) {
        setConnectionState((prev) => ({
          ...prev,
          packetsTx: prev.packetsTx + 1,
          lastPacketTxTimestamp: now,
        }));
        setWatchdog((prev) => ({
          ...prev,
          lastHeartbeatSent: now,
        }));
        addLog('CMD', `${category} -> ${action}`, cmdStr.trim());
      } else {
        addLog('ERROR', `Failed to send command: ${cmdStr.trim()}`);
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
    // Send STOP immediately twice for redundancy
    await sendCommand(Protocol.motorStop(), 'MOTOR', 'EMERGENCY STOP');
    updateMotorDetails('STOP', 0);
    // Beep or visual indicator
    addLog('ERROR', '🚨 EMERGENCY STOP ACTIVATED - ALL MOTORS HALTED 🚨');
  }, [sendCommand, updateMotorDetails, addLog]);

  // Relay Control actions
  const toggleRelay = useCallback(
    async (channel: RelayChannel) => {
      const targetState = !relayState.channels[channel];
      const cmd = Protocol.relaySet(channel, targetState);
      const success = await sendCommand(cmd, 'RELAY', `Channel ${channel} -> ${targetState ? 'ON' : 'OFF'}`);
      if (success) {
        setRelayState((prev) => ({
          ...prev,
          channels: { ...prev.channels, [channel]: targetState },
        }));
      }
    },
    [relayState.channels, sendCommand]
  );

  // Servo Control actions (supports 0° to 360° & continuous spin)
  const setServoAngle = useCallback(
    async (angle: number) => {
      const clamped = Math.max(0, Math.min(360, Math.round(angle)));
      setServoState((prev) => ({ ...prev, angle: clamped }));
      const cmd = Protocol.servoAngle(clamped);
      await sendCommand(cmd, 'SERVO', `ANGLE ${clamped}°`);
    },
    [sendCommand]
  );

  const setServoSpin = useCallback(
    async (speed: number) => {
      const clamped = Math.max(-100, Math.min(100, Math.round(speed)));
      setServoState((prev) => ({
        ...prev,
        speed: clamped,
        isContinuous: clamped !== 0,
        isAutoSweeping: false,
      }));
      const cmd = clamped === 0 ? Protocol.servoStop() : Protocol.servoContinuous(clamped);
      await sendCommand(cmd, 'SERVO', clamped === 0 ? 'STOP SPIN' : `SPIN ${clamped}%`);
    },
    [sendCommand]
  );

  const setServoMode = useCallback((mode: 'POSITION_360' | 'CONTINUOUS_ROTATION') => {
    setServoState((prev) => ({ ...prev, mode }));
  }, []);

  const toggleAutoSweep360 = useCallback(() => {
    setServoState((prev) => ({ ...prev, isAutoSweeping: !prev.isAutoSweeping }));
  }, []);

  // Auto-sweep effect for panoramic 360 rotation
  useEffect(() => {
    if (!servoState.isAutoSweeping) return;

    let current = servoState.angle;
    let forward = true;
    const interval = setInterval(() => {
      if (forward) {
        current += 15;
        if (current >= 360) {
          current = 360;
          forward = false;
        }
      } else {
        current -= 15;
        if (current <= 0) {
          current = 0;
          forward = true;
        }
      }
      setServoAngle(current);
    }, 250);

    return () => clearInterval(interval);
  }, [servoState.isAutoSweeping, setServoAngle]);

  // Watchdog monitor: Auto-stop if moving and communication times out
  useEffect(() => {
    if (!watchdog.enabled || !serial.isConnected) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // If rover is moving, verify watchdog
      if (motorState.isMoving) {
        const timeSinceAck = now - (watchdog.lastAckReceived || watchdog.lastHeartbeatSent);

        if (timeSinceAck > watchdog.timeoutMs) {
          // Watchdog timeout exceeded!
          setWatchdog((prev) => ({ ...prev, isTriggered: true }));
          setConnectionState((prev) => ({ ...prev, overallStatus: 'COMMUNICATION_LOST' }));
          addLog('ERROR', `COMMUNICATION WATCHDOG TIMEOUT (${timeSinceAck}ms > ${watchdog.timeoutMs}ms)! Stopping rover.`);
          emergencyStop();
        } else {
          // Ping to maintain heartbeat
          sendCommand(Protocol.ping(), 'PING', 'HEARTBEAT');
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [
    watchdog.enabled,
    watchdog.timeoutMs,
    watchdog.lastAckReceived,
    watchdog.lastHeartbeatSent,
    serial.isConnected,
    motorState.isMoving,
    emergencyStop,
    sendCommand,
    addLog,
  ]);

  // Keyboard navigation controller
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

      // If directional keys are released and no movement key is held down, auto stop
      const isMoveKey =
        key === 'W' ||
        key === 'S' ||
        key === 'A' ||
        key === 'D' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight';

      if (isMoveKey) {
        const stillHeld =
          activeKeysRef.current.has('W') ||
          activeKeysRef.current.has('S') ||
          activeKeysRef.current.has('A') ||
          activeKeysRef.current.has('D') ||
          activeKeysRef.current.has('ARROWUP') ||
          activeKeysRef.current.has('ARROWDOWN') ||
          activeKeysRef.current.has('ARROWLEFT') ||
          activeKeysRef.current.has('ARROWRIGHT');

        if (!stillHeld && motorState.isMoving) {
          sendMotorDirection('STOP');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendMotorDirection, emergencyStop, motorState.isMoving]);

  // Log management helpers
  const clearLogs = useCallback(() => setLogs([]), []);
  const togglePauseLogs = useCallback(() => setIsLogPaused((prev) => !prev), []);
  const exportLogs = useCallback(() => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message} ${l.raw ? `(${l.raw})` : ''}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rover_gcs_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
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
    setServoAngle,
    setServoSpin,
    setServoMode,
    toggleAutoSweep360,
    sendCommand,
  };
}
