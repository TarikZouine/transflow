import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
  Chip,
} from '@mui/material';
import {
  Mic,
  History,
  Settings,
  Phone,
  PhoneInTalk,
  TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AuthStatus from '../components/AuthStatus';

interface CallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [callStats, setCallStats] = useState<CallStats | null>(null);

  // Récupérer les statistiques d'appels
  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Fetching stats from HomePage...');
        
        const [activeResponse, allResponse] = await Promise.all([
          fetch('/api/calls/active', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
          }),
          fetch('/api/calls', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
          })
        ]);
        
        console.log('Active response status:', activeResponse.status);
        console.log('All response status:', allResponse.status);
        
        if (!activeResponse.ok || !allResponse.ok) {
          throw new Error('HTTP error in stats fetch');
        }
        
        const activeData = await activeResponse.json();
        const allData = await allResponse.json();
        
        console.log('Stats data:', { activeData, allData });
        
        if (activeData.success && allData.success) {
          setCallStats({
            totalCalls: allData.count,
            activeCalls: activeData.count,
            completedCalls: allData.count - activeData.count,
          });
        }
      } catch (error) {
        console.error('Erreur récupération stats:', error);
      }
    };

    fetchStats();
    
    // Rafraîchir les stats toutes les 10 secondes
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <PhoneInTalk sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Appels en Direct',
      description: 'Surveillez les appels en cours et gérez les transcriptions en temps réel',
      action: () => navigate('/calls'),
      buttonText: 'Voir les appels'
    },
    {
      icon: <Mic sx={{ fontSize: 40, color: 'secondary.main' }} />,
      title: 'Transcription',
      description: 'Transcrivez vos fichiers audio avec une précision élevée',
      action: () => navigate('/transcription'),
      buttonText: 'Transcrire'
    },
    {
      icon: <History sx={{ fontSize: 40, color: 'success.main' }} />,
      title: 'Historique',
      description: 'Consultez et gérez toutes vos sessions passées',
      action: () => navigate('/history'),
      buttonText: 'Historique'
    },
    {
      icon: <Settings sx={{ fontSize: 40, color: 'info.main' }} />,
      title: 'Configuration',
      description: 'Personnalisez les paramètres selon vos besoins',
      action: () => navigate('/settings'),
      buttonText: 'Configurer'
    }
  ];

  const stats = [
    { 
      label: 'Appels en cours', 
      value: callStats?.activeCalls?.toString() || '0', 
      icon: <PhoneInTalk />,
      color: 'success.main'
    },
    { 
      label: 'Total appels', 
      value: callStats?.totalCalls?.toString() || '0', 
      icon: <Phone />,
      color: 'primary.main'
    },
    { 
      label: 'Appels terminés', 
      value: callStats?.completedCalls?.toString() || '0', 
      icon: <TrendingUp />,
      color: 'info.main'
    },
  ];

  return (
    <Box>
      {/* Composant de test d'authentification */}
      <AuthStatus />
      
      <Typography variant="h3" component="h1" gutterBottom>
        Bienvenue sur TransFlow
      </Typography>
      
      <Typography variant="h6" color="text.secondary" paragraph>
        Surveillance et transcription d'appels en temps réel depuis /home/nfs_proxip_monitor/
      </Typography>
      
      {/* Indicateur de statut */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip 
          icon={<PhoneInTalk />} 
          label={`${callStats?.activeCalls || 0} appels en cours`}
          color={callStats?.activeCalls ? 'success' : 'default'}
          variant="outlined"
        />
        <Chip 
          icon={<Phone />} 
          label={`${callStats?.totalCalls || 0} appels surveillés`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={4} key={index}>
            <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                <Typography variant="h4" sx={{ ml: 1, color: stat.color }}>
                  {stat.value}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Fonctionnalités principales */}
      <Grid container spacing={3}>
        {features.map((feature, index) => (
          <Grid item xs={12} md={6} lg={3} key={index}>
            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {feature.description}
                </Typography>
                <Button
                  variant="contained"
                  onClick={feature.action}
                  fullWidth
                  sx={{ mt: 'auto' }}
                >
                  {feature.buttonText}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Section d'aide */}
      <Paper elevation={1} sx={{ p: 3, mt: 4, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          Fonctionnement
        </Typography>
        <Typography variant="body1">
          1. Les appels sont automatiquement détectés dans /home/nfs_proxip_monitor/
          <br />
          2. Chaque appel génère 2 fichiers: client (*-in.wav) et agent (*-out.wav)
          <br />
          3. Les appels actifs sont ceux modifiés dans les 30 dernières secondes
          <br />
          4. Cliquez sur "Voir les appels" pour surveiller l'activité en temps réel
        </Typography>
      </Paper>
    </Box>
  );
};

export default HomePage;
