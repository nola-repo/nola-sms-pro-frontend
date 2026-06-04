import React, { useEffect, useMemo, useState } from "react";
import {
    FiMessageSquare,
    FiRefreshCw,
    FiClock,
    FiUser,
    FiAlertCircle,
    FiSearch,
    FiX,
    FiPlus,
    FiChevronRight
} from "react-icons/fi";
import { fetchAccountProfile, getCachedAccountProfile, type AccountProfile } from "../api/account";
import { useLocationId } from "../context/LocationContext";
import { useUserProfileContext } from "../context/UserProfileContext";
import { safeStorage } from "../utils/safeStorage";
import { getAccountSettings } from "../utils/settingsStorage";
import { API_CONFIG } from "../config";

interface TicketItem {
    ticket_id: string;
    subject: string;
    description: string;
    status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    assigned_agent?: string;
    created_at: string;
    updated_at: string;
    location_id: string;
}

const DEFAULT_MOCK_TICKETS: TicketItem[] = [
    {
        ticket_id: "TKT-1001",
        subject: "Unable to receive reply SMS for auto-response campaigns",
        description: "For some reason, the auto-replies are not triggering when customers reply to our campaign. We checked the credits, and they are positive.",
        status: "open",
        priority: "high",
        assigned_agent: "System Admin",
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        location_id: ""
    },
    {
        ticket_id: "TKT-1002",
        subject: "Sender ID approval request status update",
        description: "We submitted the documents for 'NOLASMS' Sender ID, but haven't received an update for 3 days. Please check.",
        status: "in_progress",
        priority: "medium",
        assigned_agent: "Sarah Jenkins (Agent)",
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        location_id: ""
    },
    {
        ticket_id: "TKT-1003",
        subject: "Need custom integration support for CRM Webhooks",
        description: "We want to sync lead response statuses back to our dashboard via webhooks. Waiting for client to provide webhook endpoint specifications.",
        status: "waiting",
        priority: "low",
        assigned_agent: "David Miller (Dev)",
        created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        location_id: ""
    },
    {
        ticket_id: "TKT-1004",
        subject: "Bulk upload template validation error",
        description: "CSV parser was failing on phone number formatting with spaces. Fixed by cleaning input on upload.",
        status: "resolved",
        priority: "urgent",
        assigned_agent: "David Miller (Dev)",
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        location_id: ""
    },
    {
        ticket_id: "TKT-1005",
        subject: "Billing invoice request for May 2026",
        description: "Customer requested a PDF of their recent credit purchase. PDF generated and sent.",
        status: "closed",
        priority: "low",
        assigned_agent: "System Admin",
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        location_id: ""
    }
];

const formatPhoneForForm = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
    if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
    if (/^639\d{9}$/.test(digits)) return `+${digits}`;
    return value || '';
};

const asString = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (value === null || value === undefined) return "";
    return String(value).trim();
};

const readStoredProfile = (): Record<string, unknown> => {
    const keys = ["nola_auth_user", "nola_user"];
    for (const key of keys) {
        try {
            const parsed = JSON.parse(safeStorage.getItem(key) || "null");
            if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
        } catch {
            // Ignore invalid cache entries.
        }
    }
    return {};
};

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case "urgent":
            return "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-500/20";
        case "high":
            return "bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20";
        case "medium":
            return "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20";
        case "low":
        default:
            return "bg-gray-50 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border border-gray-200 dark:border-white/5";
    }
};

const getColumnColorClass = (status: string) => {
    switch (status) {
        case "open": return "bg-purple-500";
        case "in_progress": return "bg-blue-500";
        case "waiting": return "bg-amber-500";
        case "resolved": return "bg-emerald-500";
        case "closed": return "bg-gray-400";
        default: return "bg-gray-350";
    }
};

const getColumnLabel = (status: string) => {
    switch (status) {
        case "open": return "Open";
        case "in_progress": return "In Progress";
        case "waiting": return "Waiting";
        case "resolved": return "Resolved";
        case "closed": return "Closed";
        default: return status;
    }
};

