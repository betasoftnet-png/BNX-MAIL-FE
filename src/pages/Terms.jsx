import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = (e) => {
    e.preventDefault();
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/register");
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 md:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto pb-12">
        <Link 
          to={location.state?.from || "/register"} 
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-8 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Registration
        </Link>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">Terms and Conditions</h1>
          <p className="text-slate-500 dark:text-slate-400">Last Updated: April 23, 2026</p>
        </header>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <p className="text-lg leading-relaxed">
              Welcome to BNX Mail. These Terms and Conditions ("Terms") govern your use of the BNX Mail mobile application and related services provided by <strong>BETA Softnet</strong> ("we," "us," or "our").
            </p>
            <p className="text-lg leading-relaxed mt-4">
              By installing, accessing, or using BNX Mail, you agree to be bound by these Terms. If you do not agree, please do not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">1. Acceptance of Terms</h2>
            <p>By creating an account on BNX Mail, you represent that you are at least 18 years of age or have legal parental/guardian consent, and that you have the authority to enter into this agreement.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">2. Description of Service</h2>
            <p>BNX Mail is a premium email communication platform that provides:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Encrypted email transmission and storage.</li>
              <li>Real-time chat functionality via WebSockets.</li>
              <li>Offline mail queuing and synchronization.</li>
              <li>Biometric authentication (FaceID/Fingerprint) for enhanced local security.</li>
              <li>Custom label management and organization tools.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">3. Privacy and Data Security</h2>
            <p>Your privacy is critical to us.</p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Encryption:</h3>
                <p>We use industry-standard encryption to protect your communications.</p>
              </div>
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Local Security:</h3>
                <p>If you enable biometric login, your credentials are stored locally in your device's Secure Storage (Keychain for iOS, Keystore for Android) and are never transmitted to our servers in plain text.</p>
              </div>
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Data Collection:</h3>
                <p>We collect only the data necessary to provide the service. Please refer to our <Link to="/privacy" state={{ from: location.state?.from || "/register" }} className="text-blue-600 hover:underline">Privacy Policy</Link> for a full breakdown.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">4. User Responsibilities</h2>
            <p>As a user of BNX Mail, you agree:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>To provide accurate registration information.</li>
              <li>To keep your password and biometric access secure.</li>
              <li>Not to use the service for "spamming," phishing, or any illegal activities.</li>
              <li>Not to attempt to reverse-engineer or disrupt the application's infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">5. Acceptable Use Policy</h2>
            <p>You may not use BNX Mail to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Distribute malware, viruses, or harmful code.</li>
              <li>Harass, threaten, or abuse other users.</li>
              <li>Impersonate any person or entity.</li>
              <li>Violate the intellectual property rights of others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">6. Intellectual Property</h2>
            <p>All content, features, and functionality of BNX Mailâ€”including but not limited to the BNX logo, UI design, and source codeâ€”are the exclusive property of <strong>BETA Softnet</strong> and are protected by international copyright and trademark laws.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, <strong>BETA Softnet</strong> shall not be liable for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Any loss of data due to user negligence (e.g., losing account credentials).</li>
              <li>Service interruptions caused by third-party network providers.</li>
              <li>Indirect, incidental, or consequential damages arising from the use of the app.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">8. Modifications to Service and Terms</h2>
            <p>We reserve the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Update these Terms at any time. Significant changes will be notified via app updates or email.</li>
              <li>Modify or discontinue any feature of the service without prior notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">9. Account Termination</h2>
            <p>We reserve the right to suspend or terminate your account if you violate these Terms or engage in activities that threaten the security of our platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">10. Contact Information</h2>
            <p>For questions or concerns regarding these Terms, please contact us at:</p>
            <div className="mt-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
              <p className="font-bold text-slate-900 dark:text-white">BETA Softnet Support</p>
              <p className="mt-2">Email: <a href="mailto:support@bnxmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@bnxmail.com</a></p>
              <p>Website: <a href="https://www.bnxmail.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">www.bnxmail.com</a></p>
            </div>
          </section>

          <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            <p>Â© {new Date().getFullYear()} BETA Softnet. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Terms;
