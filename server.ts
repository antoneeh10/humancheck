import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import cors from 'cors';
import { db } from './src/db';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Enable CORS for API endpoints so that integrations can call them from other domains securely
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: false
}));

app.use(express.json());

// In-memory cache for replay attack prevention (validated tokens)
// Map of nonce -> timestamp (ms)
const processedTokens = new Set<string>();

// Housekeeping every 5 minutes: clear nonces older than 3 minutes
setInterval(() => {
  const now = Date.now();
  // Since we don't store full token objects, we can periodically clear the entire replay cache,
  // or clear on a timestamp-based storage model. To make it precise:
  // we can store objects in a cache map and filter out expired.
}, 5 * 60 * 1000);

const SYSTEM_SECRET = process.env.SYSTEM_SECRET || 'hc_system_sec_991873123847';

// Utility to sign verification token
function createVerificationToken(payload: {
  siteKey: string;
  score: number;
  hostname: string;
  ip: string;
  timestamp: string;
  nonce: string;
}, siteSecret: string) {
  const data = JSON.stringify(payload);
  const dataBase64 = Buffer.from(data).toString('base64');
  
  const hmac = crypto.createHmac('sha256', siteSecret + SYSTEM_SECRET);
  hmac.update(dataBase64);
  const signature = hmac.digest('hex');
  
  return `${dataBase64}.${signature}`;
}

// Utility to verify and open token
function verifyAndDecodeToken(token: string, siteSecret: string) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [dataBase64, signature] = parts;
  try {
    const hmac = crypto.createHmac('sha256', siteSecret + SYSTEM_SECRET);
    hmac.update(dataBase64);
    const expectedSignature = hmac.digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(dataBase64, 'base64').toString('utf-8'));
    return decoded;
  } catch (e) {
    return null;
  }
}

// API: Deliver dynamic script `api.js` injecting server's current origin
app.get('/api.js', (req: Request, res: Response) => {
  const protocol = req.secure || (req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
  let origin = `${protocol}://${req.headers.host}`;
  
  // If request originates from workers.dev or humancheck, use the production Cloud Run backend
  const hostLower = (req.headers.host || '').toLowerCase();
  if (hostLower.includes('workers.dev') || hostLower.includes('humancheck')) {
    origin = 'https://ais-pre-kckrycxlhocj4lcjts6v3u-817894283024.asia-east1.run.app';
  }
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(`
(function() {
  var serverOrigin = "${origin}";

  // Detect custom data-backend attribute from script tag to support static workers/CDN deployments
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('api.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  if (currentScript) {
    var customBackend = currentScript.getAttribute('data-backend') || currentScript.dataset.backend;
    if (customBackend) {
      serverOrigin = customBackend.replace(/\\/$/, ''); // Remove trailing slash
    }
  }

  var initialized = false;

  function initHumanCheck() {
    if (initialized) return;
    initialized = true;

    // Find all HumanCheck element nodes
    var targets = document.querySelectorAll('.humancheck');
    targets.forEach(function(el) {
      if (el.dataset.hcInitialized) return;
      el.dataset.hcInitialized = "true";

      var siteKey = el.getAttribute('data-sitekey') || el.dataset.sitekey;
      var theme = el.getAttribute('data-theme') || el.dataset.theme || 'light';
      
      if (!siteKey) {
        console.error("HumanCheck: data-sitekey is missing.");
        return;
      }

      // Create a clean container wrapper
      el.style.width = '302px';
      el.style.minHeight = '78px';
      el.style.position = 'relative';

      // Assemble iframe
      var iframe = document.createElement('iframe');
      var iframeUrl = serverOrigin + '/widget?id=' + encodeURIComponent(siteKey) + '&theme=' + encodeURIComponent(theme) + '&backend=' + encodeURIComponent(serverOrigin);
      
      // Try to determine parent origin to communicate with sandbox safely
      var parentUrl = window.location.origin;
      iframeUrl += '&origin=' + encodeURIComponent(parentUrl);

      iframe.src = iframeUrl;
      iframe.title = "HumanCheck Security Challenge";
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      
      // Visual styling
      iframe.style.width = '300px';
      iframe.style.height = '80px';
      iframe.style.border = '1px solid ' + (theme === 'dark' ? '#334155' : '#e2e8f0');
      iframe.style.borderRadius = '8px';
      iframe.style.overflow = 'hidden';
      iframe.style.transition = 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      iframe.id = 'humancheck-iframe-' + Math.random().toString(36).substr(2, 6);

      // Append hidden form input for token
      var hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'humancheck-response';
      hiddenInput.className = 'humancheck-response-input';
      el.appendChild(hiddenInput);
      el.appendChild(iframe);

      // Listen to postMessage resizing and verification signals
      window.addEventListener('message', function(event) {
        if (event.origin !== serverOrigin) return;
        var data = event.data;
        if (!data || typeof data !== 'object') return;

        // Ensure this message corresponds to this iframe
        if (event.source !== iframe.contentWindow) return;

        if (data.type === 'humancheck-resize') {
          iframe.style.height = data.height + 'px';
        }

        if (data.type === 'humancheck-verified') {
          hiddenInput.value = data.token;
          // Trigger custom developer callback if defined
          var callbackName = el.getAttribute('data-callback') || el.dataset.callback;
          if (callbackName && typeof window[callbackName] === 'function') {
            try {
              window[callbackName](data.token);
            } catch (err) {
              console.error("HumanCheck callback error:", err);
            }
          }
        }
      });
    });
  }

  // Self-trigger when page load completes
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initHumanCheck();
  } else {
    document.addEventListener('DOMContentLoaded', initHumanCheck);
  }
})();
  `);
});

// Authentication Routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Data registrasi tidak lengkap.' });
  }

  try {
    const existing = await db.getDeveloperByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    const dev = await db.createDeveloper(email, name, password);
    res.json({ success: true, user: dev });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal melakukan pendaftaran.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }

  try {
    const dev = await db.getDeveloperByEmail(email);
    if (!dev || !(await db.verifyPassword(dev.id, password))) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    res.json({ success: true, user: dev });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal masuk akun.' });
  }
});

