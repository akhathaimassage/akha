import React, { useState, useEffect, useCallback } from 'react';
import './ServiceManagement.css';
import { authFetch } from '../api/authFetch';

function ServiceManagementPage() {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for the main Add/Edit form
    const [formState, setFormState] = useState({
        id: null,
        name: '',
        duration_minutes: '',
        price: '',
        discounted_price: ''
    });

    // State for the new Bulk Edit feature
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkDiscountPrice, setBulkDiscountPrice] = useState('');

    // Fetch all services from the backend
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

    // Handles input changes for the main Add/Edit form
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormState(prevState => ({ ...prevState, [name]: value }));
    };

    // Submits the Add/Edit form for a single service
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const { id, name, duration_minutes, price, discounted_price } = formState;

        if (!name.trim() || !duration_minutes || !price) {
            alert('Please fill all fields.');
            return;
        }

        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';
        const bodyPayload = { name, duration_minutes, price, discounted_price: discounted_price || null };

        try {
            await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            resetForm();
            fetchServices();
        } catch (error) {
            console.error("Failed to save service:", error);
        }
    };

    // Populates the form when the 'Edit' button is clicked
    const handleEdit = (service) => {
        setFormState({
            id: service.id,
            name: service.name,
            duration_minutes: service.duration_minutes,
            price: parseFloat(service.price),
            discounted_price: service.discounted_price ? parseFloat(service.discounted_price) : ''
        });
    };
    
    // Resets the Add/Edit form
    const resetForm = () => {
        setFormState({ id: null, name: '', duration_minutes: '', price: '', discounted_price: '' });
    };

    // Toggles the 'Active'/'Inactive' status of a service
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

    // Permanently deletes a service
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

    // --- Bulk Edit Feature Functions ---

    // Handles ticking/unticking a single row checkbox
    const handleSelectRow = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) 
                ? prev.filter(serviceId => serviceId !== id) 
                : [...prev, id]
        );
    };

    // Handles ticking/unticking the "select all" checkbox in the header
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(services.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    // Submits the Bulk Edit form
    const handleBulkUpdate = async (e) => {
        e.preventDefault();
        if (selectedIds.length === 0) {
            alert('Please select at least one service.');
            return;
        }

        try {
            await authFetch('/api/services/bulk-update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, discounted_price: bulkDiscountPrice })
            });
            alert('Bulk update successful!');
            setSelectedIds([]);
            setBulkDiscountPrice('');
            fetchServices();
        } catch (error) {
            console.error("Failed to bulk update services:", error);
            alert('Bulk update failed.');
        }
    };

    if (isLoading) {
        return <div className="management-container"><p>Loading...</p></div>;
    }

    return (
        <div className="management-container">
            <h1>Service Management</h1>

            {/* --- Main Add/Edit Form --- */}
            <form onSubmit={handleFormSubmit} className="management-form">
                <h3>{formState.id ? 'Edit Service' : 'Add New Service'}</h3>
                <input type="text" name="name" value={formState.name} onChange={handleInputChange} placeholder="Service Name" required />
                <input type="number" name="duration_minutes" value={formState.duration_minutes} onChange={handleInputChange} placeholder="Duration (minutes)" required />
                <input type="number" step="0.01" name="price" value={formState.price} onChange={handleInputChange} placeholder="Price" required />
                <input 
                    type="number" 
                    step="0.01" 
                    name="discounted_price" 
                    value={formState.discounted_price} 
                    onChange={handleInputChange} 
                    placeholder="Discounted Price (optional)" 
                />
                <div className="form-buttons">
                    <button type="submit" className="btn btn-add">{formState.id ? 'Update Service' : 'Add Service'}</button>
                    {formState.id && <button type="button" onClick={resetForm} className="btn-cancel">Cancel</button>}
                </div>
            </form>

            {/* --- Bulk Action Form (appears when items are selected) --- */}
            {selectedIds.length > 0 && (
                <form onSubmit={handleBulkUpdate} className="management-form bulk-action-form">
                    <h3>Bulk Edit ({selectedIds.length} items selected)</h3>
                    <input 
                        type="number"
                        step="0.01"
                        value={bulkDiscountPrice}
                        onChange={(e) => setBulkDiscountPrice(e.target.value)}
                        placeholder="Set new discounted price for all selected (leave blank to remove)"
                    />
                    <div className="form-buttons">
                       <button type="submit" className="btn btn-add">Apply to Selected</button>
                    </div>
                </form>
            )}

            {/* --- Services Table --- */}
            <table className="management-table">
                <thead>
                    <tr>
                        <th>
                            <input 
                                type="checkbox" 
                                onChange={handleSelectAll} 
                                checked={services.length > 0 && selectedIds.length === services.length}
                                disabled={services.length === 0}
                            />
                        </th>
                        <th>Name</th>
                        <th>Duration</th>
                        <th>Price</th>
                        <th>Discount Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {services.map(service => (
                        <tr key={service.id} className={!service.is_active ? 'deactivated' : ''}>
                            <td>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.includes(service.id)} 
                                    onChange={() => handleSelectRow(service.id)} 
                                />
                            </td>
                            <td>{service.name}</td>
                            <td>{service.duration_minutes} min</td>
                            <td>{parseInt(service.price)} €</td>
                            <td>{service.discounted_price ? `${parseInt(service.discounted_price)} €` : '—'}</td>
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