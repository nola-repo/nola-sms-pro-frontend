import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMessagesByConversationId, ConversationMessagesError } from "../api/sms";
import type { Message } from "../types/Sms";

const POLL_INTERVAL = 3000;

/** Parse a Firestore timestamp (string or _seconds object) to a JS Date */
const parseFirestoreDate = (raw: unknown): Date => {
    if (!raw) return new Date();
    if (typeof raw === "string") return new Date(raw);
    if (typeof raw === "object" && raw !== null && "_seconds" in raw) {
        return new Date((raw as { _seconds: number })._seconds * 1000);
    }
    return new Date();
};

/**
 * Load and poll messages for a single conversation by its conversation_id.
 * No localStorage caching — always fetches fresh from the backend.
 *
 * Direct chat:  conversationId = "{locationId}_conv_09XXXXXXXXX" (or legacy "conv_09XXXXXXXXX")
 * Bulk chat:    conversationId = "group_batch_xxx"
 */
export const useConversationMessages = (conversationId: string | undefined, recipientKey?: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
    const isInitialLoad = useRef(true);
    const consecutiveServerErrors = useRef(0);

    const fetchHistory = useCallback(async (showLoading = true) => {
        if (!conversationId) {
            setMessages([]);
            return;
        }

        if (showLoading) setLoading(true);
        setError(null);
        setErrorStatus(undefined);

        try {
            const rows = await fetchMessagesByConversationId(conversationId, 100, recipientKey);

            // Sort oldest → newest for chronological display
            const sorted = [...rows].sort(
                (a, b) =>
                    parseFirestoreDate(a.created_at).getTime() -
                    parseFirestoreDate(b.created_at).getTime()
            );

            const formatted: Message[] = sorted.map((row) => ({
                id: row.id,
                text: row.message || "",
                timestamp: parseFirestoreDate(row.created_at),
                senderName: row.sender_id || "NOLASMSPro",
                status: (row.status as Message["status"]) || "sent",
                batch_id: row.batch_id,
                message: row.message,
                errorReason: row.error_reason,
            }));

            // Preserve any in-flight optimistic "temp-" messages that haven't been confirmed yet
            setMessages(prev => {
                const tempOnly = prev.filter(
                    (m) =>
                        m.id.startsWith("temp-") &&
                        !formatted.some(
                            (api) =>
                                api.text === m.text &&
                                Math.abs(api.timestamp.getTime() - m.timestamp.getTime()) < 60_000
                        )
                );
                return [...formatted, ...tempOnly];
            });

            consecutiveServerErrors.current = 0;
            setError(null);
            setErrorStatus(undefined);
        } catch (err) {
            if (err instanceof ConversationMessagesError) {
                setError(err.message);
                setErrorStatus(err.status);
                if (typeof err.status === "number" && err.status >= 500) {
                    consecutiveServerErrors.current += 1;
                }
            } else if (err instanceof Error) {
                setError(err.message);
                setErrorStatus(undefined);
            } else {
                setError("Failed to load messages");
                setErrorStatus(undefined);
            }
        } finally {
            setLoading(false);
            isInitialLoad.current = false;
        }
    }, [conversationId, recipientKey]);

    // Initial fetch — reset state when conversation changes
    useEffect(() => {
        isInitialLoad.current = true;
        setMessages([]);
        fetchHistory(true);
    }, [fetchHistory]);

    // Background polling every 3 seconds
    useEffect(() => {
        if (!conversationId) return;

        // Pause polling if backend is consistently returning 5xx errors
        if (errorStatus && errorStatus >= 500 && consecutiveServerErrors.current >= 3) {
            return;
        }

        const interval = setInterval(() => fetchHistory(false), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [conversationId, fetchHistory, errorStatus]);

    // Listen for sidebar-triggered refresh events (e.g. new automation message detected)
    useEffect(() => {
        if (!conversationId) return;

        const handleConversationUpdated = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.conversationId || detail.conversationId === conversationId) {
                fetchHistory(false);
            }
        };

        window.addEventListener('conversation-updated', handleConversationUpdated);
        return () => window.removeEventListener('conversation-updated', handleConversationUpdated);
    }, [conversationId, fetchHistory]);

    const addOptimisticMessage = (text: string, senderName: string): string => {
        const id = `temp-${Date.now()}`;
        const newMsg: Message = {
            id,
            text,
            timestamp: new Date(),
            senderName,
            status: "sending",
        };
        setMessages((prev) => [...prev, newMsg]);
        return id;
    };

    const updateMessageStatus = (
        tempId: string,
        status: "sent" | "failed",
        realId?: string,
        errorReason?: string
    ) => {
        setMessages((prev) =>
            prev.map((m) =>
                m.id === tempId
                    ? { ...m, status, id: realId || m.id, errorReason }
                    : m
            )
        );
    };

    return {
        messages,
        loading: loading && isInitialLoad.current,
        error,
        errorStatus,
        addOptimisticMessage,
        updateMessageStatus,
        refresh: fetchHistory,
    };
};
