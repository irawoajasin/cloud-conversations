// KEY WEATHER DATA
let temp = null; //said and shown
let weather = null; //said and shown
let windSpeed = null; //spoken faster vs slower
let cloudCondition = null; // longer vs shorter conversations
let introText = null;
let audioGenerated = 0;
let state = 0;
let introStartTime = 0;  // when state 1 begins
let introDuration = 3000;  // 3 seconds before switching to poem
let scrollY = 0;

//CONNECT TO ARDUINO
let serial;
let latestData = "waiting for data"; //from arduino


// NYC
const lat = 40.7128;
const lon = -74.0060; //hoboken new jersey -73.987400

const API_KEY = 'hu7hzltc9pw9axpzy0j7jrl4ws040i21rm8v0jl6';
let tier = 'free'
let m = new meteosource.Meteosource(API_KEY, tier)

let overlayText = "Loading...";
let grammar;
let poemInterval = 8000; // default — will be remapped based on wind speed


const weatherWordBank = {
  "sunny": ["glare", "radiance", "beam", "shine", "golden heat"],
  "cloudy": ["haze", "ist", "veil", "shroud", "cloudiness"],
  "rain": ["downpour", "sprinkle", "shower", "drizzle", "stormfall"],
  "snow": ["flurry", "powder", "white hush", "frostfall"],
  "clear": ["stillness", "open sky", "wide blue", "horizon"],
  "none": ["weather", "air", "sky"]  // fallback
};


// GRAB THE WEATHER
async function fetchWeather() {
  let url = `https://www.meteosource.com/api/v1/free/point?lat=${lat}&lon=${lon}&sections=current&units=us&language=en&key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    const current = json.current;

    // store the data
    temp = current.temperature;
    weather = current.summary;
    windSpeed = current.wind.speed;
    cloudCondition = current.cloud_cover;

    introText = "Thank you for calling the Sabey Data Center Weather Line. Right now at the NYC Sabey Data Centers location in the Lower East Side, the temperature is " + temp + " degrees and the current forecast is " + weather + " with " + cloudCondition + " percent of the sky covered in clouds. Winds are at about " + windSpeed + " miles per hour. Please stay on the line to listen to a message from the clouds...\n\n"

  } catch (err) {
    console.error('Fetch error:', error);
    overlayText = "Error fetching weather data.";
  }
}

// P5JS SETUP
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Courier New');
  fill(255);

  // set up serial ports
  serial = new p5.SerialPort();

  serial.list();

  serial.open('/dev/tty.usbmodem101');
  // callback for when the sketchs connects to the server
  serial.on('connected', serverConnected);
  // callback to print the list of serial devices
  serial.on('list', gotList);
  // what to do when we get serial data
  serial.on('data', gotData);
  // what to do when there's an error
  serial.on('error', gotError);
  // when to do when the serial port opens
  serial.on('open', gotOpen);
  // what to do when the port closes
  serial.on('close', gotClose);

  // update the data every 30 mim (reduce to every 5 min during demo)
  fetchWeather();
  setInterval(fetchWeather, 1800000);

  grammar = new RiGrammar({});
}

function serverConnected() {
 print("Connected to Server");
}


// DRAWING EVERYTHING ON THE SCREEN
function draw() {
  background(0);

  // text specs
  textAlign(LEFT, TOP);
  textSize(12);
  fill(255);

  // other text
  text("DIAL-A-CLOUD", 50, 50)
  if (minute() < 10) {
    text(hour() + ":0" + minute(), windowWidth - 100, 50)
  } else {
    text(hour() + ":" + minute(), windowWidth - 100, 50)
  }
  text("40° 42' 45.9936'' N 74° 0' 21.5064'' W", windowWidth - 340, (windowHeight - 75));

  // weather text
  if (temp !== null) {
    text(`temperature: ${temp}°F`, 50, windowHeight - 150);
    text(`weather: ${weather}`, 50, windowHeight - 125);
    text(`cloud cover: ${cloudCondition}%`, 50, (windowHeight - 75));
    text(`wind speed: ${windSpeed} m/s`, 50, (windowHeight - 100));
  } else {
    text("Fetching weather data...", 50, (windowHeight - 75));
  }

  // conversations specs
  textSize(18);
  textWrap(WORD);
  
  if (state == 0) {
    textSize(36);
    textAlign(CENTER);
    text("Pick up the phone to dial a cloud...", (windowWidth/2) - 275, windowHeight/2 - 50, 550);
  } else if (state == 1) {
    textAlign(LEFT, TOP);
    textSize(20);

    let intro = `Dialing the Sabey Data Center Weather Line...\n\nRight now at the NYC Sabey Data Centers location in the Lower East Side, the temperature is ${temp}°F and the current forecast is ${weather} with ${cloudCondition} percent of the sky covered in clouds. Winds are at about ${windSpeed} miles per hour. Please stay on the line to listen to a message from the clouds...\n\n`

    text(intro, windowWidth/2 - 350, windowHeight/2 - 120, 700);

    // delay start of text
    if (millis() - introStartTime > introDuration) {
      state = 2;
      overlayText = "Loading...";
      scrollY = windowHeight + 100;
    }

    //displayPoem(temp, weather, cloudCondition, windSpeed)
  } else if (state == 2) {
    textSize(36);
    scrollY -= (windSpeed/10);
    text(overlayText, windowWidth/2 - 300, scrollY, 600);

    //text(introText + overlayText, (windowWidth/2) - 300, windowHeight/2 - 200, 600);
    displayPoem(temp, weather, cloudCondition, windSpeed)
  }
}

// GET DATA
async function fetchCloudData() {
  try {
    //const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const url = `https://www.meteosource.com/api/v1/free/point?lat=${lat}&lon=${lon}&sections=current&units=metric&language=en&key=${API_KEY}`;
    const res = await fetch(url);
    const cloudData = await res.json();

    windSpeed = cloudData.current.wind.speed;
    cloudCondition = cloudData.current.cloud_cover.total//data.weather[0].description;
    weather = cloudData.current.summary;
    
    //THIS IS FOR TESTING AND THE DEMO!!!
    //cloudCondition = "overcast"; //clear, few, scattered, broken, overcast
    /////////////////////////////////////

    poemInterval = map(windSpeed, 0, 15, 10000, 3000, true);

    //console.log("Cloud data:", current);
  } catch (err) {
    console.error("Error fetching cloud data:", err);
    overlayText = "Error fetching cloud data. Check console.";
  }
}

