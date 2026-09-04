import { MonthPlaceholder } from './MonthPlaceholder';

export function KnowledgeBasePage() {
  return (
    <MonthPlaceholder
      title="Knowledge Base"
      month="Month 4"
      description="Crop → problem/issue → recommended solution/product/brand reference for telecallers mid-call."
      bullets={[
        'Search/browse by crop (field, tree, plantation) and by problem or keyword',
        'Recommended product/brand with usage guidance',
        'Telecaller view-and-search access; Founder/Manager content management',
      ]}
    />
  );
}
