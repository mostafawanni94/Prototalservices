"""WorkEntry API Views - Unified Work Entry System."""

from datetime import date, timedelta
from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.db import models

from apps.employees.views import IsAdmin, IsAdminOrSelf
from apps.employees.models import EmployeeProfile
from apps.core.pagination import LargePagination
from .models import Shift, WorkEntry
from .serializers import (
    ShiftSerializer, ShiftCreateSerializer, ShiftFillDataSerializer, ShiftRejectionSerializer,
    WorkEntryListSerializer, WorkEntryDetailSerializer, WorkEntryCreateSerializer,
    WorkEntryFillDataSerializer, WorkEntryApprovalSerializer, WorkEntryRejectionSerializer,
    WorkEntryBulkCreateSerializer,
)


# =============================================================================
# SHIFT VIEWSET (Legacy - kept for backward compatibility)
# =============================================================================

class ShiftViewSet(viewsets.ModelViewSet):
    """ViewSet for shift scheduling and management."""
    
    queryset = Shift.objects.select_related(
        'employee', 'project', 'supervisor', 'service', 'approved_by'
    ).order_by('-scheduled_date', 'scheduled_start_time')
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(employee__user=user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShiftCreateSerializer
        if self.action == 'fill_data':
            return ShiftFillDataSerializer
        if self.action == 'reject':
            return ShiftRejectionSerializer
        return ShiftSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'destroy', 'approve', 'reject', 'pending']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]
    
    @action(detail=False, methods=['get'])
    def my_shifts(self, request):
        """Get employee's upcoming shifts."""
        from django.utils import timezone
        today = timezone.localdate()
        
        shifts = self.queryset.filter(
            employee__user=request.user,
            scheduled_date__gte=today,
        ).exclude(
            status__in=[Shift.Status.APPROVED, Shift.Status.CANCELLED]
        ).order_by('scheduled_date', 'scheduled_start_time')
        
        serializer = ShiftSerializer(shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Mark shift as acknowledged."""
        shift = self.get_object()
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        shift.acknowledge()
        return Response(ShiftSerializer(shift).data)
    
    @action(detail=True, methods=['post'])
    def fill_data(self, request, pk=None):
        """Employee fills actual work data."""
        shift = self.get_object()
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        if not shift.can_fill_data:
            return Response(
                {'error': 'Cannot fill data - only allowed on the scheduled day'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = ShiftFillDataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shift.fill_data(serializer.validated_data)
        return Response(ShiftSerializer(shift).data)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit shift for approval."""
        shift = self.get_object()
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        try:
            shift.submit()
            return Response(ShiftSerializer(shift).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        """Approve shift."""
        shift = self.get_object()
        try:
            work_log = shift.approve(request.user)
            return Response({
                'shift': ShiftSerializer(shift).data,
                'work_log_id': str(work_log.id) if work_log else None
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        """Reject shift with reason."""
        shift = self.get_object()
        serializer = ShiftRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            shift.reject(serializer.validated_data['reason'])
            return Response(ShiftSerializer(shift).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def pending(self, request):
        """Get pending shifts."""
        pending = self.queryset.filter(status=Shift.Status.SUBMITTED)
        serializer = ShiftSerializer(pending, many=True)
        return Response(serializer.data)


# =============================================================================
# UNIFIED WORK ENTRY VIEWSET
# =============================================================================

class WorkEntryViewSet(viewsets.ModelViewSet):
    """
    Unified Work Entry ViewSet.
    
    Replaces separate ShiftAssignment and WorkLog views.
    Single source of truth for all work entries.
    """
    
    queryset = WorkEntry.objects.select_related(
        'employee', 'project', 'project__customer',
        'shift_template', 'planned_supervisor', 'agency',
        'service', 'approved_by'
    ).order_by('-work_date', '-actual_start_datetime')
    pagination_class = LargePagination
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin sees all, employees see their own
        if user.is_admin:
            queryset = self.queryset
        else:
            queryset = self.queryset.filter(employee__user=user)
        
        # Apply filters from query params
        params = self.request.query_params
        
        # Status filter
        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Status exclusion
        exclude_status = params.getlist('exclude_status')
        if exclude_status:
            queryset = queryset.exclude(status__in=exclude_status)
        
        # Date filters
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        if start_date:
            queryset = queryset.filter(work_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(work_date__lte=end_date)
        
        # Include past entries (default: only today onwards for list views)
        # For detail actions (retrieve, update, destroy, approve, reject), always include past entries
        is_detail_action = self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'approve', 'reject']
        include_past = params.get('include_past', 'false').lower() == 'true'
        if not is_detail_action and not include_past and not start_date and not end_date:
            queryset = queryset.filter(work_date__gte=date.today())
        
        # Customer filter
        customer = params.get('customer')
        if customer:
            queryset = queryset.filter(project__customer_id=customer)
        
        # Project filter
        project = params.get('project')
        if project:
            queryset = queryset.filter(project_id=project)
        
        # Year filter (for calendar views)
        year = params.get('year')
        if year:
            queryset = queryset.filter(work_date__year=int(year))
        
        # Work date exact filter
        work_date = params.get('work_date')
        if work_date:
            queryset = queryset.filter(work_date=work_date)
        
        # Employee filter (for admin)
        employee_ids = params.getlist('employee')
        if employee_ids:
            queryset = queryset.filter(employee__user_id__in=employee_ids)
        
        # Supervisor (Outfolder/Rayon) filter
        supervisor = params.get('supervisor')
        if supervisor:
            queryset = queryset.filter(planned_supervisor_id=supervisor)
        
        # Week range filters - use work_date's ISO week for robust filtering
        # (billing_week fields might be NULL for newly created entries)
        week_year = params.get('week_year')
        week_number = params.get('week_number')
        
        # New cross-year range parameters
        week_start_year = params.get('week_start_year')
        week_start_number = params.get('week_start_number')
        week_end_year = params.get('week_end_year')
        week_end_number = params.get('week_end_number')
        
        # Legacy single-year range parameters (for backward compatibility)
        week_number_min = params.get('week_number_min')
        week_number_max = params.get('week_number_max')
        
        try:
            if week_start_year and week_start_number:
                # Cross-year range filter using date calculation
                from datetime import datetime, timedelta
                
                start_year = int(week_start_year)
                start_week = int(week_start_number)
                
                if week_end_year and week_end_number:
                    end_year = int(week_end_year)
                    end_week = int(week_end_number)
                else:
                    end_year = start_year
                    end_week = 53
                
                # Calculate start date (Monday of start week)
                # ISO week 1 is the week containing Jan 4
                start_date = datetime.strptime(f'{start_year}-W{start_week:02d}-1', '%G-W%V-%u').date()
                # Calculate end date (Sunday of end week)
                end_date = datetime.strptime(f'{end_year}-W{end_week:02d}-7', '%G-W%V-%u').date()
                
                # Filter by work_date within the calculated range
                queryset = queryset.filter(work_date__gte=start_date, work_date__lte=end_date)
                
            elif week_year and week_number:
                # Exact week match using date calculation
                from datetime import datetime
                year = int(week_year)
                wk = int(week_number)
                start_date = datetime.strptime(f'{year}-W{wk:02d}-1', '%G-W%V-%u').date()
                end_date = datetime.strptime(f'{year}-W{wk:02d}-7', '%G-W%V-%u').date()
                queryset = queryset.filter(work_date__gte=start_date, work_date__lte=end_date)
                
            elif week_year:
                # Legacy single-year range
                from datetime import datetime
                year = int(week_year)
                min_wk = int(week_number_min) if week_number_min else 1
                max_wk = int(week_number_max) if week_number_max else 53
                start_date = datetime.strptime(f'{year}-W{min_wk:02d}-1', '%G-W%V-%u').date()
                end_date = datetime.strptime(f'{year}-W{max_wk:02d}-7', '%G-W%V-%u').date()
                queryset = queryset.filter(work_date__gte=start_date, work_date__lte=end_date)
        except (ValueError, TypeError):
            pass
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WorkEntryDetailSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return WorkEntryCreateSerializer
        if self.action == 'fill_data':
            return WorkEntryFillDataSerializer
        if self.action == 'approve':
            return WorkEntryApprovalSerializer
        if self.action == 'reject':
            return WorkEntryRejectionSerializer
        return WorkEntryListSerializer
    
    def get_permissions(self):
        if self.action in ['approve', 'reject', 'pending']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]
    
    def create(self, request, *args, **kwargs):
        """Create a work entry."""
        return super().create(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a work entry."""
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Lightweight calendar endpoint — returns only dates and counts.
        
        Used by the Planning page to show dots/badges on the calendar
        without loading full work entry details.
        
        Query params: project (required), year (optional)
        Response: {"days": {"2026-02-12": 3, "2026-02-13": 1, ...}}
        """
        from django.db.models import Count
        
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'error': 'project parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        year = request.query_params.get('year', date.today().year)
        
        # Get employee filter if provided
        employee_ids = request.query_params.get('employee')
        
        qs = WorkEntry.objects.filter(
            project_id=project_id,
            work_date__year=int(year)
        )
        
        if employee_ids:
            ids = [eid.strip() for eid in employee_ids.split(',') if eid.strip()]
            qs = qs.filter(employee_id__in=ids)
        
        # Group by date and count
        counts = qs.values('work_date').annotate(count=Count('id')).order_by('work_date')
        
        days = {}
        for row in counts:
            days[str(row['work_date'])] = row['count']
        
        return Response({
            'days': days,
            'total_days': len(days),
        })
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create work entries in bulk (used by Planning page schedule).
        
        Creates one WorkEntry per employee per date.
        """
        serializer = WorkEntryBulkCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        
        return Response({
            'created_count': len(result['created']),
            'skipped_count': len(result['skipped']),
            'skipped': result['skipped'],
        }, status=status.HTTP_201_CREATED)
    
    # =========================================================================
    # LIST ACTIONS
    # =========================================================================
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """Get current user's work entries (for mobile app)."""
        user = request.user
        
        try:
            employee = EmployeeProfile.objects.get(user=user)
        except EmployeeProfile.DoesNotExist:
            return Response({'results': [], 'count': 0})
        
        queryset = self.queryset.filter(employee=employee)
        
        # Apply date filters
        params = request.query_params
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        include_past = params.get('include_past', 'false').lower() == 'true'
        
        # Exclude cancelled
        queryset = queryset.exclude(status='cancelled')
        
        if start_date:
            queryset = queryset.filter(work_date__gte=start_date)
        elif not include_past:
            queryset = queryset.filter(work_date__gte=date.today())
        
        if end_date:
            queryset = queryset.filter(work_date__lte=end_date)
        elif not include_past and not start_date:
            max_date = date.today() + timedelta(days=365)
            queryset = queryset.filter(work_date__lte=max_date)
        
        # Order by date
        queryset = queryset.order_by('work_date', 'planned_start_time')
        
        # Simple pagination
        page = int(params.get('page', 1))
        page_size = int(params.get('page_size', 20))
        total = queryset.count()
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        entries = queryset[start_idx:end_idx]
        serializer = WorkEntryListSerializer(entries, many=True)
        
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'has_more': end_idx < total,
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def pending(self, request):
        """Get all entries pending approval (admin only)."""
        pending_statuses = ['submitted', 'pending']
        queryset = self.queryset.filter(status__in=pending_statuses)
        serializer = WorkEntryListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    # =========================================================================
    # EMPLOYEE ACTIONS
    # =========================================================================
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Employee confirms/acknowledges planned entry."""
        entry = self.get_object()
        
        if entry.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your entry'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            entry.confirm()
            return Response(WorkEntryDetailSerializer(entry).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def fill_data(self, request, pk=None):
        """Employee fills actual work times."""
        entry = self.get_object()
        
        if entry.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your entry'}, status=status.HTTP_403_FORBIDDEN)
        
        if not entry.can_fill_data:
            return Response(
                {'error': 'Cannot fill data - only allowed within 7 days and before approval'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = WorkEntryFillDataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        entry.actual_start_datetime = data['actual_start_datetime']
        entry.actual_end_datetime = data['actual_end_datetime']
        entry.breaks = data.get('breaks', [])
        entry.break_duration_minutes = data.get('break_duration_minutes', 0)
        entry.notes = data.get('notes', entry.notes)
        entry.status = WorkEntry.Status.DRAFT
        entry.save()
        
        return Response(WorkEntryDetailSerializer(entry).data)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Employee submits entry for approval."""
        entry = self.get_object()
        
        if entry.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your entry'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            entry.submit()
            self._notify_admins_entry_submitted(entry)
            return Response(WorkEntryDetailSerializer(entry).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    # =========================================================================
    # ADMIN ACTIONS
    # =========================================================================
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        """Admin approves entry (can approve from any status)."""
        entry = self.get_object()
        
        # Skip if already approved
        if entry.status == 'approved':
            return Response({'error': 'Already approved'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = WorkEntryApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if serializer.validated_data.get('adjusted_hours'):
            entry.admin_adjusted_hours = serializer.validated_data['adjusted_hours']
        if serializer.validated_data.get('admin_notes'):
            entry.admin_notes = serializer.validated_data['admin_notes']
        
        entry.approve(request.user)
        self._create_wallet_earning(entry)
        self._notify_employee(entry, 'approved', 
            f"Your work entry for {entry.work_date} has been approved!")
        
        return Response(WorkEntryDetailSerializer(entry).data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        """Admin rejects entry with reason (can reject from any status)."""
        entry = self.get_object()
        
        if entry.status == 'rejected':
            return Response({'error': 'Already rejected'}, status=status.HTTP_400_BAD_REQUEST)
        if entry.status == 'cancelled':
            return Response({'error': 'Cannot reject cancelled entries'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = WorkEntryRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['reason']
        
        entry.reject(reason)
        self._notify_employee(entry, 'rejected',
            f"Your work entry for {entry.work_date} needs revision. Reason: {reason}")
        
        return Response(WorkEntryDetailSerializer(entry).data)
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    def _notify_admins_entry_submitted(self, entry):
        """Notify admins about new submission."""
        try:
            from apps.notifications.models import Notification
            from apps.employees.models import User
            
            for admin in User.objects.filter(is_staff=True, is_active=True):
                Notification.objects.create(
                    recipient=admin,
                    notification_type=Notification.Type.WORKLOG_SUBMITTED,
                    priority=Notification.Priority.NORMAL,
                    title=f"New Work Entry from {entry.employee.full_name}",
                    message=f"{entry.employee.full_name} submitted work entry for {entry.work_date} ({entry.calculated_hours}h).",
                    reference_type='workentry',
                    reference_id=entry.id,
                    action_url=f"/dashboard/worklogs?id={entry.id}"
                )
        except Exception as e:
            print(f"Failed to notify admins: {e}")
    
    def _notify_employee(self, entry, status_type, message):
        """Notify employee about entry status change."""
        try:
            from apps.notifications.models import Notification
            
            notification_type = (
                Notification.Type.WORKLOG_APPROVED if status_type == 'approved'
                else Notification.Type.WORKLOG_REJECTED
            )
            
            Notification.objects.create(
                recipient=entry.employee.user,
                notification_type=notification_type,
                priority=Notification.Priority.NORMAL if status_type == 'approved' else Notification.Priority.HIGH,
                title=f"Work Entry {status_type.title()}",
                message=message,
                reference_type='workentry',
                reference_id=entry.id,
                action_url=f"/app/entries/{entry.id}"
            )
        except Exception as e:
            print(f"Failed to notify employee: {e}")
    
    def _create_wallet_earning(self, entry):
        """Create wallet earning transaction for approved entry."""
        try:
            from apps.wallet.models import Wallet, WalletTransaction
            
            wallet, _ = Wallet.objects.get_or_create(employee=entry.employee)
            
            # Calculate earnings
            hourly_rate = 15.00  # Default rate
            earnings = float(entry.calculated_hours) * hourly_rate
            
            WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type=WalletTransaction.Type.EARNING,
                amount=earnings,
                description=f"Work: {entry.project.name} ({entry.work_date})",
                reference_type='workentry',
                reference_id=entry.id,
                created_by=entry.approved_by
            )
        except Exception as e:
            print(f"Failed to create wallet earning: {e}")
