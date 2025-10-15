let damageData;
let obits = [];
let totalAmount = 0;
let earliestDate = null;
let map;
let obit = "approach screen to generate obit"

// start with creating a variable of the data! 
//const url = 'https://data.cityofnewyork.us/resource/68k5-hdzw.json?$order=accidentdate DESC&$limit=100'; //filtering by 100 most recent entries
const url = 'https://data.cityofnewyork.us/resource/68k5-hdzw.geojson?$order=accidentdate DESC&$limit=100';

// load data async function
async function loadData() {
  try {
    const response = await fetch(url);
    damageData = await response.json();

    if (!damageData || damageData.length === 0) {
      console.log("No records returned from API");
      return;
    }

    console.log(`Fetched ${damageData.length} most recent records`);

    for (let entry of damageData) {
      let accidentDate = entry.accidentdate ? new Date(entry.accidentdate) : null;

      // total amoung
      if (entry.requestamount) {
        const num = parseFloat(entry.requestamount);
        if (!isNaN(num)) {
          totalAmount += num;
        }
      }

      // identify the earliest date in the dataset
      if (accidentDate && !isNaN(accidentDate)) {
        if (earliestDate === null || accidentDate < earliestDate) {
          earliestDate = accidentDate;
        }
      }

      // obit generation (work on this section!)
      let description = (entry.description || "unknown property").toLowerCase();
      let location = (entry.location || "unknown location").toLowerCase();
      let amount = entry.requestamount ? entry.requestamount.toString() : "unknown amount";
      let dateString = accidentDate ? accidentDate.toDateString().toLowerCase() : "an unknown date";

      obits.push(
        `a ${description} passed away at\n${location} on ${dateString}.\nits life was worth $${amount} to the city`
      );

      // labels
      if (entry.latitude && entry.longitude) {
        const lat = parseFloat(entry.latitude);
        const lon = parseFloat(entry.longitude);

        if (!isNaN(lat) && !isNaN(lon)) {
          L.circleMarker([lat, lon], {
            radius: 5,
            color: '#d00',
            fillColor: '#f03',
            fillOpacity: 0.7
          })
            .bindPopup(`<strong>${description}</strong><br>${location}<br>${dateString}<br>$${amount}`)
            .addTo(map);
        }
      }
    }

    console.log(`Earliest date: ${earliestDate}`);
    console.log(`Total amount: $${totalAmount.toLocaleString()}`);

  } catch (error) {
    console.error("Error loading damage data:", error);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  clear();

  // set up the map
  if (!map) {
    map = L.map('map').setView([40.7128, -74.0060], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  // set up the poems and data on the screen
  loadData();
}

function draw() {
  clear();
  
  const x = windowWidth/2 - 250;
  const y = windowHeight/2;
  textWrap(WORD);
  textFont('Courier New');
  textSize(18)
  fill(24, 24, 24);
  textAlign(CENTER, CENTER);

  text(obit, x, y, 500);
  
}

function mouseClicked() {
  if (obits.length === 0) {
    obit = "No data available";
    return;
  }

  const random = Math.floor(Math.random() * obits.length);
  obit = obits[random];
}