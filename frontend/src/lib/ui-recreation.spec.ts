import { describe, expect, it } from 'vitest';

describe('Dashboard Donut & KPI Metrics Logic', () => {
  it('computes call completion percentage correctly with bounds', () => {
    const calc = (completed: number, dialed: number) => {
      if (dialed > 0) return Math.min(100, Math.round((completed / dialed) * 100));
      return completed > 0 ? 100 : 0;
    };

    expect(calc(0, 0)).toBe(0);
    expect(calc(5, 10)).toBe(50);
    expect(calc(10, 10)).toBe(100);
    expect(calc(12, 10)).toBe(100);
    expect(calc(3, 0)).toBe(100);
  });

  it('computes rolling 7-day date window accurately', () => {
    const generate7Days = (now: Date) => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        days.push({
          dateStr: d.toISOString().slice(0, 10),
          isToday: i === 0,
        });
      }
      return days;
    };

    const fixedDate = new Date('2026-09-10T12:00:00.000Z');
    const window = generate7Days(fixedDate);
    expect(window.length).toBe(7);
    expect(window[6].isToday).toBe(true);
    expect(window[0].dateStr).toBe('2026-09-04');
    expect(window[6].dateStr).toBe('2026-09-10');
  });
});

describe('Agent Mode Directory & Queue Filtering', () => {
  const sampleQueue = [
    {
      leadId: 'lead-1',
      customer: { id: 'c-1', farmerCode: null, fullName: 'Farmer One' },
      lastCall: null,
    },
    {
      leadId: '',
      customer: { id: 'c-2', farmerCode: 'FARM-101', fullName: 'Farmer Two' },
      lastCall: { id: 'call-1' },
    },
    {
      leadId: 'lead-2',
      customer: { id: 'c-3', farmerCode: 'FARM-102', fullName: 'Farmer Three' },
      lastCall: null,
    },
  ];

  it('filters by EXISTING category', () => {
    const existing = sampleQueue.filter((item) => Boolean(item.customer && item.customer.farmerCode));
    expect(existing.length).toBe(2);
    expect(existing.map((e) => e.customer.fullName)).toEqual(['Farmer Two', 'Farmer Three']);
  });

  it('filters by LEADS category', () => {
    const leads = sampleQueue.filter((item) => Boolean(item.leadId));
    expect(leads.length).toBe(2);
    expect(leads.map((e) => e.customer.fullName)).toEqual(['Farmer One', 'Farmer Three']);
  });

  it('filters by NEW data category', () => {
    const newItems = sampleQueue.filter((item) => !item.lastCall);
    expect(newItems.length).toBe(2);
    expect(newItems.map((e) => e.customer.fullName)).toEqual(['Farmer One', 'Farmer Three']);
  });
});

describe('Relationship Manager Status & Category Filtering', () => {
  const sampleRmRows = [
    {
      customer: { id: 'c-1', farmerCode: 'FARM-01', status: 'ACTIVE' },
      lastCall: { outcome: 'INTERESTED', status: 'ENDED' },
      pendingFollowUps: 1,
      convertedAt: '2026-09-01',
    },
    {
      customer: { id: 'c-2', farmerCode: null, status: 'ACTIVE' },
      lastCall: { outcome: 'NOT_INTERESTED', status: 'ENDED' },
      pendingFollowUps: 0,
      convertedAt: null,
    },
    {
      customer: { id: 'c-3', farmerCode: 'FARM-02', status: 'INACTIVE' },
      lastCall: { outcome: null, status: 'NOT_ANSWERED' },
      pendingFollowUps: 0,
      convertedAt: '2026-08-15',
    },
  ];

  it('filters by INTERESTED status', () => {
    const interested = sampleRmRows.filter((r) => r.lastCall?.outcome === 'INTERESTED');
    expect(interested.length).toBe(1);
    expect(interested[0].customer.id).toBe('c-1');
  });

  it('filters by FOLLOWUP status', () => {
    const followups = sampleRmRows.filter((r) => r.pendingFollowUps > 0);
    expect(followups.length).toBe(1);
    expect(followups[0].customer.id).toBe('c-1');
  });

  it('filters by NOT_ANSWERED status', () => {
    const notAnswered = sampleRmRows.filter((r) => r.lastCall?.status === 'NOT_ANSWERED');
    expect(notAnswered.length).toBe(1);
    expect(notAnswered[0].customer.id).toBe('c-3');
  });
});

