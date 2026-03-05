import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBatchMessages } from "../api/sms";
import { getHistoryForGroup } from "../utils/storage";
import type { Message } from "../types/Sms";

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

    const refresh = useCallback(async (showLoading = false) => {
        // If we have a specific batchId, only fetch that batch
        if (batchId) {
            if (showLoading) setLoading(true);
            try {
                console.log('[useGroupMessages] Fetching batch:', batchId);
                const batchData = await fetchBatchMessages(batchId);
                console.log('[useGroupMessages] Batch data received:', batchData.length, 'messages');
                console.log('[useGroupMessages] Filtering by recipientNumbers:', recipientNumbers);
                
                // Filter to only recipients in this specific bulk message
                // Normalize both the recipientNumbers and stored message numbers for comparison
                let filtered = batchData;
                if (recipientNumbers && recipientNumbers.length > 0) {
                    const normalizedRecipients = recipientNumbers
                        .map(n => normalizePHNumber(n))
                        .filter((n): n is string => n !== null);
                    console.log('[useGroupMessages] Normalized recipients:', normalizedRecipients);
                    
                    filtered = batchData.filter(m => {
                        const messageNumbers = m.numbers || [];
                        const normalizedMessageNumbers = messageNumbers
                            .map(n => normalizePHNumber(n))
                            .filter((n): n is string => n !== null);
                        return normalizedMessageNumbers.some(num => normalizedRecipients.includes(num));
                    });
                    console.log('[useGroupMessages] After filtering:', filtered.length, 'messages');
                }
                
                // Sort by date (chronological)
                filtered.sort((a, b) => {
                    const dateA = typeof a.date_created === 'string' ? new Date(a.date_created).getTime() : a.date_created._seconds * 1000;
                    const dateB = typeof b.date_created === 'string' ? new Date(b.date_created).getTime() : b.date_created._seconds * 1000;
                    return dateA - dateB;
                });
                
                // Transform to UI format: map message->text, date_created->timestamp, sender_id->senderName
                const transformedMessages: Message[] = filtered.map(m => ({
                    id: m.message_id,
                    text: m.message,
                    timestamp: typeof m.date_created === 'string' ? new Date(m.date_created) : new Date(m.date_created._seconds * 1000),
                    senderName: m.sender_id || 'NOLACRM',
                    status: (m.status || 'sent') as Message['status'],
                }));
                
                setMessages(transformedMessages);
                console.log('[useGroupMessages] Final messages set:', transformedMessages.length);
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
            // Normalize both for consistent comparison
            if (recipientNumbers && recipientNumbers.length > 0) {
                const normalizedRecipients = recipientNumbers
                    .map(n => normalizePHNumber(n))
                    .filter((n): n is string => n !== null);
                
                flattened = flattened.filter(m => {
                    const messageNumbers = m.numbers || [];
                    const normalizedMessageNumbers = messageNumbers
                        .map(n => normalizePHNumber(n))
                        .filter((n): n is string => n !== null);
                    return normalizedMessageNumbers.some(num => normalizedRecipients.includes(num));
                });
            }

            // 5. Deduplicate by message_id
            const unique = Array.from(new Map(flattened.map(m => [m.message_id, m])).values());

            // 6. Sort by date (chronological)
            unique.sort((a, b) => {
                const dateA = typeof a.date_created === 'string' ? new Date(a.date_created).getTime() : a.date_created._seconds * 1000;
                const dateB = typeof b.date_created === 'string' ? new Date(b.date_created).getTime() : b.date_created._seconds * 1000;
                return dateA - dateB;
            });

            // Transform to UI format: map message->text, date_created->timestamp, sender_id->senderName
            const transformedMessages: Message[] = unique.map(m => ({
                id: m.message_id,
                text: m.message,
                timestamp: typeof m.date_created === 'string' ? new Date(m.date_created) : new Date(m.date_created._seconds * 1000),
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
