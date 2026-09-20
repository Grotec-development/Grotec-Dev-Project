import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Laptop,
  Coffee,
  Pause,
  Play,
  BarChart2,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { api, errorMessage, messagingApi } from '../lib/api';
import type { Call, CallContext, CustomerDetail, CustomerSummary, Page, QueueItem, KnowledgeGuidance } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { formatDate, formatE164 } from '../lib/format';
import { Alert, Badge, Button, Card, Input, Spinner, cx } from '../components/ui';
import { PageHead } from '../components/PageHead';
import { telephonyAudio } from '../lib/telephonyAudio';
import { isNativeApp, initiateDirectCall, subscribeToCallState, requestCallingPermissions } from '../lib/native-calling';
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

export type CallingMode = 'KEYPAD' | 'PHONE_LINK';
export type DispositionType = 'INTERESTED' | 'NOT_INTERESTED' | 'NOT_ANSWERED' | 'WRONG_NUMBER';

export const QUICK_TAGS = [
  '+ Bio-fertilizer trial',
  '+ Pricing inquiry',
  '+ Cotton crop pest',
  '+ Paddy crop guidance',
  '+ Callback tomorrow',
  '+ Needs quote on WhatsApp',
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
  disposition: DispositionType;
  nextAction: 'CALLBACK';
  followUpDate: string;
  followUpTime: string;
  followUpNote: string;
}

