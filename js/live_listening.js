class LiveAudioController {
    constructor() {
        // HTTP server URL
        this.httpUrl = 'http://localhost:8080';
        
        // WebSocket for visualization
        this.websocket = null;
        this.isWsConnected = false;

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

        // Recording controls
        this.recordButton = document.querySelector('.loopRecButton a');
        this.clearLoopButton = document.getElementById('loopCLButton');
        this.clearAmbienceButton = document.getElementById('ambienceCLButton');
        
        // Recording state
        this.isRecording = false;
        this.isPlaying = false;

        this.init();
    }

    init() {
        this.createCanvas();
        this.setupEventListeners();

        // Initial state
        this.stopButton.disabled = true;
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
        
        
        console.log('Controller ready!');
        console.log('Audio: PC speakers');
        console.log('Controls: HTTP (always works)');
        console.log('Visualization: WebSocket (optional)');
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
            if (!this.isPlaying) {
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
            console.log('Sending START command...');
            console.log('URL:', `${this.httpUrl}/start`);
            
            // Sending HTTP POST request to start audio
            const response = await fetch(`${this.httpUrl}/start`, {
                method: 'POST',
                mode: 'cors'
            });
            
            console.log('Answer received:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('START confirmed:', data);
            console.log('You should hear 3 notes from the PC!');
            
            this.isPlaying = true;
            
            // Try to connect WebSocket for visualization 
            this.tryConnectWebSocket();
            
            // Start visualization
            this.startVisualization();

            // Update UI
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.clearLoopButton.disabled = false;
            this.clearAmbienceButton.disabled = false;
            
            console.log('You should hear the test notes from the PC!');

        } catch (error) {
            console.error('Error:', error);
            alert('Error starting audio!\n\nCheck that Python is running.');
        }
    }

    tryConnectWebSocket() {
        // Attempt to connect to WebSocket for visualization
        try {
            console.log('Connecting WebSocket for visualization...');
            
            this.websocket = new WebSocket('ws://localhost:8765');
            this.websocket.binaryType = 'arraybuffer';

            this.websocket.onopen = () => {
                console.log('WebSocket connected! (visualization active)');
                this.isWsConnected = true;
            };

            this.websocket.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    this.handleVisualizationData(event.data);
                }
            };

            this.websocket.onerror = () => {
                console.log('WebSocket not available (it is not a problem!)');
            };

            this.websocket.onclose = () => {
                this.isWsConnected = false;
            };
        } catch (e) {
            console.log('WebSocket not available (it is not a problem!)');
        }
    }

    handleVisualizationData(arrayBuffer) {
        const floatData = new Float32Array(arrayBuffer);
        for (let i = 0; i < floatData.length && i < this.vizBuffer.length; i++) {
            this.vizBuffer[(this.vizIndex + i) % this.vizBuffer.length] = floatData[i];
        }
        this.vizIndex = (this.vizIndex + floatData.length) % this.vizBuffer.length;
    }

    startVisualization() {
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            const ctx = this.canvasContext;
            const width = this.canvas.width;
            const height = this.canvas.height;

            ctx.fillStyle = '#F5F5DC';
            ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#4A90E2';
            ctx.beginPath();

            const bufferLength = this.vizBuffer.length;
            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const idx = (this.vizIndex + i) % bufferLength;
                const v = this.vizBuffer[idx];
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

    async stop() {
        try {
            console.log('Sending STOP command...');
            
            const response = await fetch(`${this.httpUrl}/stop`, {
                method: 'POST'
            });
            
            const data = await response.json();
            console.log('STOP confirmed:', data.message);
            
            this.isPlaying = false;

        } catch (error) {
            console.error('Stop error:', error);
        }

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

        this.drawEmptyWaveform();

        // Update UI
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.clearLoopButton.disabled = true;
        this.clearAmbienceButton.disabled = true;
        
        if (this.isRecording) {
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }

    async toggleRecording() {
        if (!this.isPlaying) {
            alert('Start the audio first!');
            return;
        }
        
        try {
            if (this.isRecording) {
                const response = await fetch(`${this.httpUrl}/stop_rec`, {
                    method: 'POST'
                });
                const data = await response.json();
                console.log('Recording stop:', data);
                this.isRecording = false;
            } else {
                const response = await fetch(`${this.httpUrl}/start_rec`, {
                    method: 'POST'
                });
                const data = await response.json();
                console.log('Recording start:', data);
                this.isRecording = true;
            }
            this.updateRecordingUI();
        } catch (error) {
            console.error('Recording error:', error);
        }
    }
    
    updateRecordingUI() {
        if (this.isRecording) {
            this.recordButton.classList.add('recording');
            this.recordButton.innerHTML = 'Recording';
        } else {
            this.recordButton.classList.remove('recording');
            this.recordButton.innerHTML = 'Record Loop';
        }
    }
    
    async clearLoops() {
        try {
            await fetch(`${this.httpUrl}/clear_loops`, {
                method: 'POST'
            });
            console.log('Loops cleared');
        } catch (error) {
            console.error('Error:', error);
        }
    }
    
    async clearAmbience() {
        try {
            await fetch(`${this.httpUrl}/clear_ambient`, {
                method: 'POST'
            });
            console.log('Ambience cleared');
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const controller = new LiveAudioController();
});
