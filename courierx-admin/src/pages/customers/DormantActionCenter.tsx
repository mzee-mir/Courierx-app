import { useQuery } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { userService } from '../../api/user.service';
import { 
  ChevronLeft, UserMinus, Phone, 
  MessageSquare, Calendar, DollarSign, 
  Loader2, ExternalLink, Mail
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

export const DormantActionCenter = () => {
  const [searchParams] = useSearchParams();
  
  const { data, isLoading } = useQuery(['dormantList', searchParams.toString()], () => 
    userService.getDormant(Object.fromEntries(searchParams))
  );

  const handleActionClick = (type: string, name: string) => {
    toast.info(`Opening ${type} for ${name}. Remember to log the result!`);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/customers" className="text-xs font-bold text-gray-600 pb-5 flex items-center gap-1 hover:text-brand transition-colors">
            <ChevronLeft size={14} /> Back to Insights
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserMinus className="text-amber-500" /> Dormant VIP Action Center
          </h1>
          <p className="text-sm text-gray-500">High-value users ($20) who haven't ordered in 30+ days.</p>
        </div>
      </div>

      {/* 2. Retention Workforce Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Customer Details</th>
              <th className="px-6 py-4">Days Silent</th>
              <th className="px-6 py-4">Prior Loyalty (LTV)</th>
              <th className="px-6 py-4">Last Activity</th>
              <th className="px-6 py-4 text-right">Win-Back Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.data.map((item: any) => (
              <tr key={item._id} className="hover:bg-amber-50/10 transition-colors group">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-gray-900">{item.user.displayName}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.user.phoneNumber}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                    {formatDistanceToNow(new Date(item.lastActivity))} silent
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-900">${item.totalLifetimeSpent.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400">{item.totalOrders} total orders</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500">
                  {format(new Date(item.lastActivity), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    {/* PHONE CALL ACTION */}
                    <a 
                      href={`tel:${item.user.phoneNumber}`}
                      onClick={() => handleActionClick('Call', item.user.displayName)}
                      className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-all"
                      title="Call User"
                    >
                      <Phone size={16} />
                    </a>
                    
                    {/* WHATSAPP ACTION */}
                    <button 
                      onClick={() => {
                        handleActionClick('WhatsApp', item.user.displayName);
                        window.open(`https://wa.me/${item.user.phoneNumber.replace('+', '')}?text=Hi%20${item.user.displayName},%20we%20missed%20you%20at%20CourierX!`, '_blank');
                      }}
                      className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-brand hover:border-blue-200 hover:bg-blue-50 transition-all"
                      title="Send WhatsApp"
                    >
                      <MessageSquare size={16} />
                    </button>

                    {/* DEEP PROFILE LINK */}
                    <Link 
                      to={`/customers/${item._id}`}
                      className="p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-gray-900 transition-all"
                      title="View Full History"
                    >
                      <ExternalLink size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data?.data.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-2">
            <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-2">
               <Calendar size={24} />
            </div>
            <p className="text-gray-900 font-bold">Your bucket is not leaking!</p>
            <p className="text-sm text-gray-400">All high-value customers have been active in the last 30 days.</p>
          </div>
        )}
      </div>

      {/* 3. Operational Tip Card */}
      <div className="bg-blue-600 rounded-2xl p-6 text-white flex items-center justify-between shadow-lg shadow-blue-100">
        <div className="space-y-1">
          <h3 className="font-bold text-lg">Retention Pro-Tip</h3>
          <p className="text-blue-100 text-sm max-w-xl">
            A 5-minute phone call to a dormant VIP is 10x more effective than a generic push notification. 
            Ask if they had a bad experience with their last driver.
          </p>
        </div>
        <DollarSign size={48} className="opacity-20" />
      </div>
    </div>
  );
};