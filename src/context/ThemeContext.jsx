import { settingsAPI } from "../services/api";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

const ThemeContext = createContext();

export const themes = {
  Classic: {
    mode: "light",
    bg: "#E9F4FF",
    sidebarBg: "#E9F4FF",
    sidebarText: "#1956AC",
    cardBg: "#FFFFFF",
    text: "#1f2937",
    subText: "#4b5563",
    border: "#e5e7eb",
    accent: "#1956AC",
  },
  Dark: {
    mode: "dark",
    bg: "#111827",
    sidebarBg: "#1f2937",
    sidebarText: "#93C5FD",
    cardBg: "#1f2937",
    text: "#F9FAFB",
    subText: "#D1D5DB",
    border: "#374151",
    accent: "#3B82F6",
  },
  Nature: {
    mode: "light",
    bg: "#F1F8E9",
    sidebarBg: "#F1F8E9",
    sidebarText: "#33691E",
    cardBg: "#FFFFFF",
    text: "#1B5E20",
    subText: "#558B2F",
    border: "#C5E1A5",
    accent: "#558B2F",
  },
  Ocean: {
    mode: "light",
    bg: "#C7FDF7",
    sidebarBg: "#C7FDF7",
    sidebarText: "#006660",
    cardBg: "#FFFFFF",
    text: "#0F172A",
    subText: "#008B82",
    border: "#9DF7EE",
    accent: "#008B82",
  },
  Sunset: {
    mode: "light",
    bg: "#FFF3E0",
    sidebarBg: "#FFF3E0",
    sidebarText: "#E65100",
    cardBg: "#FFFFFF",
    text: "#3c1500",
    subText: "#F57C00",
    border: "#FFE0B2",
    accent: "#E65100",
  },
  Minimal: {
    mode: "light",
    bg: "#F9FAFB",
    sidebarBg: "#F9FAFB",
    sidebarText: "#111827",
    cardBg: "#FFFFFF",
    text: "#111827",
    subText: "#6B7280",
    border: "#E5E7EB",
    accent: "#111827",
  },
};

