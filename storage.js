class DataStore {
    constructor() {
        this.storageKey = 'optik_sinav_';
        this.examsKey = this.storageKey + 'exams';
        this.answerKeysKey = this.storageKey + 'answerkeys';
        this.resultsKey = this.storageKey + 'results';
        this.settingsKey = this.storageKey + 'settings';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.examsKey)) {
            localStorage.setItem(this.examsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.answerKeysKey)) {
            localStorage.setItem(this.answerKeysKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.resultsKey)) {
            localStorage.setItem(this.resultsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.settingsKey)) {
            localStorage.setItem(this.settingsKey, JSON.stringify({
                appVersion: '1.0',
                createdAt: Date.now()
            }));
        }
    }

    getExams() {
        try {
            return JSON.parse(localStorage.getItem(this.examsKey)) || [];
        } catch (e) {
            console.error('Error loading exams:', e);
            return [];
        }
    }

    getExamById(examId) {
        const exams = this.getExams();
        return exams.find(e => e.id === examId);
    }

    saveExam(exam) {
        const exams = this.getExams();
        const existing = exams.findIndex(e => e.id === exam.id);
        
        if (existing >= 0) {
            exams[existing] = { ...exams[existing], ...exam, updatedAt: Date.now() };
        } else {
            exam.id = 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            exam.createdAt = Date.now();
            exams.push(exam);
        }
        
        localStorage.setItem(this.examsKey, JSON.stringify(exams));
        return exam;
    }

    deleteExam(examId) {
        const exams = this.getExams();
        const filtered = exams.filter(e => e.id !== examId);
        localStorage.setItem(this.examsKey, JSON.stringify(filtered));
        
        // Delete related answer keys and results
        this.deleteAnswerKeysByExam(examId);
        this.deleteResultsByExam(examId);
    }

    getAnswerKeys() {
        try {
            return JSON.parse(localStorage.getItem(this.answerKeysKey)) || [];
        } catch (e) {
            console.error('Error loading answer keys:', e);
            return [];
        }
    }

    getAnswerKeyByExamAndBooklet(examId, booklet) {
        const keys = this.getAnswerKeys();
        return keys.find(k => k.examId === examId && k.booklet === booklet);
    }

    saveAnswerKey(examId, booklet, answers) {
        const keys = this.getAnswerKeys();
        const existing = keys.findIndex(k => k.examId === examId && k.booklet === booklet);
        
        const newKey = {
            examId,
            booklet,
            answers,
            updatedAt: Date.now()
        };
        
        if (existing >= 0) {
            keys[existing] = newKey;
        } else {
            keys.push(newKey);
        }
        
        localStorage.setItem(this.answerKeysKey, JSON.stringify(keys));
    }

    deleteAnswerKeysByExam(examId) {
        const keys = this.getAnswerKeys();
        const filtered = keys.filter(k => k.examId !== examId);
        localStorage.setItem(this.answerKeysKey, JSON.stringify(filtered));
    }

    getResults() {
        try {
            return JSON.parse(localStorage.getItem(this.resultsKey)) || [];
        } catch (e) {
            console.error('Error loading results:', e);
            return [];
        }
    }

    getResultsByExam(examId) {
        const results = this.getResults();
        return results.filter(r => r.examId === examId).sort((a, b) => b.timestamp - a.timestamp);
    }

    getResultByExamAndStudent(examId, studentCode) {
        const results = this.getResults();
        return results.find(r => r.examId === examId && r.studentCode === studentCode);
    }

    saveResult(result) {
        const results = this.getResults();
        const existing = results.findIndex(r => 
            r.examId === result.examId && r.studentCode === result.studentCode
        );
        
        if (existing >= 0) {
            results[existing] = { ...result, timestamp: Date.now() };
        } else {
            result.id = 'result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            result.timestamp = Date.now();
            results.push(result);
        }
        
        localStorage.setItem(this.resultsKey, JSON.stringify(results));
        return result;
    }

    deleteResult(examId, studentCode) {
        const results = this.getResults();
        const filtered = results.filter(r => !(r.examId === examId && r.studentCode === studentCode));
        localStorage.setItem(this.resultsKey, JSON.stringify(filtered));
    }

    deleteResultsByExam(examId) {
        const results = this.getResults();
        const filtered = results.filter(r => r.examId !== examId);
        localStorage.setItem(this.resultsKey, JSON.stringify(filtered));
    }

    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.settingsKey)) || {};
        } catch (e) {
            return {};
        }
    }

    updateSettings(settings) {
        const current = this.getSettings();
        const updated = { ...current, ...settings, updatedAt: Date.now() };
        localStorage.setItem(this.settingsKey, JSON.stringify(updated));
        return updated;
    }

    exportAllData() {
        return {
            exams: this.getExams(),
            answerKeys: this.getAnswerKeys(),
            results: this.getResults(),
            settings: this.getSettings(),
            exportedAt: new Date().toISOString()
        };
    }

    importData(data) {
        try {
            if (data.exams && Array.isArray(data.exams)) {
                const exams = this.getExams();
                data.exams.forEach(e => {
                    if (!exams.find(x => x.id === e.id)) {
                        exams.push(e);
                    }
                });
                localStorage.setItem(this.examsKey, JSON.stringify(exams));
            }

            if (data.answerKeys && Array.isArray(data.answerKeys)) {
                const keys = this.getAnswerKeys();
                data.answerKeys.forEach(k => {
                    if (!keys.find(x => x.examId === k.examId && x.booklet === k.booklet)) {
                        keys.push(k);
                    }
                });
                localStorage.setItem(this.answerKeysKey, JSON.stringify(keys));
            }

            if (data.results && Array.isArray(data.results)) {
                const results = this.getResults();
                data.results.forEach(r => {
                    if (!results.find(x => x.id === r.id)) {
                        results.push(r);
                    }
                });
                localStorage.setItem(this.resultsKey, JSON.stringify(results));
            }

            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    clearAllData() {
        if (confirm('ALL DATA WILL BE DELETED! Do you want to continue?')) {
            localStorage.removeItem(this.examsKey);
            localStorage.removeItem(this.answerKeysKey);
            localStorage.removeItem(this.resultsKey);
            this.init();
            return true;
        }
        return false;
    }

    getStatistics() {
        const exams = this.getExams();
        const results = this.getResults();

        return {
            totalExams: exams.length,
            totalResults: results.length,
            storageUsed: this.getStorageUsed(),
            lastUpdate: results[0]?.timestamp || null
        };
    }

    getStorageUsed() {
        const all = JSON.stringify(this.exportAllData()).length;
        return (all / 1024 / 1024).toFixed(2);
    }
}

const db = new DataStore();
