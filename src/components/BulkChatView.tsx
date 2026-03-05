import React, { useState, useEffect, useRef } from "react";
import { FiUsers, FiClock, FiCheck, FiAlertCircle, FiLoader, FiSend, FiPlus, FiSmile } from "react-icons/fi";
import type { BulkMessageHistoryItem, SmsLog } from "../types/Sms";
import { useGroupMessages } from "../hooks/useGroupMessages";
import { getRelativeTime, saveBulkMessage } from "../utils/storage";
import { sendBulkSms } from "../api/sms";
import { fetchContacts } from "../api/contacts";
import type { Contact } from "../types/Contact";

interface BulkChatViewProps {
    bulkItem: BulkMessageHistoryItem;
}

export const BulkChatView: React.FC<BulkChatViewProps> = ({ bulkItem }) => {
    const { messages, loading, refresh } = useGroupMessages(bulkItem.recipientKey);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [allContacts, setAllContacts] = useState<Contact[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchContacts().then(setAllContacts).catch(console.error);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        const messageText = newMessage;
        setNewMessage("");

        try {
            // Find contact objects for the recipients in this group
            const recipientContacts = bulkItem.recipientNumbers.map(number => {
                const found = allContacts.find(c => c.phone === number);
                return found || { id: `manual-${number}`, name: number, phone: number } as Contact;
            });

            const { results, batchId } = await sendBulkSms(bulkItem.recipientNumbers, messageText);
            const successCount = results.filter(r => r.success).length;

            // Save this new campaign to history under the same group
            const newBulkItem: BulkMessageHistoryItem = {
                id: `bulk-${Date.now()}`,
                message: messageText,
                recipientCount: bulkItem.recipientNumbers.length,
                recipientNames: recipientContacts.map(r => r.name),
                recipientNumbers: bulkItem.recipientNumbers,
                recipientKey: bulkItem.recipientKey,
                timestamp: new Date().toISOString(),
                status: successCount === bulkItem.recipientNumbers.length ? 'sent' : successCount > 0 ? 'partial' : 'failed',
                batchId: batchId,
                customName: bulkItem.customName
            };

            saveBulkMessage(newBulkItem);
            window.dispatchEvent(new Event('bulk-message-sent'));
            window.dispatchEvent(new Event('sms-sent')); // Trigger credit refresh

            // Refresh history
            setTimeout(() => refresh(), 1000);
        } catch (error) {
            console.error("Failed to send group message:", error);
        } finally {
            setSending(false);
        }
    };


    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0b0b0b] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#0b0b0b]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#2b83fa]/10 flex items-center justify-center text-[#2b83fa] flex-shrink-0">
                            <FiUsers size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[17px] font-bold text-[#111111] dark:text-[#ececf1] leading-tight mb-0.5 truncate">
                                {bulkItem.customName || (bulkItem.recipientNames && bulkItem.recipientNames.length > 0
                                    ? bulkItem.recipientNames.join(", ")
                                    : bulkItem.recipientNumbers.join(", "))}
                            </h2>
                            <div className="flex items-center gap-3 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                    <FiClock size={12} /> {getRelativeTime(bulkItem.timestamp)}
                                </span>
                                <span>•</span>
                                <span>{bulkItem.recipientCount} Recipients</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-[#2b83fa] text-[11px] font-bold uppercase tracking-wider">
                            Group Chat
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth custom-scrollbar bg-gray-50/30 dark:bg-black/20">
                {loading && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <FiLoader className="animate-spin mb-4" size={32} />
                        <p className="text-[14px]">Loading group history...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 mb-6">
                            <FiUsers size={32} />
                        </div>
                        <h3 className="text-[18px] font-bold text-[#111111] dark:text-[#ececf1] mb-2">No history</h3>
                        <p className="text-[14px] text-gray-500 dark:text-gray-400">
                            Start the conversation by sending a message below.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-4xl mx-auto flex flex-col">
                        {/* Group messages by batchId for clearer campaign view? 
                            Actually, let's keep it as individual messages or grouped by campaign.
                            The user said "like a groupchat". In group chats, messages are sequential.
                        */}
                        {(() => {
                            // Group messages by batch_id to show campaign headers
                            const campaigns: { [key: string]: SmsLog[] } = {};
                            messages.forEach(m => {
                                const bid = m.batch_id || 'no-batch';
                                if (!campaigns[bid]) campaigns[bid] = [];
                                campaigns[bid].push(m);
                            });

                            return Object.keys(campaigns).map(bid => {
                                const campaignMsgs = campaigns[bid];
                                const firstMsg = campaignMsgs[0];
                                const date = typeof firstMsg.date_created === 'string'
                                    ? new Date(firstMsg.date_created)
                                    : new Date(firstMsg.date_created._seconds * 1000);

                                const campaignStats = {
                                    sent: campaignMsgs.filter(m => m.status.toLowerCase() === 'sent' || m.status.toLowerCase() === 'delivered').length,
                                    pending: campaignMsgs.filter(m => m.status.toLowerCase() === 'pending' || m.status.toLowerCase() === 'queued').length,
                                    failed: campaignMsgs.filter(m => ['failed', 'error'].includes(m.status.toLowerCase())).length,
                                    total: campaignMsgs.length
                                };

                                return (
                                    <div key={bid} className="flex flex-col gap-2 mb-4">
                                        <div className="flex justify-center my-2">
                                            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 max-w-[85%] self-end">
                                            <div className="bg-[#2b83fa] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md">
                                                <div className="text-[15px] whitespace-pre-wrap leading-relaxed">
                                                    {firstMsg.message}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 px-1">
                                                <StatusBadgeSummary stats={campaignStats} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0b0b0b]">
                <div className="max-w-4xl mx-auto">
                    <div className="relative flex items-end gap-2 group">
                        <div className="flex-1 min-h-[48px] p-1.5 rounded-2xl bg-[#f8f9fa] dark:bg-white/5 border border-gray-200/50 dark:border-white/5 focus-within:border-[#2b83fa]/50 focus-within:ring-4 focus-within:ring-[#2b83fa]/5 transition-all">
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={`Reply to ${bulkItem.recipientCount} contacts...`}
                                className="w-full bg-transparent border-none focus:outline-none px-3 py-2 text-[15px] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 dark:placeholder-gray-500 min-h-[40px] max-h-40 resize-none scrollbar-hide"
                                rows={1}
                            />
                            <div className="flex items-center justify-between px-2 pb-1">
                                <div className="flex items-center gap-1">
                                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-colors">
                                        <FiPlus size={18} />
                                    </button>
                                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-colors">
                                        <FiSmile size={18} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[11px] font-bold ${newMessage.length > 150 ? 'text-amber-500' : 'text-gray-400'}`}>
                                        {newMessage.length} chars
                                    </span>
                                    <button
                                        onClick={handleSend}
                                        disabled={!newMessage.trim() || sending}
                                        className={`p-2 rounded-xl transition-all ${newMessage.trim() && !sending
                                            ? 'bg-[#2b83fa] text-white shadow-lg shadow-blue-500/20 active:scale-95'
                                            : 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {sending ? (
                                            <FiLoader className="animate-spin" size={18} />
                                        ) : (
                                            <FiSend size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusBadgeSummary: React.FC<{ stats: { sent: number, pending: number, failed: number, total: number } }> = ({ stats }) => {
    return (
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
            {stats.failed > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                    <FiAlertCircle size={10} /> {stats.failed} Failed
                </span>
            )}
            {stats.pending > 0 && (
                <span className="text-blue-500 flex items-center gap-1">
                    <FiLoader className="animate-spin" size={10} /> {stats.pending} Pending
                </span>
            )}
            <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <FiCheck size={10} className={stats.sent === stats.total ? "text-green-500" : ""} />
                {stats.sent}/{stats.total} Sent
            </span>
        </div>
    );
};

