/* ============================================
   FPS Video Analyzer — Fixed OCR Version
   ============================================ */

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- State ---
let roi = { top: null, bot: null };
let selecting = null;
let dragStart = null;
let dragRect = null;
let topData = [];
let botData = [];
let busy = false;

// --- Настройки валидации FPS ---
const FPS_MIN = 50;
const FPS_MAX = 300;

const video = $('video');
const overlay = $('overlay');
const ctx = overlay.getContext('2d');
const uploadArea = $('uploadArea');
const videoInput = $('videoInput');

// =============================================
// 1. FILE UPLOAD
// =============================================

uploadArea.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    videoInput.value = '';
    videoInput.click();
});

videoInput.addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
        loadVideo(e.target.files[0]);
    }
});

uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('over');
});

uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('over');
});

uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        loadVideo(e.dataTransfer.files[0]);
    }
});

function loadVideo(file) {
    if (!file.type.startsWith('video/')) {
        alert('Выбери видео файл!');
        return;
    }

    var url = URL.createObjectURL(file);
    video.src = url;
    video.load();

    uploadArea.innerHTML =
        '<span class="upload-icon">✅</span>' +
        '<p>' + file.name + '</p>' +
        '<p class="hint">' + (file.size / 1048576).toFixed(1) + ' MB — нажми чтобы заменить</p>';
    uploadArea.classList.add('done');

    video.addEventListener('loadedmetadata', function onMeta() {
        video.removeEventListener('loadedmetadata', onMeta);
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        $('settingsSection').style.display = '';
        $('videoSection').style.display = '';
        $('resultsSection').style.display = 'none';
        $('progressSection').style.display = 'none';
        video.currentTime = 0;
    });

    video.addEventListener('error', function() {
        alert('Ошибка загрузки видео! Попробуй MP4 формат.');
    });
}

// =============================================
// 2. ROI SELECTION
// =============================================

$('btnSelect').addEventListener('click', beginSelect);
$('btnReset').addEventListener('click', resetROI);
$('btnAuto').addEventListener('click', autoDetect);

function beginSelect() {
    if (!roi.top) {
        selecting = 'top';
        alert('Нарисуй прямоугольник вокруг ВЕРХНЕГО FPS');
    } else if (!roi.bot) {
        selecting = 'bot';
        alert('Нарисуй прямоугольник вокруг НИЖНЕГО FPS');
    } else {
        alert('Обе области выбраны! Нажми "Сброс".');
        return;
    }
    enableDraw(true);
}

function enableDraw(on) {
    overlay.style.pointerEvents = on ? 'auto' : 'none';
    overlay.style.cursor = on ? 'crosshair' : '';
    if (on) {
        overlay.addEventListener('mousedown', onDown);
        overlay.addEventListener('mousemove', onMove);
        overlay.addEventListener('mouseup', onUp);
        overlay.addEventListener('touchstart', onTouchDown, { passive: false });
        overlay.addEventListener('touchmove', onTouchMove, { passive: false });
        overlay.addEventListener('touchend', onTouchUp, { passive: false });
    } else {
        overlay.removeEventListener('mousedown', onDown);
        overlay.removeEventListener('mousemove', onMove);
        overlay.removeEventListener('mouseup', onUp);
        overlay.removeEventListener('touchstart', onTouchDown);
        overlay.removeEventListener('touchmove', onTouchMove);
        overlay.removeEventListener('touchend', onTouchUp);
    }
}

function coords(e) {
    var r = overlay.getBoundingClientRect();
    var sx = overlay.width / r.width;
    var sy = overlay.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

function onDown(e) { e.preventDefault(); dragStart = coords(e); }
function onMove(e) {
    e.preventDefault();
    if (!dragStart) return;
    var p = coords(e);
    dragRect = {
        x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y)
    };
    drawOverlay();
}
function onUp(e) { e.preventDefault(); finishDrag(); }

function onTouchDown(e) { e.preventDefault(); dragStart = coords(e.touches[0]); }
function onTouchMove(e) {
    e.preventDefault();
    if (!dragStart) return;
    var p = coords(e.touches[0]);
    dragRect = {
        x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y)
    };
    drawOverlay();
}
function onTouchUp(e) { e.preventDefault(); finishDrag(); }

