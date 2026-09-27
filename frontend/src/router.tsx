import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Shell } from './pages/Shell';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { RequirePermission } from './components/RequirePermission';

// Route-level code splitting: each page ships as its own chunk so a phone on
// cellular data only downloads the page it's actually visiting, not all ~28
// pages in a single bundle.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AgentWorkspacePage = lazy(() => import('./pages/AgentWorkspacePage').then((m) => ({ default: m.AgentWorkspacePage })));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import('./pages/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const RelationshipPage = lazy(() => import('./pages/relationship/RelationshipPage').then((m) => ({ default: m.RelationshipPage })));
const CropsPage = lazy(() => import('./pages/CropsPage').then((m) => ({ default: m.CropsPage })));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage })));
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })));
const RestrictedPage = lazy(() => import('./pages/RestrictedPage').then((m) => ({ default: m.RestrictedPage })));
const HrmsDashboardPage = lazy(() => import('./pages/hrms/HrmsDashboardPage').then((m) => ({ default: m.HrmsDashboardPage })));
const EmployeesPage = lazy(() => import('./pages/hrms/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const EmployeeProfilePage = lazy(() => import('./pages/hrms/EmployeeProfilePage').then((m) => ({ default: m.EmployeeProfilePage })));
const AttendancePage = lazy(() => import('./pages/hrms/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeavePage = lazy(() => import('./pages/hrms/LeavePage').then((m) => ({ default: m.LeavePage })));
const PayrollPage = lazy(() => import('./pages/hrms/PayrollPage').then((m) => ({ default: m.PayrollPage })));
const PayslipsPage = lazy(() => import('./pages/hrms/PayslipsPage').then((m) => ({ default: m.PayslipsPage })));
const KpiPage = lazy(() => import('./pages/hrms/KpiPage').then((m) => ({ default: m.KpiPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ActionCenterPage = lazy(() => import('./pages/ActionCenterPage').then((m) => ({ default: m.ActionCenterPage })));
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const FactoryPage = lazy(() => import('./pages/factory/FactoryPage').then((m) => ({ default: m.FactoryPage })));
const DispatchPage = lazy(() => import('./pages/dispatch/DispatchPage').then((m) => ({ default: m.DispatchPage })));
const DeliveryMobilePage = lazy(() => import('./pages/delivery/DeliveryMobilePage').then((m) => ({ default: m.DeliveryMobilePage })));
const ExceptionCentrePage = lazy(() => import('./pages/exceptions/ExceptionCentrePage').then((m) => ({ default: m.ExceptionCentrePage })));

import { DedicatedAgentCallingWorkspace } from './pages/calling/DedicatedAgentCallingWorkspace';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'agent', element: <RequirePermission anyOf={['call.read']}><DedicatedAgentCallingWorkspace /></RequirePermission> },
      { path: 'calling', element: <RequirePermission anyOf={['call.read']}><DedicatedAgentCallingWorkspace /></RequirePermission> },
      { path: 'agent-advanced', element: <RequirePermission anyOf={['call.read']}><AgentWorkspacePage /></RequirePermission> },
      { path: 'action-center', element: <ActionCenterPage /> },
      { path: 'customers', element: <RequirePermission anyOf={['customer.read']}><CustomersPage /></RequirePermission> },
      { path: 'customers/:id', element: <RequirePermission anyOf={['customer.read']}><CustomerDetailPage /></RequirePermission> },
      { path: 'leads', element: <RequirePermission anyOf={['lead.read']}><LeadsPage /></RequirePermission> },
      { path: 'relationship', element: <RequirePermission anyOf={['relationship.read']}><RelationshipPage /></RequirePermission> },
      { path: 'relationship-manager', element: <RequirePermission anyOf={['relationship.read']}><RelationshipPage /></RequirePermission> },
      { path: 'crops', element: <RequirePermission anyOf={['crop.read']}><CropsPage /></RequirePermission> },
      { path: 'knowledge-base', element: <RequirePermission anyOf={['assistant.use']}><KnowledgeBasePage /></RequirePermission> },
      { path: 'team', element: <RequirePermission anyOf={['employee.read']}><TeamPage /></RequirePermission> },
      { path: 'audit', element: <RequirePermission anyOf={['audit.read']}><AuditPage /></RequirePermission> },
      { path: 'hrms', element: <RequirePermission anyOf={['hrms.read']}><HrmsDashboardPage /></RequirePermission> },
      { path: 'hrms/dashboard', element: <RequirePermission anyOf={['hrms.read']}><HrmsDashboardPage /></RequirePermission> },
      { path: 'hrms/employees', element: <RequirePermission anyOf={['employee.read', 'hrms.employee.read']}><EmployeesPage /></RequirePermission> },
      { path: 'hrms/employees/:id', element: <RequirePermission anyOf={['employee.read', 'hrms.employee.read']}><EmployeeProfilePage /></RequirePermission> },
      { path: 'hrms/attendance', element: <RequirePermission anyOf={['attendance.read', 'attendance.approve', 'hrms.attendance.read', 'hrms.attendance.manage']}><AttendancePage /></RequirePermission> },
      { path: 'hrms/leave', element: <RequirePermission anyOf={['leave.read', 'leave.apply', 'leave.approve', 'hrms.leave.read', 'hrms.leave.manage']}><LeavePage /></RequirePermission> },
      { path: 'hrms/action-center', element: <ActionCenterPage /> },
      { path: 'hrms/payroll', element: <RequirePermission anyOf={['payroll.manage', 'hrms.payroll.process', 'hrms.payroll.approve']}><PayrollPage /></RequirePermission> },
      { path: 'hrms/payslips', element: <RequirePermission anyOf={['payroll.read', 'hrms.payroll.read']}><PayslipsPage /></RequirePermission> },
      { path: 'hrms/payslips/:id', element: <RequirePermission anyOf={['payroll.read', 'hrms.payroll.read']}><PayslipsPage /></RequirePermission> },
      { path: 'hrms/kpi', element: <RequirePermission anyOf={['kpi.read', 'kpi.manage', 'hrms.kpi.read', 'hrms.kpi.configure']}><KpiPage /></RequirePermission> },
      { path: 'reports', element: <RequirePermission anyOf={['call.read']}><ReportsPage /></RequirePermission> },
      { path: 'restricted', element: <RestrictedPage /> },
      // Phase 2 Factory, Supply Chain & Delivery
      { path: 'orders', element: <RequirePermission anyOf={['orders.read']}><OrdersPage /></RequirePermission> },
      { path: 'inventory', element: <RequirePermission anyOf={['inventory.read']}><InventoryPage /></RequirePermission> },
      { path: 'factory', element: <RequirePermission anyOf={['production.read']}><FactoryPage /></RequirePermission> },
      { path: 'dispatch', element: <RequirePermission anyOf={['dispatch.read']}><DispatchPage /></RequirePermission> },
      { path: 'delivery', element: <RequirePermission anyOf={['delivery.execute', 'delivery.read']}><DeliveryMobilePage /></RequirePermission> },
      { path: 'exceptions', element: <RequirePermission anyOf={['exceptions.manage']}><ExceptionCentrePage /></RequirePermission> },
    ],
  },
  // Wildcard — proper 404 page instead of silently redirecting to login
  { path: '*', element: <NotFoundPage /> },
]);
