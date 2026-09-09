import { ReactNode, useEffect, useState } from 'react';
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
  Trophy,
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Briefcase,
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

// Core CRM daily operations items
const CRM_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'customer.read' },
  { to: '/agent', label: 'Agent Mode', icon: Phone, permission: 'call.read' },
  { to: '/relationship-manager', label: 'Relationship Mgr', icon: UserRoundCheck, permission: 'relationship.read' },
  { to: '/action-center', label: 'Action Center', icon: Briefcase, permission: 'call.read' },
  { to: '/customers', label: 'Farmers', icon: Users, permission: 'customer.read' },
  { to: '/leads', label: 'Leads Pipeline', icon: Contact, permission: 'lead.read' },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen, permission: 'assistant.use' },
  { to: '/crops', label: 'Crop Catalog', icon: Sprout, permission: 'crop.read' },
  { to: '/reports', label: 'Reports & Rankings', icon: Trophy, permission: 'call.read' },
];

/**
 * AGENT-only simplified workspace: telecallers see just the four daily-driver
 * destinations. This narrows VISIBILITY for that one role — routes, backend
 * APIs and RBAC permissions are untouched, and every other role keeps the
 * navigation it has today.
 */
const AGENT_PRIMARY_NAV = new Set([
  '/dashboard',
  '/agent',
  '/action-center',
  '/customers',
  // Relationship Manager is allow-listed for AGENT, but the RBAC filter below
  // still applies: it only renders once the role actually holds
  // `relationship.read`, which AGENT does not carry today.
  '/relationship-manager',
]);

/**
 * FOUNDER-only: these five destinations are hidden from the founder's primary
 * navigation. Same rule as above — VISIBILITY for one role. Routes, pages,
 * APIs and permissions are untouched, and the founder keeps direct-URL access.
 */
const FOUNDER_HIDDEN_NAV = new Set([
  '/action-center',
  '/leads',
  '/knowledge-base',
  '/crops',
  '/reports',
]);

// Administration & Settings (Founder & Manager only)
const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/team', label: 'Settings & Team', icon: Settings, permission: 'employee.read' },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText, permission: 'audit.read' },
];