function finishDrag() {
    if (dragRect && dragRect.w > 10 && dragRect.h > 10) {
        roi[selecting] = { ...dragRect };
        updateLabels();
        if (selecting === 'top' && !roi.bot) {
            selecting = 'bot';
            dragStart = null; dragRect = null;
            drawOverlay();
            alert('Теперь нарисуй прямоугольник вокруг НИЖНЕГО FPS');
            return;
        }
    }
    dragStart = null; dragRect = null; selecting = null;
    enableDraw(false);
    drawOverlay();
    $('btnStart').disabled = !(roi.top && roi.bot);
}

function resetROI() {
    roi = { top: null, bot: null };
    selecting = null; dragStart = null; dragRect = null;
    enableDraw(false); drawOverlay(); updateLabels();
    $('btnStart').disabled = true;
}

function updateLabels() {
    var fmt = function(r) { return r ? Math.round(r.w) + '×' + Math.round(r.h) : '—'; };
    $('roiTopLabel').textContent = roi.top ? '✅ Верх: ' + fmt(roi.top) : '⬜ Верх: —';
    $('roiBotLabel').textContent = roi.bot ? '✅ Низ: ' + fmt(roi.bot) : '⬜ Низ: —';
    $('roiTopLabel').className = roi.top ? 'ok' : '';
    $('roiBotLabel').className = roi.bot ? 'ok' : '';
}

