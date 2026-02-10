import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../data/shift_service.dart';
import '../../../worklogs/data/worklog_service.dart';

/// Helper class for break time entries
class _BreakTime {
  String? startTime;
  String? endTime;
  
  _BreakTime({this.startTime, this.endTime});
  
  Map<String, String> toJson() => {
    'start': startTime ?? '',
    'end': endTime ?? '',
  };
}

class FillWorkTimesScreen extends StatefulWidget {
  final AssignedShift shift;

  const FillWorkTimesScreen({super.key, required this.shift});

  @override
  State<FillWorkTimesScreen> createState() => _FillWorkTimesScreenState();
}

class _FillWorkTimesScreenState extends State<FillWorkTimesScreen> {
  final _formKey = GlobalKey<FormState>();
  final WorkLogService _workLogService = WorkLogService();
  final ImagePicker _imagePicker = ImagePicker();
  
  // Form controllers
  late TextEditingController _startTimeController;
  late TextEditingController _endTimeController;
  late TextEditingController _notesController;
  late TextEditingController _locationController;
  
  // Multiple breaks with start/end times
  List<_BreakTime> _breaks = [];
  
  // Photos
  List<XFile> _photos = [];
  
  late DateTime _selectedDate;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.shift.date;
    _startTimeController = TextEditingController(text: widget.shift.startTime);
    _endTimeController = TextEditingController(text: widget.shift.endTime);
    _notesController = TextEditingController();
    _locationController = TextEditingController(text: widget.shift.fullAddress);
  }

  @override
  void dispose() {
    _startTimeController.dispose();
    _endTimeController.dispose();
    _notesController.dispose();
    _locationController.dispose();
    super.dispose();
  }
  
  int get _totalBreakMinutes {
    int total = 0;
    for (final b in _breaks) {
      if (b.startTime != null && b.endTime != null) {
        final startParts = b.startTime!.split(':');
        final endParts = b.endTime!.split(':');
        final startMins = int.parse(startParts[0]) * 60 + int.parse(startParts[1]);
        var endMins = int.parse(endParts[0]) * 60 + int.parse(endParts[1]);
        if (endMins < startMins) endMins += 24 * 60; // Overnight
        total += endMins - startMins;
      }
    }
    return total;
  }

  Future<void> _selectTime(TextEditingController controller, String title) async {
    final parts = controller.text.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 9,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
    );
    
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF3B82F6),
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
      controller.text = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {});
    }
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF3B82F6),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  double _calculateHours() {
    try {
      final startParts = _startTimeController.text.split(':');
      final endParts = _endTimeController.text.split(':');
      
      final startMinutes = int.parse(startParts[0]) * 60 + int.parse(startParts[1]);
      var endMinutes = int.parse(endParts[0]) * 60 + int.parse(endParts[1]);
      
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      final totalMinutes = endMinutes - startMinutes - _totalBreakMinutes;
      
      return totalMinutes / 60.0;
    } catch (e) {
      return 0;
    }
  }

  Future<void> _submitWorkLog() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _loading = true;
      _error = null;
    });
    
    try {
      // Convert breaks to API format
      final breaksData = _breaks
          .where((b) => b.startTime != null && b.endTime != null)
          .map((b) => {'start': b.startTime!, 'end': b.endTime!})
          .toList();
      
      await _workLogService.submitWorkLog(
        assignmentId: widget.shift.id,
        date: _selectedDate,
        startTime: _startTimeController.text,
        endTime: _endTimeController.text,
        breaks: breaksData.isNotEmpty ? breaksData : null,
        breakMinutes: breaksData.isEmpty ? 0 : null,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
        photoPaths: _photos.isNotEmpty ? _photos.map((p) => p.path).toList() : null,
      );
      
      if (mounted) {
        _showSuccessDialog();
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF10B981),
                  size: 64,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Work Log Submitted!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Your work log for ${DateFormat('MMM d, yyyy').format(_selectedDate)} has been submitted successfully.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context); // Close dialog
                    Navigator.pop(context, true); // Go back with success
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    final hours = _calculateHours();
    
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: SafeArea(
        child: Column(
          children: [
            // Custom App Bar
            _buildAppBar(),
            
            // Form Content
            Expanded(
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Project & Shift Info (Read-only)
                      _buildSectionTitle('PROJECT DETAILS'),
                      const SizedBox(height: 12),
                      _buildReadOnlyField(
                        icon: Icons.work_rounded,
                        label: 'Project',
                        value: widget.shift.projectName,
                      ),
                      const SizedBox(height: 12),
                      _buildReadOnlyField(
                        icon: Icons.label_rounded,
                        label: 'Shift Type',
                        value: widget.shift.shiftName,
                        color: _parseColor(widget.shift.shiftColor),
                      ),
                      if (widget.shift.customerName.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _buildReadOnlyField(
                          icon: Icons.business_rounded,
                          label: 'Customer',
                          value: widget.shift.customerName,
                        ),
                      ],
                      if (widget.shift.supervisorName != null) ...[
                        const SizedBox(height: 12),
                        _buildReadOnlyField(
                          icon: Icons.person_rounded,
                          label: 'Supervisor',
                          value: widget.shift.supervisorName!,
                        ),
                      ],
                      
                      const SizedBox(height: 28),
                      
                      // Editable Fields
                      _buildSectionTitle('WORK DETAILS'),
                      const SizedBox(height: 12),
                      
                      // Date Field
                      _buildDateField(),
                      const SizedBox(height: 12),
                      
                      // Location Field
                      _buildTextField(
                        controller: _locationController,
                        label: 'Work Location',
                        icon: Icons.location_on_rounded,
                        iconColor: const Color(0xFFEF4444),
                      ),
                      
                      const SizedBox(height: 28),
                      
                      // Time Section
                      _buildSectionTitle('WORKING HOURS'),
                      const SizedBox(height: 12),
                      
                      // Time inputs row
                      Row(
                        children: [
                          Expanded(
                            child: _buildTimePickerField(
                              controller: _startTimeController,
                              label: 'Start Time',
                              icon: Icons.play_circle_rounded,
                              iconColor: const Color(0xFF10B981),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildTimePickerField(
                              controller: _endTimeController,
                              label: 'End Time',
                              icon: Icons.stop_circle_rounded,
                              iconColor: const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      
                      // Break Field
                      _buildBreaksSection(),
                      const SizedBox(height: 16),
                      
                      // Total Hours Card
                      _buildTotalHoursCard(hours),
                      
                      const SizedBox(height: 28),
                      
                      // Photos Section
                      _buildSectionTitle('PHOTOS'),
                      const SizedBox(height: 12),
                      _buildPhotosSection(),
                      
                      const SizedBox(height: 28),
                      
                      // Notes Section
                      _buildSectionTitle('ADDITIONAL NOTES'),
                      const SizedBox(height: 12),
                      _buildNotesField(),
                      
                      // Error Message
                      if (_error != null) ...[
                        const SizedBox(height: 20),
                        _buildErrorMessage(),
                      ],
                      
                      const SizedBox(height: 32),
                      
                      // Submit Button
                      _buildSubmitButton(),
                      
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.close, color: Color(0xFF64748B), size: 20),
            ),
            onPressed: () => Navigator.pop(context),
          ),
          const Expanded(
            child: Text(
              'Log Work Hours',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
          const SizedBox(width: 48), // Balance the close button
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: Color(0xFF94A3B8),
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildReadOnlyField({
    required IconData icon,
    required String label,
    required String value,
    Color? color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (color ?? const Color(0xFF3B82F6)).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color ?? const Color(0xFF3B82F6), size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 4),
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
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.lock_outline, size: 14, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildDateField() {
    return GestureDetector(
      onTap: _selectDate,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF3B82F6).withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.calendar_month_rounded, color: Color(0xFF3B82F6), size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Work Date',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF3B82F6)),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                TextFormField(
                  controller: controller,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.only(top: 4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimePickerField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required Color iconColor,
  }) {
    return GestureDetector(
      onTap: () => _selectTime(controller, label),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: iconColor.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: iconColor.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: iconColor, size: 18),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: iconColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              controller.text,
              style: const TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E293B),
                letterSpacing: -1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.photo_library_rounded,
                      color: Color(0xFF3B82F6),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '${_photos.length} photo${_photos.length != 1 ? 's' : ''} attached',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  // Camera button
                  GestureDetector(
                    onTap: () => _pickImage(ImageSource.camera),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF3B82F6),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.camera_alt_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Gallery button
                  GestureDetector(
                    onTap: () => _pickImage(ImageSource.gallery),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF3B82F6)),
                      ),
                      child: const Icon(
                        Icons.add_photo_alternate_rounded,
                        color: Color(0xFF3B82F6),
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          
          // Photos grid
          if (_photos.isNotEmpty) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 100,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  return Container(
                    width: 100,
                    height: 100,
                    margin: EdgeInsets.only(right: index < _photos.length - 1 ? 10 : 0),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(11),
                          child: Image.file(
                            File(_photos[index].path),
                            fit: BoxFit.cover,
                          ),
                        ),
                        // Delete button
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _photos.removeAt(index);
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                color: Colors.white,
                                size: 14,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFE2E8F0),
                  style: BorderStyle.solid,
                ),
              ),
              child: const Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.add_a_photo_rounded,
                      color: Color(0xFFCBD5E1),
                      size: 32,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'No photos added yet',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      if (source == ImageSource.gallery) {
        // Pick multiple images from gallery
        final List<XFile> images = await _imagePicker.pickMultiImage();
        if (images.isNotEmpty) {
          setState(() {
            _photos.addAll(images);
          });
        }
      } else {
        // Pick single image from camera
        final XFile? image = await _imagePicker.pickImage(source: source);
        if (image != null) {
          setState(() {
            _photos.add(image);
          });
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error picking image: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  Widget _buildBreaksSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with Add button
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.coffee_rounded,
                    color: Color(0xFFF59E0B),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Breaks',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  '(optional)',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
            // Add break button
            GestureDetector(
              onTap: () {
                setState(() {
                  _breaks.add(_BreakTime());
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add_rounded, color: Colors.white, size: 18),
                    SizedBox(width: 4),
                    Text(
                      'Add Break',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        
        // Break items
        if (_breaks.isEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0), style: BorderStyle.solid),
            ),
            child: const Center(
              child: Text(
                'No breaks added. Tap "+ Add Break" to add one.',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ),
          ),
        ] else ...[
          const SizedBox(height: 12),
          ..._breaks.asMap().entries.map((entry) => 
            _buildBreakItem(entry.key, entry.value)
          ),
        ],
        
        // Total breaks summary
        if (_breaks.isNotEmpty && _totalBreakMinutes > 0) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total Break Time',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFF59E0B),
                  ),
                ),
                Text(
                  '$_totalBreakMinutes minutes',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFF59E0B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBreakItem(int index, _BreakTime breakTime) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          // Start Time
          Expanded(
            child: GestureDetector(
              onTap: () => _selectBreakTime(index, true),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Start',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    breakTime.startTime ?? '--:--',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: breakTime.startTime != null 
                          ? const Color(0xFF1E293B) 
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // Divider
          Container(
            width: 1,
            height: 40,
            color: const Color(0xFFE2E8F0),
          ),
          
          // End Time
          Expanded(
            child: GestureDetector(
              onTap: () => _selectBreakTime(index, false),
              child: Padding(
                padding: const EdgeInsets.only(left: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'End',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      breakTime.endTime ?? '--:--',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: breakTime.endTime != null 
                            ? const Color(0xFF1E293B) 
                            : const Color(0xFFCBD5E1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          // Delete button
          GestureDetector(
            onTap: () {
              setState(() {
                _breaks.removeAt(index);
              });
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.close_rounded,
                color: Color(0xFFEF4444),
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _selectBreakTime(int breakIndex, bool isStart) async {
    final breakTime = _breaks[breakIndex];
    final currentTimeStr = isStart ? breakTime.startTime : breakTime.endTime;
    
    TimeOfDay initialTime = const TimeOfDay(hour: 12, minute: 0);
    if (currentTimeStr != null) {
      final parts = currentTimeStr.split(':');
      initialTime = TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    }
    
    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFF59E0B),
            ),
            timePickerTheme: TimePickerThemeData(
              backgroundColor: Colors.white,
              hourMinuteShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
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
      final timeStr = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {
        if (isStart) {
          _breaks[breakIndex].startTime = timeStr;
        } else {
          _breaks[breakIndex].endTime = timeStr;
        }
      });
    }
  }

  Widget _buildTotalHoursCard(double hours) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF10B981), Color(0xFF059669)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.timer_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'TOTAL WORKING HOURS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white70,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${hours.toStringAsFixed(2)} hours',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotesField() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.note_alt_rounded, color: Color(0xFF6366F1), size: 18),
              ),
              const SizedBox(width: 10),
              const Text(
                'Notes (Optional)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _notesController,
            maxLines: 4,
            style: const TextStyle(
              fontSize: 15,
              color: Color(0xFF1E293B),
              height: 1.5,
            ),
            decoration: const InputDecoration(
              border: InputBorder.none,
              hintText: 'Add any notes about your work...',
              hintStyle: TextStyle(color: Color(0xFFCBD5E1)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _error!,
              style: const TextStyle(
                color: Color(0xFFDC2626),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _loading ? null : _submitWorkLog,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: _loading
                ? const Center(
                    child: SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    ),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.send_rounded, color: Colors.white, size: 22),
                      SizedBox(width: 12),
                      Text(
                        'Submit Work Log',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Color _parseColor(String colorHex) {
    try {
      return Color(int.parse(colorHex.replaceFirst('#', '0xFF')));
    } catch (e) {
      return const Color(0xFF10B981);
    }
  }
}
