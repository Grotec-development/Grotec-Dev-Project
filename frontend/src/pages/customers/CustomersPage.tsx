import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Plus, Search, ChevronLeft, ChevronRight, RotateCcw, Upload, Users } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { ApiErrorBody, CustomerSummary, Page } from '../../lib/types';
import { formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Card, EmptyState, Input, Select, StatusBadge, Table, TableSkeleton, TD, TH, THead, cx } from '../../components/ui';
import { NewCustomerModal } from './NewCustomerModal';
import { ImportCustomersModal } from './ImportCustomersModal';
import { FarmerSegmentsModal } from './FarmerSegmentsModal';

export function CustomersPage() {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [crop, setCrop] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['customers', q, status, page],
    queryFn: async () => {
      const res = await api.get<Page<CustomerSummary>>('/customers', {
        params: { q: q || undefined, status: status || undefined, page, pageSize: 50 },
      });
      return res.data;
    },
  });

  const canCreate = hasPermission('customer.create');
  const canImport = (user?.roleCode === 'FOUNDER' || user?.roleCode === 'MANAGER' || hasPermission('customer.import')) && canCreate;

  // Real farmer list populated directly from live database records
  const farmerList = useMemo(() => {
    if (!data?.items) return [];
    return data.items.map((item) => {
      let formattedContact = '—';
      if (item.lastContactAt) {
        try {
          const date = new Date(item.lastContactAt);
          const diffMs = Date.now() - date.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays === 0) formattedContact = 'Today';
          else if (diffDays === 1) formattedContact = 'Yesterday';
          else if (diffDays < 7) formattedContact = `${diffDays} days ago`;
          else if (diffDays < 30) formattedContact = `${Math.floor(diffDays / 7)}w ago`;
          else formattedContact = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch {
          formattedContact = '—';
        }
      }
      return {
        ...item,
        district: item.district || '—',
        taluk: item.taluk || '—',
        crops: item.crops || '—',
        rm: item.rm || 'Unassigned',
        lastContact: formattedContact,
      };
    });
  }, [data]);

  const filteredFarmerList = useMemo(() => {
    return farmerList.filter((f) => {
      if (district && f.district !== district) return false;
      if (crop && !f.crops.toLowerCase().includes(crop.toLowerCase())) return false;
      return true;
    });
  }, [farmerList, district, crop]);

  const hasActiveFilters = Boolean(q || district || crop || (status && status !== 'ACTIVE'));
  const activeFilterText = [
    q ? `search "${q}"` : '',
    district ? `district "${district}"` : '',
    crop ? `crop "${crop}"` : '',
    status && status !== 'ACTIVE' ? `status "${status}"` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const handleClearFilters = () => {
    setQ('');
    setDistrict('');
    setCrop('');
    setStatus('ACTIVE');
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header bar matching PDF Farmer Directory */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Farmer Directory</h1>
          <p className="text-xs text-slate-500">Centralized farmer database and relationship profiles.</p>
        </div>
        <div className="flex items-center gap-2">
          {canImport ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 text-xs font-semibold shadow-xs gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSegments(true)}
            className="px-3 py-1.5 text-xs font-semibold shadow-xs gap-1.5 text-purple-700 hover:text-purple-800 border-purple-200 bg-purple-50/50 hover:bg-purple-100/50"
          >
            <Users className="h-3.5 w-3.5 text-purple-600" /> Farmer Segments
          </Button>
          {canCreate ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreate(true)}
              className="px-3.5 py-1.5 text-xs font-semibold shadow-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Farmer
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filter and Search Bar matching PDF */}
      <Card className="shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200/90 bg-white px-4 py-3">
          {/* District Dropdown */}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
            aria-label="Filter by district"
          >
            <option value="">District: All Tamil Nadu</option>
            <option value="Dharmapuri">Dharmapuri</option>
            <option value="Trichy">Trichy</option>
            <option value="Erode">Erode</option>
            <option value="Coimbatore">Coimbatore</option>
            <option value="Tanjore">Tanjore</option>
            <option value="Salem">Salem</option>
            <option value="Pudukkottai">Pudukkottai</option>
          </select>

          {/* Crop Dropdown */}
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
            aria-label="Filter by crop"
          >
            <option value="">Crop: All Crops</option>
            <option value="Tomato">Tomato</option>
            <option value="Paddy">Paddy</option>
            <option value="Sugarcane">Sugarcane</option>
            <option value="Turmeric">Turmeric</option>
            <option value="Banana">Banana</option>
            <option value="Coconut">Coconut</option>
            <option value="Cotton">Cotton</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
            aria-label="Filter by status"
          >
            <option value="">Status: All Statuses</option>
            <option value="ACTIVE">Status: Active</option>
            <option value="INACTIVE">Status: Inactive</option>
            <option value="NEW">Status: New</option>
          </select>

          {/* Search Input */}
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none"
              placeholder="Search farmers, crops, RMs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search farmers"
            />
          </div>
          {isFetching ? <span className="text-[11px] text-slate-400">refreshing…</span> : null}
        </div>

        {/* Data Table */}
        {isError ? (
          <div className="p-5">
            <Alert tone="error">
              <div className="flex items-center justify-between">
                <span>Failed to load farmer directory: {errorMessage(error)}</span>
                <Button size="xs" variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : !data ? (
          <TableSkeleton rows={7} cols={8} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>NAME</TH>
                  <TH>PHONE</TH>
                  <TH>DISTRICT</TH>
                  <TH>TALUK</TH>
                  <TH>CROPS</TH>
                  <TH>LAST CONTACT</TH>
                  <TH>STATUS</TH>
                  <TH>ASSIGNED RM</TH>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {filteredFarmerList.length === 0 ? (
                  <tr>
                    <TD colSpan={8} className="py-10">
                      <EmptyState
                        title={hasActiveFilters ? "No farmers match current filters" : "No farmer records found"}
                        description={
                          hasActiveFilters
                            ? `No records found matching ${activeFilterText}. You can clear active filters to see all registered farmers.`
                            : "Register a farmer to start managing crop cycles, bio-input advisories, and relationship calls."
                        }
                        action={
                          hasActiveFilters ? (
                            <Button variant="outline" size="sm" onClick={handleClearFilters}>
                              <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                            </Button>
                          ) : canCreate ? (
                            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                              <Plus className="h-3.5 w-3.5" /> Add Farmer
                            </Button>
                          ) : null
                        }
                      />
                    </TD>
                  </tr>
                ) : (
                  filteredFarmerList.map((farmer) => (
                    <tr key={farmer.id} className="hover:bg-slate-50/70 transition-colors">
                      <TD>
                        <Link
                          to={`/customers/${farmer.id}`}
                          className="font-bold text-slate-900 hover:text-brand-700 hover:underline"
                        >
                          {farmer.fullName}
                        </Link>
                      </TD>
                      <TD className="font-mono text-[11px] text-slate-600">
                        {farmer.primaryPhone ? formatE164(farmer.primaryPhone) : '—'}
                      </TD>
                      <TD className="text-slate-700 font-medium">{farmer.district}</TD>
                      <TD className="text-slate-600">{farmer.taluk}</TD>
                      <TD className="text-slate-700 font-medium">{farmer.crops}</TD>
                      <TD className="text-slate-500 text-[11px]">{farmer.lastContact}</TD>
                      <TD>
                        <StatusBadge status={farmer.status} />
                      </TD>
                      <TD className="text-slate-700 font-semibold">{farmer.rm}</TD>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}

        {/* Pagination Footer matching PDF: Showing 1-12 of 2,847 farmers | Previous 1 2 3 Next */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200/90 bg-slate-50/40 px-4 py-3 text-xs text-slate-500">
          <span>
            Showing {farmerList.length ? (page - 1) * 50 + 1 : 0}–{(page - 1) * 50 + farmerList.length} of{' '}
            {(data?.total ?? 0).toLocaleString('en-IN')} farmers
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              className={cx(
                'rounded px-2.5 py-1 text-xs font-bold transition',
                page === 1 ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setPage(1)}
            >
              1
            </button>
            <button
              type="button"
              className={cx(
                'rounded px-2.5 py-1 text-xs font-bold transition',
                page === 2 ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setPage(2)}
            >
              2
            </button>
            <button
              type="button"
              className={cx(
                'rounded px-2.5 py-1 text-xs font-bold transition',
                page === 3 ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setPage(3)}
            >
              3
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {showCreate ? (
        <NewCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
            window.location.assign(`/customers/${id}`);
          }}
        />
      ) : null}

      {showImport ? (
        <ImportCustomersModal
          open={showImport}
          onClose={() => setShowImport(false)}
        />
      ) : null}

      {showSegments ? (
        <FarmerSegmentsModal
          onClose={() => setShowSegments(false)}
        />
      ) : null}
    </div>
  );
}

export function duplicateMatch(error: unknown): ApiErrorBody['error']['matchedCustomer'] | null {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.code === 'CUSTOMER_PHONE_EXISTS') return body.error.matchedCustomer ?? null;
  }
  return null;
}