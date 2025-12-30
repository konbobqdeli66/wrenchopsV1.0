import React, { useState, useEffect } from 'react';
import { Grid, Card, CardContent, Typography, CardActionArea, Box } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

import { decodeJwtPayload } from '../utils/jwt';

export default function Home({ setPage, t }) {
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Get user nickname from JWT token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = decodeJwtPayload(token);
        setUserEmail(payload?.nickname || t('user'));
      } catch (error) {
        setUserEmail(t('user'));
      }
    }
  }, [t]);
  const menuItems = [
    {
      title: t('clients'),
      description: t('homeClientsDesc'),
      icon: <PeopleIcon sx={{ fontSize: 60, color: '#1976d2' }} />,
      page: 1
    },
    {
      title: t('orders'),
      description: t('homeOrdersDesc'),
      icon: <AssignmentIcon sx={{ fontSize: 60, color: '#2e7d32' }} />,
      page: 2
    },
    {
      title: t('worktimes'),
      description: t('homeWorktimesDesc'),
      icon: <AccessTimeIcon sx={{ fontSize: 60, color: '#ed6c02' }} />,
      page: 3
    },
    {
      title: t('vehicles'),
      description: t('homeVehiclesDesc'),
      icon: <DirectionsCarIcon sx={{ fontSize: 60, color: '#9c27b0' }} />,
      page: 4
    },
    {
      title: t('invoices'),
      description: t('homeInvoicesDesc'),
      icon: <ReceiptLongIcon sx={{ fontSize: 60, color: '#f9a825' }} />,
      page: 5
    }
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{
          mb: 4,
          fontWeight: 'bold',
          fontSize: { xs: '1.75rem', sm: '2.125rem' }
        }}
      >
        {userEmail || t('welcome')}
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {menuItems.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                },
                minHeight: { xs: 140, sm: 160 }
              }}
            >
              <CardActionArea onClick={() => setPage(item.page)} sx={{ height: '100%', p: { xs: 2, sm: 3 } }}>
                <CardContent sx={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ mb: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.cloneElement(item.icon, {
                      sx: {
                        fontSize: { xs: 48, sm: 60 },
                        ...item.icon.props.sx
                      }
                    })}
                  </Box>
                  <Typography
                    variant="h5"
                    component="h2"
                    gutterBottom
                    sx={{
                      fontWeight: 'bold',
                      fontSize: { xs: '1.25rem', sm: '1.5rem' }
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}
                  >
                    {item.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
