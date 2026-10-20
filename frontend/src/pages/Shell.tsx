import { ReactNode, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Phone,
  Users,
  User,
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
  ChevronLeft,
  Menu,
  X,
  Briefcase,
  ShoppingCart,
  Boxes,
  Factory,
  Truck,
  Navigation,
  AlertTriangle,
  Download,
  Sparkles,
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
import { NetworkStatusIndicator } from '../components/NetworkStatusIndicator';
import { ServerConfigModal } from '../components/ServerConfigModal';
import { AppUpdateModal } from '../components/AppUpdateModal';
import { tenantsApi } from '../lib/api';

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
  { to: '/agent', label: 'Agent Calling', icon: Phone, permission: 'call.read' },
  { to: '/ai-calling', label: 'AI Voice Calling', icon: Sparkles, badge: 'Vapi AI', permission: 'call.read' },
  { to: '/action-center', label: 'Action Center', icon: Briefcase, permission: 'call.read' },
  { to: '/customers', label: 'Farmers', icon: Users, permission: 'customer.read' },
  { to: '/relationship', label: 'Relationship Manager', icon: Contact, permission: 'relationship.read' },
  { to: '/leads', label: 'Leads Pipeline', icon: Contact, permission: 'lead.read' },
  { to: '/tickets', label: 'Support Tickets', icon: AlertTriangle, permission: 'customer.read' },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen, permission: 'assistant.use' },
  { to: '/crops', label: 'Crop Catalog', icon: Sprout, permission: 'crop.read' },
  { to: '/reports', label: 'Reports & Rankings', icon: Trophy, permission: 'call.read' },
];

/**
 * Role-tailored workspace navigation visibility:
 * 1. Founder (Super Admin): Full executive access to all CRM, Operations, Settings & Audit.
 * 2. Manager: Full operational access (Team Leaders, Escalations, HR, Reports, Delivery supervision, Inventory, Sales, Finance).
 * 3. Team Leader: 4 Callers oversight, calling queue, escalations, feedbacks, relationship management, exceptions, and reports.
 * 4. Telecaller (Agent): Core calling workspace, farmer directory, tickets, knowledge base, reports.
 * 5. Delivery: Dispatch pipeline, delivery verification, digital POD, and field intake.
 */
const AGENT_PRIMARY_NAV = new Set([
  '/dashboard',
  '/agent',
  '/ai-calling',
  '/ai-calling-demo',
  '/action-center',
  '/customers',
  '/tickets',
  '/knowledge-base',
  '/reports',
]);

const TEAM_LEADER_PRIMARY_NAV = new Set([
  '/dashboard',
  '/agent',
  '/ai-calling',
  '/ai-calling-demo',
  '/action-center',
  '/customers',
  '/relationship',
  '/leads',
  '/tickets',
  '/knowledge-base',
  '/crops',
  '/reports',
  '/orders',
  '/exceptions',
]);

const DELIVERY_PRIMARY_NAV = new Set([
  '/dashboard',
  '/delivery',
  '/delivery/fleet',
  '/dispatch',
  '/action-center',
  '/customers',
]);

const FOUNDER_HIDDEN_NAV = new Set<string>([]);
const MANAGER_HIDDEN_NAV = new Set<string>([]);

// Administration & Settings (Founder & Manager only)
const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/team', label: 'Settings & Team', icon: Settings, permission: 'employee.read' },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText, permission: 'audit.read' },
];

// Phase 2 Factory, Supply Chain & Logistics items (PRD §18)
const SUPPLY_CHAIN_NAV_ITEMS: NavItem[] = [
  { to: '/orders', label: 'Sales Orders', icon: ShoppingCart, permission: 'orders.read' },
  { to: '/sales', label: 'Completed Sales & Invoices', icon: IndianRupee, permission: 'orders.read' },
  { to: '/inventory', label: 'Inventory Ledger', icon: Boxes, permission: 'inventory.read' },
  { to: '/factory', label: 'Factory & Batches', icon: Factory, permission: 'production.read' },
  { to: '/dispatch', label: '4 Regional Routes & Dispatch', icon: Truck, permission: 'dispatch.read' },
  { to: '/delivery/fleet', label: 'Fleet & Vehicles', icon: Truck, permission: 'dispatch.read' },
  { to: '/delivery/manager', label: 'Delivery & Payment Approvals', icon: ShieldCheck, permission: 'orders.manage' },
  { to: '/delivery', label: 'Field Delivery', icon: Navigation, permission: 'delivery.execute' },
  { to: '/exceptions', label: 'Exception Centre', icon: AlertTriangle, permission: 'exceptions.manage' },
];

