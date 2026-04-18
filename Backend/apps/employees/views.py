"""
Employee API Views.

ViewSets with proper permissions and business logic.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from urllib.parse import quote

from .models import (
    User, EmployeeProfile, DocumentType, ContractType, Agency, EmployeeAgencyHistory,
    SurchargeType, AgencySurcharge, AgencyWallet, AgencyTransaction, EmployeeRateHistory,
    EmployeeContractHistory, AllowanceType
)
from .serializers import (
    UserSerializer, UserCreateSerializer, ShareCredentialsSerializer,
    DocumentTypeSerializer, ContractTypeSerializer, AgencySerializer, EmployeeAgencyHistorySerializer,
    EmployeeProfileListSerializer, EmployeeProfileDetailSerializer,
    EmployeeProfileCompletionSerializer, EmployeeSubmitSerializer,
    EmployeeApprovalSerializer, EmployeeRejectionSerializer,
    SurchargeTypeSerializer, AgencySurchargeSerializer, AgencySurchargeCreateSerializer,
    AgencyWalletSerializer, AgencyTransactionSerializer, AgencyDetailSerializer,
    EmployeeRateHistorySerializer, EmployeeContractHistorySerializer, AllowanceTypeSerializer
)


# =============================================================================
# PERMISSIONS
# =============================================================================

class IsAdmin(permissions.BasePermission):
    """Allow access only to admin users."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsAdminOrSelf(permissions.BasePermission):
    """Allow access to admin or the user themselves."""
    
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj == request.user


# =============================================================================
# USER VIEWSET (Admin only)
# =============================================================================

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user accounts.
    Admin only - employees cannot create accounts.
    """
    
    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAdmin]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    @action(detail=True, methods=['post'])
    def share_credentials(self, request, pk=None):
        """
        Share login credentials via WhatsApp or Email.
        
        POST /api/employees/users/{id}/share_credentials/
        {
            "method": "whatsapp",
            "phone_number": "+31612345678"
        }
        """
        user = self.get_object()
        serializer = ShareCredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        method = serializer.validated_data['method']
        
        # Generate temporary password (in real app, would send reset link)
        temp_password = User.objects.make_random_password(length=10)
        user.set_password(temp_password)
        user.save()
        
        message = f"""Pro Totaal Service - Login Credentials

Email: {user.email}
Temporary Password: {temp_password}

Please login at: https://app.prototaalservice.nl
Change your password after first login."""
        
        if method == 'whatsapp':
            phone = serializer.validated_data['phone_number']
            whatsapp_url = f"https://wa.me/{phone.replace('+', '')}?text={quote(message)}"
            return Response({
                'status': 'success',
                'whatsapp_url': whatsapp_url,
                'copy_text': message,  # For clipboard copy
                'message': 'Open the URL to send via WhatsApp, or copy the text'
            })
        else:
            # Email method - also include copy option
            return Response({
                'status': 'success',
                'mailto_url': f"mailto:{user.email}?subject=Pro Totaal Service Login&body={quote(message)}",
                'copy_text': message,  # For clipboard copy
                'message': 'Credentials ready to send via email, or copy the text'
            })
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Reset user password and return new temporary password."""
        user = self.get_object()
        temp_password = User.objects.make_random_password(length=10)
        user.set_password(temp_password)
        user.save()
        
        return Response({
            'status': 'success',
            'temporary_password': temp_password,
            'message': 'Password reset successfully'
        })


# =============================================================================
# DOCUMENT TYPE VIEWSET (Admin only)
# =============================================================================

class DocumentTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing document types."""
    
    queryset = DocumentType.objects.all().order_by('name')
    serializer_class = DocumentTypeSerializer
    permission_classes = [IsAdmin]


# =============================================================================
# EMPLOYEE PROFILE VIEWSET
# =============================================================================

class EmployeeProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for employee profiles.
    
    Supports:
    - Admin: Full CRUD + approval/rejection
    - Employee: View own profile, complete profile
    """
    
    queryset = EmployeeProfile.objects.select_related(
        'user', 'document_type', 'approved_by'
    ).order_by('-created_at')
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'approve', 'reject', 'soft_delete', 'restore', 'deleted']:
            return [IsAdmin()]
        if self.action in ['complete_profile', 'submit', 'my_profile']:
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeProfileListSerializer
        if self.action == 'complete_profile':
            return EmployeeProfileCompletionSerializer
        if self.action == 'submit':
            return EmployeeSubmitSerializer
        if self.action == 'approve':
            return EmployeeApprovalSerializer
        if self.action == 'reject':
            return EmployeeRejectionSerializer
        return EmployeeProfileDetailSerializer
    
    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get current user's employee profile."""
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
            serializer = EmployeeProfileDetailSerializer(profile)
            return Response(serializer.data)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['put', 'patch'])
    def complete_profile(self, request):
        """
        Employee completes their profile on first login.
        Also allows re-editing if profile was rejected.
        
        PUT/PATCH /api/employees/profiles/complete_profile/
        """
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
        except EmployeeProfile.DoesNotExist:
            # Create profile if doesn't exist
            profile = EmployeeProfile(user=request.user)
        
        # Allow editing only for incomplete or rejected profiles
        allowed_statuses = [
            EmployeeProfile.ProfileStatus.INCOMPLETE,
            EmployeeProfile.ProfileStatus.REJECTED,
        ]
        if profile.status not in allowed_statuses:
            return Response(
                {'error': 'Profile cannot be edited after approval or while pending'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = EmployeeProfileCompletionSerializer(
            profile,
            data=request.data,
            partial=(request.method == 'PATCH')
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(EmployeeProfileDetailSerializer(profile).data)
    
    @action(detail=False, methods=['post'])
    def submit(self, request):
        """
        Submit profile for admin approval.
        Locks the profile from further edits.
        Also allows resubmission of rejected profiles.
        
        POST /api/employees/profiles/submit/
        """
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found. Complete your profile first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Allow submission only for incomplete or rejected profiles
        allowed_statuses = [
            EmployeeProfile.ProfileStatus.INCOMPLETE,
            EmployeeProfile.ProfileStatus.REJECTED,
        ]
        if profile.status not in allowed_statuses:
            status_msg = 'already submitted and awaiting review' if profile.status == EmployeeProfile.ProfileStatus.PENDING else 'already approved'
            return Response(
                {'error': f'Profile {status_msg}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate all mandatory fields are filled
        required_fields = [
            'first_name', 'last_name', 'initials', 'gender', 'date_of_birth',
            'bsn', 'document_type', 'document_number',
            'phone_number', 'address', 'postcode',
            'city', 'iban', 'nationality',
        ]
        
        missing = []
        for field in required_fields:
            value = getattr(profile, field)
            if not value:
                missing.append(field)
        
        # Check ID document: either (front + back) OR pdf is required
        has_front_back = profile.id_document_front and profile.id_document_back
        has_pdf = profile.id_document_pdf
        if not has_front_back and not has_pdf:
            missing.append('id_document (upload front+back or PDF)')
        
        if missing:
            return Response(
                {'error': f'Missing required fields: {", ".join(missing)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Change status to PENDING
        profile.status = EmployeeProfile.ProfileStatus.PENDING
        profile.save()
        
        return Response(EmployeeSubmitSerializer(profile).data)

    def perform_update(self, serializer):
        """
        Overridden to track hourly rate changes in history.
        """
        instance = serializer.instance
        old_rate = instance.hourly_rate
        new_rate = serializer.validated_data.get('hourly_rate')

        # Only process if hourly_rate is present in data and has changed
        if new_rate is not None and old_rate != new_rate:
            from .models import EmployeeRateHistory
            
            today = timezone.now().date()
            yesterday = today - timezone.timedelta(days=1)
            
            # Find current open history record (no effective_to date)
            current_history = EmployeeRateHistory.objects.filter(
                employee=instance,
                effective_to__isnull=True
            ).first()
            
            if current_history:
                # Always close the previous record and create a new one
                # Use today as effective_to for same-day changes (so both are visible)
                if current_history.effective_from == today:
                    # Same-day: set effective_to to today (so record shows the same day range)
                    current_history.effective_to = today
                else:
                    # Different day: set effective_to to yesterday
                    current_history.effective_to = yesterday
                current_history.save()
                
                # Create new current rate record
                EmployeeRateHistory.objects.create(
                    employee=instance,
                    hourly_rate=new_rate,
                    effective_from=today,
                    changed_by=self.request.user if self.request.user.is_authenticated else None,
                    notes="Rate updated via profile edit"
                )
            else:
                # No current history exists
                if old_rate is not None:
                    # Retroactively capture old rate (from employee creation to yesterday)
                    EmployeeRateHistory.objects.create(
                        employee=instance,
                        hourly_rate=old_rate,
                        effective_from=instance.created_at.date(),
                        effective_to=yesterday,
                        notes="Initial rate (auto-generated on first change)"
                    )
                
                # Create new current rate record
                EmployeeRateHistory.objects.create(
                    employee=instance,
                    hourly_rate=new_rate,
                    effective_from=today,
                    changed_by=self.request.user if self.request.user.is_authenticated else None,
                    notes="Rate updated via profile edit"
                )

        serializer.save()

    @action(detail=True, methods=['get'])
    def rate_history(self, request, pk=None):
        """Get rate history for this employee."""
        employee = self.get_object()
        # Order by: current first (effective_to is null), then by effective_from descending
        from django.db.models import Case, When, Value, IntegerField
        history = employee.rate_history.all().annotate(
            is_current=Case(
                When(effective_to__isnull=True, then=Value(0)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('is_current', '-effective_from', '-created_at')
        serializer = EmployeeRateHistorySerializer(history, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def contract_history(self, request, pk=None):
        """Get contract history for this employee."""
        employee = self.get_object()
        # Order by: current first (effective_to is null), then by effective_from descending
        from django.db.models import Case, When, Value, IntegerField
        history = employee.contract_history.all().annotate(
            is_current=Case(
                When(effective_to__isnull=True, then=Value(0)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('is_current', '-effective_from', '-created_at')
        serializer = EmployeeContractHistorySerializer(history, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def upload_contract(self, request, pk=None):
        """
        Upload a new contract document for this employee.
        
        POST /api/employees/profiles/{id}/upload_contract/
        Form data:
        - contract_document: File (required)
        - hourly_rate: Decimal (required)
        - effective_from: Date (required)
        - notes: String (optional)
        """
        employee = self.get_object()
        
        contract_file = request.FILES.get('contract_document')
        if not contract_file:
            return Response({'error': 'Contract document is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        hourly_rate = request.data.get('hourly_rate')
        if not hourly_rate:
            return Response({'error': 'Hourly rate is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        effective_from = request.data.get('effective_from')
        if not effective_from:
            effective_from = timezone.now().date()
        
        notes = request.data.get('notes', '')
        today = timezone.now().date()
        yesterday = today - timezone.timedelta(days=1)
        
        # Check if there's an existing contract on the profile that isn't in history yet
        if employee.contract_document:
            existing_in_history = EmployeeContractHistory.objects.filter(
                employee=employee,
                effective_to__isnull=True
            ).exists()
            
            if not existing_in_history:
                # Migrate the existing contract_document to history
                EmployeeContractHistory.objects.create(
                    employee=employee,
                    contract_document=employee.contract_document,
                    hourly_rate=employee.hourly_rate or 0,
                    effective_from=employee.contract_start_date or employee.created_at.date(),
                    effective_to=yesterday,
                    notes="Previous contract (migrated to history)"
                )
        
        # Close previous contract in history if any
        previous_contract = EmployeeContractHistory.objects.filter(
            employee=employee,
            effective_to__isnull=True
        ).first()
        
        if previous_contract:
            if previous_contract.effective_from == today:
                previous_contract.effective_to = today
            else:
                previous_contract.effective_to = yesterday
            previous_contract.save()
        
        # Create new contract history entry
        new_contract = EmployeeContractHistory.objects.create(
            employee=employee,
            contract_document=contract_file,
            hourly_rate=hourly_rate,
            effective_from=effective_from,
            notes=notes,
            uploaded_by=request.user if request.user.is_authenticated else None
        )
        
        # Also update the profile's contract_document field to the new file
        employee.contract_document = contract_file
        employee.save()
        
        serializer = EmployeeContractHistorySerializer(new_contract, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Admin approves employee profile.
        
        POST /api/employees/profiles/{id}/approve/
        """
        profile = self.get_object()
        
        if profile.status != EmployeeProfile.ProfileStatus.PENDING_APPROVAL:
            return Response(
                {'error': 'Profile is not pending approval'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Just approve - contract details should already be set in the profile
        profile.approve(admin_user=request.user)
        
        # Create notification for employee
        # TODO: Implement notification creation
        
        return Response({
            'status': 'success',
            'message': 'Employee approved successfully',
            'profile': EmployeeProfileDetailSerializer(profile).data
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Admin rejects employee profile.
        
        POST /api/employees/profiles/{id}/reject/
        {
            "reason": "Documents are not readable. Please upload clearer images."
        }
        """
        profile = self.get_object()
        
        if profile.status != EmployeeProfile.ProfileStatus.PENDING_APPROVAL:
            return Response(
                {'error': 'Profile is not pending approval'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = EmployeeRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        profile.reject(serializer.validated_data['reason'])
        
        return Response({
            'status': 'success',
            'message': 'Employee rejected',
            'profile': EmployeeProfileDetailSerializer(profile).data
        })
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get all profiles pending approval (admin only)."""
        pending = self.queryset.filter(
            status=EmployeeProfile.ProfileStatus.PENDING_APPROVAL
        )
        serializer = EmployeeProfileListSerializer(pending, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active employees (admin only)."""
        active = self.queryset.filter(
            status=EmployeeProfile.ProfileStatus.APPROVED
        )
        serializer = EmployeeProfileListSerializer(active, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def soft_delete(self, request, pk=None):
        """
        Soft delete an employee profile. Does not remove from database.
        The employee can be restored later.
        
        POST /api/employees/profiles/{id}/soft_delete/
        """
        profile = self.get_object()
        profile.soft_delete(user=request.user)
        
        # Also deactivate the user account
        profile.user.is_active = False
        profile.user.save(update_fields=['is_active'])
        
        return Response({
            'status': 'success',
            'message': f'Employee {profile.full_name} has been deleted',
            'can_restore': True
        })
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """
        Restore a soft-deleted employee profile.
        
        POST /api/employees/profiles/{id}/restore/
        """
        # Use all_objects to find deleted profiles
        try:
            profile = EmployeeProfile.all_objects.get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {'error': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not profile.is_deleted:
            return Response(
                {'error': 'Employee is not deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile.restore()
        
        # Reactivate the user account
        profile.user.is_active = True
        profile.user.save(update_fields=['is_active'])
        
        return Response({
            'status': 'success',
            'message': f'Employee {profile.full_name} has been restored',
            'profile': EmployeeProfileDetailSerializer(profile).data
        })
    
    @action(detail=False, methods=['get'])
    def deleted(self, request):
        """Get all soft-deleted employees (admin only for recovery)."""
        deleted = EmployeeProfile.all_objects.filter(is_deleted=True).order_by('-deleted_at')
        serializer = EmployeeProfileListSerializer(deleted, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_assignments(self, request):
        """
        Get employee's work assignments.
        
        IMPORTANT: Data isolation - returns ONLY location, time, date.
        NO client name, project name, or business details.
        """
        from apps.projects.models import ProjectAssignment
        from .employee_serializers import EmployeeAssignmentSerializer
        
        assignments = ProjectAssignment.objects.filter(
            employee__user=request.user,
            is_active=True
        ).select_related('project').order_by('date_from')
        
        serializer = EmployeeAssignmentSerializer(assignments, many=True)
        return Response({'results': serializer.data})
    
    @action(detail=False, methods=['get'])
    def my_wallet(self, request):
        """Get employee's wallet with balance and recent transactions."""
        from apps.wallet.models import Wallet
        from apps.wallet.serializers import WalletSerializer
        
        try:
            wallet = Wallet.objects.get(employee__user=request.user)
            serializer = WalletSerializer(wallet)
            return Response(serializer.data)
        except Wallet.DoesNotExist:
            return Response({'balance': '0.00', 'transactions': []})
    
    @action(detail=False, methods=['get'])
    def my_notification_settings(self, request):
        """
        Get current user's notification preferences.
        Used by mobile app settings screen.
        
        GET /api/employees/profiles/my_notification_settings/
        """
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
            return Response({
                'push_notifications_enabled': profile.push_notifications_enabled,
                'notify_certificate_expiry': profile.notify_certificate_expiry,
                'notify_contract_expiry': profile.notify_contract_expiry,
                'notify_worklog_reminders': profile.notify_worklog_reminders,
                'notify_shift_changes': profile.notify_shift_changes,
                'notify_approvals': profile.notify_approvals,
            })
        except EmployeeProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['put', 'patch'])
    def update_notification_settings(self, request):
        """
        Update current user's notification preferences.
        
        PUT/PATCH /api/employees/profiles/update_notification_settings/
        {
            "push_notifications_enabled": true,
            "notify_certificate_expiry": true,
            "notify_contract_expiry": true,
            "notify_worklog_reminders": false,
            "notify_shift_changes": true,
            "notify_approvals": true
        }
        """
        try:
            profile = EmployeeProfile.objects.get(user=request.user)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        from .employee_serializers import NotificationPreferencesSerializer
        serializer = NotificationPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.update(profile, serializer.validated_data)
        
        return Response({
            'status': 'success',
            'message': 'Notification settings updated',
            'settings': {
                'push_notifications_enabled': profile.push_notifications_enabled,
                'notify_certificate_expiry': profile.notify_certificate_expiry,
                'notify_contract_expiry': profile.notify_contract_expiry,
                'notify_worklog_reminders': profile.notify_worklog_reminders,
                'notify_shift_changes': profile.notify_shift_changes,
                'notify_approvals': profile.notify_approvals,
            }
        })
    
    @action(detail=True, methods=['get'])
    def available_documents(self, request, pk=None):
        """
        Get list of available documents for an employee.
        Used by the Extract modal to show checkboxes.
        
        GET /api/employees/profiles/{id}/available_documents/
        
        Returns:
        [
            {"key": "id_document_front", "label": "ID Document (Front)", "available": true},
            {"key": "drivers_license_front", "label": "Driver's License (Front)", "available": false},
            ...
        ]
        """
        profile = self.get_object()
        from .pdf_generator import get_available_documents
        documents = get_available_documents(profile)
        return Response(documents)
    
    @action(detail=True, methods=['post'])
    def export_documents(self, request, pk=None):
        """
        Export employee documents as PDF.
        First page is always Werkgeversverklaring, followed by selected documents.
        
        POST /api/employees/profiles/{id}/export_documents/
        {
            "document_types": ["id_document_front", "id_document_back", "certificate_123"]
        }
        
        Returns: PDF file download
        """
        from django.http import HttpResponse
        from .pdf_generator import generate_employee_document_pdf
        
        profile = self.get_object()
        document_types = request.data.get('document_types', [])
        
        try:
            pdf_buffer = generate_employee_document_pdf(profile, document_types)
            
            # Create response with PDF
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            filename = f"werkgeversverklaring_{profile.full_name.replace(' ', '_')}_{timezone.now().strftime('%Y%m%d')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Failed to generate PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# =============================================================================
# CONTRACT TYPE VIEWSET (Admin only)
# =============================================================================

class ContractTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing contract types (NL-specific)."""
    
    queryset = ContractType.objects.all().order_by('sort_order', 'name')
    serializer_class = ContractTypeSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        # Admin sees all contract types
        return ContractType.objects.all().order_by('sort_order', 'name')


# =============================================================================
# AGENCY VIEWSET (Admin only)
# =============================================================================

class AgencyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing agencies.
    Supports soft delete - agencies are never hard deleted for historical tracking.
    """
    
    queryset = Agency.objects.filter(is_deleted=False).order_by('name')
    serializer_class = AgencySerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        queryset = Agency.objects.all().order_by('name')
        # By default, hide deleted agencies
        show_deleted = self.request.query_params.get('include_deleted', 'false').lower() == 'true'
        if not show_deleted:
            queryset = queryset.filter(is_deleted=False)
        return queryset
    
    def destroy(self, request, *args, **kwargs):
        """Override delete to use soft delete."""
        agency = self.get_object()
        
        # Check if agency has current employees
        if agency.current_employees.exists():
            return Response(
                {'error': 'Cannot delete agency with assigned employees. Transfer employees first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        agency.soft_delete()
        return Response({'status': 'success', 'message': 'Agency deleted (soft delete)'})
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore a soft-deleted agency."""
        agency = self.get_object()
        if not agency.is_deleted:
            return Response({'error': 'Agency is not deleted'}, status=status.HTTP_400_BAD_REQUEST)
        
        agency.is_deleted = False
        agency.is_active = True
        agency.save(update_fields=['is_deleted', 'is_active', 'updated_at'])
        return Response({'status': 'success', 'message': 'Agency restored'})
    
    @action(detail=True, methods=['get'])
    def employees(self, request, pk=None):
        """Get all employees currently assigned to this agency."""
        agency = self.get_object()
        employees = agency.current_employees.all()
        serializer = EmployeeProfileListSerializer(employees, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get all employee assignment history for this agency."""
        agency = self.get_object()
        history = agency.employee_assignments.select_related('employee').order_by('-start_date')
        serializer = EmployeeAgencyHistorySerializer(history, many=True)
        return Response(serializer.data)


# =============================================================================
# EMPLOYEE AGENCY TRANSFER (Action on EmployeeProfile)
# =============================================================================

# Add transfer_agency action to EmployeeProfileViewSet
# This would be better as a method inside the class, but appending here for now
def transfer_employee_to_agency(profile, agency, start_date, notes=''):
    """Helper function to transfer an employee to a new agency."""
    from django.utils import timezone
    
    # End current agency assignment if exists
    if profile.current_agency:
        current_assignment = EmployeeAgencyHistory.objects.filter(
            employee=profile,
            agency=profile.current_agency,
            end_date__isnull=True
        ).first()
        if current_assignment:
            current_assignment.end_date = start_date
            current_assignment.save(update_fields=['end_date', 'updated_at'])
    
    # Create new assignment
    EmployeeAgencyHistory.objects.create(
        employee=profile,
        agency=agency,
        start_date=start_date,
        notes=notes
    )
    
    # Update current agency
    profile.current_agency = agency
    profile.save(update_fields=['current_agency', 'updated_at'])
    
    return profile


# =============================================================================
# SURCHARGE TYPE VIEWSET (Admin-managed day payment types)
# =============================================================================

class SurchargeTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing surcharge types.
    Admin creates these once, they are reused across agencies.
    Examples: Weekend, Night Shift, King's Day, etc.
    """
    
    serializer_class = SurchargeTypeSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        queryset = SurchargeType.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset.order_by('sort_order', 'name')

    def perform_destroy(self, instance):
        """
        Override destroy to cascade-delete related PROTECT FK records
        before deleting the surcharge type itself.
        """
        from apps.customers.models import (
            CustomerSurcharge, CustomerServiceSurcharge,
            CustomerAllowanceSurcharge
        )
        # Delete all customer-level surcharge references
        CustomerSurcharge.objects.filter(surcharge_type=instance).delete()
        CustomerServiceSurcharge.objects.filter(surcharge_type=instance).delete()
        CustomerAllowanceSurcharge.objects.filter(surcharge_type=instance).delete()
        # Delete agency surcharges
        AgencySurcharge.objects.filter(surcharge_type=instance).delete()
        # Delete per-service surcharges (on CustomerServiceRate)
        from apps.customers.models import CustomerServiceSurcharge as _CSR
        # The first CustomerServiceSurcharge (with customer_service_rate FK) uses same class
        # but already covered above. Also clear M2M references.
        instance.customer_allowances_enabled.clear()
        instance.delete()


# =============================================================================
# ALLOWANCE TYPE VIEWSET (Admin-managed per-hour allowances)
# =============================================================================

class AllowanceTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing allowance types (Toeslag).
    Admin creates these once, they can be configured per customer.
    Examples: Ademlucht (mask), EPZ Toeslag, WZH Toeslag, etc.
    """
    
    serializer_class = AllowanceTypeSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        from apps.employees.models import AllowanceType
        queryset = AllowanceType.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset.order_by('sort_order', 'name')


# =============================================================================
# AGENCY SURCHARGE VIEWSET
# =============================================================================

class AgencySurchargeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing agency-specific surcharges.
    """
    
    serializer_class = AgencySurchargeSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        agency_id = self.kwargs.get('agency_pk')
        if agency_id:
            return AgencySurcharge.objects.filter(agency_id=agency_id)
        return AgencySurcharge.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AgencySurchargeCreateSerializer
        return AgencySurchargeSerializer


# =============================================================================
# AGENCY WALLET VIEWSET
# =============================================================================

class AgencyWalletViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for agency wallets.
    """
    
    serializer_class = AgencyWalletSerializer
    permission_classes = [IsAdmin]
    queryset = AgencyWallet.objects.all()


class AgencyTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for agency transactions.
    """
    
    serializer_class = AgencyTransactionSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        wallet_id = self.kwargs.get('wallet_pk')
        if wallet_id:
            return AgencyTransaction.objects.filter(wallet_id=wallet_id)
        return AgencyTransaction.objects.all()
