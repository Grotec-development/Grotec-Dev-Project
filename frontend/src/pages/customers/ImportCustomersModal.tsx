import React, { useState } from 'react';
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
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { ImportParseResult, ImportPreviewResult, ImportRowItem } from '../../lib/types';
import { Alert, Button, Card, Field, Select, Spinner, cx } from '../../components/ui';

interface ImportCustomersModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm';

const TARGET_FIELDS = [
  { key: 'fullName', label: 'Full Name', required: true, hint: 'Farmer full name (1-100 chars)' },
  { key: 'phone', label: 'Primary Phone', required: true, hint: '10-digit Indian mobile or E.164' },
  { key: 'secondaryPhone', label: 'Secondary Phone', required: false, hint: 'Optional secondary number' },
  { key: 'village', label: 'Village', required: false, hint: 'Village or town name' },
  { key: 'taluk', label: 'Taluk', required: false, hint: 'Taluk or block name' },
  { key: 'district', label: 'District', required: false, hint: 'District name (e.g. Dharmapuri)' },
  { key: 'soilType', label: 'Soil Type', required: false, hint: 'Farm soil description (max 40 chars)' },
  { key: 'preferredLanguage', label: 'Language', required: false, hint: 'Language code (e.g. ta, en)' },
] as const;

export function ImportCustomersModal({ open, onClose }: ImportCustomersModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');

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
    onClose();
  }

  function downloadSampleTemplate() {
    const csvContent =
      'Full Name,Phone Number,Secondary Phone,Village,Taluk,District,Soil Type,Language\n' +
      'Karthikeyan S,9876543101,,Palacode,Palacode,Dharmapuri,Red loam,ta\n' +
      'Ramasamy M,9876543102,9876543103,Lalgudi,Lalgudi,Trichy,Clay soil,ta\n' +
      'Venkatesh P,9876543104,,Attur,Attur,Salem,Black cotton soil,ta\n';
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
    if (!selectedFile.name.toLowerCase().endsWith('.csv') && !selectedFile.name.toLowerCase().endsWith('.txt')) {
      if (selectedFile.name.toLowerCase().endsWith('.xlsx') || selectedFile.name.toLowerCase().endsWith('.xls')) {
        setError('Direct Excel (.xlsx) parsing requires CSV format. Please save your file as CSV (Comma delimited) and re-upload.');
      } else {
        setError('Please select a valid CSV file (.csv).');
      }
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
      setError('Please map both "Full Name" and "Primary Phone" columns.');
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

  const filteredItems: ImportRowItem[] = (previewResult?.items || []).filter((item) => {
    if (filterTab === 'valid') return item.status === 'VALID';
    if (filterTab === 'duplicate') return item.status === 'DUPLICATE';
    if (filterTab === 'invalid') return item.status === 'INVALID';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Import Farmers (CSV)</h2>
            <p className="text-xs text-slate-500">
              {step === 'upload' && 'Step 1 of 4: Select and parse CSV file'}
              {step === 'mapping' && 'Step 2 of 4: Map spreadsheet columns to farmer profile fields'}
              {step === 'preview' && 'Step 3 of 4: Review validations, duplicates and errors before saving'}
              {step === 'confirm' && 'Step 4 of 4: Final verification and confirmation'}
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
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-10 text-center hover:bg-slate-50 transition"
              >
                <div className="mb-3 rounded-full bg-emerald-100 p-3 text-emerald-700">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Drag and drop your farmer CSV file here, or{' '}
                  <label className="cursor-pointer text-brand-600 hover:underline">
                    <span>browse file</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
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
                  Maximum file size: 5 MB • Max 5,000 rows • UTF-8 encoded CSV
                </p>

                {loading && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-brand-600 font-medium">
                    <Spinner label="Parsing CSV structure..." />
                    <span>Parsing spreadsheet headers and validating structure...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Need a starting template?</p>
                    <p className="text-[11px] text-slate-500">
                      Download the pre-formatted GROTEC CSV template with example farmer columns.
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
                  <strong>{parseResult.rowCount} rows</strong> from file{' '}
                  <code>{parseResult.fileName}</code>.
                </span>
                <span className="text-[11px] text-emerald-600">Review auto-detected field mappings below</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {/* Summary stat cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Total Rows</p>
                  <p className="text-xl font-extrabold text-slate-800">{previewResult.totalRows}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Ready to Import</p>
                  <p className="text-xl font-extrabold text-emerald-700">{previewResult.validRows}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Duplicates Flagged</p>
                  <p className="text-xl font-extrabold text-amber-700">{previewResult.duplicateRows}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-red-700">Errors (Rejected)</p>
                  <p className="text-xl font-extrabold text-red-700">{previewResult.invalidRows}</p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  All Rows ({previewResult.totalRows})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'valid' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50')}
                >
                  Valid ({previewResult.validRows})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('duplicate')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'duplicate' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50')}
                >
                  Duplicates ({previewResult.duplicateRows})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('invalid')}
                  className={cx('px-3 py-1 font-semibold rounded-md transition', filterTab === 'invalid' ? 'bg-red-700 text-white' : 'text-red-700 hover:bg-red-50')}
                >
                  Errors ({previewResult.invalidRows})
                </button>
              </div>

              {/* Detailed Item List */}
              <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 text-xs">
                <table className="w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 font-semibold text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Farmer Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Soil Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredItems.map((item) => (
                      <tr key={item.rowNumber} className={cx(item.status === 'INVALID' && 'bg-red-50/40', item.status === 'DUPLICATE' && 'bg-amber-50/40')}>
                        <td className="px-3 py-2 font-mono text-slate-400">{item.rowNumber}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{item.mapped.fullName || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{item.mapped.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {[item.mapped.village, item.mapped.taluk, item.mapped.district].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{item.mapped.soilType || '—'}</td>
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
                            <span className="text-slate-400 text-[10px]">Validated</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation */}
          {step === 'confirm' && previewResult && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pre-Import Validation Complete</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  {previewResult.validRows} valid records have been verified and prepared for database insertion.
                  {previewResult.duplicateRows > 0 && ` ${previewResult.duplicateRows} duplicate records flagged for manual review.`}
                  {previewResult.invalidRows > 0 && ` ${previewResult.invalidRows} rejected due to formatting errors.`}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-left max-w-lg mx-auto text-xs space-y-2">
                <p className="font-semibold text-slate-700">Import Batch Summary:</p>
                <div className="flex justify-between border-b border-slate-200 py-1">
                  <span className="text-slate-500">Source File:</span>
                  <span className="font-mono text-slate-800">{parseResult?.fileName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-1">
                  <span className="text-slate-500">New Customers to Create:</span>
                  <span className="font-bold text-emerald-700">{previewResult.validRows}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-1">
                  <span className="text-slate-500">Duplicates Skipped:</span>
                  <span className="font-bold text-amber-700">{previewResult.duplicateRows}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Errors Excluded:</span>
                  <span className="font-bold text-red-700">{previewResult.invalidRows}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Note: In Step 4, preview evaluation is code-only. Database write execution will run upon migration confirmation.
              </p>
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
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={resetAll}>
              {step === 'confirm' ? 'Close' : 'Cancel'}
            </Button>

            {step === 'mapping' && (
              <Button size="sm" onClick={() => void handleComputePreview()} disabled={loading} className="gap-1">
                {loading ? 'Validating...' : 'Validate & Preview'} <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 'preview' && (
              <Button size="sm" onClick={() => setStep('confirm')} className="gap-1">
                Confirm Preview <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}

            {step === 'confirm' && (
              <Button size="sm" onClick={resetAll}>
                Done
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
