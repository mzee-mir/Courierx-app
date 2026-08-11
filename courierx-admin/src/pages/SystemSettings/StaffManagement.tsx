import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { staffService } from '../../api/staff.service';
import { userService } from '../../api/user.service';
import { 
  UserPlus, User as UserIcon, Loader2, 
  Edit2, Trash2, X, ShieldCheck, ShieldOff,
  Mail, Key, Shield, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { SudoChallengeModal } from '../../components/auth/SudoChallengeModal';
import { UserRole } from '../../types/user';
import { useSudo } from '../../store/SudoContext';

// --- SUB-COMPONENT: SYSTEM PROTECTOR BADGE ---
const SystemProtectorBadge = () => (
  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg animate-pulse">
    <ShieldCheck size={12} className="text-amber-600" />
    <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter">
      System Protector
    </span>
  </div>
);

export const StaffManagement = () => {
  const queryClient = useQueryClient();
  const { requireSudo } = useSudo();
  const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

  // --- UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    displayName: '', email: '', password: '', role: UserRole.SUPPORT_ADMIN as UserRole 
  });

  // --- SUDO CONFIG ---
  const [sudoConfig, setSudoConfig] = useState<{
    isOpen: boolean;
    action: 'DELETE' | 'TERMINATE' | null;
    targetId: string;
    targetName: string;
  }>({ isOpen: false, action: null, targetId: '', targetName: '' });

  // --- DATA FETCHING ---
  const { data: staff, isLoading } = useQuery('staffMembers', staffService.getStaff);

  // --- INVARIANT CALCULATIONS (The Highlander Rule) ---
  const superAdminCount = useMemo(() => 
    staff?.filter((m: any) => m.roles.includes(UserRole.SUPER_ADMIN)).length || 0,
  [staff]);

  // --- MUTATIONS ---
  const handleSuccess = (msg: string) => {
    queryClient.invalidateQueries('staffMembers');
    toast.success(msg);
    closeModal();
  };

  const createMutation = useMutation(staffService.createStaff, { 
    onSuccess: () => handleSuccess('New administrator onboarded') 
  });

  const updateMutation = useMutation(
    (data: any) => staffService.updateStaff(editId!, data), 
    { onSuccess: () => handleSuccess('Staff permissions updated') }
  );

  const deleteMutation = useMutation(staffService.deleteStaff, { 
    onSuccess: () => {
      queryClient.invalidateQueries('staffMembers');
      toast.success('Account permanently purged');
      setSudoConfig({ ...sudoConfig, isOpen: false });
    }
  });

  const terminateMutation = useMutation(userService.terminateSessions, {
    onSuccess: () => {
      toast.success('Global session termination executed');
      setSudoConfig({ ...sudoConfig, isOpen: false });
    }
  });

  // --- HANDLERS ---
  const handleUpdateAction = () => {
    // Prevent last Super Admin from demoting themselves
    const targetMember = staff.find((m: any) => m.id === editId);
    const wasSuper = targetMember?.roles.includes(UserRole.SUPER_ADMIN);
    const isChangingToNotSuper = formData.role !== UserRole.SUPER_ADMIN;

    if (wasSuper && isChangingToNotSuper && superAdminCount === 1) {
      toast.error('INVARIANT VIOLATION', {
        description: 'You cannot demote the last remaining Super Admin. System requires a Protector.'
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  const openEditModal = (member: any) => {
    setEditId(member.id);
    setFormData({ 
      displayName: member.displayName, 
      email: member.email, 
      password: '', 
      role: member.roles[0] 
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ displayName: '', email: '', password: '', role: UserRole.SUPPORT_ADMIN });
  };

  const initiateDelete = (id: string, name: string) => {
    setSudoConfig({ isOpen: true, action: 'DELETE', targetId: id, targetName: name });
  };

  const initiateTerminate = (id: string, name: string) => {
    setSudoConfig({ isOpen: true, action: 'TERMINATE', targetId: id, targetName: name });
  };

  const onSudoSuccess = () => {
    if (sudoConfig.action === 'DELETE') deleteMutation.mutate(sudoConfig.targetId);
    if (sudoConfig.action === 'TERMINATE') terminateMutation.mutate(sudoConfig.targetId);
  };

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Administrative Staff</h1>
          <p className="text-sm text-gray-500 font-mono">Governing {staff?.length || 0} active authorities.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
        >
          <UserPlus size={18} /> Onboard Staff
        </button>
      </div>

      {/* STAFF TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">
              <th className="px-8 py-6">Administrator</th>
              <th className="px-8 py-6">Access Tier</th>
              <th className="px-8 py-6 text-right">Security Operations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand" /></td></tr>
            ) : staff?.map((member: any) => {
              const isSuperAdmin = member.roles.includes(UserRole.SUPER_ADMIN);
              const isLastSuperAdmin = isSuperAdmin && superAdminCount === 1;
              const isSelf = member.id === currentUser.id;

              return (
                <tr key={member.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-brand group-hover:text-white transition-colors">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{member.displayName} {isSelf && "(You)"}</p>
                          {isLastSuperAdmin && <SystemProtectorBadge />}
                        </div>
                        <p className="text-xs text-gray-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                      isSuperAdmin ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-brand border-blue-100'
                    }`}>
                      {member.roles[0].replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right space-x-2">
                    {/* TERMINATE SESSIONS */}
                    <button 
                      disabled={isSelf}
                      onClick={() => initiateTerminate(member.id, member.displayName)}
                      className={`p-2.5 rounded-xl transition-all ${isSelf ? 'text-gray-200' : 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'}`}
                      title="Force Global Logout"
                    >
                      <ShieldOff size={18} />
                    </button>
                    {/* EDIT */}
                    <button onClick={() => openEditModal(member)} className="p-2.5 text-gray-400 hover:text-brand hover:bg-blue-50 rounded-xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    {/* DELETE: Disabled if last admin or self */}
                    <button 
                      disabled={isLastSuperAdmin || isSelf}
                      onClick={() => initiateDelete(member.id, member.displayName)} 
                      className={`p-2.5 rounded-xl transition-all ${
                        (isLastSuperAdmin || isSelf) ? 'text-gray-100 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL: CREATE/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">
                {editId ? 'Modify Authority' : 'Onboard Administrator'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="space-y-4 text-gray-700">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
                 <input type="text" value={formData.displayName} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold"
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                 <input type="email" value={formData.email} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold"
                  onChange={(e) => setFormData({...formData, email: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{editId ? 'New Password (Optional)' : 'Secure Password'}</label>
                 <input type="password" value={formData.password} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold"
                  onChange={(e) => setFormData({...formData, password: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Role</label>
                 <select value={formData.role} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold appearance-none"
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}>
                    <option value={UserRole.SUPPORT_ADMIN}>Support Administrator</option>
                    <option value={UserRole.OPS_ADMIN}>Operations Manager</option>
                    <option value={UserRole.FINANCE_ADMIN}>Finance Manager</option>
                    <option value={UserRole.SUPER_ADMIN}>Super Administrator</option>
                 </select>
               </div>
            </div>

            <button 
              onClick={editId ? handleUpdateAction : () => createMutation.mutate(formData)}
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 flex justify-center"
            >
              {createMutation.isLoading || updateMutation.isLoading ? <Loader2 className="animate-spin" /> : (editId ? 'Commit Changes' : 'Authorize Admin')}
            </button>
          </div>
        </div>
      )}

      {/* SUDO CHALLENGE MODAL */}
      <SudoChallengeModal
        isOpen={sudoConfig.isOpen}
        onClose={() => setSudoConfig({ ...sudoConfig, isOpen: false })}
        onSuccess={onSudoSuccess}
        actionName={`${sudoConfig.action === 'DELETE' ? 'Account Deletion' : 'Session Termination'} for ${sudoConfig.targetName}`}
      />
    </div>
  );
};