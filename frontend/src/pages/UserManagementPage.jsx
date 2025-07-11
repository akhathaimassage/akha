import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import './Admin.css';
import { authFetch } from '../api/authFetch'; //

function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newUser, setNewUser] = useState({ username: '', password: '' });

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/api/users');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prevState => ({ ...prevState, [name]: value }));
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUser.username.trim() || !newUser.password.trim()) {
            alert('Please enter both username and password.');
            return;
        }
        try {
            const response = await authFetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            setNewUser({ username: '', password: '' });
            fetchUsers();
        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error("Failed to add user:", error);
        }
    };

    const handleDeleteUser = async (id, username) => {
        if (window.confirm(`Are you sure you want to delete user: ${username}?`)) {
            try {
                await authFetch(`/api/users/${id}`, { method: 'DELETE' });
                fetchUsers();
            } catch (error) {
                console.error("Failed to delete user:", error);
            }
        }
    };

    if (isLoading) {
        return <div className="admin-card"><h2>Loading Users...</h2></div>;
    }

    return (
        <div>
            <h1>User Management</h1>
            <div className="admin-card">
                <h3>Add New Admin User</h3>
                <form onSubmit={handleAddUser} className="admin-form">
                    <input
                        type="text"
                        name="username"
                        className="admin-form-input"
                        value={newUser.username}
                        onChange={handleInputChange}
                        placeholder="Username"
                    />
                    <input
                        type="password"
                        name="password"
                        className="admin-form-input"
                        value={newUser.password}
                        onChange={handleInputChange}
                        placeholder="Password"
                    />
                    <button type="submit" className="btn btn-add">Add User</button>
                </form>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>{dayjs(user.created_at).format('DD MMM YYYY, HH:mm')}</td>
                                <td className="actions">
                                    <button className="btn btn-delete" onClick={() => handleDeleteUser(user.id, user.username)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default UserManagementPage;