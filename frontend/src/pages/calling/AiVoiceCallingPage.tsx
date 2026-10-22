import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Sparkles,
  User,
  Users,
  Sprout,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Calendar,
  Volume2,
  VolumeX,
  FileText,
  ShieldCheck,
  ChevronRight,
  Search,
  BadgeCheck,
  Languages,
  Radio,
  ArrowRight,
  Check,
  Play,
  RotateCcw,
} from 'lucide-react';
import { PageHead } from '../../components/PageHead';
import {
  cx,
  Button,
  Card,
  Badge,
  Input,
  Select,
} from '../../components/ui';
import {
  aiCallingApi,
  type AiCallingConfig,
  type EligibleFarmer,
  type AiCallResponse,
  type DemoScenario,
  type AiCallHistoryItem,
} from '../../lib/api';

export function AiVoiceCallingPage() {
  // Config & Farmer State
  const [config, setConfig] = useState<AiCallingConfig | null>(null);
  const [farmers, setFarmers] = useState<EligibleFarmer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<EligibleFarmer | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [useCustomPhone, setUseCustomPhone] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'ta' | 'en' | 'bilingual'>('ta');
  const [selectedTopic, setSelectedTopic] = useState('PADDY_DISEASE_ALERT');
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Call Lifecycle State
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<AiCallResponse | null>(null);
  const [callStatus, setCallStatus] = useState<'IDLE' | 'DIALING' | 'RINGING' | 'CONNECTED' | 'ENDED'>('IDLE');
  const [callDuration, setCallDuration] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Transcript & Dialogue Streaming State
  const [visibleTranscriptIndex, setVisibleTranscriptIndex] = useState(0);
  const [activeScenario, setActiveScenario] = useState<DemoScenario | null>(null);
  const [extractedData, setExtractedData] = useState<{
    crop: string;
    issue: string;
    recommendedProducts: string[];
    expectedAmount: number;
    outcome: string;
  } | null>(null);

  // Call History & Order
  const [callHistory, setCallHistory] = useState<AiCallHistoryItem[]>([]);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dialogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial Load: Config & Farmers
  useEffect(() => {
    loadConfig();
    loadFarmers();
    loadHistory();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await aiCallingApi.getConfig();
      setConfig(res.data);
      // Auto-enable demo mode if live telephony is not configured
      if (!res.data.isLiveConfigured) {
        setIsDemoMode(true);
      }
    } catch {
      // Fallback presentation mode
      setIsDemoMode(true);
    }
  };

  const loadFarmers = async (search = '') => {
    try {
      const res = await aiCallingApi.getFarmers(search);
      setFarmers(res.data);
      if (res.data.length > 0 && !selectedFarmer) {
        selectFarmer(res.data[0]);
      }
    } catch {
      // Ignore in isolated view
    }
  };

  const loadHistory = async () => {
    try {
      const res = await aiCallingApi.getHistory();
      setCallHistory(res.data);
    } catch {
      // Ignore
    }
  };

  const selectFarmer = (farmer: EligibleFarmer) => {
    setSelectedFarmer(farmer);
    const phone = farmer.primaryPhone || farmer.additionalPhones[0] || '';
    setSelectedPhone(phone);
    setUseCustomPhone(false);
    setErrorMessage(null);
  };

  // 2. Call Timer
  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callStatus]);

  // 3. Presentation Dialog Streaming Engine (Simulates live real-time turn-taking voice)
  useEffect(() => {
    if (callStatus === 'CONNECTED' && activeScenario) {
      const turns = activeScenario.transcript;
      if (visibleTranscriptIndex < turns.length) {
        const currentTurn = turns[visibleTranscriptIndex];
        setIsAiSpeaking(currentTurn.speaker === 'AI_ASSISTANT');

        // Reading speed simulation: 3.5 seconds per turn
        dialogTimerRef.current = setTimeout(() => {
          setVisibleTranscriptIndex((idx) => idx + 1);
        }, 3600);
      } else if (visibleTranscriptIndex >= turns.length && turns.length > 0) {
        setIsAiSpeaking(false);
        // Call completes naturally
        dialogTimerRef.current = setTimeout(() => {
          finishCall();
        }, 2000);
      }
    }
    return () => {
      if (dialogTimerRef.current) clearTimeout(dialogTimerRef.current);
    };
  }, [callStatus, visibleTranscriptIndex, activeScenario]);

  // Auto-scroll transcript to bottom as new messages arrive
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleTranscriptIndex]);

  // 4. Trigger Call (Open Confirmation Modal First)
  const handleInitiateCallClick = () => {
    setErrorMessage(null);
    const phoneToCall = useCustomPhone ? customPhone.trim() : selectedPhone;
    if (!phoneToCall) {
      setErrorMessage('Please select or specify a valid mobile number.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // 5. Confirmed Call Start
  const startCall = async () => {
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    setErrorMessage(null);
    setOrderCreatedSuccess(null);
    setCallDuration(0);
    setVisibleTranscriptIndex(0);

    const phoneToCall = useCustomPhone ? customPhone.trim() : selectedPhone;

    try {
      setCallStatus('DIALING');
      const res = await aiCallingApi.startCall({
        customerId: selectedFarmer?.id,
        phoneNumber: phoneToCall,
        language: selectedLanguage,
        topic: selectedTopic,
        simulated: isDemoMode,
        farmerName: selectedFarmer?.fullName || 'Distinguished Farmer',
      });

      setActiveCall(res.data);

      if (res.data.isSimulated && res.data.scenario) {
        setActiveScenario(res.data.scenario);
        setExtractedData({
          crop: res.data.scenario.crop,
          issue: res.data.scenario.issue,
          recommendedProducts: res.data.scenario.recommendedProducts,
          expectedAmount: res.data.scenario.expectedAmount,
          outcome: 'INTERESTED',
        });

        // Simulate realistic telephone ringing delay before connecting
        setTimeout(() => {
          setCallStatus('RINGING');
        }, 1200);

        setTimeout(() => {
          setCallStatus('CONNECTED');
          setVisibleTranscriptIndex(1); // First greeting visible
        }, 3000);
      } else {
        // Live telephony call
        setCallStatus('DIALING');
        pollLiveCallStatus(res.data.id);
      }
    } catch (err: any) {
      setCallStatus('IDLE');
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to start AI call');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll live call if connected via actual Vapi webhook
  const pollLiveCallStatus = (callId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await aiCallingApi.getStatus(callId);
        if (res.data.status === 'RINGING') setCallStatus('RINGING');
        if (res.data.status === 'CONNECTED') setCallStatus('CONNECTED');
        if (res.data.status === 'ENDED') {
          setCallStatus('ENDED');
          clearInterval(interval);
          loadHistory();
        }
      } catch {
        // Ignore
      }
    }, 2000);
  };

  // 6. End / Hangup Call
  const hangupCall = async () => {
    if (dialogTimerRef.current) clearTimeout(dialogTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    finishCall();
  };

  const finishCall = async () => {
    setCallStatus('ENDED');
    setIsAiSpeaking(false);

    if (activeCall && activeScenario) {
      try {
        await aiCallingApi.completeCall(activeCall.id, {
          outcome: 'INTERESTED',
          nextAction: 'SALES',
          productInterest: activeScenario.recommendedProducts.join(', '),
          cropInterest: activeScenario.crop,
          expectedBookingAmount: activeScenario.expectedAmount,
          summary: `AI voice consultation completed. Farmer reported: ${activeScenario.issue}. Recommended: ${activeScenario.recommendedProducts.join(', ')}. Requested direct delivery on next route.`,
          transcriptText: activeScenario.transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
          scheduleFollowUp: true,
        });
        loadHistory();
      } catch {
        // Safe in demo
      }
    }
  };

  // 7. Order Confirmation Handlers
  const handleConfirmOrder = async () => {
    if (!activeCall || !selectedFarmer || !extractedData) return;
    try {
      setIsLoading(true);
      const res = await aiCallingApi.confirmOrder({
        callId: activeCall.id,
        customerId: selectedFarmer.id,
        totalAmount: extractedData.expectedAmount,
        notes: `Confirmed from Vapi AI Voice Calling consultation. Recommended: ${extractedData.recommendedProducts.join(', ')}.`,
      });
      setIsOrderModalOpen(false);
      setOrderCreatedSuccess(`Sales Order #${res.data.orderNumber} successfully registered with COD field delivery!`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to create sales order');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="AI Voice Calling — GROTEC FarmerOS"
        description="Presentation-ready Vapi AI multilingual voice calling, agronomy consultations, and automated order intake."
      />

      {/* HEADER & PRESENTATION STATUS BANNER */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                Vapi AI Telephony Engine
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-200">
                <Languages className="h-3.5 w-3.5" />
                தமிழ் (Tamil-First) & English
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              AI Voice Calling & Agronomy Outreach
            </h1>
            <p className="max-w-2xl text-sm text-emerald-100/80">
              Interactive conversational AI for proactive crop disease screening, Tamil advisory consultations,
              and structured farmer order conversion.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-black/30 p-1.5 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setIsDemoMode(true)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                  isDemoMode ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white',
                )}
              >
                Presentation Demo Mode
              </button>
              <button
                type="button"
                onClick={() => setIsDemoMode(false)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                  !isDemoMode ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white',
                )}
              >
                Live Vapi Telephony
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {isDemoMode
                ? 'Simulation active: High-fidelity Tamil audio dialogue'
                : config?.isLiveConfigured
                ? 'Live carrier route connected via Vapi API'
                : 'Vapi keys not set on server; running demo simulation'}
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {orderCreatedSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{orderCreatedSuccess}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => setOrderCreatedSuccess(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => setErrorMessage(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* MAIN CONSOLE GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* =========================================================================
            LEFT COLUMN: FARMER SELECTION & CALL CONFIGURATION (4 COLS)
           ========================================================================= */}
        <div className="space-y-6 lg:col-span-4">
          {/* Farmer Picker Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Users className="h-4 w-4 text-emerald-600" />
                Select Farmer
              </h2>
              <span className="text-xs text-slate-400">{farmers.length} Available</span>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, GF code, phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadFarmers(e.target.value);
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Farmer Quick List */}
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {farmers.map((farmer) => {
                const isSelected = selectedFarmer?.id === farmer.id;
                return (
                  <button
                    key={farmer.id}
                    type="button"
                    onClick={() => selectFarmer(farmer)}
                    className={cx(
                      'w-full text-left rounded-lg p-2.5 transition-all text-xs flex items-center justify-between border',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium ring-1 ring-emerald-500/20'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 truncate">{farmer.fullName}</span>
                        {farmer.farmerCode && (
                          <span className="text-[10px] text-slate-400 font-mono">({farmer.farmerCode})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{farmer.primaryPhone || 'No phone'}</span>
                        <span>•</span>
                        <span className="truncate">{farmer.location}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Farmer Details Panel */}
          {selectedFarmer && (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Target Profile
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {selectedFarmer.relationshipStage || 'ACTIVE PROSPECT'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedFarmer.fullName}</h3>
                    <p className="font-mono text-xs text-emerald-700">{selectedFarmer.farmerCode}</p>
                  </div>
                  <Badge tone="green">Verified Farmer</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{selectedFarmer.crops.join(', ') || 'Paddy / Sugarcane'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="truncate">{selectedFarmer.location}</span>
                  </div>
                </div>

                {/* Phone Selector */}
                <div className="pt-3 border-t border-emerald-100 space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                    Select Dialing Number:
                  </label>
                  <div className="space-y-1">
                    {selectedFarmer.primaryPhone && (
                      <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="phone-select"
                          checked={!useCustomPhone && selectedPhone === selectedFarmer.primaryPhone}
                          onChange={() => {
                            setUseCustomPhone(false);
                            setSelectedPhone(selectedFarmer.primaryPhone || '');
                          }}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{selectedFarmer.primaryPhone} (Primary Verified)</span>
                      </label>
                    )}
                    {selectedFarmer.additionalPhones.map((sec, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="phone-select"
                          checked={!useCustomPhone && selectedPhone === sec}
                          onChange={() => {
                            setUseCustomPhone(false);
                            setSelectedPhone(sec);
                          }}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{sec} (Secondary Contact #{idx + 1})</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="phone-select"
                        checked={useCustomPhone}
                        onChange={() => setUseCustomPhone(true)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Use Controlled Test Number (For Live Calling)</span>
                    </label>
                  </div>

                  {useCustomPhone && (
                    <div className="pt-2">
                      <input
                        type="tel"
                        placeholder="+919876543210 (Indian Mobile)"
                        value={customPhone}
                        onChange={(e) => setCustomPhone(e.target.value)}
                        className="w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Consultation Topic & Language Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Consultation Settings
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Outreach Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as any)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="ta">தமிழ் — Tamil (Native Tamil Nadu Voice)</option>
                <option value="bilingual">Bilingual — Tamil + English Technical Terms</option>
                <option value="en">English — Indian Agro Agronomy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Agronomy Topic
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="PADDY_DISEASE_ALERT">Rice Paddy: Sheath Blight & Leaf Yellowing (இலைக்கருகல்)</option>
                <option value="SUGARCANE_RATOON_GROWTH">Sugarcane: Ratoon Tillering & Cane Girth (கரும்பு வளர்ச்சி)</option>
                <option value="CHILLI_PEST_PROTECTION">Chilli: Thrips & Leaf Curl Protection (மிளகாய் இலைப்பேண்)</option>
              </select>
            </div>

            {/* CALL ACTION BUTTON */}
            <div className="pt-2">
              {callStatus === 'IDLE' || callStatus === 'ENDED' ? (
                <button
                  type="button"
                  onClick={handleInitiateCallClick}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <PhoneCall className="h-4 w-4" />
                  {isLoading ? 'Connecting...' : 'Start AI Voice Call'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={hangupCall}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-[0.98] cursor-pointer"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Call ({formatSeconds(callDuration)})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: ACTIVE CALL CONSOLE, WAVEFORM & TRANSCRIPT (8 COLS)
           ========================================================================= */}
        <div className="space-y-6 lg:col-span-8">
          {/* Active Call Status Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    'flex h-12 w-12 items-center justify-center rounded-full text-white transition-all',
                    callStatus === 'CONNECTED'
                      ? 'bg-emerald-600 ring-4 ring-emerald-100'
                      : callStatus === 'DIALING' || callStatus === 'RINGING'
                      ? 'bg-amber-500 ring-4 ring-amber-100 animate-pulse'
                      : 'bg-slate-300',
                  )}
                >
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedFarmer?.fullName || 'GROTEC AI Caller'}
                    </h3>
                    <Badge
                      tone={
                        callStatus === 'CONNECTED'
                          ? 'green'
                          : callStatus === 'RINGING' || callStatus === 'DIALING'
                          ? 'amber'
                          : 'slate'
                      }
                    >
                      {callStatus === 'CONNECTED'
                        ? 'CALL IN PROGRESS'
                        : callStatus === 'RINGING'
                        ? 'RINGING (FARMER DEVICE)...'
                        : callStatus === 'DIALING'
                        ? 'INITIATING DIALER...'
                        : callStatus === 'ENDED'
                        ? 'CALL COMPLETED'
                        : 'READY TO CALL'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Target: {useCustomPhone ? customPhone : selectedPhone || 'Select a contact'}
                  </p>
                </div>
              </div>

              {/* Call Timer & Audio Visualization */}
              <div className="flex items-center gap-4">
                {callStatus === 'CONNECTED' && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 border border-emerald-200">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
                    <span>{formatSeconds(callDuration)}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={isAudioMuted ? 'Unmute' : 'Mute Voice Audio'}
                >
                  {isAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* LIVE AUDIO WAVEFORM VISUALIZATION */}
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-slate-950 p-6 text-white shadow-inner">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    callStatus === 'CONNECTED' ? 'bg-emerald-400 animate-ping' : 'bg-slate-600',
                  )}
                />
                <span>
                  {callStatus === 'CONNECTED'
                    ? isAiSpeaking
                      ? 'AI Assistant Speaking (Tamil Voice Synthesis)'
                      : 'Farmer Speaking (Speech-to-Text Recognition)'
                    : callStatus === 'RINGING'
                    ? 'Awaiting Answer...'
                    : callStatus === 'ENDED'
                    ? 'Consultation Concluded'
                    : 'System Idle'}
                </span>
              </div>

              {/* Audio Waveform Bars */}
              <div className="flex h-12 items-center gap-1 px-4">
                {[12, 28, 45, 18, 55, 32, 60, 42, 25, 48, 65, 30, 20, 52, 38, 22].map((height, i) => (
                  <div
                    key={i}
                    style={{
                      height:
                        callStatus === 'CONNECTED'
                          ? isAiSpeaking
                            ? `${Math.max(8, (height * (1 + Math.sin((callDuration + i) * 1.5))) / 2)}px`
                            : '6px'
                          : '4px',
                    }}
                    className={cx(
                      'w-1.5 rounded-full transition-all duration-150',
                      callStatus === 'CONNECTED'
                        ? isAiSpeaking
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                          : 'bg-blue-400'
                        : 'bg-slate-700',
                    )}
                  />
                ))}
              </div>
            </div>

            {/* LIVE CONVERSATION TRANSCRIPT STREAM */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  Live Bilingual Transcript Stream
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Tamil Primary & English Subtitles</span>
              </div>

              <div className="h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                {activeScenario && visibleTranscriptIndex > 0 ? (
                  activeScenario.transcript.slice(0, visibleTranscriptIndex).map((line, idx) => {
                    const isAi = line.speaker === 'AI_ASSISTANT';
                    return (
                      <div
                        key={idx}
                        className={cx(
                          'flex flex-col gap-1 rounded-lg p-3 text-xs transition-all shadow-2xs',
                          isAi
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-200/80 mr-8'
                            : 'bg-white text-slate-800 border border-slate-200/80 ml-8',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cx(
                              'font-bold text-[11px] uppercase tracking-wider',
                              isAi ? 'text-emerald-800' : 'text-blue-700',
                            )}
                          >
                            {isAi ? '🤖 GROTEC Agronomy AI' : `👨‍🌾 ${selectedFarmer?.fullName || 'Farmer'}`}
                          </span>
                          <span className="text-[10px] text-slate-400">00:{String(idx * 4).padStart(2, '0')}</span>
                        </div>
                        {/* Tamil Speech */}
                        <p className="font-semibold text-slate-900 leading-relaxed text-sm">
                          {line.text}
                        </p>
                        {/* English Subtitle */}
                        <p className="text-[11px] text-slate-500 italic border-t border-slate-200/50 pt-1 mt-1">
                          {line.en}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <Phone className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs">No active call. Select a farmer and click "Start AI Voice Call" to view live dialogue.</p>
                  </div>
                )}
                <div ref={transcriptBottomRef} />
              </div>
            </div>
          </div>

          {/* =========================================================================
              CALL SUMMARY & EXTRACTED FARMER INTENT PANEL
             ========================================================================= */}
          {extractedData && (
            <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    AI Agronomy Analysis & Structured Extracted Intent
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  Confidence: 98.4%
                </span>
              </div>

              {/* Extraction Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Detected Crop
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{extractedData.crop}</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Diagnosed Issue
                  </span>
                  <p className="text-sm font-bold text-amber-700 mt-1 truncate" title={extractedData.issue}>
                    {extractedData.issue}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Recommended Products
                  </span>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {extractedData.recommendedProducts.join(', ')}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Order Intent
                  </span>
                  <p className="text-sm font-bold text-emerald-600 mt-1">
                    ₹{extractedData.expectedAmount.toLocaleString('en-IN')} (COD)
                  </p>
                </div>
              </div>

              {/* Conversion Action Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-emerald-50/80 p-4 border border-emerald-200">
                <div className="text-xs text-emerald-950">
                  <span className="font-bold">Next Recommended Action:</span> Farmer agreed to direct delivery of{' '}
                  {extractedData.recommendedProducts.join(' + ')}. Convert to confirmed Sales Order.
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Confirm & Create Sales Order
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              RECENT AI VOICE CALL HISTORY
             ========================================================================= */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Recent AI Voice Calling Activity
              </h3>
              <Button size="xs" variant="outline" onClick={loadHistory}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-medium">
                    <th className="py-2">Time</th>
                    <th className="py-2">Farmer</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2">Crop / Interest</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Outcome</th>
                    <th className="py-2">Intent Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {callHistory.length > 0 ? (
                    callHistory.slice(0, 5).map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50">
                        <td className="py-2 font-mono text-[11px] text-slate-500">
                          {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 font-medium text-slate-900">
                          {call.farmerName || 'Farmer'}
                        </td>
                        <td className="py-2 font-mono text-[11px]">{call.phoneNumber}</td>
                        <td className="py-2">{call.cropInterest || 'Paddy'}</td>
                        <td className="py-2">
                          <Badge tone={call.status === 'CONNECTED' ? 'green' : 'slate'}>
                            {call.status}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <span className="font-semibold text-emerald-700">
                            {call.outcome || 'INTERESTED'}
                          </span>
                        </td>
                        <td className="py-2 font-semibold">
                          {call.expectedBookingAmount ? `₹${call.expectedBookingAmount}` : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        No previous AI call sessions recorded. Start an AI call above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONFIRMATION DIALOG MODAL (Phase 5: Safety & Explicit Action)
         ========================================================================= */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Outbound Call</h3>
                <p className="text-xs text-slate-500">Telecom compliance & consent verification</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer:</span>
                  <span className="font-bold text-slate-900">{selectedFarmer?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination Number:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {useCustomPhone ? customPhone : selectedPhone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Calling Mode:</span>
                  <span className="font-bold text-slate-900">
                    {isDemoMode ? 'Presentation Demonstration' : 'Live Carrier Outbound (Vapi)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Language Voice:</span>
                  <span className="font-bold text-slate-900">Tamil Nadu (Bilingual)</span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200">
                <span className="font-bold block mb-1">Safety Notice:</span>
                This system initiates an automated outbound call for agronomy support. By clicking Proceed, you verify
                that the recipient is an authorized test recipient and has consented to advisory communications.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={startCall}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Proceed with AI Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ORDER CREATION MODAL (Phase 5: Require Confirmation for Actual Orders)
         ========================================================================= */}
      {isOrderModalOpen && extractedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Sales Order Conversion
                </h3>
              </div>
              <Badge tone="green">COD Delivery</Badge>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                The following order will be generated in GROTEC FarmerOS based on the AI voice consultation:
              </p>

              <div className="rounded-lg bg-slate-50 p-3 space-y-2 border border-slate-100">
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Customer:</span>
                  <span>{selectedFarmer?.fullName} ({selectedFarmer?.farmerCode})</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Village / Route:</span>
                  <span>{selectedFarmer?.location}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Recommended Inputs:</span>
                  <span className="font-medium text-emerald-800">{extractedData.recommendedProducts.join(', ')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-sm">
                  <span>Estimated Total (incl. 5% GST):</span>
                  <span className="text-emerald-600">₹{(extractedData.expectedAmount * 1.05).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsOrderModalOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {isLoading ? 'Creating Order...' : 'Confirm Order & Dispatch Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
