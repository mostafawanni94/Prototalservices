"""
Employee models for Pro Totaal Service.

Handles:
- Custom User (admin-created accounts)
- Employee profiles with mandatory fields
- Document management (ID, certificates)
- Contract information
- Agency management and billing
"""

import uuid
from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel, TimeStampedModel


# =============================================================================
# CUSTOM USER MANAGER
# =============================================================================

class UserManager(BaseUserManager):
    """Custom user manager for admin-only account creation.
    Employees cannot self-register.
    """
    
    def create_user(self, email, password=None, **extra_fields):
        """Create a regular user (employee)."""
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create a superuser (admin)."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


# =============================================================================
# CUSTOM USER MODEL
# =============================================================================

class User(AbstractUser):
    """Custom User model for Pro Totaal Service.
    
    - Admin creates accounts (no self-registration)
    - Email is the unique identifier (not username)
    - Role-based access control
    """
    
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrator'
        EMPLOYEE = 'employee', 'Employee'
        FINANCE = 'finance', 'Finance Manager'
        OPERATIONS = 'operations', 'Operations Coordinator'
    
    # Remove username, use email instead
    username = None
    email = models.EmailField(
        unique=True,
        verbose_name="Email Address",
        help_text="Primary login identifier (set by admin, not editable by employee)"
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        verbose_name="Role"
    )
    # First login tracking
    is_first_login = models.BooleanField(
        default=True,
        verbose_name="First Login",
        help_text="True until employee completes profile"
    )
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.email
    
    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
    
    @property
    def is_employee(self):
        return self.role == self.Role.EMPLOYEE


# =============================================================================
# EMPLOYEE PROFILE
# =============================================================================

