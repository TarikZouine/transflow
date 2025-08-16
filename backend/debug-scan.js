// Debug de la fonction scanCalls
const fs = require('fs');
const path = require('path');

function scanCalls() {
  const monitorPath = '/home/nfs_proxip_monitor/';
  
  try {
    if (!fs.existsSync(monitorPath)) {
      console.log('❌ Répertoire n\'existe pas:', monitorPath);
      return [];
    }

    const files = fs.readdirSync(monitorPath);
    const audioFiles = files.filter(file => file.endsWith('.sln') || file.endsWith('.wav'));
    
    console.log('📁 Fichiers audio détectés:', audioFiles.length);
    
    const callGroups = new Map();
    const now = new Date();
    
    for (const file of audioFiles) {
      console.log('🔍 Traitement:', file);
      
      let match = file.match(/^(\d+\.\d+)-(.+)-(\d+)-(in|out)\.(sln|wav)$/);
      let phoneNumber, calledNumber = null, type, timestampStr, extension;
      
      if (match) {
        [, timestampStr, phoneNumber, calledNumber, type, extension] = match;
        console.log('  ✅ Nouveau format:', { timestampStr, phoneNumber, calledNumber, type, extension });
      } else {
        match = file.match(/^(\d+\.\d+)-(.+)-(in|out)\.(sln|wav)$/);
        if (!match) {
          console.log('  ❌ Aucun match pour:', file);
          continue;
        }
        [, timestampStr, phoneNumber, type, extension] = match;
        console.log('  ⚠️ Ancien format:', { timestampStr, phoneNumber, type, extension });
      }
      
      const callId = `${timestampStr}-${phoneNumber}`;
      console.log('  📞 Call ID:', callId);
      
      const filePath = path.join(monitorPath, file);
      const stats = fs.statSync(filePath);
      
      // Vérifier si le fichier a été modifié dans les 30 dernières secondes
      const timeSinceModified = now.getTime() - stats.mtime.getTime();
      const isActive = timeSinceModified <= 30000; // 30 secondes
      
      console.log('  📊 Taille:', stats.size, 'bytes, Modifié il y a:', Math.round(timeSinceModified/1000), 's, Actif:', isActive);
      
      if (!callGroups.has(callId)) {
        callGroups.set(callId, {
          id: callId,
          phoneNumber,
          calledNumber,
          startTime: stats.birthtime || stats.mtime,
          lastActivity: stats.mtime,
          status: isActive ? 'active' : 'completed',
          clientFile: null,
          agentFile: null,
        });
        console.log('  🆕 Nouvel appel créé:', callId);
      }
      
      const call = callGroups.get(callId);
      if (calledNumber && !call.calledNumber) {
        call.calledNumber = calledNumber;
      }
      
      const fileCreationTime = stats.birthtime || stats.mtime;
      if (fileCreationTime < call.startTime) {
        call.startTime = fileCreationTime;
      }
      if (stats.mtime > call.lastActivity) {
        call.lastActivity = stats.mtime;
        call.status = isActive ? 'active' : 'completed';
      }
      
      if (type === 'in') {
        call.clientFile = { path: filePath, size: stats.size };
        console.log('  📥 Fichier client ajouté');
      } else {
        call.agentFile = { path: filePath, size: stats.size };
        console.log('  📤 Fichier agent ajouté');
      }
    }
    
    console.log('📋 Total call groups:', callGroups.size);
    const result = Array.from(callGroups.values())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    console.log('📊 Appels trouvés:');
    result.forEach((call, i) => {
      console.log(`  ${i+1}. ${call.id} - ${call.phoneNumber} -> ${call.calledNumber || 'N/A'} (${call.status})`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Erreur scan appels:', error);
    return [];
  }
}

console.log('🚀 Début du scan...');
const result = scanCalls();
console.log('✅ Résultat final:', result.length, 'appels');

