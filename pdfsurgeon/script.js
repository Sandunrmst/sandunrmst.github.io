
/*
* Author: RMST
* Version: 2.0
*/



const { PDFDocument } = PDFLib;

// --- STATE ---
let mergeFiles = []; // Array of File objects
let splitFile = null; // Single File object
let splitFileDoc = null; // Loaded PDFDocument
let selectedPages = new Set(); // Set of 0-based page indices

// --- DOM ELEMENTS ---
const tabs = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// Merge Elements
const mergeUploadArea = document.getElementById('merge-upload-area');
const mergeFileInput = document.getElementById('merge-file-input');
const fileListEl = document.getElementById('file-list');
const mergeBtn = document.getElementById('merge-btn');
const mergeHelpText = document.getElementById('merge-help-text');

// Split Elements
const splitUploadArea = document.getElementById('split-upload-area');
const splitFileInput = document.getElementById('split-file-input');
const splitPreview = document.getElementById('split-preview');
const pagesGrid = document.getElementById('pages-grid');
const splitBtn = document.getElementById('split-btn');
const splitModeRadios = document.getElementsByName('split-mode');
const rangeInputContainer = document.getElementById('range-input-container');
const rangeInput = document.getElementById('range-input');

// --- INITIALIZATION ---
function init() {
    setupTabs();
    setupMergeEvents();
    setupSplitEvents();
    setupCompressEvents();
    setupConvertEvents();
    setupEditEvents();
    setupSecurityEvents();
    setupWelcomePopup();
}

// --- TABS ---
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

// --- MERGE SECTION ---
function setupMergeEvents() {
    // Drag & Drop
    mergeUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        mergeUploadArea.classList.add('dragover');
    });
    mergeUploadArea.addEventListener('dragleave', () => {
        mergeUploadArea.classList.remove('dragover');
    });
    mergeUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        mergeUploadArea.classList.remove('dragover');
        handleMergeFiles(e.dataTransfer.files);
    });

    // File Input
    mergeFileInput.addEventListener('change', (e) => {
        handleMergeFiles(e.target.files);
    });

    // Merge Button
    mergeBtn.addEventListener('click', mergePDFs);
}

function handleMergeFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (newFiles.length === 0) return;

    mergeFiles = [...mergeFiles, ...newFiles];
    renderMergeList();
}

