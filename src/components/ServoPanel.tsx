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
  Crosshair,
  Gamepad2,
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
  const [controlMode, setControlMode] = useState<'JOYSTICK' | 'BUTTONS' | 'BOTH'>('JOYSTICK');

  // Virtual spring-loaded joystick state
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  // Joystick pointer dragging logic
  const maxR = 48; // Max deflection radius in pixels
  const deadZone = 12;

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.hypot(dx, dy);
    if (distance > maxR) {
      dx = (dx / distance) * maxR;
      dy = (dy / distance) * maxR;
    }

    setKnobPos({ x: dx, y: dy });

    if (dx < -deadZone) {
      if (isHoldingRef.current !== 'LEFT') {
        triggerLeftStart();
      }
    } else if (dx > deadZone) {
      if (isHoldingRef.current !== 'RIGHT') {
        triggerRightStart();
      }
    } else {
      if (isHoldingRef.current !== null) {
        triggerStop();
      }
    }
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    triggerStop();
  };

  // Pointer event handlers for Hold-to-Rotate Buttons (desktop mouse and touchscreen)
  const handleLeftPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setKnobPos({ x: -38, y: 0 });
    triggerLeftStart();
  };

  const handleLeftPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setKnobPos({ x: 0, y: 0 });
    if (isHoldingRef.current === 'LEFT') {
      triggerStop();
    }
  };

  const handleRightPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setKnobPos({ x: 38, y: 0 });
    triggerRightStart();
  };

  const handleRightPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setKnobPos({ x: 0, y: 0 });
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
      if (e.repeat) return;
      const k = e.key.toUpperCase();
      if (k === 'Q' || k === 'ARROWLEFT') {
        setActiveHotkey('Q');
        setKnobPos({ x: -38, y: 0 });
        triggerLeftStart();
      } else if (k === 'E' || k === 'ARROWRIGHT') {
        setActiveHotkey('E');
        setKnobPos({ x: 38, y: 0 });
        triggerRightStart();
      } else if (k === 'R' || k === ' ' || k === 'ESCAPE') {
        setActiveHotkey('R');
        setKnobPos({ x: 0, y: 0 });
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
        setKnobPos({ x: 0, y: 0 });
        if (isHoldingRef.current === 'LEFT') {
          triggerStop();
        }
      } else if (k === 'E' || k === 'ARROWRIGHT') {
        setActiveHotkey(null);
        setKnobPos({ x: 0, y: 0 });
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
  const deflectionPct = Math.round((knobPos.x / maxR) * 100);

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono bg-black/95 border-emerald-500/40">
      {/* Header & Status Badge */}
      <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5 mb-2">
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

      {/* DEDICATED SERVO CONTROL BOX */}
      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2.5 my-1 flex-1 flex flex-col justify-between">
        {/* Section title & mode switcher */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>MANUAL SERVO CONTROL</span>
          </span>

          {/* Selector pills: JOYSTICK / BUTTONS / BOTH */}
          <div className="flex items-center bg-black/80 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => setControlMode('JOYSTICK')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                controlMode === 'JOYSTICK'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,255,255,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🕹️ JOYSTICK
            </button>
            <button
              onClick={() => setControlMode('BUTTONS')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                controlMode === 'BUTTONS'
                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(0,255,65,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ◀ ▶ BUTTONS
            </button>
            <button
              onClick={() => setControlMode('BOTH')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                controlMode === 'BOTH'
                  ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ BOTH
            </button>
          </div>
        </div>

        {/* 1. SPRING-LOADED VIRTUAL JOYSTICK (Visible in JOYSTICK and BOTH mode) */}
        {(controlMode === 'JOYSTICK' || controlMode === 'BOTH') && (
          <div className="flex flex-col items-center justify-center py-1">
            <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-2 mb-1">
              <span className={`font-mono font-bold transition-colors ${isRotatingLeft ? 'text-cyan-300' : 'text-slate-500'}`}>
                ◀ CCW ({localInvert ? 'REV' : 'NORM'})
              </span>
              <span className="font-mono text-[9px] text-slate-500">
                DRAG OR USE Q / E • SPRINGS TO STOP
              </span>
              <span className={`font-mono font-bold transition-colors ${isRotatingRight ? 'text-emerald-300' : 'text-slate-500'}`}>
                CW ({localInvert ? 'REV' : 'NORM'}) ▶
              </span>
            </div>

            {/* Circular Joystick Field with concentric guide rings */}
            <div
              ref={joystickBaseRef}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
              className="relative w-44 h-28 sm:h-32 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-black border-2 border-slate-700 hover:border-cyan-500/60 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden"
              title="Click & Drag Left or Right to rotate servo. Release to STOP."
            >
              {/* Concentric guidance rings & grid */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                <div className="w-36 h-20 rounded-full border border-dashed border-cyan-400" />
                <div className="absolute w-24 h-14 rounded-full border border-slate-500" />
                <div className="absolute h-full w-[1px] bg-slate-700" />
                <div className="absolute w-full h-[1px] bg-slate-700" />
              </div>

              {/* Horizontal guide track */}
              <div className="absolute w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden pointer-events-none flex">
                <div
                  className="h-full bg-cyan-400 transition-all ml-auto"
                  style={{ width: knobPos.x < 0 ? `${(Math.abs(knobPos.x) / maxR) * 50}%` : '0%' }}
                />
                <div
                  className="h-full bg-emerald-400 transition-all mr-auto"
                  style={{ width: knobPos.x > 0 ? `${(knobPos.x / maxR) * 50}%` : '0%' }}
                />
              </div>

              {/* Directional labels inside base */}
              <div className="absolute left-3 text-[10px] font-black text-cyan-400/80 pointer-events-none flex items-center gap-0.5">
                <RotateCcw className="w-3 h-3" />
                <span>LEFT</span>
              </div>
              <div className="absolute right-3 text-[10px] font-black text-emerald-400/80 pointer-events-none flex items-center gap-0.5">
                <span>RIGHT</span>
                <RotateCw className="w-3 h-3" />
              </div>

              {/* Draggable Spring Thumbstick Knob */}
              <div
                className={`relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-2 pointer-events-none transition-shadow ${
                  isRotatingLeft
                    ? 'bg-gradient-to-tr from-cyan-900 to-cyan-600 border-cyan-300 shadow-[0_0_20px_rgba(0,255,255,0.8)]'
                    : isRotatingRight
                    ? 'bg-gradient-to-tr from-emerald-900 to-emerald-600 border-emerald-300 shadow-[0_0_20px_rgba(0,255,65,0.8)]'
                    : 'bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 border-slate-500'
                }`}
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                  transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
                {/* Center crosshair on knob */}
                <Crosshair
                  className={`w-6 h-6 transition-all ${
                    isRotatingLeft
                      ? 'text-cyan-200 rotate-[-45deg]'
                      : isRotatingRight
                      ? 'text-emerald-200 rotate-45'
                      : 'text-slate-400'
                  }`}
                />
                {/* Tactile thumb ring */}
                <div className="absolute inset-1.5 rounded-full border border-white/20 pointer-events-none" />
              </div>
            </div>

            {/* Real-time deflection & action readout */}
            <div className="w-full flex items-center justify-between text-[11px] font-mono mt-1 px-1">
              <span className="text-slate-400 text-[10px]">
                DEFLECTION: <strong className={isRotatingLeft ? 'text-cyan-300' : isRotatingRight ? 'text-emerald-300' : 'text-slate-400'}>{deflectionPct > 0 ? `+${deflectionPct}%` : `${deflectionPct}%`}</strong>
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded transition-colors ${
                  isRotatingLeft
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                    : isRotatingRight
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {isRotatingLeft
                  ? `◄ ROTATING LEFT (${speed}%)`
                  : isRotatingRight
                  ? `ROTATING RIGHT (${speed}%) ▶`
                  : '● NEUTRAL (90 HALT)'}
              </span>
            </div>
          </div>
        )}

        {/* 2. HOLD BUTTONS (Visible in BUTTONS and BOTH mode) */}
        {(controlMode === 'BUTTONS' || controlMode === 'BOTH') && (
          <div className="grid grid-cols-2 gap-3">
            {/* LEFT BUTTON */}
            <button
              onPointerDown={handleLeftPointerDown}
              onPointerUp={handleLeftPointerUp}
              onPointerCancel={handleLeftPointerUp}
              onPointerLeave={handleLeftPointerUp}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center select-none cursor-pointer touch-none ${
                isRotatingLeft
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.6)] scale-[0.98]'
                  : 'bg-slate-950/90 border-slate-800 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-slate-200'
              }`}
              title="Hold to rotate Left (Hotkey: Q / ◀)"
            >
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw className={`w-5 h-5 ${isRotatingLeft ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span className="text-xs sm:text-sm font-black font-mono tracking-wider">◀ LEFT</span>
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
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center select-none cursor-pointer touch-none ${
                isRotatingRight
                  ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(0,255,65,0.6)] scale-[0.98]'
                  : 'bg-slate-950/90 border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/30 text-slate-200'
              }`}
              title="Hold to rotate Right (Hotkey: E / ▶)"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs sm:text-sm font-black font-mono tracking-wider">RIGHT ▶</span>
                <RotateCw className={`w-5 h-5 ${isRotatingRight ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {localInvert ? 'CCW (INVERTED)' : 'CW'} &bull; {speed}%
              </span>
            </button>
          </div>
        )}

        {/* STOP BUTTON: [ STOP ] (Always present for instant safety) */}
        <button
          onClick={triggerStop}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all select-none cursor-pointer font-mono ${
            isHalted
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 hover:bg-rose-950/60'
              : 'bg-rose-900 border-rose-400 text-white shadow-[0_0_20px_rgba(255,0,51,0.5)] animate-pulse'
          }`}
          title="Stop rotation / Neutral 90 (Hotkey: R / Space)"
        >
          <Square className="w-4 h-4 text-rose-500 fill-current" />
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
