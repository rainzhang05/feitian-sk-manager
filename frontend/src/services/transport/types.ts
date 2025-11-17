/**
 * Transport layer types and interfaces
 * Defines the common interface for both WebUSB and WebHID transports
 */

export type TransportType = 'usb' | 'hid';

/**
 * Generic device information that applies to both USB and HID devices
 */
export interface DeviceInfo {
  vendorId: number;
  productId: number;
  productName?: string;
  serialNumber?: string;
  type: TransportType;
}

/**
 * Detected device before connection
 */
export interface DetectedDevice {
  type: TransportType;
  device: USBDevice | HIDDevice;
  info: DeviceInfo;
}

/**
 * Transport interface - must be implemented by both USB and HID transports
 */
export interface Transport {
  readonly type: TransportType;
  readonly isOpen: boolean;
  
  /**
   * Open the transport and start communication
   */
  open(): Promise<void>;
  
  /**
   * Close the transport and cleanup resources
   */
  close(): Promise<void>;
  
  /**
   * Send data to the device
   */
  send(data: Uint8Array): Promise<void>;
  
  /**
   * Register a callback for incoming data
   */
  onData(callback: (data: Uint8Array) => void): void;
  
  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo;
}

/**
 * Callback type for data received from device
 */
export type DataCallback = (data: Uint8Array) => void;
