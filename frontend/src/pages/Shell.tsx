import { ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Phone,
  UserRoundCheck,
  Users,
  Contact,
  Sprout,
  ShieldCheck,
  ScrollText,
  BookOpen,
  LogOut,
  Clock,
  Palmtree,
  IndianRupee,
  FileText,
  TrendingUp,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/format';
import { Spinner } from '../components/ui';
import { AssistantProvider } from '../assistant/AssistantContext';
import { AssistantWidget } from '../assistant/AssistantWidget';
import { NotificationCenter } from '../components/NotificationCenter';
import { PageHead } from '../components/PageHead';
import { Breadcrumb, type BreadcrumbItem } from '../components/Breadcrumb';
import { GrotecLogo } from '../components/GrotecLogo';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
}

// Core navigation items matching the PDF mockups
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'customer.read' },
  { to: '/customers', label: 'Farmers', icon: Users, permission: 'customer.read' },
  { to: '/agent', label: 'Calls', icon: Phone, permission: 'call.read' },
  { to: '/crops', label: 'Crops', icon: Sprout, permission: 'crop.read' },
  { to: '/hrms', label: 'Reports', icon: FileText, permission: 'hrms.read' },
  { to: '/team', label: 'Settings', icon: Settings, permission: 'employee.read' },
];

// Additional CRM & Operations tools
const CRM_EXPANDED_ITEMS: NavItem[] = [
  { to: '/leads', label: 'Leads Pipeline', icon: Contact, permission: 'lead.read' },
  { to: '/relationship-manager', label: 'Relationship Mgr', icon: UserRoundCheck, permission: 'relationship.read' },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen, permission: 'assistant.use' },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText, permission: 'audit.read' },
];

function getHrmsNavItems(roleCode: string | undefined, hasPermission: (perm: string) => boolean): NavItem[] {
  const isFounder = roleCode === 'FOUNDER';
  const isSelfOnly = roleCode === 'AGENT' || roleCode === 'DELIVERY';
  const isManager = roleCode === 'MANAGER';
  const isStaff = roleCode === 'STAFF';

  const items: NavItem[] = [];

  // Staff Directory (Founder, Manager)
  if (hasPermission('employee.read')) {
    items.push({ to: '/hrms/employees', label: 'Staff Directory', icon: Users });
  }

  // Attendance
  if (isFounder) {
    if (hasPermission('attendance.approve') || hasPermission('hrms.attendance.manage')) {
      items.push({ to: '/hrms/attendance', label: 'Team Attendance', icon: Clock });
    }
  } else if (isManager) {
    if (hasPermission('attendance.read') || hasPermission('attendance.approve')) {
      items.push({ to: '/hrms/attendance', label: 'Attendance', icon: Clock });
    }
  } else {
    // Agent, Staff
    if (hasPermission('attendance.read')) {
      items.push({ to: '/hrms/attendance', label: 'My Attendance', icon: Clock });
    }
  }

  // Leave
  if (isFounder) {
    if (hasPermission('leave.approve') || hasPermission('hrms.leave.manage')) {
      items.push({ to: '/hrms/leave', label: 'Team Leave', icon: Palmtree });
    }
  } else if (isManager) {
    if (hasPermission('leave.read') || hasPermission('leave.approve')) {
      items.push({ to: '/hrms/leave', label: 'Leave Requests', icon: Palmtree });
    }
  } else {
    // Agent, Staff
    if (hasPermission('leave.read') || hasPermission('leave.apply')) {
      items.push({ to: '/hrms/leave', label: 'My Leave', icon: Palmtree });
    }
  }

  // Payroll Runs (Staff, Manager, Founder)
  if (hasPermission('payroll.manage') || hasPermission('hrms.payroll.approve')) {
    items.push({ to: '/hrms/payroll', label: 'Payroll Runs', icon: IndianRupee });
  }

  // Payslips (Founder does NOT have personal payslips; Manager, Staff, Agent do)
  if (!isFounder && hasPermission('payroll.read')) {
    items.push({
      to: '/hrms/payslips',
      label: (isSelfOnly || isStaff) ? 'My Payslips' : 'Payslips',
      icon: FileText,
    });
  }

  // KPI & Scores
  if (isFounder) {
    if (hasPermission('kpi.manage') || hasPermission('hrms.kpi.configure')) {
      items.push({ to: '/hrms/kpi', label: 'Team KPI', icon: TrendingUp });
    }
  } else if (isManager) {
    if (hasPermission('kpi.read') || hasPermission('kpi.manage')) {
      items.push({ to: '/hrms/kpi', label: 'KPI & Scores', icon: TrendingUp });
    }
  } else {
    // Agent, Staff
    if (hasPermission('kpi.read')) {
      items.push({ to: '/hrms/kpi', label: 'My Performance', icon: TrendingUp });
    }
  }

  return items;
}

