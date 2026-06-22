import { devLog } from '../utils/devLog';
import React, { useEffect, useMemo, useState } from "react";
import { FiMessageSquare } from "react-icons/fi";
import { fetchAccountProfile, getCachedAccountProfile, type AccountProfile } from "../api/account";
import { useLocationId } from "../context/LocationContext";
import { useUserProfileContext } from "../context/UserProfileContext";
import { safeStorage } from "../utils/safeStorage";
import { getAccountSettings } from "../utils/settingsStorage";

const formatPhoneForForm = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
    if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
    if (/^639\d{9}$/.test(digits)) return `+${digits}`;
    return value || '';
};

const asString = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (value === null || value === undefined) return "";
    return String(value).trim();
};

const readStoredProfile = (): Record<string, unknown> => {
    const keys = ["nola_auth_user", "nola_user"];
    for (const key of keys) {
        try {
            const parsed = JSON.parse(safeStorage.getItem(key) || "null");
            if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
        } catch {
            // Ignore invalid cache entries.
        }
    }
    return {};
};

export const TicketsTab: React.FC = () => {
    const { locationId } = useLocationId();
    const liveProfile = useUserProfileContext();
    const resolvedLocationId = locationId || getAccountSettings().ghlLocationId || safeStorage.getItem('nola_location_id') || '';
    const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(() =>
        getCachedAccountProfile(resolvedLocationId, { includeAuth: false, allowExpired: true }) ||
        getCachedAccountProfile(resolvedLocationId, { includeAuth: true, allowExpired: true })
    );

    useEffect(() => {
        if (!resolvedLocationId) return;

        let cancelled = false;
        const cached =
            getCachedAccountProfile(resolvedLocationId, { includeAuth: false, allowExpired: true }) ||
            getCachedAccountProfile(resolvedLocationId, { includeAuth: true, allowExpired: true });
        if (cached) {
            Promise.resolve().then(() => {
                if (!cancelled) setAccountProfile(cached);
            });
        }
        fetchAccountProfile(resolvedLocationId, {
            includeAuth: false,
            forceRefresh: true,
            allowStaleOnError: true,
        }).then((profile) => {
            if (!cancelled && profile) setAccountProfile(profile);
        });

        return () => {
            cancelled = true;
        };
    }, [resolvedLocationId]);

    // Update with your GHL Form URL if needed
    const BASE_URL = "https://api.nolacrm.io/widget/form/Nt1MWKmO93qOlvJWzZzk"; 

    // Generate the dynamic URL with pre-fill parameters
    const SUPPORT_FUNNEL_URL = useMemo(() => {
        try {
            const params = new URLSearchParams();
            const storedProfile = readStoredProfile();
            const userProfile: Record<string, unknown> = {
                ...storedProfile,
                ...(liveProfile || {}),
                ...(accountProfile || {}),
            };

            const fullName =
                asString(userProfile.full_name) ||
                asString(userProfile.name) ||
                [asString(userProfile.firstName), asString(userProfile.lastName)].filter(Boolean).join(' ').trim();
            const firstName = asString(userProfile.firstName) || fullName.split(' ')[0] || '';
            const lastName = asString(userProfile.lastName) || fullName.split(' ').slice(1).join(' ');
            const email = asString(userProfile.email) || asString(userProfile.email_address);
            const resolvedPhone = formatPhoneForForm(asString(userProfile.phone) || asString(userProfile.phone_number));
            const formLocationId =
                resolvedLocationId ||
                asString(userProfile.location_id) ||
                asString(userProfile.active_location_id);
            
            if (fullName) {
                params.set('name', fullName);
                params.set('full_name', fullName);
                params.set('contact_name', fullName);
            }
            if (firstName) params.set('first_name', firstName);
            if (lastName) params.set('last_name', lastName);
            if (email) {
                params.set('email', email);
                params.set('contact_email', email);
            }
            if (resolvedPhone) {
                params.set('phone', resolvedPhone);
                params.set('contact_phone', resolvedPhone);
            }
            if (formLocationId) {
                params.set('location_id', formLocationId);
                params.set('locationId', formLocationId);
                params.set('ghl_location_id', formLocationId);
                params.set('app_location_id', formLocationId);
            }

            const queryString = params.toString();
            return queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
        } catch (err) {
            devLog.error("Failed to generate support funnel URL:", err);
            return BASE_URL;
        }
    }, [accountProfile, liveProfile, resolvedLocationId]);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#f3f4f6] dark:bg-[#09090b]">
            {/* Page Header */}
            <div className="flex-shrink-0 border-b border-[#e5e5e5] bg-white/85 dark:border-white/10 dark:bg-[#151618]/85">
                <div className="max-w-5xl mx-auto px-4 py-5 md:px-6">
                    <div className="flex items-center gap-3 pr-12">
                        <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.08] flex items-center justify-center text-[#111111] dark:text-white">
                            <FiMessageSquare className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-[22px] font-extrabold text-[#111111] dark:text-white tracking-tight">Support Tickets</h1>
                            <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1">Submit your support requests here</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto px-4 pb-4 pt-5 md:px-6 md:pb-6 md:pt-6 lg:px-8 lg:pb-8 lg:pt-6">
                <div className="max-w-5xl mx-auto min-h-[1500px] flex flex-col">
                    <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] shadow-sm relative group">
                        <iframe
                            src={SUPPORT_FUNNEL_URL}
                            style={{ width: '100%', height: '1500px', border: 'none', borderRadius: '8px' }}
                            id="inline-Nt1MWKmO93qOlvJWzZzk" 
                            data-layout="{'id':'INLINE'}"
                            data-trigger-type="alwaysShow"
                            data-trigger-value=""
                            data-activation-type="alwaysActivated"
                            data-activation-value=""
                            data-deactivation-type="neverDeactivate"
                            data-deactivation-value=""
                            data-form-name="Ticket Form"
                            data-height="1500"
                            data-layout-iframe-id="inline-Nt1MWKmO93qOlvJWzZzk"
                            data-form-id="Nt1MWKmO93qOlvJWzZzk"
                            className="w-full h-[1500px]"
                            title="Ticket Form"
                            allow="camera; microphone; clipboard-read; clipboard-write; display-capture"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
