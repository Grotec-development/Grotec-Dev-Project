import { ComponentType, ReactNode, Suspense, lazy } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Phone,
  UserRoundCheck,
  BookOpen,
  Users,
  Contact,
  Sprout,
  ShieldCheck,
  ScrollText,
  LogOut,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/format';
import { Spinner } from '../components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
}

const CRM_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: 'M5' },
  { to: '/agent', label: 'Agent', icon: Phone, badge: 'M2' },
  { to: '/relationship-manager', label: 'Relationship Manager', icon: UserRoundCheck, badge: 'M4' },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen, badge: 'M4' },
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
  return (
    <div className="px-3">
      <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
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

  const noCrmAccess = !hasPermission('customer.read') && !hasPermission('lead.read') && !hasPermission('audit.read') && !hasPermission('employee.read') && !hasPermission('crop.read');

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">G</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">GROTEC FarmerOS</p>
            <p className="text-xs text-slate-500">CRM</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          {noCrmAccess ? (
            <div className="px-5 py-4 text-sm text-slate-500">
              Your role has no CRM access in this phase (HRMS/payroll arrives later).
            </div>
          ) : (
            <>
              <NavGroup title="CRM" items={CRM_ITEMS} />
              <NavGroup title="Records" items={RECORD_ITEMS.filter((i) => !i.permission || hasPermission(i.permission))} />
              <NavGroup title="Administration" items={ADMIN_ITEMS.filter((i) => !i.permission || hasPermission(i.permission))} />
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

      <main className="ml-64 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
