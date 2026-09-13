/**
 * Real-time Telephony Acoustic Engine & Browser Web-Phone Simulator
 * Provides authentic telecom sound effects:
 * - Dual-tone ringback cadence (440Hz + 480Hz telecom standard)
 * - Connection chime
 * - Disconnect / busy tone
 * - Live synthesized farmer audio responses via Web Speech Synthesis
 */

class TelephonyAudioEngine {
  private audioCtx: AudioContext | null = null;
  private ringInterval: number | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private isRinging = false;

  private getAudioContext(): AudioContext | null {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /** Starts playing realistic telephone ringback tone (1.5s on, 2s off) */
  startRingback() {
    if (this.isRinging) return;
    this.isRinging = true;

    const playBurst = () => {
      if (!this.isRinging) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // US/Indian standard ringback tone: 440 Hz + 480 Hz
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.65);
        osc2.stop(ctx.currentTime + 1.65);

        this.currentOscillators = [osc1, osc2];
      } catch {
        // audio policy fallback
      }
    };

    playBurst();
    this.ringInterval = window.setInterval(playBurst, 3500);
  }

  /** Stops ringback sound immediately */
  stopRingback() {
    this.isRinging = false;
    if (this.ringInterval) {
      window.clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    this.currentOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.currentOscillators = [];
  }

  /** Plays positive connection bridge chime */
  playConnectChime() {
    this.stopRingback();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16); // D6

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.42);
    } catch {}
  }

  /** Plays call disconnect tone */
  playDisconnectChime() {
    this.stopRingback();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {}
  }

  /**
   * Speaks realistic farmer greeting over the in-call audio channel
   */
  speakFarmerGreeting(
    farmerName: string,
    location?: string,
    crop?: string,
    onTranscript?: (text: string) => void,
  ) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const cropText = crop ? crop.replace(/\s*\([^)]*\)/g, '').trim() : 'paddy';
    const locText = location ? location.split(',')[0].trim() : 'Thanjavur';
    const greeting = `Vanakkam. Yes, ${farmerName} here from ${locText}. I am calling regarding my ${cropText} crop. I have a problem with leaf yellowing and stem borer attack. Please suggest Grotec bio fertilizers and guidance.`;
    
    if (onTranscript) {
      onTranscript(greeting);
    }

    const utterance = new SpeechSynthesisUtterance(greeting);
    utterance.rate = 0.95;
    utterance.pitch = 0.98;

    // Try to find an Indian English or Tamil voice
    const voices = window.speechSynthesis.getVoices();
    const targetVoice =
      voices.find((v) => v.lang === 'en-IN' || v.lang === 'ta-IN') ||
      voices.find((v) => v.name.includes('India')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null;

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  stopAll() {
    this.stopRingback();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const telephonyAudio = new TelephonyAudioEngine();
