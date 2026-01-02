const flowerPositions = [];

function checkCollision(x, y, flowerSize, padding = 5) {
  // collision with other flowers
  for (let flower of flowerPositions) {
    const distance = Math.sqrt(
      Math.pow(x - flower.x, 2) + Math.pow(y - flower.y, 2)
    );
    if (distance < flowerSize + padding) {
      return true;
    }
  }
  return false;
}

function getRandomPosition(flowerSize, maxAttempts = 50) {
  const maxX = window.innerWidth - flowerSize;
  const maxY = window.innerHeight - flowerSize;

  // get position and dimension of audio container
  const audioContainer = document.querySelector('.audio-container');
  let audioContainerRect = null;
  if (audioContainer) {
    audioContainerRect = audioContainer.getBoundingClientRect();
  }

  // get position and dimension of plant image
  const plantImage = document.querySelector('.plant-image');
  let plantImageRect = null;
  if (plantImage) {
    plantImageRect = plantImage.getBoundingClientRect();
  }

  // get position and dimension of sound management
  const soundManagement = document.querySelector('.sound-management');
  let soundManagementRect = null;
  if (soundManagement) {
    soundManagementRect = soundManagement.getBoundingClientRect();
  }

  // get position and dimension of nav bar
  const navBar = document.querySelector('#nav-container');
  let navRect = null;
  if (navBar) {
    navRect = navBar.getBoundingClientRect();
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;

    // collision with other flowers
    if (checkCollision(x, y, flowerSize)) {
      continue;
    }

    // collision with audio container
    if (audioContainerRect && x < audioContainerRect.right && x + flowerSize > audioContainerRect.left &&
        y < audioContainerRect.bottom && y + flowerSize > audioContainerRect.top) {
      continue;
    }

    // collision with sound management
    if (soundManagementRect && x < soundManagementRect.right && x + flowerSize > soundManagementRect.left &&
        y < soundManagementRect.bottom && y + flowerSize > soundManagementRect.top) {
      continue;
    }

    // collision with nav bar 
    if (navRect && x < navRect.right && x + flowerSize > navRect.left &&
        y < navRect.bottom && y + flowerSize > navRect.top) {
      continue;
    }

    // collision with plant image 
    if (plantImageRect && x < plantImageRect.right && x + flowerSize > plantImageRect.left &&
        y < plantImageRect.bottom && y + flowerSize > plantImageRect.top) {
      continue;
    }

    return { x, y };
  }

  return null;
}

function addFlowerItem() {
  const flower = document.createElement("div");
  flower.classList.add("bg-flower");
  flower.style.position = "absolute";

  const flowerSize = 30;

  const position = getRandomPosition(flowerSize);

  if (!position) {
    console.warn("The flower could not be added: insufficient space");
    return;
  }

  flower.style.left = position.x + "px";
  flower.style.top = position.y + "px";

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

// Wait for DOM to be loaded and nav to be created
document.addEventListener('DOMContentLoaded', () => {
  for (let i = 0; i < 10; i++) {
    addFlowerItem();
  }
});
