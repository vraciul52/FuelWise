// Application data from provided JSON
const APP_DATA = {
    fuel_prices: {
        "Netherlands": { petrol_95: 1.94, diesel: 1.70, lpg: 0.77 },
        "Belgium": { petrol_95: 1.56, diesel: 1.65, lpg: 0.82 },
        "Germany": { petrol_95: 1.67, diesel: 1.60, lpg: 1.03 },
        "Luxembourg": { petrol_95: 1.49, diesel: 1.45, lpg: 0.69 }
    },
    car_models: {
        "VW Polo (2011)": { fuel_consumption: 6.9, tank_capacity: 45, fuel_type: "petrol_95" },
        "VW Golf": { fuel_consumption: 6.5, tank_capacity: 50, fuel_type: "petrol_95" },
        "BMW 3 Series": { fuel_consumption: 7.2, tank_capacity: 59, fuel_type: "petrol_95" },
        "Toyota Corolla": { fuel_consumption: 5.8, tank_capacity: 50, fuel_type: "petrol_95" },
        "Ford Focus": { fuel_consumption: 6.4, tank_capacity: 52, fuel_type: "petrol_95" },
        "Renault Clio": { fuel_consumption: 5.5, tank_capacity: 45, fuel_type: "petrol_95" },
        "Opel Astra": { fuel_consumption: 6.1, tank_capacity: 52, fuel_type: "petrol_95" }
    },
    currency_rates: {
        EUR_USD: 1.06, EUR_GBP: 0.84, USD_EUR: 0.94,
        USD_GBP: 0.79, GBP_EUR: 1.19, GBP_USD: 1.27
    }
};

// Global state - using session variables instead of localStorage
let calculationHistory = [];
let calculatorMemory = 0;
let calculatorInput = '0';
let calculatorOperator = null;
let calculatorPreviousInput = null;
let calculatorWaitingForNewInput = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeFuelCalculator();
    initializeScientificCalculator();
    initializeCurrencyConverter();
    loadCalculationHistory();
});

