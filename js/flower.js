// Array per tracciare le posizioni dei fiori
const flowerPositions = [];

function checkCollision(x, y, flowerSize, padding = 5) {
  // Verifica se la posizione collide con fiori esistenti
  for (let flower of flowerPositions) {
    const distance = Math.sqrt(
      Math.pow(x - flower.x, 2) + Math.pow(y - flower.y, 2)
    );
    // Se la distanza è minore della somma dei raggi + padding, c'è collisione
    if (distance < flowerSize + padding) {
      return true;
    }
  }
  return false;
}

function getRandomPosition(flowerSize, maxAttempts = 50) {
  const maxX = window.innerWidth - flowerSize;
  const maxY = window.innerHeight - flowerSize;
  
  // Tenta di trovare una posizione valida fino a maxAttempts volte
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    
    // Se non c'è collisione, ritorna questa posizione
    if (!checkCollision(x, y, flowerSize)) {
      return { x, y };
    }
  }
  
  // Se non trova posizione dopo maxAttempts, ritorna null
  return null;
}

function addFlowerItem() {
  const flower = document.createElement("div");
  flower.classList.add("bg-flower");
  flower.style.position = "absolute";

  const flowerSize = 30; // larghezza/altezza del contenitore .bg-flower

  // Cerca una posizione libera
  const position = getRandomPosition(flowerSize);
  
  if (!position) {
    console.warn("Non riesco a posizionare il fiore: spazio insufficiente");
    return; // Non aggiunge il fiore se non trova spazio
  }

  flower.style.left = position.x + "px";
  flower.style.top = position.y + "px";

  // Memorizza la posizione
  flowerPositions.push({
    x: position.x,
    y: position.y,
    element: flower
  });

  const petalTop = document.createElement("div");
  const petalRight = document.createElement("div");
  const petalBottom = document.createElement("div");
  const petalLeft = document.createElement("div");
  const flowerCenter = document.createElement("div");

  petalTop.classList.add("petal", "petal-top");
  petalRight.classList.add("petal", "petal-right");
  petalBottom.classList.add("petal", "petal-bottom");
  petalLeft.classList.add("petal", "petal-left");
  flowerCenter.classList.add("flower-center");

  flower.appendChild(petalTop);
  flower.appendChild(petalRight);
  flower.appendChild(petalBottom);
  flower.appendChild(petalLeft);
  flower.appendChild(flowerCenter);

  document.body.appendChild(flower);
}

// Aggiunge 10 fiori senza sovrapposizioni
for (let i = 0; i < 10; i++) {
  addFlowerItem();
}