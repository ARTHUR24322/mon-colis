#!/usr/bin/env node
/**
 * Utilitaire pour générer un hash bcrypt pour ADMIN_PASSWORD_HASH
 * Usage : node scripts/hash-password.js "MonMotDePasse"
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-password.js <mot-de-passe>");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log("\n--- Hash bcrypt généré pour .env.local / déploiement ---");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
});