// Tab Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Update tab buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab contents
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Fuel Calculator Functions
function initializeFuelCalculator() {
    const carModelSelect = document.getElementById('car-model');
    const fuelConsumption = document.getElementById('fuel-consumption');
    const tankCapacity = document.getElementById('tank-capacity');
    const amountRadios = document.querySelectorAll('input[name="amount-type"]');
    const customAmount = document.getElementById('custom-amount');
    const calculateBtn = document.getElementById('calculate-btn');
    const clearHistoryBtn = document.getElementById('clear-history');

    // Car model selection
    carModelSelect.addEventListener('change', function() {
        if (this.value && APP_DATA.car_models[this.value]) {
            const car = APP_DATA.car_models[this.value];
            fuelConsumption.value = car.fuel_consumption;
            tankCapacity.value = car.tank_capacity;
            document.getElementById('fuel-type').value = car.fuel_type;
        }
    });

    // Amount type selection
    amountRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            customAmount.disabled = this.value === 'full';
            if (this.value === 'full') {
                customAmount.value = '';
            }
        });
    });

    // Calculate button
    calculateBtn.addEventListener('click', function(e) {
        e.preventDefault();
        calculateFuelSavings();
    });

    // Clear history button
    clearHistoryBtn.addEventListener('click', function(e) {
        e.preventDefault();
        calculationHistory = [];
        loadCalculationHistory();
    });

    // Auto-calculate on input change
    const inputs = ['distance', 'fuel-price', 'fuel-consumption', 'tank-capacity', 'custom-amount'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', debounce(() => {
                if (validateInputs()) {
                    calculateFuelSavings();
                }
            }, 500));
        }
    });

    // Initialize with default calculation if inputs are valid
    setTimeout(() => {
        if (validateInputs()) {
            calculateFuelSavings();
        }
    }, 100);
    // ---- LIVE FUEL PRICE API INTEGRATION ----
    const fetchBtn = document.getElementById('fetch-live-prices-btn');
    const cacheStatusEl = document.getElementById('price-cache-status');
    const loadingEl = document.getElementById('api-loading');
    const errorEl = document.getElementById('api-error');
    const fuelPriceInput = document.getElementById('fuel-price');
    const countrySelect = document.getElementById('country-select');
    const fuelTypeSelect = document.getElementById('fuel-type');

    if (fetchBtn) {
        fetchBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // Currently backend returns NL averages – guard UX a bit:
            if (countrySelect && countrySelect.value !== 'Netherlands') {
                errorEl.textContent = 'Live price API currently supports Netherlands average prices. Please select Netherlands or enter a custom price.';
                errorEl.style.display = 'block';
                cacheStatusEl.style.display = 'none';
                return;
            }

            // Reset UI states
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            cacheStatusEl.style.display = 'none';
            loadingEl.style.display = 'block';
            fetchBtn.disabled = true;

            try {
                const res = await fetch('/api/fuel-prices');
                if (!res.ok) {
                    throw new Error(`API responded with status ${res.status}`);
                }

                const data = await res.json();

                // Map selected fuel type to field from API
                const fuelType = fuelTypeSelect.value;
                let pricePerLiter;

                if (fuelType === 'petrol_95') {
                    pricePerLiter = data.euro95;
                } else if (fuelType === 'diesel') {
                    pricePerLiter = data.diesel;
                } else {
                    pricePerLiter = data.lpg;
                }

                if (typeof pricePerLiter !== 'number' || isNaN(pricePerLiter)) {
                    throw new Error('API returned invalid price data');
                }

                // Fill input with 3 decimals for precision
                fuelPriceInput.value = pricePerLiter.toFixed(3);

                // Show cache indicator
                const status = data.cacheStatus || 'fresh';
                let message;

                if (status === 'fresh') {
                    message = `Live CBS price (NL, ${data.date}) – fresh data`;
                } else if (status === 'cached') {
                    message = `Live CBS price (NL, ${data.date}) – served from cache`;
                } else if (status === 'stale') {
                    message = `Using last cached value (NL, ${data.date}). Live update failed.`;
                } else {
                    message = `Average NL price on ${data.date}`;
                }

                cacheStatusEl.textContent = message;
                cacheStatusEl.className = 'cache-indicator ' + (status === 'cached' ? 'cached' : 'fresh');
                cacheStatusEl.style.display = 'inline-block';

                // Recalculate results with new price
                if (validateInputs()) {
                    calculateFuelSavings();
                }
            } catch (err) {
                console.error(err);
                errorEl.textContent = 'Could not fetch live prices. Please enter the price manually.';
                errorEl.style.display = 'block';
            } finally {
                loadingEl.style.display = 'none';
                fetchBtn.disabled = false;
            }
        });
    }
}


function validateInputs() {
    const distance = parseFloat(document.getElementById('distance').value) || 0;
    const fuelPrice = parseFloat(document.getElementById('fuel-price').value) || 0;
    return distance > 0 && fuelPrice > 0;
}

function calculateFuelSavings() {
    const distance = parseFloat(document.getElementById('distance').value) || 0;
    const fuelPrice = parseFloat(document.getElementById('fuel-price').value) || 0;
    const fuelConsumption = parseFloat(document.getElementById('fuel-consumption').value) || 6.5;
    const tankCapacity = parseFloat(document.getElementById('tank-capacity').value) || 50;
    const fuelType = document.getElementById('fuel-type').value;
    const amountType = document.querySelector('input[name="amount-type"]:checked').value;
    const customAmountValue = parseFloat(document.getElementById('custom-amount').value) || 0;

    // Validation
    if (distance <= 0 || fuelPrice <= 0) {
        hideResults();
        return;
    }

    // Calculate amount of fuel needed
    const fuelAmount = amountType === 'full' ? tankCapacity : customAmountValue;
    if (fuelAmount <= 0) {
        hideResults();
        return;
    }

    // Calculate costs
    const fuelCost = fuelAmount * fuelPrice;
    const travelDistance = distance * 2; // Round trip
    const travelFuelNeeded = (travelDistance * fuelConsumption) / 100;
    const travelCost = travelFuelNeeded * fuelPrice;
    const totalCost = fuelCost + travelCost;

    // Calculate savings vs Netherlands
    const netherlandsPrice = APP_DATA.fuel_prices.Netherlands[fuelType];
    const netherlandsCost = fuelAmount * netherlandsPrice;
    const savings = netherlandsCost - totalCost;

    // Display results
    displayResults(fuelCost, travelCost, totalCost, savings);
    displayComparison(fuelAmount, fuelType, distance, fuelConsumption, fuelPrice);

    // Save to history
    saveCalculation({
        distance, fuelPrice, fuelType, fuelAmount, totalCost, savings,
        timestamp: new Date().toISOString()
    });
}

