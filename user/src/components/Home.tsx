import { useState, useEffect } from "react";
import { FiHome, FiPlus, FiUsers, FiSettings, FiCreditCard, FiMessageSquare, FiArrowRight, FiClock, FiUser, FiX, FiActivity } from "react-icons/fi";
import type { Contact } from "../types/Contact";
import type { BulkMessageHistoryItem, Conversation } from "../types/Sms";
import { fetchConversations, type SenderId } from "../api/sms";
import { fetchContacts } from "../api/contacts";
import { fetchCreditStatus, fetchCreditTransactions, type CreditStatus, type CreditTransaction } from "../api/credits";
import SplitText from "./SplitText";
import AnimatedContent from "./AnimatedContent";
import FadeContent from "./FadeContent";
import { SenderSelector } from "./SenderSelector";
import { extractBatchIdFromGroupConversationId, extractPhoneFromDirectConversationId } from "../utils/conversationId";
import { useLocationId } from "../context/LocationContext";

interface HomeProps {
    onTabChange: (tab: any) => void;
    onSelectContact: (contact: Contact) => void;
    onSelectBulkMessage: (message: BulkMessageHistoryItem) => void;
}

export const Home: React.FC<HomeProps> = ({ onTabChange, onSelectContact, onSelectBulkMessage }) => {
    const { locationId } = useLocationId();
    const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsCount, setContactsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const [senderName, setSenderName] = useState<SenderId>("NOLASMSPro");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    useEffect(() => {
        // Reset pagination when switching locations
        setCurrentPage(1);
        
        const loadHomeData = async (isInitial = false) => {
            if (isInitial) setLoading(true);

            // Fetch contacts independently in background so it doesn't block the UI
            fetchContacts(locationId || undefined).then((data) => {
                setContacts(data);
                setContactsCount(data.length);
            }).catch(() => []);

            // Wait ONLY for critical UI elements (credits and history)
            // But fetch transactions independently so they appear right away
            fetchCreditTransactions('default', 50, locationId || undefined)
                .then(txs => {
                    const sortedTxs = (txs as CreditTransaction[]).sort((a, b) => {
                        const timeA = new Date(a.created_at || 0).getTime();
                        const timeB = new Date(b.created_at || 0).getTime();
                        return timeB - timeA;
                    });
                    setTransactions(sortedTxs);
                })
                .catch(() => setTransactions([]));

            const [credStatus, convs] = await Promise.allSettled([
                fetchCreditStatus(locationId || undefined),
                fetchConversations(locationId || undefined).catch(() => []),
            ]);

            if (credStatus.status === 'fulfilled') {
                setCreditStatus(credStatus.value);
            }

            if (convs.status === 'fulfilled') {
                const fetchedConvs = convs.value as Conversation[];
                setConversations(prev => {
                    // Sort the new conversations
                    const sortedNew = [...fetchedConvs].sort((a, b) => {
                        const timeA = new Date(a.last_message_at || a.updated_at || 0).getTime();
                        const timeB = new Date(b.last_message_at || b.updated_at || 0).getTime();
                        return timeB - timeA;
                    });

                    if (prev.length === 0) return sortedNew;
                    return sortedNew;
                });
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

    const handleAnimationComplete = () => {
        console.log('All letters have animated!');
    };

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

    return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#f9fafb] dark:bg-[#111111]">
            <div className="max-w-5xl mx-auto w-full px-6 py-8 sm:py-12">
                {/* Greeting Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center shadow-[0_8px_25px_rgba(43,131,250,0.4)]">
                            <FiHome className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <SplitText
                                text={getGreeting()}
                                className="text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight"
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
                                <p className="text-[#6e6e73] dark:text-[#a0a0ab] font-medium">Welcome back to NOLA SMS PRO</p>
                            </FadeContent>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <SenderSelector
                            value={senderName}
                            onChange={setSenderName}
                            align="right"
                        />
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <AnimatedContent delay={0.1} distance={50} direction="vertical">
                        {(() => {
                            const balance      = creditStatus?.credit_balance ?? 0;
                            const trialUsed    = creditStatus?.free_usage_count ?? 0;
                            const trialTotal   = creditStatus?.free_credits_total ?? 0;
                            const isTrialActive = trialTotal > 0 && trialUsed < trialTotal;
                            const trialLeft    = trialTotal - trialUsed;
                            return (
                                <div className="p-6 rounded-3xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all group overflow-hidden relative h-full">
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
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all group overflow-hidden relative h-full">
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
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all group overflow-hidden relative h-full">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Quick Actions Column */}
                    <div>
                        <AnimatedContent delay={0.4} distance={50} direction="vertical">
                            <h3 className="text-[15px] font-bold text-[#111111] dark:text-white mb-5 flex items-center gap-2 h-8">
                                Quick Actions
                            </h3>
                        </AnimatedContent>
                        <div className="flex flex-col gap-3">
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
                        </div>
                    </div>

                    {/* Recent Activity Column */}
                    <div>
                        <AnimatedContent delay={0.6} distance={50} direction="vertical">
                            <div className="flex items-center justify-between mb-5 h-8">
                                <h3 className="text-[15px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                    Recent Activity
                                </h3>
                                {conversations.length > 5 && (
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

                {/* Credit Transactions (Recent Transactions) */}
                <AnimatedContent delay={0.7} distance={50} direction="vertical">
                    <div className="mt-10 bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-5 h-8">
                            <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                                Recent Transactions
                            </h3>
                            {transactions.length > 0 && (
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'credits' } }))}
                                    className="group text-[11px] font-black text-[#2b83fa] hover:underline transition-all duration-300 flex items-center gap-1 active:scale-95 uppercase tracking-wider"
                                >
                                    See All <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {loading && transactions.length === 0 ? (
                                [...Array(3)].map((_, idx) => (
                                    <div key={`tx-skel-${idx}`} className="h-[74px] rounded-2xl bg-white dark:bg-[#1a1b1e] border border-[#0000000a] dark:border-white/5 shadow-sm animate-pulse" />
                                ))
                            ) : transactions.length > 0 ? (
                                (() => {
                                    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
                                    const currentTxs = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
                                    
                                    return (
                                        <>
                                            {currentTxs.map((log: any, idx) => {
                                                const isUsage = log.type === 'deduction';
                                                const timeString = log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                const dateString = log.created_at ? new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

                                                return (
                                                    <div key={log.transaction_id || log.id || `tx-${idx}`} className="group min-h-[74px] flex items-center gap-4 p-4 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${isUsage ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'}`}>
                                                            {isUsage ? <FiActivity className="w-5 h-5" /> : <FiCreditCard className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                            <div className="flex items-center justify-between mb-1 gap-2">
                                                                <p className="text-[14px] font-bold text-[#111111] dark:text-white leading-tight">
                                                                    {log.description || (isUsage ? 'Credits Used' : 'Credits Purchased')}
                                                                </p>
                                                                <span className="text-[11px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap flex-shrink-0">
                                                                    {dateString} • {timeString}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] leading-snug flex-1">
                                                                    {isUsage && Math.abs(log.amount || 0) === 0 ? (
                                                                        <span className="font-bold text-purple-500">-1 free trial</span>
                                                                    ) : (
                                                                        <>
                                                                            {isUsage ? 'Deducted' : 'Added'} <span className={`font-bold ${isUsage ? 'text-purple-500' : 'text-emerald-500'}`}>{!isUsage && '+'}{Math.abs(log.amount || 0).toLocaleString()}</span> credits
                                                                        </>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                                    <div className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] uppercase font-bold tracking-wider">
                                                        Showing <b className="text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b> – <b className="text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)}</b> of <b className="text-[#111111] dark:text-white">{transactions.length}</b>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded-lg text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiArrowRight className="w-4 h-4 rotate-180" /></button>
                                                        {Array.from({ length: Math.min(5, totalPages - Math.floor((currentPage - 1) / 5) * 5) }, (_, i) => Math.floor((currentPage - 1) / 5) * 5 + 1 + i).map(page => (
                                                            <button key={page} onClick={() => setCurrentPage(page)} className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-[#2b83fa] text-white shadow-sm' : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5'}`}>{page}</button>
                                                        ))}
                                                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded-lg text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiArrowRight className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <div className="p-10 text-center rounded-3xl border-2 border-dashed border-[#0000000a] dark:border-[#ffffff0a]">
                                    <p className="text-gray-400 dark:text-gray-500 text-[14px] font-medium italic">No recent transactions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </AnimatedContent>
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
    );
};
