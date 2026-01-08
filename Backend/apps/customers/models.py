"""
Customer models for Pro Totaal Service.

Handles:
- Customer companies (B2B clients)
- Outfolders (Rayon Managers)
- Multiple contacts per entity
"""

from django.core.validators import RegexValidator
from django.db import models

from apps.core.models import BaseModel, TimeStampedModel


# =============================================================================
# CUSTOMER (Company)
# =============================================================================

class Customer(BaseModel):
    """
    Customer company that rents employees.
    
    Contains full legal and financial data required for invoicing.
    """
    
    # Company Information
    company_name = models.CharField(
        max_length=200,
        verbose_name="Company Name"
    )
    logo = models.ImageField(
        upload_to='customers/logos/',
        blank=True,
        null=True,
        verbose_name="Company Logo"
    )
    
    # Address
    address = models.CharField(
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
        help_text="Addition to house number (e.g., A, B, bis)"
    )
    postcode = models.CharField(
        max_length=10,
        verbose_name="Postcode"
    )
    city = models.CharField(
        max_length=100,
        verbose_name="City (Plaats)"
    )
    country = models.CharField(
        max_length=100,
        default='Netherlands',
        verbose_name="Country"
    )
    website = models.URLField(
        max_length=200,
        blank=True,
        default='',
        verbose_name="Website",
        help_text="Company website URL"
    )
    
    # Financial Information
    iban_validator = RegexValidator(
        regex=r'^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$',
        message='Enter a valid IBAN'
    )
    iban = models.CharField(
        max_length=34,
        blank=True,
        default='',
        validators=[iban_validator],
        verbose_name="IBAN"
    )
    
    # G-rekening (separate IBAN for special account)
    g_rekening = models.CharField(
        max_length=34,
        blank=True,
        default='',
        validators=[iban_validator],
        verbose_name="G-Rekeningnummer",
        help_text="Special IBAN for G-account"
    )
    
    # Dutch Business Numbers
    btw_validator = RegexValidator(
        regex=r'^NL\d{9}B\d{2}$',
        message='Enter a valid Dutch BTW number (e.g., NL123456789B01)'
    )
    btw_number = models.CharField(
        max_length=20,
        blank=True,
        default='',
        validators=[btw_validator],
        verbose_name="BTW Number",
        help_text="Dutch VAT number"
    )
    
    kvk_validator = RegexValidator(
        regex=r'^\d{8}$',
        message='Enter a valid KvK number (8 digits)'
    )
    kvk_number = models.CharField(
        max_length=8,
        blank=True,
        default='',
        validators=[kvk_validator],
        verbose_name="KvK Number",
        help_text="Chamber of Commerce number"
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    
    # General Manager Information
    manager_first_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name="Manager First Name"
    )
    manager_last_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name="Manager Last Name"
    )
    
    # Billing Configuration
    has_surcharges = models.BooleanField(
        default=False,
        verbose_name="Enable Percentage Surcharges"
    )
    has_service_surcharges = models.BooleanField(
        default=False,
        verbose_name="Enable Service Surcharges"
    )
    has_allowance_surcharges = models.BooleanField(
        default=False,
        verbose_name="Enable Allowance Surcharges"
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Active"
    )
    
    class Meta:
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['company_name']
    
    def __str__(self):
        return self.company_name


# =============================================================================
# CUSTOMER CONTACT (Multiple phones/emails)
# =============================================================================

class CustomerContact(TimeStampedModel):
    """
    Contact information for a customer.
    Allows multiple phone numbers and emails per customer.
    """
    
    class ContactType(models.TextChoices):
        PHONE = 'phone', 'Phone'
        EMAIL = 'email', 'Email'
        FAX = 'fax', 'Fax'
        MOBILE = 'mobile', 'Mobile'
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='contacts',
        verbose_name="Customer"
    )
    contact_type = models.CharField(
        max_length=20,
        choices=ContactType.choices,
        verbose_name="Contact Type"
    )
    value = models.CharField(
        max_length=200,
        verbose_name="Contact Value"
    )
    label = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name="Label",
        help_text="E.g., 'Main', 'Billing', 'Support'"
    )
    is_primary = models.BooleanField(
        default=False,
        verbose_name="Is Primary"
    )
    
    class Meta:
        verbose_name = 'Customer Contact'
        verbose_name_plural = 'Customer Contacts'
        ordering = ['-is_primary', 'contact_type']
    
    def __str__(self):
        return f"{self.customer} - {self.contact_type}: {self.value}"


