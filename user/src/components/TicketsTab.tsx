import React from "react";
import { FiMessageSquare } from "react-icons/fi";
import { useLocationId } from "../context/LocationContext";

export const TicketsTab: React.FC = () => {
    const { locationId } = useLocationId();
    
    // DEVELOPER NOTE: Replace the base URL below with your actual GHL Funnel URL
    const BASE_URL = "https://api.nolacrm.io/widget/form/Nt1MWKmO93qOlvJWzZzk"; 

    // Generate the dynamic URL with pre-fill parameters
    const getFunnelUrl = () => {
        try {
            const stored = localStorage.getItem('nola_user');
            const profile = stored ? JSON.parse(stored) : {};
            const params = new URLSearchParams();
            
            // Map profile fields to standard GHL auto-fill parameters
            if (profile.firstName || profile.lastName) {
                const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
                params.set('name', fullName);
            }
            if (profile.email) params.set('email', profile.email);
            if (profile.phone) params.set('phone', profile.phone);
            if (locationId) params.set('location_id', locationId);

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
                <div className="max-w-5xl mx-auto h-full min-h-[750px] flex flex-col">
                    <div className="flex-1 overflow-hidden rounded-2xl border border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] shadow-sm relative group">
                        <iframe
                            src={SUPPORT_FUNNEL_URL}
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
                            id="inline-Nt1MWKmO93qOlvJWzZzk" 
                            data-layout="{'id':'INLINE'}"
                            data-trigger-type="alwaysShow"
                            data-trigger-value=""
                            data-activation-type="alwaysActivated"
                            data-activation-value=""
                            data-deactivation-type="neverDeactivate"
                            data-deactivation-value=""
                            data-form-name="Ticket Form"
                            data-height="1057"
                            data-layout-iframe-id="inline-Nt1MWKmO93qOlvJWzZzk"
                            data-form-id="Nt1MWKmO93qOlvJWzZzk"
                            className="w-full h-full min-h-[1057px]"
                            title="Ticket Form"
                            allow="camera; microphone; clipboard-read; clipboard-write; display-capture"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
