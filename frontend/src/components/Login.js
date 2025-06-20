import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    InputAdornment,
    Alert,
    CircularProgress,
    IconButton,
} from '@mui/material';
import {
    Person as PersonIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import logo from "../assets/logo.jpg";
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Clear any stored credentials on component mount
    useEffect(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await login(formData.username, formData.password);
            if (success) {
                // Immediately navigate to dashboard or the page user tried to access before login
                const redirect = location.state?.from?.pathname || '/dashboard';
                navigate(redirect, { replace: true });
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Invalid credentials. Please try again.';
            setError(errorMessage);
            setFormData(prev => ({...prev, password: ''}));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ 
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            backgroundImage: 'linear-gradient(315deg, #f5f5f5 0%, #e0e0e0 74%)'
        }}>
            <Paper elevation={3} sx={{ 
                p: 4, 
                maxWidth: 400, 
                width: '90%',
                borderRadius: 2,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}>
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                    <img src={logo} alt="Logo" style={{ width: 120, height: 'auto' }} />
                    <Typography variant="h5" sx={{ mt: 2 }}>
                        Login
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleLogin} noValidate>
                    <TextField
                        fullWidth
                        label="Username"
                        margin="normal"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <PersonIcon />
                                </InputAdornment>
                            ),
                        }}
                        disabled={loading}
                        required
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        margin="normal"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockIcon />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword(!showPassword)}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                        required
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ 
                            mt: 3,
                            bgcolor: 'primary.main',
                            '&:hover': {
                                bgcolor: 'primary.dark',
                            }
                        }}
                        disabled={loading || !formData.username || !formData.password}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Login'}
                    </Button>
                </form>
            </Paper>
        </Box>
    );
};

export default Login;