import { useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ThumbsDown, ThumbsUp, PhoneMissed, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CallOutcome, NextAction, OutcomeRecordResult } from '../../lib/types';
import { Alert, Badge, Button } from '../../components/ui';

export const OUTCOME_META: Record<CallOutcome, { label: string; tone: 'green' | 'red' | 'amber' | 'slate' }> = {
  INTERESTED: { label: 'Interested', tone: 'green' },
  NOT_INTERESTED: { label: 'Not interested', tone: 'red' },
  NOT_ANSWERED: { label: 'Not answered', tone: 'amber' },
};

type Stage = 'menu' | 'callback';

export function OutcomeFlow({ callId, onRecorded }: { callId: string; onRecorded: (result: OutcomeRecordResult) => void }) {
  const [stage, setStage] = useState<Stage>('menu');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(outcome: CallOutcome, nextAction?: NextAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (outcome === 'INTERESTED' && nextAction === 'CALLBACK') {
        if (!date || !time || !note.trim()) {
          setError('A follow-up date, time and reason are required for Callback.');
          setBusy(false);
          return;
        }
      }
      const res = await api.post<OutcomeRecordResult>(`/calls/${callId}/outcome`, {
        outcome,
        nextAction: outcome === 'INTERESTED' ? 'CALLBACK' : nextAction,
        followUpDate: date || undefined,
        followUpTime: time || undefined,
        followUpNote: note.trim() || undefined,
      });
      onRecorded(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'callback') {
    return (
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Interested → Schedule Follow-Up</p>
        <p className="text-sm text-slate-600">Collect the follow-up date, time and reason — a callback task is created.</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Follow-up date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Follow-up time</span>
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Reason / note</span>
          <textarea rows={3} required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Farmer interested in bio-fertilizer demonstration" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </label>
        <div className="flex items-center justify-between">
          <button type="button" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" disabled={busy} onClick={() => { setStage('menu'); setError(null); }}>
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <Button disabled={busy || !date || !time || !note.trim()} onClick={() => void submit('INTERESTED', 'CALLBACK')}>
            <CheckCircle2 className="h-4 w-4" /> Create follow-up
          </Button>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Record outcome</p>
      <p className="text-sm text-slate-600">Exactly three outcomes. Outcome and next action are stored separately.</p>
      <div className="space-y-2">
        <Button className="w-full justify-start" disabled={busy} onClick={() => { setStage('callback'); setError(null); }}>
          <ThumbsUp className="h-4 w-4" /> Interested
        </Button>
        <Button variant="danger" className="w-full justify-start" disabled={busy} onClick={() => void submit('NOT_INTERESTED')}>
          <ThumbsDown className="h-4 w-4" /> Not interested
        </Button>
        <Button variant="outline" className="w-full justify-start" disabled={busy} onClick={() => void submit('NOT_ANSWERED')}>
          <PhoneMissed className="h-4 w-4" /> Not answered
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
