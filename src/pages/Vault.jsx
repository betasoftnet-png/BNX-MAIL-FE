import { useTranslation } from "../context/LanguageContext";
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { vaultAPI } from "../services/api";
import { MdCloudUpload, MdDownload, MdDelete, MdInsertDriveFile, MdImage, MdPictureAsPdf, MdDescription } from "react-icons/md";
import toast from "react-hot-toast";

const Vault = () => {
  const { t } = useTranslation();
    const { user } = useAuth();
    const { theme } = useTheme();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    useEffect(() => {
        fetchFiles();
    }, [user?.email]);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const res = await vaultAPI.getUserFiles();
            setFiles(res.data || []);
        } catch (err) {
            console.error("Failed to fetch vault files:", err);
            toast.error("Could not load Vault files");
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast.error("File exceeds the 5MB limit");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            await vaultAPI.uploadFile(formData);
            toast.success("File uploaded to Vault");
            fetchFiles();
        } catch (err) {
            console.error("Upload failed:", err);
            toast.error(err.response?.data?.error || "Failed to upload file");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDownload = async (file) => {
        try {
            const res = await vaultAPI.downloadFile(file.id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", file.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed:", err);
            toast.error("Failed to download file");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this file from your Vault?")) return;
        
        try {
            await vaultAPI.deleteFile(id);
            toast.success("File deleted");
            setFiles(files.filter(f => f.id !== id));
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete file");
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (contentType) => {
        if (contentType.includes("image")) return <MdImage size={32} className="text-blue-500" />;
        if (contentType.includes("pdf")) return <MdPictureAsPdf size={32} className="text-red-500" />;
        if (contentType.includes("text")) return <MdDescription size={32} className="text-gray-500" />;
        return <MdInsertDriveFile size={32} className="text-gray-400" />;
    };

    const totalStorageUsed = files.reduce((acc, file) => acc + file.size, 0);

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            {/* Header Area */}
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: theme.text }}>
                        <span style={{ color: theme.accent || "#135bec" }}>â—</span> Vault
                    </h2>
                    <p className="text-sm mt-1 opacity-70" style={{ color: theme.subText }}>
                        Securely store your files. Max 5MB per file.
                    </p>
                    <div className="mt-2 text-xs font-medium" style={{ color: theme.subText }}>
                        Total Storage Used: {formatSize(totalStorageUsed)}
                    </div>
                </div>

                <div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        style={{ display: "none" }} 
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: theme.accent || "#135bec" }}
                    >
                        <MdCloudUpload size={20} />
                        {uploading ? "Uploading..." : "Upload File"}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 hidden-scrollbar">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 opacity-50">
                        <MdCloudUpload size={64} className="mb-4" />
                        <h3 className="text-xl font-medium mb-2">Your Vault is empty</h3>
                        <p className="text-sm text-center max-w-sm">Upload files up to 5MB to keep them securely stored and accessible anytime.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {files.map(file => (
                            <div 
                                key={file.id} 
                                className="group relative bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col gap-3 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all hover:shadow-lg hover:-translate-y-1"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                                        {getFileIcon(file.contentType)}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button 
                                            onClick={() => handleDownload(file)}
                                            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                                            title="Download"
                                        >
                                            <MdDownload size={18} style={{ color: theme.text }} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(file.id)}
                                            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                                            title="Delete"
                                        >
                                            <MdDelete size={18} className="text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="font-semibold text-sm truncate" style={{ color: theme.text }} title={file.filename}>
                                        {file.filename}
                                    </h4>
                                    <p className="text-xs opacity-60 mt-1" style={{ color: theme.subText }}>
                                        {formatSize(file.size)} â€¢ {new Date(file.uploadedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Vault;
