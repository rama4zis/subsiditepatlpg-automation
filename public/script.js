let totalData;
let currentSessionId = null; // Store current session ID

function parseNikData(nikData) {
    // Split by enter, comma, space, and semicolon
    const delimiters = /[\n\r,;\s]+/;

    totalData = nikData.split(delimiters).length;

    return nikData
        .split(delimiters)
        .map(nik => nik.trim())
        .filter(nik => nik.length > 0)
        .filter(nik => /^\d{16}$/.test(nik)); // Validate NIK format (16 digits)
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

function showSessionInfo(sessionId, status) {
    const sessionInfo = document.getElementById('sessionInfo');
    const sessionIdSpan = document.getElementById('sessionId');
    const sessionStatusSpan = document.getElementById('sessionStatus');
    
    if (sessionInfo && sessionIdSpan && sessionStatusSpan) {
        sessionIdSpan.textContent = sessionId;
        sessionStatusSpan.textContent = status;
        sessionInfo.style.display = 'block';
    }
}

function hideSessionInfo() {
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.style.display = 'none';
    }
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('submitBtn').disabled = true;
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
}

// Preview functionality
document.getElementById('previewBtn').addEventListener('click', function () {
    const nikData = document.getElementById('nikData').value;

    if (!nikData.trim()) {
        showStatus('Please enter some NIK data first', 'error');
        return;
    }

    const nikNumbers = parseNikData(nikData);
    const preview = document.getElementById('preview');
    const nikList = document.getElementById('nikList');
    const nikCount = document.getElementById('nikCount');

    if (nikNumbers.length === 0) {
        showStatus('No valid NIK numbers found. Please check your input format.', 'error');
        preview.style.display = 'none';
        return;
    }

    // Display NIKs
    nikList.innerHTML = nikNumbers.map(nik =>
        `<div class="nik-item">${nik}</div>`
    ).join('');

    nikCount.textContent = `Total: ${nikNumbers.length} valid NIK numbers`;
    preview.style.display = 'block';
    hideStatus();
});

// Form submission
document.getElementById('nikForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const nikData = document.getElementById('nikData').value;
    const limiter = document.getElementById('limiter').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!nikData.trim()) {
        showStatus('Please enter NIK data', 'error');
        return;
    }

    if (!username.trim()) {
        showStatus('Please enter your username/email', 'error');
        return;
    }

    if (!password.trim()) {
        showStatus('Please enter your password', 'error');
        return;
    }

    const nikNumbers = parseNikData(nikData);

    if (nikNumbers.length === 0) {
        showStatus('No valid NIK numbers found. Please check your input format.', 'error');
        return;
    }

    showLoading();
    hideStatus();

    try {
        const response = await fetch('/api/process-nik', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                nikData,
                limiter: limiter ? parseInt(limiter) : null,
                username: username.trim(),
                password: password.trim()
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Store the session ID for this user's session
            currentSessionId = result.sessionId;
            console.log(`📋 Session ID: ${currentSessionId}`);
            
            // Show session info
            showSessionInfo(currentSessionId, 'Processing');
            
            const limitText = result.limit && result.limit < result.totalCount ? ` (Limited to ${result.limit} successful entries)` : '';
            showStatus(
                `✅ Processing started! ${result.nikCount} NIK numbers queued for automation${limitText}. Estimated time: ${result.estimatedTimeMinutes || 'calculating'} minutes.`,
                'success'
            );

            // Show preview of what's being processed
            const preview = document.getElementById('preview');
            const nikList = document.getElementById('nikList');
            const nikCount = document.getElementById('nikCount');

            nikList.innerHTML = result.nikNumbers.map(nik =>
                `<div class="nik-item">${nik}</div>`
            ).join('');

            if (result.totalCount > 5) {
                nikList.innerHTML += `<div class="nik-item" style="background: #e9ecef; font-style: italic;">... and ${result.totalCount - 5} more</div>`;
            }

            nikCount.textContent = `Total: ${result.totalCount} NIK numbers being processed`;
            preview.style.display = 'block';

            // Start polling for progress
            setTimeout(pollProgress, 2000);

        } else {
            showStatus(`❌ Error: ${result.error}`, 'error');
            hideLoading();
        }
    } catch (error) {
        showStatus(`❌ Network error: ${error.message}`, 'error');
        hideLoading();
    }
});

