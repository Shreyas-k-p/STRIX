import React from 'react';
import { ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import type { RelayState, RelayChannel } from '../communication/types';

interface RelayPanelProps {
  relayState: RelayState;
  onToggleRelay: (channel: RelayChannel) => void;
  isConnected: boolean;
}

export const RelayPanel: React.FC<RelayPanelProps> = ({
  relayState,
  onToggleRelay,
}) => {
  const channels: RelayChannel[] = [1, 2, 3, 4];

  const handleRelayClick = (ch: RelayChannel) => {
    onToggleRelay(ch);
  };

  return (
    <div className="hud-panel rounded-xl p-4 shadow-xl flex flex-col justify-between h-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/25 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 font-heading">
            ARMORED 4-CHANNEL RELAYS [ESP2 DIRECT]
          </h3>
        </div>
        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-bold">
          ACTIVE LOW (GPIO 4, 15, 18, 5)
        </span>
      </div>

      {/* 4 Relay Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
        {channels.map((ch) => {
          const isOn = relayState.channels[ch];

          return (
            <div
              key={ch}
              onClick={() => handleRelayClick(ch)}
              className={`cursor-pointer rounded-xl p-3 border flex flex-col justify-between transition-all select-none group shadow-lg active:scale-95 ${
                isOn
                  ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(255,149,0,0.3)] hover:border-amber-300'
                  : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/60'
              }`}
            >
              {/* Card top */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-slate-300">
                  CH {ch}
                </span>
                <span
                  className={`w-3 h-3 rounded-full border ${
                    isOn
                      ? 'bg-amber-400 border-amber-200 shadow-[0_0_10px_rgba(255,149,0,0.9)] animate-pulse'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                />
              </div>

              {/* Label */}
              <div className="py-2">
                <div className="text-xs font-bold text-slate-200 line-clamp-1">
                  {relayState.labels[ch]}
                </div>
              </div>

              {/* Action Button Indicator */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span
                  className={`text-[10px] font-mono font-black ${
                    isOn ? 'text-amber-400 glow-amber' : 'text-slate-500'
                  }`}
                >
                  {isOn ? 'STATUS: ENGAGED' : 'STATUS: SAFE'}
                </span>
                {isOn ? (
                  <ToggleRight className="w-6 h-6 text-amber-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-600 group-hover:text-amber-400/60" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>Module 1: IN1 (GPIO4), IN2 (GPIO15) | Module 2: IN1 (GPIO18), IN2 (GPIO5)</span>
        <span className="text-amber-400 font-bold">Active LOW Logic</span>
      </div>
    </div>
  );
};
