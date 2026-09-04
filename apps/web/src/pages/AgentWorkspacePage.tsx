import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';
import { MonthPlaceholder } from './MonthPlaceholder';

export function AgentWorkspacePage() {
  return (
    <div>
      <MonthPlaceholder
        title="Agent Calling Workspace"
        month="Month 2"
        description="A full-screen calling workspace — not a lead table. Customer context appears alongside call controls while dialling through the telecaller's own SIM."
        bullets={[
          'Dial → customer context → call → record outcome → next action → follow-up/sales progression',
          'Existing-customer detection by phone number with duplicate prevention',
          'Auto-dialer behind an internal provider abstraction (vendor TBD)',
          'Call history, notes, follow-up history and call-state display',
        ]}
      />
      <div className="px-8">
        <Card className="max-w-2xl p-5">
          <p className="mb-3 text-sm text-slate-600">
            Meanwhile, month 1 already exposes the phone-resolution and customer-profile building blocks this workspace will use:
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/customers">
              <Button variant="outline" size="sm">
                Customer records
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="outline" size="sm">
                Lead queue
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