class EmployeeProfile(BaseModel):
    """Complete employee profile with all mandatory fields.
    
    Workflow:
    1. Admin creates User account
    2. Employee logs in and completes this profile
    3. Employee submits → status becomes PENDING
    4. Admin reviews and approves → status becomes ACTIVE
    """
    
    class ProfileStatus(models.TextChoices):
        INCOMPLETE = 'incomplete', 'Incomplete'
        PENDING_APPROVAL = 'pending', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SUSPENDED = 'suspended', 'Suspended'
    
    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        OTHER = 'other', 'Other'
        PREFER_NOT_TO_SAY = 'prefer_not_to_say', 'Prefer not to say'
    
    class ContractPhase(models.TextChoices):
        PHASE_A = 'phase_a', 'Phase A (Fase A)'
        PHASE_B = 'phase_b', 'Phase B (Fase B)'
        PHASE_C = 'phase_c', 'Phase C (Fase C)'
    
    # Link to User account
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name="User Account"
    )
    # Profile status
    status = models.CharField(
        max_length=20,
        choices=ProfileStatus.choices,
        default=ProfileStatus.INCOMPLETE,
        db_index=True,
        verbose_name="Profile Status"
    )
    # Personal Information
    first_name = models.CharField(max_length=100, verbose_name="First Name")
    last_name = models.CharField(max_length=100, verbose_name="Last Name")
    prefix_name = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name="Prefix Name",
        help_text="Optional prefix (e.g., van, de, van der)"
    )
    initials = models.CharField(
        max_length=10,
        verbose_name="Initials",
        help_text="First letter(s) of name"
    )
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        verbose_name="Gender"
    )
    date_of_birth = models.DateField(verbose_name="Date of Birth")
    birthplace = models.CharField(max_length=100, verbose_name="Birthplace")
    
    # Dutch BSN number
    bsn_validator = RegexValidator(
        regex=r'^\d{9}$',
        message='BSN must be exactly 9 digits'
    )
    bsn = models.CharField(
        max_length=9,
        validators=[bsn_validator],
        verbose_name="BSN",
        help_text="Dutch national identification number (9 digits)"
    )
    
    # Document Information
    document_type = models.ForeignKey(
        'DocumentType',
        on_delete=models.PROTECT,
        related_name='employees',
        verbose_name="Document Type",
        help_text="Type of ID document (defined by admin)"
    )
    document_number = models.CharField(
        max_length=50,
        verbose_name="Document Number",
        help_text="Can be extracted via OCR, employee can edit"
    )
    document_issue_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Document Issue Date"
    )
    document_expiry_date = models.DateField(
        verbose_name="Document Expiry Date (Geldig tot)"
    )
    
    # ID Document uploads
    id_document_front = models.ImageField(
        upload_to='employees/id_documents/front/',
        verbose_name="ID Document (Front)"
    )
    id_document_back = models.ImageField(
        upload_to='employees/id_documents/back/',
        verbose_name="ID Document (Back)"
    )
    id_document_pdf = models.FileField(
        upload_to='employees/id_documents/pdf/',
        blank=True,
        null=True,
        verbose_name="ID Document (PDF)"
    )
    
    # Contact Information
    phone_validator = RegexValidator(
        regex=r'^\+?[\d\s\-]{10,20}$',
        message='Enter a valid phone number'
    )
    phone_number = models.CharField(
        max_length=20,
        validators=[phone_validator],
        verbose_name="Phone Number"
    )
    street_address = models.CharField(
        max_length=255,
        verbose_name="Street Address",
        blank=True,
        default='',
        help_text="Legacy field - use street_name, house_number, house_number_addition instead"
    )
    street_name = models.CharField(
        max_length=200,
        verbose_name="Street Name",
        blank=True,
        default='',
        help_text="Name of the street (e.g., Kerkstraat)"
    )
    house_number = models.CharField(
        max_length=10,
        verbose_name="House Number",
        blank=True,
        default='',
        help_text="House/building number (e.g., 123)"
    )
    house_number_addition = models.CharField(
        max_length=10,
        verbose_name="House Number Addition",
        blank=True,
        default='',
        help_text="Addition to house number (e.g., A, B, bis, I, II)"
    )
    postcode = models.CharField(max_length=10, verbose_name="Postcode")
    city = models.CharField(max_length=100, verbose_name="City (Plaats)")
    
    # Financial Information
    iban_validator = RegexValidator(
        regex=r'^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$',
        message='Enter a valid IBAN'
    )
    iban = models.CharField(
        max_length=34,
        validators=[iban_validator],
        verbose_name="IBAN Number"
    )
    hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Hourly Rate (€)"
    )
    
    # Permission flags for employees
    can_add_allowances = models.BooleanField(
        default=False,
        verbose_name="Can Add Allowances",
        help_text="Allow employee to add allowances (Toeslag) to work logs"
    )
    receives_surcharges = models.BooleanField(
        default=False,
        verbose_name="Receives Surcharges",
        help_text="Employee receives surcharge payments (night/weekend rates)"
    )
    
    # Travel Allowance
    has_travel_allowance = models.BooleanField(
        default=False,
        verbose_name="Has Travel Allowance",
        help_text="Enable travel cost tracking for this employee"
    )
    travel_cost_per_km = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Travel Cost per KM (€)",
        help_text="Cost per kilometer for travel reimbursement"
    )
    travel_hour_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Travel Hour Percentage (%)",
        help_text="Percentage of travel time to compensate"
    )
    
    # Nationality
    nationality = models.CharField(
        max_length=100,
        verbose_name="Nationality",
        help_text="Searchable dropdown with all countries"
    )
    
    # Contract Information
    contract_type = models.ForeignKey(
        'ContractType',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='employees',
        verbose_name="Contract Type"
    )
    contract_phase = models.CharField(
        max_length=20,
        choices=[
            ('phase_a', 'Phase A (Fase A)'),
            ('phase_b', 'Phase B (Fase B)'),
            ('phase_c', 'Phase C (Fase C)'),
        ],
        blank=True,
        null=True,
        verbose_name="Contract Phase (Fase)"
    )
    contract_start_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Contract Start Date"
    )
    contract_end_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Contract End Date"
    )
    contract_document = models.FileField(
        upload_to='employees/contracts/',
        blank=True,
        null=True,
        verbose_name="Contract Document"
    )
    
    # Agency
    current_agency = models.ForeignKey(
        'Agency',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='current_employees',
        verbose_name="Current Agency",
        help_text="Current agency if employee is uitzendkracht"
    )
    
    # Driver's License
    has_drivers_license = models.BooleanField(
        default=False,
        verbose_name="Has Driver's License (Rijbewijs)"
    )
    drivers_license_front = models.ImageField(
        upload_to='employees/drivers_license/front/',
        blank=True,
        null=True,
        verbose_name="Driver's License (Front)"
    )
    drivers_license_back = models.ImageField(
        upload_to='employees/drivers_license/back/',
        blank=True,
        null=True,
        verbose_name="Driver's License (Back)"
    )
    drivers_license_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name="Driver's License Number"
    )
    drivers_license_issue_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Driver's License Issue Date"
    )
    drivers_license_expiry_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Driver's License Expiry Date"
    )
    drivers_license_categories = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Driver's License Categories",
        help_text="List of license categories, e.g. ['B', 'BE', 'C']"
    )
    
    # Approval workflow
    submitted_at = models.DateTimeField(blank=True, null=True, verbose_name="Submitted At")
    approved_at = models.DateTimeField(blank=True, null=True, verbose_name="Approved At")
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='approved_employees',
        verbose_name="Approved By"
    )
    rejection_reason = models.TextField(blank=True, default='', verbose_name="Rejection Reason")
    
    # =============================================================================
    # NOTIFICATION PREFERENCES (Mobile App Settings)
    # =============================================================================
    notify_certificate_expiry = models.BooleanField(
        default=True,
        verbose_name="Notify Certificate Expiry",
        help_text="Receive notifications when certificates are expiring"
    )
    notify_contract_expiry = models.BooleanField(
        default=True,
        verbose_name="Notify Contract Expiry", 
        help_text="Receive notifications when contract is expiring"
    )
    notify_worklog_reminders = models.BooleanField(
        default=True,
        verbose_name="Notify WorkLog Reminders",
        help_text="Receive reminders to log work hours"
    )
    notify_shift_changes = models.BooleanField(
        default=True,
        verbose_name="Notify Shift Changes",
        help_text="Receive notifications about shift updates"
    )
    notify_approvals = models.BooleanField(
        default=True,
        verbose_name="Notify Approvals/Rejections",
        help_text="Receive notifications when worklogs are approved/rejected"
    )
    push_notifications_enabled = models.BooleanField(
        default=True,
        verbose_name="Push Notifications Enabled",
        help_text="Master toggle for all push notifications"
    )
    
    class Meta:
        verbose_name = 'Employee Profile'
        verbose_name_plural = 'Employee Profiles'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.first_name} {self.prefix_name} {self.last_name}".strip()
    
    @property
    def full_name(self):
        parts = [self.first_name]
        if self.prefix_name:
            parts.append(self.prefix_name)
        parts.append(self.last_name)
        return ' '.join(parts)

    def submit_for_approval(self):
        """Submit profile for admin approval."""
        from django.utils import timezone
        self.status = self.ProfileStatus.PENDING_APPROVAL
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at'])
    
    def approve(self, admin_user, contract_phase=None, start_date=None, end_date=None):
        """Approve profile and activate employee."""
        from django.utils import timezone
        self.status = self.ProfileStatus.APPROVED
        self.approved_at = timezone.now()
        self.approved_by = admin_user
        self.rejection_reason = ''
        # Update contract if provided
        if contract_phase:
            self.contract_phase = contract_phase
        if start_date:
            self.contract_start_date = start_date
        if end_date:
            self.contract_end_date = end_date
        self.save()
    
    def reject(self, reason):
        """Reject profile with reason."""
        self.status = self.ProfileStatus.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=['status', 'rejection_reason'])

