/**
 * USB Diagnostics Utility
 * 
 * Provides comprehensive diagnostics for WebUSB device detection issues.
 * Helps identify why Feitian security keys are not being detected.
 */

export interface USBInterfaceInfo {
  interfaceNumber: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  className: string;
  isWebUSBCompatible: boolean;
  endpoints: {
    endpointNumber: number;
    direction: string;
    type: string;
    packetSize: number;
  }[];
}

export interface USBDeviceDiagnostics {
  vendorId: number;
  productId: number;
  productName?: string;
  serialNumber?: string;
  manufacturerName?: string;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
  configurations: {
    configurationValue: number;
    configurationName?: string;
    interfaces: USBInterfaceInfo[];
  }[];
  hasWebUSBCompatibleInterface: boolean;
  recommendedTransport: 'WebUSB' | 'WebHID' | 'Unknown';
  issues: string[];
  suggestions: string[];
}

// USB Class Codes
const USB_CLASS_CODES: Record<number, string> = {
  0x00: 'Device',
  0x01: 'Audio',
  0x02: 'Communications',
  0x03: 'HID (Human Interface Device)',
  0x05: 'Physical',
  0x06: 'Image',
  0x07: 'Printer',
  0x08: 'Mass Storage',
  0x09: 'Hub',
  0x0A: 'CDC-Data',
  0x0B: 'Smart Card (CCID)',
  0x0D: 'Content Security',
  0x0E: 'Video',
  0x0F: 'Personal Healthcare',
  0x10: 'Audio/Video',
  0x11: 'Billboard',
  0xDC: 'Diagnostic',
  0xE0: 'Wireless Controller',
  0xEF: 'Miscellaneous',
  0xFE: 'Application Specific',
  0xFF: 'Vendor Specific'
};

/**
 * Get the human-readable class name for a USB interface class code
 */
function getUSBClassName(classCode: number): string {
  return USB_CLASS_CODES[classCode] || `Unknown (0x${classCode.toString(16).toUpperCase()})`;
}

/**
 * Check if an interface is WebUSB compatible
 * WebUSB can only claim vendor-specific (0xFF) interfaces that are not HID or CCID
 */
function isInterfaceWebUSBCompatible(interfaceClass: number): boolean {
  // Only vendor-specific interfaces (0xFF) can be claimed by WebUSB
  if (interfaceClass === 0xFF) {
    return true;
  }
  
  // HID (0x03) and CCID (0x0B) interfaces cannot be claimed by WebUSB
  // They are reserved for the OS
  if (interfaceClass === 0x03 || interfaceClass === 0x0B) {
    return false;
  }
  
  // Other interface classes may or may not be claimable depending on OS
  return false;
}

/**
 * Analyze a USB device and provide comprehensive diagnostics
 */
