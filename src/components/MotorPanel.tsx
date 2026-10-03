import React from 'react';
import { Cpu, RotateCw, RotateCcw, Power } from 'lucide-react';
import type { MotorState } from '../communication/types';

interface MotorPanelProps {
  motorState: MotorState;
}

export const MotorPanel: React.FC<MotorPanelProps> = ({ motorState }) => {
  const driver1Motors = motorState.motors.filter((m) => m.driver === 1);
  const driver2Motors = motorState.motors.filter((m) => m.driver === 2);

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/25 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 font-heading">
            6WD POWERTRAIN & DUAL L298N DRIVERS
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400">
            STATE:
          </span>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              motorState.isMoving
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse shadow-[0_0_10px_rgba(255,149,0,0.3)]'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {motorState.roverDirection} ({motorState.isMoving ? `${motorState.speed} PWM` : 'IDLE'})
          </span>
        </div>
      </div>

      {/* Dual Drivers Side-by-Side Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
        {/* L298N Driver #1: Port Track (Motors 1, 2, 3) */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-amber-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-xs font-black font-mono text-amber-400">
              L298N #1 [PORT DRIVE BANK]
            </span>
            <span className="text-[9px] font-mono text-slate-500">ESP32 #3 UART</span>
          </div>

          <div className="flex flex-col gap-2">
            {driver1Motors.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-800 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      m.isOn
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-400/60 shadow-[0_0_8px_rgba(255,149,0,0.4)]'
                        : 'bg-slate-950 text-slate-600'
                    }`}
                  >
                    {m.direction === 'FWD' ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : m.direction === 'REV' ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-200">
                      M{m.id} <span className="text-[10px] text-slate-400 font-normal">[{m.name}]</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      DIR: <span className={m.isOn ? 'text-amber-400 font-bold' : 'text-slate-600'}>{m.direction}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      m.isOn ? 'bg-amber-950 text-amber-400 border border-amber-600' : 'bg-slate-950 text-slate-600'
                    }`}
                  >
                    {m.isOn ? 'ENGAGED' : 'OFF'}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-bold">
                    {m.isOn ? `${m.speed} PWM` : '0 PWM'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* L298N Driver #2: Starboard Track (Motors 4, 5, 6) */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-amber-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-xs font-black font-mono text-amber-400">
              L298N #2 [STARBOARD DRIVE BANK]
            </span>
            <span className="text-[9px] font-mono text-slate-500">ESP32 #3 UART</span>
          </div>

          <div className="flex flex-col gap-2">
            {driver2Motors.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-800 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      m.isOn
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-400/60 shadow-[0_0_8px_rgba(255,149,0,0.4)]'
                        : 'bg-slate-950 text-slate-600'
                    }`}
                  >
                    {m.direction === 'FWD' ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : m.direction === 'REV' ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-200">
                      M{m.id} <span className="text-[10px] text-slate-400 font-normal">[{m.name}]</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      DIR: <span className={m.isOn ? 'text-amber-400 font-bold' : 'text-slate-600'}>{m.direction}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      m.isOn ? 'bg-amber-950 text-amber-400 border border-amber-600' : 'bg-slate-950 text-slate-600'
                    }`}
                  >
                    {m.isOn ? 'ENGAGED' : 'OFF'}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-bold">
                    {m.isOn ? `${m.speed} PWM` : '0 PWM'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pin Abstraction Notice */}
      <div className="mt-3 text-[10px] font-mono text-slate-500 bg-slate-950 p-2 rounded border border-slate-900">
        🛡️ <span className="text-amber-400 font-bold">MIL-SPEC ABSTRACTION:</span> Outgoing telemetry protocols decouple H-Bridge hardware pins from Ground Control Software.
      </div>
    </div>
  );
};