function displayResults(fuelCost, travelCost, totalCost, savings) {
    // Update result values
    document.getElementById('fuel-cost').textContent = `€${fuelCost.toFixed(2)}`;
    document.getElementById('travel-cost').textContent = `€${travelCost.toFixed(2)}`;
    document.getElementById('total-cost').textContent = `€${totalCost.toFixed(2)}`;
    
    const savingsElement = document.getElementById('savings');
    savingsElement.textContent = `€${Math.abs(savings).toFixed(2)}`;
    savingsElement.className = 'result-value savings ' + (savings >= 0 ? 'positive' : 'negative');
    
    const savingsItem = document.querySelector('.savings-item .result-label');
    savingsItem.textContent = savings >= 0 ? 'Savings vs Netherlands' : 'Extra Cost vs Netherlands';

    // Show results card
    const resultsCard = document.getElementById('results-card');
    resultsCard.style.display = 'block';
    resultsCard.classList.add('fade-in');
}

function displayComparison(fuelAmount, fuelType, distance, fuelConsumption, targetPrice) {
    const comparisonRows = document.getElementById('comparison-rows');
    comparisonRows.innerHTML = '';

    const countries = Object.keys(APP_DATA.fuel_prices);
    const comparisons = [];

    // Calculate target station cost for comparison
    const targetFuelCost = fuelAmount * targetPrice;
    const travelDistance = distance * 2;
    const travelFuelNeeded = (travelDistance * fuelConsumption) / 100;
    const targetTravelCost = travelFuelNeeded * targetPrice;
    const targetTotalCost = targetFuelCost + targetTravelCost;

    countries.forEach(country => {
        const countryPrice = APP_DATA.fuel_prices[country][fuelType];
        const localFuelCost = fuelAmount * countryPrice;
        // Assume local stations don't require travel
        const localTotalCost = localFuelCost;
        const savings = localTotalCost - targetTotalCost;

        comparisons.push({
            country, 
            countryPrice, 
            totalCost: localTotalCost, 
            savings: savings
        });
    });

    // Add the target station as a comparison point
    comparisons.push({
        country: 'Target Station',
        countryPrice: targetPrice,
        totalCost: targetTotalCost,
        savings: 0
    });

    // Sort by total cost (lowest first)
    comparisons.sort((a, b) => a.totalCost - b.totalCost);

    comparisons.forEach((comp, index) => {
        const row = document.createElement('div');
        row.className = 'comparison-row' + (index === 0 ? ' best' : '');
        
        const savingsClass = comp.savings >= 0 ? 'positive' : 'negative';
        const savingsText = comp.savings === 0 ? '€0.00' : 
            (comp.savings >= 0 ? `+€${comp.savings.toFixed(2)}` : `-€${Math.abs(comp.savings).toFixed(2)}`);
        
        row.innerHTML = `
            <span>${comp.country}</span>
            <span>€${comp.countryPrice.toFixed(2)}</span>
            <span>€${comp.totalCost.toFixed(2)}</span>
            <span class="savings ${savingsClass}">${savingsText}</span>
        `;
        
        comparisonRows.appendChild(row);
    });

    // Show comparison card
    const comparisonCard = document.getElementById('comparison-card');
    comparisonCard.style.display = 'block';
    comparisonCard.classList.add('fade-in');
}

function hideResults() {
    document.getElementById('results-card').style.display = 'none';
    document.getElementById('comparison-card').style.display = 'none';
}

function saveCalculation(calculation) {
    calculationHistory.unshift(calculation);
    if (calculationHistory.length > 10) {
        calculationHistory = calculationHistory.slice(0, 10);
    }
    loadCalculationHistory();
}

