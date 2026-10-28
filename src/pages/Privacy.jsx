import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
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
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">Privacy Policy for BNX Mail</h1>
          <p className="text-slate-500 dark:text-slate-400">Last Updated: April 23, 2026</p>
        </header>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <p className="text-lg leading-relaxed">
              At BNX Mail, we are committed to protecting your privacy and ensuring your personal information is handled securely and transparently. This Privacy Policy outlines how we collect, use, and safeguard your data when you use the BNX Mail application and services provided by <strong>BETA Softnet</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">1. Information We Collect</h2>
            <p>We collect information that is necessary to provide you with a secure and efficient email experience:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Registration Data:</strong> Name, email address, and account credentials.</li>
              <li><strong>Service Data:</strong> Email content, attachments, and chat messages (all processed via secure, encrypted channels).</li>
              <li><strong>Technical Data:</strong> Device information, IP addresses, and app usage statistics to improve performance and security.</li>
              <li><strong>Biometric Data:</strong> We do not collect or store your actual fingerprint or facial data. These are processed locally by your device's operating system (FaceID/Keystore), and we only receive a success/fail confirmation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">2. How We Use Your Information</h2>
            <p>We use the data we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Facilitate email transmission and synchronization.</li>
              <li>Enable real-time chat via WebSockets.</li>
              <li>Provide offline access to your messages.</li>
              <li>Ensure the security and integrity of our platform.</li>
              <li>Provide customer support and respond to inquiries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">3. Data Encryption and Security</h2>
            <p>Security is at the core of BNX Mail:</p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Transmission Security:</h3>
                <p>All communications between your device and our servers are encrypted using industry-standard protocols (TLS/SSL).</p>
              </div>
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Local Storage:</h3>
                <p>Sensitive information, such as login tokens, is stored in your device's Secure Storage (Keychain for iOS, Keystore for Android).</p>
              </div>
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">Message Privacy:</h3>
                <p>We implement advanced encryption to ensure your emails remain private and accessible only to intended recipients.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">4. Information Sharing and Disclosure</h2>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Third-Party Services:</strong> We do not sell your personal data to advertisers or third parties.</li>
              <li><strong>Legal Compliance:</strong> We may disclose information if required by law, subpoena, or to protect the safety and rights of our users or the public.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger or acquisition, your data may be transferred, subject to the same privacy protections.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">5. Your Rights and Choices</h2>
            <p>You have control over your data:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Access & Update:</strong> You can view and edit your profile information in the app settings.</li>
              <li><strong>Account Deletion:</strong> You may request to delete your account at any time, which will remove your data from our active systems.</li>
              <li><strong>Opt-Out:</strong> You can manage notification preferences and biometric settings within the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">6. Retention of Data</h2>
            <p>We retain your personal information only as long as necessary to provide the services you have requested and to comply with legal obligations.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">7. Changes to This Policy</h2>
            <p>We may update our Privacy Policy periodically. We will notify you of any changes by posting the new policy in the app and updating the "Last Updated" date.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">8. Contact Us</h2>
            <p>If you have any questions or concerns about our privacy practices, please reach out to us:</p>
            <div className="mt-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
              <p className="font-bold text-slate-900 dark:text-white">BETA Softnet Privacy Team</p>
              <p className="mt-2">Email: <a href="mailto:privacy@bnxmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@bnxmail.com</a></p>
              <p>Website: <a href="https://www.bnxmail.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">www.bnxmail.com/privacy</a></p>
            </div>
          </section>

          <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            <p>Â© 2026 BETA Softnet. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
