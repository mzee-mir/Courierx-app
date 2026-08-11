import { useState } from 'react';
import { useQuery } from 'react-query';
import { financeService } from '../../api/finance.service';
import { 
  Copy, AlertCircle, ArrowUpRight, ArrowDownLeft, 
  Loader2, Search, Calendar, Landmark
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const LedgerAudit = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery(
    ['financeLedger', page], 
    () => financeService.getLedger({ page, limit: 20 }),
    { refetchInterval: 30000 } // Data Freshness Rule: 30s
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info('Reference ID Copied');
  };

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;

  // --- THE PENNY GAP LOGIC ---
  const totalDebit = data?.totals?.debit || 0;
  const totalCredit = data?.totals?.credit || 0;
  const pennyGap = Math.abs(totalCredit - totalDebit);
  const isImbalanced = pennyGap > 0.01; // Allow for minor floating point rounding

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Landmark className="text-brand" /> Immutable Financial Ledger
          </h1>
          <p className="text-xs text-gray-500 font-mono uppercase">Double-Entry Source of Truth</p>
        </div>

        {/* LIQUIDITY SUMMARY */}
        <div className="flex gap-4">
           <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase">Total Debits</p>
              <p className="text-lg font-black text-red-600">-${totalDebit.toLocaleString()}</p>
           </div>
           <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase">Total Credits</p>
              <p className="text-lg font-black text-green-600">+${totalCredit.toLocaleString()}</p>
           </div>
        </div>
      </div>

      {/* 🚨 THE PENNY-GAP ALERT (Super Admin Only Visual) */}
      {isImbalanced && (
        <div className="bg-red-600 text-white p-6 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-red-200 animate-pulse">
          <AlertCircle size={40} />
          <div>
            <h2 className="text-lg font-black uppercase italic">Critical System Imbalance</h2>
            <p className="text-sm font-mono text-red-100">
              Integrity Failure: Credits and Debits do not match. Gap: ${pennyGap.toFixed(4)}
            </p>
          </div>
          <button className="ml-auto bg-white text-red-600 px-6 py-2 rounded-xl font-bold text-xs">Run Forensic Audit</button>
        </div>
      )}

      {/* LEDGER TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
            <tr>
              <th className="px-8 py-5 font-black uppercase tracking-widest">Entry Date</th>
              <th className="px-8 py-5 font-black uppercase tracking-widest">Reference ID</th>
              <th className="px-8 py-5 font-black uppercase tracking-widest text-right text-red-400">Debit (Out)</th>
              <th className="px-8 py-5 font-black uppercase tracking-widest text-right text-green-400">Credit (In)</th>
              <th className="px-8 py-5 font-black uppercase tracking-widest">System Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.ledger.map((entry: any) => (
              <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-4 text-gray-500 whitespace-nowrap">
                  {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(entry.referenceId)}>
                    <span className="font-bold text-gray-900 truncate max-w-[100px]">{entry.referenceId}</span>
                    <Copy size={12} className="text-gray-300 group-hover:text-brand" />
                  </div>
                </td>
                <td className="px-8 py-4 text-right">
                  {entry.debitAccount ? (
                    <span className="text-red-600 font-bold flex items-center justify-end gap-1">
                       <ArrowDownLeft size={10} /> ${entry.amount.toFixed(2)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-8 py-4 text-right">
                  {entry.creditAccount ? (
                    <span className="text-green-600 font-bold flex items-center justify-end gap-1">
                       <ArrowUpRight size={10} /> ${entry.amount.toFixed(2)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-8 py-4">
                  <div className="flex flex-col">
                    <p className="text-gray-700 font-bold">{entry.description}</p>
                    <p className="text-[9px] text-gray-400 uppercase">{entry.debitAccount || 'System'} → {entry.creditAccount || 'System'}</p>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* PAGINATION */}
        <div className="p-6 bg-gray-50/50 border-t flex justify-between items-center">
           <span className="text-[10px] font-bold text-gray-400 uppercase">Page {page} Tracking</span>
           <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 bg-white border rounded-xl font-bold text-xs"
              >Previous</button>
              <button 
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-white border rounded-xl font-bold text-xs"
              >Next</button>
           </div>
        </div>
      </div>
    </div>
  );
};