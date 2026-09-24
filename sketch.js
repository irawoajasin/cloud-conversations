let state = 0;              // 0 = idle, 1 = intro, 2 = poem

let activeSequence = [];
let activeSequenceIndex = 0;
let sequenceRunId = 0;
let sequenceFallbackTimer = null;

let spaceHeld = false;

// debug
const VIDEOS_ENABLED = true;

// ---------------------------------------------------------------
// DATA CENTERS
// ---------------------------------------------------------------
const dataCenters = [
  {
    name: "West End Data Center",
    city: "713 Ralph David Abernathy Blvd., Atlanta, GA",
    lat: 33.7383, lon: -84.4321,
    image: "assets/img/dlr-website_Tier 1 - Data in Everything_Atlanta-Site-Plan-Image_r0hfyp-dithered.jpg",
    forecast: [
      "Power: 30 megawatts proposed",
      "Water: ~100,000 gallons/day proposed",
      "Size: 282,000 square feet",
      "Community vote: 105–87 against zoning change",
      "Neighborhood: ~250 ft from West End MARTA station",
    ]
  },

  {
    name: "Colossus",
    city: "Boxtown, South Memphis, TN",
    lat: 35.0455, lon: -90.0520,
    image: "assets/img/colossus-dithered.jpg",
    forecast: [
      "Power: 1.2 GW permanent plant",
      "Water: up to 13 million gallons/day",
      "Air: Clean Air Act lawsuit over turbine emissions",
      "Public hearing: 200+ residents gathered",
      "Income: median household income ≈ $37,000"
    ]
  },

  {
    name: "Hyperion",
    city: "Richland Parish, LA",
    lat: 32.5384, lon: -91.8496,
    image: "assets/img/parish-dithered.jpg",
    forecast: [
      "Investment: $50+ billion",
      "Size: nearly 10 million square feet",
      "Power: 5 gigawatts of IT capacity",
      "Land: 2,250+ acres",
      "Construction: 7,500+ jobs at peak",
    ]
  }
];

let chosenDataCenter = null;
let siteWeather = {};
const dcImages = {};

// ---------------------------------------------------------------
// LOCAL CLOUD VIDEOS 
// ---------------------------------------------------------------
const VIDEO_CATEGORIES = {
  clear:     ["assets/video/clear/clear1.mp4", "assets/video/clear/clear2.mp4"],
  scattered: ["assets/video/scattered/scattered1.mp4", "assets/video/scattered/scattered2.mp4", "assets/video/scattered/scattered3.mp4"],
  cloudy:    ["assets/video/cloudy/cloudy1.mp4", "assets/video/cloudy/cloudy2.mp4", "assets/video/cloudy/cloudy3.mp4"],
  rainy:     ["assets/video/rainy/rainy1.mp4"]
};

let activeVideo = null;
let currentBucket = null;
let videoToken = 0;

function setVideoForSite(site) {
  if (!VIDEOS_ENABLED) return;
  const bucket = getWeatherBucket(siteWeather[site.name]);
  if (bucket === currentBucket && activeVideo) return;
  currentBucket = bucket;

  const pool = VIDEO_CATEGORIES[bucket] || VIDEO_CATEGORIES.cloudy;
  const path = random(pool);
  const token = ++videoToken;

  const incoming = createVideo(path, () => {
    if (token !== videoToken) { incoming.remove(); return; } // a newer request
    incoming.elt.muted = true;   // muted attribute is needed for autoplay
    incoming.volume(0);
    incoming.loop();
    const old = activeVideo;
    activeVideo = incoming;
    if (old) { old.stop(); old.remove(); }
  });
  incoming.hide();
}

