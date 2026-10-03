export interface SerialCallbacks {
  onPacket: (line: string) => void;
  onConnect: (info: { portName: string; baudRate: number }) => void;
  onDisconnect: (reason?: string) => void;
  onError: (error: string) => void;
}

export class SerialManager {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private keepReading = false;
  private readPromise: Promise<void> | null = null;
  private inputBuffer = '';
  private baudRate = 115200;
  private callbacks: SerialCallbacks;

  // Demo simulation state
  private isDemoMode = false;
  private demoInterval: any = null;

  constructor(callbacks: SerialCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isConnected(): boolean {
    return this.port !== null || this.isDemoMode;
  }

  public getIsDemoMode(): boolean {
    return this.isDemoMode;
  }

  public async connect(baudRate: number = 115200): Promise<boolean> {
    this.baudRate = baudRate;

    if (!this.isSupported()) {
      const msg = 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.';
      this.callbacks.onError(msg);
      throw new Error(msg);
    }

    try {
      // Request serial port from user prompt
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });

      this.keepReading = true;
      this.callbacks.onConnect({
        portName: 'ESP32 #4 (USB COM)',
        baudRate: this.baudRate,
      });

      // Start continuous asynchronous read loop
      this.readPromise = this.startReadLoop();
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // User cancelled the prompt
        return false;
      }
      const msg = err.message || 'Failed to open serial port';
      this.callbacks.onError(msg);
      await this.disconnect();
      throw err;
    }
  }

  public async disconnect(reason: string = 'User disconnected'): Promise<void> {
    if (this.isDemoMode) {
      this.stopDemoMode();
      this.callbacks.onDisconnect(reason);
      return;
    }

    this.keepReading = false;

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
    } catch {
      // Ignore reader cancel errors
    }

    try {
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
    } catch {
      // Ignore writer release errors
    }

    if (this.readPromise) {
      try {
        await this.readPromise;
      } catch {
        // Ignore read loop errors
      }
      this.readPromise = null;
    }

    try {
      if (this.port) {
        await this.port.close();
      }
    } catch {
      // Ignore close errors
    } finally {
      this.port = null;
      this.inputBuffer = '';
      this.callbacks.onDisconnect(reason);
    }
  }

  public async write(data: string): Promise<boolean> {
    if (this.isDemoMode) {
      // In demo mode, simulate echoing ACK back to telemetry
      this.handleDemoCommand(data);
      return true;
    }

    if (!this.port || !this.port.writable) {
      this.callbacks.onError('Cannot write: Serial port is not connected');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      
      const writer = this.port.writable.getWriter();
      await writer.write(encoded);
      writer.releaseLock();
      return true;
    } catch (err: any) {
      this.callbacks.onError(`Write failed: ${err.message || 'Unknown error'}`);
      return false;
    }
  }

  private async startReadLoop(): Promise<void> {
    const textDecoder = new TextDecoder();

    while (this.port && this.port.readable && this.keepReading) {
      try {
        this.reader = this.port.readable.getReader();

        while (this.keepReading) {
          const { value, done } = await this.reader.read();
          if (done) break;

          if (value) {
            const chunk = textDecoder.decode(value, { stream: true });
            this.processInputChunk(chunk);
          }
        }
      } catch (err: any) {
        if (this.keepReading) {
          this.callbacks.onError(`Serial read error: ${err.message || 'Device disconnected'}`);
        }
        break;
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch {
            // Ignore
          }
          this.reader = null;
        }
      }
    }

    if (this.keepReading) {
      // Unexpected loop exit
      await this.disconnect('Serial device connection lost');
    }
  }

  private processInputChunk(chunk: string): void {
    this.inputBuffer += chunk;
    const lines = this.inputBuffer.split(/\r?\n/);
    // Keep whatever is after the last newline in the buffer
    this.inputBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.callbacks.onPacket(trimmed);
      }
    }
  }

  // ================= DEMO MODE (For UI Testing & Development) =================
  public startDemoMode(): void {
    if (this.port) {
      this.disconnect();
    }
    this.isDemoMode = true;
    this.callbacks.onConnect({
      portName: 'DEMO VIRTUAL PORT',
      baudRate: 115200,
    });

    let step = 0;
    this.demoInterval = setInterval(() => {
      step++;
      
      // Emit sensor telemetry
      const temp = (27 + Math.sin(step / 10) * 4).toFixed(1);
      const hum = (58 + Math.cos(step / 12) * 8).toFixed(1);
      this.callbacks.onPacket(`TEL|DHT|${temp}|${hum}`);

      const rawMq = Math.round(1450 + Math.sin(step / 5) * 400);
      this.callbacks.onPacket(`TEL|MQ135|${rawMq}`);

      const dist = (35 + Math.sin(step / 8) * 20).toFixed(1);
      this.callbacks.onPacket(`TEL|ULTRASONIC|${dist}`);

      const irState = (step % 12 === 0) ? 'OBSTACLE' : 'CLEAR';
      this.callbacks.onPacket(`TEL|IR|${irState}`);

      if (step % 5 === 0) {
        const bat = (11.8 - (step % 50) * 0.02).toFixed(2);
        const pct = Math.max(20, Math.round(85 - (step % 50) * 0.5));
        this.callbacks.onPacket(`STATUS|BATTERY|${bat}|${pct}`);
      }

      if (step % 10 === 0) {
        this.callbacks.onPacket(`STATUS|LINK|NRF24|CONNECTED|-65`);
      }
    }, 800);
  }

  public stopDemoMode(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.isDemoMode = false;
  }

  private handleDemoCommand(cmd: string): void {
    const trimmed = cmd.trim();
    const parts = trimmed.split('|');
    if (parts[0] === 'CMD') {
      const type = parts[1];
      if (type === 'MOTOR') {
        const dir = parts[2];
        setTimeout(() => {
          this.callbacks.onPacket(`ACK|MOTOR|${dir}`);
          this.callbacks.onPacket(`STATUS|MOTOR|${dir}`);
        }, 30);
      } else if (type === 'RELAY') {
        const ch = parts[2];
        const state = parts[3];
        setTimeout(() => {
          this.callbacks.onPacket(`ACK|RELAY|${ch}|${state}`);
          this.callbacks.onPacket(`STATUS|RELAY|${ch}|${state}`);
        }, 30);
      } else if (type === 'SERVO') {
        const sub = parts[2];
        if (sub === 'SPIN') {
          const speed = parts[3];
          setTimeout(() => {
            this.callbacks.onPacket(`ACK|SERVO|SPIN|${speed}`);
          }, 30);
        } else if (sub === 'STOP') {
          setTimeout(() => {
            this.callbacks.onPacket(`ACK|SERVO|STOP`);
          }, 30);
        } else {
          const angle = sub;
          setTimeout(() => {
            this.callbacks.onPacket(`ACK|SERVO|${angle}`);
            this.callbacks.onPacket(`STATUS|SERVO|${angle}`);
          }, 30);
        }
      } else if (type === 'PING') {
        setTimeout(() => {
          this.callbacks.onPacket(`ACK|PING`);
        }, 20);
      }
    }
  }
}
