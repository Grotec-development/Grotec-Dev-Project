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
        role: 'FOUNDER',
        label: 'Founder (Super Admin)',
        email: 'founder@grotec.local',
        password: 'Founder@Grotec2026!',
        badge: 'Founder & Governance',
        category: 'Management',
      },
      {
        role: 'MANAGER',
        label: 'Manager',
        email: 'manager@grotec.local',
        password: 'Manager@Grotec2026!',
        badge: 'Supervision, HR, Ops & Finance',
        category: 'Management',
      },
      {
        role: 'TEAM_LEADER',
        label: 'Team Leader',
        email: 'teamleader@grotec.local',
        password: 'TeamLeader@Grotec2026!',
        badge: '4 Callers, Escalations & Feedback',
        category: 'Calling',
      },
      {
        role: 'AGENT',
        label: 'Telecaller (Agent)',
        email: 'agent_1@grotec.local',
        password: 'Agent1@Grotec2026!',
        badge: 'Outbound Dialer & Advisory',
        category: 'Calling',
      },
      {
        role: 'DELIVERY',
        label: 'Delivery Specialist',
        email: 'delivery@grotec.local',
        password: 'Delivery@Grotec2026!',
        badge: 'Dispatch Pipeline & Verification',
        category: 'Operations',
      },
    ]
  : [];

export const DEMO_ALIASES: Record<string, string> = SHOULD_SHOW
  ? {
      founder: 'founder@grotec.local',
      superadmin: 'founder@grotec.local',
      admin: 'founder@grotec.local',
      manager: 'manager@grotec.local',
      operations: 'manager@grotec.local',
      teamleader: 'teamleader@grotec.local',
      tl: 'teamleader@grotec.local',
      agent: 'agent_1@grotec.local',
      agent1: 'agent_1@grotec.local',
      agent_1: 'agent_1@grotec.local',
      telecaller: 'agent_1@grotec.local',
      telecaller1: 'agent_1@grotec.local',
      agent2: 'agent_2@grotec.local',
      agent_2: 'agent_2@grotec.local',
      telecaller2: 'agent_2@grotec.local',
      delivery: 'delivery@grotec.local',
      driver: 'delivery@grotec.local',
      dispatch: 'delivery@grotec.local',
    }
  : {};

export const isDemoAccountsEnabled = (): boolean => SHOULD_SHOW;
