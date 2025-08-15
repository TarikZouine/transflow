import React, { useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import {
  Save,
  RestoreRounded,
} from '@mui/icons-material';

interface Settings {
  language: string;
  model: string;
  autoSave: boolean;
  realTimeTranscription: boolean;
  speakerDetection: boolean;
  confidenceThreshold: number;
  audioQuality: string;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    language: 'fr',
    model: 'base',
    autoSave: true,
    realTimeTranscription: true,
    speakerDetection: false,
    confidenceThreshold: 0.7,
    audioQuality: 'high',
  });

  const [saved, setSaved] = useState(false);

  const handleSettingChange = (key: keyof Settings, value: any): void => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setSaved(false);
  };

  const handleSave = (): void => {
    // TODO: Sauvegarder les paramètres via API
    console.log('Sauvegarde des paramètres:', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = (): void => {
    setSettings({
      language: 'fr',
      model: 'base',
      autoSave: true,
      realTimeTranscription: true,
      speakerDetection: false,
      confidenceThreshold: 0.7,
      audioQuality: 'high',
    });
    setSaved(false);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Paramètres
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Configurez les paramètres de transcription selon vos besoins
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Paramètres sauvegardés avec succès !
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Paramètres de transcription */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Transcription
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Langue</InputLabel>
              <Select
                value={settings.language}
                label="Langue"
                onChange={(e) => handleSettingChange('language', e.target.value)}
              >
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="en">Anglais</MenuItem>
                <MenuItem value="es">Espagnol</MenuItem>
                <MenuItem value="de">Allemand</MenuItem>
                <MenuItem value="it">Italien</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Modèle Whisper</InputLabel>
              <Select
                value={settings.model}
                label="Modèle Whisper"
                onChange={(e) => handleSettingChange('model', e.target.value)}
              >
                <MenuItem value="tiny">Tiny (rapide, moins précis)</MenuItem>
                <MenuItem value="base">Base (équilibré)</MenuItem>
                <MenuItem value="small">Small (plus précis)</MenuItem>
                <MenuItem value="medium">Medium (très précis)</MenuItem>
                <MenuItem value="large">Large (maximum de précision)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Seuil de confiance</InputLabel>
              <Select
                value={settings.confidenceThreshold}
                label="Seuil de confiance"
                onChange={(e) => handleSettingChange('confidenceThreshold', e.target.value)}
              >
                <MenuItem value={0.5}>50% (accepte plus de résultats)</MenuItem>
                <MenuItem value={0.6}>60%</MenuItem>
                <MenuItem value={0.7}>70% (recommandé)</MenuItem>
                <MenuItem value={0.8}>80%</MenuItem>
                <MenuItem value={0.9}>90% (très strict)</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.realTimeTranscription}
                  onChange={(e) => handleSettingChange('realTimeTranscription', e.target.checked)}
                />
              }
              label="Transcription en temps réel"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.speakerDetection}
                  onChange={(e) => handleSettingChange('speakerDetection', e.target.checked)}
                />
              }
              label="Détection des interlocuteurs"
            />
          </Paper>
        </Grid>

        {/* Paramètres audio et système */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Audio et Système
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Qualité audio</InputLabel>
              <Select
                value={settings.audioQuality}
                label="Qualité audio"
                onChange={(e) => handleSettingChange('audioQuality', e.target.value)}
              >
                <MenuItem value="low">Basse (économise la bande passante)</MenuItem>
                <MenuItem value="medium">Moyenne</MenuItem>
                <MenuItem value="high">Haute (recommandé)</MenuItem>
                <MenuItem value="lossless">Sans perte (maximum)</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoSave}
                  onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                />
              }
              label="Sauvegarde automatique"
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              Informations système
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Version: 1.0.0
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Dernière mise à jour: {new Date().toLocaleDateString('fr-FR')}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Actions */}
      <Paper elevation={2} sx={{ p: 2, mt: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<RestoreRounded />}
            onClick={handleReset}
          >
            Réinitialiser
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
          >
            Sauvegarder
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
