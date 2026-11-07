import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useTranslation } from "../context/LanguageContext";
import {
  MdLabel,
  MdArrowBack,
  MdInbox,
  MdStarBorder,
  MdAccessTime,
  MdLabelImportant,
  MdSend,
  MdSchedule,
  MdDrafts,
  MdMailOutline,
  MdReport,
  MdDelete,
  MdDeleteOutline,
  MdShoppingBag,
  MdPeople,
  MdInfoOutline,
  MdForum,
  MdCampaign,
  MdAdd,
  MdEdit,
  MdClose,
  MdWarningAmber,
  MdCheck
} from "react-icons/md";
import toast from "react-hot-toast";
import {
  getCustomLabelVisibility,
  setCustomLabelVisibility,
  getCategoryPreferences,
  setCategoryPreference,
  getImapPreferences,
  setImapPreference
} from "../utils/labelPreferences";

const LABEL_COLORS = [
  "#135bec",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
  "#3b82f6"
];

const LabelManagement = ({ embedded = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, sidebarPreferences, setSidebarPreferences } = useTheme();
  const {
    labels = [],
    fetchLabels,
    handleCreateLabel,
    handleUpdateLabel,
    handleDeleteLabel
  } = useMail();

  // Local state for IMAP and Categories
  const [imapPrefs, setImapPrefs] = useState(() => getImapPreferences());
  const [catPrefs, setCatPrefs] = useState(() => getCategoryPreferences());
  const [customVisibility, setCustomVisibility] = useState({});

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#135bec");
  const [newLabelParentId, setNewLabelParentId] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editingLabel, setEditingLabel] = useState(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState("#135bec");
  const [editLabelParentId, setEditLabelParentId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [labelToDelete, setLabelToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Sync custom labels visibility state
  const loadCustomVisibility = () => {
    const map = {};
    labels.forEach((lbl) => {
      map[String(lbl.id)] = getCustomLabelVisibility(lbl.id);
    });
    setCustomVisibility(map);
  };

  useEffect(() => {
    loadCustomVisibility();
  }, [labels]);

  useEffect(() => {
    const handleSync = () => {
      setImapPrefs(getImapPreferences());
      setCatPrefs(getCategoryPreferences());
      loadCustomVisibility();
    };
    window.addEventListener("bnx-label-prefs-changed", handleSync);
    return () => window.removeEventListener("bnx-label-prefs-changed", handleSync);
  }, [labels]);

  // System Labels Definitions
  const systemLabels = useMemo(
    () => [
      {
        id: "Inbox",
        name: "Inbox",
        icon: <MdInbox size={18} className="text-gray-500 dark:text-gray-400" />,
        alwaysShown: true
      },
      {
        id: "Starred",
        name: "Starred",
        icon: <MdStarBorder size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Starred"
      },
      {
        id: "Snoozed",
        name: "Snoozed",
        icon: <MdAccessTime size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Snoozed"
      },
      {
        id: "Important",
        name: "Important",
        icon: <MdLabelImportant size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Important"
      },
      {
        id: "Sent",
        name: "Sent",
        icon: <MdSend size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Sent"
      },
      {
        id: "Scheduled",
        name: "Scheduled",
        icon: <MdSchedule size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Scheduled"
      },
      {
        id: "Drafts",
        name: "Drafts",
        icon: <MdDrafts size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Draft"
      },
      {
        id: "All Mail",
        name: "All Mail",
        icon: <MdMailOutline size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "All Mail"
      },
      {
        id: "Spam",
        name: "Spam",
        icon: <MdReport size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Spam"
      },
      {
        id: "Trash",
        name: "Trash",
        icon: <MdDelete size={18} className="text-gray-500 dark:text-gray-400" />,
        prefKey: "Trash"
      }
    ],
    []
  );

  // Category Definitions
  const categories = useMemo(
    () => [
      {
        id: "Purchases",
        name: "Purchases",
        icon: <MdShoppingBag size={18} className="text-gray-500 dark:text-gray-400" />
      },
      {
        id: "Social",
        name: "Social",
        icon: <MdPeople size={18} className="text-gray-500 dark:text-gray-400" />
      },
      {
        id: "Updates",
        name: "Updates",
        icon: <MdInfoOutline size={18} className="text-gray-500 dark:text-gray-400" />
      },
      {
        id: "Forums",
        name: "Forums",
        icon: <MdForum size={18} className="text-gray-500 dark:text-gray-400" />
      },
      {
        id: "Promotions",
        name: "Promotions",
        icon: <MdCampaign size={18} className="text-gray-500 dark:text-gray-400" />
      }
    ],
    []
  );

  // Handle System Label Sidebar Toggle
  const handleToggleSystemSidebar = (item) => {
    if (item.alwaysShown) return;
    const prefKey = item.prefKey || item.name;
    const currentVal = sidebarPreferences?.[prefKey] !== false;
    const nextVal = !currentVal;
    const updated = {
      ...sidebarPreferences,
      [prefKey]: nextVal
    };
    if (prefKey === "Draft") {
      updated["Drafts"] = nextVal;
      updated["draft"] = nextVal;
    }
    setSidebarPreferences(updated);
  };

  // Handle System Label IMAP Toggle
  const handleToggleSystemImap = (labelName) => {
    const current = imapPrefs[labelName] !== false;
    const next = !current;
    setImapPreference(labelName, next);
    setImapPrefs((prev) => ({ ...prev, [labelName]: next }));
  };

  // Handle Category Toggle
  const handleToggleCategory = (catName, field) => {
    const current = catPrefs[catName] || { showInLabelList: true, showInMessageList: true };
    const nextVal = !current[field];
    setCategoryPreference(catName, { [field]: nextVal });
    setCatPrefs((prev) => ({
      ...prev,
      [catName]: {
        ...(prev[catName] || { showInLabelList: true, showInMessageList: true }),
        [field]: nextVal
      }
    }));
  };

  // Handle Custom Label Visibility Toggle
  const handleToggleCustomVisibility = (labelId, field) => {
    const strId = String(labelId);
    const current = customVisibility[strId] || { showInLabelList: true, showInMessageList: true };
    const nextVal = !current[field];
    setCustomLabelVisibility(labelId, { [field]: nextVal });
    setCustomVisibility((prev) => ({
      ...prev,
      [strId]: {
        ...(prev[strId] || { showInLabelList: true, showInMessageList: true }),
        [field]: nextVal
      }
    }));
  };

  // Create Label Handler
  const handleOpenCreateModal = () => {
    setNewLabelName("");
    setNewLabelColor("#135bec");
    setNewLabelParentId("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) {
      toast.error("Please enter a label name.");
      return;
    }

    const isDuplicate = labels.some(
      (l) => l.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`A label with the name "${trimmed}" already exists.`);
      return;
    }

    setCreateSubmitting(true);
    try {
      const parentId = newLabelParentId ? parseInt(newLabelParentId, 10) : null;
      const res = await handleCreateLabel(trimmed, newLabelColor, parentId);
      if (res) {
        setIsCreateOpen(false);
        setNewLabelName("");
        if (typeof fetchLabels === "function") fetchLabels();
      }
    } catch (err) {
      console.error("Create label failed:", err);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Edit Label Handler
  const handleOpenEditModal = (label) => {
    setEditingLabel(label);
    setEditLabelName(label.name || "");
    setEditLabelColor(label.colorHex || "#135bec");
    setEditLabelParentId(label.parentId ? String(label.parentId) : "");
  };

  const handleEditSubmit = async (e) => {
    e?.preventDefault();
    if (!editingLabel) return;
    const trimmed = editLabelName.trim();
    if (!trimmed) {
      toast.error("Label name cannot be empty.");
      return;
    }

    const isDuplicate = labels.some(
      (l) =>
        String(l.id) !== String(editingLabel.id) &&
        l.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`Another label with the name "${trimmed}" already exists.`);
      return;
    }

    setEditSubmitting(true);
    try {
      const parentId = editLabelParentId ? parseInt(editLabelParentId, 10) : null;
      const success = await handleUpdateLabel(
        editingLabel.id,
        trimmed,
        editLabelColor,
        parentId
      );
      if (success) {
        setEditingLabel(null);
        if (typeof fetchLabels === "function") fetchLabels();
      }
    } catch (err) {
      console.error("Update label failed:", err);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Remove/Delete Label Handler
  const handleConfirmDelete = async () => {
    if (!labelToDelete) return;
    setDeleteSubmitting(true);
    try {
      await handleDeleteLabel(labelToDelete.id);
      setLabelToDelete(null);
      if (typeof fetchLabels === "function") fetchLabels();
    } catch (err) {
      console.error("Delete label failed:", err);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-y-auto hidden-scrollbar transition-colors"
      style={{
        backgroundColor: embedded
          ? "transparent"
          : theme.mode === "dark"
          ? "#111827"
          : "#f0f5fc"
      }}
    >
      {/* Top Breadcrumb Navigation */}
      {!embedded && (
        <div className="pt-4 px-4 sm:px-6 md:px-8 pb-1">
          <button
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white/70 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-xs transition-all cursor-pointer"
          >
            <MdArrowBack size={15} />
            <span>Settings</span>
            <span className="text-gray-400 dark:text-gray-500 font-normal">&gt;</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">Label management</span>
          </button>
        </div>
      )}

      {/* Page Title Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-3 pb-5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
          <MdLabel size={20} />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            Label management
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Create, edit, remove, and manage how labels appear in your BNXmail.
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="px-4 sm:px-6 md:px-8 pb-10 flex flex-col gap-6 w-full max-w-6xl">
        {/* ========================================================= */}
        {/* 1. SYSTEM LABELS CARD */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-gray-800/90 rounded-2xl border border-blue-100/70 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700/60">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              System labels
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold select-none">
                  <th className="py-2.5 px-5 w-[40%] font-semibold">Label</th>
                  <th className="py-2.5 px-4 w-[35%] font-semibold">Show in label list</th>
                  <th className="py-2.5 px-4 w-[25%] font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Show in IMAP
                      <span
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help text-[11px]"
                        title="Display this folder/label in external IMAP email clients"
                      >
                        ⓘ
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                {systemLabels.map((item) => {
                  const prefKey = item.prefKey || item.name;
                  const isVisibleInSidebar = item.alwaysShown
                    ? true
                    : sidebarPreferences?.[prefKey] !== false;
                  const isImapEnabled = imapPrefs[item.name] !== false;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-gray-750/30 transition-colors"
                    >
                      {/* Label Name & Icon */}
                      <td className="py-2 px-5 font-medium text-gray-800 dark:text-gray-200">
                        <div className="flex items-center gap-2.5">
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                      </td>

                      {/* Show in label list */}
                      <td className="py-2 px-4">
                        {item.alwaysShown ? (
                          <label className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 cursor-not-allowed select-none">
                            <input
                              type="checkbox"
                              checked={true}
                              disabled={true}
                              className="rounded text-gray-400 border-gray-300 dark:border-gray-600 focus:ring-0 cursor-not-allowed"
                            />
                            <span>Always shown</span>
                          </label>
                        ) : (
                          <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isVisibleInSidebar}
                              onChange={() => handleToggleSystemSidebar(item)}
                              className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Show in label list</span>
                          </label>
                        )}
                      </td>

                      {/* Show in IMAP */}
                      <td className="py-2 px-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isImapEnabled}
                            onChange={() => handleToggleSystemImap(item.name)}
                            className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. CATEGORIES CARD */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-gray-800/90 rounded-2xl border border-blue-100/70 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700/60">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Categories
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold select-none">
                  <th className="py-2.5 px-5 w-[40%] font-semibold">Category</th>
                  <th className="py-2.5 px-4 w-[35%] font-semibold">Show in label list</th>
                  <th className="py-2.5 px-4 w-[25%] font-semibold">Show in message list</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                {categories.map((cat) => {
                  const prefs = catPrefs[cat.name] || {
                    showInLabelList: true,
                    showInMessageList: true
                  };

                  return (
                    <tr
                      key={cat.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-gray-750/30 transition-colors"
                    >
                      {/* Category Name & Icon */}
                      <td className="py-2 px-5 font-medium text-gray-800 dark:text-gray-200">
                        <div className="flex items-center gap-2.5">
                          <span className="shrink-0">{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </div>
                      </td>

                      {/* Show in label list */}
                      <td className="py-2 px-4">
                        <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={prefs.showInLabelList !== false}
                            onChange={() => handleToggleCategory(cat.name, "showInLabelList")}
                            className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Show</span>
                        </label>
                      </td>

                      {/* Show in message list */}
                      <td className="py-2 px-4">
                        <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={prefs.showInMessageList !== false}
                            onChange={() => handleToggleCategory(cat.name, "showInMessageList")}
                            className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Show</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. CUSTOM LABELS CARD */}
        {/* ========================================================= */}
        <section className="bg-white dark:bg-gray-800/90 rounded-2xl border border-blue-100/70 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Labels
            </h2>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#135bec] hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer select-none"
            >
              <MdAdd size={16} />
              <span>Create new label</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold select-none">
                  <th className="py-2.5 px-5 w-[35%] font-semibold">Label</th>
                  <th className="py-2.5 px-4 w-[25%] font-semibold">Show in label list</th>
                  <th className="py-2.5 px-4 w-[25%] font-semibold">Show in message list</th>
                  <th className="py-2.5 px-4 w-[15%] text-right pr-6 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                {labels.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-gray-400 dark:text-gray-500 italic text-xs"
                    >
                      No custom labels yet. Click &quot;Create new label&quot; to add your first label.
                    </td>
                  </tr>
                ) : (
                  labels.map((lbl) => {
                    const strId = String(lbl.id);
                    const prefs = customVisibility[strId] || {
                      showInLabelList: true,
                      showInMessageList: true
                    };

                    return (
                      <tr
                        key={lbl.id}
                        className="hover:bg-blue-50/30 dark:hover:bg-gray-750/30 transition-colors"
                      >
                        {/* Label Name & Color Icon */}
                        <td className="py-2.5 px-5 font-medium text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center shadow-2xs"
                              style={{ backgroundColor: lbl.colorHex || "#135bec" }}
                            />
                            <span className="font-semibold truncate max-w-[220px]" title={lbl.name}>
                              {lbl.name}
                            </span>
                          </div>
                        </td>

                        {/* Show in label list */}
                        <td className="py-2.5 px-4">
                          <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={prefs.showInLabelList !== false}
                              onChange={() => handleToggleCustomVisibility(lbl.id, "showInLabelList")}
                              className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Show</span>
                          </label>
                        </td>

                        {/* Show in message list */}
                        <td className="py-2.5 px-4">
                          <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={prefs.showInMessageList !== false}
                              onChange={() => handleToggleCustomVisibility(lbl.id, "showInMessageList")}
                              className="rounded text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Show</span>
                          </label>
                        </td>

                        {/* Actions: Edit & Remove */}
                        <td className="py-2.5 px-4 text-right pr-6">
                          <div className="inline-flex items-center justify-end gap-3 select-none">
                            <button
                              onClick={() => handleOpenEditModal(lbl)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              title="Edit label"
                            >
                              <MdEdit size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setLabelToDelete(lbl)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:underline cursor-pointer"
                              title="Remove label"
                            >
                              <MdDeleteOutline size={15} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ========================================================= */}
      {/* CREATE NEW LABEL MODAL */}
      {/* ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-xs px-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                New label
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Please enter a new label name:
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Finance, Projects, Work"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Label color:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewLabelColor(c)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-xs"
                      style={{
                        backgroundColor: c,
                        boxShadow: newLabelColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none"
                      }}
                    >
                      {newLabelColor === c && <MdCheck size={16} className="text-white drop-shadow-xs" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nesting (optional) */}
              {labels.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nest label under: (optional)
                  </label>
                  <select
                    value={newLabelParentId}
                    onChange={(e) => setNewLabelParentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Top level (no parent)</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newLabelName.trim() || createSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#135bec] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {createSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT LABEL MODAL */}
      {/* ========================================================= */}
      {editingLabel && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-xs px-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Edit label
              </h3>
              <button
                type="button"
                onClick={() => setEditingLabel(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Label name:
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editLabelName}
                  onChange={(e) => setEditLabelName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Label color:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditLabelColor(c)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-xs"
                      style={{
                        backgroundColor: c,
                        boxShadow: editLabelColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none"
                      }}
                    >
                      {editLabelColor === c && <MdCheck size={16} className="text-white drop-shadow-xs" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nesting (optional) */}
              {labels.filter((l) => String(l.id) !== String(editingLabel.id)).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nest label under: (optional)
                  </label>
                  <select
                    value={editLabelParentId}
                    onChange={(e) => setEditLabelParentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Top level (no parent)</option>
                    {labels
                      .filter((l) => String(l.id) !== String(editingLabel.id))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingLabel(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editLabelName.trim() || editSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#135bec] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {editSubmitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      {labelToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-xs px-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                <MdWarningAmber size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Delete label?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Are you sure you want to delete the label{" "}
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    &quot;{labelToDelete.name}&quot;
                  </span>
                  ?
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  (Emails with this label will not be deleted.)
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLabelToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabelManagement;

