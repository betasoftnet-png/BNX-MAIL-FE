import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import toast, { Toaster, ToastBar } from "react-hot-toast";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { MailProvider } from "./context/MailContext";
import { SocketProvider } from "./context/SocketContext";
import { SignupProvider } from "./context/SignupContext";
import { LanguageProvider } from "./context/LanguageContext";

/* Layout */
import NavBar from "./components/NavBar";
import SideBar from "./components/SideBar";
import FloatingCompose from "./components/FloatingCompose";
import BitToolSidebar from "./components/BitToolSidebar";
import { StickyNote, NotesManager } from "./components/StickyNotes";

/* Pages - Lazy Loaded for instant application start */
const Login = React.lazy(() => import("./pages/Login"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const CreateMailbox = React.lazy(() => import("./pages/CreateMailbox"));
const Inbox = React.lazy(() => import("./pages/Inbox"));
const Starred = React.lazy(() => import("./pages/Starred"));
const Unread = React.lazy(() => import("./pages/Unread"));
const Draft = React.lazy(() => import("./pages/Draft"));
const Send = React.lazy(() => import("./pages/Send"));
const Outbox = React.lazy(() => import("./pages/Outbox"));
const Scheduled = React.lazy(() => import("./pages/Scheduled"));
const Spam = React.lazy(() => import("./pages/Spam"));
const Trash = React.lazy(() => import("./pages/Trash"));
const AllMail = React.lazy(() => import("./pages/AllMail"));
const Archive = React.lazy(() => import("./pages/Archive"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Groups = React.lazy(() => import("./pages/Groups"));
const ChatRoom = React.lazy(() => import("./pages/ChatRoom"));
const GroupDetails = React.lazy(() => import("./pages/GroupDetails"));
const Terms = React.lazy(() => import("./pages/Terms"));
const Privacy = React.lazy(() => import("./pages/Privacy"));
const VerifyDomain = React.lazy(() => import("./pages/VerifyDomain"));
const Templates = React.lazy(() => import("./pages/Templates"));
const Snoozed = React.lazy(() => import("./pages/Snoozed"));
const Subscriptions = React.lazy(() => import("./pages/Subscriptions"));
const Vault = React.lazy(() => import("./pages/Vault"));
const Casbox = React.lazy(() => import("./pages/Casbox"));
const Maintenance = React.lazy(() => import("./pages/Maintenance"));
const Support = React.lazy(() => import("./pages/Support"));
const BulkMail = React.lazy(() => import("./pages/BulkMail"));
const Notification = React.lazy(() => import("./pages/Notification"));
const StorageManagement = React.lazy(() => import("./pages/StorageManagement"));
const MailBackup = React.lazy(() => import("./pages/MailBackup"));
const MailBackupViewer = React.lazy(() => import("./pages/MailBackupViewer"));
const AnalyticsApp = React.lazy(() => import("./components/AnalyticsApp"));

/* Signup Pages */
const SignupLayout = React.lazy(() => import("./pages/signup/SignupLayout"));
const SignupSelection = React.lazy(() => import("./pages/signup/SignupSelection"));
const SignupProfile = React.lazy(() => import("./pages/signup/SignupProfile"));
const SignupChild = React.lazy(() => import("./pages/signup/SignupChild"));
const SignupMobileVerify = React.lazy(() => import("./pages/signup/SignupMobileVerify"));
const SignupParentVerify = React.lazy(() => import("./pages/signup/SignupParentVerify"));
const SignupBusiness = React.lazy(() => import("./pages/signup/SignupBusiness"));
const SignupMail = React.lazy(() => import("./pages/signup/SignupMail"));
const SignupPasswordSetup = React.lazy(() => import("./pages/signup/SignupPasswordSetup"));
const SignupBusinessOnboarding = React.lazy(() => import("./pages/signup/SignupBusinessOnboarding"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[300px] w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary" style={{ borderTopColor: '#135bec' }} />
  </div>
);

/* ---------------- PROTECTED ROUTE ---------------- */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const getFriendlyMessage = (msg) => {
  if (!msg || typeof msg !== "string") return msg;
  const msgLower = msg.toLowerCase();

  if (msgLower.includes("unauthorized") || msgLower.includes("session expired") || msgLower.includes("token expired")) {
    return "Session expired. Please login again.";
  }
  if (msgLower.includes("network error") || msgLower.includes("failed to fetch") || msgLower.includes("networkerror")) {
    return "Connection issue. Please check your internet connection.";
  }
  if (msgLower.includes("internal server error") || msgLower.includes("500") || msgLower.includes("server error")) {
    return "Something went wrong on our end. Please try again later.";
  }
  if (msgLower.includes("bad credentials") || msgLower.includes("invalid credentials") || msgLower.includes("incorrect password")) {
    return "Incorrect email address or password.";
  }
  if (msgLower.includes("required request header") || msgLower.includes("missing auth")) {
    return "Authentication failed. Try logging out and back in.";
  }
  if (msgLower.includes("exceeds 5mb limit") || msgLower.includes("large file")) {
    return "File is too large. Size limit is 5MB.";
  }
  if (msgLower.includes("failed to add members") || msgLower.includes("members could not be added")) {
    return "Could not add members. Please check the email addresses.";
  }
  if (msgLower.includes("failed to load message history")) {
    return "Could not load messages. Please refresh.";
  }
  if (msgLower.includes("subject and body are required")) {
    return "Please enter a subject and body before sending.";
  }

  return msg;
};

/* ---------------- APP CONTENT (MAIN LAYOUT) ---------------- */
const AppContent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isBitToolSidebarOpen, setIsBitToolSidebarOpen] = useState(false);
  const { theme, backgroundImage, isLandscapeImage } = useTheme();

  // Sticky Notes State Management
  const [notes, setNotes] = useState(() => {
    try {
      const stored = localStorage.getItem("bnx_sticky_notes");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [openNoteIds, setOpenNoteIds] = useState(() => {
    try {
      const stored = localStorage.getItem("bnx_open_note_ids");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [showNotesManager, setShowNotesManager] = useState(false);

  useEffect(() => {
    localStorage.setItem("bnx_sticky_notes", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem("bnx_open_note_ids", JSON.stringify(openNoteIds));
  }, [openNoteIds]);

  const handleCreateNote = () => {
    const newNote = {
      id: "note_" + Date.now(),
      title: "New Note",
      content: "",
      color: "yellow",
      category: "Personal",
      type: "text",
      isMinimized: false
    };
    setNotes(prev => [newNote, ...prev]);
    setOpenNoteIds(prev => [...prev, newNote.id]);
  };

  const handleUpdateNote = (id, updates) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updates } : note));
  };

  const handleDeleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    setOpenNoteIds(prev => prev.filter(noteId => noteId !== id));
  };

  const handleOpenNote = (id) => {
    if (!openNoteIds.includes(id)) {
      setOpenNoteIds(prev => [...prev, id]);
    }
  };

  const handleCloseNote = (id) => {
    setOpenNoteIds(prev => prev.filter(noteId => noteId !== id));
  };

  const isLandscapeTheme = isLandscapeImage;
  const rootStyle = { backgroundColor: theme.bg };

  return (
    <div className="flex flex-col h-screen h-[100dvh] max-h-screen overflow-hidden relative" style={rootStyle}>
      {/* Background Wallpaper: Full Cover across entire viewport */}
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              width: "100%",
              height: "100%",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundColor: theme.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.12)",
              width: "100%",
              height: "100%",
            }}
          />
        </>
      )}
      <div className="relative z-[1] flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden">
        <NavBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleDesktopSidebar={() =>
            setIsDesktopSidebarOpen((v) => !v)
          }
          onOpenMenu={() => setIsMobileSidebarOpen(true)}
          onToggleBitToolSidebar={() => setIsBitToolSidebarOpen(v => !v)}
          onOpenNotes={() => setShowNotesManager(v => !v)}
        />

        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-50 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}

          <SideBar
            isDesktopOpen={isDesktopSidebarOpen}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onOpenNotes={() => setShowNotesManager(v => !v)}
          />

          <main
            className="main-content flex-1 min-h-0 overflow-hidden ml-2 md:ml-3 mr-2 md:mr-3 mb-2 md:mb-3 mt-1 flex flex-col transition-all duration-300 rounded-2xl shadow-md border-0"
            style={{
              backgroundColor: backgroundImage
                ? (theme.mode === "dark" ? "rgba(31, 41, 55, 0.45)" : "rgba(255, 255, 255, 0.45)")
                : theme.cardBg,
              backdropFilter: backgroundImage ? "none" : "none",
              WebkitBackdropFilter: backgroundImage ? "none" : "none",
            }}
          >
            <React.Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Inbox searchQuery={searchQuery} />} />
                <Route path="/analytics" element={<AnalyticsApp />} />
                <Route path="/inbox" element={<Inbox searchQuery={searchQuery} />} />
                <Route path="/all-inbox" element={<Inbox searchQuery={searchQuery} />} />
                <Route path="/starred" element={<Starred searchQuery={searchQuery} />} />
                <Route path="/unread" element={<Unread searchQuery={searchQuery} />} />
                <Route path="/snoozed" element={<Snoozed searchQuery={searchQuery} />} />
                <Route path="/draft" element={<Draft searchQuery={searchQuery} />} />
                <Route path="/sent" element={<Send searchQuery={searchQuery} />} />
                <Route path="/outbox" element={<Outbox searchQuery={searchQuery} />} />
                <Route path="/scheduled" element={<Scheduled searchQuery={searchQuery} />} />
                <Route path="/spam" element={<Spam searchQuery={searchQuery} />} />
                <Route path="/bulk-mail" element={<BulkMail searchQuery={searchQuery} />} />
                <Route path="/notifyhub" element={<Notification searchQuery={searchQuery} />} />
                <Route path="/trash" element={<Trash searchQuery={searchQuery} />} />
                <Route path="/archive" element={<Archive searchQuery={searchQuery} />} />
                <Route path="/all-mail" element={<AllMail searchQuery={searchQuery} />} />
                <Route path="/allmail" element={<AllMail searchQuery={searchQuery} />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/colab" element={<Groups />} />
                <Route path="/colab/:id" element={<GroupDetails />} />
                {/* <Route path="/chat" element={<Groups />} /> */}
                <Route path="/chat/:chatId" element={<ChatRoom />} />
                <Route path="/label/:labelId" element={<AllMail searchQuery={searchQuery} />} />
                <Route path="/subscriptions" element={<Subscriptions searchQuery={searchQuery} />} />
                <Route path="/vault" element={<Vault />} />
                <Route path="/casbox" element={<Casbox />} />
                <Route path="/support" element={<Support />} />
                <Route path="/mail-backup" element={<MailBackup />} />
                <Route path="/mail-backup/:id" element={<MailBackupViewer />} />
              </Routes>
            </React.Suspense>
          </main>

          <BitToolSidebar 
            isOpen={isBitToolSidebarOpen} 
            onClose={() => setIsBitToolSidebarOpen(false)} 
            notes={notes}
            openNoteIds={openNoteIds}
            onOpenNote={handleOpenNote}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
          />
          
          {showNotesManager && (
            <div className="fixed inset-y-0 right-0 w-80 z-50 animate-slide-in shadow-2xl">
              <NotesManager
                notes={notes}
                openNoteIds={openNoteIds}
                onOpenNote={handleOpenNote}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNote}
                onClose={() => setShowNotesManager(false)}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Floating Sticky Notes Container */}
      <div className="fixed inset-0 pointer-events-none z-[1000]">
        {notes.filter(note => openNoteIds.includes(note.id)).map((note, idx) => (
          <div key={note.id} className="pointer-events-auto">
            <StickyNote
              note={note}
              index={idx}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onClose={handleCloseNote}
            />
          </div>
        ))}
      </div>
      
      <FloatingCompose />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: "custom-toast",
        }}
      >
        {(t) => {
          let displayMessage = t.message;
          if (typeof displayMessage === 'string') {
            displayMessage = getFriendlyMessage(displayMessage);
          }
          return (
            <ToastBar toast={{ ...t, message: displayMessage }}>
              {({ icon, message }) => (
                <>
                  {icon}
                  {message}
                  {t.type !== 'loading' && (
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="ml-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 text-xs font-semibold leading-none cursor-pointer p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded"
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </ToastBar>
          );
        }}
      </Toaster>
    </div>
  );
};

/* ---------------- ROOT APP ---------------- */
const App = () => (
  <ThemeProvider>
    <AuthProvider>
    <LanguageProvider>
      <MailProvider>
        <SocketProvider>
          <SignupProvider>
            <Router>
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Navigate to="/signup/selection" replace />} />
                  
                  {/* Signup Flow */}
                  <Route path="/signup" element={<SignupLayout />}>
                    <Route path="selection" element={<SignupSelection />} />
                    <Route path="profile" element={<SignupProfile />} />
                    <Route path="child" element={<SignupChild />} />
                    <Route path="parent-verify" element={<SignupParentVerify />} />
                    <Route path="business" element={<SignupBusiness />} />
                    <Route path="mobile-verify" element={<SignupMobileVerify />} />
                    <Route path="mail" element={<SignupMail />} />
                    <Route path="password-setup" element={<SignupPasswordSetup />} />
                  </Route>

                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/create-mailbox" element={<CreateMailbox />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/verify-domain" element={<VerifyDomain />} />
                  <Route path="/maintenance" element={<Maintenance />} />

                  {/* Protected Business Onboarding */}
                  <Route 
                    path="/signup/business-onboarding" 
                    element={
                      <ProtectedRoute>
                        <SignupBusinessOnboarding />
                      </ProtectedRoute>
                    } 
                  />

                  <Route 
                    path="/storage-management" 
                    element={
                      <ProtectedRoute>
                        <StorageManagement />
                      </ProtectedRoute>
                    } 
                  />

                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppContent />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </React.Suspense>
            </Router>
          </SignupProvider>
        </SocketProvider>
      </MailProvider>
      </LanguageProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
