class SimpleCow {
    // Palette di colori condivisa tra tutte le mucche
    static colorPalettes = [
        { body: '#A6561B', details: '#854516' },
        { body: '#4B3627', details: '#5D4A3D' },
        { body: '#F5D09F', details: '#D3A463' },
        { body: '#A0826D', details: '#8B6F5E' }
    ];
    static colorIndex = 0;

    constructor() {
        this.element = null;

        // Assegna i colori a giro
        this.colors = SimpleCow.colorPalettes[SimpleCow.colorIndex];
        SimpleCow.colorIndex = (SimpleCow.colorIndex + 1) % SimpleCow.colorPalettes.length;

        // Calcola l'area valida evitando il nav
        const nav = document.querySelector('nav');
        const navWidth = nav ? nav.offsetWidth + 20 : 150;
        const maxX = window.innerWidth - navWidth - 80;

        // Posiziona le mucche solo nell'area del prato
        this.x = Math.random() * maxX;
        this.y = Math.random() * (window.innerHeight - 250) + 150;
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.direction = this.vx > 0 ? 1 : -1;
        this.paused = false;
        this.pauseTimer = 0;

        this.create();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'walking-cow';
        this.element.innerHTML = `
            <svg width="80" height="64" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 22C0 18.6863 2.68629 16 6 16H58C61.3137 16 64 18.6863 64 22V58C64 61.3137 61.3137 64 58 64H6C2.68629 64 0 61.3137 0 58V22Z" fill="${this.colors.body}"/>
                <path d="M32 6C32 2.68629 34.6863 0 38 0H66C69.3137 0 72 2.68629 72 6V34C72 37.3137 69.3137 40 66 40H38C34.6863 40 32 37.3137 32 34V6Z" fill="${this.colors.body}"/>
                <rect width="16" height="16" transform="translate(64 16)" fill="${this.colors.details}"/>
                <path d="M68 20C68 17.7909 69.7909 16 72 16C74.2091 16 76 17.7909 76 20C76 22.2091 74.2091 24 72 24C69.7909 24 68 22.2091 68 20Z" fill="white"/>
                <path d="M56 12C56 9.79086 57.7909 8 60 8C62.2091 8 64 9.79086 64 12C64 14.2091 62.2091 16 60 16C57.7909 16 56 14.2091 56 12Z" fill="black"/>
                <path d="M64 10C64 8.89543 64.8954 8 66 8C67.1046 8 68 8.89543 68 10C68 11.1046 67.1046 12 66 12C64.8954 12 64 11.1046 64 10Z" fill="white"/>
                <rect width="12" height="12" transform="translate(36)" fill="${this.colors.details}"/>
                <rect width="12" height="12" transform="translate(8 52)" fill="${this.colors.details}"/>
                <rect width="12" height="12" transform="translate(28 52)" fill="${this.colors.details}"/>
            </svg>
        `;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.transform = `scaleX(${this.direction})`;
        document.body.appendChild(this.element);
    }
    
    update() {
        // Pausa casuale
        if (this.paused) {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this.paused = false;
                this.vx = (Math.random() - 0.5) * 1.2;
                this.vy = (Math.random() - 0.5) * 0.3;
                this.direction = this.vx > 0 ? 1 : -1;
            }
            return;
        }

        if (Math.random() < 0.01) {
            this.paused = true;
            this.pauseTimer = Math.random() * 100 + 50;
            return;
        }

        // Muove la mucca
        this.x += this.vx;
        this.y += this.vy;

        // Calcola il margine destro in base al nav
        const nav = document.querySelector('nav');
        const navWidth = nav ? nav.offsetWidth + 20 : 150; // 40px per margine extra

        // Rimbalzo dolce sui bordi orizzontali
        if (this.x < 0) {
            this.x = 0;
            this.vx *= -1;
        } else if (this.x > window.innerWidth - navWidth - 80) {
            this.x = window.innerWidth - navWidth - 80;
            this.vx *= -1;
        }

        // Rimbalzo dolce sui bordi verticali
        if (this.y < 100) {
            this.y = 100;
            this.vy *= -1;
        } else if (this.y > window.innerHeight - 150) {
            this.y = window.innerHeight - 150;
            this.vy *= -1;
        }
        
        // Cambio direzione casuale
        if (Math.random() < 0.02) {
            this.vx += (Math.random() - 0.5) * 0.3;
            this.vy += (Math.random() - 0.5) * 0.2;
            
            const maxSpeed = 1.5;
            if (Math.abs(this.vx) > maxSpeed) this.vx = maxSpeed * Math.sign(this.vx);
            if (Math.abs(this.vy) > maxSpeed * 0.3) this.vy = maxSpeed * 0.3 * Math.sign(this.vy);
        }
        
        if (this.vx !== 0) {
            this.direction = this.vx > 0 ? 1 : -1;
        }
        
        // Aggiorna posizione
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.transform = `scaleX(${this.direction})`;
    }
}

const cows = [];

function initCows(count = 5) {
    for (let i = 0; i < count; i++) {
        cows.push(new SimpleCow());
    }
}

function animateCows() {
    cows.forEach(cow => cow.update());
    requestAnimationFrame(animateCows);
}

window.addEventListener('load', () => {
    initCows(5); // Cambia il numero qui per più o meno mucche
    animateCows();
});

window.addEventListener('resize', () => {
    cows.forEach(cow => {
        if (cow.x > window.innerWidth) {
            cow.x = window.innerWidth - 100;
        }
        if (cow.y > window.innerHeight) {
            cow.y = window.innerHeight - 100;
        }
    });
});