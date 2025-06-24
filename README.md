# Subsidi Tepat LPG Automation

A web-based automation tool for processing NIK numbers with real-time progress tracking and Excel report generation.

## Features

- **Web Interface**: Easy-to-use web form for inputting NIK numbers
- **Batch Processing**: Process multiple NIK numbers with optional limits
- **Real-time Progress**: Live progress tracking with estimated completion time
- **Excel Reports**: Automatic Excel file generation and download
- **Smart Parsing**: Support for multiple input formats (comma, space, newline, semicolon)
- **Error Handling**: Robust error handling with detailed error messages
- **File Cleanup**: Automatic cleanup of temporary files after download

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rama4zis/subsiditepatlpg-automation.git
cd subsiditepatlpg-automation
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file with your credentials:
```env
EMAIL=your_email@example.com
PASSWORD=your_password
```

## Running the Application

### Local Development (localhost only)
```bash
pnpm web
```
Access at: http://localhost:3000

### Network Access (accessible from other devices)

#### Option 1: Using the helper script
**Linux/Mac:**
```bash
./start-public.sh
```

**Windows:**
```batch
start-public.bat
```

#### Option 2: Manual setup
```bash
export HOST=0.0.0.0
pnpm web
```

**Or use the dedicated script:**
```bash
pnpm web:public
```

The server will display all available network addresses when it starts.

### Production Build
```bash
pnpm build
pnpm web:build
```

## Usage

1. Open the web interface in your browser
2. Enter NIK numbers in the text area (supports multiple formats)
3. Optionally set a processing limit
4. Click "Preview NIKs" to validate your input
5. Click "Start Automation" to begin processing
6. Monitor real-time progress
7. Download the Excel report when complete

## Network Access & Security

When running with network access (`HOST=0.0.0.0`), the server will be accessible from:
- Your local machine: `http://localhost:3000`
- Other devices on your network: `http://YOUR_IP_ADDRESS:3000`

**Security Considerations:**
- The server will be accessible to anyone on your network
- Make sure your firewall settings allow port 3000 if needed
- Only run on trusted networks
- Consider using a VPN for remote access

## Environment Variables

- `HOST`: Server host (default: localhost, use 0.0.0.0 for network access)
- `PORT`: Server port (default: 3000)
- `EMAIL`: Login email for the automation
- `PASSWORD`: Login password for the automation
- `PUPPETEER_EXECUTABLE_PATH`: Custom Chrome/Chromium path if needed

## File Structure

```
├── src/
│   ├── web-server.ts          # Main web server
│   ├── logic/
│   │   ├── login.ts           # Login automation
│   │   ├── input-data.ts      # Data processing logic
│   │   └── excel-export.ts    # Excel generation
├── public/
│   ├── index.html            # Web interface
│   ├── script.js             # Frontend JavaScript
│   └── style.css             # Styling
├── reports/                  # Generated Excel files (auto-cleanup)
├── start-public.sh          # Linux/Mac startup script
└── start-public.bat         # Windows startup script
```

## API Endpoints

- `POST /api/process-nik` - Start NIK processing
- `GET /api/status` - Get processing status
- `GET /api/download-report` - Download Excel report
- `POST /api/reset` - Reset automation state

## License

ISC