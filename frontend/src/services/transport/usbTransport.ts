/**
 * WebUSB Transport Implementation
 * Handles USB device communication for Feitian security keys
 */

import type { Transport, DeviceInfo, DataCallback } from './types';

// WASM module reference - will be loaded dynamically when available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;

// Try to load WASM module
async function loadWasmModule() {
  try {
    const importWasm = new Function('return import("../../../wasm/pkg/index.js")');
    const module = await importWasm().catch(() => null);
    if (module) {
      wasmModule = module;
      if (wasmModule.init) {
        wasmModule.init();
      }
      console.log('[USB] WASM module loaded successfully');
    }
  } catch {
    console.log('[USB] WASM module not yet available (will be implemented in Phase 2)');
  }
}

// Initialize WASM on module load (non-blocking)
loadWasmModule();

// Constants
const DEFAULT_PACKET_SIZE = 64;

/**
 * USB Transport class implementing the Transport interface
 */
export class USBTransport implements Transport {
  public readonly type = 'usb' as const;
  private device: USBDevice;
  private interfaceNumber: number | null = null;
  private inEndpoint: number | null = null;
  private outEndpoint: number | null = null;
  private dataCallback: DataCallback | null = null;
  private receiveLoopRunning = false;

  constructor(device: USBDevice) {
    this.device = device;
  }

  get isOpen(): boolean {
    return this.device.opened;
  }

