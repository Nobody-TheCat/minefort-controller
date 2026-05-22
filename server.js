const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve index.html per la root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint per accendere il server
app.post('/api/start-server', async (req, res) => {
  console.log('📨 Richiesta ricevuta!');
  
  const email = process.env.MINEFORT_EMAIL;
  const password = process.env.MINEFORT_PASSWORD;
  const serverId = process.env.MINEFORT_SERVER_ID;

  console.log('🔑 Controllo credenziali...');
  console.log('  Email:', email ? '✅ Set' : '❌ Missing');
  console.log('  Password:', password ? '✅ Set' : '❌ Missing');
  console.log('  Server ID:', serverId ? `✅ ${serverId}` : '❌ Missing');

  if (!email || !password || !serverId) {
    console.log('❌ Credenziali mancanti!');
    return res.status(400).json({ 
      error: 'Server not configured',
      missing: { email: !email, password: !password, serverId: !serverId }
    });
  }

  try {
    console.log('🌐 Step 1: Collegamento a Minefort login page...');
    const loginPageRes = await fetch('https://minefort.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });
    console.log('✅ Login page caricata, status:', loginPageRes.status);

    const cookies = loginPageRes.headers.raw()['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('🍪 Cookies ricevuti:', cookies.length);

    console.log('🔐 Step 2: Login con email e password...');
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
    console.log('✅ Login response, status:', loginRes.status);

    const loginCookies = loginRes.headers.raw()['set-cookie'] || [];
    const authCookies = [...cookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');
    console.log('🍪 Auth cookies:', authCookies.length > 0 ? '✅ Set' : '❌ No cookies');

    console.log('📊 Step 3: Collegamento alla pagina del server...');
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    console.log('   URL:', serverUrl);
    
    const serverPageRes = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': authCookies,
      }
    });
    console.log('✅ Server page loaded, status:', serverPageRes.status);

    const serverHtml = await serverPageRes.text();
    console.log('📝 HTML ricevuto:', serverHtml.length, 'characters');

    const $ = cheerio.load(serverHtml);

    console.log('🔍 Step 4: Ricerca bottoni Wake e Start...');
    let wakeUrl = null;
    let startUrl = null;
    let foundButtons = [];
    
    $('button, a').each((i, elem) => {
      const text = $(elem).text().trim();
      const href = $(elem).attr('href');
      const onclick = $(elem).attr('onclick');
      
      foundButtons.push(text.substring(0, 50)); // Primi 50 caratteri
      
      if (text.toLowerCase().includes('wake')) {
        wakeUrl = href || onclick;
        console.log('  ✅ Trovato bottone WAKE:', text.substring(0, 30));
      }
      if (text.toLowerCase().includes('start')) {
        startUrl = href || onclick;
        console.log('  ✅ Trovato bottone START:', text.substring(0, 30));
      }
    });
    
    console.log('📋 Bottoni trovati totali:', foundButtons.length);
    console.log('   Primi 5:', foundButtons.slice(0, 5));

    console.log('⚡ Step 5: Invio richiesta WAKE...');
    if (wakeUrl && wakeUrl.startsWith('http')) {
      console.log('   Wake URL:', wakeUrl.substring(0, 80));
      const wakeRes = await fetch(wakeUrl, {
        method: 'POST',
        headers: {
          'Cookie': authCookies,
        }
      });
      console.log('   ✅ Wake response:', wakeRes.status);
      
      console.log('   ⏳ Attesa 3 secondi...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('   ❌ Wake URL non trovato o invalido');
    }

    console.log('▶️ Step 6: Invio richiesta START...');
    if (startUrl && startUrl.startsWith('http')) {
      console.log('   Start URL:', startUrl.substring(0, 80));
      const startRes = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Cookie': authCookies,
        }
      });
      console.log('   ✅ Start response:', startRes.status);
    } else {
      console.log('   ❌ Start URL non trovato o invalido');
    }

    console.log('✅ Sequenza completata con successo!');
    return res.status(200).json({
      success: true,
      message: 'Server start sequence initiated!',
      details: 'Server should be online in 30-60 seconds'
    });

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start server'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎮 Minefort Controller running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});
