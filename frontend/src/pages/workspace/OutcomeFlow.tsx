import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ThumbsDown, ThumbsUp, PhoneMissed, PhoneCall, HelpCircle, ShoppingCart } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { NextAction, OutcomeRecordResult } from '../../lib/types';
import { Alert, Badge, Button } from '../../components/ui';

export interface CallOutcomeItem {
  id: string;
  code: string;
  label: string;
  category: string;
  reportingMapping?: string;
  requiresFollowUp: boolean;
  requiresNextAction: boolean;
  isActive: boolean;
}

export function OutcomeFlow({ callId, onRecorded }: { callId: string; onRecorded: (result: OutcomeRecordResult) => void }) {
  const [stage, setStage] = useState<'menu' | 'followup'>('menu');
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcomeItem | null>(null);
  const [outcomes, setOutcomes] = useState<CallOutcomeItem[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [note, setNote] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [cropInterest, setCropInterest] = useState('');
  const [expectedBookingAmount, setExpectedBookingAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    api.get<CallOutcomeItem[]>('/call-outcomes')
      .then((res) => {
        if (!unmounted && Array.isArray(res.data) && res.data.length > 0) {
          setOutcomes(res.data);
        }
      })
      .catch(() => {
        // Fallback default outcomes if endpoint offline
        if (!unmounted) {
          setOutcomes([
            { id: '1', code: 'INTERESTED', label: 'Interested', category: 'POSITIVE', requiresFollowUp: false, requiresNextAction: true, isActive: true },
            { id: '2', code: 'CALLBACK_REQUESTED', label: 'Callback Requested', category: 'POSITIVE', requiresFollowUp: true, requiresNextAction: false, isActive: true },
            { id: '3', code: 'FOLLOW_UP_REQUIRED', label: 'Follow-up Required', category: 'POSITIVE', requiresFollowUp: true, requiresNextAction: false, isActive: true },
            { id: '4', code: 'CONVERTED_ORDER', label: 'Converted / Order Generated', category: 'CONVERTED', requiresFollowUp: false, requiresNextAction: false, isActive: true },
            { id: '5', code: 'EXISTING_CUSTOMER', label: 'Existing Customer', category: 'GENERAL', requiresFollowUp: false, requiresNextAction: false, isActive: true },
            { id: '6', code: 'NOT_INTERESTED', label: 'Not Interested', category: 'NEGATIVE', requiresFollowUp: false, requiresNextAction: false, isActive: true },
            { id: '7', code: 'NOT_ANSWERED', label: 'Not Answered / Busy', category: 'RETRY', requiresFollowUp: false, requiresNextAction: false, isActive: true },
            { id: '8', code: 'WRONG_NUMBER', label: 'Wrong Number', category: 'NEGATIVE', requiresFollowUp: false, requiresNextAction: false, isActive: true },
          ]);
        }
      });
    return () => { unmounted = true; };
  }, []);

  async function submit(outcomeCode: string, nextAction?: NextAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<OutcomeRecordResult>(`/calls/${callId}/outcome`, {
        outcome: outcomeCode,
        nextAction: outcomeCode === 'INTERESTED' ? 'CALLBACK' : nextAction,
        followUpDate: date || undefined,
        followUpTime: time || undefined,
        followUpNote: note.trim() || undefined,
        productInterest: productInterest.trim() || undefined,
        cropInterest: cropInterest.trim() || undefined,
        expectedBookingAmount: expectedBookingAmount ? Number(expectedBookingAmount) : undefined,
      });
      onRecorded(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleOutcomeSelect(item: CallOutcomeItem) {
    if (item.requiresFollowUp || item.code === 'INTERESTED') {
      setSelectedOutcome(item);
      setStage('followup');
      setError(null);
    } else {
      void submit(item.code);
    }
  }

  if (stage === 'followup' && selectedOutcome) {
    return (
      <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
        <div className="flex items-center justify-between border-b pb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{selectedOutcome.label} — Follow-Up & Details</p>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">Scheduled Call</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Follow-up date *</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-xs focus:border-emerald-500 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Follow-up time *</span>
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-xs focus:border-emerald-500 focus:outline-none" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Crop Interest</span>
            <input type="text" placeholder="e.g. Paddy, Coconut" value={cropInterest} onChange={(e) => setCropInterest(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-emerald-500 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Expected Value (₹)</span>
            <input type="number" placeholder="e.g. 4500" value={expectedBookingAmount} onChange={(e) => setExpectedBookingAmount(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-emerald-500 focus:outline-none" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Product Interest</span>
          <input type="text" placeholder="e.g. Bio Jeevan PF + Sanjeevini Gel" value={productInterest} onChange={(e) => setProductInterest(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-emerald-500 focus:outline-none" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Advisory Notes / Reason *</span>
          <textarea rows={2} required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Requested quote for 5 acres Bio Jeevan demonstration next Monday" className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none" />
        </label>

        <div className="flex items-center justify-between pt-1">
          <button type="button" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" disabled={busy} onClick={() => { setStage('menu'); setError(null); }}>
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <Button disabled={busy || !date || !note.trim()} onClick={() => void submit(selectedOutcome.code, 'CALLBACK')}>
            <CheckCircle2 className="h-4 w-4" /> Save Outcome & Follow-Up
          </Button>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <div className="flex items-center justify-between border-b pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Record Call Outcome</p>
        <span className="text-[10px] text-slate-400 font-mono">Master Configurable</span>
      </div>
      <p className="text-xs text-slate-600">Select disposition to update CRM analytics and schedule required callbacks.</p>

      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {outcomes.map((item) => {
          const isPos = item.category === 'POSITIVE';
          const isConv = item.category === 'CONVERTED';
          const isNeg = item.category === 'NEGATIVE';
          const isRetry = item.category === 'RETRY';

          return (
            <button
              key={item.code}
              type="button"
              disabled={busy}
              onClick={() => handleOutcomeSelect(item)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition ${
                isConv
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : isPos
                  ? 'border-teal-200 bg-teal-50/50 text-teal-900 hover:bg-teal-100/60'
                  : isNeg
                  ? 'border-rose-200 bg-rose-50/40 text-rose-800 hover:bg-rose-100/50'
                  : isRetry
                  ? 'border-amber-200 bg-amber-50/40 text-amber-800 hover:bg-amber-100/50'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {isConv ? (
                  <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                ) : isPos ? (
                  <ThumbsUp className="h-3.5 w-3.5 text-teal-600" />
                ) : isNeg ? (
                  <ThumbsDown className="h-3.5 w-3.5 text-rose-600" />
                ) : isRetry ? (
                  <PhoneMissed className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>{item.label}</span>
              </div>
              {item.requiresFollowUp && (
                <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-normal">
                  + Follow-up
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
