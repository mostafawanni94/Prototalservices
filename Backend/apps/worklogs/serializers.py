"""WorkEntry Serializers - Unified Work Entry System."""

from decimal import Decimal
from datetime import datetime
from rest_framework import serializers
from django.conf import settings
from zoneinfo import ZoneInfo
from apps.employees.models import EmployeeProfile
from apps.customers.models import Outfolder
from .models import Shift, WorkEntry


class LocalDateTimeField(serializers.DateTimeField):
    """
    Custom DateTimeField that treats naive datetimes as Amsterdam local time
    and ensures proper round-trip without unwanted UTC conversion.
    """
    def to_internal_value(self, value):
        """Parse incoming datetime string as Amsterdam local time."""
        if not value:
            return None
        
        amsterdam_tz = ZoneInfo('Europe/Amsterdam')
        
        # Parse the datetime string
        if isinstance(value, str):
            # Remove timezone suffix if present (we'll handle it ourselves)
            if '+' in value:
                value = value.split('+')[0]
            if value.endswith('Z'):
                value = value[:-1]
            
            # Try common formats
            formats = [
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%dT%H:%M',
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
            ]
            
            for fmt in formats:
                try:
                    dt = datetime.strptime(value, fmt)
                    # Attach Amsterdam timezone - this is the key!
                    # The datetime is interpreted as Amsterdam local time
                    return dt.replace(tzinfo=amsterdam_tz)
                except ValueError:
                    continue
            
            raise serializers.ValidationError(f'Invalid datetime format: {value}')
        
        # If already a datetime object
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=amsterdam_tz)
            return value
        
        return super().to_internal_value(value)
    
    def to_representation(self, value):
        """Return datetime in local time without timezone suffix."""
        if not value:
            return None
        
        amsterdam_tz = ZoneInfo('Europe/Amsterdam')
        
        if value.tzinfo is not None:
            # Convert to Amsterdam time
            local_dt = value.astimezone(amsterdam_tz)
        else:
            local_dt = value
        
        # Return as ISO string WITHOUT timezone suffix
        return local_dt.strftime('%Y-%m-%dT%H:%M:%S')


# =============================================================================
# SHIFT SERIALIZERS (Legacy - kept for backward compatibility)
# =============================================================================

