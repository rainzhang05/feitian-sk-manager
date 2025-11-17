/**
 * WebUSB Service - USB device communication layer
 * 
 * This service handles:
 * - Device selection and pairing
 * - USB connection management
 * - Raw data transfer to/from WASM module
 */

// WASM module reference - will be loaded dynamically when available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;

// Try to load WASM module
async function loadWasmModule() {
  try {
    // Dynamic import - WASM module will be available in later phases
    // Using Function constructor to avoid TypeScript import checking
    const importWasm = new Function('return import("../../wasm/pkg/index.js")');
    const module = await importWasm().catch(() => null);
    if (module) {
      wasmModule = module;
      if (wasmModule.init) {
        wasmModule.init();
      }
      console.log('WASM module loaded successfully');
    }
  } catch {
    // WASM module not yet built - this is expected in Phase 1
    console.log('WASM module not yet available (will be implemented in Phase 2)');
  }
}

// Initialize WASM on module load (non-blocking)
loadWasmModule();

export interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  productName?: string;
  serialNumber?: string;
}

// Module-level state
let currentDevice: USBDevice | null = null;
let currentInterfaceNumber: number | null = null;
let inEndpoint: number | null = null;
let outEndpoint: number | null = null;
let receiveLoopRunning = false;

// Constants
// Known Feitian vendor IDs (add more as discovered)
const FEITIAN_VENDOR_IDS = [
  0x096E,  // Primary Feitian vendor ID
  0x311F   // Alternative Feitian vendor ID (some models)
];
const DEFAULT_PACKET_SIZE = 64;

/**
 * Check if WebUSB is supported in the current browser
 */
function checkWebUSBSupport(): void {
  if (!navigator.usb) {
    throw new Error(
      'WebUSB is not supported in this browser. ' +
      'Please use a Chromium-based browser (Chrome, Edge, Opera) with HTTPS.'
    );
  }
}

/**
 * Request and select a USB device
 * Opens device selection dialog filtered for Feitian devices
 * 
 * @param allowAnyDevice - If true, allows selecting any USB device (useful for diagnostics)
 */
