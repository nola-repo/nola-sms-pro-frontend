import { useState, useEffect } from "react";
import { FiHome, FiPlus, FiUsers, FiSettings, FiCreditCard, FiMessageSquare, FiArrowRight, FiClock, FiUser, FiX, FiActivity, FiDownload, FiTrendingUp } from "react-icons/fi";
import type { Contact } from "../types/Contact";
import type { BulkMessageHistoryItem, Conversation } from "../types/Sms";
import { fetchConversations, type SenderId } from "../api/sms";
import { fetchContacts } from "../api/contacts";
import { fetchCreditStatus, fetchCreditTransactions, type CreditStatus, type CreditTransaction } from "../api/credits";
import { generateMonthlyReport } from "../utils/pdfGenerator";
import SplitText from "./SplitText";
import AnimatedContent from "./AnimatedContent";
import FadeContent from "./FadeContent";
import { SenderSelector } from "./SenderSelector";
import { extractBatchIdFromGroupConversationId, extractPhoneFromDirectConversationId } from "../utils/conversationId";
import { useLocationId } from "../context/LocationContext";
import { useUserProfileContext } from "../context/UserProfileContext";
import type { ViewTab } from "./Sidebar";

interface HomeProps {
    onTabChange: (tab: ViewTab) => void;
    onSelectContact: (contact: Contact) => void;
    onSelectBulkMessage: (message: BulkMessageHistoryItem) => void;
}

type HomeCreditTransaction = Omit<CreditTransaction, "type"> & {
    id?: string;
    type: CreditTransaction["type"] | "credit_purchase" | string;
};

type TrendPoint = {
    key: string;
    label: string;
    value: number;
};

const toDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const createDaySeries = (anchorDate: Date, days = 7): TrendPoint[] => {
    return Array.from({ length: days }, (_, index) => {
        const date = new Date(anchorDate);
        date.setDate(anchorDate.getDate() - (days - 1 - index));
        return {
            label: date.toLocaleDateString([], { weekday: "short" }),
            key: dayKey(date),
            value: 0,
        };
    });
};

const getSeriesTotal = (series: TrendPoint[]) =>
    series.reduce((sum, point) => sum + point.value, 0);

const buildFallbackSeries = (series: TrendPoint[], fallbackTotal: number): TrendPoint[] => {
    if (getSeriesTotal(series) > 0 || fallbackTotal <= 0) return series;

    const weights = [0.42, 0.75, 0.58, 1.05, 0.82, 1.35, 1.1, 0.68, 0.95, 0.72, 1.2, 0.88, 1.48, 1.05];
    const activeWeights = weights.slice(-series.length);
    const weightTotal = activeWeights.reduce((sum, weight) => sum + weight, 0);
    const targetTotal = Math.max(1, Math.round(fallbackTotal));
    const values = activeWeights.map((weight) => Math.floor((targetTotal * weight) / weightTotal));
    const orderedIndexes = activeWeights
        .map((weight, index) => ({ weight, index }))
        .sort((a, b) => b.weight - a.weight)
        .map((item) => item.index);
    let remaining = targetTotal - values.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    while (remaining > 0) {
        values[orderedIndexes[cursor % orderedIndexes.length]] += 1;
        remaining -= 1;
        cursor += 1;
    }

    return series.map((point, index) => ({
        ...point,
        value: values[index],
    }));
};

