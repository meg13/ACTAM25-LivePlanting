const navItems = [
  {
    href: 'homepage.html',
    label: 'home',
    id: 'home'
  },
  {
    href: 'live_listening.html',
    label: 'live listening',
    id: 'listening'
  },
  {
    href: 'codes.html',
    label: 'code',
    id: 'code'
  },
  {
    href: 'concept.html',
    label: 'concept',
    id: 'concept'
  }
];

function createFlower(id) {
  const flowerDiv = document.createElement('div');
  flowerDiv.className = 'menu-flower';
  flowerDiv.id = `${id}-flower`;
  const petals = [
    { class: 'petal petal-top' },
    { class: 'petal-front-top' },
    { class: 'petal petal-right' },
    { class: 'petal-front-right' },
    { class: 'petal petal-bottom' },
    { class: 'petal-front-bottom' },
    { class: 'petal petal-left' },
    { class: 'petal-front-left' }
  ];
  petals.forEach(petal => {
    const div = document.createElement('div');
    div.className = petal.class;
    flowerDiv.appendChild(div);
  });
  const center = document.createElement('div');
  center.className = 'flower-center';
  flowerDiv.appendChild(center);
  return flowerDiv;
} 

function createNavButton(label, id) {
  const buttonDiv = document.createElement('div');
  buttonDiv.className = 'nav-button';
  buttonDiv.id = `${id}-button`;
  buttonDiv.textContent = label;
  return buttonDiv;
} 

function createNavElement(item) {
  const link = document.createElement('a');
  link.href = item.href;
  link.className = 'nav-element';
  link.id = `nav-${item.id}`;
  link.appendChild(createFlower(item.id));
  link.appendChild(createNavButton(item.label, item.id));
  return link;
} 

function initializeNav() {
  let navContainer = document.getElementById('nav-container');
  if (!navContainer) {
    navContainer = document.createElement('nav');
    navContainer.id = 'nav-container';
    document.body.appendChild(navContainer);
  }

  navItems.forEach(item => {
    navContainer.appendChild(createNavElement(item));
  });

  // Branch SVG
  const img = document.createElement('img');
  img.src = '../images/branch.svg';
  img.id = 'branch-svg';
  navContainer.appendChild(img);
} 

document.addEventListener('DOMContentLoaded', initializeNav);
