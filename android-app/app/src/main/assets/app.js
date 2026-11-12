/**
 * Desafío Señas con IA - Lógica del Juego y Modelo Teachable Machine
 */

class SignGame {
    constructor() {
        this.modelURL = "./model/";
        this.model = null;
        this.webcam = null;
        this.isCameraActive = false;
        this.isLoopRunning = false;

        // Estado del juego
        this.currentLevel = 'facil'; // 'facil' | 'normal' | 'dificil'
        this.currentPlayerName = this.loadPlayerName() || 'Jugador 1';
        this.currentIndex = 0;
        this.currentLetterIndex = 0;
        this.score = 0;
        this.wordCompleted = false;

        // Cronómetro y cálculo de puntos
        this.questionStartTime = null;
        this.timerInterval = null;
        this.lastQuestionTimeSeconds = 0;
        this.RANKING_KEY = 'desafio_senas_ranking';
        this.PLAYER_STORAGE_KEY = 'desafio_senas_current_player';

        // Mecánica de Hold (Mantener seña)
        this.holdingLetter = null;
        this.holdStartTime = null;
        this.HOLD_DURATION = 800; // 800ms para confirmación ágil
        this.CONFIDENCE_THRESHOLD = 0.65; // 65% de certeza mínima

        // Audio sintetizado
        this.audioCtx = null;
    }

    loadPlayerName() {
        try {
            return localStorage.getItem('desafio_senas_current_player') || 'Jugador 1';
        } catch (e) {
            return 'Jugador 1';
        }
    }

    setPlayerName(name) {
        const cleanName = (name || '').trim();
        if (!cleanName) return;
        this.currentPlayerName = cleanName;
        try {
            localStorage.setItem('desafio_senas_current_player', cleanName);
        } catch (e) { }
        this.updatePlayerBadge();
    }

    updatePlayerBadge() {
        const badge = document.getElementById('current-player-name');
        if (badge) badge.textContent = this.currentPlayerName;
    }

    promptChangePlayer() {
        const newName = prompt('Nombre o apodo del participante actual:', this.currentPlayerName);
        if (newName && newName.trim() && newName.trim() !== this.currentPlayerName) {
            this.setPlayerName(newName);
            // Reiniciar puntaje para la nueva persona
            this.score = 0;
            const scoreEl = document.getElementById('score-count');
            if (scoreEl) scoreEl.textContent = '0';
        }
    }

    promptNewGame() {
        const newName = prompt('Nombre del nuevo participante:', `Jugador ${this.getAllPlayers().length + 1}`);
        if (newName && newName.trim()) {
            this.setPlayerName(newName);
            this.score = 0;
            const scoreEl = document.getElementById('score-count');
            if (scoreEl) scoreEl.textContent = '0';
            this.currentIndex = 0;
            this.renderQuestion();
            this.toggleRankingModal(); // cerrar modal para jugar
        }
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
        this.updatePlayerBadge();
        this.renderQuestion();

        // Iniciar cámara y modelo
        await this.startModelAndCamera();
    }

    // Cargar modelo de Teachable Machine y Cámara
    async startModelAndCamera() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const camLoader = document.getElementById('cam-loader');

        statusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
        statusText.textContent = 'Iniciando cámara...';