function renderMergeList() {
    fileListEl.innerHTML = '';
    mergeFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.draggable = true;
        li.dataset.index = index;

        // Create preview container
        const previewDiv = document.createElement('div');
        previewDiv.className = 'file-preview';
        previewDiv.id = `preview-${index}`;
        previewDiv.textContent = '...'; // Loading placeholder

        li.innerHTML = `
            <div class="file-info">${file.name}</div>
            <div class="file-controls">
                <button onclick="moveFile(${index}, -1)" title="Move Up" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
                <button onclick="moveFile(${index}, 1)" title="Move Down" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="separator"></div>
                <button class="remove btn-icon" onclick="removeFile(${index})" title="Remove">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        // Insert preview at the beginning
        li.insertBefore(previewDiv, li.firstChild);

        // Drag sorting events
        li.addEventListener('dragstart', () => {
            li.classList.add('dragging');
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            updateMergeFilesOrder(); // Sync array with DOM
        });

        fileListEl.appendChild(li);

        // Generate Thumbnail
        generateThumbnail(file, index);
    });

    // Update Help Text
    if (mergeFiles.length > 0) {
        mergeHelpText.textContent = "Tip: Drag and drop files to reorder them. The top file will be the first page in the merged PDF.";
        mergeHelpText.classList.remove('hidden');
        mergeBtn.disabled = false;
    } else {
        mergeHelpText.classList.add('hidden');
        mergeBtn.disabled = true;
    }
}

// Enable Drag Over on the list container to allow sorting
fileListEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(fileListEl, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (afterElement == null) {
        fileListEl.appendChild(draggable);
    } else {
        fileListEl.insertBefore(draggable, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.file-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateMergeFilesOrder() {
    const newOrder = [];
    const items = fileListEl.querySelectorAll('.file-item');
    items.forEach(item => {
        const index = parseInt(item.dataset.index);
        newOrder.push(mergeFiles[index]);
    });

    // Update the main array
    // We need to be careful here because dataset.index is old.
    // Actually, it's better to just rebuild the array based on the DOM elements,
    // but we need to map back to the original file objects.
    // The dataset.index points to the index in the *original* mergeFiles array *before* this reorder started?
    // No, renderMergeList re-assigns indices.
    // So dataset.index is correct relative to the current mergeFiles state.

    // Let's create a temporary map to hold files
    const currentFilesMap = [...mergeFiles];
    mergeFiles = [];

    items.forEach(item => {
        const oldIndex = parseInt(item.dataset.index);
        mergeFiles.push(currentFilesMap[oldIndex]);
    });

    // Re-render to update indices
    renderMergeList();
}

async function generateThumbnail(file, index) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 0.5; // Small thumbnail
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        const previewDiv = document.getElementById(`preview-${index}`);
        if (previewDiv) {
            previewDiv.textContent = '';
            previewDiv.appendChild(canvas);
        }
    } catch (err) {
        console.error('Error generating thumbnail:', err);
        const previewDiv = document.getElementById(`preview-${index}`);
        if (previewDiv) previewDiv.textContent = 'Err';
    }
}

// Global functions for inline onclick handlers
window.moveFile = (index, direction) => {
    if ((index === 0 && direction === -1) || (index === mergeFiles.length - 1 && direction === 1)) return;

    const temp = mergeFiles[index];
    mergeFiles[index] = mergeFiles[index + direction];
    mergeFiles[index + direction] = temp;
    renderMergeList();
};

window.removeFile = (index) => {
    mergeFiles.splice(index, 1);
    renderMergeList();
};

// Drag & Drop Sorting Logic - Handled by live sorting event listeners above

async function mergePDFs() {
    if (mergeFiles.length < 2) return;

    try {
        mergeBtn.textContent = 'Merging...';
        mergeBtn.disabled = true;

        const mergedPdf = await PDFDocument.create();

        for (const file of mergeFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        triggerDownloadAnimation(mergeBtn);
        downloadFile(pdfBytes, 'merged.pdf');

    } catch (err) {
        console.error(err);
        showNotification('Error merging PDFs. See console for details.', 'error');
    } finally {
        mergeBtn.textContent = 'Merge PDF';
        mergeBtn.disabled = false;
    }
}

// --- SPLIT SECTION ---
function setupSplitEvents() {
    // Drag & Drop
    splitUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        splitUploadArea.classList.add('dragover');
    });
    splitUploadArea.addEventListener('dragleave', () => {
        splitUploadArea.classList.remove('dragover');
    });
    splitUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        splitUploadArea.classList.remove('dragover');
        handleSplitFile(e.dataTransfer.files[0]);
    });

    // File Input
    splitFileInput.addEventListener('change', (e) => {
        handleSplitFile(e.target.files[0]);
    });

    // Help Text Element
    const helpTextEl = document.getElementById('split-help-text');
    const updateHelpText = (mode) => {
        if (mode === 'all') {
            helpTextEl.textContent = "Tip: Select specific pages by clicking on them. If no pages are selected, all pages will be split into separate files.";
        } else {
            helpTextEl.textContent = "Enter a range of pages to extract (e.g., 1-5, 8, 11-13).";
        }
    };

    // Initialize Help Text
    updateHelpText('all');

    // Radio Buttons
    Array.from(splitModeRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            updateHelpText(mode);

            if (mode === 'range') {
                rangeInputContainer.classList.remove('hidden');
                // Clear selection when switching to range mode
                selectedPages.clear();
                document.querySelectorAll('.page-item.selected').forEach(el => el.classList.remove('selected'));
            } else {
                rangeInputContainer.classList.add('hidden');
            }
        });
    });

    // Split Button
    splitBtn.addEventListener('click', splitPDF);
}

async function handleSplitFile(file) {
    if (!file || file.type !== 'application/pdf') return;

    splitFile = file;

    try {
        const arrayBuffer = await file.arrayBuffer();
        splitFileDoc = await PDFDocument.load(arrayBuffer);

        await renderSplitPreview(splitFileDoc.getPageCount());
        splitPreview.classList.remove('hidden');
        splitUploadArea.classList.add('hidden'); // Hide upload area to simplify UI
    } catch (err) {
        console.error(err);
        showNotification('Error loading PDF.', 'error');
    }
}

async function renderSplitPreview(pageCount) {
    pagesGrid.innerHTML = '';
    selectedPages.clear(); // Reset selection

    // We need the document to render pages
    if (!splitFileDoc) return;

    for (let i = 1; i <= pageCount; i++) {
        const div = document.createElement('div');
        div.className = 'page-item';
        div.dataset.pageIndex = i - 1; // Store 0-based index

        // Click to select
        div.addEventListener('click', () => {
            togglePageSelection(i - 1, div);
        });

        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'page-canvas-container';
        div.appendChild(canvasContainer);

        // Label
        const label = document.createElement('div');
        label.className = 'page-label';
        label.textContent = `Page ${i}`;
        div.appendChild(label);

        pagesGrid.appendChild(div);

        // Render Page Async
        renderPageThumbnail(splitFileDoc, i, canvasContainer);
    }
}

function togglePageSelection(index, element) {
    const mode = document.querySelector('input[name="split-mode"]:checked').value;
    if (mode === 'range') return; // Disable selection in range mode

    if (selectedPages.has(index)) {
        selectedPages.delete(index);
        element.classList.remove('selected');
    } else {
        selectedPages.add(index);
        element.classList.add('selected');
    }
}

async function renderPageThumbnail(pdfDoc, pageNum, container) {
    try {
        // We need to use pdfjsLib for rendering, but splitFileDoc is a PDFLib document.
        // We need to load the document with pdfjsLib separately or pass the array buffer.
        // Let's use the global splitFile (File object) to load with pdfjsLib.

        if (!splitFile) return;
        const arrayBuffer = await splitFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNum);

        const scale = 0.3; // Thumbnail scale
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        container.appendChild(canvas);

    } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
        container.textContent = 'Err';
    }
}

async function splitPDF() {
    if (!splitFileDoc) return;

    const mode = document.querySelector('input[name="split-mode"]:checked').value;
    const pageCount = splitFileDoc.getPageCount();

    try {
        splitBtn.textContent = 'Splitting...';
        splitBtn.disabled = true;

        if (mode === 'all') {
            // If pages are selected, split ONLY those.
            // If NO pages are selected, split ALL (default behavior).

            let pagesToSplit = [];
            if (selectedPages.size > 0) {
                pagesToSplit = Array.from(selectedPages).sort((a, b) => a - b);
            } else {
                // Create array [0, 1, ..., pageCount-1]
                pagesToSplit = Array.from({ length: pageCount }, (_, i) => i);
            }

            for (const pageIndex of pagesToSplit) {
                const newPdf = await PDFDocument.create();
                const [page] = await newPdf.copyPages(splitFileDoc, [pageIndex]);
                newPdf.addPage(page);
                const pdfBytes = await newPdf.save();
                triggerDownloadAnimation(splitBtn);
                downloadFile(pdfBytes, `page-${pageIndex + 1}.pdf`);
                // Small delay to prevent browser throttling
                await new Promise(r => setTimeout(r, 200));
            }

        } else if (mode === 'range') {
            const rangeStr = rangeInput.value.trim();
            if (!rangeStr) {
                showNotification('Please enter a range.', 'warning');
                rangeInput.focus();
                rangeInput.classList.add('input-error');
                setTimeout(() => rangeInput.classList.remove('input-error'), 500);
                return;
            }

            const indices = parseRange(rangeStr, pageCount);
            if (indices.length === 0) {
                showNotification('Invalid range format.', 'error');
                rangeInput.focus();
                rangeInput.classList.add('input-error');
                setTimeout(() => rangeInput.classList.remove('input-error'), 500);
                return;
            }

            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(splitFileDoc, indices);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            triggerDownloadAnimation(splitBtn);
            downloadFile(pdfBytes, `split-range.pdf`);
        }

    } catch (err) {
        console.error(err);
        showNotification('Error splitting PDF.', 'error');
    } finally {
        splitBtn.textContent = 'Split PDF';
        splitBtn.disabled = false;
    }
}

function parseRange(rangeStr, maxPages) {
    // Supports "1-3, 5, 7-9"
    const indices = new Set();
    const parts = rangeStr.split(',');

    parts.forEach(part => {
        const p = part.trim();
        if (p.includes('-')) {
            const [start, end] = p.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= maxPages) indices.add(i - 1);
                }
            }
        } else {
            const num = parseInt(p);
            if (!isNaN(num) && num >= 1 && num <= maxPages) {
                indices.add(num - 1);
            }
        }
    });

    return Array.from(indices).sort((a, b) => a - b);
}

// --- NOTIFICATIONS ---
function showNotification(message, type = 'info') {
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-message">${message}</div>
    `;

    container.appendChild(notification);

    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s forwards';
        notification.addEventListener('animationend', () => {
            notification.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 3000);
}

// --- ANIMATION ---
function triggerDownloadAnimation(buttonElement) {
    const rect = buttonElement.getBoundingClientRect();
    const particle = document.createElement('div');
    particle.className = 'download-particle';

    // Start position (center of button)
    const startX = rect.left + rect.width / 2 - 12; // 12 is half width
    const startY = rect.top + rect.height / 2 - 16; // 16 is half height

    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;

    document.body.appendChild(particle);

    // Target position (Top Right corner)
    // We calculate the translation needed
    const targetX = window.innerWidth - 50; // 50px from right
    const targetY = 50; // 50px from top

    const tx = targetX - startX;
    const ty = targetY - startY;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    // Trigger animation
    requestAnimationFrame(() => {
        particle.style.animation = 'flyToTopRight 2s cubic-bezier(0.19, 1, 0.22, 1) forwards';
    });

    // Cleanup
    particle.addEventListener('animationend', () => {
        particle.remove();
    });
}

// --- COMPRESS SECTION ---
let compressFile = null;

function setupCompressEvents() {
    const compressUploadArea = document.getElementById('compress-upload-area');
    const compressFileInput = document.getElementById('compress-file-input');
    const compressBtn = document.getElementById('compress-btn');

    // Drag & Drop
    compressUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        compressUploadArea.classList.add('dragover');
    });
    compressUploadArea.addEventListener('dragleave', () => {
        compressUploadArea.classList.remove('dragover');
    });
    compressUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        compressUploadArea.classList.remove('dragover');
        handleCompressFile(e.dataTransfer.files[0]);
    });

    // File Input
    compressFileInput.addEventListener('change', (e) => {
        handleCompressFile(e.target.files[0]);
    });

    // Compress Button
    compressBtn.addEventListener('click', compressPDF);
}

function handleCompressFile(file) {
    if (!file || file.type !== 'application/pdf') return;

    compressFile = file;

    // Show Options
    document.getElementById('compress-upload-area').classList.add('hidden');
    document.getElementById('compress-options-container').classList.remove('hidden');

    // Show File Info
    const infoEl = document.getElementById('compress-file-info');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    infoEl.textContent = `Selected File: ${file.name} (${sizeMB} MB)`;
}

async function compressPDF() {
    if (!compressFile) return;

    const compressBtn = document.getElementById('compress-btn');
    const level = document.querySelector('input[name="compress-level"]:checked').value;

    // Compression Settings
    // Extreme: Low quality, standard scale
    // Recommended: High quality, standard scale
    // Note: We can also adjust scale to reduce size further

    let quality = 0.7;
    let scale = 1.0; // Render scale (1.0 = 72 DPI usually, but pdf.js renders at viewport)

    if (level === 'low') {
        quality = 0.4;
        scale = 1.0; // Keep standard scale but low JPEG quality
    } else if (level === 'high') {
        quality = 0.9;
        scale = 2.0; // Double resolution for best quality
    } else {
        // Standard
        quality = 0.7;
        scale = 1.5; // Higher resolution for better readability
    }

    try {
        compressBtn.textContent = 'Compressing... (This may take a while)';
        compressBtn.disabled = true;

        const arrayBuffer = await compressFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;

        const newPdf = await PDFDocument.create();

        for (let i = 1; i <= pageCount; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Convert to JPEG
            const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
            const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());

            const embeddedImage = await newPdf.embedJpg(imgBytes);

            // Add page to new PDF matching image dimensions
            const newPage = newPdf.addPage([embeddedImage.width, embeddedImage.height]);
            newPage.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width: embeddedImage.width,
                height: embeddedImage.height,
            });

            // Update progress (optional, but good for UX)
            compressBtn.textContent = `Compressing Page ${i} of ${pageCount}...`;

            // Yield to UI thread
            await new Promise(r => setTimeout(r, 10));
        }

        const pdfBytes = await newPdf.save();
        triggerDownloadAnimation(compressBtn);
        downloadFile(pdfBytes, `compressed-${level}.pdf`);

    } catch (err) {
        console.error('Compression Error:', err);
        showNotification('Error compressing PDF.', 'error');

    } finally {
        compressBtn.textContent = 'Compress PDF';
        compressBtn.disabled = false;
    }
}

