# 🎮 Minefort Server Controller

Un sito bellissimo per accendere il tuo server Minefort con un click! **Pubblico** - chiunque può usarlo!

## 📋 Come Funziona

1. Qualcuno clicca il bottone **"⚡ ACCENDI SERVER"**
2. Il backend automaticamente:
   - Fa il login a Minefort (credenziali nascoste in Vercel)
   - Clicca "Sveglia" sul server
   - Aspetta che si svegli
   - Clicca "Accendi"
3. Boom! Il server è online 🚀

## 🚀 Deploy su Vercel (3 minuti, gratis ☁️)

### **Step 1: GitHub**

1. Vai su https://github.com e crea un account
2. Crea un **nuovo repository pubblico** called `minefort-controller`
3. Carica i 5 file:
   - `package.json`
   - `vercel.json`
   - `index.html`
   - `api/start-server.js`
   - `README.md`

### **Step 2: Deploy su Vercel**

1. Vai su https://vercel.com
2. Clicca "Sign up" → accedi con GitHub
3. Clicca "Import Project"
4. Seleziona `minefort-controller`
5. **IMPORTANTE**: Prima di cliccare "Deploy", vai in **"Environment Variables"** e aggiungi:
   - `MINEFORT_EMAIL` = tua email Minefort
   - `MINEFORT_PASSWORD` = tua password Minefort
   - `MINEFORT_SERVER_ID` = `POr52c74PK`
6. Clicca **"Deploy"** 🚀

**Fine!** Vercel ti darà un URL: `https://minefort-controller.vercel.app`

---

## 📱 Come Usarlo

- **Apri il link** da Mac, iPhone o Android
- **Clicca il bottone rosso** = server acceso in 30 secondi!
- **Condividi il link** agli amici, loro possono accendere il server senza sapere la password

---

## 🔒 Sicurezza

- Email e password **NON sono nel codice** (né su GitHub)
- Sono **solo su Vercel**, in modo privato (solo tu le vedi)
- Il codice su GitHub è **completamente pubblico** e sicuro
- Nessuno sa la tua password, anche se usa il sito

---

## ⚙️ Troubleshooting

### "Errore: Server not configured"
- Hai dimenticato di impostare le variabili d'ambiente su Vercel
- Vai su Vercel → Settings → Environment Variables
- Aggiungi `MINEFORT_EMAIL`, `MINEFORT_PASSWORD`, `MINEFORT_SERVER_ID`

### "Failed to start server"
- Email o password sbagliata
- Controlla su Minefort che funzioni il login manuale

### "Timeout"
- Il server di Minefort è lento
- Riprova tra 5 minuti

---

## 🛠️ Personalizzazioni

Se vuoi cambiare il colore o il testo:
- **Colori**: modifica `index.html` (sezione `<style>`)
- **Titolo**: cambia "Minefort Control" in `index.html`
- **Tempo di attesa**: modifica i `waitForTimeout` in `api/start-server.js`

---

**Buon divertimento! 🎮✨**
