#!/bin/bash

echo "🌐 Subsidi Tepat LPG - Web Server Setup"
echo "======================================"

# Get network interfaces
echo ""
echo "📡 Network Information:"
echo "----------------------"

# Show local IP addresses
echo "Local IP addresses:"
ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print "   "$2}' | cut -d'/' -f1

echo ""
echo "🚀 Starting web server on all network interfaces..."
echo "The server will be accessible from:"
echo "   - Local: http://localhost:3000"
echo "   - Network: http://YOUR_IP:3000"
echo ""
echo "⚠️  SECURITY NOTE:"
echo "   The server will be accessible from your network."
echo "   Make sure your firewall allows port 3000 if needed."
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Set environment variable and start server
export HOST=0.0.0.0
pnpm web
