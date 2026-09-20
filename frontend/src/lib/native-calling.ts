/**
 * Native Calling & Device Permissions Bridge
 *
 * Provides direct SIM in-app calling for Android/iOS mobile and tablet apps
 * built with Capacitor, while gracefully falling back to system dialers (tel:)
 * when running in standard web browsers.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface DirectCallerPlugin {
  directCall(options: { number: string }): Promise<{ success: boolean; message?: string }>;
  checkCallPermissions(): Promise<{ granted: boolean }>;
  requestCallPermissions(): Promise<{ granted: boolean }>;
  addListener(
    eventName: 'callStateChanged',
    listenerFunc: (state: { state: 'RINGING' | 'OFFHOOK' | 'IDLE' }) => void
  ): Promise<{ remove: () => void }>;
}

// Register the custom native Android plugin
export const DirectCaller = registerPlugin<DirectCallerPlugin>('DirectCaller');

/**
 * Checks if the current execution environment is a native mobile/tablet app container.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Returns the active platform: 'android', 'ios', or 'web'.
 */
export function getAppPlatform(): 'android' | 'ios' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') {
      return platform;
    }
    return 'web';
  } catch {
    return 'web';
  }
}

/**
 * Normalizes phone numbers for dialing (strips non-numeric characters except leading +).
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Checks and requests Android runtime permissions (CALL_PHONE & READ_PHONE_STATE).
 */
export async function requestCallingPermissions(): Promise<boolean> {
  if (!isNativeApp()) {
    // Browsers manage permissions via browser prompts when tel: is clicked
    return true;
  }

  try {
    const result = await DirectCaller.requestCallPermissions();
    return result.granted;
  } catch (err) {
    console.warn('[NativeCalling] Error requesting permissions, fallback to system dialer:', err);
    return false;
  }
}

export interface CallResult {
  success: boolean;
  mode: 'NATIVE_DIRECT' | 'SYSTEM_TEL';
  error?: string;
}

/**
 * Initiates an outbound phone call.
 * - On Native Android / Tablet: uses native DirectCaller to trigger SIM call directly.
 * - On Web / Desktop Browser: triggers standard tel: URI scheme.
 */
export async function initiateDirectCall(rawPhoneNumber: string): Promise<CallResult> {
  const phoneNumber = sanitizePhoneNumber(rawPhoneNumber);
  if (!phoneNumber) {
    return { success: false, mode: 'SYSTEM_TEL', error: 'Invalid phone number' };
  }

  if (isNativeApp()) {
    try {
      const response = await DirectCaller.directCall({ number: phoneNumber });
      if (response && response.success) {
        return { success: true, mode: 'NATIVE_DIRECT' };
      }
    } catch (nativeErr: any) {
      console.warn('[NativeCalling] Native direct call failed, falling back to tel: URI:', nativeErr);
    }
  }

  // Universal fallback for Web / Desktop or if native direct call is unhandled
  try {
    window.location.href = `tel:${phoneNumber}`;
    return { success: true, mode: 'SYSTEM_TEL' };
  } catch (webErr: any) {
    return { success: false, mode: 'SYSTEM_TEL', error: webErr?.message || 'Failed to trigger dialer' };
  }
}

/**
 * Subscribes to device telephony state changes (call ringing, connected, ended).
 */
export function subscribeToCallState(
  onStateChange: (state: 'RINGING' | 'OFFHOOK' | 'IDLE') => void
): () => void {
  if (!isNativeApp()) {
    return () => {};
  }

  let cleanup: (() => void) | null = null;

  DirectCaller.addListener('callStateChanged', (data) => {
    onStateChange(data.state);
  })
    .then((handle) => {
      cleanup = () => handle.remove();
    })
    .catch((err) => {
      console.warn('[NativeCalling] Failed to attach callStateChanged listener:', err);
    });

  return () => {
    if (cleanup) cleanup();
  };
}
