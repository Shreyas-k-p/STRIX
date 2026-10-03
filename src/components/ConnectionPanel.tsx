import React from 'react';
import {
  Network,
  Usb,
  Radio,
  Wifi,
  Cpu,
  Layers,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { ConnectionState } from '../communication/types';

interface ConnectionPanelProps {
  connection: ConnectionState;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ connection }) => {
  const getBadge = (status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING') => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            <CheckCircle className="w-3 h-3 text-emerald-400" /> [LINK LOCKED]
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-black px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500 animate-pulse">
            <AlertCircle className="w-3 h-3 text-amber-400" /> [SYNCHRONIZING]
          </span>
        );
      case 'DISCONNECTED':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800">
            <XCircle className="w-3 h-3" /> [NO CARRIER]
          </span>
        );
    }
  };

  const links = [
    {
      title: 'Laptop GCS ↔ ESP32 #4',
      sub: 'USB Serial Bus @ 115200 Baud',
      status: connection.laptopToEsp4,
      icon: <Usb className="w-4 h-4 text-amber-400" />,
    },
    {
      title: 'ESP32 #4 ↔ NRF24 ↔ ESP32 #2',
      sub: `NRF24L01+ 2.4GHz RF Uplink ${connection.rssi ? `[RSSI: ${connection.rssi} dBm]` : ''}`,
      status: connection.esp4ToEsp2Nrf24,
      icon: <Radio className="w-4 h-4 text-amber-400" />,
    },
    {
      title: 'ESP32 #2 ↔ ESP32 #1 UART',
      sub: 'Recon Sensor Telemetry Bus (DHT, MQ, Ultrasonic, IR)',
      status: connection.esp2ToEsp1Uart,
      icon: <Layers className="w-4 h-4 text-amber-400" />,
    },
    {
      title: 'ESP32 #2 ↔ ESP32 #3 UART',
      sub: 'Actuator & Relay Command Bus (6WD + 4 Relays)',
      status: connection.esp2ToEsp3Uart,
      icon: <Cpu className="w-4 h-4 text-amber-400" />,
    },
    {
      title: 'ESP32-S3 Camera ↔ Wi-Fi Direct',
      sub: 'Dedicated 802.11 b/g/n High-Bandwidth Video Feed',
      status: connection.cameraWifi,
      icon: <Wifi className="w-4 h-4 text-cyan-400" />,
    },
  ];

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/25 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 font-heading">
            COMMUNICATION TOPOLOGY & MESH STATUS
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">
            TX: <strong className="text-amber-400 font-black">{connection.packetsTx}</strong>
          </span>
          <span className="text-slate-400">
            RX: <strong className="text-emerald-400 font-black">{connection.packetsRx}</strong>
          </span>
          <span className="text-slate-400">
            ERR: <strong className="text-rose-400 font-black">{connection.errorCount}</strong>
          </span>
        </div>
      </div>

      {/* 5 Hardware Links Cards */}
      <div className="space-y-2 flex-1">
        {links.map((link) => (
          <div
            key={link.title}
            className="flex items-center justify-between bg-slate-950/90 p-2.5 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-slate-900 border border-amber-500/30">
                {link.icon}
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-slate-200">
                  {link.title}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {link.sub}
                </div>
              </div>
            </div>

            <div>{getBadge(link.status)}</div>
          </div>
        ))}
      </div>

      {/* Packet Latency & Timestamp Footer */}
      <div className="mt-3 pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400">
        <div>
          Last TX:{' '}
          <span className="text-slate-200 font-bold">
            {connection.lastPacketTxTimestamp
              ? `${Math.round((Date.now() - connection.lastPacketTxTimestamp) / 100) / 10}s ago`
              : 'None'}
          </span>
        </div>
        <div>
          Last RX:{' '}
          <span className="text-slate-200 font-bold">
            {connection.lastPacketRxTimestamp
              ? `${Math.round((Date.now() - connection.lastPacketRxTimestamp) / 100) / 10}s ago`
              : 'None'}
          </span>
        </div>
        <div>
          Link Quality:{' '}
          <span className="text-amber-400 font-bold">
            {connection.rssi ? `${connection.rssi} dBm (Nominal)` : 'Optimal'}
          </span>
        </div>
        <div>
          Watchdog Protocol:{' '}
          <span className="text-emerald-400 font-bold">ARMED (300ms)</span>
        </div>
      </div>
    </div>
  );
};
