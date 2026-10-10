# yesdevis – devis et factures de Belloni & Fils

Site statique (menu, devis, factures, calculatrice) avec envoi des documents par e-mail.

- Pages : `index.html`, `devis-*.html`, `facture-*.html`, `factures.html`, `calculatrice.html`
- Envoi d'e-mail : fonction Netlify `netlify/functions/envoyer.mjs` (Resend)
- Configuration Netlify : `netlify.toml`, `_redirects`

La clé Resend (variable `RESEND_API_KEY`) ne doit JAMAIS être mise dans ce dépôt : elle se règle dans Netlify
(Site configuration > Environment variables). Variables facultatives : `FROM_EMAIL`, `REPLY_TO`.
