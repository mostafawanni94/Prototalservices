'use client';

import { useEffect, useState, useCallback, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { api, WorkEntry } from '@/lib/api';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Plus,
    Clock,
    User,
    Building2,
    Search,
    GripVertical,
    Edit2,
    Filter,
    X,
} from 'lucide-react';
import {
    startOfWeek,
    endOfWeek,
    addWeeks,
    subWeeks,
    format,
    addDays,
    isSameDay,
    isToday as isTodayFn,
    getISOWeek,
    getISOWeekYear,
} from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/* ============================================================================
   TYPES
   ============================================================================ */
interface EmployeeOption {
    id: string;
    full_name: string;
}

interface CustomerOption {
    id: string;
    company_name: string;
}

/* ============================================================================
   STATUS STYLING
   ============================================================================ */
const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
    approved: { bg: '#ECFDF5', text: '#059669', border: '#059669', label: 'Approved' },
    pending: { bg: '#FFFBEB', text: '#D97706', border: '#F59E0B', label: 'Pending' },
    submitted: { bg: '#FFFBEB', text: '#D97706', border: '#F59E0B', label: 'Submitted' },
    draft: { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF', label: 'Draft' },
    rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#EF4444', label: 'Rejected' },
    planned: { bg: '#EFF6FF', text: '#2563EB', border: '#3B82F6', label: 'Planned' },
    confirmed: { bg: '#EFF6FF', text: '#2563EB', border: '#3B82F6', label: 'Confirmed' },
    in_progress: { bg: '#FFF7ED', text: '#EA580C', border: '#F97316', label: 'In Progress' },
    cancelled: { bg: '#FEF2F2', text: '#DC2626', border: '#EF4444', label: 'Cancelled' },
    no_show: { bg: '#FEF2F2', text: '#DC2626', border: '#EF4444', label: 'No Show' },
};

function getStatusStyle(status: string) {
    return STATUS_CONFIG[status] || STATUS_CONFIG.draft;
}

/* ============================================================================
   HELPER: format time from ISO datetime string
   ============================================================================ */
function formatTime(isoString?: string | null): string {
    if (!isoString) return '--:--';
    // Backend returns "YYYY-MM-DDTHH:mm:ss" (no timezone)
    const timePart = isoString.split('T')[1];
    return timePart ? timePart.substring(0, 5) : '--:--';
}

/* ============================================================================
   WORK LOG CARD COMPONENT
   ============================================================================ */
function WorkLogCard({
    entry,
    onEdit,
    onDragStart,
}: {
    entry: WorkEntry;
    onEdit: (entry: WorkEntry) => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, entry: WorkEntry) => void;
}) {
    const statusStyle = getStatusStyle(entry.status);
    const hours = typeof entry.calculated_hours === 'number'
        ? entry.calculated_hours
        : parseFloat(String(entry.calculated_hours) || '0');
    const maxHours = 8;
    const progressPercent = Math.min(100, (hours / maxHours) * 100);

    const timeRange = `${formatTime(entry.actual_start_datetime)} – ${formatTime(entry.actual_end_datetime)}`;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, entry)}
            style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                borderLeft: `4px solid ${statusStyle.border}`,
                padding: '12px 14px',
                cursor: 'grab',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                position: 'relative',
            }}
            className="weekly-board-card"
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
        >
            {/* Drag handle + Edit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#D1D5DB' }}>
                    <GripVertical size={14} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Status badge */}
                    <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        {statusStyle.label}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            color: '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        className="hover:bg-gray-100"
                        title="Edit work log"
                    >
                        <Edit2 size={13} />
                    </button>
                </div>
            </div>

            {/* Employee name */}
            <p style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#1F2937',
                margin: '0 0 4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
                {entry.employee_name || 'Unassigned'}
            </p>

            {/* Project / Customer */}
            <p style={{
                fontSize: '11px',
                color: '#6B7280',
                margin: '0 0 8px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
                {entry.project_name}
                {entry.customer_name ? ` · ${entry.customer_name}` : ''}
            </p>

            {/* Time range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <Clock size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#6B7280' }}>{timeRange}</span>
            </div>

            {/* Hours progress bar */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500 }}>Hours</span>
                    <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600 }}>
                        {hours.toFixed(1)}h / {maxHours}h
                    </span>
                </div>
                <div style={{
                    height: '5px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '3px',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent >= 100 ? '#059669' : progressPercent >= 50 ? '#3B82F6' : '#F59E0B',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease',
                    }} />
                </div>
            </div>
        </div>
    );
}

