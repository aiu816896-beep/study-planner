// Data Management
class DataManager {
    constructor() {
        this.tasks = this.loadData('tasks') || [];
        this.notes = this.loadData('notes') || [];
        this.dailyStats = this.loadData('dailyStats') || {};
        this.settings = this.loadData('settings') || this.getDefaultSettings();
        this.currentTaskId = null;
    }

    loadData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    getDefaultSettings() {
        return {
            theme: 'light',
            dailyReminders: true,
            revisionAlerts: true,
            testAlerts: true
        };
    }

    addTask(task) {
        task.id = Date.now();
        task.completed = false;
        task.createdAt = new Date().toISOString();
        this.tasks.push(task);
        this.saveData('tasks', this.tasks);
        return task;
    }

    updateTask(id, updates) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates };
            this.saveData('tasks', this.tasks);
            return this.tasks[index];
        }
        return null;
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData('tasks', this.tasks);
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveData('tasks', this.tasks);
            this.updateDailyStats();
            return task;
        }
        return null;
    }

    getTasks(filter = {}) {
        let filtered = this.tasks;

        if (filter.date) {
            filtered = filtered.filter(t => t.date === filter.date);
        }

        if (filter.category && filter.category !== 'all') {
            filtered = filtered.filter(t => t.category === filter.category);
        }

        return filtered;
    }

    addNote(note) {
        note.id = Date.now();
        note.createdAt = new Date().toISOString();
        this.notes.push(note);
        this.saveData('notes', this.notes);
        return note;
    }

    deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        this.saveData('notes', this.notes);
    }

    updateDailyStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.getTasks({ date: today });
        
        this.dailyStats[today] = {
            totalTasks: todayTasks.length,
            completedTasks: todayTasks.filter(t => t.completed).length,
            studyMinutes: todayTasks
                .filter(t => t.completed)
                .reduce((sum, t) => sum + (parseInt(t.duration) || 0), 0),
            categories: this.getCategoryStats(todayTasks.filter(t => t.completed))
        };

        this.saveData('dailyStats', this.dailyStats);
    }

    getCategoryStats(tasks) {
        const stats = {};
        tasks.forEach(task => {
            if (!stats[task.category]) {
                stats[task.category] = 0;
            }
            stats[task.category] += parseInt(task.duration) || 0;
        });
        return stats;
    }

    getStreak() {
        const dates = Object.keys(this.dailyStats).sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        
        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const dayDiff = this.getDayDifference(today, date);
            
            if (dayDiff === i && this.dailyStats[date].completedTasks > 0) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    getDayDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d1 - d2);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getWeeklyReport() {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return this.getReportForRange(weekAgo, today);
    }

    getMonthlyReport() {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return this.getReportForRange(monthAgo, today);
    }

    getYearlyReport() {
        const today = new Date();
        const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        return this.getReportForRange(yearAgo, today);
    }

    getReportForRange(startDate, endDate) {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        
        const relevantDates = Object.keys(this.dailyStats).filter(date => date >= start && date <= end);
        
        let totalStudyMinutes = 0;
        let totalCompleted = 0;
        let totalTasks = 0;
        const subjectStats = {};
        const categoryStats = {};

        relevantDates.forEach(date => {
            const stats = this.dailyStats[date];
            totalStudyMinutes += stats.studyMinutes || 0;
            totalCompleted += stats.completedTasks || 0;
            totalTasks += stats.totalTasks || 0;

            Object.entries(stats.categories || {}).forEach(([category, minutes]) => {
                categoryStats[category] = (categoryStats[category] || 0) + minutes;
            });
        });

        const tasks = this.tasks.filter(t => t.date >= start && t.date <= end && t.completed);
        tasks.forEach(task => {
            if (task.subject) {
                subjectStats[task.subject] = (subjectStats[task.subject] || 0) + (parseInt(task.duration) || 0);
            }
        });

        return {
            totalStudyHours: Math.floor(totalStudyMinutes / 60),
            totalStudyMinutes: totalStudyMinutes % 60,
            totalCompleted,
            totalTasks,
            completionRate: totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0,
            subjectStats,
            categoryStats,
            daysActive: relevantDates.filter(date => this.dailyStats[date].completedTasks > 0).length
        };
    }

    exportData() {
        const data = {
            tasks: this.tasks,
            notes: this.notes,
            dailyStats: this.dailyStats,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
            localStorage.clear();
            location.reload();
        }
    }
}

