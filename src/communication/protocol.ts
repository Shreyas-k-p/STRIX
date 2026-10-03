import type {
  MotorDirection,
  RelayChannel,
  TelemetryPacket,
  SensorThresholds,
} from './types';

export const PROTOCOL_DELIMITER = '|';
export const LINE_TERMINATOR = '\n';

/**
 * Command builder: Formats high-level UI actions into Rover serial protocol strings
 */
export const Protocol = {
  // Motor commands
  motorDirection(direction: MotorDirection): string {
    return `CMD|MOTOR|${direction}${LINE_TERMINATOR}`;
  },

  motorSpeed(speed: number): string {
    const clamped = Math.max(0, Math.min(255, Math.round(speed)));
    return `CMD|MOTOR|SPEED|${clamped}${LINE_TERMINATOR}`;
  },

  motorStop(): string {
    return `CMD|MOTOR|STOP${LINE_TERMINATOR}`;
  },

  // Servo commands (supports 0° to 360° rotation)
  servoAngle(angle: number): string {
    const clamped = Math.max(0, Math.min(360, Math.round(angle)));
    return `CMD|SERVO|${clamped}${LINE_TERMINATOR}`;
  },

  servoContinuous(speed: number): string {
    const clamped = Math.max(-100, Math.min(100, Math.round(speed)));
    return `CMD|SERVO|SPIN|${clamped}${LINE_TERMINATOR}`;
  },

  servoStop(): string {
    return `CMD|SERVO|STOP${LINE_TERMINATOR}`;
  },

  // Relay commands
  relaySet(channel: RelayChannel, state: boolean): string {
    return `CMD|RELAY|${channel}|${state ? 'ON' : 'OFF'}${LINE_TERMINATOR}`;
  },

  // Ping / Heartbeat for communication watchdog
  ping(): string {
    return `CMD|PING${LINE_TERMINATOR}`;
  },

  // Raw command builder
  raw(cmd: string): string {
    return cmd.endsWith('\n') ? cmd : `${cmd}${LINE_TERMINATOR}`;
  },

  /**
   * Telemetry parser: Parses raw string lines received from ESP32 #4
   */
  parseLine(line: string, thresholds: SensorThresholds): TelemetryPacket | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(PROTOCOL_DELIMITER);
    const prefix = parts[0]?.toUpperCase();
    const now = Date.now();

    try {
      if (prefix === 'TEL') {
        const sensorType = parts[1]?.toUpperCase();

        if (sensorType === 'DHT') {
          // TEL|DHT|<temp>|<humidity>
          const temp = parseFloat(parts[2]);
          const hum = parseFloat(parts[3]);
          return {
            type: 'DHT',
            raw: trimmed,
            timestamp: now,
            payload: {
              temperature: isNaN(temp) ? null : temp,
              humidity: isNaN(hum) ? null : hum,
            },
          };
        }

        if (sensorType === 'MQ135') {
          // TEL|MQ135|<raw_adc>[|<calibrated_ppm>]
          const rawAdc = parseInt(parts[2], 10);
          const calibratedPpm = parts[3] ? parseFloat(parts[3]) : null;

          let status: 'CLEAN' | 'MODERATE' | 'HAZARDOUS' = 'CLEAN';
          if (!isNaN(rawAdc)) {
            if (rawAdc >= thresholds.mq135Danger) {
              status = 'HAZARDOUS';
            } else if (rawAdc >= thresholds.mq135Warning) {
              status = 'MODERATE';
            }
          }

          return {
            type: 'MQ135',
            raw: trimmed,
            timestamp: now,
            payload: {
              mq135Raw: isNaN(rawAdc) ? null : rawAdc,
              mq135CalibratedPpm: isNaN(calibratedPpm as number) ? null : calibratedPpm,
              mq135Status: status,
            },
          };
        }

        if (sensorType === 'ULTRASONIC') {
          // TEL|ULTRASONIC|<distance_cm>
          const dist = parseFloat(parts[2]);
          return {
            type: 'ULTRASONIC',
            raw: trimmed,
            timestamp: now,
            payload: {
              ultrasonicDistanceCm: isNaN(dist) ? null : Math.max(0, dist),
            },
          };
        }

        if (sensorType === 'IR') {
          // TEL|IR|<CLEAR|OBSTACLE>
          const status = parts[2]?.toUpperCase();
          const isObstacle = status === 'OBSTACLE' || status === '1' || status === 'DETECTED';
          return {
            type: 'IR',
            raw: trimmed,
            timestamp: now,
            payload: {
              irObstacle: isObstacle,
            },
          };
        }
      }

      if (prefix === 'STATUS') {
        const sub = parts[1]?.toUpperCase();

        if (sub === 'MOTOR') {
          // STATUS|MOTOR|<STOPPED|FORWARD|BACKWARD|LEFT|RIGHT>
          const rawDir = parts[2]?.toUpperCase() || 'STOP';
          const dir: MotorDirection =
            rawDir === 'FORWARD' || rawDir === 'BACKWARD' || rawDir === 'LEFT' || rawDir === 'RIGHT'
              ? rawDir
              : 'STOP';

          return {
            type: 'STATUS_MOTOR',
            raw: trimmed,
            timestamp: now,
            payload: {
              direction: dir,
              isMoving: dir !== 'STOP',
            },
          };
        }

        if (sub === 'RELAY') {
          // STATUS|RELAY|<channel>|<ON|OFF>
          const channel = parseInt(parts[2], 10) as RelayChannel;
          const state = parts[3]?.toUpperCase() === 'ON';
          return {
            type: 'STATUS_RELAY',
            raw: trimmed,
            timestamp: now,
            payload: {
              channel,
              state,
            },
          };
        }

        if (sub === 'SERVO') {
          // STATUS|SERVO|<angle>
          const angle = parseInt(parts[2], 10);
          return {
            type: 'STATUS_SERVO',
            raw: trimmed,
            timestamp: now,
            payload: {
              angle: isNaN(angle) ? 90 : angle,
            },
          };
        }

        if (sub === 'BATTERY') {
          // STATUS|BATTERY|<voltage>|<percent>
          const v = parseFloat(parts[2]);
          const pct = parseFloat(parts[3]);
          return {
            type: 'STATUS_BATTERY',
            raw: trimmed,
            timestamp: now,
            payload: {
              voltage: isNaN(v) ? null : v,
              percent: isNaN(pct) ? null : pct,
            },
          };
        }

        if (sub === 'LINK') {
          // STATUS|LINK|<LINK_NAME>|<CONNECTED|DISCONNECTED>|<RSSI>
          const link = parts[2]?.toUpperCase();
          const state = parts[3]?.toUpperCase();
          const rssi = parts[4] ? parseInt(parts[4], 10) : null;
          return {
            type: 'STATUS_LINK',
            raw: trimmed,
            timestamp: now,
            payload: {
              link,
              state: state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
              rssi: isNaN(rssi as number) ? null : rssi,
            },
          };
        }
      }

      if (prefix === 'ACK') {
        // ACK|MOTOR|FORWARD or ACK|RELAY|1|ON or ACK|SERVO|90 or ACK|PING
        return {
          type: 'ACK',
          raw: trimmed,
          timestamp: now,
          payload: {
            command: parts[1],
            detail: parts.slice(2).join('|'),
          },
        };
      }

      if (prefix === 'ERROR') {
        // ERROR|NRF24|TIMEOUT or ERROR|UART|FRAME
        return {
          type: 'ERROR',
          raw: trimmed,
          timestamp: now,
          payload: {
            subsystem: parts[1],
            message: parts.slice(2).join('|') || 'Unknown error',
          },
        };
      }

      return {
        type: 'UNKNOWN',
        raw: trimmed,
        timestamp: now,
        payload: { parts },
      };
    } catch {
      return {
        type: 'UNKNOWN',
        raw: trimmed,
        timestamp: now,
        payload: { error: 'Parse exception' },
      };
    }
  },
};
