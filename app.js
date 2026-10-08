/**
 * Desafío Señas con IA - Lógica del Juego y Modelo Teachable Machine
 */

class SignGame {
    constructor() {
        this.modelURL = "https://teachablemachine.withgoogle.com/models/gFe3GrbNX/";
        this.model = null;
        this.webcam = null;
        this.isCameraActive = false;
        this.isLoopRunning = false;

        // Estado del juego
        this.currentIndex = 0;
        this.currentLetterIndex = 0;
        this.score = 0;
        this.wordCompleted = false;

        // Mecánica de Hold (Mantener seña)
        this.holdingLetter = null;
        this.holdStartTime = null;
        this.HOLD_DURATION = 800; // 800ms para confirmación ágil
        this.CONFIDENCE_THRESHOLD = 0.65; // 65% de certeza mínima

        // Audio sintetizado
        this.audioCtx = null;
    }

    // Inicializar Audio
    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
    }

    // Sonidos con Web Audio API (sin archivos externos)
    beep(freq = 600, duration = 0.12, type = 'sine') {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) { }
    }

    playVictorySound() {
        if (!this.audioCtx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // Do, Mi, Sol, Do alto
        notes.forEach((freq, idx) => {
            setTimeout(() => this.beep(freq, 0.2, 'triangle'), idx * 90);
        });
    }

    // Iniciar Juego
    async init() {
        this.initAudio();
        this.renderQuestion();

        // Iniciar cámara y modelo
        await this.startModelAndCamera();
    }

    // Cargar modelo de Teachable Machine y Cámara
    async startModelAndCamera() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const camLoader = document.getElementById('cam-loader');

        statusDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
        statusText.textContent = 'Cargando IA...';

        try {
            // 1. Cargar el modelo
            this.model = await tmImage.load(this.modelURL + 'model.json', this.modelURL + 'metadata.json');

            // 2. Inicializar webcam
            statusText.textContent = 'Conectando cámara...';

            const flip = true;
            this.webcam = new tmImage.Webcam(400, 300, flip);
            await this.webcam.setup();
            await this.webcam.play();

            const container = document.getElementById('webcam-view');
            container.innerHTML = '';
            container.appendChild(this.webcam.canvas);
            this.webcam.canvas.className = 'w-full h-full object-cover camera-mirror';

            this.isCameraActive = true;
            this.isLoopRunning = true;
            camLoader.classList.add('hidden');

            statusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
            statusText.textContent = 'Cámara & IA Activas';

            window.requestAnimationFrame(() => this.detectLoop());

        } catch (err) {
            console.error("Error al iniciar cámara o modelo:", err);
            statusDot.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
            statusText.textContent = 'Sin acceso a cámara';
            
            camLoader.innerHTML = `
                <div class="p-4 text-center">
                    <i class="fa-solid fa-video-slash text-red-400 text-3xl mb-2"></i>
                    <p class="text-xs font-bold text-white mb-1">No se detectó cámara activa</p>
                    <p class="text-[11px] text-slate-400">Conecta una cámara o permite el acceso en el navegador y recarga la página.</p>
                </div>
            `;
        }
    }

    // Bucle continuo de predicción
    async detectLoop() {
        if (!this.isLoopRunning) return;
        this.webcam.update();

        if (this.model) {
            const predictions = await this.model.predict(this.webcam.canvas);
            predictions.sort((a, b) => b.probability - a.probability);

            const top = predictions[0];
            const letter = top.className.toUpperCase();
            const prob = top.probability;

            this.updateLiveCard(letter, prob);
            this.processDetection(letter, prob);
        }

        window.requestAnimationFrame(() => this.detectLoop());
    }

    // Actualiza el indicador visual de detección
    updateLiveCard(letter, prob) {
        const liveLetter = document.getElementById('live-letter');
        const liveConf = document.getElementById('live-conf');
        const liveBar = document.getElementById('live-conf-bar');

        if (prob >= 0.4) {
            liveLetter.textContent = letter;
            liveConf.textContent = `${Math.round(prob * 100)}%`;
            if (liveBar) liveBar.style.width = `${Math.round(prob * 100)}%`;
        } else {
            liveLetter.textContent = '-';
            liveConf.textContent = `${Math.round(prob * 100)}%`;
            if (liveBar) liveBar.style.width = '0%';
        }
    }

    // Procesar la letra detectada con la mecánica de Hold
    processDetection(letter, prob) {
        if (this.wordCompleted) {
            this.resetHold();
            return;
        }

        const targetLetter = this.getTargetLetter();

        // ¿La letra coincide y supera el umbral de certeza?
        if (prob >= this.CONFIDENCE_THRESHOLD && letter === targetLetter) {
            const now = performance.now();
            const overlay = document.getElementById('hold-overlay');
            const pBar = document.getElementById('hold-bar');

            if (this.holdingLetter !== letter) {
                this.holdingLetter = letter;
                this.holdStartTime = now;
                if (overlay) overlay.classList.remove('hidden');
                return;
            }

            const elapsed = now - this.holdStartTime;
            const pct = Math.min(100, (elapsed / this.HOLD_DURATION) * 100);
            if (pBar) pBar.style.width = `${pct}%`;

            if (elapsed >= this.HOLD_DURATION) {
                this.resetHold();
                this.registerCorrectLetter(letter);
            }
        } else {
            this.resetHold();
        }
    }

    resetHold() {
        this.holdingLetter = null;
        this.holdStartTime = null;
        const overlay = document.getElementById('hold-overlay');
        const pBar = document.getElementById('hold-bar');
        if (overlay) overlay.classList.add('hidden');
        if (pBar) pBar.style.width = '0%';
    }

    // Obtener la letra actual requerida
    getTargetLetter() {
        const item = BANCO_PREGUNTAS[this.currentIndex];
        if (!item) return '';
        return item.palabra[this.currentLetterIndex] || '';
    }

    // Acción al acertar una letra
    registerCorrectLetter(letter) {
        this.beep(750, 0.15);

        const item = BANCO_PREGUNTAS[this.currentIndex];
        const slot = document.getElementById(`slot-${this.currentLetterIndex}`);
        if (slot) {
            slot.textContent = letter;
            slot.className = 'w-14 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-extrabold text-3xl flex items-center justify-center font-display shadow-lg shadow-emerald-500/20 scale-105 transition-all';
        }

        this.currentLetterIndex++;

        // ¿Palabra completa?
        if (this.currentLetterIndex >= item.palabra.length) {
            this.onWordCompleted();
        } else {
            this.updateTargetHighlight();
        }
    }

    onWordCompleted() {
        this.wordCompleted = true;
        this.score += 100;
        document.getElementById('score-count').textContent = this.score;

        document.getElementById('target-box').classList.add('hidden');
        document.getElementById('success-card').classList.remove('hidden');

        this.playVictorySound();

        if (window.confetti) {
            confetti({
                particleCount: 70,
                spread: 60,
                origin: { y: 0.6 }
            });
        }
    }

    // Renderizar la pregunta y casillas
    renderQuestion() {
        this.currentLetterIndex = 0;
        this.wordCompleted = false;

        const item = BANCO_PREGUNTAS[this.currentIndex];

        document.getElementById('q-current').textContent = this.currentIndex + 1;
        document.getElementById('q-total').textContent = BANCO_PREGUNTAS.length;
        document.getElementById('q-category').textContent = item.categoria;
        document.getElementById('q-category-icon').className = `fa-solid ${item.icono} mr-1.5`;
        document.getElementById('q-title').textContent = item.pregunta;
        document.getElementById('q-hint').textContent = item.pista;

        document.getElementById('success-card').classList.add('hidden');
        document.getElementById('target-box').classList.remove('hidden');

        // Casillas
        const container = document.getElementById('slots-row');
        container.innerHTML = '';

        for (let i = 0; i < item.palabra.length; i++) {
            const slot = document.createElement('div');
            slot.id = `slot-${i}`;
            slot.textContent = '_';
            slot.className = 'w-14 h-16 rounded-2xl bg-slate-900 border-2 border-slate-700 text-slate-500 font-extrabold text-3xl flex items-center justify-center font-display transition-all';
            container.appendChild(slot);
        }

        this.updateTargetHighlight();
    }

    updateTargetHighlight() {
        const item = BANCO_PREGUNTAS[this.currentIndex];
        for (let i = 0; i < item.palabra.length; i++) {
            const slot = document.getElementById(`slot-${i}`);
            if (!slot) continue;

            if (i < this.currentLetterIndex) {
                slot.textContent = item.palabra[i];
                slot.className = 'w-14 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-extrabold text-3xl flex items-center justify-center font-display';
            } else if (i === this.currentLetterIndex) {
                slot.textContent = '?';
                slot.className = 'w-14 h-16 rounded-2xl bg-indigo-600/20 border-2 border-indigo-400 text-indigo-300 font-extrabold text-3xl flex items-center justify-center font-display animate-pulse';
            } else {
                slot.textContent = '_';
                slot.className = 'w-14 h-16 rounded-2xl bg-slate-900 border-2 border-slate-800 text-slate-600 font-extrabold text-3xl flex items-center justify-center font-display';
            }
        }

        const targetLetter = this.getTargetLetter();
        document.getElementById('target-letter-display').textContent = targetLetter;
    }

    // Saltar/validar letra manualmente (respaldo para la exposición)
    skipLetter() {
        if (this.wordCompleted) return;
        const letter = this.getTargetLetter();
        if (letter) {
            this.registerCorrectLetter(letter);
        }
    }

    nextQuestion() {
        this.currentIndex = (this.currentIndex + 1) % BANCO_PREGUNTAS.length;
        this.renderQuestion();
    }

    prevQuestion() {
        this.currentIndex = (this.currentIndex - 1 + BANCO_PREGUNTAS.length) % BANCO_PREGUNTAS.length;
        this.renderQuestion();
    }
}

// Instanciar al cargar la página
const game = new SignGame();
window.addEventListener('DOMContentLoaded', () => {
    game.init();
});
