import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userService } from '../../api/user.service';
import { Link as RouterLink } from 'react-router-dom';
import { Search, Ban, CheckCircle, User as UserIcon, Filter, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ActionConfirmModal } from '../../components/ui/ActionConfirmModal';
import { Permission } from '../../config/permissions';
import { PermissionGuard } from '../../components/auth/PermissionGuard';

export const UserDirectory = () => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; currentStatus: boolean } | null>(null);

  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; userId: string | null }>({
    isOpen: false,
    userId: null
  });

  const { data, isLoading } = useQuery(['users', role, search, page], () => 
    userService.getUsers({ role, search, page }), 
    { keepPreviousData: true }
  );

    const statusMutation = useMutation(
    ({ id, suspended, reason }: { id: string, suspended: boolean, reason: string }) => 
      userService.toggleStatus(id, suspended, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users'); // This refreshes the list!
        toast.success('User status updated');
        setIsModalOpen(false);
      },
      onError: () => toast.error('Failed to update status')
    }
  );

  const handleConfirmSuspension = async (reason: string) => {
    if (!modalConfig.userId) return;
    
    // Call your API
    await statusMutation.mutateAsync({ 
      id: modalConfig.userId, 
      suspended: true, 
      reason 
    });
    
    setModalConfig({ isOpen: false, userId: null });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">User Directory</h1>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or phone number..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="bg-gray-50 border border-gray-100 rounded-xl px-4 outline-none focus:ring-2 focus:ring-brand text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="driver">Drivers</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">User</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Roles</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand" /></td></tr>
            ) : data?.users.map((user: any) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  {/* Avatar Section */}
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 overflow-hidden">
                    {user.imageUrl ? (
                      <img src={user.imageUrl} className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>

                  {/* Name and ID Section */}
                  <div className="flex flex-col min-w-0">
                    <RouterLink
                      to={user.roles.includes('driver') ? `/drivers/${user.id}` : `/customers/${user._id}`}
                      className="text-brand text-sm hover:underline flex items-center gap-1 min-w-0"
                    >
                      <LinkIcon size={14} className="shrink-0" />
                      <span className="truncate font-bold">
                        {user.displayName && user.displayName.trim() !== ""
                          ? user.displayName
                          : `User (${user.phoneNumber || 'No Name'})`
                        }
                      </span>
                    </RouterLink>
                    <p className="text-[10px] text-gray-400 font-mono truncate">ID: {user.id}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.phoneNumber}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {user.roles.map((r: string) => (
                      <span key={r} className="px-2 py-0.5 rounded-md bg-blue-50 text-brand text-[10px] font-bold uppercase">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.isSuspended ? (
                    <span className="text-red-500 flex items-center gap-1 text-xs font-bold">
                      <Ban size={14} /> Suspended
                    </span>
                  ) : (
                    <span className="text-green-500 flex items-center gap-1 text-xs font-bold">
                      <CheckCircle size={14} /> Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <PermissionGuard permission={Permission.INTERVENE_ORDERS}>
                    <button 
                    onClick={() => {
                      setSelectedUser({ id: user.id, currentStatus: user.isSuspended });
                      setIsModalOpen(true);
                    }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                      user.isSuspended 
                      ? 'border-green-200 text-green-600 hover:bg-green-50' 
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {user.isSuspended ? 'Reactivate' : 'Suspend'}
                  </button>
                  </PermissionGuard>
                  
                  <ActionConfirmModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={selectedUser?.currentStatus ? "Reactivate Account" : "Suspend Account"}
                    description={selectedUser?.currentStatus 
                      ? "This will allow the user to access the platform again." 
                      : "This will block the user from logging in or making any requests."}
                    confirmText={selectedUser?.currentStatus ? "Activate" : "Suspend"}
                    isDestructive={!selectedUser?.currentStatus}
                    isLoading={statusMutation.isLoading}
                    onConfirm={(reason) => {
                      if (selectedUser) {
                        statusMutation.mutate({ 
                          id: selectedUser.id, 
                          suspended: !selectedUser.currentStatus, 
                          reason 
                        });
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
      </div>

    </div>
  );
};