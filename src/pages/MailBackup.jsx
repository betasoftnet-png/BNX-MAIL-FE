import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mailBackupAPI } from "../services/mailBackupApi";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { MdBackup, MdAttachFile, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdRefresh, MdSecurity } from "react-icons/md";
import toast from "react-hot-toast";

const MailBackup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();

  // Verification Gate States
  const [isVerified, setIsVerified] = useState(
    sessionStorage.getItem("bnx_backup_verified") === "true"
  );
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  // References for OTP text boxes to handle focus changes cleanly
  const inputRefs = [
    useRef(),
    useRef(),
    useRef(),
    useRef(),
    useRef(),
    useRef()
  ];

  // Backup List States
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'received' | 'sent'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Countdown timer for Resend OTP button
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const fetchBackups = async () => {
    // Only call backups API if verification is complete
    if (!isVerified) return;

    try {
      setLoading(true);
      setError(null);
      const res = await mailBackupAPI.getBackups({
        type: activeFilter,
        page: currentPage,
        size: pageSize
      });
      if (res.data && res.data.success) {
        setBackups(res.data.data || []);
        setTotalItems(res.data.total || 0);
      } else {
        setBackups(res.data || []);
        setTotalItems(res.data.length || 0);
      }
    } catch (err) {
      console.warn("Mail Backup API is offline or not yet connected:", err.message);
      setBackups([]);
      setTotalItems(0);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch backups whenever page/filter parameters change (after verification passes)
  useEffect(() => {
    if (isVerified) {
      fetchBackups();
    }
  }, [activeFilter, currentPage, pageSize, isVerified]);

  // Mask user email (e.g. ashwin@example.com -> aâ€¢â€¢â€¢â€¢â€¢@example.com)
  const maskEmail = (email) => {
    if (!email) return "uâ€¢â€¢â€¢â€¢â€¢@example.com";
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 1) return email;
    return `${localPart[0]}â€¢â€¢â€¢â€¢â€¢@${domain}`;
  };

  // OTP inputs keyboard shifting handlers
  const handleOtpChange = (value, index) => {
    // Accept only numeric input
    if (value && isNaN(value)) return;

    const newOtp = [...otp];
    // Cache only the latest typed character in the box
    newOtp[index] = value ? value.substring(value.length - 1) : "";
    setOtp(newOtp);
    setOtpError(null);

    // Auto focus next box
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Clear previous input digit and transfer focus backward
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs[index - 1].current.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
      setOtpError(null);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    
    // Ensure pasted text is exactly a 6-digit numeric code
    if (!/^\d{6}$/.test(pastedData)) {
      setOtpError("Please paste a valid 6-digit number");
      return;
    }

    const newOtp = pastedData.split("");
    setOtp(newOtp);
    setOtpError(null);
    inputRefs[5].current.focus();
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setOtpError("Please enter a complete 6-digit OTP");
      return;
    }

    setVerifying(true);
    setOtpError(null);

    try {
      const res = await mailBackupAPI.verifyOtp(fullOtp);
      if (res.data && res.data.success) {
        sessionStorage.setItem("bnx_backup_verified", "true");
        setIsVerified(true);
        toast.success("Identity verified successfully");
      } else {
        setOtpError(res.data?.message || "Invalid OTP code. Please try again.");
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      const status = err.response?.status;
      if (status === 400) {
        setOtpError("Invalid OTP. Please check the code and try again.");
      } else if (status === 410) {
        setOtpError("Expired OTP. Please request a new one.");
      } else {
        setOtpError("OTP Verification is currently unavailable. Please try again later.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setOtpError(null);
    try {
      const res = await mailBackupAPI.resendOtp();
      toast.success("A new OTP has been sent to your email address");
      setResendTimer(30);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      console.error("Resend OTP error:", err);
      setOtpError("Failed to resend OTP. Verification service is currently offline.");
    }
  };

  // Reset page when filter or page size changes
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;

  /* RENDER OTP VERIFICATION SCREEN */
  if (!isVerified) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-transparent select-none h-full">
        <div 
          className="w-full max-w-md border rounded-[24px] p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_8px_30px_rgba(0,0,0,0.02)]"
          style={{ borderColor: theme.border, background: theme.cardBg }}
        >
          {/* Security Icon Badge */}
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center mb-5 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${theme.accent || "#1E6FD9"} 0%, #3b82f6 100%)` }}
          >
            <MdSecurity size={28} />
          </div>

          {/* Secure Title */}
          <h2 className="text-lg font-bold mb-1.5" style={{ color: theme.text }}>
            {t('mail_backup.secure_mail_backup', 'Secure Mail Backup')}
          </h2>

          {/* Description */}
          <p className="text-xs sm:text-sm leading-relaxed mb-6 px-2" style={{ color: theme.subText }}>
            {t('mail_backup.verify_description', 'Your Mail Backup contains protected copies of your emails. Verify your identity to continue.')}
          </p>

          {/* Masked Email */}
          <div className="text-xs font-bold bg-black/[0.02] dark:bg-white/[0.02] py-2 px-4 rounded-full border border-gray-200/50 dark:border-gray-800/80 mb-6">
            <span style={{ color: theme.subText }}>{t('mail_backup.otp_sent_to', 'OTP sent to: ')}</span>
            <span style={{ color: theme.text }}>{maskEmail(user?.email)}</span>
          </div>

          {/* 6 OTP Inputs */}
          <div className="flex justify-center gap-2.5 mb-6 w-full" onPaste={handleOtpPaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                maxLength={1}
                value={digit}
                disabled={verifying}
                onChange={(e) => handleOtpChange(e.target.value, idx)}
                onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                className="w-10 h-12 sm:w-11 sm:h-13 text-center text-lg font-bold rounded-xl border outline-none transition-all focus:ring-2 focus:ring-primary/20 bg-white dark:bg-gray-900"
                style={{ 
                  borderColor: theme.border, 
                  color: theme.text,
                  caretColor: theme.accent || "#1E6FD9"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.accent || "#1E6FD9";
                  e.target.style.boxShadow = `0 0 0 2px ${(theme.accent || "#1E6FD9")}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = theme.border;
                  e.target.style.boxShadow = "none";
                }}
              />
            ))}
          </div>

          {/* Errors display */}
          {otpError && (
            <div className="mb-4 text-xs font-bold text-red-500 flex items-center gap-1 animate-fade-in">
              <span>âš ï¸</span> {otpError}
            </div>
          )}

          {/* Verify OTP Button */}
          <button
            onClick={handleVerifyOtp}
            disabled={verifying}
            className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
            style={{ backgroundColor: theme.accent || "#1E6FD9" }}
          >
            {verifying ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('mail_backup.verifying', 'Verifying...')}
              </>
            ) : (
              t('mail_backup.verify_and_proceed', 'Verify & Proceed')
            )}
          </button>

          {/* Resend Option */}
          <button
            onClick={handleResendOtp}
            disabled={verifying || resendTimer > 0}
            className="text-xs font-bold hover:underline transition-all cursor-pointer disabled:opacity-50 disabled:no-underline"
            style={{ color: theme.accent || "#1E6FD9" }}
          >
            {resendTimer > 0 ? `${t('mail_backup.resend_otp_in', 'Resend OTP in')} ${resendTimer}s` : t('common.resend_otp', 'Resend OTP')}
          </button>
        </div>
      </div>
    );
  }

  /* RENDER MAIN MAIL BACKUP LIST PAGE (AFTER SUCCESSFUL VERIFICATION) */
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header Panel */}
      <div 
        className="p-5 border-b flex flex-col gap-1.5 shrink-0" 
        style={{ borderColor: theme.border, background: theme.cardBg }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span 
              className="p-1.5 rounded-lg text-white flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${theme.accent || "#1E6FD9"} 0%, #3b82f6 100%)` }}
            >
              <MdBackup size={18} />
            </span>
            <h2 className="text-lg font-bold" style={{ color: theme.text }}>
              {t('sidebar.mail_backup', 'Mail Backup')}
            </h2>
          </div>
          <button
            onClick={fetchBackups}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
            title={t('common.refresh', 'Refresh')}
          >
            <MdRefresh size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="text-xs sm:text-sm max-w-2xl font-normal leading-relaxed mt-0.5" style={{ color: theme.subText }}>
          {t('mail_backup.description', 'Your emails are securely backed up and remain available even after the original email is permanently deleted.')}
        </p>
      </div>

      {/* Filter Tabs Panel */}
      <div 
        className="px-5 py-2.5 border-b flex items-center gap-2 shrink-0 select-none bg-black/[0.01] dark:bg-white/[0.01]"
        style={{ borderColor: theme.border }}
      >
        {["all", "received", "sent"].map((filter) => {
          const isActive = activeFilter === filter;
          const filterLabel = filter === 'all' 
            ? t('common.all', 'All') 
            : filter === 'received' 
            ? t('mail_backup.received', 'Received') 
            : t('sidebar.sent', 'Sent');
          return (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full capitalize transition-all cursor-pointer border ${
                isActive 
                  ? "shadow-sm border-transparent" 
                  : "bg-transparent border-gray-200/60 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
              style={isActive ? { backgroundColor: theme.accent || "#1E6FD9", color: "#fff" } : { color: theme.subText }}
            >
              {filterLabel}
            </button>
          );
        })}
      </div>

      {/* Main Mail List Content Container */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar bg-transparent flex flex-col min-h-0">
        {loading ? (
          // Loading Skeletons State
          <div className="flex-1 flex flex-col divide-y divide-gray-100/50 dark:divide-gray-800/40 p-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="py-4 flex flex-col gap-2.5 animate-pulse">
                <div className="flex justify-between items-center w-full">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          // Error State
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
            <span className="text-4xl mb-4 opacity-50">âš ï¸</span>
            <h3 className="text-base font-bold mb-1" style={{ color: theme.text }}>
              Unable to load backup emails
            </h3>
            <p className="text-xs max-w-sm mb-4" style={{ color: theme.subText }}>
              Please try again later. If the issue persists, contact system support.
            </p>
            <button
              onClick={fetchBackups}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: theme.accent || "#1E6FD9" }}
            >
              Retry Connection
            </button>
          </div>
        ) : backups.length === 0 ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
            <span className="text-5xl mb-4 opacity-60">ðŸ“¦</span>
            <h3 className="text-base font-bold mb-1" style={{ color: theme.text }}>
              No backup emails yet
            </h3>
            <p className="text-xs max-w-sm" style={{ color: theme.subText }}>
              Your protected email backups will appear here automatically.
            </p>
          </div>
        ) : (
          // Email List Grid Rows
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800/60">
            {backups.map((email) => (
              <div
                key={email.id}
                onClick={() => navigate(`/mail-backup/${email.id}`)}
                className="group flex items-center justify-between gap-4 py-3 px-5 cursor-pointer transition-all hover:bg-black/[0.015] dark:hover:bg-white/[0.02] border-l-[3px] border-transparent hover:border-primary"
                style={{ borderLeftColor: "transparent" }}
              >
                {/* Left: Sender & Metadata */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]" 
                      style={{ color: theme.text }}
                    >
                      {email.fromName || email.fromAddress?.split("@")[0] || email.fromAddress}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full select-none shrink-0 border border-blue-100 dark:border-blue-900/50">
                      Protected Backup
                    </span>
                  </div>
                  {/* Subject & snippet preview */}
                  <div className="text-sm font-medium truncate" style={{ color: theme.text }}>
                    {email.subject || "(No Subject)"}
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                      â€” {email.snippet || email.bodySnippet || ""}
                    </span>
                  </div>
                </div>

                {/* Right: Date & Attachments */}
                <div className="flex items-center gap-3.5 shrink-0 text-right">
                  {email.hasAttachments && (
                    <MdAttachFile className="text-gray-400 dark:text-gray-500 shrink-0" size={16} title="Has attachment" />
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                    {email.createdAt
                      ? new Date(email.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer Panel */}
      {!loading && !error && backups.length > 0 && (
        <div 
          className="flex items-center justify-between gap-3 px-5 py-4 border-t shrink-0 bg-black/[0.01] dark:bg-white/[0.01]"
          style={{ borderColor: theme.border }}
        >
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="p-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none text-xs cursor-pointer focus:ring-1 focus:ring-primary"
              style={{ color: theme.text }}
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <span className="hidden sm:inline">
              | Showing {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)} of {totalItems}
            </span>
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <MdKeyboardArrowLeft size={18} />
            </button>
            <span className="text-xs font-semibold px-2" style={{ color: theme.text }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <MdKeyboardArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MailBackup;
