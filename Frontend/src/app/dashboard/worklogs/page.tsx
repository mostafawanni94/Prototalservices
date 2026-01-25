'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { Card, Button } from '@/components/ui';
import { api, WorkEntry } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Clock, CheckCircle, XCircle, AlertCircle, Search, Eye, Check, X, Plus, Gift, Trash2, Edit2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types
interface AllowanceType {
    id: number;
    name: string;
    code: string;
    base_price: string;
}

interface WorkLogAllowance {
    allowance_type: number | null;
    custom_allowance_name: string;
    hours: string;
    notes: string;
    start_time?: string;
    end_time?: string;
}

interface Project {
    id: string;
    name: string;
}

// Helper functions for week-based filtering
function getWeekStartDate(weekStr: string): string {
    // weekStr format: YYYY-Www (e.g., 2025-W01)
    const match = weekStr.match(/(\d{4})-W(\d{2})/);
    if (!match) return '';
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    // Get first day of the year
    const jan1 = new Date(year, 0, 1);
    // Calculate days to add to get to the first Monday of week 1
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const firstMonday = new Date(year, 0, 1 + daysToMonday + (week - 1) * 7);
    return firstMonday.toISOString().split('T')[0];
}

function getWeekEndDate(weekStr: string): string {
    const startDate = getWeekStartDate(weekStr);
    if (!startDate) return '';
    const date = new Date(startDate);
    date.setDate(date.getDate() + 6); // Sunday
    return date.toISOString().split('T')[0];
}

