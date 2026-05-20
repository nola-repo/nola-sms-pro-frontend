import { useState, useEffect } from "react";
import { FiHome, FiPlus, FiUsers, FiSettings, FiCreditCard, FiMessageSquare, FiArrowRight, FiClock, FiUser, FiX, FiActivity, FiDownload, FiTrendingUp, FiSearch, FiBell } from "react-icons/fi";
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

        return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#f0f2f5] dark:bg-[#0a0a0a]">
            {/* Unified Top Section with Blue Gradient Background */}
            <div className="relative bg-gradient-to-r from-[#1d6bd4] to-[#2b83fa] pt-5 pb-32 sm:pb-40 px-4 sm:px-6 lg:px-8 shadow-inner overflow-hidden flex-shrink-0">
                {/* Navbar (Search + Profile) */}
                <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 mb-8">
                    {/* Brand / Greeting / Search */}
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="relative w-full max-w-md hidden sm:block">
                            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 h-4 w-4" />
                            <input 
                                type="text" 
                                placeholder="Search contacts, messages..." 
                                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 text-white placeholder-white/70 rounded-full py-2 pl-10 pr-4 outline-none transition-all text-[13px] backdrop-blur-sm"
                            />
                        </div>
                    </div>
                    {/* Right actions: Notification, Settings, Profile */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <button className="p-2 rounded-full hover:bg-white/10 text-white transition-all">
                            <FiBell className="h-5 w-5" />
                        </button>
                        <button className="p-2 rounded-full hover:bg-white/10 text-white transition-all" onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'account' } }))}>
                            <FiSettings className="h-5 w-5" />
                        </button>
                        <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden ml-1">
                            {liveProfile?.avatar ? (
                                <img src={liveProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <FiUser className="h-5 w-5 text-white" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Greeting */}
                <div className="max-w-[1400px] mx-auto mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="text-white">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight drop-shadow-sm">
                            {greetingText}
                        </h1>
                        <p className="text-white/80 font-medium mt-1 text-[14px]">
                            {subaccountName ? "Your subaccount is ready for today's conversations." : "Welcome back to NOLA SMS PRO."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 px-1 py-1">
                         <SenderSelector
                            value={senderName}
                            onChange={setSenderName}
                            align="right"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area (Overlapping the gradient) */}
            <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-10 pb-12 flex flex-col gap-6">
                
                {/* 3 Main Cards (Top Row) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Card 1: Available Credits */}
                    <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#dcfce7] to-[#86efac] dark:from-[#065f46] dark:to-[#047857] shadow-xl relative overflow-hidden h-full flex flex-col justify-between border border-white/40 dark:border-white/10 hover:-translate-y-1 transition-transform duration-300 group">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.15] group-hover:scale-110 transition-transform duration-500">
                            <FiCreditCard className="w-32 h-32 text-[#065f46] dark:text-[#a7f3d0] transform translate-x-4 -translate-y-4" />
                        </div>
                        {/* Abstract circles */}
                        <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/40 dark:bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#4ade80]/20 dark:bg-black/20 rounded-full blur-xl" />
                        
                        <div className="relative z-10">
                            <div className="w-12 h-8 rounded-lg bg-black/80 flex items-center gap-1.5 px-2.5 mb-8 shadow-sm">
                                 <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                 <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                            </div>
                            <p className="text-[11px] font-black text-[#065f46]/60 dark:text-[#a7f3d0]/60 uppercase tracking-widest mb-1">
                                Available Credits
                            </p>
                            <h2 className="text-3xl font-black text-[#064e3b] dark:text-white leading-none">
                                { (() => {
                                    const balance = creditStatus?.credit_balance ?? 0;
                                    const trialUsed = creditStatus?.free_usage_count ?? 0;
                                    const trialTotal = creditStatus?.free_credits_total ?? 0;
                                    const trialLeft = trialTotal - trialUsed;
                                    return loading ? <span className="inline-block w-20 h-8 bg-[#064e3b]/10 dark:bg-white/10 animate-pulse rounded-lg" /> : (
                                        <>
                                            {balance.toLocaleString()}
                                            {trialTotal > 0 && trialUsed < trialTotal && (
                                                <span className="ml-3 text-[12px] align-middle font-bold bg-[#064e3b] text-white px-2.5 py-0.5 rounded-full shadow-sm">
                                                    {trialLeft} Trial
                                                </span>
                                            )}
                                        </>
                                    )
                                })()}
                            </h2>
                        </div>
                        
                        <div className="relative z-10 mt-8 flex items-end justify-between">
                             <div>
                                 <p className="text-[9px] font-black text-[#065f46]/60 dark:text-[#a7f3d0]/60 uppercase tracking-widest mb-0.5">Card Holder</p>
                                 <p className="text-[13px] font-bold text-[#064e3b] dark:text-white truncate max-w-[140px]">{subaccountName || 'NOLA User'}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-[9px] font-black text-[#065f46]/60 dark:text-[#a7f3d0]/60 uppercase tracking-widest mb-0.5">Status</p>
                                 <p className="text-[13px] font-bold text-[#064e3b] dark:text-white">Active</p>
                             </div>
                        </div>
                    </div>

                    {/* Card 2: Total Conversations */}
                    <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#ff8a65] to-[#f4511e] dark:from-[#c2410c] dark:to-[#9a3412] shadow-xl relative overflow-hidden h-full flex flex-col justify-between text-white border border-white/20 hover:-translate-y-1 transition-transform duration-300 group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <FiMessageSquare className="w-32 h-32 text-white transform translate-x-4 -translate-y-4" />
                        </div>
                        <div className="relative z-10 flex justify-between items-start mb-8">
                            <div>
                                <p className="text-[14px] font-bold text-white/90">Total Conversations</p>
                                <p className="text-[11px] font-medium text-white/70 mt-1">Active discussions across all contacts</p>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shadow-sm backdrop-blur-md">
                                <FiMessageSquare className="w-3.5 h-3.5 text-white" />
                            </div>
                        </div>
                        
                        <div className="relative z-10 mt-auto flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
                                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                                    <FiMessageSquare className="w-4 h-4 text-[#f4511e] dark:text-[#9a3412]" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-4xl font-black leading-none mb-1">
                                    {loading ? <span className="inline-block w-16 h-10 bg-white/20 animate-pulse rounded-lg" /> : conversations.length}
                                </h2>
                                <p className="text-[12px] font-bold text-white/80 tracking-wide uppercase">Conversations</p>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Total Contacts */}
                    <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#00d2ff] to-[#3a7bd5] dark:from-[#0284c7] dark:to-[#0369a1] shadow-xl relative overflow-hidden h-full flex flex-col justify-between text-white border border-white/20 hover:-translate-y-1 transition-transform duration-300 group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <FiUsers className="w-32 h-32 text-white transform translate-x-4 -translate-y-4" />
                        </div>
                        <div className="relative z-10 flex justify-between items-start mb-8">
                            <div>
                                <p className="text-[14px] font-bold text-white/90">Total Contacts</p>
                                <p className="text-[11px] font-medium text-white/70 mt-1">Managed in your address book</p>
                            </div>
                            <span className="text-[9px] font-black bg-white/20 px-2 py-1 rounded-full uppercase tracking-widest shadow-sm backdrop-blur-md border border-white/10">Address Book</span>
                        </div>
                        
                        <div className="relative z-10 mt-auto flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1 text-[13px] font-bold text-white/90 uppercase tracking-widest">
                                    Contacts
                                </div>
                                <h2 className="text-4xl font-black leading-none">
                                    {loading ? <span className="inline-block w-16 h-10 bg-white/20 animate-pulse rounded-lg" /> : contactsCount}
                                </h2>
                            </div>
                            <button onClick={() => onTabChange('contacts')} className="flex items-center text-[12px] font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-xl backdrop-blur-sm border border-white/10">
                                ALL <FiArrowRight className="ml-2 w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grouped Stats Card (Second Row) */}
                <div className="bg-white dark:bg-[#1c1e21] rounded-[24px] shadow-sm hover:shadow-md transition-shadow border border-[#00000008] dark:border-[#ffffff0a] p-6 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/5">
                        
                        {/* Sent Today */}
                        <div className="flex flex-col md:pr-6 pt-4 md:pt-0 first:pt-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[11px] font-black text-[#64748b] dark:text-[#91a0b8] uppercase tracking-widest mb-1">Sent Today</p>
                                    <div className="flex items-end gap-2">
                                        <h3 className="text-2xl font-black text-[#111111] dark:text-white leading-none">
                                            {loading ? <span className="inline-block w-16 h-7 bg-gray-100 dark:bg-white/10 animate-pulse rounded" /> : sentToday.toLocaleString()}
                                        </h3>
                                        {!loading && <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><FiTrendingUp size={10}/></span>}
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">{loading ? 'Loading trend' : sentTrendLabel}</p>
                                </div>
                            </div>
                            <div className="mt-auto pt-2">
                                {renderMiniBars(sentMetricSeries, '#ff8a65', loading)}
                            </div>
                        </div>

                        {/* Credits Used */}
                        <div className="flex flex-col md:px-6 pt-6 md:pt-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[11px] font-black text-[#64748b] dark:text-[#91a0b8] uppercase tracking-widest mb-1">Credits Used Month</p>
                                    <div className="flex items-end gap-2">
                                        <h3 className="text-2xl font-black text-[#111111] dark:text-white leading-none">
                                            {loading ? <span className="inline-block w-16 h-7 bg-gray-100 dark:bg-white/10 animate-pulse rounded" /> : creditsUsedMonth.toLocaleString()}
                                        </h3>
                                        {!loading && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><FiTrendingUp size={10}/></span>}
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">{loading ? 'Loading trend' : creditTrendLabel}</p>
                                </div>
                            </div>
                            <div className="mt-auto pt-2">
                                {renderMiniBars(creditMetricSeries, '#4f46e5', loading)}
                            </div>
                        </div>

                        {/* Latest Activity */}
                        <div className="flex flex-col md:pl-6 pt-6 md:pt-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[11px] font-black text-[#64748b] dark:text-[#91a0b8] uppercase tracking-widest mb-1">Latest Activity</p>
                                    <div className="flex items-end gap-2">
                                        <h3 className="text-[20px] font-black text-[#111111] dark:text-white leading-tight truncate max-w-[180px]">
                                            {loading ? <span className="inline-block w-24 h-7 bg-gray-100 dark:bg-white/10 animate-pulse rounded" /> : lastActivityLabel}
                                        </h3>
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">{loading ? 'Loading trend' : (lastActivityAt ? 'Most recent conversation' : 'No active conversations')}</p>
                                </div>
                            </div>
                            <div className="mt-auto pt-2">
                                {renderMiniBars(latestMetricSeries, '#06b6d4', loading)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions & Recent Activity (Grid) */}
                <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 mt-4">
                    {/* Quick Actions Column */}
                    <div className="bg-white dark:bg-[#1c1e21] rounded-[24px] shadow-sm border border-[#00000008] dark:border-[#ffffff0a] p-6">
                        <h3 className="text-[14px] font-black text-[#111111] dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                            Quick Actions
                        </h3>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => onTabChange('compose')} className="w-full p-4 rounded-2xl bg-[#f7f8fc] dark:bg-[#161719] border border-transparent hover:border-blue-500/30 hover:shadow-sm transition-all duration-300 text-left flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                        <FiPlus className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Start New Chat</h4>
                                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium">Create a single or bulk message</p>
                                    </div>
                                </div>
                                <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </button>

                            <button onClick={() => onTabChange('contacts')} className="w-full p-4 rounded-2xl bg-[#f7f8fc] dark:bg-[#161719] border border-transparent hover:border-emerald-500/30 hover:shadow-sm transition-all duration-300 text-left flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                        <FiUsers className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Manage Contacts</h4>
                                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium">Add, edit, or remove recipients</p>
                                    </div>
                                </div>
                                <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                            </button>

                            <button onClick={() => onTabChange('templates')} className="w-full p-4 rounded-2xl bg-[#f7f8fc] dark:bg-[#161719] border border-transparent hover:border-sky-500/30 hover:shadow-sm transition-all duration-300 text-left flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
                                        <FiMessageSquare className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#111111] dark:text-white text-[13.5px]">Message Templates</h4>
                                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium">Reuse polished replies faster</p>
                                    </div>
                                </div>
                                <FiArrowRight className="h-4 w-4 text-gray-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity Column */}
                    <div className="bg-white dark:bg-[#1c1e21] rounded-[24px] shadow-sm border border-[#00000008] dark:border-[#ffffff0a] p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[14px] font-black text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                                Recent Activity
                            </h3>
                            {conversations.length > 3 && (
                                <button onClick={() => setShowAllActivity(true)} className="text-[11px] font-bold text-gray-500 hover:text-blue-500 uppercase tracking-widest transition-colors">
                                    View All
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-2 flex-1">
                            {loading && conversations.length === 0 ? (
                                [1, 2, 3].map((i) => (
                                    <div key={i} className="w-full p-3.5 rounded-2xl flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
                                        <div className="space-y-2 w-full">
                                            <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
                                            <div className="h-2 w-3/4 bg-gray-50 dark:bg-gray-900 animate-pulse rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : conversations.length > 0 ? (
                                conversations.slice(0, 3).map((conv) => (
                                    <button key={conv.id} onClick={() => handleRecentClick(conv)} className="w-full p-3.5 rounded-2xl bg-transparent hover:bg-[#f7f8fc] dark:hover:bg-[#161719] transition-all duration-300 text-left flex items-center justify-between group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-transform duration-300 group-hover:scale-110 ${conv.type === 'bulk' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-[#1d6bd4] to-[#2b83fa]'}`}>
                                                {conv.type === 'bulk' ? <FiUsers size={16} /> : (() => { const dn = getDisplayName(conv); return dn ? dn.charAt(0).toUpperCase() : <FiUser size={16} />; })()}
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
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter flex-shrink-0">
                                            {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "--"}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a] my-auto">
                                    <p className="text-gray-400 text-[13px] font-medium italic">No recent activity found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white dark:bg-[#1c1e21] rounded-[24px] shadow-sm border border-[#00000008] dark:border-[#ffffff0a] p-6 mt-2">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[14px] font-black text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                            Recent Transactions
                        </h3>
                        <div className="flex items-center gap-3">
                            <button onClick={async () => {
                                const currentMonth = new Date().toISOString().slice(0, 7);
                                const allTxs = await fetchCreditTransactions('default', 5000, locationId || undefined);
                                generateMonthlyReport(currentMonth, allTxs, 'subaccount', 'My Account');
                            }} className="text-[11px] font-bold text-gray-500 hover:text-[#111111] dark:hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest">
                                <FiDownload className="w-3.5 h-3.5" /> Download
                            </button>
                            <button onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'credits' } }))} className="text-[11px] font-bold text-gray-500 hover:text-blue-500 uppercase tracking-widest transition-colors">
                                View All
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        {loading ? (
                            [...Array(4)].map((_, idx) => (
                                <div key={idx} className="h-[64px] rounded-xl bg-gray-50 dark:bg-white/5 animate-pulse mb-2" />
                            ))
                        ) : transactions.length > 0 ? (
                            transactions.slice(0, 4).map((tx, idx) => {
                                const isCredit = tx.type === 'top_up' || tx.type === 'refund' || tx.type === 'manual_adjustment' || tx.type === 'credit_purchase';
                                const isUsage = !isCredit;
                                const dateString = tx.created_at ? new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                                
                                return (
                                    <div key={idx} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-[#f7f8fc] dark:hover:bg-[#161719] transition-all duration-300">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isUsage ? 'bg-[#f8f9fa] dark:bg-[#1a1b1e] text-amber-500' : 'bg-[#f8f9fa] dark:bg-[#1a1b1e] text-blue-500'}`}>
                                            {isUsage ? <FiActivity className="w-4 h-4" /> : <FiCreditCard className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13.5px] font-bold text-[#111111] dark:text-white truncate">
                                                {tx.description || (isUsage ? 'Credits Used' : 'Credits Purchased')}
                                            </p>
                                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 font-medium">
                                                {isUsage ? 'Usage' : 'Top up'} • {dateString}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <p className={`text-[14px] font-black ${isUsage ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-500'}`}>
                                                {isUsage ? '-' : '+'}{Math.abs(tx.amount || 0).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Credits</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center rounded-2xl border border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                <p className="text-gray-400 text-[13px] font-medium italic">No recent transactions found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* All Activity Popup */}
            {showAllActivity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1c1e21] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-[0.98] duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[#00000005] dark:border-[#ffffff05]">
                            <h3 className="text-[17px] font-bold text-[#111111] dark:text-white">All Recent Activity</h3>
                            <button onClick={() => setShowAllActivity(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:scale-95">
                                <FiX size={20} />
                            </button>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                            {conversations.map(conv => (
                                <button key={conv.id} onClick={() => { handleRecentClick(conv); setShowAllActivity(false); }} className="w-full p-3.5 rounded-2xl bg-transparent hover:bg-black-[0.02] dark:hover:bg-white/[0.02] transition-all text-left flex items-center justify-between group mb-1">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${conv.type === 'bulk' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-[#1d6bd4] to-[#2b83fa]'}`}>
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
                                            {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "--"}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

};
