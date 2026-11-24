import { api, getApiBaseUrl } from './api';

export const mailBackupAPI = {
    getBackups: (params = {}) => {
        const { type = 'all', page = 1, size = 20 } = params;
        return api.get('/api/mail-backups', {
            params: { type, page, size }
        });
    },
    getBackupById: (id) => {
        return api.get(`/api/mail-backups/${id}`);
    },
    getAttachmentDownloadUrl: (id, attachmentId) => {
        const apiBaseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (import.meta.env.VITE_API_URL || '');
        const base = apiBaseUrl ? apiBaseUrl.replace(/\/+$/, '') : '';
        return `${base}/api/mail-backups/${id}/attachments/${attachmentId}`;
    },
    verifyOtp: (otp) => {
        return api.post('/api/mail-backups/verify-otp', { otp });
    },
    resendOtp: () => {
        return api.post('/api/mail-backups/resend-otp');
    }
};