class ShiftSerializer(serializers.ModelSerializer):
    """Full shift serializer with related data."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    customer_name = serializers.CharField(source='project.customer.company_name', read_only=True, default='')
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True, default='')
    service_name = serializers.CharField(source='service.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Computed properties
    is_today = serializers.BooleanField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    is_future = serializers.BooleanField(read_only=True)
    can_fill_data = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Shift
        fields = '__all__'
        read_only_fields = [
            'id', 'status', 'work_log', 'approved_by', 'approved_at',
            'created_at', 'updated_at', 'created_by', 'updated_by',
            'is_deleted', 'deleted_at', 'deleted_by'
        ]


class ShiftCreateSerializer(serializers.ModelSerializer):
    """Serializer for admin to create shifts."""
    
    class Meta:
        model = Shift
        fields = [
            'employee', 'project', 'supervisor', 'service',
            'scheduled_date', 'scheduled_start_time', 'scheduled_end_time',
            'location_notes', 'supervisor_phone', 'supervisor_email',
            'special_instructions'
        ]
    
    def validate_scheduled_date(self, value):
        from django.utils import timezone
        if value < timezone.localdate():
            raise serializers.ValidationError("Cannot schedule shifts for past dates")
        return value


class ShiftFillDataSerializer(serializers.Serializer):
    """Serializer for employee to fill actual work data."""
    start_time = serializers.TimeField(required=True)
    end_time = serializers.TimeField(required=True)
    break_start_time = serializers.TimeField(required=False, allow_null=True)
    break_end_time = serializers.TimeField(required=False, allow_null=True)
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class ShiftRejectionSerializer(serializers.Serializer):
    """Serializer for admin to reject a shift."""
    reason = serializers.CharField(min_length=5, max_length=500)


# =============================================================================
# UNIFIED WORK ENTRY SERIALIZERS
# =============================================================================

class WorkEntryListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing work entries.
    Optimized for mobile and web list views.
    """
    # Employee info
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id = serializers.UUIDField(source='employee.id', read_only=True)
    
    # Project info  
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    customer_name = serializers.SerializerMethodField()
    
    # Shift template info
    shift_name = serializers.CharField(source='shift_template.name', read_only=True, allow_null=True)
    shift_color = serializers.CharField(source='shift_template.color', read_only=True, allow_null=True)
    
    # Supervisor info
    supervisor_name = serializers.CharField(source='planned_supervisor.full_name', read_only=True, allow_null=True)
    supervisor_phone = serializers.SerializerMethodField()
    supervisor_email = serializers.SerializerMethodField()
    
    # Location
    location = serializers.SerializerMethodField()
    full_address = serializers.SerializerMethodField()
    
    # Service info
    service_name = serializers.CharField(source='service.name', read_only=True, allow_null=True)
    
    # Legacy-compatible time fields for frontend
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    
    # Override datetime fields to return local time without timezone offset
    # This prevents the frontend from converting and losing hours
    actual_start_datetime = serializers.SerializerMethodField()
    actual_end_datetime = serializers.SerializerMethodField()
    
    # Computed fields
    calculated_hours = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    display_time_range = serializers.CharField(read_only=True)
    is_today = serializers.BooleanField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    is_future = serializers.BooleanField(read_only=True)
    can_fill_data = serializers.BooleanField(read_only=True)
    
    # Price calculation fields (Customer billing)
    calculated_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    service_rate = serializers.SerializerMethodField()
    surcharges_applied = serializers.SerializerMethodField()
    
    # Employee payment fields
    employee_payment = serializers.SerializerMethodField()
    employee_breakdown = serializers.SerializerMethodField()
    employee_hourly_rate = serializers.SerializerMethodField()
    receives_surcharges = serializers.SerializerMethodField()
    
    # Invoice-compatible fields
    surcharges_breakdown = serializers.SerializerMethodField()
    hours_breakdown = serializers.SerializerMethodField()
    break_duration = serializers.SerializerMethodField()
    breaks = serializers.JSONField(read_only=True)
    
    class Meta:
        model = WorkEntry
        fields = [
            'id', 'status', 'work_date',
            # Employee
            'employee_id', 'employee_name',
            # Project
            'project_id', 'project_name', 'customer_name',
            # Shift template
            'shift_name', 'shift_color',
            # Service
            'service_name',
            # Times (both new and legacy-compatible)
            'planned_start_time', 'planned_end_time',
            'actual_start_datetime', 'actual_end_datetime',
            'display_time_range',
            'start_time', 'end_time',  # Legacy-compatible
            # Supervisor
            'supervisor_name', 'supervisor_phone', 'supervisor_email',
            # Location
            'location', 'full_address',
            # Computed
            'calculated_hours', 'is_today', 'is_past', 'is_future', 'can_fill_data',
            # Customer Price
            'calculated_price', 'service_rate', 'surcharges_applied',
            # Employee Payment
            'employee_payment', 'employee_breakdown', 'employee_hourly_rate', 'receives_surcharges',
            # Invoice-compatible
            'surcharges_breakdown', 'hours_breakdown', 'break_duration', 'breaks',
            # Allowances (Toeslag)
            'allowances',
            # Notes
            'notes',
            # Timestamps
            'created_at', 'submitted_at', 'approved_at',
        ]
    
    def get_customer_name(self, obj):
        if obj.project and obj.project.customer:
            return obj.project.customer.company_name
        return None
    
    def get_supervisor_phone(self, obj):
        if obj.planned_supervisor:
            for contact in obj.planned_supervisor.contacts.all():
                if contact.contact_type in ['phone', 'mobile']:
                    return contact.value
        return None
    
    def get_supervisor_email(self, obj):
        if obj.planned_supervisor:
            for contact in obj.planned_supervisor.contacts.all():
                if contact.contact_type == 'email':
                    return contact.value
        return None
    
    def get_location(self, obj):
        if obj.location_override:
            return obj.location_override
        if obj.project:
            return obj.project.location or ''
        return ''
    
    def get_full_address(self, obj):
        if obj.location_override:
            return obj.location_override
        if obj.project:
            parts = [
                obj.project.location or '',
                obj.project.location_address or '',
                obj.project.location_city or '',
            ]
            return ', '.join(p for p in parts if p)
        return ''
    
    def get_start_time(self, obj):
        """Legacy-compatible: Return start time as HH:MM string in local time."""
        if obj.actual_start_datetime:
            from zoneinfo import ZoneInfo
            amsterdam_tz = ZoneInfo('Europe/Amsterdam')
            local_dt = obj.actual_start_datetime.astimezone(amsterdam_tz) if obj.actual_start_datetime.tzinfo else obj.actual_start_datetime
            return local_dt.strftime('%H:%M')
        if obj.planned_start_time:
            return obj.planned_start_time.strftime('%H:%M')
        return None
    
    def get_end_time(self, obj):
        """Legacy-compatible: Return end time as HH:MM string in local time."""
        if obj.actual_end_datetime:
            from zoneinfo import ZoneInfo
            amsterdam_tz = ZoneInfo('Europe/Amsterdam')
            local_dt = obj.actual_end_datetime.astimezone(amsterdam_tz) if obj.actual_end_datetime.tzinfo else obj.actual_end_datetime
            return local_dt.strftime('%H:%M')
        if obj.planned_end_time:
            return obj.planned_end_time.strftime('%H:%M')
        return None
    
    def get_actual_start_datetime(self, obj):
        """Return actual_start_datetime in local time without timezone suffix.
        This prevents the frontend from doing any timezone conversion."""
        if obj.actual_start_datetime:
            from django.utils import timezone
            from zoneinfo import ZoneInfo
            
            dt = obj.actual_start_datetime
            # Convert to Amsterdam local time if it's in UTC
            amsterdam_tz = ZoneInfo('Europe/Amsterdam')
            if dt.tzinfo is not None:
                local_dt = dt.astimezone(amsterdam_tz)
            else:
                local_dt = dt
            
            # Return as ISO string WITHOUT timezone suffix (e.g., "2026-01-20T20:00:00")
            return local_dt.strftime('%Y-%m-%dT%H:%M:%S')
        return None
    
    def get_actual_end_datetime(self, obj):
        """Return actual_end_datetime in local time without timezone suffix.
        This prevents the frontend from doing any timezone conversion."""
        if obj.actual_end_datetime:
            from django.utils import timezone
            from zoneinfo import ZoneInfo
            
            dt = obj.actual_end_datetime
            # Convert to Amsterdam local time if it's in UTC
            amsterdam_tz = ZoneInfo('Europe/Amsterdam')
            if dt.tzinfo is not None:
                local_dt = dt.astimezone(amsterdam_tz)
            else:
                local_dt = dt
            
            # Return as ISO string WITHOUT timezone suffix (e.g., "2026-01-21T04:30:00")
            return local_dt.strftime('%Y-%m-%dT%H:%M:%S')
        return None
    
    def get_service_rate(self, obj):
        """Get hourly service rate for this entry."""
        rate = obj.get_service_rate()
        return float(rate) if rate else 0
    
    def get_surcharges_applied(self, obj):
        """Get list of surcharges that actually applied to this work entry.
        
        Only returns surcharges with hours > 0 from the calculation.
        This ensures only applicable surcharges are shown (e.g., no weekend
        surcharge displayed for weekday work).
        """
        breakdown = obj.get_hours_breakdown_detailed()
        surcharges = breakdown.get('surcharges', [])
        
        # Return only surcharges with hours > 0
        result = []
        for s in surcharges:
            if s.get('hours', 0) > 0:
                result.append({
                    'id': str(hash(s.get('name', ''))),  # Generate ID from name
                    'name': s.get('name', ''),
                    'category': s.get('category', ''),
                    'percentage': s.get('percentage', 0),
                    'hours': s.get('hours', 0),
                    'amount': s.get('amount', 0),
                })
        return result
    
    def get_surcharges_breakdown(self, obj):
        """Get comprehensive surcharge breakdown for invoice calculations."""
        breakdown = obj.get_hours_breakdown_detailed()
        base_rate = float(obj.get_service_rate())
        
        # Calculate amounts from detailed breakdown
        normal_hours = breakdown.get('normal_hours', 0)
        total_hours = breakdown.get('total_hours', 0)
        surcharges_list = breakdown.get('surcharges', [])
        
        base_amount = total_hours * base_rate
        total_surcharge_amount = sum(s.get('amount', 0) for s in surcharges_list)
        
        # Get allowances amount from the detailed breakdown (correctly looks up allowance rates)
        allowances_amount = breakdown.get('total_allowances_amount', 0)
        
        return {
            'base_rate': base_rate,
            'base_amount': round(base_amount, 2),
            'normal_hours': normal_hours,
            'total_surcharge_amount': round(total_surcharge_amount, 2),
            'total_allowances_amount': round(allowances_amount, 2),
            'total': round(base_amount + total_surcharge_amount + allowances_amount, 2),
            'breakdown': surcharges_list,
        }
    
    def get_hours_breakdown(self, obj):
        """Get hours breakdown by type (normal, night, weekend, etc.)."""
        return obj.get_hours_breakdown_detailed()
    
    def get_break_duration(self, obj):
        """Get break duration as formatted string (e.g., '0:30')."""
        minutes = obj._get_total_break_minutes()
        if minutes > 0:
            hours = minutes // 60
            mins = minutes % 60
            return f"{hours}:{mins:02d}"
        return "0:00"
    
    def get_employee_payment(self, obj):
        """Get calculated employee payment amount."""
        return str(obj.calculated_employee_payment)
    
    def get_employee_breakdown(self, obj):
        """Get employee payment breakdown."""
        return obj.get_employee_hours_breakdown()
    
    def get_employee_hourly_rate(self, obj):
        """Get employee's hourly rate."""
        if obj.employee and hasattr(obj.employee, 'hourly_rate'):
            return float(obj.employee.hourly_rate or 0)
        return 0.0
    
    def get_receives_surcharges(self, obj):
        """Get whether employee receives surcharges."""
        if obj.employee and hasattr(obj.employee, 'receives_surcharges'):
            return obj.employee.receives_surcharges or False
        return False


