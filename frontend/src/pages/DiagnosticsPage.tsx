import { useState } from 'react';
import { 
  runComprehensiveDiagnostics,
  testDeviceDetectionWithoutFilters,
  analyzeUSBDevice,
  type USBDeviceDiagnostics
} from '@utils/usb-diagnostics';

interface DiagnosticsResult {
  webUSBSupported: boolean;
  originCompatible: boolean;
  pairedDevices: USBDeviceDiagnostics[];
  originInfo: {
    isCompatible: boolean;
    currentOrigin: string;
    issues: string[];
    suggestions: string[];
  };
  browserInfo: {
    userAgent: string;
    vendor: string;
  };
}

export default function DiagnosticsPage() {
  const [diagnosticsResult, setDiagnosticsResult] = useState<DiagnosticsResult | null>(null);
  const [selectedDeviceDiag, setSelectedDeviceDiag] = useState<USBDeviceDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runComprehensiveDiagnostics();
      setDiagnosticsResult(result);
      console.log('Diagnostics completed:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Diagnostics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testWithoutFilters = async () => {
    setLoading(true);
    setError(null);
    setSelectedDeviceDiag(null);
    try {
      const result = await testDeviceDetectionWithoutFilters();
      
      if (result.success && result.devices.length > 0) {
        // Analyze the first selected device
        const diag = await analyzeUSBDevice(result.devices[0]);
        setSelectedDeviceDiag(diag);
        console.log('Device analysis:', diag);
      } else {
        setError(result.error || 'No device selected');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Device selection error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">USB Diagnostics</h1>
      
      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>System Diagnostics</h2>
        <p style={{ marginBottom: '15px' }}>
          Run comprehensive diagnostics to check WebUSB support, origin compatibility, 
          and analyze any paired USB devices.
        </p>
        
        <button 
          onClick={runDiagnostics}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            color: 'black',
            border: '2px solid black',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Running...' : 'Run System Diagnostics'}
        </button>
      </div>

      <div style={{ 
        padding: '20px', 
        border: '1px solid black',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Device Detection Test</h2>
        <p style={{ marginBottom: '15px' }}>
          Test device detection without vendor filters. This will show ALL WebUSB-compatible 
          devices and analyze the selected one.
        </p>
        
        <button 
          onClick={testWithoutFilters}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            color: 'black',
            border: '2px solid black',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Detecting...' : 'Detect Any Device'}
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '20px',
          border: '1px solid black',
          backgroundColor: '#f0f0f0',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {diagnosticsResult && (
        <div style={{ 
          padding: '20px',
          border: '1px solid black',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>System Diagnostics Results</h2>
          
          <div style={{ marginBottom: '15px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Environment</h3>
            <div><strong>WebUSB Supported:</strong> {diagnosticsResult.webUSBSupported ? '✓ Yes' : '✗ No'}</div>
            <div><strong>Origin Compatible:</strong> {diagnosticsResult.originCompatible ? '✓ Yes' : '✗ No'}</div>
            <div><strong>Current Origin:</strong> {diagnosticsResult.originInfo.currentOrigin}</div>
            <div><strong>Browser:</strong> {diagnosticsResult.browserInfo.vendor}</div>
          </div>

          {diagnosticsResult.originInfo.issues.length > 0 && (
            <div style={{ 
              marginBottom: '15px',
              padding: '10px',
              border: '1px solid black',
              backgroundColor: '#f0f0f0'
            }}>
              <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>Origin Issues:</h4>
              <ul style={{ marginLeft: '20px' }}>
                {diagnosticsResult.originInfo.issues.map((issue: string, idx: number) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
              {diagnosticsResult.originInfo.suggestions.length > 0 && (
                <>
                  <h4 style={{ fontSize: '14px', marginTop: '10px', marginBottom: '5px' }}>Suggestions:</h4>
                  <ul style={{ marginLeft: '20px' }}>
                    {diagnosticsResult.originInfo.suggestions.map((suggestion: string, idx: number) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {diagnosticsResult.pairedDevices.length > 0 && (
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>
                Paired Devices ({diagnosticsResult.pairedDevices.length})
              </h3>
              {diagnosticsResult.pairedDevices.map((device: USBDeviceDiagnostics, idx: number) => (
                <DeviceDiagnosticsDisplay key={idx} device={device} />
              ))}
            </div>
          )}

          {diagnosticsResult.pairedDevices.length === 0 && (
            <div style={{ fontStyle: 'italic' }}>
              No paired devices found. Use "Detect Any Device" to pair a device for analysis.
            </div>
          )}
        </div>
      )}

      {selectedDeviceDiag && (
        <div style={{ 
          padding: '20px',
          border: '1px solid black',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Selected Device Analysis</h2>
          <DeviceDiagnosticsDisplay device={selectedDeviceDiag} />
        </div>
      )}

      <div style={{ 
        padding: '20px',
        border: '1px solid black',
        backgroundColor: '#f0f0f0'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Troubleshooting Guide</h2>
        
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Common Issues</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>1. "No compatible devices found"</h4>
          <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
            <li>Device is not plugged in</li>
            <li>Device vendor ID doesn't match the filter (0x096E or 0x311F for Feitian)</li>
            <li>Device only exposes HID/CCID interfaces (not WebUSB-compatible)</li>
          </ul>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>2. WebUSB not supported</h4>
          <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
            <li>Use a Chromium-based browser (Chrome, Edge, Opera)</li>
            <li>Ensure you're on HTTPS or localhost</li>
            <li>Not available on file:// protocol</li>
          </ul>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>3. Device has only HID/CCID interfaces</h4>
          <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
            <li>WebUSB cannot claim HID (0x03) or CCID (0x0B) interfaces</li>
            <li>These are reserved by the operating system</li>
            <li>Consider using WebHID API instead of WebUSB</li>
            <li>Some Feitian models may require firmware update for WebUSB support</li>
          </ul>
        </div>

        <h3 style={{ fontSize: '16px', marginBottom: '10px', marginTop: '20px' }}>How to Use Diagnostics</h3>
        <ol style={{ marginLeft: '20px' }}>
          <li>Click "Run System Diagnostics" to check your browser and environment</li>
          <li>Click "Detect Any Device" and select your Feitian key when prompted</li>
          <li>Review the device analysis to see interface types and compatibility</li>
          <li>Check the "Recommended Transport" field for guidance</li>
        </ol>
      </div>
    </div>
  );
}

interface DeviceDiagnosticsDisplayProps {
  device: USBDeviceDiagnostics;
}

function DeviceDiagnosticsDisplay({ device }: DeviceDiagnosticsDisplayProps) {
  return (
    <div style={{ 
      padding: '15px',
      border: '1px solid black',
      marginBottom: '15px'
    }}>
      <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>
        {device.productName || 'Unknown Device'}
      </h4>
      
      <div style={{ marginBottom: '10px' }}>
        <div><strong>Vendor ID:</strong> 0x{device.vendorId.toString(16).toUpperCase()}</div>
        <div><strong>Product ID:</strong> 0x{device.productId.toString(16).toUpperCase()}</div>
        {device.serialNumber && <div><strong>Serial:</strong> {device.serialNumber}</div>}
        {device.manufacturerName && <div><strong>Manufacturer:</strong> {device.manufacturerName}</div>}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>WebUSB Compatible:</strong> {device.hasWebUSBCompatibleInterface ? '✓ Yes' : '✗ No'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Recommended Transport:</strong> {device.recommendedTransport}
      </div>

      {device.configurations.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Interfaces:</strong>
          {device.configurations.map((config, cidx) => (
            <div key={cidx} style={{ marginLeft: '10px', marginTop: '5px' }}>
              {config.interfaces.map((iface, iidx) => (
                <div key={iidx} style={{ 
                  marginBottom: '5px',
                  padding: '5px',
                  backgroundColor: iface.isWebUSBCompatible ? '#e0ffe0' : '#ffe0e0'
                }}>
                  <div>
                    Interface {iface.interfaceNumber}: {iface.className} (0x{iface.interfaceClass.toString(16).toUpperCase()})
                    {iface.isWebUSBCompatible && ' ✓'}
                  </div>
                  {iface.endpoints.length > 0 && (
                    <div style={{ fontSize: '12px', marginLeft: '10px' }}>
                      Endpoints: {iface.endpoints.map(ep => 
                        `${ep.direction.toUpperCase()} #${ep.endpointNumber}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {device.issues.length > 0 && (
        <div style={{ 
          marginTop: '10px',
          padding: '10px',
          border: '1px solid black',
          backgroundColor: '#ffe0e0'
        }}>
          <strong>Issues:</strong>
          <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
            {device.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {device.suggestions.length > 0 && (
        <div style={{ 
          marginTop: '10px',
          padding: '10px',
          border: '1px solid black',
          backgroundColor: '#e0e0ff'
        }}>
          <strong>Suggestions:</strong>
          <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
            {device.suggestions.map((suggestion, idx) => (
              <li key={idx}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
