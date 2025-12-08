/**
 * OCR Translator App
 * 
 * Core logic for handling files, rendering PDFs, managing state,
 * and orchestrating OCR/Translation flows.
 */

// --- Constants & Config ---
const CONFIG = {
    MAX_FILE_SIZE_MB: 20,
    THUMBNAIL_WIDTH: 300,
};

// --- State Management ---
const AppState = {
    pages: [], // Array of { id, originalFile, type, imageSource (DataURL or Canvas), rotation: 0, ocrText: "", transText: "", included: true, status: 'idle' }
    selectedPageId: null,
    isProcessing: false,
    nextId: 1
};

// --- DOM Elements ---
const Elements = {
    dropZone: document.querySelector('.drop-zone'),
    fileInput: document.getElementById('file-input'),
    previewsList: document.getElementById('previews-list'),
    pageCount: document.getElementById('page-count'),
    clearBtn: document.getElementById('clear-all-btn'),
    // Editor Area
    placeholderMsg: document.querySelector('.placeholder-message'),
    splitView: document.querySelector('.split-view'),
    sourceText: document.getElementById('source-text'),
    targetText: document.getElementById('target-text'),
    // Toolbar
    ocrLang: document.getElementById('ocr-lang'),
    transLang: document.getElementById('trans-lang'),
    enhancedOcr: document.getElementById('enhanced-ocr'),
    processAllBtn: document.getElementById('process-all-btn'),
    // Footer
    progressBar: document.getElementById('global-progress'),
    progressContainer: document.querySelector('.progress-section'), // Updated class
    statusText: document.getElementById('global-status-text'),
    progressPercent: document.getElementById('progress-percent'), // New element
    btnDownloadTxt: document.getElementById('download-txt-btn'),
    btnDownloadPdf: document.getElementById('download-pdf-btn'),
    // Dynamic Containers
    toastContainer: null,
};

// --- Initialization ---
function init() {
    createToastContainer();
    setupEventListeners();
}

function createToastContainer() {
    const el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
    Elements.toastContainer = el;
}

function setupEventListeners() {
    // File Input
    Elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    Elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        Elements.dropZone.classList.add('drag-over');
    });

    Elements.dropZone.addEventListener('dragleave', () => {
        Elements.dropZone.classList.remove('drag-over');
    });

    Elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        Elements.dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    Elements.dropZone.addEventListener('click', () => {
        Elements.fileInput.click();
    });

    Elements.dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            Elements.fileInput.click();
        }
    });

    // Toolbar Actions
    Elements.clearBtn.addEventListener('click', clearAll);
    Elements.processAllBtn.addEventListener('click', runBatchProcessing);

    // Text Interactions
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.closest('.copy-btn').dataset.target;
            const text = document.getElementById(targetId).value;
            copyToClipboard(text);
        });
    });
}

// --- Notification System ---

/**
 * Show a toast notification
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    Elements.toastContainer.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Show a custom confirmation modal
 * @param {string} title 
 * @param {string} description 
 * @param {Function} onConfirm 
 */
function showConfirmDialog(title, description, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
        <div class="custom-modal">
            <h3 class="modal-title">${title}</h3>
            <p class="modal-desc">${description}</p>
            <div class="modal-actions">
                <button class="btn-secondary cancel-btn">Cancel</button>
                <button class="btn-danger confirm-btn">Yes, I'm sure</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
        overlay.style.animation = 'fadeOut 0.2s forwards';
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('.cancel-btn').addEventListener('click', close);
    overlay.querySelector('.confirm-btn').addEventListener('click', () => {
        onConfirm();
        close();
    });

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}


// --- File Handling ---
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
}

async function handleFiles(fileList) {
    // Show some loading indicator if needed

    for (const file of fileList) {
        if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
            showToast(`File ${file.name} is too large (Max ${CONFIG.MAX_FILE_SIZE_MB}MB)`, 'error');
            continue;
        }

        if (file.type === 'application/pdf') {
            await processPDF(file);
        } else if (file.type.startsWith('image/')) {
            await processImage(file);
        } else {
            showToast(`Unsupported file type: ${file.type}`, 'error');
        }
    }

    updateUI();
}

// --- Image Processing ---
async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const pageObj = createPageObject(file.name, 'image', e.target.result);
            AppState.pages.push(pageObj);
            addPreviewToUI(pageObj);
            resolve();
        };
        reader.readAsDataURL(file);
    });
}

