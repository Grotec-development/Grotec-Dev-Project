/**
 * Demo accounts helper.
 * BUG-001: Demo accounts and 1-Tap Fill credentials MUST ONLY be exposed in development
 * or when explicitly enabled via VITE_SHOW_DEMO_ACCOUNTS=true.
 * In production builds, this resolves to an empty array so dead code elimination strips credentials.
 */

export interface DemoAccount {
  role: string;
  label: string;
  email: string;
  password?: string;
  badge: string;
}

const SHOULD_SHOW = Boolean(
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'
);

export const DEMO_ACCOUNTS: DemoAccount[] = SHOULD_SHOW
  ? [
      {
        role: 'FOUNDER',
        label: 'Founder & CEO',
        email: 'founder@grotec.local',
        badge: 'Executive',
      },
      {
        role: 'MANAGER',
        label: 'Operations Manager',
        email: 'manager@grotec.local',
        badge: 'Operations',
      },
      {
        role: 'AGENT',
        label: 'Telecaller Agent',
        email: 'agent_1@grotec.local',
        badge: 'Calling',
      },
      {
        role: 'DELIVERY',
        label: 'Field Delivery',
        email: 'delivery@grotec.local',
        badge: 'Field Ops',
      },
      {
        role: 'STAFF',
        label: 'Office Staff',
        email: 'staff@grotec.local',
        badge: 'Internal',
      },
    ]
  : [];

export const DEMO_ALIASES: Record<string, string> = SHOULD_SHOW
  ? {
      founder: 'founder@grotec.local',
      manager: 'manager@grotec.local',
      agent: 'agent_1@grotec.local',
      agent1: 'agent_1@grotec.local',
      agent2: 'agent_2@grotec.local',
      agent3: 'agent_3@grotec.local',
      staff: 'staff@grotec.local',
      hr: 'staff@grotec.local',
      delivery: 'delivery@grotec.local',
      driver: 'delivery@grotec.local',
      admin: 'superadmin@grotec.local',
      superadmin: 'superadmin@grotec.local',
    }
  : {};

export const isDemoAccountsEnabled = (): boolean => SHOULD_SHOW;
