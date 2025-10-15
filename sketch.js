let clouds = [];
let windSpeed = null;
let cloudCondition = null;
const lat = 40.7128;
const lon = -74.0060;
let asciiChar = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[^_`abcdefghijklmnopqrstuvwxyz{|}~"

const API_KEY = '73505328a5e9867fe267ccaae1c52fbf';
let lastFetch = 0;
let overlayText = "Loading...";
let img;

let overlayAlpha = 0;
let overlayFadingIn = true;
let lastPoemTime = 0;
let poemInterval = 8000; // default — will be remapped based on wind speed

const lightSet    = ".,`'/-* ";
const mediumSet   = "!*+=/:;~";
const heavySet    = "#$%&@WM";
const fullSet     = asciiChar; // full density
let charset = "";
let remappedCloud;
let cloudShape =`
          .-~~~-.
  .- ~ ~-(       )_ _
 /                     ~ -.
|                           
 \                         .'
   ~- . _____________ . -~
    `

function preload() {
  img = loadImage("datacenter.png");
}


function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Courier New');
  fill(100);
  fetchCloudData();

  img.resize(0, height);
  size = 6;
}

function draw() {
  background(217, 238, 244);
  textSize(14);
  text('cloud conversations at the sabey data center', windowWidth - 300, 25);
  text(hour() + ":" + minute(), windowWidth - 150, 50);

  // info text specs
  textAlign(LEFT, TOP);
  textSize(12);
  fill(25);
  textLeading(28);
  textWrap(WORD);

  // location text
  text("40° 42' 45.9936'' N 74° 0' 21.5064'' W", windowWidth/2, (windowHeight/2) + 125)

  if (cloudCondition !== null && windSpeed !== null) {
    text(`cloud status: ${cloudCondition}`, windowWidth/2, (windowHeight/2) + 150);
    text(`wind speed: ${windSpeed} m/s`, windowWidth/2, (windowHeight/2) + 175);
  } else {
    text("Fetching weather data...", windowWidth/2, (windowHeight/2) + 150);
  }

  textSize(18);
  fill(0, overlayAlpha);
  textWrap(WORD);
  text(overlayText, windowWidth/2, (windowHeight/2) + 225, 500);

  // Fade animation
  if (overlayFadingIn) {
    overlayAlpha += 2;
    if (overlayAlpha >= 255) {
      overlayAlpha = 255;
      overlayFadingIn = false;
      lastPoemTime = millis();
    }
  } else {
    // Wait for interval, then fade out
    if (millis() - lastPoemTime > poemInterval) {
      overlayAlpha -= 2;
      if (overlayAlpha <= 0) {
        overlayAlpha = 0;
        overlayFadingIn = true;
        displayPoem(cloudCondition, windSpeed);
      }
    }
  }
  
  // move and draw clouds
  for (let c of clouds) {
    c.x += c.speed;
    if (c.x > width + c.size) {
      c.x = - 50;
    }
    drawCloud(c)
  }


  // draw building
  for (let y = 0; y < img.height; y += size) {
    for (let x = 0; x < img.width; x += size) {
      let pixelVal = img.get(x, y);
      let col = color(pixelVal);
      let b = brightness(col);
      let tIndex = floor(map(b, 0, 100, 0, asciiChar.length - 1));
      let t = asciiChar.charAt(tIndex);
      textSize(size);

      if (t === "!") {
        fill(50, 50, 50, 0);
      } else {
        fill(100, 255);
      }
      
      text(t, x + 100, y);
    }
  }
}

async function fetchCloudData() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    windSpeed = data.wind.speed;
    cloudCondition = data.weather[0].description;
    
    //THIS IS FOR TESTING AND THE DEMO!!!
    //cloudCondition = "overcast";
    /////////////////////////////////////

    charset = getCharsetForCondition(cloudCondition)
    remappedCloud = remapToAsciiShape(cloudShape, charset);

    poemInterval = map(windSpeed, 0, 15, 10000, 3000, true);

    // print data info
    displayPoem(cloudCondition, windSpeed);

    displayClouds(cloudCondition, windSpeed);

    console.log("Cloud data:", data);
  } catch (err) {
    console.error("Error fetching cloud data:", err);
    overlayText = "Error fetching cloud data. Check console.";
  }
}

