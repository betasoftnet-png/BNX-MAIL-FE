import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI, emailAPI } from '../services/api';
import { useSignup } from '../context/SignupContext';
// import logo from '../assets/bnx.jpeg';

import logo from "../assets/bnx-remove.png";

const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { formData, updateFormData } = useSignup();
    const [step, setStep] = useState(1); // 1: Register, 2: Create Email
    const accountType = formData.accountType || 'PERSONAL'; // PERSONAL or BUSINESS
    const setAccountType = (type) => updateFormData({ accountType: type });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        updateFormData({
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            let payload = {
                mode: accountType,
                username: formData.username,
                password: formData.password,
            };

            if (accountType === 'PERSONAL') {
                payload = {
                    ...payload,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    dob: formData.dob,
                    parentEmail: formData.parentEmail || null,
                };
            } else {
                payload = {
                    ...payload,
                    businessName: formData.businessName,
                    businessType: formData.businessType,
                    registrationNumber: formData.registrationNumber,
                    ownerFirstName: formData.ownerFirstName,
                    ownerLastName: formData.ownerLastName,
                    domain: formData.domain,
                };
            }

            const response = await authAPI.register(payload);

            if (response.data.success) {
                const { tempToken, accountType: respAccountType } = response.data.data;
                
                if (respAccountType === 'BUSINESS') {
                    // Business flow
                    navigate('/verify-domain', {
                        state: {
                            tempToken,
                            username: formData.username,
                            domain: formData.domain
                        }
                    });
                } else {
                    // Personal flow
                    navigate('/create-mailbox', {
                        state: {
                            tempToken,
                            password: formData.password,
                            username: formData.username
                        }
                    });
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="max-w-xl w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 transition-all duration-500 hover:shadow-blue-500/10">
                {/* Logo */}
                <div className="text-center">
                    <img src={logo} alt="BNX Mail" className="mx-auto h-24 w-auto drop-shadow-md" />
                    <h2 className="mt-2 text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Create Account
                    </h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-medium">
                        Secure. Private. Professional.
                    </p>
                </div>

                {/* Account Type Toggle */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-700 rounded-xl">
                    <button
                        onClick={() => setAccountType('PERSONAL')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                            accountType === 'PERSONAL'
                                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm scale-[1.02]'
                                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
                        }`}
                    >
                        Personal
                    </button>
                    <button
                        onClick={() => setAccountType('BUSINESS')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                            accountType === 'BUSINESS'
                                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm scale-[1.02]'
                                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
                        }`}
                    >
                        Business
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl animate-shake">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleRegister}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Common Fields */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username || ''}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none dark:text-white"
                                placeholder="e.g. johndoe"
                            />
                        </div>

                        {accountType === 'PERSONAL' ? (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        name="dob"
                                        value={formData.dob || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Parent Email (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        name="parentEmail"
                                        value={formData.parentEmail || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        placeholder="Required if you are a minor"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Business Name
                                    </label>
                                    <input
                                        type="text"
                                        name="businessName"
                                        value={formData.businessName || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        placeholder="Global Tech Industries"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Business Type
                                    </label>
                                    <input
                                        type="text"
                                        name="businessType"
                                        value={formData.businessType || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        placeholder="Software, Retail, etc."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Registration Number
                                    </label>
                                    <input
                                        type="text"
                                        name="registrationNumber"
                                        value={formData.registrationNumber || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        placeholder="Tax ID / Reg No."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Owner First Name
                                    </label>
                                    <input
                                        type="text"
                                        name="ownerFirstName"
                                        value={formData.ownerFirstName || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Owner Last Name
                                    </label>
                                    <input
                                        type="text"
                                        name="ownerLastName"
                                        value={formData.ownerLastName || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        Custom Domain
                                    </label>
                                    <input
                                        type="text"
                                        name="domain"
                                        value={formData.domain || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        placeholder="yourdomain.com"
                                    />
                                </div>
                            </>
                        )}

                        {/* Password Fields */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password || ''}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword || ''}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : (
                            'Create Secure Account →'
                        )}
                    </button>

                    <div className="text-center text-sm space-y-4 pt-4">
                        <div className="text-gray-500 dark:text-slate-400">
                            Already have an account?{' '}
                            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
                                Sign in
                            </Link>
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700 pt-6">
                            By creating an account, you agree to our{' '}
                            <Link to="/terms" state={{ from: location.pathname }} className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms</Link>
                            {' '}and{' '}
                            <Link to="/privacy" state={{ from: location.pathname }} className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;