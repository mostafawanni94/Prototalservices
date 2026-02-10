/// Shift Detail Screen
/// 
/// Shows shift details and allows employee to fill actual work times.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/shift_service.dart';

class ShiftDetailScreen extends StatefulWidget {
  final Shift shift;

  const ShiftDetailScreen({super.key, required this.shift});

  @override
  State<ShiftDetailScreen> createState() => _ShiftDetailScreenState();
}

class _ShiftDetailScreenState extends State<ShiftDetailScreen> {
  final ShiftService _shiftService = ShiftService();
  late Shift _shift;
  bool _loading = false;
  bool _submitting = false;

  // Form controllers
  final _startTimeController = TextEditingController();
  final _endTimeController = TextEditingController();
  final _breakStartController = TextEditingController();
  final _breakEndController = TextEditingController();
  final _notesController = TextEditingController();

  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  TimeOfDay? _breakStartTime;
  TimeOfDay? _breakEndTime;

  @override
  void initState() {
    super.initState();
    _shift = widget.shift;
    _initializeForm();
    
    // Auto-acknowledge on open
    if (_shift.status == 'scheduled') {
      _acknowledgeShift();
    }
  }

  void _initializeForm() {
    // Pre-fill with existing data or defaults
    if (_shift.actualStartTime != null) {
      _startTimeController.text = _shift.actualStartTime!.substring(0, 5);
      _startTime = _parseTime(_shift.actualStartTime!);
    } else if (_shift.scheduledStartTime != null) {
      _startTimeController.text = _shift.scheduledStartTime!.substring(0, 5);
      _startTime = _parseTime(_shift.scheduledStartTime!);
    }

    if (_shift.actualEndTime != null) {
      _endTimeController.text = _shift.actualEndTime!.substring(0, 5);
      _endTime = _parseTime(_shift.actualEndTime!);
    } else if (_shift.scheduledEndTime != null) {
      _endTimeController.text = _shift.scheduledEndTime!.substring(0, 5);
      _endTime = _parseTime(_shift.scheduledEndTime!);
    }

    if (_shift.breakStartTime != null) {
      _breakStartController.text = _shift.breakStartTime!.substring(0, 5);
      _breakStartTime = _parseTime(_shift.breakStartTime!);
    }

    if (_shift.breakEndTime != null) {
      _breakEndController.text = _shift.breakEndTime!.substring(0, 5);
      _breakEndTime = _parseTime(_shift.breakEndTime!);
    }

    if (_shift.employeeNotes != null) {
      _notesController.text = _shift.employeeNotes!;
    }
  }

  TimeOfDay? _parseTime(String timeStr) {
    final parts = timeStr.split(':');
    if (parts.length >= 2) {
      return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    }
    return null;
  }

