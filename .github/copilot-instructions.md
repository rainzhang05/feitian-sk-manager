# AGENTS.md — Project Roadmap for Feitian SK Manager WebApp

## Project Overview
This project recreates Feitian’s SK Manager as a fully web-based application, eliminating the need for users to download a desktop application. The browser communicates directly with Feitian security keys via **WebUSB**, while cryptographic protocol handling and APDU/CTAPHID logic run inside **WebAssembly (WASM)**. The UI is a modern, minimalistic **black & white** interface.

The system architecture is:

```
Browser (React UI)
    ↓
WebUSB (JS Transport)
    ↓
WebAssembly (CTAP2, CCID/APDU, OTP, Crypto)
    ↓
Feitian Security Key (USB)
```

---

## 1. Project Architecture

### 1.1 High-Level Components
- **React + Vite Frontend**
- **WASM module (Rust/C++)**
- **WebUSB transport service**
- **nginx inside Docker container** (production)
- **HTTPS required** for WebUSB

### 1.2 UI Structure
- FIDO2 Management
- PIV Management
- OTP Management
- Interface Configuration
- USB status indicator & notifications

---

## 2. Deployment Environment

### 2.1 Docker-Based Deployment
A single Dockerfile builds:
1. Frontend (Vite → dist/)
2. WASM module
3. Serves production bundle with nginx

No `docker-compose` required.

### 2.2 WebUSB Requirements
- Must be served over **HTTPS** (except localhost)
- Must include COOP/COEP headers for optimal WASM runtime

---

## 3. Technology Stack

### 3.1 Frontend
- React + TypeScript
- Vite as bundler
- Black & White minimalist UI

### 3.2 WebUSB (JavaScript)
Responsibilities:
- Device selection (`navigator.usb.requestDevice`)
- Device open/close
- Interface claiming
- Bulk/control transfers
- Pass raw packets to WASM

### 3.3 WebAssembly (Rust recommended)
Responsibilities:
- CTAPHID framing / unframing
- CTAP2 protocol implementation
- Credential management
- PIV APDU stack
- OTP vendor protocol stack
- Crypto (ECDH, AES, CBOR, DER)
- State machine logic

---

## 4. Functional Scope

### 4.1 FIDO2 Management
- Change PIN
- Get PIN retries
- Credential enumeration
- Credential deletion
- Authenticator reset
- Device metadata

### 4.2 PIV Management
- Slot selection
- Certificate reading
- Certificate import/export
- Key generation (on device)
- PIN/PUK/Management Key operations
- Policy Manager

### 4.3 OTP Management
- Configure slot 1 (short touch)
- Configure slot 2 (long touch)
- Delete slot
- Swap slots
- HOTP/TOTP seed import
- Slot metadata viewing

### 4.4 Interface Management
As shown in the original desktop SK Manager:
- FIDO2
- U2F
- PIV
- OPENPGP
- OTP
- NDEF

---

## 5. Development Roadmap

### Phase 0 — Repository Foundation
AI Agent tasks:
- Create folder structure
- Add Vite React boilerplate
- Add WASM module skeleton
- Add Dockerfile & nginx config
- Add base black/white theme
- Add USB manager placeholder

Deliverables:
- Empty app builds in Docker

---

### Phase 1 — USB Transport Layer (JS)
AI Agent tasks:
- Implement `requestDevice`
- Implement `open()`, `claimInterface()`
- Implement `transferIn` loop
- Implement `transferOut`
- Define WASM binding interface

Deliverables:
- Raw USB packet send/receive pipeline functional

---

### Phase 1.5 — Dual-Transport Layer (WebUSB + WebHID)

Goal: Support both WebUSB and WebHID, so all Feitian devices—whether HID-based or vendor-USB—are compatible.

Deliverables
	1.	Transport Abstraction
	•	Create a unified interface:
interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  onReceive(cb: (data: Uint8Array) => void): void;
  type: "webusb" | "webhid";
}
2.	WebUSB Transport (Existing)
	•	Move existing implementation into:
src/services/transport/usbTransport.ts
3.	WebHID Transport (New)
	•	Implement HID-based communication with:
	•	requestDevice()
	•	open()
	•	receive via input reports
	•	send via output reports or feature reports
	•	listener cleanup
    •	File: src/services/transport/hidTransport.ts
4. Unified Manager
•	File:
src/services/transport/index.ts
•	Logic:
	•	Try WebUSB first
	•	Fallback to WebHID
	•	Throw error if neither available
	•	Return a concrete Transport instance

5.	FIDO2 UI Integration
•	Update FIDO2Page to:
•	Use unified transport
•	Display “Connected via WebUSB” or “Connected via WebHID”
•	Automatically route data through WASM
6.	Receive Loop Refactor
•	Move the loop into the unified transport
•	Must work identically for USB and HID

Acceptance Criteria
	•	Connect button selects either WebUSB or WebHID device.
	•	Feitian keys (HID) appear and can be selected.
	•	USB-only devices also work.
	•	Unified API provides:
	•	connect(), disconnect()
	•	send(data)
	•	onReceive(callback)
	•	UI reflects correct transport type.
	•	WASM receives all data from either transport.

---

### Phase 2 — WASM CTAPHID Core
AI Agent tasks:
- Implement CTAPHID INIT
- Implement packet assembly/disassembly
- Add CBOR library
- Implement WASM <-> JS bindings
- Successfully call `authenticatorGetInfo`

Deliverables:
- Device info displayed in console/UI

---

### Phase 3 — FIDO2 Features
AI Agent tasks:
- Implement ClientPIN flows
- Implement Credential Management
- Implement Reset

Deliverables:
- FIDO2 panel fully functional

---

### Phase 4 — PIV (APDU/CCID)
AI Agent tasks:
- Build CCID APDU encoder/decoder
- Implement PIV commands
- Implement certificate DER parsing
- Implement keygen + import/export

Deliverables:
- PIV panel fully functional

---

### Phase 5 — OTP Module
AI Agent tasks:
- Implement vendor APDUs
- Implement HOTP/TOTP seed encoding
- Implement slot config/delete/swap

Deliverables:
- OTP panel fully functional

---

### Phase 6 — Interface Management
AI Agent tasks:
- Implement interface bitmasking
- Add Save interface settings

Deliverables:
- Interface management functional

---

### Phase 7 — UI Polish & Security
AI Agent tasks:
- Add notifications, error handling
- Handle device disconnect
- Polish black/white UI

Deliverables:
- Production-ready UI

---

### Phase 8 — Deployment
AI Agent tasks:
- Generate final Docker build
- Add nginx HTTPS config
- Deploy to chosen server/infrastructure

Deliverables:
- SK Manager WebApp running in production

---

## 6. Agent Workflow
Each phase is executed via:
1. You send previous summary → request next step  
2. Project Manager provides next agent prompt  
3. AI Agent executes and reports back  
4. Cycle repeats

---

## 7. Completion Criteria
- FIDO2/PIV/OTP features all functional  
- WebUSB communication stable  
- WASM protocol stacks correct  
- UI complete and modern B/W  
- Docker deployment fully working  
- No native apps required  

---

End of AGENTS.md
