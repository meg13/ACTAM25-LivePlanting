class SimpleCow {
    constructor() {
        this.element = null;

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
        this.element.innerHTML = `<img src="../images/cow.svg" alt="cow">`;
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