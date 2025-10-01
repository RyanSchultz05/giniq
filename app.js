// Configuration
const CONFIG = {
    GOOGLE_VISION_API_KEY: 'AIzaSyBXFFKzMQJCeRcUYx0PAeCH8SHgIG0-zN0',
    GEMINI_API_KEY: 'AIzaSyBXFFKzMQJCeRcUYx0PAeCH8SHgIG0-zN0', // Same key works for Gemini
    SCAN_INTERVAL: 2000,
    CONFIDENCE_THRESHOLD: 0.5,
    USE_AI_IDENTIFICATION: true // Toggle AI identification
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

// Analyze Bottle (using AI)
async function analyzeBottle() {
    try {
        showLoading('Analyzing bottle with AI...');

        // Capture image
        canvas.toBlob(async (blob) => {
            const base64Image = await blobToBase64(blob);

            if (CONFIG.USE_AI_IDENTIFICATION) {
                // Use AI to identify and analyze the gin
                currentGinData = await identifyGinWithAI(base64Image);
            } else {
                // Use traditional Vision API
                const brandInfo = await detectBrand(base64Image);
                currentGinData = await generateGinData(brandInfo);
            }

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

// Identify Gin using Gemini AI
async function identifyGinWithAI(base64Image) {
    try {
        console.log('Using Gemini AI to identify gin...');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `You are an expert sommelier and gin specialist. Analyze this gin bottle image and provide detailed information in JSON format.

Your response MUST be ONLY valid JSON with this exact structure (no markdown, no code blocks, no extra text):
{
  "name": "Full brand name of the gin",
  "country": "Country of origin",
  "abv": "Alcohol percentage (e.g., 42%)",
  "type": "Type of gin (London Dry, Navy Strength, Contemporary, etc.)",
  "tastingNotes": "Detailed tasting notes describing the flavor profile, aroma, and finish",
  "botanicals": ["List", "of", "key", "botanicals"],
  "confidence": 0.95
}

Be specific and accurate. If you can clearly see the brand name, use it. Extract ABV from the label if visible. Provide professional tasting notes based on the brand and type of gin.`
                            },
                            {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: base64Image.split(',')[1]
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 1024,
                    }
                })
            }
        );

        const data = await response.json();
        console.log('Gemini AI Response:', data);

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            const aiText = data.candidates[0].content.parts[0].text;
            console.log('AI Text:', aiText);

            // Extract JSON from response (remove markdown if present)
            let jsonText = aiText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '');
            }

            const ginData = JSON.parse(jsonText);

            return {
                name: ginData.name || 'Unknown Gin',
                country: ginData.country || 'Unknown',
                abv: ginData.abv || '40-47%',
                type: ginData.type || 'Gin',
                tastingNotes: ginData.tastingNotes || 'A quality gin with traditional botanicals.',
                botanicals: ginData.botanicals || ['Juniper', 'Coriander', 'Citrus'],
                detectedAt: new Date().toISOString(),
                confidence: ginData.confidence || 0.8
            };
        }

        throw new Error('Invalid AI response');

    } catch (error) {
        console.error('Gemini AI error:', error);

        // Fallback to traditional detection
        console.log('Falling back to Vision API...');
        const brandInfo = await detectBrand(base64Image);
        return await generateGinData(brandInfo);
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
                            { type: 'WEB_DETECTION', maxResults: 10 },
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

        // Extract brand using web detection (reverse image search)
        let brand = 'Unknown Gin';
        let confidence = 0.5;
        let description = null;
        let webUrl = null;

        // Priority 1: Web detection (best match from internet)
        if (result.webDetection) {
            console.log('Web Detection:', result.webDetection);

            // Try web entities (products/brands found on the internet)
            if (result.webDetection.webEntities && result.webDetection.webEntities.length > 0) {
                // Find the most relevant gin-related entity
                const ginEntity = result.webDetection.webEntities.find(entity =>
                    entity.description &&
                    (entity.description.toLowerCase().includes('gin') ||
                     entity.description.toLowerCase().includes('distillery'))
                );

                if (ginEntity) {
                    brand = ginEntity.description;
                    confidence = ginEntity.score || 0.8;
                    console.log('Brand from web entity:', brand);
                } else if (result.webDetection.webEntities[0].description) {
                    // Use the first entity if no gin-specific one found
                    brand = result.webDetection.webEntities[0].description;
                    confidence = result.webDetection.webEntities[0].score || 0.7;
                    console.log('Brand from first web entity:', brand);
                }
            }

            // Try to get best guess label
            if (result.webDetection.bestGuessLabels && result.webDetection.bestGuessLabels.length > 0) {
                const bestGuess = result.webDetection.bestGuessLabels[0].label;
                console.log('Best guess label:', bestGuess);

                // Use best guess if we don't have a brand yet or it's more descriptive
                if (brand === 'Unknown Gin' || bestGuess.length > brand.length) {
                    brand = bestGuess;
                    confidence = 0.85;
                }
            }

            // Get matching web pages for additional info
            if (result.webDetection.pagesWithMatchingImages && result.webDetection.pagesWithMatchingImages.length > 0) {
                webUrl = result.webDetection.pagesWithMatchingImages[0].url;
                console.log('Found on web:', webUrl);
            }
        }

        // Priority 2: Logo detection
        if ((brand === 'Unknown Gin' || confidence < 0.7) && result.logoAnnotations && result.logoAnnotations.length > 0) {
            brand = result.logoAnnotations[0].description;
            confidence = result.logoAnnotations[0].score;
            console.log('Brand from logo:', brand);
        }

        // Priority 3: Text detection
        if ((brand === 'Unknown Gin' || confidence < 0.6) && result.textAnnotations && result.textAnnotations.length > 0) {
            const text = result.textAnnotations[0].description;
            console.log('Text detected:', text);
            brand = extractBrandFromText(text);
            confidence = 0.6;
            console.log('Brand from text:', brand);
        }

        return {
            brand: brand,
            confidence: confidence,
            webUrl: webUrl,
            rawText: result.textAnnotations?.[0]?.description
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
    console.log('Generating gin data for:', brandInfo);

    // Try to extract info from detected text
    const textInfo = extractInfoFromText(brandInfo.rawText || '');

    // Known database for common gins (fallback)
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

    // Default data if still no match - use extracted info from label
    if (!data) {
        data = {
            country: textInfo.country || 'Unknown',
            abv: textInfo.abv || '40-47%',
            type: textInfo.type || 'Gin',
            tastingNotes: generateTastingNotes(brandInfo.brand, textInfo),
            botanicals: textInfo.botanicals.length > 0 ? textInfo.botanicals : ['Juniper', 'Coriander', 'Citrus Peel', 'Angelica']
        };
    } else {
        // Merge detected info with database info
        if (textInfo.abv && textInfo.abv !== 'Unknown') data.abv = textInfo.abv;
        if (textInfo.country && textInfo.country !== 'Unknown') data.country = textInfo.country;
        if (textInfo.botanicals.length > 0) {
            // Merge botanicals
            data.botanicals = [...new Set([...data.botanicals, ...textInfo.botanicals])];
        }
    }

    return {
        name: brandInfo.brand,
        ...data,
        webUrl: brandInfo.webUrl,
        detectedAt: new Date().toISOString()
    };
}

// Extract info from label text
function extractInfoFromText(text) {
    if (!text) return { country: null, abv: null, type: null, botanicals: [] };

    const info = {
        country: null,
        abv: null,
        type: null,
        botanicals: []
    };

    // Extract ABV
    const abvMatch = text.match(/(\d+\.?\d*)\s*%\s*(ABV|ALC|VOL|ALCOHOL)/i) ||
                     text.match(/(\d+\.?\d*)\s*°/) ||
                     text.match(/(40|41|42|43|44|45|46|47|48|49|50)%/);
    if (abvMatch) {
        info.abv = `${abvMatch[1]}%`;
        console.log('Extracted ABV:', info.abv);
    }

    // Extract country
    const countries = [
        'England', 'Scotland', 'Wales', 'Ireland', 'United Kingdom', 'UK',
        'USA', 'America', 'United States', 'Spain', 'France', 'Germany',
        'Netherlands', 'Belgium', 'Italy', 'Japan', 'India', 'Australia',
        'New Zealand', 'Canada', 'Sweden', 'Finland', 'Iceland', 'Norway'
    ];
    for (const country of countries) {
        if (text.toUpperCase().includes(country.toUpperCase())) {
            info.country = country;
            console.log('Extracted country:', country);
            break;
        }
    }

    // Extract gin type
    const types = ['London Dry', 'Old Tom', 'Plymouth', 'Navy Strength', 'Contemporary', 'New Western'];
    for (const type of types) {
        if (text.toUpperCase().includes(type.toUpperCase())) {
            info.type = type;
            console.log('Extracted type:', type);
            break;
        }
    }

    // Extract botanicals
    const commonBotanicals = [
        'Juniper', 'Coriander', 'Angelica', 'Orris', 'Lemon', 'Orange', 'Lime',
        'Grapefruit', 'Cardamom', 'Cinnamon', 'Cassia', 'Liquorice', 'Licorice',
        'Almond', 'Cubeb', 'Cucumber', 'Rose', 'Lavender', 'Elderflower',
        'Chamomile', 'Thyme', 'Sage', 'Rosemary', 'Pepper', 'Grains of Paradise'
    ];
    for (const botanical of commonBotanicals) {
        if (text.toUpperCase().includes(botanical.toUpperCase())) {
            info.botanicals.push(botanical);
        }
    }

    return info;
}

// Generate tasting notes based on brand and extracted info
function generateTastingNotes(brandName, textInfo) {
    const templates = [
        `${brandName} presents a ${textInfo.type || 'distinctive'} profile with ${textInfo.botanicals.length > 0 ? textInfo.botanicals.slice(0, 3).join(', ') : 'traditional botanicals'}. A well-crafted gin with balanced flavors.`,
        `A quality gin featuring ${textInfo.botanicals.length > 0 ? textInfo.botanicals.slice(0, 2).join(' and ') : 'juniper and citrus'}. Smooth on the palate with a clean, refreshing finish.`,
        `This gin showcases ${textInfo.botanicals.length > 0 ? 'notes of ' + textInfo.botanicals.slice(0, 3).join(', ') : 'classic gin botanicals'} with a modern twist. Well-balanced and aromatic.`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
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
