"""WorkLog API Views."""

from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.employees.views import IsAdmin, IsAdminOrSelf
from apps.employees.models import EmployeeProfile
from .models import WorkLog, WorkLogPhoto
from .serializers import (
    WorkLogSerializer, WorkLogCreateSerializer,
    WorkLogApprovalSerializer, WorkLogRejectionSerializer, WorkLogPhotoSerializer,
)


class WorkLogViewSet(viewsets.ModelViewSet):
    """ViewSet for work log management."""
    
    queryset = WorkLog.objects.select_related(
        'employee', 'project', 'approved_by'
    ).prefetch_related('photos').order_by('-work_date', '-start_time')
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(employee__user=user)
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WorkLogCreateSerializer
        if self.action == 'approve':
            return WorkLogApprovalSerializer
        if self.action == 'reject':
            return WorkLogRejectionSerializer
        return WorkLogSerializer
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # If admin provides an employee ID, use that employee
        if user.is_admin and 'employee' in self.request.data:
            employee_id = self.request.data.get('employee')
            try:
                employee = EmployeeProfile.objects.get(id=employee_id)
            except EmployeeProfile.DoesNotExist:
                raise serializers.ValidationError({'employee': 'Employee profile not found.'})
        else:
            # For non-admins, use their own profile
            try:
                employee = EmployeeProfile.objects.get(user=user)
            except EmployeeProfile.DoesNotExist:
                raise serializers.ValidationError({'employee': 'Employee profile not found.'})
        
        serializer.save(employee=employee, created_by=user)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit work log for approval."""
        worklog = self.get_object()
        if worklog.status != WorkLog.Status.DRAFT:
            return Response({'error': 'Already submitted'}, status=status.HTTP_400_BAD_REQUEST)
        worklog.submit()
        
        # Create notification for admins
        self._notify_admins_worklog_submitted(worklog)
        
        return Response({'status': 'success', 'message': 'Work log submitted'})
    
    def _notify_admins_worklog_submitted(self, worklog):
        """Notify all admin users about new worklog submission."""
        try:
            from apps.notifications.models import Notification
            from apps.employees.models import User
            
            # Get all admin users
            admin_users = User.objects.filter(is_staff=True, is_active=True)
            
            for admin in admin_users:
                Notification.objects.create(
                    recipient=admin,
                    notification_type=Notification.Type.WORKLOG_SUBMITTED,
                    priority=Notification.Priority.NORMAL,
                    title=f"New Work Log from {worklog.employee.full_name}",
                    message=f"{worklog.employee.full_name} submitted a work log for {worklog.work_date} ({worklog.billable_hours}h). Please review and approve.",
                    reference_type='worklog',
                    reference_id=worklog.id,
                    action_url=f"/dashboard/worklogs?id={worklog.id}"
                )
        except Exception as e:
            # Don't fail the submission if notification fails
            print(f"Failed to create admin notification: {e}")
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        """Admin approves work log."""
        worklog = self.get_object()
        # Accept both 'submitted' and 'pending' status (they are functionally equivalent)
        if worklog.status not in [WorkLog.Status.SUBMITTED, WorkLog.Status.PENDING]:
            return Response({'error': 'Not pending approval'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = WorkLogApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        worklog.approve(
            request.user,
            adjusted_hours=serializer.validated_data.get('adjusted_hours'),
            admin_notes=serializer.validated_data.get('admin_notes', '')
        )
        
        # Create wallet earning transaction
        from apps.wallet.models import Wallet, WalletTransaction
        from apps.invoices.models import ProjectRate
        
        wallet, _ = Wallet.objects.get_or_create(employee=worklog.employee)
        
        # Get rate (simplified, would need proper rate lookup)
        hourly_rate = 15.00  # Default rate
        earnings = worklog.billable_hours * hourly_rate
        
        WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type=WalletTransaction.Type.EARNING,
            amount=earnings,
            description=f"Work: {worklog.project.name} ({worklog.work_date})",
            reference_type='worklog',
            reference_id=worklog.id,
            created_by=request.user
        )
        
        # Notify employee
        self._notify_employee(worklog, 'approved', f"Your work log for {worklog.work_date} has been approved! Earnings: €{earnings:.2f}")
        
        return Response({
            'status': 'success',
            'worklog': WorkLogSerializer(worklog).data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        """Admin rejects work log."""
        worklog = self.get_object()
        # Accept both 'submitted' and 'pending' status (they are functionally equivalent)
        if worklog.status not in [WorkLog.Status.SUBMITTED, WorkLog.Status.PENDING]:
            return Response({'error': 'Not pending approval'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = WorkLogRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['reason']
        worklog.reject(reason)
        
        # Notify employee
        self._notify_employee(worklog, 'rejected', f"Your work log for {worklog.work_date} needs revision. Reason: {reason}")
        
        return Response({'status': 'success', 'message': 'Work log rejected'})
    
    def _notify_employee(self, worklog, status_type, message):
        """Notify employee about worklog status change."""
        try:
            from apps.notifications.models import Notification
            
            notification_type = (
                Notification.Type.WORKLOG_APPROVED if status_type == 'approved' 
                else Notification.Type.WORKLOG_REJECTED
            )
            priority = (
                Notification.Priority.NORMAL if status_type == 'approved'
                else Notification.Priority.HIGH
            )
            title = f"Work Log {status_type.title()}"
            
            Notification.objects.create(
                recipient=worklog.employee.user,
                notification_type=notification_type,
                priority=priority,
                title=title,
                message=message,
                reference_type='worklog',
                reference_id=worklog.id,
                action_url=f"/app/worklogs/{worklog.id}"
            )
        except Exception as e:
            print(f"Failed to create employee notification: {e}")
    
    @action(detail=True, methods=['post'])
    def add_photo(self, request, pk=None):
        """Add photo to work log."""
        worklog = self.get_object()
        # Allow adding photos for draft and pending worklogs
        if worklog.status not in [WorkLog.Status.DRAFT, WorkLog.Status.PENDING, 'pending']:
            return Response({'error': 'Cannot add photo after approval'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = WorkLogPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(work_log=worklog)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def pending(self, request):
        """Get all pending work logs."""
        pending = self.queryset.filter(status='pending')
        serializer = WorkLogSerializer(pending, many=True)
        return Response(serializer.data)


# =============================================================================
# SHIFT VIEWSET
# =============================================================================

from .models import Shift
from .serializers import (
    ShiftSerializer, ShiftCreateSerializer, 
    ShiftFillDataSerializer, ShiftRejectionSerializer
)


class ShiftViewSet(viewsets.ModelViewSet):
    """ViewSet for shift scheduling and management."""
    
    queryset = Shift.objects.select_related(
        'employee', 'project', 'supervisor', 'service', 'approved_by'
    ).order_by('-scheduled_date', 'scheduled_start_time')
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        # Employees see only their own shifts
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
        """Get employee's upcoming shifts (for mobile app)."""
        from django.utils import timezone
        today = timezone.localdate()
        
        # Get shifts from today onwards, not approved/rejected/cancelled
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
        """Mark shift as acknowledged (seen by employee)."""
        shift = self.get_object()
        
        # Verify ownership
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        
        shift.acknowledge()
        return Response(ShiftSerializer(shift).data)
    
    @action(detail=True, methods=['post'])
    def fill_data(self, request, pk=None):
        """Employee fills actual work data (only on scheduled day)."""
        shift = self.get_object()
        
        # Verify ownership
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if can fill
        if not shift.can_fill_data:
            return Response(
                {'error': 'Cannot fill data - only allowed on the scheduled day and before submission'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ShiftFillDataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        shift.fill_data(serializer.validated_data)
        return Response(ShiftSerializer(shift).data)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit shift for approval (only on scheduled day)."""
        shift = self.get_object()
        
        # Verify ownership
        if shift.employee.user != request.user and not request.user.is_admin:
            return Response({'error': 'Not your shift'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            shift.submit()
            # Create notification for admin
            from apps.notifications.models import Notification
            from apps.employees.models import User
            for admin in User.objects.filter(role='admin'):
                Notification.objects.create(
                    recipient=admin,
                    notification_type='shift_submitted',
                    title='Shift Submitted',
                    message=f'{shift.employee.full_name} submitted their shift for {shift.scheduled_date}',
                    reference_type='shift',
                    reference_id=shift.id,
                )
            return Response(ShiftSerializer(shift).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        """Approve shift and create WorkLog."""
        shift = self.get_object()
        
        try:
            work_log = shift.approve(request.user)
            # Create notification for employee
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=shift.employee.user,
                notification_type='shift_approved',
                title='Shift Approved',
                message=f'Your shift for {shift.scheduled_date} has been approved',
                reference_type='shift',
                reference_id=shift.id,
            )
            return Response({
                'shift': ShiftSerializer(shift).data,
                'work_log_id': str(work_log.id)
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
            # Create notification for employee
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=shift.employee.user,
                notification_type='shift_rejected',
                title='Shift Rejected',
                message=f'Your shift for {shift.scheduled_date} was rejected: {shift.rejection_reason}',
                reference_type='shift',
                reference_id=shift.id,
            )
            return Response(ShiftSerializer(shift).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def pending(self, request):
        """Get all pending shifts waiting approval."""
        pending = self.queryset.filter(status=Shift.Status.SUBMITTED)
        serializer = ShiftSerializer(pending, many=True)
        return Response(serializer.data)
