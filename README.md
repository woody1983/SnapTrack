# SnapTrack 📦

SnapTrack is a premium, edge-native package tracking entry system designed for speed, privacy, and simplicity. Built with **Astro** and **Cloudflare D1**, it leverages high-performance barcode scanning to streamline logistics tracking directly from the edge.

![SnapTrack Dashboard](./public/img/snaptrack_dashboard_mockup_1772170822407.png)

## ✨ Features

- **Barcode-First Experience**: High-speed, real-time tracking number scanning using **ZXing**.
- **Intelligent Carrier Detection**: Automatically identifies **UPS** (1Z...) and **FedEx** (12-digit) formats.
- **Glassmorphism UI**: A stunning, responsive interface with vibrant gradients and smooth micro-animations.
- **Edge Native**: Zero-latency database operations powered by **Cloudflare D1** and **Workers**.
- **Privacy Centric**: All barcode processing occurs locally on your device; only essential metadata is stored.
- **Efficient History**: Quick-access scan history with double-click copy functionality and carrier badging.

## 🚀 Technical Stack

- **Framework**: [Astro 5](https://astro.build/)
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Barcode Engine**: [@zxing/browser](https://github.com/zxing-js/browser)
- **Styling**: Vanilla CSS (Modern CSS Variables & Glassmorphism)

---

## 📸 Guided Tour

````carousel
![Scanner Interface](./public/img/snaptrack_scanner_mockup_1772170834711.png)
<!-- slide -->
![Detection Success](./public/img/snaptrack_result_modal_mockup_1772170850626.png)
````

### **1. Real-time Scanning**
Tap the barcode icon to launch the edge-to-edge scanner. The system uses a high-resolution video feed to identify Code 128 and ITF barcodes instantly.

### **2. Smart Confirmation**
Once a barcode is detected, SnapTrack strips away the technical noise (like the long FedEx application identifiers) and presents the clean 12 or 18-digit tracking number for your approval.

### **3. Local History**
Your recent scans are stored in a minimalist table. Double-click any entry to instantly copy it to your clipboard or sync it with the search bar.

---

## 🛠️ Development Setup

### **Prerequisites**
- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare CLI)

### **Installation**
```bash
# Install dependencies
npm install

# Initialize local D1 database
npm run db:generate
npm run db:migrate
```

### **Running Locally**
```bash
npm run dev
```

## 🔒 Privacy & Security

SnapTrack is designed with a **privacy-first** mindset. Tracking numbers are identifiers for shipments but can be sensitive. 
- **Local Processing**: Barcode decoding happens entirely in the browser. No image data is ever sent to the server.
- **Minimal Storage**: We only store the tracking number, carrier type, and timestamp. No personally identifiable information (PII) is captured from labels.

---
*Created with ❤️ on Cloudflare Edge.*