# =============================================================================
# OUTFOLDER (Rayon Manager)
# =============================================================================

class Outfolder(BaseModel):
    """
    Outfolder / Rayon Manager - operational contact person at customer.
    
    This is the person who requests workers and manages 
    operations for a specific geographic area or department.
    Can have multiple outfolders per customer.
    """
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='outfolders',
        verbose_name="Customer"
    )
    
    # Company they work with (same as customer usually)
    company_name = models.CharField(
        max_length=200,
        verbose_name="Company Name",
        help_text="Company name this outfolder works with"
    )
    
    # Personal Information
    first_name = models.CharField(
        max_length=100,
        verbose_name="First Name"
    )
    last_name = models.CharField(
        max_length=100,
        verbose_name="Last Name"
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Is Active"
    )
    
    class Meta:
        verbose_name = 'Outfolder'
        verbose_name_plural = 'Outfolders'
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.customer})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# =============================================================================
# OUTFOLDER CONTACT (Multiple phones/emails)
# =============================================================================

class OutfolderContact(TimeStampedModel):
    """
    Contact information for an outfolder.
    Allows multiple phone numbers and emails.
    """
    
    class ContactType(models.TextChoices):
        PHONE = 'phone', 'Phone'
        EMAIL = 'email', 'Email'
        MOBILE = 'mobile', 'Mobile'
    
    outfolder = models.ForeignKey(
        Outfolder,
        on_delete=models.CASCADE,
        related_name='contacts',
        verbose_name="Outfolder"
    )
    contact_type = models.CharField(
        max_length=20,
        choices=ContactType.choices,
        verbose_name="Contact Type"
    )
    value = models.CharField(
        max_length=200,
        verbose_name="Contact Value"
    )
    label = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name="Label"
    )
    is_primary = models.BooleanField(
        default=False,
        verbose_name="Is Primary"
    )
    
    class Meta:
        verbose_name = 'Outfolder Contact'
        verbose_name_plural = 'Outfolder Contacts'
        ordering = ['-is_primary', 'contact_type']
    
    def __str__(self):
        return f"{self.outfolder} - {self.contact_type}: {self.value}"


# =============================================================================
# SERVICES
# =============================================================================

