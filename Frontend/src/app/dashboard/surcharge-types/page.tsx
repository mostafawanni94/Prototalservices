'use client';

import { useState, useEffect } from 'react';
import {
    Clock,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    Sun,
    Moon,
    Star,
    Calendar,
    Hourglass
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { DashboardLayout } from '@/components/layout/dashboard';

// Types
interface SurchargeType {
    id: number;
    name: string;
    category: string;
    description: string;
    time_from: string | null;
    time_to: string | null;
    days_of_week: number[];
    specific_dates: string[];
    min_hours_threshold: number | null;
    is_active: boolean;
    sort_order: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CATEGORIES = [
    { value: 'weekend', label: 'Weekend', icon: Sun, color: '#F59E0B' },
    { value: 'night_shift', label: 'Night Shift', icon: Moon, color: '#3B82F6' },
    { value: 'holiday', label: 'Public Holiday', icon: Star, color: '#10B981' },
    { value: 'overtime', label: 'Overtime (Overwerk)', icon: Hourglass, color: '#EF4444' },
    { value: 'custom', label: 'Custom', icon: Calendar, color: '#8B5CF6' },
];

// Netherlands Public Holidays (fixed dates, format MM-DD)
const NL_PUBLIC_HOLIDAYS = [
    { date: '01-01', name: "New Year's Day (Nieuwjaarsdag)" },
    { date: '04-27', name: "King's Day (Koningsdag)" },
    { date: '05-05', name: 'Liberation Day (Bevrijdingsdag)' },
    { date: '12-25', name: 'Christmas Day (Eerste Kerstdag)' },
    { date: '12-26', name: 'Second Christmas Day (Tweede Kerstdag)' },
    // Variable holidays (average dates for reference)
    { date: '04-18', name: 'Good Friday (Goede Vrijdag)' },
    { date: '04-20', name: 'Easter Sunday (Eerste Paasdag)' },
    { date: '04-21', name: 'Easter Monday (Tweede Paasdag)' },
    { date: '05-29', name: 'Ascension Day (Hemelvaartsdag)' },
    { date: '06-08', name: 'Whit Sunday (Eerste Pinksterdag)' },
    { date: '06-09', name: 'Whit Monday (Tweede Pinksterdag)' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function SurchargeTypesPage() {
    const { t } = useLanguage();
    const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<SurchargeType | null>(null);
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [showCustomDateForm, setShowCustomDateForm] = useState(false);
    const [customDateMonth, setCustomDateMonth] = useState('01');
    const [customDateDay, setCustomDateDay] = useState('01');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'custom',
        description: '',
        time_from: '',
        time_to: '',
        days_of_week: [] as number[],
        specific_dates: [] as string[],
        min_hours_threshold: '' as string | number,
        is_active: true,
        sort_order: 0,
        weekend_start_day: 4 as number, // Friday
        weekend_end_day: 0 as number,   // Monday
    });

    // Load surcharge types from API
    useEffect(() => {
        fetchSurchargeTypes();
    }, []);

    const fetchSurchargeTypes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_URL}/employees/surcharge-types/`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                const types = Array.isArray(data) ? data : (data.results || []);
                setSurchargeTypes(types);
            } else {
                setSurchargeTypes([]);
            }
        } catch (error) {
            console.error('Error fetching surcharge types:', error);
            setSurchargeTypes([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter surcharge types
    const typesList = Array.isArray(surchargeTypes) ? surchargeTypes : [];
    const filteredTypes = typesList.filter(type => {
        const matchesSearch = type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            type.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterActive === 'all' ||
            (filterActive === 'active' && type.is_active) ||
            (filterActive === 'inactive' && !type.is_active);
        return matchesSearch && matchesFilter;
    });

    // Stats
    const stats = {
        total: typesList.length,
        active: typesList.filter(c => c.is_active).length,
        weekend: typesList.filter(c => c.category === 'weekend').length,
        nightShift: typesList.filter(c => c.category === 'night_shift').length,
    };

    // Get category info
    const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[3];

    // Open modal for add/edit
    const openModal = (type?: SurchargeType) => {
        if (type) {
            // For weekend types, extract start/end day from days_of_week
            let weekendStartDay = 4; // Friday default
            let weekendEndDay = 0;   // Monday default
            if (type.category === 'weekend' && type.days_of_week?.length > 0) {
                // The start day is the day before the first weekend day (e.g., Sat=5 → start=Fri=4)
                const sortedDays = [...type.days_of_week].sort((a, b) => a - b);
                weekendStartDay = sortedDays[0] > 0 ? sortedDays[0] - 1 : 6;
                // The end day is the day after the last weekend day (e.g., Sun=6 → end=Mon=0)
                weekendEndDay = sortedDays[sortedDays.length - 1] < 6 ? sortedDays[sortedDays.length - 1] + 1 : 0;
            }
            setEditingType(type);
            setFormData({
                name: type.name,
                category: type.category,
                description: type.description || '',
                time_from: type.time_from || '',
                time_to: type.time_to || '',
                days_of_week: type.days_of_week || [],
                specific_dates: type.specific_dates || [],
                min_hours_threshold: type.min_hours_threshold || '',
                is_active: type.is_active,
                sort_order: type.sort_order,
                weekend_start_day: weekendStartDay,
                weekend_end_day: weekendEndDay,
            });
        } else {
            setEditingType(null);
            setFormData({
                name: '',
                category: 'custom',
                description: '',
                time_from: '',
                time_to: '',
                days_of_week: [],
                specific_dates: [],
                min_hours_threshold: '',
                is_active: true,
                sort_order: typesList.length + 1,
                weekend_start_day: 4,
                weekend_end_day: 0,
            });
        }
        setIsModalOpen(true);
    };

    // Helper: compute days_of_week from weekend start/end day
    const getWeekendDays = (startDay: number, endDay: number): number[] => {
        // Generate the days between start and end (the actual weekend days)
        // Start day is e.g. Friday (4), meaning the weekend surcharge starts on Friday evening
        // The full weekend days are after startDay and before endDay
        const days: number[] = [];
        let current = (startDay + 1) % 7;
        while (current !== endDay) {
            days.push(current);
            current = (current + 1) % 7;
        }
        return days;
    };

    // Save surcharge type
    const saveSurchargeType = async () => {
        try {
            const url = editingType
                ? `${API_URL}/employees/surcharge-types/${editingType.id}/`
                : `${API_URL}/employees/surcharge-types/`;
            const method = editingType ? 'PUT' : 'POST';

            // Build payload — convert weekend fields to model fields
            let daysOfWeek = formData.days_of_week;
            if (formData.category === 'weekend') {
                daysOfWeek = getWeekendDays(formData.weekend_start_day, formData.weekend_end_day);
            }

            const payload = {
                name: formData.name,
                category: formData.category,
                description: formData.description,
                time_from: formData.time_from || null,
                time_to: formData.time_to || null,
                days_of_week: daysOfWeek,
                // Only holiday and custom categories use specific_dates
                specific_dates: (formData.category === 'holiday' || formData.category === 'custom') ? formData.specific_dates : [],
                min_hours_threshold: formData.min_hours_threshold ? parseFloat(String(formData.min_hours_threshold)) : null,
                is_active: formData.is_active,
                sort_order: formData.sort_order,
            };

            console.log('Saving surcharge type:', { url, method, payload });

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            console.log('Response:', response.status, data);

            if (response.ok) {
                fetchSurchargeTypes();
                setIsModalOpen(false);
            } else {
                const errorMsg = typeof data === 'object' ? JSON.stringify(data) : data.detail || 'Failed to save';
                alert(errorMsg);
            }
        } catch (error) {
            console.error('Error saving surcharge type:', error);
            alert('Failed to save');
        }
    };

    // Delete surcharge type
    const deleteSurchargeType = async (id: number) => {
        if (!confirm('Are you sure you want to delete this surcharge type?')) return;

        try {
            const response = await fetch(`${API_URL}/employees/surcharge-types/${id}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });

            if (response.ok) {
                fetchSurchargeTypes();
            }
        } catch (error) {
            console.error('Error deleting surcharge type:', error);
        }
    };

    // Toggle active status
    const toggleActive = async (type: SurchargeType) => {
        try {
            const response = await fetch(`${API_URL}/employees/surcharge-types/${type.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({ is_active: !type.is_active }),
            });

            if (response.ok) {
                fetchSurchargeTypes();
            }
        } catch (error) {
            console.error('Error toggling active status:', error);
        }
    };

    // Toggle day in form
    const toggleDay = (day: number) => {
        setFormData(f => ({
            ...f,
            days_of_week: f.days_of_week.includes(day)
                ? f.days_of_week.filter(d => d !== day)
                : [...f.days_of_week, day]
        }));
    };

    // Add specific date
    const addSpecificDate = () => {
        const date = `${customDateMonth}-${customDateDay}`;
        if (!formData.specific_dates.includes(date)) {
            setFormData(f => ({ ...f, specific_dates: [...f.specific_dates, date] }));
        }
        setShowCustomDateForm(false);
        setCustomDateMonth('01');
        setCustomDateDay('01');
    };

    // Remove specific date
    const removeSpecificDate = (date: string) => {
        setFormData(f => ({ ...f, specific_dates: f.specific_dates.filter(d => d !== date) }));
    };

    return (
        <DashboardLayout>
            <div style={{ padding: '0 0 32px 0' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '32px',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#1F2937',
                            margin: 0,
                        }}>
                            Day Payment Types
                        </h1>
                        <p style={{
                            fontSize: '15px',
                            color: '#6B7280',
                            marginTop: '6px',
                        }}>
                            Manage surcharge types for weekends, nights, and holidays
                        </p>
                    </div>

                    <button
                        onClick={() => openModal()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            backgroundColor: '#8B5CF6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={18} />
                        Add Surcharge Type
                    </button>
                </div>

                {/* Stats Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '20px',
                    marginBottom: '32px',
                }}>
                    <StatCard label="Total Types" value={stats.total} icon={Clock} color="#8B5CF6" />
                    <StatCard label="Active" value={stats.active} icon={CheckCircle} color="#10B981" />
                    <StatCard label="Weekend" value={stats.weekend} icon={Sun} color="#F59E0B" />
                    <StatCard label="Night Shift" value={stats.nightShift} icon={Moon} color="#3B82F6" />
                </div>

                {/* Search & Filters */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '24px',
                }}>
                    {/* Search */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9CA3AF',
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search surcharge types..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 44px',
                                fontSize: '14px',
                                backgroundColor: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px',
                                outline: 'none',
                            }}
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        backgroundColor: '#F3F4F6',
                        padding: '4px',
                        borderRadius: '10px',
                    }}>
                        {(['all', 'active', 'inactive'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setFilterActive(filter)}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: filterActive === filter ? 'white' : '#6B7280',
                                    backgroundColor: filterActive === filter ? '#8B5CF6' : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 120px 1.5fr 1fr 100px 80px',
                        gap: '16px',
                        padding: '16px 20px',
                        backgroundColor: '#F9FAFB',
                        borderBottom: '1px solid #E5E7EB',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        <div>Surcharge Type</div>
                        <div>Category</div>
                        <div>Days / Time</div>
                        <div>Specific Dates</div>
                        <div style={{ textAlign: 'center' }}>Status</div>
                        <div style={{ textAlign: 'center' }}>Actions</div>
                    </div>

                    {/* Table Body */}
                    {isLoading ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                            Loading...
                        </div>
                    ) : filteredTypes.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                            <Clock size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <p style={{ fontSize: '16px', fontWeight: 500 }}>No surcharge types found</p>
                            <p style={{ fontSize: '14px', marginTop: '4px' }}>
                                {searchQuery ? 'Try a different search term' : 'Click "Add Surcharge Type" to create one'}
                            </p>
                        </div>
                    ) : (
                        filteredTypes.map((type, index) => {
                            const cat = getCategoryInfo(type.category);
                            const CatIcon = cat.icon;
                            return (
                                <div
                                    key={type.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 120px 1.5fr 1fr 100px 80px',
                                        gap: '16px',
                                        padding: '16px 20px',
                                        alignItems: 'center',
                                        borderBottom: index < filteredTypes.length - 1 ? '1px solid #F3F4F6' : 'none',
                                        backgroundColor: type.is_active ? 'white' : '#FAFAFA',
                                    }}
                                >
                                    {/* Name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            backgroundColor: type.is_active ? `${cat.color}15` : '#F3F4F6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <CatIcon size={20} color={type.is_active ? cat.color : '#9CA3AF'} />
                                        </div>
                                        <div>
                                            <p style={{
                                                fontWeight: 600,
                                                color: type.is_active ? '#1F2937' : '#9CA3AF',
                                                fontSize: '14px',
                                            }}>
                                                {type.name}
                                            </p>
                                            {type.description && (
                                                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                                                    {type.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category */}
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        color: cat.color,
                                        backgroundColor: `${cat.color}15`,
                                        borderRadius: '6px',
                                    }}>
                                        <CatIcon size={12} />
                                        {cat.label}
                                    </span>

                                    {/* Days / Time */}
                                    <div style={{ fontSize: '13px', color: '#6B7280' }}>
                                        {type.days_of_week?.length > 0 && (
                                            <div>{type.days_of_week.map(d => DAYS[d]).join(', ')}</div>
                                        )}
                                        {type.time_from && type.time_to && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <Clock size={12} />
                                                {type.time_from} - {type.time_to}
                                            </div>
                                        )}
                                        {!type.days_of_week?.length && !type.time_from && '-'}
                                    </div>

                                    {/* Specific Dates */}
                                    <div style={{ fontSize: '13px', color: '#6B7280' }}>
                                        {type.specific_dates?.length > 0 ? type.specific_dates.join(', ') : '-'}
                                    </div>

                                    {/* Status */}
                                    <div style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleActive(type)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: type.is_active ? '#059669' : '#6B7280',
                                                backgroundColor: type.is_active ? '#D1FAE5' : '#F3F4F6',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {type.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            {type.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                    }}>
                                        <button
                                            onClick={() => openModal(type)}
                                            style={{
                                                padding: '8px',
                                                color: '#6B7280',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                            title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteSurchargeType(type.id)}
                                            style={{
                                                padding: '8px',
                                                color: '#EF4444',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal */}
                {isModalOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                        }}
                        onClick={() => setIsModalOpen(false)}
                    >
                        <div
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '20px',
                                width: '100%',
                                maxWidth: '640px',
                                maxHeight: '90vh',
                                overflow: 'auto',
                                boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '24px 24px 0',
                                borderBottom: '1px solid #F3F4F6',
                                paddingBottom: '20px',
                            }}>
                                <h2 style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: '#1F2937',
                                    margin: 0,
                                }}>
                                    {editingType ? 'Edit Surcharge Type' : 'Add Surcharge Type'}
                                </h2>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#6B7280',
                                    marginTop: '4px',
                                }}>
                                    {editingType
                                        ? 'Update the surcharge type details'
                                        : 'Create a new day payment type (weekend, night, holiday)'}
                                </p>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '24px' }}>
                                {/* Name */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Weekend, Night Shift"
                                        style={inputStyle}
                                    />
                                </div>

                                {/* Category Cards */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={labelStyle}>Category</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                                        {CATEGORIES.map(cat => {
                                            const CatIcon = cat.icon;
                                            const isSelected = formData.category === cat.value;
                                            return (
                                                <button
                                                    key={cat.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, category: cat.value })}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '14px 8px',
                                                        borderRadius: '12px',
                                                        border: isSelected ? `2px solid ${cat.color}` : '2px solid #E5E7EB',
                                                        backgroundColor: isSelected ? `${cat.color}12` : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    <CatIcon size={22} color={isSelected ? cat.color : '#9CA3AF'} />
                                                    <span style={{
                                                        fontSize: '12px',
                                                        fontWeight: isSelected ? 600 : 500,
                                                        color: isSelected ? cat.color : '#6B7280',
                                                    }}>
                                                        {cat.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Description */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe this surcharge type..."
                                        rows={2}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </div>

                                {/* ===== WEEKEND CONFIGURATION ===== */}
                                {formData.category === 'weekend' && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#FFFBEB',
                                        borderRadius: '14px',
                                        border: '1px solid #FDE68A',
                                        marginBottom: '20px',
                                    }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#92400E', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Sun size={18} color="#F59E0B" /> Weekend Window
                                        </h3>

                                        {/* Starts */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#92400E' }}>Starts</span>
                                            <select
                                                value={formData.weekend_start_day}
                                                onChange={(e) => setFormData({ ...formData, weekend_start_day: parseInt(e.target.value) })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            >
                                                {DAYS.map((day, i) => (
                                                    <option key={i} value={i}>{day}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="time"
                                                value={formData.time_from}
                                                onChange={(e) => setFormData({ ...formData, time_from: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                        </div>

                                        {/* Ends */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#92400E' }}>Ends</span>
                                            <select
                                                value={formData.weekend_end_day}
                                                onChange={(e) => setFormData({ ...formData, weekend_end_day: parseInt(e.target.value) })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            >
                                                {DAYS.map((day, i) => (
                                                    <option key={i} value={i}>{day}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="time"
                                                value={formData.time_to}
                                                onChange={(e) => setFormData({ ...formData, time_to: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                        </div>

                                        {/* Visual Timeline */}
                                        <div style={{ padding: '12px 0' }}>
                                            <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #FDE68A' }}>
                                                {DAYS.map((day, i) => {
                                                    const startDay = formData.weekend_start_day;
                                                    const endDay = formData.weekend_end_day;
                                                    // Calculate which days are "in" the weekend
                                                    let isInWeekend = false;
                                                    if (startDay < endDay) {
                                                        isInWeekend = i > startDay && i < endDay;
                                                    } else {
                                                        isInWeekend = i > startDay || i < endDay;
                                                    }
                                                    const isPartialStart = i === startDay;
                                                    const isPartialEnd = i === endDay;
                                                    return (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                flex: 1,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                color: isInWeekend ? 'white' : isPartialStart || isPartialEnd ? '#92400E' : '#9CA3AF',
                                                                background: isInWeekend ? '#F59E0B' : isPartialStart ? 'linear-gradient(90deg, #FEF3C7 50%, #F59E0B 50%)' : isPartialEnd ? 'linear-gradient(90deg, #F59E0B 50%, #FEF3C7 50%)' : '#FEF3C7',
                                                                borderRight: i < 6 ? '1px solid #FDE68A' : 'none',
                                                            }}
                                                        >
                                                            {day}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                                <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 500 }}>
                                                    {DAYS[formData.weekend_start_day]} {formData.time_from || '--:--'}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 500 }}>
                                                    {DAYS[formData.weekend_end_day]} {formData.time_to || '--:--'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '10px 12px', backgroundColor: '#FEF3C7', borderRadius: '8px' }}>
                                            <Clock size={14} color="#92400E" />
                                            <span style={{ fontSize: '12px', color: '#92400E' }}>
                                                All hours between {DAYS[formData.weekend_start_day]} {formData.time_from || '--:--'} and {DAYS[formData.weekend_end_day]} {formData.time_to || '--:--'} will receive weekend surcharge
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* ===== NIGHT SHIFT CONFIGURATION ===== */}
                                {formData.category === 'night_shift' && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#EFF6FF',
                                        borderRadius: '14px',
                                        border: '1px solid #BFDBFE',
                                        marginBottom: '20px',
                                    }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1E40AF', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Moon size={18} color="#3B82F6" /> Night Shift Configuration
                                        </h3>

                                        {/* Time Window */}
                                        <label style={{ ...labelStyle, color: '#1E40AF' }}>Time Window</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                                            <input
                                                type="time"
                                                value={formData.time_from}
                                                onChange={(e) => setFormData({ ...formData, time_from: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                            <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: 500 }}>→</span>
                                            <input
                                                type="time"
                                                value={formData.time_to}
                                                onChange={(e) => setFormData({ ...formData, time_to: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                        </div>

                                        {/* Active Days */}
                                        <label style={{ ...labelStyle, color: '#1E40AF' }}>Active Days</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {DAYS.map((day, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => toggleDay(i)}
                                                    style={{
                                                        padding: '8px 14px',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: formData.days_of_week.includes(i) ? 'white' : '#6B7280',
                                                        backgroundColor: formData.days_of_week.includes(i) ? '#3B82F6' : 'white',
                                                        border: formData.days_of_week.includes(i) ? '1px solid #3B82F6' : '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: '12px', color: '#3B82F6', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Clock size={12} /> Night shift applies on selected days only (exclude weekend days if separate)
                                        </p>
                                    </div>
                                )}

                                {/* ===== HOLIDAY CONFIGURATION ===== */}
                                {formData.category === 'holiday' && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#ECFDF5',
                                        borderRadius: '14px',
                                        border: '1px solid #A7F3D0',
                                        marginBottom: '20px',
                                    }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#065F46', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Star size={18} color="#10B981" /> Holiday Configuration
                                        </h3>

                                        {/* Time Window (optional) */}
                                        <label style={{ ...labelStyle, color: '#065F46' }}>Time Window <span style={{ fontWeight: 400, fontSize: '12px' }}>(leave empty for all day)</span></label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                                            <input
                                                type="time"
                                                value={formData.time_from}
                                                onChange={(e) => setFormData({ ...formData, time_from: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                            <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: 500 }}>→</span>
                                            <input
                                                type="time"
                                                value={formData.time_to}
                                                onChange={(e) => setFormData({ ...formData, time_to: e.target.value })}
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                        </div>

                                        {/* Holiday Dates */}
                                        <label style={{ ...labelStyle, color: '#065F46' }}>Holiday Dates</label>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allDates = NL_PUBLIC_HOLIDAYS.map(h => h.date);
                                                    setFormData(f => ({ ...f, specific_dates: allDates }));
                                                }}
                                                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, color: '#10B981', backgroundColor: '#D1FAE5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(f => ({ ...f, specific_dates: [] }))}
                                                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                                            maxHeight: '200px', overflowY: 'auto', padding: '12px',
                                            backgroundColor: 'white', borderRadius: '10px', border: '1px solid #A7F3D0',
                                        }}>
                                            {NL_PUBLIC_HOLIDAYS.map(holiday => (
                                                <label
                                                    key={holiday.date}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                                        padding: '6px 8px', borderRadius: '6px',
                                                        backgroundColor: formData.specific_dates.includes(holiday.date) ? '#D1FAE5' : 'transparent',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.specific_dates.includes(holiday.date)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData(f => ({ ...f, specific_dates: [...f.specific_dates, holiday.date] }));
                                                            } else {
                                                                setFormData(f => ({ ...f, specific_dates: f.specific_dates.filter(d => d !== holiday.date) }));
                                                            }
                                                        }}
                                                        style={{ width: '16px', height: '16px' }}
                                                    />
                                                    <span style={{ fontSize: '12px', color: '#374151' }}>
                                                        <strong>{holiday.date}</strong> — {holiday.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Custom Date Adding */}
                                        <div style={{ marginTop: '12px' }}>
                                            {!showCustomDateForm ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCustomDateForm(true)}
                                                    style={{ fontSize: '13px', color: '#10B981', background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    + Add Custom Date
                                                </button>
                                            ) : (
                                                <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                                        <div>
                                                            <label style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>Month</label>
                                                            <select value={customDateMonth} onChange={(e) => setCustomDateMonth(e.target.value)} style={{ display: 'block', padding: '8px', fontSize: '13px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                                                                {['01-Jan', '02-Feb', '03-Mar', '04-Apr', '05-May', '06-Jun', '07-Jul', '08-Aug', '09-Sep', '10-Oct', '11-Nov', '12-Dec'].map(m => (
                                                                    <option key={m.split('-')[0]} value={m.split('-')[0]}>{m}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>Day</label>
                                                            <select value={customDateDay} onChange={(e) => setCustomDateDay(e.target.value)} style={{ display: 'block', padding: '8px', fontSize: '13px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                                                                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                                                                    <option key={d} value={d}>{d}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <button type="button" onClick={addSpecificDate} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, color: 'white', backgroundColor: '#10B981', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Add</button>
                                                        <button type="button" onClick={() => setShowCustomDateForm(false)} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                                    </div>
                                                </div>
                                            )}
                                            {formData.specific_dates.filter(d => !NL_PUBLIC_HOLIDAYS.some(h => h.date === d)).length > 0 && (
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                    {formData.specific_dates.filter(d => !NL_PUBLIC_HOLIDAYS.some(h => h.date === d)).map(date => (
                                                        <span key={date} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 500, color: '#10B981', backgroundColor: '#D1FAE5', borderRadius: '6px' }}>
                                                            {date}
                                                            <button onClick={() => removeSpecificDate(date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', padding: 0, fontSize: '14px' }}>×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ===== OVERTIME CONFIGURATION ===== */}
                                {formData.category === 'overtime' && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#FEF2F2',
                                        borderRadius: '14px',
                                        border: '1px solid #FECACA',
                                        marginBottom: '20px',
                                    }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#991B1B', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Hourglass size={18} color="#EF4444" /> Overtime Configuration
                                        </h3>

                                        <label style={{ ...labelStyle, color: '#991B1B' }}>Minimum Hours Threshold</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={formData.min_hours_threshold}
                                                onChange={(e) => setFormData({ ...formData, min_hours_threshold: e.target.value })}
                                                placeholder="e.g. 9"
                                                style={{ ...inputStyle, width: '120px', backgroundColor: 'white' }}
                                            />
                                            <span style={{ color: '#991B1B', fontSize: '13px' }}>hours per day</span>
                                        </div>
                                        <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: '6px' }}>
                                            Example: If set to 9, an employee working 10 hours gets 1 hour of overtime surcharge.
                                        </p>

                                        {/* Active Days */}
                                        <label style={{ ...labelStyle, color: '#991B1B', marginTop: '16px' }}>Active Days</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {DAYS.map((day, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => toggleDay(i)}
                                                    style={{
                                                        padding: '8px 14px',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: formData.days_of_week.includes(i) ? 'white' : '#6B7280',
                                                        backgroundColor: formData.days_of_week.includes(i) ? '#EF4444' : 'white',
                                                        border: formData.days_of_week.includes(i) ? '1px solid #EF4444' : '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ===== CUSTOM CONFIGURATION (all fields) ===== */}
                                {formData.category === 'custom' && (
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#F5F3FF',
                                        borderRadius: '14px',
                                        border: '1px solid #DDD6FE',
                                        marginBottom: '20px',
                                    }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#5B21B6', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={18} color="#8B5CF6" /> Custom Configuration
                                        </h3>

                                        {/* Time */}
                                        <label style={{ ...labelStyle, color: '#5B21B6' }}>Time Window</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                                            <input type="time" value={formData.time_from} onChange={(e) => setFormData({ ...formData, time_from: e.target.value })} style={{ ...inputStyle, backgroundColor: 'white' }} />
                                            <span style={{ fontSize: '16px', color: '#6B7280' }}>→</span>
                                            <input type="time" value={formData.time_to} onChange={(e) => setFormData({ ...formData, time_to: e.target.value })} style={{ ...inputStyle, backgroundColor: 'white' }} />
                                        </div>

                                        {/* Days */}
                                        <label style={{ ...labelStyle, color: '#5B21B6' }}>Days of Week</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                            {DAYS.map((day, i) => (
                                                <button key={i} type="button" onClick={() => toggleDay(i)} style={{
                                                    padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                                                    color: formData.days_of_week.includes(i) ? 'white' : '#6B7280',
                                                    backgroundColor: formData.days_of_week.includes(i) ? '#8B5CF6' : 'white',
                                                    border: formData.days_of_week.includes(i) ? '1px solid #8B5CF6' : '1px solid #E5E7EB',
                                                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease',
                                                }}>{day}</button>
                                            ))}
                                        </div>

                                        {/* Threshold */}
                                        <label style={{ ...labelStyle, color: '#5B21B6' }}>Min Hours Threshold (optional)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                            <input type="number" step="0.5" min="0" value={formData.min_hours_threshold} onChange={(e) => setFormData({ ...formData, min_hours_threshold: e.target.value })} placeholder="e.g. 9" style={{ ...inputStyle, width: '120px', backgroundColor: 'white' }} />
                                            <span style={{ color: '#5B21B6', fontSize: '13px' }}>hours per day</span>
                                        </div>

                                        {/* Holidays */}
                                        <label style={{ ...labelStyle, color: '#5B21B6' }}>Specific Dates</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '160px', overflowY: 'auto', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
                                            {NL_PUBLIC_HOLIDAYS.map(holiday => (
                                                <label key={holiday.date} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', backgroundColor: formData.specific_dates.includes(holiday.date) ? '#EDE9FE' : 'transparent' }}>
                                                    <input type="checkbox" checked={formData.specific_dates.includes(holiday.date)} onChange={(e) => { if (e.target.checked) { setFormData(f => ({ ...f, specific_dates: [...f.specific_dates, holiday.date] })); } else { setFormData(f => ({ ...f, specific_dates: f.specific_dates.filter(d => d !== holiday.date) })); } }} style={{ width: '14px', height: '14px' }} />
                                                    <span style={{ fontSize: '11px', color: '#374151' }}><strong>{holiday.date}</strong> — {holiday.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Active Toggle */}
                                <div style={{ marginBottom: '24px' }}>
                                    <ToggleOption
                                        label="Is Active"
                                        description="Show in agency surcharge selection"
                                        checked={formData.is_active}
                                        onChange={(v) => setFormData({ ...formData, is_active: v })}
                                    />
                                </div>

                                {/* Buttons */}
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        style={{
                                            padding: '12px 20px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: '#6B7280',
                                            backgroundColor: '#F3F4F6',
                                            border: 'none',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveSurchargeType}
                                        disabled={!formData.name.trim()}
                                        style={{
                                            padding: '12px 24px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: 'white',
                                            backgroundColor: formData.name.trim() ? '#8B5CF6' : '#D1D5DB',
                                            border: 'none',
                                            borderRadius: '10px',
                                            cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
                                        }}
                                    >
                                        {editingType ? 'Save Changes' : 'Create Surcharge Type'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// Styles
const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#374151',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
};

// Stat Card Component
function StatCard({ label, value, icon: Icon, color }: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #E5E7EB',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div>
                    <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px' }}>{label}</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#1F2937' }}>{value}</p>
                </div>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon size={24} color={color} />
                </div>
            </div>
        </div>
    );
}

// Toggle Option Component
function ToggleOption({ label, description, checked, onChange }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                padding: '14px',
                backgroundColor: checked ? '#EDE9FE' : '#F9FAFB',
                border: `1px solid ${checked ? '#8B5CF6' : '#E5E7EB'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div>
                    <p style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: checked ? '#8B5CF6' : '#374151',
                    }}>{label}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{description}</p>
                </div>
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    backgroundColor: checked ? '#8B5CF6' : 'white',
                    border: checked ? 'none' : '2px solid #D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {checked && <CheckCircle size={14} color="white" />}
                </div>
            </div>
        </div>
    );
}
