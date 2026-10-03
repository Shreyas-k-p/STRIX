import { useState } from 'react';
import { useRover } from './hooks/useRover';
import { Header } from './components/Header';
import type { GcsTheme } from './components/Header';
import { CameraPanel } from './components/CameraPanel';
import { RoverJoystick } from './components/RoverJoystick';
import { SensorDashboard } from './components/SensorDashboard';
import { MotorPanel } from './components/MotorPanel';
import { RelayPanel } from './components/RelayPanel';
import { ServoPanel } from './components/ServoPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import { EventLog } from './components/EventLog';
import { EmergencyStop } from './components/EmergencyStop';
import { HardwareInfoModal } from './components/HardwareInfoModal';
import { SettingsModal } from './components/SettingsModal';
import type { CameraState } from './communication/types';
import { AlertTriangle, Terminal } from 'lucide-react';

export function App() {
  const {
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
  } = useRover();

  // Modals state
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<GcsTheme>('HACKER_MATRIX');

  // Camera state
  const [cameraState, setCameraState] = useState<CameraState>({
    url: 'http://192.168.4.1:81/stream',
    status: 'IDLE',
    fps: 0,
    resolution: '640x480',
    isStreaming: true,
    aspectRatio: '16:9',
    lastFrameTimestamp: null,
  });

  const handleUpdateCameraUrl = (url: string) => {
    setCameraState((prev) => ({ ...prev, url }));
  };

  const handleCameraStatusChange = (status: 'CONNECTED' | 'DISCONNECTED') => {
    setConnectionState((prev) => ({
      ...prev,
      cameraWifi: status,
    }));
  };

  const handleSendRaw = (cmd: string) => {
    sendCommand(cmd, 'RAW', `RAW: ${cmd}`);
  };

  return (
    <div
      className={`min-h-screen ${
        activeTheme === 'HACKER_MATRIX'
          ? 'hacker-matrix-bg selection:bg-emerald-500 selection:text-black'
          : activeTheme === 'TACTICAL_AMBER'
          ? 'tactical-grid-bg selection:bg-amber-500 selection:text-black'
          : activeTheme === 'NASA_CYAN'
          ? 'nasa-cyan-bg selection:bg-cyan-500 selection:text-black'
          : 'bg-black selection:bg-slate-500 selection:text-white'
      } text-slate-100 flex flex-col font-mono`}
    >
      {/* Top GCS Navigation & Status Header */}
      <Header
        connection={connectionState}
        watchdog={watchdog}
        sensorData={sensorData}
        isDemoMode={serial.isDemoMode}
        isSupported={serial.isSupported}
        isConnecting={serial.isConnecting}
        activeTheme={activeTheme}
        onChangeTheme={setActiveTheme}
        onConnect={() => serial.connect()}
        onDisconnect={() => serial.disconnect()}
        onToggleDemo={() => serial.toggleDemoMode()}
        onEmergencyStop={emergencyStop}
        onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Cyber Warfare Ticker / Rover Rootkit HUD */}
      <div className="bg-black/95 border-b border-emerald-500/30 px-4 py-1 text-[11px] font-mono text-emerald-400 flex items-center justify-between overflow-x-auto shadow-inner select-none">
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 font-black text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            [PWN_ACTIVE: ROOTKIT_STRIX_v2]
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">TARGET: 4x ESP32 CLUSTER</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">RF: NRF24L01+ 2.4GHz</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">SERIAL: 115200 BAUD</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">FAILSAFE: 300MS WATCHDOG</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[10px]">
          <span className="text-emerald-500/70">[TURRET AZIMUTH: {servoState.angle.toString().padStart(3, '0')}°]</span>
          <span className="text-emerald-500/70">[MODE: {servoState.mode}]</span>
          <span className="text-emerald-300 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
            PWN LEVEL: 100% ROOT
          </span>
        </div>
      </div>

      {/* Browser Web Serial Support Warning */}
      {!serial.isSupported && (
        <div className="bg-amber-950/80 border-b border-amber-600/70 px-4 py-2 text-xs font-mono text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Web Serial API is not supported in this browser. To connect to physical ESP32 #4 hardware, use <strong>Google Chrome, Microsoft Edge, or Opera</strong>. You can test all controls using <strong>DEMO MODE</strong>.
            </span>
          </div>
          <button
            onClick={() => serial.toggleDemoMode()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded text-[11px] shrink-0 ml-2"
          >
            ACTIVATE DEMO MODE
          </button>
        </div>
      )}

      {/* Watchdog / Communication Lost Alert Banner */}
      {connectionState.overallStatus === 'COMMUNICATION_LOST' && (
        <div className="bg-rose-950 border-b-2 border-rose-600 px-4 py-2.5 text-xs font-mono text-rose-200 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span className="font-bold tracking-wide">
              ⚠️ COMMUNICATION TIMEOUT DETECTED! Automatic Emergency Stop engaged. Motors halted to prevent runaway.
            </span>
          </div>
          <button
            onClick={emergencyStop}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded text-xs hover:bg-rose-500"
          >
            ACKNOWLEDGE & DISARM
          </button>
        </div>
      )}

      {/* Main Ground Station Dashboard Container */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1920px] mx-auto w-full space-y-4">
        {/* ROW 1: PRIMARY MISSION COCKPIT (LEFT: Camera | CENTER: Joystick | RIGHT: Sensors) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* 1. Live Camera Panel with Click-To-Aim Turret Slaving (5 cols) */}
          <div className="lg:col-span-4 xl:col-span-5 flex flex-col">
            <CameraPanel
              cameraState={cameraState}
              onUpdateCameraUrl={handleUpdateCameraUrl}
              onLog={addLog}
              onCameraStatusChange={handleCameraStatusChange}
              onRotateServo={setServoAngle}
              servoAngle={servoState.angle}
            />
          </div>

          {/* 2. Rover Propulsion Joystick & D-Pad (4 cols) */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col">
            <RoverJoystick
              motorState={motorState}
              onDirectionChange={sendMotorDirection}
              onSpeedChange={setMotorSpeed}
              onEmergencyStop={emergencyStop}
              isConnected={serial.isConnected}
            />
          </div>

          {/* 3. Sensor Telemetry Dashboard (3 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col">
            <SensorDashboard
              sensorData={sensorData}
              thresholds={thresholds}
              onUpdateThresholds={setThresholds}
              isConnected={serial.isConnected}
            />
          </div>
        </div>

        {/* Global Safety Interlock Banner */}
        <EmergencyStop motorState={motorState} onEmergencyStop={emergencyStop} />

        {/* ROW 2: HARDWARE SUBSYSTEM PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* 4. Motor Status Panel (Dual L298N & 6 Motors) */}
          <div className="flex flex-col">
            <MotorPanel motorState={motorState} />
          </div>

          {/* 5. Relay Control Panel (4 Channels) */}
          <div className="flex flex-col">
            <RelayPanel
              relayState={relayState}
              onToggleRelay={toggleRelay}
              isConnected={serial.isConnected}
            />
          </div>

          {/* 6. Servo Controller Panel (ESP32 #2 Gimbal - 14 Rotation Modalities) */}
          <div className="flex flex-col">
            <ServoPanel
              servoState={servoState}
              onSetAngle={setServoAngle}
              onSetSpin={setServoSpin}
              onSetMode={setServoMode}
              onToggleAutoSweep={toggleAutoSweep360}
              isConnected={serial.isConnected}
            />
          </div>
        </div>

        {/* ROW 3: CONNECTION TOPOLOGY & DEBUG TERMINAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* 7. Connection Topology Graph (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <ConnectionPanel connection={connectionState} />
          </div>

          {/* 8. Event / Debug Log Console with Exploit Injector (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <EventLog
              logs={logs}
              isPaused={isLogPaused}
              onClear={clearLogs}
              onTogglePause={togglePauseLogs}
              onExport={exportLogs}
              onSendRawCommand={handleSendRaw}
            />
          </div>
        </div>
      </main>

      {/* Footer System Line */}
      <footer className="border-t border-emerald-500/25 bg-black/95 px-4 py-2.5 text-xs text-emerald-500/70 flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>ROVER CONTROL CENTER &bull; ESP32-CLUSTER CYBERDECK GCS</span>
          <span className="text-[10px] text-emerald-400 font-bold">[PWN_READY]</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>NRF24: <strong className="text-emerald-400">2.4GHz MESH</strong></span>
          <span>WATCHDOG: <strong className="text-emerald-400">{watchdog.timeoutMs}ms</strong></span>
          <span>VIDEO: <strong className="text-emerald-400">ESP32-S3 WI-FI DIRECT</strong></span>
        </div>
      </footer>

      {/* Hardware Architecture Modal */}
      <HardwareInfoModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        watchdog={watchdog}
        thresholds={thresholds}
        onSaveWatchdog={setWatchdog}
        onSaveThresholds={setThresholds}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}

export default App;