class Service(TimeStampedModel):
    """
    Services provided by the company (e.g., Certificate, VOG).
    Admin manages these services.
    """
    name = models.CharField(max_length=200, verbose_name="Service Name")
    code = models.CharField(max_length=20, unique=True, default='SERVICE', verbose_name="Code")
    description = models.TextField(blank=True, default='', verbose_name="Description")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Is Active")
    required_certificates = models.ManyToManyField(
        'certificates.CertificateType',
        blank=True,
        related_name='required_for_services',
        verbose_name="Required Certificates",
        help_text="Certificates that employees must have to perform this service"
    )
    
    class Meta:
        verbose_name = 'Service'
        verbose_name_plural = 'Services'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class CustomerServiceRate(TimeStampedModel):
    """
    Specific rate for a service for a specific customer.
    Allows overriding the base behavior or defining specific billing items.
    Now includes per-service surcharge configuration.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='service_rates',
        verbose_name="Customer"
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='customer_rates',
        verbose_name="Service"
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Price (€)"
    )
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    
    # Per-service surcharge configuration
    apply_surcharges = models.BooleanField(
        default=True,
        verbose_name="Apply Surcharges",
        help_text="Whether weekend/night/holiday surcharges apply to this service"
    )
    
    class Meta:
        verbose_name = 'Customer Service Rate'
        verbose_name_plural = 'Customer Service Rates'
        unique_together = ['customer', 'service']
        ordering = ['service__name']
    
    def __str__(self):
        return f"{self.customer} - {self.service}: €{self.price}"


class CustomerServiceSurcharge(TimeStampedModel):
    """
    Custom surcharge percentage for a specific service for a specific customer.
    Allows different surcharge rates per service (e.g., 30% weekend for Cleaning,
    but only 15% weekend for Security).
    """
    customer_service_rate = models.ForeignKey(
        CustomerServiceRate,
        on_delete=models.CASCADE,
        related_name='service_surcharges',
        verbose_name="Customer Service Rate"
    )
    surcharge_type = models.ForeignKey(
        'employees.SurchargeType',
        on_delete=models.PROTECT,
        related_name='customer_service_surcharges',
        verbose_name="Surcharge Type"
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Percentage (%)",
        help_text="Custom surcharge percentage for this service"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    
    class Meta:
        verbose_name = 'Customer Service Surcharge'
        verbose_name_plural = 'Customer Service Surcharges'
        unique_together = ['customer_service_rate', 'surcharge_type']
        ordering = ['surcharge_type__name']
    
    def __str__(self):
        return f"{self.customer_service_rate.service} - {self.surcharge_type}: {self.percentage}%"


# =============================================================================
# CUSTOMER SURCHARGES (Linked to SurchargeType from employees app)
# =============================================================================


class CustomerSurcharge(TimeStampedModel):
    """
    Specific surcharge configurations for a customer.
    Links Customer to SurchargeType (from employees app) with a custom percentage.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='surcharges',
        verbose_name="Customer"
    )
    surcharge_type = models.ForeignKey(
        'employees.SurchargeType',
        on_delete=models.PROTECT,
        related_name='customer_surcharges',
        verbose_name="Surcharge Type"
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=25.00,
        verbose_name="Percentage (%)"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    
    class Meta:
        verbose_name = 'Customer Surcharge'
        verbose_name_plural = 'Customer Surcharges'
        unique_together = ['customer', 'surcharge_type']
        ordering = ['surcharge_type__name']
    
    def __str__(self):
        return f"{self.customer} - {self.surcharge_type}: {self.percentage}%"


class CustomerServiceSurcharge(TimeStampedModel):
    """
    Surcharge configurations specific to services for a customer.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='service_surcharges',
        verbose_name="Customer"
    )
    surcharge_type = models.ForeignKey(
        'employees.SurchargeType',
        on_delete=models.PROTECT,
        related_name='customer_service_surcharges',
        verbose_name="Surcharge Type"
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=25.00,
        verbose_name="Percentage (%)"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    
    class Meta:
        verbose_name = 'Customer Service Surcharge'
        verbose_name_plural = 'Customer Service Surcharges'
        unique_together = ['customer', 'surcharge_type']
        ordering = ['surcharge_type__name']
    
    def __str__(self):
        return f"{self.customer} Service - {self.surcharge_type}: {self.percentage}%"


class CustomerAllowanceSurcharge(TimeStampedModel):
    """
    Surcharge configurations specific to allowances for a customer.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='allowance_surcharges',
        verbose_name="Customer"
    )
    surcharge_type = models.ForeignKey(
        'employees.SurchargeType',
        on_delete=models.PROTECT,
        related_name='customer_allowance_surcharges',
        verbose_name="Surcharge Type"
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=25.00,
        verbose_name="Percentage (%)"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    
    class Meta:
        verbose_name = 'Customer Allowance Surcharge'
        verbose_name_plural = 'Customer Allowance Surcharges'
        unique_together = ['customer', 'surcharge_type']
        ordering = ['surcharge_type__name']
    
    def __str__(self):
        return f"{self.customer} Allowance - {self.surcharge_type}: {self.percentage}%"


# =============================================================================
# CUSTOMER ALLOWANCE (Which allowances a customer pays for)
# =============================================================================

class CustomerAllowance(TimeStampedModel):
    """
    Links a customer to allowance types with optional custom pricing.
    Admin configures which allowances a customer pays for and whether
    surcharges apply to each allowance.
    
    Can reference a global AllowanceType OR have a custom name unique to this customer.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='allowances',
        verbose_name="Customer"
    )
    # Optional: reference to global AllowanceType
    allowance_type = models.ForeignKey(
        'employees.AllowanceType',
        on_delete=models.PROTECT,
        related_name='customer_allowances',
        verbose_name="Allowance Type",
        blank=True,
        null=True,
        help_text="Select a global allowance type OR use custom_name for customer-specific allowance"
    )
    # NEW: Custom name for customer-specific allowances
    custom_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name="Custom Name",
        help_text="Custom allowance name specific to this customer (used if allowance_type is empty)"
    )
    # NEW: Custom code for customer-specific allowances
    custom_code = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name="Custom Code",
        help_text="Short code for this allowance (e.g., 'MASK', 'HAZ')"
    )
    # Price is now required (no longer optional override)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Price (€/hr)",
        help_text="Price per hour for this allowance"
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Is Enabled"
    )
    apply_surcharges = models.BooleanField(
        default=False,
        verbose_name="Apply Surcharges",
        help_text="Whether surcharges (weekend, holiday) apply to this allowance"
    )
    # Many-to-many to SurchargeType for granular control
    enabled_surcharges = models.ManyToManyField(
        'employees.SurchargeType',
        blank=True,
        related_name='customer_allowances_enabled',
        verbose_name="Enabled Surcharges",
        help_text="Specific surcharges that apply to this allowance (if apply_surcharges is True)"
    )
    
    class Meta:
        verbose_name = 'Customer Allowance'
        verbose_name_plural = 'Customer Allowances'
        ordering = ['custom_name', 'allowance_type__name']
    
    def __str__(self):
        name = self.custom_name if self.custom_name else (self.allowance_type.name if self.allowance_type else "Unknown")
        return f"{self.customer} - {name}: €{self.price}/hr"
    
    @property
    def name(self):
        """Returns the effective name (custom or from type)."""
        if self.custom_name:
            return self.custom_name
        if self.allowance_type:
            return self.allowance_type.name
        return "Unknown Allowance"
    
    @property
    def effective_price(self):
        """Returns the price to use for invoicing."""
        return self.price



# =============================================================================
# GRATUITY (Fooi - One-time tips from customers to employees)
# =============================================================================

class Gratuity(TimeStampedModel):
    """
    Tracks gratuities (tips/bonuses) given by customers to employees.
    The gratuity may be received days or weeks after the work is done.
    Appears on both customer invoice and employee payslip.
    """
    
    class GratuityStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Payment to Employee'
        PAID = 'paid', 'Paid to Employee'
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='gratuities',
        verbose_name="Customer"
    )
    employee = models.ForeignKey(
        'employees.EmployeeProfile',
        on_delete=models.CASCADE,
        related_name='gratuities',
        verbose_name="Employee"
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Amount (€)"
    )
    date_received = models.DateField(
        verbose_name="Date Received",
        help_text="Date when admin received the gratuity from customer"
    )
    date_work_done = models.DateField(
        blank=True,
        null=True,
        verbose_name="Date Work Done",
        help_text="Optional: Date when the work was performed"
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    status = models.CharField(
        max_length=20,
        choices=GratuityStatus.choices,
        default=GratuityStatus.PENDING,
        verbose_name="Status"
    )
    paid_to_employee_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Paid to Employee Date",
        help_text="Date when the gratuity was paid to the employee"
    )
    
    class Meta:
        verbose_name = 'Gratuity'
        verbose_name_plural = 'Gratuities'
        ordering = ['-date_received']
    
    def __str__(self):
        return f"€{self.amount} from {self.customer} to {self.employee} ({self.date_received})"


# =============================================================================
# CUSTOMER CONTRACT HISTORY

# =============================================================================

class CustomerContractHistory(TimeStampedModel):
    """
    Tracks historical contracts for customers.
    Each contract is associated with rates that were effective during that period.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='contract_history',
        verbose_name="Customer"
    )
    contract_document = models.FileField(
        upload_to='customers/contracts/history/',
        verbose_name="Contract Document"
    )
    effective_from = models.DateField(

        verbose_name="Effective From",
        help_text="Date when this contract becomes effective"
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
        verbose_name="Notes"
    )
    uploaded_by = models.ForeignKey(
        'employees.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='customer_contracts_uploaded',
        verbose_name="Uploaded By"
    )
    service_rates_snapshot = models.JSONField(
        blank=True,
        default=list,
        verbose_name="Service Rates Snapshot",
        help_text="Snapshot of all service rates at the time of this contract"
    )
    
    class Meta:
        verbose_name = 'Customer Contract History'
        verbose_name_plural = 'Customer Contract Histories'
        ordering = ['-effective_from', '-created_at']
    
    def __str__(self):
        return f"{self.customer} - Contract from {self.effective_from}"


