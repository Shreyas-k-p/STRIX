import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';
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
  const [pendingConfirmationChannel, setPendingConfirmationChannel] = useState<RelayChannel | null>(null);

  const channels: RelayChannel[] = [1, 2, 3, 4];

  const handleRelayClick = (ch: RelayChannel) => {
    if (relayState.requiresConfirmation[ch]) {
      setPendingConfirmationChannel(ch);
    } else {
      onToggleRelay(ch);
    }
  };

  const confirmToggle = () => {
    if (pendingConfirmationChannel !== null) {
      onToggleRelay(pendingConfirmationChannel);
      setPendingConfirmationChannel(null);
    }
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

      {/* Confirmation Modal for Guarded Relays */}
      {pendingConfirmationChannel !== null && (
        <div className="my-2 p-3 hazard-stripes rounded-lg border-2 border-amber-500 text-xs font-mono flex flex-col gap-2 shadow-2xl animate-pulse">
          <div className="flex items-center gap-1.5 text-amber-300 font-black">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>CONFIRM GUARDED PAYLOAD DISARM / SWITCH</span>
          </div>
          <p className="text-slate-200 text-[11px] bg-black/80 p-2 rounded border border-amber-500/30">
            Authorize state change on{' '}
            <strong className="text-amber-400 underline">
              {relayState.labels[pendingConfirmationChannel]}
            </strong>{' '}
            to{' '}
            <strong className="text-white">
              [{relayState.channels[pendingConfirmationChannel] ? 'DISENGAGED' : 'ARMED / ON'}]
            </strong>
            ?
          </p>
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setPendingConfirmationChannel(null)}
              className="px-3 py-1 bg-slate-900 border border-slate-700 text-slate-300 rounded hover:bg-slate-800 font-bold"
            >
              Abort Action
            </button>
            <button
              onClick={confirmToggle}
              className="px-4 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded shadow-[0_0_10px_rgba(255,149,0,0.5)]"
            >
              Confirm Override
            </button>
          </div>
        </div>
      )}

      {/* 4 Relay Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
        {channels.map((ch) => {
          const isOn = relayState.channels[ch];
          const isCritical = relayState.requiresConfirmation[ch];

          return (
            <div
              key={ch}
              onClick={() => handleRelayClick(ch)}
              className={`cursor-pointer rounded-xl p-3 border flex flex-col justify-between transition-all select-none group shadow-lg ${
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
                {isCritical && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400 mt-0.5 font-bold">
                    <ShieldAlert className="w-2.5 h-2.5" /> GUARDED SWITCH
                  </span>
                )}
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