class WorkEntryDetailSerializer(WorkEntryListSerializer):
    """
    Full detail serializer for single work entry view.
    Includes all fields and breakdown data.
    """
    # Include breaks
    breaks = serializers.JSONField()
    break_duration_minutes = serializers.IntegerField()
    
    # Admin fields
    admin_notes = serializers.CharField(allow_blank=True)
    admin_adjusted_hours = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    
    # Billing info
    billing_week_year = serializers.IntegerField(allow_null=True)
    billing_week_number = serializers.IntegerField(allow_null=True)
    
    # Rejection
    rejection_reason = serializers.CharField(allow_blank=True)
    
    # Agency
    agency_name = serializers.CharField(source='agency.name', read_only=True, allow_null=True)
    
    # Raw FK fields for frontend edit forms
    project = serializers.UUIDField(source='project.id', read_only=True)
    service = serializers.PrimaryKeyRelatedField(read_only=True)
    supervisor = serializers.UUIDField(source='planned_supervisor.id', read_only=True, allow_null=True)
    
    class Meta(WorkEntryListSerializer.Meta):
        fields = WorkEntryListSerializer.Meta.fields + [
            'breaks', 'break_duration_minutes',
            'admin_notes', 'admin_adjusted_hours',
            'billing_week_year', 'billing_week_number',
            'rejection_reason',
            'agency_name',
            'confirmed_at', 'cancelled_at', 'cancellation_reason',
            'approved_by',
            # Raw FK fields
            'project', 'service', 'supervisor',
        ]


class WorkEntryCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating work entries.
    Used by employees to fill actual work data.
    """
    breaks = serializers.JSONField(required=False, default=list)
    
    # Field aliases for frontend compatibility
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=Outfolder.objects.all(),  # Outfolder = customer supervisor
        source='planned_supervisor',
        required=False,
        allow_null=True,
        write_only=True
    )
    start_datetime = LocalDateTimeField(
        source='actual_start_datetime',
        required=False,
        allow_null=True,
        write_only=True
    )
    end_datetime = LocalDateTimeField(
        source='actual_end_datetime',
        required=False,
        allow_null=True,
        write_only=True,
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', 'iso-8601'],
        default_timezone=None  # This makes it use settings.TIME_ZONE for naive datetimes
    )
    # Break time fields for frontend (converted to breaks JSON array)
    break_start_time = serializers.TimeField(required=False, allow_null=True, write_only=True)
    break_end_time = serializers.TimeField(required=False, allow_null=True, write_only=True)
    
    class Meta:
        model = WorkEntry
        fields = [
            'employee', 'project', 'shift_template',
            'work_date', 'status',
            'planned_start_time', 'planned_end_time', 'planned_supervisor',
            'actual_start_datetime', 'actual_end_datetime',
            'breaks', 'break_duration_minutes',
            'allowances',  # Added to store Toeslag data
            'service', 'location_override',
            'notes',
            # Aliases for frontend
            'supervisor', 'start_datetime', 'end_datetime',
            'break_start_time', 'break_end_time',
        ]
        extra_kwargs = {
            'employee': {'required': False},  # Not required for updates
            'project': {'required': False},
            'work_date': {'required': False},
            'status': {'required': False, 'default': 'pending'},
            'shift_template': {'required': False, 'allow_null': True},
            'planned_supervisor': {'required': False, 'allow_null': True},
            'actual_start_datetime': {'required': False, 'allow_null': True},
            'actual_end_datetime': {'required': False, 'allow_null': True},
        }
    
    def validate(self, data):
        # Validate that end time is after start time if both are provided
        start = data.get('actual_start_datetime')
        end = data.get('actual_end_datetime')
        
        if start and end and end <= start:
            raise serializers.ValidationError({
                'actual_end_datetime': 'End time must be after start time'
            })
        
        # Convert break_start_time/break_end_time to breaks JSON array
        break_start = data.pop('break_start_time', None)
        break_end = data.pop('break_end_time', None)
        if break_start and break_end:
            data['breaks'] = [{'start': str(break_start), 'end': str(break_end)}]
            
            # Validate that break times fall within work time window
            if start and end:
                from datetime import time as dt_time
                
                work_start_time = start.time()
                work_end_time = end.time()
                is_overnight = end.date() > start.date()
                
                # Convert break times to time objects for comparison
                break_start_time = break_start if isinstance(break_start, dt_time) else dt_time.fromisoformat(str(break_start))
                break_end_time = break_end if isinstance(break_end, dt_time) else dt_time.fromisoformat(str(break_end))
                
                if is_overnight:
                    # For overnight shifts (e.g., 21:00-05:00):
                    # Valid break if: break is in evening part [work_start, 23:59] 
                    #                 OR in morning part [00:00, work_end]
                    break_in_evening = break_start_time >= work_start_time and break_end_time >= work_start_time
                    break_in_morning = break_start_time <= work_end_time and break_end_time <= work_end_time
                    
                    if not (break_in_evening or break_in_morning):
                        raise serializers.ValidationError({
                            'breaks': f'Break time ({break_start_time.strftime("%H:%M")}-{break_end_time.strftime("%H:%M")}) must be within work hours ({work_start_time.strftime("%H:%M")}-{work_end_time.strftime("%H:%M")})'
                        })
                else:
                    # Same-day shift: break must be fully within work window
                    if break_start_time < work_start_time or break_end_time > work_end_time:
                        raise serializers.ValidationError({
                            'breaks': f'Break time ({break_start_time.strftime("%H:%M")}-{break_end_time.strftime("%H:%M")}) must be within work hours ({work_start_time.strftime("%H:%M")}-{work_end_time.strftime("%H:%M")})'
                        })
        
        return data

    
    def create(self, validated_data):
        # Set created_by from request user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            
            # Auto-populate employee from authenticated user if not provided
            if not validated_data.get('employee'):
                try:
                    validated_data['employee'] = EmployeeProfile.objects.get(user=request.user)
                except EmployeeProfile.DoesNotExist:
                    raise serializers.ValidationError({'employee': 'No employee profile found for authenticated user.'})
        
        # For create, employee, project, work_date are required
        if not validated_data.get('employee'):
            raise serializers.ValidationError({'employee': 'This field is required. Please authenticate or provide employee ID.'})
        if not validated_data.get('project'):
            raise serializers.ValidationError({'project': 'This field is required.'})
        if not validated_data.get('work_date'):
            raise serializers.ValidationError({'work_date': 'This field is required.'})
        
        from apps.projects.models import ProjectPlannedDay, ProjectShiftTemplate
        
        template = validated_data.get('shift_template')
        project = validated_data.get('project')
        work_date = validated_data.get('work_date')
        
        # If no shift template provided, find or create a default "Manual Entry" template
        if not template and project:
            template, _ = ProjectShiftTemplate.objects.get_or_create(
                project=project,
                name='Manual Entry',
                defaults={
                    'start_time': '09:00:00',
                    'end_time': '17:00:00',
                    'color': '#6B7280',  # Gray color for manual entries
                    'is_active': True,
                }
            )
            validated_data['shift_template'] = template
        
        # Auto-populate planned times from shift template
        if template:
            if not validated_data.get('planned_start_time'):
                validated_data['planned_start_time'] = template.start_time
            if not validated_data.get('planned_end_time'):
                validated_data['planned_end_time'] = template.end_time
            
            # Create a ProjectPlannedDay if it doesn't exist
            # This ensures the work entry shows in the Planning calendar
            if work_date:
                ProjectPlannedDay.objects.get_or_create(
                    shift_template=template,
                    date=work_date,
                    defaults={
                        'required_workers': 1,
                        'supervisor': validated_data.get('planned_supervisor'),
                    }
                )
        
        return super().create(validated_data)


class WorkEntryFillDataSerializer(serializers.Serializer):
    """Serializer for employee to fill actual work times."""
    actual_start_datetime = serializers.DateTimeField(required=True)
    actual_end_datetime = serializers.DateTimeField(required=True)
    breaks = serializers.JSONField(required=False, default=list)
    break_duration_minutes = serializers.IntegerField(required=False, default=0)
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    
    def validate(self, data):
        start = data.get('actual_start_datetime')
        end = data.get('actual_end_datetime')
        if start and end and end <= start:
            raise serializers.ValidationError({
                'actual_end_datetime': 'End time must be after start time'
            })
        return data


class WorkEntryApprovalSerializer(serializers.Serializer):
    """Serializer for admin to approve work entry."""
    adjusted_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    admin_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class WorkEntryRejectionSerializer(serializers.Serializer):
    """Serializer for admin to reject work entry."""
    reason = serializers.CharField(min_length=5, max_length=500)
