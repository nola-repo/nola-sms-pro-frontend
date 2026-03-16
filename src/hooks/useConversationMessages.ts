import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMessagesByConversationId, ConversationMessagesError } from "../api/sms";
import type { Message } from "../types/Sms";
import { getCachedMessages, setCachedMessages, updateMessageInCache } from "../utils/storage";
import { getAccountSettings } from "../utils/settingsStorage";

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
 *
 * Direct chat:  conversationId = "{locationId}_conv_09XXXXXXXXX" (or legacy "conv_09XXXXXXXXX")
 * Bulk chat:    conversationId = "group_batch_xxx"
 *
 * Replaces the old useMessages (per phone number) +
 * useGroupMessages (per recipient_key) pair.
 */
export const useConversationMessages = (conversationId: string | undefined, recipientKey?: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
    const isInitialLoad = useRef(true);
    const consecutiveServerErrors = useRef(0);

    // Cache must be tenant-scoped to avoid cross-account bleed in localStorage.
    // Use the current URL-derived location id (see settingsStorage) as the namespace.
    const tenantKey = getAccountSettings().ghlLocationId || "__no_location__";

    // Create a composite cache key if filtering by recipientKey
    const rawCacheKey = conversationId && recipientKey
        ? `${conversationId}_filter_${recipientKey}`
        : conversationId;

    const cacheKey = rawCacheKey ? `${tenantKey}:${rawCacheKey}` : undefined;

    const fetchHistory = useCallback(async (showLoading = true) => {
        // Load from cache first for instant display
        if (cacheKey) {
            const cached = getCachedMessages(cacheKey);
            if (cached && cached.length > 0) {
                setMessages(cached);
            }
        }

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
                senderName: row.sender_id || "NOLACRM",
                status: (row.status as Message["status"]) || "sent",
                batch_id: row.batch_id,
                message: row.message,
            }));

            // Merge optimistic "temp-" messages that haven't been confirmed yet
            const cached = cacheKey ? (getCachedMessages(cacheKey) || []) : [];
            const tempOnly = cached.filter(
                (m) =>
                    m.id.startsWith("temp-") &&
                    !formatted.some(
                        (api) =>
                            api.text === m.text &&
                            Math.abs(api.timestamp.getTime() - m.timestamp.getTime()) < 60_000
                    )
            );

            const merged = [...formatted, ...tempOnly];
            setMessages(merged);
            if (cacheKey) {
                setCachedMessages(cacheKey, merged);
            }

            // Successful fetch – reset error tracking and counters
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
    }, [conversationId, recipientKey, cacheKey]);

    // Initial fetch
    useEffect(() => {
        isInitialLoad.current = true;
        fetchHistory(true);
    }, [fetchHistory]);

    // Background polling
    useEffect(() => {
        if (!conversationId) return;

        // If the backend is consistently failing with 5xx, pause polling to avoid hammering it.
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
            // If no specific conversation targeted, or it matches ours, refresh immediately
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
        setMessages((prev) => {
            const updated = [...prev, newMsg];
            if (cacheKey) setCachedMessages(cacheKey, updated);
            return updated;
        });
        return id;
    };

    const updateMessageStatus = (
        tempId: string,
        status: "sent" | "failed",
        realId?: string,
        errorReason?: string
    ) => {
        setMessages((prev) => {
            const updated = prev.map((m) =>
                m.id === tempId
                    ? { ...m, status, id: realId || m.id, errorReason }
                    : m
            );
            if (cacheKey) updateMessageInCache(cacheKey, tempId, status, realId);
            return updated;
        });
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
