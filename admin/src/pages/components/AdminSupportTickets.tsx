// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { FiMessageSquare, FiClock, FiCheck, FiX, FiRefreshCw, FiChevronLeft, FiChevronRight, FiSearch, FiAlertCircle, FiUser, FiCalendar } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/ui/ToastContainer';

const ADMIN_API = '/api/admin_support_tickets.php';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        open: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
        pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800/30',
        resolved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800/30',
        closed: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles[status] || styles.open}`}>
            {status}
        </span>
    );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const styles: Record<string, string> = {
        low: 'text-gray-500',
        normal: 'text-blue-500',
        high: 'text-orange-500',
        urgent: 'text-red-500 font-bold',
    };
    return (
        <span className={`text-[10px] uppercase tracking-tighter ${styles[priority] || styles.normal}`}>
            {priority}
        </span>
    );
};

export const AdminSupportTickets: React.FC = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const { toasts, showToast } = useToast();

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const fetchTickets = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const res = await fetch(ADMIN_API);
            const json = await res.json();
            if (json.status === 'success') {
                setTickets(json.data || []);
            } else {
                showToast(json.message || 'Failed to load tickets.', 'error');
            }
        } catch {
            showToast('Network error. Could not reach the backend.', 'error');
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchTickets(true);
    }, [fetchTickets]);

    const handleAction = async (ticketId, action, status = null) => {
        setActionLoading(ticketId + action);
        try {
            const payload = { ticket_id: ticketId };
            if (status) payload.status = status;
            if (action === 'note') payload.admin_note = adminNote;

            const res = await fetch(ADMIN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.status === 'success') {
                showToast('Ticket updated.', 'success');
                setAdminNote('');
                fetchTickets();
            } else {
                showToast(json.message || 'Update failed.', 'error');
            }
        } catch {
            showToast('Network error.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTickets = tickets.filter(t => 
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.location_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
    const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <ToastContainer toasts={toasts} />

            {/* Header / Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1a1b1e] p-4 rounded-2xl border border-[#e5e5e5] dark:border-white/5 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search tickets by subject, account or ID..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchTickets(true)}
                        className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-[#e5e5e5] dark:border-white/5 text-gray-500 hover:bg-gray-50 transition-all"
                        title="Refresh"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="h-8 w-[1px] bg-gray-200 dark:bg-white/10 mx-1 hidden md:block" />
                    <div className="text-[12px] font-bold text-gray-400 px-2 uppercase tracking-widest leading-none">
                        {filteredTickets.length} Total
                    </div>
                </div>
            </div>

            {/* Tickets List */}
            <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl border border-[#e5e5e5] dark:border-white/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#f0f0f0] dark:border-white/5 bg-[#fcfcfc] dark:bg-white/[0.02]">
                                <th className="px-6 py-4 text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-wider">Ticket / Account</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-wider text-center">Priority</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-wider text-right">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0] dark:divide-white/5">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-8"><div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-3/4"></div></td>
                                    </tr>
                                ))
                            ) : paginatedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        <FiMessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-[13px] font-medium">No tickets found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedTickets.map((ticket) => (
                                    <React.Fragment key={ticket.id}>
                                        <tr 
                                            className={`group hover:bg-[#fcfcfc] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${expandedId === ticket.id ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                                            onClick={() => {
                                                setExpandedId(expandedId === ticket.id ? null : ticket.id);
                                                setAdminNote(ticket.admin_note || '');
                                            }}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ticket.status === 'open' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
                                                        <FiMessageSquare className="w-4.5 h-4.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[14px] font-bold text-[#111111] dark:text-white truncate">{ticket.subject}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <FiUser className="w-3 h-3 text-[#9aa0a6]" />
                                                            <span className="text-[11px] font-semibold text-[#6e6e73] dark:text-[#94959b] truncate max-w-[180px]">{ticket.location_name}</span>
                                                            <span className="text-[10px] text-[#9aa0a6] dark:text-[#5f6368] font-mono">({ticket.location_id})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <StatusBadge status={ticket.status} />
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <PriorityBadge priority={ticket.priority} />
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <div className="text-[12px] font-bold text-[#111111] dark:text-[#ececf1]">{new Date(ticket.created_at).toLocaleDateString()}</div>
                                                    <div className="text-[10px] text-[#9aa0a6] mt-0.5">{new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === ticket.id && (
                                            <tr className="bg-[#fcfcfc] dark:bg-white/[0.01] border-b border-[#f0f0f0] dark:border-white/5">
                                                <td colSpan={4} className="px-6 py-6 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="bg-white dark:bg-[#111111] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                            <div>
                                                                <h4 className="text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <FiMessageSquare className="w-3.5 h-3.5" /> User Message
                                                                </h4>
                                                                <div className="p-4 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13.5px] leading-relaxed text-[#37352f] dark:text-[#ececf1] whitespace-pre-wrap">
                                                                    {ticket.message}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-5">
                                                                <div>
                                                                    <h4 className="text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                        <FiCheck className="w-3.5 h-3.5" /> Admin Actions
                                                                    </h4>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <button 
                                                                            onClick={() => handleAction(ticket.id, 'resolve', 'resolved')}
                                                                            disabled={actionLoading === (ticket.id + 'resolve')}
                                                                            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-[12px] font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2"
                                                                        >
                                                                            {actionLoading === (ticket.id + 'resolve') ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                                                                            Mark Resolved
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleAction(ticket.id, 'reopen', 'open')}
                                                                            disabled={actionLoading === (ticket.id + 'reopen')}
                                                                            className="px-4 py-2 rounded-xl bg-blue-500 text-white text-[12px] font-bold shadow-md shadow-blue-500/20 hover:bg-blue-600 transition-all flex items-center gap-2"
                                                                        >
                                                                            {actionLoading === (ticket.id + 'reopen') ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiClock className="w-3.5 h-3.5" />}
                                                                            Reopen
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleAction(ticket.id, 'close', 'closed')}
                                                                            disabled={actionLoading === (ticket.id + 'close')}
                                                                            className="px-4 py-2 rounded-xl bg-gray-500 text-white text-[12px] font-bold shadow-md shadow-gray-500/20 hover:bg-gray-600 transition-all flex items-center gap-2"
                                                                        >
                                                                            {actionLoading === (ticket.id + 'close') ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiX className="w-3.5 h-3.5" />}
                                                                            Close
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                        <FiAlertCircle className="w-3.5 h-3.5" /> Internal Response / Note
                                                                    </h4>
                                                                    <textarea 
                                                                        className="w-full p-3 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/50 transition-all font-medium min-h-[80px]"
                                                                        placeholder="Add a note or response for the user..."
                                                                        value={adminNote}
                                                                        onChange={(e) => setAdminNote(e.target.value)}
                                                                    />
                                                                    <button 
                                                                        onClick={() => handleAction(ticket.id, 'note')}
                                                                        disabled={actionLoading === (ticket.id + 'note') || !adminNote.trim()}
                                                                        className="mt-2 text-[12px] font-bold text-[#2b83fa] hover:underline flex items-center gap-1"
                                                                    >
                                                                        {actionLoading === (ticket.id + 'note') ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiCheck className="w-3 h-3" />}
                                                                        Save Response
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-[#fcfcfc] dark:bg-white/[0.02] border-t border-[#f0f0f0] dark:border-white/5 flex items-center justify-between">
                        <div className="text-[12px] font-semibold text-[#9aa0a6]">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-[#e5e5e5] dark:border-white/10 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <FiChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[13px] font-bold text-[#111111] dark:text-white px-2">{currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-[#e5e5e5] dark:border-white/10 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <FiChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
