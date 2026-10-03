import { useState, useEffect, useRef, useCallback } from 'react';
import { SerialManager } from '../communication/serial';

export interface UseSerialOptions {
  onPacketReceived: (packet: string) => void;
  onLog: (level: 'INFO' | 'CMD' | 'TEL' | 'ACK' | 'ERROR', message: string, raw?: string) => void;
}

export function useSerial({ onPacketReceived, onLog }: UseSerialOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [portName, setPortName] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Keep stable callbacks in ref to avoid recreating serialManager
  const callbacksRef = useRef({ onPacketReceived, onLog });
  useEffect(() => {
    callbacksRef.current = { onPacketReceived, onLog };
  });

  const serialManagerRef = useRef<SerialManager | null>(null);

  if (!serialManagerRef.current) {
    serialManagerRef.current = new SerialManager({
      onPacket: (line: string) => {
        callbacksRef.current.onPacketReceived(line);
      },
      onConnect: (info) => {
        setIsConnected(true);
        setPortName(info.portName);
        setBaudRate(info.baudRate);
        setIsConnecting(false);
        callbacksRef.current.onLog('INFO', `Connected to ${info.portName} @ ${info.baudRate} baud`);
      },
      onDisconnect: (reason) => {
        setIsConnected(false);
        setPortName(null);
        setIsConnecting(false);
        callbacksRef.current.onLog('INFO', `Disconnected: ${reason || 'Port closed'}`);
      },
      onError: (error) => {
        setIsConnecting(false);
        callbacksRef.current.onLog('ERROR', error);
      },
    });
  }

  useEffect(() => {
    if (serialManagerRef.current) {
      setIsSupported(serialManagerRef.current.isSupported());
    }
  }, []);

  const connect = useCallback(async (rate = 115200) => {
    if (!serialManagerRef.current) return false;
    setIsConnecting(true);
    try {
      const res = await serialManagerRef.current.connect(rate);
      setIsConnecting(false);
      return res;
    } catch {
      setIsConnecting(false);
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!serialManagerRef.current) return;
    await serialManagerRef.current.disconnect();
    setIsDemoMode(false);
  }, []);

  const sendData = useCallback(async (data: string) => {
    if (!serialManagerRef.current) return false;
    return await serialManagerRef.current.write(data);
  }, []);

  const toggleDemoMode = useCallback(() => {
    if (!serialManagerRef.current) return;
    if (isDemoMode) {
      serialManagerRef.current.stopDemoMode();
      setIsDemoMode(false);
      setIsConnected(false);
      setPortName(null);
      callbacksRef.current.onLog('INFO', 'Demo mode deactivated');
    } else {
      setIsDemoMode(true);
      serialManagerRef.current.startDemoMode();
      callbacksRef.current.onLog('INFO', 'DEMO MODE ACTIVATED - Simulating telemetry');
    }
  }, [isDemoMode]);

  return {
    isConnected,
    isDemoMode,
    isConnecting,
    isSupported,
    portName,
    baudRate,
    connect,
    disconnect,
    sendData,
    toggleDemoMode,
  };
}
