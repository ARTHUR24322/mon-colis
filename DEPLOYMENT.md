# Guide de Déploiement en Production — MonColis

Ce guide détaille pas à pas la mise en ligne sécurisée de la plateforme **MonColis** sur **Vercel** (ou toute autre plateforme Node.js comme Railway, Render ou Docker).

---

## 1. Pré-requis Base de Données (Supabase)

Avant de lancer l'application en ligne, connectez-vous sur votre console **[Supabase](https://supabase.com/dashboard)** et rendez-vous dans l'onglet **SQL Editor** :

### A. Exécuter les migrations récentes
Exécutez successivement les fichiers SQL suivants disponibles à la racine du projet :
1. `schema.sql` (schéma initial si la base est neuve)
2. `migration_agency_pro_settings.sql` (paramètres avancés & codes promos d'agence)
3. `migration_qr_deposit.sql` (flux de dépôts QR, demandes de retraits livreurs/vendeurs)

### B. Vérifier l'ajout de la colonne `is_active`
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

---

## 2. Variables d'Environnement Obligatoires

Lors de la configuration de votre projet sur votre hébergeur (Vercel > Project Settings > Environment Variables) :

| Variable | Exemple / Format | Utilité |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | URL publique Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Clé anonyme publique |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Clé secrète d'administration backend |
| `DATABASE_URL` | `postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres` | Connexion pooling PostgreSQL |
| `DIRECT_URL` | `postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres` | Connexion directe PostgreSQL |
| `SESSION_SECRET` | *64 caractères hexadécimaux* | Signature HMAC des cookies de session |
| `ADMIN_PASSWORD_HASH` | `$2a$12$...` | Hash bcrypt du mot de passe superadmin |
| `ADVANCED_ADMIN_PIN` | `8421` (4 chiffres) | Code PIN pour le panneau d'administration |
| `RESEND_API_KEY` | `re_...` | Envoi des emails et OTP |

### 🛠️ Commandes pour générer vos clés secrètes :

1. **Générer le `SESSION_SECRET` (64+ caractères) :**
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

2. **Générer le `ADMIN_PASSWORD_HASH` :**
   ```bash
   node scripts/hash-password.js "VotreMotDePasseTresSecurise"
   ```

---

## 3. Déploiement sur Vercel (Recommandé)

### Option 1 : Via l'interface web Vercel (GitHub/GitLab)
1. Poussez votre code sur votre dépôt Git privé (`git push origin main`).
2. Allez sur **[vercel.com](https://vercel.com)** > **Add New Project**.
3. Importez votre dépôt `Moncolis`.
4. Dans **Environment Variables**, collez toutes les variables de la section 2.
5. Cliquez sur **Deploy**.

### Option 2 : Via le CLI Vercel
```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## 4. Vérifications Post-Déploiement (Checklist)

- [ ] L'accueil `https://votre-domaine.com/` s'affiche avec fluidité.
- [ ] La page de test `/test-db` renvoie bien une erreur **404 Introuvable** en production.
- [ ] La connexion Vendeur / Agence / Livreur fonctionne et génère le cookie sécurisé `mc_session`.
- [ ] L'accès au panneau `/admin-x9k2` requiert bien le mot de passe et l'OTP par email.
- [ ] Le suivi de colis public `/track/[id]` fonctionne sans nécessiter de connexion.
