/**
 * Browser WebSocket transport for the rover.
 * ESP2 advertises "rover-esp2.local" and exposes TCP port 81.
 */
export const DEFAULT_ESP2_HOST = import.meta.env.VITE_ESP2_HOST || '10.82.165.164';
export const DEFAULT_ESP2_PORT = import.meta.env.VITE_ESP2_PORT || '81';
export const ESP2_WS_URL = `ws://${DEFAULT_ESP2_HOST}:${DEFAULT_ESP2_PORT}`;

export interface WebSocketManagerOptions {
  url?: string;
  onPacket: (message: string) => void;
  onConnect: () => void;
  onDisconnect: (reason?: string) => void;
  onError: (message: string) => void;
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manualDisconnect = false;
  private connecting = false;
  private targetUrl: string;
  private readonly options: WebSocketManagerOptions;

  constructor(options: WebSocketManagerOptions) {
    this.options = options;
    this.targetUrl = options.url || ESP2_WS_URL;
  }

  getUrl(): string {
    return this.targetUrl;
  }

  setUrl(url: string) {
    this.targetUrl = url;
  }

  isSupported(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async connect(url?: string): Promise<boolean> {
    if (url) {
      this.targetUrl = url;
    }

    if (!this.isSupported()) {
      this.options.onError('WebSocket is not supported by this browser.');
      return false;
    }

    this.manualDisconnect = false;

    if (this.isConnected()) {
      return true;
    }
    if (this.connecting) {
      return false;
    }

    this.clearReconnectTimer();
    this.connecting = true;

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      try {
        const ws = new WebSocket(this.targetUrl);
        this.socket = ws;

        ws.onopen = () => {
          this.connecting = false;
          this.options.onConnect();
          ws.send('PING');
          settle(true);
        };

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            this.options.onPacket(event.data);
          }
        };

        ws.onerror = () => {
          this.connecting = false;
          this.options.onError(
            'ESP2 WebSocket connection failed: ' + this.targetUrl
          );
          settle(false);
        };

        ws.onclose = (event) => {
          this.connecting = false;

          if (this.socket === ws) {
            this.socket = null;
          }

          this.options.onDisconnect(
            event.reason || 'WebSocket closed (code ' + event.code + ')'
          );

          settle(false);

          if (!this.manualDisconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.connecting = false;
        this.options.onError(
          'Unable to create ESP2 WebSocket: ' +
            (error instanceof Error ? error.message : String(error))
        );
        settle(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();

    const ws = this.socket;
    this.socket = null;
    this.connecting = false;

    if (!ws) return;

    try {
      ws.close(1000, 'User disconnected');
    } catch {
      // Ignore close errors.
    }
  }

  async write(data: string): Promise<boolean> {
    if (!this.isConnected() || !this.socket) {
      return false;
    }

    try {
      console.log(`WS TX: ${data.trim()}`);
      this.socket.send(data);
      return true;
    } catch (error) {
      this.options.onError(
        'ESP2 WebSocket send failed: ' +
          (error instanceof Error ? error.message : String(error))
      );
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.manualDisconnect || this.reconnectTimer !== null) return;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 2000);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
