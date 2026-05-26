// Cloudflare Web Analytics — privacy-friendly, no cookies, free.
//
// SETUP (5 minutes):
// 1. Go to https://cloudflare.com and sign up (free).
// 2. In the dashboard, navigate to "Analytics & Logs" → "Web Analytics".
// 3. Click "Add a site" → enter your domain (or use the "Free token" option
//    if your site is hosted elsewhere).
// 4. Cloudflare gives you a token that looks like: 7a3b8c9d2e1f4g5h6i7j8k9l
// 5. Paste that token below, replacing 'YOUR_CLOUDFLARE_TOKEN_HERE'.
//
// That's it. Data starts flowing in ~1 hour. View at dash.cloudflare.com.

(function () {
  var TOKEN = 'YOUR_CLOUDFLARE_TOKEN_HERE';

  // Don't load the beacon until a real token is set
  if (!TOKEN || TOKEN === 'YOUR_CLOUDFLARE_TOKEN_HERE') return;

  var script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute(
    'data-cf-beacon',
    JSON.stringify({ token: TOKEN })
  );
  document.head.appendChild(script);
})();
