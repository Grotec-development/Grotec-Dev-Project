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
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Call, CallContext, QueueItem, KnowledgeGuidance } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { Alert, Badge, Button, Card, Input, Spinner, cx } from '../components/ui';
import { NewCustomerModal } from './customers/NewCustomerModal';
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

const BIO_INPUT_RECOMMENDATIONS = [
  { id: '1', name: 'Phos (Liquid)', category: 'Phosphate Solubilizer', price: '₹450/L' },
  { id: '2', name: 'Micromix', category: 'Micronutrients', price: '₹650/kg' },
  { id: '3', name: 'Sanjeevini Gel', category: 'Plant Vitality', price: '₹800/bag' },
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
  nextAction: 'CALLBACK' | 'SALES';
  followUpDate: string;
  followUpTime: string;
  followUpNote: string;
  suggestedProducts: string[];
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
  const [nextAction, setNextAction] = useState<'CALLBACK' | 'SALES'>('CALLBACK');
  const [followUpDate, setFollowUpDate] = useState('2026-03-12');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpNote, setFollowUpNote] = useState('');
  const [suggestedProducts, setSuggestedProducts] = useState<string[]>([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(204); // Default elapsed timer for mock realism
  const { setContext: setAssistantContext } = useAssistantContext();

  // Knowledge Base in-call state
  const [kbQuery, setKbQuery] = useState('');
  const [kbFilterCrop, setKbFilterCrop] = useState<string>('ALL');
  const [kbGuidanceList, setKbGuidanceList] = useState<KnowledgeGuidance[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [leftColumnTab, setLeftColumnTab] = useState<'profile' | 'kb'>('profile');
  const [queueCategory, setQueueCategory] = useState<'ALL' | 'EXISTING' | 'LEADS' | 'NEW'>('ALL');
  const [queueIndex, setQueueIndex] = useState(0);

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
    }, 2000);
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

  function suggestGuidanceProducts(item: KnowledgeGuidance) {
    // If any item recommended matches BIO_INPUT_RECOMMENDATIONS, toggle it
    item.recommendedProducts.forEach((prodName) => {
      const match = BIO_INPUT_RECOMMENDATIONS.find((b) =>
        b.name.toLowerCase().includes(prodName.toLowerCase()) || prodName.toLowerCase().includes(b.name.toLowerCase()),
      );
      if (match && !suggestedProducts.includes(match.id)) {
        setSuggestedProducts((prev) => [...prev, match.id]);
      }
    });
    setSuccessNotice(`Added ${item.recommendedProducts.join(', ')} to recommended bio-inputs.`);
  }

  async function dial(phoneNumber: string, customerId?: string, leadId?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const res = await api.post<Call>('/calls', { phoneNumber, customerId, leadId });
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

  // Quick simulated start for testing the active call screen from mock
  function startMockActiveCall(name: string, phone: string) {
    setActiveCall({
      id: 'mock-call-1',
      customerId: null,
      leadId: null,
      agentId: 'agent-1',
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
      endedAt: null,
      outcome: null,
      nextAction: null,
      disconnectReason: null,
      phoneNumber: phone,
      direction: 'OUTBOUND',
      provider: 'MOCK_DIALER',
      providerCallId: 'sim-call-98421',
      status: 'CONNECTED',
      notes: [],
    });
    setIsMuted(false);
    setIsWrapUp(false);
    setElapsed(204); // 03:24 timer matching PDF mockup
    setNoteDraft(
      'Farmer reports slight leaf curl on paddy. Advised check on water stagnation. Interested in Phos bio-fertilizer for upcoming phosphate solubilization trial.',
    );
    setDisposition('INTERESTED');
    setNextAction('CALLBACK');
    setFollowUpDate('2026-03-12');
    setFollowUpTime('10:00');
    setFollowUpNote('Check phosphate solubilization trial results');
    setError(null);
    setSuccessNotice(null);
  }

  // Hang up call without leaving screen -> transition into wrap-up
  async function endCall() {
    if (!activeCall || busy) return;
    setBusy(true);
    setError(null);
    setIsMuted(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    try {
      if (activeCall.id === 'mock-call-1') {
        setActiveCall({ ...activeCall, status: 'ENDED', endedAt: new Date().toISOString() });
        setIsWrapUp(true);
        return;
      }
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
      const isMock = activeCall.id === 'mock-call-1';

      if (!isMock) {
        // Ensure call status is ENDED before recording outcome
        if (isActive(activeCall.status)) {
          await api.post(`/calls/${activeCall.id}/end`).catch(() => undefined);
        }

        // Save note if drafted
        if (noteDraft.trim()) {
          await api.post(`/calls/${activeCall.id}/notes`, { body: noteDraft.trim() }).catch(() => undefined);
        }

        // Record outcome
        const outcomePayload: any = {
          outcome: disposition,
        };
        if (disposition === 'INTERESTED') {
          outcomePayload.nextAction = nextAction;
          if (nextAction === 'CALLBACK') {
            outcomePayload.followUpDate = followUpDate || new Date().toISOString().slice(0, 10);
            outcomePayload.followUpTime = followUpTime || '10:00';
            outcomePayload.followUpNote =
              followUpNote.trim() || noteDraft.trim() || 'Telecaller follow-up callback';
          }
        }
        await api.post(`/calls/${activeCall.id}/outcome`, outcomePayload);
      }

      const farmerName = farmerDisplayName;
      const outcomeText =
        disposition === 'INTERESTED'
          ? `Interested (${nextAction === 'CALLBACK' ? `Follow-up on ${followUpDate}` : 'Handed over to RM'})`
          : disposition === 'NOT_INTERESTED'
            ? 'Not Interested'
            : 'Not Answered';

      setActiveCall(null);
      setIsWrapUp(false);
      setIsMuted(false);
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
      setSuggestedProducts([]);
      setSuccessNotice(`Call session completed for ${farmerName}. Disposition saved: ${outcomeText}.`);
      void loadQueue();
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
      suggestedProducts,
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
    setSuggestedProducts(item.suggestedProducts);
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
    if (item.callId !== 'mock-call-1') {
      void loadContext(item.callId);
    }
  }

  // Quick submit directly from outside card
  async function submitQuickDisposition(item: PendingWrapUpItem) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (item.callId !== 'mock-call-1') {
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
      }
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
    return queue.filter((item) => {
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
          <span className="font-bold text-slate-800">Agent Calling Mode</span>
          <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
            Active Telecaller
          </span>
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

      {/* 2. Top Banner: Active Red OR Wrap-Up Amber */}
      {callActive && (
        <div className="rounded-lg bg-red-600 text-white px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping shrink-0"></span>
            <span className="text-xs font-black uppercase tracking-wider">
              ACTIVE OUTBOUND CALL IN PROGRESS
            </span>
            <span className="text-red-200">|</span>
            <span className="text-xs font-bold">
              {farmerDisplayName} ({formatE164(farmerDisplayPhone)})
            </span>
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
                'rounded px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs',
                isMuted
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-300 font-extrabold ring-2 ring-amber-300/60'
                  : 'bg-red-700/90 hover:bg-red-800 text-white border border-red-400/50',
              )}
              title={isMuted ? 'Microphone is MUTED (Press M to Unmute)' : 'Microphone is LIVE (Press M to Mute)'}
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5 text-amber-950" /> : <Mic className="h-3.5 w-3.5 text-red-200" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
              <kbd className={cx('text-[10px] px-1 py-0.2 rounded font-mono font-normal opacity-80', isMuted ? 'bg-amber-500/40 text-amber-950' : 'bg-black/20 text-red-100')}>M</kbd>
            </button>
            <div className="bg-red-700/90 border border-red-500/40 px-3 py-1 rounded font-mono text-xs font-bold tracking-widest text-white shadow-xs">
              {formatTimer(elapsed)}
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded bg-red-700/80 hover:bg-red-800 border border-red-400/50 px-2.5 py-1 text-xs font-semibold text-white transition cursor-pointer"
              title="Minimize workstation to view call queue"
            >
              Minimize / View Queue
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
                    <span className="text-[10px] font-mono text-slate-400">
                      {context?.customer?.farmerCode || matchedQueueItem?.customer?.farmerCode || 'FARM-REF'}
                    </span>
                  </div>

                  {/* Farmer Details */}
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Farmer Name</p>
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

                    {context?.customer?.soilType && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Soil Classification</p>
                        <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200 mt-0.5">
                          {context.customer.soilType}
                        </span>
                      </div>
                    )}

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
                      {context?.relationshipOwner ? (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500 shrink-0">Relationship mgr:</span>
                          <span className="font-medium text-slate-700 text-right">
                            {context.relationshipOwner.fullName}
                          </span>
                        </div>
                      ) : null}
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
                            onClick={() => suggestGuidanceProducts(item)}
                            className="rounded px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                          >
                            + Suggest
                          </button>
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
                  <option value="INTERESTED">Interested (Follow-Up or Sales Handover)</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="NOT_ANSWERED">Not Answered / Callback Needed</option>
                </select>
              </div>

              {/* Interested Next Action Sub-Panel */}
              {disposition === 'INTERESTED' && (
                <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3 space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Interested Next Action (Required)
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="nextAction"
                        value="CALLBACK"
                        checked={nextAction === 'CALLBACK'}
                        onChange={() => setNextAction('CALLBACK')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      Schedule Callback Follow-Up
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="nextAction"
                        value="SALES"
                        checked={nextAction === 'SALES'}
                        onChange={() => setNextAction('SALES')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      Sales Handover (Assign to RM)
                    </label>
                  </div>

                  {nextAction === 'CALLBACK' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200/60">
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
                          placeholder="e.g. Discuss Phos trial quote"
                          value={followUpNote}
                          onChange={(e) => setFollowUpNote(e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-800 pt-1">
                      Converting to Sales will mark the lead converted, assign a Relationship Manager (RM), and automatically queue product guidance SMS.
                    </p>
                  )}
                </div>
              )}

              {/* Contextual Bio-Input Recommendations */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Recommended Bio-Inputs for this Call
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Grotec Advisory Formulations</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {BIO_INPUT_RECOMMENDATIONS.map((prod) => {
                    const isSuggested = suggestedProducts.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        className={cx(
                          "rounded-md border p-2.5 flex flex-col justify-between transition-colors",
                          isSuggested ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200/80 bg-slate-50/50"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900">{prod.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSuggestedProducts((prev) =>
                                  isSuggested ? prev.filter((x) => x !== prod.id) : [...prev, prod.id],
                                )
                              }
                              className={cx(
                                'rounded px-2 py-0.5 text-[10px] font-bold transition shrink-0',
                                isSuggested
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50',
                              )}
                            >
                              {isSuggested ? 'Suggested ✓' : 'Suggest'}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">{prod.category}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          Advisory ref &bull; <span className="font-mono text-slate-600 font-medium">{prod.price}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                  <>
                    <select
                      value={pendingWrapUp.nextAction}
                      onChange={(e) =>
                        setPendingWrapUp({ ...pendingWrapUp, nextAction: e.target.value as any })
                      }
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                    >
                      <option value="CALLBACK">Schedule Callback</option>
                      <option value="SALES">Sales / RM Handover</option>
                    </select>

                    {pendingWrapUp.nextAction === 'CALLBACK' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">Follow-Up Date:</span>
                        <input
                          type="date"
                          value={pendingWrapUp.followUpDate}
                          onChange={(e) =>
                            setPendingWrapUp({ ...pendingWrapUp, followUpDate: e.target.value })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                        />
                      </div>
                    )}
                  </>
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
                    <Button
                      size="sm"
                      variant="call"
                      onClick={() => startMockActiveCall('Murugan V.', '+91 98421 88321')}
                    >
                      Simulate Active Call with Murugan V. (PDF Screen 4)
                    </Button>
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
            <div className="lg:col-span-4 rounded-lg border border-slate-200/90 bg-white shadow-xs p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                Direct Dial
              </h2>
              <div className="space-y-3">
                <Input
                  inputMode="tel"
                  placeholder="Mobile number (e.g. +91 98421 88321)"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="call"
                    size="md"
                    className="w-full"
                    disabled={!manualNumber.trim() || busy}
                    onClick={() => void dial(manualNumber.trim())}
                  >
                    <PhoneCall className="h-4 w-4" /> Dial Farmer
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => startMockActiveCall('Murugan V.', '+91 98421 88321')}
                    title="Simulate active call from mockup"
                  >
                    Demo Live Call
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
    </div>
  );
}