const TicketCard: React.FC<{ ticket: TicketItem; onClick: () => void }> = ({ ticket, onClick }) => {
    const priorityColor = getPriorityColor(ticket.priority);
    const createdDate = new Date(ticket.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            className="p-4 mb-3 rounded-xl bg-white dark:bg-[#1a1b1e] border border-gray-200/60 dark:border-white/5 hover:border-gray-400 dark:hover:border-white/20 hover:shadow-md cursor-pointer transition-all duration-200 select-none group flex flex-col gap-2 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold text-[#2b83fa] tracking-wider uppercase">{ticket.ticket_id}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${priorityColor}`}>
                    {ticket.priority}
                </span>
            </div>
            <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug group-hover:text-[#2b83fa] transition-colors">
                {ticket.subject}
            </h4>
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {ticket.description}
            </p>
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2.5 mt-1 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                <span className="flex items-center gap-1">
                    <FiClock size={11} />
                    {createdDate}
                </span>
                <span className="flex items-center gap-1">
                    <FiUser size={11} />
                    {ticket.assigned_agent || "Unassigned"}
                </span>
            </div>
        </div>
    );
};

export const TicketsTab: React.FC = () => {
    const { locationId } = useLocationId();
    const liveProfile = useUserProfileContext();
    const resolvedLocationId = locationId || getAccountSettings().ghlLocationId || safeStorage.getItem('nola_location_id') || '';
    const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(() =>
        getCachedAccountProfile(resolvedLocationId, { includeAuth: false, allowExpired: true }) ||
        getCachedAccountProfile(resolvedLocationId, { includeAuth: true, allowExpired: true })
    );

    // Tickets pipeline state
    const [tickets, setTickets] = useState<TicketItem[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [ticketsError, setTicketsError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"submit" | "pipeline">("pipeline");
    const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Modal state for testing adding ticket
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTicketForm, setNewTicketForm] = useState({
        subject: "",
        description: "",
        priority: "low" as TicketItem['priority'],
        status: "open" as TicketItem['status']
    });

    const loadTickets = async () => {
        if (!resolvedLocationId) return;
        setLoadingTickets(true);
        setTicketsError(null);
        try {
            const res = await fetch(`${API_CONFIG.tickets || '/api/tickets'}?location_id=${encodeURIComponent(resolvedLocationId)}`);
            if (res.status === 404) {
                // Mock fallback if API not ready yet
                const stored = localStorage.getItem(`nola_mock_tickets_${resolvedLocationId}`);
                let initialTickets = DEFAULT_MOCK_TICKETS;
                if (stored) {
                    initialTickets = JSON.parse(stored);
                } else {
                    localStorage.setItem(`nola_mock_tickets_${resolvedLocationId}`, JSON.stringify(DEFAULT_MOCK_TICKETS));
                }
                setTickets(initialTickets);
                setLastUpdated(new Date().toLocaleTimeString());
                return;
            }
            if (!res.ok) {
                throw new Error("Failed to fetch tickets");
            }
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.data || []);
            setTickets(list);
            localStorage.setItem(`nola_mock_tickets_${resolvedLocationId}`, JSON.stringify(list));
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Error loading tickets:", err);
            // Fallback to mock data if fetch failed
            const stored = localStorage.getItem(`nola_mock_tickets_${resolvedLocationId}`);
            const initialTickets = stored ? JSON.parse(stored) : DEFAULT_MOCK_TICKETS;
            setTickets(initialTickets);
            setTicketsError("API offline — showing offline ticket cache");
            setLastUpdated(new Date().toLocaleTimeString());
        } finally {
            setLoadingTickets(false);
        }
    };

    useEffect(() => {
        if (!resolvedLocationId) return;

        let cancelled = false;
        const cached =
            getCachedAccountProfile(resolvedLocationId, { includeAuth: false, allowExpired: true }) ||
            getCachedAccountProfile(resolvedLocationId, { includeAuth: true, allowExpired: true });

        if (cached) setAccountProfile(cached);

        fetchAccountProfile(resolvedLocationId, {
            includeAuth: false,
            forceRefresh: true,
            allowStaleOnError: true,
        }).then((profile) => {
            if (!cancelled && profile) setAccountProfile(profile);
        });

        return () => {
            cancelled = true;
        };
    }, [resolvedLocationId]);

    useEffect(() => {
        loadTickets();
    }, [resolvedLocationId]);
    
    // DEVELOPER NOTE: Replace the base URL below with your actual GHL Funnel URL
    const BASE_URL = "https://api.nolacrm.io/widget/form/Nt1MWKmO93qOlvJWzZzk"; 

    // Generate the dynamic URL with pre-fill parameters
    const SUPPORT_FUNNEL_URL = useMemo(() => {
        try {
            const params = new URLSearchParams();
            const storedProfile = readStoredProfile();
            const userProfile: Record<string, unknown> = {
                ...storedProfile,
                ...(liveProfile || {}),
                ...(accountProfile || {}),
            };

            const fullName =
                asString(userProfile.full_name) ||
                asString(userProfile.name) ||
                [asString(userProfile.firstName), asString(userProfile.lastName)].filter(Boolean).join(' ').trim();
            const firstName = asString(userProfile.firstName) || fullName.split(' ')[0] || '';
            const lastName = asString(userProfile.lastName) || fullName.split(' ').slice(1).join(' ');
            const email = asString(userProfile.email) || asString(userProfile.email_address);
            const resolvedPhone = formatPhoneForForm(asString(userProfile.phone) || asString(userProfile.phone_number));
            const formLocationId =
                resolvedLocationId ||
                asString(userProfile.location_id) ||
                asString(userProfile.active_location_id);
            
            if (fullName) {
                params.set('name', fullName);
                params.set('full_name', fullName);
                params.set('contact_name', fullName);
            }
            if (firstName) params.set('first_name', firstName);
            if (lastName) params.set('last_name', lastName);
            if (email) {
                params.set('email', email);
                params.set('contact_email', email);
            }
            if (resolvedPhone) {
                params.set('phone', resolvedPhone);
                params.set('contact_phone', resolvedPhone);
            }
            if (formLocationId) {
                params.set('location_id', formLocationId);
                params.set('locationId', formLocationId);
                params.set('ghl_location_id', formLocationId);
                params.set('app_location_id', formLocationId);
                params.set('nola_sms_source_location_id', formLocationId);
            }

            const queryString = params.toString();
            return queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
        } catch (err) {
            console.error("Failed to generate support funnel URL:", err);
            return BASE_URL;
        }
    }, [accountProfile, liveProfile, resolvedLocationId]);

    const filteredTickets = useMemo(() => {
        let list = tickets;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(t => 
                t.ticket_id.toLowerCase().includes(query) ||
                t.subject.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                (t.assigned_agent || "").toLowerCase().includes(query)
            );
        }
        return list;
    }, [tickets, searchQuery]);

    const columns: Array<TicketItem['status']> = ["open", "in_progress", "waiting", "resolved", "closed"];

    const handleCreateTestTicket = () => {
        if (!newTicketForm.subject.trim() || !newTicketForm.description.trim()) return;
        const newTicket: TicketItem = {
            ticket_id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
            subject: newTicketForm.subject,
            description: newTicketForm.description,
            status: newTicketForm.status,
            priority: newTicketForm.priority,
            assigned_agent: "System Admin",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            location_id: resolvedLocationId
        };
        const nextList = [newTicket, ...tickets];
        setTickets(nextList);
        localStorage.setItem(`nola_mock_tickets_${resolvedLocationId}`, JSON.stringify(nextList));
        setIsCreateModalOpen(false);
        setNewTicketForm({
            subject: "",
            description: "",
            priority: "low",
            status: "open"
        });
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#f3f4f6] dark:bg-[#09090b]">
            {/* Page Header */}
            <div className="flex-shrink-0 bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] rounded-b-[40px] shadow-[0_18px_45px_rgba(29,107,212,0.24)]">
                <div className="max-w-7xl mx-auto px-3 md:px-6 pt-5 pb-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-md shadow-blue-950/10">
                                <FiMessageSquare className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-[22px] font-extrabold text-white tracking-tight">Support Tickets</h1>
                                <p className="text-[12px] text-white/75 mt-1">Submit and track your support requests</p>
                            </div>
                        </div>
                        <div className="flex gap-2 bg-black/15 p-1 rounded-2xl border border-white/10 self-start md:self-auto">
                            <button
                                onClick={() => setActiveTab("submit")}
                                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${activeTab === "submit" ? "bg-white text-[#1d6bd4] shadow-md" : "text-white/80 hover:text-white"}`}
                            >
                                Submit Ticket
                            </button>
                            <button
                                onClick={() => setActiveTab("pipeline")}
                                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${activeTab === "pipeline" ? "bg-white text-[#1d6bd4] shadow-md" : "text-white/80 hover:text-white"}`}
                            >
                                My Tickets
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === "submit" ? (
                <main className="flex-1 overflow-y-auto px-4 pb-4 pt-5 md:px-6 md:pb-6 md:pt-6 lg:px-8 lg:pb-8 lg:pt-6">
                    <div className="max-w-5xl mx-auto min-h-[1500px] flex flex-col">
                        <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] shadow-sm relative group">
                            <iframe
                                src={SUPPORT_FUNNEL_URL}
                                style={{ width: '100%', height: '1500px', border: 'none', borderRadius: '8px' }}
                                id="inline-Nt1MWKmO93qOlvJWzZzk" 
                                data-layout="{'id':'INLINE'}"
                                data-trigger-type="alwaysShow"
                                data-trigger-value=""
                                data-activation-type="alwaysActivated"
                                data-activation-value=""
                                data-deactivation-type="neverDeactivate"
                                data-deactivation-value=""
                                data-form-name="Ticket Form"
                                data-height="1500"
                                data-layout-iframe-id="inline-Nt1MWKmO93qOlvJWzZzk"
                                data-form-id="Nt1MWKmO93qOlvJWzZzk"
                                className="w-full h-[1500px]"
                                title="Ticket Form"
                                allow="camera; microphone; clipboard-read; clipboard-write; display-capture"
                            />
                        </div>
                    </div>
                </main>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-6 py-4">
                    <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden gap-4">
                        {/* Pipeline Toolbar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1a1b1e] p-4 rounded-2xl border border-gray-200/60 dark:border-white/5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-64">
                                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search tickets..."
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl text-[13px] font-medium text-gray-800 dark:text-gray-250 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 focus:border-[#2b83fa] transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={loadTickets}
                                        disabled={loadingTickets}
                                        className="p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-500 dark:text-gray-400 active:scale-95 transition-all"
                                        title="Refresh Tickets"
                                    >
                                        <FiRefreshCw className={`h-4 w-4 ${loadingTickets ? "animate-spin" : ""}`} />
                                    </button>
                                    {lastUpdated && (
                                        <span className="text-[11px] text-gray-450 dark:text-gray-500 font-medium">
                                            Last updated: {lastUpdated}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-2 bg-[#2b83fa] text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[#1d6bd4] active:scale-95 transition-all shadow-sm"
                                >
                                    <FiPlus className="h-4 w-4" />
                                    New Test Ticket
                                </button>
                            </div>
                        </div>

                        {ticketsError && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                                <FiAlertCircle className="h-4 w-4 flex-shrink-0 animate-pulse" />
                                {ticketsError}
                            </div>
                        )}

                        {/* Kanban Columns (Desktop / Tablet) */}
                        <div className="hidden md:flex flex-1 overflow-x-auto custom-scrollbar gap-4 pb-4 select-none">
                            {columns.map(status => {
                                const columnTickets = filteredTickets.filter(t => t.status === status);
                                return (
                                    <div
                                        key={status}
                                        className="flex flex-col bg-gray-50/50 dark:bg-[#151619]/40 rounded-2xl p-3.5 border border-gray-200/50 dark:border-white/5 min-w-[240px] flex-1 max-h-full"
                                    >
                                        <div className="flex items-center justify-between mb-3 px-1 border-b border-gray-150/40 dark:border-white/5 pb-2 flex-shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${getColumnColorClass(status)}`} />
                                                <h3 className="text-[12px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                    {getColumnLabel(status)}
                                                </h3>
                                            </div>
                                            <span className="bg-gray-200/60 dark:bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-black text-gray-500 dark:text-gray-400">
                                                {columnTickets.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
                                            {columnTickets.length === 0 ? (
                                                <div className="h-28 border border-dashed border-gray-200 dark:border-white/5 rounded-xl flex items-center justify-center text-center p-4">
                                                    <p className="text-[11.5px] font-medium text-gray-400">No tickets</p>
                                                </div>
                                            ) : (
                                                columnTickets.map(ticket => (
                                                    <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* List Layout (Mobile) */}
                        <div className="flex flex-col md:hidden flex-1 overflow-hidden">
                            {/* Filter Pills for Mobile */}
                            <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar flex-shrink-0">
                                <button
                                    onClick={() => setStatusFilter("all")}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${statusFilter === "all" ? "bg-[#2b83fa] text-white border-transparent" : "bg-white dark:bg-[#1a1b1e] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400"}`}
                                >
                                    All ({filteredTickets.length})
                                </button>
                                {columns.map(status => {
                                    const count = filteredTickets.filter(t => t.status === status).length;
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(status)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${statusFilter === status ? "bg-[#2b83fa] text-white border-transparent" : "bg-white dark:bg-[#1a1b1e] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400"}`}
                                        >
                                            {getColumnLabel(status)} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Mobile Scroll Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {(() => {
                                    const displayList = statusFilter === "all"
                                        ? filteredTickets
                                        : filteredTickets.filter(t => t.status === statusFilter);

                                    if (displayList.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <FiAlertCircle className="h-8 w-8 text-gray-300 dark:text-white/10 mb-2" />
                                                <p className="text-[13px] font-semibold text-gray-400">No tickets found</p>
                                            </div>
                                        );
                                    }

                                    return displayList.map(ticket => (
                                        <div
                                            key={ticket.ticket_id}
                                            onClick={() => setSelectedTicket(ticket)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setSelectedTicket(ticket);
                                                }
                                            }}
                                            className="flex items-center justify-between gap-3 p-4 mb-3 rounded-2xl bg-white dark:bg-[#1a1b1e] border border-gray-200/60 dark:border-white/5 hover:border-gray-400 dark:hover:border-white/20 active:scale-[0.99] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                                        >
                                            <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-[#2b83fa] tracking-wider uppercase">{ticket.ticket_id}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                                                        {ticket.priority}
                                                    </span>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${getColumnColorClass(ticket.status)}`} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                        {getColumnLabel(ticket.status)}
                                                    </span>
                                                </div>
                                                <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                    {ticket.subject}
                                                </h4>
                                                <p className="text-[11.5px] text-gray-500 dark:text-gray-450 truncate">
                                                    {ticket.description}
                                                </p>
                                            </div>
                                            <FiChevronRight className="text-gray-400 w-5 h-5 flex-shrink-0" />
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Details Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#1a1b1e] rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-150/40 dark:border-white/5 pb-4">
                            <div>
                                <span className="text-[10px] font-black tracking-widest text-[#2b83fa] uppercase">{selectedTicket.ticket_id}</span>
                                <h3 className="text-[18px] font-extrabold text-[#111111] dark:text-[#ececf1] tracking-tight">{selectedTicket.subject}</h3>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors">
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
                                <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#111111] p-4 rounded-2xl border border-gray-200/60 dark:border-white/5 whitespace-pre-wrap font-medium">
                                    {selectedTicket.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-2xl">
                                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</span>
                                    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                        <span className={`w-2 h-2 rounded-full ${getColumnColorClass(selectedTicket.status)}`} />
                                        {getColumnLabel(selectedTicket.status)}
                                    </span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-2xl">
                                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Priority</span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(selectedTicket.priority)}`}>
                                        {selectedTicket.priority}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1">Assigned Agent</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-[12px]">
                                            {selectedTicket.assigned_agent ? selectedTicket.assigned_agent.charAt(0) : "?"}
                                        </div>
                                        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-250">{selectedTicket.assigned_agent || "Unassigned"}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1">Submitted On</span>
                                    <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-250 flex items-center gap-1.5 mt-2">
                                        <FiClock className="text-gray-400" />
                                        {new Date(selectedTicket.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-3">Timeline</span>
                                <div className="relative border-l-2 border-gray-250 dark:border-white/10 ml-3 pl-4 space-y-4">
                                    <div className="relative">
                                        <span className="absolute -left-[23px] top-1 bg-emerald-500 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-[#1a1b1e]" />
                                        <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Ticket Created</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(selectedTicket.created_at).toLocaleString()}</div>
                                    </div>
                                    {selectedTicket.status !== 'open' && (
                                        <div className="relative">
                                            <span className="absolute -left-[23px] top-1 bg-blue-500 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-[#1a1b1e]" />
                                            <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Agent Assigned ({selectedTicket.assigned_agent || 'Staff'})</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{new Date(selectedTicket.updated_at).toLocaleString()}</div>
                                        </div>
                                    )}
                                    {selectedTicket.status === 'resolved' && (
                                        <div className="relative">
                                            <span className="absolute -left-[23px] top-1 bg-emerald-500 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-[#1a1b1e]" />
                                            <div className="text-[12px] font-semibold text-[#10b981]">Ticket Resolved</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{new Date(selectedTicket.updated_at).toLocaleString()}</div>
                                        </div>
                                    )}
                                    {selectedTicket.status === 'closed' && (
                                        <div className="relative">
                                            <span className="absolute -left-[23px] top-1 bg-gray-500 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-[#1a1b1e]" />
                                            <div className="text-[12px] font-semibold text-gray-500">Ticket Closed</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{new Date(selectedTicket.updated_at).toLocaleString()}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-150/40 dark:border-white/5">
                            <button onClick={() => setSelectedTicket(null)} className="w-full px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-[13.5px] font-bold text-gray-700 dark:text-gray-200 transition-colors">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Test Ticket Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#1a1b1e] rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[18px] font-extrabold text-[#111111] dark:text-[#ececf1] tracking-tight">Create Test Ticket</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors">
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1.5">Subject</label>
                                <input
                                    type="text"
                                    value={newTicketForm.subject}
                                    onChange={e => setNewTicketForm(p => ({ ...p, subject: e.target.value }))}
                                    placeholder="e.g. Issue with SMS credits sync"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] font-medium text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 focus:border-[#2b83fa] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
                                <textarea
                                    value={newTicketForm.description}
                                    onChange={e => setNewTicketForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Type ticket details here..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] leading-relaxed text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 focus:border-[#2b83fa] transition-all resize-none custom-scrollbar"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1.5">Priority</label>
                                    <select
                                        value={newTicketForm.priority}
                                        onChange={e => setNewTicketForm(p => ({ ...p, priority: e.target.value as TicketItem['priority'] }))}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] font-medium text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 focus:border-[#2b83fa] transition-all"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                                    <select
                                        value={newTicketForm.status}
                                        onChange={e => setNewTicketForm(p => ({ ...p, status: e.target.value as TicketItem['status'] }))}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] font-medium text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 focus:border-[#2b83fa] transition-all"
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="waiting">Waiting</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-150/40 dark:border-white/5">
                            <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-4 py-3 text-[13.5px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleCreateTestTicket}
                                disabled={!newTicketForm.subject.trim() || !newTicketForm.description.trim()}
                                className="flex-1 px-4 py-3 bg-[#2b83fa] hover:bg-[#1d6bd4] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 rounded-xl font-bold text-[13.5px] text-white transition-all duration-200 shadow-md shadow-blue-500/10"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