// --- UTILS ---
function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Start
init();

// --- CONVERT SECTION ---
function setupConvertEvents() {
    const convertModeRadios = document.getElementsByName('convert-mode');

    convertModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const targetId = e.target.value;

            // Hide all sub-tab panes
            const subTabPanes = document.querySelectorAll('#convert-tab .sub-tab-pane');
            subTabPanes.forEach(p => p.classList.remove('active'));

            // Show corresponding pane
            document.getElementById(targetId).classList.add('active');
        });
    });

    setupConvertToPDFEvents();
}


// --- CONVERT TO PDF LOGIC ---
let jpgFiles = [];
let wordFile = null;
let excelFile = null;

function setupConvertToPDFEvents() {
    // Radio Buttons
    const typeRadios = document.getElementsByName('convert-to-type');
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('jpg-to-pdf-section').classList.add('hidden');
            document.getElementById('word-to-pdf-section').classList.add('hidden');
            document.getElementById('excel-to-pdf-section').classList.add('hidden');

            if (type === 'jpg-to-pdf') {
                document.getElementById('jpg-to-pdf-section').classList.remove('hidden');
            } else if (type === 'word-to-pdf') {
                document.getElementById('word-to-pdf-section').classList.remove('hidden');
            } else if (type === 'excel-to-pdf') {
                document.getElementById('excel-to-pdf-section').classList.remove('hidden');
            }
        });
    });

    // JPG Events
    const jpgInput = document.getElementById('jpg-file-input');
    const jpgUploadArea = document.getElementById('jpg-upload-area');
    const jpgConvertBtn = document.getElementById('jpg-convert-btn');

    jpgInput.addEventListener('change', (e) => handleJPGFiles(e.target.files));

    jpgUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        jpgUploadArea.classList.add('dragover');
    });
    jpgUploadArea.addEventListener('dragleave', () => jpgUploadArea.classList.remove('dragover'));
    jpgUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        jpgUploadArea.classList.remove('dragover');
        handleJPGFiles(e.dataTransfer.files);
    });

    jpgConvertBtn.addEventListener('click', convertJPGtoPDF);

    // JPG List Drag Over (for reordering)
    const jpgFileList = document.getElementById('jpg-file-list');
    jpgFileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(jpgFileList, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            jpgFileList.appendChild(draggable);
        } else {
            jpgFileList.insertBefore(draggable, afterElement);
        }
    });

    // Word Events
    const wordInput = document.getElementById('word-file-input');
    const wordUploadArea = document.getElementById('word-upload-area');
    const wordConvertBtn = document.getElementById('word-convert-btn');

    wordInput.addEventListener('change', (e) => handleWordFile(e.target.files[0]));

    wordUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        wordUploadArea.classList.add('dragover');
    });
    wordUploadArea.addEventListener('dragleave', () => wordUploadArea.classList.remove('dragover'));
    wordUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        wordUploadArea.classList.remove('dragover');
        handleWordFile(e.dataTransfer.files[0]);
    });

    wordConvertBtn.addEventListener('click', convertWordToPDF);

    // Excel Events
    const excelInput = document.getElementById('excel-file-input');
    const excelUploadArea = document.getElementById('excel-upload-area');
    const excelConvertBtn = document.getElementById('excel-convert-btn');

    excelInput.addEventListener('change', (e) => handleExcelFile(e.target.files[0]));

    excelUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        excelUploadArea.classList.add('dragover');
    });
    excelUploadArea.addEventListener('dragleave', () => excelUploadArea.classList.remove('dragover'));
    excelUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        excelUploadArea.classList.remove('dragover');
        handleExcelFile(e.dataTransfer.files[0]);
    });

    excelConvertBtn.addEventListener('click', convertExcelToPDF);
}

function handleJPGFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type === 'image/jpeg' || f.type === 'image/jpg' || f.type === 'image/png');
    if (newFiles.length === 0) return;

    jpgFiles = [...jpgFiles, ...newFiles];
    renderJPGList();
}

function renderJPGList() {
    const listEl = document.getElementById('jpg-file-list');
    const btn = document.getElementById('jpg-convert-btn');

    listEl.innerHTML = '';
    jpgFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.draggable = true;
        div.dataset.index = index;

        // Create preview container
        const previewDiv = document.createElement('div');
        previewDiv.className = 'file-preview';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        previewDiv.appendChild(img);

        div.innerHTML = `
            <div class="file-info">${file.name}</div>
            <div class="file-controls">
                <button onclick="moveJPG(${index}, -1)" title="Move Up" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
                <button onclick="moveJPG(${index}, 1)" title="Move Down" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="separator"></div>
                <button class="btn-icon remove" onclick="removeJPG(${index})">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        // Insert preview at the beginning
        div.insertBefore(previewDiv, div.firstChild);

        // Drag sorting events
        div.addEventListener('dragstart', () => {
            div.classList.add('dragging');
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            updateJPGFilesOrder();
        });

        listEl.appendChild(div);
    });

    const helpText = document.getElementById('jpg-help-text');

    if (jpgFiles.length > 0) {
        document.getElementById('jpg-upload-area').classList.add('hidden');
        helpText.textContent = "Tip: Drag and drop files to reorder them. The top file will be the first page in the merged PDF.";
        helpText.classList.remove('hidden');
        btn.disabled = false;
    } else {
        document.getElementById('jpg-upload-area').classList.remove('hidden');
        helpText.classList.add('hidden');
        btn.disabled = true;
    }
}

window.moveJPG = (index, direction) => {
    if ((index === 0 && direction === -1) || (index === jpgFiles.length - 1 && direction === 1)) return;

    const temp = jpgFiles[index];
    jpgFiles[index] = jpgFiles[index + direction];
    jpgFiles[index + direction] = temp;
    renderJPGList();
};

function updateJPGFilesOrder() {
    const listEl = document.getElementById('jpg-file-list');
    const items = listEl.querySelectorAll('.file-item');

    const currentFilesMap = [...jpgFiles];
    jpgFiles = [];

    items.forEach(item => {
        const oldIndex = parseInt(item.dataset.index);
        jpgFiles.push(currentFilesMap[oldIndex]);
    });

    renderJPGList();
}

window.removeJPG = (index) => {
    jpgFiles.splice(index, 1);
    renderJPGList();
};

async function convertJPGtoPDF() {
    if (jpgFiles.length === 0) return;

    const btn = document.getElementById('jpg-convert-btn');
    try {
        btn.textContent = 'Converting...';
        btn.disabled = true;

        const pdfDoc = await PDFDocument.create();

        for (const file of jpgFiles) {
            const arrayBuffer = await file.arrayBuffer();
            let image;

            if (file.type === 'image/png') {
                image = await pdfDoc.embedPng(arrayBuffer);
            } else {
                image = await pdfDoc.embedJpg(arrayBuffer);
            }

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        triggerDownloadAnimation(btn);
        downloadFile(pdfBytes, 'images-converted.pdf');

    } catch (err) {
        console.error(err);
        showNotification('Error converting images.', 'error');
    } finally {
        btn.textContent = 'Convert to PDF';
        btn.disabled = false;
    }
}

function handleWordFile(file) {
    if (!file || !file.name.endsWith('.docx')) return;

    wordFile = file;
    const infoEl = document.getElementById('word-file-info');
    const btn = document.getElementById('word-convert-btn');
    const uploadArea = document.getElementById('word-upload-area');

    uploadArea.classList.add('hidden');

    // Create UI for selected file
    infoEl.innerHTML = `
        <div class="file-item" style="margin:0; border:var(--primary-color) 1px solid;">
            <div class="file-info">${file.name}</div>
            <div class="file-controls">
                <button class="btn-icon remove" onclick="removeWordFile()" title="Remove">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;

    infoEl.classList.remove('hidden');
    btn.disabled = false;
}

