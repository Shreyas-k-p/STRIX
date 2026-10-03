import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  RotateCw,
  RotateCcw,
  Square,
  Sliders,
  Repeat,
  Compass,
  CornerDownLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ServoState } from '../communication/types';
import { soundFx } from '../utils/audio';

interface ServoPanelProps {
  servoState: ServoState;
  onSetAngle: (angle: number) => void;
  onSetSpin: (speed: number) => void;
  onSetMode: (mode: 'POSITION_360' | 'CONTINUOUS_ROTATION') => void;
  onToggleAutoSweep: () => void;
  isConnected: boolean;
}

export const ServoPanel: React.FC<ServoPanelProps> = ({
  servoState,
  onSetAngle,
  onSetSpin,
  onSetMode,
  onToggleAutoSweep,
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const jogRef = useRef<HTMLDivElement>(null);
  const [isDialDragging, setIsDialDragging] = useState<boolean>(false);
  const [isJogDragging, setIsJogDragging] = useState<boolean>(false);
  const [spinSpeedPreset, setSpinSpeedPreset] = useState<number>(75);
  const [directDegreeInput, setDirectDegreeInput] = useState<string>(String(servoState.angle));
  const [activeHotkey, setActiveHotkey] = useState<'Q' | 'E' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundFx.enabled);
  const [activeTab, setActiveTab] = useState<'AIMING_360' | 'JOG_WHEEL' | 'PANORAMA' | 'SPIN_360'>('AIMING_360');

  // Memory angle slots (M1, M2, M3)
  const [memorySlots, setMemorySlots] = useState<{ [key: string]: number }>({
    M1: 0,
    M2: 90,
    M3: 180,
  });

  // Hold-to-slew interval ref
  const slewIntervalRef = useRef<number | null>(null);

  // Sync direct input when angle changes
  useEffect(() => {
    setDirectDegreeInput(String(servoState.angle));
  }, [servoState.angle]);

  // Sound toggle
  const toggleSound = () => {
    soundFx.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) soundFx.playKeyClick();
  };

  const handleStep = useCallback((delta: number) => {
    let next = (servoState.angle + delta) % 360;
    if (next < 0) next += 360;
    soundFx.playServoTick();
    onSetAngle(Math.round(next));
  }, [servoState.angle, onSetAngle]);

  // Hold to continuously slew
  const startSlewing = (direction: 'LEFT' | 'RIGHT') => {
    stopSlewing();
    const delta = direction === 'LEFT' ? -5 : 5;
    handleStep(delta);
    slewIntervalRef.current = window.setInterval(() => {
      handleStep(delta);
    }, 100);
  };

  const stopSlewing = () => {
    if (slewIntervalRef.current !== null) {
      window.clearInterval(slewIntervalRef.current);
      slewIntervalRef.current = null;
    }
  };

  // Keyboard Q and E turret rotation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'Q') {
        setActiveHotkey('Q');
        handleStep(-5);
      } else if (k === 'E') {
        setActiveHotkey('E');
        handleStep(5);
      } else if (k === 'R') {
        soundFx.playKeyClick();
        onSetAngle(0);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === 'Q' || k === 'E') {
        setActiveHotkey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleStep, onSetAngle]);

  // Interactive 360 dial mouse/touch drag handler
  const updateAngleFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;

      // 0 degrees is UP (12 o'clock)
      let deg = Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90);
      if (deg < 0) deg += 360;
      deg = Math.max(0, Math.min(360, deg));
      soundFx.playServoTick();
      onSetAngle(deg);
    },
    [onSetAngle]
  );

  const handleDialPointerDown = (e: React.PointerEvent) => {
    setIsDialDragging(true);
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDialDragging) {
        updateAngleFromPointer(e.clientX, e.clientY);
      }
    };
    const handlePointerUp = () => {
      if (isDialDragging) {
        setIsDialDragging(false);
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDialDragging, updateAngleFromPointer]);

  // Mouse Wheel scroll rotation handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 5;
    if (e.deltaY < 0) {
      handleStep(step); // Scroll up = rotate right
    } else {
      handleStep(-step); // Scroll down = rotate left
    }
  };

  // Jog Shuttle Drag
  const lastJogX = useRef<number>(0);
  const handleJogPointerDown = (e: React.PointerEvent) => {
    setIsJogDragging(true);
    lastJogX.current = e.clientX;
  };

  useEffect(() => {
    const handleJogMove = (e: PointerEvent) => {
      if (!isJogDragging) return;
      const diff = e.clientX - lastJogX.current;
      if (Math.abs(diff) >= 4) {
        const step = diff > 0 ? 2 : -2;
        handleStep(step);
        lastJogX.current = e.clientX;
      }
    };
    const handleJogUp = () => {
      setIsJogDragging(false);
    };
    window.addEventListener('pointermove', handleJogMove);
    window.addEventListener('pointerup', handleJogUp);
    return () => {
      window.removeEventListener('pointermove', handleJogMove);
      window.removeEventListener('pointerup', handleJogUp);
    };
  }, [isJogDragging, handleStep]);

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(directDegreeInput, 10);
    if (!isNaN(parsed)) {
      let clamped = parsed % 360;
      if (clamped < 0) clamped += 360;
      soundFx.playHackSuccess();
      onSetAngle(clamped);
    }
  };

  // Save current angle to memory slot
  const saveToMemory = (slot: 'M1' | 'M2' | 'M3') => {
    setMemorySlots((prev) => ({ ...prev, [slot]: servoState.angle }));
    soundFx.playHackSuccess();
  };

  // Recall memory slot
  const recallMemory = (slot: 'M1' | 'M2' | 'M3') => {
    const angle = memorySlots[slot];
    if (angle !== undefined) {
      soundFx.playServoTick();
      onSetAngle(angle);
    }
  };

  return (
    <div className="hud-panel rounded-xl p-3.5 shadow-2xl flex flex-col justify-between h-full font-mono border-emerald-500/40 bg-black/90">
      {/* Header with Cyber Hacker Prompt */}
      <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 font-heading glow-matrix">
                360° SERVO TURRET MATRIX
              </h3>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 border border-emerald-500 text-emerald-300 rounded font-bold">
                ROOTKIT_v2
              </span>
            </div>
            <div className="text-[9px] text-emerald-500/70 font-mono">
              [ESP32 #2] &bull; 14-VECTOR MULTI-ROTATION ENGINE
            </div>
          </div>
        </div>

        {/* Current Angle Display & Audio Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-1 rounded bg-black border border-emerald-500/40 text-emerald-400 hover:text-emerald-200"
            title={soundEnabled ? 'Mute Hacker Sound FX' : 'Enable Hacker Sound FX'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-emerald-500 text-[10px] font-bold">BEARING:</span>
            <span className="font-black text-emerald-300 text-sm px-2 py-0.5 rounded bg-black border border-emerald-500/60 shadow-[0_0_12px_rgba(0,255,65,0.4)] glow-matrix">
              {servoState.angle.toString().padStart(3, '0')}°
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Control Tabs: Choose Rotation Tool */}
      <div className="grid grid-cols-4 gap-1 bg-black p-1 rounded border border-emerald-500/40 mb-2 text-[10px] font-bold">
        <button
          onClick={() => {
            setActiveTab('AIMING_360');
            onSetMode('POSITION_360');
          }}
          className={`py-1 rounded text-center transition-all ${
            activeTab === 'AIMING_360' && servoState.mode === 'POSITION_360'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(0,255,65,0.8)]'
              : 'text-emerald-500/70 hover:text-emerald-300'
          }`}
        >
          [1. RADAR DIAL]
        </button>

        <button
          onClick={() => {
            setActiveTab('JOG_WHEEL');
            onSetMode('POSITION_360');
          }}
          className={`py-1 rounded text-center transition-all ${
            activeTab === 'JOG_WHEEL'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(0,255,65,0.8)]'
              : 'text-emerald-500/70 hover:text-emerald-300'
          }`}
        >
          [2. JOG SHUTTLE]
        </button>

        <button
          onClick={() => {
            setActiveTab('PANORAMA');
            onSetMode('POSITION_360');
          }}
          className={`py-1 rounded text-center transition-all ${
            activeTab === 'PANORAMA'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(0,255,65,0.8)]'
              : 'text-emerald-500/70 hover:text-emerald-300'
          }`}
        >
          [3. TACTICAL SECTORS]
        </button>

        <button
          onClick={() => {
            setActiveTab('SPIN_360');
            onSetMode('CONTINUOUS_ROTATION');
          }}
          className={`py-1 rounded text-center transition-all ${
            servoState.mode === 'CONTINUOUS_ROTATION'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(0,255,65,0.8)]'
              : 'text-emerald-500/70 hover:text-emerald-300'
          }`}
        >
          [4. 360° SPIN]
        </button>
      </div>

      {/* Main Body per Active Tab */}
      {servoState.mode === 'POSITION_360' && activeTab === 'AIMING_360' && (
        <div className="flex flex-col gap-2.5 flex-1 justify-center">
          {/* Top Row: Rotating Radar Scope + 8-Waypoint Compass Rose */}
          <div className="flex flex-wrap items-center justify-around gap-2 py-0.5">
            {/* Method 1: Interactive 360° Circular Radar Dial (Drag & Scroll Wheel) */}
            <div className="flex flex-col items-center">
              <div
                ref={dialRef}
                onPointerDown={handleDialPointerDown}
                onWheel={handleWheel}
                className="relative w-34 h-34 sm:w-36 sm:h-36 rounded-full bg-black border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(0,255,65,0.25),inset_0_0_20px_rgba(0,0,0,0.95)] flex items-center justify-center cursor-crosshair select-none"
                title="Drag pointer around ring OR scroll mouse wheel to slew angle"
              >
                {/* Radar sweep lines & ticks */}
                <div className="absolute inset-2.5 rounded-full border border-dashed border-emerald-500/30 pointer-events-none" />
                <div className="absolute inset-7 rounded-full border border-emerald-500/20 pointer-events-none" />

                {/* Cardinal Labels */}
                <div className="absolute top-1 text-[9px] font-bold text-emerald-400">0° N</div>
                <div className="absolute right-1.5 text-[9px] font-bold text-emerald-500/70">90° E</div>
                <div className="absolute bottom-1 text-[9px] font-bold text-emerald-500/70">180° S</div>
                <div className="absolute left-1.5 text-[9px] font-bold text-emerald-500/70">270° W</div>

                {/* Rotating Azimuth Needle */}
                <div
                  style={{
                    transform: `rotate(${servoState.angle}deg)`,
                    transformOrigin: 'bottom center',
                  }}
                  className="absolute top-2 w-1.5 h-15 bg-gradient-to-t from-emerald-500 via-cyan-400 to-white rounded-full shadow-[0_0_12px_rgba(0,255,65,0.9)] pointer-events-none transition-transform duration-100"
                />

                {/* Center Pivot HUD */}
                <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-black shadow-md z-10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
              </div>
              <span className="text-[9px] text-emerald-500/70 mt-1 font-bold">
                [DRAG DIAL &bull; MOUSE WHEEL]
              </span>
            </div>

            {/* Method 2: 8-Waypoint Cardinal Compass Rose Keypad */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                [ 8-WAY COMPASS ROSE ]
              </span>
              <div className="grid grid-cols-3 gap-1 w-34">
                {[
                  { deg: 315, label: 'NW' },
                  { deg: 0, label: 'N [0°]' },
                  { deg: 45, label: 'NE' },
                  { deg: 270, label: 'W [270°]' },
                  { deg: 0, label: 'CTR', isCenter: true },
                  { deg: 90, label: 'E [90°]' },
                  { deg: 225, label: 'SW' },
                  { deg: 180, label: 'S [180°]' },
                  { deg: 135, label: 'SE' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      soundFx.playServoTick();
                      onSetAngle(item.deg);
                    }}
                    className={`p-1 text-[9px] font-bold rounded border transition-all ${
                      item.isCenter
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900'
                        : servoState.angle === item.deg
                        ? 'bg-emerald-500 text-black border-white shadow-[0_0_10px_rgba(0,255,65,0.8)]'
                        : 'bg-black text-emerald-400 border-emerald-500/40 hover:bg-emerald-950'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Method 3 & 4: Continuous Hold-to-Slew & Hotkeys Q/E */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Hold to Pan Left */}
            <button
              onMouseDown={() => startSlewing('LEFT')}
              onMouseUp={stopSlewing}
              onMouseLeave={stopSlewing}
              onTouchStart={() => startSlewing('LEFT')}
              onTouchEnd={stopSlewing}
              className={`py-1.5 px-2 rounded border text-[10px] font-black transition-all flex items-center justify-center gap-1.5 select-none ${
                activeHotkey === 'Q'
                  ? 'bg-emerald-400 text-black border-white shadow-[0_0_10px_rgba(0,255,65,0.8)]'
                  : 'bg-black text-emerald-300 border-emerald-500/50 hover:bg-emerald-950 active:bg-emerald-500 active:text-black'
              }`}
              title="Hold to continuously slew left (or tap Q)"
            >
              <span>◀◀ HOLD PAN LEFT</span>
              <span className="text-[9px] opacity-75 font-mono">[Q]</span>
            </button>

            {/* Hold to Pan Right */}
            <button
              onMouseDown={() => startSlewing('RIGHT')}
              onMouseUp={stopSlewing}
              onMouseLeave={stopSlewing}
              onTouchStart={() => startSlewing('RIGHT')}
              onTouchEnd={stopSlewing}
              className={`py-1.5 px-2 rounded border text-[10px] font-black transition-all flex items-center justify-center gap-1.5 select-none ${
                activeHotkey === 'E'
                  ? 'bg-emerald-400 text-black border-white shadow-[0_0_10px_rgba(0,255,65,0.8)]'
                  : 'bg-black text-emerald-300 border-emerald-500/50 hover:bg-emerald-950 active:bg-emerald-500 active:text-black'
              }`}
              title="Hold to continuously slew right (or tap E)"
            >
              <span className="text-[9px] opacity-75 font-mono">[E]</span>
              <span>HOLD PAN RIGHT ▶▶</span>
            </button>
          </div>

          {/* Method 5 & 6: Direct Degree Input & Micro-Trim Bar */}
          <div className="flex items-center gap-1.5 bg-black/95 p-1 rounded border border-emerald-500/30">
            <span className="text-[9px] text-emerald-500 font-bold shrink-0">DIRECT:</span>
            <form onSubmit={handleDirectSubmit} className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="0"
                max="360"
                value={directDegreeInput}
                onChange={(e) => setDirectDegreeInput(e.target.value)}
                placeholder="0-360"
                className="w-14 px-1 py-0.5 rounded bg-slate-950 border border-emerald-500/50 text-emerald-300 text-xs font-bold text-center focus:outline-none focus:border-emerald-400"
              />
              <span className="text-xs text-emerald-400 font-bold">°</span>
              <button
                type="submit"
                className="py-1 px-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] transition-colors flex items-center justify-center gap-1 shadow-sm"
              >
                <span>SLEW</span>
                <CornerDownLeft className="w-2.5 h-2.5" />
              </button>
            </form>

            {/* Quick ±10° buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => handleStep(-10)}
                className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold"
              >
                -10°
              </button>
              <button
                onClick={() => handleStep(10)}
                className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold"
              >
                +10°
              </button>
            </div>
          </div>

          {/* Micro-Trim Steps Bar */}
          <div className="flex items-center justify-between gap-1 text-[9px]">
            <span className="text-emerald-500/70 font-bold shrink-0">TRIM:</span>
            {[-45, -15, -5, -1, 1, 5, 15, 45].map((delta) => (
              <button
                key={delta}
                onClick={() => handleStep(delta)}
                className="flex-1 py-0.5 bg-black hover:bg-emerald-950 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400 rounded text-center font-bold transition-colors"
                title={`Rotate ${delta > 0 ? `+${delta}°` : `${delta}°`}`}
              >
                {delta > 0 ? `+${delta}` : delta}°
              </button>
            ))}
          </div>

          {/* Method 7: Linear 0°-360° Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-emerald-500 font-bold">0°</span>
            <input
              type="range"
              min="0"
              max="360"
              value={servoState.angle}
              onChange={(e) => {
                soundFx.playServoTick();
                onSetAngle(parseInt(e.target.value, 10));
              }}
              className="flex-1 accent-emerald-400 h-2 bg-slate-900 rounded cursor-pointer"
            />
            <span className="text-[9px] text-emerald-500 font-bold">360°</span>
          </div>

          {/* Method 8: Autonomous Radar Patrol Sweep (0° ↔ 360°) */}
          <button
            onClick={() => {
              soundFx.playHackSuccess();
              onToggleAutoSweep();
            }}
            className={`w-full py-1 rounded border text-[11px] font-black flex items-center justify-center gap-2 transition-all ${
              servoState.isAutoSweeping
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_15px_rgba(255,183,0,0.8)] animate-pulse'
                : 'bg-black hover:bg-emerald-950 text-emerald-300 border-emerald-500/50'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>
              {servoState.isAutoSweeping
                ? 'HALT AUTONOMOUS RADAR PATROL'
                : 'ENGAGE AUTONOMOUS RADAR PATROL (0° ↔ 360°)'}
            </span>
          </button>
        </div>
      )}

      {/* Tab 2: Rotary Jog-Shuttle CNC Encoder Wheel */}
      {servoState.mode === 'POSITION_360' && activeTab === 'JOG_WHEEL' && (
        <div className="flex flex-col gap-3 flex-1 justify-center items-center py-2">
          <div className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase text-center">
            [CNC ROTARY JOG-SHUTTLE ENCODER &bull; PRECISION SLEW]
          </div>

          {/* Interactive Tactile Jog Wheel */}
          <div
            ref={jogRef}
            onPointerDown={handleJogPointerDown}
            onWheel={handleWheel}
            className="w-44 h-44 rounded-full bg-slate-950 border-4 border-emerald-500/60 shadow-[0_0_25px_rgba(0,255,65,0.3),inset_0_0_30px_rgba(0,0,0,0.95)] flex items-center justify-center cursor-ew-resize relative select-none"
            title="Drag horizontally or scroll mouse wheel to spin rotary encoder"
          >
            {/* Encoder Ring Teeth */}
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-500/40" />
            <div className="absolute inset-5 rounded-full border border-emerald-500/20" />

            {/* Simulated Rotary Notches */}
            <div
              style={{
                transform: `rotate(${servoState.angle * 2}deg)`,
                transition: isJogDragging ? 'none' : 'transform 0.1s ease',
              }}
              className="w-28 h-28 rounded-full border-2 border-emerald-400/50 flex items-center justify-center relative"
            >
              {/* Finger Indent Pit */}
              <div className="absolute top-2 w-4 h-4 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(0,255,65,0.9)] border border-white" />
              <div className="text-center font-black text-xs text-emerald-300 glow-matrix">
                {servoState.angle}°
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-emerald-400/80">
            [DRAG LEFT/RIGHT OR SCROLL WHEEL TO DIAL ANGLE]
          </div>

          {/* Quick Jog Increments */}
          <div className="grid grid-cols-4 gap-1.5 w-full">
            <button
              onClick={() => handleStep(-45)}
              className="py-1 bg-black border border-emerald-500/40 hover:bg-emerald-950 text-emerald-300 rounded font-bold text-[10px]"
            >
              -45° JOG
            </button>
            <button
              onClick={() => handleStep(-15)}
              className="py-1 bg-black border border-emerald-500/40 hover:bg-emerald-950 text-emerald-300 rounded font-bold text-[10px]"
            >
              -15° JOG
            </button>
            <button
              onClick={() => handleStep(15)}
              className="py-1 bg-black border border-emerald-500/40 hover:bg-emerald-950 text-emerald-300 rounded font-bold text-[10px]"
            >
              +15° JOG
            </button>
            <button
              onClick={() => handleStep(45)}
              className="py-1 bg-black border border-emerald-500/40 hover:bg-emerald-950 text-emerald-300 rounded font-bold text-[10px]"
            >
              +45° JOG
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Tactical Sector Presets & Memory Recall Slots */}
      {servoState.mode === 'POSITION_360' && activeTab === 'PANORAMA' && (
        <div className="flex flex-col gap-2.5 flex-1 justify-center py-1">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider text-center">
            [TACTICAL SECTOR PRESETS & 3-SLOT ANGLE MEMORY]
          </div>

          {/* Tactical Sector Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetAngle(0);
              }}
              className="p-2 bg-black hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded flex items-center justify-between text-[11px] font-bold"
            >
              <span>FORWARD FLANK</span>
              <span className="text-emerald-400 font-black">0°</span>
            </button>

            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetAngle(90);
              }}
              className="p-2 bg-black hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded flex items-center justify-between text-[11px] font-bold"
            >
              <span>STARBOARD (RIGHT)</span>
              <span className="text-emerald-400 font-black">90°</span>
            </button>

            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetAngle(180);
              }}
              className="p-2 bg-black hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded flex items-center justify-between text-[11px] font-bold"
            >
              <span>AFT (REARVIEW)</span>
              <span className="text-emerald-400 font-black">180°</span>
            </button>

            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetAngle(270);
              }}
              className="p-2 bg-black hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded flex items-center justify-between text-[11px] font-bold"
            >
              <span>PORT (LEFT FLANK)</span>
              <span className="text-emerald-400 font-black">270°</span>
            </button>
          </div>

          {/* Memory Angle Recall & Save */}
          <div className="bg-black/90 p-2 rounded border border-emerald-500/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
              <span>TARGET MEMORY SLOTS:</span>
              <span className="text-[9px] text-emerald-500/60">[CLICK TO SLEW &bull; RIGHT-CLICK/BUTTON TO SAVE]</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['M1', 'M2', 'M3'] as const).map((slot) => (
                <div key={slot} className="flex flex-col bg-slate-950 p-1.5 rounded border border-emerald-500/40 gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-300 text-xs">{slot}</span>
                    <span className="font-mono text-emerald-400 text-xs">{memorySlots[slot]}°</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => recallMemory(slot)}
                      className="flex-1 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[9px] rounded"
                      title={`Slew servo to ${memorySlots[slot]}°`}
                    >
                      GO
                    </button>
                    <button
                      onClick={() => saveToMemory(slot)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold text-[9px] rounded"
                      title="Save current angle to this slot"
                    >
                      SAVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Continuous Infinite 360° Spin Mode */}
      {servoState.mode === 'CONTINUOUS_ROTATION' && (
        <div className="flex flex-col gap-3 flex-1 justify-center py-2">
          <div className="text-center text-xs text-emerald-400/80 font-bold">
            [CONTINUOUS ROTATION MOTOR &bull; 360° INFINITE ROTATIONAL THRUST]
          </div>

          {/* Continuous Spin Direction Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetSpin(-spinSpeedPreset);
              }}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 font-black text-xs transition-all ${
                servoState.speed < 0
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.8)] ring-2 ring-emerald-400'
                  : 'bg-black hover:bg-emerald-950 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <RotateCcw className={`w-5 h-5 ${servoState.speed < 0 ? 'animate-spin' : ''}`} />
              <span>SPIN CCW ↺</span>
            </button>

            <button
              onClick={() => {
                soundFx.playAlarm();
                onSetSpin(0);
              }}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 font-black text-xs transition-all ${
                servoState.speed === 0
                  ? 'bg-red-600 text-white border-red-300 shadow-[0_0_12px_rgba(255,0,51,0.8)]'
                  : 'bg-black hover:bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              <Square className="w-5 h-5 fill-current" />
              <span>HALT SPIN ⏹</span>
            </button>

            <button
              onClick={() => {
                soundFx.playServoTick();
                onSetSpin(spinSpeedPreset);
              }}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 font-black text-xs transition-all ${
                servoState.speed > 0
                  ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_rgba(0,255,65,0.8)] ring-2 ring-emerald-400'
                  : 'bg-black hover:bg-emerald-950 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <RotateCw className={`w-5 h-5 ${servoState.speed > 0 ? 'animate-spin' : ''}`} />
              <span>SPIN CW ↻</span>
            </button>
          </div>

          {/* Spin Speed Slider */}
          <div className="bg-black p-2 rounded border border-emerald-500/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-emerald-400">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                ROTATION VELOCITY:
              </span>
              <span className="font-black text-emerald-300 glow-matrix">{spinSpeedPreset}% PWM</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={spinSpeedPreset}
              onChange={(e) => {
                const spd = parseInt(e.target.value, 10);
                setSpinSpeedPreset(spd);
                if (servoState.speed !== 0) {
                  onSetSpin(servoState.speed > 0 ? spd : -spd);
                }
              }}
              className="w-full accent-emerald-400 h-2 bg-slate-900 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Protocol String Footer */}
      <div className="mt-1.5 text-[9px] text-emerald-500/70 flex items-center justify-between border-t border-emerald-500/30 pt-1.5">
        <span>
          PWN_PACKET:{' '}
          <code className="text-emerald-300 font-bold">
            {servoState.mode === 'POSITION_360'
              ? `CMD|SERVO|${servoState.angle}`
              : servoState.speed === 0
              ? 'CMD|SERVO|STOP'
              : `CMD|SERVO|SPIN|${servoState.speed}`}
          </code>
        </span>
        <span className="text-emerald-400 font-bold">[HOTKEYS: Q/E &bull; JOG &bull; SCROLL]</span>
      </div>
    </div>
  );
};
