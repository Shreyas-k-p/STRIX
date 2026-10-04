import type {
  MotorDirection,
  RelayChannel,
  TelemetryPacket,
  SensorThresholds,
} from './types';

export const PROTOCOL_DELIMITER = '|';
export const LINE_TERMINATOR = '\n';

/**
 * Command builder: Formats high-level UI actions into Rover STRIX protocol strings
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

  // Continuous Rotation Servo commands
  // 90 = STOP, 180 = one direction (CW), 0 = opposite direction (CCW)
  servoStop(): string {
    return `CMD|SERVO|STOP${LINE_TERMINATOR}`;
  },

  servoCw(speed: number = 65): string {
    const spd = Math.round(speed) || 65;
    return `CMD|SERVO|CW|${spd}${LINE_TERMINATOR}`;
  },

  servoCcw(speed: number = 65): string {
    const spd = Math.round(speed) || 65;
    return `CMD|SERVO|CCW|${spd}${LINE_TERMINATOR}`;
  },

  servoValue(value: 0 | 90 | 180): string {
    return `CMD|SERVO|${value}${LINE_TERMINATOR}`;
  },

  // Legacy compatibility helpers
  servoAngle(angle: number): string {
    if (angle === 90) return this.servoStop();
    if (angle > 90) return this.servoCw();
    return this.servoCcw();
  },

  servoContinuous(speed: number): string {
    if (speed === 0) return this.servoStop();
    if (speed > 0) return this.servoCw(speed);
    return this.servoCcw(Math.abs(speed));
  },

  // Relay commands (Active LOW on hardware)
  relaySet(channel: RelayChannel, state: boolean): string {
    return `CMD|RELAY|${channel}|${state ? 'ON' : 'OFF'}${LINE_TERMINATOR}`;
  },

  // Ping / Heartbeat
  ping(): string {
    return `CMD|PING${LINE_TERMINATOR}`;
  },

  rawPing(): string {
    return 'PING';
  },

  // Raw command builder
  raw(cmd: string): string {
    return cmd.endsWith('\n') ? cmd : `${cmd}${LINE_TERMINATOR}`;
  },

  /**
   * Telemetry parser: Parses raw string lines received from ESP2 / ESP1
   */
  parseLine(line: string, thresholds: SensorThresholds): TelemetryPacket | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(PROTOCOL_DELIMITER);
    const prefix = parts[0]?.toUpperCase();
    const now = Date.now();

    try {
      // 1. SENSOR|TEMP|value, SENSOR|HUM|value, SENSOR|MQ135_RAW|value, SENSOR|DIST|value
      if (prefix === 'SENSOR') {
        const sensorType = parts[1]?.toUpperCase();
        const rawVal = parts[2];

        if (sensorType === 'TEMP') {
          const temp = parseFloat(rawVal);
          return {
            type: 'TEMP',
            raw: trimmed,
            timestamp: now,
            payload: {
              temperature: isNaN(temp) ? null : temp,
            },
          };
        }

        if (sensorType === 'HUM') {
          const hum = parseFloat(rawVal);
          return {
            type: 'HUM',
            raw: trimmed,
            timestamp: now,
            payload: {
              humidity: isNaN(hum) ? null : hum,
            },
          };
        }

        if (sensorType === 'MQ135_RAW' || sensorType === 'MQ135') {
          const rawAdc = parseInt(rawVal, 10);
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
              mq135CalibratedPpm: null,
              mq135Status: status,
            },
          };
        }

        if (sensorType === 'DIST') {
          const dist = parseFloat(rawVal);
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
          const val = (rawVal || '').trim().toUpperCase();
          let isObstacle: boolean | null = null;
          if (val === 'CLEAR' || val.includes('CLEAR')) {
            isObstacle = false;
          } else if (val === 'OBSTACLE' || val.includes('OBSTACLE')) {
            isObstacle = true;
          } else if (val === '0' || val === 'LOW') {
            isObstacle = true;
          } else if (val === '1' || val === 'HIGH') {
            isObstacle = false;
          }

          if (isObstacle === null) return null;

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

      // 2. DATA|TEMP=value|HUM=value|MQ135_RAW=value|DIST=value|IR=CLEAR/OBSTACLE
      if (prefix === 'DATA') {
        let temp: number | null = null;
        let hum: number | null = null;
        let mq135Raw: number | null = null;
        let dist: number | null = null;
        let irObstacle: boolean | null = null;

        for (let i = 1; i < parts.length; i++) {
          const segment = parts[i];
          const eqIdx = segment.indexOf('=');
          if (eqIdx === -1) continue;
          const k = segment.substring(0, eqIdx).trim().toUpperCase();
          const v = segment.substring(eqIdx + 1).trim();

          if (k === 'TEMP') {
            const val = parseFloat(v);
            if (!isNaN(val)) temp = val;
          } else if (k === 'HUM') {
            const val = parseFloat(v);
            if (!isNaN(val)) hum = val;
          } else if (k === 'MQ135_RAW' || k === 'MQ135') {
            const val = parseInt(v, 10);
            if (!isNaN(val)) mq135Raw = val;
          } else if (k === 'DIST') {
            const val = parseFloat(v);
            if (!isNaN(val)) dist = Math.max(0, val);
          } else if (k === 'IR') {
            const vClean = v.trim().toUpperCase();
            if (vClean === 'CLEAR' || vClean.includes('CLEAR')) {
              irObstacle = false;
            } else if (vClean === 'OBSTACLE' || vClean.includes('OBSTACLE')) {
              irObstacle = true;
            } else if (vClean === '0' || vClean === 'LOW') {
              irObstacle = true;
            } else if (vClean === '1' || vClean === 'HIGH') {
              irObstacle = false;
            }
          }
        }

        let status: 'CLEAN' | 'MODERATE' | 'HAZARDOUS' = 'CLEAN';
        if (mq135Raw !== null) {
          if (mq135Raw >= thresholds.mq135Danger) status = 'HAZARDOUS';
          else if (mq135Raw >= thresholds.mq135Warning) status = 'MODERATE';
        }

        return {
          type: 'DATA_MULTI',
          raw: trimmed,
          timestamp: now,
          payload: {
            temperature: temp,
            humidity: hum,
            mq135Raw,
            mq135CalibratedPpm: null,
            mq135Status: status,
            ultrasonicDistanceCm: dist,
            irObstacle,
          },
        };
      }

      // 3. TEL format compatibility (TEL|DHT|... TEL|MQ135|... TEL|ULTRASONIC|... TEL|IR|...)
      if (prefix === 'TEL') {
        const sensorType = parts[1]?.toUpperCase();

        if (sensorType === 'DHT') {
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
          const status = (parts[2] || '').trim().toUpperCase();
          let isObstacle = false;
          if (status === 'CLEAR' || status.includes('CLEAR')) {
            isObstacle = false;
          } else if (status === 'OBSTACLE' || status.includes('OBSTACLE') || status === '0') {
            isObstacle = true;
          }
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

      // 4. STATUS formats
      if (prefix === 'STATUS') {
        const sub = parts[1]?.toUpperCase();

        if (sub === 'MOTOR') {
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
          const state = parts[2]?.toUpperCase();
          return {
            type: 'STATUS_SERVO',
            raw: trimmed,
            timestamp: now,
            payload: {
              servoState: state || 'STOP',
            },
          };
        }

        if (sub === 'BATTERY') {
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
          // STATUS|LINK|ESP2_WIFI|CONNECTED|<RSSI>
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

      // 5. ACK format (ACK|PING, ACK|MOTOR|FORWARD, etc.)
      if (prefix === 'ACK' || trimmed === 'ACK') {
        return {
          type: 'ACK',
          raw: trimmed,
          timestamp: now,
          payload: {
            command: parts[1] || 'GENERIC',
            detail: parts.slice(2).join('|'),
          },
        };
      }

      // 6. ERROR format
      if (prefix === 'ERROR') {
        return {
          type: 'ERROR',
          raw: trimmed,
          timestamp: now,
          payload: {
            subsystem: parts[1] || 'ESP2',
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