interface PageMeta {
  title: string;
  description: string;
  crumbs: BreadcrumbItem[];
}

function getPageMeta(pathname: string, roleCode?: string): PageMeta {
  const isFounder = roleCode === 'FOUNDER';
  const isSelfOnly = roleCode === 'AGENT' || roleCode === 'DELIVERY' || roleCode === 'STAFF';

  if (/^\/hrms\/employees\/.+/.test(pathname)) {
    return { title: 'Employee Profile', description: 'Employee HRMS details and records.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Staff', href: '/hrms/employees' }, { label: 'Profile' }] };
  }
  if (/^\/customers\/.+/.test(pathname)) {
    return { title: 'Farmer Profile / CRM Record', description: 'Comprehensive farmer details, agricultural profile, and call history.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Farmers', href: '/customers' }, { label: 'Farmer Profile' }] };
  }
  if (/^\/hrms\/payslips\/.+/.test(pathname)) {
    return { title: 'Payslip Detail', description: 'Payslip breakdown and statutory deductions.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Payslips', href: '/hrms/payslips' }, { label: 'Detail' }] };
  }

  const attendanceTitle = isFounder ? 'Team Attendance' : isSelfOnly ? 'My Attendance' : 'Attendance Management';
  const attendanceDesc = isFounder
    ? 'Team attendance logs, biometric punches from ESSL devices, and approval queues.'
    : isSelfOnly
    ? 'Personal daily check-in, punch history, and monthly attendance status.'
    : 'Biometric and manual attendance rosters with self-service and team approvals.';

  const leaveTitle = isFounder ? 'Team Leave' : isSelfOnly ? 'My Leave' : 'Leave Management';
  const leaveDesc = isFounder
    ? 'Team leave requests, balances, and approval queue.'
    : isSelfOnly
    ? 'Personal leave balances, apply for time off, and application history.'
    : 'Leave requests and approvals.';

  const kpiTitle = isFounder ? 'Team KPI' : isSelfOnly ? 'My Performance' : 'KPI & Performance';
  const kpiDesc = isFounder
    ? 'CRM telecaller scorecard, conversion rates, and period score evaluations.'
    : isSelfOnly
    ? 'Personal monthly KPI achievement, calling activity, and evaluation scorecard.'
    : 'Performance metrics and appraisal scores.';

  const payslipsTitle = isSelfOnly ? 'My Payslips' : 'Payslips';
  const payslipsDesc = isSelfOnly
    ? 'Your salary slips, statutory deductions, and payment records.'
    : 'Salary slips and deductions.';

  const map: Record<string, PageMeta> = {
    '/': { title: 'Telecaller Workstation', description: 'Call queue, follow-ups, and farmer engagements.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Telecaller Workstation' }] },
    '/dashboard': { title: 'Telecaller Workstation', description: 'Call queue, follow-ups, and farmer engagements.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Telecaller Workstation' }] },
    '/agent': { title: 'Telecaller Workstation', description: 'Telecaller calling workspace — dial queue and log outcomes.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Calls', href: '/agent' }] },
    '/calling': { title: 'Active Outbound Call', description: 'Live outbound call session in progress.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Calls', href: '/agent' }, { label: 'Active Call' }] },
    '/relationship-manager': { title: 'Relationship Manager', description: 'Converted farmer portfolio and field assignment.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Relationship Manager' }] },
    '/customers': { title: 'Farmer Directory', description: 'Farmer master — search by name, phone, district, or crop.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Farmer Directory' }] },
    '/leads': { title: 'Leads Pipeline', description: 'Open, interested, and converted farmer inquiries.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Leads' }] },
    '/crops': { title: 'Crop Catalog', description: 'Reference catalog of crops serviced by GROTEC organic agri-inputs.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Crops' }] },
    '/knowledge-base': { title: 'Knowledge Base', description: 'AI crop advisory guidelines and field solutions.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Base' }] },
    '/team': { title: 'Settings & Team', description: 'Team access, roles, and administrative configuration.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Settings' }] },
    '/audit': { title: 'Audit Trail', description: 'System audit log of operations.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Settings' }, { label: 'Audit' }] },
    '/hrms': { title: 'HRMS Reports', description: 'Operations and staff overview.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }] },
    '/hrms/dashboard': { title: 'HRMS Reports', description: 'Operations and staff overview.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }] },
    '/hrms/employees': { title: 'Staff Directory', description: 'Employee records and role management.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: 'Staff' }] },
    '/hrms/attendance': { title: attendanceTitle, description: attendanceDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: attendanceTitle }] },
    '/hrms/leave': { title: leaveTitle, description: leaveDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: leaveTitle }] },
    '/hrms/payroll': { title: 'Payroll Runs', description: 'Monthly payroll generation and slips.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: 'Payroll' }] },
    '/hrms/payslips': { title: payslipsTitle, description: payslipsDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: payslipsTitle }] },
    '/hrms/kpi': { title: kpiTitle, description: kpiDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports' }, { label: kpiTitle }] },
    '/restricted': { title: 'Access Restricted', description: 'You do not have permission to view this section.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Restricted' }] },
  };

  return map[pathname] ?? { title: 'GROTEC FarmerOS', description: 'GROTEC FarmerOS Platform', crumbs: [{ label: 'Home', href: '/' }] };
}

