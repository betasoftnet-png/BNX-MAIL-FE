import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const DUPLICATE_MOBILE_ERROR = 'This mobile number is already registered. Please use another number';

const isAlreadyRegisteredError = (msg, data, status) => {
    if (status === 409) return true;
    if (data?.code === 'MOBILE_ALREADY_EXISTS' || data?.code === 'PHONE_ALREADY_REGISTERED' || data?.code === 'USER_EXISTS') return true;
    if (!msg || typeof msg !== 'string') return false;
    const lower = msg.toLowerCase();
    return (
        (lower.includes('already') && (lower.includes('register') || lower.includes('exist') || lower.includes('link') || lower.includes('taken') || lower.includes('use') || lower.includes('account'))) ||
        lower.includes('phone number already') ||
        lower.includes('mobile number already') ||
        lower.includes('mobile already') ||
        lower.includes('duplicate mobile') ||
        lower.includes('duplicate phone')
    );
};

const SignupMobileVerify = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { formData, updateFormData } = useSignup();
    const [step, setStep] = useState('MOBILE'); // MOBILE or OTP
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState(location.state?.mobileError || '');

    useEffect(() => {
        if (location.state?.mobileError) {
            setError(location.state.mobileError);
        }
    }, [location.state]);

    const handleSendOtp = async (e) => {
        if (e) e.preventDefault();
        if (loading) return; // Prevent duplicate API submissions while in progress
        setError('');

        const mobile = (formData.mobileNumber || '').trim();
        if (!mobile || mobile === '+') {
            const err = 'Mobile number is required';
            setError(err);
            toast.error(err);
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.sendMobileOtp({ mobile });
            
            // Handle if backend returns 200 OK but success is false
            if (response.data && response.data.success === false) {
                const rawMsg = response.data.message || '';
                const isDuplicate = isAlreadyRegisteredError(rawMsg, response.data, response.status);
                const errMsg = isDuplicate ? DUPLICATE_MOBILE_ERROR : (rawMsg || 'Failed to send OTP');
                setError(errMsg);
                toast.error(errMsg);
                return;
            }

            toast.success('OTP sent to your mobile number');
            setError('');
            setStep('OTP');
        } catch (err) {
            const serverData = err.response?.data;
            const status = err.response?.status;
            const rawMsg = serverData?.message || serverData?.error || '';
            const isDuplicate = isAlreadyRegisteredError(rawMsg, serverData, status);
            const errMsg = isDuplicate ? DUPLICATE_MOBILE_ERROR : (rawMsg || 'Failed to send OTP');
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resending || loading) return; // Prevent duplicate API submissions
        setError('');
        setResending(true);
        try {
            const response = await authAPI.sendMobileOtp({ mobile: formData.mobileNumber });
            if (response.data && response.data.success === false) {
                const rawMsg = response.data.message || '';
                const isDuplicate = isAlreadyRegisteredError(rawMsg, response.data, response.status);
                const errMsg = isDuplicate ? DUPLICATE_MOBILE_ERROR : (rawMsg || 'Failed to resend OTP');
                setError(errMsg);
                toast.error(errMsg);
                if (isDuplicate) {
                    setStep('MOBILE');
                }
                return;
            }
            toast.success('A new OTP has been sent to your mobile number');
        } catch (err) {
            const serverData = err.response?.data;
            const status = err.response?.status;
            const rawMsg = serverData?.message || serverData?.error || '';
            const isDuplicate = isAlreadyRegisteredError(rawMsg, serverData, status);
            const errMsg = isDuplicate ? DUPLICATE_MOBILE_ERROR : (rawMsg || 'Failed to resend OTP');
            setError(errMsg);
            toast.error(errMsg);
            if (isDuplicate) {
                setStep('MOBILE');
            }
        } finally {
            setResending(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (loading) return; // Prevent duplicate API submissions
        setError('');

        const otp = (formData.mobileOtp || '').trim();

        if (!otp) {
            const msg = 'Please enter the 6-digit OTP.';
            setError(msg);
            toast.error(msg);
            return;
        }

        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            const msg = 'Invalid OTP. Please enter the correct OTP.';
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.verifyMobileOtp({
                mobile: formData.mobileNumber,
                otp: otp
            });

            // Handle if backend returns 200 OK but success is false
            if (response.data && response.data.success === false) {
                const msg = 'Invalid OTP. Please enter the correct OTP.';
                setError(msg);
                toast.error(msg);
                return;
            }
            
            updateFormData({ 
                mobileVerified: true, 
                recoveryPhone: formData.mobileNumber 
            });
            
            toast.success('Mobile number verified successfully');
            navigate('/signup/password-setup');
        } catch (err) {
            const serverMsg = err.response?.data?.message || '';
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

    const handleBack = () => {
        setError('');
        if (step === 'OTP') {
            setStep('MOBILE');
            return;
        }
        
        navigate('/signup/mail');
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    Mobile Verification
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Verify your mobile number to secure your account.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-fadeIn flex items-center justify-between">
                    <span>{error}</span>
                    <button 
                        type="button" 
                        onClick={() => setError('')} 
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-200 ml-2 font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {step === 'MOBILE' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            Mobile Number
                        </label>
                        <PhoneInput
                            country={'us'}
                            value={formData.mobileNumber}
                            onChange={(phone) => {
                                setError('');
                                updateFormData({
                                    mobileNumber: '+' + phone,
                                    mobileVerified: false,
                                    mobileOtp: ''
                                });
                            }}
                            enableSearch={true}
                            containerClass="!w-full"
                            inputClass="!w-full !px-4 !py-3 !pl-[50px] !bg-gray-50 dark:!bg-slate-700 !border !border-gray-200 dark:!border-slate-600 !rounded-xl focus:!ring-2 focus:!ring-indigo-500 !outline-none dark:!text-white !h-[50px] !text-base"
                            buttonClass="!bg-transparent !border-none !left-1"
                            dropdownClass="!bg-white dark:!bg-slate-800 !text-gray-800 dark:!text-white !border-gray-200 dark:!border-slate-600 !rounded-xl shadow-xl"
                            searchClass="!bg-gray-50 dark:!bg-slate-700 !border-gray-200 dark:!border-slate-600 !text-gray-800 dark:!text-white !rounded-lg"
                        />
                    </div>

                    <div className="pt-4 flex justify-between">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            Enter the 6-digit OTP
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={formData.mobileOtp || ''}
                            onChange={(e) => {
                                const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setError('');
                                updateFormData({ mobileOtp: cleanDigits });
                            }}
                            required
                            placeholder="123456"
                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-slate-600 focus:ring-indigo-500'} rounded-xl focus:ring-2 outline-none dark:text-white text-center tracking-widest text-lg font-mono transition-all`}
                        />
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mt-2 px-1">
                            <span>
                                Code sent to <span className="font-semibold text-gray-700 dark:text-gray-300">{formData.mobileNumber}</span>.
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    disabled={resending}
                                    onClick={handleResendOtp} 
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium disabled:opacity-50"
                                >
                                    {resending ? 'Resending...' : 'Resend OTP'}
                                </button>
                                <span>•</span>
                                <button 
                                    type="button" 
                                    onClick={() => { setError(''); setStep('MOBILE'); }} 
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                >
                                    Change number
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (formData.mobileOtp || '').length !== 6}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default SignupMobileVerify;
