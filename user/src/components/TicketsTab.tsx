import React from "react";
import { FiMessageSquare } from "react-icons/fi";
import { useLocationId } from "../context/LocationContext";
import { safeStorage } from "../utils/safeStorage";

const getCachedProfile = () => {
    try {
        const authProfile = JSON.parse(safeStorage.getItem('nola_auth_user') || 'null');
        const userProfile = JSON.parse(safeStorage.getItem('nola_user') || 'null');
        return { ...(userProfile || {}), ...(authProfile || {}) };
    } catch {
        return {};
    }
};

const formatPhoneForForm = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
    if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
    if (/^639\d{9}$/.test(digits)) return `+${digits}`;
    return value || '';
};

export const TicketsTab: React.FC = () => {
    const { locationId } = useLocationId();
    
    // DEVELOPER NOTE: Replace the base URL below with your actual GHL Funnel URL
    const BASE_URL = "https://api.nolacrm.io/widget/form/Nt1MWKmO93qOlvJWzZzk"; 

    // Generate the dynamic URL with pre-fill parameters
    const getFunnelUrl = () => {
        try {
            const profile = getCachedProfile();
            const params = new URLSearchParams();
            const fullName =
                profile.full_name ||
                profile.name ||
                [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
            const firstName = profile.firstName || fullName.split(' ')[0] || '';
            const lastName = profile.lastName || fullName.split(' ').slice(1).join(' ');
            const resolvedPhone = formatPhoneForForm(profile.phone || profile.phone_number);
            const resolvedLocationId =
                locationId ||
                profile.location_id ||
                profile.active_location_id ||
                safeStorage.getItem('nola_location_id') ||
                '';
            
            if (fullName) {
                params.set('name', fullName);
                params.set('full_name', fullName);
            }
            if (firstName) params.set('first_name', firstName);
            if (lastName) params.set('last_name', lastName);
            if (profile.email) params.set('email', profile.email);
            if (resolvedPhone) params.set('phone', resolvedPhone);
            if (resolvedLocationId) {
                params.set('location_id', resolvedLocationId);
                params.set('locationId', resolvedLocationId);
                params.set('ghl_location_id', resolvedLocationId);
                params.set('app_location_id', resolvedLocationId);
            }

            const queryString = params.toString();
            return queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
        } catch (err) {
            console.error("Failed to generate support funnel URL:", err);
            return BASE_URL;
        }
    };

    const SUPPORT_FUNNEL_URL = getFunnelUrl();
    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#f3f4f6] dark:bg-[#09090b]">
            {/* Page Header */}
            <div className="flex-shrink-0 bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] rounded-b-[40px] shadow-[0_18px_45px_rgba(29,107,212,0.24)]">
                <div className="max-w-5xl mx-auto px-3 md:px-6 pt-5 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-md shadow-blue-950/10">
                            <FiMessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-[22px] font-extrabold text-white tracking-tight">Support Tickets</h1>
                            <p className="text-[12px] text-white/75 mt-1">Submit and track your support requests</p>
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
