import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdSend, MdAttachFile, MdDeleteOutline, MdClose, MdAssignment } from "react-icons/md";
import { mailAPI, userAPI } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useMail } from "../context/MailContext";
import { DEFAULT_TEMPLATES } from "./Templates";
import { handleStandardInputAutoCorrect } from "../utils/autoCorrect";


const getFontFamilyCss = (font) => {
  switch (font) {
    case 'Arial': return 'Arial, sans-serif';
    case 'Georgia': return 'Georgia, serif';
    case 'Tahoma': return 'Tahoma, sans-serif';
    case 'Times New Roman': return "'Times New Roman', Times, serif";
    case 'Trebuchet MS': return "'Trebuchet MS', sans-serif";
    case 'Verdana': return 'Verdana, sans-serif';
    case 'Courier New': return "'Courier New', Courier, monospace";
    case 'Calibri': return 'Calibri, sans-serif';
    default: return font ? `${font}, sans-serif` : 'Arial, sans-serif';
  }
};

const getFontSizeCss = (size) => {
  switch (size) {
    case 'Small': return '14px';
    case 'Normal': return '16px';
    case 'Large': return '18px';
    case 'Extra Large':
    case 'Huge': return '24px';
    default: return '16px';
  }
};

const ComposePage = () => {
  useEffect(() => {
    const handleTextStyleChanged = (e) => {
      if (e.detail) {
        if (e.detail.fontFamily) setDefaultFontFamily(e.detail.fontFamily);
        if (e.detail.fontSize) setDefaultFontSize(e.detail.fontSize);
        if (e.detail.textColor) setDefaultTextColor(e.detail.textColor);
      }
    };
    window.addEventListener('bnx_text_style_changed', handleTextStyleChanged);
    return () => window.removeEventListener('bnx_text_style_changed', handleTextStyleChanged);
  }, []);

  const [spellingCheck, setSpellingCheck] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_spellingCheck");
    return saved !== null ? saved === "true" : true;
  });
  const [grammarCheck, setGrammarCheck] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_grammarCheck");
    return saved !== null ? saved === "true" : true;
  });
  const [autoCorrect, setAutoCorrect] = useState(() => {
    const saved = localStorage.getItem("bnx_setting_autoCorrect");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await userAPI.getSettings();
        if (res.data?.success) {
          const s = res.data.data;
          if (s.spellingCheckEnabled !== undefined) setSpellingCheck(Boolean(s.spellingCheckEnabled));
          if (s.grammarCheckEnabled !== undefined) setGrammarCheck(Boolean(s.grammarCheckEnabled));
          if (s.autoCorrectEnabled !== undefined) setAutoCorrect(Boolean(s.autoCorrectEnabled));
        }
      } catch (err) {
        console.error("Failed to fetch settings in ComposePage:", err);
      }
    };
    fetchSettings();

    const handleWritingSettingsChanged = (e) => {
      if (e.detail) {
        if (e.detail.spellingCheck !== undefined) setSpellingCheck(Boolean(e.detail.spellingCheck));
        if (e.detail.grammarCheck !== undefined) setGrammarCheck(Boolean(e.detail.grammarCheck));
        if (e.detail.autoCorrect !== undefined) setAutoCorrect(Boolean(e.detail.autoCorrect));
      }
    };
    window.addEventListener("bnx_writing_settings_changed", handleWritingSettingsChanged);
    return () => window.removeEventListener("bnx_writing_settings_changed", handleWritingSettingsChanged);
  }, []);

  const [defaultFontFamily, setDefaultFontFamily] = useState(() => localStorage.getItem("bnx_setting_fontFamily") || "Arial");
  const [defaultFontSize, setDefaultFontSize] = useState(() => localStorage.getItem("bnx_setting_fontSizeText") || "Normal");
  const [defaultTextColor, setDefaultTextColor] = useState(() => localStorage.getItem("bnx_setting_textColor") || "#000000");
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { handleEmailSent, invalidateCache, fetchEmailsSilently } = useMail();

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const [showTemplates, setShowTemplates] = useState(false);
  const [allTemplates, setAllTemplates] = useState([]);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [customScheduleDateTime, setCustomScheduleDateTime] = useState("");

  const [formData, setFormData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  // Load Custom + Default templates for inline insertion
  useEffect(() => {
    const saved = localStorage.getItem("bnx_mail_custom_templates");
    let custom = [];
    if (saved) {
      try {
        custom = JSON.parse(saved);
      } catch (e) {}
    }
    setAllTemplates([...DEFAULT_TEMPLATES, ...custom]);
  }, [showTemplates]);

  /* ---------------- PREFILL ON ROUTE STATE ---------------- */
  useEffect(() => {
    if (location.state) {
      if (location.state.replyTo) {
        setFormData((prev) => ({
          ...prev,
          to: location.state.replyTo,
          subject: location.state.subject || "",
          body: location.state.originalBody
            ? `\n\n--- Original Message ---\n${location.state.originalBody}`
            : "",
        }));
      } else if (location.state.draft) {
        const d = location.state.draft;
        setFormData({
          to: d.to || "",
          cc: d.cc || "",
          bcc: d.bcc || "",
          subject: d.subject || "",
          body: d.body || "",
        });
        if (d.cc) setShowCc(true);
        if (d.bcc) setShowBcc(true);
      } else {
        const newTo = location.state.to !== undefined ? location.state.to : "";
        const newCc = location.state.cc !== undefined ? location.state.cc : "";
        const newBcc = location.state.bcc !== undefined ? location.state.bcc : "";
        setFormData({
          to: newTo,
          cc: newCc,
          bcc: newBcc,
          subject: location.state.subject || "",
          body: location.state.body || "",
        });
        if (newCc) setShowCc(true);
        if (newBcc) setShowBcc(true);
      }
    }
  }, [location.state]);

  const handleApplyTemplate = (template) => {
    const confirmApply =
      !formData.subject.trim() && !formData.body.trim()
        ? true
        : window.confirm("Apply template? This will replace your current subject and body.");

    if (confirmApply) {
      setFormData((prev) => ({
        ...prev,
        subject: template.subject,
        body: template.body ? (template.body.includes('<') && template.body.includes('>') ? template.body : template.body.replace(/\n/g, '<br/>')) : '',
      }));
      setShowTemplates(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  /* ---------------- SEND EMAIL ---------------- */
  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.to) {
      setError("Recipient email is required");
      return;
    }

    if (!formData.subject) {
      setError("Subject is required");
      return;
    }

    try {
      setSending(true);

      const payload = {
        to: formData.to,
        subject: formData.subject,
        body: formData.body,
      };

      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      const response = await mailAPI.send(payload);

      if (response.data?.success) {
        setSuccess("Email sent successfully");
        if (handleEmailSent) {
          handleEmailSent({
            draftId: location.state?.draftId,
            draftUid: location.state?.draftUid || location.state?.draft?.uid,
            imapDraftUid: location.state?.imapDraftUid || location.state?.draft?.uid,
            sentEmail: response.data?.data
          });
        }
        setTimeout(() => navigate("/inbox"), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  /* ---------------- SCHEDULE EMAIL ---------------- */
  const handleScheduleSend = async (sendAtIso) => {
    setError("");
    setSuccess("");

    if (!formData.to) {
      setError("Recipient email is required");
      return;
    }

    if (!formData.subject) {
      setError("Subject is required");
      return;
    }

    try {
      setSending(true);

      const payload = {
        to: formData.to,
        subject: formData.subject,
        body: formData.body,
      };

      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      const response = await mailAPI.scheduleEmail(payload, sendAtIso);

      if (response.data?.success) {
        setSuccess("Email scheduled successfully");
        setTimeout(() => navigate("/scheduled"), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to schedule email");
    } finally {
      setSending(false);
      setShowScheduleMenu(false);
      setShowCustomSchedule(false);
    }
  };

  const getScheduleOptions = () => {
    const now = new Date();
    
    const laterToday = new Date(now);
    if (now.getHours() >= 17) {
      laterToday.setHours(now.getHours() + 3);
    } else {
      laterToday.setHours(18, 0, 0, 0);
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const nextWeek = new Date(now);
    const daysToMonday = (8 - now.getDay()) % 7 || 7;
    nextWeek.setDate(now.getDate() + daysToMonday);
    nextWeek.setHours(8, 0, 0, 0);

    const formatTime = (d) => {
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { weekday: 'short' });
      return `${dateStr}, ${timeStr}`;
    };

    return [
      { label: "Later today", time: laterToday, display: formatTime(laterToday) },
      { label: "Tomorrow morning", time: tomorrow, display: formatTime(tomorrow) },
      { label: "Monday morning", time: nextWeek, display: formatTime(nextWeek) },
    ];
  };

  const handleClose = () => {
    const hasContent = formData.to.trim() || formData.subject.trim() || formData.body.trim() || formData.cc.trim() || formData.bcc.trim();
    if (hasContent) {
      const payload = {
        to: formData.to,
        subject: formData.subject || "(No Subject)",
        body: formData.body,
      };
      if (formData.cc) payload.cc = formData.cc;
      if (formData.bcc) payload.bcc = formData.bcc;

      // Save draft in the background
      mailAPI.saveDraft(payload)
        .then(() => {
          if (invalidateCache) {
            invalidateCache('draft');
            invalidateCache('drafts');
          }
          if (fetchEmailsSilently) {
            fetchEmailsSilently('drafts');
          }
        })
        .catch((err) => {
          console.error("Failed to auto-save draft in the background:", err);
        });
    }
    navigate("/inbox");
  };

  const handleDiscard = () => {
    if (window.confirm("Discard this email?")) {
      navigate("/inbox");
    }
  };

  return (
    <div
      className="h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-10 flex flex-col bg-transparent"
    >
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col min-h-0">
        <div
          className="flex flex-col h-full rounded-2xl shadow-soft dark:shadow-soft-dark border overflow-hidden glass-panel"
          style={{ borderColor: theme.border }}
        >
          {/* HEADER */}
          <div
            className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md"
            style={{ borderColor: theme.border }}
          >
            <h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
              New Message
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors tooltip-trigger flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              title="Close"
            >
              <MdClose size={22} />
            </button>
          </div>

          {/* ALERTS */}
          {error && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30 text-sm font-medium shrink-0">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 text-sm font-medium shrink-0">
              {success}
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSend} className="flex flex-col flex-1 p-5 min-h-0">
            <div className="flex-1 overflow-y-auto hidden-scrollbar pr-2 flex flex-col gap-1">
              {/* TO */}
              <Field
                label="To"
                name="to"
                value={formData.to}
                onChange={handleChange}
                theme={theme}
                extra={
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCc((v) => !v)}
                      className="text-sm font-medium px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      style={{ color: theme.accent || '#135bec' }}
                    >
                      Cc
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBcc((v) => !v)}
                      className="text-sm font-medium px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      style={{ color: theme.accent || '#135bec' }}
                    >
                      Bcc
                    </button>
                  </>
                }
              />

              {showCc && (
                <Field
                  label="Cc"
                  name="cc"
                  value={formData.cc}
                  onChange={handleChange}
                  theme={theme}
                />
              )}

              {showBcc && (
                <Field
                  label="Bcc"
                  name="bcc"
                  value={formData.bcc}
                  onChange={handleChange}
                  theme={theme}
                />
              )}

              {/* SUBJECT */}
              <Field
                label="Subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                theme={theme}
                spellCheck={spellingCheck}
                autoCorrect={autoCorrect ? "on" : "off"}
              />

              {/* BODY */}
              <textarea
                name="body"
                value={formData.body}
                onChange={handleChange}
                onKeyDown={(e) => handleStandardInputAutoCorrect(e, autoCorrect)}
                placeholder="Type your message…"
                spellCheck={spellingCheck ? "true" : "false"}
                autoCorrect={autoCorrect ? "on" : "off"}
                autoCapitalize={autoCorrect ? "sentences" : "off"}
                data-gramm={grammarCheck ? "true" : "false"}
                data-enable-grammarly={grammarCheck ? "true" : "false"}
                style={{
                  fontFamily: getFontFamilyCss(defaultFontFamily),
                  fontSize: getFontSizeCss(defaultFontSize),
                  color: defaultTextColor || undefined
                }}
                className="w-full flex-1 resize-none outline-none p-4 rounded-xl mt-4 min-h-[200px] glass-input text-gray-800 dark:text-gray-100 placeholder:text-gray-400 text-base"
              />
            </div>

            {/* ACTIONS */}
            <div
              className="flex items-center justify-between mt-4 pt-4 border-t shrink-0 relative"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-full shadow-md hover:shadow-lg transition-all">
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-l-full text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
                    style={{ background: `linear-gradient(135deg, ${theme.accent || '#135bec'} 0%, #3b82f6 100%)` }}
                  >
                    {sending ? "Sending…" : "Send"}
                    {!sending && <MdSend size={18} />}
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      setShowScheduleMenu(!showScheduleMenu);
                      setShowCustomSchedule(false);
                    }}
                    className="px-3 py-2.5 rounded-r-full text-white font-medium disabled:opacity-60 cursor-pointer flex items-center justify-center hover:bg-white/10"
                    style={{ background: `linear-gradient(135deg, ${theme.accent || '#135bec'} 0%, #3b82f6 100%)` }}
                    title="Schedule send"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </button>
                </div>

                {/* Schedule Send Dropdown Menu */}
                {showScheduleMenu && (
                  <div
                    className="absolute bottom-16 left-0 w-64 rounded-2xl border shadow-2xl z-50 p-2 bg-white dark:bg-neutral-900 animate-in fade-in duration-200"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between p-2 mb-1 border-b" style={{ borderColor: theme.border }}>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Schedule send</span>
                      <button
                        type="button"
                        onClick={() => { setShowScheduleMenu(false); setShowCustomSchedule(false); }}
                        className="text-xs p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"
                      >
                        ✕
                      </button>
                    </div>

                    {showCustomSchedule ? (
                      <div className="p-3 flex flex-col gap-3">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Select Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={customScheduleDateTime}
                          onChange={(e) => setCustomScheduleDateTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2 justify-end mt-1">
                          <button
                            type="button"
                            onClick={() => setShowCustomSchedule(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!customScheduleDateTime) {
                                alert("Please select a valid date and time.");
                                return;
                              }
                              const dateObj = new Date(customScheduleDateTime);
                              if (dateObj <= new Date()) {
                                alert("Please select a future date and time.");
                                return;
                              }
                              handleScheduleSend(dateObj.toISOString());
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 py-1">
                        {getScheduleOptions().map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleScheduleSend(opt.time.toISOString())}
                            className="w-full text-left px-3 py-2.5 text-sm rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2 text-gray-800 dark:text-gray-200 cursor-pointer font-medium"
                          >
                            <span>{opt.label}</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">{opt.display}</span>
                          </button>
                        ))}
                        <div className="border-t my-1" style={{ borderColor: theme.border }}></div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomSchedule(true);
                            const defaultCustom = new Date();
                            defaultCustom.setMinutes(defaultCustom.getMinutes() - defaultCustom.getTimezoneOffset());
                            setCustomScheduleDateTime(defaultCustom.toISOString().slice(0, 16));
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-blue-500 dark:text-blue-400 font-semibold cursor-pointer"
                        >
                          Select date & time
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 tooltip-trigger"
                  title="Attach file"
                >
                  <MdAttachFile size={22} className="transform rotate-45" />
                </button>

                {/* Inline Templates quick selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                    title="Insert Template"
                  >
                    <MdAssignment size={20} />
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  {showTemplates && (
                    <div
                      className="absolute bottom-12 left-0 w-64 max-h-60 overflow-y-auto rounded-xl border shadow-xl z-50 p-2 glass"
                      style={{
                        backgroundColor: theme.cardBg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      <div className="flex items-center justify-between p-2 mb-1 border-b" style={{ borderColor: theme.border }}>
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Select Template</span>
                        <button
                          type="button"
                          onClick={() => setShowTemplates(false)}
                          className="text-xs p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"
                        >
                          <MdClose size={14} />
                        </button>
                      </div>
                      {allTemplates.length === 0 ? (
                        <p className="text-xs text-center p-3 opacity-60">No templates found</p>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {allTemplates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleApplyTemplate(t)}
                              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate text-gray-800 dark:text-gray-200 cursor-pointer"
                            >
                              <div className="font-semibold truncate">{t.title}</div>
                              <div className="text-xs opacity-60 truncate">{t.subject}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiscard}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"

              >
                <MdDeleteOutline size={20} />
                <span>Discard</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ---------------- FIELD COMPONENT ---------------- */
const Field = ({ label, name, value, onChange, extra, theme, spellCheck = false, autoCorrect = "off" }) => {
  return (
    <div
      className="flex items-center gap-3 border-b py-2 sm:py-3 transition-colors focus-within:border-primary/50"
      style={{ borderColor: theme?.border || '#e5e7eb' }}
    >
      <span className="w-16 text-sm font-medium text-gray-500 shrink-0">{label}:</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => handleStandardInputAutoCorrect(e, autoCorrect === "on" || autoCorrect === true)}
        className="flex-1 outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 group"
        placeholder={`Enter ${label.toLowerCase()}...`}
        spellCheck={spellCheck ? "true" : "false"}
        autoCorrect={autoCorrect}
      />
      {extra && <div className="flex gap-2 shrink-0">{extra}</div>}
    </div>
  );
};

export default ComposePage;