window.removeWordFile = () => {
    wordFile = null;
    const infoEl = document.getElementById('word-file-info');
    const btn = document.getElementById('word-convert-btn');
    const uploadArea = document.getElementById('word-upload-area');
    const input = document.getElementById('word-file-input');

    input.value = ''; // Reset input
    infoEl.classList.add('hidden');
    infoEl.innerHTML = '';
    uploadArea.classList.remove('hidden');
    btn.disabled = true;
};

async function convertWordToPDF() {
    if (!wordFile) return;

    const btn = document.getElementById('word-convert-btn');

    try {
        btn.textContent = 'Preparing...';
        btn.disabled = true;

        const arrayBuffer = await wordFile.arrayBuffer();

        // 1. Convert DOCX to HTML using Mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const html = result.value;
        const messages = result.messages;

        if (messages.length > 0) {
            console.warn('Mammoth warnings:', messages);
        }

        if (!html) {
            throw new Error('No content extracted from Word file.');
        }

        // 2. Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        // 3. Write HTML to iframe
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>${wordFile.name.replace('.docx', '')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #000;
                        padding: 20px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    img { max-width: 100%; height: auto; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
                    td, th { border: 1px solid #ddd; padding: 8px; }
                    @media print {
                        body { padding: 0; margin: 2cm; }
                    }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();

        showNotification('Print dialog opened. Please select "Save as PDF".', 'success');

    } catch (err) {
        console.error('Word to PDF Error:', err);
        showNotification('Error processing Word file.', 'error');
    } finally {
        btn.textContent = 'Convert to PDF';
        btn.disabled = false;
    }
}

// --- EXCEL TO PDF LOGIC ---
function handleExcelFile(file) {
    if (!file || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls'))) return;

    excelFile = file;
    const infoEl = document.getElementById('excel-file-info');
    const btn = document.getElementById('excel-convert-btn');
    const uploadArea = document.getElementById('excel-upload-area');

    uploadArea.classList.add('hidden');

    // Create UI for selected file (mimicking Word feature)
    infoEl.innerHTML = `
        <div class="file-item" style="margin:0; border:var(--primary-color) 1px solid;">
            <div class="file-info">${file.name}</div>
            <div class="file-controls">
                <button class="btn-icon remove" onclick="removeExcelFile()" title="Remove">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;

    infoEl.classList.remove('hidden');
    btn.disabled = false;
}

window.removeExcelFile = () => {
    excelFile = null;
    const infoEl = document.getElementById('excel-file-info');
    const btn = document.getElementById('excel-convert-btn');
    const uploadArea = document.getElementById('excel-upload-area');
    const input = document.getElementById('excel-file-input');

    input.value = ''; // Reset input
    infoEl.classList.add('hidden');
    infoEl.innerHTML = '';
    uploadArea.classList.remove('hidden');
    btn.disabled = true;
};

async function convertExcelToPDF() {
    if (!excelFile) return;

    const btn = document.getElementById('excel-convert-btn');

    try {
        btn.textContent = 'Preparing...';
        btn.disabled = true;

        const arrayBuffer = await excelFile.arrayBuffer();

        // 1. Read Excel file using XLSX
        const workbook = XLSX.read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 2. Convert to HTML
        const html = XLSX.utils.sheet_to_html(worksheet);

        // 3. Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        // 4. Write HTML to iframe
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>${excelFile.name.replace(/\.xls[x]?$/, '')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #000;
                        padding: 20px;
                        margin: 0 auto;
                    }
                    table { 
                        border-collapse: collapse; 
                        width: 100%; 
                        margin-bottom: 1em; 
                    }
                    td, th { 
                        border: 1px solid #ddd; 
                        padding: 8px; 
                        text-align: left;
                    }
                    @media print {
                        body { padding: 0; margin: 1cm; }
                        table { width: 100%; }
                    }
                </style>
            </head>
            <body>
                <h2>${excelFile.name} - Sheet 1</h2>
                ${html}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();

        showNotification('Print dialog opened. Please select "Save as PDF".', 'success');

    } catch (err) {
        console.error('Excel to PDF Error:', err);
        showNotification('Error processing Excel file.', 'error');
    } finally {
        btn.textContent = 'Convert to PDF';
        btn.disabled = false;
    }
}


// --- EDIT PDF SECTION ---
let editFile = null;
let fabricCanvas = null;
let editPdfDoc = null;
let editPdfBytes = null;
let currentEditTool = 'select'; // select, text, draw, rect, circle

function setupEditEvents() {
    const editUploadArea = document.getElementById('edit-upload-area');
    const editFileInput = document.getElementById('edit-file-input');
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const clearPdfBtn = document.getElementById('clear-pdf-btn');
    const colorPicker = document.getElementById('tool-color');

    // Drag & Drop
    editUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); editUploadArea.classList.add('dragover'); });
    editUploadArea.addEventListener('dragleave', () => editUploadArea.classList.remove('dragover'));
    editUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        editUploadArea.classList.remove('dragover');
        handleEditFile(e.dataTransfer.files[0]);
    });

    editFileInput.addEventListener('change', (e) => handleEditFile(e.target.files[0]));

    // Toolbar Tools
    document.getElementById('tool-select').addEventListener('click', () => setEditTool('select'));
    document.getElementById('tool-text').addEventListener('click', () => setEditTool('text'));
    document.getElementById('tool-draw').addEventListener('click', () => setEditTool('draw'));
    document.getElementById('tool-rect').addEventListener('click', () => addShape('rect'));
    document.getElementById('tool-circle').addEventListener('click', () => addShape('circle'));

    // Image Upload
    document.getElementById('edit-image-input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            addEditImage(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    });

    // Delete
    document.getElementById('tool-delete').addEventListener('click', deleteSelectedObject);

    // Color Change
    colorPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        if (fabricCanvas) {
            fabricCanvas.freeDrawingBrush.color = color;
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj) {
                if (activeObj.type === 'i-text' || activeObj.type === 'text') {
                    activeObj.set('fill', color);
                } else if (activeObj.type === 'rect' || activeObj.type === 'circle') {
                    activeObj.set('stroke', color);
                }
                fabricCanvas.renderAll();
            }
        }
    });

    // Buttons
    // Modal Elements
    const modal = document.getElementById('confirmation-modal');
    const modalCancel = document.getElementById('modal-cancel-btn');
    const modalConfirm = document.getElementById('modal-confirm-btn');
    let onConfirmAction = null;

    function showConfirmModal(action) {
        onConfirmAction = action;
        modal.classList.remove('hidden');
    }

    function hideConfirmModal() {
        modal.classList.add('hidden');
        onConfirmAction = null;
    }

    modalCancel.addEventListener('click', hideConfirmModal);

    modalConfirm.addEventListener('click', () => {
        if (onConfirmAction) onConfirmAction();
        hideConfirmModal();
    });

    // Buttons
    savePdfBtn.addEventListener('click', saveEditedPdf);
    clearPdfBtn.addEventListener('click', () => {
        showConfirmModal(clearAnnotations);
    });

    // Call Watermark Setup
    setupWatermarkEvents();
}


// Suppress specific PDF.js warnings that are noisy but harmless
const originalWarn = console.warn;
console.warn = function (...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('CanvasTextBaseline')) return;
    originalWarn.apply(console, args);
};

async function handleEditFile(file) {
    if (!file || file.type !== 'application/pdf') return;

    // Check if Fabric is loaded
    if (typeof fabric === 'undefined') {
        showNotification('Fabric.js library not loaded. Please check your internet connection.', 'error');
        return;
    }

    editFile = file;
    document.getElementById('edit-upload-area').classList.add('hidden');
    document.getElementById('editor-container').classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        editPdfBytes = arrayBuffer; // Store for later

        // Load with PDF.js for rendering
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Currently only editing page 1

        const viewport = page.getViewport({ scale: 1.5 });
        const canvasEl = document.getElementById('pdf-editor-canvas');

        // Show toolbar only if in edit mode
        const currentMode = document.querySelector('input[name="edit-feature-mode"]:checked').value;
        const editorToolbar = document.getElementById('main-editor-toolbar');
        if (editorToolbar) {
            if (currentMode === 'edit') {
                editorToolbar.classList.remove('hidden');
            } else {
                editorToolbar.classList.add('hidden');
            }
        }

        if (!canvasEl) {
            console.error('Canvas element not found!');
            return;
        }

        // Initialize Fabric Canvas
        if (fabricCanvas) {
            fabricCanvas.dispose();
        }

        // Set dimensions explicitly
        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;

        // Render PDF page to canvas context first (as background)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const tempContext = tempCanvas.getContext('2d');

        // Render PDF (awaiting this is critical)
        try {
            await page.render({ canvasContext: tempContext, viewport }).promise;
        } catch (renderErr) {
            console.warn('PDF Rendering Warning:', renderErr);
        }

        const bgDataUrl = tempCanvas.toDataURL('image/png');

        // Create Fabric Canvas
        fabricCanvas = new fabric.Canvas('pdf-editor-canvas', {
            width: viewport.width,
            height: viewport.height,
            isDrawingMode: false,
            selection: true
        });

        // Set background and wait for it to load
        fabricCanvas.setBackgroundImage(bgDataUrl, fabricCanvas.renderAll.bind(fabricCanvas), {
            originX: 'left',
            originY: 'top'
        });

        // Setup Brush
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.width = 3;
        const colorPicker = document.getElementById('tool-color');
        if (colorPicker) {
            fabricCanvas.freeDrawingBrush.color = colorPicker.value;
        }

        // Selection Events for UI Updates
        fabricCanvas.on('selection:created', handleSelection);
        fabricCanvas.on('selection:updated', handleSelection);
        fabricCanvas.on('selection:cleared', () => {
            document.getElementById('text-properties-toolbar').classList.add('hidden');
        });

        // --- Text Tool Event Listeners ---
        document.getElementById('font-family').addEventListener('change', function () {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                activeObj.set('fontFamily', this.value);
                fabricCanvas.requestRenderAll();
            }
        });

        document.getElementById('font-size').addEventListener('change', function () {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                activeObj.set('fontSize', parseInt(this.value, 10));
                fabricCanvas.requestRenderAll();
            }
        });

        document.getElementById('text-bold').addEventListener('click', function () {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                activeObj.set('fontWeight', activeObj.fontWeight === 'bold' ? 'normal' : 'bold');
                fabricCanvas.requestRenderAll();
                this.classList.toggle('active', activeObj.fontWeight === 'bold');
            }
        });

        document.getElementById('text-italic').addEventListener('click', function () {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                activeObj.set('fontStyle', activeObj.fontStyle === 'italic' ? 'normal' : 'italic');
                fabricCanvas.requestRenderAll();
                this.classList.toggle('active', activeObj.fontStyle === 'italic');
            }
        });

        document.getElementById('text-underline').addEventListener('click', function () {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                activeObj.set('underline', !activeObj.underline);
                fabricCanvas.requestRenderAll();
                this.classList.toggle('active', !!activeObj.underline);
            }
        });

        const textAlignButtons = ['left', 'center', 'right'];
        textAlignButtons.forEach(align => {
            document.getElementById(`text-align-${align}`).addEventListener('click', function () {
                const activeObj = fabricCanvas.getActiveObject();
                if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                    activeObj.set('textAlign', align);
                    fabricCanvas.requestRenderAll();

                    // Update Active State
                    textAlignButtons.forEach(a => {
                        document.getElementById(`text-align-${a}`).classList.remove('active');
                    });
                    this.classList.add('active');
                }
            });
        });

        // Line Tool
        document.getElementById('tool-line').addEventListener('click', () => {
            setEditTool('draw'); // Temporarily set to draw to start logic
            addEditLine();
        });

        // Emoji Tool Logic
        const emojiBtn = document.getElementById('tool-emoji');
        const emojiContent = document.querySelector('.emoji-content');

        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiContent.classList.toggle('hidden');
        });

        document.querySelectorAll('.emoji-content span').forEach(span => {
            span.addEventListener('click', (e) => {
                const emoji = e.target.getAttribute('data-emoji');
                addEditEmoji(emoji);
                emojiContent.classList.add('hidden');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (emojiBtn && !emojiBtn.contains(e.target) && !emojiContent.contains(e.target)) {
                emojiContent.classList.add('hidden');
            }
        });

        setEditTool('select');
        console.log('PDF Editor Initialized Successfully');

    } catch (err) {
        console.error('Editor Initialization Error:', err);
        showNotification('Error loading PDF for editing.', 'error');
        document.getElementById('edit-upload-area').classList.remove('hidden');
        document.getElementById('editor-container').classList.add('hidden');
    }
}

function setEditTool(tool) {
    currentEditTool = tool;

    // UI Update
    document.querySelectorAll('.editor-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));

    if (tool === 'select') {
        document.getElementById('tool-select').classList.add('active');
        fabricCanvas.isDrawingMode = false;
        fabricCanvas.selection = true;
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.forEachObject(o => o.selectable = true);
    } else if (tool === 'draw') {
        document.getElementById('tool-draw').classList.add('active');
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
    } else if (tool === 'text') {
        document.getElementById('tool-text').classList.add('active');
        fabricCanvas.isDrawingMode = false;
        addText();
        setEditTool('select'); // Switch back after adding
    }
}

function addText() {
    const text = new fabric.IText('Type here', {
        left: 100,
        top: 100,
        fontFamily: 'Arial',
        fill: document.getElementById('tool-color').value,
        fontSize: 20
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
}

function addShape(shape) {
    const color = document.getElementById('tool-color').value;
    let obj;

    if (shape === 'rect') {
        obj = new fabric.Rect({
            left: 150,
            top: 150,
            fill: 'transparent',
            stroke: color,
            strokeWidth: 3,
            width: 100,
            height: 60
        });
    } else if (shape === 'circle') {
        obj = new fabric.Circle({
            left: 200,
            top: 200,
            fill: 'transparent',
            stroke: color,
            strokeWidth: 3,
            radius: 40
        });
    }

    if (obj) {
        fabricCanvas.add(obj);
        fabricCanvas.setActiveObject(obj);
        setEditTool('select');
    }
}

function addEditLine() {
    const color = document.getElementById('tool-color').value;
    const line = new fabric.Line([50, 50, 200, 50], {
        stroke: color,
        strokeWidth: 3,
        selectable: true
    });
    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
    setEditTool('select');
}

function addEditEmoji(emoji) {
    const text = new fabric.Text(emoji, {
        left: 200,
        top: 200,
        fontSize: 40,
        selectable: true
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    setEditTool('select');
}

function addEditImage(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        fabric.Image.fromURL(e.target.result, function (img) {
            img.scaleToWidth(150);
            fabricCanvas.add(img);
            fabricCanvas.centerObject(img);
            fabricCanvas.setActiveObject(img);
            setEditTool('select');
        });
    };
    reader.readAsDataURL(file);
}

function deleteSelectedObject() {
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length) {
        fabricCanvas.discardActiveObject();
        activeObjects.forEach(function (obj) {
            fabricCanvas.remove(obj);
        });
    }
}

function clearAnnotations() {
    fabricCanvas.getObjects().forEach(obj => {
        // Don't remove background image
        fabricCanvas.remove(obj);
    });
}

function handleSelection(e) {
    // If not in Edit mode, do not show contextual toolbars
    const currentMode = document.querySelector('input[name="edit-feature-mode"]:checked').value;
    if (currentMode !== 'edit') return;

    const obj = e.selected[0];
    if (!obj) return;

    // Color Picker Sync
    const colorInput = document.getElementById('tool-color');
    if (obj.type === 'i-text' || obj.type === 'text') {
        colorInput.value = obj.fill;
    } else if (obj.stroke) {
        colorInput.value = obj.stroke;
    }

    // Text Properties Sync
    const textToolbar = document.getElementById('text-properties-toolbar');
    if (obj.type === 'i-text' || obj.type === 'text') {
        textToolbar.classList.remove('hidden');

        // Sync Font Family
        const fontFamilySelect = document.getElementById('font-family');
        if (fontFamilySelect) fontFamilySelect.value = obj.fontFamily || 'Arial';

        // Sync Font Size
        const fontSizeSelect = document.getElementById('font-size');
        if (fontSizeSelect) fontSizeSelect.value = obj.fontSize || 20;

        // Sync Bold/Italic
        // Sync Bold/Italic
        const boldBtn = document.getElementById('text-bold');
        if (boldBtn) boldBtn.classList.toggle('active', obj.fontWeight === 'bold');

        const italicBtn = document.getElementById('text-italic');
        if (italicBtn) italicBtn.classList.toggle('active', obj.fontStyle === 'italic');

        // Sync Underline
        const underlineBtn = document.getElementById('text-underline');
        if (underlineBtn) underlineBtn.classList.toggle('active', !!obj.underline);

        // Sync Alignment
        const textAlignButtons = ['left', 'center', 'right'];
        textAlignButtons.forEach(align => {
            const btn = document.getElementById(`text-align-${align}`);
            if (btn) {
                if (obj.textAlign === align) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

    } else {
        textToolbar.classList.add('hidden');
    }
}

async function saveEditedPdf() {
    try {
        const saveBtn = document.getElementById('save-pdf-btn');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        // 1. Export Fabric Canvas to PNG (without background PDF image)
        // We temporarily remove background to get only annotations
        const originalBg = fabricCanvas.backgroundImage;
        fabricCanvas.backgroundImage = null;
        fabricCanvas.renderAll();

        // High multiplier for better resolution on the PDF
        const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            multiplier: 2
        });

        // Restore background
        fabricCanvas.setBackgroundImage(originalBg, fabricCanvas.renderAll.bind(fabricCanvas));

        // 2. Load original PDF
        const arrayBuffer = await editFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; // Logic only for page 1 currently

        // 3. Embed the annotation image
        const pngImage = await pdfDoc.embedPng(dataUrl);

        // 4. Draw image on top of profile
        const { width, height } = firstPage.getSize();

        firstPage.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
        });

        // 5. Save and Download
        const pdfBytes = await pdfDoc.save();
        triggerDownloadAnimation(saveBtn);
        downloadFile(pdfBytes, 'edited.pdf');

    } catch (err) {
        console.error(err);
        showNotification('Error saving PDF', 'error');
    } finally {
        const saveBtn = document.getElementById('save-pdf-btn');
        saveBtn.textContent = 'Save & Download PDF';
        saveBtn.disabled = false;
    }
}

// --- WATERMARK LOGIC ---
let watermarkObject = null;
let watermarkMode = 'text'; // 'text' or 'image'

function setupWatermarkEvents() {
    // Mode Switching (Edit vs Watermark)
    const modeRadios = document.getElementsByName('edit-feature-mode');

    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            const editorToolbar = document.getElementById('main-editor-toolbar');
            const textProperties = document.getElementById('text-properties-toolbar'); // Ensure this exists in HTML or variable
            const watermarkControls = document.getElementById('watermark-controls');

            if (mode === 'watermark') {
                if (editorToolbar) editorToolbar.classList.add('hidden');
                if (textProperties) textProperties.classList.add('hidden');
                if (watermarkControls) watermarkControls.classList.remove('hidden');
                initWatermark();
            } else {
                if (editorToolbar) editorToolbar.classList.remove('hidden');
                // textProperties should stay hidden until an object is selected
                if (watermarkControls) watermarkControls.classList.add('hidden');
                clearWatermark();
            }
        });
    });

    // Watermark Type Toggle
    const wmTextBtn = document.getElementById('wm-type-text');
    const wmImageBtn = document.getElementById('wm-type-image');

    if (wmTextBtn) wmTextBtn.addEventListener('click', () => toggleWatermarkType('text'));
    if (wmImageBtn) wmImageBtn.addEventListener('click', () => toggleWatermarkType('image'));

    // Text Inputs
    const textInput = document.getElementById('wm-text-input');
    const fontSelect = document.getElementById('wm-font-family');
    const fontSizeInput = document.getElementById('wm-font-size');
    const colorInput = document.getElementById('wm-color');

    if (textInput) textInput.addEventListener('input', updateWatermark);
    if (fontSelect) fontSelect.addEventListener('change', updateWatermark);
    if (fontSizeInput) fontSizeInput.addEventListener('input', updateWatermark);
    if (colorInput) colorInput.addEventListener('input', updateWatermark);

    // Common Inputs
    const opacityInput = document.getElementById('wm-opacity');
    if (opacityInput) opacityInput.addEventListener('input', (e) => {
        const val = document.getElementById('wm-opacity-val');
        if (val) val.textContent = e.target.value + '%';
        updateWatermark();
    });

    const rotationInput = document.getElementById('wm-rotation');
    if (rotationInput) rotationInput.addEventListener('input', (e) => {
        const val = document.getElementById('wm-rotation-val');
        if (val) val.textContent = e.target.value + '°';
        updateWatermark();
    });

    const scaleInput = document.getElementById('wm-scale');
    if (scaleInput) scaleInput.addEventListener('input', (e) => {
        const val = document.getElementById('wm-scale-val');
        if (val) val.textContent = e.target.value + '%';
        updateWatermark();
    });

    // Position Grid
    document.querySelectorAll('.wm-position-grid button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.wm-position-grid button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateWatermarkPosition(e.target.dataset.pos);
        });
    });

    // Image Upload
    const imgInput = document.getElementById('wm-image-input');
    if (imgInput) imgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (f) => {
                updateWatermarkImage(f.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Apply Button
    const applyBtn = document.getElementById('apply-watermark-btn');
    if (applyBtn) applyBtn.addEventListener('click', saveWatermarkedPDF);
}

function initWatermark() {
    if (!fabricCanvas) return;

    // Clear existing overlay objects if any, existing content is kept
    toggleWatermarkType('text');
}

function clearWatermark() {
    if (watermarkObject && fabricCanvas) {
        fabricCanvas.remove(watermarkObject);
        watermarkObject = null;
        fabricCanvas.requestRenderAll();
    }
}

function toggleWatermarkType(type) {
    watermarkMode = type;
    const textSettings = document.getElementById('wm-text-settings');
    const imageSettings = document.getElementById('wm-image-settings');
    const textBtn = document.getElementById('wm-type-text');
    const imageBtn = document.getElementById('wm-type-image');

    if (type === 'text') {
        if (textSettings) textSettings.classList.remove('hidden');
        if (imageSettings) imageSettings.classList.add('hidden');
        if (textBtn) textBtn.classList.add('active');
        if (imageBtn) imageBtn.classList.remove('active');
        updateWatermark(); // Create text object
    } else {
        if (textSettings) textSettings.classList.add('hidden');
        if (imageSettings) imageSettings.classList.remove('hidden');
        if (textBtn) textBtn.classList.remove('active');
        if (imageBtn) imageBtn.classList.add('active');
        if (!watermarkObject || watermarkObject.type !== 'image') {
            clearWatermark(); // Wait for upload
        }
    }
}

function updateWatermark() {
    if (!fabricCanvas) return;

    const textInput = document.getElementById('wm-text-input');
    if (!textInput) return;

    const text = textInput.value;
    const fontFamily = document.getElementById('wm-font-family').value;
    const fontSize = parseInt(document.getElementById('wm-font-size').value);
    const color = document.getElementById('wm-color').value;
    const opacity = parseInt(document.getElementById('wm-opacity').value) / 100;
    const rotation = parseInt(document.getElementById('wm-rotation').value);

    // Remove old object IF it's the wrong type or we are re-creating text
    if (watermarkObject && watermarkObject.type !== 'image' && watermarkMode === 'text') {
        fabricCanvas.remove(watermarkObject);
    }
    // Also remove if mode switched
    if (watermarkMode === 'text' && watermarkObject && watermarkObject.type === 'image') {
        fabricCanvas.remove(watermarkObject);
        watermarkObject = null;
    }

    if (watermarkMode === 'text') {
        watermarkObject = new fabric.Text(text, {
            fontFamily: fontFamily,
            fontSize: fontSize,
            fill: color,
            opacity: opacity,
            angle: rotation,
            selectable: false, // User moves via grid
            originX: 'center',
            originY: 'center'
        });
        fabricCanvas.add(watermarkObject);

        // Re-apply position
        const activePos = document.querySelector('.wm-position-grid button.active');
        if (activePos) updateWatermarkPosition(activePos.dataset.pos);
        else fabricCanvas.centerObject(watermarkObject);

    } else if (watermarkMode === 'image' && watermarkObject && watermarkObject.type === 'image') {
        // Just update props of existing image
        watermarkObject.set({
            opacity: opacity,
            angle: rotation
        });

        const scaleVal = document.getElementById('wm-scale').value;
        const scale = parseInt(scaleVal) / 100;
        // Reset scale first then apply
        watermarkObject.scale(scale);

        fabricCanvas.requestRenderAll();

        const activePos = document.querySelector('.wm-position-grid button.active');
        if (activePos) updateWatermarkPosition(activePos.dataset.pos);
    }
}

function updateWatermarkImage(dataUrl) {
    if (!fabricCanvas) return;

    fabric.Image.fromURL(dataUrl, (img) => {
        if (watermarkObject) fabricCanvas.remove(watermarkObject);

        watermarkObject = img;
        watermarkObject.set({
            originX: 'center',
            originY: 'center',
            selectable: false
        });

        fabricCanvas.add(watermarkObject);
        updateWatermark(); // Apply other props (opacity, etc)
    });
}


function updateWatermarkPosition(pos) {
    if (!watermarkObject || !fabricCanvas) return;

    const w = fabricCanvas.getWidth();
    const h = fabricCanvas.getHeight();
    const padding = 40;

    let left = w / 2;
    let top = h / 2;

    switch (pos) {
        case 'tl': left = padding; top = padding; watermarkObject.set({ originX: 'left', originY: 'top' }); break;
        case 'tc': left = w / 2; top = padding; watermarkObject.set({ originX: 'center', originY: 'top' }); break;
        case 'tr': left = w - padding; top = padding; watermarkObject.set({ originX: 'right', originY: 'top' }); break;
        case 'cl': left = padding; top = h / 2; watermarkObject.set({ originX: 'left', originY: 'center' }); break;
        case 'cc': left = w / 2; top = h / 2; watermarkObject.set({ originX: 'center', originY: 'center' }); break;
        case 'cr': left = w - padding; top = h / 2; watermarkObject.set({ originX: 'right', originY: 'center' }); break;
        case 'bl': left = padding; top = h - padding; watermarkObject.set({ originX: 'left', originY: 'bottom' }); break;
        case 'bc': left = w / 2; top = h - padding; watermarkObject.set({ originX: 'center', originY: 'bottom' }); break;
        case 'br': left = w - padding; top = h - padding; watermarkObject.set({ originX: 'right', originY: 'bottom' }); break;
    }

    watermarkObject.set({ left, top });
    watermarkObject.setCoords();
    fabricCanvas.requestRenderAll();
}

async function saveWatermarkedPDF() {
    if (!editFile) {
        showNotification("No PDF file loaded!", "error");
        return;
    }

    try {
        const btn = document.getElementById('apply-watermark-btn');
        btn.textContent = 'Processing...';
        btn.disabled = true;

        // Fetch fresh ArrayBuffer to avoid "detached" errors
        const arrayBuffer = await editFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        // 1. Isolate Watermark to PNG
        const originalBg = fabricCanvas.backgroundImage;

        // We need to temporarily remove the background image from fabric canvas 
        // to take a snapshot of ONLY the watermark.
        // However, setBackgroundImage(null) is async or requires callback.
        // A simpler way: Hide all objects except watermark, hide background (set opacity 0?)

        const objects = fabricCanvas.getObjects();
        objects.forEach(o => { if (o !== watermarkObject) o.visible = false; });

        // Hide background logic:
        // Fabric doesn't easily let us toggle background visibility without removing it.
        // Let's create a temporary canvas to render just the watermark object?
        // Or simplified: Just render the watermark object to dataURL directly? 
        // watermarkObject.toDataURL() only renders the object clipped to its box, not relative to canvas.
        // We need it relative to canvas size to preserve position.

        // Let's try setting background opacity to 0
        if (fabricCanvas.backgroundImage) fabricCanvas.backgroundImage.opacity = 0;
        fabricCanvas.renderAll();

        const watermarkDataUrl = fabricCanvas.toDataURL({
            format: 'png',
            multiplier: 2
        });

        // Restore
        if (fabricCanvas.backgroundImage) fabricCanvas.backgroundImage.opacity = 1;
        objects.forEach(o => o.visible = true);
        fabricCanvas.renderAll();

        // 2. Embed
        const watermarkImage = await pdfDoc.embedPng(watermarkDataUrl);
        const wmDims = watermarkImage.scale(0.5); // 1 / multiplier

        // 3. Draw on ALL pages
        pages.forEach(page => {
            page.drawImage(watermarkImage, {
                x: 0,
                y: 0,
                width: page.getWidth(),
                height: page.getHeight(),
            });
        });

        const pdfBytes = await pdfDoc.save();
        downloadFile(pdfBytes, "watermarked_document.pdf", "application/pdf");
        showNotification("Watermark added to all pages!", "success");

    } catch (err) {
        console.error("Save Watermark Error:", err);
        showNotification("Failed to save watermark.", "error");
    } finally {
        const btn = document.getElementById('apply-watermark-btn');
        btn.textContent = 'Add Watermark & Download';
        btn.disabled = false;
    }
}

// --- WELCOME POPUP ---
function setupWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    const closeBtn = document.getElementById('popup-close-btn');
    const actionBtn = document.getElementById('popup-action-btn');

    if (!popup) return;

    // Show popup after page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            popup.classList.remove('hidden');
            // Force reflow
            void popup.offsetWidth;
            popup.classList.add('show');
            document.body.classList.add('modal-open'); // Lock scroll
        }, 1000); // 1s delay for better UX
    });

    const closePopup = () => {
        popup.classList.remove('show');
        document.body.classList.remove('modal-open'); // Unlock scroll
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 400); // Match transition duration
    };

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (actionBtn) actionBtn.addEventListener('click', closePopup);

    // Close on click outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            closePopup();
        }
    });
}

// --- SECURITY TAB ---
// let protectFile = null;

function setupSecurityEvents() {
    // Sub-tab switching
    const securityModeRadios = document.getElementsByName('security-mode');
    securityModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            document.getElementById('protect-pdf-section').classList.add('hidden');
            document.getElementById('sign-pdf-section').classList.add('hidden');

            if (mode === 'protect-pdf') {
                document.getElementById('protect-pdf-section').classList.remove('hidden');
            } else if (mode === 'sign-pdf') {
                document.getElementById('sign-pdf-section').classList.remove('hidden');
            }
        });
    });

    setupProtectPDFEvents();
}

let protectFile = null;
let qpdfModulePromise = null;

// Initialize (lazy) - returns a ready qpdf module
async function getQpdfModule() {
    if (qpdfModulePromise) return qpdfModulePromise;

    // Dynamic import of the ESM loader from jsDelivr (ensure the same path as the <script> above)
    qpdfModulePromise = (async () => {
        // `@jspawn/qpdf-wasm` publishes qpdf.mjs which exports a default createModule function
        const modUrl = 'https://cdn.jsdelivr.net/npm/@jspawn/qpdf-wasm/qpdf.mjs';
        try {
            const create = (await import(modUrl)).default;
            // createModule expects locateFile to return the .wasm file URL
            const qpdf = await create({
                locateFile: () => 'https://cdn.jsdelivr.net/npm/@jspawn/qpdf-wasm/qpdf.wasm',
                // noInitialRun: true  // not necessary for callMain usage
            });
            return qpdf;
        } catch (err) {
            console.error("qpdf-wasm load error:", err);
            throw new Error("Failed to load qpdf WASM module. Check network / CDN availability.");
        }
    })();

    return qpdfModulePromise;
}

/* ---------- UI wiring (IDs you confirmed earlier) ---------- */

function setupProtectPDFEvents() {
    const protectUploadArea = document.getElementById('protect-upload-area');
    const protectFileInput = document.getElementById('protect-file-input');
    const protectBtn = document.getElementById('protect-btn');
    const passwordInput = document.getElementById('protect-password');
    // Toggle password visibility listener has been moved to global scope


    // Password strength (simple)
    if (passwordInput) passwordInput.addEventListener('input', (e) => updatePasswordStrength(e.target.value));

    // Drag & drop
    if (protectUploadArea) {
        protectUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); protectUploadArea.classList.add('dragover'); });
        protectUploadArea.addEventListener('dragleave', () => { protectUploadArea.classList.remove('dragover'); });
        protectUploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); protectUploadArea.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleProtectFile(e.dataTransfer.files[0]);
        });
    }

    if (protectFileInput) {
        protectFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleProtectFile(e.target.files[0]);
        });
    }

    if (protectBtn) protectBtn.addEventListener('click', protectPDF);
}

function handleProtectFile(file) {
    if (!file) return;
    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = /\.pdf$/i.test(file.name);
    if (!isPdfMime && !isPdfExt) {
        if (typeof showNotification === 'function') showNotification('Please upload a PDF file.', 'warning');
        return;
    }
    protectFile = file;
    const upArea = document.getElementById('protect-upload-area');
    const settings = document.getElementById('protect-settings-container');
    if (upArea) upArea.classList.add('hidden');
    if (settings) settings.classList.remove('hidden');

    // Create UI for selected file
    const infoEl = document.getElementById('protect-file-info');
    if (infoEl) {
        infoEl.innerHTML = `
        <div class="file-item" style="margin:0; border:var(--primary-color) 1px solid;">
            <div class="file-info">${file.name}</div>
            <div class="file-controls">
                <button class="btn-icon remove" onclick="removeProtectFile()" title="Remove">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;
    }
}

window.removeProtectFile = () => {
    protectFile = null;
    const infoEl = document.getElementById('protect-file-info');
    const upArea = document.getElementById('protect-upload-area');
    const settings = document.getElementById('protect-settings-container');
    const passwordInput = document.getElementById('protect-password');
    const confirmInput = document.getElementById('protect-password-confirm');
    const fileInput = document.getElementById('protect-file-input');

    // Reset Inputs
    if (fileInput) fileInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (confirmInput) confirmInput.value = '';
    updatePasswordStrength('');

    // Toggle Views
    if (settings) settings.classList.add('hidden');
    if (upArea) upArea.classList.remove('hidden');
    if (infoEl) infoEl.innerHTML = '';
};

function updatePasswordStrength(password) {
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    if (!bar || !text) return;
    bar.className = 'strength-bar';
    if (!password) { bar.style.width = '0'; text.textContent = 'Password Strength: -'; return; }
    let s = 0; if (password.length >= 6) s++; if (password.length >= 10) s++; if (/[A-Z]/.test(password)) s++; if (/[0-9]/.test(password)) s++; if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s < 2) { bar.classList.add('weak'); bar.style.width = '20%'; text.textContent = 'Weak'; }
    else if (s < 4) { bar.classList.add('medium'); bar.style.width = '60%'; text.textContent = 'Medium'; }
    else { bar.classList.add('strong'); bar.style.width = '100%'; text.textContent = 'Strong'; }
}

/* ---------- QPDF encrypt wrapper ---------- */
/*
  This runs the qpdf CLI inside WASM. Example qpdf CLI encryption:
    qpdf --encrypt user-password owner-password 256 -- input.pdf output.pdf

  We'll:
    - load qpdf WASM module
    - create a virtual FS path /in.pdf and /out.pdf
    - write input bytes to FS
    - call qpdf.callMain([...args...])
    - read /out.pdf and download
*/

async function protectPDF() {
    const protectBtn = document.getElementById('protect-btn');
    try {
        if (!protectFile) { if (typeof showNotification === 'function') showNotification('Please upload a PDF file.', 'warning'); return; }
        const password = document.getElementById('protect-password').value;
        const confirm = document.getElementById('protect-password-confirm').value;
        if (!password) { if (typeof showNotification === 'function') showNotification('Please enter a password.', 'warning'); return; }
        if (password !== confirm) { if (typeof showNotification === 'function') showNotification('Passwords do not match.', 'error'); return; }

        if (protectBtn) { protectBtn.disabled = true; protectBtn.textContent = 'Encrypting...'; }

        // Read bytes
        const arrBuf = await protectFile.arrayBuffer();
        const inBytes = new Uint8Array(arrBuf);

        // Initialize qpdf (WASM)
        const qpdf = await getQpdfModule();

        // Create /work dir inside FS to avoid collisions
        const IN_PATH = '/input.pdf';
        const OUT_PATH = '/output.pdf';

        // Ensure FS directories exist (Emscripten FS API)
        try { if (!qpdf.FS.analyzePath('/').exists) { /* ignore */ } } catch (e) { /* ignore */ }

        // Write file
        try {
            // Remove files if present
            try { qpdf.FS.unlink(IN_PATH); } catch (e) { }
            try { qpdf.FS.unlink(OUT_PATH); } catch (e) { }
            qpdf.FS.writeFile(IN_PATH, inBytes);
        } catch (fsErr) {
            console.error("FS write error:", fsErr);
            throw new Error("Failed to write file to qpdf virtual FS: " + fsErr.message);
        }

        // Build qpdf args:
        // use same password for user & owner (you may change to separate ownerPW)
        // key-length 256 (AES-256)
        // Note: you can pass other qpdf CLI flags to set permissions.
        const args = [
            '--encrypt',
            password,           // user password
            password,           // owner password (same here)
            '256',
            '--',
            IN_PATH,
            OUT_PATH
        ];

        // Run qpdf CLI
        try {
            // callMain runs synchronously within WASM runtime and throws on qpdf CLI non-zero exit
            qpdf.callMain(args);
        } catch (qerr) {
            console.error("qpdf callMain error:", qerr);
            // Attempt to read stderr from the module if available
            throw new Error("qpdf failed to encrypt PDF. See console for details.");
        }

        // Read output
        let outBytes;
        try {
            outBytes = qpdf.FS.readFile(OUT_PATH);
        } catch (readErr) {
            console.error("qpdf read error:", readErr);
            throw new Error("Encrypted output not found. qpdf may have failed.");
        }

        // Prepare Blob and download
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const outName = `protected_${protectFile.name.replace(/\.pdf$/i, '')}.pdf`;

        try { if (typeof triggerDownloadAnimation === 'function') triggerDownloadAnimation(protectBtn); } catch (e) { }

        // Use user downloadFile helper if present, otherwise fallback
        if (typeof downloadFile === 'function') {
            try { downloadFile(blob, outName); }
            catch (e) { // fallback
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = outName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
            }
        } else {
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = outName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        if (typeof showNotification === 'function') showNotification('PDF encrypted successfully!', 'success');

        // cleanup FS (optional)
        try { qpdf.FS.unlink(IN_PATH); qpdf.FS.unlink(OUT_PATH); } catch (e) { }

        // reset UI fields
        try { document.getElementById('protect-password').value = ''; document.getElementById('protect-password-confirm').value = ''; updatePasswordStrength(''); } catch (e) { }

    } catch (err) {
        console.error('protectPDF error', err);
        if (typeof showNotification === 'function') showNotification('Error protecting PDF. ' + (err && err.message ? err.message : err), 'error');
    } finally {
        if (protectBtn) { protectBtn.disabled = false; protectBtn.textContent = 'Protect & Download PDF'; }
    }
}

// Auto-init wiring (same as previous code)
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupProtectPDFEvents);
else setupProtectPDFEvents();

// --- GLOBAL EVENT LISTENERS ---
// Toggle Password Visibility
document.addEventListener('click', function (e) {
    if (e.target.matches('.toggle-password') || e.target.closest('.toggle-password')) {
        console.log('Toggle password clicked!'); // DEBUG
        e.preventDefault();

        const btn = e.target.matches('.toggle-password') ? e.target : e.target.closest('.toggle-password');
        const wrapper = btn.closest('.password-input-wrapper');
        const input = wrapper ? wrapper.querySelector('input') : null;

        if (input) {
            console.log('Input found, current type:', input.type); // DEBUG

            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈'; // Change to "Hide" icon
            } else {
                input.type = 'password';
                btn.textContent = '👁️'; // Change to "Show" icon
            }
        } else {
            console.log('No input found!'); // DEBUG
        }
    }
});
