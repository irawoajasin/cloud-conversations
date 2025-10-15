let clouds = [];
let cloudDensity = 0.2; // 0–1, controlled by weather data
const NYC = { lat: 40.7128, lon: -74.0060 };
const API_KEY = '73505328a5e9867fe267ccaae1c52fbf';
let lastFetch = 0;
let overlayText;
const texts = [
  "The city dreams under soft skies.",
  "Clouds drift quietly above.",
  "Hidden light, whispered winds.",
  "The sky is a canvas today.",
  "Somewhere above, the sun waits."
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  overlayText = document.getElementById('text');
  for (let i = 0; i < 100; i++) {
    clouds.push(new Cloud());
  }
  fetchCloudData(); // initial
}

function draw() {
  background(30, 30, 40);
  
  for (let c of clouds) {
    c.update();
    c.show();
  }
  
  // Re-fetch every 5 minutes
  if (millis() - lastFetch > 5 * 60 * 1000) {
    fetchCloudData();
  }

}

async function fetchCloudData() {
  lastFetch = millis();
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${NYC.lat}&lon=${NYC.lon}&appid=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      const coverage = data.clouds ? data.clouds.all : 0;
      cloudDensity = coverage / 100; // convert to 0–1
      handleText(coverage);
    })
    .catch(err => console.error(err));
}

function handleText(coverage) {
  if (coverage > 50) {
    const msg = texts[Math.floor(Math.random() * texts.length)];
    overlayText.innerText = msg;
    overlayText.classList.add('show');
  } else {
    overlayText.classList.remove('show');
  }
}

class Cloud {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = random(width);
    this.y = random(height);
    this.r = random(100, 300);
    this.speed = random(0.2, 1);
    this.opacity = random(80, 180);
  }

  update() {
    this.x += this.speed * (0.5 + cloudDensity);
    if (this.x - this.r > width) {
      this.x = -this.r;
      this.y = random(height);
    }
  }

  show() {
    fill(255, 255, 255, this.opacity * cloudDensity);
    ellipse(this.x, this.y, this.r);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
