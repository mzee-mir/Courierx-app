import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AlertOctagon, Phone, MapPin, X, ShieldAlert } from 'lucide-react';

export const SOSOverlay = () => {
  const [alert, setAlert] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const socket = io('http://10.109.125.181:2026', { auth: { token } });

    socket.on('sos_alert', (data) => {
      // Play a loud alert sound
      const audio = new Audio('/sounds/emergency_alarm.mp3');
      audio.play();
      setAlert(data);
    });

    return () => { socket.disconnect(); };
  }, []);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-600/90 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-bounce-short">
        <div className="bg-red-700 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AlertOctagon size={32} className="animate-pulse" />
            <h2 className="text-2xl font-black uppercase italic">Emergency SOS Triggered</h2>
          </div>
          <button onClick={() => setAlert(null)} className="hover:bg-red-800 p-2 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Driver Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Driver in Danger</h3>
            <div>
              <p className="text-xl font-bold">{alert.driver?.displayName}</p>
              <p className="text-red-600 font-bold flex items-center gap-2">
                <Phone size={16} /> {alert.driver?.phoneNumber}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Active Passenger</h3>
            <div>
              <p className="text-xl font-bold">{alert.order?.customerId?.displayName || "N/A"}</p>
              <p className="text-gray-600 flex items-center gap-2">
                <Phone size={16} /> {alert.order?.customerId?.phoneNumber || "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 border-t flex flex-col gap-4">
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="text-red-600" />
            <span className="font-mono text-sm">Coords: {alert.location[1]}, {alert.location[0]}</span>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => window.open(`https://www.google.com/maps?q=${alert.location[1]},${alert.location[0]}`, '_blank')}
              className="flex-1 bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              <MapPin size={20} /> Locate on Google Maps
            </button>
            <button 
              className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <ShieldAlert size={20} /> Dispatch Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};