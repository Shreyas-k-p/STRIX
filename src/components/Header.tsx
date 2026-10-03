import React from 'react';
import {
  Radio,
  Wifi,
  BatteryCharging,
  BatteryMedium,
  BatteryLow,
  Zap,
  Square,
  Cpu,
  Settings,
  Terminal,
  Skull,
  Palette,
} from 'lucide-react';
import type { ConnectionState, WatchdogConfig, SensorData } from '../communication/types';

export type GcsTheme = 'HACKER_MATRIX' | 'TACTICAL_AMBER' | 'NASA_CYAN' | 'STEALTH_DARK';

interface HeaderProps {
  connection: ConnectionState;
  watchdog: WatchdogConfig;
  sensorData: SensorData;
  isDemoMode: boolean;
  isSupported: boolean;
  isConnecting: boolean;
  activeTheme: GcsTheme;
  onChangeTheme: (theme: GcsTheme) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendPing?: () => void;
  onToggleDemo: () => void;
  onEmergencyStop: () => void;
  onOpenHardwareModal: () => void;
  onOpenSettingsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connection,
  sensorData,
  isDemoMode,
  isSupported,
  isConnecting,
  activeTheme,
  onChangeTheme,
  onConnect,
  onDisconnect,
  onSendPing,
  onToggleDemo,
  onEmergencyStop,
  onOpenHardwareModal,
  onOpenSettingsModal,
}) => {
  const isConnected = connection.laptopToEsp2Ws === 'CONNECTED' || connection.overallStatus === 'CONNECTED';

  // Battery status icon helper
  const getBatteryIcon = () => {
    if (sensorData.batteryPercent === null) {
      return <BatteryMedium className="w-4 h-4 text-slate-600" />;
    }
    if (sensorData.batteryPercent > 60) {
      return <BatteryCharging className="w-4 h-4 text-emerald-400" />;
    }
    if (sensorData.batteryPercent > 25) {
      return <BatteryMedium className="w-4 h-4 text-amber-400" />;
    }
    return <BatteryLow className="w-4 h-4 text-rose-500 animate-pulse" />;
  };

  return (
    <header className="bg-black/95 border-b border-emerald-500/40 sticky top-0 z-40 backdrop-blur-md px-3 sm:px-6 py-2.5 shadow-[0_4px_25px_rgba(0,255,65,0.15)] font-mono">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Hacker Root Terminal Prompt Branding */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded bg-black border-2 border-emerald-500/70 shadow-[0_0_15px_rgba(0,255,65,0.4)]">
            <Skull className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-90" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 text-xs font-black select-none">&gt;</span>
              <h1 className="text-lg sm:text-xl font-black tracking-wider text-white font-heading glow-matrix">
                STRIX_GCS
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold tracking-widest shadow-sm">
                ESP2_WIFI_v2.0
              </span>
            </div>
            <p className="text-[11px] text-emerald-500/80 font-mono hidden sm:flex items-center gap-2">
              <Terminal className="w-3 h-3 text-emerald-400" />
              <span>strix@rover-esp2:~$ ws://10.82.165.164:81 [TCP/PORT 81]</span>
              <span className="animate-blink text-emerald-400 font-black">_</span>
            </p>
          </div>
        </div>

        {/* Center: Realtime Telemetry Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          {/* ESP2 WebSocket Link */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded border font-mono ${
              isConnected
                ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(0,255,65,0.3)]'
                : isConnecting
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-300 animate-pulse'
                : 'bg-black border-slate-800 text-slate-600'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-slate-400">ESP2_WS:</span>
            <span className="font-black">
              {isConnected
                ? 'CONNECTED (10.82.165.164:81)'
                : isConnecting
                ? 'CONNECTING...'
                : 'DISCONNECTED'}
            </span>
            {connection.rssi !== null && (
              <span className="text-[10px] text-cyan-400 font-bold">[{connection.rssi}dBm]</span>
            )}
          </div>

          {/* Wi-Fi Direct Camera */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded border font-mono ${
              connection.cameraWifi === 'CONNECTED'
                ? 'bg-cyan-950/40 border-cyan-500/80 text-cyan-300 shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                : 'bg-black border-slate-800 text-slate-600'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-slate-400">CAM_TAP:</span>
            <span className="font-black">
              {connection.cameraWifi === 'CONNECTED' ? 'LIVE' : 'STANDBY'}
            </span>
          </div>

          {/* Battery Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-black border border-slate-800 text-slate-300">
            {getBatteryIcon()}
            <span className="font-bold text-slate-400">PWR:</span>
            <span className="font-black text-emerald-400">
              {sensorData.batteryPercent !== null
                ? `${sensorData.batteryPercent}% (${sensorData.batteryVoltage}V)`
                : 'NO DATA'}
            </span>
          </div>

          {/* Active Ping Test button if connected */}
          {isConnected && onSendPing && (
            <button
              onClick={onSendPing}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 font-bold text-xs transition-colors shadow-sm"
              title="Send PING packet to verify roundtrip communication"
            >
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>TEST PING</span>
            </button>
          )}
        </div>

        {/* Right: Theme Switcher, Hardware Connect & Emergency Killswitch */}
        <div className="flex items-center gap-2">
          {/* Live Theme Switcher dropdown */}
          <div className="relative flex items-center bg-black border border-emerald-500/50 rounded px-2 py-1 gap-1 text-xs font-mono">
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={activeTheme}
              onChange={(e) => onChangeTheme(e.target.value as GcsTheme)}
              className="bg-transparent text-emerald-300 font-bold focus:outline-none cursor-pointer text-[11px]"
              title="Switch Visual HUD Style"
            >
              <option value="HACKER_MATRIX" className="bg-[#020408] text-emerald-400">
                🟢 Hacker Cyberdeck (Matrix)
              </option>
              <option value="TACTICAL_AMBER" className="bg-[#080a0f] text-amber-400">
                ⚡ Tactical Military Amber
              </option>
              <option value="NASA_CYAN" className="bg-[#080a0f] text-cyan-400">
                🚀 NASA Mission Cyan
              </option>
              <option value="STEALTH_DARK" className="bg-[#080a0f] text-slate-300">
                🕶️ Stealth EV Dark
              </option>
            </select>
          </div>

          {/* Demo Mode Toggle */}
          <button
            onClick={onToggleDemo}
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded border transition-all ${
              isDemoMode
                ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_15px_rgba(0,255,65,0.8)] animate-pulse'
                : 'bg-black text-slate-400 border-slate-800 hover:border-emerald-500/60 hover:text-emerald-300'
            }`}
            title="Toggle simulated hardware telemetry for testing"
          >
            {isDemoMode ? '● SIM_ACTIVE' : 'DEMO MODE'}
          </button>

          {/* ESP2 WebSocket Connect / Disconnect */}
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600 text-xs font-black font-mono transition-all shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              DISCONNECT
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting || !isSupported}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-black font-mono transition-all shadow-lg ${
                !isSupported
                  ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                  : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black border border-emerald-300 shadow-[0_0_18px_rgba(0,255,65,0.6)]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              {isConnecting ? 'CONNECTING...' : 'CONNECT_ESP2'}
            </button>
          )}

          {/* Hardware Blueprint Modal */}
          <button
            onClick={onOpenHardwareModal}
            className="p-1.5 rounded bg-black hover:bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/50 transition-colors"
            title="Hardware Architecture & Schematics"
          >
            <Cpu className="w-4 h-4" />
          </button>

          {/* Settings Modal */}
          <button
            onClick={onOpenSettingsModal}
            className="p-1.5 rounded bg-black hover:bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/50 transition-colors"
            title="Configure Thresholds & Endpoints"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Big Header Tactical E-STOP */}
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:scale-95 text-white font-black text-xs uppercase tracking-widest border border-red-400 shadow-[0_0_20px_rgba(255,0,51,0.8)] font-mono transition-all"
            title="EMERGENCY STOP (SPACE)"
          >
            <Zap className="w-4 h-4 fill-white animate-bounce" />
            E-STOP
          </button>
        </div>
      </div>
    </header>
  );
};
