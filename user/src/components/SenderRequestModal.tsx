import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiPlus, FiX, FiCheck, FiLoader, FiAlertCircle } from "react-icons/fi";
import { submitSenderRequest } from "../api/senderRequests";
import type { StoredSenderId } from "../utils/settingsStorage";

interface SenderRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (newSender: StoredSenderId) => void;
}

const SENDER_COLORS = [
    "bg-blue-500", "bg-purple-500", "bg-orange-500",
    "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-indigo-500", "bg-cyan-500",
];

export const SenderRequestModal: React.FC<SenderRequestModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [newId, setNewId] = useState("");
    const [newPurpose, setNewPurpose] = useState("");
    const [newSample, setNewSample] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [error, setError] = useState<string | null>(null);

    const normalizedSenderName = newId.trim().toUpperCase();

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isSubmitted) {
            setCountdown(3);
            timer = setInterval(() => {
                setCountdown((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isSubmitted]);

    if (!isOpen) return null;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedId = normalizedSenderName;
        if (!trimmedId || isSubmitting) return;

        if (trimmedId.length < 3 || trimmedId.length > 11) {
            setError("Sender name must be between 3 and 11 characters.");
            return;
        }

        if (!/^[a-zA-Z0-9]+$/.test(trimmedId)) {
            setError("Sender name can only contain letters and numbers.");
            return;
        }

        if (!newPurpose.trim()) {
            setError("Business purpose is required.");
            return;
        }

        if (!newSample.trim()) {
            setError("Sample message is required.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await submitSenderRequest(trimmedId, newPurpose.trim(), newSample.trim());

            const created: StoredSenderId = {
                id: trimmedId,
                name: trimmedId,
                description: newPurpose.trim(),
                color: SENDER_COLORS[Math.floor(Math.random() * SENDER_COLORS.length)],
                status: "pending",
            };

            if (onSuccess) onSuccess(created);
            setIsSubmitted(true);

            setTimeout(() => {
                setNewId("");
                setNewPurpose("");
                setNewSample("");
                setIsSubmitted(false);
                onClose();
            }, 3000);
        } catch (err) {
            console.error("[SenderRequestModal] Submit error:", err);
            setError(err instanceof Error ? err.message : "Failed to submit request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#18191d] rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#2b83fa]/10 flex items-center justify-center text-[#2b83fa]">
                            <FiPlus />
                        </div>
                        <div>
                            <h3 className="text-[17px] font-bold text-[#111111] dark:text-[#ececf1]">Add a Sender Name</h3>
                            <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                                Request a branded SMS sender name for your account.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors">
                        <FiX />
                    </button>
                </div>

                {isSubmitted ? (
                    <div className="py-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
                            <FiCheck className="w-8 h-8" />
                        </div>
                        <h4 className="text-[18px] font-bold text-[#111111] dark:text-[#ececf1] mb-2">Request Submitted</h4>
                        <p className="text-[14px] text-[#6e6e73] dark:text-[#94959b] max-w-xs leading-relaxed">
                            Your sender name has been submitted for review.
                        </p>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-6 font-medium bg-gray-50 dark:bg-white/5 py-1.5 px-4 rounded-full">
                            Auto-closing in {countdown}s...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleAdd} className="space-y-4">
                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <FiAlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                <p className="text-[12px] text-red-600 dark:text-red-400 font-medium">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-black text-[#6e6e73] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">
                                Sender Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                autoFocus
                                value={newId}
                                onChange={e => {
                                    setError(null);
                                    setNewId(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                                }}
                                placeholder="ex. NOLASMS"
                                maxLength={11}
                                required
                                aria-required="true"
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 rounded-xl text-[14px] font-bold border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/25 disabled:opacity-50"
                            />
                            <p className="mt-1.5 text-[11px] text-[#9aa0a6]">Use 3-11 letters or numbers only. No spaces or symbols.</p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-[#6e6e73] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">
                                Business Purpose <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={newPurpose}
                                onChange={e => {
                                    setError(null);
                                    setNewPurpose(e.target.value);
                                }}
                                placeholder="What will you be using this for?"
                                required
                                aria-required="true"
                                rows={2}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/25 resize-none disabled:opacity-50"
                            />
                            <p className="mt-1.5 text-[11px] text-[#9aa0a6]">Briefly describe the use case, such as reminders, promos, or updates.</p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-[#6e6e73] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">
                                Sample Message <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={newSample}
                                onChange={e => {
                                    setError(null);
                                    setNewSample(e.target.value);
                                }}
                                placeholder="Provide a specific message template example."
                                required
                                aria-required="true"
                                rows={2}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/25 resize-none disabled:opacity-50"
                            />
                            <p className="mt-1.5 text-[11px] text-[#9aa0a6]">Add one real example your customers may receive.</p>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-normal text-center font-medium">
                                <strong>Note:</strong> You will receive an email when this request is received and again when it is approved or needs changes.
                            </p>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[13px] transition-all shadow-md shadow-blue-500/20 disabled:opacity-70">
                            {isSubmitting ? (
                                <>
                                    <FiLoader className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit Request"
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};
