function addGrassItem() {
  const e = document.createElement("div");
  e.classList.add("grass");

  const maxX = window.innerWidth;
  const maxY = window.innerHeight;
  e.style.position = "absolute";
  e.style.left = Math.random() * maxX + "px";
  e.style.top  = Math.random() * maxY + "px";

  const color = Math.round(Math.random());
  (color === 0) ? e.classList.add("grass_dark") : e.classList.add("grass_light");

  const size = Math.random() * 20 + 20; // [20, 150)
  e.style.width  = size + "px";
  e.style.height = size + "px";

  document.body.appendChild(e);
}


for(i=0; i<20; i++){
    addGrassItem()
}