import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';
import { authAPI, emailAPI } from '../../services/api';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import toast from 'react-hot-toast';


const SignupPasswordSetup = () => {
    const navigate = useNavigate();
    const { formData, updateFormData } = useSignup();
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({
        password: '',
        confirmPassword: '',
        general: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFieldErrors({ password: '', confirmPassword: '', general: '' });

        const errors = {};
        if (!formData.password || formData.password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }
        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(prev => ({ ...prev, ...errors }));
            return;
        }

        setLoading(true);
        try {
            // 1. Build Register Payload
            let payload = {
                mode: formData.accountType === 'CHILD' ? 'PERSONAL' : formData.accountType,
                username: formData.username,
                password: formData.password,
                phoneNumber: formData.recoveryPhone || formData.mobileNumber || null,
            };

            if (formData.accountType === 'PERSONAL' || formData.accountType === 'CHILD') {
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
                    businessFlow: formData.businessFlow,
                    cin: formData.cin,
                    gstin: formData.gstin,
                    registrationNumber: formData.registrationNumber, // Fallback if needed
                    ownerFirstName: formData.ownerFirstName,
                    ownerLastName: formData.ownerLastName,
                };
            }

            // 2. Call Auth Register
            console.log("Registration Payload being sent:", payload);
            const registerRes = await authAPI.register(payload);
            const tempToken = registerRes.data?.data?.tempToken;

            if (!tempToken) {
                throw new Error("Registration failed to return a temporary token");
            }

            // 3. Create the email mailbox with the tempToken for ALL account types
            await emailAPI.createEmail({
                emailName: formData.username,
                password: formData.password,
            }, tempToken);

            toast.success('Account created successfully! Please log in.');
            navigate('/login');

        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || err.message || 'Registration failed';
            const lower = errMsg.toLowerCase();

            if (lower.includes('username') || lower.includes('handle') || lower.includes('email name')) {
                toast.error(errMsg);
                navigate('/signup/mail', { state: { usernameError: errMsg } });
                return;
            }

            if (
                lower.includes('phone') || 
                lower.includes('mobile') || 
                (lower.includes('already') && (lower.includes('number') || lower.includes('contact')))
            ) {
                const dupMsg = 'This mobile number is already registered. Please use another number';
                toast.error(dupMsg);
                navigate('/signup/mobile-verify', { state: { mobileError: dupMsg } });
                return;
            }

            if (lower.includes('password')) {
                setFieldErrors(prev => ({ ...prev, password: errMsg }));
                return;
            }

            setFieldErrors(prev => ({ ...prev, general: errMsg }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    Secure your account
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Set a strong password for your new account.
                </p>
            </div>

            {fieldErrors.general && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                    {fieldErrors.general}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Password
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => {
                                setFieldErrors(prev => ({ ...prev, password: '', general: '' }));
                                updateFormData({ password: e.target.value });
                            }}
                            required
                            className={`w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-slate-700 border ${
                                fieldErrors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500'
                            } rounded-xl outline-none dark:text-white transition-all`}
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
                    {fieldErrors.password && (
                        <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1.5 flex items-center gap-1">
                            {fieldErrors.password}
                        </p>
                    )}
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Confirm Password
                    </label>
                    <div className="relative flex items-center">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword}
                            onChange={(e) => {
                                setFieldErrors(prev => ({ ...prev, confirmPassword: '', general: '' }));
                                updateFormData({ confirmPassword: e.target.value });
                            }}
                            required
                            className={`w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-slate-700 border ${
                                fieldErrors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500'
                            } rounded-xl outline-none dark:text-white transition-all`}
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
                    {fieldErrors.confirmPassword && (
                        <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1.5 flex items-center gap-1">
                            {fieldErrors.confirmPassword}
                        </p>
                    )}
                </div>

                <div className="pt-4 flex justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/signup/mobile-verify')}
                        className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {loading ? 'Creating Account...' : 'Complete Setup'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SignupPasswordSetup;
