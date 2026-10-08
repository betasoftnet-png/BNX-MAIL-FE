import { useTranslation } from "../context/LanguageContext";
import React, { useState } from 'react';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Plus, X, Edit2, Trash2, Pin, StickyNote, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const API_BASE = import.meta.env.VITE_NOTES_API_BASE_URL || 'https://api.bit-tool.com/api/notes';

const getAppBadge = (appName) => {
  const lower = (appName || '').toLowerCase();
  if (lower.includes('cliks')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (lower.includes('bnx') || lower.includes('mail')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  if (lower.includes('bit tool') || lower.includes('bittool')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const NOTE_COLORS = [
  { value: '#ffffff', label: 'Default', isDark: false },
  { value: '#f28b82', label: 'Red', isDark: false },
  { value: '#fbbc04', label: 'Orange', isDark: false },
  { value: '#fff475', label: 'Yellow', isDark: false },
  { value: '#ccff90', label: 'Green', isDark: false },
  { value: '#a7ffeb', label: 'Teal', isDark: false },
  { value: '#cbf0f8', label: 'Blue', isDark: false },
  { value: '#aecbfa', label: 'Dark Blue', isDark: false },
  { value: '#d7aefb', label: 'Purple', isDark: false },
  { value: '#fdcfe8', label: 'Pink', isDark: false },
  { value: '#e6c9a8', label: 'Brown', isDark: false },
  { value: '#e8eaed', label: 'Gray', isDark: false }
];

function NotesPanelInner() {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialFormState = { title: '', content: '', color: '#ffffff', isPinned: false };
  const [formData, setFormData] = useState(initialFormState);

  const { data: notes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['global-notes'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token found');
      
      const res = await fetch(`${API_BASE}?allApps=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch notes');
      const result = await res.json();
      return result?.data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Note created successfully');
      closeModal();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create note');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/update/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update note');
      return res.json();
    },
    onSuccess: () => {
      // Instant closure on edit success (from the instructions)
      if (isAdding) {
        toast.success('Note updated successfully');
        closeModal();
      }
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update note');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to delete note');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Note deleted successfully');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete note');
    }
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.title && !formData.content) return;
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (note) => {
    setEditingId(note.id || note._id);
    setFormData({
      title: note.title || '',
      content: note.content || '',
      color: note.color || '#ffffff',
      isPinned: !!note.isPinned
    });
    setIsAdding(true);
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const togglePin = (note) => {
    updateMutation.mutate({
      id: note.id || note._id,
      payload: { isPinned: !note.isPinned }
    });
  };

  const deleteNote = (id) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteMutation.mutate(id);
    }
  };

  const pinnedNotes = notes.filter(n => n.isPinned);
  const unpinnedNotes = notes.filter(n => !n.isPinned);

  const NoteCard = ({ note }) => (
    <div 
      className="p-3 border shadow-sm rounded-xl hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col"
      style={{ 
        backgroundColor: note.color === '#ffffff' ? 'var(--tw-bg-opacity, white)' : note.color,
        borderColor: note.color === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
        color: note.color === '#ffffff' ? 'inherit' : '#1f2937' // dark text for colored notes
      }}
    >
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-bold text-sm truncate flex-1 pr-6">{note.title}</h3>
        {note.applicationName && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider absolute top-3 right-3 ${getAppBadge(note.applicationName)}`}>
            {note.applicationName.replace('_', ' ')}
          </span>
        )}
      </div>
      
      <p className="text-xs opacity-90 line-clamp-4 whitespace-pre-wrap flex-1 mb-6">
        {note.content}
      </p>

      {/* Action Buttons (visible on hover) */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => togglePin(note)}
          className={`p-1 rounded-full hover:bg-black/10 transition-colors ${note.isPinned ? 'text-gray-900' : 'text-gray-600'}`}
          title={note.isPinned ? "Unpin" : "Pin"}
        >
          <Pin size={14} className={note.isPinned ? "fill-current" : ""} />
        </button>
        <button 
          onClick={() => openEditModal(note)}
          className="p-1 rounded-full hover:bg-black/10 transition-colors text-gray-600"
          title="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button 
          onClick={() => deleteNote(note.id || note._id)}
          className="p-1 rounded-full hover:bg-red-500/20 text-red-600 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-4 mt-1 px-1 shrink-0">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <StickyNote className="text-yellow-500 w-5 h-5" />
          Global Notes
        </h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="p-1.5 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 rounded-lg transition-colors flex items-center justify-center shadow-sm border border-yellow-100 dark:border-yellow-800/50"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hidden-scrollbar pb-2 px-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 opacity-60">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mb-3" />
            <span className="text-xs">Loading notes...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-100 dark:border-red-900/30">
            <AlertCircle size={24} className="mb-2 opacity-80" />
            <p className="text-xs font-medium">{error.message}</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-10 opacity-50 flex flex-col items-center">
            <StickyNote className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No notes found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pinnedNotes.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">Pinned</h3>
                <div className="grid grid-cols-2 gap-2">
                  {pinnedNotes.map(note => (
                    <NoteCard key={note.id || note._id} note={note} />
                  ))}
                </div>
              </div>
            )}
            
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1 mt-2">Others</h3>}
                <div className="grid grid-cols-2 gap-2">
                  {unpinnedNotes.map(note => (
                    <NoteCard key={note.id || note._id} note={note} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Note Modal - Bottom Sheet Style */}
      {isAdding && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end overflow-hidden pointer-events-none rounded-xl">
          <div 
            className="absolute inset-0 bg-transparent pointer-events-auto transition-opacity"
            onClick={closeModal}
          />
          
          <div 
            className="relative flex flex-col rounded-t-2xl p-4 max-h-[90%] overflow-y-auto hidden-scrollbar shadow-2xl pointer-events-auto transition-colors duration-300"
            style={{ 
              backgroundColor: formData.color === '#ffffff' ? 'var(--tw-bg-opacity, white)' : formData.color,
            }}
          >
            <div className={`flex items-center justify-between mb-4 ${formData.color !== '#ffffff' ? 'text-gray-900' : 'text-gray-800 dark:text-white'}`}>
              <h3 className="font-bold flex items-center gap-2">
                {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                {editingId ? 'Edit Note' : 'Add Note'}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setFormData({...formData, isPinned: !formData.isPinned})}
                  className={`p-1.5 rounded-lg transition-colors ${formData.isPinned ? 'bg-black/10' : 'hover:bg-black/5'}`}
                  title={formData.isPinned ? "Unpin" : "Pin"}
                >
                  <Pin size={16} className={formData.isPinned ? "fill-current" : ""} />
                </button>
                <button onClick={closeModal} className="p-1.5 hover:bg-black/5 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3 text-sm">
              <input 
                placeholder="Title"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className={`w-full px-2 py-1 text-lg font-bold outline-none bg-transparent placeholder-black/30 ${formData.color !== '#ffffff' ? 'text-gray-900' : 'text-gray-900 dark:text-gray-100'}`} 
              />
              
              <textarea 
                required 
                placeholder="Take a note..."
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                rows={4}
                className={`w-full px-2 py-1 outline-none bg-transparent resize-none placeholder-black/30 ${formData.color !== '#ffffff' ? 'text-gray-800' : 'text-gray-800 dark:text-gray-200'}`} 
              />

              <div className="flex flex-wrap gap-1.5 mt-2 px-2">
                {NOTE_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({...formData, color: color.value})}
                    className={`w-6 h-6 rounded-full border shadow-sm transition-transform ${formData.color === color.value ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color.value, borderColor: 'rgba(0,0,0,0.1)' }}
                    title={color.label}
                  />
                ))}
              </div>

              <button 
                disabled={createMutation.isPending || updateMutation.isPending} 
                type="submit" 
                className="mt-4 py-2.5 bg-black/80 hover:bg-black text-white font-medium rounded-lg shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingId ? 'Update Note' : 'Save Note')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotesPanelInner />
    </QueryClientProvider>
  );
}
