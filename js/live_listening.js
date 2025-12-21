class LiveAudioPlayer {
    constructor() {
        // Audio Context
        this.audioContext = null;
        this.analyser = null;
        this.gainNode = null;
        this.source = null;

        // WebSocket
        this.websocket = null;
        this.isConnected = false;

        // Canvas for waveform
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;

        // ✅ MIGLIORAMENTO: Audio scheduling per playback continuo
        this.nextPlayTime = 0;
        this.audioChunkDuration = 0;
        this.scheduledChunks = 0;
        
        // ✅ ANTI-CLICK: Crossfade tra chunk
        this.lastChunkTail = null;
        this.crossfadeDuration = 0.002; // 2ms crossfade

        // DOM Elements
        this.waveformDiv = document.getElementById('waveform');
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeIcons = {
            on: document.querySelector('.fa-volume-up'),
            mute: document.querySelector('.fa-volume-mute')
        };

        // Recording controls
        this.recordButton = document.querySelector('.loopRecButton a');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.clearLoopButton = document.getElementById('loopCLButton');
        this.clearAmbienceButton = document.getElementById('ambienceCLButton');
        
        // Recording state
        this.isRecording = false;

        this.init();
    }

    init() {
        // Create canvas for waveform visualization
        this.createCanvas();

        // Setup event listeners
        this.setupEventListeners();

        // Initial state
        this.stopButton.disabled = true;
        this.recordButton.style.pointerEvents = 'none';
        this.recordButton.style.opacity = '0.5';
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');

        // Get actual dimensions from the #waveform div (after CSS is applied)
        const rect = this.waveformDiv.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Make canvas fill the container
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';

        this.waveformDiv.appendChild(this.canvas);
        this.canvasContext = this.canvas.getContext('2d');

        // Draw initial empty waveform
        this.drawEmptyWaveform();

        // Handle window resize
        window.addEventListener('resize', () => {
            const rect = this.waveformDiv.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.drawEmptyWaveform();
        });
    }

    drawEmptyWaveform() {
        const ctx = this.canvasContext;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(0, 0, width, height);

        // Draw center line
        ctx.strokeStyle = '#8BC34A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }

    setupEventListeners() {
        // Start button
        this.startButton.addEventListener('click', () => this.start());

        // Stop button
        this.stopButton.addEventListener('click', () => this.stop());

        // Volume slider
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            this.setVolume(volume);
        });

        // Volume icon toggle (mute/unmute)
        this.volumeIcons.on.addEventListener('click', () => this.toggleMute());
        this.volumeIcons.mute.addEventListener('click', () => this.toggleMute());
        
        // Record button
        this.recordButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleRecording();
        });
        
        // Clear buttons
        this.clearLoopButton.addEventListener('click', () => this.clearLoops());
        this.clearAmbienceButton.addEventListener('click', () => this.clearAmbience());
    }

    async start() {
        try {
            // Initialize Audio Context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    // ✅ IMPORTANTE: sample rate a 48000 per matchare Python
                    sampleRate: 48000,
                    // ✅ IMPORTANTE: latenza bassa ma non troppo (buffer stabile)
                    latencyHint: 'playback' // o 'balanced'
                });

                // Create analyser for visualization
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 2048;
                this.analyser.smoothingTimeConstant = 0.85; // Aumentato per smooth maggiore

                // Create gain node for volume control
                this.gainNode = this.audioContext.createGain();
                this.gainNode.gain.value = parseFloat(this.volumeSlider.value);

                // Connect nodes: analyser -> gain -> destination
                this.analyser.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);
                
                console.log('AudioContext initialized:');
                console.log('- Sample Rate:', this.audioContext.sampleRate);
                console.log('- Base Latency:', this.audioContext.baseLatency);
                console.log('- Output Latency:', this.audioContext.outputLatency);
            }

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // ✅ DIAGNOSTICA: Verifica sample rate
            if (this.audioContext.sampleRate !== 48000) {
                console.warn(`⚠️ ATTENZIONE: Sample rate mismatch!`);
                console.warn(`   AudioContext: ${this.audioContext.sampleRate} Hz`);
                console.warn(`   Previsto: 48000 Hz`);
                console.warn(`   Questo causerà clicks/distorsione!`);
            } else {
                console.log('✅ Sample rate OK: 48000 Hz');
            }

            // ✅ Reset scheduling per nuovo playback - BUFFER AUMENTATO
            this.nextPlayTime = this.audioContext.currentTime + 0.5; // 500ms buffer iniziale (era 150ms)
            this.scheduledChunks = 0;
            this.lastChunkTail = null; // Reset crossfade

            // Connect to WebSocket
            this.connectWebSocket();

            // Start visualization
            this.startVisualization();

            // Update UI
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.recordButton.style.pointerEvents = 'auto';
            this.recordButton.style.opacity = '1';
            this.clearLoopButton.disabled = false;
            this.clearAmbienceButton.disabled = false;

        } catch (error) {
            console.error('Error starting audio:', error);
            alert('Error starting audio: ' + error.message);
        }
    }

    connectWebSocket() {
        // WebSocket server URL
        const wsUrl = 'ws://localhost:8765';

        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
        };

        this.websocket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.handleAudioData(event.data);
            } else {
                // Control message
                try {
                    const msg = JSON.parse(event.data);
                    this.handleControlMessage(msg);
                } catch (e) {
                    // Not JSON
                }
            }
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            alert('Cannot connect to audio server. Make sure Python server is running on ' + wsUrl);
        };

        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
        };
    }

    handleAudioData(arrayBuffer) {
        // Convert received data to Float32Array (stereo interleaved)
        const audioData = new Float32Array(arrayBuffer);

        // ✅ DIAGNOSTICA 1: Dimensione chunk
        const frameCount = audioData.length / 2;
        
        // ✅ DIAGNOSTICA 2: Controllo NaN
        let hasNaN = false;
        let maxAmplitude = 0;
        for (let i = 0; i < audioData.length; i++) {
            if (isNaN(audioData[i]) || !isFinite(audioData[i])) {
                hasNaN = true;
                break;
            }
            maxAmplitude = Math.max(maxAmplitude, Math.abs(audioData[i]));
        }
        
        // ✅ DIAGNOSTICA: Log ogni 50 chunks
        if (this.scheduledChunks % 50 === 0) {
            const currentTime = this.audioContext.currentTime;
            const bufferAhead = this.nextPlayTime - currentTime;
            
            console.log('📊 AUDIO DIAGNOSTICS:');
            console.log(`  🔢 Chunk size: ${frameCount} frames (expected: 2048)`);
            console.log(`  📈 Max amplitude: ${maxAmplitude.toFixed(3)} (normal: 0.1-0.8)`);
            console.log(`  ⏱️  Buffer ahead: ${(bufferAhead * 1000).toFixed(1)}ms (target: 80-500ms)`);
            console.log(`  ❌ Has NaN: ${hasNaN}`);
            console.log(`  📦 Total chunks: ${this.scheduledChunks}`);
            
            // Warnings
            if (frameCount !== 2048) {
                console.warn('  ⚠️  INCONSISTENT CHUNK SIZE!');
            }
            if (maxAmplitude < 0.001) {
                console.warn('  ⚠️  AUDIO TOO QUIET (possibly silent)');
            }
            if (maxAmplitude > 1.0) {
                console.warn('  ⚠️  AUDIO CLIPPING (>1.0)');
            }
            if (bufferAhead < 0.08) {
                console.warn('  ⚠️  BUFFER TOO LOW (<80ms) - expect clicks!');
            }
            if (hasNaN) {
                console.error('  🚨 NaN DETECTED IN AUDIO DATA!');
            }
        }
        
        // ✅ Se ci sono NaN, non processare questo chunk
        if (hasNaN) {
            console.error('🚨 Skipping chunk with NaN values');
            return;
        }

        // Create audio buffer (STEREO)
        // ✅ USA IL SAMPLE RATE DELL'AUDIOCONTEXT (potrebbe non essere 48000!)
        const sampleRate = this.audioContext.sampleRate;
        
        const audioBuffer = this.audioContext.createBuffer(
            2, // stereo
            frameCount,
            sampleRate // Usa il sample rate effettivo dell'AudioContext
        );

        // De-interleave stereo data
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.getChannelData(1);
        
        for (let i = 0; i < frameCount; i++) {
            channelL[i] = audioData[i * 2];
            channelR[i] = audioData[i * 2 + 1];
        }
        
        // ✅ ANTI-CLICK: Applica crossfade tra chunk
        if (this.lastChunkTail) {
            const crossfadeSamples = Math.min(
                Math.floor(this.crossfadeDuration * this.audioContext.sampleRate), // Usa sample rate effettivo
                this.lastChunkTail.length / 2,
                frameCount
            );
            
            for (let i = 0; i < crossfadeSamples; i++) {
                const fadeIn = i / crossfadeSamples;
                const fadeOut = 1.0 - fadeIn;
                
                // Crossfade tra la coda del chunk precedente e l'inizio di questo
                channelL[i] = channelL[i] * fadeIn + this.lastChunkTail[i * 2] * fadeOut;
                channelR[i] = channelR[i] * fadeIn + this.lastChunkTail[i * 2 + 1] * fadeOut;
            }
        }
        
        // Salva la coda di questo chunk per il prossimo crossfade
        const tailSamples = Math.floor(this.crossfadeDuration * this.audioContext.sampleRate); // Usa sample rate effettivo
        const tailStart = Math.max(0, frameCount - tailSamples);
        this.lastChunkTail = new Float32Array(tailSamples * 2);
        for (let i = 0; i < tailSamples && (tailStart + i) < frameCount; i++) {
            this.lastChunkTail[i * 2] = channelL[tailStart + i];
            this.lastChunkTail[i * 2 + 1] = channelR[tailStart + i];
        }

        // ✅ SCHEDULING INTELLIGENTE per playback continuo
        const currentTime = this.audioContext.currentTime;
        
        // Se siamo troppo indietro, resetta lo scheduling
        if (this.nextPlayTime < currentTime) {
            console.warn('⚠️ Audio buffer underrun, resetting schedule');
            this.nextPlayTime = currentTime + 0.3; // 300ms di buffer (era 100ms)
            this.scheduledChunks = 0;
            this.lastChunkTail = null; // Reset crossfade
        }

        // Calcola durata di questo chunk con il sample rate effettivo
        const chunkDuration = frameCount / this.audioContext.sampleRate;

        // Create buffer source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect to analyser and gain
        source.connect(this.analyser);

        // ✅ Schedule playback al momento giusto (playback continuo!)
        source.start(this.nextPlayTime);
        
        // ✅ Aggiorna il prossimo tempo di playback
        this.nextPlayTime += chunkDuration;
        this.scheduledChunks++;

        // ✅ IMPORTANTE: pulizia automatica quando il source finisce
        source.onended = () => {
            source.disconnect();
        };
    }
    
    handleControlMessage(msg) {
        if (msg.status === 'recording') {
            this.isRecording = msg.recording;
            this.updateRecordingUI();
        } else if (msg.status === 'stopped') {
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }

    startVisualization() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            // Get waveform data
            this.analyser.getByteTimeDomainData(dataArray);

            // Draw waveform
            const ctx = this.canvasContext;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear canvas
            ctx.fillStyle = '#F5F5DC';
            ctx.fillRect(0, 0, width, height);

            // Draw waveform
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#4A90E2';
            ctx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(width, height / 2);
            ctx.stroke();
        };

        draw();
    }

    stop() {
        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Stop visualization
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Suspend audio context
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }

        // Draw empty waveform
        this.drawEmptyWaveform();

        // Update UI
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.isConnected = false;
        this.recordButton.style.pointerEvents = 'none';
        this.recordButton.style.opacity = '0.5';
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
        
        if (this.isRecording) {
            this.isRecording = false;
            this.updateRecordingUI();
        }
        
        // Reset crossfade
        this.lastChunkTail = null;
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = volume;
        }

        // Update icon based on volume
        if (volume === 0) {
            this.volumeIcons.on.style.display = 'none';
            this.volumeIcons.mute.style.display = 'inline-block';
        } else {
            this.volumeIcons.on.style.display = 'inline-block';
            this.volumeIcons.mute.style.display = 'none';
        }
    }

    toggleMute() {
        const currentVolume = parseFloat(this.volumeSlider.value);

        if (currentVolume > 0) {
            // Mute: save current volume and set to 0
            this.volumeSlider.dataset.previousVolume = currentVolume;
            this.volumeSlider.value = 0;
            this.setVolume(0);
        } else {
            // Unmute: restore previous volume or set to 1
            const previousVolume = this.volumeSlider.dataset.previousVolume || 1;
            this.volumeSlider.value = previousVolume;
            this.setVolume(parseFloat(previousVolume));
        }
    }
    
    toggleRecording() {
        if (!this.isConnected) {
            alert('Devi prima avviare l\'audio!');
            return;
        }
        
        if (this.isRecording) {
            this.sendCommand({ command: 'stop_rec' });
        } else {
            this.sendCommand({ command: 'start_rec' });
        }
    }
    
    updateRecordingUI() {
        if (this.isRecording) {
            this.pauseIcon.style.display = 'inline';
            this.recordButton.style.backgroundColor = '#ff4444';
        } else {
            this.pauseIcon.style.display = 'none';
            this.recordButton.style.backgroundColor = '#e95d8c';
        }
    }
    
    clearLoops() {
        if (!this.isConnected) return;
        this.sendCommand({ command: 'clear_loops' });
    }
    
    clearAmbience() {
        if (!this.isConnected) return;
        this.sendCommand({ command: 'clear_ambient' });
    }
    
    sendCommand(command) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(command));
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const player = new LiveAudioPlayer();
});
