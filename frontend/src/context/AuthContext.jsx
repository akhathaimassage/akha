import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const existingToken = localStorage.getItem('token');
        if (existingToken) {
            try {
                const decodedUser = jwtDecode(existingToken);
                setCurrentUser(decodedUser);
            } catch (error) {
                localStorage.removeItem('token');
            }
        }
    }, []);

    const login = (newToken) => {
        try {
            const decodedUser = jwtDecode(newToken);
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setCurrentUser(decodedUser);
        } catch (error) {
            console.error("Failed to decode token on login", error);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setCurrentUser(null);
    };

    const authValue = { token, currentUser, login, logout };

    return (
        <AuthContext.Provider value={authValue}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};