function loadCalculationHistory() {
    const historyContainer = document.getElementById('calculation-history');
    
    if (calculationHistory.length === 0) {
        historyContainer.innerHTML = '<p class="empty-state">No calculations yet</p>';
        return;
    }

    historyContainer.innerHTML = calculationHistory.map(calc => {
        const date = new Date(calc.timestamp).toLocaleDateString();
        const time = new Date(calc.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const savingsClass = calc.savings >= 0 ? 'positive' : 'negative';
        const savingsText = calc.savings >= 0 ? `Saved €${calc.savings.toFixed(2)}` : `Cost €${Math.abs(calc.savings).toFixed(2)} extra`;
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <strong>€${calc.totalCost.toFixed(2)} total</strong>
                    <span class="savings ${savingsClass}">${savingsText}</span>
                </div>
                <div class="history-item-details">
                    ${calc.distance}km • €${calc.fuelPrice.toFixed(2)}/L • ${calc.fuelAmount}L ${calc.fuelType} • ${date} ${time}
                </div>
            </div>
        `;
    }).join('');
}

// Scientific Calculator Functions
function initializeScientificCalculator() {
    const buttons = document.querySelectorAll('.calc-btn');

    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handleCalculatorInput(e);
        });
    });

    // Keyboard support
    document.addEventListener('keydown', handleCalculatorKeyboard);
}

function handleCalculatorInput(event) {
    const button = event.target;
    const action = button.dataset.action;
    const number = button.dataset.number;

    if (number !== undefined) {
        inputNumber(number);
    } else if (action) {
        handleCalculatorAction(action);
    }

    updateCalculatorDisplay();
}

function handleCalculatorKeyboard(event) {
    if (document.querySelector('.tab-content.active').id !== 'calculator-tab') return;

    const key = event.key;
    
    if ('0123456789'.includes(key)) {
        inputNumber(key);
    } else if (key === '.') {
        handleCalculatorAction('decimal');
    } else if (key === '+') {
        handleCalculatorAction('add');
    } else if (key === '-') {
        handleCalculatorAction('subtract');
    } else if (key === '*') {
        handleCalculatorAction('multiply');
    } else if (key === '/') {
        handleCalculatorAction('divide');
    } else if (key === 'Enter' || key === '=') {
        handleCalculatorAction('equals');
    } else if (key === 'Escape') {
        handleCalculatorAction('clear-all');
    } else if (key === 'Backspace') {
        handleCalculatorAction('backspace');
    }

    updateCalculatorDisplay();
}

function inputNumber(num) {
    if (calculatorWaitingForNewInput) {
        calculatorInput = num;
        calculatorWaitingForNewInput = false;
    } else {
        calculatorInput = calculatorInput === '0' ? num : calculatorInput + num;
    }
}

function handleCalculatorAction(action) {
    switch (action) {
        case 'clear-all':
            calculatorInput = '0';
            calculatorOperator = null;
            calculatorPreviousInput = null;
            calculatorWaitingForNewInput = false;
            break;
        
        case 'clear':
            calculatorInput = '0';
            break;
        
        case 'backspace':
            calculatorInput = calculatorInput.length > 1 ? 
                calculatorInput.slice(0, -1) : '0';
            break;
        
        case 'decimal':
            if (!calculatorInput.includes('.')) {
                calculatorInput += '.';
            }
            break;
        
        case 'add':
        case 'subtract':
        case 'multiply':
        case 'divide':
        case 'power':
            handleOperator(action);
            break;
        
        case 'equals':
            calculate();
            break;
        
        case 'sin':
        case 'cos':
        case 'tan':
        case 'log':
        case 'ln':
        case 'sqrt':
            handleScientificFunction(action);
            break;
        
        case 'pi':
            calculatorInput = Math.PI.toString();
            calculatorWaitingForNewInput = true;
            break;
        
        case 'e':
            calculatorInput = Math.E.toString();
            calculatorWaitingForNewInput = true;
            break;
        
        case 'memory-store':
            calculatorMemory = parseFloat(calculatorInput);
            break;
        
        case 'memory-recall':
            calculatorInput = calculatorMemory.toString();
            calculatorWaitingForNewInput = true;
            break;
    }
}

function handleOperator(operator) {
    const inputValue = parseFloat(calculatorInput);
    
    if (calculatorPreviousInput === null) {
        calculatorPreviousInput = inputValue;
    } else if (calculatorOperator && !calculatorWaitingForNewInput) {
        const result = performCalculation(calculatorPreviousInput, inputValue, calculatorOperator);
        calculatorInput = result.toString();
        calculatorPreviousInput = result;
    }
    
    calculatorWaitingForNewInput = true;
    calculatorOperator = operator;
}

function handleScientificFunction(func) {
    const inputValue = parseFloat(calculatorInput);
    let result;
    
    switch (func) {
        case 'sin':
            result = Math.sin(inputValue);
            break;
        case 'cos':
            result = Math.cos(inputValue);
            break;
        case 'tan':
            result = Math.tan(inputValue);
            break;
        case 'log':
            result = Math.log10(inputValue);
            break;
        case 'ln':
            result = Math.log(inputValue);
            break;
        case 'sqrt':
            result = Math.sqrt(inputValue);
            break;
    }
    
    calculatorInput = result.toString();
    calculatorWaitingForNewInput = true;
}

function calculate() {
    if (calculatorOperator && calculatorPreviousInput !== null && !calculatorWaitingForNewInput) {
        const inputValue = parseFloat(calculatorInput);
        const result = performCalculation(calculatorPreviousInput, inputValue, calculatorOperator);
        calculatorInput = result.toString();
        calculatorOperator = null;
        calculatorPreviousInput = null;
        calculatorWaitingForNewInput = true;
    }
}

function performCalculation(first, second, operator) {
    switch (operator) {
        case 'add':
            return first + second;
        case 'subtract':
            return first - second;
        case 'multiply':
            return first * second;
        case 'divide':
            return second !== 0 ? first / second : 0;
        case 'power':
            return Math.pow(first, second);
        default:
            return second;
    }
}

function updateCalculatorDisplay() {
    const display = document.getElementById('calc-display');
    const displayValue = parseFloat(calculatorInput);
    
    if (isNaN(displayValue)) {
        display.value = 'Error';
    } else {
        display.value = displayValue.toString().length > 12 ? 
            displayValue.toExponential(6) : calculatorInput;
    }
}

// Currency Converter Functions
function initializeCurrencyConverter() {
    const amountInput = document.getElementById('currency-amount');
    const fromSelect = document.getElementById('currency-from');
    const toSelect = document.getElementById('currency-to');
    const swapButton = document.getElementById('swap-currencies');

    // Event listeners
    amountInput.addEventListener('input', updateCurrencyConversion);
    fromSelect.addEventListener('change', updateCurrencyConversion);
    toSelect.addEventListener('change', updateCurrencyConversion);
    swapButton.addEventListener('click', function(e) {
        e.preventDefault();
        swapCurrencies();
    });

    // Initial conversion
    updateCurrencyConversion();
}

function updateCurrencyConversion() {
    const amount = parseFloat(document.getElementById('currency-amount').value) || 0;
    const fromCurrency = document.getElementById('currency-from').value;
    const toCurrency = document.getElementById('currency-to').value;
    
    const rate = getExchangeRate(fromCurrency, toCurrency);
    const result = amount * rate;
    
    document.getElementById('conversion-result').textContent = 
        `${result.toFixed(2)} ${toCurrency}`;
    document.getElementById('exchange-rate-display').textContent = 
        `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;
}

function getExchangeRate(from, to) {
    if (from === to) return 1;
    
    const rateKey = `${from}_${to}`;
    if (APP_DATA.currency_rates[rateKey]) {
        return APP_DATA.currency_rates[rateKey];
    }
    
    // If direct rate not available, try reverse
    const reverseKey = `${to}_${from}`;
    if (APP_DATA.currency_rates[reverseKey]) {
        return 1 / APP_DATA.currency_rates[reverseKey];
    }
    
    return 1; // Fallback
}

function swapCurrencies() {
    const fromSelect = document.getElementById('currency-from');
    const toSelect = document.getElementById('currency-to');
    
    const fromValue = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = fromValue;
    
    updateCurrencyConversion();
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}