import { useTranslation } from "../context/LanguageContext";
import React, { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { 
  MdHelpOutline, 
  MdAssignment, 
  MdArrowDropDown, 
  MdSend, 
  MdEmail, 
  MdLanguage,
  MdForum,
  MdSearch,
  MdAttachFile,
  MdHeadsetMic,
  MdBookmarkBorder,
  MdVisibility
} from "react-icons/md";
import toast from "react-hot-toast";

const Support = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Element Refs for smooth scrolling navigation
  const ticketRef = useRef(null);
  const logsRef = useRef(null);
  const faqRef = useRef(null);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Ticket Form State
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState("Medium - Performance/Glitch");
  const [ticketDescription, setTicketDescription] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [tickets, setTickets] = useState([]);

  // FAQ Accordion State (default index 2 "Can I use the app offline?" is expanded)
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(2);

  const faqs = [
    {
      q: "How do I reset my password?",
      a: "To reset your password, click on the 'Forgot Password' link on the login page and follow the OTP verification instructions sent to your recovery email."
    },
    {
      q: "Is my data secure?",
      a: "Yes, BNX Mail uses end-to-end encryption for transmissions and securely encrypts data stored on our servers using industry standards."
    },
    {
      q: "Can I use the app offline?",
      a: "Currently, the application requires an active internet connection to sync data in real-time. An offline mode is planned for future updates."
    },
    {
      q: "How do I export my emails?",
      a: "You can download individual emails in EML format by clicking on the More menu inside the email reading pane and selecting 'Download EML'."
    }
  ];

  // Filter FAQs based on search input
  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Size limit is 5MB.");
        return;
      }
      setAttachment(file);
      toast.success(`Attached: ${file.name}`);
    }
  };

  const handleLodgeTicket = (e) => {
    e.preventDefault();
    if (!ticketSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!ticketDescription.trim()) {
      toast.error("Description is required");
      return;
    }

    const newTicket = {
      id: "ticket_" + Date.now(),
      subject: ticketSubject.trim(),
      priority: ticketPriority,
      description: ticketDescription.trim(),
      attachmentName: attachment ? attachment.name : null,
      date: new Date().toLocaleDateString()
    };

    setTickets(prev => [newTicket, ...prev]);
    setTicketSubject("");
    setTicketDescription("");
    setAttachment(null);
    toast.success("Support ticket logged successfully!");

    // Smoothly scroll down to logs after submit
    setTimeout(() => {
      logsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const scrollToSection = (elementRef) => {
    elementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getPriorityColor = (priority) => {
    if (priority.includes("Low")) return { text: "text-blue-500", bg: "bg-blue-500/10", border: "border-l-blue-500" };
    if (priority.includes("High")) return { text: "text-rose-500", bg: "bg-rose-500/10", border: "border-l-rose-500" };
    return { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-500" };
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#fafbfe] dark:bg-[#0c0f1d] font-sans hidden-scrollbar">
      
      {/* Top Navbar Header */}
      <div 
        className="px-6 py-3.5 bg-white dark:bg-[#111425] border-b flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0"
        style={{ borderColor: theme.border }}
      >
        {/* Brand Logo & separator */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#5f5bf6] shrink-0 transform rotate-[-20deg]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
          <span className="text-sm font-black tracking-tight" style={{ color: theme.text }}>
            BNX Mail
          </span>
          <span className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Help Center
          </span>
        </div>

        {/* Right Search Input & Button */}
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block w-64">
            <input
              type="text"
              placeholder="Search articles, topics or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 outline-none text-xs bg-gray-50 dark:bg-gray-900/60 focus:bg-white focus:border-[#5f5bf6] transition-all"
            />
            <MdSearch size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            onClick={() => scrollToSection(ticketRef)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer border-none bg-[#5f5bf6] hover:bg-[#4b47e3] transition-all"
          >
            <MdHeadsetMic size={14} />
            <span>Contact Support</span>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="m-6 bg-gradient-to-r from-[#eef2ff] via-[#f5f3ff] to-[#f3e8ff] dark:from-[#161a35] dark:to-[#251b3a] rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-sm shrink-0">
        
        {/* CSS Illustration of envelope and planes */}
        <div className="hidden md:flex relative w-48 h-32 items-center justify-center shrink-0">
          {/* Circular gradient background decoration */}
          <div className="absolute inset-0 bg-[#5f5bf6]/10 rounded-full blur-xl transform scale-75" />
          <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl w-28 h-20 shadow-xl flex items-center justify-center border border-white/20">
            <svg className="w-10 h-10 text-white opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-[10px]">ðŸ’¬</div>
            <div className="absolute -bottom-2 -left-4 w-7 h-7 rounded-full bg-[#5f5bf6] flex items-center justify-center shadow-lg text-[9px] transform rotate-12">âœˆï¸</div>
          </div>
        </div>

        {/* Hero Copy & Search Input */}
        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
            How can we help you today? ðŸ‘‹
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md leading-relaxed">
            Search our knowledge base or raise a ticket directly to our support team.
          </p>

          <div className="mt-5 w-full max-w-md relative">
            <input
              type="text"
              placeholder="Search for help articles, guides or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-5 pr-12 py-3 rounded-2xl border-none outline-none text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-[#111425] shadow-md focus:ring-4 focus:ring-[#5f5bf6]/15 transition-all"
            />
            <MdSearch size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Mid Navigation Quick Links */}
      <div className="px-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <button
          onClick={() => scrollToSection(ticketRef)}
          className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#111425] hover:shadow-md transition-all text-left outline-none cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <MdForum size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Raise a Ticket</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Report an issue or get help</p>
          </div>
        </button>

        <button
          onClick={() => scrollToSection(logsRef)}
          className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#111425] hover:shadow-md transition-all text-left outline-none cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <MdAssignment size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">My Tickets</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">View your support requests</p>
          </div>
        </button>

        <button
          onClick={() => scrollToSection(faqRef)}
          className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#111425] hover:shadow-md transition-all text-left outline-none cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
            <MdBookmarkBorder size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Browse FAQs</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Find quick answers</p>
          </div>
        </button>
      </div>

      {/* Main Grid Content Area */}
      <div className="flex-1 px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Ticket lodge & Logs history */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* Raise a Support Ticket Card */}
          <form 
            ref={ticketRef}
            onSubmit={handleLodgeTicket}
            className="bg-white dark:bg-[#111425] border border-gray-150/40 dark:border-gray-800/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4.5 text-left transition-all"
          >
            <div className="flex items-center gap-3.5 pb-2 border-b border-gray-100 dark:border-gray-800/50">
              <div className="w-8 h-8 rounded-lg bg-[#5f5bf6]/10 text-[#5f5bf6] flex items-center justify-center shrink-0">
                <MdForum size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: theme.text }}>Raise a Support Ticket</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Fill in the details and we'll get back to you.</p>
              </div>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Issue Subject
              </label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Unable to send emails"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 outline-none text-xs transition-all focus:border-[#5f5bf6] bg-gray-50/50 dark:bg-black/10 focus:bg-white"
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Priority
              </label>
              <div className="relative">
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 outline-none text-xs transition-all appearance-none cursor-pointer bg-gray-50/50 dark:bg-black/10 focus:bg-white"
                >
                  <option value="Low - General Query" style={{ backgroundColor: theme.bg }}>Low - General Query</option>
                  <option value="Medium - Performance/Glitch" style={{ backgroundColor: theme.bg }}>Medium - Performance/Glitch</option>
                  <option value="High - Critical Failure" style={{ backgroundColor: theme.bg }}>High - Critical Failure</option>
                </select>
                <MdArrowDropDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Detailed Explanation
              </label>
              <textarea
                required
                rows={4}
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Please describe exactly what you were doing, what went wrong, and how our support specialists can assist you."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 outline-none text-xs resize-none transition-all focus:border-[#5f5bf6] bg-gray-50/50 dark:bg-black/10 focus:bg-white leading-relaxed"
              />
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between gap-4 mt-2">
              <div className="relative">
                <input
                  type="file"
                  id="ticket-file-input"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("ticket-file-input").click()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer bg-transparent text-gray-600 dark:text-gray-300"
                >
                  <MdAttachFile className="transform rotate-[30deg]" /> 
                  <span>{attachment ? attachment.name.slice(0, 15) + "..." : "Attach file (optional)"}</span>
                </button>
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm border-none bg-[#5f5bf6]"
              >
                <MdSend className="transform rotate-[-15deg]" /> 
                <span>Submit Ticket</span>
              </button>
            </div>
          </form>

          {/* My Support Log Card */}
          <div 
            ref={logsRef}
            className="bg-white dark:bg-[#111425] border border-gray-150/40 dark:border-gray-800/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4.5 text-left"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/50">
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <MdAssignment size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: theme.text }}>My Support Log</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Track the status of your submitted tickets.</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {tickets.length} Logged
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center opacity-60 border-2 border-dashed border-gray-100 dark:border-gray-800/40 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-black/20 flex items-center justify-center text-gray-400 mb-3 shadow-inner">
                  <MdEmail size={22} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                  No filed tickets detected in your system history.
                </p>
                <button
                  type="button"
                  onClick={() => toast("No tickets logged yet!")}
                  className="mt-4 px-4 py-2 border border-gray-200 dark:border-gray-800 text-[10px] font-bold rounded-xl text-blue-600 hover:bg-gray-50 transition-all bg-transparent cursor-pointer"
                >
                  View All Tickets
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-64 overflow-y-auto hidden-scrollbar pr-1">
                {tickets.map((t) => {
                  const design = getPriorityColor(t.priority);
                  return (
                    <div 
                      key={t.id} 
                      className={`p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white/40 dark:bg-black/10 flex flex-col gap-2 border-l-4 ${design.border} hover:shadow-sm transition-all duration-200`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-bold text-xs text-gray-800 dark:text-gray-200 truncate">{t.subject}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider uppercase shrink-0 ${design.bg} ${design.text}`}>
                          {t.priority.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t.description}</p>
                      {t.attachmentName && (
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-500 font-semibold bg-blue-50/40 dark:bg-blue-950/20 px-2 py-1 rounded w-fit mt-1">
                          <MdAttachFile className="transform rotate-[30deg]" /> {t.attachmentName}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-100/50 dark:border-gray-800/30">
                        <span className="text-[9px] text-gray-400 font-medium">{t.id}</span>
                        <span className="text-[9px] text-gray-400 font-semibold">{t.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: FAQs Accordions & Support coordinates */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* FAQs Accordion Card */}
          <div 
            ref={faqRef}
            className="bg-white dark:bg-[#111425] border border-gray-150/40 dark:border-gray-800/60 rounded-2xl p-6 shadow-sm flex flex-col gap-5 text-left"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/50">
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <MdHelpOutline size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: theme.text }}>Frequently Asked Questions</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Find quick answers</p>
                </div>
              </div>
              <button 
                onClick={() => toast("You are viewing the FAQ Hub")}
                className="text-xs font-bold text-blue-600 hover:text-blue-500 outline-none bg-transparent border-none p-0 cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="flex flex-col divide-y divide-gray-100/60 dark:divide-gray-800/60">
              {filteredFaqs.map((faq, idx) => {
                const isExpanded = expandedFaqIndex === idx;
                return (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 text-left font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer border-none bg-transparent p-0 outline-none"
                    >
                      <span>{faq.q}</span>
                      <MdArrowDropDown 
                        size={20} 
                        className="text-gray-400 transition-transform duration-300 shrink-0" 
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    
                    <div 
                      className="transition-all duration-300 overflow-hidden"
                      style={{ 
                        maxHeight: isExpanded ? "120px" : "0px",
                        opacity: isExpanded ? 1 : 0,
                        marginTop: isExpanded ? "8px" : "0px"
                      }}
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direct Support Channels Card */}
          <div className="bg-[#0b1335] dark:bg-[#070b21] text-white p-6 rounded-2xl shadow-md flex flex-col gap-4">
            <div className="flex items-center gap-3.5 pb-2 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
                <MdHeadsetMic size={16} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white">Direct Support Channels</h3>
                <p className="text-[10px] text-gray-400 opacity-80 mt-0.5">Get in touch directly via our channels below.</p>
              </div>
            </div>
            <p className="text-xs text-blue-100/90 leading-relaxed text-left font-medium">
              Need instant answers or have specialized billing queries? Get in touch directly via our channels below.
            </p>
            
            <div className="flex flex-col gap-3 mt-1 w-full">
              {/* Email Support Card */}
              <div className="bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/10 hover:border-white/15 flex items-center justify-between gap-4 transition-all duration-300 group cursor-pointer">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform duration-200">
                    <MdEmail size={15} />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-blue-300">Email Support</span>
                    <span className="text-xs font-bold truncate text-white select-all">support@beta-softnet.com</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[9px] font-bold bg-[#5f5bf6]/20 text-[#8582f8] border border-[#5f5bf6]/40 shrink-0">
                  24/7 Support
                </span>
              </div>

              {/* Official Portal Card */}
              <div className="bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/10 hover:border-white/15 flex items-center justify-between gap-4 transition-all duration-300 group cursor-pointer">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform duration-200">
                    <MdLanguage size={15} />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-blue-300">Official Portal</span>
                    <span className="text-xs font-bold truncate text-white select-all">beta-softnet.com</span>
                  </div>
                </div>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open("https://beta-softnet.com", "_blank");
                  }}
                  className="px-3 py-1 rounded-full text-[9px] font-bold text-green-400 hover:text-white border border-green-500/40 hover:bg-green-500/25 transition-all shrink-0 cursor-pointer"
                >
                  Visit Portal
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Support;
