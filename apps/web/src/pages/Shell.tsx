import { ComponentType, ReactNode, Suspense, lazy } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/format';
import { Spinner } from '../components/ui';
import { AssistantProvider } from '../assistant/AssistantContext';
import { AssistantWidget } from '../assistant/AssistantWidget';
import { NotificationCenter } from '../components/NotificationCenter';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
}

// CRM nav is role-filtered like every other group: Dashboard is available to
// everyone with CRM access; the Agent workspace needs call.read; the RM
// workspace needs relationship.read (Manager/Founder).
const CRM_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'CRM Dashboard', icon: LayoutDashboard, permission: 'customer.read' },
  { to: '/agent', label: 'Agent workspace', icon: Phone, permission: 'call.read' },
  { to: '/relationship-manager', label: 'Relationship Manager', icon: UserRoundCheck, permission: 'relationship.read' },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen, permission: 'assistant.use' },
];

const RECORD_ITEMS: NavItem[] = [
  { to: '/customers', label: 'Customers', icon: Contact, permission: 'customer.read' },
  { to: '/leads', label: 'Leads', icon: Users, permission: 'lead.read' },
  { to: '/crops', label: 'Crops', icon: Sprout, permission: 'crop.read' },
];



const ADMIN_ITEMS: NavItem[] = [
  { to: '/team', label: 'Team', icon: ShieldCheck, permission: 'employee.read' },
  { to: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.read' },
];

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className="px-3">
      <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            target="_self"
            onClick={(e) => {
              e.preventDefault();
              navigate(item.to);
            }}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
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

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking session…" />
      </div>
    );
  }
  if (status === 'anon' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const crmVisible = CRM_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));
  const recordsVisible = RECORD_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));
  const hrmsItems: NavItem[] = [
    { to: '/hrms', label: 'HRMS Dashboard', icon: LayoutDashboard, permission: 'hrms.read' },
    { to: '/hrms/employees', label: 'Employees', icon: Users, permission: 'employee.read' },
    { to: '/hrms/attendance', label: 'Attendance', icon: Clock, permission: 'attendance.read' },
    { to: '/hrms/leave', label: 'Leave Management', icon: Palmtree, permission: 'leave.read' },
    { to: '/hrms/payroll', label: 'Payroll Runs', icon: IndianRupee, permission: 'payroll.manage' },
    {
      to: '/hrms/payslips',
      label: hasPermission('payroll.manage') ? 'Payslips & Reports' : 'My Payslips',
      icon: FileText,
      permission: 'payroll.read',
    },
    {
      to: '/hrms/kpi',
      label: hasPermission('kpi.manage') ? 'KPI & Performance' : 'My Performance',
      icon: TrendingUp,
      permission: 'kpi.read',
    },
  ];
  const hrmsVisible = hrmsItems.filter((i) => !i.permission || hasPermission(i.permission));
  const adminVisible = ADMIN_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));

  const hasAnyAccess = crmVisible.length > 0 || recordsVisible.length > 0 || hrmsVisible.length > 0 || adminVisible.length > 0;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">G</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">GROTEC FarmerOS</p>
            <p className="text-xs text-slate-500">CRM & HRMS Operations</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          {!hasAnyAccess ? (
            <div className="px-5 py-4 text-sm text-slate-500">
              Your role has no accessible modules. Please contact an administrator.
            </div>
          ) : (
            <>
              {crmVisible.length > 0 && <NavGroup title="CRM" items={crmVisible} />}
              {recordsVisible.length > 0 && <NavGroup title="Records" items={recordsVisible} />}
              {hrmsVisible.length > 0 && <NavGroup title="HRMS & Operations" items={hrmsVisible} />}
              {adminVisible.length > 0 && <NavGroup title="Administration" items={adminVisible} />}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {initialsOf(user.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.roleCode}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign out"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 bg-slate-50 min-h-screen">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {location.pathname.startsWith('/hrms') ? 'HRMS & Operations' : 'FarmerOS CRM'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-400">Phase 1 Single Identity</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
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
