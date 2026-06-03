import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchMessagesByConversationId, ConversationMessagesError } from "../api/sms";
import type { Message } from "../types/Sms";
import { useLocationId } from "../context/LocationContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "../services/firebaseConfig";

const CACHE_TTL_MS = 60_000;
const SKELETON_DELAY_MS = 160;

const messageHistoryCache = new Map<string, { messages: Message[]; fetchedAt: number }>();

const buildMessageHistoryCacheKey = (
    locationId: string | undefined,
    conversationId: string | undefined,
    recipientKey?: string
) => conversationId ? `${locationId || "global"}::${conversationId}::${recipientKey || "all"}` : "";

/** Parse a Firestore timestamp (string, native Timestamp, or _seconds object) to a JS Date */
const parseFirestoreDate = (raw: unknown): Date => {
    if (!raw) return new Date();
    if (typeof raw === "string") return new Date(raw);
    if (typeof raw === "object" && raw !== null) {
        if ("toDate" in raw && typeof (raw as any).toDate === "function") {
            return (raw as any).toDate();
        }
        if ("_seconds" in raw) {
            return new Date((raw as { _seconds: number })._seconds * 1000);
        }
    }
    return new Date();
};

/**
 * Load and listen to messages for a single conversation by its conversation_id.
 * No localStorage caching — always fetches fresh from the backend.
 *
 * Direct chat:  conversationId = "{locationId}_conv_09XXXXXXXXX" (or legacy "conv_09XXXXXXXXX")
 * Bulk chat:    conversationId = "group_batch_xxx"
 */
