import { useState, useEffect, useCallback } from "react";
import { fetchSmsLogs } from "../api/sms";
import type { Message, SmsLog } from "../types/Sms";

export const useMessages = (phoneNumber: string | undefined) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatLogToMessage = (log: SmsLog): Message => {
        let date: Date;
        if (!log.date_created) {
            date = new Date();
        } else if (typeof log.date_created === 'string') {
            date = new Date(log.date_created);
        } else if (typeof log.date_created === 'object' && '_seconds' in log.date_created) {
            date = new Date((log.date_created as any)._seconds * 1000);
        } else {
            date = new Date();
        }

        return {
            id: log.message_id || `msg-${Date.now()}`,
            text: log.message || '',
            timestamp: date,
            senderName: log.sender_id || 'NOLACRM',
            status: (log.status as Message['status']) || 'sent',
        };
    };

    const fetchHistory = useCallback(async () => {
        if (!phoneNumber) {
            setMessages([]);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const logs = await fetchSmsLogs(phoneNumber);
            const formattedMessages = logs.map(formatLogToMessage);
            // Sort by date_created ascending as requested
            formattedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            setMessages(formattedMessages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history");
        } finally {
            setLoading(false);
        }
    }, [phoneNumber]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const addOptimisticMessage = (text: string, senderName: string): string => {
        const id = `temp-${Date.now()}`;
        const newMessage: Message = {
            id,
            text,
            timestamp: new Date(),
            senderName,
            status: 'sending',
        };
        setMessages(prev => [...prev, newMessage]);
        return id;
    };

    const updateMessageStatus = (tempId: string, status: 'sent' | 'failed', realId?: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === tempId
                ? { ...msg, status, id: realId || msg.id }
                : msg
        ));
    };

    return {
        messages,
        loading,
        error,
        addOptimisticMessage,
        updateMessageStatus,
        refresh: fetchHistory,
    };
};