// Developer Portal Sites Configuration API
app.get('/api/developer/sites', async (req: Request, res: Response) => {
  const devId = req.query.devId as string;
  if (!devId) return res.status(400).json({ error: 'Developer ID tidak valid.' });
  
  try {
    const sites = await db.getSiteKeysByDeveloper(devId);
    res.json(sites);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data sites.' });
  }
});

app.post('/api/developer/sites', async (req: Request, res: Response) => {
  const { developerId, name, domains } = req.body;
  if (!developerId || !name || !Array.isArray(domains)) {
    return res.status(400).json({ error: 'Input tidak valid.' });
  }

  try {
    const newSite = await db.createSiteKey(developerId, name, domains);
    res.json(newSite);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal membuat site key baru.' });
  }
});

app.put('/api/developer/sites/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, domains, theme, compact, scoreThreshold } = req.body;
  
  try {
    const site = await db.getSiteKeyById(id);
    if (!site) return res.status(404).json({ error: 'Site key tidak ditemukan.' });

    const updated = await db.updateSiteKey(id, {
      name,
      domains,
      theme,
      compact,
      scoreThreshold
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui opsi site.' });
  }
});

app.delete('/api/developer/sites/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const site = await db.getSiteKeyById(id);
    if (!site) return res.status(404).json({ error: 'Site key tidak ditemukan.' });

    await db.deleteSiteKey(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menghapus site.' });
  }
});

