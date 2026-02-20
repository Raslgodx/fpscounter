/* ============================================
   FPS Video Analyzer — Full Application
   ============================================ */

// --- Helpers ---
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- State ---
let roi = { top: null, bot: null };
let selecting = null;       // 'top' | 'bot' | null
let dragStart = null;
let dragRect = null;
let topData = [];
let botData = [];
let busy = false;

// --- Elements ---
const video      = $('video');
const overlay    = $('overlay');
const ctx        = overlay.getContext('2d');

// =============================================
// 1. FILE UPLOAD
// =============================================

$('uploadArea').onclick = () => $('videoInput').click();

$('uploadArea').ondragover = (e) => {
    e.preventDefault();
    $('uploadArea').classList.add('over');
};
$('uploadArea').ondragleave = () => $('uploadArea').classList.remove('over');
$('uploadArea').ondrop = (e) => {
    e.preventDefault();
    $('uploadArea').classList.remove('over');
    if (e.dataTransfer.files.length) loadVideo(e.dataTransfer.files[0]);
};
$('videoInput').onchange = (e) => {
    if (e.target.files.length) loadVideo(e.target.files[0]);
};

function loadVideo(file) {
    if (!file.type.startsWith('video/')) {
        alert('Выбери видео файл!');
        return;
    }
    video.src = URL.createObjectURL(file);
    video.load();

    $('uploadArea').innerHTML =
        `<span class="upload-icon">✅</span>
         <p>${file.name}</p>
         <p class="hint">${(file.size / 1048576).toFixed(1)} MB</p>`;
    $('uploadArea').classList.add('done');

    video.onloadedmetadata = () => {
        overlay.width  = video.videoWidth;
        overlay.height = video.videoHeight;
        $('settingsSection').style.display = '';
        $('videoSection').style.display    = '';
        $('resultsSection').style.display  = 'none';
    };
}

// =============================================
// 2. ROI SELECTION
// =============================================

$('btnSelect').onclick = beginSelect;
$('btnReset').onclick   = resetROI;
$('btnAuto').onclick    = autoDetect;

function beginSelect() {
    if (!roi.top) {
        selecting = 'top';
        alert('Нарисуй прямоугольник вокруг ВЕРХНЕГО FPS');
    } else if (!roi.bot) {
        selecting = 'bot';
        alert('Нарисуй прямоугольник вокруг НИЖНЕГО FPS');
    } else {
        alert('Обе области выбраны! Нажми "Сброс" чтобы заново.');
        return;
    }
    enableDraw(true);
}

function enableDraw(on) {
    overlay.style.pointerEvents = on ? 'auto' : 'none';
    overlay.style.cursor        = on ? 'crosshair' : '';
    if (on) {
        overlay.onmousedown  = onDown;
        overlay.onmousemove  = onMove;
        overlay.onmouseup    = onUp;
        overlay.ontouchstart = onTouchDown;
        overlay.ontouchmove  = onTouchMove;
        overlay.ontouchend   = onTouchUp;
    } else {
        overlay.onmousedown = overlay.onmousemove = overlay.onmouseup = null;
        overlay.ontouchstart = overlay.ontouchmove = overlay.ontouchend = null;
    }
}

function coords(e) {
    const r = overlay.getBoundingClientRect();
    const sx = overlay.width / r.width;
    const sy = overlay.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

function onDown(e) { dragStart = coords(e); }
function onMove(e) {
    if (!dragStart) return;
    const p = coords(e);
    dragRect = {
        x: Math.min(dragStart.x, p.x),
        y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x),
        h: Math.abs(p.y - dragStart.y)
    };
    drawOverlay();
}
function onUp() { finishDrag(); }

// Touch support
function onTouchDown(e) { e.preventDefault(); dragStart = coords(e.touches[0]); }
function onTouchMove(e) {
    e.preventDefault();
    if (!dragStart) return;
    const p = coords(e.touches[0]);
    dragRect = {
        x: Math.min(dragStart.x, p.x),
        y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x),
        h: Math.abs(p.y - dragStart.y)
    };
    drawOverlay();
}
function onTouchUp(e) { e.preventDefault(); finishDrag(); }

