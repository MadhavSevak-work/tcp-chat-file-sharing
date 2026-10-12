# NetChat Live — Standalone Frontend (Vercel)

This folder contains the decoupled, standalone static frontend for **NetChat Live**, designed for instantaneous global CDN delivery via **Vercel**.

---

## 📁 Project Structure

```
frontend/
├── index.html         # Root HTML single-page application
├── vercel.json        # Vercel security headers and clean URL routing
├── css/
│   └── style.css      # Custom styling, dark/light theme tokens, and responsive UI
└── js/
    └── app.js         # Vanilla ES6+ application controller & WebSocket streaming
```

---

## ⚙️ Configuration

By default, `app.js` connects to your production Render backend:
```javascript
const BACKEND_URL = "https://netchat-live.onrender.com";
```

### Changing the Backend URL:
- **Option 1 (HTML injection)**: Add a script tag in `<head>` before `js/app.js`:
  ```html
  <script>
    window.NETCHAT_BACKEND_URL = "https://your-custom-render-app.onrender.com";
  </script>
  ```
- **Option 2 (Direct edit)**: Edit `js/app.js` and update `BACKEND_URL`.

---

## 🚀 Deployment to Vercel

### Method 1: Push `frontend/` as a Dedicated Git Repo
1. Initialize a new repo in the `frontend` folder:
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "feat: decoupled NetChat frontend"
   ```
2. Push to GitHub (`your-username/netchat-live-frontend`).
3. Import the repository into your [Vercel Dashboard](https://vercel.com/new).
4. **Framework Preset**: Select **Other**.
5. **Root Directory**: `./` (leave default).
6. Click **Deploy**.

---

### Method 2: Monorepo Deployment from this Repository
1. Import your existing `cn_project` repository into Vercel.
2. In the Project Configuration screen, under **Root Directory**, click **Edit** and enter `frontend`.
3. Click **Deploy**.

---

### Method 3: Vercel CLI
```bash
cd frontend
vercel deploy --prod
```
