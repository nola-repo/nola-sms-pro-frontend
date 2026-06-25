// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertCircle,
    FiCheckCircle,
    FiClock,
    FiCreditCard,
    FiDatabase,
    FiMessageSquare,
    FiRefreshCw,
    FiSend,
    FiServer,
    FiWifi,
    FiXCircle,
    FiCpu,
    FiSliders,
    FiAlertTriangle,
} from 'react-icons/fi';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const POLL_INTERVAL = 15000;

type SmsFilter = 'failed' | 'pending' | 'sent';

const asArray = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.logs)) return value.logs;
    if (Array.isArray(value?.results)) return value.results;
    return [];
};

const getType = (log: any) => {
    if (log.type === 'message' && (log.amount === undefined || log.amount === null)) return 'message';
    if (log.message_id || log.provider_message_id || log.provider_reference_id || log.number || log.to) return 'message';
    return log.type || 'message';
};

const getStatusGroup = (log: any): SmsFilter | 'other' => {
    const status = String(log.status || log.delivery_status || log.provider_status || '').toLowerCase();
    if (['sent', 'delivered', 'success', 'successful', 'completed'].includes(status)) return 'sent';
    if (['pending', 'queued', 'processing', 'requested', 'sending'].includes(status)) return 'pending';
    if (['failed', 'rejected', 'revoked', 'error', 'denied', 'undelivered'].includes(status)) return 'failed';
    return status ? 'pending' : 'sent';
};

const hasErrorSignal = (log: any) => (
    getStatusGroup(log) === 'failed' ||
    Boolean(log.error || log.error_message || log.failure_reason || log.provider_error || log.diagnostics)
);

