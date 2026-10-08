import React, { useState, useEffect } from 'react';
import { useTranslation } from "../context/LanguageContext";
import { mailAPI } from '../services/api';
import { Cloud } from 'lucide-react';

const StorageWidget = ({ isDesktopOpen }) => {
  const { t } = useTranslation();
  const [storageData, setStorageData] = useState({
    used: 2013265, // ~1.92 MB fallback
    limit: 1073741824, // 1 GB
    percentage: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await mailAPI.getStorageQuota();
        if (res.data?.success && res.data?.data) {
          const used = res.data.data.storageUsed ?? 2013265;
          const limit = 1073741824;
          const percentage = limit > 0 ? (used / limit) * 100 : 0;
          setStorageData({
            used,
            limit,
            percentage
          });
        }
      } catch (err) {
        console.error("Failed to fetch storage quota", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStorage();
  }, []);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return null;

  if (!isDesktopOpen) {
    return (
      <a
        href="https://storage.beta-softnet.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-2 mb-2 p-2 flex flex-col items-center justify-center hover:bg-blue-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
        title={`${formatSize(storageData.used)} of 1 GB used (${storageData.percentage.toFixed(0)}%)`}
      >
        <Cloud size={20} className="text-blue-500 fill-blue-500" />
        <span className="text-[10px] font-bold text-blue-600 mt-1">{storageData.percentage.toFixed(0)}%</span>
      </a>
    );
  }

  return (
    <a
      href="https://storage.beta-softnet.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mx-2.5 mb-3 p-3.5 rounded-2xl bg-white dark:bg-gray-800/95 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-blue-100/70 dark:border-gray-700/60 hover:border-blue-200 dark:hover:border-gray-600 transition-all block cursor-pointer"
      style={{ textDecoration: 'none' }}
    >
      {/* Top row: Cloud icon, Storage title, percentage */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cloud size={19} className="text-blue-500 fill-blue-500 shrink-0" />
          <span className="text-[14px] font-semibold text-[#1e293b] dark:text-gray-100 font-sans">
            {t('storage.storage_widget_title', 'Storage')}
          </span>
        </div>
        <span className="text-[13px] font-bold text-[#1d4ed8] dark:text-blue-400 font-sans">
          {storageData.percentage.toFixed(0)}%
        </span>
      </div>

      {/* Horizontal progress bar */}
      <div className="w-full bg-[#dbeafe] dark:bg-gray-700 h-1.5 rounded-full overflow-hidden my-2">
        <div
          className="bg-[#3b82f6] h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(Math.max(storageData.percentage, 2), 100)}%` }}
        />
      </div>

      {/* Subtext */}
      <div className="text-[12px] text-[#64748b] dark:text-gray-400 font-medium font-sans">
        {formatSize(storageData.used)} of 1 GB {t('storage.used_of', 'used')}
      </div>
    </a>
  );
};

export default StorageWidget;
