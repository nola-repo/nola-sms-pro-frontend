import React, { useState, useEffect, useRef } from "react";
import {
  FiZap, FiSettings, FiSend, FiCreditCard, FiUser,
  FiArrowRight, FiArrowLeft, FiX, FiAlertTriangle,
  FiCheck, FiChevronRight, FiInfo, FiToggleRight,
  FiShield, FiPhone, FiMessageSquare, FiCalendar,
  FiUsers, FiRepeat,
} from "react-icons/fi";
import type { UseOnboardingReturn } from "./useOnboarding";

interface OnboardingModalProps {
  onboarding: UseOnboardingReturn;
}

type CtaAction = "next" | "settings-sender" | "settings-credits" | "complete";

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  tag: string;
  tagVariant: "default" | "required" | "complete";
  subtitle: string;
  content: React.ReactNode;
  cta?: { label: string; action: CtaAction };
}

// ── Primitives ───────────────────────────────────────────────────────────────

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  body?: string;
  accent?: boolean;
}> = ({ icon, title, body, accent }) => (
  <div className="flex items-start gap-3.5 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[15px] ${
      accent
        ? "bg-[#2b83fa] text-white"
        : "bg-black/[0.04] dark:bg-white/[0.06] text-[#6b7280] dark:text-[#9aa0a6]"
    }`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0 pt-0.5">
      <p className="text-[13.5px] font-semibold text-[#111111] dark:text-[#ececf1] leading-snug">{title}</p>
      {body && <p className="text-[12px] text-[#6b7280] dark:text-[#9aa0a6] mt-0.5 leading-relaxed">{body}</p>}
    </div>
  </div>
);

const Note: React.FC<{ children: React.ReactNode; variant?: "info" | "warn" }> = ({
  children,
  variant = "info",
}) => (
  <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-[12px] leading-relaxed font-medium ${
    variant === "warn"
      ? "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30"
      : "bg-[#f4f6fa] dark:bg-white/[0.04] text-[#4b5563] dark:text-[#9aa0a6] border border-black/[0.04] dark:border-white/[0.05]"
  }`}>
    {variant === "warn"
      ? <FiAlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-70" />
      : <FiInfo className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
    }
    <span>{children}</span>
  </div>
);

// ── Step content ─────────────────────────────────────────────────────────────

const Step1 = () => (
  <div className="space-y-4">
    {/* Credit highlight */}
    <div className="flex items-center gap-4 px-4 py-4 rounded-xl bg-[#2b83fa] text-white">
      <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
        <FiCreditCard className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[22px] font-black leading-none">10 free credits</p>
        <p className="text-[12px] text-white/70 mt-0.5 font-medium">included on signup · for testing</p>
      </div>
    </div>

    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
      <Row icon={<FiMessageSquare className="w-4 h-4" />} title="Send SMS via the web app" body="Compose messages directly from this dashboard" />
      <Row icon={<FiZap className="w-4 h-4" />} title="Trigger SMS via GHL workflows" body="Automate messages in your GoHighLevel sequences" />
      <Row icon={<FiRepeat className="w-4 h-4" />} title="Track delivery & credit usage" body="Real-time reporting on all outbound messages" />
    </div>
  </div>
);

