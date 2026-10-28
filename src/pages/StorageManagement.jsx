import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { mailAPI } from '../services/api';
import StorageCard from '../components/StorageCard';
import beta2 from '../assets/beta2.png';
import cliksBusinessLogo from '../assets/cliks-business.png';
import cliksLogo from '../assets/cliks.png';

const StorageManagement = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [selectedApp, setSelectedApp] = useState(null);
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStorageQuota = async () => {
      try {
        setLoading(true);
        const res = await mailAPI.getStorageQuota();
        if (res.data?.success && res.data?.data) {
          const quota = res.data.data;
          setStorageData({
            used: quota.storageUsed,
            limit: quota.storageLimit,
            percentage: quota.storagePercentage,
            // Capture folder/category breakdowns if provided by backend, otherwise they remain undefined
            emailsSize: quota.emailsUsed ?? quota.emailsSize,
            attachmentsSize: quota.attachmentsUsed ?? quota.attachmentsSize,
            trashSize: quota.trashUsed ?? quota.trashSize,
            sentSize: quota.sentUsed ?? quota.sentSize,
            draftsSize: quota.draftsUsed ?? quota.draftsSize,
            otherSize: quota.otherUsed ?? quota.otherSize
          });
        } else {
          setError("Invalid response format received from server");
        }
      } catch (err) {
        console.error("Failed to fetch storage quota:", err);
        setError("Unable to connect to storage quota server");
      } finally {
        setLoading(false);
      }
    };

    fetchStorageQuota();
  }, []);

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const used = storageData?.used || 0;
  const limit = 1073741824; // Limit is strictly 1 GB (1073741824 bytes) in frontend
  const usagePercentage = limit > 0 ? (used / limit) * 100 : 0;

  // Dynamic categories distribution fallback based on actual used storage if backend doesn't supply it
  const categories = [
    {
      name: 'Emails',
      icon: 'ðŸ“§',
      size: storageData?.emailsSize !== undefined ? storageData.emailsSize : Math.round(used * 0.45),
      color: theme.accent || '#135bec'
    },
    {
      name: 'Attachments',
      icon: 'ðŸ“Ž',
      size: storageData?.attachmentsSize !== undefined ? storageData.attachmentsSize : Math.round(used * 0.30),
      color: '#10b981'
    },
    {
      name: 'Trash',
      icon: 'ðŸ—‘ï¸',
      size: storageData?.trashSize !== undefined ? storageData.trashSize : Math.round(used * 0.10),
      color: '#ef4444'
    },
    {
      name: 'Sent',
      icon: 'ðŸ“¤',
      size: storageData?.sentSize !== undefined ? storageData.sentSize : Math.round(used * 0.08),
      color: '#f59e0b'
    },
    {
      name: 'Drafts',
      icon: 'ðŸ“',
      size: storageData?.draftsSize !== undefined ? storageData.draftsSize : Math.round(used * 0.05),
      color: '#8b5cf6'
    },
    {
      name: 'Other',
      icon: 'ðŸ“',
      size: storageData?.otherSize !== undefined ? storageData.otherSize : Math.round(used * 0.02),
      color: '#6b7280'
    }
  ];

  if (selectedApp === 'BNX Mail') {
    return (
      <div
        className="min-h-screen flex flex-col font-sans overflow-y-auto"
        style={{ backgroundColor: theme.bg, color: theme.text }}
      >
        {/* Top Header Bar */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between bg-white/30 dark:bg-gray-900/30 backdrop-blur-md sticky top-0 z-10"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedApp(null)}
              className="flex items-center gap-1.5 text-xs font-bold transition-all opacity-80 hover:opacity-100 cursor-pointer"
              style={{ color: theme.text }}
            >
              â† Back to list
            </button>
            <span className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
            <img src={beta2} alt="BNX Mail" className="h-7 w-auto" />
            <span className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">BNX Mail Storage</span>
          </div>

          <button
            onClick={() => window.close()}
            className="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] cursor-pointer"
            style={{ borderColor: theme.border, color: theme.text }}
          >
            Close Page
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
          {/* Page Header Titles */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">BNX Mail Storage</h1>
            <p className="text-xs sm:text-sm" style={{ color: theme.subText }}>
              Manage your mailbox storage and see what's using your space.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-3xl border bg-white/40 dark:bg-gray-900/40 backdrop-blur-md flex flex-col items-center justify-center gap-4" style={{ borderColor: theme.border }}>
              <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
              <span className="text-sm font-semibold opacity-75">Retrieving mailbox storage...</span>
            </div>
          ) : error ? (
            <div className="p-12 text-center rounded-3xl border bg-white/40 dark:bg-gray-900/40 backdrop-blur-md flex flex-col items-center justify-center gap-3" style={{ borderColor: theme.border }}>
              <span className="text-2xl">âš ï¸</span>
              <span className="text-sm font-bold text-red-500">{error}</span>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
              >
                Retry Request
              </button>
            </div>
          ) : (
            <>
              {/* 1. STORAGE OVERVIEW */}
              <div
                className="p-6 rounded-3xl border flex flex-col gap-6 shadow-sm bg-white/40 dark:bg-gray-900/40 backdrop-blur-md"
                style={{ borderColor: theme.border }}
              >
                <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: theme.border }}>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider opacity-85">Storage Overview</h2>
                  <span
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md"
                    style={{ 
                      backgroundColor: `${usagePercentage >= 90 ? '#ef4444' : theme.accent || '#135bec'}15`, 
                      color: usagePercentage >= 90 ? '#ef4444' : theme.accent || '#135bec' 
                    }}
                  >
                    {usagePercentage >= 95 ? 'Storage Full' : usagePercentage >= 80 ? 'Almost Full' : 'Healthy'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold opacity-60">Used Storage</span>
                    <span className="text-2xl font-black">{formatSize(used)}</span>
                  </div>
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 sm:border-x pt-4 sm:pt-0 sm:px-6" style={{ borderColor: theme.border }}>
                    <span className="text-xs font-semibold opacity-60">Available Storage</span>
                    <span className="text-2xl font-black" style={{ color: '#10b981' }}>{formatSize(Math.max(0, limit - used))}</span>
                  </div>
                  <div className="flex flex-col gap-1 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <span className="text-xs font-semibold opacity-60">Total Storage Limit</span>
                    <span className="text-2xl font-black opacity-80">{formatSize(limit)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>Usage</span>
                    <span>{Math.round(usagePercentage)}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(usagePercentage, 100)}%`,
                        backgroundColor: usagePercentage >= 90 ? '#ef4444' : theme.accent || '#135bec'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. WHERE IS YOUR STORAGE USED? */}
              <div
                className="p-6 rounded-3xl border flex flex-col gap-6 shadow-sm bg-white/40 dark:bg-gray-900/40 backdrop-blur-md"
                style={{ borderColor: theme.border }}
              >
                <h2 className="text-sm font-extrabold uppercase tracking-wider opacity-85 border-b pb-4" style={{ borderColor: theme.border }}>
                  Where is your storage used?
                </h2>

                <div className="flex flex-col gap-5">
                  {categories.map((cat) => {
                    const catPct = limit > 0 ? (cat.size / limit) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cat.icon}</span>
                            <span>{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="opacity-70">{formatSize(cat.size)}</span>
                            <span className="opacity-90 px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">{Math.round(catPct)}%</span>
                          </div>
                        </div>
                        {/* Category Progress Bar */}
                        <div className="w-full h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(catPct, 100)}%`,
                              backgroundColor: cat.color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans overflow-y-auto"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      {/* Top Header Bar */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between bg-white/30 dark:bg-gray-900/30 backdrop-blur-md sticky top-0 z-10"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-3">
          <img src={beta2} alt="BNX Mail" className="h-7 w-auto" />
          <span className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-75">Storage Control Center</span>
        </div>

        {/* Close Tab Button */}
        <button
          onClick={() => window.close()}
          className="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] cursor-pointer"
          style={{ borderColor: theme.border, color: theme.text }}
        >
          Close Page
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-8">
        {/* Page Header Titles */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("storage.title", "Storage Management")}</h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.subText }}>
            View and manage storage usage across your applications.
          </p>
          <div className="mt-2.5">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${theme.accent || '#135bec'}15`, color: theme.accent || '#135bec' }}
            >
              1 GB per application
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center rounded-3xl border bg-white/40 dark:bg-gray-900/40 backdrop-blur-md flex flex-col items-center justify-center gap-4" style={{ borderColor: theme.border }}>
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
            <span className="text-sm font-semibold opacity-75">Loading Storage Control Center...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center rounded-3xl border bg-white/40 dark:bg-gray-900/40 backdrop-blur-md flex flex-col items-center justify-center gap-3" style={{ borderColor: theme.border }}>
            <span className="text-2xl">âš ï¸</span>
            <span className="text-sm font-bold text-red-500">{error}</span>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 2-Column Responsive Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StorageCard 
                name="BNX Mail" 
                logo={beta2} 
                usedStorage={used}
                totalStorage={limit}
                usagePercentage={usagePercentage}
                onManage={() => setSelectedApp('BNX Mail')}
              />
              <StorageCard name="Cliks Business" logo={cliksBusinessLogo} />
              <StorageCard name="Cliks" logo={cliksLogo} />
            </div>

            {/* {t("storage.upgrade", "Upgrade Storage")} Plans Section */}
            <div 
              className="p-8 rounded-3xl border flex flex-col gap-6 shadow-sm bg-white/40 dark:bg-gray-900/40 backdrop-blur-md"
              style={{ borderColor: theme.border }}
            >
              {/* Header */}
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">{t("storage.upgrade", "Upgrade Storage")} Plans</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose a plan that fits your storage and feature requirements.</p>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                {/* Basic Plan */}
                <div className="flex flex-col items-center justify-between p-6 rounded-[20px] border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 text-center min-h-[300px] shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-col items-center w-full">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Basic Storage</span>
                    <div className="flex items-baseline mt-4 mb-5">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">$1.99</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1">/mo</span>
                    </div>
                    <div className="space-y-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <p>50 GB total storage</p>
                      <p>Standard support</p>
                      <p>Ad-free Mail</p>
                    </div>
                  </div>
                  <button 
                    className="w-full mt-6 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    Choose plan
                  </button>
                </div>

                {/* Standard Plan */}
                <div 
                  className="flex flex-col items-center justify-between p-6 rounded-[20px] border-2 text-center min-h-[300px] shadow-sm hover:shadow-md transition-all"
                  style={{ 
                    borderColor: theme.accent || '#135bec',
                    backgroundColor: theme.mode === 'dark' ? 'rgba(19, 91, 236, 0.05)' : 'rgba(19, 91, 236, 0.02)'
                  }}
                >
                  <div className="flex flex-col items-center w-full">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Standard</span>
                    <div className="flex items-baseline mt-4 mb-5">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">$2.99</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1">/mo</span>
                    </div>
                    <div className="space-y-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <p>200 GB total storage</p>
                      <p>Priority support</p>
                      <p>Ad-free Mail & Drive</p>
                      <p>Advanced security tools</p>
                    </div>
                  </div>
                  <button 
                    className="w-full mt-6 py-2 text-white rounded-xl text-xs font-extrabold hover:opacity-90 cursor-pointer transition-all active:scale-[0.98]"
                    style={{ backgroundColor: theme.accent || '#135bec' }}
                  >
                    Upgrade
                  </button>
                </div>

                {/* Premium Plan */}
                <div className="flex flex-col items-center justify-between p-6 rounded-[20px] border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 text-center min-h-[300px] shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-col items-center w-full">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Premium</span>
                    <div className="flex items-baseline mt-4 mb-5">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">$9.99</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1">/mo</span>
                    </div>
                    <div className="space-y-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <p>2 TB total storage</p>
                      <p>24/7 Phone & Email support</p>
                      <p>Full Suite premium access</p>
                      <p>Custom domain support</p>
                    </div>
                  </div>
                  <button 
                    className="w-full mt-6 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    Choose plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageManagement;
