import React from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
} from '@mui/material';
import {
  Mic,
  History,
  Settings,
  TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Mic sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Transcription en temps réel',
      description: 'Transcrivez vos appels téléphoniques en direct avec une précision élevée',
      action: () => navigate('/transcription'),
      buttonText: 'Commencer'
    },
    {
      icon: <History sx={{ fontSize: 40, color: 'secondary.main' }} />,
      title: 'Historique des sessions',
      description: 'Consultez et gérez toutes vos sessions de transcription passées',
      action: () => navigate('/history'),
      buttonText: 'Voir l\'historique'
    },
    {
      icon: <Settings sx={{ fontSize: 40, color: 'success.main' }} />,
      title: 'Configuration',
      description: 'Personnalisez les paramètres de transcription selon vos besoins',
      action: () => navigate('/settings'),
      buttonText: 'Configurer'
    }
  ];

  const stats = [
    { label: 'Sessions totales', value: '0', icon: <Mic /> },
    { label: 'Heures transcrites', value: '0h', icon: <TrendingUp /> },
    { label: 'Précision moyenne', value: '0%', icon: <TrendingUp /> },
  ];

  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        Bienvenue sur TransFlow
      </Typography>
      
      <Typography variant="h6" color="text.secondary" paragraph>
        Votre solution de transcription d'appels en temps réel alimentée par l'intelligence artificielle
      </Typography>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={4} key={index}>
            <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                {stat.icon}
                <Typography variant="h4" sx={{ ml: 1 }}>
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
          <Grid item xs={12} md={4} key={index}>
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
          Premiers pas
        </Typography>
        <Typography variant="body1">
          1. Cliquez sur "Commencer" pour démarrer votre première session de transcription
          <br />
          2. Autorisez l'accès au microphone lorsque votre navigateur vous le demande
          <br />
          3. Commencez à parler et regardez la transcription apparaître en temps réel
        </Typography>
      </Paper>
    </Box>
  );
};

export default HomePage;
