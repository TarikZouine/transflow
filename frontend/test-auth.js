#!/usr/bin/env node

/**
 * Script de test pour l'authentification TransFlow
 * Usage: node test-auth.js
 */

console.log('🔐 Test Authentification TransFlow');
console.log('=====================================\n');

// Configuration
const CONFIG = {
  password: 'TransFlow2024!',
  appUrl: 'http://localhost:3000',
  loginUrl: 'http://localhost:3000/login'
};

// Test du mot de passe
function testPassword(password) {
  console.log(`📝 Test du mot de passe: "${password}"`);
  
  if (password === CONFIG.password) {
    console.log('✅ Mot de passe correct!');
    return true;
  } else {
    console.log('❌ Mot de passe incorrect!');
    console.log(`   Mot de passe attendu: "${CONFIG.password}"`);
    return false;
  }
}

// Test de l'URL de l'application
async function testAppUrl() {
  console.log('\n🌐 Test de l\'URL de l\'application...');
  
  try {
    const response = await fetch(CONFIG.appUrl);
    if (response.ok) {
      console.log('✅ Application accessible');
      console.log(`   URL: ${CONFIG.appUrl}`);
      return true;
    } else {
      console.log(`❌ Erreur HTTP: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Impossible d\'accéder à l\'application');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

// Test de la page de connexion
async function testLoginPage() {
  console.log('\n🔑 Test de la page de connexion...');
  
  try {
    const response = await fetch(CONFIG.loginUrl);
    if (response.ok) {
      console.log('✅ Page de connexion accessible');
      console.log(`   URL: ${CONFIG.loginUrl}`);
      return true;
    } else {
      console.log(`❌ Erreur HTTP: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Impossible d\'accéder à la page de connexion');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

// Test de redirection
async function testRedirect() {
  console.log('\n🔄 Test de redirection...');
  
  try {
    const response = await fetch(CONFIG.appUrl, {
      redirect: 'manual'
    });
    
    if (response.status === 302 || response.status === 301) {
      console.log('✅ Redirection détectée (probablement vers /login)');
      console.log(`   Status: ${response.status}`);
      return true;
    } else if (response.status === 200) {
      console.log('⚠️  Application accessible sans redirection');
      console.log('   Vérifiez que la protection est bien active');
      return false;
    } else {
      console.log(`⚠️  Status inattendu: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur lors du test de redirection');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

// Fonction principale
async function runTests() {
  console.log('🚀 Démarrage des tests...\n');
  
  // Test 1: Mot de passe
  const passwordTest = testPassword('TransFlow2024!');
  
  // Test 2: Mot de passe incorrect
  const wrongPasswordTest = testPassword('WrongPassword123!');
  
  // Test 3: URL de l'application
  const appUrlTest = await testAppUrl();
  
  // Test 4: Page de connexion
  const loginPageTest = await testLoginPage();
  
  // Test 5: Redirection
  const redirectTest = await testRedirect();
  
  // Résumé
  console.log('\n📊 Résumé des tests');
  console.log('===================');
  console.log(`Mot de passe correct: ${passwordTest ? '✅' : '❌'}`);
  console.log(`Mot de passe incorrect: ${wrongPasswordTest ? '❌' : '✅'}`);
  console.log(`Application accessible: ${appUrlTest ? '✅' : '❌'}`);
  console.log(`Page de connexion: ${loginPageTest ? '✅' : '❌'}`);
  console.log(`Redirection active: ${redirectTest ? '✅' : '❌'}`);
  
  // Recommandations
  console.log('\n💡 Recommandations');
  console.log('==================');
  
  if (!appUrlTest) {
    console.log('1. Démarrer l\'application: cd frontend && npm run dev');
  }
  
  if (!redirectTest) {
    console.log('2. Vérifier que ProtectedRoute entoure bien toutes les routes');
    console.log('3. Vérifier que AuthProvider est bien au niveau racine');
  }
  
  if (passwordTest && wrongPasswordTest) {
    console.log('4. Vérifier la logique de validation du mot de passe');
  }
  
  console.log('\n🎯 Tests terminés!');
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testPassword,
  testAppUrl,
  testLoginPage,
  testRedirect,
  runTests
};



