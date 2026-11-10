# HumanCheck - Deployment & Security Documentation

This document provides a comprehensive explanation of the **Deployment Procedures** and **Security Mechanisms** implemented in the HumanCheck alternative CAPTCHA system.

---

## 🚀 1. DEPLOYMENT DOCUMENTATION

HumanCheck is designed using a **Full-Stack SPA + API Proxy Server** architecture, combining **Node.js + Express** and **Vite (React + TypeScript)**. The application is ready to be deployed on modern container platforms such as Google Cloud Run, Heroku, AWS ECS, VPS, and other Node.js hosting environments.

### A. Environment Preparation (.env)
Create a production `.env` file with the following configuration:
```env
# Port & Interface binding (HumanCheck default port: 3000)
PORT=3000

# Global secret key for HMAC-SHA256 token signing
SYSTEM_SECRET="hc_system_sec_misterius_dan_panjang_998877"

# Production Mode
NODE_ENV="production"
```

### B. Local & Server Build Process
1. **Dependency Installation**: Run `npm install` to install all required packages.
2. **Code Compilation (Build)**:
   ```bash
   npm run build
   ```
   *This process performs two operations: compiling the Frontend SPA into the `/dist` directory and bundling the backend `server.ts` into a single Node.js CommonJS file at `/dist/server.cjs` using esbuild.*
3. **Starting the Production Server**:
   ```bash
   npm start
   ```

### C. Docker Deployment (Google Cloud Run / Kubernetes)
Use the following `Dockerfile` configuration for instant deployment:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
```

---

## 🔒 2. SECURITY DOCUMENTATION (Security Mechanisms)

HumanCheck is built on a high-privacy foundation ("privacy-by-design"), combined with multiple layers of anti-bot protection without interfering with personal data or installing third-party advertising trackers.

### A. Real-Time Behavioral Analysis (Behavior Heuristics)
Bot detection is performed through four dynamic client-side parameters, which are revalidated on the server side:

1. **Mouse Cursor Dynamics (Desktop)**:
   * **Curvature (Path Curvature)**: Compares mouse positions (`x`, `y`) to detect perfectly straight (linear) movement paths, which are commonly associated with computer automation scripts. Human hand movements naturally exhibit variations in curvature and direction (splines).
   * **Speed Variance**: Measures cursor acceleration and deceleration. Human-controlled movements typically have varying speeds (acceleration in the middle and deceleration when approaching the checkbox). Bots tend to move at a constant speed.
   * **Direction Jitters**: Detects natural manual position corrections (micro-shakes) commonly found in human hand movements.

2. **Screen Timing Metrics**:
   * Evaluates the reaction time between widget initialization and the checkbox click. Clicks performed in less than 400 milliseconds receive a reduced score because they fall below the system's expected human motor response threshold.

3. **Mobile Touch Sensor Events**:
   * Integrates finger swipe detection (`swipe velocity`), multi-touch sensors, finger press coordinates, and automatic emulator rejection.

4. **Window Focus Environment**:
   * Ensures that the browser window is active and focused to help prevent headless bots (such as Puppeteer/Selenium) from rendering the widget in the background (background headless execution).

### B. HMAC SHA256 Token Verification (Anti-Counterfeiting)
Prevents the unauthorized local generation of valid tokens:

* Tokens are constructed from a JSON payload containing: `siteKey`, `score`, `hostname`, `timestamp`, `ip`, and `nonce`.
* The payload is Base64-encoded and signed using the one-way cryptographic algorithm **HMAC SHA-256**, with a combined key consisting of the `Site Secret Key + System Secret Key`.
* The target server sends the token through `POST /api/siteverify`. The HumanCheck server decodes the token and validates its cryptographic signature, ensuring that forged tokens are rejected.

### C. Replay Attack Protection (Anti Replay Attack)
* **Token Expiration**: Verification tokens have a limited validity period of **2 minutes (120 seconds)** from the time they are issued. This expiration policy reduces the window of opportunity for potential cyber exploitation.
* **Nonce Cache Validation**: Each token contains a unique, single-use random key (`nonce`). When a request to `/api/siteverify` is triggered, the server stores the `nonce` in memory. If an attacker attempts to submit the same token repeatedly, the server rejects subsequent requests with the `timeout-or-duplicate` error.

### D. Domain Origin Security (Anti Key Theft Tracker)
* The public key (`SITE_KEY`) can be freely accessed from the client-side HTML page. To prevent unauthorized parties from copying the key and using it on their own websites, HumanCheck validates the request's origin domain (`originHostname`).
* The server compares the origin domain of the verification request against the list of authorized domains configured by the developer in the dashboard portal. If the domain is not registered, the verification token is considered invalid (`invalid-domain`).
