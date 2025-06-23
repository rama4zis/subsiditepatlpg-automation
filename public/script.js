function parseNikData(nikData) {
    // Split by enter, comma, space, and semicolon
    const delimiters = /[\n\r,;\s]+/;

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

    if (!nikData.trim()) {
        showStatus('Please enter NIK data', 'error');
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
            body: JSON.stringify({ nikData })
        });

        const result = await response.json();

        if (response.ok) {
            showStatus(
                `✅ Processing started! ${result.nikCount} NIK numbers queued for automation. Check the terminal/console for progress.`,
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

        } else {
            showStatus(`❌ Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Network error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});

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