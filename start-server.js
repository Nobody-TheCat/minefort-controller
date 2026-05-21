import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get credentials from environment variables (set in Vercel)
  const email = process.env.MINEFORT_EMAIL;
  const password = process.env.MINEFORT_PASSWORD;
  const serverId = process.env.MINEFORT_SERVER_ID;

  if (!email || !password || !serverId) {
    return res.status(400).json({ 
      error: 'Server not configured. Please set MINEFORT_EMAIL, MINEFORT_PASSWORD, and MINEFORT_SERVER_ID in Vercel environment variables.',
      missing: {
        email: !email,
        password: !password,
        serverId: !serverId
      }
    });
  }

  let browser;
  try {
    const executablePath = await chromium.executablePath(
      `https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-linux-x64.zip`
    );

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: executablePath || '/usr/bin/chromium-browser',
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // 1. Go to Minefort server page
    const serverUrl = `https://minefort.com/servers/${serverId}/`;
    await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // 2. Check if login is needed
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/login');
    });

    if (!isLoggedIn) {
      // Click login and do login flow
      await page.goto('https://minefort.com/login', { waitUntil: 'networkidle2' });
      await page.type('input[type="email"]', email, { delay: 50 });
      await page.type('input[type="password"]', password, { delay: 50 });
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
      
      // Go back to server page
      await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // 3. Wait for server buttons to load
    await page.waitForSelector('button', { timeout: 10000 });

    // 4. Click "Wake" button
    let wakeButtonClicked = false;
    const buttons = await page.$$eval('button', btns => 
      btns.map(btn => ({ text: btn.textContent, visible: btn.offsetHeight > 0 }))
    );

    for (const btn of buttons) {
      if (btn.text.toLowerCase().includes('wake') && btn.visible) {
        wakeButtonClicked = true;
        break;
      }
    }

    if (wakeButtonClicked) {
      await page.click('button:has-text("Wake")', { timeout: 5000 }).catch(() => {});
      // Wait for server to wake up
      await page.waitForTimeout(3000);
    }

    // 5. Click "Start" button
    let startButtonClicked = false;
    const buttonsAfterWake = await page.$$eval('button', btns => 
      btns.map(btn => ({ text: btn.textContent, visible: btn.offsetHeight > 0 }))
    );

    for (const btn of buttonsAfterWake) {
      if (btn.text.toLowerCase().includes('start') && btn.visible) {
        startButtonClicked = true;
        break;
      }
    }

    if (startButtonClicked) {
      await page.click('button:has-text("Start")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 6. Get final status
    const status = await page.evaluate(() => {
      const statusElement = document.querySelector('[class*="status"]');
      return statusElement ? statusElement.textContent : 'Status updated';
    });

    await browser.close();

    return res.status(200).json({
      success: true,
      message: 'Server start sequence initiated!',
      status: status,
      wakeClicked: wakeButtonClicked,
      startClicked: startButtonClicked,
    });

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start server',
    });
  }
}
