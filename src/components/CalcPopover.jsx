import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RefreshCw, History, Share2, Trash2, X, Globe, Percent, Tag, ArrowUpDown, Plus, Minus, X as XIcon, Divide, ArrowLeft } from 'lucide-react';
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

const API_BASE = import.meta.env.VITE_CALCULATOR_API_BASE_URL || 'https://api.bit-tool.com/api/calculator';

function CalcInner() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const [tape, setTape] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [runningTotal, setRunningTotal] = useState(0);
  const [pendingOperator, setPendingOperator] = useState(null);
  
  // Modes: 'tape', 'compare', 'history'
  const [activeView, setActiveView] = useState('tape');
  
  // Currency
  const [usdToInr, setUsdToInr] = useState(83.5);
  const [inrToUsd, setInrToUsd] = useState(0.012);
  const [currency, setCurrency] = useState('INR'); // INR or USD

  // Compare Mode State
  const [compareItems, setCompareItems] = useState([]);
  const [vendorA, setVendorA] = useState({ name: 'Vendor A', total: 0 });
  const [vendorB, setVendorB] = useState({ name: 'Vendor B', total: 0 });
  const [compareInput, setCompareInput] = useState({ label: '', vendorA_Value: '', vendorB_Value: '' });

  const tapeEndRef = useRef(null);

  useEffect(() => {
    // Fetch live currency rates
    Promise.all([
      fetch('https://api.frankfurter.dev/v2/rate/USD/INR').then(res => res.json()).catch(() => null),
      fetch('https://api.frankfurter.dev/v2/rate/INR/USD').then(res => res.json()).catch(() => null)
    ]).then(([usdRes, inrRes]) => {
      if (usdRes && usdRes.rate) setUsdToInr(usdRes.rate);
      if (inrRes && inrRes.rate) setInrToUsd(inrRes.rate);
    });
  }, []);

  useEffect(() => {
    // Auto-scroll tape to bottom
    if (tapeEndRef.current) {
      tapeEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tape]);

  // Fetch History
  const { data: tapeHistory = [], refetch: refetchTapeHistory } = useQuery({
    queryKey: ['calc-tape-history', userEmail],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return [];
      const res = await fetch(`${API_BASE}/history?allApps=true`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        console.error('TAPE HISTORY FETCH ERROR:', res.status, res.statusText);
        return [];
      }
      const result = await res.json();
      console.log('TAPE HISTORY FETCH RESULT:', result);
      return Array.isArray(result?.data?.rows) ? result.data.rows : (Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []));
    }
  });

  const { data: compareHistory = [], refetch: refetchCompareHistory } = useQuery({
    queryKey: ['calc-compare-history', userEmail],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return [];
      const res = await fetch(`${API_BASE}/compare/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        console.error('COMPARE HISTORY FETCH ERROR:', res.status, res.statusText);
        return [];
      }
      const result = await res.json();
      console.log('COMPARE HISTORY FETCH RESULT:', result);
      return Array.isArray(result?.data?.rows) ? result.data.rows : (Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []));
    }
  });

  // Tape Mutations
  const saveTapeMutation = useMutation({
    mutationFn: async (tapeOverride) => {
      const activeTape = Array.isArray(tapeOverride) ? tapeOverride : tape;
      if (activeTape.length === 0) throw new Error('Tape is empty');
      const token = getAccessToken();
      
      // 1. Create Session
      const sessionRes = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Tape - ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
          mode: 'business',
          currency: currency
        })
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.text();
        throw new Error(`Failed to create session: ${err}`);
      }
      const sessionData = await sessionRes.json();
      console.log('SAVE TAPE - SESSION CREATED:', sessionData);
      const sessionId = sessionData?.data?.id || sessionData?.data?._id || sessionData.id || sessionData._id;
      console.log('SAVE TAPE - SESSION ID:', sessionId);

      // 2. Add Items sequentially
      for (let i = 0; i < activeTape.length; i++) {
        const item = activeTape[i];
        const itemRes = await fetch(`${API_BASE}/sessions/${sessionId}/items`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequence: i + 1,
            value: Number(item.value),
            operator: item.operator,
            runningTotal: Number(item.runningTotal),
            label: item.label || ''
          })
        });
        if (!itemRes.ok) {
          const errText = await itemRes.text();
          throw new Error(`Failed to save item ${i + 1}: ${errText}`);
        }
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Tape saved successfully');
      queryClient.invalidateQueries({ queryKey: ['calc-tape-history'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save tape');
    }
  });

  // Compare Mutations
  const saveCompareMutation = useMutation({
    mutationFn: async () => {
      if (compareItems.length === 0) throw new Error('Compare is empty');
      const token = getAccessToken();
      
      // 1. Create Compare Session
      const sessionRes = await fetch(`${API_BASE}/compare/sessions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Comparison - ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
        })
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.text();
        throw new Error(`Failed to create compare session: ${err}`);
      }
      const sessionData = await sessionRes.json();
      console.log('SAVE COMPARE - SESSION CREATED:', sessionData);
      const sessionId = sessionData?.data?.id || sessionData?.data?._id || sessionData.id || sessionData._id;
      console.log('SAVE COMPARE - SESSION ID:', sessionId);

      // 2. Add Items sequentially
      for (let i = 0; i < compareItems.length; i++) {
        const item = compareItems[i];
        const cmpRes = await fetch(`${API_BASE}/compare/sessions/${sessionId}/items`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequence: i + 1,
            label: item.label,
            vendorA_Value: Number(item.vendorA_Value),
            vendorB_Value: Number(item.vendorB_Value)
          })
        });
        if (!cmpRes.ok) {
          const errText = await cmpRes.text();
          throw new Error(`Failed to save compare item ${i + 1}: ${errText}`);
        }
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Comparison saved successfully');
      queryClient.invalidateQueries({ queryKey: ['calc-compare-history'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save comparison');
    }
  });

  const appendToTape = (operator, valStr, customLabel = null) => {
    const val = parseFloat(valStr) || 0;
    if (val === 0 && operator !== '=') return; // Ignore zero operations except base

    let newTotal = runningTotal;
    let label = customLabel || operator;

    if (tape.length === 0 || operator === '=') {
      newTotal = val;
      label = customLabel || 'Base Value';
      operator = '=';
    } else {
      switch (operator) {
        case '+': newTotal += val; break;
        case '-': newTotal -= val; break;
        case '*': newTotal *= val; break;
        case '/': newTotal = val !== 0 ? newTotal / val : newTotal; break;
        case 'gst': 
          const gstAmt = (newTotal * val) / 100;
          newTotal += gstAmt; 
          label = `+${val}% GST`;
          break;
        case 'discount': 
          const discAmt = (newTotal * val) / 100;
          newTotal -= discAmt; 
          label = `-${val}% Discount`;
          break;
      }
    }

    const newItem = {
      value: val,
      operator: operator,
      runningTotal: newTotal,
      label: label
    };

    const newTape = [...tape, newItem];
    setTape(newTape);
    setRunningTotal(newTotal);
    setCurrentInput('');
    
    return newTape;
  };

  const handleKeypad = (val) => {
    if (val === 'C') {
      setCurrentInput('');
    } else if (val === 'AC') {
      setCurrentInput('');
      setTape([]);
      setRunningTotal(0);
      setPendingOperator(null);
    } else if (val === 'BACK') {
      setCurrentInput(prev => prev.slice(0, -1));
    } else if (['+', '-', '*', '/'].includes(val)) {
      if (currentInput) {
        if (tape.length === 0) {
          appendToTape('=', currentInput);
        } else if (pendingOperator) {
          appendToTape(pendingOperator, currentInput);
        } else {
          setTape([]);
          appendToTape('=', currentInput);
        }
      }
      setPendingOperator(val);
      setCurrentInput('');
    } else if (val === '=') {
      let finalTape = tape;
      if (currentInput) {
        if (tape.length === 0) {
          finalTape = appendToTape('=', currentInput);
        } else if (pendingOperator) {
          finalTape = appendToTape(pendingOperator, currentInput);
        } else {
          const baseVal = parseFloat(currentInput) || 0;
          finalTape = [{ value: baseVal, operator: '=', runningTotal: baseVal, label: 'Base Value' }];
          setTape(finalTape);
          setRunningTotal(baseVal);
        }
      }
      setPendingOperator(null);
      setCurrentInput('');
      
      // Auto-save the history
      if (finalTape && finalTape.length > 0) {
          saveTapeMutation.mutate(finalTape);
      }
    } else if (val === 'gst') {
      if (currentInput && pendingOperator) {
        appendToTape(pendingOperator, currentInput);
        setCurrentInput('');
      }
      appendToTape('gst', currentInput || '18');
      setPendingOperator(null);
      setCurrentInput('');
    } else if (val === 'discount') {
      if (currentInput && pendingOperator) {
        appendToTape(pendingOperator, currentInput);
        setCurrentInput('');
      }
      appendToTape('discount', currentInput || '10');
      setPendingOperator(null);
      setCurrentInput('');
    } else {
      setCurrentInput(prev => prev + val);
    }
  };

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'INR' ? 'USD' : 'INR');
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(val);
  };

  const addCompareItem = () => {
    if (!compareInput.label) return;
    const vA = parseFloat(compareInput.vendorA_Value) || 0;
    const vB = parseFloat(compareInput.vendorB_Value) || 0;
    
    setCompareItems([...compareItems, { ...compareInput, vendorA_Value: vA, vendorB_Value: vB }]);
    setVendorA(prev => ({ ...prev, total: prev.total + vA }));
    setVendorB(prev => ({ ...prev, total: prev.total + vB }));
    
    setCompareInput({ label: '', vendorA_Value: '', vendorB_Value: '' });
  };

  const clearCompare = () => {
    setCompareItems([]);
    setVendorA({ name: 'Vendor A', total: 0 });
    setVendorB({ name: 'Vendor B', total: 0 });
  };

  // UI RENDERERS
  const renderTapeMode = () => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100 tracking-wide">
          <span className="text-emerald-500 font-black">#</span> BETA CALC
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <button onClick={() => setActiveView('history')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><History size={16} /></button>
          <button onClick={() => saveTapeMutation.mutate()} disabled={tape.length === 0 || saveTapeMutation.isPending} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"><Share2 size={16} /></button>
          <button onClick={() => handleKeypad('AC')} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Tape Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/50 dark:bg-gray-900/50 hidden-scrollbar">
        {tape.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <RefreshCw size={24} className="mb-2" />
            <p className="text-xs">Start typing to record Tape</p>
          </div>
        ) : (
          tape.map((item, idx) => (
            <div key={idx} className="flex justify-between items-end border-b border-gray-100 dark:border-gray-800 pb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
                <span className="text-sm font-semibold opacity-70">
                  {item.operator !== '=' ? item.operator : ''} {new Intl.NumberFormat('en-IN').format(item.value)}
                </span>
              </div>
              <div className="font-bold text-lg">{formatMoney(item.runningTotal)}</div>
            </div>
          ))
        )}
        <div ref={tapeEndRef} />
      </div>

      {/* Input Display Area */}
      <div className="bg-gray-100/50 dark:bg-gray-800 py-2 px-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
          {tape.length === 0 ? 'SET BASE' : 'CURRENT INPUT'}
        </div>
        <div className="text-2xl font-black text-right h-8 truncate overflow-hidden">
          {currentInput || '0'}
        </div>
      </div>

      {/* Action Bar */}
      <div className="grid grid-cols-4 gap-1.5 p-1.5 border-t border-gray-100 dark:border-gray-800">
        <button onClick={() => handleKeypad('gst')} className="flex items-center justify-center gap-1.5 py-1.5 px-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <Percent size={12} /> GST
        </button>
        <button onClick={() => handleKeypad('discount')} className="flex items-center justify-center gap-1.5 py-1.5 px-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <Tag size={12} /> Discount
        </button>
        <button onClick={toggleCurrency} className="flex items-center justify-center gap-1.5 py-1.5 px-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <Globe size={12} /> {currency}
        </button>
        <button onClick={() => setActiveView('compare')} className="flex items-center justify-center gap-1.5 py-1.5 px-1 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm">
          <ArrowUpDown size={12} /> Compare
        </button>
      </div>

      {/* Keypad */}
      <div className="p-2.5 pt-0.5">
        <div className="grid grid-cols-4 gap-1.5 h-44">
          {/* Row 1 */}
          <button onClick={() => handleKeypad('C')} className="bg-red-50 dark:bg-red-900/20 text-red-500 font-bold rounded-xl flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => handleKeypad('BACK')} className="bg-gray-100 dark:bg-gray-800 font-bold rounded-xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => handleKeypad('/')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-black text-lg rounded-xl flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">/</button>
          <button onClick={() => handleKeypad('*')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-black text-lg rounded-xl flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">x</button>
          
          {/* Numbers Area */}
          <div className="col-span-3 grid grid-cols-3 gap-1.5">
            {[7, 8, 9, 4, 5, 6, 1, 2, 3, 'SCI', 0, '.'].map(btn => (
              <button 
                key={btn} 
                onClick={() => {
                  if (btn !== 'SCI') handleKeypad(btn.toString());
                }}
                className="bg-gray-50 dark:bg-gray-800 font-bold text-gray-800 dark:text-gray-100 rounded-xl flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.95] transition-all"
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Right Operators Area */}
          <div className="col-span-1 grid grid-rows-4 gap-1.5">
            <button onClick={() => handleKeypad('-')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-black text-lg rounded-xl flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">-</button>
            <button onClick={() => handleKeypad('+')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-black text-lg rounded-xl flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">+</button>
            <button onClick={() => handleKeypad('=')} className="row-span-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-2xl rounded-xl flex items-center justify-center shadow-md active:scale-[0.95] transition-all">=</button>
          </div>
        </div>
      </div>

      {/* Footer Total */}
      <div className="bg-gray-900 dark:bg-black text-white py-2 px-3 flex flex-col items-start mt-auto z-10">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tape Running Total</span>
        <span className="text-2xl font-black text-emerald-400">{formatMoney(runningTotal)}</span>
      </div>
    </div>
  );

  const renderCompareMode = () => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between p-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100 tracking-wide">
          <ArrowUpDown size={16} className="text-indigo-500" /> Compare Mode
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <button onClick={() => saveCompareMutation.mutate()} disabled={compareItems.length === 0 || saveCompareMutation.isPending} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><Share2 size={16} /></button>
          <button onClick={clearCompare} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
          <button onClick={() => setActiveView('tape')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50 dark:bg-gray-900/50 hidden-scrollbar flex flex-col gap-3">
        {/* Vendor Headers */}
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-2 pt-2 text-[10px] font-bold text-gray-400 uppercase">
          <div>Item / Label</div>
          <div className="text-right truncate">{vendorA.name}</div>
          <div className="text-right truncate">{vendorB.name}</div>
        </div>

        {/* Compare Items */}
        {compareItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-40 text-xs">No items added yet</div>
        ) : (
          <div className="space-y-2">
            {compareItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_80px] gap-2 px-2 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm items-center">
                <div className="text-xs font-semibold truncate">{item.label}</div>
                <div className="text-right text-xs">{new Intl.NumberFormat('en-IN').format(item.vendorA_Value)}</div>
                <div className="text-right text-xs">{new Intl.NumberFormat('en-IN').format(item.vendorB_Value)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <div className="mt-auto bg-white dark:bg-gray-800 p-2.5 rounded-xl shadow border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
          <input 
            type="text" 
            placeholder="Item Label (e.g. Server Cost)"
            value={compareInput.label}
            onChange={e => setCompareInput({...compareInput, label: e.target.value})}
            className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded outline-none bg-gray-50 dark:bg-gray-900 focus:border-indigo-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="number" 
              placeholder={`${vendorA.name} Value`}
              value={compareInput.vendorA_Value}
              onChange={e => setCompareInput({...compareInput, vendorA_Value: e.target.value})}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded outline-none bg-gray-50 dark:bg-gray-900 focus:border-indigo-500"
            />
            <input 
              type="number" 
              placeholder={`${vendorB.name} Value`}
              value={compareInput.vendorB_Value}
              onChange={e => setCompareInput({...compareInput, vendorB_Value: e.target.value})}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded outline-none bg-gray-50 dark:bg-gray-900 focus:border-indigo-500"
            />
          </div>
          <button onClick={addCompareItem} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs transition-colors">
            Add to Compare
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-gray-900 dark:bg-black p-3 shrink-0">
        <div className="grid grid-cols-[1fr_1fr] gap-2 items-end">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase truncate">{vendorA.name} Total</span>
            <span className={`text-lg font-black truncate ${vendorA.total < vendorB.total && vendorA.total > 0 ? 'text-emerald-400' : 'text-white'}`}>{formatMoney(vendorA.total)}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-gray-400 font-bold uppercase truncate">{vendorB.name} Total</span>
            <span className={`text-lg font-black truncate ${vendorB.total < vendorA.total && vendorB.total > 0 ? 'text-emerald-400' : 'text-white'}`}>{formatMoney(vendorB.total)}</span>
          </div>
        </div>
        {(vendorA.total > 0 || vendorB.total > 0) && (
          <div className="mt-2 text-center text-[10px] font-bold text-emerald-400 uppercase tracking-widest p-1 bg-emerald-500/10 rounded">
            {vendorA.total < vendorB.total ? `${vendorA.name} is cheaper` : vendorB.total < vendorA.total ? `${vendorB.name} is cheaper` : 'Equal value'}
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryMode = () => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between p-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100 tracking-wide">
          <History size={16} className="text-gray-500" /> History
        </div>
        <button onClick={() => setActiveView('tape')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 hidden-scrollbar space-y-4">
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tape Sessions</h3>
          {tapeHistory.length === 0 ? <p className="text-xs opacity-50">No saved tapes.</p> : (
            tapeHistory.map(session => (
              <div key={session.id || session._id} className="p-2 mb-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm">
                <div className="font-semibold text-xs truncate">{session.title}</div>
                <div className="text-[10px] opacity-60">{session.currency} • {new Date(session.createdAt || Date.now()).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Compare Sessions</h3>
          {compareHistory.length === 0 ? <p className="text-xs opacity-50">No saved comparisons.</p> : (
            compareHistory.map(session => (
              <div key={session.id || session._id} className="p-2 mb-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg shadow-sm">
                <div className="font-semibold text-xs text-indigo-700 dark:text-indigo-300 truncate">{session.title}</div>
                <div className="text-[10px] opacity-60">{new Date(session.createdAt || Date.now()).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full overflow-hidden flex flex-col relative min-h-[480px]">
      {activeView === 'tape' && renderTapeMode()}
      {activeView === 'compare' && renderCompareMode()}
      {activeView === 'history' && renderHistoryMode()}
    </div>
  );
}

export default function CalcPopover() {
  return (
    <QueryClientProvider client={queryClient}>
      <CalcInner />
    </QueryClientProvider>
  );
}
