import React, { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  X,
  Users,
  Database,
  MapPin,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { ImportParseResult, ImportPreviewResult, ImportRowItem, ImportExecuteResult } from '../../lib/types';
import { Alert, Button, Card, Field, Select, Spinner, cx } from '../../components/ui';

interface ImportCustomersModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm';

const TARGET_FIELDS = [
  { key: 'fullName', label: 'Farmer Full Name', required: true, hint: 'Farmer name (1-100 chars)' },
  { key: 'phone', label: 'Primary Phone Number', required: true, hint: '10-digit mobile or E.164 (Required)' },
  { key: 'secondaryPhone', label: '2nd Phone Number', required: false, hint: 'Optional secondary contact' },
  { key: 'phone3', label: '3rd / Additional Phone', required: false, hint: 'Optional 3rd contact' },
  { key: 'state', label: 'State', required: false, hint: 'Defaults to Tamil Nadu if empty' },
  { key: 'district', label: 'District', required: false, hint: 'District name (e.g. Dharmapuri, Salem)' },
  { key: 'taluk', label: 'Taluk', required: false, hint: 'Taluk / Tehsil (Missing Taluk is allowed)' },
  { key: 'village', label: 'Village / Town', required: false, hint: 'Village or locality name' },
  { key: 'pincode', label: 'Pincode', required: false, hint: '6-digit postal code' },
  { key: 'soilType', label: 'Soil Type', required: false, hint: 'Red loam, Clay, Black soil, etc.' },
  { key: 'preferredLanguage', label: 'Language', required: false, hint: 'Language code (e.g. ta, en)' },
] as const;

export function ImportCustomersModal({ open, onClose }: ImportCustomersModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');

  // Execution state
  const [assignmentMode, setAssignmentMode] = useState<'round_robin' | 'single_agent' | 'self'>('round_robin');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ImportExecuteResult | null>(null);

  // Fetch agents list for assignment
  const { data: employeesData } = useQuery({
    queryKey: ['telecaller-agents'],
    queryFn: async () => {
      try {
        const res = await api.get<{ items: Array<{ id: string; fullName: string; roleCode: string }> }>('/employees', {
          params: { pageSize: 50 },
        });
        return res.data?.items?.filter((e) => e.roleCode === 'AGENT' || e.roleCode === 'TELECALLER') || [];
      } catch {
        return [];
      }
    },
    enabled: open,
  });

  if (!open) return null;

  function resetAll() {
    setStep('upload');
    setFile(null);
    setLoading(false);
    setError(null);
    setParseResult(null);
    setMapping({});
    setPreviewResult(null);
    setFilterTab('all');
    setExecuting(false);
    setExecuteResult(null);
    onClose();
  }

  function downloadSampleTemplate() {
    const csvContent =
      'Full Name,Phone 1,Phone 2,Phone 3,State,District,Taluk,Village,Pincode,Soil Type,Language\n' +
      'Karthikeyan S,9876543101,,,Tamil Nadu,Dharmapuri,Palacode,Palacode,636808,Red loam,ta\n' +
      'Ramasamy M,9876543102,9876543103,,Tamil Nadu,Trichy,,Lalgudi,621601,Clay soil,ta\n' +
      'Venkatesh P,9876543104,9876543105,9876543106,Tamil Nadu,Salem,Attur,Attur,636102,Black cotton soil,ta\n' +
      'Murugan K,9876543107,,,Tamil Nadu,Erode,,Bhavani,638301,Loamy,ta\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'grotec_farmer_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(selectedFile: File) {
    const name = selectedFile.name.toLowerCase();
    const isAllowed = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || name.endsWith('.txt');

    if (!isAllowed) {
      setError('Please select an Excel (.xlsx/.xls) or CSV (.csv) file.');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post<ImportParseResult>('/import/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParseResult(res.data);
      setMapping(res.data.suggestedMapping || {});
      setStep('mapping');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleComputePreview() {
    if (!parseResult) return;
    if (!mapping.fullName || !mapping.phone) {
      setError('Please map both "Farmer Full Name" and "Primary Phone Number" columns.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<ImportPreviewResult>('/import/preview', {
        rows: parseResult.rows,
        mapping,
      });
      setPreviewResult(res.data);
      setStep('preview');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteImport() {
    if (!parseResult || !previewResult) return;

    setExecuting(true);
    setError(null);

    try {
      const options: {
        skipDuplicates: boolean;
        assignRoundRobin?: boolean;
        agentIds?: string[];
        leadOwnerId?: string;
      } = {
        skipDuplicates: true,
      };

      if (assignmentMode === 'round_robin') {
        const agentList = employeesData || [];
        if (agentList.length > 0) {
          options.assignRoundRobin = true;
          options.agentIds = agentList.map((a) => a.id);
        }
      } else if (assignmentMode === 'single_agent' && selectedAgentId) {
        options.leadOwnerId = selectedAgentId;
      }

      const res = await api.post<ImportExecuteResult>('/import/execute', {
        rows: parseResult.rows,
        mapping,
        options,
      });

      setExecuteResult(res.data);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExecuting(false);
    }
  }

  const filteredItems: ImportRowItem[] = (previewResult?.items || []).filter((item) => {
    if (filterTab === 'valid') return item.status === 'VALID';
    if (filterTab === 'duplicate') return item.status === 'DUPLICATE';
    if (filterTab === 'invalid') return item.status === 'INVALID';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <Card className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600" /> Import Customers (Excel &amp; CSV)
            </h2>
            <p className="text-xs text-slate-500">
              {step === 'upload' && 'Step 1 of 4: Select and parse customer Excel or CSV file'}
              {step === 'mapping' && 'Step 2 of 4: Map spreadsheet columns to customer profile fields'}
              {step === 'preview' && 'Step 3 of 4: Review validations, duplicates and missing Taluks'}
              {step === 'confirm' && 'Step 4 of 4: Agent assignment and database insertion'}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    void handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-10 text-center hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="mb-3 rounded-full bg-emerald-100 p-3 text-emerald-700">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Drag and drop your customer Excel or CSV file here, or{' '}
                  <label className="cursor-pointer text-brand-600 hover:underline">
                    <span>browse file</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          void handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Supports Excel (.xlsx, .xls) and CSV (.csv) • Dynamic multiple phone numbers • Up to 5,000+ rows
                </p>

                {loading && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-brand-600 font-medium">
                    <Spinner label="Parsing spreadsheet..." />
                    <span>Parsing spreadsheet headers and detecting structure...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Download Customer Import Template</p>
                    <p className="text-[11px] text-slate-500">
                      Pre-formatted template with 1, 2, or 3 phone numbers, District, and optional Taluk columns.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={downloadSampleTemplate} className="gap-1 text-xs">
                  <Download className="h-3.5 w-3.5" /> Download Template
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && parseResult && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
                <span>
                  Detected <strong>{parseResult.headers.length} columns</strong> and{' '}
                  <strong>{parseResult.rowCount.toLocaleString()} rows</strong> in{' '}
                  <code>{parseResult.fileName}</code>.
                </span>
                <span className="text-[11px] text-emerald-600">Review auto-detected field mappings</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {TARGET_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-md border border-slate-200 bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <span className="text-[10px] text-slate-400">{field.hint}</span>
                    </div>
                    <Select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      aria-label={`Map column for ${field.label}`}
                    >
                      <option value="">(Select column or leave unmapped)</option>
                      {parseResult.headers.map((hdr) => (
                        <option key={hdr} value={hdr}>
                          Column: &quot;{hdr}&quot; (sample: {String(parseResult.sampleRows[0]?.[hdr] ?? 'empty')})
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Validation */}
          {step === 'preview' && previewResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Total Rows</p>
                  <p className="text-lg font-extrabold text-slate-800">{previewResult.totalRows.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Ready to Import</p>
                  <p className="text-lg font-extrabold text-emerald-700">{previewResult.validRows.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Duplicates</p>
                  <p className="text-lg font-extrabold text-amber-700">{previewResult.duplicateRows.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-red-700">Errors (Excluded)</p>
                  <p className="text-lg font-extrabold text-red-700">{previewResult.invalidRows.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-blue-700">Missing Taluks</p>
                  <p className="text-lg font-extrabold text-blue-700">{(previewResult.missingTalukRows ?? 0).toLocaleString()}</p>
                </div>
              </div>

              {(previewResult.missingTalukRows ?? 0) > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>{previewResult.missingTalukRows} rows</strong> have no Taluk specified. They are completely valid and will be imported successfully. Telecallers will be alerted to update the Taluk during manual calling.
                  </span>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  All Rows ({previewResult.totalRows.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'valid' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50')}
                >
                  Valid ({previewResult.validRows.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('duplicate')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'duplicate' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50')}
                >
                  Duplicates ({previewResult.duplicateRows.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('invalid')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'invalid' ? 'bg-red-700 text-white' : 'text-red-700 hover:bg-red-50')}
                >
                  Errors ({previewResult.invalidRows.toLocaleString()})
                </button>
              </div>

              {/* Detailed Item List */}
              <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 text-xs">
                <table className="w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 font-semibold text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Farmer Name</th>
                      <th className="px-3 py-2">Phone Number(s)</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Taluk Status</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredItems.slice(0, 200).map((item) => (
                      <tr key={item.rowNumber} className={cx(item.status === 'INVALID' && 'bg-red-50/40', item.status === 'DUPLICATE' && 'bg-amber-50/40')}>
                        <td className="px-3 py-2 font-mono text-slate-400">{item.rowNumber}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{item.mapped.fullName || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {item.mapped.phone || '—'}
                          {item.mapped.additionalPhones && item.mapped.additionalPhones.length > 0 && (
                            <span className="ml-1 inline-block rounded bg-slate-100 px-1 py-0.2 text-[10px] text-slate-500 font-sans">
                              +{item.mapped.additionalPhones.length} more
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {[item.mapped.village, item.mapped.taluk, item.mapped.district, item.mapped.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {item.talukMissing ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              Missing (Allowed)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              {item.mapped.taluk}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {item.status === 'VALID' && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> VALID
                            </span>
                          )}
                          {item.status === 'DUPLICATE' && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertTriangle className="h-3 w-3 text-amber-600" /> DUPLICATE
                            </span>
                          )}
                          {item.status === 'INVALID' && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                              <XCircle className="h-3 w-3 text-red-600" /> INVALID
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px]">
                          {item.errors.length > 0 && (
                            <p className="text-red-600 font-medium">{item.errors.join('; ')}</p>
                          )}
                          {item.duplicateReason && (
                            <p className="text-amber-700 font-medium">{item.duplicateReason}</p>
                          )}
                          {item.status === 'VALID' && (
                            <span className="text-slate-400 text-[10px]">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredItems.length > 200 && (
                <p className="text-[11px] text-slate-400 text-center">
                  Showing first 200 of {filteredItems.length.toLocaleString()} rows in preview table
                </p>
              )}
            </div>
          )}

          {/* STEP 4: Assignment & Confirmation */}
          {step === 'confirm' && previewResult && (
            <div className="space-y-5 py-2">
              {!executeResult ? (
                <div className="space-y-4 max-w-xl mx-auto">
                  <div className="text-center space-y-1">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Ready to Import to Database</h3>
                    <p className="text-xs text-slate-500">
                      {previewResult.validRows.toLocaleString()} valid customers will be saved to the database.
                      {previewResult.duplicateRows > 0 && ` (${previewResult.duplicateRows.toLocaleString()} duplicates will be skipped).`}
                    </p>
                  </div>

                  {/* Telecaller Assignment Options */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-brand-600" /> Customer Calling Assignment
                    </p>
                    <div className="space-y-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="assignment"
                          checked={assignmentMode === 'round_robin'}
                          onChange={() => setAssignmentMode('round_robin')}
                          className="text-brand-600 focus:ring-brand-500"
                        />
                        <span>
                          <strong>Round-Robin across all Telecallers</strong> (Agent 1, Agent 2, Agent 3)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="assignment"
                          checked={assignmentMode === 'single_agent'}
                          onChange={() => setAssignmentMode('single_agent')}
                          className="text-brand-600 focus:ring-brand-500"
                        />
                        <span>Assign all imported customers to a specific agent:</span>
                      </label>
                      {assignmentMode === 'single_agent' && (
                        <div className="ml-6 mt-1">
                          <Select
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            aria-label="Select Telecaller Agent"
                          >
                            <option value="">(Select Telecaller)</option>
                            {(employeesData || []).map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.fullName} ({emp.roleCode})
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="assignment"
                          checked={assignmentMode === 'self'}
                          onChange={() => setAssignmentMode('self')}
                          className="text-brand-600 focus:ring-brand-500"
                        />
                        <span>Assign to my calling queue</span>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Source File:</span>
                      <span className="font-mono text-slate-800">{parseResult?.fileName}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Customers to Insert:</span>
                      <span className="font-bold text-emerald-700">{previewResult.validRows.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Duplicates Excluded:</span>
                      <span className="font-bold text-amber-700">{previewResult.duplicateRows.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Missing Taluk (Allowed):</span>
                      <span className="font-bold text-blue-700">{(previewResult.missingTalukRows ?? 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {executing && (
                    <div className="p-4 text-center space-y-2">
                      <Spinner label="Writing customers to database..." />
                      <p className="text-xs font-semibold text-brand-700">
                        Inserting customer records, locations, phone numbers, and calling queues in database transactions...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Execution Succeeded! */
                <div className="space-y-4 max-w-lg mx-auto text-center py-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Import Completed Successfully!</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {executeResult.createdCount.toLocaleString()} farmers have been permanently added to the database and queued for calling.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-left space-y-2">
                    <div className="flex justify-between border-b border-slate-200 py-1">
                      <span className="text-slate-500">Farmers Created:</span>
                      <span className="font-bold text-emerald-700">{executeResult.createdCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 py-1">
                      <span className="text-slate-500">Missing Taluks (Flagged for agents):</span>
                      <span className="font-bold text-blue-700">{(executeResult.missingTalukCount ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 py-1">
                      <span className="text-slate-500">Duplicates Skipped:</span>
                      <span className="font-bold text-amber-700">{executeResult.skippedCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Errors Excluded:</span>
                      <span className="font-bold text-red-700">{executeResult.errorCount.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button size="md" variant="primary" onClick={resetAll} className="w-full">
                    View Customers in Directory
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            {step === 'mapping' && (
              <Button size="sm" variant="ghost" onClick={() => setStep('upload')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Upload
              </Button>
            )}
            {step === 'preview' && (
              <Button size="sm" variant="ghost" onClick={() => setStep('mapping')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Mapping
              </Button>
            )}
            {step === 'confirm' && !executeResult && (
              <Button size="sm" variant="ghost" onClick={() => setStep('preview')} disabled={executing} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Preview
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!executeResult && (
              <Button size="sm" variant="ghost" onClick={resetAll} disabled={executing}>
                Cancel
              </Button>
            )}

            {step === 'mapping' && (
              <Button size="sm" onClick={() => void handleComputePreview()} disabled={loading} className="gap-1">
                {loading ? 'Validating...' : 'Validate & Preview'} <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 'preview' && (
              <Button
                size="sm"
                onClick={() => setStep('confirm')}
                disabled={!previewResult || previewResult.validRows === 0}
                className="gap-1 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Proceed to Import ({previewResult ? previewResult.validRows.toLocaleString() : 0} rows) <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 'confirm' && !executeResult && (
              <Button
                size="sm"
                onClick={() => void handleExecuteImport()}
                disabled={executing}
                className="gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                {executing ? 'Importing to Database...' : 'Execute Import & Save to Database'}{' '}
                <Database className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
