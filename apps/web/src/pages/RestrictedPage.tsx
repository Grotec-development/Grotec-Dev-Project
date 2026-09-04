import { Alert, Card } from '../components/ui';

export function RestrictedPage() {
  return (
    <div className="p-8">
      <Card className="max-w-lg p-6">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">Access restricted</h1>
        <Alert tone="error">You do not have permission to view this section. Contact the Founder if you believe this is wrong.</Alert>
      </Card>
    </div>
  );
}
