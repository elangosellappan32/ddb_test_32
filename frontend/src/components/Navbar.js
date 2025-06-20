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
import { 
  useLocation 
} from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  Factory as ProductionIcon,
  ShowChart as ConsumptionIcon,
  AssessmentOutlined as ReportsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  AccountCircle as ProfileIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import logo from '../assets/logo.jpg'; // Ensure this path is correct

const Navbar = () => {
  const navigate = useNavigation();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogouting, setIsLogouting] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navItems = useMemo(() => [
    { 
      icon: <DashboardIcon />, 
      label: 'Dashboard', 
      path: '/',
      color: '#1976D2' // Blue
    },
    { 
      icon: <ProductionIcon />, 
      label: 'Production', 
      path: '/production',
      color: '#2E7D32' // Green
    },
    { 
      icon: <ConsumptionIcon />, 
      label: 'Consumption', 
      path: '/consumption',
      color: '#ED6C02' // Orange
    },
    {
      icon: <AssignmentTurnedInIcon />,
      label: 'Allocation',
      path: '/allocation',
      color: '#F44336' // Red
    },
    { 
      icon: <ReportsIcon />, 
      label: 'Reports', 
      path: '/report',
      color: '#9C27B0' // Purple
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

  // Add role-specific styling
  const getRoleStyles = (role) => {
    return {
      backgroundColor: role === 'admin' ? '#d32f2f' : '#1976D2',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };
  };

  // User menu with role-specific data
  const UserMenu = () => (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)} // Fixed: Removed extra parenthesis
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
        sx: {
          minWidth: '250px',
          mt: 1.5
        }
      }}
    >
      {/* User Profile Section */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar 
            sx={{ 
              width: 48, 
              height: 48,
              bgcolor: user?.role === 'admin' ? '#d32f2f' : '#1976D2',
              color: 'white',
              mr: 2
            }}
          >
            {user?.username?.[0].toUpperCase() || 'A'}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {user?.username || 'Admin'}
            </Typography>
            <Box sx={getRoleStyles(user?.role)}>
              {user?.role || 'ADMIN'}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* User Details Section */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Employee ID: {user?.employeeId || 'ADMIN001'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Department: {user?.department || 'Administration'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Access Level: {user?.role === 'admin' ? 'Full Access' : 'Limited Access'}
        </Typography>
      </Box>

      <Divider />
      
      {/* Menu Actions */}
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

  // Update user section in the navbar
  const UserSection = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box 
        sx={{ 
          display: { xs: 'none', md: 'flex' }, 
          alignItems: 'center', 
          gap: 2 
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'white', 
            fontWeight: 'medium'
          }}
        >
          {user?.username || 'Admin'}
        </Typography>
        <Box sx={getRoleStyles(user?.role)}>
          {user?.role || 'ADMIN'}
        </Box>
      </Box>
      
      <Tooltip title="Profile & Settings">
        <IconButton 
          onClick={handleUserMenuOpen} 
          sx={{ 
            p: 0,
            border: '2px solid white',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)'
            }
          }}
        >
          <Avatar 
            sx={{ 
              width: 36, 
              height: 36,
              bgcolor: user?.role === 'admin' ? '#d32f2f' : '#1976D2',
              color: 'white'
            }}
          >
            {user?.username?.[0].toUpperCase() || 'A'}
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
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      sx={{
        '& .MuiDrawer-paper': { 
          boxSizing: 'border-box', 
          width: 240 
        },
      }}
    >
      <Box
        sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          p: 1 
        }}
      >
        <IconButton onClick={handleMobileMenuToggle}>
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem 
            key={item.path}
            button 
            onClick={() => handleNavigation(item.path)}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
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
        backgroundColor: user?.role === 'admin' ? '#1a237e' : '#1976D2',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          px: 3,
          py: 1,
          height: 64
        }}
      >
        {/* Mobile Menu Toggle */}
        {isMobile && (
          <IconButton 
            color="inherit" 
            aria-label="open drawer"
            edge="start"
            onClick={handleMobileMenuToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo and Company Name */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 2
          }}
        >
          <img 
            src={logo} 
            alt="STRIO Logo" 
            style={{ 
              height: 40, 
              width: 'auto' 
            }} 
          />
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 'bold',
              color: 'white'
            }}
          >
            STRIO
          </Typography>
        </Box>

        {/* Navigation Icons */}
        <Box 
          sx={{ 
            display: { xs: 'none', md: 'flex' }, 
            alignItems: 'center', 
            gap: 15  
          }}
        >
          {navItems.map((item) => (
            <Tooltip key={item.path} title={item.label}>
              <IconButton
                aria-label={`Go to ${item.label}`}
                onClick={() => handleNavigation(item.path)}
                sx={{ 
                  color: location.pathname === item.path ? 'white' : 'rgba(255,255,255,0.7)',
                  backgroundColor: location.pathname === item.path 
                    ? 'rgba(255,255,255,0.2)' 
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  },
                  p: 2,  
                  fontSize: '1.5rem'  
                }}
              >
                {React.cloneElement(item.icon, { fontSize: 'inherit' })}
              </IconButton>
            </Tooltip>
          ))}
        </Box>

        {/* Updated User Section */}
        <UserSection />

        {/* Updated User Menu */}
        <UserMenu />

        {/* Mobile Drawer */}
        {isMobile && <MobileDrawer />}
      </Box>
    </Box>
  );
};

export default Navbar;