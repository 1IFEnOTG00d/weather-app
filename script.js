let map;
let marker;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// Initialize app when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  getLocationWeather();
});

// Initialize Leaflet Map
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([20, 0], 2);

  // Dark theme tile layer from CartoDB
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
}

// Attach Event Listeners
function setupEventListeners() {
  const searchBtn = document.getElementById('searchBtn');
  const locBtn = document.getElementById('locBtn');
  const cityInput = document.getElementById('cityInput');

  // Click events
  searchBtn.addEventListener('click', getWeatherByCity);
  locBtn.addEventListener('click', getLocationWeather);

  // Press 'Enter' key inside search input
  cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      getWeatherByCity();
    }
  });
}

// Fly map camera smoothly to new coordinates
function updateMapLocation(lat, lon) {
  map.flyTo([lat, lon], 10, { duration: 2.5 });

  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    marker = L.marker([lat, lon]).addTo(map);
  }
}

// Get user location using Browser Geolocation API
function getLocationWeather() {
  const errorDiv = document.getElementById('error');
  errorDiv.innerText = '';

  if (!navigator.geolocation) {
    errorDiv.innerText = 'Geolocation is not supported by your browser.';
    return;
  }

  errorDiv.innerText = 'Detecting location...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      errorDiv.innerText = '';
      const { latitude, longitude } = position.coords;
      await fetchWeatherByCoords(latitude, longitude);
    },
    (err) => {
      errorDiv.innerText = 'Location access denied. Search manually.';
    }
  );
}

// Fetch Weather Data by Coordinates
async function fetchWeatherByCoords(lat, lon, customName = null) {
  const errorDiv = document.getElementById('error');
  const weatherDiv = document.getElementById('weather');

  try {
    let locationName = customName;

    // Reverse Geocoding via BigDataCloud (Free, No Key)
    if (!locationName) {
      const geoRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      const geoData = await geoRes.json();
      locationName = `${geoData.city || geoData.locality || 'Current Location'}, ${geoData.countryCode || ''}`;
    }

    // Weather Data via Open-Meteo
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    // Render UI Data
    document.getElementById('cityName').innerText = locationName;
    document.getElementById('temp').innerText = `${Math.round(current.temperature_2m)}°C`;
    document.getElementById('humidity').innerText = current.relative_humidity_2m;
    document.getElementById('wind').innerText = current.wind_speed_10m;
    document.getElementById('condition').innerText = getWeatherCondition(current.weather_code);

    weatherDiv.style.display = 'block';

    // Move map background
    updateMapLocation(lat, lon);
  } catch (err) {
    errorDiv.innerText = 'Failed to load weather data.';
    weatherDiv.style.display = 'none';
  }
}

// Search Weather by City Name
async function getWeatherByCity() {
  const cityInput = document.getElementById('cityInput');
  const city = cityInput.value.trim();
  const errorDiv = document.getElementById('error');

  errorDiv.innerText = '';
  if (!city) return;

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      errorDiv.innerText = 'City not found.';
      return;
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    await fetchWeatherByCoords(latitude, longitude, `${name}, ${country}`);
  } catch (err) {
    errorDiv.innerText = 'Failed to search city.';
  }
}

// Convert WMO Weather Codes to Human-Readable Text
function getWeatherCondition(code) {
  const codes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    95: 'Thunderstorm'
  };
  return codes[code] || 'Unknown conditions';
}