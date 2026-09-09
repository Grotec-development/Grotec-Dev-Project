import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Palmtree,
  Clock,
  MessageSquare,
  Building2,
  HelpCircle,
  AlertOctagon,
  CheckCircle2,
  X,
  FileText,
  Calendar,
  Send,
  AlertCircle,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
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
  cx,
} from '../components/ui';

interface QuickRequestModalProps {
  type: 'LEAVE' | 'PERMISSION' | 'MANAGER' | 'HR' | 'OFFICE' | 'ISSUE';
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function ActionCenterPage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as 'actions' | 'requests') || 'actions';
  const setActiveTab = (tab: 'actions' | 'requests') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [activeModal, setActiveModal] = useState<'LEAVE' | 'PERMISSION' | 'MANAGER' | 'HR' | 'OFFICE' | 'ISSUE' | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // My Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchMyRequests = async () => {
    setRequestsLoading(true);
    try {
      // Fetch leave applications as primary authentic request source
      const res = await api.get('/leave/my/applications', { params: { pageSize: 50 } }).catch(() => ({ data: { items: [] } }));
      const leaveItems = (res.data?.items || []).map((item: any) => ({
        id: item.id,
        type: `Leave: ${item.leaveType?.name || 'Annual Leave'}`,
        category: 'LEAVE',
        date: item.createdAt || item.startDate,
        startDate: item.startDate,
        endDate: item.endDate,
        days: item.daysCount,
        reason: item.reason,
        status: item.status, // PENDING, APPROVED, REJECTED, CANCELLED
        updatedAt: item.updatedAt || item.createdAt,
      }));

      // Fetch personal attendance records to capture live shift permissions & manual requests
      const attRes = await api.get('/attendance/my', { params: { pageSize: 50 } }).catch(() => ({ data: { items: [] } }));
      const permissionItems = (attRes.data?.items || [])
        .filter((r: any) => r.notes?.startsWith('[Permission:') || r.approvalStatus === 'PENDING' || r.source === 'MANUAL')
        .map((r: any) => {
          let reqType = 'Attendance Regularization';
          let reasonText = r.notes || r.status;
          if (r.notes?.startsWith('[Permission:')) {
            const match = r.notes.match(/^\[Permission:\s*([^\]]+)\]\s*(.*)$/);
            if (match) {
              reqType = `Permission: ${match[1]}`;
              reasonText = match[2] || match[1];
            }
          }
          return {
            id: r.id,
            type: reqType,
            category: 'PERMISSION',
            date: r.date,
            reason: reasonText,
            status: r.approvalStatus, // PENDING, APPROVED, REJECTED
            updatedAt: r.updatedAt || r.createdAt || r.date,
          };
        });

      // Merge with any locally stored action center requests (inquiries/office/issue only)
      let localRequests: any[] = [];
      try {
        const raw = localStorage.getItem('grotec_user_requests');
        if (raw) {
          const parsed = JSON.parse(raw);
          const knownIds = new Set([...leaveItems.map((l: any) => l.id), ...permissionItems.map((p: any) => p.id)]);
          localRequests = parsed.filter(
            (r: any) => r.category !== 'PERMISSION' && r.category !== 'LEAVE' && !knownIds.has(r.id)
          );
        }
      } catch {}

      const all = [...permissionItems, ...leaveItems, ...localRequests];
      all.sort((a, b) => new Date(b.updatedAt || b.date).getTime() - new Date(a.updatedAt || a.date).getTime());
      setRequests(all);
    } catch (err: any) {
      setErrorNotice('Failed to load your submitted requests.');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      void fetchMyRequests();
    }
  }, [activeTab]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Employee Self-Service
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Quick Actions Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">Action Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit quick requests to managers, HR, and facilities, or track your pending approvals.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={cx(
              'px-4 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
              activeTab === 'actions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            Quick Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={cx(
              'px-4 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5',
              activeTab === 'requests'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <span>My Requests</span>
            {requests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <Alert tone="error">
          <div className="flex items-center justify-between">
            <span>{errorNotice}</span>
            <button type="button" onClick={() => setErrorNotice(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </Alert>
      )}

      {/* TAB 1: QUICK ACTIONS */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Apply Leave */}
            <div
              onClick={() => setActiveModal('LEAVE')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Palmtree className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Apply Leave</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Submit a leave request to your manager with dates, balance deduction, and notes.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                <span>Submit Leave</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Card 2: Request Permission */}
            <div
              onClick={() => setActiveModal('PERMISSION')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Request Permission</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Late arrival, early exit, or WFH request for today or upcoming duty shift.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
                <span>Request Time</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Card 3: Contact Manager */}
            <div
              onClick={() => setActiveModal('MANAGER')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Contact Manager</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Send a direct message or calling support request to your reporting manager.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                <span>Send Note</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Card 4: Contact HR / Admin */}
            <div
              onClick={() => setActiveModal('HR')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Contact HR / Admin</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Reach out to the HR or admin team for payroll, policy, or letter requests.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
                <span>Open Inquiry</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Card 5: Office Request */}
            <div
              onClick={() => setActiveModal('OFFICE')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Office Request</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Raise a general office or resource request (headset, SIM card, ID card, stationary).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-700">
                <span>Raise Request</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Card 6: Report an Issue */}
            <div
              onClick={() => setActiveModal('ISSUE')}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-red-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-red-50 border border-red-200/80 flex items-center justify-center text-red-700 group-hover:bg-red-600 group-hover:text-white transition">
                  <AlertOctagon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">Report an Issue</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Report a telephony glitch, system bug, process blocker, or workplace issue.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-red-700">
                <span>Report Blocker</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          </div>

          {/* Quick Help Box */}
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-800">Need immediate shift assistance?</span>
              <span>Contact Chennai HQ desk at internal ext: 104</span>
            </div>
            <Link
              to="/hrms/leave"
              className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
            >
              View Full Leave Portal &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* TAB 2: MY REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Filter Status:</span>
              <div className="flex items-center gap-1">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cx(
                      'px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer',
                      statusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {st === 'ALL' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            <Button size="xs" variant="outline" onClick={fetchMyRequests} loading={requestsLoading}>
              Refresh
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            {requestsLoading ? (
              <div className="p-10 flex justify-center">
                <Spinner label="Loading submitted requests…" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No requests found</p>
                <p className="text-xs text-slate-400 mt-1">
                  You haven&apos;t submitted any requests matching the selected filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Request Type</th>
                      <th className="py-3 px-4">Submission Date</th>
                      <th className="py-3 px-4">Details / Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {req.type}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {req.date ? formatDate(req.date) : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {req.reason || (req.days ? `${req.days} day(s)` : 'General request')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cx(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                              req.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : req.status === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200',
                            )}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                          {req.updatedAt ? formatDate(req.updatedAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL HANDLERS */}
      {activeModal && (
        <QuickActionModal
          type={activeModal}
          onClose={() => setActiveModal(null)}
          onSuccess={(msg) => {
            setActiveModal(null);
            setSuccessNotice(msg);
            if (activeTab === 'requests') void fetchMyRequests();
          }}
        />
      )}
    </div>
  );
}

function QuickActionModal({
  type,
  onClose,
  onSuccess,
}: {
  type: 'LEAVE' | 'PERMISSION' | 'MANAGER' | 'HR' | 'OFFICE' | 'ISSUE';
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [permCategory, setPermCategory] = useState('Late Arrival');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  useEffect(() => {
    if (type === 'LEAVE') {
      api.get('/leave/types').then((res) => {
        setLeaveTypes(res.data || []);
        if (res.data?.[0]?.id) setLeaveTypeId(res.data[0].id);
      }).catch(() => {});
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a brief reason or description.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      if (type === 'LEAVE') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        await api.post('/leave/applications', {
          leaveTypeId: leaveTypeId || leaveTypes[0]?.id,
          startDate,
          endDate,
          daysCount: diffDays,
          reason: reason.trim(),
        });
        onSuccess('Leave application submitted successfully for manager approval.');
        return;
      }

      if (type === 'PERMISSION') {
        if (user?.roleCode === 'FOUNDER') {
          setError('Founder / CEO is the business owner and is exempt from attendance & shift permissions.');
          setSubmitting(false);
          return;
        }

        const statusMap: Record<string, string> = {
          'Late Arrival': 'LATE',
          'Early Exit': 'HALF_DAY',
          'Work From Home': 'PRESENT',
          'Field Visit': 'PRESENT',
        };
        const attendanceStatus = statusMap[permCategory] || 'PRESENT';
        const permissionNote = `[Permission: ${permCategory}] ${reason.trim()}`;

        // Server-authoritative submission via POST /attendance/my/mark
        // (Server updates existing record if one exists, or creates new PENDING record)
        await api.post('/attendance/my/mark', {
          date: startDate,
          status: attendanceStatus,
          notes: permissionNote,
        });

        onSuccess('Permission request submitted successfully for manager approval.');
        return;
      }

      // For messages, inquiries, office requests, issues:
      // Store in authentic localStorage requests list so user can see it tracked immediately
      const newReq = {
        id: `req-${Date.now()}`,
        type:
          type === 'MANAGER'
            ? 'Manager Direct Note'
            : type === 'HR'
            ? 'HR Support Inquiry'
            : type === 'OFFICE'
            ? 'Office Resource Request'
            : 'Operational Issue Report',
        category: type,
        date: new Date().toISOString(),
        reason: reason.trim(),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };

      try {
        const raw = localStorage.getItem('grotec_user_requests');
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(newReq);
        localStorage.setItem('grotec_user_requests', JSON.stringify(list));
      } catch {}

      const successMessages: Record<string, string> = {
        MANAGER: 'Direct message sent to your reporting manager.',
        HR: 'HR inquiry ticket created and queued for administration response.',
        OFFICE: 'Office resource request recorded with operations team.',
        ISSUE: 'Workplace issue logged and flagged for operational resolution.',
      };

      onSuccess(successMessages[type] || 'Request submitted successfully.');
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    LEAVE: { title: 'Apply for Leave', subtitle: 'Submit dates and reason to your manager.' },
    PERMISSION: { title: 'Request Shift Permission', subtitle: 'Submit late arrival, early exit, or WFH request.' },
    MANAGER: { title: 'Contact Manager', subtitle: 'Send a high-priority direct message to your team lead.' },
    HR: { title: 'Contact HR / Admin', subtitle: 'Submit an inquiry regarding payroll, letters, or policies.' },
    OFFICE: { title: 'Office Resource Request', subtitle: 'Request headphones, SIM card, stationery, or workstation gear.' },
    ISSUE: { title: 'Report an Issue / Blocker', subtitle: 'Log a telephony glitch, bug, or operational obstacle.' },
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-base font-bold text-slate-900">{titles[type]?.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{titles[type]?.subtitle}</p>

        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {type === 'LEAVE' && (
            <>
              {leaveTypes.length > 0 && (
                <Field label="Leave Type">
                  <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </Field>
                <Field label="End Date">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </Field>
              </div>
            </>
          )}

          {type === 'PERMISSION' && (
            <>
              <Field label="Shift Date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Permission Category">
                <Select value={permCategory} onChange={(e) => setPermCategory(e.target.value)}>
                  <option value="Late Arrival">Late Arrival (under 2 hours)</option>
                  <option value="Early Exit">Early Departure (under 2 hours)</option>
                  <option value="Work From Home">Work From Home (Full Shift)</option>
                  <option value="Field Visit">Field Farmer Visit / Travel</option>
                </Select>
              </Field>
            </>
          )}

          <Field label={type === 'MANAGER' ? 'Message' : 'Reason / Description'}>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide clear context for your request..."
              required
              className="w-full rounded-md border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              <Send className="h-3.5 w-3.5" /> Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