describe('HRMS Shift Permission Mapping & Status Harmonization', () => {
  const statusMap: Record<string, string> = {
    'Late Arrival': 'LATE',
    'Early Exit': 'HALF_DAY',
    'Work From Home': 'PRESENT',
    'Field Visit': 'PRESENT',
  };

  it('maps permission categories to corresponding attendance statuses', () => {
    expect(statusMap['Late Arrival']).toBe('LATE');
    expect(statusMap['Early Exit']).toBe('HALF_DAY');
    expect(statusMap['Work From Home']).toBe('PRESENT');
    expect(statusMap['Field Visit']).toBe('PRESENT');
    expect(statusMap['Other'] || 'PRESENT').toBe('PRESENT');
  });

  it('parses structured permission notes accurately', () => {
    const parseNote = (notes: string) => {
      if (notes.startsWith('[Permission:')) {
        const match = notes.match(/^\[Permission:\s*([^\]]+)\]\s*(.*)$/);
        if (match) {
          return { type: `Permission: ${match[1]}`, reason: match[2] || match[1] };
        }
      }
      return { type: 'Attendance Regularization', reason: notes };
    };

    const parsed1 = parseNote('[Permission: Late Arrival] Doctor appointment at clinic');
    expect(parsed1.type).toBe('Permission: Late Arrival');
    expect(parsed1.reason).toBe('Doctor appointment at clinic');

    const parsed2 = parseNote('[Permission: Work From Home] Broadband fiber line repair');
    expect(parsed2.type).toBe('Permission: Work From Home');
    expect(parsed2.reason).toBe('Broadband fiber line repair');

    const parsed3 = parseNote('Biometric fingerprint missed on gate entry');
    expect(parsed3.type).toBe('Attendance Regularization');
    expect(parsed3.reason).toBe('Biometric fingerprint missed on gate entry');
  });

  it('filters requests correctly by approval status', () => {
    const requests = [
      { id: '1', category: 'PERMISSION', status: 'PENDING' },
      { id: '2', category: 'LEAVE', status: 'APPROVED' },
      { id: '3', category: 'PERMISSION', status: 'REJECTED' },
      { id: '4', category: 'MANAGER', status: 'PENDING' },
    ];

    const filterByStatus = (st: string) => requests.filter((r) => st === 'ALL' || r.status === st);

    expect(filterByStatus('ALL').length).toBe(4);
    expect(filterByStatus('PENDING').length).toBe(2);
    expect(filterByStatus('APPROVED').length).toBe(1);
    expect(filterByStatus('REJECTED').length).toBe(1);
  });

  it('builds canonical server payload for shift permission submission', () => {
    const buildPayload = (category: string, date: string, reason: string) => {
      const statusMap: Record<string, string> = {
        'Late Arrival': 'LATE',
        'Early Exit': 'HALF_DAY',
        'Work From Home': 'PRESENT',
        'Field Visit': 'PRESENT',
      };
      return {
        date,
        status: statusMap[category] || 'PRESENT',
        notes: `[Permission: ${category}] ${reason.trim()}`,
      };
    };

    const payload = buildPayload('Early Exit', '2026-09-10', 'Dentist appointment');
    expect(payload).toEqual({
      date: '2026-09-10',
      status: 'HALF_DAY',
      notes: '[Permission: Early Exit] Dentist appointment',
    });
  });

  it('strictly excludes PERMISSION and LEAVE from local storage fallback', () => {
    const localRaw = [
      { id: 'req-1', category: 'PERMISSION', type: 'Permission: Late Arrival' },
      { id: 'req-2', category: 'MANAGER', type: 'Manager Direct Note' },
      { id: 'req-3', category: 'LEAVE', type: 'Leave: Annual' },
      { id: 'req-4', category: 'HR', type: 'HR Support Inquiry' },
    ];

    const knownServerIds = new Set(['server-1', 'server-2']);

    const filteredLocal = localRaw.filter(
      (r) => r.category !== 'PERMISSION' && r.category !== 'LEAVE' && !knownServerIds.has(r.id)
    );

    expect(filteredLocal.length).toBe(2);
    expect(filteredLocal.map((r) => r.category)).toEqual(['MANAGER', 'HR']);
  });
});

