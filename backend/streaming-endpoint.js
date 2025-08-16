const fs = require('fs');
const path = require('path');

// Endpoint pour streaming continu par chunks
const createStreamingEndpoint = (app, scanCalls) => {
  
  // Streaming par chunks avec position
  app.get('/api/calls/:id/chunked-stream/:type', (req, res) => {
    const { id, type } = req.params;
    const startByte = parseInt(req.query.start || '0');
    
    try {
      const calls = scanCalls();
      const call = calls.find(c => c.id === id);
      
      if (!call) {
        return res.status(404).json({ error: 'Appel non trouvé' });
      }
      
      let filePath;
      if (type === 'in' && call.clientFile) {
        filePath = call.clientFile.path;
      } else if (type === 'out' && call.agentFile) {
        filePath = call.agentFile.path;
      } else {
        return res.status(404).json({ error: `Fichier ${type} non trouvé` });
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
      
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      
      // Si on demande au-delà de la taille actuelle, retourner ce qu'on a
      const actualStart = Math.min(startByte, fileSize);
      const chunkSize = Math.min(65536, fileSize - actualStart); // 64KB max
      
      if (chunkSize <= 0) {
        // Pas de nouvelles données
        return res.json({
          hasData: false,
          fileSize: fileSize,
          nextStart: fileSize,
          isActive: call.status === 'active'
        });
      }
      
      // Lire le chunk
      const buffer = Buffer.alloc(chunkSize);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, actualStart);
      fs.closeSync(fd);
      
      res.json({
        hasData: true,
        data: buffer.slice(0, bytesRead).toString('base64'),
        fileSize: fileSize,
        nextStart: actualStart + bytesRead,
        bytesRead: bytesRead,
        isActive: call.status === 'active'
      });
      
    } catch (error) {
      console.error('Erreur chunked stream:', error);
      res.status(500).json({ error: 'Erreur streaming' });
    }
  });
  
};

module.exports = { createStreamingEndpoint };
