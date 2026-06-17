import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiAward,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiSend,
  FiSettings,
  FiToggleLeft,
  FiUsers,
} from 'react-icons/fi';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { getSubaccounts } from '../services/api.ts';
import AnimatedContent from '../components/AnimatedContent.tsx';
import { db, auth } from '../services/firebaseConfig.ts';

type TrendPoint = {
  key: string;
  label: string;
  value: number;
};

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createDaySeries = (anchorDate: Date, days = 14): TrendPoint[] =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - (days - 1 - index));
    return {
      key: dayKey(date),
      label: date.toLocaleDateString([], { weekday: 'short' }),
      value: 0,
    };
  });

const buildSnapshotSeries = (values: number[], anchorDate: Date, days = 14): TrendPoint[] => {
  const series = createDaySeries(anchorDate, days);
  const recentValues = values.slice(0, days);
  recentValues.forEach((value, index) => {
    const target = series[series.length - 1 - index];
    if (target) target.value = Number.isFinite(value) ? value : 0;
  });
  return series;
};

const getSeriesTotal = (series: TrendPoint[]) =>
  series.reduce((sum, point) => sum + point.value, 0);

const normalizeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DashboardCardSkeleton = () => (
  <div className="relative z-10 flex h-full min-h-[136px] flex-col justify-between">
    <div>
      <div className="mb-4 h-10 w-10 rounded-xl bg-white/30 animate-pulse" />
      <div className="h-3 w-32 rounded-full bg-white/30 animate-pulse" />
    </div>
    <div className="mt-8 h-10 w-20 rounded-lg bg-white/30 animate-pulse" />
  </div>
);