/* ============================================================================
   DAY COLUMN COMPONENT
   ============================================================================ */
function DayColumn({
    date,
    entries,
    onEdit,
    onAdd,
    onDragStart,
    onDrop,
    dragOverDate,
    onDragOver,
    onDragLeave,
}: {
    date: Date;
    entries: WorkEntry[];
    onEdit: (entry: WorkEntry) => void;
    onAdd: (date: Date) => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, entry: WorkEntry) => void;
    onDrop: (e: DragEvent<HTMLDivElement>, date: Date) => void;
    dragOverDate: string | null;
    onDragOver: (e: DragEvent<HTMLDivElement>, date: Date) => void;
    onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
}) {
    const isToday = isTodayFn(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isDragTarget = dragOverDate === dateStr;

    const totalHours = entries.reduce((sum, e) => {
        const h = typeof e.calculated_hours === 'number'
            ? e.calculated_hours
            : parseFloat(String(e.calculated_hours) || '0');
        return sum + h;
    }, 0);

    return (
        <div
            onDragOver={(e) => onDragOver(e, date)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, date)}
            style={{
                flex: 1,
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isDragTarget ? '#EFF6FF' : isToday ? '#FAFBFF' : '#FFFFFF',
                borderRadius: '12px',
                border: isDragTarget
                    ? '2px dashed #3B82F6'
                    : isToday
                        ? '1.5px solid #3B82F6'
                        : '1px solid #E5E7EB',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Day header */}
            <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid #F3F4F6',
                backgroundColor: isToday ? '#EFF6FF' : '#F9FAFB',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: isToday ? '#2563EB' : '#9CA3AF',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            margin: 0,
                        }}>
                            {format(date, 'EEE')}
                        </p>
                        <p style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: isToday ? '#2563EB' : '#1F2937',
                            margin: '2px 0 0',
                            lineHeight: 1,
                        }}>
                            {format(date, 'd')}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '10px', color: '#9CA3AF', margin: 0 }}>
                            {entries.length} {entries.length === 1 ? 'log' : 'logs'}
                        </p>
                        <p style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, margin: '2px 0 0' }}>
                            {totalHours.toFixed(1)}h
                        </p>
                    </div>
                </div>
            </div>

            {/* Cards container */}
            <div style={{
                flex: 1,
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                minHeight: '200px',
            }}>
                {entries.length === 0 && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#D1D5DB',
                        fontSize: '12px',
                        fontStyle: 'italic',
                    }}>
                        No work logs
                    </div>
                )}
                {entries.map((entry) => (
                    <WorkLogCard
                        key={entry.id}
                        entry={entry}
                        onEdit={onEdit}
                        onDragStart={onDragStart}
                    />
                ))}
            </div>

            {/* Add button */}
            <div style={{ padding: '8px 10px', borderTop: '1px solid #F3F4F6' }}>
                <button
                    onClick={() => onAdd(date)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: '1px dashed #D1D5DB',
                        borderRadius: '8px',
                        color: '#9CA3AF',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                    className="hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600"
                >
                    <Plus size={14} />
                    Add
                </button>
            </div>
        </div>
    );
}

/* ============================================================================
   MAIN PAGE COMPONENT
   ============================================================================ */
