const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

let authCookies = null;

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

// ============ FUNZIONE LOGIN ============
async function doLogin() {
  try {
    console.log('🔐 Login a Minefort...');
    const email = process.env.MINEFORT_EMAIL;
    const password = process.env.MINEFORT_PASSWORD;

    if (!email || !password) {
      throw new Error('Credenziali mancanti');
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
    authCookies = [...cookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');
    
    console.log('✅ Login riuscito!');
    return true;
  } catch (error) {
    console.error('❌ Login fallito:', error.message);
    return false;
  }
}

// ============ ROTTE ============

app.post('/api/wake-server', async (req, res) => {
  console.log('⚡ WAKE SERVER');
  
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    console.log('❌ Non autenticato!');
    return res.json({ success: false, error: 'Non autenticato' });
  }

  try {
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: { ...browserHeaders, 'Cookie': authCookies }
    });

    const serverHtml = await serverPageRes.text();
    const $ = cheerio.load(serverHtml);

    let wakeUrl = null;
    $('button, a, [role="button"]').each((i, elem) => {
      const text = $(elem).text().trim().toLowerCase();
      const href = $(elem).attr('href');
      const onclick = $(elem).attr('onclick');
      
      if (text.includes('wake') || text.includes('risveglia')) {
        wakeUrl = href || onclick;
      }
    });

    if (!wakeUrl) {
      return res.json({ success: false, error: 'Wake button non trovato' });
    }

    if (wakeUrl.startsWith('http')) {
      await fetch(wakeUrl, {
        method: 'POST',
        headers: { ...browserHeaders, 'Cookie': authCookies }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Wake error:', error.message);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/start-server', async (req, res) => {
  console.log('▶️ START SERVER');
  
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    return res.json({ success: false, error: 'Non autenticato' });
  }

  try {
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: { ...browserHeaders, 'Cookie': authCookies }
    });

    const serverHtml = await serverPageRes.text();
    const $ = cheerio.load(serverHtml);

    let startUrl = null;
    $('button, a, [role="button"]').each((i, elem) => {
      const text = $(elem).text().trim().toLowerCase();
      const href = $(elem).attr('href');
      const onclick = $(elem).attr('onclick');
      
      if (text.includes('start') || text.includes('avvia') || text.includes('accendi')) {
        startUrl = href || onclick;
      }
    });

    if (!startUrl) {
      return res.json({ success: false, error: 'Start button non trovato' });
    }

    if (startUrl.startsWith('http')) {
      await fetch(startUrl, {
        method: 'POST',
        headers: { ...browserHeaders, 'Cookie': authCookies }
      });
    }

    res.json({ success: true, message: 'Server acceso!' });
  } catch (error) {
    console.error('❌ Start error:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// ============ /DEBUG ============
app.get('/debug', async (req, res) => {
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    console.log('Non autenticato, tentativo login...');
    await doLogin();
  }

  try {
    console.log('📄 /debug: Caricamento pagina...');
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: { ...browserHeaders, 'Cookie': authCookies }
    });

    const serverHtml = await serverPageRes.text();

    // Restituisci HTML PURO senza modifiche
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Minefort (Status: ${serverPageRes.status})</title>
    <style>
        .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: white;
            padding: 15px;
            border-bottom: 2px solid #007bff;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-right: 10px;
        }
        button:hover { background: #0056b3; }
        .content { margin-top: 60px; }
        h2 { margin: 0; }
    </style>
</head>
<body>
    <div class="toolbar">
        <h2 style="display: inline; margin-right: 20px;">Debug Minefort (Status: ${serverPageRes.status})</h2>
        <button onclick="location.href='/'">🏠 Torna</button>
        <button onclick="location.reload()">🔄 Ricarica</button>
    </div>
    <div class="content">
        ${serverHtml}
    </div>
</body>
</html>
    `);

  } catch (error) {
    console.error('❌ /debug error:', error.message);
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Errore</title>
    <style>body { font-family: Arial; padding: 20px; } .error { color: #c00; }</style>
</head>
<body>
    <div class="error">
        <h2>❌ Errore</h2>
        <p>${error.message}</p>
        <p><a href="/">← Torna</a></p>
    </div>
</body>
</html>
    `);
  }
});

// ============ STATIC ============
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============ START ============
app.listen(PORT, async () => {
  console.log(`🎮 Server on port ${PORT}`);
  await doLogin();
});