function finishDrag() {
    if (dragRect && dragRect.w > 10 && dragRect.h > 10) {
        roi[selecting] = { ...dragRect };
        updateLabels();

        // Сразу предложить нижний
        if (selecting === 'top' && !roi.bot) {
            selecting = 'bot';
            dragStart = dragRect = null;
            drawOverlay();
            alert('Теперь нарисуй прямоугольник вокруг НИЖНЕГО FPS');
            return;
        }
    }
    dragStart = dragRect = null;
    selecting = null;
    enableDraw(false);
    drawOverlay();
    $('btnStart').disabled = !(roi.top && roi.bot);
}

function resetROI() {
    roi = { top: null, bot: null };
    selecting = null;
    dragStart = dragRect = null;
    enableDraw(false);
    drawOverlay();
    updateLabels();
    $('btnStart').disabled = true;
}

function updateLabels() {
    const fmt = (r) => r ? `${Math.round(r.w)}×${Math.round(r.h)}` : '—';
    $('roiTopLabel').textContent = roi.top ? `✅ Верх: ${fmt(roi.top)}` : '⬜ Верх: —';
    $('roiBotLabel').textContent = roi.bot ? `✅ Низ: ${fmt(roi.bot)}` : '⬜ Низ: —';
    $('roiTopLabel').className = roi.top ? 'ok' : '';
    $('roiBotLabel').className = roi.bot ? 'ok' : '';
}

function drawOverlay() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (roi.top) drawBox(roi.top, '#22c55e', 'Верхний FPS');
    if (roi.bot) drawBox(roi.bot, '#3b82f6', 'Нижний FPS');
    if (dragRect) {
        const clr = selecting === 'top' ? '#22c55e' : '#3b82f6';
        const lbl = selecting === 'top' ? 'Верхний FPS' : 'Нижний FPS';
        drawBox(dragRect, clr, lbl);
    }
}

function drawBox(r, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = color;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(label, r.x + 4, r.y - 6);
}

// =============================================
// 3. AUTO DETECT (ищет фиолетовые плашки)
// =============================================

async function autoDetect() {
    video.currentTime = 0.5;
    await new Promise((r) => (video.onseeked = r));

    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const cx = c.getContext('2d');
    cx.drawImage(video, 0, 0);

    const img = cx.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    // Маска фиолетовых пикселей
    const mask = [];
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        mask.push(r > 40 && r < 150 && g > 30 && g < 120 && b > 80 && b < 210 && b > r ? 1 : 0);
    }

    // Проецируем на Y-ось — горизонтальные полосы фиолетового
    const yHist = new Float32Array(c.height);
    for (let y = 0; y < c.height; y++) {
        let count = 0;
        for (let x = 0; x < c.width; x++) {
            count += mask[y * c.width + x];
        }
        yHist[y] = count / c.width;
    }

    // Находим полосы (где >15% ширины фиолетового)
    const bands = [];
    let inBand = false, bandStart = 0;
    for (let y = 0; y < c.height; y++) {
        if (yHist[y] > 0.15 && !inBand) {
            inBand = true;
            bandStart = y;
        }
        if (yHist[y] <= 0.15 && inBand) {
            inBand = false;
            if (y - bandStart > 15) {
                bands.push({ y1: bandStart, y2: y });
            }
        }
    }

    if (bands.length < 2) {
        alert('❌ Не удалось найти 2 области. Выбери вручную.');
        return;
    }

    // Для каждой полосы находим X-границы
    function findXBounds(band) {
        let minX = c.width, maxX = 0;
        for (let y = band.y1; y < band.y2; y++) {
            for (let x = 0; x < c.width; x++) {
                if (mask[y * c.width + x]) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }
            }
        }
        return { x: minX, y: band.y1, w: maxX - minX, h: band.y2 - band.y1 };
    }

    roi.top = findXBounds(bands[0]);
    roi.bot = findXBounds(bands[1]);

    // Добавляем небольшой padding
    [roi.top, roi.bot].forEach((r) => {
        r.x = Math.max(0, r.x - 5);
        r.y = Math.max(0, r.y - 5);
        r.w += 10;
        r.h += 10;
    });

    drawOverlay();
    updateLabels();
    $('btnStart').disabled = false;
    alert('✅ Области найдены автоматически!');
}