# =============================================================================
# DOCUMENT TYPE (Admin-defined)
# =============================================================================

class DocumentType(TimeStampedModel):
    """Types of identity documents, defined by admin."""
    
    name = models.CharField(max_length=100, unique=True, verbose_name="Document Type Name")
    description = models.TextField(blank=True, default='', verbose_name="Description")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Is Active")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Sort Order")
    
    class Meta:
        verbose_name = 'Document Type'
        verbose_name_plural = 'Document Types'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return self.name



# =============================================================================
# CONTRACT TYPE (NL-specific)
# =============================================================================

class ContractType(TimeStampedModel):
    """Types of employment contracts (NL-specific).
    
    Examples:
    - Onbepaalde tijd (Permanent)
    - Bepaalde tijd (Fixed-term)
    - Uitzendkracht (Agency worker)
    """
    
    class HoursType(models.TextChoices):
        FULL_TIME = 'full_time', 'Full-time (Voltijd)'
        PART_TIME = 'part_time', 'Part-time (Deeltijd)'
    
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Contract Type Name",
        help_text="Dutch-facing name, e.g. Onbepaalde tijd"
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code",
        help_text="Short code, e.g. NL_IND, NL_FT"
    )
    description = models.TextField(blank=True, default='', verbose_name="Description")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Is Active")
    requires_end_date = models.BooleanField(
        default=False,
        verbose_name="Requires End Date",
        help_text="If true, contract end date is mandatory"
    )
    requires_agency = models.BooleanField(
        default=False,
        verbose_name="Requires Agency",
        help_text="If true, admin must select an agency (e.g. for Uitzendkracht)"
    )
    default_duration_months = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Default Duration (months)",
        help_text="Optional default duration for fixed-term contracts"
    )
    default_hours_type = models.CharField(
        max_length=20,
        choices=HoursType.choices,
        blank=True,
        default='',
        verbose_name="Default Hours Type"
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Sort Order")
    
    class Meta:
        verbose_name = 'Contract Type'
        verbose_name_plural = 'Contract Types'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.code})"


