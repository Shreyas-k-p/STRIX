import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  onSendStop?: () => void;
  onSendLeft?: (speed?: number) => void;
  onSendRight?: (speed?: number) => void;
  onSendCw?: (speed?: number) => void;
  onSendCcw?: (speed?: number) => void;
  onToggleInvert?: () => void;
  onSetAngle?: (angle: number) => void;
  onSetSpin?: (speed: number) => void;
  onSetMode?: (mode: any) => void;
  onToggleAutoSweep?: () => void;
  isConnected?: boolean;
}

export const ServoPanel: React.FC<ServoPanelProps> = ({
  servoState,
  onSendStop,
  onSendLeft,
  onSendRight,
  onSendCw,
  onSendCcw,
  onToggleInvert,
}) => {
  const [speed, setSpeed] = useState<number>(65);
  const [localInvert, setLocalInvert] = useState<boolean>(servoState.isInverted ?? false);
  const [activeHotkey, setActiveHotkey] = useState<'Q' | 'E' | 'R' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundFx.enabled);

  const isHoldingRef = useRef<'LEFT' | 'RIGHT' | null>(null);

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

  // Trigger continuous rotation LEFT (Normal: CCW | Inverted: CW)
  const triggerLeftStart = useCallback(() => {
    isHoldingRef.current = 'LEFT';
    soundFx.playServoTick();
    if (onSendLeft) {
      onSendLeft(speed);
    } else if (localInvert) {
      if (onSendCw) onSendCw(speed);
    } else {
      if (onSendCcw) onSendCcw(speed);
    }
  }, [speed, localInvert, onSendLeft, onSendCw, onSendCcw]);

  // Trigger continuous rotation RIGHT (Normal: CW | Inverted: CCW)
  const triggerRightStart = useCallback(() => {
    isHoldingRef.current = 'RIGHT';
    soundFx.playServoTick();
    if (onSendRight) {
      onSendRight(speed);
    } else if (localInvert) {
      if (onSendCcw) onSendCcw(speed);
    } else {
      if (onSendCw) onSendCw(speed);
    }
  }, [speed, localInvert, onSendRight, onSendCw, onSendCcw]);

  // Trigger STOP
  const triggerStop = useCallback(() => {
    if (isHoldingRef.current !== null) {
      isHoldingRef.current = null;
      soundFx.playKeyClick();
    }
    if (onSendStop) onSendStop();
  }, [onSendStop]);

  // Pointer event handlers for Hold-to-Rotate (desktop mouse and touchscreen)
  const handleLeftPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    triggerLeftStart();
  };

  const handleLeftPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (isHoldingRef.current === 'LEFT') {
      triggerStop();
    }
  };

  const handleRightPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    triggerRightStart();
  };

  const handleRightPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (isHoldingRef.current === 'RIGHT') {
      triggerStop();
    }
  };

  const handleInvertToggle = useCallback(() => {
    setLocalInvert((prev) => !prev);
    if (onToggleInvert) {
      onToggleInvert();
    }
  }, [onToggleInvert]);

  // Keyboard controls: Q / ArrowLeft = LEFT (hold), E / ArrowRight = RIGHT (hold), R / Space = STOP
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.repeat) return; // Ignore key repeat while holding key down
      const k = e.key.toUpperCase();
      if (k === 'Q' || k === 'ARROWLEFT') {
        setActiveHotkey('Q');
        triggerLeftStart();
      } else if (k === 'E' || k === 'ARROWRIGHT') {
        setActiveHotkey('E');
        triggerRightStart();
      } else if (k === 'R' || k === ' ' || k === 'ESCAPE') {
        setActiveHotkey('R');
        triggerStop();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'Q' || k === 'ARROWLEFT') {
        setActiveHotkey(null);
        if (isHoldingRef.current === 'LEFT') {
          triggerStop();
        }
      } else if (k === 'E' || k === 'ARROWRIGHT') {
        setActiveHotkey(null);
        if (isHoldingRef.current === 'RIGHT') {
          triggerStop();
        }
      } else if (k === 'R') {
        setActiveHotkey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerLeftStart, triggerRightStart, triggerStop]);

  // Determine current active rotation based strictly on active state
  const isRotatingLeft =
    servoState.state === 'LEFT' ||
    (servoState.state === 'CCW' && !localInvert) ||
    (servoState.state === 'CW' && localInvert) ||
    isHoldingRef.current === 'LEFT' ||
    activeHotkey === 'Q';

  const isRotatingRight =
    servoState.state === 'RIGHT' ||
    (servoState.state === 'CW' && !localInvert) ||
    (servoState.state === 'CCW' && localInvert) ||
    isHoldingRef.current === 'RIGHT' ||
    activeHotkey === 'E';

  const isHalted = !isRotatingLeft && !isRotatingRight;

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono bg-black/95 border-emerald-500/40">
      {/* Header & Status Badge */}
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

          {/* Current state badge: HALTED (90), ROTATING LEFT (speed%), ROTATING RIGHT (speed%) */}
          <span
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border transition-all ${
              isRotatingLeft
                ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500 animate-pulse shadow-[0_0_12px_rgba(0,255,255,0.4)]'
                : isRotatingRight
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500 animate-pulse shadow-[0_0_12px_rgba(0,255,65,0.4)]'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {isRotatingLeft
              ? `ROTATING LEFT (${speed}%)`
              : isRotatingRight
              ? `ROTATING RIGHT (${speed}%)`
              : 'HALTED (90)'}
          </span>
        </div>
      </div>

      {/* DEDICATED MANUAL CONTINUOUS SERVO CONTROL SECTION */}
      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2.5 my-1 flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
            MANUAL SERVO
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            HOLD TO ROTATE &bull; Q / E / R
          </span>
        </div>

        {/* 2 Large Buttons: [ ◀ LEFT ] [ RIGHT ▶ ] */}
        <div className="grid grid-cols-2 gap-3">
          {/* LEFT BUTTON */}
          <button
            onPointerDown={handleLeftPointerDown}
            onPointerUp={handleLeftPointerUp}
            onPointerCancel={handleLeftPointerUp}
            onPointerLeave={handleLeftPointerUp}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center select-none cursor-pointer touch-none ${
              isRotatingLeft
                ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-[0_0_25px_rgba(0,255,255,0.6)] scale-[0.98]'
                : 'bg-slate-950/90 border-slate-800 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-slate-200'
            }`}
            title="Hold to rotate Left (Hotkey: Q / ◀)"
          >
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className={`w-6 h-6 ${isRotatingLeft ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span className="text-sm font-black font-mono tracking-wider">◀ LEFT</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {localInvert ? 'CW (INVERTED)' : 'CCW'} &bull; {speed}%
            </span>
          </button>

          {/* RIGHT BUTTON */}
          <button
            onPointerDown={handleRightPointerDown}
            onPointerUp={handleRightPointerUp}
            onPointerCancel={handleRightPointerUp}
            onPointerLeave={handleRightPointerUp}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all text-center select-none cursor-pointer touch-none ${
              isRotatingRight
                ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-[0_0_25px_rgba(0,255,65,0.6)] scale-[0.98]'
                : 'bg-slate-950/90 border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/30 text-slate-200'
            }`}
            title="Hold to rotate Right (Hotkey: E / ▶)"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black font-mono tracking-wider">RIGHT ▶</span>
              <RotateCw className={`w-6 h-6 ${isRotatingRight ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {localInvert ? 'CCW (INVERTED)' : 'CW'} &bull; {speed}%
            </span>
          </button>
        </div>

        {/* STOP BUTTON: [ STOP ] */}
        <button
          onClick={triggerStop}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-all select-none cursor-pointer font-mono ${
            isHalted
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 hover:bg-rose-950/60'
              : 'bg-rose-900 border-rose-400 text-white shadow-[0_0_20px_rgba(255,0,51,0.5)] animate-pulse'
          }`}
          title="Stop rotation / Neutral 90 (Hotkey: R / Space)"
        >
          <Square className="w-5 h-5 text-rose-500 fill-current" />
          <span className="text-xs font-black tracking-wider">
            [ STOP ]
          </span>
          <span className="text-[10px] text-rose-400/80 ml-1">
            (90 HALT)
          </span>
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
            { label: 'TARGET (65%)', val: 65 },
            { label: 'CRUISE (80%)', val: 80 },
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

      {/* Direction Invert Toggle */}
      <div className="mt-2 pt-2 border-t border-slate-800/80">
        <button
          onClick={handleInvertToggle}
          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${
            localInvert
              ? 'bg-amber-950/80 border-amber-500 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Invert physical rotation direction if servo wiring or horn is reversed"
        >
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs">
              DIR INVERT: {localInvert ? 'ON (REVERSED)' : 'OFF (NORMAL)'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {localInvert ? 'LEFT=CW, RIGHT=CCW' : 'LEFT=CCW, RIGHT=CW'}
          </span>
        </button>
      </div>

      {/* Footer Hardware Info */}
      <div className="mt-2.5 text-[10px] font-mono text-slate-500 bg-slate-950 p-2 rounded border border-slate-900">
        ⚙️ <span className="text-emerald-400 font-bold">CONTINUOUS SERVO LOGIC:</span> Value 90 = STOP, 180 = CW, 0 = CCW. Commands: CMD|SERVO|CCW|&lt;spd&gt;, CMD|SERVO|CW|&lt;spd&gt;, CMD|SERVO|STOP.
      </div>
    </div>
  );
};
