import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Wrench } from "lucide-react";
import { systemAPI } from "../services/api";

const Maintenance = () => {
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Poll every 10 seconds to check if maintenance is over
    const interval = setInterval(async () => {
      checkStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await systemAPI.getStatus();
      if (res.data?.data?.maintenanceMode === false) {
        // Maintenance is over!
        window.location.href = "/"; // Force full reload to get back to app
      }
    } catch (err) {
      console.error("Still in maintenance or network error", err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          System Maintenance
        </h1>
        
        <p className="text-slate-600 mb-8 leading-relaxed">
          BNX Mail is currently undergoing scheduled maintenance to improve our services and reliability. 
          We'll be back online shortly. Thank you for your patience!
        </p>

        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70 w-full"
          >
            {checking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Checking status...
              </>
            ) : (
              "Check Status Again"
            )}
          </button>
          
          <p className="text-sm text-slate-400">
            Your data is safe and your active sessions will automatically resume once we're back.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