const Step2 = () => {
  const path = [
    "Settings",
    "Phone System",
    "Additional Settings",
    "Telephony Provider",
  ];
  return (
    <div className="space-y-4">
      {/* Path indicator */}
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">Navigate to</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {path.map((label, i) => (
            <React.Fragment key={i}>
              <span className={`px-2.5 py-1 rounded-md text-[12.5px] font-semibold ${
                i === path.length - 1
                  ? "bg-[#2b83fa] text-white"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-[#37352f] dark:text-[#d1d5db]"
              }`}>
                {label}
              </span>
              {i < path.length - 1 && (
                <FiChevronRight className="w-3.5 h-3.5 text-[#9aa0a6] flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Final action */}
      <div className="flex items-center gap-3 px-3.5 py-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.03]">
        <div className="w-8 h-8 rounded-lg bg-[#2b83fa]/10 flex items-center justify-center flex-shrink-0 text-[#2b83fa]">
          <FiCheck className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#111111] dark:text-[#ececf1]">Choose NOLA SMS Pro – Default Provider</p>
          <p className="text-[11.5px] text-[#9aa0a6] mt-0.5">Select and confirm it is active</p>
        </div>
      </div>

      <Note variant="warn">
        This setting is only visible to <strong>Agency Owners and Admins.</strong> Contact your agency owner if you don't have access.
      </Note>
    </div>
  );
};

const Step3 = () => (
  <div className="space-y-4">
    {/* Sender ID display */}
    <div className="px-4 py-5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.03] text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">Your default Sender ID</p>
      <code className="text-[24px] font-black text-[#111111] dark:text-white tracking-tight font-mono">NOLASMSPro</code>
      <p className="text-[11.5px] text-[#9aa0a6] font-medium mt-2">Active automatically — no configuration needed</p>
    </div>

    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
      <Row icon={<FiSend className="w-4 h-4" />} title="Works in the web app" body="Compose & send from the dashboard right now" />
      <Row icon={<FiZap className="w-4 h-4" />} title="Works in GHL automations" body="Use in any SMS action inside GoHighLevel" />
    </div>

    <Note variant="warn">
      The default ID is for <strong>testing only.</strong> Register a custom Sender ID for production use.
    </Note>
  </div>
);

const Step4 = () => (
  <div className="space-y-4">
    <Note variant="warn">
      Sender ID registration is <strong>required</strong> before going live. Approval takes <strong>5–7 business days.</strong>
    </Note>

    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">Requirements</p>
      <div className="space-y-2">
        {[
          { ok: true,  text: "3–11 characters long" },
          { ok: true,  text: "Letters and numbers only" },
          { ok: false, text: "No spaces, hyphens, or special characters" },
          { ok: true,  text: "Must reflect your brand name" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
              item.ok ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-red-100 dark:bg-red-900/30 text-red-500"
            }`}>
              {item.ok
                ? <FiCheck className="w-2.5 h-2.5" />
                : <FiX className="w-2.5 h-2.5" />
              }
            </div>
            <span className="text-[13px] font-medium text-[#37352f] dark:text-[#d1d5db]">{item.text}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Approval timeline */}
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">Approval timeline</p>
      <div className="flex items-center gap-0">
        {[
          { label: "Submit", done: true },
          { label: "Review", done: false },
          { label: "Approved", done: false },
        ].map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                s.done ? "bg-[#2b83fa] text-white" : "bg-black/[0.06] dark:bg-white/[0.08] text-[#9aa0a6]"
              }`}>
                {s.done ? <FiCheck className="w-3 h-3" /> : i + 1}
              </div>
              <span className="text-[10.5px] font-semibold text-[#9aa0a6] whitespace-nowrap">{s.label}</span>
            </div>
            {i < 2 && (
              <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.08] mt-[-14px] mx-1" />
            )}
          </React.Fragment>
        ))}
        <div className="ml-2 text-[11px] text-[#9aa0a6] font-medium mt-[-14px] whitespace-nowrap">~5–7 days</div>
      </div>
    </div>
  </div>
);

