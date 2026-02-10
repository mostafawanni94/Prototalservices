const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
}

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        // Auto-load token from localStorage if available (client-side only)
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('access_token');
        }
    }

    setToken(token: string | null) {
        this.token = token;
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('access_token', token);
            } else {
                localStorage.removeItem('access_token');
            }
        }
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const requestHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...headers,
        };

        if (this.token) {
            requestHeaders['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(error.detail || error.message || 'Request failed');
        }

        // Handle 204 No Content (DELETE success) - return empty object
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return {} as T;
        }

        // Try to parse JSON, return empty object if body is empty
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text);
    }

    // Auth
    async login(email: string, password: string) {
        const data = await this.request<{ access: string; refresh: string }>('/auth/token/', {
            method: 'POST',
            body: { email, password },
        });
        this.token = data.access;
        return data;
    }

    // Employees
    async getEmployees(page = 1) {
        return this.request<PaginatedResponse<Employee>>(`/employees/profiles/?page=${page}`);
    }

    async getEmployee(id: string) {
        return this.request<Employee>(`/employees/profiles/${id}/`);
    }

    async getPendingEmployees() {
        return this.request<Employee[]>('/employees/profiles/pending_approval/');
    }

    async approveEmployee(id: string, data: ApprovalData) {
        return this.request<Employee>(`/employees/profiles/${id}/approve/`, {
            method: 'POST',
            body: data as unknown as Record<string, unknown>,
        });
    }

    async rejectEmployee(id: string, reason: string) {
        return this.request<Employee>(`/employees/profiles/${id}/reject/`, {
            method: 'POST',
            body: { reason },
        });
    }

    // Customers
    async getCustomers(page = 1) {
        return this.request<PaginatedResponse<Customer>>(`/customers/customers/?page=${page}`);
    }

    async getCustomer(id: string) {
        return this.request<Customer>(`/customers/customers/${id}/`);
    }

    // Projects
    async getProjects(page = 1) {
        return this.request<PaginatedResponse<Project>>(`/projects/projects/?page=${page}`);
    }

    async getProject(id: string) {
        return this.request<Project>(`/projects/projects/${id}/`);
    }

    // Work Entries (Unified - replaces WorkLogs and ShiftAssignments)
    async getWorkEntries(params?: {
        page?: number;
        page_size?: number;
        status?: string;
        customer?: string;
        employee?: string[];
        week_year?: number;
        week_number?: number;
        include_past?: boolean;
    }) {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
        if (params?.status) queryParams.append('status', params.status);
        if (params?.customer) queryParams.append('customer', params.customer);
        if (params?.employee) params.employee.forEach(e => queryParams.append('employee', e));
        if (params?.week_year) queryParams.append('week_year', params.week_year.toString());
        if (params?.week_number) queryParams.append('week_number', params.week_number.toString());
        if (params?.include_past) queryParams.append('include_past', 'true');
        const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return this.request<PaginatedResponse<WorkEntry>>(`/worklogs/entries/${query}`);
    }

    async getWorkEntry(id: string) {
        return this.request<WorkEntry>(`/worklogs/entries/${id}/`);
    }

    async createWorkEntry(data: Partial<WorkEntry>) {
        return this.request<WorkEntry>('/worklogs/entries/', {
            method: 'POST',
            body: data as unknown as Record<string, unknown>,
        });
    }

    async updateWorkEntry(id: string, data: Partial<WorkEntry>) {
        return this.request<WorkEntry>(`/worklogs/entries/${id}/`, {
            method: 'PATCH',
            body: data as unknown as Record<string, unknown>,
        });
    }

    async getPendingWorkEntries() {
        return this.request<WorkEntry[]>('/worklogs/entries/pending/');
    }

    async approveWorkEntry(id: string, data?: { adjusted_hours?: number; admin_notes?: string }) {
        return this.request<WorkEntry>(`/worklogs/entries/${id}/approve/`, {
            method: 'POST',
            body: data as unknown as Record<string, unknown>,
        });
    }

    async rejectWorkEntry(id: string, reason: string) {
        return this.request<WorkEntry>(`/worklogs/entries/${id}/reject/`, {
            method: 'POST',
            body: { reason },
        });
    }

    async deleteWorkEntry(id: string) {
        return this.request<void>(`/worklogs/entries/${id}/`, {
            method: 'DELETE',
        });
    }

    // Legacy Work Logs (kept for backward compatibility)
    async getWorkLogs(page = 1) {
        return this.request<PaginatedResponse<WorkLog>>(`/worklogs/?page=${page}`);
    }

    async getPendingWorkLogs() {
        return this.request<WorkLog[]>('/worklogs/pending/');
    }

    async approveWorkLog(id: string, data?: { adjusted_hours?: number; admin_notes?: string }) {
        return this.request<WorkLog>(`/worklogs/${id}/approve/`, {
            method: 'POST',
            body: data as unknown as Record<string, unknown>,
        });
    }

    async rejectWorkLog(id: string, reason: string) {
        return this.request<WorkLog>(`/worklogs/${id}/reject/`, {
            method: 'POST',
            body: { reason },
        });
    }

    async deleteWorkLog(id: string) {
        return this.request<void>(`/worklogs/${id}/`, {
            method: 'DELETE',
        });
    }

    // Advances
    async getPendingAdvances() {
        return this.request<Advance[]>('/wallet/advances/pending/');
    }

    async approveAdvance(id: string) {
        return this.request<Advance>(`/wallet/advances/${id}/approve/`, { method: 'POST' });
    }

    async rejectAdvance(id: string, reason: string) {
        return this.request<Advance>(`/wallet/advances/${id}/reject/`, {
            method: 'POST',
            body: { reason },
        });
    }

    // Invoices
    async getInvoices(page = 1) {
        return this.request<PaginatedResponse<Invoice>>(`/invoices/invoices/?page=${page}`);
    }

    async generateInvoice(customerId: string, weekYear: number, weekNumber: number) {
        return this.request<Invoice>('/invoices/invoices/generate/', {
            method: 'POST',
            body: { customer_id: customerId, week_year: weekYear, week_number: weekNumber },
        });
    }

    // Dashboard
    async getDashboardStats() {
        return {
            pendingEmployees: (await this.getPendingEmployees()).length,
            pendingWorkLogs: (await this.getPendingWorkLogs()).length,
            pendingAdvances: (await this.getPendingAdvances()).length,
        };
    }
}

