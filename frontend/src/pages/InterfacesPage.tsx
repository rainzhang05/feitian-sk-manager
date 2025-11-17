import { useState, useEffect } from 'react';
import { 
  transportManager, 
  checkWebUSBSupport, 
  checkWebHIDSupport,
  type DetectedDevice,
  type DeviceInfo 
} from '@services/transport';

export default function InterfacesPage() {
  const [usbDevices, setUsbDevices] = useState<DetectedDevice[]>([]);
  const [hidDevices, setHidDevices] = useState<DetectedDevice[]>([]);
  const [connected, setConnected] = useState(() => transportManager.isConnected);
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(() => transportManager.getCurrentDevice());
  const [status, setStatus] = useState(() => {
    const device = transportManager.getCurrentDevice();
    if (device) {
      return `Connected via ${device.type.toUpperCase()}: ${device.productName || 'Unknown device'}`;
    }
    return 'No device connected';
  });
  const [error, setError] = useState<string | null>(null);
  const [packets, setPackets] = useState<Array<{ direction: 'in' | 'out'; data: string; timestamp: number }>>([]);

  // Check for WebUSB and WebHID support
  const usbSupported = checkWebUSBSupport();
  const hidSupported = checkWebHIDSupport();

  const scanDevices = async () => {
    try {
      const detected = await transportManager.scanTransports();
      setUsbDevices(detected.filter(d => d.type === 'usb'));
      setHidDevices(detected.filter(d => d.type === 'hid'));
      console.log('Scanned devices:', detected);
    } catch (err) {
      console.error('Failed to scan devices:', err);
    }
  };

  const addPacket = (direction: 'in' | 'out', data: Uint8Array) => {
    const hex = Array.from(data)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    setPackets(prev => [...prev.slice(-50), { direction, data: hex, timestamp: Date.now() }]);
  };

  // Scan for devices on mount
  useEffect(() => {
    // Initial scan wrapper
    const initialScan = async () => {
      try {
        const detected = await transportManager.scanTransports();
        setUsbDevices(detected.filter(d => d.type === 'usb'));
        setHidDevices(detected.filter(d => d.type === 'hid'));
        console.log('Scanned devices:', detected);
      } catch (err) {
        console.error('Failed to scan devices:', err);
      }
    };
    void initialScan();

    // Setup transport event listeners
    transportManager.onConnect((info) => {
      setConnected(true);
      setCurrentDevice(info);
      setStatus(`Connected via ${info.type.toUpperCase()}: ${info.productName || 'Unknown device'}`);
      setError(null);
    });

    transportManager.onDisconnect(() => {
      setConnected(false);
      setCurrentDevice(null);
      setStatus('Device disconnected');
    });

    // Setup data listener for packet inspection
    if (transportManager.isConnected) {
      transportManager.onData((data) => {
        addPacket('in', data);
      });
    }
  }, []);

  const handleRequestUSB = async () => {
    setError(null);
    setStatus('Requesting USB device...');
    try {
      const device = await transportManager.requestAndConnectUSB();
      if (!device) {
        setStatus('No device selected');
      }
      await scanDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('Connection failed');
      console.error('USB connection error:', err);
    }
  };

  const handleRequestHID = async () => {
    setError(null);
    setStatus('Requesting HID device...');
    try {
      const device = await transportManager.requestAndConnectHID();
      if (!device) {
        setStatus('No device selected');
      }
      await scanDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('Connection failed');
      console.error('HID connection error:', err);
    }
  };

  const handleConnectDevice = async (device: DetectedDevice) => {
    setError(null);
    setStatus(`Connecting to ${device.type.toUpperCase()} device...`);
    try {
      if (device.type === 'usb') {
        await transportManager.connectUSB(device.device as USBDevice);
      } else {
        await transportManager.connectHID(device.device as HIDDevice);
      }
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
      await transportManager.disconnect();
      setStatus('Disconnected');
      setPackets([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Disconnect error:', err);
    }
  };

  const handleSendHex = async () => {
    const input = prompt('Enter hex data to send (space-separated):');
    if (!input) return;

    try {
      const bytes = input.split(/\s+/).map(h => parseInt(h, 16));
      const data = new Uint8Array(bytes);
      await transportManager.send(data);
      addPacket('out', data);
      setStatus(`Sent ${bytes.length} bytes`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Send error:', err);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Interface Management</h1>

      {/* Status Section */}
      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Connection Status</h2>
        <div style={{ marginBottom: '10px' }}>
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

        {currentDevice && (
          <div style={{ marginBottom: '15px' }}>
            <div><strong>Transport:</strong> {currentDevice.type.toUpperCase()}</div>
            <div><strong>Device:</strong> {currentDevice.productName || 'Unknown'}</div>
            <div><strong>Vendor ID:</strong> 0x{currentDevice.vendorId.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div><strong>Product ID:</strong> 0x{currentDevice.productId.toString(16).toUpperCase().padStart(4, '0')}</div>
            {currentDevice.serialNumber && (
              <div><strong>Serial:</strong> {currentDevice.serialNumber}</div>
            )}
          </div>
        )}

        {connected && (
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

      {/* WebUSB Devices Section */}
      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>WebUSB Devices</h2>
        
        {!usbSupported && (
          <p style={{ fontStyle: 'italic', color: '#666' }}>
            WebUSB is not supported in this browser
          </p>
        )}

        {usbSupported && (
          <>
            <button
              onClick={handleRequestUSB}
              disabled={connected}
              style={{
                padding: '10px 20px',
                backgroundColor: connected ? '#f0f0f0' : 'white',
                color: 'black',
                border: '2px solid black',
                cursor: connected ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '15px'
              }}
            >
              Request USB Device
            </button>

            {usbDevices.length === 0 ? (
              <p style={{ fontStyle: 'italic' }}>No paired USB devices found</p>
            ) : (
              <div style={{ marginTop: '15px' }}>
                {usbDevices.map((device, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '10px',
                      border: '1px solid #ccc',
                      marginBottom: '10px'
                    }}
                  >
                    <div><strong>{device.info.productName || 'Unknown Device'}</strong></div>
                    <div style={{ fontSize: '12px' }}>
                      VID: 0x{device.info.vendorId.toString(16).toUpperCase().padStart(4, '0')} | 
                      PID: 0x{device.info.productId.toString(16).toUpperCase().padStart(4, '0')}
                    </div>
                    <button
                      onClick={() => handleConnectDevice(device)}
                      disabled={connected}
                      style={{
                        marginTop: '10px',
                        padding: '5px 15px',
                        backgroundColor: connected ? '#f0f0f0' : 'white',
                        border: '1px solid black',
                        cursor: connected ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* WebHID Devices Section */}
      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>WebHID Devices</h2>
        
        {!hidSupported && (
          <p style={{ fontStyle: 'italic', color: '#666' }}>
            WebHID is not supported in this browser
          </p>
        )}

        {hidSupported && (
          <>
            <button
              onClick={handleRequestHID}
              disabled={connected}
              style={{
                padding: '10px 20px',
                backgroundColor: connected ? '#f0f0f0' : 'white',
                color: 'black',
                border: '2px solid black',
                cursor: connected ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '15px'
              }}
            >
              Request HID Device
            </button>

            {hidDevices.length === 0 ? (
              <p style={{ fontStyle: 'italic' }}>No paired HID devices found</p>
            ) : (
              <div style={{ marginTop: '15px' }}>
                {hidDevices.map((device, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '10px',
                      border: '1px solid #ccc',
                      marginBottom: '10px'
                    }}
                  >
                    <div><strong>{device.info.productName || 'Unknown Device'}</strong></div>
                    <div style={{ fontSize: '12px' }}>
                      VID: 0x{device.info.vendorId.toString(16).toUpperCase().padStart(4, '0')} | 
                      PID: 0x{device.info.productId.toString(16).toUpperCase().padStart(4, '0')}
                    </div>
                    <button
                      onClick={() => handleConnectDevice(device)}
                      disabled={connected}
                      style={{
                        marginTop: '10px',
                        padding: '5px 15px',
                        backgroundColor: connected ? '#f0f0f0' : 'white',
                        border: '1px solid black',
                        cursor: connected ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Debug Packet Inspector */}
      {connected && (
        <div style={{ 
          padding: '20px', 
          border: '1px solid black',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Packet Inspector (Debug)</h2>
          
          <button
            onClick={handleSendHex}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: 'black',
              border: '2px solid black',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '15px'
            }}
          >
            Send Hex Command
          </button>

          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #ccc',
            padding: '10px',
            backgroundColor: '#fafafa',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {packets.length === 0 ? (
              <div style={{ fontStyle: 'italic' }}>No packets captured yet</div>
            ) : (
              packets.map((packet, idx) => (
                <div key={idx} style={{ marginBottom: '5px' }}>
                  <span style={{ 
                    color: packet.direction === 'in' ? 'blue' : 'green',
                    fontWeight: 'bold'
                  }}>
                    {packet.direction === 'in' ? '←' : '→'}
                  </span>
                  {' '}
                  <span style={{ color: '#999' }}>
                    {new Date(packet.timestamp).toLocaleTimeString()}
                  </span>
                  {' '}
                  {packet.data}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
