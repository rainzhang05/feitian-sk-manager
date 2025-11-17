#!/bin/bash
set -e

echo "=== Building Feitian SK Manager WebApp ==="

# Build WASM module
echo "Building WASM module..."
cd wasm
cargo build --release --target wasm32-unknown-unknown
cd ..

# Check if wasm-pack is installed, if not use wasm-bindgen
if command -v wasm-pack &> /dev/null; then
    echo "Using wasm-pack to build WASM module..."
    cd wasm
    wasm-pack build --target web --out-dir ../frontend/public/wasm
    cd ..
else
    echo "wasm-pack not found. Using wasm-bindgen..."
    if command -v wasm-bindgen &> /dev/null; then
        wasm-bindgen --target web --out-dir frontend/public/wasm wasm/target/wasm32-unknown-unknown/release/feitian_sk_wasm.wasm
    else
        echo "Error: Neither wasm-pack nor wasm-bindgen found. Please install one of them."
        exit 1
    fi
fi

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Copy frontend build to dist
echo "Copying build artifacts to dist..."
rm -rf dist
mkdir -p dist
cp -r frontend/dist/* dist/

echo "=== Build complete! ==="
echo "Output is in ./dist directory"
