import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketManager, ESP2_WS_URL } from '../communication/websocket';

export interface UseSerialOptions {
  onPacketReceived: (packet: string) => void;
  onLog: (level: 'INFO' | 'CMD' | 'TEL' | 'ACK' | 'ERROR', message: string, raw?: string) => void;
}

export function useSerial({ onPacketReceived, onLog }: UseSerialOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [portName, setPortName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [wsUrl, setWsUrlState] = useState<string>(ESP2_WS_URL);
  const [lastError, setLastError] = useState<string | null>(null);

  const callbacksRef = useRef({ onPacketReceived, onLog });
  useEffect(() => {
    callbacksRef.current = { onPacketReceived, onLog };
  }, [onPacketReceived, onLog]);

  const managerRef = useRef<WebSocketManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new WebSocketManager({
      url: wsUrl,
      onPacket: (message) => callbacksRef.current.onPacketReceived(message),
      onConnect: () => {
        setIsConnected(true);
        setIsConnecting(false);
        setLastError(null);
        setPortName(`ESP2 Wi-Fi [${managerRef.current?.getUrl() || ESP2_WS_URL}]`);
        callbacksRef.current.onLog(
          'INFO',
          `Connected to ESP2 over Wi-Fi WebSocket (${managerRef.current?.getUrl() || ESP2_WS_URL})`
        );
      },
      onDisconnect: (reason) => {
        setIsConnected(false);
        setIsConnecting(false);
        setPortName(null);
        callbacksRef.current.onLog(
          'INFO',
          'ESP2 disconnected: ' + (reason || 'Connection closed')
        );
      },
      onError: (error) => {
        setIsConnecting(false);
        setLastError(error);
        callbacksRef.current.onLog('ERROR', error);
      },
    });
  }

  useEffect(() => {
    setIsSupported(managerRef.current?.isSupported() ?? false);
  }, []);

  const connect = useCallback(async (customUrl?: string) => {
    if (!managerRef.current) return false;
    const target = customUrl || wsUrl;
    setIsConnecting(true);
    setLastError(null);
    callbacksRef.current.onLog('INFO', `Connecting to ESP2 WebSocket at ${target}...`);
    const result = await managerRef.current.connect(target);
    setIsConnecting(false);
    return result;
  }, [wsUrl]);

  const disconnect = useCallback(async () => {
    if (!managerRef.current) return;
    await managerRef.current.disconnect();
    setIsDemoMode(false);
    setLastError(null);
  }, []);

  const sendData = useCallback(async (data: string) => {
    if (!managerRef.current) return false;
    return managerRef.current.write(data);
  }, []);

  const sendPing = useCallback(async () => {
    if (!managerRef.current) return false;
    callbacksRef.current.onLog('CMD', 'Sending PING to ESP2', 'PING');
    return managerRef.current.write('PING');
  }, []);

  const setTargetUrl = useCallback((url: string) => {
    setWsUrlState(url);
    if (managerRef.current) {
      managerRef.current.setUrl(url);
    }
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((current) => {
      const next = !current;
      setIsConnected(next);
      setPortName(next ? 'DEMO VIRTUAL LINK' : null);
      callbacksRef.current.onLog(
        'INFO',
        next
          ? 'DEMO MODE ACTIVATED - Virtual Link'
          : 'Demo mode deactivated'
      );
      return next;
    });
  }, []);

  return {
    isConnected,
    isDemoMode,
    isConnecting,
    isSupported,
    portName,
    wsUrl,
    setWsUrl: setTargetUrl,
    baudRate: 0,
    lastError,
    connect,
    disconnect,
    sendData,
    sendPing,
    toggleDemoMode,
  };
}