        try {
            // 1. Cargar el modelo
            this.model = await tmImage.load(this.modelURL + 'model.json', this.modelURL + 'metadata.json');

            // 2. Inicializar webcam
            statusText.textContent = 'Conectando cámara...';

            const flip = true;
            // Configurar webcam adaptada a móviles (cámara frontal si existe)
            this.webcam = new tmImage.Webcam(400, 300, flip);
            await this.webcam.setup({ facingMode: "user" });
            await this.webcam.play();

            const container = document.getElementById('webcam-view');
            container.innerHTML = '';
            container.appendChild(this.webcam.canvas);
            this.webcam.canvas.className = 'w-full h-full object-cover camera-mirror';

            this.isCameraActive = true;
            this.isLoopRunning = true;
            camLoader.classList.add('hidden');

            statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
            statusText.textContent = 'Cámara lista';

            window.requestAnimationFrame(() => this.detectLoop());

        } catch (err) {
            console.error("Error al iniciar cámara o modelo:", err);
            statusDot.className = 'w-2 h-2 rounded-full bg-red-500';
            statusText.textContent = 'Sin acceso a cámara';
            
            camLoader.innerHTML = `
                <div class="p-4 text-center">
                    <i class="fa-solid fa-video-slash text-slate-400 text-2xl mb-2"></i>
                    <p class="text-xs font-semibold text-slate-700 mb-1">Cámara no disponible</p>
                    <p class="text-xs text-slate-500">Permite el acceso a la cámara en tu navegador para continuar.</p>
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

    // Obtener las preguntas del nivel actual
    getCurrentQuestions() {
        if (typeof NIVELES_PREGUNTAS !== 'undefined' && NIVELES_PREGUNTAS[this.currentLevel]) {
            return NIVELES_PREGUNTAS[this.currentLevel].preguntas;
        }
        return BANCO_PREGUNTAS || [];
    }

    // Cambiar de nivel de dificultad
    selectLevel(levelKey) {
        if (!NIVELES_PREGUNTAS[levelKey]) return;
        this.currentLevel = levelKey;
        this.currentIndex = 0;
        this.updateLevelButtonsUI();
        this.renderQuestion();
    }

    // Actualizar estilo visual de los botones de nivel
    updateLevelButtonsUI() {
        const levels = ['facil', 'normal', 'dificil'];
        levels.forEach(lvl => {
            const btn = document.getElementById(`btn-lvl-${lvl}`);
            if (!btn) return;

            if (lvl === this.currentLevel) {
                btn.className = 'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer bg-white text-blue-700 shadow-sm border border-slate-200';
            } else {
                btn.className = 'px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer';
            }
        });
    }

    // Obtener la letra actual requerida
    getTargetLetter() {
        const questions = this.getCurrentQuestions();
        const item = questions[this.currentIndex];
        if (!item) return '';
        return item.palabra[this.currentLetterIndex] || '';
    }

    // Acción al acertar una letra
    registerCorrectLetter(letter) {
        this.beep(750, 0.15);

        const questions = this.getCurrentQuestions();
        const item = questions[this.currentIndex];
        const slot = document.getElementById(`slot-${this.currentLetterIndex}`);
        if (slot) {
            slot.textContent = letter;
            slot.className = 'letter-slot filled';
        }

        this.currentLetterIndex++;

        // ¿Palabra completa?
        if (this.currentLetterIndex >= item.palabra.length) {
            this.onWordCompleted();
        } else {
            this.updateTargetHighlight();
        }
    }

    // Métodos del Cronómetro
    startQuestionTimer() {
        this.stopQuestionTimer();
        this.questionStartTime = Date.now();
        this.updateTimerDisplay(0);

        this.timerInterval = setInterval(() => {
            if (!this.questionStartTime) return;
            const elapsedSeconds = Math.floor((Date.now() - this.questionStartTime) / 1000);
            this.updateTimerDisplay(elapsedSeconds);
        }, 1000);
    }

    stopQuestionTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay(seconds) {
        const timerEl = document.getElementById('timer-display');
        if (!timerEl) return;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }

    // Cálculo de puntuación según dificultad y tiempo
    calculateScore(seconds, levelKey) {
        // Puntos base por dificultad
        const basePoints = {
            facil: 100,
            normal: 150,
            dificil: 200
        }[levelKey] || 100;

        // Bonificación por rapidez (máx 100 puntos extra si se hace rápido)
        // Fácil: meta 10s. Normal: meta 15s. Difícil: meta 25s.
        const targetSeconds = {
            facil: 10,
            normal: 15,
            dificil: 25
        }[levelKey] || 15;

        let speedBonus = 0;
        if (seconds <= targetSeconds) {
            speedBonus = 100;
        } else if (seconds <= targetSeconds * 2) {
            const ratio = (targetSeconds * 2 - seconds) / targetSeconds;
            speedBonus = Math.round(ratio * 100);
        } else {
            speedBonus = 10; // mínimo por resolver
        }

        return {
            basePoints,
            speedBonus,
            totalEarned: basePoints + speedBonus
        };
    }

    // Guardar registro en localStorage para el ranking
    saveRecordToRanking(recordData) {
        try {
            const raw = localStorage.getItem(this.RANKING_KEY);
            const history = raw ? JSON.parse(raw) : [];
            history.push(recordData);
            localStorage.setItem(this.RANKING_KEY, JSON.stringify(history));
        } catch (e) {
            console.error("Error al guardar registro en localStorage:", e);
        }
    }

    getRankingHistory() {
        try {
            const raw = localStorage.getItem(this.RANKING_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    onWordCompleted() {
        this.stopQuestionTimer();
        this.wordCompleted = true;

        const elapsedSeconds = this.questionStartTime 
            ? Math.max(1, Math.round((Date.now() - this.questionStartTime) / 1000))
            : 1;
        this.lastQuestionTimeSeconds = elapsedSeconds;

        const currentQuestions = this.getCurrentQuestions();
        const currentItem = currentQuestions[this.currentIndex];

        // Calcular puntos
        const scoreResult = this.calculateScore(elapsedSeconds, this.currentLevel);
        this.score += scoreResult.totalEarned;
        document.getElementById('score-count').textContent = this.score;

        // Guardar registro detallado para que el amigo pueda armar el ranking
        const record = {
            id: 'rec_' + Date.now(),
            fecha: new Date().toISOString(),
            jugador: this.currentPlayerName,
            nivel: this.currentLevel,
            palabra: currentItem ? currentItem.palabra : '',
            categoria: currentItem ? currentItem.categoria : '',
            tiempoSegundos: elapsedSeconds,
            puntosBase: scoreResult.basePoints,
            puntosVelocidad: scoreResult.speedBonus,
            puntosGanados: scoreResult.totalEarned,
            puntajeAcumulado: this.score
        };
        this.saveRecordToRanking(record);

        // Actualizar UI del success card
        const timeEl = document.getElementById('success-time');
        const diffEl = document.getElementById('success-diff');
        const pointsEl = document.getElementById('success-points');

        if (timeEl) timeEl.textContent = `${elapsedSeconds}s`;
        if (diffEl) {
            const nombres = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
            diffEl.textContent = nombres[this.currentLevel] || this.currentLevel;
        }
        if (pointsEl) {
            pointsEl.textContent = `+${scoreResult.totalEarned} pts (+${scoreResult.speedBonus} bonus rapidez)`;
        }

        document.getElementById('target-box').classList.add('hidden');
        document.getElementById('success-card').classList.remove('hidden');

        this.playVictorySound();

        if (window.confetti) {
            confetti({
                particleCount: 50,
                spread: 50,
                origin: { y: 0.6 }
            });
        }
    }

    // Obtener lista de todos los participantes únicos
    getAllPlayers() {
        const history = this.getRankingHistory();
        const playersMap = {};
        history.forEach(item => {
            const name = item.jugador || 'Anónimo';
            playersMap[name] = true;
        });
        return Object.keys(playersMap);
    }

    // Calcular la tabla de clasificación por persona
    getPlayersRanking() {
        const history = this.getRankingHistory();
        const map = {};

        history.forEach(item => {
            const name = item.jugador || 'Anónimo';
            if (!map[name]) {
                map[name] = {
                    nombre: name,
                    puntosTotales: 0,
                    palabrasAcertadas: 0,
                    tiempoTotalSegundos: 0,
                    ultimaFecha: item.fecha
                };
            }

            map[name].puntosTotales += (item.puntosGanados || 0);
            map[name].palabrasAcertadas += 1;
            map[name].tiempoTotalSegundos += (item.tiempoSegundos || 0);
            map[name].ultimaFecha = item.fecha;
        });

        const rankingList = Object.values(map);

        // Ordenar por puntos totales descendente, y desempate por menor promedio de tiempo
        rankingList.sort((a, b) => {
            if (b.puntosTotales !== a.puntosTotales) {
                return b.puntosTotales - a.puntosTotales;
            }
            const avgA = a.palabrasAcertadas > 0 ? (a.tiempoTotalSegundos / a.palabrasAcertadas) : 999;
            const avgB = b.palabrasAcertadas > 0 ? (b.tiempoTotalSegundos / b.palabrasAcertadas) : 999;
            return avgA - avgB;
        });

        return rankingList;
    }

    // Modal de Ranking por Persona
    toggleRankingModal() {
        const modal = document.getElementById('ranking-modal');
        if (!modal) return;
        const isHidden = modal.classList.contains('hidden');
        if (isHidden) {
            this.renderRankingModalContent();
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    renderRankingModalContent() {
        const ranking = this.getPlayersRanking();
        const countEl = document.getElementById('ranking-count');
        const container = document.getElementById('ranking-table-container');

        if (countEl) countEl.textContent = ranking.length;
        if (!container) return;

        if (ranking.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-trophy text-3xl mb-2 text-slate-300 block"></i>
                    <p class="font-medium text-slate-700 mb-1">Aún no hay puntuaciones registradas</p>
                    <p class="text-[11px] text-slate-500">Resuelve palabras en la cámara para posicionarte en la tabla.</p>
                </div>
            `;
            return;
        }