function displayPoem (condition, speed) {
  let shortgrammar = new RiGrammar({

    "<start>": [
      "<shortForecast>"
    ],
    "<adj>": ["restless", "swollen", "flickering", "anxious", "roaring", "silent", "charged", "unaware", "heated", "drifting"],
    "<noun>": ["wires", "information", "data", "sparks", "signals", "algorithms", "code"],
    "<verb>": ["swells", "burns", "expands", "consumes", "rushes", "drifts", "echoes", "unfolds"],
    "<phenomenon>": ["data storms", "electric fronts", "thermal updrafts", "digital winds", "algorithmic haze", "carbon fog"],
    "<warning>": ["take heed", "listen closely", "slow your pulse", "preserve what remains", "remember your weight"],
    "<time>": ["soon", "by dusk", "through the night", "before long", "with each passing second", "as cycles turn"],

    "<shortForecast>": [
      "Expect <phenomenon> <time>.",
      "Forecast: <adj> <noun> and <phenomenon> ahead.",
      "A brief signal through the air — <phenomenon> approach."
    ]
  });

  let mediumGrammar = new RiGrammar({

    "<start>": [
      "<mediumForecast>"
    ],
    "<adj>": ["restless", "swollen", "flickering", "anxious", "roaring", "silent", "charged", "unaware", "heated", "drifting"],
    "<noun>": ["wires", "information", "data", "sparks", "signals", "algorithms", "code"],
    "<verb>": ["swells", "burns", "expands", "consumes", "rushes", "drifts", "echoes", "unfolds"],
    "<phenomenon>": ["data storms", "electric fronts", "thermal updrafts", "digital winds", "algorithmic haze", "carbon fog"],
    "<warning>": ["take heed", "listen closely", "slow your pulse", "preserve what remains", "remember your weight"],
    "<time>": ["soon", "by dusk", "through the night", "before long", "with each passing second", "as cycles turn"],

    "<mediumForecast>": [
      "Winds of <adj> memory <verb> beneath us. Expect <phenomenon> <time>.",
      "We drift and watch as <phenomenon> <verb> through your restless networks.",
      "A front of <phenomenon> gathers, urging you to <warning>."
    ]
  });

  let longGrammar = new RiGrammar({

    "<start>": [
      "<longForecast>"
    ],
    "<adj>": ["restless", "temporal", "flickering", "anxious", "roaring", "silent", "charged", "unaware", "heated", "drifting"],
    "<noun>": ["wires", "information", "data", "sparks", "signals", "algorithms", "code"],
    "<sentNoun>": ["legacy", "ancestry", "lineage", "memory", "love", "care"],
    "<verb>": ["swells", "burns", "expands", "consumes", "rushes", "drifts", "echoes", "unfolds"],
    "<phenomenon>": ["data storms", "electric fronts", "thermal updrafts", "digital winds", "algorithmic haze", "carbon fog"],
    "<warning>": ["take heed", "listen closely", "slow your pulse", "preserve what remains", "remember your weight"],
    "<time>": ["soon", "by dusk", "through the night", "before long", "with each passing second", "as cycles turn"],

    "<longForecast>": [
      "From horizon to horizon, a dense layer forms. <phenomenon> <verb> beneath the surface, and the digital sky grows <adj>. Forecast: mounting pressure and restless winds. We urge you to <warning>.",
      "How do the <phenomenon> carry a sense of <sentNoun>? With their <adj> <noun>, we feel a desire for them to make their way back home <time>. Whispering to us to <warning>",
      "An approaching mass signals change. <phenomenon> build, circuits grow <adj>, and we forecast a long night ahead. We speak through layered skies: <warning>."
    ]
  });


  console.log(condition);

  if (condition.includes("clear")) {
    //add something generative & poetic first then...
    overlayText = "the clouds drift too far to speak\ncome back on a cloudy day";
  } else if (condition.includes("few")) {
    overlayText = shortgrammar.expand();
  } else if (condition.includes("scattered")) {
    overlayText = mediumGrammar.expand();
  } else if (condition.includes("broken")) {
    overlayText = mediumGrammar.expand();
  } else if (condition.includes("overcast")) {
    overlayText = longGrammar.expand();
  } else {
    overlayText = longGrammar.expand(); // this mainly for testing, in the future need to fold the other things into this
  }
}

// cloud construct
function displayClouds (condition, speed) {
  clouds = [];
  let numClouds = 0;
  /* 
  this needs to create clouds with the following parameters
  each cloud has a randomized y value 
  a constantly moving x value that increases on a multiple of SPEED
  need an amount of clouds that relates to CONDITION
  */

  if (condition.includes("clear")) {
    numClouds = 0;
  } else if (condition.includes("few")) {
    numClouds = 5;
  } else if (condition.includes("scattered")) {
    numClouds = 10;
  } else if (condition.includes("broken")) {
    numClouds = 15;
  } else if (condition.includes("overcast")) {
    numClouds = 20;
  } else {
    numClouds = 20; // mainly for testing
  }

  // add the clouds to the clouds array
  for (let i = 0; i < numClouds; i++) {
    clouds.push({
      x: random(width), // idk about this one
      y: random(0, height/2),
      speed: speed * 0.5, // scaling the speed based on wind speed
      size: random(10, 15),
      shape: remappedCloud//remapToAsciiShape(cloudShape, charset, i)
    });
  }
}

function drawCloud(cloud) {
  //push()
  fill(100, 100);
  textSize(cloud.size);
  textLeading(cloud.size * 1.2);

  textAlign(CENTER, TOP);
  text(cloud.shape, cloud.x, cloud.y);
  //pop();
}

function getCharsetForCondition(condition) {
  if (condition.includes("few")) {
    return lightSet;
  } else if (condition.includes("scattered")) {
    return mediumSet;
  } else if (condition.includes("broken")) {
    return mediumSet;
  } else if (condition.includes("overcast")) {
    return heavySet;
  } else {
    return ""; // clear sky
  }
}

function remapToAsciiShape(shape, charset, seed = null) {
  if (charset.length === 0) return "";
  if (seed !== null) randomSeed(seed); 
  let result = "";
  for (let i = 0; i < shape.length; i++) {
    const ch = shape[i];
    if (ch === " " || ch === "\n") {
      result += ch;
    } else {
      result += charset.charAt(floor(random(charset.length)));
    }
  }
  return result;
}

