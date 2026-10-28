import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MdArrowBack, MdPersonAdd, MdSend, MdEmail } from "react-icons/md";
import { groupAPI } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";

const GroupDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme } = useTheme();

    const [group, setGroup] = useState(location.state?.group || null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [showAddMembers, setShowAddMembers] = useState(false);
    const [emailsInput, setEmailsInput] = useState("");

    const [showSendEmail, setShowSendEmail] = useState(false);
    const [emailData, setEmailData] = useState({ subject: "", body: "" });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchMembers();
    }, [id]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const res = await groupAPI.getMembers(id);
            if (res.data?.success) {
                setMembers(res.data.data || []);
            }
        } catch (err) {
            setError("Failed to load members");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMembers = async (e) => {
        e.preventDefault();
        if (!emailsInput.trim()) return;

        // Split by comma, space, or newline
        const emailsList = emailsInput.split(/[\s,]+/).filter(e => e.includes('@'));
        if (emailsList.length === 0) {
            toast.error("Please enter valid email addresses");
            return;
        }

        try {
            setLoading(true);
            const res = await groupAPI.addMembers(id, { emails: emailsList });
            if (res.data?.success) {
                toast.success(`Added ${res.data.data.addedCount} members`);
                setEmailsInput("");
                setShowAddMembers(false);
                fetchMembers();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add members");
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async (e) => {
        e.preventDefault();
        if (!emailData.subject || !emailData.body) {
            toast.error("Subject and body are required");
            return;
        }

        try {
            setSending(true);
            const res = await groupAPI.sendBroadcast(id, {
                subject: emailData.subject,
                body: emailData.body,
                isHtml: true
            });
            if (res.data?.success) {
                toast.success(`Email sent to ${res.data.data.recipientsCount} recipients`);
                setEmailData({ subject: "", body: "" });
                setShowSendEmail(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to send email");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto" style={{ background: theme.bg, color: theme.text }}>
            <button
                onClick={() => navigate("/colab")}
                className="flex items-center gap-1 text-sm mb-4 transition-colors hover:underline"
                style={{ color: theme.subText }}
            >
                <MdArrowBack /> Back to Colab
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold">{group?.name || `Colab #${id}`}</h2>
                    {group?.description && (
                        <p className="mt-1" style={{ color: theme.subText }}>{group.description}</p>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setShowAddMembers(!showAddMembers); setShowSendEmail(false); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition-transform hover:scale-105"
                        style={{ borderColor: theme.border, background: theme.cardBg }}
                    >
                        <MdPersonAdd size={20} style={{ color: theme.accent }} />
                        Add Members
                    </button>
                    <button
                        onClick={() => { setShowSendEmail(!showSendEmail); setShowAddMembers(false); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-md transition-transform hover:scale-105"
                        style={{ background: theme.accent }}
                    >
                        <MdSend size={18} />
                        Send Email
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
                    {error}
                </div>
            )}

            {showAddMembers && (
                <form onSubmit={handleAddMembers} className="mb-6 p-6 rounded-xl shadow-md border" style={{ background: theme.cardBg, borderColor: theme.border }}>
                    <h3 className="text-lg font-semibold mb-2">Add New Members</h3>
                    <p className="text-sm border-b pb-4 mb-4" style={{ color: theme.subText, borderColor: theme.border }}>
                        Enter email addresses separated by commas or spaces.
                    </p>
                    <textarea
                        autoFocus
                        value={emailsInput}
                        onChange={(e) => setEmailsInput(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-transparent focus:ring-2 outline-none mb-4"
                        style={{ borderColor: theme.border, color: theme.text }}
                        placeholder="alice@example.com, bob@example.com"
                        rows={3}
                        required
                    />
                    <div className="flex gap-3">
                        <button disabled={loading} type="submit" className="px-5 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: theme.accent }}>
                            {loading ? "Adding..." : "Add"}
                        </button>
                        <button type="button" onClick={() => setShowAddMembers(false)} className="px-5 py-2 rounded-lg" style={{ background: theme.border, color: theme.text }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {showSendEmail && (
                <form onSubmit={handleSendEmail} className="mb-6 p-6 rounded-xl shadow-md border" style={{ background: theme.cardBg, borderColor: theme.border }}>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <MdEmail style={{ color: theme.accent }} />
                        Broadcast to Group
                    </h3>
                    <p className="text-sm border-b pb-4 mb-4" style={{ color: theme.subText, borderColor: theme.border }}>
                        This will send an email to all {members.length} members using BCC.
                    </p>
                    <div className="mb-4">
                        <input
                            autoFocus
                            value={emailData.subject}
                            onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                            className="w-full p-3 border rounded-lg bg-transparent focus:ring-2 outline-none"
                            style={{ borderColor: theme.border, color: theme.text }}
                            placeholder="Subject"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <textarea
                            value={emailData.body}
                            onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                            className="w-full p-3 border rounded-lg bg-transparent focus:ring-2 outline-none"
                            style={{ borderColor: theme.border, color: theme.text }}
                            placeholder="Write your email body here (HTML is supported)..."
                            rows={8}
                            required
                        />
                    </div>
                    <div className="flex gap-3">
                        <button disabled={sending || members.length === 0} type="submit" className="px-5 py-2 rounded-lg text-white disabled:opacity-50 flex items-center gap-2" style={{ background: theme.accent }}>
                            {sending ? "Sending..." : "Send to All"}
                            <MdSend size={16} />
                        </button>
                        <button type="button" onClick={() => setShowSendEmail(false)} className="px-5 py-2 rounded-lg" style={{ background: theme.border, color: theme.text }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="rounded-xl border shadow-sm overflow-hidden" style={{ background: theme.cardBg, borderColor: theme.border }}>
                <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
                    <h3 className="font-semibold text-lg">Members ({members.length})</h3>
                </div>

                {loading && members.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: theme.subText }}>Loading...</div>
                ) : members.length === 0 ? (
                    <div className="p-12 text-center">
                        <p style={{ color: theme.subText }}>No members found in this group.</p>
                        <button onClick={() => { setShowAddMembers(true); setShowSendEmail(false); }} className="mt-4 text-sm font-medium underline" style={{ color: theme.accent }}>
                            Add a member
                        </button>
                    </div>
                ) : (
                    <ul className="divide-y" style={{ borderColor: theme.border }}>
                        {members.map((member) => (
                            <li key={member.id} className="p-4 px-6 flex justify-between items-center transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${theme.accent}, #9333ea)` }}>
                                        {member.email.split('@')[0].charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-[15px]">{member.email.split('@')[0]}</p>
                                        <p className="text-xs" style={{ color: theme.subText }}>
                                            Added {new Date(member.addedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default GroupDetails;
