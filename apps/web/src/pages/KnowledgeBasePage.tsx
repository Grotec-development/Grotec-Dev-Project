import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { BookOpen, Pencil, Plus, Search, Sprout, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Crop, KnowledgeGuidance } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { PROBLEM_TYPES, PROBLEM_TYPE_TONES, PROBLEM_TYPE_LABELS, isProblemType, type ProblemType } from '../lib/reference';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, cx } from '../components/ui';

/**
 * Knowledge Base: crop → problem/issue → recommended Grotec product(s) + usage.
 * The exact data the AI Assistant retrieves from (`crop_product_guidance`) — a
 * browsable/curatable table for the telecaller quick-lookup workflow.
 * View/search = assistant.use; content management = assistant.manage.
 */
export function KnowledgeBasePage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('assistant.manage');

  const [q, setQ] = useState('');
  const [cropId, setCropId] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProblemType | ''>('');
  const [showInactive, setShowInactive] = useState(false);
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; row: KnowledgeGuidance } | null>(null);

  const cropsQuery = useQuery({
    queryKey: ['crops'],
    queryFn: async () => (await api.get<Crop[]>('/crops')).data,
  });

  const queryKey = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (cropId) params.set('cropId', cropId);
    if (canManage && showInactive) params.set('includeInactive', 'true');
    return params.toString();
  }, [q, cropId, canManage, showInactive]);

  const rowsQuery = useQuery({
    queryKey: ['guidance', queryKey, canManage],
    queryFn: async () => (await api.get<KnowledgeGuidance[]>(`/assistant/guidance${queryKey ? `?${queryKey}` : ''}`)).data,
  });

  const toggleActive = useMutation({
    mutationFn: async (row: KnowledgeGuidance) => {
      await api.patch(`/assistant/guidance/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['guidance'] }),
  });

  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission('assistant.use')) return <Navigate to="/restricted" replace />;

  const rows = rowsQuery.data ?? [];
  const crops = cropsQuery.data ?? [];
  const visibleRows = typeFilter ? rows.filter((row) => row.problemType === typeFilter) : rows;

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <BookOpen className="h-6 w-6 text-brand-600" />
            Knowledge Base
          </h1>
          <p className="text-sm text-slate-500">
            Crop → problem → recommended Grotec product with usage. The same records the AI Assistant retrieves for mid-call questions.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditor({ mode: 'create' })}>
            <Plus className="h-4 w-4" /> New entry
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="w-64 pl-8" placeholder="Search crop, problem or product…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cropId} onChange={(e) => setCropId(e.target.value)} className="w-52">
          <option value="">All crops</option>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </Select>
        {canManage ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Show retired
          </label>
        ) : null}
      </div>

      {/* Problem/issue type filter — the mid-call browse path (PRD §6.5.1–6.5.3) */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTypeFilter('')}
          className={cx(
            'rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors',
            typeFilter === '' ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
          )}
        >
          All issues · {rows.length}
        </button>
        {PROBLEM_TYPES.map((type) => {
          const count = rows.filter((row) => row.problemType === type).length;
          const active = typeFilter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(active ? '' : type)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors',
                active ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {PROBLEM_TYPE_TONES[type].label} · {count}
            </button>
          );
        })}
      </div>

      {rowsQuery.isError ? <Alert tone="error">{errorMessage(rowsQuery.error)}</Alert> : null}

      <Card>
        {rowsQuery.isPending ? (
          <Spinner label="Loading Knowledge Base…" />
        ) : visibleRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            No entries found{typeFilter ? ' for this problem type' : ''}
            {canManage ? ' — add the first crop/product recommendation' : ''}.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                      <Sprout className="h-3 w-3" />
                      {row.crop.name}
                    </span>
                    {isProblemType(row.problemType) ? (
                      <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', PROBLEM_TYPE_TONES[row.problemType].cls)}>
                        {PROBLEM_TYPE_TONES[row.problemType].label}
                      </span>
                    ) : null}
                    {row.crop.category ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {row.crop.category.replace('_', ' ').toLowerCase()}
                      </span>
                    ) : null}
                    {!row.isActive ? <Badge tone="slate">retired</Badge> : null}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-500">
                    <span className="text-slate-400">Problem:</span>{' '}
                    {row.problemKeywords.map((k) => (
                      <span key={k} className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                        {k}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-700">
                    <span className="text-slate-400">Recommended:</span>{' '}
                    {row.recommendedProducts.map((p) => (
                      <span key={p} className="mr-1.5 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                        {p}
                      </span>
                    ))}
                  </p>
                  {row.usageGuidance ? <p className="mt-1.5 text-sm text-slate-600">{row.usageGuidance}</p> : null}
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setEditor({ mode: 'edit', row })}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={row.isActive ? 'ghost' : 'outline'}
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(row)}
                    >
                      {row.isActive ? 'Retire' : 'Restore'}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editor ? (
        <GuidanceModal
          crops={crops}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void queryClient.invalidateQueries({ queryKey: ['guidance'] });
          }}
        />
      ) : null}
    </div>
  );
}

function GuidanceModal({
  crops,
  editor,
  onClose,
  onSaved,
}: {
  crops: Crop[];
  editor: { mode: 'create' } | { mode: 'edit'; row: KnowledgeGuidance };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = editor.mode === 'edit' ? editor.row : null;
  const [cropId, setCropId] = useState(editing?.cropId ?? '');
  const [problemType, setProblemType] = useState<string>((editing?.problemType ?? '') as string);
  const [keywords, setKeywords] = useState(editing?.problemKeywords.join(', ') ?? '');
  const [products, setProducts] = useState(editing?.recommendedProducts.join(', ') ?? '');
  const [usage, setUsage] = useState(editing?.usageGuidance ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitList = (value: string) =>
    value
      .split(/[\n,]/)
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

  async function submit() {
    const payload = {
      cropId,
      problemType: (problemType as ProblemType) || null,
      problemKeywords: splitList(keywords),
      recommendedProducts: splitList(products),
      usageGuidance: usage.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/assistant/guidance/${editing.id}`, payload);
      } else {
        await api.post('/assistant/guidance', payload);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const valid =
    Boolean(cropId) && splitList(keywords).length > 0 && splitList(products).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{editing ? 'Edit recommendation' : 'New Knowledge Base entry'}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Crop">
            <Select value={cropId} onChange={(e) => setCropId(e.target.value)}>
              <option value="">Select a crop…</option>
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Problem / issue type" hint="What kind of problem this entry addresses (PRD §6.5.2)">
            <Select value={problemType} onChange={(e) => setProblemType(e.target.value)}>
              <option value="">Select a type…</option>
              {PROBLEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROBLEM_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Problem / symptom keywords" hint="Comma or newline separated, e.g. leaf yellowing, nitrogen deficiency">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </Field>
          <Field label="Recommended Grotec products" hint="Comma or newline separated, e.g. Azos, Bio Jeevan PF">
            <Input value={products} onChange={(e) => setProducts(e.target.value)} />
          </Field>
          <Field label="Usage guidance">
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              placeholder="Application stage, method and label note…"
            />
          </Field>
          {editing ? (
            <Field label="Notes (internal)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <div className={cx('flex justify-end gap-2 border-t border-slate-200 px-5 py-3')}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !valid} onClick={() => void submit()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add entry'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
