
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
    const subTabs = document.querySelectorAll('.sub-tab-btn');
    const subTabPanes = document.querySelectorAll('.sub-tab-pane');

    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all sub-tabs and panes
            subTabs.forEach(t => t.classList.remove('active'));
            subTabPanes.forEach(p => p.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding pane
            const targetId = tab.dataset.subtab;
            document.getElementById(targetId).classList.add('active');
        });
    });

    setupConvertToPDFEvents();
}


// --- CONVERT TO PDF LOGIC ---
let jpgFiles = [];
let wordFile = null;

function setupConvertToPDFEvents() {
    // Radio Buttons
    const typeRadios = document.getElementsByName('convert-to-type');
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('jpg-to-pdf-section').classList.add('hidden');
            document.getElementById('word-to-pdf-section').classList.add('hidden');

            if (type === 'jpg-to-pdf') {
                document.getElementById('jpg-to-pdf-section').classList.remove('hidden');
            } else if (type === 'word-to-pdf') {
                document.getElementById('word-to-pdf-section').classList.remove('hidden');
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
    infoEl.textContent = `Selected: ${file.name}`;
    infoEl.classList.remove('hidden');
    btn.disabled = false;
}

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