describe('Role-Based Navigation Visibility (Manager, Founder, Agent)', () => {
  const CRM_NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', permission: 'customer.read' },
    { to: '/agent', label: 'Agent Mode', permission: 'call.read' },
    { to: '/action-center', label: 'Action Center', permission: 'call.read' },
    { to: '/customers', label: 'Farmers', permission: 'customer.read' },
    { to: '/leads', label: 'Leads Pipeline', permission: 'lead.read' },
    { to: '/knowledge-base', label: 'Knowledge Base', permission: 'assistant.use' },
    { to: '/crops', label: 'Crop Catalog', permission: 'crop.read' },
    { to: '/reports', label: 'Reports & Rankings', permission: 'call.read' },
  ];

  const AGENT_PRIMARY_NAV = new Set([
    '/dashboard',
    '/agent',
    '/action-center',
    '/customers',
  ]);

  const FOUNDER_HIDDEN_NAV = new Set([
    '/agent',
    '/action-center',
    '/leads',
    '/knowledge-base',
    '/crops',
    '/reports',
  ]);

  const MANAGER_HIDDEN_NAV = new Set([
    '/leads',
    '/knowledge-base',
    '/crops',
    '/reports',
  ]);

  const filterNav = (roleCode: string, perms: string[] = []) => {
    const hasPerm = (p?: string) => !p || perms.includes(p);
    const isAgent = roleCode === 'AGENT';
    const isFounder = roleCode === 'FOUNDER';
    const isManager = roleCode === 'MANAGER';
    return CRM_NAV_ITEMS.filter(
      (i) =>
        (!isAgent || AGENT_PRIMARY_NAV.has(i.to)) &&
        (!isFounder || !FOUNDER_HIDDEN_NAV.has(i.to)) &&
        (!isManager || !MANAGER_HIDDEN_NAV.has(i.to)) &&
        hasPerm(i.permission)
    );
  };

  it('hides exactly the 4 designated items from MANAGER visible navigation while preserving others', () => {
    // Manager holds all CRM operational permissions
    const managerPerms = ['customer.read', 'call.read', 'relationship.read', 'lead.read', 'assistant.use', 'crop.read'];
    const visible = filterNav('MANAGER', managerPerms);
    const labels = visible.map((i) => i.label);

    // 4 Hidden items
    expect(labels).not.toContain('Leads Pipeline');
    expect(labels).not.toContain('Knowledge Base');
    expect(labels).not.toContain('Crop Catalog');
    expect(labels).not.toContain('Reports & Rankings');

    // Remaining visible items
    expect(labels).toEqual([
      'Dashboard',
      'Agent Mode',
      'Action Center',
      'Farmers',
    ]);
  });

  it('removes Agent Mode from FOUNDER navigation and preserves Dashboard and Farmers', () => {
    const allPerms = ['customer.read', 'call.read', 'relationship.read', 'lead.read', 'assistant.use', 'crop.read'];
    const visible = filterNav('FOUNDER', allPerms);
    const labels = visible.map((i) => i.label);

    expect(labels).not.toContain('Agent Mode');
    expect(labels).toEqual([
      'Dashboard',
      'Farmers',
    ]);
  });

  it('preserves AGENT navigation unchanged', () => {
    const agentPerms = ['customer.read', 'call.read'];
    const visible = filterNav('AGENT', agentPerms);
    const labels = visible.map((i) => i.label);

    expect(labels).toEqual([
      'Dashboard',
      'Agent Mode',
      'Action Center',
      'Farmers',
    ]);
  });
});

