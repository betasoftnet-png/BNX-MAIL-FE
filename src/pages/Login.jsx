import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Mail, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
// import logo from '../assets/bnx.jpeg';

import logo from "../assets/bnx-remove.png";

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 2FA state variables
    const [step, setStep] = useState('login'); // 'login', '2fa', 'recovery', 'appeal'
    const [appealMessage, setAppealMessage] = useState('');
    const [appealSuccess, setAppealSuccess] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [otp, setOtp] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const isSuspended = queryParams.get('suspended');
        const emailParam = queryParams.get('email');
        
        if (isSuspended === 'true') {
            setStep('appeal');
            if (emailParam) {
                setFormData(prev => ({ ...prev, email: emailParam }));
            }
        }
    }, [location]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSwitchStep = (newStep) => {
        setStep(newStep);
        setError('');
        setSuccessMessage('');
        setOtp('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let loginEmail = formData.email;
            if (!loginEmail.includes('@')) {
                loginEmail = `${loginEmail}@bnxmail.com`;
            }

            const response = await authAPI.login({
                email: loginEmail,
                password: formData.password
            });

            if (response.data.success) {
                const responseData = response.data.data;
                if (responseData && responseData.status === '2FA_REQUIRED') {
                    setTempToken(responseData.tempToken);
                    setStep('2fa');
                    setOtp('');
                    setError('');
                } else {
                    // Pass the whole data object to login context
                    login(responseData);

                    if (responseData.accountType === 'BUSINESS' && responseData.onboarded === false) {
                        navigate('/signup/business-onboarding');
                    } else {
                        navigate('/inbox');
                    }
                }
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
            setError(errorMessage);
            
            // If the account is suspended/banned due to reports, transition to the appeal step.
            if (err.response?.status === 403 && errorMessage.toLowerCase().includes('suspended')) {
                setStep('appeal');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2fa = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.login2fa({
                tempToken,
                code: otp
            });

            if (response.data.success) {
                const responseData = response.data.data;
                login(responseData);
                
                if (responseData.accountType === 'BUSINESS' && responseData.onboarded === false) {
                    navigate('/signup/business-onboarding');
                } else {
                    navigate('/inbox');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid 2FA code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendRecoveryOtp = async () => {
        setError('');
        setSuccessMessage('');
        setLoading(true);

        try {
            const response = await authAPI.send2faRecoveryOtp(tempToken);
            if (response.data.success) {
                setSuccessMessage(response.data.message || 'Recovery code sent to your secondary email.');
                setOtp('');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send recovery code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyRecoveryOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.verify2faRecoveryOtp(tempToken, otp);

            if (response.data.success) {
                login(response.data.data);
                navigate('/inbox');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid recovery code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAppealSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.submitAppeal(formData.email, appealMessage);
            if (response.data.success) {
                setAppealSuccess(true);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit appeal. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 transition-all duration-500">
                {/* Logo & Dynamic Header */}
                <div className="text-center">
                    <img src={logo} alt="BNX Mail" className="mx-auto h-24 w-auto drop-shadow-md" />
                    <h2 className="mt-3 text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {step === 'login' && 'Welcome Back'}
                        {step === '2fa' && 'Two-Factor Authentication'}
                        {step === 'recovery' && 'Recovery Code Verification'}
                        {step === 'appeal' && 'Account Suspended'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-medium px-4">
                        {step === 'login' && 'Securely access your BNX Mail account.'}
                        {step === '2fa' && 'Enter the 6-digit code from your authenticator app.'}
                        {step === 'recovery' && 'Enter a backup recovery code to access your account.'}
                        {step === 'appeal' && 'Your account has been restricted. You can submit an appeal below.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl animate-shake text-sm font-medium">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                )}

                <AnimatePresence mode="wait">
                {/* Form Switcher */}
                {step === 'login' && (
                    <motion.form key="login" className="mt-8 space-y-6" onSubmit={handleSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                                    placeholder="you@bnxmail.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                    Password
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 pr-11 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-lg focus:outline-none"
                                        title={showPassword ? "Hide password" : "Show password"}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded-lg cursor-pointer"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
                                    Stay signed in
                                </label>
                            </div>

                            <div className="text-sm">
                                <Link to="/forgot-password" name="forgot-password" id="forgot-password-link" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Authenticating...</span>
                                </div>
                            ) : (
                                'Sign In →'
                            )}
                        </button>

                        <div className="text-center text-sm space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                            <div className="text-gray-500 dark:text-slate-400">
                                Don't have an account?{' '}
                                <Link to="/register" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
                                    Create one for free
                                </Link>
                            </div>
                        </div>
                    </motion.form>
                )}

                {step === '2fa' && (
                    <motion.form key="2fa" className="mt-8 space-y-6" onSubmit={handleVerify2fa} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 text-center">
                                    Enter the 6-digit code from your <b>Authenticator App</b>
                                </label>
                                <input
                                    id="otp"
                                    name="otp"
                                    type="text"
                                    required
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="••••••"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-center text-2xl font-bold tracking-[0.5em] focus:placeholder-transparent transition-all"
                                    maxLength="6"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length < 6}
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Verifying...</span>
                                </div>
                            ) : (
                                'Verify Code →'
                            )}
                        </button>

                        <div className="flex flex-col gap-3 text-center text-sm pt-4 border-t border-gray-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => handleSwitchStep('recovery')}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                            >
                                Don't have your device? Try another way
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSwitchStep('login')}
                                className="flex items-center justify-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors font-medium mt-1"
                            >
                                <ArrowLeft size={16} /> Back to Sign In
                            </button>
                        </div>
                    </motion.form>
                )}

                {step === 'recovery' && (
                    <motion.form key="recovery" className="mt-8 space-y-6" onSubmit={handleVerifyRecoveryOtp} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="space-y-4">
                            {!successMessage ? (
                                <div className="text-center py-2">
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={handleSendRecoveryOtp}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-semibold rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                                    >
                                        <Mail size={18} />
                                        Send Recovery Code to Email
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="recovery-otp" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 text-center">
                                        Enter 6-digit Recovery Code
                                    </label>
                                    <input
                                        id="recovery-otp"
                                        name="otp"
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="••••••"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-center text-2xl font-bold tracking-[0.5em] focus:placeholder-transparent transition-all"
                                        maxLength="6"
                                        autoFocus
                                    />
                                    
                                    <div className="text-center mt-3">
                                        <button
                                            type="button"
                                            onClick={handleSendRecoveryOtp}
                                            disabled={loading}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                        >
                                            Resend Code
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {successMessage && (
                            <button
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Verifying...</span>
                                    </div>
                                ) : (
                                    'Verify and Login →'
                                )}
                            </button>
                        )}

                        <div className="flex flex-col gap-3 text-center text-sm pt-4 border-t border-gray-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => handleSwitchStep('2fa')}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                            >
                                Use Authenticator App instead
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSwitchStep('login')}
                                className="flex items-center justify-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors font-medium mt-1"
                            >
                                <ArrowLeft size={16} /> Back to Sign In
                            </button>
                        </div>
                    </motion.form>
                )}

                {step === 'appeal' && (
                    <motion.div
                        key="appeal"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {appealSuccess ? (
                            <div className="text-center p-6 bg-green-50/50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-800">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">Appeal Submitted</h3>
                                <p className="text-sm text-green-600 dark:text-green-400 mb-6">
                                    Your appeal has been received. Our moderation team will review it and notify you of the outcome.
                                </p>
                                <button
                                    onClick={() => { setStep('login'); setAppealSuccess(false); setAppealMessage(''); setError(''); }}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    Back to Login
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleAppealSubmit} className="space-y-6">
                                <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/50 rounded-xl mb-6">
                                    <p className="text-sm text-rose-800 dark:text-rose-300">
                                        Your account has been suspended due to violations of our Terms of Service (e.g., multiple abuse reports).
                                        If you believe this is an error, please provide a detailed explanation below.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Appeal Message <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative group">
                                        <textarea
                                            value={appealMessage}
                                            onChange={(e) => setAppealMessage(e.target.value)}
                                            rows="5"
                                            required
                                            placeholder="Explain why your account should be reinstated..."
                                            className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !appealMessage.trim()}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl hover:from-indigo-700 hover:to-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed group"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span>Submit Appeal</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setStep('login'); setError(''); }}
                                    className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors mt-4"
                                >
                                    Cancel and return to login
                                </button>
                            </form>
                        )}
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Login;