function drawOverlay() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (roi.top) drawBox(roi.top, '#22c55e', 'Верхний FPS');
    if (roi.bot) drawBox(roi.bot, '#3b82f6', 'Нижний FPS');
    if (dragRect) {
        var clr = selecting === 'top' ? '#22c55e' : '#3b82f6';
        var lbl = selecting === 'top' ? 'Верхний FPS' : 'Нижний FPS';
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
// 3. AUTO DETECT
// =============================================

async function autoDetect() {
    $('btnAuto').disabled = true;
    $('btnAuto').textContent = '⏳ Поиск...';

    try {
        video.currentTime = 0.5;
        await new Promise(function(resolve) {
            video.onseeked = resolve;
            setTimeout(resolve, 2000);
        });
        await sleep(200);

        var c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        var cx = c.getContext('2d');
        cx.drawImage(video, 0, 0);

        var img = cx.getImageData(0, 0, c.width, c.height);
        var d = img.data;

        var rowBrightness = new Float32Array(c.height);
        for (var y = 0; y < c.height; y++) {
            var sum = 0;
            for (var x = 0; x < c.width; x++) {
                var idx = (y * c.width + x) * 4;
                sum += d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114;
            }
            rowBrightness[y] = sum / c.width;
        }

        var bands = [];
        var inBand = false;
        var bandStart = 0;
        for (var y = 0; y < c.height; y++) {
            if (rowBrightness[y] > 15 && !inBand) {
                inBand = true; bandStart = y;
            } else if (rowBrightness[y] <= 15 && inBand) {
                inBand = false;
                if (y - bandStart > 5) {
                    var minX = c.width, maxX = 0;
                    for (var by = bandStart; by < y; by++) {
                        for (var bx = 0; bx < c.width; bx++) {
                            var bi = (by * c.width + bx) * 4;
                            if (d[bi] * 0.299 + d[bi + 1] * 0.587 + d[bi + 2] * 0.114 > 15) {
                                minX = Math.min(minX, bx);
                                maxX = Math.max(maxX, bx);
                            }
                        }
                    }
                    if (maxX > minX) {
                        bands.push({
                            x: Math.max(0, minX - 5), y: Math.max(0, bandStart - 3),
                            w: Math.min(c.width, maxX - minX + 10), h: Math.min(c.height, y - bandStart + 6)
                        });
                    }
                }
            }
        }

        if (bands.length >= 2) {
            bands.sort(function(a, b) { return a.y - b.y; });
            roi.top = bands[0]; roi.bot = bands[1];
            drawOverlay(); updateLabels();
            $('btnStart').disabled = false;
            alert('✅ Области найдены!');
        } else {
            alert('❌ Не найдено. Выбери вручную.');
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }

    $('btnAuto').disabled = false;
    $('btnAuto').textContent = '🤖 Авто';
}

// =============================================
// 4. УЛУЧШЕННЫЙ OCR
// =============================================

$('btnStart').addEventListener('click', runAnalysis);

async function runAnalysis() {
    if (busy) return;
    busy = true;
    topData = [];
    botData = [];

    var interval = parseInt($('inputInterval').value) || 15;
    var threshold = parseInt($('inputThreshold').value) || 30;
    var duration = video.duration;

    $('progressSection').style.display = '';
    $('resultsSection').style.display = 'none';
    $('btnStart').disabled = true;
    $('btnStart').textContent = '⏳ Идёт анализ...';
    $('progressText').textContent = 'Загрузка OCR...';
    $('progressDetail').textContent = '';

    try {
        var worker = await Tesseract.createWorker('eng', 1, { logger: function() {} });
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789.',
        });

        $('progressText').textContent = 'Анализирую...';

        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = video.videoWidth;
        tmpCanvas.height = video.videoHeight;
        var tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });

        var videoFPS = 30;
        var timeStep = interval / videoFPS;
        var totalSteps = Math.floor(duration / timeStep);
        var analyzed = 0;
        var skippedTop = 0;
        var skippedBot = 0;

        for (var t = 0; t < duration; t += timeStep) {
            video.currentTime = t;
            await new Promise(function(resolve) {
                video.onseeked = resolve;
                setTimeout(resolve, 1000);
            });
            await sleep(50);

            tmpCtx.drawImage(video, 0, 0);

            var topVal = await ocrRegion(tmpCtx, roi.top, worker);
            var botVal = await ocrRegion(tmpCtx, roi.bot, worker);

            // === ВАЛИДАЦИЯ: только 50-300 FPS ===
            if (topVal !== null && topVal >= FPS_MIN && topVal <= FPS_MAX) {
                topData.push(topVal);
            } else if (topVal !== null) {
                skippedTop++;
            }

            if (botVal !== null && botVal >= FPS_MIN && botVal <= FPS_MAX) {
                botData.push(botVal);
            } else if (botVal !== null) {
                skippedBot++;
            }

            analyzed++;
            var pct = Math.min(100, (t / duration) * 100);
            $('progressFill').style.width = pct + '%';
            $('progressText').textContent = pct.toFixed(0) + '%';
            $('progressDetail').textContent =
                'Кадр ' + analyzed + '/' + totalSteps +
                ' | Верх: ' + topData.length + ' (откл: ' + skippedTop + ')' +
                ' | Низ: ' + botData.length + ' (откл: ' + skippedBot + ')' +
                ' | Raw: ' + (topVal !== null ? topVal : '—') + ' / ' + (botVal !== null ? botVal : '—');

            await sleep(5);
        }

        await worker.terminate();

        $('progressFill').style.width = '100%';
        $('progressText').textContent = '✅ Готово!';
        $('progressDetail').textContent =
            'Верх: ' + topData.length + ' валидных (отклонено ' + skippedTop + ')' +
            ' | Низ: ' + botData.length + ' валидных (отклонено ' + skippedBot + ')';

        showResults(threshold);

    } catch (err) {
        alert('Ошибка: ' + err.message);
        $('progressText').textContent = '❌ Ошибка';
    }

    busy = false;
    $('btnStart').disabled = false;
    $('btnStart').textContent = '🚀 Начать анализ';
}

