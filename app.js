const APP_STATE = {
    currentExam: null,
    currentBooklet: 'A',
    videoStream: null,
    scanResult: null,
    markerDetectionLoop: null,
    lastOMRResult: null,
    opencvReady: false
};

window._initOpenCv = function() {
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        _onOpenCvReady();
    } else if (typeof cv !== 'undefined') {
        cv['onRuntimeInitialized'] = _onOpenCvReady;
    }
};

window._showOpenCvError = function() {
    const banner = document.getElementById('opencv-status');
    if (banner) {
        banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>OpenCV failed to load! Scanning will not work.</span>';
        banner.className = 'opencv-loading-banner error';
    }
    console.error('OpenCV.js failed to load');
};

function _onOpenCvReady() {
    APP_STATE.opencvReady = true;
    OMRProcessor.setReady(true);
    const banner = document.getElementById('opencv-status');
    if (banner) {
        banner.innerHTML = '<i class="fas fa-check-circle"></i> <span>OpenCV ready</span>';
        banner.className = 'opencv-loading-banner ready';
        setTimeout(() => { banner.classList.add('hidden'); }, 2000);
    }
    console.log('OpenCV.js ready');
}

(function _checkPendingOpenCv() {
    if (window._opencvLoadState === 'loaded') {
        window._initOpenCv();
    } else if (window._opencvLoadState === 'error') {
        window._showOpenCvError();
    }
})();

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function showLoading(show = true) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('hidden', !show);
}

function showModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function navigateTo(pageName) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    
    switch(pageName) {
        case 'home':
            renderExamList();
            break;
        case 'answer-keys':
            renderAnswerKeysExamList();
            break;
        case 'scan':
            populateScanExamSelect();
            break;
        case 'answer-sheet':
            if (APP_STATE.currentExam) {
                openAnswerSheet(APP_STATE.currentExam.id);
            }
            break;
        case 'results':
            populateResultsExamSelect();
            break;
        case 'form-generator':
            break;
        case 'account':
            updateAccountPage();
            break;
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        navigateTo(btn.dataset.page);
    });
});

