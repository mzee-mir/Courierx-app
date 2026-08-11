import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useState } from 'react';
import { useLiveTracking } from '../../hooks/useLiveTracking';

const containerStyle = { width: '100%', height: '600px' };
const center = { lat: 2.0469, lng: 45.3182 }; // Mogadishu center

export const LiveOperationsMap = () => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.GOOGLE_AUTH_DOMAIN // 👈 Add your key
  });

  const { driverLocations } = useLiveTracking();
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      options={{
        styles: mapStyles, // Add custom styles to make it look "Techy"
        disableDefaultUI: false,
      }}
    >
      {Object.entries(driverLocations).map(([id, pos]: [string, any]) => (
        <MarkerF
          key={id}
          position={{ lat: pos.lat, lng: pos.lng }}
          icon={{
            url: '/images/marker-bajaj.png', // Or a Lucide SVG string
            scaledSize: new google.maps.Size(40, 40)
          }}
          onClick={() => setSelectedDriver({ id, ...pos })}
        />
      ))}

      {selectedDriver && (
        <InfoWindowF
          position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
          onCloseClick={() => setSelectedDriver(null)}
        >
          <div className="p-2">
            <p className="font-bold text-sm">Driver ID: {selectedDriver.id.slice(-6)}</p>
            <p className="text-[10px] text-gray-500">Last update: {new Date(selectedDriver.lastSeen).toLocaleTimeString()}</p>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
};

// Optional: Minimalist map style
const mapStyles = [
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] }
];