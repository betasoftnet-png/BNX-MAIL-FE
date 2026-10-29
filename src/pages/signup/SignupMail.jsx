import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';
import { authAPI, casboxAPI } from '../../services/api';
import toast from 'react-hot-toast';

const DUPLICATE_HANDLE_ERROR = 'Email address already exists. Please choose another handle';
const DOMAIN_SUFFIX = '@bnxmail.com';

const SignupMail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { formData, updateFormData } = useSignup();
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [error, setError] = useState(location.state?.usernameError || '');
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [validationStatus, setValidationStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

    const debounceTimerRef = useRef(null);
    const checkRequestIdRef = useRef(0);
    const isCheckingRef = useRef(false);
    const lastValidatedHandleRef = useRef(null);

    const domainSuffix = DOMAIN_SUFFIX;

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (formData.accountType !== 'BUSINESS' && formData.firstName && formData.lastName && formData.dob) {
                setLoadingSuggestions(true);
                try {
                    const res = await authAPI.getUsernameSuggestions({
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        dob: formData.dob,
                        mode: formData.accountType
                    });
                    if (res.data?.success && res.data.data) {
                        setSuggestions(res.data.data);
                    }
                } catch (err) {
                    console.error('Failed to fetch suggestions', err);
                } finally {
                    setLoadingSuggestions(false);
                }
            }
        };

        fetchSuggestions();
    }, [formData.accountType, formData.firstName, formData.lastName, formData.dob]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const validateFormat = (handle, accountType) => {
        const username = (handle || '').trim();

        if (!username) {
            return 'Please choose a valid email address';
        }

        if (accountType === 'BUSINESS') {
            if (username.length < 10) {
                return 'Business username must be at least 10 characters long';
            }
            if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
                return 'Username can only contain letters, numbers, dots, and hyphens';
            }
        } else {
            const letters = username.replace(/[^a-zA-Z]/g, '').length;
            const digits = username.replace(/[^0-9]/g, '').length;

            if (username.length < 10) {
                return 'Email handle must be at least 10 characters long';
            }
            if (letters < 7 || digits < 3) {
                return 'Email handle must contain at least 7 letters and 3 numbers';
            }
            if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
                return 'Username can only contain letters, numbers, dots, and hyphens';
            }
        }

        return null;
    };

    const verifyHandleAvailabilityApi = async (handleToCheck) => {
        const handle = (handleToCheck || '').trim();
        if (!handle) {
            return { available: false, error: 'Please choose a valid email address' };
        }

        const emailToCheck = handle.includes('@') ? handle : `${handle}${domainSuffix}`;

        try {
            const res = await casboxAPI.validateRecipient(emailToCheck);
            const data = res?.data;

            // Explicit negative existence / available flags
            if (data?.valid === false || data?.exists === false || data?.available === true) {
                return { available: true };
            }

            // Explicit positive existence flags or status 200 without negative indicator:
            // Since this is checking an existing recipient in BNX Mail database:
            if (data?.valid === true || data?.exists === true || res?.status === 200) {
                return {
                    available: false,
                    isDuplicate: true,
                    error: DUPLICATE_HANDLE_ERROR
                };
            }

            // Unexpected response structure
            return {
                available: false,
                error: 'Unable to verify email availability. Please try again.'
            };
        } catch (err) {
            const status = err?.response?.status;
            const errData = err?.response?.data;
            const errMsg = (errData?.message || err?.message || '').toLowerCase();

            // 400 Bad Request or 404 Not Found:
            // In casboxAPI / FloatingCompose: status === 400 or errData?.valid === false
            // means "Invalid email ID. This BNXmail account does not exist."
            if (status === 400 || status === 404 || errData?.valid === false || errData?.exists === false) {
                if (errMsg.includes('already') || errMsg.includes('exist') || errMsg.includes('taken')) {
                    return {
                        available: false,
                        isDuplicate: true,
                        error: DUPLICATE_HANDLE_ERROR
                    };
                }
                return { available: true };
            }

            // 409 Conflict: Handle/email already exists
            if (status === 409 || errMsg.includes('already registered') || errMsg.includes('already exists')) {
                return {
                    available: false,
                    isDuplicate: true,
                    error: DUPLICATE_HANDLE_ERROR
                };
            }

            // If unauthenticated (401 or 403), fallback check using authAPI.getForgotPasswordOptions:
            if (status === 401 || status === 403) {
                try {
                    const forgotRes = await authAPI.getForgotPasswordOptions(emailToCheck);
                    if (forgotRes?.data?.success || forgotRes?.status === 200) {
                        return {
                            available: false,
                            isDuplicate: true,
                            error: DUPLICATE_HANDLE_ERROR
                        };
                    }
                } catch (fallbackErr) {
                    const fbStatus = fallbackErr?.response?.status;
                    const fbMsg = (fallbackErr?.response?.data?.message || '').toLowerCase();
                    if (fbStatus === 404 || fbMsg.includes('not found') || fbMsg.includes('no account') || fbMsg.includes('does not exist')) {
                        return { available: true };
                    }
                    if (fbStatus === 409 || fbMsg.includes('already')) {
                        return {
                            available: false,
                            isDuplicate: true,
                            error: DUPLICATE_HANDLE_ERROR
                        };
                    }
                }
            }

            // General network failure / 500 error / timeout:
            return {
                available: false,
                error: 'Unable to verify email availability. Please check your connection and try again.'
            };
        }
    };

    const runAvailabilityCheck = async (handleToCheck) => {
        const reqId = ++checkRequestIdRef.current;
        setCheckingAvailability(true);
        isCheckingRef.current = true;
        setValidationStatus('checking');

        try {
            const result = await verifyHandleAvailabilityApi(handleToCheck);

            // Stale check
            if (reqId !== checkRequestIdRef.current) return result;

            if (result.available) {
                lastValidatedHandleRef.current = handleToCheck;
                setValidationStatus('available');
                if (error === DUPLICATE_HANDLE_ERROR || error.includes('availability')) {
                    setError('');
                }
            } else {
                lastValidatedHandleRef.current = null;
                setValidationStatus(result.isDuplicate ? 'unavailable' : 'error');
                setError(result.error || DUPLICATE_HANDLE_ERROR);
            }
            return result;
        } catch (err) {
            if (reqId !== checkRequestIdRef.current) return { available: false };
            lastValidatedHandleRef.current = null;
            setValidationStatus('error');
            const genericErr = 'Unable to verify email availability. Please check your connection and try again.';
            setError(genericErr);
            return { available: false, error: genericErr };
        } finally {
            if (reqId === checkRequestIdRef.current) {
                setCheckingAvailability(false);
                isCheckingRef.current = false;
            }
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        updateFormData({ username: val });

        // Invalidate previous validation status
        lastValidatedHandleRef.current = null;
        setValidationStatus('idle');

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const trimmed = val.trim();
        const formatErr = validateFormat(trimmed, formData.accountType);

        // If user is editing away from an unavailable handle or format is incomplete,
        // clear duplicate error if user is changing it
        if (formatErr) {
            if (error === DUPLICATE_HANDLE_ERROR) {
                setError('');
            }
            return;
        }

        // Debounce check availability when format is valid
        debounceTimerRef.current = setTimeout(async () => {
            await runAvailabilityCheck(trimmed);
        }, 500);
    };

    const handleInputBlur = async () => {
        const trimmed = (formData.username || '').trim();
        if (!trimmed) return;

        const formatErr = validateFormat(trimmed, formData.accountType);
        if (formatErr) return;

        if (lastValidatedHandleRef.current !== trimmed && !checkingAvailability && !isCheckingRef.current) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            await runAvailabilityCheck(trimmed);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (checkingAvailability || isCheckingRef.current) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const username = (formData.username || '').trim();

        // Check format
        const formatErr = validateFormat(username, formData.accountType);
        if (formatErr) {
            setError(formatErr);
            return;
        }

        // If already validated and no error
        if (lastValidatedHandleRef.current === username && !error) {
            navigate('/signup/mobile-verify');
            return;
        }

        // Run availability check
        const result = await runAvailabilityCheck(username);

        if (result && result.available) {
            navigate('/signup/mobile-verify');
        }
    };

    const selectSuggestion = async (sugg) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setError('');
        updateFormData({ username: sugg });
        lastValidatedHandleRef.current = null;

        // Check availability of selected suggestion
        await runAvailabilityCheck(sugg);
    };

    const handleBack = () => {
        if (formData.accountType === 'BUSINESS') navigate('/signup/business');
        else if (formData.accountType === 'CHILD') navigate('/signup/parent-verify');
        else navigate('/signup/profile');
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    Choose your email address
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Pick a suggested handle or create your own.
                </p>
            </div>

            {loadingSuggestions && (
                <div className="text-center text-sm text-indigo-500 font-medium">Generating suggestions...</div>
            )}

            {!loadingSuggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center my-4">
                    {suggestions.map((sugg, idx) => (
                        <button
                            key={idx}
                            type="button"
                            disabled={checkingAvailability}
                            onClick={() => selectSuggestion(sugg)}
                            className={`px-4 py-2 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-semibold transition-colors ${
                                formData.username === sugg
                                    ? 'bg-indigo-200 dark:bg-indigo-800/60 ring-2 ring-indigo-500'
                                    : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50'
                            } ${checkingAvailability ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                            {sugg}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Create a custom handle
                    </label>
                    <div className={`flex items-center bg-gray-50 dark:bg-slate-700 border ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500'} rounded-xl overflow-hidden transition-all`}>
                        <input
                            type="text"
                            value={formData.username || ''}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            placeholder="e.g. johndoe123"
                            required
                            className="flex-1 px-4 py-3 bg-transparent outline-none dark:text-white"
                        />
                        <span className="px-4 text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-slate-800 h-full flex items-center border-l border-gray-200 dark:border-slate-600">
                            {domainSuffix}
                        </span>
                    </div>
                    {error && (
                        <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1.5 flex items-center gap-1">
                            {error}
                        </p>
                    )}
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
                        disabled={checkingAvailability}
                        className={`px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all ${
                            checkingAvailability ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5'
                        }`}
                    >
                        {checkingAvailability ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                <span>Checking...</span>
                            </span>
                        ) : (
                            'Next Step'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SignupMail;

