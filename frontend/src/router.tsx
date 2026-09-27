import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Shell } from './pages/Shell';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

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

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'agent', element: <AgentWorkspacePage /> },
      { path: 'calling', element: <AgentWorkspacePage /> },
      { path: 'action-center', element: <ActionCenterPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'relationship', element: <RelationshipPage /> },
      { path: 'relationship-manager', element: <RelationshipPage /> },
      { path: 'crops', element: <CropsPage /> },
      { path: 'knowledge-base', element: <KnowledgeBasePage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'hrms', element: <HrmsDashboardPage /> },
      { path: 'hrms/dashboard', element: <HrmsDashboardPage /> },
      { path: 'hrms/employees', element: <EmployeesPage /> },
      { path: 'hrms/employees/:id', element: <EmployeeProfilePage /> },
      { path: 'hrms/attendance', element: <AttendancePage /> },
      { path: 'hrms/leave', element: <LeavePage /> },
      { path: 'hrms/action-center', element: <ActionCenterPage /> },
      { path: 'hrms/payroll', element: <PayrollPage /> },
      { path: 'hrms/payslips', element: <PayslipsPage /> },
      { path: 'hrms/payslips/:id', element: <PayslipsPage /> },
      { path: 'hrms/kpi', element: <KpiPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'restricted', element: <RestrictedPage /> },
      // Phase 2 Factory, Supply Chain & Delivery
      { path: 'orders', element: <OrdersPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'factory', element: <FactoryPage /> },
      { path: 'dispatch', element: <DispatchPage /> },
      { path: 'delivery', element: <DeliveryMobilePage /> },
      { path: 'exceptions', element: <ExceptionCentrePage /> },
    ],
  },
  // Wildcard — proper 404 page instead of silently redirecting to login
  { path: '*', element: <NotFoundPage /> },
]);
