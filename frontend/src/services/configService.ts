import { TranscriptionEngine, TranscriptionEngineConfig } from '../../types';

export interface TranscriptionSettings {
  engine: TranscriptionEngine;
  model: string;
  language: string;
  confidenceThreshold: number;
  realTimeTranscription: boolean;
  speakerDetection: boolean;
  audioQuality: string;
  autoSave: boolean;
}

class ConfigService {
  private static instance: ConfigService;
  private settings: TranscriptionSettings;

  private constructor() {
    // Charger les paramètres depuis le localStorage ou utiliser les valeurs par défaut
    this.settings = this.loadSettings();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadSettings(): TranscriptionSettings {
    try {
      const saved = localStorage.getItem('transflow-settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des paramètres:', error);
    }

    // Valeurs par défaut
    return {
      engine: 'whisper',
      model: 'base',
      language: 'fr',
      confidenceThreshold: 0.7,
      realTimeTranscription: true,
      speakerDetection: false,
      audioQuality: 'high',
      autoSave: true,
    };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('transflow-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
    }
  }

  public getSettings(): TranscriptionSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<TranscriptionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getTranscriptionEngine(): TranscriptionEngine {
    return this.settings.engine;
  }

  public async switchTranscriptionEngine(engine: TranscriptionEngine): Promise<boolean> {
    try {
      // Appeler l'API backend pour changer le moteur
      const response = await fetch('/api/transcription/engine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ engine }),
      });

      if (response.ok) {
        this.updateSettings({ engine });
        
        // Mettre à jour le modèle par défaut selon le moteur
        if (engine === 'whisper') {
          this.updateSettings({ model: 'base' });
        } else if (engine === 'vosk') {
          this.updateSettings({ model: 'vosk-model-small-fr' });
        }
        
        return true;
      } else {
        console.error('Erreur lors du changement de moteur:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Erreur lors du changement de moteur:', error);
      return false;
    }
  }

  public getAvailableModels(engine: TranscriptionEngine): Array<{ value: string; label: string; description: string }> {
    if (engine === 'whisper') {
      return [
        { value: 'tiny', label: 'Tiny (rapide, moins précis)', description: '39M params, ~1GB RAM' },
        { value: 'base', label: 'Base (équilibré)', description: '74M params, ~1GB RAM' },
        { value: 'small', label: 'Small (plus précis)', description: '244M params, ~2GB RAM' },
        { value: 'medium', label: 'Medium (très précis)', description: '769M params, ~5GB RAM' },
        { value: 'large', label: 'Large (maximum de précision)', description: '1550M params, ~10GB RAM' },
      ];
    } else {
      return [
        { value: 'vosk-model-small-fr', label: 'Petit modèle français', description: '42M params, ~50MB RAM' },
        { value: 'vosk-model-fr', label: 'Modèle français standard', description: '1.2GB params, ~1.2GB RAM' },
        { value: 'vosk-model-small-en', label: 'Petit modèle anglais', description: '42M params, ~50MB RAM' },
        { value: 'vosk-model-en', label: 'Modèle anglais standard', description: '1.2GB params, ~1.2GB RAM' },
      ];
    }
  }

  public async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Vérifier que le modèle est compatible avec le moteur
    const availableModels = this.getAvailableModels(this.settings.engine);
    const modelExists = availableModels.some(m => m.value === this.settings.model);
    
    if (!modelExists) {
      errors.push(`Le modèle "${this.settings.model}" n'est pas compatible avec le moteur ${this.settings.engine}`);
    }

    // Vérifier la langue
    if (!['fr', 'en', 'es', 'de', 'it'].includes(this.settings.language)) {
      errors.push(`La langue "${this.settings.language}" n'est pas supportée`);
    }

    // Vérifier le seuil de confiance
    if (this.settings.confidenceThreshold < 0 || this.settings.confidenceThreshold > 1) {
      errors.push('Le seuil de confiance doit être entre 0 et 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public getEngineInfo(engine: TranscriptionEngine): { name: string; description: string; pros: string[]; cons: string[] } {
    if (engine === 'whisper') {
      return {
        name: 'Whisper',
        description: 'Moteur de transcription OpenAI - Précision maximale',
        pros: ['Précision élevée', 'Support multilingue', 'Modèles optimisés', 'Reconnaissance contextuelle'],
        cons: ['Plus lent', 'Plus de ressources', 'Dépendance externe', 'Coût potentiel'],
      };
    } else {
      return {
        name: 'Vosk',
        description: 'Moteur open source - Rapidité maximale',
        pros: ['Très rapide', 'Faible consommation', 'Offline complet', 'Gratuit'],
        cons: ['Précision limitée', 'Modèles spécifiques', 'Moins de langues', 'Moins de contexte'],
      };
    }
  }
}

export default ConfigService;
