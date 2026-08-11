import React, { useState } from 'react'; // 👈 Must import React for Fragment
import { useQuery } from 'react-query';
import { auditService } from '../../api/audit.service';
import { 
  History, User as UserIcon, Clock, 
  Loader2, ChevronLeft, ChevronRight, 
  ChevronDown, ChevronUp, Info, Filter 
} from 'lucide-react';
import { format } from 'date-fns';
import { DiffViewer } from '../../components/ui/DiffViewer';

export const AuditLogs = () => {
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, isError } = useQuery(
    ['auditLogs', page, actionFilter], 
    () => auditService.getLogs(page, actionFilter), 
    { keepPreviousData: true }
  );

  // 1. SAFETY GUARD: If loading, show spinner and STOP
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="animate-spin text-brand h-10 w-10 mb-4" />
        <p className="text-gray-500">Loading audit history...</p>
      </div>
    );
  }

  // 2. SAFETY GUARD: If error or data missing, show error state
  if (isError || !data || !data.logs) {
    return (
      <div className="p-10 bg-red-50 text-red-600 rounded-2xl border border-red-100">
        <p className="font-bold">Error Loading Logs</p>
        <p className="text-sm">Could not connect to the audit service.</p>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    if (action.includes('VERIFY')) return 'bg-green-50 text-green-700 border-green-100';
    if (action.includes('DEPOSIT')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (action.includes('SUSPEND') || action.includes('CANCEL')) return 'bg-red-50 text-red-700 border-red-100';
    return 'bg-gray-50 text-gray-700 border-gray-100';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="text-brand" /> System Audit Logs
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-1/4">Administrator</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-1/4">Action</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-1/3">Details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {data.logs.map((log: any) => (
              /* 👈 FIX 1: Use React.Fragment with a KEY when returning multiple elements */
              <React.Fragment key={log._id}>
                <tr 
                  className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${expandedRow === log._id ? 'bg-blue-50/30' : ''}`}
                  onClick={() => setExpandedRow(expandedRow === log._id ? null : log._id)}
                >
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-brand/10 flex items-center justify-center text-brand flex-shrink-0">
                            <UserIcon size={14} />
                        </div>
                        <span className="truncate text-gray-700">{log.adminId?.displayName || 'Unknown Admin'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-600 truncate max-w-xs">{log.details}</p>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    <div className="flex items-center justify-end gap-2">
                       <span className="text-[13px] text-gray-700">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                       {expandedRow === log._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </td>
                </tr>

                {/* THE EXPANDED DIFF ROW */}
                {expandedRow === log._id && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={4} className="px-6 py-6 border-y border-gray-100 shadow-inner">
                       <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                             <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-1">
                                <Info size={12} /> Data Snapshot (Before vs After)
                             </h4>
                             <DiffViewer changes={log.changes} />
                          </div>
                          <div className="w-full md:w-64 space-y-2 p-4 bg-white rounded-xl border border-gray-100 self-start">
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Metadata</p>
                             <p className="text-[11px] text-gray-600"><strong>Target:</strong> {log.targetModel} ({log.targetId.slice(-6)})</p>
                             <p className="text-[11px] text-gray-600"><strong>Date:</strong> {format(new Date(log.createdAt), 'PPP')}</p>
                             <p className="text-[11px] text-gray-600"><strong>IP Address:</strong> {log.ipAddress || 'Not Captured'}</p>
                          </div>
                       </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* PAGINATION FOOTER */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
          {/* 👈 FIX 2: Added '?' to prevent 'undefined' crashes */}
          <p className="text-xs text-gray-500">
            Showing page {data?.pagination?.page} of {data?.pagination?.pages}
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              disabled={page === data?.pagination?.pages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};