/* Curated preset background images (royalty-free from Unsplash) */
export const PRESET_BACKGROUNDS = [
  { label: "Ocean Sunset", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80" },
  { label: "Cherry Blossom", url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1920&q=80" },
  { label: "Desert Dunes", url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1920&q=80" },
  { label: "Autumn Leaves", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80" },
];

export const ThemeProvider = ({ children }) => {
  const [currentThemeName, setCurrentThemeName] = useState("Classic");
  const [backgroundImage, setBackgroundImageState] = useState(null);
  const [dynamicTextColor, setDynamicTextColor] = useState(null);
  const [readingPaneMode, setReadingPaneMode] = useState("no_split");
  const [isLandscapeImage, setIsLandscapeImage] = useState(true);
  const [emailsPerPage, setEmailsPerPage] = useState(20);
  const [customAccentColor, setCustomAccentColor] = useState(null);
  const [customFontSize, setCustomFontSize] = useState(1.0);
  
  const defaultSidebarPrefs = {
    Inbox: true, Starred: true, Snoozed: true, Sent: true, Draft: true, Trash: true, "Notification": true, "Archive": true
  };
  const [sidebarPreferences, setSidebarPreferencesState] = useState(defaultSidebarPrefs);

  // Load theme + background on first mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && themes[savedTheme]) {
      setCurrentThemeName(savedTheme);
    }
    const savedBg = localStorage.getItem("bnx_bg_image");
    if (savedBg) {
      setBackgroundImageState(savedBg);
    }
    const savedReadingPane = localStorage.getItem("bnx_reading_pane");
    if (savedReadingPane) {
      setReadingPaneMode(savedReadingPane);
    }
    const savedEmailsPerPage = localStorage.getItem("bnx_emails_per_page");
    if (savedEmailsPerPage) {
      setEmailsPerPage(parseInt(savedEmailsPerPage, 10));
    }
    const savedSidebarPrefs = localStorage.getItem("bnx_sidebar_prefs");
    if (savedSidebarPrefs) {
      try {
        const parsed = JSON.parse(savedSidebarPrefs);
        delete parsed["Bulk Mail"];
        delete parsed["bulk mail"];
        delete parsed["bulk"];
        setSidebarPreferencesState(parsed);
      } catch (e) {}
    }
    const savedAccent = localStorage.getItem("bnx_accent_color");
    if (savedAccent) setCustomAccentColor(savedAccent);
    const savedFontSize = localStorage.getItem("bnx_font_size");
    if (savedFontSize) {
      const parsed = parseFloat(savedFontSize);
      setCustomFontSize(parsed);
      document.documentElement.style.fontSize = `${parsed * 16}px`;
    }
  }, []);

  // Calculate brightness of background image to determine font color
  useEffect(() => {
    if (!backgroundImage) {
      setDynamicTextColor(null);
      setIsLandscapeImage(true);
      return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = backgroundImage;
    img.onload = () => {
      setIsLandscapeImage(img.width >= img.height);
      const canvas = document.createElement("canvas");
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 50, 50);
      try {
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const pixels = data.length / 4;
        const brightness = (0.299 * (r / pixels) + 0.587 * (g / pixels) + 0.114 * (b / pixels));
        if (brightness > 135) {
          setDynamicTextColor("#000000"); // Light image, black text
        } else {
          setDynamicTextColor("#ffffff"); // Dark image, white text
        }
      } catch (e) {
        console.error("CORS issue calculating brightness, falling back to white", e);
        setDynamicTextColor("#ffffff");
      }
    };
    img.onerror = () => {
      setDynamicTextColor("#ffffff");
    };
  }, [backgroundImage]);

  // Sync theme changes
  useEffect(() => {
    const theme = themes[currentThemeName];
    localStorage.setItem("theme", currentThemeName);

    // Tailwind dark mode sync
    document.documentElement.classList.toggle(
      "dark",
      theme.mode === "dark"
    );
  }, [currentThemeName]);

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentThemeName(themeName);
    }
  };

  const setBackgroundImage = (url) => {
    setBackgroundImageState(url);
    if (url) {
      localStorage.setItem("bnx_bg_image", url);
    } else {
      localStorage.removeItem("bnx_bg_image");
    }
  };

  const clearBackgroundImage = () => {
    setBackgroundImageState(null);
    localStorage.removeItem("bnx_bg_image");
  };

  const setReadingPaneModeState = (mode) => {
    setReadingPaneMode(mode);
    localStorage.setItem("bnx_reading_pane", mode);
  };

  const setEmailsPerPageState = (count) => {
    setEmailsPerPage(count);
    localStorage.setItem("bnx_emails_per_page", count.toString());
  };

  const updateCustomAccentColor = (color) => {
    setCustomAccentColor(color);
    if (color) localStorage.setItem("bnx_accent_color", color);
    else localStorage.removeItem("bnx_accent_color");
  };

  const updateCustomFontSize = (size) => {
    setCustomFontSize(size);
    if (size) {
      localStorage.setItem("bnx_font_size", size.toString());
      document.documentElement.style.fontSize = `${size * 16}px`;
    } else {
      localStorage.removeItem("bnx_font_size");
      document.documentElement.style.fontSize = '16px';
    }
  };

  const setSidebarPreferences = (prefs) => {
    const cleaned = { ...prefs };
    delete cleaned["Bulk Mail"];
    delete cleaned["bulk mail"];
    delete cleaned["bulk"];
    setSidebarPreferencesState(cleaned);
    localStorage.setItem("bnx_sidebar_prefs", JSON.stringify(cleaned));
  };

  // Merge dynamic text color into the current theme
  const activeTheme = { ...themes[currentThemeName] };
  if (customAccentColor) {
    activeTheme.accent = customAccentColor;
  }
  // Removed dynamicTextColor override: with the new glassmorphism and opaque 
  // UI backgrounds, the standard theme text color is always perfectly readable.

  return (
    <ThemeContext.Provider
      value={{
        theme: activeTheme,
        currentThemeName,
        changeTheme,
        themeNames: Object.keys(themes),
        backgroundImage,
        setBackgroundImage,
        clearBackgroundImage,
        dynamicTextColor,
        isLandscapeImage,
        readingPaneMode,
        setReadingPaneModeState,
        emailsPerPage,
        setEmailsPerPageState,
        sidebarPreferences,
        setSidebarPreferences,
        customAccentColor,
        updateCustomAccentColor,
        customFontSize,
        updateCustomFontSize
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: {
        mode: 'light',
        cardBg: '#ffffff',
        border: '#e5e7eb',
        text: '#111827',
        subText: '#6b7280',
        accent: '#2563eb',
        bg: '#f8fafc'
      },
      currentThemeName: 'Classic Light',
      readingPaneMode: 'no_split',
      emailsPerPage: 50,
      sidebarPreferences: {},
      backgroundImage: '',
      changeTheme: () => {},
      setBackgroundImage: () => {},
      clearBackgroundImage: () => {},
      setReadingPaneModeState: () => {},
      setEmailsPerPageState: () => {},
      setSidebarPreferences: () => {},
      updateCustomAccentColor: () => {},
      updateCustomFontSize: () => {},
    };
  }
  return context;
};


