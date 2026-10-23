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
import ErrorBoundary from "./components/ErrorBoundary";
import { lazyRetry } from "./utils/lazyRetry";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

/* Pages - Lazy Loaded with auto-retry and chunk reload recovery */
const Login = lazyRetry(() => import("./pages/Login"), "Login");
const ForgotPassword = lazyRetry(() => import("./pages/ForgotPassword"), "ForgotPassword");
const CreateMailbox = lazyRetry(() => import("./pages/CreateMailbox"), "CreateMailbox");
const Inbox = lazyRetry(() => import("./pages/Inbox"), "Inbox");
const Starred = lazyRetry(() => import("./pages/Starred"), "Starred");
const Unread = lazyRetry(() => import("./pages/Unread"), "Unread");
const Draft = lazyRetry(() => import("./pages/Draft"), "Draft");
const Send = lazyRetry(() => import("./pages/Send"), "Send");
const Outbox = lazyRetry(() => import("./pages/Outbox"), "Outbox");
const Scheduled = lazyRetry(() => import("./pages/Scheduled"), "Scheduled");
const Spam = lazyRetry(() => import("./pages/Spam"), "Spam");
const Trash = lazyRetry(() => import("./pages/Trash"), "Trash");
const AllMail = lazyRetry(() => import("./pages/AllMail"), "AllMail");
const Archive = lazyRetry(() => import("./pages/Archive"), "Archive");
const Settings = lazyRetry(() => import("./pages/Settings"), "Settings");
const Groups = lazyRetry(() => import("./pages/Groups"), "Groups");
const ChatRoom = lazyRetry(() => import("./pages/ChatRoom"), "ChatRoom");
const GroupDetails = lazyRetry(() => import("./pages/GroupDetails"), "GroupDetails");
const Terms = lazyRetry(() => import("./pages/Terms"), "Terms");
const Privacy = lazyRetry(() => import("./pages/Privacy"), "Privacy");
const VerifyDomain = lazyRetry(() => import("./pages/VerifyDomain"), "VerifyDomain");
const Templates = lazyRetry(() => import("./pages/Templates"), "Templates");
const Snoozed = lazyRetry(() => import("./pages/Snoozed"), "Snoozed");
const Subscriptions = lazyRetry(() => import("./pages/Subscriptions"), "Subscriptions");
const Vault = lazyRetry(() => import("./pages/Vault"), "Vault");
const Casbox = lazyRetry(() => import("./pages/Casbox"), "Casbox");
const Maintenance = lazyRetry(() => import("./pages/Maintenance"), "Maintenance");
const Support = lazyRetry(() => import("./pages/Support"), "Support");
const BulkMail = lazyRetry(() => import("./pages/BulkMail"), "BulkMail");
const Notification = lazyRetry(() => import("./pages/Notification"), "Notification");
const StorageManagement = lazyRetry(() => import("./pages/StorageManagement"), "StorageManagement");
const MailBackup = lazyRetry(() => import("./pages/MailBackup"), "MailBackup");
const MailBackupViewer = lazyRetry(() => import("./pages/MailBackupViewer"), "MailBackupViewer");
const AnalyticsApp = lazyRetry(() => import("./components/AnalyticsApp"), "AnalyticsApp");
const RemoteConnectedApp = lazyRetry(() => import("./pages/RemoteConnectedApp"), "RemoteConnectedApp");

/* Signup Pages */
const SignupLayout = lazyRetry(() => import("./pages/signup/SignupLayout"), "SignupLayout");
const SignupSelection = lazyRetry(() => import("./pages/signup/SignupSelection"), "SignupSelection");
const SignupProfile = lazyRetry(() => import("./pages/signup/SignupProfile"), "SignupProfile");
const SignupChild = lazyRetry(() => import("./pages/signup/SignupChild"), "SignupChild");
const SignupMobileVerify = lazyRetry(() => import("./pages/signup/SignupMobileVerify"), "SignupMobileVerify");
const SignupParentVerify = lazyRetry(() => import("./pages/signup/SignupParentVerify"), "SignupParentVerify");
const SignupBusiness = lazyRetry(() => import("./pages/signup/SignupBusiness"), "SignupBusiness");
const SignupMail = lazyRetry(() => import("./pages/signup/SignupMail"), "SignupMail");
const SignupPasswordSetup = lazyRetry(() => import("./pages/signup/SignupPasswordSetup"), "SignupPasswordSetup");
const SignupBusinessOnboarding = lazyRetry(() => import("./pages/signup/SignupBusinessOnboarding"), "SignupBusinessOnboarding");

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
  useKeyboardShortcuts();
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
          isDesktopSidebarOpen={isDesktopSidebarOpen}
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
            <ErrorBoundary>
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
                  <Route path="/colab/archived" element={<Groups />} />
                  <Route path="/colab/starred" element={<Groups />} />
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
            </ErrorBoundary>
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
              <ErrorBoundary>
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

                    {/* Remote Connected Application Demonstrations */}
                    <Route path="/apps/beta-website" element={<RemoteConnectedApp appType="beta-website" />} />
                    <Route path="/apps/beta-storage" element={<RemoteConnectedApp appType="beta-storage" />} />

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
              </ErrorBoundary>
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
            </Router>
          </SignupProvider>
        </SocketProvider>
      </MailProvider>
      </LanguageProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
