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

        // Audio data buffer
        this.audioQueue = [];

        // DOM Elements
        this.waveformDiv = document.getElementById('waveform');
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeIcons = {
            on: document.querySelector('.fa-volume-up'),
            mute: document.querySelector('.fa-volume-mute')
        };

        this.init();
    }

    init() {
        // Create canvas for waveform visualization
        this.createCanvas();

        // Setup event listeners
        this.setupEventListeners();

        // Initial state
        this.stopButton.disabled = true;
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
        ctx.strokeStyle = '#8BC34A';  // #4A90E2
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
    }

    async start() {
        try {
            // Initialize Audio Context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

                // Create analyser for visualization
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 2048;

                // Create gain node for volume control
                this.gainNode = this.audioContext.createGain();
                this.gainNode.gain.value = parseFloat(this.volumeSlider.value);

                // Connect nodes: source -> analyser -> gain -> destination
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

        } catch (error) {
            console.error('Error starting audio:', error);
            alert('Error starting audio: ' + error.message);
        }
    }

    connectWebSocket() {
        // TODO: Replace with your Python WebSocket server URL
        const wsUrl = 'ws://localhost:8765';

        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
        };

        this.websocket.onmessage = (event) => {
            this.handleAudioData(event.data);
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
        // Convert received data to Float32Array
        const audioData = new Float32Array(arrayBuffer);

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
            1, // mono
            audioData.length,
            this.audioContext.sampleRate
        );

        // Copy data to buffer
        audioBuffer.getChannelData(0).set(audioData);

        // Create buffer source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect to analyser and gain
        source.connect(this.analyser);

        // Play audio
        source.start(0);
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
