import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  UserPlus,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowLeft,
  CalendarClock,
  Sparkles,
  AlertTriangle,
  FileEdit,
  X,
  BookOpen,
  Search,
  Plus,
  Copy,
  Sprout,
  HelpCircle,
  ChevronDown,
  Info,
  Volume2,
  VolumeX,
  Users,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { api, errorMessage, messagingApi } from '../lib/api';
import type { Call, CallContext, CustomerDetail, CustomerSummary, Page, QueueItem, KnowledgeGuidance } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { formatDate, formatE164 } from '../lib/format';
import { Alert, Badge, Button, Card, Input, Spinner, cx } from '../components/ui';
import { telephonyAudio } from '../lib/telephonyAudio';
import { NewCustomerModal } from './customers/NewCustomerModal';
import {
  SOIL_TYPE_MAX_LENGTH,
  buildFarmerUpdatePayload,
  canEditFarmerRecord,
} from './customers/customer-edit.util';
import { FarmerQuickEdit } from './customers/FarmerQuickEdit';
import { useAssistantContext } from '../assistant/AssistantContext';

const ACTIVE_STATUSES = ['DIALING', 'RINGING', 'CONNECTED'];
const isActive = (status?: string) => status != null && ACTIVE_STATUSES.includes(status);

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Gentle acoustic audio cue for headset feedback when toggling mute state
function playAudioCue(muted: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Mute: dropping tone 480Hz -> 320Hz. Unmute: rising tone 320Hz -> 480Hz
    const startFreq = muted ? 480 : 320;
    const endFreq = muted ? 320 : 480;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Gracefully ignore if audio context is blocked by browser policy
  }
}

export type AgentCallingMode =
  | 'EXOTEL_IVR_AGENT'
  | 'ACTIVE_TELECALLER'
  | 'PREVIEW_DIALER'
  | 'PROGRESSIVE_DIALER'
  | 'INBOUND_IVR';

export const CALLING_MODES: {
  id: AgentCallingMode;
  label: string;
  badge: string;
  color: string;
  desc: string;
}[] = [
  {
    id: 'EXOTEL_IVR_AGENT',
    label: 'Exotel IVRS cum Agent',
    badge: 'Exotel IVR Agent',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    desc: 'Exotel cloud telephony with automated IVR prompt bridging to agent',
  },
  {
    id: 'ACTIVE_TELECALLER',
    label: 'Active Telecaller',
    badge: 'Active Telecaller',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    desc: 'Direct agent browser-based calling',
  },
  {
    id: 'PREVIEW_DIALER',
    label: 'Preview Dialer',
    badge: 'Preview Dialer',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
    desc: 'Presents farmer and agricultural history before triggering dial',
  },
  {
    id: 'PROGRESSIVE_DIALER',
    label: 'Progressive Auto-Dialer',
    badge: 'Auto-Dialer',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    desc: 'Automatically triggers next call in queue upon wrap-up',
  },
  {
    id: 'INBOUND_IVR',
    label: 'Inbound IVRS Ready',
    badge: 'Inbound IVR',
    color: 'bg-teal-50 text-teal-800 border-teal-200',
    desc: 'Agent stationed to receive incoming farmer IVRS transfers',
  },
];

export interface PendingWrapUpItem {
  callId: string;
  customerId?: string | null;
  leadId?: string | null;
  phoneNumber: string;
  farmerName: string;
  endedAt: string;
  durationSeconds: number;
  notes: string;
  disposition: 'INTERESTED' | 'NOT_INTERESTED' | 'NOT_ANSWERED';
  nextAction: 'CALLBACK';
  followUpDate: string;
  followUpTime: string;
  followUpNote: string;
}

