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
        <div className="h-full flex flex-col overflow-hidden bg-[#f7f7f7] dark:bg-[#111111]">
            {/* Page Header */}
            <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e]/80 backdrop-blur-xl flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2b83fa]/10 flex items-center justify-center text-[#2b83fa]">
                        <FiMessageSquare className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-[#111111] dark:text-white">Support Tickets</h1>
                        <p className="text-[11px] text-[#9aa0a6]">Submit and track your support requests</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-3xl mx-auto h-full min-h-[750px] flex flex-col">
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
