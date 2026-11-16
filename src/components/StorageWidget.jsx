import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "../context/LanguageContext";
import { mailAPI } from '../services/api';
import { Cloud } from 'lucide-react';

const StorageWidget = ({ isDesktopOpen, isExpanded }) => {
  const { t } = useTranslation();
  const [storageData, setStorageData] = useState({
    used: 0,
    limit: 1073741824, // 1 GB fallback
    percentage: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStorage = useCallback(async () => {
    try {
      const res = await mailAPI.getStorageQuota();
      const apiData = res.data?.data || res.data;
      if (apiData && (apiData.storageUsed !== undefined || apiData.used !== undefined || res.data?.success)) {
        const rawUsed = apiData.storageUsed ?? apiData.used ?? 0;
        const rawLimit = apiData.storageLimit ?? apiData.limit ?? 1073741824;

        const storageUsed = typeof rawUsed === 'number' ? rawUsed : parseFloat(rawUsed) || 0;
        const storageLimit = typeof rawLimit === 'number' && rawLimit > 0
          ? rawLimit
          : (parseFloat(rawLimit) > 0 ? parseFloat(rawLimit) : 1073741824);

        // Calculate percentage: (storageUsed / storageLimit) * 100 rounded to nearest whole number
        let calculatedPercentage = 0;
        if (storageLimit > 0 && !isNaN(storageUsed)) {
          calculatedPercentage = Math.round((storageUsed / storageLimit) * 100);
        }

        // Prevent invalid, negative, or greater-than-100 values
        const safePercentage = Math.min(100, Math.max(0, isNaN(calculatedPercentage) ? 0 : calculatedPercentage));

        setStorageData({
          used: storageUsed,
          limit: storageLimit,
          percentage: safePercentage
        });
      }
    } catch (err) {
      console.error("Failed to fetch storage quota", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();

    const handleStorageUpdate = () => {
      fetchStorage();
    };

    window.addEventListener('focus', handleStorageUpdate);
    window.addEventListener('storageQuotaUpdated', handleStorageUpdate);
    window.addEventListener('bnx_storage_updated', handleStorageUpdate);

    return () => {
      window.removeEventListener('focus', handleStorageUpdate);
      window.removeEventListener('storageQuotaUpdated', handleStorageUpdate);
      window.removeEventListener('bnx_storage_updated', handleStorageUpdate);
    };
  }, [fetchStorage]);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return null;

  const showFull = isExpanded !== undefined ? isExpanded : isDesktopOpen;

  if (!showFull) {
    return (
      <a
        href="https://storage.beta-softnet.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-2 mb-1.5 p-1.5 flex flex-col items-center justify-center hover:bg-blue-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
        title={`${formatSize(storageData.used)} of ${formatSize(storageData.limit)} used (${storageData.percentage}%)`}
      >
        <Cloud size={16} className="text-blue-500 fill-blue-500" />
        <span className="text-[9px] font-bold text-blue-600 mt-0.5">{storageData.percentage}%</span>
      </a>
    );
  }

  return (
    <a
      href="https://storage.beta-softnet.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mx-3 mb-1.5 px-3 py-2 rounded-xl bg-white dark:bg-gray-800/95 shadow-[0_1px_4px_rgba(0,0,0,0.02)] border border-blue-100/70 dark:border-gray-700/60 hover:border-blue-200 dark:hover:border-gray-600 transition-all block cursor-pointer"
      style={{ textDecoration: 'none' }}
    >
      {/* Top row: Cloud icon, Storage title, percentage */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cloud size={15} className="text-blue-500 fill-blue-500 shrink-0" />
          <span className="text-xs font-semibold text-[#1e293b] dark:text-gray-100 font-sans truncate">
            {t('storage.storage_widget_title', 'Storage')}
          </span>
        </div>
        <span className="text-[11px] font-bold text-[#1d4ed8] dark:text-blue-400 font-sans shrink-0 ml-2">
          {storageData.percentage}%
        </span>
      </div>

      {/* Horizontal progress bar */}
      <div className="w-[92%] bg-[#dbeafe] dark:bg-gray-700 h-1 rounded-full overflow-hidden mb-1.5">
        <div
          className="bg-[#3b82f6] h-full rounded-full transition-all duration-300"
          style={{ width: `${storageData.percentage}%` }}
        />
      </div>

      {/* Subtext */}
      <div className="text-[11px] leading-tight text-[#64748b] dark:text-gray-400 font-medium font-sans">
        {formatSize(storageData.used)} of {formatSize(storageData.limit)} {t('storage.used_of', 'used')}
      </div>
    </a>
  );
};

export default StorageWidget;
