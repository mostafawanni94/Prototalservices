'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { ArrowLeft, Plus, Gift, Trash2, Coffee, User, Building2, Briefcase, MapPin, Clock, FileText, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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

interface Employee {
    id: string;
    full_name: string;
}

interface Customer {
    id: string;
    company_name: string;
}

interface Project {
    id: string;
    name: string;
    customer: string;
    location?: string;
    location_address?: string;
    location_postcode?: string;
    location_city?: string;
}

interface Supervisor {
    id: string;
    full_name: string;
    company_name?: string;
}

interface Service {
    id: string;
    name: string;
}

export default function AddWorkLogPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Form state - Multi-employee selection
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [customer, setCustomer] = useState('');
    const [project, setProject] = useState('');
    const [supervisor, setSupervisor] = useState('');
    const [service, setService] = useState('');
    const [location, setLocation] = useState('');
    const [originalLocation, setOriginalLocation] = useState('');
    const [startDatetime, setStartDatetime] = useState(new Date().toISOString().slice(0, 16));
    const [endDatetime, setEndDatetime] = useState(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16));
    const [notes, setNotes] = useState('');
    const [breaks, setBreaks] = useState<{ start: string; end: string }[]>([{ start: '12:00', end: '12:30' }]);
    const [allowances, setAllowances] = useState<WorkLogAllowance[]>([]);

    // Loading states
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingSupervisors, setLoadingSupervisors] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    // Dropdown options
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

    // Filtered options
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);

    // Search states for all dropdowns
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');

    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const headers = { 'Authorization': `Bearer ${token}` };

    // Toggle employee selection (add/remove from array)
    const toggleEmployee = (empId: string) => {
        setSelectedEmployees(prev =>
            prev.includes(empId)
                ? prev.filter(id => id !== empId)
                : [...prev, empId]
        );
    };

    // Get employee name by ID helper
    const getEmployeeName = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        return emp?.full_name || 'Employee';
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    // When customer changes, filter projects
    useEffect(() => {
        if (customer) {
            const filtered = projects.filter(p => String(p.customer) === String(customer));
            setFilteredProjects(filtered);
        } else {
            setFilteredProjects([]);
        }
        // Reset dependent fields and their search values
        setProject('');
        setProjectSearch('');
        setSupervisor('');
        setSupervisorSearch('');
        setService('');
        setServiceSearch('');
        setLocation('');
        setSupervisors([]);
        setServices([]);
    }, [customer, projects]);

    // When project changes, load supervisors & services and auto-fill location
    useEffect(() => {
        if (project) {
            const selectedProject = projects.find(p => String(p.id) === String(project));
            if (selectedProject) {
                // Auto-fill location from project - build full address
                const addressParts = [
                    selectedProject.location_address,
                    selectedProject.location_postcode,
                    selectedProject.location_city
                ].filter(Boolean);

                // Use full address or fallback to location field
                const projectLocation = addressParts.length > 0
                    ? addressParts.join(', ')
                    : (selectedProject.location || '');
                setLocation(projectLocation);
                setOriginalLocation(projectLocation);

                // Load supervisors from project and services from customer
                loadProjectDetails(String(selectedProject.id), String(selectedProject.customer));
            }
        } else {
            setSupervisors([]);
            setServices([]);
            setLocation('');
            setOriginalLocation('');
        }
        // Reset dependent fields and their search values
        setSupervisor('');
        setSupervisorSearch('');
        setService('');
        setServiceSearch('');
    }, [project]);

    async function loadInitialData() {
        setLoadingEmployees(true);
        setLoadingCustomers(true);

        try {
            const [empRes, custRes, projRes, allowRes] = await Promise.all([
                fetch(`${API_URL}/employees/profiles/`, { headers }),
                fetch(`${API_URL}/customers/customers/`, { headers }),
                fetch(`${API_URL}/projects/projects/`, { headers }),
                fetch(`${API_URL}/employees/allowance-types/`, { headers }),
            ]);

            if (empRes.ok) {
                const data = await empRes.json();
                const list = Array.isArray(data) ? data : (data.results || []);
                setEmployees(list.map((e: any) => ({
                    id: e.id,
                    full_name: e.full_name || `${e.first_name} ${e.last_name}`,
                })));
            }

            if (custRes.ok) {
                const data = await custRes.json();
                const list = Array.isArray(data) ? data : (data.results || []);
                setCustomers(list.map((c: any) => ({
                    id: c.id,
                    company_name: c.company_name || c.name,
                })));
            }

            if (projRes.ok) {
                const data = await projRes.json();
                const list = Array.isArray(data) ? data : (data.results || []);
                setProjects(list);
            }

            if (allowRes.ok) {
                const data = await allowRes.json();
                setAllowanceTypes(Array.isArray(data) ? data : (data.results || []));
            }
        } catch (e) {
            console.error('Failed to load initial data:', e);
            setErrors({ general: 'Failed to load data. Please refresh the page.' });
        } finally {
            setLoadingEmployees(false);
            setLoadingCustomers(false);
        }
    }

    async function loadProjectDetails(projectId: string, customerId: string) {
        if (!projectId) return;

        setLoadingSupervisors(true);
        setLoadingServices(true);

        try {
            // Load supervisors from project detail API
            const projRes = await fetch(`${API_URL}/projects/projects/${projectId}/`, { headers });
            if (projRes.ok) {
                const projData = await projRes.json();
                const sups = (projData.supervisors_list || []).map((s: any) => ({
                    id: s.id,
                    full_name: s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
                }));
                setSupervisors(sups);
            }

            // Load services from customer (from service_rates)
            if (customerId) {
                const custRes = await fetch(`${API_URL}/customers/customers/${customerId}/`, { headers });
                if (custRes.ok) {
                    const customerData = await custRes.json();
                    // Customer API returns service_rates with service info
                    if (customerData.service_rates && customerData.service_rates.length > 0) {
                        setServices(customerData.service_rates.map((sr: any) => ({
                            id: sr.service,
                            name: sr.service_name,
                        })));
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load project details:', e);
        } finally {
            setLoadingSupervisors(false);
            setLoadingServices(false);
        }
    }

    // Break functions
    function addBreak() {
        setBreaks([...breaks, { start: '', end: '' }]);
    }

    function removeBreak(index: number) {
        setBreaks(breaks.filter((_, i) => i !== index));
    }

    function updateBreak(index: number, field: 'start' | 'end', value: string) {
        const updated = [...breaks];
        updated[index][field] = value;
        setBreaks(updated);

        // Validate break is within work hours
        validateBreakTime(updated[index], index);
    }

    // Helper function to validate break times are within work hours (real-time feedback)
    function validateBreakTime(brk: { start: string; end: string }, index: number) {
        if (!brk.start || !brk.end || !startDatetime || !endDatetime) {
            // Clear error if incomplete data
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`break_${index}`];
                return newErrors;
            });
            return;
        }

        // Parse work start/end times
        const workStart = new Date(startDatetime);
        const workEnd = new Date(endDatetime);
        const isOvernight = workEnd.getDate() > workStart.getDate() || workEnd < workStart;

        // Parse break times (HH:MM format)
        const [breakStartH, breakStartM] = brk.start.split(':').map(Number);
        const [breakEndH, breakEndM] = brk.end.split(':').map(Number);
        const workStartH = workStart.getHours();
        const workStartM = workStart.getMinutes();
        const workEndH = workEnd.getHours();
        const workEndM = workEnd.getMinutes();

        // Convert to minutes for easier comparison
        const breakStartMins = breakStartH * 60 + breakStartM;
        const breakEndMins = breakEndH * 60 + breakEndM;
        const workStartMins = workStartH * 60 + workStartM;
        const workEndMins = workEndH * 60 + workEndM;

        let isValid = false;

        if (isOvernight) {
            // For overnight shifts (e.g., 21:00-05:00):
            // Valid if break is in evening part [workStart, 23:59] OR morning part [00:00, workEnd]
            const breakInEvening = breakStartMins >= workStartMins && breakEndMins >= workStartMins;
            const breakInMorning = breakStartMins <= workEndMins && breakEndMins <= workEndMins;
            isValid = breakInEvening || breakInMorning;
        } else {
            // Same-day shift: break must be fully within work window
            isValid = breakStartMins >= workStartMins && breakEndMins <= workEndMins;
        }

        if (!isValid) {
            const workStartStr = `${String(workStartH).padStart(2, '0')}:${String(workStartM).padStart(2, '0')}`;
            const workEndStr = `${String(workEndH).padStart(2, '0')}:${String(workEndM).padStart(2, '0')}`;
            setErrors(prev => ({
                ...prev,
                [`break_${index}`]: `Break must be within work hours (${workStartStr}-${workEndStr})`
            }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`break_${index}`];
                return newErrors;
            });
        }
    }

    // Allowance functions
    function addAllowance() {
        setAllowances([...allowances, {
            allowance_type: null,
            custom_allowance_name: '',
            hours: '',
            notes: '',
            start_time: '',
            end_time: '',
        }]);
    }

    function updateAllowance(index: number, field: keyof WorkLogAllowance, value: string | number | null) {
        const updated = [...allowances];
        (updated[index] as any)[field] = value;
        if (field === 'allowance_type' && value !== null) {
            updated[index].custom_allowance_name = '';
        }
        setAllowances(updated);
    }

    function removeAllowance(index: number) {
        setAllowances(allowances.filter((_, i) => i !== index));
    }

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};

        if (selectedEmployees.length === 0) newErrors.employee = 'At least one employee is required';
        if (!customer) newErrors.customer = 'Customer is required';
        if (!project) newErrors.project = 'Project is required';
        if (!startDatetime) newErrors.startDatetime = 'Start date/time is required';
        if (!endDatetime) newErrors.endDatetime = 'End date/time is required';

        if (startDatetime && endDatetime && new Date(startDatetime) >= new Date(endDatetime)) {
            newErrors.endDatetime = 'End time must be after start time';
        }

        const validBreaks = breaks.filter(b => b.start && b.end);
        if (validBreaks.length === 0) {
            newErrors.breaks = 'At least one break is required';
        }

        // Validate breaks are within work hours
        if (startDatetime && endDatetime && validBreaks.length > 0) {
            const workStartTime = startDatetime.split('T')[1]; // HH:MM
            const workEndTime = endDatetime.split('T')[1]; // HH:MM

            // Detect overnight shift (work end time is before work start time)
            const isOvernightShift = workEndTime < workStartTime;

            for (let i = 0; i < validBreaks.length; i++) {
                const b = validBreaks[i];

                let isValid = false;

                if (isOvernightShift) {
                    // For overnight shifts (e.g., 23:51 -> 07:51):
                    // Break is valid if it's AFTER start time (e.g., 23:51-23:59)
                    // OR if it's BEFORE end time (e.g., 00:00-07:51)
                    const afterStart = b.start >= workStartTime && b.end >= workStartTime;
                    const beforeEnd = b.start <= workEndTime && b.end <= workEndTime;
                    isValid = afterStart || beforeEnd;
                } else {
                    // For normal shifts: break must be within work hours
                    isValid = b.start >= workStartTime && b.end <= workEndTime;
                }

                if (!isValid) {
                    newErrors.breaks = `Break ${i + 1} (${b.start}-${b.end}) must be within work hours (${workStartTime}-${workEndTime})`;
                    break;
                }
                if (b.start >= b.end) {
                    newErrors.breaks = `Break ${i + 1} end time must be after start time`;
                    break;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit() {
        if (!validateForm()) return;

        setSaving(true);
        setErrors({});

        try {
            // Extract work_date from start datetime (YYYY-MM-DD)
            const workDate = startDatetime.split('T')[0];

            let successCount = 0;
            let failCount = 0;
            const failedEmployees: string[] = [];

            // Create a work log for each selected employee
            for (const empId of selectedEmployees) {
                const payload: any = {
                    project: project,
                    employee: empId,
                    work_date: workDate,  // Required field
                    start_datetime: startDatetime,
                    end_datetime: endDatetime,
                    breaks: breaks.filter(b => b.start && b.end).map(b => ({
                        start: b.start + ':00',
                        end: b.end + ':00',
                    })),
                    location_override: location,
                    notes: notes,
                };

                if (supervisor) payload.supervisor = supervisor;
                if (service) payload.service = service;

                if (allowances.length > 0) {
                    payload.allowances = allowances.filter(a => a.allowance_type || a.custom_allowance_name).map(a => ({
                        allowance_type: a.allowance_type || null,
                        custom_allowance_name: a.custom_allowance_name || '',
                        hours: parseFloat(a.hours) || 0,
                        notes: a.notes || '',
                        start_time: a.start_time ? a.start_time + ':00' : null,
                        end_time: a.end_time ? a.end_time + ':00' : null,
                    }));
                }

                const response = await fetch(`${API_URL}/worklogs/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    const emp = employees.find(e => e.id === empId);
                    failedEmployees.push(emp?.full_name || empId);
                }
            }

            // Show result and navigate
            if (successCount > 0) {
                if (failCount > 0) {
                    alert(`Created ${successCount} work log(s). ${failCount} failed: ${failedEmployees.join(', ')}`);
                }
                router.push('/dashboard/worklogs');
            } else {
                setErrors({ general: 'Failed to create any work logs. Please try again.' });
            }
        } catch (err) {
            setErrors({ general: err instanceof Error ? err.message : 'An error occurred' });
        } finally {
            setSaving(false);
        }
    }
    return (
        <DashboardLayout>
            <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%)',
                    padding: '24px 32px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                        <button
                            onClick={() => router.push('/dashboard/worklogs')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none',
                                cursor: 'pointer', fontSize: '14px', marginBottom: '16px'
                            }}
                        >
                            <ArrowLeft size={16} /> Back to Work Logs
                        </button>
                        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: 0 }}>
                            Add Work Log
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontSize: '15px' }}>
                            Create a new work log entry by filling out the form below
                        </p>
                    </div>
                </div>

                {/* Form Content */}
                <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px' }}>
                    {/* General Error */}
                    {errors.general && (
                        <div style={{
                            padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '12px',
                            border: '1px solid #FECACA', marginBottom: '24px',
                            display: 'flex', alignItems: 'center', gap: '12px'
                        }}>
                            <AlertCircle size={20} style={{ color: '#DC2626' }} />
                            <span style={{ color: '#DC2626', fontSize: '14px' }}>{errors.general}</span>
                        </div>
                    )}

                    {/* Assignment Section */}
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                            display: 'flex', alignItems: 'center', gap: '12px'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <User size={20} style={{ color: '#3B82F6' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                                    Assignment Details
                                </h2>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
                                    Select employee, customer, project and supervisor
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                                {/* Multi-Employee Selection */}
                                <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>
                                        Employees <span style={{ color: '#EF4444' }}>*</span>
                                        {selectedEmployees.length > 0 && (
                                            <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: '8px' }}>
                                                ({selectedEmployees.length} selected)
                                            </span>
                                        )}
                                    </label>

                                    {/* Selected employees chips */}
                                    {selectedEmployees.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                            {selectedEmployees.map(empId => (
                                                <div key={empId} style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '6px 12px', background: '#10B981', color: 'white',
                                                    borderRadius: '20px', fontSize: '13px', fontWeight: 500
                                                }}>
                                                    {getEmployeeName(empId)}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleEmployee(empId)}
                                                        style={{ background: 'rgba(255,255,255,0.3)', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 6px', borderRadius: '50%', fontSize: '12px' }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Search input */}
                                    <input
                                        type="text"
                                        value={employeeSearch}
                                        onChange={(e) => {
                                            setEmployeeSearch(e.target.value);
                                            setShowEmployeeDropdown(true);
                                        }}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                                        placeholder={loadingEmployees ? 'Loading...' : 'Search and select employees...'}
                                        style={{ ...inputStyle, borderColor: errors.employee ? '#EF4444' : '#E5E7EB' }}
                                    />
                                    {errors.employee && <span style={errorStyle}>{errors.employee}</span>}

                                    {/* Dropdown with checkboxes */}
                                    {showEmployeeDropdown && (
                                        <div style={dropdownStyle}>
                                            {employees
                                                .filter(emp => emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                                .filter(emp => !selectedEmployees.includes(emp.id)) // Hide already selected
                                                .slice(0, 10)
                                                .map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        onMouseDown={() => {
                                                            toggleEmployee(emp.id);
                                                            setEmployeeSearch('');
                                                        }}
                                                        style={{
                                                            ...dropdownItemStyle,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px'
                                                        }}
                                                    >
                                                        <span style={{
                                                            width: '18px', height: '18px', borderRadius: '4px',
                                                            border: '2px solid #10B981', display: 'flex',
                                                            alignItems: 'center', justifyContent: 'center',
                                                            background: 'white'
                                                        }}>
                                                            +
                                                        </span>
                                                        {emp.full_name}
                                                    </div>
                                                ))}
                                            {employees.filter(emp => emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase())).filter(emp => !selectedEmployees.includes(emp.id)).length === 0 && (
                                                <div style={{ padding: '12px 16px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    {selectedEmployees.length > 0 && employees.filter(emp => emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase())).length === employees.length
                                                        ? 'All matching employees selected'
                                                        : 'No employees found'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Customer */}
                                <div style={{ position: 'relative' }}>
                                    <label style={labelStyle}>
                                        Customer <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            setShowCustomerDropdown(true);
                                            if (customer) {
                                                const selectedCust = customers.find(c => c.id === customer);
                                                if (selectedCust && !selectedCust.company_name.toLowerCase().includes(e.target.value.toLowerCase())) {
                                                    setCustomer('');
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                                        placeholder={loadingCustomers ? 'Loading...' : 'Search customer...'}
                                        style={{ ...inputStyle, borderColor: errors.customer ? '#EF4444' : '#E5E7EB' }}
                                    />
                                    {errors.customer && <span style={errorStyle}>{errors.customer}</span>}
                                    {showCustomerDropdown && (
                                        <div style={dropdownStyle}>
                                            {customers
                                                .filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(c => (
                                                    <div
                                                        key={c.id}
                                                        onMouseDown={() => {
                                                            setCustomer(c.id);
                                                            setCustomerSearch(c.company_name);
                                                            setShowCustomerDropdown(false);
                                                        }}
                                                        style={dropdownItemStyle}
                                                    >
                                                        {c.company_name}
                                                    </div>
                                                ))}
                                            {customers.filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: '12px 16px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    No customers found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Project */}
                                <div style={{ position: 'relative' }}>
                                    <label style={labelStyle}>
                                        Project <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={projectSearch}
                                        onChange={(e) => {
                                            setProjectSearch(e.target.value);
                                            setShowProjectDropdown(true);
                                            if (project) {
                                                const selectedProj = filteredProjects.find(p => p.id === project);
                                                if (selectedProj && !selectedProj.name.toLowerCase().includes(e.target.value.toLowerCase())) {
                                                    setProject('');
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowProjectDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                                        placeholder={!customer ? 'Select customer first...' : loadingProjects ? 'Loading...' : 'Search project...'}
                                        style={{ ...inputStyle, borderColor: errors.project ? '#EF4444' : '#E5E7EB' }}
                                        disabled={!customer}
                                    />
                                    {errors.project && <span style={errorStyle}>{errors.project}</span>}
                                    {showProjectDropdown && customer && (
                                        <div style={dropdownStyle}>
                                            {filteredProjects
                                                .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(p => (
                                                    <div
                                                        key={p.id}
                                                        onMouseDown={() => {
                                                            setProject(p.id);
                                                            setProjectSearch(p.name);
                                                            setShowProjectDropdown(false);
                                                        }}
                                                        style={dropdownItemStyle}
                                                    >
                                                        {p.name}
                                                    </div>
                                                ))}
                                            {filteredProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: '12px 16px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    No projects found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Supervisor */}
                                <div style={{ position: 'relative' }}>
                                    <label style={labelStyle}>Supervisor</label>
                                    <input
                                        type="text"
                                        value={supervisorSearch}
                                        onChange={(e) => {
                                            setSupervisorSearch(e.target.value);
                                            setShowSupervisorDropdown(true);
                                            if (supervisor) {
                                                const selectedSup = supervisors.find(s => s.id === supervisor);
                                                if (selectedSup && !selectedSup.full_name.toLowerCase().includes(e.target.value.toLowerCase())) {
                                                    setSupervisor('');
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowSupervisorDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowSupervisorDropdown(false), 200)}
                                        placeholder={!project ? 'Select project first...' : loadingSupervisors ? 'Loading...' : 'Search supervisor...'}
                                        style={inputStyle}
                                        disabled={!project}
                                    />
                                    {showSupervisorDropdown && project && (
                                        <div style={dropdownStyle}>
                                            {supervisors
                                                .filter(s => s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(s => (
                                                    <div
                                                        key={s.id}
                                                        onMouseDown={() => {
                                                            setSupervisor(s.id);
                                                            setSupervisorSearch(s.full_name);
                                                            setShowSupervisorDropdown(false);
                                                        }}
                                                        style={dropdownItemStyle}
                                                    >
                                                        {s.full_name}
                                                    </div>
                                                ))}
                                            {supervisors.filter(s => s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: '12px 16px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    No supervisors found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Service */}
                                <div style={{ position: 'relative' }}>
                                    <label style={labelStyle}>Service Type</label>
                                    <input
                                        type="text"
                                        value={serviceSearch}
                                        onChange={(e) => {
                                            setServiceSearch(e.target.value);
                                            setShowServiceDropdown(true);
                                            if (service) {
                                                const selectedServ = services.find(s => s.id === service);
                                                if (selectedServ && !selectedServ.name.toLowerCase().includes(e.target.value.toLowerCase())) {
                                                    setService('');
                                                }
                                            }
                                        }}
                                        onFocus={() => setShowServiceDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                                        placeholder={!project ? 'Select project first...' : loadingServices ? 'Loading...' : 'Search service...'}
                                        style={inputStyle}
                                        disabled={!project}
                                    />
                                    {showServiceDropdown && project && (
                                        <div style={dropdownStyle}>
                                            {services
                                                .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(s => (
                                                    <div
                                                        key={s.id}
                                                        onMouseDown={() => {
                                                            setService(s.id);
                                                            setServiceSearch(s.name);
                                                            setShowServiceDropdown(false);
                                                        }}
                                                        style={dropdownItemStyle}
                                                    >
                                                        {s.name}
                                                    </div>
                                                ))}
                                            {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: '12px 16px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                                    No services found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Location */}
                                <div>
                                    <label style={labelStyle}>
                                        <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder={!project ? 'Select project to auto-fill...' : 'Work location'}
                                        style={inputStyle}
                                        disabled={!project}
                                    />
                                    {project && originalLocation && location !== originalLocation && (
                                        <button
                                            type="button"
                                            onClick={() => setLocation(originalLocation)}
                                            style={{
                                                marginTop: '6px',
                                                padding: '6px 12px',
                                                backgroundColor: '#EFF6FF',
                                                color: '#3B82F6',
                                                border: '1px solid #3B82F6',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            ↩ Reset to: {originalLocation.length > 30 ? originalLocation.substring(0, 30) + '...' : originalLocation}
                                        </button>
                                    )}
                                    {project && location === originalLocation && (
                                        <span style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', display: 'block' }}>
                                            Auto-filled from project (editable)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Date & Time Section */}
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                            display: 'flex', alignItems: 'center', gap: '12px'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Clock size={20} style={{ color: '#16A34A' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                                    Date & Time
                                </h2>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
                                    Set work hours and break times
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
                                {/* Start DateTime */}
                                <div>
                                    <label style={labelStyle}>
                                        Start Date/Time <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={startDatetime}
                                        onChange={(e) => setStartDatetime(e.target.value)}
                                        style={{ ...inputStyle, borderColor: errors.startDatetime ? '#EF4444' : '#E5E7EB' }}
                                    />
                                    {errors.startDatetime && <span style={errorStyle}>{errors.startDatetime}</span>}
                                </div>

                                {/* End DateTime */}
                                <div>
                                    <label style={labelStyle}>
                                        End Date/Time <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={endDatetime}
                                        onChange={(e) => setEndDatetime(e.target.value)}
                                        style={{ ...inputStyle, borderColor: errors.endDatetime ? '#EF4444' : '#E5E7EB' }}
                                    />
                                    {errors.endDatetime && <span style={errorStyle}>{errors.endDatetime}</span>}
                                </div>
                            </div>

                            {/* Breaks */}
                            <div style={{
                                backgroundColor: '#FEF3C7', borderRadius: '12px', padding: '20px',
                                border: '1px solid #FCD34D'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Coffee size={18} style={{ color: '#D97706' }} />
                                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#92400E' }}>
                                            Breaks <span style={{ color: '#EF4444' }}>*</span>
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addBreak}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', backgroundColor: '#D97706', color: 'white',
                                            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                        }}
                                    >
                                        <Plus size={14} />
                                        Add Break
                                    </button>
                                </div>

                                {errors.breaks && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <span style={errorStyle}>{errors.breaks}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {breaks.map((brk, index) => {
                                        // Calculate break duration in minutes
                                        let durationMins = 0;
                                        if (brk.start && brk.end) {
                                            const [sh, sm] = brk.start.split(':').map(Number);
                                            const [eh, em] = brk.end.split(':').map(Number);
                                            durationMins = (eh * 60 + em) - (sh * 60 + sm);
                                            if (durationMins < 0) durationMins += 24 * 60; // Handle overnight
                                        }

                                        const breakError = errors[`break_${index}`];

                                        return (
                                            <div key={index}>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ ...labelStyle, fontSize: '12px', color: breakError ? '#DC2626' : '#92400E' }}>Start</label>
                                                        <input
                                                            type="time"
                                                            value={brk.start}
                                                            onChange={(e) => updateBreak(index, 'start', e.target.value)}
                                                            style={{
                                                                ...inputStyle,
                                                                padding: '10px 12px',
                                                                backgroundColor: breakError ? '#FEF2F2' : 'white',
                                                                borderColor: breakError ? '#DC2626' : '#E5E7EB'
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ ...labelStyle, fontSize: '12px', color: breakError ? '#DC2626' : '#92400E' }}>End</label>
                                                        <input
                                                            type="time"
                                                            value={brk.end}
                                                            onChange={(e) => updateBreak(index, 'end', e.target.value)}
                                                            style={{
                                                                ...inputStyle,
                                                                padding: '10px 12px',
                                                                backgroundColor: breakError ? '#FEF2F2' : 'white',
                                                                borderColor: breakError ? '#DC2626' : '#E5E7EB'
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Duration display */}
                                                    <div style={{
                                                        padding: '10px 14px',
                                                        backgroundColor: breakError ? '#DC2626' : '#F59E0B',
                                                        color: 'white',
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        minWidth: '60px',
                                                        textAlign: 'center'
                                                    }}>
                                                        {durationMins > 0 ? `${durationMins} min` : '--'}
                                                    </div>
                                                    {breaks.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeBreak(index)}
                                                            style={{
                                                                padding: '10px', backgroundColor: '#FEE2E2',
                                                                border: 'none', borderRadius: '8px', cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Trash2 size={16} style={{ color: '#DC2626' }} />
                                                        </button>
                                                    )}
                                                </div>
                                                {breakError && (
                                                    <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                                                        {breakError}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                            display: 'flex', alignItems: 'center', gap: '12px'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <FileText size={20} style={{ color: '#6B7280' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                                    Notes
                                </h2>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
                                    Additional information about this work log
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add any additional notes or comments..."
                                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                            />
                        </div>
                    </div>

                    {/* Allowances Section */}
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '32px', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    backgroundColor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Gift size={20} style={{ color: '#8B5CF6' }} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                                        Allowances (Toeslag)
                                    </h2>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
                                        Add special allowances for this work log
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addAllowance}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 18px', backgroundColor: '#8B5CF6', color: 'white',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                <Plus size={16} />
                                Add Allowance
                            </button>
                        </div>

                        <div style={{ padding: '24px' }}>
                            {allowances.length === 0 ? (
                                <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                                    No allowances added. Click "Add Allowance" to add one.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {allowances.map((allowance, index) => (
                                        <div key={index} style={{
                                            padding: '20px', backgroundColor: '#F9FAFB',
                                            borderRadius: '12px', border: '1px solid #E5E7EB'
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '16px', marginBottom: '16px' }}>
                                                <div>
                                                    <label style={{ ...labelStyle, fontSize: '12px' }}>Allowance Type</label>
                                                    <select
                                                        value={allowance.allowance_type || ''}
                                                        onChange={(e) => updateAllowance(index, 'allowance_type', e.target.value ? parseInt(e.target.value) : null)}
                                                        style={inputStyle}
                                                    >
                                                        <option value="">Custom / Other</option>
                                                        {allowanceTypes.map(at => (
                                                            <option key={at.id} value={at.id}>
                                                                {at.name} (€{at.base_price}/hr)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ ...labelStyle, fontSize: '12px' }}>Hours</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={allowance.hours}
                                                        onChange={(e) => updateAllowance(index, 'hours', e.target.value)}
                                                        placeholder="0"
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAllowance(index)}
                                                    style={{
                                                        alignSelf: 'flex-end', padding: '12px',
                                                        backgroundColor: '#FEE2E2', border: 'none',
                                                        borderRadius: '8px', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={18} style={{ color: '#DC2626' }} />
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: allowance.allowance_type ? '0' : '16px' }}>
                                                <div>
                                                    <label style={{ ...labelStyle, fontSize: '12px' }}>From Time</label>
                                                    <input
                                                        type="time"
                                                        value={allowance.start_time || ''}
                                                        onChange={(e) => {
                                                            const start = e.target.value;
                                                            updateAllowance(index, 'start_time', start);
                                                            if (start && allowance.end_time) {
                                                                const [sh, sm] = start.split(':').map(Number);
                                                                const [eh, em] = (allowance.end_time || '').split(':').map(Number);
                                                                let hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
                                                                if (hours < 0) hours += 24;
                                                                updateAllowance(index, 'hours', hours.toFixed(2));
                                                            }
                                                        }}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ ...labelStyle, fontSize: '12px' }}>To Time</label>
                                                    <input
                                                        type="time"
                                                        value={allowance.end_time || ''}
                                                        onChange={(e) => {
                                                            const end = e.target.value;
                                                            updateAllowance(index, 'end_time', end);
                                                            if (allowance.start_time && end) {
                                                                const [sh, sm] = (allowance.start_time || '').split(':').map(Number);
                                                                const [eh, em] = end.split(':').map(Number);
                                                                let hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
                                                                if (hours < 0) hours += 24;
                                                                updateAllowance(index, 'hours', hours.toFixed(2));
                                                            }
                                                        }}
                                                        style={inputStyle}
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
                                                        style={inputStyle}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex', gap: '16px', justifyContent: 'flex-end',
                        padding: '24px', backgroundColor: 'white', borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <button
                            onClick={() => router.push('/dashboard/worklogs')}
                            style={{
                                padding: '14px 28px', backgroundColor: '#F3F4F6', color: '#374151',
                                border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || Object.keys(errors).some(k => k.startsWith('break_'))}
                            style={{
                                padding: '14px 36px',
                                backgroundColor: (saving || Object.keys(errors).some(k => k.startsWith('break_'))) ? '#9CA3AF' : '#059669',
                                color: 'white',
                                border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600,
                                cursor: (saving || Object.keys(errors).some(k => k.startsWith('break_'))) ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.7 : 1,
                            }}
                        >
                            {saving ? 'Creating...' : 'Create Work Log'}
                        </button>
                    </div>
                </div>
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
    backgroundColor: 'white',
    transition: 'border-color 0.2s',
};

const errorStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: '#EF4444',
    marginTop: '4px',
};

const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    backgroundColor: 'white',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    zIndex: 1000,
    marginTop: '4px',
};

const dropdownItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    borderBottom: '1px solid #F3F4F6',
    color: '#111827',
    fontSize: '14px',
};
