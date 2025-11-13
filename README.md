# FuelWise
**Compare fuel prices across borders and find the cheapest place to refuel — smart, fast, and data-driven.**

FuelWise is a full-stack web application that helps drivers make cost-efficient refueling decisions.
It compares fuel prices across countries, estimates travel cost based on distance and fuel consumption, and visualizes nearby gas stations through an interactive map interface.

The goal is simple: **help users save money by choosing the most economical refueling option.**

# Current Features
- **Cross-Border Fuel Price Comparison**
  - See daily average fuel prices across countries and compare them at a glance.

- **Travel Cost & Savings Calculator**
  - Calculate real savings based on distance, consumption, and fuel price differences.

- **Interactive Map of Gas Stations**
  - Locate nearby stations using geolocation and view them on an interactive Leaflet map.

- **Smart Station Selection**
  - Highlights the most cost-effective station relative to your route and fuel needs.

- **Lightweight & Mobile-Friendly UI**
  - Designed as a fast, simple web app suitable for on-the-go use.

# Planned Features

- **Live per-station fuel prices (DE/BE/FR)**

- **Route-based optimization (cheapest station along your drive)**

- **Savings history dashboard with charts**

- **Price alerts and notifications**

- **PWA support (installable app & offline mode)**

- **Crowdsourced fuel price submissions**

# Tech Stack
## Frontend
- HTML, CSS, JavaScript
- Leaflet.js (interactive maps)
- Fetch API
## Backend
- Node.js + Express
- Axios (API calls)
- Node-Cache (response caching)
## Data Sources
- **CBS Open Data (Netherlands average fuel prices)**
- (Upcoming) Germany, Belgium, France real-time sources
- (Upcoming) User-reported prices and historical tracking

# API Endpoints
`GET /api/fuel-prices`
Returns the latest average fuel prices for the Netherlands (Euro95, Diesel, LPG) using CBS Open Data.

Example response:
```
{
  "date": "2025-11-03",
  "euro95": 1.945,
  "diesel": 1.736,
  "lpg": 0.761,
  "currency": "EUR",
  "unit": "per_liter"
}
```
More endpoints will be added as the project expands.

# How to run locally
**1. Clone the repository**
```
git clone https://github.com/<your-username>/FuelWise.git
cd FuelWise
```
**2. Install dependencies**
```
npm install
```
**3. Start the backend server**
```
node server.js
```
It will run on:
```
http://localhost:3000
```
**4. Open the frontend**
Open index.html in your browser, or use VS Code’s Live Server extension.

# Roadmap

- Add real-time per-station prices for Germany & Belgium
- Route optimization (eco-friendly & cost-efficient routing)
- Price alerts and notifications
- Savings history dashboard
- Progressive Web App (PWA) support
- Authentication + cloud storage
- User-reported prices
