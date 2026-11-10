import fs from 'fs';
import path from 'path';
import { Developer, SiteKey, CaptchaLog } from './types';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';

const DB_FILE = path.join(process.cwd(), 'humancheck-db.json');
const CONFIG_PATH = path.join(process.cwd(), 'firebase-applet-config.json');

// Initialize Firebase if config exists
let firestoreDb: any = null;
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const firebaseConfig = JSON.parse(configContent);
    const app = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log('[HumanCheck] Firebase Firestore initialized successfully with database ID:', firebaseConfig.firestoreDatabaseId);
  } else {
    console.log('[HumanCheck] firebase-applet-config.json not found, using local JSON database.');
  }
} catch (error) {
  console.error('[HumanCheck] Failed to initialize Firebase:', error);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function isPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('permission') || msg.includes('insufficient') || err.code === 'permission-denied';
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Object: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Schema {
  developers: Developer[];
  passwords: Record<string, string>; // developerId -> password
  siteKeys: SiteKey[];
  logs: CaptchaLog[];
}

const initialData: Schema = {
  developers: [
    {
      id: 'dev_demo',
      email: 'developer@humancheck.io',
      name: 'HumanCheck Demo',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  passwords: {
    dev_demo: 'password123',
  },
  siteKeys: [
    {
      id: 'hc_site_demo_abcdef',
      secretKey: 'hc_secret_demo_123456789',
      developerId: 'dev_demo',
      name: 'Demonstrasi Website',
      domains: ['localhost', '127.0.0.1', 'run.app', 'github.dev', 'vwebapp.workers.dev', 'workers.dev'],
      theme: 'light',
      compact: false,
      scoreThreshold: 70,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  logs: [],
};

// Fill some historical logs for demo rendering
const fillDemoStats = (logs: CaptchaLog[]) => {
  const devices = ['Chrome (Windows)', 'Safari (iOS)', 'Chrome (Android)', 'Firefox (Mac)', 'Edge (Windows)'];
  const hostnames = ['localhost', 'demo.humancheck.io', 'mywebsite.com', 'application.net'];

  // Generate logs for last 14 days
  for (let i = 14; i >= 0; i--) {
    const dayTimestamp = Date.now() - i * 24 * 60 * 60 * 1000;
    const numLogs = Math.floor(Math.random() * 40) + (i === 0 ? 15 : 25);
    for (let j = 0; j < numLogs; j++) {
      const logHour = Math.floor(Math.random() * 24);
      const logMin = Math.floor(Math.random() * 60);
      const logDate = new Date(dayTimestamp);
      logDate.setHours(logHour, logMin, 0, 0);

      const isBot = Math.random() < 0.08;
      let score = 0;
      if (isBot) {
        score = Math.floor(Math.random() * 35);
      } else {
        const isSuspicious = Math.random() < 0.15;
        if (isSuspicious) {
          score = Math.floor(Math.random() * 25) + 42;
        } else {
          score = Math.floor(Math.random() * 25) + 75;
        }
      }

      const verified = score >= 70 || (score >= 40 && Math.random() < 0.95);
      const device = devices[Math.floor(Math.random() * devices.length)];
      const host = hostnames[Math.floor(Math.random() * hostnames.length)];

      logs.push({
        id: `log_${Math.random().toString(36).substr(2, 9)}`,
        siteKey: 'hc_site_demo_abcdef',
        timestamp: logDate.toISOString(),
        score,
        success: verified,
        hostname: host,
        ip: `192.168.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`,
        device,
        behaviorMetrics: {
          mousePathLength: isBot ? 0 : Math.floor(Math.random() * 500) + 100,
          mousePointsCount: isBot ? 0 : Math.floor(Math.random() * 40) + 10,
          speedVariance: isBot ? 0 : Math.random() * 15 + 2,
          isLinear: isBot,
          mouseJitters: isBot ? 0 : Math.floor(Math.random() * 5),
          timeSpentMs: isBot ? Math.floor(Math.random() * 100) : Math.floor(Math.random() * 3000) + 500,
          hadFocus: !isBot,
          challengeType: score < 70 && score >= 40 ? 'puzzle' : 'none',
          challengePassed: score < 70 && score >= 40 ? verified : undefined,
        },
      });
    }
  }
};

if (initialData.logs.length === 0) {
  fillDemoStats(initialData.logs);
}

class Database {
  private data: Schema;

  constructor() {
    this.data = this.load();
  }

  private load(): Schema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return {
          developers: parsed.developers || initialData.developers,
          passwords: parsed.passwords || initialData.passwords,
          siteKeys: parsed.siteKeys || initialData.siteKeys,
          logs: parsed.logs || initialData.logs,
        };
      }
    } catch (e) {
      console.error('Error loading database file, falling back to initialData', e);
    }
    this.save(initialData);
    return initialData;
  }

  private save(data: Schema): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing to database file', e);
    }
  }

  async getDevelopers(): Promise<Developer[]> {
    if (firestoreDb) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'developers'));
        return snap.docs.map(d => d.data() as Developer);
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, 'developers');
        }
        console.error('Firestore getDevelopers error, falling back:', err);
      }
    }
    return this.data.developers;
  }

  async getDeveloperById(id: string): Promise<Developer | undefined> {
    if (firestoreDb) {
      try {
        const docSnap = await getDoc(doc(firestoreDb, 'developers', id));
        if (docSnap.exists()) {
          return docSnap.data() as Developer;
        }
        return undefined;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, `developers/${id}`);
        }
        console.error('Firestore getDeveloperById error, falling back:', err);
      }
    }
    return this.data.developers.find((d) => d.id === id);
  }

  async getDeveloperByEmail(email: string): Promise<Developer | undefined> {
    const cleanEmail = email.trim().toLowerCase();
    if (firestoreDb) {
      try {
        const q = query(collection(firestoreDb, 'developers'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data() as Developer;
        }
        return undefined;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, 'developers');
        }
        console.error('Firestore getDeveloperByEmail error, falling back:', err);
      }
    }
    return this.data.developers.find((d) => d.email.toLowerCase() === cleanEmail);
  }

  async verifyPassword(developerId: string, input: string): Promise<boolean> {
    if (firestoreDb) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'passwords', developerId));
        if (snap.exists()) {
          return snap.data().password === input;
        }
        return false;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, `passwords/${developerId}`);
        }
        console.error('Firestore verifyPassword error, falling back:', err);
      }
    }
    return this.data.passwords[developerId] === input;
  }

  async createDeveloper(email: string, name: string, password: string): Promise<Developer> {
    const id = `dev_${Math.random().toString(36).substr(2, 9)}`;
    const newDev: Developer = {
      id,
      email,
      name,
      createdAt: new Date().toISOString(),
    };

    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'developers', id), newDev);
        await setDoc(doc(firestoreDb, 'passwords', id), { password });
        return newDev;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `developers/${id}`);
        }
        console.error('Firestore createDeveloper error, falling back:', err);
      }
    }

    this.data.developers.push(newDev);
    this.data.passwords[id] = password;
    this.save(this.data);
    return newDev;
  }

  async getSiteKeysByDeveloper(developerId: string): Promise<SiteKey[]> {
    if (firestoreDb) {
      try {
        const q = query(collection(firestoreDb, 'siteKeys'), where('developerId', '==', developerId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as SiteKey);
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, 'siteKeys');
        }
        console.error('Firestore getSiteKeysByDeveloper error, falling back:', err);
      }
    }
    return this.data.siteKeys.filter((s) => s.developerId === developerId);
  }

  async getSiteKeyById(id: string): Promise<SiteKey | undefined> {
    if (firestoreDb) {
      try {
        const docSnap = await getDoc(doc(firestoreDb, 'siteKeys', id));
        if (docSnap.exists()) {
          return docSnap.data() as SiteKey;
        }
        return undefined;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, `siteKeys/${id}`);
        }
        console.error('Firestore getSiteKeyById error, falling back:', err);
      }
    }
    return this.data.siteKeys.find((s) => s.id === id);
  }

  async createSiteKey(developerId: string, name: string, domains: string[]): Promise<SiteKey> {
    const siteKeyId = `hc_site_${Math.random().toString(36).substr(2, 12)}`;
    const secretKey = `hc_sec_${Math.random().toString(36).substr(2, 16)}`;
    const newSite: SiteKey = {
      id: siteKeyId,
      secretKey,
      developerId,
      name,
      domains: domains.map(d => d.trim().toLowerCase()).filter(Boolean),
      theme: 'light',
      compact: false,
      scoreThreshold: 70,
      createdAt: new Date().toISOString(),
    };

    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'siteKeys', siteKeyId), newSite);
        return newSite;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `siteKeys/${siteKeyId}`);
        }
        console.error('Firestore createSiteKey error, falling back:', err);
      }
    }

    this.data.siteKeys.push(newSite);
    this.save(this.data);
    return newSite;
  }

  async updateSiteKey(id: string, updates: Partial<Omit<SiteKey, 'id' | 'secretKey' | 'developerId' | 'createdAt'>>): Promise<SiteKey | undefined> {
    if (firestoreDb) {
      try {
        const siteRef = doc(firestoreDb, 'siteKeys', id);
        await updateDoc(siteRef, updates);
        const docSnap = await getDoc(siteRef);
        return docSnap.exists() ? (docSnap.data() as SiteKey) : undefined;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `siteKeys/${id}`);
        }
        console.error('Firestore updateSiteKey error, falling back:', err);
      }
    }

    const site = this.data.siteKeys.find((s) => s.id === id);
    if (site) {
      Object.assign(site, updates);
      this.save(this.data);
    }
    return site;
  }

  async deleteSiteKey(id: string): Promise<boolean> {
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, 'siteKeys', id));
        // Clean up associated logs in background
        const logsQ = query(collection(firestoreDb, 'logs'), where('siteKey', '==', id));
        const logsSnap = await getDocs(logsQ);
        for (const docItem of logsSnap.docs) {
          await deleteDoc(doc(firestoreDb, 'logs', docItem.id));
        }
        return true;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.DELETE, `siteKeys/${id}`);
        }
        console.error('Firestore deleteSiteKey error, falling back:', err);
      }
    }

    const initialLen = this.data.siteKeys.length;
    this.data.siteKeys = this.data.siteKeys.filter(s => s.id !== id);
    if (this.data.siteKeys.length !== initialLen) {
      this.data.logs = this.data.logs.filter(l => l.siteKey !== id);
      this.save(this.data);
      return true;
    }
    return false;
  }

  async getLogsBySiteKey(siteKey: string): Promise<CaptchaLog[]> {
    if (firestoreDb) {
      try {
        const q = query(collection(firestoreDb, 'logs'), where('siteKey', '==', siteKey));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as CaptchaLog)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, 'logs');
        }
        console.error('Firestore getLogsBySiteKey error, falling back:', err);
      }
    }
    return this.data.logs.filter((l) => l.siteKey === siteKey);
  }

  async addLog(log: Omit<CaptchaLog, 'id' | 'timestamp'>): Promise<CaptchaLog> {
    const logId = `log_${Math.random().toString(36).substr(2, 10)}`;
    const timestamp = new Date().toISOString();
    const newLog: CaptchaLog = {
      ...log,
      id: logId,
      timestamp,
    };

    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'logs', logId), newLog);
        return newLog;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `logs/${logId}`);
        }
        console.error('Firestore addLog error, falling back:', err);
      }
    }

    this.data.logs.push(newLog);
    if (this.data.logs.length > 2000) {
      this.data.logs = this.data.logs.slice(this.data.logs.length - 2000);
    }
    this.save(this.data);
    return newLog;
  }
}

export const db = new Database();
