import { useTranslation } from "../context/LanguageContext";
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Search, Plus, X, User, Phone, Mail, Briefcase, AlertCircle, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../utils/tokenStorage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const API_BASE = import.meta.env.VITE_CONTACT_API_BASE_URL || 'https://api.bit-tool.com/api/contacts';

const getAppColor = (appName) => {
  const lower = (appName || '').toLowerCase();
  if (lower.includes('cliks')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (lower.includes('bnx') || lower.includes('mail')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  if (lower.includes('bit tool') || lower.includes('bittool')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const initialFormState = { name: '', email: '', phonenumber: '', role: '' };

function ContactPanelInner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);

  const { data: contacts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['global-contacts', userEmail],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error('No access token found');
      
      const res = await fetch(`${API_BASE}/get-all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const result = await res.json();
      return result?.data?.rows || [];
    }
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (contact) => {
    setEditingId(contact.id || contact._id);
    setFormData({
      name: contact.name || '',
      email: contact.email || '',
      phonenumber: contact.phonenumber || contact.phone || '',
      role: contact.role || contact.designation || contact.jobTitle || ''
    });
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to add contact');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contact added successfully');
      closeModal();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to add contact');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const token = getAccessToken();
      let res = await fetch(`${API_BASE}/update/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Fallback in case endpoint is /edit/:id or /:id
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch(`${API_BASE}/edit/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok && (res.status === 404 || res.status === 405)) {
          res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to update contact');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      qc.setQueryData(['global-contacts'], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map(c => (c.id === variables.id || c._id === variables.id) ? { ...c, ...variables.payload } : c);
      });
      toast.success('Contact updated successfully');
      closeModal();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update contact');
    }
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.phonenumber || '').toLowerCase().includes(term) ||
      (c.role || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-4 mt-1 px-1">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <User className="text-blue-500 w-5 h-5" />
          Global Contacts
        </h2>
        <button 
          onClick={openAddModal}
          className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors flex items-center justify-center shadow-sm border border-blue-100 dark:border-blue-800/50 cursor-pointer"
          title="Add Contact"
          aria-label="Add Contact"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="relative mb-4 px-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search global contacts..."
          className="block w-full pl-10 pr-3 py-2 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder-gray-400 dark:text-gray-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto hidden-scrollbar pb-2 px-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 opacity-60">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-3" />
            <span className="text-xs">Loading contacts...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-100 dark:border-red-900/30">
            <AlertCircle size={24} className="mb-2 opacity-80" />
            <p className="text-xs font-medium">{error.message}</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-10 opacity-50 flex flex-col items-center">
            <User className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No contacts found</p>
            {searchTerm && <p className="text-xs mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredContacts.map(contact => {
              const contactId = contact.id || contact._id;
              return (
                <div key={contactId} className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{contact.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {contact.applicationName && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getAppColor(contact.applicationName)}`}>
                          {contact.applicationName.replace('_', ' ')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(contact);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                        title="Edit Contact"
                        aria-label="Edit Contact"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="opacity-70 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phonenumber && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="opacity-70 shrink-0" />
                        <span className="truncate">{contact.phonenumber}</span>
                      </div>
                    )}
                    {contact.role && (
                      <div className="flex items-center gap-2">
                        <Briefcase size={12} className="opacity-70 shrink-0" />
                        <span className="truncate">{contact.role}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal - Bottom Sheet Style */}
      {isModalOpen && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end overflow-hidden pointer-events-none rounded-xl">
          <div 
            className="absolute inset-0 bg-black/30 dark:bg-black/50 pointer-events-auto transition-opacity"
            onClick={closeModal}
          />
          
          <div className="relative bg-white dark:bg-gray-800 flex flex-col rounded-t-2xl p-5 max-h-[90%] overflow-y-auto hidden-scrollbar shadow-2xl pointer-events-auto border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {editingId ? <Edit2 size={18} className="text-blue-500" /> : <Plus size={18} className="text-blue-500" />}
                {editingId ? 'Edit Contact' : 'Add Contact'}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-sm">
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Full Name *</label>
                <input 
                  required 
                  placeholder="Jane Smith"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400 text-gray-800 dark:text-gray-100" 
                />
              </div>
              
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Email Address *</label>
                <input 
                  type="email"
                  required 
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400 text-gray-800 dark:text-gray-100" 
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Phone</label>
                  <input 
                    placeholder="+1 234 567 890"
                    value={formData.phonenumber}
                    onChange={e => setFormData({...formData, phonenumber: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400 text-gray-800 dark:text-gray-100" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Role</label>
                  <input 
                    placeholder="e.g. Supplier"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 px-3 py-2.5 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400 text-gray-800 dark:text-gray-100" 
                  />
                </div>
              </div>

              <button 
                disabled={isSubmitting} 
                type="submit" 
                className="mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Save Contact')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <ContactPanelInner />
    </QueryClientProvider>
  );
}
