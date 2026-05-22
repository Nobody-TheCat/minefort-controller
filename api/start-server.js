const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    // 1. Get login page to extract CSRF token
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

    // 4. Find wake button and click it
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

    // 5. Send wake request (if we found it)
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
};
