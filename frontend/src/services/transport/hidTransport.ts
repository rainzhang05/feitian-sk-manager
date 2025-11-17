/**
 * WebHID Transport Implementation
 * Handles HID device communication for Feitian security keys
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
      console.log('[HID] WASM module loaded successfully');
    }
  } catch {
    console.log('[HID] WASM module not yet available (will be implemented in Phase 2)');
  }
}

// Initialize WASM on module load (non-blocking)
loadWasmModule();

/**
 * HID Transport class implementing the Transport interface
 */
export class HIDTransport implements Transport {
  public readonly type = 'hid' as const;
  private device: HIDDevice;
  private dataCallback: DataCallback | null = null;
  private inputReportListener: ((event: HIDInputReportEvent) => void) | null = null;

  constructor(device: HIDDevice) {
    this.device = device;
  }

  get isOpen(): boolean {
    return this.device.opened;
  }

  /**
   * Open the HID device and start listening for input reports
   */
  async open(): Promise<void> {
    if (this.device.opened) {
      console.warn('[HID] Device already opened');
      return;
    }

    try {
      await this.device.open();
      console.log('[HID] Device opened successfully');

      // Setup input report listener
      this.setupInputReportListener();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          throw new Error('HID device already in use or invalid state');
        } else if (error.name === 'SecurityError') {
          throw new Error('Permission denied to access HID device');
        }
        throw new Error(`Failed to open HID device: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Close the HID device and cleanup listeners
   */
  async close(): Promise<void> {
    // Remove input report listener
    if (this.inputReportListener) {
      this.device.removeEventListener('inputreport', this.inputReportListener);
      this.inputReportListener = null;
    }

    if (!this.device.opened) {
      console.log('[HID] Device already closed');
      return;
    }

    try {
      await this.device.close();
      console.log('[HID] Device closed successfully');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to close HID device: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send data to the HID device using output report
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.device.opened) {
      throw new Error('HID device not opened');
    }

    try {
      // Report ID 0 for FIDO/CTAP devices (standard)
      const reportId = 0;
      await this.device.sendReport(reportId, data as BufferSource);
      console.log(`[HID] Sent ${data.length} bytes (report ID: ${reportId})`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send HID report: ${error.message}`);
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
      serialNumber: undefined, // HID API doesn't provide serial number
      type: 'hid'
    };
  }

  /**
   * Setup listener for HID input reports
   */
  private setupInputReportListener(): void {
    this.inputReportListener = (event: HIDInputReportEvent) => {
      const data = new Uint8Array(event.data.buffer);
      console.log(`[HID] Received ${data.length} bytes (report ID: ${event.reportId})`);

      // Forward to registered callback
      if (this.dataCallback) {
        this.dataCallback(data);
      }

      // Forward to WASM if available
      if (wasmModule && wasmModule.on_usb_data) {
        try {
          const response = wasmModule.on_usb_data(data);
          if (response && response.length > 0) {
            this.send(response).catch(error => {
              console.error('[HID] Failed to send WASM response:', error);
            });
          }
        } catch (wasmError) {
          console.error('[HID] WASM processing error:', wasmError);
        }
      }
    };

    this.device.addEventListener('inputreport', this.inputReportListener);
    console.log('[HID] Input report listener registered');
  }
}

/**
 * Check if WebHID is supported in the current browser
 */
export function checkWebHIDSupport(): boolean {
  return 'hid' in navigator && navigator.hid !== undefined;
}

/**
 * Request HID device from user
 */
export async function requestHIDDevice(): Promise<HIDDevice | null> {
  if (!checkWebHIDSupport()) {
    throw new Error(
      'WebHID is not supported in this browser. ' +
      'Please use a Chromium-based browser (Chrome, Edge, Opera) version 89 or later.'
    );
  }

  try {
    // Request device with Feitian vendor ID filter
    const devices = await navigator.hid!.requestDevice({
      filters: [{ vendorId: 0x096E }] // Feitian vendor ID
    });

    if (devices.length === 0) {
      console.log('[HID] No device selected by user');
      return null;
    }

    // Return first selected device
    console.log('[HID] Device selected:', devices[0].productName);
    return devices[0];
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        console.log('[HID] No device selected by user');
        return null;
      }
      throw new Error(`Failed to request HID device: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all paired HID devices
 */
export async function getHIDDevices(): Promise<HIDDevice[]> {
  if (!checkWebHIDSupport()) {
    return [];
  }

  try {
    const devices = await navigator.hid!.getDevices();
    console.log(`[HID] Found ${devices.length} paired devices`);
    return devices;
  } catch (error) {
    console.error('[HID] Failed to get devices:', error);
    return [];
  }
}
