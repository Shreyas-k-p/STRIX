import React from 'react';
import { ShieldAlert, Zap } from 'lucide-react';
import type { MotorState } from '../communication/types';

interface EmergencyStopProps {
  motorState: MotorState;
  onEmergencyStop: () => void;
}

export const EmergencyStop: React.FC<EmergencyStopProps> = ({
  motorState,
  onEmergencyStop,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between hazard-stripes-red p-3.5 rounded-xl border-2 border-red-600 shadow-2xl backdrop-blur-md gap-3 font-mono">
      {/* Left Indicator */}
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center border-2 shadow-inner ${
            motorState.isMoving
              ? 'bg-rose-600/40 text-rose-300 border-rose-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.7)]'
              : 'bg-black/80 text-slate-400 border-slate-700'
          }`}
        >
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-300 font-bold">
              MIL-SPEC KILL CIRCUIT:
            </span>
            <span
              className={`text-xs font-mono font-black px-2.5 py-0.5 rounded border ${
                motorState.isMoving
                  ? 'bg-amber-500 text-black border-amber-300 animate-pulse shadow-md'
                  : 'bg-rose-950 text-rose-300 border-rose-500'
              }`}
            >
              DRIVE TRAIN: {motorState.isMoving ? 'PROPULSION ENGAGED' : 'SYSTEMS DISARMED / SAFE'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-mono hidden sm:block mt-0.5">
            Zero-latency hardware kill: Flushes STOP packets across NRF24 and cuts all 6 DC motor H-Bridge channels.
          </p>
        </div>
      </div>

      {/* Main Massive Killswitch Button */}
      <button
        onClick={onEmergencyStop}
        className="flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-b from-red-500 via-rose-600 to-red-700 hover:from-red-400 hover:to-rose-500 active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-xl border-2 border-white/80 shadow-[0_0_25px_rgba(239,68,68,0.9)] font-mono transition-all"
        title="Press Space or click to execute immediate Emergency Killswitch"
      >
        <Zap className="w-5 h-5 fill-white text-yellow-300 animate-bounce" />
        <span>E-STOP KILLSWITCH [SPACE]</span>
      </button>
    </div>
  );
};