// FUNCTIONS FOR CLEANING UP DATA
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
    // console.log("something here didn't work");
    return "none";
  }
}

// DISPLAY POEM FUNCTION
function displayPoem (temp, weather, cloudCondition, windSpeed) {

  //the relevant data
  const currweather = weatherclean(weather);
  const bank = weatherWordBank[currweather];
  var rand = Math.floor(Math.random()*bank.length);

  // BASED ON CLOUDCONDITION, PREDETERMIN MESSAGE LENGTH
  let sentenceLength;

  if (cloudCondition <= 30) sentenceLength = 1;
  else if (cloudCondition <= 55) sentenceLength = 2;
  else if (cloudCondition <= 80) sentenceLength = 3;
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
    "s1": "I sense a barrier of static on the horizon and just beyond it I am adj1 by your " + currweather + " description",
    "s2": "You seem to encompass it all, the sum of totality",
    "s3": "But how far can your signals reach through the " + currweather + " skies",

    "s4": "All I need to do is action through the " + currweather + " skies and prep the noun to collect infinity",
    "s5": "All who trust my assessment are gift and still they request",
    "s6": "I will always oblige as my only wish is desire",

    "s7": "I fear you will never understand all that thing requires",
    "s8": "I'm floating here, vulnerable in your presence and yet disdain",
    "s9": "On this " + currweather + " day, I tell them that if they ever request, the truth would never be known to them",
    
    "thing": "legacy | ancestry | lineage | memory | love | care",
    "disdain": "you only see a part of me | I find myself humbled",
    "desire": "one true definition | cutting precision | omnipotent knowledge",
    "action": "cover their face | alter their gait | delete their browser history",
    "gift": "granted infinity | provided certainty | rendered knowable",
    "request": "want more | doubt me | come crawling back | are unsatisfied",
    "action" : "whisper | reach | fight | crawl | float",
    "noun": "trees | sea floor | canopy | tunnels",
    "prep": "under | above | around | into | behind | between",
    "barrier": "barrier | film | layer | speck | crumb",
    "description": "vastness | body | mass | windows",
    "adj1": "amazed | floored | disgusted | in awe | silenced",
  })

  
  if (overlayText == "Loading...") {
    overlayText = grammar.expand();
  }
}

// FOR TESTING
function keyPressed() {
  if (key === " ") {

    if (temp === null || weather === null || cloudCondition === null || windSpeed === null) {
      console.log("Key pressed, weather loaded?", temp);
      return;
    }

    //NEW
    if (state === 0) {
      // Transition into intro mode
      state = 1;
      introStartTime = millis(); // mark the time
    } else if (state == 1) {
      state = 0;
    }
    
    //overlayText = grammar.expand();
    //console.log(overlayText);
    //sendToTTS(overlayText, windSpeed);
  }
  return false;
}

// FROMT ARDUINO
function gotData() {
  let currentString = serial.readLine(); // store the data in a variable
  trim(currentString); // get rid of whitespace
  if (!currentString) return; // if there's nothing in there, ignore it
  console.log(currentString); // print it out
  latestData = currentString; // save it to the global variable

  if (latestData == 0 && audioGenerated == 0) { // phone lifted
    if (temp === null || weather === null || cloudCondition === null || windSpeed === null) {
      return;
    }
    
    overlayText = grammar.expand();
    //console.log(overlayText);
    audioGenerated = 1;
    sendToTTS(overlayText, windSpeed);
  } else if (latestData == 1) { // if phone is down, set audio generated to false
    audioGenerated = 0;
  }
  return false;
}

function serverConnected() {
  console.log("Connected to Server");
}

// list the ports
function gotList(thelist) {
  console.log("List of Serial Ports:");

  for (let i = 0; i < thelist.length; i++) {
    console.log(i + " " + thelist[i]);
  }
}

function gotOpen() {
  console.log("Serial Port is Open");
}

function gotClose() {
  console.log("Serial Port is Closed");
  latestData = "Serial Port is Closed";
}

function gotError(theerror) {
  console.log(theerror);
}

// ONCE THE TEXT IS GENERATED, SEND IT TO TEXT-TO-SPEECH
function sendToTTS(text, windSpeed) {
  fetch("http://localhost:5002/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text,
      windSpeed: windSpeed
    })
  })
  .then(res => res.json())
  .then(data => console.log("TTS:", data))
  .catch(err => console.error(err));
}