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
import { Terminal, AlertCircle } from 'lucide-react';

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
    sendServoStop,
    sendServoCw,
    sendServoCcw,
    toggleServoInvert,
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

  // Camera state (Independent ESP32-S3 Wi-Fi feed)
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
    // Camera status tracked independently
    if (status === 'CONNECTED') {
      addLog('INFO', 'ESP32-S3 Camera video stream connected', undefined, 'CAM');
    }
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
        onSendPing={() => serial.sendPing()}
        onToggleDemo={() => serial.toggleDemoMode()}
        onEmergencyStop={emergencyStop}
        onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Realtime Mission Ticker */}
      <div className="bg-black/95 border-b border-emerald-500/30 px-4 py-1 text-[11px] font-mono text-emerald-400 flex items-center justify-between overflow-x-auto shadow-inner select-none">
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 font-black text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            [STRIX_GCS: ONLINE]
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">LINK: WS://10.82.165.164:81</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">MAIN: ESP2 (DUAL L298N + 4 RELAYS)</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">BUS: ESP2 ↔ ESP1 UART</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-500/80">VIDEO: ESP32-S3 WI-FI DIRECT</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[10px]">
          <span className="text-emerald-500/70">
            [SERVO: {servoState.state} ({servoState.value})]
          </span>
          <span className="text-emerald-300 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
            STATUS: {connectionState.overallStatus}
          </span>
        </div>
      </div>

      {/* Connection error notice if disconnected with error */}
      {serial.lastError && (
        <div className="bg-rose-950/90 border-b border-rose-600/70 px-4 py-2 text-xs font-mono text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Connection Error: <strong>{serial.lastError}</strong>. Ensure your laptop is connected to Wi-Fi SSID <strong>"REY"</strong> and ESP2 is powered at <strong>10.82.165.164:81</strong>.
            </span>
          </div>
          <button
            onClick={() => serial.connect()}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[11px] shrink-0 ml-2"
          >
            RETRY CONNECT
          </button>
        </div>
      )}

      {/* Main Ground Station Dashboard Container */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1920px] mx-auto w-full space-y-4">
        {/* ROW 1: PRIMARY MISSION COCKPIT (LEFT: Camera | CENTER: Joystick | RIGHT: Sensors) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* 1. Live Camera Panel (Independent ESP32-S3 Stream) */}
          <div className="lg:col-span-4 xl:col-span-5 flex flex-col">
            <CameraPanel
              cameraState={cameraState}
              onUpdateCameraUrl={handleUpdateCameraUrl}
              onLog={addLog}
              onCameraStatusChange={handleCameraStatusChange}
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
          {/* 4. Motor Status Panel (Dual L298N 4 Channels) */}
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

          {/* 6. Continuous Rotation Servo Controller Panel */}
          <div className="flex flex-col">
            <ServoPanel
              servoState={servoState}
              onSendStop={sendServoStop}
              onSendCw={sendServoCw}
              onSendCcw={sendServoCcw}
              onToggleInvert={toggleServoInvert}
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

          {/* 8. Event / Debug Log Console with Command Injector (7 cols) */}
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
          <span>STRIX GROUND CONTROL STATION &bull; ESP2 MAIN WEBSOCKET</span>
          <span className="text-[10px] text-emerald-400 font-bold">[ARMED]</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>LINK: <strong className="text-emerald-400">ws://10.82.165.164:81</strong></span>
          <span>MOTORS: <strong className="text-emerald-400">4x H-BRIDGE (ESP2)</strong></span>
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
