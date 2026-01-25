'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard';
import { Card, Button, Input } from '@/components/ui';
import { api, Invoice } from '@/lib/api';
import { FileText, Download, Eye, Clock, CheckCircle, AlertCircle, DollarSign, X, Gift, Coins, Users, User, Briefcase } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface InvoiceDetail {
    id: string;
    invoice_number: string;
    customer: string;
    customer_name: string;
    week_year: number;
    week_number: number;
    week_start_date: string;
    week_end_date: string;
    subtotal: number;
    total_costs: number;
    total_allowances: number;
    total_gratuities: number;
    vat_rate: number;
    vat_amount: number;
    total: number;
    status: string;
    lines: InvoiceLine[];
    costs: InvoiceCost[];
    allowance_lines: InvoiceAllowance[];
    gratuity_lines: InvoiceGratuity[];
}

interface InvoiceLine {
    id: string;
    project_name: string;
    employee_name: string;
    description: string;
    quantity_hours: number;
    hourly_rate: number;
    total: number;
}

interface InvoiceCost {
    id: string;
    cost_type_name: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface InvoiceAllowance {
    id: string;
    employee_name: string;
    allowance_name: string;
    allowance_type_name?: string;
    custom_name?: string;
    quantity_hours: number;
    hourly_rate: number;
    total: number;
}

interface InvoiceGratuity {
    id: string;
    employee_name: string;
    description: string;
    amount: number;
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    // Detail modal
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Advanced filters
    const [customers, setCustomers] = useState<{ id: string, company_name: string }[]>([]);
    const [employees, setEmployees] = useState<{ id: string, full_name: string }[]>([]);
    const [supervisors, setSupervisors] = useState<{ id: string, full_name: string }[]>([]);

    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [selectedSupervisor, setSelectedSupervisor] = useState('');
    const [weekStart, setWeekStart] = useState('');
    const [weekEnd, setWeekEnd] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Search states for dropdowns
    const [customerSearch, setCustomerSearch] = useState('');
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

    // Worklogs for export
    const [worklogs, setWorklogs] = useState<any[]>([]);
    const [loadingWorklogs, setLoadingWorklogs] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    // Customer surcharge types
    const [customerSurcharges, setCustomerSurcharges] = useState<{ name: string; percentage: number }[]>([]);

    useEffect(() => {
        loadInvoices();
        loadFilterData();
    }, []);

    // Load worklogs when filters change
    useEffect(() => {
        if (selectedCustomer || weekStart || weekEnd || selectedEmployees.length > 0) {
            loadFilteredWorklogs();
        }
    }, [selectedCustomer, selectedSupervisor, weekStart, weekEnd, selectedEmployees]);

