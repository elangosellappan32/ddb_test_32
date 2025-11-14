import React, { useState, useMemo } from 'react';
import { 
  Box, 
  IconButton, 
  Tooltip, 
  Typography, 
  Avatar, 
  Menu, 
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  Factory as FactoryIcon,
  ElectricalServices as ElectricalServicesIcon,
  AssessmentOutlined as ReportsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  AccountCircle as ProfileIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  BarChart as BarChartIcon,
  Receipt as ReceiptIcon,
  SyncAlt as SyncAltIcon,
  Apartment as CompanyIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import logo from '../assets/logo.png'; 

const roleColors = {
  admin: '#d32f2f',   // Red
  user: '#0f235fff',    // Blue
  viewer: '#fbc02d'   // Yellow
};

const Navbar = () => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigation();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // State
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogouting, setIsLogouting] = useState(false);


  const navItems = useMemo(() => [
    { 
      icon: <DashboardIcon />, 
      label: 'Dashboard', 
      path: '/',
      resource: 'dashboard'
    },
    {
      icon: <CompanyIcon />,
      label: 'Companies',
      path: '/companies',
      resource: 'company'
    },
    { 
      icon: <FactoryIcon />, 
      label: 'Production', 
      path: '/production',
      resource: 'production'
    },
    { 
      icon: <ElectricalServicesIcon />, 
      label: 'Consumption', 
      path: '/consumption',
      resource: 'consumption'
    },
    {
      icon: <SyncAltIcon />,
      label: 'Consumption Allocation',
      path: '/consumption-allocation',
      resource: 'allocation'
    },
    {
      icon: <AssignmentTurnedInIcon />,
      label: 'Allocation',
      path: '/allocation',
      resource: 'allocation'
    },
    {
      icon: <ReceiptIcon />,
      label: 'Invoice',
      path: '/invoice',
      resource: 'invoice',
      requiredResource: 'invoice',
      requiredAction: 'READ'
    },
    { 
      icon: <BarChartIcon />, 
      label: 'Graphical', 
      path: '/graphical-report',
      resource: 'report'
    },
    { 
      icon: <ReportsIcon />, 
      label: 'Compliance', 
      path: '/report',
      resource: 'report'
    }
  ], []);


  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };


  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };


  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };


  const handleMobileMenuToggle = () => {
    setMobileOpen(!mobileOpen);
  };


  const handleLogout = async () => {
    setIsLogouting(true);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsLogouting(false);
    }
  };


  const getRoleColor = (role) => {
    return roleColors[role] || roleColors.user;
  };


  const getRoleStyles = (role) => {
    return {
      backgroundColor: getRoleColor(role),
      color: 'black',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };
  };


  const UserMenu = () => (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleUserMenuClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        elevation: 3,
        sx: { minWidth: 250, mt: 1.5 }
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar 
            sx={{ 
              width: 48, 
              height: 48,
              bgcolor: getRoleColor(user?.role),
              color: 'white',  // Text color white
              mr: 2
            }}
          >
            {user?.username?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
              {user?.username || 'User'}
            </Typography>
            <Box sx={getRoleStyles(user?.role)}>
              {user?.role?.toUpperCase() || 'USER'}
            </Box>
          </Box>
        </Box>
      </Box>


      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Employee ID: {user?.employeeId || 'N/A'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Department: {user?.department || 'N/A'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Access Level: {user?.role === 'admin' ? 'Full Access' : 'Limited Access'}
        </Typography>
      </Box>


      <Divider />


      <MenuItem onClick={handleUserMenuClose}>
        <ProfileIcon sx={{ mr: 1, color: 'primary.main' }} />
        View Full Profile
      </MenuItem>


      <MenuItem 
        onClick={handleLogout} 
        disabled={isLogouting}
        sx={{ color: 'error.main' }}
      >
        {isLogouting ? (
          <CircularProgress size={20} sx={{ mr: 1 }} />
        ) : (
          <LogoutIcon sx={{ mr: 1 }} />
        )}
        Logout
      </MenuItem>
    </Menu>
  );


  const UserSection = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
      <Box 
        sx={{ 
          display: { xs: 'none', md: 'flex' }, 
          alignItems: 'center',
          gap: 1
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'white', 
            fontWeight: 'medium',
            fontSize: '0.875rem'
          }}
        >
          {user?.username || 'User'}
        </Typography>
        <Box 
          sx={{ 
            ...getRoleStyles(user?.role),
            color: 'white',
            fontSize: '0.65rem',
            padding: '2px 6px'
          }}
        >
          {user?.role?.toUpperCase() || 'USER'}
        </Box>
      </Box>
      <Tooltip title="Profile & Settings">
        <IconButton 
          onClick={handleUserMenuOpen} 
          sx={{ 
            p: 0,
            border: '2px solid white',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
          }}
        >
          <Avatar 
            sx={{ 
              width: 36, 
              height: 36,
              bgcolor: getRoleColor(user?.role),
              color: 'white'  // Text color white
            }}
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
        </IconButton>
      </Tooltip>
    </Box>
  );


  const MobileDrawer = () => (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={handleMobileMenuToggle}
      ModalProps={{ keepMounted: true }}
      sx={{ 
        '& .MuiDrawer-paper': { 
          boxSizing: 'border-box', 
          width: 240,
          backgroundColor: '#1a237e',
          color: 'white'
        } 
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
          <img 
            src={logo} 
            alt="STRIO Logo" 
            style={{ height: 28, width: 'auto' }} 
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'white' }}>
            STRIO
          </Typography>
        </Box>
        <IconButton 
          onClick={handleMobileMenuToggle}
          sx={{ color: 'white' }}
        >
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ py: 1 }}>
        {navItems.map((item) => (
          <ListItem 
            key={item.path}
            button 
            onClick={() => handleNavigation(item.path)}
            selected={location.pathname === item.path}
            sx={{
              py: 1.5,
              px: 2,
              color: 'white',
              bgcolor: location.pathname === item.path ? 'rgba(255,255,255,0.15)' : 'transparent',
              '&:hover': { 
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiListItemIcon-root': {
                  transform: 'scale(1.1)'
                }
              },
              '&.Mui-selected': {
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.25)'
                }
              }
            }}
          >
            <ListItemIcon sx={{ 
              color: 'white',
              minWidth: 40,
              transition: 'transform 0.2s',
              '& .MuiSvgIcon-root': {
                fontSize: '1.4rem'
              }
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label} 
              primaryTypographyProps={{
                fontSize: '0.95rem',
                fontWeight: 500
              }}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );

  return (
    <Box 
      sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        backgroundColor: '#1a237e',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          px: 2,
          py: 0.5,
          height: 56
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isMobile && (
            <IconButton 
              color="inherit" 
              aria-label="open drawer"
              edge="start"
              onClick={handleMobileMenuToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon sx={{ color: 'white' }} />
            </IconButton>
          )}
          <img 
            src={logo} 
            alt="STRIO Logo" 
            style={{ height: 36, width: 'auto' }} 
          />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
            STRIO
          </Typography>
        </Box>

        <Box 
          sx={{ 
            display: { xs: 'none', md: 'flex' }, 
            alignItems: 'center', 
            gap: 10,   // Very large gap of 10 (80px) between icons
            mx: 6,     // Maximum margin for edge spacing
            '& > *': {  // Target all direct children
              margin: '0 16px'  // Maximum margin between icons
            }
          }}
        >
          {navItems.map((item) => (
            <Tooltip key={item.path} title={item.label} arrow>
              <IconButton
                aria-label={`Go to ${item.label}`}
                onClick={() => handleNavigation(item.path)}
                sx={{ 
                  color: 'white',
                  backgroundColor: location.pathname === item.path 
                    ? 'rgba(255,255,255,0.2)' 
                    : 'transparent',
                  '&:hover': { 
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    transform: 'scale(1.05)'
                  },
                  p: 0.6,  // Minimal padding to maximize gap space
                  transition: 'all 0.2s ease-in-out',
                  '& .MuiSvgIcon-root': { 
                    fontSize: '1.4rem',
                    color: 'white'
                  }
                }}
              >
                {item.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>

        <UserSection />
        <UserMenu />
        {isMobile && <MobileDrawer />}
      </Box>
    </Box>
  );
};


export default Navbar;
