// ---- DEBUG: set to false to skip loading/playing video entirely (fast testing) ----
const VIDEOS_ENABLED = false;

let temp = null;
let weather = null;
let windSpeed = null;
let cloudCondition = null;

let grammar;

let state = 0;              // 0 = idle, 1 = intro, 2 = poem

// ---- intro caption state (styled like the poem captions) ----
let introLines = [];
let introLineIndex = 0;
let introLineStartTime = 0;
let introLineDuration = 4200;  // ms each intro line is held on screen

// ---- caption state (poem) ----
let poemLines = [];
let poemLineIndex = 0;
let poemLineStartTime = 0;
let poemLineDuration = 5200;
let audioGenerated = 0;

// ---- spacebar phone simulation ----
// Holding space = receiver up (mirrors serial "0"), releasing = receiver down (mirrors serial "1")
let spaceHeld = false;

// ---- video handling ----
const dataCenters = [
  {
    // Operator: Meta. Congressional hearing (May 2026) over well-water
    // contamination near this site.
    name: "Stanton Springs Data Center",
    city: "Rutledge, GA",
    lat: 33.6742, lon: -83.6155,
    videos: {
      clear:  "assets/scattered.mp4",
      cloudy: "assets/cloudy.mp4",
      rain:   "assets/highcover.mp4",
      snow:   "assets/clouds.mp4",
      sunny:  "assets/clouds2.mp4"
    }
  },
  {
    // Operator: Digital Realty. Proposed near West End MARTA station;
    // rejected by NPU-V neighborhoods, April 2026.
    name: "West End Data Center (Rejected)",
    city: "Adair Park, Atlanta, GA",
    lat: 33.7383, lon: -84.4321,
    videos: {
      clear:  "assets/scattered.mp4",
      cloudy: "assets/cloudy.mp4",
      rain:   "assets/highcover.mp4",
      snow:   "assets/clouds.mp4",
      sunny:  "assets/clouds2.mp4"
    }
  },
  {
    // Operator not publicly confirmed as of this writing — verify before printing on cards.
    name: "South DeKalb Data Center (Proposed)",
    city: "South DeKalb, GA",
    lat: 33.6885, lon: -84.1996,
    videos: {
      clear:  "assets/scattered.mp4",
      cloudy: "assets/cloudy.mp4",
      rain:   "assets/highcover.mp4",
      snow:   "assets/clouds.mp4",
      sunny:  "assets/clouds2.mp4"
    }
  },
  {
    // Operator: xAI. Unpermitted gas turbines; subject of NAACP Clean Air Act litigation.
    name: "Colossus",
    city: "Boxtown, South Memphis, TN",
    lat: 35.0455, lon: -90.0520,
    videos: {
      clear:  "assets/scattered.mp4",
      cloudy: "assets/cloudy.mp4",
      rain:   "assets/highcover.mp4",
      snow:   "assets/clouds.mp4",
      sunny:  "assets/clouds2.mp4"
    }
  },
  {
    // Operator: Meta. Majority-Black, high-poverty parish; local churches
    // split over the project.
    name: "Hyperion",
    city: "Richland Parish, LA",
    lat: 32.5384, lon: -91.8496,
    videos: {
      clear:  "assets/scattered.mp4",
      cloudy: "assets/cloudy.mp4",
      rain:   "assets/highcover.mp4",
      snow:   "assets/clouds.mp4",
      sunny:  "assets/clouds2.mp4"
    }
  }
];

let chosenDataCenter = null;

let siteWeather = {};

let siteVideos = {};
let activeVideo = null;

let idleCycleInterval = 9000;
let idleTimer = 0;

// arduino
let serial;
let latestData = "waiting for data";

const API_KEY = "hu7hzltc9pw9axpzy0j7jrl4ws040i21rm8v0jl6";

