import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Contact,
  Phone,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  UserCheck,
  UserPlus,
  UserMinus,
  RefreshCw,
  Eye,
  Sprout,
  MapPin,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  Send,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { RelationshipHolder, RelationshipPortfolioItem } from '../../lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Spinner,
  StatusBadge,
  Table,
  THead,
  TH,
  TD,
  cx,
} from '../../components/ui';

type FilterTab = 'ALL' | 'INTERESTED' | 'FOLLOWUP' | 'NOT_ANSWERED' | 'CONVERTED' | 'UNASSIGNED';

export function RelationshipPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManage = hasPermission('relationship.manage');
  const isFounder = user?.roleCode === 'FOUNDER';

  // Filters state
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRmId, setSelectedRmId] = useState<string>('');

  // Data state
  const [items, setItems] = useState<RelationshipPortfolioItem[]>([]);
  const [holders, setHolders] = useState<RelationshipHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal state
  const [assignTarget, setAssignTarget] = useState<RelationshipPortfolioItem | null>(null);
  const [assignRmId, setAssignRmId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [releaseTarget, setReleaseTarget] = useState<RelationshipPortfolioItem | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  // Fetch holders (eligible RMs)
  const fetchHolders = async () => {
    try {
      const res = await api.get('/relationship/holders');
      setHolders(res.data.items || []);
    } catch {
      // For AGENT role, backend safely returns empty holders list
      setHolders([]);
    }
  };

  // Fetch portfolio customers
  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const isUnassigned = activeTab === 'UNASSIGNED';
      const params: Record<string, string> = {};
      if (isUnassigned) {
        params.unassigned = '1';
      } else if (selectedRmId) {
        params.rmId = selectedRmId;
      }
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }

      const res = await api.get('/relationship/customers', { params });
      setItems(res.data.items || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHolders();
  }, []);

  useEffect(() => {
    void fetchCustomers();
  }, [activeTab, selectedRmId]);

  // Handle assign submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    if (!assignRmId) {
      setError('Please select a Relationship Manager to assign.');
      return;
    }
    setAssignSubmitting(true);
    try {
      await api.post(`/relationship/customers/${assignTarget.customer.id}/assign`, {
        rmId: assignRmId,
        reason: assignReason.trim() || undefined,
      });
      setSuccessMessage(`Assigned ${assignTarget.customer.fullName} to Relationship Manager.`);
      setAssignTarget(null);
      setAssignRmId('');
      setAssignReason('');
      void fetchCustomers();
      void fetchHolders();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Handle release submit
  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseTarget) return;
    setReleaseSubmitting(true);
    try {
      await api.post(`/relationship/customers/${releaseTarget.customer.id}/release`, {
        reason: releaseReason.trim() || undefined,
      });
      setSuccessMessage(`Released ${releaseTarget.customer.fullName} from Relationship Manager.`);
      setReleaseTarget(null);
      setReleaseReason('');
      void fetchCustomers();
      void fetchHolders();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReleaseSubmitting(false);
    }
  };

  // Filter items in memory according to the active tab rules
  const filteredItems = items.filter((item) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customer.fullName?.toLowerCase().includes(q);
      const matchCode = item.customer.farmerCode?.toLowerCase().includes(q);
      const matchPhone = item.customer.primaryPhone?.toLowerCase().includes(q);
      const matchVillage = item.customer.location?.village?.toLowerCase().includes(q);
      const matchDistrict = item.customer.location?.district?.toLowerCase().includes(q);
      const matchCrop = item.customer.crops?.some((c) => c.name.toLowerCase().includes(q));
      if (!matchName && !matchCode && !matchPhone && !matchVillage && !matchDistrict && !matchCrop) {
        return false;
      }
    }

    // Tab-specific filters
    if (activeTab === 'INTERESTED') {
      return item.lastCall?.outcome === 'INTERESTED';
    }
    if (activeTab === 'FOLLOWUP') {
      return item.pendingFollowUps > 0;
    }
    if (activeTab === 'NOT_ANSWERED') {
      return item.lastCall?.status === 'NOT_ANSWERED';
    }
    if (activeTab === 'CONVERTED') {
      return Boolean(item.convertedAt);
    }
    return true; // 'ALL' or 'UNASSIGNED'
  });

  // Calculate metrics
  const totalCount = items.length;
  const interestedCount = items.filter((r) => r.lastCall?.outcome === 'INTERESTED').length;
  const followupCount = items.filter((r) => r.pendingFollowUps > 0).length;
  const convertedCount = items.filter((r) => Boolean(r.convertedAt)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Customer Retention
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Customer Relationship Ownership</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <Contact className="h-6 w-6 text-emerald-600" />
            Relationship Manager Portfolio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage long-term farmer relationships, sales conversion ownership, follow-ups, and portfolio health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchCustomers();
              void fetchHolders();
            }}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/agent')}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Phone className="h-3.5 w-3.5" />
            Agent Workspace
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <Alert tone="error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Alert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Managed</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Farmers in active portfolio</div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs bg-linear-to-br from-emerald-50/40 to-transparent">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Interested Farmers</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{interestedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Ready for bio-input solutions</div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs bg-linear-to-br from-amber-50/40 to-transparent">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Pending Follow-ups</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{followupCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Scheduled calls due</div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs bg-linear-to-br from-blue-50/40 to-transparent">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800">
            <span>Converted Sales</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{convertedCount}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Converted to repeat buyers</div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All Portfolio ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INTERESTED')}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                activeTab === 'INTERESTED'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Interested ({interestedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('FOLLOWUP')}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                activeTab === 'FOLLOWUP'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Follow-ups ({followupCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('NOT_ANSWERED')}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                activeTab === 'NOT_ANSWERED'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Not Answered
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CONVERTED')}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                activeTab === 'CONVERTED'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Converted ({convertedCount})
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setActiveTab('UNASSIGNED')}
                className={cx(
                  'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                  activeTab === 'UNASSIGNED'
                    ? 'bg-amber-100 text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Unassigned Pool
              </button>
            )}
          </div>

          {/* Search & RM selector */}
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, village..."
                className="pl-8 text-xs h-9"
              />
            </div>

            {holders.length > 0 && (
              <Select
                value={selectedRmId}
                onChange={(e) => setSelectedRmId(e.target.value)}
                className="text-xs h-9 w-40"
              >
                <option value="">All Managers</option>
                {holders.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.fullName} ({h.customerCount})
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Spinner />
            <span className="text-xs font-semibold">Loading relationship portfolio...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Contact className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No portfolio records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No customers match "${searchQuery}". Try clearing your search query.`
                : activeTab === 'UNASSIGNED'
                ? 'No unassigned converted leads pending RM claim.'
                : 'No farmer records in this relationship category yet. Conversions from telecalling calls will populate here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Farmer & Location</TH>
                  <TH>Contact & Phone</TH>
                  <TH>Crops & Land</TH>
                  <TH>Assigned RM</TH>
                  <TH>Last Call & Status</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredItems.map((item) => {
                  const cust = item.customer;
                  const hasFollowUp = item.pendingFollowUps > 0;
                  const isConverted = Boolean(item.convertedAt);

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      {/* Farmer Name & Location */}
                      <TD>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/customers/${cust.id}`}
                              className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                            >
                              {cust.fullName}
                            </Link>
                            {cust.farmerCode && (
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                {cust.farmerCode}
                              </span>
                            )}
                          </div>
                          {cust.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>
                                {[cust.location.village, cust.location.taluk, cust.location.district]
                                  .filter(Boolean)
                                  .join(', ') || 'Tamil Nadu'}
                              </span>
                            </div>
                          )}
                        </div>
                      </TD>

                      {/* Phone */}
                      <TD>
                        <div className="space-y-1">
                          <span className="font-mono text-slate-900 font-semibold">
                            {cust.primaryPhone || 'No phone'}
                          </span>
                          {cust.primaryPhone && (
                            <div>
                              <button
                                type="button"
                                onClick={() => navigate(`/agent?phone=${encodeURIComponent(cust.primaryPhone || '')}`)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition"
                              >
                                <Phone className="h-2.5 w-2.5" />
                                Call
                              </button>
                            </div>
                          )}
                        </div>
                      </TD>

                      {/* Crops */}
                      <TD>
                        {cust.crops && cust.crops.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {cust.crops.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200"
                              >
                                <Sprout className="h-2.5 w-2.5 text-emerald-600" />
                                {c.name} {c.acreage ? `(${c.acreage} ${c.unit || 'ac'})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not recorded</span>
                        )}
                      </TD>

                      {/* RM Owner */}
                      <TD>
                        {item.owner ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-semibold text-slate-900">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{item.owner.fullName}</span>
                            </div>
                            {item.assignedAt && (
                              <span className="text-[10px] text-slate-400 block">
                                Assigned {formatDate(item.assignedAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </TD>

                      {/* Status & Last Call */}
                      <TD>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {isConverted && (
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                Converted
                              </span>
                            )}
                            {hasFollowUp && (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                Follow-up Due
                              </span>
                            )}
                            {item.lastCall?.outcome && (
                              <span
                                className={cx(
                                  'text-[10px] font-bold px-2 py-0.5 rounded border',
                                  item.lastCall.outcome === 'INTERESTED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : item.lastCall.outcome === 'NOT_INTERESTED'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                )}
                              >
                                {item.lastCall.outcome.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          {item.lastCall && (
                            <span className="text-[10px] text-slate-400 block">
                              Last call: {formatDate(item.lastCall.startedAt)}
                            </span>
                          )}
                        </div>
                      </TD>

                      {/* Actions */}
                      <TD>
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/customers/${cust.id}`}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="View Farmer Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignTarget(item);
                                  setAssignRmId(item.owner?.id || holders[0]?.id || '');
                                  setAssignReason('');
                                }}
                                className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                                title={item.owner ? 'Reassign RM' : 'Assign to RM'}
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>

                              {item.owner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReleaseTarget(item);
                                    setReleaseReason('');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition"
                                  title="Release from RM ownership"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Assign RM Modal */}
      {assignTarget && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setAssignTarget(null)}
              className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              Assign Relationship Manager
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign <span className="font-bold text-slate-700">{assignTarget.customer.fullName}</span> to an active
              Relationship Manager for ongoing customer management.
            </p>

            <form onSubmit={handleAssignSubmit} className="mt-4 space-y-3.5 text-xs">
              <Field label="Relationship Manager">
                <Select
                  value={assignRmId}
                  onChange={(e) => setAssignRmId(e.target.value)}
                  required
                >
                  <option value="">Select Manager...</option>
                  {holders.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName} ({h.email}) — {h.customerCount} assigned
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Assignment Reason / Handover Note">
                <Input
                  type="text"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="e.g. Sales conversion handover, VIP customer"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setAssignTarget(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={assignSubmitting || !assignRmId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {assignSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release RM Modal */}
      {releaseTarget && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setReleaseTarget(null)}
              className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-base font-bold text-rose-700 flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-rose-600" />
              Release from Relationship Manager
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Release <span className="font-bold text-slate-700">{releaseTarget.customer.fullName}</span> from{' '}
              <span className="font-bold text-slate-700">{releaseTarget.owner?.fullName}</span>. The farmer will return
              to the unassigned relationship pool.
            </p>

            <form onSubmit={handleReleaseSubmit} className="mt-4 space-y-3.5 text-xs">
              <Field label="Reason for Release">
                <Input
                  type="text"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Territory transfer, inactive farmer"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setReleaseTarget(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={releaseSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  {releaseSubmitting ? 'Releasing...' : 'Release from Portfolio'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
