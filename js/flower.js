function addFlowerItem() {
  const flower = document.createElement("div");
  flower.classList.add("bg-flower");
  flower.style.position = "absolute";

  const flowerSize = 30; // larghezza/altezza del contenitore .bg-flower
  const maxX = window.innerWidth  - flowerSize;
  const maxY = window.innerHeight - flowerSize;

  const x = Math.random() * maxX;
  const y = Math.random() * maxY;

  flower.style.left = x + "px";
  flower.style.top  = y + "px";

  const petalTop    = document.createElement("div");
  const petalRight  = document.createElement("div");
  const petalBottom = document.createElement("div");
  const petalLeft   = document.createElement("div");
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

for (let i = 0; i < 10; i++) {
  addFlowerItem();
}