// --- PDF Processing ---
async function processPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Good balance for OCR

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/png');
            const pageObj = createPageObject(`${file.name} (Page ${i})`, 'pdf-page', dataUrl);
            AppState.pages.push(pageObj);
            addPreviewToUI(pageObj);
        }
    } catch (err) {
        console.error(err);
        showToast("Error processing PDF file.", 'error');
    }
}

function createPageObject(name, type, imageSource) {
    return {
        id: AppState.nextId++,
        name: name,
        type: type, // 'image' or 'pdf-page'
        imageSource: imageSource, // DataURL
        rotation: 0, // 0, 90, 180, 270
        ocrText: "",
        translation: "",
        status: 'ready', // ready, processing, done, error
        isIncluded: true
    };
}

// --- UI Logic ---
function updateUI() {
    Elements.pageCount.textContent = AppState.pages.length;

    if (AppState.pages.length > 0) {
        document.querySelector('.empty-state').style.display = 'none';
        // Auto-select first if none selected
        if (!AppState.selectedPageId) {
            selectPage(AppState.pages[0].id);
        }
    } else {
        document.querySelector('.empty-state').style.display = 'block';
        Elements.splitView.style.display = 'none';
        Elements.placeholderMsg.style.display = 'block';
    }
}

function addPreviewToUI(page) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.dataset.id = page.id;
    item.innerHTML = `
        <img src="${page.imageSource}" class="preview-thumb" alt="Preview">
        <div class="preview-info">
            <div class="preview-name" title="${page.name}">${page.name}</div>
            <div class="preview-meta">${page.type === 'pdf-page' ? 'PDF Page' : 'Image'}</div>
            <div class="preview-actions">
                <button class="btn-icon-sm rotate-cw-btn" title="Rotate Right">↻</button>
                <button class="btn-icon-sm remove-btn" title="Remove">✕</button>
            </div>
        </div>
        <div class="preview-status" id="status-${page.id}"></div>
    `;

    // Event Delegation for buttons within Item
    item.querySelector('.rotate-cw-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        rotatePage(page.id, 90);
    });

    item.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removePage(page.id);
    });

    item.addEventListener('click', () => selectPage(page.id));

    Elements.previewsList.appendChild(item);
    updateUI();
}

function selectPage(id) {
    AppState.selectedPageId = id;

    // Highlight UI
    document.querySelectorAll('.preview-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.id) === id);
    });

    const page = AppState.pages.find(p => p.id === id);
    if (!page) return;

    // Switch View
    Elements.placeholderMsg.style.display = 'none';
    Elements.splitView.style.display = 'grid';

    // Populate Editors
    Elements.sourceText.value = page.ocrText || "";
    Elements.targetText.value = page.translation || "";

    // Bind Real-time updates (if user edits text)
    Elements.sourceText.oninput = (e) => { page.ocrText = e.target.value; };
    Elements.targetText.oninput = (e) => { page.translation = e.target.value; };
}

function rotatePage(id, angle) {
    const page = AppState.pages.find(p => p.id === id);
    if (!page) return;

    page.rotation = (page.rotation + angle) % 360;

    // Update visual preview
    const item = document.querySelector(`.preview-item[data-id="${id}"]`);
    const img = item.querySelector('.preview-thumb');
    img.style.transform = `rotate(${page.rotation}deg)`;

    // console.log(`Rotated page ${id} to ${page.rotation}deg`);
}

function removePage(id) {
    AppState.pages = AppState.pages.filter(p => p.id !== id);
    const item = document.querySelector(`.preview-item[data-id="${id}"]`);
    if (item) item.remove();

    if (AppState.selectedPageId === id) {
        AppState.selectedPageId = null;
        if (AppState.pages.length > 0) {
            selectPage(AppState.pages[0].id);
        } else {
            updateUI(); // Back to empty state
        }
    }
    updateUI();
}

function clearAll() {
    if (AppState.pages.length === 0) return;

    showConfirmDialog(
        "Clear All Pages?",
        "This will remove all uploaded images and extracted text. This action cannot be undone.",
        () => {
            AppState.pages = [];
            Elements.previewsList.innerHTML = '<div class="empty-state"><p>No files loaded yet.</p></div>';
            AppState.selectedPageId = null;
            updateUI();
            showToast("All pages cleared.", "info");
        }
    );
}