// Progress tracking functions
function updateProgress(progressData) {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const progressFill = document.getElementById('progressFill');
    
    // Update session status
    if (currentSessionId) {
        showSessionInfo(currentSessionId, progressData.status || 'Unknown');
    }
    
    if (progressData.status === 'processing') {
        if (progressFill) progressFill.style.width = `${progressData.progress}%`;
        const limitInfo = progressData.limit ? ` (Limit: ${progressData.successfulProcessed || 0}/${progressData.limit})` : '';
        if (loadingText) {
            loadingText.innerHTML = `
                🔄 Processing NIK ${progressData.processed + 1}/${progressData.total}
                Current: ${progressData.current}
                Progress: ${progressData.progress}%${limitInfo}
                Elapsed: ${progressData.elapsedTime}
                Remaining: ${progressData.remainingTime}
            `;
        }
    } else if (progressData.status === 'completed') {
        if (progressFill) progressFill.style.width = '100%';
        if (loadingText) loadingText.innerHTML = `✅ Processing completed! Downloading report...`;
    } else if (progressData.status === 'error') {
        if (loadingText) loadingText.innerHTML = `❌ Error occurred during processing`;
    }
}

async function downloadReport() {
    if (!currentSessionId) {
        showStatus('❌ No session ID available for download', 'error');
        return;
    }

    try {
        console.log(`🔄 Starting download for session ${currentSessionId}...`);
        // Use session-specific endpoint
        const response = await fetch(`/api/download-report/${currentSessionId}`);
        
        console.log('📥 Download response status:', response.status);
        
        if (response.ok) {
            const blob = await response.blob();
            console.log('📊 Downloaded blob size:', blob.size, 'bytes');
            
            if (blob.size === 0) {
                showStatus('❌ Downloaded file is empty', 'error');
                return;
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Get filename from response headers
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'subsidite-pat-lpg-report.xlsx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('✅ Download triggered successfully');
            showStatus('✅ Report downloaded successfully!', 'success');
        } else {
            const errorData = await response.json();
            console.error('❌ Download failed:', errorData);
            showStatus(`❌ Failed to download report: ${errorData.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('❌ Download error:', error);
        showStatus(`❌ Download error: ${error.message}`, 'error');
    }
}

async function pollProgress() {
    if (!currentSessionId) {
        console.log('❌ No session ID available for polling');
        return;
    }

    try {
        // Use session-specific endpoint
        const response = await fetch(`/api/status/${currentSessionId}`);
        const progressData = await response.json();

        if (progressData.status === 'Session not found or expired') {
            showStatus('❌ Session expired or not found', 'error');
            hideLoading();
            currentSessionId = null;
            return;
        }
        
        if (progressData.status && progressData.status !== 'No active processing') {
            updateProgress(progressData);
            
            if (progressData.status === 'completed' && progressData.hasReport) {
                // Wait a moment then download
                setTimeout(async () => {
                    await downloadReport();
                    hideLoading();
                }, 1000);
            } else if (progressData.status === 'error') {
                hideLoading();
                showStatus('❌ Processing failed. Check console for details.', 'error');
            } else if (progressData.status === 'processing') {
                // Continue polling
                setTimeout(pollProgress, 2000);
            }
        }
    } catch (error) {
        console.error('Error polling progress:', error);
        setTimeout(pollProgress, 5000); // Retry after 5 seconds on error
    }
}

// Auto-preview on input change (debounced)
let previewTimeout;
document.getElementById('nikData').addEventListener('input', function () {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
        const nikData = this.value;
        if (nikData.trim()) {
            const nikNumbers = parseNikData(nikData);
            if (nikNumbers.length > 0) {
                document.getElementById('previewBtn').click();
            }
        } else {
            document.getElementById('preview').style.display = 'none';
        }
    }, 1000);
});

// Function to show reset button
function showResetButton() {
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.style.display = 'inline-block';
    }
}

// Function to reset automation
async function resetAutomation() {
    try {
        let resetUrl = '/api/reset';
        if (currentSessionId) {
            resetUrl = `/api/reset/${currentSessionId}`;
        }

        const response = await fetch(resetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            // Reset UI
            hideLoading();
            hideStatus();
            hideSessionInfo();
            document.getElementById('preview').style.display = 'none';
            document.getElementById('resetBtn').style.display = 'none';
            document.getElementById('nikData').value = '';
            document.getElementById('limiter').value = '';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            
            // Clear session ID
            currentSessionId = null;
            
            showStatus('✅ Automation reset successfully!', 'success');
            setTimeout(() => hideStatus(), 3000);
        } else {
            showStatus('❌ Failed to reset automation', 'error');
        }
    } catch (error) {
        showStatus(`❌ Reset error: ${error.message}`, 'error');
    }
}