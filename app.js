// =============================================
// FPS Video Analyzer — Main Application
// =============================================

const $ = id => document.getElementById(id);

// State
let videoFile = null;
let videoEl = $('videoPlayer');
let overlayCanvas = $('overlayCanvas');
let overlayCtx = overlayCanvas.getContext('2d');
let rois = { top: null, bottom: null };
let selectingROI = null; // 'top' | 'bottom' | null
let drawStart = null;
let currentRect = null;
let topData = [];
let botData = [];
let isAnalyzing = false;

// =============================================
// FILE UPLOAD
// =============================================

$('uploadArea').addEventListener('click', () => $('videoInput').click());

$('uploadArea').addEventListener('dragover', e => {
    e.preventDefault();
    $('uploadArea').classList.add('dragover');
});

$('uploadArea').addEventListener('dragleave', () => {
    $('uploadArea').classList.remove('dragover');
});

$('uploadArea').addEventListener('drop', e => {
    e.preventDefault();
    $('uploadArea').classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

$('videoInput').addEventListener('change', e => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('Пожалуйста, выбери видео файл!');
        return;
    }
    videoFile = file;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    
    $('uploadArea').innerHTML = `
        <div class="upload-content">
            <span class="upload-icon">✅</span>
            <p>${file.name}</p>
            <p class="upload-hint">${(file.size / 1024 / 1024).toFixed(1)} MB — нажми чтобы заменить</p>
        </div>
    `;
    
    $('settings').style.display = 'block';
    $('videoSection').style.display = 'block';
    $('resultsSection').style.display = 'none';
    
    videoEl.addEventListener('loadedmetadata', () => {
        overlayCanvas.width = videoEl.videoWidth;
        overlayCanvas.height = videoEl.videoHeight;
    });
}

// =============================================
// ROI SELECTION
// =============================================

$('btnSelectROI').addEventListener('click', startROISelection);
$('btnResetROI').addEventListener('click', resetROIs);
$('btnAutoDetect').addEventListener('click', autoDetectROIs);

function startROISelection() {
    if (!rois.top) {
        selectingROI = 'top';
        alert('Нарисуй прямоугольник вокруг ВЕРХНЕГО FPS на видео');
    } else if (!rois.bottom) {
        selectingROI = 'bottom';
        alert('Нарисуй прямоугольник вокруг НИЖНЕГО FPS на видео');
    } else {
        alert('Обе области уже выбраны! Нажми "Сбросить" чтобы начать заново.');
        return;
    }
    
    // Делаем canvas интерактивным
    overlayCanvas.style.pointerEvents = 'auto';
    overlayCanvas.style.cursor = 'crosshair';
    
    overlayCanvas.onmousedown = onMouseDown;
    overlayCanvas.onmousemove = onMouseMove;
    overlayCanvas.onmouseup = onMouseUp;
}

function getCanvasCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function onMouseDown(e) {
    drawStart = getCanvasCoords(e);
}

function onMouseMove(e) {
    if (!drawStart) return;
    const pos = getCanvasCoords(e);
    currentRect = {
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x),
        h: Math.abs(pos.y - drawStart.y)
    };
    drawOverlay();
}

function onMouseUp(e) {
    if (!drawStart || !currentRect) return;
    
    if (currentRect.w > 10 && currentRect.h > 10) {
        rois[selectingROI] = { ...currentRect };
        updateROIStatus();
        
        if (selectingROI === 'top' && !rois.bottom) {
            selectingROI = 'bottom';
            drawStart = null;
            currentRect = null;
            alert('Теперь нарисуй прямоугольник вокруг НИЖНЕГО FPS');
            return;
        }
    }
    
    drawStart = null;
    currentRect = null;
    selectingROI = null;
    overlayCanvas.style.pointerEvents = 'none';
    overlayCanvas.style.cursor = 'default';
    overlayCanvas.onmousedown = null;
    overlayCanvas.onmousemove = null;
    overlayCanvas.onmouseup = null;
    
    drawOverlay();
    checkReady();
}

function drawOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Нарисовать сохранённые ROI
    if (rois.top) {
        drawRect(rois.top, '#22c55e', 'Верхний FPS');
    }
    if (rois.bottom) {
        drawRect(rois.bottom, '#3b82f6', 'Нижний FPS');
    }
    
    // Текущий прямоугольник
    if (currentRect) {
        const color = selectingROI === 'top' ? '#22c55e' : '#3b82f6';
        drawRect(currentRect, color, selectingROI === 'top' ? 'Верхний FPS' : 'Нижний FPS');
    }
}

function drawRect(r, color, label) {
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = 3;
    overlayCtx.strokeRect(r.x, r.y, r.w, r.h);
    
    overlayCtx.fillStyle = color;
    overlayCtx.font = 'bold 16px sans-serif';
    overlayCtx.fillText(label, r.x, r.y - 5);
}

function resetROIs() {
    rois = { top: null, bottom: null };
    selectingROI = null;
    drawStart = null;
    currentRect = null;
    overlayCanvas.style.pointerEvents = 'none';
    drawOverlay();
    updateROIStatus();
    checkReady();
}

function updateROIStatus() {
    $('roiTop').textContent = rois.top
        ? `✅ Верхний FPS: ${Math.round(rois.top.w)}×${Math.round(rois.top.h)}`
        : '⬜ Верхний FPS: не выбран';
    $('roiTop').className = 'roi-item' + (rois.top ? ' selected' : '');
    
    $('roiBottom').textContent = rois.bottom
        ? `✅ Нижний FPS: ${Math.round(rois.bottom.w)}×${Math.round(rois.bottom.h)}`
        : '⬜ Нижний FPS: не выбран';
    $('roiBottom').className = 'roi-item' + (rois.bottom ? ' selected' : '');
}