function getHrmsNavItems(roleCode: string | undefined, hasPermission: (perm: string) => boolean): NavItem[] {
  const isFounder = roleCode === 'FOUNDER';
  const isSelfOnly = roleCode === 'AGENT' || roleCode === 'DELIVERY';
  const isManager = roleCode === 'MANAGER';
  const isStaff = roleCode === 'STAFF';

  const items: NavItem[] = [];

  // HRMS Overview Dashboard (Founder & Manager)
  if (isFounder || isManager) {
    if (hasPermission('hrms.read')) {
      items.push({ to: '/hrms', label: 'Operations Overview', icon: FileText });
    }
  }

  // Staff Directory (Founder, Manager, Staff)
  if (hasPermission('employee.read') || hasPermission('hrms.employee.read')) {
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
    // Agent, Staff, Delivery
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
    // Agent, Staff, Delivery
    if (hasPermission('leave.read') || hasPermission('leave.apply')) {
      items.push({ to: '/hrms/leave', label: 'My Leave', icon: Palmtree });
    }
  }

  // Payroll Runs (Staff, Manager, Founder)
  if (hasPermission('payroll.manage') || hasPermission('hrms.payroll.process') || hasPermission('hrms.payroll.approve')) {
    items.push({ to: '/hrms/payroll', label: 'Payroll Runs', icon: IndianRupee });
  }

  // Payslips (Founder does NOT have personal payslips; Manager, Staff, Agent, Delivery do)
  if (!isFounder && (hasPermission('payroll.read') || hasPermission('hrms.payroll.read'))) {
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
    // Agent, Staff, Delivery
    if (hasPermission('kpi.read') || hasPermission('hrms.kpi.read')) {
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
    '/action-center': { title: 'Action Center', description: 'Quick employee requests, administrative self-service, and submission tracking.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Action Center' }] },
    '/hrms/action-center': { title: 'Action Center', description: 'Quick employee requests, administrative self-service, and submission tracking.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations', href: '/hrms' }, { label: 'Action Center' }] },
    '/customers': { title: 'Farmer Directory', description: 'Farmer master — search by name, phone, district, or crop.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Farmer Directory' }] },
    '/leads': { title: 'Leads Pipeline', description: 'Open, interested, and converted farmer inquiries.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Leads' }] },
    '/crops': { title: 'Crop Catalog', description: 'Reference catalog of crops serviced by GROTEC organic agri-inputs.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Crops' }] },
    '/reports': { title: 'Operational Reports & Leaderboard', description: 'Real-time operational activity logs, follow-up discipline, and telecaller rankings.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Reports & Leaderboard' }] },
    '/knowledge-base': { title: 'Knowledge Base', description: 'AI crop advisory guidelines and field solutions.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Knowledge Base' }] },
    '/team': { title: 'Settings & Team', description: 'Team access, roles, and administrative configuration.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Settings' }] },
    '/audit': { title: 'Audit Trail', description: 'System audit log of operations.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Settings' }, { label: 'Audit' }] },
    '/hrms': { title: 'Operations & HRMS Overview', description: 'Operations and staff overview.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }] },
    '/hrms/dashboard': { title: 'Operations & HRMS Overview', description: 'Operations and staff overview.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }] },
    '/hrms/employees': { title: 'Staff Directory', description: 'Employee records and role management.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: 'Staff' }] },
    '/hrms/attendance': { title: attendanceTitle, description: attendanceDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: attendanceTitle }] },
    '/hrms/leave': { title: leaveTitle, description: leaveDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: leaveTitle }] },
    '/hrms/payroll': { title: 'Payroll Runs', description: 'Monthly payroll generation and slips.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: 'Payroll' }] },
    '/hrms/payslips': { title: payslipsTitle, description: payslipsDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: payslipsTitle }] },
    '/hrms/kpi': { title: kpiTitle, description: kpiDesc, crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations' }, { label: kpiTitle }] },
    '/restricted': { title: 'Access Restricted', description: 'You do not have permission to view this section.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Restricted' }] },
  };

  return map[pathname] ?? { title: 'GROTEC FarmerOS', description: 'GROTEC FarmerOS Platform', crumbs: [{ label: 'Home', href: '/' }] };
}