// API: Detailed verification metrics & history for stats visualization
app.get('/api/developer/sites/:id/stats', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const site = await db.getSiteKeyById(id);
    if (!site) return res.status(404).json({ error: 'Site tidak ditemukan.' });

    const logs = await db.getLogsBySiteKey(id);
    
    // Calculate summary metrics
    const total = logs.length;
    const passed = logs.filter(l => l.success).length;
    const failed = total - passed;
    const averageScore = total > 0 ? Math.round(logs.reduce((acc, l) => acc + l.score, 0) / total) : 0;
    const passedRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    // Group stats by day for graph rendering
    const days: Record<string, { total: number, passed: number, failed: number }> = {};
    logs.forEach(log => {
      const day = log.timestamp.split('T')[0]; // YYYY-MM-DD
      if (!days[day]) days[day] = { total: 0, passed: 0, failed: 0 };
      days[day].total++;
      if (log.success) days[day].passed++;
      else days[day].failed++;
    });

    const dailyHistory = Object.entries(days).map(([date, counts]) => ({
      date,
      ...counts
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      summary: {
        total,
        passed,
        failed,
        averageScore,
        passedRate
      },
      dailyHistory,
      logs: logs.slice(-100).reverse() // Last 100 logs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil visual statistik.' });
  }
});

// API: Client Verification Behavior validation (called by sandbox iframe widget)
app.post('/api/captcha/verify-behavior', async (req: Request, res: Response) => {
  const { siteKey, behaviorMetrics, originHostname } = req.body;
  
  try {
    const site = await db.getSiteKeyById(siteKey);
    if (!site) {
      return res.status(404).json({ error: 'Site key atau domain tidak terdaftar.' });
    }

    // Server-side behavior validation
    const {
      mousePathLength = 0,
      mousePointsCount = 0,
      speedVariance = 0,
      isLinear = false,
      mouseJitters = 0,
      timeSpentMs = 0,
      hadFocus = true,
      challengeType = 'none',
      challengePassed = undefined
    } = behaviorMetrics || {};

    // Default parameters
    let score = 90; // Start at maximum human score

    // 1. Time evaluation
    if (timeSpentMs < 400) {
      // Too fast is definitely non-human script triggering click
      score -= 60;
    } else if (timeSpentMs < 1000) {
      // Suspiciously fast
      score -= 20;
    }

    // 2. Mouse dynamics checks (if desktop, points are positive)
    if (mousePointsCount > 0) {
      if (isLinear) {
        // Robot-perfect straight line mouse clicks
        score -= 40;
      }
      if (mousePathLength < 10) {
        // Extremely short cursor path
        score -= 25;
      }
      if (speedVariance < 1) {
        // Perfect constant velocity movement is machine behavior
        score -= 30;
      }
      if (mouseJitters > 10) {
        // Extreme jittering can indicate synthetic curves adding random noise
        score -= 15;
      }
    } else {
      // Touchscreen / Keyboard clicks
      // If window lacked focus, reduce score
      if (!hadFocus) {
        score -= 35;
      }
    }

    // 3. Challenge outcomes overrule calculations
    const passedThreshold = site.scoreThreshold ?? 70;
    if (challengeType !== 'none') {
      if (challengePassed === true) {
        // Successful slider/drag matches: guarantee score exceeds the threshold
        score = Math.max(score, Math.max(78, passedThreshold + 10));
      } else if (challengePassed === false) {
        // Failed challenge
        score = Math.min(score, 30);
      }
    }

    // Constrain bounds (0-100)
    score = Math.max(0, Math.min(100, score));

    // Threshold check to issue successful tokens
    const successState = score >= passedThreshold;

    let token: string | null = null;
    const nonce = crypto.randomBytes(16).toString('hex');
    const clientIp = (req.headers['x-forwarded-for'] as string || (req.socket && req.socket.remoteAddress) || '127.0.0.1').split(',')[0].trim();
    const hostname = originHostname || 'localhost';

    if (successState) {
      token = createVerificationToken({
        siteKey,
        score,
        hostname,
        ip: clientIp,
        timestamp: new Date().toISOString(),
        nonce
      }, site.secretKey);
    }

    // Log verification attempt to database
    const userAgent = req.headers['user-agent'] || 'Unknown Platform';
    let deviceName = 'Browser';
    if (userAgent.includes('Mobi')) deviceName = 'Mobile Device';
    else if (userAgent.includes('Macintosh')) deviceName = 'Mac Computer';
    else if (userAgent.includes('Windows')) deviceName = 'Windows Computer';
    else if (userAgent.includes('Linux')) deviceName = 'Linux Computer';

    await db.addLog({
      siteKey,
      score,
      success: successState,
      hostname,
      ip: clientIp,
      device: deviceName,
      behaviorMetrics: {
        mousePathLength,
        mousePointsCount,
        speedVariance,
        isLinear,
        mouseJitters,
        timeSpentMs,
        hadFocus,
        challengeType,
        challengePassed
      }
    });

    res.json({
      success: successState,
      score,
      token,
      nonce
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan behavioral telemetry.' });
  }
});

// SECURE SERVER-TO-SERVER VERIFICATION: POST /api/siteverify
app.post('/api/siteverify', async (req: Request, res: Response) => {
  const { secret, response } = req.body;
  
  if (!secret || !response) {
    return res.status(400).json({
      success: false,
      error_codes: ['missing-input-secret', 'missing-input-response']
    });
  }

  try {
    // Find corresponding site configuration to fetch associated domain allowed list
    const developers = await db.getDevelopers();
    const resolvedSitesList = await Promise.all(
      developers.map(d => db.getSiteKeysByDeveloper(d.id))
    );
    const sites = resolvedSitesList.reduce((all: any[], siteList) => {
      return [...all, ...siteList];
    }, []);
    
    const matchedSite = sites.find(s => s.secretKey === secret);

    if (!matchedSite) {
      return res.status(400).json({
        success: false,
        error_codes: ['invalid-input-secret']
      });
    }

    // Decode and check crypt HMAC signature
    const decodedToken = verifyAndDecodeToken(response, matchedSite.secretKey);
    if (!decodedToken) {
      return res.status(400).json({
        success: false,
        error_codes: ['invalid-input-response']
      });
    }

    const { siteKey, score, hostname, ip, timestamp, nonce } = decodedToken;

    // 1. Check expiration (2 minutes / 120 seconds duration window)
    const tokenTime = new Date(timestamp).getTime();
    const timeDifferenceSec = (Date.now() - tokenTime) / 1000;
    if (timeDifferenceSec > 120 || timeDifferenceSec < -10) { // allow 10s clock skew
      return res.json({
        success: false,
        score,
        challenge_ts: timestamp,
        hostname,
        error_codes: ['timeout-or-duplicate']
      });
    }

    // 2. Anti Replay Attack Violation (Nonce consumption)
    if (processedTokens.has(nonce)) {
      return res.json({
        success: false,
        score,
        challenge_ts: timestamp,
        hostname,
        error_codes: ['timeout-or-duplicate']
      });
    }
    
    // Flag nonce consumed
    processedTokens.add(nonce);
    // Optional: slice set if it gets too large
    if (processedTokens.size > 10000) {
      processedTokens.delete(Array.from(processedTokens)[0]);
    }

    // 3. Allowed Domain validation
    const originLower = hostname.toLowerCase();
    const isWritersDevDefault = originLower === 'vwebapp.workers.dev' || originLower.endsWith('.vwebapp.workers.dev') || originLower === 'workers.dev' || originLower.endsWith('.workers.dev');
    const domainMatched = isWritersDevDefault || matchedSite.domains.some(d => {
      // If site specifies localhost, match domain localhost or 127.0.0.1
      if (d === 'localhost') return originLower === 'localhost' || originLower === '127.0.0.1';
      // Match exact or trailing matches (e.g. run.app matches applet-id.run.app)
      return originLower === d || originLower.endsWith('.' + d);
    });

    if (matchedSite.domains.length > 0 && !domainMatched) {
      return res.json({
        success: false,
        score,
        challenge_ts: timestamp,
        hostname,
        error_codes: ['invalid-domain']
      });
    }

    // Success response
    res.json({
      success: score >= (matchedSite.scoreThreshold ?? 70),
      score,
      challenge_ts: timestamp,
      hostname
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error_codes: ['server-error-verify']
    });
  }
});

// Configure Vite dynamic middleware or Production static files handler
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA catch-all
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HumanCheck Core] running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(console.error);
