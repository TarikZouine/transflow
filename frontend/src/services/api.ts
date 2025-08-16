import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Configuration de base pour l'API
// Connexion directe au serveur SLN rapide
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://ai.intelios.us:5002/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur de requête pour ajouter le token d'authentification
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Intercepteur de réponse pour gérer les erreurs globales
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expiré ou invalide
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Méthodes génériques
  async get<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<T> = await this.api.get(endpoint);
    return response.data;
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.api.post(endpoint, data);
    return response.data;
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.api.put(endpoint, data);
    return response.data;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<T> = await this.api.delete(endpoint);
    return response.data;
  }

  // Méthodes spécifiques à l'application
  
  // Appels en temps réel
  async getCalls() {
    return this.get('/calls');
  }

  async getActiveCalls() {
    return this.get('/calls/active');
  }

  async getCall(id: string) {
    return this.get(`/calls/${id}`);
  }

  async getCallFileInfo(id: string, type: 'in' | 'out') {
    return this.get(`/calls/${id}/fileinfo/${type}`);
  }

  async monitorCall(id: string) {
    return this.get(`/calls/${id}/monitor`);
  }

  // Sessions de transcription
  async getSessions() {
    return this.get('/sessions');
  }

  async getSession(id: string) {
    return this.get(`/sessions/${id}`);
  }

  async createSession(data: { title: string; metadata?: any }) {
    return this.post('/sessions', data);
  }

  async updateSession(id: string, data: any) {
    return this.put(`/sessions/${id}`, data);
  }

  async deleteSession(id: string) {
    return this.delete(`/sessions/${id}`);
  }

  // Transcriptions
  async getTranscriptions(sessionId: string) {
    return this.get(`/sessions/${sessionId}/transcriptions`);
  }

  async downloadTranscription(sessionId: string, format: 'txt' | 'json' | 'srt' = 'txt') {
    const response = await this.api.get(`/sessions/${sessionId}/download`, {
      params: { format },
      responseType: 'blob',
    });
    
    return response.data;
  }

  // Paramètres utilisateur
  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(settings: any) {
    return this.put('/settings', settings);
  }

  // Statistiques
  async getStats() {
    return this.get('/stats');
  }

  // Upload de fichiers audio
  async uploadAudio(file: File, sessionId?: string) {
    const formData = new FormData();
    formData.append('audio', file);
    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    const response = await this.api.post('/upload/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
