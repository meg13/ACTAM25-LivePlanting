const knob = document.querySelector('.knob');
const knobOuter = document.querySelector('.knob-outer');
const genreLabels = document.querySelectorAll('.genre-label');

let isDragging = false;
let previousAngle = 0;
let totalRotation = 0;

knob.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    previousAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    // Calcola la differenza gestendo il passaggio da 180 a -180
    let delta = currentAngle - previousAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    totalRotation += delta;
    previousAngle = currentAngle;
    
    // Snap alle 4 posizioni (ogni 90 gradi)
    const snapAngle = Math.round(totalRotation / 90) * 90;
    knobOuter.style.transform = `rotate(${snapAngle}deg)`;
    
    // Update genere attivo
    let genreIndex = ((Math.round(totalRotation / 90) % 4) + 4) % 4;
    
    genreLabels.forEach((label, idx) => {
        label.classList.toggle('active', idx === genreIndex);
    });
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});