function NavGroup({ title, items }: { title?: string; items: NavItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className="px-3">
      {title ? (
        <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      ) : null}
      <nav className="space-y-0.5" aria-label={title || 'Navigation'}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.to);
            }}
            aria-label={item.label}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
                isActive
                  ? 'bg-brand-50 text-brand-700 font-bold border-l-2 border-brand-600'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{item.badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Shell() {
  const { status, user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const pageMeta = getPageMeta(location.pathname, user?.roleCode);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="Checking session…" />
      </div>
    );
  }
  if (status === 'anon' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const isFounder = user.roleCode === 'FOUNDER';
  const isSelfOnly = user.roleCode === 'AGENT' || user.roleCode === 'DELIVERY' || user.roleCode === 'STAFF';
  const hrmsGroupTitle = isFounder
    ? 'Team & Operations'
    : isSelfOnly
    ? 'My HR & Self-Service'
    : 'Operations & HRMS';

  const primaryVisible = PRIMARY_NAV_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));
  const crmExtraVisible = CRM_EXPANDED_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));
  const hrmsVisible = getHrmsNavItems(user.roleCode, hasPermission);

  return (
    <div className="flex min-h-screen bg-canvas">
      <PageHead title={pageMeta.title} description={pageMeta.description} />

      {/* Persistent Left Sidebar matching PDF */}
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200/90 bg-white z-50 shadow-xs" aria-label="Main navigation">
        {/* Header Brand Logo linking to homepage */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3 bg-white">
          <GrotecLogo to="/dashboard" size="sm" subtitle="FarmerOS v2.4" />
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          <NavGroup items={primaryVisible} />

          {crmExtraVisible.length > 0 && (
            <NavGroup title="CRM Tools" items={crmExtraVisible} />
          )}

          {hrmsVisible.length > 0 && (
            <NavGroup title={hrmsGroupTitle} items={hrmsVisible} />
          )}
        </div>

        {/* Bottom Session Footer matching PDF: Priya S. / Chennai Head Office / Connected to Telephony */}
        <div className="border-t border-slate-200/90 bg-slate-50/50 p-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 border border-slate-200 shadow-xs"
              aria-hidden="true"
            >
              {initialsOf(user.fullName || 'Priya S.')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900 leading-tight">{user.fullName || 'Priya S.'}</p>
              <p className="truncate text-[10px] text-slate-400 font-medium">Chennai Head Office</p>
              <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected to Telephony
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-60 flex-1 bg-canvas min-h-screen">
        {/* Top Header Bar matching PDF */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/90 bg-white/95 px-6 backdrop-blur shadow-xs">
          <div className="flex items-center gap-3">
            <div className="md:hidden shrink-0">
              <GrotecLogo to="/dashboard" size="xs" variant="mark-only" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">{pageMeta.title}</h1>
              <Breadcrumb items={pageMeta.crumbs} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search farmers, crops, RMs..."
                className="w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                aria-label="Search farmers, crops, RMs"
              />
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <div className="h-8 w-8 rounded-full bg-brand-50 border border-brand-200/80 flex items-center justify-center text-xs font-bold text-brand-700 shadow-xs">
                {initialsOf(user.fullName || 'Priya S.')}
              </div>
            </div>
          </div>
        </header>

        <AssistantProvider>
          <Outlet />
          <AssistantWidget />
        </AssistantProvider>
      </main>
    </div>
  );
}