# =============================================================================
# AGENCY
# =============================================================================

class Agency(TimeStampedModel):
    """Employment agencies for uitzendkracht employees.
    Admin can create/manage agencies, employees can be assigned/transferred.
    Soft delete is used - agencies are never hard deleted for historical tracking.
    """
    
    name = models.CharField(max_length=200, unique=True, verbose_name="Agency Name")
    code = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code",
        help_text="Short code, e.g. RAND, TEMPO"
    )
    description = models.TextField(blank=True, default='', verbose_name="Description")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Is Active")
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Is Deleted",
        help_text="Soft delete flag - never hard delete agencies"
    )
    
    # Billing Information
    base_hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        verbose_name="Base Hourly Rate (€)",
        help_text="Base rate agency pays per hour"
    )
    has_surcharges = models.BooleanField(
        default=False,
        verbose_name="Has Percentage Surcharges",
        help_text="Enable surcharge rules for weekends, nights, holidays"
    )
    
    class Meta:
        verbose_name = 'Agency'
        verbose_name_plural = 'Agencies'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.code})"
    
    def soft_delete(self):
        """Soft delete the agency."""
        self.is_deleted = True
        self.is_active = False
        self.save(update_fields=['is_deleted', 'is_active', 'updated_at'])


# =============================================================================
# EMPLOYEE AGENCY HISTORY (Transfer Tracking)
# =============================================================================

class EmployeeAgencyHistory(TimeStampedModel):
    """Tracks employee agency assignments and transfers over time.
    Each record represents a period when an employee was assigned to an agency.
    """
    
    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name='agency_history',
        verbose_name="Employee"
    )
    agency = models.ForeignKey(
        Agency,
        on_delete=models.PROTECT,
        related_name='employee_assignments',
        verbose_name="Agency"
    )
    start_date = models.DateField(verbose_name="Start Date")
    end_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="End Date",
        help_text="Null means currently active at this agency"
    )
    notes = models.TextField(blank=True, default='', verbose_name="Transfer Notes")
    
    class Meta:
        verbose_name = 'Employee Agency History'
        verbose_name_plural = 'Employee Agency History'
        ordering = ['-start_date']
    
    def __str__(self):
        end = self.end_date or 'Present'
        return f"{self.employee} at {self.agency} ({self.start_date} - {end})"
    
    @property
    def is_current(self):
        """Check if this is the current agency assignment."""
        return self.end_date is None


# =============================================================================
# SURCHARGE TYPE (Admin-defined Day Payment Types)
# =============================================================================

