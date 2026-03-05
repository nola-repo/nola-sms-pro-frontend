import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBatchMessages } from "../api/sms";
import { getHistoryForGroup } from "../utils/storage";
import type { Message } from "../types/Sms";

// Helper to parse date from Firestore timestamp or string
const parseDate = (dateField: unknown): number => {
    try {
        if (!dateField) return Date.now();
        if (typeof dateField === 'string') {
            return new Date(dateField).getTime();
        }
        if (dateField && typeof dateField === 'object' && '_seconds' in dateField) {
            const ts = dateField as { _seconds: number };
            return ts._seconds * 1000;
        }
        return Date.now();
    } catch {
        return Date.now();
    }
};

// Normalize phone number to 09XXXXXXXXX format for consistent comparison
const normalizePHNumber = (input: string): string | null => {
    if (!input) return null;
    
    const digits = input.replace(/\D/g, "");
    
    // 09XXXXXXXXX → valid
    if (digits.startsWith("09") && digits.length === 11) {
        return digits;
    }
    
    // 9XXXXXXXXX → 09XXXXXXXXX
    if (digits.startsWith("9") && digits.length === 10) {
        return "0" + digits;
    }
    
    // 639XXXXXXXXX → 09XXXXXXXXX
    if (digits.startsWith("639") && digits.length === 12) {
        return "0" + digits.substring(2);
    }
    
    // +639XXXXXXXXX (already digits only)
    if (digits.startsWith("639") && digits.length === 12) {
        return "0" + digits.substring(2);
    }
    
    return null;
};

export const useGroupMessages = (recipientKey?: string, recipientNumbers?: string[], batchId?: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const initialLoadDone = useRef(false);
    const dataLoaded = useRef(false);

    const refresh = useCallback(async (showLoading = false) => {
        // If we have a specific batchId, only fetch that batch
        if (batchId) {
            if (showLoading) setLoading(true);
            try {
                console.log('[useGroupMessages] Fetching batch:', batchId);
                const batchData = await fetchBatchMessages(batchId);
                console.log('[useGroupMessages] Batch data received:', batchData.length, 'messages');
                console.log('[useGroupMessages] Filtering by recipientNumbers:', recipientNumbers);
                
                // Debug: check what fields the messages have
                if (batchData.length > 0) {
                    console.log('[useGroupMessages] Sample message fields:', Object.keys(batchData[0]));
                    console.log('[useGroupMessages] Sample date_created:', batchData[0].date_created);
                }
                
                // Filter - when viewing a specific bulk conversation, show ALL messages in that batch
                // The batch is already filtered by batchId in the API call
                let filtered = batchData;
                if (recipientNumbers && recipientNumbers.length > 0) {
                    // Normalize the recipient numbers from bulk message
                    const normalizedRecipients = recipientNumbers
                        .map(n => normalizePHNumber(n))
                        .filter((n): n is string => n !== null);
                    console.log('[useGroupMessages] Normalized recipients:', normalizedRecipients);
                    
                    // When viewing a specific bulk message, show all messages in that batch
                    // (no need to filter by recipient since the batch IS the conversation)
                    filtered = batchData;
                    console.log('[useGroupMessages] Showing all', filtered.length, 'messages from batch');
                }
                
                // Sort by date (chronological)
                filtered.sort((a, b) => {
                    const dateA = a?.date_created ? parseDate(a.date_created) : Date.now();
                    const dateB = b?.date_created ? parseDate(b.date_created) : Date.now();
                    return dateA - dateB;
                });
                
                // Transform to UI format: map message->text, date_created->timestamp, sender_id->senderName
                // Include batch_id for campaign grouping
                let transformedMessages: Message[] = [];
                try {
                    transformedMessages = filtered
                        .filter(m => m && m.message_id && m.message)
                        .map(m => ({
                            id: m.message_id,
                            text: m.message || '',
                            timestamp: new Date(parseDate(m.date_created)),
                            senderName: m.sender_id || 'NOLACRM',
                            status: (m.status || 'sent') as Message['status'],
                            // Add these for compatibility with campaign view
                            batch_id: m.batch_id,
                            message: m.message,
                            date_created: m.date_created,
                        }));
                } catch (err) {
                    console.error('[useGroupMessages] Transformation error:', err);
                }
                
                setMessages(transformedMessages);
                dataLoaded.current = true;
                console.log('[useGroupMessages] Final messages set:', transformedMessages.length);
                console.log('[useGroupMessages] Sample transformed message:', transformedMessages[0]);
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
            // AND only messages that were sent as part of bulk messages (have batch_id)
            if (recipientNumbers && recipientNumbers.length > 0) {
                const normalizedRecipients = recipientNumbers
                    .map(n => normalizePHNumber(n))
                    .filter((n): n is string => n !== null);
                
                // Get the batch_ids from the group history
                const groupBatchIds = batchIds;
                
                flattened = flattened.filter(m => {
                    // Must have a batch_id that's in our group
                    const hasMatchingBatch = m.batch_id && groupBatchIds.includes(m.batch_id);
                    
                    const messageNumbers = m.numbers || [];
                    const normalizedMessageNumbers = messageNumbers
                        .map(n => normalizePHNumber(n))
                        .filter((n): n is string => n !== null);
                    const hasMatchingRecipient = normalizedMessageNumbers.some(num => normalizedRecipients.includes(num));
                    
                    return hasMatchingBatch && hasMatchingRecipient;
                });
            }

            // 5. Deduplicate by message_id
            const unique = Array.from(new Map(flattened.map(m => [m.message_id, m])).values());

            // 6. Sort by date (chronological)
            unique.sort((a, b) => {
                const dateA = parseDate(a.date_created);
                const dateB = parseDate(b.date_created);
                return dateA - dateB;
            });

            // Transform to UI format: map message->text, date_created->timestamp, sender_id->senderName
            const transformedMessages: Message[] = unique.map(m => ({
                id: m.message_id,
                text: m.message || '',
                timestamp: new Date(parseDate(m.date_created)),
                senderName: m.sender_id || 'NOLACRM',
                status: (m.status || 'sent') as Message['status'],
            }));

            setMessages(transformedMessages);
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
