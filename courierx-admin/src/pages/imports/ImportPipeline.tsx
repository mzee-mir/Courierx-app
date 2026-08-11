import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { importService } from '../../api/import.service';
import { 
  Package, Globe, Ship, Landmark, CheckSquare, 
  Square, ShieldAlert, Loader2, Info, ChevronRight,
  Filter, Warehouse
} from 'lucide-react';
import { toast } from 'sonner';

// --- TYPES ---
interface ShipmentCardProps {
  shipment: any;
  isBulk: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

interface PipelineColumnProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}

export const ImportPipeline = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  // 1. DATA FETCHING (30s refresh for live terminal updates)
  const { data: shipments, isLoading, isError } = useQuery(
    'activeImports', 
    importService.getActive, 
    { refetchInterval: 30000 }
  );

  // 2. BULK TRANSITION MUTATION
  const bulkMutation = useMutation(
    ({ status, locId }: { status: string, locId: string }) => 
      importService.bulkUpdateStatus(selectedIds, status, locId),
    {
      onSuccess: () => {
        toast.success(`Pipeline Updated`, {
          description: `Successfully moved ${selectedIds.length} shipments to the next leg.`
        });
        setSelectedIds([]);
        setIsBulkMode(false);
        queryClient.invalidateQueries('activeImports');
      },
      onError: () => toast.error('Bulk update failed. Check connectivity.')
    }
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="animate-spin text-brand h-10 w-10" />
      <p className="text-gray-500 font-mono animate-pulse uppercase text-xs">Syncing Global Logistics Data...</p>
    </div>
  );

  if (isError) return <div className="p-10 text-red-500">Failed to load pipeline.</div>;

  return (
    <div className="space-y-6 p-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase italic font-mono tracking-tighter">Global Shipment Pulse</h1>
          <div className="flex items-center gap-2 mt-1 text-gray-500 font-mono text-xs">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            LIVE TRACKING: CHINA HUB → MOGADISHU TERMINAL
          </div>
        </div>
        
        <div className="flex gap-3">
          {isBulkMode ? (
            <div className="flex gap-2 animate-in slide-in-from-right duration-300">
               <button 
                onClick={() => bulkMutation.mutate({ status: 'ARRIVED_LOCAL', locId: 'MOG_PORT_01' })}
                disabled={selectedIds.length === 0 || bulkMutation.isLoading}
                className="bg-brand text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-100 flex items-center gap-2"
              >
                {bulkMutation.isLoading ? <Loader2 size={14} className="animate-spin"/> : <Landmark size={14}/>}
                Confirm Port Arrival ({selectedIds.length})
              </button>
              <button 
                onClick={() => { setIsBulkMode(false); setSelectedIds([]); }} 
                className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsBulkMode(true)}
              className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all"
            >
              <CheckSquare size={14} /> Bulk Mode
            </button>
          )}
        </div>
      </div>

      {/* PIPELINE KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* COLUMN 1: CHINA HUB */}
        <PipelineColumn 
          title="China Hub" 
          icon={<Globe size={16}/>} 
          count={shipments?.filter((s: any) => ['RECEIVED_AT_ORIGIN', 'CONSOLIDATED', 'PACKED'].includes(s.status)).length}
        >
          {shipments?.filter((s: any) => ['RECEIVED_AT_ORIGIN', 'CONSOLIDATED', 'PACKED'].includes(s.status)).map((s: any) => (
             <ShipmentCard 
               key={s.id} 
               shipment={s} 
               isBulk={isBulkMode}
               selected={selectedIds.includes(s.id)}
               onSelect={(id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
             />
          ))}
        </PipelineColumn>

        {/* COLUMN 2: ON SEA/AIR */}
        <PipelineColumn 
          title="On Sea / Air" 
          icon={<Ship size={16}/>} 
          count={shipments?.filter((s: any) => s.status === 'IN_TRANSIT').length}
        >
           {shipments?.filter((s: any) => s.status === 'IN_TRANSIT').map((s: any) => (
             <ShipmentCard 
               key={s.id} 
               shipment={s} 
               isBulk={isBulkMode} 
               selected={selectedIds.includes(s.id)} 
               onSelect={(id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} 
             />
          ))}
        </PipelineColumn>

        {/* COLUMN 3: PORT / CUSTOMS */}
        <PipelineColumn 
          title="Port / Customs" 
          icon={<Landmark size={16}/>} 
          count={shipments?.filter((s: any) => s.status === 'ARRIVED_LOCAL').length}
        >
           {shipments?.filter((s: any) => s.status === 'ARRIVED_LOCAL').map((s: any) => (
             <ShipmentCard 
               key={s.id} 
               shipment={s} 
               isBulk={isBulkMode} 
               selected={selectedIds.includes(s.id)} 
               onSelect={(id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} 
             />
          ))}
        </PipelineColumn>

        {/* COLUMN 4: READY FOR HANDOFF */}
        <PipelineColumn 
          title="Mogadishu Hub" 
          icon={<Warehouse size={16}/>} 
          count={shipments?.filter((s: any) => s.status === 'READY_FOR_LOCAL_HANDOFF').length}
        >
           {shipments?.filter((s: any) => s.status === 'READY_FOR_LOCAL_HANDOFF').map((s: any) => (
             <ShipmentCard 
               key={s.id} 
               shipment={s} 
               isBulk={isBulkMode} 
               selected={selectedIds.includes(s.id)} 
               onSelect={(id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} 
             />
          ))}
        </PipelineColumn>

      </div>
    </div>
  );
};

// --- SUB-COMPONENTS (With Strict Prop Typing) ---

const PipelineColumn = ({ title, icon, count, children }: PipelineColumnProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <span className="bg-white border border-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">{count || 0}</span>
    </div>
    <div className="space-y-3 min-h-[600px] bg-gray-50/50 p-3 rounded-[2rem] border border-dashed border-gray-200">
      {children}
      {count === 0 && <div className="py-20 text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">No Inventory</div>}
    </div>
  </div>
);

const ShipmentCard = ({ shipment, isBulk, selected, onSelect }: ShipmentCardProps) => (
  <div 
    className={`bg-white p-5 rounded-2xl border transition-all duration-200 ${
      selected 
      ? 'border-brand ring-4 ring-brand/5 scale-[0.98]' 
      : 'border-gray-100 shadow-sm hover:shadow-md'
    }`}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex flex-col">
        <span className="text-[9px] font-mono font-bold text-gray-400">TRACKING</span>
        <span className="text-xs font-black font-mono text-gray-900">#{shipment.externalTrackingNumber.slice(-8).toUpperCase()}</span>
      </div>
      {isBulk && (
        <button 
          onClick={() => onSelect(shipment.id)}
          className="transition-transform active:scale-90"
        >
          {selected 
            ? <CheckSquare className="text-brand" size={20} fill="currentColor" fillOpacity={0.1} /> 
            : <Square className="text-gray-200" size={20} />
          }
        </button>
      )}
    </div>

    <p className="text-sm font-bold text-gray-800 line-clamp-2 min-h-[40px] leading-tight mb-4">
      {shipment.itemDescription}
    </p>

    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
      <div className="flex flex-col">
        <span className="text-[8px] font-black text-gray-400 uppercase">Weight</span>
        <span className="text-xs font-bold text-gray-700">{shipment.intake_weight || '—'} kg</span>
      </div>
      
      <div className="flex items-center gap-2">
        {shipment.isFlagged && (
          <div className="h-6 w-6 bg-red-50 text-red-600 rounded-lg flex items-center justify-center animate-pulse">
            <ShieldAlert size={14} />
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
           <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
           <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">
             {shipment.status.replace(/_/g, ' ')}
           </span>
        </div>
      </div>
    </div>
  </div>
);