class SurchargeType(TimeStampedModel):
    """Master list of surcharge types that admin creates once.
    Examples: Weekend, Night Shift, King's Day, Christmas, etc.
    These are reused across agencies.
    """
    
    class SurchargeCategory(models.TextChoices):
        WEEKEND = 'weekend', 'Weekend'
        NIGHT_SHIFT = 'night_shift', 'Night Shift'
        HOLIDAY = 'holiday', 'Public Holiday'
        CUSTOM = 'custom', 'Custom'
    
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Surcharge Name",
        help_text="e.g., Weekend, Night Shift, King's Day"
    )
    category = models.CharField(
        max_length=20,
        choices=SurchargeCategory.choices,
        default=SurchargeCategory.CUSTOM,
        verbose_name="Category"
    )
    description = models.TextField(blank=True, default='', verbose_name="Description")
    
    # Time configuration
    time_from = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Start Time",
        help_text="For time-based surcharges (e.g., night shift 22:00)"
    )
    time_to = models.TimeField(
        blank=True,
        null=True,
        verbose_name="End Time",
        help_text="For time-based surcharges (e.g., night shift 06:00)"
    )
    
    # Day configuration
    days_of_week = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Days of Week",
        help_text="List of days [0-6], 0=Monday, 6=Sunday. e.g., [5,6] for weekend"
    )
    specific_dates = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Specific Dates",
        help_text="List of dates in format ['MM-DD'] for recurring holidays, e.g., ['04-27'] for King's Day"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Sort Order")
    
    class Meta:
        verbose_name = 'Surcharge Type'
        verbose_name_plural = 'Surcharge Types'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return self.name


# =============================================================================
# ALLOWANCE TYPE (Toeslag - Admin-defined per-hour allowances)
# =============================================================================

class AllowanceType(TimeStampedModel):
    """Master list of allowance types (Toeslag) that admin creates.
    Examples: Ademlucht (mask), EPZ Toeslag, WZH Toeslag, etc.
    These are per-hour allowances that can be configured per customer.
    """
    
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Allowance Name",
        help_text="e.g., Ademlucht (mask), EPZ Toeslag, WZH Toeslag"
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code",
        help_text="Short code for the allowance, e.g., MASK, EPZ, WZH"
    )
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name="Base Price (€)",
        help_text="Default price per hour for this allowance"
    )
    description = models.TextField(
        blank=True,
        default='',
        verbose_name="Description"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Is Active"
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Sort Order"
    )
    
    class Meta:
        verbose_name = 'Allowance Type'
        verbose_name_plural = 'Allowance Types'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return f"{self.name} (€{self.base_price}/hr)"


# =============================================================================
# AGENCY SURCHARGE (Join table: Agency + SurchargeType + Percentage)
# =============================================================================

class AgencySurcharge(TimeStampedModel):
    """Links an agency to surcharge types with specific percentages.
    When creating an agency, admin selects which surcharge types apply
    and sets the percentage for each.
    """
    
    agency = models.ForeignKey(
        Agency,
        on_delete=models.CASCADE,
        related_name='surcharges',
        verbose_name="Agency"
    )
    surcharge_type = models.ForeignKey(
        SurchargeType,
        on_delete=models.CASCADE,
        related_name='agency_surcharges',
        verbose_name="Surcharge Type"
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Surcharge Percentage",
        help_text="e.g., 20.00 for 20%"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    
    class Meta:
        verbose_name = 'Agency Surcharge'
        verbose_name_plural = 'Agency Surcharges'
        unique_together = ['agency', 'surcharge_type']
        ordering = ['agency', 'surcharge_type__sort_order']
    
    def __str__(self):
        return f"{self.agency.name} - {self.surcharge_type.name} ({self.percentage}%)"
    
    @property
    def calculated_rate(self):
        """Calculate the rate after applying this surcharge."""
        base = self.agency.base_hourly_rate
        return base * (1 + self.percentage / 100)


# =============================================================================
# AGENCY WALLET
# =============================================================================

class AgencyWallet(TimeStampedModel):
    """Wallet for agency to track earnings from employee work.
    Auto-updated when worklogs are submitted.
    """
    
    agency = models.OneToOneField(
        Agency,
        on_delete=models.CASCADE,
        related_name='wallet',
        verbose_name="Agency"
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Current Balance (€)"
    )
    total_earned = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Total Earned (€)",
        help_text="All-time earnings"
    )
    
    class Meta:
        verbose_name = 'Agency Wallet'
        verbose_name_plural = 'Agency Wallets'
    
    def __str__(self):
        return f"{self.agency.name} Wallet - €{self.balance}"


# =============================================================================
# AGENCY TRANSACTION
# =============================================================================

