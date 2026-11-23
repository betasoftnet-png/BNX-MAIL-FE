import React, { useState, useEffect } from 'react';
import { MdTrendingUp, MdEmail, MdInbox, MdSend, MdDelete, MdReport, MdArchive, MdDrafts, MdPerson } from 'react-icons/md';
import { api } from '../services/api';
import { getAccessToken } from '../utils/tokenStorage';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  AreaChart, Area
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const AnalyticsApp = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dailyRange, setDailyRange] = useState(15); // Default to last 15 days

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = getAccessToken();
        if (!token) throw new Error('No token found');
        
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await api.get(`/api/mail/analytics?timezone=${encodeURIComponent(tz)}`);
        // console.log(res.data)
        if (res.data && res.data.success) {
          setData(res.data.data);
        } else {
          throw new Error(res.data?.message || 'Failed to load analytics');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <div className="animate-spin text-3xl"><MdTrendingUp /></div>
        <p className="text-sm font-medium">Crunching data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500 gap-3 p-4 text-center">
        <MdReport size={32} />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  window.__ANALYTICS_DATA__ = data;
  
  const { 
    folderCounts = {}, 
    topSenders = {}, 
    topReceivers = {},
    receivedByDate = {},
    sentByDate = {},
    receivedByMonth = {},
    sentByMonth = {}
  } = data || {};

  // Sort Top Senders
  const sortedSenders = Object.entries(topSenders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  // Sort Top Receivers
  const sortedReceivers = Object.entries(topReceivers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Pie Chart Data
  const pieData = Object.entries(folderCounts).map(([name, value]) => ({ name, value }));

  // Date Chart Data - strictly chronological and padded timezone-safely based on selected range
  let dateData = [];
  if (data) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (dailyRange - 1));
    
    let current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      dateData.push({
        date: dateStr,
        Received: Number(receivedByDate[dateStr] || 0),
        Sent: Number(sentByDate[dateStr] || 0)
      });
      
      current.setDate(current.getDate() + 1);
    }
  }

  // Month Chart Data - strictly chronological and padded timezone-safely
  const allMonthKeys = Array.from(new Set([...Object.keys(receivedByMonth), ...Object.keys(sentByMonth)])).sort();
  let monthData = [];
  if (allMonthKeys.length > 0) {
    const [sY, sM] = allMonthKeys[0].split('-').map(Number);
    const [eY, eM] = allMonthKeys[allMonthKeys.length - 1].split('-').map(Number);
    
    let curY = sY;
    let curM = sM;
    while (curY < eY || (curY === eY && curM <= eM)) {
      const monthStr = `${curY}-${String(curM).padStart(2, '0')}`;
      monthData.push({
        month: monthStr,
        Received: Number(receivedByMonth[monthStr] || 0),
        Sent: Number(sentByMonth[monthStr] || 0)
      });
      
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
  }

  const formatDateTick = (tickItem) => {
    try {
      if (!tickItem || typeof tickItem !== 'string') return tickItem;
      const parts = tickItem.split('-');
      if (parts.length !== 3) return tickItem;
      const [y, m, d] = parts;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return tickItem;
      return `${months[monthIdx]} ${parseInt(d, 10)}`;
    } catch {
      return tickItem;
    }
  };

  const formatMonthTick = (tickItem) => {
    try {
      if (!tickItem || typeof tickItem !== 'string') return tickItem;
      const parts = tickItem.split('-');
      if (parts.length !== 2) return tickItem;
      const [y, m] = parts;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return tickItem;
      return `${months[monthIdx]} ${y}`;
    } catch {
      return tickItem;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto hidden-scrollbar pb-6 gap-4 sm:gap-6 px-3 sm:px-6">
      <div className="flex items-center gap-2 mb-2 mt-6">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <MdTrendingUp size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">Analytics Dashboard</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Mailbox insights, composition & activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Mailbox Composition Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col h-[350px]">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mailbox Composition</h3>
          <div className="w-full h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="40%"
                  innerRadius="40%"
                  outerRadius="65%"
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={44} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top People */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 h-full">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col h-[350px] overflow-hidden">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 shrink-0">Top Senders</h3>
            <div className="overflow-y-auto hidden-scrollbar flex-1">
              {sortedSenders.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {sortedSenders.map(([email, count]) => (
                    <div key={email} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={email}>{email}</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-500 italic">Not enough data.</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col h-[350px] overflow-hidden">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 shrink-0">Top Receivers</h3>
            <div className="overflow-y-auto hidden-scrollbar flex-1">
              {sortedReceivers.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {sortedReceivers.map(([email, count]) => (
                    <div key={email} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={email}>{email}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-500 italic">Not enough data.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col h-[400px]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Daily Activity</h3>
          <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-lg p-0.5 gap-0.5 select-none">
            {[7, 15, 30].map((days) => (
              <button
                key={days}
                onClick={() => setDailyRange(days)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  dailyRange === days
                    ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm border-none'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border-none bg-transparent'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dateData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="date" tick={{fontSize: 10}} tickMargin={10} minTickGap={10} tickFormatter={formatDateTick} />
              <YAxis tick={{fontSize: 10}} />
              <Tooltip labelFormatter={formatDateTick} />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey="Received" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
              <Area type="monotone" dataKey="Sent" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col h-[400px]">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 shrink-0">Monthly Activity</h3>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="month" tick={{fontSize: 10}} tickMargin={10} tickFormatter={formatMonthTick} />
              <YAxis tick={{fontSize: 10}} />
              <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} labelFormatter={formatMonthTick} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="Received" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="Sent" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  );
};

export default AnalyticsApp;