export const Home: React.FC<HomeProps> = ({ onTabChange, onSelectContact, onSelectBulkMessage }) => {
    const { locationId } = useLocationId();
    const liveProfile = useUserProfileContext();
    const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsCount, setContactsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const [senderName, setSenderName] = useState<SenderId>("NOLASMSPro");
    const [trendAnchor] = useState(() => new Date());

    useEffect(() => {
        const loadHomeData = async (isInitial = false) => {
            if (isInitial) {
                setLoading(true);
            }

            // Fetch contacts independently in the background
            fetchContacts(locationId || undefined).then((data) => {
                setContacts(data);
                setContactsCount(data.length);
            }).catch(() => []);

            // Synchronize critical dashboard data (credits, conversations, and transactions)
            const [credStatus, convs, txRes] = await Promise.allSettled([
                fetchCreditStatus(locationId || undefined),
                fetchConversations(locationId || undefined).catch(() => []),
                fetchCreditTransactions('default', 50, locationId || undefined)
            ]);

            if (credStatus.status === 'fulfilled') {
                setCreditStatus(credStatus.value);
            }

            if (convs.status === 'fulfilled') {
                const fetchedConvs = convs.value as Conversation[];
                const sortedNew = [...fetchedConvs].sort((a, b) => {
                    const timeA = new Date(a.last_message_at || a.updated_at || 0).getTime();
                    const timeB = new Date(b.last_message_at || b.updated_at || 0).getTime();
                    return timeB - timeA;
                });
                setConversations(sortedNew);
            }

            if (txRes.status === 'fulfilled') {
                const txs = txRes.value as CreditTransaction[];
                const sortedTxs = (txs || []).sort((a, b) => {
                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
                    return timeB - timeA;
                });
                setTransactions(sortedTxs);
            }

            if (isInitial) setLoading(false);
        };

        loadHomeData(true);

        // Real-time polling: refresh dashboard data every 15 seconds
        const interval = setInterval(() => {
            loadHomeData(false);
        }, 15000);

        return () => clearInterval(interval);
    }, [locationId]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const toProperCase = (name: string): string => {
        return name.replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const handleAnimationComplete = () => {};

    const isPhoneLike = (s: string): boolean => /^[\d+\-() ]+$/.test(s);

    const getDisplayName = (conv: Conversation): string => {
        const phone =
            extractPhoneFromDirectConversationId(conv.id) ||
            extractBatchIdFromGroupConversationId(conv.id) ||
            conv.id.replace(/^conv_/, '').replace(/^group_/, '');
        const cleanPhone = phone.replace(/\D/g, "");
        
        // Always try contacts first for direct conversations
        if (conv.type !== 'bulk') {
            const contact = contacts.find((c: Contact) => {
                const cp = c.phone.replace(/\D/g, "");
                return c.phone === phone || cp === cleanPhone
                    || (cleanPhone.startsWith('0') && cp === '+63' + cleanPhone.slice(1))
                    || (cleanPhone.startsWith('09') && cp === cleanPhone.slice(1));
            });
            if (contact) return toProperCase(contact.name);
        }

        // Use conv.name only if it's a real name (not a phone number)
        if (conv.name && !isPhoneLike(conv.name)) return toProperCase(conv.name);

        if (conv.type === 'bulk') {
            // For bulk, try resolving member names
            if (conv.members && conv.members.length > 0) {
                const memberNames = conv.members.slice(0, 3).map(m => {
                    const cm = m.replace(/\D/g, "");
                    const c = contacts.find((ct: Contact) => {
                        const ctp = ct.phone.replace(/\D/g, "");
                        return ct.phone === m || ctp === cm;
                    });
                    return c ? toProperCase(c.name) : null;
                }).filter(Boolean);
                if (memberNames.length > 0) {
                    const extra = conv.members.length - memberNames.length;
                    return memberNames.join(', ') + (extra > 0 ? ` +${extra}` : '');
                }
            }
            return 'Bulk Message';
        }

        return phone;
    };

    const handleRecentClick = (conv: Conversation) => {
        if (conv.type === 'bulk') {
            const batchId = extractBatchIdFromGroupConversationId(conv.id) || conv.id.replace(/^group_/, '');
            onSelectBulkMessage({
                id: `bulk-db-${batchId}`,
                message: conv.last_message || '',
                recipientCount: conv.members.length,
                recipientNumbers: conv.members,
                recipientKey: batchId,
                timestamp: conv.last_message_at || conv.updated_at || new Date().toISOString(),
                status: 'sent',
                batchId,
                fromDatabase: true,
            });
        } else {
            const phone = extractPhoneFromDirectConversationId(conv.id) || conv.id.replace(/^conv_/, '');
            const displayName = getDisplayName(conv);
            onSelectContact({
                id: conv.id,
                name: displayName,
                phone: phone,
                lastMessage: conv.last_message
            });
        }
    };

    const subaccountName =
        liveProfile?.location_name && liveProfile.location_name !== "Unknown"
            ? liveProfile.location_name
            : "";
    const greetingText = subaccountName ? `${getGreeting()}, ${subaccountName}` : getGreeting();
    const sentToday = creditStatus?.stats?.sent_today ?? 0;
    const creditsUsedMonth = creditStatus?.stats?.credits_used_month ?? 0;
    const lastActivityAt = conversations[0]?.last_message_at || conversations[0]?.updated_at;
    const lastActivityLabel = lastActivityAt
        ? new Date(lastActivityAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : "No messages yet";
    const trendStartDate = new Date(trendAnchor);
    trendStartDate.setDate(trendAnchor.getDate() - 13);
    const trendStartKey = dayKey(trendStartDate);
    const recentActivitySeries = createDaySeries(trendAnchor, 14);
    const recentActivityIndex = new Map(recentActivitySeries.map((point, index) => [point.key, index]));
    conversations.forEach((conv) => {
        const date = toDate(conv.last_message_at || conv.updated_at);
        if (!date) return;
        const index = recentActivityIndex.get(dayKey(date));
        if (index !== undefined && dayKey(date) >= trendStartKey) {
            recentActivitySeries[index].value += 1;
        }
    });
    const creditUsageSeries = createDaySeries(trendAnchor, 14);
    const creditUsageIndex = new Map(creditUsageSeries.map((point, index) => [point.key, index]));
    transactions.forEach((tx) => {
        const log = tx as HomeCreditTransaction;
        const date = toDate(log.created_at);
        if (!date) return;
        const index = creditUsageIndex.get(dayKey(date));
        const isUsage = log.type !== 'top_up' && log.type !== 'refund' && log.type !== 'manual_adjustment' && log.type !== 'credit_purchase';
        if (index !== undefined && isUsage && dayKey(date) >= trendStartKey) {
            creditUsageSeries[index].value += Math.abs(log.amount || 0);
        }
    });
    const sentMetricSeries = buildFallbackSeries(recentActivitySeries, sentToday);
    const creditMetricSeries = buildFallbackSeries(creditUsageSeries, creditsUsedMonth);
    const latestMetricSeries = buildFallbackSeries(recentActivitySeries, lastActivityAt ? Math.max(1, conversations.length) : 0);
    const sentTrendTotal = getSeriesTotal(sentMetricSeries);
    const creditTrendTotal = getSeriesTotal(creditMetricSeries);
    const sentTrendLabel = `${sentTrendTotal.toLocaleString()} ${sentTrendTotal === 1 ? 'message' : 'messages'} in 14 days`;
    const creditTrendLabel = `${creditTrendTotal.toLocaleString()} ${creditTrendTotal === 1 ? 'credit' : 'credits'} tracked`;
    const renderMiniBars = (series: TrendPoint[], color: string, isLoading: boolean) => {
        const maxValue = Math.max(1, ...series.map((point) => point.value));

        if (isLoading) {
            return (
                <div className="h-12 flex items-end gap-1.5">
                    {[36, 58, 44, 72, 52, 84, 64].map((height, index) => (
                        <div
                            key={`bar-skeleton-${index}`}
                            className="flex-1 rounded-t-md bg-[#edf0f3] dark:bg-white/10 skeleton-gleam"
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div className="h-12 flex items-end gap-1.5">
                {series.map((point) => {
                    const height = point.value === 0 ? 14 : Math.max(20, Math.round((point.value / maxValue) * 100));
                    return (
                        <div
                            key={point.key}
                            className="flex-1 rounded-t-md transition-all duration-300"
                            title={`${point.label}: ${point.value.toLocaleString()}`}
                            style={{
                                height: `${height}%`,
                                backgroundColor: point.value === 0 ? "rgba(154,160,166,0.18)" : color,
                                opacity: point.value === 0 ? 1 : 0.9,
                            }}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#f9fafb] dark:bg-[#111111]">
            <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
                {/* Greeting Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center shadow-[0_8px_25px_rgba(43,131,250,0.28)] flex-shrink-0">
                            <FiHome className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <SplitText
                                text={greetingText}
                                className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight leading-tight max-w-[720px]"
                                delay={50}
                                duration={1.25}
                                ease="power3.out"
                                splitType="chars"
                                from={{ opacity: 0, y: 40 }}
                                to={{ opacity: 1, y: 0 }}
                                threshold={0.1}
                                rootMargin="-100px"
                                textAlign="left"
                                tag="h1"
                                onLetterAnimationComplete={handleAnimationComplete}
                            />
                            <FadeContent blur={false} duration={1500} ease="ease-out" initialOpacity={0}>
                                <p className="text-[#6e6e73] dark:text-[#a0a0ab] font-medium mt-1">
                                    {subaccountName ? "Your subaccount is ready for today's conversations." : "Welcome back to NOLA SMS PRO."}
                                </p>
                            </FadeContent>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-shrink-0">
                        <SenderSelector
                            value={senderName}
                            onChange={setSenderName}
                            align="right"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-7">
                    {[
                        {
                            label: 'Sent today',
                            value: sentToday.toLocaleString(),
                            icon: <FiMessageSquare className="h-5 w-5" />,
                            accent: '#2b83fa',
                            panel: 'bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-[#10223c] dark:via-[#1c1e21] dark:to-[#122d33] border-blue-200/70 dark:border-blue-400/20 shadow-blue-500/10',
                            soft: 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/20 text-[#2b83fa]',
                            series: sentMetricSeries,
                            note: sentTrendLabel,
                        },
                        {
                            label: 'Credits used this month',
                            value: creditsUsedMonth.toLocaleString(),
                            icon: <FiActivity className="h-5 w-5" />,
                            accent: '#f59e0b',
                            panel: 'bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-[#30220d] dark:via-[#1c1e21] dark:to-[#2a1b10] border-amber-200/70 dark:border-amber-400/20 shadow-amber-500/10',
                            soft: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-500',
                            series: creditMetricSeries,
                            note: creditTrendLabel,
                        },
                        {
                            label: 'Latest activity',
                            value: lastActivityLabel,
                            icon: <FiClock className="h-5 w-5" />,
                            accent: '#10b981',
                            panel: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#0f2c24] dark:via-[#1c1e21] dark:to-[#102b2f] border-emerald-200/70 dark:border-emerald-400/20 shadow-emerald-500/10',
                            soft: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500',
                            series: latestMetricSeries,
                            note: lastActivityAt ? 'Most recent conversation' : 'No active conversations',
                        },
                    ].map((item) => (
                        <AnimatedContent key={item.label} delay={0.08} distance={30} direction="vertical">
                            <div className={`min-h-[162px] rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-4 flex flex-col justify-between overflow-hidden ${item.panel}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#91a0b8]">{item.label}</p>
                                        {loading ? (
                                            <div className="mt-3 h-8 w-24 rounded-lg bg-[#edf0f3] dark:bg-white/10 skeleton-gleam" />
                                        ) : (
                                            <p className="mt-2 text-[26px] sm:text-3xl font-black text-[#111111] dark:text-white leading-tight tracking-tight truncate">
                                                {item.value}
                                            </p>
                                        )}
                                    </div>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.soft}`}>
                                        {item.icon}
                                    </div>
                                </div>

                                <div className="mt-5">
                                    {renderMiniBars(item.series, item.accent, loading)}
                                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-black text-[#64748b] dark:text-[#91a0b8]">
                                        <span className="truncate">{loading ? 'Loading trend' : item.note}</span>
                                        <FiTrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.accent }} />
                                    </div>
                                </div>
                            </div>
                        </AnimatedContent>
                    ))}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-8">
                    <AnimatedContent delay={0.1} distance={50} direction="vertical">
                        {(() => {
                            const balance      = creditStatus?.credit_balance ?? 0;
                            const trialUsed    = creditStatus?.free_usage_count ?? 0;
                            const trialTotal   = creditStatus?.free_credits_total ?? 0;
                            const isTrialActive = trialTotal > 0 && trialUsed < trialTotal;
                            const trialLeft    = trialTotal - trialUsed;
                            return (
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all group overflow-hidden relative h-full">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                        <FiCreditCard className="w-24 h-24 text-white" />
                                    </div>
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4">
                                                <FiCreditCard className="h-5 w-5" />
                                            </div>
                                            <p className="text-[13px] font-bold text-white/70 uppercase tracking-widest mb-1">
                                                Available Credits
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 mt-auto">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-3xl font-black text-white leading-none">
                                                    {loading ? <span className="inline-block w-12 h-8 bg-white/20 animate-pulse rounded-lg" /> : balance.toLocaleString()}
                                                </h2>
                                                {isTrialActive && !loading && (
                                                    <span className="text-[10px] font-bold bg-[#ffffff30] text-white px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                                                        {trialLeft} Free Trial
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'credits' } }));
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-all flex items-center gap-1.5 flex-shrink-0"
                                            >
                                                <FiPlus className="w-3 h-3" /> Top Up
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </AnimatedContent>

                    <AnimatedContent delay={0.2} distance={50} direction="vertical">
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all group overflow-hidden relative h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                <FiMessageSquare className="w-24 h-24 text-white" />
                            </div>
                            <div className="relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4">
                                    <FiMessageSquare className="h-5 w-5" />
                                </div>
                                <p className="text-[13px] font-bold text-white/70 uppercase tracking-widest mb-1">Total Conversations</p>
                                <h2 className="text-3xl font-black text-white leading-none mt-2">
                                    {loading ? <span className="inline-block w-10 h-8 bg-white/20 animate-pulse rounded-lg" /> : conversations.length}
                                </h2>
                            </div>
                        </div>
                    </AnimatedContent>

                    <AnimatedContent delay={0.3} distance={50} direction="vertical">
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all group overflow-hidden relative h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                <FiUsers className="w-24 h-24 text-white" />
                            </div>
                            <div className="relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4">
                                    <FiUsers className="h-5 w-5" />
                                </div>
                                <p className="text-[13px] font-bold text-white/70 uppercase tracking-widest mb-1">Total Contacts</p>
                                <h2 className="text-3xl font-black text-white leading-none mt-2">
                                    {loading ? <span className="inline-block w-10 h-8 bg-white/20 animate-pulse rounded-lg" /> : contactsCount}
                                </h2>
                            </div>
                        </div>
                    </AnimatedContent>
                </div>

                {/* Recent Transactions */}
                <AnimatedContent delay={0.35} distance={40} direction="vertical">
                    <div className="mb-8 bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-4 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                            <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <FiActivity className="w-4 h-4 text-amber-500" /> Recent Transactions
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={async () => {
                                        const currentMonth = new Date().toISOString().slice(0, 7);
                                        const allTxs = await fetchCreditTransactions('default', 5000, locationId || undefined);
                                        generateMonthlyReport(currentMonth, allTxs, 'subaccount', 'My Account');
                                    }}
                                    className="text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#111111] dark:hover:text-[#ffffff] py-1 px-3 border border-transparent rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
                                >
                                    <FiDownload className="w-3.5 h-3.5" /> Download Report
                                </button>
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'credits' } }))}
                                    className="text-[12px] font-bold text-[#2b83fa] hover:text-[#1a65d1] py-1 px-3 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    See All
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {loading ? (
                                [...Array(4)].map((_, idx) => (
                                    <div key={`tx-skel-${idx}`} className="h-[74px] rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent shadow-sm animate-pulse" />
                                ))
                            ) : transactions.length > 0 ? (
                                transactions.slice(0, 4).map((tx: HomeCreditTransaction, idx) => {
                                    const isCredit = tx.type === 'top_up' || tx.type === 'refund' || tx.type === 'manual_adjustment' || tx.type === 'credit_purchase';
                                    const isUsage = !isCredit;
                                    const timeString = tx.created_at ? new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    const dateString = tx.created_at ? new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

                                    return (
                                        <div key={`recent-tx-${idx}-${tx.transaction_id || tx.id || 'none'}`} className="group min-h-[74px] flex items-center gap-4 p-4 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${isUsage ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'}`}>
                                                {isUsage ? <FiActivity className="w-5 h-5" /> : <FiCreditCard className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1 gap-2">
                                                    <p className="text-[14px] font-bold text-[#111111] dark:text-white leading-tight truncate">
                                                        {tx.description || (isUsage ? 'Credits Used' : 'Credits Purchased')}
                                                    </p>
                                                    <span className="text-[11px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap flex-shrink-0">
                                                        {dateString}{timeString ? ` - ${timeString}` : ''}
                                                    </span>
                                                </div>
                                                <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] leading-snug truncate">
                                                    {isUsage && Math.abs(tx.amount || 0) === 0 ? (
                                                        <span className="font-bold text-amber-500">-1 free trial</span>
                                                    ) : isUsage ? (
                                                        <span className="font-bold text-amber-500">{Math.abs(tx.amount || 0).toLocaleString()} credits used</span>
                                                    ) : (
                                                        <>Added <span className="font-bold text-emerald-500">+{Math.abs(tx.amount || 0).toLocaleString()}</span> credits</>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="lg:col-span-2 p-8 text-center rounded-2xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                    <p className="text-gray-400 dark:text-gray-500 text-[14px] font-medium italic">No recent transactions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </AnimatedContent>

                <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6 lg:gap-8">
                    {/* Quick Actions Column */}
                    <div>
                        <AnimatedContent delay={0.4} distance={50} direction="vertical">
                            <h3 className="text-[15px] font-bold text-[#111111] dark:text-white mb-5 flex items-center gap-2 h-8">
                                Quick Actions
                            </h3>
                        </AnimatedContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                            <AnimatedContent delay={0.45} distance={30} direction="vertical">
                                <button
                                    onClick={() => onTabChange('compose')}
                                    className="w-full min-h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:shadow-indigo-500/10 hover:border-[#2b83fa]/30 transition-all duration-300 text-left flex items-center justify-between group hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#2b83fa] transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                                            <FiPlus className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Start New Chat</h4>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium truncate">Create a single or bulk message</p>
                                        </div>
                                    </div>
                                    <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#2b83fa] group-hover:translate-x-1 transition-all flex-shrink-0" />
                                </button>
                            </AnimatedContent>

                            <AnimatedContent delay={0.5} distance={30} direction="vertical">
                                <button
                                    onClick={() => onTabChange('contacts')}
                                    className="w-full min-h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 text-left flex items-center justify-between group hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                                            <FiUsers className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Manage Contacts</h4>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium truncate">Add, edit, or remove recipients</p>
                                        </div>
                                    </div>
                                    <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                                </button>
                            </AnimatedContent>

                            <AnimatedContent delay={0.55} distance={30} direction="vertical">
                                <button
                                    onClick={() => onTabChange('settings')}
                                    className="w-full min-h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:shadow-gray-500/10 hover:border-gray-500/30 transition-all duration-300 text-left flex items-center justify-between group hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                                            <FiSettings className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Account Settings</h4>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium truncate">Profile, API keys, and more</p>
                                        </div>
                                    </div>
                                    <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                                </button>
                            </AnimatedContent>

                            <AnimatedContent delay={0.6} distance={30} direction="vertical">
                                <button
                                    onClick={() => onTabChange('templates')}
                                    className="w-full min-h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:shadow-blue-500/10 hover:border-sky-500/30 transition-all duration-300 text-left flex items-center justify-between group hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500 transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                                            <FiMessageSquare className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Message Templates</h4>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium truncate">Reuse polished replies faster</p>
                                        </div>
                                    </div>
                                    <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                                </button>
                            </AnimatedContent>
                        </div>
                    </div>

                    {/* Recent Activity Column */}
                    <div>
                        <AnimatedContent delay={0.6} distance={50} direction="vertical">
                            <div className="flex items-center justify-between mb-5 h-8">
                                <h3 className="text-[15px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                    Recent Activity
                                </h3>
                                {conversations.length > 3 && (
                                    <button
                                        onClick={() => setShowAllActivity(true)}
                                        className="text-[12px] font-bold text-[#2b83fa] hover:text-[#1a65d1] py-1 px-3 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        See All
                                    </button>
                                )}
                            </div>
                        </AnimatedContent>
                        
                        <div className="flex flex-col gap-3">
                            {loading && conversations.length === 0 ? (
                                [1, 2, 3].map((i, idx) => (
                                    <AnimatedContent key={`skel-${i}`} delay={0.6 + idx * 0.05} distance={15} direction="vertical">
                                        <div className="w-full h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] flex items-center justify-between">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
                                                <div className="space-y-2 w-full max-w-[150px]">
                                                    <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
                                                    <div className="h-2 w-full bg-gray-50 dark:bg-gray-900 animate-pulse rounded opacity-60" />
                                                </div>
                                            </div>
                                            <div className="w-16 h-3 bg-gray-50 dark:bg-gray-900 animate-pulse rounded opacity-60" />
                                        </div>
                                    </AnimatedContent>
                                ))
                            ) : conversations.length > 0 ? (
                                conversations.slice(0, 3).map((conv, idx) => (
                                    <AnimatedContent key={conv.id} delay={0.6 + idx * 0.05} distance={15} direction="vertical">
                                        <button
                                            onClick={() => handleRecentClick(conv)}
                                            className="w-full min-h-[74px] p-4 rounded-2xl bg-white dark:bg-[#1c1e21] border border-[#0000000a] dark:border-[#ffffff0a] shadow-sm hover:border-[#2b83fa]/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-transform duration-300 group-hover:rotate-12 ${conv.type === 'bulk' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-[#2b83fa] to-[#60a5fa]'}`}>
                                                    {conv.type === 'bulk' ? <FiUsers size={18} /> : (() => { const dn = getDisplayName(conv); return dn ? dn.charAt(0).toUpperCase() : <FiUser size={18} />; })()}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px] truncate">
                                                        {getDisplayName(conv)}
                                                    </h4>
                                                    <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate max-w-[200px] font-medium">
                                                        {conv.last_message || "No messages yet"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                    <FiClock size={10} />
                                                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "--"}
                                                </div>
                                                <div className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa] text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View
                                                </div>
                                            </div>
                                        </button>
                                    </AnimatedContent>
                                ))
                            ) : (
                                <AnimatedContent delay={0.65} distance={15} direction="vertical">
                                    <div className="p-10 text-center rounded-3xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                        <p className="text-gray-400 dark:text-gray-500 text-[14px] font-medium italic">No recent activity found.</p>
                                    </div>
                                </AnimatedContent>
                            )}
                        </div>
                    </div>
                </div>

            {/* All Activity Popup */}
            {showAllActivity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-white dark:bg-[#1c1e21] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-[0.98] duration-200 border border-[#0000000a] dark:border-[#ffffff0a]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 border-b border-[#00000005] dark:border-[#ffffff05]">
                            <h3 className="text-[17px] font-bold text-[#111111] dark:text-white">All Recent Activity</h3>
                            <button
                                onClick={() => setShowAllActivity(false)}
                                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:scale-95"
                            >
                                <FiX size={20} />
                            </button>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                            {conversations.map(conv => (
                                <button
                                    key={`modal-${conv.id}`}
                                    onClick={() => {
                                        handleRecentClick(conv);
                                        setShowAllActivity(false);
                                    }}
                                    className="w-full p-3.5 rounded-2xl bg-transparent hover:bg-black-[0.02] dark:hover:bg-white/[0.02] transition-all text-left flex items-center justify-between group mb-1"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${conv.type === 'bulk' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-[#2b83fa] to-[#60a5fa]'}`}>
                                            {conv.type === 'bulk' ? <FiUsers size={18} /> : (() => { const dn = getDisplayName(conv); return dn ? dn.charAt(0).toUpperCase() : <FiUser size={18} />; })()}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px] truncate">
                                                {getDisplayName(conv)}
                                            </h4>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate max-w-[200px] font-medium">
                                                {conv.last_message || "No messages yet"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                            <FiClock size={10} />
                                            {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "--"}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};