// UI Manager
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentPage = 'dashboard';
        this.currentFilter = 'all';
        this.charts = {};
        this.initializeElements();
        this.attachEventListeners();
        this.loadTheme();
        this.updateUI();
    }

    initializeElements() {
        this.elements = {
            navItems: document.querySelectorAll('.nav-item'),
            pages: document.querySelectorAll('.page'),
            pageTitle: document.querySelector('.page-title'),
            streakCount: document.getElementById('streakCount'),
            todayStudyHours: document.getElementById('todayStudyHours'),
            todayCompleted: document.getElementById('todayCompleted'),
            todayPending: document.getElementById('todayPending'),
            productivityScore: document.getElementById('productivityScore'),
            todayTasksList: document.getElementById('todayTasksList'),
            allTasksList: document.getElementById('allTasksList'),
            dailyGoalInput: document.getElementById('dailyGoalInput'),
            dailyGoalDisplay: document.getElementById('dailyGoalDisplay'),
            themeToggle: document.getElementById('themeToggle'),
            menuToggle: document.getElementById('menuToggle'),
            taskModal: document.getElementById('taskModal'),
            noteModal: document.getElementById('noteModal'),
            taskForm: document.getElementById('taskForm'),
            noteForm: document.getElementById('noteForm'),
            notesGrid: document.getElementById('notesGrid'),
            reportContent: document.getElementById('reportContent')
        };
    }

    attachEventListeners() {
        // Navigation
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchPage(item.dataset.page));
        });

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Menu toggle
        this.elements.menuToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });

        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });

        // Task form
        this.elements.taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskSubmit();
        });

        // Note form
        this.elements.noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNoteSubmit();
        });

        // Add note button
        document.getElementById('addNoteBtn').addEventListener('click', () => this.openNoteModal());

        // Daily goal input
        this.elements.dailyGoalInput.addEventListener('change', () => this.saveDailyGoal());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
        });

        // Report tabs
        document.querySelectorAll('.report-tab').forEach(btn => {
            btn.addEventListener('click', () => this.showReport(btn.dataset.report));
        });

        // Analytics range
        const analyticsRange = document.getElementById('analyticsRange');
        if (analyticsRange) {
            analyticsRange.addEventListener('change', () => this.updateAnalytics());
        }

        // Settings buttons
        const exportBtn = document.getElementById('exportData');
        const clearBtn = document.getElementById('clearData');
        
        if (exportBtn) exportBtn.addEventListener('click', () => this.dataManager.exportData());
        if (clearBtn) clearBtn.addEventListener('click', () => this.dataManager.clearAllData());

        // Pomodoro
        this.initializePomodoro();

        // Set today's date as default
        const taskDateInput = document.getElementById('taskDate');
        if (taskDateInput) {
            taskDateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    switchPage(page) {
        this.currentPage = page;
        
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        this.elements.pages.forEach(p => {
            p.classList.toggle('active', p.id === page);
        });

        const titles = {
            dashboard: 'Dashboard',
            tasks: 'All Tasks',
            analytics: 'Analytics',
            reports: 'Reports',
            timetable: 'Timetable',
            pomodoro: 'Pomodoro Timer',
            notes: 'Notes',
            settings: 'Settings'
        };

        this.elements.pageTitle.textContent = titles[page] || page;

        if (page === 'analytics') this.updateAnalytics();
        if (page === 'reports') this.showReport('weekly');
        if (page === 'notes') this.renderNotes();
    }

    updateUI() {
        this.updateDashboardStats();
        this.renderTodayTasks();
        this.renderAllTasks();
        this.loadDailyGoal();
        this.updateStreak();
    }

    updateDashboardStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.dataManager.getTasks({ date: today });
        const completed = todayTasks.filter(t => t.completed);
        const pending = todayTasks.filter(t => !t.completed);

        const totalMinutes = completed.reduce((sum, t) => sum + (parseInt(t.duration) || 0), 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        this.elements.todayStudyHours.textContent = `${hours}h ${minutes}m`;
        this.elements.todayCompleted.textContent = completed.length;
        this.elements.todayPending.textContent = pending.length;
        
        const productivity = todayTasks.length > 0 
            ? Math.round((completed.length / todayTasks.length) * 100)
            : 0;
        this.elements.productivityScore.textContent = `${productivity}%`;
    }

    renderTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        const tasks = this.dataManager.getTasks({ date: today });
        
        this.elements.todayTasksList.innerHTML = tasks.length === 0
            ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tasks for today. Add your first task!</p>'
            : tasks.map(task => this.createTaskHTML(task)).join('');

        this.attachTaskEventListeners();
    }

    renderAllTasks() {
        const tasks = this.dataManager.getTasks({ category: this.currentFilter });
        
        this.elements.allTasksList.innerHTML = tasks.length === 0
            ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tasks found.</p>'
            : tasks.map(task => this.createTaskHTML(task)).join('');

        this.attachTaskEventListeners();
    }

    createTaskHTML(task) {
        const categoryIcons = {
            study: '📚',
            reading: '📖',
            notes: '✍',
            revision: '🔁',
            assignment: '📝',
            test: '⏳'
        };

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-left">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <div class="task-info">
                        <div class="task-title">${categoryIcons[task.category] || ''} ${task.title}</div>
                        <div class="task-meta">
                            ${task.subject ? `<span><i class="fas fa-book"></i> ${task.subject}</span>` : ''}
                            <span><i class="fas fa-clock"></i> ${task.duration} min</span>
                            <span><i class="fas fa-calendar"></i> ${task.date}</span>
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit-task" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action-btn delete-task" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    attachTaskEventListeners() {
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                this.dataManager.toggleTask(taskId);
                this.updateUI();
            });
        });

        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                if (confirm('Delete this task?')) {
                    this.dataManager.deleteTask(taskId);
                    this.updateUI();
                }
            });
        });

        document.querySelectorAll('.edit-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.closest('.task-item').dataset.taskId);
                this.openTaskModal(taskId);
            });
        });
    }

    openTaskModal(taskId = null) {
        this.dataManager.currentTaskId = taskId;
        const modal = this.elements.taskModal;
        
        if (taskId) {
            const task = this.dataManager.tasks.find(t => t.id === taskId);
            if (task) {
                document.getElementById('modalTitle').textContent = 'Edit Task';
                document.getElementById('taskTitle').value = task.title;
                document.getElementById('taskCategory').value = task.category;
                document.getElementById('taskSubject').value = task.subject || '';
                document.getElementById('taskDuration').value = task.duration;
                document.getElementById('taskDate').value = task.date;
                document.getElementById('taskNotes').value = task.notes || '';
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Add New Task';
            this.elements.taskForm.reset();
            document.getElementById('taskDate').value = new Date().toISOString().split('T')[0];
        }

        modal.classList.add('active');
    }

    handleTaskSubmit() {
        const taskData = {
            title: document.getElementById('taskTitle').value,
            category: document.getElementById('taskCategory').value,
            subject: document.getElementById('taskSubject').value,
            duration: document.getElementById('taskDuration').value,
            date: document.getElementById('taskDate').value,
            notes: document.getElementById('taskNotes').value
        };

        if (this.dataManager.currentTaskId) {
            this.dataManager.updateTask(this.dataManager.currentTaskId, taskData);
        } else {
            this.dataManager.addTask(taskData);
        }

        this.closeModals();
        this.updateUI();
    }

    openNoteModal() {
        this.elements.noteModal.classList.add('active');
        this.elements.noteForm.reset();
    }

    handleNoteSubmit() {
        const noteData = {
            title: document.getElementById('noteTitle').value,
            subject: document.getElementById('noteSubject').value,
            content: document.getElementById('noteContent').value
        };

        this.dataManager.addNote(noteData);
        this.closeModals();
        this.renderNotes();
    }

    renderNotes() {
        const notes = this.dataManager.notes;
        
        this.elements.notesGrid.innerHTML = notes.length === 0
            ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No notes yet. Create your first note!</p>'
            : notes.map(note => `
                <div class="note-card">
                    <div class="note-header">
                        <div>
                            <div class="note-title">${note.title}</div>
                            ${note.subject ? `<div class="note-subject">${note.subject}</div>` : ''}
                        </div>
                        <button class="task-action-btn delete-note" data-note-id="${note.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="note-content">${note.content}</div>
                </div>
            `).join('');

        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = parseInt(e.target.closest('.delete-note').dataset.noteId);
                if (confirm('Delete this note?')) {
                    this.dataManager.deleteNote(noteId);
                    this.renderNotes();
                }
            });
        });
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        this.dataManager.currentTaskId = null;
    }

    saveDailyGoal() {
        const goal = this.elements.dailyGoalInput.value;
        localStorage.setItem('dailyGoal', goal);
        this.loadDailyGoal();
    }

    loadDailyGoal() {
        const goal = localStorage.getItem('dailyGoal') || '';
        this.elements.dailyGoalInput.value = goal;
        this.elements.dailyGoalDisplay.textContent = goal || 'Set your daily goal above';
    }

    updateStreak() {
        const streak = this.dataManager.getStreak();
        this.elements.streakCount.textContent = streak;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.renderAllTasks();
    }

    showReport(type) {
        document.querySelectorAll('.report-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.report === type);
        });

        let report;
        if (type === 'weekly') report = this.dataManager.getWeeklyReport();
        else if (type === 'monthly') report = this.dataManager.getMonthlyReport();
        else if (type === 'yearly') report = this.dataManager.getYearlyReport();

        this.elements.reportContent.innerHTML = `
            <div class="report-grid">
                <div class="report-item">
                    <h3>${report.totalStudyHours}h ${report.totalStudyMinutes}m</h3>
                    <p>Total Study Time</p>
                </div>
                <div class="report-item">
                    <h3>${report.totalCompleted}</h3>
                    <p>Tasks Completed</p>
                </div>
                <div class="report-item">
                    <h3>${report.completionRate}%</h3>
                    <p>Completion Rate</p>
                </div>
                <div class="report-item">
                    <h3>${report.daysActive}</h3>
                    <p>Active Days</p>
                </div>
            </div>
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Study Time by Subject</h3>
                ${Object.entries(report.subjectStats).length > 0 
                    ? Object.entries(report.subjectStats)
                        .map(([subject, minutes]) => `
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${subject}:</strong> ${Math.floor(minutes / 60)}h ${minutes % 60}m
                            </div>
                        `).join('')
                    : '<p style="color: var(--text-secondary);">No subject data available</p>'
                }
            </div>
        `;
    }

    updateAnalytics() {
        const range = document.getElementById('analyticsRange').value;
        let report;
        
        if (range === 'week') report = this.dataManager.getWeeklyReport();
        else if (range === 'month') report = this.dataManager.getMonthlyReport();
        else if (range === 'year') report = this.dataManager.getYearlyReport();

        this.renderCharts(report);
    }

    renderCharts(report) {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => chart && chart.destroy());

        const isDark = document.body.dataset.theme === 'dark';
        const textColor = isDark ? '#d1d5db' : '#6b7280';
        const gridColor = isDark ? '#4b5563' : '#e5e7eb';

        // Subject Chart
        const subjectCtx = document.getElementById('subjectChart');
        if (subjectCtx && Object.keys(report.subjectStats).length > 0) {
            this.charts.subject = new Chart(subjectCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(report.subjectStats),
                    datasets: [{
                        label: 'Study Time (minutes)',
                        data: Object.values(report.subjectStats),
                        backgroundColor: '#6366f1',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { labels: { color: textColor } }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        x: { 
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // Category Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx && Object.keys(report.categoryStats).length > 0) {
            this.charts.category = new Chart(categoryCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(report.categoryStats),
                    datasets: [{
                        data: Object.values(report.categoryStats),
                        backgroundColor: [
                            '#6366f1', '#8b5cf6', '#ec4899', 
                            '#f59e0b', '#10b981', '#3b82f6'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { labels: { color: textColor } }
                    }
                }
            });
        }

        // Completion Chart
        const completionCtx = document.getElementById('completionChart');
        if (completionCtx) {
            this.charts.completion = new Chart(completionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Completed', 'Incomplete'],
                    datasets: [{
                        data: [report.totalCompleted, report.totalTasks - report.totalCompleted],
                        backgroundColor: ['#10b981', '#ef4444']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { labels: { color: textColor } }
                    }
                }
            });
        }
    }

    toggleTheme() {
        const currentTheme = document.body.dataset.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        // Update charts if on analytics page
        if (this.currentPage === 'analytics') {
            this.updateAnalytics();
        }
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.dataset.theme = theme;
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    initializePomodoro() {
        let pomodoroInterval = null;
        let timeLeft = 25 * 60;
        let isWorking = true;
        let pomodoroCount = parseInt(localStorage.getItem('todayPomodoros') || '0');

        const display = document.getElementById('pomodoroDisplay');
        const startBtn = document.getElementById('pomodoroStart');
        const resetBtn = document.getElementById('pomodoroReset');
        const countDisplay = document.getElementById('pomodoroCount');
        
        countDisplay.textContent = pomodoroCount;

        const updateDisplay = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        startBtn.addEventListener('click', () => {
            if (pomodoroInterval) {
                clearInterval(pomodoroInterval);
                pomodoroInterval = null;
                startBtn.textContent = 'Start';
            } else {
                pomodoroInterval = setInterval(() => {
                    timeLeft--;
                    updateDisplay();

                    if (timeLeft === 0) {
                        clearInterval(pomodoroInterval);
                        pomodoroInterval = null;
                        
                        if (isWorking) {
                            pomodoroCount++;
                            localStorage.setItem('todayPomodoros', pomodoroCount);
                            countDisplay.textContent = pomodoroCount;
                            alert('Great work! Time for a break!');
                            timeLeft = parseInt(document.getElementById('breakDuration').value) * 60;
                        } else {
                            alert('Break over! Ready for another session?');
                            timeLeft = parseInt(document.getElementById('workDuration').value) * 60;
                        }
                        
                        isWorking = !isWorking;
                        startBtn.textContent = 'Start';
                        updateDisplay();
                    }
                }, 1000);
                startBtn.textContent = 'Pause';
            }
        });

        resetBtn.addEventListener('click', () => {
            if (pomodoroInterval) {
                clearInterval(pomodoroInterval);
                pomodoroInterval = null;
            }
            timeLeft = parseInt(document.getElementById('workDuration').value) * 60;
            isWorking = true;
            startBtn.textContent = 'Start';
            updateDisplay();
        });
    }
}

// Initialize App
const dataManager = new DataManager();
const uiManager = new UIManager(dataManager);
