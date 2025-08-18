import React, { useState, useEffect } from 'react';
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
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormLabel,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  Save,
  RestoreRounded,
  AutoAwesome,
  Speed,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import ConfigService, { TranscriptionSettings } from '../services/configService';

const SettingsPage: React.FC = () => {
  const configService = ConfigService.getInstance();
  const [settings, setSettings] = useState<TranscriptionSettings>(configService.getSettings());
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false);

  useEffect(() => {
    // Charger les paramètres au montage du composant
    setSettings(configService.getSettings());
  }, []);

  const handleSettingChange = async (key: keyof TranscriptionSettings, value: any): Promise<void> => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaved(false);

    // Si on change le moteur, valider et appliquer le changement
    if (key === 'transcriptionEngine') {
      setIsSwitchingEngine(true);
      try {
        const success = await configService.switchTranscriptionEngine(value);
        if (success) {
          // Mettre à jour le modèle par défaut
          const defaultModel = value === 'whisper' ? 'base' : 'vosk-model-small-fr';
          setSettings(prev => ({ ...prev, model: defaultModel }));
        } else {
          // Revenir à l'ancienne valeur en cas d'échec
          setSettings(prev => ({ ...prev, [key]: settings[key] }));
        }
      } catch (error) {
        console.error('Erreur lors du changement de moteur:', error);
        setSettings(prev => ({ ...prev, [key]: settings[key] }));
      } finally {
        setIsSwitchingEngine(false);
      }
    }

    // Valider la configuration
    const validation = await configService.validateConfiguration();
    setValidationErrors(validation.errors);
  };

  const handleSave = async (): Promise<void> => {
    try {
      // Valider la configuration avant la sauvegarde
      const validation = await configService.validateConfiguration();
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        return;
      }

      // Sauvegarder via le service
      configService.updateSettings(settings);
      
      // TODO: Sauvegarder les paramètres via API backend
      console.log('Sauvegarde des paramètres:', settings);
      
      setSaved(true);
      setValidationErrors([]);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleReset = (): void => {
    const defaultSettings = configService.getSettings();
    setSettings(defaultSettings);
    setSaved(false);
    setValidationErrors([]);
  };

  const getWhisperModels = () => configService.getAvailableModels('whisper');
  const getVoskModels = () => configService.getAvailableModels('vosk');
  const getEngineInfo = (engine: 'whisper' | 'vosk') => configService.getEngineInfo(engine);

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

      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Erreurs de validation :
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </Box>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Sélection du moteur de transcription */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesome /> Moteur de transcription
            </Typography>
            
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Choisissez votre moteur de transcription</FormLabel>
              <RadioGroup
                row
                value={settings.transcriptionEngine}
                onChange={(e) => handleSettingChange('transcriptionEngine', e.target.value)}
              >
                <Card sx={{ mr: 2, minWidth: 200, cursor: 'pointer' }}>
                  <CardContent 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      bgcolor: settings.transcriptionEngine === 'whisper' ? 'primary.light' : 'background.paper',
                      color: settings.transcriptionEngine === 'whisper' ? 'primary.contrastText' : 'text.primary',
                    }}
                    onClick={() => handleSettingChange('transcriptionEngine', 'whisper')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Radio value="whisper" checked={settings.transcriptionEngine === 'whisper'} />
                      <Typography variant="h6">Whisper</Typography>
                      {isSwitchingEngine && settings.transcriptionEngine === 'whisper' && (
                        <Chip label="Changement..." size="small" color="primary" />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {getEngineInfo('whisper').description}
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      {getEngineInfo('whisper').pros.map((pro, index) => (
                        <Chip key={index} label={pro} size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </Box>
                    <Box>
                      {getEngineInfo('whisper').cons.map((con, index) => (
                        <Chip key={index} label={con} size="small" color="warning" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>

                <Card sx={{ cursor: 'pointer' }}>
                  <CardContent 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      bgcolor: settings.transcriptionEngine === 'vosk' ? 'primary.light' : 'background.paper',
                      color: settings.transcriptionEngine === 'vosk' ? 'primary.contrastText' : 'text.primary',
                    }}
                    onClick={() => handleSettingChange('transcriptionEngine', 'vosk')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Radio value="vosk" checked={settings.transcriptionEngine === 'vosk'} />
                      <Typography variant="h6">Vosk</Typography>
                      {isSwitchingEngine && settings.transcriptionEngine === 'vosk' && (
                        <Chip label="Changement..." size="small" color="primary" />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {getEngineInfo('vosk').description}
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      {getEngineInfo('vosk').pros.map((pro, index) => (
                        <Chip key={index} label={pro} size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </Box>
                    <Box>
                      {getEngineInfo('vosk').cons.map((con, index) => (
                        <Chip key={index} label={con} size="small" color="warning" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
          </Paper>
        </Grid>

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
              <InputLabel>
                {settings.transcriptionEngine === 'whisper' ? 'Modèle Whisper' : 'Modèle Vosk'}
              </InputLabel>
              <Select
                value={settings.model}
                label={settings.transcriptionEngine === 'whisper' ? 'Modèle Whisper' : 'Modèle Vosk'}
                onChange={(e) => handleSettingChange('model', e.target.value)}
              >
                {settings.transcriptionEngine === 'whisper' ? (
                  getWhisperModels().map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      <Box>
                        <Typography variant="body1">{model.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {model.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))
                ) : (
                  getVoskModels().map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      <Box>
                        <Typography variant="body1">{model.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {model.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))
                )}
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

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Moteur actuel: {getEngineInfo(settings.transcriptionEngine).name}
              </Typography>
              <Chip 
                label={settings.transcriptionEngine.toUpperCase()} 
                color="primary" 
                variant="outlined"
                icon={<AutoAwesome />}
              />
            </Box>
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
            disabled={validationErrors.length > 0 || isSwitchingEngine}
          >
            Sauvegarder
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
