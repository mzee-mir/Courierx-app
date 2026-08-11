import { Search, Filter, X, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Props {
  onFilterChange: (filters: any) => void;
  placeholder: string;
  showStatusFilter?: boolean;
}

export const SearchFilterBar = ({ onFilterChange, placeholder, showStatusFilter }: Props) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });

  // DEBOUNCE LOGIC: Wait 500ms after typing stops before triggering API
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ search, status, startDate: dates.start, endDate: dates.end });
    }, 500);
    return () => clearTimeout(timer);
  }, [search, status, dates]);

  return (
    <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center">
      <div className="flex-1 min-w-[250px] relative group">
        <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-brand transition-colors" size={18} />
        <input 
          type="text"
          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:border-brand/20 focus:ring-4 focus:ring-brand/5 transition-all text-sm font-medium"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-3.5"><X size={14} className="text-gray-300" /></button>}
      </div>

      {showStatusFilter && (
        <select 
          className="p-3 bg-gray-50 border-transparent border rounded-2xl text-xs font-bold uppercase tracking-wider outline-none focus:border-brand/20 cursor-pointer"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      )}

      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-transparent focus-within:border-brand/20">
         <Calendar size={14} className="text-gray-400" />
         <input type="date" className="bg-transparent text-xs outline-none" value={dates.start} onChange={(e) => setDates({...dates, start: e.target.value})} />
         <span className="text-gray-300 text-xs">-</span>
         <input type="date" className="bg-transparent text-xs outline-none" value={dates.end} onChange={(e) => setDates({...dates, end: e.target.value})} />
      </div>
    </div>
  );
};