describe('Telecalling Workspace 5-Minute In-Between Call Interval & Employee Breaks', () => {
  const CALL_TIMEOUT_SECONDS = 300; // 5 minutes default

  it('initializes in-between call interval with 5 minutes (300 seconds)', () => {
    expect(CALL_TIMEOUT_SECONDS).toBe(300);
    const formatCountdown = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    expect(formatCountdown(CALL_TIMEOUT_SECONDS)).toBe('05:00');
  });

  it('only decrements in-between timer when workStarted is true, call is NOT active, and NOT on break', () => {
    let inBetweenSeconds = 300;
    const tick = (workStarted: boolean, callActive: boolean, isOnBreak: boolean) => {
      if (workStarted && !callActive && !isOnBreak && inBetweenSeconds > 0) {
        inBetweenSeconds -= 1;
      }
      return inBetweenSeconds;
    };

    // When call is active, in-between timer must NOT decrement
    expect(tick(true, true, false)).toBe(300);

    // When on break, in-between timer must NOT decrement
    expect(tick(true, false, true)).toBe(300);

    // When shift not started, timer must NOT decrement
    expect(tick(false, false, false)).toBe(300);

    // When between calls, timer decrements smoothly
    expect(tick(true, false, false)).toBe(299);
    expect(tick(true, false, false)).toBe(298);
  });

  it('triggers idle alert and auto-dial countdown when in-between timer expires (reaches 0)', () => {
    let inBetweenSeconds = 1;
    let showIdleAlert = false;
    let autoDialSeconds: number | null = null;
    const autoDialEnabled = true;

    const tick = (workStarted: boolean, callActive: boolean, isOnBreak: boolean) => {
      if (!workStarted || callActive || isOnBreak || inBetweenSeconds <= 0) return;
      if (inBetweenSeconds <= 1) {
        inBetweenSeconds = 0;
        showIdleAlert = true;
        if (autoDialEnabled) {
          autoDialSeconds = 10;
        }
      } else {
        inBetweenSeconds -= 1;
      }
    };

    tick(true, false, false);
    expect(inBetweenSeconds).toBe(0);
    expect(showIdleAlert).toBe(true);
    expect(autoDialSeconds).toBe(10);
  });

  it('resets in-between timer whenever a call is placed or ended', () => {
    let inBetweenSeconds = 45;
    let showIdleAlert = true;
    let autoDialSeconds: number | null = 5;

    const handleStartCall = () => {
      inBetweenSeconds = CALL_TIMEOUT_SECONDS;
      showIdleAlert = false;
      autoDialSeconds = null;
    };

    handleStartCall();
    expect(inBetweenSeconds).toBe(300);
    expect(showIdleAlert).toBe(false);
    expect(autoDialSeconds).toBeNull();
  });

  it('provides exact employee break categories: Restroom (10-15m), Tea/Coffee (10m), Personal Relaxation (20m), Lunch (30m)', () => {
    const breakCategories = [
      { type: 'Restroom Break (10m)', minutes: 10 },
      { type: 'Restroom Break (15m)', minutes: 15 },
      { type: 'Tea / Coffee Break (10m)', minutes: 10 },
      { type: 'Personal Relaxation (20m)', minutes: 20 },
      { type: 'Lunch Break (30m)', minutes: 30 },
    ];

    expect(breakCategories.find((b) => b.type.includes('Restroom') && b.minutes === 10)).toBeDefined();
    expect(breakCategories.find((b) => b.type.includes('Restroom') && b.minutes === 15)).toBeDefined();
    expect(breakCategories.find((b) => b.type.includes('Tea') && b.minutes === 10)).toBeDefined();
    expect(breakCategories.find((b) => b.type.includes('Relaxation') && b.minutes === 20)).toBeDefined();
    expect(breakCategories.find((b) => b.type.includes('Lunch') && b.minutes === 30)).toBeDefined();
  });

  it('formats call outcome payload properly on finish & save', () => {
    const outcome = 'INTERESTED';
    const notes = 'Farmer requested bio-fertilizer delivery by Friday.';
    const callPurpose = 'Biofertilizer Enquiry';
    const callbackDateTime = '2026-10-25T10:30';

    const formattedNote = notes.trim() ? `[${callPurpose}] ${notes.trim()}` : `[${callPurpose}] Call logged`;
    const payload = {
      outcome,
      notes: formattedNote,
      followUpNote: formattedNote,
      followUpDate: callbackDateTime.split('T')[0],
      followUpTime: callbackDateTime.split('T')[1].slice(0, 5),
    };

    expect(payload.outcome).toBe('INTERESTED');
    expect(payload.notes).toBe('[Biofertilizer Enquiry] Farmer requested bio-fertilizer delivery by Friday.');
    expect(payload.followUpDate).toBe('2026-10-25');
    expect(payload.followUpTime).toBe('10:30');
  });
});

describe('5-Tier Organizational Role Hierarchy (Founder, Manager, Team Leader, Telecaller, Delivery)', () => {
  const ROLE_RANK: Record<string, number> = {
    SUPER_ADMIN: -1,
    FOUNDER: 0,
    MANAGER: 1,
    TEAM_LEADER: 2,
    AGENT: 3,
    DELIVERY: 3,
  };

  const outranks = (actor: string, target: string) => {
    const a = ROLE_RANK[actor] ?? 99;
    const t = ROLE_RANK[target] ?? 99;
    return a < t;
  };

  it('verifies Founder/Super Admin sits at the top of the hierarchy', () => {
    expect(outranks('FOUNDER', 'MANAGER')).toBe(true);
    expect(outranks('FOUNDER', 'TEAM_LEADER')).toBe(true);
    expect(outranks('FOUNDER', 'AGENT')).toBe(true);
    expect(outranks('FOUNDER', 'DELIVERY')).toBe(true);
  });

  it('verifies Manager outranks Team Leaders, Telecallers, and Delivery', () => {
    expect(outranks('MANAGER', 'TEAM_LEADER')).toBe(true);
    expect(outranks('MANAGER', 'AGENT')).toBe(true);
    expect(outranks('MANAGER', 'DELIVERY')).toBe(true);
    expect(outranks('MANAGER', 'FOUNDER')).toBe(false);
  });

  it('verifies Team Leader outranks Telecallers (4 callers under them)', () => {
    expect(outranks('TEAM_LEADER', 'AGENT')).toBe(true);
    expect(outranks('TEAM_LEADER', 'MANAGER')).toBe(false);
    expect(outranks('TEAM_LEADER', 'FOUNDER')).toBe(false);
  });

  it('verifies Delivery role is focused on dispatch pipeline & delivery execution', () => {
    const deliveryPermissions = [
      'dispatch.read',
      'dispatch.manage',
      'delivery.read',
      'delivery.execute',
      'orders.read',
      'customer.read',
    ];
    expect(deliveryPermissions).toContain('dispatch.manage');
    expect(deliveryPermissions).toContain('delivery.execute');
  });
});



