const knob = document.querySelector('.knob');
const knobOuter = document.querySelector('.knob-outer');
const genreLabels = document.querySelectorAll('.genre-label');

const genreAngles = [0, 90, 180, 270]; // POP, ROCK, JAZZ, CLASSIC
let currentAngle = 0;
let currentGenreIndex = 0;

genreLabels.forEach((label, index) => {
    label.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetAngle = genreAngles[index];
        
        // Normalizza currentAngle tra 0-360
        const normalizedCurrent = ((currentAngle % 360) + 360) % 360;
        
        // Calcola la differenza
        let diff = targetAngle - normalizedCurrent;
        
        // Trova il percorso più breve
        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }
        
        // Aggiorna l'angolo corrente
        currentAngle += diff;
        currentGenreIndex = index;
        
        // Ruota il knob
        knobOuter.style.transform = `rotate(${currentAngle}deg)`;
        
        // Aggiorna la classe active
        genreLabels.forEach(lbl => lbl.classList.remove('active'));
        label.classList.add('active');
    });
});

knob.addEventListener('click', (e) => {
    console.log('Knob clicked!'); // Per verificare se l'evento viene catturato
    
    currentGenreIndex = (currentGenreIndex + 1) % 4;
    currentAngle += 90;
    
    knobOuter.style.transform = `rotate(${currentAngle}deg)`;
    
    genreLabels.forEach((lbl, idx) => {
        lbl.classList.toggle('active', idx === currentGenreIndex);
    });
});
