
window.onload = () => {
  const profilePic = document.getElementById("my-profile");

  // 👇 Use the correct image ID stored in DB
  const imageId = 1;

  profilePic.src = `/file/1`;  // sets image source to the GET endpoint
};


 document.addEventListener("DOMContentLoaded", () => {
    const marqueeTrack = document.querySelector(".marquee-track");
    const skills = document.querySelector("#tech-skills");
    const clone = skills.cloneNode(true); // deep clone
    marqueeTrack.appendChild(clone);
  });

const rainCanvas = document.getElementById("rainCanvas");
const rainCtx = rainCanvas.getContext("2d");

let w = (rainCanvas.width = window.innerWidth);
let h = (rainCanvas.height = window.innerHeight);

const raindrops = [];

for (let i = 0; i < 200; i++) {
  raindrops.push({
    x: Math.random() * w,
    y: Math.random() * h,
    length: Math.random() * 20 + 10,
    speed: Math.random() * 4 + 4,
  });
}

let phase = 'rain'; // 'rain', 'rain-light', 'snow'
let startTime = Date.now();

function drawRain() {
  rainCtx.clearRect(0, 0, w, h);

  rainCtx.beginPath();
  rainCtx.strokeStyle = phase === 'snow' ? "rgba(255, 255, 255, 0.8)" : "rgba(153, 186, 64, 0.5)";
  rainCtx.lineWidth = 1;

  for (let drop of raindrops) {
    rainCtx.moveTo(drop.x, drop.y);
    rainCtx.lineTo(drop.x, drop.y + drop.length);
  }

  rainCtx.stroke();
  moveRain();
}

function moveRain() {
  for (let drop of raindrops) {
    drop.y += drop.speed;

    if (drop.y > h) {
      drop.y = 0;
      drop.x = Math.random() * w;

      if (phase === 'snow') {
        drop.length = 2 + Math.random() * 2;
        drop.speed = 0.5 + Math.random() * 1;
      }
    }
  }
}

function updatePhase() {
  const timePassed = (Date.now() - startTime) / 1000;

  if (timePassed > 7 && timePassed <= 12) {
    phase = 'rain-light';
    raindrops.forEach((drop) => {
      drop.length = 5 + Math.random() * 5;
      drop.speed = 2 + Math.random() * 1.5;
    });
  } else if (timePassed > 12 && timePassed <= 14) {
    phase = 'snow-transition';
  } else if (timePassed > 14) {
    phase = 'snow';
    raindrops.forEach((drop) => {
      drop.length = 2 + Math.random() * 2;
      drop.speed = 0.5 + Math.random() * 1;
    });
  }
}

function animateRain() {
  updatePhase();
  drawRain();
  requestAnimationFrame(animateRain);
}

animateRain();


function toggleMenu() {
  const menu = document.getElementById("menu-content");
  const sections = document.querySelectorAll(".menu-options");

  menu.classList.toggle("show");

 
}

// progess bars

const circularProgress = document.querySelectorAll(".circular-progress");

circularProgress.forEach((progressBar) => {
  const progressValue = progressBar.querySelector(".percentage");
  const innerCircle = progressBar.querySelector(".inner-circle");
  const endValue = Number(progressBar.getAttribute("data-percentage"));
  const progressColor = progressBar.getAttribute("data-progress-color");
  const bgColor = progressBar.getAttribute("data-bg-color");
  const innerColor = progressBar.getAttribute("data-inner-circle-color");

  let startValue = 0;
  const speed = 20;

  innerCircle.style.backgroundColor = innerColor;

  const progress = setInterval(() => {
    startValue++;
    const angle = startValue * 3.6;
    progressBar.style.background = `conic-gradient(${progressColor} ${angle}deg, ${bgColor} 0deg)`;
    progressValue.textContent = `${startValue}%`;
    progressValue.style.color = progressColor;

    if (startValue === endValue) clearInterval(progress);
  }, speed);
});



const switcher = document.getElementById('darkModeSwitch');

switcher.addEventListener('change', () => {
  const enableLight = switcher.checked;

  const elements = [
    document.body,
    document.querySelector('header'),
    document.querySelector('footer'),
    document.getElementById('menu-content'),
    document.getElementById('Content-wrapper'),
    document.querySelector('.menu-button'),
    document.getElementById('download-button'),
    document.getElementById('my-profile'),
    document.querySelector('.tech-marquee'),
    document.querySelector('h1'),
    document.querySelector('h2'),
    document.querySelector('.marquee-track'),
    document.getElementById('dropdown-menu'),
    document.querySelector('footer'),
    document.querySelector('body'),
    // ...document.querySelectorAll('h2'),
    ...document.getElementsByTagName('h2'),
    ...document.querySelectorAll('.skill-item'),
    ...document.querySelectorAll('.skills-grid'),
    ...document.querySelectorAll('.menu-Elements'),
    ...document.querySelectorAll('.cert-box'),
    ...document.querySelectorAll('.btn'),
    ...document.querySelectorAll('.cert-box'),
    ...document.querySelectorAll('.menu-options'),
    ...document.querySelectorAll('.circular-progress'),
    document.querySelector('.cert-boxes'),
  ];

  elements.forEach(el => {
    if (el) {
      document.getElementById('contact')?.classList.toggle('light-mode', enableLight);
      document.getElementById('contact')?.classList.toggle('dark-mode', !enableLight);

      el.classList.toggle('light-mode', enableLight);
      el.classList.toggle('dark-mode', !enableLight);
    }
  });
});


let isMenuOpen = false;

function toggleMenu(button) {
  const menu = document.getElementById('menu-content');
  isMenuOpen = !isMenuOpen;

  menu.classList.toggle('show', isMenuOpen);
  button.classList.toggle('rotated', isMenuOpen);

  if (isMenuOpen) {
    document.addEventListener('click', handleOutsideClick);
  } else {
    document.removeEventListener('click', handleOutsideClick);
  }

  function handleOutsideClick(event) {
    const isClickInside = menu.contains(event.target) || button.contains(event.target);
    if (!isClickInside) {
      menu.classList.remove('show') ;
      button.classList.remove('rotated');
      isMenuOpen = false;
      document.removeEventListener('click', handleOutsideClick);
    }
  }
}

    // === FADE CONTENT ON SCROLL ===
    const contentWrapper = document.getElementById('contentWrapper');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        contentWrapper.classList.add('fade-out');
      } else {
        contentWrapper.classList.remove('fade-out');
      }
    });



document.getElementById("contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = {
      name: e.target.name.value,
      email: e.target.email.value,
      message: e.target.message.value
    };
    const res = await fetch("https://your-backend.onrender.com/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    document.getElementById("statusMsg").textContent = data.success ? "Message Sent!" : "Error sending message";
  });




