const FormTemplate = (() => {

    const SHEET_WIDTH = 800;
    const SHEET_HEIGHT = 1130;

    const MARKER_SIZE = 34;
    const MARKER_SIZE_TL = 44;
    const MARKER_MARGIN = 15;

    const MARKERS = {
        topLeft:     { x: MARKER_MARGIN, y: MARKER_MARGIN, size: MARKER_SIZE_TL },
        topRight:    { x: SHEET_WIDTH - MARKER_MARGIN - MARKER_SIZE, y: MARKER_MARGIN, size: MARKER_SIZE },
        bottomLeft:  { x: MARKER_MARGIN, y: SHEET_HEIGHT - MARKER_MARGIN - MARKER_SIZE, size: MARKER_SIZE },
        bottomRight: { x: SHEET_WIDTH - MARKER_MARGIN - MARKER_SIZE, y: SHEET_HEIGHT - MARKER_MARGIN - MARKER_SIZE, size: MARKER_SIZE }
    };

    const MARKER_CENTERS = {
        topLeft:     { x: MARKERS.topLeft.x + MARKERS.topLeft.size / 2, y: MARKERS.topLeft.y + MARKERS.topLeft.size / 2 },
        topRight:    { x: MARKERS.topRight.x + MARKERS.topRight.size / 2, y: MARKERS.topRight.y + MARKERS.topRight.size / 2 },
        bottomLeft:  { x: MARKERS.bottomLeft.x + MARKERS.bottomLeft.size / 2, y: MARKERS.bottomLeft.y + MARKERS.bottomLeft.size / 2 },
        bottomRight: { x: MARKERS.bottomRight.x + MARKERS.bottomRight.size / 2, y: MARKERS.bottomRight.y + MARKERS.bottomRight.size / 2 }
    };

    const HEADER_LINE_Y = 82;
    const DIVIDER_X = 378;
    const LEFT_X = 70;
    const LEFT_W = DIVIDER_X - LEFT_X - 10;

    const BOOKLET = {
        startX: 95,
        startY: 108,
        cellW: 34,
        cellH: 30,
        gapX: 12,
        bubbleR: 12,
        options: ['A', 'B', 'C', 'D']
    };

    const STUDENT_NUM = {
        startX: 78,
        startY: 240,
        digitCount: 10,
        cellW: 26,
        cellH: 24,
        gapX: 3,
        gapY: 3,
        bubbleR: 9,
        digits: 10
    };

    const ANSWER_GRID_CONFIG = {
        startX: 400,
        startY: 118,
        cellW: 26,
        cellH: 32,
        gapX: 4,
        gapY: 4,
        bubbleR: 11,
        questionsPerColumn: 25,
        columnGap: 20,
        qNumWidth: 30
    };

    function getStudentNumberGrid() {
        const grid = [];
        const s = STUDENT_NUM;
        for (let col = 0; col < s.digitCount; col++) {
            for (let row = 0; row < s.digits; row++) {
                const x = s.startX + col * (s.cellW + s.gapX);
                const y = s.startY + row * (s.cellH + s.gapY);
                grid.push({
                    digitIndex: col,
                    digitValue: row,
                    cx: x + s.cellW / 2,
                    cy: y + s.cellH / 2,
                    x: x,
                    y: y,
                    w: s.cellW,
                    h: s.cellH
                });
            }
        }
        return grid;
    }

    function getBookletGrid() {
        const grid = [];
        const b = BOOKLET;
        for (let i = 0; i < b.options.length; i++) {
            const x = b.startX + i * (b.cellW + b.gapX);
            const y = b.startY;
            grid.push({
                option: b.options[i],
                cx: x + b.cellW / 2,
                cy: y + b.cellH / 2,
                x: x,
                y: y,
                w: b.cellW,
                h: b.cellH
            });
        }
        return grid;
    }

    function getAnswerGrid(questionCount, optionCount) {
        const grid = [];
        const a = ANSWER_GRID_CONFIG;
        const optionLetters = 'ABCDE'.substring(0, optionCount);
        const qPerCol = a.questionsPerColumn;

        for (let q = 1; q <= questionCount; q++) {
            const colIndex = Math.floor((q - 1) / qPerCol);
            const rowIndex = (q - 1) % qPerCol;
            const colBaseX = a.startX + colIndex * (a.qNumWidth + optionCount * (a.cellW + a.gapX) + a.columnGap);

            for (let opt = 0; opt < optionCount; opt++) {
                const x = colBaseX + a.qNumWidth + opt * (a.cellW + a.gapX);
                const y = a.startY + rowIndex * (a.cellH + a.gapY);

                grid.push({
                    question: q,
                    option: opt,
                    optionLetter: optionLetters[opt],
                    cx: x + a.cellW / 2,
                    cy: y + a.cellH / 2,
                    x: x,
                    y: y,
                    w: a.cellW,
                    h: a.cellH
                });
            }
        }
        return grid;
    }

    function getQuestionLabelPositions(questionCount, optionCount) {
        const labels = [];
        const a = ANSWER_GRID_CONFIG;
        const qPerCol = a.questionsPerColumn;

        for (let q = 1; q <= questionCount; q++) {
            const colIndex = Math.floor((q - 1) / qPerCol);
            const rowIndex = (q - 1) % qPerCol;
            const colBaseX = a.startX + colIndex * (a.qNumWidth + optionCount * (a.cellW + a.gapX) + a.columnGap);
            const y = a.startY + rowIndex * (a.cellH + a.gapY);

            labels.push({
                question: q,
                x: colBaseX,
                y: y,
                cy: y + a.cellH / 2
            });
        }
        return labels;
    }

    function getAllROIs(questionCount, optionCount) {
        return {
            studentNumber: getStudentNumberGrid(),
            booklet: getBookletGrid(),
            answers: getAnswerGrid(questionCount, optionCount),
            labels: getQuestionLabelPositions(questionCount, optionCount)
        };
    }

    function drawSheet(canvas, exam, bookletType, answerKey) {
        canvas.width = SHEET_WIDTH;
        canvas.height = SHEET_HEIGHT;
        const ctx = canvas.getContext('2d');

        const optionCount = exam.optionCount || 5;
        const questionCount = exam.questionCount || 20;
        const optionLetters = 'ABCDE'.substring(0, optionCount);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(5, 5, SHEET_WIDTH - 10, SHEET_HEIGHT - 10);
        ctx.setLineDash([]);

        ctx.fillStyle = '#000000';
        Object.values(MARKERS).forEach(m => {
            ctx.fillRect(m.x, m.y, m.size, m.size);
        });

        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(exam.name || 'Exam', SHEET_WIDTH / 2, 50);

        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#333';
        const subtitleParts = [];
        if (bookletType) subtitleParts.push(bookletType + ' Booklet');
        subtitleParts.push(questionCount + ' Questions');
        subtitleParts.push(optionCount + ' Options');
        ctx.fillText(subtitleParts.join('  •  '), SHEET_WIDTH / 2, 68);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(MARKER_MARGIN + MARKER_SIZE_TL + 5, HEADER_LINE_Y);
        ctx.lineTo(SHEET_WIDTH - MARKER_MARGIN - MARKER_SIZE - 5, HEADER_LINE_Y);
        ctx.stroke();

        ctx.strokeStyle = '#BBB';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(DIVIDER_X, HEADER_LINE_Y + 4);
        ctx.lineTo(DIVIDER_X, SHEET_HEIGHT - MARKER_MARGIN - MARKER_SIZE - 5);
        ctx.stroke();

        drawLeftPanel(ctx, bookletType);
        drawRightPanel(ctx, questionCount, optionCount, optionLetters, answerKey);

        ctx.fillStyle = '#999';
        ctx.font = '8px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('This form will be scanned by an optical reader. Please fill in with a pencil.', SHEET_WIDTH / 2, SHEET_HEIGHT - 8);
    }

    function drawLeftPanel(ctx, bookletType) {
        const bkY = HEADER_LINE_Y + 8;
        drawSectionLabel(ctx, LEFT_X, bkY + 10, 'Booklet');

        const bookletGrid = getBookletGrid();
        bookletGrid.forEach(b => {
            drawBubble(ctx, b.cx, b.cy, BOOKLET.bubbleR, b.option, b.option === bookletType);
        });

        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_X, bkY + 52);
        ctx.lineTo(DIVIDER_X - 15, bkY + 52);
        ctx.stroke();

        const snY = bkY + 62;
        drawSectionLabel(ctx, LEFT_X, snY + 10, 'Student ID (10 Digits)');

        const s = STUDENT_NUM;
        const gridEndX = s.startX + s.digitCount * (s.cellW + s.gapX) - s.gapX;
        const gridEndY = s.startY + s.digits * (s.cellH + s.gapY) - s.gapY;

        const instrY = s.startY - 50;
        ctx.fillStyle = '#F0F0F0';
        const instrBoxW = gridEndX - s.startX + 6;
        ctx.fillRect(s.startX - 3, instrY, instrBoxW, 16);
        ctx.strokeStyle = '#AAA';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(s.startX - 3, instrY, instrBoxW, 16);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2193  Mark the correct digit in each column  \u2193', s.startX + instrBoxW / 2 - 3, instrY + 11);

        const writeBoxY = s.startY - 28;
        const writeBoxH = 16;
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.8;
        for (let col = 0; col < s.digitCount; col++) {
            const x = s.startX + col * (s.cellW + s.gapX);
            ctx.strokeRect(x, writeBoxY, s.cellW, writeBoxH);
        }

        for (let row = 0; row < s.digits; row++) {
            const y = s.startY + row * (s.cellH + s.gapY);
            const cy = y + s.cellH / 2;

            if (row % 2 === 0) {
                ctx.fillStyle = '#F6F6F6';
                ctx.fillRect(s.startX - 3, y - 1, gridEndX - s.startX + 6, s.cellH + 2);
            }

            ctx.fillStyle = '#555';
            ctx.font = 'bold 9px Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(row), s.startX - 6, cy);
            ctx.textBaseline = 'alphabetic';
        }

        const studentGrid = getStudentNumberGrid();
        studentGrid.forEach(b => {
            drawBubble(ctx, b.cx, b.cy, s.bubbleR, String(b.digitValue), false);
        });

        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 0.4;
        for (let col = 1; col < s.digitCount; col++) {
            const x = s.startX + col * (s.cellW + s.gapX) - s.gapX / 2;
            ctx.beginPath();
            ctx.moveTo(x, writeBoxY);
            ctx.lineTo(x, gridEndY + 2);
            ctx.stroke();
        }

        ctx.strokeStyle = '#BBB';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(s.startX - 3, writeBoxY, gridEndX - s.startX + 6, gridEndY - writeBoxY + 3);

        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_X, gridEndY + 12);
        ctx.lineTo(DIVIDER_X - 15, gridEndY + 12);
        ctx.stroke();

        const exY = gridEndY + 26;

        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Correct Marking:', LEFT_X + 10, exY);
        drawBubble(ctx, LEFT_X + 160, exY - 4, 10, '', true);

        ctx.fillText('Wrong Marking:', LEFT_X + 10, exY + 24);
        ctx.beginPath();
        ctx.arc(LEFT_X + 160, exY + 20, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#AAA';
        ctx.beginPath();
        ctx.arc(LEFT_X + 160, exY + 20, 4, 0, Math.PI * 2);
        ctx.fill();

        const infoY = exY + 54;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'left';

        ctx.fillText('Full Name:', LEFT_X + 10, infoY);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_X + 70, infoY + 2);
        ctx.lineTo(DIVIDER_X - 20, infoY + 2);
        ctx.stroke();

        ctx.fillText('Signature:', LEFT_X + 10, infoY + 28);
        ctx.beginPath();
        ctx.moveTo(LEFT_X + 45, infoY + 30);
        ctx.lineTo(DIVIDER_X - 20, infoY + 30);
        ctx.stroke();
    }

    function drawRightPanel(ctx, questionCount, optionCount, optionLetters, answerKey) {
        const a = ANSWER_GRID_CONFIG;
        const colCount = Math.ceil(questionCount / a.questionsPerColumn);

        const answerGrid = getAnswerGrid(questionCount, optionCount);
        const labels = getQuestionLabelPositions(questionCount, optionCount);

        drawSectionLabel(ctx, DIVIDER_X + 12, HEADER_LINE_Y + 18, 'Answers');

        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'center';

        for (let c = 0; c < colCount; c++) {
            const firstQ = c * a.questionsPerColumn + 1;
            const firstInCol = answerGrid.filter(b => b.question === firstQ);
            if (firstInCol.length > 0) {
                for (let opt = 0; opt < optionCount; opt++) {
                    ctx.fillText(optionLetters[opt], firstInCol[opt].cx, firstInCol[opt].y - 7);
                }
            }
        }

        for (let q = 1; q <= questionCount; q++) {
            if (q % 2 === 0) {
                const rowIndex = (q - 1) % a.questionsPerColumn;
                const colIndex = Math.floor((q - 1) / a.questionsPerColumn);
                const colBaseX = a.startX + colIndex * (a.qNumWidth + optionCount * (a.cellW + a.gapX) + a.columnGap);
                const y = a.startY + rowIndex * (a.cellH + a.gapY);
                const rowW = a.qNumWidth + optionCount * (a.cellW + a.gapX);

                ctx.fillStyle = '#F5F5F5';
                ctx.fillRect(colBaseX - 2, y - 2, rowW + 4, a.cellH + 4);
            }
        }

        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'right';
        labels.forEach(l => {
            ctx.fillStyle = '#000';
            ctx.fillText(l.question + '.', l.x + a.qNumWidth - 6, l.cy + 4);
        });

        const answers = answerKey && answerKey.answers ? answerKey.answers : {};
        answerGrid.forEach(b => {
            const isCorrectAnswer = answers[String(b.question)] === b.optionLetter
                                 || answers[b.question] === b.optionLetter;
            drawBubble(ctx, b.cx, b.cy, a.bubbleR, '', isCorrectAnswer);
        });

        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 0.5;
        for (let c = 0; c < colCount; c++) {
            const colBaseX = a.startX + c * (a.qNumWidth + optionCount * (a.cellW + a.gapX) + a.columnGap);
            const rowW = a.qNumWidth + optionCount * (a.cellW + a.gapX);
            const qInThisCol = Math.min(a.questionsPerColumn, questionCount - c * a.questionsPerColumn);

            for (let row = 5; row < qInThisCol; row += 5) {
                const y = a.startY + row * (a.cellH + a.gapY) - a.gapY / 2;
                ctx.beginPath();
                ctx.moveTo(colBaseX, y);
                ctx.lineTo(colBaseX + rowW, y);
                ctx.stroke();
            }
        }
    }

    function drawSectionLabel(ctx, x, y, text) {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, x, y);
    }

    function drawBubble(ctx, cx, cy, r, label, filled) {
        if (filled) {
            ctx.beginPath();
            ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#000000';
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (label) {
                ctx.fillStyle = '#666';
                ctx.font = Math.max(8, r - 2) + 'px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, cx, cy);
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    return {
        SHEET_WIDTH,
        SHEET_HEIGHT,
        MARKERS,
        MARKER_CENTERS,
        MARKER_SIZE,
        MARKER_SIZE_TL,
        MARKER_MARGIN,
        STUDENT_NUM,
        BOOKLET,
        ANSWER_GRID_CONFIG,
        getStudentNumberGrid,
        getBookletGrid,
        getAnswerGrid,
        getQuestionLabelPositions,
        getAllROIs,
        drawSheet,
        drawBubble
    };

})();
