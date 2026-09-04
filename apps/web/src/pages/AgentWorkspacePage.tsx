import { useEffect, useMemo, useState } from 'react';
import { Phone, PhoneCall, PhoneOff, UserPlus, Sprout, StickyNote, RotateCcw, History, Loader2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Call, CallContext, CustomerDetail, QueueItem } from '../lib/types';
import { formatE164, formatDate } from '../lib/format';
import { Alert, Badge, Button, Card, CardHeader, Input, Spinner, cx } from '../components/ui';
import { NewCustomerModal } from './customers/NewCustomerModal';
import { useAssistantContext } from '../assistant/AssistantContext';

const ACTIVE_STATUSES = ['DIALING', 'RINGING', 'CONNECTED'];
const isActive = (status?: string) => status != null && ACTIVE_STATUSES.includes(status);

function callStatusTone(status: string) {
  if (status === 'CONNECTED') return 'green' as const;
  if (status === 'DIALING' || status === 'RINGING') return 'amber' as const;
  if (status === 'ENDED') return 'slate' as const;
  return 'red' as const;
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AgentWorkspacePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [manualNumber, setManualNumber] = useState('');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [context, setContext] = useState<CallContext | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { setContext: setAssistantContext } = useAssistantContext();

  const callActive = isActive(activeCall?.status);

  useEffect(() => {
    let cancelled = false;
    api
      .get<QueueItem[]>('/calls/queue')
      .then((res) => {
        if (!cancelled) setQueue(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setQueueLoading(false);
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

  // Status polling while the call is live (server reconciles with the provider).
  useEffect(() => {
    if (!activeCall || !isActive(activeCall.status)) return;
    const id = window.setInterval(() => {
      void refreshCall(activeCall.id).then((call) => {
        if (!call) return;
        if (!isActive(call.status)) {
          void api.get<QueueItem[]>('/calls/queue').then((res) => setQueue(res.data)).catch(() => undefined);
        }
        const customerKnown = context?.customer?.id === call.customerId;
        if (call.customerId && !customerKnown) {
          void loadContext(call.id);
        }
      });
    }, 1500);
    return () => window.clearInterval(id);
  }, [activeCall, context]);

  // Elapsed timer while the call is live.
  useEffect(() => {
    if (!activeCall) return;
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(activeCall.startedAt).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeCall?.id, activeCall?.startedAt]);

  // Auto-pass the active call's farmer + crop into the assistant widget so a
  // telecaller can ask “what do I recommend for this crop?” without retyping it.
  useEffect(() => {
    const customer = context?.customer ?? null;
    if (activeCall && customer) {
      setAssistantContext({
        customerId: customer.id,
        cropId: customer.crops[0]?.crop.id,
        customerName: customer.fullName,
      });
    } else {
      setAssistantContext(null);
    }
  }, [activeCall, context?.customer, setAssistantContext]);

  async function dial(phoneNumber: string, customerId?: string, leadId?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Call>('/calls', { phoneNumber, customerId, leadId });
      setActiveCall(res.data);
      setContext(null);
      setManualNumber('');
      setElapsed(0);
      await loadContext(res.data.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function endCall() {
    if (!activeCall || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Call>(`/calls/${activeCall.id}/end`);
      setActiveCall(res.data);
      void api.get<QueueItem[]>('/calls/queue').then((q) => setQueue(q.data)).catch(() => undefined);
      void loadContext(activeCall.id); // final state in the history panel
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!activeCall || !noteDraft.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await api.post(`/calls/${activeCall.id}/notes`, { body: noteDraft.trim() });
      setNoteDraft('');
      const res = await api.get<Call>(`/calls/${activeCall.id}`);
      setActiveCall(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  }

  const dialableNumber = manualNumber.trim();

  return (
    <div className="flex h-screen flex-col">
      {/* Workspace header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-slate-800">Agent Calling Workspace</h1>
          {activeCall ? (
            <Badge tone={callStatusTone(activeCall.status)}>
              {activeCall.status.replace('_', ' ')}
              {isActive(activeCall.status) ? ` · ${formatTimer(elapsed)}` : ''}
            </Badge>
          ) : (
            <Badge tone="slate">Idle — pick a lead to dial</Badge>
          )}
        </div>
        <p className="hidden text-xs text-slate-400 md:block">Auto-dial through your SIM · provider behind internal abstraction</p>
      </header>

      {showNewCustomer ? (
        <NewCustomerModal
          initialPhone={activeCall?.customerId ? undefined : (context?.call.phoneNumber ?? '')}
          onClose={() => setShowNewCustomer(false)}
          onCreated={() => {
            setShowNewCustomer(false);
            if (activeCall) void loadContext(activeCall.id);
          }}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[320px_1fr_380px]">
        {/* LEFT — calling queue */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader title="Calling queue" action={<Badge tone="slate">{queue.length}</Badge>} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {queueLoading ? (
              <Spinner label="Loading queue…" />
            ) : queue.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Nothing assigned to you yet.
                <br />
                Try dialing any number below.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <li key={item.leadId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{item.customer.fullName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {item.customer.farmerCode ?? '—'} · {item.customer.primaryPhone ? formatE164(item.customer.primaryPhone) : 'no phone'}
                        </p>
                        {item.customer.crops.length > 0 ? (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            <Sprout className="mr-1 inline h-3 w-3" />
                            {item.customer.crops.map((c) => `${c.crop.name} (${c.acreage} ${c.unit})`).join(', ')}
                          </p>
                        ) : null}
                        {item.lastCall ? (
                          <p className="mt-1 text-xs text-slate-400">
                            Last: <Badge tone={callStatusTone(item.lastCall.status)}>{item.lastCall.status.replace('_', ' ')}</Badge>
                            <span className="ml-1">{formatDate(item.lastCall.startedAt)}</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">Not called yet</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isActive(activeCall?.status) ? 'outline' : 'primary'}
                        disabled={busy}
                        onClick={() => void dial(item.customer.primaryPhone ?? item.customer.id, item.customer.id, item.leadId)}
                        title={item.customer.primaryPhone ? `Dial ${formatE164(item.customer.primaryPhone)}` : 'Customer has no phone'}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Dial
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dial any number</p>
              <div className="flex gap-2">
                <Input inputMode="tel" placeholder="Mobile number" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dialableNumber && void dial(dialableNumber)} />
                <Button disabled={!dialableNumber || busy || isActive(activeCall?.status)} onClick={() => void dial(dialableNumber)}>
                  <PhoneCall className="h-4 w-4" />
                  Call
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* CENTER — call controls */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader title="Call" />
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
            {error ? (
              <div className="w-full max-w-sm">
                <Alert tone="error">{error}</Alert>
              </div>
            ) : null}

            {!activeCall ? (
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Phone className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium text-slate-700">Ready to call</p>
                <p className="mt-1 text-sm text-slate-500">Pick a lead from the queue on the left, or dial any number. Customer context appears here.</p>
              </div>
            ) : (
              <div className="w-full max-w-sm text-center">
                <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
                  {context?.customer ? (
                    <span>{context.customer.fullName}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <UserPlus className="h-4 w-4" /> New number
                    </span>
                  )}
                </div>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{formatE164(activeCall.phoneNumber)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {activeCall.provider} · {activeCall.providerCallId.slice(0, 14)}…
                </p>

                <div className="my-8 flex items-center justify-center">
                  <div
                    className={cx(
                      'relative flex h-28 w-28 items-center justify-center rounded-full border-4',
                      activeCall.status === 'CONNECTED' ? 'border-green-200 bg-green-50 text-green-600' : activeCall.status === 'ENDED' || activeCall.status === 'NOT_ANSWERED' ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-amber-200 bg-amber-50 text-amber-600',
                    )}
                  >
                    {activeCall.status === 'CONNECTED' ? <Phone className="h-9 w-9 animate-pulse" /> : <Phone className="h-9 w-9" />}
                    <span className="absolute -bottom-8 whitespace-nowrap text-xs font-medium text-slate-600">{activeCall.status.replace('_', ' ')}</span>
                  </div>
                </div>

                {isActive(activeCall.status) ? (
                  <Button variant="danger" size="md" onClick={() => void endCall()} disabled={busy}>
                    <PhoneOff className="h-4 w-4" /> End call
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">
                      {activeCall.status === 'NOT_ANSWERED' ? 'Call not answered.' : activeCall.status === 'FAILED' ? 'Call failed.' : 'Call finished.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void dial(activeCall.phoneNumber, activeCall.customerId ?? undefined, activeCall.leadId ?? undefined)} disabled={busy}>
                      <RotateCcw className="h-3.5 w-3.5" /> Call again
                    </Button>
                  </div>
                )}

                {/* Note composer — always available on the call */}
                <div className="mt-10 text-left">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <StickyNote className="mr-1 inline h-3 w-3" /> Call note
                  </p>
                  <textarea
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    rows={3}
                    placeholder="What did the farmer say?"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => void addNote()} disabled={!noteDraft.trim() || savingNote}>
                      {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
                      Add note
                    </Button>
                  </div>
                  {activeCall.notes.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {activeCall.notes.map((note) => (
                        <li key={note.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <p>{note.body}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {note.author.fullName} · {formatDate(note.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT — customer context */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader title="Customer context" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!activeCall ? (
              <EmptyPanel text="Start a call to see the customer's profile, crops, history and notes." />
            ) : context?.customer ? (
              <ProfilePanel customer={context.customer} history={context.history ?? []} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <UserPlus className="h-6 w-6" />
                </div>
                <p className="text-sm text-slate-600">This number is not on any customer record.</p>
                <p className="text-xs text-slate-400">Creating the customer keeps the call active — nothing is interrupted.</p>
                <Button onClick={() => setShowNewCustomer(true)}>
                  <UserPlus className="h-4 w-4" /> Create customer
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
      <p>{text}</p>
    </div>
  );
}

function ProfilePanel({ customer, history }: { customer: CustomerDetail; history: Call[] }) {
  const primary = customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
  const location = customer.locations.find((l) => l.isPrimary) ?? customer.locations[0];
  const rows: Array<{ label: string; value: string | null }> = [];
  if (location) {
    const parts = [location.village, location.taluk, location.district, location.state].filter(Boolean);
    rows.push({ label: 'Location', value: parts.join(', ') || null });
  }
  rows.push({ label: 'Farmer ID', value: customer.farmerCode });

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-base font-semibold text-slate-900">{customer.fullName}</p>
        <p className="text-xs text-slate-500">{customer.phones.length > 0 ? formatE164(primary?.phone ?? '') : 'No phone'}</p>
        {customer.phones.length > 1 ? (
          <p className="mt-0.5 flex flex-wrap gap-1">
            {customer.phones
              .filter((p) => !p.isPrimary)
              .map((p) => (
                <span key={p.id} className="text-xs text-slate-400">
                  alt: {formatE164(p.phone)}
                </span>
              ))}
          </p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <dl className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="text-right font-medium text-slate-700">{row.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {customer.crops.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Crops & acreage</p>
          <div className="flex flex-wrap gap-1.5">
            {customer.crops.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                <Sprout className="h-3 w-3" />
                {c.crop.name} · {c.acreage} {c.unit}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {customer.leads.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lead / source</p>
          <ul className="space-y-1.5">
            {customer.leads.slice(0, 3).map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs">
                <span className="text-slate-600">{lead.source ?? '—'}</span>
                <span className="flex items-center gap-2">
                  {lead.currentOwner ? <span className="text-slate-400">{lead.currentOwner.fullName}</span> : null}
                  <Badge tone={lead.status === 'OPEN' ? 'green' : 'slate'}>{lead.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <History className="h-3 w-3" /> Call history
        </p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">No previous calls.</p>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 6).map((call) => (
              <li key={call.id} className="rounded-md border border-slate-100 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">{formatE164(call.phoneNumber)}</span>
                  <Badge tone={callStatusTone(call.status)}>{call.status.replace('_', ' ')}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(call.startedAt)}</p>
                {call.notes.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    <StickyNote className="mr-0.5 inline h-3 w-3 text-slate-400" />
                    {call.notes[0]?.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Follow-ups arrive with Month 3 call outcomes — empty state for now. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Follow-ups</p>
        <p className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-400">No follow-ups yet — call outcomes arrive with Month 3.</p>
      </div>
    </div>
  );
}