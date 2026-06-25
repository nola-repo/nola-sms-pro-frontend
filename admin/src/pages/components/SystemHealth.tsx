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
} from 'react-icons/fi';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const ADMIN_API = '/api/admin_sender_requests.php';
const POLL_INTERVAL = 15000;

type SmsFilter = 'failed' | 'pending' | 'sent';

const asArray = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.logs)) return value.logs;
    if (Array.isArray(value?.results)) return value.results;
    return [];
};

const normalizeAccount = (item: any) => item?.data ? { id: item.id, ...item.data } : item || {};

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
    if (state === 'ok') return 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/10 dark:text-emerald-400';
    if (state === 'warn') return 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-400';
    return 'border-red-100 bg-red-50 text-red-600 dark:border-red-800/30 dark:bg-red-900/10 dark:text-red-400';
};

export const SystemHealth: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [endpointState, setEndpointState] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [smsFilter, setSmsFilter] = useState<SmsFilter>('failed');
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchHealth = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError('');

        const endpoints = {
            logs: `${ADMIN_API}?action=logs`,
            accounts: `${ADMIN_API}?action=accounts`,
            settings: '/api/admin_settings.php',
        };

        try {
            const results = await Promise.allSettled(
                Object.entries(endpoints).map(async ([key, url]) => {
                    const res = await adminFetch(url, { headers: getAdminAuthHeaders() });
                    const json = await res.json().catch(() => ({}));
                    return { key, ok: res.ok && (json.status === undefined || json.status === 'success'), json };
                })
            );

            const nextEndpointState: Record<string, boolean> = {};
            results.forEach((result) => {
                if (result.status !== 'fulfilled') return;
                const { key, ok, json } = result.value;
                nextEndpointState[key] = ok;
                if (!ok) return;
                if (key === 'logs') setLogs(asArray(json));
                if (key === 'accounts') setAccounts(asArray(json).map(normalizeAccount));
                if (key === 'settings') setSettings(json.data || json.settings || json);
            });

            setEndpointState(nextEndpointState);
            if (!nextEndpointState.logs) setError('Activity logs endpoint is unavailable. Showing the last loaded health snapshot if present.');
            setLastRefreshed(new Date());
        } catch {
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
            const id = account.location_id || account.active_location_id || account.id;
            if (id) map.set(id, account);
        });
        return map;
    }, [accounts]);

    const lowBalanceAccounts = accounts.filter((account) => Number(account.credit_balance ?? account.credits ?? 0) <= 10);
    const apiOkCount = Object.values(endpointState).filter(Boolean).length;
    const apiTotal = Object.keys(endpointState).length || 3;
    const providerName = String(settings?.sms_provider?.active_provider || localStorage.getItem('admin_setting_active_provider') || 'system');
    const providerConfigured = providerName === 'unisms'
        ? settings?.sms_provider?.unisms_configured !== false
        : true;
    const deliveryRate = smsLogs.length ? Math.round((smsByStatus.sent.length / smsLogs.length) * 100) : 100;

    const healthCards = [
        {
            label: 'API Availability',
            value: apiOkCount === apiTotal ? 'Online' : apiOkCount > 0 ? 'Degraded' : 'Offline',
            detail: `${apiOkCount}/${apiTotal} admin endpoints responding`,
            icon: <FiServer />,
            state: apiOkCount === apiTotal ? 'ok' : apiOkCount > 0 ? 'warn' : 'bad',
        },
        {
            label: 'SMS Delivery',
            value: `${deliveryRate}%`,
            detail: `${smsByStatus.sent.length.toLocaleString()} sent of ${smsLogs.length.toLocaleString()} messages`,
            icon: <FiSend />,
            state: deliveryRate >= 95 ? 'ok' : deliveryRate >= 80 ? 'warn' : 'bad',
        },
        {
            label: 'Failed Sends',
            value: smsByStatus.failed.length.toLocaleString(),
            detail: 'Failed SMS events in current log window',
            icon: <FiXCircle />,
            state: smsByStatus.failed.length === 0 ? 'ok' : smsByStatus.failed.length < 10 ? 'warn' : 'bad',
        },
        {
            label: 'Pending Messages',
            value: smsByStatus.pending.length.toLocaleString(),
            detail: 'Queued, requested, or processing sends',
            icon: <FiClock />,
            state: smsByStatus.pending.length === 0 ? 'ok' : smsByStatus.pending.length < 10 ? 'warn' : 'bad',
        },
        {
            label: 'Billing Health',
            value: lowBalanceAccounts.length ? `${lowBalanceAccounts.length} low` : 'Healthy',
            detail: `${accounts.length.toLocaleString()} subaccounts monitored`,
            icon: <FiCreditCard />,
            state: lowBalanceAccounts.length === 0 ? 'ok' : lowBalanceAccounts.length < 5 ? 'warn' : 'bad',
        },
        {
            label: 'Provider Connectivity',
            value: providerConfigured ? providerName : 'Needs key',
            detail: providerConfigured ? 'Provider settings loaded' : 'Provider key is missing or masked as unavailable',
            icon: <FiWifi />,
            state: providerConfigured ? 'ok' : 'warn',
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#9aa0a6]">
                    Last checked {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <button
                    onClick={() => fetchHealth(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-[12px] font-bold text-[#6e6e73] shadow-sm transition-colors hover:bg-[#f7f7f7] hover:text-[#111111] dark:border-white/10 dark:bg-[#1a1b1e] dark:text-[#9aa0a6] dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-700 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-400">
                    <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {healthCards.map((card) => (
                    <div key={card.label} className={`rounded-2xl border p-4 ${healthTone(card.state)}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-75">{card.label}</div>
                                <div className="mt-2 text-[24px] font-black text-[#111111] dark:text-white">{card.value}</div>
                                <div className="mt-1 text-[12px] font-semibold opacity-80">{card.detail}</div>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-[20px] dark:bg-white/5">
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                    <div className="flex flex-col gap-3 border-b border-[#e5e5e5] px-5 py-4 dark:border-white/5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="flex items-center gap-2 text-[15px] font-black text-[#111111] dark:text-white">
                                <FiMessageSquare className="h-4 w-4 text-[#2b83fa]" />
                                SMS Diagnostics
                            </h3>
                            <p className="mt-0.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">
                                Delivery status, provider references, and failure details from platform logs.
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
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-black transition-colors ${
                                            active
                                                ? 'border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]'
                                                : 'border-[#e5e5e5] bg-[#f7f7f7] text-[#6e6e73] hover:text-[#111111] dark:border-white/5 dark:bg-[#0d0e10] dark:text-[#9aa0a6] dark:hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-white dark:bg-white/5'}`}>{item.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left">
                            <thead>
                                <tr className="border-b border-[#f0f0f0] text-[10px] font-black uppercase tracking-widest text-[#6e6e73] dark:border-white/5 dark:text-[#9aa0a6]">
                                    <th className="px-5 py-3">Time</th>
                                    <th className="px-5 py-3">Subaccount</th>
                                    <th className="px-5 py-3">Recipient</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Provider</th>
                                    <th className="px-5 py-3">Diagnostics</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f3f4f6] dark:divide-white/[0.04]">
                                {loading ? (
                                    [...Array(5)].map((_, index) => (
                                        <tr key={index}>
                                            <td colSpan={6} className="px-5 py-3">
                                                <div className="h-10 animate-pulse rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10]" />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredSms.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-14 text-center">
                                            <FiCheckCircle className="mx-auto mb-3 h-9 w-9 text-emerald-500/60" />
                                            <div className="text-[14px] font-bold text-[#111111] dark:text-white">No {smsFilter} SMS records</div>
                                            <div className="mt-1 text-[12px] text-[#9aa0a6]">Change the quick filter to inspect another status.</div>
                                        </td>
                                    </tr>
                                ) : filteredSms.map((log, index) => {
                                    const locId = log.location_id || log.account_id;
                                    const account = accountsByLocation.get(locId) || {};
                                    const status = getStatusGroup(log);
                                    const diagnostics = log.failure_reason || log.error_message || log.provider_error || log.error || log.diagnostics || log.details || log.status_message || '-';
                                    return (
                                        <tr key={log.id || log.message_id || log.provider_message_id || `${locId}-${index}`} className="hover:bg-[#f7f7f7] dark:hover:bg-white/[0.02]">
                                            <td className="whitespace-nowrap px-5 py-3 text-[12px] font-semibold text-[#6e6e73] dark:text-[#9aa0a6]">
                                                {formatDateTime(log.timestamp || log.date_created || log.created_at)}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="max-w-[190px] truncate text-[12px] font-bold text-[#111111] dark:text-white" title={account.location_name || log.location_name || locId}>
                                                    {account.location_name || log.location_name || locId || 'Unknown'}
                                                </div>
                                                <div className="max-w-[190px] truncate font-mono text-[10px] text-[#9aa0a6]" title={locId}>{locId || '-'}</div>
                                            </td>
                                            <td className="px-5 py-3 font-mono text-[12px] font-semibold text-[#111111] dark:text-white">{log.number || log.to || '-'}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusPill(status)}`}>
                                                    {log.status || status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6]">
                                                {normalizeProvider(log, settings)}
                                                {(log.provider_message_id || log.provider_reference_id) && (
                                                    <div className="mt-0.5 max-w-[160px] truncate font-mono text-[10px] text-[#9aa0a6]" title={log.provider_message_id || log.provider_reference_id}>
                                                        {log.provider_message_id || log.provider_reference_id}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="max-w-[260px] px-5 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">
                                                <span className="line-clamp-2" title={String(diagnostics)}>{String(diagnostics)}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="flex items-center gap-2 text-[15px] font-black text-[#111111] dark:text-white">
                                <FiAlertCircle className="h-4 w-4 text-red-500" />
                                Recent Errors
                            </h3>
                            <p className="mt-0.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">Latest failed or diagnostic events.</p>
                        </div>
                        <FiDatabase className="h-5 w-5 text-[#9aa0a6]" />
                    </div>

                    {recentErrors.length === 0 ? (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-center text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/10 dark:text-emerald-400">
                            <FiCheckCircle className="mx-auto mb-2 h-7 w-7" />
                            <div className="text-[13px] font-black">No recent errors</div>
                            <div className="mt-1 text-[12px] font-semibold opacity-80">Current log window is clear.</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentErrors.map((log, index) => {
                                const status = getStatusGroup(log);
                                const message = log.failure_reason || log.error_message || log.provider_error || log.error || log.message || log.details || 'Review event details';
                                return (
                                    <div key={log.id || `${getTimestamp(log)}-${index}`} className="rounded-xl border border-red-100 bg-red-50/70 p-3 dark:border-red-900/20 dark:bg-red-900/10">
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusPill(status)}`}>
                                                {log.status || status}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-tight text-red-500/70">{formatDateTime(log.timestamp || log.date_created || log.created_at)}</span>
                                        </div>
                                        <div className="line-clamp-2 text-[12px] font-semibold text-[#111111] dark:text-white" title={String(message)}>
                                            {String(message)}
                                        </div>
                                        <div className="mt-1 truncate font-mono text-[10px] text-[#9aa0a6]">
                                            {log.location_id || log.account_id || 'global'} {log.provider_message_id || log.provider_reference_id ? `- ${log.provider_message_id || log.provider_reference_id}` : ''}
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
