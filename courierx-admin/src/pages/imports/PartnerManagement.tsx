import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { importService } from '../../api/import.service';
import { Building2, MapPin, Plus, Globe, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';

export const PartnerManagement = () => {
  const queryClient = useQueryClient();
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);

  const { data: orgs, isLoading } = useQuery('importOrgs', importService.getOrganizations);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono uppercase tracking-tighter">Logistics Partners</h1>
          <p className="text-sm text-gray-500 font-mono">Manage Organizations and Physical Custody Nodes.</p>
        </div>
        <button 
          onClick={() => setIsOrgModalOpen(true)}
          className="bg-brand text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"
        >
          <Plus size={18} /> Onboard Partner
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {isLoading ? <Loader2 className="animate-spin" /> : orgs?.map((org: any) => (
          <div key={org.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-50 rounded-xl text-brand border border-gray-100">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{org.name}</h3>
                  <div className="flex gap-2 mt-1">
                    {org.operatingCountries.map((c: string) => (
                      <span key={c} className="text-[10px] font-black bg-blue-50 text-brand px-1.5 py-0.5 rounded border border-blue-100">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                org.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {org.status}
              </span>
            </div>

            {/* Sub-Locations managed by this Org */}
            <div className="pt-4 border-t border-gray-50">
               <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest flex items-center gap-2">
                 <MapPin size={12}/> Physical Locations
               </h4>
               <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs hover:bg-gray-100 transition-colors cursor-pointer">
                    <div>
                      <p className="font-bold text-gray-700">Guangzhou East Hub</p>
                      <p className="text-gray-400">WAREHOUSE • China</p>
                    </div>
                    <ShieldCheck size={14} className="text-green-500" />
                  </div>
                  
                  {/* ... Map real locations here ... */}
                  <PermissionGuard permission={Permission.ONBOARD_PARTNERS}>
                    <button className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-[10px] font-bold text-gray-400 hover:text-brand hover:border-brand transition-all">
                      + Add New physical Node
                    </button>
                  </PermissionGuard>
                  
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};