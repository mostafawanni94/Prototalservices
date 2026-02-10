/// Work Log Submission Screen
/// 
/// Allows employees to submit new work logs with allowances support.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/worklog_viewmodel.dart';
import '../../data/worklog_service.dart';
import '../../../../core/widgets/app_widgets.dart';

class WorkLogSubmissionScreen extends StatefulWidget {
  const WorkLogSubmissionScreen({super.key});

  @override
  State<WorkLogSubmissionScreen> createState() => _WorkLogSubmissionScreenState();
}

class _WorkLogSubmissionScreenState extends State<WorkLogSubmissionScreen> {
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 16, minute: 0);
  int _breakMinutes = 30;
  final _notesController = TextEditingController();
  bool _isSubmitting = false;
  
  // Allowances
  final WorkLogService _workLogService = WorkLogService();
  List<AllowanceTypeModel> _allowanceTypes = [];
  List<_AllowanceEntry> _allowanceEntries = [];
  bool _loadingAllowanceTypes = false;

  @override
  void initState() {
    super.initState();
    _loadAllowanceTypes();
  }

  Future<void> _loadAllowanceTypes() async {
    setState(() => _loadingAllowanceTypes = true);
    try {
      final types = await _workLogService.getAllowanceTypes();
      setState(() => _allowanceTypes = types);
    } catch (e) {
      debugPrint('Failed to load allowance types: $e');
    } finally {
      setState(() => _loadingAllowanceTypes = false);
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  double get _hoursWorked {
    final start = _startTime.hour * 60 + _startTime.minute;
    final end = _endTime.hour * 60 + _endTime.minute;
    return (end - start - _breakMinutes) / 60;
  }

  String _formatTime(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  void _addAllowance() {
    setState(() {
      _allowanceEntries.add(_AllowanceEntry());
    });
  }

  void _removeAllowance(int index) {
    setState(() {
      _allowanceEntries.removeAt(index);
    });
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    
    // Prepare allowances
    final allowances = _allowanceEntries
        .where((e) => e.hours > 0 && (e.selectedTypeId != null || e.customName.isNotEmpty))
        .map((e) => WorkLogAllowanceModel(
          allowanceTypeId: e.selectedTypeId,
          customName: e.customName,
          hours: e.hours,
        ))
        .toList();
    
    // In real app, would submit via ViewModel with allowances
    await Future.delayed(const Duration(seconds: 1));
    
    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Work log submitted for approval')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Log Work'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Location (read-only from assignment)
            const Text('Location', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.location_on, color: AppColors.primary),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Industrieweg 45', style: TextStyle(fontWeight: FontWeight.w600)),
                        Text('Amsterdam', style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Date
            const Text('Date', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime.now().subtract(const Duration(days: 7)),
                  lastDate: DateTime.now(),
                );
                if (date != null) setState(() => _selectedDate = date);
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, color: AppColors.textSecondary),
                    const SizedBox(width: 12),
                    Text(
                      '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Time
            const Text('Time', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final time = await showTimePicker(
                        context: context,
                        initialTime: _startTime,
                        builder: (context, child) => MediaQuery(
                          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
                          child: child!,
                        ),
                      );
                      if (time != null) setState(() => _startTime = time);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          const Text('Start', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(_formatTime(_startTime), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final time = await showTimePicker(
                        context: context,
                        initialTime: _endTime,
                        builder: (context, child) => MediaQuery(
                          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
                          child: child!,
                        ),
                      );
                      if (time != null) setState(() => _endTime = time);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          const Text('End', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(_formatTime(_endTime), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Break
            const Text('Break (minutes)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [0, 15, 30, 45, 60].map((minutes) {
                final isSelected = _breakMinutes == minutes;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _breakMinutes = minutes),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$minutes',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Hours worked
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Hours', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text(
                    '${_hoursWorked.toStringAsFixed(1)} hours',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ============ ALLOWANCES SECTION ============
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Allowances (Toeslag)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                TextButton.icon(
                  onPressed: _addAllowance,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            if (_allowanceEntries.isEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.purple.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.card_giftcard, color: Colors.purple),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'No allowances added. Tap "Add" to include special allowances.',
                        style: TextStyle(color: Colors.purple),
                      ),
                    ),
                  ],
                ),
              )
            else
              ...List.generate(_allowanceEntries.length, (index) {
                final entry = _allowanceEntries[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.purple.shade100),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.card_giftcard, color: Colors.purple, size: 20),
                          const SizedBox(width: 8),
                          Text('Allowance ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          const Spacer(),
                          IconButton(
                            onPressed: () => _removeAllowance(index),
                            icon: const Icon(Icons.close, size: 18),
                            color: Colors.red,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      
                      // Type dropdown
                      DropdownButtonFormField<int?>(
                        value: entry.selectedTypeId,
                        decoration: const InputDecoration(
                          labelText: 'Allowance Type',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        items: [
                          const DropdownMenuItem(value: null, child: Text('Custom / Other')),
                          ...(_loadingAllowanceTypes
                              ? []
                              : _allowanceTypes.map((type) => DropdownMenuItem(
                                  value: type.id,
                                  child: Text('${type.name} (€${type.basePrice}/hr)'),
                                )))
                        ],
                        onChanged: (value) {
                          setState(() {
                            entry.selectedTypeId = value;
                            if (value != null) entry.customName = '';
                          });
                        },
                      ),
                      
                      // Custom name if no type selected
                      if (entry.selectedTypeId == null) ...[
                        const SizedBox(height: 8),
                        TextFormField(
                          initialValue: entry.customName,
                          decoration: const InputDecoration(
                            labelText: 'Custom Allowance Name',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          onChanged: (value) => entry.customName = value,
                        ),
                      ],
                      
                      const SizedBox(height: 8),
                      
                      // Hours
                      Row(
                        children: [
                          const Text('Hours: ', style: TextStyle(fontWeight: FontWeight.w500)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Slider(
                              value: entry.hours,
                              min: 0,
                              max: _hoursWorked,
                              divisions: (_hoursWorked * 2).toInt().clamp(1, 100),
                              label: '${entry.hours.toStringAsFixed(1)}h',
                              onChanged: (value) => setState(() => entry.hours = value),
                            ),
                          ),
                          Text('${entry.hours.toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 24),

            // Notes
            AppTextField(
              label: 'Notes (optional)',
              controller: _notesController,
              maxLines: 3,
              hint: 'Any additional notes...',
            ),
            const SizedBox(height: 32),

            // Submit
            PrimaryButton(
              text: 'Submit for Approval',
              isLoading: _isSubmitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// Helper class for allowance entries in the form
class _AllowanceEntry {
  int? selectedTypeId;
  String customName = '';
  double hours = 0;
}

