import { createBrowserRouter } from 'react-router-dom';
import { Shell } from './pages/Shell';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { AgentWorkspacePage } from './pages/AgentWorkspacePage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { LeadsPage } from './pages/leads/LeadsPage';
import { RelationshipPage } from './pages/relationship/RelationshipPage';
import { CropsPage } from './pages/CropsPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { TeamPage } from './pages/TeamPage';
import { AuditPage } from './pages/AuditPage';
import { RestrictedPage } from './pages/RestrictedPage';
import { HrmsDashboardPage } from './pages/hrms/HrmsDashboardPage';
import { EmployeesPage } from './pages/hrms/EmployeesPage';
import { EmployeeProfilePage } from './pages/hrms/EmployeeProfilePage';
import { AttendancePage } from './pages/hrms/AttendancePage';
import { LeavePage } from './pages/hrms/LeavePage';
import { PayrollPage } from './pages/hrms/PayrollPage';
import { PayslipsPage } from './pages/hrms/PayslipsPage';
import { KpiPage } from './pages/hrms/KpiPage';
import { ReportsPage } from './pages/ReportsPage';
import { ActionCenterPage } from './pages/ActionCenterPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { FactoryPage } from './pages/factory/FactoryPage';
import { DispatchPage } from './pages/dispatch/DispatchPage';
import { DeliveryMobilePage } from './pages/delivery/DeliveryMobilePage';
import { ExceptionCentrePage } from './pages/exceptions/ExceptionCentrePage';

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