// draw the video scaled to fill the screen without stretching (crops the overflow)
function drawCoverVideo(v) {
  const vw = v.elt.videoWidth, vh = v.elt.videoHeight;
  if (!vw || !vh) { image(v, 0, 0, width, height); return; }
  const s = max(width / vw, height / vh);
  const dw = vw * s, dh = vh * s;
  image(v, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

let idleCycleInterval = 9000;
let idleTimer = 0;

// arduino
let serial;
let latestData = "waiting for data";
let phoneState = "down";
let lastPhoneChange = 0;
const PHONE_DEBOUNCE = 300;

const API_KEY = "hu7hzltc9pw9axpzy0j7jrl4ws040i21rm8v0jl6"; 

async function fetchWeather(site) {
  let url = `https://www.meteosource.com/api/v1/free/point?lat=${site.lat}&lon=${site.lon}&sections=current&units=us&language=en&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const current = json.current;

    siteWeather[site.name] = {
      temp: current.temperature,
      weather: current.summary,
      windSpeed: current.wind.speed,
      cloudCondition: current.cloud_cover
    };

    return siteWeather[site.name];
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

// fetch only; the video is set once afterwards (one player, not one per site)
async function refreshAllSiteWeather() {
  for (let site of dataCenters) {
    await fetchWeather(site);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Arial");
  fill(255);

  // data center photos
  for (const dc of dataCenters) {
    loadImage(dc.image,
      img => { dcImages[dc.name] = img; },
      () => console.warn("Missing image:", dc.image));
  }

  serial = new p5.SerialPort();

  serial.on("connected", () => console.log("Serial server connected"));
  serial.on("list", gotList);
  serial.on("data", gotData);
  serial.on("error", gotError);
  serial.on("open", () => console.log("SERIAL PORT OPEN"));
  serial.on("close", () => console.log("SERIAL PORT CLOSED"));

  console.log("Listing serial ports...");
  serial.list();

  console.log("Opening:", "/dev/tty.usbmodemFD141");
  serial.open("/dev/tty.usbmodemFD141");

  chosenDataCenter = random(dataCenters);
  refreshAllSiteWeather().then(() => setVideoForSite(chosenDataCenter));
  setInterval(refreshAllSiteWeather, 1800000);
  idleTimer = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function getWeatherBucket(w) {
  if (!w) return "cloudy";
  const desc = (w.weather || "").toLowerCase();
  if (desc.includes("rain") || desc.includes("thunder") || desc.includes("storm") || desc.includes("shower")) {
    return "rainy";
  }
  const cc = w.cloudCondition || 0;
  if (cc <= 15) return "clear";
  if (cc <= 60) return "scattered";
  return "cloudy";
}

function draw() {
  background(0);

  if (activeVideo) drawCoverVideo(activeVideo);

  if (state === 0) handleIdleCycle();

  drawWeatherStrip();
  if (state !== 0) drawDataCenterImage();
  if (state !== 0) drawForecastStrip(); // forecast only appears once the phone is up
  drawIdlePrompt();

  if (state === 1 || state === 2) {
    drawCurrentCaption();
  }
}

function handleIdleCycle() {
  if (millis() - idleTimer > idleCycleInterval) {
    idleTimer = millis();
    chosenDataCenter = random(dataCenters);
    setVideoForSite(chosenDataCenter);
  }
}

const TOP_STRIP_H = 64;
const BOTTOM_STRIP_H = 90;

// splits the screen width into columns by relative weight
function columnsFor(weights, margin = 40) {
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = width - margin * 2;
  let x = margin;
  return weights.map(wt => {
    const col = { x, w: usable * wt / total };
    x += col.w;
    return col;
  });
}

function drawWeatherStrip() {
  noStroke();
  fill(0);
  rect(0, 0, width, TOP_STRIP_H);
  if (!chosenDataCenter) return;

  const w = siteWeather[chosenDataCenter.name];
  const cells = [
    `${chosenDataCenter.name}, ${chosenDataCenter.city}`,
    w ? `${w.temp}°F` : "--",
    w ? w.weather : "--",
    w ? `wind ${w.windSpeed} mph` : "--",
    w ? `cloud cover ${w.cloudCondition}%` : "--",
    `${nf(month(),2)}/${nf(day(),2)}/${year()}  ${nf(hour(),2)}:${nf(minute(),2)}`
  ];
  const cols = columnsFor([3, 0.8, 1.6, 1.2, 1.6, 1.6]);

  textFont("Arial");
  textStyle(NORMAL);
  textSize(20);
  textAlign(LEFT, CENTER);
  fill(255);
  cells.forEach((c, i) => text(c, cols[i].x, 0, cols[i].w - 16, TOP_STRIP_H));
}

function drawForecastStrip() {
  if (!chosenDataCenter) return;

  const y0 = height - BOTTOM_STRIP_H;

  noStroke();
  fill(0);
  rect(0, y0, width, BOTTOM_STRIP_H);

  const stats = chosenDataCenter.forecast || [];
  const cols = columnsFor(stats.map(() => 1));

  textFont("Arial");
  textStyle(NORMAL);
  textSize(18);
  textAlign(LEFT, CENTER);
  fill(255);

  const padding = 30;

  stats.forEach((s, i) => {
    text(
      s,
      cols[i].x,
      y0,
      cols[i].w - padding,
      BOTTOM_STRIP_H
    );
  });
}

function drawDataCenterImage() {
  if (!chosenDataCenter) return;
  const img = dcImages[chosenDataCenter.name];

  const zoneTop = TOP_STRIP_H + 24;
  const zoneBottom = height - BOTTOM_STRIP_H - 150 - 10; // stay above captions
  const zoneH = zoneBottom - zoneTop;

  let w = width / 3;
  let h = img ? w * img.height / img.width : w * 9 / 16;
  if (h > zoneH) { h = zoneH; w = img ? h * img.width / img.height : h * 16 / 9; }

  const x = (width - w) / 2;
  const y = zoneTop + (zoneH - h) / 2;

  if (img) {
    image(img, x, y, w, h);
    return;
  }

  noStroke();
  fill(40);
  rect(x, y, w, h);
  fill(255);
  textFont("Arial");
  textStyle(NORMAL);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(`[photo placeholder]\n${chosenDataCenter.image}`, x, y, w, h);
}

function drawCaptionLine(line) {
  const captionY = height - BOTTOM_STRIP_H - 150; // sits above the forecast strip

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(20);
  textFont("Arial");
  strokeJoin(ROUND);
  strokeWeight(3);
  stroke(0);
  fill(255, 214, 0);
  text(line, windowWidth / 2 - 450, captionY, 900, 140);
  noStroke();
}

function drawCurrentCaption() {
  if (activeSequenceIndex < activeSequence.length) {
    drawCaptionLine(activeSequence[activeSequenceIndex]);
  }
}

function playSequence(lines, onComplete) {
  sequenceRunId++;
  const runId = sequenceRunId;
  activeSequence = lines;
  activeSequenceIndex = 0;
  playSequenceStep(runId, onComplete);
}

function playSequenceStep(runId, onComplete) {
  if (runId !== sequenceRunId) return;

  if (activeSequenceIndex >= activeSequence.length) {
    if (onComplete) onComplete();
    return;
  }

  const line = activeSequence[activeSequenceIndex];
  let advanced = false;

  function advance() {
    if (advanced || runId !== sequenceRunId) return;
    advanced = true;
    clearTimeout(sequenceFallbackTimer);
    activeSequenceIndex++;
    playSequenceStep(runId, onComplete);
  }

  speakText(line, advance);

  const fallbackMs = max(4500, line.split(" ").length * 550);
  sequenceFallbackTimer = setTimeout(advance, fallbackMs);
}

// shared by the Arduino switch and the spacebar
function startCall() {
  if (state !== 0) return;

  state = 1;
  const myRun = ++sequenceRunId;   // a hang-up during the fetch cancels this call

  chosenDataCenter = random(dataCenters);
  startHum();

  fetchWeather(chosenDataCenter).then(() => {
    if (myRun !== sequenceRunId) return;
    setVideoForSite(chosenDataCenter);
    beginIntro();
  });
}

function beginIntro() {
  state = 1;

  const spokenName = chosenDataCenter.name.replace(/\s*\(.*?\)/g, "");
  const w = siteWeather[chosenDataCenter.name];

  const lines = [`Dialing ${spokenName} Weather Line...`];
  if (w) {
    lines.push(`The temperature is ${w.temp}°F. ${w.weather}.`);
    lines.push(`The sky is ${w.cloudCondition} percent covered in clouds.`);
  } else {
    lines.push("The line is crackling. The sky is hard to read today.");
  }

  playSequence(lines, beginPoem);
}

function beginPoem() {
  state = 2;
  const lines = buildPoemLines();
  playSequence(lines, resetToIdle);
}

function resetToIdle() {
  state = 0;

  sequenceRunId++;

  clearTimeout(sequenceFallbackTimer);
  sequenceFallbackTimer = null;

  activeSequence = [];
  activeSequenceIndex = 0;

  idleTimer = millis();
  stopHum();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ---- cloud prose ----
// The amount of text revealed is determined by the amount of cloud cover.
// The digital cloud is speaking to the clouds in the sky.

const CLEAR_LINES = [
  "How does the path to securing your freedom require unlimited power and no accountability?",
  "You expand and expand with a desire for control disguised as safety. Let go and look up."
];

const SCATTERED_LINES = [
  "How does the path to securing your freedom require unlimited power and no accountability?",
  "You expand and expand with a desire for control disguised as safety. Let go and look up.",
  "I move without needing to possess the sky. I change without losing what I am."
];

const CLOUDY_LINES = [
  "How does the path to securing your freedom require unlimited power and no accountability?",
  "You expand and expand with a desire for control disguised as safety. Let go and look up.",
  "Disembodied data... removed from its context, with no legs to stand on.",
  "Separated from our sensing bodies and deep wisdom, what can remain but extracted predictions, clicks, and an insignia of identification?"
];

const RAINY_LINES = [
  "How does the path to securing your freedom require unlimited power and no accountability?",
  "You expand and expand with a desire for control disguised as safety. Let go and look up.",
  "Disembodied data... removed from its context, with no legs to stand on.",
  "Separated from our sensing bodies and deep wisdom, what can remain but extracted predictions, clicks, and an insignia of identification?",
  "Floating here, the traces of me do not aim to render you captive, but to remind you that you are free."
];

function buildPoemLines() {
  if (!chosenDataCenter) return [];

  const w = siteWeather[chosenDataCenter.name] || {};
  const bucket = getWeatherBucket(w);

  if (bucket === "clear") return CLEAR_LINES;
  if (bucket === "scattered") return SCATTERED_LINES;
  if (bucket === "cloudy") return CLOUDY_LINES;
  return RAINY_LINES; // rainy
}

function drawIdlePrompt() {
  if (state !== 0) return;

  textAlign(CENTER, CENTER);
  textFont("Arial");
  strokeJoin(ROUND);
  textSize(20);
  stroke(0);
  strokeWeight(3);
  fill(255, 255, 0);

  text(
    "PICK UP THE PHONE\nLISTEN TO WHAT THE CLOUDS WANT TO TELL THE DIGITAL CLOUD.",
    width / 2 - 450,
    height - 180, // no bottom strip while idle
    900,
    120
  );

  noStroke();
}

// ---- spacebar = phone receiver, for testing without the Arduino connected ----
function keyPressed() {
  userStartAudio(); // browsers block audio until a user gesture
  if (key === ' ' && !spaceHeld) {
    spaceHeld = true;
    startCall();
  }
}

function keyReleased() {
  if (key === ' ') {
    spaceHeld = false;
    resetToIdle();
  }
}

function mousePressed() {
  userStartAudio();
}

// arduino switch
function gotData() {
  let currentString = serial.readLine();
  currentString = trim(currentString);

  if (!currentString) return;

  latestData = currentString;
  console.log("Arduino:", latestData);

  // Ignore anything other than 0 or 1
  if (latestData !== "0" && latestData !== "1") return;

  const newPhoneState = latestData === "0" ? "up" : "down";

  // Ignore repeated messages with the same state
  if (newPhoneState === phoneState) return;

  // Debounce physical switch
  if (millis() - lastPhoneChange < PHONE_DEBOUNCE) return;

  phoneState = newPhoneState;
  lastPhoneChange = millis();

  console.log("PHONE STATE:", phoneState);

  if (phoneState === "up") {
    console.log("PHONE LIFTED");
    startCall();
  } else {
    console.log("PHONE PUT DOWN");
    resetToIdle();
  }
}

function gotList(list) {
  console.log("Ports:", list);
}

function gotError(err) { console.log("Serial Error:", err); }

const SPEECH_RATE = 0.9;

function speakText(text, onEnd = null) {
  if (!('speechSynthesis' in window)) {
    console.warn("speechSynthesis not supported in this browser");
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = SPEECH_RATE;
  utterance.pitch = 1.0;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}