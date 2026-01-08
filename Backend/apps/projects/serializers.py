"""Project Serializers."""

from rest_framework import serializers
from apps.employees.models import EmployeeProfile
from .models import (
    Project, ProjectAssignment, ProjectRequiredCertificate,
    ProjectShiftTemplate, ProjectPlannedDay, ShiftAssignment
)


class ProjectRequiredCertificateSerializer(serializers.ModelSerializer):
    certificate_name = serializers.CharField(source='certificate_type.name', read_only=True)
    
    class Meta:
        model = ProjectRequiredCertificate
        fields = ['id', 'certificate_type', 'certificate_name', 'is_mandatory']


class ProjectAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    project_info = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectAssignment
        fields = [
            'id', 'project', 'project_info', 'employee', 'employee_name', 'role', 'role_display',
            'assignment_type', 'start_date', 'end_date', 'is_active', 'notes',
            'is_exception', 'exception_reason', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_project_info(self, obj):
        """Return project with customer info for Flutter."""
        if not obj.project:
            return None
        return {
            'id': obj.project.id,
            'name': obj.project.name,
            'location': obj.project.location,
            'address': obj.project.address,
            'city': obj.project.city,
            'customer': {
                'id': obj.project.customer.id,
                'company_name': obj.project.customer.company_name,
            } if obj.project.customer else None
        }


class ProjectListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)
    assignments_count = serializers.IntegerField(source='assignments.count', read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'name', 'location', 'customer', 'customer_name',
            'status', 'start_date', 'assignments_count', 'created_at'
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)
    outfolder_name = serializers.CharField(source='outfolder.full_name', read_only=True)
    assignments = ProjectAssignmentSerializer(many=True, read_only=True)
    required_certificates = ProjectRequiredCertificateSerializer(many=True, read_only=True)
    supervisors_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by',
                           'is_deleted', 'deleted_at', 'deleted_by']
    
    def get_supervisors_list(self, obj):
        return [{
            'id': str(s.id),
            'first_name': s.first_name,
            'last_name': s.last_name,
            'company_name': s.company_name,
            'contacts': [
                {'contact_type': c.contact_type, 'value': c.value}
                for c in s.contacts.all()
            ]
        } for s in obj.supervisors.all()]


# =============================================================================
# SHIFT PLANNING SERIALIZERS
# =============================================================================

