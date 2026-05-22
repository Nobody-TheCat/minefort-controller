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
  const email = process.env.MINEFORT_EMAIL;
  const password = process.env.MINEFORT_PASSWORD;
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!email || !password || !serverId) {
    return res.status(400).json({ 
      error: 'Server not configured',
      missing: { email: !email, password: !password, serverId: !serverId }
    });
  }

  try {
    // 1. Get login page
    const loginPageRes = await fetch('https://minefort.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });

    const cookies = loginPageRes.headers.raw()['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    // 2. Perform login
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
    const authCookies = [...cookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');

    // 3. Go to server page
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

    // 4. Find wake and start buttons
    let wakeUrl = null;
    let startUrl = null;
    
    $('button, a').each((i, elem) => {
      const text = $(elem).text().toLowerCase();
      const href = $(elem).attr('href');
      const onclick = $(elem).attr('onclick');
      
      if (text.includes('wake')) {
        wakeUrl = href || onclick;
      }
      if (text.includes('start')) {
        startUrl = href || onclick;
      }
    });

    // 5. Send wake request
    if (wakeUrl && wakeUrl.startsWith('http')) {
      await fetch(wakeUrl, {
        method: 'POST',
        headers: {
          'Cookie': authCookies,
        }
      });
      
      // Wait for server to wake
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 6. Send start request
    if (startUrl && startUrl.startsWith('http')) {
      await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Cookie': authCookies,
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Server start sequence initiated!',
      details: 'Server should be online in 30-60 seconds'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start server'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎮 Minefort Controller running on port ${PORT}`);
});