export async function analyzeUSBDevice(device: USBDevice): Promise<USBDeviceDiagnostics> {
  const diagnostics: USBDeviceDiagnostics = {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
    serialNumber: device.serialNumber,
    manufacturerName: device.manufacturerName,
    deviceClass: device.deviceClass,
    deviceSubclass: device.deviceSubclass,
    deviceProtocol: device.deviceProtocol,
    configurations: [],
    hasWebUSBCompatibleInterface: false,
    recommendedTransport: 'Unknown',
    issues: [],
    suggestions: []
  };

  // Open device to read configurations
  const wasOpened = device.opened;
  try {
    if (!wasOpened) {
      await device.open();
    }

    // Analyze all configurations
    for (let i = 0; i < device.configurations.length; i++) {
      const config = device.configurations[i];
      const configInfo = {
        configurationValue: config.configurationValue,
        configurationName: config.configurationName,
        interfaces: [] as USBInterfaceInfo[]
      };

      // Analyze all interfaces in this configuration
      for (const iface of config.interfaces) {
        for (const alternate of iface.alternates) {
          const interfaceInfo: USBInterfaceInfo = {
            interfaceNumber: iface.interfaceNumber,
            interfaceClass: alternate.interfaceClass,
            interfaceSubclass: alternate.interfaceSubclass,
            interfaceProtocol: alternate.interfaceProtocol,
            className: getUSBClassName(alternate.interfaceClass),
            isWebUSBCompatible: isInterfaceWebUSBCompatible(alternate.interfaceClass),
            endpoints: []
          };

          // Check for WebUSB compatible interfaces
          if (interfaceInfo.isWebUSBCompatible) {
            diagnostics.hasWebUSBCompatibleInterface = true;
          }

          // Analyze endpoints
          for (const endpoint of alternate.endpoints) {
            interfaceInfo.endpoints.push({
              endpointNumber: endpoint.endpointNumber,
              direction: endpoint.direction,
              type: endpoint.type,
              packetSize: endpoint.packetSize
            });
          }

          configInfo.interfaces.push(interfaceInfo);
        }
      }

      diagnostics.configurations.push(configInfo);
    }

    // Determine recommended transport
    if (diagnostics.hasWebUSBCompatibleInterface) {
      diagnostics.recommendedTransport = 'WebUSB';
    } else {
      // Check if device has HID interfaces
      const hasHID = diagnostics.configurations.some(config =>
        config.interfaces.some(iface => iface.interfaceClass === 0x03)
      );
      
      if (hasHID) {
        diagnostics.recommendedTransport = 'WebHID';
        diagnostics.issues.push('Device only exposes HID interfaces, which cannot be claimed by WebUSB');
        diagnostics.suggestions.push('Consider using WebHID API instead of WebUSB for this device');
      } else {
        diagnostics.issues.push('Device does not expose any WebUSB-compatible interfaces');
        diagnostics.suggestions.push('This device may not support WebUSB. Check device firmware or use a different transport method');
      }
    }

    // Additional checks
    if (!diagnostics.hasWebUSBCompatibleInterface) {
      const interfaceTypes = diagnostics.configurations.flatMap(c => 
        c.interfaces.map(i => i.className)
      ).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      
      diagnostics.issues.push(`All interfaces are: ${interfaceTypes}`);
    }

  } catch (error) {
    diagnostics.issues.push(`Failed to analyze device: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (!wasOpened && device.opened) {
      await device.close().catch(() => {
        // Ignore close errors in diagnostics
      });
    }
  }

  return diagnostics;
}

/**
 * Check if the current origin meets WebUSB requirements
 */
export function checkOriginCompatibility(): {
  isCompatible: boolean;
  currentOrigin: string;
  issues: string[];
  suggestions: string[];
} {
  const origin = window.location.origin;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  const result = {
    isCompatible: false,
    currentOrigin: origin,
    issues: [] as string[],
    suggestions: [] as string[]
  };

  // WebUSB requires HTTPS or localhost
  if (protocol === 'https:') {
    result.isCompatible = true;
  } else if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]')) {
    result.isCompatible = true;
  } else if (protocol === 'file:') {
    result.isCompatible = false;
    result.issues.push('WebUSB is not available on file:// protocol');
    result.suggestions.push('Serve the application over HTTP/HTTPS using a web server');
  } else if (protocol === 'http:') {
    result.isCompatible = false;
    result.issues.push('WebUSB requires HTTPS for non-localhost origins');
    result.suggestions.push('Deploy the application with HTTPS or use localhost for development');
  } else {
    result.isCompatible = false;
    result.issues.push(`Unsupported protocol: ${protocol}`);
  }

  return result;
}

/**
 * Test device detection without filters to see all available devices
 */
export async function testDeviceDetectionWithoutFilters(): Promise<{
  success: boolean;
  devices: USBDevice[];
  error?: string;
}> {
  if (!navigator.usb) {
    return {
      success: false,
      devices: [],
      error: 'WebUSB is not supported in this browser'
    };
  }

  try {
    // Request device without any filters - shows all available WebUSB devices
    const device = await navigator.usb.requestDevice({ 
      filters: [] 
    });
    
    return {
      success: true,
      devices: device ? [device] : []
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return {
        success: false,
        devices: [],
        error: 'No devices selected by user or no WebUSB-compatible devices available'
      };
    }
    
    return {
      success: false,
      devices: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get all already-paired USB devices
 */
export async function getPairedDevices(): Promise<USBDevice[]> {
  if (!navigator.usb) {
    return [];
  }

  try {
    return await navigator.usb.getDevices();
  } catch (error) {
    console.error('Failed to get paired devices:', error);
    return [];
  }
}

/**
 * Run comprehensive diagnostics on WebUSB support
 */
export async function runComprehensiveDiagnostics(): Promise<{
  webUSBSupported: boolean;
  originCompatible: boolean;
  pairedDevices: USBDeviceDiagnostics[];
  originInfo: ReturnType<typeof checkOriginCompatibility>;
  browserInfo: {
    userAgent: string;
    vendor: string;
  };
}> {
  const result = {
    webUSBSupported: !!navigator.usb,
    originCompatible: false,
    pairedDevices: [] as USBDeviceDiagnostics[],
    originInfo: checkOriginCompatibility(),
    browserInfo: {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor
    }
  };

  result.originCompatible = result.originInfo.isCompatible;

  // If WebUSB is supported, check for paired devices
  if (result.webUSBSupported) {
    try {
      const devices = await getPairedDevices();
      for (const device of devices) {
        const diagnostics = await analyzeUSBDevice(device);
        result.pairedDevices.push(diagnostics);
      }
    } catch (error) {
      console.error('Failed to analyze paired devices:', error);
    }
  }

  return result;
}
