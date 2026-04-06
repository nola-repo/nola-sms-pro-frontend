import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiBriefcase, FiUser, FiArrowRight, FiArrowLeft,
  FiCheck, FiEye, FiEyeOff, FiMail, FiPhone,
  FiLock, FiAlertCircle,
} from 'react-icons/fi';
import { register, type RegisterPayload } from '../services/authService';
import defaultLogo from '../assets/NOLA SMS PRO Logo.png';
import GlareHover from '../components/GlareHover';

// ── Types ────────────────────────────────────────────────────────────────────
type Role = 'agency' | 'user';
type Step = 1 | 2 | 3 | 4;

interface RegisterProps {
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

// ── Password strength ─────────────────────────────────────────────────────────
const getStrength = (p: string) => {
  let score = 0;
  if (p.length >= 8)               score++;
  if (/[A-Z]/.test(p))             score++;
  if (/[0-9]/.test(p))             score++;
  if (/[^A-Za-z0-9]/.test(p))     score++;
  return score; // 0–4
};

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];

// ── Input component ───────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}> = ({ label, icon, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[11.5px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-[#9aa0a6]">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0a6] pointer-events-none">
        {icon}
      </span>
      {children}
    </div>
    {error && (
      <p className="flex items-center gap-1 text-[11.5px] text-red-500 font-medium">
        <FiAlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
      </p>
    )}
  </div>
);

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-[#f7f7f7] dark:bg-[#111317] text-[13.5px] text-[#111111] dark:text-white placeholder-[#aaaaaa] dark:placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 focus:border-[#2b83fa] transition-all';

// ── Step indicator ───────────────────────────────────────────────────────────
const StepBar: React.FC<{ step: Step; role: Role | null }> = ({ step, role }) => {
  const steps = role === 'agency'
    ? ['Role', 'Details', 'Connect GHL', 'Done']
    : ['Role', 'Details', 'Done'];
  const total = steps.length;
  const current = role === 'agency' ? step - 1 : step === 4 ? 2 : step - 1;

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1 min-w-[48px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-all duration-300 ${
                done   ? 'bg-[#2b83fa] border-[#2b83fa] text-white' :
                active ? 'bg-white dark:bg-[#1a1b1e] border-[#2b83fa] text-[#2b83fa]' :
                         'bg-transparent border-[#d1d5db] dark:border-[#3a3b3f] text-[#9aa0a6]'
              }`}>
                {done ? <FiCheck className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-[9.5px] font-semibold uppercase tracking-wider leading-tight text-center ${
                active ? 'text-[#2b83fa]' : 'text-[#9aa0a6]'
              }`}>{label}</span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-0.5 mt-[-12px] rounded-full transition-all duration-500 ${
                i < current ? 'bg-[#2b83fa]' : 'bg-[#e5e7eb] dark:bg-[#2a2b32]'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Register: React.FC<RegisterProps> = ({ darkMode, toggleDarkMode }) => {
  const navigate = useNavigate();

  // Step state
  const [step, setStep]   = useState<Step>(1);
  const [role, setRole]   = useState<Role | null>(null);
  const [dir,  setDir]    = useState(1);   // 1 = forward, -1 = backward

  // Form state
  const [form, setForm] = useState({
    firstName: '',
    lastName:  '',
    email:     '',
    phone:     '',
    password:  '',
    confirm:   '',
  });
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [showPw,  setShowPw]    = useState(false);
  const [showCpw, setShowCpw]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Check if we came from agency or user
  const query = new URLSearchParams(window.location.search);
  const originAgency = query.get('from') === 'agency';

  const strength = getStrength(form.password);

  const goTo = (next: Step, forward = true) => {
    setDir(forward ? 1 : -1);
    setStep(next);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim())     e.firstName = 'First name is required.';
    if (!form.lastName.trim())      e.lastName  = 'Last name is required.';
    if (!form.email.trim())         e.email     = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.phone.trim())         e.phone     = 'Phone number is required.';
    if (!form.password)             e.password  = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!form.confirm)              e.confirm   = 'Please confirm your password.';
    else if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep2() || !role) return;
    setLoading(true);
    setApiError(null);
    try {
      const payload: RegisterPayload = {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim().toLowerCase(),
        phone:     form.phone.trim(),
        password:  form.password,
        role,
      };
      await register(payload);
      // For agency → go to GHL connect step (step 3), for user → go to success (step 4)
      if (role === 'agency') {
        goTo(3);
      } else {
        goTo(4);
      }
    } catch (err: any) {
      setApiError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Slide animation variants ───────────────────────────────────────────────
  const variants = {
    enter:   (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center:  { x: 0,  opacity: 1 },
    exit:    (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f7f8fc] dark:bg-[#0a0a0b] px-4 py-10">
      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full blur-[120px] opacity-[0.12] pointer-events-none bg-[#2b83fa]" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-[0.10] pointer-events-none bg-[#7c3aed]" />

      {/* Theme Toggle */}
      {toggleDarkMode && (
        <button
          onClick={toggleDarkMode}
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-white dark:hover:bg-white/10 transition-all z-50"
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

      <div className="relative z-10 w-full max-w-lg">
        {/* Card */}
        <div className="bg-white/80 dark:bg-[#141618]/80 backdrop-blur-2xl border border-white/30 dark:border-white/[0.07] rounded-3xl shadow-2xl shadow-black/10 dark:shadow-black/40 p-8 md:p-10 overflow-hidden">

          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-8 text-center pt-2">
            <img src={defaultLogo} alt="NOLA SMS Pro" className="h-[60px] object-contain mb-3" />
            <div className="text-[11px] font-bold text-[#2b83fa] uppercase tracking-wider bg-[#2b83fa]/10 px-3 py-1 rounded-full">Create Account</div>
          </div>

          {/* Step bar */}
          <StepBar step={step} role={role} />

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >

              {/* ─── Step 1: Choose Role ──────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-[22px] font-extrabold text-[#111111] dark:text-white tracking-tight">
                      Who are you?
                    </h1>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1">
                      Select the account type that best describes you.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Agency card */}
                    <button
                      onClick={() => { setRole('agency'); }}
                      className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
                        role === 'agency'
                          ? 'border-[#2b83fa] bg-[#2b83fa]/5 dark:bg-[#2b83fa]/10'
                          : 'border-[#e5e7eb] dark:border-[#2a2b32] hover:border-[#2b83fa]/50 bg-white dark:bg-[#111317]'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          role === 'agency' ? 'bg-[#2b83fa] text-white' : 'bg-[#f0f4ff] dark:bg-[#1c2333] text-[#2b83fa]'
                        }`}>
                        <FiBriefcase className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[14.5px] font-bold text-[#111111] dark:text-white">
                            Agency Owner
                          </div>
                          <div className="text-[12.5px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 leading-snug">
                            I manage a GoHighLevel company and oversee multiple sub-accounts. I want to control SMS routing and rate limits.
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          role === 'agency' ? 'border-[#2b83fa] bg-[#2b83fa]' : 'border-[#d1d5db] dark:border-[#444]'
                        }`}>
                          {role === 'agency' && <FiCheck className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </button>

                    {/* User card */}
                    <button
                      onClick={() => { setRole('user'); }}
                      className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
                        role === 'user'
                          ? 'border-[#2b83fa] bg-[#2b83fa]/5 dark:bg-[#2b83fa]/10'
                          : 'border-[#e5e7eb] dark:border-[#2a2b32] hover:border-[#2b83fa]/50 bg-white dark:bg-[#111317]'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          role === 'user' ? 'bg-[#2b83fa] text-white' : 'bg-[#f0f4ff] dark:bg-[#1c2333] text-[#2b83fa]'
                        }`}>
                          <FiUser className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[14.5px] font-bold text-[#111111] dark:text-white">
                            Sub-account User
                          </div>
                          <div className="text-[12.5px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 leading-snug">
                            I'm part of a specific GoHighLevel location/business. I want to send SMS messages and manage my contacts.
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          role === 'user' ? 'border-[#2b83fa] bg-[#2b83fa]' : 'border-[#d1d5db] dark:border-[#444]'
                        }`}>
                          {role === 'user' && <FiCheck className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  </div>

                  <GlareHover 
                    glareColor="#ffffff" 
                    glareOpacity={0.25} 
                    glareAngle={-30} 
                    glareSize={300} 
                    borderRadius="0.75rem" 
                    className="w-full"
                  >
                    <button
                      onClick={() => role && goTo(2)}
                      disabled={!role}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-[14px] shadow-md shadow-[#2b83fa]/30 hover:shadow-lg hover:shadow-[#2b83fa]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none btn-new-message"
                    >
                      Continue <FiArrowRight />
                    </button>
                  </GlareHover>
                </div>
              )}

              {/* ─── Step 2: Account Details ──────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-[22px] font-extrabold text-[#111111] dark:text-white tracking-tight">
                      Your Information
                    </h1>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1">
                      {role === 'agency'
                        ? 'Create your Agency account credentials.'
                        : 'Create your NOLA SMS Pro account.'}
                    </p>
                  </div>

                  {apiError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[12.5px] font-medium"
                    >
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {apiError}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" icon={<FiUser className="w-4 h-4" />} error={errors.firstName}>
                      <input type="text" value={form.firstName} onChange={set('firstName')}
                        placeholder="John" className={inputCls} autoComplete="given-name" />
                    </Field>
                    <Field label="Last Name" icon={<FiUser className="w-4 h-4" />} error={errors.lastName}>
                      <input type="text" value={form.lastName} onChange={set('lastName')}
                        placeholder="Doe" className={inputCls} autoComplete="family-name" />
                    </Field>
                  </div>

                  <Field label="Email Address" icon={<FiMail className="w-4 h-4" />} error={errors.email}>
                    <input type="email" value={form.email} onChange={set('email')}
                      placeholder="you@company.com" className={inputCls} autoComplete="email" />
                  </Field>

                  <Field label="Phone Number" icon={<FiPhone className="w-4 h-4" />} error={errors.phone}>
                    <input type="tel" value={form.phone} onChange={set('phone')}
                      placeholder="09171234567" className={inputCls} autoComplete="tel" />
                  </Field>

                  <Field label="Password" icon={<FiLock className="w-4 h-4" />} error={errors.password}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.password} onChange={set('password')}
                      placeholder="At least 8 characters"
                      className={`${inputCls} pr-10`}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#6e6e73] transition-colors">
                      {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </Field>

                  {/* Password strength bar */}
                  {form.password.length > 0 && (
                    <div className="space-y-1.5 -mt-2">
                      <div className="flex gap-1.5">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength ? STRENGTH_COLOR[strength] : 'bg-[#e5e7eb] dark:bg-[#2a2b32]'
                          }`} />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#9aa0a6] font-medium">
                        Password strength: <span className={`font-bold ${strength >= 3 ? 'text-emerald-500' : strength >= 2 ? 'text-blue-400' : 'text-amber-500'}`}>
                          {STRENGTH_LABEL[strength]}
                        </span>
                      </p>
                    </div>
                  )}

                  <Field label="Confirm Password" icon={<FiLock className="w-4 h-4" />} error={errors.confirm}>
                    <input
                      type={showCpw ? 'text' : 'password'}
                      value={form.confirm} onChange={set('confirm')}
                      placeholder="Re-enter password"
                      className={`${inputCls} pr-10`}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowCpw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#6e6e73] transition-colors">
                      {showCpw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </Field>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => goTo(1, false)}
                      className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-[#e5e7eb] dark:border-[#2a2b32] text-[13px] font-semibold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-[#1a1b1e] transition-colors"
                    >
                      <FiArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <GlareHover 
                      glareColor="#ffffff" 
                      glareOpacity={0.25} 
                      glareAngle={-30} 
                      glareSize={300} 
                      borderRadius="0.75rem" 
                      className="flex-1"
                    >
                      <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-[14px] shadow-md shadow-[#2b83fa]/30 hover:shadow-lg hover:shadow-[#2b83fa]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed btn-new-message"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Creating Account…
                          </>
                        ) : (
                          <>{role === 'agency' ? 'Next' : 'Create Account'} <FiArrowRight /></>
                        )}
                      </button>
                    </GlareHover>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Connect GHL (Agency only) ───────────────────── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-[22px] font-extrabold text-[#111111] dark:text-white tracking-tight">
                      Connect GoHighLevel
                    </h1>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1 leading-relaxed">
                      Link your GHL Company account so NOLA SMS Pro can access your sub-accounts. This step is optional — you can do it later from your dashboard.
                    </p>
                  </div>

                  {/* GHL Connect placeholder box */}
                  <div className="p-6 rounded-2xl border-2 border-dashed border-[#e5e7eb] dark:border-[#2a2b32] flex flex-col items-center gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#22c55e]/20 to-[#16a34a]/10 flex items-center justify-center">
                      <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
                        <rect width="40" height="40" rx="10" fill="#16a34a"/>
                        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">G</text>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#111111] dark:text-white">GoHighLevel OAuth</p>
                      <p className="text-[12px] text-[#9aa0a6] mt-0.5">
                        OAuth integration is being set up. You'll be able to connect your GHL account from the Agency dashboard once it's ready.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11.5px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Coming Soon
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <GlareHover 
                      glareColor="#ffffff" 
                      glareOpacity={0.25} 
                      glareAngle={-30} 
                      glareSize={300} 
                      borderRadius="0.75rem" 
                      className="flex-1"
                    >
                      <button
                        onClick={() => goTo(4)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-[14px] shadow-md shadow-[#2b83fa]/30 hover:shadow-lg hover:shadow-[#2b83fa]/40 transition-all btn-new-message"
                      >
                        Skip for now <FiArrowRight />
                      </button>
                    </GlareHover>
                  </div>
                </div>
              )}

              {/* ─── Step 4: Success ──────────────────────────────────────── */}
              {step === 4 && (
                <div className="flex flex-col items-center text-center space-y-6 py-4">
                  {/* Animated checkmark */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                  >
                    <FiCheck className="w-9 h-9 text-white stroke-[2.5]" />
                  </motion.div>

                  <div>
                    <h1 className="text-[24px] font-extrabold text-[#111111] dark:text-white tracking-tight">
                      Account Created!
                    </h1>
                    <p className="text-[13.5px] text-[#6e6e73] dark:text-[#9aa0a6] mt-2 leading-relaxed max-w-sm mx-auto">
                      Welcome to NOLA SMS Pro, <strong className="text-[#111111] dark:text-white">{form.firstName}</strong>. Your account is ready.
                      {role === 'agency'
                        ? ' Sign in to your Agency Portal to start managing your sub-accounts.'
                        : ' Sign in to start sending messages.'}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-3 w-full pt-2">
                    <GlareHover 
                      glareColor="#ffffff" 
                      glareOpacity={0.25} 
                      glareAngle={-30} 
                      glareSize={300} 
                      borderRadius="0.75rem" 
                      className="w-full"
                    >
                      <button
                        onClick={() => {
                          if (role === 'agency') {
                            window.location.href = 'https://agency.nolasmspro.com/login';
                          } else {
                            navigate('/login');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-[14px] shadow-md shadow-[#2b83fa]/30 hover:shadow-lg hover:shadow-[#2b83fa]/40 transition-all btn-new-message"
                      >
                        Sign In to Your Account <FiArrowRight />
                      </button>
                    </GlareHover>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          {step !== 4 && (
            <p className="text-center text-[12px] text-[#9aa0a6] mt-8">
              Already have an account?{' '}
              <button 
                onClick={() => {
                  if (originAgency) {
                    window.location.href = 'https://agency.nolasmspro.com/login';
                  } else {
                    navigate('/login');
                  }
                }} 
                className="text-[#2b83fa] font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-[#9aa0a6] mt-5">
          By registering, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Register;
