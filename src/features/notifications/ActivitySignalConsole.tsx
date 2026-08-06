import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { Activity, AtSign, Bell, PhoneCall, RadioTower, ShieldAlert, UserPlus } from 'lucide-react';
import type { PageTab } from '@/components/page/pageTypes';
import { cn } from '@/lib/utils';
import type {
  ActivityBreakdownItem,
  ActivityInsightSnapshot,
  ActivityMetric,
  ActivityTone,
  ActivityTrendPoint,
} from './activityInsights';

const toneClasses: Record<
  ActivityTone,
  {
    readonly icon: string;
    readonly card: string;
    readonly border: string;
    readonly text: string;
    readonly fill: string;
    readonly soft: string;
  }
> = {
  brand: {
    icon: 'bg-brand text-brand-foreground',
    card: 'bg-indigo-50/80 dark:bg-indigo-950/20',
    border: 'border-indigo-200/80 dark:border-indigo-900/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    fill: 'bg-indigo-500',
    soft: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  mention: {
    icon: 'bg-violet-500 text-white',
    card: 'bg-violet-50/80 dark:bg-violet-950/20',
    border: 'border-violet-200/80 dark:border-violet-900/60',
    text: 'text-violet-700 dark:text-violet-300',
    fill: 'bg-violet-500',
    soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  request: {
    icon: 'bg-emerald-500 text-white',
    card: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    border: 'border-emerald-200/80 dark:border-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    fill: 'bg-emerald-500',
    soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  call: {
    icon: 'bg-sky-500 text-white',
    card: 'bg-sky-50/80 dark:bg-sky-950/20',
    border: 'border-sky-200/80 dark:border-sky-900/60',
    text: 'text-sky-700 dark:text-sky-300',
    fill: 'bg-sky-500',
    soft: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  system: {
    icon: 'bg-muted text-muted-foreground',
    card: 'bg-muted/40',
    border: 'border-border/70',
    text: 'text-muted-foreground',
    fill: 'bg-muted-foreground',
    soft: 'bg-muted text-muted-foreground',
  },
  security: {
    icon: 'bg-rose-500 text-white',
    card: 'bg-rose-50/80 dark:bg-rose-950/20',
    border: 'border-rose-200/80 dark:border-rose-900/60',
    text: 'text-rose-700 dark:text-rose-300',
    fill: 'bg-rose-500',
    soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
};

const metricIcons: Record<ActivityMetric['id'], LucideIcon> = {
  unread: RadioTower,
  mentions: AtSign,
  requests: UserPlus,
  calls: PhoneCall,
  missed: ShieldAlert,
};

const tabDetails: Record<string, string> = {
  all: 'Unified stream',
  stats: 'Real data',
  mentions: 'Direct attention',
  requests: 'Needs action',
  sent: 'Waiting room',
  'call-logs': 'Voice trail',
};

function compactValue(value: number): string {
  if (value > 999) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

function activityTotal(point: ActivityTrendPoint): number {
  return point.total + point.unread + point.mentions + point.requests + point.calls;
}

function trendPath(points: readonly ActivityTrendPoint[], width: number, height: number): string {
  const max = Math.max(1, ...points.map(activityTotal));
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (activityTotal(point) / max) * (height - 8) - 4;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function ActivitySignalOverview({
  snapshot,
  isLoading,
}: {
  snapshot: ActivityInsightSnapshot;
  isLoading: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="space-y-4" aria-label="Activity signal overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {snapshot.metrics.map((metric, index) => {
          const Icon = metricIcons[metric.id];
          const tone = toneClasses[metric.tone];
          return (
            <motion.div
              key={metric.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: reduceMotion ? 0 : index * 0.025 }}
              className={cn(
                'min-h-32 rounded-2xl border p-4 shadow-e1 transition-colors duration-200',
                tone.card,
                tone.border
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', tone.icon)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold', tone.soft)}>
                  {metric.detail}
                </span>
              </div>
              <div className="mt-5">
                <div className="text-3xl font-semibold tracking-tight text-foreground">
                  {isLoading ? '...' : compactValue(metric.value)}
                </div>
                <div className="mt-1 text-sm font-medium text-muted-foreground">{metric.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <ActivityTrendChart trend={snapshot.trend} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <ActivityBreakdownBar title="Signal mix" items={snapshot.notificationBreakdown} />
          <ActivityBreakdownBar title="Call mix" items={snapshot.callBreakdown} />
        </div>
      </div>
    </section>
  );
}

export function ActivityTrendChart({ trend }: { trend: readonly ActivityTrendPoint[] }) {
  const path = trendPath(trend, 360, 116);
  const max = Math.max(1, ...trend.map(activityTotal));

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-e1" aria-label="Seven day activity pulse">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Signal pulse</h2>
          <p className="text-sm text-muted-foreground">Notifications, requests and calls.</p>
        </div>
        <span className="rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand">
          7 days
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/70 p-3">
        <svg
          viewBox="0 0 360 148"
          role="img"
          aria-label="Seven-day activity trend"
          className="h-44 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="activityPulseFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="text-border">
            {[0, 1, 2].map((line) => (
              <line
                key={line}
                x1="0"
                x2="360"
                y1={20 + line * 42}
                y2={20 + line * 42}
                stroke="currentColor"
                strokeDasharray="4 8"
              />
            ))}
          </g>
          <path d={`${path} L 360 126 L 0 126 Z`} className="text-brand" fill="url(#activityPulseFill)" />
          <path d={path} fill="none" className="text-brand" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {trend.map((point, index) => {
            const x = trend.length === 1 ? 180 : (index / (trend.length - 1)) * 360;
            const y = 116 - (activityTotal(point) / max) * 108 + 4;
            return (
              <g key={point.key}>
                <circle cx={x} cy={y} r="4.5" className="fill-background stroke-brand" strokeWidth="2" />
                <text x={x} y="144" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export function ActivityBreakdownBar({
  title,
  items,
}: {
  title: string;
  items: readonly ActivityBreakdownItem[];
}) {
  const rawTotal = items.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(1, rawTotal);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-e1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">{rawTotal} loaded</span>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.id}
            className={toneClasses[item.tone].fill}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', toneClasses[item.tone].fill)} />
              <span className="truncate text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityLensBar({
  tabs,
  activeTabId,
  onSelect,
}: {
  tabs: readonly PageTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
}) {
  return (
    <div className="scrollbar-hidden -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <nav role="tablist" aria-label="Activity sections" className="flex min-w-max gap-2 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon ?? Bell;
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'group min-w-40 cursor-pointer rounded-2xl border p-3 text-left transition-all duration-200 motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-brand bg-brand text-brand-foreground shadow-e2'
                  : 'border-border/70 bg-card text-foreground hover:border-brand/40 hover:bg-brand-muted/60'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    isActive ? 'bg-brand-foreground/15' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {tab.count ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive ? 'bg-brand-foreground/15' : 'bg-brand-muted text-brand'
                    )}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-sm font-semibold">{tab.label}</div>
              <div className={cn('mt-0.5 text-xs', isActive ? 'text-brand-foreground/75' : 'text-muted-foreground')}>
                {tabDetails[tab.id] ?? 'Activity'}
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function ActivitySection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ActivityEmptyState({
  icon: Icon = Activity,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
