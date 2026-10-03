import React, { useState } from 'react';
import {
  Thermometer,
  Wind,
  Ruler,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Radio,
} from 'lucide-react';
import type { SensorData, SensorThresholds } from '../communication/types';

interface SensorDashboardProps {
  sensorData: SensorData;
  thresholds: SensorThresholds;
  onUpdateThresholds: (thresholds: SensorThresholds) => void;
  isConnected: boolean;
}

export const SensorDashboard: React.FC<SensorDashboardProps> = ({
  sensorData,
  thresholds,
  onUpdateThresholds,
  isConnected,
}) => {
  const [isEditingThresholds, setIsEditingThresholds] = useState<boolean>(false);
  const [tempConfig, setTempConfig] = useState<SensorThresholds>(thresholds);

  // Helper for Temperature status
  const getTempStatus = (temp: number | null): 'NOMINAL' | 'ELEVATED' | 'CRITICAL' => {
    if (temp === null) return 'NOMINAL';
    if (temp >= thresholds.tempDanger) return 'CRITICAL';
    if (temp >= thresholds.tempWarning) return 'ELEVATED';
    return 'NOMINAL';
  };

  // Helper for Distance status
  const getDistanceStatus = (dist: number | null): 'CLEAR' | 'PROXIMITY' | 'IMPACT IMMINENT' => {
    if (dist === null) return 'CLEAR';
    if (dist <= thresholds.ultrasonicDangerCm) return 'IMPACT IMMINENT';
    if (dist <= thresholds.ultrasonicWarningCm) return 'PROXIMITY';
    return 'CLEAR';
  };

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateThresholds(tempConfig);
    setIsEditingThresholds(false);
  };

  const tempStatus = getTempStatus(sensorData.temperature);
  const distStatus = getDistanceStatus(sensorData.ultrasonicDistanceCm);

  return (
    <div className="hud-panel rounded-xl p-4 flex flex-col justify-between h-full font-mono">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-amber-500/25 pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-200 font-heading">
            RECON SENSOR SUITE [ESP32 #1]
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditingThresholds(!isEditingThresholds)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950 hover:bg-slate-900 text-amber-400 border border-amber-500/40 text-[11px] font-mono transition-colors font-bold"
            title="Configure warning and danger thresholds"
          >
            <Sliders className="w-3 h-3" />
            THRESHOLDS
          </button>
        </div>
      </div>

      {/* Thresholds Config Flyout */}
      {isEditingThresholds && (
        <form
          onSubmit={handleSaveThresholds}
          className="my-2 p-3 bg-slate-950 rounded-lg border border-amber-500/50 text-xs font-mono flex flex-col gap-2 shadow-xl"
        >
          <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1">
            <span>DEFENSE SENSOR THRESHOLDS</span>
            <button
              type="button"
              onClick={() => setIsEditingThresholds(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">Temp Warn (°C)</label>
              <input
                type="number"
                step="0.5"
                value={tempConfig.tempWarning}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, tempWarning: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-amber-300 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Temp Danger (°C)</label>
              <input
                type="number"
                step="0.5"
                value={tempConfig.tempDanger}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, tempDanger: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-red-400 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">MQ-135 Warn ADC</label>
              <input
                type="number"
                value={tempConfig.mq135Warning}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, mq135Warning: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-amber-300 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">MQ-135 Hazard ADC</label>
              <input
                type="number"
                value={tempConfig.mq135Danger}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, mq135Danger: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-red-400 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Prox Warn (cm)</label>
              <input
                type="number"
                value={tempConfig.ultrasonicWarningCm}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    ultrasonicWarningCm: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-amber-300 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Prox Danger (cm)</label>
              <input
                type="number"
                value={tempConfig.ultrasonicDangerCm}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    ultrasonicDangerCm: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-red-400 font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button
              type="submit"
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded"
            >
              Apply Limits
            </button>
          </div>
        </form>
      )}

      {/* Sensor Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 flex-1">
        {/* Card 1: DHT11 Atmospheric Telemetry */}
        <div className="bg-slate-950/90 rounded-xl border border-amber-500/20 p-3.5 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Thermometer className="w-4 h-4 text-amber-400" />
              <span>ATMOSPHERIC [DHT11]</span>
            </div>
            {sensorData.temperature !== null ? (
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  tempStatus === 'CRITICAL'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse'
                    : tempStatus === 'ELEVATED'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                }`}
              >
                [{tempStatus}]
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-600 font-bold">NO DATA</span>
            )}
          </div>

          <div className="flex items-baseline justify-around py-2">
            <div className="text-center">
              <div className="text-2xl font-black font-mono tracking-tight text-white glow-amber">
                {sensorData.temperature !== null ? `${sensorData.temperature.toFixed(1)}°C` : 'NO DATA'}
              </div>
              <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">CORE THERMAL</div>
            </div>

            <div className="w-px h-10 bg-slate-800 self-center" />

            <div className="text-center">
              <div className="text-2xl font-black font-mono tracking-tight text-cyan-300">
                {sensorData.humidity !== null ? `${sensorData.humidity.toFixed(1)}%` : 'NO DATA'}
              </div>
              <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">HUMIDITY</div>
            </div>
          </div>

          <div className="text-[9px] font-mono text-slate-500 text-right mt-1">
            UPLINK: ESP32 #1 UART
          </div>
        </div>

        {/* Card 2: MQ-135 Gas & Air Quality */}
        <div className="bg-slate-950/90 rounded-xl border border-amber-500/20 p-3.5 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Wind className="w-4 h-4 text-amber-400" />
              <span>AIR QUALITY [MQ-135]</span>
            </div>
            {sensorData.mq135Raw !== null ? (
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  sensorData.mq135Status === 'HAZARDOUS'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse'
                    : sensorData.mq135Status === 'MODERATE'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                }`}
              >
                [{sensorData.mq135Status}]
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-600 font-bold">NO DATA</span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div className="text-2xl font-black font-mono tracking-tight text-white glow-amber">
              {sensorData.mq135Raw !== null ? sensorData.mq135Raw : 'NO DATA'}
            </div>
            <div className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">
              RAW 12-BIT ADC VOLTAGE
            </div>
            {sensorData.mq135CalibratedPpm !== null && (
              <div className="text-xs font-mono text-emerald-400 font-bold mt-1">
                Calibrated: {sensorData.mq135CalibratedPpm} PPM
              </div>
            )}
          </div>

          <div className="text-[9px] font-mono text-slate-500 text-center mt-1">
            * Uncalibrated voltage reading (0–4095), not PPM.
          </div>
        </div>

        {/* Card 3: HC-SR04 Ultrasonic Distance Meter */}
        <div className="bg-slate-950/90 rounded-xl border border-amber-500/20 p-3.5 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span>RADAR PROXIMITY [HC-SR04]</span>
            </div>
            {sensorData.ultrasonicDistanceCm !== null ? (
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  distStatus === 'IMPACT IMMINENT'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse'
                    : distStatus === 'PROXIMITY'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                }`}
              >
                [{distStatus}]
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-600 font-bold">NO DATA</span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div
              className={`text-3xl font-black font-mono tracking-tight ${
                distStatus === 'IMPACT IMMINENT' ? 'text-rose-400 animate-pulse glow-red' : 'text-white glow-amber'
              }`}
            >
              {sensorData.ultrasonicDistanceCm !== null
                ? `${sensorData.ultrasonicDistanceCm.toFixed(1)} cm`
                : 'NO DATA'}
            </div>
            <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              FORWARD OBSTACLE RANGE
            </div>
          </div>

          {/* Tactical Proximity visual meter */}
          <div className="w-full bg-slate-900 h-2.5 rounded overflow-hidden mt-1 border border-slate-800">
            {sensorData.ultrasonicDistanceCm !== null && (
              <div
                style={{
                  width: `${Math.min(100, Math.max(5, (sensorData.ultrasonicDistanceCm / 150) * 100))}%`,
                }}
                className={`h-full transition-all duration-300 ${
                  distStatus === 'IMPACT IMMINENT'
                    ? 'bg-red-500'
                    : distStatus === 'PROXIMITY'
                    ? 'bg-amber-500'
                    : 'bg-cyan-500'
                }`}
              />
            )}
          </div>
        </div>

        {/* Card 4: IR Perimeter Sensor */}
        <div className="bg-slate-950/90 rounded-xl border border-amber-500/20 p-3.5 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              <span>IR PERIMETER BREACH</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-bold">INFRARED LINE</span>
          </div>

          <div className="flex flex-col items-center justify-center py-3">
            {sensorData.irObstacle !== null ? (
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-black font-mono tracking-wider shadow-lg ${
                  sensorData.irObstacle
                    ? 'bg-rose-950 text-rose-300 border-rose-500 ring-2 ring-rose-500 animate-pulse'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-500'
                }`}
              >
                {sensorData.irObstacle ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>PERIMETER TRIPPED</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>CORRIDOR CLEAR</span>
                  </>
                )}
              </div>
            ) : (
              <div className="text-xl font-bold font-mono text-slate-600">NO DATA</div>
            )}
          </div>

          <div className="text-[9px] font-mono text-slate-500 text-right mt-1">
            SUBSYSTEM: {isConnected ? 'ARMED' : 'STANDBY'}
          </div>
        </div>
      </div>

      {/* Sensor Health Status Bar */}
      <div className="bg-slate-950 px-3 py-2 rounded border border-amber-500/20 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">BUS: HARDWARE UART @ ESP32 #1</span>
        <span className="text-slate-400">
          LAST FRAME:{' '}
          <span className="text-amber-400 font-bold">
            {sensorData.lastUpdated
              ? `${Math.round((Date.now() - sensorData.lastUpdated) / 100) / 10}s ago`
              : 'Never'}
          </span>
        </span>
      </div>
    </div>
  );
};
