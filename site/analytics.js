// Vercel Web Analytics — privacy-friendly, no cookies, free, no separate account.
// The site is hosted on Vercel, so this "just works" once Web Analytics is
// enabled for the project in the Vercel dashboard:
//   Vercel dashboard → project "vetera" → Analytics tab → Enable.
//
// Vercel serves /_vercel/insights/script.js only after Analytics is enabled;
// until then this loads nothing and does no harm.

(function () {
  // Queue stub so any calls before the script loads aren't lost
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
})();
