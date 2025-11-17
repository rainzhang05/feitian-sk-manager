#!/bin/bash

##############################################################################
# USB Device Diagnostics Script for Feitian Security Keys
#
# This script collects USB device information to help diagnose WebUSB
# compatibility issues. Run this on your local machine where the Feitian
# device is connected.
#
# Usage: ./scripts/usb-diagnostics.sh
##############################################################################

set -e

echo "========================================"
echo "Feitian USB Device Diagnostics"
echo "========================================"
echo ""

# Detect operating system
OS="$(uname -s)"
echo "Operating System: $OS"
echo ""

# Known Feitian vendor IDs
FEITIAN_VENDOR_IDS=("096e" "311f")

echo "Searching for Feitian devices (Vendor IDs: ${FEITIAN_VENDOR_IDS[*]})..."
echo ""

case "$OS" in
  Darwin)
    echo "=== macOS USB Device Information ==="
    echo ""
    
    # Check if system_profiler is available
    if command -v system_profiler &> /dev/null; then
      echo "Running: system_profiler SPUSBDataType"
      echo "----------------------------------------"
      system_profiler SPUSBDataType
      echo ""
    else
      echo "ERROR: system_profiler command not found"
      exit 1
    fi
    
    # Try to get more detailed information with ioreg
    if command -v ioreg &> /dev/null; then
      echo ""
      echo "=== Detailed USB Interface Information ==="
      echo ""
      echo "Running: ioreg -p IOUSB -l"
      echo "----------------------------------------"
      
      # Filter for Feitian devices
      for vendor_id in "${FEITIAN_VENDOR_IDS[@]}"; do
        echo ""
        echo "Searching for vendor ID 0x${vendor_id}..."
        ioreg -p IOUSB -l | grep -i -A 20 "\"idVendor\" = 0x${vendor_id}" || echo "No devices found with vendor ID 0x${vendor_id}"
      done
      echo ""
    fi
    ;;
    
  Linux)
    echo "=== Linux USB Device Information ==="
    echo ""
    
    # Check if lsusb is available
    if command -v lsusb &> /dev/null; then
      echo "Running: lsusb"
      echo "----------------------------------------"
      lsusb
      echo ""
      
      echo ""
      echo "=== Detailed USB Device Descriptors ==="
      echo ""
      
      # Get detailed information for Feitian devices
      for vendor_id in "${FEITIAN_VENDOR_IDS[@]}"; do
        echo ""
        echo "Searching for vendor ID ${vendor_id}..."
        echo "Running: lsusb -v -d ${vendor_id}:"
        echo "----------------------------------------"
        lsusb -v -d "${vendor_id}:" 2>&1 || echo "No devices found with vendor ID ${vendor_id}"
      done
      echo ""
    else
      echo "ERROR: lsusb command not found"
      echo "Please install usbutils: sudo apt-get install usbutils (Debian/Ubuntu)"
      exit 1
    fi
    ;;
    
  MINGW*|MSYS*|CYGWIN*)
    echo "=== Windows USB Device Information ==="
    echo ""
    echo "For Windows, please use Device Manager or:"
    echo "1. Open PowerShell as Administrator"
    echo "2. Run: Get-PnpDevice -Class USB"
    echo ""
    echo "Or install USBView from Windows SDK to inspect USB descriptors"
    echo ""
    ;;
    
  *)
    echo "ERROR: Unsupported operating system: $OS"
    echo "This script supports macOS and Linux only"
    exit 1
    ;;
esac

echo ""
echo "========================================"
echo "Diagnostics Summary"
echo "========================================"
echo ""
echo "Next Steps:"
echo "1. Check if any Feitian devices were detected above"
echo "2. Note the Vendor ID (should be 0x096E or 0x311F)"
echo "3. Note the Product ID"
echo "4. Check the interface classes:"
echo "   - Class 0x03 (HID) → Use WebHID API"
echo "   - Class 0x0B (CCID/Smart Card) → Use WebHID or PC/SC"
echo "   - Class 0xFF (Vendor Specific) → Can use WebUSB"
echo ""
echo "5. Open the Feitian SK Manager web application"
echo "6. Navigate to the 'Diagnostics' tab"
echo "7. Click 'Detect Any Device' to analyze your device"
echo ""
echo "For more help, see the Troubleshooting section in README.md"
echo ""
