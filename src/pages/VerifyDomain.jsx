import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { businessAPI } from "../services/api";
import logo from "../assets/bnx-remove.png";
import { CheckCircle, Copy, RefreshCw, ShieldCheck, Globe } from "lucide-react";
import toast from "react-hot-toast";

const VerifyDomain = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tempToken, domain, username } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dnsRecords, setDnsRecords] = useState([
    { type: "TXT", host: "@", value: `bnx-verification=${Math.random().toString(36).substring(7)}`, ttl: "3600" },
    { type: "MX", host: "@", value: "mx1.bnxmail.com", priority: "10" }
  ]);

  useEffect(() => {
    if (!tempToken) {
      navigate("/register");
    }
  }, [tempToken, navigate]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleVerify = async () => {
    setVerifying(true);
    // Simulate verification delay
    setTimeout(() => {
      setVerifying(false);
      toast.success("Domain verified successfully!");
      navigate("/login");
    }, 2000);
  };

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <img src={logo} alt="BNX Mail" className="mx-auto h-12 w-auto mb-6" />
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Verify Your Domain
          </h1>
          <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
            Configure your DNS records to activate <span className="font-bold text-indigo-600">@{domain}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-900/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
                <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Onboarding: {username}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Follow the steps below to verify ownership of your business domain.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Step 1: Add DNS Records</h3>
              <div className="space-y-4">
                {dnsRecords.map((record, index) => (
                  <div key={index} className="group relative bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Type</span>
                        <span className="font-mono font-bold text-indigo-600">{record.type}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Host</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{record.host}</span>
                      </div>
                      <div className="md:col-span-2 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Value</span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">{record.value}</span>
                          <button 
                            onClick={() => handleCopy(record.value)}
                            className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-2xl">
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  <span className="font-bold">Pro Tip:</span> DNS propagation can take anywhere from a few minutes to 48 hours. Most modern providers (GoDaddy, Cloudflare, Namecheap) update within 5 minutes.
                </p>
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {verifying ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {verifying ? "Verifying Records..." : "I've Added the Records - Verify Now"}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Need help? <a href="#" className="text-indigo-600 font-bold hover:underline">Contact Business Support</a>
        </p>
      </div>
    </div>
  );
};

export default VerifyDomain;
