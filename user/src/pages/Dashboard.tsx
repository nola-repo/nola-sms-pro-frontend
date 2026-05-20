import { safeStorage } from '../utils/safeStorage';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Contact } from "../types/Contact";
import type { BulkMessageHistoryItem } from "../types/Sms";
import { Sidebar } from "../components/Sidebar";
import type { ViewTab } from "../components/Sidebar";
import { Composer } from "../components/Composer";
import { ContactsTab } from "../components/ContactsTab";
import { TemplatesTab } from "../components/TemplatesTab";
import { Settings } from "./Settings";
import { FiAlertCircle, FiArrowRight, FiCheckCircle, FiMenu, FiRefreshCw, FiSettings } from "react-icons/fi";
import { Home } from "../components/Home";
import { TicketsTab } from "../components/TicketsTab";
import { useOnboarding } from "../components/onboarding/useOnboarding";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { useLocationId } from "../context/LocationContext";
import { GHL_BACKEND_ONBOARDING_URL, GHL_MARKETPLACE_CONNECT_URL, GHL_RECONNECT_REQUIRED_STORAGE_KEY } from "../config";
import { fetchAccountProfile, type AccountProfile } from "../api/account";
import faviconLogo from "../assets/FAV ICON - NOLA SMS PRO.png";

interface DashboardProps {
  isMobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  darkMode?: boolean;
  toggleDarkMode?: () => void;
  initialView?: ViewTab;
}

type RegistrationCheckState =
  | { status: 'idle' | 'checking' | 'registered' }
  | { status: 'required'; profile: AccountProfile }
  | { status: 'error'; message: string };

const buildBackendOnboardingUrl = (locationId: string): string => {
  const state = encodeURIComponent(JSON.stringify({ selected_location_id: locationId }));
  return `${GHL_BACKEND_ONBOARDING_URL}&state=${state}`;
};

