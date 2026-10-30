import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const formatVerificationError = (err, action = 'fetch') => {
    // 1. Offline / Network failure
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 'Network connection lost. Please check your internet connection and try again.';
    }

    if (!err.response) {
        if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
            return 'The request timed out. Please check your connection and try again.';
        }
        if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
            return 'Unable to connect to the verification server. Please check your internet connection.';
        }
        return 'Network error occurred. Please check your connection and try again.';
    }

    const status = err.response.status;
    const data = err.response.data;

    let rawText = '';
    if (typeof data === 'string') {
        rawText = data;
    } else if (data && typeof data === 'object') {
        rawText = data.message || data.error || data.detail || '';
    } else {
        rawText = err.message || '';
    }

    // Try parsing nested JSON from Cashfree error string like:
    // Cashfree API Error: 400 Bad Request: "{\"type\":\"validation_error\",\"code\":\"pan_value_invalid\",\"message\":\"Enter valid PAN.\"}<EOL>"
    let nestedCode = '';
    let nestedMessage = '';
    if (typeof rawText === 'string') {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const cleanedJson = jsonMatch[0].replace(/\\"/g, '"').replace(/<EOL>/g, '');
                const parsed = JSON.parse(cleanedJson);
                nestedCode = (parsed.code || '').toLowerCase();
                nestedMessage = parsed.message || '';
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    const lowerRaw = rawText.toLowerCase();
    const lowerNested = nestedMessage.toLowerCase();

    // 404 Not Found / No GSTIN found for PAN
    if (
        status === 404 ||
        nestedCode === 'gstin_not_found' ||
        nestedCode === 'resource_not_found' ||
        lowerRaw.includes('404') ||
        lowerRaw.includes('not found') ||
        lowerRaw.includes('no gstin') ||
        lowerNested.includes('not found') ||
        lowerNested.includes('no gstin')
    ) {
        return 'No GSTIN found associated with the provided PAN number. Please verify your PAN and try again.';
    }

    // 400 Bad Request / Validation error
    if (
        status === 400 ||
        nestedCode === 'pan_value_invalid' ||
        nestedCode === 'validation_error' ||
        lowerRaw.includes('400') ||
        lowerRaw.includes('pan_value_invalid') ||
        lowerRaw.includes('enter valid pan') ||
        lowerNested.includes('pan')
    ) {
        if (lowerRaw.includes('pan') || lowerNested.includes('pan') || nestedCode.includes('pan')) {
            return 'The PAN number entered is invalid. Please check and enter a valid PAN.';
        }
        if (lowerRaw.includes('gstin') || lowerNested.includes('gstin') || nestedCode.includes('gstin')) {
            return 'The GSTIN selected is invalid. Please select a valid GSTIN.';
        }
        return 'Invalid verification request. Please check the entered details and try again.';
    }

    // 429 Rate Limit
    if (status === 429 || lowerRaw.includes('rate limit') || lowerRaw.includes('too many requests')) {
        return 'Too many verification attempts. Please wait a moment and try again.';
    }

    // 500 / 502 / 503 / 504 Cashfree / Server Error
    if (
        status >= 500 ||
        lowerRaw.includes('500') ||
        lowerRaw.includes('502') ||
        lowerRaw.includes('503') ||
        lowerRaw.includes('cashfree api error')
    ) {
        return 'The verification service is temporarily unavailable. Please try again later.';
    }

    // Fallback without technical jargon or raw error strings
    if (action === 'fetch') {
        return 'Unable to fetch GSTINs at this time. Please check your PAN and try again.';
    }
    return 'Verification could not be completed. Please check your business details and try again.';
};

const SignupBusiness = () => {
    const navigate = useNavigate();
    const { formData, updateFormData } = useSignup();
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1 = Type selection, 2 = Verification details
    const [fetchingGstins, setFetchingGstins] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [gstinOptions, setGstinOptions] = useState([]);

    const handleFetchGstins = async () => {
        const rawPan = (formData.panNumber || '').trim();

        if (!rawPan) {
            setError('Please enter a PAN Number to fetch GSTINs.');
            return;
        }

        const upperPan = rawPan.toUpperCase();
        if (!PAN_REGEX.test(upperPan)) {
            setError('Please enter a valid 10-character PAN number (e.g., ABCDE1234F).');
            return;
        }

        setError('');
        setFetchingGstins(true);
        try {
            const res = await authAPI.fetchGstins(upperPan);
            const data = res.data?.data;
            if (Array.isArray(data) && data.length > 0) {
                setGstinOptions(data);
                if (data.length === 1) {
                    const firstOption = data[0];
                    updateFormData({ 
                        gstin: firstOption.gstin,
                        ...(firstOption.legalName && !formData.businessName ? { businessName: firstOption.legalName } : {})
                    });
                }
                toast.success('GSTINs fetched successfully.');
            } else {
                setError('No active GSTINs found associated with this PAN number.');
                setGstinOptions([]);
            }
        } catch (err) {
            setError(formatVerificationError(err, 'fetch'));
            setGstinOptions([]);
        } finally {
            setFetchingGstins(false);
        }
    };

    const handleVerifyPrimary = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.businessType === 'ORGANIZATION') {
            if (!formData.cin || !formData.panNumber || !formData.gstin) {
                setError('CIN, PAN, and GSTIN are required.');
                return;
            }
        } else {
            if (!formData.panNumber || !formData.gstin) {
                setError('PAN and GSTIN are required.');
                return;
            }
        }

        const cleanPan = (formData.panNumber || '').trim().toUpperCase();
        if (!PAN_REGEX.test(cleanPan)) {
            setError('Please enter a valid 10-character PAN number (e.g., ABCDE1234F).');
            return;
        }

        setVerifying(true);
        try {
            const payload = formData.businessType === 'ORGANIZATION' 
                ? { type: 'LARGE_BUSINESS', cin: (formData.cin || '').trim(), pan: cleanPan, gstin: formData.gstin }
                : { type: 'GSTIN', gstin: formData.gstin };
            
            await authAPI.verifyBusiness(payload);
            toast.success('Business verified successfully!');
            navigate('/signup/mail');
        } catch (err) {
            setError(formatVerificationError(err, 'verify'));
        } finally {
            setVerifying(false);
        }
    };

    const handleSecondarySubmit = (e) => {
        e.preventDefault();
        if (!formData.ownerFirstName || !formData.ownerLastName || !formData.businessName || !formData.registrationNumber) {
            setError('All fields are required.');
            return;
        }
        navigate('/signup/mail');
    };

    // If we are in primary flow but at step 2, we just render the verification form directly
    // without the top toggle, or we can keep the top toggle. The design usually hides the toggle on the next step.
    if (step === 2 && formData.businessFlow === 'primary') {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Business Verification
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                        Verify your identity to create a new organization account.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
                        {error}
                    </div>
                )}

                <form onSubmit={handleVerifyPrimary} className="space-y-4">
                    {formData.businessType === 'ORGANIZATION' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                CIN Number
                            </label>
                            <input
                                type="text"
                                value={formData.cin}
                                onChange={(e) => {
                                    updateFormData({ cin: e.target.value.toUpperCase() });
                                    if (error) setError('');
                                }}
                                required
                                placeholder="e.g. U72900KA2020PTC123456"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white uppercase"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            PAN Number
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.panNumber}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                    updateFormData({ panNumber: val, gstin: '' });
                                    if (error) setError('');
                                    if (gstinOptions.length > 0) setGstinOptions([]);
                                }}
                                maxLength={10}
                                required
                                placeholder="e.g. ABCDE1234F"
                                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white uppercase"
                            />
                            <button
                                type="button"
                                onClick={handleFetchGstins}
                                disabled={fetchingGstins}
                                className="px-4 py-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 text-sm font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                            >
                                {fetchingGstins ? (
                                    <span className="flex items-center gap-1.5">
                                        <svg className="animate-spin h-4 w-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        Fetching...
                                    </span>
                                ) : (
                                    'Fetch GSTINs'
                                )}
                            </button>
                        </div>
                    </div>

                    {gstinOptions.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Select GSTIN
                            </label>
                            <select
                                value={formData.gstin}
                                onChange={(e) => {
                                    const selectedGstin = e.target.value;
                                    const found = gstinOptions.find((opt) => opt.gstin === selectedGstin);
                                    updateFormData({ 
                                        gstin: selectedGstin,
                                        ...(found?.legalName && !formData.businessName ? { businessName: found.legalName } : {})
                                    });
                                    if (error) setError('');
                                }}
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="">-- Select a GSTIN --</option>
                                {gstinOptions.map((option) => (
                                    <option key={option.gstin} value={option.gstin}>
                                        {option.gstin} - {option.legalName || 'N/A'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Owner First Name
                            </label>
                            <input
                                type="text"
                                value={formData.ownerFirstName}
                                onChange={(e) => {
                                    updateFormData({ ownerFirstName: e.target.value });
                                    if (error) setError('');
                                }}
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Owner Last Name
                            </label>
                            <input
                                type="text"
                                value={formData.ownerLastName}
                                onChange={(e) => {
                                    updateFormData({ ownerLastName: e.target.value });
                                    if (error) setError('');
                                }}
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            Business Name
                        </label>
                        <input
                            type="text"
                            value={formData.businessName}
                            onChange={(e) => {
                                updateFormData({ businessName: e.target.value });
                                if (error) setError('');
                            }}
                            required
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        />
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => {
                                setStep(1);
                                setError('');
                            }}
                            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={verifying || gstinOptions.length === 0 || !formData.gstin}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                        >
                            {verifying ? 'Verifying...' : 'Verify Identity'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-4">
            <div className="text-center mb-4">
                <h3 className="text-gray-500 dark:text-slate-400 mt-2">
                    Enter business details
                </h3>
            </div>

            {/* Toggle primary vs secondary */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                    type="button"
                    onClick={() => {
                        updateFormData({ businessFlow: 'secondary' });
                        setError('');
                    }}
                    className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border-2 transition-all ${
                        formData.businessFlow === 'secondary'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                >
                    <span className={`font-bold text-base ${formData.businessFlow === 'secondary' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                        Secondary
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Standard flow</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        updateFormData({ businessFlow: 'primary' });
                        setError('');
                    }}
                    className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border-2 transition-all ${
                        formData.businessFlow === 'primary'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                >
                    <span className={`font-bold text-base ${formData.businessFlow === 'primary' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                        Primary
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Verified account</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-4">
                    {error}
                </div>
            )}

            {formData.businessFlow === 'secondary' ? (
                /* Secondary Flow Form */
                <form onSubmit={handleSecondarySubmit} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="First Name"
                            value={formData.ownerFirstName}
                            onChange={(e) => updateFormData({ ownerFirstName: e.target.value })}
                            required
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={formData.ownerLastName}
                            onChange={(e) => updateFormData({ ownerLastName: e.target.value })}
                            required
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Business Name"
                        value={formData.businessName}
                        onChange={(e) => updateFormData({ businessName: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                    <input
                        type="text"
                        placeholder="Business ID Number"
                        value={formData.registrationNumber}
                        onChange={(e) => updateFormData({ registrationNumber: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                    
                    <div className="pt-4 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => navigate('/signup/selection')}
                            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all"
                        >
                            Next
                        </button>
                    </div>
                </form>
            ) : (
                /* Primary Flow - Type Selection */
                <div className="space-y-3">
                    <p className="text-center text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">
                        Choose your business size to continue verification
                    </p>
                    
                    <button
                        onClick={() => {
                            updateFormData({ businessType: 'SOLE_PROPRIETORSHIP' });
                            setStep(2);
                            setError('');
                        }}
                        className="w-full flex items-center p-4 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group bg-white dark:bg-slate-800"
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold mr-4 group-hover:scale-110 transition-transform">
                            S
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Sole Proprietorship</h4>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Verify instantly using your GSTIN</p>
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            updateFormData({ businessType: 'ORGANIZATION' });
                            setStep(2);
                            setError('');
                        }}
                        className="w-full flex items-center p-4 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group bg-white dark:bg-slate-800"
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold mr-4 group-hover:scale-110 transition-transform">
                            L
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Organization</h4>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Verify via CIN, PAN, and GSTIN details</p>
                        </div>
                    </button>
                    
                    <div className="pt-4 flex justify-start">
                        <button
                            type="button"
                            onClick={() => navigate('/signup/selection')}
                            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignupBusiness;
