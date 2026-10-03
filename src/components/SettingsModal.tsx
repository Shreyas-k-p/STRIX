import React, { useState } from 'react';
import { X, Settings, Activity, Bell } from 'lucide-react';
import type { WatchdogConfig, SensorThresholds } from '../communication/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchdog: WatchdogConfig;
  thresholds: SensorThresholds;
  onSaveWatchdog: (config: WatchdogConfig) => void;
  onSaveThresholds: (thresholds: SensorThresholds) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  watchdog,
  thresholds,
  onSaveWatchdog,
  onSaveThresholds,
}) => {
  const [localWatchdog] = useState<WatchdogConfig>(watchdog);
  const [localThresholds, setLocalThresholds] = useState<SensorThresholds>(thresholds);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWatchdog(localWatchdog);
    onSaveThresholds(localThresholds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-[#0b0e14] border border-cyan-800/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white font-heading tracking-wider">
              GCS SAFETY & THRESHOLD CONFIGURATION
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Motor Safety Model Notice */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Activity className="w-4 h-4" />
              <span>Motor Safety & Control Architecture</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Browser automatic-stop watchdog is disabled. Motors maintain active drive until an explicit
              <span className="text-amber-400 font-bold"> STOP</span> or
              <span className="text-red-400 font-bold"> EMERGENCY STOP</span> command is sent, or until ESP2 firmware safety executes.
            </p>
          </div>

          {/* Sensor Thresholds */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Bell className="w-4 h-4" />
              <span>Sensor Alert Thresholds</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="text-slate-400 block mb-1">Temperature Warning (°C)</label>
                <input
                  type="number"
                  step="1"
                  value={localThresholds.tempWarning}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      tempWarning: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Temperature Danger (°C)</label>
                <input
                  type="number"
                  step="1"
                  value={localThresholds.tempDanger}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      tempDanger: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Ultrasonic Warning (cm)</label>
                <input
                  type="number"
                  step="1"
                  value={localThresholds.ultrasonicWarningCm}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      ultrasonicWarningCm: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Ultrasonic Danger (cm)</label>
                <input
                  type="number"
                  step="1"
                  value={localThresholds.ultrasonicDangerCm}
                  onChange={(e) =>
                    setLocalThresholds({
                      ...localThresholds,
                      ultrasonicDangerCm: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
