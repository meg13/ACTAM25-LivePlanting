class SimpleDuck {
    constructor() {
        this.element = null;
        // Calculate the valid area avoiding the nav
        const nav = document.querySelector('nav');
        const navWidth = nav ? nav.offsetWidth + 20 : 150;
        const maxX = window.innerWidth - navWidth - 80;

        // Detect the START button to avoid it
        const startButton = document.querySelector('.startButton');
        let buttonRect = null;
        if (startButton) {
            buttonRect = startButton.getBoundingClientRect();
        }

        // Positioning the ducks in the grass area avoiding the START button
        let x, y;
        do {
            x = Math.random() * maxX;
            y = Math.random() * (window.innerHeight - 250) + 150;
        } while (
            buttonRect &&
            x < buttonRect.right + 20 &&
            x + 70 > buttonRect.left - 20 &&
            y < buttonRect.bottom + 20 &&
            y + 54 > buttonRect.top - 20
        );

        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2.0;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.direction = this.vx > 0 ? 1 : -1;
        this.paused = false;
        this.pauseTimer = 0;
        // Initialize jump variables
        this.jumping = false;
        this.jumpTimer = 0;
        this.jumpHeight = 20;
        this.startY = this.y; // Save the starting Y position
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
    // Random pause
    if (this.paused) {
        this.pauseTimer--;
        if (this.pauseTimer <= 0) {
            this.paused = false;
            this.vx = (Math.random() - 0.5) * 1.2;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.direction = this.vx > 0 ? 1 : -1;
            return;
        }
    }

    // Random jump
    if (!this.jumping && Math.random() < 0.005) {
        this.jumping = true;
        this.jumpTimer = 10;
        this.startY = this.y;
    }

    if (this.jumping) {
        this.y = this.startY - this.jumpHeight;
        this.jumpTimer--;
        if (this.jumpTimer <= 0) {
            this.jumping = false;
            this.y = this.startY;
        }
    }

    // Move the duck
    this.x += this.vx;
    this.y += this.vy;

    // Calculate the right margin based on the nav
    const nav = document.querySelector('nav');
    const navWidth = nav ? nav.offsetWidth + 20 : 150;

    // Bounce off horizontal borders
    if (this.x < 0) {
        this.x = 0;
        this.vx *= -1;
    } else if (this.x > window.innerWidth - navWidth - 80) {
        this.x = window.innerWidth - navWidth - 80;
        this.vx *= -1;
    }

    // Bounce off vertical borders
    if (this.y < 100) {
        this.y = 100;
        this.vy *= -1;
    } else if (this.y > window.innerHeight - 150) {
        this.y = window.innerHeight - 150;
        this.vy *= -1;
    }

    const startButton = document.querySelector('.startButton');
    let buttonRect = null;
    if (startButton) {
        buttonRect = startButton.getBoundingClientRect();
    }

    if (buttonRect) {
        const margin = 20;
        const cowElement = this.element;
        const cowWidth = cowElement ? cowElement.offsetWidth : 70;
        const cowHeight = cowElement ? cowElement.offsetHeight : 54;

        if (this.x + cowWidth > buttonRect.left - margin &&
            this.x < buttonRect.right + margin &&
            this.y + cowHeight > buttonRect.top - margin &&
            this.y < buttonRect.bottom + margin) {

            const fromLeft = this.x + cowWidth / 2 < buttonRect.left;
            const fromRight = this.x + cowWidth / 2 > buttonRect.right;
            const fromTop = this.y + cowHeight / 2 < buttonRect.top;
            const fromBottom = this.y + cowHeight / 2 > buttonRect.bottom;

            if (fromLeft || fromRight) {
                this.vx *= -1;
                if (fromLeft) {
                    this.x = buttonRect.left - cowWidth - margin;
                } else {
                    this.x = buttonRect.right + margin;
                }
            }

            if (fromTop || fromBottom) {
                this.vy *= -1;
                if (fromTop) {
                    this.y = buttonRect.top - cowHeight - margin;
                } else {
                    this.y = buttonRect.bottom + margin;
                }
            }
        }
    }

    // Random direction change
    if (Math.random() < 0.02) {
        this.vx += (Math.random() - 0.5) * 0.4;
        this.vy += (Math.random() - 0.5) * 0.2;
        const maxSpeed = 1.5;
        if (Math.abs(this.vx) > maxSpeed) this.vx = maxSpeed * Math.sign(this.vx);
        if (Math.abs(this.vy) > maxSpeed * 0.3) this.vy = maxSpeed * 0.3 * Math.sign(this.vy);
    }

    if (this.vx !== 0) {
        this.direction = this.vx > 0 ? 1 : -1;
    }

    // Update duck position
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
    initDucks(5); // Change the number here for more or fewer ducks
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