    // Load customer surcharge types when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            loadCustomerSurcharges(selectedCustomer);
        } else {
            setCustomerSurcharges([]);
        }
    }, [selectedCustomer]);

    async function loadCustomerSurcharges(customerId: string) {
        try {
            const response = await fetch(`${API_URL}/customers/${customerId}/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                const customerData = await response.json();
                console.log('Customer data for surcharges:', customerData);
                // Get enabled service surcharges with name and percentage
                const surcharges = (customerData.service_surcharges || [])
                    .filter((s: any) => s.is_enabled)
                    .map((s: any) => ({
                        name: s.surcharge_type_name || s.name || 'Unknown',
                        percentage: s.percentage || 0
                    }));
                console.log('Loaded surcharges:', surcharges);
                setCustomerSurcharges(surcharges);
            }
        } catch (e) {
            console.error('Failed to load customer surcharges:', e);
        }
    }

    // Helper function to calculate hours for a worklog within the filtered week range
    // This handles cross-week shifts by only counting hours that fall within the selected weeks
    function getFilteredHours(worklog: any): number {
        // If no week filter or no breakdown available, use total calculated hours
        if (!weekStart && !weekEnd) {
            return parseFloat(worklog.calculated_hours) || 0;
        }

        // Parse filter week range
        const [startYear, startWeek] = weekStart ? weekStart.split('-W').map(Number) : [0, 0];
        const [endYear, endWeek] = weekEnd ? weekEnd.split('-W').map(Number) : [startYear, 52];

        // Use weekly_hours_breakdown if available (for cross-week support)
        if (worklog.weekly_hours_breakdown && Array.isArray(worklog.weekly_hours_breakdown)) {
            let filteredHours = 0;
            for (const entry of worklog.weekly_hours_breakdown) {
                const { year, week, hours } = entry;
                // Check if this week falls within our filter range
                if (year === startYear && week >= startWeek && week <= endWeek) {
                    filteredHours += hours;
                }
            }
            return filteredHours;
        }

        // Fallback: use total hours if breakdown not available
        return parseFloat(worklog.calculated_hours) || 0;
    }

    async function loadFilteredWorklogs() {
        setLoadingWorklogs(true);
        try {
            let url = `${API_URL}/worklogs/?`;
            const params = new URLSearchParams();

            // Always include past entries for invoice generation
            params.append('include_past', 'true');

            if (selectedCustomer) params.append('customer', selectedCustomer);
            if (selectedSupervisor) params.append('supervisor', selectedSupervisor);

            // Week range filter - send both start and end year/week for cross-year support
            if (weekStart) {
                const [year, week] = weekStart.split('-W');
                params.append('week_start_year', year);
                params.append('week_start_number', week);
            }
            if (weekEnd) {
                const [year, week] = weekEnd.split('-W');
                params.append('week_end_year', year);
                params.append('week_end_number', week);
            }

            if (selectedEmployees.length > 0) {
                selectedEmployees.forEach(empId => params.append('employee', empId));
            }

            const response = await fetch(url + params.toString(), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                const results = Array.isArray(data) ? data : data.results || [];
                setWorklogs(results);
            }
        } catch (e) {
            console.error('Failed to load worklogs:', e);
        } finally {
            setLoadingWorklogs(false);
        }
    }

    // Excel Export - Full Version (for Customer)
    // Uses backend endpoint that loads Master.xlsx template for exact design match
    async function exportExcelForCustomer(exportType: 'hr' | 'finance' = 'hr') {
        if (!selectedCustomer) {
            alert('Please select a customer first.');
            return;
        }
        if (worklogs.length === 0) {
            alert('No worklogs to export. Please adjust your filters.');
            return;
        }

        try {
            // Build query parameters
            const params = new URLSearchParams();
            params.append('customer_id', selectedCustomer);
            params.append('export_type', exportType);

            if (weekStart) params.append('week_start', weekStart);
            if (weekEnd) params.append('week_end', weekEnd);
            if (selectedSupervisor) params.append('supervisor_id', selectedSupervisor);
            if (selectedEmployees.length > 0) {
                params.append('employee_ids', selectedEmployees.join(','));
            }


            // Call the backend export endpoint
            const response = await fetch(`${API_URL}/worklogs/export/customer/?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Export failed');
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Inleenovereenkomst_${new Date().toISOString().split('T')[0]}.xlsx`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setShowExportModal(false);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export Excel file. Please try again.');
        }
    }


    // Excel Export - Simple Version (for Employee)
    function exportExcelForEmployee() {
        if (worklogs.length === 0) {
            alert('No worklogs to export. Please select filters first.');
            return;
        }

        // Prepare simple data
        const excelData = worklogs.map(log => ({
            'Naam': log.employee_name || '',
            'Datum': log.work_date,
            'Project': log.project_name || '',
            'Start': log.start_time || '',
            'Einde': log.end_time || '',
            'Pauze': log.break_duration || '0:00',
            'Totaal Uren': log.calculated_hours || 0,
            'Notities': log.description || ''
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        ws['!cols'] = [
            { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 8 },
            { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 30 }
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Uren Overzicht');

        // Download
        const filename = `Employee_Hours_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        setShowExportModal(false);
    }

    async function loadFilterData() {
        try {
            // Load all customers - using same endpoint as Work Logs page
            const customersRes = await fetch(`${API_URL}/customers/customers/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (customersRes.ok) {
                const data = await customersRes.json();
                const customerList = Array.isArray(data) ? data : data.results || [];
                setCustomers(customerList.map((c: any) => ({ id: c.id, company_name: c.company_name })));
            }

            // Load employees - using users endpoint for better data
            const employeesRes = await fetch(`${API_URL}/employees/users/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (employeesRes.ok) {
                const data = await employeesRes.json();
                const empList = Array.isArray(data) ? data : data.results || [];
                setEmployees(empList.map((e: any) => ({
                    id: e.id,
                    full_name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email || 'Unknown'
                })));
            }
        } catch (e) {
            console.error('Failed to load filter data:', e);
        }
    }

    async function loadSupervisors(customerId: string) {
        if (!customerId) {
            setSupervisors([]);
            setSelectedSupervisor('');
            return;
        }
        try {
            // Outfolders are supervisors - same pattern as Work Logs page
            const res = await fetch(`${API_URL}/customers/outfolders/?customer=${customerId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                const allOutfolders = data.results || data;
                // Filter by customer on frontend and use company_name for display
                const filtered = allOutfolders.filter((o: any) => o.customer === customerId);
                setSupervisors(filtered.map((o: any) => ({
                    id: o.id,
                    full_name: o.company_name || 'Unknown Rayon'
                })));
            }
        } catch (e) {
            console.error('Failed to load supervisors:', e);
        }
    }


    async function loadInvoices() {
        setLoading(true);
        setError(null);
        try {
            const response = await api.getInvoices();
            setInvoices(response.results || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }

    async function loadInvoiceDetail(invoiceId: string) {
        setLoadingDetail(true);
        try {
            const response = await fetch(`${API_URL}/invoices/invoices/${invoiceId}/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedInvoice(data);
            }
        } catch (err) {
            console.error('Failed to load invoice detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    }

    function exportPDF() {
        if (!selectedInvoice) return;

        // Create a printable version
        const printContent = `
            <html>
            <head>
                <title>Invoice ${selectedInvoice.invoice_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #1E3A5F; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f5f5f5; }
                    .total { font-weight: bold; font-size: 18px; }
                    .section { margin-top: 30px; }
                </style>
            </head>
            <body>
                <h1>INVOICE ${selectedInvoice.invoice_number}</h1>
                <p><strong>Customer:</strong> ${selectedInvoice.customer_name}</p>
                <p><strong>Period:</strong> Week ${selectedInvoice.week_number}, ${selectedInvoice.week_year}</p>
                <p><strong>Date:</strong> ${selectedInvoice.week_start_date} - ${selectedInvoice.week_end_date}</p>
                
                <div class="section">
                    <h2>Labor Hours</h2>
                    <table>
                        <tr><th>Employee</th><th>Project</th><th>Hours</th><th>Rate</th><th>Total</th></tr>
                        ${selectedInvoice.lines.map(l => `
                            <tr><td>${l.employee_name}</td><td>${l.project_name}</td><td>${l.quantity_hours}h</td><td>€${l.hourly_rate}</td><td>€${l.total}</td></tr>
                        `).join('')}
                    </table>
                </div>
                
                ${selectedInvoice.allowance_lines.length > 0 ? `
                <div class="section">
                    <h2>Allowances (Toeslag)</h2>
                    <table>
                        <tr><th>Employee</th><th>Type</th><th>Hours</th><th>Rate</th><th>Total</th></tr>
                        ${selectedInvoice.allowance_lines.map(a => `
                            <tr><td>${a.employee_name}</td><td>${a.allowance_name || a.allowance_type_name}</td><td>${a.quantity_hours}h</td><td>€${a.hourly_rate}</td><td>€${a.total}</td></tr>
                        `).join('')}
                    </table>
                </div>
                ` : ''}
                
                ${selectedInvoice.gratuity_lines.length > 0 ? `
                <div class="section">
                    <h2>Gratuities (Fooi)</h2>
                    <table>
                        <tr><th>Employee</th><th>Description</th><th>Amount</th></tr>
                        ${selectedInvoice.gratuity_lines.map(g => `
                            <tr><td>${g.employee_name}</td><td>${g.description || '-'}</td><td>€${g.amount}</td></tr>
                        `).join('')}
                    </table>
                </div>
                ` : ''}
                
                <div class="section" style="text-align: right; border-top: 2px solid #1E3A5F; padding-top: 20px;">
                    <p>Subtotal: €${selectedInvoice.subtotal.toLocaleString()}</p>
                    <p>Costs: €${selectedInvoice.total_costs.toLocaleString()}</p>
                    <p>Allowances: €${selectedInvoice.total_allowances.toLocaleString()}</p>
                    <p>Gratuities: €${selectedInvoice.total_gratuities.toLocaleString()}</p>
                    <p>VAT (${selectedInvoice.vat_rate}%): €${selectedInvoice.vat_amount.toLocaleString()}</p>
                    <p class="total">TOTAL: €${selectedInvoice.total.toLocaleString()}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        }
    }

    const filteredInvoices = invoices.filter(inv => {
        // Status filter
        if (filter !== 'all' && inv.status !== filter) return false;

        // Customer filter
        if (selectedCustomer && inv.customer !== selectedCustomer) return false;

        // Week range filter
        if (weekStart && inv.week_number && inv.week_year) {
            const [startYear, startWeek] = weekStart.split('-W').map(Number);
            if (inv.week_year < startYear || (inv.week_year === startYear && inv.week_number < startWeek)) {
                return false;
            }
        }
        if (weekEnd && inv.week_number && inv.week_year) {
            const [endYear, endWeek] = weekEnd.split('-W').map(Number);
            if (inv.week_year > endYear || (inv.week_year === endYear && inv.week_number > endWeek)) {
                return false;
            }
        }

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            return inv.invoice_number?.toLowerCase().includes(searchLower) ||
                inv.customer_name?.toLowerCase().includes(searchLower);
        }
        return true;
    });

    const statusColors: Record<string, string> = {
        paid: 'bg-green-100 text-green-700',
        pending: 'bg-yellow-100 text-yellow-700',
        overdue: 'bg-red-100 text-red-700',
        draft: 'bg-gray-100 text-gray-700',
    };

    const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#1E3A5F',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <FileText style={{ width: '28px', height: '28px' }} />
                            Outgoing Invoices
                        </h1>
                        <p style={{
                            fontSize: '15px',
                            color: '#6B7280',
                            margin: '4px 0 0 0',
                        }}>
                            Manage customer invoices and payments
                        </p>
                    </div>
                    <button
                        onClick={() => setShowExportModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#1E3A5F',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(30, 58, 95, 0.3)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <Download size={18} />
                        Generate Invoice
                    </button>
                </div>

                {/* Filters Bar */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '16px 24px',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    {/* Status Tabs */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['all', 'pending', 'paid', 'overdue'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    backgroundColor: filter === status ? '#1E3A5F' : '#F3F4F6',
                                    color: filter === status ? 'white' : '#6B7280',
                                }}
                            >
                                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Search and Filters */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                placeholder="Search invoices..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    padding: '10px 16px',
                                    paddingLeft: '40px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    fontSize: '14px',
                                    width: '240px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                            />
                            <svg
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9CA3AF',
                                    width: '18px',
                                    height: '18px',
                                }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: '1px solid #E5E7EB',
                                backgroundColor: showFilters ? '#EFF6FF' : 'white',
                                color: showFilters ? '#1E3A5F' : '#6B7280',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Briefcase size={16} />
                            Filters
                        </button>
                    </div>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
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
                                {selectedCustomer ? (
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
                                            {customers.find(c => c.id === selectedCustomer)?.company_name}
                                        </span>
                                        <button
                                            onClick={() => { setSelectedCustomer(''); setSupervisors([]); setSelectedSupervisor(''); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: '16px' }}
                                        >✕</button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Search customers..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
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
                                                    .filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase()))
                                                    .slice(0, 10)
                                                    .map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => {
                                                                setSelectedCustomer(c.id);
                                                                setCustomerSearch('');
                                                                setShowCustomerDropdown(false);
                                                                loadSupervisors(c.id);
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
                                                {customers.filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
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
                                    Supervisor {selectedCustomer && <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>(for selected customer)</span>}
                                </label>
                                {selectedSupervisor ? (
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
                                            {supervisors.find(s => s.id === selectedSupervisor)?.full_name}
                                        </span>
                                        <button
                                            onClick={() => setSelectedSupervisor('')}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: '16px' }}
                                        >✕</button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            placeholder={selectedCustomer ? "Search supervisors..." : "Select customer first"}
                                            value={supervisorSearch}
                                            onChange={(e) => setSupervisorSearch(e.target.value)}
                                            onFocus={() => selectedCustomer && setShowSupervisorDropdown(true)}
                                            disabled={!selectedCustomer}
                                            style={{
                                                width: '100%',
                                                padding: '12px 14px',
                                                fontSize: '14px',
                                                borderRadius: '10px',
                                                border: '1px solid #D1D5DB',
                                                backgroundColor: selectedCustomer ? '#FAFAFA' : '#F3F4F6',
                                                outline: 'none',
                                                opacity: selectedCustomer ? 1 : 0.6,
                                                cursor: selectedCustomer ? 'text' : 'not-allowed',
                                            }}
                                        />
                                        {showSupervisorDropdown && selectedCustomer && (
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
                                                {supervisors
                                                    .filter(s => s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()))
                                                    .slice(0, 10)
                                                    .map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => {
                                                                setSelectedSupervisor(s.id);
                                                                setSupervisorSearch('');
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
                                                {supervisors.filter(s => s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase())).length === 0 && (
                                                    <div style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: '14px' }}>No supervisors found</div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* From Week */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>From Week</label>
                                <input
                                    type="week"
                                    value={weekStart}
                                    onChange={(e) => setWeekStart(e.target.value)}
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

                            {/* To Week */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>To Week</label>
                                <input
                                    type="week"
                                    value={weekEnd}
                                    onChange={(e) => setWeekEnd(e.target.value)}
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

                        {/* Employees Search Section */}
                        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                    Employees {selectedEmployees.length > 0 ? <span style={{ color: '#3B82F6', fontWeight: 500 }}>({selectedEmployees.length} selected)</span> : <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(All)</span>}
                                </label>
                                {selectedEmployees.length > 0 && (
                                    <button
                                        onClick={() => setSelectedEmployees([])}
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

                            {/* Selected employees chips */}
                            {selectedEmployees.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                    {selectedEmployees.map(empId => {
                                        const emp = employees.find(e => e.id === empId);
                                        return emp ? (
                                            <span key={empId} style={{
                                                fontSize: '12px',
                                                color: '#1E3A5F',
                                                backgroundColor: '#EFF6FF',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontWeight: 500,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }}>
                                                {emp.full_name}
                                                <button
                                                    onClick={() => setSelectedEmployees(selectedEmployees.filter(id => id !== empId))}
                                                    style={{ fontSize: '10px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >✕</button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Click to select or type to search employees..."
                                    value={employeeSearch}
                                    onChange={(e) => {
                                        setEmployeeSearch(e.target.value);
                                        setShowEmployeeDropdown(true);
                                    }}
                                    onFocus={() => setShowEmployeeDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
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
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        maxHeight: '250px',
                                        overflowY: 'auto',
                                        zIndex: 100,
                                        marginTop: '4px',
                                    }}>
                                        {(() => {
                                            const filtered = employees.filter(e =>
                                                !selectedEmployees.includes(e.id) &&
                                                (!employeeSearch || e.full_name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                            );
                                            const shown = filtered.slice(0, 10);
                                            const hasMore = filtered.length > 10;

                                            return (
                                                <>
                                                    {shown.map(e => (
                                                        <div
                                                            key={e.id}
                                                            onClick={() => {
                                                                setSelectedEmployees([...selectedEmployees, e.id]);
                                                                setEmployeeSearch('');
                                                            }}
                                                            style={{
                                                                padding: '12px 14px',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #F3F4F6',
                                                                fontSize: '14px',
                                                                color: '#1F2937',
                                                                backgroundColor: 'white',
                                                            }}
                                                            onMouseEnter={(ev) => ev.currentTarget.style.backgroundColor = '#F3F4F6'}
                                                            onMouseLeave={(ev) => ev.currentTarget.style.backgroundColor = 'white'}
                                                        >
                                                            {e.full_name}
                                                        </div>
                                                    ))}
                                                    {hasMore && (
                                                        <div style={{ padding: '10px 14px', color: '#3B82F6', fontSize: '13px', fontWeight: 500, textAlign: 'center', backgroundColor: '#EFF6FF' }}>
                                                            Type to search {filtered.length - 10} more...
                                                        </div>
                                                    )}
                                                    {shown.length === 0 && (
                                                        <div style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '14px' }}>
                                                            {employees.length === 0 ? 'No employees available' : 'No more employees to add'}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                    Status <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(All)</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {[
                                    { key: 'draft', label: 'Draft', color: '#6B7280' },
                                    { key: 'pending', label: 'Pending', color: '#D97706' },
                                    { key: 'paid', label: 'Paid', color: '#059669' },
                                    { key: 'overdue', label: 'Overdue', color: '#DC2626' },
                                ].map((status) => (
                                    <button
                                        key={status.key}
                                        onClick={() => setFilter(filter === status.key ? 'all' : status.key)}
                                        style={{
                                            padding: '8px 16px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            border: filter === status.key ? 'none' : '1px solid #D1D5DB',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            backgroundColor: filter === status.key ? status.color : 'white',
                                            color: filter === status.key ? 'white' : '#374151',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: filter === status.key ? 'white' : status.color,
                                        }} />
                                        {status.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clear Filters Button */}
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setSelectedCustomer('');
                                    setSelectedSupervisor('');
                                    setWeekStart('');
                                    setWeekEnd('');
                                    setSelectedEmployees([]);
                                    setSupervisors([]);
                                    setFilter('all');
                                    setWorklogs([]);
                                }}
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#6B7280',
                                    backgroundColor: 'white',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                <X size={16} />
                                Clear Filters
                            </button>
                        </div>

                        {/* Analytics Summary Section */}
                        {worklogs.length > 0 && (
                            <div style={{
                                marginTop: '24px',
                                paddingTop: '24px',
                                borderTop: '2px solid #E5E7EB',
                            }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E3A5F', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📊 Analytics Summary
                                    {loadingWorklogs && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>(Loading...)</span>}
                                </h3>

                                {/* Summary Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                    {/* Employees Count - Clickable */}
                                    <div
                                        onClick={() => {
                                            const employeesSection = document.getElementById('employees-list-section');
                                            if (employeesSection) employeesSection.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        style={{
                                            padding: '16px',
                                            backgroundColor: '#EFF6FF',
                                            borderRadius: '12px',
                                            border: '1px solid #BFDBFE',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <p style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>Employees</p>
                                        <p style={{ fontSize: '28px', fontWeight: 700, color: '#1E40AF', margin: '4px 0 0 0' }}>
                                            {new Set(worklogs.map(w => w.employee)).size}
                                        </p>
                                        <p style={{ fontSize: '11px', color: '#60A5FA', margin: '4px 0 0 0' }}>Click to see details ↓</p>
                                    </div>

                                    {/* Total Hours */}
                                    <div style={{ padding: '16px', backgroundColor: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                                        <p style={{ fontSize: '12px', color: '#D97706', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>Total Hours</p>
                                        <p style={{ fontSize: '28px', fontWeight: 700, color: '#92400E', margin: '4px 0 0 0' }}>
                                            {worklogs.reduce((sum, w) => sum + getFilteredHours(w), 0).toFixed(1)}h
                                        </p>
                                    </div>

                                    {/* Employee Cost (Estimate) */}
                                    <div style={{ padding: '16px', backgroundColor: '#FEE2E2', borderRadius: '12px', border: '1px solid #FECACA' }}>
                                        <p style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>To Pay Employees</p>
                                        <p style={{ fontSize: '28px', fontWeight: 700, color: '#991B1B', margin: '4px 0 0 0' }}>
                                            €{worklogs.reduce((sum, w) => {
                                                const hours = getFilteredHours(w);
                                                const rate = parseFloat(w.employee_hourly_rate) || 12; // default rate
                                                return sum + (hours * rate);
                                            }, 0).toFixed(2)}
                                        </p>
                                    </div>

                                    {/* Customer Charge (Estimate) */}
                                    <div style={{ padding: '16px', backgroundColor: '#D1FAE5', borderRadius: '12px', border: '1px solid #6EE7B7' }}>
                                        <p style={{ fontSize: '12px', color: '#059669', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>To Charge Customer</p>
                                        <p style={{ fontSize: '28px', fontWeight: 700, color: '#065F46', margin: '4px 0 0 0' }}>
                                            €{worklogs.reduce((sum, w) => {
                                                const hours = getFilteredHours(w);
                                                const rate = parseFloat(w.customer_hourly_rate) || parseFloat(w.service_rate) || 25; // default rate
                                                return sum + (hours * rate);
                                            }, 0).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Employees List - Detailed */}
                                <div id="employees-list-section" style={{ marginBottom: '16px' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                                        👥 Employees ({new Set(worklogs.map(w => w.employee)).size})
                                    </h4>
                                    <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#F3F4F6' }}>
                                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', width: '14%' }}>Employee</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', width: '12%' }}>Project</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151', width: '12%' }}>Service</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#374151', width: '4%' }}>Day</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#374151', width: '10%' }}>Time</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#374151', width: '6%' }}>Pause</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#374151', width: '7%' }}>Hours</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#374151', width: '10%' }}>Normal Hours</th>
                                                    <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#374151', width: '13%' }}>
                                                        {customerSurcharges.length > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
                                                                {customerSurcharges.slice(0, 3).map((s, i) => (
                                                                    <span key={i}>{s.name}</span>
                                                                ))}
                                                                {customerSurcharges.length > 3 && <span>+{customerSurcharges.length - 3} more</span>}
                                                            </div>
                                                        ) : 'Added Value'}
                                                    </th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#374151', width: '11%' }}>To Charge</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {worklogs.map((worklog, idx) => {
                                                    const hours = parseFloat(worklog.calculated_hours) || 0;
                                                    const baseRate = worklog.surcharges_breakdown?.base_rate || 0;
                                                    const surchargeAmount = worklog.surcharges_breakdown?.total_surcharge_amount || 0;
                                                    const allowancesAmount = worklog.surcharges_breakdown?.total_allowances_amount || 0;
                                                    const totalCharge = (hours * baseRate) + surchargeAmount + allowancesAmount;

                                                    // Get surcharge breakdown by type - use API data directly
                                                    const hoursBreakdown = worklog.hours_breakdown || {};
                                                    const surchargesBreakdown = worklog.surcharges_breakdown?.breakdown || worklog.hours_breakdown?.surcharges || [];
                                                    const surchargeBreakdown: Record<string, { hours: number; amount: number }> = {};

                                                    // Use surcharges from API directly
                                                    if (Array.isArray(surchargesBreakdown)) {
                                                        surchargesBreakdown.forEach((s: any) => {
                                                            const name = s.name || s.category || 'surcharge';
                                                            surchargeBreakdown[name] = {
                                                                hours: s.hours || 0,
                                                                amount: s.amount || 0
                                                            };
                                                        });
                                                    }

                                                    // Calculate break minutes
                                                    let breakMinutes = 0;
                                                    if (worklog.breaks && Array.isArray(worklog.breaks)) {
                                                        breakMinutes = worklog.breaks.reduce((total: number, brk: any) => {
                                                            if (brk.start && brk.end) {
                                                                const [startH, startM] = brk.start.split(':').map(Number);
                                                                const [endH, endM] = brk.end.split(':').map(Number);
                                                                return total + ((endH * 60 + endM) - (startH * 60 + startM));
                                                            }
                                                            return total;
                                                        }, 0);
                                                    } else {
                                                        breakMinutes = worklog.break_minutes || worklog.break_duration || 0;
                                                    }

                                                    return (
                                                        <tr key={worklog.id} style={{ borderTop: idx > 0 ? '1px solid #E5E7EB' : 'none' }}>
                                                            <td style={{ padding: '12px 14px', fontWeight: 500, color: '#1F2937' }}>
                                                                <a href={`/dashboard/employees/${worklog.employee_profile_id || worklog.employee}`} target="_blank" style={{ color: '#1E3A5F', textDecoration: 'none' }}>
                                                                    {worklog.employee_name || 'Unknown'}
                                                                </a>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'left', color: '#6B7280' }}>
                                                                {worklog.project_name || 'N/A'}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'left', color: '#059669', fontSize: '12px', fontWeight: 500 }}>
                                                                {worklog.service_name || 'N/A'}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
                                                                {(() => {
                                                                    const dayAbbr = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                                                                    if (worklog.start_datetime) {
                                                                        return dayAbbr[new Date(worklog.start_datetime).getDay()];
                                                                    } else if (worklog.work_date) {
                                                                        return dayAbbr[new Date(worklog.work_date).getDay()];
                                                                    }
                                                                    return 'N/A';
                                                                })()}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
                                                                {(() => {
                                                                    if (worklog.start_datetime && worklog.end_datetime) {
                                                                        const startTime = new Date(worklog.start_datetime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
                                                                        const endTime = new Date(worklog.end_datetime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
                                                                        return `${startTime} - ${endTime}`;
                                                                    } else if (worklog.start_time && worklog.end_time) {
                                                                        return `${worklog.start_time.slice(0, 5)} - ${worklog.end_time.slice(0, 5)}`;
                                                                    }
                                                                    return 'N/A';
                                                                })()}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#EF4444', fontSize: '12px', fontWeight: 500 }}>
                                                                {breakMinutes > 0 ? `${breakMinutes}min` : '-'}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#D97706' }}>{hours.toFixed(1)}h</td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#6B7280' }}>€{baseRate.toFixed(2)}</td>
                                                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#8B5CF6', fontSize: '11px' }}>
                                                                {Object.keys(surchargeBreakdown).length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        {Object.entries(surchargeBreakdown).map(([key, data]) => (
                                                                            <span key={key}>
                                                                                {data.hours.toFixed(1)}h → €{data.amount.toFixed(2)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#9CA3AF' }}>-</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>€{totalCharge.toFixed(2)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ backgroundColor: '#1E3A5F', color: 'white' }}>
                                                    <td colSpan={5} style={{ padding: '14px', fontWeight: 700, fontSize: '14px' }}>
                                                        TOTAL
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>
                                                        {worklogs.reduce((sum, w) => {
                                                            let breakMins = 0;
                                                            if (w.breaks && Array.isArray(w.breaks)) {
                                                                breakMins = w.breaks.reduce((t: number, b: any) => {
                                                                    if (b.start && b.end) {
                                                                        const [sh, sm] = b.start.split(':').map(Number);
                                                                        const [eh, em] = b.end.split(':').map(Number);
                                                                        return t + ((eh * 60 + em) - (sh * 60 + sm));
                                                                    }
                                                                    return t;
                                                                }, 0);
                                                            } else {
                                                                breakMins = w.break_minutes || w.break_duration || 0;
                                                            }
                                                            return sum + breakMins;
                                                        }, 0)}min
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
                                                        {worklogs.reduce((sum, w) => sum + (parseFloat(w.calculated_hours) || 0), 0).toFixed(1)}h
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                                                        €{(worklogs.reduce((sum, w) => sum + (parseFloat(w.calculated_hours) || 0) * (w.surcharges_breakdown?.base_rate || 0), 0)).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                                                        €{worklogs.reduce((sum, w) => sum + (w.surcharges_breakdown?.total_surcharge_amount || 0), 0).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>
                                                        €{worklogs.reduce((sum, w) => {
                                                            const hours = parseFloat(w.calculated_hours) || 0;
                                                            const baseRate = w.surcharges_breakdown?.base_rate || 0;
                                                            const surchargeAmount = w.surcharges_breakdown?.total_surcharge_amount || 0;
                                                            const allowancesAmount = w.surcharges_breakdown?.total_allowances_amount || 0;
                                                            return sum + (hours * baseRate) + surchargeAmount + allowancesAmount;
                                                        }, 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                {/* Worklogs Count */}
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                    📋 {worklogs.length} work log entries ready to export
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Invoice Table */}
                {error ? (
                    <Card className="p-8 text-center">
                        <p className="text-red-600 mb-4">{error}</p>
                        <Button onClick={loadInvoices}>Retry</Button>
                    </Card>
                ) : (
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Invoice</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Customer</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Period</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Amount</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredInvoices.length === 0 ? (
                                        worklogs.length > 0 ? (
                                            // Show work logs preview when filters return work logs but no invoices
                                            <>
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-4 bg-blue-50 border-b">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <FileText className="w-4 h-4 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-blue-800">
                                                                    {worklogs.length} Work Log{worklogs.length !== 1 ? 's' : ''} Found
                                                                </p>
                                                                <p className="text-xs text-blue-600">
                                                                    No invoices generated yet. Click "Generate Invoice" to create one from these work logs.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {worklogs.slice(0, 10).map((log: any) => (
                                                    <tr key={log.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">Work Log</span>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium">{log.project_name || '-'}</td>
                                                        <td className="px-6 py-4 text-gray-500">{log.work_date}</td>
                                                        <td className="px-6 py-4 font-semibold">{log.calculated_hours || 0}h</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${log.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                log.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {log.status || 'draft'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500 text-sm">
                                                            {log.employee_name || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {worklogs.length > 10 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-3 text-center text-sm text-gray-500">
                                                            ...and {worklogs.length - 10} more work logs
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                    No invoices yet. Generate one by selecting a customer and week.
                                                </td>
                                            </tr>
                                        )
                                    ) : (
                                        filteredInvoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <span className="font-medium text-[#1E3A5F]">{invoice.invoice_number}</span>
                                                </td>
                                                <td className="px-6 py-4 font-medium">{invoice.customer_name}</td>
                                                <td className="px-6 py-4 text-gray-500">Week {invoice.week_number}, {invoice.week_year}</td>
                                                <td className="px-6 py-4 font-semibold">€{(invoice.total || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || 'bg-gray-100'}`}>
                                                        {invoice.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            className="p-2 hover:bg-gray-100 rounded-lg"
                                                            title="View"
                                                            onClick={() => loadInvoiceDetail(invoice.id)}
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-500" />
                                                        </button>
                                                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="Download PDF">
                                                            <Download className="w-4 h-4 text-gray-500" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>

            {/* Invoice Detail Modal */}
            {
                selectedInvoice && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setSelectedInvoice(null)}
                    >
                        <div
                            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Invoice {selectedInvoice.invoice_number}
                                    </h2>
                                    <p className="text-gray-500">{selectedInvoice.customer_name}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={exportPDF}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg font-medium"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export PDF
                                    </button>
                                    <button
                                        onClick={() => setSelectedInvoice(null)}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Period Info */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-sm text-gray-500">Period</p>
                                    <p className="font-semibold">
                                        Week {selectedInvoice.week_number}, {selectedInvoice.week_year}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {selectedInvoice.week_start_date} - {selectedInvoice.week_end_date}
                                    </p>
                                </div>

                                {/* Labor Hours */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users className="w-5 h-5 text-blue-600" />
                                        <h3 className="font-semibold text-lg">Labor Hours</h3>
                                    </div>
                                    <div className="bg-white border rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {selectedInvoice.lines.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No labor hours</td>
                                                    </tr>
                                                ) : (
                                                    selectedInvoice.lines.map((line) => (
                                                        <tr key={line.id}>
                                                            <td className="px-4 py-3 font-medium">{line.employee_name}</td>
                                                            <td className="px-4 py-3 text-gray-600">{line.project_name}</td>
                                                            <td className="px-4 py-3 text-right">{line.quantity_hours}h</td>
                                                            <td className="px-4 py-3 text-right">€{line.hourly_rate}</td>
                                                            <td className="px-4 py-3 text-right font-semibold">€{line.total}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Allowances */}
                                {selectedInvoice.allowance_lines.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Gift className="w-5 h-5 text-purple-600" />
                                            <h3 className="font-semibold text-lg">Allowances (Toeslag)</h3>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-100 rounded-xl overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-purple-100/50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Employee</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Allowance Type</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-700 uppercase">Hours</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-700 uppercase">Rate</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-700 uppercase">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-purple-100">
                                                    {selectedInvoice.allowance_lines.map((allowance) => (
                                                        <tr key={allowance.id}>
                                                            <td className="px-4 py-3 font-medium">{allowance.employee_name}</td>
                                                            <td className="px-4 py-3 text-purple-700">
                                                                {allowance.allowance_name || allowance.allowance_type_name || allowance.custom_name}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{allowance.quantity_hours}h</td>
                                                            <td className="px-4 py-3 text-right">€{allowance.hourly_rate}</td>
                                                            <td className="px-4 py-3 text-right font-semibold">€{allowance.total}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Gratuities */}
                                {selectedInvoice.gratuity_lines.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Coins className="w-5 h-5 text-amber-600" />
                                            <h3 className="font-semibold text-lg">Gratuities (Fooi)</h3>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-amber-100/50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-amber-700 uppercase">Employee</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-amber-700 uppercase">Description</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-amber-700 uppercase">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-amber-100">
                                                    {selectedInvoice.gratuity_lines.map((gratuity) => (
                                                        <tr key={gratuity.id}>
                                                            <td className="px-4 py-3 font-medium">{gratuity.employee_name}</td>
                                                            <td className="px-4 py-3 text-amber-700">{gratuity.description || '-'}</td>
                                                            <td className="px-4 py-3 text-right font-semibold">€{gratuity.amount}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Costs */}
                                {selectedInvoice.costs.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Briefcase className="w-5 h-5 text-gray-600" />
                                            <h3 className="font-semibold text-lg">Additional Costs</h3>
                                        </div>
                                        <div className="bg-white border rounded-xl overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedInvoice.costs.map((cost) => (
                                                        <tr key={cost.id}>
                                                            <td className="px-4 py-3 font-medium">{cost.cost_type_name}</td>
                                                            <td className="px-4 py-3 text-gray-600">{cost.description || '-'}</td>
                                                            <td className="px-4 py-3 text-right">{cost.quantity}</td>
                                                            <td className="px-4 py-3 text-right">€{cost.unit_price}</td>
                                                            <td className="px-4 py-3 text-right font-semibold">€{cost.total}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Totals */}
                                <div className="bg-[#1E3A5F] text-white rounded-xl p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-blue-200">Subtotal (Labor)</span>
                                                <span>€{selectedInvoice.subtotal.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-blue-200">Costs</span>
                                                <span>€{selectedInvoice.total_costs.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-purple-300">Allowances</span>
                                                <span>€{selectedInvoice.total_allowances.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-amber-300">Gratuities</span>
                                                <span>€{selectedInvoice.total_gratuities.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2 border-l border-blue-400/30 pl-6">
                                            <div className="flex justify-between">
                                                <span className="text-blue-200">VAT ({selectedInvoice.vat_rate}%)</span>
                                                <span>€{selectedInvoice.vat_amount.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-2xl font-bold pt-2 border-t border-blue-400/30 mt-2">
                                                <span>TOTAL</span>
                                                <span>€{selectedInvoice.total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Export Modal */}
            {showExportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1E3A5F', margin: 0 }}>
                                Export Timesheet
                            </h2>
                            <button
                                onClick={() => setShowExportModal(false)}
                                style={{
                                    padding: '8px',
                                    backgroundColor: '#F3F4F6',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} style={{ color: '#6B7280' }} />
                            </button>
                        </div>

                        {/* Worklogs count indicator */}
                        <div style={{
                            padding: '16px',
                            backgroundColor: loadingWorklogs ? '#FEF3C7' : worklogs.length > 0 ? '#D1FAE5' : '#FEE2E2',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            {loadingWorklogs ? (
                                <>
                                    <Clock size={20} style={{ color: '#D97706' }} />
                                    <span style={{ color: '#92400E', fontWeight: 500 }}>Loading worklogs...</span>
                                </>
                            ) : worklogs.length > 0 ? (
                                <>
                                    <CheckCircle size={20} style={{ color: '#059669' }} />
                                    <span style={{ color: '#065F46', fontWeight: 500 }}>{worklogs.length} worklogs ready to export</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={20} style={{ color: '#DC2626' }} />
                                    <span style={{ color: '#991B1B', fontWeight: 500 }}>No worklogs found. Please select filters first.</span>
                                </>
                            )}
                        </div>

                        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
                            Choose the export format based on who will receive the file:
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Export for HR */}
                            <button
                                onClick={() => exportExcelForCustomer('hr')}
                                disabled={worklogs.length === 0 || loadingWorklogs}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '20px',
                                    backgroundColor: worklogs.length > 0 ? '#16A34A' : '#E5E7EB',
                                    border: 'none',
                                    borderRadius: '14px',
                                    cursor: worklogs.length > 0 ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Users size={24} style={{ color: 'white' }} />
                                </div>
                                <div>
                                    <p style={{ color: 'white', fontWeight: 600, fontSize: '16px', margin: 0 }}>
                                        Export for HR
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0 0' }}>
                                        Hours overview with TOTAAL UREN (A-P)
                                    </p>
                                </div>
                            </button>

                            {/* Export for Finance */}
                            <button
                                onClick={() => exportExcelForCustomer('finance')}
                                disabled={worklogs.length === 0 || loadingWorklogs}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '20px',
                                    backgroundColor: worklogs.length > 0 ? '#1E3A5F' : '#E5E7EB',
                                    border: 'none',
                                    borderRadius: '14px',
                                    cursor: worklogs.length > 0 ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Briefcase size={24} style={{ color: 'white' }} />
                                </div>
                                <div>
                                    <p style={{ color: 'white', fontWeight: 600, fontSize: '16px', margin: 0 }}>
                                        Export for Finance
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0 0' }}>
                                        Full report with surcharges and TOTAAL BEDRAG (A-O, Q-X)
                                    </p>
                                </div>
                            </button>

                            {/* Export for Employee */}
                            <button
                                onClick={exportExcelForEmployee}
                                disabled={worklogs.length === 0 || loadingWorklogs}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '20px',
                                    backgroundColor: worklogs.length > 0 ? '#F9FAFB' : '#E5E7EB',
                                    border: worklogs.length > 0 ? '2px solid #E5E7EB' : 'none',
                                    borderRadius: '14px',
                                    cursor: worklogs.length > 0 ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    backgroundColor: '#EFF6FF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <User size={24} style={{ color: '#3B82F6' }} />
                                </div>
                                <div>
                                    <p style={{ color: '#1F2937', fontWeight: 600, fontSize: '16px', margin: 0 }}>
                                        Export for Employee (Simple)
                                    </p>
                                    <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0 0 0' }}>
                                        Basic hours overview: date, start, end, break, total
                                    </p>
                                </div>
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </DashboardLayout >
    );
}

