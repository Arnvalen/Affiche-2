import mkcert from 'mkcert';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';

// Détection automatique de l'IP locale réseau
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const ip = getLocalIP();
console.log(`📍 IP locale : ${ip}`);

// Génération de l'autorité de certification (CA)
const ca = await mkcert.createCA({
  organization: 'Nexans Affiche Dev CA',
  countryCode: 'FR',
  state: 'Ile-de-France',
  locality: 'Paris',
  validity: 365
});

// Génération du certificat serveur
const cert = await mkcert.createCert({
  domains: ['localhost', '127.0.0.1', ip],
  validity: 365,
  ca: { key: ca.key, cert: ca.cert }
});

fs.mkdirSync('.cert', { recursive: true });
fs.writeFileSync('.cert/ca.crt', ca.cert);
fs.writeFileSync('.cert/cert.pem', `${cert.cert}\n${ca.cert}`);
fs.writeFileSync('.cert/key.pem', cert.key);

// Script d'installation pour les postes clients (Windows)
fs.writeFileSync('.cert/installer-ca.bat', `@echo off
echo Installation du certificat Nexans Affiche...
certutil -addstore -user Root "%~dp0ca.crt"
if %errorlevel% == 0 (
  echo.
  echo Succes ! Redemarrez votre navigateur puis accedez a :
  echo https://${ip}:3000
) else (
  echo Erreur lors de l'installation.
)
pause
`);

// Installation automatique sur la machine hôte
try {
  execSync(`certutil -addstore -user Root ".cert/ca.crt"`, { stdio: 'ignore' });
  console.log('✅ CA installée sur cette machine');
} catch {
  console.log('⚠️  Installation manuelle sur cette machine : double-cliquer .cert/installer-ca.bat');
}

console.log('');
console.log('✅ Certificats générés dans .cert/');
console.log(`🌐 URL réseau : https://${ip}:3000`);
console.log('');
console.log('─── Pour les autres utilisateurs ────────────────────────');
console.log('  1. Partager le fichier  →  .cert/ca.crt');
console.log('     (ou envoyer .cert/installer-ca.bat directement)');
console.log('  2. Faire double-cliquer sur  installer-ca.bat');
console.log('  3. Relancer le navigateur');
console.log('─────────────────────────────────────────────────────────');