export async function selectDevice(allowAnyDevice = false): Promise<USBDeviceInfo | null> {
  checkWebUSBSupport();

  if (!navigator.usb) {
    throw new Error('WebUSB not available');
  }

  try {
    // Create filters for all known Feitian vendor IDs
    const filters = allowAnyDevice 
      ? [] // No filter - show all devices
      : FEITIAN_VENDOR_IDS.map(vendorId => ({ vendorId }));

    console.log('Requesting USB device with filters:', filters);
    
    const device = await navigator.usb.requestDevice({ filters });

    currentDevice = device;

    const deviceInfo: USBDeviceInfo = {
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName,
      serialNumber: device.serialNumber
    };

    console.log('USB Device selected:', deviceInfo);
    
    // Warn if device is not a known Feitian device
    if (!allowAnyDevice && !FEITIAN_VENDOR_IDS.includes(device.vendorId)) {
      console.warn(
        `Selected device has vendor ID 0x${device.vendorId.toString(16).toUpperCase()}, ` +
        `which is not a known Feitian vendor ID. ` +
        `Known IDs: ${FEITIAN_VENDOR_IDS.map(id => `0x${id.toString(16).toUpperCase()}`).join(', ')}`
      );
    }
    
    return deviceInfo;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        console.log('No device selected by user or no compatible devices found');
        console.log('Troubleshooting tips:');
        console.log('1. Make sure your device is plugged in');
        console.log('2. Check if the device vendor ID matches:', FEITIAN_VENDOR_IDS.map(id => `0x${id.toString(16).toUpperCase()}`).join(', '));
        console.log('3. Some Feitian devices may only expose HID/CCID interfaces, which are not WebUSB-compatible');
        console.log('4. Try the diagnostic tool to analyze your device');
        return null;
      }
      throw new Error(`Failed to select USB device: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Detect and configure USB endpoints from device configuration
 * Searches across all interfaces to find a vendor-specific interface with endpoints
 */
function detectEndpoints(device: USBDevice): void {
  if (!device.configuration) {
    throw new Error('No USB configuration available');
  }

  console.log('Scanning device interfaces for WebUSB-compatible endpoints...');
  
  // Try to find a vendor-specific (0xFF) interface with endpoints
  for (const iface of device.configuration.interfaces) {
    for (const alternate of iface.alternates) {
      console.log(
        `Interface ${iface.interfaceNumber}, Alternate ${alternate.alternateSetting}: ` +
        `Class=0x${alternate.interfaceClass.toString(16).toUpperCase()}, ` +
        `Subclass=0x${alternate.interfaceSubclass.toString(16).toUpperCase()}, ` +
        `Protocol=0x${alternate.interfaceProtocol.toString(16).toUpperCase()}, ` +
        `Endpoints=${alternate.endpoints.length}`
      );
      
      // Check for HID or CCID interfaces (which cannot be claimed by WebUSB)
      if (alternate.interfaceClass === 0x03) {
        console.warn(`Interface ${iface.interfaceNumber} is HID (class 0x03) - cannot be used with WebUSB`);
        continue;
      }
      if (alternate.interfaceClass === 0x0B) {
        console.warn(`Interface ${iface.interfaceNumber} is CCID (class 0x0B) - cannot be used with WebUSB`);
        continue;
      }
      
      // Look for vendor-specific interfaces (0xFF) or other claimable interfaces
      const isVendorSpecific = alternate.interfaceClass === 0xFF;
      
      // Find IN and OUT endpoints in this interface
      let tempInEndpoint: number | null = null;
      let tempOutEndpoint: number | null = null;
      
      for (const endpoint of alternate.endpoints) {
        if (endpoint.direction === 'in' && !tempInEndpoint) {
          tempInEndpoint = endpoint.endpointNumber;
        } else if (endpoint.direction === 'out' && !tempOutEndpoint) {
          tempOutEndpoint = endpoint.endpointNumber;
        }
      }
      
      // If we found both endpoints, use this interface
      if (tempInEndpoint && tempOutEndpoint) {
        inEndpoint = tempInEndpoint;
        outEndpoint = tempOutEndpoint;
        currentInterfaceNumber = iface.interfaceNumber;
        
        console.log(
          `✓ Selected interface ${iface.interfaceNumber} ` +
          `(${isVendorSpecific ? 'Vendor-Specific' : `Class 0x${alternate.interfaceClass.toString(16)}`}): ` +
          `IN=${inEndpoint}, OUT=${outEndpoint}`
        );
        return;
      }
    }
  }

  // If we get here, no suitable interface was found
  console.error('Failed to find suitable interface with bidirectional endpoints');
  console.error('Device interface classes:', 
    device.configuration.interfaces.map((iface, idx) => {
      const alt = iface.alternates[0];
      return `Interface ${idx}: 0x${alt?.interfaceClass.toString(16).toUpperCase() || '??'}`;
    }).join(', ')
  );
  
  throw new Error(
    'No WebUSB-compatible interface found. ' +
    'This device may only expose HID/CCID interfaces, which cannot be claimed by WebUSB. ' +
    'Consider using WebHID API instead.'
  );
}

/**
 * Open and claim interface on a USB device
 */
export async function openDevice(): Promise<boolean> {
  if (!currentDevice) {
    throw new Error('No device selected. Call selectDevice() first.');
  }

  try {
    // Open the device
    if (!currentDevice.opened) {
      await currentDevice.open();
      console.log('USB Device opened');
    } else {
      console.warn('Device already opened');
    }

    // Select configuration (use existing or default to 1)
    const configValue = currentDevice.configuration?.configurationValue || 1;
    await currentDevice.selectConfiguration(configValue);
    console.log(`Configuration ${configValue} selected`);

    // Detect endpoints before claiming interface
    detectEndpoints(currentDevice);

    // Claim interface 0 (typical for CCID/HID devices)
    if (currentInterfaceNumber !== null) {
      await currentDevice.claimInterface(currentInterfaceNumber);
      console.log(`Interface ${currentInterfaceNumber} claimed`);
    }

    // Start the USB receive loop
    startReceiveLoop();

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'InvalidStateError') {
        throw new Error('Device already in use or invalid state');
      } else if (error.name === 'SecurityError') {
        throw new Error('Permission denied to access USB device');
      } else if (error.name === 'NotFoundError') {
        throw new Error('USB device not found or disconnected');
      }
      throw new Error(`Failed to open USB device: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Close and release USB device
 */
export async function closeDevice(): Promise<void> {
  // Stop receive loop
  receiveLoopRunning = false;

  if (!currentDevice) {
    console.log('No device to close');
    return;
  }

  try {
    // Release interface if claimed
    if (currentInterfaceNumber !== null) {
      await currentDevice.releaseInterface(currentInterfaceNumber);
      console.log(`Interface ${currentInterfaceNumber} released`);
    }

    // Close device
    await currentDevice.close();
    console.log('USB Device closed');

    // Reset state
    currentDevice = null;
    currentInterfaceNumber = null;
    inEndpoint = null;
    outEndpoint = null;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to close USB device: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Send raw data to USB device
 */
export async function send(data: Uint8Array): Promise<void> {
  if (!currentDevice) {
    throw new Error('No device connected');
  }

  if (outEndpoint === null) {
    throw new Error('OUT endpoint not configured');
  }

  try {
    const result = await currentDevice.transferOut(outEndpoint, data as BufferSource);
    
    if (result.status !== 'ok') {
      throw new Error(`Transfer failed with status: ${result.status}`);
    }

    console.log(`Sent ${data.length} bytes to endpoint ${outEndpoint}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to send data: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Receive raw data from USB device
 */
export async function receive(): Promise<Uint8Array> {
  if (!currentDevice) {
    throw new Error('No device connected');
  }

  if (inEndpoint === null) {
    throw new Error('IN endpoint not configured');
  }

  try {
    const result = await currentDevice.transferIn(inEndpoint, DEFAULT_PACKET_SIZE);
    
    if (result.status !== 'ok') {
      throw new Error(`Transfer failed with status: ${result.status}`);
    }

    if (!result.data) {
      throw new Error('No data received');
    }

    const data = new Uint8Array(result.data.buffer);
    console.log(`Received ${data.length} bytes from endpoint ${inEndpoint}`);
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to receive data: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Continuous USB receive loop
 * Forwards data to WASM module for protocol handling
 */
async function usbReceiveLoop(): Promise<void> {
  while (receiveLoopRunning && currentDevice) {
    try {
      const data = await receive();
      
      // Forward to WASM if available
      if (wasmModule && wasmModule.on_usb_data) {
        try {
          const response = wasmModule.on_usb_data(data);
          
          // If WASM returns data, send it back via USB
          if (response && response.length > 0) {
            await send(response);
          }
        } catch (wasmError) {
          console.error('WASM processing error:', wasmError);
        }
      } else {
        console.log('Received USB data (WASM not available):', data);
      }
    } catch (error) {
      // Only log errors that aren't due to loop stopping
      if (receiveLoopRunning) {
        console.error('USB receive error:', error);
        // Small delay before retry to avoid tight error loop
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  console.log('USB receive loop stopped');
}

/**
 * Start the USB receive loop
 */
function startReceiveLoop(): void {
  if (receiveLoopRunning) {
    console.warn('Receive loop already running');
    return;
  }

  receiveLoopRunning = true;
  usbReceiveLoop().catch(error => {
    console.error('Fatal error in USB receive loop:', error);
    receiveLoopRunning = false;
  });
  console.log('USB receive loop started');
}

/**
 * Setup USB device connect event listener
 */
export function onConnect(callback: (device: USBDeviceInfo) => void): void {
  checkWebUSBSupport();

  if (!navigator.usb) {
    return;
  }

  navigator.usb.addEventListener('connect', (event: USBConnectionEvent) => {
    const device = event.device;
    const deviceInfo: USBDeviceInfo = {
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName,
      serialNumber: device.serialNumber
    };
    console.log('USB device connected:', deviceInfo);
    callback(deviceInfo);
  });
}

/**
 * Setup USB device disconnect event listener
 */
export function onDisconnect(callback: () => void): void {
  checkWebUSBSupport();

  if (!navigator.usb) {
    return;
  }

  navigator.usb.addEventListener('disconnect', (event: USBConnectionEvent) => {
    console.log('USB device disconnected:', event.device.productName);
    
    // If the disconnected device is our current device, clean up
    if (currentDevice && event.device === currentDevice) {
      receiveLoopRunning = false;
      currentDevice = null;
      currentInterfaceNumber = null;
      inEndpoint = null;
      outEndpoint = null;
    }
    
    callback();
  });
}

/**
 * Get current device connection status
 */
export function isConnected(): boolean {
  return currentDevice !== null && currentDevice.opened;
}

/**
 * Get current device info
 */
export function getCurrentDevice(): USBDeviceInfo | null {
  if (!currentDevice) {
    return null;
  }

  return {
    vendorId: currentDevice.vendorId,
    productId: currentDevice.productId,
    productName: currentDevice.productName,
    serialNumber: currentDevice.serialNumber
  };
}
