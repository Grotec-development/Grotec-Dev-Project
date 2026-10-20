import React, { useState } from 'react';
import { Server, CheckCircle2, XCircle, Loader2, ArrowRight, X, Globe, Radio } from 'lucide-react';
import axios from 'axios';
import { CLOUD_BACKEND_API, getCustomApiUrl, setCustomApiUrl } from '../lib/api';
import { Button, Input } from './ui';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
}

export function ServerConfigModal({ isOpen, onClose, onSaved }: ServerConfigModalProps) {
  const currentCustom = getCustomApiUrl();
  const [selectedPreset, setSelectedPreset] = useState<'cloud' | 'lan' | 'local' | 'custom'>(() => {
    if (!currentCustom) return 'cloud';
    if (currentCustom.includes('10.165.201.135')) return 'lan';
    if (currentCustom.includes('localhost') || currentCustom.includes('127.0.0.1') || currentCustom.includes('10.0.2.2')) return 'local';
    return 'custom';
  });
  const [customInput, setCustomInput] = useState(currentCustom || '');
  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string; latency?: number }>({
    status: 'idle',
  });

  if (!isOpen) return null;

  const getEffectiveUrl = () => {
    if (selectedPreset === 'cloud') return CLOUD_BACKEND_API;
    if (selectedPreset === 'lan') return 'http://10.165.201.135:3000/api/v1';
    if (selectedPreset === 'local') return 'http://localhost:3000/api/v1';
    return customInput.trim();
  };

  const handleTestConnection = async () => {
    const target = getEffectiveUrl();
    if (!target) {
      setTestState({ status: 'error', message: 'Please enter a valid URL' });
      return;
    }
    setTestState({ status: 'testing' });
    const start = performance.now();
    try {
      // Test health endpoint with 4.5s timeout
      const res = await axios.get(`${target.replace(/\/+$/, '')}/health`, {
        timeout: 4500,
        validateStatus: () => true,
      });
      const latency = Math.round(performance.now() - start);
      if (res.status >= 200 && res.status < 400) {
        setTestState({ status: 'success', latency, message: `Connected (${latency}ms)` });
      } else {
        setTestState({ status: 'success', latency, message: `Server reached (HTTP ${res.status}, ${latency}ms)` });
      }
    } catch (err: any) {
      setTestState({
        status: 'error',
        message: err.code === 'ECONNABORTED' ? 'Timed out (4.5s)' : 'Server unreachable (Check Wi-Fi/IP)',
      });
    }
  };

  const handleSave = () => {
    let finalUrl: string | null = null;
    if (selectedPreset === 'cloud') {
      finalUrl = null; // resets to default cloud
    } else if (selectedPreset === 'lan') {
      finalUrl = 'http://10.165.201.135:3000/api/v1';
    } else if (selectedPreset === 'local') {
      finalUrl = 'http://localhost:3000/api/v1';
    } else {
      finalUrl = customInput.trim();
    }
    setCustomApiUrl(finalUrl);
    if (onSaved) onSaved(finalUrl || CLOUD_BACKEND_API);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Backend Server Settings</h3>
              <p className="text-[11px] text-slate-500">Configure API endpoint for mobile APK & web</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-left">
          {/* Preset Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Select Environment:</label>

            {/* Cloud Render */}
            <div
              onClick={() => {
                setSelectedPreset('cloud');
                setTestState({ status: 'idle' });
              }}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                selectedPreset === 'cloud'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Radio className={`h-4 w-4 mt-0.5 shrink-0 ${selectedPreset === 'cloud' ? 'text-emerald-700' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">GROTEC Cloud Production</span>
                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">Default</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{CLOUD_BACKEND_API}</p>
              </div>
            </div>

            {/* Dev PC Wi-Fi LAN */}
            <div
              onClick={() => {
                setSelectedPreset('lan');
                setTestState({ status: 'idle' });
              }}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                selectedPreset === 'lan'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Radio className={`h-4 w-4 mt-0.5 shrink-0 ${selectedPreset === 'lan' ? 'text-emerald-700' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Host Wi-Fi Dev PC</span>
                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">LAN / Wi-Fi</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">http://10.165.201.135:3000/api/v1</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Recommended if testing mobile APK connected to PC Wi-Fi hotspot</p>
              </div>
            </div>

            {/* Localhost / Emulator */}
            <div
              onClick={() => {
                setSelectedPreset('local');
                setTestState({ status: 'idle' });
              }}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                selectedPreset === 'local'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Radio className={`h-4 w-4 mt-0.5 shrink-0 ${selectedPreset === 'local' ? 'text-emerald-700' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-900">Local Dev Server (Localhost)</span>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">http://localhost:3000/api/v1</p>
              </div>
            </div>

            {/* Custom LAN IP */}
            <div
              onClick={() => {
                setSelectedPreset('custom');
                setTestState({ status: 'idle' });
              }}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                selectedPreset === 'custom'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Radio className={`h-4 w-4 mt-0.5 shrink-0 ${selectedPreset === 'custom' ? 'text-emerald-700' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-900">Custom LAN IP / Wi-Fi Host</span>
                <p className="text-[11px] text-slate-500 mt-0.5">E.g. testing mobile APK against your computer on Wi-Fi</p>
                {selectedPreset === 'custom' && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      type="url"
                      placeholder="http://192.168.1.50:3000/api/v1"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test Connection Button & Status */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={testState.status === 'testing'}
              onClick={handleTestConnection}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testState.status === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 text-slate-500" />}
              <span>Test Connection</span>
            </button>

            {testState.status === 'success' && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {testState.message}
              </span>
            )}
            {testState.status === 'error' && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                {testState.message}
              </span>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4">
            Apply & Save
          </Button>
        </div>
      </div>
    </div>
  );
}
