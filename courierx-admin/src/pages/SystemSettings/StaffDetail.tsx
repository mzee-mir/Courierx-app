import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { staffService } from '../../api/staff.service';
import { 
  ChevronLeft, Shield, Clock, Activity, 
  Key, ShieldOff, Loader2, Info, UserCheck 
} from 'lucide-react';
import { format } from 'date-fns';
import { ROLE_PERMISSIONS } from '../../config/permissions';

export const StaffDetail = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery(['staffDetail', id], () => staffService.getStaffDetail(id!));

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;

  const { profile, activities, stats } = data;

  return (
    <div className="space-y-6 p-6">
      {/* 1. HEADER & BREADCRUMBS */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/settings/staff" className="text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-brand transition-colors">
            <ChevronLeft size={14} /> Back to Staff Directory
          </Link>
          <h1 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">Authority Dossier</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: IDENTITY & CAPABILITIES */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-20 w-20 bg-brand text-white rounded-3xl flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-100">
                {profile.displayName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{profile.displayName}</h2>
                <p className="text-xs font-mono text-gray-400">{profile.email}</p>
              </div>
              <span className="bg-blue-50 text-brand px-3 py-1 rounded-full text-[10px] font-black uppercase border border-blue-100">
                {profile.roles[0].replace('_', ' ')}
              </span>
            </div>

            <div className="pt-6 border-t border-gray-50 space-y-4">
               <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                 <Shield size={14} /> Permssions Map
               </h3>
               <div className="flex flex-wrap gap-2">
                  {ROLE_PERMISSIONS[profile.roles[0] as keyof typeof ROLE_PERMISSIONS]?.map((cap: string) => (
                    <span key={cap} className="px-2 py-1 bg-gray-50 text-gray-600 text-[9px] font-bold rounded-md border border-gray-100">
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
               </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-[2rem] p-6 text-white space-y-4">
             <h3 className="text-[10px] font-black uppercase text-brand tracking-widest flex items-center gap-2">
               <Key size={14} /> Security Actions
             </h3>
             <div className="space-y-2">
                <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  Reset System Password
                </button>
                <button className="w-full py-3 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-xl text-xs font-bold hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2">
                  <ShieldOff size={14} /> Terminate All Sessions
                </button>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVITY FEED */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-2">
                <Activity size={20} className="text-brand" /> Operational History
              </h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Recent 20 Actions</span>
            </div>

            <div className="divide-y divide-gray-50">
              {activities.length === 0 ? (
                <div className="p-20 text-center text-gray-400 italic text-sm">No recorded actions for this account.</div>
              ) : activities.map((log: any) => (
                <div key={log._id} className="p-6 hover:bg-gray-50/50 transition-colors flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-gray-100 px-2 py-0.5 rounded uppercase">{log.action}</span>
                      <span className="text-[10px] text-gray-400 font-mono">REQ: {log.requestId?.slice(0, 8)}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{log.details}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {format(new Date(log.createdAt), 'PPP p')}
                    </p>
                  </div>
                  <div className="text-right">
                    <button className="text-[10px] font-bold text-brand hover:underline flex items-center gap-1">
                      View Trace <Info size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};