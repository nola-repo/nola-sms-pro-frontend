// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiSend, FiSettings, FiLogOut, FiLock, FiAlertCircle, FiEye, FiEyeOff, FiCopy, FiCheck, FiX, FiRefreshCw, FiKey, FiHome, FiClock, FiActivity, FiMessageSquare, FiCreditCard, FiShield, FiPlus, FiMinus, FiTrash2, FiChevronLeft, FiChevronRight, FiSearch, FiSun, FiMoon, FiMoreVertical, FiToggleLeft, FiArrowRight } from 'react-icons/fi';
import logoUrl from '../../assets/NOLA SMS PRO Logo.png';
import Antigravity from '../../components/ui/Antigravity';
import SplitText from './SplitText';
import FadeContent from './FadeContent';
import AnimatedContent from './AnimatedContent';
import { AdminLogs } from '../AdminLogs';
const ADMIN_API = '/api/admin_sender_requests.php';
const POLL_INTERVAL = 15000; // 15 seconds real-time sync



export const AdminDashboard: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [requests, setRequests] = useState<SenderRequest[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const ITEMS_PER_PAGE = 5;

    const fetchData = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const [accRes, logsRes, reqRes] = await Promise.all([
                fetch(`${ADMIN_API}?action=accounts`).catch(() => null),
                fetch(`${ADMIN_API}?action=logs`).catch(() => null),
                fetch(ADMIN_API).catch(() => null)
            ]);

            if (accRes) {
                const accJson = await accRes.json();
                if (accJson.status === 'success') {
                    const mapped = (accJson.data || []).map((item: any) => item.data ? { id: item.id, ...item.data } : item)
                        .filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                    setAccounts(mapped);
                }
            }
            if (reqRes) {
                const reqJson = await reqRes.json();
                if (reqJson.status === 'success') setRequests(reqJson.data || []);
            }
            if (logsRes) {
                const logsJson = await logsRes.json();
                if (logsJson.status === 'success') {
                    const sortedLogs = (logsJson.data || []).sort((a: any, b: any) => {
                        const timeA = new Date(a.timestamp || a.date_created || a.created_at || 0).getTime();
                        const timeB = new Date(b.timestamp || b.date_created || b.created_at || 0).getTime();
                        return timeB - timeA;
                    });
                    setLogs(sortedLogs);
                }
            }
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("Dashboard poll error:", err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const timer = setInterval(() => fetchData(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchData]);

    const totalAccounts = accounts.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const totalMessages = logs.length;
    const approvedSenders = accounts.filter(a => a.approved_sender_id).length;
    const recentRequests = [...requests].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

    const StatCard = ({ label, value, color, icon, index = 0 }: { label: string; value: number | string; color: string; icon: React.ReactNode, index?: number }) => (
        <div
            className="animate-in fade-in slide-in-from-bottom-4 duration-700 h-full"
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
        >
            <div className={`relative p-6 rounded-3xl bg-gradient-to-br ${color} shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group h-full`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-white">
                    <div className="w-20 h-20">{icon}</div>
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="w-10 h-10 p-2.5 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4 group-hover:rotate-6 transition-transform duration-300 shadow-inner">
                            {icon}
                        </div>
                        <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-1">{label}</p>
                    </div>
                    <div className="mt-auto pt-2">
                        <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">
                            {loading ? <span className="inline-block w-10 h-8 bg-white/20 animate-pulse rounded-lg" /> : value}
                        </h2>
                    </div>
                </div>
            </div>
        </div>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center shadow-[0_8px_25px_rgba(43,131,250,0.4)] flex-shrink-0 hidden sm:flex">
                        <FiHome className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <SplitText
                            text={`${getGreeting()}, Admin!`}
                            className="text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight"
                            delay={40}
                            duration={1.2}
                            ease="power3.out"
                            splitType="chars"
                            from={{ opacity: 0, y: 30 }}
                            to={{ opacity: 1, y: 0 }}
                            threshold={0.1}
                            rootMargin="-100px"
                            textAlign="left"
                            tag="h1"
                        />
                        <FadeContent blur={false} duration={1200} ease="ease-out" initialOpacity={0}>
                            <p className="text-[#6e6e73] dark:text-[#a0a0ab] font-medium">Welcome back to NOLA SMS PRO</p>
                        </FadeContent>
                    </div>
                </div>
                {!loading && (
                    <span className="text-[11px] text-[#9aa0a6] font-medium bg-white/50 dark:bg-[#1a1b1e]/50 px-3 py-1.5 rounded-full border border-[#0000000a] dark:border-[#ffffff0a]">
                        Last checked: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard index={0} label="Registered Users" value={totalAccounts} color="from-[#2b83fa] to-[#60a5fa]" icon={<FiUsers className="w-full h-full" />} />
                <StatCard index={1} label="Pending Requests" value={pendingRequests} color={pendingRequests > 0 ? 'from-amber-500 to-orange-500' : 'from-slate-400 to-slate-500'} icon={<FiClock className="w-full h-full" />} />
                <StatCard index={2} label="Approved Senders" value={approvedSenders} color="from-emerald-500 to-teal-600" icon={<FiCheck className="w-full h-full" />} />
                <StatCard index={3} label="Total Messages" value={totalMessages} color="from-indigo-500 to-purple-600" icon={<FiMessageSquare className="w-full h-full" />} />
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Quick Actions */}
                <AnimatedContent delay={0.4} distance={50} direction="vertical">
                    <h3 className="text-[15px] font-bold text-[#111111] dark:text-white mb-5 flex items-center gap-2">
                        Quick Actions
                    </h3>
                    <div className="space-y-3">
                        {[
                            { tab: 'requests', label: 'Review Sender Requests', desc: `${pendingRequests} pending approval`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', icon: <FiSend className="h-6 w-6" />, badge: pendingRequests, hoverBorder: 'hover:border-amber-500/30 hover:shadow-amber-500/10' },
                            { tab: 'accounts', label: 'View All Accounts', desc: `${totalAccounts} total installed subaccounts`, color: 'text-[#2b83fa] bg-blue-50 dark:bg-blue-900/20', icon: <FiUsers className="h-6 w-6" />, badge: 0, hoverBorder: 'hover:border-[#2b83fa]/30 hover:shadow-blue-500/10' },
                            { tab: 'settings', label: 'System Settings', desc: 'Global sender ID and free tier config', color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800', icon: <FiSettings className="h-6 w-6" />, badge: 0, hoverBorder: 'hover:border-gray-500/30 hover:shadow-gray-500/10' },
                        ].map(item => (
                            <button key={item.tab} onClick={() => onNavigate(item.tab)}
                                className={`w-full p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm transition-all text-left flex items-center justify-between group ${item.hoverBorder}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color} transition-transform group-hover:scale-110`}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-[#111111] dark:text-white text-[15px]">{item.label}</h4>
                                        <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">{item.desc}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.badge > 0 && (
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 shadow-lg text-white text-[11px] font-black flex items-center justify-center animate-pulse">{item.badge}</span>
                                    )}
                                    <FiArrowRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                </AnimatedContent>

                {/* Recent Sender Requests */}
                <AnimatedContent delay={0.5} distance={50} direction="vertical">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[15px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                            Recent Requests
                        </h3>
                        {recentRequests.length > 5 && (
                            <button onClick={() => onNavigate('requests')} className="text-[12px] font-bold text-[#2b83fa] hover:text-[#1a65d1] py-1 px-3 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                See All
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {loading ? (
                            [1,2,3].map(i => (
                                <div key={i} className="w-full p-3.5 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] flex items-center justify-between">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
                                        <div className="space-y-2 w-full max-w-[150px]">
                                            <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
                                            <div className="h-2 w-full bg-gray-50 dark:bg-gray-900 animate-pulse rounded opacity-60" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : recentRequests.length === 0 ? (
                            <div className="p-10 text-center rounded-3xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                <FiSend className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-500" />
                                <p className="text-gray-400 dark:text-gray-500 text-[14px] font-medium italic">No requests yet.</p>
                            </div>
                        ) : recentRequests.slice(0, 3).map(req => (
                            <button key={req.id} onClick={() => onNavigate('requests')}
                                className="w-full p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group min-h-[74px]">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold shadow-sm ${
                                        req.status === 'pending' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : req.status === 'approved' ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-red-400 to-rose-600'
                                    }`}>
                                        {req.requested_id?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px] truncate">{req.requested_id}</h4>
                                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate max-w-[200px] font-medium">{req.location_name || req.location_id}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${
                                        req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' :
                                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40' :
                                        'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40'
                                    }`}>{req.status}</span>
                                    <div className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa] text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Review
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </AnimatedContent>
            </div>

            {/* Recent Activity Logs */}
            <div className="mt-10">
                <AnimatedContent delay={0.6} distance={50} direction="vertical">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
                        {/* Header Inside Container */}
                        <div className="flex items-center justify-between mb-5 h-8">
                            <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <FiActivity className="w-4 h-4 text-[#2b83fa]" /> Recent Activity
                            </h3>
                            <button
                                onClick={() => onNavigate('activity')}
                                className="text-[12px] font-bold text-[#2b83fa] hover:text-[#1a65d1] py-1 px-3 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                See All
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="h-[72px] rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />
                            ))
                        ) : logs.length === 0 ? (
                            <div className="py-12 text-center rounded-2xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                <FiActivity className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                                <p className="text-[13px] text-gray-400 dark:text-gray-500 font-medium italic">No activity yet.</p>
                            </div>
                        ) : (() => {
                        const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
                        const currentLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
                        
                        return (
                            <>
                                {currentLogs.map((log: any) => {
                                    const isNeg = typeof log.amount === 'number' && log.amount < 0;
                                    const isFreeTrial = log.amount === 0;
                                    const type = log.type === 'message' && log.amount === undefined ? 'message'
                                        : (isNeg || log.type === 'deduction' || log.type === 'credit_usage' || isFreeTrial) ? 'credit_usage'
                                        : log.amount !== undefined || log.type === 'top_up' || log.type === 'credit_purchase' ? 'credit_purchase'
                                        : 'message';
                                    const ts = log.timestamp || log.date_created || log.created_at;
                                    const time = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    const date = ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                                    const locId = log.location_id || log.account_id;
                                    const account = accounts.find((a: any) => a.id === locId || a.location_id === locId);
                                    
                                    return (
                                        <div
                                            key={log.id || log.transaction_id || `log-${idx}`}
                                            onClick={() => onNavigate('activity')}
                                            className="group min-h-[74px] flex items-center gap-4 p-4 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                                        >
                                            <div className={`w-10 h-10 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:scale-110 transition-transform duration-300 ${
                                                type === 'message'         ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa]' :
                                                type === 'credit_purchase' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                                                             'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                            }`}>
                                                {type === 'message'         && <FiMessageSquare className="w-5 h-5" />}
                                                {type === 'credit_purchase' && <FiCreditCard className="w-5 h-5" />}
                                                {type === 'credit_usage'    && <FiActivity className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1 gap-2">
                                                    <p className="text-[14px] font-bold text-[#111111] dark:text-white leading-tight">
                                                        {type === 'message'         ? `SMS to ${log.number || log.to || 'Unknown'}` :
                                                         type === 'credit_purchase' ? `+${log.amount?.toLocaleString()} credits added` :
                                                         isFreeTrial                ? 'Free trial SMS sent' :
                                                                                      `${Math.abs(log.amount)} credits used`}
                                                    </p>
                                                    <span className="text-[11px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap flex-shrink-0">{time}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 flex-1 leading-snug">
                                                        {account?.location_name || (locId ? locId.substring(0, 12) + '…' : 'System')}
                                                        {log.sendername ? ` · via ${log.sendername}` : ''}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
                                                        <span className="text-[10px] font-bold text-[#111111] dark:text-white uppercase tracking-wider">{date}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                        <div className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] uppercase font-bold tracking-wider">
                                            Showing <b className="text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b> – <b className="text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, logs.length)}</b> of <b className="text-[#111111] dark:text-white">{logs.length}</b>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded-lg text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronLeft className="w-4 h-4" /></button>
                                            {Array.from({ length: Math.min(5, totalPages - Math.floor((currentPage - 1) / 5) * 5) }, (_, i) => Math.floor((currentPage - 1) / 5) * 5 + 1 + i).map(page => (
                                                <button key={page} onClick={() => setCurrentPage(page)} className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-[#2b83fa] text-white shadow-sm' : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5'}`}>{page}</button>
                                            ))}
                                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded-lg text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronRight className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    </div>
                </div>
                </AnimatedContent>
            </div>
        </div>
    );
};
