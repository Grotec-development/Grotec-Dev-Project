/**
 * Demo accounts helper.
 * 1-Tap Credential Fill for all system roles:
 * Super Admin, Founder, Manager, Telecaller / Agent, Delivery, Staff, etc.
 * Enabled by default on preview/demo environments unless explicitly set to false via VITE_SHOW_DEMO_ACCOUNTS=false.
 */

export interface DemoAccount {
  role: string;
  label: string;
  email: string;
  password?: string;
  badge: string;
  category?: 'Management' | 'Calling' | 'Operations';
}

const SHOULD_SHOW = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

export const DEMO_ACCOUNTS: DemoAccount[] = SHOULD_SHOW
  ? [
      {
        role: 'SUPER_ADMIN',
        label: 'Super Admin',
        email: 'superadmin@grotec.local',
        password: 'SuperAdmin@Grotec2026!',
        badge: 'System Admin',
        category: 'Management',
      },
      {
        role: 'FOUNDER',
        label: 'Founder & CEO',
        email: 'founder@grotec.local',
        password: 'Founder@Grotec2026!',
        badge: 'Executive',
        category: 'Management',
      },
      {
        role: 'MANAGER',
        label: 'Operations Manager',
        email: 'manager@grotec.local',
        password: 'Manager@Grotec2026!',
        badge: 'Operations',
        category: 'Management',
      },
      {
        role: 'AGENT',
        label: 'Telecaller (Agent 1)',
        email: 'agent_1@grotec.local',
        password: 'Agent1@Grotec2026!',
        badge: 'Dialer Queue',
        category: 'Calling',
      },
      {
        role: 'AGENT',
        label: 'Telecaller (Agent 2)',
        email: 'agent_2@grotec.local',
        password: 'Agent2@Grotec2026!',
        badge: 'Outbound',
        category: 'Calling',
      },
      {
        role: 'AGENT',
        label: 'Senior Telecaller',
        email: 'agent@grotec.local',
        password: 'Agent@Grotec2026!',
        badge: 'Advisory',
        category: 'Calling',
      },
      {
        role: 'DELIVERY',
        label: 'Field Delivery',
        email: 'delivery@grotec.local',
        password: 'Delivery@Grotec2026!',
        badge: 'Field Ops',
        category: 'Operations',
      },
      {
        role: 'STAFF',
        label: 'Office & HR Staff',
        email: 'staff@grotec.local',
        password: 'Staff@Grotec2026!',
        badge: 'HR / Internal',
        category: 'Operations',
      },
      {
        role: 'FARMER_SUCCESS_MANAGER',
        label: 'Farmer Success Manager',
        email: 'manager@grotec.local',
        password: 'Manager@Grotec2026!',
        badge: 'Success Lead',
        category: 'Management',
      },
      {
        role: 'STORES_DISPATCH',
        label: 'Stores / Dispatch',
        email: 'staff@grotec.local',
        password: 'Staff@Grotec2026!',
        badge: 'Inventory / Trip',
        category: 'Operations',
      },
    ]
  : [];

export const DEMO_ALIASES: Record<string, string> = SHOULD_SHOW
  ? {
      founder: 'founder@grotec.local',
      manager: 'manager@grotec.local',
      fsm: 'manager@grotec.local',
      agent: 'agent@grotec.local',
      agent1: 'agent_1@grotec.local',
      agent_1: 'agent_1@grotec.local',
      telecaller: 'agent_1@grotec.local',
      telecaller1: 'agent_1@grotec.local',
      agent2: 'agent_2@grotec.local',
      agent_2: 'agent_2@grotec.local',
      telecaller2: 'agent_2@grotec.local',
      agent3: 'agent_3@grotec.local',
      agent_3: 'agent_3@grotec.local',
      staff: 'staff@grotec.local',
      hr: 'staff@grotec.local',
      delivery: 'delivery@grotec.local',
      driver: 'delivery@grotec.local',
      admin: 'superadmin@grotec.local',
      superadmin: 'superadmin@grotec.local',
    }
  : {};

export const isDemoAccountsEnabled = (): boolean => SHOULD_SHOW;
