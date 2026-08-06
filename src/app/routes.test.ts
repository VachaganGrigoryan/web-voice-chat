import { describe, expect, it } from 'vitest';
import { ACTIVITY_TABS, APP_ROUTES, isActivityTab } from './routes';

describe('activity routes', () => {
  it('includes the stats tab in the activity tab contract', () => {
    expect(ACTIVITY_TABS).toEqual(['all', 'stats', 'mentions', 'requests', 'sent', 'call-logs']);
    expect(isActivityTab('stats')).toBe(true);
  });

  it('keeps /activity as the default action inbox and stats as a separate page', () => {
    expect(APP_ROUTES.activityTab()).toBe('/activity');
    expect(APP_ROUTES.activityTab('all')).toBe('/activity');
    expect(APP_ROUTES.activityTab('stats')).toBe('/activity/stats');
  });
});
