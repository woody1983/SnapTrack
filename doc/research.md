# SnapTrack PRD Analysis Report

## 1. Project Overview
**SnapTrack (MVP v1.0)** is designed as an ultra-minimalist, mobile-first web application enabling fast scanning and status verification of courier packages (specifically FedEx and UPS return shipping labels). The core value proposition is extreme speed: providing a 1-second status lookup and a 5-second automated camera-based entry system. This drastically reduces manual data entry overhead for target users, which include individuals, small warehouse operators, customer service teams, and return processing personnel.

## 2. Technical Stack & Infrastructure
- **Frontend / Framework:** Astro (optimized for edge speed and minimalistic setup)
- **Database:** Cloudflare D1 (Serverless SQLite at the edge)
- **ORM:** Drizzle ORM
- **Deployment & Hosting:** Cloudflare Workers / Pages
- **Cost Structure:** Designed for zero server costs, operating entirely within Cloudflare's free tiers.

## 3. Core Functionalities (MVP Scope)
The application centers around a single-page responsive interface (`/index`) that serves as an instant-access utility tool, completely sidestepping user login friction for the MVP.

### 3.1 Manual Tracking Status Lookup
- Users can manually type or paste a FedEx/UPS tracking number.
- The system checks the D1 database instantly (< 50ms target) and returns one of two statuses:
  - **"Entered" / In-Stock (Green):** Indicates the package has already been processed, displaying the exact entry timestamp to prevent duplicate processing.
  - **"Not Entered" (Red):** Alerts the user that the package is new to the system and prompts them to use the camera scanning feature to log it.

### 3.2 Camera-Based Automated Entry (Core Feature)
- A prominent camera button utilizes HTML5 capture constraints (`capture="environment"`) to immediately open the device's rear-facing camera.
- The user takes a picture of the physical shipping label (<5MB limit, JPG/PNG).
- **Processing Flow:** 
  - The image is uploaded to an Astro API route/Cloudflare Page Function. 
  - **Data Extraction (Original vs Alternative):** The document initially proposes using Cloudflare Workers AI with models like `llama-3.2-11b-vision-instruct` to extract structured JSON data. An updated technical alternative notes a "No AI" locking approach to guarantee performance and simplicity, using simple Base64 encoding passed to standard OCR APIs (like OCR.space) coupled with Regex string matching to pull the relevant data points.
  - **Extracted Data Points:** Tracking number, Carrier (FedEx/UPS), ship-from address, and ship-to address.
  - **Database Entry:** A successful read ensures the number doesn't exist yet before pushing it to the D1 database with a success message. Failures elegantly fallback to the manual entry mode.
- **Privacy & Storage Guardrails:** The original label photo is strictly processed in memory and discarded. It is not permanently stored, preserving privacy and eliminating AWS S3/Cloudflare R2 storage costs.

## 4. Database Schema Design
A straightforward `labels` table manages the core domain logic with a strict uniqueness constraint to enforce data integrity:
- `id` (Integer, Primary Key, Auto-increment)
- `tracking_number` (String, Not Null, **Unique**) - *The core deduplication key*
- `carrier` (String, Not Null) - *e.g., 'UPS' or 'FedEx'*
- `ship_from_address` (String, Nullable)
- `ship_to_address` (String, Nullable)
- `created_at` (Timestamp, auto-generation)

## 5. Non-Functional Requirements & Success Criteria
- **Delivery Timeline:** Total development and deployment time of 1 to 3 days.
- **Strict Performance Latencies:** Page load < 800ms, DB queries < 50ms, and complete OCR photo pipeline < 6 seconds.
- **Security & Privacy:** Transient image processing and secure Unique Index DB validations to avoid duplicates.
- **Future Extensibility:** Foundation built nicely for future scopes including User Identity/Auth, handling more carriers (USPS, DHL), and bulk processing functionalities.
