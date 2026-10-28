import { useTranslation } from "../context/LanguageContext";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { useAuth } from "../context/AuthContext";
import { templateAPI } from "../services/api";
import {
  MdSearch,
  MdAdd,
  MdDeleteOutline,
  MdEdit,
  MdSend,
  MdClose,
  MdAssignment,
} from "react-icons/md";
import toast from "react-hot-toast";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";

// Register Font & Size inline style attributors in Quill
const Font = Quill.import('attributors/style/font');
Font.whitelist = [
  'Arial', 'arial',
  'Roboto', 'roboto',
  'Lato', 'lato',
  'Montserrat', 'montserrat',
  'Inter', 'inter',
  'Playfair Display', 'playfair-display',
  'Courier New', 'courier-new',
  'Georgia', 'georgia',
  'Times New Roman', 'times-new-roman',
  'Calibri', 'calibri',
  'Verdana', 'verdana',
  'Tahoma', 'tahoma',
  'Trebuchet MS', 'trebuchet-ms',
  'Comic Sans MS', 'comic-sans',
  'sans-serif', 'serif', 'monospace'
];
Quill.register(Font, true);

const Size = Quill.import('attributors/style/size');
Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'];
Quill.register(Size, true);

export const DEFAULT_TEMPLATES = [
  {
    id: "default-1",
    title: "Meeting Request",
    subject: "Meeting Request: Discussion on Project Updates",
    body: "Hi [Name],\n\nI hope you are doing well.\n\nI would like to schedule a brief meeting with you to discuss our progress on the project. Could you please let me know your availability for a 15-minute call sometime this week?\n\nLooking forward to hearing from you.\n\nBest regards,\n\n[Your Name]",
    category: "Business",
    isDefault: true,
  },
  {
    id: "default-2",
    title: "Follow-Up Discussion",
    subject: "Following up on our recent discussion",
    body: "Hi [Name],\n\nI hope this email finds you well.\n\nI wanted to follow up on our discussion last week regarding [Topic]. Please let me know if you've had a chance to review the details or if you have any questions.\n\nThanks,\n\n[Your Name]",
    category: "Business",
    isDefault: true,
  },
  {
    id: "default-3",
    title: "Out of Office",
    subject: "Out of Office: [Your Name] - [Start Date] to [End Date]",
    body: "Hello,\n\nThank you for your email. I am currently out of the office with limited access to my email. I will return on [Date].\n\nIf your request is urgent, please contact [Alternative Contact Name/Email]. Otherwise, I will reply to your message as soon as possible upon my return.\n\nBest regards,\n\n[Your Name]",
    category: "Out of Office",
    isDefault: true,
  },
  {
    id: "default-4",
    title: "Thank You Note",
    subject: "Thank you for your support",
    body: "Hi [Name],\n\nI wanted to send a quick note to say thank you for your help with [Task/Project]. I really appreciate your time and support.\n\nBest,\n\n[Your Name]",
    category: "Personal",
    isDefault: true,
  },
  {
    id: "default-5",
    title: "Request for Feedback",
    subject: "Request for Feedback: [Project/Topic]",
    body: "Hi [Name],\n\nI hope you're having a great week.\n\nCould you please share your feedback on [Project/Topic]? I would appreciate any thoughts or suggestions you might have.\n\nThank you,\n\n[Your Name]",
    category: "Business",
    isDefault: true,
  },
];

const fontList = [
  'Arial',
  'Roboto',
  'Lato',
  'Montserrat',
  'Inter',
  'Playfair Display',
  'Courier New',
  'Georgia',
  'Times New Roman'
];

const sizeList = [
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '32px'
];

let activeSelection = null;

