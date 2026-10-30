import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mailBackupAPI } from "../services/mailBackupApi";
import { useTheme } from "../context/ThemeContext";
import { MdBackup, MdArrowBack, MdAttachFile, MdFileDownload, MdInsertDriveFile } from "react-icons/md";
import { sanitizeAndTargetEmailLinks, linkifyPlainText } from "../utils/htmlUtils";

const MailBackupViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // State Management
  const [backup, setBackup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Route protection guard
  useEffect(() => {
    const isVerified = sessionStorage.getItem("bnx_backup_verified") === "true";
    if (!isVerified) {
      navigate("/mail-backup", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const isVerified = sessionStorage.getItem("bnx_backup_verified") === "true";
    if (!isVerified) return;

    const fetchBackupDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await mailBackupAPI.getBackupById(id);
        if (res.data && res.data.success) {
          setBackup(res.data.data);
        } else {
          setBackup(res.data);
        }
      } catch (err) {
        console.warn("Mail Backup Detail API is offline or not yet connected:", err.message);
        setBackup(null);
        setError(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBackupDetail();
  }, [id]);

  // Helper to format byte sizes
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Helper to get short type label from mime type
  const getFileExtensionLabel = (filename, contentType) => {
    if (filename && filename.includes(".")) {
      return filename.split(".").pop().toUpperCase();
    }
    if (contentType) {
      return contentType.split("/").pop().toUpperCase();
    }
    return "FILE";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Top Action Bar */}
      <div
        className="px-5 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: theme.border, background: theme.cardBg }}
      >
        <button
          onClick={() => navigate("/mail-backup")}
          className="flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: theme.text }}
        >
          <MdArrowBack size={16} />
          Back to Mail Backup
        </button>

        <span className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full uppercase border border-emerald-100 dark:border-emerald-900/50 select-none">
          PROTECTED
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto hidden-scrollbar p-6 bg-transparent flex flex-col gap-6 min-h-0">
        {loading ? (
          // Loading Skeletons state
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
            <hr className="border-gray-200 dark:border-gray-800" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
            </div>
          </div>
        ) : error ? (
          // Error state
          <div className="flex flex-col items-center justify-center p-8 text-center my-auto">
            <span className="text-4xl mb-4 opacity-50">⚠️ ï¸</span>
            <h3 className="text-base font-bold mb-1" style={{ color: theme.text }}>
              Unable to load backup email
            </h3>
            <p className="text-xs max-w-sm mb-4" style={{ color: theme.subText }}>
              Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: theme.accent || "#135bec" }}
            >
              Reload Page
            </button>
          </div>
        ) : !backup ? (
          // Empty / Not Found state
          <div className="flex flex-col items-center justify-center p-8 text-center my-auto">
            <span className="text-4xl mb-4 opacity-55">📦</span>
            <h3 className="text-base font-bold mb-1" style={{ color: theme.text }}>
              Backup copy not found
            </h3>
            <p className="text-xs max-w-sm" style={{ color: theme.subText }}>
              This backed up copy could not be resolved.
            </p>
          </div>
        ) : (
          // Email Detail Card
          <div
            className="border rounded-2xl p-6 flex flex-col gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.015)] relative overflow-visible"
            style={{ borderColor: theme.border, background: theme.cardBg }}
          >
            {/* Header info */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold tracking-widest text-[#9333ea] uppercase">
                  BACKUP COPY
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                  {backup.createdAt ? new Date(backup.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short"
                  }) : ""}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold leading-snug mt-1" style={{ color: theme.text }}>
                {backup.subject || "(No Subject)"}
              </h1>
            </div>

            <hr className="border-gray-150 dark:border-gray-800/80 m-0" />

            {/* Metadata (From, To, CC, BCC, etc.) */}
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-start gap-1">
                <span className="w-12 font-bold text-gray-400 select-none">From:</span>
                <span style={{ color: theme.text }}>
                  {backup.fromName ? `${backup.fromName} <${backup.fromAddress}>` : backup.fromAddress}
                </span>
              </div>
              <div className="flex items-start gap-1">
                <span className="w-12 font-bold text-gray-400 select-none">To:</span>
                <span style={{ color: theme.text }}>
                  {backup.toAddress}
                </span>
              </div>
              {backup.ccAddress && (
                <div className="flex items-start gap-1">
                  <span className="w-12 font-bold text-gray-400 select-none">CC:</span>
                  <span style={{ color: theme.text }}>{backup.ccAddress}</span>
                </div>
              )}
              {backup.bccAddress && (
                <div className="flex items-start gap-1">
                  <span className="w-12 font-bold text-gray-400 select-none">BCC:</span>
                  <span style={{ color: theme.text }}>{backup.bccAddress}</span>
                </div>
              )}
            </div>

            <hr className="border-gray-150 dark:border-gray-800/80 m-0" />

            {/* Email Body content */}
            <div
              className="text-sm overflow-x-auto select-text leading-relaxed"
              onClick={(e) => {
                const link = e.target.closest("a");
                if (!link) return;
                const href = link.getAttribute("href");
                if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
                link.setAttribute("target", "_blank");
                link.setAttribute("rel", "noopener noreferrer");
                if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//") || /^https?:\/\//i.test(link.href)) {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(link.href, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: backup.htmlBody
                    ? sanitizeAndTargetEmailLinks(backup.htmlBody)
                    : (backup.body ? (/<[a-z][\s\S]*>/i.test(backup.body) ? sanitizeAndTargetEmailLinks(backup.body) : linkifyPlainText(backup.body)) : "")
                }}
                style={{ color: theme.text }}
                className="whitespace-pre-wrap font-sans"
              />
            </div>

            {/* Attachments Section */}
            {backup.attachments && backup.attachments.length > 0 && (
              <div className="mt-4 pt-5 border-t" style={{ borderColor: theme.border }}>
                <h4 className="text-xs font-black text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-1.5 select-none">
                  <MdAttachFile size={16} />
                  Attachments ({backup.attachments.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {backup.attachments.map((file) => {
                    const downloadUrl = mailBackupAPI.getAttachmentDownloadUrl(backup.id, file.id);
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-4 border p-3 rounded-xl hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-all bg-white/30 dark:bg-black/10"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center shrink-0">
                            <MdInsertDriveFile size={20} />
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold truncate max-w-[160px] sm:max-w-[200px]" style={{ color: theme.text }} title={file.filename}>
                              {file.filename}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                              {getFileExtensionLabel(file.filename, file.contentType)} • {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                        <a
                          href={downloadUrl}
                          download={file.filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all cursor-pointer shadow-sm shrink-0"
                          title="Download attachment"
                        >
                          <MdFileDownload size={18} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MailBackupViewer;