// --- Utils ---
async function copyToClipboard(text) {
    if (!text) {
        showToast("Nothing to copy!", "info");
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!", "success");
    } catch (err) {
        console.error('Failed to copy', err);
        showToast("Failed to copy text.", "error");
    }
}

// --- Placeholders for Future Logic ---
// --- OCR Service ---
let tesseractWorker = null;

async function getTesseractWorker(lang) {
    if (!tesseractWorker) {
        tesseractWorker = await Tesseract.createWorker(lang, 1, {
            // logger: m => console.log(m), // Silenced
        });
    } else {
        // Re-initialize if language changed (simplified for single worker)
        // Note: For better performance, we might want multiple workers or just re-detect
        // For this demo, we'll try to re-use or just re-create if needed.
        // Actually, createWorker is async. Let's just create a new one for simplicity or reinit.
        // Tesseract v5 allows re-initialize.
        await tesseractWorker.reinitialize(lang);
    }
    return tesseractWorker;
}

async function runBatchProcessing() {
    if (AppState.isProcessing) return;

    const pagesToProcess = AppState.pages.filter(p => !p.ocrText && p.isIncluded);
    if (pagesToProcess.length === 0) {
        showToast("No new pages to process!", "info");
        return;
    }

    AppState.isProcessing = true;
    Elements.processAllBtn.disabled = true;
    Elements.processAllBtn.textContent = '⏳ Processing...';
    Elements.progressContainer.style.display = 'flex';
    updateGlobalProgress(0); // Reset

    const total = pagesToProcess.length;
    let processed = 0;

    const lang = Elements.ocrLang.value === 'auto' ? 'eng' : Elements.ocrLang.value; // Default to eng if auto for initial init, but we'll specific later
    const useEnhanced = Elements.enhancedOcr.checked;

    let worker = null;

    try {
        worker = await getTesseractWorker(lang); // Initialize worker once

        for (const page of pagesToProcess) { // Use the filtered list for iteration

            try {
                updateStatus(`Processing Page ${page.id}...`);
                updateStatusVisual(page.id, 'running');

                // 1. Prepare Image (Apply Rotation + Preprocessing)
                const processedImage = await prepareImageForOCR(page.imageSource, page.rotation, useEnhanced);

                // 2. Recognize
                const ret = await worker.recognize(processedImage);

                // 3. Save Result
                page.ocrText = ret.data.text;
                page.status = 'done';

                // 4. Update UI
                updateStatusVisual(page.id, 'done');
                if (AppState.selectedPageId === page.id) {
                    Elements.sourceText.value = page.ocrText;
                }

                // 5. Translate (Chained)
                if (Elements.transLang.value !== 'none') {
                    await translatePage(page);
                }

            } catch (pageErr) {
                console.error(`Error processing page ${page.id}:`, pageErr);
                page.status = 'error';
                updateStatusVisual(page.id, 'error');
                showToast(`Failed to process Page ${page.id}`, 'error');
            } finally {
                processed++;
                updateGlobalProgress((processed / total) * 100);
            }
        }

        updateStatus("All pages processed.");
        showToast("Batch processing complete!", "success");

    } catch (err) {
        console.error("Global OCR Error:", err);
        showToast("Critial error starting OCR engine.", "error");
    } finally {
        AppState.isProcessing = false;
        Elements.processAllBtn.disabled = false;
        Elements.processAllBtn.innerHTML = '<span>▶</span> Run All';

        // Ensure 100% is visible
        updateGlobalProgress(100);

        // Enable downloads
        Elements.btnDownloadTxt.disabled = false;
        Elements.btnDownloadPdf.disabled = false;
    }
}

async function prepareImageForOCR(imageSource, rotation, enhanced) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Handle Rotation Dimensions
            if (rotation === 90 || rotation === 270) {
                canvas.width = img.height;
                canvas.height = img.width;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }

            // Apply Rotation
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rotation * Math.PI / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            ctx.resetTransform(); // Reset for filters

            if (enhanced) {
                // simple binarization / contrast
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                // Thresholding
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const val = avg > 128 ? 255 : 0; // Simple binary
                    data[i] = val;
                    data[i + 1] = val;
                    data[i + 2] = val;
                }
                ctx.putImageData(imageData, 0, 0);
            }

            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageSource;
    });
}

