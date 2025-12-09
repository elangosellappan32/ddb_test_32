import React, { useState, useMemo, useRef } from 'react';
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
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Grid,
  Chip
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
  Apartment as CompanyIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  History as HistoryIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { hasPermission } from '../utils/permissions';
import logo from '../assets/logo.png'; 

const roleColors = {
  superadmin: '#9c27b0', // Purple
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Ref for anchor element
  const anchorRef = useRef(null);


  // Memoized role checks for performance
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    
    // Check multiple possible role field locations and formats
    const roleChecks = [
      user?.roleName,
      user?.role,
      user?.roleId,
      user?.permissions?.role
    ].filter(Boolean);
    
    return roleChecks.some(role => {
      const roleStr = String(role).toUpperCase().trim();
      return roleStr === 'SUPERADMIN' || roleStr === 'SUPER_ADMIN';
    });
  }, [user]);


  const navItems = useMemo(() => {
    const allItems = [
      { 
        icon: <DashboardIcon />, 
        label: 'Dashboard', 
        path: '/',
        resource: 'dashboard'
      },
      { 
        icon: <PeopleIcon />, 
        label: 'Users', 
        path: '/users',
        resource: 'users',
        requiredRole: 'SUPERADMIN'
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
    ];

    return allItems.filter(item => {
      // Check for required role first
      if (item.requiredRole) {
        const userRole = user?.roleName || user?.role || user?.roleId;
        
        // Enhanced role checking for superadmin
        if (item.requiredRole === 'SUPERADMIN') {
          return isSuperAdmin;
        }
        
        // For other roles, use string comparison with better normalization
        const normalizedUserRole = String(userRole || '').toUpperCase().trim();
        const normalizedRequiredRole = String(item.requiredRole || '').toUpperCase().trim();
        
        return normalizedUserRole === normalizedRequiredRole;
      }
      
      // Check for specific action requirement (like invoice READ)
      if (item.requiredAction) {
        return hasPermission(user, item.resource, item.requiredAction);
      }
      
      // Superadmin should have access to all resources
      if (isSuperAdmin) {
        return true;
      }
      
      // Default permission check for READ access
      return hasPermission(user, item.resource, 'READ');
    });
  }, [user, isSuperAdmin]);


  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };


  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
    anchorRef.current = event.currentTarget;
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


  const handleViewProfile = () => {
    setIsProfileOpen(true);
    handleUserMenuClose();
  };


  const getRoleColor = (role) => {
    if (!role) return roleColors.user;
    const roleLower = role.toLowerCase();
    return roleColors[roleLower] || roleColors.user;
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


  // Memoized role checks for performance
  const isAdmin = useMemo(() => {
    if (!user) return false;
    
    const roleChecks = [
      user?.roleName,
      user?.role,
      user?.roleId,
      user?.permissions?.role
    ].filter(Boolean);
    
    return roleChecks.some(role => {
      const roleStr = String(role).toUpperCase().trim();
      return roleStr === 'ADMIN' || roleStr === 'SUPERADMIN' || roleStr === 'SUPER_ADMIN';
    });
  }, [user]);

  const isViewer = useMemo(() => {
    if (!user) return false;
    
    const roleChecks = [
      user?.roleName,
      user?.role,
      user?.roleId,
      user?.permissions?.role
    ].filter(Boolean);
    
    return roleChecks.some(role => {
      const roleStr = String(role).toUpperCase().trim();
      return roleStr === 'VIEWER';
    });
  }, [user]);

  // Get avatar content based on role
  const getAvatarContent = useMemo(() => {
    if (isSuperAdmin) {
      return <AdminPanelSettingsIcon />;
    }
    if (isViewer) {
      return <VisibilityIcon />;
    }
    // For ADMIN, USER, and all other roles, show initials
    return (user?.username?.[0] || 'U').toUpperCase();
  }, [isSuperAdmin, isViewer, user?.username]);

  const UserMenu = () => (
    <Menu
      anchorEl={anchorRef.current}
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
      disableAutoFocusItem
      disableEnforceFocus
      keepMounted
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar 
            sx={{ 
              width: 48, 
              height: 48,
              bgcolor: getRoleColor(user?.roleName || user?.role),
              color: 'white',
              mr: 2,
              '& .MuiSvgIcon-root': {
                fontSize: '1.75rem'
              }
            }}
          >
            {getAvatarContent}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
              {user?.username || 'User'}
            </Typography>
            <Box sx={getRoleStyles(user?.roleName)}>
              {(user?.roleName || user?.role || 'USER')?.toUpperCase()}
            </Box>
          </Box>
        </Box>
      </Box>


      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompanyIcon fontSize="small" color="action" />
          <Box>
            <Typography variant="caption" color="textSecondary" display="block" lineHeight={1.2}>
              Department
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {user?.metadata?.department || 
               user?.department || 
               (user?.metadata?.companyId ? 
                 (() => {
                   const companyId = user.metadata.companyId;
                   if (companyId === '1') return 'STRIO';
                   if (companyId === '5') return 'SMR';
                   return 'Not specified';
                 })() : 
                 'Not specified')}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminPanelSettingsIcon fontSize="small" color="action" />
          <Box>
            <Typography variant="caption" color="textSecondary" display="block" lineHeight={1.2}>
              Access Level
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isSuperAdmin || isAdmin ? 'success.main' : 
                         (user?.roleName === 'USER' || user?.role === 'USER') ? 'warning.main' : 'grey.500'
              }} />
              <Typography variant="body2" fontWeight={500}>
                {(() => {
                  const role = user?.roleName || user?.role || user?.roleId;
                  const roleStr = String(role || '').toUpperCase().trim();
                  
                  if (roleStr === 'SUPERADMIN' || roleStr === 'SUPER_ADMIN') return 'Administrator';
                  if (roleStr === 'ADMIN') return 'Admin Access';
                  if (roleStr === 'USER') return 'Standard User';
                  if (roleStr === 'VIEWER') return 'Read Only';
                  return 'Limited Access';
                })()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>


      <Divider />


      <MenuItem onClick={handleViewProfile}>
        <ProfileIcon sx={{ mr: 1, color: 'primary.main' }} />
        View Full Profile
      </MenuItem>

      {isSuperAdmin && (
        <MenuItem onClick={() => handleNavigation('/users')}>
          <PeopleIcon sx={{ mr: 1, color: 'secondary.main' }} />
          Manage Users
        </MenuItem>
      )}

      <Divider />

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
            ...getRoleStyles(user?.roleName || user?.role || user?.roleId),
            color: 'white',
            fontSize: '0.65rem',
            padding: '2px 6px'
          }}
        >
          {(user?.roleName || user?.role || user?.roleId || 'USER')?.toString().toUpperCase()}
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
              bgcolor: getRoleColor(user?.roleName),
              color: 'white'
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

        {/* Profile Dialog */}
        <Dialog
          open={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: 3
            }
          }}
        >
          <DialogTitle sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            py: 2.5,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1.5, fontSize: 28 }} />
              User Profile
            </Box>
            <Chip 
              label="Your Account" 
              color="secondary" 
              size="small" 
              sx={{ ml: 2 }}
            />
          </DialogTitle>

          <DialogContent sx={{ p: 0 }}>
            {/* Profile Header */}
            <Box sx={{ 
              p: 3, 
              bgcolor: 'primary.light', 
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 3
              }}>
                <Box sx={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '2.5rem',
                  fontWeight: 600
                }}>
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {user?.username}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    {user?.email || 'No email provided'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={user?.roleName || user?.role || 'USER'} 
                      color="primary" 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      label="Active" 
                      color="success" 
                      size="small" 
                    />
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Main Content */}
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* Personal Information */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ 
                        mb: 2, 
                        pb: 1, 
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <PersonIcon fontSize="small" />
                        Personal Information
                      </Typography>
                      
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '120px 1fr',
                        gap: '12px 8px',
                        '& > :nth-of-type(odd)': {
                          color: 'text.secondary',
                          fontWeight: 500
                        }
                      }}>
                        <Typography variant="body2">Username:</Typography>
                        <Typography variant="body2">{user?.username || 'N/A'}</Typography>

                        <Typography variant="body2">Email:</Typography>
                        <Typography variant="body2">
                          {user?.email || user?.emailId || 'No email provided'}
                        </Typography>

                        <Typography variant="body2">Account Status:</Typography>
                        <Box>
                          <Chip 
                            label="Active" 
                            size="small" 
                            color="success" 
                            sx={{ height: 24 }}
                          />
                        </Box>

                        <Typography variant="body2">Member Since:</Typography>
                        <Typography variant="body2">
                          {user?.createdAt 
                            ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Company & Role */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ 
                        mb: 2, 
                        pb: 1, 
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <BusinessIcon fontSize="small" />
                        Company & Role
                      </Typography>
                      
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '140px 1fr',
                        gap: '12px 8px',
                        '& > :nth-of-type(odd)': {
                          color: 'text.secondary',
                          fontWeight: 500
                        }
                      }}>
                        <Typography variant="body2">Role:</Typography>
                        <Box>
                          <Chip 
                            label={user?.roleName || user?.role || 'USER'} 
                            color="primary" 
                            size="small" 
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>

                        <Typography variant="body2">Department:</Typography>
                        <Box>
                          {user?.metadata?.department ? (
                            <Chip 
                              label={user.metadata.department}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="textSecondary">N/A</Typography>
                          )}
                        </Box>

                        <Typography variant="body2">Access Level:</Typography>
                        <Box>
                          {user?.metadata?.accessLevel ? (
                            <Chip 
                              label={user.metadata.accessLevel}
                              size="small"
                              color={user.metadata.accessLevel === 'Admin' ? 'primary' : 'default'}
                              variant="outlined"
                            />
                          ) : user?.roleName || user?.role ? (
                            <Chip 
                              label={user.roleName || user.role}
                              size="small"
                              color="default"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="textSecondary">Limited Access</Typography>
                          )}
                        </Box>

                        <Typography variant="body2">Company:</Typography>
                        <Box>
                          <Typography variant="body2">
                            {(() => {
                              if (user?.metadata?.department) {
                                const dept = user.metadata.department;
                                if (dept === 'STRIO') return 'STRIO KAIZEN HITECH RESEARCH LABS PVT LTD';
                                if (dept === 'SMR') return 'SMR ENERGY';
                                return dept;
                              }
                              if (user?.metadata?.companyId) {
                                const companyId = user.metadata.companyId;
                                if (companyId === '1') return 'STRIO KAIZEN HITECH RESEARCH LABS PVT LTD';
                                if (companyId === '5') return 'SMR ENERGY';
                                return `Company ID: ${companyId}`;
                              }
                              if (user?.metadata?.accessibleSites?.company?.L) {
                                const companies = user.metadata.accessibleSites.company.L;
                                if (companies.length > 0) {
                                  const companyId = companies[0].S;
                                  if (companyId === '1') return 'STRIO KAIZEN HITECH RESEARCH LABS PVT LTD';
                                  if (companyId === '5') return 'SMR ENERGY';
                                  return `Company ID: ${companyId}`;
                                }
                              }
                              return 'Not specified';
                            })()}
                          </Typography>
                        </Box>

                        <Typography variant="body2">Last Updated:</Typography>
                        <Typography variant="body2">
                          {user?.updatedAt 
                            ? new Date(user.updatedAt).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Activity & Metadata */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ 
                        mb: 2, 
                        pb: 1, 
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <HistoryIcon fontSize="small" />
                        Activity & Metadata
                      </Typography>
                      
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                        gap: 3
                      }}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Last Login
                          </Typography>
                          <Typography variant="body2">
                            {user?.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString()
                              : 'Never logged in'}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Department
                          </Typography>
                          <Typography variant="body2">
                            {user?.metadata?.department || 'N/A'}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Access Level
                          </Typography>
                          <Typography variant="body2">
                            {user?.metadata?.accessLevel || 'Standard'}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Account Created
                          </Typography>
                          <Typography variant="body2">
                            {user?.createdAt 
                              ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'N/A'}
                          </Typography>
                        </Box>
                      </Box>

                                          </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button 
              onClick={() => setIsProfileOpen(false)}
              variant="outlined"
              color="inherit"
              sx={{ textTransform: 'none' }}
            >
              Close
            </Button>
            {isSuperAdmin && (
            <Button 
              onClick={() => {
                setIsProfileOpen(false);
                navigate('/users');
              }}
              variant="contained"
              color="primary"
              sx={{ textTransform: 'none' }}
              startIcon={<EditIcon />}
            >
              Manage Users
            </Button>
          )}
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};


export default Navbar;
