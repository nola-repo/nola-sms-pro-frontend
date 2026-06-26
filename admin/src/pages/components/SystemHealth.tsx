// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertCircle,
    FiCheckCircle,
    FiClock,
    FiCreditCard,
    FiDatabase,
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

const asArray = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.logs)) return value.logs;
    if (Array.isArray(value?.results)) return value.results;
    return [];
};

const getType = (log: any) => {
    if (log.type === 'sender_request') return 'sender_request';
    if (log.type === 'credit_purchase') return 'credit_purchase';
    return 'message';
};

const getStatusGroup = (log: any): 'sent' | 'pending' | 'failed' | 'other' => {
    const status = String(log.status || log.delivery_status || log.provider_status || '').toLowerCase();
    if (['sent', 'delivered', 'success', 'successful', 'completed', 'approved'].includes(status)) return 'sent';
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

const statusPill = (status: 'sent' | 'pending' | 'failed' | 'other') => {
    const map = {
        sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
        pending: 'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
        failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
        other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
    };
    return map[status] || map.other;
};

const healthTone = (state: 'ok' | 'warn' | 'bad') => {
    if (state === 'ok') return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-emerald-500/20 dark:hover:border-emerald-500/30';
    if (state === 'warn') return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-amber-500/20 dark:hover:border-amber-500/30';
    return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-red-500/20 dark:hover:border-red-500/30';
};

const iconTone = (state: 'ok' | 'warn' | 'bad') => {
    if (state === 'ok') return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10';
    if (state === 'warn') return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10';
    return 'text-red-500 bg-red-50 dark:bg-red-500/10';
};

const getLogEventName = (log: any) => {
    const type = getType(log);
    if (type === 'sender_request') return 'Sender Request';
    if (type === 'credit_purchase') return 'Credits Added';
    return 'SMS Send';
};

const getLogDetails = (log: any) => {
    const type = getType(log);
    if (type === 'sender_request') return log.requested_id || '-';
    if (type === 'credit_purchase') return `+${(log.amount ?? 0).toLocaleString()} credits`;
    return log.number || log.to || '-';
};

const getLogDiagnostics = (log: any) => {
    const type = getType(log);
    if (type === 'sender_request') return log.admin_notes || log.reject_reason || '-';
    if (type === 'credit_purchase') return log.description || log.notes || '-';
    return log.failure_reason || log.error_message || log.provider_error || log.error || log.diagnostics || log.details || log.status_message || '-';
};

export const SystemHealth: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [providerInfo, setProviderInfo] = useState<any>(null);
    const [dbConnected, setDbConnected] = useState<boolean>(true);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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


    const redactDiagnostic = useCallback((value: any) => {
        return String(value ?? '-')
            .replace(/(bearer\s+)[^\s]+/gi, '$1[redacted]')
            .replace(/(authorization|token|secret|password|api[_-]?key)(=|:)?\s*[^\s,}]+/gi, '$1=[redacted]');
    }, []);

    const diagnosticRows = useMemo(() => (
        [...logs]
            .sort((a, b) => getTimestamp(b) - getTimestamp(a))
            .slice(0, 24)
            .map((log, index) => {
                const locId = log.location_id || log.account_id || log.locationId || '';
                const account = accountsByLocation.get(locId) || {};
                const status = getStatusGroup(log);
                return {
                    id: log.id || log.message_id || log.provider_message_id || `${locId || 'global'}-${index}`,
                    time: formatDateTime(log.timestamp || log.date_created || log.created_at || log.updated_at),
                    status,
                    event: getLogEventName(log),
                    accountName: account.location_name || log.location_name || locId || 'System',
                    message: redactDiagnostic(getLogDiagnostics(log)),
                    reference: log.provider_message_id || log.message_id || log.request_id || log.id || '',
                };
            })
    ), [logs, accountsByLocation, redactDiagnostic]);

    const lowBalanceAccounts = useMemo(() => (
        accounts
            .map((account) => {
                const data = account.data ? { id: account.id, ...account.data } : account;
                const balance = Number(data.balance ?? data.credit_balance ?? data.credits ?? 0);
                return {
                    id: data.location_id || data.active_location_id || data.id || account.id || 'unknown',
                    name: data.location_name || data.name || data.company_name || data.email || 'Unnamed account',
                    balance: Number.isFinite(balance) ? balance : 0,
                };
            })
            .filter((account) => account.balance <= 50)
            .sort((a, b) => a.balance - b.balance)
            .slice(0, 8)
    ), [accounts]);

    const lastFailure = recentErrors[0];
    const lastFailureDetail = lastFailure ? redactDiagnostic(getLogDiagnostics(lastFailure)) : '';
    const lastSend = useMemo(() => (
        [...logs]
            .filter(log => getType(log) === 'message')
            .sort((a, b) => getTimestamp(b) - getTimestamp(a))[0]
    ), [logs]);

    const serviceChecks = [
        {
            label: 'API Health Endpoint',
            value: error ? 'Attention' : 'Responding',
            detail: error || 'Latest diagnostic payload loaded successfully.',
            state: error ? 'bad' : 'ok',
        },
        {
            label: 'Database Read Path',
            value: dbConnected ? 'Connected' : 'Disconnected',
            detail: dbConnected ? `${accounts.length.toLocaleString()} account records readable` : 'Health endpoint reported a database connection issue.',
            state: dbConnected ? 'ok' : 'bad',
        },
        {
            label: 'Gateway Readiness',
            value: providerInfo?.status === 'active' ? 'Ready' : 'Needs Review',
            detail: providerInfo?.name ? `${normalizeProvider({ provider: providerInfo.name }, settings)} provider status: ${providerInfo.status || 'unknown'}` : 'Provider details were not returned by the health endpoint.',
            state: providerInfo?.status === 'active' ? 'ok' : 'warn',
        },
        {
            label: 'Failure Window',
            value: `${recentErrors.length.toLocaleString()} issue${recentErrors.length === 1 ? '' : 's'}`,
            detail: lastFailure ? `${getLogEventName(lastFailure)} - ${lastFailureDetail}` : 'No failed events in the current diagnostic window.',
            state: recentErrors.length === 0 ? 'ok' : recentErrors.length < 5 ? 'warn' : 'bad',
        },
    ];
    return (
        <div className="space-y-5 text-[#111111] dark:text-white">
            {/* Header section with real-time health indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-white dark:bg-[#1a1b1e] border-[#e5e5e5] dark:border-white/5 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-3">
                    <div className={`relative flex h-3 w-3`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatus.dot}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.dot}`}></span>
                    </div>
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight">{systemStatus.label}</h2>
                        <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 font-medium">
                            Last checked: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchHealth(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-[12px] font-bold text-[#6e6e73] shadow-sm transition-all hover:bg-[#f7f7f7] hover:text-[#111111] dark:border-white/10 dark:bg-[#1a1b1e] dark:text-[#9aa0a6] dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Run Health Check
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
                    <div key={card.label} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all duration-300 ${healthTone(card.state)}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#9aa0a6]">{card.label}</div>
                                <div className="text-[26px] font-extrabold tracking-tight text-[#111111] dark:text-white">{card.value}</div>
                                <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#9aa0a6] leading-relaxed">{card.detail}</div>
                            </div>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm text-[20px] border border-black/5 dark:border-white/5 ${iconTone(card.state)}`}>
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
                        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#111111] dark:text-white flex items-center gap-2">
                            <FiSliders className="w-4 h-4 text-[#2b83fa]" />
                            Provider Configuration
                        </h3>
                        {settings.maintenance_mode && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400 border border-amber-200/50">
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
                                {settings.sms_provider?.active_provider === 'auto_failover' ? 'Failover (Semaphore -> UniSMS)' : settings.sms_provider?.active_provider}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {serviceChecks.map((check) => (
                            <div key={check.label} className={`rounded-2xl border p-4 shadow-sm ${healthTone(check.state as 'ok' | 'warn' | 'bad')}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#9aa0a6]">{check.label}</div>
                                        <div className="mt-1 text-[18px] font-extrabold text-[#111111] dark:text-white">{check.value}</div>
                                        <p className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-relaxed text-[#6e6e73] dark:text-[#9aa0a6]" title={String(check.detail)}>{String(check.detail)}</p>
                                    </div>
                                    <span className={`mt-0.5 flex h-2.5 w-2.5 rounded-full ${check.state === 'ok' ? 'bg-emerald-500' : check.state === 'warn' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                        <div className="mb-4 flex flex-col gap-2 border-b border-[#e5e5e5] pb-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111111] dark:text-white">
                                    <FiActivity className="h-4 w-4 text-[#2b83fa]" />
                                    Diagnostic Console
                                </h3>
                                <p className="mt-0.5 text-[11px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">
                                    Latest backend health events for troubleshooting. Sensitive values are not shown here.
                                </p>
                            </div>
                            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#e5e5e5] bg-[#f7f7f7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:border-white/5 dark:bg-[#0d0e10] dark:text-[#9aa0a6]">
                                {diagnosticRows.length} lines
                            </span>
                        </div>

                        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[#111111]/10 bg-[#0b1020] p-3 font-mono text-[11px] shadow-inner dark:border-white/10">
                            {loading ? (
                                <div className="space-y-2">
                                    {[...Array(6)].map((_, index) => (
                                        <div key={index} className="h-5 animate-pulse rounded bg-white/10" />
                                    ))}
                                </div>
                            ) : diagnosticRows.length === 0 ? (
                                <div className="py-8 text-center font-sans text-[12px] font-bold text-slate-300">No diagnostic events returned.</div>
                            ) : (
                                <div className="space-y-1.5">
                                    {diagnosticRows.map((row) => (
                                        <div key={row.id} className="grid grid-cols-[74px_64px_minmax(0,1fr)] gap-2 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-white/[0.04]">
                                            <span className="text-slate-500">{row.time}</span>
                                            <span className={row.status === 'failed' ? 'text-red-300' : row.status === 'pending' ? 'text-amber-300' : 'text-emerald-300'}>
                                                {row.status.toUpperCase()}
                                            </span>
                                            <span className="min-w-0 truncate" title={`${row.event} | ${row.accountName} | ${row.message}`}>
                                                <span className="text-sky-300">{row.event}</span>
                                                <span className="text-slate-500"> :: </span>
                                                <span>{row.accountName}</span>
                                                <span className="text-slate-500"> :: </span>
                                                <span>{row.message}</span>
                                                {row.reference && <span className="text-slate-500"> #{row.reference}</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                        <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111111] dark:text-white">
                            <FiAlertCircle className="h-4 w-4 text-red-500" />
                            Failure Triage
                        </h3>
                        <div className="mt-4 space-y-3">
                            <div className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 dark:border-white/5 dark:bg-[#0d0e10]">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Latest failure</div>
                                <div className="mt-1 text-[12.5px] font-bold text-[#111111] dark:text-white">
                                    {lastFailure ? getLogEventName(lastFailure) : 'None in current window'}
                                </div>
                                <p className="mt-1 line-clamp-3 text-[11px] font-medium leading-relaxed text-[#6e6e73] dark:text-[#9aa0a6]" title={lastFailure ? lastFailureDetail : undefined}>
                                    {lastFailure ? lastFailureDetail : 'No failed provider, sender, or billing events were returned.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 dark:border-white/5 dark:bg-[#0d0e10]">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Last SMS event</div>
                                    <div className="mt-1 truncate text-[12px] font-bold text-[#111111] dark:text-white" title={lastSend ? getLogDetails(lastSend) : undefined}>{lastSend ? getLogDetails(lastSend) : '-'}</div>
                                    <div className="mt-1 text-[10.5px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">{lastSend ? formatDateTime(lastSend.timestamp || lastSend.date_created || lastSend.created_at) : 'No sends'}</div>
                                </div>
                                <div className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 dark:border-white/5 dark:bg-[#0d0e10]">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">Active provider</div>
                                    <div className="mt-1 truncate text-[12px] font-bold text-[#111111] dark:text-white">{providerInfo?.name || settings?.sms_provider?.active_provider || 'Unknown'}</div>
                                    <div className="mt-1 text-[10.5px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">{providerInfo?.balance !== undefined ? `${providerInfo.balance.toLocaleString()} credits` : 'Balance unavailable'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                        <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111111] dark:text-white">
                            <FiCreditCard className="h-4 w-4 text-[#2b83fa]" />
                            Low Credit Watch
                        </h3>
                        <div className="mt-4 space-y-2">
                            {lowBalanceAccounts.length === 0 ? (
                                <div className="rounded-xl border border-emerald-100/50 bg-emerald-50/30 px-4 py-5 text-center text-[12px] font-bold text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/[0.03] dark:text-emerald-400">
                                    No accounts are at or below 50 credits.
                                </div>
                            ) : lowBalanceAccounts.map((account) => (
                                <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 dark:border-white/5 dark:bg-[#0d0e10]">
                                    <div className="min-w-0">
                                        <div className="truncate text-[12px] font-bold text-[#111111] dark:text-white" title={account.name}>{account.name}</div>
                                        <div className="truncate font-mono text-[9.5px] text-[#9aa0a6]" title={account.id}>{account.id}</div>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${account.balance <= 0 ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400'}`}>
                                        {account.balance.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
