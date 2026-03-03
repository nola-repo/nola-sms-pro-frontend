import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FiChevronDown, FiCheck, FiGlobe, FiMapPin, FiBriefcase, FiPlus, FiTrash2, FiX, FiCheckCircle } from "react-icons/fi";
import { type SenderId } from "../api/sms";

interface SenderOption {
    id: SenderId;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

interface SenderSelectorProps {
    value: SenderId;
    onChange: (value: SenderId) => void;
    label?: string;
    size?: "sm" | "md";
    align?: "left" | "right";
}

const DEFAULT_OPTIONS: SenderOption[] = [
    { id: "NOLACRM", name: "NOLACRM", description: "Default System Sender", icon: <FiGlobe />, color: "bg-blue-500" },
    { id: "BRANCH1", name: "BRANCH1", description: "Standard Sender ID", icon: <FiMapPin />, color: "bg-purple-500" },
    { id: "BRANCH2", name: "BRANCH2", description: "Alternate Sender ID", icon: <FiBriefcase />, color: "bg-orange-500" },
];

const COLORS = ["bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-indigo-500", "bg-cyan-500", "bg-pink-500"];
const ICONS = [<FiGlobe />, <FiMapPin />, <FiBriefcase />, <FiCheckCircle />];

export const SenderSelector: React.FC<SenderSelectorProps> = ({
    value,
    onChange,
    label = "From:",
    size = "md",
    align = "right"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newId, setNewId] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [customOptions, setCustomOptions] = useState<SenderOption[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load custom options from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("custom_sender_ids");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Map back to components/icons
                const mapped = parsed.map((opt: any, index: number) => ({
                    ...opt,
                    icon: ICONS[index % ICONS.length],
                }));
                setCustomOptions(mapped);
            } catch (e) {
                console.error("Failed to parse custom sender IDs", e);
            }
        }
    }, []);

    const allOptions = useMemo(() => [...DEFAULT_OPTIONS, ...customOptions], [customOptions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = allOptions.find(opt => opt.id === value) || allOptions[0];

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newId.trim()) return;

        const newOption: SenderOption = {
            id: newId.trim().toUpperCase(),
            name: newId.trim().toUpperCase(),
            description: newDesc.trim() || "Custom Sender ID",
            color: COLORS[customOptions.length % COLORS.length],
            icon: ICONS[customOptions.length % ICONS.length],
        };

        const updated = [...customOptions, newOption];
        setCustomOptions(updated);

        // Save to localStorage (storing everything except the dynamic icon element)
        const toSave = updated.map(({ icon, ...rest }) => rest);
        localStorage.setItem("custom_sender_ids", JSON.stringify(toSave));

        setNewId("");
        setNewDesc("");
        setIsAdding(false);
        setIsOpen(false);
        onChange(newOption.id);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const updated = customOptions.filter(opt => opt.id !== id);
        setCustomOptions(updated);

        const toSave = updated.map(({ icon, ...rest }) => rest);
        localStorage.setItem("custom_sender_ids", JSON.stringify(toSave));

        if (value === id) {
            onChange(DEFAULT_OPTIONS[0].id);
        }
    };

    return (
        <div className="flex items-center gap-2" ref={dropdownRef}>
            {label && (
                <span className={`hidden sm:inline-block font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap ${size === "sm" ? "text-[10px]" : "text-[11px]"}`}>
                    {label}
                </span>
            )}

            <div className="relative">
                {/* Trigger Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
            flex items-center justify-between gap-2.5 font-bold transition-all duration-200
            bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 rounded-xl
            hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20
            focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20
            ${size === "sm" ? "px-2 py-1.5 text-[11px] uppercase tracking-wider" : "px-3 py-2 text-[13px]"}
            ${isOpen ? "ring-2 ring-[#2b83fa]/20 border-[#2b83fa]/30" : ""}
          `}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex-shrink-0 flex items-center justify-center rounded-lg text-white shadow-sm ${size === "sm" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-[12px]"} ${selectedOption.color}`}>
                            {selectedOption.icon}
                        </div>
                        <span className="text-[#37352f] dark:text-[#ececf1] truncate max-w-[80px] sm:max-w-[120px]">{selectedOption.name}</span>
                    </div>
                    <FiChevronDown className={`flex-shrink-0 transition-transform duration-200 text-gray-400 ${isOpen ? "rotate-180 text-[#2b83fa]" : ""}`} />
                </button>

                {/* Floating Menu */}
                {isOpen && (
                    <div className={`
            absolute top-full z-[60] mt-2 
            w-64 max-w-[calc(100vw-2rem)] p-1.5
            bg-white/95 dark:bg-[#1a1b1e]/95 backdrop-blur-2xl
            border border-gray-200/80 dark:border-white/10
            rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40
            animate-in fade-in zoom-in-95 duration-200 
            ${align === "left" ? "left-0 origin-top-left" : "left-auto right-0 origin-top-right"}
          `}>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-0.5">
                            {allOptions.map((option) => {
                                const isSelected = option.id === value;
                                const isCustom = customOptions.some(opt => opt.id === option.id);
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            onChange(option.id);
                                            setIsOpen(false);
                                        }}
                                        className={`
                        w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-150 group mb-0.5
                        ${isSelected
                                                ? "bg-[#2b83fa]/10 dark:bg-[#2b83fa]/20 text-[#2b83fa]"
                                                : "hover:bg-gray-100/80 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"}
                      `}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-xl text-white shadow-sm flex-shrink-0 ${option.color} ${isSelected ? "ring-2 ring-white/20" : ""}`}>
                                            {option.icon}
                                        </div>
                                        <div className="flex-1 flex flex-col items-start min-w-0 text-left">
                                            <span className={`text-[13px] font-bold text-left truncate w-full ${isSelected ? "text-[#2b83fa]" : "group-hover:text-[#2b83fa]"}`}>
                                                {option.name}
                                            </span>
                                            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate w-full text-left">
                                                {option.description}
                                            </span>
                                        </div>
                                        {isSelected ? (
                                            <FiCheck className="h-4 w-4 flex-shrink-0" />
                                        ) : isCustom ? (
                                            <button
                                                onClick={(e) => handleDelete(e, option.id)}
                                                className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-500 rounded-lg transition-all"
                                            >
                                                <FiTrash2 className="h-3.5 w-3.5" />
                                            </button>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-1.5 p-1 border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={() => setIsAdding(true)}
                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#2b83fa]/5 text-[#2b83fa] transition-all group"
                            >
                                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#2b83fa]/10 text-[#2b83fa] group-hover:bg-[#2b83fa] group-hover:text-white transition-all">
                                    <FiPlus className="h-4 w-4" />
                                </div>
                                <span className="text-[13px] font-bold">Add New Sender ID</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Portal - Moved outside internal component scope to fix focus bug */}
            {isAdding && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setIsAdding(false)}
                    />

                    {/* Modal Card */}
                    <div className="relative w-full max-w-md bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-2xl p-4 sm:p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#2b83fa]/10 dark:bg-[#2b83fa]/20 flex items-center justify-center text-[#2b83fa]">
                                    <FiPlus className="h-4 w-4" />
                                </div>
                                <h3 className="text-[16px] sm:text-[18px] font-bold text-[#111111] dark:text-[#ececf1]">Add Sender ID</h3>
                            </div>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Sender ID
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newId}
                                        onChange={(e) => setNewId(e.target.value)}
                                        placeholder="e.g. MY BRAND"
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] font-medium text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 transition-all font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Description (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="e.g. Marketing campaigns"
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200/60 dark:border-white/10 rounded-xl text-[14px] font-medium text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 mt-4 sm:mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="w-full sm:flex-1 px-4 py-3 text-[14px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2b83fa] hover:bg-[#1d6bd4] text-white rounded-xl font-semibold text-[14px] transition-all duration-200 shadow-md shadow-blue-500/20"
                                >
                                    <FiPlus className="h-4 w-4" />
                                    Create Sender
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
