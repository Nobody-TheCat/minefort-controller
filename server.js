const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Variabili globali per salvare l'autenticazione
let authCookies = null;
let loginError = null;

// CORS Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Middleware di logging
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware JSON
app.use(express.json());

// ============ FUNZIONE LOGIN ============
async function doLogin() {
  try {
    console.log('🔐 [STARTUP] Tentativo di login a Minefort...');
    const email = process.env.MINEFORT_EMAIL;
    const password = process.env.MINEFORT_PASSWORD;

    if (!email || !password) {
      throw new Error('Credenziali mancanti nelle variabili di ambiente');
    }

    const loginPageRes = await fetch('https://minefort.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });

    const cookies = loginPageRes.headers.raw()['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    const loginRes = await fetch('https://minefort.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
    
    console.log('✅ [STARTUP] Login riuscito!');
    loginError = null;
    return true;
  } catch (error) {
    console.error('❌ [STARTUP] Login fallito:', error.message);
    loginError = error.message;
    return false;
  }
}

// ============ ROTTE API ============

app.post('/api/start-server', async (req, res) => {
  console.log('📨 RICHIESTA START SERVER');
  
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    console.log('❌ Cookie non validi!');
    return res.status(500).json({
      success: false,
      error: 'Autenticazione fallita. Controlla /preview'
    });
  }

  try {
    console.log('📊 Ricerca bottoni Wake e Start...');
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
      const dataAction = $(elem).attr('data-action');
      
      buttonCount++;
      
      if (text.includes('wake') || text.includes('risveglia')) {
        wakeUrl = href || onclick || dataAction;
        console.log('  ✅ Bottone WAKE trovato:', text.substring(0, 30));
      }
      if (text.includes('start') || text.includes('avvia') || text.includes('accendi')) {
        startUrl = href || onclick || dataAction;
        console.log('  ✅ Bottone START trovato:', text.substring(0, 30));
      }
    });

    console.log(`📋 Bottoni totali trovati: ${buttonCount}`);

    // Se non trova i bottoni
    if (!wakeUrl && !startUrl) {
      console.log('❌ Bottoni Wake e Start NON trovati!');
      return res.status(200).json({
        success: false,
        error: '❌ Bottoni non trovati! Controlla /preview per vedere manualmente. Potrebbe esserci una verifica anti-bot.',
        details: `Bottoni totali sulla pagina: ${buttonCount}`
      });
    }

    // Invia richieste
    if (wakeUrl && wakeUrl.startsWith('http')) {
      console.log('⚡ Invio richiesta WAKE...');
      await fetch(wakeUrl, {
        method: 'POST',
        headers: { 'Cookie': authCookies }
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (startUrl && startUrl.startsWith('http')) {
      console.log('▶️ Invio richiesta START...');
      await fetch(startUrl, {
        method: 'POST',
        headers: { 'Cookie': authCookies }
      });
    }

    console.log('✅ Sequenza completata!');
    return res.status(200).json({
      success: true,
      message: 'Server start sequence initiated!',
      details: 'Server should be online in 30-60 seconds'
    });

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start server'
    });
  }
});

// ============ ENDPOINT /PREVIEW (pagina controllabile manualmente) ============
app.get('/preview', async (req, res) => {
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!authCookies) {
    console.log('❌ Non autenticato, tentativo di login...');
    const success = await doLogin();
    if (!success) {
      return res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>❌ Errore Autenticazione</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #f0f0f0; }
        .error { background: #fee; padding: 20px; border-radius: 8px; color: #c00; }
        a { color: #007bff; text-decoration: none; }
    </style>
</head>
<body>
    <div class="error">
        <h2>❌ Errore di autenticazione</h2>
        <p><strong>Errore:</strong> ${loginError}</p>
        <p>Controlla le credenziali in Render → Environment Variables:</p>
        <ul>
            <li>MINEFORT_EMAIL</li>
            <li>MINEFORT_PASSWORD</li>
            <li>MINEFORT_SERVER_ID</li>
        </ul>
        <p><a href="/">← Torna al sito</a></p>
    </div>
</body>
</html>
      `);
    }
  }

  try {
    console.log('📄 /preview: Caricamento pagina Minefort...');
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': authCookies,
      }
    });

    const serverHtml = await serverPageRes.text();
    console.log('✅ /preview: Pagina caricata con successo!');

    // Restituisci l'HTML PURO della pagina Minefort
    // In questo modo l'utente vede ESATTAMENTE quello che vede il backend
    // E può completare anche le verifiche anti-bot manualmente
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👁️ Anteprima Minefort</title>
    <style>
        body { margin: 0; padding: 0; }
        .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: white;
            padding: 15px;
            border-bottom: 2px solid #007bff;
            z-index: 999;
            display: flex;
            gap: 10px;
            align-items: center;
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
        }
        button:hover { background: #0056b3; }
        .info { flex: 1; color: #666; font-size: 14px; }
        .content {
            margin-top: 60px;
            padding: 0;
        }
        h2 { margin: 0; }
    </style>
</head>
<body>
    <div class="toolbar">
        <h2 style="margin: 0;">👁️ Anteprima Minefort (Status: ${serverPageRes.status})</h2>
        <div class="info">Puoi controllare manualmente e completare le verifiche anti-bot</div>
        <button onclick="location.href='/preview'">🔄 Ricarica</button>
        <button onclick="location.href='/'">🏠 Torna</button>
    </div>
    <div class="content">
        <!-- HTML DELLA PAGINA MINEFORT -->
        ${serverHtml}
    </div>
</body>
</html>
    `);

  } catch (error) {
    console.error('❌ /preview errore:', error.message);
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>❌ Errore Preview</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #f0f0f0; }
        .error { background: #fee; padding: 20px; border-radius: 8px; color: #c00; }
        a { color: #007bff; }
    </style>
</head>
<body>
    <div class="error">
        <h2>❌ Errore nel caricamento</h2>
        <p><strong>Errore:</strong> ${error.message}</p>
        <p><a href="/">← Torna al sito</a></p>
    </div>
</body>
</html>
    `);
  }
});

// ============ FILE STATICI ============
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  console.log('⚠️ 404 Not Found:', req.method, req.path);
  res.status(404).json({ error: 'Not found' });
});

// ============ AVVIO SERVER ============
app.listen(PORT, async () => {
  console.log(`🎮 Minefort Controller running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  // Fai il login all'avvio
  await doLogin();
});
