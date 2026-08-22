let state = 0;              // 0 = idle, 1 = intro, 2 = poem

let activeSequence = [];
let activeSequenceIndex = 0;
let sequenceRunId = 0;
let sequenceFallbackTimer = null;

let spaceHeld = false;

// debug
const VIDEOS_ENABLED = true;

const dataCenters = [
  {
    // Operator: Meta. Congressional hearing (May 2026) over well-water
    // contamination near this site.
    name: "Stanton Springs Data Center",
    city: "Rutledge, GA",
    lat: 33.6742, lon: -83.6155
  },
  {
    // Operator: Digital Realty. Proposed near West End MARTA station;
    // rejected by NPU-V neighborhoods, April 2026.
    name: "West End Data Center (Rejected)",
    city: "Adair Park, Atlanta, GA",
    lat: 33.7383, lon: -84.4321
  },
  {
    // Operator not publicly confirmed as of this writing — verify before printing on cards.
    name: "South DeKalb Data Center (Proposed)",
    city: "South DeKalb, GA",
    lat: 33.6885, lon: -84.1996
  },
  {
    // Operator: xAI. Unpermitted gas turbines; subject of NAACP Clean Air Act litigation.
    name: "Colossus",
    city: "Boxtown, South Memphis, TN",
    lat: 35.0455, lon: -90.0520
  },
  {
    // Operator: Meta. Majority-Black, high-poverty parish; local churches
    // split over the project.
    name: "Hyperion",
    city: "Richland Parish, LA",
    lat: 32.5384, lon: -91.8496
  }
];

let chosenDataCenter = null;

let siteWeather = {};

const VIDEO_CATEGORIES = {
  clear:     ["assets/video/clear/clear1.mp4", "assets/video/clear/clear2.mp4"],
  scattered: ["assets/video/scattered/scattered1.mp4", "assets/video/scattered/scattered2.mp4", "assets/video/scattered/scattered3.mp4"],
  cloudy:    ["assets/video/cloudy/cloudy1.mp4", "assets/video/cloudy/cloudy2.mp4", "assets/video/cloudy/cloudy3.mp4"],
  rainy:     ["assets/video/rainy/rainy1.mp4"]
};

let activeVideo = null;

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

async function refreshAllSiteWeather() {
  for (let site of dataCenters) {
    await fetchWeather(site);
    setVideoForSite(site);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Arial");
  fill(255);

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
  refreshAllSiteWeather().then(() => {
    setVideoForSite(chosenDataCenter);
  });
  setInterval(refreshAllSiteWeather, 1800000);
  idleTimer = millis();
}

function setVideoForSite(site) {
  if (!VIDEOS_ENABLED) return;
  const w = siteWeather[site.name];
  const bucket = getWeatherBucket(w);
  const pool = VIDEO_CATEGORIES[bucket] || VIDEO_CATEGORIES.cloudy;
  const chosenPath = random(pool);

  if (activeVideo) {
    activeVideo.stop();
    activeVideo.remove();
    activeVideo = null;
  }

  activeVideo = createVideo(chosenPath, () => activeVideo.loop());
  activeVideo.hide();
  activeVideo.volume(0);
}

// determines the video (and now text) category from live cloud% + weather text
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

  if (activeVideo) {
    image(activeVideo, 0, 0, width, height);
  }

  drawHUD();
  drawIdlePrompt();

  if (state === 1 || state === 2) {
    drawCurrentCaption();
  }
}

function handleIdleCycle() {
  if (millis() - idleTimer > idleCycleInterval) {
    idleTimer = millis();
    let next = random(dataCenters);
    chosenDataCenter = next;
    setVideoForSite(next);
  }
}

// top-left HUD: black text on white highlight blocks
function drawHUD() {
  textFont("Arial");
  textSize(20);
  textAlign(LEFT, TOP);
  noStroke();

  if (state === 0) handleIdleCycle();

  let lines = [];
  lines.push(`${nf(month(),2)}/${nf(day(),2)}/${year()}  ${nf(hour(),2)}:${nf(minute(),2)}`);

  if (chosenDataCenter) {
    lines.push(chosenDataCenter.name);
    if (chosenDataCenter.city) lines.push(chosenDataCenter.city);
    const w = siteWeather[chosenDataCenter.name];
    if (w) {
      lines.push(`${w.temp}°F — ${w.weather}`);
      lines.push(`wind ${w.windSpeed} mph — cloud cover ${w.cloudCondition}%`);
    }
  }

  const x = 40;
  let y = 40;
  const lineHeight = 32;
  const padX = 8;
  const padY = 3;

  for (let line of lines) {
    const tw = textWidth(line);
    fill(255);
    rect(x - padX, y - padY, tw + padX * 2, lineHeight - 4);
    fill(0);
    text(line, x, y);
    y += lineHeight;
  }
}

function drawCaptionLine(line) {
  const captionY = windowHeight - 140;

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

function beginIntro() {
  state = 1;

  const w = siteWeather[chosenDataCenter.name] || {};

  const lines = [
    `Dialing ${chosenDataCenter.name} Weather Line...`,
    `The temperature is ${w.temp}°F. ${w.weather}.`,
    `The sky is ${w.cloudCondition} percent covered in clouds.`
  ];

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

  if (bucket === "clear") {
    return CLEAR_LINES;
  }

  if (bucket === "scattered") {
    return SCATTERED_LINES;
  }

  if (bucket === "cloudy") {
    return CLOUDY_LINES;
  }

  // rainy
  return RAINY_LINES;
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
    height - 180,
    900,
    120
  );

  noStroke();
}

// ---- spacebar = phone receiver, for testing without the Arduino connected ----
function keyPressed() {
  if (key === ' ' && !spaceHeld) {
    spaceHeld = true;
    if (state === 0) {
      chosenDataCenter = random(dataCenters);
      fetchWeather(chosenDataCenter).then(() => {
        setVideoForSite(chosenDataCenter);
        beginIntro();
      });
    }
  }
}

function keyReleased() {
  if (key === ' ') {
    spaceHeld = false;
    resetToIdle();
  }
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

  // Receiver was JUST lifted
  if (phoneState === "up") {
    console.log("PHONE LIFTED");

    // Don't start another sequence if one is already playing
    if (state !== 0) return;

    chosenDataCenter = random(dataCenters);

    fetchWeather(chosenDataCenter).then(() => {
      setVideoForSite(chosenDataCenter);
      beginIntro();
    });
  }

  // Receiver was JUST put down
  else if (phoneState === "down") {
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