async function fetchWeather(site) {
  let url = `https://www.meteosource.com/api/v1/free/point?lat=${site.lat}&lon=${site.lon}&sections=current&units=us&language=en&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const current = json.current;

    const bucket = weatherclean(current.summary);

    siteWeather[site.name] = {
      temp: current.temperature,
      weather: current.summary,
      windSpeed: current.wind.speed,
      cloudCondition: current.cloud_cover,
      bucket: bucket
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

  console.log("Opening:", "/dev/tty.usbmodemFA131");
  serial.open("/dev/tty.usbmodemFA131");

  if (VIDEOS_ENABLED) {
    for (let site of dataCenters) {
      siteVideos[site.name] = {};
      for (let bucket in site.videos) {
        let v = createVideo(site.videos[bucket], () => v.loop());
        v.hide();
        v.volume(0);
        siteVideos[site.name][bucket] = v;
      }
    }
  }

  grammar = new RiGrammar({});

  chosenDataCenter = random(dataCenters);
  refreshAllSiteWeather().then(() => {
    setVideoForSite(chosenDataCenter);
  });
  setInterval(refreshAllSiteWeather, 1800000);
  idleTimer = millis();
}

function serverConnected() {
  console.log("Connected to Serial Server");
}

function setVideoForSite(site) {
  if (!VIDEOS_ENABLED) return;
  const w = siteWeather[site.name];
  const bucket = (w && w.bucket && siteVideos[site.name][w.bucket]) ? w.bucket : "cloudy";
  const nextVideo = siteVideos[site.name][bucket];

  activeVideo = nextVideo;
  activeVideo.play();
}

function draw() {
  background(0);

  if (activeVideo) {
    image(activeVideo, 0, 0, width, height);
  }

  drawHUD();

  // idle (state 0) now shows nothing but the HUD and the cycling footage
  if (state === 1) {
    drawIntro();
  } else if (state === 2) {
    drawCaptions();
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

// ---- top-left HUD: black text on white highlight blocks, tight line spacing ----
function drawHUD() {
  textFont("Arial");
  textSize(16);
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
  const lineHeight = 24;
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

// ---- shared vintage caption renderer: yellow fill, black stroke, bottom-anchored ----
function drawCaptionLine(line) {
  const captionY = windowHeight - 140;

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(20);
  textFont("Arial");
  strokeWeight(3);
  stroke(0);
  fill(255, 214, 0);
  text(line, windowWidth / 2 - 450, captionY, 900, 140);
  noStroke();
}

function drawIntro() {
  if (introLines.length === 0) {
    beginPoem();
    return;
  }

  if (millis() - introLineStartTime > introLineDuration) {
    introLineIndex++;
    introLineStartTime = millis();
    if (introLineIndex >= introLines.length) {
      beginPoem();
      return;
    }
  }

  drawCaptionLine(introLines[introLineIndex]);
}

// ---- vintage bottom captions: yellow fill, black stroke (poem) ----
function drawCaptions() {
  if (poemLines.length === 0 && audioGenerated === 0) {
    buildPoemLines();
    audioGenerated = 1;
    sendToTTS(poemLines.join(" "), (siteWeather[chosenDataCenter.name] || {}).windSpeed || 0);
    poemLineStartTime = millis();
  }

  if (poemLines.length === 0) return;

  if (millis() - poemLineStartTime > poemLineDuration) {
    poemLineIndex++;
    poemLineStartTime = millis();
    if (poemLineIndex >= poemLines.length) {
      resetToIdle();
      return;
    }
  }

  drawCaptionLine(poemLines[poemLineIndex]);
}

function beginIntro() {
  state = 1;
  audioGenerated = 0;

  const w = siteWeather[chosenDataCenter.name] || {};
  introLines = [
    `Dialing ${chosenDataCenter.name} Weather Line...`,
    `Right now at the ${chosenDataCenter.name}, the temperature is ${w.temp}°F.`,
    `The current forecast is ${w.weather}, with ${w.cloudCondition} percent of the sky covered in clouds.`,
    `Winds are at about ${w.windSpeed} miles per hour.`,
    `Please stay on the line to listen to a message from the clouds...`
  ];
  introLineIndex = 0;
  introLineStartTime = millis();
}

function beginPoem() {
  state = 2;
  poemLines = [];
  poemLineIndex = 0;
  audioGenerated = 0;
}

function resetToIdle() {
  state = 0;
  introLines = [];
  introLineIndex = 0;
  poemLines = [];
  poemLineIndex = 0;
  audioGenerated = 0;
  idleTimer = millis();
}

function weatherclean(desc) {
  try {
    desc = desc.toLowerCase();
    if (desc.includes("sun")) return "sunny";
    if (desc.includes("cloud") || desc.includes("overcast") || desc.includes("mist") || desc.includes("fog")) return "cloudy";
    if (desc.includes("rain") || desc.includes("thunder")) return "rain";
    if (desc.includes("snow") || desc.includes("hail")) return "snow";
    if (desc.includes("clear")) return "clear";
    return "cloudy";
  } catch {
    return "cloudy";
  }
}

function buildPoemLines() {
  if (!chosenDataCenter) return;
  const w = siteWeather[chosenDataCenter.name] || {};
  const currweather = weatherclean(w.weather || "");
  const cloudCondition = w.cloudCondition || 0;

  let sentenceLength;
  if (cloudCondition <= 20) sentenceLength = 1;
  else if (cloudCondition <= 40) sentenceLength = 2;
  else if (cloudCondition <= 60) sentenceLength = 3;
  else sentenceLength = 4;

  let startRule = "<beginning>.";
  for (let i = 1; i <= sentenceLength; i++) {
    startRule += ` <sentence${i}>.`;
  }

  grammar = new RiGrammar({
    "<start>": startRule,
    "<beginning>": ["phrase1", "phrase2", "phrase3"],
    "phrase1": "I hope you can hear me",
    "phrase2": "It's nice to see you again",
    "phrase3": "Hi old friend",

    "<sentence1>": ["s1", "s2", "s3"],
    "<sentence2>": ["s4", "s5"],
    "<sentence3>": ["s6", "s7"],
    "<sentence4>": ["s8", "s9"],

    "s1": `I sense a barrier of static on the horizon and just beyond it I am adj1 by your ${currweather} description`,
    "s2": `You seem to encompass it all, the sum of totality`,
    "s3": `But how far can your signals reach through the ${currweather} skies`,

    "s4": `All I need to do is action through the ${currweather} skies and prep the noun to collect infinity`,
    "s5": `All who trust my assessment are gift and still they request`,
    "s6": `I will always oblige as my only wish is desire`,

    "s7": `I fear you will never understand all that thing requires`,
    "s8": `I'm floating here, vulnerable in your presence and yet disdain`,
    "s9": `On this ${currweather} day, I tell them that if they ever request, the truth would never be known to them`,

    "thing": "legacy | ancestry | lineage | memory | love | care",
    "disdain": "you only see a part of me | I find myself humbled",
    "desire": "one true definition | cutting precision | omnipotent knowledge",
    "action": "whisper | reach | fight | crawl | float",
    "gift": "granted infinity | provided certainty | rendered knowable",
    "request": "want more | doubt me | come crawling back | are unsatisfied",
    "noun": "trees | sea floor | canopy | tunnels",
    "prep": "under | above | around | into | behind | between",
    "barrier": "barrier | film | layer | speck | crumb",
    "description": "vastness | body | mass | windows",
    "adj1": "amazed | floored | disgusted | in awe | silenced",
  });

  const fullPoem = grammar.expand();
  poemLines = fullPoem.split(". ").map(s => s.trim()).filter(s => s.length > 0);
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

  if (latestData === "0" && state === 0) {
    console.log("PHONE UP");

    chosenDataCenter = random(dataCenters);

    fetchWeather(chosenDataCenter).then(() => {
      setVideoForSite(chosenDataCenter);
      beginIntro();
    });

  } else if (latestData === "1") {
    console.log("PHONE DOWN");
    resetToIdle();
  }
}

function gotList(list) {
  console.log("Ports:", list);
}

function gotOpen() { console.log("Serial Port Open"); }
function gotClose() { console.log("Serial Port Closed"); }
function gotError(err) { console.log("Serial Error:", err); }

// text to speech
function sendToTTS(text, windSpeed) {
  fetch("http://localhost:5002/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, windSpeed })
  })
    .then((res) => res.json())
    .then((data) => console.log("TTS:", data))
    .catch((err) => console.error("TTS error:", err));
}
