import { createBrowserRouter } from 'react-router-dom';
import { Shell } from './pages/Shell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgentWorkspacePage } from './pages/AgentWorkspacePage';
import { RelationshipManagerPage } from './pages/RelationshipManagerPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { LeadsPage } from './pages/leads/LeadsPage';
import { CropsPage } from './pages/CropsPage';
import { TeamPage } from './pages/TeamPage';
import { AuditPage } from './pages/AuditPage';
import { RestrictedPage } from './pages/RestrictedPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'agent', element: <AgentWorkspacePage /> },
      { path: 'relationship-manager', element: <RelationshipManagerPage /> },
      { path: 'knowledge-base', element: <KnowledgeBasePage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'crops', element: <CropsPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'restricted', element: <RestrictedPage /> },
    ],
  },
  { path: '*', element: <LoginPage /> },
]);
