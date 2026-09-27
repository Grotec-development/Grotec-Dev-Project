import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  Users,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Send,
  Eye,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { FarmerSegmentItem } from '../../lib/types';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, cx } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { getStates, getDistricts, getTaluks, getVillages } from '../../lib/location-data';

interface FarmerSegmentsModalProps {
  onClose: () => void;
}

export function FarmerSegmentsModal({ onClose }: FarmerSegmentsModalProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'create' | 'preview'>('list');
  const [selectedSegment, setSelectedSegment] = useState<FarmerSegmentItem | null>(null);

  // Creation form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filterState, setFilterState] = useState('Tamil Nadu');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTaluk, setFilterTaluk] = useState('');
  const [filterVillage, setFilterVillage] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [availableVillages, setAvailableVillages] = useState<string[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const availableStates = useMemo(() => getStates(), []);
  const availableDistricts = useMemo(() => (filterState ? getDistricts(filterState) : []), [filterState]);
  const availableTaluks = useMemo(
    () => (filterState && filterDistrict ? getTaluks(filterState, filterDistrict) : []),
    [filterState, filterDistrict],
  );

  useEffect(() => {
    let cancelled = false;
    if (!filterState || !filterDistrict || !filterTaluk) {
      setAvailableVillages([]);
      setLoadingVillages(false);
      return;
    }
    setLoadingVillages(true);
    getVillages(filterState, filterDistrict, filterTaluk)
      .then((list) => {
        if (!cancelled) {
          setAvailableVillages(list);
          setLoadingVillages(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableVillages([]);
          setLoadingVillages(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterState, filterDistrict, filterTaluk]);

  const handleFilterStateChange = (newState: string) => {
    setFilterState(newState);
    setFilterDistrict('');
    setFilterTaluk('');
    setFilterVillage('');
  };

  const handleFilterDistrictChange = (newDistrict: string) => {
    setFilterDistrict(newDistrict);
    setFilterTaluk('');
    setFilterVillage('');
  };

  const handleFilterTalukChange = (newTaluk: string) => {
    setFilterTaluk(newTaluk);
    setFilterVillage('');
  };

  // Campaign preview state
  const [campaignChannel, setCampaignChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [templateName, setTemplateName] = useState('monsoon_crop_advisory');
  const [previewData, setPreviewData] = useState<{
    segmentName: string;
    estimatedRecipients: number;
    channel: string;
    template: string;
    samplePreview: string;
    compliance: { optOutIncluded: boolean; dltApproved: boolean };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Segments query
  const segmentsQuery = useQuery({
    queryKey: ['farmer-segments'],
    queryFn: async () => {
      const res = await api.get<FarmerSegmentItem[]>('/segments');
      return res.data;
    },
  });

  const handleCreateSegment = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setCreateError(null);
    try {
      await api.post('/segments', {
        name: name.trim(),
        description: description.trim() || undefined,
        filterCriteria: {
          state: filterState || undefined,
          district: filterDistrict || undefined,
          taluk: filterTaluk.trim() || undefined,
          village: filterVillage.trim() || undefined,
          crop: filterCrop.trim() || undefined,
          status: filterStatus || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['farmer-segments'] });
      // Reset
      setName('');
      setDescription('');
      setFilterState('Tamil Nadu');
      setFilterDistrict('');
      setFilterTaluk('');
      setFilterVillage('');
      setFilterCrop('');
      setView('list');
    } catch (err: any) {
      setCreateError(errorMessage(err) || 'Failed to create segment');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewCampaign = async (segment: FarmerSegmentItem) => {
    setSelectedSegment(segment);
    setView('preview');
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await api.post(`/segments/${segment.id}/preview-campaign`, {
        channel: campaignChannel,
        templateName,
      });
      setPreviewData(res.data);
    } catch (err: any) {
      setPreviewError(errorMessage(err) || 'Failed to preview campaign');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {view === 'list' && 'Farmer Segmentation & Outreach'}
                {view === 'create' && 'Create Dynamic Farmer Segment'}
                {view === 'preview' && `Advisory Campaign: ${selectedSegment?.name}`}
              </h2>
              <p className="text-xs text-slate-500">
                Segment-specific communication with TRAI & WhatsApp opt-out compliance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === 'list' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setView('create')}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> New Segment
              </Button>
            )}
            {view !== 'list' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                className="text-xs"
              >
                Back to Segments
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* VIEW 1: SEGMENTS LIST */}
          {view === 'list' && (
            <div className="space-y-4">
              {segmentsQuery.isLoading ? (
                <div className="py-12 text-center">
                  <Spinner label="Loading saved farmer segments..." />
                </div>
              ) : segmentsQuery.isError ? (
                <Alert tone="error">{errorMessage(segmentsQuery.error) || 'Failed to load segments'}</Alert>
              ) : segmentsQuery.data && segmentsQuery.data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {segmentsQuery.data.map((seg) => {
                    const filters = seg.filterCriteria || {};
                    const filterTags = [
                      filters.state ? `State: ${filters.state}` : null,
                      filters.district ? `District: ${filters.district}` : null,
                      filters.taluk ? `Taluk: ${filters.taluk}` : null,
                      filters.village ? `Village: ${filters.village}` : null,
                      filters.crop ? `Crop: ${filters.crop}` : null,
                      filters.status ? `Status: ${filters.status}` : null,
                    ].filter(Boolean);

                    return (
                      <div
                        key={seg.id}
                        className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{seg.name}</h3>
                              {seg.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{seg.description}</p>
                              )}
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              {seg.farmerCount} Farmers
                            </span>
                          </div>

                          {filterTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {filterTags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            Created {formatDate(seg.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handlePreviewCampaign(seg)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100/70 border border-purple-200 px-2.5 py-1 rounded-md transition"
                          >
                            <MessageSquare className="h-3 w-3" /> Preview Campaign
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-6">
                  <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-800">No Saved Segments</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Create your first target farmer segment based on crop, district, and operational status.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setView('create')}
                    className="mt-4 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create First Segment
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: CREATE SEGMENT */}
          {view === 'create' && (
            <div className="max-w-xl mx-auto space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              {createError && <Alert tone="error">{createError}</Alert>}

              <Field label="Segment Name" hint="e.g. Dharmapuri Mango Farmers, Erode Turmeric Cluster">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter segment name..."
                />
              </Field>

              <Field label="Description (optional)">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Target audience details or campaign goal..."
                />
              </Field>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-purple-600" /> Filter Criteria
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">State / Region</label>
                    <select
                      value={filterState}
                      onChange={(e) => handleFilterStateChange(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none"
                    >
                      <option value="">All States</option>
                      {availableStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">District</label>
                    <select
                      value={filterDistrict}
                      onChange={(e) => handleFilterDistrictChange(e.target.value)}
                      disabled={!filterState}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">All Districts ({availableDistricts.length})</option>
                      {availableDistricts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Taluk / Block</label>
                    <select
                      value={filterTaluk}
                      onChange={(e) => handleFilterTalukChange(e.target.value)}
                      disabled={!filterDistrict}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">
                        {!filterDistrict ? 'Select District First' : `All Taluks (${availableTaluks.length})`}
                      </option>
                      {availableTaluks.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Village / Area</label>
                    <select
                      value={filterVillage}
                      onChange={(e) => setFilterVillage(e.target.value)}
                      disabled={!filterTaluk || loadingVillages}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">
                        {!filterTaluk
                          ? 'Select Taluk First'
                          : loadingVillages
                          ? '⏳ Loading villages...'
                          : `All Villages (${availableVillages.length})`}
                      </option>
                      {availableVillages.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Crop (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Paddy, Banana, Cotton"
                      value={filterCrop}
                      onChange={(e) => setFilterCrop(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setView('list')} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreateSegment()}
                  disabled={saving || !name.trim()}
                >
                  {saving ? 'Creating...' : 'Save Segment'}
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 3: CAMPAIGN PREVIEW & COMPLIANCE */}
          {view === 'preview' && selectedSegment && (
            <div className="max-w-xl mx-auto space-y-4">
              {previewError && <Alert tone="error">{previewError}</Alert>}

              {previewLoading ? (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
                  <Spinner label="Rendering advisory template & estimating audience..." />
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  {/* Channel & Template Selectors */}
                  <Card className="p-4 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Broadcast Channel</label>
                        <select
                          value={campaignChannel}
                          onChange={(e) => {
                            const ch = e.target.value as 'WHATSAPP' | 'SMS';
                            setCampaignChannel(ch);
                          }}
                          className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                        >
                          <option value="WHATSAPP">WhatsApp Business API (Official)</option>
                          <option value="SMS">SMS Gateway (DLT Registered)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Advisory Template</label>
                        <select
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                        >
                          <option value="monsoon_crop_advisory">Monsoon Crop Nutrition Advisory</option>
                          <option value="pest_warning_alert">Pest Alert & Botanical Treatment</option>
                          <option value="exclusive_yield_offer">Organic Booster Pre-Booking Offer</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Estimated Reach: <strong className="text-purple-700 font-bold">{previewData.estimatedRecipients} active farmers</strong>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handlePreviewCampaign(selectedSegment)}
                        className="text-xs"
                      >
                        Re-evaluate Preview
                      </Button>
                    </div>
                  </Card>

                  {/* WhatsApp/SMS Live Message Mockup */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs font-bold">
                          {campaignChannel === 'WHATSAPP' ? 'GROTEC Agronomy Advisory (WhatsApp)' : 'GROTEC SMS Service'}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold bg-emerald-800 px-2 py-0.5 rounded-full">
                        Verified Business
                      </span>
                    </div>

                    <div className="p-4 bg-emerald-50/20">
                      <div className="max-w-md bg-white rounded-lg p-3.5 border border-emerald-200/80 shadow-xs font-sans text-xs text-slate-800 space-y-2 leading-relaxed">
                        <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                          🌾 GROTEC FarmerOS Advisory
                        </div>
                        <p className="whitespace-pre-line">
                          {previewData.samplePreview}
                        </p>
                      </div>
                    </div>

                    {/* Mandatory Compliance Check */}
                    <div className="p-3 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        TRAI & WhatsApp Business compliant: Explicit opt-out footer included automatically.
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
