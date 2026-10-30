import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { MdSecurity, MdCheckCircle, MdError, MdRefresh, MdLock, MdCloudQueue, MdLanguage, MdLaunch } from "react-icons/md";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { authAPI, userAPI } from "../services/api";

const APP_CONFIGS = {
  "beta-website": {
    clientId: "beta_website",
    appName: "Beta Website",
    clientSecret: "secure-beta-secret-2026",
    storageKey: "beta_website_oauth_session",
    icon: MdLanguage,
    accentColor: "#2563eb",
    bgGradient: "from-blue-600 to-indigo-700",
    description: "Official Beta Softnet portal & corporate services website.",
    apiScope: "Basic Profile, Account SSO"
  },
  "beta-storage": {
    clientId: "beta-storage",
    appName: "Beta Storage",
    clientSecret: "secure-storage-secret-2026",
    storageKey: "beta_storage_oauth_session",
    icon: MdCloudQueue,
    accentColor: "#059669",
    bgGradient: "from-emerald-600 to-teal-700",
    description: "Cloud-native distributed storage system and vault backup.",
    apiScope: "Files, Storage Quota, Account SSO"
  }
};

const RemoteConnectedApp = ({ appType = "beta-website" }) => {
  const config = APP_CONFIGS[appType] || APP_CONFIGS["beta-website"];
  const location = useLocation();

  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(config.storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [revocationNotice, setRevocationNotice] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const stompClientRef = useRef(null);

  // Parse any revocation message passed via URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("revoked") === "true") {
      setRevocationNotice(params.get("message") || "Your session has been revoked. Please log in again.");
    }
  }, [location.search]);

  // Handle remote revocation trigger
  const handleRemoteRevoked = (reason = "Your session has been revoked. Please log in again.") => {
    console.warn(`[${config.appName}] Session revoked remotely:`, reason);
    localStorage.removeItem(config.storageKey);
    setSession(null);
    setRevocationNotice(reason);
    setWsConnected(false);
    toast.error(reason, { id: `${config.clientId}-revoked-toast`, duration: 6000 });

    if (stompClientRef.current) {
      try {
        stompClientRef.current.deactivate();
      } catch (e) {}
    }
  };

  // 1. WebSocket listener for live revocation broadcasts
  useEffect(() => {
    if (!session?.token) return;

    let isSubscribed = true;

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const host = window.location.hostname || "localhost";
      const backendUrl = `${protocol}//${host}:8080/ws`;

      const client = new Client({
        webSocketFactory: () => new SockJS(backendUrl),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          if (!isSubscribed) return;
          setWsConnected(true);

          // Listen on general session-revocation topic
          client.subscribe("/topic/session-revocation", (msg) => {
            try {
              const body = JSON.parse(msg.body);
              if (
                body.clientId === config.clientId &&
                (!body.sessionId || Number(body.sessionId) === Number(session.sessionId))
              ) {
                handleRemoteRevoked(body.message || "Your session has been revoked. Please log in again.");
              }
            } catch (err) {
              console.error("Failed to parse session-revocation message", err);
            }
          });

          // Listen on client-specific topic
          client.subscribe(`/topic/client/${config.clientId}/session-revocation`, (msg) => {
            try {
              const body = JSON.parse(msg.body);
              if (!body.sessionId || Number(body.sessionId) === Number(session.sessionId)) {
                handleRemoteRevoked(body.message || "Your session has been revoked. Please log in again.");
              }
            } catch (err) {
              console.error("Failed to parse client revocation message", err);
            }
          });
        },
        onDisconnect: () => {
          if (isSubscribed) setWsConnected(false);
        },
        onStompError: () => {
          if (isSubscribed) setWsConnected(false);
        }
      });

      client.activate();
      stompClientRef.current = client;

      return () => {
        isSubscribed = false;
        try {
          client.deactivate();
        } catch (e) {}
      };
    } catch (e) {
      console.warn("Could not initiate WebSocket for remote app", e);
    }
  }, [session?.token, session?.sessionId, config.clientId]);

  // 2. Polling session verification heartbeat (checks server-side session validity every 3.5 seconds)
  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await authAPI.checkOAuthSession(session.token);
        if (!isMounted) return;
        if (!res.data?.success || res.data?.data?.active === false) {
          handleRemoteRevoked("Your session has been revoked. Please log in again.");
        }
      } catch (err) {
        if (!isMounted) return;
        // HTTP 401 means server-side token or session was invalidated / revoked!
        if (err.response?.status === 401 || err.response?.data?.error === "session_revoked") {
          handleRemoteRevoked("Your session has been revoked. Please log in again.");
        }
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session?.token]);

  // 3. Cross-tab BroadcastChannel & LocalStorage Event Listener
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel("bnx_session_events");
      bc.onmessage = (event) => {
        const data = event.data;
        if (
          data?.type === "SESSION_REVOKED" &&
          data.clientId === config.clientId &&
          (!session?.sessionId || !data.sessionId || Number(data.sessionId) === Number(session.sessionId))
        ) {
          handleRemoteRevoked("Your session has been revoked. Please log in again.");
        }
      };
    } catch (e) {}

    const handleStorageEvent = (e) => {
      if (e.key === "bnx_revoked_session" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (
            data.clientId === config.clientId &&
            (!session?.sessionId || !data.sessionId || Number(data.sessionId) === Number(session.sessionId))
          ) {
            handleRemoteRevoked("Your session has been revoked. Please log in again.");
          }
        } catch (err) {}
      }
    };

    window.addEventListener("storage", handleStorageEvent);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [session?.sessionId, config.clientId]);

  // Authorize / Login via BNX SSO
  const handleAuthorizeSSO = async () => {
    setIsAuthorizing(true);
    setRevocationNotice(null);
    try {
      // 1. Generate authorization code using BNXmail backend
      const authRes = await authAPI.authorizeOAuth({
        clientId: config.clientId,
        redirectUri: "http://localhost:3000/",
        state: "state_" + Date.now()
      });

      if (!authRes.data?.success || !authRes.data?.data?.code) {
        throw new Error(authRes.data?.message || "Failed to generate authorization code");
      }

      const code = authRes.data.data.code;

      // 2. Exchange authorization code for Access Token
      const tokenRes = await authAPI.exchangeOAuthToken({
        grantType: "authorization_code",
        code: code,
        clientId: config.clientId,
        clientSecret: config.clientSecret
      });

      if (!tokenRes.data?.success || !tokenRes.data?.data?.access_token) {
        throw new Error(tokenRes.data?.message || "Failed to exchange token");
      }

      const accessToken = tokenRes.data.data.access_token;

      // 3. Inspect / verify session info from token
      const inspectRes = await authAPI.checkOAuthSession(accessToken);
      const sessionData = inspectRes.data?.data || {};

      const newSession = {
        token: accessToken,
        sessionId: sessionData.sessionId || Date.now(),
        email: sessionData.email || "user@bnxmail.com",
        appName: config.appName,
        clientId: config.clientId,
        authorizedAt: new Date().toISOString()
      };

      localStorage.setItem(config.storageKey, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Successfully connected to ${config.appName}`);
    } catch (err) {
      console.error("SSO Authorization failed", err);
      toast.error(err.response?.data?.message || err.message || "OAuth authorization failed. Ensure you are logged into BNXmail.");
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Test protected API request with the token
  const handleTestProtectedApi = async () => {
    if (!session?.token) return;
    setTestingApi(true);
    setApiResult(null);
    try {
      const res = await authAPI.checkOAuthSession(session.token);
      setApiResult({
        success: true,
        status: 200,
        message: "Protected API call succeeded. Session is active on server.",
        data: res.data?.data
      });
      toast.success("Protected API call succeeded!");
    } catch (err) {
      setApiResult({
        success: false,
        status: err.response?.status || 500,
        message: err.response?.data?.message || "API call failed. Token or session is invalid.",
        data: err.response?.data
      });
      if (err.response?.status === 401) {
        handleRemoteRevoked("Your session has been revoked. Please log in again.");
      }
    } finally {
      setTestingApi(false);
    }
  };

  const AppIcon = config.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 text-white shadow-inner flex items-center justify-center">
            <AppIcon size={24} style={{ color: config.accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">{config.appName}</h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Connected App
              </span>
            </div>
            <p className="text-xs text-slate-400">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings?tab=sessions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <span>BNXmail Settings</span>
            <MdLaunch size={14} className="text-slate-400" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 flex flex-col gap-6">
        {/* Revocation Alert Banner */}
        {revocationNotice && (
          <div className="p-5 rounded-2xl bg-red-950/80 border border-red-500/60 shadow-xl shadow-red-950/40 flex items-start gap-4 animate-fadeIn">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5">
              <MdError size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-200">Remote Session Revoked</h3>
              <p className="text-sm text-red-300 mt-1 font-medium">{revocationNotice}</p>
              <p className="text-xs text-red-400/80 mt-2">
                BNXmail revoked authorization for this application. Any access tokens have been invalidated on the server.
              </p>
            </div>
          </div>
        )}

        {/* LOGGED IN / ACTIVE STATE */}
        {session ? (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <MdCheckCircle size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-white">Active Authorized Session</h2>
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Authenticated as <span className="text-white font-medium">{session.email}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Client ID:</span>
                  <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono">
                    {config.clientId}
                  </code>
                </div>
              </div>

              {/* Session Diagnostics Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium">Session ID</span>
                  <p className="text-sm font-semibold font-mono text-white mt-1">#{session.sessionId || "N/A"}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium">WebSocket Status</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    <p className="text-sm font-semibold text-white">
                      {wsConnected ? "Subscribed (/topic)" : "Connecting..."}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium">Session Heartbeat</span>
                  <p className="text-sm font-semibold text-emerald-400 mt-1">Active (every 3.5s)</p>
                </div>
              </div>
            </div>

            {/* Verification & Remote Revocation Testing Card */}
            <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col gap-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MdSecurity className="text-blue-400" size={20} />
                  Remote Revocation Verification
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Leave this tab open and click <strong>Revoke Access</strong> in BNXmail (Settings → Active Sessions & Logs → Connected Applications). This page will immediately detect revocation and automatically log out.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={testingApi}
                  onClick={handleTestProtectedApi}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {testingApi ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <MdRefresh size={16} />
                      <span>Test Protected API Call</span>
                    </>
                  )}
                </button>

                <Link
                  to="/settings?tab=sessions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Go to BNXmail to Revoke</span>
                  <MdLaunch size={14} />
                </Link>

                <button
                  type="button"
                  onClick={() => handleRemoteRevoked("User signed out from device.")}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer ml-auto"
                >
                  Sign Out Locally
                </button>
              </div>

              {/* API Response Display */}
              {apiResult && (
                <div
                  className={`p-4 rounded-xl border text-xs font-mono transition-all animate-fadeIn ${
                    apiResult.success
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-red-950/40 border-red-500/40 text-red-300"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {apiResult.success ? <MdCheckCircle size={16} /> : <MdError size={16} />}
                    Status {apiResult.status}: {apiResult.message}
                  </p>
                  {apiResult.data && (
                    <pre className="mt-2 text-[11px] overflow-x-auto p-2 bg-black/40 rounded">
                      {JSON.stringify(apiResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* LOGGED OUT / LOGIN VIEW */
          <div className="p-8 md:p-12 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center text-center max-w-xl mx-auto my-auto animate-scaleUp">
            <div className="p-4 rounded-3xl bg-slate-800/80 border border-slate-700 text-white shadow-xl mb-4">
              <AppIcon size={44} style={{ color: config.accentColor }} />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">Sign In to {config.appName}</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md">
              Authorize securely using your BNX Mail credentials with Single Sign-On (SSO).
            </p>

            <div className="w-full my-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Application:</span>
                <span className="font-semibold text-slate-200">{config.appName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Client ID:</span>
                <span className="font-mono text-slate-200">{config.clientId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Requested Scope:</span>
                <span className="text-slate-200">{config.apiScope}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isAuthorizing}
              onClick={handleAuthorizeSSO}
              className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-blue-600/25 disabled:opacity-50"
            >
              {isAuthorizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authorizing via BNX SSO...</span>
                </>
              ) : (
                <>
                  <MdLock size={18} />
                  <span>Sign In with BNX Mail (OAuth SSO)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 mt-4">
              Protected by BNX Identity & OAuth 2.0 Security Architecture
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default RemoteConnectedApp;