const quillModules = {
  toolbar: {
    container: [
      [{ 'font': fontList }, { 'size': sizeList }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
    handlers: {
      font: function(value) {
        let range = this.quill.getSelection();
        if ((!range || range.length === 0) && activeSelection && activeSelection.length > 0) {
          range = activeSelection;
        }
        if (!range) {
          this.quill.focus();
          range = this.quill.getSelection() || { index: 0, length: 0 };
        }
        const fontVal = value || 'Arial';
        if (range.length > 0) {
          this.quill.formatText(range.index, range.length, 'font', fontVal, 'user');
          this.quill.setSelection(range.index, range.length, 'silent');
          activeSelection = { index: range.index, length: range.length };
        } else {
          this.quill.setSelection(range.index, 0, 'silent');
          this.quill.format('font', fontVal, 'user');
          activeSelection = { index: range.index, length: 0 };
        }
      },
      size: function(value) {
        let range = this.quill.getSelection();
        if ((!range || range.length === 0) && activeSelection && activeSelection.length > 0) {
          range = activeSelection;
        }
        if (!range) {
          this.quill.focus();
          range = this.quill.getSelection() || { index: 0, length: 0 };
        }
        const sizeVal = value || '14px';
        if (range.length > 0) {
          this.quill.formatText(range.index, range.length, 'size', sizeVal, 'user');
          this.quill.setSelection(range.index, range.length, 'silent');
          activeSelection = { index: range.index, length: range.length };
        } else {
          this.quill.setSelection(range.index, 0, 'silent');
          this.quill.format('size', sizeVal, 'user');
          activeSelection = { index: range.index, length: 0 };
        }
      }
    }
  }
};

const migrateOldFontClasses = (html) => {
  if (!html) return "";
  const fontMap = {
    'roboto': 'Roboto',
    'lato': 'Lato',
    'montserrat': 'Montserrat',
    'playfair-display': 'Playfair Display',
    'inter': 'Inter',
    'arial': 'Arial',
    'courier-new': 'Courier New',
    'times-new-roman': 'Times New Roman',
    'comic-sans': 'Comic Sans MS',
  };
  const sizeMap = {
    '10px': '10px',
    '12px': '12px',
    '14px': '14px',
    '16px': '16px',
    '18px': '18px',
    '20px': '20px',
    '24px': '24px',
    '32px': '32px',
    'small': '12px',
    'large': '18px',
    'huge': '24px',
  };
  return html.replace(/class="([^"]*)"/g, (match, classList) => {
    const classes = classList.split(/\s+/);
    let matchedFont = null;
    let matchedSize = null;
    const remainingClasses = [];
    for (const cls of classes) {
      if (cls.startsWith('ql-font-')) {
        const fontKey = cls.replace('ql-font-', '');
        if (fontMap[fontKey]) {
          matchedFont = fontMap[fontKey];
        }
      } else if (cls.startsWith('ql-size-')) {
        const sizeKey = cls.replace('ql-size-', '');
        if (sizeMap[sizeKey]) {
          matchedSize = sizeMap[sizeKey];
        }
      } else {
        remainingClasses.push(cls);
      }
    }
    const styles = [];
    if (matchedFont) styles.push(`font-family: ${matchedFont};`);
    if (matchedSize) styles.push(`font-size: ${matchedSize};`);
    if (styles.length > 0) {
      const classAttr = remainingClasses.length > 0 ? `class="${remainingClasses.join(' ')}" ` : '';
      return `${classAttr}style="${styles.join(' ')}"`;
    }
    return match;
  });
};

const ensureDefaultFontFormatting = (html) => {
  if (!html || !html.trim()) return "";
  const trimmed = html.trim();
  if (trimmed.startsWith('<div style="font-family:') || trimmed.startsWith('<div style="font-family :')) {
    return trimmed;
  }
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5;">${trimmed}</div>`;
};

const getBodyPreview = (html) => {
  const { t } = useTranslation();
  if (!html) return "";
  try {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  } catch (e) {
    return html;
  }
};

