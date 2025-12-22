class LiveAudioVisualizer {
    constructor() {
        // WebSocket
        this.websocket = null;
        this.isConnected = false;
        this.isAudioPlaying = false; // Stato audio

        // Canvas
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;
        
        // Visualization buffer
        this.vizBuffer = new Float32Array(256);
        this.vizIndex = 0;

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
        this.createCanvas();
        this.setupEventListeners();

        // Initial state
        this.stopButton.disabled = true;
        this.recordButton.style.pointerEvents = 'none';
        this.recordButton.style.opacity = '0.5';
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
        
        // Nascondi volume controls (audio su PC)
        this.volumeSlider.style.display = 'none';
        this.volumeIcons.on.style.display = 'none';
        this.volumeIcons.mute.style.display = 'none';
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');

        const rect = this.waveformDiv.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';

        this.waveformDiv.appendChild(this.canvas);
        this.canvasContext = this.canvas.getContext('2d');

        this.drawEmptyWaveform();

        window.addEventListener('resize', () => {
            const rect = this.waveformDiv.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            if (!this.isAudioPlaying) {
                this.drawEmptyWaveform();
            }
        });
    }

    drawEmptyWaveform() {
        const ctx = this.canvasContext;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#8BC34A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.start());
        this.stopButton.addEventListener('click', () => this.stop());
        
        this.recordButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleRecording();
        });
        
        this.clearLoopButton.addEventListener('click', () => this.clearLoops());
        this.clearAmbienceButton.addEventListener('click', () => this.clearAmbience());
    }

    async start() {
        try {
            console.log('🔄 Connessione al server...');
            
            // Connetti WebSocket
            this.connectWebSocket();

            // Attendi connessione
            await this.waitForConnection();
            
            console.log('✅ Connesso! Avvio audio...');

            // ✅ INVIA COMANDO START AUDIO AL SERVER!
            this.sendCommand({ command: 'start_audio' });
            this.isAudioPlaying = true;

            // Start visualizzazione
            this.startVisualization();

            // Update UI
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.recordButton.style.pointerEvents = 'auto';
            this.recordButton.style.opacity = '1';
            this.clearLoopButton.disabled = false;
            this.clearAmbienceButton.disabled = false;
            
            console.log('✅ Audio avviato sul PC');
            console.log('📊 Visualizzazione attiva');

        } catch (error) {
            console.error('Errore:', error);
            alert('Errore: ' + error.message);
        }
    }

    connectWebSocket() {
        const wsUrl = 'ws://localhost:8765';

        console.log('🔄 Tentativo connessione WebSocket...');
        
        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';

        this.websocket.onopen = () => {
            console.log('✅ WebSocket connesso!');
            this.isConnected = true;
        };

        this.websocket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.handleVisualizationData(event.data);
            } else {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleControlMessage(msg);
                } catch (e) {
                    // Not JSON
                }
            }
        };

        this.websocket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            console.log('💡 Verifica che Python sia in esecuzione!');
        };

        this.websocket.onclose = () => {
            console.log('❌ WebSocket disconnesso');
            this.isConnected = false;
        };
    }

    async waitForConnection(timeout = 15000) {
        console.log('⏳ Attendo connessione...');
        const start = Date.now();
        let lastLog = 0;
        
        while (!this.isConnected) {
            const elapsed = Date.now() - start;
            
            // Log ogni secondo
            if (elapsed - lastLog > 1000) {
                console.log(`⏳ Attesa: ${Math.floor(elapsed/1000)}s...`);
                lastLog = elapsed;
            }
            
            if (elapsed > timeout) {
                throw new Error('⚠️  Timeout connessione WebSocket!\n\nVerifica che:\n1. Python sia in esecuzione\n2. Vedi "WebSocket server su ws://localhost:8765"\n3. Non ci siano firewall che bloccano la porta 8765');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('✅ Connessione stabilita!');
    }

    handleVisualizationData(arrayBuffer) {
        const floatData = new Float32Array(arrayBuffer);
        
        for (let i = 0; i < floatData.length && i < this.vizBuffer.length; i++) {
            this.vizBuffer[(this.vizIndex + i) % this.vizBuffer.length] = floatData[i];
        }
        this.vizIndex = (this.vizIndex + floatData.length) % this.vizBuffer.length;
    }
    
    handleControlMessage(msg) {
        if (msg.status === 'audio_started') {
            console.log('▶️  Audio START confermato');
        } else if (msg.status === 'audio_stopped') {
            console.log('⏸️  Audio STOP confermato');
        } else if (msg.status === 'recording') {
            this.isRecording = msg.recording;
            this.updateRecordingUI();
        } else if (msg.status === 'stopped') {
            this.isRecording = false;
            this.updateRecordingUI();
        } else if (msg.status === 'ambient_cleared') {
            console.log('🗑️  Ambience cleared');
        } else if (msg.status === 'loops_cleared') {
            console.log('🗑️  Loops cleared');
        }
    }

    startVisualization() {
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            const ctx = this.canvasContext;
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Clear
            ctx.fillStyle = '#F5F5DC';
            ctx.fillRect(0, 0, width, height);

            // Draw waveform
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#4A90E2';
            ctx.beginPath();

            const bufferLength = this.vizBuffer.length;
            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const idx = (this.vizIndex + i) % bufferLength;
                const v = this.vizBuffer[idx];
                
                // Normalizza [-1,1] → [0,1]
                const normalized = (v + 1.0) / 2.0;
                const y = normalized * height;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.stroke();
        };

        draw();
    }

    stop() {
        // ✅ INVIA COMANDO STOP AUDIO AL SERVER!
        if (this.isConnected) {
            this.sendCommand({ command: 'stop_audio' });
        }
        this.isAudioPlaying = false;

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

        // Draw empty
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
        
        console.log('⏸️  Audio fermato');
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
            console.log('🔴 Recording...');
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
        } else {
            console.warn('⚠️  WebSocket non connesso');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new LiveAudioVisualizer();
    
    console.log('🌱 Plant Audio Visualizer & Controller');
    console.log('🔊 Audio: casse del PC (qualità originale sounddevice)');
    console.log('📊 Visualizzazione: questo browser');
    console.log('🎛️  Controlli: Start/Stop dal web');
});
