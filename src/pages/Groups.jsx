import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdChat, MdGroupAdd, MdPersonAdd, MdSearch, MdGroup, MdMoreVert, MdArchive, MdUnarchive, MdDeleteOutline, MdStar, MdStarBorder } from "react-icons/md";
import { chatAPI } from "../services/api";
import chatCache from "../services/chatCache";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";

const Groups = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { theme } = useTheme();

    // Determine view modes: Groups vs Direct, and dedicated sub-views (Archived, Starred)
    const isArchivedView = location.pathname === '/colab/archived';
    const isStarredView = location.pathname === '/colab/starred';
    const isGroupsMode = location.pathname.includes('/colab');
    const modeTitle = isArchivedView 
        ? "Archived Colab Groups" 
        : isStarredView
        ? "Starred Colab Groups"
        : (isGroupsMode ? "Colab" : "Direct Messages");
    const modeIcon = isArchivedView 
        ? <MdArchive className="text-primary" /> 
        : isStarredView
        ? <MdStar className="text-amber-400" />
        : (isGroupsMode ? <MdGroup className="text-primary" /> : <MdChat className="text-primary" />);
    const modeSubtitle = isArchivedView
        ? "View and manage your archived colab groups"
        : isStarredView
        ? "View your starred colab groups"
        : (isGroupsMode ? "Collaborate with your teams" : "Your private conversations");

    // Instant initial load from cache (< 50ms)
    const [chats, setChats] = useState(() => chatCache.getUserChats(user?.email) || []);
    const [loading, setLoading] = useState(() => !chatCache.hasUserChats(user?.email));
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showStartDirect, setShowStartDirect] = useState(false);

    const [pendingInvitations, setPendingInvitations] = useState(() => chatCache.getInvitations() || []);
    const [showInvitationsModal, setShowInvitationsModal] = useState(false);

    const [openMenuChatId, setOpenMenuChatId] = useState(null);
    const [groupToDelete, setGroupToDelete] = useState(null);
    const [archivedGroupIds, setArchivedGroupIds] = useState(() => {
        try {
            const saved = localStorage.getItem('bnx_colab_archived_group_ids');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });
    const [starredGroupIds, setStarredGroupIds] = useState(() => {
        try {
            const saved = localStorage.getItem('bnx_colab_starred_group_ids');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });

    const [groupData, setGroupData] = useState({ name: "", members: "" });
    const [directEmail, setDirectEmail] = useState("");

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuChatId(null);
        };
        if (openMenuChatId !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [openMenuChatId]);

    useEffect(() => {
        setSearchTerm("");
        setOpenMenuChatId(null);
    }, [location.pathname]);

    const handleArchiveGroup = async (chat, e) => {
        if (e) e.stopPropagation();
        setOpenMenuChatId(null);
        const chatId = String(chat.id);

        setArchivedGroupIds(prev => {
            const next = new Set(prev);
            next.add(chatId);
            try {
                localStorage.setItem('bnx_colab_archived_group_ids', JSON.stringify(Array.from(next)));
            } catch (err) {}
            return next;
        });

        toast.success(`"${chat.name || 'Group'}" archived`);

        try {
            if (typeof chatAPI.archiveGroup === 'function') {
                await chatAPI.archiveGroup(chat.id);
            } else if (typeof chatAPI.archiveChat === 'function') {
                await chatAPI.archiveChat(chat.id);
            }
        } catch (err) {
            console.warn("Backend chat archive API call failed:", err);
        }
    };

    const handleUnarchiveGroup = async (chat, e) => {
        if (e) e.stopPropagation();
        setOpenMenuChatId(null);
        const chatId = String(chat.id);

        setArchivedGroupIds(prev => {
            const next = new Set(prev);
            next.delete(chatId);
            try {
                localStorage.setItem('bnx_colab_archived_group_ids', JSON.stringify(Array.from(next)));
            } catch (err) {}
            return next;
        });

        toast.success(`"${chat.name || 'Group'}" unarchived`);
    };

    const handleToggleStarGroup = (chat, e) => {
        if (e) e.stopPropagation();
        setOpenMenuChatId(null);
        const chatId = String(chat.id);
        const isCurrentlyStarred = starredGroupIds.has(chatId);

        setStarredGroupIds(prev => {
            const next = new Set(prev);
            if (isCurrentlyStarred) {
                next.delete(chatId);
            } else {
                next.add(chatId);
            }
            try {
                localStorage.setItem('bnx_colab_starred_group_ids', JSON.stringify(Array.from(next)));
            } catch (err) {}
            return next;
        });

        if (isCurrentlyStarred) {
            toast.success(`Removed star from "${chat.name || 'Group'}"`);
        } else {
            toast.success(`Starred "${chat.name || 'Group'}"`);
        }

        try {
            if (typeof chatAPI.toggleStarGroup === 'function') {
                chatAPI.toggleStarGroup(chat.id);
            } else if (typeof chatAPI.starGroup === 'function') {
                chatAPI.starGroup(chat.id, !isCurrentlyStarred);
            }
        } catch (err) {
            console.warn("Backend chat star API call failed:", err);
        }
    };

    const handleConfirmDeleteGroup = async () => {
        if (!groupToDelete) return;
        try {
            setLoading(true);
            await chatAPI.deleteGroup(groupToDelete.id);
            toast.success(`Group "${groupToDelete.name || 'Group'}" deleted`);

            setArchivedGroupIds(prev => {
                const next = new Set(prev);
                next.delete(String(groupToDelete.id));
                try {
                    localStorage.setItem('bnx_colab_archived_group_ids', JSON.stringify(Array.from(next)));
                } catch (e) {}
                return next;
            });

            setStarredGroupIds(prev => {
                const next = new Set(prev);
                next.delete(String(groupToDelete.id));
                try {
                    localStorage.setItem('bnx_colab_starred_group_ids', JSON.stringify(Array.from(next)));
                } catch (e) {}
                return next;
            });

            setChats(prev => prev.filter(c => c.id !== groupToDelete.id));
            setGroupToDelete(null);
        } catch (err) {
            console.error("Failed to delete group:", err);
            toast.error("Failed to delete group");
        } finally {
            setLoading(false);
        }
    };

    const fetchChats = async (isBackground = false) => {
        if (!user?.email) return;
        try {
            if (!isBackground && chats.length === 0) {
                setLoading(true);
            }
            const res = await chatAPI.getUserChats(user.email);
            if (res.data) {
                const chatList = Array.isArray(res.data) ? res.data : (res.data.data || []);
                setChats(chatList);
                chatCache.setUserChats(user.email, chatList);
            }
        } catch (err) {
            console.error("Failed to load chats:", err);
            if (!isBackground && chats.length === 0) {
                toast.error("Failed to load conversations");
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchInvitations = async () => {
        if (!user?.email) return;
        try {
            const res = await chatAPI.getInvitations();
            if (res.data) {
                setPendingInvitations(res.data);
                chatCache.setInvitations(res.data);
            }
        } catch (err) {
            console.error("Failed to load invitations", err);
        }
    };

    useEffect(() => {
        // If we already have cached chats, revalidate silently without full spinner
        const hasCached = chatCache.hasUserChats(user?.email);
        if (hasCached) {
            setChats(chatCache.getUserChats(user?.email));
            setLoading(false);
        }
        fetchChats(hasCached);
        fetchInvitations();
    }, [user?.email, isGroupsMode]);

    const handleAcceptInvitation = async (id) => {
        try {
            await chatAPI.acceptInvitation(id);
            toast.success("Invitation accepted!");
            fetchInvitations();
            fetchChats();
            if (pendingInvitations.length <= 1) {
                setShowInvitationsModal(false);
            }
        } catch (err) {
            toast.error("Failed to accept invitation");
        }
    };

    const handleRejectInvitation = async (id) => {
        try {
            await chatAPI.rejectInvitation(id);
            toast.success("Invitation rejected");
            fetchInvitations();
            if (pendingInvitations.length <= 1) {
                setShowInvitationsModal(false);
            }
        } catch (err) {
            toast.error("Failed to reject invitation");
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        const memberEmails = groupData.members.split(/[\s,]+/).filter(e => e.includes('@'));
        if (!groupData.name || memberEmails.length === 0) {
            toast.error("Group name and at least one member required");
            return;
        }

        try {
            setLoading(true);
            const res = await chatAPI.createGroupChat({
                name: groupData.name,
                members: [...memberEmails, user.email]
            });
            if (res.data) {
                toast.success("Group created!");
                setShowCreateGroup(false);
                setGroupData({ name: "", members: "" });
                fetchChats();
            }
        } catch (err) {
            toast.error("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    const handleStartDirect = async (e) => {
        e.preventDefault();
        if (!directEmail.includes('@')) {
            toast.error("Valid email required");
            return;
        }

        try {
            setLoading(true);
            const res = await chatAPI.createDirectChat({
                user1: user.email,
                user2: directEmail
            });
            if (res.data) {
                toast.success("Chat started!");
                setShowStartDirect(false);
                setDirectEmail("");
                fetchChats();
            }
        } catch (err) {
            toast.error("Failed to start chat");
        } finally {
            setLoading(false);
        }
    };

    // Filter by search AND by type (GROUP vs DIRECT) and exclude archived groups
    const filteredChats = chats.filter(chat => {
        if (archivedGroupIds.has(String(chat.id))) return false;

        const matchesSearch = 
            chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            chat.memberEmails?.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesMode = isGroupsMode ? chat.type === 'GROUP' : chat.type === 'DIRECT';
        
        return matchesSearch && matchesMode;
    });

    // Archived groups for Colab
    const archivedChats = chats.filter(chat => {
        if (!archivedGroupIds.has(String(chat.id))) return false;
        if (chat.type !== 'GROUP') return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return chat.name?.toLowerCase().includes(q) ||
                   chat.memberEmails?.some(email => email.toLowerCase().includes(q));
        }
        return true;
    });

    // Starred groups for Colab (active, starred groups)
    const starredChats = chats.filter(chat => {
        if (!starredGroupIds.has(String(chat.id))) return false;
        if (archivedGroupIds.has(String(chat.id))) return false;
        if (chat.type !== 'GROUP') return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return chat.name?.toLowerCase().includes(q) ||
                   chat.memberEmails?.some(email => email.toLowerCase().includes(q));
        }
        return true;
    });

    const renderGroupCard = (chat, isArchived = false) => {
        const chatPartner = chat.memberEmails?.find(e => e !== user.email);
        const chatDisplayName = chat.type === 'DIRECT' ? chatPartner?.split('@')[0] : (chat.name || 'Unnamed');
        const menuKey = isArchived ? `archived-${chat.id}` : `active-${chat.id}`;
        const isStarred = starredGroupIds.has(String(chat.id));

        return (
            <div 
                key={chat.id}
                onMouseEnter={() => chatCache.prefetchChat(chat.id, chatAPI)}
                onClick={() => navigate(`/chat/${chat.id}`, { state: { chat } })}
                className="group relative p-5 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-gray-800/40 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1"
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0 ${chat.type === 'GROUP' ? 'bg-gradient-to-br from-primary to-purple-600' : 'bg-gradient-to-br from-teal-500 to-blue-600'}`}>
                            {chatDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="font-bold text-lg leading-tight truncate" style={{ color: theme.text }}>
                                    {chatDisplayName}
                                </h3>
                                {isStarred && (
                                    <MdStar size={16} className="text-amber-400 shrink-0" title="Starred" />
                                )}
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                                {chat.type}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {!isArchived && chat.unreadCount > 0 && (
                            <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                {chat.unreadCount}
                            </span>
                        )}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuChatId(prev => prev === menuKey ? null : menuKey);
                                }}
                                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                                title="More options"
                            >
                                <MdMoreVert size={18} />
                            </button>
                            {openMenuChatId === menuKey && (
                                <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 animate-in fade-in zoom-in-95 duration-150 select-none text-left"
                                >
                                    {isArchived ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={(e) => handleUnarchiveGroup(chat, e)}
                                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <MdUnarchive size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                                <span>Unarchive</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuChatId(null);
                                                    setGroupToDelete(chat);
                                                }}
                                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <MdDeleteOutline size={16} className="text-red-500 shrink-0" />
                                                <span>Delete</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={(e) => handleArchiveGroup(chat, e)}
                                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <MdArchive size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                                <span>Archive</span>
                                            </button>
                                            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleStarGroup(chat, e)}
                                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                {isStarred ? (
                                                    <MdStar size={16} className="text-amber-400 shrink-0" />
                                                ) : (
                                                    <MdStarBorder size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                                                )}
                                                <span>Star</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-sm opacity-70 line-clamp-2 mb-4 h-10" style={{ color: theme.subText }}>
                    {chat.lastMessage || "No messages yet"}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200/30 dark:border-gray-700/30 text-xs font-medium">
                    <span style={{ color: theme.subText }}>
                        {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : 'Active now'}
                    </span>
                    <span className="text-primary group-hover:underline">Open chat &rarr;</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
            {/* HEADER */}
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between bg-white/30 dark:bg-gray-900/30 backdrop-blur-md shrink-0 relative z-10">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: theme.text }}>
                        {modeIcon}
                        {modeTitle}
                    </h2>
                    <p className="text-sm opacity-60" style={{ color: theme.subText }}>
                        {modeSubtitle}
                    </p>
                </div>
                <div className="flex gap-3">
                    {!isArchivedView && !isStarredView && (
                        isGroupsMode ? (
                            <button 
                                onClick={() => setShowCreateGroup(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 transition-all font-medium shadow-md cursor-pointer"
                            >
                                <MdGroupAdd size={20} />
                                New Colab
                            </button>
                        ) : (
                            <button 
                                onClick={() => setShowStartDirect(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-all font-medium cursor-pointer"
                            >
                                <MdPersonAdd size={20} />
                                New Chat
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* INVITATIONS BANNER */}
            {pendingInvitations.length > 0 && isGroupsMode && !isArchivedView && !isStarredView && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-between shadow-sm animate-fade-in">
                    <div className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
                        <MdPersonAdd size={24} />
                        <div>
                            <p className="font-semibold">You have {pendingInvitations.length} pending Colab invitation{pendingInvitations.length > 1 ? 's' : ''}</p>
                            <p className="text-sm opacity-80">Review your invitations to join new groups.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowInvitationsModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                    >
                        View Invitations
                    </button>
                </div>
            )}

            {/* SEARCH & FILTER */}
            <div className="px-6 py-4">
                <div className="relative">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder={`Search ${isArchivedView ? 'archived colab groups' : isStarredView ? 'starred colab groups' : (isGroupsMode ? 'colab groups' : 'messages')}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-800/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        style={{ color: theme.text }}
                    />
                </div>
            </div>

            {/* CHAT LIST */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 hidden-scrollbar">
                {isArchivedView ? (
                    loading && chats.length === 0 ? (
                        <div className="flex justify-center p-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : archivedChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 opacity-50">
                            <MdArchive size={64} className="mb-4 text-primary" />
                            <p className="text-lg font-medium">No archived colab groups found</p>
                            <p className="text-sm">Groups you archive will appear here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {archivedChats.map(chat => renderGroupCard(chat, true))}
                        </div>
                    )
                ) : isStarredView ? (
                    loading && chats.length === 0 ? (
                        <div className="flex justify-center p-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : starredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 opacity-50">
                            <MdStarBorder size={64} className="mb-4 text-amber-400" />
                            <p className="text-lg font-medium">No starred colab groups</p>
                            <p className="text-sm">Click the three-dot menu on any group card and select Star to add it here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {starredChats.map(chat => renderGroupCard(chat, false))}
                        </div>
                    )
                ) : (
                    loading && chats.length === 0 ? (
                        <div className="flex justify-center p-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 opacity-50">
                            {isGroupsMode ? <MdGroup size={64} className="mb-4" /> : <MdChat size={64} className="mb-4" />}
                            <p className="text-lg font-medium">No {isGroupsMode ? 'colab groups' : 'messages'} found</p>
                            <p className="text-sm">
                                {isGroupsMode ? 'Create a colab group to start collaborating' : 'Start a new chat to begin messaging'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredChats.map(chat => renderGroupCard(chat, false))}
                        </div>
                    )
                )}
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {groupToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 text-left">
                        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
                            Delete Colab Group?
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Are you sure you want to permanently delete <strong className="text-gray-700 dark:text-gray-200">"{groupToDelete.name || 'this group'}"</strong>? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setGroupToDelete(null)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteGroup}
                                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            {(showCreateGroup || showStartDirect) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4" style={{ color: theme.text }}>
                                {showCreateGroup ? 'Create Colab Group' : 'Start Direct Chat'}
                            </h3>
                            <form onSubmit={showCreateGroup ? handleCreateGroup : handleStartDirect}>
                                {showCreateGroup ? (
                                    <>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium mb-1 opacity-70">Colab Group Name</label>
                                            <input 
                                                autoFocus
                                                value={groupData.name}
                                                onChange={(e) => setGroupData({...groupData, name: e.target.value})}
                                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
                                                placeholder="e.g. Project Alpha"
                                            />
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium mb-1 opacity-70">Member Emails</label>
                                            <textarea 
                                                value={groupData.members}
                                                onChange={(e) => setGroupData({...groupData, members: e.target.value})}
                                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px] resize-none"
                                                placeholder="user1@bnxmail.com, user2@bnxmail.com"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 opacity-70">Recipient Email</label>
                                        <input 
                                            autoFocus
                                            type="email"
                                            value={directEmail}
                                            onChange={(e) => setDirectEmail(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="someone@bnxmail.com"
                                        />
                                    </div>
                                )}
                                <div className="flex gap-3 mt-6">
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-all"
                                    >
                                        {loading ? 'Processing...' : (showCreateGroup ? 'Create Colab' : 'Start Chat')}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => { setShowCreateGroup(false); setShowStartDirect(false); }}
                                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                        style={{ color: theme.text }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* INVITATIONS MODAL */}
            {showInvitationsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" style={{ borderColor: theme.border, borderWidth: '1px' }}>
                        <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
                            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: theme.text }}>
                                <MdPersonAdd className="text-primary" />
                                Pending Invitations
                            </h3>
                            <button onClick={() => setShowInvitationsModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" style={{ color: theme.subText }}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto">
                            {pendingInvitations.length === 0 ? (
                                <p className="text-center py-4" style={{ color: theme.subText }}>No pending invitations.</p>
                            ) : (
                                <div className="space-y-4">
                                    {pendingInvitations.map(inv => (
                                        <div key={inv.id} className="p-4 rounded-xl border flex flex-col gap-3" style={{ borderColor: theme.border, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                            <div>
                                                <p className="font-bold text-lg" style={{ color: theme.text }}>{inv.chatName || "Direct Chat"}</p>
                                                <p className="text-sm" style={{ color: theme.subText }}>
                                                    Invited by: <span className="font-medium text-primary">{inv.inviterEmail}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2 w-full pt-2">
                                                <button 
                                                    onClick={() => handleAcceptInvitation(inv.id)}
                                                    className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                                                >
                                                    Accept
                                                </button>
                                                <button 
                                                    onClick={() => handleRejectInvitation(inv.id)}
                                                    className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Groups;
