import { useTranslation } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { getAccessToken, getActiveEmail } from "../utils/tokenStorage";
import {
  MdChevronLeft,
  MdChevronRight,
  MdAdd,
  MdEvent,
  MdOutlineNoteAlt,
  MdNotificationsActive,
  MdClose
} from 'react-icons/md';

const CALENDAR_API_BASE = import.meta.env.VITE_APP_CALENDAR_API || 'https://api.bit-tool.com/api/calendar';

export default function CalendarPanel() {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Add item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState('event'); // event, note, reminder
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    startTime: '10:00',
    endTime: '11:00',
    notificationEmail: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchMonthData(currentDate);
  }, [currentDate]);

  const fetchMonthData = async (date) => {
    setLoading(true);
    setError('');
    
    // Start of month
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    // End of month
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    
    try {
      const token = getAccessToken();
      
      const res = await fetch(`${CALENDAR_API_BASE}/search?startDate=${start.toISOString()}&endDate=${end.toISOString()}&allApps=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch calendar data');
      
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setEvents(json.data.events || []);
        setNotes(json.data.notes || []);
        setReminders(json.data.reminders || []);
      }
    } catch (err) {
      console.error(err);
      setError('Could not load calendar items.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if an API item falls on a given local JS Date
  const isItemOnDate = (isoString, targetDate) => {
    if (!isoString) return false;
    const itemDate = new Date(isoString);
    return (
      itemDate.getFullYear() === targetDate.getFullYear() &&
      itemDate.getMonth() === targetDate.getMonth() &&
      itemDate.getDate() === targetDate.getDate()
    );
  };

  const getItemsForDate = (date) => {
    return {
      dayEvents: events.filter(e => isItemOnDate(e.startTime, date)),
      dayNotes: notes.filter(n => isItemOnDate(n.date, date)),
      dayReminders: reminders.filter(r => isItemOnDate(r.date, date))
    };
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    
    try {
      const token = getAccessToken();
      
      // Build base date ISO
      const selectedYear = selectedDate.getFullYear();
      const selectedMonth = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const selectedDay = String(selectedDate.getDate()).padStart(2, '0');
      
      let endpoint = '';
      let body = {};
      
      if (addType === 'event') {
        endpoint = '/events';
        const startIso = new Date(`${selectedYear}-${selectedMonth}-${selectedDay}T${formData.startTime}:00`).toISOString();
        const endIso = new Date(`${selectedYear}-${selectedMonth}-${selectedDay}T${formData.endTime}:00`).toISOString();
        body = {
          title: formData.title,
          description: formData.description,
          startTime: startIso,
          endTime: endIso
        };
      } else if (addType === 'note') {
        endpoint = '/notes';
        const dateIso = new Date(`${selectedYear}-${selectedMonth}-${selectedDay}T00:00:00`).toISOString();
        body = {
          title: formData.title,
          content: formData.content,
          date: dateIso
        };
      } else if (addType === 'reminder') {
        endpoint = '/reminders';
        const dateIso = new Date(`${selectedYear}-${selectedMonth}-${selectedDay}T${formData.startTime}:00`).toISOString();
        const activeEmail = getActiveEmail() || 'me@example.com';
        body = {
          title: formData.title,
          description: formData.description,
          date: dateIso,
          time: formData.startTime,
          notificationEmail: formData.notificationEmail || activeEmail
        };
      }

      const res = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Failed to create ${addType}`);
      
      setShowAddForm(false);
      setFormData({
        title: '',
        description: '',
        content: '',
        startTime: '10:00',
        endTime: '11:00',
        notificationEmail: ''
      });
      
      // Refresh current month
      fetchMonthData(currentDate);
      
    } catch (err) {
      console.error(err);
      setError(`Could not save ${addType}.`);
    } finally {
      setFormLoading(false);
    }
  };

  const renderGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    const gridCells = [];
    
    // Empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      gridCells.push(<div key={`empty-${i}`} />);
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const iterDate = new Date(year, month, day);
      const isSelected = isItemOnDate(iterDate, selectedDate);
      const isToday = isItemOnDate(iterDate, new Date());
      
      const { dayEvents, dayNotes, dayReminders } = getItemsForDate(iterDate);
      
      gridCells.push(
        <div 
          key={day}
          onClick={() => setSelectedDate(iterDate)}
          className={`flex flex-col items-center p-1 rounded-lg cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-amber-500 text-white shadow-md' 
              : isToday 
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span className="text-xs">{day}</span>
          {/* Dots */}
          <div className="flex gap-0.5 mt-0.5">
            {dayEvents.length > 0 && <span className="w-1 h-1 rounded-full bg-blue-400" />}
            {dayNotes.length > 0 && <span className="w-1 h-1 rounded-full bg-yellow-400" />}
            {dayReminders.length > 0 && <span className="w-1 h-1 rounded-full bg-pink-400" />}
          </div>
        </div>
      );
    }
    
    return gridCells;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const selectedItems = getItemsForDate(selectedDate);

  return (
    <div className="flex flex-col h-full text-gray-700 dark:text-gray-200 relative">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-sm">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
            <MdChevronLeft size={18} />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
            <MdChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* GRID CALENDAR */}
      <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-bold opacity-60 mb-2">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-6 min-h-[140px]">
        {renderGrid()}
      </div>

      {/* ERROR */}
      {error && <div className="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">{error}</div>}

      {/* SCHEDULE FOR SELECTED DAY */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-gray-100 dark:border-gray-800 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()} Schedule
          </span>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded"
          >
            <MdAdd size={14} /> Add
          </button>
        </div>
        
        {loading ? (
          <div className="text-xs opacity-50 flex justify-center py-4">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 hidden-scrollbar pr-1">
            {selectedItems.dayEvents.map(e => (
              <div key={e._id || Math.random()} className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-2">
                <MdEvent className="text-blue-500 mt-0.5 shrink-0" size={14} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-xs text-blue-900 dark:text-blue-100 truncate">{e.title}</div>
                    {e.app && <span className="shrink-0 text-[8px] font-bold bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase">{e.app.replace('_', ' ')}</span>}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">{new Date(e.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {e.description}</div>
                </div>
              </div>
            ))}
            
            {selectedItems.dayNotes.map(n => (
              <div key={n._id || Math.random()} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-lg flex gap-2">
                <MdOutlineNoteAlt className="text-yellow-600 mt-0.5 shrink-0" size={14} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-xs text-yellow-900 dark:text-yellow-100 truncate">{n.title}</div>
                    {n.app && <span className="shrink-0 text-[8px] font-bold bg-yellow-100 dark:bg-yellow-800/40 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded uppercase">{n.app.replace('_', ' ')}</span>}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">{n.content}</div>
                </div>
              </div>
            ))}
            
            {selectedItems.dayReminders.map(r => (
              <div key={r._id || Math.random()} className="p-2 bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-900/30 rounded-lg flex gap-2">
                <MdNotificationsActive className="text-pink-500 mt-0.5 shrink-0" size={14} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-xs text-pink-900 dark:text-pink-100 truncate">{r.title}</div>
                    {r.app && <span className="shrink-0 text-[8px] font-bold bg-pink-100 dark:bg-pink-800/40 text-pink-600 dark:text-pink-300 px-1.5 py-0.5 rounded uppercase">{r.app.replace('_', ' ')}</span>}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">{new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {r.description}</div>
                </div>
              </div>
            ))}
            
            {(selectedItems.dayEvents.length === 0 && selectedItems.dayNotes.length === 0 && selectedItems.dayReminders.length === 0) && (
              <div className="text-xs opacity-50 text-center py-4">No items scheduled</div>
            )}
          </div>
        )}
      </div>

      {/* ADD FORM OVERLAY */}
      {showAddForm && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end overflow-hidden pointer-events-none rounded-xl">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-auto"
            onClick={() => setShowAddForm(false)}
          />
          
          {/* Bottom Sheet Modal */}
          <div className="relative bg-white dark:bg-gray-900 flex flex-col rounded-t-2xl p-4 max-h-[85%] overflow-y-auto hidden-scrollbar shadow-2xl pointer-events-auto border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">Add Item for {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}</h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <MdClose size={18} />
            </button>
          </div>
          
          <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-lg mb-4 text-xs shrink-0">
            <button 
              onClick={() => setAddType('event')}
              className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${addType === 'event' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              Event
            </button>
            <button 
              onClick={() => setAddType('note')}
              className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${addType === 'note' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              Note
            </button>
            <button 
              onClick={() => setAddType('reminder')}
              className={`flex-1 py-1 rounded text-center font-semibold transition-colors ${addType === 'reminder' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
            >
              Reminder
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="flex flex-col gap-3 text-xs flex-1">
            <div>
              <label className="block mb-1 opacity-70">Title</label>
              <input 
                required 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300 dark:focus:border-gray-600" 
              />
            </div>
            
            {addType === 'event' && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block mb-1 opacity-70">Start Time</label>
                    <input type="time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300" />
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1 opacity-70">End Time</label>
                    <input type="time" required value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block mb-1 opacity-70">Description</label>
                  <textarea rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full flex-1 bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300 resize-none min-h-[60px]" />
                </div>
              </>
            )}
            
            {addType === 'note' && (
              <div className="flex-1 flex flex-col">
                <label className="block mb-1 opacity-70">Content</label>
                <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full flex-1 bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300 resize-none min-h-[60px]" />
              </div>
            )}
            
            {addType === 'reminder' && (
              <>
                <div>
                  <label className="block mb-1 opacity-70">Time</label>
                  <input type="time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300" />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Description</label>
                  <textarea rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300 resize-none min-h-[60px]" />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Notification Email (optional)</label>
                  <input type="email" value={formData.notificationEmail} onChange={e => setFormData({...formData, notificationEmail: e.target.value})} className="w-full bg-black/5 dark:bg-white/5 p-2 rounded outline-none border border-transparent focus:border-gray-300" />
                </div>
              </>
            )}

            <button disabled={formLoading} type="submit" className="mt-auto py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-sm disabled:opacity-50 transition-colors">
              {formLoading ? 'Saving...' : 'Save Item'}
            </button>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
