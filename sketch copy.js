let temp = null;
let weather = null;
let windSpeed = null;
let cloudCondition = null;

let introText = "";
let overlayText = "Loading...";
let grammar;

let audioGenerated = 0;
let state = 0;              // 0 = idle, 1 = intro, 2 = poem
let introStartTime = 0;
let introDuration = 3000;
let bgImages = {};

function preload() {
  for (let item of dataCenters) {
    bgImages[item.name] = loadImage(item.img);
  }
}

const dataCenters = [
  { name: "Sabey Data Center",   lat: 40.7128, lon: -74.0060, img: "assets/sabey.png"},
  { name: "Active Infrastructure",       lat: 33.2686, lon: -111.8834, img: "assets/active.png" },
  { name: "PCC-DeKalb, LLC",            lat: 33.6522, lon: -84.2941 , img: "assets/pcc.png"}
];
let chosenDataCenter = null;
let currbg = null;


let scrollY = 0;

// arduino
let serial;
let latestData = "waiting for data";

// location
const lat = 40.7128;
const lon = -74.0060;
const API_KEY = "hu7hzltc9pw9axpzy0j7jrl4ws040i21rm8v0jl6";

async function fetchWeather(lat, lon) {
  
  let url = `https://www.meteosource.com/api/v1/free/point?lat=${lat}&lon=${lon}&sections=current&units=us&language=en&key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    const current = json.current;

    temp = current.temperature;
    weather = current.summary;
    windSpeed = current.wind.speed;
    cloudCondition = current.cloud_cover;

    introText =
      `Dialing ${chosenDataCenter.name} Weather Line...\n\nRight now at the ${chosenDataCenter.name}, the temperature is ${temp}°F and the current forecast is ${weather} with ${cloudCondition} percent of the sky covered in clouds. Winds are at about ${windSpeed} miles per hour. Please stay on the line to listen to a message from the clouds...\n\n`;

  } catch (err) {
    console.error("Fetch error:", err);
    overlayText = "Error fetching weather data.";
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Courier New");
  fill(255);

  serial = new p5.SerialPort();
  serial.list();
  serial.open("/dev/tty.usbmodem1101");

  serial.on("connected", serverConnected);
  serial.on("list", gotList);
  serial.on("data", gotData);
  serial.on("error", gotError);
  serial.on("open", gotOpen);
  serial.on("close", gotClose);

  //fetchWeather(chosenDataCenter.lat, chosenDataCenter.lon);
  //setInterval(fetchWeather, 1800000);

  grammar = new RiGrammar({});
}

function serverConnected() {
  console.log("Connected to Serial Server");
}

function draw() {
  if (currbg && state !== 0) {
    image(currbg, 0, 0, width, height);
    fill(0, 160);
    rect(0, 0, width, height);  
  } else {
    background(0);
  }
  fill(255)

  drawHUD();

  if (state === 0) drawIdle();
  else if (state === 1) drawIntro();
  else if (state === 2) drawPoem();
}

function drawHUD() {
  textAlign(LEFT, TOP);
  textSize(28);

  text("DIAL-A-CLOUD", 50, 50);
  text(`${hour()}:${nf(minute(), 2)}`, windowWidth - 100, 50);
  

  if (state !== 0 && temp !== null) {
    textAlign(CENTER, TOP);
    text(chosenDataCenter.name, (windowWidth/2) - 100, 50, 200)
    textAlign(RIGHT, TOP);
    text(chosenDataCenter.lat + ", " + chosenDataCenter.lon, windowWidth - 50, windowHeight - 75);
    textAlign(LEFT, TOP);
    text(`temperature: ${temp}°F`, 50, windowHeight - 200);
    text(`weather: ${weather}`, 50, windowHeight - 160);
    text(`wind speed: ${windSpeed} m/s`, 50, windowHeight - 120);
    text(`cloud cover: ${cloudCondition}%`, 50, windowHeight - 80);
  }
}

function drawIdle() {
  textAlign(CENTER);
  textSize(36);
  text("Pick up the phone to dial a cloud...", windowWidth / 2 - 275, windowHeight / 2 - 50, 550);
}

function drawIntro() {
  textAlign(LEFT, TOP);
  textSize(20);
  text(introText, windowWidth / 2 - 350, windowHeight / 2 - 120, 700);

  console.log(millis() - introStartTime);

  if (millis() - introStartTime > introDuration) {
    beginPoem();
  }
}

function drawPoem() {
  if (overlayText === "Loading..." && audioGenerated === 0) {
    displayPoem();

    overlayText = grammar.expand();
    audioGenerated = 1;
    sendToTTS(overlayText, windSpeed);
  }

  textSize(42);
  scrollY -= 3; // windSpeed / 4; this is working weird
  text(overlayText, windowWidth / 2 - 1000, scrollY, 2000);
}

function beginIntro() {
  state = 1;
  overlayText = "Loading...";
  audioGenerated = 0;
  scrollY = windowHeight + 200;
  introStartTime = millis();
}

function beginPoem() {
  state = 2;
  overlayText = "Loading...";
  scrollY = windowHeight + 200;
}

function resetToIdle() {
  state = 0;
  currbg = null;
  overlayText = "Loading...";
  audioGenerated = 0;
  scrollY = windowHeight + 200;
}

function weatherclean(desc) {
  try {
    desc = desc.toLowerCase();
    if (desc.includes("sun")) return "sunny";
    if (desc.includes("cloud") || desc.includes("overcast") || desc.includes("mist") || desc.includes("fog")) return "cloudy";
    if (desc.includes("rain") || desc.includes("thunder")) return "rain";
    if (desc.includes("snow") || desc.includes("hail")) return "snow";
    if (desc.includes("clear")) return "clear";
    return "none";
  } catch {
    return "none";
  }
}

function displayPoem() {
  if (!grammar) return;

  const currweather = weatherclean(weather);

  // determine length
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
  /*
  if (overlayText === "Loading...") {
    overlayText = grammar.expand();
    audioGenerated = 0;
  }
    */
}

// testing with spacebar
function keyPressed() {
  if (key !== " ") return;

  if (state === 0) beginIntro();
  else if (state === 1) beginPoem();
  else if (state === 2) resetToIdle();
}

// arduino switch
function gotData() {
  let currentString = serial.readLine();
  trim(currentString);
  if (!currentString) return;

  latestData = currentString;
  console.log("Arduino:", latestData);

  // PHONE LIFTED (0)
  if (latestData == 0 && state === 0) {
    chosenDataCenter = random(dataCenters); // pick one of the data centers
    currbg = bgImages[chosenDataCenter.name];
    fetchWeather(chosenDataCenter.lat, chosenDataCenter.lon);
    beginIntro();          // start intro immediately
    audioGenerated = 0;
  }

  // PHONE DOWN (1)
  else if (latestData == 1) {
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
