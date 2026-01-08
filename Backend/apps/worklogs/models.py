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
# WORK LOG
# =============================================================================

class WorkLog(BaseModel):
    """
    Time and evidence record for employee work.
    
    Workflow:
    1. Employee records start/break/end times
    2. Employee optionally adds notes and photos
    3. Employee submits → status becomes PENDING
    4. Admin approves → wallet + invoice updated
    
    Financial impact happens ONLY after admin approval.
    """
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending'  # Alias for pending approval (same as submitted)
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        REVISED = 'revised', 'Needs Revision'
    
    # Links
    employee = models.ForeignKey(
        'employees.EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='work_logs',
        verbose_name="Employee"
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='work_logs',
        verbose_name="Project"
    )
    assignment = models.ForeignKey(
        'projects.ProjectAssignment',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_logs',
        verbose_name="Assignment"
    )
    
    # Link to planning system (ShiftAssignment)
    shift_assignment = models.ForeignKey(
        'projects.ShiftAssignment',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_logs',
        verbose_name="Shift Assignment",
        help_text="Link to the planned shift this worklog fulfills"
    )
    
    # Supervisor from customer's outfolders
    supervisor = models.ForeignKey(
        'customers.Outfolder',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_logs',
        verbose_name="Supervisor"
    )
    
    # Service type from customer
    service = models.ForeignKey(
        'customers.Service',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='work_logs',
        verbose_name="Service Type"
    )
    
    # Manual location if project doesn't have one
    location_override = models.CharField(
        max_length=300,
        blank=True,
        default='',
        verbose_name="Location Override",
        help_text="Manual address if project location is empty"
    )
    
    # Work DateTime (supports night shifts spanning 2 days)
    start_datetime = models.DateTimeField(
        verbose_name="Start Date/Time",
        db_index=True,
        blank=True,
        null=True,
        help_text="When employee started working"
    )
    end_datetime = models.DateTimeField(
        verbose_name="End Date/Time",
        blank=True,
        null=True,
        help_text="When employee finished working"
    )
    
    # Keep work_date for legacy support - will be set automatically from start_datetime
    work_date = models.DateField(
        verbose_name="Work Date",
        db_index=True,
        blank=True,
        null=True,
        help_text="Auto-populated from start_datetime for backward compatibility"
    )
    
    # Legacy time fields (deprecated, kept for migration)
    start_time = models.TimeField(
        verbose_name="Start Time",
        blank=True,
        null=True
    )
    end_time = models.TimeField(
        verbose_name="End Time",
        blank=True,
        null=True
    )
    break_duration_minutes = models.PositiveIntegerField(
        default=0,
        verbose_name="Break Duration (minutes)"
    )
    
    # Optional: specific break times (legacy - single break)
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
    
    # Multiple breaks support (JSON array)
    # Format: [{"start": "12:00", "end": "12:15"}, {"start": "15:00", "end": "15:15"}]
    breaks = models.JSONField(
        blank=True,
        default=list,
        verbose_name="Breaks",
        help_text="Array of break periods [{start: HH:MM, end: HH:MM}, ...]"
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        verbose_name="Status"
    )
    
    # Approval workflow
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
        related_name='approved_work_logs',
        verbose_name="Approved By"
    )
    rejection_reason = models.TextField(
        blank=True,
        default='',
        verbose_name="Rejection Reason"
    )
    
    # Admin adjustments
    admin_adjusted_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Admin Adjusted Hours",
        help_text="Override calculated hours (admin only)"
    )
    admin_notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Admin Notes"
    )
    
    # Week reference (for billing)
    billing_week_year = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Billing Week Year"
    )
    billing_week_number = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Billing Week Number"
    )
    
    class Meta:
        verbose_name = 'Work Log'
        verbose_name_plural = 'Work Logs'
        ordering = ['-start_datetime']
        # Removed unique_together to allow multiple shifts per day (night shifts, split shifts)
    
    def __str__(self):
        date_str = self.start_datetime.strftime('%Y-%m-%d') if self.start_datetime else self.work_date
        return f"{self.employee} - {self.project} ({date_str})"
    
    @property
    def calculated_hours(self):
        """Calculate worked hours (end - start - breaks)."""
        total_break_minutes = self._get_total_break_minutes()
        
        if self.start_datetime and self.end_datetime:
            # Use new datetime fields
            total_duration = self.end_datetime - self.start_datetime
            total_minutes = total_duration.total_seconds() / 60
            work_minutes = total_minutes - total_break_minutes
            return Decimal(str(round(max(0, work_minutes) / 60, 2)))
        elif self.start_time and self.end_time:
            # Fallback to legacy fields
            from datetime import datetime, date
            start = datetime.combine(date.today(), self.start_time)
            end = datetime.combine(date.today(), self.end_time)
            if end < start:
                end += timedelta(days=1)
            total_minutes = (end - start).seconds / 60
            work_minutes = total_minutes - total_break_minutes
            return Decimal(str(round(work_minutes / 60, 2)))
        return Decimal('0')
    
    def _get_total_break_minutes(self):
        """Calculate total break minutes from all breaks."""
        total = 0
        
        # First check new breaks array
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
            return total
        
        # Fallback to legacy break fields
        if self.break_start_time and self.break_end_time:
            start = timedelta(hours=self.break_start_time.hour, minutes=self.break_start_time.minute)
            end = timedelta(hours=self.break_end_time.hour, minutes=self.break_end_time.minute)
            return int((end - start).total_seconds() / 60)
        
        # Fallback to duration field
        return self.break_duration_minutes
    
    @property
    def billable_hours(self):
        """Get billable hours (admin adjusted or calculated)."""
        if self.admin_adjusted_hours is not None:
            return self.admin_adjusted_hours
        return self.calculated_hours
    
    @property
    def is_editable(self):
        """Work log is editable only in draft status."""
        return self.status == self.Status.DRAFT
    
    def save(self, *args, **kwargs):
        """Auto-calculate work_date and billing week on save."""
        # Set work_date from start_datetime for backward compatibility
        if self.start_datetime:
            self.work_date = self.start_datetime.date()
            # Also set legacy time fields
            self.start_time = self.start_datetime.time()
            if self.end_datetime:
                self.end_time = self.end_datetime.time()
        
        if self.work_date:
            # Get ISO calendar week
            iso_cal = self.work_date.isocalendar()
            self.billing_week_year = iso_cal.year
            self.billing_week_number = iso_cal.week
        super().save(*args, **kwargs)
    
    def submit(self):
        """Submit work log for approval."""
        if self.status != self.Status.DRAFT:
            raise ValueError('Work log already submitted')
        self.status = self.Status.SUBMITTED
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at', 'updated_at'])
    
    def approve(self, admin_user, adjusted_hours=None, admin_notes=''):
        """Admin approves the work log."""
        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        self.approved_by = admin_user
        if adjusted_hours is not None:
            self.admin_adjusted_hours = adjusted_hours
        if admin_notes:
            self.admin_notes = admin_notes
        self.save()
    
    def reject(self, reason):
        """Admin rejects the work log."""
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    
    def get_hours_breakdown(self):
        """
        Split worked hours into categories for surcharge calculation.
        
        Categories:
        - normal_hours: Weekday 06:00-22:00
        - night_hours: 22:00-06:00
        - saturday_hours: Saturday work
        - sunday_hours: Sunday work
        - holiday_hours: Public holiday work (overrides other categories)
        
        Returns dict with hours per category.
        """
        from datetime import datetime, time, timedelta as td
        from apps.customers.models import HolidayCalendar
        
        # Get total billable hours
        total_hours = float(self.billable_hours)
        if total_hours <= 0:
            return {
                'normal_hours': 0,
                'night_hours': 0,
                'saturday_hours': 0,
                'sunday_hours': 0,
                'holiday_hours': 0,
                'total_hours': 0,
            }
        
        # Check if it's a holiday (overrides everything)
        is_holiday = HolidayCalendar.is_holiday(self.work_date)
        if is_holiday:
            return {
                'normal_hours': 0,
                'night_hours': 0,
                'saturday_hours': 0,
                'sunday_hours': 0,
                'holiday_hours': round(total_hours, 2),
                'total_hours': round(total_hours, 2),
            }
        
        # Get day of week (0=Monday, 5=Saturday, 6=Sunday)
        day_of_week = self.work_date.weekday()
        
        # Saturday - all hours are saturday_hours
        if day_of_week == 5:
            return {
                'normal_hours': 0,
                'night_hours': 0,
                'saturday_hours': round(total_hours, 2),
                'sunday_hours': 0,
                'holiday_hours': 0,
                'total_hours': round(total_hours, 2),
            }
        
        # Sunday - all hours are sunday_hours
        if day_of_week == 6:
            return {
                'normal_hours': 0,
                'night_hours': 0,
                'saturday_hours': 0,
                'sunday_hours': round(total_hours, 2),
                'holiday_hours': 0,
                'total_hours': round(total_hours, 2),
            }
        
        # Weekday - split between normal and night hours
        # Night hours: 22:00-06:00, Normal hours: 06:00-22:00
        NIGHT_START = time(22, 0)
        NIGHT_END = time(6, 0)
        
        start_dt = datetime.combine(self.work_date, self.start_time)
        end_dt = datetime.combine(self.work_date, self.end_time)
        
        # Handle overnight work
        if end_dt <= start_dt:
            end_dt += td(days=1)
        
        # Calculate night hours
        night_minutes = 0
        current = start_dt
        
        while current < end_dt:
            current_time = current.time()
            # Check if current minute is in night period
            if current_time >= NIGHT_START or current_time < NIGHT_END:
                night_minutes += 1
            current += td(minutes=1)
        
        # Subtract break from total (proportionally from both categories)
        work_minutes = (end_dt - start_dt).total_seconds() / 60
        break_minutes = self.break_duration_minutes
        
        if work_minutes > 0 and break_minutes > 0:
            night_ratio = night_minutes / work_minutes
            night_minutes -= break_minutes * night_ratio
        
        night_hours = max(0, night_minutes / 60)
        normal_hours = max(0, total_hours - night_hours)
        
        return {
            'normal_hours': round(normal_hours, 2),
            'night_hours': round(night_hours, 2),
            'saturday_hours': 0,
            'sunday_hours': 0,
            'holiday_hours': 0,
            'total_hours': round(total_hours, 2),
        }



