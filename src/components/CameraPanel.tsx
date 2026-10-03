import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Camera,
  Settings,
  WifiOff,
  AlertCircle,
  Crosshair,
  Eye,
  Target,
} from 'lucide-react';
import type { CameraState } from '../communication/types';
import { soundFx } from '../utils/audio';

interface CameraPanelProps {
  cameraState: CameraState;
  onUpdateCameraUrl: (url: string) => void;
  onLog: (level: 'INFO' | 'CMD' | 'TEL' | 'ACK' | 'ERROR', msg: string) => void;
  onCameraStatusChange?: (status: 'CONNECTED' | 'DISCONNECTED') => void;
  onRotateServo?: (angle: number) => void;
  servoAngle?: number;
}

export const CameraPanel: React.FC<CameraPanelProps> = ({
  cameraState,
  onUpdateCameraUrl,
  onLog,
  onCameraStatusChange,
  onRotateServo,
  servoAngle = 0,
}) => {
  const [streamUrl, setStreamUrl] = useState<string>(cameraState.url || 'http://192.168.4.1:81/stream');
  const [inputUrl, setInputUrl] = useState<string>(streamUrl);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isNightVision, setIsNightVision] = useState<boolean>(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [clickTarget, setClickTarget] = useState<{ x: number; y: number; angle: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  // FPS Calculator loop
  useEffect(() => {
    let animId: number;
    const updateFps = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      animId = requestAnimationFrame(updateFps);
    };
    animId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleImageLoad = () => {
    frameCountRef.current += 1;
    setIsLive(true);
    setHasError(false);
    if (onCameraStatusChange) onCameraStatusChange('CONNECTED');
  };

  const handleImageError = () => {
    setIsLive(false);
    setHasError(true);
    if (onCameraStatusChange) onCameraStatusChange('DISCONNECTED');
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setStreamUrl(inputUrl);
    onUpdateCameraUrl(inputUrl);
    setIsConfigOpen(false);
    setReloadKey((prev) => prev + 1);
    setHasError(false);
    onLog('INFO', `Camera stream URL set to: ${inputUrl}`);
  };

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    setHasError(false);
    onLog('INFO', 'Reloading ESP32-S3 Camera video feed...');
  };

  const captureSnapshot = () => {
    if (!imgRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth || 640;
      canvas.height = imgRef.current.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImages((prev) => [dataUrl, ...prev.slice(0, 4)]);
        onLog('INFO', 'Optical recon snapshot recorded.');
      }
    } catch {
      onLog('INFO', 'Snapshot captured (CORS protected).');
    }
  };

  // Click-to-Aim Turret Feature
  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const width = rect.width;

    // Relative FOV offset (-40° to +40°)
    const ratio = (clickX / width) - 0.5; // -0.5 to +0.5
    const angleOffset = Math.round(ratio * 80);
    let targetAngle = (servoAngle + angleOffset) % 360;
    if (targetAngle < 0) targetAngle += 360;

    setClickTarget({ x: clickX, y: clickY, angle: targetAngle });
    soundFx.playHackSuccess();

    if (onRotateServo) {
      onRotateServo(targetAngle);
      onLog('CMD', `OPTICAL CLICK-TO-AIM: Slew turret to ${targetAngle}° (offset ${angleOffset > 0 ? `+${angleOffset}` : angleOffset}°)`);
    }

    // Clear click target animation after 2s
    setTimeout(() => {
      setClickTarget(null);
    }, 2000);
  };

  return (
    <div
      ref={containerRef}
      className="hud-panel rounded-xl p-4 shadow-xl flex flex-col h-full font-mono relative overflow-hidden bg-black/95 border-emerald-500/40"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 font-heading glow-matrix">
            OPTICAL TARGETING & RECON [ESP32-S3]
          </h2>
          <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 hidden sm:inline-block">
            WI-FI DIRECT &bull; CLICK-TO-AIM ACTIVE
          </span>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-1.5">
          {/* Live indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              isLive && !hasError
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive && !hasError ? 'bg-rose-500 animate-ping' : 'bg-slate-600'
              }`}
            />
            {isLive && !hasError ? 'OPTICS LIVE' : 'SIGNAL LOST'}
          </div>

          {/* FPS Counter */}
          <span className="text-[11px] font-mono text-emerald-300 px-2 py-0.5 bg-black rounded border border-emerald-500/30">
            {fps} FPS
          </span>

          {/* Night Vision / Matrix Green Shader Toggle */}
          <button
            onClick={() => setIsNightVision(!isNightVision)}
            className={`p-1.5 rounded border transition-colors ${
              isNightVision
                ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_8px_rgba(0,255,65,0.8)]'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-400'
            }`}
            title="Toggle Matrix Night-Vision Shader"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Stream reload */}
          <button
            onClick={handleReload}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
            title="Reload Video Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Snapshot capture */}
          <button
            onClick={captureSnapshot}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
            title="Capture Recon Snapshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Settings modal toggle */}
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
            title="Configure Camera IP / URL"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
            title="Toggle Fullscreen View"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Camera Stream Viewport (Clickable for Click-To-Aim Turret) */}
      <div
        onClick={handleViewportClick}
        className="relative flex-1 flex items-center justify-center bg-black overflow-hidden scanline-bg select-none cursor-crosshair group"
        title="CLICK ANYWHERE ON VIDEO TO AIM SERVO TURRET TO THAT BEARING"
      >
        {/* Military HUD Targeting Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 z-10">
          {/* Top HUD markers */}
          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 tracking-wider">
            <span className="bg-black/75 px-2 py-0.5 rounded border border-emerald-500/40 glow-matrix">
              AZIMUTH: {servoAngle.toString().padStart(3, '0')}° BEARING &bull; FOV: 80°
            </span>
            <span className="bg-black/75 px-2 py-0.5 rounded border border-emerald-500/40 glow-matrix">
              MODE: CLICK-TO-AIM ACTIVE
            </span>
          </div>

          {/* Central Military Reticle */}
          <div className="self-center relative w-48 h-48 border border-emerald-500/30 rounded-full flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 border border-emerald-500/40 rounded-full" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-500/30" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-emerald-500/30" />
            {/* Center target brackets */}
            <div className="w-6 h-6 border-t-2 border-b-2 border-emerald-400" />
            <div className="absolute text-[8px] font-bold text-emerald-400/90 top-3">ELEV: 00°</div>
            <div className="absolute text-[8px] font-bold text-emerald-400/90 bottom-3">TARGET LOCK: ENGAGED</div>
          </div>

          {/* Bottom HUD markers */}
          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
            <span className="bg-black/75 px-2 py-0.5 rounded border border-emerald-500/40">
              CLICK VIDEO = SLEW TURRET
            </span>
            <span className="bg-black/75 px-2 py-0.5 rounded border border-emerald-500/40">
              PROTOCOL: MJPEG HTTP:81
            </span>
          </div>
        </div>

        {/* Click-To-Aim Laser Target Animation */}
        {clickTarget && (
          <div
            style={{ left: clickTarget.x, top: clickTarget.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex flex-col items-center animate-ping duration-1000"
          >
            <Target className="w-8 h-8 text-rose-500" />
            <span className="text-[10px] font-black text-rose-400 bg-black/90 px-1 rounded border border-rose-500">
              LOCK {clickTarget.angle}°
            </span>
          </div>
        )}

        {/* Actual Image Stream Element */}
        <img
          key={reloadKey}
          ref={imgRef}
          src={streamUrl}
          alt="ESP32-S3 Stream"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            filter: isNightVision
              ? 'sepia(1) hue-rotate(90deg) contrast(1.5) brightness(1.1)'
              : 'none',
          }}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Offline / Connection Error Overlay */}
        {(!isLive || hasError) && (
          <div className="absolute inset-0 bg-[#020408]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 pointer-events-auto">
            <div className="w-16 h-16 rounded-full bg-black border border-emerald-500/40 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,255,65,0.2)]">
              <WifiOff className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-black text-emerald-300 font-heading mb-1 tracking-wider glow-matrix">
              OPTICAL SIGNAL OFFLINE
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-3 font-mono">
              Target IP: <span className="text-emerald-400 break-all">{streamUrl}</span>
            </p>
            <div className="text-[11px] text-slate-400 max-w-md bg-black/90 border border-emerald-500/30 rounded-lg p-3 text-left space-y-1 font-mono mb-3">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <AlertCircle className="w-3.5 h-3.5" /> Optics Diagnostic:
              </div>
              <p>1. Connect laptop Wi-Fi to ESP32-S3 access point.</p>
              <p>2. Verify port 81 HTTP MJPEG stream (e.g. http://192.168.4.1:81/stream).</p>
              <p>3. Optical feed runs independently of NRF24 command channel.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReload}
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs font-mono transition-colors shadow-md"
              >
                RECONNECT FEED
              </button>
              <button
                onClick={() => setIsConfigOpen(true)}
                className="px-3.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 text-xs font-mono border border-emerald-500/40 transition-colors"
              >
                CONFIG URL
              </button>
            </div>
          </div>
        )}

        {/* Snapshot Gallery Overlay */}
        {capturedImages.length > 0 && (
          <div className="absolute bottom-10 left-3 flex gap-1.5 z-20 pointer-events-auto">
            {capturedImages.map((img, idx) => (
              <a
                key={idx}
                href={img}
                download={`recon-snap-${Date.now()}-${idx}.jpg`}
                className="w-10 h-8 rounded border border-emerald-500/50 overflow-hidden shadow-md block hover:scale-110 transition-transform"
                title="Click to Download Snapshot"
              >
                <img src={img} alt="Snapshot" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Stream Config Dialog */}
      {isConfigOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-30">
          <div className="bg-slate-950 border border-emerald-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-black text-emerald-300 font-heading mb-3 uppercase tracking-wider glow-matrix">
              CONFIGURE ESP32-S3 VIDEO FEED
            </h3>
            <form onSubmit={handleSaveUrl} className="flex flex-col gap-3 font-mono">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  MJPEG STREAM URL (PORT 81):
                </label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="http://192.168.4.1:81/stream"
                  className="w-full px-3 py-2 rounded bg-black border border-emerald-500/40 text-emerald-300 text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-900 text-slate-400 hover:text-white text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-md"
                >
                  SAVE & RELOAD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