function getHrmsNavItems(roleCode: string | undefined, hasPermission: (perm: string) => boolean): NavItem[] {
  const isFounder = roleCode === 'FOUNDER' || roleCode === 'SUPER_ADMIN';
  const isManager = roleCode === 'MANAGER';
  const isTeamLeader = roleCode === 'TEAM_LEADER' || roleCode === 'GROUP_LEADER';
  const isSelfOnly = roleCode === 'AGENT' || roleCode === 'DELIVERY';

  const items: NavItem[] = [];

  // HRMS Overview Dashboard (Founder & Manager)
  if (isFounder || isManager) {
    if (hasPermission('hrms.read')) {
      items.push({ to: '/hrms', label: 'Operations Overview', icon: FileText });
    }
  }

  // Staff & Team Directory (Founder, Manager)
  if (isFounder || isManager) {
    if (hasPermission('employee.read') || hasPermission('hrms.employee.read')) {
      items.push({ to: '/hrms/employees', label: 'Team & Staff Directory', icon: Users });
    }
  }

  // Attendance
  if (isFounder) {
    if (hasPermission('attendance.approve') || hasPermission('hrms.attendance.manage')) {
      items.push({ to: '/hrms/attendance', label: 'Team Attendance', icon: Clock });
    }
  } else if (isManager) {
    if (hasPermission('attendance.read') || hasPermission('attendance.approve')) {
      items.push({ to: '/hrms/attendance', label: 'Attendance Management', icon: Clock });
    }
  } else if (isTeamLeader) {
    if (hasPermission('attendance.read') || hasPermission('attendance.approve')) {
      items.push({ to: '/hrms/attendance', label: 'Caller Attendance', icon: Clock });
    }
  } else {
    // Telecaller, Delivery
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
    // Team Leader, Telecaller, Delivery
    if (hasPermission('leave.read') || hasPermission('leave.apply')) {
      items.push({ to: '/hrms/leave', label: 'My Leave', icon: Palmtree });
    }
  }

  // Payroll Runs (Manager & Founder)
  if ((isFounder || isManager) && (hasPermission('payroll.manage') || hasPermission('hrms.payroll.process') || hasPermission('hrms.payroll.approve'))) {
    items.push({ to: '/hrms/payroll', label: 'Payroll Runs', icon: IndianRupee });
  }

  // Payslips (Founder does NOT have personal payslips; Manager, Team Leader, Agent, Delivery do)
  if (!isFounder && (hasPermission('payroll.read') || hasPermission('hrms.payroll.read'))) {
    items.push({
      to: '/hrms/payslips',
      label: (isSelfOnly || isTeamLeader) ? 'My Payslips' : 'Payslips',
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
      items.push({ to: '/hrms/kpi', label: 'KPI & Performance', icon: TrendingUp });
    }
  } else if (isTeamLeader) {
    if (hasPermission('kpi.read') || hasPermission('hrms.kpi.read')) {
      items.push({ to: '/hrms/kpi', label: 'Caller KPI Scores', icon: TrendingUp });
    }
  } else {
    // Telecaller, Delivery
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
  const isFounder = roleCode === 'FOUNDER' || roleCode === 'SUPER_ADMIN';
  const isManager = roleCode === 'MANAGER';
  const isTeamLeader = roleCode === 'TEAM_LEADER' || roleCode === 'GROUP_LEADER';
  const isDelivery = roleCode === 'DELIVERY';
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

  const homeTitle = isFounder
    ? 'Founder (Super Admin) Workspace'
    : isManager
    ? 'Operations & Business Manager'
    : isTeamLeader
    ? 'Team Leader Workspace'
    : isDelivery
    ? 'Field Delivery & Verification'
    : 'Telecaller Workstation';

  const homeDesc = isFounder
    ? 'Executive CRM overview, performance telemetry, and team activity.'
    : isManager
    ? 'Operations, Team Leaders, escalations, delivery supervision, inventory, sales & finance.'
    : isTeamLeader
    ? 'Telecaller supervision (4 callers), call escalations, customer feedbacks & quality reviews.'
    : isDelivery
    ? 'Order dispatch pipeline, delivery stop execution, customer verification & digital POD.'
    : 'Call queue, follow-ups, and farmer engagements.';

  const map: Record<string, PageMeta> = {
    '/': { title: homeTitle, description: homeDesc, crumbs: [{ label: 'Home', href: '/' }, { label: homeTitle }] },
    '/dashboard': { title: homeTitle, description: homeDesc, crumbs: [{ label: 'Home', href: '/' }, { label: homeTitle }] },
    '/agent': { title: 'Agent Calling Workspace', description: 'Telecaller agent calling workspace — keypad phone dialing, Windows Phone Link, and live farmer note-taking.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Agent Calling', href: '/agent' }] },
    '/calling': { title: 'Active Outbound Call', description: 'Live outbound calling and customer note-taking session.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Agent Calling', href: '/agent' }, { label: 'Active Call' }] },
    '/ai-calling': { title: 'AI Voice Calling (Vapi AI)', description: 'Autonomous conversational AI voice calling for farmer advisory, pest diagnosis, and crop input ordering.', crumbs: [{ label: 'Home', href: '/' }, { label: 'AI Voice Calling' }] },
    '/ai-calling-demo': { title: 'AI Voice Calling (Presentation Demo)', description: 'Presentation demo showing autonomous Tamil & English conversational voice calling with real-time agronomic data extraction.', crumbs: [{ label: 'Home', href: '/' }, { label: 'AI Voice Calling', href: '/ai-calling' }, { label: 'Demo' }] },
    '/action-center': { title: 'Action Center', description: 'Quick employee requests, administrative self-service, and submission tracking.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Action Center' }] },
    '/hrms/action-center': { title: 'Action Center', description: 'Quick employee requests, administrative self-service, and submission tracking.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Operations', href: '/hrms' }, { label: 'Action Center' }] },
    '/customers': { title: 'Farmer Directory', description: 'Farmer master — search by name, phone, district, or crop.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Farmer Directory' }] },
    '/relationship': { title: 'Relationship Manager Portfolio', description: 'Customer relationship ownership, retention, follow-ups, and converted farmer portfolios.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Relationship Manager' }] },
    '/relationship-manager': { title: 'Relationship Manager Portfolio', description: 'Customer relationship ownership, retention, follow-ups, and converted farmer portfolios.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Relationship Manager' }] },
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
    '/orders': { title: 'Sales Orders & Invoicing', description: 'Customer sales orders, fulfillment tracking, and GST tax invoicing.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Sales Orders' }] },
    '/inventory': { title: 'Inventory Ledger', description: 'Multi-state warehouse & vehicle stock tracking with movements audit trail.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Inventory' }] },
    '/factory': { title: 'Factory & Production', description: 'Production batches, formulations, and finished goods register.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Factory' }] },
    '/dispatch': { title: 'Dispatch & Fleet Manifests', description: 'Trip planning, loading bay verification, and closure reconciliation.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Dispatch' }] },
    '/delivery': { title: 'Field Delivery App', description: 'Driver stop execution, digital Proof of Delivery (POD), and field farmer intake.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Delivery' }] },
    '/exceptions': { title: 'Exception Centre', description: 'In-flight quantity adjustments, manager reviews, and invoice revisions.', crumbs: [{ label: 'Home', href: '/' }, { label: 'Exceptions' }] },
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
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2.5',
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600 shadow-2xs ring-1 ring-inset ring-emerald-200/60'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
  const [hrmsExpanded, setHrmsExpanded] = useState<boolean>(() => isHrmsPath || Boolean(isStaffOrDelivery));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('grotec_sidebar_pinned');
      if (stored !== null) return stored === 'true';
    } catch {}
    return true;
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [hoverSuppressed, setHoverSuppressed] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tenantName, setTenantName] = useState<string>('GROTEC Agrotech');
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('grotec_sidebar_pinned', String(next));
      } catch {}
      if (!next) {
        setSidebarHovered(false);
        setHoverSuppressed(true);
      } else {
        setHoverSuppressed(false);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    tenantsApi.getCurrentTenant()
      .then((res) => {
        if (!cancelled && res.data?.name) {
          setTenantName(res.data.name);
        }
      })
      .catch(() => {
        // Fallback to default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Expanded whenever hovered (if not suppressed), pinned, focused, or on mobile drawer open
  const isNavExpanded = mobileMenuOpen || sidebarPinned || (!hoverSuppressed && sidebarHovered) || sidebarFocused;

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

  const isFounder = user.roleCode === 'FOUNDER' || user.roleCode === 'SUPER_ADMIN';
  const isManager = user.roleCode === 'MANAGER';
  const isTeamLeader = user.roleCode === 'TEAM_LEADER' || user.roleCode === 'GROUP_LEADER';
  const isDelivery = user.roleCode === 'DELIVERY';
  const isAgent = user.roleCode === 'AGENT' || user.roleCode === 'FSE';
  const isSelfOnly = isAgent || isDelivery;

  const hrmsGroupTitle = isFounder
    ? 'Team & Operations'
    : isManager
    ? 'Operations & HRMS'
    : isTeamLeader
    ? 'Team & Coaching'
    : isDelivery
    ? 'Delivery Self-Service'
    : 'My HR & Self-Service';

  // Filter accessible items based on authoritative RBAC
  const crmVisible = CRM_NAV_ITEMS.filter(
    (i) =>
      (!isAgent || AGENT_PRIMARY_NAV.has(i.to)) &&
      (!isDelivery || DELIVERY_PRIMARY_NAV.has(i.to)) &&
      (!isTeamLeader || TEAM_LEADER_PRIMARY_NAV.has(i.to)) &&
      (!isFounder || !FOUNDER_HIDDEN_NAV.has(i.to)) &&
      (!isManager || !MANAGER_HIDDEN_NAV.has(i.to)) &&
      (!i.permission || hasPermission(i.permission)),
  );
  const hrmsVisible = getHrmsNavItems(user.roleCode, hasPermission);
  const supplyVisible = SUPPLY_CHAIN_NAV_ITEMS.filter(
    (i) =>
      (!isDelivery || DELIVERY_PRIMARY_NAV.has(i.to)) &&
      (!isTeamLeader || TEAM_LEADER_PRIMARY_NAV.has(i.to)) &&
      (!i.permission || hasPermission(i.permission)),
  );
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
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
          onClick={() => setMobileMenuOpen(false)}
          onTouchEnd={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Compact Icon Rail by default, Smoothly Expands on Hover / Focus / Pin) */}
      <aside
        onMouseEnter={() => {
          if (!hoverSuppressed) setSidebarHovered(true);
        }}
        onMouseLeave={() => {
          setSidebarHovered(false);
          setHoverSuppressed(false);
        }}
        onFocusCapture={() => setSidebarFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSidebarFocused(false);
          }
        }}
        className={cx(
          'fixed inset-y-0 left-0 flex flex-col border-r border-slate-200/90 bg-white z-50 transition-all duration-200 ease-in-out pt-[var(--sat)]',
          mobileMenuOpen
            ? 'w-64 translate-x-0 shadow-2xl'
            : '-translate-x-full md:translate-x-0',
          isNavExpanded ? 'md:w-60 md:shadow-xl' : 'md:w-16 md:shadow-xs',
        )}
        aria-label="Main navigation"
      >
        {/* Header Brand Logo */}
        <div className={cx('flex items-center border-b border-slate-200/90 px-3.5 py-3 bg-white h-16', isNavExpanded ? 'justify-between' : 'justify-between md:justify-center gap-1')}>
          <div className="flex items-center gap-2 min-w-0">
            <GrotecLogo
              to="/dashboard"
              size={isNavExpanded ? 'md' : 'xs'}
              variant={isNavExpanded ? 'full' : 'mark-only'}
              // AGENT workspace hides the version line; '' overrides GrotecLogo's
              // default (undefined would fall back to it). Other roles and the
              // login screen are untouched.
              subtitle={isAgent ? '' : isNavExpanded ? 'FarmerOS v2.4' : undefined}
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Desktop Pin / Collapse Accessible Toggle (Arrow Button) */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={cx(
                'hidden md:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer',
                sidebarPinned
                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900',
              )}
              title={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
              aria-label={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
            >
              {isNavExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {/* Mobile Close Button (Touch optimized min 44x44px) */}
            <button
              type="button"
              className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 touch-manipulation cursor-pointer"
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

          {/* Phase 2: Factory, Supply Chain & Logistics */}
          {supplyVisible.length > 0 && (
            <NavGroup
              title="Supply Chain"
              items={supplyVisible}
              isExpanded={isNavExpanded}
              onItemClick={() => setMobileMenuOpen(false)}
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
        <div className={cx('border-t border-slate-200/90 bg-slate-50/80 transition-all', isNavExpanded ? 'p-3.5' : 'p-2 flex flex-col items-center')}>
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
                <p className="truncate text-xs font-bold text-slate-900 leading-tight">{user.fullName || 'User'}</p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  {user.roleCode === 'FOUNDER' ? 'Founder & CEO' :
                   user.roleCode === 'MANAGER' ? 'Operations Manager' :
                   user.roleCode === 'AGENT' ? 'Telecaller Agent' :
                   user.roleCode === 'STAFF' ? 'Office Staff' :
                   user.roleCode === 'DELIVERY' ? 'Field Delivery' : user.roleCode}
                </p>
              </div>
            )}
            {isNavExpanded ? (
              <button
                type="button"
                onClick={() => void logout()}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void logout()}
                title="Sign out"
                aria-label="Sign out"
                className="mt-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area — Desktop offset matches compact icon rail w-16 or expanded pinned w-60 */}
      <main className={cx('flex-1 min-w-0 bg-canvas min-h-screen pb-28 sm:pb-32 transition-[margin] duration-300', sidebarPinned ? 'md:ml-60' : 'md:ml-16')}>
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 md:px-6 backdrop-blur shadow-xs">
          <div className="flex min-w-0 items-center gap-3">
            {/* Hamburger Button on Mobile (Touch optimized min 44x44px) */}
            <button
              type="button"
              className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 touch-manipulation cursor-pointer"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="md:hidden shrink-0">
              <GrotecLogo to="/dashboard" size="xs" variant="mark-only" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">{pageMeta.title}</h1>
              <div className="hidden sm:block">
                <Breadcrumb items={pageMeta.crumbs} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Organization Workspace Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-medium" title={`Tenant: ${tenantName}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              <span className="truncate max-w-[180px]">{tenantName}</span>
            </div>

            <div className="relative hidden md:block w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search farmers, crops, advisories..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    navigate(`/customers?q=${encodeURIComponent(globalSearch.trim())}`);
                  }
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                aria-label="Search farmers, crops, advisories"
              />
            </div>
            <div className="flex items-center gap-2 relative">
              <NotificationCenter />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="h-8 w-8 rounded-full bg-brand-50 border border-brand-200/80 flex items-center justify-center text-xs font-bold text-brand-700 shadow-xs hover:ring-2 hover:ring-brand-500/30 transition cursor-pointer"
                  aria-expanded={userMenuOpen}
                  aria-label="User profile menu"
                >
                  {initialsOf(user.fullName || 'Priya S.')}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.fullName || 'User'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                        {user.roleCode === 'FOUNDER' ? 'Founder & CEO' : user.roleCode}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate(user.id ? `/hrms/employees/${user.id}` : '/team');
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>My Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setUpdateModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Download App Update (APK)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setServerModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Settings className="h-3.5 w-3.5 text-slate-400" />
                        <span>Server & Network Settings</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void logout();
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium border-t border-slate-100 mt-1"
                      >
                        <LogOut className="h-3.5 w-3.5 text-red-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <NetworkStatusIndicator />

        <AssistantProvider>
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center">
                <Spinner label="Loading…" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
          <AssistantWidget />
        </AssistantProvider>

        {/* Native Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1 shadow-lg grid grid-cols-5 items-center justify-items-center"
          style={{ paddingBottom: 'calc(0.45rem + var(--sab, 0px))' }}
        >
          <NavLink
            to="/dashboard"
            onClick={() => {
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try { navigator.vibrate(12); } catch { /* ignore */ }
              }
            }}
            className={({ isActive }) =>
              cx(
                'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                isActive
                  ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                  : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <LayoutDashboard className="h-4.5 w-4.5 mb-0.5" />
            <span>Home</span>
          </NavLink>

          {isDelivery ? (
            <>
              <NavLink
                to="/delivery"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Navigation className="h-4.5 w-4.5 mb-0.5" />
                <span>Deliveries</span>
              </NavLink>

              <NavLink
                to="/delivery/fleet"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Truck className="h-4.5 w-4.5 mb-0.5" />
                <span>Fleet</span>
              </NavLink>

              <NavLink
                to="/customers"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Users className="h-4.5 w-4.5 mb-0.5" />
                <span>Farmers</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/agent"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Phone className="h-4.5 w-4.5 mb-0.5" />
                <span>Calling</span>
              </NavLink>

              <NavLink
                to="/customers"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Users className="h-4.5 w-4.5 mb-0.5" />
                <span>Farmers</span>
              </NavLink>

              <NavLink
                to="/action-center"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(12); } catch { /* ignore */ }
                  }
                }}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold transition-all touch-tactile',
                    isActive
                      ? 'text-emerald-700 font-bold bg-emerald-50/90 shadow-2xs ring-1 ring-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-800'
                  )
                }
              >
                <Briefcase className="h-4.5 w-4.5 mb-0.5" />
                <span>Actions</span>
              </NavLink>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try { navigator.vibrate(12); } catch { /* ignore */ }
              }
              setMobileMenuOpen(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 w-full rounded-xl text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-all touch-tactile"
          >
            <Menu className="h-4.5 w-4.5 mb-0.5" />
            <span>More</span>
          </button>
        </nav>
      </main>

      {/* Global Modals */}
      <AppUpdateModal isOpen={updateModalOpen} onClose={() => setUpdateModalOpen(false)} />
      <ServerConfigModal isOpen={serverModalOpen} onClose={() => setServerModalOpen(false)} />
    </div>
  );
}