export default function WorkLogsPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [workLogs, setWorkLogs] = useState<WorkEntry[]>([]);
    const [pendingLogs, setPendingLogs] = useState<WorkEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    // Advanced filters
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterCustomer, setFilterCustomer] = useState('');
    const [filterSupervisor, setFilterSupervisor] = useState('');
    const [filterEmployees, setFilterEmployees] = useState<string[]>([]); // Multi-select: empty = all
    const [filterStartWeek, setFilterStartWeek] = useState(''); // Format: YYYY-Www
    const [filterEndWeek, setFilterEndWeek] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSupervisors, setFilterSupervisors] = useState<{ id: string, full_name: string }[]>([]);
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const [employeeSearchFilter, setEmployeeSearchFilter] = useState('');
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]); // Multi-select: empty = all
    // Customer and Supervisor search states
    const [customerSearchFilter, setCustomerSearchFilter] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [supervisorSearchFilter, setSupervisorSearchFilter] = useState('');
    const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);

    // Load filter supervisors (outfolders) when customer changes
    async function loadFilterSupervisors(customerId: string) {
        if (!customerId) {
            setFilterSupervisors([]);
            setFilterSupervisor('');
            return;
        }
        try {
            // Outfolders are supervisors - filter by customer
            const response = await fetch(`${API_URL}/customers/outfolders/?customer=${customerId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Handle paginated or array response and filter by customer ID on frontend
                const allOutfolders = data.results || data;
                const filteredOutfolders = allOutfolders.filter((o: any) => o.customer === customerId);
                // Use company_name (Rayon) for display, not person's name
                setFilterSupervisors(filteredOutfolders.map((o: any) => ({
                    id: o.id,
                    full_name: o.company_name || 'Unknown Rayon'
                })));
            }
        } catch (err) {
            console.error('Failed to load supervisors for filter');
        }
    }

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        employee: '', // For admin to create for specific employee
        customer: '', // Customer first
        project: '',
        supervisor: '', // Outfolder ID
        service: '', // Service ID
        location_override: '',
        // New datetime fields for night shift support
        start_datetime: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
        end_datetime: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16),
        break_start_time: '12:00',
        break_end_time: '12:30',
        notes: '',
        status: 'draft', // For editing
    });
    const [allowances, setAllowances] = useState<WorkLogAllowance[]>([]);

    // Customer-related data
    const [employees, setEmployees] = useState<{ id: string, full_name: string }[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [customers, setCustomers] = useState<{ id: string, company_name: string }[]>([]);
    const [supervisors, setSupervisors] = useState<{ id: string, full_name: string }[]>([]);
    const [services, setServices] = useState<{ id: string, name: string }[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // Quick status change dropdown
    const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    async function handleStatusChange(logId: string, newStatus: string) {
        try {
            const response = await fetch(`${API_URL}/worklogs/${logId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (response.ok) {
                await loadWorkLogs();
            } else {
                const error = await response.json();
                alert(JSON.stringify(error));
            }
        } catch (err) {
            alert('Failed to update status');
        }
        setStatusDropdownOpen(null);
    }

    // Load customer-related data when project changes
    async function loadCustomerData(projectId: string) {
        if (!projectId) {
            setSupervisors([]);
            setServices([]);
            return;
        }
        try {
            // Find project to get customer
            const project = projects.find(p => p.id === projectId);
            if (!project) return;

            // Load supervisors and services for the customer
            const [supervisorsRes, servicesRes] = await Promise.all([
                fetch(`${API_URL}/customers/worklog-customers/${(project as any).customer}/outfolders/`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                }),
                fetch(`${API_URL}/customers/worklog-customers/${(project as any).customer}/services/`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                })
            ]);

            if (supervisorsRes.ok) {
                const data = await supervisorsRes.json();
                setSupervisors(Array.isArray(data) ? data : data.results || []);
            }
            if (servicesRes.ok) {
                const data = await servicesRes.json();
                setServices(Array.isArray(data) ? data : data.results || []);
            }
        } catch (e) {
            console.error('Failed to load customer data:', e);
        }
    }

    async function loadEmployees() {
        try {
            const response = await fetch(`${API_URL}/employees/profiles/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEmployees(Array.isArray(data) ? data : data.results || []);
            }
        } catch (e) {
            console.error('Failed to load employees:', e);
        }
    }

    useEffect(() => {
        loadWorkLogs();
        loadProjects();
        loadAllowanceTypes();
        loadEmployees();
        loadCustomers();
    }, []);

    async function loadWorkLogs() {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('access_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [allResponse, pending, unassignedRes] = await Promise.all([
                api.getWorkEntries({ include_past: true }),
                api.getPendingWorkEntries(),
                fetch(`${API_URL}/projects/planned-days/unassigned_shifts/`, { headers }).then(r => r.ok ? r.json() : { results: [] })
            ]);

            // Merge work entries with unassigned shifts
            const workEntries = allResponse.results || [];
            const unassignedShifts = (unassignedRes.results || []).map((shift: { id: string; work_date: string; project: string; project_name: string; customer_name: string; shift_name: string; shift_color: string; start_time: string; end_time: string; status: string; employee_name: string; required_workers: number }) => ({
                ...shift,
                // Add fields expected by the UI
                id: `unassigned-${shift.id}`,  // Prefix to avoid ID collision
                employee: null,
                actual_start_datetime: shift.start_time ? `${shift.work_date}T${shift.start_time}:00` : null,
                actual_end_datetime: shift.end_time ? `${shift.work_date}T${shift.end_time}:00` : null,
                calculated_hours: '0.00',
                break_duration: '0:00',
            }));

            setWorkLogs([...workEntries, ...unassignedShifts]);
            setPendingLogs(pending || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load work logs');
        } finally {
            setLoading(false);
        }
    }

    async function loadProjects() {
        try {
            const response = await fetch(`${API_URL}/projects/projects/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProjects(data.results || data);
            }
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    }

    async function loadCustomers() {
        try {
            const response = await fetch(`${API_URL}/customers/customers/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setCustomers((data.results || data).map((c: any) => ({ id: c.id, company_name: c.company_name })));
            }
        } catch (err) {
            console.error('Failed to load customers:', err);
        }
    }

    async function loadAllowanceTypes() {
        try {
            const response = await fetch(`${API_URL}/employees/allowance-types/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAllowanceTypes(data.results || data);
            }
        } catch (err) {
            console.error('Failed to load allowance types:', err);
        }
    }

    async function handleApprove(id: string) {
        try {
            await api.approveWorkEntry(id);
            await loadWorkLogs();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to approve');
        }
    }

    async function handleReject(id: string) {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await api.rejectWorkEntry(id, reason);
            await loadWorkLogs();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this work log? This action cannot be undone.')) {
            return;
        }
        try {
            await api.deleteWorkEntry(id);
            await loadWorkLogs();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete');
        }
    }

    // Bulk selection functions
    const displayedLogs = filter === 'pending' ? pendingLogs : workLogs;

    function toggleSelectAll() {
        if (selectedIds.size === displayedLogs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayedLogs.map(log => log.id)));
        }
    }

    function toggleSelectOne(id: string) {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} work log(s)? This action cannot be undone.`)) {
            return;
        }
        try {
            for (const id of selectedIds) {
                await api.deleteWorkEntry(id);
            }
            setSelectedIds(new Set());
            await loadWorkLogs();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete some work logs');
        }
    }

    async function handleBulkApprove() {
        if (selectedIds.size === 0) return;

        // Filter out already approved/cancelled entries
        const approvableIds = Array.from(selectedIds).filter(id => {
            const log = workLogs.find((w: WorkEntry) => w.id === id);
            return log && log.status !== 'approved' && log.status !== 'cancelled';
        });

        if (approvableIds.length === 0) {
            alert('No work logs can be approved. All selected entries are already approved or cancelled.');
            return;
        }

        // Check if any are not in pending/submitted status (need warning)
        const nonPendingCount = approvableIds.filter(id => {
            const log = workLogs.find((w: WorkEntry) => w.id === id);
            return log && !['pending', 'submitted'].includes(log.status);
        }).length;

        let confirmMsg = `Are you sure you want to approve ${approvableIds.length} work log(s)?`;
        if (nonPendingCount > 0) {
            confirmMsg = `⚠️ WARNING: ${nonPendingCount} work log(s) are not in pending status and will be force-approved.\n\nApprove ${approvableIds.length} work log(s)?`;
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            let approvedCount = 0;
            const errors: string[] = [];

            for (const id of approvableIds) {
                try {
                    await api.approveWorkEntry(id);
                    approvedCount++;
                } catch (err) {
                    errors.push(err instanceof Error ? err.message : 'Unknown error');
                }
            }

            setSelectedIds(new Set());
            await loadWorkLogs();

            if (errors.length > 0) {
                alert(`Approved ${approvedCount} work log(s). ${errors.length} failed.`);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to approve some work logs');
        }
    }

    // Modal functions
    function openModal() {
        setFormData({
            employee: '',
            customer: '',
            project: '',
            supervisor: '',
            service: '',
            location_override: '',
            start_datetime: new Date().toISOString().slice(0, 16),
            end_datetime: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16),
            break_start_time: '12:00',
            break_end_time: '12:30',
            notes: '',
            status: 'draft',
        });
        setAllowances([]);
        setSupervisors([]);
        setServices([]);
        setEmployeeSearch('');
        setShowEmployeeDropdown(false);
        setEditingId(null);
        setShowModal(true);
    }

    async function openEditModal(log: WorkEntry) {
        // Fetch fresh data from API to ensure we have the latest values
        let freshLog = log;
        try {
            const response = await fetch(`${API_URL}/worklogs/${log.id}/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                freshLog = await response.json();
            }
        } catch (err) {
            console.error('Failed to fetch fresh worklog data:', err);
            // Fall back to cached log data
        }

        // Populate form with fresh worklog data
        const employeeObj = employees.find(e => e.id === (freshLog as any).employee);

        // Get customer from project (worklog doesn't store customer directly)
        const projectId = (freshLog as any).project || '';
        const projectObj = projects.find(p => p.id === projectId);
        const customerId = (projectObj as any)?.customer || '';

        // Helper to convert ISO datetime string to datetime-local format (YYYY-MM-DDTHH:mm)
        // Backend now returns local time without timezone suffix, so just slice to 16 chars
        const toLocalDatetimeString = (isoString: string | null | undefined): string => {
            if (!isoString) return new Date().toISOString().slice(0, 16);
            // Backend returns "2026-01-20T20:00:00" (no timezone), just slice to get "2026-01-20T20:00"
            return isoString.slice(0, 16);
        };

        setFormData({
            employee: (freshLog as any).employee || '',
            customer: customerId,
            project: projectId,
            supervisor: (freshLog as any).supervisor || '',
            service: (freshLog as any).service || '',
            location_override: freshLog.location || '',
            start_datetime: freshLog.actual_start_datetime
                ? toLocalDatetimeString(freshLog.actual_start_datetime)
                : (freshLog.work_date && freshLog.planned_start_time ? `${freshLog.work_date}T${freshLog.planned_start_time.substring(0, 5)}` : new Date().toISOString().slice(0, 16)),
            end_datetime: freshLog.actual_end_datetime
                ? toLocalDatetimeString(freshLog.actual_end_datetime)
                : (freshLog.work_date && freshLog.planned_end_time ? `${freshLog.work_date}T${freshLog.planned_end_time.substring(0, 5)}` : new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16)),
            break_start_time: (freshLog as any).break_start_time?.substring(0, 5) || '12:00',
            break_end_time: (freshLog as any).break_end_time?.substring(0, 5) || '12:30',
            notes: (freshLog as any).notes || '',
            status: freshLog.status || 'draft',
        });

        // Map existing allowances with time fields
        if ((freshLog as any).allowances?.length > 0) {
            setAllowances((freshLog as any).allowances.map((a: any) => ({
                allowance_type: a.allowance_type,
                custom_allowance_name: a.custom_allowance_name || '',
                hours: String(a.hours || ''),
                notes: a.notes || '',
                start_time: a.start_time || '',
                end_time: a.end_time || '',
            })));
        } else {
            setAllowances([]);
        }

        // Load supervisors and services if project is set
        if (projectId) {
            await loadCustomerData(projectId);
        }

        setEmployeeSearch(employeeObj?.full_name || freshLog.employee_name || '');
        setShowEmployeeDropdown(false);
        setEditingId(freshLog.id);
        setShowModal(true);
    }

    function addAllowance() {
        setAllowances([...allowances, {
            allowance_type: null,
            custom_allowance_name: '',
            hours: '',
            notes: '',
        }]);
    }

    function updateAllowance(index: number, field: keyof WorkLogAllowance, value: string | number | null) {
        const updated = [...allowances];
        (updated[index] as any)[field] = value;
        // Clear custom name if selecting a type
        if (field === 'allowance_type' && value !== null) {
            updated[index].custom_allowance_name = '';
        }
        setAllowances(updated);
    }

    function removeAllowance(index: number) {
        setAllowances(allowances.filter((_, i) => i !== index));
    }

    async function handleSubmit() {
        // Validation
        if (!formData.employee) {
            alert('Please select an employee');
            return;
        }
        if (!formData.customer) {
            alert('Please select a customer');
            return;
        }
        if (!formData.project) {
            alert('Please select a project');
            return;
        }
        if (!formData.break_start_time || !formData.break_end_time) {
            alert('Please enter break start and end times');
            return;
        }

        setSaving(true);
        try {
            // Extract work_date from start datetime (YYYY-MM-DD)
            const workDate = formData.start_datetime?.split('T')[0] || '';

            // Send datetime exactly as entered - backend handles timezone via TIME_ZONE setting
            const payload: any = {
                project: formData.project,
                employee: formData.employee,
                work_date: workDate,  // Required field
                start_datetime: formData.start_datetime,  // e.g., "2026-01-20T20:00"
                end_datetime: formData.end_datetime,      // e.g., "2026-01-21T04:30"
                break_start_time: formData.break_start_time,
                break_end_time: formData.break_end_time,
                notes: formData.notes,
                location_override: formData.location_override,
                status: formData.status,
                allowances: allowances.filter(a => a.hours && (a.allowance_type || a.custom_allowance_name)).map(a => ({
                    allowance_type: a.allowance_type,
                    custom_allowance_name: a.custom_allowance_name,
                    hours: parseFloat(a.hours),
                    notes: a.notes,
                    start_time: a.start_time || null,
                    end_time: a.end_time || null,
                })),
            };

            // Include optional fields if set
            if (formData.supervisor) payload.supervisor = formData.supervisor;
            if (formData.service) payload.service = formData.service;

            const url = editingId ? `${API_URL}/worklogs/${editingId}/` : `${API_URL}/worklogs/`;
            const method = editingId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setShowModal(false);
                setEditingId(null);
                await loadWorkLogs();
            } else {
                const error = await response.json();
                alert(JSON.stringify(error));
            }
        } catch (err) {
            alert(editingId ? 'Failed to update work log' : 'Failed to create work log');
        } finally {
            setSaving(false);
        }
    }

    const displayLogs = filter === 'pending' ? pendingLogs : workLogs;
    const filteredLogs = displayLogs.filter(log => {
        // Text search
        if (search &&
            !log.employee_name?.toLowerCase().includes(search.toLowerCase()) &&
            !log.project_name?.toLowerCase().includes(search.toLowerCase())) {
            return false;
        }
        // Customer filter
        if (filterCustomer) {
            const project = projects.find(p => p.id === (log as any).project);
            if ((project as any)?.customer !== filterCustomer) return false;
        }
        // Supervisor filter
        if (filterSupervisor && (log as any).supervisor !== filterSupervisor) return false;
        // Employee filter (multi-select: if array has items, check if employee is in array)
        if (filterEmployees.length > 0 && !filterEmployees.includes((log as any).employee)) return false;
        // Week range filter
        if (filterStartWeek || filterEndWeek) {
            const logDate = log.work_date;
            if (filterStartWeek) {
                const startDate = getWeekStartDate(filterStartWeek);
                if (logDate < startDate) return false;
            }
            if (filterEndWeek) {
                const endDate = getWeekEndDate(filterEndWeek);
                if (logDate > endDate) return false;
            }
        }
        // Date range filter (takes priority if set)
        if (filterStartDate && log.work_date < filterStartDate) return false;
        if (filterEndDate && log.work_date > filterEndDate) return false;
        // Status filter (multi-select: if array has items, check if status is in array)
        if (filterStatuses.length > 0 && !filterStatuses.includes(log.status)) return false;
        return true;
    });

    const stats = {
        total: workLogs.length,
        pending: workLogs.filter(w => w.status === 'pending').length,
        approved: workLogs.filter(w => w.status === 'approved').length,
        rejected: workLogs.filter(w => w.status === 'rejected').length,
    };

    return (
        <DashboardLayout>
            <div style={{ padding: '24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Work Logs</h1>
                        <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>Review and approve employee work submissions</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => router.push('/dashboard/worklogs/add')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 18px',
                                backgroundColor: '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={18} />
                            Add Work Log
                        </button>
                        <button
                            onClick={loadWorkLogs}
                            style={{
                                padding: '10px 18px',
                                backgroundColor: '#1E3A5F',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats - Matching Employees page */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '20px',
                    marginBottom: '24px'
                }}>
                    {/* Total Logs Card */}
                    <div
                        onClick={() => { setFilterStatuses([]); setFilter('all'); }}
                        style={{
                            padding: '20px',
                            background: 'linear-gradient(to bottom right, #eff6ff, #ffffff)',
                            borderRadius: '12px',
                            border: filterStatuses.length === 0 ? '2px solid #2563eb' : '1px solid #dbeafe',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#dbeafe', borderRadius: '12px' }}>
                                <Clock style={{ width: '24px', height: '24px', color: '#2563eb' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>Total Logs</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>{stats.total}</p>
                            </div>
                        </div>
                    </div>
                    {/* Pending Card */}
                    <div
                        onClick={() => { setFilterStatuses(['pending']); setFilter('all'); }}
                        style={{
                            padding: '20px',
                            background: 'linear-gradient(to bottom right, #fefce8, #ffffff)',
                            borderRadius: '12px',
                            border: filterStatuses.includes('pending') && filterStatuses.length === 1 ? '2px solid #ca8a04' : '1px solid #fde68a',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '12px' }}>
                                <AlertCircle style={{ width: '24px', height: '24px', color: '#ca8a04' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>Pending</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#ca8a04', margin: 0 }}>{stats.pending}</p>
                            </div>
                        </div>
                    </div>
                    {/* Approved Card */}
                    <div
                        onClick={() => { setFilterStatuses(['approved']); setFilter('all'); }}
                        style={{
                            padding: '20px',
                            background: 'linear-gradient(to bottom right, #f0fdf4, #ffffff)',
                            borderRadius: '12px',
                            border: filterStatuses.includes('approved') && filterStatuses.length === 1 ? '2px solid #16a34a' : '1px solid #bbf7d0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#dcfce7', borderRadius: '12px' }}>
                                <CheckCircle style={{ width: '24px', height: '24px', color: '#16a34a' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>Approved</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a', margin: 0 }}>{stats.approved}</p>
                            </div>
                        </div>
                    </div>
                    {/* Rejected Card */}
                    <div
                        onClick={() => { setFilterStatuses(['rejected']); setFilter('all'); }}
                        style={{
                            padding: '20px',
                            background: 'linear-gradient(to bottom right, #fef2f2, #ffffff)',
                            borderRadius: '12px',
                            border: filterStatuses.includes('rejected') && filterStatuses.length === 1 ? '2px solid #dc2626' : '1px solid #fecaca',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '12px' }}>
                                <XCircle style={{ width: '24px', height: '24px', color: '#dc2626' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, margin: 0 }}>Rejected</p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626', margin: 0 }}>{stats.rejected}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '16px',
                    marginBottom: '24px',
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {(['all', 'pending'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s',
                                        backgroundColor: filter === status
                                            ? (status === 'pending' ? '#F97316' : '#1E3A5F')
                                            : '#F3F4F6',
                                        color: filter === status ? '#FFFFFF' : '#4B5563',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: filter === status ? '0 4px 12px rgba(30, 58, 95, 0.25)' : 'none',
                                    }}
                                >
                                    {status === 'pending' ? 'Pending Approval' : 'All Work Logs'}
                                </button>
                            ))}
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
                                placeholder="Search work logs..."
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
                            />
                        </div>
                        {/* Advanced Filter Toggle */}
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            style={{
                                padding: '10px 16px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: showAdvancedFilters ? 'white' : '#1E3A5F',
                                backgroundColor: showAdvancedFilters ? '#1E3A5F' : 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
                            </svg>
                            Filters {(filterCustomer || filterSupervisor || filterEmployees.length > 0 || filterStartWeek || filterEndWeek) && '•'}
                        </button>
                    </div>

                    {/* Advanced Filters Panel */}
                    {showAdvancedFilters && (
                        <div style={{
                            marginTop: '16px',
                            padding: '24px',
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '20px',
                                alignItems: 'start',
                            }}>
                                {/* Customer Filter - Searchable */}
                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Customer</label>
                                    {filterCustomer ? (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            backgroundColor: '#EFF6FF',
                                            border: '1px solid #BFDBFE',
                                            borderRadius: '10px',
                                        }}>
                                            <span style={{ flex: 1, fontSize: '14px', color: '#1E40AF', fontWeight: 500 }}>
                                                {customers.find(c => c.id === filterCustomer)?.company_name}
                                            </span>
                                            <button
                                                onClick={() => { setFilterCustomer(''); setFilterSupervisors([]); setFilterSupervisor(''); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: '16px' }}
                                            >✕</button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Search customers..."
                                                value={customerSearchFilter}
                                                onChange={(e) => setCustomerSearchFilter(e.target.value)}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 14px',
                                                    fontSize: '14px',
                                                    borderRadius: '10px',
                                                    border: '1px solid #D1D5DB',
                                                    backgroundColor: '#FAFAFA',
                                                    outline: 'none',
                                                }}
                                            />
                                            {showCustomerDropdown && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        marginTop: '4px',
                                                        backgroundColor: 'white',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                                        zIndex: 50,
                                                        maxHeight: '200px',
                                                        overflowY: 'auto',
                                                    }}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    {customers
                                                        .filter(c => c.company_name.toLowerCase().includes(customerSearchFilter.toLowerCase()))
                                                        .slice(0, 10)
                                                        .map(c => (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setFilterCustomer(c.id);
                                                                    setCustomerSearchFilter('');
                                                                    setShowCustomerDropdown(false);
                                                                    loadFilterSupervisors(c.id);
                                                                }}
                                                                style={{
                                                                    padding: '10px 14px',
                                                                    cursor: 'pointer',
                                                                    borderBottom: '1px solid #F3F4F6',
                                                                    fontSize: '14px',
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                            >
                                                                {c.company_name}
                                                            </div>
                                                        ))
                                                    }
                                                    {customers.filter(c => c.company_name.toLowerCase().includes(customerSearchFilter.toLowerCase())).length === 0 && (
                                                        <div style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: '14px' }}>No customers found</div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Supervisor Filter - Searchable */}
                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                                        Supervisor {filterCustomer && <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>(for selected customer)</span>}
                                    </label>
                                    {filterSupervisor ? (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            backgroundColor: '#D1FAE5',
                                            border: '1px solid #6EE7B7',
                                            borderRadius: '10px',
                                        }}>
                                            <span style={{ flex: 1, fontSize: '14px', color: '#065F46', fontWeight: 500 }}>
                                                {filterSupervisors.find(s => s.id === filterSupervisor)?.full_name}
                                            </span>
                                            <button
                                                onClick={() => setFilterSupervisor('')}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: '16px' }}
                                            >✕</button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                placeholder={filterCustomer ? "Search supervisors..." : "Select customer first"}
                                                value={supervisorSearchFilter}
                                                onChange={(e) => setSupervisorSearchFilter(e.target.value)}
                                                onFocus={() => filterCustomer && setShowSupervisorDropdown(true)}
                                                disabled={!filterCustomer}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 14px',
                                                    fontSize: '14px',
                                                    borderRadius: '10px',
                                                    border: '1px solid #D1D5DB',
                                                    backgroundColor: filterCustomer ? '#FAFAFA' : '#F3F4F6',
                                                    outline: 'none',
                                                    opacity: filterCustomer ? 1 : 0.6,
                                                    cursor: filterCustomer ? 'text' : 'not-allowed',
                                                }}
                                            />
                                            {showSupervisorDropdown && filterCustomer && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        marginTop: '4px',
                                                        backgroundColor: 'white',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                                        zIndex: 50,
                                                        maxHeight: '200px',
                                                        overflowY: 'auto',
                                                    }}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    {filterSupervisors
                                                        .filter(s => s.full_name.toLowerCase().includes(supervisorSearchFilter.toLowerCase()))
                                                        .slice(0, 10)
                                                        .map(s => (
                                                            <div
                                                                key={s.id}
                                                                onClick={() => {
                                                                    setFilterSupervisor(s.id);
                                                                    setSupervisorSearchFilter('');
                                                                    setShowSupervisorDropdown(false);
                                                                }}
                                                                style={{
                                                                    padding: '10px 14px',
                                                                    cursor: 'pointer',
                                                                    borderBottom: '1px solid #F3F4F6',
                                                                    fontSize: '14px',
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                            >
                                                                {s.full_name}
                                                            </div>
                                                        ))
                                                    }
                                                    {filterSupervisors.filter(s => s.full_name.toLowerCase().includes(supervisorSearchFilter.toLowerCase())).length === 0 && (
                                                        <div style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: '14px' }}>No supervisors found</div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Week Range - From */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>From Week</label>
                                    <input
                                        type="week"
                                        value={filterStartWeek}
                                        onChange={(e) => setFilterStartWeek(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            fontSize: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid #D1D5DB',
                                            backgroundColor: '#FAFAFA',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Week Range - To */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>To Week</label>
                                    <input
                                        type="week"
                                        value={filterEndWeek}
                                        onChange={(e) => setFilterEndWeek(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            fontSize: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid #D1D5DB',
                                            backgroundColor: '#FAFAFA',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Date Range - From */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>From Date</label>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            fontSize: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid #D1D5DB',
                                            backgroundColor: '#FAFAFA',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Date Range - To */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>To Date</label>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            fontSize: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid #D1D5DB',
                                            backgroundColor: '#FAFAFA',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Employee Multi-Select with Searchable Dropdown */}
                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                        Employees {filterEmployees.length > 0 ? <span style={{ color: '#3B82F6', fontWeight: 500 }}>({filterEmployees.length} selected)</span> : <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(All)</span>}
                                    </label>
                                    {filterEmployees.length > 0 && (
                                        <button
                                            onClick={() => setFilterEmployees([])}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '12px',
                                                color: '#DC2626',
                                                backgroundColor: '#FEE2E2',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>

                                {/* Selected Employees as Chips */}
                                {filterEmployees.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                        {filterEmployees.map(empId => {
                                            const emp = employees.find(e => e.id === empId);
                                            return emp ? (
                                                <div key={empId} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    backgroundColor: '#EFF6FF',
                                                    border: '1px solid #BFDBFE',
                                                    borderRadius: '20px',
                                                    fontSize: '13px',
                                                    color: '#1D4ED8',
                                                }}>
                                                    {emp.full_name}
                                                    <button
                                                        onClick={() => setFilterEmployees(filterEmployees.filter(id => id !== empId))}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '0',
                                                            display: 'flex',
                                                            color: '#3B82F6',
                                                        }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {/* Searchable Dropdown */}
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Search and select employees..."
                                        value={employeeSearchFilter}
                                        onChange={(e) => setEmployeeSearchFilter(e.target.value)}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            fontSize: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid #D1D5DB',
                                            backgroundColor: '#FAFAFA',
                                            outline: 'none',
                                        }}
                                    />
                                    {showEmployeeDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: 'white',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '10px',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 100,
                                            marginTop: '4px',
                                        }}>
                                            {/* All option */}
                                            <div
                                                onClick={() => {
                                                    setFilterEmployees([]);
                                                    setShowEmployeeDropdown(false);
                                                    setEmployeeSearchFilter('');
                                                }}
                                                style={{
                                                    padding: '10px 14px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    backgroundColor: filterEmployees.length === 0 ? '#EFF6FF' : 'white',
                                                    borderBottom: '1px solid #F3F4F6',
                                                }}
                                            >
                                                All Employees
                                            </div>
                                            {employees
                                                .filter(emp => emp.full_name.toLowerCase().includes(employeeSearchFilter.toLowerCase()))
                                                .map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => {
                                                            if (!filterEmployees.includes(emp.id)) {
                                                                setFilterEmployees([...filterEmployees, emp.id]);
                                                            }
                                                            setEmployeeSearchFilter('');
                                                        }}
                                                        style={{
                                                            padding: '10px 14px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            backgroundColor: filterEmployees.includes(emp.id) ? '#EFF6FF' : 'white',
                                                        }}
                                                    >
                                                        {emp.full_name}
                                                        {filterEmployees.includes(emp.id) && (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="3">
                                                                <polyline points="20,6 9,17 4,12"></polyline>
                                                            </svg>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                {showEmployeeDropdown && (
                                    <div
                                        onClick={() => setShowEmployeeDropdown(false)}
                                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                                    />
                                )}
                            </div>

                            {/* Status Multi-Select Filter */}
                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                        Status {filterStatuses.length > 0 ? <span style={{ color: '#3B82F6', fontWeight: 500 }}>({filterStatuses.length} selected)</span> : <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(All)</span>}
                                    </label>
                                    {filterStatuses.length > 0 && (
                                        <button
                                            onClick={() => setFilterStatuses([])}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '12px',
                                                color: '#DC2626',
                                                backgroundColor: '#FEE2E2',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {[
                                        { value: 'draft', label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
                                        { value: 'pending', label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
                                        { value: 'approved', label: 'Approved', color: '#10B981', bg: '#D1FAE5' },
                                        { value: 'rejected', label: 'Rejected', color: '#EF4444', bg: '#FEE2E2' },
                                    ].map(statusOption => (
                                        <label
                                            key={statusOption.value}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 14px',
                                                backgroundColor: filterStatuses.includes(statusOption.value) ? statusOption.bg : '#F9FAFB',
                                                border: `1px solid ${filterStatuses.includes(statusOption.value) ? statusOption.color : '#E5E7EB'}`,
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: filterStatuses.includes(statusOption.value) ? 600 : 400,
                                                color: filterStatuses.includes(statusOption.value) ? statusOption.color : '#6B7280',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={filterStatuses.includes(statusOption.value)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFilterStatuses([...filterStatuses, statusOption.value]);
                                                    } else {
                                                        setFilterStatuses(filterStatuses.filter(s => s !== statusOption.value));
                                                    }
                                                }}
                                                style={{ display: 'none' }}
                                            />
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: statusOption.color,
                                            }} />
                                            {statusOption.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Clear Button */}
                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setFilterCustomer('');
                                        setFilterSupervisor('');
                                        setFilterSupervisors([]);
                                        setFilterEmployees([]);
                                        setFilterStartWeek('');
                                        setFilterEndWeek('');
                                        setFilterStartDate('');
                                        setFilterEndDate('');
                                        setFilterStatuses([]);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: '#DC2626',
                                        backgroundColor: 'white',
                                        border: '1px solid #FECACA',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                    <div style={{
                        backgroundColor: '#1E3A5F',
                        borderRadius: '12px',
                        padding: '16px 24px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="checkbox"
                                checked={selectedIds.size === displayedLogs.length}
                                onChange={toggleSelectAll}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>
                                {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
                            </span>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94A3B8',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                Clear selection
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleBulkApprove}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    backgroundColor: '#10B981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Check size={16} />
                                Approve All
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    backgroundColor: '#EF4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Trash2 size={16} />
                                Delete All
                            </button>
                        </div>
                    </div>
                )}

                {/* Work Logs Table */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A5F]"></div>
                        </div>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                        <tr>
                                            <th style={{ padding: '16px 12px', width: '50px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size > 0 && selectedIds.size === displayedLogs.length}
                                                    onChange={toggleSelectAll}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                            </th>
                                            <th style={{ padding: '16px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Employee</th>
                                            <th style={{ padding: '16px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Customer</th>
                                            <th style={{ padding: '16px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Project</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Date</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Time</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Pause</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Hours</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Allowances</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Price</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '16px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={12} style={{ padding: '48px 24px', textAlign: 'center', color: '#6B7280' }}>
                                                    <Clock style={{ width: '48px', height: '48px', color: '#D1D5DB', margin: '0 auto 16px' }} />
                                                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                                                        {filter === 'pending' ? 'No pending work logs' : 'No work logs found'}
                                                    </p>
                                                    <p style={{ fontSize: '14px', color: '#9CA3AF' }}>
                                                        {filter === 'pending' ? 'All work logs have been reviewed.' : 'Work logs will appear here when employees submit them.'}
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLogs.map((log) => (
                                                <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                                    <td style={{ padding: '16px 12px', width: '50px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(log.id)}
                                                            onChange={() => toggleSelectOne(log.id)}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                borderRadius: '8px',
                                                                background: 'linear-gradient(135deg, #1E3A5F, #3E5A8F)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                flexShrink: 0,
                                                            }}>
                                                                {log.employee_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'EE'}
                                                            </div>
                                                            <span style={{ fontWeight: 600, color: '#111827', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.employee_name}>
                                                                {log.employee_name && log.employee_name.length > 24 ? log.employee_name.substring(0, 24) + '...' : log.employee_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', color: '#374151' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '160px' }}>
                                                            <div style={{
                                                                width: '6px',
                                                                height: '6px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#3B82F6',
                                                                flexShrink: 0,
                                                            }} />
                                                            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.customer_name || '-'}>
                                                                {log.customer_name && log.customer_name.length > 20 ? log.customer_name.substring(0, 20) + '...' : (log.customer_name || '-')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', color: '#6B7280' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', maxWidth: '200px' }}>
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={log.project_name}>
                                                                {log.project_name && log.project_name.length > 20 ? log.project_name.substring(0, 20) + '...' : log.project_name}
                                                            </span>
                                                            {log.shift_name && (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    padding: '2px 6px',
                                                                    backgroundColor: log.shift_color || '#3B82F6',
                                                                    color: 'white',
                                                                    borderRadius: '4px',
                                                                    fontSize: '9px',
                                                                    fontWeight: 600,
                                                                }}>
                                                                    📅 {log.shift_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 12px', color: '#6B7280', whiteSpace: 'nowrap', fontSize: '13px' }}>{log.work_date}</td>
                                                    <td style={{ padding: '16px 12px', color: '#6B7280', whiteSpace: 'nowrap', fontSize: '13px' }}>{log.display_time_range || `${log.planned_start_time || ''} - ${log.planned_end_time || ''}`}</td>
                                                    <td style={{ padding: '16px 12px', color: '#6B7280', whiteSpace: 'nowrap', fontSize: '13px' }}>{(log as any).break_duration || '-'}</td>
                                                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontWeight: 600, color: '#111827' }}>{log.calculated_hours}h</span>
                                                            {(log as any).hours_breakdown?.night_hours > 0 && (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 6px',
                                                                    backgroundColor: '#1E1B4B',
                                                                    color: '#A5B4FC',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                }}>
                                                                    🌙 {(log as any).hours_breakdown.night_hours}h night
                                                                </span>
                                                            )}
                                                            {(log as any).hours_breakdown?.saturday_hours > 0 && (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 6px',
                                                                    backgroundColor: '#FEF3C7',
                                                                    color: '#92400E',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                }}>
                                                                    📅 {(log as any).hours_breakdown.saturday_hours}h Sat
                                                                </span>
                                                            )}
                                                            {(log as any).hours_breakdown?.sunday_hours > 0 && (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 6px',
                                                                    backgroundColor: '#FFEDD5',
                                                                    color: '#C2410C',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                }}>
                                                                    🔶 {(log as any).hours_breakdown.sunday_hours}h Sun
                                                                </span>
                                                            )}
                                                            {(log as any).hours_breakdown?.holiday_hours > 0 && (
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 6px',
                                                                    backgroundColor: '#FEE2E2',
                                                                    color: '#991B1B',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                }}>
                                                                    🎉 {(log as any).hours_breakdown.holiday_hours}h Holiday
                                                                </span>
                                                            )}
                                                            {/* Overtime hours badge - from surcharges_breakdown */}
                                                            {(() => {
                                                                const overtime = (log as any).surcharges_breakdown?.breakdown?.find((s: any) => s.category === 'overtime');
                                                                if (overtime && overtime.hours > 0) {
                                                                    return (
                                                                        <span style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '2px 6px',
                                                                            backgroundColor: '#FEE2E2',
                                                                            color: '#DC2626',
                                                                            borderRadius: '4px',
                                                                            fontSize: '10px',
                                                                            fontWeight: 500,
                                                                        }}>
                                                                            ⏰ {overtime.hours}h Overwerk
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        {/* Show surcharges first, then allowances */}
                                                        {((log as any).surcharges_applied?.length > 0 || (log as any).allowances?.length > 0) ? (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                {/* Surcharges (Night Shift, Weekend, etc.) */}
                                                                {(log as any).surcharges_applied?.map((s: any, i: number) => (
                                                                    <span key={`s-${i}`} style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        padding: '4px 8px',
                                                                        backgroundColor: '#1E1B4B',
                                                                        color: '#A5B4FC',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 500,
                                                                    }}>
                                                                        🌙 {s.name} +{s.percentage}%
                                                                    </span>
                                                                ))}
                                                                {/* Allowances */}
                                                                {(log as any).allowances?.slice(0, 2).map((a: any, i: number) => (
                                                                    <span key={`a-${i}`} style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        padding: '4px 8px',
                                                                        backgroundColor: '#EEF2FF',
                                                                        color: '#4F46E5',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 500,
                                                                    }}>
                                                                        <Gift size={10} />
                                                                        {a.allowance_name || a.custom_allowance_name}
                                                                    </span>
                                                                ))}
                                                                {(log as any).allowances?.length > 2 && (
                                                                    <span style={{
                                                                        padding: '4px 8px',
                                                                        backgroundColor: '#F3F4F6',
                                                                        color: '#6B7280',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                    }}>
                                                                        +{(log as any).allowances.length - 2}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#9CA3AF', fontSize: '13px' }}>-</span>
                                                        )}
                                                    </td>

                                                    {/* Price column */}
                                                    <td style={{ padding: '16px 12px' }}>
                                                        {(log as any).calculated_price && parseFloat((log as any).calculated_price) > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{
                                                                    fontSize: '13px',
                                                                    fontWeight: 700,
                                                                    color: 'white',
                                                                    backgroundColor: '#059669',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '8px',
                                                                    display: 'inline-block',
                                                                }}>
                                                                    €{parseFloat((log as any).calculated_price).toFixed(2)}
                                                                </span>
                                                                {(log as any).surcharges_applied?.length > 0 && (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                                        {(log as any).surcharges_applied.map((s: any, i: number) => (
                                                                            <span key={i} style={{
                                                                                fontSize: '9px',
                                                                                fontWeight: 500,
                                                                                color: '#7C3AED',
                                                                                backgroundColor: '#EDE9FE',
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                            }}>
                                                                                {s.name} +{s.percentage}%
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#9CA3AF', fontSize: '13px' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '6px 12px',
                                                                borderRadius: '9999px',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                backgroundColor: log.status === 'approved' ? '#DCFCE7' :
                                                                    log.status === 'pending' ? '#FEF3C7' :
                                                                        log.status === 'rejected' ? '#FEE2E2' : '#F3F4F6',
                                                                color: log.status === 'approved' ? '#16A34A' :
                                                                    log.status === 'pending' ? '#CA8A04' :
                                                                        log.status === 'rejected' ? '#DC2626' : '#6B7280',
                                                            }}
                                                        >
                                                            <span style={{
                                                                width: '6px',
                                                                height: '6px',
                                                                borderRadius: '3px',
                                                                backgroundColor: log.status === 'approved' ? '#16A34A' :
                                                                    log.status === 'pending' ? '#CA8A04' :
                                                                        log.status === 'rejected' ? '#DC2626' : '#6B7280',
                                                            }} />
                                                            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {/* Edit button - always visible */}
                                                            <button
                                                                onClick={() => router.push(`/dashboard/worklogs/${log.id}`)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '8px 14px',
                                                                    fontSize: '13px',
                                                                    fontWeight: 500,
                                                                    color: '#1E3A5F',
                                                                    backgroundColor: 'white',
                                                                    border: '1px solid #E5E7EB',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <Edit2 style={{ width: '14px', height: '14px' }} />
                                                                Edit
                                                            </button>

                                                            {/* Delete button for all statuses */}
                                                            <button
                                                                onClick={() => handleDelete(log.id)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '8px 14px',
                                                                    fontSize: '13px',
                                                                    fontWeight: 500,
                                                                    color: '#DC2626',
                                                                    backgroundColor: 'white',
                                                                    border: '1px solid #FECACA',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
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

                            {/* Summary Card - Below Table */}
                            {filteredLogs.length > 0 && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '20px 24px',
                                    background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
                                    borderRadius: '12px',
                                    border: '1px solid #BAE6FD',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                                        {/* Left Section - TOTALS badge and hours info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '6px 14px',
                                                backgroundColor: '#1E3A5F',
                                                color: 'white',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                letterSpacing: '0.5px',
                                            }}>
                                                TOTALS
                                            </span>

                                            {/* Total Hours */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', color: '#6B7280' }}>Hours:</span>
                                                <span style={{
                                                    fontSize: '18px',
                                                    fontWeight: 700,
                                                    color: '#1E3A5F',
                                                    backgroundColor: 'white',
                                                    padding: '6px 14px',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                }}>
                                                    {filteredLogs.reduce((sum, log) => sum + (parseFloat(String(log.calculated_hours)) || 0), 0).toFixed(2)}h
                                                </span>
                                            </div>

                                            {/* Night hours badge */}
                                            {(() => {
                                                const totalNightHours = filteredLogs.reduce((sum, log) => {
                                                    return sum + (parseFloat(String((log as any).hours_breakdown?.night_hours || 0)));
                                                }, 0);
                                                if (totalNightHours > 0) {
                                                    return (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '6px 12px',
                                                            backgroundColor: '#1E1B4B',
                                                            color: '#FDE68A',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                        }}>
                                                            🌙 {totalNightHours.toFixed(0)}h night
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        {/* Right Section - Surcharges info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            {/* Surcharge badges by name */}
                                            {(() => {
                                                const surchargesByName: { [name: string]: { hours: number, category: string } } = {};
                                                filteredLogs.forEach(log => {
                                                    const breakdown = (log as any).surcharges_breakdown?.breakdown || [];
                                                    breakdown.forEach((s: any) => {
                                                        const name = s.name || 'Unknown';
                                                        const hours = parseFloat(s.hours) || 0;
                                                        if (!surchargesByName[name]) {
                                                            surchargesByName[name] = { hours: 0, category: s.category };
                                                        }
                                                        surchargesByName[name].hours += hours;
                                                    });
                                                });
                                                return Object.entries(surchargesByName).map(([name, data]) => (
                                                    <span key={name} style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '6px 12px',
                                                        backgroundColor: data.category === 'night_shift' ? '#1E1B4B' :
                                                            data.category === 'saturday' ? '#FEF3C7' :
                                                                data.category === 'sunday' ? '#FFEDD5' :
                                                                    data.category === 'overtime' ? '#FEE2E2' : '#FEE2E2',
                                                        color: data.category === 'night_shift' ? '#A5B4FC' :
                                                            data.category === 'saturday' ? '#92400E' :
                                                                data.category === 'sunday' ? '#C2410C' :
                                                                    data.category === 'overtime' ? '#DC2626' : '#991B1B',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                    }}>
                                                        {name} {data.hours}h
                                                    </span>
                                                ));
                                            })()}

                                            {/* Surcharge amount */}
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#10B981' }}>
                                                +€{filteredLogs.reduce((sum, log) => {
                                                    const surcharges = (log as any).surcharges_breakdown;
                                                    return sum + (surcharges?.total_surcharge_amount ? parseFloat(surcharges.total_surcharge_amount) : 0);
                                                }, 0).toFixed(2)}
                                            </span>

                                            <span style={{ color: '#D1D5DB', fontSize: '18px' }}>|</span>

                                            {/* Base amount */}
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E3A5F' }}>
                                                €{filteredLogs.reduce((sum, log) => {
                                                    const surcharges = (log as any).surcharges_breakdown;
                                                    const hours = parseFloat(String(log.calculated_hours)) || 0;
                                                    return sum + (hours * (surcharges?.base_rate || 0));
                                                }, 0).toFixed(2)}
                                            </span>

                                            <span style={{ color: '#D1D5DB', fontSize: '18px' }}>|</span>

                                            {/* Total revenue */}
                                            <span style={{
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                color: 'white',
                                                backgroundColor: '#059669',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                            }}>
                                                €{filteredLogs.reduce((sum, log) => {
                                                    const surcharges = (log as any).surcharges_breakdown;
                                                    const hours = parseFloat(String(log.calculated_hours)) || 0;
                                                    const base = hours * (surcharges?.base_rate || 0);
                                                    const surchargeAmount = surcharges?.total_surcharge_amount ? parseFloat(surcharges.total_surcharge_amount) : 0;
                                                    const allowancesAmount = surcharges?.total_allowances_amount ? parseFloat(surcharges.total_allowances_amount) : 0;
                                                    return sum + base + surchargeAmount + allowancesAmount;
                                                }, 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div >
            </div >

            {/* Create Work Log Modal */}
            {
                showModal && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}
                        onClick={() => setShowModal(false)}
                    >
                        <div
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflow: 'auto',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>
                                {editingId ? 'Edit Work Log' : 'Add Work Log'}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Employee (searchable) */}
                                <div style={{ position: 'relative' }}>
                                    <label style={labelStyle}>Employee *</label>
                                    <input
                                        type="text"
                                        value={employeeSearch}
                                        onChange={(e) => {
                                            setEmployeeSearch(e.target.value);
                                            setShowEmployeeDropdown(true);
                                            // Clear selection if user is typing
                                            if (formData.employee) {
                                                const selectedEmp = employees.find(emp => emp.id === formData.employee);
                                                if (selectedEmp && !selectedEmp.full_name.toLowerCase().includes(e.target.value.toLowerCase())) {
                                                    setFormData({ ...formData, employee: '' });
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                        placeholder="Search employee..."
                                        style={inputStyle}
                                    />
                                    {showEmployeeDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            backgroundColor: 'white',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            zIndex: 1000,
                                        }}>
                                            {employees
                                                .filter(emp => emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                                .map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => {
                                                            setFormData({ ...formData, employee: emp.id });
                                                            setEmployeeSearch(emp.full_name);
                                                            setShowEmployeeDropdown(false);
                                                        }}
                                                        style={{
                                                            padding: '10px 14px',
                                                            cursor: 'pointer',
                                                            backgroundColor: formData.employee === emp.id ? '#EFF6FF' : 'white',
                                                            borderBottom: '1px solid #F3F4F6',
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = formData.employee === emp.id ? '#EFF6FF' : 'white')}
                                                    >
                                                        {emp.full_name}
                                                    </div>
                                                ))}
                                            {employees.filter(emp => emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: '10px 14px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    No employees found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Customer (select first) */}
                                <div>
                                    <label style={labelStyle}>Customer *</label>
                                    <select
                                        value={formData.customer}
                                        onChange={(e) => {
                                            setFormData({ ...formData, customer: e.target.value, project: '', supervisor: '', service: '' });
                                            setSupervisors([]);
                                            setServices([]);
                                        }}
                                        style={inputStyle}
                                    >
                                        <option value="">Select customer...</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Project (filtered by customer) */}
                                {formData.customer && (
                                    <div>
                                        <label style={labelStyle}>Project *</label>
                                        <select
                                            value={formData.project}
                                            onChange={(e) => {
                                                setFormData({ ...formData, project: e.target.value, supervisor: '', service: '' });
                                                loadCustomerData(e.target.value);
                                            }}
                                            style={inputStyle}
                                        >
                                            <option value="">Select project...</option>
                                            {projects
                                                .filter((p: any) => String(p.customer) === String(formData.customer) || String(p.customer_id) === String(formData.customer))
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                {/* Supervisor (shows when project selected) */}
                                {formData.project && supervisors.length > 0 && (
                                    <div>
                                        <label style={labelStyle}>Supervisor *</label>
                                        <select
                                            value={formData.supervisor}
                                            onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                                            style={inputStyle}
                                        >
                                            <option value="">Select supervisor...</option>
                                            {supervisors.map(s => (
                                                <option key={s.id} value={s.id}>{s.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Service (shows when project selected) */}
                                {formData.project && services.length > 0 && (
                                    <div>
                                        <label style={labelStyle}>Service Type *</label>
                                        <select
                                            value={formData.service}
                                            onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                                            style={inputStyle}
                                        >
                                            <option value="">Select service...</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Location Override */}
                                {formData.project && (
                                    <div>
                                        <label style={labelStyle}>Location (optional)</label>
                                        <input
                                            type="text"
                                            value={formData.location_override}
                                            onChange={(e) => setFormData({ ...formData, location_override: e.target.value })}
                                            placeholder="Enter work location..."
                                            style={inputStyle}
                                        />
                                    </div>
                                )}

                                {/* Start Date/Time */}
                                <div>
                                    <label style={labelStyle}>Start Date/Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.start_datetime}
                                        onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>

                                {/* End Date/Time */}
                                <div>
                                    <label style={labelStyle}>End Date/Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.end_datetime}
                                        onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>

                                {/* Break Time */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Break Start *</label>
                                        <input
                                            type="time"
                                            value={formData.break_start_time}
                                            onChange={(e) => setFormData({ ...formData, break_start_time: e.target.value })}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Break End *</label>
                                        <input
                                            type="time"
                                            value={formData.break_end_time}
                                            onChange={(e) => setFormData({ ...formData, break_end_time: e.target.value })}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label style={labelStyle}>Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Optional notes..."
                                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                                    />
                                </div>

                                {/* Allowances Section */}
                                <div style={{
                                    padding: '20px',
                                    backgroundColor: '#F9FAFB',
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Gift size={18} style={{ color: '#8B5CF6' }} />
                                            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Allowances (Toeslag)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addAllowance}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 14px',
                                                backgroundColor: '#8B5CF6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <Plus size={14} />
                                            Add Allowance
                                        </button>
                                    </div>

                                    {allowances.length === 0 ? (
                                        <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                                            No allowances added. Click "Add Allowance" to add one.
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {allowances.map((allowance, index) => (
                                                <div key={index} style={{
                                                    padding: '16px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '10px',
                                                    border: '1px solid #E5E7EB',
                                                }}>
                                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                                        <div style={{ flex: 2 }}>
                                                            <label style={{ ...labelStyle, fontSize: '12px' }}>Allowance Type</label>
                                                            <select
                                                                value={allowance.allowance_type || ''}
                                                                onChange={(e) => updateAllowance(index, 'allowance_type', e.target.value ? parseInt(e.target.value) : null)}
                                                                style={{ ...inputStyle, padding: '10px 12px' }}
                                                            >
                                                                <option value="">Custom / Other</option>
                                                                {allowanceTypes.map(at => (
                                                                    <option key={at.id} value={at.id}>
                                                                        {at.name} (€{at.base_price}/hr)
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ ...labelStyle, fontSize: '12px' }}>Hours</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.5"
                                                                value={allowance.hours}
                                                                onChange={(e) => updateAllowance(index, 'hours', e.target.value)}
                                                                placeholder="4.5"
                                                                style={{ ...inputStyle, padding: '10px 12px' }}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeAllowance(index)}
                                                            style={{
                                                                alignSelf: 'flex-end',
                                                                padding: '10px',
                                                                backgroundColor: '#FEE2E2',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Trash2 size={16} style={{ color: '#DC2626' }} />
                                                        </button>
                                                    </div>

                                                    {/* From/To Time for auto-calculating hours */}
                                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ ...labelStyle, fontSize: '12px' }}>From Time</label>
                                                            <input
                                                                type="time"
                                                                value={allowance.start_time || ''}
                                                                onChange={(e) => {
                                                                    const start = e.target.value;
                                                                    updateAllowance(index, 'start_time', start);
                                                                    // Auto-calculate hours if both times set
                                                                    if (start && allowance.end_time) {
                                                                        const [sh, sm] = start.split(':').map(Number);
                                                                        const [eh, em] = allowance.end_time.split(':').map(Number);
                                                                        let hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
                                                                        if (hours < 0) hours += 24; // overnight
                                                                        updateAllowance(index, 'hours', hours.toFixed(2));
                                                                    }
                                                                }}
                                                                style={{ ...inputStyle, padding: '10px 12px' }}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ ...labelStyle, fontSize: '12px' }}>To Time</label>
                                                            <input
                                                                type="time"
                                                                value={allowance.end_time || ''}
                                                                onChange={(e) => {
                                                                    const end = e.target.value;
                                                                    updateAllowance(index, 'end_time', end);
                                                                    // Auto-calculate hours if both times set
                                                                    if (allowance.start_time && end) {
                                                                        const [sh, sm] = allowance.start_time.split(':').map(Number);
                                                                        const [eh, em] = end.split(':').map(Number);
                                                                        let hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
                                                                        if (hours < 0) hours += 24; // overnight
                                                                        updateAllowance(index, 'hours', hours.toFixed(2));
                                                                    }
                                                                }}
                                                                style={{ ...inputStyle, padding: '10px 12px' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {!allowance.allowance_type && (
                                                        <div>
                                                            <label style={{ ...labelStyle, fontSize: '12px' }}>Custom Allowance Name</label>
                                                            <input
                                                                type="text"
                                                                value={allowance.custom_allowance_name}
                                                                onChange={(e) => updateAllowance(index, 'custom_allowance_name', e.target.value)}
                                                                placeholder="Enter custom allowance name..."
                                                                style={{ ...inputStyle, padding: '10px 12px' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        backgroundColor: '#F3F4F6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving || !formData.project}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        backgroundColor: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        opacity: saving ? 0.7 : 1,
                                    }}
                                >
                                    {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Work Log')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </DashboardLayout >
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
    backgroundColor: 'white',
};