export function AgentWorkspacePage() {
  const { user } = useAuth();
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
  const [disposition, setDisposition] = useState<DispositionType>('INTERESTED');
  const [nextAction, setNextAction] = useState<'CALLBACK'>('CALLBACK');
  const [followUpDate, setFollowUpDate] = useState(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
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

  // 2 Calling Modes: Keypad Phone (Manual) vs Phone Link (PC / Bluetooth)
  const [callingMode, setCallingMode] = useState<CallingMode>(() => {
    try {
      const saved = localStorage.getItem('grotec_calling_mode_v2');
      if (saved === 'KEYPAD' || saved === 'PHONE_LINK') return saved;
    } catch {}
    return 'KEYPAD';
  });

  const handleSetCallingMode = (mode: CallingMode) => {
    setCallingMode(mode);
    try {
      localStorage.setItem('grotec_calling_mode_v2', mode);
    } catch {}
    setSuccessNotice(`Switched to: ${mode === 'KEYPAD' ? 'Keypad Phone (Manual)' : 'Phone Link (PC / Bluetooth)'}.`);
  };

  const [copiedPhone, setCopiedPhone] = useState(false);
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const addQuickTag = (tag: string) => {
    const cleanTag = tag.replace(/^\+\s*/, '');
    setNoteDraft((prev) => (prev ? `${prev}. ${cleanTag}` : cleanTag));
  };

  // Agent Break tracking state
  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    try {
      return localStorage.getItem('grotec_agent_on_break') === 'true';
    } catch {
      return false;
    }
  });
  const [breakReason, setBreakReason] = useState<string>(() => {
    try {
      return localStorage.getItem('grotec_agent_break_reason') || 'Tea Break';
    } catch {
      return 'Tea Break';
    }
  });
  const [breakStartTime, setBreakStartTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('grotec_agent_break_start');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [breakElapsed, setBreakElapsed] = useState<number>(0);
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [totalBreaksMinutes, setTotalBreaksMinutes] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('grotec_total_break_mins')) || 0;
    } catch {
      return 0;
    }
  });

  const startBreak = (reason: string) => {
    setIsOnBreak(true);
    setBreakReason(reason);
    const now = Date.now();
    setBreakStartTime(now);
    setShowBreakModal(false);
    try {
      localStorage.setItem('grotec_agent_on_break', 'true');
      localStorage.setItem('grotec_agent_break_reason', reason);
      localStorage.setItem('grotec_agent_break_start', String(now));
    } catch {}
    setSuccessNotice(`You are now on ${reason}. Calling queue is paused.`);
  };

  const endBreak = () => {
    let addedMins = 15;
    if (breakStartTime) {
      addedMins = Math.max(1, Math.round((Date.now() - breakStartTime) / 60000));
    }
    const newTotal = totalBreaksMinutes + addedMins;
    setTotalBreaksMinutes(newTotal);
    setIsOnBreak(false);
    setBreakStartTime(null);
    setBreakElapsed(0);
    try {
      localStorage.removeItem('grotec_agent_on_break');
      localStorage.removeItem('grotec_agent_break_reason');
      localStorage.removeItem('grotec_agent_break_start');
      localStorage.setItem('grotec_total_break_mins', String(newTotal));
    } catch {}
    setSuccessNotice(`Resumed calling session. Break logged: ${addedMins} min.`);
  };

  // Agent Shift Uptime tracking
  const [shiftStart] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('grotec_shift_start_ts');
      if (saved) return Number(saved);
      const now = Date.now();
      localStorage.setItem('grotec_shift_start_ts', String(now));
      return now;
    } catch {
      return Date.now();
    }
  });
  const [shiftUptimeSeconds, setShiftUptimeSeconds] = useState<number>(0);

  // Live Performance Stats Query for current agent
  const agentPerfQuery = useQuery({
    queryKey: ['agent-my-performance', user?.id],
    queryFn: async () => (await api.get<any>('/reports/agent-performance', {
      params: { period: 'today', agentId: user?.id },
    })).data,
  });
  const myPerf = agentPerfQuery.data?.agents?.[0];

  useEffect(() => {
    if (!isOnBreak) return;
    const interval = window.setInterval(() => {
      if (breakStartTime) {
        setBreakElapsed(Math.floor((Date.now() - breakStartTime) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isOnBreak, breakStartTime]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShiftUptimeSeconds(Math.floor((Date.now() - shiftStart) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [shiftStart]);

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
  const [leftColumnTab, setLeftColumnTab] = useState<'profile' | 'kb'>('profile');  // Operational Queue Tab & Search filter
  const [queueTab, setQueueTab] = useState<'ALL' | 'PENDING' | 'CALLBACKS' | 'COMPLETED'>('ALL');
  const [queueSearch, setQueueSearch] = useState('');
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

  // Initialize native permissions & telephony listeners if running as mobile/tablet app
  useEffect(() => {
    if (!isNativeApp()) return;
    void requestCallingPermissions();
    const unsubscribe = subscribeToCallState((callState) => {
      if (callState === 'IDLE' && activeCall && !isWrapUp) {
        setIsWrapUp(true);
        telephonyAudio.stopRingback();
      }
    });
    return () => unsubscribe();
  }, [activeCall, isWrapUp]);

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
    if (isNativeApp()) {
      await initiateDirectCall(phoneNumber);
    } else if (callingMode === 'PHONE_LINK') {
      await initiateDirectCall(phoneNumber);
    }
    try {
      const res = await api.post<Call>('/calls', { phoneNumber, customerId, leadId, mode: 'DIRECT_SIM' });
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
  async function saveAndCompleteDisposition(advanceToNext: boolean = true) {
    if (!activeCall && !isWrapUp) return;
    setBusy(true);
    setError(null);
    try {
      const callId = activeCall?.id;
      const farmerName = farmerDisplayName;
      const outcomeText =
        disposition === 'INTERESTED'
          ? `Interested (Follow-Up on ${followUpDate})`
          : disposition === 'NOT_INTERESTED'
          ? 'Not Interested'
          : disposition === 'WRONG_NUMBER'
          ? 'Wrong Number'
          : 'Not Answered / Callback Needed';

      if (callId) {
        if (noteDraft.trim()) {
          await api.post(`/calls/${callId}/notes`, { body: noteDraft.trim() }).catch(() => undefined);
        }
        const outcomePayload: any = {
          outcome: disposition === 'WRONG_NUMBER' ? 'NOT_ANSWERED' : disposition,
        };
        if (disposition === 'INTERESTED') {
          outcomePayload.nextAction = 'CALLBACK';
          outcomePayload.followUpDate = followUpDate || new Date().toISOString().slice(0, 10);
          outcomePayload.followUpTime = followUpTime || '10:00';
          outcomePayload.followUpNote =
            followUpNote.trim() || noteDraft.trim() || 'Follow-up callback';
        }
        await api.post(`/calls/${callId}/outcome`, outcomePayload);
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

      void loadQueue();

      if (advanceToNext && filteredQueue.length > 0) {
        const nextIdx = (queueIndex + 1) % filteredQueue.length;
        setQueueIndex(nextIdx);
        const nextTarget = filteredQueue[nextIdx];
        if (nextTarget) {
          void loadContext(nextTarget.leadId || nextTarget.customer.id);
          setSuccessNotice(`Notes saved for ${farmerName}! Staged next customer: ${nextTarget.customer.fullName}.`);
          return;
        }
      }

      setSuccessNotice(`Call completed for ${farmerName}! Disposition saved: ${outcomeText}.`);
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
      agentId: user?.id || 'agent',
      phoneNumber: item.phoneNumber,
      direction: 'OUTBOUND',
      status: 'ENDED',
      outcome: null,
      nextAction: null,
      provider: 'direct_sim',
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
      agentId: user?.id || 'agent',
      phoneNumber: item.lastCall.phoneNumber,
      direction: 'OUTBOUND',
      status: 'ENDED',
      outcome: null,
      nextAction: null,
      provider: (item.lastCall as any)?.provider || 'direct_sim',
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

  const queueCounts = useMemo(() => {
    let pending = 0;
    let callbacks = 0;
    let completed = 0;
    for (const item of queue) {
      const hasOutcome = Boolean(item.lastCall?.outcome);
      if (hasOutcome) completed++;
      else pending++;
      if (item.lastCall?.outcome === 'INTERESTED' || (item.lastCall as any)?.nextAction === 'CALLBACK') {
        callbacks++;
      }
    }
    return { all: queue.length, pending, callbacks, completed };
  }, [queue]);

  const filteredQueue = useMemo(() => {
    const list = queue.filter((item) => {
      // Tab filter
      if (queueTab === 'PENDING') {
        if (item.lastCall?.outcome) return false;
      } else if (queueTab === 'CALLBACKS') {
        if (item.lastCall?.outcome !== 'INTERESTED' && (item.lastCall as any)?.nextAction !== 'CALLBACK') {
          return false;
        }
      } else if (queueTab === 'COMPLETED') {
        if (!item.lastCall?.outcome) return false;
      }

      // Search filter
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        const nameMatch = item.customer?.fullName?.toLowerCase().includes(q);
        const codeMatch = item.customer?.farmerCode?.toLowerCase().includes(q);
        const phoneMatch = item.customer?.primaryPhone?.includes(q);
        if (!nameMatch && !codeMatch && !phoneMatch) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const aPending = a.lastCall?.status === 'ENDED' && !a.lastCall?.outcome ? 1 : 0;
      const bPending = b.lastCall?.status === 'ENDED' && !b.lastCall?.outcome ? 1 : 0;
      return bPending - aPending;
    });
  }, [queue, queueTab, queueSearch]);

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

  // Real-time acoustic telephony state management (ringback, connection tones)
  useEffect(() => {
    const status = activeCall?.status;
    const prevStatus = prevCallStatusRef.current;

    if (status === 'DIALING' || status === 'RINGING') {
      telephonyAudio.startRingback();
    } else if (status === 'CONNECTED') {
      telephonyAudio.stopRingback();
      if (prevStatus !== 'CONNECTED') {
        telephonyAudio.playConnectChime();
      }
    } else if (!isActive(status)) {
      telephonyAudio.stopRingback();
      if (prevStatus && ACTIVE_STATUSES.includes(prevStatus)) {
        telephonyAudio.playDisconnectChime();
      }
    }

    prevCallStatusRef.current = status || null;
  }, [activeCall?.status]);

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

  if (user?.roleCode === 'FOUNDER') {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <PageHead
          title="Executive Operations & Analytics"
          description="Agent Calling Workspace is designed for telecaller operations. As Founder & CEO, manage team operations and review agent performance analytics."
        />
        <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center max-w-xl mx-auto shadow-sm space-y-5 my-10">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <BarChart2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Founder &amp; CEO Operations</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Outbound telecalling and manual dial queues are dedicated to your telecaller agent team. You can monitor live <strong>Agent Performance Analytics</strong>, <strong>Breaks &amp; Uptime</strong>, and <strong>Call Quality</strong> across the entire organization.
            </p>
          </div>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/reports"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 text-xs shadow-xs transition"
            >
              <BarChart2 className="h-4 w-4" />
              <span>View Agent Performance Analytics</span>
            </Link>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 text-xs transition"
            >
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header: Breadcrumb, 2 Calling Modes, Break Controller, Queue Categories */}
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

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Calling Mode: Native Direct In-App for Mobile/Tablet or 2-mode Toggle for Desktop */}
          {isNativeApp() ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
              <span>Direct In-App Calling (SIM)</span>
            </div>
          ) : (
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSetCallingMode('KEYPAD')}
                className={cx(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer',
                  callingMode === 'KEYPAD'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Manual keypad phone mode — number is displayed clearly to dial from phone"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Keypad Phone</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetCallingMode('PHONE_LINK')}
                className={cx(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer',
                  callingMode === 'PHONE_LINK'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Windows Phone Link / Bluetooth mode — click Call to dial from PC"
              >
                <Laptop className="h-3.5 w-3.5 text-blue-600" />
                <span>Phone Link</span>
              </button>
            </div>
          )}

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Break Controller Button */}
          {isOnBreak ? (
            <button
              type="button"
              onClick={endBreak}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 text-[11px] font-bold shadow-xs transition animate-pulse cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Resume Calling ({formatTimer(breakElapsed)})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowBreakModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-[11px] font-bold border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              <Coffee className="h-3 w-3 text-amber-600" />
              <span>Take Break</span>
            </button>
          )}

          {matchedQueueItem && (
            <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px] font-semibold">
              {matchedQueueItem.leadId ? 'Lead Pipeline' : 'Existing Customer'}
            </span>
          )}
        </div>

        {/* Operational Queue Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              setQueueTab('ALL');
              setQueueIndex(0);
            }}
            className={cx(
              'px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap',
              queueTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            All Assigned ({queueCounts.all})
          </button>
          <button
            type="button"
            onClick={() => {
              setQueueTab('PENDING');
              setQueueIndex(0);
            }}
            className={cx(
              'px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap',
              queueTab === 'PENDING'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Pending ({queueCounts.pending})
          </button>
          <button
            type="button"
            onClick={() => {
              setQueueTab('CALLBACKS');
              setQueueIndex(0);
            }}
            className={cx(
              'px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap',
              queueTab === 'CALLBACKS'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Callbacks ({queueCounts.callbacks})
          </button>
          <button
            type="button"
            onClick={() => {
              setQueueTab('COMPLETED');
              setQueueIndex(0);
            }}
            className={cx(
              'px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap',
              queueTab === 'COMPLETED'
                ? 'bg-white text-purple-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Completed ({queueCounts.completed})
          </button>
        </div>
      </div>

      {/* Agent Performance Analytics Live Bar */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="border-r border-slate-100 pr-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <PhoneCall className="h-3 w-3 text-emerald-600" />
              <span>Calls Today</span>
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              {myPerf?.calls?.dialed ?? 0} dialed
              <span className="text-[11px] font-normal text-slate-500 ml-1">
                ({myPerf?.calls?.connected ?? 0} conn)
              </span>
            </p>
          </div>

          <div className="border-r border-slate-100 pr-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-600" />
              <span>Talk Time</span>
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              {formatTimer(myPerf?.calls?.totalTalkTimeSeconds ?? 0)}
              <span className="text-[10px] font-normal text-slate-500 ml-1">
                (avg {formatTimer(myPerf?.calls?.avgTalkTimeSeconds ?? 0)})
              </span>
            </p>
          </div>

          <div className="border-r border-slate-100 pr-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Coffee className="h-3 w-3 text-amber-600" />
              <span>Breaks</span>
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              {isOnBreak ? (
                <span className="text-amber-600 font-bold animate-pulse">On {breakReason}</span>
              ) : (
                `${totalBreaksMinutes} mins total`
              )}
            </p>
          </div>

          <div className="border-r border-slate-100 pr-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Award className="h-3 w-3 text-purple-600" />
              <span>Quality Score</span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-purple-700">
                {myPerf?.quality?.score ?? 92}%
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {myPerf?.quality?.grade ?? 'Grade A'}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              <span>Shift Uptime</span>
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              {Math.floor(shiftUptimeSeconds / 3600)}h {Math.floor((shiftUptimeSeconds % 3600) / 60)}m
              <span className="text-[10px] text-emerald-600 font-semibold ml-1.5">● Active</span>
            </p>
          </div>
        </div>
      </div>

      {/* Break Active Banner */}
      {isOnBreak && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Break in Progress: {breakReason}
              </p>
              <p className="text-[11px] text-amber-800">
                Time elapsed: <strong className="font-mono font-bold">{formatTimer(breakElapsed)}</strong> • Outbound call queue is paused.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={endBreak}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
          >
            <Play className="h-3.5 w-3.5 mr-1 fill-current" /> Resume Calling
          </Button>
        </div>
      )}

      {/* Up Next Preview Area */}
      {nextQueueItem && (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Up Next:</span>
            <span className="font-bold text-slate-900 truncate">{nextQueueItem.customer.fullName}</span>
            <span className="text-slate-700 font-mono font-bold">
              {nextQueueItem.customer.primaryPhone ? formatE164(nextQueueItem.customer.primaryPhone) : 'No phone'}
            </span>
            <span className="text-[10px] rounded bg-slate-200/80 px-1.5 py-0.2 text-slate-600 shrink-0 font-medium">
              {nextQueueItem.leadId ? 'Lead' : 'Farmer'}
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
            {callingMode === 'KEYPAD' ? (
              <Button
                size="xs"
                variant="primary"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                onClick={() => dial(nextQueueItem.customer.primaryPhone || '', nextQueueItem.customer.id, nextQueueItem.leadId)}
              >
                <FileEdit className="h-3 w-3" /> Start Notes
              </Button>
            ) : (
              <Button
                size="xs"
                variant="call"
                onClick={() => dial(nextQueueItem.customer.primaryPhone || '', nextQueueItem.customer.id, nextQueueItem.leadId)}
              >
                <Phone className="h-3 w-3 fill-current" /> Call Next
              </Button>
            )}
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
                Connected ➔ Farmer <span className="font-bold text-white">{farmerDisplayName}</span> (<span className="font-mono text-emerald-200">{formatE164(farmerDisplayPhone)}</span>)
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
            {activeCall?.status !== 'CONNECTED' && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!activeCall) return;
                  try {
                    await api.post(`/calls/${activeCall.id}/answer`);
                    await loadActiveCall();
                    setSuccessNotice('Call marked answered. You can now record advisory notes.');
                  } catch (err: any) {
                    setError(errorMessage(err));
                  }
                }}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer animate-pulse"
                title="Click when farmer answers the phone"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Farmer Answered</span>
              </button>
            )}
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

      {/* Live Telephony Voice Channel Card */}
      {callActive && (
        <div className="rounded-xl bg-slate-900 text-white p-4 border border-slate-700/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5 ring-1 ring-emerald-500/40">
              <PhoneCall className="h-5 w-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Active PSTN / SIM Telephony Line
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-medium">
                  {farmerLocation || 'Papanasam, Thanjavur'}
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
                  {farmerCrops || 'Rice (Paddy)'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                  <span>Customer: <strong className="text-emerald-400 font-mono">{formatE164(farmerDisplayPhone)}</strong></span>
                  <span className="text-slate-400">({isNativeApp() ? 'Direct SIM' : callingMode === 'PHONE_LINK' ? 'Phone Link' : 'Keypad'})</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <a
              href={`tel:${farmerDisplayPhone}`}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Launch native phone dialer / SIM link"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Dial via Handset SIM</span>
            </a>
            <button
              type="button"
              onClick={() => {
                const snippet = `\n[Call Notes for ${farmerDisplayName} (${formatE164(farmerDisplayPhone)}) - Crop: ${farmerCrops || 'Paddy'}]`;
                setNoteDraft((prev) => (prev ? `${prev.trimEnd()}${snippet}` : snippet.trim()));
                setSuccessNotice('Added call header to notes.');
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Insert timestamped header into notes"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Notes</span>
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
              {/* Calling Mode Visual Banner */}
              {callingMode === 'KEYPAD' ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                        Manual Keypad Phone Mode
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xl font-black text-slate-900">
                          {farmerDisplayPhone ? formatE164(farmerDisplayPhone) : 'No phone'}
                        </span>
                        {farmerDisplayPhone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(farmerDisplayPhone)}
                            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 bg-white border border-emerald-200 px-2 py-0.5 rounded shadow-2xs cursor-pointer"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedPhone ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Dial this number on your mobile handset. Record notes and outcome below.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Duration</span>
                    <p className="font-mono text-base font-black text-slate-900">{formatTimer(elapsed)}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-300 bg-blue-50/80 p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Laptop className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                        Phone Link / Bluetooth Calling
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xl font-black text-slate-900">
                          {farmerDisplayPhone ? formatE164(farmerDisplayPhone) : 'No phone'}
                        </span>
                        <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[10px] font-bold">
                          Active Session
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Call connected via system dialer / Phone Link. Record notes below.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Talk Time</span>
                    <p className="font-mono text-base font-black text-blue-900">{formatTimer(elapsed)}</p>
                  </div>
                </div>
              )}

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

                {/* Quick Remarks Pills */}
                <div className="flex flex-wrap items-center gap-1 py-1">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick remarks:</span>
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addQuickTag(tag)}
                      className="rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-medium transition cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
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
                      title={farmerDisplayPhone ? `Send notes to ${formatE164(farmerDisplayPhone)} via SMS` : 'No phone number'}
                      className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <Smartphone className="h-3 w-3" />
                      {sendingMessage === 'sms' ? 'Sending SMS...' : 'Send SMS'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Disposition Selector: 4 1-click pills */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Call Outcome / Disposition *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDisposition('INTERESTED')}
                    className={cx(
                      'py-2 px-2.5 rounded-lg text-xs font-bold border transition text-center flex flex-col items-center gap-0.5 cursor-pointer',
                      disposition === 'INTERESTED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-sm">★</span>
                    <span>Interested</span>
                    <span className="text-[9px] font-normal text-emerald-700">Schedule Callback</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposition('NOT_INTERESTED')}
                    className={cx(
                      'py-2 px-2.5 rounded-lg text-xs font-bold border transition text-center flex flex-col items-center gap-0.5 cursor-pointer',
                      disposition === 'NOT_INTERESTED'
                        ? 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-sm">✗</span>
                    <span>Not Interested</span>
                    <span className="text-[9px] font-normal text-red-600">Close Discussion</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposition('NOT_ANSWERED')}
                    className={cx(
                      'py-2 px-2.5 rounded-lg text-xs font-bold border transition text-center flex flex-col items-center gap-0.5 cursor-pointer',
                      disposition === 'NOT_ANSWERED'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-sm">⊘</span>
                    <span>No Answer / Busy</span>
                    <span className="text-[9px] font-normal text-amber-700">Retry Later</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposition('WRONG_NUMBER')}
                    className={cx(
                      'py-2 px-2.5 rounded-lg text-xs font-bold border transition text-center flex flex-col items-center gap-0.5 cursor-pointer',
                      disposition === 'WRONG_NUMBER'
                        ? 'bg-slate-100 border-slate-500 text-slate-900 ring-2 ring-slate-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-sm">⚠</span>
                    <span>Wrong Number</span>
                    <span className="text-[9px] font-normal text-slate-500">Invalid / Unreachable</span>
                  </button>
                </div>
              </div>

              {/* Interested Next Action Sub-Panel (direct Callback) */}
              {disposition === 'INTERESTED' && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-900">
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  disabled={busy}
                  onClick={wrapUpLater}
                  className="text-slate-600 border-slate-300 hover:bg-slate-50 font-semibold w-full sm:w-auto"
                >
                  <Clock className="h-4 w-4" /> Back to Queue
                </Button>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={busy}
                    onClick={() => void saveAndCompleteDisposition(false)}
                    className="font-bold border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Save Notes Only
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    loading={busy}
                    onClick={() => void saveAndCompleteDisposition(true)}
                    className="px-5 py-2 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Save &amp; Next Farmer &rarr;
                  </Button>
                </div>
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

          {/* B. Calling Queue & Quick Phone Lookup Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Calling Queue (~65% width) */}
            <div className="lg:col-span-8 rounded-lg border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-white gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Calling Queue
                  </h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {filteredQueue.length} shown ({queueCounts.pending} pending)
                  </span>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search name, phone, code..."
                    className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {queueLoading ? (
                  <div className="p-8"><Spinner label="Loading queue…" /></div>
                ) : filteredQueue.length === 0 ? (
                  <div className="p-8 space-y-2 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">No customers match the current filter.</p>
                    <p className="text-[11px] text-slate-400">
                      Try selecting another queue tab above or clearing your search term.
                    </p>
                  </div>
                ) : (
                  filteredQueue.map((item) => {
                    const hasPendingOutcome = item.lastCall?.status === 'ENDED' && !item.lastCall?.outcome;
                    return (
                      <div
                        key={item.leadId || item.customer.id}
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
                          {callingMode === 'KEYPAD' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                              onClick={() => void dial(item.customer.primaryPhone ?? item.customer.id, item.customer.id, item.leadId)}
                              disabled={busy}
                            >
                              <FileEdit className="h-3.5 w-3.5" /> Start Notes
                            </Button>
                          ) : (
                            <Button
                              variant="call"
                              size="sm"
                              onClick={() => void dial(item.customer.primaryPhone ?? item.customer.id, item.customer.id, item.leadId)}
                              disabled={busy}
                            >
                              <Phone className="h-3 w-3 fill-current" /> Call
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Manual Phone Lookup & Quick Calling */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-white shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {callingMode === 'KEYPAD' ? 'Manual Phone Lookup' : 'Phone Link Quick Call'}
                </h2>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  {callingMode === 'KEYPAD' ? 'Keypad Phone' : 'Phone Link'}
                </span>
              </div>
              <div className="space-y-3">
                <Input
                  inputMode="tel"
                  placeholder="Enter farmer number (e.g. 9876543001)"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                />
                {callingMode === 'KEYPAD' ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full font-bold shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                    disabled={!manualNumber.trim() || busy}
                    onClick={() => void dial(manualNumber.trim())}
                  >
                    <FileEdit className="h-4 w-4" /> Open Record &amp; Take Notes
                  </Button>
                ) : (
                  <Button
                    variant="call"
                    size="md"
                    className="w-full font-bold shadow-xs"
                    disabled={!manualNumber.trim() || busy}
                    onClick={() => void dial(manualNumber.trim())}
                  >
                    <Phone className="h-4 w-4 fill-current" /> Call via Phone Link
                  </Button>
                )}

                {/* Real Farmer Quick-Dial Card: K. Ramanathan */}
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950 text-[11px] flex items-center gap-1.5">
                      <Sprout className="h-3.5 w-3.5 text-emerald-700" />
                      Sample Farmer Profile
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                      FAR-TN-042
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold text-slate-900 text-xs">K. Ramanathan</p>
                    <p className="text-emerald-800 font-mono font-bold">+91 62814 89942</p>
                    <p className="text-slate-600 text-[10px]">Papanasam, Thanjavur • Rice (Paddy) 5.0 Acres</p>
                  </div>
                  <div className="pt-1">
                    {callingMode === 'KEYPAD' ? (
                      <Button
                        size="sm"
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                        onClick={() => {
                          setManualNumber('+916281489942');
                          void dial('+916281489942', '8ba7c48d-28d4-4744-ab7e-eda5cf06f39c', '7c004d73-4b4b-44d6-a5ba-e2e3e6ec0a4b');
                        }}
                      >
                        <FileEdit className="h-3.5 w-3.5" /> Start Notes (+91 62814 89942)
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="call"
                        className="w-full"
                        onClick={() => {
                          setManualNumber('+916281489942');
                          void dial('+916281489942', '8ba7c48d-28d4-4744-ab7e-eda5cf06f39c', '7c004d73-4b4b-44d6-a5ba-e2e3e6ec0a4b');
                        }}
                      >
                        <Phone className="h-3.5 w-3.5 fill-current" /> Call (+91 62814 89942)
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mode Explanation Box */}
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-700 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-slate-900 text-[11px] uppercase tracking-wider">
                    {callingMode === 'KEYPAD' ? (
                      <>
                        <Smartphone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Keypad Phone Workflow</span>
                      </>
                    ) : (
                      <>
                        <Laptop className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>Phone Link Workflow</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {callingMode === 'KEYPAD'
                      ? 'The farmer phone number is clearly presented for you to dial on your physical keypad mobile phone. The CRM tracks call duration, previous history, and records your advisory notes.'
                      : 'Your smartphone is connected to this computer via Windows Phone Link or Bluetooth. Clicking "Call" initiates the outbound call through your PC.'}
                  </p>
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

      {/* Agent Break Selection Modal */}
      {showBreakModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fadeIn" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Coffee className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Take a Break</h3>
                  <p className="text-[11px] text-slate-500">Queue progression will pause while on break</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Select Break Type:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Tea Break', mins: '15 mins', icon: Coffee },
                  { label: 'Lunch Break', mins: '30 mins', icon: Coffee },
                  { label: 'Bio / Rest', mins: '10 mins', icon: Pause },
                  { label: 'Team Meeting', mins: '30 mins', icon: Users },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => startBreak(b.label)}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/60 transition text-left cursor-pointer group"
                  >
                    <b.icon className="h-4 w-4 text-slate-500 group-hover:text-amber-600 mb-1" />
                    <span className="text-xs font-bold text-slate-900">{b.label}</span>
                    <span className="text-[10px] text-slate-500">{b.mins}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBreakModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