function renderExamList() {
    const exams = db.getExams();
    const container = document.getElementById('exam-list');
    
    if (exams.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No exams created yet</p>
                <button class="btn btn-primary" onclick="navigateTo('create-exam')">
                    <i class="fas fa-plus"></i> Create Your First Exam
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = exams.map(exam => {
        const results = db.getResultsByExam(exam.id);
        return `
            <div class="exam-item">
                <div class="exam-item-info">
                    <h3>${exam.name}</h3>
                    <p>${exam.questionCount} questions • ${exam.booklets ? exam.booklets.join(', ') : 'A'} Booklet • ${results.length} results</p>
                </div>
                <div class="exam-item-actions">
                    <button class="btn-icon-primary" onclick="openAnswerKey('${exam.id}')" title="Answer Key">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn-icon-success" onclick="openAnswerSheet('${exam.id}')" title="Answer Sheet">
                        <i class="fas fa-file-alt"></i>
                    </button>
                    <button class="btn-icon-danger" onclick="deleteExam('${exam.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAnswerKeysExamList() {
    const exams = db.getExams();
    const container = document.getElementById('answer-keys-exam-list');
    
    if (exams.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No exams created yet</p>
                <button class="btn btn-primary" onclick="navigateTo('create-exam')">
                    <i class="fas fa-plus"></i> Create Exam
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = exams.map(exam => {
        const booklets = exam.booklets || ['A'];
        const answerKeyCount = booklets.filter(b => db.getAnswerKeyByExamAndBooklet(exam.id, b)).length;
        const statusIcon = answerKeyCount === booklets.length ? 'fa-check-circle' : 'fa-exclamation-circle';
        const statusColor = answerKeyCount === booklets.length ? 'var(--success-color)' : 'var(--warning-color)';
        const statusText = answerKeyCount === booklets.length ? 'Completed' : `${answerKeyCount}/${booklets.length} Booklet`;
        
        return `
            <div class="exam-item">
                <div class="exam-item-info">
                    <h3>${exam.name}</h3>
                    <p>
                        <i class="${statusIcon}" style="color: ${statusColor}"></i>
                        ${statusText} • ${exam.questionCount} questions
                    </p>
                </div>
                <div class="exam-item-actions">
                    <button class="btn-icon-primary" onclick="openAnswerKey('${exam.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon-success" onclick="openAnswerSheet('${exam.id}')" title="Sheet">
                        <i class="fas fa-file-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('exam-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('exam-name').value.trim();
    const questionCount = parseInt(document.getElementById('question-count').value);
    const optionCount = parseInt(document.getElementById('option-count').value);
    const wrongPenalty = parseInt(document.getElementById('wrong-penalty').value);
    const pointsPerQuestion = parseInt(document.getElementById('points-per-question').value);
    
    const booklets = [];
    document.querySelectorAll('input[name="booklet"]:checked').forEach(cb => {
        booklets.push(cb.value);
    });
    
    if (booklets.length === 0) {
        showToast('Please select at least one booklet', 'error');
        return;
    }
    
    const exam = {
        name,
        questionCount,
        optionCount,
        wrongPenalty,
        pointsPerQuestion,
        booklets
    };
    
    const saved = db.saveExam(exam);
    
    showToast('Exam created successfully', 'success');
    this.reset();
    openAnswerKey(saved.id);
});

function deleteExam(examId) {
    showModal(
        'Delete Exam',
        '<p>Are you sure you want to delete this exam and all its results?</p>',
        `
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="confirmDeleteExam('${examId}')">Delete</button>
        `
    );
}

function confirmDeleteExam(examId) {
    db.deleteExam(examId);
    closeModal();
    showToast('Exam deleted', 'success');
    renderExamList();
}

function openAnswerKey(examId) {
    const exam = db.getExamById(examId);
    if (!exam) {
        showToast('Exam not found', 'error');
        return;
    }
    
    APP_STATE.currentExam = exam;
    APP_STATE.currentBooklet = exam.booklets[0];
    
    document.getElementById('answer-key-exam-info').innerHTML = `
        <strong>${exam.name}</strong><br>
        <small>${exam.questionCount} questions • ${exam.optionCount} options</small>
    `;
    
    renderBookletTabs();
    renderAnswerKeyForm();
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-answer-key').classList.add('active');
}

function renderBookletTabs() {
    const exam = APP_STATE.currentExam;
    const container = document.getElementById('booklet-tabs');
    
    if (!exam.booklets || exam.booklets.length === 0) return;
    
    container.innerHTML = exam.booklets.map(booklet => `
        <button class="booklet-tab ${booklet === APP_STATE.currentBooklet ? 'active' : ''}" 
                onclick="switchBooklet('${booklet}')">
            Booklet ${booklet}
        </button>
    `).join('');
}

function switchBooklet(booklet) {
    APP_STATE.currentBooklet = booklet;
    renderBookletTabs();
    renderAnswerKeyForm();
}

function renderAnswerKeyForm() {
    const exam = APP_STATE.currentExam;
    const booklet = APP_STATE.currentBooklet;
    const answerKey = db.getAnswerKeyByExamAndBooklet(exam.id, booklet) || {};
    const answers = answerKey.answers || {};
    
    const container = document.getElementById('answer-key-form');
    const optionLetters = 'ABCDE'.substring(0, exam.optionCount);
    
    let html = '<div class="answer-key-grid">';
    html += '<div class="ak-header-row">';
    html += '<span class="ak-header-num">#</span>';
    html += optionLetters.split('').map(opt => `<span class="ak-header-opt">${opt}</span>`).join('');
    html += '</div>';
    
    for (let q = 1; q <= exam.questionCount; q++) {
        const currentAnswer = answers[q] || '';
        const options = optionLetters.split('').map(opt => `
            <label class="ak-option ${currentAnswer === opt ? 'selected' : ''}">
                <input type="radio" name="q${q}" value="${opt}" ${currentAnswer === opt ? 'checked' : ''}>
                <span>${opt}</span>
            </label>
        `).join('');
        
        html += `
            <div class="ak-row ${q % 2 === 0 ? 'ak-row-even' : ''}">
                <span class="ak-num">${q}</span>
                <div class="ak-options">${options}</div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.ak-option input').forEach(radio => {
        radio.addEventListener('change', function() {
            const row = this.closest('.ak-row');
            row.querySelectorAll('.ak-option').forEach(opt => opt.classList.remove('selected'));
            this.closest('.ak-option').classList.add('selected');
        });
    });
}

document.getElementById('save-answer-key').addEventListener('click', function() {
    const exam = APP_STATE.currentExam;
    const booklet = APP_STATE.currentBooklet;
    
    const answers = {};
    for (let q = 1; q <= exam.questionCount; q++) {
        const selected = document.querySelector(`input[name="q${q}"]:checked`);
        if (selected) {
            answers[q] = selected.value;
        }
    }
    
    db.saveAnswerKey(exam.id, booklet, answers);
    showToast(`${booklet} booklet answer key saved`, 'success');
    renderExamList();
});

function previewAnswerSheet() {
    const exam = APP_STATE.currentExam;
    if (!exam) {
        showToast('Exam not found', 'error');
        return;
    }

    const booklet = APP_STATE.currentBooklet;
    const answers = {};
    for (let q = 1; q <= exam.questionCount; q++) {
        const selected = document.querySelector(`input[name="q${q}"]:checked`);
        if (selected) {
            answers[q] = selected.value;
        }
    }
    db.saveAnswerKey(exam.id, booklet, answers);
    openAnswerSheet(exam.id);
}

function openAnswerSheet(examId) {
    const exam = db.getExamById(examId);
    if (!exam) {
        showToast('Exam not found', 'error');
        return;
    }
    
    APP_STATE.currentExam = exam;
    
    const select = document.getElementById('preview-booklet');
    select.innerHTML = (exam.booklets || ['A']).map(b => `
        <option value="${b}">Booklet ${b}</option>
    `).join('');
    
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    newSelect.addEventListener('change', (e) => {
        APP_STATE.currentBooklet = e.target.value;
        renderAnswerSheet();
    });
    
    APP_STATE.currentBooklet = exam.booklets[0];
    renderAnswerSheet();
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-answer-sheet').classList.add('active');
}

function renderAnswerSheet() {
    const exam = APP_STATE.currentExam;
    const booklet = APP_STATE.currentBooklet;
    const answerKey = db.getAnswerKeyByExamAndBooklet(exam.id, booklet);
    
    const canvas = document.getElementById('answer-sheet-canvas');
    FormTemplate.drawSheet(canvas, exam, booklet, answerKey);
}

function generateStandaloneForm() {
    const title = document.getElementById('fg-title').value.trim() || 'Optik Form';
    const questionCount = parseInt(document.getElementById('fg-question-count').value) || 20;
    const optionCount = parseInt(document.getElementById('fg-option-count').value) || 5;
    const bookletType = document.getElementById('fg-booklet').value || '';

    if (questionCount < 1 || questionCount > 100) {
        showToast('Question count must be between 1-100', 'error');
        return;
    }

    const fakeExam = {
        name: title,
        questionCount: questionCount,
        optionCount: optionCount
    };

    const canvas = document.getElementById('fg-canvas');
    FormTemplate.drawSheet(canvas, fakeExam, bookletType, null);

    document.getElementById('fg-preview-area').classList.remove('hidden');
    showToast('Form generated', 'success');
}

function downloadStandaloneForm() {
    const canvas = document.getElementById('fg-canvas');
    const title = document.getElementById('fg-title').value.trim() || 'Optik Form';
    const booklet = document.getElementById('fg-booklet').value || 'A';
    const copies = parseInt(document.getElementById('fg-copies').value) || 1;

    if (copies === 1) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'optik-form-' + title.replace(/\s+/g, '-') + '-' + booklet + '.png';
        link.click();
    } else {
        for (let i = 1; i <= copies; i++) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'optik-form-' + title.replace(/\s+/g, '-') + '-' + booklet + '-copy' + i + '.png';
            setTimeout(() => link.click(), i * 200);
        }
    }
    showToast(copies > 1 ? copies + ' copies downloading' : 'Form downloaded', 'success');
}

function printStandaloneForm() {
    window.print();
}

document.getElementById('download-answer-sheet').addEventListener('click', function() {
    const canvas = document.getElementById('answer-sheet-canvas');
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `answer-sheet-${APP_STATE.currentExam.name.replace(/\s+/g, '-')}-${APP_STATE.currentBooklet}.png`;
    link.click();
    showToast('Answer sheet downloaded', 'success');
});

function populateScanExamSelect() {
    const select = document.getElementById('manual-exam-select');
    const exams = db.getExams();
    
    select.innerHTML = '<option value="">-- Select Exam --</option>' + 
        exams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    newSelect.addEventListener('change', () => {
        const camerBtn = document.getElementById('manual-scan-btn');
        const fileBtn = document.getElementById('file-scan-btn');
        if (newSelect.value && APP_STATE.opencvReady) {
            camerBtn.disabled = false;
            fileBtn.disabled = false;
        } else {
            camerBtn.disabled = true;
            fileBtn.disabled = true;
        }
    });
}

function startOpticalScanner() {
    const select = document.getElementById('manual-exam-select');
    const examId = select.value;
    if (!examId) {
        showToast('Please select an exam', 'error');
        return;
    }
    
    if (!APP_STATE.opencvReady) {
        showToast('OpenCV not loaded yet, please wait', 'error');
        return;
    }
    
    const exam = db.getExamById(examId);
    APP_STATE.currentExam = exam;
    
    document.getElementById('file-preview-container').classList.add('hidden');
    document.getElementById('scan-mode-select').classList.add('hidden');
    document.getElementById('optical-scanner-container').classList.remove('hidden');
    document.getElementById('current-exam-name').textContent = exam.name;
    
    startCamera('optical-video');
}

function startFileScan() {
    const select = document.getElementById('manual-exam-select');
    const examId = select.value;
    if (!examId) {
        showToast('Please select an exam', 'error');
        return;
    }
    
    if (!APP_STATE.opencvReady) {
        showToast('OpenCV not loaded yet', 'error');
        return;
    }
    
    APP_STATE.currentExam = db.getExamById(examId);
    document.getElementById('scan-file-input').click();
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById('file-preview-image');
        img.src = e.target.result;
        img.onload = function() {
            document.getElementById('file-preview-container').classList.remove('hidden');
            showToast('Image loaded. Press "Read Form" button.', 'info');
        };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function processFileImage() {
    if (!OMRProcessor.isReady()) {
        showToast('OpenCV not ready yet', 'error');
        return;
    }
    
    const img = document.getElementById('file-preview-image');
    const canvas = document.getElementById('file-scan-canvas');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    showLoading(true);
    
    setTimeout(() => {
        const exam = APP_STATE.currentExam;
        const debugCanvas = document.getElementById('debug-canvas');
        OMRProcessor.enableDebug(debugCanvas);
        
        const result = OMRProcessor.process(canvas, exam);
        
        OMRProcessor.disableDebug();
        showLoading(false);
        
        if (result.success) {
            APP_STATE.lastOMRResult = result;
            
            const booklet = result.booklet !== '?' ? result.booklet : (exam.booklets ? exam.booklets[0] : 'A');
            const answerKey = db.getAnswerKeyByExamAndBooklet(exam.id, booklet);
            
            if (!answerKey) {
                showToast('No answer key defined for this booklet', 'warning');
            }
            
            const scoring = calculateScore(result.answers, answerKey, exam);
            
            const fullResult = {
                ...result,
                ...scoring,
                booklet: booklet,
                examId: exam.id
            };
            
            document.getElementById('file-preview-container').classList.add('hidden');
            showScanResult(fullResult);
        } else {
            showToast(result.error, 'error');
        }
    }, 100);
}

function cancelFileScan() {
    document.getElementById('file-preview-container').classList.add('hidden');
    document.getElementById('file-preview-image').src = '';
}

async function startCamera(videoId) {
    try {
        const constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'environment'
            },
            audio: false
        };
        
        APP_STATE.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById(videoId);
        video.srcObject = APP_STATE.videoStream;
        await video.play();
        
        showToast('Camera started', 'success');
        startMarkerDetectionLoop(video);
    } catch (error) {
        showToast('Camera access denied: ' + error.message, 'error');
        console.error('Camera error:', error);
    }
}

function startMarkerDetectionLoop(video) {
    const statusEl = document.getElementById('detection-status');
    const statusText = statusEl.querySelector('.status-text');
    const statusIcon = statusEl.querySelector('.status-icon');
    let frameCount = 0;
    
    function detectFrame() {
        if (!APP_STATE.videoStream) return;
        
        frameCount++;
        if (frameCount % 15 === 0 && OMRProcessor.isReady()) {
            const markers = OMRProcessor.detectMarkersOnly(video);
            
            if (markers) {
                statusIcon.innerHTML = '<i class="fas fa-check-circle" style="color: #06d6a0"></i>';
                statusText.textContent = 'Form found! Press capture button.';
                statusText.style.color = '#06d6a0';
                drawMarkerOverlay(video, markers);
            } else {
                statusIcon.innerHTML = '<i class="fas fa-search"></i>';
                statusText.textContent = 'Searching for form...';
                statusText.style.color = '';
                
                clearMarkerOverlay();
            }
        }
        
        APP_STATE.markerDetectionLoop = requestAnimationFrame(detectFrame);
    }
    
    detectFrame();
}

function drawMarkerOverlay(video, markers) {
    const overlayCanvas = document.getElementById('marker-overlay-canvas');
    if (!overlayCanvas) return;
    
    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    overlayCanvas.width = displayW;
    overlayCanvas.height = displayH;
    
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, displayW, displayH);
    
    const scaleX = displayW / video.videoWidth;
    const scaleY = displayH / video.videoHeight;
    
    ctx.strokeStyle = '#06d6a0';
    ctx.lineWidth = 3;
    
    Object.values(markers).forEach(m => {
        const x = m.cx * scaleX;
        const y = m.cy * scaleY;
        const s = Math.sqrt(m.area) * scaleX;
        
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
    });
    
    const pts = [markers.topLeft, markers.topRight, markers.bottomRight, markers.bottomLeft];
    ctx.strokeStyle = 'rgba(6, 214, 160, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].cx * scaleX, pts[0].cy * scaleY);
    for (let i = 1; i <= 4; i++) {
        const p = pts[i % 4];
        ctx.lineTo(p.cx * scaleX, p.cy * scaleY);
    }
    ctx.stroke();
}

function clearMarkerOverlay() {
    const overlayCanvas = document.getElementById('marker-overlay-canvas');
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function stopOpticalScanner() {
    if (APP_STATE.markerDetectionLoop) {
        cancelAnimationFrame(APP_STATE.markerDetectionLoop);
        APP_STATE.markerDetectionLoop = null;
    }
    
    if (APP_STATE.videoStream) {
        APP_STATE.videoStream.getTracks().forEach(track => track.stop());
        APP_STATE.videoStream = null;
    }
    
    clearMarkerOverlay();
    
    document.getElementById('optical-scanner-container').classList.add('hidden');
    document.getElementById('scan-mode-select').classList.remove('hidden');
    document.getElementById('scan-result').classList.add('hidden');
}

function captureAndProcess() {
    if (!OMRProcessor.isReady()) {
        showToast('OpenCV not ready yet', 'error');
        return;
    }
    
    const video = document.getElementById('optical-video');
    const canvas = document.getElementById('optical-canvas');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    showToast('Processing form...', 'info');
    showLoading(true);
    
    if (APP_STATE.markerDetectionLoop) {
        cancelAnimationFrame(APP_STATE.markerDetectionLoop);
        APP_STATE.markerDetectionLoop = null;
    }
    
    setTimeout(() => {
        const exam = APP_STATE.currentExam;
        const debugCanvas = document.getElementById('debug-canvas');
        OMRProcessor.enableDebug(debugCanvas);
        
        const result = OMRProcessor.process(canvas, exam);
        
        OMRProcessor.disableDebug();
        showLoading(false);
        
        if (result.success) {
            APP_STATE.lastOMRResult = result;
            
            const booklet = result.booklet !== '?' ? result.booklet : (exam.booklets ? exam.booklets[0] : 'A');
            const answerKey = db.getAnswerKeyByExamAndBooklet(exam.id, booklet);
            
            if (!answerKey) {
                showToast('No answer key defined for this booklet. Results may need manual correction.', 'warning');
            }
            
            const scoring = calculateScore(result.answers, answerKey, exam);
            
            const fullResult = {
                ...result,
                ...scoring,
                booklet: booklet,
                examId: exam.id
            };
            
            showScanResult(fullResult);
        } else {
            showToast(result.error, 'error');
            startMarkerDetectionLoop(video);
        }
    }, 100);
}

function calculateScore(answers, answerKey, exam) {
    let correct = 0, wrong = 0, empty = 0;
    const answerKeyMap = answerKey && answerKey.answers ? answerKey.answers : {};
    
    for (let q = 1; q <= exam.questionCount; q++) {
        const studentAnswer = answers[q];
        const correctAnswer = answerKeyMap[q];
        
        if (!studentAnswer) {
            empty++;
        } else if (correctAnswer && studentAnswer === correctAnswer) {
            correct++;
        } else {
            wrong++;
        }
    }
    
    let net = correct;
    if (exam.wrongPenalty > 0) {
        net = correct - (wrong / exam.wrongPenalty);
    }
    net = Math.max(0, parseFloat(net.toFixed(2)));
    const score = parseFloat((net * exam.pointsPerQuestion).toFixed(2));
    
    return { correct, wrong, empty, net, score };
}

function showScanResult(result) {
    const exam = APP_STATE.currentExam;
    
    const studentCodeInput = document.getElementById('result-student-code');
    studentCodeInput.value = result.studentCode || '';
    
    const bookletSelect = document.getElementById('result-booklet');
    bookletSelect.innerHTML = (exam.booklets || ['A']).map(b =>
        `<option value="${b}" ${b === result.booklet ? 'selected' : ''}>${b}</option>`
    ).join('');
    
    document.getElementById('result-correct').textContent = result.correct;
    document.getElementById('result-wrong').textContent = result.wrong;
    document.getElementById('result-empty').textContent = result.empty;
    document.getElementById('result-net').textContent = result.net;
    document.getElementById('result-score').textContent = result.score;
    
    const flags = result.flags || {};
    const flaggedContainer = document.getElementById('flagged-questions');
    const flaggedList = document.getElementById('flagged-list');
    
    const flaggedItems = Object.entries(flags).filter(([q, flag]) => flag !== 'ok');
    
    if (flaggedItems.length > 0) {
        flaggedContainer.classList.remove('hidden');
        flaggedList.innerHTML = flaggedItems.map(([q, flag]) => {
            let typeClass = '', typeLabel = '';
            switch (flag) {
                case 'multi_mark':
                    typeClass = 'multi-mark';
                    typeLabel = 'Multiple Marks';
                    break;
                case 'low_confidence':
                    typeClass = 'low-confidence';
                    typeLabel = 'Low Confidence';
                    break;
                case 'empty':
                    typeClass = 'empty';
                    typeLabel = 'Empty';
                    break;
            }
            return `
                <div class="flag-item">
                    <span>Question ${q}: ${result.answers[q] || '-'}</span>
                    <span class="flag-type ${typeClass}">${typeLabel}</span>
                </div>
            `;
        }).join('');
    } else {
        flaggedContainer.classList.add('hidden');
    }
    
    APP_STATE.lastOMRResult = result;
    document.getElementById('scan-result').classList.remove('hidden');
    document.getElementById('optical-scanner-container').classList.add('hidden');
}

function toggleDebugPreview() {
    const container = document.getElementById('debug-preview-container');
    container.classList.toggle('hidden');
}

function saveResult() {
    const result = APP_STATE.lastOMRResult;
    if (!result) {
        showToast('No result to save', 'error');
        return;
    }
    
    const exam = APP_STATE.currentExam;
    
    const studentCode = document.getElementById('result-student-code').value.trim();
    const booklet = document.getElementById('result-booklet').value;
    
    if (!studentCode) {
        showToast('Enter student code', 'error');
        return;
    }
    
    const answerKey = db.getAnswerKeyByExamAndBooklet(exam.id, booklet);
    const scoring = calculateScore(result.answers, answerKey, exam);
    
    const saveData = {
        examId: exam.id,
        studentCode,
        booklet,
        answers: result.answers,
        correct: scoring.correct,
        wrong: scoring.wrong,
        empty: scoring.empty,
        net: scoring.net,
        score: scoring.score
    };
    
    db.saveResult(saveData);
    showToast('Result saved', 'success');
    document.getElementById('after-save-actions').classList.remove('hidden');
}

function continueWithCamera() {
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('debug-preview-container').classList.add('hidden');
    document.getElementById('flagged-questions').classList.add('hidden');
    document.getElementById('scan-mode-select').classList.add('hidden');
    document.getElementById('after-save-actions').classList.add('hidden');
    document.getElementById('optical-scanner-container').classList.remove('hidden');
    
    if (APP_STATE.videoStream) {
        const video = document.getElementById('optical-video');
        startMarkerDetectionLoop(video);
    } else {
        startCamera('optical-video');
    }
}

function continueWithFile() {
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('debug-preview-container').classList.add('hidden');
    document.getElementById('flagged-questions').classList.add('hidden');
    document.getElementById('after-save-actions').classList.add('hidden');
    
    if (APP_STATE.markerDetectionLoop) {
        cancelAnimationFrame(APP_STATE.markerDetectionLoop);
        APP_STATE.markerDetectionLoop = null;
    }
    if (APP_STATE.videoStream) {
        APP_STATE.videoStream.getTracks().forEach(track => track.stop());
        APP_STATE.videoStream = null;
    }
    document.getElementById('optical-scanner-container').classList.add('hidden');
    
    document.getElementById('scan-file-input').value = '';
    document.getElementById('scan-file-input').click();
}

function finishScanning() {
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('debug-preview-container').classList.add('hidden');
    document.getElementById('flagged-questions').classList.add('hidden');
    document.getElementById('after-save-actions').classList.add('hidden');
    
    if (APP_STATE.markerDetectionLoop) {
        cancelAnimationFrame(APP_STATE.markerDetectionLoop);
        APP_STATE.markerDetectionLoop = null;
    }
    if (APP_STATE.videoStream) {
        APP_STATE.videoStream.getTracks().forEach(track => track.stop());
        APP_STATE.videoStream = null;
    }
    document.getElementById('optical-scanner-container').classList.add('hidden');
    document.getElementById('scan-mode-select').classList.remove('hidden');
    
    showToast('Scanning completed', 'success');
    navigateTo('results');
}

function rescan() {
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('debug-preview-container').classList.add('hidden');
    document.getElementById('flagged-questions').classList.add('hidden');
    document.getElementById('scan-mode-select').classList.add('hidden');
    document.getElementById('optical-scanner-container').classList.remove('hidden');
    
    if (APP_STATE.videoStream) {
        const video = document.getElementById('optical-video');
        startMarkerDetectionLoop(video);
    } else {
        startCamera('optical-video');
    }
    
    showToast('Ready to rescan', 'info');
}

function populateResultsExamSelect() {
    const select = document.getElementById('results-exam-select');
    const exams = db.getExams();
    
    select.innerHTML = '<option value="">-- Select Exam --</option>' + 
        exams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    newSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            renderResults(e.target.value);
        }
    });
}

function renderResults(examId) {
    const exam = db.getExamById(examId);
    const results = db.getResultsByExam(examId);
    
    document.getElementById('no-results').style.display = results.length ? 'none' : 'block';
    document.getElementById('results-summary').classList.toggle('hidden', !results.length);
    document.getElementById('results-table-container').classList.toggle('hidden', !results.length);
    
    if (!results.length) return;
    
    const scores = results.map(r => r.score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    const maxScore = Math.max(...scores).toFixed(2);
    const minScore = Math.min(...scores).toFixed(2);
    
    document.getElementById('total-students').textContent = results.length;
    document.getElementById('avg-score').textContent = avgScore;
    document.getElementById('max-score').textContent = maxScore;
    document.getElementById('min-score').textContent = minScore;
    
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = results.map((r, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${r.studentCode}</td>
            <td>${r.booklet}</td>
            <td>${r.correct}</td>
            <td>${r.wrong}</td>
            <td>${r.empty}</td>
            <td>${r.net}</td>
            <td><strong>${r.score}</strong></td>
            <td>
                <button class="btn-icon-danger" onclick="deleteResult('${examId}', '${r.studentCode}')" title="Delete">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('export-csv').disabled = false;
    const exportJsonBtn = document.getElementById('export-json-results');
    if (exportJsonBtn) exportJsonBtn.disabled = false;
}

function deleteResult(examId, studentCode) {
    db.deleteResult(examId, studentCode);
    showToast('Result deleted', 'success');
    renderResults(examId);
}

document.getElementById('export-csv').addEventListener('click', function() {
    const examId = document.getElementById('results-exam-select').value;
    if (!examId) return;
    
    const results = db.getResultsByExam(examId);
    const exam = db.getExamById(examId);
    
    let csv = 'Exam,Student Code,Booklet,Correct,Wrong,Empty,Net,Score\n';
    results.forEach(r => {
        csv += `"${exam.name}","${r.studentCode}","${r.booklet}",${r.correct},${r.wrong},${r.empty},${r.net},${r.score}\n`;
    });
    
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `results-${exam.name.replace(/\s+/g, '-')}.csv`;
    link.click();
});

const exportJsonResultsBtn = document.getElementById('export-json-results');
if (exportJsonResultsBtn) {
    exportJsonResultsBtn.addEventListener('click', function() {
        const examId = document.getElementById('results-exam-select').value;
        if (!examId) return;
        
        const results = db.getResultsByExam(examId);
        const exam = db.getExamById(examId);
        
        const data = { exam: exam.name, results };
        const link = document.createElement('a');
        link.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data, null, 2));
        link.download = `results-${exam.name.replace(/\s+/g, '-')}.json`;
        link.click();
    });
}

function updateAccountPage() {
    const stats = db.getStatistics();
    
    const statExams = document.getElementById('stat-exams');
    const statResults = document.getElementById('stat-results');
    const statStorage = document.getElementById('stat-storage');
    
    if (statExams) statExams.textContent = stats.totalExams;
    if (statResults) statResults.textContent = stats.totalResults;
    if (statStorage) statStorage.textContent = stats.storageUsed;
}

function exportAllData() {
    const data = db.exportAllData();
    const link = document.createElement('a');
    link.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data, null, 2));
    link.download = `optical-exam-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast('Data downloaded', 'success');
}

function importDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        
        try {
            const data = JSON.parse(text);
            if (db.importData(data)) {
                showToast('Data imported successfully', 'success');
                updateAccountPage();
            } else {
                showToast('Import error', 'error');
            }
        } catch (err) {
            showToast('File could not be read: ' + err.message, 'error');
        }
    };
    
    input.click();
}

function clearAllData() {
    showModal(
        'Delete All Data',
        '<p style="color: var(--danger-color); font-weight: 600;">⚠️ ALL exams, answer keys and results will be permanently deleted!</p><p>This action cannot be undone.</p>',
        `
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="confirmClearAllData()">Delete All</button>
        `
    );
}

function confirmClearAllData() {
    localStorage.removeItem(db.examsKey);
    localStorage.removeItem(db.answerKeysKey);
    localStorage.removeItem(db.resultsKey);
    db.init();
    closeModal();
    showToast('All data deleted', 'success');
    navigateTo('home');
    updateAccountPage();
}

document.addEventListener('DOMContentLoaded', function() {
    db.init();
    navigateTo('home');
    const stats = db.getStatistics();
    console.log(`💾 Storage: ${stats.totalExams} exams, ${stats.totalResults} results`);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal');
        if (!modal.classList.contains('hidden')) {
            closeModal();
        }
    }
});