// --- Translation Service (Mock/Simple) ---
async function translatePage(page) {
    const targetLang = Elements.transLang.value;
    if (targetLang === 'none') return;

    updateStatus(`Translating Page ${page.id}...`);

    // Simulate API delay
    await new Promise(r => setTimeout(r, 500));

    // MOCK TRANSLATION LOGIC
    // Real world: fetch(`https://api.libretranslate.com/translate`, ...)
    page.translation = `[${targetLang.toUpperCase()}] ${page.ocrText}\n\n(Translation API requires key. This is a demo placeholder.)`;

    if (AppState.selectedPageId === page.id) {
        Elements.targetText.value = page.translation;
    }
}

// --- Export Service ---
Elements.btnDownloadTxt.addEventListener('click', downloadTxt);
Elements.btnDownloadPdf.addEventListener('click', downloadPdf);

function downloadTxt() {
    const includedPages = AppState.pages.filter(p => p.isIncluded);
    if (includedPages.length === 0) {
        showToast('No pages to export.', 'error');
        return;
    }

    let content = "";
    includedPages.forEach(p => {
        content += `--- ${p.name} ---\n`;
        content += `[Original]\n${p.ocrText || "(No Text extracted)"}\n\n`;
        if (p.translation) {
            content += `[Translation]\n${p.translation}\n\n`;
        }
        content += "\n" + "=".repeat(20) + "\n\n";
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-translation-result.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast("Text file downloaded.", "success");
}

async function downloadPdf() {
    const includedPages = AppState.pages.filter(p => p.isIncluded);
    if (includedPages.length === 0) {
        showToast('No pages to export.', 'error');
        return;
    }

    try {
        updateStatus("Generating PDF...");
        const pdfDoc = await PDFLib.PDFDocument.create();

        for (const page of includedPages) {
            // We need to use the rotated helper to get the final image state
            // But for embedding, we can just embed the source and set rotation? 
            // PDF-Lib allows rotation on drawPage.
            // BUT, if we have pre-processed/dataURL, maybe easier to just use helper?
            // Let's use the helper to get clean canonical image data so rotation is "baked in" or at least standard.
            // Actually, baking in rotation is safer for compatibility.

            const imageDataUrl = await prepareImageForOCR(page.imageSource, page.rotation, false); // No enhancement for final PDF usually? User choice? Let's keep original quality (false)

            const pngImage = await pdfDoc.embedPng(imageDataUrl);
            const dims = pngImage.scale(1);

            // Default A4 or fit to image? Let's fit page to image
            const newPage = pdfDoc.addPage([dims.width, dims.height]);
            newPage.drawImage(pngImage, {
                x: 0,
                y: 0,
                width: dims.width,
                height: dims.height,
            });

            // Optional: Draw text layer? (Complex for pure client side without font metrics matching Tesseract bbox)
            // Skipping text layer for this demo scope, keeping it visual + separate txt export.
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scanned-doc.pdf';
        a.click();
        URL.revokeObjectURL(url);
        updateStatus("PDF Downloaded.");
        showToast("PDF downloaded successfully.", "success");
    } catch (err) {
        console.error("PDF Gen Error:", err);
        showToast("Failed to generate PDF.", "error");
    }
}

// --- Status Helpers ---
function updateStatus(msg) {
    Elements.statusText.innerText = msg;
}

function updateGlobalProgress(percent) {
    const rounded = Math.round(percent);
    Elements.progressBar.style.width = `${rounded}%`;

    if (Elements.progressPercent) {
        Elements.progressPercent.textContent = `${rounded}%`;
    }

    if (rounded >= 100) {
        Elements.progressBar.classList.add('complete');
        Elements.statusText.textContent = "100% Completed";
    } else {
        Elements.progressBar.classList.remove('complete');
    }
}

function updateStatusVisual(pageId, status) {
    const el = document.getElementById(`status-${pageId}`);
    if (!el) return;

    if (status === 'running') {
        el.innerHTML = '⏳';
    } else if (status === 'done') {
        el.innerHTML = '✅';
    } else {
        el.innerHTML = '';
    }
}


// Start
init();