  /**
   * Open the USB device, claim interface, and start receive loop
   */
  async open(): Promise<void> {
    if (this.device.opened) {
      console.warn('[USB] Device already opened');
      return;
    }

    try {
      // Open the device
      await this.device.open();
      console.log('[USB] Device opened');

      // Select configuration
      const configValue = this.device.configuration?.configurationValue || 1;
      await this.device.selectConfiguration(configValue);
      console.log(`[USB] Configuration ${configValue} selected`);

      // Detect endpoints
      this.detectEndpoints();

      // Claim interface
      if (this.interfaceNumber !== null) {
        await this.device.claimInterface(this.interfaceNumber);
        console.log(`[USB] Interface ${this.interfaceNumber} claimed`);
      }

      // Start receive loop
      this.startReceiveLoop();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          throw new Error('USB device already in use or invalid state');
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
   * Close the USB device and cleanup resources
   */
  async close(): Promise<void> {
    // Stop receive loop
    this.receiveLoopRunning = false;

    if (!this.device.opened) {
      console.log('[USB] Device already closed');
      return;
    }

    try {
      // Release interface if claimed
      if (this.interfaceNumber !== null) {
        await this.device.releaseInterface(this.interfaceNumber);
        console.log(`[USB] Interface ${this.interfaceNumber} released`);
      }

      // Close device
      await this.device.close();
      console.log('[USB] Device closed');

      // Reset state
      this.interfaceNumber = null;
      this.inEndpoint = null;
      this.outEndpoint = null;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to close USB device: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send data to the USB device
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.device.opened) {
      throw new Error('USB device not opened');
    }

    if (this.outEndpoint === null) {
      throw new Error('OUT endpoint not configured');
    }

    try {
      const result = await this.device.transferOut(this.outEndpoint, data as BufferSource);
      
      if (result.status !== 'ok') {
        throw new Error(`Transfer failed with status: ${result.status}`);
      }

      console.log(`[USB] Sent ${data.length} bytes to endpoint ${this.outEndpoint}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send data: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Register callback for incoming data
   */
  onData(callback: DataCallback): void {
    this.dataCallback = callback;
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo {
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName,
      serialNumber: this.device.serialNumber,
      type: 'usb'
    };
  }

  /**
   * Detect and configure USB endpoints from device configuration
   */
  private detectEndpoints(): void {
    if (!this.device.configuration) {
      throw new Error('No USB configuration available');
    }

    // Look for suitable endpoints in interface 0
    const iface = this.device.configuration.interfaces[0];
    if (!iface) {
      throw new Error('No USB interfaces found for communication');
    }

    // Use the first alternate interface
    const alternate = iface.alternates[0];
    if (!alternate) {
      throw new Error('No alternate interface found');
    }

    // Find IN and OUT endpoints
    for (const endpoint of alternate.endpoints) {
      if (endpoint.direction === 'in' && !this.inEndpoint) {
        this.inEndpoint = endpoint.endpointNumber;
        console.log(`[USB] IN endpoint detected: ${this.inEndpoint}`);
      } else if (endpoint.direction === 'out' && !this.outEndpoint) {
        this.outEndpoint = endpoint.endpointNumber;
        console.log(`[USB] OUT endpoint detected: ${this.outEndpoint}`);
      }
    }

    if (!this.inEndpoint || !this.outEndpoint) {
      throw new Error('No USB endpoints found for communication');
    }

    this.interfaceNumber = iface.interfaceNumber;
  }

  /**
   * Receive data from the USB device
   */
  private async receive(): Promise<Uint8Array> {
    if (!this.device.opened) {
      throw new Error('USB device not opened');
    }

    if (this.inEndpoint === null) {
      throw new Error('IN endpoint not configured');
    }

    try {
      const result = await this.device.transferIn(this.inEndpoint, DEFAULT_PACKET_SIZE);
      
      if (result.status !== 'ok') {
        throw new Error(`Transfer failed with status: ${result.status}`);
      }

      if (!result.data) {
        throw new Error('No data received');
      }

      const data = new Uint8Array(result.data.buffer);
      console.log(`[USB] Received ${data.length} bytes from endpoint ${this.inEndpoint}`);
      
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
   */
  private async usbReceiveLoop(): Promise<void> {
    while (this.receiveLoopRunning && this.device.opened) {
      try {
        const data = await this.receive();
        
        // Forward to registered callback
        if (this.dataCallback) {
          this.dataCallback(data);
        }

        // Forward to WASM if available
        if (wasmModule && wasmModule.on_usb_data) {
          try {
            const response = wasmModule.on_usb_data(data);
            
            // If WASM returns data, send it back via USB
            if (response && response.length > 0) {
              await this.send(response);
            }
          } catch (wasmError) {
            console.error('[USB] WASM processing error:', wasmError);
          }
        }
      } catch (error) {
        // Only log errors that aren't due to loop stopping
        if (this.receiveLoopRunning) {
          console.error('[USB] Receive error:', error);
          // Small delay before retry to avoid tight error loop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    console.log('[USB] Receive loop stopped');
  }

  /**
   * Start the USB receive loop
   */
  private startReceiveLoop(): void {
    if (this.receiveLoopRunning) {
      console.warn('[USB] Receive loop already running');
      return;
    }

    this.receiveLoopRunning = true;
    this.usbReceiveLoop().catch(error => {
      console.error('[USB] Fatal error in receive loop:', error);
      this.receiveLoopRunning = false;
    });
    console.log('[USB] Receive loop started');
  }
}

/**
 * Check if WebUSB is supported in the current browser
 */
export function checkWebUSBSupport(): boolean {
  return 'usb' in navigator && navigator.usb !== undefined;
}

/**
 * Request USB device from user
 */
export async function requestUSBDevice(): Promise<USBDevice | null> {
  if (!checkWebUSBSupport()) {
    throw new Error(
      'WebUSB is not supported in this browser. ' +
      'Please use a Chromium-based browser (Chrome, Edge, Opera) with HTTPS.'
    );
  }

  try {
    const device = await navigator.usb!.requestDevice({
      filters: [{ vendorId: 0x096E }] // Feitian vendor ID
    });

    console.log('[USB] Device selected:', device.productName);
    return device;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        console.log('[USB] No device selected by user');
        return null;
      }
      throw new Error(`Failed to request USB device: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all paired USB devices
 */
export async function getUSBDevices(): Promise<USBDevice[]> {
  if (!checkWebUSBSupport()) {
    return [];
  }

  try {
    const devices = await navigator.usb!.getDevices();
    console.log(`[USB] Found ${devices.length} paired devices`);
    return devices;
  } catch (error) {
    console.error('[USB] Failed to get devices:', error);
    return [];
  }
}
