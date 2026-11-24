# RootRay Performance & Showcase Site

This directory contains the production-ready, standalone performance showcase and marketing website for **RootRay**.

It is completely self-contained with zero build dependencies, featuring:
- **Bilingual Interface**: Arabic (العربية) and English (EN) with seamless RTL/LTR switching.
- **Empirical Benchmarks**: Live interactive comparison against VS Code, Chrome DevTools, and Electron-based tools (Startup time, RAM, bundle size, installer footprint).
- **Interactive Workbench Simulator**: Click-to-source interactive demo simulating RootRay's dual-webview inspection and code reveal.
- **Architecture & Security**: Zero-IPC child WebView2 sandbox, Windows Job Object process containment, loopback WebSocket bridge, SHA-256 guarded atomic saves.
- **Verification & Download**: One-click SHA-256 hash copying and PowerShell verification command.

---

## 🚀 How to Preview Locally

You can open `index.html` directly in any web browser, or serve it locally using any simple HTTP server:

```powershell
# Using Python
python -m http.server 3000

# Or using Node / npx
npx serve .

# Or using pnpm
pnpm dlx serve .
```

Then visit `http://localhost:3000`.

---

## 🌐 How to Publish to Your Domain

### Option 1: Cloudflare Pages (Recommended - Fastest & Free)
1. Push this repository to GitHub or upload the `site` folder directly.
2. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages**.
3. Select your repository:
   - **Build output directory**: `site`
   - **Build command**: *(Leave blank)*
4. Click **Deploy**. Your custom domain can then be linked in 1 click!

### Option 2: Vercel
1. Run in your terminal:
   ```bash
   cd site
   npx vercel --prod
   ```
2. Or in the Vercel dashboard:
   - Set **Root Directory** to `site`.
   - No build command required.

### Option 3: Netlify
1. Drag and drop the `site` folder into the Netlify Drop dashboard: [https://app.netlify.com/drop](https://app.netlify.com/drop).
2. Or use Netlify CLI:
   ```bash
   cd site
   npx netlify deploy --prod --dir=.
   ```

### Option 4: GitHub Pages
1. Go to repository **Settings** → **Pages**.
2. Select branch and set the folder to `/site` (or `/docs` if moved).

### Option 5: Nginx / VPS / Custom Server
Copy the contents of `site/` to your server's web root (e.g. `/var/www/rootray/`):
```nginx
server {
    listen 80;
    server_name rootray.yourdomain.com;

    root /var/www/rootray;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📁 File Structure

```text
site/
├── index.html        # High-performance semantic HTML5 showcase page
├── styles.css        # RootRay dark cyber-minimalist design system
├── app.js            # Bilingual switcher, benchmark charts, simulator
├── README.md         # Deployment & hosting guide
└── assets/
    ├── brand/        # Official pixel mascot, icons, badges, lockups
    └── media/        # Product screenshots, workbench split view, demo
```
