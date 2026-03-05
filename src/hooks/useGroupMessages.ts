import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBatchMessages } from "../api/sms";
import { getHistoryForGroup } from "../utils/storage";
import type { SmsLog } from "../types/Sms";

export const useGroupMessages = (recipientKey?: string, recipientNumbers?: string[], batchId?: string) => {
    const [messages, setMessages] = useState<SmsLog[]>([]);
    const [loading, setLoading] = useState(false);
    const initialLoadDone = useRef(false);

    const refresh = useCallback(async (showLoading = false) => {
        // If we have a specific batchId, only fetch that batch
        if (batchId) {
            if (showLoading) setLoading(true);
            try {
                const batchData = await fetchBatchMessages(batchId);
                
                // Filter to only recipients in this specific bulk message
                let filtered = batchData;
                if (recipientNumbers && recipientNumbers.length > 0) {
                    filtered = batchData.filter(m =>
                        m.numbers?.some(num => recipientNumbers.includes(num))
                    );
                }
                
                // Sort by date (chronological)
                filtered.sort((a, b) => {
                    const dateA = typeof a.date_created === 'string' ? new Date(a.date_created).getTime() : a.date_created._seconds * 1000;
                    const dateB = typeof b.date_created === 'string' ? new Date(b.date_created).getTime() : b.date_created._seconds * 1000;
                    return dateA - dateB;
                });
                
                setMessages(filtered);
            } catch (error) {
                console.error("Failed to fetch batch messages:", error);
            } finally {
                if (showLoading) setLoading(false);
                initialLoadDone.current = true;
            }
            return;
        }

        // Original logic for when no specific batchId is provided
        if (!recipientKey) {
            setMessages([]);
            return;
        }

        if (showLoading) setLoading(true);
        try {
            // 1. Get all batches associated with this group from local storage
            const groupHistory = getHistoryForGroup(recipientKey);
            const batchIds = groupHistory
                .map(item => item.batchId)
                .filter((id): id is string => !!id);

            if (batchIds.length === 0) {
                setMessages([]);
                return;
            }

            // 2. Fetch all messages for these batches from the backend
            const allBatchData = await Promise.all(
                batchIds.map(id => fetchBatchMessages(id))
            );

            // 3. Flatten
            let flattened = allBatchData.flat();

            // 4. Filter to only recipients in this group!
            // This is key: "i just want selected contacts not all"
            if (recipientNumbers && recipientNumbers.length > 0) {
                flattened = flattened.filter(m =>
                    m.numbers.some(num => recipientNumbers.includes(num))
                );
            }

            // 5. Deduplicate by message_id
            const unique = Array.from(new Map(flattened.map(m => [m.message_id, m])).values());

            // 6. Sort by date (chronological)
            unique.sort((a, b) => {
                const dateA = typeof a.date_created === 'string' ? new Date(a.date_created).getTime() : a.date_created._seconds * 1000;
                const dateB = typeof b.date_created === 'string' ? new Date(b.date_created).getTime() : b.date_created._seconds * 1000;
                return dateA - dateB;
            });

            setMessages(unique);
        } catch (error) {
            console.error("Failed to fetch group messages:", error);
        } finally {
            if (showLoading) setLoading(false);
            initialLoadDone.current = true;
        }
    }, [recipientKey, recipientNumbers, batchId]);

    useEffect(() => {
        initialLoadDone.current = false;
        refresh(true);

        if (!recipientKey && !batchId) return;

        // Background polling every 10 seconds
        const interval = setInterval(() => {
            refresh(false);
        }, 10000);

        return () => clearInterval(interval);
    }, [recipientKey, refresh, batchId]);

    return {
        messages,
        loading: loading && !initialLoadDone.current,
        refresh
    };
};
