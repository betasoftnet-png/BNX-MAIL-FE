import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import logo from "../assets/bnx-remove.png";
import { 
    MdEmail, 
    MdPhone, 
    MdArrowBack, 
    MdLock, 
    MdCheckCircle, 
    MdVisibility, 
    MdVisibilityOff,
    MdErrorOutline,
    MdRefresh
} from 'react-icons/md';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [identifier, setIdentifier] = useState('');
    const [options, setOptions] = useState(null);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    const handleGetOptions = async (e) => {
        e.preventDefault();
        setError('');
        if (!identifier.trim()) {
            const msg = "Please enter your email or username";
            setError(msg);
            toast.error(msg);
            return;
        }
        
        setLoading(true);
        try {
            const res = await authAPI.getForgotPasswordOptions(identifier.trim());
            if (res.data && res.data.success === false) {
                const msg = res.data.message || "Failed to find account";
                setError(msg);
                toast.error(msg);
                return;
            }
            
            if (res.data.success || res.status === 200) {
                const data = res.data.data || res.data;
                const { recoveryEmail, phoneNumber } = data;
                if (!recoveryEmail && !phoneNumber) {
                    const msg = "No recovery methods found for this account. Please contact support.";
                    setError(msg);
                    toast.error(msg);
                    return;
                }
                setOptions(data);
                setError('');
                setStep(2);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "User not found";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async (method) => {
        setError('');
        setSelectedMethod(method);
        setLoading(true);
        try {
            const res = await authAPI.sendOTP({ identifier: identifier.trim(), method });
            if (res.data && res.data.success === false) {
                const msg = res.data.message || "Failed to send OTP";
                setError(msg);
                toast.error(msg);
                return;
            }

            if (res.data.success || res.status === 200) {
                toast.success(`OTP sent to your ${method.toLowerCase()}`);
                setError('');
                setOtp('');
                setCountdown(60);
                setStep(3);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to send OTP";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (countdown > 0 || resending || loading) return;
        setError('');
        setResending(true);
        try {
            const res = await authAPI.sendOTP({ 
                identifier: identifier.trim(), 
                method: selectedMethod || 'EMAIL' 
            });
            if (res.data && res.data.success === false) {
                const errMsg = res.data.message || 'Failed to resend OTP';
                setError(errMsg);
                toast.error(errMsg);
                return;
            }

            toast.success(`A new verification code has been sent to your ${selectedMethod.toLowerCase()}`);
            setCountdown(60);
            setError('');
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Failed to resend OTP';
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setResending(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setError('');

        const cleanOtp = (otp || '').trim();

        if (!cleanOtp) {
            const msg = "Invalid OTP. Please enter the correct OTP.";
            setError(msg);
            toast.error(msg);
            return;
        }

        if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
            const msg = "Invalid OTP. Please enter the correct OTP.";
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            const res = await authAPI.verifyOTP({ 
                identifier: identifier.trim(), 
                otp: cleanOtp 
            });

            if (res.data && (res.data.success === false || res.data.valid === false)) {
                const serverMsg = res.data.message || '';
                const msg = (
                    serverMsg.toLowerCase().includes('invalid') || 
                    serverMsg.toLowerCase().includes('incorrect') || 
                    serverMsg.toLowerCase().includes('wrong') || 
                    serverMsg.toLowerCase().includes('mismatch') || 
                    serverMsg.toLowerCase().includes('expired') || 
                    !serverMsg
                )
                    ? 'Invalid OTP. Please enter the correct OTP.'
                    : serverMsg;
                setError(msg);
                toast.error(msg);
                return;
            }

            toast.success("OTP Verified successfully");
            setError('');
            setStep(4);
        } catch (err) {
            const serverMsg = err.response?.data?.message || err.message || '';
            const msg = (
                serverMsg.toLowerCase().includes('invalid') || 
                serverMsg.toLowerCase().includes('incorrect') || 
                serverMsg.toLowerCase().includes('wrong') || 
                serverMsg.toLowerCase().includes('mismatch') || 
                serverMsg.toLowerCase().includes('expired') || 
                !serverMsg
            )
                ? 'Invalid OTP. Please enter the correct OTP.'
                : serverMsg;
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (passwords.newPassword !== passwords.confirmPassword) {
            const msg = "Passwords do not match";
            setError(msg);
            toast.error(msg);
            return;
        }
        if (passwords.newPassword.length < 8) {
            const msg = "Password must be at least 8 characters";
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            const res = await authAPI.resetPassword({
                identifier: identifier.trim(),
                otp: (otp || '').trim(),
                newPassword: passwords.newPassword
            });
            if (res.data && res.data.success === false) {
                const msg = res.data.message || "Failed to reset password";
                setError(msg);
                toast.error(msg);
                return;
            }

            if (res.data.success || res.status === 200) {
                toast.success("Password reset successfully! Please login.");
                navigate('/login');
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to reset password";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <form onSubmit={handleGetOptions} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                                Email or Username
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => {
                                    setIdentifier(e.target.value);
                                    if (error) setError('');
                                }}
                                className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border ${
                                    error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-slate-600 focus:ring-indigo-500'
                                } rounded-xl focus:ring-2 outline-none dark:text-white transition-all`}
                                placeholder="Enter your email or username"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !identifier.trim()}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {loading ? "Searching..." : "Find Account â†’"}
                        </button>
                    </form>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <p className="text-gray-600 dark:text-slate-400 text-sm mb-6 text-center">
                            Select a method to receive your verification code:
                        </p>
                        {options?.recoveryEmail && (
                            <button
                                onClick={() => handleSendOTP('EMAIL')}
                                disabled={loading}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-slate-600 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full">
                                        <MdEmail size={24} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-900 dark:text-white">Email</p>
                                        <p className="text-sm text-gray-500 dark:text-slate-400">{options.recoveryEmail}</p>
                                    </div>
                                </div>
                                <div className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-sm">
                                    Send Code â†’
                                </div>
                            </button>
                        )}
                        {options?.phoneNumber && (
                            <button
                                onClick={() => handleSendOTP('PHONE')}
                                disabled={loading}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-slate-600 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">
                                        <MdPhone size={24} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-900 dark:text-white">Phone</p>
                                        <p className="text-sm text-gray-500 dark:text-slate-400">{options.phoneNumber}</p>
                                    </div>
                                </div>
                                <div className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-sm">
                                    Send Code â†’
                                </div>
                            </button>
                        )}
                    </div>
                );
            case 3:
                return (
                    <form onSubmit={handleVerifyOTP} className="space-y-6">
                        <div className="text-center">
                            <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
                                We've sent a code to your{' '}
                                <strong className="text-gray-900 dark:text-white capitalize">
                                    {selectedMethod ? selectedMethod.toLowerCase() : 'recovery method'}
                                </strong>
                                .
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => {
                                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    if (error) setError('');
                                }}
                                className={`w-48 text-center text-3xl tracking-widest px-4 py-3 bg-gray-50 dark:bg-slate-700 border ${
                                    error
                                        ? 'border-red-500 ring-2 ring-red-500/20 text-red-600 dark:text-red-400'
                                        : 'border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white'
                                } rounded-xl outline-none transition-all font-mono shadow-sm`}
                                placeholder="000000"
                                required
                                autoFocus
                            />
                            {error && (
                                <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center justify-center gap-1 animate-fadeIn">
                                    <MdErrorOutline size={14} className="shrink-0" />
                                    <span>{error}</span>
                                </p>
                            )}

                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400 mt-4">
                                <span>Didn't receive the code?</span>
                                {countdown > 0 ? (
                                    <span className="text-gray-400 dark:text-slate-500 font-medium">
                                        Resend in <span className="font-semibold text-indigo-600 dark:text-indigo-400">{countdown}s</span>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendOTP}
                                        disabled={resending || loading}
                                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                        <MdRefresh className={resending ? "animate-spin" : ""} size={16} />
                                        {resending ? "Resending..." : "Resend OTP"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length !== 6}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {loading ? "Verifying..." : "Verify Code â†’"}
                        </button>

                        <button 
                            type="button"
                            onClick={() => {
                                setError('');
                                setStep(2);
                            }}
                            className="w-full text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                            Change Method
                        </button>
                    </form>
                );
            case 4:
                return (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                                    New Password
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={passwords.newPassword}
                                        onChange={(e) => {
                                            setPasswords({...passwords, newPassword: e.target.value});
                                            if (error) setError('');
                                        }}
                                        className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-lg focus:outline-none"
                                        title={showNewPassword ? "Hide password" : "Show password"}
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                    >
                                        {showNewPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={passwords.confirmPassword}
                                        onChange={(e) => {
                                            setPasswords({...passwords, confirmPassword: e.target.value});
                                            if (error) setError('');
                                        }}
                                        className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-lg focus:outline-none"
                                        title={showConfirmPassword ? "Hide password" : "Show password"}
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    >
                                        {showConfirmPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !passwords.newPassword || !passwords.confirmPassword}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {loading ? "Resetting..." : "Reset Password â†’"}
                        </button>
                    </form>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700">
                <div className="text-center">
                    <img src={logo} alt="BNX Mail" className="mx-auto h-20 w-auto mb-4" />
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {step === 4 ? "New Password" : "Reset Password"}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-medium">
                        {step === 1 && "Enter your details to find your account."}
                        {step === 2 && "Choose how you want to receive your code."}
                        {step === 3 && (selectedMethod === 'PHONE' ? "Check your phone for the verification code." : "Check your inbox for the verification code.")}
                        {step === 4 && "Choose a strong, secure password."}
                    </p>
                </div>

                <div className="mt-8 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between animate-fadeIn shadow-sm">
                            <div className="flex items-center gap-2">
                                <MdErrorOutline size={18} className="shrink-0 text-red-500 dark:text-red-400" />
                                <span>{error}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setError('')}
                                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 ml-2 font-bold cursor-pointer"
                                aria-label="Dismiss error"
                            >
                                âœ•
                            </button>
                        </div>
                    )}

                    {renderStep()}
                </div>

                <div className="text-center pt-6 border-t border-gray-100 dark:border-slate-700">
                    <button
                        onClick={() => {
                            setError('');
                            if (step > 1) {
                                setStep(step - 1);
                            } else {
                                navigate('/login');
                            }
                        }}
                        className="flex items-center justify-center gap-2 mx-auto text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                        <MdArrowBack />
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