// === УЛУЧШЕННАЯ ПРЕДОБРАБОТКА OCR ===
async function ocrRegion(srcCtx, roiRect, worker) {
    if (!roiRect) return null;

    var x = Math.round(roiRect.x);
    var y = Math.round(roiRect.y);
    var w = Math.round(roiRect.w);
    var h = Math.round(roiRect.h);

    if (w <= 0 || h <= 0) return null;

    try {
        var imgData = srcCtx.getImageData(x, y, w, h);

        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var cx = c.getContext('2d');
        cx.putImageData(imgData, 0, 0);

        // === ШАГИ ПРЕДОБРАБОТКИ ===
        var processed = cx.getImageData(0, 0, w, h);
        var d = processed.data;

        // 1. Конвертируем в серый
        for (var i = 0; i < d.length; i += 4) {
            var gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            d[i] = d[i + 1] = d[i + 2] = gray;
        }

        // 2. Определяем порог адаптивно (Otsu-подобный)
        var histogram = new Array(256).fill(0);
        for (var i = 0; i < d.length; i += 4) {
            histogram[Math.round(d[i])]++;
        }
        var totalPixels = w * h;
        var otsuThreshold = 128;
        var maxVariance = 0;
        var sumAll = 0;
        for (var t = 0; t < 256; t++) sumAll += t * histogram[t];
        var sumBg = 0, countBg = 0;
        for (var t = 0; t < 256; t++) {
            countBg += histogram[t];
            if (countBg === 0) continue;
            var countFg = totalPixels - countBg;
            if (countFg === 0) break;
            sumBg += t * histogram[t];
            var meanBg = sumBg / countBg;
            var meanFg = (sumAll - sumBg) / countFg;
            var variance = countBg * countFg * (meanBg - meanFg) * (meanBg - meanFg);
            if (variance > maxVariance) {
                maxVariance = variance;
                otsuThreshold = t;
            }
        }

        // 3. Бинаризация с Otsu порогом
        for (var i = 0; i < d.length; i += 4) {
            var bin = d[i] > otsuThreshold ? 255 : 0;
            d[i] = d[i + 1] = d[i + 2] = bin;
        }

        // 4. Определяем что является текстом (белый текст или чёрный)
        //    Считаем белые пиксели — если их меньше 50%, значит текст белый (правильно)
        //    Если больше — инвертируем
        var whiteCount = 0;
        for (var i = 0; i < d.length; i += 4) {
            if (d[i] === 255) whiteCount++;
        }
        if (whiteCount > totalPixels * 0.5) {
            // Инвертируем — текст должен быть чёрным на белом для OCR
            for (var i = 0; i < d.length; i += 4) {
                d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
            }
        }

        cx.putImageData(processed, 0, 0);

        // 5. Увеличиваем x4 (лучше для Tesseract)
        var scale = 4;
        var big = document.createElement('canvas');
        big.width = w * scale;
        big.height = h * scale;
        var bx = big.getContext('2d');
        bx.imageSmoothingEnabled = false;
        bx.drawImage(c, 0, 0, big.width, big.height);

        // 6. Добавляем белые поля (padding) — Tesseract лучше читает с полями
        var padded = document.createElement('canvas');
        var pad = 20;
        padded.width = big.width + pad * 2;
        padded.height = big.height + pad * 2;
        var px = padded.getContext('2d');
        px.fillStyle = '#ffffff';
        px.fillRect(0, 0, padded.width, padded.height);
        px.drawImage(big, pad, pad);

        // 7. OCR
        var result = await worker.recognize(padded);
        var text = result.data.text.trim();

        // 8. Парсинг — убираем всё кроме цифр и точки
        text = text.replace(/[^0-9.]/g, '');

        // Ищем число формата XXX.X или XXX
        var match = text.match(/(\d{2,3}\.\d{1,2})/);
        if (!match) {
            match = text.match(/(\d{2,3})/);
        }

        if (match) {
            var num = parseFloat(match[1]);
            return num;
        }
    } catch (e) {
        // пропускаем
    }
    return null;
}

// =============================================
// 5. RESULTS
// =============================================

