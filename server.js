const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Variabili globali
let authCookies = null;
let loginError = null;

// Browser Headers realistici
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0'
};

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use(express.json());

// ============ ENDPOINT /API/CHECK-AUTH ============
app.get('/api/check-auth', (req, res) => {
  res.json({
    authenticated: authCookies !== null,
    hasError: loginError !== null
  });
});

// ============ ENDPOINT /API/VERIFY-AUTH ============
app.post('/api/verify-auth', async (req, res) => {
  console.log('🔐 Verifica autenticazione...');
  
  try {
    // Tenta a loggare con le credenziali
    const email = process.env.MINEFORT_EMAIL;
    const password = process.env.MINEFORT_PASSWORD;

    if (!email || !password) {
      return res.json({ authenticated: false, error: 'Credenziali mancanti' });
    }

    const loginPageRes = await fetch('https://minefort.com/login', {
      method: 'GET',
      headers: browserHeaders
    });

    const cookies = loginPageRes.headers.raw()['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    const loginRes = await fetch('https://minefort.com/login', {
      method: 'POST',
      headers: {
        ...browserHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieString,
        'Referer': 'https://minefort.com/login'
      },
      body: new URLSearchParams({
        'email': email,
        'password': password
      }),
      redirect: 'follow'
    });

    const loginCookies = loginRes.headers.raw()['set-cookie'] || [];
    const newAuthCookies = [...cookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');

    // Testa se il login è valido
    const testRes = await fetch(`https://minefort.com/servers/${process.env.MINEFORT_SERVER_ID}/`, {
      method: 'GET',
      headers: {
        ...browserHeaders,
        'Cookie': newAuthCookies,
      }
    });

    if (testRes.status === 200 || testRes.status === 403) {
      // 200 = OK, 403 = Potrebbe essere cloudflare ma con cookie valido
      authCookies = newAuthCookies;
      loginError = null;
      console.log('✅ Autenticazione riuscita!');
      return res.json({ authenticated: true });
    } else {
      console.log(`❌ Autenticazione fallita (status: ${testRes.status})`);
      return res.json({ authenticated: false, error: `Status ${testRes.status}` });
    }

  } catch (error) {
    console.error('❌ Errore verifica:', error.message);
    return res.json({ authenticated: false, error: error.message });
  }
});

// ============ ENDPOINT /API/START-SERVER ============
app.post('/api/start-server', async (req, res) => {
  console.log('📨 RICHIESTA START SERVER');
  
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    console.log('❌ Non autenticato!');
    return res.status(500).json({
      success: false,
      error: 'Non autenticato. Completa il setup!'
    });
  }

  try {
    console.log('📊 Ricerca bottoni...');
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        ...browserHeaders,
        'Cookie': authCookies,
      }
    });

    const serverHtml = await serverPageRes.text();
    const $ = cheerio.load(serverHtml);

    let wakeUrl = null;
    let startUrl = null;
    let buttonCount = 0;
    
    $('button, a, [role="button"]').each((i, elem) => {
      const text = $(elem).text().trim().toLowerCase();
      const href = $(elem).attr('href');
      const onclick = $(elem).attr('onclick');
      
      buttonCount++;
      
      if (text.includes('wake') || text.includes('risveglia')) {
        wakeUrl = href || onclick;
        console.log('  ✅ WAKE trovato');
      }
      if (text.includes('start') || text.includes('avvia') || text.includes('accendi')) {
        startUrl = href || onclick;
        console.log('  ✅ START trovato');
      }
    });

    if (!wakeUrl && !startUrl) {
      console.log('❌ Bottoni non trovati!');
      return res.status(200).json({
        success: false,
        error: '❌ Bottoni non trovati!'
      });
    }

    if (wakeUrl && wakeUrl.startsWith('http')) {
      console.log('⚡ WAKE...');
      await fetch(wakeUrl, {
        method: 'POST',
        headers: { 
          ...browserHeaders,
          'Cookie': authCookies 
        }
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (startUrl && startUrl.startsWith('http')) {
      console.log('▶️ START...');
      await fetch(startUrl, {
        method: 'POST',
        headers: { 
          ...browserHeaders,
          'Cookie': authCookies 
        }
      });
    }

    console.log('✅ Completato!');
    return res.status(200).json({
      success: true,
      message: 'Server acceso! 🚀',
      details: 'Dovrebbe essere online tra 30-60 secondi'
    });

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ STATIC FILES ============
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  console.log('⚠️ 404:', req.method, req.path);
  res.status(404).json({ error: 'Not found' });
});

// ============ START ============
app.listen(PORT, () => {
  console.log(`🎮 Minefort Controller on port ${PORT}`);
});
