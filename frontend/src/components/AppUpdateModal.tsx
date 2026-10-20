import React, { useState } from 'react';
import { Download, ShieldCheck, CheckCircle2, AlertTriangle, Loader2, X, Smartphone, RefreshCw } from 'lucide-react';
import { isNativeApp, requestDownloadPermissions, checkDownloadPermissions } from '../lib/native-calling';
import { Button } from './ui';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppUpdateModal({ isOpen, onClose }: AppUpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadUpdate = async () => {
    setErrorMessage(null);
    setDownloading(true);

    try {
      // 1. Verify and request system permissions if on Android / mobile
      if (isNativeApp()) {
        const hasPermission = await requestDownloadPermissions();
        if (!hasPermission) {
          setPermissionState('denied');
          setErrorMessage('System storage / download permission is required to save and install the APK update. Please allow permissions in device settings.');
          setDownloading(false);
          return;
        }
      }

      setPermissionState('granted');

      // 2. Trigger the download of the fresh production APK
      const downloadUrl = '/grotec-farmeros.apk';
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'grotec-farmeros.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to download update package. Please verify network connection.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Application Update & APK</h3>
              <p className="text-[11px] text-slate-500">GROTEC FarmerOS Mobile Client</p>
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
        <div className="p-5 space-y-4 text-left overflow-y-auto">
          {/* Version Badge & Status */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>Release v2.4 (Enterprise Production)</span>
                <span className="text-[9px] bg-emerald-700 text-white font-bold px-1.5 py-0.2 rounded">Latest</span>
              </div>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Includes regional routes dispatch, offline field delivery verification with electronic POD, and direct telecalling.
              </p>
            </div>
          </div>

          {/* Permission Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🔒 System Permissions:</span>
            </span>
            <p className="text-[11px] leading-relaxed text-slate-500">
              On Android devices, installing or updating the application requires <strong>Storage & Unknown App Installation</strong> permissions. The app will prompt you for system access when starting the download.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Download Initiated!</span>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Check your device downloads or notification shade to open and install <code>grotec-farmeros.apk</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadUpdate}
            disabled={downloading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2 min-h-[40px] px-4 touch-manipulation cursor-pointer"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Requesting Permissions & Downloading…</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download Latest APK</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