class AgencyTransaction(TimeStampedModel):
    """Individual transactions in agency wallet.
    Created automatically when employee work is logged.
    """
    
    class TransactionType(models.TextChoices):
        WORK = 'work', 'Employee Work'
        ADJUSTMENT = 'adjustment', 'Manual Adjustment'
        INVOICE = 'invoice', 'Invoice Payment'
    
    wallet = models.ForeignKey(
        AgencyWallet,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name="Wallet"
    )
    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='agency_transactions',
        verbose_name="Employee"
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        default=TransactionType.WORK,
        verbose_name="Transaction Type"
    )
    date = models.DateField(verbose_name="Work Date")
    hours_worked = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="Hours Worked"
    )
    base_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name="Base Rate (€)",
        help_text="Rate at time of work"
    )
    base_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Base Amount (€)"
    )
    surcharge_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="Total Surcharge (%)",
        help_text="Combined surcharges applied"
    )
    surcharge_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Surcharge Amount (€)"
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Total Amount (€)"
    )
    description = models.TextField(blank=True, default='', verbose_name="Description")
    surcharges_applied = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Surcharges Applied",
        help_text="List of surcharge names that were applied"
    )
    
    class Meta:
        verbose_name = 'Agency Transaction'
        verbose_name_plural = 'Agency Transactions'
        ordering = ['-date', '-created_at']
    
    def __str__(self):
        return f"{self.wallet.agency.name} - {self.date} - €{self.total_amount}"


# =============================================================================
# EMPLOYEE RATE HISTORY
# =============================================================================

class EmployeeRateHistory(TimeStampedModel):
    """
    Tracks historical changes to employee hourly rates.
    Used for accurate invoice calculations based on rate effective during work period.
    """
    employee = models.ForeignKey(
        'EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='rate_history',
        verbose_name="Employee"
    )
    hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name="Hourly Rate (€)"
    )
    effective_from = models.DateField(
        verbose_name="Effective From",
        help_text="Date when this rate became effective"
    )
    effective_to = models.DateField(
        blank=True,
        null=True,
        verbose_name="Effective To",
        help_text="Date when this rate ended (null = current rate)"
    )
    changed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='rate_changes_made',
        verbose_name="Changed By"
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes",
        help_text="Optional notes about this rate change"
    )
    
    class Meta:
        verbose_name = 'Employee Rate History'
        verbose_name_plural = 'Employee Rate Histories'
        ordering = ['-effective_from', '-created_at']
    
    def __str__(self):
        return f"{self.employee} - €{self.hourly_rate} from {self.effective_from}"
    
    @classmethod
    def get_rate_for_date(cls, employee, target_date):
        """
        Get the hourly rate that was active for an employee on a specific date.
        Returns None if no rate history exists for that date.
        """
        return cls.objects.filter(
            employee=employee,
            effective_from__lte=target_date
        ).filter(
            models.Q(effective_to__gte=target_date) | models.Q(effective_to__isnull=True)
        ).order_by('-effective_from').first()


# =============================================================================
# EMPLOYEE CONTRACT HISTORY
# =============================================================================

class EmployeeContractHistory(TimeStampedModel):
    """
    Tracks historical contract documents for employees.
    When an employee's rate changes, a new contract can optionally be uploaded.
    All historical contracts are preserved for audit purposes.
    """
    employee = models.ForeignKey(
        'EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='contract_history',
        verbose_name="Employee"
    )
    contract_document = models.FileField(
        upload_to='employees/contracts/history/',
        verbose_name="Contract Document"
    )
    hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name="Hourly Rate at Contract Time (€)"
    )
    effective_from = models.DateField(
        verbose_name="Effective From",
        help_text="Date when this contract became effective"
    )
    effective_to = models.DateField(
        blank=True,
        null=True,
        verbose_name="Effective To",
        help_text="Date when this contract ended (null = current)"
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes",
        help_text="Optional notes about this contract"
    )
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='contracts_uploaded',
        verbose_name="Uploaded By"
    )
    
    class Meta:
        verbose_name = 'Employee Contract History'
        verbose_name_plural = 'Employee Contract Histories'
        ordering = ['-effective_from', '-created_at']
    
    def __str__(self):
        return f"{self.employee} - Contract from {self.effective_from}"
