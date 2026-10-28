import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { emailAPI } from '../services/api';
// import logo from '../assets/bnx.jpeg';

import logo from "../assets/bnx-remove.png";

const CreateMailbox = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get state passed from Register page
    const { tempToken, password, username } = location.state || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailName, setEmailName] = useState('');

    useEffect(() => {
        // Redirect if no token (user didn't come from registration)
        if (!tempToken) {
            navigate('/register');
        }
    }, [tempToken, navigate]);

    const handleCreateEmail = async (e) => {
        e.preventDefault();
        setError('');

        if (!emailName) {
            setError('Email name is required');
            return;
        }

        setLoading(true);

        try {
            // Call API with tempToken
            const response = await emailAPI.createEmail({
                emailName: emailName,
                password: password
            }, tempToken);

            if (response.data.success) {
                // Success! Redirect to login
                alert(`Email created successfully: ${response.data.data.email}`);
                navigate('/login');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Email creation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 transition-all duration-500">
                {/* Logo */}
                <div className="text-center">
                    <img src={logo} alt="BNX Mail" className="mx-auto h-24 w-auto drop-shadow-md" />
                    <h2 className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Final Step
                    </h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 font-medium">
                        Choose your official @bnxmail.com address
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleCreateEmail}>
                    <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
                            Create your email identity
                        </label>
                        <div className="flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                            <input
                                type="text"
                                name="emailName"
                                value={emailName}
                                onChange={(e) => setEmailName(e.target.value)}
                                required
                                pattern="[a-z0-9._\-]+"
                                className="flex-1 px-4 py-3 bg-transparent focus:outline-none dark:text-white"
                                placeholder="e.g. john.doe"
                            />
                            <span className="px-4 py-3 bg-gray-100 dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 font-bold border-l border-gray-200 dark:border-slate-500">
                                @bnxmail.com
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 italic">
                            Tip: Use lowercase letters, numbers, dots, or hyphens.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Securing Identity...</span>
                            </div>
                        ) : (
                            'Claim Email Address â†’'
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                        Logged in as <span className="font-semibold text-gray-600 dark:text-slate-300">{username}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CreateMailbox;
