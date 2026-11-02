import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import en from '../locales/en.json';
import ta from '../locales/ta.json';
import hi from '../locales/hi.json';
import te from '../locales/te.json';
import ml from '../locales/ml.json';
import kn from '../locales/kn.json';
import { settingsAPI } from '../services/api';

const translations = { en, ta, hi, te, ml, kn };

export const normalizeLang = (code) => {
  if (!code) return 'en';
  const c = code.toLowerCase();
  if (c.startsWith('ta')) return 'ta';
  if (c.startsWith('hi')) return 'hi';
  if (c.startsWith('te')) return 'te';
  if (c.startsWith('ml')) return 'ml';
  if (c.startsWith('kn')) return 'kn';
  return 'en';
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const fetchUserLanguage = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await settingsAPI.getLanguage();
      if (response.data && response.data.language) {
        const lang = normalizeLang(response.data.language);
        setCurrentLanguage(lang);
      }
    } catch (err) {
      console.warn("Could not fetch user language preference from backend:", err);
    }
  };

  useEffect(() => {
    fetchUserLanguage();

    const handleLangEvent = (e) => {
      if (e.detail?.language) {
        const normalized = normalizeLang(e.detail.language);
        setCurrentLanguage(normalized);
      }
    };

    window.addEventListener('bnx_language_changed', handleLangEvent);

    return () => {
      window.removeEventListener('bnx_language_changed', handleLangEvent);
    };
  }, []);

  const applyLanguage = (newLang) => {
    const lang = normalizeLang(newLang);
    setCurrentLanguage(lang);
    window.dispatchEvent(new CustomEvent('bnx_language_changed', { detail: { language: lang } }));
  };

  const t = (keyPath, fallback = '') => {
    if (!keyPath) return fallback;
    const keys = keyPath.split('.');
    
    let activeDict = translations[currentLanguage] || translations['en'];
    let val = activeDict;
    for (const k of keys) {
      val = val ? val[k] : undefined;
    }
    if (val !== undefined && typeof val === 'string') {
      return val;
    }

    // Fallback to English
    let enDict = translations['en'];
    let enVal = enDict;
    for (const k of keys) {
      enVal = enVal ? enVal[k] : undefined;
    }
    if (enVal !== undefined && typeof enVal === 'string') {
      return enVal;
    }

    return fallback || keyPath;
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, applyLanguage, fetchUserLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      currentLanguage: 'en',
      applyLanguage: async () => {},
      fetchUserLanguage: async () => {},
      t: (keyPath, fallback = '') => fallback || keyPath || ''
    };
  }
  return ctx;
};

export const useTranslation = () => {
  const { t, currentLanguage, applyLanguage } = useLanguage();
  return { t, currentLanguage, applyLanguage };
};

