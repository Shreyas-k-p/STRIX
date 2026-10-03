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
} from 'lucide-react';
import type { MotorDirection, MotorState } from '../communication/types';
import { soundFx } from '../utils/audio';

interface RoverJoystickProps {
  motorState: MotorState;
  onDirectionChange: (direction: MotorDirection) => void;
  onSpeedChange: (speed: number) => void;
  onEmergencyStop: () => void;
  isConnected: boolean;
}

export const RoverJoystick: React.FC<RoverJoystickProps> = ({
  motorState,
  onDirectionChange,
  onSpeedChange,
  onEmergencyStop,
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Tactical Speed presets
  const speedPresets = [
    { label: 'STEALTH (100)', val: 100 },
    { label: 'PATROL (180)', val: 180 },
    { label: 'OVERDRIVE (255)', val: 255 },
  ];

  // Map keyboard presses visually
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (['W', 'A', 'S', 'D', 'X', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT'].includes(k)) {
        setActiveKey(k);
        soundFx.playKeyClick();
      }
    };
    const handleKeyUp = () => {
      setActiveKey(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Virtual 2D joystick mouse / touch dragging handler
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

      // Determine direction if moved beyond deadzone
      if (clampedDist > 25) {
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
    [onDirectionChange]
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
        onDirectionChange('STOP');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateKnobFromPointer, onDirectionChange]);

  return (
    <div className="hud-panel rounded-xl p-4 flex flex-col justify-between h-full font-mono bg-black/95 border-emerald-500/40">
      {/* Top Header & Status */}
      <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 font-heading glow-matrix">
            PROPULSION & 6WD VECTOR THRUST
          </h2>
        </div>

        {/* Dynamic Movement Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono font-bold tracking-wider border shadow-md ${
            motorState.isMoving
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse shadow-[0_0_12px_rgba(0,255,65,0.4)]'
              : 'bg-black text-slate-500 border-slate-800'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              motorState.isMoving ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
            }`}
          />
          ROVER: {motorState.isMoving ? `THRUST [${motorState.roverDirection}]` : 'HALTED'}
        </div>
      </div>

      {/* Main Joystick & Tactical D-Pad */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-3">
        {/* Visual 2D Virtual Joystick with Tactical Crosshair */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono text-emerald-400/80 font-bold uppercase tracking-wider">
            [ 2D VECTOR JOYSTICK ]
          </span>
          <div
            ref={joystickBaseRef}
            onPointerDown={handlePointerDown}
            className="relative w-40 h-40 rounded-full bg-black border-2 border-emerald-500/40 shadow-[inset_0_0_25px_rgba(0,0,0,0.9),0_0_15px_rgba(0,255,65,0.15)] flex items-center justify-center cursor-crosshair select-none"
          >
            {/* Tactical Grid & Ticks */}
            <div className="absolute inset-3 rounded-full border border-dashed border-emerald-500/20 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-emerald-500/10 pointer-events-none" />
            <div className="absolute top-1 text-[9px] font-bold text-emerald-400">FWD ▲</div>
            <div className="absolute bottom-1 text-[9px] font-bold text-emerald-400">REV ▼</div>
            <div className="absolute left-1.5 text-[9px] font-bold text-emerald-400">◄ LT</div>
            <div className="absolute right-1.5 text-[9px] font-bold text-emerald-400">RT ►</div>

            {/* Draggable Tactical Knob */}
            <div
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              className={`w-13 h-13 rounded-full flex items-center justify-center border shadow-xl ${
                motorState.isMoving
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black border-white shadow-[0_0_18px_rgba(0,255,65,0.9)]'
                  : 'bg-slate-900 text-emerald-400 border-emerald-500/40'
              }`}
            >
              <Radio className="w-5 h-5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Large Tactile Armored Directional Buttons */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono text-emerald-400/80 font-bold uppercase tracking-wider">
            [ TACTICAL D-PAD & HOTKEYS ]
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
              onClick={() => {
                soundFx.playKeyClick();
                onDirectionChange('LEFT');
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                motorState.roverDirection === 'LEFT' || activeKey === 'A' || activeKey === 'ARROWLEFT'
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.9)] ring-2 ring-emerald-300'
                  : 'bg-black hover:bg-emerald-950 text-slate-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <ArrowLeft className="w-5 h-5 mb-0.5 text-emerald-400" />
              <span>LEFT [A]</span>
            </button>

            <button
              onClick={() => {
                soundFx.playAlarm();
                onDirectionChange('STOP');
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                motorState.roverDirection === 'STOP' || activeKey === 'X'
                  ? 'bg-red-600 text-white border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.8)] ring-2 ring-red-400'
                  : 'bg-black hover:bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <Square className="w-5 h-5 mb-0.5 fill-current text-red-500" />
              <span>STOP [X]</span>
            </button>

            <button
              onClick={() => {
                soundFx.playKeyClick();
                onDirectionChange('RIGHT');
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 shadow-md ${
                motorState.roverDirection === 'RIGHT' || activeKey === 'D' || activeKey === 'ARROWRIGHT'
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.9)] ring-2 ring-emerald-300'
                  : 'bg-black hover:bg-emerald-950 text-slate-200 border-emerald-500/30 hover:border-emerald-400'
              }`}
            >
              <ArrowRight className="w-5 h-5 mb-0.5 text-emerald-400" />
              <span>RIGHT [D]</span>
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
            <span className="font-bold">PWM POWER:</span>
            <span className="font-black text-emerald-300 font-mono text-sm glow-matrix">
              {motorState.speed} / 255
            </span>
            <span className="text-[10px] text-emerald-500/70 font-bold">
              ({Math.round((motorState.speed / 255) * 100)}% THRUST)
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
            onEmergencyStop();
          }}
          className="w-full hazard-stripes-red py-3 px-4 rounded-xl border-2 border-red-500 hover:border-red-400 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(239,68,68,0.7)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-mono"
        >
          <Zap className="w-4 h-4 fill-current animate-pulse text-amber-300" />
          <span>⚠️ EMERGENCY VEHICLE KILLSWITCH (SPACE / CLICK) ⚠️</span>
        </button>
      </div>
    </div>
  );
};