function showResults(threshold) {
    $('resultsSection').style.display = '';

    if (topData.length > 0) {
        $('topMax').textContent = Math.max.apply(null, topData).toFixed(1);
        $('topMin').textContent = Math.min.apply(null, topData).toFixed(1);
        $('topAvg').textContent = (topData.reduce(function(a, b) { return a + b; }, 0) / topData.length).toFixed(2);
        $('topJumps').textContent = countJumps(topData, threshold);
        $('topCount').textContent = topData.length;
    } else {
        $('topMax').textContent = $('topMin').textContent = $('topAvg').textContent = 'Нет данных';
        $('topJumps').textContent = 'Нет данных';
        $('topCount').textContent = '0';
    }

    if (botData.length > 0) {
        $('botMax').textContent = Math.max.apply(null, botData).toFixed(1);
        $('botMin').textContent = Math.min.apply(null, botData).toFixed(1);
        $('botAvg').textContent = (botData.reduce(function(a, b) { return a + b; }, 0) / botData.length).toFixed(2);
        $('botJumps').textContent = countJumps(botData, threshold);
        $('botCount').textContent = botData.length;
    } else {
        $('botMax').textContent = $('botMin').textContent = $('botAvg').textContent = 'Нет данных';
        $('botJumps').textContent = 'Нет данных';
        $('botCount').textContent = '0';
    }
}

function countJumps(arr, threshold) {
    var jumps = 0;
    for (var i = 1; i < arr.length; i++) {
        if (Math.abs(arr[i] - arr[i - 1]) > threshold) jumps++;
    }
    return jumps;
}

// =============================================
// 6. EXPORT
// =============================================

$('btnTxt').addEventListener('click', exportTxt);
$('btnCsv').addEventListener('click', exportCsv);
$('btnCopy').addEventListener('click', copyResults);

function getReportText() {
    var threshold = parseInt($('inputThreshold').value) || 30;
    var txt = 'РЕЗУЛЬТАТЫ АНАЛИЗА FPS\n';
    txt += '========================================\n\n';

    if (topData.length > 0) {
        var topAvg = (topData.reduce(function(a, b) { return a + b; }, 0) / topData.length).toFixed(2);
        txt += '1. Верхнее число\n';
        txt += '   Максимальное число - ' + Math.max.apply(null, topData).toFixed(1) + '\n';
        txt += '   Минимальное число - ' + Math.min.apply(null, topData).toFixed(1) + '\n';
        txt += '   Среднее число - ' + topAvg + '\n';
        txt += '   Количество резких скачков (>' + threshold + ') - ' + countJumps(topData, threshold) + '\n';
        txt += '   Замеров - ' + topData.length + '\n\n';
    } else {
        txt += '1. Верхнее число — нет данных\n\n';
    }

    if (botData.length > 0) {
        var botAvg = (botData.reduce(function(a, b) { return a + b; }, 0) / botData.length).toFixed(2);
        txt += '2. Нижнее число\n';
        txt += '   Максимальное число - ' + Math.max.apply(null, botData).toFixed(1) + '\n';
        txt += '   Минимальное число - ' + Math.min.apply(null, botData).toFixed(1) + '\n';
        txt += '   Среднее число - ' + botAvg + '\n';
        txt += '   Количество резких скачков (>' + threshold + ') - ' + countJumps(botData, threshold) + '\n';
        txt += '   Замеров - ' + botData.length + '\n';
    } else {
        txt += '2. Нижнее число — нет данных\n';
    }

    return txt;
}

function exportTxt() { downloadFile('fps_results.txt', getReportText(), 'text/plain'); }

function exportCsv() {
    var csv = 'index,top_fps,bottom_fps\n';
    var maxLen = Math.max(topData.length, botData.length);
    for (var i = 0; i < maxLen; i++) {
        csv += i + ',' + (i < topData.length ? topData[i] : '') + ',' + (i < botData.length ? botData[i] : '') + '\n';
    }
    downloadFile('fps_data.csv', csv, 'text/csv');
}

function copyResults() {
    var txt = getReportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(showCopyOk).catch(function() { fallbackCopy(txt); });
    } else {
        fallbackCopy(txt);
    }
}

function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyOk(); } catch (e) { alert(txt); }
    document.body.removeChild(ta);
}

function showCopyOk() {
    var btn = $('btnCopy');
    btn.textContent = '✅ Скопировано!';
    setTimeout(function() { btn.textContent = '📋 Копировать'; }, 2000);
}

function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
