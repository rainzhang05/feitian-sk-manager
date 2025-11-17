/**
 * Transport Manager
 * Manages device detection, selection, and connection for both WebUSB and WebHID
 */

import { USBTransport, requestUSBDevice, getUSBDevices, checkWebUSBSupport } from './usbTransport';
import { HIDTransport, requestHIDDevice, getHIDDevices, checkWebHIDSupport } from './hidTransport';
import type { Transport, DetectedDevice, DeviceInfo, TransportType } from './types';

/**
 * Transport Manager class
 * Singleton that manages the current transport connection
 */
class TransportManager {
  private currentTransport: Transport | null = null;
  private connectionCallbacks: Array<(info: DeviceInfo) => void> = [];
  private disconnectionCallbacks: Array<() => void> = [];

  /**
   * Get the current transport type
   */
  get currentTransportType(): TransportType | null {
    return this.currentTransport?.type || null;
  }

  /**
   * Check if a device is currently connected
   */
  get isConnected(): boolean {
    return this.currentTransport !== null && this.currentTransport.isOpen;
  }

  /**
   * Get current device information
   */
  getCurrentDevice(): DeviceInfo | null {
    return this.currentTransport?.getDeviceInfo() || null;
  }

  /**
   * Scan for all available transports (both USB and HID)
   */
  async scanTransports(): Promise<DetectedDevice[]> {
    const detected: DetectedDevice[] = [];

    // Scan USB devices
    if (checkWebUSBSupport()) {
      try {
        const usbDevices = await getUSBDevices();
        for (const device of usbDevices) {
          detected.push({
            type: 'usb',
            device,
            info: {
              vendorId: device.vendorId,
              productId: device.productId,
              productName: device.productName,
              serialNumber: device.serialNumber,
              type: 'usb'
            }
          });
        }
      } catch (error) {
        console.error('[TransportManager] Failed to scan USB devices:', error);
      }
    }

    // Scan HID devices
    if (checkWebHIDSupport()) {
      try {
        const hidDevices = await getHIDDevices();
        for (const device of hidDevices) {
          detected.push({
            type: 'hid',
            device,
            info: {
              vendorId: device.vendorId,
              productId: device.productId,
              productName: device.productName,
              serialNumber: undefined,
              type: 'hid'
            }
          });
        }
      } catch (error) {
        console.error('[TransportManager] Failed to scan HID devices:', error);
      }
    }

    console.log(`[TransportManager] Detected ${detected.length} devices total`);
    return detected;
  }

  /**
   * Request a new USB device from the user and connect
   */
  async requestAndConnectUSB(): Promise<DeviceInfo | null> {
    try {
      const device = await requestUSBDevice();
      if (!device) {
        return null;
      }

      return await this.connectUSB(device);
    } catch (error) {
      console.error('[TransportManager] Failed to request USB device:', error);
      throw error;
    }
  }

  /**
   * Connect to a specific USB device
   */
  async connectUSB(device: USBDevice): Promise<DeviceInfo> {
    // Disconnect any existing transport
    await this.disconnect();

    try {
      const transport = new USBTransport(device);
      await transport.open();
      
      this.currentTransport = transport;
      const deviceInfo = transport.getDeviceInfo();
      
      console.log('[TransportManager] Connected to USB device:', deviceInfo);
      this.notifyConnectionCallbacks(deviceInfo);
      
      return deviceInfo;
    } catch (error) {
      console.error('[TransportManager] Failed to connect to USB device:', error);
      throw error;
    }
  }

  /**
   * Request a new HID device from the user and connect
   */
  async requestAndConnectHID(): Promise<DeviceInfo | null> {
    try {
      const device = await requestHIDDevice();
      if (!device) {
        return null;
      }

      return await this.connectHID(device);
    } catch (error) {
      console.error('[TransportManager] Failed to request HID device:', error);
      throw error;
    }
  }

  /**
   * Connect to a specific HID device
   */
  async connectHID(device: HIDDevice): Promise<DeviceInfo> {
    // Disconnect any existing transport
    await this.disconnect();

    try {
      const transport = new HIDTransport(device);
      await transport.open();
      
      this.currentTransport = transport;
      const deviceInfo = transport.getDeviceInfo();
      
      console.log('[TransportManager] Connected to HID device:', deviceInfo);
      this.notifyConnectionCallbacks(deviceInfo);
      
      return deviceInfo;
    } catch (error) {
      console.error('[TransportManager] Failed to connect to HID device:', error);
      throw error;
    }
  }

  /**
   * Disconnect the current transport
   */
  async disconnect(): Promise<void> {
    if (!this.currentTransport) {
      console.log('[TransportManager] No transport to disconnect');
      return;
    }

    try {
      await this.currentTransport.close();
      console.log('[TransportManager] Transport disconnected');
      this.currentTransport = null;
      this.notifyDisconnectionCallbacks();
    } catch (error) {
      console.error('[TransportManager] Failed to disconnect transport:', error);
      throw error;
    }
  }

  /**
   * Send data through the current transport
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('No transport connected');
    }

    await this.currentTransport.send(data);
  }

  /**
   * Register a callback for incoming data
   */
  onData(callback: (data: Uint8Array) => void): void {
    if (!this.currentTransport) {
      throw new Error('No transport connected');
    }

    this.currentTransport.onData(callback);
  }

  /**
   * Register a callback for connection events
   */
  onConnect(callback: (info: DeviceInfo) => void): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Register a callback for disconnection events
   */
  onDisconnect(callback: () => void): void {
    this.disconnectionCallbacks.push(callback);
  }

  /**
   * Notify all connection callbacks
   */
  private notifyConnectionCallbacks(info: DeviceInfo): void {
    for (const callback of this.connectionCallbacks) {
      try {
        callback(info);
      } catch (error) {
        console.error('[TransportManager] Error in connection callback:', error);
      }
    }
  }

  /**
   * Notify all disconnection callbacks
   */
  private notifyDisconnectionCallbacks(): void {
    for (const callback of this.disconnectionCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[TransportManager] Error in disconnection callback:', error);
      }
    }
  }

  /**
   * Setup browser event listeners for device connect/disconnect
   */
  setupBrowserEventListeners(): void {
    // USB connect/disconnect
    if (checkWebUSBSupport() && navigator.usb) {
      navigator.usb.addEventListener('connect', (event) => {
        console.log('[TransportManager] USB device connected:', event.device.productName);
      });

      navigator.usb.addEventListener('disconnect', (event) => {
        console.log('[TransportManager] USB device disconnected:', event.device.productName);
        // If this is our current device, notify disconnection
        if (this.currentTransport?.type === 'usb') {
          this.currentTransport = null;
          this.notifyDisconnectionCallbacks();
        }
      });
    }

    // HID connect/disconnect
    if (checkWebHIDSupport() && navigator.hid) {
      navigator.hid.addEventListener('connect', (event) => {
        console.log('[TransportManager] HID device connected:', event.device.productName);
      });

      navigator.hid.addEventListener('disconnect', (event) => {
        console.log('[TransportManager] HID device disconnected:', event.device.productName);
        // If this is our current device, notify disconnection
        if (this.currentTransport?.type === 'hid') {
          this.currentTransport = null;
          this.notifyDisconnectionCallbacks();
        }
      });
    }
  }
}

// Export singleton instance
export const transportManager = new TransportManager();

// Initialize browser event listeners
transportManager.setupBrowserEventListeners();

// Export types
export type { DetectedDevice, DeviceInfo, TransportType };