export default function WeeklyBoardPage() {
    const router = useRouter();

    // Week navigation state
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
        startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
    );

    // Data state
    const [workLogs, setWorkLogs] = useState<WorkEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [filterEmployees, setFilterEmployees] = useState<string[]>([]);
    const [filterCustomer, setFilterCustomer] = useState('');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Drag-and-drop state
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Week dates array (Mon-Sun)
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
    const weekEnd = weekDates[6];
    const weekNumber = getISOWeek(currentWeekStart);

    /* ========================================================================
       DATA FETCHING
       ======================================================================== */
    const loadWorkLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const year = getISOWeekYear(currentWeekStart);
            // getISOWeek gives the correct ISO week number
            const week = getISOWeek(currentWeekStart);
            const response = await api.getWorkEntries({
                include_past: true,
                page_size: 200,
                week_year: year,
                week_number: week,
            });
            setWorkLogs(response.results || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load work logs');
        } finally {
            setLoading(false);
        }
    }, [currentWeekStart]);

    const loadEmployees = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/employees/profiles/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setEmployees((data.results || data).map((e: any) => ({
                    id: e.id,
                    full_name: e.full_name,
                })));
            }
        } catch (err) {
            console.error('Failed to load employees:', err);
        }
    }, []);

    const loadCustomers = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/customers/customers/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setCustomers((data.results || data).map((c: any) => ({
                    id: c.id,
                    company_name: c.company_name,
                })));
            }
        } catch (err) {
            console.error('Failed to load customers:', err);
        }
    }, []);

    useEffect(() => {
        loadWorkLogs();
    }, [loadWorkLogs]);

    useEffect(() => {
        loadEmployees();
        loadCustomers();
    }, [loadEmployees, loadCustomers]);

    /* ========================================================================
       FILTERING
       ======================================================================== */
    const filteredLogs = workLogs.filter((log) => {
        // Date range: only include logs within the displayed week
        const logDate = log.work_date;
        const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        if (logDate < weekStartStr || logDate > weekEndStr) return false;

        // Employee filter (multi-select)
        if (filterEmployees.length > 0) {
            const matchesEmployee = filterEmployees.some(empId =>
                (log as any).employee === empId || log.employee_id === empId
            );
            if (!matchesEmployee) return false;
        }

        // Customer filter
        if (filterCustomer && log.customer_name) {
            const selectedCustomer = customers.find(c => c.id === filterCustomer);
            if (selectedCustomer && log.customer_name !== selectedCustomer.company_name) return false;
        }

        return true;
    });

    /* ========================================================================
       DRAG & DROP HANDLERS
       ======================================================================== */
    function handleDragStart(e: DragEvent<HTMLDivElement>, entry: WorkEntry) {
        setDraggingId(entry.id);
        e.dataTransfer.setData('text/plain', entry.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e: DragEvent<HTMLDivElement>, date: Date) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverDate(format(date, 'yyyy-MM-dd'));
    }

    function handleDragLeave(e: DragEvent<HTMLDivElement>) {
        // Only clear if we're leaving the column entirely
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!e.currentTarget.contains(relatedTarget)) {
            setDragOverDate(null);
        }
    }

    async function handleDrop(e: DragEvent<HTMLDivElement>, targetDate: Date) {
        e.preventDefault();
        setDragOverDate(null);

        const entryId = e.dataTransfer.getData('text/plain');
        if (!entryId) return;

        const entry = workLogs.find(w => w.id === entryId);
        if (!entry) return;

        const newDateStr = format(targetDate, 'yyyy-MM-dd');
        if (entry.work_date === newDateStr) {
            setDraggingId(null);
            return; // Same day, no change needed
        }

        // Optimistic update
        setWorkLogs(prev =>
            prev.map(w => w.id === entryId ? { ...w, work_date: newDateStr } : w)
        );

        try {
            const response = await fetch(`${API_URL}/worklogs/entries/${entryId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({ work_date: newDateStr }),
            });

            if (!response.ok) {
                // Revert optimistic update
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to update work log date:', errorData);
                await loadWorkLogs(); // Reload to get correct state
            }
        } catch (err) {
            console.error('Failed to update work log date:', err);
            await loadWorkLogs(); // Revert on error
        }

        setDraggingId(null);
    }

    /* ========================================================================
       WEEK NAVIGATION
       ======================================================================== */
    function goToPreviousWeek() {
        setCurrentWeekStart(prev => subWeeks(prev, 1));
    }

    function goToNextWeek() {
        setCurrentWeekStart(prev => addWeeks(prev, 1));
    }

    function goToThisWeek() {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    }

    /* ========================================================================
       CARD ACTIONS
       ======================================================================== */
    function handleEdit(entry: WorkEntry) {
        router.push(`/dashboard/worklogs/${entry.id}`);
    }

    function handleAdd(date: Date) {
        const dateStr = format(date, 'yyyy-MM-dd');
        router.push(`/dashboard/worklogs/add?date=${dateStr}&returnUrl=/dashboard/weekly-board`);
    }

    /* ========================================================================
       FILTER HELPERS
       ======================================================================== */
    const filteredEmployeeOptions = employees.filter(e =>
        e.full_name?.toLowerCase().includes(employeeSearch.toLowerCase()) &&
        !filterEmployees.includes(e.id)
    );

    const filteredCustomerOptions = customers.filter(c =>
        c.company_name?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const selectedEmployeeNames = employees.filter(e => filterEmployees.includes(e.id));
    const selectedCustomerName = customers.find(c => c.id === filterCustomer)?.company_name;

    const activeFilterCount = (filterEmployees.length > 0 ? 1 : 0) + (filterCustomer ? 1 : 0);

    function toggleEmployee(empId: string) {
        setFilterEmployees(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    }

    function removeEmployee(empId: string) {
        setFilterEmployees(prev => prev.filter(id => id !== empId));
    }

    /* ========================================================================
       RENDER
       ======================================================================== */
    return (
        <DashboardLayout>
            <div style={{ padding: '24px' }}>
                {/* ── Header ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
                            Weekly Board
                        </h1>
                        <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
                            Drag and drop work logs across days to reschedule
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 16px',
                                backgroundColor: activeFilterCount > 0 ? '#EFF6FF' : 'white',
                                border: activeFilterCount > 0 ? '1.5px solid #3B82F6' : '1px solid #D1D5DB',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: activeFilterCount > 0 ? '#2563EB' : '#374151',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            className="hover:bg-gray-50"
                        >
                            <Filter size={16} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span style={{
                                    backgroundColor: '#3B82F6',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                }}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Refresh */}
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

                {/* ── Filters Panel ── */}
                {showFilters && (
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '20px',
                        padding: '16px 20px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                    }}>
                        {/* Employee filter (multi-select) */}
                        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px', display: 'block' }}>
                                <User size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                Employees {filterEmployees.length > 0 && <span style={{ color: '#3B82F6' }}>({filterEmployees.length})</span>}
                            </label>

                            {/* Selected employee chips */}
                            {selectedEmployeeNames.length > 0 && (
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                    marginBottom: '8px',
                                }}>
                                    {selectedEmployeeNames.map(emp => (
                                        <span
                                            key={emp.id}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                backgroundColor: '#EFF6FF',
                                                border: '1px solid #BFDBFE',
                                                borderRadius: '16px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: '#1D4ED8',
                                            }}
                                        >
                                            {emp.full_name}
                                            <button
                                                onClick={() => removeEmployee(emp.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#60A5FA',
                                                    padding: '0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => { setFilterEmployees([]); setEmployeeSearch(''); }}
                                        style={{
                                            fontSize: '11px',
                                            color: '#9CA3AF',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px 6px',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                <input
                                    type="text"
                                    value={employeeSearch}
                                    onChange={(e) => { setEmployeeSearch(e.target.value); setShowEmployeeDropdown(true); }}
                                    onFocus={() => setShowEmployeeDropdown(true)}
                                    placeholder="Search employees…"
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px 9px 32px',
                                        borderRadius: '8px',
                                        border: '1px solid #D1D5DB',
                                        fontSize: '13px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            {showEmployeeDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: '1px solid #E5E7EB',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 20,
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    marginTop: '4px',
                                }}>
                                    {filteredEmployeeOptions.map((emp) => (
                                        <button
                                            key={emp.id}
                                            onClick={() => {
                                                toggleEmployee(emp.id);
                                                setEmployeeSearch('');
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 14px',
                                                fontSize: '13px',
                                                color: '#374151',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                            className="hover:bg-gray-50"
                                        >
                                            <span style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                border: '1.5px solid #D1D5DB',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                backgroundColor: 'white',
                                            }}>
                                            </span>
                                            {emp.full_name}
                                        </button>
                                    ))}
                                    {filteredEmployeeOptions.length === 0 && (
                                        <p style={{ padding: '10px 14px', fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                                            {employees.length === filterEmployees.length ? 'All employees selected' : 'No employees found'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Customer filter */}
                        <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px', display: 'block' }}>
                                <Building2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                Customer
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={showCustomerDropdown ? customerSearch : (selectedCustomerName || '')}
                                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    placeholder="All customers"
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        paddingRight: filterCustomer ? '32px' : '12px',
                                        borderRadius: '8px',
                                        border: '1px solid #D1D5DB',
                                        fontSize: '13px',
                                        outline: 'none',
                                    }}
                                />
                                {filterCustomer && (
                                    <button
                                        onClick={() => { setFilterCustomer(''); setCustomerSearch(''); }}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#9CA3AF',
                                            padding: '2px',
                                            display: 'flex',
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {showCustomerDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: '1px solid #E5E7EB',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 20,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    marginTop: '4px',
                                }}>
                                    {filteredCustomerOptions.map((cust) => (
                                        <button
                                            key={cust.id}
                                            onClick={() => {
                                                setFilterCustomer(cust.id);
                                                setCustomerSearch('');
                                                setShowCustomerDropdown(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 14px',
                                                fontSize: '13px',
                                                color: '#374151',
                                                background: cust.id === filterCustomer ? '#EFF6FF' : 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                            className="hover:bg-gray-50"
                                        >
                                            {cust.company_name}
                                        </button>
                                    ))}
                                    {filteredCustomerOptions.length === 0 && (
                                        <p style={{ padding: '10px 14px', fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                                            No customers found
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Clear filters */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => {
                                    setFilterEmployees([]);
                                    setFilterCustomer('');
                                    setEmployeeSearch('');
                                    setCustomerSearch('');
                                }}
                                style={{
                                    padding: '9px 16px',
                                    backgroundColor: 'white',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: '#EF4444',
                                    cursor: 'pointer',
                                    alignSelf: 'flex-end',
                                }}
                                className="hover:bg-red-50"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                )}

                {/* ── Week Navigation ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                    padding: '14px 20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                }}>
                    <button
                        onClick={goToPreviousWeek}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            cursor: 'pointer',
                        }}
                        className="hover:bg-gray-100"
                    >
                        <ChevronLeft size={16} />
                        Previous
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <Calendar size={18} style={{ color: '#3B82F6' }} />
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>
                                    Week {weekNumber}
                                </span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
                                {format(currentWeekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                            </p>
                        </div>
                        <button
                            onClick={goToThisWeek}
                            style={{
                                padding: '6px 14px',
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#2563EB',
                                cursor: 'pointer',
                            }}
                            className="hover:bg-blue-100"
                        >
                            Today
                        </button>
                    </div>

                    <button
                        onClick={goToNextWeek}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            cursor: 'pointer',
                        }}
                        className="hover:bg-gray-100"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* ── Summary Stats Bar ── */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                }}>
                    {[
                        { label: 'Total Logs', value: filteredLogs.length, color: '#3B82F6', bg: '#EFF6FF' },
                        { label: 'Total Hours', value: `${filteredLogs.reduce((s, l) => s + (typeof l.calculated_hours === 'number' ? l.calculated_hours : parseFloat(String(l.calculated_hours) || '0')), 0).toFixed(1)}h`, color: '#059669', bg: '#ECFDF5' },
                        { label: 'Approved', value: filteredLogs.filter(l => l.status === 'approved').length, color: '#059669', bg: '#ECFDF5' },
                        { label: 'Pending', value: filteredLogs.filter(l => ['pending', 'submitted', 'draft'].includes(l.status)).length, color: '#D97706', bg: '#FFFBEB' },
                    ].map((stat) => (
                        <div key={stat.label} style={{
                            flex: 1,
                            minWidth: '120px',
                            padding: '12px 16px',
                            backgroundColor: stat.bg,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <div>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: stat.color, margin: '2px 0 0' }}>
                                    {stat.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Loading / Error ── */}
                {loading && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 0',
                        color: '#6B7280',
                        fontSize: '14px',
                    }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            border: '3px solid #E5E7EB',
                            borderTopColor: '#3B82F6',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            marginRight: '12px',
                        }} />
                        Loading work logs...
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '16px 20px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '10px',
                        color: '#DC2626',
                        fontSize: '14px',
                        marginBottom: '20px',
                    }}>
                        {error}
                    </div>
                )}

                {/* ── Weekly Grid ── */}
                {!loading && !error && (
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        paddingBottom: '8px',
                    }}>
                        {weekDates.map((date) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const dayEntries = filteredLogs
                                .filter(log => log.work_date === dateStr)
                                .sort((a, b) => {
                                    // Sort by actual start time, then by employee name
                                    const timeA = a.actual_start_datetime || '';
                                    const timeB = b.actual_start_datetime || '';
                                    return timeA.localeCompare(timeB) || (a.employee_name || '').localeCompare(b.employee_name || '');
                                });

                            return (
                                <DayColumn
                                    key={dateStr}
                                    date={date}
                                    entries={dayEntries}
                                    onEdit={handleEdit}
                                    onAdd={handleAdd}
                                    onDragStart={handleDragStart}
                                    onDrop={handleDrop}
                                    dragOverDate={dragOverDate}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Close dropdowns on outside click */}
            {(showEmployeeDropdown || showCustomerDropdown) && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                    onClick={() => {
                        setShowEmployeeDropdown(false);
                        setShowCustomerDropdown(false);
                    }}
                />
            )}

            {/* Spinner animation */}
            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
