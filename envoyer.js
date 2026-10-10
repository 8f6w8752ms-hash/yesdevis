// Netlify Function : envoi des devis et factures par e-mail via Resend.
// Le site appelle /api/envoyer (redirigé vers cette fonction par netlify.toml / _redirects).
// Clé Resend : variable d'environnement RESEND_API_KEY (recommandé). La fonction accepte aussi RESEND,
// puis, à défaut, toute variable dont la valeur commence par « re_ » (début d'une clé Resend).
// Variables facultatives : FROM_EMAIL, REPLY_TO

const H = '7bbc641d269a9d10a999220d1dee363d4c2297638d2ad9bce1def756b5989152'; // empreinte du mot de passe du site
const S = 'bf|devis|2026|';

const sha256 = async (s) => {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const getEnv = () =>
  typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.toObject ? Netlify.env.toObject() : process.env;

function findKey(env) {
  for (const n of ['RESEND_API_KEY', 'RESEND', 'Resend', 'resend']) {
    if (typeof env[n] === 'string' && env[n].trim()) return env[n].trim();
  }
  for (const v of Object.values(env)) {
    if (typeof v === 'string' && /^re_[A-Za-z0-9_\-]{10,}$/.test(v.trim())) return v.trim();
  }
  return '';
}
// noms (jamais les valeurs) des variables « personnalisées » vues par la fonction, pour aider au diagnostic
const SYSTEME = /^(AWS_|LAMBDA_|_|NETLIFY|NODE|NPM|PATH$|PWD$|HOME$|LANG|LC_|TZ$|SHLVL|XDG|LD_|HOSTNAME|SHELL|TERM|USER|TASK_ROOT|NF_|DEPLOY|CONTEXT|URL$|SITE_|BUILD|REPOSITORY|COMMIT|HEAD$|INCOMING|PULL|REVIEW|BRANCH|CACHED|PREVIOUS|DENO|ENV$|OLDPWD)/i;

export default async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const origin = request.headers.get('origin');
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).host; } catch {}
    const ok = [request.headers.get('host'), request.headers.get('x-forwarded-host'), new URL(request.url).host]
      .filter(Boolean).some((h) => h.split(',')[0].trim() === oh);
    if (!ok) return json({ error: 'Origine refusée' }, 403);
  }

  // Le mot de passe du site est revérifié ici, côté serveur.
  const code = request.headers.get('x-code') || '';
  if ((await sha256(S + code)) !== H) return json({ error: 'Mot de passe incorrect' }, 401);

  const env = getEnv();
  const apiKey = findKey(env);
  if (!apiKey) {
    const noms = Object.keys(env).filter((k) => !SYSTEME.test(k));
    return json({
      error: 'Clé Resend introuvable. Variables vues par la fonction : ' + (noms.length ? noms.join(', ') : 'aucune') +
        '. Vérifiez la variable dans Netlify (portée « Functions »), puis relancez un déploiement.',
    }, 500);
  }

  let d;
  try { d = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
  const to = String(d.to || '').trim();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(to)) return json({ error: 'Adresse e-mail invalide' }, 400);
  const subject = String(d.subject || '').slice(0, 200);
  const html = String(d.html || '');
  const text = String(d.text || '');
  if (!subject || !html || html.length > 200000) return json({ error: 'Contenu invalide' }, 400);

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'Belloni & Fils <onboarding@resend.dev>',
      to: [to], subject, html, text,
      reply_to: env.REPLY_TO || 'bbelloni@hotmail.fr',
    }),
  });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch {}
  if (!r.ok) return json({ error: j.message || j.error || 'Resend ' + r.status }, 502);
  return json({ ok: true, id: j.id });
};