const Templates = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { openCompose } = useMail();
  const { user } = useAuth();

  const [customTemplates, setCustomTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All"); // All, Default, Custom
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form Fields
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const quillRef = useRef(null);

  // Set default Arial 14px font on new template editor mount and track activeSelection
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        if (quillRef.current) {
          const editor = quillRef.current.getEditor();
          if (editor) {
            if (!editingTemplate) {
              editor.format('font', 'Arial');
              editor.format('size', '14px');
            }
            const handleSel = (range) => {
              if (range) {
                activeSelection = { index: range.index, length: range.length };
              }
            };
            editor.on('selection-change', handleSel);
            return () => editor.off('selection-change', handleSel);
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      activeSelection = null;
    }
  }, [isModalOpen, editingTemplate]);

  // Load Custom Templates
  useEffect(() => {
    if (user?.email) {
      templateAPI.getTemplates(user.email)
        .then((res) => {
          const dataList = res.data?.data || res.data || [];
          const loaded = dataList.map(t => ({ ...t, title: t.title || t.name, category: t.category || "Custom" }));
          setCustomTemplates(loaded);
          localStorage.setItem("bnx_mail_custom_templates", JSON.stringify(loaded));
        })
        .catch((err) => {
          console.error("Failed to fetch templates from backend, falling back to local storage", err);
          const saved = localStorage.getItem("bnx_mail_custom_templates");
          if (saved) {
            try { setCustomTemplates(JSON.parse(saved)); } catch (e) { }
          }
        });
    } else {
      const saved = localStorage.getItem("bnx_mail_custom_templates");
      if (saved) {
        try { setCustomTemplates(JSON.parse(saved)); } catch (e) { }
      }
    }
  }, [user]);

  // Save Custom Templates helper
  const saveCustomTemplates = (templates) => {
    setCustomTemplates(templates);
    localStorage.setItem("bnx_mail_custom_templates", JSON.stringify(templates));
  };

  // Combine templates
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  // Filters
  const filteredTemplates = allTemplates.filter((t) => {
    // Tab Filter
    if (activeTab === "Default" && !t.isDefault) return false;
    if (activeTab === "Custom" && t.isDefault) return false;

    // Category Filter
    if (categoryFilter !== "All" && t.category !== categoryFilter) return false;

    // Search Query Filter
    const query = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(query) ||
      t.subject.toLowerCase().includes(query) ||
      t.body.toLowerCase().includes(query) ||
      (t.category && t.category.toLowerCase().includes(query))
    );
  });

  // Open Create/Edit modal
  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormSubject(template.subject);
      setFormBody(migrateOldFontClasses(template.body));
      setFormCategory(template.category || "");
    } else {
      setEditingTemplate(null);
      setFormSubject("");
      setFormBody("");
      setFormCategory("");
    }
    setIsModalOpen(true);
  };

  const handleCategoryChange = (selectedCategory) => {
    if (editingTemplate) return;
    if (!selectedCategory || !selectedCategory.trim()) {
      setFormBody("");
      setFormSubject("");
      return;
    }

    const cleanCategory = selectedCategory.trim().toLowerCase();
    const match = DEFAULT_TEMPLATES.find(t => (t.category || "").trim().toLowerCase() === cleanCategory);
    if (match) {
      setFormBody(match.body || "");
      setFormSubject(match.subject || "");
    } else {
      setFormBody("");
      setFormSubject("");
    }
  };

  // Handle Save
  const handleSave = (e) => {
    e.preventDefault();
    if (!formSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!formCategory) {
      toast.error("Category is required");
      return;
    }
    const isBodyEmpty = !formBody || formBody.trim() === "" || formBody === "<p><br></p>";
    if (isBodyEmpty) {
      toast.error("Template content is required");
      return;
    }

    const templateTitle = formSubject;
    const finalBody = ensureDefaultFontFormatting(formBody);

    if (editingTemplate) {
      // Edit Custom Template
      const isBackendTemplate = typeof editingTemplate.id === 'number' || (typeof editingTemplate.id === 'string' && !editingTemplate.id.startsWith('custom-'));
      if (user?.email && isBackendTemplate) {
        templateAPI.updateTemplate(editingTemplate.id, {
          title: templateTitle,
          name: templateTitle,
          subject: formSubject,
          body: finalBody,
          category: formCategory,
        }, user.email).then((res) => {
          const resObj = res.data?.data || res.data;
          const updatedItem = { ...resObj, title: resObj.title || resObj.name || templateTitle, category: resObj.category || formCategory, body: finalBody };
          const updated = customTemplates.map((t) => t.id === editingTemplate.id ? updatedItem : t);
          saveCustomTemplates(updated);
          toast.success("Template updated successfully");
        }).catch((err) => {
          toast.error("Failed to update template on server");
        });
      } else {
        const updated = customTemplates.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, title: templateTitle, subject: formSubject, body: finalBody, category: formCategory }
            : t
        );
        saveCustomTemplates(updated);
        toast.success("Template updated successfully");
      }
    } else {
      // Create Custom Template
      if (user?.email) {
        templateAPI.createTemplate({
          title: templateTitle,
          name: templateTitle,
          subject: formSubject,
          body: finalBody,
          category: formCategory,
        }, user.email).then((res) => {
          const resObj = res.data?.data || res.data;
          const newItem = { ...resObj, title: resObj.title || resObj.name || templateTitle, category: resObj.category || formCategory, body: finalBody };
          saveCustomTemplates([...customTemplates, newItem]);
          toast.success("Template created successfully");
        }).catch((err) => {
          toast.error("Failed to create template on server");
        });
      } else {
        const newTemplate = {
          id: "custom-" + Date.now(),
          title: templateTitle,
          subject: formSubject,
          body: finalBody,
          category: formCategory,
          isDefault: false,
        };
        saveCustomTemplates([...customTemplates, newTemplate]);
        toast.success("Template created successfully");
      }
    }

    setIsModalOpen(false);
  };

  // Handle Delete
  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this template?")) {
      const isBackendTemplate = typeof id === 'number' || (typeof id === 'string' && !id.startsWith('custom-'));
      if (user?.email && isBackendTemplate) {
        templateAPI.deleteTemplate(id, user.email)
          .then(() => {
            const updated = customTemplates.filter((t) => t.id !== id);
            saveCustomTemplates(updated);
            toast.success("Template deleted");
          })
          .catch(() => toast.error("Failed to delete template on server"));
      } else {
        const updated = customTemplates.filter((t) => t.id !== id);
        saveCustomTemplates(updated);
        toast.success("Template deleted");
      }
    }
  };

  // Use template
  const handleUseTemplate = (template) => {
    const formattedBody = template.body ? (template.body.includes('<') && template.body.includes('>') ? template.body : template.body.replace(/\n/g, '<br/>')) : '';
    openCompose({
      subject: template.subject,
      body: ensureDefaultFontFormatting(formattedBody),
    });
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-transparent"
    >
      {/* HEADER */}
      <div
        className="p-6 border-b shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/10 backdrop-blur-md"
        style={{ borderColor: theme.border }}
      >
        <div>
          <h1
            className="text-2xl font-bold tracking-tight flex items-center gap-2"
            style={{ color: theme.text }}
          >
            <MdAssignment className="opacity-80" /> Templates
          </h1>
          <p className="text-sm mt-1" style={{ color: theme.subText }}>
            Choose a quick mail template or build your own to speed up your messaging.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)`,
          }}
        >
          <MdAdd size={20} /> Create Custom Template
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <div
        className="p-6 pb-2 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100/10"
        style={{ borderColor: theme.border }}
      >
        {/* TABS */}
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto">
          {["All", "Default", "Custom"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === tab
                  ? "bg-white dark:bg-gray-800 shadow-sm"
                  : "opacity-60 hover:opacity-100"
                }`}
              style={{
                color: activeTab === tab ? theme.accent : theme.text,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* SEARCH & CATEGORY FILTER */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* CATEGORY FILTER */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-40 px-3 py-2 rounded-xl text-sm outline-none border focus:ring-1 transition-all duration-300"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <option value="All">All Categories</option>
            <option value="Business">Business</option>
            <option value="Personal">Personal</option>
            <option value="Out of Office">Out of Office</option>
            <option value="Other">Other</option>
          </select>

          {/* SEARCH */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none border focus:ring-1 transition-all duration-300"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                color: theme.text,
              }}
            />
            <MdSearch
              className="absolute left-3 top-2.5 text-lg"
              style={{ color: theme.subText }}
            />
          </div>
        </div>
      </div>

      {/* TEMPLATE GRID */}
      <div className="flex-1 p-6 overflow-y-auto hidden-scrollbar">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MdAssignment
              className="text-6xl mb-4 opacity-25"
              style={{ color: theme.text }}
            />
            <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
              No templates found
            </h3>
            <p className="text-sm mt-1" style={{ color: theme.subText }}>
              {searchQuery ? "Try refining your search keyword" : "Get started by adding a custom template!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                onClick={() => setPreviewTemplate(t)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/40 dark:bg-gray-850/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                }}
              >
                {/* Badges */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${t.isDefault
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}
                  >
                    {t.isDefault ? "Default" : "Custom"}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-md font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  >
                    {t.category || "General"}
                  </span>
                </div>

                {/* Content */}
                <div className="mb-6">
                  <h3
                    className="text-lg font-bold truncate"
                    style={{ color: theme.text }}
                  >
                    {t.title}
                  </h3>
                  <p
                    className="text-xs font-semibold mt-1 truncate"
                    style={{ color: theme.subText }}
                  >
                    Subject: {t.subject}
                  </p>
                  <p
                    className="text-sm mt-3 line-clamp-4 leading-relaxed opacity-85"
                    style={{ color: theme.subText }}
                  >
                    {getBodyPreview(t.body)}
                  </p>
                </div>

                {/* Hover Actions */}
                <div
                  className="flex items-center justify-between pt-4 border-t"
                  style={{ borderColor: theme.border }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate(t);
                    }}
                    className="flex items-center gap-1.5 text-sm font-bold transition-colors"
                    style={{ color: theme.accent }}
                  >
                    <MdSend size={16} /> Use Template
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(t);
                      }}
                      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold"
                      title="Preview Template"
                    >
                      Preview
                    </button>
                    {!t.isDefault && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(t);
                          }}
                          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          title="Edit Template"
                        >
                          <MdEdit size={18} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(t.id, e)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500 hover:text-red-700"
                          title="Delete Template"
                        >
                          <MdDeleteOutline size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div
            className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in duration-200"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between p-5 border-b"
              style={{ borderColor: theme.border }}
            >
              <h2
                className="text-xl font-bold tracking-tight"
                style={{ color: theme.text }}
              >
                Create Template
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <MdClose size={22} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.subText }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Enter Subject"
                  className="px-4 py-2.5 rounded-xl border outline-none text-sm transition-all focus:ring-1"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
              </div>

              {/* Select Category */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.subText }}
                >
                  Select Category
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const selectedCategory = e.target.value;
                      setFormCategory(selectedCategory);
                      handleCategoryChange(selectedCategory);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border outline-none text-sm transition-all focus:ring-1 cursor-pointer"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    <option value="">Select Category</option>
                    <option value="Business">Business</option>
                    <option value="Personal">Personal</option>
                    <option value="Out of Office">Out of Office</option>
                    <option value="Other">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setFormCategory("");
                      handleCategoryChange("");
                    }}
                    className="text-sm font-semibold hover:underline cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Template Content */}
              <div className="flex flex-col gap-1.5 compose-quill">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.subText }}
                >
                  Template Content
                </label>
                <div 
                  className="rounded-xl border bg-white relative overflow-hidden" 
                  style={{ borderColor: theme.border }}
                  onMouseDown={(e) => {
                    // Prevent blur on toolbar interactions so editor selection is preserved
                    if (e.target.closest('.ql-toolbar')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    modules={quillModules}
                    bounds="self"
                    value={formBody}
                    onChange={setFormBody}
                    placeholder="Type your prefilled email body here..."
                    className="text-black template-editor"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div
                className="flex items-center justify-end gap-3 mt-4 pt-4 border-t"
                style={{ borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: theme.subText }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)`,
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE PREVIEW MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewTemplate(null)}
          />
          <div
            className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in duration-200 animate-out duration-150"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: theme.border }}>
              <h2 className="text-xl font-bold" style={{ color: theme.text }}>Template Preview</h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <MdClose size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-60" style={{ color: theme.text }}>Subject</label>
                <p className="text-base font-semibold" style={{ color: theme.text }}>{previewTemplate.subject}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-60" style={{ color: theme.text }}>Category</label>
                <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-gray-100 dark:bg-gray-800" style={{ color: theme.text }}>
                  {previewTemplate.category || "General"}
                </span>
              </div>
              <div className="border-t pt-4" style={{ borderColor: theme.border }}>
                <label className="text-xs font-bold uppercase tracking-wider block mb-2 opacity-60" style={{ color: theme.text }}>Content</label>
                <div
                  className="p-4 rounded-xl border bg-white text-black min-h-[150px] max-h-[300px] overflow-y-auto"
                  style={{ borderColor: theme.border, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t bg-gray-50/50 dark:bg-gray-900/50" style={{ borderColor: theme.border }}>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ color: theme.subText }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleUseTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent || "#135bec"} 0%, #3b82f6 100%)`,
                }}
              >
                <MdSend size={16} /> Use Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
