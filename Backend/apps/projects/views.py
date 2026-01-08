"""Project API Views."""

from django.db import models
from rest_framework import viewsets, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.employees.views import IsAdmin
from apps.employees.models import EmployeeProfile
from .models import Project, ProjectAssignment, ProjectShiftTemplate, ProjectPlannedDay, ShiftAssignment
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectAssignmentSerializer, ProjectShiftTemplateSerializer,
    ProjectPlannedDaySerializer, ShiftAssignmentSerializer,
    ProjectPlannedDayBulkCreateSerializer, BulkPlanSerializer,
)



class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for project management."""
    
    queryset = Project.objects.select_related(
        'customer', 'outfolder'
    ).prefetch_related('assignments', 'required_certificates').order_by('-created_at')
    permission_classes = [IsAdmin]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectDetailSerializer
    
    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        # Handle multiple supervisors from request
        supervisors = self.request.data.get('supervisors', [])
        if supervisors:
            project.supervisors.set(supervisors)
    
    def perform_update(self, serializer):
        project = serializer.save(updated_by=self.request.user)
        # Handle multiple supervisors from request
        supervisors = self.request.data.get('supervisors')
        if supervisors is not None:
            project.supervisors.set(supervisors)
    
    @action(detail=True, methods=['get'])
    def eligible_employees(self, request, pk=None):
        """Get employees eligible for this project based on certificates."""
        project = self.get_object()
        required_certs = project.required_certificates.filter(
            is_mandatory=True
        ).values_list('certificate_type_id', flat=True)
        
        # Get approved employees with required certificates
        employees = EmployeeProfile.objects.filter(
            status=EmployeeProfile.ProfileStatus.APPROVED
        )
        
        # Filter by certificates if any required
        if required_certs:
            employees = employees.filter(
                certificates__certificate_type_id__in=required_certs,
                certificates__status='verified'
            ).distinct()
        
        from apps.employees.serializers import EmployeeProfileListSerializer
        serializer = EmployeeProfileListSerializer(employees, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active projects."""
        active = self.queryset.filter(status=Project.Status.ACTIVE)
        serializer = ProjectListSerializer(active, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def shift_templates(self, request, pk=None):
        """Get shift templates for a project."""
        project = self.get_object()
        templates = project.shift_templates.filter(is_active=True)
        serializer = ProjectShiftTemplateSerializer(templates, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def planned_days(self, request, pk=None):
        """Get planned days for a project with optional date filtering."""
        project = self.get_object()
        days = ProjectPlannedDay.objects.filter(
            shift_template__project=project
        ).select_related('shift_template', 'supervisor').prefetch_related('assignments__employee')
        
        # Optional date range filtering
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            days = days.filter(date__gte=start_date)
        if end_date:
            days = days.filter(date__lte=end_date)
        
        serializer = ProjectPlannedDaySerializer(days, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def bulk_plan(self, request, pk=None):
        """
        Bulk create planned days with pattern support.
        
        Patterns:
        - weekdays: Monday through Friday
        - weekends: Saturday and Sunday
        - all: Every day
        - specific_days: Only specified days (mon, tue, wed, thu, fri, sat, sun)
        
        Example request:
        {
            "shift_template_id": "uuid-here",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "pattern": "weekdays",
            "required_workers": 1,
            "skip_existing": true
        }
        """
        project = self.get_object()
        
        # Validate shift template belongs to this project
        shift_template_id = request.data.get('shift_template_id')
        if shift_template_id:
            try:
                template = ProjectShiftTemplate.objects.get(id=shift_template_id, project=project)
            except ProjectShiftTemplate.DoesNotExist:
                return Response(
                    {'error': 'Shift template not found or does not belong to this project'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = BulkPlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        
        return Response({
            'created_count': len(result['created']),
            'skipped_count': len(result['skipped']),
            'message': f"Created {len(result['created'])} days, skipped {len(result['skipped'])} existing days",
            'created_days': [{'date': str(d.date), 'id': str(d.id)} for d in result['created'][:20]],  # First 20
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def bulk_clear(self, request, pk=None):
        """
        Delete planned days within a date range.
        
        Example request:
        {
            "start_date": "2025-01-01",
            "end_date": "2025-03-31",
            "shift_template_id": "optional-uuid"  // If not provided, clears all templates
        }
        """
        project = self.get_object()
        
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        shift_template_id = request.data.get('shift_template_id')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        days_to_delete = ProjectPlannedDay.objects.filter(
            shift_template__project=project,
            date__gte=start_date,
            date__lte=end_date
        )
        
        if shift_template_id:
            days_to_delete = days_to_delete.filter(shift_template_id=shift_template_id)
        
        count = days_to_delete.count()
        days_to_delete.delete()
        
        return Response({
            'deleted_count': count,
            'message': f"Deleted {count} planned days"
        })


class ProjectAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for project assignments."""
    
    queryset = ProjectAssignment.objects.select_related(
        'project', 'employee'
    ).order_by('-created_at')
    serializer_class = ProjectAssignmentSerializer
    permission_classes = [IsAdmin]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        # TODO: Create notification for employee
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my(self, request):
        """Get current employee's project assignments."""
        from apps.employees.models import EmployeeProfile
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
            assignments = ProjectAssignment.objects.filter(
                employee=profile
            ).select_related('project', 'project__customer')
            serializer = self.get_serializer(assignments, many=True)
            return Response(serializer.data)
        except EmployeeProfile.DoesNotExist:
            return Response([])


# =============================================================================
# SHIFT PLANNING VIEWSETS
# =============================================================================

class ProjectShiftTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing shift templates."""
    
    queryset = ProjectShiftTemplate.objects.select_related('project').order_by('start_time')
    serializer_class = ProjectShiftTemplateSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectPlannedDayViewSet(viewsets.ModelViewSet):
    """ViewSet for managing planned days."""
    
    queryset = ProjectPlannedDay.objects.select_related(
        'shift_template', 'supervisor'
    ).prefetch_related('assignments__employee').order_by('date')
    serializer_class = ProjectPlannedDaySerializer
    permission_classes = [IsAdmin]
    pagination_class = None  # Disable pagination - calendar needs all days
    
    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by project
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(shift_template__project_id=project_id)
        # Filter by shift template
        template_id = self.request.query_params.get('shift_template')
        if template_id:
            qs = qs.filter(shift_template_id=template_id)
        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(date__year=int(year))
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        return qs
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple planned days at once."""
        serializer = ProjectPlannedDayBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created_days = serializer.save()
        return Response({
            'created_count': len(created_days),
            'days': ProjectPlannedDaySerializer(created_days, many=True).data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['delete'])
    def bulk_delete(self, request):
        """Delete multiple planned days."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        deleted_count, _ = ProjectPlannedDay.objects.filter(id__in=ids).delete()
        return Response({'deleted_count': deleted_count})
    
    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Lightweight calendar endpoint - returns only dates and colors.
        
        Optimized for year view, minimal data transfer.
        Query params:
            - project: required project ID
            - year: optional year (defaults to current)
            - month: optional month for month-only view
        
        Response: {
            "days": {
                "2025-01-15": {"color": "#10B981", "count": 1},
                "2025-01-16": {"color": "#3B82F6", "count": 2}
            },
            "total_days": 25,
            "total_with_staff": 20
        }
        """
        from datetime import date
        
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'error': 'project parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        qs = ProjectPlannedDay.objects.filter(
            shift_template__project_id=project_id
        ).select_related('shift_template').only(
            'date', 'shift_template__color', 'required_workers'
        ).annotate(
            assigned_count_val=models.Count('assignments')
        )
        
        # Filter by year
        if year:
            qs = qs.filter(date__year=int(year))
        else:
            qs = qs.filter(date__year=date.today().year)
        
        # Filter by month if specified
        if month:
            qs = qs.filter(date__month=int(month))
        
        # Build lightweight response
        days = {}
        total_with_staff = 0
        
        for day in qs:
            date_str = day.date.isoformat()
            is_staffed = day.assigned_count_val >= day.required_workers
            
            if date_str in days:
                days[date_str]['count'] += 1
            else:
                days[date_str] = {
                    'color': day.shift_template.color,
                    'count': 1,
                    'staffed': is_staffed,
                }
            
            if is_staffed:
                total_with_staff += 1
        
        return Response({
            'days': days,
            'total_days': len(days),
            'total_with_staff': total_with_staff,
        })


class ShiftAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing shift assignments."""
    
    queryset = ShiftAssignment.objects.select_related(
        'planned_day', 'employee', 'agency'
    ).order_by('planned_day__date')
    serializer_class = ShiftAssignmentSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by project via planned_day
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(planned_day__shift_template__project_id=project_id)
        # Filter by employee
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a shift assignment."""
        assignment = self.get_object()
        assignment.confirm()
        return Response(ShiftAssignmentSerializer(assignment).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a shift assignment."""
        assignment = self.get_object()
        reason = request.data.get('reason', '')
        assignment.cancel(reason)
        return Response(ShiftAssignmentSerializer(assignment).data)
    
    def _get_supervisor_phone(self, supervisor):
        """Get supervisor's phone number from contacts."""
        if not supervisor:
            return None
        for contact in supervisor.contacts.all():
            if contact.contact_type in ['phone', 'mobile']:
                return contact.value
        return None
    
    def _get_supervisor_email(self, supervisor):
        """Get supervisor's email from contacts."""
        if not supervisor:
            return None
        for contact in supervisor.contacts.all():
            if contact.contact_type == 'email':
                return contact.value
        return None
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my(self, request):
        """Get current employee's shift assignments.
        
        OPTIMIZED for mobile:
        - Hides submitted/completed/cancelled shifts
        - Only shows today + future by default
        - Supports pagination
        - Minimal data transfer
        
        Query params:
            - start_date: filter from date
            - end_date: filter to date
            - include_past: if 'true', include past shifts
            - page: page number (default 1)
            - page_size: items per page (default 20, max 50)
        """
        from apps.employees.models import EmployeeProfile
        from datetime import date, timedelta
        
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
        except EmployeeProfile.DoesNotExist:
            return Response({'results': [], 'count': 0, 'has_more': False})
        
        # Base query - exclude hidden statuses
        HIDDEN_STATUSES = ['submitted', 'completed', 'cancelled']
        qs = ShiftAssignment.objects.filter(
            employee=profile
        ).exclude(
            status__in=HIDDEN_STATUSES
        ).select_related(
            'planned_day__shift_template__project',
            'planned_day__supervisor'
        ).order_by('planned_day__date')
        
        # Date filtering
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')
        include_past = request.query_params.get('include_past', 'false').lower() == 'true'
        
        if start_date_param:
            qs = qs.filter(planned_day__date__gte=start_date_param)
        elif not include_past:
            # Default: show from today onwards
            qs = qs.filter(planned_day__date__gte=date.today())
        
        if end_date_param:
            qs = qs.filter(planned_day__date__lte=end_date_param)
        else:
            # Default limit: next 30 days for performance
            max_date = date.today() + timedelta(days=30)
            qs = qs.filter(planned_day__date__lte=max_date)
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 50)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        total_count = qs.count()
        assignments = qs[start_idx:end_idx]
        
        # Build response with minimal but complete data
        today = date.today()
        data = []
        
        for assignment in assignments:
            day = assignment.planned_day
            template = day.shift_template
            project = template.project
            
            is_today = day.date == today
            is_past = day.date < today
            
            # Get linked work logs (if any)
            work_logs = []
            for log in assignment.work_logs.all().order_by('-created_at')[:2]:
                work_logs.append({
                    'id': str(log.id),
                    'status': log.status,
                    'calculated_hours': str(log.calculated_hours),
                    'work_date': log.work_date.isoformat() if log.work_date else None,
                })
            
            data.append({
                'id': str(assignment.id),
                'status': assignment.status,
                'date': day.date.isoformat(),
                'shift_name': template.name,
                'shift_color': template.color,
                'start_time': template.start_time.strftime('%H:%M'),
                'end_time': template.end_time.strftime('%H:%M'),
                'project_id': str(project.id),
                'project_name': project.name,
                'project_location': project.location or '',
                'project_address': project.location_address or '',
                'project_city': project.location_city or '',
                'project_description': project.description or '',
                'customer_name': project.customer.company_name if project.customer else '',
                'supervisor_name': day.supervisor.full_name if day.supervisor else None,
                'supervisor_phone': self._get_supervisor_phone(day.supervisor) if day.supervisor else None,
                'supervisor_email': self._get_supervisor_email(day.supervisor) if day.supervisor else None,
                'notes': day.notes or '',
                'is_today': is_today,
                'is_past': is_past,
                'can_edit': is_today and assignment.status == 'planned',
                'work_logs': work_logs,
            })
        
        return Response({
            'results': data,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': end_idx < total_count,
        })

