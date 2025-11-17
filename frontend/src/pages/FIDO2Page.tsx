import { useState, useEffect } from 'react';
import { 
  selectDevice, 
  openDevice, 
  closeDevice, 
  isConnected, 
  getCurrentDevice,
  onConnect,
  onDisconnect,
  type USBDeviceInfo 
} from '@services/webusb';

export default function FIDO2Page() {
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<USBDeviceInfo | null>(null);
  const [status, setStatus] = useState('No device connected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Setup USB event listeners
    onConnect((device) => {
      console.log('Device connected event:', device);
      setStatus(`Device connected: ${device.productName || 'Unknown'}`);
    });

    onDisconnect(() => {
      console.log('Device disconnected event');
      setConnected(false);
      setDeviceInfo(null);
      setStatus('Device disconnected');
    });
  }, []);

  // Check initial connection state separately from useEffect
  useEffect(() => {
    const checkInitialState = () => {
      const isConn = isConnected();
      const current = getCurrentDevice();
      if (isConn && current) {
        setConnected(true);
        setDeviceInfo(current);
        setStatus(`Connected to ${current.productName || 'Unknown device'}`);
      }
    };
    checkInitialState();
  }, []);

  const handleConnect = async () => {
    setError(null);
    setStatus('Requesting device...');

    try {
      // Select device
      const device = await selectDevice();
      if (!device) {
        setStatus('No device selected');
        return;
      }

      setDeviceInfo(device);
      setStatus(`Selected: ${device.productName || 'Unknown device'}`);

      // Open device and claim interface
      setStatus('Opening device...');
      await openDevice();

      setConnected(true);
      setStatus(`Connected to ${device.productName || 'Unknown device'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('Connection failed');
      console.error('Connection error:', err);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setStatus('Disconnecting...');

    try {
      await closeDevice();
      setConnected(false);
      setDeviceInfo(null);
      setStatus('Disconnected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Disconnect error:', err);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">FIDO2 Management</h1>
      
      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>USB Connection</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Status:</strong> <span>{status}</span>
        </div>

        {error && (
          <div style={{ 
            marginBottom: '15px',
            padding: '10px',
            border: '1px solid black',
            backgroundColor: '#f0f0f0'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {deviceInfo && (
          <div style={{ marginBottom: '15px' }}>
            <div><strong>Device:</strong> {deviceInfo.productName || 'Unknown'}</div>
            <div><strong>Vendor ID:</strong> 0x{deviceInfo.vendorId.toString(16).toUpperCase()}</div>
            <div><strong>Product ID:</strong> 0x{deviceInfo.productId.toString(16).toUpperCase()}</div>
            {deviceInfo.serialNumber && (
              <div><strong>Serial:</strong> {deviceInfo.serialNumber}</div>
            )}
          </div>
        )}

        <div>
          {!connected ? (
            <button 
              onClick={handleConnect}
              style={{
                padding: '10px 20px',
                backgroundColor: 'white',
                color: 'black',
                border: '2px solid black',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Connect Device
            </button>
          ) : (
            <button 
              onClick={handleDisconnect}
              style={{
                padding: '10px 20px',
                backgroundColor: 'black',
                color: 'white',
                border: '2px solid black',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        opacity: connected ? 1 : 0.3
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>FIDO2 Operations</h2>
        <p style={{ fontStyle: 'italic' }}>
          {connected 
            ? 'FIDO2 operations will be implemented in Phase 3' 
            : 'Connect a device to access FIDO2 operations'}
        </p>
      </div>
    </div>
  );
}