export function AgentWorkspacePage() {
  const [searchParams] = useSearchParams();
  const queryPhone = searchParams.get('phone') || '';
  const queryName = searchParams.get('name') || '';

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [manualNumber, setManualNumber] = useState(queryPhone);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isWrapUp, setIsWrapUp] = useState(false);
  const [pendingWrapUp, setPendingWrapUp] = useState<PendingWrapUpItem | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [context, setContext] = useState<CallContext | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [disposition, setDisposition] = useState<'INTERESTED' | 'NOT_INTERESTED' | 'NOT_ANSWERED'>('INTERESTED');
  const [nextAction, setNextAction] = useState<'CALLBACK'>('CALLBACK');
  const [followUpDate, setFollowUpDate] = useState('2026-03-12');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpNote, setFollowUpNote] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const prevCallStatusRef = useRef<string | null>(null);
  const { setContext: setAssistantContext } = useAssistantContext();
  const { hasPermission } = useAuth();

  // Agent Calling Mode state (persisted to localStorage)
  const [callingMode, setCallingModeState] = useState<AgentCallingMode>(() => {
    try {
      const saved = localStorage.getItem('grotec_calling_mode');
      if (saved && CALLING_MODES.some((m) => m.id === saved)) {
        return saved as AgentCallingMode;
      }
    } catch {}
    return 'EXOTEL_IVR_AGENT';
  });

  const setAgentCallingMode = (mode: AgentCallingMode) => {
    setCallingModeState(mode);
    try {
      localStorage.setItem('grotec_calling_mode', mode);
    } catch {}
    const config = CALLING_MODES.find((m) => m.id === mode);
    setSuccessNotice(`Calling mode switched to: ${config?.label || mode}`);
  };

  // Auto-advance queue state (wrap-up pause & progressive auto-dial)
  const [autoAdvance, setAutoAdvanceState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('grotec_auto_advance') === 'true';
    } catch {
      return false;
    }
  });
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  const setAutoAdvance = (enabled: boolean) => {
    setAutoAdvanceState(enabled);
    try {
      localStorage.setItem('grotec_auto_advance', String(enabled));
    } catch {}
    if (!enabled && autoAdvanceTimerRef.current) {
      window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
      setAutoAdvanceCountdown(null);
    }
    setSuccessNotice(`Queue auto-advance ${enabled ? 'enabled (3s pause)' : 'disabled'}.`);
  };

  const cancelAutoAdvance = () => {
    if (autoAdvanceTimerRef.current) {
      window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceCountdown(null);
    setSuccessNotice('Auto-advance paused.');
  };

  // Farmer Add & Link states
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false);
  const [showExistingFarmerModal, setShowExistingFarmerModal] = useState(false);
  const [existingFarmerSearch, setExistingFarmerSearch] = useState('');
  const [existingFarmersList, setExistingFarmersList] = useState<CustomerSummary[]>([]);
  const [existingFarmerSearching, setExistingFarmerSearching] = useState(false);
  const [existingFarmerLinkBusy, setExistingFarmerLinkBusy] = useState(false);
  const [existingFarmerLinkError, setExistingFarmerLinkError] = useState<string | null>(null);

  const searchExistingFarmers = async (query: string) => {
    setExistingFarmerSearching(true);
    setExistingFarmerLinkError(null);
    try {
      const res = await api.get<Page<CustomerSummary>>('/customers', {
        params: { q: query.trim() || undefined, pageSize: 25 },
      });
      setExistingFarmersList(res.data.items);
    } catch (err) {
      setExistingFarmerLinkError(errorMessage(err));
    } finally {
      setExistingFarmerSearching(false);
    }
  };

  const linkFarmerToCall = async (customerId: string) => {
    if (!activeCall) return;
    setExistingFarmerLinkBusy(true);
    setExistingFarmerLinkError(null);
    try {
      await api.post(`/calls/${activeCall.id}/customer`, { customerId });
      await loadContext(activeCall.id);
      setShowExistingFarmerModal(false);
      setSuccessNotice('Farmer record successfully linked to this active call.');
    } catch (err) {
      setExistingFarmerLinkError(errorMessage(err));
    } finally {
      setExistingFarmerLinkBusy(false);
    }
  };

  const handleNewFarmerCreated = async (newCustomerId: string) => {
    setShowAddFarmerModal(false);
    if (activeCall) {
      try {
        await api.post(`/calls/${activeCall.id}/customer`, { customerId: newCustomerId });
        await loadContext(activeCall.id);
        setSuccessNotice('New farmer profile registered and linked to this call!');
      } catch (err) {
        setError(`Farmer created, but failed to link to active call: ${errorMessage(err)}`);
      }
    }
  };

  const openExistingFarmerModal = () => {
    setShowExistingFarmerModal(true);
    setExistingFarmerLinkError(null);
    const initialQuery = farmerDisplayPhone ? farmerDisplayPhone.replace(/\D/g, '').slice(-10) : '';
    setExistingFarmerSearch(initialQuery);
    void searchExistingFarmers(initialQuery);
  };

  // Knowledge Base in-call state
  const [kbQuery, setKbQuery] = useState('');
  const [kbFilterCrop, setKbFilterCrop] = useState<string>('ALL');
  const [kbGuidanceList, setKbGuidanceList] = useState<KnowledgeGuidance[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [leftColumnTab, setLeftColumnTab] = useState<'profile' | 'kb'>('profile');
  const [queueCategory, setQueueCategory] = useState<'ALL' | 'EXISTING' | 'LEADS' | 'NEW'>('ALL');
  const [queueIndex, setQueueIndex] = useState(0);

  // Instant messaging state for WhatsApp & SMS advisories
  const [sendingMessage, setSendingMessage] = useState<'whatsapp' | 'sms' | null>(null);

  // Active call microphone mute state & hardware track reference
  const [isMuted, setIsMuted] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      playAudioCue(next);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  const callActive = isActive(activeCall?.status);
  const showWorkstation = (callActive || isWrapUp) && !isMinimized;

  // If page loaded with query phone and not yet called, prepopulate
  useEffect(() => {
    if (queryPhone && !activeCall && !isWrapUp) {
      setManualNumber(queryPhone);
    }
  }, [queryPhone, activeCall, isWrapUp]);

  // Autosave call note draft locally so work is never lost if interrupted
  useEffect(() => {
    const callKey = activeCall?.id || 'active';
    try {
      const saved = localStorage.getItem(`grotec_draft_note_${callKey}`);
      if (saved && !noteDraft) {
        setNoteDraft(saved);
      }
    } catch {}
  }, [activeCall?.id]);

  const handleNoteChange = (val: string) => {
    setNoteDraft(val);
    const callKey = activeCall?.id || 'active';
    try {
      localStorage.setItem(`grotec_draft_note_${callKey}`, val);
    } catch {}
  };

  const loadQueue = async () => {
    try {
      const res = await api.get<QueueItem[]>('/calls/queue');
      setQueue(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setQueueLoading(false);
    }
  };

  const loadActiveCall = async () => {
    try {
      const res = await api.get<Call | null>('/calls/active');
      if (res.data) {
        setActiveCall(res.data);
        const callEnded = res.data.status === 'ENDED' || !isActive(res.data.status);
        setIsWrapUp(callEnded);
        setIsMinimized(false);
        const startTime = res.data.connectedAt
          ? new Date(res.data.connectedAt).getTime()
          : new Date(res.data.startedAt).getTime();
        const endTime = res.data.endedAt ? new Date(res.data.endedAt).getTime() : Date.now();
        const elapsedSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
        setElapsed(elapsedSec);
        void loadContext(res.data.id);
        if (callEnded) {
          setSuccessNotice(`Resumed pending wrap-up for call with ${res.data.phoneNumber}.`);
        } else {
          setSuccessNotice(`Restored active call with ${res.data.phoneNumber}.`);
        }
      }
    } catch {
      /* active call check is best effort */
    }
  };

  useEffect(() => {
    void loadQueue();
    void loadActiveCall();
  }, []);

  // Fetch Knowledge Base guidance records on mount for instant zero-latency mid-call lookup
  useEffect(() => {
    let cancelled = false;
    setKbLoading(true);
    api
      .get<KnowledgeGuidance[]>('/assistant/guidance')
      .then((res) => {
        if (!cancelled) setKbGuidanceList(res.data || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setKbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadContext = async (callId: string) => {
    try {
      const res = await api.get<CallContext>(`/calls/${callId}/context`);
      setContext(res.data);
    } catch {
      /* context refresh is best-effort */
    }
  };

  const refreshCall = async (callId: string) => {
    try {
      const res = await api.get<Call>(`/calls/${callId}`);
      setActiveCall(res.data);
      return res.data;
    } catch {
      return null;
    }
  };

  // Status polling while the call is live
  // Status polling while the call is live (1000ms for fast real-time updates)
  useEffect(() => {
    if (!activeCall || !isActive(activeCall.status)) return;
    const id = window.setInterval(() => {
      void refreshCall(activeCall.id).then((call) => {
        if (!call) return;
        if (!isActive(call.status)) {
          // Call hung up or finished remotely -> transition to wrap-up mode
          setIsWrapUp(true);
          void loadQueue();
        }
        const customerKnown = context?.customer?.id === call.customerId;
        if (call.customerId && !customerKnown) {
          void loadContext(call.id);
        }
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeCall, context]);

  // Elapsed timer while call is actively connected
  useEffect(() => {
    if (!activeCall || !isActive(activeCall.status)) return;
    const interval = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeCall?.status]);

  // Keyboard shortcut: Press 'M' to toggle mute during an active call (when not typing in inputs/textareas)
  useEffect(() => {
    if (!callActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callActive]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Filter Knowledge Base records for instant in-call advisory
  const filteredGuidance = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    return kbGuidanceList.filter((item) => {
      if (kbFilterCrop !== 'ALL') {
        const cropMatch =
          item.crop?.name?.toLowerCase().includes(kbFilterCrop.toLowerCase()) ||
          item.crop?.code?.toLowerCase().includes(kbFilterCrop.toLowerCase());
        if (!cropMatch) return false;
      }
      if (!q) return true;
      const inCrop = item.crop?.name?.toLowerCase().includes(q);
      const inType = item.problemType?.toLowerCase().includes(q);
      const inKeywords = item.problemKeywords?.some((k) => k.toLowerCase().includes(q));
      const inProducts = item.recommendedProducts?.some((p) => p.toLowerCase().includes(q));
      const inUsage = item.usageGuidance?.toLowerCase().includes(q);
      return inCrop || inType || inKeywords || inProducts || inUsage;
    });
  }, [kbGuidanceList, kbQuery, kbFilterCrop]);

  function insertGuidanceIntoNotes(item: KnowledgeGuidance) {
    const advisorySnippet = `\n[Advisory for ${item.crop.name}: Recommend ${item.recommendedProducts.join(', ')}. Usage: ${item.usageGuidance || 'Follow label directions'}]`;
    setNoteDraft((prev) => (prev ? `${prev.trimEnd()}${advisorySnippet}` : advisorySnippet.trim()));
    setSuccessNotice(`Inserted advisory for ${item.crop.name} into call notes.`);
  }

  async function dial(phoneNumber: string, customerId?: string, leadId?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccessNotice(null);
    setLiveTranscript(null);
    telephonyAudio.startRingback();
    try {
      const res = await api.post<Call>('/calls', { phoneNumber, customerId, leadId, mode: callingMode });
      setActiveCall(res.data);
      setIsMuted(false);
      setIsWrapUp(false);
      setIsMinimized(false);
      setContext(null);
      setManualNumber('');
      setElapsed(0);
      setNoteDraft('');
      setDisposition('INTERESTED');
      setNextAction('CALLBACK');
      setFollowUpDate(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
      setFollowUpTime('10:00');
      setFollowUpNote('');
      await loadContext(res.data.id);
    } catch (err: any) {
      telephonyAudio.stopRingback();
      const existingCallId = err?.response?.data?.details?.callId;
      if (existingCallId) {
        const call = await refreshCall(existingCallId);
        if (call) {
          const callEnded = call.status === 'ENDED' || !isActive(call.status);
          setIsWrapUp(callEnded);
          setIsMinimized(false);
          setIsMuted(false);
          const startTime = call.connectedAt ? new Date(call.connectedAt).getTime() : new Date(call.startedAt).getTime();
          const endTime = call.endedAt ? new Date(call.endedAt).getTime() : Date.now();
          setElapsed(Math.max(0, Math.floor((endTime - startTime) / 1000)));
          await loadContext(call.id);
          setError(null);
          setSuccessNotice('Active call detected and restored to your screen.');
          return;
        }
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Hang up call without leaving screen -> transition into wrap-up
  async function endCall() {
    if (!activeCall || busy) return;
    setBusy(true);
    setError(null);
    setIsMuted(false);
    telephonyAudio.playDisconnectChime();
    telephonyAudio.stopAll();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    try {
      const res = await api.post<Call>(`/calls/${activeCall.id}/end`);
      setActiveCall(res.data);
      setIsWrapUp(true);
      void loadQueue();
      void loadContext(activeCall.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Option 1: Save notes, record outcome, and complete session
  async function saveAndCompleteDisposition() {
    if (!activeCall || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Ensure call status is ENDED before recording outcome
      if (isActive(activeCall.status)) {
        await api.post(`/calls/${activeCall.id}/end`).catch(() => undefined);
      }

      // Save note if drafted
      if (noteDraft.trim()) {
        await api.post(`/calls/${activeCall.id}/notes`, { body: noteDraft.trim() }).catch(() => undefined);
      }

      // Record outcome (sales handover removed, direct callback)
      const outcomePayload: any = {
        outcome: disposition,
      };
      if (disposition === 'INTERESTED') {
        outcomePayload.nextAction = 'CALLBACK';
        outcomePayload.followUpDate = followUpDate || new Date().toISOString().slice(0, 10);
        outcomePayload.followUpTime = followUpTime || '10:00';
        outcomePayload.followUpNote =
          followUpNote.trim() || noteDraft.trim() || 'Telecaller follow-up callback';
      }
      await api.post(`/calls/${activeCall.id}/outcome`, outcomePayload);

      const farmerName = farmerDisplayName;
      const outcomeText =
        disposition === 'INTERESTED'
          ? `Interested (Follow-up scheduled on ${followUpDate})`
          : disposition === 'NOT_INTERESTED'
            ? 'Not Interested'
            : 'Not Answered';

      // Dispatch real-time call advisory email via verified Gmail SMTP
      try {
        await messagingApi.sendEmail({
          to: 'grotecdatabase@gmail.com',
          subject: `[GROTEC Real-Time Alert] Call Completed: ${farmerName} (${formatE164(farmerDisplayPhone)}) - ${disposition}`,
          body: `GROTEC FarmerOS Real-Time Telephony Call Advisory Summary\n\n` +
                `Farmer: ${farmerName}\n` +
                `Phone: ${formatE164(farmerDisplayPhone)}\n` +
                `Agent Outbound Line: 9444330285\n` +
                `Talk Time: ${formatTimer(elapsed)}\n` +
                `Disposition: ${disposition}\n` +
                (disposition === 'INTERESTED' ? `Follow-up Date: ${followUpDate} at ${followUpTime}\nFollow-up Note: ${followUpNote || 'Follow-up callback'}\n` : '') +
                `Advisory Notes:\n${noteDraft || 'No notes entered'}\n\n` +
                `Dispatched live via GROTEC FarmerOS SMTP Engine (smtp.gmail.com:465)`,
        });
      } catch (mailErr) {
        console.warn('Real-time SMTP dispatch warning:', mailErr);
      }

      setActiveCall(null);
      setIsWrapUp(false);
      setIsMuted(false);
      setLiveTranscript(null);
      telephonyAudio.stopAll();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setPendingWrapUp(null);
      setNoteDraft('');
      try {
        if (activeCall?.id) localStorage.removeItem(`grotec_draft_note_${activeCall.id}`);
        localStorage.removeItem('grotec_draft_note_active');
      } catch {}
      setSuccessNotice(`Call completed for ${farmerName}! Disposition saved: ${outcomeText}. Real-time alert dispatched to grotecdatabase@gmail.com.`);
      void loadQueue();

      // Progressive auto-advance to next customer in queue if enabled
      if ((autoAdvance || callingMode === 'PROGRESSIVE_DIALER') && nextQueueItem?.customer?.primaryPhone) {
        const nextTarget = nextQueueItem;
        setAutoAdvanceCountdown(3);
        let secondsLeft = 3;
        const countInterval = window.setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft > 0) {
            setAutoAdvanceCountdown(secondsLeft);
          } else {
            window.clearInterval(countInterval);
            setAutoAdvanceCountdown(null);
            void dial(nextTarget.customer.primaryPhone || '', nextTarget.customer.id, nextTarget.leadId);
          }
        }, 1000);
        autoAdvanceTimerRef.current = countInterval;
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Option 2: Wrap up later -> save draft and return to queue
  function wrapUpLater() {
    if (!activeCall) return;
    const item: PendingWrapUpItem = {
      callId: activeCall.id,
      customerId: activeCall.customerId || context?.customer?.id,
      leadId: activeCall.leadId,
      phoneNumber: farmerDisplayPhone,
      farmerName: farmerDisplayName,
      endedAt: new Date().toISOString(),
      durationSeconds: elapsed,
      notes: noteDraft,
      disposition,
      nextAction,
      followUpDate,
      followUpTime,
      followUpNote,
    };
    setPendingWrapUp(item);
    setActiveCall(null);
    setIsWrapUp(false);
    setSuccessNotice(
      `Call draft saved for ${farmerDisplayName}. You can complete follow-up anytime from the card above.`,
    );
  }

  // Resume full workstation from outside card
  function resumePendingWrapUp(item: PendingWrapUpItem) {
    setNoteDraft(item.notes);
    setDisposition(item.disposition);
    setNextAction(item.nextAction);
    setFollowUpDate(item.followUpDate);
    setFollowUpTime(item.followUpTime);
    setFollowUpNote(item.followUpNote);
    setElapsed(item.durationSeconds);
    setActiveCall({
      id: item.callId,
      customerId: item.customerId ?? null,
      leadId: item.leadId ?? null,
      agentId: 'agent-1',
      phoneNumber: item.phoneNumber,
      direction: 'OUTBOUND',
      status: 'ENDED',
      outcome: null,
      nextAction: null,
      provider: 'MOCK_DIALER',
      providerCallId: item.callId,
      connectedAt: item.endedAt,
      startedAt: item.endedAt,
      endedAt: item.endedAt,
      disconnectReason: null,
      createdAt: item.endedAt,
      updatedAt: item.endedAt,
      notes: [],
    });
    setIsWrapUp(true);
    setPendingWrapUp(null);
    setError(null);
    setSuccessNotice(null);
    void loadContext(item.callId);
  }

  // Quick submit directly from outside card
  async function submitQuickDisposition(item: PendingWrapUpItem) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (item.notes.trim()) {
        await api.post(`/calls/${item.callId}/notes`, { body: item.notes.trim() }).catch(() => undefined);
      }
      const outcomePayload: any = {
        outcome: item.disposition,
      };
      if (item.disposition === 'INTERESTED') {
        outcomePayload.nextAction = item.nextAction;
        if (item.nextAction === 'CALLBACK') {
          outcomePayload.followUpDate = item.followUpDate || new Date().toISOString().slice(0, 10);
          outcomePayload.followUpTime = item.followUpTime || '10:00';
          outcomePayload.followUpNote =
            item.followUpNote.trim() || item.notes.trim() || 'Follow-up callback';
        }
      }
      await api.post(`/calls/${item.callId}/outcome`, outcomePayload);
      setPendingWrapUp(null);
      setSuccessNotice(
        `Follow-up recorded for ${item.farmerName}: ${item.disposition === 'INTERESTED' ? `Interested (Follow-up: ${item.followUpDate})` : item.disposition}.`,
      );
      void loadQueue();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Launch wrap-up for a queue item that ended without outcome
  function launchWrapUpForQueueItem(item: QueueItem) {
    if (!item.lastCall) return;
    setElapsed(180);
    setNoteDraft(item.notes || '');
    setDisposition('INTERESTED');
    setNextAction('CALLBACK');
    setFollowUpDate(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
    setFollowUpTime('10:00');
    setFollowUpNote('');
    setActiveCall({
      id: item.lastCall.id,
      customerId: item.customer.id,
      leadId: item.leadId,
      agentId: 'agent-1',
      phoneNumber: item.lastCall.phoneNumber,
      direction: 'OUTBOUND',
      status: 'ENDED',
      outcome: null,
      nextAction: null,
      provider: 'MOCK_DIALER',
      providerCallId: item.lastCall.id,
      connectedAt: item.lastCall.startedAt,
      startedAt: item.lastCall.startedAt,
      endedAt: item.lastCall.endedAt,
      disconnectReason: item.lastCall.disconnectReason,
      createdAt: item.lastCall.startedAt,
      updatedAt: item.lastCall.endedAt || item.lastCall.startedAt,
      notes: [],
    });
    setIsWrapUp(true);
    setPendingWrapUp(null);
    setError(null);
    setSuccessNotice(null);
    void loadContext(item.lastCall.id);
  }

  const filteredQueue = useMemo(() => {
    const list = queue.filter((item) => {
      if (queueCategory === 'EXISTING') {
        return Boolean(item.customer && item.customer.farmerCode);
      }
      if (queueCategory === 'LEADS') {
        return Boolean(item.leadId);
      }
      if (queueCategory === 'NEW') {
        return !item.lastCall;
      }
      return true;
    });

    // Priority ordering: items with pending wrap-ups or scheduled follow-ups first, then newest
    return [...list].sort((a, b) => {
      const aPending = a.lastCall?.status === 'ENDED' && !a.lastCall?.outcome ? 1 : 0;
      const bPending = b.lastCall?.status === 'ENDED' && !b.lastCall?.outcome ? 1 : 0;
      return bPending - aPending;
    });
  }, [queue, queueCategory]);

  const nextQueueItem = useMemo(() => {
    if (filteredQueue.length === 0) return null;
    const nextIdx = (queueIndex + 1) % filteredQueue.length;
    return filteredQueue[nextIdx] || null;
  }, [filteredQueue, queueIndex]);

  const handleSkipNext = () => {
    if (filteredQueue.length > 1) {
      setQueueIndex((prev) => (prev + 1) % filteredQueue.length);
    }
  };

  const matchedQueueItem = useMemo(() => {
    if (!activeCall) return null;
    return queue.find(
      (q) =>
        (activeCall.leadId && q.leadId === activeCall.leadId) ||
        (activeCall.customerId && q.customer.id === activeCall.customerId) ||
        (activeCall.phoneNumber && q.customer.primaryPhone === activeCall.phoneNumber),
    );
  }, [queue, activeCall]);

  const farmerDisplayName =
    context?.customer?.fullName ||
    matchedQueueItem?.customer?.fullName ||
    queryName ||
    activeCall?.phoneNumber ||
    'Farmer Contact';
  const farmerDisplayPhone =
    activeCall?.phoneNumber || matchedQueueItem?.customer?.primaryPhone || queryPhone || '';

  async function handleSendAdvisory(channel: 'whatsapp' | 'sms') {
    const targetPhone = farmerDisplayPhone;
    if (!targetPhone) {
      setError('No farmer phone number available to dispatch message.');
      return;
    }
    const messageBody =
      noteDraft.trim() ||
      `Hello from GROTEC FarmerOS. Thank you for speaking with our agronomy team today! For any bio-fertilizer queries, feel free to contact us anytime.`;
    setSendingMessage(channel);
    setError(null);
    try {
      if (channel === 'whatsapp') {
        await messagingApi.sendWhatsApp({
          to: targetPhone,
          body: messageBody,
          customerId: context?.customer?.id || activeCall?.customerId || matchedQueueItem?.customer?.id || undefined,
          entityType: 'CALL',
          entityId: activeCall?.id,
        });
        setSuccessNotice(`WhatsApp advisory message dispatched to ${formatE164(targetPhone)}.`);
      } else {
        await messagingApi.sendSms({
          to: targetPhone,
          body: messageBody,
          customerId: context?.customer?.id || activeCall?.customerId || matchedQueueItem?.customer?.id || undefined,
          entityType: 'CALL',
          entityId: activeCall?.id,
        });
        setSuccessNotice(`SMS advisory dispatched to ${formatE164(targetPhone)} via Exotel.`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSendingMessage(null);
    }
  }

  // Farmer context for the calling panel. Everything below is read from the
  // CallContext payload already fetched for this call (GET /calls/:id/context),
  // which returns the same CustomerDetail shape the Farmers page renders — one
  // canonical customer source, no second API and no invented values.
  const farmerLocation = useMemo(() => {
    const loc = context?.customer?.locations?.[0];
    if (!loc) return '';
    return [loc.village, loc.taluk, loc.district, loc.state].filter(Boolean).join(', ');
  }, [context]);

  const farmerCrops = useMemo(() => {
    const fromContext = context?.customer?.crops ?? [];
    if (fromContext.length > 0) {
      return fromContext.map((c) => `${c.crop.name} (${c.acreage} ${c.unit})`).join(', ');
    }
    const fromQueue = matchedQueueItem?.customer?.crops ?? [];
    if (fromQueue.length > 0) {
      return fromQueue.map((c) => `${c.crop.name} (${c.acreage} ${c.unit})`).join(', ');
    }
    return '';
  }, [context, matchedQueueItem]);

  const otherPhoneCount = Math.max((context?.customer?.phones?.length ?? 0) - 1, 0);
  const farmerLead =
    context?.customer?.leads?.find((lead) => lead.status === 'OPEN') ?? context?.customer?.leads?.[0] ?? null;
  const farmerRequirement = farmerLead?.notes || matchedQueueItem?.notes || '';
  const farmerLeadSource = farmerLead?.source || matchedQueueItem?.source || '';
  const lastContactCall = context?.history?.[0] ?? null;
  const pendingFollowUp = context?.followUps?.find((f) => f.status === 'PENDING') ?? null;

  // Real-time acoustic telephony state management & speech synthesis
  useEffect(() => {
    const status = activeCall?.status;
    const prevStatus = prevCallStatusRef.current;

    if (status === 'DIALING' || status === 'RINGING') {
      telephonyAudio.startRingback();
    } else if (status === 'CONNECTED') {
      telephonyAudio.stopRingback();
      if (prevStatus !== 'CONNECTED') {
        telephonyAudio.playConnectChime();
        telephonyAudio.speakFarmerGreeting(
          farmerDisplayName,
          farmerLocation,
          farmerCrops,
          (text) => setLiveTranscript(text),
        );
      }
    } else if (!isActive(status)) {
      telephonyAudio.stopRingback();
      if (prevStatus && ACTIVE_STATUSES.includes(prevStatus)) {
        telephonyAudio.playDisconnectChime();
      }
    }

    prevCallStatusRef.current = status || null;
  }, [activeCall?.status, farmerDisplayName, farmerLocation, farmerCrops]);

  // Clean up telephony audio on component unmount
  useEffect(() => {
    return () => {
      telephonyAudio.stopAll();
    };
  }, []);

  // ---------------------------------------------------------------- farmer edit
  // Agent Mode reads the farmer through detailForCallContext(), which deliberately
  // skips agent visibility scoping so any dialled number can show its match. That
  // means holding customer.update is NOT sufficient to edit THIS farmer.
  // GET /customers/:id runs the same CustomersService.scopedCustomer() check that
  // PATCH /customers/:id runs, so a successful read is an exact probe for
  // "this agent may mutate this record" — without weakening the server scope.
  const canUpdateCustomers = hasPermission('customer.update');
  const editableCustomerId = context?.customer?.id ?? null;
  const [scopedReadOk, setScopedReadOk] = useState(false);
  const customerEditable = canEditFarmerRecord(canUpdateCustomers, scopedReadOk);
  const [farmerEditing, setFarmerEditing] = useState(false);
  const [farmerNameDraft, setFarmerNameDraft] = useState('');
  const [farmerSoilDraft, setFarmerSoilDraft] = useState('');
  const [farmerSaving, setFarmerSaving] = useState(false);
  const [farmerEditError, setFarmerEditError] = useState<string | null>(null);

  useEffect(() => {
    setFarmerEditing(false);
    setFarmerEditError(null);
    if (!editableCustomerId || !canUpdateCustomers) {
      setScopedReadOk(false);
      return;
    }
    let cancelled = false;
    api
      .get(`/customers/${editableCustomerId}`)
      .then(() => {
        if (!cancelled) setScopedReadOk(true);
      })
      .catch(() => {
        if (!cancelled) setScopedReadOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editableCustomerId, canUpdateCustomers]);

  function startFarmerEdit() {
    setFarmerNameDraft(context?.customer?.fullName ?? '');
    setFarmerSoilDraft(context?.customer?.soilType ?? '');
    setFarmerEditError(null);
    setFarmerEditing(true);
  }

  // Cancel restores the persisted values and issues no request.
  function cancelFarmerEdit() {
    setFarmerNameDraft(context?.customer?.fullName ?? '');
    setFarmerSoilDraft(context?.customer?.soilType ?? '');
    setFarmerEditError(null);
    setFarmerEditing(false);
  }

  async function saveFarmerEdit() {
    if (!editableCustomerId) return;
    setFarmerSaving(true);
    setFarmerEditError(null);
    try {
      // Same endpoint and contract the Farmers page uses. A blank soil type sends
      // null, which the backend treats as "clear"; no other field is sent, and the
      // response is the freshly scoped record, so the panel updates from the server.
      const res = await api.patch<CustomerDetail>(
        `/customers/${editableCustomerId}`,
        buildFarmerUpdatePayload(farmerNameDraft, farmerSoilDraft),
      );
      setContext((prev) => (prev ? { ...prev, customer: res.data } : prev));
      setFarmerEditing(false);
    } catch (err) {
      setFarmerEditError(errorMessage(err));
    } finally {
      setFarmerSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header: Breadcrumb, Agent Mode Status, Category Directory */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Agent Calling
          </span>
          <div className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>GROTEC Agrotech</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800">Calling Mode:</span>
            <div className="relative inline-flex items-center">
              <select
                aria-label="Agent Calling Mode"
                value={callingMode}
                onChange={(e) => setAgentCallingMode(e.target.value as AgentCallingMode)}
                className={cx(
                  'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 transition',
                  CALLING_MODES.find((m) => m.id === callingMode)?.color || 'bg-emerald-50 text-emerald-800 border-emerald-200'
                )}
              >
                {CALLING_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {callingMode === 'EXOTEL_IVR_AGENT' && (
                <span className="ml-1.5 flex h-2 w-2 relative" title="Exotel IVRS cum Agent active">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800">Auto-Advance:</span>
            <button
              type="button"
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={cx(
                'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer border transition shadow-2xs',
                autoAdvance
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/50'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
              )}
              title="Automatically queue next call with 3s wrap-up pause upon saving outcome"
            >
              {autoAdvance ? 'ON (3s Pause)' : 'OFF'}
            </button>
          </div>
          {matchedQueueItem && (
            <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px] font-semibold">
              {matchedQueueItem.leadId ? 'Lead Pipeline' : 'Existing Customer'}
            </span>
          )}
          <span className="text-slate-400 font-mono text-[11px]">
            Queue: {filteredQueue.length > 0 ? `#${queueIndex + 1} of ${filteredQueue.length}` : '0 items'}
          </span>
        </div>

        {/* Category Directory Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          {(['ALL', 'EXISTING', 'LEADS', 'NEW'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setQueueCategory(cat);
                setQueueIndex(0);
              }}
              className={cx(
                'px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer',
                queueCategory === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {cat === 'ALL' ? 'All' : cat === 'EXISTING' ? 'Existing' : cat === 'LEADS' ? 'Prev. Leads' : 'New Data'}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Advance Countdown Banner */}
      {autoAdvanceCountdown !== null && nextQueueItem && (
        <div className="rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-5 py-3 shadow-md flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-white animate-ping shrink-0"></span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">
                Auto-Advancing to next farmer in {autoAdvanceCountdown}s...
              </p>
              <p className="text-[11px] text-amber-100">
                Up Next: <span className="font-bold">{nextQueueItem.customer.fullName}</span> ({formatE164(nextQueueItem.customer.primaryPhone || '')})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancelAutoAdvance}
            className="px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Cancel Auto-Advance
          </button>
        </div>
      )}

      {/* Up Next Preview Area */}
      {nextQueueItem && (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Up Next:</span>
            <span className="font-bold text-slate-900 truncate">{nextQueueItem.customer.fullName}</span>
            <span className="text-slate-500 font-mono hidden sm:inline">
              {nextQueueItem.customer.primaryPhone ? formatE164(nextQueueItem.customer.primaryPhone) : 'No phone'}
            </span>
            <span className="text-[10px] rounded bg-slate-200/80 px-1.5 py-0.2 text-slate-600 shrink-0 font-medium">
              {nextQueueItem.leadId ? 'Lead' : 'Existing Farmer'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSkipNext}
              className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded hover:bg-slate-200/60 transition cursor-pointer text-xs"
            >
              Skip / Next &rarr;
            </button>
            <Button
              size="xs"
              variant="call"
              onClick={() => dial(nextQueueItem.customer.primaryPhone || '', nextQueueItem.customer.id, nextQueueItem.leadId)}
            >
              <Phone className="h-3 w-3 fill-current" /> Call Next
            </Button>
          </div>
        </div>
      )}

      {/* 1. Notifications */}
      {successNotice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error ? (
        <div className="space-y-2">
          <Alert tone="error">{error}</Alert>
          {error.toLowerCase().includes('active call') && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center justify-between">
              <span className="text-xs text-red-800 font-medium">An active call is already running on this workspace.</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void loadActiveCall()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
              >
                <PhoneCall className="h-3.5 w-3.5 mr-1" /> Resume Active Call Now
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* 2. Top Banner: Active Call (Dialing/Ringing vs Connected) OR Wrap-Up Amber */}
      {callActive && (
        <div
          className={cx(
            'rounded-xl text-white px-5 py-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 border transition-all duration-300',
            activeCall?.status === 'CONNECTED'
              ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 border-emerald-600/50'
              : 'bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 border-blue-500/50',
          )}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {activeCall?.status === 'CONNECTED' ? (
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shrink-0 ring-4 ring-emerald-400/30"></span>
                {/* Real-time Acoustic Audio Equalizer Waveform */}
                <div className="flex items-center gap-1 h-5 px-1 bg-black/20 rounded border border-emerald-400/30" title="Live audio waveform active">
                  <span className="w-1 bg-emerald-300 rounded-full animate-audio-bar-1"></span>
                  <span className="w-1 bg-emerald-200 rounded-full animate-audio-bar-2"></span>
                  <span className="w-1 bg-emerald-400 rounded-full animate-audio-bar-3"></span>
                  <span className="w-1 bg-emerald-200 rounded-full animate-audio-bar-4"></span>
                  <span className="w-1 bg-emerald-300 rounded-full animate-audio-bar-5"></span>
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-100">
                  LIVE 2-WAY AUDIO CONNECTED
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-300 animate-ping shrink-0"></span>
                <span className="text-xs font-black uppercase tracking-wider text-blue-100">
                  {activeCall?.status === 'RINGING' ? 'TELECOM RINGING' : 'OUTBOUND DIALING'}
                </span>
                <span className="text-[10px] bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded border border-blue-400/30">
                  Acoustic Ringback Tone Active
                </span>
              </div>
            )}
            <span className="text-emerald-300/60 hidden sm:inline">|</span>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-slate-200">
                Agent <span className="font-mono text-white font-bold">9444330285</span> ➔ Farmer <span className="font-bold text-white">{farmerDisplayName}</span> (<span className="font-mono text-emerald-200">{formatE164(farmerDisplayPhone)}</span>)
              </span>
            </div>
            {isMuted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider animate-pulse shadow-xs">
                <MicOff className="h-3.5 w-3.5" /> Mic Muted
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              className={cx(
                'rounded-lg px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs',
                isMuted
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-300 font-extrabold ring-2 ring-amber-300/60'
                  : 'bg-black/25 hover:bg-black/40 text-white border border-white/20',
              )}
              title={isMuted ? 'Microphone is MUTED (Press M to Unmute)' : 'Microphone is LIVE (Press M to Mute)'}
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5 text-amber-950" /> : <Mic className="h-3.5 w-3.5 text-emerald-200" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
              <kbd className={cx('text-[10px] px-1 py-0.2 rounded font-mono font-normal opacity-80', isMuted ? 'bg-amber-500/40 text-amber-950' : 'bg-black/20 text-emerald-100')}>M</kbd>
            </button>
            <div className="bg-black/30 border border-white/20 px-3 py-1.5 rounded-lg font-mono text-xs font-bold tracking-widest text-white shadow-xs">
              {formatTimer(elapsed)}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void endCall()}
              className="rounded-lg bg-red-600 hover:bg-red-700 border border-red-400/50 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Hang up active call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>End Call</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded-lg bg-black/20 hover:bg-black/30 border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
              title="Minimize workstation to view call queue"
            >
              Minimize
            </button>
          </div>
        </div>
      )}

      {/* Live Farmer Speech Audio Channel Card */}
      {callActive && liveTranscript && (
        <div className="rounded-xl bg-slate-900 text-white p-4 border border-slate-700/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5 ring-1 ring-emerald-500/40">
              <Volume2 className="h-5 w-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Farmer Audio Channel (Live Speech Feed)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-medium">
                  {farmerLocation || 'Papanasam, Thanjavur'}
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
                  {farmerCrops || 'Rice (Paddy)'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed italic">
                &ldquo;{liveTranscript}&rdquo;
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() =>
                telephonyAudio.speakFarmerGreeting(
                  farmerDisplayName,
                  farmerLocation,
                  farmerCrops,
                  (text) => setLiveTranscript(text),
                )
              }
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Replay farmer voice in headset"
            >
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Replay Voice</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const snippet = `\n[Farmer Inquiry: ${liveTranscript}]`;
                setNoteDraft((prev) => (prev ? `${prev.trimEnd()}${snippet}` : snippet.trim()));
                setSuccessNotice('Copied farmer audio inquiry directly into call notes.');
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Copy inquiry to call notes"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Insert in Notes</span>
            </button>
          </div>
        </div>
      )}

      {isWrapUp && (
        <div className="rounded-lg bg-amber-500 text-white px-5 py-3 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-wider">
              CALL COMPLETED — PENDING DISPOSITION &amp; FOLLOW-UP
            </span>
            <span className="text-amber-200">|</span>
            <span className="text-xs font-bold">
              {farmerDisplayName} ({formatE164(farmerDisplayPhone)})
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-600/90 border border-amber-400/40 px-3 py-1 rounded font-mono text-xs font-bold tracking-widest text-white shadow-xs">
              TALK TIME: {formatTimer(elapsed)}
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded bg-amber-600/80 hover:bg-amber-700 border border-amber-300/50 px-2.5 py-1 text-xs font-semibold text-white transition cursor-pointer"
              title="Minimize wrap-up to view call queue"
            >
              Minimize / View Queue
            </button>
          </div>
        </div>
      )}

      {/* 3. Two-column Call Workstation Screen (Active Call OR Post-Call Wrap-Up) */}
      {showWorkstation ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Farm Profile & In-Call Knowledge Base Search (~40% width) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Tab selector for Profile vs Knowledge Base */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setLeftColumnTab('profile')}
                className={cx(
                  'flex-1 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5',
                  leftColumnTab === 'profile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <Sprout className="h-3.5 w-3.5 text-emerald-700" /> Farm Profile
              </button>
              <button
                type="button"
                onClick={() => setLeftColumnTab('kb')}
                className={cx(
                  'flex-1 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5',
                  leftColumnTab === 'kb'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <BookOpen className="h-3.5 w-3.5 text-emerald-700" /> Knowledge Base
                {filteredGuidance.length > 0 && (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 font-bold">
                    {filteredGuidance.length}
                  </span>
                )}
              </button>
            </div>

            {leftColumnTab === 'profile' ? (
              <Card className="p-4 shadow-xs space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Farmer &amp; Agricultural Record
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        {context?.customer?.farmerCode || matchedQueueItem?.customer?.farmerCode || 'FARM-REF'}
                      </span>
                      {context?.customer ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={openExistingFarmerModal}
                          className="h-6 px-1.5 text-[10px] text-slate-700"
                          title="Switch or link to another existing farmer"
                        >
                          <Users className="h-3 w-3" /> Switch Farmer
                        </Button>
                      ) : null}
                      {customerEditable && !farmerEditing ? (
                        <button
                          type="button"
                          onClick={startFarmerEdit}
                          className="text-[11px] font-semibold text-brand-600 hover:underline"
                        >
                          Edit Profile
                        </button>
                      ) : null}
                      {editableCustomerId ? (
                        <Link
                          to={`/customers/${editableCustomerId}`}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                          title="Phones, locations and crops are managed on the full farmer profile"
                        >
                          Full Profile
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {/* If farmer is NOT present on this call, show notice and quick actions to add or link */}
                  {!context?.customer ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-900">No Farmer Record Linked to This Call</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Number <span className="font-mono font-bold">{farmerDisplayPhone || 'unknown'}</span> is unmapped. Register a new farmer or link to an existing profile below.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() => setShowAddFarmerModal(true)}
                        >
                          <UserPlus className="h-3.5 w-3.5" /> + Add New Farmer
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={openExistingFarmerModal}
                          className="bg-white hover:bg-slate-50 text-slate-800 font-medium border-slate-300"
                        >
                          <Search className="h-3.5 w-3.5" /> 🔍 Add to Existing Farmer
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* Farmer Details */}
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Farmer Name</p>
                      {farmerEditing ? (
                        <Input
                          value={farmerNameDraft}
                          onChange={(e) => setFarmerNameDraft(e.target.value)}
                          aria-label="Farmer name"
                          disabled={farmerSaving}
                          className="mt-0.5"
                          autoFocus
                        />
                      ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="font-bold text-slate-900 text-sm">{farmerDisplayName}</p>
                        {context?.customer ? (
                          <span
                            className={cx(
                              'inline-flex items-center rounded-full border px-1.5 py-0.2 text-[10px] font-bold',
                              context.customer.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200',
                            )}
                          >
                            {context.customer.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        ) : null}
                      </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Phone</p>
                        <p className="font-mono font-semibold text-slate-800 mt-0.5">
                          {farmerDisplayPhone ? formatE164(farmerDisplayPhone) : 'Not recorded'}
                        </p>
                        {otherPhoneCount > 0 ? (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            +{otherPhoneCount} more on file
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Category</p>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {context?.customer ? 'Existing Farmer' : 'Lead Pipeline'}
                        </p>
                        {farmerLeadSource ? (
                          <p className="text-[10px] text-slate-500 mt-0.5">Source: {farmerLeadSource}</p>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Location</p>
                      <p className="font-medium text-slate-700 mt-0.5">
                        {farmerLocation || 'Not recorded'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Crops &amp; Acreage</p>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {farmerCrops || 'Not recorded'}
                      </p>
                    </div>

                    {farmerEditing ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Soil Classification</p>
                        <Input
                          value={farmerSoilDraft}
                          onChange={(e) => setFarmerSoilDraft(e.target.value)}
                          maxLength={SOIL_TYPE_MAX_LENGTH}
                          placeholder="e.g. Red loam"
                          aria-label="Soil type"
                          disabled={farmerSaving}
                          className="mt-0.5"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">Leave empty to clear.</p>
                      </div>
                    ) : context?.customer?.soilType ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Soil Classification</p>
                        <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200 mt-0.5">
                          {context.customer.soilType}
                        </span>
                      </div>
                    ) : null}

                    {farmerEditing ? (
                      <div className="border-t border-slate-100 pt-2.5">
                        {farmerEditError ? (
                          <p className="mb-1.5 text-[11px] text-red-600">{farmerEditError}</p>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            onClick={() => void saveFarmerEdit()}
                            disabled={farmerSaving || farmerNameDraft.trim().length < 2}
                          >
                            {farmerSaving ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="xs" variant="ghost" onClick={cancelFarmerEdit} disabled={farmerSaving}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {farmerEditing && context?.customer ? (
                      <FarmerQuickEdit
                        customer={context.customer}
                        onSaved={(updated) =>
                          setContext((prev) => (prev ? { ...prev, customer: updated } : prev))
                        }
                      />
                    ) : null}

                    {farmerRequirement ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Requirement / Lead Note</p>
                        <p className="font-medium text-slate-700 mt-0.5 leading-relaxed">{farmerRequirement}</p>
                      </div>
                    ) : null}
                  </div>

                  {/* Sub-card: engagement summary from the farmer's real call record */}
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/60 p-3 rounded-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Engagement Summary
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 shrink-0">Last contact:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {lastContactCall
                            ? `${formatDate(lastContactCall.startedAt)}${lastContactCall.outcome ? ` • ${lastContactCall.outcome}` : ''}`
                            : 'No previous call'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 shrink-0">Calls on record:</span>
                        <span className="font-medium text-slate-700">{context?.history?.length ?? 0}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 shrink-0">Pending follow-up:</span>
                        <span className="font-medium text-slate-700 text-right">
                          {pendingFollowUp ? formatDate(pendingFollowUp.dueAt) : 'None scheduled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick In-Call KB Teaser */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-[11px] flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
                      Mid-Call Agronomy Advisory
                    </span>
                    <button
                      type="button"
                      onClick={() => setLeftColumnTab('kb')}
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Open Search →
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Search crop diseases, nutrient deficiencies, and dosage guidance live while on the phone with the farmer.
                  </p>
                </div>
              </Card>
            ) : (
              /* Knowledge Base Search & Advisory Panel */
              <Card className="p-4 shadow-xs space-y-3.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-emerald-700" />
                      Knowledge Base Advisory
                    </h2>
                    <span className="text-[10px] text-slate-400 font-medium">Mid-Call Lookup</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Search instant advisory for farmer questions and insert into notes with 1 click
                  </p>
                </div>

                {/* Live Search Input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={kbQuery}
                    onChange={(e) => setKbQuery(e.target.value)}
                    placeholder="Search problem, pest, nutrient, or product..."
                    className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                  {kbQuery && (
                    <button
                      type="button"
                      onClick={() => setKbQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Crop Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setKbFilterCrop('ALL')}
                    className={cx(
                      'px-2 py-0.5 rounded font-bold transition',
                      kbFilterCrop === 'ALL'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    All Crops
                  </button>
                  <button
                    type="button"
                    onClick={() => setKbFilterCrop('Rice')}
                    className={cx(
                      'px-2 py-0.5 rounded font-bold transition',
                      kbFilterCrop === 'Rice'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100',
                    )}
                  >
                    🌾 Paddy (Rice)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKbFilterCrop('Sugarcane')}
                    className={cx(
                      'px-2 py-0.5 rounded font-bold transition',
                      kbFilterCrop === 'Sugarcane'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100',
                    )}
                  >
                    🎋 Sugarcane
                  </button>
                  <button
                    type="button"
                    onClick={() => setKbFilterCrop('Tomato')}
                    className={cx(
                      'px-2 py-0.5 rounded font-bold transition',
                      kbFilterCrop === 'Tomato'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    🍅 Tomato
                  </button>
                </div>

                {/* Advisory Guidance Cards List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100">
                  {kbLoading ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading guidance...</div>
                  ) : filteredGuidance.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No matching agronomy guidance found for &ldquo;{kbQuery}&rdquo;.
                    </div>
                  ) : (
                    filteredGuidance.map((item) => (
                      <div key={item.id} className="pt-2.5 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {item.crop?.name}
                          </span>
                          <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {item.problemType?.replace('_', ' ') || 'General'}
                          </span>
                        </div>

                        {/* Keywords */}
                        {item.problemKeywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.problemKeywords.map((kw) => (
                              <span
                                key={kw}
                                className="rounded bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 text-[10px] font-medium"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Recommended Products */}
                        <div className="text-xs">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Recommended: </span>
                          <span className="font-bold text-emerald-800">
                            {item.recommendedProducts.join(', ')}
                          </span>
                        </div>

                        {/* Usage Guidance Note */}
                        {item.usageGuidance && (
                          <p className="rounded bg-slate-50 p-2 text-[11px] text-slate-700 leading-relaxed border border-slate-100">
                            {item.usageGuidance}
                          </p>
                        )}

                        {/* 1-Click Action Buttons for Telecaller */}
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => insertGuidanceIntoNotes(item)}
                            className="rounded px-2.5 py-1 text-[10px] font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-xs flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Insert in Notes
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Call Notes, Disposition & Recommendations (~60% width) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5 shadow-xs space-y-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Call Notes &amp; Session Disposition
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">
                  {isWrapUp
                    ? 'FINALIZE CALL NOTES & SELECT DISPOSITION TO COMPLETE'
                    : 'TYPE NOTES DURING CALL'}
                </p>
              </div>

              {/* In-Call Microphone Muted Notice */}
              {isMuted && callActive && (
                <div className="rounded-lg bg-amber-50 border-2 border-amber-400/80 p-3 flex items-center justify-between gap-3 shadow-xs animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-full bg-amber-500 text-white shrink-0">
                      <MicOff className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-950">Your microphone is currently muted</p>
                      <p className="text-[11px] text-amber-800">
                        The farmer cannot hear you. You can take notes or consult the Knowledge Base in private.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleMute}
                    className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600 font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                  >
                    <Mic className="h-3.5 w-3.5 mr-1" /> Unmute (Press M)
                  </Button>
                </div>
              )}

              {/* Notes Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>{isWrapUp ? 'Call Advisory Notes (Final)' : 'Live Advisory Notes'}</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Draft saved locally
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={noteDraft}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Record crop status, farmer inquiries, pest observations, and recommended Grotec organic solutions..."
                  className="w-full rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none leading-relaxed"
                />

                {/* Instant Farmer Messaging Triggers */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[10px] font-medium text-slate-500">
                    Dispatch advisory directly:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!farmerDisplayPhone || sendingMessage !== null}
                      onClick={() => handleSendAdvisory('whatsapp')}
                      title={farmerDisplayPhone ? `Send notes to ${formatE164(farmerDisplayPhone)} via WhatsApp` : 'No phone number'}
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {sendingMessage === 'whatsapp' ? 'Sending WhatsApp...' : 'Send WhatsApp'}
                    </button>
                    <button
                      type="button"
                      disabled={!farmerDisplayPhone || sendingMessage !== null}
                      onClick={() => handleSendAdvisory('sms')}
                      title={farmerDisplayPhone ? `Send notes to ${formatE164(farmerDisplayPhone)} via Exotel SMS` : 'No phone number'}
                      className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <Smartphone className="h-3 w-3" />
                      {sendingMessage === 'sms' ? 'Sending SMS...' : 'Send SMS'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Disposition Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Call Disposition
                </label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value as any)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none"
                >
                  <option value="INTERESTED">Interested (Schedule Follow-Up)</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="NOT_ANSWERED">Not Answered / Callback Needed</option>
                </select>
              </div>

              {/* Interested Next Action Sub-Panel (Sales Handover removed, direct Callback) */}
              {disposition === 'INTERESTED' && (
                <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Schedule Callback Follow-Up
                    </label>
                    <span className="text-[10px] text-emerald-700 font-medium">Finalize Discussion • Callback</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Follow-Up Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Follow-Up Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Reason / Specifics
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Discuss bio-fertilizer trial quote"
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Remarks & Call History Section */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Previous Remarks &amp; History
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {context?.history?.length || 0} past call(s)
                  </span>
                </div>

                {context?.history && context.history.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {context.history.slice(0, 4).map((histCall) => (
                      <div key={histCall.id} className="rounded-lg bg-slate-50 border border-slate-200/70 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-500">
                            {formatDate(histCall.startedAt)}
                          </span>
                          <span className="rounded px-1.5 py-0.2 text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                            {histCall.outcome || histCall.status}
                          </span>
                        </div>
                        {histCall.notes?.length > 0 ? (
                          <p className="text-[11px] text-slate-700 italic">
                            &ldquo;{histCall.notes[histCall.notes.length - 1]?.body}&rdquo;
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No notes recorded</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-3 text-center text-slate-400 text-xs">
                    No previous remarks recorded for this farmer contact.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {isWrapUp ? (
                  <>
                    <Button
                      variant="outline"
                      size="md"
                      disabled={busy}
                      onClick={wrapUpLater}
                      className="text-slate-600 border-slate-300 hover:bg-slate-50 font-semibold"
                    >
                      <Clock className="h-4 w-4" /> Wrap Up Later / Back to Queue
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={busy}
                      onClick={() => void saveAndCompleteDisposition()}
                      className="px-5 py-2 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Save &amp; Complete Follow-Up
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={toggleMute}
                        className={cx(
                          'font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer',
                          isMuted
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 ring-offset-1 animate-pulse'
                            : 'text-slate-700 border-slate-300 hover:bg-slate-100',
                        )}
                        title={isMuted ? 'Microphone is MUTED — click or press M to speak' : 'Mute microphone — click or press M'}
                      >
                        {isMuted ? (
                          <>
                            <MicOff className="h-4 w-4 text-white" />
                            <span>Unmute Mic</span>
                            <span className="bg-amber-700/60 text-[10px] text-amber-100 px-1.5 py-0.5 rounded font-mono">MUTED</span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 text-slate-500" />
                            <span>Mute Mic</span>
                            <span className="bg-slate-100 text-[10px] text-slate-500 px-1.5 py-0.5 rounded font-mono">Hotkey: M</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        disabled={busy}
                        onClick={() => void endCall()}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 font-semibold"
                      >
                        <PhoneOff className="h-4 w-4" /> End Call Only
                      </Button>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      loading={busy}
                      onClick={() => void saveAndCompleteDisposition()}
                      className="px-5 py-2 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Save &amp; End Session
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* 4. Outside View: Telecaller Call Queue & Quick Dialer */
        <div className="space-y-5">
          {/* Active Call In Progress Card (visible when workstation is minimized or returning to queue) */}
          {callActive && (
            <div className="rounded-lg border-2 border-red-500 bg-red-50/95 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full bg-red-600 animate-ping shrink-0"></span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-red-700">
                      Active Call in Progress
                    </span>
                    <Badge tone="red">LIVE</Badge>
                    {isMuted && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-400 text-amber-950 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        <MicOff className="h-3 w-3" /> Muted
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-red-900 bg-red-100 border border-red-200 px-2 py-0.5 rounded">
                      {formatTimer(elapsed)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {farmerDisplayName} &bull; <span className="font-mono text-slate-600">{formatE164(farmerDisplayPhone)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleMute}
                  className={cx(
                    'font-bold flex items-center gap-1.5 cursor-pointer',
                    isMuted
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
                      : 'text-slate-700 border-slate-300 hover:bg-white',
                  )}
                  title={isMuted ? 'Unmute microphone (Hotkey: M)' : 'Mute microphone (Hotkey: M)'}
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsMinimized(false)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs"
                >
                  <PhoneCall className="h-3.5 w-3.5" /> Return to Active Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void endCall()}
                  className="text-red-700 border-red-300 hover:bg-red-100 font-bold"
                >
                  <PhoneOff className="h-3.5 w-3.5" /> End Call
                </Button>
              </div>
            </div>
          )}

          {/* Pending Wrap-Up without saved draft Card */}
          {isWrapUp && !pendingWrapUp && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50/95 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                      Call Ended — Pending Wrap-Up
                    </span>
                    <Badge tone="amber">Action Required</Badge>
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {farmerDisplayName} &bull; <span className="font-mono text-slate-600">{formatE164(farmerDisplayPhone)}</span> &bull; Talk Time: {formatTimer(elapsed)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsMinimized(false)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
                >
                  <FileEdit className="h-3.5 w-3.5" /> Complete Wrap-Up &amp; Disposition
                </Button>
              </div>
            </div>
          )}

          {/* A. Outside In-Progress / Pending Wrap-Up Card */}
          {pendingWrapUp && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50/90 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-sm shadow-xs">
                    !
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Pending Call Wrap-Up: {pendingWrapUp.farmerName}
                      </h3>
                      <Badge tone="amber">Action Required</Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Phone: <span className="font-mono font-medium">{formatE164(pendingWrapUp.phoneNumber)}</span> • Talk Duration: {formatTimer(pendingWrapUp.durationSeconds)} • Call ended without finalized follow-up.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => resumePendingWrapUp(pendingWrapUp)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
                  >
                    <FileEdit className="h-3.5 w-3.5" /> Resume Workstation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingWrapUp(null)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>

              {pendingWrapUp.notes && (
                <div className="rounded bg-white/80 p-2.5 border border-amber-200/70 text-xs text-slate-700">
                  <span className="font-bold text-slate-600">Draft Notes: </span>
                  {pendingWrapUp.notes}
                </div>
              )}

              {/* Quick Inline Follow-Up Bar */}
              <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center gap-3 bg-white/70 p-3 rounded-md">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Quick Disposition:
                </span>
                <select
                  value={pendingWrapUp.disposition}
                  onChange={(e) =>
                    setPendingWrapUp({ ...pendingWrapUp, disposition: e.target.value as any })
                  }
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="INTERESTED">Interested</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="NOT_ANSWERED">Not Answered / Callback</option>
                </select>

                {pendingWrapUp.disposition === 'INTERESTED' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Follow-Up Date:</span>
                    <input
                      type="date"
                      value={pendingWrapUp.followUpDate}
                      onChange={(e) =>
                        setPendingWrapUp({ ...pendingWrapUp, followUpDate: e.target.value, nextAction: 'CALLBACK' })
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    />
                  </div>
                )}

                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void submitQuickDisposition(pendingWrapUp)}
                  className="ml-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Submit Follow-Up
                </Button>
              </div>
            </div>
          )}

          {/* B. Calling Queue & Direct Dial Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Calling Queue (~65% width) */}
            <div className="lg:col-span-8 rounded-lg border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-white">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Calling Queue
                  </h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {queue.length} assigned
                  </span>
                </div>
                <p className="text-xs text-slate-400">Click &ldquo;Call&rdquo; to launch outbound active session</p>
              </div>

              <div className="divide-y divide-slate-100">
                {queueLoading ? (
                  <div className="p-8"><Spinner label="Loading queue…" /></div>
                ) : queue.length === 0 ? (
                  <div className="p-6 space-y-3 text-center text-xs text-slate-500">
                    <p>Queue empty or all completed for today.</p>
                  </div>
                ) : (
                  queue.map((item) => {
                    const hasPendingOutcome = item.lastCall?.status === 'ENDED' && !item.lastCall?.outcome;
                    return (
                      <div
                        key={item.leadId}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/70 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">{item.customer.fullName}</p>
                            {hasPendingOutcome && (
                              <Badge tone="amber">Wrap-Up Needed</Badge>
                            )}
                            {item.lastCall?.outcome === 'INTERESTED' && (
                              <Badge tone="green">Interested</Badge>
                            )}
                            {item.lastCall?.outcome === 'NOT_INTERESTED' && (
                              <Badge tone="red">Not Interested</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.customer.farmerCode ?? '—'} • {item.customer.primaryPhone ? formatE164(item.customer.primaryPhone) : 'no phone'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPendingOutcome ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-700 border-amber-300 hover:bg-amber-50 font-bold"
                              onClick={() => launchWrapUpForQueueItem(item)}
                            >
                              <FileEdit className="h-3 w-3" /> Finish Follow-Up
                            </Button>
                          ) : null}
                          <Button
                            variant="call"
                            size="sm"
                            onClick={() => void dial(item.customer.primaryPhone ?? item.customer.id, item.customer.id, item.leadId)}
                            disabled={busy}
                          >
                            <Phone className="h-3 w-3 fill-current" /> Call
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Manual Quick Dialer */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-white shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Direct Dial
                </h2>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Line: 9444330285
                </span>
              </div>
              <div className="space-y-3">
                <Input
                  inputMode="tel"
                  placeholder="Mobile number (e.g. +91 62814 89942)"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="call"
                    size="md"
                    className="w-full font-bold shadow-xs"
                    disabled={!manualNumber.trim() || busy}
                    onClick={() => void dial(manualNumber.trim())}
                  >
                    <PhoneCall className="h-4 w-4" /> Dial Number
                  </Button>
                </div>

                {/* Real Farmer Quick-Dial Card: K. Ramanathan */}
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950 text-[11px] flex items-center gap-1.5">
                      <Sprout className="h-3.5 w-3.5 text-emerald-700" />
                      Live Farmer Profile (Supabase DB)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                      FAR-TN-042
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold text-slate-900 text-xs">K. Ramanathan</p>
                    <p className="text-emerald-800 font-mono font-bold">+91 6281489942</p>
                    <p className="text-slate-600 text-[10px]">Papanasam, Thanjavur • Rice (Paddy) 5.0 Acres</p>
                  </div>
                  <Button
                    variant="call"
                    size="xs"
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs py-2"
                    disabled={busy}
                    onClick={() => {
                      setManualNumber('+916281489942');
                      void dial('+916281489942', '8ba7c48d-28d4-4744-ab7e-eda5cf06f39c', '7c004d73-4b4b-44d6-a5ba-e2e3e6ec0a4b');
                    }}
                  >
                    <Phone className="h-3 w-3 fill-current" /> Call K. Ramanathan (+91 6281489942)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewCustomer ? (
        <NewCustomerModal
          initialPhone={manualNumber}
          onClose={() => setShowNewCustomer(false)}
          onCreated={() => setShowNewCustomer(false)}
        />
      ) : null}

      {/* Mid-Call Add Farmer Modal */}
      {showAddFarmerModal ? (
        <NewCustomerModal
          initialPhone={farmerDisplayPhone}
          onClose={() => setShowAddFarmerModal(false)}
          onCreated={(id) => void handleNewFarmerCreated(id)}
        />
      ) : null}

      {/* Mid-Call Add to Existing Farmer Search & Link Modal */}
      {showExistingFarmerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-800">Add to Existing Farmer Profile</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowExistingFarmerModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {existingFarmerLinkError ? (
                <Alert tone="error">{existingFarmerLinkError}</Alert>
              ) : null}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={existingFarmerSearch}
                    onChange={(e) => {
                      setExistingFarmerSearch(e.target.value);
                      void searchExistingFarmers(e.target.value);
                    }}
                    placeholder="Search by farmer name, phone number, or village..."
                    className="pl-8 text-xs"
                    autoFocus
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={existingFarmerSearching}
                  onClick={() => void searchExistingFarmers(existingFarmerSearch)}
                >
                  {existingFarmerSearching ? 'Searching…' : 'Search'}
                </Button>
              </div>

              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto border border-slate-200 rounded-md">
                {existingFarmersList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {existingFarmerSearching ? 'Searching CRM records…' : 'No matching farmers found. Try typing a name or phone number above.'}
                  </div>
                ) : (
                  existingFarmersList.map((farmer) => (
                    <div
                      key={farmer.id}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{farmer.fullName}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {farmer.farmerCode || 'FARM'}
                          </span>
                          <span
                            className={cx(
                              'text-[9px] font-bold px-1.5 py-0.2 rounded border',
                              farmer.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            )}
                          >
                            {farmer.status}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600">
                          {farmer.primaryPhone ? formatE164(farmer.primaryPhone) : 'No primary phone'}
                          {farmer.phoneCount > 1 ? ` (+${farmer.phoneCount - 1} more)` : ''}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="primary"
                        disabled={existingFarmerLinkBusy}
                        onClick={() => void linkFarmerToCall(farmer.id)}
                      >
                        {existingFarmerLinkBusy ? 'Linking…' : 'Link to Call'}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 bg-slate-50">
              <span className="text-[11px] text-slate-500">
                Cannot find this farmer in CRM?
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setShowExistingFarmerModal(false);
                  setShowAddFarmerModal(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> + Register New Farmer Instead
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