function checkReady() {
    $('btnAnalyze').disabled = !(rois.top && rois.bottom);
}

// =============================================
// AUTO DETECT (ищет фиолетовые прямоугольники)
// =============================================

async function autoDetectROIs() {
    videoEl.currentTime = 0;
    await new Promise(r => videoEl.onseeked = r);
    
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Ищем фиолетовые пиксели (цвет фона FPS-счётчика)
    const purpleMask = new Uint8Array(canvas.width * canvas.height);
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        // Фиолетовый: R примерно 60-120, G 50-100, B 100-180
        if (r > 40 && r < 140 && g > 30 && g < 110 && b > 80 && b < 200 && b > r) {
            purpleMask[i / 4] = 1;
        }
    }
    
    // Находим bounding boxes фиолетовых областей
    const boxes = findBoundingBoxes(purpleMask, canvas.width, canvas.height);
    
    if (boxes.length >= 2) {
        // Сортируем по Y (верхний первый)
        boxes.sort((a, b) => a.y - b.y);
        rois.top = boxes[0];
        rois.bottom = boxes[1];
        drawOverlay();
        updateROIStatus();
        checkReady();
        alert('✅ Области автоматически определены!');
    } else if (boxes.length === 1) {
        rois.top = boxes[0];
        drawOverlay();
        updateROIStatus();
        alert('⚠️ Найдена только одна область. Выбери вторую вручную.');
    } else {
        alert('❌ Не удалось автоматически найти области. Выбери вручную.');
    }
}

function findBoundingBoxes(mask, width, height) {
    const visited = new Uint8Array(width * height);
    const boxes = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (mask[idx] && !visited[idx]) {
                // BFS
                let minX = x, maxX = x, minY = y, maxY = y;
                let count = 0;
                const queue = [[x, y]];
                visited[idx] = 1;
                
                while (queue.length > 0) {
                    const [cx, cy] = queue.shift();
                    count++;
                    minX = Math.min(minX, cx);
                    maxX = Math.max(maxX, cx);
                    minY = Math.min(minY, cy);
                    maxY = Math.max(maxY, cy);
                    
                    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const ni = ny * width + nx;
                            if (mask[ni] && !visited[ni]) {
                                visited[ni] = 1;
                                queue.push([nx, ny]);
                            }
                        }
                    }
                }
                
                // Фильтр: минимальный размер области
                const bw = maxX - minX;
                const bh = maxY - minY;
                if (count > 500 && bw > 50 && bh > 20) {
                    boxes.push({ x: minX, y: minY, w: bw, h: bh });
                }
            }
        }
    }
    
    return boxes;
}

// =============================================
// ANALYSIS
// =============================================

$('btnAnalyze').addEventListener('click', startAnalysis);

async function startAnalysis() {
    if (isAnalyzing) return;
    isAnalyzing = true;
    
    topData = [];
    botData = [];
    
    const interval = parseInt($('frameInterval').value) || 15;
    const threshold = parseInt($('jumpThreshold').value) || 30;
    
    $('progressSection').style.display = 'block';
    $('resultsSection').style.display = 'none';
    $('btnAnalyze').disabled = true;
    $('btnAnalyze').textContent = '⏳ Анализ...';
    
    // Инициализация Tesseract
    $('progressText').textContent = 'Загрузка OCR...';
    
    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789.FPS:',
    });
    
    // Получаем длительность и FPS
    const duration = videoEl.duration;
    const fps = await getVideoFPS();
    const totalFrames = Math.floor(duration * fps);
    const framesToAnalyze = Math.floor(totalFrames / interval);
    
    $('progressDetails').textContent = 
        `Кадров: ~${totalFrames} | Анализ: ~${framesToAnalyze} кадров | FPS видео: ${fps.toFixed(0)}`;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    
    const debugCtx = $('debugCanvas').getContext('2d');
    
    let frameCount = 0;
    let analyzed = 0;
    
    for (let t = 0; t < duration; t += interval / fps) {
        if (!isAnalyzing) break;
        
        // Seek to time
        videoEl.currentTime = t;
        await new Promise(r => { videoEl.onseeked = r; });
        
        // Draw frame
        ctx.drawImage(videoEl, 0, 0);
        
        // Extract top ROI
        const topNum = await extractFPS(ctx, canvas, rois.top, worker, debugCtx, 'top');
        const botNum = await extractFPS(ctx, canvas, rois.bottom, worker, debugCtx, 'bot');
        
        if (topNum !== null) topData.push(topNum);
        if (botNum !== null) botData.push(botNum);
        
        analyzed++;
        const progress = (t / duration) * 100;
        $('progressFill').style.width = progress + '%';
        $('progressText').textContent = `${progress.toFixed(0)}% (${analyzed} кадров)`;
        $('progressDetails').textContent = 
            `Верх: ${topData.length} значений | Низ: ${botData.length} значений | Последние: ${topNum ?? '—'} / ${botNum ?? '—'}`;
        
        // Пауза для обновления UI
        await new Promise(r => setTimeout(r, 10));
    }
    
    await worker.terminate();
    
    $('progressFill').style.width = '100%';
    $('progressText').textContent = '✅ Готово!';
    
    isAnalyzing = false;
    $('btnAnalyze').disabled = false;
    $('btnAnalyze').textContent = '🚀 Начать анализ';
    
    showResults(threshold);
}

async function extractFPS(ctx, canvas, roi, worker, debugCtx, label)