export const api = new ApiClient(API_BASE_URL);

// Types
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface Employee {
    id: string;
    user_email: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    prefix_name?: string;
    initials?: string;
    status: string;
    rejection_reason?: string;

    // Personal Information
    gender?: string;
    date_of_birth?: string;
    birthplace?: string;
    bsn?: string;
    nationality?: string;

    // Contact
    phone_number?: string;
    address?: string;
    postcode?: string;
    city?: string;

    // Financial
    iban?: string;

    // ID Document
    document_type_name?: string;
    document_number?: string;
    document_expiry_date?: string;
    id_document_front?: string;
    id_document_back?: string;
    id_document_pdf?: string;

    // Driver's License
    has_drivers_license?: boolean;
    drivers_license_front?: string;
    drivers_license_back?: string;

    // Contract
    contract_phase?: string;
    contract_start_date?: string;
    contract_end_date?: string;
    hourly_rate?: number;

    // Timestamps
    created_at: string;
    submitted_at?: string;
    approved_at?: string;
}

export interface Customer {
    id: string;
    company_name: string;
    city: string;
    country: string;
    is_active: boolean;
    created_at: string;
    logo?: string;
}

export interface Project {
    id: string;
    name: string;
    location: string;
    customer_name: string;
    status: string;
    start_date: string;
    created_at: string;
    customer: string;
    assignments_count?: number;
}

export interface WorkLog {
    id: string;
    employee_name: string;
    customer_name?: string;
    project_name: string;
    work_date: string;
    start_time: string;
    end_time: string;
    calculated_hours: number;
    status: string;
    notes: string;
    // Link to planning system
    shift_assignment?: string | null;
    shift_assignment_info?: {
        id: string;
        date: string;
        shift_name: string;
        shift_color: string;
        project_name: string;
    } | null;
}

export interface Advance {
    id: string;
    employee_name: string;
    amount: number;
    reason: string;
    status: string;
    created_at: string;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    customer: string;
    customer_name: string;
    week_year: number;
    week_number: number;
    total: number;
    status: string;
    created_at: string;
}

export interface ApprovalData {
    contract_phase: string;
    contract_start_date: string;
    contract_end_date: string;
}

// Unified Work Entry (combines ShiftAssignment + WorkLog)
export interface WorkEntry {
    id: string;
    status: 'planned' | 'confirmed' | 'cancelled' | 'no_show' | 'in_progress' | 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected';
    work_date: string;

    // Employee
    employee_id: string;
    employee_name: string;

    // Project
    project_id: string;
    project_name: string;
    customer_name?: string;

    // Shift template
    shift_name?: string;
    shift_color?: string;

    // Planned times
    planned_start_time?: string;
    planned_end_time?: string;

    // Actual times
    actual_start_datetime?: string;
    actual_end_datetime?: string;
    display_time_range?: string;

    // Supervisor
    supervisor_name?: string;
    supervisor_phone?: string;
    supervisor_email?: string;

    // Location
    location?: string;
    full_address?: string;

    // Computed
    calculated_hours: number;
    is_today?: boolean;
    is_past?: boolean;
    is_future?: boolean;
    can_fill_data?: boolean;

    // Notes
    notes?: string;
    admin_notes?: string;
    rejection_reason?: string;

    // Billing
    billing_week_year?: number;
    billing_week_number?: number;

    // Timestamps
    created_at: string;
    submitted_at?: string;
    approved_at?: string;
    confirmed_at?: string;
}
