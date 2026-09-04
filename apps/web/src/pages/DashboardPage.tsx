import { MonthPlaceholder } from './MonthPlaceholder';

export function DashboardPage() {
  return (
    <MonthPlaceholder
      title="Telecaller Dashboard"
      month="Month 5"
      description="The daily work overview — who to contact today and what is pending per customer. Metrics will be computed from real CRM data only."
      bullets={[
        "Today's assigned calls",
        'Pending follow-ups with overdue clearly distinguished',
        'New leads, interested and converted customers',
        'Completed calls and follow-up reminders',
        'Recent CRM activity',
      ]}
    />
  );
}
