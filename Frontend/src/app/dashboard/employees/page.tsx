'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { Card, Button, Badge, Input } from '@/components/ui';
import { api, Employee } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Users, UserCheck, UserX, Search, Eye, Plus, X, Mail, Phone, Copy, MessageCircle, CheckCircle, AlertCircle, MapPin, Calendar, CreditCard, Globe, FileText, Edit, Save, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';

// Comprehensive list of nationalities with country flags
const NATIONALITIES = [
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'United Kingdom', flag: '🇬🇧' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Bulgaria', flag: '🇧🇬' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Finland', flag: '🇫🇮' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Switzerland', flag: '🇨🇭' },
    { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'Libya', flag: '🇱🇾' },
    { name: 'Syria', flag: '🇸🇾' },
    { name: 'Iraq', flag: '🇮🇶' },
    { name: 'Iran', flag: '🇮🇷' },
    { name: 'Lebanon', flag: '🇱🇧' },
    { name: 'Jordan', flag: '🇯🇴' },
    { name: 'Palestine', flag: '🇵🇸' },
    { name: 'Saudi Arabia', flag: '🇸🇦' },
    { name: 'United Arab Emirates', flag: '🇦🇪' },
    { name: 'Kuwait', flag: '🇰🇼' },
    { name: 'Qatar', flag: '🇶🇦' },
    { name: 'Oman', flag: '🇴🇲' },
    { name: 'Bahrain', flag: '🇧🇭' },
    { name: 'Yemen', flag: '🇾🇪' },
    { name: 'Afghanistan', flag: '🇦🇫' },
    { name: 'Pakistan', flag: '🇵🇰' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Bangladesh', flag: '🇧🇩' },
    { name: 'Sri Lanka', flag: '🇱🇰' },
    { name: 'Nepal', flag: '🇳🇵' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'Vietnam', flag: '🇻🇳' },
    { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Philippines', flag: '🇵🇭' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Malaysia', flag: '🇲🇾' },
    { name: 'Singapore', flag: '🇸🇬' },
    { name: 'Russia', flag: '🇷🇺' },
    { name: 'Ukraine', flag: '🇺🇦' },
    { name: 'Belarus', flag: '🇧🇾' },
    { name: 'Kazakhstan', flag: '🇰🇿' },
    { name: 'Uzbekistan', flag: '🇺🇿' },
    { name: 'Azerbaijan', flag: '🇦🇿' },
    { name: 'Georgia', flag: '🇬🇪' },
    { name: 'Armenia', flag: '🇦🇲' },
    { name: 'United States', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'Peru', flag: '🇵🇪' },
    { name: 'Chile', flag: '🇨🇱' },
    { name: 'Venezuela', flag: '🇻🇪' },
    { name: 'Ecuador', flag: '🇪🇨' },
    { name: 'Cuba', flag: '🇨🇺' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'Nigeria', flag: '🇳🇬' },
    { name: 'Ghana', flag: '🇬🇭' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Ethiopia', flag: '🇪🇹' },
    { name: 'Somalia', flag: '🇸🇴' },
    { name: 'Eritrea', flag: '🇪🇷' },
    { name: 'Sudan', flag: '🇸🇩' },
    { name: 'Cameroon', flag: '🇨🇲' },
    { name: 'Congo', flag: '🇨🇬' },
    { name: 'Senegal', flag: '🇸🇳' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'Stateless', flag: '🏳️' },
    { name: 'Other', flag: '🌍' },
];


interface CreateEmployeeForm {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}

interface CreatedEmployee {
    email: string;
    password: string;
    name: string;
}

interface EditEmployeeForm {
    first_name: string;
    last_name: string;
    prefix_name: string;
    gender: string;
    date_of_birth: string;
    birthplace: string;
    bsn: string;
    phone_number: string;
    address: string;
    postcode: string;
    city: string;
    nationality: string;
    iban: string;
    document_type: string;
    document_number: string;
    document_expiry_date: string;
    has_drivers_license: boolean;
    contract_phase: string;
    contract_start_date: string;
    contract_end_date: string;
    hourly_rate: string;
}

export default function EmployeesPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);
    const [createForm, setCreateForm] = useState<CreateEmployeeForm>({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
    });
    const [editForm, setEditForm] = useState<EditEmployeeForm>({
        first_name: '',
        last_name: '',
        prefix_name: '',
        gender: '',
        date_of_birth: '',
        birthplace: '',
        bsn: '',
        phone_number: '',
        address: '',
        postcode: '',
        city: '',
        nationality: '',
        iban: '',
        document_type: '',
        document_number: '',
        document_expiry_date: '',
        has_drivers_license: false,
        contract_phase: '',
        contract_start_date: '',
        contract_end_date: '',
        hourly_rate: '',
    });

    // Nationality dropdown state
    const [nationalitySearch, setNationalitySearch] = useState('');
    const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
    const nationalityDropdownRef = useRef<HTMLDivElement>(null);

    // Close nationality dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (nationalityDropdownRef.current && !nationalityDropdownRef.current.contains(event.target as Node)) {
                setNationalityDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadEmployees();
    }, []);

    async function loadEmployees() {
        setLoading(true);
        setError(null);
        try {
            const [allResponse, pending] = await Promise.all([
                api.getEmployees(),
                api.getPendingEmployees(),
            ]);
            setEmployees(allResponse.results || []);
            setPendingEmployees(pending || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load employees');
        } finally {
            setLoading(false);
        }
    }

    function generatePassword() {
        const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let password = '';
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCreateForm(f => ({ ...f, password }));
    }

    async function handleCreateEmployee(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/users/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({
                    email: createForm.email,
                    password: createForm.password,
                    first_name: createForm.first_name,
                    last_name: createForm.last_name,
                    role: 'employee',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle validation errors
                const errorMsg = data.email?.[0] || data.password?.[0] || data.detail || 'Failed to create employee';
                throw new Error(errorMsg);
            }

            // Store created employee info for sharing
            setCreatedEmployee({
                email: createForm.email,
                password: createForm.password,
                name: `${createForm.first_name} ${createForm.last_name}`,
            });

            // Close create modal and open share modal
            setShowCreateModal(false);
            setShowShareModal(true);

            // Reset form
            setCreateForm({ email: '', password: '', first_name: '', last_name: '' });

            // Reload employees
            await loadEmployees();

        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create employee');
        } finally {
            setCreating(false);
        }
    }

    function copyCredentials() {
        if (!createdEmployee) return;
        const text = `Pro Totaal Service Login\n\nEmail: ${createdEmployee.email}\nWachtwoord: ${createdEmployee.password}\n\nDownload de app en log in om je profiel aan te vullen.`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function shareWhatsApp() {
        if (!createdEmployee) return;
        const text = encodeURIComponent(`Pro Totaal Service Login\n\nEmail: ${createdEmployee.email}\nWachtwoord: ${createdEmployee.password}\n\nDownload de app en log in om je profiel aan te vullen.`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    async function handleApprove(id: string) {
        try {
            await api.approveEmployee(id, {
                contract_phase: 'phase_a',
                contract_start_date: new Date().toISOString().split('T')[0],
                contract_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
            await loadEmployees();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to approve');
        }
    }

    async function handleReject(id: string) {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await api.rejectEmployee(id, reason);
            await loadEmployees();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject');
        }
    }

    function openEditModal(emp: Employee) {
        setSelectedEmployee(emp);
        setEditForm({
            first_name: emp.first_name || emp.full_name?.split(' ')[0] || '',
            last_name: emp.last_name || emp.full_name?.split(' ').slice(1).join(' ') || '',
            prefix_name: emp.prefix_name || '',
            gender: emp.gender || '',
            date_of_birth: emp.date_of_birth || '',
            birthplace: emp.birthplace || '',
            bsn: emp.bsn || '',
            phone_number: emp.phone_number || '',
            address: emp.address || '',
            postcode: emp.postcode || '',
            city: emp.city || '',
            nationality: emp.nationality || '',
            iban: emp.iban || '',
            document_type: emp.document_type_name || '',
            document_number: emp.document_number || '',
            document_expiry_date: emp.document_expiry_date || '',
            has_drivers_license: emp.has_drivers_license || false,
            contract_phase: emp.contract_phase || '',
            contract_start_date: emp.contract_start_date || '',
            contract_end_date: emp.contract_end_date || '',
            hourly_rate: emp.hourly_rate?.toString() || '',
        });
        setShowEditModal(true);
        setShowViewModal(false);
    }

    async function handleSaveEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${selectedEmployee.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({
                    first_name: editForm.first_name,
                    last_name: editForm.last_name,
                    prefix_name: editForm.prefix_name,
                    gender: editForm.gender,
                    date_of_birth: editForm.date_of_birth || null,
                    birthplace: editForm.birthplace,
                    bsn: editForm.bsn,
                    phone_number: editForm.phone_number,
                    address: editForm.address,
                    postcode: editForm.postcode,
                    city: editForm.city,
                    nationality: editForm.nationality,
                    iban: editForm.iban,
                    document_type_name: editForm.document_type,
                    document_number: editForm.document_number,
                    document_expiry_date: editForm.document_expiry_date || null,
                    has_drivers_license: editForm.has_drivers_license,
                    contract_phase: editForm.contract_phase,
                    contract_start_date: editForm.contract_start_date || null,
                    contract_end_date: editForm.contract_end_date || null,
                    hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to update profile');
            }

            setShowEditModal(false);
            await loadEmployees();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    function openDeleteModal(emp: Employee) {
        setSelectedEmployee(emp);
        setShowDeleteModal(true);
        setShowViewModal(false);
    }

    async function handleDelete() {
        if (!selectedEmployee) return;
        setDeleting(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${selectedEmployee.id}/soft_delete/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || data.error || 'Failed to delete employee');
            }

            setShowDeleteModal(false);
            setSelectedEmployee(null);
            await loadEmployees();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setDeleting(false);
        }
    }

    const filteredEmployees = employees.filter(emp => {
        if (filter !== 'all' && emp.status !== filter) return false;
        if (search) {
            const searchLower = search.toLowerCase();
            return emp.full_name?.toLowerCase().includes(searchLower) ||
                emp.user_email?.toLowerCase().includes(searchLower);
        }
        return true;
    });

    const statusColors: Record<string, string> = {
        approved: 'bg-green-100 text-green-700',
        pending: 'bg-yellow-100 text-yellow-700',
        incomplete: 'bg-gray-100 text-gray-700',
        rejected: 'bg-red-100 text-red-700',
        suspended: 'bg-gray-200 text-gray-600',
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('employees')}</h1>
                        <p className="text-gray-500">{t('manageProfiles')}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={loadEmployees}>
                            {t('refresh')}
                        </Button>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('addEmployee')}
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '20px',
                    marginBottom: '8px'
                }}>
                    <Card style={{ padding: '20px', background: 'linear-gradient(to bottom right, #eff6ff, #ffffff)', borderColor: '#dbeafe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#dbeafe', borderRadius: '12px' }}>
                                <Users style={{ width: '24px', height: '24px', color: '#2563eb' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>{t('totalEmployees')}</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>{employees.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card style={{ padding: '20px', background: 'linear-gradient(to bottom right, #f0fdf4, #ffffff)', borderColor: '#bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#dcfce7', borderRadius: '12px' }}>
                                <UserCheck style={{ width: '24px', height: '24px', color: '#16a34a' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>{t('active')}</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a', margin: 0 }}>
                                    {employees.filter(e => e.status === 'approved').length}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card style={{ padding: '20px', background: 'linear-gradient(to bottom right, #fefce8, #ffffff)', borderColor: '#fde68a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '12px' }}>
                                <Users style={{ width: '24px', height: '24px', color: '#ca8a04' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>{t('pending')}</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#ca8a04', margin: 0 }}>{pendingEmployees.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card style={{ padding: '20px', background: 'linear-gradient(to bottom right, #f9fafb, #ffffff)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '12px' }}>
                                <UserX style={{ width: '24px', height: '24px', color: '#4b5563' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>Incomplete</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#4b5563', margin: 0 }}>
                                    {employees.filter(e => e.status === 'incomplete').length}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>



                {/* Filters + Table Container - matching Customers page layout */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                }}>
                    {/* Filters and Search */}
                    <div style={{
                        padding: '16px 24px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {['all', 'approved', 'pending', 'incomplete', 'rejected', 'suspended'].map((status) => {
                                const statusCounts = {
                                    all: employees.length,
                                    approved: employees.filter(e => e.status === 'approved').length,
                                    pending: pendingEmployees.length,
                                    incomplete: employees.filter(e => e.status === 'incomplete').length,
                                    rejected: employees.filter(e => e.status === 'rejected').length,
                                    suspended: employees.filter(e => e.status === 'suspended').length,
                                };
                                const count = statusCounts[status as keyof typeof statusCounts] || 0;
                                const isPending = status === 'pending';
                                const isRejected = status === 'rejected';
                                const isSuspended = status === 'suspended';
                                const isActive = filter === status;

                                // Determine colors based on status
                                let bgColor = isActive ? '#1E3A5F' : '#F3F4F6';
                                let textColor = isActive ? '#FFFFFF' : '#4B5563';
                                let badgeBg = 'rgba(255,255,255,0.2)';

                                if (isPending && count > 0) {
                                    bgColor = isActive ? '#EA580C' : '#FFF7ED';
                                    textColor = isActive ? '#FFFFFF' : '#EA580C';
                                    badgeBg = isActive ? 'rgba(255,255,255,0.25)' : '#FDBA74';
                                } else if (isRejected && count > 0) {
                                    bgColor = isActive ? '#DC2626' : '#FEF2F2';
                                    textColor = isActive ? '#FFFFFF' : '#DC2626';
                                    badgeBg = isActive ? 'rgba(255,255,255,0.25)' : '#FECACA';
                                } else if (isSuspended && count > 0) {
                                    bgColor = isActive ? '#6B7280' : '#F9FAFB';
                                    textColor = isActive ? '#FFFFFF' : '#6B7280';
                                    badgeBg = isActive ? 'rgba(255,255,255,0.25)' : '#E5E7EB';
                                }

                                const label = status === 'all' ? 'All' :
                                    status === 'approved' ? 'Approved' :
                                        status === 'pending' ? 'Pending' :
                                            status === 'rejected' ? 'Rejected' :
                                                status === 'suspended' ? 'Suspended' : 'Incomplete';

                                return (
                                    <button
                                        key={status}
                                        onClick={() => setFilter(status)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            transition: 'all 0.2s',
                                            backgroundColor: bgColor,
                                            color: textColor,
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: isActive ? '0 4px 12px rgba(30, 58, 95, 0.25)' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        {label}
                                        {(isPending || isRejected || isSuspended) && count > 0 && (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                backgroundColor: badgeBg,
                                                color: isActive ? 'white' : textColor,
                                            }}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <Search style={{
                                position: 'absolute',
                                left: '14px',
                                width: '18px',
                                height: '18px',
                                color: '#9CA3AF',
                                pointerEvents: 'none',
                            }} />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    width: '280px',
                                    height: '44px',
                                    paddingLeft: '46px',
                                    paddingRight: '16px',
                                    fontSize: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                    backgroundColor: '#F9FAFB',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#1E3A5F';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#E5E7EB';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                    </div>

                    {/* Employees Table */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A5F]"></div>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <p className="text-red-600 mb-4">{error}</p>
                            <Button onClick={loadEmployees}>Retry</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full" style={{ tableLayout: 'fixed' }}>
                                <thead style={{ backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
                                    <tr>
                                        <th style={{ width: '30%' }} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th style={{ width: '25%' }} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                        <th style={{ width: '15%' }} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th style={{ width: '30%' }} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <p className="text-gray-500 font-medium">No employees found</p>
                                                <p className="text-gray-400 text-sm mt-1">Click "Add Employee" to create one</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map((emp) => (
                                            <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-[#1E3A5F] to-[#3E5A8F] rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                                                            {emp.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{emp.full_name || 'Unknown'}</p>
                                                            <p className="text-sm text-gray-500">{emp.nationality || 'Not provided'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                            {emp.user_email}
                                                        </p>
                                                        <p className="text-sm text-gray-600 flex items-center gap-2">
                                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                            {emp.phone_number || '0000000000'}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusColors[emp.status] || 'bg-gray-100 text-gray-600'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'approved' ? 'bg-green-500' :
                                                            emp.status === 'pending' ? 'bg-yellow-500' :
                                                                emp.status === 'rejected' ? 'bg-red-500' : 'bg-gray-400'
                                                            }`}></span>
                                                        {emp.status?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '8px 14px',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                color: '#4B5563',
                                                                backgroundColor: '#FFFFFF',
                                                                border: '1px solid #E5E7EB',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                            }}
                                                        >
                                                            <Eye style={{ width: '14px', height: '14px' }} />
                                                            View
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteModal(emp)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '8px 14px',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                color: '#DC2626',
                                                                backgroundColor: '#FFFFFF',
                                                                border: '1px solid #FECACA',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                            }}
                                                        >
                                                            <Trash2 style={{ width: '14px', height: '14px' }} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create Employee Modal */}
                {showCreateModal && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px'
                    }}>
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setShowCreateModal(false)}
                        />
                        <div style={{
                            position: 'relative',
                            backgroundColor: '#ffffff',
                            borderRadius: '20px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            width: '100%',
                            maxWidth: '520px',
                            overflow: 'hidden'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%)',
                                padding: '28px 32px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <h2 style={{
                                            fontSize: '22px',
                                            fontWeight: 700,
                                            color: '#ffffff',
                                            margin: 0
                                        }}>Add New Employee</h2>
                                        <p style={{
                                            color: 'rgba(255,255,255,0.7)',
                                            fontSize: '14px',
                                            marginTop: '6px'
                                        }}>Create a new employee account</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'rgba(255,255,255,0.1)',
                                            cursor: 'pointer',
                                            display: 'flex'
                                        }}
                                    >
                                        <X style={{ width: '20px', height: '20px', color: '#ffffff' }} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '32px' }}>
                                {createError && (
                                    <div style={{
                                        marginBottom: '24px',
                                        padding: '16px',
                                        backgroundColor: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '12px'
                                    }}>
                                        <AlertCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
                                        <p style={{ fontSize: '14px', color: '#b91c1c', margin: 0 }}>{createError}</p>
                                    </div>
                                )}

                                <form onSubmit={handleCreateEmployee}>
                                    {/* Name Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#6b7280',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '12px'
                                        }}>
                                            Full Name
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <input
                                                value={createForm.first_name}
                                                onChange={(e) => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                                                required
                                                placeholder="First name"
                                                style={{
                                                    width: '100%',
                                                    height: '52px',
                                                    padding: '0 18px',
                                                    fontSize: '15px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <input
                                                value={createForm.last_name}
                                                onChange={(e) => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                                                required
                                                placeholder="Last name"
                                                style={{
                                                    width: '100%',
                                                    height: '52px',
                                                    padding: '0 18px',
                                                    fontSize: '15px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Email Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#6b7280',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '12px'
                                        }}>
                                            Email Address
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail style={{
                                                position: 'absolute',
                                                left: '18px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: '20px',
                                                height: '20px',
                                                color: '#9ca3af'
                                            }} />
                                            <input
                                                type="email"
                                                value={createForm.email}
                                                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                                required
                                                placeholder="employee@example.com"
                                                style={{
                                                    width: '100%',
                                                    height: '52px',
                                                    padding: '0 18px 0 52px',
                                                    fontSize: '15px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Password Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <label style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: '#6b7280',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                Temporary Password
                                            </label>
                                            <button
                                                type="button"
                                                onClick={generatePassword}
                                                style={{
                                                    fontSize: '13px',
                                                    fontWeight: 500,
                                                    color: '#1E3A5F',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Plus style={{ width: '14px', height: '14px' }} />
                                                Generate
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={createForm.password}
                                            onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                            required
                                            placeholder="Min 8 characters"
                                            minLength={8}
                                            style={{
                                                width: '100%',
                                                height: '52px',
                                                padding: '0 18px',
                                                fontSize: '15px',
                                                fontFamily: 'monospace',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '12px',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        <p style={{
                                            fontSize: '12px',
                                            color: '#9ca3af',
                                            marginTop: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            margin: '10px 0 0 0'
                                        }}>
                                            <AlertCircle style={{ width: '14px', height: '14px' }} />
                                            Employee will change password on first login
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '16px',
                                        paddingTop: '20px',
                                        borderTop: '1px solid #f3f4f6'
                                    }}>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowCreateModal(false)}
                                            style={{ flex: 1, height: '52px', fontSize: '15px' }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={creating}
                                            style={{
                                                flex: 1,
                                                height: '52px',
                                                fontSize: '15px',
                                                backgroundColor: '#1E3A5F'
                                            }}
                                        >
                                            {creating ? (
                                                <>
                                                    <div style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        border: '2px solid #ffffff',
                                                        borderTopColor: 'transparent',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    }} />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus style={{ width: '18px', height: '18px' }} />
                                                    Create Employee
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Share Credentials Modal */}
                {showShareModal && createdEmployee && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowShareModal(false)} />
                        <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
                            {/* Success Icon */}
                            <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <CheckCircle style={{ width: '32px', height: '32px', color: '#16A34A' }} />
                            </div>

                            {/* Title */}
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Employee Created!</h3>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
                                Share these credentials with <strong>{createdEmployee.name}</strong>
                            </p>

                            {/* Credentials Card */}
                            <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '20px', border: '1px solid #E5E7EB', marginBottom: '24px', textAlign: 'left' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
                                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginTop: '4px' }}>{createdEmployee.email}</p>
                                </div>
                                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
                                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginTop: '4px', fontFamily: 'monospace', letterSpacing: '1px' }}>{createdEmployee.password}</p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={copyCredentials}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        backgroundColor: 'white',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        color: copied ? '#16A34A' : '#374151',
                                    }}
                                >
                                    {copied ? (
                                        <><CheckCircle style={{ width: '18px', height: '18px' }} /> Copied to Clipboard!</>
                                    ) : (
                                        <><Copy style={{ width: '18px', height: '18px' }} /> Copy Credentials</>
                                    )}
                                </button>
                                <button
                                    onClick={shareWhatsApp}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        backgroundColor: '#25D366',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <MessageCircle style={{ width: '18px', height: '18px' }} /> Share via WhatsApp
                                </button>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#6B7280',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Employee Modal */}
                {showViewModal && selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-gradient-to-br from-[#1E3A5F] to-[#2E5A8F] p-6 rounded-t-2xl text-white">
                                <button
                                    onClick={() => setShowViewModal(false)}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold">
                                        {selectedEmployee.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{selectedEmployee.full_name || 'Unknown'}</h2>
                                        <p className="text-white/70">{selectedEmployee.user_email}</p>
                                        <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${selectedEmployee.status === 'approved' ? 'bg-green-500' :
                                            selectedEmployee.status === 'pending' ? 'bg-yellow-500' :
                                                selectedEmployee.status === 'incomplete' ? 'bg-gray-500' :
                                                    'bg-red-500'
                                            }`}>
                                            {selectedEmployee.status?.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Content - Sections */}
                            <div className="p-6 space-y-6">

                                {/* Personal Information */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                                    <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Personal Information
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">First Name</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.first_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Last Name</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.last_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Gender</p>
                                            <p className="font-semibold text-gray-900 capitalize">{selectedEmployee.gender || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Date of Birth</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.date_of_birth || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Birthplace</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.birthplace || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Nationality</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.nationality || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">BSN</p>
                                            <p className="font-semibold text-gray-900 font-mono">{selectedEmployee.bsn || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                                    <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Contact Information
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Email</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.user_email || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Phone</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.phone_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Address</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.address || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Postcode</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.postcode || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">City</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.city || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Information */}
                                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 border border-yellow-100">
                                    <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" />
                                        Financial Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">IBAN</p>
                                            <p className="font-semibold text-gray-900 font-mono">{selectedEmployee.iban || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Hourly Rate</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.hourly_rate ? `€${selectedEmployee.hourly_rate}` : '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ID Document */}
                                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
                                    <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        ID Document
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Document Type</p>
                                            <p className="font-semibold text-gray-900 capitalize">{selectedEmployee.document_type_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Document Number</p>
                                            <p className="font-semibold text-gray-900 font-mono">{selectedEmployee.document_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.document_expiry_date || '-'}</p>
                                        </div>
                                    </div>
                                    {/* Document Preview */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {selectedEmployee.id_document_front && (
                                            <div className="relative group">
                                                <p className="text-xs text-gray-500 mb-2">Front Side</p>
                                                <a href={selectedEmployee.id_document_front} target="_blank" rel="noopener noreferrer" className="block">
                                                    <img src={selectedEmployee.id_document_front} alt="ID Front" className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-purple-400 transition-colors cursor-pointer" />
                                                </a>
                                            </div>
                                        )}
                                        {selectedEmployee.id_document_back && (
                                            <div className="relative group">
                                                <p className="text-xs text-gray-500 mb-2">Back Side</p>
                                                <a href={selectedEmployee.id_document_back} target="_blank" rel="noopener noreferrer" className="block">
                                                    <img src={selectedEmployee.id_document_back} alt="ID Back" className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-purple-400 transition-colors cursor-pointer" />
                                                </a>
                                            </div>
                                        )}
                                        {selectedEmployee.id_document_pdf && (
                                            <div className="relative">
                                                <p className="text-xs text-gray-500 mb-2">PDF Document</p>
                                                <a href={selectedEmployee.id_document_pdf} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-purple-400 transition-colors">
                                                    <FileText className="w-8 h-8 text-red-500" />
                                                    <span className="font-medium text-gray-700">View PDF</span>
                                                </a>
                                            </div>
                                        )}
                                        {!selectedEmployee.id_document_front && !selectedEmployee.id_document_back && !selectedEmployee.id_document_pdf && (
                                            <p className="text-gray-400 italic col-span-3">No documents uploaded</p>
                                        )}
                                    </div>
                                </div>

                                {/* Driver's License */}
                                {selectedEmployee.has_drivers_license && (
                                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-5 border border-orange-100">
                                        <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <span className="text-lg">🚗</span>
                                            Driver's License
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {selectedEmployee.drivers_license_front && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Front Side</p>
                                                    <a href={selectedEmployee.drivers_license_front} target="_blank" rel="noopener noreferrer">
                                                        <img src={selectedEmployee.drivers_license_front} alt="DL Front" className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-orange-400 transition-colors cursor-pointer" />
                                                    </a>
                                                </div>
                                            )}
                                            {selectedEmployee.drivers_license_back && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Back Side</p>
                                                    <a href={selectedEmployee.drivers_license_back} target="_blank" rel="noopener noreferrer">
                                                        <img src={selectedEmployee.drivers_license_back} alt="DL Back" className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-orange-400 transition-colors cursor-pointer" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Contract Information */}
                                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-5 border border-gray-200">
                                    <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Contract Information
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Phase</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.contract_phase || 'Not assigned'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Start Date</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.contract_start_date || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">End Date</p>
                                            <p className="font-semibold text-gray-900">{selectedEmployee.contract_end_date || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-4 border-t border-gray-200">
                                    {selectedEmployee.status === 'pending' && (
                                        <>
                                            <Button
                                                onClick={() => {
                                                    handleApprove(selectedEmployee.id);
                                                    setShowViewModal(false);
                                                }}
                                                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                                            >
                                                <CheckCircle className="w-5 h-5 mr-2" />
                                                Approve Employee
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    handleReject(selectedEmployee.id);
                                                    setShowViewModal(false);
                                                }}
                                                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                                            >
                                                <AlertCircle className="w-5 h-5 mr-2" />
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        onClick={() => openEditModal(selectedEmployee)}
                                        className="flex-1 bg-gradient-to-r from-[#1E3A5F] to-[#2E5A8F] hover:from-[#2E4A6F] hover:to-[#3E6A9F] text-white font-semibold py-3 rounded-xl shadow-lg"
                                    >
                                        <Edit className="w-5 h-5 mr-2" />
                                        Edit Profile
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowViewModal(false)}
                                        className="flex-1 py-3 rounded-xl font-semibold"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Employee Modal */}
                {showEditModal && selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2E5A8F] px-8 py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                                            {selectedEmployee.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Edit Employee Profile</h2>
                                            <p className="text-white/70 text-sm mt-1">{selectedEmployee.user_email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowEditModal(false)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
                                <form onSubmit={handleSaveEdit} className="p-8 space-y-6">

                                    {/* Personal Information Section */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                                        <div className="flex items-center gap-2 mb-5">
                                            <Users className="w-5 h-5 text-[#1E3A5F]" />
                                            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider">
                                                Personal Information
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                                                <Input
                                                    value={editForm.first_name}
                                                    onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                                                    placeholder="John"
                                                    className="h-11"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Prefix</label>
                                                <Input
                                                    value={editForm.prefix_name}
                                                    onChange={(e) => setEditForm(f => ({ ...f, prefix_name: e.target.value }))}
                                                    placeholder="van"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                                                <Input
                                                    value={editForm.last_name}
                                                    onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                                                    placeholder="Doe"
                                                    className="h-11"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                                                <select
                                                    value={editForm.gender}
                                                    onChange={(e) => setEditForm(f => ({ ...f, gender: e.target.value }))}
                                                    className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">Select gender</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                                                <Input
                                                    type="date"
                                                    value={editForm.date_of_birth}
                                                    onChange={(e) => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))}
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Birthplace</label>
                                                <Input
                                                    value={editForm.birthplace}
                                                    onChange={(e) => setEditForm(f => ({ ...f, birthplace: e.target.value }))}
                                                    placeholder="Amsterdam"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div ref={nationalityDropdownRef} style={{ position: 'relative' }}>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                                                <div
                                                    onClick={() => setNationalityDropdownOpen(!nationalityDropdownOpen)}
                                                    style={{
                                                        width: '100%',
                                                        height: '44px',
                                                        padding: '0 12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#FFFFFF',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {editForm.nationality ? (
                                                            <>
                                                                <span style={{ fontSize: '20px' }}>
                                                                    {NATIONALITIES.find(n => n.name === editForm.nationality)?.flag || '🌍'}
                                                                </span>
                                                                {editForm.nationality}
                                                            </>
                                                        ) : (
                                                            <span style={{ color: '#9CA3AF' }}>Select nationality...</span>
                                                        )}
                                                    </span>
                                                    <ChevronDown size={16} color="#6B7280" style={{ transform: nationalityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                                </div>

                                                {nationalityDropdownOpen && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        marginTop: '4px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                        zIndex: 9999,
                                                    }}>
                                                        {/* Search Input */}
                                                        <div style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                                            <div style={{ position: 'relative' }}>
                                                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                                                <input
                                                                    type="text"
                                                                    value={nationalitySearch}
                                                                    onChange={(e) => setNationalitySearch(e.target.value)}
                                                                    placeholder="Search nationality..."
                                                                    autoFocus
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '8px 10px 8px 32px',
                                                                        border: '1px solid #E5E7EB',
                                                                        borderRadius: '6px',
                                                                        fontSize: '13px',
                                                                        outline: 'none',
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Options List */}
                                                        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                                            {NATIONALITIES
                                                                .filter(n => n.name.toLowerCase().includes(nationalitySearch.toLowerCase()))
                                                                .map((nationality) => (
                                                                    <div
                                                                        key={nationality.name}
                                                                        onClick={() => {
                                                                            setEditForm(f => ({ ...f, nationality: nationality.name }));
                                                                            setNationalityDropdownOpen(false);
                                                                            setNationalitySearch('');
                                                                        }}
                                                                        style={{
                                                                            padding: '10px 12px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '10px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: editForm.nationality === nationality.name ? '#EFF6FF' : 'transparent',
                                                                            borderLeft: editForm.nationality === nationality.name ? '3px solid #2563EB' : '3px solid transparent',
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (editForm.nationality !== nationality.name) {
                                                                                e.currentTarget.style.backgroundColor = '#F9FAFB';
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (editForm.nationality !== nationality.name) {
                                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span style={{ fontSize: '20px' }}>{nationality.flag}</span>
                                                                        <span style={{ fontSize: '14px', color: '#374151', fontWeight: editForm.nationality === nationality.name ? 600 : 400 }}>{nationality.name}</span>
                                                                        {editForm.nationality === nationality.name && (
                                                                            <CheckCircle size={16} color="#2563EB" style={{ marginLeft: 'auto' }} />
                                                                        )}
                                                                    </div>
                                                                ))
                                                            }
                                                            {NATIONALITIES.filter(n => n.name.toLowerCase().includes(nationalitySearch.toLowerCase())).length === 0 && (
                                                                <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                                                                    No nationality found
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">BSN *</label>
                                                <Input
                                                    value={editForm.bsn}
                                                    onChange={(e) => setEditForm(f => ({ ...f, bsn: e.target.value }))}
                                                    placeholder="123456789"
                                                    className="h-11 font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Information Section */}
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                                        <div className="flex items-center gap-2 mb-5">
                                            <Phone className="w-5 h-5 text-[#1E3A5F]" />
                                            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider">
                                                Contact Information
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                                                <Input
                                                    value={editForm.phone_number}
                                                    onChange={(e) => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                                                    placeholder="+31 6 12345678"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                                                <Input
                                                    value={editForm.address}
                                                    onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                                                    placeholder="Hoofdstraat 123"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                                                <Input
                                                    value={editForm.postcode}
                                                    onChange={(e) => setEditForm(f => ({ ...f, postcode: e.target.value }))}
                                                    placeholder="1234 AB"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                                                <Input
                                                    value={editForm.city}
                                                    onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))}
                                                    placeholder="Amsterdam"
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Information Section */}
                                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-100">
                                        <div className="flex items-center gap-2 mb-5">
                                            <CreditCard className="w-5 h-5 text-[#1E3A5F]" />
                                            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider">
                                                Financial Information
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">IBAN *</label>
                                                <Input
                                                    value={editForm.iban}
                                                    onChange={(e) => setEditForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
                                                    placeholder="NL00BANK0123456789"
                                                    className="h-11 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate (€)</label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editForm.hourly_rate}
                                                    onChange={(e) => setEditForm(f => ({ ...f, hourly_rate: e.target.value }))}
                                                    placeholder="25.00"
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ID Document Section */}
                                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                                        <div className="flex items-center gap-2 mb-5">
                                            <FileText className="w-5 h-5 text-[#1E3A5F]" />
                                            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider">
                                                ID Document
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                                                <select
                                                    value={editForm.document_type}
                                                    onChange={(e) => setEditForm(f => ({ ...f, document_type: e.target.value }))}
                                                    className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                >
                                                    <option value="">Select type</option>
                                                    <option value="passport">Passport</option>
                                                    <option value="id_card">ID Card</option>
                                                    <option value="residence_permit">Residence Permit</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Document Number</label>
                                                <Input
                                                    value={editForm.document_number}
                                                    onChange={(e) => setEditForm(f => ({ ...f, document_number: e.target.value }))}
                                                    placeholder="NL123456789"
                                                    className="h-11 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                                                <Input
                                                    type="date"
                                                    value={editForm.document_expiry_date}
                                                    onChange={(e) => setEditForm(f => ({ ...f, document_expiry_date: e.target.value }))}
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.has_drivers_license}
                                                    onChange={(e) => setEditForm(f => ({ ...f, has_drivers_license: e.target.checked }))}
                                                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Has Driver&apos;s License</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Contract Information Section */}
                                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                                        <div className="flex items-center gap-2 mb-5">
                                            <Calendar className="w-5 h-5 text-[#1E3A5F]" />
                                            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider">
                                                Contract Information
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Contract Phase</label>
                                                <select
                                                    value={editForm.contract_phase}
                                                    onChange={(e) => setEditForm(f => ({ ...f, contract_phase: e.target.value }))}
                                                    className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                                >
                                                    <option value="">Select phase</option>
                                                    <option value="A">Phase A</option>
                                                    <option value="B">Phase B</option>
                                                    <option value="C">Phase C</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                                                <Input
                                                    type="date"
                                                    value={editForm.contract_start_date}
                                                    onChange={(e) => setEditForm(f => ({ ...f, contract_start_date: e.target.value }))}
                                                    className="h-11"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                                                <Input
                                                    type="date"
                                                    value={editForm.contract_end_date}
                                                    onChange={(e) => setEditForm(f => ({ ...f, contract_end_date: e.target.value }))}
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-4 pt-4 border-t border-gray-200">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-12 text-base font-semibold rounded-xl"
                                            onClick={() => setShowEditModal(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2E5A8F] hover:from-[#2E4A6F] hover:to-[#3E6A9F]"
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save Changes
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && selectedEmployee && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDeleteModal(false)} />
                        <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <AlertTriangle style={{ width: '32px', height: '32px', color: '#DC2626' }} />
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Delete Employee</h3>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
                                Are you sure you want to delete <strong>{selectedEmployee.full_name}</strong>? This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                                    <Trash2 style={{ width: '16px', height: '16px' }} /> {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