const renderMiniBars = (series: TrendPoint[], color: string, isLoading: boolean, unitLabel: string) => {
  const totalValue = getSeriesTotal(series);
  const maxValue = Math.max(1, ...series.map((point) => point.value));
  const startLabel = series[0]?.label || '';
  const endLabel = series[series.length - 1]?.label || '';

  if (isLoading) {
    return (
      <div>
        <div className="h-14 flex items-end gap-1.5">
          {[36, 58, 44, 72, 52, 84, 64].map((height, index) => (
            <div
              key={`bar-skeleton-${index}`}
              className="flex-1 rounded-t-md bg-white/10 animate-pulse"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-2 h-3 w-full rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-14 flex items-end gap-1.5" aria-label={`14 day ${unitLabel} trend`}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        {series.map((point) => {
          const height = point.value === 0 ? 10 : Math.max(28, Math.round((point.value / maxValue) * 100));
          return (
            <div
              key={point.key}
              className="group/bar relative z-10 flex-1 rounded-t-[5px] transition-all duration-300 hover:opacity-100 hover:scale-y-105 origin-bottom"
              title={`${point.label}: ${point.value.toLocaleString()} ${unitLabel}`}
              style={{
                height: `${height}%`,
                backgroundColor: point.value === 0 ? 'rgba(148,163,184,0.18)' : color,
                opacity: point.value === 0 ? 1 : 0.98,
                boxShadow: point.value === 0 ? 'none' : `0 0 0 1px ${color}1f`,
              }}
            />
          );
        })}
        {totalValue === 0 && (
          <span className="absolute inset-x-0 top-4 text-center text-[11px] font-bold text-slate-500">
            No recent data
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-[#697386]">
        <span>{startLabel}</span>
        <span>14-day trend</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
};

const TopMetricCard = ({
  label,
  value,
  icon,
  gradient,
  iconClass,
  valueClass,
  buttonClass,
  loading,
  onClick,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  iconClass: string;
  valueClass: string;
  buttonClass: string;
  loading: boolean;
  onClick: () => void;
  delay: number;
}) => (
  <AnimatedContent delay={delay} distance={50} direction="vertical">
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-6 rounded-[24px] ${gradient} shadow-xl transition-all group overflow-hidden relative h-full min-h-[148px] border border-white/20 hover:-translate-y-0.5`}
    >
      <div className="absolute inset-0 bg-white/10 pointer-events-none" />
      <div className={`absolute bottom-0 right-0 p-4 opacity-[0.13] group-hover:scale-110 transition-transform duration-500 ${iconClass}`}>
        <div className="w-24 h-24">{icon}</div>
      </div>
      <span className={`group/action absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)] ring-1 ring-white/45 hover:scale-105 active:scale-95 transition-all ${buttonClass}`}>
        <FiPlus className="h-[18px] w-[18px] stroke-[2.4] transition-transform duration-200 group-hover/action:rotate-90" />
      </span>
      {loading ? (
        <DashboardCardSkeleton />
      ) : (
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white mb-4 shadow-sm ring-1 ring-white/20">
              <div className="h-5 w-5">{icon}</div>
            </div>
            <p className="text-[12px] font-black text-white/85 uppercase tracking-widest mb-1">
              {label}
            </p>
          </div>
          <h2 className={`mt-4 text-3xl sm:text-4xl font-black leading-none ${valueClass}`}>
            {value.toLocaleString()}
          </h2>
        </div>
      )}
    </button>
  </AnimatedContent>
);

export const Dashboard = () => {
  const { agencyId, agencySession } = useAgency();
  const navigate = useNavigate();

  const [subaccounts, setSubaccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [trendAnchor] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getSubaccounts(agencyId);
      setSubaccounts(data.subaccounts || []);
      setLastRefreshed(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load agency dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) return;

    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);

        const q = query(
          collection(db, 'ghl_tokens'),
          where('companyId', '==', agencyId)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const liveStates = new Map<string, { toggle_enabled: boolean; attempt_count: number; rate_limit: number; toggle_activation_count: number }>();
            snapshot.docs.forEach(doc => {
              const d = doc.data();
              const id = d.location_id ?? doc.id;
              liveStates.set(id, {
                toggle_enabled: typeof d.toggle_enabled === 'boolean' ? d.toggle_enabled : true,
                attempt_count: normalizeNumber(d.attempt_count, 0),
                rate_limit: normalizeNumber(d.rate_limit, 5),
                toggle_activation_count: normalizeNumber(d.toggle_activation_count, 0),
              });
            });

            setSubaccounts(prev =>
              prev.map(s => {
                const live = liveStates.get(s.location_id);
                return live ? { ...s, ...live } : s;
              })
            );
            setLastRefreshed(new Date());
          },
          (err) => {
            console.error('[Dashboard] onSnapshot error:', err);
          }
        );
      } catch (err: any) {
        console.error('[Dashboard] Firebase setup error:', err);
      }
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [agencyId]);

  const total = subaccounts.length;
  const active = subaccounts.filter(s => s.toggle_enabled).length;
  const inactive = Math.max(0, total - active);
  const atLimit = subaccounts.filter(s => normalizeNumber(s.attempt_count) >= normalizeNumber(s.rate_limit, 5)).length;
  const totalSends = subaccounts.reduce((sum, s) => sum + normalizeNumber(s.attempt_count), 0);
  const totalLimit = subaccounts.reduce((sum, s) => sum + normalizeNumber(s.rate_limit, 5), 0);

  const sessionAgencyName = (() => {
    const user = agencySession?.user;
    if (!user) return '';
    return (
      user.company_name ||
      user.agency_name ||
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    );
  })();

  const agencyName = sessionAgencyName ||
    ((subaccounts.length > 0 && (subaccounts[0].agency_name || subaccounts[0].company_name))
      ? (subaccounts[0].agency_name || subaccounts[0].company_name)
      : 'Agency');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const searchResults = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return [];
    return subaccounts
      .filter(s =>
        [
          s.location_name,
          s.company_name,
          s.agency_name,
          s.location_id,
        ].some(value => String(value || '').toLowerCase().includes(queryText))
      )
      .slice(0, 5);
  }, [searchQuery, subaccounts]);

  const sendsSeries = buildSnapshotSeries(
    [...subaccounts].sort((a, b) => normalizeNumber(b.attempt_count) - normalizeNumber(a.attempt_count)).map(s => normalizeNumber(s.attempt_count)),
    trendAnchor
  );
  const limitSeries = buildSnapshotSeries(
    [...subaccounts].sort((a, b) => normalizeNumber(b.rate_limit, 5) - normalizeNumber(a.rate_limit, 5)).map(s => normalizeNumber(s.rate_limit, 5)),
    trendAnchor
  );
  const activitySeries = buildSnapshotSeries(
    [...subaccounts].sort((a, b) => Number(Boolean(b.toggle_enabled)) - Number(Boolean(a.toggle_enabled))).map(s => s.toggle_enabled ? 1 : 0),
    trendAnchor
  );

  const sendsTrendTotal = getSeriesTotal(sendsSeries);
  const limitTrendTotal = getSeriesTotal(limitSeries);
  const activityTrendTotal = getSeriesTotal(activitySeries);
  const refreshedDate = lastRefreshed.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const refreshedTime = lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const profileInitial = agencyName.charAt(0).toUpperCase() || 'A';

  const recentSubaccounts = [...subaccounts]
    .sort((a, b) => {
      const aAtLimit = normalizeNumber(a.attempt_count) >= normalizeNumber(a.rate_limit, 5) ? 1 : 0;
      const bAtLimit = normalizeNumber(b.attempt_count) >= normalizeNumber(b.rate_limit, 5) ? 1 : 0;
      return bAtLimit - aAtLimit || normalizeNumber(b.attempt_count) - normalizeNumber(a.attempt_count);
    })
    .slice(0, 3);

  const topActions = (
    <>
      <div className="relative hidden sm:block w-64" onClick={(event) => event.stopPropagation()}>
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
        <input
          type="text"
          placeholder="Search subaccounts..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-[14px] font-medium text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
        />
        {searchQuery.trim() !== '' && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1e21]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
            {searchResults.length > 0 ? (
              searchResults.map((subaccount) => (
                <button
                  key={subaccount.location_id || subaccount.id}
                  onClick={() => {
                    setSearchQuery('');
                    navigate('/subaccounts');
                  }}
                  className="w-full px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0 bg-gradient-to-br from-[#2b83fa] to-[#60a5fa]">
                    {(subaccount.location_name || subaccount.company_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-white leading-tight truncate">
                      {subaccount.location_name || subaccount.company_name || 'Unnamed subaccount'}
                    </p>
                    <p className="text-[11.5px] text-gray-400 font-medium truncate">
                      {subaccount.location_id || 'No location id'}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-gray-500 text-[12.5px] font-medium italic">
                No subaccounts found
              </div>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center shadow-lg shadow-black/10 border-2 border-white/20 flex-shrink-0 text-white font-bold text-[14px] bg-emerald-400 hover:scale-105 active:scale-95 transition-all"
        title={agencyName}
        aria-label="Open agency settings"
      >
        {profileInitial}
      </button>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
        aria-label="Open settings"
        title="Open settings"
      >
        <FiBell className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
        aria-label="More agency settings"
        title="More agency settings"
      >
        <FiMoreHorizontal className="w-4 h-4" />
      </button>
    </>
  );

  const quickActions = [
    {
      label: 'Manage Subaccounts',
      description: 'Control SMS access and limits',
      icon: <FiToggleLeft className="h-5 w-5" />,
      color: 'text-[#2b83fa] bg-blue-900/20',
      hover: 'hover:border-[#2b83fa]/30 hover:shadow-blue-500/10',
      action: () => navigate('/subaccounts'),
    },
    {
      label: 'Credits & Billing',
      description: 'Top up and distribute credits',
      icon: <FiCreditCard className="h-5 w-5" />,
      color: 'text-emerald-400 bg-emerald-900/20',
      hover: 'hover:border-emerald-500/30 hover:shadow-emerald-500/10',
      action: () => navigate('/billing'),
    },
    {
      label: 'Subscription',
      description: 'Review plan and account limits',
      icon: <FiAward className="h-5 w-5" />,
      color: 'text-purple-400 bg-purple-900/20',
      hover: 'hover:border-purple-500/30 hover:shadow-purple-500/10',
      action: () => navigate('/subscription'),
    },
  ];

  return (
    <AgencyLayout
      variant="dashboard"
      title={`${getGreeting()}, ${agencyName}`}
      subtitle="Your agency is ready for today's subaccount activity."
      topActions={topActions}
    >
      {!agencyId && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 shadow-sm flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <FiAlertTriangle className="w-[18px] h-[18px]" />
              <strong className="text-[13px]">No GHL Company ID linked.</strong>
            </div>
            <p className="text-[12.5px] mt-1.5 text-slate-300">
              Your account is not connected to a GoHighLevel agency yet. Log in again to link your GHL Company ID.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="shrink-0 px-4 py-2 bg-amber-500 text-white text-[12.5px] font-bold rounded-xl hover:bg-amber-600 transition-colors"
          >
            Connect Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <TopMetricCard
          delay={0.1}
          label="Total Subaccounts"
          value={total}
          icon={<FiUsers className="w-full h-full" />}
          gradient="bg-gradient-to-br from-[#60a5fa] via-[#2b83fa] to-[#06b6d4]"
          iconClass="text-blue-900"
          valueClass="text-white"
          buttonClass="bg-blue-600 hover:bg-blue-700"
          loading={loading}
          onClick={() => navigate('/subaccounts')}
        />
        <TopMetricCard
          delay={0.2}
          label="Total Sends"
          value={totalSends}
          icon={<FiSend className="w-full h-full" />}
          gradient="bg-gradient-to-br from-[#c084fc] via-[#8b5cf6] to-[#6d28d9]"
          iconClass="text-purple-950"
          valueClass="text-white"
          buttonClass="bg-purple-600 hover:bg-purple-700"
          loading={loading}
          onClick={() => navigate('/subaccounts')}
        />
        <TopMetricCard
          delay={0.3}
          label="Active SMS"
          value={active}
          icon={<FiCheckCircle className="w-full h-full" />}
          gradient="bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#0d9488]"
          iconClass="text-emerald-950"
          valueClass="text-white"
          buttonClass="bg-emerald-600 hover:bg-emerald-700"
          loading={loading}
          onClick={() => navigate('/subaccounts')}
        />
      </div>

      <AnimatedContent delay={0.35} distance={40} direction="vertical">
        <div className="bg-[#1c1e21] rounded-[24px] shadow-sm mb-8 overflow-hidden border border-white/[0.07]">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.07]">
            {[
              {
                label: 'Active SMS On',
                value: active.toLocaleString(),
                accent: '#ef4444',
                series: activitySeries,
                note: `${inactive.toLocaleString()} inactive subaccounts`,
                badge: total > 0 ? `${Math.round((active / total) * 100)}% active` : 'No accounts',
                chartUnit: 'active',
                chartCaption: active > 0 ? 'Active subaccounts in this snapshot' : 'No SMS-enabled subaccounts yet',
                onClick: () => navigate('/subaccounts'),
              },
              {
                label: 'Sends Used',
                value: totalSends.toLocaleString(),
                accent: '#8b5cf6',
                series: sendsSeries,
                note: 'Attempts across subaccounts',
                badge: totalLimit > 0 ? `${totalLimit.toLocaleString()} limit` : 'No limit',
                chartUnit: 'sends',
                chartCaption: sendsTrendTotal > 0 ? 'Highest usage subaccounts' : 'No sends recorded yet',
                onClick: () => navigate('/subaccounts'),
              },
              {
                label: 'Latest Sync',
                value: refreshedDate,
                accent: '#10b981',
                series: limitSeries,
                note: refreshedTime,
                badge: error ? 'Needs review' : 'Live data',
                chartUnit: 'credits',
                chartCaption: limitTrendTotal > 0 ? 'Configured send limits by subaccount' : 'No limits loaded',
                onClick: fetchData,
              },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                className="p-6 flex flex-col justify-between text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b83fa]/50"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#a9bdd8]">{item.label}</p>
                    {!loading && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: item.accent, boxShadow: `0 0 0 4px ${item.accent}1f` }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {loading ? (
                      <div className="h-8 w-28 bg-white/5 animate-pulse rounded-lg" />
                    ) : (
                      <div className="flex items-end gap-2 min-w-0">
                        <h2 className="text-[28px] leading-none font-black text-white break-words" title={item.value}>
                          {item.value}
                        </h2>
                        <span
                          className="mb-0.5 rounded-full px-2 py-1 text-[10px] font-black leading-none"
                          style={{
                            color: item.accent,
                            backgroundColor: `${item.accent}18`,
                          }}
                        >
                          {item.badge}
                        </span>
                      </div>
                    )}
                    {!loading && (
                      <p className="text-[12px] font-semibold leading-snug text-[#9aa7bb]">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-black/15 px-3 py-3 ring-1 ring-white/[0.04]">
                  {renderMiniBars(item.series, item.accent, loading, item.chartUnit)}
                  {!loading && (
                    <p className="mt-2 text-[11px] font-semibold text-[#8b95a7]">
                      {item.chartCaption}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </AnimatedContent>

      {!loading && atLimit > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 mb-8 shadow-sm flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-red-300">
              <FiAlertTriangle className="w-[18px] h-[18px]" />
              <strong className="text-[13px]">Subaccounts at rate limit ({atLimit})</strong>
            </div>
            <p className="text-[12.5px] mt-1.5 text-slate-300">
              These subaccounts are blocked until their counters are reset or limits are updated.
            </p>
          </div>
          <button
            onClick={() => navigate('/subaccounts')}
            className="shrink-0 px-4 py-2 bg-red-500 text-white text-[12.5px] font-bold rounded-xl hover:bg-red-600 transition-colors"
          >
            Review
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6 lg:gap-8 mb-8">
        <div>
          <AnimatedContent delay={0.4} distance={50} direction="vertical">
            <h3 className="text-[15px] font-bold text-white mb-5 flex items-center gap-2 h-8">
              Quick Actions
            </h3>
          </AnimatedContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            {quickActions.map((item, index) => (
              <AnimatedContent key={item.label} delay={0.45 + index * 0.05} distance={30} direction="vertical">
                <button
                  onClick={item.action}
                  className={`w-full h-[80px] p-4 rounded-[20px] bg-[#1c1e21] border border-white/[0.07] shadow-sm transition-all duration-300 text-left flex items-center justify-between group hover:-translate-y-0.5 ${item.hover}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-[13.5px] truncate">{item.label}</h4>
                      <p className="text-[11.5px] text-gray-400 font-medium truncate">{item.description}</p>
                    </div>
                  </div>
                  <FiArrowRight className="h-4 w-4 text-gray-500 group-hover:text-[#2b83fa] group-hover:translate-x-1 transition-all flex-shrink-0" />
                </button>
              </AnimatedContent>
            ))}
          </div>
        </div>

        <div>
          <AnimatedContent delay={0.4} distance={50} direction="vertical">
            <div className="flex items-center justify-between mb-5 h-8">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                Recent Activity
              </h3>
              {subaccounts.length > 3 && (
                <button
                  onClick={() => navigate('/subaccounts')}
                  className="text-[12px] font-bold text-[#2b83fa] hover:text-[#60a5fa] py-1 px-3 rounded-full hover:bg-blue-900/20 transition-colors"
                >
                  See All
                </button>
              )}
            </div>
          </AnimatedContent>

          <div className="flex flex-col gap-3">
            {loading ? (
              [1, 2, 3].map((item, idx) => (
                <AnimatedContent key={`activity-skeleton-${item}`} delay={0.45 + idx * 0.05} distance={30} direction="vertical">
                  <div className="w-full h-[80px] p-4 rounded-[20px] bg-[#1c1e21] border border-white/[0.07] flex items-center justify-between">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                      <div className="space-y-2 w-full max-w-[150px]">
                        <div className="h-3 w-3/4 bg-white/10 animate-pulse rounded" />
                        <div className="h-2 w-full bg-white/5 animate-pulse rounded opacity-60" />
                      </div>
                    </div>
                    <div className="w-16 h-3 bg-white/5 animate-pulse rounded opacity-60" />
                  </div>
                </AnimatedContent>
              ))
            ) : recentSubaccounts.length > 0 ? (
              recentSubaccounts.map((subaccount, idx) => {
                const isAtLimit = normalizeNumber(subaccount.attempt_count) >= normalizeNumber(subaccount.rate_limit, 5);
                const title = subaccount.location_name || subaccount.company_name || 'Unnamed subaccount';
                return (
                  <AnimatedContent key={subaccount.location_id || idx} delay={0.45 + idx * 0.05} distance={30} direction="vertical">
                    <button
                      onClick={() => navigate('/subaccounts')}
                      className="w-full h-[80px] p-4 rounded-[20px] bg-[#1c1e21] border border-white/[0.07] shadow-sm hover:border-[#2b83fa]/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-transform duration-300 group-hover:rotate-12 ${isAtLimit ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-[#2b83fa] to-[#60a5fa]'}`}>
                          {title.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-[13.5px] truncate">
                            {title}
                          </h4>
                          <p className="text-[11.5px] text-gray-400 truncate max-w-[240px] font-medium">
                            {normalizeNumber(subaccount.attempt_count).toLocaleString()} sends used of {normalizeNumber(subaccount.rate_limit, 5).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                          <FiClock size={10} />
                          {subaccount.toggle_enabled ? 'SMS ON' : 'SMS OFF'}
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isAtLimit ? 'bg-red-500/10 text-red-400' : 'bg-blue-900/20 text-[#2b83fa]'}`}>
                          {isAtLimit ? 'At limit' : 'Open'}
                        </div>
                      </div>
                    </button>
                  </AnimatedContent>
                );
              })
            ) : (
              <AnimatedContent delay={0.45} distance={30} direction="vertical">
                <div className="p-10 text-center rounded-3xl border-2 border-dashed border-white/[0.07]">
                  <p className="text-gray-500 text-[14px] font-medium italic">No subaccounts found yet.</p>
                </div>
              </AnimatedContent>
            )}
          </div>
        </div>
      </div>
    </AgencyLayout>
  );
};
