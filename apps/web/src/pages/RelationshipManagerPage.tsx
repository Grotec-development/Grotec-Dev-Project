import { MonthPlaceholder } from './MonthPlaceholder';

export function RelationshipManagerPage() {
  return (
    <MonthPlaceholder
      title="Relationship Manager"
      month="Month 4"
      description="Relationship Manager is an ownership concept, not a separate login role. Ownership of converted customers stays distinct from agent lead ownership."
      bullets={[
        'RM ownership with full history and audit trail for ownership changes',
        'My Customers with relationship history, follow-ups and notes',
        'Conversion → RM ownership workflow triggered from the Agent workspace',
        'Ownership visibility and restrictions enforced per the PRD',
      ]}
    />
  );
}
