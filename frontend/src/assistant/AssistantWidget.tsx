import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X, Sprout, Loader2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { AssistantChatResponse, AssistantSource } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { useAssistantContext } from './AssistantContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: AssistantSource[];
  tone?: 'ok' | 'error' | 'muted';
}

export function AssistantWidget() {
  const { hasPermission } = useAuth();
  const { context } = useAssistantContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const conversationId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!hasPermission('assistant.use')) return null;

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    if (!conversationId.current) conversationId.current = crypto.randomUUID();

    setMessages((m) => [...m, { role: 'user', content: text }]);
    setDraft('');
    setSending(true);
    try {
      const res = await api.post<AssistantChatResponse>('/assistant/chat', {
        message: text,
        conversationId: conversationId.current,
        ...(context?.customerId ? { customerId: context.customerId } : {}),
        ...(context?.cropId ? { cropId: context.cropId } : {}),
      });
      const body = res.data;
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: body.answer,
          sources: body.sources,
          tone: body.status === 'unavailable' ? 'muted' : 'ok',
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err), tone: 'error' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <section
          aria-label="Ask Grotec Assistant"
          className="flex h-[30rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 bg-brand-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Ask Grotec Assistant</p>
                {context?.customerName ? (
                  <p className="truncate text-[11px] leading-tight text-brand-100">
                    Helping {context.customerName}
                    {context.cropId ? ' · crop context attached' : ''}
                  </p>
                ) : (
                  <p className="text-[11px] leading-tight text-brand-100">Crop & product guidance</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} title="Close assistant" className="rounded-md p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-400">
                Ask anything, e.g. “what do I recommend for leaf yellowing on paddy?”
                <br />
                Answers cite the crop/product guidance used.
              </p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-sm text-white'
                        : 'max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm'
                    }
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.sources && message.sources.length > 0 ? (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sources</p>
                        {message.sources.map((source) => (
                          <p key={source.id} className="mb-1 flex items-start gap-1.5 text-xs text-slate-500">
                            <Sprout className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                            <span>
                              <span className="font-medium text-slate-600">{source.cropName}</span>
                              {source.recommendedProducts.length > 0 ? ` → ${source.recommendedProducts.join(', ')}` : ''}
                            </span>
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-400 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            ) : null}
          </div>

          {/* Composer */}
          <form onSubmit={send} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Ask about a crop problem…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                title="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">Answers come from GROTEC guidance — always confirm with the product label.</p>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Ask Grotec Assistant"
        className="flex items-center gap-2 rounded-full bg-brand-600 py-3 pl-3 pr-5 text-white shadow-lg transition-colors hover:bg-brand-700"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-semibold">Ask Grotec Assistant</span>
      </button>
    </div>
  );
}
