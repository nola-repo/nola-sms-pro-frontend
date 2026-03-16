import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchContacts } from "../api/contacts";
import { fetchConversations, renameConversation, deleteConversation } from "../api/sms";
import { deleteContact as deleteContactBackend } from "../api/contacts";
import type { Contact } from "../types/Contact";
import type { BulkMessageHistoryItem } from "../types/Sms";
import { getBulkMessageHistory, renameBulkMessage, deleteBulkMessage, deleteContact as deleteContactLocal, getDeletedContactIds } from "../utils/storage";
import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarRightCollapse } from "react-icons/tb";
import { FiUsers, FiChevronDown, FiEdit2, FiTrash2, FiMoreVertical, FiHome, FiPlus, FiX } from "react-icons/fi";
import GlareHover from "./GlareHover";
import { extractBatchIdFromGroupConversationId, extractPhoneFromDirectConversationId } from "../utils/conversationId";

export type ViewTab = 'home' | 'compose' | 'contacts' | 'templates' | 'settings';

interface SidebarProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onSelectContact: (contact: Contact) => void;
  activeContactId?: string;
  activeBulkMessageId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectBulkMessage?: (message: BulkMessageHistoryItem) => void;
  onCloseMobile?: () => void;
}

const SidebarSkeleton = () => (
  <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg animate-pulse mb-0.5">
    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-3 w-2/3 bg-gray-200 dark:bg-white/10 rounded" />
      <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded" />
    </div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onSelectContact,
  activeContactId,
  activeBulkMessageId,
  isCollapsed = false,
  onToggleCollapse,
  onSelectBulkMessage,
  onCloseMobile
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [directHistory, setDirectHistory] = useState<Contact[]>([]);
  const [bulkHistory, setBulkHistory] = useState<BulkMessageHistoryItem[]>(() => getBulkMessageHistory());
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);
  const [bulkMessagesExpanded, setBulkMessagesExpanded] = useState(true);
  const [editingBulkId, setEditingBulkId] = useState<string | null>(null);
  const [editingBulkName, setEditingBulkName] = useState("");
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [deletingBulkId, setDeletingBulkId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const touchStartY = useRef<number>(0);
  const contactsListRef = useRef<HTMLDivElement>(null);
  // Track last_message per conversation to detect new messages and notify the Composer
  const lastMessageTracker = useRef<Map<string, string>>(new Map());

  const loadContacts = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const data = await fetchContacts();
      const deletedIds = getDeletedContactIds();
      const filtered = data.filter(c => !deletedIds.includes(c.id));
      setContacts(filtered);

      // Load conversations from server
      try {
        const conversations = await fetchConversations();
        
        // Build a phone -> name lookup map from freshly-fetched contacts (not stale state)
        const contactMap = new Map<string, string>();
        data.forEach(c => {
          contactMap.set(c.phone, c.name);
          const cleaned = c.phone.replace(/\D/g, "");
          if (cleaned) {
            contactMap.set(cleaned, c.name);
            // Also map +63 variants for GHL phone format matching
            if (cleaned.startsWith('0')) contactMap.set('+63' + cleaned.slice(1), c.name);
            if (cleaned.startsWith('9')) contactMap.set('+63' + cleaned, c.name);
          }
        });

        // Handle Direct Conversations
        const directConvs = conversations.filter(c => c.type === 'direct' || !c.type);
        
        // Deduplicate conversations by phone number (merge legacy and scoped UI items)
        const dedupedDirectConvs = new Map<string, Contact>();
        
        directConvs.forEach(conv => {
          const phone = extractPhoneFromDirectConversationId(conv.id) || conv.id;
          const cleanPhone = phone.replace(/\D/g, "");
          // Resolve name: prefer contact name, then server metadata (only if it's a real name, not a phone number), then phone
          const isPhoneNumber = (s: string) => /^[\d+\-() ]+$/.test(s);
          const contactName = contactMap.get(phone) || contactMap.get(cleanPhone) || contactMap.get('+63' + cleanPhone);
          let serverName = conv.name && !isPhoneNumber(conv.name) ? conv.name : null;
          
          // Scrub accidental conversation IDs (e.g. "Name locationId_conv_09XX") from the server name
          if (serverName && serverName.includes('_conv_')) {
             let cleanName = serverName.split('_conv_')[0].trim();
             // Remove the 20-character location ID if it's at the end
             cleanName = cleanName.replace(/\b[a-zA-Z0-9]{20}\b$/, '').trim();
             serverName = cleanName || null;
          }
          
          const name = contactName || serverName || phone;
          
          const item: Contact = {
            id: conv.id,
            name: name,
            phone: phone,
            lastMessage: conv.last_message,
            lastSentAt: conv.last_message_at || conv.updated_at || undefined
          };
          
          if (dedupedDirectConvs.has(phone)) {
            const existing = dedupedDirectConvs.get(phone)!;
            const existingIsScoped = existing.id.includes('_conv_');
            const newIsScoped = conv.id.includes('_conv_');
            
            if (newIsScoped && !existingIsScoped) {
               // Prefer scoped ID over unscoped legacy ID
               dedupedDirectConvs.set(phone, item);
            } else if (!newIsScoped && existingIsScoped) {
               // Keep existing scoped ID
            } else {
               // Both scoped or both unscoped, keep newest message
               const newTime = new Date(item.lastSentAt || 0).getTime();
               const existingTime = new Date(existing.lastSentAt || 0).getTime();
               if (newTime > existingTime) {
                 dedupedDirectConvs.set(phone, item);
               }
            }
          } else {
            dedupedDirectConvs.set(phone, item);
          }
        });

        const historyContacts: Contact[] = Array.from(dedupedDirectConvs.values()).sort((a, b) => {
          const timeA = new Date(a.lastSentAt || 0).getTime();
          const timeB = new Date(b.lastSentAt || 0).getTime();
          return timeB - timeA;
        });
        setDirectHistory(historyContacts);

        // Handle Bulk Conversations
        const mergedBulk = new Map<string, BulkMessageHistoryItem>();

        // 1. Local storage fallback
        getBulkMessageHistory().forEach(msg => {
          const key = msg.batchId || msg.id;
          mergedBulk.set(key, msg);
        });

        // 2. Map server conversations to BulkMessageHistoryItem
        conversations
          .filter(c => c.type === 'bulk')
          .forEach(conv => {
            const batchId = extractBatchIdFromGroupConversationId(conv.id) || conv.id.replace(/^group_/, '');
            const key = batchId;
            const existing = mergedBulk.get(key);
            
            // Resolve recipient names from contact list if not present
            let recipientNames = existing?.recipientNames || [];
            if (recipientNames.length === 0 && conv.members.length > 0) {
              recipientNames = conv.members.map(phone => {
                const clean = phone.replace(/\D/g, "");
                return contactMap.get(phone) || contactMap.get(clean) || phone;
              });
            }

            const item: BulkMessageHistoryItem = {
              id: existing?.id || `bulk-db-${batchId}`,
              message: conv.last_message || existing?.message || '',
              recipientCount: conv.members.length,
              recipientNames: recipientNames,
              recipientNumbers: conv.members,
              recipientKey: existing?.recipientKey || batchId,
              customName: conv.name || existing?.customName, // Prioritize server-side renamed group
              timestamp: conv.last_message_at || conv.updated_at || existing?.timestamp || new Date().toISOString(),
              status: existing?.status || 'sent',
              batchId,
              fromDatabase: true,
            };
            mergedBulk.set(key, item);
          });

        const combined = Array.from(mergedBulk.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBulkHistory(combined);

        // Detect new messages and notify the Composer for immediate refresh
        const prevTracker = lastMessageTracker.current;
        const newTracker = new Map<string, string>();

        // Track direct conversations
        historyContacts.forEach(c => {
          if (c.lastMessage) newTracker.set(c.id, c.lastMessage);
        });
        // Track bulk conversations
        combined.forEach(b => {
          const convId = b.batchId ? `group_${b.batchId}` : b.id;
          if (b.message) newTracker.set(convId, b.message);
        });

        // Compare and dispatch events for changed conversations
        if (prevTracker.size > 0) {
          newTracker.forEach((msg, convId) => {
            const prev = prevTracker.get(convId);
            if (prev !== undefined && prev !== msg) {
              // This conversation has a new message
              window.dispatchEvent(new CustomEvent('conversation-updated', {
                detail: { conversationId: convId }
              }));
            }
          });
          // Also fire for brand-new conversations not in prev tracker
          newTracker.forEach((_msg, convId) => {
            if (!prevTracker.has(convId)) {
              window.dispatchEvent(new CustomEvent('conversation-updated', {
                detail: { conversationId: convId }
              }));
            }
          });
        }
        lastMessageTracker.current = newTracker;
      } catch (err) {
        console.error('Error loading history:', err);
        // Fallback to local bulk history if server fails
        setBulkHistory(getBulkMessageHistory());
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();

    // Poll for new contacts every 5 seconds
    const contactInterval = setInterval(() => {
      loadContacts(false);
    }, 5000);

    // Listen for bulk message sent events to refresh history
    const handleBulkMessageSent = () => {
      setBulkHistory(getBulkMessageHistory());
    };
    window.addEventListener('bulk-message-sent', handleBulkMessageSent);

    return () => {
      clearInterval(contactInterval);
      window.removeEventListener('bulk-message-sent', handleBulkMessageSent);
    };
  }, [loadContacts]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handler functions for bulk message CRUD
  const handleStartEdit = (item: BulkMessageHistoryItem) => {
    setEditingBulkId(item.id);
    setEditingBulkName(item.customName || (item.recipientNames?.join(", ") || `${item.recipientCount} recipients`));
    setShowRenameModal(true);
  };

  const handleCancelEdit = () => {
    setEditingBulkId(null);
    setEditingBulkName("");
    setShowRenameModal(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (editingBulkName.trim()) {
      // 1. Rename in backend (Firestore)
      // Bulk composite ID: bulk-db-{batch_id} -> we need the conversation_id: group_{batch_id}
      const item = bulkHistory.find(h => h.id === id);
      if (item && item.batchId) {
        const conversationId = `group_${item.batchId}`;
        await renameConversation(conversationId, editingBulkName.trim());
      }

      // 2. Rename in local storage (for offline/cache fallback)
      renameBulkMessage(id, editingBulkName.trim());

      // 3. Update UI
      setBulkHistory(getBulkMessageHistory());
      // Refresh list from server to ensure sync
      loadContacts(false);
    }
    setEditingBulkId(null);
    setEditingBulkName("");
    setShowRenameModal(false);
  };

  const startDeleteBulk = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingBulkId(id);
  };

  const confirmDeleteBulk = async () => {
    if (!deletingBulkId) return;

    // 1. Delete in backend
    const item = bulkHistory.find(h => h.id === deletingBulkId);
    if (item && item.batchId) {
      const conversationId = `group_${item.batchId}`;
      await deleteConversation(conversationId);
    }

    // 2. Delete in local storage
    deleteBulkMessage(deletingBulkId);

    // 3. Update UI
    setBulkHistory(getBulkMessageHistory());
    loadContacts(false);
    setDeletingBulkId(null);
  };

  const cancelDeleteBulk = () => {
    setDeletingBulkId(null);
  };

  const handleDeleteContact = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingContactId(id);
  };

  const confirmDeleteContact = async () => {
    if (deletingContactId) {
      // 1. Delete from backend (GHL/Firestore) if it's not a manual contact
      if (!deletingContactId.startsWith('manual-')) {
        try {
          await deleteContactBackend(deletingContactId);
        } catch (err) {
          console.error('Failed to delete contact from backend:', err);
        }
      }

      // 2. Local soft-delete (adds to deleted IDs list in storage)
      deleteContactLocal(deletingContactId);

      // 3. Clear from UI
      setContacts(contacts.filter(c => c.id !== deletingContactId));
      setDeletingContactId(null);
    }
  };

  const cancelDeleteContact = () => {
    setDeletingContactId(null);
  };

  const getBulkDisplayName = (item: BulkMessageHistoryItem): string => {
    const toProperCase = (name: string): string => {
      return name.replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // Avoid showing auto-generated batch IDs as the "name"
    if (item.customName) {
      const looksLikeBatchId = /^batch[-_]\d+$/i.test(item.customName) || /^batch[-_]/i.test(item.customName);
      if (!looksLikeBatchId) return item.customName;
    }
    if (item.recipientNames && item.recipientNames.length > 0) {
      const names = item.recipientNames.map((n) => toProperCase(n)).filter(Boolean);
      const shown = names.slice(0, 3);
      const extra = Math.max(0, names.length - shown.length);
      return extra > 0 ? `${shown.join(", ")} +${extra}` : shown.join(", ");
    }
    return `${item.recipientCount} recipient${item.recipientCount !== 1 ? 's' : ''}`;
  };

  // Convert name to proper case (title case)
  const toProperCase = (name: string): string => {
    return name.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: <FiHome className="h-5 w-5" />
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
        </svg>
      )
    }
  ];

  return (
    <div className={`
      h-screen bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl flex-shrink-0 flex flex-col border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] relative z-[60] transition-all duration-300 overflow-hidden
      ${isCollapsed ? 'w-20' : 'w-full'}
    `}>
      {/* Header Profile / Logo Area */}
      <div className={`p-4 pb-1 ${isCollapsed ? 'px-0 flex flex-col items-center' : ''}`}>
        <div className={`flex items-center justify-between transition-all ${isCollapsed ? 'mb-4 justify-center' : 'mb-4'}`}>
          <div
            className={`flex items-center relative group cursor-pointer transition-all ${isCollapsed ? '' : 'gap-3.5'}`}
            onClick={isCollapsed ? onToggleCollapse : undefined}
          >
            <div className={`w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-md flex items-center justify-center transition-all duration-500 relative overflow-hidden group-hover:rotate-6 group-hover:scale-105 active:scale-95`}>
              <div className={`transition-all duration-500 ${isCollapsed ? 'group-hover:opacity-0 group-hover:scale-50' : 'group-hover:rotate-[-6deg]'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </div>

              {/* Rail Mode Expand Toggle (Right Collapse Icon) */}
              {isCollapsed && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                  <TbLayoutSidebarRightCollapse className="h-6 w-6 text-white" />
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="flex flex-col">
                <h2 className="text-[14.5px] font-extrabold text-[#111111] dark:text-white tracking-tight leading-none">NOLA SMS Pro</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-[#2b83fa] uppercase tracking-widest opacity-80">One Way SMS</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile Close Button */}
            {!isCollapsed && onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden flex p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all active:scale-90"
                title="Close Menu"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}

            {/* Collapse Toggle (Desktop Only) - Now on the right end */}
            {!isCollapsed && (
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 rounded-xl text-gray-400 hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all active:scale-90"
                title="Collapse Sidebar"
              >
                <TbLayoutSidebarLeftCollapse className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* New Message Button */}
        <div className={`mt-1 mb-3 ${isCollapsed ? 'px-2 flex justify-center' : 'px-4'}`}>
          <GlareHover
            glareColor="#ffffff"
            glareOpacity={0.25}
            glareAngle={-30}
            glareSize={300}
            transitionDuration={700}
            playOnce={false}
            className={`
              btn-new-message cursor-pointer group active:scale-95 transition-all
              ${isCollapsed ? 'w-10 h-10 rounded-full shadow-md' : 'w-full rounded-full shadow-md'}
            `}
            style={{ display: 'flex' }}
          >
            <button
              onClick={() => onTabChange('compose')}
              className={`
                w-full h-full flex items-center justify-center gap-2
                text-white bg-transparent border-none
                ${isCollapsed ? 'p-0' : 'py-2.5 px-4'}
              `}
              title="New Message"
            >
              <FiPlus className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-90`} />
              {!isCollapsed && <span className="font-bold text-[13px] tracking-tight">New Message</span>}
            </button>
          </GlareHover>
        </div>

        {/* Navigation List */}
        <nav className={`flex flex-col gap-1 mt-2 ${isCollapsed ? 'items-center px-2' : ''}`}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as ViewTab)}
                className={`
                  flex items-center transition-all duration-300 relative group
                  ${isCollapsed ? 'w-10 h-10 justify-center rounded-xl' : 'w-full gap-2.5 px-2.5 py-1.5 rounded-lg'}
                  ${isActive
                    ? `bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa] ${isCollapsed ? '' : ''}`
                    : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'}
                `}
              >
                {isActive && !isCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-[#2b83fa] rounded-r-full shadow-sm"></div>
                )}
                {isActive && isCollapsed && (
                  <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#2b83fa] rounded-r-full"></div>
                )}
                <div className={`text-[17px] transition-all duration-500 ${isActive ? 'scale-110 text-[#2b83fa]' : 'group-hover:scale-105 group-hover:text-[#2b83fa]'} active:scale-90`}>
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className={`text-[12.5px] transition-all duration-200 ${isActive ? 'font-bold tracking-tight' : 'font-medium'}`}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Activity Feed Section */}
      <div className={`flex-1 min-h-0 flex flex-col mt-4 overflow-hidden ${isCollapsed ? 'items-center' : ''}`}>
        {!isCollapsed && (
          <div className="flex-1 flex flex-col px-2 pb-4 overflow-hidden min-h-0">
            {/* Messages Content */}
            {!loading && directHistory.length === 0 && bulkHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-[20px] bg-[#2b83fa]/10 flex items-center justify-center mb-4 relative group">
                  <div className="absolute inset-0 bg-[#2b83fa]/20 rounded-[20px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <FiPlus className="w-8 h-8 text-[#2b83fa] relative z-10" />
                </div>
                <h3 className="text-[14px] font-bold text-[#111111] dark:text-white mb-1.5">Start a new conversation</h3>
                <p className="text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[160px]">
                  Click the <span className="text-[#2b83fa] font-bold">New Message</span> button above to send your first SMS.
                </p>
              </div>
            ) : (
              <>
                {/* Messages Section Header - Sticky at top */}
                <div className="px-2 py-2 pt-2 border-t border-[#00000005] dark:border-[#ffffff05]">
                  <h2 className="text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Messages</h2>
                </div>

                {/* Direct Messages Header - Sticky */}
                <div
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer border-t border-[#00000005] dark:border-[#ffffff05] pt-2"
                  onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`transition-transform duration-200 ${directMessagesExpanded ? 'rotate-0' : '-rotate-90'}`}>
                      <FiChevronDown className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-[#3c4043] dark:text-[#e8eaed]">Direct Messages</h3>
                  </div>
                  <span className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] bg-[#f1f3f4] dark:bg-[#3c4043] px-1.5 py-0.5 rounded">
                    {directHistory.length}
                  </span>
                </div>

                {/* Direct Messages Content - Pull to refresh + Independent scrollable area */}
                <div
                  ref={contactsListRef}
                  className={`overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 pb-0 ${directMessagesExpanded ? 'max-h-[35vh] opacity-100 mb-2' : 'max-h-0 opacity-0'}`}
                  onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
                  onTouchEnd={(e) => {
                    const delta = e.changedTouches[0].clientY - touchStartY.current;
                    const atTop = (contactsListRef.current?.scrollTop ?? 0) === 0;
                    if (delta > 60 && atTop) loadContacts(true);
                  }}
                >
                  {/* Pull-to-refresh indicator */}
                  {isRefreshing && (
                    <div className="flex justify-center items-center py-2">
                      <svg className="animate-spin h-4 w-4 text-[#2b83fa]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {loading ? (
                      [1, 2, 3, 4, 5].map(i => <SidebarSkeleton key={i} />)
                    ) : (
                      directHistory.map(contact => (
                        <div
                          key={contact.id}
                          className={`
                          group relative transition-all duration-300 overflow-visible
                          px-2 py-1.5 rounded-lg cursor-pointer mb-0.5
                          ${activeContactId === contact.id
                              ? 'bg-white dark:bg-[#1c1e21] shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] ring-1 ring-[#00000005] dark:ring-[#ffffff05]'
                              : 'hover:bg-black/[0.015] dark:hover:bg-white/[0.015]'}
                        `}
                          onClick={() => {
                            onTabChange('compose');
                            onSelectContact(contact);
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] transition-all duration-300 shadow-inner
                            ${activeContactId === contact.id
                                  ? 'bg-[#2b83fa] text-white shadow-[0_4px_8px_rgba(43,131,250,0.2)]'
                                  : 'bg-[#f0f0f0] dark:bg-[#202123] text-[#6e6e73] dark:text-[#ececf1] group-hover:bg-[#e8e8e8] dark:group-hover:bg-[#25262a]'}
                            `}>
                                {(contact.name || contact.phone).charAt(0).toUpperCase()}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#121415] shadow-sm transition-opacity duration-300
                            ${activeContactId === contact.id ? 'bg-green-500 opacity-100' : 'bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100'}
                          `}></span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline mb-0.5">
                                <span className={`text-[12.5px] truncate transition-colors duration-200 ${activeContactId === contact.id ? 'font-bold text-[#111111] dark:text-white' : 'font-semibold text-[#37352f] dark:text-[#ececf1]'}`}>
                                  {toProperCase(contact.name || contact.phone)}
                                </span>
                                <div className="flex items-center gap-1">
                                  {deletingContactId === contact.id ? (
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={confirmDeleteContact}
                                        className="p-1 rounded bg-red-500 text-white hover:bg-red-600 shadow-sm transition-all"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={cancelDeleteContact}
                                        className="p-1 rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 shadow-sm transition-all"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (openMenuId === contact.id) {
                                            setOpenMenuId(null);
                                          } else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMenuAnchor({ x: rect.right, y: rect.bottom });
                                            setOpenMenuId(contact.id);
                                          }
                                        }}
                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[#e8e8e8] dark:hover:bg-[#3c4043] transition-all"
                                      >
                                        <FiMoreVertical className="w-3 h-3 text-[#5f6368] dark:text-[#9aa0a6]" />
                                      </button>
                                      {openMenuId === contact.id && menuAnchor && createPortal(
                                        <div
                                          className="fixed bg-white dark:bg-[#1e1f23] rounded-xl shadow-xl border border-[#0000000a] dark:border-[#ffffff0a] py-1.5 min-w-[110px] z-[99999] animate-in zoom-in-95 duration-150"
                                          style={{ top: menuAnchor.y + 4, left: menuAnchor.x, transform: 'translateX(-100%)', transformOrigin: 'top right' }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteContact(contact.id, e);
                                              setOpenMenuId(null);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-[11.5px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                          >
                                            <FiTrash2 className="w-3 h-3" />
                                            Delete
                                          </button>
                                        </div>,
                                        document.body
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className={`text-[11px] truncate leading-normal transition-colors duration-200 opacity-80 ${activeContactId === contact.id ? 'text-[#2b83fa] dark:text-[#60a5fa]' : 'text-[#6e6e73] dark:text-[#94959b]'}`}>
                                {contact.lastMessage || "(No message yet)"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bulk Messages Header */}
                <div
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer mt-2 border-t border-gray-100 dark:border-white/5 pt-2"
                  onClick={() => setBulkMessagesExpanded(!bulkMessagesExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`transition-transform duration-200 ${bulkMessagesExpanded ? 'rotate-0' : '-rotate-90'}`}>
                      <FiChevronDown className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-[#3c4043] dark:text-[#e8eaed]">Bulk Messages</h3>
                  </div>
                  <span className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] bg-[#f1f3f4] dark:bg-[#3c4043] px-1.5 py-0.5 rounded">{bulkHistory.length}</span>
                </div>

                {/* Bulk Messages Content - Independent scrollable area */}
                <div className={`overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 pb-4 ${bulkMessagesExpanded ? 'max-h-[35vh] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="flex flex-col gap-0.5">
                    {loading ? (
                      [1, 2, 3].map(i => <SidebarSkeleton key={i} />)
                    ) : bulkHistory.length > 0 ? (
                      bulkHistory.map(item => {
                        const isActive = activeBulkMessageId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`
                              group relative transition-all duration-200 rounded-lg mx-1
                              px-2 py-1.5 cursor-pointer overflow-visible
                              ${isActive
                                ? 'bg-white dark:bg-[#1c1e21] shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] ring-1 ring-[#00000005] dark:ring-[#ffffff05]'
                                : 'hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'
                              }
                            `}
                            onClick={() => {
                              onTabChange('compose');
                              if (onSelectBulkMessage) {
                                onSelectBulkMessage(item);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 overflow-visible">
                              <div className="relative flex-shrink-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200
                                  ${isActive
                                    ? 'bg-[#7c3aed] text-white shadow-[0_4px_8px_rgba(124,58,237,0.2)]'
                                    : 'bg-[#ede9fe] text-[#7c3aed] group-hover:bg-[#ddd6fe]'
                                  }
                                `}>
                                  <FiUsers className="w-4 h-4" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 overflow-visible">
                                  <>
                                    <div className="flex justify-between items-baseline mb-0.5">
                                      <span className={`text-[12.5px] truncate transition-colors duration-200 ${isActive ? 'font-bold text-[#111111] dark:text-white' : 'font-semibold text-[#3c4043] dark:text-[#e8eaed]'}`}>
                                        {getBulkDisplayName(item)}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (openMenuId === item.id) {
                                                setOpenMenuId(null);
                                              } else {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setMenuAnchor({ x: rect.right, y: rect.bottom });
                                                setOpenMenuId(item.id);
                                              }
                                            }}
                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[#e8e8e8] dark:hover:bg-[#3c4043] transition-all"
                                          >
                                            <FiMoreVertical className="w-3 h-3 text-[#5f6368] dark:text-[#9aa0a6]" />
                                          </button>
                                          {openMenuId === item.id && menuAnchor && createPortal(
                                            <div
                                              className="fixed bg-white dark:bg-[#1e1f23] rounded-xl shadow-xl border border-[#0000000a] dark:border-[#ffffff0a] py-1.5 min-w-[110px] z-[99999] animate-in zoom-in-95 duration-150"
                                              style={{ top: menuAnchor.y + 4, left: menuAnchor.x, transform: 'translateX(-100%)', transformOrigin: 'top right' }}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStartEdit(item);
                                                  setOpenMenuId(null);
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-[11.5px] text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                                              >
                                                <FiEdit2 className="w-3 h-3" />
                                                Rename
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  startDeleteBulk(item.id, e);
                                                  setOpenMenuId(null);
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-[11.5px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                              >
                                                <FiTrash2 className="w-3 h-3" />
                                                Delete
                                              </button>
                                            </div>,
                                            document.body
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className={`text-[11px] truncate leading-normal opacity-80 ${isActive ? 'text-[#7c3aed] dark:text-[#a78bfa]' : 'text-[#6e6e73] dark:text-[#94959b]'}`}>
                                      {item.message || "(No message sent)"}
                                    </div>
                                  </>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[12px] text-[#9aa0a6] dark:text-[#6e6e73] px-3 py-2 italic">
                        No bulk messages yet
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Settings Only Footer */}
      <div className={`p-4 bg-white/90 dark:bg-[#121415]/90 border-t border-[#0000000a] dark:border-[#ffffff0a] relative z-[70] backdrop-blur-sm ${isCollapsed ? 'px-2 flex justify-center' : ''}`}>
        <button
          onClick={() => onTabChange('settings')}
          className={`
            flex items-center rounded-xl transition-all duration-300 group text-sm
            ${isCollapsed ? 'w-12 h-12 justify-center' : 'w-full gap-3 px-3 py-2.5'}
            ${activeTab === 'settings'
              ? 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa]'
              : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'}
          `}
        >
          <div className={`transition-all duration-500 ${activeTab === 'settings' ? 'scale-110 rotate-90 text-[#2b83fa]' : 'group-hover:scale-110 group-hover:rotate-45 group-hover:text-[#2b83fa]'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {!isCollapsed && <span className="font-semibold text-[13px]">Settings</span>}
        </button>
      </div>

      {/* Rename Modal Portal */}
      {showRenameModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e1f23] rounded-2xl shadow-xl border border-[#0000001a] dark:border-[#ffffff1a] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 pb-4">
              <h3 className="text-lg font-bold text-[#111111] dark:text-white mb-4">Rename Conversation</h3>
              <input
                type="text"
                value={editingBulkName}
                onChange={(e) => setEditingBulkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(editingBulkId!);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
                placeholder="Enter new name"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-[#111111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/50 transition-all font-medium"
              />
            </div>
            <div className="flex bg-gray-50 dark:bg-black/40 border-t border-gray-100 dark:border-white/5 p-4 gap-3 justify-end mt-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingBulkId!)}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#2b83fa] hover:bg-[#1d6ee6] shadow-sm transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Bulk Confirmation Modal */}
      {deletingBulkId && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e1f23] rounded-2xl shadow-xl border border-[#0000001a] dark:border-[#ffffff1a] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 pb-4">
              <h3 className="text-lg font-bold text-[#111111] dark:text-white mb-2">Delete conversation?</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">
                This will remove the bulk conversation and its messages from this account&apos;s inbox. This action can&apos;t be undone.
              </p>
            </div>
            <div className="flex bg-gray-50 dark:bg-black/40 border-t border-gray-100 dark:border-white/5 p-4 gap-3 justify-end mt-2">
              <button
                onClick={cancelDeleteBulk}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteBulk}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
