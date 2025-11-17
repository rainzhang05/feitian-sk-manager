/**
 * TypeScript definitions for WebUSB API
 * These types extend the browser's Navigator interface to include USB support
 */

interface USBDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly manufacturerName?: string;
  readonly serialNumber?: string;
  readonly configuration?: USBConfiguration;
  readonly configurations: USBConfiguration[];
  readonly opened: boolean;
  
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
  controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
  isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
  reset(): Promise<void>;
}

interface USBConfiguration {
  readonly configurationValue: number;
  readonly configurationName?: string;
  readonly interfaces: USBInterface[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternates: USBAlternateInterface[];
  readonly alternate?: USBAlternateInterface;
  readonly claimed: boolean;
}

interface USBAlternateInterface {
  readonly alternateSetting: number;
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly interfaceName?: string;
  readonly endpoints: USBEndpoint[];
}

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: 'in' | 'out';
  readonly type: 'bulk' | 'interrupt' | 'isochronous';
  readonly packetSize: number;
}

interface USBControlTransferParameters {
  readonly requestType: 'standard' | 'class' | 'vendor';
  readonly recipient: 'device' | 'interface' | 'endpoint' | 'other';
  readonly request: number;
  readonly value: number;
  readonly index: number;
}

interface USBInTransferResult {
  readonly data?: DataView;
  readonly status: 'ok' | 'stall' | 'babble';
}

interface USBOutTransferResult {
  readonly bytesWritten: number;
  readonly status: 'ok' | 'stall';
}

interface USBIsochronousInTransferResult {
  readonly data: DataView;
  readonly packets: USBIsochronousInTransferPacket[];
}

interface USBIsochronousOutTransferResult {
  readonly packets: USBIsochronousOutTransferPacket[];
}

interface USBIsochronousInTransferPacket {
  readonly data: DataView;
  readonly status: 'ok' | 'stall' | 'babble';
}

interface USBIsochronousOutTransferPacket {
  readonly bytesWritten: number;
  readonly status: 'ok' | 'stall';
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USB extends EventTarget {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options?: USBDeviceRequestOptions): Promise<USBDevice>;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: 'connect', listener: (this: this, ev: USBConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: 'disconnect', listener: (this: this, ev: USBConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: 'connect', listener: (this: this, ev: USBConnectionEvent) => any, options?: boolean | EventListenerOptions): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: 'disconnect', listener: (this: this, ev: USBConnectionEvent) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

interface Navigator {
  readonly usb?: USB;
}