# =============================================================================
# WORK LOG PHOTO
# =============================================================================

class WorkLogPhoto(BaseModel):
    """
    Photos attached to work logs as evidence.
    """
    
    work_log = models.ForeignKey(
        WorkLog,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name="Work Log"
    )
    photo = models.ImageField(
        upload_to='worklogs/photos/%Y/%m/',
        verbose_name="Photo"
    )
    caption = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name="Caption"
    )
    taken_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Photo Taken At"
    )
    
    class Meta:
        verbose_name = 'Work Log Photo'
        verbose_name_plural = 'Work Log Photos'
        ordering = ['created_at']
    
    def __str__(self):
        return f"Photo for {self.work_log}"


# =============================================================================
# WORK LOG ALLOWANCE (Toeslag hours per work log)
# =============================================================================

class WorkLogAllowance(BaseModel):
    """
    Tracks allowances (Toeslag) applied to a work log.
    
    For example, if an employee works 8 hours total and 4 of those
    hours required wearing a mask, they would have a WorkLogAllowance
    with hours=4 for the mask allowance.
    
    Employees can also write custom allowances if the one they need
    is not in the system.
    """
    
    work_log = models.ForeignKey(
        WorkLog,
        on_delete=models.CASCADE,
        related_name='allowances',
        verbose_name="Work Log"
    )
    allowance_type = models.ForeignKey(
        'employees.AllowanceType',
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='work_log_entries',
        verbose_name="Allowance Type",
        help_text="Select from predefined allowances, or leave empty for custom"
    )
    custom_allowance_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name="Custom Allowance Name",
        help_text="If allowance_type is empty, provide a custom name"
    )
    hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Hours",
        help_text="How many hours this allowance applies to"
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    
    # From/To time for allowance (optional - if provided, hours will be calculated)
    start_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="From Time",
        help_text="When this allowance started applying"
    )
    end_time = models.TimeField(
        blank=True,
        null=True,
        verbose_name="To Time",
        help_text="When this allowance stopped applying"
    )
    
    # Track if this allowance was added by admin (during approval)
    # vs by the employee themselves
    added_by_admin = models.BooleanField(
        default=False,
        verbose_name="Added by Admin",
        help_text="If True, this allowance appears in company invoice only, not in employee payslip"
    )
    added_by = models.ForeignKey(
        'employees.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='added_allowances',
        verbose_name="Added By",
        help_text="Who added this allowance (employee or admin)"
    )
    
    class Meta:
        verbose_name = 'Work Log Allowance'
        verbose_name_plural = 'Work Log Allowances'
        ordering = ['created_at']
    
    def __str__(self):
        name = self.allowance_type.name if self.allowance_type else self.custom_allowance_name
        return f"{self.work_log}: {name} - {self.hours}h"
    
    @property
    def allowance_name(self):
        """Get the name (from type or custom)."""
        return self.allowance_type.name if self.allowance_type else self.custom_allowance_name
    
    @property
    def price_per_hour(self):
        """Get price per hour (only available for typed allowances)."""
        if self.allowance_type:
            # Could get from customer allowance for custom pricing
            return self.allowance_type.base_price
        return None
    
    @property
    def include_in_employee_pay(self):
        """
        Determine if this allowance should appear in employee's payslip.
        
        Logic:
        - If added_by_admin=True → Company invoice ONLY (not in payslip)
        - If added_by_admin=False → Both company invoice AND employee payslip
          (but only if employee has can_add_allowances permission)
        """
        if self.added_by_admin:
            return False
        # If employee added it themselves, they should be paid for it
        return True


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
    
    # Link to WorkLog when approved
    work_log = models.OneToOneField(
        WorkLog,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='source_shift',
        verbose_name="Created Work Log"
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
        """Employee can only fill data on the scheduled day and if not yet submitted."""
        if not self.is_today:
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
        """Approve shift and create WorkLog."""
        if self.status != self.Status.SUBMITTED:
            raise ValueError("Can only approve submitted shifts")
        
        # Calculate hours
        break_minutes = 0
        if self.break_start_time and self.break_end_time:
            break_start = timedelta(hours=self.break_start_time.hour, minutes=self.break_start_time.minute)
            break_end = timedelta(hours=self.break_end_time.hour, minutes=self.break_end_time.minute)
            break_minutes = int((break_end - break_start).total_seconds() / 60)
        
        # Create WorkLog
        work_log = WorkLog.objects.create(
            employee=self.employee,
            project=self.project,
            supervisor=self.supervisor,
            service=self.service,
            work_date=self.scheduled_date,
            start_time=self.actual_start_time,
            end_time=self.actual_end_time,
            break_duration_minutes=break_minutes,
            notes=self.employee_notes,
            status=WorkLog.Status.APPROVED,
            approved_by=admin_user,
            approved_at=timezone.now(),
            created_by=self.employee.user,
        )
        
        self.status = self.Status.APPROVED
        self.work_log = work_log
        self.approved_by = admin_user
        self.approved_at = timezone.now()
        self.save()
        
        return work_log
    
    def reject(self, reason):
        """Reject shift."""
        if self.status != self.Status.SUBMITTED:
            raise ValueError("Can only reject submitted shifts")
        
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason', 'updated_at'])
