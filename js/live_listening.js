class LiveAudioVisualizer {
    constructor() {
        // WebSocket per controllo + visualizzazione (NO audio)
        this.websocket = null;
        this.isConnected = false;

        // Canvas per waveform
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;
        
        // Buffer per visualizzazione
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
        // Create canvas
        this.createCanvas();

        // Setup event listeners
        this.setupEventListeners();

        // Initial state
        this.stopButton.disabled = true;
        this.recordButton.style.pointerEvents = 'none';
        this.recordButton.style.opacity = '0.5';
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
        
        // Nascondi volume controls (audio è sul PC)
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
            this.drawEmptyWaveform();
        });
    }

    drawEmptyWaveform() {
        const ctx = this.canvasContext;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(0, 0, width, height);

        // Center line
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
            // Connetti WebSocket per visualizzazione
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
            
            console.log('✅ Visualizzazione avviata');
            console.log('🔊 Audio: ascolta dalle casse del PC');

        } catch (error) {
            console.error('Errore:', error);
            alert('Errore: ' + error.message);
        }
    }

    connectWebSocket() {
        const wsUrl = 'ws://localhost:8765';

        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';

        this.websocket.onopen = () => {
            console.log('✅ WebSocket connesso');
            this.isConnected = true;
        };

        this.websocket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Dati di visualizzazione
                this.handleVisualizationData(event.data);
            } else {
                // Messaggi di controllo
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
        };

        this.websocket.onclose = () => {
            console.log('❌ WebSocket disconnesso');
            this.isConnected = false;
        };
    }

    handleVisualizationData(arrayBuffer) {
        // Converte i bytes in Float32Array
        const floatData = new Float32Array(arrayBuffer);
        
        // Aggiorna il buffer di visualizzazione (ring buffer)
        for (let i = 0; i < floatData.length && i < this.vizBuffer.length; i++) {
            this.vizBuffer[(this.vizIndex + i) % this.vizBuffer.length] = floatData[i];
        }
        this.vizIndex = (this.vizIndex + floatData.length) % this.vizBuffer.length;
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
                // Leggi dal buffer circolare
                const idx = (this.vizIndex + i) % bufferLength;
                const v = this.vizBuffer[idx];
                
                // Normalizza e scala
                const normalized = (v + 1.0) / 2.0; // da [-1,1] a [0,1]
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
    }

    toggleRecording() {
        if (!this.isConnected) {
            alert('Devi prima avviare la visualizzazione!');
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
        console.log('🔄 Loops cleared');
    }
    
    clearAmbience() {
        if (!this.isConnected) return;
        this.sendCommand({ command: 'clear_ambient' });
        console.log('🔄 Ambience cleared');
    }
    
    sendCommand(command) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(command));
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new LiveAudioVisualizer();
    
    // Info per l'utente
    console.log('🌱 Plant Audio Visualizer');
    console.log('🔊 Audio: ascolta dalle casse del PC');
    console.log('📊 Visualizzazione: questo browser');
});
