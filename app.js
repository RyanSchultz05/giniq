// Configuration
const CONFIG = {
    GOOGLE_VISION_API_KEY: 'AIzaSyBXFFKzMQJCeRcUYx0PAeCH8SHgIG0-zN0', // Replace with your Google Cloud Vision API key
    SCAN_INTERVAL: 2000, // Scan every 2 seconds
    CONFIDENCE_THRESHOLD: 0.5
};

// State
let model = null;
let isScanning = false;
let lastScanTime = 0;
let currentGinData = null;

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const bottleCard = document.getElementById('bottleCard');
const collectionView = document.getElementById('collectionView');
const loadingOverlay = document.getElementById('loadingOverlay');
const detectionStatus = document.getElementById('detectionStatus');

// Initialize App
async function initApp() {
    try {
        // Load TensorFlow model
        showLoading('Loading AI model...');
        model = await cocoSsd.load();
        hideLoading();

        // Initialize camera
        await initCamera();

        // Start scanning
        startScanning();

        // Initialize event listeners
        initEventListeners();

        // Load collection count
        updateCollectionCount();

    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize app. Please check camera permissions.');
    }
}

// Initialize Camera
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });
    } catch (error) {
        console.error('Camera error:', error);
        throw error;
    }
}

// Start Scanning
function startScanning() {
    isScanning = true;
    scanLoop();
}

// Scan Loop
async function scanLoop() {
    if (!isScanning) return;

    const now = Date.now();

    // Throttle scans
    if (now - lastScanTime >= CONFIG.SCAN_INTERVAL) {
        lastScanTime = now;
        await detectBottle();
    }

    requestAnimationFrame(scanLoop);
}

// Detect Bottle
async function detectBottle() {
    if (!model || video.readyState !== 4) return;

    try {
        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Run object detection
        const predictions = await model.detect(canvas);

        // Look for bottle
        const bottle = predictions.find(pred =>
            pred.class === 'bottle' && pred.score >= CONFIG.CONFIDENCE_THRESHOLD
        );

        if (bottle) {
            updateDetectionStatus('Bottle detected!', true);
            await analyzeBottle();
        } else {
            updateDetectionStatus('Scanning...', false);
        }

    } catch (error) {
        console.error('Detection error:', error);
    }
}

// Update Detection Status
function updateDetectionStatus(message, detected) {
    const statusEl = document.querySelector('.detection-status span');
    const dotEl = document.querySelector('.status-dot');

    if (statusEl) statusEl.textContent = message;
    if (dotEl) {
        dotEl.style.background = detected ? '#00D9A3' : '#6C63FF';
    }
}

// Analyze Bottle (using Google Cloud Vision API)
async function analyzeBottle() {
    try {
        showLoading('Analyzing bottle...');

        // Capture image
        canvas.toBlob(async (blob) => {
            const base64Image = await blobToBase64(blob);

            // Call Google Cloud Vision API
            const brandInfo = await detectBrand(base64Image);

            // Generate gin data
            currentGinData = await generateGinData(brandInfo);

            // Show bottle card
            displayBottleCard(currentGinData);

            hideLoading();
        }, 'image/jpeg', 0.9);

    } catch (error) {
        console.error('Analysis error:', error);
        hideLoading();
        alert('Failed to analyze bottle. Please try again.');
    }
}

