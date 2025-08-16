#!/usr/bin/env node

// Script de test pour démontrer le streaming continu sans pause
const EventSource = require('eventsource').EventSource || require('eventsource');

console.log('🎯 Test du streaming en temps réel TransFlow');
console.log('============================================\n');

// Test 1: Streaming de tous les appels
console.log('📊 Test 1: Streaming de la liste des appels...');
const allCallsSource = new EventSource('http://localhost:5002/api/calls/stream-all');

let callUpdateCount = 0;
let lastCallCount = 0;

allCallsSource.onopen = () => {
    console.log('✅ Connexion établie pour le streaming des appels');
};

allCallsSource.addEventListener('connected', (event) => {
    const data = JSON.parse(event.data);
    console.log('🔗 Connexion confirmée:', data.message);
});

allCallsSource.addEventListener('calls-update', (event) => {
    const data = JSON.parse(event.data);
    callUpdateCount++;
    
    const activeCalls = data.calls.filter(call => call.status === 'active');
    
    if (data.calls.length !== lastCallCount || callUpdateCount % 5 === 1) {
        console.log(`📋 Mise à jour #${callUpdateCount}: ${data.calls.length} appels total, ${activeCalls.length} actifs`);
        lastCallCount = data.calls.length;
        
        if (activeCalls.length > 0) {
            console.log('🔴 Appels actifs:');
            activeCalls.slice(0, 3).forEach(call => {
                const duration = Math.floor(call.duration / 1000);
                console.log(`   - ${call.phoneNumber} → ${call.calledNumber} (${duration}s)`);
            });
        }
    }
});

allCallsSource.onerror = (error) => {
    console.error('❌ Erreur streaming appels:', error);
};

// Test 2: Streaming audio d'un appel actif après 5 secondes
setTimeout(() => {
    console.log('\n🎵 Test 2: Streaming audio d\'un appel actif...');
    
    // Récupérer un appel actif
    fetch('http://localhost:5002/api/calls/active')
        .then(response => response.json())
        .then(data => {
            if (data.data.length > 0) {
                const activeCall = data.data[0];
                console.log(`🎯 Sélection de l'appel: ${activeCall.phoneNumber} (${activeCall.id})`);
                
                const audioStreamUrl = `http://localhost:5002/api/calls/${activeCall.id}/stream-realtime/in`;
                const audioSource = new EventSource(audioStreamUrl);
                
                let audioChunkCount = 0;
                let totalBytes = 0;
                
                audioSource.onopen = () => {
                    console.log('✅ Connexion audio établie');
                };
                
                audioSource.addEventListener('connected', (event) => {
                    const data = JSON.parse(event.data);
                    console.log('🔗 Audio connecté:', data.message);
                });
                
                audioSource.addEventListener('audio-chunk', (event) => {
                    const data = JSON.parse(event.data);
                    audioChunkCount++;
                    totalBytes += data.chunkSize;
                    
                    const progressPercent = ((data.offset / data.totalSize) * 100).toFixed(1);
                    
                    if (audioChunkCount % 10 === 1) {
                        console.log(`🎵 Chunk #${audioChunkCount}: ${data.chunkSize} bytes (${progressPercent}% - ${totalBytes} bytes total)`);
                    }
                });
                
                audioSource.addEventListener('status', (event) => {
                    const data = JSON.parse(event.data);
                    if (audioChunkCount % 50 === 1) {
                        console.log(`📊 Status: ${data.progress.toFixed(1)}% - ${data.callStatus}`);
                    }
                });
                
                audioSource.onerror = (error) => {
                    console.error('❌ Erreur streaming audio:', error);
                };
                
                // Arrêter le test audio après 30 secondes
                setTimeout(() => {
                    audioSource.close();
                    console.log(`\n✅ Test audio terminé: ${audioChunkCount} chunks reçus (${totalBytes} bytes)`);
                }, 30000);
                
            } else {
                console.log('⚠️ Aucun appel actif trouvé pour le test audio');
            }
        })
        .catch(error => {
            console.error('❌ Erreur récupération appels actifs:', error);
        });
        
}, 5000);

// Test de santé du serveur
console.log('🏥 Test de santé du serveur...');
fetch('http://localhost:5002/health')
    .then(response => response.json())
    .then(data => {
        console.log('✅ Serveur en bonne santé:', data.status, '-', data.service);
        console.log(`🕐 Timestamp serveur: ${data.timestamp}\n`);
    })
    .catch(error => {
        console.error('❌ Erreur santé serveur:', error);
    });

// Affichage du statut toutes les 10 secondes
setInterval(() => {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏰ ${now} - Streaming actif (${callUpdateCount} mises à jour reçues)`);
}, 10000);

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du test...');
    allCallsSource.close();
    process.exit(0);
});

console.log('💡 Le test va durer indéfiniment. Utilisez Ctrl+C pour arrêter.\n');