# =============================================================================
# CUSTOMER SERVICE RATE HISTORY
# =============================================================================

class CustomerServiceRateHistory(TimeStampedModel):
    """
    Tracks historical service rates for customers.
    Allows setting future effective dates for rate changes.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='service_rate_history',
        verbose_name="Customer"
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='customer_rate_history',
        verbose_name="Service"
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Price (€)"
    )
    effective_from = models.DateField(
        verbose_name="Effective From",
        help_text="Date when this rate becomes effective"
    )
    effective_to = models.DateField(
        blank=True,
        null=True,
        verbose_name="Effective To",
        help_text="Date when this rate ended (null = current)"
    )
    changed_by = models.ForeignKey(
        'employees.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='customer_service_rates_changed',
        verbose_name="Changed By"
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name="Notes"
    )
    
    class Meta:
        verbose_name = 'Customer Service Rate History'
        verbose_name_plural = 'Customer Service Rate Histories'
        ordering = ['-effective_from', '-created_at']
    
    def __str__(self):
        return f"{self.customer} - {self.service}: €{self.price} from {self.effective_from}"
    
    @classmethod
    def get_rate_for_date(cls, customer, service, target_date):
        """
        Get the service rate that was active for a customer on a specific date.
        Used for invoice generation.
        """
        from django.db.models import Q
        return cls.objects.filter(
            customer=customer,
            service=service,
            effective_from__lte=target_date
        ).filter(
            Q(effective_to__gte=target_date) | Q(effective_to__isnull=True)
        ).order_by('-effective_from').first()


# =============================================================================
# HOLIDAY CALENDAR (For hour splitting calculations)
# =============================================================================

class HolidayCalendar(TimeStampedModel):
    """
    Public holidays for surcharge calculations.
    
    Used to determine if work was done on a holiday,
    which typically has higher surcharge rates.
    """
    
    date = models.DateField(
        unique=True,
        verbose_name="Holiday Date",
        db_index=True
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Holiday Name"
    )
    country = models.CharField(
        max_length=10,
        default='NL',
        verbose_name="Country Code"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Is Active"
    )
    
    class Meta:
        verbose_name = 'Holiday'
        verbose_name_plural = 'Holidays'
        ordering = ['date']
    
    def __str__(self):
        return f"{self.name} ({self.date})"
    
    @classmethod
    def is_holiday(cls, check_date, country='NL'):
        """Check if a given date is a holiday."""
        return cls.objects.filter(
            date=check_date,
            country=country,
            is_active=True
        ).exists()
    
    @classmethod
    def seed_dutch_holidays(cls, year):
        """
        Seed Dutch public holidays for a given year.
        Call this to pre-populate holidays.
        """
        import datetime
        from datetime import timedelta
        
        # Calculate Easter Sunday using Anonymous Gregorian algorithm
        def calc_easter(year):
            a = year % 19
            b = year // 100
            c = year % 100
            d = b // 4
            e = b % 4
            f = (b + 8) // 25
            g = (b - f + 1) // 3
            h = (19 * a + b - d - g + 15) % 30
            i = c // 4
            k = c % 4
            l = (32 + 2 * e + 2 * i - h - k) % 7
            m = (a + 11 * h + 22 * l) // 451
            month = (h + l - 7 * m + 114) // 31
            day = ((h + l - 7 * m + 114) % 31) + 1
            return datetime.date(year, month, day)
        
        easter = calc_easter(year)
        
        holidays = [
            (datetime.date(year, 1, 1), "Nieuwjaarsdag"),  # New Year's Day
            (datetime.date(year, 4, 27), "Koningsdag"),  # King's Day
            (datetime.date(year, 5, 5), "Bevrijdingsdag"),  # Liberation Day
            (datetime.date(year, 12, 25), "Eerste Kerstdag"),  # Christmas Day
            (datetime.date(year, 12, 26), "Tweede Kerstdag"),  # Second Christmas Day
            # Easter-based holidays
            (easter - timedelta(days=2), "Goede Vrijdag"),  # Good Friday
            (easter, "Eerste Paasdag"),  # Easter Sunday
            (easter + timedelta(days=1), "Tweede Paasdag"),  # Easter Monday
            (easter + timedelta(days=39), "Hemelvaartsdag"),  # Ascension Day
            (easter + timedelta(days=49), "Eerste Pinksterdag"),  # Whit Sunday
            (easter + timedelta(days=50), "Tweede Pinksterdag"),  # Whit Monday
        ]
        
        created_count = 0
        for date, name in holidays:
            obj, created = cls.objects.get_or_create(
                date=date,
                defaults={'name': name, 'country': 'NL', 'is_active': True}
            )
            if created:
                created_count += 1
        
        return created_count