// =============================================
// 4. ANALYSIS (Tesseract OCR)
// =============================================

$('btnStart').onclick = runAnalysis;

async function runAnalysis() {
    if (busy) return;
    busy = true;
    topData = [];
    botData = [];

    const interval  = parseInt($('inputInterval').value) || 15;
    const threshold = parseInt($('inputThreshold').value) || 30;
    const duration  = video.duration;

    $('progressSection').style.display = '';
    $('resultsSection').style.display  = 'none';
    $('btnStart').disabled = true;
    $('btnStart').textContent = '⏳ Идёт анализ...';
    $('progressText').textContent = 'Загрузка OCR движка...';

    // Создаём Tesseract worker
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {}   // тихий режим
    });
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789.FPS:',
    });

    // Canvas для захвата кадров
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = video.videoWidth;
    tmpCanvas.height = video.videoHeight;
    const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });

    // Считаем примерный FPS видео (берём ~30 если неизвестно)
    let videoFPS = 30;
    const timeStep = interval / videoFPS;

    let analyzed = 0;
    const totalSteps = Math.floor(duration / timeStep);

    $('progressText').textContent = '0%';
    $('progressDetail').textContent = `~${totalSteps} кадров для анализа`;

    for (let t = 0; t < duration; t += timeStep) {
        // Переходим к нужному моменту
        video.currentTime = t;
        await new Promise((r) => (video.onseeked = r));
        await sleep(30); // даём браузеру отрисовать

        tmpCtx.drawImage(video, 0, 0);

        // Извлекаем числа
        const topVal = await ocrRegion(tmpCtx, roi.top, worker);
        const botVal = await ocrRegion(tmpCtx, roi.bot, worker);

        if (topVal !== null) topData.push(topVal);
        if (botVal !== null) botData.push(botVal);

        analyzed++;
        const pct = Math.min(100, (t / duration) * 100);
        $('progressFill').style.width = pct + '%';
        $('progressText').textContent = `${pct.toFixed(0)}%`;
        $('progressDetail').textContent =
            `Кадр ${analyzed}/${totalSteps} | Верх: ${topData.length} | Низ: ${botData.length} | Последние: ${topVal ?? '—'} / ${botVal ?? '—'}`;

        // Даём UI обновиться
        await sleep(5);
    }

    await worker.terminate();

    $('progressFill').style.width = '100%';
    $('progressText').textContent = '✅ Анализ завершён!';

    busy = false;
    $('btnStart').disabled = false;
    $('btnStart').textContent = '🚀 Начать анализ';

    showResults(threshold);
}

async function ocrRegion(srcCtx, roiRect, worker) {
    const { x, y, w, h } = roiRect;

    // Вырезаем область
    const imgData = srcCtx.getImageData(
        Math.round(x), Math.round(y),
        Math.round(w), Math.round(h)
    );

    // Создаём маленький canvas для Tesseract
    const c = document.createElement('canvas');
    c.width  = Math.round(w);
    c.height = Math.round(h);
    const cx = c.getContext('2d');
    cx.putImageData(imgData, 0, 0);

    // Предобработка: серый → контраст → бинаризация
    const gray = cx.getImageData(0, 0, c.width, c.height);
    const d = gray.data;
    for (let i = 0; i < d.length; i += 4) {
        // В серый
        const v = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
        // Бинаризация: белый текст на фиолетовом фоне → порог ~140
        const bin = v > 140 ? 255 : 0;
        d[i] = d[i+1] = d[i+2] = bin;
    }
    cx.putImageData(gray, 0, 0);

    // Увеличиваем для лучшего OCR
    const big = document.createElement('canvas');
    big.width  = c.width * 3;
    big.height = c.height * 3;
    const bx = big.getContext('2d');
    bx.imageSmoothingEnabled = false;
    bx.drawImage(c, 0, 0, big.width, big.height);

    try {
        const { data } = await worker.recognize(big);
        const text = data.text.trim();
        
        // Ищем число после "FPS:" или просто число
        const match = text.match(/(\d+\.?\d*)/);
        if (match) {
            const num = parseFloat(match[1]);
            if (num > 0 && num < 10000) return num;  // разумный диапазон
        }
    } catch (e) {
        // Ошибка OCR — пропускаем
    }
    return null;
}

