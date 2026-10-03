import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Trash2,
  Pause,
  Play,
  Download,
  Send,
  ArrowDown,
  Zap,
} from 'lucide-react';
import type { LogEntry, LogLevel } from '../communication/types';
import { soundFx } from '../utils/audio';

interface EventLogProps {
  logs: LogEntry[];
  isPaused: boolean;
  onClear: () => void;
  onTogglePause: () => void;
  onExport: () => void;
  onSendRawCommand: (cmd: string) => void;
}

export const EventLog: React.FC<EventLogProps> = ({
  logs,
  isPaused,
  onClear,
  onTogglePause,
  onExport,
  onSendRawCommand,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'CMD' | 'TEL' | 'ERROR'>('ALL');
  const [rawInput, setRawInput] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    if (filter === 'CMD') return log.level === 'CMD' || log.level === 'ACK';
    if (filter === 'TEL') return log.level === 'TEL';
    if (filter === 'ERROR') return log.level === 'ERROR';
    return true;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) return;
    soundFx.playHackSuccess();
    onSendRawCommand(rawInput.trim());
    setRawInput('');
  };

  const injectQuickPayload = (cmd: string) => {
    soundFx.playHackSuccess();
    onSendRawCommand(cmd);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'CMD':
        return 'text-amber-400 font-bold';
      case 'TEL':
        return 'text-emerald-400';
      case 'ACK':
        return 'text-cyan-400 font-bold';
      case 'ERROR':
        return 'text-rose-400 font-black';
      case 'INFO':
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col h-full font-mono text-xs border-emerald-500/40 bg-black/95">
      {/* Top Console Controls */}
      <div className="flex flex-wrap items-center justify-between border-b border-emerald-500/25 pb-2.5 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 font-heading glow-matrix">
            TERMINAL INJECTOR & PACKET SNIFFER
          </h3>
          <span className="text-[10px] text-emerald-500/80 font-mono">
            [{filteredLogs.length} LOGGED]
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter Pills */}
          <div className="flex rounded bg-black border border-emerald-500/30 p-0.5 text-[10px]">
            {(['ALL', 'CMD', 'TEL', 'ERROR'] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  soundFx.playKeyClick();
                  setFilter(f);
                }}
                className={`px-2 py-0.5 rounded transition-colors font-bold ${
                  filter === f
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Auto scroll toggle */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              setAutoScroll(!autoScroll);
            }}
            className={`p-1.5 rounded border transition-colors ${
              autoScroll
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-black text-slate-500 border-slate-800'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              onTogglePause();
            }}
            className={`p-1.5 rounded border transition-colors ${
              isPaused
                ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                : 'bg-black text-emerald-300 border-emerald-500/40 hover:bg-emerald-950'
            }`}
            title={isPaused ? 'Resume live log' : 'Pause live log'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Clear */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              onClear();
            }}
            className="p-1.5 rounded bg-black hover:bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Export */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              onExport();
            }}
            className="p-1.5 rounded bg-black hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 border border-slate-800 transition-colors"
            title="Export Mission Log (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-black rounded-lg p-3 overflow-y-auto border border-emerald-500/25 font-mono text-[11px] leading-relaxed min-h-[160px] max-h-[260px] select-text shadow-inner scanline-bg"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-emerald-500/40 italic py-4 text-center font-mono">
            [PWN CONSOLE ONLINE &bull; LISTENING TO ESP32 CLUSTER TELEMETRY]
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="hover:bg-slate-900/60 px-1 py-0.5 rounded transition-colors flex items-start gap-2">
              <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
              <span className={`shrink-0 ${getLevelColor(log.level)}`}>
                [{log.level}]
              </span>
              <span className="text-slate-200 break-all">{log.message}</span>
              {log.raw && (
                <span className="text-emerald-500/60 shrink-0 text-[10px] hidden sm:inline">
                  &lt;{log.raw}&gt;
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick Payload Injector Bar */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto py-1 text-[10px]">
        <span className="text-emerald-500 font-bold shrink-0 flex items-center gap-1">
          <Zap className="w-3 h-3 text-emerald-400" />
          PAYLOADS:
        </span>
        {[
          { label: 'SERVO 0°', cmd: 'CMD|SERVO|0' },
          { label: 'SERVO 90°', cmd: 'CMD|SERVO|90' },
          { label: 'SERVO 180°', cmd: 'CMD|SERVO|180' },
          { label: 'SERVO 270°', cmd: 'CMD|SERVO|270' },
          { label: 'SERVO 360°', cmd: 'CMD|SERVO|360' },
          { label: 'SERVO SPIN CW', cmd: 'CMD|SERVO|SPIN|80' },
          { label: 'SERVO SPIN CCW', cmd: 'CMD|SERVO|SPIN|-80' },
          { label: 'SERVO STOP', cmd: 'CMD|SERVO|STOP' },
          { label: 'HALT MOTORS', cmd: 'CMD|MOTOR|STOP' },
          { label: 'RELAY #1 TOGGLE', cmd: 'CMD|RELAY|1|1' },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => injectQuickPayload(item.cmd)}
            className="px-2 py-0.5 bg-black hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded font-bold shrink-0 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Manual Command Injection Input */}
      <form onSubmit={handleSend} className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 flex items-center bg-black rounded-lg border border-emerald-500/40 px-3 py-1.5 focus-within:border-emerald-400 shadow-sm">
          <span className="text-emerald-400 font-black mr-2 select-none">root@strix-rover:~#</span>
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Type hardware protocol command (e.g. CMD|SERVO|180 or CMD|MOTOR|FWD|200)..."
            className="w-full bg-transparent text-emerald-200 text-xs focus:outline-none placeholder:text-slate-600 font-mono"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-colors flex items-center gap-1.5 shadow-md shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>INJECT</span>
        </button>
      </form>
    </div>
  );
};
