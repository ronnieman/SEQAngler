import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/Config';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  favorite_spots: string[];
}

interface Subscription {
  is_subscribed: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  days_remaining: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  subscription: Subscription | null;
  login: (email: string, password: string) => Promise<any>;
  register: (name: string, email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        await fetchUserProfile(storedToken);
        await fetchSubscription(storedToken);
      }
    } catch (error) {
      console.log('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setUser(response.data);
      await AsyncStorage.setItem('auth_user', JSON.stringify(response.data));
    } catch (error: any) {
      if (error.response?.status === 401) {
        await logout();
      }
    }
  };

  const fetchSubscription = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_URL}/subscription/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSubscription(response.data);
    } catch (error) {
      console.log('Error fetching subscription:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });
    
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    
    await AsyncStorage.setItem('auth_token', access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    
    await fetchSubscription(access_token);
    
    return response.data;
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      name,
      email,
      password,
    });
    
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    
    await AsyncStorage.setItem('auth_token', access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    
    await fetchSubscription(access_token);
    
    return response.data;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setSubscription(null);
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  };

  const isAuthenticated = !!token;
  const isSubscribed = subscription?.is_subscribed || false;
  const isTrial = subscription?.is_trial || false;
  const trialDaysRemaining = subscription?.days_remaining || 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isSubscribed,
        isTrial,
        trialDaysRemaining,
        subscription,
        login,
        register,
        logout,
        refreshSubscription: () => fetchSubscription(token || ''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