// =============================================
// 5. RESULTS
// =============================================

function showResults(threshold) {
    $('resultsSection').style.display = '';

    if (topData.length) {
        const jumps = countJumps(topData, threshold);
        $('topMax').textContent   = Math.max(...topData).toFixed(1);
        $('topMin').textContent   = Math.min(...topData).toFixed(1);
        $('topAvg').textContent   = (topData.reduce((a, b) => a + b, 0) / topData.length).toFixed(2);
        $('topJumps').textContent = jumps;
        $('topCount').textContent = topData.length;
    }

    if (botData.length) {
        const jumps = countJumps(botData, threshold);
        $('botMax').textContent   = Math.max(...botData).toFixed(1);
        $('botMin').textContent   = Math.min(...botData).toFixed(1);
        $('botAvg').textContent   = (botData.reduce((a, b) => a + b, 0) / botData.length).toFixed(2);
        $('botJumps').textContent = jumps;
        $('botCount').textContent = botData.length;
    }
}

function countJumps(arr, threshold) {
    let jumps = 0;
    for (let i = 1; i < arr.length; i++) {
        if (Math.abs(arr[i] - arr[i - 1]) > threshold) jumps++;
    }
    return jumps;
}

// =============================================
// 6. EXPORT
// =============================================

$('btnTxt').onclick = exportTxt;
$('btnCsv').onclick = exportCsv;
$('btnCopy').onclick = copyResults;

function getReportText() {
    const threshold = parseInt($('inputThreshold').value) || 30;
    let txt = 'РЕЗУЛЬТАТЫ АНАЛИЗА FPS\n';
    txt += '='.repeat(40) + '\n\n';

    if (topData.length) {
        const avg = (topData.reduce((a, b) => a + b, 0) / topData.length).toFixed(2);
        txt += '1. Верхнее число (FPS)\n';
        txt += `   Максимальное число - ${Math.max(...topData).toFixed(1)}\n`;
        txt += `   Минимальное число - ${Math.min(...topData).toFixed(1)}\n`;
        txt += `   Среднее число - ${avg}\n`;
        txt += `   Количество резких скачков (>${threshold}) - ${countJumps(topData, threshold)}\n\
                    txt += `   Количество резких скачков (>${threshold}) - ${countJumps(topData, threshold)}\n`;
        txt += `   Всего замеров - ${topData.length}\n\n`;
    } else {
        txt += '1. Верхнее число (FPS) — данные не распознаны\n\n';
    }

    if (botData.length) {
        const avg = (botData.reduce((a, b) => a + b, 0) / botData.length).toFixed(2);
        txt += '2. Нижнее число (FPS)\n';
        txt += `   Максимальное число - ${Math.max(...botData).toFixed(1)}\n`;
        txt += `   Минимальное число - ${Math.min(...botData).toFixed(1)}\n`;
        txt += `   Среднее число - ${avg}\n`;
        txt += `   Количество резких скачков (>${threshold}) - ${countJumps(botData, threshold)}\n`;
        txt += `   Всего замеров - ${botData.length}\n`;
    } else {
        txt += '2. Нижнее число (FPS) — данные не распознаны\n';
    }

    return txt;
}

function exportTxt() {
    const txt = getReportText();
    download('fps_results.txt', txt, 'text/plain');
}

function exportCsv() {
    let csv = 'index,top_fps,bottom_fps\n';
    const maxLen = Math.max(topData.length, botData.length);
    for (let i = 0; i < maxLen; i++) {
        const t = i < topData.length ? topData[i] : '';
        const b = i < botData.length ? botData[i] : '';
        csv += `${i},${t},${b}\n`;
    }
    download('fps_data.csv', csv, 'text/csv');
}

function copyResults() {
    const txt = getReportText();
    navigator.clipboard.writeText(txt).then(() => {
        const btn = $('btnCopy');
        const original = btn.textContent;
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => { btn.textContent = original; }, 2000);
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const btn = $('btnCopy');
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => { btn.textContent = '📋 Копировать'; }, 2000);
    });
}

function download(filename, content, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
