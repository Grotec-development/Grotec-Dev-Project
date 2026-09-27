import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Plus, Search, ChevronLeft, ChevronRight, RotateCcw, Upload, Users, Trash2, Eye, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { ApiErrorBody, CustomerSummary, Page } from '../../lib/types';
import { formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { getDistricts } from '../../lib/location-data';
import { Alert, Button, Card, ConfirmModal, EmptyState, Input, Select, StatusBadge, Table, TableSkeleton, TD, TH, THead, cx } from '../../components/ui';
import { NewCustomerModal } from './NewCustomerModal';
import { ImportCustomersModal } from './ImportCustomersModal';
import { FarmerSegmentsModal } from './FarmerSegmentsModal';

export function CustomersPage() {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [missingTalukOnly, setMissingTalukOnly] = useState(false);
  const [crop, setCrop] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const [page, setPage] = useState(1);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableDistricts = useMemo(() => getDistricts('Tamil Nadu'), []);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['customers', q, district, missingTalukOnly, status, page],
    queryFn: async () => {
      const res = await api.get<Page<CustomerSummary>>('/customers', {
        params: {
          q: q || undefined,
          district: district || undefined,
          missingTaluk: missingTalukOnly ? 'true' : undefined,
          status: status || undefined,
          page,
          pageSize: 50,
        },
      });
      return res.data;
    },
    refetchInterval: 12_000,
  });

  const canCreate = hasPermission('customer.create');
  const canDelete = hasPermission('customer.delete') || canCreate;
  const canImport = (user?.roleCode === 'FOUNDER' || user?.roleCode === 'MANAGER' || hasPermission('customer.import')) && canCreate;

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/customers/${customerToDelete.id}`);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCustomerToDelete(null);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

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
      if (crop && !f.crops.toLowerCase().includes(crop.toLowerCase())) return false;
      return true;
    });
  }, [farmerList, crop]);

  const hasActiveFilters = Boolean(q || district || missingTalukOnly || crop || (status && status !== 'ACTIVE'));
  const activeFilterText = [
    q ? `search "${q}"` : '',
    district ? `district "${district}"` : '',
    missingTalukOnly ? 'missing taluk only' : '',
    crop ? `crop "${crop}"` : '',
    status && status !== 'ACTIVE' ? `status "${status}"` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const handleClearFilters = () => {
    setQ('');
    setDistrict('');
    setMissingTalukOnly(false);
    setCrop('');
    setStatus('ACTIVE');
    setPage(1);
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
            onChange={(e) => {
              setDistrict(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
            aria-label="Filter by district"
          >
            <option value="">District: All Tamil Nadu</option>
            {availableDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Missing Taluk Quick Toggle */}
          <button
            type="button"
            onClick={() => {
              setMissingTalukOnly((prev) => !prev);
              setPage(1);
            }}
            className={cx(
              'rounded-md px-2.5 py-1.5 text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer',
              missingTalukOnly
                ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs font-bold'
                : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100'
            )}
            title="Filter farmers with missing Taluk"
          >
            <AlertTriangle className={cx('h-3.5 w-3.5', missingTalukOnly ? 'text-amber-700' : 'text-slate-400')} />
            <span>Missing Taluk</span>
          </button>

          {/* Crop Dropdown */}
          <select
            value={crop}
            onChange={(e) => {
              setCrop(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
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
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
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
          <TableSkeleton rows={7} cols={9} />
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
                  <TH className="text-right">ACTIONS</TH>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {filteredFarmerList.length === 0 ? (
                  <tr>
                    <TD colSpan={9} className="py-10">
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
                        <div className="flex items-center gap-1">
                          <span>{farmer.primaryPhone ? formatE164(farmer.primaryPhone) : '—'}</span>
                          {farmer.phoneCount > 1 && (
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-sans font-medium text-slate-500">
                              +{farmer.phoneCount - 1}
                            </span>
                          )}
                        </div>
                      </TD>
                      <TD className="text-slate-700 font-medium">{farmer.district || '—'}</TD>
                      <TD>
                        {farmer.taluk ? (
                          <span className="text-slate-700">{farmer.taluk}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Missing Taluk
                          </span>
                        )}
                      </TD>
                      <TD className="text-slate-700 font-medium">{farmer.crops || '—'}</TD>
                      <TD className="text-slate-500 text-[11px]">{farmer.lastContact}</TD>
                      <TD>
                        <StatusBadge status={farmer.status} />
                      </TD>
                      <TD className="text-slate-700 font-semibold">{farmer.rm || '—'}</TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/agent?customerId=${farmer.id}&name=${encodeURIComponent(farmer.fullName)}`}
                            className="rounded p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title="Call Farmer in Calling Workspace"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            to={`/customers/${farmer.id}`}
                            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="View Customer Profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setCustomerToDelete({ id: farmer.id, fullName: farmer.fullName })}
                              className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Delete Customer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TD>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(customerToDelete)}
          onClose={() => setCustomerToDelete(null)}
          onConfirm={handleDeleteCustomer}
          title={`Permanently Delete Customer`}
          variant="danger"
          confirmLabel="Permanently Delete"
          isLoading={isDeleting}
          description={
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-800">
                Are you sure you want to permanently delete this customer?
              </p>
              <p className="text-slate-500 leading-relaxed">
                This will permanently remove <strong>{customerToDelete?.fullName}</strong> and all linked history, notes, calls, follow-ups, and orders from the database. This action cannot be undone.
              </p>
            </div>
          }
        />

        {/* Dynamic Pagination matching total records */}
        {(() => {
          const totalRecords = data?.total ?? 0;
          const totalPages = Math.max(1, Math.ceil(totalRecords / 50));
          const pageNumbers: (number | string)[] = [];
          if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
          } else {
            pageNumbers.push(1);
            if (page > 3) pageNumbers.push('...');
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            for (let i = start; i <= end; i++) pageNumbers.push(i);
            if (page < totalPages - 2) pageNumbers.push('...');
            pageNumbers.push(totalPages);
          }

          return (
            <div className="flex flex-wrap items-center justify-between border-t border-slate-200/90 bg-slate-50/40 px-4 py-3 text-xs text-slate-500 gap-2">
              <span>
                Showing {farmerList.length ? (page - 1) * 50 + 1 : 0}–{(page - 1) * 50 + farmerList.length} of{' '}
                {totalRecords.toLocaleString('en-IN')} farmers (Page {page} of {totalPages})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {pageNumbers.map((p, idx) =>
                  typeof p === 'number' ? (
                    <button
                      key={p}
                      type="button"
                      className={cx(
                        'rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer',
                        page === p
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                      …
                    </span>
                  )
                )}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          );
        })()}
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