const RegistrationRequiredState: React.FC<{
  locationId: string;
  profile: AccountProfile;
  onRetry: () => void;
}> = ({ locationId, profile, onRetry }) => {
  const locationName = profile.location_name && profile.location_name !== 'Unknown'
    ? profile.location_name
    : 'this subaccount';

  return (
    <div className="min-h-screen bg-[#f7f7f7] dark:bg-[#18191d] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-5">
          <FiAlertCircle className="w-6 h-6" />
        </div>

        <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight text-[#111111] dark:text-white mb-3">
          Registration required
        </h1>
        <p className="text-[14px] leading-6 text-[#5f6368] dark:text-[#b6bac2] mb-5">
          {locationName} is not linked to a registered NOLA user yet. Complete onboarding before using messages, contacts, templates, or billing tools.
        </p>

        <div className="rounded-xl border border-[#e5e5e5] dark:border-white/10 bg-[#fafafa] dark:bg-white/[0.03] px-4 py-3 mb-6">
          <div className="text-[11px] font-bold uppercase text-[#8a8f98] dark:text-[#8f949e] mb-1">GHL Location ID</div>
          <div className="font-mono text-[13px] text-[#111111] dark:text-white break-all">{locationId}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
            <FiAlertCircle className="w-3.5 h-3.5" />
            {profile.registration_status === 'not_installed' ? 'Not installed' : 'Not registered'}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => { window.location.href = buildBackendOnboardingUrl(locationId); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#1d6bd4] to-[#2b83fa] text-white text-[13px] font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
          >
            Continue onboarding
            <FiArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#f1f3f4] dark:bg-[#2a2b32] text-[#37352f] dark:text-[#ececf1] text-[13px] font-bold hover:bg-[#e8eaed] dark:hover:bg-[#34363d] transition-all"
          >
            <FiRefreshCw className="w-4 h-4" />
            Recheck
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">
          <FiCheckCircle className="w-4 h-4 text-emerald-500" />
          Already completed registration in another tab? Recheck to return to the app.
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ isMobileMenuOpen: externalIsMobileMenuOpen, onMobileMenuToggle, darkMode, toggleDarkMode, initialView }) => {
  const navigate = useNavigate();
  const onboarding = useOnboarding();
  // Reactive location ID from context — re-renders whenever subaccount changes
  const { locationId } = useLocationId();
  const [registrationCheck, setRegistrationCheck] = useState<RegistrationCheckState>(() => {
    if (locationId) {
      try {
        const isCached = safeStorage.getItem('nola_registered_location_' + locationId) === 'true';
        if (isCached) return { status: 'registered' };
      } catch { /* ignore */ }
    }
    return { status: 'idle' };
  });
  const [lottieError, setLottieError] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(() => {
    try {
      const saved = safeStorage.getItem('nola_active_contact');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [activeBulkMessage, setActiveBulkMessage] = useState<BulkMessageHistoryItem | null>(() => {
    try {
      const saved = safeStorage.getItem('nola_active_bulk_message');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>(() => {
    try {
      const saved = safeStorage.getItem('nola_active_contact');
      const contact = saved ? JSON.parse(saved) : null;
      return contact ? [contact] : [];
    } catch { return []; }
  });
  // initialView from the router takes priority; fall back to persisted storage
  const [currentView, setCurrentView] = useState<ViewTab>(
    () => initialView || (safeStorage.getItem('nola_active_tab') as ViewTab) || 'home'
  );
  const [settingsTab, setSettingsTab] = useState<"account" | "senderIds" | "notifications" | "credits" | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [settingsOpen] = useState(false);
  const [autoOpenAddContact, setAutoOpenAddContact] = useState(false);

  const isMobileMenuOpen = externalIsMobileMenuOpen !== undefined ? externalIsMobileMenuOpen : false;

  const checkRegistration = async () => {
    if (!locationId) {
      setRegistrationCheck({ status: 'idle' });
      return;
    }

    setRegistrationCheck({ status: 'checking' });
    try {
      const profile = await fetchAccountProfile(locationId, { includeAuth: false });
      if (!profile) {
        setRegistrationCheck({ status: 'error', message: 'Unable to verify this subaccount right now.' });
        return;
      }

      if (profile.is_registered === false || (!!profile.registration_status && profile.registration_status !== 'registered')) {
        setRegistrationCheck({ status: 'required', profile });
        return;
      }

      setRegistrationCheck({ status: 'registered' });
    } catch (error) {
      console.error('[Dashboard] Registration check failed', error);
      setRegistrationCheck({ status: 'error', message: 'Unable to verify this subaccount right now.' });
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContacts([contact]);
    setActiveContact(contact);
    setActiveBulkMessage(null);
    safeStorage.setItem('nola_active_contact', JSON.stringify(contact));
    safeStorage.removeItem('nola_active_bulk_message');
    setCurrentView('compose');
    safeStorage.setItem('nola_active_tab', 'compose');
  };

  const handleSelectBulkMessage = (bulkMessage: BulkMessageHistoryItem) => {
    setSelectedContacts([]);
    setActiveContact(null);
    setActiveBulkMessage(bulkMessage);
    safeStorage.removeItem('nola_active_contact');
    safeStorage.setItem('nola_active_bulk_message', JSON.stringify(bulkMessage));
    setCurrentView('compose');
    safeStorage.setItem('nola_active_tab', 'compose');
  };

  const handleSendToComposer = (contacts: Contact[]) => {
    setSelectedContacts(contacts);
    if (contacts.length === 1) {
      setActiveContact(contacts[0]);
      safeStorage.setItem('nola_active_contact', JSON.stringify(contacts[0]));
    } else {
      setActiveContact(null);
      safeStorage.removeItem('nola_active_contact');
    }
    setCurrentView('compose');
    safeStorage.setItem('nola_active_tab', 'compose');
  };

  const handleViewMessages = (contact: Contact) => {
    setActiveContact(contact);
    setSelectedContacts([contact]);
    setActiveBulkMessage(null);
    safeStorage.setItem('nola_active_contact', JSON.stringify(contact));
    safeStorage.removeItem('nola_active_bulk_message');
    setCurrentView('compose');
    safeStorage.setItem('nola_active_tab', 'compose');
  };

  const handleTabChange = (tab: ViewTab) => {
    setCurrentView(tab);
    safeStorage.setItem('nola_active_tab', tab);

    // Sync to URL so the browser history and address bar stay up to date
    const urlMap: Record<ViewTab, string> = {
      home: '/',
      compose: '/compose',
      contacts: '/contacts',
      settings: '/settings',
      templates: '/templates',
      tickets: '/tickets',
    };
    const search = window.location.search;
    navigate({ pathname: urlMap[tab] ?? '/', search }, { replace: false });

    // Clear selection for ALL tab changes to ensure Sidebar highlights are removed
    setSelectedContacts([]);
    setActiveContact(null);
    setActiveBulkMessage(null);
    safeStorage.removeItem('nola_active_contact');
    safeStorage.removeItem('nola_active_bulk_message');

    // On mobile, close sidebar when selecting any tab
    if (window.innerWidth < 768 && onMobileMenuToggle) {
      onMobileMenuToggle();
    }
  };

  const handleCreateContactShortcut = () => {
    setAutoOpenAddContact(true);
    setCurrentView('contacts');
    safeStorage.setItem('nola_active_tab', 'contacts');
    navigate({ pathname: '/contacts', search: window.location.search }, { replace: false });

    setSelectedContacts([]);
    setActiveContact(null);
    setActiveBulkMessage(null);
    safeStorage.removeItem('nola_active_contact');
    safeStorage.removeItem('nola_active_bulk_message');
  };

  const toggleMobileMenu = () => {
    if (onMobileMenuToggle) {
      onMobileMenuToggle();
    }
  };

  const toggleCollapse = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!locationId) {
        if (!cancelled) setRegistrationCheck({ status: 'idle' });
        return;
      }

      // Check if already cached as registered
      const isCached = safeStorage.getItem('nola_registered_location_' + locationId) === 'true';
      if (!isCached) {
        if (!cancelled) setRegistrationCheck({ status: 'checking' });
      } else {
        // If cached, immediately ensure it is in the registered state to avoid any screen flashing
        if (!cancelled) setRegistrationCheck({ status: 'registered' });
      }

      try {
        const profile = await fetchAccountProfile(locationId, { includeAuth: false });
        if (cancelled) return;

        if (!profile) {
          safeStorage.removeItem('nola_registered_location_' + locationId);
          setRegistrationCheck({ status: 'error', message: 'Unable to verify this subaccount right now.' });
          return;
        }

        if (profile.is_registered === false || (!!profile.registration_status && profile.registration_status !== 'registered')) {
          safeStorage.removeItem('nola_registered_location_' + locationId);
          setRegistrationCheck({ status: 'required', profile });
          return;
        }

        safeStorage.setItem('nola_registered_location_' + locationId, 'true');
        setRegistrationCheck({ status: 'registered' });
      } catch (error) {
        if (cancelled) return;
        console.error('[Dashboard] Registration check failed', error);
        if (!isCached) {
          setRegistrationCheck({ status: 'error', message: 'Unable to verify this subaccount right now.' });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  // Handle navigation to settings tabs from CreditBadge
  useEffect(() => {
    const handleNavigateToSettings = (e: CustomEvent) => {
      const tab = e.detail?.tab;
      if (e.detail?.reconnect) {
        safeStorage.setItem(GHL_RECONNECT_REQUIRED_STORAGE_KEY, 'true');
      }
      if (tab) {
        setSettingsTab(tab);
        setCurrentView('settings');
        safeStorage.setItem('nola_active_tab', 'settings');
      }
    };

    window.addEventListener('navigate-to-settings', handleNavigateToSettings as EventListener);
    return () => {
      window.removeEventListener('navigate-to-settings', handleNavigateToSettings as EventListener);
    };
  }, []);

  // When the GHL location / subaccount changes, auto-reset to Home and clear
  // any active selections so the UI always starts fresh for that account.
  useEffect(() => {
    const handleLocationChanged = () => {
      setCurrentView('home');
      safeStorage.setItem('nola_active_tab', 'home');

      setSelectedContacts([]);
      setActiveContact(null);
      setActiveBulkMessage(null);
      safeStorage.removeItem('nola_active_contact');
      safeStorage.removeItem('nola_active_bulk_message');
    };

    window.addEventListener('ghl-location-changed', handleLocationChanged);
    return () => {
      window.removeEventListener('ghl-location-changed', handleLocationChanged);
    };
  }, []);

  if (locationId && registrationCheck.status === 'checking') {
    return (
      <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#09090b] flex items-center justify-center px-4 relative overflow-hidden">
        {/* Soft atmospheric glow circles */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#2b83fa]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm flex flex-col items-center p-8 rounded-[2rem] bg-white/80 dark:bg-[#151618]/80 backdrop-blur-xl border border-white/50 dark:border-white/5 shadow-2xl text-center">
          {!lottieError ? (
            <DotLottieReact
              src="https://lottie.host/8bff6661-62db-4473-adb8-7eced34f3649/mii3gOOlir.lottie"
              loop
              autoplay
              className="w-32 h-32 mb-4 drop-shadow-xl"
              onError={() => setLottieError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-500 mb-6 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
          <h2 className="text-[17px] font-black tracking-tight text-[#111111] dark:text-white mb-1">
            Setting up your space
          </h2>
          <p className="text-[12.5px] font-medium text-gray-500 dark:text-[#b6bac2] mb-6">
            Getting your workspace ready...
          </p>
          <div className="w-full bg-[#f1f3f4] dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#2b83fa] to-purple-500 rounded-full animate-[shimmer_1.5s_infinite_linear]" style={{ width: "50%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (locationId && registrationCheck.status === 'required') {
    return (
      <RegistrationRequiredState
        locationId={locationId}
        profile={registrationCheck.profile}
        onRetry={checkRegistration}
      />
    );
  }

  if (locationId && registrationCheck.status === 'error') {
    return (
      <div className="min-h-screen bg-[#f7f7f7] dark:bg-[#18191d] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl shadow-xl p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-[20px] font-black tracking-tight text-[#111111] dark:text-white mb-2">Could not verify registration</h1>
          <p className="text-[13px] leading-6 text-[#5f6368] dark:text-[#b6bac2] mb-5">{registrationCheck.message}</p>
          <button
            onClick={checkRegistration}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#f1f3f4] dark:bg-[#2a2b32] text-[#37352f] dark:text-[#ececf1] text-[13px] font-bold hover:bg-[#e8eaed] dark:hover:bg-[#34363d] transition-all"
          >
            <FiRefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 bg-[#ffffff] dark:bg-[#202123] overflow-hidden">
      {/* Sidebar - Left */}
      <div className={`
        fixed inset-y-0 left-0 z-[100] md:relative md:z-50 h-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isMobileMenuOpen ? 'w-80 translate-x-0 shadow-2xl opacity-100 visible' : 'w-0 -translate-x-full md:w-auto md:translate-x-0 opacity-0 md:opacity-100 invisible md:visible pointer-events-none md:pointer-events-auto'}
        overflow-visible md:shadow-none
      `}>
        <div className={`h-full transition-all duration-300 z-[60] ${isSidebarCollapsed ? 'md:w-20' : 'md:w-80 w-80'}`}>
          <Sidebar
            activeTab={currentView}
            onTabChange={handleTabChange}
            onSelectContact={handleSelectContact}
            activeContactId={activeContact?.id}
            activeBulkMessageId={activeBulkMessage?.id}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleCollapse}
            onSelectBulkMessage={handleSelectBulkMessage}
            onCloseMobile={toggleMobileMenu}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#f7f7f7] dark:bg-[#18191d]">
        {/* Mobile Header with Sidebar Toggle */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-[#0000000a] dark:border-[#ffffff0a] bg-white/80 dark:bg-[#121415]/80 backdrop-blur-lg sticky top-0 z-30">
          <button
            onClick={toggleMobileMenu}
            className="p-2 -ml-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[#3c4043] dark:text-[#e8eaed] transition-all active:scale-90"
            aria-label="Open Menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#1a1b1e] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center shadow-sm overflow-hidden">
              <img src={faviconLogo} alt="NOLA SMS PRO" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-bold text-[15px] text-[#111111] dark:text-white tracking-tight">NOLA SMS Pro</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleTabChange('settings')}
              className="p-2 rounded-lg hover:bg-[#f7f7f7] dark:hover:bg-[#2a2b32] text-[#37352f] dark:text-[#ececf1] transition-colors settings-icon-rotate"
              aria-label="Settings"
            >
              <FiSettings className="h-5 w-5" strokeWidth={1.5} />
            </button>
            {toggleDarkMode && (
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-[#f7f7f7] dark:hover:bg-[#2a2b32] text-[#37352f] dark:text-[#ececf1] transition-colors"
                aria-label="Toggle theme"
              >
                {darkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Missing Location Alert */}
        {window.self === window.top && !locationId && currentView !== 'settings' && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/20 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[13px] text-amber-800 dark:text-amber-300 font-medium">
                <strong>GHL Location Not Detected.</strong> Please open the app via the GoHighLevel sidebar, connect your account, or enter manually in Settings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.location.href = GHL_MARKETPLACE_CONNECT_URL}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#1d6bd4] to-[#2b83fa] text-white text-[12px] font-bold shadow-md hover:shadow-lg transition-all"
              >
                Connect GHL
              </button>
              <button 
                onClick={() => handleTabChange('settings')} 
                className="px-4 py-1.5 rounded-lg bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 text-[12px] font-bold shadow-sm hover:bg-amber-300 dark:hover:bg-amber-700/50 transition-all"
              >
                Type Location ID
              </button>
            </div>
          </div>
        )}

        {/* Content Router */}
        <div key={locationId || 'default'} className="flex-1 min-h-0 overflow-hidden">
          {currentView === 'home' ? (
            <Home
              onTabChange={handleTabChange}
              onCreateContact={handleCreateContactShortcut}
              onSelectContact={handleSelectContact}
              onSelectBulkMessage={handleSelectBulkMessage}
            />
          ) : currentView === 'compose' ? (
            <Composer
              selectedContacts={selectedContacts}
              activeContact={activeContact}
              activeBulkMessage={activeBulkMessage}
              onSelectContact={handleSelectContact}
              onSelectBulkMessage={handleSelectBulkMessage}
              onToggleMobileMenu={toggleMobileMenu}
            />
          ) : currentView === 'contacts' ? (
            <ContactsTab
              onSendToComposer={handleSendToComposer}
              onViewMessages={handleViewMessages}
              autoOpenAddModal={autoOpenAddContact}
              onAutoOpenAddModalHandled={() => setAutoOpenAddContact(false)}
            />
          ) : currentView === 'settings' || settingsOpen ? (
            <Settings
              darkMode={darkMode ?? false}
              toggleDarkMode={toggleDarkMode ?? (() => { })}
              initialTab={settingsOpen ? "senderIds" : settingsTab || undefined}
              autoOpenAddModal={settingsOpen}
            />
          ) : currentView === 'templates' ? (
            <TemplatesTab />
          ) : currentView === 'tickets' ? (
            <TicketsTab />
          ) : null}
        </div>
      </div>

      {/* Mobile Overlay */}
      {
        isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] md:hidden transition-all duration-300 pointer-events-auto"
            onClick={toggleMobileMenu}
          />
        )
      }

      {/* Onboarding Modal */}
      <OnboardingModal onboarding={onboarding} />
    </div>
  );
};