// Detect Brand using Google Cloud Vision API
async function detectBrand(base64Image) {
    if (!CONFIG.GOOGLE_VISION_API_KEY || CONFIG.GOOGLE_VISION_API_KEY === 'YOUR_API_KEY_HERE') {
        // Fallback: Simulate brand detection
        console.warn('Google Vision API key not configured. Using mock data.');
        return {
            brand: 'Bombay Sapphire',
            confidence: 0.95
        };
    }

    try {
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${CONFIG.GOOGLE_VISION_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        image: {
                            content: base64Image.split(',')[1]
                        },
                        features: [
                            { type: 'LOGO_DETECTION', maxResults: 5 },
                            { type: 'TEXT_DETECTION', maxResults: 5 },
                            { type: 'LABEL_DETECTION', maxResults: 10 }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();
        const result = data.responses[0];

        // Debug: Log what Vision API found
        console.log('Vision API Response:', result);
        if (result.logoAnnotations) {
            console.log('Logos detected:', result.logoAnnotations.map(l => l.description));
        }
        if (result.textAnnotations) {
            console.log('Text detected:', result.textAnnotations[0]?.description);
        }
        if (result.labelAnnotations) {
            console.log('Labels detected:', result.labelAnnotations.map(l => l.description));
        }

        // Extract brand from logos or text
        let brand = 'Unknown Gin';
        let confidence = 0.5;

        if (result.logoAnnotations && result.logoAnnotations.length > 0) {
            brand = result.logoAnnotations[0].description;
            confidence = result.logoAnnotations[0].score;
            console.log('Brand from logo:', brand);
        } else if (result.textAnnotations && result.textAnnotations.length > 0) {
            // Try to extract brand from text
            const text = result.textAnnotations[0].description;
            brand = extractBrandFromText(text);
            confidence = 0.7;
            console.log('Brand from text:', brand);
        }

        return {
            brand: brand,
            confidence: confidence
        };

    } catch (error) {
        console.error('Vision API error:', error);
        return {
            brand: 'Unknown Gin',
            confidence: 0.5
        };
    }
}

// Extract Brand from Text
function extractBrandFromText(text) {
    const ginBrands = [
        // Popular brands
        'Tanqueray', 'Bombay Sapphire', 'Bombay', 'Hendricks', "Hendrick's", 'Beefeater',
        'Gordon', "Gordon's", 'Plymouth', 'Aviation', 'Monkey 47', 'The Botanist',
        'Roku', 'Sipsmith', 'Whitley Neill', 'Martin Miller', 'Gin Mare',
        'Bulldog', 'Bloom', 'Citadelle', 'Hayman', 'Bobby', 'Nikka',
        // Additional brands
        'Seagram', 'New Amsterdam', 'Tanqueray No. Ten', 'Nolet', 'Botanist',
        'Malfy', 'Ki No Bi', 'Four Pillars', 'Drumshanbo', 'Gunpowder',
        'Hendrick\'s', 'St George', 'Death\'s Door', 'Few', 'Bluecoat',
        'Brooklyn', 'Barr Hill', 'Uncle Val', 'Boodles', 'Broker',
        'Oxley', 'Gilbey', 'Star of Bombay', 'Empress', 'Aviation American',
        'Seedlip', 'Larios', 'MOM', 'Caorunn', 'Edinburgh', 'Isle of Harris',
        'Sacred', 'Dodd', 'Bruichladdich', 'Tarquin', 'Warner Edwards',
        'Cotswolds', 'Cambridge', 'Thomas Dakin', 'Kirkjuvagr', 'Napue',
        'Bols', 'Genever', 'Boomsma', 'Zuidam', 'Makar', 'Jinzu',
        'Nikka Coffey', 'Etsu', 'Suntory', 'Sakurao', 'Bombay Original'
    ];

    // Try exact matches first (case insensitive)
    for (const brand of ginBrands) {
        if (text.toUpperCase().includes(brand.toUpperCase())) {
            console.log(`Matched brand: ${brand} in text: ${text.substring(0, 100)}`);
            return brand;
        }
    }

    // If no match, look for common gin words
    const ginWords = ['GIN', 'DRY', 'LONDON', 'DISTILLED', 'DISTILLERY'];
    const hasGinWord = ginWords.some(word => text.toUpperCase().includes(word));

    if (hasGinWord) {
        // Try to extract the first capitalized word that might be a brand
        const words = text.split(/\s+/);
        for (const word of words) {
            if (word.length > 3 && word[0] === word[0].toUpperCase() &&
                !ginWords.includes(word.toUpperCase())) {
                console.log(`Guessing brand from word: ${word}`);
                return word;
            }
        }
    }

    return 'Unknown Gin';
}

// Generate Gin Data
async function generateGinData(brandInfo) {
    // This is a mock database. In a real app, you'd query an API or local database
    const ginDatabase = {
        'Bombay Sapphire': {
            country: 'England',
            abv: '47%',
            type: 'London Dry',
            tastingNotes: 'A harmonious blend of ten hand-selected botanicals. Smooth and complex with notes of juniper, lemon peel, and a hint of spice.',
            botanicals: ['Juniper', 'Lemon Peel', 'Coriander', 'Angelica', 'Orris Root', 'Almond', 'Cassia', 'Cubeb', 'Grains of Paradise', 'Liquorice']
        },
        'Tanqueray': {
            country: 'Scotland',
            abv: '47.3%',
            type: 'London Dry',
            tastingNotes: 'Crisp, clean, and perfectly balanced. Notes of piney juniper and zesty citrus with a smooth finish.',
            botanicals: ['Juniper', 'Coriander', 'Angelica Root', 'Liquorice']
        },
        'Hendricks': {
            country: 'Scotland',
            abv: '41.4%',
            type: 'Contemporary',
            tastingNotes: 'Unusually infused with cucumber and rose petals. Floral, refreshing, with a subtle spice and smooth finish.',
            botanicals: ['Juniper', 'Cucumber', 'Rose Petals', 'Coriander', 'Citrus Peel', 'Angelica', 'Orris Root', 'Cubeb Berries', 'Caraway Seeds', 'Chamomile', 'Elderflower']
        },
        "Hendrick's": {
            country: 'Scotland',
            abv: '41.4%',
            type: 'Contemporary',
            tastingNotes: 'Unusually infused with cucumber and rose petals. Floral, refreshing, with a subtle spice and smooth finish.',
            botanicals: ['Juniper', 'Cucumber', 'Rose Petals', 'Coriander', 'Citrus Peel', 'Angelica', 'Orris Root', 'Cubeb Berries', 'Caraway Seeds', 'Chamomile', 'Elderflower']
        },
        'Beefeater': {
            country: 'England',
            abv: '40%',
            type: 'London Dry',
            tastingNotes: 'Bold and citrus-forward. Strong juniper backbone with bright lemon notes and a clean, dry finish.',
            botanicals: ['Juniper', 'Lemon Peel', 'Orange Peel', 'Coriander Seeds', 'Angelica Root', 'Angelica Seeds', 'Almond', 'Orris Root', 'Liquorice']
        }
    };

    // Try exact match first
    let data = ginDatabase[brandInfo.brand];

    // If no exact match, try fuzzy matching
    if (!data) {
        const brandLower = brandInfo.brand.toLowerCase();
        for (const [key, value] of Object.entries(ginDatabase)) {
            if (brandLower.includes(key.toLowerCase()) || key.toLowerCase().includes(brandLower)) {
                console.log(`Fuzzy matched: ${brandInfo.brand} -> ${key}`);
                data = value;
                brandInfo.brand = key; // Update to matched name
                break;
            }
        }
    }

    // Default data if still no match
    if (!data) {
        data = {
            country: 'Unknown',
            abv: '40-47%',
            type: 'London Dry',
            tastingNotes: 'A quality gin with traditional botanicals. Juniper-forward with citrus and herbal notes.',
            botanicals: ['Juniper', 'Coriander', 'Citrus Peel', 'Angelica']
        };
    }

    return {
        name: brandInfo.brand,
        ...data,
        detectedAt: new Date().toISOString()
    };
}

// Display Bottle Card
function displayBottleCard(ginData) {
    document.getElementById('ginName').textContent = ginData.name;
    document.getElementById('country').textContent = ginData.country;
    document.getElementById('abv').textContent = ginData.abv;
    document.getElementById('ginType').textContent = ginData.type;
    document.getElementById('addedDate').textContent = new Date().toLocaleDateString();
    document.getElementById('tastingNotes').textContent = ginData.tastingNotes;

    // Update botanicals
    const botanicalsContainer = document.getElementById('botanicals');
    botanicalsContainer.innerHTML = '';
    ginData.botanicals.forEach(botanical => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = botanical;
        botanicalsContainer.appendChild(tag);
    });

    bottleCard.classList.remove('hidden');
}

// Save to Collection
function saveToCollection(ginData) {
    try {
        let collection = JSON.parse(localStorage.getItem('ginCollection') || '[]');

        // Check if already exists
        const exists = collection.some(item => item.name === ginData.name);

        if (!exists) {
            collection.push({
                ...ginData,
                savedAt: new Date().toISOString()
            });
            localStorage.setItem('ginCollection', JSON.stringify(collection));
            alert(`${ginData.name} added to your collection!`);
        } else {
            alert(`${ginData.name} is already in your collection.`);
        }

        updateCollectionCount();

    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save to collection.');
    }
}

// Load and Display Collection
function loadCollection() {
    const collection = JSON.parse(localStorage.getItem('ginCollection') || '[]');
    const grid = document.getElementById('collectionGrid');

    grid.innerHTML = '';

    if (collection.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No gins in your collection yet. Start scanning!</p>';
        return;
    }

    collection.reverse().forEach(gin => {
        const item = document.createElement('div');
        item.className = 'collection-item';
        item.innerHTML = `
            <h3>${gin.name}</h3>
            <div class="collection-item-info">
                <span>${gin.country}</span>
                <span>${gin.abv}</span>
                <span>${gin.type}</span>
            </div>
        `;

        item.addEventListener('click', () => {
            displayBottleCard(gin);
            collectionView.classList.add('hidden');
        });

        grid.appendChild(item);
    });
}

// Update Collection Count
function updateCollectionCount() {
    const collection = JSON.parse(localStorage.getItem('ginCollection') || '[]');
    const countEl = document.getElementById('collectionCount');
    if (countEl) {
        countEl.textContent = collection.length;
    }
}

// Initialize Event Listeners
function initEventListeners() {
    // Close bottle card
    document.getElementById('closeCard').addEventListener('click', () => {
        bottleCard.classList.add('hidden');
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
        if (currentGinData) {
            saveToCollection(currentGinData);
        }
    });

    // Open collection
    document.getElementById('collectionBtn').addEventListener('click', () => {
        loadCollection();
        collectionView.classList.remove('hidden');
    });

    // Back from collection
    document.getElementById('backBtn').addEventListener('click', () => {
        collectionView.classList.add('hidden');
    });
}

// Utility Functions
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    if (text) text.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Start the app when page loads
window.addEventListener('load', initApp);
