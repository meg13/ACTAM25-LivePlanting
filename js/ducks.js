class SimpleDuck {
    constructor() {
        this.element = null;

        // Calcola l'area valida evitando il nav
        const nav = document.querySelector('nav');
        const navWidth = nav ? nav.offsetWidth + 20 : 150;
        const maxX = window.innerWidth - navWidth - 80;

        // Posiziona le papere solo nell'area del prato
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
        this.element.className = 'walking-duck';
        this.element.innerHTML = '<img src="../images/duck.svg" alt="Duck" width="80" height="80">';
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

        // Muove la papera
        this.x += this.vx;
        this.y += this.vy;

        // Calcola il margine destro in base al nav
        const nav = document.querySelector('nav');
        const navWidth = nav ? nav.offsetWidth + 20 : 150; // 40px per margine extra

        // Rimbalzo sui bordi orizzontali
        if (this.x < 0) {
            this.x = 0;
            this.vx *= -1;
        } else if (this.x > window.innerWidth - navWidth - 80) {
            this.x = window.innerWidth - navWidth - 80;
            this.vx *= -1;
        }

        // Rimbalzo sui bordi verticali
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

const ducks = [];

function initDucks(count = 5) {
    for (let i = 0; i < count; i++) {
        ducks.push(new SimpleDuck());
    }
}

function animateDucks() {
    ducks.forEach(duck => duck.update());
    requestAnimationFrame(animateDucks);
}

window.addEventListener('load', () => {
    initDucks(5); // Cambia il numero qui per più o meno papere
    animateDucks();
});

window.addEventListener('resize', () => {
    ducks.forEach(duck => {
        if (duck.x > window.innerWidth) {
            duck.x = window.innerWidth - 100;
        }
        if (duck.y > window.innerHeight) {
            duck.y = window.innerHeight - 100;
        }
    });
});