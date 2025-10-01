# GinIQ 🍸

A beautiful, AI-powered web app that scans gin bottles with your iPhone camera, identifies brands using computer vision, and builds your personal gin collection.

## ✨ Features

- 📸 **Continuous Camera Scanning** - Real-time bottle detection using TensorFlow.js
- 🤖 **AI Brand Recognition** - Google Cloud Vision API for logo/brand identification
- 💾 **Local Collection** - Save your favorite gins with IndexedDB/LocalStorage
- 📱 **iPhone Optimized** - Beautiful mobile-first UI with PWA support
- 🎨 **Stunning Design** - Smooth animations and modern gradient-based interface
- 🆓 **100% Free APIs** - Uses only free-tier services

## 🚀 Quick Start

### 1. Generate Icons
Open `create-icons.html` in your browser to generate the PWA icons (`icon-192.png` and `icon-512.png`).

### 2. Set Up Google Cloud Vision API (Optional)

The app works with mock data out of the box, but for real brand recognition:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the **Cloud Vision API**
4. Create an API key (restrict it to Vision API and your domain)
5. Update `CONFIG.GOOGLE_VISION_API_KEY` in `app.js`

**Free Tier:** 1,000 requests/month

### 3. Serve the App

#### Option A: Python
```bash
python -m http.server 8000
```

#### Option B: Node.js
```bash
npx serve
```

#### Option C: VS Code Live Server
Install the Live Server extension and click "Go Live"

### 4. Access on iPhone

1. Open Safari and navigate to your local IP (e.g., `http://192.168.1.100:8000`)
2. Tap the Share button → "Add to Home Screen"
3. Launch from home screen for full-screen PWA experience

## 🔧 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **AI/ML:**
  - TensorFlow.js + COCO-SSD (bottle detection)
  - Google Cloud Vision API (brand recognition)
- **Storage:** LocalStorage
- **PWA:** Service Worker ready, manifest.json included

## 📱 iPhone Optimization

- ✅ Safe area insets for notch support
- ✅ `webkit-` prefixes for Safari compatibility
- ✅ Standalone display mode
- ✅ Environment camera access
- ✅ Touch-optimized interactions

## 🎨 Customization

### Add More Gin Brands

Edit the `ginDatabase` object in `app.js`:

```javascript
const ginDatabase = {
    'Your Gin Brand': {
        country: 'Country',
        abv: '40%',
        type: 'London Dry',
        tastingNotes: 'Description...',
        botanicals: ['Juniper', 'Other botanicals...']
    }
};
```

### Adjust Scan Settings

In `app.js` CONFIG:

```javascript
const CONFIG = {
    SCAN_INTERVAL: 2000, // Scan frequency (ms)
    CONFIDENCE_THRESHOLD: 0.5 // Detection confidence (0-1)
};
```

## 🐛 Troubleshooting

### Camera Not Working
- Ensure HTTPS or localhost (required for camera access)
- Check browser permissions for camera
- Try Safari (best iPhone support)

### Brand Recognition Not Working
- Verify Google Cloud Vision API key is set
- Check API key restrictions
- Monitor free tier quota (1,000/month)

### Icons Not Showing
- Run `create-icons.html` to generate `icon-192.png` and `icon-512.png`
- Place icons in the root directory

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

Built with ❤️ using free and open-source tools:
- TensorFlow.js by Google
- Google Cloud Vision API
- COCO-SSD Object Detection

---

**Enjoy building your gin collection! 🥂**
