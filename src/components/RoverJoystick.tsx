import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Zap,
  Gauge,
  Crosshair,
  Radio,
  Compass,
  Gamepad2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import type { MotorDirection, MotorState, ServoState } from '../communication/types';
import { soundFx } from '../utils/audio';

interface RoverJoystickProps {
  motorState: MotorState;
  onDirectionChange: (direction: MotorDirection) => void;
  onSpeedChange: (speed: number) => void;
  onEmergencyStop: () => void;
  isConnected: boolean;
  servoState?: ServoState;
  onServoLeft?: (speed?: number) => void;
  onServoRight?: (speed?: number) => void;
  onServoStop?: () => void;
}

export const RoverJoystick: React.FC<RoverJoystickProps> = ({
  motorState,
  onDirectionChange,
  onSpeedChange,
  onEmergencyStop,
  servoState,
  onServoLeft,
  onServoRight,
  onServoStop,
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Link mode: 'ROVER' (controls 6WD wheels) or 'SERVO' (controls continuous rotation servo)
  const [joystickTarget, setJoystickTarget] = useState<'ROVER' | 'SERVO'>('SERVO');
  const [gamepadConnected, setGamepadConnected] = useState<string | null>(null);

  const servoSpeed = servoState?.speed || 65;

  // Tactical Speed presets
  const speedPresets = [
    { label: 'STEALTH (100)', val: 100 },
    { label: 'PATROL (180)', val: 180 },
    { label: 'OVERDRIVE (255)', val: 255 },
  ];

  // Map keyboard presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.repeat) return;

      const k = e.key.toUpperCase();
      if (['W', 'A', 'S', 'D', 'X', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'Q', 'E', 'R'].includes(k)) {
        setActiveKey(k);
        soundFx.playKeyClick();

        if (joystickTarget === 'SERVO') {
          if (k === 'A' || k === 'ARROWLEFT' || k === 'Q') {
            onServoLeft?.(servoSpeed);
          } else if (k === 'D' || k === 'ARROWRIGHT' || k === 'E') {
            onServoRight?.(servoSpeed);
          } else if (k === 'X' || k === 'R' || k === ' ') {
            onServoStop?.();
          } else if (k === 'W' || k === 'ARROWUP') {
            onDirectionChange('FORWARD');
          } else if (k === 'S' || k === 'ARROWDOWN') {
            onDirectionChange('BACKWARD');
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const k = e.key.toUpperCase();
      setActiveKey(null);

      if (joystickTarget === 'SERVO') {
        if (['A', 'ARROWLEFT', 'Q', 'D', 'ARROWRIGHT', 'E'].includes(k)) {
          onServoStop?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [joystickTarget, servoSpeed, onServoLeft, onServoRight, onServoStop, onDirectionChange]);

  // Physical Gamepad API integration
  useEffect(() => {
    const handleGpConnect = (e: GamepadEvent) => {
      setGamepadConnected(e.gamepad.id);
      soundFx.playKeyClick();
    };

    const handleGpDisconnect = () => {
      setGamepadConnected(null);
    };

    window.addEventListener('gamepadconnected', handleGpConnect);
    window.addEventListener('gamepaddisconnected', handleGpDisconnect);

    let rafId: number;
    let lastDir: string | null = null;

    const poll = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];
      if (gp) {
        if (!gamepadConnected) setGamepadConnected(gp.id);
        const axisX = gp.axes[0] ?? 0;
        const axisY = gp.axes[1] ?? 0;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;

        const DEADZONE = 0.25;

        if (joystickTarget === 'SERVO') {
          if (axisX < -DEADZONE || dpadLeft) {
            if (lastDir !== 'LEFT') {
              lastDir = 'LEFT';
              onServoLeft?.(servoSpeed);
            }
          } else if (axisX > DEADZONE || dpadRight) {
            if (lastDir !== 'RIGHT') {
              lastDir = 'RIGHT';
              onServoRight?.(servoSpeed);
            }
          } else {
            if (lastDir !== null) {
              lastDir = null;
              onServoStop?.();
            }
          }
        } else {
          if (axisY < -DEADZONE || dpadUp) {
            if (lastDir !== 'FORWARD') {
              lastDir = 'FORWARD';
              onDirectionChange('FORWARD');
            }
          } else if (axisY > DEADZONE || dpadDown) {
            if (lastDir !== 'BACKWARD') {
              lastDir = 'BACKWARD';
              onDirectionChange('BACKWARD');
            }
          } else if (axisX < -DEADZONE || dpadLeft) {
            if (lastDir !== 'LEFT') {
              lastDir = 'LEFT';
              onDirectionChange('LEFT');
            }
          } else if (axisX > DEADZONE || dpadRight) {
            if (lastDir !== 'RIGHT') {
              lastDir = 'RIGHT';
              onDirectionChange('RIGHT');
            }
          } else {
            if (lastDir !== null) {
              lastDir = null;
              onDirectionChange('STOP');
            }
          }
        }
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('gamepadconnected', handleGpConnect);
      window.removeEventListener('gamepaddisconnected', handleGpDisconnect);
    };
  }, [joystickTarget, servoSpeed, onServoLeft, onServoRight, onServoStop, onDirectionChange, gamepadConnected]);

  // Virtual 2D joystick dragging handler
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    soundFx.playKeyClick();
    updateKnobFromPointer(e.clientX, e.clientY);
  };

  const updateKnobFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!joystickBaseRef.current) return;
      const rect = joystickBaseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width / 2 - 25;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const angle = Math.atan2(deltaY, deltaX);

      const clampedDist = Math.min(distance, maxRadius);
      const x = Math.cos(angle) * clampedDist;
      const y = Math.sin(angle) * clampedDist;

      setKnobPos({ x, y });

      const DEADZONE = 22;

      // Handle SERVO LINK MODE
      if (joystickTarget === 'SERVO') {
        if (x < -DEADZONE) {
          onServoLeft?.(servoSpeed);
        } else if (x > DEADZONE) {
          onServoRight?.(servoSpeed);
        } else {
          onServoStop?.();
        }
        return;
      }

      // Handle ROVER 6WD MODE
      if (clampedDist > DEADZONE) {
        const deg = (angle * 180) / Math.PI;
        if (deg >= -135 && deg <= -45) {
          onDirectionChange('FORWARD');
        } else if (deg >= 45 && deg <= 135) {
          onDirectionChange('BACKWARD');
        } else if (deg > 135 || deg < -135) {
          onDirectionChange('LEFT');
        } else if (deg > -45 && deg < 45) {
          onDirectionChange('RIGHT');
        }
      }
    },
    [joystickTarget, servoSpeed, onServoLeft, onServoRight, onServoStop, onDirectionChange]
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        updateKnobFromPointer(e.clientX, e.clientY);
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setKnobPos({ x: 0, y: 0 });
        if (joystickTarget === 'SERVO') {
          onServoStop?.();
        } else {
          onDirectionChange('STOP');
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, updateKnobFromPointer, joystickTarget, onServoStop, onDirectionChange]);

  const isServoRotatingLeft = servoState?.state === 'LEFT' || (servoState?.state === 'CCW' && !servoState.isInverted) || (servoState?.state === 'CW' && servoState.isInverted);
  const isServoRotatingRight = servoState?.state === 'RIGHT' || (servoState?.state === 'CW' && !servoState.isInverted) || (servoState?.state === 'CCW' && servoState.isInverted);

  return (
    <div className="hud-panel rounded-xl p-4 flex flex-col justify-between h-full font-mono bg-black/95 border-emerald-500/40">
      {/* Top Header & Status */}
      <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 font-heading glow-matrix">
            {joystickTarget === 'SERVO' ? 'SERVO GIMBAL JOYSTICK' : 'PROPULSION & 6WD THRUST'}
          </h2>
        </div>

        {/* Dynamic Movement Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono font-bold tracking-wider border shadow-md ${
            joystickTarget === 'SERVO'
              ? isServoRotatingLeft
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400 animate-pulse shadow-[0_0_12px_rgba(0,255,255,0.4)]'
                : isServoRotatingRight
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-400 animate-pulse shadow-[0_0_12px_rgba(0,255,65,0.4)]'
                : 'bg-black text-slate-500 border-slate-800'
              : motorState.isMoving
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse shadow-[0_0_12px_rgba(0,255,65,0.4)]'
              : 'bg-black text-slate-500 border-slate-800'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              joystickTarget === 'SERVO'
                ? isServoRotatingLeft
                  ? 'bg-cyan-400 animate-ping'
                  : isServoRotatingRight
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-slate-600'
                : motorState.isMoving
                ? 'bg-emerald-400 animate-ping'
                : 'bg-slate-600'
            }`}
          />
          {joystickTarget === 'SERVO'
            ? isServoRotatingLeft
              ? `SERVO: ROTATING LEFT (${servoSpeed}%)`
              : isServoRotatingRight
              ? `SERVO: ROTATING RIGHT (${servoSpeed}%)`
              : 'SERVO: HALTED (90)'
            : `ROVER: ${motorState.isMoving ? `THRUST [${motorState.roverDirection}]` : 'HALTED'}`}
        </div>
      </div>

      {/* Prominent Joystick Target Selector: ROVER vs SERVO */}
      <div className="flex items-center justify-between bg-slate-950/90 p-1.5 rounded-xl border border-emerald-500/30 my-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
            JOYSTICK LINK:
          </span>
          <button
            onClick={() => {
              setJoystickTarget('SERVO');
              soundFx.playKeyClick();
            }}
            className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              joystickTarget === 'SERVO'
                ? 'bg-cyan-500 text-black shadow-[0_0_18px_rgba(0,255,255,0.7)] font-black ring-1 ring-white'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>SERVO [ESP1 GPIO32]</span>
          </button>

          <button
            onClick={() => {
              setJoystickTarget('ROVER');
              soundFx.playKeyClick();
            }}
            className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              joystickTarget === 'ROVER'
                ? 'bg-emerald-500 text-black shadow-[0_0_18px_rgba(0,255,65,0.7)] font-black ring-1 ring-white'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <span>ROVER 6WD</span>
          </button>
        </div>

        {gamepadConnected ? (
          <span className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500 animate-pulse">
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>USB GAMEPAD LINKED</span>
          </span>
        ) : (
          <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">
            SPRING-CENTERED &bull; 90=STOP
          </span>
        )}
      </div>

      {/* Main Joystick & Tactical D-Pad */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
        {/* Visual 2D Virtual Joystick with Tactical Crosshair */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {joystickTarget === 'SERVO' ? '[ SERVO GIMBAL STICK ]' : '[ 2D VECTOR JOYSTICK ]'}
          </span>
          <div
            ref={joystickBaseRef}
            onPointerDown={handlePointerDown}
            className={`relative w-40 h-40 rounded-full bg-black border-2 shadow-[inset_0_0_25px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-crosshair select-none touch-none transition-colors ${
              joystickTarget === 'SERVO'
                ? isServoRotatingLeft
                  ? 'border-cyan-400 shadow-[inset_0_0_30px_rgba(0,255,255,0.25)]'
                  : isServoRotatingRight
                  ? 'border-emerald-400 shadow-[inset_0_0_30px_rgba(0,255,65,0.25)]'
                  : 'border-cyan-500/40 hover:border-cyan-400'
                : 'border-emerald-500/40 hover:border-emerald-400'
            }`}
          >
            {/* Tactical Grid & Ticks */}
            <div className="absolute inset-3 rounded-full border border-dashed border-emerald-500/20 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-emerald-500/10 pointer-events-none" />

            {/* Labels on Joystick */}
            {joystickTarget === 'SERVO' ? (
              <>
                <div className="absolute top-1 text-[9px] font-bold text-slate-500">GIMBAL</div>
                <div className="absolute bottom-1 text-[9px] font-bold text-slate-500">STOP 90</div>
                <div className="absolute left-1.5 text-[9px] font-bold text-cyan-400">◄ LEFT (CCW)</div>
                <div className="absolute right-1.5 text-[9px] font-bold text-emerald-400">RIGHT (CW) ►</div>
              </>
            ) : (
              <>
                <div className="absolute top-1 text-[9px] font-bold text-emerald-400">FWD ▲</div>
                <div className="absolute bottom-1 text-[9px] font-bold text-emerald-400">REV ▼</div>
                <div className="absolute left-1.5 text-[9px] font-bold text-emerald-400">◄ LT</div>
                <div className="absolute right-1.5 text-[9px] font-bold text-emerald-400">RT ►</div>
              </>
            )}

            {/* Draggable Tactical Knob */}
            <div
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-xl ${
                joystickTarget === 'SERVO'
                  ? isServoRotatingLeft
                    ? 'bg-cyan-500 text-black border-white shadow-[0_0_20px_rgba(0,255,255,0.9)] scale-105'
                    : isServoRotatingRight
                    ? 'bg-emerald-500 text-black border-white shadow-[0_0_20px_rgba(0,255,65,0.9)] scale-105'
                    : 'bg-slate-900 text-cyan-400 border-cyan-500/60'
                  : motorState.isMoving
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black border-white shadow-[0_0_18px_rgba(0,255,65,0.9)]'
                  : 'bg-slate-900 text-emerald-400 border-emerald-500/40'
              }`}
            >
              {joystickTarget === 'SERVO' ? (
                <Compass className={`w-5 h-5 pointer-events-none ${isServoRotatingLeft || isServoRotatingRight ? 'animate-spin' : ''}`} />
              ) : (
                <Radio className="w-5 h-5 pointer-events-none" />
              )}
            </div>
          </div>
        </div>

        {/* Tactical Directional Buttons */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            {joystickTarget === 'SERVO' ? '[ SERVO HOLD-BUTTONS ]' : '[ TACTICAL D-PAD & HOTKEYS ]'}
          </span>

          <div className="grid grid-cols-3 gap-2 w-54">
            {/* Top row */}
            <div />
            <button
              onClick={() => {
                soundFx.playKeyClick();
                onDirectionChange('FORWARD');
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                motorState.roverDirection === 'FORWARD' || activeKey === 'W' || activeKey === 'ARROWUP'
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.9)] ring-2 ring-emerald-300'
                  : 'bg-black hover:bg-emerald-950 text-slate-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <ArrowUp className="w-5 h-5 mb-0.5 text-emerald-400" />
              <span>FWD [W]</span>
            </button>
            <div />

            {/* Middle row */}
            <button
              onPointerDown={() => {
                soundFx.playServoTick();
                if (joystickTarget === 'SERVO') {
                  onServoLeft?.(servoSpeed);
                } else {
                  onDirectionChange('LEFT');
                }
              }}
              onPointerUp={() => {
                if (joystickTarget === 'SERVO') {
                  onServoStop?.();
                }
              }}
              onPointerLeave={() => {
                if (joystickTarget === 'SERVO') {
                  onServoStop?.();
                }
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md select-none touch-none ${
                (joystickTarget === 'SERVO' ? isServoRotatingLeft : motorState.roverDirection === 'LEFT') || activeKey === 'A' || activeKey === 'ARROWLEFT' || activeKey === 'Q'
                  ? 'bg-cyan-500 text-black border-white shadow-[0_0_15px_rgba(0,255,255,0.9)] ring-2 ring-cyan-300'
                  : 'bg-black hover:bg-cyan-950 text-slate-200 border-cyan-500/30 hover:border-cyan-400'
              }`}
            >
              {joystickTarget === 'SERVO' ? (
                <RotateCcw className="w-5 h-5 mb-0.5 text-cyan-400" />
              ) : (
                <ArrowLeft className="w-5 h-5 mb-0.5 text-cyan-400" />
              )}
              <span>{joystickTarget === 'SERVO' ? 'SERVO ◄' : 'LEFT [A]'}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playAlarm();
                if (joystickTarget === 'SERVO') {
                  onServoStop?.();
                } else {
                  onDirectionChange('STOP');
                }
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                (joystickTarget === 'SERVO' ? !isServoRotatingLeft && !isServoRotatingRight : motorState.roverDirection === 'STOP') || activeKey === 'X' || activeKey === 'R'
                  ? 'bg-red-600 text-white border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.8)] ring-2 ring-red-400'
                  : 'bg-black hover:bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <Square className="w-5 h-5 mb-0.5 fill-current text-red-500" />
              <span>STOP [X]</span>
            </button>

            <button
              onPointerDown={() => {
                soundFx.playServoTick();
                if (joystickTarget === 'SERVO') {
                  onServoRight?.(servoSpeed);
                } else {
                  onDirectionChange('RIGHT');
                }
              }}
              onPointerUp={() => {
                if (joystickTarget === 'SERVO') {
                  onServoStop?.();
                }
              }}
              onPointerLeave={() => {
                if (joystickTarget === 'SERVO') {
                  onServoStop?.();
                }
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md select-none touch-none ${
                (joystickTarget === 'SERVO' ? isServoRotatingRight : motorState.roverDirection === 'RIGHT') || activeKey === 'D' || activeKey === 'ARROWRIGHT' || activeKey === 'E'
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.9)] ring-2 ring-emerald-300'
                  : 'bg-black hover:bg-emerald-950 text-slate-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              {joystickTarget === 'SERVO' ? (
                <RotateCw className="w-5 h-5 mb-0.5 text-emerald-400" />
              ) : (
                <ArrowRight className="w-5 h-5 mb-0.5 text-emerald-400" />
              )}
              <span>{joystickTarget === 'SERVO' ? '► SERVO' : 'RIGHT [D]'}</span>
            </button>

            {/* Bottom row */}
            <div />
            <button
              onClick={() => {
                soundFx.playKeyClick();
                onDirectionChange('BACKWARD');
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                motorState.roverDirection === 'BACKWARD' || activeKey === 'S' || activeKey === 'ARROWDOWN'
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.9)] ring-2 ring-emerald-300'
                  : 'bg-black hover:bg-emerald-950 text-slate-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <ArrowDown className="w-5 h-5 mb-0.5 text-emerald-400" />
              <span>REV [S]</span>
            </button>
            <div />
          </div>
        </div>
      </div>

      {/* Speed Throttle & Gears */}
      <div className="bg-black p-3 rounded-lg border border-emerald-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">
              {joystickTarget === 'SERVO' ? 'SERVO SPEED TARGET:' : 'PWM MOTOR POWER:'}
            </span>
            <span className="font-black text-emerald-300 font-mono text-sm glow-matrix">
              {joystickTarget === 'SERVO' ? `${servoSpeed}%` : `${motorState.speed} / 255`}
            </span>
            <span className="text-[10px] text-emerald-500/70 font-bold">
              {joystickTarget === 'SERVO' ? '(ESP1 GPIO32)' : `(${Math.round((motorState.speed / 255) * 100)}% THRUST)`}
            </span>
          </div>

          <div className="flex gap-1.5">
            {speedPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  soundFx.playKeyClick();
                  onSpeedChange(preset.val);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                  motorState.speed === preset.val
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="255"
          value={motorState.speed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-400 h-2 bg-slate-900 rounded cursor-pointer"
        />
      </div>

      {/* Armored Emergency Killswitch Button */}
      <div className="pt-2.5">
        <button
          onClick={() => {
            soundFx.playAlarm();
            onServoStop?.();
            onEmergencyStop();
          }}
          className="w-full hazard-stripes-red py-3 px-4 rounded-xl border-2 border-red-500 hover:border-red-400 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(239,68,68,0.7)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-mono cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-current animate-pulse text-amber-300" />
          <span>⚠️ EMERGENCY VEHICLE KILLSWITCH (SPACE / CLICK) ⚠️</span>
        </button>
      </div>
    </div>
  );
};