        let tableHTML = `
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr>
                        <th class="p-2.5 font-semibold text-center w-12">#</th>
                        <th class="p-2.5 font-semibold">Participante</th>
                        <th class="p-2.5 font-semibold text-center">Aciertos</th>
                        <th class="p-2.5 font-semibold text-right">Prom. tiempo</th>
                        <th class="p-2.5 font-semibold text-right">Puntuación</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
        `;

        ranking.forEach((player, index) => {
            const pos = index + 1;
            let badgePos = `<span class="font-bold text-slate-500">${pos}</span>`;
            let rowBg = 'hover:bg-slate-50';

            if (pos === 1) {
                badgePos = `<span class="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center mx-auto text-xs shadow-xs"><i class="fa-solid fa-medal mr-0.5"></i>1</span>`;
                rowBg = 'bg-amber-50/40 hover:bg-amber-50/70';
            } else if (pos === 2) {
                badgePos = `<span class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-extrabold flex items-center justify-center mx-auto text-xs"><i class="fa-solid fa-medal mr-0.5"></i>2</span>`;
                rowBg = 'bg-slate-50/60 hover:bg-slate-100/50';
            } else if (pos === 3) {
                badgePos = `<span class="w-6 h-6 rounded-full bg-amber-700/10 text-amber-900 font-extrabold flex items-center justify-center mx-auto text-xs"><i class="fa-solid fa-medal mr-0.5"></i>3</span>`;
            }

            const isCurrent = player.nombre.toLowerCase() === this.currentPlayerName.toLowerCase();
            const currentTag = isCurrent ? `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Tú</span>` : '';

            const avgTime = player.palabrasAcertadas > 0 
                ? (player.tiempoTotalSegundos / player.palabrasAcertadas).toFixed(1)
                : '0.0';

            tableHTML += `
                <tr class="${rowBg} transition">
                    <td class="p-2.5 text-center">${badgePos}</td>
                    <td class="p-2.5 font-medium text-slate-800">
                        <div class="flex items-center">
                            <span class="font-semibold">${player.nombre}</span>
                            ${currentTag}
                        </div>
                    </td>
                    <td class="p-2.5 text-center text-slate-600 font-mono">${player.palabrasAcertadas}</td>
                    <td class="p-2.5 text-right font-mono text-slate-600">${avgTime}s</td>
                    <td class="p-2.5 text-right font-bold text-blue-600 font-mono text-sm">${player.puntosTotales} pts</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    copyScoresJSON() {
        const history = this.getRankingHistory();
        const ranking = this.getPlayersRanking();
        const exportData = {
            rankingPorPersona: ranking,
            historialDetallado: history
        };
        const jsonStr = JSON.stringify(exportData, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('¡Ranking e historial en JSON copiados al portapapeles!');
        }).catch(() => {
            prompt('Copia el JSON del ranking manualmente:', jsonStr);
        });
    }

    clearRankingData() {
        if (confirm('¿Deseas reiniciar toda la tabla de clasificación y borrar las puntuaciones?')) {
            localStorage.removeItem(this.RANKING_KEY);
            this.score = 0;
            const scoreEl = document.getElementById('score-count');
            if (scoreEl) scoreEl.textContent = '0';
            this.renderRankingModalContent();
        }
    }

    // Renderizar la pregunta y casillas
    renderQuestion() {
        this.currentLetterIndex = 0;
        this.wordCompleted = false;

        const questions = this.getCurrentQuestions();
        const item = questions[this.currentIndex];
        if (!item) return;

        document.getElementById('q-current').textContent = this.currentIndex + 1;
        document.getElementById('q-total').textContent = questions.length;
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
            slot.className = 'letter-slot empty';
            container.appendChild(slot);
        }

        this.updateTargetHighlight();

        // Iniciar cronómetro de la pregunta actual
        this.startQuestionTimer();
    }

    updateTargetHighlight() {
        const questions = this.getCurrentQuestions();
        const item = questions[this.currentIndex];
        if (!item) return;

        for (let i = 0; i < item.palabra.length; i++) {
            const slot = document.getElementById(`slot-${i}`);
            if (!slot) continue;

            if (i < this.currentLetterIndex) {
                slot.textContent = item.palabra[i];
                slot.className = 'letter-slot filled';
            } else if (i === this.currentLetterIndex) {
                slot.textContent = '?';
                slot.className = 'letter-slot current';
            } else {
                slot.textContent = '_';
                slot.className = 'letter-slot empty';
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
        const questions = this.getCurrentQuestions();
        this.currentIndex = (this.currentIndex + 1) % questions.length;
        this.renderQuestion();
    }

    prevQuestion() {
        const questions = this.getCurrentQuestions();
        this.currentIndex = (this.currentIndex - 1 + questions.length) % questions.length;
        this.renderQuestion();
    }
}

// Instanciar al cargar la página
const game = new SignGame();
window.addEventListener('DOMContentLoaded', () => {
    game.init();
});
