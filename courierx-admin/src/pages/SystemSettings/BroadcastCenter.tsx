import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { settingsService } from '../../api/settings.service';
import { 
  Megaphone, Send, AlertTriangle, 
  Clock, XCircle, Users, Loader2, Info 
} from 'lucide-react';
import { toast } from 'sonner';

export const BroadcastCenter = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ targetRole: 'all', title: '', body: '' });
  const [draft, setDraft] = useState<{ id: string; impactCount: number } | null>(null);

  // 1. Data Loading (Queued/Active Broadcasts)
  const { data: queue, isLoading: loadingQueue } = useQuery(
    'broadcastQueue', 
    settingsService.getQueuedBroadcasts,
    { refetchInterval: 10000 } // Auto-refresh while on this page
  );

  // 2. Mutations
  const draftMutation = useMutation(settingsService.createBroadcastDraft, {
    onSuccess: (data) => {
      setDraft({ id: data.draftId, impactCount: data.impactCount });
      toast.info(`Draft created. Target impact: ${data.impactCount} users.`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create draft')
  });

  const executeMutation = useMutation(settingsService.executeBroadcast, {
    onSuccess: () => {
      queryClient.invalidateQueries('broadcastQueue');
      setDraft(null);
      setFormData({ targetRole: 'all', title: '', body: '' });
      toast.success('Broadcast queued. Sending in 5 minutes.');
    }
  });

  const abortMutation = useMutation(settingsService.abortBroadcast, {
    onSuccess: () => {
      queryClient.invalidateQueries('broadcastQueue');
      toast.success('Broadcast transmission ABORTED.');
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push Broadcaster</h1>
        <p className="text-sm text-gray-500 font-mono uppercase tracking-tighter">Emergency & Mass Communication Hub</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT: COMPOSITION PANEL */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Megaphone size={20} className="text-brand" />
              New Message Composition
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Recipient Group</label>
                <select 
                  disabled={!!draft}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold"
                  value={formData.targetRole}
                  onChange={(e) => setFormData({...formData, targetRole: e.target.value})}
                >
                  <option value="all">Every Active User</option>
                  <option value="customer">Customers Only</option>
                  <option value="driver">Verified Drivers Only</option>
                </select>
              </div>

              <input 
                type="text" 
                disabled={!!draft}
                placeholder="Message Title (Brief & Urgent)" 
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />

              <textarea 
                disabled={!!draft}
                placeholder="Compose your message here..." 
                rows={4}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand"
                value={formData.body}
                onChange={(e) => setFormData({...formData, body: e.target.value})}
              />

              {!draft ? (
                <button 
                  onClick={() => draftMutation.mutate(formData)}
                  disabled={!formData.title || !formData.body || draftMutation.isLoading}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2"
                >
                  {draftMutation.isLoading ? <Loader2 className="animate-spin" /> : "Check Impact & Create Draft"}
                </button>
              ) : (
                <div className="p-6 bg-red-50 border-2 border-red-200 rounded-3xl space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 text-red-700">
                    <AlertTriangle size={24} className="animate-pulse" />
                    <div>
                      <p className="font-black uppercase text-sm italic">High Impact Action Required</p>
                      <p className="text-xs font-bold">This message will be pushed to {draft.impactCount} devices.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setDraft(null)}
                      className="flex-1 py-3 font-bold text-gray-500 hover:text-gray-700"
                    >
                      Discard Draft
                    </button>
                    <button 
                      onClick={() => executeMutation.mutate(draft.id)}
                      disabled={executeMutation.isLoading}
                      className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 flex justify-center items-center gap-2"
                    >
                      {executeMutation.isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Initiate Transmission</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: QUEUE & HISTORY */}
        <div className="space-y-6">
          <div className="bg-gray-900 p-6 rounded-3xl text-white shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Clock size={14} className="text-brand" /> Transmission Queue
            </h2>
            
            <div className="space-y-4">
              {queue?.filter((b: any) => b.status === 'QUEUED').map((b: any) => (
                <div key={b.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm truncate">{b.title}</p>
                    <span className="text-[9px] bg-brand text-white px-1.5 py-0.5 rounded font-black animate-pulse">QUEUED</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                    <span className="flex items-center gap-1"><Users size={10}/> {b.impactCount} users</span>
                    <span className="text-red-400">Abort window: 5m</span>
                  </div>
                  <button 
                    onClick={() => abortMutation.mutate(b.id)}
                    className="w-full py-2 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                  >
                    Abort Immediately
                  </button>
                </div>
              ))}

              {queue?.filter((b: any) => b.status === 'QUEUED').length === 0 && (
                <div className="py-10 text-center opacity-30">
                  <p className="text-xs font-bold uppercase italic">No active transmissions</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
               <Info size={14} /> Safety Guard Rules
            </h2>
            <ul className="space-y-3">
              <li className="text-[10px] text-gray-500 leading-tight flex gap-2">
                <span className="h-1 w-1 bg-brand rounded-full mt-1 shrink-0" />
                Broadcasts are delayed by 5 minutes to allow for error correction.
              </li>
              <li className="text-[10px] text-gray-500 leading-tight flex gap-2">
                <span className="h-1 w-1 bg-brand rounded-full mt-1 shrink-0" />
                Impact is calculated live against active device tokens.
              </li>
              <li className="text-[10px] text-gray-500 leading-tight flex gap-2">
                <span className="h-1 w-1 bg-brand rounded-full mt-1 shrink-0" />
                Only 1 mass broadcast allowed per 24h per segment.
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};