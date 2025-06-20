import React, { useState } from 'react';

const SiteCreationForm = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        location: '',
        capacity: '',
    });

    const [validation, setValidation] = useState({
        name: true,
        capacity: true
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear validation error when user starts typing
        if (!validation[name]) {
            setValidation(prev => ({
                ...prev,
                [name]: true
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate form
        const newValidation = {
            name: Boolean(formData.name.trim()),
            capacity: !formData.capacity || /^\d+$/.test(formData.capacity)
        };
        
        setValidation(newValidation);

        if (Object.values(newValidation).every(Boolean)) {
            onSubmit({
                ...formData,
                capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="site-creation-form">
            <div className="form-group">
                <label htmlFor="name">Site Name *</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={!validation.name ? 'error' : ''}
                />
                {!validation.name && (
                    <span className="error-message">Site name is required</span>
                )}
            </div>

            <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                />
            </div>

            <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                />
            </div>

            <div className="form-group">
                <label htmlFor="capacity">Capacity (kW)</label>
                <input
                    type="text"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    className={!validation.capacity ? 'error' : ''}
                />
                {!validation.capacity && (
                    <span className="error-message">Capacity must be a number</span>
                )}
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="cancel-button">
                    Cancel
                </button>
                <button type="submit" className="submit-button">
                    Create Site
                </button>
            </div>
        </form>
    );
};

export default SiteCreationForm;
