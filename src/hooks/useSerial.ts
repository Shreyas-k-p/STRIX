import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketManager } from '../communication/websocket';

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

  const callbacksRef = useRef({ onPacketReceived, onLog });
  useEffect(() => { callbacksRef.current = { onPacketReceived, onLog }; }, [onPacketReceived, onLog]);

  const managerRef = useRef<WebSocketManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new WebSocketManager({
      onPacket: (message) => callbacksRef.current.onPacketReceived(message),
      onConnect: () => {
        setIsConnected(true);
        setIsConnecting(false);
        setPortName('ESP2 Wi-Fi / WebSocket');
        callbacksRef.current.onLog('INFO', 'Connected to ESP2 over Wi-Fi WebSocket');
      },
      onDisconnect: (reason) => {
        setIsConnected(false);
        setIsConnecting(false);
        setPortName(null);
        callbacksRef.current.onLog('INFO', 'ESP2 disconnected: ' + (reason || 'Connection closed'));
      },
      onError: (error) => {
        setIsConnecting(false);
        callbacksRef.current.onLog('ERROR', error);
      },
    });
  }

  useEffect(() => { setIsSupported(managerRef.current?.isSupported() ?? false); }, []);

  const connect = useCallback(async () => {
    if (!managerRef.current) return false;
    setIsConnecting(true);
    const result = await managerRef.current.connect();
    setIsConnecting(false);
    return result;
  }, []);

  const disconnect = useCallback(async () => {
    if (!managerRef.current) return;
    await managerRef.current.disconnect();
    setIsDemoMode(false);
  }, []);

  const sendData = useCallback(async (data: string) => {
    if (!managerRef.current) return false;
    return managerRef.current.write(data);
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((current) => {
      const next = !current;
      setIsConnected(next);
      setPortName(next ? 'DEMO VIRTUAL LINK' : null);
      callbacksRef.current.onLog('INFO', next ? 'DEMO MODE ACTIVATED - Simulating telemetry' : 'Demo mode deactivated');
      return next;
    });
  }, []);

  return {
    isConnected, isDemoMode, isConnecting, isSupported, portName,
    baudRate: 0, connect, disconnect, sendData, toggleDemoMode,
  };
}