class ProjectShiftTemplateSerializer(serializers.ModelSerializer):
    """Serializer for shift templates."""
    project_name = serializers.CharField(source='project.name', read_only=True)
    planned_days_count = serializers.IntegerField(source='planned_days.count', read_only=True)
    
    class Meta:
        model = ProjectShiftTemplate
        fields = [
            'id', 'project', 'project_name', 'name', 'start_time', 'end_time',
            'color', 'description', 'is_active', 'planned_days_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ShiftAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for shift assignments.
    
    Accepts either:
    - employee: EmployeeProfile UUID directly
    - user_id: User ID (integer) which gets converted to EmployeeProfile
    """
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    agency_name = serializers.CharField(source='agency.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    # Accept user_id for creating assignments (frontend sends User IDs)
    user_id = serializers.IntegerField(write_only=True, required=False)
    # Work logs linked to this assignment
    work_logs = serializers.SerializerMethodField()
    
    class Meta:
        model = ShiftAssignment
        fields = [
            'id', 'planned_day', 'employee', 'employee_name', 'agency', 'agency_name',
            'status', 'status_display', 'notes', 'confirmed_at', 'cancelled_at',
            'cancellation_reason', 'created_at', 'user_id', 'work_logs'
        ]
        read_only_fields = ['id', 'confirmed_at', 'cancelled_at', 'created_at']
        extra_kwargs = {
            'employee': {'required': False, 'allow_null': True}
        }
    
    def get_work_logs(self, obj):
        """Return linked WorkLogs for this assignment."""
        logs = obj.work_logs.all().order_by('-created_at')[:3]  # Limit to 3 most recent
        return [{
            'id': str(log.id),
            'status': log.status,
            'calculated_hours': str(log.calculated_hours),
            'work_date': log.work_date.isoformat() if log.work_date else None,
        } for log in logs]
    
    def to_internal_value(self, data):
        """Convert user_id to employee BEFORE field validation runs."""
        # Make a mutable copy
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        # If user_id is provided, convert it to employee UUID
        user_id = data.pop('user_id', None)
        if user_id and not data.get('employee'):
            try:
                profile = EmployeeProfile.objects.get(user_id=user_id)
                data['employee'] = str(profile.id)  # Set the UUID as string
            except EmployeeProfile.DoesNotExist:
                raise serializers.ValidationError({'user_id': f'Employee with user ID {user_id} not found'})
        
        return super().to_internal_value(data)
    
    def validate(self, data):
        """Ensure employee is provided."""
        if not data.get('employee'):
            raise serializers.ValidationError({'employee': 'Either employee or user_id must be provided'})
        return data


class ProjectPlannedDaySerializer(serializers.ModelSerializer):
    """Serializer for planned days."""
    shift_name = serializers.CharField(source='shift_template.name', read_only=True)
    shift_color = serializers.CharField(source='shift_template.color', read_only=True)
    shift_start_time = serializers.TimeField(source='shift_template.start_time', read_only=True)
    shift_end_time = serializers.TimeField(source='shift_template.end_time', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True, default='')
    project_id = serializers.UUIDField(source='shift_template.project.id', read_only=True)
    project_name = serializers.CharField(source='shift_template.project.name', read_only=True)
    assignments = ShiftAssignmentSerializer(many=True, read_only=True)
    assigned_count = serializers.IntegerField(read_only=True)
    is_fully_staffed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ProjectPlannedDay
        fields = [
            'id', 'shift_template', 'shift_name', 'shift_color', 'shift_start_time',
            'shift_end_time', 'date', 'supervisor', 'supervisor_name', 'required_workers',
            'notes', 'project_id', 'project_name', 'assignments', 'assigned_count',
            'is_fully_staffed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ProjectPlannedDayBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating planned days with employee assignments.
    
    Supports:
    - Creating multiple planned days at once
    - Optionally assigning employees to all created days
    - Smart notifications (only if 3 or fewer assignments created)
    """
    shift_template = serializers.PrimaryKeyRelatedField(queryset=ProjectShiftTemplate.objects.all())
    dates = serializers.ListField(child=serializers.DateField())
    employee_ids = serializers.ListField(
        child=serializers.IntegerField(),  # User IDs are integers, not UUIDs
        required=False,
        default=[],
        help_text="Optional: User IDs to assign to all created days"
    )
    supervisor = serializers.UUIDField(required=False, allow_null=True)
    required_workers = serializers.IntegerField(default=1, min_value=1)
    
    def validate_supervisor(self, value):
        if value:
            from apps.customers.models import Outfolder
            if not Outfolder.objects.filter(id=value).exists():
                raise serializers.ValidationError("Supervisor not found")
        return value
    
    def validate_employee_ids(self, value):
        """Validate that employee_ids are valid User IDs that have EmployeeProfiles."""
        if value:
            from apps.employees.models import EmployeeProfile
            # The frontend sends User IDs, so we need to check if these users have profiles
            profiles = EmployeeProfile.objects.filter(user_id__in=value)
            found_user_ids = {str(p.user_id) for p in profiles}
            for user_id in value:
                if str(user_id) not in found_user_ids:
                    raise serializers.ValidationError(f"Employee with user ID {user_id} not found")
        return value
    
    def create(self, validated_data):
        from apps.employees.models import EmployeeProfile
        
        dates = validated_data.pop('dates')
        shift_template = validated_data['shift_template']
        user_ids = validated_data.get('employee_ids', [])  # These are User IDs
        created_days = []
        all_assignments = []
        skipped_conflicts = []
        
        # Lookup EmployeeProfiles by user_id
        profiles_by_user_id = {}
        if user_ids:
            profiles = EmployeeProfile.objects.filter(user_id__in=user_ids)
            profiles_by_user_id = {str(p.user_id): p for p in profiles}
        
        # Create planned days
        for date in dates:
            day, created = ProjectPlannedDay.objects.get_or_create(
                shift_template=shift_template,
                date=date,
                defaults={
                    'supervisor_id': validated_data.get('supervisor'),
                    'required_workers': max(validated_data.get('required_workers', 1), len(user_ids))
                }
            )
            if created:
                created_days.append(day)
            
            # Create assignments for this day using EmployeeProfile
            for user_id in user_ids:
                profile = profiles_by_user_id.get(str(user_id))
                if profile:
                    # Check if employee is already assigned to ANY shift on this date (same project)
                    existing_assignment = ShiftAssignment.objects.filter(
                        employee=profile,
                        planned_day__date=date,
                        planned_day__shift_template__project=shift_template.project
                    ).first()
                    
                    if existing_assignment:
                        # Skip - employee already has a shift on this date for this project
                        skipped_conflicts.append({
                            'employee': profile.full_name,
                            'date': str(date),
                            'existing_shift': existing_assignment.planned_day.shift_template.name
                        })
                        continue
                    
                    assignment, assignment_created = ShiftAssignment.objects.get_or_create(
                        planned_day=day,
                        employee=profile,
                        defaults={'status': 'planned'}
                    )
                    if assignment_created:
                        all_assignments.append(assignment)
        
        # Send notifications if 3 or fewer assignments created
        if len(all_assignments) > 0 and len(all_assignments) <= 3:
            self._send_assignment_notifications(all_assignments)
        
        # Log skipped conflicts for debugging (optional - could be returned to frontend)
        if skipped_conflicts:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Skipped {len(skipped_conflicts)} conflicting assignments: {skipped_conflicts}")
        
        return created_days
    
    def _send_assignment_notifications(self, assignments):
        """Send push notifications for newly created shift assignments."""
        try:
            from apps.notifications.models import Notification
            
            for assignment in assignments:
                day = assignment.planned_day
                template = day.shift_template
                project = template.project
                
                Notification.objects.create(
                    recipient=assignment.employee.user,
                    title="New Shift Assignment",
                    message=f"You have been assigned to {template.name} on {day.date.strftime('%A, %B %d, %Y')} at {project.name}.",
                    notification_type='shift_assignment',
                    priority='normal',
                )
        except Exception as e:
            # Don't fail the whole operation if notifications fail
            import logging
            logging.getLogger(__name__).warning(f"Failed to send shift notifications: {e}")


class BulkPlanSerializer(serializers.Serializer):
    """
    Advanced bulk planning with date patterns.
    
    Supports: weekdays, weekends, all, specific_days (mon, tue, wed, etc.)
    """
    shift_template_id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    pattern = serializers.ChoiceField(
        choices=['weekdays', 'weekends', 'all', 'specific_days'],
        default='weekdays'
    )
    specific_days = serializers.ListField(
        child=serializers.ChoiceField(choices=['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        required=False,
        default=[]
    )
    supervisor_id = serializers.UUIDField(required=False, allow_null=True)
    required_workers = serializers.IntegerField(default=1, min_value=1)
    skip_existing = serializers.BooleanField(default=True)
    
    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError("start_date must be before end_date")
        
        # Validate shift template exists
        from apps.projects.models import ProjectShiftTemplate
        try:
            data['shift_template'] = ProjectShiftTemplate.objects.get(id=data['shift_template_id'])
        except ProjectShiftTemplate.DoesNotExist:
            raise serializers.ValidationError({"shift_template_id": "Shift template not found"})
        
        # Validate supervisor if provided
        if data.get('supervisor_id'):
            from apps.customers.models import Outfolder
            try:
                data['supervisor'] = Outfolder.objects.get(id=data['supervisor_id'])
            except Outfolder.DoesNotExist:
                raise serializers.ValidationError({"supervisor_id": "Supervisor not found"})
        else:
            data['supervisor'] = None
        
        # Require specific_days for specific_days pattern
        if data['pattern'] == 'specific_days' and not data.get('specific_days'):
            raise serializers.ValidationError({"specific_days": "Required when pattern is 'specific_days'"})
        
        return data
    
    def _day_matches_pattern(self, date, pattern, specific_days):
        """Check if a date matches the specified pattern."""
        weekday = date.weekday()  # 0=Monday, 6=Sunday
        weekday_names = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        
        if pattern == 'weekdays':
            return weekday < 5  # Mon-Fri
        elif pattern == 'weekends':
            return weekday >= 5  # Sat-Sun
        elif pattern == 'all':
            return True
        elif pattern == 'specific_days':
            return weekday_names[weekday] in specific_days
        return False
    
    def create(self, validated_data):
        from datetime import timedelta
        
        shift_template = validated_data['shift_template']
        start_date = validated_data['start_date']
        end_date = validated_data['end_date']
        pattern = validated_data['pattern']
        specific_days = validated_data.get('specific_days', [])
        supervisor = validated_data.get('supervisor')
        required_workers = validated_data.get('required_workers', 1)
        skip_existing = validated_data.get('skip_existing', True)
        
        created_days = []
        skipped_days = []
        current_date = start_date
        
        while current_date <= end_date:
            if self._day_matches_pattern(current_date, pattern, specific_days):
                if skip_existing:
                    day, created = ProjectPlannedDay.objects.get_or_create(
                        shift_template=shift_template,
                        date=current_date,
                        defaults={
                            'supervisor': supervisor,
                            'required_workers': required_workers
                        }
                    )
                    if created:
                        created_days.append(day)
                    else:
                        skipped_days.append(current_date)
                else:
                    day = ProjectPlannedDay.objects.create(
                        shift_template=shift_template,
                        date=current_date,
                        supervisor=supervisor,
                        required_workers=required_workers
                    )
                    created_days.append(day)
            
            current_date += timedelta(days=1)
        
        return {
            'created': created_days,
            'skipped': skipped_days
        }
