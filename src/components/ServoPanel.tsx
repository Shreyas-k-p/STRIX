import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Square,
  Sliders,
  Volume2,
  VolumeX,
  Compass,
  ArrowLeftRight,
} from 'lucide-react';
import type { ServoState } from '../communication/types';
import { soundFx } from '../utils/audio';

interface ServoPanelProps {
  servoState: ServoState;
  onSetAngle?: (angle: number) => void;
  onSetSpin?: (speed: number) => void;
  onSetMode?: (mode: any) => void;
  onToggleAutoSweep?: () => void;
  isConnected?: boolean;
  onSendStop?: () => void;
  onSendCw?: (speed?: number) => void;
  onSendCcw?: (speed?: number) => void;
  onToggleInvert?: () => void;
}

export const ServoPanel: React.FC<ServoPanelProps> = ({
  servoState,
  onSetAngle,
  onSetSpin,
  onSendStop,
  onSendCw,
  onSendCcw,
  onToggleInvert,
}) => {
  const [speed, setSpeed] = useState<number>(75);
  const [isMomentary, setIsMomentary] = useState<boolean>(false);
  const [localInvert, setLocalInvert] = useState<boolean>(servoState.isInverted ?? false);
  const [activeHotkey, setActiveHotkey] = useState<'Q' | 'E' | 'R' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundFx.enabled);

  // Sync invert state
  useEffect(() => {
    if (servoState.isInverted !== undefined) {
      setLocalInvert(servoState.isInverted);
    }
  }, [servoState.isInverted]);

  const toggleSound = () => {
    soundFx.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) soundFx.playKeyClick();
  };

  const handleStop = useCallback(() => {
    soundFx.playKeyClick();
    if (onSendStop) {
      onSendStop();
    } else if (onSetSpin) {
      onSetSpin(0);
    } else if (onSetAngle) {
      onSetAngle(90);
    }
  }, [onSendStop, onSetSpin, onSetAngle]);

  const handleCw = useCallback(
    (customSpeed?: number) => {
      const spd = customSpeed ?? speed;
      soundFx.playServoTick();
      if (onSendCw) {
        onSendCw(spd);
      } else if (onSetSpin) {
        onSetSpin(localInvert ? -spd : spd);
      } else if (onSetAngle) {
        onSetAngle(localInvert ? 0 : 180);
      }
    },
    [speed, localInvert, onSendCw, onSetSpin, onSetAngle]
  );

  const handleCcw = useCallback(
    (customSpeed?: number) => {
      const spd = customSpeed ?? speed;
      soundFx.playServoTick();
      if (onSendCcw) {
        onSendCcw(spd);
      } else if (onSetSpin) {
        onSetSpin(localInvert ? spd : -spd);
      } else if (onSetAngle) {
        onSetAngle(localInvert ? 180 : 0);
      }
    },
    [speed, localInvert, onSendCcw, onSetSpin, onSetAngle]
  );

  const handleInvertToggle = useCallback(() => {
    setLocalInvert((prev) => !prev);
    if (onToggleInvert) {
      onToggleInvert();
    }
  }, [onToggleInvert]);

  // Keyboard controls: Q = CCW, E = CW, R = STOP
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'Q') {
        setActiveHotkey('Q');
        handleCcw();
      } else if (k === 'E') {
        setActiveHotkey('E');
        handleCw();
      } else if (k === 'R') {
        setActiveHotkey('R');
        handleStop();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'Q' || k === 'E' || k === 'R') {
        setActiveHotkey(null);
        if (isMomentary && (k === 'Q' || k === 'E')) {
          handleStop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMomentary, handleCcw, handleCw, handleStop]);

  // Determine current active rotation
  const isSpinningCw = servoState.state === 'CW' || (servoState.speed !== undefined && servoState.speed > 0);
  const isSpinningCcw = servoState.state === 'CCW' || (servoState.speed !== undefined && servoState.speed < 0);
  const isHalted = !isSpinningCw && !isSpinningCcw;

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono bg-black/95 border-emerald-500/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 font-heading">
            CONTINUOUS ROTATION SERVO [ESP1 GPIO32]
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400"
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Current state badge */}
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              isSpinningCw
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500 animate-pulse shadow-[0_0_10px_rgba(0,255,65,0.4)]'
                : isSpinningCcw
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {isSpinningCw
              ? `SPINNING CW (${speed}%)`
              : isSpinningCcw
              ? `SPINNING CCW (${speed}%)`
              : 'HALTED (90)'}
          </span>
        </div>
      </div>

      {/* Main Continuous Rotation Action Grid */}
      <div className="grid grid-cols-3 gap-3 my-2 flex-1">
        {/* Rotate CCW Button */}
        <button
          onClick={() => handleCcw()}
          onMouseDown={() => {
            if (isMomentary) handleCcw();
          }}
          onMouseUp={() => {
            if (isMomentary) handleStop();
          }}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center select-none ${
            isSpinningCcw || activeHotkey === 'Q'
              ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.5)] scale-[0.98]'
              : 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-slate-300'
          }`}
          title="Rotate Counter-Clockwise (Hotkey: Q)"
        >
          <RotateCcw
            className={`w-7 h-7 mb-2 ${
              isSpinningCcw ? 'animate-spin text-cyan-400' : 'text-cyan-400/80'
            }`}
          />
          <span className="text-xs font-black font-mono tracking-wider">ROTATE CCW</span>
          <span className="text-[10px] text-slate-400 font-mono mt-1">[HOTKEY: Q] &bull; 0</span>
        </button>

        {/* STOP / Halt Button */}
        <button
          onClick={handleStop}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center select-none ${
            isHalted || activeHotkey === 'R'
              ? 'bg-rose-950/40 border-rose-500/60 text-rose-300 shadow-[0_0_15px_rgba(255,0,51,0.3)]'
              : 'bg-slate-950/80 border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 text-slate-300'
          }`}
          title="Stop Continuous Rotation / Halt (Hotkey: R)"
        >
          <Square className="w-7 h-7 mb-2 text-rose-500 fill-current" />
          <span className="text-xs font-black font-mono tracking-wider text-rose-400">
            HALT / STOP
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-1">[HOTKEY: R] &bull; 90</span>
        </button>

        {/* Rotate CW Button */}
        <button
          onClick={() => handleCw()}
          onMouseDown={() => {
            if (isMomentary) handleCw();
          }}
          onMouseUp={() => {
            if (isMomentary) handleStop();
          }}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center select-none ${
            isSpinningCw || activeHotkey === 'E'
              ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(0,255,65,0.5)] scale-[0.98]'
              : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-slate-300'
          }`}
          title="Rotate Clockwise (Hotkey: E)"
        >
          <RotateCw
            className={`w-7 h-7 mb-2 ${
              isSpinningCw ? 'animate-spin text-emerald-400' : 'text-emerald-400/80'
            }`}
          />
          <span className="text-xs font-black font-mono tracking-wider">ROTATE CW</span>
          <span className="text-[10px] text-slate-400 font-mono mt-1">[HOTKEY: E] &bull; 180</span>
        </button>
      </div>

      {/* Speed Slider & Presets */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2 mt-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>ROTATION SPEED TARGET:</span>
          </span>
          <span className="text-emerald-400 font-black">{speed}%</span>
        </div>

        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={speed}
          onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        {/* Quick Presets */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {[
            { label: 'SLOW (30%)', val: 30 },
            { label: 'HALF (50%)', val: 50 },
            { label: 'CRUISE (75%)', val: 75 },
            { label: 'TURBO (100%)', val: 100 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => setSpeed(preset.val)}
              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                speed === preset.val
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration & Options (Invert & Momentary) */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
        {/* Direction Invert Toggle */}
        <button
          onClick={handleInvertToggle}
          className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
            localInvert
              ? 'bg-amber-950/80 border-amber-500 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Invert physical rotation direction if servo wiring or horn is reversed"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
          <span>DIR INVERT: {localInvert ? 'ON (REVERSED)' : 'OFF (NORMAL)'}</span>
        </button>

        {/* Momentary vs Latched Switch */}
        <button
          onClick={() => setIsMomentary(!isMomentary)}
          className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
            isMomentary
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle between Hold-to-Spin and Latched toggle"
        >
          <span>MODE: {isMomentary ? 'HOLD TO ROTATE' : 'LATCHED (TOGGLE)'}</span>
        </button>
      </div>

      {/* Footer Hardware Info */}
      <div className="mt-3 text-[10px] font-mono text-slate-500 bg-slate-950 p-2 rounded border border-slate-900">
        ⚙️ <span className="text-emerald-400 font-bold">CONTINUOUS SERVO LOGIC:</span> Value 90 = STOP, 180 = CW, 0 = CCW. Commands: CMD|SERVO|CW, CMD|SERVO|CCW, CMD|SERVO|STOP.
      </div>
    </div>
  );
};
