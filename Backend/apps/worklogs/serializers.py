"""WorkLog Serializers."""

from decimal import Decimal
from rest_framework import serializers
from .models import WorkLog, WorkLogPhoto, WorkLogAllowance, Shift


class WorkLogPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLogPhoto
        fields = ['id', 'photo', 'caption', 'taken_at', 'created_at']


class WorkLogAllowanceSerializer(serializers.ModelSerializer):
    """Serializer for work log allowances."""
    allowance_name = serializers.CharField(read_only=True)
    allowance_type_name = serializers.CharField(source='allowance_type.name', read_only=True)
    allowance_type_code = serializers.CharField(source='allowance_type.code', read_only=True)
    base_price = serializers.DecimalField(source='allowance_type.base_price', read_only=True, max_digits=10, decimal_places=2)
    
    class Meta:
        model = WorkLogAllowance
        fields = [
            'id', 'allowance_type', 'allowance_type_name', 'allowance_type_code',
            'custom_allowance_name', 'allowance_name', 'hours', 'notes', 'base_price',
            'start_time', 'end_time'  # From/To time fields
        ]
        read_only_fields = ['id']


class WorkLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True, default='')
    service_name = serializers.CharField(source='service.name', read_only=True, default='')
    customer_name = serializers.CharField(source='project.customer.company_name', read_only=True, default='')
    calculated_hours = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    billable_hours = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    photos = WorkLogPhotoSerializer(many=True, read_only=True)
    allowances = WorkLogAllowanceSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Calculate earnings for employee
    estimated_earnings = serializers.SerializerMethodField()
    
    # Shift assignment info for unified view
    shift_assignment_info = serializers.SerializerMethodField()
    
    class Meta:
        model = WorkLog
        fields = '__all__'
        read_only_fields = [
            'id', 'status', 'submitted_at', 'approved_at', 'approved_by',
            'billing_week_year', 'billing_week_number', 'created_at', 'updated_at',
            'created_by', 'updated_by', 'is_deleted', 'deleted_at', 'deleted_by'
        ]
    
    def get_estimated_earnings(self, obj):
        """Calculate estimated earnings with full breakdown.
        
        Returns:
            dict with base_hours, base_rate, base_amount, allowances_amount, total
            OR None if no employee/rate
        """
        if not obj.employee or not obj.employee.hourly_rate:
            return None
        
        hours = float(obj.billable_hours or obj.calculated_hours or 0)
        hourly_rate = float(obj.employee.hourly_rate)
        base_amount = hours * hourly_rate
        
        # Calculate allowances amount (only those included in employee pay)
        allowances_amount = 0.0
        allowances_list = []
        
        for allowance in obj.allowances.all():
            if allowance.include_in_employee_pay:
                amount = 0.0
                if allowance.allowance_type and allowance.allowance_type.base_price:
                    amount = float(allowance.hours) * float(allowance.allowance_type.base_price)
                    allowances_list.append({
                        'name': allowance.allowance_name,
                        'hours': float(allowance.hours),
                        'rate': float(allowance.allowance_type.base_price),
                        'amount': amount,
                    })
                allowances_amount += amount
        
        return {
            'base_hours': hours,
            'base_rate': hourly_rate,
            'base_amount': round(base_amount, 2),
            'allowances': allowances_list,
            'allowances_amount': round(allowances_amount, 2),
            'total': round(base_amount + allowances_amount, 2),
        }
    
    def get_shift_assignment_info(self, obj):
        """Return info about the linked shift assignment if any."""
        if not obj.shift_assignment:
            return None
        sa = obj.shift_assignment
        pd = sa.planned_day
        return {
            'id': str(sa.id),
            'date': pd.date.isoformat(),
            'shift_name': pd.shift_template.name,
            'shift_color': pd.shift_template.color,
            'project_name': pd.shift_template.project.name,
        }


class WorkLogCreateSerializer(serializers.ModelSerializer):
    """Serializer for employee to create work logs."""
    allowances = WorkLogAllowanceSerializer(many=True, required=False)
    breaks = serializers.JSONField(required=False, default=list)  # [{start: "HH:MM", end: "HH:MM"}, ...]
    
    class Meta:
        model = WorkLog
        fields = [
            'project', 'start_datetime', 'end_datetime',
            'work_date', 'start_time', 'end_time',  # Legacy fields for backward compat
            'break_duration_minutes', 'break_start_time', 'break_end_time', 
            'breaks',  # Multiple breaks array
            'notes', 'supervisor', 'service', 'location_override', 'status',
            'allowances', 'shift_assignment'  # Link to planning system
        ]
        extra_kwargs = {
            'project': {'required': False, 'allow_null': True},  # Made optional - extracted from shift_assignment
            'work_date': {'required': False},
            'start_time': {'required': False},
            'end_time': {'required': False},
            'shift_assignment': {'required': False, 'allow_null': True},
        }
    
    def validate(self, data):
        # If shift_assignment is provided, extract project from it
        shift_assignment = data.get('shift_assignment')
        if shift_assignment and not data.get('project'):
            # Get project from shift_assignment's planned_day's shift_template
            try:
                data['project'] = shift_assignment.planned_day.shift_template.project
            except Exception:
                pass
        
        # If new datetime fields are provided, use them
        if data.get('start_datetime') and data.get('end_datetime'):
            if data['end_datetime'] <= data['start_datetime']:
                raise serializers.ValidationError({'end_datetime': 'End must be after start.'})
        # Fallback: check legacy fields
        elif data.get('start_time') and data.get('end_time'):
            pass  # Allow overnight work
        if data.get('break_duration_minutes', 0) < 0:
            raise serializers.ValidationError({'break_duration_minutes': 'Cannot be negative.'})
        return data
    
    def create(self, validated_data):
        allowances_data = validated_data.pop('allowances', [])
        
        # Auto-submit: set status to 'pending' when created via web dashboard
        validated_data['status'] = 'pending'
        
        work_log = super().create(validated_data)
        
        for allowance_data in allowances_data:
            WorkLogAllowance.objects.create(work_log=work_log, **allowance_data)
        
        return work_log
    
    def update(self, instance, validated_data):
        allowances_data = validated_data.pop('allowances', None)
        work_log = super().update(instance, validated_data)
        
        if allowances_data is not None:
            # Remove existing allowances and recreate
            work_log.allowances.all().delete()
            for allowance_data in allowances_data:
                WorkLogAllowance.objects.create(work_log=work_log, **allowance_data)
        
        return work_log


class WorkLogApprovalSerializer(serializers.Serializer):
    adjusted_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    admin_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class WorkLogRejectionSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=500)


# =============================================================================
# SHIFT SERIALIZERS
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
