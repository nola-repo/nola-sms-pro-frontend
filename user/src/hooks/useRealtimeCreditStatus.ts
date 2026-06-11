import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { fetchCreditStatus, type CreditStatus } from "../api/credits";
import { useLocationId } from "../context/LocationContext";
import { auth, db } from "../services/firebaseConfig";

const emptyCreditStatus: CreditStatus = {
    credit_balance: 0,
    free_usage_count: 0,
    free_credits_total: 0,
    currency: "PHP",
};

const CREDIT_REFRESH_INTERVAL_MS = 5000;

const sanitizeLocationId = (locationId: string) =>
    "ghl_" + locationId.replace(/[^a-zA-Z0-9_-]/g, "_");

const cleanPatch = (patch: Partial<CreditStatus>) =>
    Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as Partial<CreditStatus>;

export const useRealtimeCreditStatus = (explicitLocationId?: string | null) => {
    const { locationId: contextLocationId } = useLocationId();
    const locationId = explicitLocationId || contextLocationId || undefined;
    const [status, setStatus] = useState<CreditStatus | null>(null);
    const [loading, setLoading] = useState(() => Boolean(explicitLocationId || contextLocationId));
    const mountedRef = useRef(false);
    const requestSeq = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const mergeStatus = useCallback((patch: Partial<CreditStatus>) => {
        if (!mountedRef.current) return;

        const patchWithoutUndefined = cleanPatch(patch);
        setStatus(prev => ({
            ...emptyCreditStatus,
            ...(prev ?? {}),
            ...patchWithoutUndefined,
        }));
    }, []);

    const refresh = useCallback(async () => {
        const requestId = ++requestSeq.current;

        if (!locationId) {
            if (mountedRef.current) {
                setStatus(null);
                setLoading(false);
            }
            return null;
        }

        if (mountedRef.current) setLoading(true);
        try {
            const result = await fetchCreditStatus(locationId);
            if (result && requestSeq.current === requestId) {
                mergeStatus(result);
            }
            return result;
        } catch (error) {
            console.error("Failed to fetch credit status", error);
            return null;
        } finally {
            if (mountedRef.current && requestSeq.current === requestId) setLoading(false);
        }
    }, [locationId, mergeStatus]);

    useEffect(() => {
        if (!locationId) {
            requestSeq.current += 1;
            setStatus(null);
            setLoading(false);
            return;
        }

        setStatus(null);
        void refresh();

        const userUnsubscribers: Array<() => void> = [];
        let integrationUnsubscribe: (() => void) | null = null;
        let cancelled = false;

        const setupListeners = async () => {
            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
                if (cancelled) return;

                integrationUnsubscribe = onSnapshot(doc(db, "integrations", sanitizeLocationId(locationId)), (snapshot) => {
                    if (!snapshot.exists()) return;
                    const data = snapshot.data();
                    mergeStatus({
                        credit_balance: data.credit_balance !== undefined ? Number(data.credit_balance) : undefined,
                        free_usage_count: data.free_usage_count !== undefined ? Number(data.free_usage_count) : undefined,
                        free_credits_total: data.free_credits_total !== undefined ? Number(data.free_credits_total) : undefined,
                        currency: data.currency ? String(data.currency) : undefined,
                    });
                });

                ["active_location_id", "location_id"].forEach((field) => {
                    const userQuery = query(collection(db, "users"), where(field, "==", locationId));
                    const unsubscribe = onSnapshot(userQuery, (snapshot) => {
                        if (snapshot.empty) return;
                        const userData = snapshot.docs[0].data();
                        mergeStatus({
                            credit_balance: userData.credit_balance !== undefined ? Number(userData.credit_balance) : undefined,
                        });
                    });
                    userUnsubscribers.push(unsubscribe);
                });
            } catch (error) {
                console.error("Firestore balance listener setup failed:", error);
            }
        };

        const refreshFromEvent = () => {
            void refresh();
        };

        void setupListeners();
        window.addEventListener("sms-sent", refreshFromEvent);
        window.addEventListener("bulk-message-sent", refreshFromEvent);
        const pollTimer = window.setInterval(refreshFromEvent, CREDIT_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            userUnsubscribers.forEach(unsubscribe => unsubscribe());
            if (integrationUnsubscribe) integrationUnsubscribe();
            window.clearInterval(pollTimer);
            window.removeEventListener("sms-sent", refreshFromEvent);
            window.removeEventListener("bulk-message-sent", refreshFromEvent);
        };
    }, [locationId, mergeStatus, refresh]);

    return { status, loading, refresh };
};
