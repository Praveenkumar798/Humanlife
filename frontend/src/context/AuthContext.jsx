import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on application load
  const checkSession = async () => {
    try {
      const currentUser = await api.auth.getMe();
      setUser(currentUser);
    } catch (err) {
      // 401 means not logged in - normal on first load
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (emailOrUsername, password) => {
    const loggedInUser = await api.auth.login({
      email_or_username: emailOrUsername,
      password: password,
    });
    setUser(loggedInUser);
    return loggedInUser;
  };

  const loginWithGoogle = async (credential) => {
    const loggedInUser = await api.auth.googleLogin(credential);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (email, username, password, fullName) => {
    const newUser = await api.auth.register({
      email,
      username,
      password,
      full_name: fullName,
    });
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

