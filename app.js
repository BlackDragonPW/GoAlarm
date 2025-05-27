class Chronos {
    constructor() {
        this.state = {
            alarms: JSON.parse(localStorage.getItem('alarms')) || [],
            reminders: JSON.parse(localStorage.getItem('reminders')) || [],
            events: JSON.parse(localStorage.getItem('events')) || [],
            settings: JSON.parse(localStorage.getItem('settings')) || {
                darkMode: true,
                snoozeOptions: [5, 10, 15],
                defaultSnooze: 5,
                ringtones: [],
                vibration: true
            },
            currentView: 'month',
            activeAlarm: null
        };
        
        this.audioElements = new Map();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderAll();
        this.startTimers();
        this.applyTheme();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchSection(item.dataset.section));
        });

        // Alarm Creation
        document.getElementById('add-alarm').addEventListener('click', () => this.showAlarmModal());
        document.getElementById('alarm-form').addEventListener('submit', e => this.handleAlarmSubmit(e));

        // Calendar Navigation
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));

        // Snooze Handling
        document.querySelectorAll('.snooze-preset').forEach(btn => {
            btn.addEventListener('click', () => this.handleSnooze(parseInt(btn.dataset.minutes)));
        });
        document.getElementById('custom-snooze').addEventListener('change', e => {
            this.handleSnooze(parseInt(e.target.value));
        });

        // Theme Toggle
        document.getElementById('dark-mode-toggle').addEventListener('change', e => {
            this.toggleTheme(e.target.checked);
        });

        // File Upload
        document.getElementById('ringtone-upload').addEventListener('change', e => {
            this.handleRingtoneUpload(e.target.files[0]);
        });

        // Calendar View
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });
    }

    handleAlarmSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const repeatDays = Array.from(document.querySelectorAll('.day-option.active'))
                             .map(btn => parseInt(btn.dataset.day));
        
        const alarm = {
            id: Date.now(),
            time: formData.get('time'),
            label: formData.get('label'),
            ringtone: formData.get('ringtone'),
            repeatDays,
            snooze: formData.get('snooze'),
            enabled: true,
            nextTrigger: this.calculateNextTrigger(formData.get('time'), repeatDays)
        };

        this.state.alarms.push(alarm);
        this.saveState();
        this.renderAlarms();
        this.closeModal();
    }

    calculateNextTrigger(time, repeatDays) {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const next = new Date();
        
        next.setHours(hours);
        next.setMinutes(minutes);
        next.setSeconds(0);
        
        if(repeatDays.length > 0) {
            const currentDay = now.getDay();
            const nextDay = repeatDays.find(d => d > currentDay) || repeatDays[0];
            const daysToAdd = (nextDay - currentDay + 7) % 7;
            next.setDate(now.getDate() + daysToAdd);
        } else if(next < now) {
            next.setDate(now.getDate() + 1);
        }

        return next.getTime();
    }

    checkAlarms() {
        const now = Date.now();
        this.state.alarms.forEach(alarm => {
            if(alarm.enabled && now >= alarm.nextTrigger) {
                this.triggerAlarm(alarm);
                if(alarm.repeatDays.length === 0) {
                    this.deleteAlarm(alarm.id);
                } else {
                    this.rescheduleRecurringAlarm(alarm);
                }
            }
        });
    }

    triggerAlarm(alarm) {
        this.state.activeAlarm = alarm;
        this.showSnoozeModal();
        this.playRingtone(alarm.ringtone);
        this.vibrate();
    }

    playRingtone(name) {
        const ringtone = this.state.settings.ringtones.find(r => r.name === name);
        if(ringtone) {
            const audio = new Audio(ringtone.data);
            audio.loop = true;
            audio.play();
            this.audioElements.set(alarm.id, audio);
        }
    }

    vibrate() {
        if(this.state.settings.vibration && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    handleSnooze(minutes) {
        const alarm = this.state.activeAlarm;
        alarm.nextTrigger = Date.now() + (minutes * 60000);
        this.saveState();
        this.stopAlarm();
        this.closeModal();
    }

    rescheduleRecurringAlarm(alarm) {
        alarm.nextTrigger = this.calculateNextTrigger(alarm.time, alarm.repeatDays);
        this.saveState();
    }

    handleRingtoneUpload(file) {
        if(!file.type.startsWith('audio/')) return;
        
        const reader = new FileReader();
        reader.onload = e => {
            this.state.settings.ringtones.push({
                name: file.name.replace(/\.[^/.]+$/, ""),
                data: e.target.result,
                type: file.type
            });
            this.saveState();
            this.renderRingtones();
        };
        reader.readAsDataURL(file);
    }

    renderAll() {
        this.renderAlarms();
        this.renderCalendar();
        this.renderReminders();
        this.renderRingtones();
        this.renderSettings();
    }

    renderCalendar() {
        const monthStart = new Date(this.state.currentDate);
        monthStart.setDate(1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        
        // Generate day cells
        for(let i = 0; i < 42; i++) {
            const day = new Date(monthStart);
            day.setDate(i - monthStart.getDay() + 1);
            const cell = document.createElement('div');
            cell.className = `calendar-day ${this.isToday(day) ? 'today' : ''} 
                           ${this.hasEvents(day) ? 'has-events' : ''}`;
            cell.textContent = day.getDate();
            cell.addEventListener('click', () => this.showDayEvents(day));
            grid.appendChild(cell);
        }
    }

    renderRingtones() {
        const select = document.getElementById('alarm-ringtone');
        select.innerHTML = this.state.settings.ringtones
            .map(r => `<option value="${r.name}">${r.name}</option>`)
            .join('');
    }

    saveState() {
        localStorage.setItem('alarms', JSON.stringify(this.state.alarms));
        localStorage.setItem('settings', JSON.stringify(this.state.settings));
        localStorage.setItem('events', JSON.stringify(this.state.events));
        localStorage.setItem('reminders', JSON.stringify(this.state.reminders));
    }

    // 1500+ more lines of implementation...
}

const app = new Chronos();
