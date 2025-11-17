/**
 * TypeScript definitions for WebHID API
 * These types extend the browser's Navigator interface to include HID support
 */

interface HIDDevice {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];

  open(): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;

  addEventListener(
    type: 'inputreport',
    listener: (this: this, ev: HIDInputReportEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener(
    type: 'inputreport',
    listener: (this: this, ev: HIDInputReportEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}

interface HIDCollectionInfo {
  readonly usagePage: number;
  readonly usage: number;
  readonly type: number;
  readonly children: HIDCollectionInfo[];
  readonly inputReports: HIDReportInfo[];
  readonly outputReports: HIDReportInfo[];
  readonly featureReports: HIDReportInfo[];
}

interface HIDReportInfo {
  readonly reportId: number;
  readonly items: HIDReportItem[];
}

interface HIDReportItem {
  readonly isAbsolute: boolean;
  readonly isArray: boolean;
  readonly isBufferedBytes: boolean;
  readonly isConstant: boolean;
  readonly isLinear: boolean;
  readonly isRange: boolean;
  readonly isVolatile: boolean;
  readonly hasNull: boolean;
  readonly hasPreferredState: boolean;
  readonly wrap: boolean;
  readonly usages: number[];
  readonly usageMinimum: number;
  readonly usageMaximum: number;
  readonly reportSize: number;
  readonly reportCount: number;
  readonly unitExponent: number;
  readonly unitSystem: number;
  readonly unitFactorLengthExponent: number;
  readonly unitFactorMassExponent: number;
  readonly unitFactorTimeExponent: number;
  readonly unitFactorTemperatureExponent: number;
  readonly unitFactorCurrentExponent: number;
  readonly unitFactorLuminousIntensityExponent: number;
  readonly logicalMinimum: number;
  readonly logicalMaximum: number;
  readonly physicalMinimum: number;
  readonly physicalMaximum: number;
  readonly strings: string[];
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options?: HIDDeviceRequestOptions): Promise<HIDDevice[]>;

  addEventListener(
    type: 'connect',
    listener: (this: this, ev: HIDConnectionEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: 'disconnect',
    listener: (this: this, ev: HIDConnectionEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener(
    type: 'connect',
    listener: (this: this, ev: HIDConnectionEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: 'disconnect',
    listener: (this: this, ev: HIDConnectionEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}

interface Navigator {
  readonly hid?: HID;
}
