"""
WorkLog models for Pro Totaal Service.

Handles:
- Time evidence recording (start/break/end)
- Photos and notes
- Admin approval workflow
- Weekly billing integration
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel



# =============================================================================
# LEGACY MODELS REMOVED
# =============================================================================
# WorkLog, WorkLogPhoto, WorkLogAllowance models have been removed.
# All data has been migrated to the unified WorkEntry model.
# See migration 0013_delete_legacy_tables.py

# =============================================================================
# SHIFT (Admin-scheduled work)
# =============================================================================

class Shift(BaseModel):
    """
    Admin-scheduled work shift.
    
    Workflow:
    1. Admin schedules shift for employee (date, project, supervisor info)
    2. Employee sees shift in app - can view future shifts
    3. On scheduled day, employee fills actual times and submits
    4. Admin approves → WorkLog created
    
    Key rule: Employee can only fill data on the scheduled day.
    """
    
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'           # Admin created
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'   # Employee saw it
        IN_PROGRESS = 'in_progress', 'In Progress'     # Employee filling data
        SUBMITTED = 'submitted', 'Submitted'           # Waiting approval
        APPROVED = 'approved', 'Approved'              # Done, WorkLog created
        REJECTED = 'rejected', 'Rejected'              # Rejected, needs revision
        MISSED = 'missed', 'Missed'                    # Day passed, not filled
        CANCELLED = 'cancelled', 'Cancelled'           # Admin cancelled
    
    # Assignment
    employee = models.ForeignKey(
        'employees.EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='shifts',
        verbose_name="Employee"
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='shifts',
        verbose_name="Project"
    )
    supervisor = models.ForeignKey(
        'customers.Outfolder',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='shifts',
        verbose_name="Supervisor"
    )
    service = models.ForeignKey(
        'customers.Service',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='shifts',
        verbose_name="Service Type"
    )
    
    # Schedule (Admin sets these)
    scheduled_date = models.DateField(
        verbose_name="Scheduled Date"
    )
    scheduled_start_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Expected Start Time"
    )
    scheduled_end_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Expected End Time"
    )
    
    # Admin notes for employee
    location_notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Location/Address Notes"
    )
    supervisor_phone = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name="Supervisor Phone"
    )
    supervisor_email = models.EmailField(
        blank=True,
        default='',
        verbose_name="Supervisor Email"
    )
    special_instructions = models.TextField(
        blank=True,
        default='',
        verbose_name="Special Instructions"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        verbose_name="Status"
    )
    
    # Employee fills these on the scheduled day
    actual_start_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Actual Start Time"
    )
    actual_end_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Actual End Time"
    )
    break_start_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Break Start Time"
    )
    break_end_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Break End Time"
    )
    employee_notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Employee Notes"
    )
    
    # Approval
    rejection_reason = models.TextField(
        blank=True,
        default='',
        verbose_name="Rejection Reason"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='approved_shifts',
        verbose_name="Approved By"
    )
    approved_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Approved At"
    )
    
    # Link to WorkEntry when approved (replaced old WorkLog link)
    work_entry = models.OneToOneField(
        'worklogs.WorkEntry',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='source_shift',
        verbose_name="Created Work Entry"
    )
    
    class Meta:
        verbose_name = 'Shift'
        verbose_name_plural = 'Shifts'
        ordering = ['-scheduled_date', 'scheduled_start_time']
    
    def __str__(self):
        return f"{self.employee} - {self.project} - {self.scheduled_date}"
    
    @property
    def is_today(self):
        """Check if shift is scheduled for today."""
        from django.utils import timezone
        return self.scheduled_date == timezone.localdate()
    
    @property
    def is_past(self):
        """Check if scheduled date has passed."""
        from django.utils import timezone
        return self.scheduled_date < timezone.localdate()
    
    @property
    def is_future(self):
        """Check if scheduled date is in the future."""
        from django.utils import timezone
        return self.scheduled_date > timezone.localdate()
    
    @property
    def can_fill_data(self):
        """Employee can fill data on scheduled day or up to 7 days after (if not yet submitted)."""
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.localdate()
        # Allow filling on scheduled day or up to 7 days after
        days_since = (today - self.scheduled_date).days
        if days_since < 0 or days_since > 7:
            return False
        return self.status in [self.Status.SCHEDULED, self.Status.ACKNOWLEDGED, self.Status.IN_PROGRESS]
    
    def acknowledge(self):
        """Mark shift as seen by employee."""
        if self.status == self.Status.SCHEDULED:
            self.status = self.Status.ACKNOWLEDGED
            self.save(update_fields=['status', 'updated_at'])
    
    def fill_data(self, data):
        """Employee fills actual work data (only allowed on scheduled day)."""
        if not self.can_fill_data:
            raise ValueError("Cannot fill data - not today or already submitted")
        
        self.actual_start_time = data.get('start_time')
        self.actual_end_time = data.get('end_time')
        self.break_start_time = data.get('break_start_time')
        self.break_end_time = data.get('break_end_time')
        self.employee_notes = data.get('notes', '')
        self.status = self.Status.IN_PROGRESS
        self.save()
    
    def submit(self):
        """Submit shift for approval (only allowed on scheduled day)."""
        if not self.is_today:
            raise ValueError("Can only submit on the scheduled day")
        if self.status not in [self.Status.IN_PROGRESS, self.Status.ACKNOWLEDGED, self.Status.SCHEDULED]:
            raise ValueError("Cannot submit - already submitted or processed")
        
        self.status = self.Status.SUBMITTED
        self.save(update_fields=['status', 'updated_at'])
    
    def approve(self, admin_user):
        """Approve shift and create WorkEntry."""
        if self.status != self.Status.SUBMITTED:
            raise ValueError("Can only approve submitted shifts")
        
        # Calculate hours
        break_minutes = 0
        if self.break_start_time and self.break_end_time:
            break_start = timedelta(hours=self.break_start_time.hour, minutes=self.break_start_time.minute)
            break_end = timedelta(hours=self.break_end_time.hour, minutes=self.break_end_time.minute)
            break_minutes = int((break_end - break_start).total_seconds() / 60)
        
        # Create WorkEntry (replaces old WorkLog creation)
        from datetime import datetime
        start_dt = None
        end_dt = None
        if self.actual_start_time:
            start_dt = datetime.combine(self.scheduled_date, self.actual_start_time)
        if self.actual_end_time:
            end_dt = datetime.combine(self.scheduled_date, self.actual_end_time)
        
        work_entry = WorkEntry.objects.create(
            employee=self.employee,
            project=self.project,
            planned_supervisor=self.supervisor,
            service=self.service,
            work_date=self.scheduled_date,
            actual_start_datetime=start_dt,
            actual_end_datetime=end_dt,
            break_duration_minutes=break_minutes,
            notes=self.employee_notes,
            status=WorkEntry.Status.APPROVED,
            approved_by=admin_user,
            approved_at=timezone.now(),
            created_by=self.employee.user,
        )
        
        self.status = self.Status.APPROVED
        self.work_entry = work_entry
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.save()
        
        return work_entry
    
    def reject(self, reason):
        """Reject shift."""
        if self.status != self.Status.SUBMITTED:
            raise ValueError("Can only reject submitted shifts")
        
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])


# =============================================================================
# UNIFIED WORK ENTRY (NEW)
# =============================================================================

class WorkEntry(BaseModel):
    """
    Unified Work Entry - Single source of truth for all work records.
    
    Combines ShiftAssignment (planning) and WorkLog (actual work) into one table.
    
    Lifecycle:
        PLANNED → CONFIRMED → IN_PROGRESS → DRAFT → SUBMITTED → APPROVED/REJECTED
        
    This eliminates synchronization issues between planning and reporting.
    """
    
    class Status(models.TextChoices):
        # Planning statuses (from ShiftAssignment)
        PLANNED = 'planned', 'Planned'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'
        NO_SHOW = 'no_show', 'No Show'
        # Work statuses (from WorkLog)
        IN_PROGRESS = 'in_progress', 'In Progress'
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending Approval'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
    
    # ==========================================================================
    # CORE LINKS
    # ==========================================================================
    
    employee = models.ForeignKey(
        'employees.EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='work_entries',
        verbose_name="Employee"
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='work_entries',
        verbose_name="Project"
    )
    agency = models.ForeignKey(
        'employees.Agency',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_entries',
        verbose_name="Agency",
        help_text="If employee is from an external agency"
    )
    
    # ==========================================================================
    # PLANNING FIELDS (from ShiftAssignment / PlannedDay)
    # ==========================================================================
    
    shift_template = models.ForeignKey(
        'projects.ProjectShiftTemplate',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_entries',
        verbose_name="Shift Template",
        help_text="The shift pattern this entry is based on"
    )
    work_date = models.DateField(
        verbose_name="Work Date",
        db_index=True,
        help_text="The date of this work entry"
    )
    planned_start_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Planned Start Time",
        help_text="Scheduled start time from shift template"
    )
    planned_end_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Planned End Time",
        help_text="Scheduled end time from shift template"
    )
    planned_supervisor = models.ForeignKey(
        'customers.Outfolder',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='planned_work_entries',
        verbose_name="Planned Supervisor"
    )
    
    # ==========================================================================
    # ACTUAL WORK FIELDS (from WorkLog)
    # ==========================================================================
    
    actual_start_datetime = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Actual Start",
        help_text="When employee actually started working"
    )
    actual_end_datetime = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Actual End",
        help_text="When employee actually finished working"
    )
    
    # Breaks - JSON array of {start: "HH:MM", end: "HH:MM"}
    breaks = models.JSONField(
        blank=True,
        default=list,
        verbose_name="Breaks",
        help_text="Array of break periods [{start: HH:MM, end: HH:MM}, ...]"
    )
    break_duration_minutes = models.PositiveIntegerField(
        default=0,
        verbose_name="Break Duration (minutes)",
        help_text="Total break time in minutes"
    )
    
    # Allowances (Toeslag) - JSON array of allowances
    # Format: [{allowance_type: id, custom_allowance_name: str, hours: float, 
    #           start_time: "HH:MM", end_time: "HH:MM", notes: str}, ...]
    allowances = models.JSONField(
        blank=True,
        default=list,
        verbose_name="Allowances",
        help_text="Array of allowances [{allowance_type: id, hours: float, start_time: HH:MM, end_time: HH:MM}, ...]"
    )
    
    # Service type from customer
    service = models.ForeignKey(
        'customers.Service',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_entries',
        verbose_name="Service Type"
    )
    
    # Manual location override
    location_override = models.CharField(
        max_length=300,
        blank=True,
        default='',
        verbose_name="Location Override",
        help_text="Manual address if project location is empty"
    )
    
    # ==========================================================================
    # STATUS & WORKFLOW
    # ==========================================================================
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
        db_index=True,
        verbose_name="Status"
    )
    
    # Planning workflow timestamps
    confirmed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Confirmed At"
    )
    cancelled_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Cancelled At"
    )
    cancellation_reason = models.TextField(
        blank=True,
        default='',
        verbose_name="Cancellation Reason"
    )
    
    # Approval workflow timestamps
    submitted_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Submitted At"
    )
    approved_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Approved At"
    )
    approved_by = models.ForeignKey(
        'employees.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='approved_work_entries',
        verbose_name="Approved By"
    )
    rejection_reason = models.TextField(
        blank=True,
        default='',
        verbose_name="Rejection Reason"
    )
    
    # ==========================================================================
    # NOTES & ADMIN
    # ==========================================================================
    
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    admin_notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Admin Notes"
    )
    admin_adjusted_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Admin Adjusted Hours",
        help_text="Override calculated hours (admin only)"
    )
    
    # ==========================================================================
    # BILLING FIELDS
    # ==========================================================================
    
    billing_week_year = models.PositiveIntegerField(
        blank=True,
        null=True,
        db_index=True,
        verbose_name="Billing Week Year"
    )
    billing_week_number = models.PositiveIntegerField(
        blank=True,
        null=True,
        db_index=True,
        verbose_name="Billing Week Number"
    )
    
    # End week reference (for cross-week shifts)
    end_billing_week_year = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="End Billing Week Year"
    )
    end_billing_week_number = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="End Billing Week Number"
    )
    
    class Meta:
        verbose_name = 'Work Entry'
        verbose_name_plural = 'Work Entries'
        ordering = ['-work_date', '-actual_start_datetime']
        
        # B-tree indexes for optimal query performance
        indexes = [
            # Primary query patterns
            models.Index(fields=['employee', 'work_date'], name='workentry_emp_date_idx'),
            models.Index(fields=['work_date', 'status'], name='workentry_date_status_idx'),
            models.Index(fields=['project', 'work_date'], name='workentry_proj_date_idx'),
            models.Index(fields=['status', 'submitted_at'], name='workentry_pending_idx'),
            models.Index(fields=['billing_week_year', 'billing_week_number'], name='workentry_billing_idx'),
            # Composite for mobile queries (employee's entries by status)
            models.Index(fields=['employee', 'status', 'work_date'], name='workentry_mobile_idx'),
        ]
        
        # No unique constraint - allow multiple entries per employee per date per shift
    
    def __str__(self):
        date_str = self.work_date.strftime('%Y-%m-%d') if self.work_date else 'No date'
        return f"{self.employee} - {self.project} ({date_str})"
    
    # ==========================================================================
    # COMPUTED PROPERTIES
    # ==========================================================================
    
    @property
    def calculated_hours(self):
        """Calculate worked hours (end - start - breaks).
        
        Uses actual times if available, falls back to planned times for
        entries that haven't been filled in yet.
        """
        # Use admin override if set
        if self.admin_adjusted_hours is not None:
            return self.admin_adjusted_hours
        
        # Try actual times first (for completed/submitted entries)
        if self.actual_start_datetime and self.actual_end_datetime:
            total_duration = self.actual_end_datetime - self.actual_start_datetime
            total_minutes = total_duration.total_seconds() / 60
        # Fall back to planned times (for planned/confirmed entries)
        elif self.planned_start_time and self.planned_end_time and self.work_date:
            from datetime import datetime, timedelta
            # Create datetime objects from planned times
            start_dt = datetime.combine(self.work_date, self.planned_start_time)
            end_dt = datetime.combine(self.work_date, self.planned_end_time)
            # Handle overnight shifts
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
            total_duration = end_dt - start_dt
            total_minutes = total_duration.total_seconds() / 60
        else:
            return Decimal('0')
        
        # Subtract breaks
        break_minutes = self._get_total_break_minutes()
        work_minutes = total_minutes - break_minutes
        
        return Decimal(str(round(max(0, work_minutes) / 60, 2)))
    
    def _get_total_break_minutes(self):
        """Calculate total break minutes from breaks JSON or legacy field."""
        total = 0
        
        # Check breaks JSON array
        if self.breaks and isinstance(self.breaks, list):
            for brk in self.breaks:
                start_str = brk.get('start', '')
                end_str = brk.get('end', '')
                if start_str and end_str:
                    try:
                        start_parts = start_str.split(':')
                        end_parts = end_str.split(':')
                        start_mins = int(start_parts[0]) * 60 + int(start_parts[1])
                        end_mins = int(end_parts[0]) * 60 + int(end_parts[1])
                        if end_mins > start_mins:
                            total += (end_mins - start_mins)
                    except (ValueError, IndexError):
                        pass
        
        # Fallback to simple duration field
        if total == 0 and self.break_duration_minutes:
            total = self.break_duration_minutes
        
        return total
    
    @property
    def is_today(self):
        """Check if this entry is for today."""
        from datetime import date
        return self.work_date == date.today()
    
    @property
    def is_past(self):
        """Check if this entry is for a past date."""
        from datetime import date
        return self.work_date < date.today()
    
    @property
    def is_future(self):
        """Check if this entry is for a future date."""
        from datetime import date
        return self.work_date > date.today()
    
    @property
    def can_fill_data(self):
        """Check if employee can fill actual work times."""
        from datetime import date, timedelta
        # Can fill if: today or within 7 days, and status allows
        today = date.today()
        window_start = today - timedelta(days=7)
        in_window = window_start <= self.work_date <= today
        editable_statuses = [self.Status.PLANNED, self.Status.CONFIRMED, 
                           self.Status.IN_PROGRESS, self.Status.DRAFT, self.Status.REJECTED]
        return in_window and self.status in editable_statuses
    
    @property
    def display_time_range(self):
        """Get display time range (actual if exists, otherwise planned) in local time."""
        if self.actual_start_datetime and self.actual_end_datetime:
            from zoneinfo import ZoneInfo
            amsterdam_tz = ZoneInfo('Europe/Amsterdam')
            start_local = self.actual_start_datetime.astimezone(amsterdam_tz) if self.actual_start_datetime.tzinfo else self.actual_start_datetime
            end_local = self.actual_end_datetime.astimezone(amsterdam_tz) if self.actual_end_datetime.tzinfo else self.actual_end_datetime
            return f"{start_local.strftime('%H:%M')} - {end_local.strftime('%H:%M')}"
        elif self.planned_start_time and self.planned_end_time:
            return f"{self.planned_start_time.strftime('%H:%M')} - {self.planned_end_time.strftime('%H:%M')}"
        return "-"
    
    # ==========================================================================
    # WORKFLOW METHODS
    # ==========================================================================
    
    def confirm(self):
        """Mark entry as confirmed by employee."""
        if self.status != self.Status.PLANNED:
            raise ValueError("Can only confirm planned entries")
        self.status = self.Status.CONFIRMED
        self.confirmed_at = timezone.now()
        self.save(update_fields=['status', 'confirmed_at', 'updated_at'])
    
    def start_work(self):
        """Mark entry as in progress."""
        if self.status not in [self.Status.PLANNED, self.Status.CONFIRMED]:
            raise ValueError("Can only start work on planned or confirmed entries")
        self.status = self.Status.IN_PROGRESS
        if not self.actual_start_datetime:
            self.actual_start_datetime = timezone.now()
        self.save()
    
    def submit(self):
        """Submit entry for admin approval."""
        if self.status not in [self.Status.DRAFT, self.Status.IN_PROGRESS, self.Status.REJECTED]:
            raise ValueError("Cannot submit entry in current status")
        if not self.actual_start_datetime or not self.actual_end_datetime:
            raise ValueError("Actual times must be filled before submitting")
        self.status = self.Status.SUBMITTED
        self.submitted_at = timezone.now()
        self._calculate_billing_week()
        self.save()
    
    def approve(self, admin_user):
        """Approve entry (admin only). Can approve from any status except already approved."""
        if self.status == self.Status.APPROVED:
            raise ValueError("Already approved")
        if self.status == self.Status.CANCELLED:
            raise ValueError("Cannot approve cancelled entries")
        self.status = self.Status.APPROVED
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self._calculate_billing_week()  # Ensure billing week is set
        self.save()
    
    def reject(self, reason):
        """Reject entry with reason (can reject from any status)."""
        if self.status == self.Status.REJECTED:
            raise ValueError("Already rejected")
        if self.status == self.Status.CANCELLED:
            raise ValueError("Cannot reject cancelled entries")
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    
    def cancel(self, reason=''):
        """Cancel the entry."""
        if self.status in [self.Status.APPROVED]:
            raise ValueError("Cannot cancel approved entries")
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.cancellation_reason = reason
        self.save()
    
    def _calculate_billing_week(self):
        """Set billing week based on actual start datetime."""
        if self.actual_start_datetime:
            iso_cal = self.actual_start_datetime.isocalendar()
            self.billing_week_year = iso_cal[0]
            self.billing_week_number = iso_cal[1]
            
            # If shift spans into next week
            if self.actual_end_datetime:
                end_iso = self.actual_end_datetime.isocalendar()
                if end_iso[1] != iso_cal[1] or end_iso[0] != iso_cal[0]:
                    self.end_billing_week_year = end_iso[0]
                    self.end_billing_week_number = end_iso[1]
    
    # ==========================================================================
    # PRICE CALCULATION METHODS
    # ==========================================================================
    
    def get_service_rate(self):
        """Get hourly rate for this work entry's service from customer configuration.
        
        Returns the CustomerServiceRate price if service and project/customer are set,
        otherwise returns Decimal('0').
        """
        if not self.service or not self.project:
            return Decimal('0')
        
        from apps.customers.models import CustomerServiceRate
        
        try:
            customer = self.project.customer
            rate = CustomerServiceRate.objects.get(
                customer=customer,
                service=self.service,
                is_active=True
            )
            return rate.price
        except CustomerServiceRate.DoesNotExist:
            return Decimal('0')
    
    def get_applicable_surcharges(self):
        """Detect which surcharges apply to this work entry based on time/date.
        
        Returns a list of dicts: [{'name': 'Night Shift', 'percentage': 25.00}, ...]
        """
        from apps.employees.models import SurchargeType
        from apps.customers.models import CustomerServiceSurcharge
        
        if not self.project:
            return []
        
        customer = self.project.customer
        applicable = []
        
        # Get work times (prefer actual, fall back to planned)
        if self.actual_start_datetime and self.actual_end_datetime:
            work_start = self.actual_start_datetime
            work_end = self.actual_end_datetime
        elif self.planned_start_time and self.planned_end_time and self.work_date:
            from datetime import datetime, timedelta
            work_start = datetime.combine(self.work_date, self.planned_start_time)
            work_end = datetime.combine(self.work_date, self.planned_end_time)
            if work_end <= work_start:
                work_end += timedelta(days=1)
        else:
            return []
        
        # Check all active surcharge types
        for surcharge_type in SurchargeType.objects.filter(is_active=True):
            if self._surcharge_applies(surcharge_type, work_start, work_end):
                # Get customer-specific percentage
                try:
                    customer_surcharge = CustomerServiceSurcharge.objects.get(
                        customer=customer,
                        surcharge_type=surcharge_type,
                        is_enabled=True
                    )
                    applicable.append({
                        'id': str(surcharge_type.id),
                        'name': surcharge_type.name,
                        'category': surcharge_type.category,
                        'percentage': float(customer_surcharge.percentage)
                    })
                except CustomerServiceSurcharge.DoesNotExist:
                    pass  # Customer doesn't pay for this surcharge
        
        return applicable
    
    def _surcharge_applies(self, surcharge_type, work_start, work_end):
        """Check if a surcharge type applies to the work period.
        
        Checks:
        - Time-based surcharges (night shift: 22:00-06:00)
        - Day-of-week surcharges (weekend: Sat/Sun)
        - Specific date surcharges (holidays)
        - Overtime threshold (hours > threshold)
        """
        from datetime import datetime
        
        work_date = work_start.date()
        day_of_week = work_date.weekday()  # 0=Monday, 6=Sunday
        
        # Check day of week (e.g., weekend = [5, 6])
        if surcharge_type.days_of_week:
            if day_of_week in surcharge_type.days_of_week:
                return True
        
        # Check specific dates (e.g., ['04-27'] for King's Day)
        if surcharge_type.specific_dates:
            date_str = work_date.strftime('%m-%d')
            if date_str in surcharge_type.specific_dates:
                return True
        
        # Check time-based surcharges (e.g., night shift 22:00-06:00)
        if surcharge_type.time_from and surcharge_type.time_to:
            work_start_time = work_start.time()
            work_end_time = work_end.time()
            
            surcharge_start = surcharge_type.time_from
            surcharge_end = surcharge_type.time_to
            
            # Night shift handling (time_from > time_to means overnight)
            if surcharge_start > surcharge_end:
                # Overnight surcharge: work overlaps if start is after surcharge_start
                # OR work_start is before surcharge_end
                if work_start_time >= surcharge_start or work_start_time < surcharge_end:
                    return True
                if work_end_time > surcharge_start or work_end_time <= surcharge_end:
                    return True
            else:
                # Normal daytime surcharge
                if work_start_time >= surcharge_start and work_start_time < surcharge_end:
                    return True
                if work_end_time > surcharge_start and work_end_time <= surcharge_end:
                    return True
        
        # Check overtime threshold
        if surcharge_type.min_hours_threshold:
            hours = float(self.calculated_hours)
            if hours > float(surcharge_type.min_hours_threshold):
                return True
        
        return False
    
    def get_hours_breakdown_detailed(self):
        """Calculate exact hours breakdown by surcharge type.
        
        For a shift like 02:00-10:30 with night shift defined as 22:00-06:00:
        - Night hours: 4h (02:00-06:00)
        - Normal hours: 4h (06:00-10:30 minus break)
        
        Returns dict with hours per category and surcharge amounts.
        """
        from apps.employees.models import SurchargeType
        from apps.customers.models import CustomerServiceSurcharge
        from datetime import datetime, timedelta, time
        
        result = {
            'total_hours': float(self.calculated_hours),
            'normal_hours': float(self.calculated_hours),  # Start with all normal
            'night_hours': 0.0,
            'saturday_hours': 0.0,
            'sunday_hours': 0.0,
            'holiday_hours': 0.0,
            'overtime_hours': 0.0,
            'surcharges': [],  # List of {'name', 'category', 'hours', 'percentage', 'amount'}
        }
        
        if not self.project:
            return result
        
        customer = self.project.customer
        rate = float(self.get_service_rate())
        
        # Get work times (ensure naive datetimes for comparison)
        if self.actual_start_datetime and self.actual_end_datetime:
            work_start = self.actual_start_datetime
            work_end = self.actual_end_datetime
            # Convert to naive if timezone-aware
            if hasattr(work_start, 'tzinfo') and work_start.tzinfo:
                work_start = work_start.replace(tzinfo=None)
            if hasattr(work_end, 'tzinfo') and work_end.tzinfo:
                work_end = work_end.replace(tzinfo=None)
        elif self.planned_start_time and self.planned_end_time and self.work_date:
            work_start = datetime.combine(self.work_date, self.planned_start_time)
            work_end = datetime.combine(self.work_date, self.planned_end_time)
            if work_end <= work_start:
                work_end += timedelta(days=1)
        else:
            return result
        
        total_work_minutes = (work_end - work_start).total_seconds() / 60
        break_minutes = self._get_total_break_minutes()
        net_work_minutes = total_work_minutes - break_minutes
        
        # Check each surcharge type for overlap
        for surcharge_type in SurchargeType.objects.filter(is_active=True):
            try:
                customer_surcharge = CustomerServiceSurcharge.objects.get(
                    customer=customer,
                    surcharge_type=surcharge_type,
                    is_enabled=True
                )
            except CustomerServiceSurcharge.DoesNotExist:
                continue
            
            overlap_hours = 0.0
            category = surcharge_type.category or 'other'
            
            # Time-based (night shift)
            if surcharge_type.time_from and surcharge_type.time_to:
                overlap_hours = self._calculate_time_overlap(
                    work_start, work_end,
                    surcharge_type.time_from, surcharge_type.time_to
                )
                # Deduct actual break overlap with this surcharge period
                break_overlap_hours = self._calculate_break_overlap_with_surcharge(
                    work_start.date(),
                    surcharge_type.time_from,
                    surcharge_type.time_to
                )
                overlap_hours = max(0, overlap_hours - break_overlap_hours)
            
            # Day of week (weekend)
            elif surcharge_type.days_of_week:
                work_date = work_start.date()
                if work_date.weekday() in surcharge_type.days_of_week:
                    overlap_hours = net_work_minutes / 60
            
            # Specific dates (holiday)
            elif surcharge_type.specific_dates:
                work_date = work_start.date()
                if work_date.strftime('%m-%d') in surcharge_type.specific_dates:
                    overlap_hours = net_work_minutes / 60
            
            if overlap_hours > 0:
                surcharge_amount = overlap_hours * rate * (float(customer_surcharge.percentage) / 100)
                result['surcharges'].append({
                    'name': surcharge_type.name,
                    'category': category,
                    'hours': round(overlap_hours, 2),
                    'percentage': float(customer_surcharge.percentage),
                    'amount': round(surcharge_amount, 2),
                })
                
                # Update category totals
                if 'night' in category.lower():
                    result['night_hours'] = round(overlap_hours, 2)
                    result['normal_hours'] -= overlap_hours
                elif category == 'saturday':
                    result['saturday_hours'] = round(overlap_hours, 2)
                    result['normal_hours'] -= overlap_hours
                elif category == 'sunday':
                    result['sunday_hours'] = round(overlap_hours, 2)
                    result['normal_hours'] -= overlap_hours
                elif category == 'holiday':
                    result['holiday_hours'] = round(overlap_hours, 2)
                    result['normal_hours'] -= overlap_hours
        
        result['normal_hours'] = max(0, round(result['normal_hours'], 2))
        return result
    
    def _calculate_time_overlap(self, work_start, work_end, surcharge_start, surcharge_end):
        """Calculate hours of overlap between work period and surcharge time range.
        
        Handles overnight surcharges (e.g., 22:00-06:00).
        Returns overlap in hours.
        """
        from datetime import datetime, timedelta, time
        
        work_date = work_start.date()
        
        # Build surcharge periods (may span midnight)
        if surcharge_start > surcharge_end:
            # Overnight: create two periods
            # Period 1: surcharge_start on work_date-1 to midnight
            # Period 2: midnight to surcharge_end on work_date
            # Period 3: surcharge_start on work_date to midnight+1
            periods = [
                (datetime.combine(work_date, surcharge_start), 
                 datetime.combine(work_date + timedelta(days=1), surcharge_end)),
                (datetime.combine(work_date - timedelta(days=1), surcharge_start),
                 datetime.combine(work_date, surcharge_end)),
            ]
        else:
            # Same-day surcharge
            periods = [
                (datetime.combine(work_date, surcharge_start),
                 datetime.combine(work_date, surcharge_end)),
            ]
        
        total_overlap_minutes = 0
        for period_start, period_end in periods:
            # Calculate overlap
            overlap_start = max(work_start, period_start)
            overlap_end = min(work_end, period_end)
            if overlap_end > overlap_start:
                total_overlap_minutes += (overlap_end - overlap_start).total_seconds() / 60
        
        return total_overlap_minutes / 60
    
    def _calculate_break_overlap_with_surcharge(self, work_date, surcharge_start, surcharge_end):
        """Calculate how much break time falls within a surcharge period.
        
        For break 05:45-06:15 with night shift 22:00-06:00:
        - 15 minutes overlap (05:45-06:00)
        
        Returns overlap in hours.
        """
        from datetime import datetime, timedelta
        
        if not self.breaks or not isinstance(self.breaks, list):
            return 0.0
        
        # Build surcharge periods
        if surcharge_start > surcharge_end:
            # Overnight surcharge
            periods = [
                (datetime.combine(work_date, surcharge_start), 
                 datetime.combine(work_date + timedelta(days=1), surcharge_end)),
                (datetime.combine(work_date - timedelta(days=1), surcharge_start),
                 datetime.combine(work_date, surcharge_end)),
            ]
        else:
            periods = [
                (datetime.combine(work_date, surcharge_start),
                 datetime.combine(work_date, surcharge_end)),
            ]
        
        total_break_overlap_minutes = 0
        
        for brk in self.breaks:
            start_str = brk.get('start', '')
            end_str = brk.get('end', '')
            if not start_str or not end_str:
                continue
            
            try:
                # Parse break times
                start_parts = start_str.split(':')
                end_parts = end_str.split(':')
                break_start_time = datetime.strptime(f"{start_parts[0]}:{start_parts[1]}", "%H:%M").time()
                break_end_time = datetime.strptime(f"{end_parts[0]}:{end_parts[1]}", "%H:%M").time()
                
                break_start = datetime.combine(work_date, break_start_time)
                break_end = datetime.combine(work_date, break_end_time)
                
                # Handle overnight breaks
                if break_end <= break_start:
                    break_end += timedelta(days=1)
                
                # Calculate overlap with each surcharge period
                for period_start, period_end in periods:
                    overlap_start = max(break_start, period_start)
                    overlap_end = min(break_end, period_end)
                    if overlap_end > overlap_start:
                        total_break_overlap_minutes += (overlap_end - overlap_start).total_seconds() / 60
            except (ValueError, IndexError):
                continue
        
        return total_break_overlap_minutes / 60
    
    @property
    def calculated_price(self):
        """Calculate the total billable price for this work entry.
        
        Uses detailed hour breakdown so partial night shifts are calculated correctly.
        E.g., 02:00-10:30 with night=22:00-06:00: 4h night (with surcharge) + 4h normal
        """
        hours = self.calculated_hours
        if hours == 0:
            return Decimal('0')
        
        rate = self.get_service_rate()
        if rate == 0:
            return Decimal('0')
        
        # Get detailed breakdown for accurate surcharge calculation
        breakdown = self.get_hours_breakdown_detailed()
        
        # Calculate base price (all hours × rate)
        base_price = hours * rate
        
        # Add surcharge amounts from detailed breakdown
        total_surcharge_amount = Decimal('0')
        for s in breakdown.get('surcharges', []):
            total_surcharge_amount += Decimal(str(s.get('amount', 0)))
        
        return (base_price + total_surcharge_amount).quantize(Decimal('0.01'))
    
    def save(self, *args, **kwargs):
        """Override save to auto-populate fields."""
        # Auto-populate planned times from shift template if not set
        if self.shift_template and not self.planned_start_time:
            self.planned_start_time = self.shift_template.start_time
            self.planned_end_time = self.shift_template.end_time
        
        # Ensure project is set from shift template if not already
        if self.shift_template and not self.project_id:
            self.project = self.shift_template.project
        
        super().save(*args, **kwargs)

