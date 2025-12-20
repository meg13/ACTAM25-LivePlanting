class LiveAudioPlayer {
    constructor() {
        // Audio Context
        this.audioContext = null;
        this.analyser = null;
        this.gainNode = null;
        
        // WebSocket
        this.websocket = null;
        this.isConnected = false;
        
        // Audio playback
        this.audioQueue = [];
        this.isPlaying = false;
        this.nextPlayTime = 0;
        
        // Canvas for waveform
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;
        
        // Recording state
        this.isRecording = false;
        
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
        
        // Volume icon toggle
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
                    sampleRate: 48000
                });
                
                // Create analyser for visualization
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 2048;
                this.analyser.smoothingTimeConstant = 0.8;
                
                // Create gain node for volume control
                this.gainNode = this.audioContext.createGain();
                this.gainNode.gain.value = parseFloat(this.volumeSlider.value);
                
                // Connect: analyser -> gain -> destination
                this.analyser.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);
            }
            
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
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
            alert('Errore nell\'avviare l\'audio: ' + error.message);
        }
    }
    
    connectWebSocket() {
        const wsUrl = 'ws://localhost:8765';
        
        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';
        
        this.websocket.onopen = () => {
            console.log('WebSocket connesso');
            this.isConnected = true;
            this.nextPlayTime = this.audioContext.currentTime;
        };
        
        this.websocket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Audio data
                this.handleAudioData(event.data);
            } else {
                // Control message
                try {
                    const msg = JSON.parse(event.data);
                    this.handleControlMessage(msg);
                } catch (e) {
                    // Not JSON, ignore
                }
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            alert('Impossibile connettersi al server audio. Assicurati che il server Python sia avviato su ' + wsUrl);
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket disconnesso');
            this.isConnected = false;
        };
    }
    
    handleAudioData(arrayBuffer) {
        // Convert received data to Float32Array (interleaved stereo: L, R, L, R, ...)
        const audioData = new Float32Array(arrayBuffer);
        
        // Create stereo audio buffer
        const frameCount = audioData.length / 2;  // Diviso per 2 perché è stereo
        const audioBuffer = this.audioContext.createBuffer(
            2, // stereo
            frameCount,
            this.audioContext.sampleRate
        );
        
        // De-interleave: separa Left e Right
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.getChannelData(1);
        
        for (let i = 0; i < frameCount; i++) {
            channelL[i] = audioData[i * 2];      // Sample pari = Left
            channelR[i] = audioData[i * 2 + 1];  // Sample dispari = Right
        }
        
        // Schedule for playback
        this.scheduleAudioBuffer(audioBuffer);
    }
    
    scheduleAudioBuffer(audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to analyser for visualization
        source.connect(this.analyser);
        
        // Calculate when to play with buffer extra
        const now = this.audioContext.currentTime;
        const bufferTime = 0.1; // 100ms di buffer extra per evitare glitch
        const playTime = Math.max(now + bufferTime, this.nextPlayTime);
        
        // Play
        source.start(playTime);
        
        // Update next play time
        this.nextPlayTime = playTime + audioBuffer.duration;
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
            if (!this.isConnected) {
                this.drawEmptyWaveform();
                return;
            }
            
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
        
        // Reset recording state
        if (this.isRecording) {
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }
    
    toggleRecording() {
        if (!this.isConnected) {
            alert('Devi prima avviare l\'audio!');
            return;
        }
        
        if (this.isRecording) {
            // Stop recording
            this.sendCommand({ command: 'stop_rec' });
        } else {
            // Start recording
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const player = new LiveAudioPlayer();
});