function NavGroup({
  title,
  items,
  isExpanded = true,
  onItemClick,
}: {
  title?: string;
  items: NavItem[];
  isExpanded?: boolean;
  onItemClick?: () => void;
}) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className={isExpanded ? 'px-3' : 'px-2'}>
      {title && isExpanded ? (
        <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-opacity duration-150">
          {title}
        </p>
      ) : null}
      <nav className="space-y-1" aria-label={title || 'Navigation'}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(e) => {
              e.preventDefault();
              onItemClick?.();
              navigate(item.to);
            }}
            title={!isExpanded ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) =>
              cx(
                'flex items-center rounded-md text-xs font-semibold transition-all cursor-pointer group',
                isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2.5',
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
              )
            }
          >
            <item.icon className={cx('h-4 w-4 shrink-0 transition-transform group-hover:scale-105', !isExpanded && 'mx-auto')} aria-hidden="true" />
            {isExpanded && <span className="flex-1 truncate">{item.label}</span>}
            {isExpanded && item.badge ? (
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
  const navigate = useNavigate();
  const pageMeta = getPageMeta(location.pathname, user?.roleCode);

  const isHrmsPath = location.pathname.startsWith('/hrms');
  const isStaffOrDelivery = user?.roleCode === 'STAFF' || user?.roleCode === 'DELIVERY';

  // For Staff & Delivery, HRMS is their primary workspace and stays visible.
  // For Agent, Founder, and Manager, HRMS opens cleanly on tap or when on an /hrms/* route.
  const [hrmsExpanded, setHrmsExpanded] = useState<boolean>(() => isHrmsPath || Boolean(isStaffOrDelivery));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);

  // Expanded whenever hovered, pinned, focused, or on mobile drawer open
  const isNavExpanded = mobileMenuOpen || sidebarPinned || sidebarHovered || sidebarFocused;

  // Synchronize expansion with active route
  useEffect(() => {
    if (isHrmsPath) {
      setHrmsExpanded(true);
    } else if (!isStaffOrDelivery) {
      // Auto-collapse HRMS when navigating back to primary CRM sections
      setHrmsExpanded(false);
    }
    setMobileMenuOpen(false);
  }, [location.pathname, isHrmsPath, isStaffOrDelivery]);

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
  const isManager = user.roleCode === 'MANAGER';
  const isSelfOnly = user.roleCode === 'AGENT' || user.roleCode === 'DELIVERY';

  const hrmsGroupTitle = isFounder
    ? 'Team & Operations'
    : isManager
    ? 'Operations & HRMS'
    : isSelfOnly
    ? 'My HR & Self-Service'
    : 'Staff & Operations';

  // Filter accessible items based on authoritative RBAC
  const isAgent = user.roleCode === 'AGENT';
  const crmVisible = CRM_NAV_ITEMS.filter(
    (i) =>
      (!isAgent || AGENT_PRIMARY_NAV.has(i.to)) &&
      (!isFounder || !FOUNDER_HIDDEN_NAV.has(i.to)) &&
      (!i.permission || hasPermission(i.permission)),
  );
  const hrmsVisible = isAgent ? [] : getHrmsNavItems(user.roleCode, hasPermission);
  const adminVisible = ADMIN_NAV_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));

  const handleCrmItemClick = () => {
    if (!isStaffOrDelivery) {
      setHrmsExpanded(false);
    }
    setMobileMenuOpen(false);
  };

  const handleHrmsItemClick = (to: string) => {
    setMobileMenuOpen(false);
    navigate(to);
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <PageHead title={pageMeta.title} description={pageMeta.description} />

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Compact Icon Rail by default, Smoothly Expands on Hover / Focus / Pin) */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        onFocusCapture={() => setSidebarFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSidebarFocused(false);
          }
        }}
        className={cx(
          'fixed inset-y-0 left-0 flex flex-col border-r border-slate-200/90 bg-white z-50 transition-all duration-200 ease-in-out',
          mobileMenuOpen
            ? 'w-60 translate-x-0 shadow-2xl'
            : isNavExpanded
            ? 'w-60 translate-x-0 shadow-xl'
            : 'w-16 -translate-x-full md:translate-x-0 shadow-xs',
        )}
        aria-label="Main navigation"
      >
        {/* Header Brand Logo */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-3.5 py-3 bg-white h-14">
          <div className="flex items-center gap-2 min-w-0">
            <GrotecLogo
              to="/dashboard"
              size="sm"
              variant={isNavExpanded ? 'full' : 'mark-only'}
              subtitle={isNavExpanded ? 'FarmerOS v2.4' : undefined}
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Desktop Pin / Collapse Accessible Toggle */}
            <button
              type="button"
              onClick={() => setSidebarPinned((p) => !p)}
              className={cx(
                'hidden md:inline-flex p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition',
                !isNavExpanded && 'hidden',
                sidebarPinned && 'text-emerald-700 bg-emerald-50',
              )}
              title={sidebarPinned ? 'Unpin navigation' : 'Pin navigation expanded'}
              aria-label={sidebarPinned ? 'Unpin navigation' : 'Pin navigation expanded'}
            >
              <ChevronRight className={cx('h-4 w-4 transition-transform', sidebarPinned && 'rotate-180')} />
            </button>
            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3 overflow-x-hidden">
          {/* Primary CRM Workspace */}
          {crmVisible.length > 0 && (
            <NavGroup
              title={crmVisible.length > 4 ? 'CRM' : undefined}
              items={crmVisible}
              isExpanded={isNavExpanded}
              onItemClick={handleCrmItemClick}
            />
          )}

          {/* HRMS & Self-Service Section */}
          {hrmsVisible.length > 0 && (
            <div className={isNavExpanded ? 'px-3 pt-1' : 'px-2 pt-1'}>
              {/* For Staff/Delivery without CRM, show direct title */}
              {isStaffOrDelivery ? (
                <NavGroup
                  title={hrmsGroupTitle}
                  items={hrmsVisible}
                  isExpanded={isNavExpanded}
                  onItemClick={() => setMobileMenuOpen(false)}
                />
              ) : (
                <>
                  {/* Collapsible Section Header Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isNavExpanded) {
                        setSidebarPinned(true);
                        setHrmsExpanded(true);
                      } else {
                        setHrmsExpanded((prev) => !prev);
                      }
                    }}
                    aria-expanded={hrmsExpanded}
                    title={!isNavExpanded ? hrmsGroupTitle : undefined}
                    className={cx(
                      'w-full flex items-center rounded-md text-xs font-semibold transition-all cursor-pointer select-none',
                      isNavExpanded ? 'justify-between gap-2.5 px-3 py-2' : 'justify-center p-2.5',
                      isHrmsPath
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelfOnly ? (
                        <Palmtree className={cx('h-4 w-4 shrink-0', isHrmsPath ? 'text-emerald-700' : 'text-slate-500')} />
                      ) : (
                        <Briefcase className={cx('h-4 w-4 shrink-0', isHrmsPath ? 'text-emerald-700' : 'text-slate-500')} />
                      )}
                      {isNavExpanded && <span className="truncate">{hrmsGroupTitle}</span>}
                    </div>
                    {isNavExpanded && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                          {hrmsVisible.length}
                        </span>
                        {hrmsExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Secondary Submenu — Revealed cleanly on tap */}
                  {hrmsExpanded && isNavExpanded && (
                    <div className="mt-1 ml-3.5 pl-2 border-l-2 border-slate-200/80 space-y-0.5">
                      {hrmsVisible.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={(e) => {
                            e.preventDefault();
                            handleHrmsItemClick(item.to);
                          }}
                          aria-label={item.label}
                          className={({ isActive }) =>
                            cx(
                              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                              isActive
                                ? 'bg-brand-50 text-brand-700 font-bold'
                                : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800',
                            )
                          }
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Administration & Management Section */}
          {adminVisible.length > 0 && (
            <NavGroup
              title="Admin"
              items={adminVisible}
              isExpanded={isNavExpanded}
              onItemClick={() => setMobileMenuOpen(false)}
            />
          )}
        </div>

        {/* Bottom Session Footer */}
        <div className={cx('border-t border-slate-200/90 bg-slate-50/50 transition-all', isNavExpanded ? 'p-3.5' : 'p-2 flex flex-col items-center')}>
          <div className={cx('flex items-center', isNavExpanded ? 'gap-2.5' : 'justify-center')}>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 border border-slate-200 shadow-xs relative"
              aria-hidden="true"
              title={user.fullName || 'Priya S.'}
            >
              {initialsOf(user.fullName || 'Priya S.')}
              {!isNavExpanded && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-white" />
              )}
            </div>
            {isNavExpanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900 leading-tight">{user.fullName || 'Priya S.'}</p>
                <p className="truncate text-[10px] text-slate-400 font-medium">Chennai Head Office</p>
                <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </p>
              </div>
            )}
            {isNavExpanded && (
              <button
                type="button"
                onClick={() => void logout()}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area — Desktop offset matches compact icon rail w-16 to preserve wide workspace */}
      <main className="md:ml-16 flex-1 bg-canvas min-h-screen transition-all">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 md:px-6 backdrop-blur shadow-xs">
          <div className="flex items-center gap-3">
            {/* Hamburger Button on Mobile */}
            <button
              type="button"
              className="md:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
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
