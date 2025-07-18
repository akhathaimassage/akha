import React, { useState, useEffect, useCallback } from 'react';
import './ServiceManagement.css';
import { authFetch } from '../api/authFetch';

function ServiceManagementPage() {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [formState, setFormState] = useState({
        id: null,
        name: '',
        duration_minutes: '',
        price: ''
    });

    const fetchServices = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/api/services/all');
            const data = await response.json();
            setServices(data);
        } catch (error) {
            console.error("Failed to fetch services:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormState(prevState => ({ ...prevState, [name]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const { id, name, duration_minutes, price } = formState;

        if (!name.trim() || !duration_minutes || !price) {
            alert('Please fill all fields.');
            return;
        }

        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';

        try {
            await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, duration_minutes, price }),
            });
            resetForm();
            fetchServices();
        } catch (error) {
            console.error("Failed to save service:", error);
        }
    };

    const handleEdit = (service) => {
        setFormState({
            id: service.id,
            name: service.name,
            duration_minutes: service.duration_minutes,
            price: service.price
        });
    };
    
    const resetForm = () => {
        setFormState({ id: null, name: '', duration_minutes: '', price: '' });
    };

    const handleToggleActive = async (service) => {
        try {
            await authFetch(`/api/services/${service.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !service.is_active }),
            });
            fetchServices();
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    const handleDelete = async (serviceId) => {
        if (window.confirm('Are you sure you want to permanently delete this service? This action cannot be undone.')) {
            try {
                const response = await authFetch(`/api/services/${serviceId}/permanent`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to delete service');
                }
                alert('Service deleted successfully.');
                fetchServices(); 
            } catch (error) {
                console.error('Delete error:', error);
                alert(`Error: ${error.message}`);
            }
        }
    };

    if (isLoading) {
        return <div className="management-container"><p>Loading...</p></div>;
    }

    return (
        <div className="management-container">
            <h1>Service Management</h1>

            <form onSubmit={handleFormSubmit} className="management-form">
                <h3>{formState.id ? 'Edit Service' : 'Add New Service'}</h3>
                <input type="text" name="name" value={formState.name} onChange={handleInputChange} placeholder="Service Name" required />
                <input type="number" name="duration_minutes" value={formState.duration_minutes} onChange={handleInputChange} placeholder="Duration (minutes)" required />
                <input type="number" step="0.01" name="price" value={formState.price} onChange={handleInputChange} placeholder="Price" required />
                <div className="form-buttons">
                    <button type="submit" className="btn btn-add">{formState.id ? 'Update Service' : 'Add Service'}</button>
                    {formState.id && <button type="button" onClick={resetForm} className="btn-cancel">Cancel</button>}
                </div>
            </form>

            <table className="management-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Duration</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {services.map(service => (
                        <tr key={service.id} className={!service.is_active ? 'deactivated' : ''}>
                            <td>{service.name}</td>
                            <td>{service.duration_minutes} min</td>
                            <td>{service.price} €</td>
                            <td>
                                <span className={`status-toggle ${service.is_active ? 'active' : ''}`} onClick={() => handleToggleActive(service)}>
                                    {service.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="actions">
                                <button className="btn btn-edit" onClick={() => handleEdit(service)}>Edit</button>
                                <button className="btn btn-delete" onClick={() => handleDelete(service.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default ServiceManagementPage;