const getTimestamp = (log: any) => {
    const raw = log.timestamp || log.date_created || log.created_at || log.createdAt || log.updated_at;
    if (!raw) return 0;
    if (typeof raw === 'object' && typeof raw.seconds === 'number') return raw.seconds * 1000;
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value: any) => {
    const ts = getTimestamp({ timestamp: value });
    if (!ts) return '-';
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const normalizeProvider = (log: any, settings: any) => {
    const provider = String(
        log?.provider ||
        log?.approved_provider ||
        log?.provider_preference ||
        settings?.sms_provider?.active_provider ||
        localStorage.getItem('admin_setting_active_provider') ||
        'system'
    ).toLowerCase();
    if (provider.includes('unisms')) return 'UniSMS';
    if (provider.includes('semaphore')) return 'Semaphore';
    return 'System';
};

const statusPill = (status: SmsFilter | 'other') => {
    const map = {
        sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
        pending: 'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
        failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
        other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
    };
    return map[status] || map.other;
};

const healthTone = (state: 'ok' | 'warn' | 'bad') => {
    if (state === 'ok') return 'border-emerald-100/60 bg-emerald-50/30 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all';
    if (state === 'warn') return 'border-amber-100/60 bg-amber-50/30 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400 hover:bg-amber-500/10 transition-all';
    return 'border-red-100/60 bg-red-50/30 text-red-600 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400 hover:bg-red-500/10 transition-all';
};

export const SystemHealth: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [providerInfo, setProviderInfo] = useState<any>(null);
    const [dbConnected, setDbConnected] = useState<boolean>(true);
    const [stats, setStats] = useState<any>(null);
    const [endpointState, setEndpointState] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [smsFilter, setSmsFilter] = useState<SmsFilter>('failed');
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchHealth = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError('');

        try {
            const res = await adminFetch('/api/v2/admin_health', { headers: getAdminAuthHeaders() });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.status === 'success') {
                const healthData = json.data;
                setLogs(healthData.logs || []);
                setAccounts(healthData.accounts || []);
                setSettings(healthData.settings || null);
                setProviderInfo(healthData.provider || null);
                setDbConnected(healthData.database_connected !== false);
                setStats(healthData.stats || null);

                setEndpointState({
                    db: healthData.database_connected !== false,
                    provider: healthData.provider?.status === 'active',
                    logs: true
                });
            } else {
                setError(json.message || 'Failed to fetch system health diagnostics.');
            }
            setLastRefreshed(new Date());
        } catch (e) {
            setError('Network error. Could not refresh system health.');
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth(true);
        const timer = setInterval(() => fetchHealth(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchHealth]);

    const smsLogs = useMemo(() => logs.filter((log) => getType(log) === 'message'), [logs]);
    const smsByStatus = useMemo(() => ({
        failed: smsLogs.filter((log) => getStatusGroup(log) === 'failed'),
        pending: smsLogs.filter((log) => getStatusGroup(log) === 'pending'),
        sent: smsLogs.filter((log) => getStatusGroup(log) === 'sent'),
    }), [smsLogs]);

    const filteredSms = useMemo(() => (
        [...smsByStatus[smsFilter]].sort((a, b) => getTimestamp(b) - getTimestamp(a)).slice(0, 50)
    ), [smsByStatus, smsFilter]);

    const recentErrors = useMemo(() => (
        logs
            .filter(hasErrorSignal)
            .sort((a, b) => getTimestamp(b) - getTimestamp(a))
            .slice(0, 8)
    ), [logs]);

    const accountsByLocation = useMemo(() => {
        const map = new Map<string, any>();
        accounts.forEach((account) => {
            const id = account.location_id || account.active_location_id || account.id || account.data?.location_id;
            const normAcc = account.data ? { id: account.id, ...account.data } : account;
            if (id) map.set(id, normAcc);
        });
        return map;
    }, [accounts]);

    const systemStatus = useMemo(() => {
        if (!dbConnected) return { label: 'System Offline', style: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400', dot: 'bg-red-500' };
        if (providerInfo?.status !== 'active') return { label: 'Degraded Performance (Gateway Issue)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        if (stats?.delivery_rate !== undefined && stats.delivery_rate < 85) return { label: 'Degraded Performance (Low Success Rate)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        return { label: 'All Systems Operational', style: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    }, [dbConnected, providerInfo, stats]);

    const healthCards = [
        {
            label: 'Database Integrity',
            value: dbConnected ? 'Online' : 'Offline',
            detail: dbConnected ? 'Core Firestore operational' : 'Database connection error',
            icon: <FiDatabase />,
            state: dbConnected ? 'ok' : 'bad',
        },
        {
            label: 'Active Gateway',
            value: providerInfo?.name ? (providerInfo.name === 'auto_failover' ? 'Auto Failover' : (providerInfo.name === 'unisms' ? 'UniSMS' : 'Semaphore')) : 'Unknown',
            detail: providerInfo?.balance !== undefined ? `${providerInfo.balance.toLocaleString()} master credits` : 'Checking connectivity...',
            icon: <FiWifi />,
            state: providerInfo?.status === 'active' ? (providerInfo.balance < 500 ? 'warn' : 'ok') : 'bad',
        },
        {
            label: 'SMS Success Rate',
            value: `${stats?.delivery_rate ?? 100}%`,
            detail: `${stats?.sent_messages ?? 0} sent of ${stats?.total_messages ?? 0} messages`,
            icon: <FiSend />,
            state: (stats?.delivery_rate ?? 100) >= 95 ? 'ok' : (stats?.delivery_rate ?? 100) >= 80 ? 'warn' : 'bad',
        },
        {
            label: 'Failed Sends',
            value: (stats?.failed_messages ?? 0).toLocaleString(),
            detail: 'Failed messages in window',
            icon: <FiXCircle />,
            state: (stats?.failed_messages ?? 0) === 0 ? 'ok' : (stats?.failed_messages ?? 0) < 10 ? 'warn' : 'bad',
        },
        {
            label: 'Pending Queue',
            value: (stats?.pending_messages ?? 0).toLocaleString(),
            detail: 'Currently queued or retrying',
            icon: <FiClock />,
            state: (stats?.pending_messages ?? 0) === 0 ? 'ok' : (stats?.pending_messages ?? 0) < 10 ? 'warn' : 'bad',
        },
        {
            label: 'Billing Health',
            value: stats?.low_balance_subaccounts ? `${stats.low_balance_subaccounts} low` : 'Healthy',
            detail: `${stats?.total_subaccounts ?? 0} subaccounts monitored`,
            icon: <FiCreditCard />,
            state: (stats?.low_balance_subaccounts ?? 0) === 0 ? 'ok' : (stats?.low_balance_subaccounts ?? 0) < 5 ? 'warn' : 'bad',
        },
    ];

    return (
        <div className="space-y-5">
            {/* Header section with real-time health indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-gradient-to-r shadow-sm transition-all duration-300 dark:shadow-none hover:shadow-md backdrop-blur-md opacity-95 border-opacity-60 dark:border-white/5 bg-white dark:bg-[#1a1b1e] text-[#111111] dark:text-white">
                <div className="flex items-center gap-3">
                    <div className={`relative flex h-3 w-3`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatus.dot}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.dot}`}></span>
                    </div>
                    <div>
                        <h2 className="text-[15px] font-black tracking-tight">{systemStatus.label}</h2>
                        <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                            Last checked: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchHealth(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-[12px] font-bold text-[#6e6e73] shadow-sm transition-all hover:bg-[#f7f7f7] hover:text-[#111111] dark:border-white/10 dark:bg-[#1a1b1e] dark:text-[#9aa0a6] dark:hover:bg-white/5 dark:hover:text-white hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Trigger Diagnostic Check
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/70 dark:border-red-900/20 dark:bg-red-900/10 px-4 py-3 text-[12px] font-semibold text-red-600 dark:text-red-400">
                    <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Health Metric Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {healthCards.map((card) => (
                    <div key={card.label} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md dark:shadow-none hover:translate-y-[-2px] transition-all duration-300 ${healthTone(card.state)}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-75">{card.label}</div>
                                <div className="text-[26px] font-black tracking-tight">{card.value}</div>
                                <div className="text-[11px] font-bold opacity-80 leading-relaxed">{card.detail}</div>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 dark:bg-white/5 shadow-sm text-[20px] backdrop-blur-sm border border-black/5 dark:border-white/5">
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Gateway Configuration & Quick-View */}
            {settings && (
                <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                    <div className="flex items-center justify-between border-b border-[#e5e5e5] dark:border-white/5 pb-3 mb-4">
                        <h3 className="text-[13px] font-black uppercase tracking-wider text-[#111111] dark:text-white flex items-center gap-2">
                            <FiSliders className="w-4 h-4 text-[#2b83fa]" />
                            System Config Quick-View
                        </h3>
                        {settings.maintenance_mode && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400 border border-amber-200/50">
                                <FiAlertTriangle className="w-3 h-3" /> MAINTENANCE MODE ACTIVE
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Default Sender ID</span>
                            <span className="font-mono font-bold text-[#111111] dark:text-white">{settings.sender_default}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Free Message Limit</span>
                            <span className="font-bold text-[#111111] dark:text-white">{settings.free_limit} SMS</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Auto-Refresh Rate</span>
                            <span className="font-bold text-[#111111] dark:text-white">{settings.poll_interval} seconds</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Active Route</span>
                            <span className="font-bold text-[#111111] dark:text-white uppercase">
                                {settings.sms_provider?.active_provider === 'auto_failover' ? 'Failover (Semaphore ➔ UniSMS)' : settings.sms_provider?.active_provider}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Logs and Diagnostic Feed */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                    <div className="flex flex-col gap-3 border-b border-[#e5e5e5] px-5 py-4 dark:border-white/5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="flex items-center gap-2 text-[14px] font-black text-[#111111] dark:text-white">
                                <FiMessageSquare className="h-4 w-4 text-[#2b83fa]" />
                                SMS Diagnostics Feed
                            </h3>
                            <p className="mt-0.5 text-[11px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">
                                Delivery status, provider references, and diagnostics from active platform logs.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto">
                            {[
                                { id: 'failed', label: 'Failed', count: smsByStatus.failed.length },
                                { id: 'pending', label: 'Pending', count: smsByStatus.pending.length },
                                { id: 'sent', label: 'Sent', count: smsByStatus.sent.length },
                            ].map((item) => {
                                const active = smsFilter === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSmsFilter(item.id as SmsFilter)}
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-black transition-all ${
                                            active
                                                ? 'border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111] shadow-sm'
                                                : 'border-[#e5e5e5] bg-[#f7f7f7] text-[#6e6e73] hover:text-[#111111] dark:border-white/5 dark:bg-[#0d0e10] dark:text-[#9aa0a6] dark:hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-white dark:bg-white/5'}`}>{item.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left">
                            <thead>
                                <tr className="border-b border-[#f0f0f0] text-[10px] font-black uppercase tracking-widest text-[#6e6e73] dark:border-white/5 dark:text-[#9aa0a6]">
                                    <th className="px-5 py-3.5">Time</th>
                                    <th className="px-5 py-3.5">Subaccount</th>
                                    <th className="px-5 py-3.5">Recipient</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Provider</th>
                                    <th className="px-5 py-3.5">Diagnostics</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f3f4f6] dark:divide-white/[0.04] text-[12px]">
                                {loading ? (
                                    [...Array(5)].map((_, index) => (
                                        <tr key={index}>
                                            <td colSpan={6} className="px-5 py-4">
                                                <div className="h-10 animate-pulse rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10]" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredSms.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-16 text-center">
                                            <FiCheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-500/60" />
                                            <div className="text-[13px] font-black text-[#111111] dark:text-white">No {smsFilter} SMS records found</div>
                                            <div className="mt-1 text-[11px] text-[#9aa0a6]">Use the quick filter above to inspect other logs.</div>
                                        </td>
                                    </tr>
                                ) : filteredSms.map((log, index) => {
                                    const locId = log.location_id || log.account_id;
                                    const account = accountsByLocation.get(locId) || {};
                                    const status = getStatusGroup(log);
                                    const diagnostics = log.failure_reason || log.error_message || log.provider_error || log.error || log.diagnostics || log.details || log.status_message || '-';
                                    return (
                                        <tr key={log.id || log.message_id || log.provider_message_id || `${locId}-${index}`} className="hover:bg-[#f7f7f7] dark:hover:bg-white/[0.01] transition-colors">
                                            <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-[#6e6e73] dark:text-[#9aa0a6]">
                                                {formatDateTime(log.timestamp || log.date_created || log.created_at)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="max-w-[190px] truncate font-bold text-[#111111] dark:text-white" title={account.location_name || log.location_name || locId}>
                                                    {account.location_name || log.location_name || locId || 'Unknown'}
                                                </div>
                                                <div className="max-w-[190px] truncate font-mono text-[9px] text-[#9aa0a6] mt-0.5" title={locId}>{locId || '-'}</div>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono font-semibold text-[#111111] dark:text-white">{log.number || log.to || '-'}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusPill(status)}`}>
                                                    {log.status || status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-[#6e6e73] dark:text-[#9aa0a6]">
                                                {normalizeProvider(log, settings)}
                                                {(log.provider_message_id || log.provider_reference_id) && (
                                                    <div className="mt-0.5 max-w-[160px] truncate font-mono text-[9px] text-[#9aa0a6]" title={log.provider_message_id || log.provider_reference_id}>
                                                        {log.provider_message_id || log.provider_reference_id}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="max-w-[260px] px-5 py-3.5 font-medium text-[#6e6e73] dark:text-[#9aa0a6]">
                                                <span className="line-clamp-2 leading-relaxed" title={String(diagnostics)}>{String(diagnostics)}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right panel: Recent Errors feed */}
                <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                    <div className="mb-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-white/5 pb-3">
                        <div>
                            <h3 className="flex items-center gap-2 text-[14px] font-black text-[#111111] dark:text-white">
                                <FiAlertCircle className="h-4 w-4 text-red-500" />
                                Critical Issues Feed
                            </h3>
                            <p className="mt-0.5 text-[11px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">Latest failed send or validation events.</p>
                        </div>
                        <FiCpu className="h-5 w-5 text-[#9aa0a6]" />
                    </div>

                    {recentErrors.length === 0 ? (
                        <div className="rounded-xl border border-emerald-100/50 bg-emerald-50/20 px-4 py-6 text-center text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/[0.02] dark:text-emerald-400">
                            <FiCheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500/70" />
                            <div className="text-[12px] font-black">All Diagnostics Normal</div>
                            <div className="mt-0.5 text-[11px] font-medium opacity-80">Current log window is clear of errors.</div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                            {recentErrors.map((log, index) => {
                                const status = getStatusGroup(log);
                                const message = log.failure_reason || log.error_message || log.provider_error || log.error || log.message || log.details || 'Review event details';
                                return (
                                    <div key={log.id || `${getTimestamp(log)}-${index}`} className="rounded-xl border border-red-100/60 bg-red-50/20 p-3.5 dark:border-red-900/20 dark:bg-red-950/10">
                                        <div className="mb-2 flex items-center justify-between gap-2 border-b border-red-100/30 dark:border-red-900/10 pb-1.5">
                                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusPill(status)}`}>
                                                {log.status || status}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-tight text-[#9aa0a6]">{formatDateTime(log.timestamp || log.date_created || log.created_at)}</span>
                                        </div>
                                        <div className="text-[11.5px] font-semibold text-[#111111] dark:text-white leading-relaxed" title={String(message)}>
                                            {String(message)}
                                        </div>
                                        <div className="mt-2 truncate font-mono text-[9px] text-[#9aa0a6] flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">{log.location_id || log.account_id || 'global'}</span>
                                            {log.provider_message_id || log.provider_reference_id ? `• ${log.provider_message_id || log.provider_reference_id}` : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
