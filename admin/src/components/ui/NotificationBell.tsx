// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { FiBell, FiAlertTriangle, FiAlertOctagon, FiCheckCircle, FiX } from 'react-icons/fi';
import { useAdminNotifications, AdminNotification } from '../../hooks/useAdminNotifications';

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const NotifItem: React.FC<{
    notif: AdminNotification;
    onRead: (id: string) => void;
}> = ({ notif, onRead }) => {
    const isZero = notif.type === 'zero_balance';

    return (
        <div
            onClick={() => { if (!notif.read) onRead(notif.id); }}
            className={`
                relative flex items-start gap-3 px-4 py-3.5 cursor-pointer
                transition-colors duration-150
                ${notif.read
                    ? 'opacity-60 hover:opacity-100 hover:bg-[#f7f7f7] dark:hover:bg-white/[0.03]'
                    : isZero
                        ? 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/15'
                        : 'bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/15'
                }
            `}
        >
            {/* Icon */}
            <div className={`
                mt-0.5 w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center
                ${isZero
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                }
            `}>
                {isZero
                    ? <FiAlertOctagon className="w-4 h-4" />
                    : <FiAlertTriangle className="w-4 h-4" />
                }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-[#111111] dark:text-white leading-snug">
                    {isZero ? '⚠️ Zero Balance' : 'Low Balance'} — {notif.location_name || notif.location_id}
                </p>
                <p className="text-[11.5px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 font-medium">
                    {isZero
                        ? `Sending suspended. Balance: 0 credits.`
                        : `Balance dropped to ${notif.balance} credits (threshold: ${notif.threshold}).`
                    }
                </p>
                <p className="text-[10.5px] text-[#9aa0a6] mt-1 font-medium">{notif.email}</p>
                <p className="text-[10px] text-[#9aa0a6] mt-0.5 font-medium uppercase tracking-wide">
                    {timeAgo(notif.created_at)}
                </p>
            </div>

            {/* Unread dot */}
            {!notif.read && (
                <span className={`
                    mt-1.5 w-2 h-2 rounded-full flex-shrink-0
                    ${isZero ? 'bg-red-500' : 'bg-amber-500'}
                    animate-pulse
                `} />
            )}
        </div>
    );
};

export const NotificationBell: React.FC = () => {
    const { notifications, loading, unreadCount, markRead, markAllRead } = useAdminNotifications();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const hasZero = notifications.some(n => !n.read && n.type === 'zero_balance');

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                ref={btnRef}
                id="admin-notification-bell"
                onClick={() => setOpen(o => !o)}
                className={`
                    relative p-2 rounded-xl border transition-all shadow-sm
                    ${open
                        ? 'bg-[#2b83fa]/10 border-[#2b83fa]/30 text-[#2b83fa]'
                        : 'bg-[#f7f7f7] dark:bg-[#1e2023] border-[#e5e5e5] dark:border-white/5 text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white hover:bg-[#efefef] dark:hover:bg-white/5'
                    }
                `}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                title="Notifications"
            >
                <FiBell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-[ring_1.5s_ease-in-out_infinite]' : ''}`} />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className={`
                        absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
                        text-white text-[9px] font-black flex items-center justify-center
                        shadow-md border-2 border-white dark:border-[#111111]
                        ${hasZero ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}
                    `}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    ref={panelRef}
                    className="
                        absolute right-0 top-[calc(100%+8px)] z-[150]
                        w-[360px] max-w-[calc(100vw-24px)]
                        bg-white dark:bg-[#1a1b1e]
                        border border-[#e5e5e5] dark:border-white/10
                        rounded-2xl shadow-2xl overflow-hidden
                        animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200
                    "
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e5e5e5] dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <FiBell className="w-4 h-4 text-[#2b83fa]" />
                            <span className="text-[13.5px] font-bold text-[#111111] dark:text-white">
                                Notifications
                            </span>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wide">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-colors"
                                    title="Mark all as read"
                                >
                                    <FiCheckCircle className="w-3 h-3" />
                                    All read
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 rounded-lg text-[#6e6e73] hover:text-[#111111] dark:hover:text-white hover:bg-[#f7f7f7] dark:hover:bg-white/5 transition-colors"
                            >
                                <FiX className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-[#f0f0f0] dark:divide-white/[0.04]">
                        {loading ? (
                            <div className="space-y-0.5 p-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-start gap-3 p-3">
                                        <div className="w-8 h-8 rounded-xl bg-[#f0f0f0] dark:bg-[#2a2b2e] animate-pulse flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 w-3/4 rounded bg-[#f0f0f0] dark:bg-[#2a2b2e] animate-pulse" />
                                            <div className="h-2.5 w-full rounded bg-[#f0f0f0] dark:bg-[#2a2b2e] animate-pulse opacity-60" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-14 text-center">
                                <FiBell className="w-8 h-8 mx-auto mb-3 text-[#d0d0d5] dark:text-[#3a3b3f]" />
                                <p className="text-[13px] font-semibold text-[#9aa0a6]">No notifications yet</p>
                                <p className="text-[11px] text-[#9aa0a6] mt-1 font-medium">
                                    Zero/low balance alerts will appear here
                                </p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <NotifItem key={n.id} notif={n} onRead={markRead} />
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-[#f0f0f0] dark:border-white/5 bg-[#fafafa] dark:bg-black/20">
                            <p className="text-[10.5px] text-center text-[#9aa0a6] font-medium">
                                Showing last {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Auto-refreshes every 60s
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
