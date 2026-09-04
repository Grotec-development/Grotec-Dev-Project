import type { PermissionCode, RoleCode } from '@grotec/shared';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  permissions: PermissionCode[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerSummary {
  id: string;
  farmerCode: string | null;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE';
  primaryPhone: string | null;
  phoneCount: number;
  createdAt: string;
}

export interface CustomerPhone {
  id: string;
  phone: string;
  rawInput: string | null;
  kind: 'MOBILE' | 'OTHER';
  isPrimary: boolean;
}

export interface CustomerLocation {
  id: string;
  addressLine: string | null;
  state: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
  pincode: string | null;
  isPrimary: boolean;
}

export interface CustomerCrop {
  id: string;
  crop: { id: string; code: string; name: string; localName: string | null };
  acreage: number;
  unit: string;
  notes: string | null;
}

export interface CustomerLead {
  id: string;
  status: string;
  source: string | null;
  notes: string | null;
  createdAt: string;
  currentOwner: { id: string; fullName: string } | null;
}

export interface CustomerDetail {
  id: string;
  farmerCode: string | null;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
  phones: CustomerPhone[];
  locations: CustomerLocation[];
  crops: CustomerCrop[];
  leads: CustomerLead[];
}

export interface Crop {
  id: string;
  code: string;
  name: string;
  localName: string | null;
  category: string | null;
  isActive: boolean;
}

export interface Lead {
  id: string;
  customer: { id: string; fullName: string; status: 'ACTIVE' | 'INACTIVE' };
  status: 'OPEN' | 'CLOSED';
  source: string | null;
  notes: string | null;
  createdAt: string;
  owner: { id: string; fullName: string } | null;
}

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE';
  role: { id: string; code: RoleCode; name: string };
  createdAt: string;
}

export interface AssistantSource {
  id: string;
  cropId: string;
  cropName: string;
  problemKeywords: string[];
  recommendedProducts: string[];
  usageGuidance: string | null;
}

export interface KnowledgeGuidance {
  id: string;
  cropId: string;
  crop: { id: string; code: string; name: string; category: string | null };
  problemType: string | null;
  problemKeywords: string[];
  recommendedProducts: string[];
  usageGuidance: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantChatResponse {
  status: 'answered' | 'unavailable';
  conversationId: string;
  answer: string;
  sources: AssistantSource[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { fields?: unknown };
    matchedCustomer?: { id: string; fullName: string; status: string; phone: string } | null;
  };
}

export type CallStatus = 'DIALING' | 'RINGING' | 'CONNECTED' | 'ENDED' | 'NOT_ANSWERED' | 'FAILED';

export type CallOutcome = 'INTERESTED' | 'NOT_INTERESTED' | 'NOT_ANSWERED';
export type NextAction = 'CALLBACK' | 'SALES';
export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface FollowUp {
  id: string;
  dueAt: string;
  note: string;
  status: FollowUpStatus;
  completedAt: string | null;
  agent: { id: string; fullName: string } | null;
  customer?: { id: string; fullName: string; farmerCode: string | null } | null;
}

export interface OutcomeRecordResult {
  call: Call;
  followUp: FollowUp | null;
  relationshipOwner: { id: string; fullName: string } | null;
  messageStatus: 'PENDING' | 'SENT' | 'FAILED' | null;
}

export interface CallNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string };
}

export interface Call {
  id: string;
  customerId: string | null;
  leadId: string | null;
  agentId: string;
  phoneNumber: string;
  direction: 'OUTBOUND';
  status: CallStatus;
  outcome: CallOutcome | null;
  nextAction: NextAction | null;
  provider: string;
  providerCallId: string;
  connectedAt: string | null;
  startedAt: string;
  endedAt: string | null;
  disconnectReason: string | null;
  createdAt: string;
  updatedAt: string;
  notes: CallNote[];
}

export interface CallContext {
  call: Call;
  customer: CustomerDetail | null;
  history: Call[];
  followUps: FollowUp[];
  relationshipOwner: { id: string; fullName: string } | null;
}

export interface RelationshipHolder {
  id: string;
  fullName: string;
  email: string;
  customerCount: number;
}

export interface RelationshipPortfolioItem {
  customer: {
    id: string;
    farmerCode: string | null;
    fullName: string;
    status: 'ACTIVE' | 'INACTIVE';
    primaryPhone: string | null;
    location: { village: string | null; taluk: string | null; district: string | null; state: string | null } | null;
    crops: Array<{ id: string; cropId: string; name: string; acreage: number; unit: string }>;
  };
  owner: { id: string; fullName: string } | null;
  assignedAt: string | null;
  reason: string | null;
  convertedAt: string | null;
  pendingFollowUps: number;
  lastCall: {
    id: string;
    status: CallStatus;
    outcome: CallOutcome | null;
    nextAction: NextAction | null;
    startedAt: string;
    phoneNumber: string;
  } | null;
}

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string; email: string };
}

export type DashboardRange = 'day' | 'week' | 'month';
export type PipelineState = 'converted' | 'open' | 'interested' | 'not_interested' | 'never_reached';

export interface DashboardSummary {
  scope: 'me' | 'team';
  window: DashboardRange;
  calls: { dialedToday: number; connectedToday: number; completedToday: number; notAnsweredToday: number };
  followUps: { pending: number; overdue: number; dueToday: number; completedToday: number };
  leads: { open: number; newThisWeek: number; closedTotal: number };
  customers: { total: number; converted: number; interested: number };
  pipeline: Array<{ state: PipelineState; count: number }>;
  pipelineTotal: number;
  recentActivity: Array<{
    kind: 'call';
    id: string;
    customerName: string | null;
    phoneNumber: string;
    status: CallStatus;
    outcome: CallOutcome | null;
    startedAt: string;
  }>;
}

export interface PipelineDrilldownItem {
  id: string;
  farmerCode: string | null;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE';
  primaryPhone: string | null;
  location: { village: string | null; taluk: string | null; district: string | null; state: string | null } | null;
  crops: Array<{ name: string; acreage: number; unit: string }>;
}

export interface PipelineDrilldown {
  state: PipelineState;
  total: number;
  items: PipelineDrilldownItem[];
}

export interface QueueItem {
  leadId: string;
  source: string | null;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  owner: { id: string; fullName: string } | null;
  customer: {
    id: string;
    farmerCode: string | null;
    fullName: string;
    primaryPhone: string | null;
    crops: Array<{
      crop: { id: string; code: string; name: string; localName: string | null };
      acreage: number;
      unit: string;
    }>;
  };
  lastCall: {
    id: string;
    phoneNumber: string;
    status: CallStatus;
    disconnectReason: string | null;
    startedAt: string;
    endedAt: string | null;
  } | null;
}
