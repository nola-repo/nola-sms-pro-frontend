import { adminFetch } from './adminApi';
import { getAdminAuthHeaders } from './adminAuthHeaders';
import { createRequestId } from './apiFetch';

const ACTIVITY_LOGS_API = '/api/admin_sender_requests.php';
const ACTIVITY_REQUEST_TIMEOUT_MS = 25000;

export type ActivityLogsPayload = {
    status: 'success';
    data: any[];
    partial?: boolean;
    unavailable_sources?: string[];
    pagination?: {
        next_cursor?: string | null;
        has_more?: boolean;
    };
    request_id?: string;
};

export class ActivityLogsRequestError extends Error {
    requestId?: string;
    kind: 'http' | 'invalid_response' | 'timeout' | 'unreachable' | 'cancelled';

    constructor(
        message: string,
        kind: ActivityLogsRequestError['kind'],
        requestId?: string,
    ) {
        super(message);
        this.name = 'ActivityLogsRequestError';
        this.kind = kind;
        this.requestId = requestId;
    }
}

export type ActivityLogsFailure = {
    message: string;
    requestId?: string;
};

export async function fetchActivityLogs(options: {
    limit?: number;
    cursor?: string | null;
    signal?: AbortSignal;
} = {}): Promise<ActivityLogsPayload> {
    const params = new URLSearchParams({
        action: 'logs',
        limit: String(options.limit ?? 50),
    });
    if (options.cursor) params.set('start_after', options.cursor);

    const requestId = createRequestId();
    const controller = new AbortController();
    let timedOut = false;
    let externallyAborted = false;
    const abortFromCaller = () => {
        externallyAborted = true;
        controller.abort();
    };

    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, ACTIVITY_REQUEST_TIMEOUT_MS);

    try {
        const response = await adminFetch(`${ACTIVITY_LOGS_API}?${params.toString()}`, {
            cache: 'no-store',
            headers: {
                ...getAdminAuthHeaders(),
                'X-Request-ID': requestId,
            },
            signal: controller.signal,
        });
        const responseRequestId = response.headers.get('X-Request-ID') || requestId;

        let body: string;
        try {
            body = await response.text();
        } catch {
            if (timedOut) {
                throw new ActivityLogsRequestError(
                    'The activity service did not respond in time. Try again shortly.',
                    'timeout',
                    responseRequestId,
                );
            }
            throw new ActivityLogsRequestError(
                'The activity service response could not be read.',
                'invalid_response',
                responseRequestId,
            );
        }

        let payload: any;
        try {
            payload = JSON.parse(body);
        } catch {
            if (!response.ok) {
                throw new ActivityLogsRequestError(
                    httpErrorMessage(response.status),
                    'http',
                    responseRequestId,
                );
            }
            throw new ActivityLogsRequestError(
                'The activity service returned an unreadable response.',
                'invalid_response',
                responseRequestId,
            );
        }

        const resolvedRequestId = String(payload?.request_id || responseRequestId);
        if (!response.ok) {
            throw new ActivityLogsRequestError(
                httpErrorMessage(response.status),
                'http',
                resolvedRequestId,
            );
        }
        if (payload?.status !== 'success' || !Array.isArray(payload.data)) {
            throw new ActivityLogsRequestError(
                'The activity service returned an invalid activity feed.',
                'invalid_response',
                resolvedRequestId,
            );
        }

        return { ...payload, request_id: resolvedRequestId } as ActivityLogsPayload;
    } catch (error) {
        if (error instanceof ActivityLogsRequestError) throw error;
        if (timedOut) {
            throw new ActivityLogsRequestError(
                'The activity service did not respond in time. Try again shortly.',
                'timeout',
                requestId,
            );
        }
        if (externallyAborted) {
            throw new ActivityLogsRequestError(
                'Activity loading was cancelled.',
                'cancelled',
                requestId,
            );
        }
        if (error instanceof TypeError) {
            throw new ActivityLogsRequestError(
                'The activity service did not return a response. Try again, or contact support if this continues.',
                'unreachable',
                requestId,
            );
        }
        throw new ActivityLogsRequestError(
            'Platform Activity could not be loaded. Try again shortly.',
            'invalid_response',
            requestId,
        );
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
    }
}

function httpErrorMessage(status: number): string {
    if (status === 401) return 'Your admin session expired or could not be verified. Sign in again, then retry.';
    if (status === 403) return 'Your admin account does not have access to this activity feed.';
    if (status === 404) return 'The activity endpoint is unavailable in this deployment.';
    if (status === 429) return 'Activity requests are temporarily limited. Wait a moment, then retry.';
    if (status === 408 || status === 504) return 'The activity service timed out. Try again shortly.';
    if (status >= 500) return 'The activity service is temporarily unavailable. Try again shortly.';
    return `The activity request failed (HTTP ${status}). Try again shortly.`;
}

export function describeActivityLogsFailure(error: unknown): ActivityLogsFailure {
    if (error instanceof ActivityLogsRequestError) {
        return { message: error.message, requestId: error.requestId };
    }
    return {
        message: 'Platform Activity could not be loaded. Try again shortly.',
    };
}

export function partialActivityMessage(sources: string[] = []): string {
    const labels: Record<string, string> = {
        messages: 'SMS messages',
        sms_logs: 'SMS delivery logs',
        sender_id_requests: 'sender requests',
        credit_transactions: 'credit activity',
    };
    const failed = sources.map(source => labels[source]).filter(Boolean);
    return failed.length
        ? `${failed.join(', ')} could not be loaded. These results may be incomplete.`
        : 'Some activity sources could not be loaded. These results may be incomplete.';
}