  String _formatTimeOfDay(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _acknowledgeShift() async {
    try {
      final updated = await _shiftService.acknowledgeShift(_shift.id);
      setState(() => _shift = updated);
    } catch (e) {
      // Silent fail for acknowledge
    }
  }

  Future<void> _selectTime(BuildContext context, {
    required TextEditingController controller,
    required Function(TimeOfDay) onSelected,
    TimeOfDay? initialTime,
  }) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: initialTime ?? TimeOfDay.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF1E3A5F),
            ),
          ),
          child: MediaQuery(
            data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
            child: child!,
          ),
        );
      },
    );

    if (picked != null) {
      controller.text = _formatTimeOfDay(picked);
      onSelected(picked);
    }
  }

  Future<void> _saveData() async {
    if (_startTime == null || _endTime == null) {
      _showSnackBar('Please enter start and end times', isError: true);
      return;
    }

    setState(() => _loading = true);

    try {
      final updated = await _shiftService.fillShiftData(
        _shift.id,
        startTime: _formatTimeOfDay(_startTime!),
        endTime: _formatTimeOfDay(_endTime!),
        breakStartTime: _breakStartTime != null ? _formatTimeOfDay(_breakStartTime!) : null,
        breakEndTime: _breakEndTime != null ? _formatTimeOfDay(_breakEndTime!) : null,
        notes: _notesController.text,
      );
      setState(() {
        _shift = updated;
        _loading = false;
      });
      _showSnackBar('Data saved successfully');
    } catch (e) {
      setState(() => _loading = false);
      _showSnackBar(e.toString(), isError: true);
    }
  }

  Future<void> _submitShift() async {
    if (_startTime == null || _endTime == null) {
      _showSnackBar('Please fill all required times first', isError: true);
      return;
    }

    // Show confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Submit Shift?'),
        content: const Text(
          'Once submitted, you cannot edit this shift. '
          'Your supervisor will review and approve it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            ),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _submitting = true);

    try {
      // First save data
      await _shiftService.fillShiftData(
        _shift.id,
        startTime: _formatTimeOfDay(_startTime!),
        endTime: _formatTimeOfDay(_endTime!),
        breakStartTime: _breakStartTime != null ? _formatTimeOfDay(_breakStartTime!) : null,
        breakEndTime: _breakEndTime != null ? _formatTimeOfDay(_breakEndTime!) : null,
        notes: _notesController.text,
      );
      
      // Then submit
      await _shiftService.submitShift(_shift.id);
      
      setState(() => _submitting = false);
      
      _showSnackBar('Shift submitted for approval!');
      
      // Go back with refresh
      Navigator.pop(context, true);
    } catch (e) {
      setState(() => _submitting = false);
      _showSnackBar(e.toString(), isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red[600] : const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  void dispose() {
    _startTimeController.dispose();
    _endTimeController.dispose();
    _breakStartController.dispose();
    _breakEndController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          color: Colors.grey[700],
        ),
        title: const Text(
          'Shift Details',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1E293B),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status card
            _buildStatusCard(),
            const SizedBox(height: 16),
            
            // Shift info card
            _buildInfoCard(),
            const SizedBox(height: 16),
            
            // Contact info (if available)
            if (_shift.supervisorPhone != null || _shift.supervisorEmail != null)
              ...[_buildContactCard(), const SizedBox(height: 16)],
            
            // Location & Instructions
            if ((_shift.locationNotes != null && _shift.locationNotes!.isNotEmpty) ||
                (_shift.specialInstructions != null && _shift.specialInstructions!.isNotEmpty))
              ...[_buildInstructionsCard(), const SizedBox(height: 16)],
            
            // Fill data form (only if can fill - which means today)
            if (_shift.canFillData)
              _buildFillDataForm(),
            
            // Future shift notice - show when shift is in future and not filled
            if (_shift.isFuture && !_shift.canFillData && _shift.status != 'submitted' && _shift.status != 'approved')
              _buildFutureShiftNotice(),
            
            // Already submitted/approved view
            if (_shift.status == 'submitted' || _shift.status == 'approved')
              _buildSubmittedView(),
            
            // Rejected view
            if (_shift.status == 'rejected')
              _buildRejectedView(),
              
            const SizedBox(height: 100), // Space for bottom button
          ],
        ),
      ),
      bottomNavigationBar: _shift.canFillData ? _buildBottomBar() : null,
    );
  }

  Widget _buildStatusCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color(_shift.statusColor).withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Color(_shift.statusColor).withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Color(_shift.statusColor).withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _getStatusIcon(),
              color: Color(_shift.statusColor),
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _shift.statusDisplay,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(_shift.statusColor),
                  ),
                ),
                Text(
                  DateFormat('EEEE, MMMM d, yyyy').format(_shift.scheduledDate),
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          if (_shift.isToday)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'TODAY',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }

  IconData _getStatusIcon() {
    switch (_shift.status) {
      case 'scheduled': return Icons.event_rounded;
      case 'acknowledged': return Icons.visibility_rounded;
      case 'in_progress': return Icons.edit_calendar_rounded;
      case 'submitted': return Icons.send_rounded;
      case 'approved': return Icons.check_circle_rounded;
      case 'rejected': return Icons.cancel_rounded;
      default: return Icons.event_rounded;
    }
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoRow(Icons.business_rounded, 'Project', _shift.projectName),
          if (_shift.customerName != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(Icons.apartment_rounded, 'Customer', _shift.customerName!),
          ],
          if (_shift.serviceName != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(Icons.category_rounded, 'Service', _shift.serviceName!),
          ],
          const SizedBox(height: 12),
          _buildInfoRow(
            Icons.schedule_rounded,
            'Scheduled Time',
            _shift.scheduledStartTime != null && _shift.scheduledEndTime != null
                ? '${_shift.scheduledStartTime!.substring(0, 5)} - ${_shift.scheduledEndTime!.substring(0, 5)}'
                : 'Not specified',
          ),
          if (_shift.supervisorName != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(Icons.person_outline_rounded, 'Supervisor', _shift.supervisorName!),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: const Color(0xFF64748B)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey[500],
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildContactCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Supervisor Contact',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 12),
          if (_shift.supervisorPhone != null && _shift.supervisorPhone!.isNotEmpty)
            _buildContactRow(Icons.phone_rounded, _shift.supervisorPhone!),
          if (_shift.supervisorEmail != null && _shift.supervisorEmail!.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildContactRow(Icons.email_rounded, _shift.supervisorEmail!),
          ],
        ],
      ),
    );
  }

  Widget _buildContactRow(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFF0EA5E9)),
        const SizedBox(width: 12),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }

  Widget _buildInstructionsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline_rounded, size: 20, color: Colors.amber[700]),
              const SizedBox(width: 8),
              Text(
                'Instructions',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.amber[800],
                ),
              ),
            ],
          ),
          if (_shift.locationNotes != null && _shift.locationNotes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              '📍 ${_shift.locationNotes}',
              style: TextStyle(
                fontSize: 14,
                color: Colors.amber[900],
              ),
            ),
          ],
          if (_shift.specialInstructions != null && _shift.specialInstructions!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _shift.specialInstructions!,
              style: TextStyle(
                fontSize: 14,
                color: Colors.amber[900],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFutureShiftNotice() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0EA5E9).withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0EA5E9).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.schedule_rounded,
              size: 32,
              color: Color(0xFF0EA5E9),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Upcoming Shift',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0369A1),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You can fill your work times and submit this shift on ${DateFormat('EEEE, MMMM d').format(_shift.scheduledDate)}',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF0369A1),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 18,
                  color: Colors.grey[600],
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Work hours can only be submitted on the scheduled work date',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFillDataForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.edit_calendar_rounded,
                  size: 20,
                  color: Color(0xFF10B981),
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Fill Actual Work Times',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          // Work times
          Row(
            children: [
              Expanded(
                child: _buildTimeField(
                  label: 'Start Time *',
                  controller: _startTimeController,
                  onTap: () => _selectTime(
                    context,
                    controller: _startTimeController,
                    onSelected: (t) => setState(() => _startTime = t),
                    initialTime: _startTime,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildTimeField(
                  label: 'End Time *',
                  controller: _endTimeController,
                  onTap: () => _selectTime(
                    context,
                    controller: _endTimeController,
                    onSelected: (t) => setState(() => _endTime = t),
                    initialTime: _endTime,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Break times
          Row(
            children: [
              Expanded(
                child: _buildTimeField(
                  label: 'Break Start',
                  controller: _breakStartController,
                  onTap: () => _selectTime(
                    context,
                    controller: _breakStartController,
                    onSelected: (t) => setState(() => _breakStartTime = t),
                    initialTime: _breakStartTime,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildTimeField(
                  label: 'Break End',
                  controller: _breakEndController,
                  onTap: () => _selectTime(
                    context,
                    controller: _breakEndController,
                    onSelected: (t) => setState(() => _breakEndTime = t),
                    initialTime: _breakEndTime,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Notes
          _buildNotesField(),
        ],
      ),
    );
  }

  Widget _buildTimeField({
    required String label,
    required TextEditingController controller,
    required VoidCallback onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Icon(Icons.access_time_rounded, size: 18, color: Colors.grey[500]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    controller.text.isEmpty ? 'Select' : controller.text,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: controller.text.isEmpty ? Colors.grey[400] : const Color(0xFF1E293B),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNotesField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Notes (optional)',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _notesController,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: 'Add any notes about this shift...',
            hintStyle: TextStyle(color: Colors.grey[400]),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF1E3A5F)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmittedView() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your Submitted Times',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 16),
          if (_shift.actualStartTime != null && _shift.actualEndTime != null) ...[
            _buildInfoRow(
              Icons.login_rounded,
              'Work Time',
              '${_shift.actualStartTime!.substring(0, 5)} - ${_shift.actualEndTime!.substring(0, 5)}',
            ),
          ],
          if (_shift.breakStartTime != null && _shift.breakEndTime != null) ...[
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.free_breakfast_rounded,
              'Break Time',
              '${_shift.breakStartTime!.substring(0, 5)} - ${_shift.breakEndTime!.substring(0, 5)}',
            ),
          ],
          if (_shift.employeeNotes != null && _shift.employeeNotes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildInfoRow(Icons.note_rounded, 'Notes', _shift.employeeNotes!),
          ],
        ],
      ),
    );
  }

  Widget _buildRejectedView() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.error_outline_rounded, size: 20, color: Colors.red[700]),
              const SizedBox(width: 8),
              Text(
                'Shift Rejected',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.red[800],
                ),
              ),
            ],
          ),
          if (_shift.rejectionReason != null && _shift.rejectionReason!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              _shift.rejectionReason!,
              style: TextStyle(
                fontSize: 14,
                color: Colors.red[900],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _loading ? null : _saveData,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFF1E3A5F)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(
                        'Save Draft',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E3A5F),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submitShift,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.send_rounded, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Submit for Approval',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