export const useConversationMessages = (conversationId: string | undefined, recipientKey?: string) => {
    const { locationId } = useLocationId();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
    const isInitialLoad = useRef(true);
    const consecutiveServerErrors = useRef(0);
    const skeletonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeq = useRef(0);
    const cacheKey = useMemo(
        () => buildMessageHistoryCacheKey(locationId || undefined, conversationId, recipientKey),
        [conversationId, locationId, recipientKey]
    );
    const cacheKeyRef = useRef(cacheKey);
    const optimisticMessageTargets = useRef(new Map<string, string>());

    useEffect(() => {
        cacheKeyRef.current = cacheKey;
    }, [cacheKey]);

    const processAndMergeMessages = useCallback((rows: any[]) => {
        // Sort oldest → newest for chronological display
        const sorted = [...rows].sort(
            (a, b) =>
                parseFirestoreDate(a.created_at).getTime() -
                parseFirestoreDate(b.created_at).getTime()
        );

        const formatted: Message[] = sorted.map((row) => {
            let status = (row.status as string || 'sending').toLowerCase();
            
            // Strictly unify statuses for UI
            if (['queued', 'pending'].includes(status)) {
                status = 'sending';
            } else if (['delivered', 'success'].includes(status)) {
                status = 'sent';
            } else if (['rejected', 'undelivered', 'expired'].includes(status)) {
                status = 'failed';
            }

            return {
                id: row.id || row.message_id || `msg-${Date.now()}-${Math.random()}`,
                text: row.message || "",
                timestamp: parseFirestoreDate(row.created_at || row.date_created),
                senderName: row.sender_id || "NOLASMSPro",
                status: status as Message["status"],

                batch_id: row.batch_id,
                message: row.message,
                errorReason: row.error_reason,
            };
        });

        // Frontend status priority guard — mirrors backend retrieve_status.php
        const STATUS_PRIORITY: Record<string, number> = {
            sending: 0,
            queued: 1,
            pending: 2,
            sent: 3,
            delivered: 4,
            failed: 4,
            rejected: 4,
            undelivered: 4,
            expired: 4,
        };

        setMessages(prev => {
            const prevById = new Map(prev.map(m => [m.id, m]));

            const merged = formatted.map(apiMsg => {
                const local = prevById.get(apiMsg.id);
                if (!local) return apiMsg;
                // Keep local status if it has equal or higher priority than what DB returned
                const localPriority = STATUS_PRIORITY[local.status] ?? -1;
                const apiPriority = STATUS_PRIORITY[apiMsg.status] ?? -1;
                if (localPriority >= apiPriority) {
                    return { ...apiMsg, status: local.status };
                }
                return apiMsg;
            });

            const apiMatchesLocal = (api: Message, local: Message) =>
                api.id === local.id ||
                (
                    api.text === local.text &&
                    Math.abs(api.timestamp.getTime() - local.timestamp.getTime()) < 60_000
                );

            const apiReturnedTransientEmpty =
                !isInitialLoad.current && formatted.length === 0 && prev.length > 0;

            const localOnly = prev.filter((local) => {
                if (formatted.some((api) => apiMatchesLocal(api, local))) {
                    return false;
                }

                if (local.id.startsWith("temp-")) {
                    return true;
                }

                const isRecentlySent = Date.now() - local.timestamp.getTime() < 5 * 60_000;
                return apiReturnedTransientEmpty || isRecentlySent;
            });

            const nextMessages = [...merged, ...localOnly].sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
            if (cacheKey) {
                messageHistoryCache.set(cacheKey, { messages: nextMessages, fetchedAt: Date.now() });
            }
            return nextMessages;
        });
    }, [cacheKey]);

    const fetchHistory = useCallback(async (showLoading = true) => {
        if (!conversationId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        const requestId = ++requestSeq.current;
        if (showLoading) {
            if (skeletonTimer.current) clearTimeout(skeletonTimer.current);
            skeletonTimer.current = setTimeout(() => {
                if (requestSeq.current === requestId) {
                    setLoading(true);
                }
            }, SKELETON_DELAY_MS);
        }
        setError(null);
        setErrorStatus(undefined);

        try {
            const rows = await fetchMessagesByConversationId(conversationId, 100, recipientKey, locationId || undefined);
            if (requestSeq.current !== requestId) return;

            processAndMergeMessages(rows);

            consecutiveServerErrors.current = 0;
            setError(null);
            setErrorStatus(undefined);
        } catch (err) {
            if (requestSeq.current !== requestId) return;
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
            if (requestSeq.current === requestId) {
                if (skeletonTimer.current) {
                    clearTimeout(skeletonTimer.current);
                    skeletonTimer.current = null;
                }
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, [conversationId, recipientKey, locationId, processAndMergeMessages]);

    // Initial fetch — reset state when conversation changes
    useEffect(() => {
        if (!conversationId) {
            requestSeq.current += 1;
            if (skeletonTimer.current) {
                clearTimeout(skeletonTimer.current);
                skeletonTimer.current = null;
            }
            isInitialLoad.current = false;
            setMessages([]);
            setLoading(false);
            return;
        }

        const cached = cacheKey ? messageHistoryCache.get(cacheKey) : undefined;
        const hasFreshCache = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

        if (hasFreshCache) {
            isInitialLoad.current = false;
            setMessages(cached.messages);
            setLoading(false);
            fetchHistory(false);
            return;
        }

        isInitialLoad.current = true;
        setMessages([]);
        setLoading(true);
        fetchHistory(true);
    }, [cacheKey, conversationId, fetchHistory]);

    useEffect(() => {
        return () => {
            if (skeletonTimer.current) {
                clearTimeout(skeletonTimer.current);
            }
        };
    }, []);

    // Real-time Firestore message subscription
    useEffect(() => {
        if (!conversationId || !locationId) return;

        let unsubscribe: (() => void) | undefined;

        const setupListener = async () => {
            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }

                let q = query(
                    collection(db, 'messages'),
                    where('location_id', '==', locationId),
                    where('conversation_id', '==', conversationId)
                );

                if (recipientKey) {
                    q = query(q, where('recipient_key', '==', recipientKey));
                }

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const rows = snapshot.docs.map(doc => {
                        const d = doc.data();
                        return {
                            id: doc.id,
                            ...d
                        };
                    });
                    processAndMergeMessages(rows);
                }, (err) => {
                    console.error("[useConversationMessages] Firestore subscription error:", err);
                });
            } catch (err) {
                console.error("[useConversationMessages] Firestore setup error:", err);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [conversationId, locationId, recipientKey, processAndMergeMessages]);

    // Listen for sidebar-triggered refresh events
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

    const addOptimisticMessage = (text: string, senderName: string, targetConversationId?: string): string => {
        const id = `temp-${Date.now()}`;
        const newMsg: Message = {
            id,
            text,
            timestamp: new Date(),
            senderName,
            status: "sending",
        };

        const targetCacheKey = buildMessageHistoryCacheKey(
            locationId || undefined,
            targetConversationId || conversationId,
            recipientKey
        );

        const currentCacheKey = cacheKeyRef.current;

        if (targetCacheKey && targetCacheKey !== currentCacheKey) {
            const cached = messageHistoryCache.get(targetCacheKey)?.messages || [];
            const nextMessages = [...cached, newMsg].sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
            messageHistoryCache.set(targetCacheKey, { messages: nextMessages, fetchedAt: Date.now() });
            optimisticMessageTargets.current.set(id, targetCacheKey);
            return id;
        }

        if (targetCacheKey) {
            optimisticMessageTargets.current.set(id, targetCacheKey);
        }

        setMessages((prev) => {
            const nextMessages = [...prev, newMsg];
            if (currentCacheKey) {
                messageHistoryCache.set(currentCacheKey, { messages: nextMessages, fetchedAt: Date.now() });
            }
            return nextMessages;
        });
        return id;
    };

    const updateMessageStatus = (
        tempId: string,
        status: "sending" | "sent" | "failed",
        realId?: string,
        errorReason?: string
    ) => {
        const targetCacheKey = optimisticMessageTargets.current.get(tempId);
        const currentCacheKey = cacheKeyRef.current;

        if (targetCacheKey && targetCacheKey !== currentCacheKey) {
            const cached = messageHistoryCache.get(targetCacheKey)?.messages || [];
            const nextMessages = cached.map((m) =>
                m.id === tempId || (realId && m.id === realId)
                    ? { ...m, status, id: realId || m.id, errorReason }
                    : m
            );
            messageHistoryCache.set(targetCacheKey, { messages: nextMessages, fetchedAt: Date.now() });
            if (realId) optimisticMessageTargets.current.set(realId, targetCacheKey);
            return;
        }

        setMessages((prev) => {
            const nextMessages = prev.map((m) =>
                m.id === tempId || (realId && m.id === realId)
                    ? { ...m, status, id: realId || m.id, errorReason }
                    : m
            );
            if (currentCacheKey) {
                messageHistoryCache.set(currentCacheKey, { messages: nextMessages, fetchedAt: Date.now() });
            }
            return nextMessages;
        });

        if (realId && targetCacheKey) {
            optimisticMessageTargets.current.set(realId, targetCacheKey);
        }
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
