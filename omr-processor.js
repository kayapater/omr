const OMRProcessor = (() => {

    let _ready = false;
    let _debugMode = false;
    let _debugCanvas = null;
    function isReady() {
        return _ready && typeof cv !== 'undefined' && cv.Mat;
    }

    function setReady(val) {
        _ready = val;
    }

    function enableDebug(canvas) {
        _debugMode = true;
        _debugCanvas = canvas;
    }

    function disableDebug() {
        _debugMode = false;
        _debugCanvas = null;
    }

    function process(source, exam) {
        if (!isReady()) {
            return { success: false, error: 'OpenCV not loaded yet' };
        }

        const mats = [];

        try {
            console.time('OMR Pipeline');

            let src;
            if (source instanceof HTMLCanvasElement) {
                src = cv.imread(source);
            } else if (source instanceof HTMLVideoElement) {
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = source.videoWidth;
                tmpCanvas.height = source.videoHeight;
                const tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.drawImage(source, 0, 0);
                src = cv.imread(tmpCanvas);
            } else {
                src = cv.imread(source);
            }
            mats.push(src);

            const { gray, thresh } = preprocess(src);
            mats.push(gray, thresh);

            let markers = findMarkers(thresh, src.cols, src.rows);
            
            if (!markers) {
                console.log('Markers not found with adaptive threshold, trying Otsu...');
                const otsuThresh = new cv.Mat();
                mats.push(otsuThresh);
                cv.threshold(gray, otsuThresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
                markers = findMarkers(otsuThresh, src.cols, src.rows);
            }
            
            if (!markers) {
                console.log('Not found with Otsu either, trying adaptive with different parameters...');
                const altThresh = new cv.Mat();
                const altBlurred = new cv.Mat();
                mats.push(altThresh, altBlurred);
                cv.GaussianBlur(gray, altBlurred, new cv.Size(3, 3), 0);
                cv.adaptiveThreshold(
                    altBlurred, altThresh, 255,
                    cv.ADAPTIVE_THRESH_MEAN_C,
                    cv.THRESH_BINARY_INV,
                    31, 10
                );
                markers = findMarkers(altThresh, src.cols, src.rows);
            }
            
            if (!markers) {
                return {
                    success: false,
                    error: 'Corner markers not found. Place the form on a flat surface and make sure the black squares at all 4 corners are visible.'
                };
            }

            const warped = warpPerspective(gray, markers);
            mats.push(warped);

            const warpedThresh = new cv.Mat();
            mats.push(warpedThresh);
            cv.adaptiveThreshold(
                warped, warpedThresh, 255,
                cv.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv.THRESH_BINARY_INV,
                15, 4
            );

            const rois = FormTemplate.getAllROIs(exam.questionCount, exam.optionCount);
            
            const studentCode = readStudentNumber(warpedThresh, rois.studentNumber);
            const booklet = readBooklet(warpedThresh, rois.booklet);
            const { answers, flags, confidences } = readAnswers(warpedThresh, rois.answers, exam.questionCount, exam.optionCount);

            if (_debugMode && _debugCanvas) {
                drawDebugOverlay(warped, warpedThresh, rois, answers, exam);
            }

            console.timeEnd('OMR Pipeline');

            return {
                success: true,
                studentCode,
                booklet,
                answers,
                flags,
                confidences,
                markerCount: 4
            };

        } catch (err) {
            console.error('OMR Processing Error:', err);
            return {
                success: false,
                error: 'Image processing error: ' + err.message
            };
        } finally {
            mats.forEach(m => {
                try { m.delete(); } catch (e) {}
            });
        }
    }

    function preprocess(src) {
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const thresh = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.adaptiveThreshold(
            blurred, thresh, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY_INV,
            21, 5
        );

        blurred.delete();
        return { gray, thresh };
    }

    function findMarkers(thresh, imgWidth, imgHeight) {
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();

        cv.findContours(thresh, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        const candidates = [];

        const imgArea = imgWidth * imgHeight;
        const minArea = imgArea * 0.0005;
        const maxArea = imgArea * 0.02;

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area < minArea || area > maxArea) continue;

            const rect = cv.boundingRect(contour);
            const aspectRatio = rect.width / rect.height;

            if (aspectRatio < 0.6 || aspectRatio > 1.6) continue;

            const hull = new cv.Mat();
            cv.convexHull(contour, hull);
            const hullContour = new cv.MatVector();
            hullContour.push_back(hull);
            const hullArea = cv.contourArea(hull);
            const solidity = area / hullArea;
            hull.delete();
            hullContour.delete();

            if (solidity < 0.8) continue;

            const peri = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.04 * peri, true);

            const vertices = approx.rows;
            approx.delete();

            if (vertices < 4 || vertices > 8) continue;

            const rectArea = rect.width * rect.height;
            const fillDensity = area / rectArea;
            if (fillDensity < 0.7) continue;

            const moments = cv.moments(contour);
            if (moments.m00 === 0) continue;
            const cx = moments.m10 / moments.m00;
            const cy = moments.m01 / moments.m00;

            candidates.push({
                cx, cy,
                area,
                rect,
                width: rect.width,
                height: rect.height
            });
        }

        contours.delete();
        hierarchy.delete();

        console.log(`Marker tespiti: ${candidates.length} aday bulundu (minArea=${minArea.toFixed(0)}, maxArea=${maxArea.toFixed(0)}, imgSize=${imgWidth}x${imgHeight})`);
        candidates.forEach((c, i) => {
            console.log(`  Aday ${i}: pos=(${c.cx.toFixed(0)},${c.cy.toFixed(0)}) area=${c.area.toFixed(0)} size=${c.width}x${c.height}`);
        });

        if (candidates.length < 4) {
            console.warn(`Only ${candidates.length} marker candidates found (4 required)`);
            return null;
        }

        const midX = imgWidth / 2;
        const midY = imgHeight / 2;

        const quadrants = {
            topLeft: null,
            topRight: null,
            bottomLeft: null,
            bottomRight: null
        };

        candidates.forEach(c => {
            if (c.cx < midX && c.cy < midY) {
                if (!quadrants.topLeft || distToCorner(c, 0, 0) < distToCorner(quadrants.topLeft, 0, 0)) {
                    quadrants.topLeft = c;
                }
            }
            if (c.cx > midX && c.cy < midY) {
                if (!quadrants.topRight || distToCorner(c, imgWidth, 0) < distToCorner(quadrants.topRight, imgWidth, 0)) {
                    quadrants.topRight = c;
                }
            }
            if (c.cx < midX && c.cy > midY) {
                if (!quadrants.bottomLeft || distToCorner(c, 0, imgHeight) < distToCorner(quadrants.bottomLeft, 0, imgHeight)) {
                    quadrants.bottomLeft = c;
                }
            }
            if (c.cx > midX && c.cy > midY) {
                if (!quadrants.bottomRight || distToCorner(c, imgWidth, imgHeight) < distToCorner(quadrants.bottomRight, imgWidth, imgHeight)) {
                    quadrants.bottomRight = c;
                }
            }
        });

        if (!quadrants.topLeft || !quadrants.topRight || !quadrants.bottomLeft || !quadrants.bottomRight) {
            console.warn('Not all corners found:', Object.entries(quadrants).filter(([k, v]) => !v).map(([k]) => k));
            return null;
        }

        const areas = [
            { key: 'topLeft', area: quadrants.topLeft.area },
            { key: 'topRight', area: quadrants.topRight.area },
            { key: 'bottomLeft', area: quadrants.bottomLeft.area },
            { key: 'bottomRight', area: quadrants.bottomRight.area }
        ];
        areas.sort((a, b) => b.area - a.area);

        if (areas[0].key !== 'topLeft') {
            console.warn(`Orientation warning: Largest marker is at ${areas[0].key}, expected topLeft`);
        }

        return quadrants;
    }

    function distToCorner(candidate, cornerX, cornerY) {
        return Math.sqrt(
            Math.pow(candidate.cx - cornerX, 2) +
            Math.pow(candidate.cy - cornerY, 2)
        );
    }

    function warpPerspective(gray, markers) {
        const targetW = FormTemplate.SHEET_WIDTH;
        const targetH = FormTemplate.SHEET_HEIGHT;

        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            markers.topLeft.cx, markers.topLeft.cy,
            markers.topRight.cx, markers.topRight.cy,
            markers.bottomRight.cx, markers.bottomRight.cy,
            markers.bottomLeft.cx, markers.bottomLeft.cy
        ]);

        const mc = FormTemplate.MARKER_CENTERS;
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            mc.topLeft.x, mc.topLeft.y,
            mc.topRight.x, mc.topRight.y,
            mc.bottomRight.x, mc.bottomRight.y,
            mc.bottomLeft.x, mc.bottomLeft.y
        ]);

        const M = cv.getPerspectiveTransform(srcPts, dstPts);
        const warped = new cv.Mat();
        cv.warpPerspective(gray, warped, M, new cv.Size(targetW, targetH));

        srcPts.delete();
        dstPts.delete();
        M.delete();

        return warped;
    }

    function getFillRatio(threshMat, x, y, w, h) {
        const safeX = Math.max(0, Math.min(Math.round(x), threshMat.cols - 1));
        const safeY = Math.max(0, Math.min(Math.round(y), threshMat.rows - 1));
        const safeW = Math.min(Math.round(w), threshMat.cols - safeX);
        const safeH = Math.min(Math.round(h), threshMat.rows - safeY);

        if (safeW <= 0 || safeH <= 0) return 0;

        const roi = threshMat.roi(new cv.Rect(safeX, safeY, safeW, safeH));
        const nonZero = cv.countNonZero(roi);
        const total = safeW * safeH;
        roi.delete();

        return nonZero / total;
    }

    function readStudentNumber(threshMat, studentGrid) {
        const s = FormTemplate.STUDENT_NUM;
        const digits = [];

        for (let col = 0; col < s.digitCount; col++) {
            const columnBubbles = studentGrid.filter(b => b.digitIndex === col);
            
            let maxFill = 0;
            let maxDigit = -1;

            columnBubbles.forEach(b => {
                const inset = 3;
                const fill = getFillRatio(threshMat, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
                
                if (fill > maxFill) {
                    maxFill = fill;
                    maxDigit = b.digitValue;
                }
            });

            if (maxFill > 0.38) {
                digits.push(String(maxDigit));
            } else {
                digits.push('_');
            }
        }

        return digits.join('');
    }

    function readBooklet(threshMat, bookletGrid) {
        let maxFill = 0;
        let selected = null;

        bookletGrid.forEach(b => {
            const inset = 3;
            const fill = getFillRatio(threshMat, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
            
            if (fill > maxFill) {
                maxFill = fill;
                selected = b.option;
            }
        });

        if (maxFill < 0.38) {
            return '?';
        }

        return selected;
    }

    function readAnswers(threshMat, answerGrid, questionCount, optionCount) {
        const answers = {};
        const flags = {};
        const confidences = {};
        const optionLetters = 'ABCDE'.substring(0, optionCount);

        for (let q = 1; q <= questionCount; q++) {
            const questionBubbles = answerGrid.filter(b => b.question === q);
            const fillRatios = [];

            questionBubbles.forEach(b => {
                const inset = 3;
                const fill = getFillRatio(threshMat, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
                fillRatios.push({
                    option: b.optionLetter,
                    fill: fill
                });
            });

            fillRatios.sort((a, b) => b.fill - a.fill);

            const maxFill = fillRatios[0].fill;
            const secondFill = fillRatios.length > 1 ? fillRatios[1].fill : 0;

            const FILL_THRESHOLD = 0.38;
            const MULTI_MARK_THRESHOLD = 0.35;

            if (maxFill < FILL_THRESHOLD) {
                answers[q] = null;
                flags[q] = 'empty';
                confidences[q] = 0;
            } else if (secondFill > MULTI_MARK_THRESHOLD && (maxFill / secondFill) < 1.5) {
                answers[q] = fillRatios[0].option;
                flags[q] = 'multi_mark';
                confidences[q] = maxFill / Math.max(secondFill, 0.01);
            } else {
                answers[q] = fillRatios[0].option;
                const confidence = maxFill / Math.max(secondFill, 0.01);
                confidences[q] = confidence;

                if (confidence < 2.0) {
                    flags[q] = 'low_confidence';
                } else {
                    flags[q] = 'ok';
                }
            }
        }

        return { answers, flags, confidences };
    }

    function drawDebugOverlay(warped, warpedThresh, rois, answers, exam) {
        if (!_debugCanvas) return;

        _debugCanvas.width = FormTemplate.SHEET_WIDTH;
        _debugCanvas.height = FormTemplate.SHEET_HEIGHT;

        const debugMat = new cv.Mat();
        cv.cvtColor(warped, debugMat, cv.COLOR_GRAY2RGBA);
        cv.imshow(_debugCanvas, debugMat);
        debugMat.delete();

        const ctx = _debugCanvas.getContext('2d');

        rois.answers.forEach(b => {
            const answer = answers[b.question];
            if (answer === b.optionLetter) {
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x, b.y, b.w, b.h);
            }
        });

        ctx.strokeStyle = '#0088FF';
        ctx.lineWidth = 1;
        rois.studentNumber.forEach(b => {
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        ctx.strokeStyle = '#FF8800';
        ctx.lineWidth = 1;
        rois.booklet.forEach(b => {
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });
    }

    function detectMarkersOnly(source) {
        if (!isReady()) return null;

        const mats = [];
        try {
            let src;
            if (source instanceof HTMLCanvasElement) {
                src = cv.imread(source);
            } else if (source instanceof HTMLVideoElement) {
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = source.videoWidth || 640;
                tmpCanvas.height = source.videoHeight || 480;
                const tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.drawImage(source, 0, 0);
                src = cv.imread(tmpCanvas);
            } else {
                return null;
            }
            mats.push(src);

            const gray = new cv.Mat();
            const blurred = new cv.Mat();
            const thresh = new cv.Mat();
            mats.push(gray, blurred, thresh);

            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

            return findMarkers(thresh, src.cols, src.rows);
        } catch (e) {
            return null;
        } finally {
            mats.forEach(m => {
                try { m.delete(); } catch (e) {}
            });
        }
    }

    function testWithSyntheticImage(exam, knownAnswers) {
        if (!isReady()) {
            console.error('OpenCV not loaded, cannot run test');
            return null;
        }

        const testCanvas = document.createElement('canvas');
        FormTemplate.drawSheet(testCanvas, exam, 'A', { answers: knownAnswers });

        const ctx = testCanvas.getContext('2d');
        const answerGrid = FormTemplate.getAnswerGrid(exam.questionCount, exam.optionCount);

        Object.entries(knownAnswers).forEach(([q, answer]) => {
            const bubble = answerGrid.find(b => b.question === parseInt(q) && b.optionLetter === answer);
            if (bubble) {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(bubble.cx, bubble.cy, FormTemplate.ANSWER_GRID_CONFIG.bubbleR, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        const result = process(testCanvas, exam);

        if (result.success) {
            let correct = 0;
            let total = Object.keys(knownAnswers).length;
            Object.entries(knownAnswers).forEach(([q, answer]) => {
                if (result.answers[q] === answer) correct++;
            });
            console.log(`Synthetic Test: ${correct}/${total} correct (${(correct / total * 100).toFixed(1)}%)`);
        } else {
            console.error('Synthetic test failed:', result.error);
        }

        return result;
    }

    return {
        isReady,
        setReady,
        process,
        detectMarkersOnly,
        enableDebug,
        disableDebug,
        testWithSyntheticImage,
        _preprocess: preprocess,
        _findMarkers: findMarkers,
        _warpPerspective: warpPerspective,
        _getFillRatio: getFillRatio
    };

})();
