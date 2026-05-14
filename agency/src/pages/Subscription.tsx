import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiCheck, FiRefreshCw, FiZap, FiAlertTriangle, FiStar, FiShield, FiTrendingUp } from 'react-icons/fi';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { useToast } from '../hooks/useToast.ts';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';

// ─── Constants ────────────────────────────────────────────────────────────────
const AGENCY_ID = 'O0YXPGWM9ep2l37dgxAo';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://smspro-api.nolacrm.io';
const WEBHOOK_SECRET = import.meta.env.VITE_WEBHOOK_SECRET || 'f7RkQ2pL9zV3tX8cB1nS4yW6';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubscriptionState {
  plan: 'starter' | 'growth' | 'agency' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  subaccount_limit: number;
  subaccounts_used: number;
  expires_at: string | null;
}

interface PlanInfo {
  id: 'starter' | 'growth' | 'agency' | 'enterprise';
  name: string;
  description: string;
  price_monthly: number;
  subaccount_limit: number;
  icon: React.ReactNode;
  features: string[];
  color: string;
  checkout_link?: string;
}

const PLAN_CATALOG: PlanInfo[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for trying out the platform.',
    price_monthly: 0,
    subaccount_limit: 1,
    icon: <FiStar className="w-5 h-5" />,
    features: [
      '1 Subaccount Limit',
      'Core SMS Sending',
      'Manual Credit Top-ups',
      'Standard Support'
    ],
    color: 'text-gray-500 bg-gray-500/10 border-gray-500/20'
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses with multiple locations.',
    price_monthly: 1499,
    subaccount_limit: 5,
    icon: <FiTrendingUp className="w-5 h-5" />,
    features: [
      '5 Subaccounts Limit',
      'Everything in Starter',
      'Auto-recharge Workflows',
      'Subaccount Credit Requests',
      'Full Transaction History'
    ],
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    checkout_link: 'https://nolasmspro.com/growth-plan-page'
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Ideal for established marketing agencies.',
    price_monthly: 3499,
    subaccount_limit: 25,
    icon: <FiZap className="w-5 h-5" />,
    features: [
      '25 Subaccounts Limit',
      'Everything in Growth',
      'Master Wallet Lock',
      'Bulk Credit Gifting',
      'Advanced Usage Analytics',
      'Priority Slack Support'
    ],
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    checkout_link: 'https://nolasmspro.com/agency-plan-page'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited scale and premium white-glove service.',
    price_monthly: 7999,
    subaccount_limit: -1,
    icon: <FiShield className="w-5 h-5" />,
    features: [
      'Unlimited Subaccounts',
      'Everything in Agency',
      'Dedicated Account Manager',
      'White-label Dashboard',
      '99.9% SLA Guarantee',
      '24/7 Phone Support',
      'Custom Integrations'
    ],
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    checkout_link: 'https://nolasmspro.com/enterprise-plan-page'
  }
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-white/5 ${className}`} />
);

export const Subscription: React.FC = () => {
  const { agencyId, agencySession } = useAgency();
  const { toasts, showToast, dismissToast } = useToast();
  const mountedRef = useRef(true);

  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveAgencyId = agencyId || AGENCY_ID;
  const userName = agencySession?.user ? `${agencySession.user.firstName} ${agencySession.user.lastName}`.trim() : '';
  const userEmail = agencySession?.user?.email || '';

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/subscription.php?agency_id=${effectiveAgencyId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('agency_token') || sessionStorage.getItem('agency_token')}`
        }
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (!mountedRef.current) return;
      setSubState(data);
    } catch {
      if (!mountedRef.current) return;
      // Mock data if endpoint is not fully implemented yet
      setSubState({
        plan: 'starter',
        status: 'active',
        subaccount_limit: 1,
        subaccounts_used: 0,
        expires_at: null
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [effectiveAgencyId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSubscription();
    return () => {
      mountedRef.current = false;
      if (popupPollRef.current) clearInterval(popupPollRef.current);
    };
  }, [fetchSubscription]);

  const handleUpgrade = (planId: string) => {
    if (planId === 'starter') return; // Cannot explicitly buy starter

    const plan = PLAN_CATALOG.find(p => p.id === planId);
    if (!plan || !plan.checkout_link) return;

    const separator = plan.checkout_link.includes('?') ? '&' : '?';
    const checkoutUrl = `${plan.checkout_link}${separator}agency_id=${encodeURIComponent(effectiveAgencyId)}&name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}`;

    const width = 600, height = 850;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const popup = window.open(
      checkoutUrl,
      'SubscriptionCheckout',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      alert("Popup blocked! Please allow popups for this site.");
      return;
    }

    if (popupPollRef.current) clearInterval(popupPollRef.current);

    popupPollRef.current = setInterval(() => {
      try {
        if (popup && popup.closed) {
          if (popupPollRef.current) clearInterval(popupPollRef.current);
          showToast('Checkout window closed. Refreshing subscription...', 'info');
          fetchSubscription();
        }
      } catch (e) {
        // Handle cross-origin errors if necessary
      }
    }, 500);
  };

  const getLimitText = (limit: number) => limit === -1 ? 'Unlimited' : limit.toString();
  const getUsagePercentage = () => {
    if (!subState || subState.subaccount_limit === -1) return 0;
    return Math.min(100, (subState.subaccounts_used / subState.subaccount_limit) * 100);
  };

  return (
    <AgencyLayout title="Subscription" subtitle="Manage your agency subscription plan and subaccount limits">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="space-y-6">
        {/* Current Plan Banner */}
        <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9] uppercase tracking-wider mb-2">Current Plan</div>
              {loading || !subState ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[32px] font-black leading-none tracking-tight text-[#111111] dark:text-white capitalize">
                    {subState.plan} Plan
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    subState.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                    subState.status === 'past_due' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {subState.status}
                  </span>
                </div>
              )}
            </div>
            <button onClick={fetchSubscription} title="Refresh" className="p-2 rounded-xl bg-[#f7f7f7] dark:bg-white/5 border border-[#e0e0e0] dark:border-white/5 text-[#6e6e73] hover:text-[#111111] dark:hover:text-white transition-all">
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Usage Bar */}
          {!loading && subState && (
            <div className="mt-5 w-full">
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#111111] dark:text-white mb-2.5">
                <span className="tracking-wide">Subaccounts Used</span>
                <span className="text-[#6e6e73] dark:text-[#9aa0a9]"><strong className="text-[#111111] dark:text-white">{subState.subaccounts_used}</strong> / {getLimitText(subState.subaccount_limit)}</span>
              </div>
              <div className="h-2.5 w-full bg-[#f0f0f0] dark:bg-[#1f2125] rounded-full overflow-hidden shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getUsagePercentage() >= 100 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-[#2b83fa] to-[#60a5fa]'}`}
                  style={{ width: `${getUsagePercentage()}%` }}
                />
              </div>
              {subState.subaccount_limit !== -1 && subState.subaccounts_used >= subState.subaccount_limit && (
                <div className="flex items-center gap-2 mt-2 text-[12px] text-red-500 font-semibold">
                  <FiAlertTriangle className="w-3.5 h-3.5" /> Limit reached. Please upgrade to add more subaccounts.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = subState?.plan === plan.id;
            return (
              <div 
                key={plan.id}
                className={`relative flex flex-col bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl rounded-2xl p-6 transition-all duration-300 group ${
                  isCurrent 
                    ? 'border-2 border-[#111111] dark:border-white shadow-md' 
                    : 'border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] hover:border-[#111111]/20 dark:hover:border-white/20 hover:shadow-md hover:-translate-y-1'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[10px] font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-sm">
                    Current Plan
                  </div>
                )}
                
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${plan.color}`}>
                  {plan.icon}
                </div>
                
                <h3 className="text-[17px] font-bold text-[#111111] dark:text-white mb-1.5">{plan.name}</h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#9aa0a9] mb-4 min-h-[38px] leading-relaxed">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-[26px] font-bold text-[#111111] dark:text-white">₱{plan.price_monthly.toLocaleString()}</span>
                  <span className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a9]">/mo</span>
                </div>

                <div className="flex-1">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-[#6e6e73] dark:text-[#9aa0a9]">
                        <FiCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || plan.id === 'starter'}
                  className={`w-full py-2.5 rounded-xl text-[13px] font-semibold tracking-wide transition-all duration-300 active:scale-[0.98] ${
                    isCurrent 
                      ? 'bg-[#f0f2f8] dark:bg-[#1a1c20] text-[#9aa0a6] cursor-not-allowed border border-[#e5e5e5] dark:border-white/5'
                      : plan.id === 'starter'
                        ? 'hidden'
                        : 'bg-[#111111] dark:bg-white hover:bg-[#333333] dark:hover:bg-[#e5e5e5] text-white dark:text-[#111111] shadow-md border border-transparent'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : plan.id === 'starter' ? 'Default' : 'Choose Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AgencyLayout>
  );
};
