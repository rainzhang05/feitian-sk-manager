# Feitian SK Manager

A modern web-based Security Key Manager that enables users to manage their Feitian security key devices directly in the browser without downloading any desktop applications.

## Overview

This project recreates Feitian's SK Manager as a fully web-based application. The browser communicates directly with Feitian security keys via **WebUSB**, while cryptographic protocol handling and APDU/CTAPHID logic run inside **WebAssembly (WASM)**.

### Architecture

```
Browser (React UI)
    ↓
WebUSB (JS Transport)
    ↓
WebAssembly (CTAP2, CCID/APDU, OTP, Crypto)
    ↓
Feitian Security Key (USB)
```

## Features

- **FIDO2 Management**: Change PIN, manage credentials, authenticator reset
- **PIV Management**: Certificate operations, key generation, slot management
- **OTP Management**: Configure HOTP/TOTP slots
- **Interface Management**: Enable/disable device interfaces (FIDO2, U2F, PIV, OpenPGP, OTP, NDEF)

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **WebUSB**: JavaScript transport layer for USB communication
- **WebAssembly**: Rust-based WASM module for protocol handling
- **Deployment**: Docker + nginx
- **UI Theme**: Minimalist black & white design

## Project Structure

```
/frontend           - React frontend application
  /src/components   - Reusable UI components
  /src/pages       - Page components (FIDO2, PIV, OTP, Interfaces)
  /src/services    - WebUSB service layer
  /src/styles      - Global styles and theme
/wasm              - Rust WASM module
  /src             - WASM source code
/docker            - Docker configuration
  nginx.conf       - nginx configuration with COOP/COEP headers
```

## Development

### Prerequisites

- Node.js 20+
- Rust (with wasm32-unknown-unknown target)
- wasm-pack
- Docker (for deployment)

### Setup

1. Clone the repository
2. Build the WASM module:
   ```bash
   cd wasm
   wasm-pack build --target web --out-dir ../frontend/public/wasm
   cd ..
   ```

3. Install frontend dependencies and run dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Build for Production

Use the provided build script:

```bash
./build.sh
```

Or build with Docker:

```bash
docker build -t feitian-sk-manager .
docker run -p 8080:80 feitian-sk-manager
```

Then open http://localhost:8080 in your browser.

## Important Notes

### WebUSB Requirements

- **HTTPS Required**: WebUSB API only works over HTTPS (except for localhost)
- **Browser Support**: Chrome/Edge 61+, Opera 48+
- **User Gesture**: Device selection requires a user interaction (button click)

### Security Headers

The application includes Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers for optimal WASM runtime security.

## Current Status

**Phase 0 - Repository Foundation** ✅ COMPLETE

- ✅ Project structure created
- ✅ Vite + React + TypeScript configured
- ✅ Black & white theme implemented
- ✅ Placeholder pages created (FIDO2, PIV, OTP, Interfaces)
- ✅ WebUSB service placeholder
- ✅ WASM module skeleton with wasm-bindgen
- ✅ Docker deployment working
- ✅ nginx with proper headers
- ✅ USB diagnostics tool added

**Next Steps**: Phase 1 - USB Transport Layer implementation

## Troubleshooting

### "No Compatible Devices Found" Error

If you're unable to detect your Feitian security key, use the built-in **Diagnostics** page to identify the issue:

1. Navigate to the **Diagnostics** tab in the application
2. Click **"Run System Diagnostics"** to check your environment
3. Click **"Detect Any Device"** to test device detection without vendor filters

#### Common Causes

**1. Wrong Vendor ID**
- Feitian devices may use vendor IDs: `0x096E` or `0x311F`
- Use the diagnostics tool to discover your device's vendor ID
- Some models may have different vendor IDs

**2. HID/CCID Interface Only**
- Many Feitian security keys expose only HID (class `0x03`) or CCID (class `0x0B`) interfaces
- **WebUSB cannot claim HID/CCID interfaces** - they are reserved by the operating system
- Solution: These devices require **WebHID API** instead of WebUSB
- Check the diagnostics tool for "Recommended Transport" guidance

**3. Origin Not Secure**
- WebUSB requires HTTPS or localhost
- File protocol (`file://`) is not supported
- Non-localhost HTTP is not supported
- Check diagnostics for origin compatibility

**4. Browser Not Supported**
- Use Chrome, Edge, or Opera (Chromium-based)
- Firefox does not support WebUSB
- Safari does not support WebUSB

#### Using the Diagnostics Tool

The diagnostics page provides:
- Environment and origin validation
- Device interface analysis
- WebUSB compatibility check
- Recommended transport method (WebUSB vs WebHID)
- Detailed device information

#### WebUSB vs WebHID

**WebUSB** works with:
- Devices with vendor-specific interfaces (class `0xFF`)
- Devices explicitly designed for WebUSB

**WebHID** works with:
- Devices with HID interfaces (class `0x03`)
- FIDO2 authenticators
- Most security keys

**Note**: Most Feitian security keys use HID/CCID interfaces and require WebHID, not WebUSB. Future versions of this application may add WebHID support.

## License

Copyright © 2025 Feitian SK Manager Project
 