const Step5 = () => {
  const rows = [
    { range: "1–160 characters", credits: "1 credit", highlight: true },
    { range: "161–306 characters", credits: "2 credits", highlight: false },
    { range: "307–459 characters", credits: "3 credits", highlight: false },
  ];
  return (
    <div className="space-y-4">
      {/* Formula */}
      <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-[#f4f6fa] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.05]">
        {[
          { val: "1 Credit", sub: null },
          { val: "=", sub: null },
          { val: "1 Segment", sub: null },
          { val: "=", sub: null },
          { val: "160 chars", sub: "max" },
        ].map((item, i) => (
          <div key={i} className={`${item.val === "=" ? "text-[#9aa0a6] text-base font-semibold" : "text-center"}`}>
            {item.val === "=" ? (
              <span>{item.val}</span>
            ) : (
              <>
                <p className="text-[13px] font-black text-[#111111] dark:text-[#ececf1] leading-tight">{item.val}</p>
                {item.sub && <p className="text-[10px] text-[#9aa0a6] font-medium">{item.sub}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        {rows.map((row, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 ${
            row.highlight ? "bg-[#2b83fa]/[0.04]" : "bg-white dark:bg-white/[0.02]"
          }`}>
            <span className="text-[13px] text-[#4b5563] dark:text-[#9aa0a6] font-medium">{row.range}</span>
            <span className={`text-[13px] font-bold tabular-nums ${row.highlight ? "text-[#2b83fa]" : "text-[#111111] dark:text-[#ececf1]"}`}>
              {row.credits}
            </span>
          </div>
        ))}
      </div>

      <Note>
        The message composer shows a live <strong>character count and credit estimator</strong> as you type.
      </Note>
    </div>
  );
};

const Step6 = () => (
  <div className="space-y-4">
    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
      <Row icon={<FiX className="w-4 h-4" />} title="No subscription required" body="Pay-as-you-go — buy credits when you need them" />
      <Row icon={<FiZap className="w-4 h-4" />} title="Credits added instantly" body="Available immediately after purchase" />
      <Row icon={<FiRepeat className="w-4 h-4" />} title="Top up any time" body="No minimums, no lock-in periods" />
      <Row icon={<FiShield className="w-4 h-4" />} title="Credits never expire" body="Your balance carries over indefinitely" />
    </div>

    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[#2b83fa]/20 bg-[#2b83fa]/[0.04]">
      <FiCreditCard className="w-4 h-4 text-[#2b83fa] flex-shrink-0" />
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-[#2b83fa]">Click below to view available packages</p>
        <p className="text-[11.5px] text-[#9aa0a6] mt-0.5">Multiple tiers starting from a small amount</p>
      </div>
    </div>
  </div>
);

const Step7 = () => (
  <div className="space-y-4">
    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
      <Row icon={<FiZap className="w-4 h-4" />} title="GHL Workflows" body="Add SMS actions to any automation step" />
      <Row icon={<FiCalendar className="w-4 h-4" />} title="Appointment Reminders" body="Send automated reminders before appointments" />
      <Row icon={<FiUsers className="w-4 h-4" />} title="Bulk Announcements" body="Message your entire contact list at once" />
      <Row icon={<FiMessageSquare className="w-4 h-4" />} title="Follow-Up Sequences" body="Nurture leads with timed message sequences" />
    </div>

    {/* Done state */}
    <div className="flex flex-col items-center text-center px-4 py-5 rounded-xl bg-[#f4f6fa] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04]">
      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
        <FiCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <p className="text-[14px] font-bold text-[#111111] dark:text-[#ececf1]">You're all set</p>
      <p className="text-[12.5px] text-[#6b7280] dark:text-[#9aa0a6] mt-1">NOLA SMS Pro is ready to use.</p>
    </div>
  </div>
);

// ── Step definitions ─────────────────────────────────────────────────────────
function buildSteps(): Step[] {
  return [
    {
      id: 0,
      icon: <FiCheck className="w-5 h-5" />,
      title: "Installation Complete",
      tag: "Step 1",
      tagVariant: "default",
      subtitle: "Your account is active. You have 10 free credits to get started.",
      content: <Step1 />,
    },
    {
      id: 1,
      icon: <FiPhone className="w-5 h-5" />,
      title: "Enable Telephony Provider",
      tag: "Step 2",
      tagVariant: "default",
      subtitle: "Connect NOLA SMS Pro in your GoHighLevel settings.",
      content: <Step2 />,
    },
    {
      id: 2,
      icon: <FiSend className="w-5 h-5" />,
      title: "Start Sending",
      tag: "Step 3",
      tagVariant: "default",
      subtitle: "Send immediately using the default Sender ID — no setup needed.",
      content: <Step3 />,
    },
    {
      id: 3,
      icon: <FiUser className="w-5 h-5" />,
      title: "Register Your Sender ID",
      tag: "Required",
      tagVariant: "required",
      subtitle: "A custom Sender ID is required for production. Submit the form to begin approval.",
      content: <Step4 />,
      cta: { label: "Open registration form", action: "settings-sender" },
    },
    {
      id: 4,
      icon: <FiInfo className="w-5 h-5" />,
      title: "Credit Usage",
      tag: "Step 5",
      tagVariant: "default",
      subtitle: "1 credit = 1 SMS segment = up to 160 characters.",
      content: <Step5 />,
    },
    {
      id: 5,
      icon: <FiCreditCard className="w-5 h-5" />,
      title: "Top Up Credits",
      tag: "Step 6",
      tagVariant: "default",
      subtitle: "Pay as you go — no subscription, credits never expire.",
      content: <Step6 />,
      cta: { label: "View credit packages", action: "settings-credits" },
    },
    {
      id: 6,
      icon: <FiZap className="w-5 h-5" />,
      title: "Use in Automation",
      tag: "Final step",
      tagVariant: "complete",
      subtitle: "Integrate SMS into workflows, reminders, and campaigns.",
      content: <Step7 />,
      cta: { label: "Get started", action: "complete" },
    },
  ];
}

// ── Tag component ────────────────────────────────────────────────────────────
const StepTag: React.FC<{ label: string; variant: Step["tagVariant"] }> = ({ label, variant }) => {
  const styles = {
    default:   "bg-black/[0.04] dark:bg-white/[0.08] text-[#6b7280] dark:text-[#9aa0a6]",
    required:  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    complete:  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-widest ${styles[variant]}`}>
      {label}
    </span>
  );
};

// ── Main Modal ───────────────────────────────────────────────────────────────
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onboarding }) => {
  const { isOpen, currentStep, totalSteps, next, back, close, complete, goToStep } = onboarding;
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [visibleStep, setVisibleStep] = useState(currentStep);
  const prevStepRef = useRef(currentStep);
  const STEPS = buildSteps();
  const step = STEPS[visibleStep];

  useEffect(() => {
    if (currentStep === prevStepRef.current) return;
    setAnimDir(currentStep > prevStepRef.current ? "forward" : "back");
    setAnimating(true);
    const t = setTimeout(() => {
      setVisibleStep(currentStep);
      setAnimating(false);
      prevStepRef.current = currentStep;
    }, 180);
    return () => clearTimeout(t);
  }, [currentStep]);

  const handleCta = (action: CtaAction) => {
    if (action === "complete") {
      complete();
    } else if (action === "settings-sender") {
      close();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("navigate-to-settings", {
          detail: { tab: "senderIds", autoOpenAdd: true },
        }));
      }, 100);
    } else if (action === "settings-credits") {
      close();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("navigate-to-settings", {
          detail: { tab: "credits" },
        }));
      }, 100);
    } else {
      next();
    }
  };

  if (!isOpen) return null;

  const isFirst = visibleStep === 0;
  const isLast = visibleStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-[420px] bg-white dark:bg-[#111213] rounded-2xl shadow-2xl shadow-black/20 border border-black/[0.06] dark:border-white/[0.06] flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-200">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            {/* Step tag */}
            <StepTag label={step.tag} variant={step.tagVariant} />
            {/* Close */}
            <button
              onClick={close}
              className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all"
              aria-label="Close"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#2b83fa] flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-500/25">
              {step.icon}
            </div>
            <div>
              <h2 className="text-[16.5px] font-bold text-[#111111] dark:text-white tracking-tight leading-snug">
                {step.title}
              </h2>
              <p className="text-[12px] text-[#6b7280] dark:text-[#9aa0a6] mt-0.5 leading-snug font-medium">
                {step.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="px-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goToStep(i)}
                className={`h-[3px] rounded-full transition-all duration-300 cursor-pointer ${
                  i < currentStep
                    ? "bg-[#2b83fa] flex-1"
                    : i === currentStep
                    ? "bg-[#2b83fa] flex-[2]"
                    : "bg-black/[0.08] dark:bg-white/[0.08] flex-1"
                }`}
              />
            ))}
          </div>
          <p className="text-[10.5px] text-[#9aa0a6] font-medium tabular-nums">
            {currentStep + 1} of {totalSteps}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] flex-shrink-0" />

        {/* ── Content ── */}
        <div className="px-5 py-4 flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin" }}>
          <div
            className={`transition-all duration-180 ${
              animating
                ? animDir === "forward"
                  ? "opacity-0 translate-x-2"
                  : "opacity-0 -translate-x-2"
                : "opacity-100 translate-x-0"
            }`}
          >
            {step.content}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] flex-shrink-0" />

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-shrink-0">
          {/* Left */}
          {!isFirst ? (
            <button
              onClick={() => back()}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <button
              onClick={close}
              className="text-[12.5px] font-semibold text-[#9aa0a6] hover:text-[#6b7280] transition-colors px-2 py-1.5"
            >
              Skip
            </button>
          )}

          {/* Right */}
          <div className="flex items-center gap-2">
            {step.cta && !isLast && (
              <button
                onClick={() => next()}
                className="text-[12.5px] font-semibold text-[#9aa0a6] hover:text-[#6b7280] dark:hover:text-[#d1d5db] transition-colors px-2 py-1.5"
              >
                Skip
              </button>
            )}

            {step.cta ? (
              <button
                onClick={() => handleCta(step.cta!.action)}
                className="flex items-center gap-2 px-4 py-2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[13px] font-semibold rounded-xl hover:bg-[#2a2a2a] dark:hover:bg-[#f0f0f0] transition-colors active:scale-[0.98] shadow-md shadow-black/10"
              >
                {step.cta.label}
                <FiArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => next()}
                className="flex items-center gap-2 px-4 py-2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[13px] font-semibold rounded-xl hover:bg-[#2a2a2a] dark:hover:bg-[#f0f0f0] transition-colors active:scale-[0.98] shadow-md shadow-black/10"
              >
                Next
                <FiArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
